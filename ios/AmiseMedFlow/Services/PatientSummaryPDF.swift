import UIKit
import SwiftUI

// MARK: - Patient summary PDF generator

enum PatientSummaryPDF {

    static func generate(for patient: Patient) -> Data {
        let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842) // A4
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = 40

            // Header bar
            let headerRect = CGRect(x: 0, y: 0, width: pageRect.width, height: 56)
            UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 1).setFill()
            UIRectFill(headerRect)

            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 18, weight: .bold),
                .foregroundColor: UIColor.white
            ]
            "Amise Medical Services — Patient Summary".draw(
                in: CGRect(x: 24, y: 16, width: pageRect.width - 48, height: 28),
                withAttributes: titleAttrs
            )

            y = 72

            // Patient demographics block
            let demoLines: [(String, String)] = [
                ("Patient", patient.fullName),
                ("DOB", patient.dateOfBirth.map { DateFormatter.localizedString(from: $0, dateStyle: .medium, timeStyle: .none) } ?? "—"),
                ("Age", "\(patient.ageYears) years"),
                ("Sex", patient.sex.rawValue),
                ("MRN", patient.mrn ?? "—"),
                ("Phone", patient.phone ?? "—"),
                ("Setting", "\(patient.setting.rawValue) · \(patient.location.rawValue)"),
            ]
            y = drawSection(ctx: ctx, pageRect: pageRect, y: y, title: "Demographics", rows: demoLines)

            // Diagnosis
            if let dx = patient.workingDiagnosis {
                let dxLines: [(String, String)] = [
                    ("Diagnosis", dx + (patient.workingDiagnosisICD.map { " (\($0))" } ?? "")),
                    ("Chief complaint", patient.chiefComplaint ?? "—"),
                ]
                y = drawSection(ctx: ctx, pageRect: pageRect, y: y, title: "Diagnosis", rows: dxLines)
            }

            // Vitals
            if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
                var vlines: [(String, String)] = [("NEWS2", "\(v.news2Score) — \(v.news2Risk)")]
                if let bp = v.bpString { vlines.append(("BP", "\(bp) mmHg")) }
                if let hr = v.heartRate { vlines.append(("Heart rate", "\(hr) bpm")) }
                if let t = v.temperatureCelsius { vlines.append(("Temperature", String(format: "%.1f°C", t))) }
                if let spo = v.spo2 { vlines.append(("SpO₂", "\(spo)%")) }
                if let wt = v.weightKg { vlines.append(("Weight", String(format: "%.1f kg", wt))) }
                y = drawSection(ctx: ctx, pageRect: pageRect, y: y, title: "Latest Vitals", rows: vlines)
            }

            // Allergies
            let allergies = patient.allergies
            if !allergies.isEmpty {
                let aLines = allergies.map { ("⚠ \($0.name)", "\($0.reaction) — \($0.severity)") }
                y = drawSection(ctx: ctx, pageRect: pageRect, y: y, title: "Allergies", rows: aLines)
            }

            // Medications
            let rxs = patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }
            if !rxs.isEmpty {
                let mLines = rxs.map { ("\($0.drug)", "\($0.displayLine)") }
                y = drawSection(ctx: ctx, pageRect: pageRect, y: y, title: "Medications", rows: mLines)
            }

            // PMH
            if let pmh = patient.pmhNotes, !pmh.isEmpty {
                y = drawTextSection(ctx: ctx, pageRect: pageRect, y: y, title: "Past Medical History", text: pmh)
            }

            // New page if needed
            if y > pageRect.height - 120 {
                ctx.beginPage()
                y = 40
            }

            // Assessment & Plan
            if let assessment = patient.assessmentText, !assessment.isEmpty {
                y = drawTextSection(ctx: ctx, pageRect: pageRect, y: y, title: "Assessment", text: assessment)
            }
            if let plan = patient.managementPlan, !plan.isEmpty {
                y = drawTextSection(ctx: ctx, pageRect: pageRect, y: y, title: "Management Plan", text: plan)
            }

            // Footer
            let footerY = pageRect.height - 30
            let footerText = "Generated \(DateFormatter.localizedString(from: .now, dateStyle: .medium, timeStyle: .short)) · Dr Dawit Daniel Kabiye MD DM · Amise Medical Services, Saint Lucia · [AI DRAFT — REVIEW BEFORE USE]"
            let footerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 7),
                .foregroundColor: UIColor.secondaryLabel
            ]
            footerText.draw(in: CGRect(x: 24, y: footerY, width: pageRect.width - 48, height: 20), withAttributes: footerAttrs)
        }
    }

    // MARK: - Drawing helpers

    @discardableResult
    private static func drawSection(ctx: UIGraphicsPDFRendererContext,
                                    pageRect: CGRect, y: CGFloat,
                                    title: String, rows: [(String, String)]) -> CGFloat {
        var y = y + 10
        y = drawSectionTitle(y: y, title: title, pageRect: pageRect)
        for (label, value) in rows {
            if y > pageRect.height - 60 { ctx.beginPage(); y = 40 }
            y = drawRow(y: y, label: label, value: value, pageRect: pageRect)
        }
        return y + 4
    }

    @discardableResult
    private static func drawTextSection(ctx: UIGraphicsPDFRendererContext,
                                        pageRect: CGRect, y: CGFloat,
                                        title: String, text: String) -> CGFloat {
        var y = y + 10
        y = drawSectionTitle(y: y, title: title, pageRect: pageRect)

        let bodyAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 10),
            .foregroundColor: UIColor.label
        ]
        let maxWidth = pageRect.width - 48
        let bounded = CGSize(width: maxWidth, height: 10000)
        let textSize = (text as NSString).boundingRect(with: bounded, options: .usesLineFragmentOrigin, attributes: bodyAttrs, context: nil)
        if y + textSize.height > pageRect.height - 60 { ctx.beginPage(); y = 40 }
        text.draw(in: CGRect(x: 24, y: y, width: maxWidth, height: textSize.height), withAttributes: bodyAttrs)
        return y + textSize.height + 4
    }

    private static func drawSectionTitle(y: CGFloat, title: String, pageRect: CGRect) -> CGFloat {
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 11, weight: .semibold),
            .foregroundColor: UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 1)
        ]
        title.uppercased().draw(in: CGRect(x: 24, y: y, width: pageRect.width - 48, height: 16), withAttributes: attrs)
        UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 0.25).setFill()
        UIRectFill(CGRect(x: 24, y: y + 18, width: pageRect.width - 48, height: 0.5))
        return y + 22
    }

    private static func drawRow(y: CGFloat, label: String, value: String, pageRect: CGRect) -> CGFloat {
        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 10, weight: .medium),
            .foregroundColor: UIColor.secondaryLabel
        ]
        let valueAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 10),
            .foregroundColor: UIColor.label
        ]
        label.draw(in: CGRect(x: 24, y: y, width: 130, height: 16), withAttributes: labelAttrs)
        value.draw(in: CGRect(x: 160, y: y, width: pageRect.width - 184, height: 16), withAttributes: valueAttrs)
        return y + 17
    }
}
