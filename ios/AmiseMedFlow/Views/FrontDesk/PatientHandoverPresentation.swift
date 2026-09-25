// PatientHandoverPresentation.swift
// Patient hand-over mode for the pre-consultation questionnaire (AdaptiveQuestionnaireSheet).
//
// Front-desk staff hand the iPad to the patient. While it is in the patient's hands, nothing but
// that one patient's questionnaire may be visible:
//   - iPad: a full-screen cover (no patient list around or behind it, no swipe-to-dismiss).
//     iPhone: a sheet with interactive dismissal disabled.
//   - The only way out before submitting is "Staff: exit", which needs the device owner
//     (Face ID / Touch ID, device passcode as fallback — LocalAuthentication
//     `.deviceOwnerAuthentication` via BiometricAuthService.verifyDeviceOwner). Cancelling the
//     prompt keeps the questionnaire open.
//   - After submitting, a neutral thank-you screen with no patient data asks the patient to hand
//     the iPad back. Leaving it also needs staff authentication.
//   - Walk-in answers (no record yet) are attached to a record only after staff exit, on a
//     staff-only screen that uses the same restricted search (QuestionnairePatientSearch).
//
// Audit: "view"/"questionnaire" on open and "handover_exit"/"questionnaire" on staff exit, with
// only fixed labels in details (no names, MRNs or answers). Crash breadcrumbs carry no patient data.
//
// Deleted-model rule: the patient is read only while `isLive`; a record removed while the
// questionnaire is open is handled like a walk-in (answers kept for staff to attach).

import SwiftUI
import SwiftData
import UIKit

/// Where the questionnaire was opened from (audit detail only).
enum QuestionnaireEntryPoint: String {
    case frontDeskTab = "front_desk_questionnaire_tab"
    case scheduler    = "appointment_scheduler"
    case demographics = "front_desk_demographics"
}

extension View {
    /// Presents the pre-consultation questionnaire for `patient` (nil = walk-in) in patient
    /// hand-over mode: full screen on iPad, a non-dismissable sheet on iPhone, staff-only exit.
    func patientHandoverPresentation(isPresented: Binding<Bool>,
                                     patient: Patient?,
                                     entryPoint: QuestionnaireEntryPoint) -> some View {
        modifier(PatientHandoverPresentation(isPresented: isPresented,
                                             patient: patient,
                                             entryPoint: entryPoint))
    }
}

private struct PatientHandoverPresentation: ViewModifier {
    @Binding var isPresented: Bool
    let patient: Patient?
    let entryPoint: QuestionnaireEntryPoint

    func body(content: Content) -> some View {
        if UIDevice.current.userInterfaceIdiom == .pad {
            content.fullScreenCover(isPresented: $isPresented) {
                PatientHandoverView(patient: patient, entryPoint: entryPoint,
                                    onFinish: { isPresented = false })
                    .storeHealthBanner()
            }
        } else {
            content.sheet(isPresented: $isPresented) {
                PatientHandoverView(patient: patient, entryPoint: entryPoint,
                                    onFinish: { isPresented = false })
                    .storeHealthBanner()
            }
        }
    }
}

// MARK: - Hand-over flow

private struct PatientHandoverView: View {
    let patient: Patient?
    let entryPoint: QuestionnaireEntryPoint
    let onFinish: () -> Void

    private enum Stage { case questionnaire, thankYou, attachWalkIn }

    @State private var stage: Stage = .questionnaire
    /// Submitted answers not yet written to any record (walk-in). Staff attach them after exit.
    @State private var unattached: QuestionnaireSubmission?
    @State private var isAuthenticating = false
    @State private var authFailureMessage: String?
    @State private var didLogOpen = false
    /// Counted in PatientHandoverState while on screen (holds back shared-report imports).
    @State private var holdsHandoverState = false

    private var livePatient: Patient? { patient.flatMap { $0.isLive ? $0 : nil } }
    private var mode: String { patient == nil ? "walk_in" : "registered" }

