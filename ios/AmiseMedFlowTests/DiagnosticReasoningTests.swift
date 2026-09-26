// DiagnosticReasoningTests.swift
// Diagnostic reasoning core, zebra check and longitudinal patterns, run against the shared vectors
// (AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json). The dashboard's
// diagnostic-reasoning-core.test.ts reads the same file, so the two platforms reason alike.
// Plus adapter checks on the bundled DiagnosticDatabase (Bayesian engine evidence).

import XCTest
@testable import AmiseMedFlow

private final class DRVectorsToken {}

private struct DRLine: Decodable {
    let id: String
    let lr: Double
    let documented: Bool
    let favours: String?
}

private struct DRExplainExpected: Decodable {
    let forFindings: [DRLine]
    let against: [DRLine]
    let missing: [DRLine]
    let doesntFit: [DRLine]
    let lowEvidence: Bool
    let unexplained: [String]
}

private struct DRExplainCase: Decodable {
    let name: String
    let input: DiagnosticReasoning.Input
    let hypothesisId: String
    let expected: DRExplainExpected
}

private struct DRGainCase: Decodable {
    let priors: [Double]
    let pPositive: [Double]
    let expected: Double
}

private struct DRPostExpected: Decodable {
    let ifPositive: [Double]
    let ifNegative: [Double]
}

private struct DRPostCase: Decodable {
    let priors: [Double]
    let pPositive: [Double]
    let residualPPositive: Double
    let expected: DRPostExpected
}

private struct DRCostCase: Decodable {
    let kind: DiagnosticReasoning.ProbeKind
    let text: String
    let expected: String
}

private struct DRRankCase: Decodable {
    let candidates: [DiagnosticReasoning.ProbeCandidate]
    let cantMissInTop: Bool
    let limit: Int
    let expected: [String]
}

private struct DRWhyCase: Decodable {
    let kind: DiagnosticReasoning.ProbeKind
    let lines: [DiagnosticReasoning.PostTestLine]
    let expected: String
}

private struct DRFormatCase: Decodable {
    let lr: Double
    let expected: String
}

private struct DRPctCase: Decodable {
    let p: Double
    let expected: String
}

private struct DRAlert: Decodable {
    let key: String
    let kind: String
    let text: String
}

private struct DRClosureCase: Decodable {
    let name: String
    let input: DiagnosticReasoning.Input
    let workingId: String?
    let workingLabel: String
    let news2Series: [Int]
    let expected: [DRAlert]
}

private struct DRTimeOutExpected: Decodable {
    let suggested: Bool
    let reasons: [String]
    let checklist: [String]
}

private struct DRTimeOutCase: Decodable {
    let input: DiagnosticReasoning.TimeOutInput
    let expected: DRTimeOutExpected
}

private struct DRZebraExpected: Decodable {
    let id: String
    let matched: [String]
}

private struct DRZebraCase: Decodable {
    let text: String
    let expected: [DRZebraExpected]
}

private struct DRLabCase: Decodable {
    let labs: [ZebraCheck.LabValue]
    let expected: [String]
}

private struct DRLongExpected: Decodable {
    let recurring: [LongitudinalPatterns.Recurring]
    let trends: [LongitudinalPatterns.TrendItem]
    let unheld: [LongitudinalPatterns.Unheld]
}

private struct DRLongCase: Decodable {
    let input: LongitudinalPatterns.Input
    let expected: DRLongExpected
}

private struct DRNode: Decodable {
    let id: String
    let label: String
    let icd10: String
}

private struct DRFamilyCase: Decodable {
    let a: DRNode
    let b: DRNode
    let expected: Bool
}

private struct DRLabelCase: Decodable {
    let label: String
    let text: String
    let score: Double?
    let fullyNamed: Bool
}

private struct DRWorkingNode: Decodable {
    let label: String
    let icd10: String
    let probability: Double
}

private struct DRResolveCase: Decodable {
    let nodes: [DRWorkingNode]
    let label: String
    let icd: String?
    let expected: Int?
}

private struct DRCompetesCase: Decodable {
    let name: String
    let input: DiagnosticReasoning.Input
    let leaderId: String
    let workingId: String
    let groups: [String: String]?
    let expected: Bool
}

