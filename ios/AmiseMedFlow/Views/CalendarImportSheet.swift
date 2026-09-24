import SwiftUI
import SwiftData
import EventKit

// MARK: - Parsed calendar appointment

struct CalendarAppointment: Identifiable {
    let id: String          // EKEvent.eventIdentifier
    let eventTitle: String
    let startTime: Date
    let parsedName: String
    let setting: ClinicalSetting
    let appointmentType: String
    let isNewPatient: Bool
    var selected: Bool = true
    var alreadyExists: Bool = false
}

// MARK: - Import sheet

struct CalendarImportSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context

    let events: [EKEvent]
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @State private var appointments: [CalendarAppointment] = []
    @State private var importing = false
    @State private var done = false

    private var selectedCount: Int { appointments.filter { $0.selected && !$0.alreadyExists }.count }

    var body: some View {
        NavigationStack {
            Group {
                if appointments.isEmpty {
                    emptyState
                } else {
                    List {
                        Section {
                            ForEach($appointments) { $appt in
                                appointmentRow($appt)
                            }
                        } header: {
                            Text("Today's calendar — tap to deselect")
                        } footer: {
                            Text("Patients already in today's list are shown greyed out and will not be duplicated.")
                                .font(.caption2)
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Add from Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        importSelected()
                    } label: {
                        if importing {
                            ProgressView().controlSize(.small)
                        } else {
                            Text(selectedCount > 0 ? "Add \(selectedCount)" : "Done")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(importing)
                }
            }
            .onAppear { buildAppointments() }
        }
    }

    // MARK: - Row

    private func appointmentRow(_ appt: Binding<CalendarAppointment>) -> some View {
        let a = appt.wrappedValue
        return Button {
            if !a.alreadyExists { appt.selected.wrappedValue.toggle() }
        } label: {
            HStack(spacing: 12) {
                // Time badge
                VStack(spacing: 1) {
                    Text(a.startTime, format: .dateTime.hour().minute())
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                    Text(settingLabel(a.setting))
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(settingColor(a.setting))
                }
                .frame(width: 52)

                VStack(alignment: .leading, spacing: 3) {
                    Text(a.parsedName)
                        .font(.system(size: 15, weight: a.alreadyExists ? .regular : .medium))
                        .foregroundStyle(a.alreadyExists ? .secondary : .primary)
                    HStack(spacing: 6) {
                        if a.isNewPatient {
                            Text("NEW")
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background { AMColor.accent.opacity(0.15) }
                                .foregroundStyle(AMColor.accent)
                                .clipShape(RoundedRectangle(cornerRadius: 3))
                        }
                        Text(a.appointmentType)
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                if a.alreadyExists {
                    Text("Already added")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else {
                    Image(systemName: a.selected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 20))
                        .foregroundStyle(a.selected ? AMColor.accent : Color(.systemGray3))
                }
            }
            .padding(.vertical, 4)
            .opacity(a.alreadyExists ? 0.5 : 1)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            Text("No appointments found for today")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Google Calendar events appear here when your Google account is added in iOS Settings → Calendar → Accounts.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Parse events

    private func buildAppointments() {
        let cal = Calendar.current
        let todayEvents = events.filter {
            guard let s = $0.startDate, !$0.isAllDay else { return false }
            return cal.isDateInToday(s)
        }.sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }

        let existing = Set(allPatients.filter { p in
            guard let opDate = p.operationDate else { return false }
            return cal.isDateInToday(opDate)
        }.map { $0.fullName.lowercased().trimmingCharacters(in: .whitespaces) })

        appointments = todayEvents.compactMap { event in
            guard let title = event.title, !title.isEmpty,
                  let start = event.startDate else { return nil }
            let parsed = CalendarEventParser.parse(title: title, calLabel: event.calEntryLabel)
            guard !parsed.name.isEmpty else { return nil }
            var appt = CalendarAppointment(
                id: event.eventIdentifier ?? UUID().uuidString,
                eventTitle: title,
                startTime: start,
                parsedName: parsed.name,
                setting: parsed.setting,
                appointmentType: parsed.appointmentType,
                isNewPatient: parsed.isNew
            )
            appt.alreadyExists = existing.contains(parsed.name.lowercased().trimmingCharacters(in: .whitespaces))
            return appt
        }
    }

    // MARK: - Import

    private func importSelected() {
        guard selectedCount > 0 else { dismiss(); return }
        importing = true
        let toAdd = appointments.filter { $0.selected && !$0.alreadyExists }
        for appt in toAdd {
            let p = Patient(fullName: appt.parsedName, setting: appt.setting)
            p.mrn = MRNGenerator.next(in: context)
            p.operationDate = appt.startTime
            p.appointmentType = appt.appointmentType
            p.acuity = .routine
            context.insert(p)
        }
        try? context.save()
        dismiss()
    }

    // MARK: - Helpers

    private func settingLabel(_ s: ClinicalSetting) -> String {
        switch s {
        case .endoscopy: return "ENDO"
        case .theatre:   return "THTR"
        case .outpatient: return "CLIN"
        case .inpatient:  return "WARD"
        case .emergency:  return "EMER"
        }
    }

    private func settingColor(_ s: ClinicalSetting) -> Color {
        switch s {
        case .endoscopy: return .cyan
        case .theatre:   return .purple
        case .outpatient: return .blue
        case .inpatient:  return .orange
        case .emergency:  return .red
        }
    }
}

// MARK: - Event title parser

enum CalendarEventParser {
    struct Parsed {
        let name: String
        let setting: ClinicalSetting
        let appointmentType: String
        let isNew: Bool
    }

    // Handles formats seen in practice:
    //   "Johnathan Allian New pt Endoscopy light"
    //   "Mandy Joseph New pt 4844099 Colonoscopy light"
    //   "Tony Kisna Old pt 7241272 Endoscopy light"
    //   "Yasmin … Old pt 724 Colonoscopy (Princess …)"
    //   Calendar label already carries "[endoscopy]" or "[theatre]" etc.
    static func parse(title: String, calLabel: String) -> Parsed {
        var raw = title

        // Strip bracketed calendar tags like [endoscopy]
        raw = raw.replacingOccurrences(of: #"\[.*?\]"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)

        // Detect new vs returning
        let isNew = raw.lowercased().contains("new pt") || raw.lowercased().contains("new patient")

        // Detect setting from keywords in the title or the calendar label
        let combined = (raw + " " + calLabel).lowercased()
        let setting: ClinicalSetting
        let appointmentType: String
        if combined.contains("ercp") {
            setting = .endoscopy; appointmentType = "ERCP"
        } else if combined.contains("colonoscopy") || combined.contains("colon") {
            setting = .endoscopy; appointmentType = "Colonoscopy"
        } else if combined.contains("ogd") || combined.contains("gastroscopy") || combined.contains("endoscopy") || combined.contains("endo") || combined.contains("scope") {
            setting = .endoscopy; appointmentType = "OGD / Endoscopy"
        } else if combined.contains("theatre") || combined.contains("theater") || combined.contains("surgery") || combined.contains("operation") || combined.contains("laparoscop") {
            setting = .theatre; appointmentType = "Surgery"
        } else if combined.contains("clinic") || combined.contains("outpatient") || combined.contains("follow") || combined.contains("review") {
            setting = .outpatient; appointmentType = "Clinic Review"
        } else {
            setting = .outpatient; appointmentType = "Appointment"
        }

        // Extract patient name: everything before the first marker word
        let markerPatterns = [
            #"\bNew\s+pt\b"#, #"\bOld\s+pt\b"#,
            #"\bNew\s+patient\b"#, #"\bOld\s+patient\b"#,
            #"\bERCP\b"#, #"\bColonoscopy\b"#, #"\bEndoscopy\b"#,
            #"\bGastroscopy\b"#, #"\bOGD\b"#, #"\bSurgery\b"#,
            #"\bClinic\b"#, #"\bFollow[- ]?[Uu]p\b"#,
            #"\bReview\b"#, #"\bTheatre\b"#, #"\bTheater\b"#,
            // Phone-number pattern: 6–11 digits
            #"\b\d{6,11}\b"#,
            // Parenthesised note: "(Princess…)"
            #"\(.*"#
        ]

        var name = raw
        for pattern in markerPatterns {
            if let range = name.range(of: pattern, options: [.regularExpression, .caseInsensitive]) {
                let candidate = String(name[..<range.lowerBound])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "—–-·"))
                    .trimmingCharacters(in: .whitespaces)
                if !candidate.isEmpty {
                    name = candidate
                    break
                }
            }
        }

        // Collapse multiple spaces and trim
        name = name.components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }
            .joined(separator: " ")

        return Parsed(name: name, setting: setting, appointmentType: appointmentType, isNew: isNew)
    }
}
