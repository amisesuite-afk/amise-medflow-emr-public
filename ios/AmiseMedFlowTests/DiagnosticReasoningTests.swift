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
        XCTAssertFalse(ZebraCheck.rules.isEmpty, "ZebraRules.json must be bundled and decode")
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
