// WhatsMissingPatient.swift
// "What's missing" — the iOS adapter: reads the Patient into the shared core's input
// (WhatsMissingCore*.swift) and the score auto-fill record the populators pre-fill from.
//
// Every signal comes from an engine that already exists: NEWS2 parameters (latest vitals), the
// inputs of the scores DiagnosisScoreMapper recommends (or the clinician stored), the decision
// layer's missing inputs (DecisionSupportPatient, probed), the reasoning card's best next
// discriminator (DiagnosticReasoningAdapter), the NG12 / BSG ferritin prompt
// (SuspectedCancerScreening) and the safety basics. Pure reads: nothing here writes to the patient.
// Web twin: artifacts/dashboard/src/lib/whats-missing-web.ts.

import Foundation

enum WhatsMissingPatient {

    /// ActiveScore → canonical key, for the scores the core fills or checks.
    static func canonicalKey(_ s: ActiveScore) -> String? {
        switch s {
        case .alvarado: return "alvarado"
        case .airScore: return "air"
        case .tokyoChole: return "tg18-cholecystitis"
        case .tokyoCholang: return "tg18-cholangitis"
        case .qsofa: return "qsofa"
        case .news2: return "news2"
        case .bisap: return "bisap"
        case .blatchford: return "glasgow-blatchford"
        case .rcri: return "rcri"
        case .caprini: return "caprini"
        case .wellsDVT: return "wells-dvt"
        case .wellsPE: return "wells-pe"
        case .curb65: return "curb65"
        default: return nil
        }
    }

    // MARK: - Labs (the populators' keyword lists; whole-word LabNameMatch through latestLab)

    static let wbcKeywords = ["wbc", "white blood cell", "white cell count", "leucocyte", "leukocyte"]
    static let neutrophilKeywords = ["neutrophil", "neutrophils", "neut", "pmn", "polymorphs"]
    static let crpKeywords = ["crp", "c-reactive protein", "c reactive protein"]
    static let ureaKeywords = ["urea", "blood urea", "bun", "blood urea nitrogen"]
    static let hbKeywords = ["haemoglobin", "hemoglobin", "hgb", "hb"]
    static let egfrKeywords = ["egfr", "gfr"]

    static func labs(_ p: Patient) -> WhatsMissing.Labs {
        var l = WhatsMissing.Labs()
        l.wbc = p.latestLab(named: wbcKeywords)
        l.neutrophils = p.latestLab(named: neutrophilKeywords)
        l.crp = p.latestLab(named: crpKeywords)
        // As the populators: a urea above 50 is BUN in mg/dL (÷ 2.8 → mmol/L).
        l.urea = p.latestLab(named: ureaKeywords).map { $0 > 50 ? $0 / 2.8 : $0 }
        l.hb = p.latestLab(named: hbKeywords)
        l.creatinine = p.creatinineUmolL()
        l.egfr = p.ckdEpiEgfr ?? p.latestLab(named: egfrKeywords)
        // As the TG18 populator: a bilirubin below 5 is mg/dL (× 17.1 → µmol/L).
        l.bilirubin = p.latestLab(named: ["bilirubin"]).map { $0 < 5 ? $0 * 17.1 : $0 }
        l.albumin = p.latestLab(named: ["albumin"])
        l.inr = p.latestLab(named: ["inr"])
        return l
    }

    // MARK: - Record

    /// ≤ 4 characters: whole word; otherwise word start (the web uses the same rule).
    static func affirmed(_ source: NegationMatcher.Source, _ terms: [String]) -> Bool {
        terms.contains { t in t.count <= 4 ? source.contains(t, wholeWord: true) : source.contains(t, wordStart: true) }
    }

    static func historyText(_ p: Patient) -> String {
        NegationMatcher.joinClauses(p.pmhEntries.map { Optional($0.condition) } + [p.pmhNotes, p.surgicalHistory])
    }

    static func findingsText(_ p: Patient) -> String {
        NegationMatcher.joinClauses([p.chiefComplaint, p.associatedSymptoms, p.hpi, p.examGeneral, p.examAbdo, p.examCVS,
                                     p.examResp, p.examNeuro, p.examMSK, p.examSkin, p.examOther])
    }

