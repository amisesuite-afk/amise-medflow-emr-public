import SwiftUI
import SwiftData

// MARK: - iPad front-desk shell (role: front_desk)
// Tabs: Check-In · Questionnaire · Schedule
// Patients are visible for demographics only — no clinical data.

struct FrontDeskPadView: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var calendarService: CalendarService
    @State private var selectedTab: FDTab = .checkIn

    enum FDTab: String, CaseIterable {
        case checkIn       = "Check-In"
        case questionnaire = "Questionnaire"
        case schedule      = "Schedule"

        var icon: String {
            switch self {
            case .checkIn:       "person.badge.plus"
            case .questionnaire: "list.clipboard"
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
                    Button { selectedTab = tab } label: {
                        VStack(spacing: 4) {
                            Image(systemName: tab.icon)
                                .font(.system(size: 20, weight: sel ? .semibold : .regular))
                            Text(tab.rawValue)
                                .font(.system(size: 8, weight: sel ? .bold : .semibold))
                                .lineLimit(1)
                        }
                        .foregroundStyle(sel ? AMColor.accent : AMColor.sidebarText)
                        .frame(width: 80, height: 60)
                        .background(sel ? AMColor.accent.opacity(0.12) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
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
    @Query private var allPatients: [Patient]
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
                // Patient list
                List(selection: $selectedPatient) {
                    if filteredPatients.isEmpty && !searchQuery.isEmpty {
                        VStack(spacing: 12) {
                            Text("No patient found for \"\(searchQuery)\"")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Button("Register New Patient") { showAddPatient = true }
                                .buttonStyle(.borderedProminent)
                                .tint(AMColor.accent)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                        .listRowBackground(Color.clear)
                    } else {
                        ForEach(filteredPatients) { patient in
                            FDPatientRow(patient: patient)
                                .tag(patient as Patient?)
                        }
                    }
                }
                .listStyle(.plain)
                .searchable(text: $searchQuery, prompt: "Search name, MRN, phone…")
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
                .frame(width: 300)

                Rectangle().fill(Color(.separator)).frame(width: 1)

                // Demographics panel
                if let patient = selectedPatient {
                    NavigationStack {
                        PatientDemographicsForm(patient: patient)
                            .navigationTitle(patient.fullName)
                            .navigationBarTitleDisplayMode(.inline)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    ContentUnavailableView(
                        "Select a Patient",
                        systemImage: "person.crop.circle",
                        description: Text("Search and tap a patient to view or edit their demographics.")
                    )
                    .frame(maxWidth: .infinity)
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
    @Query private var allPatients: [Patient]
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

// MARK: - Patient demographics form (front desk: demographics + check-in gate)

struct PatientDemographicsForm: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var calendarService: CalendarService

    @State private var showScheduler = false
    @State private var showQuestionnaire = false
    @State private var showMailComposer = false
    @State private var showSMSComposer = false

    var body: some View {
        Form {
            Section {
                encounterStatusRow
            } header: {
                Label("Encounter", systemImage: "person.badge.clock")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
            }

            Section {
                LabeledContent("Full Name") {
                    TextField("Required", text: $patient.fullName)
                        .multilineTextAlignment(.trailing)
                }
                Picker("Sex", selection: $patient.sex) {
                    ForEach(Sex.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                dobRow
            } header: {
                Label("Identity", systemImage: "person.crop.rectangle")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
            }

            Section {
                TextField("Phone", text: Binding(
                    get: { patient.phone ?? "" },
                    set: { patient.phone = $0.isEmpty ? nil : $0 }))
                    .keyboardType(.phonePad)
                TextField("Email", text: Binding(
                    get: { patient.email ?? "" },
                    set: { patient.email = $0.isEmpty ? nil : $0 }))
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                TextField("Address", text: Binding(
                    get: { patient.address ?? "" },
                    set: { patient.address = $0.isEmpty ? nil : $0 }))
            } header: {
                Label("Contact", systemImage: "phone")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
            }

            Section {
                TextField("MRN", text: Binding(
                    get: { patient.mrn ?? "" },
                    set: { patient.mrn = $0.isEmpty ? nil : $0 }))
                TextField("Chief complaint", text: Binding(
                    get: { patient.chiefComplaint ?? "" },
                    set: { patient.chiefComplaint = $0.isEmpty ? nil : $0 }))
                Picker("Visit type", selection: $patient.visitType) {
                    Text("Not set").tag(Optional<VisitType>.none)
                    ForEach(VisitType.allCases, id: \.self) { vt in
                        Text(vt.rawValue).tag(Optional(vt))
                    }
                }
            } header: {
                Label("Administration", systemImage: "doc.text")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
            }

            Section {
                TextField("Name", text: Binding(
                    get: { patient.nokName ?? "" },
                    set: { patient.nokName = $0.isEmpty ? nil : $0 }))
                TextField("Relation", text: Binding(
                    get: { patient.nokRelation ?? "" },
                    set: { patient.nokRelation = $0.isEmpty ? nil : $0 }))
                TextField("Phone", text: Binding(
                    get: { patient.nokPhone ?? "" },
                    set: { patient.nokPhone = $0.isEmpty ? nil : $0 }))
                    .keyboardType(.phonePad)
            } header: {
                Label("Next of Kin", systemImage: "person.2")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
            }

            Section {
                TextField("Provider", text: Binding(
                    get: { patient.insuranceProvider ?? "" },
                    set: { patient.insuranceProvider = $0.isEmpty ? nil : $0 }))
                TextField("Policy number", text: Binding(
                    get: { patient.policyNumber ?? "" },
                    set: { patient.policyNumber = $0.isEmpty ? nil : $0 }))
            } header: {
                Label("Insurance", systemImage: "shield")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
            }
        }
        .onChange(of: patient.fullName)           { _, _ in markDirty() }
        .onChange(of: patient.sex)                { _, _ in markDirty() }
        .onChange(of: patient.dateOfBirth)        { _, _ in markDirty() }
        .onChange(of: patient.phone)              { _, _ in markDirty() }
        .onChange(of: patient.email)              { _, _ in markDirty() }
        .onChange(of: patient.mrn)                { _, _ in markDirty() }
        .onChange(of: patient.chiefComplaint)     { _, _ in markDirty() }
        .onChange(of: patient.visitType)          { _, _ in markDirty() }
        .onChange(of: patient.nokName)            { _, _ in markDirty() }
        .onChange(of: patient.nokPhone)           { _, _ in markDirty() }
        .onChange(of: patient.insuranceProvider)  { _, _ in markDirty() }
        .onChange(of: patient.policyNumber)       { _, _ in markDirty() }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                // Pre-consult questionnaire
                Button {
                    showQuestionnaire = true
                } label: {
                    Label("Questionnaire", systemImage: "list.clipboard")
                }

                // Schedule appointment
                Button {
                    showScheduler = true
                } label: {
                    Label("Schedule", systemImage: "calendar.badge.plus")
                }

                // Email
                if MailComposer.canSendMail, let email = patient.email, !email.isEmpty {
                    Button {
                        showMailComposer = true
                    } label: {
                        Label("Email", systemImage: "envelope")
                    }
                }

                // SMS
                if SMSComposer.canSendText, let phone = patient.phone, !phone.isEmpty {
                    Button {
                        showSMSComposer = true
                    } label: {
                        Label("SMS", systemImage: "message")
                    }
                }
            }
        }
        .sheet(isPresented: $showScheduler) {
            AppointmentSchedulerView(initialPatient: patient)
        }
        .sheet(isPresented: $showQuestionnaire) {
            AdaptiveQuestionnaireSheet(patient: patient)
        }
        .sheet(isPresented: $showMailComposer) {
            if let email = patient.email, !email.isEmpty {
                MailComposer(
                    to: [email],
                    subject: "Your appointment — Amise Medical Services",
                    body: AppointmentMessage.preConsultEmailBody(
                        patientName: patient.fullName,
                        date: .now.addingTimeInterval(86400)
                    ),
                    isPresented: $showMailComposer
                )
            }
        }
        .sheet(isPresented: $showSMSComposer) {
            if let phone = patient.phone, !phone.isEmpty {
                SMSComposer(
                    recipients: [phone],
                    body: "Amise Medical: Please complete your pre-visit questionnaire with our front desk staff. Call +1(758)284-0557 for info.",
                    isPresented: $showSMSComposer
                )
            }
        }
    }

    @ViewBuilder
    private var dobRow: some View {
        if patient.dateOfBirth != nil {
            DatePicker(
                "Date of Birth",
                selection: Binding(
                    get: { patient.dateOfBirth ?? .now },
                    set: { patient.dateOfBirth = $0 }
                ),
                displayedComponents: .date
            )
        } else {
            Button("Add Date of Birth") {
                patient.dateOfBirth = Calendar.ect.date(byAdding: .year, value: -40, to: .now)
                markDirty()
            }
            .foregroundStyle(AMColor.accent)
        }
    }

    @ViewBuilder
    private var encounterStatusRow: some View {
        switch patient.encounterStatus {
        case .notCheckedIn:
            HStack {
                Label("Not checked in", systemImage: "clock")
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Check In Now") { checkIn() }
                    .buttonStyle(.borderedProminent)
                    .tint(AMColor.accent)
            }

        case .waiting:
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Label("Waiting for doctor", systemImage: "clock.fill")
                        .foregroundStyle(.orange)
                    if let ct = patient.checkInTime {
                        Text("Checked in \(DateFormatter.ectShort.string(from: ct)) ECT")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Button("Cancel") {
                    patient.encounterStatus = .notCheckedIn
                    patient.checkInTime = nil
                    markDirty()
                    Task { await sync.syncIfAuthenticated() }
                }
                .buttonStyle(.bordered)
                .tint(.secondary)
                .font(.callout)
            }

        case .withDoctor:
            Label("With doctor", systemImage: "person.fill")
                .foregroundStyle(.teal)

        case .complete:
            Label("Encounter complete", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
        }
    }

    private func checkIn() {
        let now = Date.now
        patient.encounterStatus = .waiting
        patient.checkInTime = now
        markDirty()
        Task {
            await sync.syncIfAuthenticated()
            try? await calendarService.createCheckInEvent(
                patientName: patient.fullName,
                checkInTime: now,
                notes: [patient.chiefComplaint, patient.hpi]
                    .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                    .joined(separator: " · ")
            )
        }
    }

    private func markDirty() {
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }
}

// MARK: - Adaptive pre-encounter questionnaire
// Replaces the old static WalkInQuestionnaireSheet.
//
// Design principles (single-value-per-variable rule):
//   • EncounterAnswers is the ONE authoritative data store for this session.
//   • On save, it writes directly to patient.chiefComplaint / hpi / pmhNotes —
//     these fields are never written by any other code path during the same
//     encounter (AddPatientView sets them only on registration, before an
//     encounter starts).
//   • socratesSelections is emitted directly to BayesianDiagnosisEngine so
//     the engine receives structured data, not parsed free text.
//
// Adaptive branching (radiation principle):
//   Phase 1 → CC category selection drives Phase 2 and Phase 3 content.
//   Phase 2 (SOCRATES) → visible only for pain-type CCs.
//   Phase 3 → CC-specific associated symptom list, not a universal checkbox wall.
//   Phase 4 → red flags, gated by sex and age at display time.
//   Phases 5–6 → always shown (PMHx, social, last meal).

struct AdaptiveQuestionnaireSheet: View {
    var patient: Patient?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var sync: SyncService

    @State private var answers = EncounterAnswers()

    // Patient demographics used for gating — resolved once from the model
    private var patientSex: Sex { patient?.sex ?? .unknown }
    private var patientAge: Int {
        guard let dob = patient?.dateOfBirth else { return 99 }
        return Calendar.ect.dateComponents([.year], from: dob, to: .now).year ?? 99
    }

    private var ccSelected: Bool { answers.ccCategory != nil }

    var body: some View {
        NavigationStack {
            Form {
                patientHeaderSection
                phase1CCSection
                if ccSelected {
                    if let cc = answers.ccCategory, cc.isPainType {
                        phase2SocratesSection(cc: cc)
                    }
                    phase3AssociatedSection
                    phase4RedFlagsSection
                }
                phase5PMHxSection
                phase6SocialSection
            }
            .navigationTitle(patient.map { "Questionnaire — \($0.fullName)" } ?? "Walk-In Questionnaire")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Save") { save() }
                        .disabled(answers.ccCategory == nil &&
                                  answers.ccClarification.trimmingCharacters(in: .whitespaces).isEmpty)
                        .tint(AMColor.accent)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    // ── Phase 0: patient header ───────────────────────────────────────────────

    @ViewBuilder
    private var patientHeaderSection: some View {
        if let patient {
            Section {
                HStack(spacing: 8) {
                    AcuityPip(acuity: patient.acuity)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(patient.fullName).font(.subheadline.weight(.semibold))
                        HStack(spacing: 6) {
                            if let mrn = patient.mrn, !mrn.isEmpty {
                                Text("MRN \(mrn)")
                                    .font(.caption2).foregroundStyle(AMColor.accent)
                            }
                            Text(patient.ageDisplay ?? "").font(.caption2).foregroundStyle(.secondary)
                            Text(patient.sex.rawValue).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            } header: {
                Label("Patient", systemImage: "person.crop.circle")
                    .textCase(nil).font(.system(size: 11, weight: .semibold))
            }
        }
    }

    // ── Phase 1: Chief complaint ──────────────────────────────────────────────

    @ViewBuilder
    private var phase1CCSection: some View {
        Section {
            // Structured CC picker — maps directly to Bayesian routing
            Picker("Chief complaint", selection: $answers.ccCategory) {
                Text("Select…").tag(Optional<CCCategory>.none)
                ForEach(visibleCCCategories, id: \.self) { cc in
                    Text(cc.rawValue).tag(Optional(cc))
                }
            }
            .pickerStyle(.menu)
            .onChange(of: answers.ccCategory) { _, _ in
                // Reset CC-dependent answers when category changes
                answers.associatedSymptoms = []
                answers.painSite = ""
                answers.painCharacter = nil
                answers.painOnset = nil
                answers.painTiming = nil
                answers.painWorsenedBy = []
                answers.painRelievedBy = []
                answers.painRadiates = false
                answers.painRadiationSite = ""
            }

            let placeholder = answers.ccCategory == .other
                ? "Describe the complaint…"
                : "Additional detail (optional)"
            TextField(placeholder, text: $answers.ccClarification, axis: .vertical)
                .lineLimit(2...)
        } header: {
            Label("Chief Complaint", systemImage: "1.circle.fill")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        } footer: {
            if answers.ccCategory == nil {
                Text("Select the primary reason for today's visit. All subsequent questions adapt to this selection.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    // Demographic gating for CC picker
    private var visibleCCCategories: [CCCategory] {
        CCCategory.allCases.filter { cc in
            if cc == .breastSymptom && patientSex == .male { return false }
            return true
        }
    }

    // ── Phase 2: SOCRATES (pain CCs only) ────────────────────────────────────

    @ViewBuilder
    private func phase2SocratesSection(cc: CCCategory) -> some View {
        Section {
            TextField("Location (e.g. right lower abdomen, central, diffuse)",
                      text: $answers.painSite, axis: .vertical)
                .lineLimit(1...)

            Picker("Onset speed", selection: $answers.painOnset) {
                Text("Select…").tag(Optional<PainOnset>.none)
                ForEach(PainOnset.allCases, id: \.self) { o in Text(o.rawValue).tag(Optional(o)) }
            }

            if answers.painOnset != nil {
                HStack {
                    Text("Hours since onset")
                    Spacer()
                    TextField("e.g. 6", value: $answers.painOnsetHoursAgo, format: .number)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
            }

            Picker("Character", selection: $answers.painCharacter) {
                Text("Select…").tag(Optional<PainCharacter>.none)
                ForEach(PainCharacter.allCases, id: \.self) { c in Text(c.rawValue).tag(Optional(c)) }
            }
        } header: {
            Label("Pain — Site & Onset", systemImage: "2.circle.fill")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }

        Section {
            Toggle("Does the pain spread to another area?", isOn: $answers.painRadiates)
            if answers.painRadiates {
                TextField("Where does it spread to?", text: $answers.painRadiationSite)
            }

            Picker("Timing pattern", selection: $answers.painTiming) {
                Text("Select…").tag(Optional<PainTiming>.none)
                ForEach(PainTiming.allCases, id: \.self) { t in Text(t.rawValue).tag(Optional(t)) }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Severity: \(answers.severityAnswered ? "\(answers.painSeverity)/10" : "not yet set")")
                    .font(.subheadline)
                Slider(value: Binding(
                    get: { Double(answers.painSeverity) },
                    set: { answers.painSeverity = Int($0); answers.severityAnswered = true }
                ), in: 0...10, step: 1)
                .tint(answers.painSeverity >= 8 ? .red : answers.painSeverity >= 5 ? .orange : .green)
            }
        } header: {
            Label("Pain — Radiation, Timing & Severity", systemImage: "3.circle.fill")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }

        Section {
            QCheckboxGrid(label: "Makes it WORSE", options: cc.worsening, selection: $answers.painWorsenedBy)
            QCheckboxGrid(label: "Makes it BETTER", options: cc.relieving, selection: $answers.painRelievedBy)
        } header: {
            Label("Exacerbating & Relieving Factors", systemImage: "arrow.up.arrow.down")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }
    }

    // ── Phase 3: Associated symptoms (CC-specific list) ───────────────────────

    @ViewBuilder
    private var phase3AssociatedSection: some View {
        if let cc = answers.ccCategory {
            Section {
                QCheckboxGrid(label: nil,
                              options: cc.associatedSymptoms,
                              selection: $answers.associatedSymptoms)
                TextField("Other associated symptoms…", text: $answers.associatedOther, axis: .vertical)
                    .lineLimit(2...)
            } header: {
                Label("Associated Symptoms", systemImage: "list.bullet")
                    .textCase(nil).font(.system(size: 11, weight: .semibold))
            } footer: {
                Text("Only symptoms relevant to \(cc.rawValue.lowercased()) are shown.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    // ── Phase 4: Red flags (demographic-gated) ────────────────────────────────

    @ViewBuilder
    private var phase4RedFlagsSection: some View {
        Section {
            Toggle("Unexplained weight loss", isOn: $answers.unexplainedWeightLoss)
            Toggle("Night sweats", isOn: $answers.nightSweats)
            Toggle("Change in a mole or skin lesion", isOn: $answers.changeInMole)
            if patientAge >= 18 {
                Toggle("Coughing up blood (haemoptysis)", isOn: $answers.haemoptysis)
            }
            if patientAge >= 25 {
                Toggle("Blood in urine (haematuria)", isOn: $answers.haematuria)
            }
            if patientSex == .female {
                Toggle("Recent breast change (lump, skin, discharge)", isOn: $answers.breastChange)
            }
        } header: {
            Label("Red Flag Symptoms", systemImage: "exclamationmark.triangle.fill")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.orange)
        } footer: {
            Text("Report any that apply, even if not the main reason for today's visit.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    // ── Phase 5: Past medical history ─────────────────────────────────────────

    @ViewBuilder
    private var phase5PMHxSection: some View {
        Section {
            QCheckboxGrid(label: nil,
                          options: PMHxCondition.allCases.map(\.rawValue),
                          rawSelection: Binding(
                            get: { Set(answers.pmhxConditions.map(\.rawValue)) },
                            set: { raws in
                                answers.pmhxConditions = Set(
                                    PMHxCondition.allCases.filter { raws.contains($0.rawValue) }
                                )
                            }
                          ))
            TextField("Current medications (name and dose)", text: $answers.medications, axis: .vertical)
                .lineLimit(2...)
            TextField("Known allergies (drug, food, latex, other)", text: $answers.allergies, axis: .vertical)
                .lineLimit(2...)
            TextField("Previous operations / procedures", text: $answers.surgicalHistory, axis: .vertical)
                .lineLimit(2...)
        } header: {
            Label("Past Medical History", systemImage: "cross.case")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }
    }

    // ── Phase 6: Social history & last meal ───────────────────────────────────

    @ViewBuilder
    private var phase6SocialSection: some View {
        Section {
            Picker("Smoking status", selection: $answers.smokingStatus) {
                ForEach(SmokingStatus.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Picker("Alcohol use", selection: $answers.alcoholUse) {
                ForEach(AlcoholUse.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            TextField("Occupation (optional)", text: $answers.occupation)
        } header: {
            Label("Social History", systemImage: "person.2")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }

        Section {
            Toggle("Record last meal time", isOn: Binding(
                get: { answers.lastMealTime != nil },
                set: { answers.lastMealTime = $0 ? .now : nil }
            ))
            if let _ = answers.lastMealTime {
                DatePicker("Last meal",
                           selection: Binding(
                            get: { answers.lastMealTime ?? .now },
                            set: { answers.lastMealTime = $0 }
                           ),
                           displayedComponents: [.date, .hourAndMinute])
            }
        } header: {
            Label("Last Meal", systemImage: "fork.knife")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        } footer: {
            Text("Required if the patient may need surgery or anaesthesia today.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    // ── Save: single write to canonical Patient fields ────────────────────────
    // This is the ONLY place questionnaire data is written to the patient model.
    // Enforces the single-value-per-variable rule: no other path writes
    // chiefComplaint / hpi / pmhNotes during an encounter session.

    private func save() {
        guard let patient else {
            // Walk-in without a registered patient: questionnaire data cannot be
            // persisted without a patient record. Dismiss — front desk should
            // register the patient first, then open the questionnaire from their record.
            dismiss()
            return
        }

        // Structured fields — direct write, no concatenation ambiguity.
        // These are the canonical values for chiefComplaint / hpi / pmhNotes.
        patient.chiefComplaint = answers.chiefComplaintText.isEmpty ? nil : answers.chiefComplaintText
        patient.hpi            = answers.hpiText.isEmpty ? nil : answers.hpiText
        patient.pmhNotes       = answers.pmhxText.isEmpty ? nil : answers.pmhxText

        // P6: surgical history, allergies, and medications from questionnaire.
        // Only write when the questionnaire captured data — never overwrite with blank.
        if !answers.surgicalHistory.isEmpty {
            patient.surgicalHistory = answers.surgicalHistory
        }
        if !answers.allergies.isEmpty {
            // Append questionnaire allergy text as a single AllergyEntry (severity unknown
            // at this stage — front desk captures name only, severity confirmed by clinician).
            let existing = patient.allergies
            let names = answers.allergies
                .components(separatedBy: CharacterSet(charactersIn: ",;"))
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            let existingNames = Set(existing.map { $0.name.lowercased() })
            let newEntries = names.compactMap { name -> AllergyEntry? in
                guard !existingNames.contains(name.lowercased()) else { return nil }
                return AllergyEntry(name: name, severity: "Unknown", reaction: "Not specified")
            }
            if !newEntries.isEmpty {
                patient.allergies = existing + newEntries
            }
        }
        if !answers.medications.isEmpty {
            // Append to pmhNotes as a MEDICATIONS: line so the pipeline can read it.
            let medLine = "MEDICATIONS: \(answers.medications)"
            if let existing = patient.pmhNotes, !existing.contains("MEDICATIONS:") {
                patient.pmhNotes = existing + "\n" + medLine
            } else if patient.pmhNotes == nil {
                patient.pmhNotes = medLine
            }
        }

        // Human-readable pre-visit note for the doctor
        let note = ClinicalNote(noteType: .other, patient: patient)
        note.freeText = buildReadableNote()
        context.insert(note)

        patient.updatedAt   = .now
        patient.pendingSync = true
        try? context.save()
        Task { await sync.syncIfAuthenticated() }
        dismiss()
    }

    private func buildReadableNote() -> String {
        var lines = ["PRE-VISIT QUESTIONNAIRE — \(DateFormatter.ectDateTime.string(from: .now)) ECT"]
        lines.append("")
        lines.append("CHIEF COMPLAINT: \(answers.chiefComplaintText)")
        if !answers.hpiText.isEmpty {
            lines.append("")
            lines.append(answers.hpiText)
        }
        if !answers.pmhxText.isEmpty {
            lines.append("")
            lines.append("PAST HISTORY & SOCIAL")
            lines.append(answers.pmhxText)
        }
        if let t = answers.lastMealTime {
            lines.append("LAST MEAL: \(DateFormatter.ectDateTime.string(from: t)) ECT")
        }
        return lines.joined(separator: "\n")
    }
}

// MARK: - Reusable checkbox grid

private struct QCheckboxGrid: View {
    let label: String?
    let options: [String]
    var selection: Binding<Set<String>>?
    var rawSelection: Binding<Set<String>>?

    init(label: String?, options: [String], selection: Binding<Set<String>>) {
        self.label = label
        self.options = options
        self.selection = selection
        self.rawSelection = nil
    }

    init(label: String?, options: [String], rawSelection: Binding<Set<String>>) {
        self.label = label
        self.options = options
        self.selection = nil
        self.rawSelection = rawSelection
    }

    private var activeBinding: Binding<Set<String>> {
        selection ?? rawSelection!
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let label {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(options, id: \.self) { opt in
                    let sel = activeBinding.wrappedValue.contains(opt)
                    Button {
                        if sel { activeBinding.wrappedValue.remove(opt) }
                        else   { activeBinding.wrappedValue.insert(opt) }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(sel ? AMColor.accent : .secondary)
                                .font(.system(size: 14))
                            Text(opt)
                                .font(.caption)
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
