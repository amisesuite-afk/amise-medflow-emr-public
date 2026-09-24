import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Clinical Scores follow-up: saved-score name resolution, and the per-run shared patient data
/// the auto-populator uses (must give exactly the same results as the direct helpers).
@MainActor
final class ScoresFollowupTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    // MARK: - Stored score name → ActiveScore

    func testEveryRawValueResolvesToItsScore() {
        for score in ActiveScore.allCases {
            XCTAssertEqual(ActiveScore(storedScoreName: score.rawValue), score, score.rawValue)
        }
    }

    func testEveryScoreHasAnEngineName() {
        let mapped = Set(ActiveScore.bySystemName.values)
        for score in ActiveScore.allCases {
            XCTAssertTrue(mapped.contains(score), "no engine name mapped for \(score.rawValue)")
        }
    }

    func testEngineNameNeverShadowsAnotherScoresRawValue() {
        for (name, score) in ActiveScore.bySystemName {
            if let byRaw = ActiveScore(rawValue: name) {
                XCTAssertEqual(byRaw, score, "\(name) is another score's rawValue")
            }
        }
    }

    func testEngineOutputNamesResolveToTheScoreThatProducedThem() {
        let cases: [(ActiveScore, ClinicalScore)] = [
            (.alvarado,     ClinicalScoringEngine.alvarado(AlvaradoInput())),
            (.tokyoChole,   ClinicalScoringEngine.tokyoCholecystitis(TokyoCholecystitisInput())),
            (.tokyoCholang, ClinicalScoringEngine.tokyoCholangitis(TokyoCholangitisInput())),
            (.ranson,       ClinicalScoringEngine.ranson(RansonInput())),
            (.glasgow,      ClinicalScoringEngine.glasgowPancreatitis(GlasgowPancreatitisInput())),
            (.rockall,      ClinicalScoringEngine.rockall(RockallInput())),
            (.sirs,         ClinicalScoringEngine.sirs(SIRSInput())),
            (.qsofa,        ClinicalScoringEngine.qsofa(QSOFAInput())),
            (.wellsDVT,     ClinicalScoringEngine.wellsDVT(WellsDVTInput())),
            (.wellsPE,      ClinicalScoringEngine.wellsPE(WellsPEInput())),
            (.abcd2,        ClinicalScoringEngine.abcd2(ABCD2Input())),
            (.lrinec,       ClinicalScoringEngine.lrinec(LRINECInput())),
            (.rcri,         ClinicalScoringEngine.rcri(RCRIInput())),
            (.caprini,      ClinicalScoringEngine.caprini(CapriniInput())),
            (.childPugh,    ClinicalScoringEngine.childPugh(ChildPughInput())),
        ]
        for (score, result) in cases {
            XCTAssertEqual(ActiveScore(storedScoreName: result.systemName), score, result.systemName)
        }
    }

    func testUnknownStoredNameResolvesToNil() {
        XCTAssertNil(ActiveScore(storedScoreName: "Not a score"))
        XCTAssertNil(ActiveScore(storedScoreName: ""))
    }

    // MARK: - Snapshot finds saved scores under either stored name

    func testSnapshotFindsSavedScoresStoredUnderEitherName() throws {
        let p = Patient(fullName: "Snapshot Patient")
        context.insert(p)

        let older = ScoreHistoryEntry(scoreName: ActiveScore.alvarado.rawValue, abbreviation: "5/10",
                                      scoreValue: 5, maxScore: 10, riskRaw: "Moderate")
        older.recordedAt = Date(timeIntervalSinceNow: -7200)
        let newer = ScoreHistoryEntry(scoreName: "Alvarado Score", abbreviation: "8/10",
                                      scoreValue: 8, maxScore: 10, riskRaw: "High")
        newer.recordedAt = Date(timeIntervalSinceNow: -60)
        let wells = ScoreHistoryEntry(scoreName: "Wells DVT Score", abbreviation: "2",
                                      scoreValue: 2, maxScore: 9, riskRaw: "Moderate")
        let unknown = ScoreHistoryEntry(scoreName: "Retired Score", abbreviation: "1",
                                        scoreValue: 1, maxScore: 1, riskRaw: "Low")
        for e in [older, newer, wells, unknown] {
            context.insert(e)
            e.patient = p
        }
        try context.save()
        XCTAssertEqual(p.scoreHistory.count, 4)

        let snap = ScoresPatientSnapshot(patient: p)
        XCTAssertEqual(snap.history.count, 4)
        XCTAssertEqual(snap.latest(for: .alvarado)?.abbreviation, "8/10")   // newest wins
        XCTAssertEqual(snap.latest(for: .wellsDVT)?.abbreviation, "2")
        XCTAssertNil(snap.latest(for: .ranson))
        XCTAssertNil(snap.history.first { $0.scoreName == "Retired Score" }?.activeScore)
    }

    // MARK: - Auto-populate shared data gives identical results

    private func richPatient() throws -> Patient {
        let p = Patient(fullName: "Populate Patient", sex: .male, setting: .inpatient)
        p.dateOfBirth = Calendar.current.date(byAdding: .year, value: -71, to: .now)
        p.chiefComplaint = "Epigastric pain radiating to the back"
        p.hpi = "Known alcohol excess. Hypertension, type 2 diabetes on insulin. Prior stroke."
        p.pmhNotes = "Atrial fibrillation on warfarin. CKD stage 3."
        p.workingDiagnosis = "Acute pancreatitis"
        p.assessmentText = "Tachycardic, septic picture"
        p.pmhEntries = [PMHEntry(condition: "Congestive heart failure"),
                        PMHEntry(condition: "Cirrhosis")]
        let day: TimeInterval = 86_400
        p.investigations = [
            InvestigationEntry(name: "WBC", category: .blood, status: .resulted,
                               result: "12.1", resultedAt: Date(timeIntervalSinceNow: -3 * day)),
            InvestigationEntry(name: "White cell count", category: .blood, status: .resulted,
                               result: "18.4 x10^9/L", resultedAt: Date(timeIntervalSinceNow: -day)),
            InvestigationEntry(name: "Creatinine", category: .blood, status: .resulted,
                               result: "2.1 mg/dL", resultedAt: Date(timeIntervalSinceNow: -day)),
            InvestigationEntry(name: "Sodium", category: .blood, status: .resulted,
                               result: "131", resultedAt: Date(timeIntervalSinceNow: -day)),
            InvestigationEntry(name: "Potassium", category: .blood, status: .resulted, result: "5.9"),
            InvestigationEntry(name: "Blood glucose", category: .blood, status: .resulted, result: "14.2"),
            InvestigationEntry(name: "Bilirubin", category: .blood, status: .resulted, result: "45"),
            InvestigationEntry(name: "Albumin", category: .blood, status: .resulted, result: "28"),
            InvestigationEntry(name: "INR", category: .blood, status: .resulted, result: "1.8"),
            InvestigationEntry(name: "Urea", category: .blood, status: .resulted, result: "11"),
            InvestigationEntry(name: "Platelets", category: .blood, status: .ordered),
        ]
        context.insert(p)

        let old = VitalsEntry(patient: p, recordedAt: Date(timeIntervalSinceNow: -2 * day))
        old.heartRate = 80; old.bpSystolic = 130; old.temperatureCelsius = 36.8
        let recent = VitalsEntry(patient: p, recordedAt: Date(timeIntervalSinceNow: -600))
        recent.heartRate = 124; recent.bpSystolic = 88; recent.bpDiastolic = 50
        recent.respiratoryRate = 26; recent.temperatureCelsius = 38.9; recent.spo2 = 91
        recent.weightKg = 82
        context.insert(old)
        context.insert(recent)

        let rx = Prescription(drug: "Warfarin", indication: "Atrial fibrillation")
        context.insert(rx)
        rx.patient = p
        try context.save()
        XCTAssertEqual(p.vitalsEntries.count, 2)
        XCTAssertEqual(p.prescriptions.count, 1)
        return p
    }

    private func pendingDescription(_ fill: ScoreAutoFill) -> [String] {
        fill.pendingFields.map { "\($0.id)|\($0.label)|\($0.source)" }
    }

    private func assertSameWithSharedData<I: Equatable>(
        _ name: String,
        _ populate: (Patient) -> (I, ScoreAutoFill),
        patient: Patient,
        file: StaticString = #filePath, line: UInt = #line
    ) {
        let direct = populate(patient)
        let scope = ScoreAutoPopulateContext.begin(for: patient)
        let shared = populate(patient)
        scope.end()
        XCTAssertEqual(direct.0, shared.0, "\(name): inputs differ", file: file, line: line)
        XCTAssertEqual(direct.1.autoFieldKeys, shared.1.autoFieldKeys,
                       "\(name): auto-filled keys differ", file: file, line: line)
        XCTAssertEqual(pendingDescription(direct.1), pendingDescription(shared.1),
                       "\(name): pending fields differ", file: file, line: line)
        XCTAssertEqual(direct.1.isAttempted, shared.1.isAttempted,
                       "\(name): isAttempted differs", file: file, line: line)
    }

    func testPopulatorsGiveIdenticalResultsWithSharedData() throws {
        let p = try richPatient()
        assertSameWithSharedData("APACHE II", PatientScoreAutoPopulator.apacheII(patient:), patient: p)
        assertSameWithSharedData("Ranson", PatientScoreAutoPopulator.ranson(patient:), patient: p)
        assertSameWithSharedData("Glasgow", PatientScoreAutoPopulator.glasgowPancreatitis(patient:), patient: p)
        assertSameWithSharedData("CHA2DS2-VASc", PatientScoreAutoPopulator.cha2ds2vasc(patient:), patient: p)
        assertSameWithSharedData("HAS-BLED", PatientScoreAutoPopulator.hasBled(patient:), patient: p)
        assertSameWithSharedData("SOFA", PatientScoreAutoPopulator.sofa(patient:), patient: p)
        assertSameWithSharedData("MELD", PatientScoreAutoPopulator.meld(patient:), patient: p)
        assertSameWithSharedData("CURB-65", PatientScoreAutoPopulator.curb65(patient:), patient: p)
        assertSameWithSharedData("Blatchford", PatientScoreAutoPopulator.blatchford(patient:), patient: p)
    }

    func testHelpersGiveIdenticalResultsWithSharedData() throws {
        let p = try richPatient()
        let keywordSets: [[String]] = [["wbc", "white cell"], ["creatinine"], ["sodium", "na+"],
                                       ["platelet"], ["nothing-matches"]]
        let textKeywords: [[String]] = [["diabet"], ["cirrhosis"], ["pancreatitis"], ["absent"]]
        let rxKeywords: [[String]] = [["warfarin"], ["insulin"]]

        let directLabs = keywordSets.map { p.latestLab(named: $0) }
        let directText = textKeywords.map { p.clinicalTextContains($0) }
        let directRx = rxKeywords.map { p.prescriptionsContain($0) }
        let directVitals = p.latestVitals?.id
        let directCreat = p.creatinineUmolL()

        let scope = ScoreAutoPopulateContext.begin(for: p)
        XCTAssertNotNil(ScoreAutoPopulateContext.active(for: p))
        // Twice each: the second call is served from the per-run memo.
        for _ in 0..<2 {
            XCTAssertEqual(keywordSets.map { p.latestLab(named: $0) }, directLabs)
            XCTAssertEqual(textKeywords.map { p.clinicalTextContains($0) }, directText)
            XCTAssertEqual(rxKeywords.map { p.prescriptionsContain($0) }, directRx)
            XCTAssertEqual(p.latestVitals?.id, directVitals)
            XCTAssertEqual(p.creatinineUmolL(), directCreat)
        }
        scope.end()

        XCTAssertEqual(directLabs[0], 18.4)          // newest matching resulted WBC
        XCTAssertNil(directLabs[3])                   // ordered, not resulted
        XCTAssertEqual(directText, [true, true, true, false])
        XCTAssertEqual(directRx, [true, false])
        XCTAssertEqual(p.latestVitals?.heartRate, 124)
    }

    func testSharedDataIsScopedToOnePatientAndRun() throws {
        let p = try richPatient()
        let other = Patient(fullName: "Other Patient")
        context.insert(other)

        XCTAssertNil(ScoreAutoPopulateContext.active(for: p))
        let scope = ScoreAutoPopulateContext.begin(for: p)
        XCTAssertNotNil(ScoreAutoPopulateContext.active(for: p))
        XCTAssertNil(ScoreAutoPopulateContext.active(for: other))
        XCTAssertNil(other.latestLab(named: ["wbc"]))   // reads its own (empty) data
        scope.end()
        XCTAssertNil(ScoreAutoPopulateContext.active(for: p))

        // After the run, edits are seen again (nothing cached outside a scope).
        p.investigations = []
        XCTAssertNil(p.latestLab(named: ["wbc"]))
    }
}
