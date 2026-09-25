// SuspectedCancerScreening+Prompt.swift
// The consultation prompt built from the NG12 screen for one patient. Twin of the web
// `suspectedCancerPrompts` (artifacts/dashboard/src/lib/preventive-screening-prompts.ts):
//   - only the criteria added in cancer-screening 1.1.0 (FIT, IDA, rectal bleeding ≥50, weight
//     loss + abdominal pain ≥40, nipple ≥50, haematuria ≥45); the older chip rules reach the
//     clinician through the triage level / red flags, as on the web;
//   - not shown when the record already states an (unhedged) cancer at that site;
//   - in an emergency encounter no investigations are offered ("arrange once the acute episode
//     is managed");
//   - IDA criteria add the BSG 2021 iron-replacement line (no dose);
//   - a microcytic anaemia without a ferritin gets a ferritin prompt instead.
// A suggestion only: the card (SuspectedCancerSection) adds nothing until the clinician taps.

import Foundation

struct SuspectedCancerPrompt: Equatable {
    enum Kind: Equatable { case suspectedCancer, ferritinCheck }
    let kind: Kind
    /// Stable key for dismissal: the met criterion ids (a new criterion shows the card again).
    let key: String
    let title: String
    let finding: String
    let rationale: String
    /// Investigations the clinician can add (empty in an emergency encounter).
    let investigations: [String]
    /// Plan lines the clinician can add.
    let planLines: [String]
    let twoWeekWait: Bool
}

extension SuspectedCancerScreening {

    /// Screen input from the record: complaint, associated-symptom chips, family history notes,
    /// the clinician's text (HPI, examination, assessment) and resulted labs.
    static func input(for p: Patient) -> CancerScreenInput {
        let symptoms = (p.associatedSymptoms ?? "")
            .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let freeText = NegationMatcher.joinClauses([p.hpi, p.examGeneral, p.examAbdo, p.examSkin, p.examOther, p.assessmentText])
        return CancerScreenInput(
            age: p.dateOfBirth == nil ? nil : p.ageYears,
            sex: p.sex,
            chiefComplaints: [p.chiefComplaint].compactMap { $0 }.filter { !$0.isEmpty },
            symptoms: symptoms,
            familyHistory: [p.familyHistoryNotes].compactMap { $0 }.filter { !$0.isEmpty },
            responses: [:],
            freeText: freeText,
            labs: readLabs(patient: p))
    }

    static func prompt(for p: Patient) -> SuspectedCancerPrompt? {
        guard p.dateOfBirth != nil else { return nil }
        let record = [p.assessmentText, p.workingDiagnosis, p.pmhNotes] + p.pmhEntries.map { Optional($0.condition) }
        return prompt(input: input(for: p), emergency: p.setting == .emergency,
                      record: record.compactMap { $0 }.filter { !$0.isEmpty })
    }

