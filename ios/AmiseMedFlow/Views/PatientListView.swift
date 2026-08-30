import SwiftUI
import SwiftData

struct PatientListView: View {
    @Query(sort: \Patient.createdAt, order: .reverse) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var searchText = ""
    @State private var selectedPatient: Patient?

    private var filtered: [Patient] {
        guard !searchText.isEmpty else { return allPatients }
        let q = searchText.lowercased()
        return allPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.chiefComplaint?.lowercased().contains(q) ?? false) ||
            ($0.workingDiagnosis?.lowercased().contains(q) ?? false) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.phone?.contains(q) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if filtered.isEmpty {
                    ContentUnavailableView(
                        "No patients",
                        systemImage: "person.crop.circle",
                        description: Text("Add a patient to get started.")
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
                    HStack {
                        SyncStatusBar()
                        Button { showAdd = true } label: { Image(systemName: "plus") }
                    }
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

    private var sortedVitals: [VitalsEntry] {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }
    }

    private var latestVitals: VitalsEntry? { sortedVitals.first }

    private var news2Trend: String {
        let scores = sortedVitals.prefix(3).filter { $0.hasAnyValue }.map { $0.news2Score }
        guard scores.count >= 2 else { return "" }
        let delta = scores[0] - scores[1]
        if delta > 0 { return "↑" }
        if delta < 0 { return "↓" }
        return "→"
    }

    private var news2TrendColor: Color {
        let scores = sortedVitals.prefix(3).filter { $0.hasAnyValue }.map { $0.news2Score }
        guard scores.count >= 2 else { return .secondary }
        let delta = scores[0] - scores[1]
        if delta > 0 { return .red }
        if delta < 0 { return .green }
        return .secondary
    }

    private var accentColor: Color { Color(hex: patient.setting.accentHex) }

    private var locationColor: Color {
        switch patient.location {
        case .tapion:     return Color(hex: "#0891B2")
        case .rodney_bay: return Color(hex: "#7C3AED")
        case .okeu:       return Color(hex: "#DC2626")
        case .victoria:   return Color(hex: "#2563EB")
        case .other:      return Color.gray
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            // Left accent stripe (mirrors web border-left)
            Rectangle()
                .fill(accentColor)
                .frame(width: 3)
                .padding(.vertical, -8)

            VStack(alignment: .leading, spacing: 3) {
                // Row 1: acuity pip · name · setting badge · visit type · bed
                HStack(spacing: 5) {
                    AcuityPip(acuity: patient.acuity)
                    Text(patient.fullName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Spacer(minLength: 2)
                    if let vt = patient.visitType {
                        Text(vt.shortLabel)
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(Color(hex: vt.accentHex))
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Color(hex: vt.accentHex).opacity(0.1), in: RoundedRectangle(cornerRadius: 4))
                    }
                    if let bed = patient.bedNumber {
                        Text("Bed \(bed)")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 4))
                    }
                }

                // Row 2: demographics · location pill · time
                HStack(spacing: 4) {
                    if let age = patient.ageDisplay {
                        Text("\(patient.sex.rawValue.prefix(1).uppercased()), \(age)")
                            .font(.caption2).foregroundStyle(.secondary)
                    } else {
                        Text(patient.sex.rawValue.prefix(1).uppercased())
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    Text("·").font(.caption2).foregroundStyle(.tertiary)
                    Text(patient.setting.rawValue)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(accentColor)
                    Spacer()
                    // Location pill — prominent Tapion/RB
                    Text(patient.location.shortName)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(locationColor, in: Capsule())
                    Text(patient.createdAt, style: .relative)
                        .font(.caption2).foregroundStyle(.tertiary)
                }

                // Row 3: chief complaint then working diagnosis
                if let cc = patient.chiefComplaint, !cc.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "text.bubble").font(.system(size: 8)).foregroundStyle(.teal)
                        Text(cc).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        if let dx = patient.workingDiagnosis {
                            Text("→").font(.caption2).foregroundStyle(.tertiary)
                            Image(systemName: "stethoscope").font(.system(size: 8)).foregroundStyle(.teal)
                            Text(dx).font(.caption2).foregroundStyle(.teal).lineLimit(1)
                        }
                    }
                } else if let dx = patient.workingDiagnosis {
                    HStack(spacing: 4) {
                        Image(systemName: "stethoscope").font(.system(size: 8)).foregroundStyle(.teal)
                        Text(dx).font(.caption2).foregroundStyle(.teal).lineLimit(1)
                    }
                }

                // Row 4: NEWS2 (all settings when vitals exist) + POD + safety badges
                if let v = latestVitals, v.hasAnyValue {
                    HStack(spacing: 6) {
                        if let days = patient.postOpDays {
                            Text("POD \(days)")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(AMColor.accent)
                        }
                        Text("NEWS2 \(v.news2Score)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color(hex: v.news2Color))
                        if !news2Trend.isEmpty {
                            Text(news2Trend)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(news2TrendColor)
                        }
                        Text(v.news2Risk)
                            .font(.system(size: 9))
                            .foregroundStyle(Color(hex: v.news2Color).opacity(0.8))
                        Spacer()
                        if patient.hasCriticalAllergy {
                            Label("Allergy", systemImage: "exclamationmark.shield.fill")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.red)
                                .labelStyle(.iconOnly)
                        } else if !patient.allergies.isEmpty {
                            Label("Allergy", systemImage: "exclamationmark.shield")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(.orange)
                                .labelStyle(.iconOnly)
                        }
                        if patient.hasAnticoagulation {
                            Label("Anticoag", systemImage: "drop.fill")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.purple)
                                .labelStyle(.iconOnly)
                        }
                    }
                } else if let days = patient.postOpDays {
                    Text("POD \(days)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(accentColor)
                }
            }
            .padding(.leading, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 16))
    }
}
