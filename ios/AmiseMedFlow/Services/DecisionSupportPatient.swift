// DecisionSupportPatient.swift
// The record → treatment decision layer input (iOS twin of
// artifacts/dashboard/src/lib/decision-support.ts): the patient factors, the stored calculator
// scores, NEWS2 / qSOFA from the latest vitals, the lab values, the working diagnosis and the
// Bayesian differential; the PlanSafetyFilter line filter (final hard filter); and how the resulted
// investigations moved the differential (BayesianDiagnosisEngine re-run without them).
//
// Pure reads of the record: nothing here writes to the patient.

import Foundation

enum DecisionSupportPatient {

    // MARK: - Scores

    /// Scores saved on the patient from the Clinical Scores screen, under the canonical keys.
    static func storedScores(_ p: Patient) -> [TreatmentDecisions.Score] {
        var out: [TreatmentDecisions.Score] = []
        func add(_ key: String, _ value: Int?) {
            if let v = value {
                out.append(TreatmentDecisions.Score(key: key, value: Double(v), source: "calculator", redParameter: nil))
            }
        }
        func addDouble(_ key: String, _ value: Double?) {
            if let v = value {
                out.append(TreatmentDecisions.Score(key: key, value: v, source: "calculator", redParameter: nil))
            }
        }
        add("alvarado", p.alvaradoScore)
        add("air", p.airScore)
        add("tg18-cholecystitis", p.tokyoCholecystitisGrade)
        add("tg18-cholangitis", p.tokyoCholangitisGrade)
        addDouble("wells-pe", p.wellsPEScore)
        addDouble("wells-dvt", p.wellsDVTScore)
        add("curb65", p.curb65Score)
        add("glasgow-blatchford", p.blatchfordScore)
        add("rockall", p.rockallScore)
        add("rcri", p.rcriScore)
        add("glasgow-imrie", p.glasgowPancreatitisScore)
        add("bisap", p.bisapScore)
        add("ranson", p.ransonScore)
        add("lrinec", p.lrinecScore)
        add("has-bled", p.hasBledScore)
        add("caprini", p.capriniScore)
        add("cfs", p.cfsScore)
        add("abcd2", p.abcd2Score)
        add("qsofa", p.qsofaScore)
        add("asa", p.asaClass ?? p.asaScore)
        return out
    }

    /// NEWS2 (when at least 4 of RR, SpO₂, SBP, HR and temperature are recorded) and qSOFA (RR and
    /// SBP recorded) from the latest vitals — the web computes the same from its vitals.
    static func recordScores(_ p: Patient) -> [TreatmentDecisions.Score] {
        guard let v = p.vitalsEntries.filter({ $0.hasAnyValue }).sorted(by: { $0.recordedAt > $1.recordedAt }).first else { return [] }
        var out: [TreatmentDecisions.Score] = []
        let recorded = [v.respiratoryRate != nil, v.spo2 != nil, v.bpSystolic != nil, v.heartRate != nil, v.temperatureCelsius != nil]
            .filter { $0 }.count
        if recorded >= 4 {
            out.append(TreatmentDecisions.Score(key: "news2", value: Double(v.news2Score), source: "record",
                                                redParameter: v.news2HasRedFlag ? true : nil))
        }
        if let rr = v.respiratoryRate, let sbp = v.bpSystolic {
            var q = QSOFAInput()
            q.alteredMentation = v.avpu != .alert
            q.rrOver22 = rr >= 22
            q.sbpUnder100 = sbp <= 100
            out.append(TreatmentDecisions.Score(key: "qsofa", value: ClinicalScoringEngine.qsofa(q).score, source: "record", redParameter: nil))
        }
        return out
    }

    // MARK: - Labs

