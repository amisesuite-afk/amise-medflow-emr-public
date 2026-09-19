import Foundation

// Deterministic local SOAP draft generator — no network, no AI.
// Composes structured text from patient data + pathway engine result + surgical vademecum.
struct SOAPDraft {
    let s: String
    let o: String
    let a: String
    let p: String

    // Convenience format used by AssessmentView (A + P only, matching prior AI output shape)
    var assessmentAndPlan: String {
        """
        A: \(a)

        P: \(p)
        """
    }

    // Full SOAP note
    var fullNote: String {
        """
        S: \(s)

        O: \(o)

        A: \(a)

        P: \(p)
        """
    }
}

struct SOAPDraftEngine {

    // MARK: - Main entry point

    static func draft(patient: Patient, triageResult: TriageResult? = nil) -> SOAPDraft {
        SOAPDraft(
            s: buildSubjective(patient),
            o: buildObjective(patient),
            a: buildAssessment(patient, triageResult: triageResult),
            p: buildPlan(patient, triageResult: triageResult)
        )
    }

    // MARK: - Subjective

    private static func buildSubjective(_ p: Patient) -> String {
        var parts: [String] = []

        // Visit context
        var context = "\(p.sex.rawValue)"
        if let age = p.ageDisplay { context += ", \(age)" }
        if let vt = p.visitType { context += ", \(vt.rawValue)" }
        parts.append(context)

        if let cc = p.chiefComplaint, !cc.isEmpty {
            parts.append("Presents with \(cc.lowercased()).")
        }

        if let hpi = p.hpi, !hpi.isEmpty {
            parts.append(hpi)
        }

        if let sx = p.associatedSymptoms, !sx.isEmpty {
            parts.append("Associated symptoms: \(sx).")
        }

        // PMH
        if let pmh = p.pmhNotes, !pmh.isEmpty {
            parts.append("PMH: \(pmh).")
        }

        // Surgical history
        if let pshx = p.surgicalHistory, !pshx.isEmpty {
            parts.append("Surgical history: \(pshx).")
        }

        // Medications
        let rxList = p.prescriptions.map { $0.displayLine }
        if !rxList.isEmpty {
            parts.append("Medications: " + rxList.joined(separator: "; ") + ".")
        }

        // Allergies
        let allergyList = p.allergies
        if allergyList.isEmpty {
            parts.append("NKDA.")
        } else {
            let allergyText = allergyList.map { "\($0.name) (\($0.reaction))" }.joined(separator: ", ")
            parts.append("Allergies: \(allergyText).")
        }

        return parts.joined(separator: " ").ifEmpty("No subjective data recorded.")
    }

    // MARK: - Objective

    private static func buildObjective(_ p: Patient) -> String {
        var parts: [String] = []

        // Vitals
        if let v = p.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            var vitals: [String] = ["NEWS2 \(v.news2Score) (\(v.news2Risk))"]
            if let bp = v.bpString { vitals.append("BP \(bp)") }
            if let hr = v.heartRate { vitals.append("HR \(hr) bpm") }
            if let rr = v.respiratoryRate { vitals.append("RR \(rr)/min") }
            if let temp = v.temperatureCelsius { vitals.append(String(format: "Temp %.1f°C", temp)) }
            if let spo = v.spo2 { vitals.append("SpO₂ \(spo)%") }
            parts.append("Vitals: " + vitals.joined(separator: ", ") + ".")
        }

        // BMI
        if let bmi = p.latestBMI(), let cat = p.bmiCategory {
            parts.append(String(format: "BMI %.1f (%@).", bmi, cat))
        }

        // Examination findings
        var examParts: [String] = []
        if let g = p.examGeneral, !g.isEmpty { examParts.append("Gen: \(g)") }
        if let a = p.examAbdo, !a.isEmpty { examParts.append("Abdo: \(a)") }
        if let c = p.examCVS, !c.isEmpty { examParts.append("CVS: \(c)") }
        if let r = p.examResp, !r.isEmpty { examParts.append("Resp: \(r)") }
        if let n = p.examNeuro, !n.isEmpty { examParts.append("Neuro: \(n)") }
        if let m = p.examMSK, !m.isEmpty { examParts.append("MSK: \(m)") }
        if let s = p.examSkin, !s.isEmpty { examParts.append("Skin: \(s)") }
        if let o = p.examOther, !o.isEmpty { examParts.append(o) }
        if !examParts.isEmpty {
            parts.append("Examination: " + examParts.joined(separator: ". ") + ".")
        }

