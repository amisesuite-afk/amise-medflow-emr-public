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
                NavigationLink { ClinicalReasoningView(patient: patient) } label: {
                    HStack {
                        Label("Clinical Reasoning", systemImage: "brain.head.profile")
                        Spacer()
                        if !patient.investigations.filter({ $0.status == .ordered || $0.status == .pending }).isEmpty {
                            Image(systemName: "clock.badge.exclamationmark")
                                .font(.caption2).foregroundStyle(.orange)
                        }
                    }
                }
            }

            Section("Workflow") {
                NavigationLink { ConsultationWorkflowView(patient: patient) } label: {
                    HStack {
                        Label("Consultation Progress", systemImage: "checklist")
                        Spacer()
                        let doneCount = [
                            !(patient.chiefComplaint ?? "").isEmpty && patient.dateOfBirth != nil && !(patient.phone ?? "").isEmpty && !(patient.nokName ?? "").isEmpty,
                            !(patient.hpi ?? "").isEmpty && !(patient.pmhNotes ?? "").isEmpty,
                            [patient.examGeneral, patient.examCVS, patient.examResp, patient.examAbdo].compactMap({ $0 }).contains { !$0.isEmpty },
                            !patient.investigations.isEmpty,
                            patient.workingDiagnosis != nil,
                            !(patient.managementPlan ?? "").isEmpty || patient.clinicalNotes.contains { $0.status == .signed && !$0.isEmpty }
                        ].filter { $0 }.count
                        Text("\(doneCount)/6")
                            .font(.caption2)
                            .foregroundStyle(doneCount == 6 ? .green : .orange)
                    }
                }
                NavigationLink { IntakeTabView(patient: patient) } label: {
                    HStack {
                        Label("Intake Checklist", systemImage: "person.fill.badge.plus")
                        Spacer()
                        let missing = [patient.dateOfBirth == nil,
                                       (patient.phone ?? "").isEmpty,
                                       (patient.chiefComplaint ?? "").isEmpty,
                                       (patient.pmhNotes ?? "").isEmpty,
                                       (patient.nokName ?? "").isEmpty].filter { $0 }.count
                        if missing > 0 {
                            Text("\(missing) missing")
                                .font(.caption2).foregroundStyle(.orange)
                        } else {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption2).foregroundStyle(.green)
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

    var shortLabel: String {
        switch self {
        case .wardRounds:  "Ward"
        case .theatre:     "Theatre"
        case .endoscopy:   "Scope"
        case .outpatients: "OPD"
        }
    }
}

// MARK: - Root (adapts to size class)

struct ContentView: View {
    @EnvironmentObject private var sync: SyncService
    @Environment(\.horizontalSizeClass) private var hSizeClass

    var body: some View {
        Group {
            if hSizeClass == .compact {
                CompactRootView()
            } else {
                RegularRootView()
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { !sync.isSignedIn },
            set: { _ in }
        )) {
            LoginView()
                .environmentObject(sync)
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

// MARK: - iPad: custom 3-column HStack layout

private struct RegularRootView: View {
    @State private var selectedSection: AppSection = .wardRounds
    @State private var selectedPatient: Patient?
    @State private var showSettings = false

    var body: some View {
        HStack(spacing: 0) {
            // Column 1: Icon-only workflow nav
            iconSidebar
                .frame(width: 70)
                .ignoresSafeArea(edges: .vertical)

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(width: 0.5)
                .ignoresSafeArea(edges: .vertical)

            // Column 2: Compact patient list
            NavigationStack {
                SectionPatientListView(section: selectedSection,
                                       selectedPatient: $selectedPatient)
            }
            .frame(width: 240)

            Rectangle()
                .fill(Color(.separator))
                .frame(width: 0.5)
                .ignoresSafeArea(edges: .vertical)

            // Column 3: Clinical workspace — fills all remaining width
            if let patient = selectedPatient {
                PatientDetailPadView(patient: patient)
            } else {
                ContentUnavailableView(
                    "Select a Patient",
                    systemImage: "person.text.rectangle",
                    description: Text("Choose a patient from the list to view their record.")
                )
                .background(AMColor.bg)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .ignoresSafeArea(.keyboard)
        .sheet(isPresented: $showSettings) { SettingsView() }
    }

    // MARK: Icon-only sidebar

    private var iconSidebar: some View {
        VStack(spacing: 0) {
            // Compact app mark
            VStack(spacing: 3) {
                Image(systemName: "cross.case.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(AMColor.accent)
                Text("AMF")
                    .font(.system(size: 8, weight: .heavy))
                    .foregroundStyle(AMColor.sidebarText)
                    .tracking(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(height: 0.5)

            VStack(spacing: 2) {
                ForEach(AppSection.allCases) { section in
                    iconSidebarButton(section)
                }
            }
            .padding(.vertical, 10)

            Spacer()

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(height: 0.5)

            Button { showSettings = true } label: {
                VStack(spacing: 3) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 19))
                    Text("Settings")
                        .font(.system(size: 8, weight: .medium))
                }
                .foregroundStyle(AMColor.sidebarText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(AMColor.sidebarBg)
    }

    @ViewBuilder
    private func iconSidebarButton(_ section: AppSection) -> some View {
        let isSel = selectedSection == section
        Button { selectedSection = section } label: {
            VStack(spacing: 4) {
                Image(systemName: section.icon)
                    .font(.system(size: 20, weight: isSel ? .semibold : .regular))
                Text(section.shortLabel)
                    .font(.system(size: 8, weight: .medium))
                    .lineLimit(1)
            }
            .foregroundStyle(isSel ? AMColor.sidebarActive : AMColor.sidebarText)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(isSel ? AMColor.accent.opacity(0.15) : Color.clear,
                        in: RoundedRectangle(cornerRadius: 8))
            .overlay(alignment: .leading) {
                if isSel {
                    Capsule()
                        .fill(AMColor.accent)
                        .frame(width: 3, height: 28)
                }
            }
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.12), value: isSel)
        .padding(.horizontal, 6)
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
    @State private var locationFilter: ClinicalLocation? = nil

    private var basePatients: [Patient] {
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
        }
    }

    private var patients: [Patient] {
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
    private var presentLocations: [ClinicalLocation] {
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
        for i in offsets { context.delete(patients[i]) }
    }
}

#Preview {
    ContentView()
        .environmentObject(SyncService())
        .modelContainer(for: Patient.self, inMemory: true)
}
