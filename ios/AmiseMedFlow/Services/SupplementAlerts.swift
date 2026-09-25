// SupplementAlerts.swift
// Herbs, teas, bush remedies and supplements — clinician-facing alerts and "ask about" prompts for
// the risk snapshot (VisitRiskAssessment) and the pre-op checklist. Twin of the dashboard's
// `artifacts/dashboard/src/lib/supplement-prompts.ts`: same prompt ids, wording
// (SupplementCatalogue.prompts / triggerTerms, parity-linted) and thresholds.
//
// Deterministic; display only. Nothing is stopped, ordered or written to the record: the
// clinician decides. AIService is not used.
//
// Prompts (owner's evidence briefing §5 / §7):
//  - not_asked: before a procedure, the mandatory question has not been answered.
//  - periop_<item>: a recorded catalogue item — "Supplement: <name> — <concern>. Commonly cited
//    stop time: <…> before elective surgery (source)."
//  - ashwagandha_avoid: ashwagandha recorded with liver disease, pregnancy or thyroid disease.
//  - liver: ALT or AST ≥ 120 U/L (3 × an upper limit of 40) or hepatitis / raised-LFT words.
//  - lead: raised blood lead or lead words; or anaemia (Hb < 12 g/dL, < 13 in men) or neuropathy
//    with abdominal pain; or a recorded Ayurvedic / turmeric product with any of those.
//  - aristolochic: rapidly progressive renal failure or upper-tract urothelial cancer words, or a
//    recorded Chinese herbal slimming product.
//  - detox: K < 3.5 or Na < 135 mmol/L, dehydration or chronic constipation words, or a recorded
//    detox tea / cleanse.
//  - iv_drip: fever (≥ 38.0 °C or fever words) or cellulitis / line-site infection words, or a
//    recorded IV drip.
// Thresholds are the practice's working choices, listed for sign-off in
// docs/clinical-validation/changes/supplements-interactions.md.

import Foundation

enum SupplementAlerts {

    struct Prompt: Equatable {
        let id: String
        let level: RiskFlag.Level
        let title: String
        let detail: String
    }

    /// Everything the prompts read, as plain values (built from a Patient by `inputs(for:)`).
    struct Inputs {
        var history = SupplementHistory()
        /// A procedure or operation is planned (procedure pathway, surgical / endoscopy visit,
        /// or a future operation date).
        var preOp = false
        /// Clinical text: PMH, HPI, complaint, diagnosis, assessment, symptoms, examination.
        var clinicalText = ""
        /// Conditions only (PMH entries and notes, working diagnosis) for the ashwagandha alert.
        var conditionsText = ""
        var sex: Sex = .unspecified
        var pregnant = false
        var alt: Double?
        var ast: Double?
        /// Haemoglobin as recorded (g/dL or g/L; values above 25 are read as g/L).
        var haemoglobin: Double?
        var sodium: Double?
        var potassium: Double?
        /// A resulted blood lead above the reference (5 µg/dL = 0.24 µmol/L), units required.
        var leadRaised = false
        var temperatureC: Double?
    }

    // MARK: - Prompts

    static func prompts(_ i: Inputs) -> [Prompt] {
        var out: [Prompt] = []
        let text = NegationMatcher.Source(i.clinicalText)
        let conditions = NegationMatcher.Source(i.conditionsText)
        func terms(_ key: String) -> [String] { SupplementCatalogue.triggerTerms[key] ?? [] }
        func add(_ id: String, _ level: RiskFlag.Level, recorded: [SupplementItem] = []) {
            let p = SupplementCatalogue.prompt(id)
            out.append(Prompt(id: id, level: level, title: p.title, detail: withRecorded(p.detail, recorded)))
        }
        let recorded = i.history.recordedItems
        let recordedIds = Set(recorded.map(\.id))

        // Mandatory question before a procedure.
        if i.preOp && !i.history.isAnswered {
            add("not_asked", .moderate)
        }

        // Perioperative alert for each recorded catalogue item.
        for item in recorded {
            out.append(Prompt(id: "periop_\(item.id)", level: i.preOp ? .moderate : .info,
                              title: "Supplement: \(item.label)",
                              detail: SupplementCatalogue.perioperativeAlertText(item)))
        }

        // Ashwagandha with liver disease, pregnancy or thyroid disease.
        if recordedIds.contains("ashwagandha"),
           i.pregnant || conditions.containsAny(terms("liverDisease")) || conditions.containsAny(terms("thyroidDisease")) {
            add("ashwagandha_avoid", .high)
        }

        // Raised LFTs / hepatitis → turmeric, ashwagandha, other herbal products.
        let lftRaised = (i.alt ?? 0) >= 120 || (i.ast ?? 0) >= 120
        if lftRaised || text.containsAny(terms("liver")) {
            add("liver", .moderate, recorded: recorded.filter { $0.id == "turmeric" || $0.id == "ashwagandha" })
        }

        // Anaemia / abdominal pain / neuropathy / raised lead → Ayurvedic (rasa shastra) products.
        let anaemia = isAnaemic(i.haemoglobin, sex: i.sex) || text.containsAny(terms("anaemia"))
        let abdoPain = text.containsAny(terms("abdominalPain"))
        let neuropathy = text.containsAny(terms("neuropathy"))
        let metalProduct = recordedIds.contains("ayurvedic_metals") || recordedIds.contains("turmeric")
        if i.leadRaised || text.containsAny(terms("lead"))
            || ((anaemia || neuropathy) && abdoPain)
            || (metalProduct && (anaemia || abdoPain || neuropathy)) {
            add("lead", .moderate, recorded: recorded.filter { $0.id == "ayurvedic_metals" || $0.id == "turmeric" })
        }

        // Rapidly progressive renal failure / upper-tract urothelial cancer → aristolochic acid.
        if text.containsAny(terms("aristolochic")) || recordedIds.contains("aristolochia") {
            add("aristolochic", .moderate, recorded: recorded.filter { $0.id == "aristolochia" })
        }

        // Hypokalaemia / hyponatraemia / dehydration / chronic constipation → detox teas, cleanses.
        let lowK = (i.potassium.map { $0 < 3.5 }) ?? false
        let lowNa = (i.sodium.map { $0 < 135 }) ?? false
        if lowK || lowNa || text.containsAny(terms("dehydration")) || recordedIds.contains("detox_cleanse") {
            add("detox", .info, recorded: recorded.filter { $0.id == "detox_cleanse" })
        }

        // Fever or cellulitis / line-site infection → IV drips outside clinical care.
        let fever = (i.temperatureC.map { $0 >= 38.0 } ?? false) || text.containsAny(terms("fever"))
        if fever || text.containsAny(terms("lineInfection")) || recordedIds.contains("iv_vitamin_drip") {
            add("iv_drip", .info, recorded: recorded.filter { $0.id == "iv_vitamin_drip" })
        }
        return out
    }

