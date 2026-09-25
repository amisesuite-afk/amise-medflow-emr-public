import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Herbs, teas, bush remedies & supplements: catalogue, interaction wiring, stored history
/// (PathwayData.supplements, shared with the dashboard), SOAP line, questionnaire line and the
/// SupplementAlerts prompts. Web twin: artifacts/dashboard/src/lib/__tests__/supplements.test.ts.
@MainActor
final class SupplementTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    private func history(_ names: [(String, String?)]) -> SupplementHistory {
        SupplementHistory(status: .taking,
                          entries: names.enumerated().map { SupplementEntry(id: "e\($0.offset)", catalogueId: $0.element.1, name: $0.element.0) },
                          askedAt: nil)
    }

    // MARK: - Catalogue

    func testEveryItemHasConcernSourceAndADefinedTerm() {
        var seen = Set<String>()
        for item in SupplementCatalogue.items {
            XCTAssertFalse(seen.contains(item.id), item.id)
            seen.insert(item.id)
            XCTAssertFalse(item.concern.isEmpty, item.id)
            XCTAssertFalse(item.source.isEmpty, item.id)
            if item.term.isEmpty {
                XCTAssertFalse(item.names.isEmpty, item.id)
            } else {
                XCTAssertNotNil(DrugClasses.terms[item.term], item.id)
                XCTAssertTrue(DrugInteractionService.rules.contains { $0.drug1Pattern == item.term || $0.drug2Pattern == item.term }, item.id)
            }
        }
    }

    func testBriefingStopTimes() {
        XCTAssertEqual(SupplementCatalogue.item(id: "garlic")?.stopTime, "at least 7 days; many advise 2 weeks")
        XCTAssertEqual(SupplementCatalogue.item(id: "ginkgo")?.stopTime, "at least 36 hours; SPAQI advises 2 weeks")
        XCTAssertEqual(SupplementCatalogue.item(id: "st_johns_wort")?.stopTime, "at least 5 days")
        XCTAssertEqual(SupplementCatalogue.item(id: "kava")?.stopTime, "24 hours")
        XCTAssertEqual(SupplementCatalogue.item(id: "ephedra")?.stopTime, "at least 24 hours; ideally avoid entirely")
        XCTAssertEqual(SupplementCatalogue.item(id: "bush_tea")?.stopTime,
                       "identify the plant; stop non-essential herbal products 1–2 weeks before elective surgery (ASA / SPAQI) — clinician to confirm")
    }

    func testMatchingIsWholeWordAndHasNoCaribbeanPlantItems() {
        XCTAssertEqual(SupplementCatalogue.match("Garlic 1000 mg").map(\.id), ["garlic"])
        XCTAssertEqual(SupplementCatalogue.match("St John's wort").map(\.id), ["st_johns_wort"])
        XCTAssertEqual(SupplementCatalogue.match("Curcumin with piperine").map(\.id), ["turmeric"])
        XCTAssertEqual(SupplementCatalogue.match("ephedrine 6 mg IV").map(\.id), [])
        for plant in ["cerasee", "soursop", "noni", "moringa", "sorrel", "fever grass"] {
            XCTAssertEqual(SupplementCatalogue.match(plant).map(\.id), [], plant)
        }
        XCTAssertEqual(SupplementCatalogue.match("bush tea").map(\.id), ["bush_tea"])
    }

    func testPerioperativeAlertTextMatchesTheWeb() {
        XCTAssertEqual(SupplementCatalogue.perioperativeAlertText(SupplementCatalogue.item(id: "garlic")!),
                       "Supplement: Garlic (supplement) — Platelet inhibition; the strongest link to surgical bleeding, especially with anticoagulants. Commonly cited stop time: at least 7 days; many advise 2 weeks before elective surgery (Ang-Lee MK et al. JAMA 2001;286:208-16; Proc (Bayl Univ Med Cent) 2022).")
        XCTAssertFalse(SupplementCatalogue.perioperativeAlertText(SupplementCatalogue.item(id: "spermidine")!).contains("stop time"))
    }

    // MARK: - Interactions

    func testRecordedSupplementsAreScreenedLikeDrugs() {
        let h = history([("Garlic (supplement)", "garlic"), ("St John's wort", "st_johns_wort")])
        let alerts = DrugInteractionService.check(drugs: ["Warfarin 5 mg", "Sertraline 50 mg"] + h.interactionEntries)
        XCTAssertTrue(alerts.contains { $0.pairDisplay.lowercased().contains("garlic") && $0.interaction.severity == .major })
        XCTAssertTrue(alerts.contains { $0.pairDisplay.contains("Sertraline") && $0.interaction.clinicalEffect == "Serotonin syndrome risk" })
        XCTAssertEqual(DrugInteractionService.check(drugs: ["Phenelzine 15 mg", "Ma huang"]).first?.interaction.severity, .contraindicated)
        XCTAssertEqual(DrugInteractionService.check(drugs: ["Gliclazide 80 mg", "Ginseng"]).first?.interaction.clinicalEffect,
                       "Hypoglycaemia risk, especially in fasting patients (pre-op fast or religious fast)")
        XCTAssertTrue(DrugInteractionService.check(drugs: ["Warfarin", "Spermidine", "cerasee tea"]).isEmpty)
    }

    func testFreeTextEntryWithCatalogueIdKeepsItsTerm() {
        let h = history([("the garden tea my aunt makes", "garlic")])
        XCTAssertEqual(h.interactionEntries, ["the garden tea my aunt makes (Garlic (supplement))"])
        XCTAssertEqual(DrugInteractionService.check(drugs: ["Warfarin"] + h.interactionEntries).count, 1)
    }

    // MARK: - Stored history

    func testNoteLine() {
        XCTAssertEqual(SupplementHistory().noteLine, "Supplements: not asked.")
        XCTAssertEqual(SupplementHistory(status: .noneReported).noteLine, "Supplements: none reported.")
        var h = history([("Garlic (supplement)", "garlic")])
        h.entries[0].details = "1 capsule daily"
        XCTAssertEqual(h.noteLine, "Supplements: Garlic (supplement) (1 capsule daily).")
    }

    func testDecodesTheWebShapeTolerantly() throws {
        let json = """
        {"burns":{},"supplements":{"status":"not_asked","askedAt":"2026-09-25T14:00:00Z",
         "entries":[{"id":"a1","catalogueId":"garlic","name":"Garlic","details":""},{"name":""},
                    {"id":"b2","catalogueId":"not-real","name":"Cerasee"}]}}
        """
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        let data = try decoder.decode(PathwayData.self, from: Data(json.utf8))
        XCTAssertEqual(data.supplements.status, .taking)
        XCTAssertEqual(data.supplements.entries.map(\.name), ["Garlic", "Cerasee"])
        XCTAssertEqual(data.supplements.entries.map(\.catalogueId), ["garlic", nil])
        XCTAssertNotNil(data.supplements.askedAt)
        // A web-written date with milliseconds must not blank the entries.
        let ms = #"{"supplements":{"status":"none","askedAt":"2026-09-25T14:00:00.123Z","entries":[]}}"#
        XCTAssertEqual(try decoder.decode(PathwayData.self, from: Data(ms.utf8)).supplements.status, .noneReported)
        // Old JSON without the key.
        XCTAssertEqual(try decoder.decode(PathwayData.self, from: Data("{}".utf8)).supplements, SupplementHistory())
    }

    func testPatientRoundTripAndQuestionnaireLine() {
        let p = Patient(fullName: "Supplement Test", sex: .female)
        context.insert(p)
        p.supplementHistory = history([("Kava", "kava")])
        XCTAssertEqual(p.supplementHistory.entries.map(\.catalogueId), ["kava"])
        XCTAssertTrue(p.pendingSync)

        var answers = EncounterAnswers()
        answers.supplementAnswer = .yes
        answers.supplements = "garlic tablets, cerasee tea"
        XCTAssertEqual(answers.supplementsLine, "SUPPLEMENTS (PATIENT-REPORTED): garlic tablets, cerasee tea")
        answers.supplementAnswer = .no
        XCTAssertEqual(answers.supplementsLine, "SUPPLEMENTS (PATIENT-REPORTED): none")
        answers.supplementAnswer = .notAnswered
        XCTAssertNil(answers.supplementsLine)

        p.pmhNotes = "CONDITIONS: Hypertension\nSUPPLEMENTS (PATIENT-REPORTED): turmeric capsules"
        XCTAssertEqual(p.patientReportedSupplements, "turmeric capsules")
        XCTAssertTrue(SupplementHistory.questionnaireValueNamesProducts("turmeric capsules"))
        XCTAssertFalse(SupplementHistory.questionnaireValueNamesProducts("none"))
    }

    func testSOAPDraftStatesSupplements() {
        let p = Patient(fullName: "SOAP Supplements")
        context.insert(p)
        XCTAssertTrue(SOAPDraftEngine.draft(patient: p).s.contains("Supplements: not asked."))
        p.supplementHistory = SupplementHistory(status: .noneReported)
        XCTAssertTrue(SOAPDraftEngine.draft(patient: p).s.contains("Supplements: none reported."))
    }

    // MARK: - Prompts (same ids, wording and thresholds as the web supplement-prompts.ts)

    private func ids(_ i: SupplementAlerts.Inputs) -> [String] { SupplementAlerts.prompts(i).map(\.id) }

    func testNotAskedOnlyBeforeAProcedure() {
        var i = SupplementAlerts.Inputs()
        i.preOp = true
        XCTAssertEqual(ids(i), ["not_asked"])
        i.preOp = false
        XCTAssertEqual(ids(i), [])
        i.preOp = true
        i.history = SupplementHistory(status: .noneReported)
        XCTAssertEqual(ids(i), [])
    }

    func testPerioperativeAlertAndAshwagandha() {
        var i = SupplementAlerts.Inputs()
        i.preOp = true
        i.history = history([("Ginkgo", "ginkgo")])
        let p = SupplementAlerts.prompts(i)
        XCTAssertEqual(p.map(\.id), ["periop_ginkgo"])
        XCTAssertEqual(p.first?.level, .moderate)

        var a = SupplementAlerts.Inputs()
        a.history = history([("Ashwagandha", "ashwagandha")])
        a.conditionsText = "Hypothyroidism"
        XCTAssertTrue(ids(a).contains("ashwagandha_avoid"))
        a.conditionsText = "No thyroid disease"
        XCTAssertFalse(ids(a).contains("ashwagandha_avoid"))
        a.pregnant = true
        XCTAssertTrue(ids(a).contains("ashwagandha_avoid"))
    }

    func testAskAboutPrompts() {
        var liver = SupplementAlerts.Inputs()
        liver.alt = 240
        XCTAssertTrue(ids(liver).contains("liver"))
        liver.alt = 90
        XCTAssertFalse(ids(liver).contains("liver"))

        var lead = SupplementAlerts.Inputs()
        lead.haemoglobin = 9.1
        lead.clinicalText = "Colicky abdominal pain"
        XCTAssertTrue(ids(lead).contains("lead"))
        XCTAssertTrue(SupplementAlerts.leadIsRaised(value: 12, resultText: "12 µg/dL"))
        XCTAssertFalse(SupplementAlerts.leadIsRaised(value: 8, resultText: "8"))
        XCTAssertTrue(SupplementAlerts.isAnaemic(125, sex: .male))

        var aa = SupplementAlerts.Inputs()
        aa.clinicalText = "Rapidly progressive renal failure"
        let p = SupplementAlerts.prompts(aa).first { $0.id == "aristolochic" }
        XCTAssertTrue(p?.detail.contains("slimming pills and Chinese herbal weight-loss products") ?? false)

        var detox = SupplementAlerts.Inputs()
        detox.potassium = 3.1
        XCTAssertTrue(ids(detox).contains("detox"))

        var drip = SupplementAlerts.Inputs()
        drip.temperatureC = 38.4
        XCTAssertTrue(ids(drip).contains("iv_drip"))
        drip.temperatureC = 36.8
        drip.clinicalText = "Afebrile"
        XCTAssertFalse(ids(drip).contains("iv_drip"))
    }

    func testRiskSnapshotShowsTheMandatoryQuestionForAProcedure() {
        let p = Patient(fullName: "Risk Supplements")
        context.insert(p)
        let titles = VisitRiskAssessment.assess(p, pathway: .procedure).map(\.title)
        XCTAssertTrue(titles.contains("Herbs, teas, bush remedies & supplements not asked"), "\(titles)")
    }
}
