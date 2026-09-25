import SwiftUI
import SwiftData
import UIKit

// PatientDetailPadView.swift
// iPad/Mac patient detail view with horizontal top navigation bar.

// MARK: - iPad/Mac: patient detail with horizontal top nav bar

struct PatientDetailPadView: View {
    @Bindable var patient: Patient
    var onBack: (() -> Void)? = nil
    @State private var selectedSection: PatientDetailSection? = .overview
    @State private var summaryPDFData: Data? = nil
    @State private var showSummaryEditor = false
    @State private var showSaveVisitConfirm = false
    @State private var saveVisitFeedback = false
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var sync: SyncService

    // Clinical sections — filtered by role and visit type
    private var rightSections: [PatientDetailSection] {
        let allowed = sync.currentUserRole.visiblePatientSections
        let sections = PatientDetailSection.allCases.filter { section in
            guard allowed.contains(section) else { return false }
            switch section {
            case .trauma:  return patient.visitType == .trauma || patient.visitType == .burns
            case .ogd:     return patient.visitType == .ogd || patient.visitType == .dayOfSurgery
            case .surgery: return patient.visitType == .surgeryElective || patient.visitType == .surgeryEmergency || patient.visitType == .dayOfSurgery
            case .ercp:         return patient.visitType == .ercp || patient.visitType == .dayOfSurgery
            case .bronchoscopy: return patient.visitType == .bronchoscopy || patient.visitType == .dayOfSurgery
            case .colonoscopy:  return patient.visitType == .colonoscopy || patient.visitType == .dayOfSurgery
            case .discharge:    return patient.visitType == .postOp || patient.visitType == .surgeryElective || patient.visitType == .surgeryEmergency || patient.visitType == .dayOfSurgery
            case .postOp:       return patient.visitType == .postOp
            case .consent:      return patient.visitType == .surgeryElective || patient.visitType == .surgeryEmergency || patient.visitType == .dayOfSurgery
            case .preOpChecklist: return patient.visitType == .surgeryElective || patient.visitType == .surgeryEmergency || patient.visitType == .dayOfSurgery
            case .referral:     return patient.visitType == .newConsult || patient.visitType == .followUp || patient.visitType == .urgentReview || patient.visitType == .postOp
            case .patientInstructions: return true
            case .history: return !patient.encounters.filter(\.isComplete).isEmpty
            default:       return true
            }
        }
        return sections
    }

    var body: some View {
        // Reading a deleted model's attributes crashes SwiftData (record removed or merged by
        // sync or duplicate clean-up while it was open).
        if patient.isLive {
            liveBody
        } else {
            VStack(spacing: 12) {
                ContentUnavailableView(
                    "Record no longer available",
                    systemImage: "person.crop.circle.badge.xmark",
                    description: Text("This patient record was removed or merged.")
                )
                if let onBack {
                    Button("Close") { onBack() }
                        .padding(.bottom, 24)
                }
            }
        }
    }

