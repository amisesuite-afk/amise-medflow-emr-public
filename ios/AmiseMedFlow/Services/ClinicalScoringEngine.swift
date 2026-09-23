// ClinicalScoringEngine.swift
// Deterministic, evidence-based clinical scoring for surgical practice.
// No AI, no network calls — HIPAA-safe.
// Sources: NICE, ACS, EAST, WSES, Tokyo Guidelines 2018, Sepsis-3, BSG, SIGN.

import Foundation

// MARK: - Core output types

enum ScoreRisk: String, Comparable, CaseIterable {
    case low      = "Low Risk"
    case moderate = "Moderate Risk"
    case high     = "High Risk"
    case critical = "Critical"

    static func < (lhs: ScoreRisk, rhs: ScoreRisk) -> Bool {
        let order: [ScoreRisk] = [.low, .moderate, .high, .critical]
        return (order.firstIndex(of: lhs) ?? 0) < (order.firstIndex(of: rhs) ?? 0)
    }

    var colorHex: String {
        switch self {
        case .low:      return "#22C55E"
        case .moderate: return "#EAB308"
        case .high:     return "#F97316"
        case .critical: return "#DC2626"
        }
    }

    var icon: String {
        switch self {
        case .low:      return "checkmark.circle"
        case .moderate: return "exclamationmark.triangle"
        case .high:     return "exclamationmark.circle.fill"
        case .critical: return "xmark.octagon.fill"
        }
    }
}

struct ScoredItem: Identifiable {
    let id = UUID()
    let label: String
    let points: Double
    let present: Bool
}

struct ClinicalScore: Identifiable {
    let id = UUID()
    let systemName: String       // e.g. "Alvarado Score"
    let abbreviation: String     // e.g. "MANTRELS"
    let score: Double
    let maxScore: Double         // 0 = no fixed maximum (continuous / unbounded scores)
    let risk: ScoreRisk
    let interpretation: String   // concise clinical meaning of this score
    let recommendations: [String]
    let items: [ScoredItem]
    let redFlags: [String]
    let evidenceNote: String?    // guideline reference
}

extension ClinicalScore {
    // Convenience initialiser for scores that do not require abbreviation,
    // items, or redFlags, and where maxScore may be absent (continuous scales).
    init(
        name: String,
        score: Double,
        maxScore: Double? = nil,
        risk: ScoreRisk,
        interpretation: String,
        recommendations: [String] = [],
        items: [ScoredItem] = [],
        redFlags: [String] = [],
        evidenceNote: String? = nil
    ) {
        self.systemName     = name
        self.abbreviation   = ""
        self.score          = score
        self.maxScore       = maxScore ?? 0     // 0 signals "no fixed max" to display logic
        self.risk           = risk
        self.interpretation = interpretation
        self.recommendations = recommendations
        self.items          = items
        self.redFlags       = redFlags
        self.evidenceNote   = evidenceNote
    }
}

// MARK: - Input structs
// Each input struct maps directly to what can be collected at bedside
// without laboratory confirmation (unless noted).

struct AlvaradoInput: Equatable {
    var migrationToRIF: Bool = false     // 1
    var anorexia: Bool = false           // 1
    var nauseaVomiting: Bool = false     // 1
    var tendernessRIF: Bool = false      // 2
    var reboundTenderness: Bool = false  // 1
    var elevatedTemperature: Bool = false // ≥37.3°C  // 1
    var wbcElevated: Bool = false        // WBC >10,000 — 2
    var neutrophiliaShift: Bool = false  // >75% neutrophils — 1
}

struct TokyoCholecystitisInput: Equatable {
    // Local signs/symptoms
    var localInflammationSignsMild: Bool = false    // tenderness, RUQ mass/pain
    var wbcAbove18: Bool = false                    // WBC >18,000
    var durationOver72h: Bool = false
    var markedLocalInflammation: Bool = false       // biliary peritonitis, pericholecystic abscess, hepatic abscess, gangrenous/emphysematous cholecystitis
    // Grade III organ dysfunction
    var cardiovascularDysfunction: Bool = false    // SBP <90 or vasopressor
    var neurologicalDysfunction: Bool = false      // decreased consciousness
    var respiratoryDysfunction: Bool = false       // PaO2/FiO2 <300
    var renalDysfunction: Bool = false             // oliguria, Cr >2 mg/dL
    var hepaticDysfunction: Bool = false           // PT-INR >1.5
    var haematologicalDysfunction: Bool = false    // platelets <100,000
}

struct TokyoCholangitisInput: Equatable {
    // Severity Grade II criteria (any = Grade II or above)
    var wbcAbove12OrBelow4: Bool = false
    var temperatureAbove39: Bool = false
    var ageAbove75: Bool = false
    var bilirubinAbove5: Bool = false
    var albuminBelow0_7xLLN: Bool = false  // albumin <0.7 × lower limit of normal
    // Grade III organ dysfunction (any = Grade III / Critical)
    var cardiovascularDysfunction: Bool = false
    var neurologicalDysfunction: Bool = false
    var respiratoryDysfunction: Bool = false
    var renalDysfunction: Bool = false
    var hepaticDysfunction: Bool = false
    var haematologicalDysfunction: Bool = false
    // Diagnosis confirmed
    var cholangitisConfirmed: Bool = false   // Charcot's triad or imaging
}

struct RansonInput: Equatable {
    // At admission
    var ageOver55: Bool = false
    var wbcOver16k: Bool = false         // >16,000/μL
    var glucoseOver200: Bool = false     // >11 mmol/L
    var ldhOver350: Bool = false         // LDH >350 IU/L
    var astOver250: Bool = false         // AST >250 IU/L
    // At 48 h
    var hctFallOver10: Bool = false      // Haematocrit fall >10%
    var bunRiseOver5: Bool = false       // BUN rise >1.8 mmol/L
    var calciumBelow8: Bool = false      // <2 mmol/L
    var pao2Below60: Bool = false        // PaO2 <60 mmHg
    var baseDeficitOver4: Bool = false   // Base deficit >4 mEq/L
    var fluidSequestrationOver6L: Bool = false
}

