// DiagnosticReasoningAdapter.swift
// Diagnostic reasoning — iOS adapter (BayesianDiagnosisEngine). Deterministic; no AI.
//
// Turns the Diagnosis tab's differential (DiagnosisResult with the features that fired, their
// logLR and citations, and each candidate's own feature list) into the platform-neutral input of
// DiagnosticReasoningCore.swift, and returns what the "Diagnostic reasoning" card shows:
// for / against / missing / doesn't fit for the top 3 and the working diagnosis, the best next
// discriminator, "Doesn't fit the working diagnosis" alerts, the diagnostic time-out, the zebra
// check and the longitudinal view. Web twin: artifacts/dashboard/src/lib/diagnostic-reasoning.ts
// (PANE). Nothing here writes to the record.
//
// Weights: LR = exp(logLR / 5) (DiagnosticDatabase.json stores round(ln LR × 5)). The database
// stores likelihood ratios, not sensitivities, so for the information gain a finding is assumed
// present in `backgroundRate` (5 %, the web's DEFAULT_BASE_RATE) of patients without the
// diagnosis: P(finding | diagnosis) = min(0.95, 0.05 × LR). Needs sign-off.

import Foundation

enum DiagnosticReasoningAdapter {

    static let backgroundRate = 0.05
    /// A feature with a stored weight of 8 or more (LR ≈ 5) is cardinal for its candidate.
    static let cardinalMinLogLR = 8
    static let topK = 3
    /// Syndromes and states that accompany other diagnoses (never the alternative an alert points to).
    static let coexistingTerms = ["sepsis", "septic", "acute kidney injury", "hyponatr", "hyperkal", "hypercalc", "hypoglyc"]
    /// Keys whose features can be offered as the next question, sign or test.
    static let probeKeys: Set<String> = ["finding", "inv", "investigations", "exam", "exam_abdo", "exam_general", "exam_cvs",
                                         "ct_abdomen", "ultrasound", "uss", "cxr", "mri", "ecg", "ogd", "us", "ct", "fbc",
                                         "crp", "lactate", "wbc", "blood_culture", "biopsy"]
    static let investigationKeys: Set<String> = ["inv", "investigations", "ct_abdomen", "ultrasound", "uss", "cxr", "mri",
                                                 "ecg", "ogd", "us", "ct", "fbc", "crp", "lactate", "wbc", "blood_culture", "biopsy"]
    static let labWords = ["raised", "elevated", "positive", "level", "count", "troponin", "lipase", "amylase", "crp", "wbc",
                           "bilirubin", "lactate", "culture", "d-dimer", "hcg", "ketone", "glucose", "potassium", "sodium",
                           "calcium", "creatinine", "haemoglobin", "on ct", "on imaging", "ultrasound", "x-ray", "ecg", "scan"]
    static let signWords = ["sign", "tender", "guarding", "rigid", "mass", "murmur", "on examination", "palpable", "bowel sounds"]

    typealias Result = BayesianDiagnosisEngine.DiagnosisResult

    struct Discriminator: Identifiable {
        var id: String { probe.id }
        let probe: DiagnosticReasoning.ProbeCandidate
        let why: String
        let separates: [String]
    }

    struct ZebraItem: Identifiable {
        var id: String { match.id }
        let match: ZebraCheck.Match
        let inDifferential: Bool
    }

    struct Report {
        let hypotheses: [DiagnosticReasoning.Hypothesis]
        let explanations: [DiagnosticReasoning.Explanation]
        let workingId: String?
        let discriminators: [Discriminator]
        let closureAlerts: [DiagnosticReasoning.ClosureAlert]
        let timeOut: DiagnosticReasoning.TimeOutResult
        let zebras: [ZebraItem]
        let longitudinal: LongitudinalPatterns.Result?
        let findingsUsed: Int
    }

    // MARK: - Weights

    static func lr(_ logLR: Int) -> Double { exp(Double(logLR) / BayesianDiagnosisEngine.logUnitsPerNat) }

    static func pGiven(lrPlus: Double) -> Double { min(0.95, max(0.005, backgroundRate * lrPlus)) }

    static func lrAbsent(fromPlus lrPlus: Double) -> Double {
        lrPlus <= 1 ? 1 : (1 - pGiven(lrPlus: lrPlus)) / (1 - backgroundRate)
    }

    static func findingId(key: String, value: String) -> String {
        let k = key == "notFinding" ? "finding" : key
        return "\(k):\(value.lowercased())"
    }

