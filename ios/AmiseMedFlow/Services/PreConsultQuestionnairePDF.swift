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

    // MARK: - Past medical history (§4)

    @discardableResult
    private static func drawPMHSection(y: CGFloat) -> CGFloat {
        var yy = y
        let conditions = [
            "Hypertension", "Diabetes (Type 1 or 2)", "Heart disease / angina",
            "Stroke / TIA", "Asthma / COPD", "Kidney disease",
            "Liver disease / hepatitis", "Thyroid condition", "Cancer (current or past)",
            "HIV / immunocompromised", "Clotting / bleeding disorder", "Inflammatory bowel disease",
            "Acid reflux / GORD", "Anaemia", "Osteoporosis"
        ]
        let colW = usableW / 3
        for (i, cond) in conditions.enumerated() {
            let col = i % 3
            let row = i / 3
            let x = lm + CGFloat(col) * colW
            let ry = yy + CGFloat(row) * (checkSz + rowGap)
            drawCheckbox(label: cond, x: x, y: ry, maxW: colW - 4)
        }
        let rows = ceil(Double(conditions.count) / 3.0)
        yy += CGFloat(rows) * (checkSz + rowGap) + 4
        drawLabelLine(label: "Other medical conditions", x: lm, y: yy, w: usableW * 0.55)
        return yy + lineH + 2
    }

    // MARK: - Past surgical history (§5)

    @discardableResult
    private static func drawPSHxSection(y: CGFloat) -> CGFloat {
        var yy = y
        "Please list any operations or procedures you have had:".draw(
            in: CGRect(x: lm, y: yy, width: usableW, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .medium),
                             .foregroundColor: UIColor.darkText])
        yy += 13
        let cols: [(label: String, w: CGFloat)] = [("Operation / procedure", 0.5), ("Approximate year", 0.25), ("Any complications?", 0.25)]
        var x = lm
        for col in cols {
            col.label.draw(in: CGRect(x: x, y: yy, width: usableW * col.w - 6, height: 10),
                           withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                                            .foregroundColor: UIColor.secondaryLabel])
            x += usableW * col.w
        }
        yy += 11
        for _ in 0..<5 {
            x = lm
            for col in cols {
                drawUnderline(x: x, y: yy + lineH - 2, w: usableW * col.w - 8)
                x += usableW * col.w
            }
            yy += lineH + 4
        }
        return yy
    }

    // MARK: - Medications (§6)

    @discardableResult
    private static func drawMedicationsSection(y: CGFloat) -> CGFloat {
        var yy = y
        "Please list all current medications (including vitamins, supplements, and herbal remedies):".draw(
            in: CGRect(x: lm, y: yy, width: usableW, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .medium),
                             .foregroundColor: UIColor.darkText])
        yy += 13
        let cols: [(label: String, w: CGFloat)] = [("Medication name", 0.38), ("Dose", 0.20), ("Frequency", 0.22), ("How long?", 0.20)]
        var x = lm
        for col in cols {
            col.label.draw(in: CGRect(x: x, y: yy, width: usableW * col.w - 4, height: 10),
                           withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                                            .foregroundColor: UIColor.secondaryLabel])
            x += usableW * col.w
        }
        yy += 11
        for _ in 0..<6 {
            x = lm
            for col in cols {
                drawUnderline(x: x, y: yy + lineH - 2, w: usableW * col.w - 6)
                x += usableW * col.w
            }
            yy += lineH + 4
        }
        return yy
    }

    // MARK: - Allergies (§7)

    @discardableResult
    private static func drawAllergiesSection(y: CGFloat) -> CGFloat {
        var yy = y
        drawCheckbox(label: "No known allergies (NKDA)", x: lm, y: yy, maxW: 220)
        yy += checkSz + rowGap + 4
        "If you have allergies, please list them:".draw(
            in: CGRect(x: lm, y: yy, width: usableW, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                             .foregroundColor: UIColor.darkText])
        yy += 13
        let cols: [(label: String, w: CGFloat)] = [("Medication / substance", 0.40), ("Reaction", 0.38), ("Severity", 0.22)]
        var x = lm
        for col in cols {
            col.label.draw(in: CGRect(x: x, y: yy, width: usableW * col.w - 4, height: 10),
                           withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                                            .foregroundColor: UIColor.secondaryLabel])
            x += usableW * col.w
        }
        yy += 11
        for _ in 0..<4 {
            x = lm
            for col in cols {
                drawUnderline(x: x, y: yy + lineH - 2, w: usableW * col.w - 6)
                x += usableW * col.w
            }
            yy += lineH + 4
        }
        return yy
    }

    // MARK: - Family history (§8)

    @discardableResult
    private static func drawFamilyHistorySection(y: CGFloat) -> CGFloat {
        var yy = y
        let conditions = [
            "Bowel / colorectal cancer", "Stomach cancer", "Oesophageal cancer",
            "Pancreatic cancer", "Breast cancer", "Gallstones",
            "Hernia", "Inflammatory bowel disease", "Diabetes",
            "Heart disease", "Thyroid condition", "Bleeding / clotting disorder"
        ]
        let colW = usableW / 3
        for (i, cond) in conditions.enumerated() {
            let col = i % 3
            let row = i / 3
            let x = lm + CGFloat(col) * colW
            let ry = yy + CGFloat(row) * (checkSz + rowGap)
            drawCheckbox(label: cond, x: x, y: ry, maxW: colW - 4)
        }
        let rows = ceil(Double(conditions.count) / 3.0)
        yy += CGFloat(rows) * (checkSz + rowGap) + 4
        drawLabelLine(label: "Other (specify and relationship)", x: lm, y: yy, w: usableW * 0.6)
        return yy + lineH + 2
    }

    // MARK: - Social history (§9)

    @discardableResult
    private static func drawSocialHistorySection(y: CGFloat) -> CGFloat {
        var yy = y

        // Smoking
        "Smoking:".draw(in: CGRect(x: lm, y: yy, width: 60, height: 11),
                        withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .medium),
                                         .foregroundColor: UIColor.darkText])
        let smokeOpts = ["Never", "Ex-smoker", "Current smoker"]
        var sx = lm + 64
        for opt in smokeOpts {
            drawCheckbox(label: opt, x: sx, y: yy, maxW: 100)
            sx += 108
        }
        drawLabelLine(label: "Pack-years / quit year", x: sx + 4, y: yy, w: 120)
        yy += checkSz + rowGap + 6

        // Alcohol
        "Alcohol:".draw(in: CGRect(x: lm, y: yy, width: 60, height: 11),
                        withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .medium),
                                         .foregroundColor: UIColor.darkText])
        let alcOpts = ["None", "Occasional", "Moderate", "Heavy"]
        sx = lm + 64
        for opt in alcOpts {
            drawCheckbox(label: opt, x: sx, y: yy, maxW: 80)
            sx += 86
        }
        yy += checkSz + rowGap + 6

        // Occupation / exercise
        drawLabelLine(label: "Occupation", x: lm, y: yy, w: usableW * 0.35)
        drawLabelLine(label: "Exercise level", x: lm + usableW * 0.38, y: yy, w: usableW * 0.28)
        drawLabelLine(label: "Lives alone?  Y / N", x: lm + usableW * 0.7, y: yy, w: usableW * 0.28)
        yy += lineH + 2

        return yy
    }

    // MARK: - Any other concerns (§10)

    @discardableResult
    private static func drawOtherSection(y: CGFloat) -> CGFloat {
        var yy = y
        "Is there anything else you would like the doctor to know?".draw(
            in: CGRect(x: lm, y: yy, width: usableW, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .medium),
                             .foregroundColor: UIColor.darkText])
        yy += 13
        for _ in 0..<3 {
            drawUnderline(x: lm, y: yy + lineH - 2, w: usableW)
            yy += lineH + 4
        }

        // Consent and signature
        yy += 6
        UIColor.lightGray.withAlphaComponent(0.4).setStroke()
        let sepPath = UIBezierPath()
        sepPath.move(to: CGPoint(x: lm, y: yy))
        sepPath.addLine(to: CGPoint(x: pageW - rm, y: yy))
        sepPath.lineWidth = 0.5
        sepPath.stroke()
        yy += 6

        "By submitting this form I confirm that the information provided is accurate to the best of my knowledge. I understand this form is for administrative scheduling purposes only and does not constitute medical advice or a clinical consultation.".draw(
            in: CGRect(x: lm, y: yy, width: usableW, height: 28),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .light),
                             .foregroundColor: UIColor.secondaryLabel])
        yy += 32

        drawLabelLine(label: "Patient signature", x: lm, y: yy, w: usableW * 0.42)
        drawLabelLine(label: "Date", x: lm + usableW * 0.46, y: yy, w: usableW * 0.25)
        yy += lineH + 4

        return yy
    }

    // MARK: - Footer

    private static func drawFooter(page: CGRect) {
        let footerY = page.height - 20
        let footerText = "Amise Medical Services  ·  Saint Lucia  ·  Administrative form — not a clinical record  ·  For appointment scheduling purposes only"
        footerText.draw(
            in: CGRect(x: lm, y: footerY, width: usableW, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: UIColor.tertiaryLabel])
    }

    // MARK: - Drawing primitives

    private static func drawCheckbox(label: String, x: CGFloat, y: CGFloat, maxW: CGFloat) {
        let box = CGRect(x: x, y: y, width: checkSz, height: checkSz)
        UIColor.lightGray.withAlphaComponent(0.5).setStroke()
        UIBezierPath(rect: box).stroke()

        label.draw(
            in: CGRect(x: x + checkSz + 4, y: y + 0.5, width: maxW - checkSz - 6, height: checkSz),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                             .foregroundColor: UIColor.darkText])
    }

    private static func drawUnderline(x: CGFloat, y: CGFloat, w: CGFloat) {
        UIColor.lightGray.withAlphaComponent(0.6).setStroke()
        let path = UIBezierPath()
        path.move(to: CGPoint(x: x, y: y))
        path.addLine(to: CGPoint(x: x + w, y: y))
        path.lineWidth = 0.5
        path.stroke()
    }

    private static func drawLabelLine(label: String, x: CGFloat, y: CGFloat, w: CGFloat) {
        label.draw(
            in: CGRect(x: x, y: y, width: w, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .medium),
                             .foregroundColor: UIColor.secondaryLabel])
        drawUnderline(x: x, y: y + lineH - 2, w: w)
    }
}
