// ProcedureFormPDF+ClinicalNotes.swift
// Operative note, discharge summary, post-op review and referral letter PDF generators

import UIKit

extension ProcedureFormPDF {


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
            if !data.anaesthetistName.isEmpty { admit.append(("Anaesthetist", data.anaesthetistName)) }
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
            if !data.dietaryAdvice.isEmpty {
                y = drawTextSection(ctx: ctx, title: "Dietary Advice", body: data.dietaryAdvice, y: y)
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
            if data.drainPresent {
                var drain: [(String, String)] = [("Output", data.drainOutput.isEmpty ? "—" : data.drainOutput),
                                                  ("Fluid character", data.drainFluid)]
                if data.drainRemoved { drain.append(("Status", "Removed today")) }
                y = drawRowSection(ctx: ctx, title: "Drain", rows: drain, y: y)
            }

            let gi: [(String, String)] = [
                ("Flatus", data.flatus ? "Yes" : "No"),
                ("Bowels open", data.bowelsOpen ? "Yes" : "No"),
                ("Diet tolerance", data.toleratingDiet ? data.dietType : "Nil/Not tolerating"),
                ("Nausea/vomiting", data.nauseaVomiting ? "Present" : "Absent"),
            ]
            y = drawRowSection(ctx: ctx, title: "GI Recovery", rows: gi, y: y)

            var urinary: [(String, String)] = []
            if data.urinaryCatheter {
                urinary.append(("Catheter", data.catheterRemoved ? "Removed today" : "In situ"))
                if !data.urineOutput.isEmpty { urinary.append(("Urine output", data.urineOutput)) }
            } else {
                urinary.append(("Catheter", "Not in situ"))
            }
            y = drawRowSection(ctx: ctx, title: "Urinary", rows: urinary, y: y)

            let mob: [(String, String)] = [
                ("Mobilising", data.mobilising ? "Yes" : "No"),
                ("Physiotherapy", data.physioSeen ? "Seen today" : "Not seen"),
                ("DVT prophylaxis", data.dvtProphylaxisGiven ? "Given" : "Not given"),
                ("TEDs", data.teds ? "Applied" : "Not applied"),
            ]
            y = drawRowSection(ctx: ctx, title: "Mobility & VTE", rows: mob, y: y)

            let vitals: [(String, String)] = [
                ("Temperature", data.tempNormal ? "Normal" : "Abnormal"),
                ("Blood pressure", data.bpNormal ? "Normal" : "Abnormal"),
                ("Heart rate", data.hrNormal ? "Normal" : "Abnormal"),
                ("NEWS2 score", data.news2.isEmpty ? "Not recorded" : data.news2),
            ]
            y = drawRowSection(ctx: ctx, title: "Observations", rows: vitals, y: y)
            if !data.vitalsNotes.isEmpty { y = drawTextSection(ctx: ctx, title: "Observations Notes", body: data.vitalsNotes, y: y) }

            if !data.labsOrdered.isEmpty || !data.labNotes.isEmpty {
                var labs: [(String, String)] = []
                if !data.labsOrdered.isEmpty { labs.append(("Investigations ordered", data.labsOrdered.joined(separator: ", "))) }
                if !data.labNotes.isEmpty    { labs.append(("Notes", data.labNotes)) }
                y = drawRowSection(ctx: ctx, title: "Investigations", rows: labs, y: y)
            }

            if !data.assessment.isEmpty { y = drawTextSection(ctx: ctx, title: "Assessment", body: data.assessment, y: y) }
            if !data.plan.isEmpty       { y = drawTextSection(ctx: ctx, title: "Plan", body: data.plan, y: y) }

            var discharge: [(String, String)] = []
            if let edd = data.expectedDischargeDate { discharge.append(("Expected discharge", df.string(from: edd))) }
            if !data.dischargeBarriers.isEmpty { discharge.append(("Barriers to discharge", data.dischargeBarriers.joined(separator: ", "))) }
            if !discharge.isEmpty { y = drawRowSection(ctx: ctx, title: "Discharge Planning", rows: discharge, y: y) }

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

            // Urgency stamp when not routine
            if !data.urgency.isEmpty && data.urgency.lowercased() != "routine" {
                let urgencyAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 9, weight: .bold),
                    .foregroundColor: UIColor.systemOrange,
                ]
                "URGENCY: \(data.urgency.uppercased())".draw(at: CGPoint(x: lm, y: y), withAttributes: urgencyAttr)
                y += 14
            }

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

}
