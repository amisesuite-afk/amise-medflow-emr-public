import SwiftUI
import SwiftData

struct PatientListView: View {
    @Query(sort: \Patient.createdAt, order: .reverse) private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var showDuplicateReview = false
    @State private var searchText = ""
    @State private var selectedPatient: Patient?

    // MARK: – Filter

    private func searchFiltered(_ allPatients: [Patient]) -> [Patient] {
        guard !searchText.isEmpty else { return allPatients }
        let q = searchText.lowercased()
        return allPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.chiefComplaint?.lowercased().contains(q) ?? false) ||
            ($0.workingDiagnosis?.lowercased().contains(q) ?? false) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.phone?.contains(q) ?? false)
        }
    }

    // MARK: – Sections (deduped via PatientDeduplication.swift)

    private static let settingOrder: [ClinicalSetting] = [
        .emergency, .inpatient, .theatre, .endoscopy, .outpatient
    ]

    /// Built once per render in `body` (it was built twice, each time filtering all patients again).
    private func makeSections(from allPatients: [Patient]) -> [(setting: ClinicalSetting, patients: [Patient])] {
        let filtered = searchFiltered(allPatients)
        return Self.settingOrder.compactMap { setting in
            let patients = filtered
                .filter { $0.setting == setting }
                .sorted { $0.createdAt > $1.createdAt }
                .deduped()
            return patients.isEmpty ? nil : (setting: setting, patients: patients)
        }
    }

    // MARK: – Body

    var body: some View {
        let allPatients = self.allPatients
        let sections = makeSections(from: allPatients)
        NavigationStack {
            List {
                if searchText.isEmpty {
                    DuplicatePatientsBanner(patients: allPatients, showReview: $showDuplicateReview)
                }
                if allPatients.isEmpty {
                    ContentUnavailableView(
                        "No patients",
                        systemImage: "person.crop.circle",
                        description: Text("Add a patient to get started.")
                    )
                } else if sections.isEmpty {
                    ContentUnavailableView(
                        "No results",
                        systemImage: "magnifyingglass",
                        description: Text("No patients match \"\(searchText)\".")
                    )
                } else {
                    ForEach(sections, id: \.setting) { section in
                        Section {
                            ForEach(section.patients) { patient in
                                Button { selectedPatient = patient } label: {
                                    PatientRow(patient: patient)
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("patients.row")
                            }
                            .onDelete { offsets in
                                deleteWithDuplicates(from: section.patients, at: offsets)
                            }
                        } header: {
                            Label(section.setting.rawValue,
                                  systemImage: section.setting.icon)
                                .scaledFont(size: 11, weight: .semibold)
                                .foregroundStyle(Color(hex: section.setting.accentHex))
                                .textCase(nil)
                        }
                    }
                }
            }
            .navigationTitle("Patients")
            .searchable(text: $searchText, prompt: "Search name, MRN, or complaint")
            .onAppear { CrashReporting.breadcrumb("Opened patient list") }
            .task {
                // Backfill MRNs for any patient created before auto-generation was wired up.
                // One live list for the whole loop (it was rebuilt for every patient backfilled).
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
                            .accessibilityLabel("Add patient")
                            .accessibilityIdentifier("patients.add")
                    }
                }
            }
            .sheet(isPresented: $showDuplicateReview) { DuplicatePatientsSheet() }
            .sheet(isPresented: $showAdd) {
                AddPatientView(initialSetting: .outpatient)
            }
            .patientRecordPresentation(item: $selectedPatient)
        }
    }

    // MARK: – Actions

    /// Deletes the tapped row and any hidden local copies of the SAME record (same remoteId /
    /// manual MRN, see Patient.dedupKey). Same-name patients are separate records and are handled
    /// in the duplicate review sheet, never here.
    private func deleteWithDuplicates(from patients: [Patient], at offsets: IndexSet) {
        for i in offsets {
            let victim = patients[i]
            let key = victim.dedupKey
            allPatients
                .filter { $0.setting == victim.setting && $0.dedupKey == key }
                .forEach { context.deletePatient($0) }
        }
    }
}

// MARK: - Universal patient row (used by all sections)

struct PatientRow: View {
    let patient: Patient

    /// Accessibility text sizes stack the row's lines vertically and let names and clinical text
    /// wrap; the default sizes keep the original single-line layout.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private var isAccessibilitySize: Bool { dynamicTypeSize.isAccessibilitySize }

