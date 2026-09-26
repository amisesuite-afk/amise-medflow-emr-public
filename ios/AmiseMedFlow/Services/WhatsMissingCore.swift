// WhatsMissingCore.swift
// "What's missing" — one ranked, de-duplicated list of the gaps the engines already know about.
//
// DRIFT NOTE: Swift twin of lib/pane-engine/src/whats-missing/engine.ts — same rules JSON
// (Resources/WhatsMissingRules.json), same vectors (AmiseMedFlowTests/WhatsMissing/
// whats-missing-vectors.json, asserted by WhatsMissingTests and by the web vitest). Keep the
// signal order, the ranking keys and every text identical.
//
// Ranking (explainable, lexicographic): 1. tier — safety (cannot prescribe or dose safely without
// it) → decision → score completeness; 2. within safety the fixed order of the rules, within
// decision a band flip (closest to its threshold first) → a missing risk score → ferritin → the
// best next discriminator, within score the input needed by the most scores first; 3. the rules'
// group order. Signals sharing a group (same field or same test) become one item.
//
// Suggestions only: an action jumps to a field or adds a test as "suggested"; nothing is ordered or
// recorded automatically. Pure: no Patient, no SwiftData (the adapter is WhatsMissingPatient.swift).

import Foundation

extension WhatsMissing {

    // MARK: - Inputs (Decodable so the shared vectors decode straight into them)

    struct Vitals: Decodable {
        var hr: Double?
        var sbp: Double?
        var dbp: Double?
        var rr: Double?
        var tempC: Double?
        var spo2: Double?
        /// ACVPU "A" | "C" | "V" | "P" | "U"; nil = not recorded.
        var avpu: String?
        /// Supplemental oxygen; nil = not recorded.
        var onOxygen: Bool?
    }

    /// wbc ×10⁹/L (> 100 read as cells/µL); neutrophils as recorded (% when > 20, else ×10⁹/L);
    /// crp mg/L; urea mmol/L; hb g/dL (> 25 read as g/L); creatinine µmol/L (< 15 read as mg/dL);
    /// egfr mL/min; bilirubin µmol/L; albumin g/L; inr.
    struct Labs: Decodable {
        var wbc: Double?
        var neutrophils: Double?
        var crp: Double?
        var urea: Double?
        var hb: Double?
        var creatinine: Double?
        var egfr: Double?
        var bilirubin: Double?
        var albumin: Double?
        var inr: Double?
    }

    /// The record as the adapter reads it (latest values; nil = not recorded).
    struct Record: Decodable {
        var ageYears: Double?
        /// "male" | "female" | "unknown"
        var sex: String
        var weightKg: Double?
        var heightCm: Double?
        var vitals: Vitals
        var labs: Labs
        var imagingReported: Bool
        var pleuralEffusion: Bool
        /// cancer, priorDvt, priorPe, chf, ihd, cva, insulin, liverDisease, ibd, varicoseVeins, ocpHrt,
        /// immobile, pregnant, recentSurgery4w, recentSurgery12w (affirmed = true).
        var history: [String: Bool]
        /// migration, anorexia, nausea, vomiting, rifPain, rifTenderness, rebound, melaena, syncope,
        /// haemoptysis, dvtSigns, confusion (affirmed = true).
        var findings: [String: Bool]

        func h(_ key: String) -> Bool { history[key] ?? false }
        func f(_ key: String) -> Bool { findings[key] ?? false }

        static func empty() -> Record {
            Record(ageYears: nil, sex: "unknown", weightKg: nil, heightCm: nil, vitals: Vitals(), labs: Labs(),
                   imagingReported: false, pleuralEffusion: false, history: [:], findings: [:])
        }
    }

    struct Facts: Decodable {
        var allergyStatusRecorded: Bool
        var pregnancyStatusRecorded: Bool
        var supplementsAsked: Bool
        var medications: [String]
        var plannedMedications: [String]
        var medicationNotes: String
        var plannedInvestigations: [String]
        var procedurePlanned: Bool
        var acute: Bool
    }

    struct Discriminator: Decodable {
        var label: String
        /// "ask" | "bedside" | "lab" | "imaging" | "advanced"
        var kind: String
        var separates: [String]
        /// A working diagnosis is confirmed: the discriminator ranks after score completeness.
        var confirmed: Bool
    }