struct GlasgowPancreatitisInput: Equatable {
    // PANCREAS score — all at 48h
    var pao2Below60: Bool = false         // P
    var ageOver55: Bool = false           // A
    var wbcOver15k: Bool = false          // N (neutrophilia)
    var calciumBelow2: Bool = false       // C  (<2 mmol/L)
    var ureaOver16: Bool = false          // R  (>16 mmol/L)
    var ldhOver600OrAstOver200: Bool = false // E (enzymes)
    var albuminBelow32: Bool = false      // A  (<32 g/L)
    var glucoseOver10: Bool = false       // S  (>10 mmol/L)
}

struct RockallInput: Equatable {
    // Pre-endoscopy
    var ageGroup: AgeGroup = .under60
    var shock: ShockStatus = .none
    var comorbidity: Comorbidity = .none
    // Post-endoscopy
    var diagnosis: EndoscopyDiagnosis = .malloryWeissOrNoLesion
    var majorStigmata: Bool = false   // active bleeding, adherent clot, visible vessel

    enum AgeGroup: Int { case under60 = 0, sixtyTo79 = 1, over80 = 2 }
    enum ShockStatus: Int { case none = 0, pulse100SBPOver100 = 1, sbpBelow100 = 2 }
    enum Comorbidity: Int {
        case none = 0
        case anyMajor = 2          // CCF, IHD, other major
        case renalOrLiverOrMalignancy = 3
    }
    enum EndoscopyDiagnosis: Int {
        case malloryWeissOrNoLesion = 0
        case allOtherDiagnoses = 1
        case upperGIMalignancy = 2
    }
}

struct SIRSInput: Equatable {
    var tempAbove38OrBelow36: Bool = false   // °C
    var heartRateOver90: Bool = false
    var rrOver20OrPaCO2Below32: Bool = false
    var wbcOver12kOrBelow4kOr10PctBands: Bool = false
    var suspectedInfection: Bool = false
    var positiveBloodCulture: Bool = false
}

struct QSOFAInput: Equatable {
    var alteredMentation: Bool = false   // GCS <15
    var rrOver22: Bool = false
    var sbpUnder100: Bool = false
    var suspectedInfection: Bool = false
}

struct WellsDVTInput: Equatable {
    var activeCancer: Bool = false                    // +1
    var paralysisParesisPlastercast: Bool = false     // +1
    var bedridden3dOrSurgery12w: Bool = false         // +1
    var localizedTendernessDeepVein: Bool = false     // +1
    var entireLegSwollen: Bool = false                // +1
    var calfSwellingOver3cm: Bool = false             // +1
    var pittingOedema: Bool = false                   // +1
    var collateralSuperficialVeins: Bool = false      // +1
    var previousDVT: Bool = false                     // +1
    var alternativeDiagnosisAsLikely: Bool = false    // -2
}

struct WellsPEInput: Equatable {
    var clinicalSignsDVT: Bool = false           // +3
    var hrOver100: Bool = false                  // +1.5
    var immobilisationOrSurgery4w: Bool = false  // +1.5
    var previousDVTOrPE: Bool = false            // +1.5
    var haemoptysis: Bool = false                // +1
    var malignancyActive: Bool = false           // +1
    var alternativeDxLessLikely: Bool = false    // +3
}

struct ABCD2Input: Equatable {
    var ageOver60: Bool = false          // +1
    var bpOver140_90: Bool = false       // +1
    var unilateralWeakness: Bool = false // +2
    var speechWithoutWeakness: Bool = false // +1
    var durationOver60min: Bool = false  // +2
    var duration10to59min: Bool = false  // +1 (exclusive with above)
    var diabetes: Bool = false           // +1
}

struct LRINECInput: Equatable {
    // Laboratory Risk Indicator for Necrotising Fasciitis
    var crpOver150: Bool = false         // CRP >150 mg/L — +4
    var wbc15to25: Bool = false          // WBC 15–25×10⁹/L — +1
    var wbcOver25: Bool = false          // WBC >25×10⁹/L — +2
    var hb11to13_5: Bool = false         // Hb 11–13.5 g/dL — +1
    var hbBelow11: Bool = false          // Hb <11 g/dL — +2
    var sodium135to140: Bool = false     // Na 135–140 mmol/L — +0 (normal)
    var sodiumBelow135: Bool = false     // Na <135 mmol/L — +2
    var creatinine141to177: Bool = false // Cr 141–177 μmol/L — +2
    var creatinineOver177: Bool = false  // Cr >177 μmol/L — +4 (cumulative)
    var glucoseOver10: Bool = false      // >10 mmol/L — +1
}

struct RCRIInput: Equatable {
    // Revised Cardiac Risk Index (Lee 1999)
    var highRiskSurgery: Bool = false          // intraperitoneal/intrathoracic/suprainguinal vascular — +1
    var ischemicHeartDisease: Bool = false     // Hx MI, angina, +ve stress, nitrate use, Q waves — +1
    var congestiveHeartFailure: Bool = false   // +1
    var cerebrovascularDisease: Bool = false   // Hx stroke/TIA — +1
    var insulinDependentDiabetes: Bool = false // pre-op insulin — +1
    var preopCreatinineOver2: Bool = false     // Cr >177 μmol/L — +1
}

