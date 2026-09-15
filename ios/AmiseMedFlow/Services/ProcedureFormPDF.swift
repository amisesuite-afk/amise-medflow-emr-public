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

            var access: [(String, String)] = [
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
                _ = drawTextSection(ctx: ctx, title: "GP Notification", body: "GP notified: \(data.gpName)", y: y)
            }
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
            var gi: [(String, String)] = [
                ("Flatus", data.flatus ? "Yes" : "No"),
                ("Bowels open", data.bowelsOpen ? "Yes" : "No"),
                ("Diet tolerance", data.toleratingDiet ? data.dietType : "Nil/Not tolerating"),
            ]
            y = drawRowSection(ctx: ctx, title: "GI Recovery", rows: gi, y: y)

            if !data.assessment.isEmpty { y = drawTextSection(ctx: ctx, title: "Assessment", body: data.assessment, y: y) }
            if !data.plan.isEmpty       { _ = drawTextSection(ctx: ctx, title: "Plan", body: data.plan, y: y) }
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

            let closing = (data.closingNote.isEmpty ? "Thank you for your kind review of this patient." : data.closingNote)
                + "\n\nYours sincerely,\n\n\(data.fromDoctor)\n\(data.fromPractice)"
            if !data.copyTo.isEmpty { _ = drawTextSection(ctx: ctx, title: nil, body: closing + "\n\ncc: \(data.copyTo)", y: y) }
            else                     { _ = drawTextSection(ctx: ctx, title: nil, body: closing, y: y) }
            drawFooter()
        }
    }

    // MARK: - Shared drawing helpers

    @discardableResult
    private static func drawHeader(type: String) -> CGFloat {
        let h: CGFloat = 56
        teal.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: page.width, height: h))
        "Amise Medical Services".draw(
            in: CGRect(x: lm, y: 10, width: page.width - lm - 120, height: 22),
            withAttributes: [.font: UIFont.systemFont(ofSize: 16, weight: .bold), .foregroundColor: UIColor.white])
        type.draw(
            in: CGRect(x: lm, y: 32, width: page.width - lm - 120, height: 14),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9, weight: .medium), .foregroundColor: UIColor.white.withAlphaComponent(0.8)])
        "Dr Dawit Daniel Kabiye MD DM".draw(
            in: CGRect(x: page.width - 175, y: 20, width: 143, height: 16),
            withAttributes: [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.white.withAlphaComponent(0.85)])
        return h
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
        y = drawSectionHeader(title: title, y: y)
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
}
