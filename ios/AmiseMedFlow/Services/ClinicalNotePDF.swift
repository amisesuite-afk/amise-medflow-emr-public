import UIKit

enum ClinicalNotePDF {

    // MARK: - Public entry point

    static func generate(note: ClinicalNote, patient: Patient) -> Data {
        let page     = CGRect(x: 0, y: 0, width: 595, height: 842)          // A4 portrait
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let teal     = UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 1)

        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = 0

            y = drawHeader(page: page, y: y, note: note, teal: teal)
            y = drawPatientStrip(page: page, y: y, patient: patient, teal: teal)
            y = drawMeta(page: page, y: y, note: note, teal: teal)

            if note.noteType == .consultation {
                y = drawConsultationFields(ctx: ctx, page: page, y: y, patient: patient, note: note, teal: teal)
            } else if note.noteType.isStructured {
                y = drawSOAP(ctx: ctx, page: page, y: y, note: note, teal: teal)
            } else {
                y = drawFreeText(ctx: ctx, page: page, y: y, note: note, teal: teal)
            }

            y += 20
            if y > page.height - 180 { ctx.beginPage(); y = 40 }
            y = drawVisitHistory(ctx: ctx, page: page, y: y, patient: patient, currentId: note.id, teal: teal)

            if note.status == .signed {
                drawSignatureBlock(ctx: ctx, page: page, y: y, teal: teal)
            }

