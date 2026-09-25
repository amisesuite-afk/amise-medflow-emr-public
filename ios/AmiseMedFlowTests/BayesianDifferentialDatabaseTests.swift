import XCTest
@testable import AmiseMedFlow

/// DiagnosticDatabase.json 2.x and the engine changes that came with it
/// (docs/clinical-validation/changes/fix-ios-differential.md, ios-last-criticals.md). The JSON side is also checked
/// without Xcode by scripts/src/diagnostic-database-schema.ts (lint:guideline-registry).
final class BayesianDifferentialDatabaseTests: XCTestCase {

    private typealias Engine = BayesianDiagnosisEngine

    // MARK: - The bundled database loads (no silent fallback lists)

    func testBundledDatabaseDecodesForBothEngines() throws {
        let url = try XCTUnwrap(Bundle.main.url(forResource: "DiagnosticDatabase", withExtension: "json"))
        let data = try Data(contentsOf: url)
        XCTAssertNoThrow(try JSONDecoder().decode(BayesianDiagnosisEngine.CandidateDatabase.self, from: data))
        XCTAssertNoThrow(try JSONDecoder().decode(BayesianDecisionEngine.CandidateDatabase.self, from: data))
        XCTAssertNotNil(BayesianDiagnosisEngine.externalDatabase, "the differential would use its built-in fallback lists")
        XCTAssertNotNil(BayesianDecisionEngine.externalDatabase)
    }

    func testSettingsDiagnosticsReportsUsingTheDatabase() {
        let status = DiagnosticDatabaseInfo.load()
        XCTAssertTrue(status.engineLoaded, status.engineError ?? "")
        XCTAssertNil(status.engineError)
        XCTAssertTrue(status.engineText.contains("Using the database"), status.engineText)
        XCTAssertTrue(status.version.hasPrefix("2."), status.version)
    }

    func testEveryPresentationNamesACuratedCandidate() throws {
        let core = try XCTUnwrap(Engine.externalDatabase?.pools[Engine.corePoolName])
        let names = Set(core.candidates.map(\.name))
        XCTAssertFalse(Engine.presentations.isEmpty)
        for presentation in Engine.presentations {
            XCTAssertFalse(presentation.keywords.isEmpty, presentation.id)
            for name in presentation.candidates {
                XCTAssertTrue(names.contains(name), "\(presentation.id): \(name)")
            }
        }
    }

    /// Complaints from every specialty get a differential (1.0.0 gave an empty list for 117
    /// routes because the database never loaded).
    func testComplaintsFromEverySpecialtyReturnADifferential() {
        let complaints = [
            "chest pain", "shortness of breath", "cough", "palpitations", "collapsed at home",
            "headache", "weakness of the left arm", "confused", "fever", "abdominal pain",
            "vomiting", "diarrhoea", "vomited blood", "yellow eyes", "leg swelling",
            "painful swollen testicle", "bleeding in pregnancy", "baby not feeding",
            "lump in the groin", "back pain", "burning when passing urine", "swollen lips",
            "tired all the time", "neck lump", "difficulty swallowing", "breast lump",
        ]
        for cc in complaints {
            let age = cc.hasPrefix("baby") ? 0 : 40
            let results = infer(cc, age: age, sex: cc.contains("testicle") ? .male : .female)
            XCTAssertFalse(results.isEmpty, cc)
        }
    }

    // MARK: - Routing reads the complaint only, negation-aware

    func testInvestigationTextDoesNotReplaceTheComplaintRoute() {
        var us = InvestigationEntry(name: "US abdomen", category: .imaging, status: .resulted)
        us.result = "No gallstones. Normal liver."
        let results = infer("central chest pain", age: 58, sex: .male, investigations: [us])
        XCTAssertTrue(results.contains { $0.name == "Acute Coronary Syndrome" },
                      results.map(\.name).joined(separator: ", "))
    }

    func testRouteTextIsNegationAwareAndWordStart() {
        XCTAssertTrue(Engine.RouteText("vomiting for two days").contains("vomit"))
        XCTAssertFalse(Engine.RouteText("abdominal pain, no vomiting").contains("vomit"))
        XCTAssertFalse(Engine.RouteText("hepatic flexure").contains("pat"))
        XCTAssertTrue(Engine.RouteText("  PE  ") == "pe")
    }

