// EncounterCompletionReview.swift
// What the "Review and complete" sheet lists before an encounter is completed (UX review M8,
// mirroring the web sign-off dialog): the steps with nothing documented, the allergy status,
// content the app filled in that nobody has edited yet (template examination text, template
// HPI / plan drafts, the patient's own questionnaire answers), and the diagnosis and orders
// that will go into the visit snapshot. The clinician then attests and completes.
//
// Before: a confirmation dialog listed the undocumented steps only, and "Save Visit" versus
// "Complete" was not explained on screen.
//
// Pure (no SwiftUI) so it can be unit-tested: AmiseMedFlowTests/ConsultationSeamlessTests.swift.

import Foundation

// MARK: - Template text the consultation can insert

/// Fixed examination text inserted by "Draft from template" and "All normal". The review sheet
/// flags an exam field that still holds exactly one of these (inserted, never edited).
enum ConsultTemplateText {
    // "All normal" (markAllNormal)
    static let allNormalGeneral = "Alert and oriented. No acute distress."
    static let allNormalCVS     = "Regular rate and rhythm. No murmurs."
    static let allNormalResp    = "Clear to auscultation bilaterally."
    static let allNormalAbdo    = "Soft, non-tender, non-distended. No organomegaly."
    // "Draft from template" (draftExam). No "Afebrile": that needs a recorded temperature.
    static let draftGeneral = "Alert and oriented. No acute distress."
    static let draftCVS     = "Regular rate and rhythm. No murmurs. Peripheral pulses present and equal."
    static let draftResp    = "Clear to auscultation bilaterally. No wheeze or crackles."
    static let draftAbdo    = "Soft, non-distended. Bowel sounds present. No guarding or rigidity."
    /// Text inserted by earlier builds (kept so records drafted before this change are flagged too).
    static let legacyDraftGeneral = "Alert and oriented. No acute distress. Afebrile."

    static let examTemplates: Set<String> = Set([
        allNormalGeneral, allNormalCVS, allNormalResp, allNormalAbdo,
        draftGeneral, draftCVS, draftResp, draftAbdo, legacyDraftGeneral,
    ])

    /// True when `text` is exactly an inserted template (ignoring surrounding whitespace).
    static func isUneditedExamTemplate(_ text: String?) -> Bool {
        guard let t = text?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty else { return false }
        return examTemplates.contains(t)
    }

    /// The pre-consultation questionnaire writes "SITE: …", "ONSET: …" lines (upper case) into the
    /// HPI. Two or more such lines mean the HPI is still the patient's own answers.
    static func isQuestionnaireHPI(_ hpi: String?) -> Bool {
        guard let hpi, !hpi.isEmpty else { return false }
        let keys = ["SITE:", "ONSET:", "CHARACTER:", "RADIATION:", "SEVERITY:", "TIMING:",
                    "WORSE:", "BETTER:", "ASSOCIATED:"]
        let hits = hpi.components(separatedBy: "\n").filter { line in
            let l = line.trimmingCharacters(in: .whitespaces)
            return keys.contains(where: { l.hasPrefix($0) })
        }
        return hits.count >= 2
    }
}

// MARK: - Review model

struct EncounterCompletionReview: Equatable {
    /// Pathway steps with nothing documented ("PMH", "Social" …).
    var missingSteps: [String]
    /// "Allergy: Penicillin (Severe)" / "NKDA (recorded)" / "Allergies not recorded".
    var allergyText: String
    /// Not recorded, or NKDA recorded alongside a real allergy.
    var allergyNeedsAttention: Bool
    /// App-filled content nobody has edited yet.
    var unconfirmed: [String]
    /// "Acute cholecystitis (K81.0)", nil when no working diagnosis.
    var diagnosis: String?
    /// Investigations on the record (name only).
    var investigations: [String]
    /// Prescriptions on the record ("Drug dose").
    var prescriptions: [String]

    /// Nothing to point out (the sheet still asks for the attestation).
    var hasNoGaps: Bool { missingSteps.isEmpty && unconfirmed.isEmpty && !allergyNeedsAttention }

    /// The attestation the clinician ticks before completing.
    static let attestation = "I have reviewed this record, including any template or pre-filled text listed above, and it is accurate for this visit."

    /// What each action does, shown on screen (Save snapshot vs Complete).
    static let actionsExplanation = "Save snapshot keeps a copy of the visit in Visit History and leaves it open. "
        + "Complete asks you to review and attest, then saves the snapshot and closes the visit."

    /// - Parameters:
    ///   - examFields: (label, text) for each examination field.
    ///   - uneditedDrafts: labels of template drafts still exactly as inserted ("HPI", "Plan").
    static func build(missingSteps: [String],
                      allergyState: RecordSafetySummary.AllergyState,
                      allergyConflict: Bool,
                      hpi: String?,
                      examFields: [(label: String, text: String?)],
                      uneditedDrafts: [String],
                      diagnosis: String?,
                      icd: String?,
                      investigations: [String],
                      prescriptions: [String]) -> EncounterCompletionReview {
        var unconfirmed: [String] = []
        if ConsultTemplateText.isQuestionnaireHPI(hpi) {
            unconfirmed.append("HPI: still the patient's questionnaire answers (patient-reported)")
        }
        for label in uneditedDrafts {
            unconfirmed.append("\(label): template draft not edited")
        }
        let templateExam = examFields.filter { ConsultTemplateText.isUneditedExamTemplate($0.text) }.map(\.label)
        if !templateExam.isEmpty {
            unconfirmed.append("Examination: template text not edited (\(templateExam.joined(separator: ", ")))")
        }

        var allergyNeedsAttention = allergyConflict
        if case .notRecorded = allergyState { allergyNeedsAttention = true }
        var allergyText = RecordSafetySummary.allergyText(allergyState)
        if allergyConflict { allergyText += " — NKDA also marked; reconcile" }

        let dx = diagnosis?.trimmingCharacters(in: .whitespacesAndNewlines)
        let code = icd?.trimmingCharacters(in: .whitespacesAndNewlines)
        var diagnosisText: String? = nil
        if let dx, !dx.isEmpty {
            if let code, !code.isEmpty {
                diagnosisText = "\(dx) (\(code))"
            } else {
                diagnosisText = dx
            }
        }

        return EncounterCompletionReview(
            missingSteps: missingSteps,
            allergyText: allergyText,
            allergyNeedsAttention: allergyNeedsAttention,
            unconfirmed: unconfirmed,
            diagnosis: diagnosisText,
            investigations: investigations.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
            prescriptions: prescriptions.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty })
    }
}