    /// `record`: assessment, working diagnosis and past history, for the known-cancer check.
    static func prompt(input: CancerScreenInput, emergency: Bool, record: [String]) -> SuspectedCancerPrompt? {
        guard let age = input.age else { return nil }
        let result = screen(input)
        let labs = input.labs
        let sex = input.sex
        let met = result.criteria.filter { $0.met && $0.id != nil && !knownCancer(at: $0.site ?? "", record: record) }

        if !met.isEmpty {
            let twoWeek = met.contains { ($0.pathway ?? .twoWeekWait) == .twoWeekWait }
            var seenSite = Set<String>()
            let site = met.flatMap { ($0.site ?? "suspected").components(separatedBy: " / ") }
                .filter { seenSite.insert($0).inserted }.joined(separator: " / ")
            var seenInv = Set<String>()
            let recommended = met.flatMap(\.investigations).filter { seenInv.insert($0).inserted }
            let ida = met.contains { $0.rule.lowercased().contains("iron deficiency") }
            var labBits: [String] = []
            if ida { labBits.append("iron-deficiency anaemia") }
            if let fit = labs.fitUgHbG { labBits.append("FIT \(format(fit)) µg Hb/g") }
            else if labs.fitPositive == true { labBits.append("FIT positive") }
            if let hb = labs.haemoglobinGdl, isAnaemic(hb, sex: sex) { labBits.append("Hb \(format(hb)) g/dL") }
            if let f = labs.ferritinUgL, hasLabIronDeficiencyAnaemia(labs, sex: sex) { labBits.append("ferritin \(format(f)) µg/L") }
            let later = emergency ? " Arrange once the acute episode is managed." : ""
            var plan = [twoWeek
                ? "• Suspected \(site) cancer pathway referral (2-week wait): \(met.map { "\($0.rule) [\($0.guideline)]" }.joined(separator: "; ")).\(later)"
                : "• Urgent bidirectional endoscopy (OGD + colonoscopy) for iron-deficiency anaemia (BSG 2021).\(later)"]
            if ida {
                plan.append("• Iron replacement: oral iron, one tablet daily or on alternate days; IV iron if not tolerated or ineffective (BSG 2021) — prescriber to choose the preparation.")
            }
            return SuspectedCancerPrompt(
                kind: .suspectedCancer,
                key: met.compactMap(\.id).sorted().joined(separator: "+"),
                title: twoWeek ? "2-week-wait referral — \(site)" : "Urgent investigation — \(site)",
                finding: "Suspected cancer referral criteria met: \(site)\(labBits.isEmpty ? "" : " — \(labBits.joined(separator: ", "))")",
                rationale: met.map { "\($0.rule) (\($0.guideline))" }.joined(separator: "; "),
                investigations: emergency ? [] : recommended,
                planLines: plan,
                twoWeekWait: twoWeek)
        }

        // Microcytic anaemia without a ferritin: iron deficiency not yet confirmed (BSG 2021).
        if age >= 18, !emergency, let hb = labs.haemoglobinGdl, isAnaemic(hb, sex: sex),
           let mcv = labs.mcvFl, mcv < 80, labs.ferritinUgL == nil {
            return SuspectedCancerPrompt(
                kind: .ferritinCheck,
                key: "anaemia_ferritin_check",
                title: "Ferritin — confirm or exclude iron deficiency",
                finding: "Microcytic anaemia (Hb \(format(hb)) g/dL, MCV \(format(mcv)) fL) — no ferritin on file",
                rationale: "Microcytic anaemia: serum ferritin confirms iron deficiency (< 45 µg/L, BSG 2021), which in a man or a post-menopausal woman needs bidirectional endoscopy.",
                investigations: ["Ferritin"],
                planLines: [],
                twoWeekWait: false)
        }
        return nil
    }

    // MARK: Known cancer at the site

    private static let siteCancer: [String: String] = [
        "colorectal": #"\b(colorectal|colon|colonic|rectal|rectum|sigmoid|caecal|cecal|bowel) (cancer|carcinoma|adenocarcinoma|malignancy|tumou?r)\b"#,
        "breast": #"\bbreast (cancer|carcinoma|malignancy)\b|\b(dcis|ductal carcinoma|lobular carcinoma)\b"#,
        "urological": #"\b(bladder|urothelial|renal cell|kidney|renal) (cancer|carcinoma|malignancy|tumou?r)\b"#,
    ]
    private static let hedge = #"\b(suspected|suspicion|possible|probable|likely|query|exclude|excluded|rule out|ruled out|risk|screening|family|fhx)\b|\?"#

    /// True when the record states a (not hedged) cancer at this site: "Obstructing sigmoid
    /// cancer" is known; "Suspected colorectal cancer" or "? rectal cancer" is not.
    static func knownCancer(at site: String, record: [String]) -> Bool {
        let key = site.components(separatedBy: " / ").first ?? site
        guard let pattern = siteCancer[key] else { return false }
        let sentences = record.flatMap { $0.components(separatedBy: CharacterSet(charactersIn: ".;!\n")) }
            .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        return sentences.contains { s in
            NegationMatcher.testAffirmed(pattern, s)
                && (try? NSRegularExpression(pattern: hedge, options: [.caseInsensitive]))
                    .map { $0.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)) == nil } ?? true
        }
    }

    private static func format(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }
}