struct CapriniInput: Equatable {
    // Major risk factors
    var ageOver75: Bool = false             // +3
    var age60to74: Bool = false             // +2
    var age41to59: Bool = false             // +1
    var activeOrPriorMalignancy: Bool = false // +2
    var priorVTE: Bool = false              // +3
    var familyHistoryVTE: Bool = false      // +3
    var thrombophilia: Bool = false         // +3
    var minorSurgery: Bool = false          // +1
    var majorSurgery: Bool = false          // +2
    var laparoscopicSurgeryOver45min: Bool = false // +2
    var immobilityBedridden: Bool = false   // +1
    var centralVenousAccess: Bool = false   // +2
    var hormonalTherapy: Bool = false       // +1
    var sepsis30d: Bool = false             // +1
    var bmi40Plus: Bool = false             // +1
    var stroke: Bool = false                // +5
    var mi: Bool = false                    // +5
    var spinalCordInjury: Bool = false      // +5
    var pelvisFractureOrHipKneeReplacement: Bool = false // +5
    var multipleTrauma: Bool = false        // +5
}

struct ChildPughInput: Equatable {
    // Child-Pugh Score for liver disease / cirrhosis
    var ascites: AscitesGrade = .none
    var encephalopathy: EncephalopathyGrade = .none
    var bilirubinUmolL: Double = 0      // μmol/L
    var albuminGdL: Double = 4.0        // g/dL
    var ptINR: Double = 1.0

    enum AscitesGrade: Int { case none = 1, controlled = 2, refractory = 3 }
    enum EncephalopathyGrade: Int { case none = 1, grade1to2 = 2, grade3to4 = 3 }
}

struct MEWSInput: Equatable {
    // Modified Early Warning Score — bedside vital signs
    var respiratoryRate: Int = 14      // breaths/min
    var oxygenSaturation: Int = 98    // SpO₂ %
    var heartRate: Int = 75            // bpm
    var systolicBP: Int = 120          // mmHg
    var temperature: Double = 36.8    // °C
    var consciousnessAVPU: AVPULevel = .alert
    var urineOutput: UrineOutput = .normal // per hour

    enum AVPULevel: Int { case alert = 0, voice = 1, pain = 2, unresponsive = 3 }
    enum UrineOutput: Int { case normal = 0, low = 1, nil_ = 2 } // nil = <10 mL/hr
}

struct NEWS2Input: Equatable {
    // National Early Warning Score 2 (RCP 2017)
    var respiratoryRate: Int = 14
    var spo2: Int = 97
    var onSupplementalO2: Bool = false
    var systolicBP: Int = 120
    var heartRate: Int = 75
    var temperatureCelsius: Double = 36.8
    var avpu: AVPU = .alert
}

struct GCSInput: Equatable {
    // Glasgow Coma Scale
    var eyeOpening: EyeScore = .spontaneous      // 4 = spontaneous, 3 = to voice, 2 = to pain, 1 = none
    var verbalResponse: VerbalScore = .oriented  // 5 oriented … 1 none
    var motorResponse: MotorScore = .obeys       // 6 obeys … 1 none

    enum EyeScore: Int, CaseIterable { case spontaneous = 4, toVoice = 3, toPain = 2, none = 1 }
    enum VerbalScore: Int, CaseIterable { case oriented = 5, confused = 4, inappropriateWords = 3, sounds = 2, none = 1 }
    enum MotorScore: Int, CaseIterable { case obeys = 6, localises = 5, withdraws = 4, abnormalFlexion = 3, extension_ = 2, none = 1 }
}

struct ASAInput: Equatable {
    var asaClass: ASAClass = .i

    enum ASAClass: Int, CaseIterable {
        case i = 1, ii = 2, iii = 3, iv = 4, v = 5
    }
}

struct MELDInput: Equatable {
    // MELD-Na Score (Kamath 2001 + sodium update)
    var bilirubinMgDL: Double = 1.0     // mg/dL
    var creatinineMgDL: Double = 1.0   // mg/dL
    var inrValue: Double = 1.0
    var sodiumMmolL: Double = 138.0    // mmol/L (for MELD-Na)
    var onDialysis: Bool = false       // creatinine capped at 4.0 if true
}

struct CHA2DS2VAScInput: Equatable {
    // CHA₂DS₂-VASc — AF stroke risk
    var congestiveHeartFailure: Bool = false    // +1
    var hypertension: Bool = false              // +1
    var ageOver75: Bool = false                 // +2 (overrides age65to74)
    var age65to74: Bool = false                 // +1
    var diabetes: Bool = false                  // +1
    var strokeOrTIA: Bool = false               // +2
    var vascularDisease: Bool = false           // MI, PAD, aortic plaque — +1
    var femaleSex: Bool = false                 // +1
}

struct HASBLEDInput: Equatable {
    // HAS-BLED bleeding risk with anticoagulation
    var hypertensionUncontrolled: Bool = false  // SBP >160 — +1
    var renalDysfunction: Bool = false          // dialysis, Cr >200 μmol/L — +1
    var liverDysfunction: Bool = false          // cirrhosis or bili >×2 + AST/ALT >×3 — +1
    var strokeHistory: Bool = false             // +1
    var priorBleeding: Bool = false             // or predisposition — +1
    var labileINR: Bool = false                 // TTR <60% — +1
    var ageOver65: Bool = false                 // +1
    var drugsOrAlcohol: Bool = false            // antiplatelets/NSAIDs or ≥8 units/wk — +1 each (max +2)
    var alcoholUse: Bool = false                // counted separately from drugs
}

struct BlatchfordInput: Equatable {
    // Glasgow-Blatchford Score — upper GI bleed pre-endoscopy
    var bloodUreaNitrogen: BlatchfordBUN = .under6_5
    var haemoglobin: BlatchfordHb = .male13plus    // set gender-appropriate field
    var isMale: Bool = true
    var sbp: BlatchfordSBP = .over109
    var heartRateOver100: Bool = false
    var melaena: Bool = false
    var syncope: Bool = false
    var hepaticDisease: Bool = false
    var cardiacFailure: Bool = false

    enum BlatchfordBUN: Int {
        case under6_5 = 0, bun6_5to7_9 = 2, bun8to9_9 = 3, bun10to24_9 = 4, bunOver25 = 6
    }
    enum BlatchfordHb: Int {
        case male13plus = 0
        case male12to12_9 = 1
        case male10to11_9 = 3
        case maleSub10 = 6
        case female12plus = 10
        case female10to11_9 = 11
        case femaleSub10 = 16
    }

