// QuickAddSheet.swift
// Context-aware "find or add" patient sheet.
// Two paths: find an existing patient and move them to this section,
// or register a new patient with minimal required fields up-front and
// optional detail in a progressive-disclosure panel.

import SwiftUI
import SwiftData

struct QuickAddSheet: View {
    let section: AppSection

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss)      private var dismiss
    @EnvironmentObject private var calSvc: CalendarService

    @Query(sort: \Patient.updatedAt, order: .reverse) private var queriedAllPatients: [Patient]

    // Deleted/detached records are dropped before any view reads them (SwiftData

    // crashes when a body touches a deleted model before @Query refreshes).

    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    // ── Search ──────────────────────────────────────────────────────────
    @State private var searchText = ""

    // ── New patient — required ───────────────────────────────────────────
    @State private var fullName    = ""
    @State private var location:   ClinicalLocation
    @State private var visitType:  VisitType
    @State private var setting:    ClinicalSetting
    @State private var keyField    = ""   // procedure / scope / ward / complaint
    @State private var bedNumber   = ""
    @State private var hasDate     = false
    @State private var keyDate     = Date()

    // ── New patient — optional (collapsed) ──────────────────────────────
    @State private var showMore = false
    @State private var sex:  Sex  = .unspecified
    @State private var hasDOB    = false
    @State private var dob       = Date()
    @State private var phone     = ""
    @State private var mrn       = ""

    @State private var showDuplicate = false
    @State private var didSave = false   // blocks a double tap on Add from creating two records
    @State private var pendingName   = ""

    // MARK: - Init

    init(section: AppSection) {
        self.section = section
        _setting   = State(initialValue: section.defaultSetting)
        _visitType = State(initialValue: section.defaultVisitType)
        _location  = State(initialValue: section.defaultLocation)
    }

    // MARK: - Derived

    private var nameValid: Bool {
        !fullName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var searchResults: [Patient] {
        let q = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return [] }
        return allPatients.filter {
            $0.fullName.lowercased().contains(q)          ||
            ($0.mrn?.lowercased().contains(q) ?? false)   ||
            ($0.chiefComplaint?.lowercased().contains(q) ?? false)
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    searchPanel
                    if !searchResults.isEmpty || !searchText.isEmpty {
                        orRow
                    }
                    newPatientPanel
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Add to \(section.rawValue)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { attemptSave() }
                        .fontWeight(.semibold)
                        .disabled(!nameValid)
                }
            }
            .alert("Already registered", isPresented: $showDuplicate) {
                if let existing = duplicateMatches.first {
                    Button("Use existing record") { moveToSection(existing) }
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("\"\(pendingName)\" is already registered (\(duplicateMRNs)). If this is a different person with the same name, enter their date of birth.")
            }
        }
    }

    // MARK: - Search panel

    @ViewBuilder private var searchPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search patients already in the system…", text: $searchText)
                    .autocorrectionDisabled()
                if !searchText.isEmpty {
                    Button { searchText = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(12)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

            if !searchResults.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(searchResults.enumerated()), id: \.element.id) { idx, patient in
                        existingRow(patient)
                        if idx < searchResults.count - 1 {
                            Divider().padding(.leading, 56)
                        }
                    }
                }
                .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            } else if !searchText.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "person.fill.questionmark").foregroundStyle(.secondary)
                    Text("No match — register as new below")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                .padding(.horizontal, 4)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 8)
    }

    @ViewBuilder private func existingRow(_ patient: Patient) -> some View {
        Button { moveToSection(patient) } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color(hex: patient.setting.accentHex).opacity(0.15))
                        .frame(width: 40, height: 40)
                    Text(String(patient.fullName.prefix(2)).uppercased())
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color(hex: patient.setting.accentHex))
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(patient.fullName)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    HStack(spacing: 4) {
                        Label(patient.setting.rawValue, systemImage: patient.setting.icon)
                            .font(.caption).foregroundStyle(.secondary)
                        Text("·").font(.caption).foregroundStyle(.tertiary)
                        Text(patient.location.rawValue)
                            .font(.caption).foregroundStyle(.secondary)
                        if let cc = patient.chiefComplaint, !cc.isEmpty {
                            Text("·").font(.caption).foregroundStyle(.tertiary)
                            Text(cc).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(Color(hex: section.defaultSetting.accentHex))
                    Text("Add to \(section.shortLabel)")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color(hex: section.defaultSetting.accentHex))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
    }

    // MARK: - OR divider

    @ViewBuilder private var orRow: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Color(.separator)).frame(height: 0.5)
            Text("or register new")
                .font(.caption).foregroundStyle(.secondary).fixedSize()
            Rectangle().fill(Color(.separator)).frame(height: 0.5)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    // MARK: - New patient panel

    @ViewBuilder private var newPatientPanel: some View {
        VStack(alignment: .leading, spacing: 16) {

            // ── Name ────────────────────────────────────────────────────────
            fieldGroup("Full name — required") {
                TextField("Patient full name", text: $fullName)
                    .padding(12)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
            }

            // ── Visit type ──────────────────────────────────────────────────
            fieldGroup("Visit type") {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(section.relevantVisitTypes, id: \.self) { vt in
                            let sel = visitType == vt
                            let color = Color(hex: vt.accentHex)
                            Button {
                                visitType = vt
                                syncSettingFromVisit(vt)
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: vt.icon).font(.system(size: 10))
                                    Text(vt.shortLabel)
                                        .font(.system(size: 11, weight: sel ? .semibold : .regular))
                                }
                                .foregroundStyle(sel ? .white : color)
                                .padding(.horizontal, 10).padding(.vertical, 7)
                                .background(sel ? color : color.opacity(0.12), in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .animation(.easeInOut(duration: 0.12), value: sel)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            // ── Key clinical field ───────────────────────────────────────────
            fieldGroup(section.keyFieldLabel) {
                TextField(section.keyFieldLabel, text: $keyField)
                    .padding(12)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(section.keyFieldQuickPicks, id: \.self) { pick in
                            let sel = keyField == pick
                            Button { keyField = sel ? "" : pick } label: {
                                Text(pick)
                                    .font(.system(size: 11, weight: sel ? .semibold : .regular))
                                    .foregroundStyle(sel ? .white : .primary)
                                    .padding(.horizontal, 8).padding(.vertical, 5)
                                    .background(
                                        sel ? AMColor.accent : Color(.tertiarySystemFill),
                                        in: Capsule()
                                    )
                            }
                            .buttonStyle(.plain)
                            .animation(.easeInOut(duration: 0.12), value: sel)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            // ── Ward bed (ward section only) ─────────────────────────────────
            if section == .wardRounds {
                fieldGroup("Bed / room") {
                    TextField("e.g. A3, Room 12", text: $bedNumber)
                        .padding(12)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                }
            }

            // ── Date/time (theatre + endoscopy) ─────────────────────────────
            if section == .theatre || section == .endoscopy {
                fieldGroup(section == .theatre ? "Theatre date & time" : "Scope date & time") {
                    Toggle(isOn: $hasDate) {
                        Text("Set date now")
                            .font(.subheadline)
                    }
                    .padding(12)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                    if hasDate {
                        DatePicker(
                            "",
                            selection: $keyDate,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                        .labelsHidden()
                        .padding(12)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }

            // ── Location ─────────────────────────────────────────────────────
            fieldGroup("Location") {
                LazyVGrid(
                    columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())],
                    spacing: 8
                ) {
                    ForEach(ClinicalLocation.allCases, id: \.self) { loc in
                        let sel = location == loc
                        let col = locationColor(loc)
                        Button { location = loc } label: {
                            VStack(spacing: 3) {
                                Image(systemName: locationIcon(loc))
                                    .font(.system(size: 15, weight: sel ? .semibold : .regular))
                                Text(loc.shortName)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .foregroundStyle(sel ? .white : col)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(sel ? col : col.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(sel ? col : col.opacity(0.25), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .animation(.easeInOut(duration: 0.12), value: sel)
                    }
                }
            }

            // ── Optional details (progressive disclosure) ────────────────────
            Button {
                withAnimation(.easeInOut(duration: 0.18)) { showMore.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: showMore ? "chevron.down.circle" : "chevron.right.circle")
                        .foregroundStyle(AMColor.accent)
                    Text(showMore ? "Hide optional details" : "Add sex · DOB · phone · MRN")
                        .font(.subheadline)
                        .foregroundStyle(AMColor.accent)
                    Spacer()
                    Text("(can add later in record)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .background(
                    AMColor.accentLt.opacity(0.5),
                    in: RoundedRectangle(cornerRadius: 10)
                )
            }
            .buttonStyle(.plain)

            if showMore {
                VStack(alignment: .leading, spacing: 14) {
                    // Sex
                    fieldGroup("Sex") {
                        Picker("", selection: $sex) {
                            ForEach(Sex.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    }

                    // DOB
                    fieldGroup("Date of birth") {
                        Toggle("Known", isOn: $hasDOB)
                            .padding(12)
                            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                        if hasDOB {
                            DatePicker("", selection: $dob, displayedComponents: .date)
                                .labelsHidden()
                                .padding(12)
                                .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                        }
                    }

                    // Phone
                    fieldGroup("Phone") {
                        TextField("Optional", text: $phone)
                            .keyboardType(.phonePad)
                            .padding(12)
                            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                    }

                    // MRN
                    fieldGroup("MRN") {
                        HStack(spacing: 8) {
                            TextField("Auto-generated on save", text: $mrn)
                                .padding(12)
                                .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
                            Button("Generate") { mrn = MRNGenerator.next(existing: allPatients) }
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(AMColor.accent, in: RoundedRectangle(cornerRadius: 10))
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 40)
    }

    // MARK: - Helpers

    private func fieldGroup<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.4)
            content()
        }
    }

    private func locationColor(_ loc: ClinicalLocation) -> Color {
        switch loc {
        case .tapion:     Color(hex: "#0891B2")
        case .rodney_bay: Color(hex: "#7C3AED")
        case .okeu:       Color(hex: "#DC2626")
        case .victoria:   Color(hex: "#2563EB")
        case .other:      Color.gray
        }
    }

    private func locationIcon(_ loc: ClinicalLocation) -> String {
        switch loc {
        case .tapion:     "cross.circle"
        case .rodney_bay: "building.2"
        case .okeu:       "staroflife"
        case .victoria:   "building"
        case .other:      "mappin.circle"
        }
    }

    private func syncSettingFromVisit(_ vt: VisitType) {
        switch vt {
        case .ogd, .colonoscopy, .ercp, .bronchoscopy:
            setting = .endoscopy
        case .surgeryElective, .dayOfSurgery:
            setting = .theatre
        case .surgeryEmergency, .trauma, .burns:
            setting = .emergency
        case .wardReview:
            setting = .inpatient
        case .urgentReview:
            if section == .wardRounds { setting = .inpatient }
        default:
            break
        }
    }

    // MARK: - Move existing patient to this section

    private func moveToSection(_ patient: Patient) {
        patient.setting    = section.defaultSetting
        patient.visitType  = section.defaultVisitType
        patient.updatedAt  = .now
        patient.pendingSync = true
        try? context.save()
        dismiss()
    }

    // MARK: - Save new patient

    private var duplicateMatches: [Patient] {
        allPatients.registeredMatches(name: pendingName, dateOfBirth: hasDOB ? dob : nil)
    }

    private var duplicateMRNs: String {
        duplicateMatches.map { $0.mrn ?? "no MRN" }.joined(separator: ", ")
    }

    private func attemptSave() {
        let trimmed = fullName.trimmingCharacters(in: .whitespaces)
        pendingName = trimmed
        if !duplicateMatches.isEmpty {
            showDuplicate = true
        } else {
            commitSave()
        }
    }

    private func commitSave() {
        guard !didSave else { return }
        didSave = true
        let trimmed = fullName.trimmingCharacters(in: .whitespaces)
        let p = Patient(
            fullName: trimmed,
            sex: sex,
            setting: setting,
            location: location,
            acuity: .routine
        )
        p.mrn = mrn.isEmpty ? MRNGenerator.next(existing: allPatients) : mrn
        p.visitType = visitType
        if hasDOB { p.dateOfBirth = dob }
        if !phone.isEmpty { p.phone = phone }

        switch section {
        case .theatre, .endoscopy:
            if !keyField.isEmpty   { p.appointmentType = keyField }
            if hasDate             { p.operationDate = keyDate }
        case .wardRounds:
            if !keyField.isEmpty   { p.ward = keyField }
            if !bedNumber.isEmpty  { p.bedNumber = bedNumber }
            p.admittedAt = .now
        case .outpatients, .schedule:
            if !keyField.isEmpty   { p.chiefComplaint = keyField }
        }

        context.insert(p)
        try? context.save()

        if (section == .theatre || section == .endoscopy) && hasDate && !keyField.isEmpty {
            Task {
                try? await calSvc.createTheatreBooking(
                    procedure: keyField,
                    patientName: p.fullName,
                    date: keyDate,
                    duration: section == .endoscopy ? 3600 : 5400,
                    notes: ""
                )
            }
        }

        dismiss()
    }
}
