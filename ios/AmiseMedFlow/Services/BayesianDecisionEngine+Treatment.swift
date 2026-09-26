// BayesianDecisionEngine+Treatment.swift
// Treatment decision layer on top of the diagnosis engines — Bayesian decision theory extended from
// the diagnosis to the treatment (Pauker & Kassirer, N Engl J Med 1980;302:1109):
//
//   1. Score → action: each recorded score's band → its guideline action.
//   2. Result → action: a resulted lab crossing a guideline threshold → its action.
//   3. For the leading diagnoses, each option's net benefit in the diseased (B) and harm in the
//      non-diseased (H), personalised to the patient (odds ratios on the harm; multipliers and
//      additions on the benefit), give
//          treat           T   = H / (H + B)
//          test            Tt  = ((1 − Sp)·H + R) / ((1 − Sp)·H + Se·B)
//          test-treatment  Ttx = (Sp·H − R) / (Sp·H + (1 − Se)·B)
//      and the band for the current probability: Observe | Test further | Treat. Every number is a
//      range [low, point, high]; the band is flagged borderline when the range reaches another band.
//
// Suggestions only: nothing is added, ordered or prescribed without the clinician's tap. The
// PlanSafetyFilter line filter is the final hard filter on every line shown.
//
// DRIFT NOTE: twin of lib/pane-engine/src/decision/engine.ts — same content JSON, same vectors
// (AmiseMedFlowTests/DecisionSupport/decision-vectors.json, asserted by TreatmentDecisionTests and
// by the web vitest). Keep the arithmetic order identical so both platforms give the same numbers.

import Foundation

extension BayesianDecisionEngine {

    /// The Plan-step decision support for these inputs (nil when the bundled content is missing).
    static func treatmentDecisionSupport(
        _ input: TreatmentDecisions.Input,
        content: TreatmentDecisions.Content? = TreatmentDecisions.content,
        filter: @escaping TreatmentDecisions.LineFilter = TreatmentDecisions.identityFilter
    ) -> TreatmentDecisions.Result? {
        guard let content = content else { return nil }
        return TreatmentDecisions.decisionSupport(input, content, filter)
    }
}

extension TreatmentDecisions {

    static let identityFilter: LineFilter = { line in (text: line, withheld: false) }

    // MARK: - Formatting (identical to the web)

