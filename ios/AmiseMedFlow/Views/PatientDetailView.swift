import SwiftUI
import SwiftData
import UIKit

// MARK: - PDF share helpers

struct PDFDataWrapper: Identifiable {
    let id = UUID()
    let data: Data
}

// MARK: - Patient detail section enum (iPad/Mac sidebar)

enum PatientDetailSection: String, CaseIterable, Identifiable, Hashable {
    // Summary
    case overview       = "Overview"
    // Consultation sub-sections (map to ConsultTab)
    case cc             = "Chief Complaint"
    case hpi            = "History of Present Illness"
    case pmh            = "Past Medical History"
    case pshx           = "Surgical History"
    case allergies      = "Allergies"
    case social         = "Social History"
    case exam           = "Examination"
    case investigations = "Investigations"
    case assessment     = "Assessment / Dx"
    case plan           = "Management Plan"
    // Clinical
    case notes          = "Notes"
    case vitals         = "Vitals"
    case prescriptions  = "Prescriptions"
    case billing        = "Billing"
    case operative      = "Operative Plan"
    case documents      = "Documents"
    case demographics   = "Demographics"
    case trauma         = "Trauma / ATLS"
    case ogd            = "OGD Report"
    case surgery        = "Operative Note"
    case ercp           = "ERCP Report"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .overview:       "person.text.rectangle"
        case .cc:             "text.bubble"
        case .hpi:            "doc.text"
        case .pmh:            "clock.arrow.circlepath"
        case .pshx:           "bandage"
        case .allergies:      "exclamationmark.shield"
        case .social:         "person.2"
        case .exam:           "stethoscope"
        case .investigations: "testtube.2"
        case .assessment:     "brain.head.profile"
        case .plan:           "list.bullet.clipboard"
        case .notes:          "note.text"
        case .vitals:         "waveform.path.ecg"
        case .prescriptions:  "pills"
        case .billing:        "dollarsign.circle"
        case .operative:      "scissors"
        case .documents:      "doc.badge.plus"
        case .demographics:   "square.and.pencil"
        case .trauma:         "cross.case.fill"
        case .ogd:            "scope"
        case .surgery:        "scissors"
        case .ercp:           "waveform.and.magnifyingglass"
        }
    }

    var shortLabel: String {
        switch self {
        case .overview:       "Overview"
        case .cc:             "CC"
        case .hpi:            "HPI"
        case .pmh:            "PMH"
        case .pshx:           "PSHx"
        case .allergies:      "Allergies"
        case .social:         "Social"
        case .exam:           "Exam"
        case .investigations: "Ix"
        case .assessment:     "Assess"
        case .plan:           "Plan"
        case .notes:          "Notes"
        case .vitals:         "Vitals"
        case .prescriptions:  "Rx"
        case .billing:        "Billing"
        case .operative:      "Op Plan"
        case .documents:      "Docs"
        case .demographics:   "Details"
        case .trauma:         "Trauma"
        case .ogd:            "OGD"
        case .surgery:        "Op Note"
        case .ercp:           "ERCP"
        }
    }

    var consultTab: ConsultTab? {
        switch self {
        case .cc:             .cc
        case .hpi:            .hpi
        case .pmh:            .pmh
        case .pshx:           .pshx
        case .allergies:      .allergies
        case .social:         .social
        case .exam:           .exam
        case .investigations: .investigations
        case .assessment:     .diagnosis
        case .plan:           .plan
        default:              nil
        }
    }
}

// MARK: - iPad/Mac: patient detail with horizontal top nav bar

struct PatientDetailPadView: View {
    @Bindable var patient: Patient
    var onBack: (() -> Void)? = nil
    @State private var selectedSection: PatientDetailSection? = .overview
    @State private var summaryPDFData: Data? = nil
    @State private var showSummaryEditor = false

    // Clinical sections — core always visible; procedure forms appear when visit type matches
    private var rightSections: [PatientDetailSection] {
        let sections = PatientDetailSection.allCases.filter { section in
            switch section {
            case .trauma:  return patient.visitType == .trauma
            case .ogd:     return patient.visitType == .ogd || patient.visitType == .colonoscopy || patient.visitType == .dayOfSurgery
            case .surgery: return patient.visitType == .surgeryElective || patient.visitType == .surgeryEmergency || patient.visitType == .dayOfSurgery
            case .ercp:    return patient.visitType == .ercp || patient.visitType == .dayOfSurgery
            default:       return true
            }
        }
        return sections
    }

