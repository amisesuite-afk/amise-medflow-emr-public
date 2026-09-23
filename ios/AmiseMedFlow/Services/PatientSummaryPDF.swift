import UIKit
import SwiftUI

// MARK: - Full patient summary PDF generator

enum PatientSummaryPDF {

    // Teal brand colour
    private static let teal = UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 1)
    private static let pageW: CGFloat = 595  // A4 portrait
    private static let pageH: CGFloat = 842
    private static let margin: CGFloat = 28
    private static let colW: CGFloat = 595 - 56 // pageW - 2*margin

    static func generate(for patient: Patient) -> Data {
        let pageRect = CGRect(x: 0, y: 0, width: pageW, height: pageH)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = 0

            y = drawHeader(patient: patient, y: y)
            y = drawDemographics(ctx: ctx, patient: patient, y: y)
            y = maybeNewPage(ctx: ctx, y: y)
            y = drawClinical(ctx: ctx, patient: patient, y: y)
            drawSignatureBlock(ctx: ctx, y: y)
            drawFooter(pageRect: pageRect)
        }
    }

    // MARK: - Page sections

    private static func drawHeader(patient: Patient, y: CGFloat) -> CGFloat {
        let h: CGFloat = 88
        teal.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: pageW, height: h))

        // "AMISE" brand mark
        "AMISE".draw(at: CGPoint(x: margin, y: 8),
                     withAttributes: [.font: UIFont.systemFont(ofSize: 22, weight: .black),
                                      .foregroundColor: UIColor.white,
                                      .kern: 4])

        "Amise Medical Services".draw(
            in: CGRect(x: margin, y: 34, width: 230, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.92)])

        "Dr Dawit Daniel Kabiye  MD · DM  ·  General & Endoscopic Surgery".draw(
            in: CGRect(x: margin, y: 50, width: 330, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.78)])

        // Right — patient name prominently in header
        let rightX = pageW * 0.55
        let nameAttr = NSMutableAttributedString(
            string: "PATIENT SUMMARY\n",
            attributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                         .foregroundColor: UIColor.white.withAlphaComponent(0.70),
                         .kern: 1.2])
        nameAttr.append(NSAttributedString(
            string: patient.fullName,
            attributes: [.font: UIFont.systemFont(ofSize: 13, weight: .bold),
                         .foregroundColor: UIColor.white]))
        nameAttr.draw(in: CGRect(x: rightX, y: 10, width: pageW - rightX - margin, height: 44))

        // Separator
        UIColor.white.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: 0, y: h - 20, width: pageW, height: 0.5))

        "CLINICAL RECORD SUMMARY".draw(
            in: CGRect(x: margin, y: h - 17, width: pageW - margin * 2, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.88),
                             .kern: 1.5])

        // Generated timestamp below header bar
        let ts = "\(DateFormatter.ectDateTime.string(from: .now)) ECT"
        ts.draw(in: CGRect(x: margin, y: h + 3, width: colW, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.secondaryLabel])

        return h + 18
    }

    // MARK: - Signature block

    private static func drawSignatureBlock(ctx: UIGraphicsPDFRendererContext, y: CGFloat) {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 110)
        y += 8

        "AUTHORISING CLINICIAN".draw(
            in: CGRect(x: margin, y: y, width: colW, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .bold), .foregroundColor: teal])
        teal.withAlphaComponent(0.2).setFill()
        UIRectFill(CGRect(x: margin, y: y + 15, width: colW, height: 0.5))
        y += 22

        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8, weight: .semibold),
            .foregroundColor: UIColor.secondaryLabel,
        ]
        let nameAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9),
            .foregroundColor: UIColor.label,
        ]

        "Signature:".draw(at: CGPoint(x: margin, y: y), withAttributes: labelAttrs)
        teal.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: margin + 62, y: y + 10, width: 220, height: 0.5))
        y += 18

        "Name:".draw(at: CGPoint(x: margin, y: y), withAttributes: labelAttrs)
        "Dr Dawit Daniel Kabiye  MD · DM".draw(
            in: CGRect(x: margin + 62, y: y, width: 280, height: 13), withAttributes: nameAttrs)
        y += 16

        "Date / Time:".draw(at: CGPoint(x: margin, y: y), withAttributes: labelAttrs)
        teal.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: margin + 62, y: y + 10, width: 220, height: 0.5))
        y += 18

        "This document was prepared with AI-assisted clinical software. The clinician's signature confirms review and approval.".draw(
            in: CGRect(x: margin, y: y, width: colW, height: 20),
            withAttributes: [.font: UIFont.italicSystemFont(ofSize: 6.5),
                             .foregroundColor: UIColor.tertiaryLabel])
    }

    private static func drawDemographics(ctx: UIGraphicsPDFRendererContext, patient: Patient, y: CGFloat) -> CGFloat {
        var y = y
        y = sectionTitle("Patient Information", y: y)

        var rows: [(String, String)] = [
            ("Full name",  patient.fullName),
            ("Date of birth", patient.dateOfBirth.map { DateFormatter.ectDate.string(from: $0) } ?? "—"),
            ("Age",        patient.ageDisplay ?? "—"),
            ("Sex",        patient.sex.rawValue),
            ("MRN",        patient.mrn ?? "—"),
        ]
        if let ph = patient.phone  { rows.append(("Phone", ph)) }
        if let em = patient.email  { rows.append(("Email", em)) }
        if let ad = patient.address { rows.append(("Address", ad)) }
        if let ins = patient.insuranceProvider { rows.append(("Insurer", ins + (patient.policyNumber.map { " · \($0)" } ?? ""))) }
        rows += [
            ("Setting",    "\(patient.setting.rawValue) · \(patient.location.rawValue)"),
            ("Acuity",     patient.acuity.label),
        ]
        if let vt = patient.visitType { rows.append(("Visit type", vt.rawValue)) }
        if let ward = patient.ward    { rows.append(("Ward", ward + (patient.bedNumber.map { ", Bed \($0)" } ?? ""))) }
        if let nok = patient.nokName  { rows.append(("Next of kin", nok + (patient.nokRelation.map { " (\($0))" } ?? "") + (patient.nokPhone.map { " · \($0)" } ?? ""))) }

        // Admission / discharge dates (inpatients)
        if let admitted = patient.admittedAt {
            rows.append(("Admitted", DateFormatter.ectLong.string(from: admitted)))
        }
        if let expected = patient.expectedDischarge {
            rows.append(("Expected discharge", DateFormatter.ectDate.string(from: expected)))
        }

        // Referral information
        if let src = patient.referralSource { rows.append(("Referral source", src.rawValue)) }
        if let rd = patient.referringDoctor, !rd.isEmpty { rows.append(("Referring doctor", rd)) }
        if let rp = patient.referringPractice, !rp.isEmpty { rows.append(("Referring practice", rp)) }

        // ASA class
        if let asa = patient.asaClass { rows.append(("ASA class", "ASA \(asa)")) }

        // Height / BMI
        if let h = patient.heightCm, h > 0 {
            var hRow = String(format: "%.0f cm", h)
            if let wt = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first?.weightKg, wt > 0 {
                let bmi = wt / ((h / 100) * (h / 100))
                hRow += String(format: "  ·  BMI %.1f", bmi)
                if let cat = patient.bmiCategory { hRow += " (\(cat))" }
            }
            rows.append(("Height / BMI", hRow))
        }

        y = drawRows(ctx: ctx, rows: rows, y: y)
        return y + 6
    }

    private static func drawClinical(ctx: UIGraphicsPDFRendererContext, patient: Patient, y: CGFloat) -> CGFloat {
        var y = y

        // Chief complaint
        if let cc = patient.chiefComplaint, !cc.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Chief Complaint", y: y)
            y = drawText(ctx: ctx, text: cc, y: y)
        }

        // Associated symptoms
        if let assoc = patient.associatedSymptoms, !assoc.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Associated Symptoms", y: y)
            y = drawText(ctx: ctx, text: assoc, y: y)
        }

        // HPI
        if let hpi = patient.hpi, !hpi.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("History of Present Illness", y: y)
            y = drawText(ctx: ctx, text: hpi, y: y)
        }

        // Allergies
        let allergies = patient.allergies
        if !allergies.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Allergies", y: y)
            y = drawRows(ctx: ctx, rows: allergies.map { ("⚠ \($0.name)", "\($0.reaction) — \($0.severity)") }, y: y)
        } else {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Allergies", y: y)
            y = drawRows(ctx: ctx, rows: [("Allergies", "NKDA — no known drug allergies")], y: y)
        }

        // PMH — prefer structured entries; fall back to free-text
        let pmhEntries = patient.pmhEntries
        if !pmhEntries.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Past Medical History", y: y)
            let pmhRows = pmhEntries.map { e -> (String, String) in
                let yr = e.yearText.isEmpty ? "" : " (\(e.yearText))"
                return ("•", "\(e.condition)\(yr)")
            }
            y = drawRows(ctx: ctx, rows: pmhRows, y: y)
        } else if let pmh = patient.pmhNotes, !pmh.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Past Medical History", y: y)
            y = drawText(ctx: ctx, text: pmh, y: y)
        }

        // Surgical history — prefer structured entries; fall back to free-text
        let pshxEntries = patient.pshxEntries
        if !pshxEntries.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Surgical History", y: y)
            let pshxRows = pshxEntries.map { e -> (String, String) in
                var detail = e.procedure
                if !e.yearText.isEmpty { detail += " (\(e.yearText))" }
                if !e.anaesthetic.isEmpty { detail += " — \(e.anaesthetic)" }
                return ("•", detail)
            }
            y = drawRows(ctx: ctx, rows: pshxRows, y: y)
        } else if let pshx = patient.surgicalHistory, !pshx.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Surgical History", y: y)
            y = drawText(ctx: ctx, text: pshx, y: y)
        }

        // Social history
        if let soc = patient.socialHistory, !soc.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Social History", y: y)
            y = drawText(ctx: ctx, text: soc, y: y)
        }

        // Family history
        if let fhx = patient.familyHistoryNotes, !fhx.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Family History", y: y)
            y = drawText(ctx: ctx, text: fhx, y: y)
        }

        // Examination
        let examParts: [(String, String?)] = [
            ("General",        patient.examGeneral),
            ("CVS",            patient.examCVS),
            ("Respiratory",    patient.examResp),
            ("Abdomen",        patient.examAbdo),
            ("Neurological",   patient.examNeuro),
            ("MSK",            patient.examMSK),
            ("Skin",           patient.examSkin),
            ("Other",          patient.examOther),
        ]
        let filledExam = examParts.compactMap { (label, val) -> (String, String)? in
            guard let v = val, !v.isEmpty else { return nil }
            return (label, v)
        }
        if !filledExam.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Examination", y: y)
            y = drawRows(ctx: ctx, rows: filledExam, y: y)
        }

        // Investigations
        let invs = patient.investigations
        if !invs.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Investigations (\(invs.count))", y: y)
            for inv in invs {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 30)
                let statusLabel = inv.status.rawValue.capitalized
                var line = "\(inv.name)"
                if !inv.result.isEmpty {
                    line += ": \(inv.result.prefix(120))"
                }
                y = drawRows(ctx: ctx, rows: [("\(inv.category.rawValue) · \(statusLabel)", line)], y: y)
            }
            y += 4
        }

        // Working diagnosis
        if let dx = patient.workingDiagnosis {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Working Diagnosis", y: y)
            var dxRows: [(String, String)] = [("Diagnosis", dx + (patient.workingDiagnosisICD.map { " (\($0))" } ?? ""))]
            if let assess = patient.assessmentText, !assess.isEmpty {
                dxRows.append(("Assessment", assess))
            }
            y = drawRows(ctx: ctx, rows: dxRows, y: y)
        }

        // Management plan
        if let plan = patient.managementPlan, !plan.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Management Plan", y: y)
            y = drawText(ctx: ctx, text: plan, y: y)
        }

        // Latest vitals
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Latest Vitals  ·  \(DateFormatter.ectShort.string(from: v.recordedAt)) ECT", y: y)
            var vRows: [(String, String)] = [("NEWS2", "\(v.news2Score) — \(v.news2Risk)")]
            if let bp = v.bpString  { vRows.append(("BP", "\(bp) mmHg")) }
            if let hr = v.heartRate { vRows.append(("Heart rate", "\(hr) bpm")) }
            if let rr = v.respiratoryRate { vRows.append(("Resp rate", "\(rr)/min")) }
            if let t  = v.temperatureCelsius { vRows.append(("Temperature", String(format: "%.1f°C", t))) }
            if let s  = v.spo2   { vRows.append(("SpO₂", "\(s)%")) }
            if let wt = v.weightKg { vRows.append(("Weight", String(format: "%.1f kg", wt))) }
            y = drawRows(ctx: ctx, rows: vRows, y: y)
        }

        // Medications
        let rxs = patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }
        if !rxs.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Medications (\(rxs.count))", y: y)
            y = drawRows(ctx: ctx, rows: rxs.map { ($0.drug, $0.displayLine) }, y: y)
        }

        // Operative plan
        if let plan = patient.operativePlans.sorted(by: { $0.updatedAt > $1.updatedAt }).first {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Operative Plan", y: y)
            var opRows: [(String, String)] = []
            if !plan.consentProcedure.isEmpty { opRows.append(("Procedure", plan.consentProcedure)) }
            opRows.append(("Consent signed", plan.consentSigned ? "Yes" : "No"))
            if !plan.anaesthesiaType.isEmpty { opRows.append(("Anaesthesia", plan.anaesthesiaType)) }
            if !plan.positioning.isEmpty { opRows.append(("Positioning", plan.positioning)) }
            if !plan.antibioticProphylaxis.isEmpty { opRows.append(("Antibiotics", plan.antibioticProphylaxis)) }
            if !plan.vteProphy.isEmpty { opRows.append(("VTE prophylaxis", plan.vteProphy)) }
            if !plan.specialEquipment.isEmpty { opRows.append(("Special equipment", plan.specialEquipment)) }
            if !plan.surgicalTeamNote.isEmpty { opRows.append(("Team note", plan.surgicalTeamNote)) }
            opRows.append(("WHO safety checklist", "\(plan.whoCompletedCount)/\(plan.whoTotalCount) complete"))
            y = drawRows(ctx: ctx, rows: opRows, y: y)
        }

        // Signed clinical notes — all signed notes with any content (structured or free-text)
        let signedNotes = patient.clinicalNotes
            .filter { $0.status == .signed && !$0.isEmpty }
            .sorted { $0.createdAt > $1.createdAt }
        for note in signedNotes {
            y = maybeNewPage(ctx: ctx, y: y)
            let dateStr = DateFormatter.ectShort.string(from: note.createdAt)
            let label = "\(note.noteType.label)  ·  \(dateStr) ECT"
            y = sectionTitle(label, y: y)
            // Structured SOAP notes: render each field with a sub-label
            if note.noteType.isStructured {
                var noteRows: [(String, String)] = []
                if let s = note.subjective,   !s.isEmpty { noteRows.append(("Subjective",   s)) }
                if let o = note.objective,    !o.isEmpty { noteRows.append(("Objective",    o)) }
                if let a = note.assessment,   !a.isEmpty { noteRows.append(("Assessment",   a)) }
                if let p = note.plan,         !p.isEmpty { noteRows.append(("Plan",         p)) }
                if !noteRows.isEmpty {
                    y = drawRows(ctx: ctx, rows: noteRows, y: y)
                }
            }
            // Free-text (or additional free-text on a structured note)
            if let text = note.freeText, !text.isEmpty {
                y = drawText(ctx: ctx, text: text, y: y)
            }
        }

        // Score history summary (if any)
        let recentScores = patient.scoreHistory
            .sorted { $0.recordedAt > $1.recordedAt }
            .prefix(10)
        if !recentScores.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Clinical Scores", y: y)
            y = drawRows(ctx: ctx, rows: recentScores.map {
                ("\($0.scoreName)  ·  \(DateFormatter.ectShort.string(from: $0.recordedAt))",
                 "\($0.abbreviation)  —  \($0.riskRaw)")
            }, y: y)
        }

        // Visit history (completed encounters)
        let completedEncounters = patient.encounters
            .filter { $0.isComplete }
            .sorted { $0.createdAt > $1.createdAt }
        if !completedEncounters.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y)
            y = sectionTitle("Visit History (\(completedEncounters.count))", y: y)
            y = drawRows(ctx: ctx, rows: completedEncounters.map { enc in
                let dateStr = DateFormatter.ectShort.string(from: enc.createdAt)
                let dx = enc.workingDiagnosis ?? "—"
                return ("\(enc.visitType.rawValue)  ·  \(dateStr)", dx)
            }, y: y)
        }

        return y
    }

    // MARK: - Drawing helpers

    @discardableResult
    private static func sectionTitle(_ title: String, y: CGFloat) -> CGFloat {
        title.uppercased().draw(
            in: CGRect(x: margin, y: y, width: colW, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .bold), .foregroundColor: teal])
        teal.withAlphaComponent(0.2).setFill()
        UIRectFill(CGRect(x: margin, y: y + 15, width: colW, height: 0.5))
        return y + 18
    }

    @discardableResult
    private static func drawRows(ctx: UIGraphicsPDFRendererContext, rows: [(String, String)], y: CGFloat) -> CGFloat {
        var y = y
        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9.5, weight: .medium),
            .foregroundColor: UIColor.secondaryLabel]
        let valueAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9.5),
            .foregroundColor: UIColor.label]
        let valW = colW - 110
        for (label, value) in rows {
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 16)
            let textH = max(13, (value as NSString).boundingRect(
                with: CGSize(width: valW, height: 200),
                options: .usesLineFragmentOrigin, attributes: valueAttrs, context: nil).height + 2)
            label.draw(in: CGRect(x: margin, y: y, width: 106, height: textH), withAttributes: labelAttrs)
            value.draw(in: CGRect(x: margin + 110, y: y, width: valW, height: textH), withAttributes: valueAttrs)
            y += textH
        }
        return y + 4
    }

    @discardableResult
    private static func drawText(ctx: UIGraphicsPDFRendererContext, text: String, y: CGFloat) -> CGFloat {
        var y = y
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9.5),
            .foregroundColor: UIColor.label]
        let h = (text as NSString).boundingRect(
            with: CGSize(width: colW, height: 4000),
            options: .usesLineFragmentOrigin, attributes: attrs, context: nil).height + 2
        // If text won't fit, start a new page (or split — for now just start fresh if > half page)
        if y + h > pageH - 50 && h < pageH - 100 {
            ctx.beginPage()
            drawFooter(pageRect: CGRect(x: 0, y: 0, width: pageW, height: pageH))
            y = 32
        }
        text.draw(in: CGRect(x: margin, y: y, width: colW, height: h), withAttributes: attrs)
        return y + h + 6
    }

    @discardableResult
    private static func maybeNewPage(ctx: UIGraphicsPDFRendererContext, y: CGFloat, minSpace: CGFloat = 60) -> CGFloat {
        guard y > pageH - minSpace else { return y }
        ctx.beginPage()
        drawFooter(pageRect: CGRect(x: 0, y: 0, width: pageW, height: pageH))
        return 32
    }

    private static func drawFooter(pageRect: CGRect) {
        let text = "Generated \(DateFormatter.ectDateTime.string(from: .now)) ECT · Dr Dawit Daniel Kabiye MD DM · Amise Medical Services, Saint Lucia · CONFIDENTIAL — AI-assisted draft, clinician review required"
        text.draw(
            in: CGRect(x: margin, y: pageRect.height - 22, width: pageRect.width - margin * 2, height: 18),
            withAttributes: [.font: UIFont.systemFont(ofSize: 6.5), .foregroundColor: UIColor.secondaryLabel])
        UIColor.secondaryLabel.withAlphaComponent(0.2).setFill()
        UIRectFill(CGRect(x: margin, y: pageRect.height - 26, width: pageRect.width - margin * 2, height: 0.5))
    }
}