    static func imagingReports(_ p: Patient) -> [String] {
        p.investigations
            .filter { $0.category == .imaging && $0.status == .resulted && !$0.result.isEmpty }
            .map { $0.result }
    }

    static func record(_ p: Patient, rules: WhatsMissing.Rules) -> WhatsMissing.Record {
        var r = WhatsMissing.Record.empty()
        r.ageYears = p.dateOfBirth == nil ? nil : Double(p.ageYears)
        r.sex = p.sex == .male ? "male" : (p.sex == .female ? "female" : "unknown")
        let latest = p.vitalsEntries.filter { $0.hasAnyValue }.sorted { $0.recordedAt > $1.recordedAt }.first
        r.weightKg = p.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.compactMap { $0.weightKg }.first
        r.heightCm = p.heightCm
        if let v = latest {
            r.vitals.hr = v.heartRate.map { Double($0) }
            r.vitals.sbp = v.bpSystolic.map { Double($0) }
            r.vitals.dbp = v.bpDiastolic.map { Double($0) }
            r.vitals.rr = v.respiratoryRate.map { Double($0) }
            r.vitals.tempC = v.temperatureCelsius
            r.vitals.spo2 = v.spo2.map { Double($0) }
            // iOS always charts ACVPU and air / oxygen with an entry (NEWS2Chart).
            r.vitals.avpu = v.avpu.rawValue
            r.vitals.onOxygen = v.onSupplementalO2
        }
        r.labs = labs(p)
        let imaging = imagingReports(p)
        r.imagingReported = !imaging.isEmpty
        r.pleuralEffusion = imaging.contains { affirmed(NegationMatcher.Source($0), rules.terms.pleuralEffusion) }

        let history = NegationMatcher.Source(historyText(p))
        let meds = p.prescriptions.map { $0.drug }
        func hist(_ key: String) -> Bool { affirmed(history, rules.terms.history[key] ?? []) }
        let signals = PlanSafetyFilter.signals(RadiationContext(patient: p))
        let pod = p.postOpDays
        r.history = [
            "cancer": hist("cancer"),
            "priorDvt": hist("priorDvt"),
            "priorPe": hist("priorPe"),
            "chf": hist("chf"),
            "ihd": hist("ihd"),
            "cva": hist("cva"),
            "insulin": !WhatsMissing.termsFound(meds, rules.terms.insulinDrugs).isEmpty || hist("insulinDependent"),
            "liverDisease": hist("liverDisease"),
            "ibd": hist("ibd"),
            "varicoseVeins": hist("varicoseVeins"),
            "ocpHrt": hist("ocpHrt") || !WhatsMissing.termsFound(meds, rules.terms.history["ocpHrt"] ?? []).isEmpty,
            "immobile": hist("immobile") || affirmed(NegationMatcher.Source(p.hpi ?? ""), rules.terms.history["immobile"] ?? []),
            "pregnant": signals.pregnancy == .pregnant,
            "recentSurgery4w": pod.map { $0 >= 0 && $0 <= 28 } ?? false,
            "recentSurgery12w": pod.map { $0 >= 0 && $0 <= 84 } ?? false,
        ]
        let findings = NegationMatcher.Source(findingsText(p))
        var f: [String: Bool] = [:]
        for (key, terms) in rules.terms.findings { f[key] = affirmed(findings, terms) }
        r.findings = f
        return r
    }

    // MARK: - Facts

    static let pregnancyResultWords = ["pregnancy", "hcg", "b-hcg", "β-hcg", "beta-hcg", "bhcg"]
    static let notOfChildbearing = ["post-menopausal", "postmenopausal", "hysterectomy"]

