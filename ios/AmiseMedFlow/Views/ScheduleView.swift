import SwiftUI
import SwiftData

struct ScheduleView: View {
    @Query(sort: \Patient.createdAt, order: .reverse) private var allPatients: [Patient]
    @State private var selectedPatient: Patient?
    @State private var showAdd = false

    private let calendar = Calendar.current

    private var scheduledPatients: [Patient] {
        allPatients
            .filter { ($0.setting == .theatre || $0.setting == .endoscopy) && $0.operationDate != nil }
            .sorted {
                switch ($0.operationDate, $1.operationDate) {
                case let (a?, b?): return a < b
                case (_?, nil):    return true
                case (nil, _?):    return false
                default:           return $0.acuity < $1.acuity
                }
            }
    }

    private var groupedByDate: [(date: Date, patients: [Patient])] {
        let grouped = Dictionary(grouping: scheduledPatients) { p in
            calendar.startOfDay(for: p.operationDate!)
        }
        return grouped.keys.sorted().map { date in
            (date: date, patients: grouped[date]!.sorted { ($0.operationDate ?? .distantFuture) < ($1.operationDate ?? .distantFuture) })
        }
    }

    private var todayPatients: [Patient] {
        scheduledPatients.filter { calendar.isDateInToday($0.operationDate!) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if scheduledPatients.isEmpty {
                    ContentUnavailableView(
                        "No scheduled cases",
                        systemImage: "calendar.badge.plus",
                        description: Text("Add a theatre or endoscopy patient and set an operation date.")
                    )
                } else {
                    scheduleList
                }
            }
            .navigationTitle("Schedule")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    HStack {
                        if !scheduledPatients.isEmpty {
                            ShareLink(item: scheduleExportText,
                                      subject: Text("Operating Schedule")) {
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

    private var scheduleList: some View {
        List {
            if !todayPatients.isEmpty {
                Section {
                    ForEach(todayPatients) { patient in
                        Button { selectedPatient = patient } label: {
                            ScheduleRow(patient: patient)
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Label("Today — \(Date.now.formatted(date: .abbreviated, time: .omitted))", systemImage: "calendar")
                        .foregroundStyle(.teal)
                }
            }
            ForEach(groupedByDate, id: \.date) { group in
                if !calendar.isDateInToday(group.date) {
                    Section {
                        ForEach(group.patients) { patient in
                            Button { selectedPatient = patient } label: {
                                ScheduleRow(patient: patient)
                            }
                            .buttonStyle(.plain)
                        }
                    } header: {
                        Text(sectionTitle(for: group.date))
                    }
                }
            }
        }
    }

    private var scheduleExportText: String {
        let now = Date.now.formatted(date: .abbreviated, time: .shortened)
        var lines: [String] = []
        lines.append("OPERATING SCHEDULE — \(now)")
        lines.append("Amise Medical Services · Dr Dawit Daniel Kabiye MD DM")
        lines.append(String(repeating: "═", count: 48))

        for group in groupedByDate {
            let dateLabel: String
            if calendar.isDateInToday(group.date) {
                dateLabel = "TODAY — \(group.date.formatted(date: .abbreviated, time: .omitted))"
            } else if calendar.isDateInTomorrow(group.date) {
                dateLabel = "TOMORROW — \(group.date.formatted(date: .abbreviated, time: .omitted))"
            } else {
                let weekday = group.date.formatted(.dateTime.weekday(.wide)).uppercased()
                dateLabel = "\(weekday) — \(group.date.formatted(date: .abbreviated, time: .omitted))"
            }
            lines.append("")
            lines.append(dateLabel)
            lines.append(String(repeating: "─", count: 48))

            for (i, patient) in group.patients.enumerated() {
                let setting = patient.setting == .endoscopy ? "ENDO" : "THTR"
                let timeStr: String
                if let op = patient.operationDate {
                    let comps = Calendar.current.dateComponents([.hour, .minute], from: op)
                    if let h = comps.hour, let m = comps.minute, !(h == 0 && m == 0) {
                        timeStr = op.formatted(date: .omitted, time: .shortened)
                    } else {
                        timeStr = "TBC"
                    }
                } else {
                    timeStr = "TBC"
                }
                let proc = patient.appointmentType ?? patient.workingDiagnosis ?? patient.chiefComplaint ?? "TBD"
                lines.append("\(i + 1). [\(setting)] \(timeStr) — \(patient.fullName), \(patient.sex.rawValue.prefix(1)) \(patient.ageYears)y")
                lines.append("   \(proc)")
                let allergies = patient.allergies
                lines.append("   Allergies: \(allergies.isEmpty ? "NKDA" : allergies.map { $0.name }.joined(separator: ", "))")
            }
        }

        lines.append("")
        lines.append(String(repeating: "═", count: 48))
        lines.append("Total cases: \(scheduledPatients.count)")
        lines.append("This schedule is a summary. Verify all details before proceeding.")
        return lines.joined(separator: "\n")
    }

    private func sectionTitle(for date: Date) -> String {
        if calendar.isDateInTomorrow(date) {
            return "Tomorrow — \(date.formatted(date: .abbreviated, time: .omitted))"
        }
        let weekday = date.formatted(.dateTime.weekday(.wide))
        return "\(weekday) · \(date.formatted(date: .abbreviated, time: .omitted))"
    }
}

// MARK: - Schedule row

private struct ScheduleRow: View {
    let patient: Patient

    private var timeString: String? {
        guard let date = patient.operationDate else { return nil }
        let comps = Calendar.current.dateComponents([.hour, .minute], from: date)
        guard let h = comps.hour, let m = comps.minute, !(h == 0 && m == 0) else { return nil }
        return date.formatted(date: .omitted, time: .shortened)
    }

    private var settingColor: Color {
        patient.setting == .endoscopy ? .cyan : .purple
    }

    private var settingLabel: String {
        patient.setting == .endoscopy ? "ENDO" : "THTR"
    }

    var body: some View {
        HStack(spacing: 12) {
            VStack(spacing: 2) {
                Text(settingLabel)
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(settingColor)
                if let t = timeString {
                    Text(t)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(settingColor)
                } else {
                    Text("TBC")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 42)
            .padding(.vertical, 6)
            .background(settingColor.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    AcuityPip(acuity: patient.acuity)
                    Text(patient.fullName)
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(patient.location.shortName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if let proc = patient.appointmentType, !proc.isEmpty {
                    Text(proc)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else if let dx = patient.workingDiagnosis {
                    Text(dx)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    if patient.ageYears > 0 {
                        Text("\(patient.sex.rawValue.prefix(1)), \(patient.ageYears)y")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    if let plan = patient.operativePlans.first {
                        let done = plan.whoCompletedCount
                        let total = plan.whoTotalCount
                        if done < total {
                            Label("WHO \(done)/\(total)", systemImage: "checklist")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        } else {
                            Label("WHO complete", systemImage: "checkmark.circle")
                                .font(.caption2)
                                .foregroundStyle(.green)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }
}
