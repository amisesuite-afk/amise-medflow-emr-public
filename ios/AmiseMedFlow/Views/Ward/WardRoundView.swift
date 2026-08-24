import SwiftUI
import SwiftData

// Carries both patient and pre-created note into the discharge sheet
private struct DischargeContext: Identifiable {
    let id = UUID()
    let patient: Patient
    let note: ClinicalNote
}

struct WardRoundView: View {
    // No sort on @Query — enum sort crashes SwiftData at runtime
    @Query private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?
    @State private var locationFilter: ClinicalLocation? = nil
    @State private var reviewedIDs: Set<UUID> = []
    @State private var dischargeTarget: Patient? = nil
    @State private var dischargeContext: DischargeContext? = nil

    private var inpatients: [Patient] {
        var results = allPatients.filter {
            $0.setting == .inpatient || $0.setting == .emergency
        }
        if let loc = locationFilter {
            results = results.filter { $0.location == loc }
        }
        return results.sorted { $0.acuity < $1.acuity }
    }

    private var grouped: [(ClinicalLocation, [Patient])] {
        let locs: [ClinicalLocation] = locationFilter.map { [$0] } ?? ClinicalLocation.allCases
        return locs.compactMap { loc in
            let pts = inpatients.filter { $0.location == loc }
            return pts.isEmpty ? nil : (loc, pts)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if inpatients.isEmpty {
                    ContentUnavailableView(
                        "No inpatients",
                        systemImage: "bed.double",
                        description: Text("Add an inpatient or emergency patient to begin the ward round.")
                    )
                } else {
                    List {
                        ForEach(grouped, id: \.0) { loc, patients in
                            Section(loc.rawValue) {
                                ForEach(patients) { patient in
                                    Button { selectedPatient = patient } label: {
                                        PatientRow(patient: patient)
                                            .overlay(alignment: .topTrailing) {
                                                if reviewedIDs.contains(patient.id) {
                                                    Label("Reviewed", systemImage: "checkmark.seal.fill")
                                                        .font(.system(size: 9, weight: .semibold))
                                                        .foregroundStyle(.green)
                                                        .padding(.trailing, 4)
                                                        .padding(.top, 10)
                                                }
                                            }
                                    }
                                    .buttonStyle(.plain)
                                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                        Button {
                                            markReviewed(patient)
                                        } label: {
                                            Label("Reviewed", systemImage: "checkmark.seal")
                                        }
                                        .tint(.green)
                                    }
                                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                        Button {
                                            dischargeTarget = patient
                                        } label: {
                                            Label("Discharge", systemImage: "arrow.right.square")
                                        }
                                        .tint(.teal)

                                        Button {
                                            escalateAcuity(patient)
                                        } label: {
                                            Label("Escalate", systemImage: "arrow.up.heart")
                                        }
                                        .tint(.orange)
                                    }
                                    .contextMenu {
                                        Button {
                                            markReviewed(patient)
                                        } label: {
                                            Label("Mark Reviewed", systemImage: "checkmark.seal")
                                        }
                                        Button {
                                            escalateAcuity(patient)
                                        } label: {
                                            Label("Escalate Acuity", systemImage: "arrow.up.heart")
                                        }
                                        Divider()
                                        Button {
                                            selectedPatient = patient
                                        } label: {
                                            Label("Progress Note", systemImage: "note.text.badge.plus")
                                        }
                                        Button(role: .destructive) {
                                            dischargeTarget = patient
                                        } label: {
                                            Label("Discharge Patient", systemImage: "arrow.right.square")
                                        }
                                    }
                                }
                                .onDelete { idx in delete(patients, at: idx) }
                            }
                        }
                    }
                    .confirmationDialog(
                        "Discharge \(dischargeTarget?.fullName ?? "patient")?",
                        isPresented: Binding(
                            get: { dischargeTarget != nil },
                            set: { if !$0 { dischargeTarget = nil } }
                        ),
                        titleVisibility: .visible
                    ) {
                        Button("Complete Discharge Summary") {
                            if let p = dischargeTarget { prepareDischarge(p) }
                        }
                        Button("Discharge Without Note", role: .destructive) {
                            if let p = dischargeTarget { dischargePatient(p) }
                        }
                        Button("Cancel", role: .cancel) { dischargeTarget = nil }
                    } message: {
                        Text("Would you like to complete a discharge summary first?")
                    }
                }
            }
            .navigationTitle("Ward Rounds")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button("All locations") { locationFilter = nil }
                        Divider()
                        ForEach(ClinicalLocation.allCases, id: \.self) { loc in
                            Button(loc.rawValue) { locationFilter = loc }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "line.3.horizontal.decrease.circle")
                            if let loc = locationFilter {
                                Text(loc.shortName).font(.caption.weight(.semibold))
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $showAdd) {
                AddPatientView(initialSetting: .inpatient)
            }
            .sheet(item: $selectedPatient) { p in
                PatientDetailView(patient: p)
            }
            .sheet(item: $dischargeContext) { ctx in
                DischargeFlowSheet(
                    patient: ctx.patient,
                    note: ctx.note,
                    onDischarge: { dischargePatient($0) }
                )
            }
        }
    }

    // MARK: - Actions

    private func delete(_ patients: [Patient], at offsets: IndexSet) {
        for i in offsets { context.delete(patients[i]) }
    }

    private func markReviewed(_ patient: Patient) {
        reviewedIDs.insert(patient.id)
        patient.updatedAt = .now
        patient.pendingSync = true
    }

    private func escalateAcuity(_ patient: Patient) {
        switch patient.acuity {
        case .routine:   patient.acuity = .priority
        case .priority:  patient.acuity = .urgent
        case .urgent:    patient.acuity = .emergency
        case .emergency: break
        }
        patient.updatedAt = .now
        patient.pendingSync = true
    }

    private func prepareDischarge(_ patient: Patient) {
        let note = ClinicalNote(noteType: .discharge, patient: patient)
        note.freeText = dischargeDraft(for: patient)
        context.insert(note)
        dischargeTarget = nil
        dischargeContext = DischargeContext(patient: patient, note: note)
    }

    private func dischargePatient(_ patient: Patient) {
        patient.setting = .outpatient
        patient.updatedAt = .now
        patient.pendingSync = true
        dischargeContext = nil
    }

    // MARK: - Discharge summary pre-fill

    private func dischargeDraft(for patient: Patient) -> String {
        let today = Date.now.formatted(date: .abbreviated, time: .omitted)

        var admissionLine = "—"
        var losLine = ""
        if let admitted = patient.admittedAt {
            admissionLine = admitted.formatted(date: .abbreviated, time: .omitted)
            let days = max(0, Calendar.current.dateComponents([.day], from: admitted, to: .now).day ?? 0)
            losLine = "Length of stay: \(days + 1) day\(days == 0 ? "" : "s")"
        }

        let dx = patient.workingDiagnosis ?? patient.chiefComplaint ?? "—"

        let rxLines: String = {
            let scripts = patient.prescriptions
            guard !scripts.isEmpty else { return "  None documented" }
            return scripts.map { "  • \($0.displayLine)" }.joined(separator: "\n")
        }()

        let allergyLines: String = {
            let list = patient.allergies
            guard !list.isEmpty else { return "  NKDA" }
            return list.map { "  • \($0.name) (\($0.reaction)) — \($0.severity)" }.joined(separator: "\n")
        }()

        var vitalsBlock = "  Not recorded"
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            var parts = ["NEWS2 \(v.news2Score) (\(v.news2Risk))"]
            if let bp = v.bpString { parts.append("BP \(bp) mmHg") }
            if let hr = v.heartRate { parts.append("HR \(hr) bpm") }
            if let rr = v.respiratoryRate { parts.append("RR \(rr)/min") }
            if let t = v.temperatureCelsius { parts.append(String(format: "Temp %.1f°C", t)) }
            if let spo = v.spo2 { parts.append("SpO₂ \(spo)%") }
            vitalsBlock = "  " + parts.joined(separator: " · ")
        }

        var procedureLine = ""
        if let proc = patient.appointmentType, !proc.isEmpty {
            procedureLine = "\nProcedure: \(proc)"
        }

        var pmhLine = ""
        if let pmh = patient.pmhNotes, !pmh.isEmpty {
            pmhLine = "\nPMH: \(pmh)"
        }

        return """
        DISCHARGE SUMMARY  ·  \(today)
        Consultant: Dr Dawit Daniel Kabiye
        Patient: \(patient.fullName) · \(patient.sex.rawValue.prefix(1)), \(patient.ageYears > 0 ? "\(patient.ageYears)y" : "age unknown")
        \([patient.ward.map { "Ward: \($0)" }, patient.bedNumber.map { "Bed: \($0)" }].compactMap { $0 }.joined(separator: "  "))

        ADMISSION
        Admitted:  \(admissionLine)
        Discharged: \(today)
        \(losLine)\(procedureLine)

        DIAGNOSIS
        \(dx)\(pmhLine)

        HOSPITAL COURSE


        CONDITION AT DISCHARGE


        DISCHARGE MEDICATIONS
        \(rxLines)

        ALLERGIES
        \(allergyLines)

        OBSERVATIONS AT DISCHARGE
        \(vitalsBlock)

        FOLLOW-UP


        RETURN PRECAUTIONS
        Return if: fever >38.5°C, increased pain or swelling, wound concerns,
        or any new or worsening symptoms.

        WOUND CARE


        DIET / ACTIVITY

        """
    }
}

// MARK: - Discharge flow sheet

private struct DischargeFlowSheet: View {
    let patient: Patient
    let note: ClinicalNote
    let onDischarge: (Patient) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var text: String

    init(patient: Patient, note: ClinicalNote, onDischarge: @escaping (Patient) -> Void) {
        self.patient = patient
        self.note = note
        self.onDischarge = onDischarge
        _text = State(initialValue: note.freeText ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                TextEditor(text: $text)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 520)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
            }
            .navigationTitle("Discharge Summary")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") {
                        // Save draft note, discharge patient
                        note.freeText = text
                        note.updatedAt = .now
                        note.pendingSync = true
                        onDischarge(patient)
                        dismiss()
                    }
                    .foregroundStyle(.secondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sign & Discharge") {
                        note.freeText = text
                        note.status = .signed
                        note.updatedAt = .now
                        note.pendingSync = true
                        onDischarge(patient)
                        dismiss()
                    }
                    .foregroundStyle(.teal)
                    .fontWeight(.semibold)
                }
            }
        }
    }
}
