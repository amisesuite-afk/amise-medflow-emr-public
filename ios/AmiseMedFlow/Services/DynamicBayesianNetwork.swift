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
        let flags = [hasFever, hasHypotension, hasTachycardia, hasOrganDysfunction, lactateElevated, imagingWorstened]
        let count = flags.filter { $0 }.count
        let n2 = news2Score
        if n2 >= 7 || count >= 4 || (lactateElevated && hasHypotension) { return 3 }
        if n2 >= 5 || count >= 3 { return 2 }
        if n2 >= 3 || count >= 1 { return 1 }
        return 0
    }
}

// MARK: - DBN model container

private struct DBNModel {
    let diseaseName: String
    let states: [DiseaseState]
    let transitionMatrix: [[Double]]    // A[from][to], row-stochastic per 12h
    let emissionMatrix: [[Double]]      // B[state][obsClass 0-3]
    let severeStateIndices: [Int]
    let deteriorationThreshold: Double
}

// MARK: - Model 1: Acute Appendicitis

private let appendicitisDBN = DBNModel(
    diseaseName: "Acute Appendicitis",
    states: [
        DiseaseState(id: 0, name: "Uncomplicated Appendicitis",   shortLabel: "Uncomplicated", urgency: .urgent,     clinicalMarkers: "RIF pain, low-grade fever, WBC mildly elevated"),
        DiseaseState(id: 1, name: "Gangrenous Appendicitis",      shortLabel: "Gangrenous",    urgency: .urgent,     clinicalMarkers: "Worsening pain, higher fever, CRP >100"),
        DiseaseState(id: 2, name: "Perforated Appendicitis",      shortLabel: "Perforated",    urgency: .emergency,  clinicalMarkers: "Sudden pain relief then generalisation, peritonism"),
        DiseaseState(id: 3, name: "Appendix Abscess",             shortLabel: "Abscess",       urgency: .urgent,     clinicalMarkers: "Palpable mass RIF, persistent fever, CRP plateau"),
        DiseaseState(id: 4, name: "Generalised Peritonitis",      shortLabel: "Peritonitis",   urgency: .emergency,  clinicalMarkers: "Board-like abdomen, systemically unwell, sepsis signs")
    ],
    transitionMatrix: [
        [0.70, 0.20, 0.05, 0.04, 0.01],
        [0.05, 0.55, 0.25, 0.10, 0.05],
        [0.00, 0.00, 0.40, 0.30, 0.30],
        [0.05, 0.05, 0.05, 0.75, 0.10],
        [0.00, 0.00, 0.05, 0.05, 0.90]
    ],
    emissionMatrix: [
        [0.40, 0.40, 0.15, 0.05],
        [0.10, 0.30, 0.40, 0.20],
        [0.05, 0.10, 0.30, 0.55],
        [0.10, 0.30, 0.45, 0.15],
        [0.00, 0.05, 0.20, 0.75]
    ],
    severeStateIndices: [2, 4],
    deteriorationThreshold: 0.25
)

// MARK: - Model 2: Acute Pancreatitis

private let pancreatitisDBN = DBNModel(
    diseaseName: "Acute Pancreatitis",
    states: [
        DiseaseState(id: 0, name: "Mild Acute Pancreatitis",       shortLabel: "Mild",        urgency: .urgent,     clinicalMarkers: "Epigastric pain, mildly elevated amylase, no organ failure"),
        DiseaseState(id: 1, name: "Moderately Severe Pancreatitis", shortLabel: "Mod-Severe",  urgency: .urgent,     clinicalMarkers: "Transient organ failure <48h, local complications"),
        DiseaseState(id: 2, name: "Severe Acute Pancreatitis",     shortLabel: "Severe",       urgency: .emergency,  clinicalMarkers: "Persistent organ failure >48h, APACHE ≥8, Glasgow ≥3"),
        DiseaseState(id: 3, name: "Necrotising Pancreatitis",      shortLabel: "Necrotising",  urgency: .emergency,  clinicalMarkers: "CT pancreatic necrosis, infected necrosis, sepsis"),
        DiseaseState(id: 4, name: "Pancreatic Pseudocyst",         shortLabel: "Pseudocyst",   urgency: .semiUrgent, clinicalMarkers: "Fluid collection persisting >4 weeks, palpable mass")
    ],
    transitionMatrix: [
        [0.75, 0.15, 0.05, 0.03, 0.02],
        [0.20, 0.50, 0.20, 0.08, 0.02],
        [0.05, 0.15, 0.45, 0.30, 0.05],
        [0.00, 0.05, 0.20, 0.65, 0.10],
        [0.10, 0.05, 0.05, 0.05, 0.75]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.15, 0.35, 0.35, 0.15],
        [0.02, 0.10, 0.35, 0.53],
        [0.01, 0.05, 0.25, 0.69],
        [0.30, 0.45, 0.20, 0.05]
    ],
    severeStateIndices: [2, 3],
    deteriorationThreshold: 0.20
)

// MARK: - Model 3: Sepsis