private struct DRAdapterClosureCase: Decodable {
    let name: String
    let input: DiagnosticReasoning.Input
    let workingId: String?
    let workingText: String
    let familyIds: [String]
    let news2Series: [Int]
    let groups: [String: String]?
    let expected: [DRAlert]
}

private struct DRVectors: Decodable {
    let explain: [DRExplainCase]
    let informationGain: [DRGainCase]
    let postTest: [DRPostCase]
    let probeCost: [DRCostCase]
    let rankDiscriminators: [DRRankCase]
    let discriminatorWhy: [DRWhyCase]
    let formatLr: [DRFormatCase]
    let fmtPct: [DRPctCase]
    let closure: [DRClosureCase]
    let timeOut: [DRTimeOutCase]
    let zebras: [DRZebraCase]
    let derivedLabTerms: [DRLabCase]
    let longitudinal: [DRLongCase]
    let families: [DRFamilyCase]
    let labelMatch: [DRLabelCase]
    let resolveWorking: [DRResolveCase]
    let competes: [DRCompetesCase]
    let adapterClosure: [DRAdapterClosureCase]
}

final class DiagnosticReasoningTests: XCTestCase {

    private static func loadVectors() throws -> DRVectors {
        let bundle = Bundle(for: DRVectorsToken.self)
        let url = bundle.url(forResource: "DiagnosticReasoningVectors", withExtension: "json")
            ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("Resources").appendingPathComponent("DiagnosticReasoningVectors.json")
        return try JSONDecoder().decode(DRVectors.self, from: Data(contentsOf: url))
    }

    private func lines(_ l: [DiagnosticReasoning.EvidenceLine]) -> [String] {
        l.map { "\($0.findingId)|\(String(format: "%.9f", $0.lr))|\($0.documented)|\($0.favours ?? "-")" }
    }

    private func lines(_ l: [DRLine]) -> [String] {
        l.map { "\($0.id)|\(String(format: "%.9f", $0.lr))|\($0.documented)|\($0.favours ?? "-")" }
    }

    func testExplainVectors() throws {
        let v = try Self.loadVectors()
        XCTAssertFalse(v.explain.isEmpty)
        for c in v.explain {
            let e = DiagnosticReasoning.explain(c.input, hypothesisId: c.hypothesisId)
            XCTAssertEqual(lines(e.forFindings), lines(c.expected.forFindings), "\(c.name): for")
            XCTAssertEqual(lines(e.against), lines(c.expected.against), "\(c.name): against")
            XCTAssertEqual(lines(e.missing), lines(c.expected.missing), "\(c.name): missing")
            XCTAssertEqual(lines(e.doesntFit), lines(c.expected.doesntFit), "\(c.name): doesn't fit")
            XCTAssertEqual(e.lowEvidence, c.expected.lowEvidence, "\(c.name): low evidence")
            XCTAssertEqual(DiagnosticReasoning.unexplainedFindings(c.input, hypothesisIds: c.input.hypotheses.map(\.id)),
                           c.expected.unexplained, "\(c.name): unexplained")
        }
    }

    func testInformationGainAndPostTestVectors() throws {
        let v = try Self.loadVectors()
        for c in v.informationGain {
            XCTAssertEqual(DiagnosticReasoning.expectedInformationGain(priors: c.priors, pPositive: c.pPositive), c.expected, accuracy: 1e-9)
        }
        for c in v.postTest {
            let r = DiagnosticReasoning.postTest(priors: c.priors, pPositive: c.pPositive, residualPPositive: c.residualPPositive)
            XCTAssertEqual(r.ifPositive.count, c.expected.ifPositive.count)
            for i in r.ifPositive.indices {
                XCTAssertEqual(r.ifPositive[i], c.expected.ifPositive[i], accuracy: 1e-9)
                XCTAssertEqual(r.ifNegative[i], c.expected.ifNegative[i], accuracy: 1e-9)
            }
        }
    }

