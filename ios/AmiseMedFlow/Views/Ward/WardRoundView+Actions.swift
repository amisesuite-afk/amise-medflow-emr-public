// WardRoundView+Actions.swift
// Ward handover export, action functions, and discharge pre-fill for WardRoundView.

import SwiftUI
import SwiftData


extension WardRoundView {

    // MARK: - Ward handover export (plain-text fallback — retained for clipboard use)

    var wardHandoverText: String {
        let today = Date.now.formatted(date: .abbreviated, time: .shortened)
        var lines: [String] = []
        lines.append("WARD ROUND HANDOVER — \(today)")
        lines.append("\(PracticeProfile.current.practiceName) · \(PracticeProfile.current.clinicianSignature)")
        lines.append(String(repeating: "═", count: 48))

        let locationGroups = grouped
        for (loc, patients) in locationGroups {
            lines.append("")
            lines.append("  \(loc.rawValue.uppercased())")
            lines.append(String(repeating: "─", count: 48))
            for patient in patients {
                let reviewed = reviewedIDs.contains(patient.id) ? " ✓" : ""
                var header = "\(patient.fullName) · \(patient.sex.rawValue)" + (patient.ageDisplay.map { " · \($0)" } ?? "")
                if let bed = patient.bedNumber { header += " · Bed \(bed)" }
                header += " [\(patient.acuity.label.uppercased())]"
                lines.append(header + reviewed)
                if let dx = patient.workingDiagnosis { lines.append("  Dx: \(dx)") }
                else if let cc = patient.chiefComplaint { lines.append("  CC: \(cc)") }
                if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
                    var vParts = [v.news2Summary]
                    if let bp = v.bpString { vParts.append("BP \(bp)") }
                    if let hr = v.heartRate { vParts.append("HR \(hr)") }
                    if let spo = v.spo2 { vParts.append("SpO₂ \(spo)%") }
                    lines.append("  Vitals: \(vParts.joined(separator: " · "))")
                }
                let resulted = patient.investigations.filter { $0.status == .resulted && !$0.result.isEmpty }
                if !resulted.isEmpty {
                    let resultSummary = resulted.prefix(4).map { "\($0.name): \($0.result)" }.joined(separator: "; ")
                    lines.append("  Results: \(resultSummary)")
                }
                let pending = patient.investigations.filter { $0.status == .ordered || $0.status == .pending }
                if !pending.isEmpty {
                    lines.append("  Awaiting: \(pending.map { $0.name }.joined(separator: ", "))")
                }
                if let plan = patient.managementPlan, !plan.isEmpty {
                    let planPreview = plan.components(separatedBy: .newlines).first(where: { !$0.isEmpty }) ?? plan.prefix(120).description
                    lines.append("  Plan: \(planPreview)")
                }
                lines.append("")
            }
        }

