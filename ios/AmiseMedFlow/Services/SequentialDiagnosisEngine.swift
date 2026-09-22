import Foundation
import Combine

// MARK: - Sequential Bayesian Updating Engine
// Posterior from one observation becomes the prior for the next.
// Seeds from BayesianDiagnosisEngine.infer() then updates live as evidence arrives.
// Feature correlation groups prevent double-counting correlated findings.

// MARK: - Output types

struct DiagnosisHypothesis: Identifiable {
    let id = UUID()
    var name: String
    var icdCode: String
    var logPosterior: Double          // log-odds units (natural log scale)
    var contributingEvidence: [(label: String, logLR: Double)]

    // Softmax probability computed across all hypotheses by the engine (display only)
    var probability: Double = 0.0

    // Primary Bayesian confidence signals — seeded from BayesianDiagnosisEngine
    var logGap: Int = 0                        // rank-1 minus rank-2 log-posterior gap
    var pathognomicFindings: [String] = []     // fired features with logLR ≥ 18

    // Confidence badge driven by logGap, not softmax probability
    var confidence: BayesianDiagnosisEngine.DiagnosisResult.Confidence {
        switch logGap {
        case 25...: return .certain
        case 15...: return .high
        case 7...:  return .moderate
        default:    return pathognomicFindings.isEmpty ? .low : .high
        }
    }
}

// MARK: - Evidence model

enum EvidenceSource: String {
    case history       = "History"
    case examination   = "Examination"
    case investigation = "Investigation"
    case vital         = "Vital Sign"
    case score         = "Clinical Score"
}

struct ClinicalEvidence: Identifiable {
    let id = UUID()
    let key: String            // canonical feature key matching BayesianDiagnosisEngine
    let value: String          // e.g. "rlq", "fever", "elevated_wbc"
    let displayLabel: String   // human-readable text for UI
    let source: EvidenceSource
    var timestamp: Date = .now
}

// MARK: - Feature correlation groups
// Correlated features within a cluster get dampened log-LR to avoid double-counting.
// ρ (rho): 0 = independent, 1 = fully redundant.
// Effective logLR when a correlated feature is already observed = logLR × (1 - ρ).

struct FeatureCorrelationGroup {
    let name: String
    // Map feature key → correlation coefficient ρ with the "index" feature of this group
    let correlations: [String: Double]   // key → ρ (0–1)
}

// MARK: - Log-LR lookup table
// Replicate evidence weights from BayesianDiagnosisEngine in double precision.
// Keys mirror the private Feature.key / Feature.value convention.

private enum LogLRTable {

    // Scale: every 10 units ≈ 10× likelihood ratio (natural log units × ~4.34)
    // These match the integer values in BayesianDiagnosisEngine scaled to Double.

