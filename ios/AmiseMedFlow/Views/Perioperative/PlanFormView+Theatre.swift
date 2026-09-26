// PlanFormView+Theatre.swift
// Theatre/procedure booking, consent, anaesthesia, WHO surgical safety checklist,
// team notes, AI operative note generation, and form helpers.

import SwiftUI
import SwiftData
import EventKit

extension PlanForm {

    // MARK: - Theatre / procedure booking

    @ViewBuilder
    var theatreBookingSection: some View {
        Section {
            // Procedure field (mirrors consent, editable here)
            VStack(alignment: .leading, spacing: 4) {
                Text("PROCEDURE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                Text(plan.consentProcedure.isEmpty ? "Set procedure in Consent section" : plan.consentProcedure)
                    .font(.callout)
                    .foregroundStyle(plan.consentProcedure.isEmpty ? .tertiary : .primary)
            }

            // Patient
            VStack(alignment: .leading, spacing: 4) {
                Text("PATIENT").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                Text(patient.fullName)
                    .font(.callout)
            }

            // Date & time
            DatePicker("Date & time", selection: $bookingDate, in: Date()...)
                .datePickerStyle(.compact)
                .font(.callout)

            // Duration
            VStack(alignment: .leading, spacing: 8) {
                Text("ESTIMATED DURATION").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach([30, 60, 90, 120, 150, 180, 240], id: \.self) { mins in
                            let label = mins < 60 ? "\(mins) min" : (mins % 60 == 0 ? "\(mins/60)h" : "\(mins/60)h \(mins%60)m")
                            let sel = Int(bookingDurationMins) == mins
                            Button(label) { bookingDurationMins = Double(mins) }
                                .font(.caption2.weight(sel ? .semibold : .regular))
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(sel ? Color.white : AMColor.accent)
                                .buttonStyle(.plain)
                        }
                    }
                }
            }

            // Theatre notes
            ZStack(alignment: .topLeading) {
                TextEditor(text: $bookingNotes)
                    .frame(minHeight: 60)
                    .font(.callout)
                if bookingNotes.isEmpty {
                    Text("Special instructions, equipment, implants…")
                        .foregroundStyle(.tertiary).font(.caption)
                        .padding(.top, 8).padding(.leading, 4)
                        .allowsHitTesting(false)
                }
            }

            // Feedback
            if let msg = bookingMessage {
                HStack(spacing: 8) {
                    Image(systemName: bookingSuccess ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(bookingSuccess ? .green : .red)
                    Text(msg)
                        .font(.caption)
                        .foregroundStyle(bookingSuccess ? .green : .red)
                }
            }

            // Book button
            Button {
                Task { await requestBooking() }
            } label: {
                HStack(spacing: 8) {
                    if isBooking {
                        ProgressView().scaleEffect(0.8)
                    } else {
                        Image(systemName: "calendar.badge.plus")
                    }
                    Text(isBooking ? "Booking…" : "Add to iOS Calendar")
                        .font(.callout.weight(.semibold))
                    Spacer()
                    let dur = Int(bookingDurationMins)
                    let label = dur < 60 ? "\(dur) min" : (dur % 60 == 0 ? "\(dur/60)h" : "\(dur/60)h \(dur%60)m")
                    Text(label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .foregroundStyle(plan.consentProcedure.isEmpty || isBooking ? Color.secondary : AMColor.accent)
            .disabled(plan.consentProcedure.isEmpty || isBooking)
            .buttonStyle(.plain)
        } header: {
            Label("Theatre / Procedure Booking", systemImage: "calendar.badge.plus")
        } footer: {
            Text("Creates an event in your iOS Calendar (synced to Google Calendar if connected).")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    func requestBooking() async {
        isBooking = true
        bookingMessage = nil
        defer { isBooking = false }

        let notes = [
            "Patient: \(patient.fullName)",
            patient.ageYears > 0 ? "Age: \(patient.ageYears) yrs · \(patient.sex.rawValue)" : nil,
            patient.mrn.flatMap { $0.isEmpty ? nil : "MRN: \($0)" },
            plan.anaesthesiaType.isEmpty ? nil : "Anaesthesia: \(plan.anaesthesiaType)",
            plan.antibioticProphylaxis.isEmpty ? nil : "Abx: \(plan.antibioticProphylaxis)",
            plan.specialEquipment.isEmpty ? nil : "Equipment: \(plan.specialEquipment)",
            bookingNotes.isEmpty ? nil : bookingNotes,
        ].compactMap { $0 }.joined(separator: "\n")

        do {
            try await calSvc.createTheatreBooking(
                procedure: plan.consentProcedure,
                patientName: patient.fullName,
                date: bookingDate,
                duration: bookingDurationMins * 60,
                notes: notes,
                calendar: bookingCalendar
            )
            bookingSuccess = true
            bookingMessage = "Booking added to iOS Calendar for \(bookingDate.formatted(date: .abbreviated, time: .shortened))"
        } catch {
            bookingSuccess = false
            bookingMessage = error.localizedDescription
        }
    }

    // MARK: - Consent

    @ViewBuilder
    var consentSection: some View {
        Section("Surgical Consent") {
            if let dx = patient.workingDiagnosis {
                Label("Diagnosis: \(dx)", systemImage: "stethoscope")
                    .font(.caption).foregroundStyle(.secondary)
            }
            if plan.consentProcedure.isEmpty, let cat = radiationConsentCategory {
                Button {
                    plan.consentProcedure = cat
                    touch()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "wand.and.stars")
                            .font(.system(size: 12))
                            .foregroundStyle(.teal)
                        Text("Suggested: \(cat)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.teal)
                    }
                }
                .buttonStyle(.plain)
            }
            TextField("Procedure to consent for", text: $plan.consentProcedure, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: plan.consentProcedure) { _, _ in touch() }
            Toggle("Consent obtained and signed", isOn: $plan.consentSigned)
                .tint(.teal)
                .onChange(of: plan.consentSigned) { _, _ in touch() }
        }
    }

    // MARK: - Anaesthesia

    @ViewBuilder
    var anaesthesiaSection: some View {
        Section("Anaesthesia & Preparation") {
            // Safety alerts relevant to anaesthesia planning
            if patient.hasCriticalAllergy {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.shield.fill").foregroundStyle(.red)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CRITICAL ALLERGY").font(.system(size: 11, weight: .heavy)).foregroundStyle(.red)
                        Text(patient.criticalAllergies.map { "\($0.name) — \($0.reaction)" }.joined(separator: "\n"))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            if patient.hasPenicillinAllergy {
                Label("Penicillin allergy — avoid beta-lactam antibiotics", systemImage: "exclamationmark.circle.fill")
                    .font(.caption).foregroundStyle(.orange)
            }
            if patient.hasAnticoagulation {
                HStack(spacing: 6) {
                    Image(systemName: "drop.fill").foregroundStyle(.purple).font(.caption)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Anticoagulant therapy").font(.caption.weight(.semibold)).foregroundStyle(.purple)
                        Text(patient.activeAnticoagulants.map { $0.drug }.joined(separator: ", "))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            Picker("ASA Class", selection: Binding<Int>(
                get: { patient.asaClass ?? 0 },
                set: {
                    patient.asaClass = $0 == 0 ? nil : $0
                    patient.updatedAt = .now
                    patient.pendingSync = true
                }
            )) {
                Text("Not set").tag(0)
                Text("ASA I — Healthy").tag(1)
                Text("ASA II — Mild systemic disease").tag(2)
                Text("ASA III — Severe systemic disease").tag(3)
                Text("ASA IV — Life-threatening disease").tag(4)
                Text("ASA V — Moribund").tag(5)
            }

            Picker("Anaesthesia type", selection: $plan.anaesthesiaType) {
                ForEach(["General", "Spinal", "Epidural", "Local + Sedation", "Local only", "Regional"], id: \.self) { Text($0).tag($0) }
            }
            .onChange(of: plan.anaesthesiaType) { _, _ in touch() }
            Picker("Patient position", selection: $plan.positioning) {
                ForEach(["Supine", "Lloyd-Davies", "Left lateral", "Right lateral", "Prone", "Lithotomy", "Trendelenburg", "Reverse Trendelenburg"], id: \.self) { Text($0).tag($0) }
            }
            .onChange(of: plan.positioning) { _, _ in touch() }
            TextField("Antibiotic prophylaxis", text: $plan.antibioticProphylaxis)
                .onChange(of: plan.antibioticProphylaxis) { _, _ in touch() }
            quickChips(antibioticChips, current: plan.antibioticProphylaxis) {
                plan.antibioticProphylaxis = $0; touch()
            }
            TextField("VTE prophylaxis", text: $plan.vteProphy)
                .onChange(of: plan.vteProphy) { _, _ in touch() }
            quickChips(vteChips, current: plan.vteProphy) {
                plan.vteProphy = $0; touch()
            }
            TextField("Special equipment / implants", text: $plan.specialEquipment, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: plan.specialEquipment) { _, _ in touch() }
        }
    }

    // MARK: - WHO Sign In

    @ViewBuilder
    var whoSignIn: some View {
        Section {
            Toggle("Patient identity confirmed", isOn: $plan.whoIdentityConfirmed).onChange(of: plan.whoIdentityConfirmed) { _, _ in touch() }
            Toggle("Site marked", isOn: $plan.whoSiteMarked).onChange(of: plan.whoSiteMarked) { _, _ in touch() }
            Toggle("Anaesthesia safety check complete", isOn: $plan.whoAnaesthesiaCheckDone).onChange(of: plan.whoAnaesthesiaCheckDone) { _, _ in touch() }
            Toggle("Pulse oximeter on and functioning", isOn: $plan.whoPulseOxOk).onChange(of: plan.whoPulseOxOk) { _, _ in touch() }
            Toggle("Allergies reviewed", isOn: $plan.whoAllergiesReviewed).onChange(of: plan.whoAllergiesReviewed) { _, _ in touch() }
            Toggle("Aspiration risk assessed", isOn: $plan.whoAspirationRisk).onChange(of: plan.whoAspirationRisk) { _, _ in touch() }
            Toggle("Airway risk assessed", isOn: $plan.whoAirwayRisk).onChange(of: plan.whoAirwayRisk) { _, _ in touch() }
        } header: {
            Label("Sign In — before induction", systemImage: "1.circle.fill")
        }
    }

    // MARK: - WHO Time Out

    @ViewBuilder
    var whoTimeOut: some View {
        Section {
            Toggle("Team introduced by name and role", isOn: $plan.whoTeamIntroduced).onChange(of: plan.whoTeamIntroduced) { _, _ in touch() }
            Toggle("Consent and procedure confirmed", isOn: $plan.whoProcedureConfirmed).onChange(of: plan.whoProcedureConfirmed) { _, _ in touch() }
            Toggle("Antibiotic given within 60 min", isOn: $plan.whoAntibioticGiven).onChange(of: plan.whoAntibioticGiven) { _, _ in touch() }
            Toggle("Critical steps discussed", isOn: $plan.whoCriticalStepsDiscussed).onChange(of: plan.whoCriticalStepsDiscussed) { _, _ in touch() }
            Toggle("Imaging displayed", isOn: $plan.whoImagingDisplayed).onChange(of: plan.whoImagingDisplayed) { _, _ in touch() }
            Toggle("Sterility confirmed", isOn: $plan.whoSterilityConfirmed).onChange(of: plan.whoSterilityConfirmed) { _, _ in touch() }
        } header: {
            Label("Time Out — before incision", systemImage: "2.circle.fill")
        }
    }

    // MARK: - WHO Sign Out

    @ViewBuilder
    var whoSignOut: some View {
        Section {
            Toggle("Swabs, instruments, needles counted", isOn: $plan.whoSwabsCounted).onChange(of: plan.whoSwabsCounted) { _, _ in touch() }
            Toggle("Specimen labelled correctly", isOn: $plan.whoSpecimenLabelled).onChange(of: plan.whoSpecimenLabelled) { _, _ in touch() }
            Toggle("Equipment problems noted", isOn: $plan.whoEquipmentIssues).onChange(of: plan.whoEquipmentIssues) { _, _ in touch() }
            Toggle("Key concerns for recovery documented", isOn: $plan.whoRecoveryConcerns).onChange(of: plan.whoRecoveryConcerns) { _, _ in touch() }
        } header: {
            Label("Sign Out — before patient leaves", systemImage: "3.circle.fill")
        }
    }

    // MARK: - WHO progress

    @ViewBuilder
    var progressSection: some View {
        Section {
            let done = plan.whoCompletedCount
            let total = plan.whoTotalCount
            ProgressView(value: Double(done), total: Double(total))
                .tint(done == total ? .green : .orange)
            Text("\(done) / \(total) items complete")
                .font(.caption)
                .foregroundStyle(done == total ? .green : .secondary)
        }
    }

    // MARK: - Team notes

    @ViewBuilder
    var teamSection: some View {
        Section("Team Notes") {
            TextField("Surgical team, scrub nurse, special instructions…",
                      text: $plan.surgicalTeamNote, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: plan.surgicalTeamNote) { _, _ in touch() }
        }
    }

    // MARK: - AI op note

    @ViewBuilder
    var aiSection: some View {
        Section("AI Operative Note") {
            Button {
                Task { await draftOpNote() }
            } label: {
                HStack {
                    Label("Draft Operative Note", systemImage: "sparkles")
                    Spacer()
                    if ai.isGenerating { ProgressView() }
                }
            }
            .disabled(ai.isGenerating || plan.consentProcedure.isEmpty)
            .foregroundStyle(.purple)
        }
    }

    // MARK: - Helpers

    func touch() {
        plan.updatedAt = .now
        plan.pendingSync = true
    }

    func draftOpNote() async {
        let ctx = [
            plan.anaesthesiaType.isEmpty ? "" : "Anaesthesia: \(plan.anaesthesiaType)",
            plan.positioning.isEmpty    ? "" : "Position: \(plan.positioning)",
            plan.specialEquipment.isEmpty ? "" : "Equipment: \(plan.specialEquipment)",
            plan.surgicalTeamNote.isEmpty ? "" : plan.surgicalTeamNote,
        ].filter { !$0.isEmpty }.joined(separator: ". ")
        do {
            let text = try await ai.generateOpNote(
                patient: patient,
                procedure: plan.consentProcedure,
                findings: ctx.isEmpty ? "As per operative plan" : ctx
            )
            let note = ClinicalNote(noteType: .operative, patient: patient)
            note.freeText = text
            context.insert(note)
            patient.updatedAt = .now
            patient.pendingSync = true
        } catch is AIError {
            // AIService disabled pending HIPAA BAA — build a structured draft from plan data
            let note = ClinicalNote(noteType: .operative, patient: patient)
            var lines: [String] = ["OPERATIVE NOTE — DRAFT (please review and complete before signing)"]
            lines.append("")
            lines.append("Procedure: \(plan.consentProcedure)")
            if !plan.anaesthesiaType.isEmpty { lines.append("Anaesthesia: \(plan.anaesthesiaType)") }
            if !plan.positioning.isEmpty     { lines.append("Position: \(plan.positioning)") }
            if !plan.specialEquipment.isEmpty { lines.append("Equipment: \(plan.specialEquipment)") }
            lines.append("Indication: \(patient.chiefComplaint ?? patient.workingDiagnosis ?? "See clinical notes")")
            lines.append("")
            lines.append("Findings: [To be completed intra-operatively]")
            lines.append("Procedure description: [To be completed]")
            lines.append("Estimated blood loss: [mL]")
            lines.append("Specimens: [None / as per histopathology request]")
            lines.append("Complications: None encountered.")
            lines.append("")
            lines.append("Post-operative orders: Routine post-operative care. Analgesia and antiemetics as prescribed.")
            if !plan.surgicalTeamNote.isEmpty {
                lines.append("")
                lines.append("Team note: \(plan.surgicalTeamNote)")
            }
            note.freeText = lines.joined(separator: "\n")
            context.insert(note)
            patient.updatedAt = .now
            patient.pendingSync = true
        } catch {
            aiError = error.localizedDescription
            showAIError = true
        }
    }

}
