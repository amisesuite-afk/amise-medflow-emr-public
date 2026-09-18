import SwiftUI

// MARK: - Read-only frozen encounter viewer
//
// Shown as a sheet when the clinician taps a row in the History tab.
// All fields are immutable snapshots taken at the time the encounter was closed.

struct EncounterDetailSheet: View {
    let encounter: Encounter
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                headerSection
                if encounter.chiefComplaint != nil || encounter.hpi != nil {
                    presentingSection
                }
                let socr = encounter.decodedSOCRATES
                if !socr.isEmpty {
                    socratesSection(socr)
                }
                let exams = examRows
                if !exams.isEmpty {
                    examinationSection(exams)
                }
                let invs = encounter.decodedInvestigations
                if !invs.isEmpty {
                    investigationsSection(invs)
                }
                if encounter.workingDiagnosis != nil
                    || encounter.assessmentText != nil
                    || encounter.managementPlan != nil {
                    assessmentSection
                }
                let diff = encounter.decodedBayesianSnapshot
                if !diff.isEmpty {
                    differentialSection(diff)
                }
                if let pmh = encounter.pmhNotes, !pmh.isEmpty {
                    Section("History at Visit") {
                        readRow("Past Medical History", value: pmh)
                        if let psh = encounter.surgicalHistory, !psh.isEmpty {
                            readRow("Surgical History", value: psh)
                        }
                    }
                }
                if let summary = encounter.clinicianSummary, !summary.isEmpty {
                    Section("Clinician Summary") {
                        Text(summary)
                            .font(.body)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Visit Record")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        Section {
            HStack(spacing: 14) {
                Image(systemName: encounter.visitType.icon)
                    .font(.title2)
                    .foregroundStyle(AMColor.accent)
                    .frame(width: 36, height: 36)
                    .background { AMColor.accent.opacity(0.1) }
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 2) {
                    Text(encounter.visitType.rawValue)
                        .font(.headline)
                    Text(encounter.encounterDate.formatted(date: .long, time: .omitted))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                acuityBadge
            }
            .padding(.vertical, 4)

            HStack(spacing: 16) {
                Label(encounter.setting.rawValue, systemImage: "building.2")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Label(encounter.location.rawValue, systemImage: "mappin")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var acuityBadge: some View {
        let (label, color): (String, Color) = switch encounter.acuity {
        case .routine:   ("Routine", .green)
        case .urgent:    ("Urgent", .orange)
        case .emergency: ("Emergency", .red)
        }
        return Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    // MARK: - Presenting Problem

    private var presentingSection: some View {
        Section("Presenting Problem") {
            if let cc = encounter.chiefComplaint {
                readRow("Chief Complaint", value: cc)
            }
            if let hpi = encounter.hpi {
                VStack(alignment: .leading, spacing: 4) {
                    Text("History of Presenting Illness")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(hpi)
                        .font(.body)
                }
                .padding(.vertical, 2)
            }
        }
    }

    // MARK: - SOCRATES

    private func socratesSection(_ socr: [String: [String]]) -> some View {
        let order = ["Site","Onset","Character","Radiation",
                     "Associated","Time","Exacerbating","Severity"]
        let present = order.filter { key in
            !(socr[key]?.isEmpty ?? true)
        }
        return Section("SOCRATES") {
            ForEach(present, id: \.self) { key in
                if let chips = socr[key], !chips.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(key)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(chips.joined(separator: " · "))
                            .font(.subheadline)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    // MARK: - Examination

    private var examRows: [(String, String)] {
        [
            ("General",        encounter.examGeneral),
            ("CVS",            encounter.examCVS),
            ("Respiratory",    encounter.examResp),
            ("Abdomen",        encounter.examAbdo),
            ("Neurological",   encounter.examNeuro),
            ("MSK",            encounter.examMSK),
            ("Skin",           encounter.examSkin),
            ("Other",          encounter.examOther),
        ].compactMap { label, val in
            guard let v = val, !v.isEmpty else { return nil }
            return (label, v)
        }
    }

    private func examinationSection(_ rows: [(String, String)]) -> some View {
        Section("Examination") {
            ForEach(rows, id: \.0) { label, value in
                readRow(label, value: value)
            }
        }
    }

    // MARK: - Investigations

    private func investigationsSection(_ invs: [InvestigationEntry]) -> some View {
        Section("Investigations") {
            ForEach(invs) { inv in
                HStack(spacing: 10) {
                    Image(systemName: inv.category.icon)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 18)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(inv.name)
                            .font(.subheadline)
                        if !inv.result.isEmpty {
                            Text(inv.result)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Text(inv.status.rawValue)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(statusColor(inv.status).opacity(0.15),
                                    in: Capsule())
                        .foregroundStyle(statusColor(inv.status))
                }
            }
        }
    }

    private func statusColor(_ s: InvestigationEntry.InvStatus) -> Color {
        switch s {
        case .suggested: return .secondary
        case .ordered:   return .accentColor
        case .pending:   return .orange
        case .resulted:  return .green
        case .cancelled: return .red
        }
    }

    // MARK: - Assessment & Plan

    private var assessmentSection: some View {
        Section("Assessment & Plan") {
            if let dx = encounter.workingDiagnosis {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Working Diagnosis")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 6) {
                        Text(dx)
                            .font(.subheadline.weight(.medium))
                        if let icd = encounter.workingDiagnosisICD {
                            Text(icd)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.vertical, 2)
            }
            if let assess = encounter.assessmentText, !assess.isEmpty {
                readRow("Assessment", value: assess)
            }
            if let plan = encounter.managementPlan, !plan.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Management Plan")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(plan)
                        .font(.body)
                }
                .padding(.vertical, 2)
            }
        }
    }

    // MARK: - Bayesian Differential

    private func differentialSection(_ snap: [BayesianSnapshotEntry]) -> some View {
        Section("Differential (at Close)") {
            ForEach(snap.prefix(6), id: \.name) { entry in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(entry.name)
                            .font(.subheadline)
                        Spacer()
                        Text("\(entry.probability)%")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(probabilityColor(entry.probability))
                        Text(entry.confidence)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.secondary.opacity(0.15))
                                .frame(height: 4)
                            RoundedRectangle(cornerRadius: 2)
                                .fill(probabilityColor(entry.probability))
                                .frame(width: geo.size.width * CGFloat(entry.probability) / 100,
                                       height: 4)
                        }
                    }
                    .frame(height: 4)
                    if !entry.evidence.isEmpty {
                        Text(entry.evidence.prefix(3).joined(separator: " · "))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private func probabilityColor(_ p: Int) -> Color {
        if p >= 60 { return .accentColor }
        if p >= 35 { return .orange }
        return .secondary
    }

    // MARK: - Helpers

    @ViewBuilder
    private func readRow(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
        }
        .padding(.vertical, 2)
    }
}
