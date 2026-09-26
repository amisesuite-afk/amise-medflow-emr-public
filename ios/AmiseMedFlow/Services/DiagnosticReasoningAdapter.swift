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
// Weights: the likelihood ratio the database states for a curated feature (`likelihoodRatio`),
// else LR = exp(logLR / 5) (DiagnosticDatabase.json stores round(ln LR × 5): a stated LR 1.5 is
// stored as 2, and exp(2 / 5) = 1.49 fell just below the "supports" threshold of 1.5, so half the
// visits suggested a diagnostic time-out). The database stores likelihood ratios, not
// sensitivities, so for the information gain a finding is assumed present in `backgroundRate`
// (5 %, the web's DEFAULT_BASE_RATE) of patients without the diagnosis: P(finding | diagnosis) =
// min(0.95, 0.05 × LR). Needs sign-off.
//
// Shared rules (DiagnosticReasoningRules.swift, clinical-content/rules/diagnostic-reasoning-rules.json,
// the same file and vectors as the web): the working diagnosis is found among every scored
// candidate, not only the five shown (a label match beats an unspecific ICD-10 code); diagnoses
// of its family are compatible; "the record favours X" needs X to share evidence with a supported
// working diagnosis and not to be named in it; a single contradicting finding alerts at LR <= 0.2.
// iOS evidence: one finding fired by several candidates under the same label is one finding, and
// every candidate's "presenting complaint" feature is one piece of evidence (evidence group).
// Time-out: findings a coexisting state (sepsis, AKI, electrolyte disorders) explains are
// explained; history and score (decision-rule) findings are context.

import Foundation

enum DiagnosticReasoningAdapter {

    static let backgroundRate = 0.05
    /// A feature with a stored weight of 8 or more (LR ≈ 5) is cardinal for its candidate.
    static let cardinalMinLogLR = 8
    static let topK = 3
    /// Syndromes and states that accompany other diagnoses (never the alternative an alert points
    /// to): diagnostic-reasoning-rules.json `coexisting.nameTerms`; this list only when the rules
    /// file is unavailable (diagnostic-reasoning-parity.test.ts keeps the two equal).
    static let fallbackCoexistingTerms = ["sepsis", "septic", "acute kidney injury", "hyponatr", "hyperkal", "hypercalc", "hypoglyc"]
    static var coexistingTerms: [String] { DiagnosticReasoningRules.ruleFile?.coexisting.nameTerms ?? fallbackCoexistingTerms }
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

    /// The feature's likelihood ratio: the one the database states, else exp(logLR / 5).
    static func lr(_ f: BayesianDiagnosisEngine.FiredFeature) -> Double { f.statedLR ?? lr(f.logLR) }

    static func lr(_ f: BayesianDiagnosisEngine.Candidate.Feature) -> Double { f.likelihoodRatio ?? lr(f.logLR) }

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