    static func isCoexisting(_ name: String) -> Bool {
        let n = name.lowercased()
        return coexistingTerms.contains { n.contains($0) }
    }

    /// "No chest, arm or jaw pain" → "chest, arm or jaw pain" (the finding a notFinding feature expects).
    static func positiveLabel(_ label: String) -> String {
        let t = label.trimmingCharacters(in: .whitespaces)
        if t.lowercased().hasPrefix("no ") { return String(t.dropFirst(3)) }
        return t
    }

    // MARK: - Input

    /// Hypotheses (top 3, then the working diagnosis) and the findings and weights they fired.
    static func buildInput(_ shown: [Result]) -> (input: DiagnosticReasoning.Input, historyFindings: Set<String>) {
        var hypotheses: [DiagnosticReasoning.Hypothesis] = []
        var seenIds = Set<String>()
        for r in shown {
            var hid = r.name
            if seenIds.contains(hid) { hid += " (\(hypotheses.count + 1))" }
            seenIds.insert(hid)
            hypotheses.append(DiagnosticReasoning.Hypothesis(
                id: hid, label: r.name, probability: Double(r.probability) / 100,
                cantMiss: r.urgency >= 2, coexists: isCoexisting(r.name)))
        }
        var order: [String] = []
        var labels: [String: String] = [:]
        var status: [String: DiagnosticReasoning.FindingStatus] = [:]
        var historyOnly: [String: Bool] = [:]
        var weights: [String: [String: DiagnosticReasoning.Weight]] = [:]

        func note(_ id: String, _ label: String, _ st: DiagnosticReasoning.FindingStatus, history: Bool) {
            if labels[id] == nil { order.append(id); labels[id] = label }
            let old = status[id]
            if old == nil || st == .present || (st == .absent && old == .unknown) { status[id] = st }
            historyOnly[id] = (historyOnly[id] ?? true) && history
        }

        for (i, r) in shown.enumerated() {
            let hid = hypotheses[i].id
            var w: [String: DiagnosticReasoning.Weight] = [:]
            let source = { (f: BayesianDiagnosisEngine.FiredFeature) -> String in
                f.citation ?? "DiagnosticDatabase \(DiagnosticDatabaseInfo.current.versionText)"
            }
            for f in r.firedFeatures where f.sourceKey != "demographics" && !f.label.isEmpty {
                switch f.key {
                case "notFinding":
                    let id = findingId(key: f.key, value: f.value)
                    note(id, positiveLabel(f.label), f.documentedAbsent ? .absent : .unknown, history: false)
                    w[id] = DiagnosticReasoning.Weight(lrPresent: 1, lrAbsent: lr(f.logLR), modelled: true, cardinal: true, source: source(f))
                default:
                    // A present observation, including a documented negative ("D-dimer negative",
                    // findingAbsent) that argues against with LR < 1.
                    let id = findingId(key: f.key, value: f.value)
                    note(id, f.label, .present, history: f.sourceKey == "history")
                    let plus = lr(f.logLR)
                    w[id] = DiagnosticReasoning.Weight(lrPresent: plus, lrAbsent: lrAbsent(fromPlus: plus), modelled: true,
                                                       cardinal: f.baseLogLR >= cardinalMinLogLR, source: source(f))
                }
            }
            // Cardinal findings of this candidate that did not fire: "expected, not recorded".
            let firedIds = Set(r.firedFeatures.map { findingId(key: $0.key, value: $0.value) })
            for f in r.candidateFeatures where f.logLR >= cardinalMinLogLR && probeKeys.contains(f.key) {
                let id = findingId(key: f.key, value: f.value)
                if firedIds.contains(id) || w[id] != nil { continue }
                note(id, f.evidenceLabel.isEmpty ? f.value : f.evidenceLabel, .unknown, history: false)
                let plus = lr(f.logLR)
                w[id] = DiagnosticReasoning.Weight(lrPresent: plus, lrAbsent: lrAbsent(fromPlus: plus), modelled: true, cardinal: true,
                                                   source: f.citation ?? "DiagnosticDatabase")
            }
            weights[hid] = w
        }
        let findings = order.map { DiagnosticReasoning.Finding(id: $0, label: labels[$0] ?? $0, status: status[$0] ?? .unknown) }
        let history = Set(order.filter { historyOnly[$0] == true })
        return (DiagnosticReasoning.Input(hypotheses: hypotheses, findings: findings, weights: weights), history)
    }

    // MARK: - Discriminators

