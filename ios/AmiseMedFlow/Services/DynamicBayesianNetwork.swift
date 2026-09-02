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
// All arithmetic is deterministic double-precision. No network calls.

// MARK: - Disease state definitions

struct DiseaseState: Identifiable, Equatable {
    let id: Int
    let name: String
    let shortLabel: String
    let urgency: DecisionPriority
    let clinicalMarkers: String   // brief description of what characterises this state
}

struct DiseaseTrajectory: Identifiable {
    let id = UUID()
    let diseaseName: String
    let states: [DiseaseState]
    // Current filtered belief: P(Z_t = s_i) for each state
    var currentBelief: [Double]
    // Most probable current state
    var currentState: DiseaseState
    // One-step-ahead prediction: P(Z_{t+1} = s_j) = Σ_i currentBelief[i] × A[i][j]
    var projectedBelief: [Double]
    var projectedState: DiseaseState
    // Alert when P(severe state) > threshold
    var deteriorationAlert: DeteriorationAlert?
    // Time of last update
    var updatedAt: Date
}

struct DeteriorationAlert: Identifiable {
    let id = UUID()
    let message: String
    let probability: Double   // P(current or projected severe state)
    let priority: DecisionPriority
    let actions: [String]
}

// MARK: - DBN observation (snapshot of clinical signals at one point in time)

struct DBNObservation {
    var news2Score: Int            // 0–20
    var scoreRisk: ScoreRisk?      // from ClinicalScoringEngine
    var hasFever: Bool             // temp ≥38°C or NEWS2 temp component ≥1
    var hasHypotension: Bool       // SBP <100 or NEWS2 BP component ≥2
    var hasTachycardia: Bool       // HR >100
    var hasOrganDysfunction: Bool  // confusion, creatinine rise, oliguria, jaundice
    var lactateElevated: Bool      // lactate ≥2 mmol/L
    var wbcAbnormal: Bool          // WBC >12 or <4 ×10⁹/L
    var crpElevated: Bool          // CRP >50 mg/L
    var imagingWorstened: Bool     // new free air, new ischaemia, extending necrosis on imaging

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

    // Aggregate observation index: 0 = stable/improving, 1 = stable, 2 = worsening, 3 = critical
    var observationClass: Int {
        let flags = [hasFever, hasHypotension, hasTachycardia, hasOrganDysfunction, lactateElevated, imagingWorstened]
        let count = flags.filter { $0 }.count
        let n2 = news2Score
        if n2 >= 7 || (count >= 4) || (lactateElevated && hasHypotension) { return 3 }
        if n2 >= 5 || count >= 3 { return 2 }
        if n2 >= 3 || count >= 1 { return 1 }
        return 0
    }
}

// MARK: - Disease-specific DBN models

private struct DBNModel {
    let diseaseName: String
    let states: [DiseaseState]
    // Transition matrix A[from][to] — row-stochastic per 12-hour interval
    let transitionMatrix: [[Double]]
    // Emission P(obsClass | state) for obsClass in {0,1,2,3}
    let emissionMatrix: [[Double]]   // [state][obsClass]
    // Index of states considered "severe" for deterioration alerting
    let severeStateIndices: [Int]
    let deteriorationThreshold: Double   // alert when P(severe) exceeds this
}

