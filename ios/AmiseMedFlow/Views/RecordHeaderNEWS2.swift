// RecordHeaderNEWS2.swift
// NEWS2 in the patient record header (UX review M3): the iPad header had no NEWS2 at all and the
// iPhone header showed it in fixed 9 pt text. One view for both: score, band, the incomplete
// marker when a parameter was not recorded, band colour, readable Dynamic Type size.

import SwiftUI
import SwiftData

struct RecordHeaderNEWS2: View {
    let patient: Patient

    /// Latest vitals entry with any value (same rule as the iPhone header had).
    private var snapshot: News2Snapshot? {
        guard let v = ListPerf.newest(patient.vitalsEntries.filter(\.isLive), by: { $0.recordedAt }),
              v.hasAnyValue else { return nil }
        return News2Snapshot(v)
    }

    var body: some View {
        let n = snapshot
        let text = ConsultationHeader.news2Text(score: n?.score, risk: n?.risk,
                                                incomplete: n.map { !$0.isComplete } ?? false)
        let dotColor: Color = n.map { Color(hex: $0.colorHex) } ?? Color(.tertiaryLabel)
        let textColor: Color = n.map { Color(hex: $0.colorHex) } ?? Color(.secondaryLabel)
        HStack(spacing: 4) {
            Circle().fill(dotColor).frame(width: 7, height: 7)
            Text(text)
                .scaledFont(size: 13, weight: .semibold, relativeTo: .footnote, monospacedDigit: true)
                .foregroundStyle(textColor)
                .lineLimit(1)
        }
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(n.map { A11yLabel.news2(score: $0.score, risk: $0.risk, incomplete: !$0.isComplete) }
                                 ?? "No vitals recorded"))
        .accessibilityIdentifier("patient.header.news2")
    }
}
