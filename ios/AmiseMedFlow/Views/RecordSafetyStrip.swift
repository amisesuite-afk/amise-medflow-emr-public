// RecordSafetyStrip.swift
// Header safety strip for the patient record (UX review M3), iPad and iPhone:
//   NEWS2 score + band colour + how long ago · the allergy summary (all allergies, or NKDA, or
//   "not recorded") · the antithrombotic the patient is on.
// Text styles no smaller than footnote, so it grows with Dynamic Type. Wraps onto a second line
// rather than truncating when the row does not fit.

import SwiftUI
import SwiftData

struct RecordSafetyStrip: View {
    let patient: Patient
    /// The iPhone navigation bar already shows NEWS2 under the name; the strip can leave it out.
    var showsNEWS2: Bool = true

    private var latestVitals: VitalsEntry? {
        guard let v = ListPerf.newest(patient.vitalsEntries.filter(\.isLive), by: { $0.recordedAt }),
              v.hasAnyValue else { return nil }
        return v
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 10) { items }
            VStack(alignment: .leading, spacing: 4) { items }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("patient.header.safety")
    }

    @ViewBuilder
    private var items: some View {
        if showsNEWS2 {
            HStack(spacing: 4) {
                RecordHeaderNEWS2(patient: patient)
                if let v = latestVitals {
                    Text(RecordSafetySummary.vitalsAge(recordedAt: v.recordedAt))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .fixedSize()
                        .accessibilityLabel("Vitals taken \(RecordSafetySummary.vitalsAge(recordedAt: v.recordedAt))")
                }
            }
        }
        allergyItem
        if let anti = patient.safetyAntithromboticText {
            Label(anti, systemImage: "drop.fill")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.purple)
                .lineLimit(2)
                .accessibilityIdentifier("patient.header.antithrombotic")
        }
    }

    @ViewBuilder
    private var allergyItem: some View {
        let state = patient.safetyAllergyState
        let text = RecordSafetySummary.allergyText(state)
        switch state {
        case .allergies:
            Label(text, systemImage: "exclamationmark.shield.fill")
                .font(.footnote.weight(.bold))
                .foregroundStyle(.red)
                .lineLimit(2)
                .accessibilityIdentifier("patient.header.allergies")
        case .noKnownAllergies:
            Label(text, systemImage: "checkmark.shield")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .accessibilityIdentifier("patient.header.allergies")
        case .notRecorded:
            Label(text, systemImage: "questionmark.diamond")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.orange)
                .lineLimit(1)
                .accessibilityIdentifier("patient.header.allergies")
        }
    }
}
