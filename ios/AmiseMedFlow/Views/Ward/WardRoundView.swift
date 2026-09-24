import SwiftUI
import SwiftData

// Carries both patient and pre-created note into the discharge sheet
struct DischargeContext: Identifiable {
    let id = UUID()
    let patient: Patient
    let note: ClinicalNote
}

struct WardRoundView: View {
    // No sort on @Query — enum sort crashes SwiftData at runtime
    @Query private var allPatients: [Patient]
    @Environment(\.modelContext) var context

    @State var showAdd = false
    @State var selectedPatient: Patient?
    @State var locationFilter: ClinicalLocation? = nil
    @State var reviewedIDs: Set<UUID> = []
    @State var dischargeTarget: Patient? = nil
    @State var dischargeContext: DischargeContext? = nil
    @State var showTriage = false
    @State var handoverPDF: PDFDataWrapper? = nil

    var inpatients: [Patient] {
        var results = allPatients.filter {
            $0.setting == .inpatient || $0.setting == .emergency
        }
        if let loc = locationFilter {
            results = results.filter { $0.location == loc }
        }
        return results.sorted { $0.acuity < $1.acuity }.deduped()
    }

    var grouped: [(ClinicalLocation, [Patient])] {
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
                        if !reviewedIDs.isEmpty {
                            Section {
                                HStack(spacing: 10) {
                                    let done = reviewedIDs.filter { id in inpatients.contains { $0.id == id } }.count
                                    let total = inpatients.count
                                    let complete = done == total
                                    Image(systemName: complete ? "checkmark.circle.fill" : "clock.badge.checkmark")
                                        .foregroundStyle(complete ? .green : .orange)
                                    Text("\(done) / \(total) reviewed this session")
                                        .font(.subheadline)
                                    Spacer()
                                    if complete {
                                        Text("Round complete")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.green)
                                    } else {
                                        Text("\(total - done) remaining")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
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
                    HStack {
                        SyncStatusBar()
                        Button { showTriage = true } label: {
                            Image(systemName: "chart.bar.xaxis.ascending")
                        }
                        if !inpatients.isEmpty {
                            Button {
                                let pdf = ProcedureFormPDF.wardHandover(grouped: grouped, reviewedIDs: reviewedIDs)
                                handoverPDF = PDFDataWrapper(data: pdf)
                            } label: {
                                Image(systemName: "square.and.arrow.up")
                            }
                        }
                        Button { showAdd = true } label: { Image(systemName: "plus") }
                    }
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
                WardRoundProgressSheet(patient: p) { reviewed in
                    markReviewed(reviewed)
                }
            }
            .sheet(item: $dischargeContext) { ctx in
                DischargeFlowSheet(
                    patient: ctx.patient,
                    note: ctx.note,
                    onDischarge: { dischargePatient($0) }
                )
            }
            .sheet(isPresented: $showTriage) {
                TriageDashboardView()
            }
            .sheet(item: $handoverPDF) { wrapper in
                ShareSheet(items: [wrapper.data as Any]).ignoresSafeArea()
            }
        }
    }

}