    /// lipase, amylase (U/L), troponin (ng/L), lactate, potassium (mmol/L), haemoglobin (g/L).
    static func labs(_ p: Patient) -> [String: Double] {
        let panel = LabPanel.parse(from: p.investigations)
        var out: [String: Double] = [:]
        if let v = panel.lipase?.value { out["lipase"] = v }
        if let v = panel.amylase?.value { out["amylase"] = v }
        if let v = panel.troponin?.value { out["troponin"] = v }
        if let v = panel.lactate?.value { out["lactate"] = v }
        if let v = panel.potassium?.value { out["potassium"] = v }
        // LabPanel holds g/dL (a value above 25 is already g/L); the content uses g/L.
        if let v = panel.haemoglobin?.value { out["haemoglobin"] = v <= 25 ? TreatmentDecisions.jsRound(v * 100) / 10 : v }
        return out
    }

    // MARK: - Diagnoses

    /// The working diagnosis (confirmed by the clinician on the Diagnosis tab), then the Bayesian
    /// differential (displayed probability / 100).
    static func diagnoses(_ p: Patient, bayes: [BayesianDiagnosisEngine.DiagnosisResult]) -> [TreatmentDecisions.Diagnosis] {
        var out: [TreatmentDecisions.Diagnosis] = []
        let wd = (p.workingDiagnosis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !wd.isEmpty {
            let match = bayes.first(where: { $0.name == wd })
            out.append(TreatmentDecisions.Diagnosis(name: wd, id: nil, icd10: p.workingDiagnosisICD,
                                                    probability: match.map { Double($0.probability) / 100 }, confirmed: true))
        }
        for r in bayes {
            out.append(TreatmentDecisions.Diagnosis(name: r.name, id: nil, icd10: r.icdCode,
                                                    probability: Double(r.probability) / 100, confirmed: false))
        }
        return out
    }

    // MARK: - Patient factors

    static let diabetesPattern = #"\b(diabet\w*|t1dm|t2dm|iddm|niddm)\b"#
    static let immunoPattern = #"\b(transplant\w*|hiv|aids|chemotherapy|neutropeni\w*|immunosuppress\w*|immunocompromis\w*)\b"#
    static let mechanicalValvePattern = #"\bmechanical\s+(?:heart\s+|mitral\s+|aortic\s+)?valve|\bmechanical\s+(?:mvr|avr)\b|\bmetallic valve"#
    static let recentVtePattern = #"\b(?:recent|last (?:month|week))\b[^.;]{0,30}\b(?:dvt|pe|pulmonary embol\w*|vte|venous thrombo\w*)\b|\b(?:dvt|pe|pulmonary embol\w*|vte|deep vein thrombosis)\b[^.;]{0,30}\b(?:\d{1,2}\s*(?:days?|weeks?)|[12]\s*months?)\s+ago\b"#
    static let appendicolithPattern = #"\b(appendicolith|faecolith|fecalith)\b"#

    static func decisionPatient(_ p: Patient) -> TreatmentDecisions.DecisionPatient {
        let ctx = RadiationContext(patient: p)
        let s = PlanSafetyFilter.signals(ctx)
        let meds = PlanSafetyFilter.norm(p.prescriptions.map { $0.drug }.joined(separator: " ; "))
        let history = NegationMatcher.joinClauses(p.pmhEntries.map { Optional($0.condition) }
            + [p.pmhNotes, p.surgicalHistory, p.hpi, p.socialHistory])
        let reports = NegationMatcher.joinClauses(p.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { Optional($0.result) })
        let latest = p.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first

        var d = TreatmentDecisions.emptyPatient()
        d.ageYears = p.dateOfBirth == nil ? nil : Double(p.ageYears)
        d.sex = p.sex == .male ? "male" : (p.sex == .female ? "female" : "unknown")
        d.egfr = p.ckdEpiEgfr ?? ctx.egfr
        d.bmi = p.latestBMI()
        d.sbp = latest?.bpSystolic.map { Double($0) }
        let vka = !PlanSafetyFilter.drugsPresent(meds, PlanSafetyFilter.vka).isEmpty
        let doac = !PlanSafetyFilter.drugsPresent(meds, PlanSafetyFilter.doacs).isEmpty
        d.anticoagulant = vka ? "vka" : (doac ? "doac" : "none")
        d.antiplatelet = !PlanSafetyFilter.drugsPresent(meds, PlanSafetyFilter.p2y12 + PlanSafetyFilter.aspirin).isEmpty
        switch s.pregnancy {
        case .pregnant: d.pregnancy = "pregnant"
        case .notPregnant, .postpartum: d.pregnancy = "not-pregnant"
        case .unknown: d.pregnancy = "unknown"
        }
        d.allergyClasses = s.allergy.classes.map { $0.id }
        let diabetesDrugs = PlanSafetyFilter.insulins + PlanSafetyFilter.sglt2 + PlanSafetyFilter.sulfonylureas + ["metformin"]
        d.diabetes = NegationMatcher.testAffirmed(diabetesPattern, history)
            || !PlanSafetyFilter.drugsPresent(meds, diabetesDrugs).isEmpty
        let immunoDrugs = PlanSafetyFilter.immunosuppressants + PlanSafetyFilter.steroids.filter { $0 != "fludrocortisone" }
        d.immunosuppressed = !PlanSafetyFilter.drugsPresent(meds, immunoDrugs).isEmpty
            || NegationMatcher.testAffirmed(immunoPattern, history)
        d.recentSurgeryDays = p.postOpDays.map { Double($0) }
        d.procedurePlanned = PlanSafetyFilter.procedure(s, operative: false) != .none
        d.appendicolith = NegationMatcher.testAffirmed(appendicolithPattern, reports)
        d.mechanicalValve = NegationMatcher.testAffirmed(mechanicalValvePattern, history)
        d.recentVte3m = NegationMatcher.testAffirmed(recentVtePattern, history)
        return d
    }

    // MARK: - Input, filter, result

    /// `extraScores` go first (a calculator result not yet saved on the patient wins).
    static func input(for p: Patient, bayes: [BayesianDiagnosisEngine.DiagnosisResult],
                      extraScores: [TreatmentDecisions.Score] = []) -> TreatmentDecisions.Input {
        TreatmentDecisions.Input(patient: decisionPatient(p), diagnoses: diagnoses(p, bayes: bayes),
                                 scores: extraScores + storedScores(p) + recordScores(p), labs: labs(p), uln: nil)
    }

    /// PlanSafetyFilter.adaptLine — the final hard filter on every line decision support shows.
    static func lineFilter(for p: Patient) -> TreatmentDecisions.LineFilter {
        let s = PlanSafetyFilter.signals(RadiationContext(patient: p))
        return { line in
            let r = PlanSafetyFilter.adaptLine(line, s)
            return (text: r.text, withheld: r.withheld != nil)
        }
    }

    static func support(for p: Patient, bayes: [BayesianDiagnosisEngine.DiagnosisResult],
                        extraScores: [TreatmentDecisions.Score] = []) -> TreatmentDecisions.Result? {
        BayesianDecisionEngine.treatmentDecisionSupport(input(for: p, bayes: bayes, extraScores: extraScores),
                                                        filter: lineFilter(for: p))
    }

    // MARK: - Results → posterior

    struct Shift: Identifiable {
        let id = UUID()
        let name: String
        let before: Double
        let after: Double
        /// Results in order of how much each moved this diagnosis (leave-one-out).
        let movedBy: [(result: String, delta: Double)]

        /// "P(Acute pancreatitis) 22% → 81% — moved most by Lipase: 1450 U/L".
        var text: String {
            let by = movedBy.first.map { " — moved most by \($0.result)" } ?? ""
            return "P(\(name)) \(TreatmentDecisions.formatPercent(before)) → \(TreatmentDecisions.formatPercent(after))\(by)"
        }
    }

    /// ConsultationView+DiagnosisTab.refreshBayesian with the given investigations.
    static func differential(_ p: Patient, investigations invs: [InvestigationEntry],
                             socratesSelections: [String: Set<String>], specialtyHint: String?) -> [BayesianDiagnosisEngine.DiagnosisResult] {
        let invResultsText = invs
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)" }
            .joined(separator: ". ")
        let examOtherText = NegationMatcher.joinClauses([p.examCVS, p.examResp, p.examNeuro, p.examMSK, p.examSkin, p.examOther])
        let parsed = ClinicalTextParser.parse(
            hpi: p.hpi,
            examGeneral: p.examGeneral,
            examAbdo: p.examAbdo,
            examOther: examOtherText.isEmpty ? nil : examOtherText,
            notes: invResultsText.isEmpty ? nil : invResultsText
        )
        var augmented = socratesSelections
        for (dim, chips) in parsed.featureAugments {
            augmented[dim, default: []].formUnion(chips)
        }
        let latestVitals = p.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
        return BayesianDiagnosisEngine.infer(
            chiefComplaint: p.chiefComplaint,
            socratesSelections: augmented,
            pmhNotes: p.pmhNotes,
            surgicalHistory: p.surgicalHistory,
            examAbdo: p.examAbdo,
            examGeneral: p.examGeneral,
            examCVS: p.examCVS,
            examResp: p.examResp,
            examNeuro: p.examNeuro,
            examMSK: p.examMSK,
            examSkin: p.examSkin,
            examOther: p.examOther,
            investigations: invs,
            ageYears: p.ageYears,
            sex: p.sex,
            longitudinal: p.longitudinalContext,
            latestHR: latestVitals?.heartRate,
            latestSBP: latestVitals?.bpSystolic,
            latestTemp: latestVitals?.temperatureCelsius,
            latestSpO2: latestVitals?.spo2,
            latestRR: latestVitals?.respiratoryRate,
            news2Score: latestVitals.flatMap { $0.hasAnyValue ? $0.news2Score : nil },
            specialtyHint: specialtyHint,
            hpi: p.hpi
        )
    }