    var haemoglobinPoints: Int {
        switch haemoglobin {
        case .male13plus:    return 0
        case .male12to12_9:  return 1
        case .male10to11_9:  return 3
        case .maleSub10:     return 6
        case .female12plus:  return 0
        case .female10to11_9: return 1
        case .femaleSub10:   return 6
        }
    }
    enum BlatchfordSBP: Int {
        case over109 = 0, sbp100to109 = 1, sbp90to99 = 2, under90 = 3
    }
}

struct STOPBANGInput: Equatable {
    // STOP-BANG — OSA screening pre-operatively
    var snoring: Bool = false           // S
    var tired: Bool = false             // T — often tired during day
    var observed: Bool = false          // O — observed to stop breathing
    var pressureTreated: Bool = false   // P — high blood pressure or treated
    var bmiOver35: Bool = false         // B
    var ageOver50: Bool = false         // A
    var neckOver40cm: Bool = false      // N — neck circumference
    var male: Bool = false              // G — gender male
}

struct CURB65Input: Equatable {
    // CURB-65 — Community-Acquired Pneumonia severity (Lim et al, Thorax 2003)
    var confusion: Bool = false          // New confusion (AMT ≤8 or new disorientation)
    var ureaDOver7: Bool = false         // BUN >7 mmol/L (>19 mg/dL)
    var respiratoryRateOver30: Bool = false  // RR ≥30 breaths/min
    var lowBP: Bool = false              // SBP <90 mmHg or DBP ≤60 mmHg
    var ageOver65: Bool = false          // Age ≥65 years
}

struct PaduaInput: Equatable {
    // Padua Prediction Score — VTE risk in acutely ill medical patients (Barbar et al, J Thromb 2010)
    var activeOrRecentCancer: Bool = false       // +3 (prior <6 months or mets)
    var previousVTE: Bool = false                // +3 (exclude superficial vein thrombosis)
    var reducedMobility: Bool = false            // +3 (anticipated ≥3 days bed rest)
    var thrombophilia: Bool = false              // +3 (inherited or acquired)
    var recentTraumaOrSurgery: Bool = false      // +2 (≤1 month)
    var ageOver70: Bool = false                  // +1
    var heartOrRespiratoryFailure: Bool = false  // +1
    var acuteMIOrIschaemicStroke: Bool = false   // +1
    var acuteInfectionOrInflammatory: Bool = false // +1
    var obese: Bool = false                      // +1 (BMI ≥30)
    var ongoingHormonalTreatment: Bool = false   // +1 (OCP, HRT)
}

struct PPOSSUMInput: Equatable {
    // P-POSSUM — Portsmouth POSSUM (Whiteley et al, Br J Surg 1996)
    // Each variable stores actual point value (1, 2, 4, or 8).
    // Predicted mortality: ln(R/(1−R)) = −9.065 + 0.1692×PS + 0.1550×OS
    // Predicted morbidity: ln(R/(1−R)) = −5.91 + 0.16×PS + 0.19×OS
    // MARK: Physiological Score (PS) — 12 variables
    var agePhys: Int = 1             // 1=≤60, 2=61–70, 4=71–80, 8=≥81
    var cardiacSigns: Int = 1        // 1=none, 2=Rx only, 4=oedema/warfarin, 8=raised JVP/cardiomegaly
    var respiratoryHx: Int = 1       // 1=none, 2=exertional dyspnoea, 4=limiting dyspnoea/COPD, 8=breathless at rest
    var sbpPhys: Int = 1             // 1=110–130, 2=131–170 or 100–109, 4=≥171 or 90–99, 8=≤89
    var hrPhys: Int = 1              // 1=51–80, 2=81–100 or ≤50, 4=101–120, 8=≥121
    var gcsPhys: Int = 1             // 1=15, 2=12–14, 4=9–11, 8=≤8
    var haemoglobin: Int = 1         // 1=13–16 g/dL, 2=11.5–12.9 or 16.1–17.0, 4=10.0–11.4 or 17.1–18.0, 8=≤9.9 or ≥18.1
    var wbcPhys: Int = 1             // 1=4–10×10³, 2=10.1–20 or 3.1–3.9, 4=≥20.1 or ≤3.0
    var urea: Int = 1                // 1=<7.5 mmol/L, 2=7.5–10.0, 4=10.1–15.0, 8=≥15.1
    var sodiumPhys: Int = 1          // 1=136–145, 2=131–135 or 146–150, 4=126–130, 8=≤125
    var potassiumPhys: Int = 1       // 1=3.5–5.0, 2=3.2–3.4 or 5.1–5.3, 4=2.9–3.1 or 5.4–5.9, 8=≤2.8 or ≥6.0
    var ecg: Int = 1                 // 1=normal, 2=AF rate 60–90, 4=AF other rate or >5 ectopics, 8=Q waves/ST/BBB
    // MARK: Operative Score (OS) — 6 variables
    var operativeMagnitude: Int = 1  // 1=minor, 2=moderate, 4=major, 8=major+
    var numProcedures: Int = 1       // 1=1, 2=2, 4=≥3
    var bloodLoss: Int = 1           // 1=<100 mL, 2=101–500, 4=501–999, 8=≥1000
    var peritonealSoiling: Int = 1   // 1=none, 2=minor serosal/haematoma, 4=local pus, 8=free bowel content/pus/blood
    var malignancy: Int = 1          // 1=none, 2=primary only, 4=nodal disease, 8=distant metastases
    var urgency: Int = 1             // 1=elective, 4=emergency (>2h resuscitated), 8=emergency (<2h not resuscitated)
}