    static func probeKind(key: String, label: String, value: String) -> DiagnosticReasoning.ProbeKind {
        if investigationKeys.contains(key) { return .investigation }
        if key.hasPrefix("exam") { return .sign }
        let text = "\(label) \(value)".lowercased()
        if labWords.contains(where: { text.contains($0) }) { return .investigation }
        if signWords.contains(where: { text.contains($0) }) { return .sign }
        return .symptom
    }

    static func discriminators(_ shown: [Result], input: DiagnosticReasoning.Input, limit: Int = 3) -> [Discriminator] {
        let top = Array(shown.prefix(topK))
        guard top.count >= 2 else { return [] }
        let recorded = Set(input.findings.filter { $0.status != .unknown }.map(\.id))
        var order: [String] = []
        var info: [String: (label: String, key: String, value: String)] = [:]
        var pPos: [String: [Double]] = [:]
        for (i, r) in top.enumerated() {
            for f in r.candidateFeatures where f.logLR > 0 && probeKeys.contains(f.key) {
                let id = findingId(key: f.key, value: f.value)
                if recorded.contains(id) { continue }
                if info[id] == nil {
                    order.append(id)
                    info[id] = (label: f.evidenceLabel.isEmpty ? f.value : f.evidenceLabel, key: f.key, value: f.value)
                    pPos[id] = Array(repeating: backgroundRate, count: top.count)
                }
                pPos[id]![i] = max(pPos[id]![i], pGiven(lrPlus: lr(f.logLR)))
            }
        }
        let priors = top.map { Double($0.probability) / 100 }
        var candidates: [DiagnosticReasoning.ProbeCandidate] = []
        for id in order {
            guard let meta = info[id], let p = pPos[id] else { continue }
            let kind = probeKind(key: meta.key, label: meta.label, value: meta.value)
            let costText = "\(meta.label) \(meta.value.replacingOccurrences(of: "&", with: " ").replacingOccurrences(of: "|", with: " ").replacingOccurrences(of: "_", with: " "))"
            candidates.append(DiagnosticReasoning.ProbeCandidate(
                id: id, label: meta.label, kind: kind,
                cost: DiagnosticReasoning.classifyProbeCost(kind: kind, text: costText),
                gain: DiagnosticReasoning.expectedInformationGain(priors: priors, pPositive: p)))
        }
        let cantMiss = top.contains { $0.urgency >= 2 }
        return DiagnosticReasoning.rankDiscriminators(candidates, cantMissInTop: cantMiss, limit: limit).map { ranked in
            let p = pPos[ranked.probe.id] ?? []
            let post = DiagnosticReasoning.postTest(priors: priors, pPositive: p, residualPPositive: backgroundRate)
            let lines = top.indices.map {
                DiagnosticReasoning.PostTestLine(label: top[$0].name, before: priors[$0],
                                                 ifPositive: post.ifPositive[$0], ifNegative: post.ifNegative[$0])
            }
            return Discriminator(probe: ranked.probe, why: DiagnosticReasoning.discriminatorWhy(kind: ranked.probe.kind, lines: lines),
                                 separates: top.map(\.name))
        }
    }

    // MARK: - Working diagnosis

    /// Index of the working diagnosis among the results: same name, one name containing the other,
    /// or the same ICD-10 category (3 characters).
    static func workingIndex(_ results: [Result], name: String?, icd: String?) -> Int? {
        let n = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !n.isEmpty else { return nil }
        if let i = results.firstIndex(where: { $0.name.lowercased() == n }) { return i }
        if let i = results.firstIndex(where: { $0.name.lowercased().contains(n) || n.contains($0.name.lowercased()) }) { return i }
        let code = (icd ?? "").replacingOccurrences(of: ".", with: "").uppercased()
        if code.count >= 3 {
            let head = String(code.prefix(3))
            if let i = results.firstIndex(where: { $0.icdCode.replacingOccurrences(of: ".", with: "").uppercased().hasPrefix(head) }) { return i }
        }
        return nil
    }

    // MARK: - Record helpers

    static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .ect
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func leadingNumber(_ text: String) -> Double? {
        let pattern = try? NSRegularExpression(pattern: "-?\\d+(?:\\.\\d+)?")
        let range = NSRange(text.startIndex..., in: text)
        guard let m = pattern?.firstMatch(in: text, range: range), let r = Range(m.range, in: text) else { return nil }
        return Double(text[r])
    }

