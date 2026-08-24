import SwiftUI
import SwiftData

struct WardRoundView: View {
    // No sort on @Query — enum sort crashes SwiftData at runtime
    @Query private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?
    @State private var locationFilter: ClinicalLocation? = nil

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
                                        WardPatientRow(patient: patient)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .onDelete { idx in delete(patients, at: idx) }
                            }
                        }
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
}

// MARK: - Ward row

struct WardPatientRow: View {
    let patient: Patient

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    var body: some View {
        HStack(spacing: 12) {
            AcuityPip(acuity: patient.acuity)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(patient.fullName).font(.body.weight(.medium))
                    Spacer()
                    if let bed = patient.bedNumber {
                        Text("Bed \(bed)")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.12), in: Capsule())
                            .foregroundStyle(.secondary)
                    }
                }
                HStack(spacing: 8) {
                    Text("\(patient.sex.rawValue[patient.sex.rawValue.startIndex].uppercased()), \(patient.ageYears)y")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let cc = patient.chiefComplaint {
                        Text("· \(cc)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                HStack(spacing: 8) {
                    if let days = patient.postOpDays {
                        Text("POD \(days)")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(AMColor.accent)
                    }
                    if let v = latestVitals, v.hasAnyValue {
                        Text("NEWS2 \(v.news2Score)")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color(hex: v.news2Color))
                        Text(v.news2Risk)
                            .font(.caption2)
                            .foregroundStyle(Color(hex: v.news2Color).opacity(0.8))
                    }
                }
            }
        }
        .padding(.vertical, 3)
    }
}

