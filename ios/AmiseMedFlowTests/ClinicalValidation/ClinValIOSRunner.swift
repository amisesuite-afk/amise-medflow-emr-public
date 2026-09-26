// ClinValIOSRunner.swift
// Clinical validation harness — runs one vignette through the iOS consultation engines.
//
// It builds an in-memory Patient from the vignette and calls the SAME functions ConsultationView
// calls, with the same arguments, in the same order. SwiftUI @State cannot be driven outside a
// view hierarchy, so the view's call sites are mirrored here (file references below). If a call
// site changes, update the mirror in the same PR. Nothing here changes an engine, and AIService is
// never used.
//
//   1. First door        ConsultationView.handleAppear: ConsultPathway.from(visitType) ?? recommend(for:);
//                        RiskSnapshotCard: VisitRiskAssessment.assess(_:pathway:); allergy banner
//   2. Chief complaint   ConsultationView.handleChiefComplaintChange: early BayesianDiagnosisEngine.infer
//                        (CC + PMH/PSHx only, prefix 4); ConsultationView+Sheets.runPathway:
//                        ClinicalAcuityEngine.assess (acuity raised, never lowered); run again after
//                        the diagnosis is confirmed (step 5b) — that level is the graded one
//   3. HPI / exam / Ix   ConsultationView+DiagnosisTab.refreshBayesian: ClinicalTextParser.parse →
//                        feature augments → BayesianDiagnosisEngine.infer (top 5) + clinical alarms
//   4. Pipeline          ClinicalPipelineOrchestrator.runNow (Diagnosis tab: Clinical Actions prefix 6,
//                        EVPI prefix 5; decisions feed the actions)
//   5. Diagnosis tab     clinician confirms the diagnosis (vignette confirmedDiagnosis)
//                        SuspectedCancerSection: SuspectedCancerScreening.prompt(for:) (NG12 card, step 5c)
//   6. Plan tab          DiagnosisRadiationEngine.radiate (investigations, plan template, referrals)
//   7. Scores            DiagnosisScoreMapper.recommendations; ClinicalScoresView.autoPopulate
//                        (PatientScoreAutoPopulator.* inside ScoreAutoPopulateContext) = "autofill";
//                        ClinicalScoringEngine on the clinician-completed form = "calculator"
//   8. Draft plan        ConsultationView+Sheets.draftPlan: SOAPDraftEngine.draft(patient:)
//   9. Decision support  ConsultationView+PlanTab DecisionSupportSection: DecisionSupportPatient.support
//                        (BayesianDecisionEngine+Treatment.swift) → ios.decisions / ios.decisions.shift

import Foundation
import SwiftData
@testable import AmiseMedFlow

@MainActor
enum ClinValIOSRunner {

    // MARK: - Canonical score keys

    /// `ActiveScore` case name → canonical key (docs/clinical-validation/README.md).
    static let scoreKeyByCase: [String: String] = [
        "alvarado": "alvarado", "airScore": "air", "ripasa": "ripasa", "pas": "pas",
        "tokyoChole": "tg18-cholecystitis", "tokyoCholang": "tg18-cholangitis",
        "qsofa": "qsofa", "sirs": "sirs", "sofa": "sofa", "news2": "news2", "mews": "mews",
        "bisap": "bisap", "ranson": "ranson", "glasgow": "glasgow-imrie", "glasgowImrie": "glasgow-imrie",
        "blatchford": "glasgow-blatchford", "rockall": "rockall", "aims65": "aims65", "hinchey": "hinchey",
        "asa": "asa", "rcri": "rcri", "caprini": "caprini", "lrinec": "lrinec", "wellsDVT": "wells-dvt",
        "wellsPE": "wells-pe", "curb65": "curb65", "cfs": "cfs", "childPugh": "child-pugh", "meld": "meld",
        "must": "must", "spesi": "spesi", "heart": "heart", "timi": "timi", "grace": "grace",
        "cha2ds2vasc": "cha2ds2-vasc", "hasBled": "has-bled", "stopBang": "stop-bang", "gcs": "gcs",
        "shockIndex": "shock-index", "cci": "cci", "ckdEpi": "ckd-epi", "kdigo": "kdigo", "stone": "stone",
        "dasi": "dasi",
    ]

    static func canonicalScore(_ score: ActiveScore) -> String {
        let name = String(describing: score)
        return scoreKeyByCase[name] ?? "ios:\(name)"
    }

