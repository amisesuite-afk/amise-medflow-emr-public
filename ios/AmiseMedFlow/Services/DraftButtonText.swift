// DraftButtonText.swift
// Labels for the consultation's draft buttons (HPI, Examination, Plan).
//
// AI is disabled on iOS (AIService throws AIError.disabled; no BAA). The buttons were labelled
// "✦ AI Draft …" in purple, but they run deterministic templates (SOAPDraftEngine, fixed exam
// text). While AI is off they say what they do: "Draft from template" (UX review M10). They never
// call AIService.
//
// Pure so it can be unit-tested: AmiseMedFlowTests/ConsultationSeamlessTests.swift.

import Foundation

enum DraftButtonText {
    /// Off in this build. Turning it on needs a BAA, a risk assessment and a real AI path.
    static let aiDraftingEnabled = false

    /// Button title. `section` is only used for the AI wording ("AI Draft Examination").
    static func title(section: String, aiEnabled: Bool = aiDraftingEnabled) -> String {
        aiEnabled ? "AI Draft \(section)" : "Draft from template"
    }

    /// VoiceOver label: says which section the template fills.
    static func accessibilityLabel(section: String, aiEnabled: Bool = aiDraftingEnabled) -> String {
        aiEnabled ? "AI draft \(section.lowercased())" : "Draft \(section.lowercased()) from template"
    }

    static func systemImage(aiEnabled: Bool = aiDraftingEnabled) -> String {
        aiEnabled ? "sparkles" : "doc.text"
    }
}
