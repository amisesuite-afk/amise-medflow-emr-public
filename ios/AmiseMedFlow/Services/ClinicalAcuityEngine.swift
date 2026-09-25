import Foundation

// MARK: - Clinical acuity engine (triage level)
//
// The triage level the consultation shows and records. It is the HIGHEST of:
//   1. chief-complaint keywords (ClinicalPathwayEngine),
//   2. vital signs — NEWS2 (NEWS2Chart, RCP 2017) and NICE NG51 high-risk criteria for adults;
//      APLS age-banded ranges and NICE NG143 for under-16s,
//   3. blood pressure — NICE NG136 (≥180/120) and, in pregnancy, NICE NG133 (≥160/110 severe),
//   4. critical laboratory values (potassium, sodium, glucose, ketones/pH, calcium, lactate,
//      troponin, haemoglobin, neutrophils, creatinine),
//   5. ECG reports (ST elevation, complete heart block, ventricular arrhythmia, ischaemic change),
//   6. the clinical text alarms (ClinicalTextParser) and the recognition rules in
//      ClinicalAcuityEngine+Recognition (anaphylaxis, DKA, cauda equina, ectopic, torsion …),
//   7. the severity of the diagnosis the clinician confirmed,
//   8. NICE NG12 suspected-cancer criteria met (SuspectedCancerScreening, the Diagnosis tab card):
//      at least priority (red flags warrant expedited outpatient review, not an emergency).
//
// Every component can only RAISE the level (max rule): nothing here lowers a level another
// component set, and the consultation still never de-escalates the patient's recorded acuity
// (CLAUDE.md "AI urgency floor"). Deterministic, on-device, no AI, no network.
//
// Emergencies outside surgery are RECOGNISED, with the standard first actions as suggestions for
// the clinician, and a prominent redirect: call 911 / transfer to the nearest emergency department
// (OKEU Hospital, St Jude's Hospital or Tapion Hospital). The clinic is an outpatient surgical
// practice and does not manage medical, obstetric or paediatric emergencies itself.
//
// Under-16s: adult doses are never shown ("weight-based dosing — calculate per BNFc"), and
// paediatric vital-sign thresholds replace NEWS2 (NEWS2 is not validated under 16). Infants are
// recognised and redirected.

// MARK: - Output types

struct AcuityAlert: Identifiable {
    enum Category: String {
        case surgical, medical, obstetric, paediatric, safeguarding
    }

    let id = UUID()
    /// The level this finding supports, or nil for an informational alert that does not change
    /// the level (e.g. "raised creatinine — compare with baseline").
    let level: Acuity?
    let category: Category
    let title: String
    let detail: String
    /// First actions, as SUGGESTIONS for the clinician (the clinician decides and acts).
    let action: String
    /// Recognise-and-redirect wording (911 / emergency department), set for emergencies outside
    /// surgery and for any emergency in an infant.
    let redirect: String?

    /// One line for banners, notes and the validation harness.
    var summary: String {
        var parts = [detail]
        if !action.isEmpty { parts.append("Action: \(action)") }
        if let redirect { parts.append(redirect) }
        return parts.filter { !$0.isEmpty }.joined(separator: " ")
    }
}

struct AcuityReason {
    let level: Acuity
    /// "keywords", "vitals", "blood pressure", "labs", "ECG", "text alarm", "recognition", "diagnosis"
    let source: String
    let text: String
}

struct AcuityAssessment {
    /// The highest level any component supports.
    let level: Acuity
    let reasons: [AcuityReason]
    let alerts: [AcuityAlert]
    /// The chief-complaint keyword result (pathway, differentials, keyword red flags).
    let keywordTriage: TriageResult

    /// The keyword triage with the combined level, the reasons for it and the alerts, for the
    /// views that show a `TriageResult`.
    var triageResult: TriageResult {
        var flags = keywordTriage.redFlags
        for r in reasons where r.level < .routine && r.source != "keywords" {
            let line = "\(r.level.label): \(r.text)"
            if !flags.contains(line) { flags.append(line) }
        }
        // Safeguarding concerns change no level but are red flags on the triage card (web twin:
        // adaptive-triage.ts lists emergency.safeguarding among the triage reasons).
        for a in alerts where a.category == .safeguarding && a.level == nil {
            let line = "\(a.title): \(a.detail) — follow the practice's safeguarding procedure"
            if !flags.contains(line) { flags.append(line) }
        }
        return TriageResult(suggestedAcuity: level,
                            redFlags: flags,
                            pathway: keywordTriage.pathway,
                            confidencePercent: keywordTriage.confidencePercent,
                            differentials: keywordTriage.differentials,
                            levelReasons: reasons.filter { $0.level == level }.map { "\($0.source): \($0.text)" },
                            alerts: alerts)
    }
}