private let appendicitisDBN = DBNModel(
    diseaseName: "Acute Appendicitis",
    states: [
        DiseaseState(id: 0, name: "Uncomplicated Appendicitis",   shortLabel: "Uncomplicated", urgency: .urgent,     clinicalMarkers: "RIF pain, low-grade fever, WBC mildly elevated"),
        DiseaseState(id: 1, name: "Gangrenous Appendicitis",      shortLabel: "Gangrenous",    urgency: .urgent,     clinicalMarkers: "Worsening pain, higher fever, CRP >100"),
        DiseaseState(id: 2, name: "Perforated Appendicitis",      shortLabel: "Perforated",    urgency: .emergency,  clinicalMarkers: "Sudden pain relief then generalisation, peritonism"),
        DiseaseState(id: 3, name: "Appendix Abscess",             shortLabel: "Abscess",       urgency: .urgent,     clinicalMarkers: "Palpable mass RIF, persistent fever, CRP plateau"),
        DiseaseState(id: 4, name: "Generalised Peritonitis",      shortLabel: "Peritonitis",   urgency: .emergency,  clinicalMarkers: "Board-like abdomen, systemically unwell, sepsis signs")
    ],
    // Each row: P(→Uncomp, →Gangrene, →Perf, →Abscess, →Peritonitis) per 12h
    transitionMatrix: [
        [0.70, 0.20, 0.05, 0.04, 0.01],   // From Uncomplicated
        [0.05, 0.55, 0.25, 0.10, 0.05],   // From Gangrenous
        [0.00, 0.00, 0.40, 0.30, 0.30],   // From Perforated
        [0.05, 0.05, 0.05, 0.75, 0.10],   // From Abscess
        [0.00, 0.00, 0.05, 0.05, 0.90]    // From Peritonitis
    ],
    // P(obsClass | state): obsClass 0=stable, 1=mild, 2=moderate, 3=critical
    emissionMatrix: [
        [0.40, 0.40, 0.15, 0.05],   // Uncomplicated
        [0.10, 0.30, 0.40, 0.20],   // Gangrenous
        [0.05, 0.10, 0.30, 0.55],   // Perforated
        [0.10, 0.30, 0.45, 0.15],   // Abscess
        [0.00, 0.05, 0.20, 0.75]    // Peritonitis
    ],
    severeStateIndices: [2, 4],
    deteriorationThreshold: 0.25
)

private let pancreatitisDBN = DBNModel(
    diseaseName: "Acute Pancreatitis",
    states: [
        DiseaseState(id: 0, name: "Mild Acute Pancreatitis",      shortLabel: "Mild",          urgency: .urgent,     clinicalMarkers: "Epigastric pain, mildly elevated amylase, no organ failure"),
        DiseaseState(id: 1, name: "Moderately Severe Pancreatitis",shortLabel: "Mod-Severe",   urgency: .urgent,     clinicalMarkers: "Transient organ failure <48h, local complications"),
        DiseaseState(id: 2, name: "Severe Acute Pancreatitis",    shortLabel: "Severe",        urgency: .emergency,  clinicalMarkers: "Persistent organ failure >48h, APACHE ≥8, Glasgow ≥3"),
        DiseaseState(id: 3, name: "Necrotising Pancreatitis",     shortLabel: "Necrotising",   urgency: .emergency,  clinicalMarkers: "CT pancreatic necrosis, infected necrosis, sepsis"),
        DiseaseState(id: 4, name: "Pancreatic Pseudocyst",        shortLabel: "Pseudocyst",    urgency: .semiUrgent, clinicalMarkers: "Fluid collection persisting >4 weeks, palpable mass")
    ],
    transitionMatrix: [
        [0.75, 0.15, 0.05, 0.03, 0.02],   // From Mild
        [0.20, 0.50, 0.20, 0.08, 0.02],   // From Mod-Severe
        [0.05, 0.15, 0.45, 0.30, 0.05],   // From Severe
        [0.00, 0.05, 0.20, 0.65, 0.10],   // From Necrotising
        [0.10, 0.05, 0.05, 0.05, 0.75]    // From Pseudocyst
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],   // Mild
        [0.15, 0.35, 0.35, 0.15],   // Mod-Severe
        [0.02, 0.10, 0.35, 0.53],   // Severe
        [0.01, 0.05, 0.25, 0.69],   // Necrotising
        [0.30, 0.45, 0.20, 0.05]    // Pseudocyst
    ],
    severeStateIndices: [2, 3],
    deteriorationThreshold: 0.20
)