    /// "…. Recorded: Turmeric / curcumin." (same format as the web).
    static func withRecorded(_ detail: String, _ recorded: [SupplementItem]) -> String {
        guard !recorded.isEmpty else { return detail }
        return "\(detail) Recorded: \(recorded.map(\.label).joined(separator: ", "))."
    }

    /// WHO anaemia thresholds: Hb < 13 g/dL in men, < 12 g/dL otherwise. g/L values are converted.
    static func isAnaemic(_ hb: Double?, sex: Sex) -> Bool {
        guard let raw = hb, raw > 0 else { return false }
        let gdl = raw > 25 ? raw / 10 : raw
        return gdl < (sex == .male ? 13 : 12)
    }

    /// Blood lead above the reference, only when the unit is stated: ≥ 5 µg/dL or ≥ 0.24 µmol/L.
    static func leadIsRaised(value: Double?, resultText: String) -> Bool {
        guard let v = value else { return false }
        let t = resultText.lowercased()
        if t.contains("µg/dl") || t.contains("ug/dl") || t.contains("mcg/dl") { return v >= 5 }
        if t.contains("µmol/l") || t.contains("umol/l") { return v >= 0.24 }
        return false
    }

    // MARK: - From the record

    static func inputs(for p: Patient, pathway: ConsultPathway? = nil) -> Inputs {
        var i = Inputs()
        i.history = p.supplementHistory
        let surgicalVisit: Bool = {
            guard let vt = p.visitType else { return false }
            switch vt {
            case .dayOfSurgery, .ercp, .ogd, .colonoscopy, .surgeryElective, .surgeryEmergency, .bronchoscopy:
                return true
            default:
                return false
            }
        }()
        let futureOperation = p.operationDate.map { $0 > .now } ?? false
        i.preOp = pathway == .procedure || surgicalVisit || futureOperation
        let conditions = p.pmhEntries.map { Optional($0.condition) } + [p.pmhNotes, p.workingDiagnosis]
        i.conditionsText = NegationMatcher.joinClauses(conditions)
        i.clinicalText = NegationMatcher.joinClauses(conditions + [
            p.hpi, p.chiefComplaint, p.associatedSymptoms, p.assessmentText,
            p.examGeneral, p.examAbdo, p.examNeuro, p.examSkin, p.examOther,
        ])
        i.sex = p.sex
        i.pregnant = PregnancyContext.detect(patient: p).isPregnant
        i.alt = p.latestLab(named: ["alt", "alanine aminotransferase"])
        i.ast = p.latestLab(named: ["ast", "aspartate aminotransferase", "aspartate transaminase"])
        i.haemoglobin = p.latestLab(named: ["haemoglobin", "hemoglobin", "hgb", "hb"])
        i.sodium = p.latestLab(named: ["sodium"])
        i.potassium = LabPanel.parse(from: p.investigations).potassium?.value
        if let lead = latestResult(p, keywords: ["lead", "blood lead"]) {
            i.leadRaised = leadIsRaised(value: p.parseLabNumber(lead.result), resultText: lead.result)
        }
        i.temperatureC = p.vitalsEntries.filter(\.hasAnyValue)
            .max(by: { $0.recordedAt < $1.recordedAt })?.temperatureCelsius
        return i
    }

    /// Latest resulted lab entry whose name matches `keywords` as whole words (LabNameMatch).
    private static func latestResult(_ p: Patient, keywords: [String]) -> InvestigationEntry? {
        p.investigations
            .filter { $0.status == .resulted && $0.category.holdsLabValues }
            .filter { LabNameMatch.matchesAny(LabNameMatch.words(of: $0.name), keywords) }
            .max(by: { ($0.resultedAt ?? $0.orderedAt) < ($1.resultedAt ?? $1.orderedAt) })
    }

    /// Risk-snapshot flags (VisitRiskAssessment).
    static func riskFlags(_ p: Patient, pathway: ConsultPathway?) -> [RiskFlag] {
        prompts(inputs(for: p, pathway: pathway)).map { pr in
            RiskFlag(level: pr.level, title: pr.title, detail: pr.detail, icon: pr.id.hasPrefix("periop_") ? "leaf" : "leaf.circle")
        }
    }
}
