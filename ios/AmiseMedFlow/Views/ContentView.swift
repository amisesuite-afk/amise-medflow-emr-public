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

    var body: some View {
        List {
            NavigationLink { ConsultationView(patient: patient) } label: {
                Label("Consultation", systemImage: "stethoscope")
            }
            NavigationLink { PrescriptionView(patient: patient) } label: {
                Label("Prescriptions (\(patient.prescriptions.count))", systemImage: "pills")
            }
            NavigationLink { BillingView(patient: patient) } label: {
                Label("Billing (\(patient.billingItems.count) codes)", systemImage: "dollarsign.circle")
            }
            NavigationLink { OperativePlanView(patient: patient) } label: {
                Label(operativePlanLabel, systemImage: "scissors")
            }
            NavigationLink { DocumentsView(patient: patient) } label: {
                Label("Documents (\(patient.documents.count))", systemImage: "doc.badge.plus")
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
                .tabItem { Label("Ward Rounds", systemImage: "bed.double") }
            TheatreListView()
                .tabItem { Label("Theatre", systemImage: "scissors") }
            EndoscopyListView()
                .tabItem { Label("Endoscopy", systemImage: "circle.dotted") }
            PatientListView()
                .tabItem { Label("Patients", systemImage: "person.crop.circle") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

// MARK: - iPad/Mac: 3-column NavigationSplitView

private struct RegularRootView: View {
    @State private var selectedSection: AppSection = .wardRounds
    @State private var selectedPatient: Patient?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(AppSection.allCases, selection: $selectedSection) { section in
                Label(section.rawValue, systemImage: section.icon)
            }
            .navigationTitle("Amise MedFlow")
            .safeAreaInset(edge: .bottom) {
                Divider()
                NavigationLink(destination: SettingsView()) {
                    Label("Settings", systemImage: "gearshape")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            }
        } content: {
            SectionPatientListView(section: selectedSection,
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
            }
        }
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
            ($0.chiefComplaint?.lowercased().contains(q) ?? false)
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
                List(selection: $selectedPatient) {
                    ForEach(patients) { patient in
                        sectionRow(patient)
                            .tag(patient)
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
        switch section {
        case .wardRounds:  WardPatientRow(patient: patient)
        case .theatre:     TheatreRow(patient: patient)
        case .endoscopy:   EndoscopyRow(patient: patient)
        case .outpatients: PatientRow(patient: patient)
        }
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
