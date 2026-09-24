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
            .background(Color(.systemBackground))
            .navigationTitle(patient.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { AuditLog.record("view", "patient", patient: patient) }
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
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    ShareLink(item: patient.handoverText,
                              subject: Text("Patient Handover — \(patient.fullName)"),
                              message: Text(patient.handoverText)) {
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
