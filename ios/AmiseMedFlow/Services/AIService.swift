import Foundation

// MARK: - Anthropic Claude API integration for clinical AI assistance

@MainActor
final class AIService: ObservableObject {
    @Published var isGenerating = false
    @Published var error: String?

    private let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!

    // MARK: - Generic generation

    func generate(systemPrompt: String, userMessage: String) async throws -> String {
        isGenerating = true
        error = nil
        defer { isGenerating = false }

        let body: [String: Any] = [
            "model": AppConfig.anthropicModel,
            "max_tokens": 1500,
            "system": systemPrompt,
            "messages": [["role": "user", "content": userMessage]]
        ]

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(AppConfig.anthropicAPIKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AIError.apiError(msg)
        }

        let decoded = try JSONDecoder().decode(AnthropicResponse.self, from: data)
        return decoded.content.first?.text ?? ""
    }

    // MARK: - Clinical context builder

    func clinicalContext(_ patient: Patient) -> String {
        var lines: [String] = []
        lines.append("Patient: \(patient.fullName), \(patient.ageYears)y, \(patient.sex.rawValue)")
        lines.append("Setting: \(patient.setting.rawValue) — \(patient.location.rawValue)")
        if let cc = patient.chiefComplaint { lines.append("Chief complaint: \(cc)") }
        if let dx = patient.workingDiagnosis {
            lines.append("Working diagnosis: \(dx)\(patient.workingDiagnosisICD.map { " (\($0))" } ?? "")")
        }
        if let hpi = patient.hpi, !hpi.isEmpty { lines.append("HPI: \(hpi)") }
        if let pmh = patient.pmhNotes, !pmh.isEmpty { lines.append("Past medical history: \(pmh)") }
        if let sx = patient.surgicalHistory, !sx.isEmpty { lines.append("Surgical history: \(sx)") }
        if let fh = patient.familyHistoryNotes, !fh.isEmpty { lines.append("Family history: \(fh)") }
        if let social = patient.socialHistory, !social.isEmpty { lines.append("Social history: \(social)") }

        let allergies = patient.allergies
        if allergies.isEmpty {
            lines.append("Allergies: None documented")
        } else {
            let list = allergies.map { "\($0.name) (\($0.reaction), \($0.severity))" }.joined(separator: "; ")
            lines.append("ALLERGIES: \(list)")
        }

        let rxs = patient.prescriptions
        if !rxs.isEmpty {
            lines.append("Active medications: \(rxs.map { $0.displayLine }.joined(separator: ", "))")
        }

        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            var vLine = "Latest vitals: NEWS2 \(v.news2Score) (\(v.news2Risk))"
            if let bp = v.bpString { vLine += ", BP \(bp) mmHg" }
            if let hr = v.heartRate { vLine += ", HR \(hr) bpm" }
            if let temp = v.temperatureCelsius { vLine += String(format: ", Temp %.1f°C", temp) }
            if let spo = v.spo2 { vLine += ", SpO₂ \(spo)%" }
            lines.append(vLine)
        }

        let examParts: [(String, String?)] = [
            ("General", patient.examGeneral), ("CVS", patient.examCVS),
            ("Resp", patient.examResp), ("Abdomen", patient.examAbdo), ("Neuro", patient.examNeuro)
        ]
        let examFilled = examParts.compactMap { label, val -> String? in
            guard let v = val, !v.isEmpty else { return nil }
            return "\(label): \(v)"
        }
        if !examFilled.isEmpty {
            lines.append("Examination: \(examFilled.joined(separator: "; "))")
        }

        let invs = patient.investigations
        if !invs.isEmpty {
            let ordered  = invs.filter { $0.status == .ordered || $0.status == .pending }.map { $0.name }
            let resulted = invs.filter { $0.status == .resulted }
                               .map { "\($0.name): \($0.result.isEmpty ? "result pending" : $0.result)" }
            if !ordered.isEmpty  { lines.append("Investigations ordered: \(ordered.joined(separator: ", "))") }
            if !resulted.isEmpty { lines.append("Investigation results: \(resulted.joined(separator: "; "))") }
        }

        if let assessment = patient.assessmentText, !assessment.isEmpty {
            lines.append("Assessment: \(assessment)")
        }
        if let plan = patient.managementPlan, !plan.isEmpty {
            lines.append("Management plan: \(plan)")
        }

