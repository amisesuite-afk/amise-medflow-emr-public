// iPhoneFrontDeskView.swift
// iPhone simplified front desk check-in and waiting queue.

import SwiftUI
import SwiftData

// MARK: - iPhone front desk view (simplified check-in + waiting queue)

private struct CompactFrontDeskView: View {
    @EnvironmentObject private var sync: SyncService
    @Query private var allPatients: [Patient]
    @State private var searchQuery = ""
    @State private var selectedTab = 0

    private var theatreCount: Int {
        allPatients.filter { $0.setting == .theatre }.deduped().count
    }
    private var endoscopyCount: Int {
        allPatients.filter { $0.setting == .endoscopy }.deduped().count
    }

    private var filteredPatients: [Patient] {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty {
            // Show most-recent 30 patients when no query — never a blank screen
            return Array(allPatients.prefix(30))
        }
        return allPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.phone?.contains(q) ?? false)
        }.prefix(20).map { $0 }
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
    }

    private var checkInTab: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Search name, MRN, phone…", text: $searchQuery)
                        .autocorrectionDisabled()
                }
                if !filteredPatients.isEmpty {
                    Section("Results") {
                        ForEach(filteredPatients) { patient in
                            NavigationLink {
                                PatientDemographicsForm(patient: patient)
                                    .navigationTitle(patient.fullName)
                                    .navigationBarTitleDisplayMode(.inline)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack {
                                        AcuityPip(acuity: patient.acuity)
                                        Text(patient.fullName).font(.subheadline.weight(.semibold))
                                    }
                                    HStack(spacing: 4) {
                                        if let mrn = patient.mrn { Text("MRN \(mrn)").font(.caption2).foregroundStyle(AMColor.accent) }
                                        Text(patient.ageDisplay ?? "").font(.caption2).foregroundStyle(.secondary)
                                        Text(patient.sex.rawValue).font(.caption2).foregroundStyle(.secondary)
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                } else if !searchQuery.isEmpty {
                    Section {
                        NavigationLink {
                            AddPatientView(initialSetting: .outpatient)
                        } label: {
                            Label("Register New Patient", systemImage: "person.badge.plus")
                                .foregroundStyle(AMColor.accent)
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
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(patient.fullName).font(.subheadline.weight(.semibold))
                                    if let cc = patient.chiefComplaint {
                                        Text(cc).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                }
                                Spacer()
                                if let ct = patient.checkInTime {
                                    Text(DateFormatter.ectShort.string(from: ct))
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
