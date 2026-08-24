import SwiftUI
import SwiftData

struct TheatreListView: View {
    // Sort by createdAt — operationDate is Date? and crashes @Query sort
    @Query(sort: \Patient.createdAt) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?

    private var theatrePatients: [Patient] {
        let base = allPatients.filter { $0.setting == .theatre }
        // Sort by operationDate ascending (TBD last), then by acuity
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
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    markPostOp(patient)
                                } label: {
                                    Label("Post-Op", systemImage: "checkmark.circle.fill")
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
            .navigationTitle("Theatre List")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    HStack {
                        if !theatrePatients.isEmpty {
                            ShareLink(item: theatreListText,
                                      subject: Text("Theatre List")) {
                                Image(systemName: "square.and.arrow.up")
                            }
                        }
                        Button { showAdd = true } label: { Image(systemName: "plus") }
                    }
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

    private var theatreListText: String {
        let today = Date.now.formatted(date: .abbreviated, time: .shortened)
        var lines: [String] = []
        lines.append("THEATRE LIST — \(today)")
        lines.append("Amise Medical Services · Dr Dawit Daniel Kabiye MD DM")
        lines.append(String(repeating: "═", count: 48))
        lines.append("")

        for (i, patient) in theatrePatients.enumerated() {
            let plan = patient.operativePlans.sorted { $0.updatedAt > $1.updatedAt }.first
            let dateStr: String
            if let op = patient.operationDate {
                dateStr = op.formatted(.dateTime.month(.abbreviated).day().hour().minute())
            } else {
                dateStr = "Date TBD"
            }
            let proc: String
            if let t = patient.appointmentType, !t.isEmpty { proc = t }
            else if let dx = patient.workingDiagnosis { proc = "Surgery for \(dx)" }
            else { proc = patient.chiefComplaint ?? "Procedure TBD" }

            lines.append("Case \(i + 1) · \(dateStr)")
            lines.append("\(patient.fullName) · \(patient.sex.rawValue.prefix(1)), \(patient.ageYears)y [\(patient.acuity.label.uppercased())]")
            lines.append("Procedure: \(proc)")

            if let anaes = plan?.anaesthesiaType, !anaes.isEmpty {
                lines.append("Anaesthesia: \(anaes)")
            }

            if let p = plan {
                let whoStr = p.whoCompletedCount == p.whoTotalCount
                    ? "WHO checklist: ✓ Complete (\(p.whoTotalCount)/\(p.whoTotalCount))"
                    : "WHO checklist: ⚠ \(p.whoCompletedCount)/\(p.whoTotalCount) items checked"
                lines.append(whoStr)
            }

            let allergies = patient.allergies
            if allergies.isEmpty {
                lines.append("Allergies: NKDA")
            } else {
                lines.append("Allergies: " + allergies.map { "\($0.name) (\($0.severity))" }.joined(separator: ", "))
            }

            if let mrn = patient.mrn { lines.append("MRN: \(mrn)") }
            lines.append(String(repeating: "─", count: 48))
            lines.append("")
        }

        lines.append("Total cases: \(theatrePatients.count)")
        lines.append("This list is a summary. Verify all details before proceeding.")
        return lines.joined(separator: "\n")
    }

    private func markPostOp(_ patient: Patient) {
        patient.setting = .inpatient
        patient.admittedAt = patient.admittedAt ?? patient.operationDate ?? .now
        patient.updatedAt = .now
        patient.pendingSync = true
    }
}

// MARK: - Theatre case row

struct TheatreRow: View {
    let patient: Patient

    private var plan: OperativePlan? {
        patient.operativePlans.sorted { $0.updatedAt > $1.updatedAt }.first
    }

    private var procedureText: String {
        if let t = patient.appointmentType, !t.isEmpty { return t }
        if let dx = patient.workingDiagnosis { return "Surgery for \(dx)" }
        return patient.chiefComplaint ?? "Procedure TBD"
    }

    private var timeText: String {
        guard let date = patient.operationDate else { return "Date TBD" }
        return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(Color(hex: "8B5CF6"))  // theatre purple
                .frame(width: 3)
                .padding(.vertical, -8)

            VStack(alignment: .leading, spacing: 4) {
                // Row 1: time + name + acuity
                HStack(spacing: 6) {
                    Text(timeText)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color(hex: "8B5CF6"))
                    Spacer()
                    AcuityPip(acuity: patient.acuity)
                    Text(patient.fullName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                }

                // Row 2: procedure
                Text(procedureText)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)

                // Row 3: demographics + WHO badge
                HStack(spacing: 6) {
                    Text("\(patient.sex.rawValue.prefix(1).uppercased()), \(patient.ageYears)y")
                        .font(.caption2).foregroundStyle(.secondary)

                    if let anaes = plan?.anaesthesiaType, !anaes.isEmpty {
                        Text("·").font(.caption2).foregroundStyle(.tertiary)
                        Text(anaes).font(.caption2).foregroundStyle(.secondary)
                    }

                    Spacer()

                    if let p = plan {
                        let done = p.whoCompletedCount
                        let total = p.whoTotalCount
                        let allDone = done == total
                        HStack(spacing: 3) {
                            Image(systemName: allDone ? "checkmark.shield.fill" : "shield")
                                .font(.system(size: 9))
                            Text("WHO \(done)/\(total)")
                                .font(.system(size: 9, weight: .semibold))
                        }
                        .foregroundStyle(allDone ? .green : .orange)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(
                            (allDone ? Color.green : Color.orange).opacity(0.1),
                            in: Capsule()
                        )
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

