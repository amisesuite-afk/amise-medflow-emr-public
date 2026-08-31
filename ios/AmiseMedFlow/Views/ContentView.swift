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

            // Procedure-specific forms (shown based on visitType)
            if let vt = patient.visitType {
                let showTrauma  = vt == .trauma
                let showOGD     = vt == .ogd || vt == .colonoscopy || vt == .dayOfSurgery
                let showSurgery = vt == .surgeryElective || vt == .surgeryEmergency || vt == .dayOfSurgery
                let showERCP    = vt == .ercp || vt == .dayOfSurgery

                if showTrauma || showOGD || showSurgery || showERCP {
                    Section("Procedure Forms") {
                        if showTrauma {
                            NavigationLink { TraumaAssessmentView(patient: patient) } label: {
                                Label("Trauma Assessment (ATLS)", systemImage: "cross.case.fill")
                                    .foregroundStyle(.red)
                            }
                        }
                        if showSurgery {
                            NavigationLink { SurgeryNoteView(patient: patient) } label: {
                                Label("Operative Note", systemImage: "scissors")
                            }
                        }
                        if showOGD {
                            NavigationLink { OGDFormView(patient: patient) } label: {
                                Label("OGD Report", systemImage: "scope")
                            }
                        }
                        if showERCP {
                            NavigationLink { ERCPFormView(patient: patient) } label: {
                                Label("ERCP Report", systemImage: "waveform.and.magnifyingglass")
                            }
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
    case schedule    = "Schedule"

    var id: String { rawValue }

    var isPatientSection: Bool { self != .schedule }

    var icon: String {
        switch self {
        case .wardRounds:  "bed.double"
        case .theatre:     "scissors"
        case .endoscopy:   "circle.dotted"
        case .outpatients: "person.crop.circle"
        case .schedule:    "calendar"
        }
    }

    var defaultSetting: ClinicalSetting {
        switch self {
        case .wardRounds:  .inpatient
        case .theatre:     .theatre
        case .endoscopy:   .endoscopy
        case .outpatients: .outpatient
        case .schedule:    .outpatient
        }
    }

    var emptyTitle: String {
        switch self {
        case .wardRounds:  "No inpatients"
        case .theatre:     "No theatre cases"
        case .endoscopy:   "No endoscopy cases"
        case .outpatients: "No patients"
        case .schedule:    "No upcoming events"
        }
    }

    var emptyDescription: String {
        switch self {
        case .wardRounds:  "Add an inpatient or emergency patient to begin."
        case .theatre:     "Add a theatre case to build the list."
        case .endoscopy:   "Add an endoscopy case to build the list."
        case .outpatients: "Add an outpatient to get started."
        case .schedule:    "Sync to load calendar events."
        }
    }

    var shortLabel: String {
        switch self {
        case .wardRounds:  "Ward"
        case .theatre:     "Theatre"
        case .endoscopy:   "Scope"
        case .outpatients: "OPD"
        case .schedule:    "Schedule"
        }
    }
}

// MARK: - Root (adapts to size class)

struct ContentView: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @Environment(\.modelContext) private var modelContext

    private var isPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }

    var body: some View {
        Group {
            if isPad {
                RegularRootView()
            } else {
                CompactRootView()
            }
        }
        .onAppear {
            // Inject context so cloud sync works even if Settings is never opened
            sync.setModelContext(modelContext)
            // Start peer-to-peer sync only if email is already resolved (cached session).
            // If nil, the onChange below will start it once restoreSession() finishes.
            if let email = sync.currentUserEmail, !email.isEmpty {
                peerSync.start(context: modelContext, email: email)
            }
        }
        .onChange(of: sync.currentUserEmail) { _, email in
            guard let email, !email.isEmpty else {
                // Sign-out path: clear storedEmail so restart() on next foreground
                // doesn't resume advertising under the old account's identity.
                peerSync.signOut()
                return
            }
            // Stop any session that may have started with an empty email hash,
            // then restart with the real address so peer matching is correct.
            peerSync.stop()
            peerSync.start(context: modelContext, email: email)
        }
        .fullScreenCover(isPresented: Binding(
            get: { !sync.isSignedIn },
            set: { _ in }
        )) {
            LoginView()
                .environmentObject(sync)
        }
        // Show AI/PHI consent gate once per installation, after sign-in
        .requireAIConsent()
    }
}

// MARK: - iPhone: tab view

private struct CompactRootView: View {
    var body: some View {
        TabView {
            TodayDashboardView()
                .tabItem { Label("Today", systemImage: "calendar.day.timeline.left") }
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
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @State private var selectedSection: AppSection = .outpatients
    @State private var selectedPatient: Patient?
    @State private var showSettings = false
    @State private var showDashboard = false

    // Count badges per patient section
    @Query private var allPatients: [Patient]

    private func count(for section: AppSection) -> Int {
        switch section {
        case .wardRounds:  allPatients.filter { $0.setting == .inpatient || $0.setting == .emergency }.count
        case .theatre:     allPatients.filter { $0.setting == .theatre }.count
        case .endoscopy:   allPatients.filter { $0.setting == .endoscopy }.count
        case .outpatients: allPatients.filter { $0.setting == .outpatient }.count
        case .schedule:    0
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            if selectedSection == .schedule {
                // Schedule fills the full remaining width
                NavigationStack { ScheduleView() }
                    .frame(maxWidth: .infinity)
            } else if let patient = selectedPatient {
                // Patient selected: full-width clinical workspace
                PatientDetailPadView(patient: patient, onBack: { selectedPatient = nil })
                    .frame(maxWidth: .infinity)
            } else {
                // No patient selected: patient list + empty state placeholder
                NavigationStack {
                    SectionPatientListView(section: selectedSection,
                                           selectedPatient: $selectedPatient)
                }
                .frame(width: 296)

                Rectangle()
                    .fill(Color(.separator))
                    .frame(width: 0.5)
                    .ignoresSafeArea(edges: .vertical)

                ContentUnavailableView(
                    "Select a Patient",
                    systemImage: "person.text.rectangle",
                    description: Text("Choose a patient from the list to view their record.")
                )
                .background(AMColor.bg)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(width: 0.5)
                .ignoresSafeArea(edges: .vertical)

            // Rightmost column: icon navigation sidebar
            iconSidebar
                .frame(width: 90)
                .ignoresSafeArea(edges: .vertical)
        }
        .ignoresSafeArea(.keyboard)
        .onChange(of: selectedSection) { _, _ in selectedPatient = nil }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showDashboard) {
            DashboardView()
                .environmentObject(sync)
                .environmentObject(peerSync)
        }
    }

    // MARK: Sidebar

    private var iconSidebar: some View {
        VStack(spacing: 0) {
            // App mark — tap for clinical dashboard
            Button { showDashboard = true } label: {
                VStack(spacing: 3) {
                    Image(systemName: "cross.case.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(AMColor.accent)
                    Text("AMF")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(AMColor.sidebarText)
                        .tracking(1.5)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
            }
            .buttonStyle(.plain)

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(height: 0.5)

            // Section buttons (patient sections + schedule)
            VStack(spacing: 2) {
                ForEach(AppSection.allCases) { section in
                    iconSidebarButton(section, count: count(for: section))
                }
            }
            .padding(.vertical, 10)

            Spacer()

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(height: 0.5)

            // Compact sync status in sidebar
            SyncStatusBar()
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(height: 0.5)

            Button { showSettings = true } label: {
                VStack(spacing: 4) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 21))
                    Text("Settings")
                        .font(.system(size: 10, weight: .medium))
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
    private func iconSidebarButton(_ section: AppSection, count: Int) -> some View {
        let isSel = selectedSection == section
        Button { selectedSection = section } label: {
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 4) {
                    Image(systemName: section.icon)
                        .font(.system(size: 22, weight: isSel ? .semibold : .regular))
                    Text(section.shortLabel)
                        .font(.system(size: 10, weight: .medium))
                        .lineLimit(1)
                }
                .foregroundStyle(isSel ? AMColor.sidebarActive : AMColor.sidebarText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(isSel ? AMColor.accent.opacity(0.15) : Color.clear,
                            in: RoundedRectangle(cornerRadius: 8))
                .overlay(alignment: .trailing) {
                    if isSel {
                        Capsule()
                            .fill(AMColor.accent)
                            .frame(width: 3, height: 28)
                    }
                }

                // Patient count badge
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(isSel ? AMColor.accent : Color.secondary.opacity(0.55), in: Capsule())
                        .offset(x: -6, y: 6)
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
        case .schedule:
            return []
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
                HStack {
                    SyncStatusBar()
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
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
        .environmentObject(PeerSyncService())
        .modelContainer(for: Patient.self, inMemory: true)
}
