import SwiftUI
import SwiftData
import EventKit

struct TodayDashboardView: View {
    @Query private var allPatients: [Patient]
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var calSvc: CalendarService

    @State private var selectedPatient: Patient?
    @State private var showAdd = false
    @State private var showCalendarImport = false
    @State private var searchQuery = ""
    @State private var isRefreshing = false
    @State private var calEventActionTarget: EKEvent? = nil
    @State private var calEventActionPatient: Patient? = nil
    @State private var showCalEncounterSheet = false
    @State private var showPreConsultSheet = false
    @State private var showCalEventDialog = false

    private let cal = Calendar.current

    // MARK: - Patient groups (deduped via PatientDeduplication.swift)

    private var wardPatients: [Patient] {
        allPatients
            .filter { $0.setting == .inpatient || $0.setting == .emergency }
            .sorted { $0.acuity < $1.acuity }
            .deduped()
    }

    private var theatreToday: [Patient] {
        allPatients
            .filter { $0.setting == .theatre && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
            .deduped()
    }

    private var endoscopyToday: [Patient] {
        allPatients
            .filter { $0.setting == .endoscopy && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
            .deduped()
    }

    private var clinicToday: [Patient] {
        allPatients
            .filter { $0.setting == .outpatient && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
            .deduped()
    }

    private var highAcuityWard: [Patient] {
        wardPatients.filter { p in
            guard let v = p.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first
            else { return p.setting == .emergency }
            return v.news2Risk == "High" || v.news2HasRedFlag
        }
    }

    private var patientsWithNewResults: [Patient] {
        allPatients.deduped().filter { p in
            p.investigations.contains { $0.status == .resulted && !$0.result.isEmpty }
        }
    }

    private var readyForDoctorPatients: [Patient] {
        allPatients
            .filter { $0.encounterStatus == .waiting && isToday($0.checkInTime) }
            .sorted { ($0.checkInTime ?? .distantPast) < ($1.checkInTime ?? .distantPast) }
            .deduped()
    }

    // Calendar events from iOS EventKit (syncs with Google Calendar when
    // the user adds their Google account in iOS Settings → Calendar → Accounts)
    private var todayCalEvents: [EKEvent] {
        calSvc.events
            .filter { isToday($0.startDate) && !$0.isAllDay }
            .sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
    }

    private var isAnythingOn: Bool {
        !readyForDoctorPatients.isEmpty || !wardPatients.isEmpty ||
        !theatreToday.isEmpty || !endoscopyToday.isEmpty || !clinicToday.isEmpty ||
        !todayCalEvents.isEmpty
    }

    // Calendar events today that don't yet have a matching patient record
    private var unimportedCalEventCount: Int {
        let existingNames = Set(allTodayPatients.map { $0.fullName.lowercased().trimmingCharacters(in: .whitespaces) })
        return todayCalEvents.filter { event in
            guard let title = event.title, !title.isEmpty else { return false }
            let parsed = CalendarEventParser.parse(title: title, calLabel: event.calEntryLabel)
            return !parsed.name.isEmpty && !existingNames.contains(parsed.name.lowercased().trimmingCharacters(in: .whitespaces))
        }.count
    }

    // All today's patients in one flat list for search
    private var allTodayPatients: [Patient] {
        (readyForDoctorPatients + highAcuityWard + wardPatients +
         theatreToday + endoscopyToday + clinicToday)
            .reduce(into: [Patient]()) { acc, p in
                if !acc.contains(where: { $0.id == p.id }) { acc.append(p) }
            }
    }

    private var searchActive: Bool { !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty }

    private var searchResults: [Patient] {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        return allTodayPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.workingDiagnosis?.lowercased().contains(q) ?? false) ||
            ($0.chiefComplaint?.lowercased().contains(q) ?? false)
        }
    }

    // Total count for the day summary strip
    private var totalCount: Int { allTodayPatients.count }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            Group {
                if isAnythingOn || searchActive {
                    List {
                        // ── Day summary strip ───────────────────────────
                        if !searchActive {
                            Section {
                                daySummaryStrip
                            }
                            .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                            .listRowBackground(Color.clear)
                        }

                        // ── Search results (when active) ────────────────
                        if searchActive {
                            if searchResults.isEmpty {
                                Section {
                                    ContentUnavailableView.search(text: searchQuery)
                                }
                                .listRowBackground(Color.clear)
                            } else {
                                Section("Results for \"\(searchQuery.trimmingCharacters(in: .whitespaces))\"") {
                                    ForEach(searchResults) { patient in
                                        Button { selectedPatient = patient } label: {
                                            TodayPatientRow(patient: patient, style: rowStyle(for: patient))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        } else {
                            // ── Calendar import nudge ───────────────────
                            if unimportedCalEventCount > 0 {
                                calendarImportBanner
                            }
                            // ── Normal sections ─────────────────────────
                            if !readyForDoctorPatients.isEmpty { waitingSection }
                            if !highAcuityWard.isEmpty         { alertSection }
                            if !patientsWithNewResults.isEmpty { resultsSection }
                            if !wardPatients.isEmpty           { wardSection }
                            if !theatreToday.isEmpty   { theatreSection }
                            if !endoscopyToday.isEmpty { endoscopySection }
                            if !clinicToday.isEmpty    { clinicSection }
                            if !todayCalEvents.isEmpty { calendarSection }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .searchable(text: $searchQuery, placement: .navigationBarDrawer(displayMode: .automatic),
                                prompt: "Search today's patients…")
                    .refreshable {
                        isRefreshing = true
                        await calSvc.sync()
                        isRefreshing = false
                    }
                } else {
                    emptyState
                }
            }
            .navigationTitle("Today")
            .task { await calSvc.fetch() }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Text(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ToolbarItem(placement: .primaryAction) {
                    HStack(spacing: 4) {
                        Button {
                            showCalendarImport = true
                        } label: {
                            Image(systemName: "calendar.badge.plus")
                        }
                        Button { showAdd = true } label: { Image(systemName: "plus") }
                    }
                }
            }
            .sheet(item: $selectedPatient) { PatientDetailView(patient: $0) }
            .sheet(isPresented: $showAdd) { AddPatientView() }
            .sheet(isPresented: $showCalendarImport) {
                CalendarImportSheet(events: calSvc.events)
            }
            .confirmationDialog(
                calEventActionTarget?.title ?? "Appointment",
                isPresented: $showCalEventDialog,
                titleVisibility: .visible
            ) {
                if calEventActionPatient != nil {
                    Button("Enter Pre-Consult Questionnaire") {
                        showPreConsultSheet = true
                        calEventActionTarget = nil
                    }
                    Button("Start Encounter") {
                        showCalEncounterSheet = true
                        calEventActionTarget = nil
                    }
                    Button("Open Patient File") {
                        selectedPatient = calEventActionPatient
                        calEventActionTarget = nil
                    }
                } else {
                    Button("Enter Pre-Consult Questionnaire") {
                        if let event = calEventActionTarget {
                            calEventActionPatient = createAndInsertPatient(from: event)
                        }
                        showPreConsultSheet = true
                        calEventActionTarget = nil
                    }
                    Button("Import Patient Only") {
                        showCalendarImport = true
                        calEventActionTarget = nil
                    }
                }
                Button("Cancel", role: .cancel) { calEventActionTarget = nil; calEventActionPatient = nil }
            }
            .sheet(isPresented: $showCalEncounterSheet, onDismiss: { calEventActionPatient = nil }) {
                if let patient = calEventActionPatient {
                    ConsultationView(patient: patient)
                }
            }
            .sheet(isPresented: $showPreConsultSheet, onDismiss: { calEventActionPatient = nil }) {
                if let patient = calEventActionPatient {
                    PreConsultEntrySheet(patient: patient)
                }
            }
        }
    }

    // MARK: - Calendar import banner

    private var calendarImportBanner: some View {
        Section {
            Button {
                showCalendarImport = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 20))
                        .foregroundStyle(AMColor.accent)
                        .frame(width: 32)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(unimportedCalEventCount) patient\(unimportedCalEventCount == 1 ? "" : "s") in Google Calendar not yet added")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.primary)
                        Text("Tap to review and add today's appointments")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 6)
            }
            .buttonStyle(.plain)
            .listRowBackground(AMColor.accentLt.opacity(0.2))
        }
    }

    // MARK: - Day summary strip

    private var daySummaryStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if totalCount > 0 {
                    summaryTile(count: totalCount, label: "Total", icon: "person.2.fill", color: AMColor.accent)
                }
                if !readyForDoctorPatients.isEmpty {
                    summaryTile(count: readyForDoctorPatients.count, label: "Waiting", icon: "person.fill.checkmark", color: .orange)
                }
                if !highAcuityWard.isEmpty {
                    summaryTile(count: highAcuityWard.count, label: "Alerts", icon: "exclamationmark.triangle.fill", color: .red)
                }
                if !patientsWithNewResults.isEmpty {
                    summaryTile(count: patientsWithNewResults.count, label: "Results", icon: "flask.fill", color: .teal)
                }
                if !wardPatients.isEmpty {
                    summaryTile(count: wardPatients.count, label: "Ward", icon: "bed.double.fill", color: .teal)
                }
                if !theatreToday.isEmpty {
                    summaryTile(count: theatreToday.count, label: "Theatre", icon: "scalpel", color: .purple)
                }
                if !endoscopyToday.isEmpty {
                    summaryTile(count: endoscopyToday.count, label: "Scope", icon: "eye.circle.fill", color: .cyan)
                }
                if !clinicToday.isEmpty {
                    summaryTile(count: clinicToday.count, label: "Clinic", icon: "stethoscope", color: .indigo)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    private func summaryTile(count: Int, label: String, icon: String, color: Color) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                Text("\(count)")
                    .font(.system(size: 20, weight: .bold).monospacedDigit())
            }
            .foregroundStyle(color)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .frame(minWidth: 64)
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(color.opacity(0.18), lineWidth: 1))
    }

    // MARK: - Row style helper for search results

    private func rowStyle(for patient: Patient) -> TodayRowStyle {
        switch patient.setting {
        case .theatre:   return .theatre
        case .endoscopy: return .endoscopy
        case .outpatient: return .clinic
        default:         return .ward
        }
    }

}
