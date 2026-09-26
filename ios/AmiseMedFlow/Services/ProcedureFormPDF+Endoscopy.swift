// ProcedureFormPDF+Endoscopy.swift
// OGD, colonoscopy, ERCP and bronchoscopy report PDF generators

import UIKit

extension ProcedureFormPDF {


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


    // MARK: - Bronchoscopy Report

    static func bronchoscopyReport(patient: Patient, data: BronchoscopyData) -> Data {
        UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            var y = drawHeader(type: "FLEXIBLE BRONCHOSCOPY REPORT")
            y = drawPatientStrip(patient: patient, y: y)
            y = drawMeta(date: data.dateOfProcedure ?? .now, y: y)

            let pre: [(String, String)] = [
                ("Indication",  data.indication.isEmpty ? "—" : data.indication.joined(separator: ", ")),
                ("Operator",    data.operator_),
                ("Assistant",   data.assistant),
                ("Consent",     data.consent ? "Obtained" : "Not recorded"),
                ("Bronchoscope",data.bronchoscopeModel),
                ("Approach",    data.approach),
                ("Sedation",    data.sedationUsed),
                ("O₂ support",  data.oxygenSupplementation),
                ("Duration",    data.duration.isEmpty ? "—" : "\(data.duration) min"),
                ("Quality",     data.quality),
                ("Completion",  data.completionStatus),
            ]
            y = drawRowSection(ctx: ctx, title: "Procedure Details", rows: pre, y: y)

            // Upper airway
            var upper: [(String, String)] = []
            upper.append(("Nasopharynx",  findingLine(normal: data.nasopharynxNormal,  findings: [], notes: data.nasopharynxNotes)))
            upper.append(("Larynx",       findingLine(normal: data.larynxNormal,       findings: [], notes: data.larynxNotes)))
            let vcFindings = data.vocalCordsFindings.isEmpty ? [] : data.vocalCordsFindings
            upper.append(("Vocal cords",  findingLine(normal: data.vocalCordsNormal,   findings: vcFindings, notes: data.vocalCordsNotes)))
            y = drawRowSection(ctx: ctx, title: "Upper Airway", rows: upper, y: y)

            // Trachea & carina
            let trFindings = data.tracheaFindings.isEmpty ? [] : data.tracheaFindings
            let caFindings = data.carinaFindings.isEmpty  ? [] : data.carinaFindings
            y = drawRowSection(ctx: ctx, title: "Trachea & Carina", rows: [
                ("Trachea", findingLine(normal: data.tracheaNormal,  findings: trFindings, notes: data.tracheaNotes)),
                ("Carina",  findingLine(normal: data.carinaNormal,   findings: caFindings, notes: data.carinaNotes)),
            ], y: y)

            // Right bronchial tree
            let ruFindings = data.rightUpperLobeFindings.isEmpty ? [] : data.rightUpperLobeFindings
            let rmFindings = data.rightMiddleLobeFindings.isEmpty ? [] : data.rightMiddleLobeFindings
            let rlFindings = data.rightLowerLobeFindings.isEmpty ? [] : data.rightLowerLobeFindings
            y = drawRowSection(ctx: ctx, title: "Right Bronchial Tree", rows: [
                ("Right main",          findingLine(normal: data.rightMainNormal,       findings: [], notes: data.rightMainNotes)),
                ("Right upper lobe",    findingLine(normal: data.rightUpperLobeNormal,  findings: ruFindings, notes: data.rightUpperLobeNotes)),
                ("Right middle lobe",   findingLine(normal: data.rightMiddleLobeNormal, findings: rmFindings, notes: data.rightMiddleLobeNotes)),
                ("Right lower lobe",    findingLine(normal: data.rightLowerLobeNormal,  findings: rlFindings, notes: data.rightLowerLobeNotes)),
            ], y: y)

            // Left bronchial tree
            let luFindings = data.leftUpperLobeFindings.isEmpty ? [] : data.leftUpperLobeFindings
            let llFindings = data.leftLowerLobeFindings.isEmpty ? [] : data.leftLowerLobeFindings
            y = drawRowSection(ctx: ctx, title: "Left Bronchial Tree", rows: [
                ("Left main",           findingLine(normal: data.leftMainNormal,        findings: [], notes: data.leftMainNotes)),
                ("Left upper lobe",     findingLine(normal: data.leftUpperLobeNormal,   findings: luFindings, notes: data.leftUpperLobeNotes)),
                ("Left lower lobe",     findingLine(normal: data.leftLowerLobeNormal,   findings: llFindings, notes: data.leftLowerLobeNotes)),
            ], y: y)

            // Specimens
            var spec: [(String, String)] = []
            if data.balPerformed  { spec.append(("BAL", "Performed — site: \(data.balSite.isEmpty ? "not specified" : data.balSite)")) }
            if data.biopsyTaken   { spec.append(("Biopsy", data.biopsyNotes.isEmpty ? "Taken" : data.biopsyNotes)) }
            if !spec.isEmpty { y = drawRowSection(ctx: ctx, title: "Specimens", rows: spec, y: y) }

            if !data.interventionsDone.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Interventions",
                    body: data.interventionsDone.joined(separator: ", "), y: y)
            }
            let comps = data.complications.isEmpty ? "None" : data.complications.joined(separator: ", ")
            y = drawTextSection(ctx: ctx, title: "Complications", body: comps, y: y)
            if !data.impression.isEmpty      { y = drawTextSection(ctx: ctx, title: "Impression",      body: data.impression,      y: y) }
            if !data.recommendations.isEmpty { y = drawTextSection(ctx: ctx, title: "Recommendations", body: data.recommendations, y: y) }
            if !data.followUpWeeks.isEmpty   { y = drawTextSection(ctx: ctx, title: "Follow-up",       body: "\(data.followUpWeeks) weeks", y: y) }
            y = drawSignatureBlock(ctx: ctx, surgeon: data.operator_.isEmpty ? PracticeProfile.current.clinicianName : data.operator_, y: y)
            _ = y
            drawFooter()
        }
    }

}
