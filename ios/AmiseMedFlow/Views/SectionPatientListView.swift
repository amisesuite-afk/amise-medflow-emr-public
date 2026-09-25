// SectionPatientListView.swift
// Patient list for a given app section (iPad column 2).

import SwiftUI
import SwiftData

// MARK: - Patient list for a given section (iPad column 2)

struct SectionPatientListView: View {
    let section: AppSection
    @Binding var selectedPatient: Patient?
    @Query(sort: \Patient.createdAt, order: .reverse) private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @Environment(\.modelContext) private var context
    @State private var searchText = ""
    @State private var showAdd = false
    @State private var showDuplicateReview = false
    @State private var locationFilter: ClinicalLocation? = nil

    private var basePatients: [Patient] { sectionBase(from: allPatients) }

    private func sectionBase(from allPatients: [Patient]) -> [Patient] {
        switch section {
        case .wardRounds:
            return allPatients
                .filter { $0.setting == .inpatient || $0.setting == .emergency }
                .sorted { $0.acuity < $1.acuity }
        case .theatre:
            return allPatients.filter { $0.setting == .theatre }
        case .endoscopy:
            return allPatients.filter { $0.setting == .endoscopy }
        case .outpatients:
            return allPatients.filter { $0.setting == .outpatient }
        case .schedule:
            return []
        }
    }

    private var patients: [Patient] { filteredPatients(basePatients) }

    private func filteredPatients(_ basePatients: [Patient]) -> [Patient] {
        var base = basePatients
        if let loc = locationFilter { base = base.filter { $0.location == loc } }
        guard !searchText.isEmpty else { return base }
        let q = searchText.lowercased()
        return base.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.chiefComplaint?.lowercased().contains(q) ?? false) ||
            ($0.workingDiagnosis?.lowercased().contains(q) ?? false) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.phone?.contains(q) ?? false)
        }
    }

    // Locations that actually have patients in this section
    private func presentLocations(in basePatients: [Patient]) -> [ClinicalLocation] {
        let locs = Set(basePatients.map { $0.location })
        return ClinicalLocation.allCases.filter { locs.contains($0) }
    }

    private func locationColor(_ loc: ClinicalLocation) -> Color {
        switch loc {
        case .tapion:     return Color(hex: "#0891B2")
        case .rodney_bay: return Color(hex: "#7C3AED")
        case .okeu:       return Color(hex: "#DC2626")
        case .victoria:   return Color(hex: "#2563EB")
        case .other:      return Color.gray
        }
    }

    var body: some View {
        // Each list once per render: `basePatients` used to be rebuilt from all patients four or
        // five times per render (location chips, empty checks, the list), on every keystroke.
        let allPatients = self.allPatients
        let base = sectionBase(from: allPatients)
        let presentLocations = self.presentLocations(in: base)
        let patients = filteredPatients(base)
        VStack(spacing: 0) {
            // Location filter strip — only shows when >1 location present
            if presentLocations.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        locationChip(nil, label: "All")
                        ForEach(presentLocations, id: \.self) { loc in
                            locationChip(loc, label: loc.rawValue)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                .background(Color(.systemBackground))
                Divider()
            }

            Group {
                if patients.isEmpty && searchText.isEmpty && locationFilter == nil {
                    ContentUnavailableView(
                        section.emptyTitle,
                        systemImage: section.icon,
                        description: Text(section.emptyDescription)
                    )
                } else if patients.isEmpty {
                    ContentUnavailableView(
                        "No patients",
                        systemImage: "magnifyingglass",
                        description: Text("No patients match the current filter.")
                    )
                } else {
                    List {
                        if searchText.isEmpty {
                            DuplicatePatientsBanner(patients: allPatients, showReview: $showDuplicateReview)
                        }
                        ForEach(patients) { patient in
                            Button { selectedPatient = patient } label: {
                                PatientRow(patient: patient)
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(
                                selectedPatient?.id == patient.id
                                    ? Color(hex: patient.setting.accentHex).opacity(0.12)
                                    : Color(.systemBackground)
                            )
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
        }
        .navigationTitle(section.rawValue)
        .searchable(text: $searchText, prompt: "Search name or complaint")
        .onAppear { CrashReporting.breadcrumb("Opened \(section.rawValue) list") }
        .task {
            let current = self.allPatients
            for p in current where p.mrn == nil || p.mrn?.isEmpty == true {
                MRNGenerator.backfillIfNeeded(p, existing: current)
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                HStack {
                    SyncStatusBar()
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
        }
        .sheet(isPresented: $showDuplicateReview) { DuplicatePatientsSheet() }
        .sheet(isPresented: $showAdd) {
            QuickAddSheet(section: section)
        }
    }

    @ViewBuilder
    private func locationChip(_ loc: ClinicalLocation?, label: String) -> some View {
        let isSelected = locationFilter == loc
        let color: Color = loc.map { locationColor($0) } ?? AMColor.accent
        Button { locationFilter = isSelected ? nil : loc } label: {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(isSelected ? .white : color)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(isSelected ? color : color.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.12), value: isSelected)
    }

    private func delete(at offsets: IndexSet) {
        for i in offsets { context.deletePatient(patients[i]) }
    }
}

#Preview {
    ContentView()
        .environmentObject(SyncService())
        .environmentObject(PeerSyncService())
        .modelContainer(for: Patient.self, inMemory: true)
}
