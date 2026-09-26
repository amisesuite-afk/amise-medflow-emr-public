// AdaptiveQuestionnaireSheet+StepForms2.swift
// Phase 4–6 form sections, save, and note-builder for the adaptive questionnaire.

import SwiftUI
import SwiftData
import UIKit

extension AdaptiveQuestionnaireSheet {

    @ViewBuilder
    var phase4RedFlagsSection: some View {
        Section {
            Toggle("Unexplained weight loss", isOn: $answers.unexplainedWeightLoss)
            Toggle("Night sweats", isOn: $answers.nightSweats)
            Toggle("Change in a mole or skin lesion", isOn: $answers.changeInMole)
            if patientAge >= 18 {
                Toggle("Coughing up blood (haemoptysis)", isOn: $answers.haemoptysis)
            }
            if patientAge >= 25 {
                Toggle("Blood in urine (haematuria)", isOn: $answers.haematuria)
            }
            if patientSex == .female {
                Toggle("Recent breast change (lump, skin, discharge)", isOn: $answers.breastChange)
            }
        } header: {
            Label("Red Flag Symptoms", systemImage: "exclamationmark.triangle.fill")
                .textCase(nil).scaledFont(size: 11, weight: .semibold)
                .foregroundStyle(.orange)
        } footer: {
            Text("Report any that apply, even if not the main reason for today's visit.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    // ── Phase 5: Past medical history ─────────────────────────────────────────

    @ViewBuilder
    var phase5PMHxSection: some View {
        Section {
            QCheckboxGrid(label: nil,
                          options: PMHxCondition.allCases.map(\.rawValue),
                          rawSelection: Binding(
                            get: { Set(answers.pmhxConditions.map(\.rawValue)) },
                            set: { raws in
                                answers.pmhxConditions = Set(
                                    PMHxCondition.allCases.filter { raws.contains($0.rawValue) }
                                )
                            }
                          ))
            VStack(alignment: .leading, spacing: 8) {
                TextField("Current medications (name and dose)", text: $answers.medications, axis: .vertical)
                    .lineLimit(2...)
                HStack(spacing: 12) {
                    // Camera only — never the photo library, which on a practice iPad can hold
                    // other patients' clinical photos.
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button {
                            showPrescriptionCamera = true
                        } label: {
                            Label("Photo of prescription / medication bag",
                                  systemImage: "camera.badge.plus")
                                .scaledFont(size: 12)
                                .foregroundStyle(AMColor.accent)
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    if prescriptionImageData != nil {
                        Label("Photo captured", systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                }
            }
            // Mandatory question (owner's briefing §7): worded to include local bush teas, which
            // patients often do not count as medicine. Asks only; never instructs (hazard H-10).
            VStack(alignment: .leading, spacing: 8) {
                Text(SupplementCatalogue.patientQuestion)
                    .font(.callout)
                Picker("Herbs, bush teas or supplements", selection: $answers.supplementAnswer) {
                    ForEach([SupplementAnswer.yes, .no, .unsure], id: \.self) { a in
                        Text(a.rawValue).tag(a)
                    }
                }
                .pickerStyle(.segmented)
                if answers.supplementAnswer == .yes || answers.supplementAnswer == .unsure {
                    TextField("Which ones? (e.g. garlic tablets, cerasee tea, turmeric)", text: $answers.supplements, axis: .vertical)
                        .lineLimit(2...)
                }
            }
            TextField("Known allergies (drug, food, latex, other)", text: $answers.allergies, axis: .vertical)
                .lineLimit(2...)
            TextField("Previous operations / procedures", text: $answers.surgicalHistory, axis: .vertical)
                .lineLimit(2...)
        } header: {
            Label("Past Medical History", systemImage: "cross.case")
                .textCase(nil).scaledFont(size: 11, weight: .semibold)
        }
    }

    // ── Phase 6: Social history & last meal ───────────────────────────────────

    @ViewBuilder
    var phase6SocialSection: some View {
        Section {
            Picker("Smoking status", selection: $answers.smokingStatus) {
                ForEach(SmokingStatus.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Picker("Alcohol use", selection: $answers.alcoholUse) {
                ForEach(AlcoholUse.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            TextField("Occupation (optional)", text: $answers.occupation)
        } header: {
            Label("Social History", systemImage: "person.2")
                .textCase(nil).scaledFont(size: 11, weight: .semibold)
        }

        Section {
            Toggle("Record last meal time", isOn: Binding(
                get: { answers.lastMealTime != nil },
                set: { answers.lastMealTime = $0 ? .now : nil }
            ))
            if let _ = answers.lastMealTime {
                DatePicker("Last meal",
                           selection: Binding(
                            get: { answers.lastMealTime ?? .now },
                            set: { answers.lastMealTime = $0 }
                           ),
                           displayedComponents: [.date, .hourAndMinute])
            }
        } header: {
            Label("Last Meal", systemImage: "fork.knife")
                .textCase(nil).scaledFont(size: 11, weight: .semibold)
        } footer: {
            Text("Required if the patient may need surgery or anaesthesia today.")
                .font(.caption).foregroundStyle(.secondary)
        }

        // Fasting and complementary treatments — always last, after every clinical question
        // (AdaptiveQuestionnaireSheet+Lifestyle.swift; same questions as the web intake).
        lifestyleQuestionSections
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    // A registered patient's answers are written to their record now. A walk-in's answers (or
    // answers for a record removed while open) are handed back unsaved: staff attach them to a
    // record only after "Staff: exit" (WalkInAnswersAttachView), never while the patient holds
    // the iPad.

    func save() {
        let submission = QuestionnaireSubmission(answers: answers,
                                                 prescriptionImageData: prescriptionImageData)
        if let patient = livePatient {
            submission.apply(to: patient, context: context)
            Task { await sync.syncIfAuthenticated() }
            onSubmitted(submission, true)
        } else {
            onSubmitted(submission, false)
        }
    }
}

// MARK: - Submission

/// The patient's finished answers, held in memory until they are written to a record.
struct QuestionnaireSubmission {
    var answers: EncounterAnswers
    var prescriptionImageData: Data?

    // ── Save: single write to canonical Patient fields ────────────────────────
    // This is the ONLY place questionnaire data is written to the patient model.
    // Enforces the single-value-per-variable rule: no other path writes
    // chiefComplaint / hpi / pmhNotes during an encounter session.

    @MainActor
    func apply(to patient: Patient, context: ModelContext) {
        guard patient.isLive else { return }
        var answers = self.answers

        // Structured fields — direct write, no concatenation ambiguity.
        // These are the canonical values for chiefComplaint / hpi / pmhNotes.
        patient.chiefComplaint = answers.chiefComplaintText.isEmpty ? nil : answers.chiefComplaintText
        patient.hpi            = answers.hpiText.isEmpty ? nil : answers.hpiText
        patient.pmhNotes       = answers.pmhxText.isEmpty ? nil : answers.pmhxText

        // P6: surgical history, allergies, and medications from questionnaire.
        // Only write when the questionnaire captured data — never overwrite with blank.
        if !answers.surgicalHistory.isEmpty {
            patient.surgicalHistory = answers.surgicalHistory
        }
        if !answers.allergies.isEmpty {
            // Append questionnaire allergy text as a single AllergyEntry (severity unknown
            // at this stage — front desk captures name only, severity confirmed by clinician).
            let existing = patient.allergies
            let names = answers.allergies
                .components(separatedBy: CharacterSet(charactersIn: ",;"))
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            let existingNames = Set(existing.map { $0.name.lowercased() })
            let newEntries = names.compactMap { name -> AllergyEntry? in
                guard !existingNames.contains(name.lowercased()) else { return nil }
                return AllergyEntry(name: name, severity: "Unknown", reaction: "Not specified")
            }
            if !newEntries.isEmpty {
                patient.allergies = existing + newEntries
            }
        }
        if !answers.medications.isEmpty {
            // Append to pmhNotes as a MEDICATIONS: line so the pipeline can read it.
            let medLine = "MEDICATIONS: \(answers.medications)"
            if let existing = patient.pmhNotes, !existing.contains("MEDICATIONS:") {
                patient.pmhNotes = existing + "\n" + medLine
            } else if patient.pmhNotes == nil {
                patient.pmhNotes = medLine
            }
        }

        // Prescription photo — stored as PatientDocument for later clinical review.
        // AI extraction deferred per HIPAA compliance gate; document is flagged "Other"
        // and the medications free-text field notes a photo is attached.
        if let imageData = prescriptionImageData {
            let doc = PatientDocument(
                fileName: "rx-photo-\(Int(Date.now.timeIntervalSince1970)).jpg",
                mimeType: "image/jpeg",
                category: "Other"
            )
            doc.localData = imageData
            doc.patient = patient
            context.insert(doc)
            let photoNote = "[Prescription photo captured — awaiting clinical review]"
            if !answers.medications.isEmpty {
                answers.medications += "\n" + photoNote
            } else {
                answers.medications = photoNote
            }
        }

        // Human-readable pre-visit note for the doctor
        let note = ClinicalNote(noteType: .other, patient: patient)
        note.freeText = Self.readableNote(for: answers)
        context.insert(note)

        patient.updatedAt   = .now
        patient.pendingSync = true
        try? context.save()
        AuditLog.record("create", "clinical_note", patient: patient, resourceId: note.syncCode,
                        details: ["source": "pre_visit_questionnaire"])
    }

    static func readableNote(for answers: EncounterAnswers) -> String {
        var lines = ["PRE-VISIT QUESTIONNAIRE — \(DateFormatter.ectDateTime.string(from: .now)) ECT"]
        lines.append("")
        lines.append("CHIEF COMPLAINT: \(answers.chiefComplaintText)")
        if !answers.hpiText.isEmpty {
            lines.append("")
            lines.append(answers.hpiText)
        }
        if !answers.pmhxText.isEmpty {
            lines.append("")
            lines.append("PAST HISTORY & SOCIAL")
            lines.append(answers.pmhxText)
        }
        if let t = answers.lastMealTime {
            lines.append("LAST MEAL: \(DateFormatter.ectDateTime.string(from: t)) ECT")
        }
        return lines.joined(separator: "\n")
    }

}
