import UIKit

// MARK: - PDF generator for all procedure-form reports

enum ProcedureFormPDF {

    private static let teal  = UIColor(red: 0.063, green: 0.663, blue: 0.682, alpha: 1)
    private static let page  = CGRect(x: 0, y: 0, width: 595, height: 842)
    private static let lm: CGFloat = 32   // left margin
    private static let rm: CGFloat = 32   // right margin
    private static var bodyW: CGFloat { page.width - lm - rm }

    // MARK: - Operative Note

    static func operativeNote(patient: Patient, data: SurgeryNoteData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "OPERATIVE NOTE")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.dateOfSurgery ?? .now, y: y)

            let df = DateFormatter()
            df.timeStyle = .short; df.dateStyle = .none

            var rows: [(String, String)] = [
                ("Surgeon",       data.surgeon),
                ("Assistant",     data.assistant),
                ("Anaesthetist",  data.anaesthetist),
                ("Scrub nurse",   data.scrubNurse),
                ("Procedure",     data.procedureName),
                ("Type",          data.procedureType),
                ("Anaesthesia",   "\(data.anaesthesiaType)\(data.anaesthesiaDetails.isEmpty ? "" : " — \(data.anaesthesiaDetails)")"),
                ("Airway",        data.airwayManagement),
                ("Position",      data.position),
                ("Skin prep",     data.skinPrep),
            ]
            if data.startTime != nil || data.endTime != nil {
                let start = data.startTime.map { df.string(from: $0) } ?? "—"
                let end   = data.endTime.map   { df.string(from: $0) } ?? "—"
                let dur   = data.durationMinutes > 0 ? " (\(data.durationMinutes) min)" : ""
                rows.append(("Duration", "\(start) – \(end)\(dur)"))
            }
            y = drawRowSection(ctx: ctx, title: "Team & Procedure", rows: rows, y: y)

            let who = [data.whoSignIn ? "Sign-in ✓" : "Sign-in ✗",
                       data.whoTimeout ? "Time-out ✓" : "Time-out ✗",
                       data.whoSignOut ? "Sign-out ✓" : "Sign-out ✗"].joined(separator: "   ")
            y = drawTextSection(ctx: ctx, title: "WHO Checklist", body: who, y: y)

            if !data.indication.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Indication", body: data.indication, y: y)
            }
            if !data.findingsIntraoperative.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Intraoperative Findings", body: data.findingsIntraoperative, y: y)
            }
            if !data.procedureDescription.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Procedure Description", body: data.procedureDescription, y: y)
            }
            if !data.incision.isEmpty || !data.haemostasis.isEmpty || !data.closure.isEmpty {
                let detail = [
                    data.incision.isEmpty   ? nil : "Incision: \(data.incision)",
                    data.haemostasis.isEmpty ? nil : "Haemostasis: \(data.haemostasis)",
                    data.closure.isEmpty     ? nil : "Closure: \(data.closure)"
                ].compactMap { $0 }.joined(separator: "\n")
                y = drawTextSection(ctx: ctx, title: "Technical Details", body: detail, y: y)
            }
            var fluids = [(String, String)]()
            if !data.eblMl.isEmpty  { fluids.append(("EBL", "\(data.eblMl) mL")) }
            if !data.fluidsMl.isEmpty { fluids.append(("IV fluids", "\(data.fluidsMl) mL")) }
            if !data.bloodProductsMl.isEmpty { fluids.append(("Blood products", "\(data.bloodProductsMl) mL")) }
            if !data.urineOutputMl.isEmpty { fluids.append(("Urine output", "\(data.urineOutputMl) mL")) }
            if !fluids.isEmpty { y = drawRowSection(ctx: ctx, title: "Blood Loss & Fluids", rows: fluids, y: y) }

            if data.specimensSent && !data.specimensDetails.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Specimens Sent", body: data.specimensDetails, y: y)
            }
            if data.implantsUsed && !data.implantsDetails.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Implants Used", body: data.implantsDetails, y: y)
            }
            let comps = data.intraopComplications.isEmpty ? "None" : data.intraopComplications.joined(separator: ", ")
            var compBody = comps
            if !data.intraopComplicationNotes.isEmpty { compBody += "\n\(data.intraopComplicationNotes)" }
            y = drawTextSection(ctx: ctx, title: "Intraoperative Complications", body: compBody, y: y)

            if !data.postOpOrders.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Post-operative Orders", body: data.postOpOrders, y: y)
            }
            drawSignatureBlock(ctx: ctx, surgeon: data.surgeon, y: y)
            drawFooter()
        }
    }

    // MARK: - OGD Report

    static func ogdReport(patient: Patient, data: OGDData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "OGD / GASTROSCOPY REPORT")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.dateOfProcedure ?? .now, y: y)

            var pre: [(String, String)] = [
                ("Indication",    data.indication.isEmpty ? "—" : (data.indication + (data.indicationOther.isEmpty ? [] : [data.indicationOther])).joined(separator: ", ")),
                ("Operator",      data.operator_),
                ("Assistant",     data.assistant),
                ("Consent",       data.consent ? "Obtained" : "Not recorded"),
                ("Sedation",      "\(data.sedationUsed)\(data.sedationDose.isEmpty ? "" : " \(data.sedationDose)")"),
                ("Duration",      data.duration.isEmpty ? "—" : "\(data.duration) min"),
                ("Quality",       data.quality),
                ("Antispasmodic", data.antispasmodic ? "Yes" : "No"),
            ]
            if data.antibiotic { pre.append(("Antibiotic", data.antibioticUsed)) }
            y = drawRowSection(ctx: ctx, title: "Procedure Details", rows: pre, y: y)

            let oe = findingLine(normal: data.oesophagusNormal, findings: data.oesophagusFindings, notes: data.oesophagusNotes)
            let st = findingLine(normal: data.stomachNormal, findings: data.stomachFindings, notes: data.stomachNotes)
            let du = findingLine(normal: data.duodenumNormal, findings: data.duodenumFindings, notes: data.duodenumNotes)
            y = drawRowSection(ctx: ctx, title: "Findings", rows: [
                ("Oesophagus", oe),
                ("Stomach",    st),
                ("Duodenum",   du),
            ], y: y)

            if data.barretts {
                y = drawRowSection(ctx: ctx, title: "Barrett's — Prague Criteria", rows: [
                    ("C (circumferential)", data.pragueCmC.isEmpty ? "—" : "\(data.pragueCmC) cm"),
                    ("M (maximum)",         data.pragueCmM.isEmpty ? "—" : "\(data.pragueCmM) cm"),
                ], y: y)
            }

            var hp: [(String, String)] = []
            if data.hpTestDone { hp.append(("H. pylori test", data.hpResult)) }
            if data.biopsyTaken { hp.append(("Biopsy sites", data.biopsySites.isEmpty ? data.biopsyNotes : data.biopsySites.joined(separator: ", "))) }
            if !hp.isEmpty { y = drawRowSection(ctx: ctx, title: "H. pylori & Biopsy", rows: hp, y: y) }

            if !data.interventionsDone.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Interventions", body: data.interventionsDone.joined(separator: ", ") + (data.interventionNotes.isEmpty ? "" : "\n\(data.interventionNotes)"), y: y)
            }
            if !data.impression.isEmpty      { y = drawTextSection(ctx: ctx, title: "Impression",       body: data.impression, y: y) }
            if !data.recommendations.isEmpty { y = drawTextSection(ctx: ctx, title: "Recommendations",  body: data.recommendations, y: y) }
            if !data.followUpWeeks.isEmpty   { y = drawTextSection(ctx: ctx, title: "Follow-up",        body: "\(data.followUpWeeks) weeks", y: y) }
            drawFooter()
        }
    }

    // MARK: - Colonoscopy Report

    static func colonoscopyReport(patient: Patient, data: ColonoscopyData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "COLONOSCOPY REPORT")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.dateOfProcedure ?? .now, y: y)

            let bbpsTotal = data.bostonRight + data.bostonTransverse + data.bostonLeft
            var pre: [(String, String)] = [
                ("Indication",     data.indication.isEmpty ? "—" : data.indication.joined(separator: ", ")),
                ("Operator",       data.operator_),
                ("Assistant",      data.assistant),
                ("Consent",        data.consent ? "Obtained" : "Not recorded"),
                ("Colonoscope",    data.colonoscopeModel),
                ("Sedation",       "\(data.sedationUsed)\(data.sedationDose.isEmpty ? "" : " \(data.sedationDose)")"),
                ("Bowel prep",     "\(data.bowelPrepAgent) — \(data.bowelPrepQuality)"),
                ("BBPS",           "\(bbpsTotal)/9 (R:\(data.bostonRight) T:\(data.bostonTransverse) L:\(data.bostonLeft))"),
                ("Extent reached", data.extentReached),
                ("TI intubated",   data.ilealIntubation ? "Yes" : "No"),
                ("Duration",       data.duration.isEmpty ? "—" : "\(data.duration) min"),
                ("Completion",     data.quality),
            ]
            if !data.interventionsDone.isEmpty {
                pre.append(("Interventions", data.interventionsDone.joined(separator: ", ")))
            }
            y = drawRowSection(ctx: ctx, title: "Procedure Details", rows: pre, y: y)

            let segments: [(String, Bool, [String], String)] = [
                ("Rectum",            data.rectumNormal,      data.rectumFindings,      data.rectumNotes),
                ("Sigmoid",           data.sigmoidNormal,     data.sigmoidFindings,     data.sigmoidNotes),
                ("Descending colon",  data.descendingNormal,  data.descendingFindings,  data.descendingNotes),
                ("Splenic flexure",   data.splenicNormal,     data.splenicFindings,     data.splenicNotes),
                ("Transverse colon",  data.transverseNormal,  data.transverseFindings,  data.transverseNotes),
                ("Hepatic flexure",   data.hepaticNormal,     data.hepaticFindings,     data.hepaticNotes),
                ("Ascending colon",   data.ascendingNormal,   data.ascendingFindings,   data.ascendingNotes),
                ("Cecum",             data.cecumNormal,       data.cecumFindings,       data.cecumNotes),
            ]
            let rows = segments.map { (seg, norm, finds, notes) -> (String, String) in
                (seg, findingLine(normal: norm, findings: finds, notes: notes))
            }
            y = drawRowSection(ctx: ctx, title: "Segment Findings", rows: rows, y: y)

            if data.ilealIntubation {
                let ti = findingLine(normal: data.terminalIleumNormal, findings: data.terminalIleumFindings, notes: data.terminalIleumNotes)
                y = drawRowSection(ctx: ctx, title: "Terminal Ileum", rows: [("Findings", ti)], y: y)
            }
            if data.biopsyTaken {
                let sites = data.biopsySites.isEmpty ? data.biopsyNotes : data.biopsySites.joined(separator: ", ")
                y = drawRowSection(ctx: ctx, title: "Biopsies", rows: [("Sites", sites), ("Notes", data.biopsyNotes)], y: y)
            }
            if !data.interventionNotes.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Intervention Notes", body: data.interventionNotes, y: y)
            }
            let comps = data.complications.isEmpty ? "None" : data.complications.joined(separator: ", ")
            y = drawTextSection(ctx: ctx, title: "Complications", body: comps, y: y)
            if !data.impression.isEmpty      { y = drawTextSection(ctx: ctx, title: "Impression",             body: data.impression, y: y) }
            if !data.recommendations.isEmpty { y = drawTextSection(ctx: ctx, title: "Recommendations",        body: data.recommendations, y: y) }
            if !data.surveillance.isEmpty    { y = drawTextSection(ctx: ctx, title: "Surveillance Interval",  body: data.surveillance, y: y) }
            if !data.followUpWeeks.isEmpty   { y = drawTextSection(ctx: ctx, title: "Follow-up",              body: "\(data.followUpWeeks) weeks", y: y) }
            drawFooter()
        }
    }

    // MARK: - ERCP Report

    static func ercpReport(patient: Patient, data: ERCPData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "ERCP REPORT")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.dateOfProcedure ?? .now, y: y)

            var pre: [(String, String)] = [
                ("Indication",     data.indication.isEmpty ? "—" : data.indication.joined(separator: ", ")),
                ("Operator",       data.operator_),
                ("Assistant",      data.assistant),
                ("Consent",        data.consent ? "Obtained" : "Not recorded"),
                ("Duodenoscope",   data.duodenoscope),
                ("Anaesthesia",    data.anaesthesiaType),
                ("Position",       data.position),
                ("Fluoroscopy",    data.fluoroscopy ? "Yes" : "No"),
                ("Contrast",       data.contrastUsed),
                ("Completion",     data.completionStatus),
            ]
            if data.antibiotic { pre.append(("Antibiotic", data.antibioticUsed)) }
            y = drawRowSection(ctx: ctx, title: "Procedure Details", rows: pre, y: y)

            let access: [(String, String)] = [
                ("Ampulla",             data.ampullaAppearance),
                ("Bile duct cannulated",     data.bileDuctCannulated ? "Yes" : "No"),
                ("PD cannulated",            data.pancreaticDuctCannulated ? "Yes" : "No"),
                ("Sphincterotomy",           data.sphincterotomy ? data.sphincterotomyType : "No"),
                ("Pre-cut",                  data.precut ? data.precutType : "No"),
            ]
            y = drawRowSection(ctx: ctx, title: "Duct Access", rows: access, y: y)

            if data.cholangiogramDone {
                var cbd: [(String, String)] = [
                    ("CBD diameter", data.cbdDiameter.isEmpty ? "—" : "\(data.cbdDiameter) mm"),
                    ("Findings",     data.cbdFindings.isEmpty ? "Normal" : data.cbdFindings.joined(separator: ", ")),
                ]
                if data.biliaryStenosis { cbd.append(("Stricture level", data.biliaryStenosisLevel)) }
                y = drawRowSection(ctx: ctx, title: "Cholangiogram (CBD)", rows: cbd, y: y)
            }
            if data.pancreatogramDone {
                y = drawRowSection(ctx: ctx, title: "Pancreatogram (PD)", rows: [
                    ("PD diameter", data.pdDiameter.isEmpty ? "—" : "\(data.pdDiameter) mm"),
                    ("Findings",    data.pdFindings.isEmpty ? "Normal" : data.pdFindings.joined(separator: ", ")),
                ], y: y)
            }
            if data.stoneExtraction {
                y = drawRowSection(ctx: ctx, title: "Stone Extraction", rows: [
                    ("Stone count",  data.stoneCount),
                    ("Largest size", data.stoneSizeMax.isEmpty ? "—" : "\(data.stoneSizeMax) mm"),
                    ("Method",       data.extractionMethod.joined(separator: ", ")),
                    ("Clearance",    data.clearance),
                ], y: y)
            }
            var stents: [(String, String)] = []
            if data.plasticStent { stents.append(("Plastic biliary stent", data.plasticStentSize)) }
            if data.metalStent   { stents.append(("Metal SEMS",             data.metalStentType)) }
            if data.pancreaticStent { stents.append(("Pancreatic stent",    data.pancreaticStentSize)) }
            if !stents.isEmpty { y = drawRowSection(ctx: ctx, title: "Stenting", rows: stents, y: y) }

            if data.brushCytology || data.forcepsBiopsy {
                var tiss: [(String, String)] = []
                if data.brushCytology  { tiss.append(("Brush cytology", data.biopsySite)) }
                if data.forcepsBiopsy  { tiss.append(("Forceps biopsy", data.biopsySite)) }
                y = drawRowSection(ctx: ctx, title: "Tissue Sampling", rows: tiss, y: y)
            }
            let comps = data.complications.isEmpty ? "None" : data.complications.joined(separator: ", ")
            y = drawTextSection(ctx: ctx, title: "Complications", body: comps, y: y)
            y = drawRowSection(ctx: ctx, title: "PEP Prophylaxis", rows: [
                ("PEP risk",            data.pepRisk),
                ("Rectal indomethacin", data.indomethacin ? "Given" : "Not given"),
                ("Prophylactic PD stent", data.pancreaticStentForPEP ? "Yes" : "No"),
            ], y: y)
            if !data.impression.isEmpty      { y = drawTextSection(ctx: ctx, title: "Impression",      body: data.impression, y: y) }
            if !data.recommendations.isEmpty { y = drawTextSection(ctx: ctx, title: "Recommendations", body: data.recommendations, y: y) }
            if !data.followUpWeeks.isEmpty   { _ = drawTextSection(ctx: ctx, title: "Follow-up",       body: "\(data.followUpWeeks) weeks", y: y) }
            drawFooter()
        }
    }

    // MARK: - Discharge Summary

    static func dischargeSummary(patient: Patient, data: DischargeSummaryData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "DISCHARGE SUMMARY")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.dischargeDate ?? .now, y: y)

            let df = DateFormatter(); df.dateStyle = .medium; df.timeStyle = .none
            var admit: [(String, String)] = []
            if let ad = data.admissionDate  { admit.append(("Admitted",   df.string(from: ad))) }
            if let dd = data.dischargeDate  { admit.append(("Discharged", df.string(from: dd))) }
            if !data.ward.isEmpty           { admit.append(("Ward",       data.ward)) }
            if !data.admittingDoctor.isEmpty{ admit.append(("Admitting doctor", data.admittingDoctor)) }
            if !data.surgeonName.isEmpty    { admit.append(("Surgeon",    data.surgeonName)) }
            y = drawRowSection(ctx: ctx, title: "Admission Details", rows: admit, y: y)

            y = drawRowSection(ctx: ctx, title: "Diagnosis", rows: [
                ("Admission diagnosis",  data.admissionDiagnosis),
                ("Discharge diagnosis",  data.dischargeDiagnosis),
                ("ICD-10 code",          data.icdCode),
            ].filter { !$0.1.isEmpty }, y: y)

            if !data.procedurePerformed.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Procedure(s) Performed", body: data.procedurePerformed, y: y)
            }
            if !data.inHospitalCourse.isEmpty {
                y = drawTextSection(ctx: ctx, title: "In-Hospital Course", body: data.inHospitalCourse, y: y)
            }
            if !data.complicationsInHospital.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Complications", body: data.complicationsInHospital, y: y)
            }
            // Blood products and critical care
            var criticalCare: [(String, String)] = []
            if data.bloodTransfusion {
                criticalCare.append(("Blood transfusion", data.bloodUnits.isEmpty ? "Given" : "\(data.bloodUnits) unit(s)"))
            }
            if data.ituAdmission {
                criticalCare.append(("ITU / HDU admission", data.ituDays.isEmpty ? "Yes" : "\(data.ituDays) day(s)"))
            }
            if !criticalCare.isEmpty {
                y = drawRowSection(ctx: ctx, title: "Critical Care", rows: criticalCare, y: y)
            }
            if !data.pathologyResults.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Pathology Results", body: data.pathologyResults, y: y)
            }
            if !data.imagingResults.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Imaging Results", body: data.imagingResults, y: y)
            }
            if !data.dischargeMedications.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Discharge Medications", body: data.dischargeMedications, y: y)
            }
            var discharge: [(String, String)] = [
                ("Destination",   data.dischargeDestination),
                ("Mobility",      data.mobileStatus),
                ("VTE assessment", data.vteAssessment),
            ]
            if data.vteProphylaxisGiven {
                discharge.append(("VTE prophylaxis", "\(data.vteProphylaxisAgent) × \(data.vteProphylaxisDuration)"))
            }
            y = drawRowSection(ctx: ctx, title: "Discharge Status", rows: discharge, y: y)

            if !data.woundCare.isEmpty  { y = drawTextSection(ctx: ctx, title: "Wound Care", body: data.woundCare, y: y) }
            if data.drainInSitu && !data.drainType.isEmpty {
                let drainLine = "Type: \(data.drainType)" + (data.drainRemovalDate.map { " · Remove: \(df.string(from: $0))" } ?? "")
                y = drawTextSection(ctx: ctx, title: "Drain In Situ", body: drainLine, y: y)
            }
            if !data.activityRestrictions.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Activity Restrictions", body: data.activityRestrictions, y: y)
            }
            if !data.returnPrecautions.isEmpty {
                let prec = (data.returnPrecautions + (data.returnPrecautionsOther.isEmpty ? [] : [data.returnPrecautionsOther])).joined(separator: "\n• ")
                y = drawTextSection(ctx: ctx, title: "Return Precautions", body: "• " + prec, y: y)
            }
            if !data.followUpAppointment.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Follow-up", body: data.followUpAppointment, y: y)
            }
            if data.gpNotified && !data.gpName.isEmpty {
                y = drawTextSection(ctx: ctx, title: "GP Notification", body: "GP notified: \(data.gpName)", y: y)
            }
            if !data.additionalNotes.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Additional Notes", body: data.additionalNotes, y: y)
            }
            drawSignatureBlock(ctx: ctx, surgeon: data.surgeonName, y: y)
            drawFooter()
        }
    }

    // MARK: - Post-op Review

    static func postOpReview(patient: Patient, data: PostOpReviewData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "POST-OPERATIVE REVIEW")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.reviewDate ?? .now, y: y)

            let df = DateFormatter(); df.dateStyle = .medium
            var header: [(String, String)] = [
                ("Review date",  data.reviewDate.map { df.string(from: $0) } ?? "—"),
                ("Post-op day",  "Day \(data.postOpDay)"),
                ("Reviewed by",  data.reviewedBy),
            ]
            if !data.procedure.isEmpty { header.append(("Procedure", data.procedure)) }
            y = drawRowSection(ctx: ctx, title: "Review Details", rows: header, y: y)

            var symptoms: [(String, String)] = [
                ("Pain (VAS 0–10)", "\(data.pain)/10"),
            ]
            let syms = [data.nausea ? "Nausea" : nil, data.vomiting ? "Vomiting" : nil,
                        data.fever ? "Fever" : nil, data.dyspnoea ? "Dyspnoea" : nil].compactMap { $0 }
            symptoms.append(("Symptoms", syms.isEmpty ? "None" : syms.joined(separator: ", ")))
            y = drawRowSection(ctx: ctx, title: "Symptoms", rows: symptoms, y: y)

            if data.woundInspected {
                var wound: [(String, String)] = [("Status", data.woundStatus)]
                if !data.woundFindings.isEmpty { wound.append(("Findings", data.woundFindings.joined(separator: ", "))) }
                if !data.woundNotes.isEmpty    { wound.append(("Notes", data.woundNotes)) }
                y = drawRowSection(ctx: ctx, title: "Wound Assessment", rows: wound, y: y)
            }
            let gi: [(String, String)] = [
                ("Flatus", data.flatus ? "Yes" : "No"),
                ("Bowels open", data.bowelsOpen ? "Yes" : "No"),
                ("Diet tolerance", data.toleratingDiet ? data.dietType : "Nil/Not tolerating"),
            ]
            y = drawRowSection(ctx: ctx, title: "GI Recovery", rows: gi, y: y)

            if !data.assessment.isEmpty { y = drawTextSection(ctx: ctx, title: "Assessment", body: data.assessment, y: y) }
            if !data.plan.isEmpty       { y = drawTextSection(ctx: ctx, title: "Plan", body: data.plan, y: y) }
            drawSignatureBlock(ctx: ctx, surgeon: data.reviewedBy, y: y)
            drawFooter()
        }
    }

    // MARK: - Referral Letter

    static func referralLetter(patient: Patient, data: ReferralLetterData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: data.letterType.uppercased())
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.letterDate, y: y)

            let df = DateFormatter(); df.dateStyle = .long
            let dateStr = df.string(from: data.letterDate)
            var header = "\(dateStr)\n\n"
            if !data.toDoctor.isEmpty   { header += "Dear \(data.toDoctor)" + (data.toPractice.isEmpty ? "" : "\n\(data.toPractice)") }
            else                         { header += "To Whom It May Concern" }
            if !data.salutation.isEmpty  { header += "\n\n\(data.salutation)" }
            y = drawTextSection(ctx: ctx, title: nil, body: header, y: y)

            let dob = patient.dateOfBirth.map { DateFormatter.ectDate.string(from: $0) } ?? ""
            let ptLine = "Re: \(patient.fullName), \(patient.sex.rawValue), \(dob)\(patient.mrn.map { " (MRN: \($0))" } ?? "")"
            y = drawTextSection(ctx: ctx, title: nil, body: ptLine, y: y)

            if !data.patientBackground.isEmpty   { y = drawTextSection(ctx: ctx, title: "Background",              body: data.patientBackground, y: y) }
            if !data.presentingComplaint.isEmpty { y = drawTextSection(ctx: ctx, title: "Presenting Complaint",    body: data.presentingComplaint, y: y) }
            if !data.clinicalFindings.isEmpty    { y = drawTextSection(ctx: ctx, title: "Clinical Findings",       body: data.clinicalFindings, y: y) }
            if !data.investigationsOrdered.isEmpty { y = drawTextSection(ctx: ctx, title: "Investigations",        body: data.investigationsOrdered, y: y) }
            if !data.managementToDate.isEmpty    { y = drawTextSection(ctx: ctx, title: "Management to Date",      body: data.managementToDate, y: y) }
            if !data.diagnosis.isEmpty           { y = drawTextSection(ctx: ctx, title: "Diagnosis",               body: data.diagnosis, y: y) }
            if !data.requestedAction.isEmpty     { y = drawTextSection(ctx: ctx, title: "Request",                 body: data.requestedAction, y: y) }

            let closingText = (data.closingNote.isEmpty ? "Thank you for your kind review of this patient." : data.closingNote)
            y = drawTextSection(ctx: ctx, title: nil, body: closingText, y: y)

            // Professional letter closing with signature line
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 80)
            let closingLabel: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 8.5),
                .foregroundColor: UIColor.label,
            ]
            "Yours sincerely,".draw(at: CGPoint(x: lm, y: y), withAttributes: closingLabel)
            y += 20
            // Blank signature line
            teal.withAlphaComponent(0.4).setFill()
            UIRectFill(CGRect(x: lm, y: y + 20, width: 220, height: 0.5))
            y += 30
            let sigName: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                .foregroundColor: UIColor.label,
            ]
            let sigSub: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 8),
                .foregroundColor: UIColor.secondaryLabel,
            ]
            data.fromDoctor.draw(at: CGPoint(x: lm, y: y), withAttributes: sigName)
            y += 14
            data.fromPractice.draw(at: CGPoint(x: lm, y: y), withAttributes: sigSub)
            y += 12
            if !data.copyTo.isEmpty {
                y += 8
                "cc: \(data.copyTo)".draw(in: CGRect(x: lm, y: y, width: bodyW, height: 12),
                                          withAttributes: sigSub)
            }
            drawFooter()
        }
    }

    // MARK: - Shared drawing helpers

    @discardableResult
    private static func drawHeader(type: String) -> CGFloat {
        let h: CGFloat = 88
        // Full-width teal bar
        teal.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: page.width, height: h))

        // LEFT — "AMISE" brand mark (large, bold, tracked)
        let amiseAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 22, weight: .black),
            .foregroundColor: UIColor.white,
            .kern: 4,
        ]
        "AMISE".draw(at: CGPoint(x: lm, y: 8), withAttributes: amiseAttrs)

        // LEFT — "Amise Medical Services" subtitle
        "Amise Medical Services".draw(
            in: CGRect(x: lm, y: 34, width: 230, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.92)])

        // LEFT — surgeon + specialty
        "Dr Dawit Daniel Kabiye  MD · DM  ·  General & Endoscopic Surgery".draw(
            in: CGRect(x: lm, y: 50, width: 330, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.78)])

        // RIGHT — practice contact block
        let rightX = page.width - lm - 160
        "Amise Medical Services".draw(
            in: CGRect(x: rightX, y: 18, width: 160, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.90)])
        "Saint Lucia, West Indies".draw(
            in: CGRect(x: rightX, y: 31, width: 160, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.72)])
        "+1 758 284 0557  ·  amisemedical.com".draw(
            in: CGRect(x: rightX, y: 43, width: 160, height: 11),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.72)])

        // Separator line
        UIColor.white.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: 0, y: h - 20, width: page.width, height: 0.5))

        // Document type label on the separator baseline
        type.draw(
            in: CGRect(x: lm, y: h - 17, width: page.width - lm * 2, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                             .foregroundColor: UIColor.white.withAlphaComponent(0.88),
                             .kern: 1.5])

        return h
    }

    /// Draws a signature block for the authorising clinician.
    /// Returns the Y position after the block.
    @discardableResult
    private static func drawSignatureBlock(ctx: UIGraphicsPDFRendererContext,
                                           surgeon: String, y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 110)
        y += 8
        y = drawSectionHeader(title: "Authorising Clinician", y: y)

        let df = DateFormatter()
        df.dateStyle = .long; df.timeStyle = .short

        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8, weight: .semibold),
            .foregroundColor: UIColor.secondaryLabel,
        ]
        let nameAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9),
            .foregroundColor: UIColor.label,
        ]
        let disclaimerAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.italicSystemFont(ofSize: 6.5),
            .foregroundColor: UIColor.tertiaryLabel,
        ]

        // Signature line
        "Signature:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        teal.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: lm + 62, y: y + 10, width: 220, height: 0.5))
        y += 18

        // Name printed
        "Name:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        surgeon.draw(in: CGRect(x: lm + 62, y: y, width: 280, height: 13), withAttributes: nameAttrs)
        y += 16

        // Date signed
        "Date / Time:".draw(at: CGPoint(x: lm, y: y), withAttributes: labelAttrs)
        teal.withAlphaComponent(0.4).setFill()
        UIRectFill(CGRect(x: lm + 62, y: y + 10, width: 220, height: 0.5))
        y += 18

        // AI disclaimer
        "This document was prepared with AI-assisted clinical software. The clinician's signature above confirms review and approval of the content.".draw(
            in: CGRect(x: lm, y: y, width: bodyW, height: 20),
            withAttributes: disclaimerAttrs)
        y += 18
        return y + 6
    }

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

    @discardableResult
    private static func drawPatientStrip(patient: Patient, y: CGFloat) -> CGFloat {
        let h: CGFloat = 34
        teal.withAlphaComponent(0.1).setFill()
        UIRectFill(CGRect(x: 0, y: y, width: page.width, height: h))
        let dob = patient.dateOfBirth.map { DateFormatter.ectDate.string(from: $0) } ?? ""
        let parts = [patient.fullName,
                     "\(patient.sex.rawValue)\(patient.ageYears > 0 ? ", \(patient.ageYears)y" : "")",
                     dob, patient.mrn.map { "MRN \($0)" } ?? ""].filter { !$0.isEmpty }
        parts.joined(separator: "   ·   ").draw(
            in: CGRect(x: lm, y: y + 10, width: bodyW, height: 16),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9.5, weight: .medium), .foregroundColor: UIColor.label])
        return y + h + 4
    }

    @discardableResult
    private static func drawMeta(date: Date, y: CGFloat) -> CGFloat {
        let str = DateFormatter.ectLong.string(from: date) + " ECT   ·   Amise Medical Services, Saint Lucia"
        str.draw(in: CGRect(x: lm, y: y, width: bodyW, height: 13),
                 withAttributes: [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.secondaryLabel])
        let rule = y + 14
        teal.withAlphaComponent(0.25).setFill()
        UIRectFill(CGRect(x: lm, y: rule, width: bodyW, height: 0.5))
        return rule + 10
    }

    @discardableResult
    private static func drawRowSection(ctx: UIGraphicsPDFRendererContext, title: String,
                                       rows: [(String, String)], y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
        if !title.isEmpty { y = drawSectionHeader(title: title, y: y) }
        for (label, value) in rows where !value.isEmpty {
            y = maybeNewPage(ctx: ctx, y: y, minSpace: 18)
            label.draw(in: CGRect(x: lm, y: y, width: 140, height: 13),
                       withAttributes: [.font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
                                        .foregroundColor: UIColor.secondaryLabel])
            let valRect = CGRect(x: lm + 148, y: y, width: bodyW - 148, height: 500)
            let valAttrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5), .foregroundColor: UIColor.label]
            let boundingRect = value.boundingRect(with: valRect.size, options: .usesLineFragmentOrigin, attributes: valAttrs, context: nil)
            let lineH = max(13, boundingRect.height + 2)
            value.draw(in: CGRect(x: lm + 148, y: y, width: bodyW - 148, height: lineH), withAttributes: valAttrs)
            y += lineH + 3
        }
        return y + 6
    }

    @discardableResult
    private static func drawTextSection(ctx: UIGraphicsPDFRendererContext, title: String?,
                                        body: String, y: CGFloat) -> CGFloat {
        var y = maybeNewPage(ctx: ctx, y: y, minSpace: 40)
        if let title { y = drawSectionHeader(title: title, y: y) }
        let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8.5), .foregroundColor: UIColor.label]
        let boundingH = body.boundingRect(with: CGSize(width: bodyW, height: 3000),
                                          options: .usesLineFragmentOrigin, attributes: attrs, context: nil).height
        let textH = ceil(boundingH) + 4
        if y + textH > page.height - 60 {
            ctx.beginPage(); y = 40
        }
        body.draw(in: CGRect(x: lm, y: y, width: bodyW, height: textH), withAttributes: attrs)
        return y + textH + 8
    }

    @discardableResult
    private static func drawSectionHeader(title: String, y: CGFloat) -> CGFloat {
        teal.withAlphaComponent(0.08).setFill()
        UIRectFill(CGRect(x: lm - 4, y: y, width: bodyW + 8, height: 16))
        title.uppercased().draw(
            in: CGRect(x: lm, y: y + 2, width: bodyW, height: 12),
            withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .bold),
                             .foregroundColor: teal])
        return y + 20
    }

    private static func drawFooter() {
        let txt = "Amise Medical Services · Dr Dawit Daniel Kabiye MD DM · Saint Lucia · Confidential clinical document"
        teal.withAlphaComponent(0.15).setFill()
        UIRectFill(CGRect(x: 0, y: page.height - 26, width: page.width, height: 26))
        txt.draw(in: CGRect(x: lm, y: page.height - 18, width: bodyW, height: 12),
                 withAttributes: [.font: UIFont.systemFont(ofSize: 6.5), .foregroundColor: UIColor.secondaryLabel])
    }

    private static func maybeNewPage(ctx: UIGraphicsPDFRendererContext, y: CGFloat, minSpace: CGFloat = 60) -> CGFloat {
        if y > page.height - minSpace - 30 { ctx.beginPage(); return 40 }
        return y
    }

    private static func findingLine(normal: Bool, findings: [String], notes: String) -> String {
        if normal { return "Normal" }
        var parts: [String] = findings.isEmpty ? [] : [findings.joined(separator: ", ")]
        if !notes.isEmpty { parts.append(notes) }
        return parts.isEmpty ? "Abnormal (no details)" : parts.joined(separator: " — ")
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

    private static func checklistSignInComplete(_ d: PreOpChecklistData) -> Bool {
        d.si_identityConfirmed && d.si_siteProcedureConfirmed && d.si_consentConfirmed &&
        (d.si_siteMarked || d.si_siteMarkingNA) &&
        d.si_anaesthesiaCheckComplete && d.si_pulseOxFunctioning && d.si_timeRecorded
    }

    private static func checklistTimeOutComplete(_ d: PreOpChecklistData) -> Bool {
        d.to_teamIntroduced && d.to_patientSiteProcedureConfirmed &&
        d.to_surgeonCriticalSteps && d.to_anaesthesiaConcerns && d.to_nursingEquipmentReady &&
        (d.to_antibioticGiven || d.to_antibioticNA) &&
        (d.to_imagingDisplayed || d.to_imagingNA) && d.to_timeRecorded
    }

    private static func checklistSignOutComplete(_ d: PreOpChecklistData) -> Bool {
        d.so_procedureDocumented && d.so_instrumentCountCorrect &&
        d.so_spongeCountCorrect && d.so_needleCountCorrect &&
        (d.so_specimenLabelled || d.so_specimenNA) && d.so_timeRecorded
    }

    private static func drawPhaseHeader(ctx: UIGraphicsPDFRendererContext,
                                        title: String, subtitle: String,
                                        complete: Bool, y: CGFloat) -> CGFloat {
        let bg: UIColor = complete ? UIColor.systemGreen.withAlphaComponent(0.12)
                                   : UIColor.systemOrange.withAlphaComponent(0.10)
        bg.setFill()
        UIRectFill(CGRect(x: lm - 4, y: y, width: bodyW + 8, height: 22))
        let badge = complete ? "✓ COMPLETE" : "PENDING"
        let badgeColor: UIColor = complete ? .systemGreen : .systemOrange
        title.draw(in: CGRect(x: lm, y: y + 3, width: bodyW - 80, height: 14),
                   withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .bold),
                                    .foregroundColor: UIColor.label])
        badge.draw(in: CGRect(x: lm + bodyW - 74, y: y + 3, width: 74, height: 14),
                   withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                                    .foregroundColor: badgeColor])
        subtitle.draw(in: CGRect(x: lm, y: y + 13, width: bodyW, height: 11),
                      withAttributes: [.font: UIFont.italicSystemFont(ofSize: 7),
                                       .foregroundColor: UIColor.secondaryLabel])
        return y + 28
    }

    @discardableResult
    private static func drawChecklistItems(ctx: UIGraphicsPDFRendererContext,
                                           items: [(Bool, String)], y: CGFloat) -> CGFloat {
        var y = y
        for (checked, label) in items {
            y = drawChecklistItem(ctx: ctx, checked: checked, label: label, accent: false, y: y)
        }
        return y + 4
    }

    @discardableResult
    private static func drawChecklistItem(ctx: UIGraphicsPDFRendererContext,
                                          checked: Bool, label: String,
                                          accent: Bool, y: CGFloat) -> CGFloat {
        let y = maybeNewPage(ctx: ctx, y: y, minSpace: 20)
        let symbol = checked ? "☑" : "☐"
        let symColor: UIColor = checked ? (accent ? .systemOrange : teal) : .secondaryLabel
        symbol.draw(at: CGPoint(x: lm, y: y),
                    withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .medium),
                                     .foregroundColor: symColor])
        label.draw(in: CGRect(x: lm + 14, y: y, width: bodyW - 14, height: 14),
                   withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                                    .foregroundColor: UIColor.label])
        return y + 14
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

    @discardableResult
    private static func patientSection(ctx: UIGraphicsPDFRendererContext,
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

    @discardableResult
    private static func patientBody(ctx: UIGraphicsPDFRendererContext,
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
