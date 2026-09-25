import XCTest
@testable import AmiseMedFlow

/// ClinicalAcuityEngine: the triage level is the highest of CC keywords, vital signs, blood
/// pressure, critical labs, ECG, text alarms, recognition rules and the confirmed diagnosis
/// (clinical validation 2026-09: the level used to come from chief-complaint keywords only, so 27
/// of 39 GI emergencies were "routine").
final class ClinicalAcuityEngineTests: XCTestCase {

    private func lab(_ name: String, _ result: String, category: InvestigationEntry.InvCategory = .blood) -> InvestigationEntry {
        var e = InvestigationEntry(name: name, category: category, status: .resulted)
        e.result = result
        e.resultedAt = Date()
        return e
    }

    private func inputs(cc: String = "", hpi: String = "", exam: [String?] = [], age: Int? = 45, sex: Sex = .male,
                        vitals: AcuityVitals? = nil, labs: [InvestigationEntry] = [], pmh: String = "",
                        meds: [String] = [], dx: String? = nil) -> AcuityInputs {
        var i = AcuityInputs()
        i.chiefComplaint = cc
        i.hpi = hpi
        i.examTexts = exam
        i.ageYears = age
        i.ageMonths = age.map { $0 * 12 + 1 }
        i.sex = sex
        i.vitals = vitals
        i.investigations = labs
        i.pmhText = pmh
        i.medications = meds
        i.workingDiagnosis = dx
        i.pregnancy = PregnancyContext.detect(texts: [cc, hpi, pmh], sex: sex, ageYears: age)
        return i
    }

    private func titles(_ a: AcuityAssessment) -> [String] { a.alerts.map(\.title) }

    // MARK: - Max rule

