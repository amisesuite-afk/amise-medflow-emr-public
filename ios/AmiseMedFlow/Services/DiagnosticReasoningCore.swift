// DiagnosticReasoningCore.swift
// Diagnostic reasoning — platform-neutral core (deterministic; no AI, no network).
//
// Web twin: lib/triage-engine/src/diagnostic-reasoning/core.ts. Same rules, thresholds and
// wording, checked against the same vectors (AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json,
// read by DiagnosticReasoningTests.swift and the dashboard's diagnostic-reasoning-core.test.ts).
// Change both in the same commit.
//
//  - explain: for one hypothesis, the recorded findings that support it (LR ≥ 1.5), argue against
//    it (LR ≤ 0.67, present or documented absent), its cardinal findings that are missing, and the
//    recorded findings it does not explain ("doesn't fit").
//  - expectedInformationGain / postTest: Shannon gain in nats and the post-test probabilities.
//  - classifyProbeCost / rankDiscriminators / discriminatorWhy: best next question, sign or test,
//    cheapest first; CT, MRI, endoscopy only with a can't-miss diagnosis among the hypotheses.
//  - prematureClosureAlerts: "Doesn't fit the working diagnosis".
//  - diagnosticTimeOut: a gentle checklist when the case is complex.
// Suggestions only: nothing here writes to the record.

import Foundation

enum DiagnosticReasoning {

    static let version = "1.1.0"

    enum Thresholds {
        static let supportLr = 1.5
        static let againstLr = 0.67
        static let favourLr = 2.0
        static let lowEvidenceLr = 2.0
        static let strongContradictionLr = 0.33
        static let strongFavourLr = 10.0
        static let lessLikelyRatio = 5.0
        static let lessLikelyMinLeader = 0.5
        static let news2RiseMin = 2
        static let news2AlertMin = 5
        static let unexplainedTimeOut = 3
        static let minGain = 0.01
        static let maxClosureAlerts = 4
    }

    // MARK: - Types

    enum FindingStatus: String, Codable {
        case present, absent, unknown
    }

    struct Finding: Codable {
        let id: String
        let label: String
        let status: FindingStatus
    }

    struct Weight: Codable {
        let lrPresent: Double
        let lrAbsent: Double
        let modelled: Bool
        let cardinal: Bool
        let source: String
    }

    struct Hypothesis: Codable {
        let id: String
        let label: String
        let probability: Double
        let cantMiss: Bool
        /// A syndrome or state that accompanies other diagnoses (sepsis, AKI, electrolyte disorders).
        var coexists: Bool? = nil
    }

    struct Input: Codable {
        let hypotheses: [Hypothesis]
        let findings: [Finding]
        /// hypothesis id → finding id → weight; a missing entry is an unmodelled finding (LR 1).
        let weights: [String: [String: Weight]]
    }

    struct EvidenceLine {
        let findingId: String
        let label: String
        let status: FindingStatus
        let lr: Double
        let source: String
        let documented: Bool
        let favours: String?
        let favoursLr: Double?
    }

    struct Explanation {
        let hypothesisId: String
        let label: String
        let probability: Double
        let forFindings: [EvidenceLine]
        let against: [EvidenceLine]
        let missing: [EvidenceLine]
        let doesntFit: [EvidenceLine]
        let lowEvidence: Bool
    }

    static let unmodelled = Weight(lrPresent: 1, lrAbsent: 1, modelled: false, cardinal: false, source: "")

    static func weightOf(_ input: Input, _ hypothesisId: String, _ findingId: String) -> Weight {
        input.weights[hypothesisId]?[findingId] ?? unmodelled
    }

    /// The hypothesis (other than `excludeId`) in which a present finding has the highest LR ≥ favourLr.
    static func favouredBy(_ input: Input, _ findingId: String, excluding excludeId: String?) -> (id: String, label: String, lr: Double)? {
        var best: (id: String, label: String, lr: Double)? = nil
        for h in input.hypotheses where h.id != excludeId {
            let lr = weightOf(input, h.id, findingId).lrPresent
            if lr >= Thresholds.favourLr && (best == nil || lr > best!.lr) {
                best = (id: h.id, label: h.label, lr: lr)
            }
        }
        return best
    }

    /// Stable sort (Swift's sort is not guaranteed stable).
    static func stableSorted<T>(_ items: [T], by less: (T, T) -> Bool) -> [T] {
        items.enumerated().sorted { a, b in
            if less(a.element, b.element) { return true }
            if less(b.element, a.element) { return false }
            return a.offset < b.offset
        }.map(\.element)
    }