    // MARK: - Probability units

    /// logPosterior is round(ln × 5): a 10-unit lead is e² ≈ 7.4 times as likely (88 %), not
    /// e¹⁰ (100 %).
    func testDisplayedProbabilityUsesFiveLogUnitsPerNat() {
        let results = Engine.topResults(from: [scored("A", 10), scored("B", 0)])
        XCTAssertEqual(results.first?.name, "A")
        XCTAssertEqual(Double(results.first?.probability ?? 0), 88, accuracy: 1)
        XCTAssertEqual(Double(results.last?.probability ?? 0), 12, accuracy: 1)
    }

    // MARK: - "Do not miss" places

    func testRanksFourAndFiveAreHeldForEmergencyDiagnoses() {
        let list = [scored("R1", 40), scored("R2", 38), scored("R3", 36), scored("R4", 34),
                    scored("R5", 32), scored("Critical", 5, urgency: 3), scored("Low", 1)]
        let names = Engine.topResults(from: list).map(\.name)
        XCTAssertEqual(names, ["R1", "R2", "R3", "R4", "Critical"])
    }

    func testDoNotMissPlacesFallBackToProbability() {
        let list = [scored("R1", 40), scored("R2", 38), scored("R3", 36), scored("R4", 34), scored("R5", 32)]
        XCTAssertEqual(Engine.topResults(from: list).map(\.name), ["R1", "R2", "R3", "R4", "R5"])
    }

    func testRankOneFollowsThePosteriorNotUrgency() {
        let list = [scored("Routine", 12), scored("Critical", 10, urgency: 3)]
        XCTAssertEqual(Engine.topResults(from: list).first?.name, "Routine")
    }

    // MARK: - Applicability and pregnancy

    func testApplicabilityFiltersBySexAgeAndPregnancy() {
        let female = Engine.Applicability(sex: "female", minAgeYears: nil, maxAgeYears: nil, pregnancy: nil)
        XCTAssertFalse(female.applies(ageYears: 30, sex: .male, pregnancy: .unknown))
        XCTAssertTrue(female.applies(ageYears: 30, sex: .unspecified, pregnancy: .unknown))

        let child = Engine.Applicability(sex: nil, minAgeYears: nil, maxAgeYears: 2, pregnancy: nil)
        XCTAssertFalse(child.applies(ageYears: 40, sex: .female, pregnancy: .unknown))
        XCTAssertTrue(child.applies(ageYears: 0, sex: .female, pregnancy: .unknown), "unknown age never filters")

        let required = Engine.Applicability(sex: "female", minAgeYears: nil, maxAgeYears: nil, pregnancy: "required")
        XCTAssertTrue(required.applies(ageYears: 29, sex: .female, pregnancy: .pregnant))
        XCTAssertFalse(required.applies(ageYears: 29, sex: .female, pregnancy: .unknown))

        let possible = Engine.Applicability(sex: "female", minAgeYears: nil, maxAgeYears: nil, pregnancy: "possible")
        XCTAssertTrue(possible.applies(ageYears: 29, sex: .female, pregnancy: .unknown))
        XCTAssertFalse(possible.applies(ageYears: 29, sex: .female, pregnancy: .notPregnant))
    }

    func testPregnancyStatusIsReadNegationAware() {
        XCTAssertEqual(Engine.PregnancyStatus.from(texts: ["32 weeks pregnant, abdominal pain"], surgicalHistory: ""), .pregnant)
        XCTAssertEqual(Engine.PregnancyStatus.from(texts: ["not pregnant"], surgicalHistory: ""), .notPregnant)
        XCTAssertEqual(Engine.PregnancyStatus.from(texts: ["pain"], surgicalHistory: "Total abdominal hysterectomy 2015"), .notPregnant)
        XCTAssertEqual(Engine.PregnancyStatus.from(texts: ["lower abdominal pain"], surgicalHistory: ""), .unknown)
    }

    func testNoEctopicPregnancyForAMan() {
        let names = infer("lower abdominal pain", age: 30, sex: .male).map(\.name)
        XCTAssertFalse(names.contains("Ectopic Pregnancy"), names.joined(separator: ", "))
    }