private let sepsisDBN = DBNModel(
    diseaseName: "Sepsis",
    states: [
        DiseaseState(id: 0, name: "SIRS / Uncomplicated Infection", shortLabel: "SIRS",   urgency: .urgent,    clinicalMarkers: "2+ SIRS criteria, suspected source, haemodynamically stable"),
        DiseaseState(id: 1, name: "Sepsis",                         shortLabel: "Sepsis", urgency: .urgent,    clinicalMarkers: "Organ dysfunction (qSOFA ≥2), lactate <2"),
        DiseaseState(id: 2, name: "Severe Sepsis",                  shortLabel: "Severe", urgency: .emergency, clinicalMarkers: "Lactate 2–4, acute organ dysfunction, hypoperfusion"),
        DiseaseState(id: 3, name: "Septic Shock",                   shortLabel: "Shock",  urgency: .emergency, clinicalMarkers: "Vasopressors required, lactate >2 despite fluids, MAP <65"),
        DiseaseState(id: 4, name: "Multi-Organ Failure",            shortLabel: "MOF",    urgency: .emergency, clinicalMarkers: "≥3 failing organs, refractory shock, ICU dependency")
    ],
    transitionMatrix: [
        [0.60, 0.28, 0.08, 0.03, 0.01],
        [0.30, 0.45, 0.18, 0.06, 0.01],
        [0.08, 0.20, 0.40, 0.25, 0.07],
        [0.03, 0.07, 0.15, 0.55, 0.20],
        [0.01, 0.02, 0.07, 0.20, 0.70]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.15, 0.40, 0.35, 0.10],
        [0.03, 0.12, 0.45, 0.40],
        [0.00, 0.05, 0.20, 0.75],
        [0.00, 0.02, 0.10, 0.88]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 4: Acute Cholecystitis

private let cholecystitisDBN = DBNModel(
    diseaseName: "Acute Cholecystitis",
    states: [
        DiseaseState(id: 0, name: "Tokyo Grade I (Mild)",    shortLabel: "Grade I",    urgency: .urgent,    clinicalMarkers: "RUQ pain, Murphy's sign, WBC mildly elevated, no organ dysfunction"),
        DiseaseState(id: 1, name: "Tokyo Grade II (Moderate)",shortLabel: "Grade II",   urgency: .urgent,    clinicalMarkers: "WBC >18, palpable mass, >72h symptoms, marked local inflammation"),
        DiseaseState(id: 2, name: "Tokyo Grade III (Severe)", shortLabel: "Grade III",  urgency: .emergency, clinicalMarkers: "Cardiovascular, neurological, respiratory, renal, hepatic, or haematological dysfunction"),
        DiseaseState(id: 3, name: "Gangrenous Cholecystitis", shortLabel: "Gangrenous", urgency: .emergency, clinicalMarkers: "Rapid deterioration, absent Murphy's, peritonism, air in GB wall on CT"),
        DiseaseState(id: 4, name: "Perforated Cholecystitis", shortLabel: "Perforated", urgency: .emergency, clinicalMarkers: "Free perforation, pericholecystic abscess, biliary peritonitis")
    ],
    transitionMatrix: [
        [0.70, 0.22, 0.04, 0.03, 0.01],
        [0.10, 0.55, 0.20, 0.12, 0.03],
        [0.00, 0.10, 0.55, 0.25, 0.10],
        [0.00, 0.05, 0.10, 0.55, 0.30],
        [0.00, 0.00, 0.05, 0.05, 0.90]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.10, 0.40, 0.38, 0.12],
        [0.02, 0.10, 0.35, 0.53],
        [0.01, 0.06, 0.28, 0.65],
        [0.00, 0.04, 0.16, 0.80]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 5: Small Bowel Obstruction

private let sboDBN = DBNModel(
    diseaseName: "Small Bowel Obstruction",
    states: [
        DiseaseState(id: 0, name: "Partial SBO",         shortLabel: "Partial",      urgency: .semiUrgent, clinicalMarkers: "Some flatus/stool, colicky pain, distension, CT confirms partial"),
        DiseaseState(id: 1, name: "Complete SBO",         shortLabel: "Complete",     urgency: .urgent,     clinicalMarkers: "No flatus/stool, high-pitched bowel sounds, water-soluble contrast trial"),
        DiseaseState(id: 2, name: "Closed-Loop SBO",      shortLabel: "Closed Loop",  urgency: .emergency,  clinicalMarkers: "Rapid distension, C or U loop on CT, early ischaemia risk"),
        DiseaseState(id: 3, name: "Strangulated Bowel",   shortLabel: "Strangulated", urgency: .emergency,  clinicalMarkers: "Constant severe pain, peritonism, fever, lactate rising, CT ischaemia"),
        DiseaseState(id: 4, name: "Ischaemic Perforation",shortLabel: "Perforation",  urgency: .emergency,  clinicalMarkers: "Free perforation, peritonitis, septic shock")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.06, 0.03, 0.01],
        [0.20, 0.55, 0.15, 0.08, 0.02],
        [0.00, 0.10, 0.45, 0.35, 0.10],
        [0.00, 0.00, 0.10, 0.45, 0.45],
        [0.00, 0.00, 0.00, 0.05, 0.95]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.20, 0.45, 0.28, 0.07],
        [0.05, 0.15, 0.45, 0.35],
        [0.01, 0.05, 0.20, 0.74],
        [0.00, 0.02, 0.10, 0.88]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.25
)

// MARK: - Model 6: Perforated Peptic Ulcer

private let ppuDBN = DBNModel(
    diseaseName: "Perforated Peptic Ulcer",
    states: [
        DiseaseState(id: 0, name: "Contained Perforation",       shortLabel: "Contained",    urgency: .urgent,    clinicalMarkers: "Localised peritonism, small pneumoperitoneum, haemodynamically stable"),
        DiseaseState(id: 1, name: "Localised Peritonitis",        shortLabel: "Localised",    urgency: .urgent,    clinicalMarkers: "Epigastric/generalising tenderness, rigidity, free air, CRP rising"),
        DiseaseState(id: 2, name: "Generalised Peritonitis",      shortLabel: "Generalised",  urgency: .emergency, clinicalMarkers: "Board-like abdomen, generalised tenderness, haemodynamic compromise beginning"),
        DiseaseState(id: 3, name: "Septic Shock (PPU)",           shortLabel: "Shock",        urgency: .emergency, clinicalMarkers: "Vasopressor requirement, lactate >4, multi-organ involvement"),
        DiseaseState(id: 4, name: "Multi-Organ Failure (PPU)",    shortLabel: "MOF",          urgency: .emergency, clinicalMarkers: "Refractory shock, ICU-dependent, ≥3 organ systems failing")
    ],
    transitionMatrix: [
        [0.55, 0.30, 0.10, 0.04, 0.01],
        [0.05, 0.45, 0.35, 0.12, 0.03],
        [0.00, 0.05, 0.40, 0.40, 0.15],
        [0.00, 0.00, 0.05, 0.55, 0.40],
        [0.00, 0.00, 0.00, 0.10, 0.90]
    ],
    emissionMatrix: [
        [0.35, 0.40, 0.20, 0.05],
        [0.08, 0.30, 0.42, 0.20],
        [0.01, 0.08, 0.35, 0.56],
        [0.00, 0.03, 0.15, 0.82],
        [0.00, 0.01, 0.07, 0.92]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 7: Mesenteric Ischaemia

private let mesentericIschaemiaDBN = DBNModel(
    diseaseName: "Mesenteric Ischaemia",
    states: [
        DiseaseState(id: 0, name: "Early / Reversible Ischaemia", shortLabel: "Early",       urgency: .urgent,    clinicalMarkers: "Pain out of proportion to signs, at-risk AF/atherosclerosis, normal initial CT"),
        DiseaseState(id: 1, name: "Established Ischaemia",        shortLabel: "Established", urgency: .emergency, clinicalMarkers: "CT bowel wall thickening, portal gas, mesenteric stranding, lactate rising"),
        DiseaseState(id: 2, name: "Transmural Infarction",        shortLabel: "Infarction",  urgency: .emergency, clinicalMarkers: "Full-thickness necrosis, pneumatosis, absent enhancement, lactate ≥4"),
        DiseaseState(id: 3, name: "Perforation / Peritonitis",    shortLabel: "Perforation", urgency: .emergency, clinicalMarkers: "Free air, generalised peritonitis, septic shock"),
        DiseaseState(id: 4, name: "Irreversible MOF",             shortLabel: "MOF",         urgency: .emergency, clinicalMarkers: "Non-viable bowel, refractory shock, perioperative death risk high")
    ],
    transitionMatrix: [
        [0.40, 0.40, 0.15, 0.04, 0.01],   // rapid progression if untreated
        [0.00, 0.35, 0.45, 0.15, 0.05],
        [0.00, 0.00, 0.30, 0.45, 0.25],
        [0.00, 0.00, 0.05, 0.35, 0.60],
        [0.00, 0.00, 0.00, 0.05, 0.95]
    ],
    emissionMatrix: [
        [0.25, 0.40, 0.25, 0.10],
        [0.03, 0.12, 0.45, 0.40],
        [0.00, 0.05, 0.25, 0.70],
        [0.00, 0.02, 0.12, 0.86],
        [0.00, 0.01, 0.06, 0.93]
    ],
    severeStateIndices: [1, 2, 3, 4],
    deteriorationThreshold: 0.15
)

// MARK: - Model 8: Ruptured AAA

private let rupturedAAADBN = DBNModel(
    diseaseName: "Ruptured Abdominal Aortic Aneurysm",
    states: [
        DiseaseState(id: 0, name: "Symptomatic / Contained Leak",  shortLabel: "Contained",   urgency: .emergency, clinicalMarkers: "Back/flank pain, pulsatile mass, SBP 80–100, HR 90–110, no frank shock"),
        DiseaseState(id: 1, name: "Haemodynamic Instability",      shortLabel: "Unstable",    urgency: .emergency, clinicalMarkers: "SBP <80, HR >120, altered consciousness, intra-peritoneal blood"),
        DiseaseState(id: 2, name: "Frank Rupture / Shock",         shortLabel: "Rupture",     urgency: .emergency, clinicalMarkers: "Profound hypotension, distended abdomen, pulseless, GCS falling"),
        DiseaseState(id: 3, name: "Perioperative Arrest",          shortLabel: "Arrest",      urgency: .emergency, clinicalMarkers: "Cardiac arrest at induction or during repair, massive haemorrhage"),
        DiseaseState(id: 4, name: "Post-repair Multi-Organ Failure",shortLabel: "MOF",         urgency: .emergency, clinicalMarkers: "Ischaemia-reperfusion injury, AKI, ARDS, coagulopathy post-EVAR/open")
    ],
    transitionMatrix: [
        [0.30, 0.45, 0.18, 0.05, 0.02],   // very rapid deterioration
        [0.00, 0.25, 0.50, 0.18, 0.07],
        [0.00, 0.00, 0.20, 0.45, 0.35],
        [0.00, 0.00, 0.00, 0.30, 0.70],
        [0.05, 0.05, 0.05, 0.05, 0.80]
    ],
    emissionMatrix: [
        [0.05, 0.20, 0.45, 0.30],
        [0.00, 0.05, 0.25, 0.70],
        [0.00, 0.02, 0.10, 0.88],
        [0.00, 0.00, 0.05, 0.95],
        [0.00, 0.02, 0.15, 0.83]
    ],
    severeStateIndices: [0, 1, 2, 3, 4],
    deteriorationThreshold: 0.10
)

// MARK: - Model 9: Acute Diverticulitis

private let diverticulitisDBN = DBNModel(
    diseaseName: "Acute Diverticulitis",
    states: [
        DiseaseState(id: 0, name: "Hinchey I — Pericolic Abscess",   shortLabel: "Hinchey I",   urgency: .semiUrgent, clinicalMarkers: "LIF pain and tenderness, fever, CRP elevated, CT pericolic fat stranding + small abscess"),
        DiseaseState(id: 1, name: "Hinchey II — Pelvic Abscess",     shortLabel: "Hinchey II",  urgency: .urgent,     clinicalMarkers: "Larger abscess, may be amenable to CT-guided drainage, persistent fever"),
        DiseaseState(id: 2, name: "Hinchey III — Purulent Peritonitis",shortLabel: "Hinchey III",urgency: .emergency,  clinicalMarkers: "Ruptured abscess, free pus, generalised peritonitis without faecal contamination"),
        DiseaseState(id: 3, name: "Hinchey IV — Faecal Peritonitis", shortLabel: "Hinchey IV",  urgency: .emergency,  clinicalMarkers: "Free faecal contamination, septic shock, Hartmann's or primary anastomosis decision"),
        DiseaseState(id: 4, name: "Septic Complication / Fistula",   shortLabel: "Complication",urgency: .urgent,     clinicalMarkers: "Colovesical/colovaginal fistula, recurrent abscess, elective resection planning")
    ],
    transitionMatrix: [
        [0.55, 0.25, 0.10, 0.05, 0.05],
        [0.15, 0.45, 0.25, 0.10, 0.05],
        [0.00, 0.05, 0.45, 0.40, 0.10],
        [0.00, 0.00, 0.05, 0.70, 0.25],
        [0.10, 0.10, 0.05, 0.05, 0.70]
    ],
    emissionMatrix: [
        [0.40, 0.40, 0.15, 0.05],
        [0.15, 0.40, 0.35, 0.10],
        [0.02, 0.10, 0.45, 0.43],
        [0.00, 0.04, 0.18, 0.78],
        [0.20, 0.40, 0.30, 0.10]
    ],
    severeStateIndices: [2, 3],
    deteriorationThreshold: 0.20
)

// MARK: - Model 10: Acute Cholangitis

private let cholangitisDBN = DBNModel(
    diseaseName: "Acute Cholangitis",
    states: [
        DiseaseState(id: 0, name: "Grade I (Mild Cholangitis)",   shortLabel: "Grade I",  urgency: .urgent,    clinicalMarkers: "Charcot's triad incomplete, responds to antibiotics, no organ dysfunction"),
        DiseaseState(id: 1, name: "Grade II (Moderate)",          shortLabel: "Grade II", urgency: .urgent,    clinicalMarkers: "WBC >12 or <4, fever >39°C, age >75, hyperbilirubinaemia, hypoalbuminaemia"),
        DiseaseState(id: 2, name: "Grade III (Severe)",           shortLabel: "Grade III",urgency: .emergency, clinicalMarkers: "Reynolds pentad: Charcot's + septic shock + mental obtundation, organ dysfunction"),
        DiseaseState(id: 3, name: "Biliary Septic Shock",         shortLabel: "Shock",    urgency: .emergency, clinicalMarkers: "MAP <65, lactate >4, requires vasopressors — urgent ERCP or PTC decompression"),
        DiseaseState(id: 4, name: "Multi-Organ Failure",          shortLabel: "MOF",      urgency: .emergency, clinicalMarkers: "Hepatic, renal, respiratory failure; DIC; >3 organs; ICU-dependent")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.07, 0.02, 0.01],
        [0.20, 0.45, 0.25, 0.08, 0.02],
        [0.00, 0.10, 0.40, 0.35, 0.15],
        [0.00, 0.00, 0.10, 0.50, 0.40],
        [0.00, 0.00, 0.03, 0.12, 0.85]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.15, 0.40, 0.33, 0.12],
        [0.02, 0.10, 0.40, 0.48],
        [0.00, 0.03, 0.15, 0.82],
        [0.00, 0.01, 0.07, 0.92]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 11: Necrotising Fasciitis

private let necfascDBN = DBNModel(
    diseaseName: "Necrotising Fasciitis",
    states: [
        DiseaseState(id: 0, name: "Soft Tissue Infection",        shortLabel: "SSTi",       urgency: .urgent,    clinicalMarkers: "Cellulitis or early NF, erythema, swelling, LRINEC 0–5, no crepitus"),
        DiseaseState(id: 1, name: "Early Necrotising Fasciitis",  shortLabel: "Early NF",   urgency: .emergency, clinicalMarkers: "LRINEC 6–7, wooden-hard induration, bullae beginning, crepitus on palpation"),
        DiseaseState(id: 2, name: "Established NF",               shortLabel: "NF",         urgency: .emergency, clinicalMarkers: "LRINEC ≥8, skin necrosis, gas on CT, haemodynamic instability"),
        DiseaseState(id: 3, name: "NF with Septic Shock",         shortLabel: "NF+Shock",   urgency: .emergency, clinicalMarkers: "Vasopressors, lactate >4, extensive tissue destruction, ICU"),
        DiseaseState(id: 4, name: "Multi-Organ Failure (NF)",     shortLabel: "MOF",        urgency: .emergency, clinicalMarkers: "Renal failure, DIC, ARDS, streptococcal toxic shock — mortality >30%")
    ],
    transitionMatrix: [
        [0.50, 0.35, 0.10, 0.04, 0.01],
        [0.00, 0.30, 0.45, 0.20, 0.05],
        [0.00, 0.00, 0.30, 0.45, 0.25],
        [0.00, 0.00, 0.05, 0.40, 0.55],
        [0.00, 0.00, 0.00, 0.05, 0.95]
    ],
    emissionMatrix: [
        [0.35, 0.40, 0.20, 0.05],
        [0.03, 0.15, 0.45, 0.37],
        [0.00, 0.05, 0.25, 0.70],
        [0.00, 0.01, 0.10, 0.89],
        [0.00, 0.00, 0.05, 0.95]
    ],
    severeStateIndices: [1, 2, 3, 4],
    deteriorationThreshold: 0.15
)

// MARK: - Model 12: Pulmonary Embolism

private let peDBN = DBNModel(
    diseaseName: "Pulmonary Embolism",
    states: [
        DiseaseState(id: 0, name: "Low-Risk PE (PESI I–II)",     shortLabel: "Low Risk",    urgency: .semiUrgent, clinicalMarkers: "SpO2 ≥95%, SBP stable, troponin/BNP normal, PESI I or II — outpatient DOAC eligible"),
        DiseaseState(id: 1, name: "Intermediate-Low PE",          shortLabel: "Intermed-Low",urgency: .urgent,     clinicalMarkers: "RV dysfunction on echo or CT, troponin raised, haemodynamically stable — monitoring required"),
        DiseaseState(id: 2, name: "Intermediate-High PE",         shortLabel: "Intermed-High",urgency: .urgent,    clinicalMarkers: "RV strain + troponin + haemodynamic stability borderline — consider thrombolysis threshold"),
        DiseaseState(id: 3, name: "High-Risk / Massive PE",       shortLabel: "Massive",     urgency: .emergency,  clinicalMarkers: "Haemodynamic compromise: SBP <90, syncope, cardiac arrest — systemic thrombolysis or embolectomy"),
        DiseaseState(id: 4, name: "Cardiorespiratory Arrest",     shortLabel: "Arrest",      urgency: .emergency,  clinicalMarkers: "Pulseless electrical activity, massive PE confirmed or suspected — CPR + thrombolysis")
    ],
    transitionMatrix: [
        [0.75, 0.18, 0.05, 0.01, 0.01],
        [0.20, 0.50, 0.22, 0.06, 0.02],
        [0.05, 0.20, 0.45, 0.25, 0.05],
        [0.00, 0.05, 0.10, 0.55, 0.30],
        [0.00, 0.00, 0.00, 0.10, 0.90]
    ],
    emissionMatrix: [
        [0.55, 0.30, 0.12, 0.03],
        [0.20, 0.40, 0.30, 0.10],
        [0.05, 0.20, 0.45, 0.30],
        [0.00, 0.05, 0.20, 0.75],
        [0.00, 0.00, 0.05, 0.95]
    ],
    severeStateIndices: [3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 13: Incarcerated / Strangulated Hernia

private let herniaDBN = DBNModel(
    diseaseName: "Incarcerated / Strangulated Hernia",
    states: [
        DiseaseState(id: 0, name: "Reducible Hernia (Acute)",        shortLabel: "Reducible",    urgency: .semiUrgent, clinicalMarkers: "Hernia tender but reducible with analgesia and Trendelenburg, no systemic upset"),
        DiseaseState(id: 1, name: "Incarcerated Hernia",             shortLabel: "Incarcerated", urgency: .urgent,     clinicalMarkers: "Irreducible, tender, obstructed bowel sounds, no ischaemia yet on CT"),
        DiseaseState(id: 2, name: "Strangulated Hernia",             shortLabel: "Strangulated", urgency: .emergency,  clinicalMarkers: "Non-reducible, WBC >14, CRP rising, CT bowel ischaemia, constant pain"),
        DiseaseState(id: 3, name: "Bowel Necrosis / Perforation",    shortLabel: "Necrosis",     urgency: .emergency,  clinicalMarkers: "Lactate ≥4, peritonism, septic shock — emergency herniorrhaphy + bowel resection"),
        DiseaseState(id: 4, name: "Septic Shock (Hernia)",           shortLabel: "Shock",        urgency: .emergency,  clinicalMarkers: "Vasopressor requirement, multi-organ involvement — high perioperative mortality")
    ],
    transitionMatrix: [
        [0.60, 0.28, 0.08, 0.03, 0.01],
        [0.10, 0.45, 0.30, 0.12, 0.03],
        [0.00, 0.05, 0.35, 0.42, 0.18],
        [0.00, 0.00, 0.05, 0.45, 0.50],
        [0.00, 0.00, 0.00, 0.10, 0.90]
    ],
    emissionMatrix: [
        [0.45, 0.35, 0.15, 0.05],
        [0.15, 0.40, 0.35, 0.10],
        [0.02, 0.10, 0.40, 0.48],
        [0.00, 0.03, 0.15, 0.82],
        [0.00, 0.01, 0.08, 0.91]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 14: Large Bowel Obstruction / Volvulus

private let lboDBN = DBNModel(
    diseaseName: "Large Bowel Obstruction",
    states: [
        DiseaseState(id: 0, name: "Partial / Subacute LBO",      shortLabel: "Partial",    urgency: .urgent,    clinicalMarkers: "Absolute constipation, distension, CT confirmed partial or pseudo-obstruction"),
        DiseaseState(id: 1, name: "Complete LBO",                shortLabel: "Complete",   urgency: .urgent,    clinicalMarkers: "No flatus/stool, massively distended caecum >9cm, closed-loop risk"),
        DiseaseState(id: 2, name: "Caecal / Sigmoid Volvulus",   shortLabel: "Volvulus",   urgency: .emergency, clinicalMarkers: "Whirl sign CT, rapid distension, haemodynamic instability risk"),
        DiseaseState(id: 3, name: "Caecal Necrosis / Perforation",shortLabel: "Necrosis",  urgency: .emergency, clinicalMarkers: "Caecum >12cm, pneumatosis, free air, peritonitis, lactate rising"),
        DiseaseState(id: 4, name: "Faecal Peritonitis",          shortLabel: "Peritonitis",urgency: .emergency, clinicalMarkers: "Free faecal soiling, generalised peritonitis, septic shock")
    ],
    transitionMatrix: [
        [0.60, 0.28, 0.08, 0.03, 0.01],
        [0.10, 0.45, 0.28, 0.12, 0.05],
        [0.00, 0.08, 0.42, 0.35, 0.15],
        [0.00, 0.00, 0.05, 0.45, 0.50],
        [0.00, 0.00, 0.00, 0.05, 0.95]
    ],
    emissionMatrix: [
        [0.40, 0.38, 0.17, 0.05],
        [0.15, 0.40, 0.35, 0.10],
        [0.03, 0.12, 0.45, 0.40],
        [0.00, 0.04, 0.18, 0.78],
        [0.00, 0.02, 0.10, 0.88]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 15: Upper GI Haemorrhage

private let ugiBleedDBN = DBNModel(
    diseaseName: "Upper GI Haemorrhage",
    states: [
        DiseaseState(id: 0, name: "Low-Risk Bleed (Rockall 0–2)", shortLabel: "Low Risk",  urgency: .urgent,    clinicalMarkers: "HR <100, SBP >100, no major comorbidity, no stigmata of recent haemorrhage at OGD"),
        DiseaseState(id: 1, name: "Moderate Bleed (Rockall 3–4)", shortLabel: "Moderate",  urgency: .urgent,    clinicalMarkers: "Rockall 3–4, active ooze or adherent clot, haemoglobin 70–90, requires transfusion"),
        DiseaseState(id: 2, name: "High-Risk Bleed (Rockall ≥5)", shortLabel: "High Risk", urgency: .emergency, clinicalMarkers: "Active arterial spurting, visible vessel, SBP <90, Hb <70, liver disease or malignancy"),
        DiseaseState(id: 3, name: "Haemorrhagic Shock",           shortLabel: "Shock",     urgency: .emergency, clinicalMarkers: "Transfusion requirement >4 units, SBP <80, HR >120, GCS falling, vasopressors"),
        DiseaseState(id: 4, name: "Rebleeding / Failed Haemostasis",shortLabel: "Rebleed", urgency: .emergency, clinicalMarkers: "Haematemesis after endotherapy, Hb drop >2 g, haemodynamic decompensation — repeat OGD or IR")
    ],
    transitionMatrix: [
        [0.80, 0.15, 0.04, 0.01, 0.00],
        [0.25, 0.45, 0.20, 0.07, 0.03],
        [0.05, 0.15, 0.40, 0.25, 0.15],
        [0.00, 0.05, 0.10, 0.55, 0.30],
        [0.05, 0.10, 0.20, 0.20, 0.45]
    ],
    emissionMatrix: [
        [0.60, 0.28, 0.10, 0.02],
        [0.25, 0.40, 0.27, 0.08],
        [0.05, 0.15, 0.45, 0.35],
        [0.00, 0.05, 0.20, 0.75],
        [0.05, 0.10, 0.35, 0.50]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 16: Lower GI Haemorrhage

private let lgiBleedDBN = DBNModel(
    diseaseName: "Lower GI Haemorrhage",
    states: [
        DiseaseState(id: 0, name: "Minor Haemorrhage",              shortLabel: "Minor",      urgency: .semiUrgent, clinicalMarkers: "Haematochezia with haemodynamic stability, Hb >90, cause likely haemorrhoids/fissure"),
        DiseaseState(id: 1, name: "Moderate LGIB",                  shortLabel: "Moderate",   urgency: .urgent,     clinicalMarkers: "Ongoing haematochezia, Hb 70–90, transfusion required, CT angiography positive"),
        DiseaseState(id: 2, name: "Severe LGIB",                    shortLabel: "Severe",     urgency: .emergency,  clinicalMarkers: "Continuous bright red rectal bleeding, Hb <70, haemodynamic instability"),
        DiseaseState(id: 3, name: "Haemorrhagic Shock",             shortLabel: "Shock",      urgency: .emergency,  clinicalMarkers: "SBP <80, transfusion >4 units, colonic angiodysplasia/diverticular — IR embolisation"),
        DiseaseState(id: 4, name: "Operative Haemorrhage (Failed IR)",shortLabel: "Operative", urgency: .emergency,  clinicalMarkers: "Colectomy required, continued haemodynamic instability, mortality 3–5%")
    ],
    transitionMatrix: [
        [0.75, 0.18, 0.05, 0.01, 0.01],
        [0.25, 0.45, 0.22, 0.06, 0.02],
        [0.05, 0.15, 0.45, 0.28, 0.07],
        [0.00, 0.05, 0.10, 0.55, 0.30],
        [0.00, 0.00, 0.05, 0.05, 0.90]
    ],
    emissionMatrix: [
        [0.60, 0.28, 0.10, 0.02],
        [0.20, 0.42, 0.28, 0.10],
        [0.03, 0.12, 0.48, 0.37],
        [0.00, 0.04, 0.18, 0.78],
        [0.00, 0.02, 0.10, 0.88]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 17: Ischaemic Colitis

private let ischaemicColitisDBN = DBNModel(
    diseaseName: "Ischaemic Colitis",
    states: [
        DiseaseState(id: 0, name: "Mild Transient Ischaemia",       shortLabel: "Transient",   urgency: .urgent,    clinicalMarkers: "Crampy LIF pain, haematochezia, CT thumbprinting limited to watershed area, haemodynamically stable"),
        DiseaseState(id: 1, name: "Non-Gangrenous Ischaemic Colitis",shortLabel: "Non-Gang.",   urgency: .urgent,    clinicalMarkers: "Persistent symptoms >24h, CT wall thickening and oedema, colonoscopy cyanotic mucosa"),
        DiseaseState(id: 2, name: "Gangrenous Ischaemic Colitis",    shortLabel: "Gangrenous",  urgency: .emergency, clinicalMarkers: "Transmural infarction, peritonism, CT pneumatosis or portal gas, lactate rising"),
        DiseaseState(id: 3, name: "Perforation / Peritonitis",       shortLabel: "Perforation", urgency: .emergency, clinicalMarkers: "Free perforation, generalised peritonitis, septic shock — emergency colectomy"),
        DiseaseState(id: 4, name: "Post-Colectomy Complication",     shortLabel: "Post-op",     urgency: .urgent,    clinicalMarkers: "Anastomotic leak or stoma complications — re-look laparotomy")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.07, 0.02, 0.01],
        [0.25, 0.45, 0.22, 0.06, 0.02],
        [0.00, 0.05, 0.40, 0.42, 0.13],
        [0.00, 0.00, 0.05, 0.55, 0.40],
        [0.10, 0.10, 0.05, 0.05, 0.70]
    ],
    emissionMatrix: [
        [0.45, 0.35, 0.15, 0.05],
        [0.15, 0.40, 0.35, 0.10],
        [0.01, 0.07, 0.40, 0.52],
        [0.00, 0.03, 0.15, 0.82],
        [0.15, 0.35, 0.35, 0.15]
    ],
    severeStateIndices: [2, 3],
    deteriorationThreshold: 0.20
)

// MARK: - Model 18: Abdominal Trauma

private let abdominalTraumaDBN = DBNModel(
    diseaseName: "Abdominal Trauma",
    states: [
        DiseaseState(id: 0, name: "AAST Grade I–II (Minor)",        shortLabel: "Minor",       urgency: .urgent,    clinicalMarkers: "Haemodynamically stable, superficial laceration or small subcapsular haematoma, NOM candidate"),
        DiseaseState(id: 1, name: "AAST Grade III (Moderate)",      shortLabel: "Moderate",    urgency: .urgent,    clinicalMarkers: "Solid organ laceration >3cm, active extravasation on CT angiography, IR embolisation considered"),
        DiseaseState(id: 2, name: "AAST Grade IV–V (Severe)",       shortLabel: "Severe",      urgency: .emergency, clinicalMarkers: "Shattered organ, hilar injury, haemodynamic instability — damage control laparotomy"),
        DiseaseState(id: 3, name: "Class III–IV Haemorrhagic Shock",shortLabel: "Shock",       urgency: .emergency, clinicalMarkers: "SBP <70, HR >140, transfusion activation protocol — MTP, TXA, massive haemorrhage"),
        DiseaseState(id: 4, name: "Damage Control / Reoperation",   shortLabel: "Damage Ctrl", urgency: .emergency, clinicalMarkers: "Hypothermia + coagulopathy + acidosis triad — pack, close, ICU, planned re-look 48h")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.07, 0.02, 0.01],
        [0.20, 0.45, 0.25, 0.07, 0.03],
        [0.00, 0.10, 0.35, 0.40, 0.15],
        [0.00, 0.00, 0.05, 0.50, 0.45],
        [0.05, 0.05, 0.05, 0.10, 0.75]
    ],
    emissionMatrix: [
        [0.45, 0.35, 0.15, 0.05],
        [0.10, 0.30, 0.42, 0.18],
        [0.00, 0.05, 0.28, 0.67],
        [0.00, 0.02, 0.10, 0.88],
        [0.00, 0.03, 0.15, 0.82]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 19: Acute Limb Ischaemia

private let acuteLimbIschaemiaDBN = DBNModel(
    diseaseName: "Acute Limb Ischaemia",
    states: [
        DiseaseState(id: 0, name: "Rutherford I (Viable)",           shortLabel: "Viable",     urgency: .urgent,    clinicalMarkers: "No sensory or motor deficit, Doppler signals present, urgent vascular review — LMWH and angiography"),
        DiseaseState(id: 1, name: "Rutherford IIa (Marginally Threatened)",shortLabel: "Marginal",urgency: .urgent, clinicalMarkers: "Sensory loss, motor intact, audible Doppler — revascularisation within hours"),
        DiseaseState(id: 2, name: "Rutherford IIb (Immediately Threatened)",shortLabel: "Threatened",urgency: .emergency, clinicalMarkers: "Motor deficit, sensory loss, mottling — emergency embolectomy or bypass within 1–2h"),
        DiseaseState(id: 3, name: "Rutherford III (Irreversible)",   shortLabel: "Irreversible",urgency: .emergency, clinicalMarkers: "Paralysis, anaesthesia, skin mottling fixed — primary amputation vs. reperfusion injury risk"),
        DiseaseState(id: 4, name: "Reperfusion Injury / Compartment",shortLabel: "Reperfusion",urgency: .emergency, clinicalMarkers: "Post-revascularisation myoglobinuria, AKI, compartment syndrome, fasciotomy required")
    ],
    transitionMatrix: [
        [0.50, 0.30, 0.15, 0.04, 0.01],
        [0.05, 0.40, 0.38, 0.14, 0.03],
        [0.00, 0.05, 0.35, 0.45, 0.15],
        [0.00, 0.00, 0.05, 0.55, 0.40],
        [0.05, 0.05, 0.05, 0.05, 0.80]
    ],
    emissionMatrix: [
        [0.40, 0.35, 0.18, 0.07],
        [0.10, 0.30, 0.42, 0.18],
        [0.02, 0.08, 0.38, 0.52],
        [0.00, 0.03, 0.15, 0.82],
        [0.00, 0.03, 0.18, 0.79]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Disease registry (19 models, with synonyms)

private let dbnRegistry: [String: DBNModel] = [
    // Appendicitis
    "Acute Appendicitis":                   appendicitisDBN,
    "Perforated Appendicitis":              appendicitisDBN,
    "Appendicitis":                         appendicitisDBN,

    // Pancreatitis
    "Acute Pancreatitis":                   pancreatitisDBN,
    "Severe Acute Pancreatitis":            pancreatitisDBN,
    "Necrotising Pancreatitis":             pancreatitisDBN,

    // Sepsis
    "Sepsis":                               sepsisDBN,
    "Septic Shock":                         sepsisDBN,
    "Severe Sepsis":                        sepsisDBN,
    "SIRS":                                 sepsisDBN,

    // Cholecystitis
    "Acute Cholecystitis":                  cholecystitisDBN,
    "Gangrenous Cholecystitis":             cholecystitisDBN,
    "Perforated Cholecystitis":             cholecystitisDBN,

    // SBO
    "Small Bowel Obstruction":              sboDBN,
    "Adhesional Bowel Obstruction":         sboDBN,

    // PPU
    "Perforated Peptic Ulcer":              ppuDBN,
    "Perforated Viscus":                    ppuDBN,
    "Gastric Perforation":                  ppuDBN,
    "Duodenal Perforation":                 ppuDBN,

    // Mesenteric ischaemia
    "Mesenteric Ischaemia":                 mesentericIschaemiaDBN,
    "Acute Mesenteric Ischaemia":           mesentericIschaemiaDBN,
    "Bowel Ischaemia":                      mesentericIschaemiaDBN,

    // AAA
    "Ruptured Abdominal Aortic Aneurysm":   rupturedAAADBN,
    "Aortic Aneurysm (Leaking / Ruptured)": rupturedAAADBN,
    "Ruptured AAA":                         rupturedAAADBN,

    // Diverticulitis
    "Acute Diverticulitis":                 diverticulitisDBN,
    "Diverticulitis":                       diverticulitisDBN,
    "Perforated Diverticulitis":            diverticulitisDBN,

    // Cholangitis
    "Acute Cholangitis":                    cholangitisDBN,
    "Biliary Sepsis":                       cholangitisDBN,
    "Cholangitis":                          cholangitisDBN,

    // NF
    "Necrotising Fasciitis":                necfascDBN,
    "Fournier's Gangrene":                  necfascDBN,
    "Gas Gangrene":                         necfascDBN,

    // PE
    "Pulmonary Embolism":                   peDBN,
    "Massive Pulmonary Embolism":           peDBN,
    "PE":                                   peDBN,

    // Hernia
    "Incarcerated / Strangulated Hernia":   herniaDBN,
    "Strangulated Hernia":                  herniaDBN,
    "Incarcerated Hernia":                  herniaDBN,

    // LBO
    "Large Bowel Obstruction":              lboDBN,
    "Sigmoid Volvulus":                     lboDBN,
    "Caecal Volvulus":                      lboDBN,
    "Colonic Volvulus":                     lboDBN,

    // Upper GI bleed
    "Upper GI Haemorrhage":                 ugiBleedDBN,
    "Upper GI Bleed":                       ugiBleedDBN,
    "Peptic Ulcer Haemorrhage":             ugiBleedDBN,
    "Mallory-Weiss Tear":                   ugiBleedDBN,

    // Lower GI bleed
    "Lower GI Haemorrhage":                 lgiBleedDBN,
    "Lower GI Bleed":                       lgiBleedDBN,
    "Diverticular Haemorrhage":             lgiBleedDBN,

    // Ischaemic colitis
    "Ischaemic Colitis":                    ischaemicColitisDBN,
    "Colonic Ischaemia":                    ischaemicColitisDBN,

    // Trauma
    "Abdominal Trauma":                     abdominalTraumaDBN,
    "Blunt Abdominal Trauma":               abdominalTraumaDBN,
    "Splenic Laceration":                   abdominalTraumaDBN,
    "Hepatic Laceration":                   abdominalTraumaDBN,

    // Limb ischaemia
    "Acute Limb Ischaemia":                 acuteLimbIschaemiaDBN,
    "Peripheral Arterial Occlusion":        acuteLimbIschaemiaDBN,
    "Embolism (Limb)":                      acuteLimbIschaemiaDBN
]

// MARK: - Forward filter (alpha pass)

private func forwardFilter(model: DBNModel, observations: [DBNObservation]) -> [Double] {
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
            return ["Transfer to HDU/ICU", "Aggressive IV fluid resuscitation 250 mL/h", "CT abdomen pancreatic protocol", "HPB + intensivist review", "Early enteral nutrition if >48h tolerated"]

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