    static func explain(_ input: Input, hypothesisId: String) -> Explanation {
        let hyp = input.hypotheses.first { $0.id == hypothesisId }
        var forFindings: [EvidenceLine] = []
        var against: [EvidenceLine] = []
        var missing: [EvidenceLine] = []
        var doesntFit: [EvidenceLine] = []
        for f in input.findings {
            let w = weightOf(input, hypothesisId, f.id)
            func line(_ lr: Double, _ documented: Bool) -> EvidenceLine {
                let fav = f.status == .present ? favouredBy(input, f.id, excluding: hypothesisId) : nil
                return EvidenceLine(findingId: f.id, label: f.label, status: f.status, lr: lr, source: w.source,
                                    documented: documented, favours: fav?.label, favoursLr: fav?.lr)
            }
            switch f.status {
            case .present:
                if w.lrPresent >= Thresholds.supportLr {
                    forFindings.append(line(w.lrPresent, true))
                } else if w.lrPresent <= Thresholds.againstLr {
                    against.append(line(w.lrPresent, true))
                } else {
                    let l = line(w.lrPresent, true)
                    let explainedByAnyone = input.hypotheses.contains {
                        weightOf(input, $0.id, f.id).lrPresent >= Thresholds.supportLr
                    }
                    if l.favours != nil || !explainedByAnyone { doesntFit.append(l) }
                }
            case .absent:
                if w.cardinal {
                    missing.append(line(w.lrAbsent, true))
                } else if w.lrAbsent <= Thresholds.againstLr {
                    against.append(line(w.lrAbsent, true))
                }
            case .unknown:
                if w.cardinal { missing.append(line(w.lrAbsent, false)) }
            }
        }
        return Explanation(
            hypothesisId: hypothesisId,
            label: hyp?.label ?? hypothesisId,
            probability: hyp?.probability ?? 0,
            forFindings: stableSorted(forFindings) { $0.lr > $1.lr },
            against: stableSorted(against) { $0.lr < $1.lr },
            missing: stableSorted(missing) { a, b in
                a.documented == b.documented ? a.lr < b.lr : a.documented
            },
            doesntFit: stableSorted(doesntFit) { ($0.favoursLr ?? 0) > ($1.favoursLr ?? 0) },
            lowEvidence: !forFindings.contains { $0.lr >= Thresholds.lowEvidenceLr }
        )
    }

    /// Present findings that none of `hypothesisIds` supports (LR ≥ supportLr), in record order.
    static func unexplainedFindings(_ input: Input, hypothesisIds: [String]) -> [String] {
        input.findings
            .filter { $0.status == .present }
            .filter { f in !hypothesisIds.contains { weightOf(input, $0, f.id).lrPresent >= Thresholds.supportLr } }
            .map(\.label)
    }

    // MARK: - Information gain

    /// Shannon entropy in nats (terms with p ≤ 0 skipped), as pane-engine infoGain.ts.
    static func entropy(_ p: [Double]) -> Double {
        var h = 0.0
        for x in p where x > 0 { h -= x * log(x) }
        return h
    }

    static func expectedInformationGain(priors: [Double], pPositive: [Double]) -> Double {
        let total = priors.reduce(0, +)
        guard total > 0, priors.count == pPositive.count else { return 0 }
        let q = priors.map { $0 / total }
        var pPos = 0.0
        for i in q.indices { pPos += q[i] * pPositive[i] }
        let pNeg = 1 - pPos
        func post(_ present: Bool) -> [Double] {
            let raw = q.indices.map { q[$0] * (present ? pPositive[$0] : 1 - pPositive[$0]) }
            let t = raw.reduce(0, +)
            return t > 0 ? raw.map { $0 / t } : raw
        }
        return entropy(q) - (pPos * entropy(post(true)) + pNeg * entropy(post(false)))
    }

