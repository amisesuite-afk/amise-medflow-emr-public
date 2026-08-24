import SwiftUI
import SwiftData

struct WardRoundView: View {
    // No sort on @Query — enum sort crashes SwiftData at runtime
    @Query private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?
    @State private var locationFilter: ClinicalLocation? = nil
    @State private var reviewedIDs: Set<UUID> = []
    @State private var dischargeTarget: Patient? = nil

    private var inpatients: [Patient] {
        var results = allPatients.filter {
            $0.setting == .inpatient || $0.setting == .emergency
        }
        if let loc = locationFilter {
            results = results.filter { $0.location == loc }
        }
        return results.sorted { $0.acuity < $1.acuity }
    }

    // Group by location for sectioned list
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
                        Button("Discharge to Outpatient", role: .destructive) {
                            if let p = dischargeTarget { dischargePatient(p) }
                        }
                        Button("Cancel", role: .cancel) { dischargeTarget = nil }
                    } message: {
                        Text("This will move the patient to the outpatient list.")
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
        }
    }

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

    private func dischargePatient(_ patient: Patient) {
        patient.setting = .outpatient
        patient.updatedAt = .now
        patient.pendingSync = true
        dischargeTarget = nil
    }
}