    /// "Upper abdominal pain as the presenting complaint" and "upper abdominal pain as the
    /// presenting complaint" are one finding: lower case, letters and digits only.
    static func labelKey(_ label: String) -> String {
        label.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    /// Hypotheses (top 3, then the working diagnosis) and the findings and weights they fired.
    /// One finding fired by several candidates under the same label is one finding (its id is the
    /// first feature's key and value); examination signs and decision rules keep their own ids.
    /// `historyFindings`: history and score findings (context, not counted by the time-out);
    /// `complaintFindings`: the candidates' "presenting complaint" features (one evidence group).
    static func buildInput(_ shown: [Result]) -> (input: DiagnosticReasoning.Input, historyFindings: Set<String>,
                                                   complaintFindings: Set<String>) {
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
        var complaint = Set<String>()
        var weights: [String: [String: DiagnosticReasoning.Weight]] = [:]
        var canonical: [String: String] = [:]

        func idFor(key: String, value: String, label: String) -> String {
            let own = findingId(key: key, value: value)
            if key == "sign" || key == "rule" { return own }
            let k = labelKey(label)
            if k.isEmpty { return own }
            if let id = canonical[k] { return id }
            canonical[k] = own
            return own
        }

        func note(_ id: String, _ label: String, _ st: DiagnosticReasoning.FindingStatus, history: Bool) {
            if labels[id] == nil { order.append(id); labels[id] = label }
            let old = status[id]
            if old == nil || st == .present || (st == .absent && old == .unknown) { status[id] = st }
            historyOnly[id] = (historyOnly[id] ?? true) && history
        }

        func strength(_ w: DiagnosticReasoning.Weight) -> Double { abs(log(w.lrPresent)) + abs(log(w.lrAbsent)) }

        for (i, r) in shown.enumerated() {
            let hid = hypotheses[i].id
            var w: [String: DiagnosticReasoning.Weight] = [:]
            let source = { (f: BayesianDiagnosisEngine.FiredFeature) -> String in
                f.citation ?? "DiagnosticDatabase \(DiagnosticDatabaseInfo.current.versionText)"
            }
            var firedIds = Set<String>()
            for f in r.firedFeatures where f.sourceKey != "demographics" && !f.label.isEmpty {
                let weight: DiagnosticReasoning.Weight
                let id: String
                switch f.key {
                case "notFinding":
                    let label = positiveLabel(f.label)
                    id = idFor(key: f.key, value: f.value, label: label)
                    note(id, label, f.documentedAbsent ? .absent : .unknown, history: false)
                    weight = DiagnosticReasoning.Weight(lrPresent: 1, lrAbsent: lr(f), modelled: true, cardinal: true, source: source(f))
                default:
                    // A present observation, including a documented negative ("D-dimer negative",
                    // findingAbsent) that argues against with LR < 1.
                    id = idFor(key: f.key, value: f.value, label: f.label)
                    if f.key == "complaint" { complaint.insert(id) }
                    note(id, f.label, .present, history: f.sourceKey == "history" || f.sourceKey == "score")
                    let plus = lr(f)
                    weight = DiagnosticReasoning.Weight(lrPresent: plus, lrAbsent: lrAbsent(fromPlus: plus), modelled: true,
                                                        cardinal: f.baseLogLR >= cardinalMinLogLR, source: source(f))
                }
                firedIds.insert(id)
                // Two features of one candidate with the same label: the stronger evidence counts.
                if let old = w[id], strength(old) >= strength(weight) { continue }
                w[id] = weight
            }
            // Cardinal findings of this candidate that did not fire: "expected, not recorded".
            for f in r.candidateFeatures where f.logLR >= cardinalMinLogLR && probeKeys.contains(f.key) {
                let label = f.evidenceLabel.isEmpty ? f.value : f.evidenceLabel
                let id = idFor(key: f.key, value: f.value, label: label)
                if firedIds.contains(id) || w[id] != nil { continue }
                note(id, label, .unknown, history: false)
                let plus = lr(f)
                w[id] = DiagnosticReasoning.Weight(lrPresent: plus, lrAbsent: lrAbsent(fromPlus: plus), modelled: true, cardinal: true,
                                                   source: f.citation ?? "DiagnosticDatabase")
            }
            weights[hid] = w
        }
        let findings = order.map { DiagnosticReasoning.Finding(id: $0, label: labels[$0] ?? $0, status: status[$0] ?? .unknown) }
        let history = Set(order.filter { historyOnly[$0] == true })
        return (DiagnosticReasoning.Input(hypotheses: hypotheses, findings: findings, weights: weights), history, complaint)
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
        // A finding recorded under another candidate's wording is recorded too.
        let recordedLabels = Set(input.findings.filter { $0.status != .unknown }.map { labelKey($0.label) })
        var order: [String] = []
        var info: [String: (label: String, key: String, value: String)] = [:]
        var pPos: [String: [Double]] = [:]
        for (i, r) in top.enumerated() {
            for f in r.candidateFeatures where f.logLR > 0 && probeKeys.contains(f.key) {
                let id = findingId(key: f.key, value: f.value)
                if recorded.contains(id) || recordedLabels.contains(labelKey(f.evidenceLabel.isEmpty ? f.value : f.evidenceLabel)) { continue }
                if info[id] == nil {
                    order.append(id)
                    info[id] = (label: f.evidenceLabel.isEmpty ? f.value : f.evidenceLabel, key: f.key, value: f.value)
                    pPos[id] = Array(repeating: backgroundRate, count: top.count)
                }
                pPos[id]![i] = max(pPos[id]![i], pGiven(lrPlus: lr(f)))
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

    /// Index of the working diagnosis among `results`: the same name; else the shared rule
    /// (DiagnosisFamilies.resolveWorkingIndex: a label match that beats an unspecific ICD-10 code,
    /// else the ICD-10 code, exact then category, most probable first); else one name containing
    /// the other.
    static func workingIndex(_ results: [Result], name: String?, icd: String?) -> Int? {
        let n = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !n.isEmpty else { return nil }
        if let i = results.firstIndex(where: { $0.name.lowercased() == n }) { return i }
        let nodes = results.map {
            DiagnosisFamilies.WorkingCandidate(label: $0.name, icd10: $0.icdCode, probability: Double($0.rawLogPosterior))
        }
        if let i = DiagnosisFamilies.resolveWorkingIndex(nodes, label: name ?? "", icdCode: icd) { return i }
        if let i = results.firstIndex(where: { $0.name.lowercased().contains(n) || n.contains($0.name.lowercased()) }) { return i }
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
        // The shown results, then every other scored candidate (rankedBelow, carried on the first
        // result): a confirmed working diagnosis the engine ranks lower is still compared.
        let shownNames = Set(results.map(\.name))
        let all = results + results.flatMap(\.rankedBelow).filter { !shownNames.contains($0.name) }
        let wIdx = workingIndex(all, name: p.workingDiagnosis, icd: p.workingDiagnosisICD)
        var shown = top
        if let w = wIdx, w >= top.count { shown.append(all[w]) }
        let built = buildInput(shown)
        let input = built.input
        let explanations = input.hypotheses.map { DiagnosticReasoning.explain(input, hypothesisId: $0.id) }
        let workingId: String? = wIdx.map { w in w < top.count ? input.hypotheses[w].id : input.hypotheses[input.hypotheses.count - 1].id }

        let workingLabel = (p.workingDiagnosis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        var familyIds = Set<String>()
        if let wid = workingId, let wi = input.hypotheses.firstIndex(where: { $0.id == wid }) {
            let nodes = input.hypotheses.indices.map {
                DiagnosisFamilies.Node(id: input.hypotheses[$0].id, label: shown[$0].name, icd10: shown[$0].icdCode)
            }
            familyIds = DiagnosisFamilies.familyOf(nodes[wi], in: nodes)
        }
        let complaintFindings = built.complaintFindings
        let alerts: [DiagnosticReasoning.ClosureAlert] = workingLabel.isEmpty ? [] :
            DiagnosticReasoning.adapterClosureAlerts(
                input, workingId: workingId, workingText: workingLabel, familyIds: familyIds, news2Series: news2Series(p),
                evidenceGroup: { complaintFindings.contains($0) ? "presenting-complaint" : $0 })

        // Time-out: unexplained symptoms, signs and results (history and score findings are
        // context) that neither the leading diagnoses nor a coexisting state (sepsis, AKI,
        // electrolyte disorders) explain; and repeat visits for the same complaint without a firm
        // diagnosis.
        let shownSet = Set(shown.map(\.name))
        let coexisting = all.filter { !shownSet.contains($0.name) && isCoexisting($0.name) }
        let explainers = buildInput(shown + coexisting).input
        let recorded = Set(input.findings.map(\.id))
        let timeInput = DiagnosticReasoning.Input(
            hypotheses: explainers.hypotheses,
            findings: explainers.findings.filter { recorded.contains($0.id) && !built.historyFindings.contains($0.id) },
            weights: explainers.weights)
        let unexplained = DiagnosticReasoning.unexplainedFindings(timeInput, hypothesisIds: explainers.hypotheses.map(\.id))
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