    private var liveBody: some View {
        VStack(spacing: 0) {
            // ── TOP: compact patient identifier strip ──────────────────────
            patientHeader
                .background(Color(.systemBackground))

            Divider()

            // ── BOTTOM: full-width section nav + clinical content ─────────
            // NavigationStack provides a navigation context so that toolbar
            // items with .navigationBarTrailing/.navigationBarLeading placement
            // work correctly in each section view. Without this, those placements
            // crash on iOS 17+ when there is no NavigationStack ancestor.
            VStack(spacing: 0) {
                sectionNav
                NavigationStack {
                    sectionContent
                }
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
        .onAppear {
            CrashReporting.breadcrumb("Opened patient record (iPad)")
            AuditLog.record("view", "patient", patient: patient)
            // If the saved selection is not visible for this role, reset to the first allowed section
            if let sel = selectedSection, !rightSections.contains(sel) {
                selectedSection = rightSections.first
            }
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
                Button {
                    showSaveVisitConfirm = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: saveVisitFeedback ? "archivebox.fill" : "archivebox")
                        Text("Save Visit")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(saveVisitFeedback ? Color.green : AMColor.accent)
                }
                .buttonStyle(.plain)
                .help("Save Visit Snapshot")
                .confirmationDialog("Save visit snapshot for \(patient.fullName)?",
                                    isPresented: $showSaveVisitConfirm,
                                    titleVisibility: .visible) {
                    Button("Save Visit") { padSaveEncounter() }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Freezes the current consultation into the patient's history.")
                }

                Button { showSummaryEditor = true } label: {
                    Image(systemName: "doc.text.fill")
                        .foregroundStyle(AMColor.accent)
                }
                .buttonStyle(.plain)
                .help("Clinical Summary")

                // Own view: the handover text reads most of the chart, and building it here made
                // every consultation keystroke re-render this whole screen.
                PatientHandoverShareLink(patient: patient) {
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
                        .background { sel ? AMColor.accent.opacity(0.18) : Color.clear }
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
    // Split into sub-functions to keep each @ViewBuilder switch ≤ 15 cases
    // and avoid Swift type-checker stack overflow (>19 cases risks a crash).

    @ViewBuilder
    private var sectionContent: some View {
        let section = selectedSection ?? .overview
        if let tab = section.consultTab {
            // All consultation-tab sections resolve through consultTab — 11 cases collapsed to one.
            ConsultationView(patient: patient, startingTab: tab, embeddedInNav: true)
        } else {
            nonConsultationContent(section)
        }
    }

    // nonConsultationContent: 11 cases — safe under the 12-case @ViewBuilder limit.
    @ViewBuilder
    private func nonConsultationContent(_ section: PatientDetailSection) -> some View {
        switch section {
        case .overview:
            DiagnosisHubView(patient: patient, onNavigate: { selectedSection = $0 })
        case .notes:
            NoteListView(patient: patient)
        case .vitals:
            VitalsHistoryView(patient: patient)
        case .prescriptions:
            PrescriptionView(patient: patient)
        case .billing:
            BillingView(patient: patient)
        case .operative:
            OperativePlanView(patient: patient)
        case .documents:
            DocumentsView(patient: patient)
        case .scores:
            ClinicalScoresView(patient: patient)
        case .journey:
            PatientJourneyView(patient: patient)
        case .demographics:
            PatientDemographicsForm(patient: patient)
        default:
            specialtyContent(section)
        }
    }

    // specialtyContent: history, trauma, all procedure forms — 13 cases, under 15-case safe limit.
    @ViewBuilder
    private func specialtyContent(_ section: PatientDetailSection) -> some View {
        switch section {
        case .history:
            ConsultationView(patient: patient, startingTab: .history, embeddedInNav: true)
        case .trauma:
            TraumaAssessmentView(patient: patient)
        case .ogd:
            OGDFormView(patient: patient)
        case .surgery:
            SurgeryNoteView(patient: patient)
        case .ercp:
            ERCPFormView(patient: patient)
        case .bronchoscopy:
            BronchoscopyFormView(patient: patient)
        case .colonoscopy:
            ColonoscopyFormView(patient: patient)
        case .discharge:
            DischargeSummaryView(patient: patient)
        case .postOp:
            PostOpReviewView(patient: patient)
        case .consent:
            ConsentFormView(patient: patient)
        case .preOpChecklist:
            PreOpChecklistView(patient: patient)
        case .referral:
            ReferralLetterView(patient: patient)
        case .patientInstructions:
            PatientInstructionsView(patient: patient)
        default:
            EmptyView()
        }
    }

    // MARK: - Save Visit (iPad path — captures patient.* fields; SOCRATES chip state
    // is not captured here since it lives in ConsultationView @State, but committed
    // HPI text and all other structured fields are included)

    private func padSaveEncounter() {
        MRNGenerator.backfillIfNeeded(patient, in: context)
        let encounter = Encounter(
            visitType: patient.visitType ?? .newConsult,
            acuity: patient.acuity,
            setting: patient.setting,
            location: patient.location
        )
        encounter.snapshot(from: patient, socratesSelections: [:], bayesianDx: [])
        encounter.isComplete = true
        patient.encounters.append(encounter)
        context.insert(encounter)
        AuditLog.record("create", "encounter", patient: patient, resourceId: encounter.syncCode,
                        details: ["visit_type": encounter.visitType.rawValue])
        try? context.save()
        saveVisitFeedback = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { saveVisitFeedback = false }
    }
}

