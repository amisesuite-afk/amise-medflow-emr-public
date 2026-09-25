// FDPatientDemographicsPanel.swift
// Front-desk demographics panel: check-in gate and encounter actions.

import SwiftUI
import SwiftData

struct FDPatientDemographicsPanel: View {
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
                HStack(spacing: 8) {
                    TextField("MRN", text: Binding(
                        get: { patient.mrn ?? "" },
                        set: { patient.mrn = $0.isEmpty ? nil : $0 }))
                    if patient.mrn == nil || (patient.mrn?.isEmpty == true) {
                        Button("Generate") {
                            patient.mrn = Self.generateMRN()
                            markDirty()
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AMColor.accent)
                        .buttonStyle(.bordered)
                    }
                }
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
        // Patient hand-over mode: full screen on iPad, staff-only exit.
        .patientHandoverPresentation(isPresented: $showQuestionnaire,
                                     patient: patient,
                                     entryPoint: .demographics)
        .sheet(isPresented: $showMailComposer) {
            if let email = patient.email, !email.isEmpty {
                MailComposer(
                    to: [email],
                    subject: "Your appointment — \(PracticeProfile.current.practiceName)",
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
                    body: AppointmentMessage.preConsultSMSBody(),
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
            _ = try? await calendarService.createCheckInEvent(
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

    private static func generateMRN() -> String {
        let digits = (0..<6).map { _ in String(Int.random(in: 0...9)) }.joined()
        return "AMI-\(digits)"
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