            drawFooter(page: page, note: note)
        }
    }

    // MARK: - Header

    @discardableResult
    private static func drawHeader(page: CGRect, y: CGFloat, note: ClinicalNote, teal: UIColor) -> CGFloat {
        let h: CGFloat = 88
        teal.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: page.width, height: h))

        // "AMISE" brand mark
        "AMISE".draw(at: CGPoint(x: 24, y: 8),
                     withAttributes: [.font: UIFont.systemFont(ofSize: 22, weight: .black),
                                      .foregroundColor: UIColor.white,
                                      .kern: 4])

        "Amise Medical Services".draw(
            in: CGRect(x: 24, y: 34, width: 230, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.92)])

        "Dr Dawit Daniel Kabiye  MD · DM  ·  General & Endoscopic Surgery".draw(
            in: CGRect(x: 24, y: 50, width: 330, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.78)])

        // Right contact block
        let rightX = page.width - 24 - 160
        "Amise Medical Services".draw(
            in: CGRect(x: rightX, y: 18, width: 160, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.90)])
        "Saint Lucia, West Indies".draw(
            in: CGRect(x: rightX, y: 31, width: 160, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.72)])
        "+1 758 284 0557  ·  amisemedical.com".draw(
            in: CGRect(x: rightX, y: 43, width: 160, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.72)])

        // Separator
        UIColor.white.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: 0, y: h - 20, width: page.width, height: 0.5))

        // Document type + status badge on separator baseline
        note.noteType.label.uppercased().draw(
            in: CGRect(x: 24, y: h - 17, width: page.width - 120, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.88),
                             .kern: 1.5])

        let isDraft   = note.status == .draft
        let badgeText = isDraft ? "DRAFT" : "SIGNED"
        let badgeBg   = isDraft ? UIColor.systemOrange : UIColor(red: 0.18, green: 0.70, blue: 0.40, alpha: 1)
        let badgeRect = CGRect(x: page.width - 76, y: h - 22, width: 52, height: 18)
        badgeBg.setFill()
        UIBezierPath(roundedRect: badgeRect, cornerRadius: 3).fill()
        let bAttrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8, weight: .bold),
                                                      .foregroundColor: UIColor.white]
        let bSize = (badgeText as NSString).size(withAttributes: bAttrs)
        badgeText.draw(at: CGPoint(x: badgeRect.midX - bSize.width / 2,
                                   y: badgeRect.midY - bSize.height / 2),
                       withAttributes: bAttrs)

        return h
    }

    // MARK: - Signature block (signed notes only)

    private static func drawSignatureBlock(ctx: UIGraphicsPDFRendererContext,
                                           page: CGRect, y: CGFloat, teal: UIColor) {
        var y = y
        if y > page.height - 110 { ctx.beginPage(); y = 40 }
        y += 8

        // Section heading
        "AUTHORISING CLINICIAN".draw(
            in: CGRect(x: 24, y: y, width: page.width - 48, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 10, weight: .semibold),
                             .foregroundColor: teal])
        teal.withAlphaComponent(0.2).setFill()
        UIRectFill(CGRect(x: 24, y: y + 15, width: page.width - 48, height: 0.5))
        y += 22

        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8, weight: .semibold),
            .foregroundColor: UIColor.secondaryLabel,
        ]
        let nameAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9),
            .foregroundColor: UIColor.label,
        ]

        "Signature:".draw(at: CGPoint(x: 24, y: y), withAttributes: labelAttrs)
        teal.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: 86, y: y + 10, width: 220, height: 0.5))
        y += 18

        "Name:".draw(at: CGPoint(x: 24, y: y), withAttributes: labelAttrs)
        "Dr Dawit Daniel Kabiye  MD · DM".draw(
            in: CGRect(x: 86, y: y, width: 280, height: 13), withAttributes: nameAttrs)
        y += 16

        "Date / Time:".draw(at: CGPoint(x: 24, y: y), withAttributes: labelAttrs)
        teal.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: 86, y: y + 10, width: 220, height: 0.5))
        y += 18

        "This document was prepared with AI-assisted clinical software. The clinician's signature confirms review and approval.".draw(
            in: CGRect(x: 24, y: y, width: page.width - 48, height: 20),
            withAttributes: [.font: UIFont.italicSystemFont(ofSize: 6.5),
                             .foregroundColor: UIColor.tertiaryLabel])
    }

    // MARK: - Patient identity strip

    @discardableResult
    private static func drawPatientStrip(page: CGRect, y: CGFloat, patient: Patient, teal: UIColor) -> CGFloat {
        let h: CGFloat = 38
        teal.withAlphaComponent(0.1).setFill()
        UIRectFill(CGRect(x: 0, y: y, width: page.width, height: h))

        let dob = patient.dateOfBirth.map { DateFormatter.ectDate.string(from: $0) } ?? ""
        let parts: [String] = [
            patient.fullName,
            "\(patient.sex.rawValue)\(patient.ageYears > 0 ? ", \(patient.ageYears)y" : "")",
            dob,
            patient.mrn.map { "MRN \($0)" } ?? "",
            "\(patient.setting.rawValue) · \(patient.location.rawValue)"
        ].filter { !$0.isEmpty }

        parts.joined(separator: "   ·   ").draw(
            in: CGRect(x: 24, y: y + 12, width: page.width - 48, height: 16),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9.5, weight: .medium),
                             .foregroundColor: UIColor.label])

        return y + h + 8
    }

    // MARK: - Date / author line

    @discardableResult
    private static func drawMeta(page: CGRect, y: CGFloat, note: ClinicalNote, teal: UIColor) -> CGFloat {
        let dateStr = DateFormatter.ectLong.string(from: note.createdAt)
        "Created: \(dateStr) ECT   ·   Author: Dr Dawit Daniel Kabiye MD DM".draw(
            in: CGRect(x: 24, y: y, width: page.width - 48, height: 13),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                             .foregroundColor: UIColor.secondaryLabel])

        let rule = y + 16
        teal.withAlphaComponent(0.3).setFill()
        UIRectFill(CGRect(x: 24, y: rule, width: page.width - 48, height: 0.5))
        return rule + 12
    }

    // MARK: - Structured consultation fields (all fields, no data silos)

    @discardableResult
    private static func drawConsultationFields(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
                                               patient: Patient, note: ClinicalNote, teal: UIColor) -> CGFloat {
        var y = y

        // Build content blocks — label : value pairs
        var blocks: [(String, String)] = []

        if let cc = patient.chiefComplaint, !cc.isEmpty {
            blocks.append(("CHIEF COMPLAINT", cc))
        }
        if let assoc = patient.associatedSymptoms, !assoc.isEmpty {
            blocks.append(("ASSOCIATED SYMPTOMS", assoc))
        }
        if let hpi = patient.hpi, !hpi.isEmpty {
            blocks.append(("HISTORY OF PRESENTING ILLNESS", hpi))
        }
        // PMH — structured entries take priority over free-text
        let pmhEntries = patient.pmhEntries
        if !pmhEntries.isEmpty {
            let pmhText = pmhEntries.map { e -> String in
                let yr = e.yearText.isEmpty ? "" : " (\(e.yearText))"
                return "• \(e.condition)\(yr)"
            }.joined(separator: "\n")
            blocks.append(("PAST MEDICAL HISTORY", pmhText))
        } else if let pmh = patient.pmhNotes, !pmh.isEmpty {
            blocks.append(("PAST MEDICAL HISTORY", pmh))
        }

        // PSHx — structured entries take priority over free-text
        let pshxEntries = patient.pshxEntries
        if !pshxEntries.isEmpty {
            let pshxText = pshxEntries.map { e -> String in
                var line = "• \(e.procedure)"
                if !e.yearText.isEmpty { line += " (\(e.yearText))" }
                if !e.anaesthetic.isEmpty { line += " — \(e.anaesthetic)" }
                return line
            }.joined(separator: "\n")
            blocks.append(("PAST SURGICAL HISTORY", pshxText))
        } else if let pshx = patient.surgicalHistory, !pshx.isEmpty {
            blocks.append(("PAST SURGICAL HISTORY", pshx))
        }

        // Allergies
        let allergies = patient.allergies
        if allergies.isEmpty {
            blocks.append(("ALLERGIES", "No known drug allergies (NKDA)"))
        } else {
            let allergyText = allergies.map { "\($0.name) — \($0.reaction) (\($0.severity))" }.joined(separator: "\n")
            blocks.append(("ALLERGIES", allergyText))
        }

        // Social history
        if let soc = patient.socialHistory, !soc.isEmpty {
            blocks.append(("SOCIAL HISTORY", soc))
        }
        if let fhx = patient.familyHistoryNotes, !fhx.isEmpty {
            blocks.append(("FAMILY HISTORY", fhx))
        }

        // Examination
        var examParts: [String] = []
        if let g  = patient.examGeneral, !g.isEmpty  { examParts.append("General: \(g)") }
        if let ab = patient.examAbdo,    !ab.isEmpty  { examParts.append("Abdomen: \(ab)") }
        if let cv = patient.examCVS,     !cv.isEmpty  { examParts.append("CVS: \(cv)") }
        if let rs = patient.examResp,    !rs.isEmpty  { examParts.append("Respiratory: \(rs)") }
        if let nr = patient.examNeuro,   !nr.isEmpty  { examParts.append("Neurological: \(nr)") }
        if let ms = patient.examMSK,     !ms.isEmpty  { examParts.append("MSK: \(ms)") }
        if let sk = patient.examSkin,    !sk.isEmpty  { examParts.append("Skin: \(sk)") }
        if let ot = patient.examOther,   !ot.isEmpty  { examParts.append("Other: \(ot)") }
        if let v  = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            var vLine = "Vitals: NEWS2 \(v.news2Score) (\(v.news2Risk))"
            if let bp  = v.bpString    { vLine += " · BP \(bp) mmHg" }
            if let hr  = v.heartRate   { vLine += " · HR \(hr) bpm" }
            if let rr  = v.respiratoryRate { vLine += " · RR \(rr)/min" }
            if let tmp = v.temperatureCelsius { vLine += String(format: " · Temp %.1f°C", tmp) }
            if let sp  = v.spo2        { vLine += " · SpO₂ \(sp)%" }
            examParts.insert(vLine, at: 0)
        }
        if !examParts.isEmpty {
            blocks.append(("EXAMINATION", examParts.joined(separator: "\n")))
        }

        // Investigations
        let investigations = patient.investigations
        if !investigations.isEmpty {
            let invText = investigations.map { inv -> String in
                let status = inv.status == .resulted ? "✓" : "⏳"
                let result = inv.result.isEmpty ? "" : ": \(inv.result)"
                return "\(status) \(inv.name)\(result)"
            }.joined(separator: "\n")
            blocks.append(("INVESTIGATIONS", invText))
        }

        // Working diagnosis
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            let icd = patient.workingDiagnosisICD.map { " [\($0)]" } ?? ""
            blocks.append(("WORKING DIAGNOSIS", "\(dx)\(icd)"))
        }

        // Assessment
        if let assessment = note.assessment ?? patient.assessmentText, !assessment.isEmpty {
            blocks.append(("ASSESSMENT", assessment))
        }

        // Plan (from this specific note)
        if let plan = note.plan, !plan.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            blocks.append(("PLAN", plan))
        }

        // Medications
        if !patient.prescriptions.isEmpty {
            let rxText = patient.prescriptions.map { "• \($0.displayLine)" }.joined(separator: "\n")
            blocks.append(("MEDICATIONS / PRESCRIPTIONS", rxText))
        }

        // Management plan
        if let plan = patient.managementPlan, !plan.isEmpty {
            blocks.append(("MANAGEMENT PLAN", plan))
        }

        // Quick notes (surgeon's scratch-pad)
        if let quick = patient.notes, !quick.isEmpty {
            blocks.append(("QUICK NOTES", quick))
        }

        // Free text from note (if any)
        if let ft = note.freeText, !ft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            blocks.append(("CONSULTATION NOTE", ft))
        }

        for (label, body) in blocks {
            if y > page.height - 80 { ctx.beginPage(); y = 40 }
            y = drawSection(ctx: ctx, page: page, y: y, label: label, body: body, teal: teal, mono: false)
        }

        return y
    }

}