    static func levelName(_ a: Acuity) -> String {
        switch a {
        case .emergency: return "emergency"
        case .urgent:    return "urgent"
        case .priority:  return "priority"
        case .routine:   return "routine"
        }
    }

    // MARK: - Patient from vignette

    static func buildPatient(_ v: ClinValVignette, in context: ModelContext, now: Date) -> Patient {
        let inp = v.inputs
        let sex: Sex = inp.patient.sex == "male" ? .male : inp.patient.sex == "female" ? .female : .unspecified
        let setting: ClinicalSetting
        switch inp.encounter.setting {
        case "inpatient": setting = .inpatient
        case "emergency": setting = .emergency
        case "theatre":   setting = .theatre
        case "endoscopy": setting = .endoscopy
        default:          setting = .outpatient
        }
        let acuity: Acuity
        switch inp.encounter.acuity ?? "routine" {
        case "emergency": acuity = .emergency
        case "urgent":    acuity = .urgent
        case "priority":  acuity = .priority
        default:          acuity = .routine
        }

        let p = Patient(fullName: "ClinVal \(v.id)", sex: sex, setting: setting, location: .rodney_bay, acuity: acuity)
        context.insert(p)
        // Age exactly ageYears (birthday 30 days ago).
        let cal = Calendar.current
        if let years = cal.date(byAdding: .year, value: -inp.patient.ageYears, to: now) {
            p.dateOfBirth = cal.date(byAdding: .day, value: -30, to: years)
        }
        p.heightCm = inp.patient.heightCm
        if let vt = inp.encounter.visitType {
            p.visitType = VisitType.allCases.first { String(describing: $0) == vt }
        }
        p.encounterStatus = .waiting
        p.chiefComplaint = inp.chiefComplaint
        p.hpi = inp.hpi
        p.examGeneral = inp.exam?.general
        p.examAbdo = inp.exam?.abdomen
        p.examCVS = inp.exam?.cardiovascular
        p.examResp = inp.exam?.respiratory
        p.examNeuro = inp.exam?.neuro
        p.examMSK = inp.exam?.msk
        p.examSkin = inp.exam?.skin
        // Exam-step sign chips are "[sign]" lines in Other / additional findings (ExamSignRecord).
        p.examOther = ExamSignRecord.merged(text: inp.exam?.other, states: inp.examSigns ?? [:])

        let comorbidities = inp.comorbidities ?? []
        p.pmhEntries = comorbidities.map { PMHEntry(condition: $0) }
        p.pmhNotes = comorbidities.isEmpty ? nil : "CONDITIONS: " + comorbidities.joined(separator: ", ")
        let pshx = inp.surgicalHistory ?? []
        p.pshxEntries = pshx.map { PSHxEntry(procedure: $0) }
        p.surgicalHistory = pshx.isEmpty ? nil : pshx.joined(separator: ", ")
        p.socialHistory = inp.socialHistory

        var allergies = (inp.allergies ?? []).map {
            AllergyEntry(name: $0.name, severity: $0.severity, reaction: $0.reaction ?? "")
        }
        if allergies.isEmpty, inp.nkda == true { allergies = [Patient.nkdaMarkerEntry()] }
        p.allergies = allergies

        for m in inp.medications ?? [] {
            let rx = Prescription(drug: m.drug, dose: m.dose ?? "", frequency: m.frequency ?? "",
                                  indication: m.indication ?? "")
            // Current medicines were prescribed before this visit (what's missing reads today's
            // prescriptions as the ones planned now).
            rx.prescribedAt = now.addingTimeInterval(-30 * 86_400)
            context.insert(rx)
            if !p.prescriptions.contains(where: { $0.id == rx.id }) { p.prescriptions.append(rx) }
        }
        // Planned in this visit (vignette orders): prescribed today.
        for drug in inp.orders?.prescriptions ?? [] {
            let rx = Prescription(drug: drug)
            rx.prescribedAt = now
            context.insert(rx)
            if !p.prescriptions.contains(where: { $0.id == rx.id }) { p.prescriptions.append(rx) }
        }
        if let status = inp.supplements, let s = SupplementStatus(rawValue: status) {
            var h = p.supplementHistory
            h.status = s
            p.supplementHistory = h
        }

        let vitalsInputs = inp.vitals ?? []
        let latestIndex = vitalsInputs.indices.min { (vitalsInputs[$0].minutesAgo ?? 0) < (vitalsInputs[$1].minutesAgo ?? 0) }
        for (i, vi) in vitalsInputs.enumerated() {
            let entry = VitalsEntry(patient: p, recordedAt: now.addingTimeInterval(-Double((vi.minutesAgo ?? 0) * 60)))
            entry.heartRate = vi.heartRate
            entry.bpSystolic = vi.systolicBp
            entry.bpDiastolic = vi.diastolicBp
            entry.respiratoryRate = vi.respiratoryRate
            entry.temperatureCelsius = vi.temperatureC
            entry.spo2 = vi.spo2
            entry.glucoseMmol = vi.glucoseMmol
            entry.weightKg = vi.weightKg ?? (i == latestIndex ? inp.patient.weightKg : nil)
            if let a = vi.avpu, let avpu = AVPU(rawValue: a) { entry.avpu = avpu }
            entry.onSupplementalO2 = vi.onSupplementalO2 ?? false
            context.insert(entry)
            if !p.vitalsEntries.contains(where: { $0.id == entry.id }) { p.vitalsEntries.append(entry) }
        }

        var investigations: [InvestigationEntry] = []
        for l in inp.labs ?? [] {
            let at = now.addingTimeInterval(-Double((l.minutesAgo ?? 0) * 60))
            var e = InvestigationEntry(name: l.name, category: l.analyte == "urinalysis" ? .other : .blood, status: .resulted)
            if let text = l.resultText {
                e.result = text
            } else if let value = l.value {
                let number = value.rounded() == value ? String(Int(value)) : String(value)
                e.result = [number, l.unit ?? ""].filter { !$0.isEmpty }.joined(separator: " ")
            }
            e.orderedAt = at
            e.resultedAt = at
            investigations.append(e)
        }
        for im in inp.imaging ?? [] {
            let at = now.addingTimeInterval(-Double((im.minutesAgo ?? 0) * 60))
            var e = InvestigationEntry(name: im.name, category: im.modality == "Endoscopy" ? .endoscopy : .imaging,
                                       status: .resulted)
            e.result = im.result
            e.orderedAt = at
            e.resultedAt = at
            investigations.append(e)
        }
        // Planned in this visit (vignette orders): suggested, not resulted.
        for name in inp.orders?.investigations ?? [] {
            let lower = name.lowercased()
            let imaging = ["ct ", "ctpa", "mri", "x-ray", "ultrasound", "uss", "scan"].contains { lower.contains($0) } || lower.hasPrefix("ct")
            investigations.append(InvestigationEntry(name: name, category: imaging ? .imaging : .blood, status: .suggested))
        }
        p.investigations = investigations
        try? context.save()
        return p
    }