struct APACHEIIInput: Equatable {
    // APACHE II — Knaus WA et al, Crit Care Med 1985
    // Each field stores the actual APACHE II point contribution for that variable.
    // APS (Acute Physiology Score) = sum of 12 physiological variables.
    // Total APACHE II = APS + age points + chronic health points.
    var tempPoints: Int = 0          // 0=36–38.4°C, 1=38.5–38.9, 2=32–33.9, 3=30–31.9 or 39–40.9, 4=≥41 or ≤29.9
    var mapPoints: Int = 0           // MAP(mmHg): 0=70–109, 2=110–129 or 50–69, 3=130–159, 4=≥160 or ≤49
    var hrPoints: Int = 0            // HR(bpm): 0=70–109, 2=110–139 or 55–69, 3=140–179 or 40–54, 4=≥180 or ≤39
    var rrPoints: Int = 0            // RR(br/min): 0=12–24, 1=10–11 or 25–34, 2=6–9, 3=35–49, 4=≥50 or ≤5
    var oxyPoints: Int = 0           // A-aDO2 or PaO2: 0=none/PaO2>70, 1=PaO2 61–70, 2=A-a 200–349 or PaO2 55–60, 3=A-a 350–499, 4=A-a≥500 or PaO2<55
    var pHPoints: Int = 0            // Art. pH: 0=7.33–7.49, 1=7.50–7.59, 2=7.25–7.32 or 7.60–7.69, 3=7.15–7.24 or ≥7.70, 4=<7.15
    var sodiumPoints: Int = 0        // Na(mmol/L): 0=130–149, 1=150–154, 2=155–159 or 120–129, 3=160–179 or 111–119, 4=≥180 or ≤110
    var potassiumPoints: Int = 0     // K(mmol/L): 0=3.5–5.4, 1=5.5–5.9 or 3.0–3.4, 2=6.0–6.9 or 2.5–2.9, 4=≥7.0 or <2.5
    var creatininePoints: Int = 0    // Creatinine: 0=53–123µmol/L, 2=124–176 or 44–52, 3=177–309, 4=≥310 or <44 (double if ARF)
    var haematocritPoints: Int = 0   // Hct(%): 0=30–45.9, 1=46–49.9 or 20–29.9, 2=50–59.9, 4=≥60 or <20
    var wbcPoints: Int = 0           // WBC(×10³/mm³): 0=3–14.9, 1=15–19.9 or 1–2.9, 2=20–39.9, 4=≥40 or <1
    var gcs: Int = 15                // Actual GCS 3–15; APACHE II contribution = 15 – gcs
    var agePoints: Int = 0           // 0=≤44yrs, 2=45–54, 3=55–64, 5=65–74, 6=≥75
    var chronicHealthPoints: Int = 0 // 0=none, 2=elective postop, 5=nonop or emergency postop with severe organ insufficiency/immunocompromised
}

struct ForrestInput: Equatable {
    // Forrest Classification (Forrest et al, Lancet 1974; Laine & Peterson, N Engl J Med 1994)
    // Endoscopic stigmata of peptic ulcer bleeding. Single classification grade.
    // grade: 1=Ia(spurting), 2=Ib(oozing), 3=IIa(visible vessel), 4=IIb(adherent clot), 5=IIc(flat spot), 6=III(clean base)
    var grade: Int = 1
}

struct NIHSSInput: Equatable {
    // NIH Stroke Scale (Brott T et al. Stroke 1989;20:864–870)
    // 11 items; total 0–42; higher = more severe
    // 0=no deficit; 1-4=minor; 5-15=moderate; 16-20=moderate-severe; 21-42=severe
    var consciousness: Int = 0        // 0=alert, 1=not alert but arousable, 2=not alert obtunded, 3=unresponsive
    var locQuestions: Int = 0         // answers 2 questions (month, age): 0=both correct, 1=one correct, 2=neither
    var locCommands: Int = 0          // obeys 2 commands (open/close eyes, grip): 0=both, 1=one, 2=neither
    var gazeDeviation: Int = 0        // 0=normal, 1=partial gaze palsy, 2=forced deviation
    var visualFields: Int = 0         // 0=no loss, 1=partial hemianopia, 2=complete hemianopia, 3=bilateral/cortical blindness
    var facialPalsy: Int = 0          // 0=normal, 1=minor, 2=partial, 3=complete
    var motorArmLeft: Int = 0         // 0=no drift, 1=drift <10s, 2=some effort against gravity, 3=no effort against gravity, 4=no movement
    var motorArmRight: Int = 0        // same scale as motorArmLeft
    var motorLegLeft: Int = 0         // 0=no drift, 1=drift <5s, 2=some effort against gravity, 3=no effort, 4=no movement
    var motorLegRight: Int = 0        // same scale as motorLegLeft
    var limbAtaxia: Int = 0           // 0=absent, 1=one limb, 2=two limbs
    var sensory: Int = 0              // 0=normal, 1=mild-moderate loss, 2=severe loss / absent
    var language: Int = 0             // 0=no aphasia, 1=mild aphasia, 2=severe aphasia, 3=mute/global aphasia
    var dysarthria: Int = 0           // 0=normal, 1=mild-moderate, 2=severe / intubated
    var extinction: Int = 0           // 0=no abnormality, 1=inattention one modality, 2=profound hemi-inattention
}

