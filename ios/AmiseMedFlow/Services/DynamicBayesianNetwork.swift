import Foundation

// MARK: - Dynamic Bayesian Network (DBN)
// Models disease state transitions over time.
//
// Architecture:
//   Hidden state Z_t ∈ {s_0, s_1, ..., s_n}  — disease severity stage
//   Observation X_t (vitals snapshot, lab flags, score risk)
//
//   Prior:  π = P(Z_0)
//   Trans:  A[i][j] = P(Z_t = s_j | Z_{t-1} = s_i)   (row-stochastic matrix)
//   Emit:   B[j][obs] = P(X_t | Z_t = s_j)            (observation likelihood)
//
//   Forward filtering (alpha pass):
//     α_t(j) = P(Z_t = s_j, x_{1:t})
//             = B[j][x_t] × Σ_i α_{t-1}(i) × A[i][j]
//   Normalise each step → filtered state probabilities.
//
// 19 disease models covering the full surgical acute/elective spectrum.
// All arithmetic is deterministic double-precision. No network calls.

// MARK: - Disease state definitions

struct DiseaseState: Identifiable, Equatable {
    let id: Int
    let name: String
    let shortLabel: String
    let urgency: DecisionPriority
    let clinicalMarkers: String
}

struct DiseaseTrajectory: Identifiable {
    let id = UUID()
    let diseaseName: String
    let states: [DiseaseState]
    var currentBelief: [Double]
    var currentState: DiseaseState
    var projectedBelief: [Double]
    var projectedState: DiseaseState
    var deteriorationAlert: DeteriorationAlert?
    var updatedAt: Date
}

struct DeteriorationAlert: Identifiable {
    let id = UUID()
    let message: String
    let probability: Double
    let priority: DecisionPriority
    let actions: [String]
}

// MARK: - DBN observation

struct DBNObservation {
    var news2Score: Int
    var scoreRisk: ScoreRisk?
    var hasFever: Bool
    var hasHypotension: Bool
    var hasTachycardia: Bool
    var hasOrganDysfunction: Bool
    var lactateElevated: Bool
    var wbcAbnormal: Bool
    var crpElevated: Bool
    var imagingWorstened: Bool

    init(vitals: VitalsEntry?) {
        news2Score = vitals?.news2Score ?? 0
        scoreRisk = nil
        hasFever = (vitals?.temperatureCelsius ?? 37.0) >= 38.0 || (vitals?.news2Score ?? 0) >= 3
        hasHypotension = (vitals?.bpSystolic ?? 120) < 100
        hasTachycardia = (vitals?.heartRate ?? 75) > 100
        hasOrganDysfunction = false
        lactateElevated = false
        wbcAbnormal = false
        crpElevated = false
        imagingWorstened = false
    }

    var observationClass: Int {
        // Primary sepsis/deterioration flags (each counts once toward severity tier)
        let flags = [hasFever, hasHypotension, hasTachycardia, hasOrganDysfunction,
                     lactateElevated, imagingWorstened, wbcAbnormal, crpElevated]
        let count = flags.filter { $0 }.count
        let n2 = news2Score
        if n2 >= 7 || count >= 5 || (lactateElevated && hasHypotension) { return 3 }
        if n2 >= 5 || count >= 3 { return 2 }
        if n2 >= 3 || count >= 1 { return 1 }
        return 0
    }
}

// MARK: - DBN model container

struct DBNModel {
    let diseaseName: String
    let states: [DiseaseState]
    let transitionMatrix: [[Double]]    // A[from][to], row-stochastic per 12h
    let emissionMatrix: [[Double]]      // B[state][obsClass 0-3]
    let severeStateIndices: [Int]
    let deteriorationThreshold: Double
}

// MARK: - Forward filter (alpha pass)

func forwardFilter(model: DBNModel, observations: [DBNObservation]) -> [Double] {
    let n = model.states.count
    guard !observations.isEmpty else {
        return Array(repeating: 1.0 / Double(n), count: n)
    }

    var alpha = (0..<n).map { model.emissionMatrix[$0][observations[0].observationClass] }
    alpha = normalise(alpha)

    for t in 1..<observations.count {
        let obsClass = observations[t].observationClass
        var newAlpha = [Double](repeating: 0, count: n)
        for j in 0..<n {
            var sum = 0.0
            for i in 0..<n {
                sum += alpha[i] * model.transitionMatrix[i][j]
            }
            newAlpha[j] = model.emissionMatrix[j][obsClass] * sum
        }
        alpha = normalise(newAlpha)
    }
    return alpha
}

