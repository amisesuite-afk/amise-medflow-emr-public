import SwiftUI
import SwiftData

struct PatientListView: View {
    @Query(sort: \Patient.createdAt, order: .reverse) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var searchText = ""
    @State private var selectedPatient: Patient?

    private var outpatients: [Patient] {
        allPatients.filter { $0.setting == .outpatient }
    }

    private var filtered: [Patient] {
        guard !searchText.isEmpty else { return outpatients }
        let q = searchText.lowercased()
        return outpatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.chiefComplaint?.lowercased().contains(q) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if filtered.isEmpty {
                    ContentUnavailableView(
                        "No patients",
                        systemImage: "person.crop.circle",
                        description: Text("Add an outpatient to get started.")
                    )
                } else {
                    ForEach(filtered) { patient in
                        Button { selectedPatient = patient } label: {
                            PatientRow(patient: patient)
                        }
                        .buttonStyle(.plain)
                    }
                    .onDelete(perform: delete)
                }
            }
            .navigationTitle("Patients")
            .searchable(text: $searchText, prompt: "Search name or complaint")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showAdd) {
                AddPatientView(initialSetting: .outpatient)
            }
            .sheet(item: $selectedPatient) { p in
                PatientDetailView(patient: p)
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        for i in offsets { context.delete(filtered[i]) }
    }
}

// MARK: - Shared row

struct PatientRow: View {
    let patient: Patient

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color(hex: patient.setting.accentHex).opacity(0.15))
                    .frame(width: 40, height: 40)
                Text(patient.initials)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: patient.setting.accentHex))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(patient.fullName)
                    .font(.body.weight(.medium))
                if let cc = patient.chiefComplaint {
                    Text(cc)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                AcuityPip(acuity: patient.acuity)
                Text(patient.location.shortName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}
