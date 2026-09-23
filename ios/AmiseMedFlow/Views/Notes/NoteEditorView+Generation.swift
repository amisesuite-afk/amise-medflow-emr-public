// NoteEditorView+Generation.swift
// Draft generation, PDF export, vitals helper, dictation mapping, templates.

import SwiftUI
import SwiftData

extension NoteEditorView {

    // MARK: - Draft generation (local, SOAPDraftEngine — no network)

    func generateSOAP(patient: Patient) async {
        isDrafting = true
        defer { isDrafting = false }
        let draft = SOAPDraftEngine.draft(patient: patient)
        let hasContent = !draft.s.isEmpty || !draft.o.isEmpty || !draft.a.isEmpty || !draft.p.isEmpty
        guard hasContent else {
            aiError = "Not enough clinical data to auto-fill. Please complete the history, examination, and chief complaint first."
            showError = true
            return
        }
        if !draft.s.isEmpty, note.subjective?.isEmpty ?? true { note.subjective = draft.s }
        if !draft.o.isEmpty, note.objective?.isEmpty  ?? true { note.objective  = draft.o }
        if !draft.a.isEmpty, note.assessment?.isEmpty ?? true { note.assessment = draft.a }
        if !draft.p.isEmpty, note.plan?.isEmpty       ?? true { note.plan       = draft.p }
        note.updatedAt    = .now
        note.isAIAssisted = true
        note.pendingSync  = true
    }

    func generateFreeText(patient: Patient) async {
        isDrafting = true
        defer { isDrafting = false }
        let text = SOAPDraftEngine.narrativeSummary(patient: patient)
        guard !text.isEmpty, text != "Clinical summary to be completed." else {
            aiError = "Not enough clinical data to draft a note. Please complete the consultation first."
            showError = true
            return
        }
        note.freeText     = text
        note.updatedAt    = .now
        note.isAIAssisted = true
        note.pendingSync  = true
    }

    func generateReferralNote(patient: Patient) async {
        isDrafting = true
        defer { isDrafting = false }
        let specialty = referralSpecialty.isEmpty ? "Relevant Specialty" : referralSpecialty
        let reason    = referralReason.isEmpty
            ? (patient.workingDiagnosis ?? patient.chiefComplaint ?? "Clinical review requested")
            : referralReason

        let df = DateFormatter()
        df.dateStyle = .long; df.timeStyle = .none
        df.timeZone = TimeZone(identifier: "America/St_Lucia")

        var lines: [String] = []
        lines.append("Dear \(specialty) Colleague,")
        lines.append("")
        lines.append("RE: \(patient.fullName)"
            + (patient.dateOfBirth.map { "  ·  DOB \(df.string(from: $0))" } ?? "")
            + (patient.mrn.map { "  ·  MRN \($0)" } ?? ""))
        lines.append("")
        lines.append("I am writing to refer the above patient, a \(patient.ageDisplay.map { "\($0) " } ?? "")\(patient.sex.rawValue.lowercased()), for your kind review and management.")
        lines.append("")
        if let cc = patient.chiefComplaint, !cc.isEmpty {
            lines.append("PRESENTING COMPLAINT"); lines.append(cc); lines.append("")
        }
        if let hpi = patient.hpi, !hpi.isEmpty {
            lines.append("HISTORY OF PRESENTING ILLNESS"); lines.append(hpi); lines.append("")
        }
        let pmhList = patient.pmhEntries
        if !pmhList.isEmpty {
            lines.append("PAST MEDICAL HISTORY")
            lines.append(pmhList.map { "\($0.condition)\($0.yearText.isEmpty ? "" : " (\($0.yearText))")" }.joined(separator: "; "))
            lines.append("")
        } else if let pmh = patient.pmhNotes, !pmh.isEmpty {
            lines.append("PAST MEDICAL HISTORY"); lines.append(pmh); lines.append("")
        }
        var examParts: [String] = []
        if let g = patient.examGeneral, !g.isEmpty { examParts.append("General: \(g)") }
        if let a = patient.examAbdo,    !a.isEmpty { examParts.append("Abdomen: \(a)") }
        if let c = patient.examCVS,     !c.isEmpty { examParts.append("CVS: \(c)") }
        if let r = patient.examResp,    !r.isEmpty { examParts.append("Respiratory: \(r)") }
        if !examParts.isEmpty {
            lines.append("EXAMINATION"); lines.append(examParts.joined(separator: "\n")); lines.append("")
        }
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            lines.append("WORKING DIAGNOSIS")
            lines.append(dx + (patient.workingDiagnosisICD.map { " [\($0)]" } ?? ""))
            lines.append("")
        }
        lines.append("REASON FOR REFERRAL"); lines.append(reason); lines.append("")
        if let plan = patient.managementPlan, !plan.isEmpty {
            lines.append("MANAGEMENT TO DATE"); lines.append(plan); lines.append("")
        }
        lines.append("I would be most grateful for your expert review and ongoing management. Please do not hesitate to contact me should you require any further information.")
        lines.append("")
        lines.append("Yours sincerely,")
        lines.append("")
        lines.append("Dr Dawit Daniel Kabiye  MD · DM")
        lines.append("General & Endoscopic Surgery")
        lines.append("Amise Medical Services, Saint Lucia")