    func testWellPatientWithBenignComplaintStaysRoutine() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Lump in the groin for 6 months",
                                                   vitals: AcuityVitals(heartRate: 72, systolic: 128, diastolic: 78,
                                                                          respiratoryRate: 14, temperatureCelsius: 36.6, spo2: 98)))
        XCTAssertEqual(a.level, .routine, "\(a.reasons.map(\.text))")
    }

    func testVitalSignsRaiseTheLevelWhenTheComplaintIsBland() {
        // "Abdominal pain and collapse" gave routine from keywords alone.
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Abdominal pain and collapse",
                                                   vitals: AcuityVitals(heartRate: 128, systolic: 78, diastolic: 40,
                                                                          respiratoryRate: 26, temperatureCelsius: 36.4, spo2: 95)))
        XCTAssertEqual(a.level, .emergency)
        XCTAssertTrue(titles(a).contains { $0.hasPrefix("Hypotension / shock") })
    }

    func testNEWS2MediumIsUrgent() {
        // RR 22 (2) + HR 115 (2) + T 38.5 (1) = 5 → medium.
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Tummy ache",
                                                   vitals: AcuityVitals(heartRate: 115, systolic: 125, diastolic: 80,
                                                                          respiratoryRate: 22, temperatureCelsius: 38.5, spo2: 97)))
        XCTAssertLessThanOrEqual(a.level, .urgent)
    }

    func testConfirmedDiagnosisRaisesTheLevel() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Tummy pain", dx: "Perforated duodenal ulcer"))
        XCTAssertEqual(a.level, .emergency)
        XCTAssertEqual(ClinicalAcuityEngine.diagnosisLevel("Acute uncomplicated diverticulitis")?.level, .urgent)
        XCTAssertEqual(ClinicalAcuityEngine.diagnosisLevel("Suspected colorectal cancer")?.level, .priority)
    }

    func testPreOperativeAndElectiveDiagnosesDoNotEscalate() {
        XCTAssertNil(ClinicalAcuityEngine.diagnosisLevel("Pre-operative assessment — DES 3 months after NSTEMI"))
        XCTAssertNil(ClinicalAcuityEngine.diagnosisLevel("Recurrent diverticulitis — elective laparoscopic sigmoid colectomy"))
        XCTAssertNil(ClinicalAcuityEngine.diagnosisLevel("Colorectal cancer screening — average risk"))
    }

    func testObstructedHerniaDiagnosisIsAnEmergency() {
        XCTAssertEqual(ClinicalAcuityEngine.diagnosisLevel("Left obturator hernia with small bowel obstruction")?.level, .emergency)
        XCTAssertNil(ClinicalAcuityEngine.diagnosisLevel("Right inguinal hernia, reducible"))
    }

    func testStableIsNotAStabWound() {
        XCTAssertNotEqual(ClinicalAcuityEngine.diagnosisLevel("Stable angina")?.term, "stab wound")
    }

    func testDiagnosisNeverLowersAnEmergencyFromVitals() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Feeling unwell",
                                                   vitals: AcuityVitals(heartRate: 140, systolic: 85, respiratoryRate: 30, spo2: 88),
                                                   dx: "Community-acquired pneumonia (low severity)"))
        XCTAssertEqual(a.level, .emergency)
    }

    // MARK: - Paediatric thresholds

    func testChildUsesAPLSRangesNotNEWS2() {
        // HR 150, RR 30 in a 4-year-old: above APLS ranges → urgent (adult NEWS2 would score 3 + 3).
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Scald to the chest", age: 4,
                                                   vitals: AcuityVitals(heartRate: 150, respiratoryRate: 30,
                                                                          temperatureCelsius: 36.9, spo2: 99)))
        XCTAssertTrue(a.reasons.contains { $0.text.contains("APLS") })
        XCTAssertFalse(a.reasons.contains { $0.text.contains("NEWS2") })
    }

    func testFebrileInfantUnderThreeMonthsIsRedirected() {
        var i = inputs(cc: "Hot and not feeding", age: 0, vitals: AcuityVitals(heartRate: 170, temperatureCelsius: 38.3))
        i.ageMonths = 1
        let a = ClinicalAcuityEngine.assess(i)
        XCTAssertEqual(a.level, .emergency)
        XCTAssertTrue(a.alerts.contains { $0.redirect?.contains("911") == true })
    }

    func testChildrenNeverSeeAdultDoses() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Swollen face and noisy breathing after eating", age: 6,
                                                   vitals: AcuityVitals(heartRate: 150, respiratoryRate: 36, spo2: 91)))
        let anaphylaxis = a.alerts.first { $0.title.hasPrefix("Anaphylaxis") }
        XCTAssertNotNil(anaphylaxis)
        XCTAssertTrue(anaphylaxis?.action.contains("calculate per BNFc") ?? false)
        XCTAssertFalse(anaphylaxis?.action.contains("0.5 mg") ?? true)
    }

    // MARK: - Blood pressure

    func testPregnancySevereHypertensionThresholdIs160Over110() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Headache, 34 weeks pregnant", age: 28, sex: .female,
                                                   vitals: AcuityVitals(heartRate: 90, systolic: 164, diastolic: 110)))
        XCTAssertEqual(a.level, .emergency)
        XCTAssertTrue(titles(a).contains { $0.hasPrefix("Severe hypertension in pregnancy") })
        XCTAssertTrue(a.alerts.contains { $0.summary.contains("OKEU Hospital") })
    }

    func testSevereHypertensionWithoutOrganDamageIsNotAnEmergency() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Pre-operative check for hernia repair",
                                                   vitals: AcuityVitals(heartRate: 78, systolic: 186, diastolic: 104,
                                                                          respiratoryRate: 14, temperatureCelsius: 36.5, spo2: 98)))
        XCTAssertEqual(a.level, .priority)
    }

    // MARK: - Labs and ECG

    func testSevereHyperkalaemiaUsesThirtyMillilitresOfCalciumGluconate() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Weak and tired", labs: [lab("Potassium", "7.2 mmol/L")]))
        XCTAssertEqual(a.level, .emergency)
        let alert = a.alerts.first { $0.title.contains("hyperkalaemia") }
        XCTAssertTrue(alert?.action.contains("30 mL") ?? false)
        XCTAssertFalse(alert?.action.contains("10 mL of 10%") ?? true)
    }

    func testEuglycaemicDKAIsRecognisedFromKetones() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Vomiting after operation", meds: ["Empagliflozin"],
                                                   labs: [lab("Glucose", "8.9 mmol/L"), lab("Blood ketones", "4.9 mmol/L"),
                                                          lab("Venous pH", "7.19")]))
        XCTAssertEqual(a.level, .emergency)
        XCTAssertTrue(titles(a).contains { $0.hasPrefix("Diabetic ketoacidosis (DKA)") })
    }

    func testSTElevationOnTheECGIsAnEmergencyWithRedirect() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Upper abdominal discomfort and nausea",
                                                   labs: [lab("12-lead ECG", "ST elevation in II, III and aVF", category: .imaging)]))
        XCTAssertEqual(a.level, .emergency)
        XCTAssertTrue(a.alerts.contains { $0.title.hasPrefix("STEMI") && $0.redirect != nil })
    }

    func testNegatedECGChangesDoNotEscalate() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Indigestion",
                                                   labs: [lab("ECG", "Sinus rhythm, no ST elevation or depression", category: .imaging)]))
        XCTAssertFalse(titles(a).contains { $0.hasPrefix("STEMI") })
    }

    // MARK: - Sepsis without fever

    func testAfebrileSepsisFromQSOFAAndSource() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Confused and off legs", hpi: "Cloudy urine and new confusion.",
                                                   age: 84, sex: .female,
                                                   vitals: AcuityVitals(heartRate: 108, systolic: 96, respiratoryRate: 24,
                                                                          temperatureCelsius: 36.2, spo2: 95, avpu: .confused)))
        XCTAssertEqual(a.level, .emergency)
        XCTAssertTrue(titles(a).contains { $0.hasPrefix("Possible sepsis") })
    }

    func testNoSepsisAlertWithoutHighRiskFeatures() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Right upper quadrant pain", hpi: "Fever and RUQ pain for a day.",
                                                   vitals: AcuityVitals(heartRate: 92, systolic: 128, diastolic: 80,
                                                                          respiratoryRate: 16, temperatureCelsius: 38.1, spo2: 98)))
        XCTAssertFalse(titles(a).contains { $0.hasPrefix("Possible sepsis") })
    }

    // MARK: - Recognise and redirect

    func testRedirectNamesTheCurrentHospitalsAndNeverVictoria() {
        XCTAssertTrue(EmergencyRedirect.text.contains("911"))
        XCTAssertTrue(EmergencyRedirect.text.contains("OKEU Hospital"))
        XCTAssertTrue(EmergencyRedirect.text.contains("St Jude's Hospital"))
        XCTAssertTrue(EmergencyRedirect.text.contains("Tapion Hospital"))
        XCTAssertFalse(EmergencyRedirect.text.contains("Victoria"))
    }

    func testCaudaEquinaIsRecognised() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Unable to pass urine since this morning",
                                                   hpi: "Hurt her back lifting. Her bottom feels numb when wiping.", sex: .female))
        XCTAssertEqual(a.level, .emergency)
        XCTAssertTrue(titles(a).contains("Suspected cauda equina syndrome"))
    }

    func testPastAnaphylaxisInTheHistoryIsNotCurrentAnaphylaxis() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Pre-operative planning for bowel resection",
                                                   hpi: "Anaphylaxis to penicillin in 2015 (throat swelling and collapse)."))
        // "Anaphylaxis" counts on its own only in the chief complaint; elsewhere it needs current
        // skin or mucosal features with an airway/breathing/circulation problem.
        XCTAssertFalse(titles(a).contains("Anaphylaxis suspected"))
        let current = ClinicalAcuityEngine.assess(inputs(cc: "Swollen lips, rash and difficulty breathing",
                                                         hpi: "Took amoxicillin 20 minutes ago; widespread urticaria, wheezy.",
                                                         vitals: AcuityVitals(heartRate: 128, systolic: 78, respiratoryRate: 28, spo2: 91)))
        XCTAssertTrue(titles(current).contains("Anaphylaxis suspected"))
        XCTAssertTrue(current.alerts.first { $0.title == "Anaphylaxis suspected" }?.action.contains("IM adrenaline") ?? false)
    }

    func testTesticularTorsionIsRecognised() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Sudden pain in the left testicle", age: 15))
        XCTAssertEqual(a.level, .emergency)
        XCTAssertTrue(titles(a).contains("Possible testicular torsion"))
    }

    func testElectricalInjuryNeedsIVFluidsWhateverTheVisibleBurn() {
        let a = ClinicalAcuityEngine.assess(inputs(cc: "Electrical injury at work, high voltage", hpi: "4% TBSA visible burns."))
        let alert = a.alerts.first { $0.title == "Electrical injury" }
        XCTAssertNotNil(alert)
        XCTAssertTrue(alert?.action.contains("regardless of visible TBSA") ?? false)
        XCTAssertEqual(a.level, .emergency)
    }
}
