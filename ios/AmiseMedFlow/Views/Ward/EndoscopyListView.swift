import SwiftUI
import SwiftData

struct EndoscopyListView: View {
    @Query(sort: \Patient.createdAt) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?

    private var endoscopyPatients: [Patient] {
        let base = allPatients.filter { $0.setting == .endoscopy }
        return base.sorted {
            switch ($0.operationDate, $1.operationDate) {
            case let (a?, b?): return a < b
            case (_?, nil):    return true
            case (nil, _?):    return false
            default:           return $0.acuity < $1.acuity
            }
        }
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
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    markComplete(patient)
                                } label: {
                                    Label("Done", systemImage: "checkmark.circle.fill")
                                }
                                .tint(.teal)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    context.delete(patient)
                                } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                            }
                        }
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

    private func markComplete(_ patient: Patient) {
        patient.setting = .outpatient
        patient.updatedAt = .now
        patient.pendingSync = true
    }
}

// MARK: - Endoscopy case row

struct EndoscopyRow: View {
    let patient: Patient

    private var scopeText: String {
        if let t = patient.appointmentType, !t.isEmpty { return t }
        if let dx = patient.workingDiagnosis { return "Endoscopy: \(dx)" }
        return patient.chiefComplaint ?? "Scope TBD"
    }

    private var scopeIcon: String {
        let text = (patient.appointmentType ?? patient.chiefComplaint ?? "").lowercased()
        if text.contains("ercp")        { return "arrow.triangle.branch" }
        if text.contains("colonoscopy") { return "arrow.up.right.circle" }
        if text.contains("ogd") || text.contains("gastroscopy") { return "arrow.down.right.circle" }
        return "circle.dotted"
    }

    private var timeText: String {
        guard let date = patient.operationDate else { return "Date TBD" }
        return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(Color(hex: "0891B2"))  // endoscopy teal-blue
                .frame(width: 3)
                .padding(.vertical, -8)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(timeText)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color(hex: "0891B2"))
                    Spacer()
                    AcuityPip(acuity: patient.acuity)
                    Text(patient.fullName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                }

                HStack(spacing: 6) {
                    Image(systemName: scopeIcon)
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "0891B2"))
                    Text(scopeText)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                }

                HStack(spacing: 4) {
                    Text("\(patient.sex.rawValue.prefix(1).uppercased()), \(patient.ageYears)y")
                        .font(.caption2).foregroundStyle(.secondary)
                    if let dx = patient.workingDiagnosis {
                        Text("·").font(.caption2).foregroundStyle(.tertiary)
                        Text(dx).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            }
            .padding(.leading, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 16))
    }
}
