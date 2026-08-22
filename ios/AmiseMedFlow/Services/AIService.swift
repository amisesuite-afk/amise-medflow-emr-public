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
        Generate a SOAP note for this patient:
        Name: \(patient.fullName), Age: \(patient.ageYears)y, Sex: \(patient.sex.rawValue)
        Setting: \(patient.setting.rawValue)
        Chief complaint: \(patient.chiefComplaint ?? "Not specified")
        Working diagnosis: \(patient.workingDiagnosis ?? "Under assessment")
        Past medical history: \(patient.pmhNotes ?? "Not documented")
        Note type: \(noteType.label)

        Return JSON: {"s":"...","o":"...","a":"...","p":"..."}
        """

        let raw = try await generate(systemPrompt: system, userMessage: user)
        // Extract JSON from response
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
            .operative: "operative note",
            .endoscopy: "endoscopy report",
            .discharge: "discharge summary",
            .consultation: "consultation letter",
            .referralLetter: "referral letter to a colleague"
        ]
        let docType = templates[noteType] ?? "clinical note"

        let user = """
        Generate a \(docType) for:
        Patient: \(patient.fullName), \(patient.ageYears)y \(patient.sex.rawValue)
        Working diagnosis: \(patient.workingDiagnosis ?? "Under assessment") \(patient.workingDiagnosisICD.map { "(\($0))" } ?? "")
        Chief complaint: \(patient.chiefComplaint ?? "Not specified")
        PMH: \(patient.pmhNotes ?? "None documented")
        Setting: \(patient.setting.rawValue)
        \(noteType == .referralLetter ? "Format as a formal referral letter from Dr Dawit Daniel Kabiye MD DM." : "")
        \(noteType == .discharge ? "Include discharge diagnosis, treatment, follow-up plan, red flag advice." : "")
        \(noteType == .operative ? "Include: surgeon, procedure, anaesthesia, findings, technique, haemostasis, closure, estimated blood loss, complications." : "")
        \(noteType == .endoscopy ? "Include: procedure, indication, preparation, scope used, findings by anatomic region, impression, plan." : "")
        """

        return try await generate(systemPrompt: system, userMessage: user)
    }

    func generateOpNote(patient: Patient, procedure: String, findings: String) async throws -> String {
        let system = """
        You are drafting an operative note for Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon.
        Follow standard operative note format. British spelling. Mark as AI DRAFT.
        """
        let user = """
        Operative Note:
        Surgeon: Dr Dawit Daniel Kabiye MD DM
        Patient: \(patient.fullName), \(patient.ageYears)y \(patient.sex.rawValue)
        Procedure: \(procedure)
        Diagnosis: \(patient.workingDiagnosis ?? "As listed")
        Operative findings: \(findings)
        PMH: \(patient.pmhNotes ?? "None")

        Write a complete, structured operative note.
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
        Summarise this clinical document for patient \(patient.fullName) (\(patient.ageYears)y \(patient.sex.rawValue)):
        Document: \(fileName)
        Working diagnosis: \(patient.workingDiagnosis ?? "Under assessment")

        Extracted text:
        \(extractedText.prefix(3000))

        Provide:
        1. Key findings (bullet points)
        2. Abnormal / urgent results
        3. Recommended actions
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - Referral letter

    func generateReferral(patient: Patient, toSpecialty: String, reason: String) async throws -> String {
        let system = """
        You are writing a formal medical referral letter on behalf of Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Use professional British-Caribbean medical correspondence style.
        """
        let user = """
        Write a referral letter to a \(toSpecialty) colleague.
        Patient: \(patient.fullName), DOB: \(patient.dateOfBirth.map { DateFormatter.localizedString(from: $0, dateStyle: .medium, timeStyle: .none) } ?? "Not recorded")
        Working diagnosis: \(patient.workingDiagnosis ?? "Under investigation")
        Reason for referral: \(reason)
        PMH: \(patient.pmhNotes ?? "None documented")
        """
        return try await generate(systemPrompt: system, userMessage: user)
    }

    // MARK: - Discharge summary

    func generateDischargeSummary(patient: Patient, treatment: String, followUp: String) async throws -> String {
        let system = """
        You are writing a discharge summary for Dr Dawit Daniel Kabiye MD DM.
        Use British spelling. Include all mandatory discharge summary components.
        """
        let user = """
        Discharge summary:
        Patient: \(patient.fullName), \(patient.ageYears)y \(patient.sex.rawValue)
        Diagnosis: \(patient.workingDiagnosis ?? "As documented")
        Treatment provided: \(treatment)
        Follow-up plan: \(followUp)
        PMH: \(patient.pmhNotes ?? "None")
        Ward: \(patient.ward ?? "Not specified")
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
