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

    @Environment(\.modelContext) var context
    @Environment(\.dismiss) var dismiss

    @State var subjective: String = ""
    @State var objective: String = ""
    @State var assessment: String = ""
    @State var plan: String = ""
    @State var activeField: SOAPField? = .subjective
    @State var showFullRecord = false
    @State var showVitals = false
    @State var signed = false
    @State var showStorageBlocked = false
    /// Latest vitals and investigation flags as plain values. Every keystroke in the SOAP editors
    /// re-renders this sheet; body used to re-sort all vitals 3-4 times, re-run the NEWS2 chart
    /// for each NEWS2 value and decode the investigations JSON three times on each of them.
    @State private var facts = WardProgressFacts()

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

    private var acuityColor: Color {
        switch patient.acuity {
        case .emergency: return AMColor.emergency
        case .urgent:    return AMColor.urgentCol
        case .priority:  return AMColor.priorityCol
        case .routine:   return AMColor.routineCol
        }
    }

    private var news2Color: Color {
        guard let v = facts.latestVitals else { return .secondary }
        switch v.news2.score {
        case 0...2:  return .green
        case 3...4:  return .orange
        case 5...6:  return Color(hex: "ea580c")
        default:     return .red
        }
    }

    // MARK: - Body

    /// Cheap change signal for `facts`: local edits bump updatedAt, sync stamps syncedAt, a new
    /// vitals entry changes the count, and any investigation change changes the JSON.
    private var factsKey: WardProgressFactsKey {
        WardProgressFactsKey(updatedAt: patient.updatedAt,
                             syncedAt: patient.syncedAt,
                             vitalsCount: patient.vitalsEntries.count,
                             investigationsJson: patient.investigationsJson)
    }

    private func refreshFacts() {
        guard patient.isLive else { return }
        let fresh = WardProgressFacts(patient: patient)
        if fresh != facts { facts = fresh }
    }

    var body: some View {
        // Reading a deleted model's attributes crashes SwiftData (removed or merged by sync or
        // duplicate clean-up while this sheet was open).
        if patient.isLive {
            liveBody
        } else {
            NavigationStack {
                ContentUnavailableView(
                    "Record no longer available",
                    systemImage: "person.crop.circle.badge.xmark",
                    description: Text("This patient record was removed or merged.")
                )
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { dismiss() }
                    }
                }
            }
        }
    }

    private var liveBody: some View {
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
            .onAppear {
                CrashReporting.breadcrumb("Opened ward round progress note", category: "ward")
                refreshFacts()
                prefillSOAP()
            }
            .onChange(of: factsKey) { _, _ in refreshFacts() }
            .toolbar { toolbarContent }
            .patientRecordPresentation(item: Binding(
                get: { showFullRecord ? patient : nil },
                set: { if $0 == nil { showFullRecord = false } }))
            .sheet(isPresented: $showVitals, onDismiss: refreshFacts) {
                VitalsEntryView(patient: patient)
                    .pageSizedSheet()
            }
            .storeWriteBlockedAlert(isPresented: $showStorageBlocked)
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
                if facts.hasCriticalLabs {
                    HStack(spacing: 6) {
                        Image(systemName: "flask.fill")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.red)
                        Text("Critical lab values — review before rounds")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.red)
                    }
                } else if facts.resultedCount > 0 {
                    let count = facts.resultedCount
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
            .background { acuityColor.opacity(0.15) }
            .foregroundStyle(acuityColor)
            .clipShape(Capsule())
    }

    // MARK: - Vitals

    @ViewBuilder
    private var vitalsSection: some View {
        if let v = facts.latestVitals {
            Section {
                VStack(spacing: 8) {
                    HStack {
                        news2Tile(score: v.news2.score, risk: v.news2.riskDisplay)
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

                    let grid = v.chips

                    if !grid.isEmpty {
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                            ForEach(grid, id: \.label) { chip in
                                vitalsChip(label: chip.label, value: chip.value)
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
                    if v.news2.hasRedFlag {
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
        .background { Color.secondary.opacity(0.08) }
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

}

// MARK: - Snapshot of what the sheet shows from vitals and investigations

/// Change signal for `WardProgressFacts` (see `WardRoundProgressSheet.factsKey`).
struct WardProgressFactsKey: Equatable {
    let updatedAt: Date
    let syncedAt: Date?
    let vitalsCount: Int
    let investigationsJson: String?
}

/// Latest vitals and investigation flags for the progress sheet, as plain values.
struct WardProgressFacts: Equatable {
    struct Chip: Equatable {
        let label: String
        let value: String
    }

    struct LatestVitals: Equatable {
        let news2: News2Snapshot
        let chips: [Chip]
        let recordedAt: Date
    }

    /// The most recent vitals entry, when it holds any observation.
    var latestVitals: LatestVitals? = nil
    var hasCriticalLabs = false
    /// Resulted investigations with a result recorded.
    var resultedCount = 0

    init() {}

    init(patient: Patient) {
        if let v = ListPerf.newest(patient.vitalsEntries.filter(\.isLive), by: { $0.recordedAt }),
           v.hasAnyValue {
            let chips: [Chip] = [
                v.bpString.map  { Chip(label: "BP",     value: $0 + " mmHg") },
                v.heartRate.map { Chip(label: "HR",     value: "\($0) bpm") },
                v.respiratoryRate.map { Chip(label: "RR", value: "\($0)/min") },
                v.temperatureCelsius.map { Chip(label: "Temp", value: String(format: "%.1f°C", $0)) },
                v.spo2.map { Chip(label: "SpO₂", value: "\($0)%") }
            ].compactMap { $0 }
            latestVitals = LatestVitals(news2: News2Snapshot(v), chips: chips, recordedAt: v.recordedAt)
        }
        let investigations = patient.investigations
        hasCriticalLabs = LabPanel.parse(from: investigations).hasCriticalValues
        resultedCount = investigations.filter { $0.status == .resulted && !$0.result.isEmpty }.count
    }
}