        // Investigations
        let resulted = p.investigations.filter { $0.status == .resulted }
        let pending = p.investigations.filter { $0.status == .ordered || $0.status == .pending }
        if !resulted.isEmpty {
            let text = resulted.map { "\($0.name)\($0.result.isEmpty ? "" : ": \($0.result)")" }.joined(separator: "; ")
            parts.append("Results: \(text).")
        }
        if !pending.isEmpty {
            let text = pending.map { $0.name }.joined(separator: ", ")
            parts.append("Awaiting: \(text).")
        }

        return parts.joined(separator: " ").ifEmpty("Examination not yet documented.")
    }

    // MARK: - Assessment

    private static func buildAssessment(_ p: Patient, triageResult: TriageResult?) -> String {
        var parts: [String] = []

        // Primary diagnosis
        if let dx = p.workingDiagnosis, !dx.isEmpty {
            var dxLine = dx
            if let icd = p.workingDiagnosisICD { dxLine += " [\(icd)]" }
            parts.append(dxLine + ".")
        }

        // Acuity
        parts.append("Acuity: \(p.acuity.label).")

        // Pathway differentials
        if let result = triageResult, !result.differentials.isEmpty {
            let ddx = result.differentials.prefix(4).map { $0.name }.joined(separator: ", ")
            parts.append("Differential diagnosis: \(ddx).")
        }

        // Red flags
        if let result = triageResult, !result.redFlags.isEmpty {
            parts.append(result.redFlags.joined(separator: " "))
        }

        // Surgical vademecum match
        if let cond = SurgicalAlgorithmEngine.shared.lookup(diagnosisName: p.workingDiagnosis) {
            parts.append("Surgical classification: \(cond.system.rawValue), \(cond.urgency.rawValue).")
            if !cond.redFlags.isEmpty {
                parts.append("Key red flags: " + cond.redFlags.prefix(3).joined(separator: "; ") + ".")
            }
        }

        return parts.joined(separator: " ").ifEmpty("Assessment pending clinical review.")
    }

    // MARK: - Plan

    private static func buildPlan(_ p: Patient, triageResult: TriageResult?) -> String {
        var lines: [String] = []

        // Existing management plan
        if let plan = p.managementPlan, !plan.isEmpty {
            lines.append(plan)
        }

        // Surgical vademecum recommendations
        if let cond = SurgicalAlgorithmEngine.shared.lookup(diagnosisName: p.workingDiagnosis) {
            let algo = cond.algorithm

            // Investigations not yet ordered
            let orderedNames = Set(p.investigations.map { $0.name.lowercased() })
            let recommended = cond.investigations.filter {
                !orderedNames.contains($0.name.lowercased())
            }.prefix(5)
            if !recommended.isEmpty {
                let investText = recommended.map { $0.name }.joined(separator: ", ")
                lines.append("Investigations: \(investText).")
            }

            // Operative approach if urgent/emergency
            if cond.urgency == .immediate || cond.urgency == .emergency {
                let opText = algo.operativeOptions.prefix(2).map { $0.name }.joined(separator: " / ")
                if !opText.isEmpty {
                    lines.append("Consider: \(opText).")
                }
            }

            // Key pearls
            if !cond.pearls.isEmpty {
                lines.append("Surgical pearls: " + cond.pearls.prefix(2).joined(separator: "; ") + ".")
            }
        }

        // Pending investigations
        let pending = p.investigations.filter { $0.status == .ordered || $0.status == .pending }
        if !pending.isEmpty {
            lines.append("Await: " + pending.map { $0.name }.joined(separator: ", ") + ".")
        }

        // Follow-up
        let followUp = buildFollowUp(p)
        if !followUp.isEmpty { lines.append(followUp) }

        return lines.joined(separator: "\n").ifEmpty("Plan to be determined following clinical review.")
    }

    private static func buildFollowUp(_ p: Patient) -> String {
        if let cond = SurgicalAlgorithmEngine.shared.lookup(diagnosisName: p.workingDiagnosis) {
            let fu = cond.followUp
            var parts: [String] = []
            if !fu.clinicReview.isEmpty { parts.append("Review: \(fu.clinicReview)") }
            if !fu.redFlagReturn.isEmpty { parts.append("return if: " + fu.redFlagReturn.prefix(2).joined(separator: ", ")) }
            return parts.isEmpty ? "" : parts.joined(separator: "; ") + "."
        }
        switch p.acuity {
        case .emergency: return "Urgent surgical review — same day."
        case .urgent:    return "Review within 24–48 hours."
        case .priority:  return "Review within 1 week."
        case .routine:   return "Routine follow-up as arranged."
        }
    }
}

// MARK: - Helpers

private extension String {
    func ifEmpty(_ fallback: String) -> String {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? fallback : self
    }
}
