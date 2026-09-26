import SwiftUI
import SwiftData
import UIKit

// PatientDetailView.swift
// iPhone 5-tab patient detail sheet presentation.

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
                // Opens at the pathway's first step. Scores, Vitals and Prescriptions are also in the
                // consultation's Tools menu, so there is no need to leave it for them.
                quickAction("Consultation", icon: "cross.case.fill", color: .teal,
                            destination: AnyView(ConsultationView(patient: patient)))
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
                if patient.visitType == .bronchoscopy || patient.visitType == .dayOfSurgery {
                    quickAction("Bronchoscopy", icon: "lungs", color: .teal,
                                destination: AnyView(BronchoscopyFormView(patient: patient)))
                }
                quickAction("Scores", icon: "chart.bar.doc.horizontal", color: .teal,
                            destination: AnyView(ClinicalScoresView(patient: patient)))
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
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(color)
                    .frame(minWidth: 44, minHeight: 44)
                    .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                // Dynamic Type text style (was fixed 10 pt; UX review m2).
                Text(label)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            // The whole tile is the target: with the plain style, the gap between icon and label
            // (and the space beside a short icon) did not take a tap.
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .accessibilityIdentifier("patient.quick.\(label)")
    }

    var body: some View {
        // Reading a deleted model's attributes crashes SwiftData (record deleted here, or removed
        // or merged by sync or duplicate clean-up while this sheet was open). Same screen as iPad.
        if patient.isLive {
            liveBody
        } else {
            PatientRecordUnavailableView(onClose: { dismiss() })
        }
    }

    private var liveBody: some View {
        NavigationStack {
          VStack(spacing: 0) {
            // Safety strip under the name on every tab (UX review M3): NEWS2 with band colour and
            // age, every allergy, the antithrombotic, at readable Dynamic Type sizes.
            // A sibling ABOVE the TabView, not a .safeAreaInset on it: a TabView does not pass an
            // outer inset on to its pages, so the strip was drawn over the top of the Overview tab
            // and a tall strip (three items wrap onto three lines) covered the quick actions —
            // a tap on "Prescriptions" landed on the strip and did nothing (walkthrough runs
            // 36195058935 and 36200720807, patient on warfarin with an allergy).
            RecordSafetyStrip(patient: patient)
                .padding(.horizontal, 16).padding(.vertical, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.bar)
            Divider()
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

                NoteListView(patient: patient)
                    .tag(PatientTab.notes)
                    .tabItem { Label("Notes", systemImage: "note.text") }

                VitalsHistoryView(patient: patient)
                    .tag(PatientTab.vitals)
                    .tabItem { Label("Vitals", systemImage: "waveform.path.ecg") }

                PatientDemographicsForm(patient: patient)
                    .tag(PatientTab.demographics)
                    .tabItem { Label("Details", systemImage: "square.and.pencil") }
            }
          }
            .background(Color(.systemBackground))
            .navigationTitle(patient.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                CrashReporting.breadcrumb("Opened patient record")
                AuditLog.record("view", "patient", patient: patient)
            }
            .toolbar {
                // NEWS2 moved from under the name into the safety strip below the bar (with its
                // age, the allergies and the antithrombotic; UX review M3).
                ToolbarItem(placement: .principal) {
                    Text(patient.fullName)
                        .scaledFont(size: 15, weight: .semibold, relativeTo: .subheadline)
                        .lineLimit(1)
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                }
                // Delete is no longer in the Close position (UX review m1): it is in the "More"
                // menu, still behind the confirmation.
                ToolbarItem(placement: .navigationBarLeading) {
                    Menu {
                        Button(role: .destructive) { showDeleteConfirm = true } label: {
                            Label("Delete patient…", systemImage: "trash")
                        }
                        .accessibilityIdentifier("patient.delete")
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .accessibilityLabel("More actions")
                    }
                    .accessibilityIdentifier("patient.more")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("patient.done")
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    // Own view: the handover text reads most of the chart, and building it here
                    // made every consultation keystroke re-render this whole sheet.
                    PatientHandoverShareLink(patient: patient) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
            .confirmationDialog("Delete \(patient.fullName)?",
                                isPresented: $showDeleteConfirm,
                                titleVisibility: .visible) {
                Button("Delete Patient", role: .destructive) {
                    context.deletePatient(patient)
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
