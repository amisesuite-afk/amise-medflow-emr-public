// ConsultationView+Banners.swift
// Allergy banner, surgical risk profile, clinical alarms, completeness bar.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Allergy banner

    // MARK: - Surgical risk profile section

    @ViewBuilder
    func riskAlertRow(_ alert: SurgicalRiskAlert) -> some View {
        let bandColor: Color = {
            switch alert.band {
            case .advisory:  .teal
            case .moderate:  .orange
            case .high:      Color(red: 0.85, green: 0.2, blue: 0.1)
            case .critical:  .red
            }
        }()
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: alert.domain.icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(bandColor)
                    .frame(width: 16)
                Text(alert.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.primary)
                Spacer()
                Text(alert.band.label.uppercased())
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(bandColor)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(bandColor.opacity(0.12), in: Capsule())
            }
            Text(alert.detail)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 4) {
                Image(systemName: "arrow.right.circle")
                    .font(.system(size: 10))
                    .foregroundStyle(bandColor)
                Text(alert.action)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }

    var surgicalRiskSection: some View {
        Section {
            ForEach(surgicalRiskAlerts) { alert in
                riskAlertRow(alert)
            }
        } header: {
            HStack(spacing: 6) {
                Image(systemName: "shield.lefthalf.filled.trianglebadge.exclamationmark")
                    .font(.system(size: 11, weight: .semibold))
                Text("Surgical Risk Profile")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(nil)
                Spacer()
                let maxBand = surgicalRiskAlerts.map { $0.band }.max()
                if let top = maxBand {
                    let topColor: Color = {
                        switch top {
                        case .advisory:  .teal
                        case .moderate:  .orange
                        case .high:      Color(red: 0.85, green: 0.2, blue: 0.1)
                        case .critical:  .red
                        }
                    }()
                    Text("\(surgicalRiskAlerts.count) alert\(surgicalRiskAlerts.count == 1 ? "" : "s") · \(top.label)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(topColor)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(topColor.opacity(0.12), in: Capsule())
                }
            }
            .foregroundStyle(.secondary)
        }
    }

    // MARK: - Allergy banner

    var allergyBanner: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("ALLERGY ALERT", systemImage: "exclamationmark.triangle.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
            ForEach(patient.allergies) { a in
                HStack(spacing: 5) {
                    Circle().fill(Color(white: 1, opacity: 0.7)).frame(width: 5, height: 5)
                    Text("\(a.name)  [\(a.severity)]  — \(a.reaction)")
                        .font(.caption2).foregroundStyle(.white)
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { allergyBannerBg }
    }

    // MARK: - Clinical alarm banner

    var allergyBannerBg: Color { Color.red.opacity(0.85) }

    func alarmBannerColor(isEmergency: Bool) -> Color {
        isEmergency ? Color.red.opacity(0.92) : Color.orange.opacity(0.88)
    }

    @ViewBuilder
    func alarmRow(_ alarm: ClinicalTextParser.ClinicalAlarm, isLast: Bool) -> some View {
        let isEmergency = alarm.severity == .emergency
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: alarm.systemImage)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 18)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(alarm.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text(isEmergency ? "EMERGENCY" : "CRITICAL")
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(isEmergency ? .red : .orange)
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(Color.white, in: Capsule())
                }
                Text(alarm.detail)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.9))
                Text(alarm.action)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.75))
                    .padding(.top, 1)
            }
            Spacer()
            Button {
                withAnimation(.easeOut(duration: 0.15)) {
                    _ = dismissedAlarmIds.insert(alarm.id)
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background { alarmBannerColor(isEmergency: isEmergency) }
        if !isLast { Divider().background { Color(white: 1, opacity: 0.3) } }
    }

    func clinicalAlarmBanner(_ alarms: [ClinicalTextParser.ClinicalAlarm]) -> some View {
        VStack(spacing: 0) {
            ForEach(alarms) { alarm in
                alarmRow(alarm, isLast: alarm.id == alarms.last?.id)
            }
        }
        .transition(.move(edge: .top).combined(with: .opacity))
        .animation(.easeInOut(duration: 0.2), value: alarms.count)
    }

    // MARK: - Completeness bar

    func completenessBar(_ progress: PathwayProgress) -> some View {
        let (filled, total, _) = progress
        return HStack(spacing: 10) {
            ProgressView(value: Double(filled), total: Double(total))
                .tint(filled == total ? .green : AMColor.accent)
            Text("\(filled)/\(total)")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(filled == total ? .green : .secondary)
                .monospacedDigit()
            if filled == total {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(.green).font(.caption2)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 7)
        .background(AMColor.bg)
    }


}