// MARK: - Recognise and redirect

enum EmergencyRedirect {
    /// The practice's standard redirect for emergencies it does not manage. Never name Victoria
    /// Hospital (closed).
    static let text = "EMERGENCY NOW — call 911 / transfer to the nearest emergency department "
        + "(OKEU Hospital, St Jude's Hospital or Tapion Hospital); inpatients: call the hospital emergency team."
}

// MARK: - Inputs

/// The vital signs the engine reads (one set: the latest recorded).
struct AcuityVitals {
    var heartRate: Int?
    var systolic: Int?
    var diastolic: Int?
    var respiratoryRate: Int?
    var temperatureCelsius: Double?
    var spo2: Int?
    var avpu: AVPU = .alert
    var onSupplementalO2: Bool = false
    var useSpO2Scale2: Bool = false

    init(heartRate: Int? = nil, systolic: Int? = nil, diastolic: Int? = nil, respiratoryRate: Int? = nil,
         temperatureCelsius: Double? = nil, spo2: Int? = nil, avpu: AVPU = .alert,
         onSupplementalO2: Bool = false, useSpO2Scale2: Bool = false) {
        self.heartRate = heartRate
        self.systolic = systolic
        self.diastolic = diastolic
        self.respiratoryRate = respiratoryRate
        self.temperatureCelsius = temperatureCelsius
        self.spo2 = spo2
        self.avpu = avpu
        self.onSupplementalO2 = onSupplementalO2
        self.useSpO2Scale2 = useSpO2Scale2
    }

    init(_ v: VitalsEntry) {
        self.init(heartRate: v.heartRate, systolic: v.bpSystolic, diastolic: v.bpDiastolic,
                  respiratoryRate: v.respiratoryRate, temperatureCelsius: v.temperatureCelsius, spo2: v.spo2,
                  avpu: v.avpu, onSupplementalO2: v.onSupplementalO2, useSpO2Scale2: v.news2UsesSpO2Scale2)
    }

    /// NEWS2 from the shared chart (never re-implemented here).
    var news2: NEWS2Result {
        NEWS2Chart.evaluate(respiratoryRate: respiratoryRate, spo2: spo2, onOxygen: onSupplementalO2,
                            useSpO2Scale2: useSpO2Scale2, systolicBP: systolic, heartRate: heartRate,
                            temperatureCelsius: temperatureCelsius, avpu: avpu)
    }
}

struct AcuityInputs {
    var chiefComplaint: String = ""
    var hpi: String = ""
    /// Examination fields (general, abdomen, CVS, respiratory, neuro, MSK, skin, other).
    var examTexts: [String?] = []
    var investigations: [InvestigationEntry] = []
    var pmhText: String = ""
    var medications: [String] = []
    /// nil when the date of birth is unknown (not "age 0").
    var ageYears: Int?
    var ageMonths: Int?
    var sex: Sex = .unspecified
    var pregnancy: PregnancyContext = .none
    var vitals: AcuityVitals?
    var workingDiagnosis: String?
    /// ClinicalTextParser alarms for the same record.
    var textAlarms: [ClinicalTextParser.ClinicalAlarm] = []
    /// The NICE NG12 suspected-cancer card for the same record (SuspectedCancerScreening.prompt),
    /// nil when no criterion is met.
    var suspectedCancer: SuspectedCancerPrompt? = nil

    var isChild: Bool { (ageYears ?? 99) < 16 }
    var isInfant: Bool { (ageYears ?? 99) < 1 }
}

// MARK: - Engine

enum ClinicalAcuityEngine {

    /// Rule-set version (clinical-content/registry.json `ios-clinical-acuity-engine`). Bump it with
    /// the registry entry and a changelog line whenever a threshold or rule changes.
    static let rulesVersion = "1.1.0"