    struct Flip: Decodable, Equatable {
        var option: String
        /// Band raw values: "observe" | "test" | "treat" | "not-for-patient".
        var from: String
        var to: String
    }

    struct DecisionGap: Decodable, Equatable {
        /// "cfs" | "asa" | "egfr" | "pregnancy" | "bmi" | "hasBled" | "news2" | "score:<key>"
        var key: String
        var decisionId: String
        var decisionLabel: String
        var effect: String
        var flip: Flip?
        var distance: Double?
    }

    struct Input: Decodable {
        var record: Record
        var facts: Facts
        var activeScores: [String]
        var decisionGaps: [DecisionGap]
        var ferritinMissing: Bool
        var discriminator: Discriminator?
    }

    // MARK: - Outputs

    struct Action: Equatable {
        /// "field" | "test"
        var kind: String
        var field: String?
        var test: String?

        init(kind: String, field: String? = nil, test: String? = nil) {
            self.kind = kind
            self.field = field
            self.test = test
        }

        init(_ rule: ActionRule) {
            self.init(kind: rule.kind, field: rule.field, test: rule.test)
        }
    }

    struct Item: Identifiable, Equatable {
        /// Group id (de-duplication key).
        var id: String
        /// "safety" | "decision" | "score"
        var tier: String
        var what: String
        var why: String
        var also: [String]
        var action: Action
        var alt: Action?
        var sources: [String]
    }

    struct Result {
        var version: String
        var topN: Int
        var items: [Item]
    }

    // MARK: - Text helpers (identical on the web)

    static func isWordChar(_ c: Character) -> Bool { c.isLetter || c.isNumber }

    /// `term` at a word start (case-insensitive); a term of 4 characters or fewer must also end at a
    /// word boundary ("ct" is "CT abdomen", never "act"; "tia" never "initial").
    static func termIn(_ text: String, _ term: String) -> Bool {
        let t = Array(text.lowercased())
        let k = Array(term.lowercased())
        guard !k.isEmpty, k.count <= t.count else { return false }
        var i = 0
        while i + k.count <= t.count {
            if t[i..<(i + k.count)].elementsEqual(k) {
                let before = i > 0 && isWordChar(t[i - 1]) && isWordChar(k[0])
                let after = i + k.count
                let joined = k.count <= 4 && after < t.count && isWordChar(t[after]) && isWordChar(k[k.count - 1])
                if !before && !joined { return true }
            }
            i += 1
        }
        return false
    }

    /// The terms found in any of `texts`, in the order of `terms`.
    static func termsFound(_ texts: [String], _ terms: [String]) -> [String] {
        terms.filter { term in texts.contains { termIn($0, term) } }
    }

    /// "a", "a and b", "a, b and c".
    static func joinParts(_ parts: [String]) -> String {
        if parts.count <= 1 { return parts.first ?? "" }
        return parts.dropLast().joined(separator: ", ") + " and " + (parts.last ?? "")
    }

    static func capitalise(_ s: String) -> String {
        s.isEmpty ? s : s.prefix(1).uppercased() + s.dropFirst()
    }

    /// Replaces every {key} (word characters) with its value, or "" when the key is not given.
    static func fill(_ template: String, _ values: [String: String]) -> String {
        var out = ""
        var i = template.startIndex
        while i < template.endIndex {
            let c = template[i]
            if c == "{" {
                var j = template.index(after: i)
                var key = ""
                while j < template.endIndex, template[j].isLetter || template[j].isNumber || template[j] == "_" {
                    key.append(template[j])
                    j = template.index(after: j)
                }
                if !key.isEmpty, j < template.endIndex, template[j] == "}" {
                    out += values[key] ?? ""
                    i = template.index(after: j)
                    continue
                }
            }
            out.append(c)
            i = template.index(after: i)
        }
        return out
    }

    /// 30 → "30", 30.5 → "30.5" (JavaScript String(number)).
    static func numberText(_ x: Double) -> String {
        x.truncatingRemainder(dividingBy: 1) == 0 && abs(x) < 1e15 ? String(Int(x)) : String(x)
    }

