// ConsultationView+Sheets.swift
// Add Allergy sheet, shared section header, medication helpers and utility helpers.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Add Allergy sheet

    @ViewBuilder
    var addAllergySheet: some View {
        NavigationStack {
            Form {
                Section("Allergen / Drug") {
                    TextField("e.g. Penicillin, Latex, Contrast, NSAIDs", text: $newAllergyName)
                        .autocorrectionDisabled()
                }
                Section("Severity") {
                    Picker("Severity", selection: $newAllergySeverity) {
                        ForEach(["Mild", "Moderate", "Severe"], id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section("Reaction / Symptom") {
                    TextField("e.g. Rash, Urticaria, Anaphylaxis, GI upset", text: $newAllergyReaction)
                }
            }
            .navigationTitle("Add Allergy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { resetAllergyForm(); showAddAllergy = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        var list = patient.allergies
                        list.append(AllergyEntry(
                            name: newAllergyName.trimmingCharacters(in: .whitespaces),
                            severity: newAllergySeverity,
                            reaction: newAllergyReaction.trimmingCharacters(in: .whitespaces)
                        ))
                        patient.allergies = list; touch()
                        resetAllergyForm(); showAddAllergy = false
                    }
                    .bold()
                    .disabled(newAllergyName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    // MARK: - Shared section header

    @ViewBuilder
    func sectionHeader(
        _ title: String, icon: String, filled: Bool, filledColor: Color = .teal
    ) -> some View {
        HStack(spacing: 6) {
            Label(title, systemImage: icon)
            Spacer()
            if filled {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(filledColor).font(.caption)
            }
        }
    }

    // MARK: - Medication history helpers

    func addMedicationEntry(name: String, dose: String, route: String, freq: String) {
        let rx = Prescription(drug: name, dose: dose, route: route, frequency: freq)
        rx.patient = patient
        context.insert(rx)
        touch()
        recomputeRisk()
    }

    @MainActor
    func suggestMedicationsForDiagnosis() async {
        let dx = (patient.workingDiagnosis ?? patient.chiefComplaint ?? "").lowercased()
        guard !dx.isEmpty else { return }
        isSuggestingMeds = true
        defer { isSuggestingMeds = false }
        // Local evidence-based suggestion lookup keyed on diagnosis/complaint keywords
        if dx.contains("cholecystit") || dx.contains("biliary") {
            aiMedSuggestions = ["Morphine (analgesia)", "Cefuroxime", "Metronidazole", "Ketorolac", "Omeprazole"]
        } else if dx.contains("appendic") {
            aiMedSuggestions = ["Cefuroxime", "Metronidazole", "Morphine (analgesia)", "IV Fluids (1L N/S stat)"]
        } else if dx.contains("pancreatit") {
            aiMedSuggestions = ["IV Fluids (aggressive)", "Morphine (analgesia)", "Omeprazole", "Thiamine (if alcohol-related)"]
        } else if dx.contains("hernia") {
            aiMedSuggestions = ["Morphine / Paracetamol (post-op analgesia)", "NSAIDs", "Stool softener (lactulose)"]
        } else if dx.contains("haemorrhoid") || dx.contains("hemorrhoid") || dx.contains("rectal") {
            aiMedSuggestions = ["Lactulose / Movicol", "Sitz baths", "Hydrocortisone suppositories", "Topical anaesthetic"]
        } else if dx.contains("obstruction") {
            aiMedSuggestions = ["IV Fluids", "NGT decompression", "Broad-spectrum antibiotics", "Morphine (analgesia)"]
        } else if dx.contains("perforation") || dx.contains("peritonitis") {
            aiMedSuggestions = ["Cefuroxime + Metronidazole", "IV Fluids (resuscitation)", "Morphine (analgesia)", "NGT"]
        } else if dx.contains("reflux") || dx.contains("gord") || dx.contains("gerd") {
            aiMedSuggestions = ["Omeprazole 20mg OD", "Gaviscon (alginate)", "Dietary modifications"]
        } else {
            aiMedSuggestions = ["IV Fluids", "Analgesia (paracetamol / morphine)", "Antiemetic (ondansetron)", "Proton pump inhibitor"]
        }
    }

    // MARK: - Helpers

    func touch() { patient.updatedAt = .now; patient.pendingSync = true }

    func computedAge(from dob: Date?) -> Int? {
        guard let dob else { return nil }
        return Calendar.current.dateComponents([.year], from: dob, to: .now).year
    }

    func resetAllergyForm() {
        newAllergyName = ""; newAllergySeverity = "Moderate"; newAllergyReaction = ""
    }

    func severityColor(_ s: String) -> Color {
        switch s {
        case "Severe":   return .red
        case "Moderate": return .orange
        default:         return .yellow
        }
    }


    func markAllNormal() {
        if (patient.examGeneral ?? "").isEmpty { patient.examGeneral = "Alert and oriented. No acute distress." }
        if (patient.examCVS ?? "").isEmpty    { patient.examCVS = "Regular rate and rhythm. No murmurs." }
        if (patient.examResp ?? "").isEmpty   { patient.examResp = "Clear to auscultation bilaterally." }
        if (patient.examAbdo ?? "").isEmpty   { patient.examAbdo = "Soft, non-tender, non-distended. No organomegaly." }
        touch()
    }

    func runPathway() {
        isAssessing = true
        let result = ClinicalPathwayEngine.assess(
            chiefComplaint: patient.chiefComplaint ?? "",
            pmh: patient.pmhNotes ?? ""
        )
        triageResult = result
        if result.suggestedAcuity < patient.acuity { patient.acuity = result.suggestedAcuity; touch() }
        isAssessing = false
    }

    func draftHPI() async {
        let draft = SOAPDraftEngine.draft(patient: patient)
        guard !draft.s.isEmpty else { showAIError = true; return }
        patient.hpi = draft.s
        touch()
    }

    func draftExam() async {
        // Fill only blank fields with standard findings; preserve any existing documentation
        if (patient.examGeneral ?? "").isEmpty {
            patient.examGeneral = "Alert and oriented. No acute distress. Afebrile."
        }
        if (patient.examCVS ?? "").isEmpty {
            patient.examCVS = "Regular rate and rhythm. No murmurs. Peripheral pulses present and equal."
        }
        if (patient.examResp ?? "").isEmpty {
            patient.examResp = "Clear to auscultation bilaterally. No wheeze or crackles."
        }
        if (patient.examAbdo ?? "").isEmpty {
            patient.examAbdo = "Soft, non-distended. Bowel sounds present. No guarding or rigidity."
        }
        touch()
    }

    func draftPlan() async {
        let soap = SOAPDraftEngine.draft(patient: patient)
        let hasContent = !soap.a.isEmpty || !soap.p.isEmpty
        guard hasContent else { showAIError = true; return }
        let parts = [soap.a.isEmpty ? nil : "Assessment: \(soap.a)",
                     soap.p.isEmpty ? nil : "Plan: \(soap.p)"]
            .compactMap { $0 }
        patient.managementPlan = parts.joined(separator: "\n\n")
        touch()
    }

    func generateLetter() async {
        let df = DateFormatter()
        df.dateStyle = .long; df.timeStyle = .none
        df.timeZone = TimeZone.ect

        let profile = PracticeProfile.current
        var lines: [String] = []
        lines.append(profile.practiceName)
        lines.append(profile.clinicianLetterheadName)
        lines.append(PracticeProfile.join([profile.specialty, profile.country], separator: ", "))
        lines.append("")
        lines.append(df.string(from: .now))
        lines.append("")
        if let ref = patient.referringDoctor, !ref.isEmpty {
            let lastName = ref.split(separator: " ").last.map(String.init) ?? ref
            lines.append("Dear Dr \(lastName),")
        } else {
            lines.append("Dear Colleague,")
        }
        lines.append("")
        lines.append("RE: \(patient.fullName)"
            + (patient.dateOfBirth.map { "  ·  DOB \(df.string(from: $0))" } ?? "")
            + (patient.mrn.map { "  ·  MRN \($0)" } ?? ""))
        lines.append("")
        lines.append("Thank you for referring the above patient, a \(patient.ageDisplay.map { "\($0) " } ?? "")\(patient.sex.rawValue.lowercased()), whom I had the pleasure of seeing in outpatient consultation today.")
        lines.append("")
        if let cc = patient.chiefComplaint, !cc.isEmpty {
            lines.append("PRESENTING COMPLAINT"); lines.append(cc); lines.append("")
        }
        if let hpi = patient.hpi, !hpi.isEmpty {
            lines.append("HISTORY"); lines.append(hpi); lines.append("")
        }
        var examParts: [String] = []
        if let g = patient.examGeneral, !g.isEmpty { examParts.append("General: \(g)") }
        if let a = patient.examAbdo,    !a.isEmpty { examParts.append("Abdomen: \(a)") }
        if let c = patient.examCVS,     !c.isEmpty { examParts.append("CVS: \(c)") }
        if !examParts.isEmpty {
            lines.append("EXAMINATION"); lines.append(examParts.joined(separator: "\n")); lines.append("")
        }
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            lines.append("IMPRESSION")
            lines.append(dx + (patient.workingDiagnosisICD.map { " [\($0)]" } ?? ""))
            lines.append("")
        }
        if let plan = patient.managementPlan, !plan.isEmpty {
            lines.append("MANAGEMENT PLAN"); lines.append(plan); lines.append("")
        }
        lines.append("I will continue to follow this patient and will keep you informed of their progress. Please do not hesitate to contact me should you require any further information.")
        lines.append("")
        lines.append("Yours sincerely,")
        lines.append("")
        lines.append(contentsOf: profile.signOff([
            profile.clinicianLetterheadName,
            profile.consultantTitle,
            profile.practiceNameWithCountry
        ]))

        generatedLetterText = lines.joined(separator: "\n")
        showLetterSheet = true
    }

    func exportConsultationPDF() -> PDFDataWrapper? {
        let data = ProcedureFormPDF.consultationReport(patient: patient, date: .now)

        // Archive a SOAP note record alongside the PDF export
        let note = ClinicalNote(noteType: .soap, patient: patient)
        let parts: [String] = [
            patient.chiefComplaint.map { "CC: \($0)" },
            patient.hpi.map { "HPI:\n\($0)" },
            patient.workingDiagnosis.map { "Diagnosis: \($0)" },
            patient.managementPlan.map { "Plan:\n\($0)" },
        ].compactMap { $0 }
        note.freeText = parts.joined(separator: "\n\n")
        context.insert(note); touch()
        return PDFDataWrapper(data: data)
    }

    func allergySummary() -> String {
        let list = patient.recordedAllergies
        guard !list.isEmpty else { return "Allergies: \(patient.noAllergyStatusText)" }
        return "Allergies: " + list.map { "\($0.name) [\($0.severity)]" }.joined(separator: ", ")
    }

    func medicationSummary() -> String {
        let rxs = patient.prescriptions
        guard !rxs.isEmpty else { return "" }
        return "Medications: " + rxs.map { $0.displayLine }.joined(separator: "; ")
    }

    func examSummary() -> String {
        [patient.examGeneral, patient.examCVS, patient.examResp, patient.examAbdo,
         patient.examNeuro, patient.examMSK, patient.examSkin, patient.examOther]
            .compactMap { $0 }.joined(separator: "\n")
    }


}
