import UIKit

// MARK: - Patient-facing bowel preparation sheet (PDF)
//
// Practice letterhead from PracticeProfile (drawHeader), patient strip, the timetable and the
// standard sections. Marked DRAFT while the protocol wording awaits the surgeon's sign-off.

extension ProcedureFormPDF {

    static func bowelPrepInstructions(patient: Patient, sheet: BowelPrepPatientSheet) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "BOWEL PREPARATION INSTRUCTIONS")
            y = drawPatientStrip(patient: patient, y: y)

            if sheet.isDraft {
                let boxH: CGFloat = 32
                UIColor.systemRed.withAlphaComponent(0.10).setFill()
                UIRectFill(CGRect(x: lm - 6, y: y, width: bodyW + 12, height: boxH))
                BowelPrepText.draftNotice.draw(
                    in: CGRect(x: lm, y: y + 5, width: bodyW, height: boxH - 8),
                    withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .bold),
                                     .foregroundColor: UIColor.systemRed])
                y += boxH + 8
            }

            y = patientBody(ctx: ctx, text: sheet.intro, y: y)

            y = patientSection(ctx: ctx, title: "Your timetable", y: y)
            let whenAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 9.5, weight: .bold),
                .foregroundColor: teal,
            ]
            for row in sheet.rows {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
                "\(row.when)  ·  \(row.title)".draw(
                    in: CGRect(x: lm, y: y, width: bodyW, height: 14), withAttributes: whenAttrs)
                y += 15
                y = patientBody(ctx: ctx, text: row.text, y: y)
            }

            for block in sheet.blocks {
                y = patientSection(ctx: ctx, title: block.title, y: y)
                y = patientBody(ctx: ctx, text: block.body, y: y)
            }

            y = patientSection(ctx: ctx, title: "Contact", y: y)
            _ = patientBody(ctx: ctx, text: sheet.contact, y: y)

            drawFooter()
        }
    }
}
