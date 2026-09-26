// SequentialDiagnosisEngine.swift
// Sequential Bayesian updating engine — posterior from each observation
// becomes the prior for the next. Seeds from BayesianDiagnosisEngine.

import Foundation
import Combine


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
        stoneUretericScore: Int? = nil,
        ottawaAnkleScore: Int? = nil,
        ottawaKneeScore: Int? = nil,
        canadianCTHeadScore: Int? = nil,
        nexusScore: Int? = nil,
        canadianCSpineScore: Int? = nil,
        sfSyncopeScore: Int? = nil,
        canadianSyncopeScore: Int? = nil,
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
            stoneUretericScore:  stoneUretericScore,
            ottawaAnkleScore:    ottawaAnkleScore,
            ottawaKneeScore:     ottawaKneeScore,
            canadianCTHeadScore: canadianCTHeadScore,
            nexusScore:          nexusScore,
            canadianCSpineScore: canadianCSpineScore,
            sfSyncopeScore:      sfSyncopeScore,
            canadianSyncopeScore: canadianSyncopeScore,
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
