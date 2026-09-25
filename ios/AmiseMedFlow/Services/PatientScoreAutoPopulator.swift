// PatientScoreAutoPopulator.swift
// Derives clinical score input values deterministically from structured patient data.
// No AI, no network — HIPAA-safe. Surgeon retains full authority over all values.

import Foundation

// MARK: - Auto-fill metadata

struct PendingScoreField: Identifiable {
    let id: String     // same as key — unique per score
    let label: String
    let source: String
}

struct ScoreAutoFill {
    /// Field keys whose values were set from patient data (not blank defaults).
    var autoFieldKeys: Set<String> = []
    /// Fields that could not be determined and need clinical attention.
    var pendingFields: [PendingScoreField] = []
    /// True when the populator was called for this score (not just its default state).
    var isAttempted: Bool = false

    var hasPending: Bool { isAttempted && !pendingFields.isEmpty }
    func isAuto(_ key: String) -> Bool { autoFieldKeys.contains(key) }

    mutating func addPending(key: String, label: String, source: String) {
        pendingFields.append(PendingScoreField(id: key, label: label, source: source))
    }

    mutating func addAutoFilled(key: String, label: String = "", source: String = "") {
        autoFieldKeys.insert(key)
    }
}

// MARK: - Per-run shared patient data

/// One auto-populate run's view of the patient data the helpers below read.
///
/// Without it every helper call re-decodes the PMH / investigations JSON, re-joins and
/// re-lowercases the clinical text and re-sorts the vitals — and APACHE II, Ranson, CHA₂DS₂-VASc
/// and similar call `latestLab` / `clinicalTextContains` a dozen times or more, on the main
/// thread, when a score is opened. Each value here is computed on first use, with exactly the same expression the
/// uncached helper uses, so results are identical; it just happens once per run.
///
/// Scope: `begin(for:)` … `end()` around one populate call (see
/// `ClinicalScoresView.autoPopulate(for:)`). The active context is per thread and only used for the
/// patient it was built for; outside a scope the helpers compute directly, as before. The
/// populators never modify the patient, so nothing can go stale within a run.
final class ScoreAutoPopulateContext {
    fileprivate static let threadKey = "com.amise.medflow.scoreAutoPopulateContext"

    /// Restores whatever context (usually none) was active before `begin(for:)`.
    struct Scope {
        fileprivate let previous: Any?
        func end() {
            Thread.current.threadDictionary[ScoreAutoPopulateContext.threadKey] = previous
        }
    }

    /// Makes a fresh context for `patient` active on this thread until `end()` is called.
    static func begin(for patient: Patient) -> Scope {
        let dict = Thread.current.threadDictionary
        let previous = dict[threadKey]
        dict[threadKey] = ScoreAutoPopulateContext(patient: patient)
        return Scope(previous: previous)
    }

    /// The context active on this thread, when it was built for `patient`.
    static func active(for patient: Patient) -> ScoreAutoPopulateContext? {
        guard let ctx = Thread.current.threadDictionary[threadKey] as? ScoreAutoPopulateContext,
              ctx.patient === patient else { return nil }
        return ctx
    }

    let patient: Patient

    init(patient: Patient) {
        self.patient = patient
    }

    /// PMH notes, HPI, CC, working diagnosis, assessment and PMH entries, joined and lowercased.
    private(set) lazy var clinicalText: String = self.patient.scoreClinicalTextBlock()
    /// Drug + indication of every prescription, lowercased.
    private(set) lazy var prescriptionText: String = self.patient.scorePrescriptionText()
    /// Most recent vitals entry.
    private(set) lazy var latestVitals: VitalsEntry? = self.patient.scoreLatestVitals()
    /// Resulted investigations (decoded once), in stored order, with their names split into words.
    private(set) lazy var resultedLabs: [ScoreResultedLab] = self.patient.scoreResultedLabs()

    /// `latestLab(named:)` results for this run, keyed by the keyword list.
    private var labValues: [String: Double?] = [:]