    /// Vitals newest first, sorted once per row render (the row used to sort them up to four
    /// times per render and re-run the NEWS2 chart for every NEWS2 property it read).
    private var sortedVitals: [VitalsEntry] {
        ListPerf.newestFirst(patient.vitalsEntries.filter(\.isLive), by: { $0.recordedAt })
    }

    private func news2TrendColor(_ delta: Int?) -> Color {
        guard let delta else { return .secondary }
        if delta > 0 { return .red }
        if delta < 0 { return .green }
        return .secondary
    }

    private var accentColor: Color { Color(hex: patient.setting.accentHex) }

    private var locationColor: Color {
        switch patient.location {
        case .tapion:     return Color(hex: "#0891B2")
        case .rodney_bay: return Color(hex: "#7C3AED")
        case .okeu:       return Color(hex: "#DC2626")
        case .victoria:   return Color(hex: "#2563EB")
        case .other:      return Color.gray
        }
    }

    /// Everything the row derives from the patient, computed once per render and shared by the
    /// drawn row and its VoiceOver label.
    private struct RowFacts {
        let news2: News2Snapshot?
        let news2Delta: Int?
        let hasCriticalLabs: Bool
        let hasPendingLabs: Bool
    }

    private func facts(vitals: [VitalsEntry], investigations: [InvestigationEntry]) -> RowFacts {
        var snapshot: News2Snapshot?
        var delta: Int?
        if let latest = vitals.first, latest.hasAnyValue {
            snapshot = News2Snapshot(latest)
            delta = ListPerf.news2TrendDelta(
                newestFirstScores: vitals.prefix(3).filter { $0.hasAnyValue }.map { $0.news2Score })
        }
        let critical = LabPanel.parse(from: investigations).hasCriticalValues
        let pending = !critical && investigations.contains(where: { $0.status == .ordered || $0.status == .pending })
        return RowFacts(news2: snapshot, news2Delta: delta, hasCriticalLabs: critical, hasPendingLabs: pending)
    }

    /// One VoiceOver element for the whole row: name, sex/age, location, acuity, NEWS2, then the
    /// safety flags and clinical text shown on screen.
    private func accessibilitySummary(_ f: RowFacts) -> String {
        let ageYears: Int? = patient.ageDisplay != nil ? patient.ageYears : nil
        let news2Text: String
        if let v = f.news2 {
            news2Text = A11yLabel.news2(score: v.score, risk: v.risk, incomplete: !v.isComplete,
                                        trendDelta: f.news2Delta)
        } else {
            news2Text = "No vitals"
        }
        var parts: [String?] = [
            patient.fullName,
            A11yLabel.sexAndAge(sex: patient.sex.rawValue, ageYears: ageYears),
            patient.location.rawValue,
            patient.bedNumber.map { "Bed \($0)" },
            A11yLabel.acuity(patient.acuity.label),
            news2Text,
            patient.postOpDays.map(A11yLabel.postOpDay),
        ]
        if patient.hasCriticalAllergy { parts.append("Critical allergy") }
        else if !patient.recordedAllergies.isEmpty { parts.append("Allergy recorded") }
        else if patient.hasExplicitNKDA { parts.append("No known drug allergies") }
        if patient.hasAnticoagulation { parts.append("On anticoagulation") }
        if f.hasCriticalLabs { parts.append("Critical labs") }
        else if f.hasPendingLabs { parts.append("Pending labs") }
        if let cc = patient.chiefComplaint, !cc.isEmpty { parts.append("Complaint: \(cc)") }
        if let dx = patient.workingDiagnosis, !dx.isEmpty { parts.append("Diagnosis: \(dx)") }
        parts.append(patient.visitType?.rawValue)
        parts.append(patient.setting.rawValue)
        if let mrn = patient.mrn, !mrn.isEmpty { parts.append("MRN \(mrn)") }
        return A11yLabel.joined(parts)
    }

    // Rows are built lazily; a patient deleted meanwhile must not be read (SwiftData crash).
    var body: some View {
        if patient.isLive { content }
    }

