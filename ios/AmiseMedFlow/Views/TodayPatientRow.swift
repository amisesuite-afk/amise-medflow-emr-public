// TodayPatientRow.swift
// Today dashboard patient row view.

import SwiftUI
import SwiftData

// MARK: - Today patient row

enum TodayRowStyle { case ward, theatre, endoscopy, clinic }

struct TodayPatientRow: View {
    let patient: Patient
    let style: TodayRowStyle

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
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
                parts.append("ASA \(roman[min(asa-1, 4)])")
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

    // Rows are built lazily; a patient deleted meanwhile must not be read (SwiftData crash).
    var body: some View {
        if patient.isLive { liveBody }
    }

    @ViewBuilder
    private var liveBody: some View {
        HStack(spacing: 10) {
            // Accent stripe
            RoundedRectangle(cornerRadius: 2)
                .fill(accentColor)
                .frame(width: 3, height: 36)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(patient.fullName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.primary)
                    if patient.hasCriticalAllergy {
                        Image(systemName: "exclamationmark.shield.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.red)
                    }
                    if patient.hasPenicillinAllergy {
                        Image(systemName: "pills.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.orange)
                    }
                }
                Text(subtitleText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // NEWS2 badge (ward only) or post-op day
            if style == .ward, let v = latestVitals {
                NEWS2Badge(score: v.news2Score, risk: v.news2Risk)
            } else if style == .ward, let days = patient.postOpDays {
                Text("POD \(days)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.1), in: Capsule())
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}