    /// Builds the inputs from the record the same way the consultation reads it.
    static func inputs(from p: Patient) -> AcuityInputs {
        var i = AcuityInputs()
        i.chiefComplaint = p.chiefComplaint ?? ""
        i.hpi = p.hpi ?? ""
        i.examTexts = [p.examGeneral, p.examAbdo, p.examCVS, p.examResp, p.examNeuro, p.examMSK, p.examSkin, p.examOther]
        i.investigations = p.investigations
        i.pmhText = NegationMatcher.joinClauses(p.pmhEntries.map { Optional($0.condition) } + [p.pmhNotes])
        i.medications = p.prescriptions.map { $0.drug }
        if let dob = p.dateOfBirth {
            i.ageYears = p.ageYears
            i.ageMonths = Calendar.current.dateComponents([.month], from: dob, to: .now).month
        }
        i.sex = p.sex
        i.pregnancy = PregnancyContext.detect(patient: p)
        if let latest = p.vitalsEntries.filter(\.hasAnyValue).sorted(by: { $0.recordedAt > $1.recordedAt }).first {
            i.vitals = AcuityVitals(latest)
        }
        i.workingDiagnosis = p.workingDiagnosis
        // Same parser call as the Diagnosis tab (ConsultationView+DiagnosisTab.refreshBayesian).
        let invResultsText = p.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)" }
            .joined(separator: ". ")
        let examOtherText = NegationMatcher.joinClauses([p.examCVS, p.examResp, p.examNeuro, p.examMSK, p.examSkin, p.examOther])
        i.textAlarms = ClinicalTextParser.parse(hpi: p.hpi, examGeneral: p.examGeneral, examAbdo: p.examAbdo,
                                                examOther: examOtherText.isEmpty ? nil : examOtherText,
                                                notes: invResultsText.isEmpty ? nil : invResultsText).clinicalAlarms
        // Same card as the Diagnosis tab (SuspectedCancerSection).
        i.suspectedCancer = SuspectedCancerScreening.prompt(for: p)
        return i
    }

    static func assess(patient: Patient) -> AcuityAssessment {
        assess(inputs(from: patient))
    }

    static func assess(_ inputs: AcuityInputs) -> AcuityAssessment {
        let b = AcuityBuilder(inputs)

        // 1. Chief-complaint keywords.
        let keyword = ClinicalPathwayEngine.assess(chiefComplaint: inputs.chiefComplaint)
        b.raise(keyword.suggestedAcuity, "keywords", "Chief complaint: \(keyword.pathway)")

        // 2–5. Vital signs, blood pressure, labs, ECG, sepsis.
        vitalSigns(b)
        bloodPressure(b)
        labs(b)
        ecg(b)
        sepsis(b)

        // 6. Text alarms and recognition rules.
        for alarm in inputs.textAlarms {
            let level: Acuity
            switch alarm.severity {
            case .emergency: level = .emergency
            case .critical:  level = alarm.title.hasPrefix("Malignancy") ? .priority : .urgent
            case .warning:   level = .priority
            }
            b.raise(level, "text alarm", alarm.title)
        }
        recognise(b)

        // 7. Confirmed diagnosis.
        diagnosisSeverity(b)

        // 8. NICE NG12 suspected-cancer criteria.
        suspectedCancer(b)

        // Infants: any urgent or emergency finding is recognised and redirected.
        if inputs.isInfant, b.level <= .urgent, !b.alerts.contains(where: { $0.redirect != nil }) {
            b.alert(b.level, .paediatric, "Unwell infant",
                    "Infant under 1 year with \(b.level.label.lowercased()) findings.",
                    "Paediatric assessment now; do not manage in the clinic.", redirect: true)
        }

        return AcuityAssessment(level: b.level, reasons: b.reasons, alerts: b.alerts, keywordTriage: keyword)
    }
}

// MARK: - Builder (accumulates the level, reasons and alerts)

final class AcuityBuilder {
    let inputs: AcuityInputs
    private(set) var level: Acuity = .routine
    private(set) var reasons: [AcuityReason] = []
    private(set) var alerts: [AcuityAlert] = []