    @ViewBuilder
    private var content: some View {
        let vitals = sortedVitals
        let investigations = patient.investigations   // decoded once (was twice per render)
        let rowFacts = facts(vitals: vitals, investigations: investigations)
        HStack(spacing: 0) {
            // Left accent stripe (mirrors web border-left)
            Rectangle()
                .fill(accentColor)
                .frame(width: 3)
                .padding(.vertical, -8)

            VStack(alignment: .leading, spacing: 3) {
                nameLine
                demographicsLine
                complaintLine
                news2Line(rowFacts)
            }
            .padding(.leading, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(accessibilitySummary(rowFacts)))
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 16))
    }

    // MARK: Row 1: acuity pip · name · visit type · bed

    private var nameText: some View {
        Text(patient.fullName)
            .scaledFont(size: 14, weight: .semibold)
            .foregroundStyle(.primary)
            .lineLimit(isAccessibilitySize ? 3 : 1)
    }

    @ViewBuilder
    private var visitAndBedBadges: some View {
        if let vt = patient.visitType {
            Text(vt.shortLabel)
                .scaledFont(size: 9, weight: .heavy)
                .foregroundStyle(Color(hex: vt.accentHex))
                .padding(.horizontal, 5).padding(.vertical, 2)
                .background(Color(hex: vt.accentHex).opacity(0.1), in: RoundedRectangle(cornerRadius: 4))
        }
        if let bed = patient.bedNumber {
            Text("Bed \(bed)")
                .scaledFont(size: 9, weight: .semibold)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 5).padding(.vertical, 2)
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 4))
        }
    }

    @ViewBuilder
    private var nameLine: some View {
        if isAccessibilitySize {
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    AcuityPip(acuity: patient.acuity)
                    nameText
                }
                HStack(spacing: 5) { visitAndBedBadges }
            }
        } else {
            HStack(spacing: 5) {
                AcuityPip(acuity: patient.acuity)
                nameText
                Spacer(minLength: 2)
                visitAndBedBadges
            }
        }
    }

    // MARK: Row 2: demographics · MRN · setting · location pill · time

    private var locationPill: some View {
        // Location pill — prominent Tapion/RB
        Text(patient.location.shortName)
            .scaledFont(size: 9, weight: .bold)
            .foregroundStyle(.white)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(locationColor, in: Capsule())
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    @ViewBuilder
    private var demographicsLine: some View {
        let ageDisplay = patient.ageDisplay
        let showSex = patient.sex != .unspecified
        if isAccessibilitySize {
            VStack(alignment: .leading, spacing: 2) {
                let demo = [showSex ? String(patient.sex.rawValue.prefix(1)).uppercased() : nil, ageDisplay]
                    .compactMap { $0 }.joined(separator: ", ")
                let mrn = patient.mrn.flatMap { $0.isEmpty ? nil : "#\($0)" }
                let first = [demo.isEmpty ? nil : demo, mrn].compactMap { $0 }.joined(separator: " · ")
                if !first.isEmpty {
                    Text(first).font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                }
                HStack(spacing: 4) {
                    Text(patient.setting.rawValue)
                        .scaledFont(size: 9, weight: .semibold)
                        .foregroundStyle(accentColor)
                    locationPill
                }
                Text(patient.createdAt, style: .relative)
                    .font(.caption2).foregroundStyle(.tertiary)
            }
        } else {
            HStack(spacing: 4) {
                if let age = ageDisplay {
                    Text(showSex ? "\(patient.sex.rawValue.prefix(1).uppercased()), \(age)" : age)
                        .font(.caption2).foregroundStyle(.secondary)
                } else if showSex {
                    Text(patient.sex.rawValue.prefix(1).uppercased())
                        .font(.caption2).foregroundStyle(.secondary)
                }
                if let mrn = patient.mrn, !mrn.isEmpty {
                    if ageDisplay != nil || showSex {
                        Text("·").font(.caption2).foregroundStyle(.tertiary)
                    }
                    Text("#\(mrn)")
                        .scaledFont(size: 9, monospacedDigit: true)
                        .foregroundStyle(.secondary)
                }
                Text("·").font(.caption2).foregroundStyle(.tertiary)
                Text(patient.setting.rawValue)
                    .scaledFont(size: 9, weight: .semibold)
                    .foregroundStyle(accentColor)
                Spacer()
                locationPill
                Text(patient.createdAt, style: .relative)
                    .font(.caption2).foregroundStyle(.tertiary)
            }
        }
    }

    // MARK: Row 3: chief complaint then working diagnosis

    private func complaintIcon(_ name: String) -> some View {
        Image(systemName: name)
            .scaledFont(size: 8)
            .foregroundStyle(.teal)
    }

    @ViewBuilder
    private var complaintLine: some View {
        let lines = isAccessibilitySize ? 3 : 1
        if let cc = patient.chiefComplaint, !cc.isEmpty {
            if isAccessibilitySize {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        complaintIcon("text.bubble")
                        Text(cc).font(.caption2).foregroundStyle(.secondary).lineLimit(lines)
                    }
                    if let dx = patient.workingDiagnosis {
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            complaintIcon("stethoscope")
                            Text(dx).font(.caption2).foregroundStyle(.teal).lineLimit(lines)
                        }
                    }
                }
            } else {
                HStack(spacing: 4) {
                    complaintIcon("text.bubble")
                    Text(cc).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    if let dx = patient.workingDiagnosis {
                        Text("→").font(.caption2).foregroundStyle(.tertiary)
                        complaintIcon("stethoscope")
                        Text(dx).font(.caption2).foregroundStyle(.teal).lineLimit(1)
                    }
                }
            }
        } else if let dx = patient.workingDiagnosis {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                complaintIcon("stethoscope")
                Text(dx).font(.caption2).foregroundStyle(.teal).lineLimit(lines)
            }
        }
    }

    // MARK: Row 4: NEWS2 (always shown) + POD + safety badges

    @ViewBuilder
    private func news2Summary(_ f: RowFacts) -> some View {
        if let days = patient.postOpDays {
            Text("POD \(days)")
                .scaledFont(size: 9, weight: .bold)
                .foregroundStyle(AMColor.accent)
        }
        if let v = f.news2 {
            let news2Trend = ListPerf.news2TrendArrow(f.news2Delta)
            Circle()
                .fill(Color(hex: v.colorHex))
                .frame(width: 6, height: 6)
            Text("NEWS2 \(v.score)")
                .scaledFont(size: 9, weight: .bold)
                .foregroundStyle(Color(hex: v.colorHex))
            if !news2Trend.isEmpty {
                Text(news2Trend)
                    .scaledFont(size: 10, weight: .bold)
                    .foregroundStyle(news2TrendColor(f.news2Delta))
            }
            Text(v.riskDisplay)
                .scaledFont(size: 9)
                .foregroundStyle(Color(hex: v.colorHex).opacity(0.8))
        } else {
            Circle()
                .fill(Color.secondary.opacity(0.3))
                .frame(width: 6, height: 6)
            Text("No vitals")
                .scaledFont(size: 9)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func safetyBadges(_ f: RowFacts) -> some View {
        if patient.hasCriticalAllergy {
            Label("Allergy", systemImage: "exclamationmark.shield.fill")
                .scaledFont(size: 9, weight: .bold)
                .foregroundStyle(.red)
                .labelStyle(.iconOnly)
        } else if !patient.allergies.isEmpty {
            Label("Allergy", systemImage: "exclamationmark.shield")
                .scaledFont(size: 9, weight: .semibold)
                .foregroundStyle(.orange)
                .labelStyle(.iconOnly)
        }
        if patient.hasAnticoagulation {
            Label("Anticoag", systemImage: "drop.fill")
                .scaledFont(size: 9, weight: .bold)
                .foregroundStyle(.purple)
                .labelStyle(.iconOnly)
        }
        if f.hasCriticalLabs {
            Label("Critical labs", systemImage: "flask.fill")
                .scaledFont(size: 9, weight: .bold)
                .foregroundStyle(.red)
                .labelStyle(.iconOnly)
        } else if f.hasPendingLabs {
            Label("Pending labs", systemImage: "clock.badge.exclamationmark")
                .scaledFont(size: 9)
                .foregroundStyle(.orange)
                .labelStyle(.iconOnly)
        }
    }

    @ViewBuilder
    private func news2Line(_ f: RowFacts) -> some View {
        if isAccessibilitySize {
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 6) { news2Summary(f) }
                HStack(spacing: 6) { safetyBadges(f) }
            }
        } else {
            HStack(spacing: 6) {
                news2Summary(f)
                Spacer()
                safetyBadges(f)
            }
        }
    }
}
