// PreConsultQuestionnairePDF+History.swift
// PMH, surgical history, medications, allergies, family history,
// social history, concerns, footer, and PDF drawing primitives.

import UIKit


extension PreConsultQuestionnairePDF {

    // MARK: - Past medical history (§4)

    @discardableResult
    static func drawPMHSection(y: CGFloat) -> CGFloat {
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
    static func drawPSHxSection(y: CGFloat) -> CGFloat {
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
    static func drawMedicationsSection(y: CGFloat) -> CGFloat {
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
    static func drawAllergiesSection(y: CGFloat) -> CGFloat {
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
    static func drawFamilyHistorySection(y: CGFloat) -> CGFloat {
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
    static func drawSocialHistorySection(y: CGFloat) -> CGFloat {
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
    static func drawOtherSection(y: CGFloat) -> CGFloat {
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

    static func drawFooter(page: CGRect) {
        let footerY = page.height - 20
        let profile = PracticeProfile.current
        let footerText = PracticeProfile.join(
            [profile.practiceName, profile.country,
             "Administrative form — not a clinical record", "For appointment scheduling purposes only"],
            separator: "  ·  ")
        footerText.draw(
            in: CGRect(x: lm, y: footerY, width: usableW, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: UIColor.tertiaryLabel])
    }

    // MARK: - Drawing primitives

    static func drawCheckbox(label: String, x: CGFloat, y: CGFloat, maxW: CGFloat) {
        let box = CGRect(x: x, y: y, width: checkSz, height: checkSz)
        UIColor.lightGray.withAlphaComponent(0.5).setStroke()
        UIBezierPath(rect: box).stroke()

        label.draw(
            in: CGRect(x: x + checkSz + 4, y: y + 0.5, width: maxW - checkSz - 6, height: checkSz),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                             .foregroundColor: UIColor.darkText])
    }

    static func drawUnderline(x: CGFloat, y: CGFloat, w: CGFloat) {
        UIColor.lightGray.withAlphaComponent(0.6).setStroke()
        let path = UIBezierPath()
        path.move(to: CGPoint(x: x, y: y))
        path.addLine(to: CGPoint(x: x + w, y: y))
        path.lineWidth = 0.5
        path.stroke()
    }

    static func drawLabelLine(label: String, x: CGFloat, y: CGFloat, w: CGFloat) {
        label.draw(
            in: CGRect(x: x, y: y, width: w, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .medium),
                             .foregroundColor: UIColor.secondaryLabel])
        drawUnderline(x: x, y: y + lineH - 2, w: w)
    }

}