    /// The record as clauses for the zebra check (complaint, HPI, history, examination, results,
    /// medicines, herbal products and supplements).
    static func recordText(_ p: Patient) -> String {
        let results = p.investigations.filter { $0.status == .resulted && !$0.result.isEmpty }.map { "\($0.name): \($0.result)" }
        let supplements = p.pathwayData.supplements
        let herbal: String? = supplements.status == .taking && !supplements.entries.isEmpty
            ? "Herbal products and supplements taken: \(supplements.entries.map(\.name).joined(separator: ", "))" : nil
        var parts: [String?] = [p.chiefComplaint, p.hpi, p.pmhNotes, p.surgicalHistory, p.socialHistory,
                                p.examGeneral, p.examAbdo, p.examCVS, p.examResp, p.examNeuro, p.examMSK, p.examSkin, p.examOther]
        parts += results.map { Optional($0) }
        parts += p.prescriptions.map { Optional($0.drug) }
        parts.append(herbal)
        return NegationMatcher.joinClauses(parts)
    }

    static func labValues(_ p: Patient) -> [ZebraCheck.LabValue] {
        p.investigations
            .filter { $0.status == .resulted && $0.category.holdsLabValues }
            .compactMap { inv in leadingNumber(inv.result).map { ZebraCheck.LabValue(name: inv.name, value: $0) } }
    }

    static func earlierEncounters(_ p: Patient, now: Date = .now) -> [Encounter] {
        let start = Calendar.ect.startOfDay(for: now)
        return p.encounters.filter { $0.isLive && $0.isComplete && $0.encounterDate < start }
            .sorted { $0.encounterDate < $1.encounterDate }
    }

    static func longitudinalInput(_ p: Patient, now: Date = .now) -> LongitudinalPatterns.Input {
        let earlier = earlierEncounters(p, now: now)
        let visits = earlier.map {
            LongitudinalPatterns.Visit(date: dayFormatter.string(from: $0.encounterDate),
                                       complaint: $0.chiefComplaint, diagnosis: $0.workingDiagnosis)
        }
        var labs: [InvestigationEntry] = p.investigations
        for e in earlier { labs += e.decodedInvestigations }
        func points(_ keywords: [String]) -> [LongitudinalPatterns.Point] {
            labs.filter { $0.status == .resulted && $0.category.holdsLabValues && LabNameMatch.matchesAny(name: $0.name, keywords: keywords) }
                .compactMap { inv in
                    guard let v = leadingNumber(inv.result) else { return nil }
                    return LongitudinalPatterns.Point(date: dayFormatter.string(from: inv.resultedAt ?? inv.orderedAt), value: v)
                }
        }
        let weight = p.vitalsEntries.compactMap { v -> LongitudinalPatterns.Point? in
            guard let kg = v.weightKg else { return nil }
            return LongitudinalPatterns.Point(date: dayFormatter.string(from: v.recordedAt), value: kg)
        }
        return LongitudinalPatterns.Input(visits: visits, creatinine: points(["creatinine"]),
                                          haemoglobin: points(["haemoglobin", "hemoglobin", "hb"]), weight: weight)
    }

    static func news2Series(_ p: Patient) -> [Int] {
        p.vitalsEntries.filter(\.hasAnyValue).sorted { $0.recordedAt < $1.recordedAt }.map(\.news2Score)
    }

    // MARK: - Report