    /// Clinical text: CC, HPI, examination (one clause per field).
    let clinical: NegationMatcher.Source
    /// Clinical text plus resulted investigation reports.
    let all: NegationMatcher.Source
    /// CC and HPI only (the patient's current story).
    let story: NegationMatcher.Source
    let cc: NegationMatcher.Source
    let pmh: NegationMatcher.Source
    let medsLower: String
    /// Temperatures written in the text (ClinicalTextParser.recordedTemperatures).
    let writtenTemperatures: [Double]

    init(_ inputs: AcuityInputs) {
        self.inputs = inputs
        let clinicalText = NegationMatcher.joinClauses([inputs.chiefComplaint, inputs.hpi] + inputs.examTexts)
        let reports = inputs.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)" }
        clinical = NegationMatcher.Source(clinicalText)
        all = NegationMatcher.Source(NegationMatcher.joinClauses([clinicalText] + reports.map { Optional($0) }))
        story = NegationMatcher.Source(NegationMatcher.joinClauses([inputs.chiefComplaint, inputs.hpi]))
        cc = NegationMatcher.Source(inputs.chiefComplaint)
        pmh = NegationMatcher.Source(inputs.pmhText)
        medsLower = inputs.medications.joined(separator: " ").lowercased()
        writtenTemperatures = ClinicalTextParser.recordedTemperatures(all.lower)
    }

    func raise(_ l: Acuity, _ source: String, _ text: String) {
        reasons.append(AcuityReason(level: l, source: source, text: text))
        if l < level { level = l }
    }

    /// Adds an alert; a non-nil level also raises the triage level. `redirect: true` adds the
    /// 911 / emergency department wording (only for emergency-level alerts).
    func alert(_ l: Acuity?, _ category: AcuityAlert.Category, _ title: String, _ detail: String,
               _ action: String, redirect: Bool = false, source: String = "recognition") {
        let showRedirect = redirect && l == .emergency
        let detailText = l == .emergency && !showRedirect && !detail.hasPrefix("Emergency")
            ? "Emergency now — \(detail)" : detail
        alerts.append(AcuityAlert(level: l, category: category, title: title, detail: detailText, action: action,
                                  redirect: showRedirect ? EmergencyRedirect.text : nil))
        if let l { raise(l, source, title) }
    }

    /// Adult dose text, or the BNFc instruction for under-16s (no invented paediatric numbers).
    func dose(_ adult: String) -> String {
        inputs.isChild ? "weight-based dosing — calculate per BNFc" : adult
    }

    // MARK: Lab lookup

    /// Latest resulted lab value whose name matches `keywords` (whole words, LabNameMatch).
    func lab(_ keywords: [String], excludingNamesContaining excluded: [String] = []) -> Double? {
        let match = inputs.investigations
            .filter { $0.status == .resulted && $0.category.holdsLabValues && !$0.result.isEmpty }
            .filter { e in !excluded.contains { e.name.lowercased().contains($0) } }
            .filter { LabNameMatch.matchesAny(name: $0.name, keywords: keywords) }
            .sorted { ($0.resultedAt ?? $0.orderedAt) < ($1.resultedAt ?? $1.orderedAt) }
            .last
        guard let entry = match else { return nil }
        return AcuityBuilder.firstNumber(entry.result)
    }

    /// Resulted report text (any category) whose name matches `keywords`.
    func reportText(_ keywords: [String]) -> String {
        inputs.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .filter { LabNameMatch.matchesAny(name: $0.name, keywords: keywords) }
            .map(\.result)
            .joined(separator: ". ")
    }

    static func firstNumber(_ text: String) -> Double? {
        var digits = ""
        var found = false
        for c in text {
            if c.isNumber, c.isASCII { digits.append(c); found = true }
            else if c == ".", found, !digits.contains(".") { digits.append(c) }
            else if found { break }
        }
        return found ? Double(digits) : nil
    }

    // MARK: Shared findings

    var hasFever: Bool {
        if let t = inputs.vitals?.temperatureCelsius, t >= 38.0 { return true }
        if writtenTemperatures.contains(where: { $0 >= 38.0 }) { return true }
        return all.containsAny(["fever", "pyrexia", "pyrexial", "febrile", "rigors", "raised temperature", "high temperature"])
    }
}
