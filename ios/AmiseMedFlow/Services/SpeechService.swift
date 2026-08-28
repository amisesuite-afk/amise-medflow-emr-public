import Foundation
import Speech
import AVFoundation

// MARK: - Dictation mode — maps to an AI polishing prompt

enum DictationMode: String, CaseIterable, Identifiable {
    case hpi           = "hpi"
    case exam          = "exam"
    case assessment    = "assessment"
    case plan          = "plan"
    case operativeNote = "operative_note"
    case endoscopy     = "endoscopy"
    case discharge     = "discharge"
    case referral      = "referral"
    case clinicalSummary = "clinical_summary"
    case prescription  = "prescription"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .hpi:            return "History"
        case .exam:           return "Examination"
        case .assessment:     return "Assessment"
        case .plan:           return "Management Plan"
        case .operativeNote:  return "Operative Note"
        case .endoscopy:      return "Endoscopy Report"
        case .discharge:      return "Discharge Summary"
        case .referral:       return "Referral Letter"
        case .clinicalSummary: return "Clinical Summary"
        case .prescription:   return "Prescription"
        }
    }

    var icon: String {
        switch self {
        case .hpi:            return "text.bubble"
        case .exam:           return "stethoscope"
        case .assessment:     return "brain.head.profile"
        case .plan:           return "list.bullet.clipboard"
        case .operativeNote:  return "scissors"
        case .endoscopy:      return "circle.dotted"
        case .discharge:      return "door.right.hand.open"
        case .referral:       return "envelope"
        case .clinicalSummary: return "doc.text.fill"
        case .prescription:   return "pills"
        }
    }

    // AI system prompt for this mode
    var systemPrompt: String {
        let base = """
        You are a medical transcription assistant for Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Convert raw voice dictation into polished clinical prose. British spelling.
        Expand abbreviations, correct medical terminology, organise into clear paragraphs.
        Remove filler words ("um", "uh", "like", "you know"). Never add clinical information not in the dictation.
        Do NOT mark output as AI-generated — the clinician will review it.
        """
        switch self {
        case .hpi:
            return base + "\nFormat: flowing narrative paragraph(s) describing the history of the presenting complaint. Include onset, duration, character, severity, radiation, relieving/aggravating factors, and associated symptoms."
        case .exam:
            return base + "\nFormat: structured examination findings. Group by system (General, CVS, Respiratory, Abdominal, Neurological, etc). Use present tense. Positive and relevant negative findings."
        case .assessment:
            return base + "\nFormat: concise clinical assessment. Include working diagnosis and brief supporting rationale. Use professional terminology."
        case .plan:
            return base + "\nFormat: numbered management plan. Group under: Investigations, Medications, Procedures/Referrals, Follow-up, Patient Advice."
        case .operativeNote:
            return base + "\nFormat: structured operative note. Sections: Surgeon, Assistant, Anaesthetist, Anaesthetic type, Patient position, Procedure, Operative findings, Technique (step-by-step), Haemostasis, Estimated blood loss, Specimens, Drains, Closure, Complications, Post-operative instructions."
        case .endoscopy:
            return base + "\nFormat: structured endoscopy report. Sections: Indication, Preparation, Scope used, Procedure, Findings by anatomic region with distances in cm, Interventions/biopsies, Complications, Impression, Plan/Follow-up."
        case .discharge:
            return base + "\nFormat: discharge summary. Sections: Admission date and reason, Working/discharge diagnosis, Treatment provided, Procedures, Medications on discharge (with doses), Follow-up plan, Red flag advice to patient."
        case .referral:
            return base + "\nFormat: formal referral letter. Dear [colleague], Reason for referral, Relevant history, Examination findings, Investigations with results, Current medications, What you are asking the colleague to do. Professional correspondence style."
        case .clinicalSummary:
            return base + "\nFormat: comprehensive clinical summary document with UPPERCASE section headings. Sections: PATIENT DETAILS, PRESENTING COMPLAINT, HISTORY, PAST MEDICAL & SURGICAL HISTORY, MEDICATIONS, ALLERGIES, EXAMINATION FINDINGS, INVESTIGATIONS, ASSESSMENT, MANAGEMENT PLAN."
        case .prescription:
            return base + "\nExtract medication prescriptions from the dictation. For each medication return: drug name (generic), dose, route, frequency, duration. Format as a numbered list. Flag any non-standard doses."
        }
    }

    var userPrefix: String {
        "Polish this raw clinical dictation into a professional \(label.lowercased()):\n\n"
    }
}