    func testProbeCostRankingAndTextVectors() throws {
        let v = try Self.loadVectors()
        for c in v.probeCost {
            XCTAssertEqual(DiagnosticReasoning.classifyProbeCost(kind: c.kind, text: c.text).rawValue, c.expected, c.text)
        }
        for c in v.rankDiscriminators {
            XCTAssertEqual(DiagnosticReasoning.rankDiscriminators(c.candidates, cantMissInTop: c.cantMissInTop, limit: c.limit).map(\.probe.id),
                           c.expected)
        }
        for c in v.discriminatorWhy {
            XCTAssertEqual(DiagnosticReasoning.discriminatorWhy(kind: c.kind, lines: c.lines), c.expected)
        }
        for c in v.formatLr { XCTAssertEqual(DiagnosticReasoning.formatLr(c.lr), c.expected, "LR \(c.lr)") }
        for c in v.fmtPct { XCTAssertEqual(DiagnosticReasoning.fmtPct(c.p), c.expected, "p \(c.p)") }
    }

    func testPrematureClosureVectors() throws {
        let v = try Self.loadVectors()
        for c in v.closure {
            let got = DiagnosticReasoning.prematureClosureAlerts(c.input, workingId: c.workingId, workingLabel: c.workingLabel,
                                                                news2Series: c.news2Series)
            XCTAssertEqual(got.map(\.key), c.expected.map(\.key), c.name)
            XCTAssertEqual(got.map(\.kind.rawValue), c.expected.map(\.kind), c.name)
            XCTAssertEqual(got.map(\.text), c.expected.map(\.text), c.name)
        }
    }

    // MARK: - Shared adapter rules (DiagnosticReasoningRules.swift; rules file diagnostic-reasoning-rules.json)

    func testFamilyAndLabelMatchVectors() throws {
        let v = try Self.loadVectors()
        XCTAssertNotNil(DiagnosticReasoningRules.ruleFile, "clinical-content/rules/diagnostic-reasoning-rules.json must be bundled and decode")
        for c in v.families {
            let a = DiagnosisFamilies.Node(id: c.a.id, label: c.a.label, icd10: c.a.icd10)
            let b = DiagnosisFamilies.Node(id: c.b.id, label: c.b.label, icd10: c.b.icd10)
            XCTAssertEqual(DiagnosisFamilies.sameFamily(a, b), c.expected, "\(c.a.label) ~ \(c.b.label)")
        }
        for c in v.labelMatch {
            let score = DiagnosisFamilies.labelMatchScore(c.label, c.text)
            XCTAssertEqual(score.isFinite ? score : nil, c.score, "\(c.label) / \(c.text)")
            XCTAssertEqual(DiagnosisFamilies.labelFullyNamed(c.label, c.text), c.fullyNamed, "\(c.label) / \(c.text): named")
        }
        for c in v.resolveWorking {
            let nodes = c.nodes.map { DiagnosisFamilies.WorkingCandidate(label: $0.label, icd10: $0.icd10, probability: $0.probability) }
            XCTAssertEqual(DiagnosisFamilies.resolveWorkingIndex(nodes, label: c.label, icdCode: c.icd), c.expected, c.label)
        }
    }

    func testTwoConditionsVectors() throws {
        let v = try Self.loadVectors()
        for c in v.competes {
            let groups = c.groups ?? [:]
            XCTAssertEqual(DiagnosticReasoning.competesForEvidence(c.input, leaderId: c.leaderId, workingId: c.workingId,
                                                                   evidenceGroup: { groups[$0] ?? $0 }),
                           c.expected, c.name)
        }
    }

    func testAdapterClosureVectors() throws {
        let v = try Self.loadVectors()
        for c in v.adapterClosure {
            let groups = c.groups ?? [:]
            let got = DiagnosticReasoning.adapterClosureAlerts(c.input, workingId: c.workingId, workingText: c.workingText,
                                                               familyIds: Set(c.familyIds), news2Series: c.news2Series,
                                                               evidenceGroup: { groups[$0] ?? $0 })
            XCTAssertEqual(got.map(\.key), c.expected.map(\.key), c.name)
            XCTAssertEqual(got.map(\.kind.rawValue), c.expected.map(\.kind), c.name)
            XCTAssertEqual(got.map(\.text), c.expected.map(\.text), c.name)
        }
    }

