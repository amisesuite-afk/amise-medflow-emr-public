// FrontDeskPadView.swift
// iPad front-desk shell — roster, check-in, and questionnaire launch.

import SwiftUI
import SwiftData

import SwiftUI
import SwiftData
import PhotosUI

// MARK: - iPad front-desk shell (role: front_desk)
// Tabs: Check-In · Questionnaire · Schedule
// Patients are visible for demographics only — no clinical data.

struct FrontDeskPadView: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var calendarService: CalendarService
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @State private var selectedTab: FDTab = .checkIn

    private func badge(for tab: FDTab) -> Int {
        switch tab {
        case .theatre:   return allPatients.filter { $0.setting == .theatre }.deduped().count
        case .endoscopy: return allPatients.filter { $0.setting == .endoscopy }.deduped().count
        default:         return 0
        }
    }

    enum FDTab: String, CaseIterable {
        case checkIn       = "Check-In"
        case questionnaire = "Questionnaire"
        case theatre       = "Theatre"
        case endoscopy     = "Scope"
        case schedule      = "Schedule"

        var icon: String {
            switch self {
            case .checkIn:       "person.badge.plus"
            case .questionnaire: "list.clipboard"
            case .theatre:       "scissors"
            case .endoscopy:     "circle.dotted"
            case .schedule:      "calendar"
            }
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            // Left: icon sidebar (mirrors clinical app sidebar style)
            VStack(spacing: 0) {
                Spacer().frame(height: 24)

                Image("AppIconInline")
                    .resizable()
                    .frame(width: 32, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 7))
                    .padding(.bottom, 20)

                ForEach(FDTab.allCases, id: \.self) { tab in
                    let sel = selectedTab == tab
                    let n   = badge(for: tab)
                    Button { selectedTab = tab } label: {
                        ZStack(alignment: .topTrailing) {
                            VStack(spacing: 4) {
                                Image(systemName: tab.icon)
                                    .font(.system(size: 20, weight: sel ? .semibold : .regular))
                                Text(tab.rawValue)
                                    .font(.system(size: 8, weight: sel ? .bold : .semibold))
                                    .lineLimit(1)
                            }
                            .foregroundStyle(sel ? AMColor.accent : AMColor.sidebarText)
                            .frame(width: 80, height: 60)
                            .background { sel ? AMColor.accent.opacity(0.12) : Color.clear }
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                            if n > 0 {
                                Text("\(n)")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 5).padding(.vertical, 2)
                                    .background(Color.red, in: Capsule())
                                    .offset(x: -6, y: 6)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.bottom, 4)
                    .accessibilityIdentifier("fd.tab.\(tab.rawValue)")
                }

                Spacer()

                VStack(spacing: 4) {
                    SyncStatusBar()
                    Button {
                        Task { try? await sync.signOut() }
                    } label: {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.system(size: 18))
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .padding(.bottom, 16)
                }
            }
            .frame(width: 90)
            .background(AMColor.sidebarBg)

            Rectangle().fill(Color(.separator)).frame(width: 1)

            // Right: content area
            Group {
                switch selectedTab {
                case .checkIn:
                    FDCheckInView()
                case .questionnaire:
                    FDQuestionnaireView()
                case .theatre:
                    NavigationStack { TheatreListView() }
                case .endoscopy:
                    NavigationStack { EndoscopyListView() }
                case .schedule:
                    NavigationStack { ScheduleView() }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .ignoresSafeArea(edges: .bottom)
    }
}

// MARK: - Check-In tab
// Privacy (surgeon's requirement): the front-desk screen can be seen across the counter, so this
// tab never shows a browsable roster. Before any search it lists only today's patients — booked
// today (operationDate) or checked in today (checkInTime), in the practice time zone — with the
// name and time only (FrontDeskTodayList). Anyone else is found only by a real search: 3+ letters
// of the name or an MRN, at most 5 matches (QuestionnairePatientSearch). Acuity appears only on
// the selected row; the MRN on the selected row and on typed search results. The search is
// cleared when the tab disappears.

private struct FDCheckInView: View {
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }

    @State private var searchQuery = ""
    @State private var selectedPatient: Patient?
    @State private var showAddPatient = false

    private var trimmedQuery: String { QuestionnairePatientSearch.normalized(searchQuery) }
    private var isSearching: Bool { !trimmedQuery.isEmpty }

    private var todaysPatients: [Patient] { FrontDeskTodayList.todaysPatients(allPatients) }

    private var searchResults: [Patient] {
        QuestionnairePatientSearch.matches(query: searchQuery, in: allPatients)
    }

    private var listedPatients: [Patient] { isSearching ? searchResults : todaysPatients }

    /// The selected patient, only while the record is still live.
    private var liveSelection: Patient? {
        guard let p = selectedPatient, p.isLive else { return nil }
        return p
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                // ── Left column: search + today's list / search results ───────
                VStack(spacing: 0) {
                    // Explicit search bar — does NOT auto-focus on appear
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.secondary)
                            .font(.system(size: 14))
                        TextField("Name (3+ letters) or MRN…", text: $searchQuery)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        if !searchQuery.isEmpty {
                            Button { searchQuery = "" } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Clear search")
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Color(.secondarySystemBackground))

                    Divider()

                    if listedPatients.isEmpty {
                        emptyState
                    } else {
                        List {
                            Section {
                                ForEach(listedPatients) { patient in
                                    let isSelected = liveSelection?.persistentModelID == patient.persistentModelID
                                    Button { selectedPatient = patient } label: {
                                        HStack(spacing: 0) {
                                            FDPatientRow(patient: patient,
                                                         isSelected: isSelected,
                                                         showsMRN: isSelected || isSearching)
                                            Spacer(minLength: 4)
                                            Image(systemName: "chevron.right")
                                                .font(.system(size: 11, weight: .semibold))
                                                .foregroundStyle(.tertiary)
                                        }
                                    }
                                    .buttonStyle(.plain)
                                    .listRowBackground(
                                        isSelected
                                            ? AMColor.accent.opacity(0.12)
                                            : Color.clear
                                    )
                                }
                            } header: {
                                Text(isSearching ? "Search results" : "Today · booked or checked in")
                                    .font(.caption2).foregroundStyle(.tertiary).textCase(nil)
                            } footer: {
                                Text(isSearching
                                     ? "At most \(QuestionnairePatientSearch.maxResults) matches appear."
                                     : "For privacy, only today's patients are listed. Search to find anyone else.")
                                    .font(.caption2).foregroundStyle(.tertiary)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
                .frame(width: 300)

                Rectangle().fill(Color(.separator)).frame(width: 1)

                // ── Right panel: demographics ──────────────────────────────
                if let patient = liveSelection {
                    NavigationStack {
                        FDPatientDemographicsPanel(patient: patient)
                            .navigationTitle(patient.fullName)
                            .navigationBarTitleDisplayMode(.inline)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "hand.tap")
                            .font(.system(size: 48))
                            .foregroundStyle(.teal.opacity(0.45))
                        Text("Select a Patient")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text("Tap a patient on today's list, or search by name (3+ letters)\nor MRN, then tap their row to open their details here.")
                            .font(.subheadline)
                            .foregroundStyle(.tertiary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Check-In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddPatient = true } label: {
                        Label("New Patient", systemImage: "person.badge.plus")
                    }
                    .tint(AMColor.accent)
                }
            }
        }
        .sheet(isPresented: $showAddPatient) {
            AddPatientView(initialSetting: .outpatient)
        }
        .onDisappear {
            // Nothing typed here stays behind when staff leave the tab. The selected patient is
            // kept: the demographics panel may be presenting the questionnaire full screen,
            // which can make this tab disappear.
            searchQuery = ""
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            if !isSearching {
                Image(systemName: "calendar")
                    .font(.system(size: 36)).foregroundStyle(.tertiary)
                Text("No patients booked or checked in today")
                    .font(.subheadline).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Text("Search by name (3+ letters) or MRN to find anyone else.")
                    .font(.caption).foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            } else if QuestionnairePatientSearch.isNameSearch(trimmedQuery) {
                Text("No match. Check the spelling or use the MRN.")
                    .font(.subheadline).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button("Register New Patient") { showAddPatient = true }
                    .buttonStyle(.borderedProminent).tint(AMColor.accent)
            } else {
                Text("Type at least \(QuestionnairePatientSearch.minimumNameLength) letters of the name, or the MRN.")
                    .font(.subheadline).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
    }
}

/// One Check-In row: the name and today's time only. Acuity shows on the selected row only; the
/// MRN on the selected row and on typed search results (to tell same-name matches apart).
private struct FDPatientRow: View {
    let patient: Patient
    let isSelected: Bool
    let showsMRN: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                if isSelected {
                    AcuityPip(acuity: patient.acuity)
                }
                Text(patient.fullName)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
            }
            HStack(spacing: 6) {
                if let slot = FrontDeskTodayList.slot(for: patient) {
                    Label(FrontDeskTodayList.label(for: slot, timeZone: .ect),
                          systemImage: slot.kind == .appointment ? "clock" : "person.fill.checkmark")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                if showsMRN, let mrn = patient.mrn, !mrn.isEmpty {
                    Text("MRN \(mrn)")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(AMColor.accent)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Questionnaire tab
// Privacy (surgeon's requirement): this tab is next to the patient who is about to receive the
// iPad, so it never shows a browsable patient list. Names appear only after staff type a search
// (3+ letters of the name, or an MRN), at most 5 at a time (QuestionnairePatientSearch). The
// search is cleared when the questionnaire opens and when the tab disappears. The questionnaire
// itself opens in patient hand-over mode (.patientHandoverPresentation).

private struct FDQuestionnaireView: View {
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @State private var searchQuery = ""
    @State private var selectedPatient: Patient?
    @State private var showForm = false

    private var filteredPatients: [Patient] {
        QuestionnairePatientSearch.matches(query: searchQuery, in: allPatients)
    }

    private var trimmedQuery: String { QuestionnairePatientSearch.normalized(searchQuery) }

    private var searchHint: String {
        QuestionnairePatientSearch.isNameSearch(trimmedQuery)
            ? "No match. Check the spelling or use the MRN."
            : "Type at least \(QuestionnairePatientSearch.minimumNameLength) letters of the name, or the MRN."
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Name (3+ letters) or MRN…", text: $searchQuery)
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()
                            .accessibilityIdentifier("fd.questionnaire.search")

                        if !trimmedQuery.isEmpty && filteredPatients.isEmpty {
                            Text(searchHint)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        if !filteredPatients.isEmpty {
                            ForEach(filteredPatients) { patient in
                                Button {
                                    selectedPatient = patient
                                    showForm = true
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(patient.fullName)
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(.primary)
                                            if let mrn = patient.mrn, !mrn.isEmpty {
                                                Text("MRN \(mrn)")
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                        Spacer()
                                        Image(systemName: "list.clipboard")
                                            .foregroundStyle(AMColor.accent)
                                    }
                                    .contentShape(Rectangle())   // whole row tappable, not only its text
                                }
                                .buttonStyle(.plain)
                                .padding(.vertical, 4)
                                .accessibilityIdentifier("fd.questionnaire.result")
                            }
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                } header: {
                    Text("Find Patient")
                } footer: {
                    Text("For privacy, no patient list is shown. At most \(QuestionnairePatientSearch.maxResults) matches appear.")
                }

                Section {
                    Button {
                        selectedPatient = nil
                        showForm = true
                    } label: {
                        Label("Walk-In Questionnaire (no patient selected)", systemImage: "person.fill.questionmark")
                            .foregroundStyle(AMColor.accent)
                    }
                    .accessibilityIdentifier("fd.questionnaire.walkIn")
                } footer: {
                    Text("Use this when the patient hasn't been registered yet. After staff exit, you can attach the answers to their record.")
                }
            }
            .navigationTitle("Questionnaire")
            .navigationBarTitleDisplayMode(.inline)
        }
        .patientHandoverPresentation(isPresented: $showForm,
                                     patient: selectedPatient,
                                     entryPoint: .frontDeskTab)
        .onChange(of: showForm) { _, isOpen in
            if isOpen {
                // Nothing from the search stays behind the questionnaire.
                searchQuery = ""
            } else {
                selectedPatient = nil
            }
        }
        .onDisappear {
            searchQuery = ""
            // Keep the patient while the questionnaire is open (a full-screen cover can make
            // this tab disappear); it is cleared when the questionnaire closes.
            if !showForm { selectedPatient = nil }
        }
    }
}

// MARK: - Front-desk demographics panel (check-in gate + encounter actions)
// Named distinctly from the clinical PatientDemographicsForm in PatientDetailView.swift.