        lines.append(String(repeating: "═", count: 48))
        let total = inpatients.count
        let done = reviewedIDs.filter { id in inpatients.contains { $0.id == id } }.count
        lines.append("Round progress: \(done)/\(total) reviewed")
        lines.append("This handover is a summary. Verify all details in the full record.")
        return lines.joined(separator: "\n")
    }

    // MARK: - Actions

    func delete(_ patients: [Patient], at offsets: IndexSet) {
        for i in offsets { context.deletePatient(patients[i]) }
    }

    func markReviewed(_ patient: Patient) {
        reviewedIDs.insert(patient.id)
        patient.updatedAt = .now
        patient.pendingSync = true
    }

    func escalateAcuity(_ patient: Patient) {
        switch patient.acuity {
        case .routine:   patient.acuity = .priority
        case .priority:  patient.acuity = .urgent
        case .urgent:    patient.acuity = .emergency
        case .emergency: break
        }
        patient.updatedAt = .now
        patient.pendingSync = true
    }

    func prepareDischarge(_ patient: Patient) {
        let note = ClinicalNote(noteType: .discharge, patient: patient)
        note.freeText = dischargeDraft(for: patient)
        context.insert(note)
        dischargeTarget = nil
        dischargeContext = DischargeContext(patient: patient, note: note)
    }

    func dischargePatient(_ patient: Patient) {
        patient.setting = .outpatient
        patient.updatedAt = .now
        patient.pendingSync = true
        dischargeContext = nil
    }

    // MARK: - Discharge summary pre-fill

    func dischargeDraft(for patient: Patient) -> String {
        let today = Date.now.formatted(date: .abbreviated, time: .omitted)

        var admissionLine = "—"
        var losLine = ""
        if let admitted = patient.admittedAt {
            admissionLine = admitted.formatted(date: .abbreviated, time: .omitted)
            let days = max(0, Calendar.current.dateComponents([.day], from: admitted, to: .now).day ?? 0)
            losLine = "Length of stay: \(days + 1) day\(days == 0 ? "" : "s")"
        }

        let dx = patient.workingDiagnosis ?? patient.chiefComplaint ?? "—"

        let rxLines: String = {
            let scripts = patient.prescriptions
            guard !scripts.isEmpty else { return "  None documented" }
            return scripts.map { "  • \($0.displayLine)" }.joined(separator: "\n")
        }()

        let allergyLines: String = {
            let list = patient.allergies
            guard !list.isEmpty else { return "  NKDA" }
            return list.map { "  • \($0.name) (\($0.reaction)) — \($0.severity)" }.joined(separator: "\n")
        }()

        var vitalsBlock = "  Not recorded"
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            var parts = [v.news2Summary]
            if let bp = v.bpString { parts.append("BP \(bp) mmHg") }
            if let hr = v.heartRate { parts.append("HR \(hr) bpm") }
            if let rr = v.respiratoryRate { parts.append("RR \(rr)/min") }
            if let t = v.temperatureCelsius { parts.append(String(format: "Temp %.1f°C", t)) }
            if let spo = v.spo2 { parts.append("SpO₂ \(spo)%") }
            vitalsBlock = "  " + parts.joined(separator: " · ")
        }

        var procedureLine = ""
        if let proc = patient.appointmentType, !proc.isEmpty {
            procedureLine = "\nProcedure: \(proc)"
        }

        // PMH — prefer structured entries
        var pmhLine = ""
        let pmhEntries = patient.pmhEntries
        if !pmhEntries.isEmpty {
            let pmhText = pmhEntries.map { e in
                e.yearText.isEmpty ? "• \(e.condition)" : "• \(e.condition) (\(e.yearText))"
            }.joined(separator: "\n  ")
            pmhLine = "\nPMH:\n  \(pmhText)"
        } else if let pmh = patient.pmhNotes, !pmh.isEmpty {
            pmhLine = "\nPMH: \(pmh)"
        }

        // PSHx — prefer structured entries
        var pshxLine = ""
        let pshxEntries = patient.pshxEntries
        if !pshxEntries.isEmpty {
            let pshxText = pshxEntries.map { e in
                var s = "• \(e.procedure)"
                if !e.yearText.isEmpty { s += " (\(e.yearText))" }
                if !e.anaesthetic.isEmpty { s += " — \(e.anaesthetic)" }
                return s
            }.joined(separator: "\n  ")
            pshxLine = "\nSurgical history:\n  \(pshxText)"
        } else if let pshx = patient.surgicalHistory, !pshx.isEmpty {
            pshxLine = "\nSurgical history: \(pshx)"
        }

        // Hospital course from completed encounters
        let completedEncounters = patient.encounters
            .filter { $0.isComplete }
            .sorted { $0.encounterDate < $1.encounterDate }
        let df2 = DateFormatter(); df2.dateStyle = .medium; df2.timeStyle = .none
        let hospitalCourse: String
        if completedEncounters.isEmpty {
            hospitalCourse = ""
        } else {
            let lines = completedEncounters.compactMap { enc -> String? in
                var parts = ["\(df2.string(from: enc.encounterDate)) — \(enc.visitType.rawValue)"]
                if let dx2 = enc.workingDiagnosis, !dx2.isEmpty { parts.append(dx2) }
                if let plan = enc.managementPlan, !plan.isEmpty { parts.append(plan) }
                return "  " + parts.joined(separator: ": ")
            }.joined(separator: "\n")
            hospitalCourse = "\n\(lines)"
        }

        let mrnLine = patient.mrn.map { "MRN: \($0)  " } ?? ""

        var gpLine = ""
        if let dr = patient.referringDoctor, !dr.isEmpty {
            let practice = patient.referringPractice.map { " (\($0))" } ?? ""
            let drPrefix = dr.lowercased().hasPrefix("dr") ? "" : "Dr "
            gpLine = "\nGP / Referring: \(drPrefix)\(dr)\(practice)"
        }

        return """
        DISCHARGE SUMMARY  ·  \(today)
        Consultant: \(PracticeProfile.current.clinicianName)
        Patient: \(patient.fullName) · \(patient.sex.rawValue.prefix(1)), \(patient.ageYears > 0 ? "\(patient.ageYears)y" : "age unknown")
        \(mrnLine)\([patient.ward.map { "Ward: \($0)" }, patient.bedNumber.map { "Bed: \($0)" }].compactMap { $0 }.joined(separator: "  "))\(gpLine)

        ADMISSION
        Admitted:  \(admissionLine)
        Discharged: \(today)
        \(losLine)\(procedureLine)

        DIAGNOSIS
        \(dx)\(pmhLine)\(pshxLine)

        HOSPITAL COURSE\(hospitalCourse)


        CONDITION AT DISCHARGE


        DISCHARGE MEDICATIONS
        \(rxLines)

        ALLERGIES
        \(allergyLines)

        OBSERVATIONS AT DISCHARGE
        \(vitalsBlock)

        FOLLOW-UP


        RETURN PRECAUTIONS
        Return if: fever >38.5°C, increased pain or swelling, wound concerns,
        or any new or worsening symptoms.

        WOUND CARE


        DIET / ACTIVITY

        """
    }

}