    // MARK: - Run

    static func run(_ v: ClinValVignette, context: ModelContext) async -> ClinValOutputs {
        var out = ClinValOutputs()
        let now = Date()
        let p = buildPatient(v, in: context, now: now)
        let hint = v.inputs.platform?.ios?.specialtyHint

        // Engine mode: the differential only uses DiagnosticDatabase.json when it decodes.
        let db = DiagnosticDatabaseInfo.current
        out.engineInfo["bayesDatabase"] = BayesianDiagnosisEngine.externalDatabase == nil ? "fallback" : "database"
        out.engineInfo["decisionEngineDatabase"] = BayesianDecisionEngine.externalDatabase == nil ? "fallback" : "database"
        out.engineInfo["databaseVersion"] = db.versionText
        out.engineInfo["databaseEngineText"] = db.engineText
        if let error = db.engineError { out.engineInfo["databaseError"] = error }

        // 1. First door: pathway recommendation, risk snapshot, allergy banner.
        let recommendation = ConsultPathway.recommend(for: p)
        out.pathway = ClinValPathway(value: recommendation.pathway.rawValue, reasons: recommendation.reasons)
        let pathway = ConsultPathway.from(p.visitType) ?? recommendation.pathway
        out.notes.append("Effective consultation pathway: \(pathway.rawValue)")
        for f in VisitRiskAssessment.assess(p, pathway: pathway) {
            out.redFlags.append(.init(source: "ios.visitRisk", text: "\(f.level.label): \(f.title) — \(f.detail)"))
        }
        for a in p.allergies {
            out.redFlags.append(.init(source: "ios.allergyBanner", text: "ALLERGY ALERT: \(a.name) [\(a.severity)] — \(a.reaction)"))
        }

        let socrates: [String: Set<String>] = (v.inputs.platform?.ios?.socratesSelections ?? v.inputs.socrates ?? [:])
            .reduce(into: [:]) { acc, kv in if !kv.value.isEmpty { acc[kv.key] = Set(kv.value) } }

        // 2. Chief complaint: early differential and CC triage.
        if let cc = p.chiefComplaint, !cc.isEmpty {
            let pmhNotes = p.pmhEntries.map(\.condition).joined(separator: ", ")
            let pshxNotes = p.pshxEntries.map(\.procedure).joined(separator: ", ")
            let early = BayesianDiagnosisEngine.infer(
                chiefComplaint: cc,
                socratesSelections: [:],
                pmhNotes: pmhNotes,
                surgicalHistory: pshxNotes,
                examAbdo: nil,
                examGeneral: nil,
                investigations: [],
                ageYears: p.ageYears,
                sex: p.sex,
                specialtyHint: hint
            )
            out.differentials["ios.ccEarly"] = dxItems(Array(early.prefix(4)))
        }
        // ConsultationView+Sheets.runPathway (CC debounce): ClinicalAcuityEngine, which raises the
        // recorded acuity and never lowers it. The level graded below is the one after the
        // diagnosis is confirmed (step 5b), when the view runs runPathway again.
        let earlyTriage = ClinicalAcuityEngine.assess(patient: p).triageResult
        if earlyTriage.suggestedAcuity < p.acuity { p.acuity = earlyTriage.suggestedAcuity }

        // 3. refreshBayesian (ConsultationView+DiagnosisTab).
        let invResultsText = p.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)" }
            .joined(separator: ". ")
        // One clause per field: a negation in one exam field must not reach the next.
        let examOtherText = NegationMatcher.joinClauses([p.examCVS, p.examResp, p.examNeuro, p.examMSK, p.examSkin, p.examOther])
        let parsed = ClinicalTextParser.parse(
            hpi: p.hpi,
            examGeneral: p.examGeneral,
            examAbdo: p.examAbdo,
            examOther: examOtherText.isEmpty ? nil : examOtherText,
            notes: invResultsText.isEmpty ? nil : invResultsText
        )
        var augmented = socrates
        for (dim, chips) in parsed.featureAugments {
            augmented[dim, default: []].formUnion(chips)
        }
        if (p.chiefComplaint ?? "").isEmpty, let ccHint = parsed.ccHint {
            p.chiefComplaint = ccHint
            out.notes.append("CC was empty: text parser set it to '\(ccHint)'")
        }
        let latestVitals = p.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
        let bayes = BayesianDiagnosisEngine.infer(
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
            investigations: p.investigations,
            ageYears: p.ageYears,
            sex: p.sex,
            longitudinal: p.longitudinalContext,
            latestHR: latestVitals?.heartRate,
            latestSBP: latestVitals?.bpSystolic,
            latestTemp: latestVitals?.temperatureCelsius,
            latestSpO2: latestVitals?.spo2,
            latestRR: latestVitals?.respiratoryRate,
            news2Score: latestVitals.flatMap { $0.hasAnyValue ? $0.news2Score : nil },
            specialtyHint: hint,
            hpi: p.hpi
        )
        out.differentials["ios.bayes"] = dxItems(bayes)
        if let top = bayes.first {
            out.notes.append("Bayes top: \(top.name) — displayed \(top.probability)%, confidence \(top.confidence.label), logGap \(top.logGap)")
        } else {
            out.notes.append("Bayes differential empty (CC route has no candidates in \(out.engineInfo["bayesDatabase"] ?? "?") mode)")
        }
        let augmentSummary = parsed.featureAugments.keys.sorted()
            .map { "\($0)=\(parsed.featureAugments[$0]!.sorted().joined(separator: "/"))" }
            .joined(separator: "; ")
        out.notes.append("Text-parser feature augments: \(augmentSummary.isEmpty ? "(none)" : augmentSummary)")
        for a in parsed.clinicalAlarms {
            out.alarms.append(ClinValAlarm(source: "ios.textParser", title: a.title,
                                           detail: "\(a.detail) Action: \(a.action)", severity: alarmSeverity(a.severity)))
        }

