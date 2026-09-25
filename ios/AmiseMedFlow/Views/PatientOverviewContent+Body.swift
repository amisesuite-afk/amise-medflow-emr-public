// PatientOverviewContent+Body.swift
// Main body view and helper sub-view builders for PatientOverviewContent.

import SwiftUI
import SwiftData

extension PatientOverviewContent {

    var body: some View {
        // Never read a deleted record (removed or merged while open).
        if patient.isLive { liveBody }
    }

    private var liveBody: some View {
        // Each derived value once per render (see PatientOverviewContent.swift).
        let latestVitals = self.latestVitals
        let latestNEWS2 = latestVitals.map { News2Snapshot($0) }
        let news2AlertLevel = (latestVitals?.hasAnyValue ?? false) ? (latestNEWS2?.score ?? 0) : 0
        let criticalAllergies = self.criticalAllergies
        let investigations = patient.investigations
        let criticalLabPanel = LabPanel.parse(from: investigations)
        let latestNote = self.latestNote
        return VStack(alignment: .leading, spacing: 20) {
            // Header card — web-style with accent teal
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(AMColor.accent.opacity(0.15))
                        .frame(width: 64, height: 64)
                    Text(patient.initials)
                        .font(.system(size: 24, weight: .heavy))
                        .foregroundStyle(AMColor.accentDk)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(patient.fullName)
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(AMColor.ink)
                    HStack(spacing: 6) {
                        Text(patient.ageDisplay.map { "\(patient.sex.rawValue), \($0)" } ?? patient.sex.rawValue)
                        Text("·")
                        Text(patient.location.rawValue)
                        if let mrn = patient.mrn, !mrn.isEmpty {
                            Text("·")
                            Text("MRN \(mrn)")
                        }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(AMColor.muted)
                    HStack(spacing: 6) {
                        AcuityPip(acuity: patient.acuity)
                        Label(patient.setting.rawValue, systemImage: patient.setting.icon)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(AMColor.accent)
                    }
                    // Contact quick-actions
                    if let phone = patient.phone, !phone.isEmpty {
                        let digits = phone.filter { $0.isNumber || $0 == "+" }
                        if let tel = URL(string: "tel:\(digits)") {
                            Link(destination: tel) {
                                Label(phone, systemImage: "phone.fill")
                                    .font(.system(size: 12))
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                    if let email = patient.email, !email.isEmpty,
                       let mailto = URL(string: "mailto:\(email)") {
                        Link(destination: mailto) {
                            Label(email, systemImage: "envelope.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(AMColor.accent)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AMColor.accentLt.opacity(0.5), in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(AMColor.accent.opacity(0.3), lineWidth: 1)
            )

            // Clinical checklist
            checklistRow

            // Safety banners
            if news2AlertLevel >= 5 || !criticalAllergies.isEmpty || criticalLabPanel.hasCriticalValues {
                VStack(spacing: 8) {
                    if news2AlertLevel >= 5 {
                        HStack(spacing: 8) {
                            Image(systemName: news2AlertLevel >= 7
                                  ? "exclamationmark.triangle.fill"
                                  : "exclamationmark.triangle")
                            VStack(alignment: .leading, spacing: 1) {
                                Text(news2AlertLevel >= 7 ? "HIGH NEWS2 RISK" : "MEDIUM NEWS2 RISK")
                                    .font(.system(size: 11, weight: .heavy))
                                    .tracking(0.5)
                                Text("Score \(news2AlertLevel) — \(latestNEWS2?.riskDisplay ?? "")")
                                    .font(.caption2)
                            }
                            Spacer()
                        }
                        .foregroundStyle(news2AlertLevel >= 7 ? Color.red : Color.orange)
                        .padding(10)
                        .background(
                            (news2AlertLevel >= 7 ? Color.red : Color.orange).opacity(0.1),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(news2AlertLevel >= 7 ? Color.red.opacity(0.4) : Color.orange.opacity(0.4), lineWidth: 1)
                        )
                    }

                    if !criticalAllergies.isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.shield.fill")
                            VStack(alignment: .leading, spacing: 2) {
                                Text("CRITICAL ALLERGY")
                                    .font(.system(size: 11, weight: .heavy))
                                    .tracking(0.5)
                                Text(criticalAllergies.map { "\($0.name) (\($0.severity))" }.joined(separator: " · "))
                                    .font(.caption2)
                                    .lineLimit(2)
                            }
                            Spacer()
                        }
                        .foregroundStyle(Color.red)
                        .padding(10)
                        .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.red.opacity(0.35), lineWidth: 1)
                        )
                    }

                    if criticalLabPanel.hasCriticalValues {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "flask.fill")
                            VStack(alignment: .leading, spacing: 2) {
                                Text("CRITICAL LAB VALUES")
                                    .font(.system(size: 11, weight: .heavy))
                                    .tracking(0.5)
                                Text(criticalLabSummary(criticalLabPanel))
                                    .font(.caption2)
                                    .lineLimit(2)
                            }
                            Spacer()
                        }
                        .foregroundStyle(Color.red)
                        .padding(10)
                        .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.red.opacity(0.35), lineWidth: 1)
                        )
                    }
                }
            }

