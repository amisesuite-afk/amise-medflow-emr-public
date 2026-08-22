import SwiftUI
import SwiftData

struct TheatreListView: View {
    // Use createdAt (non-optional) — operationDate is Date? and causes sort issues
    @Query(sort: \Patient.createdAt) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?

    private var theatrePatients: [Patient] {
        allPatients.filter { $0.setting == .theatre }
    }

    var body: some View {
        NavigationStack {
            Group {
                if theatrePatients.isEmpty {
                    ContentUnavailableView(
                        "No theatre cases",
                        systemImage: "scissors",
                        description: Text("Add a theatre case to build the list.")
                    )
                } else {
                    List {
                        ForEach(theatrePatients) { patient in
                            Button { selectedPatient = patient } label: {
                                TheatreRow(patient: patient)
                            }
                            .buttonStyle(.plain)
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
            .navigationTitle("Theatre List")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showAdd) {
                AddPatientView(initialSetting: .theatre)
            }
            .sheet(item: $selectedPatient) { p in
                PatientDetailView(patient: p)
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        for i in offsets { context.delete(theatrePatients[i]) }
    }
}

// MARK: - Theatre row

struct TheatreRow: View {
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
                    if let type = patient.appointmentType {
                        Text(type).font(.caption).foregroundStyle(.secondary)
                    }
                    if let op = patient.operationDate {
                        Text(op, style: .date).font(.caption).foregroundStyle(.secondary)
                    }
                }
                if let days = patient.postOpDays {
                    Text("POD \(days)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color(hex: patient.setting.accentHex))
                }
            }

            Spacer()
            AcuityPip(acuity: patient.acuity)
        }
        .padding(.vertical, 3)
    }
}
