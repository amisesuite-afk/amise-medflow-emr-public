import UIKit

// MARK: - Consultation Report PDF
// Blue/navy/red Amise brand — matches the HTML consultation report template.

extension ProcedureFormPDF {

    // ── Consultation palette ─────────────────────────────────────────────────
    static let cBlue   = UIColor(red: 0.114, green: 0.306, blue: 0.847, alpha: 1) // #1d4ed8
    static let cNavy   = UIColor(red: 0.118, green: 0.227, blue: 0.541, alpha: 1) // #1e3a8a
    static let cRed    = UIColor(red: 0.769, green: 0.118, blue: 0.118, alpha: 1) // #c41e1e

    // MARK: - Entry point

    static func consultationReport(patient: Patient, date: Date = .now) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = drawConsultHeader()
            y = drawConsultPatientStrip(patient: patient, y: y)
            y = drawConsultMeta(date: date, y: y)

            if let cc = patient.chiefComplaint, !cc.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "Presenting Complaint", body: cc, y: y)
            }
            if let hpi = patient.hpi, !hpi.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "History of Presenting Illness", body: hpi, y: y)
            }

            y = drawConsultTextSection(ctx: ctx, title: "Allergies",
                                       body: consultAllergyString(patient: patient), y: y)

            let rxs = patient.prescriptions
            if !rxs.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "Current Medications",
                                           body: rxs.map { "• \($0.displayLine)" }.joined(separator: "\n"), y: y)
            }

            if let pmh = patient.pmhNotes, !pmh.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "Past Medical History", body: pmh, y: y)
            }
            if let pshx = patient.surgicalHistory, !pshx.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "Past Surgical History", body: pshx, y: y)
            }
            if let fh = patient.familyHistoryNotes, !fh.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "Family History", body: fh, y: y)
            }
            if let sh = patient.socialHistory, !sh.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "Social History", body: sh, y: y)
            }

            let examLines = [
                patient.examGeneral.map { "General: \($0)" },
                patient.examCVS.map    { "CVS: \($0)" },
                patient.examResp.map   { "Respiratory: \($0)" },
                patient.examAbdo.map   { "Abdomen: \($0)" },
                patient.examNeuro.map  { "Neurology: \($0)" },
                patient.examMSK.map    { "MSK: \($0)" },
            ].compactMap { $0 }
            if !examLines.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "Examination Findings",
                                           body: examLines.joined(separator: "\n"), y: y)
            }

            let invs = patient.investigations.filter { $0.status != .suggested }
            if !invs.isEmpty {
                let rows: [(String, String)] = invs.map { ($0.name, $0.result.isEmpty ? "Pending" : $0.result) }
                y = drawConsultRowSection(ctx: ctx, title: "Investigations", rows: rows, y: y)
            }

            if let dx = patient.workingDiagnosis, !dx.isEmpty {
                let icd = patient.workingDiagnosisICD.map { " (\($0))" } ?? ""
                y = drawConsultTextSection(ctx: ctx, title: "Working Diagnosis", body: "\(dx)\(icd)", y: y)
            }
            if let plan = patient.managementPlan, !plan.isEmpty {
                y = drawConsultTextSection(ctx: ctx, title: "Management Plan", body: plan, y: y)
            }

            _ = drawConsultSignatureBlock(ctx: ctx,
                                          surgeon: PracticeProfile.current.clinicianLetterheadName, y: y)
            drawConsultFooter()
        }
    }

    // MARK: - Header

    static func drawConsultHeader() -> CGFloat {
        let h: CGFloat = 88
        // Navy left band, red right band — matches the HTML gradient
        cNavy.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: page.width * 0.62, height: h))
        cRed.setFill()
        UIRectFill(CGRect(x: page.width * 0.62, y: 0, width: page.width * 0.38, height: h))

        PracticeLetterhead.drawBrandMark(at: CGPoint(x: lm, y: 8))

        PracticeProfile.current.brandTagline.draw(
            in: CGRect(x: lm, y: 34, width: 290, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.88)])

        PracticeProfile.current.clinicianLetterheadLine.draw(
            in: CGRect(x: lm, y: 48, width: 330, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.78)])

        let rightX = page.width - lm - 160
        PracticeLetterhead.drawContactBlock(x: rightX)

        UIColor.white.withAlphaComponent(0.15).setFill()
        UIRectFill(CGRect(x: 0, y: h - 20, width: page.width, height: 20))
        "CONSULTATION REPORT".draw(
            in: CGRect(x: lm, y: h - 16, width: page.width - lm * 2, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.92),
                             .kern: 2.0])
        return h
    }

    // MARK: - Patient strip

    static func drawConsultPatientStrip(patient: Patient, y: CGFloat) -> CGFloat {
        let h: CGFloat = 34
        cBlue.withAlphaComponent(0.08).setFill()
        UIRectFill(CGRect(x: 0, y: y, width: page.width, height: h))
        let dob = patient.dateOfBirth.map { DateFormatter.ectDate.string(from: $0) } ?? ""
        let parts = [patient.fullName,
                     "\(patient.sex.rawValue)\(patient.ageYears > 0 ? ", \(patient.ageYears)y" : "")",
                     dob,
                     patient.mrn.map { "MRN \($0)" } ?? ""].filter { !$0.isEmpty }
        parts.joined(separator: "   ·   ").draw(
            in: CGRect(x: lm, y: y + 10, width: bodyW, height: 16),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9.5, weight: .medium),
                             .foregroundColor: UIColor.label])
        return y + h + 4
    }

    // MARK: - Meta line

    static func drawConsultMeta(date: Date, y: CGFloat) -> CGFloat {
        let str = DateFormatter.ectLong.string(from: date) + " ECT   ·   " + PracticeProfile.current.practiceNameWithCountry
        str.draw(in: CGRect(x: lm, y: y, width: bodyW, height: 13),
                 withAttributes: [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.secondaryLabel])
        let rule = y + 14
        cBlue.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: lm, y: rule, width: bodyW, height: 0.5))
        return rule + 10
    }

    // MARK: - Section header (blue accent)

    static func drawConsultSectionHeader(title: String, y: CGFloat) -> CGFloat {
        cBlue.withAlphaComponent(0.08).setFill()
        UIRectFill(CGRect(x: lm - 4, y: y, width: bodyW + 8, height: 16))
        title.uppercased().draw(
            in: CGRect(x: lm, y: y + 2, width: bodyW, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .bold),
                             .foregroundColor: cBlue])
        return y + 20
    }

    // MARK: - Text section

    static func drawConsultTextSection(ctx: UIGraphicsPDFRendererContext,
                                       title: String, body: String, y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
        y = drawConsultSectionHeader(title: title, y: y)
        let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5),
                                                     .foregroundColor: UIColor.label]
        let boundingH = body.boundingRect(with: CGSize(width: bodyW, height: 3000),
                                          options: .usesLineFragmentOrigin,
                                          attributes: attrs, context: nil).height
        let textH = ceil(boundingH) + 4
        if y + textH > page.height - 60 { ctx.beginPage(); y = 40 }
        body.draw(in: CGRect(x: lm, y: y, width: bodyW, height: textH), withAttributes: attrs)
        return y + textH + 8
    }

    // MARK: - Row section

    static func drawConsultRowSection(ctx: UIGraphicsPDFRendererContext,
                                      title: String, rows: [(String, String)], y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
        if !title.isEmpty { y = drawConsultSectionHeader(title: title, y: y) }
        for (label, value) in rows where !value.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 18)
            label.draw(in: CGRect(x: lm, y: y, width: 140, height: 13),
                       withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                                        .foregroundColor: UIColor.secondaryLabel])
            let valAttrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5),
                                                            .foregroundColor: UIColor.label]
            let bounding = value.boundingRect(with: CGSize(width: bodyW - 148, height: 500),
                                              options: .usesLineFragmentOrigin,
                                              attributes: valAttrs, context: nil)
            let lineH = max(13, bounding.height + 2)
            value.draw(in: CGRect(x: lm + 148, y: y, width: bodyW - 148, height: lineH),
                       withAttributes: valAttrs)
            y += lineH + 3
        }
        return y + 6
    }

    // MARK: - Signature block

    static func drawConsultSignatureBlock(ctx: UIGraphicsPDFRendererContext,
                                          surgeon: String, y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 110)
        y += 8
        y = drawConsultSectionHeader(title: "Authorising Clinician", y: y)

        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8, weight: .semibold),
            .foregroundColor: UIColor.secondaryLabel,
        ]
        let nameAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9),
            .foregroundColor: UIColor.label,
        ]
        let disclaimerAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.italicSystemFont(ofSize: 6.5),
            .foregroundColor: UIColor.tertiaryLabel,
        ]

        "Signature:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        cBlue.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: lm + 62, y: y + 10, width: 220, height: 0.5))
        y += 18

        "Name:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        surgeon.draw(in: CGRect(x: lm + 62, y: y, width: 280, height: 13), withAttributes: nameAttrs)
        y += 16

        "Date / Time:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        cBlue.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: lm + 62, y: y + 10, width: 220, height: 0.5))
        y += 18

        "This document was prepared with AI-assisted clinical software. The clinician's signature above confirms review and approval of the content.".draw(
            in: CGRect(x: lm, y: y, width: bodyW, height: 20),
            withAttributes: disclaimerAttrs)
        return y + 24
    }

    // MARK: - Footer

    static func drawConsultFooter() {
        let profile = PracticeProfile.current
        let txt = PracticeProfile.join(
            [profile.practiceName, profile.clinicianSignature, profile.country, "Confidential clinical document"],
            separator: " · ")
        cNavy.setFill()
        UIRectFill(CGRect(x: 0, y: page.height - 26, width: page.width, height: 26))
        txt.draw(in: CGRect(x: lm, y: page.height - 18, width: bodyW, height: 12),
                 withAttributes: [.font: UIFont.systemFont(ofSize: 6.5),
                                  .foregroundColor: UIColor.white.withAlphaComponent(0.85)])
    }

    // MARK: - Allergy helper

    static func consultAllergyString(patient: Patient) -> String {
        let list = patient.allergies
        guard !list.isEmpty else { return "No known drug allergies (NKDA)" }
        return list.map {
            "• \($0.name) [\($0.severity)]\($0.reaction.isEmpty ? "" : " — \($0.reaction)")"
        }.joined(separator: "\n")
    }
}