    var body: some View {
        stageContent
            .interactiveDismissDisabled(true)
            .onAppear {
                logOpen()
                if !holdsHandoverState { holdsHandoverState = true; PatientHandoverState.shared.begin() }
            }
            .onDisappear {
                if holdsHandoverState { holdsHandoverState = false; PatientHandoverState.shared.end() }
            }
            .alert("Staff exit", isPresented: Binding(
                get: { authFailureMessage != nil },
                set: { if !$0 { authFailureMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(authFailureMessage ?? "")
            }
    }

    @ViewBuilder
    private var stageContent: some View {
        switch stage {
        case .questionnaire:
            AdaptiveQuestionnaireSheet(
                patient: patient,
                onSubmitted: { submission, savedToRecord in
                    submitted(submission, savedToRecord: savedToRecord)
                },
                onStaffExit: { requestStaffExit() },
                isStaffExitInProgress: isAuthenticating
            )
        case .thankYou:
            HandoverThankYouView(isStaffExitInProgress: isAuthenticating,
                                 onStaffExit: { requestStaffExit() })
        case .attachWalkIn:
            if let unattached {
                WalkInAnswersAttachView(submission: unattached, onDone: { onFinish() })
            } else {
                Color.clear.onAppear { onFinish() }
            }
        }
    }

    private func logOpen() {
        guard !didLogOpen else { return }
        didLogOpen = true
        AuditLog.record("view", "questionnaire", patient: livePatient,
                        details: ["entry": entryPoint.rawValue, "mode": mode])
        CrashReporting.breadcrumb("Opened questionnaire hand-over (\(mode))", category: "questionnaire")
    }

    private func submitted(_ submission: QuestionnaireSubmission, savedToRecord: Bool) {
        unattached = savedToRecord ? nil : submission
        CrashReporting.breadcrumb(savedToRecord ? "Questionnaire submitted"
                                                : "Questionnaire submitted, awaiting staff to attach",
                                  category: "questionnaire")
        stage = .thankYou
    }

    /// "Staff: exit": the device owner must authenticate. Cancel keeps the patient where they are.
    private func requestStaffExit() {
        guard !isAuthenticating else { return }
        isAuthenticating = true
        let afterSubmit = stage == .thankYou
        CrashReporting.breadcrumb("Questionnaire staff exit requested", category: "questionnaire")
        Task { @MainActor in
            let result = await BiometricAuthService.verifyDeviceOwner(
                reason: "Staff authentication is required to leave the patient questionnaire.")
            isAuthenticating = false
            switch result {
            case .verified:
                AuditLog.record("handover_exit", "questionnaire", patient: livePatient,
                                details: ["entry": entryPoint.rawValue,
                                          "mode": mode,
                                          "stage": afterSubmit ? "after_submit" : "before_submit"])
                CrashReporting.breadcrumb("Questionnaire staff exit", category: "questionnaire")
                if afterSubmit, unattached != nil {
                    stage = .attachWalkIn
                } else {
                    onFinish()
                }
            case .cancelled:
                CrashReporting.breadcrumb("Questionnaire staff exit cancelled", category: "questionnaire")
            case .failed(let message):
                CrashReporting.breadcrumb("Questionnaire staff exit not verified", category: "questionnaire")
                authFailureMessage = message
            }
        }
    }
}

// MARK: - Thank-you screen (no patient data)

private struct HandoverThankYouView: View {
    let isStaffExitInProgress: Bool
    let onStaffExit: () -> Void

    private var deviceName: String {
        UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "device"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Spacer()
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(AMColor.accent)
                    .accessibilityHidden(true)
                Text("Thank you — please hand the \(deviceName) back to the front desk.")
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)
                Text("Your answers have been received.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AMColor.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { onStaffExit() } label: {
                        Label("Staff: exit", systemImage: "lock.fill")
                            .labelStyle(.titleAndIcon)
                    }
                    .disabled(isStaffExitInProgress)
                    .accessibilityHint("Staff authentication is required to leave this screen.")
                }
            }
        }
    }
}

// MARK: - Staff-only: attach walk-in answers (after staff exit)

private struct WalkInAnswersAttachView: View {
    let submission: QuestionnaireSubmission
    let onDone: () -> Void

    @Environment(\.modelContext) private var context
    @EnvironmentObject private var sync: SyncService
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }

    @State private var searchQuery = ""
    @State private var attachTarget: Patient?
    @State private var showDiscardConfirm = false
    @State private var showAddPatient = false

    /// Same privacy rule as the Questionnaire tab: nothing until a real search, at most 5.
    private var results: [Patient] {
        QuestionnairePatientSearch.matches(query: searchQuery, in: allPatients)
    }

    private var trimmedQuery: String { QuestionnairePatientSearch.normalized(searchQuery) }

    private var searchHint: String {
        QuestionnairePatientSearch.isNameSearch(trimmedQuery)
            ? "No match."
            : "Type at least \(QuestionnairePatientSearch.minimumNameLength) letters of the name, or the MRN."
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("The walk-in answers are not saved to any record yet. Find the patient's record to attach them, or register the patient first.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Section("Find Patient") {
                    TextField("Name (3+ letters) or MRN…", text: $searchQuery)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    ForEach(results) { patient in
                        Button { attachTarget = patient } label: {
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
                        }
                        .buttonStyle(.plain)
                    }
                    if !trimmedQuery.isEmpty && results.isEmpty {
                        Text(searchHint)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Button {
                        showAddPatient = true
                    } label: {
                        Label("Register New Patient", systemImage: "person.badge.plus")
                    }
                    Button(role: .destructive) {
                        showDiscardConfirm = true
                    } label: {
                        Label("Discard Answers", systemImage: "trash")
                    }
                }
            }
            .navigationTitle("Attach Walk-In Answers")
            .navigationBarTitleDisplayMode(.inline)
            .confirmationDialog(
                "Attach the answers to this record?",
                isPresented: Binding(get: { attachTarget != nil },
                                     set: { if !$0 { attachTarget = nil } }),
                titleVisibility: .visible,
                presenting: attachTarget
            ) { patient in
                if patient.isLive {
                    Button("Attach to \(patient.fullName)") { attach(to: patient) }
                }
                Button("Cancel", role: .cancel) { attachTarget = nil }
            }
            .confirmationDialog(
                "Discard the walk-in answers? They cannot be recovered.",
                isPresented: $showDiscardConfirm,
                titleVisibility: .visible
            ) {
                Button("Discard Answers", role: .destructive) {
                    CrashReporting.breadcrumb("Walk-in questionnaire answers discarded", category: "questionnaire")
                    onDone()
                }
                Button("Cancel", role: .cancel) {}
            }
        }
        .sheet(isPresented: $showAddPatient) {
            AddPatientView(initialSetting: .outpatient)
        }
    }

    private func attach(to patient: Patient) {
        attachTarget = nil
        guard patient.isLive else { return }
        submission.apply(to: patient, context: context)
        Task { await sync.syncIfAuthenticated() }
        CrashReporting.breadcrumb("Walk-in questionnaire answers attached", category: "questionnaire")
        onDone()
    }
}
