import XCTest
@testable import AmiseMedFlow

/// DiagnosisRadiationEngine used to match its keywords as plain substrings, so the ACS keyword
/// "mi" fired inside "abdominal" and "ischaemia", the PE keyword "pe" inside "suspected" and
/// "penetrating", "tb" inside "TBSA", "aki" inside "taking" and "af" inside "after". Bleeding and
/// trauma diagnoses were shown ACS or PE antithrombotic plans (clinical validation,
/// docs/clinical-validation/findings/soft-tissue-trauma-burns.md, gap 1; confirmed by the iOS
/// `mgmt-no-antithrombotic-plan` results). Keywords now match on word boundaries.
@MainActor
final class DiagnosisRadiationKeywordTests: XCTestCase {

    private func condition(_ dx: String) -> String? {
        DiagnosisRadiationEngine.radiate(workingDiagnosis: dx, ageYears: 60, sex: .male)?.conditionName
    }

    // MARK: - Haemorrhagic and trauma diagnoses get no antithrombotic plan

    func testBleedingAndTraumaDiagnosesDoNotGetACSOrPEPlans() {
        let diagnoses = [
            "Blunt abdominal trauma with haemoperitoneum and haemorrhagic shock (ATLS class III)",
            "Splenic injury with haemoperitoneum — haemodynamically unstable",
            "Splenic laceration AAST grade III (haemodynamically stable)",
            "Penetrating stab wound of abdomen with omental evisceration",
            "Anterior abdominal stab wound, haemodynamically stable",
            "Multiple left rib fractures with haemothorax, supratherapeutic INR and occult shock",
            "Suspected non-accidental injury (bruising in a non-mobile infant)",
            "Acute upper GI bleed",
            "Acute lower GI bleed — haemodynamically unstable",
            "Necrotising fasciitis (suspected)",
            "Superficial vein thrombosis of left great saphenous vein",
        ]
        for dx in diagnoses {
            let name = condition(dx)
            XCTAssertNotEqual(name, "Acute Coronary Syndrome", dx)
            XCTAssertNotEqual(name, "Pulmonary Embolism (PE)", dx)
        }
    }

    func testAorticAndMesentericDiagnosesReachTheirOwnEntry() {
        XCTAssertEqual(condition("Ruptured abdominal aortic aneurysm"), "Abdominal Aortic Aneurysm")
        XCTAssertEqual(condition("Suspected symptomatic (leaking) abdominal aortic aneurysm"), "Abdominal Aortic Aneurysm")
        XCTAssertEqual(condition("Suspected acute mesenteric ischaemia"), "Acute Mesenteric Ischaemia")
    }

    func testShortKeywordsDoNotFireInsideWords() {
        XCTAssertNil(condition("Flame burns 27% TBSA (deep partial and full thickness)"))   // "tb" in "TBSA"
        XCTAssertNil(condition("Head injury in a patient taking apixaban"))                 // "aki" in "taking"
        XCTAssertNil(condition("Musculoskeletal chest wall pain after viral cough"))        // "af" in "after"
        XCTAssertNil(condition("Mirizzi syndrome"))                                          // "mi" in "mirizzi"
    }

    // MARK: - Positive controls

    func testIntendedMatchesStillWork() {
        XCTAssertEqual(condition("Inferior ST-elevation myocardial infarction"), "Acute Coronary Syndrome")
        XCTAssertEqual(condition("Acute MI"), "Acute Coronary Syndrome")
        XCTAssertEqual(condition("Suspected pulmonary embolism (post-operative)"), "Pulmonary Embolism (PE)")
        XCTAssertEqual(condition("Suspected PE"), "Pulmonary Embolism (PE)")
        XCTAssertEqual(condition("New AF with rapid ventricular response"), "Atrial Fibrillation")
        XCTAssertEqual(condition("Pulmonary TB"), "Pulmonary Tuberculosis")
        XCTAssertEqual(condition("AKI stage 2"), "Acute Kidney Injury")
        XCTAssertEqual(condition("Haemorrhoids grade 3"), "Haemorrhoids")   // long keywords may run on
    }

    // MARK: - The matcher itself

    func testKeywordMatches() {
        XCTAssertFalse(DiagnosisRadiationEngine.keywordMatches("mi", in: "abdominal"))
        XCTAssertFalse(DiagnosisRadiationEngine.keywordMatches("mi", in: "ischaemia"))
        XCTAssertFalse(DiagnosisRadiationEngine.keywordMatches("pe", in: "suspected"))
        XCTAssertFalse(DiagnosisRadiationEngine.keywordMatches("pe", in: "penetrating"))
        XCTAssertFalse(DiagnosisRadiationEngine.keywordMatches("cystitis", in: "acute cholecystitis"))
        XCTAssertTrue(DiagnosisRadiationEngine.keywordMatches("mi", in: "inferior mi"))
        XCTAssertTrue(DiagnosisRadiationEngine.keywordMatches("pe", in: "suspected pe (post-op)"))
        XCTAssertTrue(DiagnosisRadiationEngine.keywordMatches("haemorrhoid", in: "haemorrhoids"))
        XCTAssertFalse(DiagnosisRadiationEngine.keywordMatches("", in: "anything"))
    }
}