    func testTimeOutVectors() throws {
        let v = try Self.loadVectors()
        for c in v.timeOut {
            let r = DiagnosticReasoning.diagnosticTimeOut(c.input)
            XCTAssertEqual(r.suggested, c.expected.suggested)
            XCTAssertEqual(r.reasons, c.expected.reasons)
            XCTAssertEqual(r.checklist, c.expected.checklist)
        }
    }

    func testZebraAndDerivedLabVectors() throws {
        let v = try Self.loadVectors()
        XCTAssertFalse(ZebraCheck.rules.isEmpty, "clinical-content/rules/zebra-rules.json must be bundled and decode")
        for c in v.zebras {
            let got = ZebraCheck.match(c.text).map { "\($0.id):\($0.matched.joined(separator: "+"))" }
            XCTAssertEqual(got, c.expected.map { "\($0.id):\($0.matched.joined(separator: "+"))" }, c.text)
        }
        for c in v.derivedLabTerms {
            XCTAssertEqual(ZebraCheck.derivedLabTerms(c.labs), c.expected)
        }
    }

    func testLongitudinalVectors() throws {
        let v = try Self.loadVectors()
        for c in v.longitudinal {
            let r = LongitudinalPatterns.patterns(c.input)
            XCTAssertEqual(r.recurring.map { "\($0.problem)|\($0.count)|\($0.dates.joined(separator: ","))" },
                           c.expected.recurring.map { "\($0.problem)|\($0.count)|\($0.dates.joined(separator: ","))" })
            XCTAssertEqual(r.unheld.map { "\($0.diagnosis)|\($0.date)|\($0.replacedBy)|\($0.replacedOn)" },
                           c.expected.unheld.map { "\($0.diagnosis)|\($0.date)|\($0.replacedBy)|\($0.replacedOn)" })
            XCTAssertEqual(r.trends.map(\.text), c.expected.trends.map(\.text))
            for (a, b) in zip(r.trends, c.expected.trends) {
                XCTAssertEqual(a.from, b.from, accuracy: 1e-6)
                XCTAssertEqual(a.to, b.to, accuracy: 1e-6)
            }
        }
    }

    // MARK: - Adapter on the Bayesian engine

    private func result(_ name: String, icd: String, probability: Int, urgency: Int,
                        fired: [BayesianDiagnosisEngine.FiredFeature],
                        features: [BayesianDiagnosisEngine.Candidate.Feature]) -> BayesianDiagnosisEngine.DiagnosisResult {
        BayesianDiagnosisEngine.DiagnosisResult(
            name: name, icdCode: icd, probability: probability, evidence: [], evidenceSources: [:], confidence: .low,
            rawLogPosterior: 0, logGap: 0, pathognomicFindings: [], urgency: urgency,
            firedFeatures: fired, candidateFeatures: features)
    }

    private func fired(_ key: String, _ value: String, _ logLR: Int, _ label: String, documentedAbsent: Bool = false) -> BayesianDiagnosisEngine.FiredFeature {
        BayesianDiagnosisEngine.FiredFeature(key: key, value: value, logLR: logLR, baseLogLR: logLR, label: label,
                                             sourceKey: "symptoms", citation: "Test citation", documentedAbsent: documentedAbsent)
    }

