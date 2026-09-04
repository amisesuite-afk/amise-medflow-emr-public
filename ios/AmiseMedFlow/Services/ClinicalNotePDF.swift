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

            if note.noteType.isStructured {
                y = drawSOAP(ctx: ctx, page: page, y: y, note: note, teal: teal)
            } else {
                y = drawFreeText(ctx: ctx, page: page, y: y, note: note, teal: teal)
            }

            y += 20
            if y > page.height - 180 { ctx.beginPage(); y = 40 }
            drawVisitHistory(ctx: ctx, page: page, y: y, patient: patient, currentId: note.id, teal: teal)

            drawFooter(page: page, note: note)
        }
    }

    // MARK: - Header

    @discardableResult
    private static func drawHeader(page: CGRect, y: CGFloat, note: ClinicalNote, teal: UIColor) -> CGFloat {
        let h: CGFloat = 56
        teal.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: page.width, height: h))

        "Amise Medical Services".draw(
            in: CGRect(x: 24, y: 10, width: page.width - 160, height: 22),
            withAttributes: [.font: UIFont.systemFont(ofSize: 16, weight: .bold),
                             .foregroundColor: UIColor.white])

        note.noteType.label.uppercased().draw(
            in: CGRect(x: 24, y: 32, width: page.width - 160, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .medium),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.8)])

        // Status badge
        let isDraft   = note.status == .draft
        let badgeText = isDraft ? "DRAFT" : "SIGNED"
        let badgeBg   = isDraft ? UIColor.systemOrange : UIColor(red: 0.18, green: 0.70, blue: 0.40, alpha: 1)
        let badgeRect = CGRect(x: page.width - 100, y: 18, width: 76, height: 20)
        badgeBg.setFill()
        UIBezierPath(roundedRect: badgeRect, cornerRadius: 4).fill()

        let bAttrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 9, weight: .bold),
                                                      .foregroundColor: UIColor.white]
        let bSize = (badgeText as NSString).size(withAttributes: bAttrs)
        badgeText.draw(at: CGPoint(x: badgeRect.midX - bSize.width / 2,
                                   y: badgeRect.midY - bSize.height / 2),
                       withAttributes: bAttrs)

        return h
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

    // MARK: - SOAP sections

    @discardableResult
    private static func drawSOAP(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
                                  note: ClinicalNote, teal: UIColor) -> CGFloat {
        var y = y
        let sections: [(String, String?)] = [
            ("Subjective", note.subjective),
            ("Objective",  note.objective),
            ("Assessment", note.assessment),
            ("Plan",       note.plan)
        ]
        for (label, text) in sections {
            guard let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            if y > page.height - 80 { ctx.beginPage(); y = 40 }
            y = drawSection(ctx: ctx, page: page, y: y, label: label, body: text, teal: teal, mono: false)
        }
        return y
    }

    // MARK: - Free-text note

    @discardableResult
    private static func drawFreeText(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
                                      note: ClinicalNote, teal: UIColor) -> CGFloat {
        guard let text = note.freeText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return y }
        return drawSection(ctx: ctx, page: page, y: y, label: nil, body: text, teal: teal, mono: true)
    }

    // MARK: - Generic section block

    @discardableResult
    private static func drawSection(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
                                    label: String?, body: String, teal: UIColor, mono: Bool) -> CGFloat {
        var y = y
        let maxW = page.width - 48

        if let label {
            label.uppercased().draw(
                in: CGRect(x: 24, y: y, width: maxW, height: 14),
                withAttributes: [.font: UIFont.systemFont(ofSize: 10, weight: .semibold),
                                 .foregroundColor: teal])
            teal.withAlphaComponent(0.2).setFill()
            UIRectFill(CGRect(x: 24, y: y + 15, width: maxW, height: 0.5))
            y += 19
        }

        let font: UIFont = mono ? .monospacedSystemFont(ofSize: 9, weight: .regular) : .systemFont(ofSize: 10)
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.label]
        let needed = ceil((body as NSString).boundingRect(
            with: CGSize(width: maxW, height: 10_000),
            options: .usesLineFragmentOrigin, attributes: attrs, context: nil
        ).height)

        if y + needed > page.height - 60 { ctx.beginPage(); y = 40 }
        body.draw(in: CGRect(x: 24, y: y, width: maxW, height: needed + 4), withAttributes: attrs)
        return y + needed + 14
    }

    // MARK: - Visit history timeline

    @discardableResult
    private static func drawVisitHistory(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
                                          patient: Patient, currentId: UUID, teal: UIColor) -> CGFloat {
        var y = y

        // Section heading
        "VISIT HISTORY".draw(
            in: CGRect(x: 24, y: y, width: page.width - 48, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 10, weight: .semibold),
                             .foregroundColor: teal])
        teal.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: 24, y: y + 15, width: page.width - 48, height: 0.5))
        y += 21

        let notes = patient.clinicalNotes
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(12)

        guard !notes.isEmpty else {
            "No previous notes on record.".draw(
                in: CGRect(x: 24, y: y, width: page.width - 48, height: 13),
                withAttributes: [.font: UIFont.systemFont(ofSize: 9),
                                 .foregroundColor: UIColor.secondaryLabel])
            return y + 13
        }

        let df = DateFormatter()
        df.locale     = Locale(identifier: "en_LC")
        df.timeZone   = .ect
        df.dateFormat = "dd MMM yyyy  HH:mm"

        for (i, n) in notes.enumerated() {
            if y > page.height - 50 { ctx.beginPage(); y = 40 }

            let isCurrent = n.id == currentId
            let bg: UIColor = isCurrent
                ? teal.withAlphaComponent(0.09)
                : (i.isMultiple(of: 2) ? UIColor.systemFill.withAlphaComponent(0.25) : .clear)
            bg.setFill()
            UIRectFill(CGRect(x: 24, y: y, width: page.width - 48, height: 17))

            // Date/time column
            df.string(from: n.createdAt).draw(
                in: CGRect(x: 28, y: y + 2, width: 128, height: 12),
                withAttributes: [.font: UIFont.monospacedSystemFont(ofSize: 8.5, weight: .regular),
                                 .foregroundColor: UIColor.secondaryLabel])

            // Note type column
            let typeLabel = isCurrent ? "\(n.noteType.label) ◀" : n.noteType.label
            typeLabel.draw(
                in: CGRect(x: 162, y: y + 2, width: 120, height: 12),
                withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: isCurrent ? .semibold : .medium),
                                 .foregroundColor: isCurrent ? teal : UIColor.label])

            // Status + preview column
            let status  = n.status == .draft ? "[Draft]" : "[Signed]"
            let snippet = noteSnippet(n)
            "\(status)  \(snippet)".draw(
                in: CGRect(x: 286, y: y + 2, width: page.width - 310, height: 12),
                withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                                 .foregroundColor: UIColor.secondaryLabel])

            y += 17
        }

        return y + 6
    }

    // MARK: - Footer

    private static func drawFooter(page: CGRect, note: ClinicalNote) {
        let footerY = page.height - 26
        UIColor.separator.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: 24, y: footerY - 5, width: page.width - 48, height: 0.5))

        let isDraft = note.status == .draft
        let suffix  = isDraft ? " · DRAFT — NOT VALID UNTIL SIGNED" : ""
        let text    = "Generated \(DateFormatter.ectDateTime.string(from: .now)) ECT · Dr Dawit Daniel Kabiye MD DM · Amise Medical Services, Saint Lucia\(suffix)"
        text.draw(
            in: CGRect(x: 24, y: footerY, width: page.width - 48, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: isDraft
                                 ? UIColor.systemOrange.withAlphaComponent(0.75)
                                 : UIColor.secondaryLabel])
    }

    // MARK: - Snippet helper

    private static func noteSnippet(_ note: ClinicalNote) -> String {
        if note.noteType.isStructured {
            let text = [note.assessment, note.plan, note.subjective]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty }) ?? ""
            return String(text.prefix(55))
        }
        let skip = ["OPERATIVE NOTE", "ENDOSCOPY REPORT", "DISCHARGE SUMMARY", "CONSULTATION NOTE"]
        let line = (note.freeText ?? "")
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first(where: { !$0.isEmpty && !skip.contains(where: { $0.hasPrefix($0) }) }) ?? ""
        return String(line.prefix(55))
    }
}
