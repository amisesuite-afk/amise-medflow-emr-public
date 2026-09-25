// TodayPatientRow.swift
// Today dashboard patient row view.

import SwiftUI
import SwiftData

// MARK: - Today patient row

enum TodayRowStyle { case ward, theatre, endoscopy, clinic }

struct TodayPatientRow: View {
    let patient: Patient
    let style: TodayRowStyle

    /// NEWS2 of the most recent vitals entry: one pass over the vitals and one chart evaluation
    /// (was a full sort, then three separate NEWS2 evaluations, on every row render).
    private var latestNEWS2: News2Snapshot? {
        ListPerf.newest(patient.vitalsEntries.filter(\.isLive), by: { $0.recordedAt }).map { News2Snapshot($0) }
    }

    private var accentColor: Color {
        switch style {
        case .ward:      return patient.setting == .emergency ? .red : .teal
        case .theatre:   return .purple
        case .endoscopy: return .cyan
        case .clinic:    return .orange
        }
    }

    private var subtitleText: String {
        switch style {
        case .ward:
            var parts: [String] = []
            if let w = patient.ward { parts.append(w) }
            if let b = patient.bedNumber { parts.append("Bed \(b)") }
            if let dx = patient.workingDiagnosis { parts.append(dx) }
            else if let cc = patient.chiefComplaint { parts.append(cc) }
            return parts.joined(separator: " · ")
        case .theatre, .endoscopy:
            var parts: [String] = []
            if let t = patient.operationDate {
                parts.append(t.formatted(.dateTime.hour().minute()))
            }
            if let apt = patient.appointmentType { parts.append(apt) }
            else if let dx = patient.workingDiagnosis { parts.append(dx) }
            else if let cc = patient.chiefComplaint { parts.append(cc) }
            if let asa = patient.asaClass {
                let roman = ["I","II","III","IV","V"]
                parts.append("ASA \(roman[max(0, min(asa - 1, 4))])")   // clamp: ASA 0/negative crashed
            }
            return parts.joined(separator: " · ")
        case .clinic:
            var parts: [String] = []
            if let t = patient.operationDate {
                parts.append(t.formatted(.dateTime.hour().minute()))
            }
            if let apt = patient.appointmentType { parts.append(apt) }
            else if let dx = patient.workingDiagnosis { parts.append(dx) }
            else if let cc = patient.chiefComplaint { parts.append(cc) }
            return parts.joined(separator: " · ")
        }
    }

    /// Accessibility text sizes put the NEWS2 / POD badge under the name so the name and subtitle
    /// can wrap instead of truncating; default sizes keep the one-line row.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private var isAccessibilitySize: Bool { dynamicTypeSize.isAccessibilitySize }

    /// One VoiceOver element: name, allergy flags (icon-only on screen), subtitle, NEWS2 / POD.
    private func accessibilitySummary(_ news2: News2Snapshot?) -> String {
        var parts: [String?] = [patient.fullName]
        if patient.hasCriticalAllergy { parts.append("Critical allergy") }
        if patient.hasPenicillinAllergy { parts.append("Penicillin allergy") }
        parts.append(A11yLabel.spoken(subtitleText))
        if style == .ward, let v = news2 {
            parts.append(A11yLabel.news2(score: v.score, risk: v.risk, incomplete: !v.isComplete))
        } else if style == .ward, let days = patient.postOpDays {
            parts.append(A11yLabel.postOpDay(days))
        }
        return A11yLabel.joined(parts)
    }

    // Rows are built lazily; a patient deleted meanwhile must not be read (SwiftData crash).
    var body: some View {
        if patient.isLive { liveBody }
    }

    @ViewBuilder
    private var liveBody: some View {
        let news2 = latestNEWS2
        HStack(spacing: 10) {
            // Accent stripe
            RoundedRectangle(cornerRadius: 2)
                .fill(accentColor)
                .frame(width: 3, height: isAccessibilitySize ? nil : 36)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(patient.fullName)
                        .scaledFont(size: 14, weight: .semibold)
                        .foregroundStyle(.primary)
                    if patient.hasCriticalAllergy {
                        Image(systemName: "exclamationmark.shield.fill")
                            .scaledFont(size: 10)
                            .foregroundStyle(.red)
                    }
                    if patient.hasPenicillinAllergy {
                        Image(systemName: "pills.fill")
                            .scaledFont(size: 10)
                            .foregroundStyle(.orange)
                    }
                }
                Text(subtitleText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(isAccessibilitySize ? 3 : 1)
                if isAccessibilitySize { trailingBadge(news2) }
            }

            Spacer()

            if !isAccessibilitySize { trailingBadge(news2) }

            Image(systemName: "chevron.right")
                .scaledFont(size: 11, weight: .semibold)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(accessibilitySummary(news2)))
    }

    /// NEWS2 badge (ward only) or post-op day.
    @ViewBuilder
    private func trailingBadge(_ news2: News2Snapshot?) -> some View {
        if style == .ward, let v = news2 {
            NEWS2Badge(score: v.score, risk: v.risk, incomplete: !v.isComplete)
        } else if style == .ward, let days = patient.postOpDays {
            Text("POD \(days)")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
                .padding(.horizontal, 5).padding(.vertical, 2)
                .background(Color.secondary.opacity(0.1), in: Capsule())
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        }
    }
}
