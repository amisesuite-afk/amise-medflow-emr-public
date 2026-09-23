import UIKit

// MARK: - Pre-consultation patient questionnaire PDF
//
// Generates a blank A4 printable form the patient fills in before their visit.
// No clinical intelligence at generation time — deterministic, offline, HIPAA-safe.

enum PreConsultQuestionnairePDF {

    private static let teal   = UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 1)
    private static let pageW: CGFloat = 595
    private static let pageH: CGFloat = 842
    private static let lm: CGFloat = 36          // left margin
    private static let rm: CGFloat = 36          // right margin
    private static var usableW: CGFloat { pageW - lm - rm }
    private static let lineH: CGFloat = 18       // answer line height
    private static let checkSz: CGFloat = 11     // tick-box size
    private static let rowGap: CGFloat = 6       // gap between tick rows

    // MARK: - Public entry point

    /// Generates a blank questionnaire. When `patient` is non-nil the patient's name
    /// and DOB are pre-printed so staff don't have to re-enter them.
    static func generate(patientName: String? = nil,
                         patientDOB: String? = nil,
                         patientMRN: String? = nil) -> Data {
        let page     = CGRect(x: 0, y: 0, width: pageW, height: pageH)
        let renderer = UIGraphicsPDFRenderer(bounds: page)

        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = 0

            y = drawHeader(y: y, patientName: patientName, patientDOB: patientDOB, patientMRN: patientMRN)
            y = drawDisclaimer(y: y)
            y = drawSection(ctx: ctx, y: y, title: "1. PATIENT DETAILS", fn: { yy in
                drawDemographicsFields(y: yy)
            })
            y = drawSection(ctx: ctx, y: y, title: "2. REASON FOR TODAY'S VISIT", fn: { yy in
                drawCCSection(y: yy)
            })
            y = drawSection(ctx: ctx, y: y, title: "3. ASSOCIATED SYMPTOMS", fn: { yy in
                drawAssocSymptomsSection(y: yy)
            })
            y = drawSection(ctx: ctx, y: y, title: "4. PAST MEDICAL HISTORY", fn: { yy in
                drawPMHSection(y: yy)
            })

            // Page 2
            ctx.beginPage()
            y = 24

            y = drawSection(ctx: ctx, y: y, title: "5. PAST SURGICAL HISTORY", fn: { yy in
                drawPSHxSection(y: yy)
            })
            y = drawSection(ctx: ctx, y: y, title: "6. CURRENT MEDICATIONS", fn: { yy in
                drawMedicationsSection(y: yy)
            })
            y = drawSection(ctx: ctx, y: y, title: "7. ALLERGIES", fn: { yy in
                drawAllergiesSection(y: yy)
            })
            y = drawSection(ctx: ctx, y: y, title: "8. FAMILY HISTORY", fn: { yy in
                drawFamilyHistorySection(y: yy)
            })
            y = drawSection(ctx: ctx, y: y, title: "9. SOCIAL HISTORY", fn: { yy in
                drawSocialHistorySection(y: yy)
            })
            y = drawSection(ctx: ctx, y: y, title: "10. ANY OTHER CONCERNS?", fn: { yy in
                drawOtherSection(y: yy)
            })

            drawFooter(page: page)
        }
    }

    // MARK: - Header

    @discardableResult
    private static func drawHeader(y: CGFloat,
                                   patientName: String?,
                                   patientDOB: String?,
                                   patientMRN: String?) -> CGFloat {
        let h: CGFloat = 68
        teal.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: pageW, height: h))

        "Amise Medical Services".draw(
            in: CGRect(x: lm, y: 10, width: 260, height: 20),
            withAttributes: [.font: UIFont.systemFont(ofSize: 14, weight: .bold),
                             .foregroundColor: UIColor.white])

        "Dr Dawit Daniel Kabiye MD DM — General & Endoscopic Surgery".draw(
            in: CGRect(x: lm, y: 31, width: pageW - lm * 2, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.85)])

        "PRE-CONSULTATION QUESTIONNAIRE".draw(
            in: CGRect(x: lm, y: 47, width: 360, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.75)])

        // Pre-print patient details if available
        if let name = patientName, !name.isEmpty {
            let details = [name, patientMRN.map { "MRN: \($0)" }, patientDOB.map { "DOB: \($0)" }]
                .compactMap { $0 }
                .joined(separator: "  ·  ")
            details.draw(
                in: CGRect(x: pageW * 0.55, y: 16, width: pageW * 0.4, height: 36),
                withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                                 .foregroundColor: UIColor.white])
        }

        // Timestamp
        let ts = DateFormatter.ectDate.string(from: .now)
        ts.draw(in: CGRect(x: lm, y: h + 4, width: usableW, height: 11),
                withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                                 .foregroundColor: UIColor.secondaryLabel])

        return h + 16
    }

    // MARK: - Disclaimer banner

    @discardableResult
    private static func drawDisclaimer(y: CGFloat) -> CGFloat {
        let text = "⚠  This form is an administrative scheduling tool only and does not constitute a medical consultation, clinical advice, or diagnosis. All information collected is used solely to prepare for your appointment. If you are experiencing a medical emergency, please call 911/999 or go to your nearest Emergency Room immediately."
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 7.5, weight: .medium),
            .foregroundColor: UIColor(red: 0.50, green: 0.33, blue: 0.0, alpha: 1)
        ]
        let rect = CGRect(x: lm, y: y, width: usableW, height: 44)
        UIColor(red: 1.0, green: 0.95, blue: 0.80, alpha: 1).setFill()
        UIBezierPath(roundedRect: rect.insetBy(dx: -4, dy: -4), cornerRadius: 4).fill()
        text.draw(in: rect, withAttributes: attrs)
        return y + 52
    }

    // MARK: - Generic section wrapper

    @discardableResult
    private static func drawSection(ctx: UIGraphicsPDFRendererContext,
                                    y: CGFloat,
                                    title: String,
                                    fn: (CGFloat) -> CGFloat) -> CGFloat {
        // Estimate height by calling with a sentinel; we just layout linearly
        let headerH: CGFloat = 18
        teal.withAlphaComponent(0.12).setFill()
        // We will fill after knowing height — draw header bar first
        var yy = y
        UIColor.clear.setFill()

        // Section title bar
        teal.withAlphaComponent(0.15).setFill()
        UIRectFill(CGRect(x: lm - 4, y: yy, width: usableW + 8, height: headerH))
        title.draw(
            in: CGRect(x: lm, y: yy + 3, width: usableW, height: 13),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .bold),
                             .foregroundColor: teal])
        yy += headerH + 6

        yy = fn(yy)
        yy += 10

        // Page break if close to bottom
        if yy > pageH - 80 {
            ctx.beginPage()
            yy = 24
        }

        return yy
    }

    // MARK: - Demographics (§1)

    @discardableResult
    private static func drawDemographicsFields(y: CGFloat) -> CGFloat {
        var yy = y
        let fields: [(label: String, width: CGFloat)] = [
            ("Full name", usableW),
            ("Date of birth", usableW * 0.4),
            ("Sex assigned at birth", usableW * 0.4),
            ("Address", usableW),
            ("Phone", usableW * 0.45),
            ("Email", usableW * 0.5)
        ]

        var x = lm
        var lineInRow: CGFloat = 0
        for field in fields {
            if lineInRow + field.width > usableW + 1 {
                yy += lineH + 10
                x = lm
                lineInRow = 0
            }
            drawLabelLine(label: field.label, x: x, y: yy, w: field.width - 8)
            x += field.width
            lineInRow += field.width
        }
        return yy + lineH + 4
    }

    // MARK: - Chief complaint (§2)

    @discardableResult
    private static func drawCCSection(y: CGFloat) -> CGFloat {
        var yy = y
        let complaints: [(String, [String])] = [
            ("Abdominal / digestive", ["Abdominal pain", "Heartburn / reflux", "Nausea / vomiting",
                                       "Bloating", "Constipation", "Diarrhoea",
                                       "Blood in stool", "Haemorrhoids / anal pain"]),
            ("Lumps & bumps", ["Inguinal (groin) lump", "Abdominal wall lump / hernia",
                               "Neck lump", "Thyroid / goitre", "Breast lump",
                               "Skin lesion / growth"]),
            ("Liver, gallbladder & pancreas", ["Gallstones / biliary colic",
                                               "Jaundice (yellow skin/eyes)", "Pancreatitis"]),
            ("Endoscopy / screening", ["Bowel / colorectal screening", "Gastroscopy (OGD)",
                                       "ERCP / bile duct"]),
            ("Urological", ["Haematuria (blood in urine)", "Urinary symptoms"]),
            ("Weight & general", ["Unintentional weight loss", "Swallowing difficulty (dysphagia)",
                                  "Fatigue / anaemia", "Follow-up / post-operative review"]),
            ("Other", [""])
        ]

        "Please tick the main reason(s) for your visit today:".draw(
            in: CGRect(x: lm, y: yy, width: usableW, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .medium),
                             .foregroundColor: UIColor.darkText])
        yy += 14

        for (group, items) in complaints {
            group.uppercased().draw(
                in: CGRect(x: lm, y: yy, width: usableW, height: 11),
                withAttributes: [.font: UIFont.systemFont(ofSize: 7, weight: .semibold),
                                 .foregroundColor: UIColor.secondaryLabel])
            yy += 11

            var x = lm
            let colW = usableW / 2
            var col = 0
            for item in items {
                if item.isEmpty {
                    // "Other" free text line
                    drawLabelLine(label: "Other — please specify", x: lm, y: yy, w: usableW * 0.6)
                    yy += lineH + 4
                } else {
                    let row = col / 2
                    x = lm + CGFloat(col % 2) * colW
                    let rowY = yy + CGFloat(row) * (checkSz + rowGap)
                    drawCheckbox(label: item, x: x, y: rowY, maxW: colW - 6)
                    col += 1
                    if col % 2 == 0 { /* no extra advance — row calc handles it */ }
                }
            }
            let rows = ceil(Double(items.filter { !$0.isEmpty }.count) / 2.0)
            yy += CGFloat(rows) * (checkSz + rowGap) + 6
        }

        // Duration line
        "How long have you had this problem?".draw(
            in: CGRect(x: lm, y: yy, width: 220, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                             .foregroundColor: UIColor.darkText])
        drawUnderline(x: lm + 224, y: yy + 10, w: 140)
        yy += lineH

        // Severity
        "Current severity (circle):".draw(
            in: CGRect(x: lm, y: yy, width: 155, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                             .foregroundColor: UIColor.darkText])
        var sx = lm + 160
        for i in 0...10 {
            let s = "\(i)"
            let box = CGRect(x: sx, y: yy, width: 28, height: 14)
            UIColor.lightGray.withAlphaComponent(0.35).setStroke()
            UIBezierPath(roundedRect: box, cornerRadius: 3).stroke()
            s.draw(in: box.insetBy(dx: 4, dy: 1.5),
                   withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                                    .foregroundColor: UIColor.darkText])
            sx += 30
        }
        "0 = none   10 = worst".draw(
            in: CGRect(x: sx + 4, y: yy, width: 120, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: UIColor.secondaryLabel])
        yy += 20

        return yy
    }

    // MARK: - Associated symptoms (§3)

    @discardableResult
    private static func drawAssocSymptomsSection(y: CGFloat) -> CGFloat {
        var yy = y
        let symptoms = [
            "Fever / chills", "Night sweats", "Loss of appetite",
            "Weight loss", "Fatigue", "Jaundice (yellow)",
            "Shortness of breath", "Chest pain", "Palpitations",
            "Nausea", "Vomiting", "Heartburn",
            "Bloating / distension", "Change in bowel habit", "Dark / tarry stools",
            "Bright red rectal bleeding", "Pale / greasy stools", "Blood in urine",
            "Swallowing difficulty", "Regurgitation", "Itching (skin/eyes)",
            "Back / shoulder tip pain", "Leg swelling"
        ]
        "Please tick any additional symptoms you have noticed:".draw(
            in: CGRect(x: lm, y: yy, width: usableW, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .medium),
                             .foregroundColor: UIColor.darkText])
        yy += 13
        let colW = usableW / 3
        for (i, sym) in symptoms.enumerated() {
            let col = i % 3
            let row = i / 3
            let x = lm + CGFloat(col) * colW
            let ry = yy + CGFloat(row) * (checkSz + rowGap)
            drawCheckbox(label: sym, x: x, y: ry, maxW: colW - 4)
        }
        let rows = ceil(Double(symptoms.count) / 3.0)
        yy += CGFloat(rows) * (checkSz + rowGap) + 4
        drawLabelLine(label: "Other symptoms", x: lm, y: yy, w: usableW * 0.5)
        return yy + lineH + 2
    }

}
