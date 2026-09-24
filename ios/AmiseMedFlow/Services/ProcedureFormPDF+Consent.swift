// ProcedureFormPDF+Consent.swift
// Surgical consent form, pre-op checklist and patient instruction PDF generators

import UIKit

extension ProcedureFormPDF {


    // MARK: - Surgical Consent Form

    static func consentForm(patient: Patient, data: ConsentFormData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "SURGICAL CONSENT FORM")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.consentDate, y: y)

            y = drawRowSection(ctx: ctx, title: "Consent Details", rows: [
                ("Consent type", data.consentType),
                ("Surgeon",      data.surgeonName),
                ("Anaesthetist", data.anaesthetistName),
            ], y: y)

            y = drawRowSection(ctx: ctx, title: "Proposed Procedure", rows: [
                ("Procedure",    data.procedureName),
                ("Indication",   data.indication),
                ("Side / site",  data.sideOrSite),
            ], y: y)
            if !data.procedureDescription.isEmpty {
                y = drawTextSection(ctx: ctx, title: nil, body: data.procedureDescription, y: y)
            }

            let allRisks = data.generalRisks + data.specificRisks + (data.specificRisksOther.isEmpty ? [] : [data.specificRisksOther])
            if !allRisks.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Risks Discussed", body: allRisks.map { "• \($0)" }.joined(separator: "\n"), y: y)
            }

            let alts = data.alternativesTreated + (data.alternativesOther.isEmpty ? [] : [data.alternativesOther])
            if !alts.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Alternative Treatments Discussed", body: alts.map { "• \($0)" }.joined(separator: "\n"), y: y)
            }

            var anaesRows: [(String, String)] = [("Anaesthesia type", data.anaesthesiaType)]
            anaesRows.append(("Anaesthesia risks", data.anaesthesiaRisksDiscussed ? "Discussed" : "Not discussed"))
            y = drawRowSection(ctx: ctx, title: "Anaesthesia", rows: anaesRows, y: y)

            var bpRows: [(String, String)] = [("Blood products discussed", data.bloodProductsDiscussed ? "Yes" : "No")]
            if data.bloodProductsDeclined { bpRows.append(("Patient declines blood products", "YES — documented")) }
            y = drawRowSection(ctx: ctx, title: "Blood Products", rows: bpRows, y: y)

            var capRows: [(String, String)] = [("Decision-making capacity", data.capacityConfirmed ? "Confirmed" : "Not confirmed — see notes")]
            if data.interpreterRequired {
                capRows.append(("Interpreter", data.interpreterName.isEmpty ? "Required" : data.interpreterName))
            }
            capRows.append(("Questions answered", data.questionsAnswered ? "Yes, to patient's satisfaction" : "Ongoing — see notes"))
            if !data.questionsAsked.isEmpty { capRows.append(("Questions asked", data.questionsAsked)) }
            y = drawRowSection(ctx: ctx, title: "Patient Capacity & Understanding", rows: capRows, y: y)

            if !data.additionalNotes.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Additional Notes", body: data.additionalNotes, y: y)
            }

            // Signature block
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 120)
            y = drawSectionHeader(title: "Signatures", y: y)
            let sigAttrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5), .foregroundColor: UIColor.label]
            let lineAttrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.secondaryLabel]
            let col1: CGFloat = lm, col2: CGFloat = page.width / 2 + 10, lineW: CGFloat = (bodyW / 2) - 20

            for (label, name, col) in [
                ("Patient", data.patientPrintedName, col1),
                ("Witness (\(data.witnessDesignation.isEmpty ? "staff" : data.witnessDesignation))", data.witnessName, col2),
                ("Surgeon", data.surgeonName, col1)
            ] {
                "Signature:".draw(in: CGRect(x: col, y: y, width: 60, height: 12), withAttributes: lineAttrs)
                teal.withAlphaComponent(0.3).setFill()
                UIRectFill(CGRect(x: col + 64, y: y + 10, width: lineW - 64, height: 0.5))
                y += 16
                label.draw(in: CGRect(x: col, y: y, width: 80, height: 12), withAttributes: lineAttrs)
                if !name.isEmpty { name.draw(in: CGRect(x: col + 84, y: y, width: lineW - 84, height: 12), withAttributes: sigAttrs) }
                "Date:".draw(in: CGRect(x: col, y: y + 16, width: 40, height: 12), withAttributes: lineAttrs)
                teal.withAlphaComponent(0.3).setFill()
                UIRectFill(CGRect(x: col + 44, y: y + 26, width: lineW - 44, height: 0.5))
                y += 36
            }

            drawFooter()
        }
    }


    // MARK: - Pre-operative Checklist

    static func preOpChecklist(patient: Patient, data: PreOpChecklistData) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = drawHeader(type: "WHO SURGICAL SAFETY CHECKLIST")
            y = drawPatientStrip(patient: patient, y: y)

            // Team
            y = drawMeta(date: data.checklistDate, y: y)
            y = drawRowSection(ctx: ctx, title: "Surgical Team", rows: [
                ("Location / Theatre", data.location.isEmpty ? "—" : data.location),
                ("Surgeon",            data.surgeonName),
                ("Anaesthetist",       data.anaesthetistName.isEmpty ? "—" : data.anaesthetistName),
                ("Scrub nurse",        data.scrubNurseName.isEmpty ? "—" : data.scrubNurseName),
                ("Circulating nurse",  data.circulatingNurseName.isEmpty ? "—" : data.circulatingNurseName),
            ], y: y)

            // Sign In
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 80)
            y = drawPhaseHeader(ctx: ctx, title: "SIGN IN", subtitle: "Before induction of anaesthesia",
                                complete: checklistSignInComplete(data), y: y)
            y = drawChecklistItems(ctx: ctx, items: [
                (data.si_identityConfirmed,        "Patient identity confirmed (name, DOB, MRN)"),
                (data.si_siteProcedureConfirmed,   "Site and procedure confirmed"),
                (data.si_consentConfirmed,         "Consent obtained and signed"),
                (data.si_siteMarked || data.si_siteMarkingNA,
                                                    "Surgical site marked" + (data.si_siteMarkingNA ? " (N/A)" : "")),
                (data.si_anaesthesiaCheckComplete, "Anaesthesia machine / medication check complete"),
                (data.si_pulseOxFunctioning,       "Pulse oximeter on and functioning"),
            ], y: y)
            if data.si_knownAllergy {
                y = drawChecklistItem(ctx: ctx, checked: true,
                                      label: "Known allergy — \(data.si_allergyDetails.isEmpty ? "see notes" : data.si_allergyDetails)",
                                      accent: true, y: y)
            }
            if data.si_difficultAirway {
                y = drawChecklistItem(ctx: ctx, checked: true,
                                      label: "Difficult airway / aspiration risk — \(data.si_airwayDetails.isEmpty ? "plan in notes" : data.si_airwayDetails)",
                                      accent: true, y: y)
            }
            if data.si_bloodLossRisk {
                y = drawChecklistItem(ctx: ctx, checked: true,
                                      label: "Blood loss risk >500 mL — \(data.si_bloodLossPrep.isEmpty ? "see preparation" : data.si_bloodLossPrep)",
                                      accent: true, y: y)
            }
            if data.si_timeRecorded {
                let tf = DateFormatter(); tf.timeStyle = .short
                y = drawRowSection(ctx: ctx, title: "", rows: [
                    ("Sign In time",  tf.string(from: data.si_time)),
                    ("Confirmed by",  data.si_confirmedBy.isEmpty ? "—" : data.si_confirmedBy),
                ], y: y)
            }

            // Time Out
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 80)
            y = drawPhaseHeader(ctx: ctx, title: "TIME OUT", subtitle: "Before skin incision",
                                complete: checklistTimeOutComplete(data), y: y)
            y = drawChecklistItems(ctx: ctx, items: [
                (data.to_teamIntroduced,                 "All team members introduced by name and role"),
                (data.to_patientSiteProcedureConfirmed,  "Patient identity, site and procedure confirmed by all"),
                (data.to_surgeonCriticalSteps,           "Surgeon: critical steps, duration, anticipated blood loss stated"),
                (data.to_anaesthesiaConcerns,            "Anaesthesia: patient-specific concerns stated"),
                (data.to_nursingEquipmentReady,          "Nursing: sterility confirmed, equipment issues stated"),
                (data.to_antibioticGiven || data.to_antibioticNA,
                                                          "Antibiotic prophylaxis" +
                                                          (data.to_antibioticNA ? " (N/A)" : data.to_antibioticName.isEmpty ? "" : " — \(data.to_antibioticName)")),
                (data.to_imagingDisplayed || data.to_imagingNA,
                                                          "Essential imaging displayed" + (data.to_imagingNA ? " (N/A)" : "")),
            ], y: y)
            if data.to_timeRecorded {
                let tf = DateFormatter(); tf.timeStyle = .short
                y = drawRowSection(ctx: ctx, title: "", rows: [
                    ("Time Out time", tf.string(from: data.to_time)),
                    ("Confirmed by",  data.to_confirmedBy.isEmpty ? "—" : data.to_confirmedBy),
                ], y: y)
            }

            // Sign Out
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 80)
            y = drawPhaseHeader(ctx: ctx, title: "SIGN OUT", subtitle: "Before patient leaves operating room",
                                complete: checklistSignOutComplete(data), y: y)
            var countLabel = "Instrument / sponge / needle counts correct"
            if !data.so_countDiscrepancy.isEmpty { countLabel += " — DISCREPANCY: \(data.so_countDiscrepancy)" }
            y = drawChecklistItems(ctx: ctx, items: [
                (data.so_procedureDocumented,       "Procedure name documented"),
                (data.so_instrumentCountCorrect,    "Instrument count correct"),
                (data.so_spongeCountCorrect,        "Sponge count correct"),
                (data.so_needleCountCorrect,        "Needle / sharps count correct"),
                (data.so_specimenLabelled || data.so_specimenNA,
                                                     "Specimen labelled" +
                                                     (data.so_specimenNA ? " (N/A)" : data.so_specimenDetails.isEmpty ? "" : " — \(data.so_specimenDetails)")),
            ], y: y)
            if data.so_equipmentIssues && !data.so_equipmentNotes.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Equipment issues", body: data.so_equipmentNotes, y: y)
            }
            if !data.so_recoveryConcerns.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Recovery / handover concerns", body: data.so_recoveryConcerns, y: y)
            }
            if data.so_timeRecorded {
                let tf = DateFormatter(); tf.timeStyle = .short
                y = drawRowSection(ctx: ctx, title: "", rows: [
                    ("Sign Out time", tf.string(from: data.so_time)),
                    ("Confirmed by",  data.so_confirmedBy.isEmpty ? "—" : data.so_confirmedBy),
                ], y: y)
            }

            drawFooter()
        }
    }


    // MARK: - Patient Instruction Sheet

    static func patientInstructions(patient: Patient, data: PatientInstructionsData) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let df = DateFormatter(); df.dateStyle = .long
        let standardWarnings = [
            "Fever above 38.5°C (101.3°F)",
            "Increasing pain not controlled by prescribed pain relief",
            "Signs of wound infection: redness, swelling, warmth or discharge",
            "Excessive bleeding from the wound or any body opening",
            "Difficulty breathing or chest pain — call 911 immediately",
            "Inability to pass urine for more than 6–8 hours",
            "Persistent vomiting preventing fluid intake",
        ]
        return renderer.pdfData { ctx in
            ctx.beginPage()

            // Patient-facing header — larger, friendlier
            teal.setFill()
            UIRectFill(CGRect(x: 0, y: 0, width: page.width, height: 52))
            "DISCHARGE INSTRUCTIONS".draw(
                in: CGRect(x: lm, y: 8, width: bodyW, height: 18),
                withAttributes: [.font: UIFont.systemFont(ofSize: 14, weight: .bold),
                                 .foregroundColor: UIColor.white])
            "Amise Medical Services · Saint Lucia".draw(
                in: CGRect(x: lm, y: 28, width: bodyW, height: 14),
                withAttributes: [.font: UIFont.systemFont(ofSize: 9),
                                 .foregroundColor: UIColor.white.withAlphaComponent(0.85)])

            // Patient strip — larger font than clinical forms
            var y: CGFloat = 60
            UIColor.secondarySystemBackground.setFill()
            UIRectFill(CGRect(x: 0, y: y, width: page.width, height: 36))
            let nameAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12, weight: .semibold),
                .foregroundColor: UIColor.label,
            ]
            let subAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 8.5),
                .foregroundColor: UIColor.secondaryLabel,
            ]
            patient.fullName.draw(in: CGRect(x: lm, y: y + 4, width: bodyW * 0.6, height: 14),
                                  withAttributes: nameAttrs)
            let dob = patient.dateOfBirth.map { df.string(from: $0) } ?? "—"
            "DOB: \(dob)  ·  MRN: \(patient.mrn ?? "—")".draw(
                in: CGRect(x: lm, y: y + 20, width: bodyW, height: 12),
                withAttributes: subAttrs)
            "Date: \(df.string(from: data.dischargeDate))".draw(
                in: CGRect(x: lm + bodyW * 0.6, y: y + 4, width: bodyW * 0.4, height: 12),
                withAttributes: subAttrs)
            y += 44

            // Procedure performed
            y = patientSection(ctx: ctx, title: "Procedure Performed", y: y)
            y = patientBody(ctx: ctx, text: data.procedurePerformed.isEmpty ? "—" : data.procedurePerformed, y: y)
            if !data.procedureExplanation.isEmpty {
                y = patientBody(ctx: ctx, text: data.procedureExplanation, y: y)
            }
            "Surgeon: \(data.surgeonName)".draw(
                in: CGRect(x: lm, y: y, width: bodyW, height: 12), withAttributes: subAttrs)
            y += 16

            // Wound care
            if !data.woundCareInstructions.isEmpty {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 50)
                y = patientSection(ctx: ctx, title: "Wound / Site Care", y: y)
                y = patientBody(ctx: ctx, text: data.woundCareInstructions, y: y)
                if !data.sutureInfo.isEmpty {
                    y = patientBody(ctx: ctx, text: data.sutureInfo, y: y)
                }
            }

            // Diet
            if !data.dietInstructions.isEmpty {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 50)
                y = patientSection(ctx: ctx, title: "Diet and Fluids", y: y)
                y = patientBody(ctx: ctx, text: data.dietInstructions, y: y)
            }

            // Activity
            if !data.activityInstructions.isEmpty || !data.drivingInstructions.isEmpty {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 50)
                y = patientSection(ctx: ctx, title: "Activity and Driving", y: y)
                if !data.activityInstructions.isEmpty {
                    y = patientBody(ctx: ctx, text: data.activityInstructions, y: y)
                }
                if !data.drivingInstructions.isEmpty {
                    y = patientBody(ctx: ctx, text: data.drivingInstructions, y: y)
                }
            }

            // Medications
            if !data.medicationInstructions.isEmpty {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 50)
                y = patientSection(ctx: ctx, title: "Medications and Pain Relief", y: y)
                y = patientBody(ctx: ctx, text: data.medicationInstructions, y: y)
            }

            // Follow-up
            if !data.followUpInstructions.isEmpty {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
                y = patientSection(ctx: ctx, title: "Your Follow-up Appointment", y: y)
                y = patientBody(ctx: ctx, text: data.followUpInstructions, y: y)
            }

            // Additional notes
            if !data.additionalNotes.isEmpty {
                y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
                y = patientSection(ctx: ctx, title: "Additional Information", y: y)
                y = patientBody(ctx: ctx, text: data.additionalNotes, y: y)
            }

            // Warning signs — amber box
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 80)
            y += 6
            let allWarnings = data.additionalWarnings.isEmpty
                ? standardWarnings
                : standardWarnings + [data.additionalWarnings]
            let warningH = CGFloat(allWarnings.count) * 14 + 30
            UIColor.systemOrange.withAlphaComponent(0.10).setFill()
            UIRectFill(CGRect(x: lm - 6, y: y, width: bodyW + 12, height: warningH))
            UIColor.systemOrange.setStroke()
            UIBezierPath(rect: CGRect(x: lm - 6, y: y, width: bodyW + 12, height: warningH)).stroke()
            "⚠ WHEN TO SEEK URGENT HELP".draw(
                in: CGRect(x: lm, y: y + 6, width: bodyW, height: 14),
                withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .bold),
                                 .foregroundColor: UIColor.systemOrange])
            var wy = y + 20
            for warning in allWarnings {
                "• \(warning)".draw(in: CGRect(x: lm, y: wy, width: bodyW, height: 14),
                                    withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                                                     .foregroundColor: UIColor.label])
                wy += 14
            }
            y = wy + 8

            // Contact box
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 50)
            y += 4
            teal.withAlphaComponent(0.08).setFill()
            UIRectFill(CGRect(x: lm - 6, y: y, width: bodyW + 12, height: 38))
            "If you have any concerns, please contact us:".draw(
                in: CGRect(x: lm, y: y + 4, width: bodyW, height: 12),
                withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                                 .foregroundColor: UIColor.label])
            "\(data.contactAddress)  ·  Tel: \(data.contactPhone)".draw(
                in: CGRect(x: lm, y: y + 18, width: bodyW, height: 12),
                withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                                 .foregroundColor: UIColor.label])
            y += 44

            drawFooter()
        }
    }


    static func checklistSignInComplete(_ d: PreOpChecklistData) -> Bool {
        d.si_identityConfirmed && d.si_siteProcedureConfirmed && d.si_consentConfirmed &&
        (d.si_siteMarked || d.si_siteMarkingNA) &&
        d.si_anaesthesiaCheckComplete && d.si_pulseOxFunctioning && d.si_timeRecorded
    }


    static func checklistTimeOutComplete(_ d: PreOpChecklistData) -> Bool {
        d.to_teamIntroduced && d.to_patientSiteProcedureConfirmed &&
        d.to_surgeonCriticalSteps && d.to_anaesthesiaConcerns && d.to_nursingEquipmentReady &&
        (d.to_antibioticGiven || d.to_antibioticNA) &&
        (d.to_imagingDisplayed || d.to_imagingNA) && d.to_timeRecorded
    }


    static func checklistSignOutComplete(_ d: PreOpChecklistData) -> Bool {
        d.so_procedureDocumented && d.so_instrumentCountCorrect &&
        d.so_spongeCountCorrect && d.so_needleCountCorrect &&
        (d.so_specimenLabelled || d.so_specimenNA) && d.so_timeRecorded
    }


    static func drawPhaseHeader(ctx: UIGraphicsPDFRendererContext,
                                title: String, subtitle: String,
                                complete: Bool, y: CGFloat) -> CGFloat {
        let lm: CGFloat = 36
        let width: CGFloat = page.width - lm * 2
        let bg = complete ? teal : UIColor(red: 0.35, green: 0.35, blue: 0.35, alpha: 1)
        bg.setFill()
        UIRectFill(CGRect(x: lm, y: y, width: width, height: 18))
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .bold),
            .foregroundColor: UIColor.white
        ]
        let subtitleAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 7),
            .foregroundColor: UIColor.white.withAlphaComponent(0.85)
        ]
        title.draw(in: CGRect(x: lm + 6, y: y + 2, width: 160, height: 12), withAttributes: titleAttrs)
        subtitle.draw(in: CGRect(x: lm + 6, y: y + 7, width: width - 12, height: 10), withAttributes: subtitleAttrs)
        let tick = complete ? "✓" : "○"
        tick.draw(in: CGRect(x: page.width - lm - 18, y: y + 3, width: 14, height: 12), withAttributes: titleAttrs)
        return y + 22
    }

    static func drawChecklistItems(ctx: UIGraphicsPDFRendererContext,
                                   items: [(Bool, String)], y: CGFloat) -> CGFloat {
        var y = y
        for (checked, label) in items {
            y = drawChecklistItem(ctx: ctx, checked: checked, label: label, accent: false, y: y)
        }
        return y + 4
    }

    static func drawChecklistItem(ctx: UIGraphicsPDFRendererContext,
                                  checked: Bool, label: String,
                                  accent: Bool, y: CGFloat) -> CGFloat {
        let lm: CGFloat = 36
        let width: CGFloat = page.width - lm * 2
        let rowH: CGFloat = 14
        if accent {
            teal.withAlphaComponent(0.08).setFill()
            UIRectFill(CGRect(x: lm, y: y, width: width, height: rowH))
        }
        let boxRect = CGRect(x: lm + 6, y: y + 3, width: 8, height: 8)
        (checked ? teal : UIColor.lightGray).setStroke()
        UIRectFrame(boxRect)
        if checked {
            teal.setFill()
            UIRectFill(boxRect.insetBy(dx: 2, dy: 2))
        }
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 7.5),
            .foregroundColor: UIColor.darkText
        ]
        label.draw(in: CGRect(x: lm + 18, y: y + 3, width: width - 24, height: 10), withAttributes: attrs)
        return y + rowH
    }

}