    // Returns the log-likelihood ratio for a (key, value, diagnosisName) triple.
    // Returns 0 if no match found (neutral evidence).
    static func logLR(key: String, value: String, forDiagnosis name: String) -> Double {
        let k = key.lowercased()
        let v = value.lowercased()
        let d = name.lowercased()

        // --- Acute Appendicitis ---
        if d.contains("appendicitis") && !d.contains("perf") {
            switch k {
            case "site"   where v.contains("rlq"): return 15
            case "associations" where v.contains("anorexia"): return 8
            case "associations" where v.contains("nausea"): return 6
            case "exam"   where v.contains("rebound"): return 12
            case "exam"   where v.contains("rovsing"): return 10
            case "inv"    where v.contains("wbc") && v.contains("elevat"): return 10
            case "inv"    where v.contains("crp") && v.contains("elevat"): return 8
            case "age_under" where v == "40": return 5
            default: return 0
            }
        }

        // --- Biliary Colic / Acute Cholecystitis ---
        if d.contains("cholecystitis") || d.contains("biliary colic") {
            switch k {
            case "site"   where v.contains("ruq") || v.contains("epigastric"): return 12
            case "radiation" where v.contains("shoulder") || v.contains("scapula"): return 14
            case "associations" where v.contains("fatty") || v.contains("food"): return 10
            case "exam"   where v.contains("murphy"): return 16
            case "inv"    where v.contains("stone") || v.contains("gallstone"): return 20
            case "sex_female": return 4
            case "age_over" where v == "40": return 3
            default: return 0
            }
        }

        // --- Acute Pancreatitis ---
        if d.contains("pancreatitis") {
            switch k {
            case "site"   where v.contains("epigastric") || v.contains("upper abdomen"): return 10
            case "radiation" where v.contains("back"): return 14
            case "character" where v.contains("band-like") || v.contains("boring"): return 12
            case "associations" where v.contains("nausea") || v.contains("vomiting"): return 8
            case "relieving" where v.contains("lean forward"): return 16
            case "inv"    where v.contains("amylase") || v.contains("lipase"): return 22
            default: return 0
            }
        }

        // --- Bowel Obstruction ---
        if d.contains("obstruction") && (d.contains("bowel") || d.contains("sbo")) {
            switch k {
            case "character" where v.contains("colicky"): return 14
            case "associations" where v.contains("vomiting"): return 12
            case "associations" where v.contains("distension"): return 14
            case "associations" where v.contains("constipation") || v.contains("obstipation"): return 16
            case "pshx"  where v.contains("abdomen") || v.contains("laparotomy"): return 18
            case "exam"  where v.contains("high-pitched") || v.contains("tinkling"): return 14
            default: return 0
            }
        }

        // --- Perforated Viscus ---
        if d.contains("perforation") || d.contains("perforated") {
            switch k {
            case "onset"  where v.contains("sudden") || v.contains("immediate"): return 16
            case "exam"   where v.contains("rigid") || v.contains("board"): return 20
            case "exam"   where v.contains("peritonism") || v.contains("guarding"): return 14
            case "inv"    where v.contains("free air") || v.contains("pneumoperitoneum"): return 30
            default: return 0
            }
        }

        // --- Sepsis (abdominal source) ---
        if d.contains("sepsis") || d.contains("septic shock") {
            switch k {
            case "associations" where v.contains("fever") || v.contains("rigors"): return 10
            case "associations" where v.contains("tachycardia"): return 8
            case "associations" where v.contains("hypotension"): return 14
            case "associations" where v.contains("confusion") || v.contains("altered"): return 12
            case "exam"   where v.contains("cold") && v.contains("peripheries"): return 12
            case "inv"    where v.contains("lactate") && v.contains("elevat"): return 20
            case "inv"    where v.contains("blood culture") && v.contains("positive"): return 22
            default: return 0
            }
        }

        // --- Pulmonary Embolism ---
        if d.contains("pulmonary embol") || d.contains(" pe") || d == "pe" {
            switch k {
            case "onset"  where v.contains("sudden"): return 10
            case "associations" where v.contains("pleuritic"): return 12
            case "associations" where v.contains("haemoptysis") || v.contains("hemoptysis"): return 14
            case "associations" where v.contains("leg swelling") || v.contains("dvt"): return 16
            case "pmh"   where v.contains("dvt") || v.contains("clot"): return 14
            case "inv"   where v.contains("d-dimer") && v.contains("elevat"): return 12
            case "inv"   where v.contains("ctpa") && v.contains("positive"): return 40
            default: return 0
            }
        }

        // --- DVT ---
        if d.contains("dvt") || d.contains("deep vein") {
            switch k {
            case "site"  where v.contains("calf") || v.contains("leg"): return 10
            case "character" where v.contains("swelling") || v.contains("tender"): return 12
            case "pmh"   where v.contains("dvt") || v.contains("thrombophilia"): return 16
            case "inv"   where v.contains("d-dimer") && v.contains("elevat"): return 10
            case "inv"   where v.contains("duplex") && v.contains("thrombus"): return 40
            default: return 0
            }
        }

        // --- Necrotising Fasciitis ---
        if d.contains("necrotis") || d.contains("fasciitis") {
            switch k {
            case "onset"  where v.contains("rapid") || v.contains("fast"): return 16
            case "character" where v.contains("severe") && v.contains("pain"): return 12
            case "exam"   where v.contains("crepitus"): return 30
            case "exam"   where v.contains("skin") && (v.contains("necrosis") || v.contains("bullae")): return 26
            case "associations" where v.contains("fever"): return 8
            case "inv"   where v.contains("crp") && v.contains(">150"): return 14
            case "inv"   where v.contains("wbc") && v.contains(">15"): return 12
            default: return 0
            }
        }

        // --- Acute Limb Ischaemia ---
        if d.contains("ischaemia") || d.contains("ischemia") || d.contains("embol") {
            switch k {
            case "onset"  where v.contains("sudden"): return 16
            case "character" where v.contains("pale") || v.contains("pulseless"): return 20
            case "associations" where v.contains("cold"): return 14
            case "associations" where v.contains("paresthesia") || v.contains("numbness"): return 14
            case "associations" where v.contains("paralysis") || v.contains("weakness"): return 20
            case "pmh"   where v.contains("af") || v.contains("atrial fibrillation"): return 16
            default: return 0
            }
        }

        return 0
    }
}

