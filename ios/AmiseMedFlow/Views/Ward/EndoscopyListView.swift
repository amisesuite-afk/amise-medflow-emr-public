import SwiftUI
import SwiftData

struct EndoscopyListView: View {
    @Query(sort: \Patient.createdAt) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?

    private var endoscopyPatients: [Patient] {
        allPatients.filter { $0.setting == .endoscopy }
    }

    var body: some View {
        NavigationStack {
            Group {
                if endoscopyPatients.isEmpty {
                    ContentUnavailableView(
                        "No endoscopy cases",
                        systemImage: "circle.dotted",
                        description: Text("Add an endoscopy case to build the list.")
                    )
                } else {
                    List {
                        ForEach(endoscopyPatients) { patient in
                            Button { selectedPatient = patient } label: {
                                EndoscopyRow(patient: patient)
                            }
                            .buttonStyle(.plain)
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
            .navigationTitle("Endoscopy List")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showAdd) {
                AddPatientView(initialSetting: .endoscopy)
            }
            .sheet(item: $selectedPatient) { p in
                PatientDetailView(patient: p)
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        for i in offsets { context.delete(endoscopyPatients[i]) }
    }
}

// MARK: - Endoscopy row

struct EndoscopyRow: View {
    let patient: Patient

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color(hex: patient.setting.accentHex).opacity(0.15))
                    .frame(width: 40, height: 40)
                Image(systemName: patient.setting.icon)
                    .foregroundStyle(Color(hex: patient.setting.accentHex))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(patient.fullName).font(.body.weight(.medium))
                HStack(spacing: 8) {
                    Text("\(patient.sex.rawValue[patient.sex.rawValue.startIndex].uppercased()), \(patient.ageYears)y")
                        .font(.caption).foregroundStyle(.secondary)
                    if let type = patient.appointmentType {
                        Text("· \(type)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                AcuityPip(acuity: patient.acuity)
                Text(patient.location.shortName)
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 3)
    }
}
