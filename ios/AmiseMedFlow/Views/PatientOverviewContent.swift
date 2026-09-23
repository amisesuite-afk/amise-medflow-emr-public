import SwiftUI
import SwiftData
import UIKit

// PatientOverviewContent.swift
// Patient overview content — shared between iPhone and iPad.

// MARK: - Overview content (shared between iPhone overview tab and iPad panel)

struct PatientOverviewContent: View {
    @Bindable var patient: Patient

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    private var latestNote: ClinicalNote? {
        patient.clinicalNotes.sorted { $0.createdAt > $1.createdAt }.first
    }

    private var criticalAllergies: [AllergyEntry] {
        patient.allergies.filter {
            $0.severity.lowercased().contains("anaphylaxis") ||
            $0.severity.lowercased().contains("severe")
        }
    }

    private var news2AlertLevel: Int {
        guard let v = latestVitals, v.hasAnyValue else { return 0 }
        return v.news2Score
    }

    private var criticalLabPanel: LabPanel {
        LabPanel.parse(from: patient.investigations)
    }

    private var criticalLabSummary: String {
        let labs = criticalLabPanel
        let tokens: [String?] = [
            labs.haemoglobin.flatMap { $0.value < 8 ? String(format: "Hb %.1f g/dL", $0.value) : nil },
            labs.platelets.flatMap { $0.value < 50 ? "Plt \(Int($0.value)) ×10⁹/L" : nil },
            labs.creatinine.flatMap { $0.value > 300 ? "Cr \(Int($0.value)) µmol/L" : nil },
            labs.inr.flatMap { $0.value > 2.5 ? String(format: "INR %.1f", $0.value) : nil },
            labs.potassium.flatMap { ($0.value < 2.5 || $0.value > 6.0) ? String(format: "K %.1f mmol/L", $0.value) : nil },
            labs.sodium.flatMap { ($0.value < 120 || $0.value > 155) ? "Na \(Int($0.value)) mmol/L" : nil },
            labs.lactate.flatMap { $0.value >= 4.0 ? String(format: "Lactate %.1f mmol/L", $0.value) : nil },
            labs.calcium.flatMap { ($0.value < 1.75 || $0.value > 3.0) ? String(format: "Ca %.2f mmol/L", $0.value) : nil },
            labs.glucose.flatMap { ($0.value < 3.0 || $0.value > 20.0) ? String(format: "Gluc %.1f mmol/L", $0.value) : nil },
            labs.troponin.flatMap { $0.value > 52 ? String(format: "Trop %.0f ng/L", $0.value) : nil }
        ]
        return tokens.compactMap { $0 }.joined(separator: " · ")
    }

    // MARK: - Clinical checklist

    private struct CheckItem: Identifiable {
        let id: String
        let label: String
        let icon: String
        let done: Bool
    }

    private var checkItems: [CheckItem] {
        var items: [CheckItem] = [
            CheckItem(id: "complaint",     label: "Complaint",    icon: "text.bubble",        done: !(patient.chiefComplaint ?? "").isEmpty),
            CheckItem(id: "diagnosis",     label: "Diagnosis",    icon: "stethoscope",         done: patient.workingDiagnosis != nil),
            CheckItem(id: "allergies",     label: "Allergies",    icon: "exclamationmark.shield", done: !patient.allergies.isEmpty),
            CheckItem(id: "vitals",        label: "Vitals",       icon: "waveform.path.ecg",   done: !patient.vitalsEntries.isEmpty),
            CheckItem(id: "notes",         label: "Note",         icon: "note.text",           done: patient.clinicalNotes.contains { !$0.isEmpty }),
            CheckItem(id: "signed",        label: "Signed",       icon: "checkmark.seal",      done: patient.clinicalNotes.contains { $0.status == .signed }),
            CheckItem(id: "prescriptions", label: "Prescriptions",icon: "pills",               done: !patient.prescriptions.isEmpty),
        ]
        switch patient.setting {
        case .inpatient, .emergency:
            items.append(CheckItem(id: "admission", label: "Admitted", icon: "bed.double",  done: patient.admittedAt != nil))
        case .theatre:
            items.append(CheckItem(id: "opplan",  label: "Op Plan", icon: "scissors",       done: !patient.operativePlans.isEmpty))
            items.append(CheckItem(id: "opdate",  label: "Op Date", icon: "calendar",       done: patient.operationDate != nil))
        case .endoscopy:
            items.append(CheckItem(id: "scopedate", label: "Scope Date", icon: "calendar",  done: patient.operationDate != nil))
        default:
            break
        }
        return items
    }

    @ViewBuilder
    private var checklistRow: some View {
        let pending = checkItems.filter { !$0.done }
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: pending.isEmpty ? "checkmark.circle.fill" : "circle.dotted")
                    .font(.system(size: 11))
                    .foregroundStyle(pending.isEmpty ? .green : .orange)
                Text(pending.isEmpty
                     ? "Chart complete"
                     : "\(pending.count) section\(pending.count == 1 ? "" : "s") pending")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(pending.isEmpty ? .green : .orange)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(checkItems) { item in
                        HStack(spacing: 3) {
                            Image(systemName: item.done ? "checkmark" : "circle")
                                .font(.system(size: 8, weight: .bold))
                            Text(item.label)
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(item.done ? AMColor.accent : .orange)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            (item.done ? AMColor.accent : Color.orange).opacity(0.1),
                            in: Capsule()
                        )
                        .overlay(
                            Capsule()
                                .stroke((item.done ? AMColor.accent : Color.orange).opacity(0.25), lineWidth: 0.5)
                        )
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }

    private func notePreview(_ note: ClinicalNote) -> String? {
        if note.noteType.isStructured {
            return [note.assessment, note.plan]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty })
        }
        return note.freeText.map { String($0.prefix(300)) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
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
                                Text("Score \(news2AlertLevel) — \(latestVitals?.news2Risk ?? "")")
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
                                Text(criticalLabSummary)
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
            let resultedInvs = patient.investigations.filter { $0.status == .resulted && !$0.result.isEmpty }
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
            let pendingInvs = patient.investigations.filter { $0.status == .ordered || $0.status == .pending }
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
            if let v = latestVitals {
                overviewCard(title: "Latest Vitals — \(v.recordedAt.formatted(.relative(presentation: .named)))") {
                    HStack {
                        Spacer()
                        Text("NEWS2 \(v.news2Score) — \(v.news2Risk)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color(hex: v.news2Color))
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
    private func overviewCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).amSectionLabel()
            VStack(alignment: .leading, spacing: 8) {
                content()
            }
            .amCard()
        }
    }
}