    var body: some View {
        VStack(spacing: 0) {
            // ── TOP: compact patient identifier strip ──────────────────────
            patientHeader
                .background(Color(.systemBackground))

            Divider()

            // ── BOTTOM: full-width section nav + clinical content ─────────
            VStack(spacing: 0) {
                sectionNav
                sectionContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AMColor.bg)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .sheet(item: Binding(
            get: { summaryPDFData.map { PDFDataWrapper(data: $0) } },
            set: { if $0 == nil { summaryPDFData = nil } }
        )) { wrapper in
            ShareSheet(items: [wrapper.data as Any])
                .ignoresSafeArea()
        }
        .sheet(isPresented: $showSummaryEditor) {
            PatientSummaryEditorView(patient: patient)
        }
    }

    // MARK: Compact patient header strip

    private var patientHeader: some View {
        HStack(spacing: 12) {
            if let onBack {
                Button { onBack() } label: {
                    Image(systemName: "chevron.left")
                        .fontWeight(.semibold)
                        .foregroundStyle(AMColor.accent)
                }
                .buttonStyle(.plain)
            }

            AcuityPip(acuity: patient.acuity)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(patient.fullName)
                        .font(.headline)
                        .lineLimit(1)
                    if patient.hasCriticalAllergy {
                        Image(systemName: "exclamationmark.shield.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.red)
                    }
                    if patient.hasAnticoagulation {
                        Image(systemName: "drop.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.purple)
                    }
                }
                HStack(spacing: 8) {
                    Text([patient.sex.rawValue, patient.ageDisplay, patient.setting.rawValue]
                        .compactMap { $0 }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let mrn = patient.mrn, !mrn.isEmpty {
                        Text("MRN \(mrn)")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                    if let dob = patient.dateOfBirth {
                        Text(dob, format: .dateTime.day().month(.abbreviated).year())
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let dx = patient.workingDiagnosis {
                Text(dx)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.teal)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.teal.opacity(0.1), in: Capsule())
                    .lineLimit(1)
            }

            Spacer()

            HStack(spacing: 14) {
                Button { showSummaryEditor = true } label: {
                    Image(systemName: "doc.text.fill")
                        .foregroundStyle(AMColor.accent)
                }
                .buttonStyle(.plain)
                .help("Clinical Summary")

                ShareLink(item: patient.handoverText,
                          subject: Text("Patient Handover — \(patient.fullName)"),
                          message: Text(patient.handoverText)) {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(AMColor.accent)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: Section nav (right panel)

    private var sectionNav: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(rightSections) { section in
                    let sel = selectedSection == section
                    Button { selectedSection = section } label: {
                        VStack(spacing: 3) {
                            Image(systemName: section.icon)
                                .font(.system(size: 15, weight: sel ? .semibold : .regular))
                            Text(section.shortLabel)
                                .font(.system(size: 9, weight: sel ? .bold : .semibold))
                                .lineLimit(1)
                        }
                        .foregroundStyle(sel ? AMColor.sidebarActive : AMColor.sidebarText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .frame(minWidth: 62)
                        .background(sel ? AMColor.accent.opacity(0.18) : Color.clear)
                        .overlay(alignment: .bottom) {
                            if sel { Rectangle().fill(AMColor.accent).frame(height: 2) }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .background(AMColor.sidebarBg)
        .overlay(alignment: .bottom) {
            Divider().overlay(AMColor.sidebarGroup.opacity(0.5))
        }
    }

    // MARK: Section content (right panel)

    @ViewBuilder
    private var sectionContent: some View {
        switch selectedSection ?? .overview {
        case .overview:
            // Quick-action hub — left panel already shows the full summary
            DiagnosisHubView(patient: patient, onNavigate: { selectedSection = $0 })
        case .cc:
            ConsultationView(patient: patient, startingTab: .cc, embeddedInNav: true)
        case .hpi:
            ConsultationView(patient: patient, startingTab: .hpi, embeddedInNav: true)
        case .pmh:
            ConsultationView(patient: patient, startingTab: .pmh, embeddedInNav: true)
        case .pshx:
            ConsultationView(patient: patient, startingTab: .pshx, embeddedInNav: true)
        case .allergies:
            ConsultationView(patient: patient, startingTab: .allergies, embeddedInNav: true)
        case .social:
            ConsultationView(patient: patient, startingTab: .social, embeddedInNav: true)
        case .exam:
            ConsultationView(patient: patient, startingTab: .exam, embeddedInNav: true)
        case .investigations:
            ConsultationView(patient: patient, startingTab: .investigations, embeddedInNav: true)
        case .assessment:
            ConsultationView(patient: patient, startingTab: .diagnosis, embeddedInNav: true)
        case .plan:
            ConsultationView(patient: patient, startingTab: .plan, embeddedInNav: true)
        case .notes:
            List { NoteListView(patient: patient) }
        case .vitals:
            List { VitalsHistoryView(patient: patient) }
        case .prescriptions:
            PrescriptionView(patient: patient)
        case .billing:
            BillingView(patient: patient)
        case .operative:
            OperativePlanView(patient: patient)
        case .documents:
            DocumentsView(patient: patient)
        case .demographics:
            PatientDemographicsForm(patient: patient)
        case .trauma:
            TraumaAssessmentView(patient: patient)
        case .ogd:
            OGDFormView(patient: patient)
        case .surgery:
            SurgeryNoteView(patient: patient)
        case .ercp:
            ERCPFormView(patient: patient)
        }
    }
}

// MARK: - Overview content (shared between iPhone overview tab and iPad panel)

struct PatientOverviewContent: View {
    @Bindable var patient: Patient

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    private var latestNote: ClinicalNote? {
        patient.clinicalNotes.sorted { $0.createdAt > $1.createdAt }.first
    }

    private var criticalAllergies: [AllergyEntry] {
        patient.allergies.filter {
            $0.severity.lowercased().contains("anaphylaxis") ||
            $0.severity.lowercased().contains("severe")
        }
    }

    private var news2AlertLevel: Int {
        guard let v = latestVitals, v.hasAnyValue else { return 0 }
        return v.news2Score
    }

    // MARK: - Clinical checklist

    private struct CheckItem: Identifiable {
        let id: String
        let label: String
        let icon: String
        let done: Bool
    }

    private var checkItems: [CheckItem] {
        var items: [CheckItem] = [
            CheckItem(id: "complaint",     label: "Complaint",    icon: "text.bubble",        done: !(patient.chiefComplaint ?? "").isEmpty),
            CheckItem(id: "diagnosis",     label: "Diagnosis",    icon: "stethoscope",         done: patient.workingDiagnosis != nil),
            CheckItem(id: "allergies",     label: "Allergies",    icon: "exclamationmark.shield", done: !patient.allergies.isEmpty),
            CheckItem(id: "vitals",        label: "Vitals",       icon: "waveform.path.ecg",   done: !patient.vitalsEntries.isEmpty),
            CheckItem(id: "notes",         label: "Note",         icon: "note.text",           done: patient.clinicalNotes.contains { !$0.isEmpty }),
            CheckItem(id: "signed",        label: "Signed",       icon: "checkmark.seal",      done: patient.clinicalNotes.contains { $0.status == .signed }),
            CheckItem(id: "prescriptions", label: "Prescriptions",icon: "pills",               done: !patient.prescriptions.isEmpty),
        ]
        switch patient.setting {
        case .inpatient, .emergency:
            items.append(CheckItem(id: "admission", label: "Admitted", icon: "bed.double",  done: patient.admittedAt != nil))
        case .theatre:
            items.append(CheckItem(id: "opplan",  label: "Op Plan", icon: "scissors",       done: !patient.operativePlans.isEmpty))
            items.append(CheckItem(id: "opdate",  label: "Op Date", icon: "calendar",       done: patient.operationDate != nil))
        case .endoscopy:
            items.append(CheckItem(id: "scopedate", label: "Scope Date", icon: "calendar",  done: patient.operationDate != nil))
        default:
            break
        }
        return items
    }

    @ViewBuilder
    private var checklistRow: some View {
        let pending = checkItems.filter { !$0.done }
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: pending.isEmpty ? "checkmark.circle.fill" : "circle.dotted")
                    .font(.system(size: 11))
                    .foregroundStyle(pending.isEmpty ? .green : .orange)
                Text(pending.isEmpty
                     ? "Chart complete"
                     : "\(pending.count) section\(pending.count == 1 ? "" : "s") pending")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(pending.isEmpty ? .green : .orange)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(checkItems) { item in
                        HStack(spacing: 3) {
                            Image(systemName: item.done ? "checkmark" : "circle")
                                .font(.system(size: 8, weight: .bold))
                            Text(item.label)
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(item.done ? AMColor.accent : .orange)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            (item.done ? AMColor.accent : Color.orange).opacity(0.1),
                            in: Capsule()
                        )
                        .overlay(
                            Capsule()
                                .stroke((item.done ? AMColor.accent : Color.orange).opacity(0.25), lineWidth: 0.5)
                        )
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }

    private func notePreview(_ note: ClinicalNote) -> String? {
        if note.noteType.isStructured {
            return [note.assessment, note.plan]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty })
        }
        return note.freeText.map { String($0.prefix(300)) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header card — web-style with accent teal
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(AMColor.accent.opacity(0.15))
                        .frame(width: 64, height: 64)
                    Text(patient.initials)
                        .font(.system(size: 24, weight: .heavy))
                        .foregroundStyle(AMColor.accentDk)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(patient.fullName)
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(AMColor.ink)
                    HStack(spacing: 6) {
                        Text(patient.ageDisplay.map { "\(patient.sex.rawValue), \($0)" } ?? patient.sex.rawValue)
                        Text("·")
                        Text(patient.location.rawValue)
                        if let mrn = patient.mrn, !mrn.isEmpty {
                            Text("·")
                            Text("MRN \(mrn)")
                        }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(AMColor.muted)
                    HStack(spacing: 6) {
                        AcuityPip(acuity: patient.acuity)
                        Label(patient.setting.rawValue, systemImage: patient.setting.icon)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(AMColor.accent)
                    }
                    // Contact quick-actions
                    if let phone = patient.phone, !phone.isEmpty {
                        let digits = phone.filter { $0.isNumber || $0 == "+" }
                        if let tel = URL(string: "tel:\(digits)") {
                            Link(destination: tel) {
                                Label(phone, systemImage: "phone.fill")
                                    .font(.system(size: 12))
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                    if let email = patient.email, !email.isEmpty,
                       let mailto = URL(string: "mailto:\(email)") {
                        Link(destination: mailto) {
                            Label(email, systemImage: "envelope.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(AMColor.accent)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AMColor.accentLt.opacity(0.5), in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(AMColor.accent.opacity(0.3), lineWidth: 1)
            )

            // Clinical checklist
            checklistRow

            // Safety banners
            if news2AlertLevel >= 5 || !criticalAllergies.isEmpty {
                VStack(spacing: 8) {
                    if news2AlertLevel >= 5 {
                        HStack(spacing: 8) {
                            Image(systemName: news2AlertLevel >= 7
                                  ? "exclamationmark.triangle.fill"
                                  : "exclamationmark.triangle")
                            VStack(alignment: .leading, spacing: 1) {
                                Text(news2AlertLevel >= 7 ? "HIGH NEWS2 RISK" : "MEDIUM NEWS2 RISK")
                                    .font(.system(size: 11, weight: .heavy))
                                    .tracking(0.5)
                                Text("Score \(news2AlertLevel) — \(latestVitals?.news2Risk ?? "")")
                                    .font(.caption2)
                            }
                            Spacer()
                        }
                        .foregroundStyle(news2AlertLevel >= 7 ? Color.red : Color.orange)
                        .padding(10)
                        .background(
                            (news2AlertLevel >= 7 ? Color.red : Color.orange).opacity(0.1),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(news2AlertLevel >= 7 ? Color.red.opacity(0.4) : Color.orange.opacity(0.4), lineWidth: 1)
                        )
                    }

                    if !criticalAllergies.isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.shield.fill")
                            VStack(alignment: .leading, spacing: 2) {
                                Text("CRITICAL ALLERGY")
                                    .font(.system(size: 11, weight: .heavy))
                                    .tracking(0.5)
                                Text(criticalAllergies.map { "\($0.name) (\($0.severity))" }.joined(separator: " · "))
                                    .font(.caption2)
                                    .lineLimit(2)
                            }
                            Spacer()
                        }
                        .foregroundStyle(Color.red)
                        .padding(10)
                        .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.red.opacity(0.35), lineWidth: 1)
                        )
                    }
                }
            }

            // Chief complaint
            if let cc = patient.chiefComplaint {
                overviewCard(title: "Chief Complaint") {
                    Text(cc)
                }
            }

            // Working diagnosis
            if let dx = patient.workingDiagnosis {
                overviewCard(title: "Working Diagnosis") {
                    HStack(spacing: 8) {
                        Image(systemName: "stethoscope").foregroundStyle(.teal)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dx).font(.subheadline.weight(.medium))
                            if let icd = patient.workingDiagnosisICD {
                                Text(icd).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            // Pending investigations
            let pendingInvs = patient.investigations.filter { $0.status == .ordered || $0.status == .pending }
            if !pendingInvs.isEmpty {
                overviewCard(title: "Pending Investigations (\(pendingInvs.count))") {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(pendingInvs.prefix(6), id: \.id) { inv in
                            HStack(spacing: 6) {
                                Image(systemName: inv.category.icon)
                                    .font(.system(size: 10))
                                    .foregroundStyle(.secondary)
                                    .frame(width: 14)
                                Text(inv.name)
                                    .font(.system(size: 13))
                                Spacer()
                                Text(inv.status == .ordered ? "Ordered" : "Pending")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(inv.status == .ordered ? .blue : .orange)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background((inv.status == .ordered ? Color.blue : Color.orange).opacity(0.1), in: Capsule())
                            }
                        }
                        if pendingInvs.count > 6 {
                            Text("+\(pendingInvs.count - 6) more")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            // Admission
            if patient.setting == .inpatient || patient.setting == .emergency {
                overviewCard(title: "Admission") {
                    if let ward = patient.ward {
                        LabeledContent("Ward", value: ward)
                    }
                    if let bed = patient.bedNumber {
                        LabeledContent("Bed", value: bed)
                    }
                    if let admitted = patient.admittedAt {
                        let los = max(0, Calendar.current.dateComponents([.day], from: admitted, to: .now).day ?? 0)
                        LabeledContent("Admitted") {
                            Text(admitted, style: .date) +
                            Text("  (Day \(los + 1))").foregroundColor(.secondary)
                        }
                    }
                    if let exp = patient.expectedDischarge {
                        let daysLeft = Calendar.current.dateComponents([.day], from: .now, to: exp).day ?? 0
                        LabeledContent("Expected d/c") {
                            HStack(spacing: 4) {
                                Text(exp, style: .date)
                                Text(daysLeft <= 1 ? "(today/tomorrow)" : "(\(daysLeft)d)")
                                    .font(.caption2)
                                    .foregroundStyle(daysLeft <= 1 ? .orange : .secondary)
                            }
                        }
                    }
                }
            }

            // Post-operative
            if let days = patient.postOpDays {
                overviewCard(title: "Post-operative") {
                    LabeledContent("Post-op day", value: "POD \(days)")
                    if let op = patient.operationDate {
                        LabeledContent("Operation date") { Text(op, style: .date) }
                    }
                }
            }

            // Latest vitals
            if let v = latestVitals {
                overviewCard(title: "Latest Vitals — \(v.recordedAt.formatted(.relative(presentation: .named)))") {
                    HStack {
                        Spacer()
                        Text("NEWS2 \(v.news2Score) — \(v.news2Risk)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color(hex: v.news2Color))
                    }
                    if let bp = v.bpString {
                        LabeledContent("BP", value: "\(bp) mmHg")
                    }
                    if let hr = v.heartRate {
                        LabeledContent("HR", value: "\(hr) bpm")
                    }
                    if let temp = v.temperatureCelsius {
                        LabeledContent("Temp", value: String(format: "%.1f °C", temp))
                    }
                    if let spo = v.spo2 {
                        LabeledContent("SpO₂", value: "\(spo)%")
                    }
                    if let wt = v.weightKg {
                        if let bmi = patient.latestBMI(), let cat = patient.bmiCategory {
                            LabeledContent("Weight / BMI") {
                                Text(String(format: "%.1f kg · BMI %.1f (%@)", wt, bmi, cat))
                                    .foregroundStyle(bmi < 18.5 || bmi >= 30 ? .orange : .primary)
                            }
                        } else {
                            LabeledContent("Weight", value: String(format: "%.1f kg", wt))
                        }
                    }
                }
            }

            // Active medications
            if !patient.prescriptions.isEmpty {
                overviewCard(title: "Active Medications (\(patient.prescriptions.count))") {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(patient.prescriptions.prefix(5), id: \.id) { rx in
                            HStack(spacing: 6) {
                                Image(systemName: "pills.fill")
                                    .font(.system(size: 10))
                                    .foregroundStyle(.purple)
                                Text(rx.displayLine)
                                    .font(.system(size: 13))
                                    .lineLimit(1)
                            }
                        }
                        if patient.prescriptions.count > 5 {
                            Text("+\(patient.prescriptions.count - 5) more")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            // Social history snapshot
            if let social = patient.socialHistory, !social.isEmpty {
                overviewCard(title: "Social History") {
                    Text(social)
                        .font(.system(size: 13))
                        .lineLimit(6)
                        .foregroundStyle(.secondary)
                }
            }

            // Latest note
            if let note = latestNote {
                overviewCard(title: "Latest Note — \(note.noteType.label)") {
                    Text(note.createdAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let preview = notePreview(note) {
                        Text(preview).font(.callout).lineLimit(6)
                    }
                }
            }

            // Next of kin contact
            if let nokName = patient.nokName, !nokName.isEmpty {
                overviewCard(title: "Next of Kin") {
                    HStack(spacing: 8) {
                        Image(systemName: "person.2.fill")
                            .foregroundStyle(.secondary)
                            .font(.system(size: 13))
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(nokName)
                                    .font(.system(size: 13, weight: .semibold))
                                if let rel = patient.nokRelation, !rel.isEmpty {
                                    Text("(\(rel))")
                                        .font(.system(size: 12))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if let nokPhone = patient.nokPhone, !nokPhone.isEmpty {
                                let digits = nokPhone.filter { $0.isNumber || $0 == "+" }
                                if let tel = URL(string: "tel:\(digits)") {
                                    Link(destination: tel) {
                                        Label(nokPhone, systemImage: "phone.fill")
                                            .font(.system(size: 12))
                                            .foregroundStyle(.green)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func overviewCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).amSectionLabel()
            VStack(alignment: .leading, spacing: 8) {
                content()
            }
            .amCard()
        }
    }
}

// MARK: - Demographics form (shared between iPhone details tab and iPad panel)

struct PatientDemographicsForm: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var hasDOB: Bool = false
    @State private var heightStr: String = ""

    var body: some View {
        Form {
            demographicsSection
            clinicalSection
            anthropometricsSection
            if patient.setting == .inpatient || patient.setting == .emergency {
                admissionSection
            }
            if patient.setting == .theatre || patient.setting == .endoscopy {
                procedureSection
            }
            extendedSection
            notesSection
        }
        .onAppear {
            hasDOB = patient.dateOfBirth != nil
            heightStr = patient.heightCm.map { String(format: "%.0f", $0) } ?? ""
        }
    }

    private func touch() {
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    // MARK: Identity

    @ViewBuilder
    private var demographicsSection: some View {
        Section("Identity") {
            TextField("Full name", text: $patient.fullName)
                .onChange(of: patient.fullName) { _, _ in touch() }
            Picker("Sex", selection: $patient.sex) {
                ForEach(Sex.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .onChange(of: patient.sex) { _, _ in touch() }
            Toggle("Date of birth", isOn: $hasDOB)
                .onChange(of: hasDOB) { _, on in
                    if !on { patient.dateOfBirth = nil; touch() }
                    else if patient.dateOfBirth == nil {
                        patient.dateOfBirth = Calendar.current.date(byAdding: .year, value: -40, to: .now)
                        touch()
                    }
                }
            if hasDOB {
                DatePicker("", selection: Binding(
                    get: { patient.dateOfBirth ?? .now },
                    set: { patient.dateOfBirth = $0; touch() }
                ), displayedComponents: .date)
                .labelsHidden()
                LabeledContent("Age") { Text(patient.ageDisplay ?? "—") }
            }
            TextField("MRN (optional)", text: Binding(
                get: { patient.mrn ?? "" },
                set: { patient.mrn = $0.isEmpty ? nil : $0; touch() }
            ))
        }
        Section("Contact") {
            TextField("Phone", text: Binding(
                get: { patient.phone ?? "" },
                set: { patient.phone = $0.isEmpty ? nil : $0; touch() }
            )).keyboardType(.phonePad)
            TextField("Email", text: Binding(
                get: { patient.email ?? "" },
                set: { patient.email = $0.isEmpty ? nil : $0; touch() }
            )).keyboardType(.emailAddress).autocapitalization(.none)
            TextField("Address", text: Binding(
                get: { patient.address ?? "" },
                set: { patient.address = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Clinical

    @ViewBuilder
    private var clinicalSection: some View {
        Section("Clinical") {
            Picker("Setting", selection: $patient.setting) {
                ForEach(ClinicalSetting.allCases, id: \.self) {
                    Label($0.rawValue, systemImage: $0.icon).tag($0)
                }
            }
            .onChange(of: patient.setting) { _, _ in touch() }
            Picker("Location", selection: $patient.location) {
                ForEach(ClinicalLocation.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .onChange(of: patient.location) { _, _ in touch() }
            Picker("Acuity", selection: $patient.acuity) {
                ForEach(Acuity.allCases, id: \.self) { acuity in
                    HStack {
                        AcuityPip(acuity: acuity)
                        Text(acuity.label)
                    }.tag(acuity)
                }
            }
            .onChange(of: patient.acuity) { _, _ in touch() }
            Picker("Visit Type", selection: Binding(
                get: { patient.visitType ?? .newConsult },
                set: { patient.visitType = $0; touch() }
            )) {
                ForEach(VisitType.allCases, id: \.self) { vt in
                    Label(vt.rawValue, systemImage: vt.icon).tag(vt)
                }
            }
            TextField("Chief complaint", text: Binding(
                get: { patient.chiefComplaint ?? "" },
                set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Anthropometrics

    @ViewBuilder
    private var anthropometricsSection: some View {
        Section("Anthropometrics") {
            HStack {
                TextField("Height (cm)", text: $heightStr)
                    .keyboardType(.decimalPad)
                    .onChange(of: heightStr) { _, v in
                        patient.heightCm = Double(v) ?? nil
                        touch()
                    }
                Text("cm").foregroundStyle(.secondary)
            }
            if let bmi = patient.latestBMI(), let cat = patient.bmiCategory {
                LabeledContent("BMI") {
                    Text(String(format: "%.1f — %@", bmi, cat))
                        .foregroundStyle(bmi < 18.5 || bmi >= 30 ? .orange : .secondary)
                }
            } else if patient.heightCm != nil {
                Label("Record weight in Vitals to calculate BMI", systemImage: "scalemass")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: Admission

    @ViewBuilder
    private var admissionSection: some View {
        Section("Admission") {
            TextField("Ward", text: Binding(
                get: { patient.ward ?? "" },
                set: { patient.ward = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Bed", text: Binding(
                get: { patient.bedNumber ?? "" },
                set: { patient.bedNumber = $0.isEmpty ? nil : $0; touch() }
            ))
            DatePicker(
                "Admitted",
                selection: Binding(
                    get: { patient.admittedAt ?? .now },
                    set: { patient.admittedAt = $0; touch() }
                ),
                displayedComponents: [.date, .hourAndMinute]
            )
            if let admitted = patient.admittedAt {
                let los = max(0, Calendar.current.dateComponents([.day], from: admitted, to: .now).day ?? 0)
                LabeledContent("Length of stay") { Text("Day \(los + 1)") }
            }
            Toggle("Expected discharge date", isOn: Binding(
                get: { patient.expectedDischarge != nil },
                set: { on in
                    patient.expectedDischarge = on
                        ? (patient.expectedDischarge ?? Calendar.current.date(byAdding: .day, value: 3, to: .now) ?? .now)
                        : nil
                    touch()
                }
            ))
            if patient.expectedDischarge != nil {
                DatePicker(
                    "Expected d/c",
                    selection: Binding(
                        get: { patient.expectedDischarge ?? .now },
                        set: { patient.expectedDischarge = $0; touch() }
                    ),
                    displayedComponents: .date
                )
            }
        }
    }

    // MARK: Procedure

    @ViewBuilder
    private var procedureSection: some View {
        Section("Procedure") {
            TextField("Appointment / procedure type", text: Binding(
                get: { patient.appointmentType ?? "" },
                set: { patient.appointmentType = $0.isEmpty ? nil : $0; touch() }
            ))
            DatePicker("Date & time",
                       selection: Binding(
                           get: { patient.operationDate ?? .now },
                           set: { patient.operationDate = $0; touch() }
                       ),
                       displayedComponents: [.date, .hourAndMinute])
            if let days = patient.postOpDays {
                LabeledContent("Post-op day", value: "POD \(days)")
            }
        }
    }

    // MARK: Extended

    @ViewBuilder
    private var extendedSection: some View {
        Section("Medical History") {
            TextField("Past medical history", text: Binding(
                get: { patient.pmhNotes ?? "" },
                set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(3...)
            TextField("Surgical history", text: Binding(
                get: { patient.surgicalHistory ?? "" },
                set: { patient.surgicalHistory = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(2...)
            TextField("Family history", text: Binding(
                get: { patient.familyHistoryNotes ?? "" },
                set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(2...)
        }
        Section("Next of Kin") {
            TextField("Name", text: Binding(
                get: { patient.nokName ?? "" },
                set: { patient.nokName = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Relationship", text: Binding(
                get: { patient.nokRelation ?? "" },
                set: { patient.nokRelation = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Phone", text: Binding(
                get: { patient.nokPhone ?? "" },
                set: { patient.nokPhone = $0.isEmpty ? nil : $0; touch() }
            )).keyboardType(.phonePad)
        }
        Section("Insurance") {
            TextField("Provider", text: Binding(
                get: { patient.insuranceProvider ?? "" },
                set: { patient.insuranceProvider = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Policy number", text: Binding(
                get: { patient.policyNumber ?? "" },
                set: { patient.policyNumber = $0.isEmpty ? nil : $0; touch() }
            ))
        }
        Section("Referral") {
            Picker("Source", selection: Binding(
                get: { patient.referralSource ?? .selfReferral },
                set: { patient.referralSource = $0; touch() }
            )) {
                ForEach(ReferralSource.allCases, id: \.self) { src in
                    Text(src.rawValue).tag(src)
                }
            }
            TextField("Referring doctor", text: Binding(
                get: { patient.referringDoctor ?? "" },
                set: { patient.referringDoctor = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Referring practice", text: Binding(
                get: { patient.referringPractice ?? "" },
                set: { patient.referringPractice = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Notes

    @ViewBuilder
    private var notesSection: some View {
        Section("General Notes") {
            TextEditor(text: Binding(
                get: { patient.notes ?? "" },
                set: { patient.notes = $0.isEmpty ? nil : $0; touch() }
            ))
            .frame(minHeight: 80)
        }
    }
}

// MARK: - iPhone: 5-tab patient detail (sheet presentation)

enum PatientTab { case overview, clinical, notes, vitals, demographics }

struct PatientDetailView: View {
    @Bindable var patient: Patient
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context

    @State private var selectedTab: PatientTab = .overview
    @State private var showDeleteConfirm = false

    // MARK: Quick-action strip — top of Overview tab

    private var quickActionsStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                quickAction("Consultation", icon: "cross.case.fill", color: .teal,
                            destination: AnyView(ConsultationView(patient: patient, startingTab: .hpi)))
                quickAction("Assessment", icon: "brain.head.profile", color: .indigo,
                            destination: AnyView(AssessmentView(patient: patient)))
                // Procedure-specific quick actions
                if patient.visitType == .trauma {
                    quickAction("Trauma ATLS", icon: "cross.case.fill", color: .red,
                                destination: AnyView(TraumaAssessmentView(patient: patient)))
                }
                if patient.visitType == .surgeryElective || patient.visitType == .surgeryEmergency || patient.visitType == .dayOfSurgery {
                    quickAction("Op Note", icon: "scissors", color: .purple,
                                destination: AnyView(SurgeryNoteView(patient: patient)))
                }
                if patient.visitType == .ogd || patient.visitType == .colonoscopy || patient.visitType == .dayOfSurgery {
                    quickAction("OGD Report", icon: "scope", color: .cyan,
                                destination: AnyView(OGDFormView(patient: patient)))
                }
                if patient.visitType == .ercp || patient.visitType == .dayOfSurgery {
                    quickAction("ERCP Report", icon: "waveform.and.magnifyingglass", color: .blue,
                                destination: AnyView(ERCPFormView(patient: patient)))
                }
                quickAction("Prescriptions", icon: "pills.fill", color: .purple,
                            destination: AnyView(PrescriptionView(patient: patient)))
                quickAction("Documents", icon: "doc.badge.plus", color: .blue,
                            destination: AnyView(DocumentsView(patient: patient)))
                quickAction("Billing", icon: "dollarsign.circle.fill", color: .green,
                            destination: AnyView(BillingView(patient: patient)))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Color(.secondarySystemBackground))
    }

    @ViewBuilder
    private func quickAction(_ label: String, icon: String, color: Color, destination: AnyView) -> some View {
        NavigationLink { destination } label: {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(width: 44, height: 44)
                    .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .buttonStyle(.plain)
    }

    private var latestNews2: (score: Int, color: Color, risk: String)? {
        guard let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
              v.hasAnyValue else { return nil }
        return (v.news2Score, Color(hex: v.news2Color), v.news2Risk)
    }

    var body: some View {
        NavigationStack {
            TabView(selection: $selectedTab) {
                VStack(spacing: 0) {
                    quickActionsStrip
                    Divider()
                    ScrollView {
                        PatientOverviewContent(patient: patient)
                            .padding()
                    }
                }
                .tag(PatientTab.overview)
                .tabItem { Label("Overview", systemImage: "person.text.rectangle") }

                ClinicalHubView(patient: patient)
                    .tag(PatientTab.clinical)
                    .tabItem { Label("Clinical", systemImage: "stethoscope") }

                List { NoteListView(patient: patient) }
                    .tag(PatientTab.notes)
                    .tabItem { Label("Notes", systemImage: "note.text") }

                List { VitalsHistoryView(patient: patient) }
                    .tag(PatientTab.vitals)
                    .tabItem { Label("Vitals", systemImage: "waveform.path.ecg") }

                PatientDemographicsForm(patient: patient)
                    .tag(PatientTab.demographics)
                    .tabItem { Label("Details", systemImage: "square.and.pencil") }
            }
            .background(Color(.systemBackground))
            .navigationTitle(patient.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .destructive) { showDeleteConfirm = true } label: {
                        Image(systemName: "trash")
                    }
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 1) {
                        Text(patient.fullName)
                            .font(.system(size: 14, weight: .semibold))
                            .lineLimit(1)
                        if let n = latestNews2 {
                            HStack(spacing: 3) {
                                Circle().fill(n.color).frame(width: 5, height: 5)
                                Text("NEWS2 \(n.score) · \(n.risk)")
                                    .font(.system(size: 9, weight: .semibold))
                                    .foregroundStyle(n.color)
                            }
                        } else {
                            HStack(spacing: 3) {
                                Circle().fill(Color.secondary.opacity(0.4)).frame(width: 5, height: 5)
                                Text("No vitals")
                                    .font(.system(size: 9))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    HStack {
                        ShareLink(item: patient.handoverText,
                                  subject: Text("Patient Handover — \(patient.fullName)"),
                                  message: Text(patient.handoverText)) {
                            Image(systemName: "square.and.arrow.up")
                        }
                        Button("Done") { dismiss() }
                    }
                }
            }
            .confirmationDialog("Delete \(patient.fullName)?",
                                isPresented: $showDeleteConfirm,
                                titleVisibility: .visible) {
                Button("Delete Patient", role: .destructive) {
                    context.delete(patient)
                    try? context.save()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will permanently remove all clinical records for this patient.")
            }
        }
    }
}