    /// Probabilities after a positive / negative result; `priors` need not sum to 1 (the rest of
    /// the differential has P(present) = residualPPositive).
    static func postTest(priors: [Double], pPositive: [Double], residualPPositive: Double) -> (ifPositive: [Double], ifNegative: [Double]) {
        let residual = max(0, 1 - priors.reduce(0, +))
        // Same order of addition as the web: Σ priors·p, then the residual.
        let pPos = priors.indices.reduce(0.0) { $0 + priors[$1] * pPositive[$1] } + residual * residualPPositive
        let pNeg = 1 - pPos
        let pos = priors.indices.map { pPos > 0 ? (priors[$0] * pPositive[$0]) / pPos : 0 }
        let neg = priors.indices.map { pNeg > 0 ? (priors[$0] * (1 - pPositive[$0])) / pNeg : 0 }
        return (ifPositive: pos, ifNegative: neg)
    }

    // MARK: - Probe cost

    enum ProbeKind: String, Codable {
        case history, symptom, sign, investigation
    }

    enum ProbeCost: String, Codable {
        case ask, bedside, lab, imaging, advanced

        var weight: Double {
            switch self {
            case .ask: return 1
            case .bedside: return 1
            case .lab: return 0.85
            case .imaging: return 0.6
            case .advanced: return 0.35
            }
        }

        var label: String {
            switch self {
            case .ask: return "Ask"
            case .bedside: return "Bedside"
            case .lab: return "Lab"
            case .imaging: return "Imaging"
            case .advanced: return "Advanced"
            }
        }
    }

    /// Terms for investigation cost tiers, checked in this order ("*" = prefix at a word start).
    static let probeCostTerms: [(cost: ProbeCost, terms: [String])] = [
        (.advanced, ["ct", "ctpa", "cect", "computed tomography", "mri", "mrcp", "magnetic resonance", "endoscop*",
                     "ogd", "gastroscop*", "colonoscop*", "sigmoidoscop*", "ercp", "eus", "angiogra*", "laparoscop*", "biops*", "hida",
                     "scintigra*", "lumbar puncture", "csf", "pet"]),
        (.imaging, ["us", "uss", "ultrasound", "ultrasonograph*", "sonograph*", "doppler", "x-ray", "xray",
                    "radiograph*", "cxr", "axr", "echocardiogra*", "echo", "fast", "efast"]),
        (.bedside, ["ecg", "ekg", "dipstick", "urinalysis", "urine", "capillary", "cbg", "bedside", "pregnancy test",
                    "hcg", "bhcg", "peak flow", "glucose", "ketone*", "blood gas", "abg", "vbg"]),
    ]

    private static func isWordChar(_ c: Character?) -> Bool {
        guard let c else { return false }
        return c.isLetter || c.isNumber
    }

    /// Term found in `text` at a word start; whole word unless the term ends with "*".
    static func hasTerm(_ text: String, _ term: String) -> Bool {
        let lower = Array(text.lowercased())
        let prefix = term.hasSuffix("*")
        let t = Array(prefix ? String(term.dropLast()) : term)
        guard !t.isEmpty, t.count <= lower.count else { return false }
        var i = 0
        while i + t.count <= lower.count {
            if Array(lower[i..<(i + t.count)]) == t {
                let before: Character? = i > 0 ? lower[i - 1] : nil
                let after: Character? = i + t.count < lower.count ? lower[i + t.count] : nil
                if !isWordChar(before) && (prefix || !isWordChar(after)) { return true }
            }
            i += 1
        }
        return false
    }

    static func classifyProbeCost(kind: ProbeKind, text: String) -> ProbeCost {
        if kind == .history || kind == .symptom { return .ask }
        if kind == .sign { return .bedside }
        for tier in probeCostTerms where tier.terms.contains(where: { hasTerm(text, $0) }) {
            return tier.cost
        }
        return .lab
    }

    struct ProbeCandidate: Codable {
        let id: String
        let label: String
        let kind: ProbeKind
        let cost: ProbeCost
        let gain: Double
    }

    struct RankedProbe {
        let probe: ProbeCandidate
        let score: Double
    }

    static func rankDiscriminators(_ candidates: [ProbeCandidate], cantMissInTop: Bool, limit: Int = 3) -> [RankedProbe] {
        let ranked = candidates
            .filter { $0.gain >= Thresholds.minGain }
            .filter { $0.cost != .advanced || cantMissInTop }
            .map { RankedProbe(probe: $0, score: $0.gain * $0.cost.weight) }
            .sorted { a, b in
                if a.score != b.score { return a.score > b.score }
                if a.probe.gain != b.probe.gain { return a.probe.gain > b.probe.gain }
                return a.probe.id < b.probe.id
            }
        return Array(ranked.prefix(limit))
    }

    static func pct(_ p: Double) -> Int { Int((p * 100).rounded()) }