    /// How the resulted investigations moved the leading diagnoses: the differential with and
    /// without them, and leave-one-out per result (at most 6) for the result that moved it most.
    static func posteriorShifts(for p: Patient, socratesSelections: [String: Set<String>], specialtyHint: String?,
                                top: Int = 3, minDelta: Double = 0.02) -> [Shift] {
        let all = p.investigations
        let resulted = all.filter { $0.status == .resulted && !$0.result.isEmpty }
        if resulted.isEmpty { return [] }
        let after = differential(p, investigations: all, socratesSelections: socratesSelections, specialtyHint: specialtyHint)
        let without = all.filter { !($0.status == .resulted && !$0.result.isEmpty) }
        let before = differential(p, investigations: without, socratesSelections: socratesSelections, specialtyHint: specialtyHint)
        func prob(_ list: [BayesianDiagnosisEngine.DiagnosisResult], _ name: String) -> Double {
            Double(list.first(where: { $0.name == name })?.probability ?? 0) / 100
        }
        var names: [String] = []
        for r in Array(after.prefix(top)) + Array(before.prefix(top)) where !names.contains(r.name) {
            names.append(r.name)
        }
        let leaveOneOut: [(label: String, list: [BayesianDiagnosisEngine.DiagnosisResult])] = resulted.prefix(6).map { r in
            (label: "\(r.name): \(r.result)",
             list: differential(p, investigations: all.filter { $0.id != r.id }, socratesSelections: socratesSelections, specialtyHint: specialtyHint))
        }
        var out: [Shift] = []
        for n in names {
            let a = prob(after, n)
            let b = prob(before, n)
            if abs(a - b) < minDelta { continue }
            let moved: [(result: String, delta: Double)] = leaveOneOut
                .map { entry in (result: entry.label, delta: a - prob(entry.list, n)) }
                .filter { abs($0.delta) >= 0.005 }
                .sorted { abs($0.delta) > abs($1.delta) }
            out.append(Shift(name: n, before: b, after: a, movedBy: moved))
        }
        return out.sorted { abs($0.after - $0.before) > abs($1.after - $1.before) }
    }
}

/// Loose link to the diagnostic-reasoning panel's best next discriminating test (information gain),
/// owned elsewhere: it may set a provider; decision support then shows its test in the "Test further"
/// band. No provider → the decision's own guideline test. No hard dependency either way.
enum DecisionSupportLinks {
    @MainActor static var bestNextTest: ((String) -> String?)? = nil
}