struct EuroScoreIIInput: Equatable {
    // EuroSCORE II — European System for Cardiac Operative Risk Evaluation
    // Nashef SAM et al. Eur J Cardiothorac Surg 2012;41:734–745.
    // Logistic regression; β₀ = −5.324537; predicted mortality = eˣ/(1+eˣ)
    var age: Int = 60                   // actual age in years (continuous variable from 60 up: +0.0285489/yr)
    var female: Bool = false            // female sex: +0.2196434
    var renalImpairment: Int = 0        // 0=none, 1=creatinine 151-176 μmol/L (+0.3541226),
                                        // 2=>176 μmol/L on dialysis (+0.6521653)
    var extracardiacArteriopathy: Bool = false  // claudication, carotid stenosis, prior/planned intervention on aorta etc: +0.5085682
    var poorMobility: Bool = false      // musculoskeletal or neurological limitation: +0.2971552
    var previousCardiacSurgery: Bool = false    // +1.0023510
    var chronicLungDisease: Bool = false         // long-term bronchodilator/steroid use: +0.1886564
    var activeEndocarditis: Bool = false         // on antibiotic therapy at time of surgery: +0.6194522
    var criticalPreoperativeState: Bool = false  // VT/VF/aborted SCD, preop massage, vent before OR, acute renal failure, preop IABP/NO/LVAD: +1.0856296
    var diabetesOnInsulin: Bool = false          // +0.3304052
    var nyhaClass: Int = 0              // 0=I (+0), 1=II (+0.1070545), 2=III (+0.2338955), 3=IV (+0.5718132)
    var ccsClass4Angina: Bool = false   // CCS class IV angina at rest: +0.2218732
    var lvFunction: Int = 0             // 0=good >50% (+0), 1=moderate 31–50% (+0.3196276), 2=poor ≤30% (+1.5169013)
    var recentMI: Bool = false          // within 90 days: +0.5460218
    var pulmonaryHypertension: Int = 0  // 0=none, 1=moderate 31–55 mmHg (+0.6084972), 2=severe >55 mmHg (+1.3765812)
    var urgency: Int = 0                // 0=elective (+0), 1=urgent (+0.4084417), 2=emergency (+0.9361202), 3=salvage (+1.8071808)
    var weightOfIntervention: Int = 0   // 0=isolated CABG (+0), 1=single non-CABG (+0.5521478),
                                        // 2=two procedures (+0.9724533), 3=three or more (+1.6151723)
    var surgeryOnThoracicAorta: Bool = false     // +1.1745886
    var postInfarctSeptalRupture: Bool = false   // +1.4630660
}

struct BarthelInput: Equatable {
    // Barthel Index of Activities of Daily Living (Mahoney & Barthel, Maryland State Med J 1965)
    // 10 items; total 0–100; higher = more independent
    // Severe dependency 0–20, Moderate 21–60, Mild 61–90, Independent 91–100
    var feeding: Int = 0        // 0=unable, 5=needs help, 10=independent
    var bathing: Int = 0        // 0=dependent, 5=independent
    var grooming: Int = 0       // 0=dependent (face/hair/teeth/shaving), 5=independent
    var dressing: Int = 0       // 0=dependent, 5=needs help, 10=independent
    var bowels: Int = 0         // 0=incontinent, 5=occasional accident (<once/week), 10=continent
    var bladder: Int = 0        // 0=incontinent or catheterised, 5=occasional accident (<once/day), 10=continent
    var toiletUse: Int = 0      // 0=dependent, 5=needs help, 10=independent
    var transfers: Int = 0      // 0=unable (no sitting balance), 5=major help, 10=minor help, 15=independent
    var mobility: Int = 0       // 0=immobile, 5=wheelchair independent, 10=walks with help, 15=independent ≥50 m
    var stairs: Int = 0         // 0=unable, 5=needs help, 10=independent
}

struct DASIInput: Equatable {
    // Duke Activity Status Index (Hlatky et al, Am J Cardiol 1989)
    // 12 yes/no functional capacity questions; sum of MET weights; DASI <34 ~ <4 METs (poor functional capacity)
    var takeCareOfSelf: Bool = false         // Can take care of self (eating, dressing, bathing, using toilet) — 2.75 pts
    var walkIndoors: Bool = false            // Can walk indoors on level ground — 1.75 pts
    var walkOneOrTwoBlocks: Bool = false     // Can walk 1–2 blocks on level ground — 2.75 pts
    var climbStairs: Bool = false            // Can climb a flight of stairs or walk up a hill — 5.50 pts
    var runShortDistance: Bool = false       // Can run a short distance — 8.00 pts
    var doLightWork: Bool = false            // Can do light housework (dusting, washing dishes) — 2.70 pts
    var doModerateWork: Bool = false         // Can do moderate housework (vacuuming, sweeping, carrying groceries) — 3.50 pts
    var doHeavyWork: Bool = false            // Can do heavy work (scrubbing floors, moving furniture) — 8.00 pts
    var doYardWork: Bool = false             // Can do yardwork (raking, weeding, pushing mower) — 4.50 pts
    var haveSexualActivity: Bool = false     // Can have sexual activity — 5.25 pts
    var participateInModerateRecreation: Bool = false // Moderate recreational activities (golf, bowling, dancing) — 6.00 pts
    var participateInStrenuous: Bool = false // Strenuous sports (swimming, tennis, football, basketball) — 7.50 pts
}

struct GRACEInput: Equatable {
    // GRACE Score (Granger CB et al, Lancet 2003; Fox KA et al, Eur Heart J 2006)
    // Predicts in-hospital and 6-month mortality after ACS (NSTEMI/STEMI/UA)
    // Uses 8 variables; total score 0–372; categorical thresholds guide risk
    // In-hospital mortality: Low <109 (<1%), Moderate 109-140 (1–3%), High >140 (>3%)
    // 6-month mortality: Low <88 (<3%), Moderate 88-118 (3–8%), High >118 (>8%)
    var ageCategory: Int = 0    // 0=<40 (0), 1=40-49 (18), 2=50-59 (36), 3=60-69 (55), 4=70-79 (73), 5=≥80 (91)
    var heartRate: Int = 0      // 0=<70 (0), 1=70-89 (7), 2=90-109 (13), 3=110-149 (23), 4=150-199 (36), 5=≥200 (46)
    var systolicBP: Int = 0     // 0=<80 (63), 1=80-99 (58), 2=100-119 (47), 3=120-139 (37), 4=140-159 (26), 5=160-199 (11), 6=≥200 (0)
    var creatinine: Int = 0     // 0=0-0.39 (2), 1=0.4-0.79 (5), 2=0.8-1.19 (8), 3=1.2-1.59 (11), 4=1.6-1.99 (14), 5=2.0-3.99 (23), 6=≥4.0 (31)
    var killipClass: Int = 0    // 0=I no CHF (0), 1=II rales/JVD (21), 2=III pulm oedema (43), 3=IV cardiogenic shock (64)
    var cardiacArrest: Bool = false  // at admission (+43)
    var elevatedMarkers: Bool = false // elevated cardiac enzymes/markers (+15)
    var stDeviation: Bool = false     // ST-segment deviation (+30)
}