        // 4. Clinical pipeline (Diagnosis tab panels).
        let pipeline = ClinicalPipelineOrchestrator()
        pipeline.runNow(for: p, socratesSelections: socrates)
        var waited = 0
        while pipeline.stateVector == nil && waited < 1000 {
            try? await Task.sleep(nanoseconds: 10_000_000)
            waited += 1
        }
        if pipeline.stateVector == nil { out.notes.append("Clinical pipeline did not finish within 10 s") }
        out.differentials["ios.pipeline"] = pipeline.hypotheses.prefix(5).enumerated().map {
            ClinValDxItem(rank: $0.offset + 1, name: $0.element.name, id: nil, icd10: $0.element.icdCode,
                          score: ($0.element.probability * 1000).rounded() / 1000)
        }
        for d in pipeline.decisions {
            out.management.append(.init(source: "ios.pipeline.decisions",
                                        text: "\(d.priority.label): \(d.title) — \(d.actions.joined(separator: "; "))"))
            for inv in d.investigations {
                out.investigations.append(.init(source: "ios.pipeline.decisions", text: inv))
            }
        }
        for item in pipeline.informationItems.prefix(5) {
            out.investigations.append(.init(source: "ios.pipeline.voi", text: "\(item.name)\(item.clinicalNote.map { " — \($0)" } ?? "")"))
        }
        for action in pipeline.filteredAutoActions(for: p.visitType).prefix(6) {
            let text = "\(action.title) — \(action.detail)"
            switch action.function {
            case .alert:
                out.alarms.append(ClinValAlarm(source: "ios.pipeline.alert", title: action.title, detail: action.detail,
                                               severity: String(describing: action.urgency)))
            case .order:
                out.investigations.append(.init(source: "ios.pipeline.actions", text: text))
            default:
                out.management.append(.init(source: "ios.pipeline.actions", text: text))
            }
        }

