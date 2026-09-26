// PatientSummaryPDF+DrawingHelpers.swift
// Low-level PDF drawing primitives for PatientSummaryPDF.

import UIKit
import SwiftUI


extension PatientSummaryPDF {

    // MARK: - Drawing helpers

    @discardableResult
    static func sectionTitle(_ title: String, y: CGFloat) -> CGFloat {
        title.uppercased().draw(
            in: CGRect(x: margin, y: y, width: colW, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .bold), .foregroundColor: teal])
        teal.withAlphaComponent(0.2).setFill()
        UIRectFill(CGRect(x: margin, y: y + 15, width: colW, height: 0.5))
        return y + 18
    }

    @discardableResult
    static func drawRows(ctx: UIGraphicsPDFRendererContext, rows: [(String, String)], y: CGFloat) -> CGFloat {
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
    static func drawText(ctx: UIGraphicsPDFRendererContext, text: String, y: CGFloat) -> CGFloat {
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
    static func maybeNewPage(ctx: UIGraphicsPDFRendererContext, y: CGFloat, minSpace: CGFloat = 60) -> CGFloat {
        guard y > pageH - minSpace else { return y }
        ctx.beginPage()
        drawFooter(pageRect: CGRect(x: 0, y: 0, width: pageW, height: pageH))
        return 32
    }

    static func drawFooter(pageRect: CGRect) {
        let profile = PracticeProfile.current
        let text = "Generated \(DateFormatter.ectDateTime.string(from: .now)) ECT · \(profile.clinicianSignature) · \(profile.practiceNameWithCountry) · CONFIDENTIAL — AI-assisted draft, clinician review required"
        text.draw(
            in: CGRect(x: margin, y: pageRect.height - 22, width: pageRect.width - margin * 2, height: 18),
            withAttributes: [.font: UIFont.systemFont(ofSize: 6.5), .foregroundColor: UIColor.secondaryLabel])
        UIColor.secondaryLabel.withAlphaComponent(0.2).setFill()
        UIRectFill(CGRect(x: margin, y: pageRect.height - 26, width: pageRect.width - margin * 2, height: 0.5))
    }

}