    /// "42%", with "<1%" and ">99%" at the ends: the engine is never shown as certain.
    static func fmtPct(_ p: Double) -> String {
        if p >= 0.995 { return ">99%" }
        if p < 0.005 { return "<1%" }
        return "\(pct(p))%"
    }

    /// "elevated WBC" for "Elevated WBC"; acronyms ("CRP raised") are kept.
    static func lowerFirst(_ label: String) -> String {
        let chars = Array(label)
        if chars.count > 1, let a = chars[1].asciiValue, a >= 65, a <= 90 { return label }
        guard let first = chars.first else { return label }
        return String(first).lowercased() + String(chars.dropFirst())
    }

    static func formatLr(_ lr: Double) -> String {
        if lr >= 10 { return String(Int(lr.rounded())) }
        if lr >= 1 { return String(format: "%.1f", (lr * 10).rounded() / 10) }
        return String(format: "%.2f", (lr * 100).rounded() / 100)
    }

    struct PostTestLine: Codable {
        let label: String
        let before: Double
        let ifPositive: Double
        let ifNegative: Double
    }

    static func discriminatorWhy(kind: ProbeKind, lines: [PostTestLine]) -> String {
        guard var up = lines.first else { return "" }
        var down = up
        var upIndex = 0
        var downIndex = 0
        for (i, l) in lines.enumerated() {
            if l.ifPositive - l.before > up.ifPositive - up.before { up = l; upIndex = i }
            if l.ifPositive - l.before < down.ifPositive - down.before { down = l; downIndex = i }
        }
        let pos = kind == .investigation ? "positive" : "present"
        let neg = kind == .investigation ? "negative" : "absent"
        var text = "If \(pos): \(up.label) \(fmtPct(up.before)) → \(fmtPct(up.ifPositive))"
        if downIndex != upIndex && pct(down.ifPositive) < pct(down.before) {
            text += ", \(down.label) \(fmtPct(down.before)) → \(fmtPct(down.ifPositive))"
        }
        text += ". If \(neg): \(up.label) → \(fmtPct(up.ifNegative))."
        return text
    }

    // MARK: - Premature closure

    enum ClosureKind: String {
        case contradictingFinding = "contradicting-finding"
        case lessLikely = "less-likely"
        case news2Rising = "news2-rising"
    }

    struct ClosureAlert: Identifiable {
        var id: String { key }
        let key: String
        let kind: ClosureKind
        let finding: String?
        let favours: String?
        let lr: Double?
        let text: String
    }