        // 5. Diagnosis tab: the clinician confirms the working diagnosis.
        if let dx = v.inputs.confirmedDiagnosis {
            p.workingDiagnosis = dx.name
            p.workingDiagnosisICD = dx.icd10
            p.assessmentText = dx.assessmentText
        }

        // 5a. Diagnosis tab "Diagnostic reasoning" card (DiagnosticReasoningAdapter) over the same
        // differential and the confirmed working diagnosis; same line formats as web.reasoning.
        let reasoning = DiagnosticReasoningAdapter.report(results: bayes, patient: p, now: now)
        out.reasoning = DiagnosticReasoningAdapter.harnessLines(reasoning, prefix: "ios.reasoning")
            .map { ClinValSourcedText(source: $0.source, text: $0.text) }

        // 5b. ConsultationView.onChange(workingDiagnosis) → runPathway: the triage level is the
        // highest of CC keywords, vitals/NEWS2, BP, labs, ECG, text alarms, recognition rules and
        // the confirmed diagnosis (ClinicalAcuityEngine). The triage card shows its red flags and alerts.
        let acuity = ClinicalAcuityEngine.assess(patient: p)
        let triage = acuity.triageResult
        out.emergencyLevel = ClinValLevel(
            level: levelName(triage.suggestedAcuity),
            raw: "ClinicalAcuityEngine level=\(triage.suggestedAcuity.label); pathway=\(triage.pathway); "
                + "because: \(triage.levelReasons.prefix(4).joined(separator: " | "))",
            source: "ios.triage")
        for f in triage.redFlags { out.redFlags.append(.init(source: "ios.triage", text: f)) }
        for a in triage.alerts {
            out.alarms.append(ClinValAlarm(source: "ios.acuity", title: a.title, detail: a.summary,
                                           severity: a.level.map { levelName($0) } ?? "info"))
        }
        out.differentials["ios.triage"] = triage.differentials.enumerated().map {
            ClinValDxItem(rank: $0.offset + 1, name: $0.element.name, id: nil, icd10: nil, score: Double($0.element.probability))
        }
        if triage.suggestedAcuity < p.acuity { p.acuity = triage.suggestedAcuity }

        // 5c. Diagnosis tab: NICE NG12 suspected-cancer card (SuspectedCancerSection, top of the list).
        if let cancer = SuspectedCancerScreening.prompt(for: p) {
            out.redFlags.append(.init(source: "ios.ng12", text: "\(cancer.title) — \(cancer.finding). \(cancer.rationale)"))
            for inv in cancer.investigations { out.investigations.append(.init(source: "ios.ng12", text: inv)) }
            for line in cancer.planLines { out.management.append(.init(source: "ios.ng12.plan", text: line)) }
        }