    // MARK: - Signals

    struct Signal {
        var group: String
        var tier: String
        var sub: Double
        var secondary: Double
        var parts: [String]
        var why: String
        var source: String
        var scoreLabel: String? = nil
        var what: String? = nil
        var action: Action? = nil
    }

    static func tierIndex(_ tier: String) -> Double {
        switch tier {
        case "safety": return 0
        case "decision": return 1
        default: return 2
        }
    }

    static func groupRule(_ rules: Rules, _ id: String) -> GroupRule? {
        rules.groups.first { $0.id == id }
    }

    static func groupOrder(_ rules: Rules, _ id: String) -> Double {
        if let i = rules.groups.firstIndex(where: { $0.id == id }) { return Double(i) }
        return Double(id.hasPrefix("score:") ? rules.groups.count : rules.groups.count + 1)
    }

    static func scoreLabel(_ rules: Rules, _ key: String) -> String {
        rules.scores.first { $0.id == key }?.label ?? key
    }

    static func safetySignals(_ input: Input, _ rules: Rules) -> [Signal] {
        let r = input.record
        let facts = input.facts
        let th = rules.thresholds
        let tx = rules.text
        var out: [Signal] = []
        func s(_ group: String, _ why: String, _ parts: [String] = []) -> Signal {
            Signal(group: group, tier: "safety", sub: groupRule(rules, group)?.safetyOrder ?? 9, secondary: 0,
                   parts: parts, why: why, source: "safety")
        }
        let age = r.ageYears
        if let age = age, age < th.weightAgeBelow, r.weightKg == nil {
            out.append(s("weight", fill(tx.weightWhy, ["age": numberText(th.weightAgeBelow)]), ["weight"]))
        }
        if !facts.allergyStatusRecorded { out.append(s("allergy", tx.allergyWhy)) }
        let imaging = facts.plannedInvestigations.first { n in rules.terms.ionisingImaging.contains { termIn(n, $0) } }
        if r.sex == "female", let age = age, age >= th.pregnancyAgeMin, age <= th.pregnancyAgeMax,
           !facts.pregnancyStatusRecorded,
           imaging != nil || !facts.plannedMedications.isEmpty || facts.procedurePlanned {
            let reason: String
            if let imaging = imaging {
                reason = fill(tx.pregnancyReasonImaging, ["name": imaging.trimmingCharacters(in: .whitespacesAndNewlines)])
            } else {
                reason = facts.procedurePlanned ? tx.pregnancyReasonProcedure : tx.pregnancyReasonDrugs
            }
            out.append(s("pregnancy", fill(tx.pregnancyWhy, ["age": numberText(age), "reason": reason])))
        }
        let renalKnown = r.labs.egfr != nil || r.labs.creatinine != nil
        if !renalKnown {
            let drugs = termsFound(facts.medications + facts.plannedMedications, rules.terms.renalDrugs)
            let contrast = facts.plannedInvestigations.contains { n in rules.terms.contrast.contains { termIn(n, $0) } }
            if !drugs.isEmpty {
                out.append(s("renal", fill(tx.renalWhyDrugs, ["drugs": joinParts(drugs)]), ["egfr"]))
            } else if contrast {
                out.append(s("renal", tx.renalWhyContrast, ["egfr"]))
            }
        }
        if facts.procedurePlanned {
            let anticoag = termsFound(facts.medications, rules.terms.anticoagulants)
            let notes = ([facts.medicationNotes] + facts.medications).joined(separator: "\n")
            if !anticoag.isEmpty, !rules.terms.lastDose.contains(where: { termIn(notes, $0) }) {
                out.append(s("anticoag-last-dose", fill(tx.anticoagWhy, ["drugs": capitalise(joinParts(anticoag))])))
            }
            if !facts.supplementsAsked { out.append(s("supplements", tx.supplementsWhy)) }
        }
        return out
    }