// MARK: - Correlation groups

private let correlationGroups: [FeatureCorrelationGroup] = [
    FeatureCorrelationGroup(
        name: "Inflammatory response",
        correlations: [
            "fever_tachycardia": 0.70,
            "fever_crp_elevated": 0.65,
            "fever_wbc_elevated": 0.65,
            "crp_wbc": 0.60
        ]
    ),
    FeatureCorrelationGroup(
        name: "Peritonism",
        correlations: [
            "guarding_rebound": 0.80,
            "guarding_rigidity": 0.75,
            "rebound_rigidity": 0.75
        ]
    ),
    FeatureCorrelationGroup(
        name: "Shock",
        correlations: [
            "tachycardia_hypotension": 0.75,
            "tachycardia_cold_peripheries": 0.70,
            "hypotension_cold_peripheries": 0.72
        ]
    ),
    FeatureCorrelationGroup(
        name: "Ischaemia signs (6 Ps)",
        correlations: [
            "pain_pallor": 0.60,
            "pain_pulselessness": 0.60,
            "pallor_pulselessness": 0.80,
            "pallor_perishing_cold": 0.70,
            "pulselessness_paresthesia": 0.65
        ]
    )
]

// Lookup ρ for a pair of feature keys already observed for the same hypothesis
private func correlationCoefficient(alreadyObserved obs: String, newKey: String) -> Double {
    for group in correlationGroups {
        let pair1 = "\(obs)_\(newKey)"
        let pair2 = "\(newKey)_\(obs)"
        if let rho = group.correlations[pair1] ?? group.correlations[pair2] {
            return rho
        }
    }
    return 0.0
}

// MARK: - Engine

@MainActor
final class SequentialDiagnosisEngine: ObservableObject {

    @Published private(set) var hypotheses: [DiagnosisHypothesis] = []
    @Published private(set) var evidenceLog: [ClinicalEvidence] = []
    @Published private(set) var isSeeded: Bool = false

    // Evidence keys already observed per hypothesis (for correlation dampening)
    private var observedKeys: [String: [String]] = [:]   // hypothesisName → [evidenceKey]
    // Seeded log-posteriors — used by resetToSeeded() to restore the base before replaying
    private var seededLogPosteriors: [String: Double] = [:]  // hypothesisName → logPosterior

    // MARK: - Seed from Naive-Bayes snapshot

