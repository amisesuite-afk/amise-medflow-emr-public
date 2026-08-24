import SwiftUI
import SwiftData

// MARK: - Shared colour helper

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: Double
        switch hex.count {
        case 6:
            (r, g, b) = (Double((int >> 16) & 0xFF) / 255,
                         Double((int >> 8)  & 0xFF) / 255,
                         Double( int        & 0xFF) / 255)
        default:
            (r, g, b) = (1, 1, 1)
        }
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Shared acuity indicator

struct AcuityPip: View {
    let acuity: Acuity
    var body: some View {
        Circle()
            .fill(Color(hex: acuity.color))
            .frame(width: 10, height: 10)
    }
}

// MARK: - ClinicalHubView (iPhone: sub-navigation list within clinical tab)

struct ClinicalHubView: View {
    @Bindable var patient: Patient

    private var operativePlanLabel: String {
        let plan = patient.operativePlans.sorted { $0.updatedAt > $1.updatedAt }.first
        guard let plan else { return "Operative Plan" }
        return "Operative Plan (\(plan.whoCompletedCount)/\(plan.whoTotalCount))"
    }

    private var unsignedDraftCount: Int {
        patient.clinicalNotes.filter { $0.status == .draft && !$0.isEmpty }.count
    }

    private var pendingInvCount: Int {
        patient.investigations.filter { $0.status == .ordered || $0.status == .pending }.count
    }

