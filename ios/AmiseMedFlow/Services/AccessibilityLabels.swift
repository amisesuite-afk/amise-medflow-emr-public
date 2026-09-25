import Foundation

// AccessibilityLabels.swift
// Spoken VoiceOver text for the clinical badges and rows on the busiest screens (patient list,
// Today, ward round, vitals, scores, prescriptions). A badge must read its meaning, not only its
// number or colour: "NEWS2 7, high risk", never "7". Pure string formatting, no SwiftUI, so the
// wording is unit tested (AmiseMedFlowTests/AccessibilityLabelTests.swift).

enum A11yLabel {

    // MARK: NEWS2

    /// "NEWS2 7, high risk"; with `incomplete`, adds that some observations were not recorded
    /// (missing ones count as 0); with a trend, adds "rising by 2" / "falling by 1" / "unchanged".
    /// `risk` is `NEWS2Band.label` ("Low", "Low-medium", "Medium", "High").
    static func news2(score: Int, risk: String, incomplete: Bool = false, trendDelta: Int? = nil) -> String {
        var parts = ["NEWS2 \(score)", "\(risk.lowercased()) risk"]
        if incomplete { parts.append("incomplete: some observations not recorded") }
        if let trend = news2Trend(trendDelta) { parts.append(trend) }
        return parts.joined(separator: ", ")
    }

    /// Spoken NEWS2 trend between the two most recent scored entries (`ListPerf.news2TrendDelta`):
    /// nil when there is no trend.
    static func news2Trend(_ delta: Int?) -> String? {
        guard let delta else { return nil }
        if delta > 0 { return "rising by \(delta)" }
        if delta < 0 { return "falling by \(-delta)" }
        return "unchanged"
    }

    // MARK: Acuity / severity

    /// "Urgent acuity" (`Acuity.label`).
    static func acuity(_ label: String) -> String { "\(label) acuity" }

    // MARK: Demographics

    /// "Female, 54 years" / "54 years" / "Male" / nil. `sex` is `Sex.rawValue`; "Unspecified" is
    /// not read. `ageYears` is nil when the date of birth is missing or implausible.
    static func sexAndAge(sex: String?, ageYears: Int?) -> String? {
        var parts: [String] = []
        if let sex, !sex.isEmpty, sex != "Unspecified" { parts.append(sex) }
        if let ageYears { parts.append(ageYears == 1 ? "1 year" : "\(ageYears) years") }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    // MARK: Composition

    /// Joins the non-empty parts with ", " (the pause VoiceOver makes between facts in a row).
    static func joined(_ parts: [String?]) -> String {
        parts.compactMap { part -> String? in
            guard let p = part?.trimmingCharacters(in: .whitespacesAndNewlines), !p.isEmpty else { return nil }
            return p
        }
        .joined(separator: ", ")
    }

    /// On-screen summary text made speakable: the " · " separators become pauses (", ") so
    /// VoiceOver does not read "dot" between facts.
    static func spoken(_ displayText: String) -> String {
        displayText.replacingOccurrences(of: " · ", with: ", ")
    }

    /// "Post-op day 3".
    static func postOpDay(_ days: Int) -> String { "Post-op day \(days)" }

    /// A numeric stepper value with its unit, e.g. "3 points", "1 point".
    static func count(_ n: Int, singular: String, plural: String) -> String {
        "\(n) \(n == 1 ? singular : plural)"
    }
}