struct SurgicalApgarInput: Equatable {
    // Surgical Apgar Score (Gawande et al, J Am Coll Surg 2007; Regenbogen et al, Ann Surg 2010)
    // Three intraoperative parameters; score 0–10; higher = lower risk
    // 0–2: very high risk, 3–4: high risk, 5–6: moderate, 7–8: low, 9–10: very low
    var estimatedBloodLoss: Int = 0  // 0=>1000 mL (+0), 1=601-1000 (+1), 2=101-600 (+2), 3=≤100 (+3)
    var lowestMAP: Int = 0           // 0=<40 (+0), 1=40-54 (+1), 2=55-69 (+2), 3=≥70 (+3)
    var lowestHeartRate: Int = 0     // 0=≥120 or <40 (+0), 1=101-119 (+0→use 1 pt), 2=86-100 (+1), 3=56-85 (+3), 4=41-55 (+2), 5=≤40 (+0)
}

struct WaterlowInput: Equatable {
    // Waterlow Pressure Ulcer Risk Assessment (Waterlow J, Nursing Times 1985; revised 2005)
    // Composite risk score from build/weight, skin type, sex/age, mobility, continence,
    // appetite, and special risk factors
    var buildWeight: Int = 0       // 0=average, 1=above average, 2=obese, 3=below average
    var skinType: Int = 0          // 0=healthy, 1=tissue paper, 2=dry, 3=oedematous, 4=clammy/pyrexia, 5=discoloured, 6=broken/spot
    var sexAge: Int = 0            // 0=male 14-49, 1=female 14-49/male 50-64, 2=female 50-64/male 65-74, 3=female 65-74/male 75-80, 4=female 75-80, 5=81+
    var mobility: Int = 0          // 0=fully mobile, 1=restless/fidgety, 2=apathetic, 3=restricted, 4=inert/traction, 5=chairbound
    var continence: Int = 0        // 0=complete/catheterised, 1=occasionally incontinent, 2=catheterised/incontinent faeces, 3=doubly incontinent
    var appetite: Int = 0          // 0=average, 1=poor, 2=NG tube/fluids only, 3=NBM/anorexic
    // Special risk factors (additive)
    var tissuemalnutrition: Bool = false   // cachexia, terminal/cardiac failure, peripheral vascular, anaemia, smoking
    var neurologicalDeficit: Bool = false  // diabetic/motor/sensory/paraplegia (score +4–6)
    var majorSurgery: Bool = false         // orthopaedic below waist / spinal >2 h table, score +5
    var onCytotoxics: Bool = false         // high-dose steroids / cytotoxic agents
}

struct TIMIInput: Equatable {
    // TIMI Risk Score for UA/NSTEMI (Antman et al, JAMA 2000)
    // 7 binary risk factors; score 0–7; predicts 14-day composite endpoint
    var ageOver65: Bool = false         // age ≥65 years
    var threeOrMoreRiskFactors: Bool = false // ≥3 CAD risk factors (FH, HTN, hypercholesterolaemia, DM, active smoker)
    var priorCoronaryArteryStenosis: Bool = false // known CAD: prior coronary stenosis ≥50%
    var stDeviationOnECG: Bool = false  // ST-segment deviation on presenting ECG
    var twoOrMoreAnginalEvents: Bool = false // ≥2 anginal events in prior 24 h
    var aspirinUseInLast7Days: Bool = false  // aspirin use in the prior 7 days (despite aspirin)
    var elevatedCardiacMarkers: Bool = false // elevated serum cardiac markers (troponin or CK-MB)
}

struct ClinicalFrailtyInput: Equatable {
    // Clinical Frailty Scale (Rockwood et al, CMAJ 2005; Rockwood et al, Lancet 2019)
    // 9-level ordinal scale assessing functional capacity and frailty in adults ≥65
    // level: 1=very fit, 2=fit, 3=managing well, 4=vulnerable, 5=mildly frail,
    //        6=moderately frail, 7=severely frail, 8=very severely frail, 9=terminally ill
    var level: Int = 1
}

struct MallampatiInput: Equatable {
    // Mallampati Classification (Mallampati et al, Can Anaesth Soc J 1985; Samsoon & Young, Anaesthesia 1987)
    // Airway classification for anticipated difficulty of laryngoscopy / intubation (modified Mallampati)
    // class: 1=full visibility (soft palate/uvula/pillars), 2=soft palate/uvula only, 3=soft palate/base of uvula, 4=soft palate not visible
    var mallampatiClass: Int = 1
    // Additional predictors
    var mouthOpening: Bool = false     // reduced mouth opening (<4 cm inter-incisor distance)
    var neckMobility: Bool = false     // reduced neck extension (<80°)
    var thyromental: Bool = false      // short thyromental distance (<6 cm / <3 FB)
    var retrognathia: Bool = false     // micrognathia / retrognathia
    var obesity: Bool = false          // BMI ≥30 or neck circumference ≥40 cm
    var beardOrDentures: Bool = false  // beard or poorly-fitting dentures (mask seal/grade uncertainty)
}

struct HEARTInput: Equatable {
    // HEART Score (Backus et al, Neth Heart J 2010; Six et al, AHJ 2008)
    // Chest pain risk stratification: History, ECG, Age, Risk factors, Troponin
    // Each domain scored 0–2; total 0–10; ≤3=low risk, 4–6=moderate, ≥7=high
    var history: Int = 0        // 0=slightly suspicious, 1=moderately suspicious, 2=highly suspicious
    var ecg: Int = 0            // 0=normal, 1=non-specific repolarisation, 2=significant ST deviation
    var ageScore: Int = 0       // 0=<45, 1=45–64, 2=≥65
    var riskFactors: Int = 0    // 0=no known risk, 1=1–2 risk factors / obesity / atherosclerosis, 2=≥3 risk factors / known atherosclerotic disease
    var troponin: Int = 0       // 0=≤normal limit, 1=1–3× normal, 2=>3× normal
}

