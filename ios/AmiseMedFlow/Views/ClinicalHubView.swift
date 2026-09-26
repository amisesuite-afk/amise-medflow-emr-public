// ClinicalHubView.swift
// iPhone sub-navigation list within the clinical tab.

import SwiftUI
import SwiftData

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
                NavigationLink { ClinicalScoresView(patient: patient) } label: {
                    Label("Clinical Scores & Scales", systemImage: "chart.bar.doc.horizontal")
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
                let showTrauma       = vt == .trauma
                let showOGD          = vt == .ogd || vt == .dayOfSurgery
                let showColonoscopy  = vt == .colonoscopy || vt == .dayOfSurgery
                let showSurgery      = vt == .surgeryElective || vt == .surgeryEmergency || vt == .dayOfSurgery
                let showERCP         = vt == .ercp || vt == .dayOfSurgery
                let showBronchoscopy = vt == .bronchoscopy || vt == .dayOfSurgery
                let showPostOp       = vt == .postOp
                let showDischarge    = vt == .postOp || vt == .surgeryElective || vt == .surgeryEmergency || vt == .dayOfSurgery
                let showReferral     = vt == .newConsult || vt == .followUp || vt == .urgentReview || vt == .postOp
                let showConsent      = vt == .surgeryElective || vt == .surgeryEmergency || vt == .dayOfSurgery
                let showPreOpChecklist = vt == .surgeryElective || vt == .surgeryEmergency || vt == .dayOfSurgery
                let showBowelPrep    = showColonoscopy || BowelPrepProcedure.detect(for: patient) != nil

                if showTrauma || showOGD || showColonoscopy || showSurgery || showERCP || showBronchoscopy || showPostOp || showDischarge || showReferral || showConsent || showPreOpChecklist || showBowelPrep {
                    Section("Procedure Forms") {
                        if showTrauma {
                            NavigationLink { TraumaAssessmentView(patient: patient) } label: {
                                Label("Trauma Assessment (ATLS)", systemImage: "cross.case.fill")
                                    .foregroundStyle(.red)
                            }
                        }
                        if showPreOpChecklist {
                            NavigationLink { PreOpChecklistView(patient: patient) } label: {
                                Label("Pre-op Checklist (WHO)", systemImage: "checklist")
                            }
                        }
                        if showConsent {
                            NavigationLink { ConsentFormView(patient: patient) } label: {
                                Label("Surgical Consent", systemImage: "signature")
                            }
                        }
                        if showSurgery {
                            NavigationLink { SurgeryNoteView(patient: patient) } label: {
                                Label("Operative Note", systemImage: "scissors")
                            }
                        }
                        if showOGD {
                            NavigationLink { OGDFormView(patient: patient) } label: {
                                Label("OGD / Gastroscopy Report", systemImage: "scope")
                            }
                        }
                        if showBowelPrep {
                            NavigationLink { BowelPrepView(patient: patient) } label: {
                                Label("Bowel Preparation", systemImage: "drop.triangle")
                            }
                        }
                        if showColonoscopy {
                            NavigationLink { ColonoscopyFormView(patient: patient) } label: {
                                Label("Colonoscopy Report", systemImage: "circle.dotted.and.circle")
                            }
                        }
                        if showERCP {
                            NavigationLink { ERCPFormView(patient: patient) } label: {
                                Label("ERCP Report", systemImage: "waveform.and.magnifyingglass")
                            }
                        }
                        if showBronchoscopy {
                            NavigationLink { BronchoscopyFormView(patient: patient) } label: {
                                Label("Bronchoscopy Report", systemImage: "lungs")
                            }
                        }
                        if showPostOp {
                            NavigationLink { PostOpReviewView(patient: patient) } label: {
                                Label("Post-op Review", systemImage: "bandage")
                            }
                        }
                        if showDischarge {
                            NavigationLink { DischargeSummaryView(patient: patient) } label: {
                                Label("Discharge Summary", systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        }
                        if showReferral {
                            NavigationLink { ReferralLetterView(patient: patient) } label: {
                                Label("Referral / Reply Letter", systemImage: "envelope.open")
                            }
                        }
                    }
                }
            }

            Section("Reference") {
                NavigationLink {
                    SurgicalEncyclopediaView(
                        preselectedDiagnosis: patient.workingDiagnosis
                    )
                } label: {
                    HStack {
                        Label("Surgical Encyclopedia", systemImage: "books.vertical")
                        Spacer()
                        if let dx = patient.workingDiagnosis,
                           SurgicalAlgorithmEngine.shared.lookup(diagnosisName: dx) != nil {
                            Text("Match")
                                .font(.caption2)
                                .foregroundStyle(.teal)
                        }
                    }
                }
            }

            Section("Patient Communication") {
                NavigationLink { PatientInstructionsView(patient: patient) } label: {
                    Label("Patient Instructions Sheet", systemImage: "doc.text.fill")
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