    /// One signal per group of the given concepts (concepts in their given order within a group).
    static func conceptSignals(_ rules: Rules, _ concepts: [String], _ base: Signal) -> [Signal] {
        var groups: [String] = []
        var byGroup: [String: [String]] = [:]
        for c in concepts {
            guard let cp = rules.concepts.first(where: { $0.id == c }) else { continue }
            if byGroup[cp.group] == nil { byGroup[cp.group] = []; groups.append(cp.group) }
            if !(byGroup[cp.group] ?? []).contains(c) { byGroup[cp.group]?.append(c) }
        }
        return groups.map { g in
            var s = base
            s.group = g
            s.parts = byGroup[g] ?? []
            return s
        }
    }

    static func scoreSignals(_ input: Input, _ rules: Rules) -> [Signal] {
        var out: [Signal] = []
        let r = input.record
        let obs = missingObservations(r)
        let anyObs = obs.count < 7
        let news2Base = Signal(group: "", tier: "score", sub: 0, secondary: 0, parts: [], why: "", source: "news2", scoreLabel: "NEWS2")
        if anyObs && !obs.isEmpty {
            var b = news2Base; b.why = rules.text.news2PartialWhy
            out += conceptSignals(rules, obs, b)
        } else if !anyObs && input.facts.acute {
            var b = news2Base; b.why = rules.text.news2NoneWhy
            out += conceptSignals(rules, obs, b)
        }
        var seen: Set<String> = ["news2"]
        for key in input.activeScores {
            if seen.contains(key) || !fillableScores.contains(key) { continue }
            seen.insert(key)
            let missing = scoreRecordFill(key, r, rules).missing
            let label = scoreLabel(rules, key)
            let b = Signal(group: "", tier: "score", sub: 0, secondary: 0, parts: [],
                           why: fill(rules.text.scoreWhy, ["scores": label]), source: "score:\(key)", scoreLabel: label)
            out += conceptSignals(rules, missing, b)
        }
        return out
    }

    static func decisionSignals(_ input: Input, _ rules: Rules) -> [Signal] {
        var out: [Signal] = []
        let tx = rules.text
        let r = input.record
        for g in input.decisionGaps {
            let source = "decision:\(g.decisionId)"
            let decision = TreatmentDecisions.lowerFirst(g.decisionLabel)
            if g.key.hasPrefix("score:") {
                let key = String(g.key.dropFirst("score:".count))
                out.append(Signal(group: g.key, tier: "decision", sub: 1, secondary: 0, parts: [],
                                  why: fill(tx.riskScoreWhy, ["decision": decision]), source: source,
                                  what: fill(tx.scoreWhat, ["score": scoreLabel(rules, key)]),
                                  action: Action(kind: "field", field: g.key)))
                continue
            }
            guard let di = rules.decisionInputs.first(where: { $0.key == g.key }) else { continue }
            var parts: [String] = di.concept.map { [$0] } ?? []
            if g.key == "bmi" {
                parts = (di.concepts ?? []).filter { ($0 == "height" ? r.heightCm : r.weightKg) == nil }
            }
            if g.key == "news2" {
                let obs = missingObservations(r)
                parts = obs.isEmpty ? (di.concepts ?? []) : obs
            }
            let why: String
            if let flip = g.flip {
                why = fill(tx.decisionFlipWhy, [
                    "from": tx.bandLabels[flip.from] ?? flip.from, "to": tx.bandLabels[flip.to] ?? flip.to,
                    "option": TreatmentDecisions.lowerFirst(flip.option), "decision": decision,
                ])
            } else {
                why = fill(tx.decisionRefineWhy, ["decision": decision, "effect": g.effect])
            }
            out.append(Signal(group: di.group, tier: g.flip != nil ? "decision" : "score", sub: g.flip != nil ? 0 : 1,
                              secondary: g.flip != nil ? (g.distance ?? 1) : 0, parts: parts, why: why, source: source))
        }
        if input.ferritinMissing {
            out.append(Signal(group: "ferritin", tier: "decision", sub: 2, secondary: 0, parts: [], why: tx.ferritinWhy, source: "ng12"))
        }
        if let d = input.discriminator {
            let label = d.label.trimmingCharacters(in: .whitespacesAndNewlines)
            if !label.isEmpty {
                let test = d.kind == "lab" || d.kind == "imaging" || d.kind == "advanced"
                out.append(Signal(group: "discriminator", tier: d.confirmed ? "score" : "decision", sub: d.confirmed ? 2 : 3,
                                  secondary: 0, parts: [],
                                  why: fill(tx.discriminatorWhy, ["separates": joinParts(d.separates)]), source: "reasoning",
                                  what: fill(tx.discriminatorWhat, ["label": label]),
                                  action: test ? Action(kind: "test", test: label)
                                               : Action(kind: "field", field: d.kind == "ask" ? "history" : "exam")))
            }
        }
        return out
    }