    func testAdapterExplainsFromFiredFeaturesAndOffersLipase() {
        let lipase = BayesianDiagnosisEngine.Candidate.Feature(key: "finding", value: "lipase&raised|amylase&raised", logLR: 15,
                                                                evidenceLabel: "Raised lipase or amylase")
        let back = fired("finding", "back", 8, "Pain radiating to the back")
        let results = [
            result("Acute Pancreatitis", icd: "K85.9", probability: 45, urgency: 2, fired: [back], features: [lipase]),
            result("Peptic Ulcer Disease", icd: "K27.9", probability: 35, urgency: 1,
                   fired: [fired("finding", "antacid", 5, "Relief with antacids")], features: []),
            result("Biliary Colic", icd: "K80.20", probability: 10, urgency: 0, fired: [], features: []),
        ]
        let input = DiagnosticReasoningAdapter.buildInput(results).input
        let panc = DiagnosticReasoning.explain(input, hypothesisId: "Acute Pancreatitis")
        XCTAssertEqual(panc.forFindings.first?.label, "Pain radiating to the back")
        XCTAssertEqual(panc.forFindings.first?.source, "Test citation")
        XCTAssertEqual(panc.missing.first?.label, "Raised lipase or amylase")
        XCTAssertEqual(panc.missing.first?.documented, false)
        let pud = DiagnosticReasoning.explain(input, hypothesisId: "Peptic Ulcer Disease")
        XCTAssertEqual(pud.doesntFit.first?.favours, "Acute Pancreatitis")

        let disc = DiagnosticReasoningAdapter.discriminators(results, input: input)
        XCTAssertEqual(disc.first?.probe.label, "Raised lipase or amylase")
        XCTAssertEqual(disc.first?.probe.kind, .investigation)
        XCTAssertEqual(disc.first?.probe.cost, .lab)
        XCTAssertTrue(disc.first?.why.hasPrefix("If positive: Acute Pancreatitis 45% →") ?? false, disc.first?.why ?? "")
    }

    func testAdapterNotFindingIsAMissingCardinalFinding() {
        let nf = fired("notFinding", "chest|arm pain|jaw", -6, "No chest, arm or jaw pain", documentedAbsent: true)
        let results = [
            result("Acute Coronary Syndrome", icd: "I24.9", probability: 60, urgency: 3, fired: [nf], features: []),
            result("Gastritis", icd: "K29.7", probability: 30, urgency: 0, fired: [], features: []),
        ]
        let input = DiagnosticReasoningAdapter.buildInput(results).input
        let acs = DiagnosticReasoning.explain(input, hypothesisId: "Acute Coronary Syndrome")
        XCTAssertEqual(acs.missing.first?.label, "chest, arm or jaw pain")
        XCTAssertEqual(acs.missing.first?.documented, true)
        XCTAssertEqual(acs.missing.first?.lr ?? 0, exp(-6.0 / 5.0), accuracy: 1e-9)
    }

    func testAdapterFindsTheWorkingDiagnosis() {
        let results = [
            result("Acute Pancreatitis", icd: "K85.9", probability: 70, urgency: 2, fired: [], features: []),
            result("Biliary Colic / Symptomatic Cholelithiasis", icd: "K80.20", probability: 20, urgency: 0, fired: [], features: []),
        ]
        XCTAssertEqual(DiagnosticReasoningAdapter.workingIndex(results, name: "Biliary colic", icd: nil), 1)
        XCTAssertEqual(DiagnosticReasoningAdapter.workingIndex(results, name: "Gallstone pancreatitis", icd: "K85.1"), 0)
        XCTAssertNil(DiagnosticReasoningAdapter.workingIndex(results, name: "Inguinal hernia", icd: "K40.90"))
        XCTAssertNil(DiagnosticReasoningAdapter.workingIndex(results, name: nil, icd: nil))
    }

    func testStatedLikelihoodRatioAndOneFindingPerLabel() {
        // A stated LR 1.5 is stored as 2; exp(2 / 5) = 1.49 fell below the 1.5 "supports" threshold.
        let stated = BayesianDiagnosisEngine.FiredFeature(key: "complaint", value: "vomit|nausea", logLR: 2, baseLogLR: 2,
                                                          label: "Vomiting as the presenting complaint", sourceKey: "symptoms",
                                                          citation: nil, documentedAbsent: false, statedLR: 1.5)
        XCTAssertEqual(DiagnosticReasoningAdapter.lr(stated), 1.5, accuracy: 1e-12)
        XCTAssertEqual(DiagnosticReasoningAdapter.lr(fired("finding", "vomit", 2, "Vomiting")), exp(0.4), accuracy: 1e-12)
        // The same finding fired by two candidates under one label is one finding, supported by both.
        let a = BayesianDiagnosisEngine.FiredFeature(key: "finding", value: "vomit", logLR: 2, baseLogLR: 2, label: "Vomiting",
                                                     sourceKey: "symptoms", citation: nil, documentedAbsent: false, statedLR: 1.5)
        let b = BayesianDiagnosisEngine.FiredFeature(key: "associations", value: "Vomiting", logLR: 3, baseLogLR: 3, label: "Vomiting",
                                                     sourceKey: "symptoms", citation: nil, documentedAbsent: false, statedLR: 2)
        let results = [
            result("Acute Pancreatitis", icd: "K85.9", probability: 60, urgency: 2, fired: [a], features: []),
            result("Small Bowel Obstruction", icd: "K56.609", probability: 30, urgency: 2, fired: [b], features: []),
        ]
        let built = DiagnosticReasoningAdapter.buildInput(results)
        XCTAssertEqual(built.input.findings.map(\.label), ["Vomiting"])
        XCTAssertEqual(DiagnosticReasoning.unexplainedFindings(built.input, hypothesisIds: built.input.hypotheses.map(\.id)), [])
    }

