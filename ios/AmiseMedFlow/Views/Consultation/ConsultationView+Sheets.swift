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
        df.timeZone = TimeZone(identifier: "America/St_Lucia")

        var lines: [String] = []
        lines.append("Amise Medical Services")
        lines.append("Dr Dawit Daniel Kabiye  MD · DM")
        lines.append("General & Endoscopic Surgery, Saint Lucia")
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
        lines.append("Dr Dawit Daniel Kabiye  MD · DM")
        lines.append("Consultant General & Endoscopic Surgeon")
        lines.append("Amise Medical Services, Saint Lucia")

        generatedLetterText = lines.joined(separator: "\n")
        showLetterSheet = true
    }

    func exportConsultationPDF() -> PDFDataWrapper? {
        let pageW: CGFloat = 595.2
        let pageH: CGFloat = 841.8
        let margin: CGFloat = 48
        let bodyW = pageW - margin * 2

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageW, height: pageH))
        let data = renderer.pdfData { ctx in
            let para = NSMutableParagraphStyle(); para.lineSpacing = 2

            let titleAttrs:  [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 14, weight: .bold),    .paragraphStyle: para]
            let headingAttrs:[NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 11, weight: .semibold), .paragraphStyle: para]
            let bodyAttrs:   [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 10),                    .paragraphStyle: para]
            let mutedAttrs:  [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8),  .foregroundColor: UIColor.secondaryLabel, .paragraphStyle: para]

            func draw(_ s: String, attrs: [NSAttributedString.Key: Any], x: CGFloat, y: inout CGFloat, width: CGFloat) {
                guard !s.isEmpty else { return }
                let ns = NSAttributedString(string: s, attributes: attrs)
                let rect = ns.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], context: nil)
                if y + rect.height > pageH - margin {
                    ctx.beginPage(); y = margin
                }
                ns.draw(in: CGRect(x: x, y: y, width: width, height: rect.height))
                y += rect.height + 3
            }

            func section(_ title: String, body: String, y: inout CGFloat) {
                guard !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                y += 6
                draw(title.uppercased(), attrs: headingAttrs, x: margin, y: &y, width: bodyW)
                UIColor.separator.setFill()
                UIRectFill(CGRect(x: margin, y: y, width: bodyW, height: 0.5))
                y += 4
                draw(body, attrs: bodyAttrs, x: margin, y: &y, width: bodyW)
            }

            ctx.beginPage()
            var y: CGFloat = margin

            // Header
            let dob = patient.dateOfBirth.map { DateFormatter.localizedString(from: $0, dateStyle: .medium, timeStyle: .none) } ?? "DOB unknown"
            let ageStr = computedAge(from: patient.dateOfBirth).map { ", \($0)y" } ?? ""
            draw("CONSULTATION REPORT — \(patient.fullName.uppercased())", attrs: titleAttrs, x: margin, y: &y, width: bodyW)
            draw("\(patient.sex.rawValue)  ·  \(dob)\(ageStr)  ·  \(DateFormatter.localizedString(from: .now, dateStyle: .long, timeStyle: .short))",
                 attrs: mutedAttrs, x: margin, y: &y, width: bodyW)
            y += 4
            UIColor.separator.setFill(); UIRectFill(CGRect(x: margin, y: y, width: bodyW, height: 1)); y += 10

            // Clinical sections
            if let cc = patient.chiefComplaint { section("Presenting Complaint", body: cc, y: &y) }
            if let hpi = patient.hpi { section("History of Presenting Illness", body: hpi, y: &y) }
            section("Allergies", body: allergySummary(), y: &y)

            let med = medicationSummary()
            if !med.isEmpty { section("Current Medications", body: med.replacingOccurrences(of: "Medications: ", with: ""), y: &y) }

            if let pmh = patient.pmhNotes { section("Past Medical History", body: pmh, y: &y) }
            if let psh = patient.surgicalHistory { section("Past Surgical History", body: psh, y: &y) }
            if let fh = patient.familyHistoryNotes { section("Family History", body: fh, y: &y) }
            if let sh = patient.socialHistory { section("Social History", body: sh, y: &y) }

            let exam = examSummary()
            if !exam.isEmpty { section("Examination Findings", body: exam, y: &y) }

            // Investigations
            let invs = patient.investigations.filter { $0.status != .suggested }
            if !invs.isEmpty {
                section("Investigations", body: invs.map { "• \($0.name): \($0.result.isEmpty ? "Pending" : $0.result)" }.joined(separator: "\n"), y: &y)
            }

            // Diagnosis
            if let dx = patient.workingDiagnosis {
                let icd = patient.workingDiagnosisICD.map { " (\($0))" } ?? ""
                section("Working Diagnosis", body: "\(dx)\(icd)", y: &y)
            }

            if let plan = patient.managementPlan { section("Management Plan", body: plan, y: &y) }

            // Footer on last page
            y = pageH - margin
            draw("AMISE MEDICAL SERVICES · SAINT LUCIA · Generated \(DateFormatter.localizedString(from: .now, dateStyle: .medium, timeStyle: .short))",
                 attrs: mutedAttrs, x: margin, y: &y, width: bodyW)
        }

        // Also archive a record in Notes
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
        let list = patient.allergies
        guard !list.isEmpty else { return "Allergies: NKDA" }
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