    static func facts(_ p: Patient, rules: WhatsMissing.Rules, procedurePlanned: Bool, now: Date = .now) -> WhatsMissing.Facts {
        let signals = PlanSafetyFilter.signals(RadiationContext(patient: p))
        let invs = p.investigations
        let resultedNames = invs.filter { $0.status == .resulted && !$0.result.isEmpty }.map { $0.name }
        let today = Calendar.ect.startOfDay(for: now)
        let planned = p.prescriptions.filter { $0.prescribedAt >= today }.map { $0.drug }
            + WhatsMissing.termsFound([p.managementPlan ?? ""], rules.terms.renalDrugs + rules.terms.anticoagulants)
        let history = NegationMatcher.Source(historyText(p))
        return WhatsMissing.Facts(
            allergyStatusRecorded: p.safetyAllergyState != .notRecorded,
            pregnancyStatusRecorded: signals.pregnancy != .unknown
                || resultedNames.contains { n in pregnancyResultWords.contains { WhatsMissing.termIn(n, $0) } }
                || affirmed(history, notOfChildbearing),
            supplementsAsked: p.supplementHistory.status != .notAsked,
            medications: p.prescriptions.map { $0.drug },
            plannedMedications: planned,
            medicationNotes: NegationMatcher.joinClauses([p.hpi, p.managementPlan, p.pmhNotes]
                                                         + p.prescriptions.map { Optional($0.indication) }),
            plannedInvestigations: invs.filter { $0.status == .suggested || $0.status == .ordered || $0.status == .pending }
                .map { $0.name },
            procedurePlanned: procedurePlanned,
            acute: p.setting == .inpatient || p.setting == .emergency || p.postOpDays != nil)
    }

    // MARK: - Engines

    /// DiagnosisScoreMapper recommendations and the stored calculator scores (canonical keys).
    static func activeScores(_ p: Patient) -> [String] {
        var out: [String] = []
        for rec in DiagnosisScoreMapper.recommendations(for: p) {
            if let key = canonicalKey(rec.score), !out.contains(key) { out.append(key) }
        }
        for s in DecisionSupportPatient.storedScores(p) where !out.contains(s.key) { out.append(s.key) }
        return out
    }

    static func discriminator(_ p: Patient, bayes: [BayesianDiagnosisEngine.DiagnosisResult]) -> WhatsMissing.Discriminator? {
        guard bayes.count >= 2,
              let d = DiagnosticReasoningAdapter.report(results: bayes, patient: p).discriminators.first else { return nil }
        return WhatsMissing.Discriminator(label: d.probe.label, kind: d.probe.cost.rawValue, separates: d.separates)
    }

    static func input(for p: Patient, bayes: [BayesianDiagnosisEngine.DiagnosisResult], rules: WhatsMissing.Rules,
                      activeScores scores: [String]? = nil, now: Date = .now) -> WhatsMissing.Input {
        let decision = DecisionSupportPatient.input(for: p, bayes: bayes)
        let procedurePlanned = decision.patient.procedurePlanned
            || LifestylePractices.procedureBooked(operationDate: p.operationDate, visitType: p.visitType, now: now)
        var gaps: [WhatsMissing.DecisionGap] = []
        if let content = TreatmentDecisions.content {
            gaps = WhatsMissing.decisionGaps(decision, rules: rules, content: content, filter: DecisionSupportPatient.lineFilter(for: p))
        }
        return WhatsMissing.Input(
            record: record(p, rules: rules),
            facts: facts(p, rules: rules, procedurePlanned: procedurePlanned, now: now),
            activeScores: scores ?? activeScores(p),
            decisionGaps: gaps,
            ferritinMissing: SuspectedCancerScreening.prompt(for: p)?.kind == .ferritinCheck,
            discriminator: discriminator(p, bayes: bayes))
    }

    /// Everything the strip shows (nil when the bundled rules are missing).
    static func result(for p: Patient, bayes: [BayesianDiagnosisEngine.DiagnosisResult],
                       activeScores scores: [String]? = nil, now: Date = .now) -> WhatsMissing.Result? {
        guard let rules = WhatsMissing.rules else { return nil }
        return WhatsMissing.whatsMissing(input(for: p, bayes: bayes, rules: rules, activeScores: scores, now: now), rules: rules)
    }

    /// The record the populators fill from (score auto-fill).
    static func fill(_ score: String, patient p: Patient) -> WhatsMissing.ScoreFill? {
        guard let rules = WhatsMissing.rules else { return nil }
        return WhatsMissing.scoreRecordFill(score, record(p, rules: rules), rules)
    }
}
