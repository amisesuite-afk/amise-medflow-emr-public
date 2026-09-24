import UIKit

// MARK: - Clinical Scores PDF export
// Generates an A4 report of every ScoreHistoryEntry saved for a patient,
// grouped by clinical category and sorted newest-first within each group.

enum ClinicalScoresPDF {

    static func generate(patient: Patient) -> Data {
        let page     = CGRect(x: 0, y: 0, width: 595, height: 842)
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let teal     = UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 1)

        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = 0

            y = drawHeader(page: page, y: y, patient: patient, teal: teal)
            y = drawPatientStrip(page: page, y: y, patient: patient, teal: teal)
            y = drawMeta(page: page, y: y, teal: teal)

            let grouped = groupedEntries(patient)

            if grouped.isEmpty {
                y = drawEmpty(page: page, y: y)
            } else {
                for (category, entries) in grouped {
                    if y > page.height - 80 { ctx.beginPage(); y = 40 }
                    y = drawCategorySection(ctx: ctx, page: page, y: y,
                                            category: category, entries: entries, teal: teal)
                }
            }

            drawFooter(page: page)
        }
    }

    // MARK: - Data grouping

    private static func groupedEntries(_ patient: Patient)
        -> [(category: ScoreCategory, entries: [ScoreHistoryEntry])]
    {
        let all = patient.scoreHistory.sorted { $0.recordedAt > $1.recordedAt }
        guard !all.isEmpty else { return [] }

        var buckets: [ScoreCategory: [ScoreHistoryEntry]] = [:]
        for entry in all {
            let cat = ActiveScore(rawValue: entry.scoreName)?.category ?? .monitoring
            buckets[cat, default: []].append(entry)
        }

        // Display in enum-declared order, skip empty buckets
        return ScoreCategory.allCases
            .compactMap { cat -> (ScoreCategory, [ScoreHistoryEntry])? in
                guard cat != .all, let entries = buckets[cat], !entries.isEmpty else { return nil }
                return (cat, entries)
            }
    }

    // MARK: - Header band

    @discardableResult
    private static func drawHeader(page: CGRect, y: CGFloat, patient: Patient, teal: UIColor) -> CGFloat {
        let h: CGFloat = 56
        teal.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: page.width, height: h))

        PracticeProfile.current.practiceName.draw(
            in: CGRect(x: 24, y: 10, width: page.width - 160, height: 22),
            withAttributes: [.font: UIFont.systemFont(ofSize: 16, weight: .bold),
                             .foregroundColor: UIColor.white])

        "CLINICAL SCORES REPORT".draw(
            in: CGRect(x: 24, y: 32, width: page.width - 160, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .medium),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.8)])

        // Score count badge
        let count   = patient.scoreHistory.count
        let badge   = count == 1 ? "1 SCORE" : "\(count) SCORES"
        let badgeRect = CGRect(x: page.width - 100, y: 18, width: 76, height: 20)
        teal.withAlphaComponent(0.55).setFill()
        UIBezierPath(roundedRect: badgeRect, cornerRadius: 4).fill()

        let bAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .bold),
            .foregroundColor: UIColor.white
        ]
        let bSize = (badge as NSString).size(withAttributes: bAttrs)
        badge.draw(at: CGPoint(x: badgeRect.midX - bSize.width / 2,
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

        let dob   = patient.dateOfBirth.map { DateFormatter.ectDate.string(from: $0) } ?? ""
        let parts = [
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

    // MARK: - Generated-at line

    @discardableResult
    private static func drawMeta(page: CGRect, y: CGFloat, teal: UIColor) -> CGFloat {
        "Generated: \(DateFormatter.ectLong.string(from: .now)) ECT   ·   \(PracticeProfile.current.clinicianSignature)".draw(
            in: CGRect(x: 24, y: y, width: page.width - 48, height: 13),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                             .foregroundColor: UIColor.secondaryLabel])

        let rule = y + 16
        teal.withAlphaComponent(0.3).setFill()
        UIRectFill(CGRect(x: 24, y: rule, width: page.width - 48, height: 0.5))
        return rule + 12
    }

    // MARK: - Category section

    @discardableResult
    private static func drawCategorySection(ctx: UIGraphicsPDFRendererContext,
                                             page: CGRect, y: CGFloat,
                                             category: ScoreCategory,
                                             entries: [ScoreHistoryEntry],
                                             teal: UIColor) -> CGFloat {
        var y = y

        // Category heading row
        teal.withAlphaComponent(0.08).setFill()
        UIRectFill(CGRect(x: 0, y: y, width: page.width, height: 18))

        category.rawValue.uppercased().draw(
            in: CGRect(x: 24, y: y + 3, width: page.width - 48, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                             .foregroundColor: teal])
        y += 20

        for (i, entry) in entries.enumerated() {
            if y > page.height - 52 { ctx.beginPage(); y = 40 }
            let bg: UIColor = i.isMultiple(of: 2)
                ? UIColor.systemFill.withAlphaComponent(0.18)
                : .clear
            bg.setFill()
            UIRectFill(CGRect(x: 24, y: y, width: page.width - 48, height: 20))

            y = drawScoreRow(page: page, y: y, entry: entry, teal: teal)
        }

        y += 6
        UIColor.separator.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: 24, y: y, width: page.width - 48, height: 0.5))
        y += 10

        return y
    }

    // MARK: - Single score row

    @discardableResult
    private static func drawScoreRow(page: CGRect, y: CGFloat,
                                      entry: ScoreHistoryEntry, teal: UIColor) -> CGFloat {
        let df = DateFormatter()
        df.locale   = Locale(identifier: "en_LC")
        df.timeZone = .ect
        df.dateFormat = "dd MMM yyyy  HH:mm"

        let maxW = page.width - 48
        let nameW: CGFloat = 210
        let valueW: CGFloat = 90
        let riskW: CGFloat = 110

        // Score name
        entry.scoreName.draw(
            in: CGRect(x: 24, y: y + 4, width: nameW, height: 13),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9.5, weight: .medium),
                             .foregroundColor: UIColor.label])

        // Value / max
        let scoreText = entry.maxScore > 0
            ? String(format: "%.4g / %.4g", entry.scoreValue, entry.maxScore)
            : String(format: "%.4g", entry.scoreValue)
        scoreText.draw(
            in: CGRect(x: 24 + nameW, y: y + 4, width: valueW, height: 13),
            withAttributes: [.font: UIFont.monospacedSystemFont(ofSize: 9, weight: .regular),
                             .foregroundColor: UIColor.secondaryLabel])

        // Risk level (colour-coded)
        let riskColor = riskUIColor(entry.riskRaw)
        let riskText  = entry.riskRaw.isEmpty ? "—" : entry.riskRaw.capitalized
        riskText.draw(
            in: CGRect(x: 24 + nameW + valueW, y: y + 4, width: riskW, height: 13),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                             .foregroundColor: riskColor])

        // Recorded timestamp
        let timeText = df.string(from: entry.recordedAt)
        timeText.draw(
            in: CGRect(x: 24 + nameW + valueW + riskW, y: y + 4, width: maxW - nameW - valueW - riskW, height: 13),
            withAttributes: [.font: UIFont.monospacedSystemFont(ofSize: 8, weight: .regular),
                             .foregroundColor: UIColor.tertiaryLabel])

        // Abbreviation chip below name
        if !entry.abbreviation.isEmpty {
            entry.abbreviation.draw(
                in: CGRect(x: 28, y: y + 14, width: nameW - 4, height: 10),
                withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .regular),
                                 .foregroundColor: UIColor.secondaryLabel])
        }

        return y + 20
    }

    // MARK: - Empty state

    @discardableResult
    private static func drawEmpty(page: CGRect, y: CGFloat) -> CGFloat {
        let msg = "No clinical scores recorded for this patient."
        msg.draw(
            in: CGRect(x: 24, y: y + 12, width: page.width - 48, height: 16),
            withAttributes: [.font: UIFont.systemFont(ofSize: 11),
                             .foregroundColor: UIColor.secondaryLabel])
        return y + 40
    }

    // MARK: - Footer

    private static func drawFooter(page: CGRect) {
        let footerY = page.height - 26
        UIColor.separator.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: 24, y: footerY - 5, width: page.width - 48, height: 0.5))

        let profile = PracticeProfile.current
        let text = "Generated \(DateFormatter.ectDateTime.string(from: .now)) ECT · \(profile.clinicianSignature) · \(profile.practiceNameWithCountry)"
        text.draw(
            in: CGRect(x: 24, y: footerY, width: page.width - 48, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: UIColor.secondaryLabel])
    }

    // MARK: - Risk colour helper

    private static func riskUIColor(_ rawValue: String) -> UIColor {
        switch rawValue.lowercased() {
        case "low":      return UIColor.systemGreen
        case "moderate": return UIColor.systemOrange
        case "high":     return UIColor(red: 0.9, green: 0.4, blue: 0.1, alpha: 1)
        case "critical", "very high": return UIColor.systemRed
        default:         return UIColor.secondaryLabel
        }
    }
}