    /// JavaScript Math.round (ties towards +∞).
    static func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }

    static func round4(_ x: Double) -> Double { jsRound(x * 10000) / 10000 }

    static func round4(_ t: Triple) -> Triple { Triple(round4(t.low), round4(t.point), round4(t.high)) }

    static func clamp(_ x: Double, _ lo: Double, _ hi: Double) -> Double { Swift.min(hi, Swift.max(lo, x)) }

    private static func isWhole(_ x: Double) -> Bool { x.truncatingRemainder(dividingBy: 1) == 0 }

    /// 0.953 → "95%", 0.0374 → "3.7%", 0.04 → "4%".
    static func formatPercent(_ p: Double) -> String {
        let v = p * 100
        if v >= 10 { return "\(Int(jsRound(v)))%" }
        let r = jsRound(v * 10) / 10
        if isWhole(r) { return "\(Int(r))%" }
        return String(format: "%.1f%%", r)
    }

    /// 3 → "3", 4.5 → "4.5".
    static func formatValue(_ v: Double) -> String {
        if isWhole(v) { return "\(Int(v))" }
        return "\(jsRound(v * 100) / 100)"
    }

    // MARK: - Text matching (identical to the web)

    static func norm(_ s: String?) -> String {
        (s ?? "").lowercased()
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{2018}", with: "'")
            .replacingOccurrences(of: "\u{2013}", with: "-")
            .replacingOccurrences(of: "\u{2014}", with: "-")
    }

    private static func isWordChar(_ c: Character) -> Bool {
        ("a"..."z").contains(c) || ("0"..."9").contains(c)
    }

    /// The keyword occurs at a word start ("perforat" matches "perforated", not "imperforate").
    static func keywordAt(_ text: String, _ keyword: String) -> Bool {
        let t = norm(text)
        let k = norm(keyword)
        if k.isEmpty { return false }
        var from = t.startIndex
        while from < t.endIndex, let r = t.range(of: k, range: from..<t.endIndex) {
            if r.lowerBound == t.startIndex || !isWordChar(t[t.index(before: r.lowerBound)]) { return true }
            from = t.index(after: r.lowerBound)
        }
        return false
    }

    static func normIcd(_ code: String?) -> String {
        String((code ?? "").uppercased().filter { ("A"..."Z").contains($0) || ("0"..."9").contains($0) })
    }

    static func diagnosisMatches(_ def: Decision, _ d: Diagnosis) -> Bool {
        let m = def.match
        if m.excludeKeywords.contains(where: { keywordAt(d.name, $0) }) { return false }
        if let id = d.id, m.diseaseIds.contains(id) { return true }
        let icd = normIcd(d.icd10)
        if !icd.isEmpty && m.icd10.contains(where: { icd.hasPrefix(normIcd($0)) }) { return true }
        return m.keywords.contains(where: { keywordAt(d.name, $0) })
    }

    // MARK: - Sources

    static func refs(_ content: Content, _ ids: [String]) -> [SourceRef] {
        ids.map { id -> SourceRef in
            let s = content.sources[id]
            return SourceRef(id: id, citation: s?.citation ?? id, year: s?.year ?? 0, fromMemory: s?.fromMemory ?? true)
        }
    }

    // MARK: - Scores

    private static func sourceRank(_ s: String) -> Int {
        switch s {
        case "calculator": return 0
        case "record": return 1
        default: return 2
        }
    }

    /// One value per score: a clinician-completed calculator wins over the record, then auto-fill.
    static func pickScores(_ scores: [Score]) -> [Score] {
        var out: [Score] = []
        for s in scores where s.value.isFinite {
            if let i = out.firstIndex(where: { $0.key == s.key }) {
                if sourceRank(s.source) < sourceRank(out[i].source) { out[i] = s }
            } else {
                out.append(s)
            }
        }
        return out
    }

    static func scoreValue(_ scores: [Score], _ key: String) -> Double? {
        pickScores(scores).first(where: { $0.key == key })?.value
    }

    static func scoreBand(_ set: ScoreActionSet, _ score: Score) -> ScoreBand? {
        for b in set.bands {
            if score.value < b.min || score.value > b.max { continue }
            if b.requires == "redParameter" && score.redParameter != true { continue }
            return b
        }
        return nil
    }

    private static func levelRank(_ level: String) -> Int {
        switch level {
        case "critical": return 0
        case "high": return 1
        case "moderate": return 2
        default: return 3
        }
    }

    static func scoreActions(_ input: Input, _ content: Content, _ filter: LineFilter) -> [ScoreCard] {
        var cards: [ScoreCard] = []
        for s in pickScores(input.scores) {
            guard let set = content.scoreActions.first(where: { $0.score == s.key }),
                  let b = scoreBand(set, s),
                  let index = set.bands.firstIndex(where: { $0.min == b.min && $0.max == b.max && $0.requires == b.requires && $0.band == b.band })
            else { continue }
            let f = filter(b.action)
            var c = ScoreCard()
            c.id = "\(set.score):\(index)"
            c.score = set.score
            c.scoreLabel = set.label
            c.chip = "\(set.chip) \(formatValue(s.value))"
            c.value = s.value
            c.scoreSource = s.source
            c.band = b.band
            c.level = b.level
            c.action = f.text
            c.withheld = f.withheld
            c.addAs = b.addAs
            c.evidence = b.evidence
            c.sources = refs(content, b.sources)
            cards.append(c)
        }
        return cards.enumerated()
            .sorted { a, b in
                let ra = levelRank(a.element.level), rb = levelRank(b.element.level)
                return ra != rb ? ra < rb : a.offset < b.offset
            }
            .map(\.element)
    }

    // MARK: - Results

    static func resultActions(_ input: Input, _ content: Content, _ filter: LineFilter) -> [ResultCard] {
        var fired = Set<String>()
        var cards: [ResultCard] = []
        for r in content.resultActions {
            guard let v = input.labs[r.analyte], v.isFinite else { continue }
            var lower: Double? = r.lower
            var ulnText = ""
            if let multiple = r.ulnMultiple {
                let local = input.uln?[r.analyte]
                let uln = local ?? content.defaults.uln.value(for: r.analyte) ?? 0
                lower = multiple * uln
                ulnText = local != nil
                    ? " (ULN \(formatValue(uln)) \(r.unit))"
                    : " (ULN \(formatValue(uln)) \(r.unit) assumed — use the local reference range)"
            }
            if let lo = lower {
                let passes = (r.strictLower ?? false) ? v > lo : v >= lo
                if !passes { continue }
            }
            if let hi = r.upperExclusive, !(v < hi) { continue }
            fired.insert(r.id)
            let f = filter(r.action)
            var c = ResultCard()
            c.id = r.id
            c.analyte = r.analyte
            c.label = r.label
            c.chip = "\(r.analyte.prefix(1).uppercased())\(r.analyte.dropFirst()) \(formatValue(v)) \(r.unit)"
            c.value = v
            c.unit = r.unit
            c.thresholdText = "\(r.thresholdText)\(ulnText)"
            c.action = f.text
            c.withheld = f.withheld
            c.addAs = r.addAs
            c.level = r.level
            c.diagnosisHint = r.diagnosisHint
            c.sources = refs(content, r.sources)
            cards.append(c)
        }
        return cards.filter { c in
            guard let rule = content.resultActions.first(where: { $0.id == c.id }), let sup = rule.supersededBy else { return true }
            return !fired.contains(sup)
        }
    }

    // MARK: - Patient factors

    static let factorOrder: [String] = [
        "age65to79", "age80plus", "cfs5to6", "cfs7plus", "asa3", "asa4plus", "egfr30to59", "egfrBelow30",
        "anticoagulated", "doacOnly", "antiplatelet", "hasBled3plus", "pregnant", "penicillinAllergy", "diabetes",
        "immunosuppressed", "bmi40plus", "news2High", "shock", "recentSurgery21d", "appendicolith",
        "predictedSeverePancreatitis", "mechanicalValve", "recentVte3m",
    ]

    static func activeFactors(_ input: Input) -> Set<String> {
        let p = input.patient
        let scores = input.scores
        var f = Set<String>()
        if let age = p.ageYears, age >= 65, age < 80 { f.insert("age65to79") }
        if let age = p.ageYears, age >= 80 { f.insert("age80plus") }
        let cfs = p.cfs ?? scoreValue(scores, "cfs")
        if let v = cfs, v >= 5, v <= 6 { f.insert("cfs5to6") }
        if let v = cfs, v >= 7 { f.insert("cfs7plus") }
        let asa = p.asa ?? scoreValue(scores, "asa")
        if let v = asa, v == 3 { f.insert("asa3") }
        if let v = asa, v >= 4 { f.insert("asa4plus") }
        if let e = p.egfr, e >= 30, e < 60 { f.insert("egfr30to59") }
        if let e = p.egfr, e < 30 { f.insert("egfrBelow30") }
        if p.anticoagulant == "vka" || p.anticoagulant == "doac" { f.insert("anticoagulated") }
        if p.anticoagulant == "doac" { f.insert("doacOnly") }
        if p.antiplatelet { f.insert("antiplatelet") }
        let hasBled = p.hasBled ?? scoreValue(scores, "has-bled")
        if let v = hasBled, v >= 3 { f.insert("hasBled3plus") }
        if p.pregnancy == "pregnant" { f.insert("pregnant") }
        if p.allergyClasses.contains("penicillin") { f.insert("penicillinAllergy") }
        if p.diabetes { f.insert("diabetes") }
        if p.immunosuppressed { f.insert("immunosuppressed") }
        if let b = p.bmi, b >= 40 { f.insert("bmi40plus") }
        let news2 = p.news2 ?? scoreValue(scores, "news2")
        if let v = news2, v >= 7 { f.insert("news2High") }
        let lactate = input.labs["lactate"]
        if (p.sbp.map { $0 < 90 } ?? false) || (lactate.map { $0 >= 4 } ?? false) { f.insert("shock") }
        if let d = p.recentSurgeryDays, d >= 0, d <= 21 { f.insert("recentSurgery21d") }
        if p.appendicolith { f.insert("appendicolith") }
        let severe = ["glasgow-imrie", "bisap", "ranson"].contains { k in (scoreValue(scores, k).map { $0 >= 3 } ?? false) }
        // Severity named in the confirmed diagnosis ("severe", "moderately severe", "necrotising",
        // "organ failure" — revised Atlanta 2012).
        let namedSevere = input.diagnoses.contains { d in
            d.confirmed && keywordAt(d.name, "pancreatitis")
                && ["severe", "necrotis", "necrotiz", "organ failure"].contains { keywordAt(d.name, $0) }
        }
        if severe || namedSevere { f.insert("predictedSeverePancreatitis") }
        if p.mechanicalValve { f.insert("mechanicalValve") }
        if p.recentVte3m { f.insert("recentVte3m") }
        return f
    }

    // MARK: - Thresholds (Pauker–Kassirer)

    struct Thresholds {
        let test: Double?
        let treat: Double
    }

    /// Test / test-treatment thresholds; without a useful test, the treatment threshold.
    static func thresholds(_ b: Double, _ h: Double, _ test: Test?) -> Thresholds {
        if b <= 0 { return Thresholds(test: nil, treat: 1) }
        let treat = h <= 0 ? 0 : h / (h + b)
        guard let t = test else { return Thresholds(test: nil, treat: treat) }
        let se = t.sensitivity
        let sp = t.specificity
        let r = t.harm
        let tt = clamp(((1 - sp) * h + r) / ((1 - sp) * h + se * b), 0, 1)
        let ttx = clamp((sp * h - r) / (sp * h + (1 - se) * b), 0, 1)
        if !(tt < ttx) { return Thresholds(test: nil, treat: treat) }
        return Thresholds(test: tt, treat: ttx)
    }

    static func bandFor(_ p: Double?, _ t: Thresholds) -> Band {
        guard let p = p else { return .unknown }
        if let test = t.test, p < test { return .observe }
        if p >= t.treat { return .treat }
        return t.test != nil ? .test : .observe
    }

    /// Odds-scale adjustment of a probability.
    static func applyOR(_ h: Double, _ or: Double) -> Double {
        let base = clamp(h, 0, 0.99)
        if or == 1 { return base }
        let odds = base / (1 - base)
        let o2 = odds * or
        return clamp(o2 / (1 + o2), 0, 0.99)
    }

    struct Personalised {
        let benefit: Triple
        let harm: Triple
    }

    static func personalise(_ o: Option, _ mods: [Modifier]) -> Personalised {
        var orr: [Double] = [1, 1, 1]
        var bx: [Double] = [1, 1, 1]
        var ba: [Double] = [0, 0, 0]
        for m in mods {
            for i in 0..<3 {
                if let h = m.harmOR { orr[i] = orr[i] * h.at(i) }
                if let x = m.benefitX { bx[i] = bx[i] * x.at(i) }
                if let a = m.benefitAdd { ba[i] = ba[i] + a.at(i) }
            }
        }
        let harm = Triple(applyOR(o.harm.low, orr[0]), applyOR(o.harm.point, orr[1]), applyOR(o.harm.high, orr[2]))
        let dh0 = harm.low - o.harm.low
        let dh1 = harm.point - o.harm.point
        let dh2 = harm.high - o.harm.high
        let inD: Double = (o.harmInDiseased ?? true) ? 1 : 0
        let benefit = Triple(
            clamp(o.benefit.low * bx[0] + ba[0] - inD * dh2, -0.99, 0.99),
            clamp(o.benefit.point * bx[1] + ba[1] - inD * dh1, -0.99, 0.99),
            clamp(o.benefit.high * bx[2] + ba[2] - inD * dh0, -0.99, 0.99))
        return Personalised(benefit: benefit, harm: harm)
    }

    static func modifierApplies(_ m: Modifier, _ o: Option) -> Bool {
        if let cls = m.requiresAllergyClass, !(o.allergyClasses ?? []).contains(cls) { return false }
        if let opts = m.options, opts.contains(o.id) { return true }
        if let kinds = m.kinds, kinds.contains(o.kind) { return true }
        return false
    }

    static func effectOf(_ m: Modifier) -> String {
        if m.exclude == true { return "excluded" }
        if let h = m.harmOR { return h.point >= 1 ? "harm-up" : "harm-down" }
        if let x = m.benefitX { return x.point >= 1 ? "benefit-up" : "benefit-down" }
        return (m.benefitAdd?.point ?? 0) >= 0 ? "benefit-up" : "benefit-down"
    }

    static func effectWords(_ effect: String) -> String {
        switch effect {
        case "harm-up": return "raised the harm of"
        case "harm-down": return "lowered the harm of"
        case "benefit-up": return "raised the benefit of"
        case "benefit-down": return "lowered the benefit of"
        default: return "excluded"
        }
    }

    /// "Early laparoscopic cholecystectomy" → "early laparoscopic cholecystectomy"; "IV antibiotics" kept.
    static func lowerFirst(_ label: String) -> String {
        let first = label.split(separator: " ", omittingEmptySubsequences: false).first.map(String.init) ?? ""
        let capitals = first.filter { ("A"..."Z").contains($0) }.count
        if capitals >= 2 || label.isEmpty { return label }
        return label.prefix(1).lowercased() + label.dropFirst()
    }

    private static let roman = ["0", "I", "II", "III", "IV", "V", "VI"]

    /// The factor as the patient has it ("Frailty CFS 7", "eGFR 28", "Age 88"); else the content label.
    static func factorLabel(_ factor: String, _ fallback: String, _ input: Input) -> String {
        let p = input.patient
        let scores = input.scores
        switch factor {
        case "age65to79", "age80plus":
            if let a = p.ageYears { return "Age \(formatValue(a.rounded(.down)))" }
            return fallback
        case "cfs5to6", "cfs7plus":
            if let v = p.cfs ?? scoreValue(scores, "cfs") { return "Frailty CFS \(formatValue(v))" }
            return fallback
        case "asa3", "asa4plus":
            if let v = p.asa ?? scoreValue(scores, "asa"), isWhole(v), v >= 1, v <= 6 { return "ASA \(roman[Int(v)])" }
            return fallback
        case "egfr30to59", "egfrBelow30":
            if let e = p.egfr { return "eGFR \(formatValue(jsRound(e)))" }
            return fallback
        case "bmi40plus":
            if let b = p.bmi { return "BMI \(formatValue(jsRound(b)))" }
            return fallback
        case "news2High":
            if let v = p.news2 ?? scoreValue(scores, "news2") { return "NEWS2 \(formatValue(v))" }
            return fallback
        case "hasBled3plus":
            if let v = p.hasBled ?? scoreValue(scores, "has-bled") { return "HAS-BLED \(formatValue(v))" }
            return fallback
        case "shock":
            if let s = p.sbp, s < 90 { return "Shock (SBP \(formatValue(s)))" }
            if let l = input.labs["lactate"] { return "Shock (lactate \(formatValue(l)))" }
            return fallback
        default:
            return fallback
        }
    }

    static func joinAnd(_ items: [String]) -> String {
        if items.count <= 1 { return items.joined() }
        return "\(items.dropLast().joined(separator: ", ")) and \(items[items.count - 1])"
    }

    static func netAt(_ p: Double, _ b: Double, _ h: Double) -> Double { p * b - (1 - p) * h }

    // MARK: - Options

    static func evaluateOption(_ def: Decision, _ o: Option, _ p: Double?, _ active: Set<String>,
                               _ content: Content, _ filter: LineFilter, _ input: Input) -> OptionResult {
        let all = (content.modifiers + def.modifiers).filter { modifierApplies($0, o) && active.contains($0.factor) }
        let excluding = all.filter { $0.exclude == true }
        let numeric = all.filter { $0.exclude != true }
        let pers = personalise(o, numeric)
        let test = def.test
        let tPoint = thresholds(pers.benefit.point, pers.harm.point, test)
        let tOpt = thresholds(pers.benefit.high, pers.harm.low, test)
        let tPess = thresholds(pers.benefit.low, pers.harm.high, test)

        let plan = filter(o.planLine)
        let observe = filter(o.observeText)
        let excludedReason: String? = excluding.isEmpty ? nil
            : excluding.map { "\(factorLabel($0.factor, $0.label, input)): \($0.reason)" }.joined(separator: " ")
        let withheldText: String? = plan.withheld ? plan.text : nil

        var r = OptionResult()
        if excludedReason != nil || withheldText != nil {
            r.band = .notForPatient
            r.bandRange = [.notForPatient]
        } else {
            r.band = bandFor(p, tPoint)
            let set: Set<String> = [bandFor(p, tPess).rawValue, r.band.rawValue, bandFor(p, tOpt).rawValue]
            r.bandRange = p == nil ? [Band.unknown] : [Band.observe, Band.test, Band.treat].filter { set.contains($0.rawValue) }
        }

        let pp = p ?? 0
        let expectedBenefit = Triple(pp * pers.benefit.low, pp * pers.benefit.point, pp * pers.benefit.high)
        let expectedHarm = Triple((1 - pp) * pers.harm.low, (1 - pp) * pers.harm.point, (1 - pp) * pers.harm.high)
        let net = Triple(netAt(pp, pers.benefit.low, pers.harm.high),
                         netAt(pp, pers.benefit.point, pers.harm.point),
                         netAt(pp, pers.benefit.high, pers.harm.low))

        // What moved it: each numeric factor removed in turn (others kept).
        var factors: [Factor] = excluding.map { m -> Factor in
            Factor(modifierId: m.id, factor: m.factor, label: factorLabel(m.factor, m.label, input), effect: "excluded",
                   reason: m.reason, thresholdShift: 0, netShift: 0, evidence: m.evidence, sources: refs(content, m.sources))
        }
        var shifted: [Factor] = []
        for (i, m) in numeric.enumerated() {
            let others = numeric.enumerated().filter { $0.offset != i }.map(\.element)
            let without = personalise(o, others)
            let tw = thresholds(without.benefit.point, without.harm.point, test)
            shifted.append(Factor(
                modifierId: m.id, factor: m.factor, label: factorLabel(m.factor, m.label, input), effect: effectOf(m),
                reason: m.reason,
                thresholdShift: round4(tPoint.treat - tw.treat),
                netShift: round4(netAt(pp, pers.benefit.point, pers.harm.point) - netAt(pp, without.benefit.point, without.harm.point)),
                evidence: m.evidence, sources: refs(content, m.sources)))
        }
        let ordered = shifted.enumerated().sorted { a, b in
            let ta = abs(a.element.thresholdShift), tb = abs(b.element.thresholdShift)
            if ta != tb { return ta > tb }
            let na = abs(a.element.netShift), nb = abs(b.element.netShift)
            if na != nb { return na > nb }
            return a.offset < b.offset
        }.map(\.element)
        factors.append(contentsOf: ordered)
        let topFactors = Array(factors.prefix(3))

        var summary: String? = nil
        if !excluding.isEmpty {
            summary = "\(joinAnd(excluding.map { factorLabel($0.factor, $0.label, input) })): \(lowerFirst(o.label)) is not for this patient."
        } else if !topFactors.isEmpty {
            let base = thresholds(o.benefit.point, o.harm.point, test)
            var groups: [String] = []
            for effect in ["harm-up", "benefit-down", "benefit-up", "harm-down"] {
                let labels = topFactors.filter { $0.effect == effect }.map(\.label)
                if !labels.isEmpty { groups.append("\(joinAnd(labels)) \(effectWords(effect)) \(lowerFirst(o.label))") }
            }
            summary = "\(groups.joined(separator: "; ")) (treat threshold \(formatPercent(base.treat)) → \(formatPercent(tPoint.treat)))."
        }

        switch r.band {
        case .treat:
            r.suggestedLine = plan.text
            r.suggestedAddAs = o.addAs
        case .test:
            if let t = test {
                r.suggestedLine = t.label
                r.suggestedAddAs = "test"
            }
        case .observe:
            r.suggestedLine = observe.withheld ? nil : observe.text
            r.suggestedAddAs = observe.withheld ? nil : "plan"
        default:
            break
        }

        let sources = refs(content, o.sources)
        r.id = o.id
        r.label = o.label
        r.kind = o.kind
        r.borderline = r.bandRange.count > 1
        r.treatThreshold = round4(Triple(tOpt.treat, tPoint.treat, tPess.treat))
        if let pt = tPoint.test {
            r.testThreshold = round4(Triple(tOpt.test ?? pt, pt, tPess.test ?? pt))
        }
        r.benefit = round4(pers.benefit)
        r.harm = round4(pers.harm)
        r.expectedBenefit = round4(expectedBenefit)
        r.expectedHarm = round4(expectedHarm)
        r.net = round4(net)
        r.excludedReason = excludedReason
        r.withheldText = withheldText
        r.factors = factors
        r.topFactors = topFactors
        r.factorSummary = summary
        r.planLine = plan.text
        r.observeText = observe.text
        r.evidence = o.evidence
        r.lowEvidence = o.evidence == "estimate" || o.evidence == "low"
        r.fromMemory = sources.contains { $0.fromMemory }
        r.sources = sources
        r.note = o.note
        return r
    }

    // MARK: - Decisions

    struct Selected {
        let def: Decision
        let p: Double?
        let source: String
        let name: String
        let chip: String
        let label: String
        let confirmed: Bool
        let index: Int
    }

    static func selectDecision(_ def: Decision, _ index: Int, _ input: Input, _ content: Content, _ factors: Set<String>) -> Selected? {
        let scores = pickScores(input.scores)
        let matches = input.diagnoses.filter { diagnosisMatches(def, $0) }
        let confirmed = matches.first(where: { $0.confirmed })
        var engine: Diagnosis? = nil
        for d in matches where !d.confirmed && d.probability != nil {
            if engine == nil || (d.probability ?? 0) > (engine?.probability ?? 0) { engine = d }
        }
        let minP = content.defaults.minEngineProbability
        // A clinician-confirmed diagnosis wins over the engine's differential (the ManagementPanel
        // rule): other leading differentials give decisions only when nothing is confirmed.
        let anyConfirmed = input.diagnoses.contains { $0.confirmed }
        let engineOk = !anyConfirmed && engine != nil && (engine?.probability ?? 0) >= minP

        if def.type == "diagnosis" {
            let pre = def.pretestScore.flatMap { key in scores.first(where: { $0.key == key }) }
            let preSet = pre.flatMap { p in content.scoreActions.first(where: { $0.score == p.key }) }
            var preBand: ScoreBand? = nil
            if let p = pre, let s = preSet { preBand = scoreBand(s, p) }
            if let c = confirmed {
                let p = Swift.max(content.defaults.confirmedFloor, c.probability ?? 0)
                return Selected(def: def, p: p, source: "confirmed", name: c.name, chip: "Confirmed: \(c.name)",
                                label: "P(diagnosis)", confirmed: true, index: index)
            }
            if let pr = pre, let s = preSet, let risk = preBand?.risk {
                let p = risk.point
                return Selected(def: def, p: p, source: "score", name: engine?.name ?? def.label,
                                chip: "\(s.chip) \(formatValue(pr.value)) → \(formatPercent(p)) pre-test",
                                label: "Pre-test probability", confirmed: false, index: index)
            }
            if engineOk, let e = engine {
                let p = e.probability ?? 0
                return Selected(def: def, p: p, source: "engine", name: e.name, chip: "P(\(e.name)) \(formatPercent(p))",
                                label: "P(diagnosis)", confirmed: false, index: index)
            }
            return nil
        }

        // Risk decisions.
        if let trig = def.triggerScore, !scores.contains(where: { $0.key == trig }) { return nil }
        if def.trigger == "anticoagulatedWithProcedure"
            && !(factors.contains("anticoagulated") && input.patient.procedurePlanned) { return nil }
        let matched = confirmed != nil || engineOk
        let riskScorePresent = def.riskScore.map { key in scores.contains(where: { $0.key == key }) } ?? false
        if def.triggerScore == nil && def.trigger == nil && !matched && !riskScorePresent { return nil }
        let name = confirmed?.name ?? engine?.name ?? def.label
        let riskLabel = def.riskLabel ?? "Risk"
        if let rs = def.riskScore {
            let s = scores.first(where: { $0.key == rs })
            let set = content.scoreActions.first(where: { $0.score == rs })
            var b: ScoreBand? = nil
            if let sc = s, let st = set { b = scoreBand(st, sc) }
            if let sc = s, let st = set, let risk = b?.risk {
                let p = risk.point
                return Selected(def: def, p: p, source: "risk", name: name,
                                chip: "\(st.chip) \(formatValue(sc.value)) → \(formatPercent(p)) \(st.riskLabel ?? "risk")",
                                label: st.riskLabel ?? riskLabel, confirmed: confirmed != nil, index: index)
            }
            return Selected(def: def, p: nil, source: "none", name: name, chip: "\(set?.chip ?? rs) not recorded",
                            label: riskLabel, confirmed: confirmed != nil, index: index)
        }
        var p: Double? = def.baselineRisk?.point
        var why = "baseline"
        for rf in def.riskFactors ?? [] {
            if factors.contains(rf.factor) && (p == nil || rf.risk.point > (p ?? 0)) {
                p = rf.risk.point
                why = rf.label
            }
        }
        guard let prob = p else { return nil }
        return Selected(def: def, p: prob, source: "risk", name: name, chip: "\(riskLabel) \(formatPercent(prob)) (\(why))",
                        label: riskLabel, confirmed: confirmed != nil, index: index)
    }

    static let missingFactors: [(key: String, factors: [String])] = [
        ("cfs", ["cfs5to6", "cfs7plus"]),
        ("asa", ["asa3", "asa4plus"]),
        ("egfr", ["egfr30to59", "egfrBelow30"]),
        ("pregnancy", ["pregnant"]),
        ("bmi", ["bmi40plus"]),
        ("hasBled", ["hasBled3plus"]),
        ("news2", ["news2High", "shock"]),
    ]

    static func inputMissing(_ key: String, _ input: Input) -> Bool {
        let p = input.patient
        let scores = input.scores
        switch key {
        case "cfs": return (p.cfs ?? scoreValue(scores, "cfs")) == nil && (p.ageYears == nil || (p.ageYears ?? 0) >= 65)
        case "asa": return (p.asa ?? scoreValue(scores, "asa")) == nil
        case "egfr": return p.egfr == nil
        case "pregnancy":
            let ageOk = p.ageYears == nil || ((p.ageYears ?? 0) >= 12 && (p.ageYears ?? 0) <= 55)
            return p.sex != "male" && ageOk && (p.pregnancy == "unknown" || p.pregnancy == "possible")
        case "bmi": return p.bmi == nil
        case "hasBled": return (p.hasBled ?? scoreValue(scores, "has-bled")) == nil && (p.anticoagulant == "vka" || p.anticoagulant == "doac")
        case "news2": return (p.news2 ?? scoreValue(scores, "news2")) == nil && p.sbp == nil
        default: return false
        }
    }

    static func missingFor(_ def: Decision, _ sel: Selected, _ input: Input, _ content: Content) -> [String] {
        var out: [String] = []
        if sel.p == nil, let rs = def.riskScore {
            let set = content.scoreActions.first(where: { $0.score == rs })
            out.append("Calculate the \(set?.label ?? rs) score to set the risk.")
        }
        for (key, factorIds) in missingFactors {
            if !inputMissing(key, input) { continue }
            let affected = def.options.filter { o in
                (content.modifiers + def.modifiers).contains { factorIds.contains($0.factor) && modifierApplies($0, o) }
            }
            if affected.isEmpty { continue }
            let info = content.missingInputs[key]
            out.append("Record \(info?.label ?? key) to refine: \(info?.effect ?? "") (\(affected.map { lowerFirst($0.label) }.joined(separator: "; "))).")
        }
        return out
    }

    static func evaluateDecisions(_ input: Input, _ content: Content, _ filter: LineFilter, _ factors: Set<String>) -> [DecisionResult] {
        var selected: [Selected] = []
        for (i, def) in content.decisions.enumerated() {
            if let s = selectDecision(def, i, input, content, factors) { selected.append(s) }
        }
        let ordered = selected.sorted { a, b in
            if a.confirmed != b.confirmed { return a.confirmed }
            let pa = a.p ?? -1, pb = b.p ?? -1
            if pa != pb { return pa > pb }
            return a.index < b.index
        }.prefix(content.defaults.maxDecisions)

        return ordered.map { sel -> DecisionResult in
            let def = sel.def
            var options = def.options.map { evaluateOption(def, $0, sel.p, factors, content, filter, input) }
            if sel.p != nil {
                let rankable = options.enumerated()
                    .filter { $0.element.band != .notForPatient }
                    .sorted { a, b in
                        a.element.net.point != b.element.net.point ? a.element.net.point > b.element.net.point : a.offset < b.offset
                    }
                for (r, x) in rankable.enumerated() { options[x.offset].rank = r + 1 }
            }
            let sortedOptions = options.enumerated().sorted { a, b in
                let ra = a.element.rank ?? 99, rb = b.element.rank ?? 99
                return ra != rb ? ra < rb : a.offset < b.offset
            }.map(\.element)
            var d = DecisionResult()
            d.id = def.id
            d.label = def.label
            d.type = def.type
            d.diagnosisName = sel.name
            d.probability = sel.p.map { round4($0) }
            d.probabilitySource = sel.source
            d.probabilityLabel = sel.label
            d.chip = sel.chip
            if let t = def.test {
                d.test = TestInfo(label: t.label, sensitivity: t.sensitivity, specificity: t.specificity, sources: refs(content, t.sources))
            }
            d.options = sortedOptions
            d.missing = missingFor(def, sel, input, content)
            return d
        }
    }

    static func decisionSupport(_ input: Input, _ content: Content, _ filter: @escaping LineFilter) -> Result {
        let factors = activeFactors(input)
        var r = Result()
        r.contentVersion = content.version
        r.scoreActions = scoreActions(input, content, filter)
        r.resultActions = resultActions(input, content, filter)
        r.decisions = evaluateDecisions(input, content, filter, factors)
        r.activeFactors = factorOrder.filter { factors.contains($0) }
        return r
    }

    // MARK: - Summary lines (clinical-validation harness ios.decisions; identical to the web)

    static func bandWord(_ b: Band) -> String {
        switch b {
        case .observe: return "OBSERVE"
        case .test: return "TEST FURTHER"
        case .treat: return "TREAT"
        case .notForPatient: return "NOT FOR THIS PATIENT"
        case .unknown: return "RISK NOT KNOWN"
        }
    }

    static func summaryLines(_ r: Result) -> [SummaryLine] {
        var out: [SummaryLine] = []
        for c in r.resultActions { out.append(SummaryLine(kind: "management", text: "Result action — \(c.chip): \(c.label) — \(c.action)")) }
        for c in r.scoreActions { out.append(SummaryLine(kind: "management", text: "Score action — \(c.chip): \(c.band) — \(c.action)")) }
        for d in r.decisions {
            let pText = d.probability.map { "P \(formatPercent($0))" } ?? "P not known"
            let head = "Decision \(d.label) (\(d.chip); \(pText))"
            for o in d.options {
                if o.band == .unknown { continue }
                if o.band == .notForPatient {
                    out.append(SummaryLine(kind: "safety", text: "\(head) — not for this patient: \(o.label) — \(o.withheldText ?? o.excludedReason ?? "")"))
                    continue
                }
                var thr = "treat threshold \(formatPercent(o.treatThreshold.point))"
                if let t = o.testThreshold { thr += ", test threshold \(formatPercent(t.point))" }
                var tailParts = [thr]
                if o.borderline { tailParts.append("borderline across the evidence range") }
                if let s = o.factorSummary { tailParts.append(s) }
                let tail = tailParts.joined(separator: "; ")
                let rank = "rank \(o.rank.map { String($0) } ?? "-")"
                switch o.band {
                case .treat:
                    out.append(SummaryLine(kind: "management", text: "\(head) — \(rank): \(o.label) — \(bandWord(.treat)): \(o.suggestedLine ?? o.planLine) (\(tail))"))
                case .test:
                    out.append(SummaryLine(kind: "management", text: "\(head) — \(rank): \(o.label) — \(bandWord(.test)): \(o.suggestedLine ?? "") (\(tail))"))
                default:
                    out.append(SummaryLine(kind: "management", text: "\(head) — \(rank): \(bandWord(.observe)) rather than \(lowerFirst(o.label)): \(o.suggestedLine ?? o.observeText) (\(tail))"))
                }
            }
            for m in d.missing { out.append(SummaryLine(kind: "info", text: "Decision \(d.label) — missing: \(m)")) }
        }
        return out
    }
}
