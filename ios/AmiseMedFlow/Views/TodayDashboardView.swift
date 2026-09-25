import SwiftUI
import SwiftData
import EventKit

struct TodayDashboardView: View {
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @Environment(\.modelContext) var context
    @EnvironmentObject var calSvc: CalendarService

    @State var selectedPatient: Patient?
    @State var showAdd = false
    @State var showCalendarImport = false
    @State private var searchQuery = ""
    @State private var isRefreshing = false
    @State var calEventActionTarget: EKEvent? = nil
    @State var calEventActionPatient: Patient? = nil
    // Patient whose consultation was started from a calendar appointment
    // (full screen on iPad, sheet on iPhone; see consultationPresentation).
    @State private var calEncounterPatient: Patient? = nil
    @State private var showPreConsultSheet = false
    @State private var showStorageBlocked = false
    @State var showCalEventDialog = false
    /// Accessibility text sizes stack row details vertically (TodayDashboardView+Sections).
    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    let cal = Calendar.current

    // MARK: - Patient groups (deduped via PatientDeduplication.swift)
    // Built once per render in `body` (TodayDashboardBoard.swift) and passed to every section.

    func makeBoard() -> TodayBoard {
        TodayBoard(patients: allPatients, events: calSvc.events, calendar: cal)
    }

    var searchActive: Bool { !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty }

    func searchResults(_ board: TodayBoard) -> [Patient] {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        return board.allToday.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.workingDiagnosis?.lowercased().contains(q) ?? false) ||
            ($0.chiefComplaint?.lowercased().contains(q) ?? false)
        }
    }

    // MARK: - Body

    var body: some View {
        let board = makeBoard()
        NavigationStack {
            Group {
                if board.isAnythingOn || searchActive {
                    List {
                        // ── Day summary strip ───────────────────────────
                        if !searchActive {
                            Section {
                                daySummaryStrip(board)
                            }
                            .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                            .listRowBackground(Color.clear)
                        }

                        // ── Search results (when active) ────────────────
                        if searchActive {
                            let results = searchResults(board)
                            if results.isEmpty {
                                Section {
                                    ContentUnavailableView.search(text: searchQuery)
                                }
                                .listRowBackground(Color.clear)
                            } else {
                                Section("Results for \"\(searchQuery.trimmingCharacters(in: .whitespaces))\"") {
                                    ForEach(results) { patient in
                                        Button { selectedPatient = patient } label: {
                                            TodayPatientRow(patient: patient, style: rowStyle(for: patient))
                                                .contentShape(Rectangle())   // whole row tappable, not only its text
                                        }
                                        .buttonStyle(.plain)
                                        .accessibilityIdentifier("today.patientRow")
                                    }
                                }
                            }
                        } else {
                            // ── Calendar import nudge ───────────────────
                            if board.unimportedCalEventCount > 0 {
                                calendarImportBanner(count: board.unimportedCalEventCount)
                            }
                            // ── Normal sections ─────────────────────────
                            if !board.readyForDoctor.isEmpty { waitingSection(board.readyForDoctor) }
                            if !board.highAcuityWard.isEmpty { alertSection(board) }
                            if !board.withNewResults.isEmpty { resultsSection(board) }
                            if !board.ward.isEmpty           { wardSection(board.ward) }
                            if !board.theatre.isEmpty   { theatreSection(board.theatre) }
                            if !board.endoscopy.isEmpty { endoscopySection(board.endoscopy) }
                            if !board.clinic.isEmpty    { clinicSection(board.clinic) }
                            if !board.calendarEvents.isEmpty { calendarSection(board.calendarEvents) }
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
                    emptyState(unimportedCalEventCount: board.unimportedCalEventCount)
                }
            }
            .navigationTitle("Today")
            .onAppear { CrashReporting.breadcrumb("Opened Today dashboard") }
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
                        .accessibilityLabel("Add patients from calendar")
                        Button { showAdd = true } label: { Image(systemName: "plus") }
                            .accessibilityLabel("Add patient")
                            .accessibilityIdentifier("today.addPatient")
                    }
                }
            }
            .patientRecordPresentation(item: $selectedPatient)
            .sheet(isPresented: $showAdd) { AddPatientView() }
            .storeWriteBlockedAlert(isPresented: $showStorageBlocked)
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
                        calEncounterPatient = calEventActionPatient
                        calEventActionTarget = nil
                    }
                    Button("Open Patient File") {
                        selectedPatient = calEventActionPatient
                        calEventActionTarget = nil
                    }
                } else {
                    Button("Enter Pre-Consult Questionnaire") {
                        // In-memory store: a new patient would be lost on quit (StoreHealth.swift).
                        guard !StoreHealth.blocksNewClinicalData else {
                            calEventActionTarget = nil
                            showStorageBlocked = true
                            return
                        }
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
            .consultationPresentation(item: $calEncounterPatient,
                                      onDismiss: { calEventActionPatient = nil })
            .sheet(isPresented: $showPreConsultSheet, onDismiss: { calEventActionPatient = nil }) {
                if let patient = calEventActionPatient {
                    PreConsultEntrySheet(patient: patient)
                }
            }
        }
    }

    // MARK: - Calendar import banner

    func calendarImportBanner(count unimportedCalEventCount: Int) -> some View {
        Section {
            Button {
                showCalendarImport = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "calendar.badge.plus")
                        .scaledFont(size: 20)
                        .foregroundStyle(AMColor.accent)
                        .frame(width: 32)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(unimportedCalEventCount) patient\(unimportedCalEventCount == 1 ? "" : "s") in Google Calendar not yet added")
                            .scaledFont(size: 14, weight: .semibold)
                            .foregroundStyle(.primary)
                        Text("Tap to review and add today's appointments")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .scaledFont(size: 12, weight: .semibold)
                        .foregroundStyle(.tertiary)
                        .accessibilityHidden(true)
                }
                .padding(.vertical, 6)
                .accessibilityElement(children: .combine)
                .contentShape(Rectangle())   // whole row tappable, not only its text
            }
            .buttonStyle(.plain)
            .listRowBackground(AMColor.accentLt.opacity(0.2))
        }
    }

    // MARK: - Day summary strip

    func daySummaryStrip(_ board: TodayBoard) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if board.totalCount > 0 {
                    summaryTile(count: board.totalCount, label: "Total", icon: "person.2.fill", color: AMColor.accent)
                }
                if !board.readyForDoctor.isEmpty {
                    summaryTile(count: board.readyForDoctor.count, label: "Waiting", icon: "person.fill.checkmark", color: .orange)
                }
                if !board.highAcuityWard.isEmpty {
                    summaryTile(count: board.highAcuityWard.count, label: "Alerts", icon: "exclamationmark.triangle.fill", color: .red)
                }
                if !board.withNewResults.isEmpty {
                    summaryTile(count: board.withNewResults.count, label: "Results", icon: "flask.fill", color: .teal)
                }
                if !board.ward.isEmpty {
                    summaryTile(count: board.ward.count, label: "Ward", icon: "bed.double.fill", color: .teal)
                }
                if !board.theatre.isEmpty {
                    summaryTile(count: board.theatre.count, label: "Theatre", icon: "scalpel", color: .purple)
                }
                if !board.endoscopy.isEmpty {
                    summaryTile(count: board.endoscopy.count, label: "Scope", icon: "eye.circle.fill", color: .cyan)
                }
                if !board.clinic.isEmpty {
                    summaryTile(count: board.clinic.count, label: "Clinic", icon: "stethoscope", color: .indigo)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    func summaryTile(count: Int, label: String, icon: String, color: Color) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .scaledFont(size: 11, weight: .semibold)
                Text("\(count)")
                    .scaledFont(size: 20, weight: .bold, monospacedDigit: true)
            }
            .foregroundStyle(color)
            Text(label)
                .scaledFont(size: 10, weight: .medium)
                .foregroundStyle(.secondary)
        }
        // Tiles sit in a horizontal scroll strip, so they can grow; beyond accessibility3 the
        // count alone would fill the screen.
        .dynamicTypeSize(...DynamicTypeSize.accessibility3)
        .frame(minWidth: 64)
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(color.opacity(0.18), lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("\(label): \(count)"))
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
