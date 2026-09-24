// SOAPDraftEngine+Narrative.swift
// Narrative clinical summary generation — flowing paragraph prose
// suitable for letters and clinical summary documents.

import Foundation


extension SOAPDraftEngine {

    // MARK: - Narrative Clinical Summary

    /// Produces a flowing, paragraph-based clinical summary — suitable for letters and
    /// clinical summary documents. Preferred over fullNote for the summary editor fallback.
    static func narrativeSummary(patient p: Patient) -> String {
        var paragraphs: [String] = []

        // ── Paragraph 1: Identity + Presentation ─────────────────────────────
        var intro = ""
        if let name = p.fullName.isEmpty ? nil : p.fullName {
            intro += name
        }
        var age = ""
        if let a = p.ageDisplay { age = a }
        let sex = p.sex.rawValue.lowercased()
        if !age.isEmpty {
            intro += intro.isEmpty ? "\(age.capitalized) \(sex)" : ", a \(age)-old \(sex),"
        } else {
            intro += intro.isEmpty ? sex.capitalized : ", a \(sex),"
        }
        if let setting = p.visitType?.rawValue.lowercased() {
            intro += " presents as a \(setting)"
        } else {
            intro += " presents"
        }
        if let cc = p.chiefComplaint, !cc.isEmpty {
            intro += " with \(cc.lowercased())."
        } else {
            intro += "."
        }
        if let hpi = p.hpi, !hpi.isEmpty { intro += " \(hpi)" }
        paragraphs.append(intro)

        // ── Paragraph 2: Background ───────────────────────────────────────────
        var bg: [String] = []
        let pmhEntries = p.pmhEntries
        if !pmhEntries.isEmpty {
            let list = pmhEntries.map { e -> String in
                e.yearText.isEmpty ? e.condition : "\(e.condition) (\(e.yearText))"
            }.joined(separator: ", ")
            bg.append("Past medical history is notable for \(list).")
        } else if let pmh = p.pmhNotes, !pmh.isEmpty {
            bg.append("Past medical history: \(pmh).")
        }
        let pshxEntries = p.pshxEntries
        if !pshxEntries.isEmpty {
            let list = pshxEntries.map { e -> String in
                var s = e.procedure
                if !e.yearText.isEmpty { s += " (\(e.yearText))" }
                if !e.anaesthetic.isEmpty { s += " under \(e.anaesthetic) anaesthesia" }
                return s
            }.joined(separator: ", ")
            bg.append("Surgical history includes \(list).")
        } else if let pshx = p.surgicalHistory, !pshx.isEmpty {
            bg.append("Surgical history: \(pshx).")
        }
        let rxList = p.prescriptions.map { $0.displayLine }
        if !rxList.isEmpty {
            bg.append("Current medications: \(rxList.joined(separator: "; ")).")
        }
        let allergyList = p.recordedAllergies
        if allergyList.isEmpty {
            bg.append(p.hasExplicitNKDA ? "No known drug allergies." : "Allergies not recorded.")
        } else {
            let allergyText = allergyList.map { a -> String in
                var s = a.name
                if !a.reaction.isEmpty { s += " (\(a.reaction))" }
                return s
            }.joined(separator: ", ")
            bg.append("Known allergies: \(allergyText).")
        }
        if let fhx = p.familyHistoryNotes, !fhx.isEmpty { bg.append("Family history: \(fhx).") }
        if let soc = p.socialHistory, !soc.isEmpty { bg.append("Social history: \(soc).") }
        if !bg.isEmpty { paragraphs.append(bg.joined(separator: " ")) }

        // ── Paragraph 3: Examination & Investigations ─────────────────────────
        var findings: [String] = []
        if let v = p.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            var vitals: [String] = []
            if let bp = v.bpString { vitals.append("BP \(bp)") }
            if let hr = v.heartRate { vitals.append("HR \(hr) bpm") }
            if let temp = v.temperatureCelsius { vitals.append(String(format: "temperature %.1f°C", temp)) }
            if let spo = v.spo2 { vitals.append("SpO₂ \(spo)%") }
            if !vitals.isEmpty {
                findings.append("Vital signs: \(vitals.joined(separator: ", ")). \(v.news2Summary).")
            }
        }
        var examParts: [String] = []
        let pairs: [(String, String?)] = [
            ("general",      p.examGeneral),
            ("cardiovascular", p.examCVS),
            ("respiratory",  p.examResp),
            ("abdominal",    p.examAbdo),
            ("neurological", p.examNeuro),
            ("musculoskeletal", p.examMSK),
            ("skin",         p.examSkin),
        ]
        for (label, val) in pairs {
            if let v = val, !v.isEmpty { examParts.append("\(label.capitalized): \(v)") }
        }
        if !examParts.isEmpty { findings.append("Examination reveals " + examParts.joined(separator: "; ") + ".") }
        let resulted = p.investigations.filter { $0.status == .resulted }
        if !resulted.isEmpty {
            let invText = resulted.map { inv -> String in
                inv.result.isEmpty ? inv.name : "\(inv.name) \(inv.result)"
            }.joined(separator: "; ")
            findings.append("Investigations: \(invText).")
        }
        if !findings.isEmpty { paragraphs.append(findings.joined(separator: " ")) }

        // ── Paragraph 4: Assessment & Plan ───────────────────────────────────
        var ap: [String] = []
        if let dx = p.workingDiagnosis, !dx.isEmpty {
            var dxLine = "The working diagnosis is \(dx)"
            if let icd = p.workingDiagnosisICD { dxLine += " [\(icd)]" }
            ap.append(dxLine + ".")
        }
        if let assess = p.assessmentText, !assess.isEmpty { ap.append(assess) }
        if let plan = p.managementPlan, !plan.isEmpty { ap.append("Management plan: \(plan)") }
        let fu = buildFollowUp(p)
        if !fu.isEmpty { ap.append(fu) }
        if !ap.isEmpty { paragraphs.append(ap.joined(separator: " ")) }

        return paragraphs.joined(separator: "\n\n")
            .ifEmpty("Clinical summary to be completed.")
    }

}