        note.freeText     = lines.joined(separator: "\n")
        note.updatedAt    = .now
        note.isAIAssisted = true
        note.pendingSync  = true
    }

    func generateDischargeSummaryNote(patient: Patient) async {
        isDrafting = true
        defer { isDrafting = false }

        let df = DateFormatter()
        df.dateStyle = .long; df.timeStyle = .none
        df.timeZone = TimeZone(identifier: "America/St_Lucia")

        var lines: [String] = []
        lines.append("DISCHARGE SUMMARY")
        lines.append("Patient: \(patient.fullName)  ·  \(patient.sex.rawValue)  ·  MRN: \(patient.mrn ?? "—")")
        if let dob = patient.dateOfBirth {
            lines.append("DOB: \(df.string(from: dob))\(patient.ageDisplay.map { "  ·  \($0)" } ?? "")")
        }
        if let admitted = patient.admittedAt { lines.append("Admitted: \(df.string(from: admitted))") }
        lines.append("Discharged: \(df.string(from: .now))")
        if let ward = patient.ward, !ward.isEmpty {
            lines.append("Ward: \(ward)\(patient.bedNumber.map { ", Bed \($0)" } ?? "")")
        }
        lines.append("")
        if let cc = patient.chiefComplaint, !cc.isEmpty {
            lines.append("PRESENTING COMPLAINT / ADMISSION DIAGNOSIS"); lines.append(cc); lines.append("")
        }
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            lines.append("DISCHARGE DIAGNOSIS")
            lines.append(dx + (patient.workingDiagnosisICD.map { " [\($0)]" } ?? ""))
            lines.append("")
        }
        if !dischargeTreatment.isEmpty {
            lines.append("TREATMENT AND PROCEDURES"); lines.append(dischargeTreatment); lines.append("")
        } else if let assess = patient.assessmentText, !assess.isEmpty {
            lines.append("CLINICAL COURSE"); lines.append(assess); lines.append("")
        }
        let rxs = patient.prescriptions
        if !rxs.isEmpty {
            lines.append("DISCHARGE MEDICATIONS")
            lines.append(rxs.map { "• \($0.displayLine)" }.joined(separator: "\n"))
            lines.append("")
        }
        let pmhList = patient.pmhEntries
        if !pmhList.isEmpty {
            lines.append("BACKGROUND — PAST MEDICAL HISTORY")
            lines.append(pmhList.map { "\($0.condition)\($0.yearText.isEmpty ? "" : " (\($0.yearText))")" }.joined(separator: "; "))
            lines.append("")
        } else if let pmh = patient.pmhNotes, !pmh.isEmpty {
            lines.append("BACKGROUND — PAST MEDICAL HISTORY"); lines.append(pmh); lines.append("")
        }
        lines.append("FOLLOW-UP ARRANGEMENTS")
        if !dischargeFollowUp.isEmpty {
            lines.append(dischargeFollowUp)
        } else if let plan = patient.managementPlan, !plan.isEmpty {
            lines.append(plan)
        } else {
            lines.append("Please arrange outpatient review in 2–4 weeks.")
        }
        lines.append("")
        lines.append("Dr Dawit Daniel Kabiye  MD · DM")
        lines.append("General & Endoscopic Surgery, Amise Medical Services, Saint Lucia")

        note.freeText     = lines.joined(separator: "\n")
        note.updatedAt    = .now
        note.isAIAssisted = true
        note.pendingSync  = true
    }

    // MARK: - PDF export

    func exportPDF() async {
        guard let patient = note.patient else { return }
        isExportingPDF = true
        defer { isExportingPDF = false }

        let data = ClinicalNotePDF.generate(note: note, patient: patient)

        // Save as PatientDocument so it appears in Documents tab
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd_HHmm"
        let fileName = "\(note.noteType.label.replacingOccurrences(of: " ", with: "_"))_\(df.string(from: note.createdAt)).pdf"
        let doc = PatientDocument(fileName: fileName, mimeType: "application/pdf", category: "Clinical Notes")
        doc.localData = data
        doc.patient = patient
        context.insert(doc)
        patient.updatedAt = .now
        patient.pendingSync = true

        // Write to temp file for share sheet
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try? data.write(to: tmp)
        shareURL = tmp
        showShareSheet = true
    }

    // MARK: - Vitals insert helper

    func vitalsString(from v: VitalsEntry) -> String {
        let ts = v.recordedAt.formatted(date: .abbreviated, time: .shortened)
        var parts: [String] = ["Vitals (\(ts)):"]
        if let bp = v.bpString          { parts.append("BP \(bp) mmHg") }
        if let hr = v.heartRate          { parts.append("HR \(hr) bpm") }
        if let rr = v.respiratoryRate    { parts.append("RR \(rr) /min") }
        if let t  = v.temperatureCelsius { parts.append("Temp \(String(format: "%.1f", t))°C") }
        if let sp = v.spo2               { parts.append("SpO₂ \(sp)%") }
        if let wt = v.weightKg           { parts.append("Wt \(String(format: "%.1f", wt)) kg") }
        return parts.joined(separator: "  ·  ")
    }

    // MARK: - Dictation mode mapping

    func dictationModeFor(_ type: NoteType) -> DictationMode {
        switch type {
        case .operative:       return .operativeNote
        case .endoscopy:       return .endoscopy
        case .discharge:       return .discharge
        case .referralLetter:  return .referral
        case .clinicalSummary: return .clinicalSummary
        case .soap, .progress: return .hpi
        default:               return .plan
        }
    }

    // MARK: - Templates

    func templateFor(_ type: NoteType, patient: Patient? = nil) -> String {
        let today = Date.now.formatted(date: .abbreviated, time: .omitted)
        switch type {
        case .operative:
            return """
            OPERATIVE NOTE  ·  \(today)
            Surgeon: Dr Dawit Daniel Kabiye

            Procedure:
            Indication:
            Anaesthesia:
            Position:
            Prep & drape: Standard
            Incision:

            Findings:


            Technique:


            Haemostasis: Adequate
            Estimated blood loss:
            Irrigation:
            Closure:
            Drains: None
            Specimens:

            Complications: None

            Post-operative instructions:

            """

        case .endoscopy:
            return """
            ENDOSCOPY REPORT  ·  \(today)
            Endoscopist: Dr Dawit Daniel Kabiye

            Procedure:
            Indication:
            Instrument:
            Anaesthesia / sedation:
            Patient position: Left lateral

            FINDINGS
            --------

            Impression / Diagnosis:


            Plan:


            Biopsies / interventions:
            Patient tolerated procedure well.
            """

        case .discharge:
            return """
            DISCHARGE SUMMARY  ·  \(today)
            Consultant: Dr Dawit Daniel Kabiye

            Admitted:
            Discharged:
            Diagnosis:
            Procedures:

            Hospital course:


            Discharge condition:
            Discharge medications:


            Follow-up:
            Return precautions:
            Wound care:
            Diet / activity:
            """

        case .consultation:
            let refDr = patient?.referringDoctor.map { "Dr \($0)" } ?? ""
            let refCC = patient?.chiefComplaint ?? ""
            return """
            CONSULTATION NOTE  ·  \(today)
            Consultant: Dr Dawit Daniel Kabiye

            Referring doctor: \(refDr)
            Reason for referral: \(refCC)

            History:


            Examination:


            Impression:


            Recommendations:


            Thank you for this referral.
            """

        case .referralLetter:
            let ptName   = patient.map { "\($0.fullName), \($0.sex.rawValue.prefix(1))\($0.ageYears > 0 ? ", \($0.ageYears)y" : "")" } ?? ""
            let dxLine   = patient?.workingDiagnosis ?? patient?.chiefComplaint ?? ""
            let reLine   = [ptName, dxLine].filter { !$0.isEmpty }.joined(separator: " — ")
            let toLine: String
            if let refDr = patient?.referringDoctor, !refDr.isEmpty {
                let practice = patient?.referringPractice.map { " (\($0))" } ?? ""
                toLine = "Dear Dr \(refDr)\(practice),"
            } else {
                toLine = "Dear Dr ,"
            }
            let meds: String = {
                guard let p = patient, !p.prescriptions.isEmpty else { return "Nil" }
                return p.prescriptions.map { $0.displayLine }.joined(separator: "\n")
            }()
            let allergiesLine: String = {
                guard let p = patient else { return "NKDA" }
                let list = p.allergies
                return list.isEmpty ? "NKDA" : list.map { "\($0.name) (\($0.reaction))" }.joined(separator: "; ")
            }()
            return """
            \(today)

            \(toLine)

            RE: \(reLine)

            I am writing to refer this patient for your expert review regarding:


            Relevant history:


            Investigations:


            Current medications:
            \(meds)

            Allergies: \(allergiesLine)

            I would appreciate your assessment and management.

            Yours sincerely,
            Dr Dawit Daniel Kabiye
            General & Endoscopic Surgeon
            Amise Medical Services, Saint Lucia
            """

        default:
            return ""
        }
    }

}
