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
                    let rowStartY = y
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


    // MARK: - Patient Journey Timeline PDF

    static func journeyTimeline(patient: Patient) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "PATIENT JOURNEY TIMELINE")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: .now, y: y)

            let df = DateFormatter()
            df.locale = Locale(identifier: "en_LC")
            df.timeZone = TimeZone(identifier: "America/St_Lucia") ?? .current
            df.dateFormat = "dd MMM yyyy  HH:mm"

            // Build timeline events inline (mirrors PatientJourneyView.allEvents)
            struct TimelineEntry {
                let date: Date
                let category: String
                let title: String
                let detail: String
            }
            var events: [TimelineEntry] = []

            let regDate = patient.admittedAt ?? patient.createdAt
            events.append(TimelineEntry(date: regDate, category: "Registration",
                title: "Patient Registered",
                detail: "\(patient.setting.rawValue) · \(patient.location.rawValue)\(patient.mrn.map { " · MRN \($0)" } ?? "")"))

            if let cc = patient.chiefComplaint, !cc.isEmpty {
                events.append(TimelineEntry(date: regDate.addingTimeInterval(60), category: "Registration",
                    title: "Chief Complaint", detail: String(cc.prefix(150))))
            }

            for v in patient.vitalsEntries where v.hasAnyValue {
                var parts: [String] = []
                if let bp = v.bpString          { parts.append("BP \(bp) mmHg") }
                if let hr = v.heartRate         { parts.append("HR \(hr) bpm") }
                if let t  = v.temperatureCelsius { parts.append(String(format: "Temp %.1f°C", t)) }
                if let sp = v.spo2              { parts.append("SpO₂ \(sp)%") }
                let detail = parts.isEmpty ? "NEWS2 \(v.news2Score) (\(v.news2Risk))"
                    : parts.joined(separator: "  ·  ") + "  —  NEWS2 \(v.news2Score)"
                events.append(TimelineEntry(date: v.recordedAt, category: "Vitals",
                    title: "Observations — NEWS2 \(v.news2Score) (\(v.news2Risk))", detail: detail))
            }

            for note in patient.clinicalNotes {
                let status = note.status == .signed ? "Signed" : "Draft"
                let preview: String = {
                    if note.noteType.isStructured {
                        return [note.assessment, note.plan, note.subjective]
                            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                            .first(where: { !$0.isEmpty })
                            .map { String($0.prefix(160)) } ?? ""
                    }
                    return (note.freeText ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        .components(separatedBy: "\n").first(where: { !$0.isEmpty }).map { String($0.prefix(160)) } ?? ""
                }()
                events.append(TimelineEntry(date: note.createdAt, category: "Note",
                    title: "\(note.noteType.label) [\(status)]", detail: preview))
            }

            for rx in patient.prescriptions {
                events.append(TimelineEntry(date: rx.prescribedAt, category: "Prescription",
                    title: "Prescribed: \(rx.drug)",
                    detail: "\(rx.dose)  \(rx.route)  \(rx.frequency)" + (rx.indication.isEmpty ? "" : " — \(rx.indication)")))
            }

            for inv in patient.investigations {
                let dateUsed = inv.resultedAt ?? inv.orderedAt
                let statusLabel = inv.status.rawValue
                events.append(TimelineEntry(date: dateUsed, category: "Investigation",
                    title: "\(inv.name) [\(statusLabel)]",
                    detail: inv.result.isEmpty ? statusLabel : "\(statusLabel): \(inv.result)"))
            }

            for op in patient.operativePlans {
                let procName = op.consentProcedure.isEmpty ? "Operative Plan" : op.consentProcedure
                events.append(TimelineEntry(date: op.updatedAt, category: "Procedure",
                    title: procName,
                    detail: "Anaesthesia: \(op.anaesthesiaType)  ·  WHO \(op.whoCompletedCount)/\(op.whoTotalCount)"))
            }

            let surgery = patient.surgeryData
            if !surgery.procedureName.isEmpty, let opDate = surgery.dateOfSurgery {
                events.append(TimelineEntry(date: opDate, category: "Procedure",
                    title: "Operative Note: \(surgery.procedureName)",
                    detail: [surgery.surgeon, surgery.anaesthetist].filter { !$0.isEmpty }.joined(separator: " · ")))
            }

            for enc in patient.encounters where enc.isComplete {
                events.append(TimelineEntry(date: enc.encounterDate, category: "Visit",
                    title: "Visit: \(enc.visitType.rawValue)",
                    detail: enc.workingDiagnosis ?? enc.chiefComplaint ?? enc.visitType.rawValue))
            }

            let discharge = patient.dischargeSummaryData
            if let dd = discharge.dischargeDate {
                events.append(TimelineEntry(date: dd, category: "Discharge",
                    title: "Discharged",
                    detail: [discharge.dischargeDestination, discharge.dischargeDiagnosis].filter { !$0.isEmpty }.joined(separator: " · ")))
            }

            let sorted = events.sorted { $0.date < $1.date }

            // Summary stats header
            let noteCount    = sorted.filter { $0.category == "Note" }.count
            let rxCount      = sorted.filter { $0.category == "Prescription" }.count
            let vitalCount   = sorted.filter { $0.category == "Vitals" }.count
            let invCount     = sorted.filter { $0.category == "Investigation" }.count
            let statsLine = "Notes: \(noteCount)  ·  Prescriptions: \(rxCount)  ·  Observations: \(vitalCount)  ·  Investigations: \(invCount)  ·  Events: \(sorted.count)"
            let statsAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                .foregroundColor: teal,
            ]
            statsLine.draw(in: CGRect(x: lm, y: y, width: bodyW, height: 14), withAttributes: statsAttrs)
            y += 18

            // Timeline rows
            let categoryAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 7.5, weight: .bold),
                .foregroundColor: teal,
            ]
            let dateAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedSystemFont(ofSize: 7.5, weight: .regular),
                .foregroundColor: UIColor.secondaryLabel,
            ]
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                .foregroundColor: UIColor.label,
            ]
            let detailAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 8),
                .foregroundColor: UIColor.secondaryLabel,
            ]

            let dotX: CGFloat = lm
            let textX: CGFloat = lm + 16
            let textW: CGFloat = bodyW - 16
            let lineX: CGFloat = lm + 4.5

            for (idx, event) in sorted.enumerated() {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 44)

                // Vertical spine line (above dot)
                if idx > 0 {
                    teal.withAlphaComponent(0.25).setFill()
                    UIRectFill(CGRect(x: lineX, y: y - 10, width: 1.5, height: 10))
                }

                // Category dot
                teal.withAlphaComponent(0.8).setFill()
                let dotRect = CGRect(x: dotX + 0.5, y: y + 2, width: 9, height: 9)
                UIBezierPath(ovalIn: dotRect).fill()

                // Category label + date
                event.category.uppercased().draw(at: CGPoint(x: textX, y: y), withAttributes: categoryAttrs)
                let dateStr = df.string(from: event.date)
                let dateW = dateStr.size(withAttributes: dateAttrs).width
                dateStr.draw(at: CGPoint(x: page.width - lm - dateW, y: y), withAttributes: dateAttrs)
                y += 12

                // Title
                let titleH = ceil(event.title.boundingRect(with: CGSize(width: textW, height: 100),
                    options: .usesLineFragmentOrigin, attributes: titleAttrs, context: nil).height)
                event.title.draw(in: CGRect(x: textX, y: y, width: textW, height: titleH + 2), withAttributes: titleAttrs)
                y += titleH + 3

                // Detail
                if !event.detail.isEmpty {
                    let detailH = ceil(event.detail.boundingRect(with: CGSize(width: textW, height: 100),
                        options: .usesLineFragmentOrigin, attributes: detailAttrs, context: nil).height)
                    event.detail.draw(in: CGRect(x: textX, y: y, width: textW, height: detailH + 2), withAttributes: detailAttrs)
                    y += detailH + 4
                }

                y += 6
            }

            if sorted.isEmpty {
                "No timeline events recorded.".draw(
                    in: CGRect(x: lm, y: y, width: bodyW, height: 14),
                    withAttributes: detailAttrs)
                y += 18
            }

            drawFooter()
        }
    }


    // MARK: - Trauma Assessment

    static func traumaAssessment(patient: Patient, data: TraumaData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "TRAUMA ASSESSMENT")
            y = drawPatientStrip(patient: patient, y: y)

            let df = DateFormatter(); df.dateStyle = .medium; df.timeStyle = .short

            // MTP flag
            if data.mtpTrigger {
                let orange = UIColor(red: 0.95, green: 0.45, blue: 0.05, alpha: 1)
                orange.withAlphaComponent(0.12).setFill()
                UIRectFill(CGRect(x: lm - 4, y: y, width: bodyW + 8, height: 18))
                "⚠ MTP TRIGGER: HR > 120 + SBP < 90 — consider massive transfusion protocol".draw(
                    in: CGRect(x: lm, y: y + 3, width: bodyW, height: 13),
                    withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .bold),
                                     .foregroundColor: orange])
                y += 22
            }

            // ISS / NISS
            if data.iss > 0 {
                let rows: [(String, String)] = [
                    ("ISS", "\(data.iss)"),
                    ("NISS", "\(data.niss)"),
                    ("Severity", {
                        switch data.iss {
                        case 1...8: return "Minor"
                        case 9...15: return "Moderate"
                        case 16...24: return "Serious"
                        case 25...40: return "Severe"
                        case 41...74: return "Critical"
                        default: return data.iss == 0 ? "No injury" : "Unsurvivable"
                        }
                    }()),
                ]
                y = drawRowSection(ctx: ctx, title: "Injury Severity", rows: rows, y: y)
            }

            // MIST handover
            var mistRows: [(String, String)] = []
            if !data.mechanism.isEmpty { mistRows.append(("Mechanism", data.mechanism.joined(separator: ", "))) }
            if let toi = data.timeOfInjury { mistRows.append(("Time of injury", df.string(from: toi))) }
            if !data.injuriesSuspected.isEmpty { mistRows.append(("Injuries suspected", data.injuriesSuspected)) }
            if !data.signsAtScene.isEmpty { mistRows.append(("Signs at scene", data.signsAtScene)) }
            if !data.preHospitalInterventions.isEmpty { mistRows.append(("Pre-hospital Rx", data.preHospitalInterventions.joined(separator: ", "))) }
            if !mistRows.isEmpty { y = drawRowSection(ctx: ctx, title: "MIST Handover", rows: mistRows, y: y) }

            // Admission vitals
            var vitalsRows: [(String, String)] = []
            if !data.hr.isEmpty  { vitalsRows.append(("HR", "\(data.hr) bpm")) }
            if !data.sbp.isEmpty { vitalsRows.append(("BP", "\(data.sbp)/\(data.dbp) mmHg")) }
            if !data.rr.isEmpty  { vitalsRows.append(("RR", "\(data.rr) /min")) }
            if !data.spo2.isEmpty { vitalsRows.append(("SpO₂", "\(data.spo2)%")) }
            if !data.temp.isEmpty { vitalsRows.append(("Temp", "\(data.temp)°C")) }
            let gcs = data.gcsTotalDisplay
            if gcs > 0 { vitalsRows.append(("GCS", "\(gcs)/15 (E\(data.gcsE)+V\(data.gcsV)+M\(data.gcsM))")) }
            if !data.glucose.isEmpty { vitalsRows.append(("Glucose", "\(data.glucose) mmol/L")) }
            if !data.pupils.isEmpty  { vitalsRows.append(("Pupils", data.pupils)) }
            if !data.ebl.isEmpty     { vitalsRows.append(("Est blood loss", "\(data.ebl) mL")) }
            if !vitalsRows.isEmpty { y = drawRowSection(ctx: ctx, title: "Vitals on Admission", rows: vitalsRows, y: y) }

            // ABCDE
            let abcRows: [(String, String)] = [
                ("A — Airway",    data.airway + (data.airwayNotes.isEmpty ? "" : " — \(data.airwayNotes)")),
                ("B — Breathing", (data.breathingRate.isEmpty ? "" : "RR \(data.breathingRate), ") + data.breathingSounds + (data.breathingNotes.isEmpty ? "" : " — \(data.breathingNotes)")),
                ("C — Circulation", (data.circulationHR.isEmpty ? "" : "HR \(data.circulationHR), ") + (data.circulationBP.isEmpty ? "" : "BP \(data.circulationBP)") + (data.circulationNotes.isEmpty ? "" : " — \(data.circulationNotes)")),
                ("D — Disability", "GCS \(data.gcsTotalDisplay)/15" + (data.disabilityNotes.isEmpty ? "" : " — \(data.disabilityNotes)")),
                ("E — Exposure",  data.exposureNotes),
            ]
            let abcFiltered = abcRows.filter { !$0.1.isEmpty }
            if !abcFiltered.isEmpty { y = drawRowSection(ctx: ctx, title: "ABCDE Primary Survey", rows: abcFiltered, y: y) }

            // ISS breakdown
            let issRows: [(String, String)] = [
                ("Head & Neck", data.aisHead > 0 ? "AIS \(data.aisHead)" : ""),
                ("Face", data.aisFace > 0 ? "AIS \(data.aisFace)" : ""),
                ("Chest", data.aisChest > 0 ? "AIS \(data.aisChest)" : ""),
                ("Abdomen & Pelvis", data.aisAbdomen > 0 ? "AIS \(data.aisAbdomen)" : ""),
                ("Extremities", data.aisExtremities > 0 ? "AIS \(data.aisExtremities)" : ""),
                ("Skin / External", data.aisSkinSurface > 0 ? "AIS \(data.aisSkinSurface)" : ""),
            ].filter { !$0.1.isEmpty }
            if !issRows.isEmpty { y = drawRowSection(ctx: ctx, title: "AIS by Region", rows: issRows, y: y) }

            // Secondary survey
            let secNotes = secondaryRegions_pdf.compactMap { region -> String? in
                guard let v = data.secondarySurveyNotes[region], !v.isEmpty else { return nil }
                return "\(region): \(v)"
            }
            if !secNotes.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Secondary Survey", body: secNotes.joined(separator: "\n"), y: y)
            }

            // Burns
            if data.tbsa > 0 {
                var burnsRows: [(String, String)] = [("TBSA", String(format: "%.1f%%", data.tbsa))]
                if let parkland = data.parklandVolume {
                    burnsRows.append(("Parkland (24h)", String(format: "%.0f mL (first 8h: %.0f mL)", parkland, parkland / 2)))
                }
                if data.inhalationInjury { burnsRows.append(("Inhalation injury", "Yes")) }
                if !data.weightKg.isEmpty { burnsRows.append(("Weight", "\(data.weightKg) kg")) }
                y = drawRowSection(ctx: ctx, title: "Burns Assessment", rows: burnsRows, y: y)
                if !data.burnsNotes.isEmpty {
                    y = drawTextSection(ctx: ctx, title: nil, body: data.burnsNotes, y: y)
                }
            }

            // Interventions
            if !data.interventions.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Interventions", body: data.interventions.joined(separator: ", "), y: y)
            }
            if !data.notes.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Notes", body: data.notes, y: y)
            }

            drawSignatureBlock(ctx: ctx, surgeon: "Dr Dawit Daniel Kabiye, MD, DM", y: y)
            drawFooter()
        }
    }

    static func patientSection(ctx: UIGraphicsPDFRendererContext,
                                       title: String, y: CGFloat) -> CGFloat {
        let y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
        teal.withAlphaComponent(0.12).setFill()
        UIRectFill(CGRect(x: lm - 4, y: y, width: bodyW + 8, height: 18))
        title.uppercased().draw(
            in: CGRect(x: lm, y: y + 3, width: bodyW, height: 13),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8, weight: .bold),
                             .foregroundColor: teal])
        return y + 22
    }

    static func patientBody(ctx: UIGraphicsPDFRendererContext,
                                    text: String, y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 20)
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9.5),
            .foregroundColor: UIColor.label,
        ]
        let h = ceil(text.boundingRect(with: CGSize(width: bodyW, height: 3000),
                                       options: .usesLineFragmentOrigin,
                                       attributes: attrs, context: nil).height) + 4
        if y + h > page.height - 60 { ctx.beginPage(); y = 40 }
        text.draw(in: CGRect(x: lm, y: y, width: bodyW, height: h), withAttributes: attrs)
        return y + h + 6
    }

}