    func seed(
        chiefComplaint: String?,
        socratesSelections: [String: Set<String>],
        pmhNotes: String?,
        surgicalHistory: String?,
        examAbdo: String?,
        examGeneral: String?,
        investigations: [InvestigationEntry],
        ageYears: Int,
        sex: Sex,
        medications: [String] = [],
        socialHistoryText: String? = nil,
        bmi: Double? = nil,
        alvaradoScore: Int? = nil,
        glasgowPancreatitisScore: Int? = nil,
        ransonScore: Int? = nil,
        tokyoCholecystitisGrade: Int? = nil,
        tokyoCholangitisGrade: Int? = nil,
        rockallScore: Int? = nil,
        blatchfordScore: Int? = nil,
        wellsDVTScore: Double? = nil,
        wellsPEScore: Double? = nil,
        abcd2Score: Int? = nil,
        lrinecScore: Int? = nil,
        qsofaScore: Int? = nil,
        psiScore: Int? = nil,
        capriniScore: Int? = nil,
        bisapScore: Int? = nil,
        aims65Score: Int? = nil,
        sofaScore: Int? = nil,
        fib4Score: Double? = nil,
        curb65Score: Int? = nil,
        paduaScore: Int? = nil,
        apacheIIScore: Int? = nil,
        ppossumMortPct10: Int? = nil,
        mpiScore: Int? = nil,
        ctsiScore: Int? = nil,
        nrs2002Score: Int? = nil,
        forrestGrade: Int? = nil,
        heartScore: Int? = nil,
        mallampatiClass: Int? = nil,
        cfsScore: Int? = nil,
        timiScore: Int? = nil,
        waterlowScore: Int? = nil,
        surgicalApgarScore: Int? = nil,
        graceScore: Int? = nil,
        dasiScore: Int? = nil,
        barthelScore: Int? = nil,
        euroScoreII: Int? = nil,
        nihssScore: Int? = nil,
        mrsScore: Int? = nil,
        mustScore: Int? = nil,
        clavienDindoScore: Int? = nil,
        aldreteScore: Int? = nil,
        fourTScore: Int? = nil,
        oaklandScore: Int? = nil,
        kingsCriteriaScore: Int? = nil,
        childPughScore: Int? = nil,
        meldScore: Int? = nil,
        asaScore: Int? = nil,
        ecogScore: Int? = nil,
        rtsScore: Int? = nil,
        kdigoStage: Int? = nil,
        bauxScore: Int? = nil,
        issScore: Int? = nil,
        nutricScore: Int? = nil,
        spesiScore: Int? = nil,
        decafScore: Int? = nil,
        hincheyGrade: Int? = nil,
        airScore: Int? = nil,
        percViolations: Int? = nil,
        shockIndex: Int? = nil,
        parklandVolume: Int? = nil,
        pasScore: Int? = nil,
        revisedGenevaScore: Int? = nil,
        cciScore: Int? = nil,
        mfi5Score: Int? = nil,
        hapsScore: Int? = nil,
        glasgowImrieScore: Int? = nil,
        albiScore: Double? = nil,
        auditCScore: Int? = nil,
        phq9Score: Int? = nil,
        sapsIIScore: Int? = nil,
        stoneScore: Int? = nil,
        losAngelesGrade: Int? = nil,
        meld3Score: Double? = nil,
        bradenScore: Int? = nil,
        centorScore: Int? = nil,
        ipssScore: Int? = nil,
        trueloveWittsScore: Int? = nil,
        harveyBradshawScore: Int? = nil,
        maddreyScore: Double? = nil,
        manningScore: Int? = nil,
        laceScore: Int? = nil,
        findRiscScore: Int? = nil,
        mirelsScore: Int? = nil,
        ckdEpiEgfr: Double? = nil,
        ariscatScore: Int? = nil,
        fongCrsScore: Int? = nil,
        berlinPFRatio: Double? = nil,
        cageScore: Int? = nil,
        dukeIEScore: Double? = nil,
        mmrcGrade: Int? = nil,
        ptsScore: Int? = nil,
        ripasaScore: Double? = nil,
        fgsiScore: Int? = nil,
        sirsScore: Int? = nil,
        mewsScore: Int? = nil,
        independentNews2: Int? = nil,
        gcsScore: Int? = nil,
        rcriScore: Int? = nil,
        stopBangScore: Int? = nil,
        cha2ds2vascScore: Int? = nil,
        hasBledScore: Int? = nil,
        latestHR: Int? = nil,
        latestSBP: Int? = nil,
        latestTemp: Double? = nil,
        latestSpO2: Int? = nil,
        latestRR: Int? = nil,
        news2Score: Int? = nil
    ) {
        let results = BayesianDiagnosisEngine.infer(
            chiefComplaint: chiefComplaint,
            socratesSelections: socratesSelections,
            pmhNotes: pmhNotes,
            surgicalHistory: surgicalHistory,
            examAbdo: examAbdo,
            examGeneral: examGeneral,
            investigations: investigations,
            ageYears: ageYears,
            sex: sex,
            medications: medications,
            socialHistoryText: socialHistoryText,
            bmi: bmi,
            alvaradoScore: alvaradoScore,
            glasgowPancreatitisScore: glasgowPancreatitisScore,
            ransonScore: ransonScore,
            tokyoCholecystitisGrade: tokyoCholecystitisGrade,
            tokyoCholangitisGrade: tokyoCholangitisGrade,
            rockallScore: rockallScore,
            blatchfordScore: blatchfordScore,
            wellsDVTScore: wellsDVTScore,
            wellsPEScore: wellsPEScore,
            abcd2Score: abcd2Score,
            lrinecScore: lrinecScore,
            qsofaScore: qsofaScore,
            psiScore: psiScore,
            capriniScore: capriniScore,
            bisapScore: bisapScore,
            aims65Score: aims65Score,
            sofaScore: sofaScore,
            fib4Score: fib4Score,
            curb65Score: curb65Score,
            paduaScore: paduaScore,
            apacheIIScore: apacheIIScore,
            ppossumMortPct10: ppossumMortPct10,
            mpiScore: mpiScore,
            ctsiScore: ctsiScore,
            nrs2002Score: nrs2002Score,
            forrestGrade: forrestGrade,
            heartScore: heartScore,
            mallampatiClass: mallampatiClass,
            cfsScore: cfsScore,
            timiScore: timiScore,
            waterlowScore: waterlowScore,
            surgicalApgarScore: surgicalApgarScore,
            graceScore: graceScore,
            dasiScore: dasiScore,
            barthelScore: barthelScore,
            euroScoreII: euroScoreII,
            nihssScore: nihssScore,
            mrsScore: mrsScore,
            mustScore: mustScore,
            clavienDindoScore: clavienDindoScore,
            aldreteScore: aldreteScore,
            fourTScore: fourTScore,
            oaklandScore: oaklandScore,
            kingsCriteriaScore: kingsCriteriaScore,
            childPughScore: childPughScore,
            meldScore: meldScore,
            asaScore: asaScore,
            ecogScore: ecogScore,
            rtsScore: rtsScore,
            kdigoStage: kdigoStage,
            bauxScore: bauxScore,
            issScore: issScore,
            nutricScore: nutricScore,
            spesiScore: spesiScore,
            decafScore: decafScore,
            hincheyGrade: hincheyGrade,
            airScore: airScore,
            percViolations: percViolations,
            shockIndex: shockIndex,
            parklandVolume: parklandVolume,
            pasScore: pasScore,
            revisedGenevaScore: revisedGenevaScore,
            cciScore: cciScore,
            mfi5Score: mfi5Score,
            hapsScore: hapsScore,
            bisapScore: bisapScore,
            glasgowImrieScore: glasgowImrieScore,
            albiScore: albiScore,
            auditCScore: auditCScore,
            phq9Score: phq9Score,
            sapsIIScore: sapsIIScore,
            stoneScore: stoneScore,
            losAngelesGrade: losAngelesGrade,
            meld3Score: meld3Score,
            bradenScore: bradenScore,
            centorScore: centorScore,
            ipssScore: ipssScore,
            trueloveWittsScore: trueloveWittsScore,
            harveyBradshawScore: harveyBradshawScore,
            maddreyScore:        maddreyScore,
            manningScore:        manningScore,
            laceScore:           laceScore,
            findRiscScore:       findRiscScore,
            mirelsScore:         mirelsScore,
            ckdEpiEgfr:          ckdEpiEgfr,
            ariscatScore:        ariscatScore,
            fongCrsScore:        fongCrsScore,
            berlinPFRatio:       berlinPFRatio,
            cageScore:           cageScore,
            dukeIEScore:         dukeIEScore,
            mmrcGrade:           mmrcGrade,
            ptsScore:            ptsScore,
            capriniScore:        capriniScore,
            childPughScore:      childPughScore,
            ripasaScore:         ripasaScore,
            fgsiScore:           fgsiScore,
            sirsScore:           sirsScore,
            mewsScore:           mewsScore,
            independentNews2:    independentNews2,
            gcsScore:            gcsScore,
            rcriScore:           rcriScore,
            stopBangScore:       stopBangScore,
            cha2ds2vascScore:    cha2ds2vascScore,
            hasBledScore:        hasBledScore,
            latestHR: latestHR,
            latestSBP: latestSBP,
            latestTemp: latestTemp,
            latestSpO2: latestSpO2,
            latestRR: latestRR,
            news2Score: news2Score
        )

        guard !results.isEmpty else {
            hypotheses = []
            isSeeded = false
            return
        }

        // Convert integer probability back to log-odds (log(p / (1 - p)))
        hypotheses = results.map { r in
            let p = max(0.01, min(0.99, Double(r.probability) / 100.0))
            let logOdds = log(p / (1.0 - p))
            var h = DiagnosisHypothesis(
                name: r.name,
                icdCode: r.icdCode,
                logPosterior: logOdds,
                contributingEvidence: r.evidence.map { ($0, 0.0) }
            )
            h.probability = p
            h.logGap = r.logGap
            h.pathognomicFindings = r.pathognomicFindings
            return h
        }

        observedKeys = Dictionary(uniqueKeysWithValues: hypotheses.map { ($0.name, [String]()) })
        seededLogPosteriors = Dictionary(uniqueKeysWithValues: hypotheses.map { ($0.name, $0.logPosterior) })
        recomputeProbabilities()
        isSeeded = true
    }

