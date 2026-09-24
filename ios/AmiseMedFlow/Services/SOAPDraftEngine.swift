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

        // PMH — prefer structured entries, fall back to free text
        let pmhEntries = p.pmhEntries
        if !pmhEntries.isEmpty {
            let pmhText = pmhEntries.map { e -> String in
                let yr = e.yearText.isEmpty ? "" : " (\(e.yearText))"
                return "\(e.condition)\(yr)"
            }.joined(separator: "; ")
            parts.append("PMH: \(pmhText).")
        } else if let pmh = p.pmhNotes, !pmh.isEmpty {
            parts.append("PMH: \(pmh).")
        }

        // Surgical history — prefer structured entries, fall back to free text
        let pshxEntries = p.pshxEntries
        if !pshxEntries.isEmpty {
            let pshxText = pshxEntries.map { e -> String in
                var line = e.procedure
                if !e.yearText.isEmpty { line += " (\(e.yearText))" }
                if !e.anaesthetic.isEmpty { line += " [\(e.anaesthetic)]" }
                return line
            }.joined(separator: "; ")
            parts.append("Surgical history: \(pshxText).")
        } else if let pshx = p.surgicalHistory, !pshx.isEmpty {
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
            let allergyText = allergyList.map { a -> String in
                var line = a.name
                if !a.reaction.isEmpty { line += " (\(a.reaction))" }
                if !a.severity.isEmpty && a.severity != "Mild" { line += " — \(a.severity)" }
                return line
            }.joined(separator: ", ")
            parts.append("Allergies: \(allergyText).")
        }

        // Family history
        if let fhx = p.familyHistoryNotes, !fhx.isEmpty {
            parts.append("Family history: \(fhx).")
        }

        // Social history
        if let soc = p.socialHistory, !soc.isEmpty {
            parts.append("Social: \(soc).")
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

        // Investigations — structured labs first, then imaging/other, then pending
        let resulted = p.investigations.filter { $0.status == .resulted }
        let pending  = p.investigations.filter { $0.status == .ordered || $0.status == .pending }

        if !resulted.isEmpty {
            // Structured key lab values via LabPanel (produces precise numeric output)
            let labs = LabPanel.parse(from: resulted)
            var labTokens: [String] = []
            if let hb  = labs.haemoglobin {
                let flag = hb.value < 8 ? " [CRITICAL]" : ""
                labTokens.append(String(format: "Hb %.1f g/dL", hb.value) + flag)
            }
            if let wbc = labs.wbc {
                labTokens.append(String(format: "WBC %.1f ×10⁹/L", wbc.value))
            }
            if let plt = labs.platelets {
                let flag = plt.value < 50 ? " [CRITICAL]" : ""
                labTokens.append("Plt \(Int(plt.value)) ×10⁹/L" + flag)
            }
            if let na  = labs.sodium {
                let flag = (na.value < 120 || na.value > 155) ? " [CRITICAL]" : (na.value < 130 || na.value > 150) ? " [ABNL]" : ""
                labTokens.append("Na \(Int(na.value)) mmol/L" + flag)
            }
            if let k   = labs.potassium {
                let flag = (k.value < 2.5 || k.value > 6.0) ? " [CRITICAL]" : (k.value < 3.0 || k.value > 5.5) ? " [ABNL]" : ""
                labTokens.append(String(format: "K %.1f mmol/L", k.value) + flag)
            }
            if let cr  = labs.creatinine {
                let flag = cr.value > 300 ? " [CRITICAL]" : cr.value > 130 ? " [ABNL]" : ""
                labTokens.append("Cr \(Int(cr.value)) µmol/L" + flag)
            }
            if let ur  = labs.urea {
                labTokens.append(String(format: "Urea %.1f mmol/L", ur.value))
            }
            if let inr = labs.inr {
                let flag = inr.value > 2.5 ? " [CRITICAL]" : inr.value > 1.5 ? " [ABNL]" : ""
                labTokens.append(String(format: "INR %.1f", inr.value) + flag)
            }
            if let bil = labs.bilirubin {
                let flag = bil.value > 100 ? " [ABNL]" : ""
                labTokens.append("Bili \(Int(bil.value)) µmol/L" + flag)
            }
            if let alt = labs.alt {
                let flag = alt.value > 120 ? " [ABNL]" : ""
                labTokens.append("ALT \(Int(alt.value)) U/L" + flag)
            }
            if let ast = labs.ast {
                let flag = ast.value >= 1000 ? " [CRITICAL]" : ast.value > 120 ? " [ABNL]" : ""
                labTokens.append("AST \(Int(ast.value)) U/L" + flag)
            }
            if let alp = labs.alp {
                labTokens.append("ALP \(Int(alp.value)) U/L")
            }
            if let ca = labs.calcium {
                let flag = (ca.value < 1.75 || ca.value > 3.0) ? " [CRITICAL]" : (ca.value < 2.1 || ca.value > 2.6) ? " [ABNL]" : ""
                labTokens.append(String(format: "Ca %.2f mmol/L", ca.value) + flag)
            }
            if let lac = labs.lactate {
                let flag = lac.value >= 4.0 ? " [CRITICAL]" : lac.value >= 2.0 ? " [ABNL]" : ""
                labTokens.append(String(format: "Lactate %.1f mmol/L", lac.value) + flag)
            }
            if let glu = labs.glucose {
                let flag = (glu.value < 3.0 || glu.value > 20.0) ? " [CRITICAL]" : (glu.value < 4.0 || glu.value > 11.0) ? " [ABNL]" : ""
                labTokens.append(String(format: "Gluc %.1f mmol/L", glu.value) + flag)
            }
            if let alb = labs.albumin {
                let flag = alb.value < 2.5 ? " [CRITICAL]" : alb.value < 3.5 ? " [ABNL]" : ""
                labTokens.append(String(format: "Alb %.1f g/dL", alb.value) + flag)
            }
            if let amy = labs.amylase {
                let flag = amy.value > 300 ? " [CRITICAL]" : amy.value > 100 ? " [ABNL]" : ""
                labTokens.append("Amylase \(Int(amy.value)) U/L" + flag)
            }
            if let lip = labs.lipase {
                let flag = lip.value > 600 ? " [CRITICAL]" : lip.value > 200 ? " [ABNL]" : ""
                labTokens.append("Lipase \(Int(lip.value)) U/L" + flag)
            }
            if let trop = labs.troponin {
                let flag = trop.value > 52 ? " [CRITICAL]" : trop.value > 14 ? " [ABNL]" : ""
                labTokens.append(String(format: "Trop %.0f ng/L", trop.value) + flag)
            }
            if let dd = labs.dDimer {
                let flag = dd.value > 2000 ? " [CRITICAL]" : dd.value > 500 ? " [ABNL]" : ""
                labTokens.append("D-Dimer \(Int(dd.value)) µg/L" + flag)
            }
            if let crp = labs.crp {
                let flag = crp.value > 200 ? " [CRITICAL]" : crp.value > 10 ? " [ABNL]" : ""
                labTokens.append(String(format: "CRP %.0f mg/L", crp.value) + flag)
            }
            if let esr = labs.esr {
                let flag = esr.value > 100 ? " [CRITICAL]" : esr.value > 20 ? " [ABNL]" : ""
                labTokens.append("ESR \(Int(esr.value)) mm/h" + flag)
            }
            if let hba = labs.hba1c {
                let flag = hba.value > 10 ? " [CRITICAL]" : hba.value > 6.5 ? " [ABNL]" : ""
                labTokens.append(String(format: "HbA1c %.1f%%", hba.value) + flag)
            }

            if !labTokens.isEmpty {
                let critPrefix = labs.hasCriticalValues ? "⚠ " : ""
                parts.append("\(critPrefix)Labs: " + labTokens.joined(separator: ", ") + ".")
            }

            // Imaging, endoscopy, pathology and other non-lab results
            let nonLabResulted = resulted.filter { $0.category != .blood }
            if !nonLabResulted.isEmpty {
                let text = nonLabResulted.map { "\($0.name)\($0.result.isEmpty ? "" : ": \($0.result)")" }.joined(separator: "; ")
                parts.append("Imaging/other: \(text).")
            }

            // Blood results without a structured LabPanel match (free-text only — no numeric parse)
            let unstructuredLabs = resulted.filter { $0.category == .blood && !$0.result.isEmpty }
            if !unstructuredLabs.isEmpty && labTokens.isEmpty {
                let text = unstructuredLabs.map { "\($0.name): \($0.result)" }.joined(separator: "; ")
                parts.append("Results: \(text).")
            }
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

        // Post-operative day context for inpatients
        if p.setting == .inpatient {
            let sx = p.surgeryData
            if let opDate = sx.dateOfSurgery {
                let days = max(0, Calendar.current.dateComponents([.day], from: opDate, to: Date()).day ?? 0)
                let pod = days == 0 ? "Day of surgery" : "Post-operative day \(days)"
                let proc = sx.procedureName.isEmpty ? "surgery" : sx.procedureName
                lines.append("\(pod) following \(proc).")
            }
        }

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

    static func buildFollowUp(_ p: Patient) -> String {
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

extension String {
    func ifEmpty(_ fallback: String) -> String {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? fallback : self
    }
}