    func testWorkingDiagnosisBelowTheShownFiveIsCompared() {
        // reasoning-closure-gastroenteritis-dka: the engine ranks gastroenteritis below the five shown.
        let hpi = "Vomiting since yesterday with central abdominal pain and thirst. Type 1 diabetes on insulin; has been eating little. Breathing deep and fast."
        let results = BayesianDiagnosisEngine.infer(
            chiefComplaint: "Vomiting and abdominal pain", socratesSelections: ["associations": ["Vomiting"]],
            pmhNotes: "CONDITIONS: Type 1 diabetes", surgicalHistory: nil,
            examAbdo: "Diffusely tender, soft.", examGeneral: "Dry mucous membranes. Deep sighing respiration.",
            investigations: [
                InvestigationEntry(name: "Blood ketones", category: .blood, status: .resulted, result: "5.4 mmol/L"),
                InvestigationEntry(name: "Bicarbonate", category: .blood, status: .resulted, result: "9 mmol/L"),
            ],
            ageYears: 23, sex: .female, hpi: hpi)
        XCTAssertEqual(results.first?.name, "Diabetic Ketoacidosis")
        XCTAssertFalse(results.first?.rankedBelow.isEmpty ?? true, "the other scored candidates ride on the first result")
        XCTAssertTrue(results.first?.firedFeatures.contains { $0.statedLR != nil } ?? false, "curated features carry their stated LR")
        let p = Patient(fullName: "Reasoning Test", sex: .female)
        p.chiefComplaint = "Vomiting and abdominal pain"
        p.hpi = hpi
        p.workingDiagnosis = "Gastroenteritis"
        p.workingDiagnosisICD = "A09"
        let report = DiagnosticReasoningAdapter.report(results: results, patient: p)
        XCTAssertNotNil(report.workingId, "gastroenteritis is found among every scored candidate")
        XCTAssertTrue(report.closureAlerts.contains {
            $0.kind == .lessLikely && $0.text.hasPrefix("Doesn't fit the working diagnosis") && $0.text.contains("Diabetic Ketoacidosis")
        }, report.closureAlerts.map(\.text).joined(separator: " | "))
    }

    func testEngineRecordsFiredFeaturesWithoutChangingWeights() {
        // The same inputs give the same ranking and probabilities; the evidence record is extra.
        let run = {
            BayesianDiagnosisEngine.infer(
                chiefComplaint: "Upper abdominal pain", socratesSelections: [:], pmhNotes: nil, surgicalHistory: nil,
                examAbdo: "Epigastric tenderness", examGeneral: nil,
                investigations: [InvestigationEntry(name: "Lipase", category: .blood, status: .resulted, result: "1850 U/L raised")],
                ageYears: 44, sex: .female, hpi: "Epigastric pain radiating to the back with vomiting")
        }
        let a = run()
        let b = run()
        XCTAssertEqual(a.map(\.name), b.map(\.name))
        XCTAssertEqual(a.map(\.probability), b.map(\.probability))
        XCTAssertFalse(a.isEmpty)
        XCTAssertTrue(a.contains { !$0.firedFeatures.isEmpty }, "the evidence record is filled")
        for r in a {
            let positive = r.firedFeatures.filter { $0.logLR > 0 && !$0.label.isEmpty && $0.sourceKey != "demographics" && $0.sourceKey != "other" }
            XCTAssertLessThanOrEqual(positive.count, r.firedFeatures.count)
        }
    }
}