func predict(belief: [Double], model: DBNModel) -> [Double] {
    let n = model.states.count
    var predicted = [Double](repeating: 0, count: n)
    for j in 0..<n {
        for i in 0..<n {
            predicted[j] += belief[i] * model.transitionMatrix[i][j]
        }
    }
    return normalise(predicted)
}

func normalise(_ v: [Double]) -> [Double] {
    let s = v.reduce(0, +)
    guard s > 0 else { return v }
    return v.map { $0 / s }
}

// MARK: - Engine

enum DynamicBayesianNetwork {

    static func trajectory(
        forDiagnosis name: String,
        vitals: [VitalsEntry],
        extraObservations: [DBNObservation] = []
    ) -> DiseaseTrajectory? {
        guard let model = dbnRegistry[name] else { return nil }

        let sorted = vitals.sorted { $0.recordedAt < $1.recordedAt }
        var observations = sorted.map { DBNObservation(vitals: $0) }
        observations.append(contentsOf: extraObservations)

        let belief    = forwardFilter(model: model, observations: observations)
        let projected = predict(belief: belief, model: model)

        let currentIdx   = belief.indices.max(by: { belief[$0] < belief[$1] }) ?? 0
        let projectedIdx = projected.indices.max(by: { projected[$0] < projected[$1] }) ?? 0

        let pSevere     = model.severeStateIndices.reduce(0.0) { $0 + belief[$1] }
        let pSevereNext = model.severeStateIndices.reduce(0.0) { $0 + projected[$1] }

        var alert: DeteriorationAlert? = nil
        if pSevere >= model.deteriorationThreshold || pSevereNext >= model.deteriorationThreshold {
            let p = max(pSevere, pSevereNext)
            let isSevereNow = pSevere >= model.deteriorationThreshold
            alert = DeteriorationAlert(
                message: isSevereNow
                    ? "\(name): \(Int(p * 100))% probability of severe state — urgent escalation required"
                    : "\(name): trajectory projects \(Int(pSevereNext * 100))% probability of severe state next 12h",
                probability: p,
                priority: p >= 0.50 ? .emergency : .urgent,
                actions: deteriorationActions(for: name, currentState: model.states[currentIdx])
            )
        }

        return DiseaseTrajectory(
            diseaseName: name,
            states: model.states,
            currentBelief: belief,
            currentState: model.states[currentIdx],
            projectedBelief: projected,
            projectedState: model.states[projectedIdx],
            deteriorationAlert: alert,
            updatedAt: .now
        )
    }

    static func trajectories(
        forHypotheses hypotheses: [DiagnosisHypothesis],
        vitals: [VitalsEntry],
        extraObservations: [DBNObservation] = []
    ) -> [DiseaseTrajectory] {
        hypotheses.compactMap {
            trajectory(forDiagnosis: $0.name, vitals: vitals, extraObservations: extraObservations)
        }
    }

    static func hasModel(forDiagnosis name: String) -> Bool {
        dbnRegistry[name] != nil
    }

    // MARK: - Deterioration actions