            // Chief complaint
            if let cc = patient.chiefComplaint {
                overviewCard(title: "Chief Complaint") {
                    Text(cc)
                }
            }

            // Working diagnosis
            if let dx = patient.workingDiagnosis {
                overviewCard(title: "Working Diagnosis") {
                    HStack(spacing: 8) {
                        Image(systemName: "stethoscope").foregroundStyle(.teal)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dx).font(.subheadline.weight(.medium))
                            if let icd = patient.workingDiagnosisICD {
                                Text(icd).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            // Resulted investigations with findings
            let resultedInvs = investigations.filter { $0.status == .resulted && !$0.result.isEmpty }
            if !resultedInvs.isEmpty {
                overviewCard(title: "Investigation Results (\(resultedInvs.count))") {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(resultedInvs.prefix(6), id: \.id) { inv in
                            VStack(alignment: .leading, spacing: 1) {
                                HStack(spacing: 6) {
                                    Image(systemName: inv.category.icon)
                                        .font(.system(size: 10))
                                        .foregroundStyle(.teal)
                                        .frame(width: 14)
                                    Text(inv.name)
                                        .font(.system(size: 13, weight: .medium))
                                }
                                Text(inv.result)
                                    .font(.system(size: 12))
                                    .foregroundStyle(.secondary)
                                    .padding(.leading, 20)
                            }
                        }
                        if resultedInvs.count > 6 {
                            Text("+\(resultedInvs.count - 6) more")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            // Pending investigations
            let pendingInvs = investigations.filter { $0.status == .ordered || $0.status == .pending }
            if !pendingInvs.isEmpty {
                overviewCard(title: "Pending Investigations (\(pendingInvs.count))") {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(pendingInvs.prefix(6), id: \.id) { inv in
                            HStack(spacing: 6) {
                                Image(systemName: inv.category.icon)
                                    .font(.system(size: 10))
                                    .foregroundStyle(.secondary)
                                    .frame(width: 14)
                                Text(inv.name)
                                    .font(.system(size: 13))
                                Spacer()
                                Text(inv.status == .ordered ? "Ordered" : "Pending")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(inv.status == .ordered ? .blue : .orange)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background((inv.status == .ordered ? Color.blue : Color.orange).opacity(0.1), in: Capsule())
                            }
                        }
                        if pendingInvs.count > 6 {
                            Text("+\(pendingInvs.count - 6) more")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            // Admission
            if patient.setting == .inpatient || patient.setting == .emergency {
                overviewCard(title: "Admission") {
                    if let ward = patient.ward {
                        LabeledContent("Ward", value: ward)
                    }
                    if let bed = patient.bedNumber {
                        LabeledContent("Bed", value: bed)
                    }
                    if let admitted = patient.admittedAt {
                        let los = max(0, Calendar.current.dateComponents([.day], from: admitted, to: .now).day ?? 0)
                        LabeledContent("Admitted") {
                            Text(admitted, style: .date) +
                            Text("  (Day \(los + 1))").foregroundColor(.secondary)
                        }
                    }
                    if let exp = patient.expectedDischarge {
                        let daysLeft = Calendar.current.dateComponents([.day], from: .now, to: exp).day ?? 0
                        LabeledContent("Expected d/c") {
                            HStack(spacing: 4) {
                                Text(exp, style: .date)
                                Text(daysLeft <= 1 ? "(today/tomorrow)" : "(\(daysLeft)d)")
                                    .font(.caption2)
                                    .foregroundStyle(daysLeft <= 1 ? .orange : .secondary)
                            }
                        }
                    }
                }
            }

            // Post-operative
            if let days = patient.postOpDays {
                overviewCard(title: "Post-operative") {
                    LabeledContent("Post-op day", value: "POD \(days)")
                    if let op = patient.operationDate {
                        LabeledContent("Operation date") { Text(op, style: .date) }
                    }
                }
            }

            // Latest vitals
            if let v = latestVitals, let n = latestNEWS2 {
                overviewCard(title: "Latest Vitals — \(v.recordedAt.formatted(.relative(presentation: .named)))") {
                    HStack {
                        Spacer()
                        Text("NEWS2 \(n.score) — \(n.riskDisplay)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color(hex: n.colorHex))
                    }
                    if let bp = v.bpString {
                        LabeledContent("BP", value: "\(bp) mmHg")
                    }
                    if let hr = v.heartRate {
                        LabeledContent("HR", value: "\(hr) bpm")
                    }
                    if let temp = v.temperatureCelsius {
                        LabeledContent("Temp", value: String(format: "%.1f °C", temp))
                    }
                    if let spo = v.spo2 {
                        LabeledContent("SpO₂", value: "\(spo)%")
                    }
                    if let wt = v.weightKg {
                        if let bmi = patient.latestBMI(), let cat = patient.bmiCategory {
                            LabeledContent("Weight / BMI") {
                                Text(String(format: "%.1f kg · BMI %.1f (%@)", wt, bmi, cat))
                                    .foregroundStyle(bmi < 18.5 || bmi >= 30 ? .orange : .primary)
                            }
                        } else {
                            LabeledContent("Weight", value: String(format: "%.1f kg", wt))
                        }
                    }
                }
            }

            // Active medications
            if !patient.prescriptions.isEmpty {
                overviewCard(title: "Active Medications (\(patient.prescriptions.count))") {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(patient.prescriptions.prefix(5), id: \.id) { rx in
                            HStack(spacing: 6) {
                                Image(systemName: "pills.fill")
                                    .font(.system(size: 10))
                                    .foregroundStyle(.purple)
                                Text(rx.displayLine)
                                    .font(.system(size: 13))
                                    .lineLimit(1)
                            }
                        }
                        if patient.prescriptions.count > 5 {
                            Text("+\(patient.prescriptions.count - 5) more")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            // Social history snapshot
            if let social = patient.socialHistory, !social.isEmpty {
                overviewCard(title: "Social History") {
                    Text(social)
                        .font(.system(size: 13))
                        .lineLimit(6)
                        .foregroundStyle(.secondary)
                }
            }

            // Latest note
            if let note = latestNote {
                overviewCard(title: "Latest Note — \(note.noteType.label)") {
                    Text(note.createdAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let preview = notePreview(note) {
                        Text(preview).font(.callout).lineLimit(6)
                    }
                }
            }

            // Next of kin contact
            if let nokName = patient.nokName, !nokName.isEmpty {
                overviewCard(title: "Next of Kin") {
                    HStack(spacing: 8) {
                        Image(systemName: "person.2.fill")
                            .foregroundStyle(.secondary)
                            .font(.system(size: 13))
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(nokName)
                                    .font(.system(size: 13, weight: .semibold))
                                if let rel = patient.nokRelation, !rel.isEmpty {
                                    Text("(\(rel))")
                                        .font(.system(size: 12))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if let nokPhone = patient.nokPhone, !nokPhone.isEmpty {
                                let digits = nokPhone.filter { $0.isNumber || $0 == "+" }
                                if let tel = URL(string: "tel:\(digits)") {
                                    Link(destination: tel) {
                                        Label(nokPhone, systemImage: "phone.fill")
                                            .font(.system(size: 12))
                                            .foregroundStyle(.green)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    func overviewCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).amSectionLabel()
            VStack(alignment: .leading, spacing: 8) {
                content()
            }
            .amCard()
        }
    }

}