    static func report(results: [Result], patient p: Patient, now: Date = .now) -> Report {
        let top = Array(results.prefix(topK))
        let wIdx = workingIndex(results, name: p.workingDiagnosis, icd: p.workingDiagnosisICD)
        var shown = top
        if let w = wIdx, w >= topK { shown.append(results[w]) }
        let built = buildInput(shown)
        let input = built.input
        let explanations = input.hypotheses.map { DiagnosticReasoning.explain(input, hypothesisId: $0.id) }
        let workingId: String? = wIdx.map { w in w < topK ? input.hypotheses[w].id : input.hypotheses[input.hypotheses.count - 1].id }

        let workingLabel = (p.workingDiagnosis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let alerts: [DiagnosticReasoning.ClosureAlert] = workingLabel.isEmpty ? [] :
            DiagnosticReasoning.prematureClosureAlerts(input, workingId: workingId, workingLabel: workingLabel, news2Series: news2Series(p))

        // Time-out: unexplained symptoms, signs and results (history items are context), and repeat
        // visits for the same complaint without a firm diagnosis.
        let timeInput = DiagnosticReasoning.Input(
            hypotheses: input.hypotheses,
            findings: input.findings.filter { !built.historyFindings.contains($0.id) },
            weights: input.weights)
        let unexplained = DiagnosticReasoning.unexplainedFindings(timeInput, hypothesisIds: input.hypotheses.map(\.id))
        let earlier = earlierEncounters(p, now: now)
        let same = earlier.filter { e in
            let prev = VisitContinuity.PreviousVisit(date: e.encounterDate, complaint: e.chiefComplaint,
                                                     diagnosis: e.workingDiagnosis, diagnosisICD: e.workingDiagnosisICD,
                                                     plan: e.managementPlan)
            let hasText = !((e.chiefComplaint ?? "") + (e.workingDiagnosis ?? "")).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            return hasText && VisitContinuity.isSameProblem(current: p.chiefComplaint, previous: prev)
        }
        let hasComplaint = !(p.chiefComplaint ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let timeOut = DiagnosticReasoning.diagnosticTimeOut(DiagnosticReasoning.TimeOutInput(
            unexplainedFindings: unexplained,
            priorVisitsSameComplaint: hasComplaint ? same.count : 0,
            priorDiagnosesSameComplaint: hasComplaint ? same.map { $0.workingDiagnosis ?? "" } : []))

        let longInput = longitudinalInput(p, now: now)
        let longitudinal = LongitudinalPatterns.patterns(longInput)
        let pancreatitisBefore = earlier.contains { ($0.workingDiagnosis ?? "").lowercased().contains("pancreatitis") }
        var zebraParts: [String?] = [recordText(p)]
        for term in ZebraCheck.derivedLabTerms(labValues(p)) { zebraParts.append(term) }
        if pancreatitisBefore { zebraParts.append("History of pancreatitis (earlier visit)") }
        let zebraText = NegationMatcher.joinClauses(zebraParts)
        let topIcd = top.map { $0.icdCode.replacingOccurrences(of: ".", with: "").uppercased() }
        let zebras = ZebraCheck.match(zebraText).map { z -> ZebraItem in
            let head = String(z.icd10.replacingOccurrences(of: ".", with: "").uppercased().prefix(3))
            return ZebraItem(match: z, inDifferential: topIcd.contains { $0.hasPrefix(head) })
        }

        return Report(
            hypotheses: input.hypotheses, explanations: explanations, workingId: workingId,
            discriminators: discriminators(results, input: input), closureAlerts: alerts, timeOut: timeOut,
            zebras: zebras, longitudinal: longitudinal.isEmpty ? nil : longitudinal,
            findingsUsed: input.findings.filter { $0.status != .unknown }.count)
    }

    /// Flat lines for the clinical-validation harness (same formats as the web's reasoningHarnessLines).
    static func harnessLines(_ r: Report, prefix: String) -> [(source: String, text: String)] {
        var out: [(source: String, text: String)] = []
        for a in r.closureAlerts { out.append((source: "\(prefix).alert", text: a.text)) }
        for z in r.zebras {
            out.append((source: "\(prefix).zebra", text: "\(z.match.condition) — \(z.match.explains) (\(z.match.matched.joined(separator: " + ")))"))
        }
        for d in r.discriminators {
            out.append((source: "\(prefix).discriminator", text: "\(d.probe.label) [\(d.probe.cost.rawValue)] — \(d.why)"))
        }
        for reason in r.timeOut.reasons { out.append((source: "\(prefix).timeout", text: reason)) }
        for e in r.explanations {
            for x in e.forFindings { out.append((source: "\(prefix).for", text: "\(e.label): \(x.label)")) }
            for x in e.against { out.append((source: "\(prefix).against", text: "\(e.label): \(x.label)")) }
            for x in e.missing {
                out.append((source: "\(prefix).missing", text: "\(e.label): \(x.label)\(x.documented ? " (documented absent)" : " (not recorded)")"))
            }
            for x in e.doesntFit {
                out.append((source: "\(prefix).doesntfit", text: "\(e.label): \(x.label)\(x.favours.map { " (favours \($0))" } ?? "")"))
            }
        }
        if let l = r.longitudinal {
            for x in l.recurring { out.append((source: "\(prefix).longitudinal", text: "Recurring: \(x.problem) × \(x.count)")) }
            for x in l.trends { out.append((source: "\(prefix).longitudinal", text: x.text)) }
            for x in l.unheld {
                out.append((source: "\(prefix).longitudinal", text: "\(x.diagnosis) (\(x.date)) revised to \(x.replacedBy) (\(x.replacedOn))"))
            }
        }
        return out
    }
}