    static func prematureClosureAlerts(_ input: Input, workingId: String?, workingLabel: String,
                                       news2Series: [Int]) -> [ClosureAlert] {
        guard !workingLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
        var out: [ClosureAlert] = []
        let working = workingId.flatMap { wid in input.hypotheses.first { $0.id == wid } }
        if let working {
            let ex = explain(input, hypothesisId: working.id)
            func own(_ id: String) -> Bool { weightOf(input, working.id, id).modelled }
            for e in ex.against where e.lr <= Thresholds.strongContradictionLr && own(e.findingId) {
                let finding = e.status == .absent ? "no \(lowerFirst(e.label))" : e.label
                let tail = e.favours.map { " — favours \($0)." } ?? "."
                out.append(ClosureAlert(
                    key: "contradicting-finding:\(e.findingId)", kind: .contradictingFinding, finding: finding,
                    favours: e.favours, lr: e.lr,
                    text: "Doesn't fit the working diagnosis: \(finding) argues against \(working.label) (LR \(formatLr(e.lr)))" + tail))
            }
            for e in ex.missing where e.documented && e.lr <= Thresholds.strongContradictionLr && own(e.findingId) {
                out.append(ClosureAlert(
                    key: "contradicting-finding:\(e.findingId)", kind: .contradictingFinding,
                    finding: "no \(lowerFirst(e.label))", favours: nil, lr: e.lr,
                    text: "Doesn't fit the working diagnosis: no \(lowerFirst(e.label)), expected in \(working.label) (LR \(formatLr(e.lr)))."))
            }
            if let leader = input.hypotheses.first(where: { $0.id != working.id && $0.coexists != true }),
               leader.probability >= Thresholds.lessLikelyMinLeader,
               leader.probability >= Thresholds.lessLikelyRatio * working.probability {
                var driver: (label: String, lrLeader: Double, lrWorking: Double)? = nil
                for f in input.findings where f.status == .present {
                    let lrLeader = weightOf(input, leader.id, f.id).lrPresent
                    let lrWorking = weightOf(input, working.id, f.id).lrPresent
                    if lrLeader / lrWorking < Thresholds.strongFavourLr { continue }
                    if driver == nil || lrLeader / lrWorking > driver!.lrLeader / driver!.lrWorking {
                        driver = (label: f.label, lrLeader: lrLeader, lrWorking: lrWorking)
                    }
                }
                if let d = driver {
                    out.append(ClosureAlert(
                        key: "less-likely:\(leader.id)", kind: .lessLikely, finding: d.label, favours: leader.label, lr: d.lrLeader,
                        text: "Doesn't fit the working diagnosis: the record favours \(leader.label) (\(fmtPct(leader.probability))) over \(working.label) (\(fmtPct(working.probability)))"
                            + " — mainly \(d.label) (LR \(formatLr(d.lrLeader)) vs \(formatLr(d.lrWorking)))."))
                }
            }
        }
        if news2Series.count >= 2, let last = news2Series.last, let lowest = news2Series.dropLast().min() {
            if last - lowest >= Thresholds.news2RiseMin && last >= Thresholds.news2AlertMin {
                let alt = input.hypotheses.first { $0.cantMiss && $0.coexists != true && $0.id != workingId }
                let name = working?.label ?? workingLabel
                out.append(ClosureAlert(
                    key: "news2-rising:\(lowest)-\(last)", kind: .news2Rising, finding: "NEWS2 \(lowest) → \(last)",
                    favours: alt?.label, lr: nil,
                    text: "NEWS2 rising (\(lowest) → \(last)): is \(name) still the whole story?" + (alt.map { " Consider \($0.label)." } ?? "")))
            }
        }
        var seen = Set<String>()
        let unique = out.filter { seen.insert($0.key).inserted }
        return Array(unique.prefix(Thresholds.maxClosureAlerts))
    }

    // MARK: - Diagnostic time-out

    static let timeOutChecklist: [String] = [
        "What is the worst thing this could be, and has it been excluded?",
        "Does every recorded finding fit the working diagnosis? Name the ones that don't.",
        "What was assumed rather than confirmed (referral label, earlier diagnosis, first impression)?",
        "Could there be two conditions rather than one?",
        "What result would change my mind, and has it been looked for?",
        "Would a colleague seeing this afresh agree?",
    ]

    static let timeOutSources: [String] = [
        "Croskerry P. The importance of cognitive errors in diagnosis and strategies to minimize them. Acad Med 2003;78:775-780.",
        "Ely JW, Graber ML, Croskerry P. Checklists to reduce diagnostic errors. Acad Med 2011;86:307-313.",
        "Graber ML et al. Cognitive interventions to reduce diagnostic error: a narrative review. BMJ Qual Saf 2012;21:535-557.",
    ]

    struct TimeOutInput: Codable {
        let unexplainedFindings: [String]
        let priorVisitsSameComplaint: Int
        let priorDiagnosesSameComplaint: [String]
    }

    struct TimeOutResult {
        let suggested: Bool
        let reasons: [String]
        let checklist: [String]
    }

    static func diagnosticTimeOut(_ input: TimeOutInput) -> TimeOutResult {
        var reasons: [String] = []
        let n = input.unexplainedFindings.count
        if n >= Thresholds.unexplainedTimeOut {
            reasons.append("\(n) recorded findings are not explained by the leading diagnoses (\(input.unexplainedFindings.prefix(3).joined(separator: ", "))).")
        }
        if input.priorVisitsSameComplaint >= 1 {
            var dx: [String] = []
            for d in input.priorDiagnosesSameComplaint {
                let t = d.trimmingCharacters(in: .whitespacesAndNewlines)
                if !t.isEmpty && !dx.contains(where: { $0.lowercased() == t.lowercased() }) { dx.append(t) }
            }
            let visit = input.priorVisitsSameComplaint + 1
            if dx.isEmpty {
                reasons.append("Visit \(visit) for the same complaint without a diagnosis recorded before.")
            } else if dx.count >= 2 {
                reasons.append("Visit \(visit) for the same complaint with changing diagnoses (\(dx.joined(separator: ", "))).")
            }
        }
        return TimeOutResult(suggested: !reasons.isEmpty, reasons: reasons,
                             checklist: reasons.isEmpty ? [] : timeOutChecklist)
    }
}