struct NRS2002Input: Equatable {
    // Nutritional Risk Screening 2002 (Kondrup et al, Clin Nutr 2003)
    // Total score = nutritionalStatus (0–3) + diseaseSeverity (0–3) + ageAdj (0–1). ≥3 = at risk.
    var nutritionalStatus: Int = 0  // 0=normal, 1=mild (wt loss 5–10% in 3m or intake 50–75%), 2=moderate (wt loss 5% in 2m or BMI 18.5–20.5 or intake 25–60%), 3=severe (wt loss >5% in 1m/BMI<18.5/intake<25%)
    var diseaseSeverity: Int = 0    // 0=absent, 1=minor (hip Fx, ChemRx, chronic disease), 2=moderate (major abdo Sx, stroke, haem malignancy, ICU APACHE<10), 3=severe (head injury, BMT, ICU APACHE≥10)
    var ageOver70: Bool = false     // +1 if ≥70 years
}

struct CTSIInput: Equatable {
    // Balthazar CT Severity Index (Balthazar et al, Radiology 1990)
    // Balthazar grade (A=0, B=1, C=2, D=3, E=4) + necrosis score (0/2/4/6). Total 0–10.
    var balthazarGrade: Int = 0  // 0=A(normal), 1=B(oedema), 2=C(fat stranding), 3=D(single collection), 4=E(≥2 or gas)
    var necrosisScore: Int = 0   // 0=none, 2=<33%, 4=33-50%, 6=>50%
}

struct MPIInput: Equatable {
    // Mannheim Peritonitis Index (Wacha & Linder, Theor Surg 1983)
    // 8 variables; score 0–47. <21=low, 21–29=intermediate, ≥30=high mortality.
    var ageOver50: Bool = false           // +5
    var femaleSex: Bool = false           // +5
    var organFailure: Bool = false        // +7 — BP <80 mmHg, Cr >177 µmol/L, or resp failure
    var malignancy: Bool = false          // +4
    var durationOver24h: Bool = false     // +4 — pre-op peritonitis >24 h
    var nonColonicOrigin: Bool = false    // +4 — gastric / duodenal / small bowel source
    var generalizedPeritonitis: Bool = false // +6 — diffuse four-quadrant peritonitis
    var exudate: Int = 0                  // 0=clear/serous, 6=cloudy/purulent, 12=faecal
}

struct SOFAInput: Equatable {
    // Sequential Organ Failure Assessment (Sepsis-3, JAMA 2016)
    // Each domain scored 0–4; total 0–24
    var respiration: Int = 0    // PaO₂/FiO₂ mmHg: 0=≥400, 1=300-399, 2=200-299+resp, 3=100-199+resp, 4=<100+resp
    var coagulation: Int = 0    // Platelets ×10³/µL: 0=≥150, 1=100-149, 2=50-99, 3=20-49, 4=<20
    var liver: Int = 0          // Bilirubin µmol/L: 0=<20, 1=20-32, 2=33-101, 3=102-204, 4=>204
    var cardiovascular: Int = 0 // MAP/vasopressors: 0=MAP≥70, 1=MAP<70, 2=dopa≤5/dobu, 3=dopa5-15/NA≤0.1, 4=dopa>15/NA>0.1
    var cns: Int = 0            // GCS: 0=15, 1=13-14, 2=10-12, 3=6-9, 4=<6
    var renal: Int = 0          // Creatinine µmol/L: 0=<110, 1=110-170, 2=171-299, 3=300-440/UO<500, 4=>440/UO<200
}

struct FIB4Input: Equatable {
    // FIB-4 Liver Fibrosis Index (Sterling et al, Hepatology 2006)
    // Formula: (age × AST) ÷ (platelets × √ALT)
    var age: Int = 40
    var astIUL: Double = 30.0           // AST in IU/L
    var platelet10_9L: Double = 200.0   // Platelets in 10⁹/L (e.g. 200 = 200,000/µL)
    var altIUL: Double = 30.0           // ALT in IU/L
}

struct PSIPortInput: Equatable {
    // PSI/PORT — Community-Acquired Pneumonia severity (Fine et al, NEJM 1997)
    // Demographic
    var ageMale: Int = 0              // age in years (for males)
    var ageFemale: Int = 0            // age - 10 (for females; pass actual age - 10)
    var nursingHomeResident: Bool = false      // +10
    // Comorbidities
    var neoplasticDisease: Bool = false        // +30
    var liverDisease: Bool = false             // +20
    var congestiveHeartFailure: Bool = false   // +10
    var cerebrovascularDisease: Bool = false   // +10
    var renalDisease: Bool = false             // +10
    // Physical exam
    var alteredMentalStatus: Bool = false      // +20
    var respiratoryRateOver30: Bool = false    // +20
    var systolicBPUnder90: Bool = false        // +20
    var tempUnder35orOver40: Bool = false      // +15 (< 35°C or ≥ 40°C)
    var heartRateOver125: Bool = false         // +10
    // Lab / imaging
    var arterialPHUnder735: Bool = false       // +30
    var bunOver11mmoL: Bool = false            // +20 (BUN ≥11 mmol/L)
    var sodiumUnder130: Bool = false           // +20
    var glucoseOver14: Bool = false            // +10
    var haematocritUnder30: Bool = false       // +10
    var pao2Under60orSpO2Under90: Bool = false // +10
    var pleuralEffusion: Bool = false          // +10
}

// MARK: - ClinicalScoringEngine

enum ClinicalScoringEngine {}