    private static func deteriorationActions(for diagnosis: String, currentState: DiseaseState) -> [String] {
        let key = dbnRegistry[diagnosis]?.diseaseName ?? diagnosis

        switch key {
        case "Acute Appendicitis":
            if currentState.urgency == .emergency {
                return ["Emergency laparoscopic appendicectomy ± washout", "IV co-amoxiclav + metronidazole", "Resuscitate — NBM, catheter, NG if needed"]
            }
            return ["Upgrade to 1-hourly obs", "Urgent CT abdomen/pelvis with contrast", "IV antibiotics — co-amoxiclav", "Surgical review immediately"]

        case "Acute Pancreatitis":
            return ["Transfer to HDU/ICU", "Goal-directed IV fluids (avoid aggressive fluids — WATERFALL 2022)", "CT abdomen pancreatic protocol", "HPB + intensivist review", "Early enteral nutrition if >48h tolerated"]

        case "Sepsis":
            return ["Activate 1-hour Sepsis Bundle immediately", "IV broad-spectrum antibiotics", "Target MAP ≥65 — vasopressors if required", "Lactate + blood cultures × 2", "ICU referral"]

        case "Acute Cholecystitis":
            return ["IV pip/tazo or co-amoxiclav", "Urgent cholecystectomy vs. cholecystostomy decision", "Anaesthetic review for Tokyo Grade III", "CT abdomen to exclude perforation or empyema"]

        case "Small Bowel Obstruction":
            return ["NG tube decompression", "IV fluid resuscitation", "Serial lactate — rising mandates theatre", "CT abdomen for closed loop or ischaemia", "Emergency laparotomy if lactate rising or peritonism"]

        case "Perforated Peptic Ulcer":
            return ["Emergency laparoscopic repair (Graham patch) or open", "IV pip/tazo + metronidazole", "Resuscitate: aggressive IVF, catheter, NGT", "Anaesthetic alert now", "ICU post-op bed"]

        case "Mesenteric Ischaemia":
            return ["Emergency CT mesenteric angiography", "Heparinise immediately (no contraindication)", "Vascular surgery + GI surgery joint assessment", "Emergency laparotomy if peritonism — second look 48h", "ICU bed — high post-op mortality"]

        case "Ruptured Abdominal Aortic Aneurysm":
            return ["Immediate vascular surgery and anaesthesia activation", "Permissive hypotension — SBP 50–70 until clamped", "Activate massive transfusion protocol", "EVAR vs. open AAA repair — CT angio if stable", "Direct transfer to hybrid OR / vascular suite"]

        case "Acute Diverticulitis":
            return ["CT abdomen for Hinchey staging", "IV pip/tazo or meropenem if Grade III/IV", "Colorectal surgery review for emergency Hartmann's vs. primary anastomosis", "Interventional radiology for abscess drainage", "ICU bed if septic shock"]

        case "Acute Cholangitis":
            return ["Emergency ERCP within 24h (12h if Grade III)", "IV pip/tazo — broad-spectrum cover for biliary organisms", "Resuscitate — fluids, catheter, check INR for ERCP", "Gastroenterology or HPB surgery on-call", "ICU for Grade III — vasopressors if MAP <65"]

        case "Necrotising Fasciitis":
            return ["Emergency radical surgical debridement — within 6h of diagnosis", "IV pip/tazo + clindamycin + meropenem (streptococcal cover)", "Activate plastic surgery and ICU", "Hyperbaric oxygen if available (adjunct)", "Early re-look at 24–48h — 2nd debridement usually required"]

        case "Pulmonary Embolism":
            return ["Systemic thrombolysis if haemodynamic compromise (alteplase 100mg IV)", "Anticoagulate — LMWH or UFH bridge", "Immediate cardiology/pulmonology review", "Echo to assess RV function and thrombus", "ICU for massive PE — consider embolectomy if thrombolysis fails"]

        case "Incarcerated / Strangulated Hernia":
            return ["Emergency herniorrhaphy — open approach for strangulated", "IV co-amoxiclav + metronidazole", "Resuscitate — fluids, catheter, NGT if obstructed", "Consent for bowel resection — necrosis likely", "ICU post-op if septic shock"]

        case "Large Bowel Obstruction":
            return ["NG tube — limited benefit but decompresses vomiting", "Rigid sigmoidoscopy + flatus tube for sigmoid volvulus", "Emergency colorectal surgery for perforation or caecal necrosis", "CT colonography to exclude synchronous cancer", "On-table lavage + primary anastomosis vs. Hartmann's"]

        case "Upper GI Haemorrhage":
            return ["Urgent OGD within 24h (12h if shock/active bleeding)", "Transfuse PRBC target Hb 70–80 (80+ if cardiac)", "IV PPI bolus then infusion after endotherapy", "Rebleed: repeat OGD — 3rd attempt: IR embolisation or surgery", "Terlipressin if variceal bleed suspected"]

        case "Lower GI Haemorrhage":
            return ["CT angiography if active bleeding — embolisation if positive", "Transfuse to Hb ≥70", "Colonoscopy within 24h if haemodynamically stable", "IR embolisation for diverticular/angiodysplastic source", "Emergency colectomy only if IR fails and patient haemodynamically unstable"]

        case "Ischaemic Colitis":
            return ["IV pip/tazo", "Serial abdominal exams — peritonism mandates laparotomy", "CT abdomen with contrast to stage and exclude perforation", "Colonoscopy in non-peritonitic patient within 48h to assess mucosal viability", "Emergency colectomy for transmural infarction or perforation"]

        case "Abdominal Trauma":
            return ["Activate major trauma protocol / trauma team", "Activate MTP — TXA within 3 hours of injury", "Emergency CT trauma series", "Interventional radiology embolisation for solid organ injury", "Damage control laparotomy — pack, close, ICU, re-look 48h"]

        case "Acute Limb Ischaemia":
            return ["Immediate IV heparin (80 U/kg bolus + 18 U/kg/h infusion)", "Vascular surgery on-call — revascularisation within 6h", "CT angiography if Rutherford I–IIa and haemodynamically stable", "Emergency embolectomy (Fogarty) for Rutherford IIb", "Fasciotomy post-revascularisation if >6h ischaemia time"]

        default:
            return ["Increase observation frequency to 30-min", "Senior surgical review immediately", "Repeat bloods — lactate, FBC, CRP, U&E", "CT imaging if not already done"]
        }
    }
}
