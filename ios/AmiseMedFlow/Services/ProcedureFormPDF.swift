import UIKit

// MARK: - PDF generator for all procedure-form reports

enum ProcedureFormPDF {


    static let teal  = UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 1)
    static let page  = CGRect(x: 0, y: 0, width: 595, height: 842)
    static let lm: CGFloat = 32   // left margin
    static let rm: CGFloat = 32   // right margin
    static var bodyW: CGFloat { page.width - lm - rm }
    // MARK: - Shared drawing helpers

    static func drawHeader(type: String) -> CGFloat {
        let h: CGFloat = 88
        // Full-width teal bar
        teal.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: page.width, height: h))

        // LEFT — brand mark (e.g. "AMISE"; large, bold, tracked)
        PracticeLetterhead.drawBrandMark(at: CGPoint(x: lm, y: 8))

        // LEFT — practice name subtitle
        PracticeProfile.current.practiceName.draw(
            in: CGRect(x: lm, y: 34, width: 230, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.92)])

        // LEFT — surgeon + specialty
        PracticeProfile.current.clinicianLetterheadLine.draw(
            in: CGRect(x: lm, y: 50, width: 330, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.78)])

        // RIGHT — practice contact block
        let rightX = page.width - lm - 160
        PracticeLetterhead.drawContactBlock(x: rightX)

        // Separator line
        UIColor.white.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: 0, y: h - 20, width: page.width, height: 0.5))

        // Document type label on the separator baseline
        type.draw(
            in: CGRect(x: lm, y: h - 17, width: page.width - lm * 2, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.88),
                             .kern: 1.5])

        return h
    }

    @discardableResult
    static func drawSignatureBlock(ctx: UIGraphicsPDFRendererContext,
                                           surgeon: String, y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 110)
        y += 8
        y = drawSectionHeader(title: "Authorising Clinician", y: y)

        let df = DateFormatter()
        df.dateStyle = .long; df.timeStyle = .short

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

        // Signature line
        "Signature:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        teal.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: lm + 62, y: y + 10, width: 220, height: 0.5))
        y += 18

        // Name printed
        "Name:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        surgeon.draw(in: CGRect(x: lm + 62, y: y, width: 280, height: 13), withAttributes: nameAttrs)
        y += 16

        // Date signed
        "Date / Time:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        teal.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: lm + 62, y: y + 10, width: 220, height: 0.5))
        y += 18

        // AI disclaimer
        "This document was prepared with AI-assisted clinical software. The clinician's signature above confirms review and approval of the content.".draw(
            in: CGRect(x: lm, y: y, width: bodyW, height: 20),
            withAttributes: disclaimerAttrs)
        y += 18
        return y + 6
    }

    static func drawPatientStrip(patient: Patient, y: CGFloat) -> CGFloat {
        let h: CGFloat = 34
        teal.withAlphaComponent(0.1).setFill()
        UIRectFill(CGRect(x: 0, y: y, width: page.width, height: h))
        let dob = patient.dateOfBirth.map { DateFormatter.ectDate.string(from: $0) } ?? ""
        let parts = [patient.fullName,
                     "\(patient.sex.rawValue)\(patient.ageYears > 0 ? ", \(patient.ageYears)y" : "")",
                     dob, patient.mrn.map { "MRN \($0)" } ?? ""].filter { !$0.isEmpty }
        parts.joined(separator: "   ·   ").draw(
            in: CGRect(x: lm, y: y + 10, width: bodyW, height: 16),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9.5, weight: .medium), .foregroundColor: UIColor.label])
        return y + h + 4
    }

    static func drawMeta(date: Date, y: CGFloat) -> CGFloat {
        let str = DateFormatter.ectLong.string(from: date) + " ECT   ·   " + PracticeProfile.current.practiceNameWithCountry
        str.draw(in: CGRect(x: lm, y: y, width: bodyW, height: 13),
                 withAttributes: [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.secondaryLabel])
        let rule = y + 14
        teal.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: lm, y: rule, width: bodyW, height: 0.5))
        return rule + 10
    }

    static func drawRowSection(ctx: UIGraphicsPDFRendererContext, title: String,
                                       rows: [(String, String)], y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
        if !title.isEmpty { y = drawSectionHeader(title: title, y: y) }
        for (label, value) in rows where !value.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 18)
            label.draw(in: CGRect(x: lm, y: y, width: 140, height: 13),
                       withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                                        .foregroundColor: UIColor.secondaryLabel])
            let valRect = CGRect(x: lm + 148, y: y, width: bodyW - 148, height: 500)
            let valAttrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5), .foregroundColor: UIColor.label]
            let boundingRect = value.boundingRect(with: valRect.size, options: .usesLineFragmentOrigin, attributes: valAttrs, context: nil)
            let lineH = max(13, boundingRect.height + 2)
            value.draw(in: CGRect(x: lm + 148, y: y, width: bodyW - 148, height: lineH), withAttributes: valAttrs)
            y += lineH + 3
        }
        return y + 6
    }

    static func drawTextSection(ctx: UIGraphicsPDFRendererContext, title: String?,
                                        body: String, y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
        if let title { y = drawSectionHeader(title: title, y: y) }
        let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5), .foregroundColor: UIColor.label]
        let boundingH = body.boundingRect(with: CGSize(width: bodyW, height: 3000),
                                          options: .usesLineFragmentOrigin, attributes: attrs, context: nil).height
        let textH = ceil(boundingH) + 4
        if y + textH > page.height - 60 {
            ctx.beginPage(); y = 40
        }
        body.draw(in: CGRect(x: lm, y: y, width: bodyW, height: textH), withAttributes: attrs)
        return y + textH + 8
    }

    static func drawSectionHeader(title: String, y: CGFloat) -> CGFloat {
        teal.withAlphaComponent(0.08).setFill()
        UIRectFill(CGRect(x: lm - 4, y: y, width: bodyW + 8, height: 16))
        title.uppercased().draw(
            in: CGRect(x: lm, y: y + 2, width: bodyW, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .bold),
                             .foregroundColor: teal])
        return y + 20
    }


    static func drawFooter() {
        let profile = PracticeProfile.current
        let txt = PracticeProfile.join(
            [profile.practiceName, profile.clinicianSignature, profile.country, "Confidential clinical document"],
            separator: " · ")
        teal.withAlphaComponent(0.15).setFill()
        UIRectFill(CGRect(x: 0, y: page.height - 26, width: page.width, height: 26))
        txt.draw(in: CGRect(x: lm, y: page.height - 18, width: bodyW, height: 12),
                 withAttributes: [.font: UIFont.systemFont(ofSize: 6.5), .foregroundColor: UIColor.secondaryLabel])
    }


    static func maybeNewPage(ctx: UIGraphicsPDFRendererContext, y: CGFloat, minSpace: CGFloat = 60) -> CGFloat {
        if y > page.height - minSpace - 30 { ctx.beginPage(); return 40 }
        return y
    }


    static func findingLine(normal: Bool, findings: [String], notes: String) -> String {
        if normal { return "Normal" }
        var parts: [String] = findings.isEmpty ? [] : [findings.joined(separator: ", ")]
        if !notes.isEmpty { parts.append(notes) }
        return parts.isEmpty ? "Abnormal (no details)" : parts.joined(separator: " — ")
    }

}