        return lines.joined(separator: "\n")
    }

    // MARK: - Clinical note generation

    func generateSOAP(patient: Patient, noteType: NoteType) async throws -> (s: String, o: String, a: String, p: String) {
        let system = """
        You are a surgical registrar AI assistant to Dr Dawit Daniel Kabiye, MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Generate concise, professional, evidence-based clinical documentation.
        Use British spelling. Be precise and clinically accurate.
        Never fabricate vital signs, investigation results, or operative findings not provided.
        Mark AI-generated content as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Generate a SOAP note (\(noteType.label)) for this patient:
        \(clinicalContext(patient))

        Return JSON: {"s":"...","o":"...","a":"...","p":"..."}
        """
        let raw = try await generate(systemPrompt: system, userMessage: user)
        if let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") {
            let jsonStr = String(raw[start...end])
            if let data = jsonStr.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                return (
                    s: (obj["s"] ?? "") + "\n\n[AI DRAFT — REVIEW BEFORE SIGNING]",
                    o: obj["o"] ?? "",
                    a: obj["a"] ?? "",
                    p: obj["p"] ?? ""
                )
            }
        }
        return (s: raw + "\n\n[AI DRAFT — REVIEW BEFORE SIGNING]", o: "", a: "", p: "")
    }

    func generateFreeText(patient: Patient, noteType: NoteType) async throws -> String {
        let system = """
        You are a surgical registrar AI assistant to Dr Dawit Daniel Kabiye, MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Generate professional surgical documentation. British spelling. Evidence-based.
        Mark output: [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let templates: [NoteType: String] = [
            .operative:      "operative note",
            .endoscopy:      "endoscopy report",
            .discharge:      "discharge summary",
            .consultation:   "consultation letter",
            .referralLetter: "formal referral letter from Dr Dawit Daniel Kabiye MD DM to a specialist colleague"
        ]
        let docType = templates[noteType] ?? "clinical note"
        let user = """
        Generate a \(docType).
        \(clinicalContext(patient))
        \(noteType == .discharge ? "Include: admission reason, treatment given, discharge diagnosis, discharge condition, medications on discharge, follow-up plan, red flag advice to patient." : "")
        \(noteType == .operative ? "Include: surgeon, procedure, anaesthesia type, patient position, findings, technique step-by-step, haemostasis, estimated blood loss, closure, drains, specimens, complications, post-operative instructions." : "")
        \(noteType == .endoscopy ? "Include: procedure, indication, bowel preparation, scope used, insertion, findings by anatomic region (with distances), biopsies/interventions, impression, plan, patient tolerance." : "")
        \(noteType == .referralLetter ? "Format as a formal letter. Include relevant history, examination findings, investigations, current medications, reason for referral, and what you are asking the colleague to do." : "")
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - First-visit consultation letter

    func generateFirstVisitLetter(patient: Patient) async throws -> String {
        let system = """
        You are a surgical registrar AI assistant to Dr Dawit Daniel Kabiye, MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Draft a formal first-visit consultation letter to the referring doctor. British spelling, professional surgical register.
        Mark the letter [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let today = Date.now.formatted(date: .long, time: .omitted)
        let user = """
        Draft a formal first-visit consultation letter for the patient below.
        Date: \(today)
        From: Dr Dawit Daniel Kabiye, MD DM — Consultant General & Endoscopic Surgeon, Amise Medical Services, Saint Lucia

        \(clinicalContext(patient))

        Structure the letter as follows:
        1. Opening — thank referring physician, introduce the patient (name, age, sex)
        2. History of presenting complaint — concise narrative
        3. Past medical and surgical history, medications, allergies
        4. Physical examination findings — by system; note positive and relevant negative findings
        5. Investigations — ordered and any results available
        6. Assessment — working diagnosis with ICD code if known; clinical reasoning
        7. Management plan — what has been started or arranged
        8. Follow-up — proposed review timeframe; when you will write again
        9. Closing — professional sign-off

        Keep to 500–700 words. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    func generateOpNote(patient: Patient, procedure: String, findings: String) async throws -> String {
        let system = """
        You are drafting an operative note for Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon.
        Follow standard operative note format. British spelling. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Write a complete, structured operative note.
        Surgeon: Dr Dawit Daniel Kabiye MD DM
        Procedure: \(procedure)
        Operative findings: \(findings)
        \(clinicalContext(patient))
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - Document / image AI reading

    func summariseDocument(fileName: String, extractedText: String, patient: Patient) async throws -> String {
        let system = """
        You are a surgical registrar reviewing clinical documents for Dr Dawit Daniel Kabiye MD DM.
        Extract and summarise clinically relevant findings. Flag abnormal results, urgent findings, and items requiring action.
        Use British spelling. Be precise.
        """
        let user = """
        Summarise this clinical document in the context of the patient below.
        Document: \(fileName)
        \(clinicalContext(patient))

        Extracted text:
        \(extractedText.prefix(3000))

        Provide:
        1. Key findings (bullet points)
        2. Abnormal / urgent results (flag if critical)
        3. Recommended actions
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - Vision: analyse a photo of a lab/imaging result

    func analyseResultImage(_ imageData: Data, patient: Patient) async throws -> String {
        isGenerating = true
        error = nil
        defer { isGenerating = false }

        let base64 = imageData.base64EncodedString()
        let body: [String: Any] = [
            "model": AppConfig.anthropicModel,
            "max_tokens": 1200,
            "system": """
            You are a clinical assistant reviewing a photographed lab/imaging result for Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
            Extract all result values precisely. Flag any abnormal or critical values.
            Use British spelling. Be concise and clinically accurate.
            """,
            "messages": [[
                "role": "user",
                "content": [
                    [
                        "type": "image",
                        "source": [
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": base64
                        ]
                    ],
                    [
                        "type": "text",
                        "text": """
                        Patient: \(patient.fullName), \(patient.ageYears)y
                        Working diagnosis: \(patient.workingDiagnosis ?? "Not yet set")

                        Extract all result values from this lab/imaging report image.
                        Return JSON:
                        {
                          "testName": "...",
                          "category": "Blood|Imaging|Pathology|Other",
                          "results": "complete extracted result text with values and reference ranges",
                          "abnormal": ["list of abnormal values"],
                          "urgent": true/false,
                          "summary": "1-2 sentence clinical summary"
                        }
                        """
                    ]
                ]
            ]]
        ]

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(AppConfig.anthropicAPIKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AIError.apiError(msg)
        }
        let decoded = try JSONDecoder().decode(AnthropicResponse.self, from: data)
        return decoded.content.first?.text ?? ""
    }

    // MARK: - Referral letter

    func generateReferral(patient: Patient, toSpecialty: String, reason: String) async throws -> String {
        let system = """
        You are writing a formal medical referral letter on behalf of Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Use professional British-Caribbean medical correspondence style. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Write a referral letter to a \(toSpecialty) colleague.
        Reason for referral: \(reason)
        \(clinicalContext(patient))
        Patient DOB: \(patient.dateOfBirth.map { DateFormatter.localizedString(from: $0, dateStyle: .medium, timeStyle: .none) } ?? "Not recorded")
        Format as a formal letter. Include relevant history, examination findings, investigations, current medications, and what you are asking the colleague to do.
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - Clinical reasoning

    func generateClinicalReasoning(patient: Patient) async throws -> String {
        let system = """
        You are a consultant surgical registrar supporting Dr Dawit Daniel Kabiye MD DM, general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Provide concise, evidence-based clinical reasoning. British spelling. Be precise.
        Format your response as:
        1. Clinical Summary (2-3 sentences)
        2. Differential Diagnosis (ranked most to least likely, with brief rationale)
        3. Recommended Investigations (if any gaps remain)
        4. Management Priorities (immediate actions first)
        Mark the response: [AI DRAFT — CLINICIAN REVIEW REQUIRED]
        """
        let user = """
        Provide structured clinical reasoning for this patient:
        \(clinicalContext(patient))
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - Discharge summary

    func generateDischargeSummary(patient: Patient, treatment: String, followUp: String) async throws -> String {
        let system = """
        You are writing a discharge summary for Dr Dawit Daniel Kabiye MD DM.
        Use British spelling. Include all mandatory discharge summary components. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Write a complete discharge summary.
        Treatment provided: \(treatment)
        Follow-up plan: \(followUp)
        \(clinicalContext(patient))
        Ward: \(patient.ward ?? "Not specified")
        Include: admission reason, treatment given, discharge diagnosis, discharge condition, medications on discharge, follow-up plan, red flag advice.
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - Clinical summary document

    func generateClinicalSummary(patient: Patient) async throws -> String {
        let system = """
        You are a surgical registrar producing a structured clinical summary document for Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Write in professional British-Caribbean medical style. British spelling. Be precise and concise.
        Format the document with clear section headings in UPPERCASE followed by a blank line.
        Mark the document footer: [AI DRAFT — CLINICIAN REVIEW AND SIGNATURE REQUIRED]
        Never fabricate clinical data not provided. If a section has no data, write "Not documented."
        """
        let date = DateFormatter.localizedString(from: .now, dateStyle: .long, timeStyle: .short)
        let user = """
        Generate a complete clinical summary document for:
        \(clinicalContext(patient))
        Date: \(date)

        Include these sections (only if data is available):
        - PATIENT DETAILS
        - PRESENTING COMPLAINT
        - HISTORY OF PRESENT ILLNESS
        - PAST MEDICAL & SURGICAL HISTORY
        - MEDICATIONS
        - ALLERGIES
        - EXAMINATION FINDINGS
        - INVESTIGATIONS
        - WORKING DIAGNOSIS
        - MANAGEMENT PLAN
        - FOLLOW-UP

        Keep each section concise. Do not repeat data across sections.
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - Operative technique auto-generation

    struct OperativeTechniqueResult {
        var indication: String
        var findingsIntraoperative: String
        var incision: String
        var procedureDescription: String
        var closure: String
        var postOpOrders: String
    }

    func generateOperativeTechnique(
        patient: Patient,
        procedureName: String,
        position: String,
        anaesthesiaType: String
    ) async throws -> OperativeTechniqueResult {
        let system = """
        You are a consultant surgical registrar generating an operative note template for Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Generate realistic, evidence-based operative note content. British spelling.
        The content MUST be marked as [AI DRAFT — REVIEW BEFORE SIGNING] so the surgeon knows to verify and edit it.
        Never fabricate intraoperative findings — use realistic expected findings for the stated indication.
        """
        let dx = patient.workingDiagnosis ?? patient.chiefComplaint ?? "unspecified"
        let user = """
        Generate an operative note for the following case. Return ONLY a JSON object with these exact keys:
        {
          "indication": "brief clinical indication for the procedure",
          "findingsIntraoperative": "expected intraoperative findings for this diagnosis/procedure",
          "incision": "incision type and location",
          "procedureDescription": "detailed step-by-step operative technique (8-15 numbered steps)",
          "closure": "layer-by-layer closure technique",
          "postOpOrders": "standard post-operative orders and patient instructions"
        }

        Procedure: \(procedureName)
        Diagnosis / indication: \(dx)
        Patient: \(patient.ageYears)y \(patient.sex.rawValue)
        Position: \(position)
        Anaesthesia: \(anaesthesiaType)
        Additional context: \(clinicalContext(patient))

        Each field should be 1-5 concise sentences or numbered steps. Mark each value with [AI DRAFT — REVIEW BEFORE SIGNING] at the end.
        """
        let raw = try await generate(systemPrompt: system, userMessage: user)
        if let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") {
            let jsonStr = String(raw[start...end])
            if let data = jsonStr.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                return OperativeTechniqueResult(
                    indication:              obj["indication"]              ?? "",
                    findingsIntraoperative:  obj["findingsIntraoperative"]  ?? "",
                    incision:                obj["incision"]                ?? "",
                    procedureDescription:    obj["procedureDescription"]    ?? "",
                    closure:                 obj["closure"]                 ?? "",
                    postOpOrders:            obj["postOpOrders"]            ?? ""
                )
            }
        }
        return OperativeTechniqueResult(indication: raw, findingsIntraoperative: "", incision: "", procedureDescription: "", closure: "", postOpOrders: "")
    }

    // MARK: - Endoscopy report auto-generation

    struct EndoscopyReportResult {
        var oesophagusNotes: String
        var stomachNotes: String
        var duodenumNotes: String
        var impression: String
        var recommendations: String
    }

    func generateOGDReport(
        patient: Patient,
        indications: [String],
        indicationOther: String
    ) async throws -> EndoscopyReportResult {
        let system = """
        You are a consultant endoscopist generating an OGD (upper GI endoscopy) report for Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Generate realistic endoscopy findings. British spelling. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        Never invent specific measurements or pathology beyond what is typical for the stated indication.
        """
        let indicationList = (indications + (indicationOther.isEmpty ? [] : [indicationOther])).joined(separator: ", ")
        let dx = patient.workingDiagnosis ?? patient.chiefComplaint ?? "unspecified"
        let user = """
        Generate OGD report findings. Return ONLY a JSON object with these exact keys:
        {
          "oesophagusNotes": "oesophagus macroscopic description",
          "stomachNotes": "stomach macroscopic description",
          "duodenumNotes": "duodenum macroscopic description",
          "impression": "2-4 sentence endoscopic impression",
          "recommendations": "management recommendations and follow-up plan"
        }

        Indication(s): \(indicationList)
        Working diagnosis: \(dx)
        Patient: \(patient.ageYears)y \(patient.sex.rawValue)
        Context: \(clinicalContext(patient))

        Base the findings on what would realistically be seen for these indications. Mark each value with [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let raw = try await generate(systemPrompt: system, userMessage: user)
        if let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") {
            let jsonStr = String(raw[start...end])
            if let data = jsonStr.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                return EndoscopyReportResult(
                    oesophagusNotes: obj["oesophagusNotes"] ?? "",
                    stomachNotes:    obj["stomachNotes"]    ?? "",
                    duodenumNotes:   obj["duodenumNotes"]   ?? "",
                    impression:      obj["impression"]      ?? "",
                    recommendations: obj["recommendations"] ?? ""
                )
            }
        }
        return EndoscopyReportResult(oesophagusNotes: "", stomachNotes: "", duodenumNotes: "", impression: raw, recommendations: "")
    }

    struct ERCPReportResult {
        var impression: String
        var recommendations: String
    }

    func generateERCPReport(
        patient: Patient,
        indications: [String],
        indicationOther: String
    ) async throws -> ERCPReportResult {
        let system = """
        You are a consultant endoscopist generating an ERCP report for Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon / interventional endoscopist, Amise Medical Services, Saint Lucia.
        Generate realistic, evidence-based ERCP report content. British spelling. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let indicationList = (indications + (indicationOther.isEmpty ? [] : [indicationOther])).joined(separator: ", ")
        let dx = patient.workingDiagnosis ?? patient.chiefComplaint ?? "unspecified"
        let user = """
        Generate ERCP report impression and recommendations. Return ONLY a JSON object:
        {
          "impression": "2-4 sentence ERCP impression based on the indication and working diagnosis",
          "recommendations": "post-ERCP management recommendations, follow-up plan, and PEP monitoring"
        }

        Indication(s): \(indicationList)
        Working diagnosis: \(dx)
        Patient: \(patient.ageYears)y \(patient.sex.rawValue)
        Context: \(clinicalContext(patient))

        Mark each value with [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let raw = try await generate(systemPrompt: system, userMessage: user)
        if let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") {
            let jsonStr = String(raw[start...end])
            if let data = jsonStr.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                return ERCPReportResult(
                    impression:      obj["impression"]      ?? "",
                    recommendations: obj["recommendations"] ?? ""
                )
            }
        }
        return ERCPReportResult(impression: raw, recommendations: "")
    }

    // MARK: - Diagnosis-driven plan auto-draft

    func draftDiagnosisPlan(patient: Patient) async throws -> String {
        let system = """
        You are a consultant surgical registrar supporting Dr Dawit Daniel Kabiye MD DM, general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Generate a structured management plan based on the confirmed working diagnosis.
        Format: numbered action items grouped under:
        1. Immediate actions
        2. Investigations to order
        3. Medications / prescriptions
        4. Referrals
        5. Follow-up plan
        6. Red flag advice
        British spelling. Evidence-based. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Generate a comprehensive management plan for this patient with confirmed diagnosis:
        \(clinicalContext(patient))
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }
}

// MARK: - Response types

private struct AnthropicResponse: Decodable {
    struct Content: Decodable {
        let text: String
    }
    let content: [Content]
}

enum AIError: LocalizedError {
    case apiError(String)
    var errorDescription: String? {
        switch self {
        case .apiError(let msg): return "AI error: \(msg)"
        }
    }
}
