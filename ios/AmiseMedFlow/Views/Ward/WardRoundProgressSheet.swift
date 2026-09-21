import SwiftUI
import SwiftData

// MARK: - Ward Round Progress Sheet
//
// Lightweight focused view opened when a surgeon taps a patient during ward rounds.
// Shows acuity, NEWS2, vitals summary, and a SOAPDraftEngine-pre-filled SOAP note.
// Surgeon can edit inline and sign with one tap — no need to open the full EMR.
// "Open Full Record" escapes to PatientDetailView when more depth is needed.

struct WardRoundProgressSheet: View {
    @Bindable var patient: Patient
    let onMarkReviewed: (Patient) -> Void

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var subjective: String = ""
    @State private var objective: String = ""
    @State private var assessment: String = ""
    @State private var plan: String = ""
    @State private var activeField: SOAPField? = .subjective
    @State private var showFullRecord = false
    @State private var showVitals = false
    @State private var signed = false

    enum SOAPField: String, CaseIterable {
        case subjective = "S"
        case objective  = "O"
        case assessment = "A"
        case plan       = "P"

        var label: String { rawValue }
        var fullLabel: String {
            switch self {
            case .subjective: return "Subjective"
            case .objective:  return "Objective"
            case .assessment: return "Assessment"
            case .plan:       return "Plan"
            }
        }
        var icon: String {
            switch self {
            case .subjective: return "person.speech.bubble"
            case .objective:  return "stethoscope"
            case .assessment: return "brain.head.profile"
            case .plan:       return "list.bullet.clipboard"
            }
        }
    }

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    private var acuityColor: Color {
        switch patient.acuity {
        case .emergency: return AMColor.emergency
        case .urgent:    return AMColor.urgentCol
        case .priority:  return AMColor.priorityCol
        case .routine:   return AMColor.routineCol
        }
    }

    private var news2Color: Color {
        guard let v = latestVitals else { return .secondary }
        switch v.news2Score {
        case 0...2:  return .green
        case 3...4:  return .orange
        case 5...6:  return Color(hex: "ea580c")
        default:     return .red
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            List {
                patientHeaderSection
                vitalsSection
                soapSection
                actionsSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Progress Note")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { prefillSOAP() }
            .toolbar { toolbarContent }
            .sheet(isPresented: $showFullRecord) {
                PatientDetailView(patient: patient)
            }
            .sheet(isPresented: $showVitals) {
                VitalsEntryView(patient: patient)
            }
        }
    }

    // MARK: - Patient header

    private var patientHeaderSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    // Avatar circle
                    ZStack {
                        Circle()
                            .fill(acuityColor.opacity(0.15))
                            .frame(width: 48, height: 48)
                        Text(patient.fullName.prefix(1).uppercased())
                            .font(.title2.weight(.bold))
                            .foregroundStyle(acuityColor)
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(patient.fullName)
                                .font(.headline)
                            Spacer()
                            acuityBadge
                        }
                        HStack(spacing: 8) {
                            if patient.ageYears > 0 {
                                Text("\(patient.ageYears)y")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Text(patient.sex.rawValue)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            if let mrn = patient.mrn {
                                Text("MRN \(mrn)")
                                    .font(.caption.monospaced())
                                    .foregroundStyle(AMColor.muted)
                            }
                        }
                        if let ward = patient.ward {
                            let bed = patient.bedNumber.map { " · Bed \($0)" } ?? ""
                            Text("\(ward)\(bed)")
                                .font(.caption)
                                .foregroundStyle(AMColor.muted)
                        }
                    }
                }

                if let dx = patient.workingDiagnosis {
                    HStack(spacing: 6) {
                        Image(systemName: "staroflife.fill")
                            .font(.caption2)
                            .foregroundStyle(AMColor.accent)
                        Text(dx)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                        if let icd = patient.workingDiagnosisICD {
                            Text(icd)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                        }
                    }
                } else if let cc = patient.chiefComplaint {
                    HStack(spacing: 6) {
                        Image(systemName: "questionmark.circle")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(cc)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .italic()
                    }
                }