// MARK: - Transcription result

struct TranscriptionResult {
    let raw: String           // straight from SFSpeechRecognizer
    let polished: String      // AI post-processed
    let mode: DictationMode
    let duration: TimeInterval
}

// MARK: - Speech service

@MainActor
final class SpeechService: NSObject, ObservableObject {

    // MARK: Published state
    @Published var isRecording    = false
    @Published var isPolishing    = false
    @Published var liveTranscript = ""   // live partial transcript while recording
    @Published var error: String?

    // MARK: Private
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-GB"))
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest:  SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask:     SFSpeechRecognitionTask?
    private var recordingStart:      Date?

    private let ai = AIService()

    // MARK: - Permission

    func requestPermissions() async -> Bool {
        let speechStatus = await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { cont.resume(returning: $0) }
        }
        guard speechStatus == .authorized else { return false }

        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            self.error = "Audio session error: \(error.localizedDescription)"
            return false
        }

        let micStatus = await AVAudioApplication.requestRecordPermission()
        return micStatus
    }

    // MARK: - Recording lifecycle

    func startRecording() throws {
        guard !isRecording else { return }
        guard recognizer?.isAvailable == true else {
            throw SpeechError.recognizerUnavailable
        }

        liveTranscript = ""
        error = nil
        recordingStart = .now

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = false   // cloud for accuracy; on-device fallback if unavailable
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        recognitionTask = recognizer?.recognitionTask(with: request) { [weak self] result, err in
            guard let self else { return }
            Task { @MainActor in
                if let result {
                    self.liveTranscript = result.bestTranscription.formattedString
                }
                if let err {
                    // Ignore cancellation errors (thrown when we stop intentionally)
                    if (err as NSError).code != 301 {
                        self.error = err.localizedDescription
                    }
                }
            }
        }

        isRecording = true
    }

    func stopRecording() async -> String {
        guard isRecording else { return liveTranscript }

        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask   = nil
        isRecording = false

        do { try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
        catch {}

        return liveTranscript
    }

    // MARK: - Full dictation session (record → stop → AI polish)

    func dictate(mode: DictationMode) async throws -> TranscriptionResult {
        let granted = await requestPermissions()
        guard granted else { throw SpeechError.permissionDenied }

        try startRecording()
        // Caller drives stop via stopAndPolish — this just starts it
        throw SpeechError.callStopAndPolish
    }

    func stopAndPolish(mode: DictationMode) async throws -> TranscriptionResult {
        let start = recordingStart ?? .now
        let raw = await stopRecording()
        guard !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw SpeechError.emptyTranscript
        }

        isPolishing = true
        defer { isPolishing = false }

        let polished = try await ai.generate(
            systemPrompt: mode.systemPrompt,
            userMessage:  mode.userPrefix + raw
        )
        let duration = Date().timeIntervalSince(start)
        return TranscriptionResult(raw: raw, polished: polished, mode: mode, duration: duration)
    }
}

// MARK: - Errors

enum SpeechError: LocalizedError {
    case recognizerUnavailable
    case permissionDenied
    case emptyTranscript
    case callStopAndPolish   // internal sentinel — caller starts via startRecording directly

    var errorDescription: String? {
        switch self {
        case .recognizerUnavailable: return "Speech recognition is not available on this device."
        case .permissionDenied:      return "Microphone and speech recognition access are required for dictation. Please enable them in Settings."
        case .emptyTranscript:       return "No speech was detected. Please try again."
        case .callStopAndPolish:     return nil
        }
    }
}