    // MARK: - Vital-sign and laboratory chips

    func testChildVitalLimitsFollowAPLSBands() {
        XCTAssertEqual(Engine.VitalLimits.forAge(0).maxHeartRate, 160)
        XCTAssertEqual(Engine.VitalLimits.forAge(3).maxRespiratoryRate, 30)
        XCTAssertEqual(Engine.VitalLimits.forAge(8).minSystolic, 90)
        XCTAssertEqual(Engine.VitalLimits.forAge(40), Engine.VitalLimits(maxHeartRate: 100, minHeartRate: 50, maxRespiratoryRate: 20, minSystolic: 100))
    }

    func testNumericResultsBecomeEvidenceChips() {
        var lab = LabPanel()
        let now = Date()
        lab.potassium = FusedValue(value: 7.2, confidence: 0.85, source: .lab, timestamp: now)
        lab.alt = FusedValue(value: 2850, confidence: 0.85, source: .lab, timestamp: now)
        lab.glucose = FusedValue(value: 2.1, confidence: 0.85, source: .lab, timestamp: now)
        lab.sodium = FusedValue(value: 139, confidence: 0.85, source: .lab, timestamp: now)
        let chips = Engine.numericLabChips(lab)
        XCTAssertTrue(chips.contains("hyperkalaemia"))
        XCTAssertTrue(chips.contains("markedly raised transaminases"))
        XCTAssertTrue(chips.contains("elevated liver enzymes"))
        XCTAssertTrue(chips.contains("hypoglycaemia"))
        XCTAssertFalse(chips.contains("hyponatraemia"))
    }

    // MARK: - Finding text

    func testAmpersandTermsMustShareASentence() {
        let apart = Engine.FeatureText(["Lipase: 40", "raised bilirubin"])
        XCTAssertFalse(Engine.anyAlternative("lipase&raised", in: apart))
        XCTAssertTrue(Engine.anyAlternative("lipase|bilirubin", in: apart))
        let together = Engine.FeatureText(["Bloods: lipase raised at 900 U/L. Glucose 5.1"])
        XCTAssertTrue(Engine.anyAlternative("lipase&raised", in: together))
    }

    func testDocumentedAbsentNeedsANegatedMentionAndNoAffirmedAlternative() {
        let text = Engine.FeatureText(["Headache and fever for a day", "No neck stiffness"])
        XCTAssertTrue(Engine.anyAlternativeDocumentedAbsent("neck stiff", in: text))
        XCTAssertFalse(Engine.anyAlternativeDocumentedAbsent("fever|neck stiff", in: text))
        XCTAssertFalse(Engine.anyAlternativeDocumentedAbsent("photophob", in: text))
    }

    // MARK: - Patient context (BayesianDiagnosisEngine+Context.swift)

    func testPostOperativeDayIsReadFromTheRecord() {
        XCTAssertEqual(Engine.postOperativeDay(["Day 5 after laparoscopic anterior resection for upper rectal cancer."]), 5)
        XCTAssertEqual(Engine.postOperativeDay(["", "", "Open Hartmann's procedure (day 6)"]), 6)
        XCTAssertEqual(Engine.postOperativeDay(["Total thyroidectomy for Graves' disease this morning, returned to the ward 3 hours ago."]), 0)
        XCTAssertEqual(Engine.postOperativeDay(["POD 3 after a Whipple procedure"]), 3)
        XCTAssertEqual(Engine.postOperativeDay(["Laparoscopic cholecystectomy yesterday."]), 1)
        // The most recent operation wins.
        XCTAssertEqual(Engine.postOperativeDay(["Hernia repair (day 12). Re-laparotomy (day 2)."]), 2)
        // No operation in the sentence, or an earlier episode: nothing.
        XCTAssertNil(Engine.postOperativeDay(["Worsening breathing on day 3 of admission."]))
        XCTAssertNil(Engine.postOperativeDay(["Day 9 in ICU after a road traffic collision (pelvic fractures, splenectomy day 1)."]))
        XCTAssertNil(Engine.postOperativeDay(["At a caesarean section in 2012 she stayed on a ventilator for 6 hours after the anaesthetic."]))
        XCTAssertNil(Engine.postOperativeDay(["Appendicectomy as a child. Pain started today."]))
        XCTAssertTrue(Engine.postOpDayMatches("0-1", day: 0))
        XCTAssertTrue(Engine.postOpDayMatches("3-30", day: 5))
        XCTAssertFalse(Engine.postOpDayMatches("3-30", day: 1))
        XCTAssertFalse(Engine.postOpDayMatches("3-30", day: nil))
        XCTAssertFalse(Engine.postOpDayMatches("3", day: 3))
    }

