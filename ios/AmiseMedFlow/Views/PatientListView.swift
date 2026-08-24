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

// MARK: - Universal patient row (used by all sections)

struct PatientRow: View {
    let patient: Patient

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    private var accentColor: Color { Color(hex: patient.setting.accentHex) }

    private var subtitleLine: String? {
        [patient.chiefComplaint, patient.workingDiagnosis, patient.appointmentType]
            .compactMap { $0 }
            .first
    }

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(accentColor.opacity(0.12))
                    .frame(width: 44, height: 44)
                Text(patient.initials)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(accentColor)
            }

            // Body
            VStack(alignment: .leading, spacing: 3) {
                // Name + acuity pip
                HStack(spacing: 6) {
                    AcuityPip(acuity: patient.acuity)
                    Text(patient.fullName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.primary)
                    if let bed = patient.bedNumber {
                        Text("Bed \(bed)")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(Color.secondary.opacity(0.1), in: Capsule())
                            .foregroundStyle(.secondary)
                    }
                }

                // Demographics + phone
                HStack(spacing: 4) {
                    Text("\(patient.sex.rawValue.prefix(1).uppercased()), \(patient.ageYears)y")
                        .font(.caption).foregroundStyle(.secondary)
                    if let phone = patient.phone, !phone.isEmpty {
                        Text("·").font(.caption).foregroundStyle(.tertiary)
                        Text(phone).font(.caption).foregroundStyle(.secondary)
                    }
                }

                // Complaint / diagnosis / procedure
                if let sub = subtitleLine {
                    Text(sub)
                        .font(.caption).foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                // Inpatient/ward: NEWS2 + POD
                if (patient.setting == .inpatient || patient.setting == .emergency),
                   let v = latestVitals, v.hasAnyValue {
                    HStack(spacing: 8) {
                        if let days = patient.postOpDays {
                            Text("POD \(days)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(AMColor.accent)
                        }
                        Text("NEWS2 \(v.news2Score)")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color(hex: v.news2Color))
                        Text(v.news2Risk)
                            .font(.caption2)
                            .foregroundStyle(Color(hex: v.news2Color).opacity(0.8))
                    }
                } else if let days = patient.postOpDays {
                    Text("POD \(days)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(accentColor)
                }
            }

            Spacer()

            // Right: location pill + relative date
            VStack(alignment: .trailing, spacing: 5) {
                Text(patient.location.shortName)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(accentColor.opacity(0.1), in: Capsule())
                    .foregroundStyle(accentColor)
                Text(patient.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding(.vertical, 5)
    }
}