    func latestLab(named keywords: [String]) -> Double? {
        let key = keywords.joined(separator: "\u{1F}")
        if let cached = labValues[key] { return cached }
        let value = patient.scoreLatestLab(named: keywords, in: resultedLabs)
        labValues.updateValue(value, forKey: key)
        return value
    }
}

/// A resulted investigation with its name split into lowercase words once (`LabNameMatch`).
struct ScoreResultedLab {
    let nameWords: [String]
    let entry: InvestigationEntry
}

// MARK: - Patient data helpers (module-internal)

extension Patient {
    /// Searches PMH entries, PMH notes, HPI, CC, and working diagnosis for keywords.
    func clinicalTextContains(_ keywords: [String]) -> Bool {
        let blocks = ScoreAutoPopulateContext.active(for: self)?.clinicalText ?? scoreClinicalTextBlock()
        return keywords.contains { blocks.contains($0) }
    }

    func prescriptionsContain(_ keywords: [String]) -> Bool {
        let text = ScoreAutoPopulateContext.active(for: self)?.prescriptionText ?? scorePrescriptionText()
        return keywords.contains { text.contains($0) }
    }

    var isSurgicalVisit: Bool {
        guard let vt = visitType else { return false }
        return vt == .surgeryElective || vt == .surgeryEmergency || vt == .dayOfSurgery
    }

    var isLaparoscopicProcedure: Bool {
        let n = surgeryData.procedureName.lowercased()
        return n.contains("laparoscop") || n.contains("keyhole") || n.contains("minimal")
    }

    var latestVitals: VitalsEntry? {
        if let ctx = ScoreAutoPopulateContext.active(for: self) { return ctx.latestVitals }
        return scoreLatestVitals()
    }

    func latestLab(named keywords: [String]) -> Double? {
        if let ctx = ScoreAutoPopulateContext.active(for: self) { return ctx.latestLab(named: keywords) }
        return scoreLatestLab(named: keywords, in: scoreResultedLabs())
    }

    // Uncached computations — the single source for both the direct and the per-run paths.

    fileprivate func scoreClinicalTextBlock() -> String {
        ([pmhNotes, hpi, chiefComplaint, workingDiagnosis, assessmentText]
            .compactMap { $0 }
            + pmhEntries.map(\.condition))
            .joined(separator: " ")
            .lowercased()
    }

    fileprivate func scorePrescriptionText() -> String {
        prescriptions
            .map { "\($0.drug) \($0.indication)".lowercased() }
            .joined(separator: " ")
    }

    fileprivate func scoreLatestVitals() -> VitalsEntry? {
        vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    fileprivate func scoreResultedLabs() -> [ScoreResultedLab] {
        investigations
            .filter { $0.status == .resulted && $0.category.holdsLabValues }
            .map { ScoreResultedLab(nameWords: LabNameMatch.words(of: $0.name), entry: $0) }
    }

    fileprivate func scoreLatestLab(named keywords: [String], in resulted: [ScoreResultedLab]) -> Double? {
        let match = resulted
            // Whole words only: "HbA1c" / "HBsAg" are not "hb", "Fasting glucose" is not "ast".
            .filter { lab in LabNameMatch.matchesAny(lab.nameWords, keywords) }
            .map(\.entry)
            .sorted { ($0.resultedAt ?? $0.orderedAt) < ($1.resultedAt ?? $1.orderedAt) }
            .last
        guard let entry = match else { return nil }
        return parseLabNumber(entry.result)
    }

    func parseLabNumber(_ text: String) -> Double? {
        var numStr = ""
        var foundDigit = false
        for scalar in text.unicodeScalars {
            let c = Character(scalar)
            if c.isNumber { numStr.append(c); foundDigit = true }
            else if c == "." && foundDigit { numStr.append(c) }
            else if foundDigit { break }
        }
        return foundDigit ? Double(numStr) : nil
    }

    // Returns creatinine in μmol/L, inferring units: value < 15 → mg/dL (×88.42), ≥ 15 → μmol/L
    func creatinineUmolL() -> Double? {
        guard let raw = latestLab(named: ["creatinine"]) else { return nil }
        return raw < 15 ? raw * 88.42 : raw
    }
}

// MARK: - Populator

enum PatientScoreAutoPopulator {}
