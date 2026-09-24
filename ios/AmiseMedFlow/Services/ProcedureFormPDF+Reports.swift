// ProcedureFormPDF+Reports.swift
// Encounter record, ward round handover, patient journey timeline and trauma assessment PDFs

import UIKit

extension ProcedureFormPDF {

    static func encounterRecord(encounter: Encounter) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "CLINICAL ENCOUNTER RECORD")
            if let patient = encounter.patient {
                y = drawPatientStrip(patient: patient, y: y)
            }
            y = drawMeta(date: encounter.encounterDate, y: y)

            // Visit details
            let df = DateFormatter()
            df.dateStyle = .medium; df.timeStyle = .short
            let visitRows: [(String, String)] = [
                ("Visit type",   encounter.visitType.rawValue),
                ("Setting",      encounter.setting.rawValue),
                ("Location",     encounter.location.rawValue),
                ("Acuity",       encounter.acuity.label),
                ("Date / Time",  df.string(from: encounter.encounterDate) + " ECT"),
                ("Status",       encounter.isComplete ? "Encounter closed" : "In progress"),
            ].filter { !$0.1.isEmpty }
            y = drawRowSection(ctx: ctx, title: "Visit Details", rows: visitRows, y: y)

            // Presenting problem
            if let cc = encounter.chiefComplaint, !cc.isEmpty {
                y = drawRowSection(ctx: ctx, title: "Presenting Problem",
                                   rows: [("Chief complaint", cc)], y: y)
            }
            if let hpi = encounter.hpi, !hpi.isEmpty {
                y = drawTextSection(ctx: ctx, title: "History of Presenting Illness", body: hpi, y: y)
            }

            // SOCRATES
            let socr = encounter.decodedSOCRATES
            if !socr.isEmpty {
                let order = ["Site","Onset","Character","Radiation",
                             "Associated","Time","Exacerbating","Severity"]
                let socrRows = order.compactMap { key -> (String, String)? in
                    guard let chips = socr[key], !chips.isEmpty else { return nil }
                    return (key, chips.joined(separator: " · "))
                }
                if !socrRows.isEmpty {
                    y = drawRowSection(ctx: ctx, title: "SOCRATES", rows: socrRows, y: y)
                }
            }

            // History at visit
            var histRows: [(String, String)] = []
            if let pmh = encounter.pmhNotes, !pmh.isEmpty {
                histRows.append(("Past medical history", pmh))
            }
            if let pshx = encounter.surgicalHistory, !pshx.isEmpty {
                histRows.append(("Surgical history", pshx))
            }
            if !histRows.isEmpty {
                y = drawRowSection(ctx: ctx, title: "History at Visit", rows: histRows, y: y)
            }

            // Examination
            let examPairs: [(String, String?)] = [
                ("General",      encounter.examGeneral),
                ("CVS",          encounter.examCVS),
                ("Respiratory",  encounter.examResp),
                ("Abdomen",      encounter.examAbdo),
                ("Neurological", encounter.examNeuro),
                ("MSK",          encounter.examMSK),
                ("Skin",         encounter.examSkin),
                ("Other",        encounter.examOther),
            ]
            let examRows = examPairs.compactMap { k, v -> (String, String)? in
                guard let v = v, !v.isEmpty else { return nil }
                return (k, v)
            }
            if !examRows.isEmpty {
                y = drawRowSection(ctx: ctx, title: "Examination", rows: examRows, y: y)
            }

            // Investigations
            let invs = encounter.decodedInvestigations
            if !invs.isEmpty {
                y = drawSectionHeader(title: "Investigations", y: y)
                for inv in invs {
                    y = maybeNewPage(ctx: ctx, y: y, minSpace: 20)
                    var line = inv.name
                    if !inv.result.isEmpty { line += " — " + inv.result }
                    line += "  [\(inv.status.rawValue)]"
                    line.draw(in: CGRect(x: lm, y: y, width: bodyW, height: 13),
                              withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                                               .foregroundColor: UIColor.label])
                    y += 14
                }
                y += 4
            }

            // Assessment & plan
            var assessRows: [(String, String)] = []
            if let dx = encounter.workingDiagnosis, !dx.isEmpty {
                let dxLine = dx + (encounter.workingDiagnosisICD.map { "  [\($0)]" } ?? "")
                assessRows.append(("Working diagnosis", dxLine))
            }
            if !assessRows.isEmpty {
                y = drawRowSection(ctx: ctx, title: "Assessment & Plan", rows: assessRows, y: y)
            }
            if let assess = encounter.assessmentText, !assess.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Assessment", body: assess, y: y)
            }
            if let plan = encounter.managementPlan, !plan.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Management Plan", body: plan, y: y)
            }

            // Bayesian differential snapshot
            let diff = encounter.decodedBayesianSnapshot
            if !diff.isEmpty {
                y = drawSectionHeader(title: "Differential Diagnosis (at Encounter Close)", y: y)
                for entry in diff.prefix(8) {
                    y = maybeNewPage(ctx: ctx, y: y, minSpace: 16)
                    let line = "\(entry.name)  (\(entry.icdCode))  —  \(entry.probability)%  [\(entry.confidence)]"
                    line.draw(in: CGRect(x: lm, y: y, width: bodyW, height: 13),
                              withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                                               .foregroundColor: UIColor.label])
                    y += 14
                }
                y += 4
            }

            // Clinician summary
            if let summary = encounter.clinicianSummary, !summary.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Clinician Summary", body: summary, y: y)
            }

            drawSignatureBlock(ctx: ctx, surgeon: "Dr Dawit Daniel Kabiye  MD · DM", y: y)
            drawFooter()
        }
    }


    // MARK: - Ward Round Handover PDF

    static func wardHandover(grouped: [(ClinicalLocation, [Patient])],
                             reviewedIDs: Set<UUID>) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "WARD ROUND HANDOVER")
            y = drawMeta(date: .now, y: y)

            let allPatients = grouped.flatMap { $0.1 }
            let totalCount  = allPatients.count
            let doneCount   = allPatients.filter { reviewedIDs.contains($0.id) }.count

            // Round progress bar
            let progressText = "Round progress: \(doneCount)/\(totalCount) reviewed"
            progressText.draw(
                in: CGRect(x: lm, y: y, width: bodyW - 120, height: 13),
                withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .semibold),
                                 .foregroundColor: doneCount == totalCount ? UIColor.systemGreen : UIColor.systemOrange])

            let dateStr = DateFormatter.ectLong.string(from: .now)
            dateStr.draw(
                in: CGRect(x: page.width - lm - 150, y: y, width: 150, height: 13),
                withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                                 .foregroundColor: UIColor.secondaryLabel])
            y += 18

            let nameAttrs:   [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 9.5, weight: .semibold), .foregroundColor: UIColor.label]
            let subAttrs:    [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.secondaryLabel]
            let bodyAttrs:   [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5), .foregroundColor: UIColor.label]
            let critAttrs:   [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold), .foregroundColor: UIColor.systemRed]
            let labelAttrs:  [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 7.5, weight: .bold), .foregroundColor: UIColor.secondaryLabel]

            for (loc, patients) in grouped {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 50)

                // Location header
                teal.setFill()
                UIRectFill(CGRect(x: 0, y: y, width: page.width, height: 18))
                loc.rawValue.uppercased().draw(
                    in: CGRect(x: lm, y: y + 3, width: bodyW, height: 13),
                    withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .bold),
                                     .foregroundColor: UIColor.white,
                                     .kern: 1.5])
                y += 22

                for patient in patients {
                    y = maybeNewPage(ctx: ctx, y: y, minSpace: 70)

                    let reviewed = reviewedIDs.contains(patient.id)

                    // Patient row background
                    let rowBg = reviewed
                        ? UIColor.systemGreen.withAlphaComponent(0.05)
                        : teal.withAlphaComponent(0.04)
                    rowBg.setFill()
                    UIRectFill(CGRect(x: lm - 4, y: y - 2, width: bodyW + 8, height: 13))

                    // Review badge (right-aligned)
                    let badge = reviewed ? "✓ Reviewed" : "Pending"
                    let badgeColor = reviewed ? UIColor.systemGreen : UIColor.systemOrange
                    badge.draw(
                        in: CGRect(x: page.width - lm - 70, y: y, width: 70, height: 12),
                        withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                                         .foregroundColor: badgeColor])

                    // Acuity label
                    let acuityColor: UIColor = {
                        switch patient.acuity {
                        case .emergency: return .systemRed
                        case .urgent:    return .systemOrange
                        case .priority:  return .systemYellow
                        case .routine:   return teal
                        }
                    }()
                    patient.acuity.label.uppercased().draw(
                        at: CGPoint(x: lm, y: y),
                        withAttributes: [.font: UIFont.systemFont(ofSize: 7, weight: .black),
                                         .foregroundColor: acuityColor,
                                         .kern: 1])
                    y += 14

                    // Name + identity line
                    var idParts = [patient.fullName]
                    idParts.append(patient.sex.rawValue)
                    if patient.ageYears > 0 { idParts.append("\(patient.ageYears)y") }
                    if let mrn = patient.mrn, !mrn.isEmpty { idParts.append("MRN \(mrn)") }
                    if let bed = patient.bedNumber { idParts.append("Bed \(bed)") }
                    idParts.joined(separator: "  ·  ").draw(
                        in: CGRect(x: lm, y: y, width: bodyW - 80, height: 14),
                        withAttributes: nameAttrs)
                    y += 15

                    // Diagnosis / CC
                    if let dx = patient.workingDiagnosis, !dx.isEmpty {
                        "Dx:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
                        dx.draw(in: CGRect(x: lm + 22, y: y, width: bodyW - 22, height: 13), withAttributes: bodyAttrs)
                        y += 14
                    } else if let cc = patient.chiefComplaint, !cc.isEmpty {
                        "CC:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
                        cc.draw(in: CGRect(x: lm + 22, y: y, width: bodyW - 22, height: 13), withAttributes: bodyAttrs)
                        y += 14
                    }

                    // Latest vitals
                    if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
                        var vParts = ["NEWS2 \(v.news2Score) (\(v.news2Risk))"]
                        if let bp = v.bpString  { vParts.append("BP \(bp)") }
                        if let hr = v.heartRate  { vParts.append("HR \(hr)") }
                        if let sp = v.spo2       { vParts.append("SpO₂ \(sp)%") }
                        if let t  = v.temperatureCelsius { vParts.append(String(format: "T %.1f°C", t)) }
                        let vText = vParts.joined(separator: "  ·  ")
                        let vAttrs: [NSAttributedString.Key: Any] = v.news2Score >= 7
                            ? critAttrs
                            : [.font: UIFont.systemFont(ofSize: 8.5), .foregroundColor: UIColor.label]
                        "Vitals:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
                        vText.draw(in: CGRect(x: lm + 40, y: y, width: bodyW - 40, height: 13), withAttributes: vAttrs)
                        y += 14
                    }

                    // Investigations
                    let invs = patient.investigations
                    let pending  = invs.filter { $0.status == .ordered || $0.status == .pending }
                    let resulted = invs.filter { $0.status == .resulted && !$0.result.isEmpty }

                    if !resulted.isEmpty {
                        "Results:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
                        let rText = resulted.prefix(4).map { "\($0.name): \($0.result)" }.joined(separator: "  ·  ")
                        rText.draw(in: CGRect(x: lm + 46, y: y, width: bodyW - 46, height: 13), withAttributes: bodyAttrs)
                        y += 14
                    }

                    if !pending.isEmpty {
                        "Awaiting:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
                        let pText = pending.map { $0.name }.joined(separator: ", ")
                        pText.draw(in: CGRect(x: lm + 52, y: y, width: bodyW - 52, height: 13), withAttributes: subAttrs)
                        y += 14
                    }

                    // Management plan (first paragraph)
                    if let plan = patient.managementPlan, !plan.isEmpty {
                        let planPreview = plan.components(separatedBy: .newlines)
                            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                            .prefix(2).joined(separator: "  ·  ")
                        let truncated = planPreview.count > 180 ? String(planPreview.prefix(180)) + "…" : planPreview
                        "Plan:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
                        truncated.draw(in: CGRect(x: lm + 30, y: y, width: bodyW - 30, height: 26), withAttributes: bodyAttrs)
                        y += 16
                    }

                    // Separator
                    teal.withAlphaComponent(0.15).setFill()
                    UIRectFill(CGRect(x: lm - 4, y: y + 2, width: bodyW + 8, height: 0.5))
                    y += 10
                }
            }

            // Summary footer box
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 60)
            y += 6
            teal.withAlphaComponent(0.08).setFill()
            UIRectFill(CGRect(x: lm - 4, y: y, width: bodyW + 8, height: 36))
            "ROUND SUMMARY".draw(
                in: CGRect(x: lm, y: y + 4, width: bodyW, height: 12),
                withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .bold), .foregroundColor: teal])
            "\(doneCount)/\(totalCount) patients reviewed  ·  \(totalCount - doneCount) outstanding".draw(
                in: CGRect(x: lm, y: y + 18, width: bodyW, height: 12),
                withAttributes: [.font: UIFont.systemFont(ofSize: 8.5), .foregroundColor: UIColor.label])
            y += 44

            "This handover is a summary. Verify all details in the full electronic record before acting on clinical information.".draw(
                in: CGRect(x: lm, y: y, width: bodyW, height: 24),
                withAttributes: [.font: UIFont.italicSystemFont(ofSize: 7), .foregroundColor: UIColor.tertiaryLabel])
            y += 30

            drawSignatureBlock(ctx: ctx, surgeon: "Dr Dawit Daniel Kabiye  MD · DM", y: y)
            drawFooter()
        }
    }

}