    var body: some View {
        List {
            Section("Assess") {
                NavigationLink { AssessmentView(patient: patient) } label: {
                    HStack {
                        Label("Assessment", systemImage: "stethoscope")
                        Spacer()
                        if let dx = patient.workingDiagnosis {
                            Text(dx)
                                .font(.caption2)
                                .foregroundStyle(.teal)
                                .lineLimit(1)
                        }
                    }
                }
                NavigationLink { ConsultationView(patient: patient) } label: {
                    HStack {
                        Label("Consultation", systemImage: "cross.case")
                        Spacer()
                        let (filled, total) = patient.consultationCompleteness
                        if filled < total {
                            Text("\(filled)/\(total)")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        }
                    }
                }
            }

            Section("Manage") {
                NavigationLink { PrescriptionView(patient: patient) } label: {
                    HStack {
                        Label("Prescriptions", systemImage: "pills")
                        Spacer()
                        if patient.prescriptions.count > 0 {
                            Text("\(patient.prescriptions.count)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                NavigationLink { BillingView(patient: patient) } label: {
                    HStack {
                        Label("Billing", systemImage: "dollarsign.circle")
                        Spacer()
                        if patient.billingItems.count > 0 {
                            Text("\(patient.billingItems.count) codes")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                if patient.setting == .theatre || patient.setting == .endoscopy || !patient.operativePlans.isEmpty {
                    NavigationLink { OperativePlanView(patient: patient) } label: {
                        HStack {
                            Label("Operative Plan", systemImage: "scissors")
                            Spacer()
                            let plan = patient.operativePlans.sorted { $0.updatedAt > $1.updatedAt }.first
                            if let p = plan {
                                Text("\(p.whoCompletedCount)/\(p.whoTotalCount)")
                                    .font(.caption2)
                                    .foregroundStyle(p.whoCompletedCount == p.whoTotalCount ? .green : .orange)
                            }
                        }
                    }
                }
                NavigationLink { DocumentsView(patient: patient) } label: {
                    HStack {
                        Label("Documents", systemImage: "doc.badge.plus")
                        Spacer()
                        if patient.documents.count > 0 {
                            Text("\(patient.documents.count)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            if unsignedDraftCount > 0 {
                Section {
                    HStack(spacing: 8) {
                        Image(systemName: "pencil.circle.fill")
                            .foregroundStyle(.orange)
                        Text("\(unsignedDraftCount) unsigned draft\(unsignedDraftCount == 1 ? "" : "s") — go to Notes tab to sign")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
            }

            if pendingInvCount > 0 {
                Section {
                    HStack(spacing: 8) {
                        Image(systemName: "clock.badge.exclamationmark")
                            .foregroundStyle(.orange)
                        Text("\(pendingInvCount) investigation\(pendingInvCount == 1 ? "" : "s") awaiting results")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
            }
        }
        .navigationTitle("Clinical")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - App section enum (iPad/Mac sidebar)

enum AppSection: String, CaseIterable, Hashable, Identifiable {
    case wardRounds  = "Ward Rounds"
    case theatre     = "Theatre"
    case endoscopy   = "Endoscopy"
    case outpatients = "Patients"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .wardRounds:  "bed.double"
        case .theatre:     "scissors"
        case .endoscopy:   "circle.dotted"
        case .outpatients: "person.crop.circle"
        }
    }

    var defaultSetting: ClinicalSetting {
        switch self {
        case .wardRounds:  .inpatient
        case .theatre:     .theatre
        case .endoscopy:   .endoscopy
        case .outpatients: .outpatient
        }
    }

    var emptyTitle: String {
        switch self {
        case .wardRounds:  "No inpatients"
        case .theatre:     "No theatre cases"
        case .endoscopy:   "No endoscopy cases"
        case .outpatients: "No patients"
        }
    }

    var emptyDescription: String {
        switch self {
        case .wardRounds:  "Add an inpatient or emergency patient to begin."
        case .theatre:     "Add a theatre case to build the list."
        case .endoscopy:   "Add an endoscopy case to build the list."
        case .outpatients: "Add an outpatient to get started."
        }
    }
}

// MARK: - Root (adapts to size class)

struct ContentView: View {
    @EnvironmentObject private var sync: SyncService
    @Environment(\.horizontalSizeClass) private var hSizeClass

    var body: some View {
        if hSizeClass == .compact {
            CompactRootView()
        } else {
            RegularRootView()
        }
    }
}

// MARK: - iPhone: tab view

private struct CompactRootView: View {
    var body: some View {
        TabView {
            WardRoundView()
                .tabItem { Label("Ward", systemImage: "bed.double") }
            ScheduleView()
                .tabItem { Label("Schedule", systemImage: "calendar") }
            PatientListView()
                .tabItem { Label("Patients", systemImage: "person.crop.circle") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

// MARK: - iPad/Mac: 3-column NavigationSplitView

private struct RegularRootView: View {
    @State private var selectedSection: AppSection? = .wardRounds
    @State private var selectedPatient: Patient?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var showSettings = false

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            sidebarColumn
        } content: {
            SectionPatientListView(section: selectedSection ?? .wardRounds,
                                   selectedPatient: $selectedPatient)
        } detail: {
            if let patient = selectedPatient {
                PatientDetailPadView(patient: patient)
            } else {
                ContentUnavailableView(
                    "Select a Patient",
                    systemImage: "person.text.rectangle",
                    description: Text("Choose a patient from the list to view their record.")
                )
                    .background(AMColor.bg)
            }
        }
    }

    // MARK: Dark sidebar — mirrors web #071714 sidebar

    @ViewBuilder
    private func sectionBackground(_ section: AppSection) -> some View {
        if selectedSection == section {
            AMColor.accent.opacity(0.14)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(AMColor.accent)
                        .frame(width: 3)
                }
        } else {
            Color.clear
        }
    }

    private var sidebarColumn: some View {
        List(selection: $selectedSection) {
            Section {
                ForEach(AppSection.allCases) { section in
                    AppSectionRow(section: section,
                                  isSelected: selectedSection == section)
                        .tag(section)
                        .listRowBackground(sectionBackground(section))
                        .listRowInsets(EdgeInsets())
                }
            } header: {
                Text("Clinical Workflow")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(AMColor.sidebarGroup)
                    .tracking(0.1 * 10)
                    .padding(.top, 4)
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(AMColor.sidebarBg)
        .navigationTitle("Amise MedFlow")
        .toolbarBackground(AMColor.sidebarHd, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .sheet(isPresented: $showSettings) { SettingsView() }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Divider().overlay(AMColor.sidebarGroup)
            Button { showSettings = true } label: {
                Label("Settings", systemImage: "gearshape")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AMColor.sidebarText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.plain)
            .background(AMColor.sidebarBg)
        }
    }
}

// MARK: - Sidebar section row

private struct AppSectionRow: View {
    let section: AppSection
    let isSelected: Bool

    var body: some View {
        Label {
            Text(section.rawValue)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isSelected ? AMColor.sidebarActive : AMColor.sidebarText)
        } icon: {
            Image(systemName: section.icon)
                .foregroundStyle(isSelected ? AMColor.sidebarActive : AMColor.sidebarText)
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Patient list for a given section (iPad column 2)

struct SectionPatientListView: View {
    let section: AppSection
    @Binding var selectedPatient: Patient?
    @Query(sort: \Patient.createdAt, order: .reverse) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context
    @State private var searchText = ""
    @State private var showAdd = false

    private var patients: [Patient] {
        let base: [Patient]
        switch section {
        case .wardRounds:
            base = allPatients
                .filter { $0.setting == .inpatient || $0.setting == .emergency }
                .sorted { $0.acuity < $1.acuity }
        case .theatre:
            base = allPatients.filter { $0.setting == .theatre }
        case .endoscopy:
            base = allPatients.filter { $0.setting == .endoscopy }
        case .outpatients:
            base = allPatients.filter { $0.setting == .outpatient }
        }
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

    var body: some View {
        Group {
            if patients.isEmpty && searchText.isEmpty {
                ContentUnavailableView(
                    section.emptyTitle,
                    systemImage: section.icon,
                    description: Text(section.emptyDescription)
                )
            } else {
                List {
                    ForEach(patients) { patient in
                        Button { selectedPatient = patient } label: {
                            sectionRow(patient)
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
        .navigationTitle(section.rawValue)
        .searchable(text: $searchText, prompt: "Search name or complaint")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) {
            AddPatientView(initialSetting: section.defaultSetting)
        }
    }

    @ViewBuilder
    private func sectionRow(_ patient: Patient) -> some View {
        PatientRow(patient: patient)
    }

    private func delete(at offsets: IndexSet) {
        for i in offsets { context.delete(patients[i]) }
    }
}

#Preview {
    ContentView()
        .environmentObject(SyncService())
        .modelContainer(for: Patient.self, inMemory: true)
}