                // Critical lab / pending investigation alerts
                let labs = LabPanel.parse(from: patient.investigations)
                if labs.hasCriticalValues {
                    HStack(spacing: 6) {
                        Image(systemName: "flask.fill")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.red)
                        Text("Critical lab values — review before rounds")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.red)
                    }
                } else if patient.investigations.contains(where: { $0.status == .resulted && !$0.result.isEmpty }) {
                    let count = patient.investigations.filter { $0.status == .resulted && !$0.result.isEmpty }.count
                    HStack(spacing: 6) {
                        Image(systemName: "flask")
                            .font(.caption2)
                            .foregroundStyle(.teal)
                        Text("\(count) investigation result\(count == 1 ? "" : "s") available")
                            .font(.caption)
                            .foregroundStyle(.teal)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var acuityBadge: some View {
        Text(patient.acuity.label.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.5)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(acuityColor.opacity(0.15))
            .foregroundStyle(acuityColor)
            .clipShape(Capsule())
    }

    // MARK: - Vitals

    @ViewBuilder
    private var vitalsSection: some View {
        if let v = latestVitals, v.hasAnyValue {
            Section {
                VStack(spacing: 8) {
                    HStack {
                        news2Tile(score: v.news2Score, risk: v.news2Risk)
                        Spacer()
                        Button {
                            showVitals = true
                        } label: {
                            Label("Update", systemImage: "plus.circle")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AMColor.accent)
                        }
                        .buttonStyle(.plain)
                    }

                    let grid: [(String, String)] = [
                        v.bpString.map  { ("BP",     $0 + " mmHg") },
                        v.heartRate.map { ("HR",     "\($0) bpm") },
                        v.respiratoryRate.map { ("RR", "\($0)/min") },
                        v.temperatureCelsius.map { ("Temp", String(format: "%.1f°C", $0)) },
                        v.spo2.map { ("SpO₂", "\($0)%") }
                    ].compactMap { $0 }

                    if !grid.isEmpty {
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                            ForEach(grid, id: \.0) { label, value in
                                vitalsChip(label: label, value: value)
                            }
                        }
                    }

                    Text("Recorded \(v.recordedAt.formatted(date: .omitted, time: .shortened))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .padding(.vertical, 4)
            } header: {
                HStack {
                    Text("Observations").amSectionLabel()
                    Spacer()
                    if v.news2HasRedFlag {
                        Label("RED FLAG", systemImage: "exclamationmark.triangle.fill")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(.red)
                    }
                }
            }
        } else {
            Section {
                Button {
                    showVitals = true
                } label: {
                    Label("Record observations", systemImage: "heart.text.square")
                        .foregroundStyle(AMColor.accent)
                }
            } header: {
                Text("Observations").amSectionLabel()
            }
        }
    }

    private func news2Tile(score: Int, risk: String) -> some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(news2Color.opacity(0.15))
                    .frame(width: 44, height: 44)
                Text("\(score)")
                    .font(.title2.weight(.black))
                    .foregroundStyle(news2Color)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("NEWS2")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(risk)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(news2Color)
            }
        }
    }

    private func vitalsChip(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Color.secondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - SOAP note

    private var soapSection: some View {
        Section {
            // Tab selector
            HStack(spacing: 0) {
                ForEach(SOAPField.allCases, id: \.self) { field in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            activeField = field
                        }
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: field.icon)
                                .font(.caption)
                            Text(field.label)
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(activeField == field ? AMColor.accent : Color.clear)
                        .foregroundStyle(activeField == field ? .white : AMColor.muted)
                    }
                    .buttonStyle(.plain)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(AMColor.line, lineWidth: 1)
            )
            .padding(.top, 2)

            if let field = activeField {
                Group {
                    switch field {
                    case .subjective:
                        TextEditor(text: $subjective)
                    case .objective:
                        TextEditor(text: $objective)
                    case .assessment:
                        TextEditor(text: $assessment)
                    case .plan:
                        TextEditor(text: $plan)
                    }
                }
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: 180)
                .scrollContentBackground(.hidden)
                .background(Color.clear)
            }
        } header: {
            HStack {
                Text("Progress note").amSectionLabel()
                Spacer()
                Text(activeField?.fullLabel ?? "")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(AMColor.accent)
            }
        } footer: {
            Text("Pre-filled from clinical data. Review and edit before signing.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Actions

    private var actionsSection: some View {
        Section {
            Button {
                showFullRecord = true
            } label: {
                HStack {
                    Image(systemName: "doc.richtext")
                        .foregroundStyle(AMColor.accent)
                    Text("Open Full Patient Record")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { dismiss() }
                .foregroundStyle(.secondary)
        }
        ToolbarItem(placement: .confirmationAction) {
            Button {
                signAndReview()
            } label: {
                Label("Sign & Reviewed", systemImage: "signature")
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(AMColor.accent)
            .disabled(isNoteEmpty)
        }
    }

    // MARK: - Logic

    private var isNoteEmpty: Bool {
        [subjective, objective, assessment, plan].allSatisfy {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    private func prefillSOAP() {
        let draft = SOAPDraftEngine.draft(patient: patient)
        // Only pre-fill fields that are still empty (don't overwrite any edits)
        if subjective.isEmpty { subjective = draft.s }
        if objective.isEmpty  { objective  = draft.o }
        if assessment.isEmpty { assessment = draft.a }
        if plan.isEmpty       { plan       = draft.p }
    }

    private func signAndReview() {
        let note = ClinicalNote(noteType: .progress, patient: patient)
        note.subjective  = subjective.isEmpty ? nil : subjective
        note.objective   = objective.isEmpty  ? nil : objective
        note.assessment  = assessment.isEmpty ? nil : assessment
        note.plan        = plan.isEmpty       ? nil : plan
        note.status      = .signed
        note.updatedAt   = .now
        note.pendingSync = true
        context.insert(note)
        patient.updatedAt   = .now
        patient.pendingSync = true
        signed = true
        onMarkReviewed(patient)
        dismiss()
    }
}