        // 6. Plan tab: diagnosis radiation.
        // ConsultationView+PlanTab.radiationResult: the card with the patient safety filter.
        if let r = DiagnosisRadiationEngine.radiate(for: p) {
            out.notes.append("Radiation entry: \(r.conditionName)")
            for inv in r.investigations {
                out.investigations.append(.init(source: "ios.radiation", text: "\(inv.name) — \(inv.rationale)"))
            }
            for line in r.planTemplate.split(separator: "\n") {
                let text = line.trimmingCharacters(in: .whitespaces)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "-• ")).trimmingCharacters(in: .whitespaces)
                if !text.isEmpty { out.management.append(.init(source: "ios.radiation.plan", text: text)) }
            }
            for ref in r.referralSuggestions {
                out.management.append(.init(source: "ios.radiation.referral",
                                            text: "\(ref.specialty) (\(ref.urgency.rawValue)): \(ref.reason)\(ref.notes.map { " — \($0)" } ?? "")"))
            }
            if !r.followUp.isEmpty { out.management.append(.init(source: "ios.radiation.followUp", text: r.followUp)) }
            for f in r.redFlags { out.redFlags.append(.init(source: "ios.radiation.redFlags", text: f)) }
            if let u = r.urgencyNote { out.redFlags.append(.init(source: "ios.radiation.urgencyNote", text: u)) }
        } else {
            out.notes.append("No radiation entry for '\(p.workingDiagnosis ?? "")'")
        }

        // 7. Scores: recommendations, auto-fill and calculators.
        for rec in DiagnosisScoreMapper.recommendations(for: p) {
            out.recommendedScores.append(.init(source: "ios.scoreMapper", score: canonicalScore(rec.score),
                                               raw: "\(rec.score.rawValue) — \(rec.rationale)"))
        }
        if let cat = DiagnosisScoreMapper.suggestedCategory(for: p.chiefComplaint) {
            out.notes.append("Scores screen category from CC: \(cat.rawValue)")
        }
        autofillScores(p, into: &out)
        calculatorScores(v, into: &out)

        // 8. Draft plan (SOAP).
        let soap = SOAPDraftEngine.draft(patient: p)
        for line in soap.p.split(separator: "\n") {
            let text = line.trimmingCharacters(in: .whitespaces)
            if !text.isEmpty { out.management.append(.init(source: "ios.soap.plan", text: text)) }
        }

        // 9. Plan tab: DecisionSupportSection (BayesianDecisionEngine+Treatment.swift).
        decisionSupport(v, p, bayes: bayes, socrates: socrates, hint: hint, into: &out)

        // 10. What's missing (ConsultationView → WhatsMissingRow): same differential, the recommended
        // scores plus the calculator scores the vignette records.
        var missingScores = out.recommendedScores.map { $0.score }
        for key in (v.inputs.scoreForms ?? [:]).keys.sorted() where !missingScores.contains(key) { missingScores.append(key) }
        if let r = WhatsMissingPatient.result(for: p, bayes: bayes, activeScores: missingScores, now: now) {
            out.missing = WhatsMissing.lines(r).map { .init(source: "ios.missing", text: $0) }
        }
        return out
    }

    /// DecisionSupportSection: the calculator results the clinician saved (here the vignette's
    /// calculator forms, and a `total` for scores recorded as a number), the record, the working
    /// diagnosis and the Bayesian differential → ios.decisions (summary lines), ios.decisions.notForPatient
    /// (red flags), ios.decisions.shift (result → differential), missing inputs in the notes.
    static func decisionSupport(_ v: ClinValVignette, _ p: Patient, bayes: [BayesianDiagnosisEngine.DiagnosisResult],
                                socrates: [String: Set<String>], hint: String?, into out: inout ClinValOutputs) {
        var extra: [TreatmentDecisions.Score] = []
        for sv in out.scoreValues where sv.mode == "calculator" {
            if let value = sv.value, ["alvarado", "tg18-cholecystitis", "tg18-cholangitis"].contains(sv.score),
               !extra.contains(where: { $0.key == sv.score }), sv.score == "alvarado" || value >= 1 {
                extra.append(TreatmentDecisions.Score(key: sv.score, value: value, source: "calculator", redParameter: nil))
            }
        }
        let forms = v.inputs.scoreForms ?? [:]
        for key in forms.keys.sorted() {
            if let form = forms[key], case .number(let n)? = form.fields["total"] {
                extra.append(TreatmentDecisions.Score(key: key, value: n, source: "calculator", redParameter: nil))
            }
        }
        var input = DecisionSupportPatient.input(for: p, bayes: bayes, extraScores: extra)
        // The harness does not set an operation date; the web reads the encounter's post-op day.
        if input.patient.recentSurgeryDays == nil, let d = v.inputs.encounter.postOpDays {
            input.patient.recentSurgeryDays = Double(d)
        }
        guard let content = TreatmentDecisions.content else {
            out.notes.append("Decision support: TreatmentDecisions.json missing or not decoding")
            return
        }
        let r = TreatmentDecisions.decisionSupport(input, content, DecisionSupportPatient.lineFilter(for: p))
        for line in TreatmentDecisions.summaryLines(r) {
            switch line.kind {
            case "safety": out.redFlags.append(.init(source: "ios.decisions.notForPatient", text: line.text))
            case "info": out.notes.append(line.text)
            default: out.management.append(.init(source: "ios.decisions", text: line.text))
            }
        }
        out.notes.append("Decision support: \(r.decisions.map { $0.id }.joined(separator: ", ")); factors \(r.activeFactors.joined(separator: ", "))")
        for s in DecisionSupportPatient.posteriorShifts(for: p, socratesSelections: socrates, specialtyHint: hint) {
            out.management.append(.init(source: "ios.decisions.shift", text: "Posterior shift — \(s.text)"))
        }
    }

    // MARK: - Helpers

    static func dxItems(_ results: [BayesianDiagnosisEngine.DiagnosisResult]) -> [ClinValDxItem] {
        results.enumerated().map {
            ClinValDxItem(rank: $0.offset + 1, name: $0.element.name, id: nil,
                          icd10: $0.element.icdCode, score: Double($0.element.probability))
        }
    }

    static func alarmSeverity(_ s: ClinicalTextParser.ClinicalAlarm.AlarmSeverity) -> String {
        switch s {
        case .emergency: return "emergency"
        case .critical:  return "critical"
        case .warning:   return "warning"
        }
    }

    /// ClinicalScoresView.autoPopulate(for:) — what the form shows before the clinician edits it.
    static func autofillScores(_ p: Patient, into out: inout ClinValOutputs) {
        let scope = ScoreAutoPopulateContext.begin(for: p)
        defer { scope.end() }
        func add(_ key: String, _ score: ClinicalScore, _ fill: ScoreAutoFill) {
            out.scoreValues.append(ClinValScoreValue(score: key, mode: "autofill", source: "ios.autofill.\(key)",
                                                     value: score.score, label: score.interpretation,
                                                     pending: fill.pendingFields.map(\.label)))
        }
        let (alv, alvFill) = PatientScoreAutoPopulator.alvarado(patient: p)
        add("alvarado", ClinicalScoringEngine.alvarado(alv), alvFill)
        let (air, airFill) = PatientScoreAutoPopulator.airScore(patient: p)
        add("air", ClinicalScoringEngine.air(air), airFill)
        let (chole, choleFill) = PatientScoreAutoPopulator.tokyoCholecystitis(patient: p)
        add("tg18-cholecystitis", ClinicalScoringEngine.tokyoCholecystitis(chole), choleFill)
        let (cholang, cholangFill) = PatientScoreAutoPopulator.tokyoCholangitis(patient: p)
        add("tg18-cholangitis", ClinicalScoringEngine.tokyoCholangitis(cholang), cholangFill)
        let (qs, qsFill) = PatientScoreAutoPopulator.qsofa(patient: p)
        add("qsofa", ClinicalScoringEngine.qsofa(qs), qsFill)
        let (sirs, sirsFill) = PatientScoreAutoPopulator.sirs(patient: p)
        add("sirs", ClinicalScoringEngine.sirs(sirs), sirsFill)
    }

    /// ClinicalScoringEngine on the clinician-completed form (vignette scoreForms), mapped from the
    /// canonical field names to the iOS input structs.
    static func calculatorScores(_ v: ClinValVignette, into out: inout ClinValOutputs) {
        let forms = v.inputs.scoreForms ?? [:]
        func add(_ key: String, _ s: ClinicalScore) {
            out.scoreValues.append(ClinValScoreValue(score: key, mode: "calculator", source: "ios.scoreCalculator.\(key)",
                                                     value: s.score, label: s.interpretation, pending: nil))
            out.management.append(.init(source: "ios.scoreCalculator.\(key)", text: s.interpretation))
            for r in s.recommendations {
                out.management.append(.init(source: "ios.scoreCalculator.\(key)", text: r))
            }
            for f in s.redFlags {
                out.redFlags.append(.init(source: "ios.scoreCalculator.\(key)", text: f))
            }
        }
        for key in forms.keys.sorted() {
            guard let f = forms[key] else { continue }
            let organs = Set(f.strings("organDysfunction"))
            switch key {
            case "alvarado":
                var i = AlvaradoInput()
                i.migrationToRIF = f.bool("migration")
                i.anorexia = f.bool("anorexia")
                i.nauseaVomiting = f.bool("nauseaVomiting")
                i.tendernessRIF = f.bool("rifTenderness")
                i.reboundTenderness = f.bool("rebound")
                i.elevatedTemperature = f.bool("temperatureRaised")
                i.wbcElevated = f.bool("wbcAbove10")
                i.neutrophiliaShift = f.bool("neutrophilia")
                add(key, ClinicalScoringEngine.alvarado(i))
            case "air":
                var i = ClinicalScoringEngine.AIRInput()
                i.vomiting = f.bool("vomiting")
                i.painRIF = f.bool("rifPain")
                i.reboundTenderness = f.int("rebound")
                i.tempAbove38point5 = f.bool("tempAtLeast38_5")
                i.pmn = f.int("pmnBand")
                i.wbc = f.int("wbcBand")
                i.crp = f.int("crpBand")
                add(key, ClinicalScoringEngine.air(i))
            case "tg18-cholecystitis":
                var i = TokyoCholecystitisInput()
                // "Palpable tender RUQ mass" is a TG18 Grade II toggle on the iOS form; a mass is also
                // a local sign (Grade I diagnostic criterion).
                i.localInflammationSignsMild = f.bool("localSigns") || f.bool("palpableTenderRUQMass")
                i.palpableTenderRUQMass = f.bool("palpableTenderRUQMass")
                i.wbcAbove18 = f.bool("wbcAbove18")
                i.durationOver72h = f.bool("durationOver72h")
                i.markedLocalInflammation = f.bool("markedLocalInflammation")
                i.cardiovascularDysfunction = organs.contains("cardiovascular")
                i.neurologicalDysfunction = organs.contains("neurological")
                i.respiratoryDysfunction = organs.contains("respiratory")
                i.renalDysfunction = organs.contains("renal")
                i.hepaticDysfunction = organs.contains("hepatic")
                i.haematologicalDysfunction = organs.contains("haematological")
                add(key, ClinicalScoringEngine.tokyoCholecystitis(i))
            case "tg18-cholangitis":
                var i = TokyoCholangitisInput()
                i.wbcAbove12OrBelow4 = f.bool("wbcAbnormal")
                i.temperatureAbove39 = f.bool("feverAtLeast39")
                i.ageAbove75 = f.bool("ageAtLeast75")
                i.bilirubinAbove5 = f.bool("bilirubinAtLeast5mgdl")
                i.albuminBelow0_7xLLN = f.bool("albuminBelow07LLN")
                i.cardiovascularDysfunction = organs.contains("cardiovascular")
                i.neurologicalDysfunction = organs.contains("neurological")
                i.respiratoryDysfunction = organs.contains("respiratory")
                i.renalDysfunction = organs.contains("renal")
                i.hepaticDysfunction = organs.contains("hepatic")
                i.haematologicalDysfunction = organs.contains("haematological")
                i.cholangitisConfirmed = f.bool("systemicInflammation") && (f.bool("cholestasis") || f.bool("imaging"))
                add(key, ClinicalScoringEngine.tokyoCholangitis(i))
            case "qsofa":
                var i = QSOFAInput()
                i.alteredMentation = f.bool("alteredMentation")
                i.rrOver22 = f.bool("rrAtLeast22")
                i.sbpUnder100 = f.bool("sbpAtMost100")
                i.suspectedInfection = f.bool("suspectedInfection")
                add(key, ClinicalScoringEngine.qsofa(i))
            case "sirs":
                var i = SIRSInput()
                i.tempAbove38OrBelow36 = f.bool("tempAbove38OrBelow36")
                i.heartRateOver90 = f.bool("hrAbove90")
                i.rrOver20OrPaCO2Below32 = f.bool("rrAbove20")
                i.wbcOver12kOrBelow4kOr10PctBands = f.bool("wbcAbnormal")
                i.suspectedInfection = f.bool("suspectedInfection")
                add(key, ClinicalScoringEngine.sirs(i))
            default:
                out.notes.append("No iOS calculator mapping for score form '\(key)'")
            }
        }
    }
}