    func testMaskingContextsSilenceOnlyNegativeFeatures() {
        let steroids = Engine.MaskingContext.active(
            age: 81, sex: .female,
            record: NegationMatcher.Source("Takes prednisolone 15 mg daily for polymyalgia rheumatica."))
        XCTAssertEqual(steroids, [.elderly, .female, .immunosuppressed])
        let none = Engine.MaskingContext.active(age: 40, sex: .male, record: NegationMatcher.Source("No diabetes. Not on steroids."))
        XCTAssertTrue(none.isEmpty, "\(none)")
        XCTAssertTrue(Engine.isMasked(["immunosuppressed", "elderly"], logLR: -5, active: steroids))
        XCTAssertFalse(Engine.isMasked(["immunosuppressed"], logLR: 5, active: steroids), "positive evidence is never masked")
        XCTAssertFalse(Engine.isMasked(["diabetes"], logLR: -5, active: steroids))
        XCTAssertFalse(Engine.isMasked(nil, logLR: -5, active: steroids))
        XCTAssertFalse(Engine.isMasked(["unknown-context"], logLR: -5, active: steroids))
    }

    func testAResultedReportAddsItsDiagnosisToTheList() {
        // Complaint routes to breathlessness / urinary presentations; the CT names the diagnosis.
        var ct = InvestigationEntry(name: "CT abdomen (contrast)", category: .imaging, status: .resulted)
        ct.result = "Acute necrotising pancreatitis with approximately 40% non-enhancement and peripancreatic fluid."
        let results = Engine.infer(chiefComplaint: "Worsening breathing and low urine output on day 3 of admission",
                                   socratesSelections: [:], pmhNotes: nil, surgicalHistory: nil,
                                   examAbdo: nil, examGeneral: nil, investigations: [ct],
                                   ageYears: 64, sex: .male)
        XCTAssertTrue(results.contains { $0.name == "Acute Pancreatitis" }, results.map(\.name).joined(separator: ", "))
        // The history alone does not add it.
        let historyOnly = Engine.infer(chiefComplaint: "Worsening breathing",
                                       socratesSelections: [:], pmhNotes: "Pancreatitis 2019", surgicalHistory: nil,
                                       examAbdo: nil, examGeneral: nil, investigations: [],
                                       ageYears: 64, sex: .male)
        XCTAssertFalse(historyOnly.contains { $0.name == "Acute Pancreatitis" }, historyOnly.map(\.name).joined(separator: ", "))
    }

    func testMeasuredGlucoseOfFourOrMoreIsAChip() {
        var lab = LabPanel()
        lab.glucose = FusedValue(value: 17.8, confidence: 0.85, source: .lab, timestamp: Date())
        let chips = Engine.numericLabChips(lab)
        XCTAssertTrue(chips.contains("glucose not low"))
        XCTAssertTrue(chips.contains("elevated glucose"))
        XCTAssertFalse(chips.contains("hypoglycaemia"))
    }

    // MARK: - Helpers

    private func scored(_ name: String, _ logPosterior: Int, urgency: Int = 0) -> Engine.ScoredCandidate {
        Engine.ScoredCandidate(
            candidate: Engine.Candidate(name: name, icd: "R69", logPrior: 0, urgency: urgency, features: []),
            logPosterior: logPosterior, evidence: [])
    }

    private func infer(_ cc: String, age: Int, sex: Sex, investigations: [InvestigationEntry] = []) -> [Engine.DiagnosisResult] {
        Engine.infer(chiefComplaint: cc, socratesSelections: [:], pmhNotes: nil, surgicalHistory: nil,
                     examAbdo: nil, examGeneral: nil, investigations: investigations,
                     ageYears: age, sex: sex)
    }
}