private let sepsisDBN = DBNModel(
    diseaseName: "Sepsis",
    states: [
        DiseaseState(id: 0, name: "SIRS / Uncomplicated Infection", shortLabel: "SIRS",        urgency: .urgent,     clinicalMarkers: "2+ SIRS criteria, suspected source, haemodynamically stable"),
        DiseaseState(id: 1, name: "Sepsis",                         shortLabel: "Sepsis",      urgency: .urgent,     clinicalMarkers: "Organ dysfunction (qSOFA ≥2, SOFA ≥2), lactate <2"),
        DiseaseState(id: 2, name: "Severe Sepsis",                  shortLabel: "Severe",      urgency: .emergency,  clinicalMarkers: "Lactate 2–4, acute organ dysfunction, hypoperfusion"),
        DiseaseState(id: 3, name: "Septic Shock",                   shortLabel: "Shock",       urgency: .emergency,  clinicalMarkers: "Vasopressors required, lactate >2 despite fluids, MAP <65"),
        DiseaseState(id: 4, name: "Multi-Organ Failure",            shortLabel: "MOF",         urgency: .emergency,  clinicalMarkers: "≥3 failing organs, refractory shock, ICU dependency")
    ],
    transitionMatrix: [
        [0.60, 0.28, 0.08, 0.03, 0.01],   // From SIRS (without adequate treatment)
        [0.30, 0.45, 0.18, 0.06, 0.01],   // From Sepsis
        [0.08, 0.20, 0.40, 0.25, 0.07],   // From Severe Sepsis
        [0.03, 0.07, 0.15, 0.55, 0.20],   // From Septic Shock
        [0.01, 0.02, 0.07, 0.20, 0.70]    // From MOF
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],   // SIRS
        [0.15, 0.40, 0.35, 0.10],   // Sepsis
        [0.03, 0.12, 0.45, 0.40],   // Severe Sepsis
        [0.00, 0.05, 0.20, 0.75],   // Septic Shock
        [0.00, 0.02, 0.10, 0.88]    // MOF
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

private let cholecystitisDBN = DBNModel(
    diseaseName: "Acute Cholecystitis",
    states: [
        DiseaseState(id: 0, name: "Tokyo Grade I (Mild)",   shortLabel: "Grade I",   urgency: .urgent,     clinicalMarkers: "RUQ pain, Murphy's sign, WBC mildly elevated, no organ dysfunction"),
        DiseaseState(id: 1, name: "Tokyo Grade II (Moderate)",shortLabel: "Grade II", urgency: .urgent,     clinicalMarkers: "WBC >18, palpable mass, >72h symptoms, marked local inflammation"),
        DiseaseState(id: 2, name: "Tokyo Grade III (Severe)",shortLabel: "Grade III", urgency: .emergency,  clinicalMarkers: "Cardiovascular, neurological, respiratory, renal, hepatic, or haematological dysfunction"),
        DiseaseState(id: 3, name: "Gangrenous Cholecystitis",shortLabel: "Gangrenous",urgency: .emergency,  clinicalMarkers: "Rapid deterioration, absent Murphy's, peritonism, air in GB wall on CT"),
        DiseaseState(id: 4, name: "Perforated Cholecystitis",shortLabel: "Perforated",urgency: .emergency,  clinicalMarkers: "Free perforation, pericholecystic abscess, biliary peritonitis")
    ],
    transitionMatrix: [
        [0.70, 0.22, 0.04, 0.03, 0.01],   // Grade I
        [0.10, 0.55, 0.20, 0.12, 0.03],   // Grade II
        [0.00, 0.10, 0.55, 0.25, 0.10],   // Grade III
        [0.00, 0.05, 0.10, 0.55, 0.30],   // Gangrenous
        [0.00, 0.00, 0.05, 0.05, 0.90]    // Perforated
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],   // Grade I
        [0.10, 0.40, 0.38, 0.12],   // Grade II
        [0.02, 0.10, 0.35, 0.53],   // Grade III
        [0.01, 0.06, 0.28, 0.65],   // Gangrenous
        [0.00, 0.04, 0.16, 0.80]    // Perforated
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

private let sboDBN = DBNModel(
    diseaseName: "Small Bowel Obstruction",
    states: [
        DiseaseState(id: 0, name: "Partial SBO",        shortLabel: "Partial",     urgency: .semiUrgent, clinicalMarkers: "Some flatus/stool, colicky pain, distension, CT confirms partial"),
        DiseaseState(id: 1, name: "Complete SBO",        shortLabel: "Complete",   urgency: .urgent,     clinicalMarkers: "No flatus/stool, high-pitched bowel sounds, water-soluble contrast trial"),
        DiseaseState(id: 2, name: "Closed-Loop SBO",     shortLabel: "Closed Loop",urgency: .emergency,  clinicalMarkers: "Rapid distension, C or U loop on CT, early ischaemia risk"),
        DiseaseState(id: 3, name: "Strangulated Bowel",  shortLabel: "Strangulated",urgency: .emergency, clinicalMarkers: "Constant severe pain, peritonism, fever, lactate rising, CT ischaemia"),
        DiseaseState(id: 4, name: "Ischaemic Perforation",shortLabel: "Perforation",urgency: .emergency, clinicalMarkers: "Free perforation, peritonitis, septic shock")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.06, 0.03, 0.01],   // Partial
        [0.20, 0.55, 0.15, 0.08, 0.02],   // Complete
        [0.00, 0.10, 0.45, 0.35, 0.10],   // Closed-Loop
        [0.00, 0.00, 0.10, 0.45, 0.45],   // Strangulated
        [0.00, 0.00, 0.00, 0.05, 0.95]    // Perforation
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],   // Partial
        [0.20, 0.45, 0.28, 0.07],   // Complete
        [0.05, 0.15, 0.45, 0.35],   // Closed-Loop
        [0.01, 0.05, 0.20, 0.74],   // Strangulated
        [0.00, 0.02, 0.10, 0.88]    // Perforation
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.25
)

// MARK: - Disease registry

private let dbnRegistry: [String: DBNModel] = [
    "Acute Appendicitis":           appendicitisDBN,
    "Perforated Appendicitis":      appendicitisDBN,
    "Acute Cholecystitis":          cholecystitisDBN,
    "Acute Pancreatitis":           pancreatitisDBN,
    "Severe Acute Pancreatitis":    pancreatitisDBN,
    "Necrotising Pancreatitis":     pancreatitisDBN,
    "Sepsis":                       sepsisDBN,
    "Septic Shock":                 sepsisDBN,
    "Small Bowel Obstruction":      sboDBN,
    "Incarcerated / Strangulated Hernia": sboDBN
]

// MARK: - Forward filter (alpha pass)

private func forwardFilter(model: DBNModel, observations: [DBNObservation]) -> [Double] {
    let n = model.states.count
    // Uniform prior if no observations
    guard !observations.isEmpty else {
        return Array(repeating: 1.0 / Double(n), count: n)
    }

    // Initialise alpha from first observation
    var alpha = (0..<n).map { model.emissionMatrix[$0][observations[0].observationClass] }
    alpha = normalise(alpha)

    // Propagate
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

// One-step prediction
private func predict(belief: [Double], model: DBNModel) -> [Double] {
    let n = model.states.count
    var predicted = [Double](repeating: 0, count: n)
    for j in 0..<n {
        for i in 0..<n {
            predicted[j] += belief[i] * model.transitionMatrix[i][j]
        }
    }
    return normalise(predicted)
}

private func normalise(_ v: [Double]) -> [Double] {
    let s = v.reduce(0, +)
    guard s > 0 else { return v }
    return v.map { $0 / s }
}

// MARK: - Engine

enum DynamicBayesianNetwork {

    // Compute a DiseaseTrajectory for a named diagnosis given a vitals time-series.
    // Returns nil if no DBN model is registered for this diagnosis.
    static func trajectory(
        forDiagnosis name: String,
        vitals: [VitalsEntry],
        extraObservations: [DBNObservation] = []
    ) -> DiseaseTrajectory? {
        guard let model = dbnRegistry[name] else { return nil }

        // Build observation sequence from vitals (sorted oldest first)
        let sorted = vitals.sorted { $0.recordedAt < $1.recordedAt }
        var observations = sorted.map { DBNObservation(vitals: $0) }
        observations.append(contentsOf: extraObservations)

        let belief    = forwardFilter(model: model, observations: observations)
        let projected = predict(belief: belief, model: model)

        let currentIdx   = belief.indices.max(by: { belief[$0] < belief[$1] }) ?? 0
        let projectedIdx = projected.indices.max(by: { projected[$0] < projected[$1] }) ?? 0

        // Deterioration alert: P(any severe state)
        let pSevere = model.severeStateIndices.reduce(0.0) { $0 + belief[$1] }
        let pSevereNext = model.severeStateIndices.reduce(0.0) { $0 + projected[$1] }

        var alert: DeteriorationAlert? = nil
        if pSevere >= model.deteriorationThreshold || pSevereNext >= model.deteriorationThreshold {
            let p = max(pSevere, pSevereNext)
            let isSevereNow = pSevere >= model.deteriorationThreshold
            alert = DeteriorationAlert(
                message: isSevereNow
                    ? "\(name): \(Int(p * 100))% probability of severe state — urgent escalation required"
                    : "\(name): trajectory projects \(Int(pSevereNext * 100))% probability of severe state next interval",
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

    // Batch: compute trajectories for all diagnoses in a hypothesis list
    static func trajectories(
        forHypotheses hypotheses: [DiagnosisHypothesis],
        vitals: [VitalsEntry],
        extraObservations: [DBNObservation] = []
    ) -> [DiseaseTrajectory] {
        hypotheses.compactMap {
            trajectory(forDiagnosis: $0.name, vitals: vitals, extraObservations: extraObservations)
        }
    }

    // Check if a disease is modelled
    static func hasModel(forDiagnosis name: String) -> Bool {
        dbnRegistry[name] != nil
    }

    // MARK: - Deterioration action tables

    private static func deteriorationActions(for diagnosis: String, currentState: DiseaseState) -> [String] {
        switch diagnosis {
        case "Acute Appendicitis", "Perforated Appendicitis":
            if currentState.urgency == .emergency {
                return ["Emergency laparoscopic appendicectomy ± washout", "IV co-amoxiclav + metronidazole", "Resuscitate, NBM, catheter"]
            }
            return ["Upgrade monitoring to 1-hourly obs", "Urgent CT abdomen/pelvis", "Surgical review immediately", "IV antibiotics"]

        case "Acute Pancreatitis", "Severe Acute Pancreatitis", "Necrotising Pancreatitis":
            return ["Transfer to HDU/ICU", "Aggressive IV fluid resuscitation (250 mL/h crystalloid)", "CT abdomen with contrast (pancreatic protocol)", "GI/HPB surgical and intensivist review", "Consider enteral nutrition if >48h"]

        case "Sepsis", "Septic Shock":
            return ["Activate sepsis 1-hour bundle", "IV broad-spectrum antibiotics immediately", "Target MAP ≥65 — vasopressors if required", "Serum lactate + blood cultures × 2", "ICU referral"]

        case "Acute Cholecystitis":
            return ["IV pip/tazo or co-amoxiclav", "Urgent cholecystectomy vs. cholecystostomy decision", "Anaesthetic review for Tokyo Grade III", "CT abdomen to exclude perforation"]

        case "Small Bowel Obstruction", "Incarcerated / Strangulated Hernia":
            return ["NG tube decompression", "IV fluid resuscitation", "Lactate — rising value mandates theatre", "CT abdomen for closed loop / ischaemia", "Emergency laparotomy if lactate rising or peritonism"]

        default:
            return ["Increase observation frequency", "Senior surgical review", "Repeat bloods + lactate", "Consider CT if not already done"]
        }
    }
}