    // MARK: - Merge and rank

    static func compareKeys(_ a: [Double], _ b: [Double]) -> Int {
        for i in 0..<max(a.count, b.count) {
            let d = (i < a.count ? a[i] : 0) - (i < b.count ? b[i] : 0)
            if d < 0 { return -1 }
            if d > 0 { return 1 }
        }
        return 0
    }

    static func signalKey(_ s: Signal, _ rules: Rules, _ scoreCount: Int) -> [Double] {
        let secondary = s.tier == "score" && s.sub == 0 ? -Double(scoreCount) : s.secondary
        return [tierIndex(s.tier), s.sub, secondary, groupOrder(rules, s.group)]
    }

    static func whatsMissing(_ input: Input, rules: Rules) -> Result {
        let signals = safetySignals(input, rules) + decisionSignals(input, rules) + scoreSignals(input, rules)
        var groups: [String] = []
        var byGroup: [String: [Signal]] = [:]
        for s in signals {
            if byGroup[s.group] == nil { byGroup[s.group] = []; groups.append(s.group) }
            byGroup[s.group]?.append(s)
        }

        var ranked: [(key: [Double], order: Int, item: Item)] = []
        for (order, group) in groups.enumerated() {
            let list = byGroup[group] ?? []
            var scoreLabels: [String] = []
            for s in list { if let l = s.scoreLabel, !scoreLabels.contains(l) { scoreLabels.append(l) } }
            let keyed = list.enumerated()
                .map { (s: $0.element, i: $0.offset, key: signalKey($0.element, rules, scoreLabels.count)) }
                .sorted { a, b in
                    let c = compareKeys(a.key, b.key)
                    return c != 0 ? c < 0 : a.i < b.i
                }
            guard let bestEntry = keyed.first else { continue }
            let best = bestEntry.s
            let rule = groupRule(rules, group)

            let partIds = Set(list.flatMap { $0.parts })
            let parts = rules.concepts.filter { partIds.contains($0.id) }.map { $0.part }
            var what = best.what ?? rule?.what ?? group
            if let pw = rule?.partsWhat, !parts.isEmpty {
                what = pw.contains("{Parts}")
                    ? fill(pw, ["Parts": capitalise(joinParts(parts))])
                    : fill(pw, ["parts": joinParts(parts)])
            }

            var whys: [String] = []
            var scoreWhyAdded = false
            let fromScores = scoreLabels.filter { $0 != "NEWS2" }
            for entry in keyed {
                var why = entry.s.why
                if let l = entry.s.scoreLabel, l != "NEWS2" {
                    if scoreWhyAdded { continue }
                    scoreWhyAdded = true
                    why = fill(rules.text.scoreWhy, ["scores": joinParts(fromScores)])
                }
                if !whys.contains(why) { whys.append(why) }
            }
            var sources: [String] = []
            for entry in keyed where !sources.contains(entry.s.source) { sources.append(entry.s.source) }

            let action = best.action ?? rule.map { Action($0.action) } ?? Action(kind: "field", field: group)
            ranked.append((key: bestEntry.key, order: order, item: Item(
                id: group, tier: best.tier, what: what, why: whys.first ?? "", also: Array(whys.dropFirst()),
                action: action, alt: rule?.alt.map { Action($0) }, sources: sources)))
        }
        ranked.sort { a, b in
            let c = compareKeys(a.key, b.key)
            return c != 0 ? c < 0 : a.order < b.order
        }
        return Result(version: rules.version, topN: rules.topN, items: ranked.map { $0.item })
    }

    /// Harness lines (ios.missing / web.missing): "1. [safety] What — why". Identical on the web.
    static func lines(_ r: Result) -> [String] {
        r.items.enumerated().map { "\($0.offset + 1). [\($0.element.tier)] \($0.element.what) — \($0.element.why)" }
    }
}