    // MARK: - Incremental update

    func update(with evidence: ClinicalEvidence) {
        guard isSeeded else { return }

        evidenceLog.append(evidence)

        for i in hypotheses.indices {
            let name = hypotheses[i].name
            let baseLogLR = LogLRTable.logLR(key: evidence.key, value: evidence.value, forDiagnosis: name)
            guard baseLogLR != 0 else { continue }

            // BayesianFeatureNetwork CPT adjustment: if a parent of this feature
            // has already been observed, use the DAG-adjusted LR (principled over flat ρ-dampening)
            let prevKeys = Set(observedKeys[name] ?? [])
            let adjustedLR = BayesianFeatureNetwork.adjustedLogLR(
                featureID: evidence.key,
                featurePresent: true,
                observedIDs: prevKeys,
                baseLogLR: baseLogLR
            )

            hypotheses[i].logPosterior += adjustedLR
            hypotheses[i].contributingEvidence.append((evidence.displayLabel, adjustedLR))
        }

        // Record key as observed for each hypothesis
        for name in hypotheses.map(\.name) {
            observedKeys[name, default: []].append(evidence.key)
        }

        recomputeProbabilities()
    }

    // MARK: - Retract evidence (full replay)

    func retract(_ evidence: ClinicalEvidence) {
        evidenceLog.removeAll { $0.id == evidence.id }
        resetToSeeded()
        for ev in evidenceLog { update(with: ev) }
    }

