// ConsultTool.swift
// The consultation "Tools" menu (UX review: scores, vitals and prescriptions reachable from inside
// the consultation on every pathway). Each tool opens as a sheet over the current step, so the
// clinician keeps their place in the pathway: no leaving the consultation, no lost step.
//
// Pure data (no SwiftUI) so the menu contents can be unit-tested:
// AmiseMedFlowTests/ConsultationSeamlessTests.swift.

import Foundation

enum ConsultTool: String, CaseIterable, Identifiable {
    case scores
    case vitals
    case prescriptions

    var id: String { rawValue }

    /// Menu and sheet title.
    var title: String {
        switch self {
        case .scores:        return "Clinical Scores"
        case .vitals:        return "Vitals"
        case .prescriptions: return "Prescriptions"
        }
    }

    /// SF Symbol for the menu row.
    var systemImage: String {
        switch self {
        case .scores:        return "chart.bar.doc.horizontal"
        case .vitals:        return "waveform.path.ecg"
        case .prescriptions: return "pills.fill"
        }
    }

    /// Accessibility identifier of the menu row (the UI walkthrough taps these).
    var menuIdentifier: String { "consult.tools.\(rawValue)" }

    /// One-line hint under the title in the sheet: the step underneath is kept.
    static let keepsStepHint = "Opens over the current step — close it to carry on where you were."
}
