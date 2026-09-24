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

private struct FDCheckInView: View {
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @Environment(\.modelContext) private var context

    @State private var searchQuery = ""
    @State private var selectedPatient: Patient?
    @State private var showAddPatient = false

    private var filteredPatients: [Patient] {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return Array(allPatients.prefix(30)) }
        return allPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.phone?.lowercased().contains(q) ?? false)
        }.prefix(30).map { $0 }
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                // ── Left column: search + patient list ──────────────────────
                VStack(spacing: 0) {
                    // Explicit search bar — does NOT auto-focus on appear
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.secondary)
                            .font(.system(size: 14))
                        TextField("Search name, MRN or phone…", text: $searchQuery)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        if !searchQuery.isEmpty {
                            Button { searchQuery = "" } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Color(.secondarySystemBackground))

                    Divider()

                    if filteredPatients.isEmpty {
                        VStack(spacing: 12) {
                            Spacer()
                            if searchQuery.isEmpty {
                                Image(systemName: "person.crop.circle")
                                    .font(.system(size: 36)).foregroundStyle(.tertiary)
                                Text("No patients registered yet")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            } else {
                                Text("No match for \"\(searchQuery)\"")
                                    .font(.subheadline).foregroundStyle(.secondary)
                                Button("Register New Patient") { showAddPatient = true }
                                    .buttonStyle(.borderedProminent).tint(AMColor.accent)
                            }
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        List {
                            Section {
                                ForEach(filteredPatients) { patient in
                                    let isSelected = selectedPatient?.persistentModelID == patient.persistentModelID
                                    Button { selectedPatient = patient } label: {
                                        HStack(spacing: 0) {
                                            FDPatientRow(patient: patient)
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
                                Text("Tap a patient to open their details →")
                                    .font(.caption2).foregroundStyle(.tertiary).textCase(nil)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
                .frame(width: 300)

                Rectangle().fill(Color(.separator)).frame(width: 1)

                // ── Right panel: demographics ──────────────────────────────
                if let patient = selectedPatient {
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
                        Text("Use the search on the left to find a patient,\nthen tap their row to open their details here.")
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
    }
}

private struct FDPatientRow: View {
    let patient: Patient

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                AcuityPip(acuity: patient.acuity)
                Text(patient.fullName)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
            }
            HStack(spacing: 6) {
                if let mrn = patient.mrn, !mrn.isEmpty {
                    Text("MRN \(mrn)")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(AMColor.accent)
                }
                Text(patient.ageDisplay ?? "")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(patient.sex.rawValue)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if let phone = patient.phone, !phone.isEmpty {
                Text(phone)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Questionnaire tab

private struct FDQuestionnaireView: View {
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @State private var searchQuery = ""
    @State private var selectedPatient: Patient?
    @State private var showForm = false

    private var filteredPatients: [Patient] {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty { return Array(allPatients.prefix(30)) }
        return allPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.mrn?.lowercased().contains(q) ?? false)
        }.prefix(20).map { $0 }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Find Patient") {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Search name or MRN…", text: $searchQuery)
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()

                        if !filteredPatients.isEmpty {
                            ForEach(filteredPatients) { patient in
                                Button {
                                    selectedPatient = patient
                                    showForm = true
                                } label: {
                                    HStack {
                                        AcuityPip(acuity: patient.acuity)
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
                                }
                                .buttonStyle(.plain)
                                .padding(.vertical, 4)
                            }
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                }

                Section {
                    Button {
                        selectedPatient = nil
                        showForm = true
                    } label: {
                        Label("Walk-In Questionnaire (no patient selected)", systemImage: "person.fill.questionmark")
                            .foregroundStyle(AMColor.accent)
                    }
                } footer: {
                    Text("Use this when the patient hasn't been registered yet. You can attach the answers to their record later.")
                }
            }
            .navigationTitle("Questionnaire")
            .navigationBarTitleDisplayMode(.inline)
        }
        .sheet(isPresented: $showForm) {
            AdaptiveQuestionnaireSheet(patient: selectedPatient)
        }
    }
}

// MARK: - Front-desk demographics panel (check-in gate + encounter actions)
// Named distinctly from the clinical PatientDemographicsForm in PatientDetailView.swift.
