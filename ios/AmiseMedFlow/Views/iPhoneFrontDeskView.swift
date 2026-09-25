// iPhoneFrontDeskView.swift
// iPhone simplified front desk check-in and waiting queue.

import SwiftUI
import SwiftData

// MARK: - iPhone front desk view (simplified check-in + waiting queue)

struct CompactFrontDeskView: View {
    @EnvironmentObject private var sync: SyncService
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @State private var searchQuery = ""
    @State private var selectedTab = 0

    private var theatreCount: Int {
        allPatients.filter { $0.setting == .theatre }.deduped().count
    }
    private var endoscopyCount: Int {
        allPatients.filter { $0.setting == .endoscopy }.deduped().count
    }

    // Privacy (surgeon's requirement), same rule as the iPad Check-In tab: before any search only
    // today's patients (booked or checked in today, practice time zone) are listed, by name and
    // time (FrontDeskTodayList). Anyone else needs a real search: 3+ letters of the name or an MRN,
    // at most 5 matches (QuestionnairePatientSearch). The search is cleared when leaving the tab.
    private var trimmedQuery: String { QuestionnairePatientSearch.normalized(searchQuery) }
    private var isSearching: Bool { !trimmedQuery.isEmpty }

    private var todaysPatients: [Patient] { FrontDeskTodayList.todaysPatients(allPatients) }

    private var searchResults: [Patient] {
        QuestionnairePatientSearch.matches(query: searchQuery, in: allPatients)
    }

    private var searchHint: String {
        QuestionnairePatientSearch.isNameSearch(trimmedQuery)
            ? "No match. Check the spelling or use the MRN."
            : "Type at least \(QuestionnairePatientSearch.minimumNameLength) letters of the name, or the MRN."
    }

    private var waitingPatients: [Patient] {
        allPatients
            .filter { $0.encounterStatus == .waiting && Calendar.ect.isDateInToday($0.checkInTime ?? .distantPast) }
            .sorted { ($0.checkInTime ?? .distantPast) < ($1.checkInTime ?? .distantPast) }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            checkInTab
                .tabItem { Label("Check-In", systemImage: "person.badge.plus") }
                .tag(0)

            waitingTab
                .tabItem {
                    Label("Waiting", systemImage: "person.fill.checkmark")
                }
                .badge(waitingPatients.count)
                .tag(1)

            NavigationStack { TheatreListView() }
                .tabItem { Label("Theatre", systemImage: "scissors") }
                .badge(theatreCount)
                .tag(2)

            NavigationStack { EndoscopyListView() }
                .tabItem { Label("Scope", systemImage: "circle.dotted") }
                .badge(endoscopyCount)
                .tag(3)

            NavigationStack { ScheduleView() }
                .tabItem { Label("Schedule", systemImage: "calendar") }
                .tag(4)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(5)
        }
        .onChange(of: selectedTab) { oldTab, _ in
            // Nothing typed on the Check-In tab stays behind when staff leave it.
            if oldTab == 0 { searchQuery = "" }
        }
    }

    private var checkInTab: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Name (3+ letters) or MRN…", text: $searchQuery)
                        .autocorrectionDisabled()
                    if isSearching && searchResults.isEmpty {
                        Text(searchHint)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } footer: {
                    Text(isSearching
                         ? "At most \(QuestionnairePatientSearch.maxResults) matches appear."
                         : "For privacy, only today's patients are listed. Search to find anyone else.")
                }

                if isSearching {
                    if !searchResults.isEmpty {
                        Section("Results") {
                            ForEach(searchResults) { patient in
                                checkInLink(for: patient, showsMRN: true)
                            }
                        }
                    } else if QuestionnairePatientSearch.isNameSearch(trimmedQuery) {
                        Section {
                            NavigationLink {
                                AddPatientView(initialSetting: .outpatient)
                            } label: {
                                Label("Register New Patient", systemImage: "person.badge.plus")
                                    .foregroundStyle(AMColor.accent)
                            }
                        }
                    }
                } else {
                    Section("Today · booked or checked in") {
                        if todaysPatients.isEmpty {
                            Text("No patients booked or checked in today.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(todaysPatients) { patient in
                                checkInLink(for: patient, showsMRN: false)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Check-In")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        AddPatientView(initialSetting: .outpatient)
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
    }

    /// A Check-In row: name and today's time only. The MRN is added for typed search results;
    /// MRN, acuity and demographics are on the patient's own screen.
    private func checkInLink(for patient: Patient, showsMRN: Bool) -> some View {
        NavigationLink {
            PatientDemographicsForm(patient: patient)
                .navigationTitle(patient.fullName)
                .navigationBarTitleDisplayMode(.inline)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(patient.fullName).font(.subheadline.weight(.semibold))
                HStack(spacing: 6) {
                    if let slot = FrontDeskTodayList.slot(for: patient) {
                        Label(FrontDeskTodayList.label(for: slot, timeZone: .ect),
                              systemImage: slot.kind == .appointment ? "clock" : "person.fill.checkmark")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    if showsMRN, let mrn = patient.mrn, !mrn.isEmpty {
                        Text("MRN \(mrn)").font(.caption2).foregroundStyle(AMColor.accent)
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private var waitingTab: some View {
        NavigationStack {
            Group {
                if waitingPatients.isEmpty {
                    ContentUnavailableView(
                        "No patients waiting",
                        systemImage: "person.fill.checkmark",
                        description: Text("Patients checked in at the front desk will appear here.")
                    )
                } else {
                    List(waitingPatients) { patient in
                        NavigationLink {
                            PatientDemographicsForm(patient: patient)
                                .navigationTitle(patient.fullName)
                                .navigationBarTitleDisplayMode(.inline)
                        } label: {
                            // Name and arrival time only (front-desk privacy rule): no
                            // complaint or other clinical detail on a screen that can be seen.
                            HStack {
                                Text(patient.fullName).font(.subheadline.weight(.semibold))
                                Spacer()
                                if let ct = patient.checkInTime {
                                    Text(FrontDeskTodayList.timeText(ct, timeZone: .ect))
                                        .font(.caption2.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }
            .navigationTitle("Waiting (\(waitingPatients.count))")
        }
    }
}
