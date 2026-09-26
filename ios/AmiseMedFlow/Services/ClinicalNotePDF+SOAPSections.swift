// ClinicalNotePDF+SOAPSections.swift
// SOAP, free-text, generic section block, visit history, footer, and snippet helpers.

import UIKit


extension ClinicalNotePDF {

    // MARK: - SOAP sections

    @discardableResult
    static func drawSOAP(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
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
    static func drawFreeText(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
                                      note: ClinicalNote, teal: UIColor) -> CGFloat {
        guard let text = note.freeText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return y }
        return drawSection(ctx: ctx, page: page, y: y, label: nil, body: text, teal: teal, mono: true)
    }

    // MARK: - Generic section block

    @discardableResult
    static func drawSection(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
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
    static func drawVisitHistory(ctx: UIGraphicsPDFRendererContext, page: CGRect, y: CGFloat,
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

    static func drawFooter(page: CGRect, note: ClinicalNote) {
        let footerY = page.height - 26
        UIColor.separator.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: 24, y: footerY - 5, width: page.width - 48, height: 0.5))

        let isDraft = note.status == .draft
        let suffix  = isDraft ? " · DRAFT — NOT VALID UNTIL SIGNED" : ""
        let profile = PracticeProfile.current
        let text    = "Generated \(DateFormatter.ectDateTime.string(from: .now)) ECT · \(profile.clinicianSignature) · \(profile.practiceNameWithCountry)\(suffix)"
        text.draw(
            in: CGRect(x: 24, y: footerY, width: page.width - 48, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: isDraft
                                 ? UIColor.systemOrange.withAlphaComponent(0.75)
                                 : UIColor.secondaryLabel])
    }

    // MARK: - Snippet helper

    static func noteSnippet(_ note: ClinicalNote) -> String {
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
            .first(where: { line in !line.isEmpty && !skip.contains(where: { line.hasPrefix($0) }) }) ?? ""
        return String(line.prefix(55))
    }

}
