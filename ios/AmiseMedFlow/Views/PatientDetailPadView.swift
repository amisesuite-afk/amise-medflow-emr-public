import SwiftUI
import SwiftData
import UIKit

// PatientDetailPadView.swift
// iPad/Mac patient detail view with horizontal top navigation bar.
//
// One navigation model for the consultation (UX review M4): the section bar has a single
// "Consultation" entry; inside it, the pathway step bar is the only step navigation. The eleven
// consultation steps (CC … Plan) are no longer separate section-bar items that each opened the
// same ConsultationView. Overview links to a step still work: they open Consultation at that step.
// One "Save" model too: the header's own "Save Visit" (which saved without the SOCRATES chips and
// the differential) is gone; the consultation's "Save snapshot" and "Complete" are the only ones.

// MARK: - iPad/Mac: patient detail with horizontal top nav bar

struct PatientDetailPadView: View {
    @Bindable var patient: Patient
    var onBack: (() -> Void)? = nil
    @State private var selectedSection: PatientDetailSection? = .overview
    /// Step the Consultation section opens at (set by an Overview jump); nil = pathway's first step.
    @State private var consultStep: ConsultTab? = nil
    @State private var summaryPDFData: Data? = nil
    @State private var showSummaryEditor = false
    @EnvironmentObject private var sync: SyncService

    // Clinical sections — filtered by role and visit type
    private var rightSections: [PatientDetailSection] {
        let allowed = sync.currentUserRole.visiblePatientSections
        // The single Consultation entry shows when the role may open any consultation step.
        let consultationAllowed = allowed.contains(.consultation)
            || allowed.contains(where: { $0.isConsultationStep })
        let sections = PatientDetailSection.allCases.filter { section in
            if section.isConsultationStep { return false }
            if section == .consultation { return consultationAllowed }
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

    /// Every jump goes through here: a consultation step opens the Consultation section at it.
    private func navigate(to section: PatientDetailSection) {
        if let tab = section.consultTab {
            consultStep = tab
            selectedSection = .consultation
        } else {
            if section == .consultation { consultStep = nil }
            selectedSection = section
        }
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
            if let sel = selectedSection, !sel.isConsultationStep, !rightSections.contains(sel) {
                selectedSection = rightSections.first
            }
        }
    }

    // MARK: Compact patient header strip

    private var patientHeader: some View {
        HStack(alignment: .top, spacing: 12) {
            if let onBack {
                Button { onBack() } label: {
                    Image(systemName: "chevron.left")
                        .fontWeight(.semibold)
                        .foregroundStyle(AMColor.accent)
                        .minimumTouchTarget()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("patient.back")
            }

            AcuityPip(acuity: patient.acuity)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(patient.fullName)
                        .font(.headline)
                        .lineLimit(1)
                    Text([patient.sex.rawValue, patient.ageDisplay, patient.setting.rawValue]
                        .compactMap { $0 }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    if let mrn = patient.mrn, !mrn.isEmpty {
                        Text("MRN \(mrn)")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    if let dob = patient.dateOfBirth {
                        Text(dob, format: .dateTime.day().month(.abbreviated).year())
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    if let dx = patient.workingDiagnosis {
                        Text(dx)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.teal)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.teal.opacity(0.1), in: Capsule())
                            .lineLimit(1)
                    }
                }
                // Safety strip (UX review M3): NEWS2 with band colour and age, every allergy (not
                // only severe ones), the antithrombotic — text, not 11-pt icons.
                RecordSafetyStrip(patient: patient)
            }

            Spacer(minLength: 8)

            HStack(spacing: 14) {
                Button { showSummaryEditor = true } label: {
                    Image(systemName: "doc.text.fill")
                        .foregroundStyle(AMColor.accent)
                        .minimumTouchTarget()
                }
                .buttonStyle(.plain)
                .help("Clinical Summary")
                .accessibilityLabel("Clinical summary")

                // Own view: the handover text reads most of the chart, and building it here made
                // every consultation keystroke re-render this whole screen.
                PatientHandoverShareLink(patient: patient) {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(AMColor.accent)
                        .minimumTouchTarget()
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // MARK: Section nav (right panel)

    private var sectionNav: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(rightSections) { section in
                    let sel = selectedSection == section
                        || (section == .consultation && (selectedSection?.isConsultationStep ?? false))
                    Button { navigate(to: section) } label: {
                        VStack(spacing: 3) {
                            Image(systemName: section.icon)
                                .font(.subheadline.weight(sel ? .semibold : .regular))
                            // Dynamic Type text style (was fixed 9 pt; UX review m2).
                            Text(section.shortLabel)
                                .font(.caption2.weight(sel ? .bold : .semibold))
                                .lineLimit(1)
                        }
                        .foregroundStyle(sel ? AMColor.sidebarActive : AMColor.sidebarText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .frame(minWidth: 62, minHeight: 44)
                        .background { sel ? AMColor.accent.opacity(0.18) : Color.clear }
                        .overlay(alignment: .bottom) {
                            if sel { Rectangle().fill(AMColor.accent).frame(height: 2) }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(section.rawValue)
                    .accessibilityAddTraits(sel ? .isSelected : [])
                    .accessibilityIdentifier("patient.section.\(String(describing: section))")
                }
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
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
        if section == .consultation || section.isConsultationStep {
            // The one consultation: its pathway step bar is the only step navigation.
            ConsultationView(patient: patient, startingTab: section.consultTab ?? consultStep, embeddedInNav: true)
        } else {
            nonConsultationContent(section)
        }
    }

    // nonConsultationContent: 11 cases — safe under the 12-case @ViewBuilder limit.
    @ViewBuilder
    private func nonConsultationContent(_ section: PatientDetailSection) -> some View {
        switch section {
        case .overview:
            DiagnosisHubView(patient: patient, onNavigate: { navigate(to: $0) })
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
}
