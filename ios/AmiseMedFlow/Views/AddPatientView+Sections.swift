// AddPatientView+Sections.swift
// Admission, procedure, NOK, history sections and save logic for AddPatientView.

import SwiftUI
import SwiftData


extension AddPatientView {

    var admissionSection: some View {
        Section("Admission") {
            TextField("Ward", text: $ward)
            TextField("Bed number", text: $bedNumber)
            Toggle("Expected discharge date", isOn: $hasExpectedDischarge)
            if hasExpectedDischarge {
                DatePicker("", selection: $expectedDischarge, displayedComponents: .date)
                    .labelsHidden()
            }
        }
    }

    @ViewBuilder
    var procedureSection: some View {
        Section(setting == .endoscopy ? "Endoscopy" : "Procedure") {
            TextField(
                setting == .endoscopy ? "Scope type (e.g. OGD, Colonoscopy, ERCP)" : "Procedure name",
                text: $appointmentType
            )

            let quickProcs: [String] = setting == .endoscopy
                ? ["OGD / Gastroscopy", "Colonoscopy", "ERCP", "Flexible sigmoidoscopy", "Bronchoscopy", "OGD + Colonoscopy"]
                : ["Laparoscopic cholecystectomy", "Laparoscopic appendicectomy", "Inguinal hernia repair",
                   "Umbilical hernia repair", "Incisional hernia repair", "Haemorrhoidectomy",
                   "Colectomy", "Laparotomy", "Thyroidectomy", "Mastectomy", "Breast lumpectomy",
                   "Pilonidal sinus excision", "Anal fissure surgery", "I&D abscess"]
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(quickProcs, id: \.self) { proc in
                        let selected = appointmentType == proc
                        Button(proc) { appointmentType = selected ? "" : proc }
                            .font(.system(size: 11, weight: selected ? .semibold : .regular))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(selected ? Color.purple : Color.purple.opacity(0.1), in: Capsule())
                            .foregroundStyle(selected ? Color.white : Color.purple)
                            .buttonStyle(.plain)
                            .animation(.easeInOut(duration: 0.12), value: selected)
                    }
                }
                .padding(.vertical, 4)
            }

            Toggle("Set date/time", isOn: $hasOperationDate)
            if hasOperationDate {
                DatePicker(
                    "Date & time",
                    selection: $operationDate,
                    displayedComponents: [.date, .hourAndMinute]
                )
            }
        }
    }

    @ViewBuilder
    var nokSection: some View {
        Section("Next of Kin") {
            TextField("Name", text: $nokName)
            TextField("Relationship", text: $nokRelation)
            TextField("Phone", text: $nokPhone).keyboardType(.phonePad)
        }
    }

    @ViewBuilder
    var historySection: some View {
        Section("Medical History") {
            TextEditor(text: $pmhNotes)
                .frame(minHeight: 60)
                .overlay(alignment: .topLeading) {
                    if pmhNotes.isEmpty {
                        Text("Past medical history")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            TextEditor(text: $surgicalHistory)
                .frame(minHeight: 40)
                .overlay(alignment: .topLeading) {
                    if surgicalHistory.isEmpty {
                        Text("Surgical history")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            TextEditor(text: $familyHistoryNotes)
                .frame(minHeight: 40)
                .overlay(alignment: .topLeading) {
                    if familyHistoryNotes.isEmpty {
                        Text("Family history")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
        }
    }

    var duplicateMatches: [Patient] {
        existingPatients.registeredMatches(name: fullName, dateOfBirth: hasDOB ? dateOfBirth : nil)
    }

    var duplicateMessage: String {
        let ids = duplicateMatches.map { $0.mrn ?? "no MRN" }.joined(separator: ", ")
        return "\"\(fullName.trimmingCharacters(in: .whitespaces))\" is already registered (\(ids)). "
            + "Open that record from the Patients list. If this is a different person with the same "
            + "name, enter their date of birth."
    }

    func save() {
        let conflicts = duplicateMatches
        if !conflicts.isEmpty {
            showDuplicateAlert = true
            return
        }
        commitSave()
    }

    func commitSave() {
        guard !didSave else { return }
        didSave = true
        let p = Patient(
            fullName: fullName.trimmingCharacters(in: .whitespaces),
            sex: sex,
            setting: setting,
            location: location,
            acuity: acuity
        )
        if hasDOB               { p.dateOfBirth = dateOfBirth }
        if !phone.isEmpty       { p.phone = phone }
        if !email.isEmpty       { p.email = email }
        p.mrn = mrn.isEmpty ? MRNGenerator.next(existing: existingPatients) : mrn
        p.visitType = visitType
        if !chiefComplaint.isEmpty   { p.chiefComplaint = chiefComplaint }
        if !appointmentType.isEmpty  { p.appointmentType = appointmentType }
        if !nokName.isEmpty     { p.nokName = nokName }
        if !nokRelation.isEmpty { p.nokRelation = nokRelation }
        if !nokPhone.isEmpty    { p.nokPhone = nokPhone }
        if !pmhNotes.isEmpty    { p.pmhNotes = pmhNotes }
        if !surgicalHistory.isEmpty    { p.surgicalHistory = surgicalHistory }
        if !familyHistoryNotes.isEmpty { p.familyHistoryNotes = familyHistoryNotes }
        if showAdmission {
            if !ward.isEmpty      { p.ward = ward }
            if !bedNumber.isEmpty { p.bedNumber = bedNumber }
            p.admittedAt = .now
            if hasExpectedDischarge { p.expectedDischarge = expectedDischarge }
        }
        if showProcedure && hasOperationDate {
            p.operationDate = operationDate
        }
        context.insert(p)
        AuditLog.record("create", "patient", patient: p)
        try? context.save()

        // Mirror to iOS Calendar (syncs to Google Calendar via account settings)
        if showProcedure && hasOperationDate {
            let procedure = appointmentType.isEmpty ? chiefComplaint : appointmentType
            Task {
                try? await calSvc.createTheatreBooking(
                    procedure: procedure,
                    patientName: p.fullName,
                    date: operationDate,
                    duration: 5400, // 90 min default
                    notes: chiefComplaint.isEmpty ? "" : "Complaint: \(chiefComplaint)"
                )
            }
        }

        dismiss()
    }

}