    // MARK: - Reset

    func reset() {
        hypotheses = []
        evidenceLog = []
        observedKeys = [:]
        seededLogPosteriors = [:]
        isSeeded = false
    }

    // MARK: - Query

    func topDiagnoses(n: Int = 5) -> [DiagnosisHypothesis] {
        Array(hypotheses.sorted { $0.probability > $1.probability }.prefix(n))
    }

    func leadDiagnosis() -> DiagnosisHypothesis? {
        hypotheses.max(by: { $0.probability < $1.probability })
    }

    // MARK: - Private helpers

    private func resetToSeeded() {
        // Restore each hypothesis to its seeded log-posterior and clear incremental evidence.
        for i in hypotheses.indices {
            let name = hypotheses[i].name
            if let seededLP = seededLogPosteriors[name] {
                hypotheses[i].logPosterior = seededLP
            }
            hypotheses[i].contributingEvidence = hypotheses[i].contributingEvidence.filter { $0.logLR == 0.0 }
        }
        observedKeys = Dictionary(uniqueKeysWithValues: hypotheses.map { ($0.name, [String]()) })
    }

    private func recomputeProbabilities() {
        guard !hypotheses.isEmpty else { return }
        // Convert log-posteriors to probabilities via softmax
        let logPs = hypotheses.map(\.logPosterior)
        let maxLP = logPs.max() ?? 0
        let exps = logPs.map { exp($0 - maxLP) }
        let sumExp = exps.reduce(0, +)
        for i in hypotheses.indices {
            hypotheses[i].probability = sumExp > 0 ? exps[i] / sumExp : 1.0 / Double(hypotheses.count)
        }
    }
}
