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
    let maxScore: Double
    let risk: ScoreRisk
    let interpretation: String   // concise clinical meaning of this score
    let recommendations: [String]
    let items: [ScoredItem]
    let redFlags: [String]
    let evidenceNote: String?    // guideline reference
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

enum ClinicalScoringEngine {

    // MARK: Alvarado (Appendicitis)

    static func alvarado(_ i: AlvaradoInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Pain migration to RIF", points: 1, present: i.migrationToRIF),
            .init(label: "Anorexia", points: 1, present: i.anorexia),
            .init(label: "Nausea / vomiting", points: 1, present: i.nauseaVomiting),
            .init(label: "Tenderness in RIF", points: 2, present: i.tendernessRIF),
            .init(label: "Rebound tenderness", points: 1, present: i.reboundTenderness),
            .init(label: "Elevated temperature ≥37.3°C", points: 1, present: i.elevatedTemperature),
            .init(label: "WBC >10,000/μL", points: 2, present: i.wbcElevated),
            .init(label: "Neutrophilia >75%", points: 1, present: i.neutrophiliaShift),
        ]
        let score = items.filter(\.present).reduce(0) { $0 + $1.points }

        let (risk, interpretation) = alvaradoRisk(score)

        var recs: [String] = []
        var redFlags: [String] = []
        switch risk {
        case .low:
            recs = ["Observe / discharge with analgesia and strict return precautions",
                    "Repeat clinical assessment in 4–6 h if borderline"]
        case .moderate:
            recs = ["Surgical review", "IV access + analgesia", "FBC, CRP, U&E, LFT, urinalysis",
                    "Abdominal USS (or CT if USS equivocal)", "Nil by mouth if surgical route likely"]
        case .high, .critical:
            recs = ["Urgent surgical review — likely appendicitis",
                    "IV access + fluid resuscitation + analgesia",
                    "CT abdomen/pelvis if USS equivocal",
                    "Prophylactic antibiotics (co-amoxiclav or cefuroxime + metronidazole) before theatre",
                    "Consented for laparoscopic appendicectomy"]
            if risk == .critical {
                redFlags.append("Score ≥9 — surgical emergency; risk of perforation")
            }
        }

        return ClinicalScore(
            systemName: "Alvarado Score",
            abbreviation: "MANTRELS",
            score: score, maxScore: 10,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Alvarado 1986. Score ≤4: unlikely appendicitis; 5–6: possible; 7–8: probable; 9–10: very probable."
        )
    }

    private static func alvaradoRisk(_ s: Double) -> (ScoreRisk, String) {
        switch s {
        case ..<5:  return (.low,      "Score \(Int(s))/10 — appendicitis unlikely")
        case 5..<7: return (.moderate, "Score \(Int(s))/10 — appendicitis possible; imaging recommended")
        default:    return (.high,     "Score \(Int(s))/10 — appendicitis probable/very probable; surgical review")
        }
    }

    // MARK: Tokyo Guidelines 2018 — Acute Cholecystitis

    static func tokyoCholecystitis(_ i: TokyoCholecystitisInput) -> ClinicalScore {
        let hasGradeIIIOrgan = i.cardiovascularDysfunction || i.neurologicalDysfunction ||
                               i.respiratoryDysfunction || i.renalDysfunction ||
                               i.hepaticDysfunction || i.haematologicalDysfunction
        let hasGradeII = i.wbcAbove18 || i.durationOver72h || i.markedLocalInflammation

        let grade: Int
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        if hasGradeIIIOrgan {
            grade = 3; risk = .critical
            interpretation = "Tokyo Grade III — Severe acute cholecystitis with organ dysfunction"
            redFlags = ["Organ dysfunction present — ICU-level care required",
                        "Urgent biliary drainage and source control"]
            recs = ["ICU / HDU admission", "IV antibiotics (piperacillin-tazobactam or meropenem)",
                    "Early urgent cholecystostomy or emergency cholecystectomy",
                    "Treat organ dysfunction concurrently", "Anaesthetic / critical care review"]
        } else if hasGradeII {
            grade = 2; risk = .high
            interpretation = "Tokyo Grade II — Moderate acute cholecystitis; early laparoscopic cholecystectomy within 72 h"
            recs = ["IV antibiotics (co-amoxiclav or cefuroxime + metronidazole)",
                    "Early laparoscopic cholecystectomy within 72 h (if fit)",
                    "ERCP or MRCP if bile duct stones suspected",
                    "HDU monitoring if WBC markedly elevated or haemodynamically unstable"]
        } else if i.localInflammationSignsMild {
            grade = 1; risk = .low
            interpretation = "Tokyo Grade I — Mild acute cholecystitis; elective or early laparoscopic cholecystectomy"
            recs = ["Oral or IV antibiotics (if febrile)",
                    "Analgesia + IV fluids",
                    "Elective laparoscopic cholecystectomy (or early if patient fit and ward allows)",
                    "USS biliary tree to exclude choledocholithiasis"]
        } else {
            grade = 0; risk = .low
            interpretation = "Criteria for acute cholecystitis not met — consider biliary colic or other diagnosis"
            recs = ["Biliary USS to confirm", "Analgesia", "Low-fat diet advice"]
        }

        let items: [ScoredItem] = [
            .init(label: "Local inflammation signs", points: 1, present: i.localInflammationSignsMild),
            .init(label: "WBC >18,000", points: 1, present: i.wbcAbove18),
            .init(label: "Duration >72 h", points: 1, present: i.durationOver72h),
            .init(label: "Marked local inflammation (gangrenous / peritonitis)", points: 2, present: i.markedLocalInflammation),
            .init(label: "Cardiovascular dysfunction", points: 3, present: i.cardiovascularDysfunction),
            .init(label: "Neurological dysfunction", points: 3, present: i.neurologicalDysfunction),
            .init(label: "Respiratory dysfunction", points: 3, present: i.respiratoryDysfunction),
            .init(label: "Renal dysfunction", points: 3, present: i.renalDysfunction),
            .init(label: "Hepatic dysfunction (INR >1.5)", points: 3, present: i.hepaticDysfunction),
            .init(label: "Haematological dysfunction (Plt <100k)", points: 3, present: i.haematologicalDysfunction),
        ]

        return ClinicalScore(
            systemName: "Acute Cholecystitis Severity",
            abbreviation: "Tokyo 2018",
            score: Double(grade), maxScore: 3,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Tokyo Guidelines 2018 (TG18). Grades I–III guide urgency of cholecystectomy."
        )
    }

    // MARK: Tokyo Guidelines 2018 — Acute Cholangitis

    static func tokyoCholangitis(_ i: TokyoCholangitisInput) -> ClinicalScore {
        let hasGradeIIIOrgan = i.cardiovascularDysfunction || i.neurologicalDysfunction ||
                               i.respiratoryDysfunction || i.renalDysfunction ||
                               i.hepaticDysfunction || i.haematologicalDysfunction
        let gradeIICount = [i.wbcAbove12OrBelow4, i.temperatureAbove39,
                            i.ageAbove75, i.bilirubinAbove5, i.albuminBelow0_7xLLN].filter { $0 }.count

        let grade: Int
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        if hasGradeIIIOrgan {
            grade = 3; risk = .critical
            interpretation = "Tokyo Grade III — Severe acute cholangitis with organ dysfunction"
            redFlags = ["Urgent biliary drainage (ERCP) is life-saving",
                        "Organ dysfunction — ICU-level care"]
            recs = ["Emergency ERCP with sphincterotomy and stone extraction / stent",
                    "IV antibiotics (meropenem or piperacillin-tazobactam)",
                    "ICU admission", "Critical care / hepatobiliary surgical review",
                    "Blood cultures × 2 before antibiotics"]
        } else if gradeIICount >= 1 {
            grade = 2; risk = .high
            interpretation = "Tokyo Grade II — Moderate acute cholangitis; urgent ERCP within 24–48 h"
            recs = ["IV antibiotics (co-amoxiclav or cefuroxime + metronidazole)",
                    "Urgent ERCP within 24–48 h",
                    "Admit for IV hydration and monitoring",
                    "Blood cultures × 2 before antibiotics",
                    "MRCP if ERCP contraindicated"]
        } else if i.cholangitisConfirmed {
            grade = 1; risk = .low
            interpretation = "Tokyo Grade I — Mild acute cholangitis; respond to initial medical treatment"
            recs = ["IV antibiotics with close observation",
                    "Elective ERCP within 72 h if stable",
                    "Monitor for deterioration to Grade II/III"]
        } else {
            grade = 0; risk = .low
            interpretation = "Charcot's triad not met — consider biliary colic or other hepatobiliary cause"
            recs = ["MRCP or USS to investigate biliary tree", "Liver function tests"]
        }

        let items: [ScoredItem] = [
            .init(label: "Cholangitis confirmed (fever / Charcot's / imaging)", points: 1, present: i.cholangitisConfirmed),
            .init(label: "WBC >12 or <4 ×10⁹/L", points: 1, present: i.wbcAbove12OrBelow4),
            .init(label: "Temperature >39°C", points: 1, present: i.temperatureAbove39),
            .init(label: "Age >75", points: 1, present: i.ageAbove75),
            .init(label: "Bilirubin >5 mg/dL (>85 μmol/L)", points: 1, present: i.bilirubinAbove5),
            .init(label: "Albumin <0.7 × LLN", points: 1, present: i.albuminBelow0_7xLLN),
            .init(label: "Cardiovascular dysfunction", points: 3, present: i.cardiovascularDysfunction),
            .init(label: "Neurological dysfunction", points: 3, present: i.neurologicalDysfunction),
            .init(label: "Respiratory dysfunction", points: 3, present: i.respiratoryDysfunction),
            .init(label: "Renal dysfunction", points: 3, present: i.renalDysfunction),
            .init(label: "Hepatic dysfunction (INR >1.5)", points: 3, present: i.hepaticDysfunction),
            .init(label: "Haematological dysfunction (Plt <100k)", points: 3, present: i.haematologicalDysfunction),
        ]

        return ClinicalScore(
            systemName: "Acute Cholangitis Severity",
            abbreviation: "Tokyo 2018",
            score: Double(grade), maxScore: 3,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Tokyo Guidelines 2018 (TG18). Grade III: emergency ERCP is life-saving."
        )
    }

    // MARK: Ranson Criteria (Pancreatitis)

    static func ranson(_ i: RansonInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Age >55 years", points: 1, present: i.ageOver55),
            .init(label: "WBC >16,000/μL (admission)", points: 1, present: i.wbcOver16k),
            .init(label: "Glucose >11 mmol/L (admission)", points: 1, present: i.glucoseOver200),
            .init(label: "LDH >350 IU/L (admission)", points: 1, present: i.ldhOver350),
            .init(label: "AST >250 IU/L (admission)", points: 1, present: i.astOver250),
            .init(label: "Haematocrit fall >10% (48 h)", points: 1, present: i.hctFallOver10),
            .init(label: "BUN rise >1.8 mmol/L (48 h)", points: 1, present: i.bunRiseOver5),
            .init(label: "Calcium <2 mmol/L (48 h)", points: 1, present: i.calciumBelow8),
            .init(label: "PaO₂ <60 mmHg (48 h)", points: 1, present: i.pao2Below60),
            .init(label: "Base deficit >4 mEq/L (48 h)", points: 1, present: i.baseDeficitOver4),
            .init(label: "Fluid sequestration >6 L (48 h)", points: 1, present: i.fluidSequestrationOver6L),
        ]
        let score = Double(items.filter(\.present).count)

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        switch score {
        case ..<3:
            risk = .low
            interpretation = "Ranson \(Int(score))/11 — Mild pancreatitis; mortality <5%"
            recs = ["IV fluids (aggressive crystalloid resuscitation — 250–500 mL/h initially)",
                    "Analgesia (morphine IV)", "Nil by mouth initially",
                    "Monitor FBC, U&E, LFT, calcium, glucose every 12–24 h",
                    "Reintroduce clear fluids when pain resolving and bowel sounds present"]
        case 3..<6:
            risk = .high
            interpretation = "Ranson \(Int(score))/11 — Moderate-to-severe pancreatitis; mortality ~15%"
            recs = ["HDU admission", "Aggressive IV fluids (target urine output >0.5 mL/kg/h)",
                    "Analgesia (morphine IV or epidural)", "Nil by mouth",
                    "MRCP / USS to assess biliary aetiology",
                    "Early ERCP if gallstone pancreatitis + cholangitis within 24–72 h",
                    "Nutritional support: NG/NJ feeding within 48–72 h if unable to eat",
                    "CT abdomen at 48–72 h to assess necrosis (modified CT severity index)",
                    "Daily FBC, U&E, calcium, LFT, glucose, CRP, coagulation"]
            redFlags = ["Consider ICU if haemodynamically unstable"]
        default:
            risk = .critical
            interpretation = "Ranson \(Int(score))/11 — Severe pancreatitis; mortality >50%"
            redFlags = ["Mortality risk >50% — ITU admission essential",
                        "High risk of pancreatic necrosis and multi-organ failure"]
            recs = ["ITU admission", "Aggressive fluid resuscitation with goal-directed therapy",
                    "Vasopressors if haemodynamically compromised", "Invasive monitoring",
                    "Early ERCP within 24 h if biliary aetiology + cholangitis",
                    "CT abdomen with contrast (CTSI) at 48–72 h — assess extent of necrosis",
                    "Broad-spectrum IV antibiotics only if infected necrosis suspected (imipenem or meropenem)",
                    "Nasojejunal feeding: commence within 24–48 h",
                    "Surgery (necrosectomy) only if infected necrosis — delay ≥3–4 weeks"]
        }

        return ClinicalScore(
            systemName: "Ranson Criteria",
            abbreviation: "Ranson",
            score: score, maxScore: 11,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Ranson 1974. Score ≥3 = severe; ≥6 = critical. Requires 48 h to complete."
        )
    }

    // MARK: Glasgow Pancreatitis Score

    static func glasgowPancreatitis(_ i: GlasgowPancreatitisInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "PaO₂ <60 mmHg", points: 1, present: i.pao2Below60),
            .init(label: "Age >55 years", points: 1, present: i.ageOver55),
            .init(label: "Neutrophils (WBC) >15×10⁹/L", points: 1, present: i.wbcOver15k),
            .init(label: "Calcium <2 mmol/L", points: 1, present: i.calciumBelow2),
            .init(label: "Urea >16 mmol/L", points: 1, present: i.ureaOver16),
            .init(label: "LDH >600 IU/L or AST >200 IU/L", points: 1, present: i.ldhOver600OrAstOver200),
            .init(label: "Albumin <32 g/L", points: 1, present: i.albuminBelow32),
            .init(label: "Glucose >10 mmol/L", points: 1, present: i.glucoseOver10),
        ]
        let score = Double(items.filter(\.present).count)
        let severe = score >= 3

        return ClinicalScore(
            systemName: "Glasgow Pancreatitis Score",
            abbreviation: "PANCREAS",
            score: score, maxScore: 8,
            risk: severe ? (score >= 5 ? .critical : .high) : .low,
            interpretation: severe
                ? "Glasgow \(Int(score))/8 — Severe acute pancreatitis"
                : "Glasgow \(Int(score))/8 — Predicted mild pancreatitis",
            recommendations: severe
                ? ["HDU/ITU admission", "Aggressive IV fluid resuscitation",
                   "CT abdomen at 48–72 h", "Nutritional support within 48 h",
                   "ERCP within 72 h if biliary aetiology + cholangitis"]
                : ["IV fluids + analgesia", "Nil by mouth initially",
                   "Monitor closely — repeat score at 48 h"],
            items: items,
            redFlags: severe ? ["Score ≥3 at 48 h — criteria for severe pancreatitis met"] : [],
            evidenceNote: "Glasgow/Imrie Score (Blamey 1984). Assessed at 48 h. ≥3 = severe."
        )
    }

    // MARK: Rockall Score (Upper GI Bleed)

    static func rockall(_ i: RockallInput) -> ClinicalScore {
        var scoreItems: [ScoredItem] = []
        var total: Double = 0

        // Age
        let agePoints = Double(i.ageGroup.rawValue)
        scoreItems.append(.init(label: ageLabel(i.ageGroup), points: agePoints, present: agePoints > 0))
        total += agePoints

        // Shock
        let shockPoints = Double(i.shock.rawValue)
        scoreItems.append(.init(label: shockLabel(i.shock), points: shockPoints, present: shockPoints > 0))
        total += shockPoints

        // Comorbidity
        let comorbPoints = Double(i.comorbidity.rawValue)
        scoreItems.append(.init(label: comorbLabel(i.comorbidity), points: comorbPoints, present: comorbPoints > 0))
        total += comorbPoints

        // Endoscopy findings
        let dxPoints = Double(i.diagnosis.rawValue)
        scoreItems.append(.init(label: diagnosisLabel(i.diagnosis), points: dxPoints, present: dxPoints > 0))
        total += dxPoints

        let stigPoints: Double = i.majorStigmata ? 2 : 0
        scoreItems.append(.init(label: "Major stigmata of haemorrhage (active bleed / visible vessel / adherent clot)", points: 2, present: i.majorStigmata))
        total += stigPoints

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        switch total {
        case ..<2:
            risk = .low
            interpretation = "Rockall \(Int(total)) — Low risk; rebleeding <5%, mortality <0.1%"
            recs = ["Consider same-day/next-day discharge after endoscopy if haemostasis confirmed",
                    "PPI (omeprazole 20 mg OD) if peptic ulcer",
                    "Outpatient follow-up within 2 weeks",
                    "H. pylori test and treat"]
        case 2..<5:
            risk = .moderate
            interpretation = "Rockall \(Int(total)) — Moderate risk; rebleeding ~15%, mortality ~4%"
            recs = ["Admit for observation post-endoscopy", "IV PPI (omeprazole 80 mg bolus then 8 mg/h × 72 h) if high-risk ulcer",
                    "Repeat endoscopy if rebleeding", "Transfuse to Hb 70–80 g/L (90 in cardiac disease)",
                    "Correct coagulopathy"]
        case 5..<8:
            risk = .high
            interpretation = "Rockall \(Int(total)) — High risk; rebleeding >40%, mortality >14%"
            recs = ["ITU / HDU admission", "Resuscitation: cross-match ×4 units, FFP, platelets",
                    "IV PPI infusion", "Repeat endoscopy ± haemostasis",
                    "IR angioembolisation if endoscopy fails",
                    "Emergency surgery if all else fails"]
        default:
            risk = .critical
            interpretation = "Rockall \(Int(total)) — Critical risk; very high in-hospital mortality"
            redFlags = ["Score ≥8 — extremely high risk of in-hospital mortality"]
            recs = ["Immediate ITU admission", "Resuscitation: cross-match ≥6 units, FFP, platelets",
                    "Emergency endoscopy with haemostasis", "IR angioembolisation on standby",
                    "Emergency surgery if all else fails", "Palliative discussion if patient unfit for intervention"]
        }

        return ClinicalScore(
            systemName: "Rockall Score",
            abbreviation: "Rockall",
            score: total, maxScore: 11,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: scoreItems,
            redFlags: redFlags,
            evidenceNote: "Rockall 1996. Pre-endoscopy max = 7; post-endoscopy max = 11."
        )
    }

    private static func ageLabel(_ a: RockallInput.AgeGroup) -> String {
        switch a { case .under60: "Age <60 (0 pts)" ; case .sixtyTo79: "Age 60–79 (1 pt)"; case .over80: "Age ≥80 (2 pts)" }
    }
    private static func shockLabel(_ s: RockallInput.ShockStatus) -> String {
        switch s { case .none: "No shock (0 pts)"; case .pulse100SBPOver100: "HR >100, SBP ≥100 (1 pt)"; case .sbpBelow100: "SBP <100 (2 pts)" }
    }
    private static func comorbLabel(_ c: RockallInput.Comorbidity) -> String {
        switch c { case .none: "No comorbidity (0 pts)"; case .anyMajor: "CCF / IHD / major comorbidity (2 pts)"; case .renalOrLiverOrMalignancy: "Renal failure / liver failure / malignancy (3 pts)" }
    }
    private static func diagnosisLabel(_ d: RockallInput.EndoscopyDiagnosis) -> String {
        switch d { case .malloryWeissOrNoLesion: "Mallory-Weiss / no lesion (0 pts)"; case .allOtherDiagnoses: "Other diagnosis (1 pt)"; case .upperGIMalignancy: "Upper GI malignancy (2 pts)" }
    }

    // MARK: SIRS Criteria (Sepsis)

    static func sirs(_ i: SIRSInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Temp >38°C or <36°C", points: 1, present: i.tempAbove38OrBelow36),
            .init(label: "Heart rate >90 bpm", points: 1, present: i.heartRateOver90),
            .init(label: "RR >20/min or PaCO₂ <32 mmHg", points: 1, present: i.rrOver20OrPaCO2Below32),
            .init(label: "WBC >12,000, <4,000 or >10% bands", points: 1, present: i.wbcOver12kOrBelow4kOr10PctBands),
        ]
        let score = Double(items.filter(\.present).count)
        let hasSepsis = score >= 2 && i.suspectedInfection

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        if hasSepsis && i.positiveBloodCulture {
            risk = .critical
            interpretation = "SIRS \(Int(score))/4 — Sepsis with confirmed bacteraemia"
            redFlags = ["Confirmed bacteraemia — target 1-hour bundle completion",
                        "Reassess for septic shock (SBP <90 or MAP <65 mmHg)"]
            recs = ["IV antibiotics within 1 h (blood cultures FIRST)",
                    "IV fluid bolus 30 mL/kg crystalloid over 3 h if MAP <65 or lactate ≥4",
                    "Vasopressors (noradrenaline) if MAP <65 despite fluids",
                    "ICU referral", "Source identification and control",
                    "Repeat lactate if initial ≥2 mmol/L"]
        } else if hasSepsis {
            risk = .high
            interpretation = "SIRS \(Int(score))/4 + suspected infection = Sepsis"
            redFlags = ["Sepsis — time-critical. Start 1-hour bundle"]
            recs = ["Blood cultures × 2 (peripheral + any indwelling line) before antibiotics",
                    "IV antibiotics within 1 h of recognition (co-amoxiclav + gentamicin or tazocin)",
                    "IV crystalloid 30 mL/kg if lactate ≥4 or haemodynamically unstable",
                    "Serum lactate, FBC, U&E, LFT, coagulation, blood gas",
                    "HDU / ITU referral if organ dysfunction (creatinine ↑, bilirubin ↑, platelets ↓)"]
        } else if score >= 2 {
            risk = .moderate
            interpretation = "SIRS \(Int(score))/4 — Systemic inflammatory response (infection not yet confirmed)"
            recs = ["Assess for source of infection (urine, chest, abdomen, wound)",
                    "Blood cultures before empirical antibiotics if infection suspected",
                    "Monitor closely — reassess within 1–2 h"]
        } else {
            risk = .low
            interpretation = "SIRS \(Int(score))/4 — SIRS criteria not met"
            recs = ["Continue monitoring", "Reassess clinically"]
        }

        return ClinicalScore(
            systemName: "SIRS Criteria",
            abbreviation: "SIRS",
            score: score, maxScore: 4,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Bone 1992. ≥2 SIRS criteria + infection = Sepsis. Now supplemented by Sepsis-3 qSOFA."
        )
    }

    // MARK: qSOFA (Sepsis quick screen)

    static func qsofa(_ i: QSOFAInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Altered mentation (GCS <15)", points: 1, present: i.alteredMentation),
            .init(label: "Respiratory rate ≥22/min", points: 1, present: i.rrOver22),
            .init(label: "SBP ≤100 mmHg", points: 1, present: i.sbpUnder100),
        ]
        let score = Double(items.filter(\.present).count)
        let highRisk = score >= 2 && i.suspectedInfection

        var redFlags: [String] = []
        if highRisk { redFlags = ["qSOFA ≥2 + infection — high risk of organ dysfunction (Sepsis-3)"] }

        return ClinicalScore(
            systemName: "qSOFA Score",
            abbreviation: "qSOFA",
            score: score, maxScore: 3,
            risk: (score == 3 && i.suspectedInfection) ? .critical : (highRisk ? .high : (score == 1 ? .moderate : .low)),
            interpretation: score >= 2
                ? "qSOFA \(Int(score))/3 — HIGH risk of organ dysfunction if infection present"
                : "qSOFA \(Int(score))/3 — Lower risk, but reassess if clinical status changes",
            recommendations: score >= 2
                ? ["Urgent clinical review", "Blood cultures + IV antibiotics within 1 h",
                   "Serum lactate, FBC, CRP, U&E", "ICU / HDU referral",
                   "1-hour sepsis bundle: cultures → antibiotics → fluids → lactate"]
                : ["Monitor closely", "Reassess in 1–2 h if clinical concern remains"],
            items: items,
            redFlags: redFlags,
            evidenceNote: "Singer 2016 (Sepsis-3). ≥2 qSOFA points with infection = probable sepsis."
        )
    }

    // MARK: Wells DVT Score

    static func wellsDVT(_ i: WellsDVTInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Active cancer (treatment within 6 months)", points: 1, present: i.activeCancer),
            .init(label: "Paralysis, paresis or recent plaster cast", points: 1, present: i.paralysisParesisPlastercast),
            .init(label: "Bedridden >3 d or surgery within 12 weeks", points: 1, present: i.bedridden3dOrSurgery12w),
            .init(label: "Localised tenderness along deep vein", points: 1, present: i.localizedTendernessDeepVein),
            .init(label: "Entire leg swollen", points: 1, present: i.entireLegSwollen),
            .init(label: "Calf >3 cm larger than asymptomatic side", points: 1, present: i.calfSwellingOver3cm),
            .init(label: "Pitting oedema", points: 1, present: i.pittingOedema),
            .init(label: "Collateral superficial veins (non-varicose)", points: 1, present: i.collateralSuperficialVeins),
            .init(label: "Previously documented DVT", points: 1, present: i.previousDVT),
            .init(label: "Alternative diagnosis equally or more likely", points: -2, present: i.alternativeDiagnosisAsLikely),
        ]
        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []

        if score <= 0 {
            risk = .low
            interpretation = "Wells DVT \(Int(score)) — Low probability (~5%); D-dimer to exclude"
            recs = ["D-dimer: if negative, DVT excluded without USS",
                    "If D-dimer positive → whole-leg compression USS",
                    "Reassess if symptoms change"]
        } else if score <= 2 {
            risk = .moderate
            interpretation = "Wells DVT \(Int(score)) — Moderate probability (~17%); USS recommended"
            recs = ["Whole-leg compression duplex USS",
                    "If USS negative + D-dimer negative → DVT excluded",
                    "If USS negative but D-dimer positive → repeat USS in 1 week",
                    "Anticoagulate if USS positive"]
        } else {
            risk = .high
            interpretation = "Wells DVT \(Int(score)) — High probability (~53%); proceed to USS ± anticoagulate"
            recs = ["Whole-leg compression duplex USS urgently",
                    "Commence LMWH / DOAC while awaiting USS if delays anticipated",
                    "If USS positive → therapeutic anticoagulation (apixaban/rivaroxaban or LMWH)",
                    "If USS negative → D-dimer; if positive, repeat USS in 1 week",
                    "Investigate for malignancy if unprovoked DVT in patient >40"]
        }

        return ClinicalScore(
            systemName: "Wells DVT Score",
            abbreviation: "Wells DVT",
            score: score, maxScore: 9,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: [],
            evidenceNote: "Wells 1997. Score ≤0: low; 1–2: moderate; ≥3: high probability DVT."
        )
    }

    // MARK: Wells PE Score

    static func wellsPE(_ i: WellsPEInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Clinical signs/symptoms of DVT", points: 3, present: i.clinicalSignsDVT),
            .init(label: "PE more likely than alternative diagnosis", points: 3, present: i.alternativeDxLessLikely),
            .init(label: "Heart rate >100 bpm", points: 1.5, present: i.hrOver100),
            .init(label: "Immobilisation or surgery within 4 weeks", points: 1.5, present: i.immobilisationOrSurgery4w),
            .init(label: "Previous DVT / PE", points: 1.5, present: i.previousDVTOrPE),
            .init(label: "Haemoptysis", points: 1, present: i.haemoptysis),
            .init(label: "Active malignancy (treatment within 6 months)", points: 1, present: i.malignancyActive),
        ]
        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        if score <= 1 {
            risk = .low
            interpretation = "Wells PE \(score) — Low probability; D-dimer first"
            recs = ["D-dimer: if negative → PE excluded",
                    "If D-dimer positive → CT pulmonary angiography (CTPA)",
                    "Consider V/Q if contrast allergy or pregnancy"]
        } else if score <= 4 {
            risk = .moderate
            interpretation = "Wells PE \(score) — Moderate probability (~28%); CTPA or D-dimer"
            recs = ["CTPA (preferred) or age-adjusted D-dimer",
                    "If haemodynamically unstable → ECHO bedside / empirical anticoagulation",
                    "LMWH or DOAC while awaiting imaging if high clinical concern"]
        } else {
            risk = .high
            interpretation = "Wells PE \(score) — High probability (>50%); immediate CTPA"
            redFlags = ["High probability PE — anticoagulate empirically while awaiting CTPA",
                        "If haemodynamically unstable: consider thrombolysis or surgical embolectomy"]
            recs = ["Immediate CTPA", "Empirical anticoagulation (LMWH or heparin IV) before imaging if safe",
                    "If massive PE (SBP <90): thrombolysis (alteplase 100 mg IV) or embolectomy",
                    "Cardiology / respiratory / surgery referral",
                    "HDU monitoring: HR, SBP, O₂ sat continuous"]
        }

        return ClinicalScore(
            systemName: "Wells PE Score",
            abbreviation: "Wells PE",
            score: score, maxScore: 12.5,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Wells 2000. Score ≤4: PE unlikely (with negative D-dimer excludes); >4: PE likely, CTPA."
        )
    }

    // MARK: ABCD2 Score (TIA)

    static func abcd2(_ i: ABCD2Input) -> ClinicalScore {
        var items: [ScoredItem] = [
            .init(label: "Age ≥60 years", points: 1, present: i.ageOver60),
            .init(label: "BP ≥140/90 mmHg at presentation", points: 1, present: i.bpOver140_90),
            .init(label: "Unilateral weakness", points: 2, present: i.unilateralWeakness),
            .init(label: "Speech disturbance without weakness", points: 1, present: i.speechWithoutWeakness),
        ]
        let durationPoints: Double
        if i.durationOver60min { durationPoints = 2 }
        else if i.duration10to59min { durationPoints = 1 }
        else { durationPoints = 0 }
        items.append(.init(label: "Duration >60 min (+2) or 10–59 min (+1)", points: durationPoints, present: durationPoints > 0))
        items.append(.init(label: "Diabetes mellitus", points: 1, present: i.diabetes))

        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        switch score {
        case ..<4:
            risk = .low
            interpretation = "ABCD2 \(Int(score))/7 — Low risk; 2-day stroke risk ~1%"
            recs = ["Aspirin 300 mg stat → 75 mg/d", "Statin (atorvastatin 80 mg)",
                    "Urgent outpatient TIA clinic within 24 h",
                    "Carotid duplex USS", "ECG (screen for AF)", "Brain MRI/DWI"]
        case 4...5:
            risk = .moderate
            interpretation = "ABCD2 \(Int(score))/7 — Moderate risk; 2-day stroke risk ~4%"
            recs = ["Same-day specialist TIA review", "Aspirin 300 mg stat → 75 mg/d + clopidogrel 300 mg stat → 75 mg/d (dual for 21 days)",
                    "Atorvastatin 80 mg", "Brain MRI/DWI within 24 h",
                    "Carotid duplex USS same day (carotid endarterectomy within 48 h if ≥50% stenosis)",
                    "24 h ECG / Holter (screen for paroxysmal AF)", "BP control"]
        case 6:
            risk = .high
            interpretation = "ABCD2 \(Int(score))/7 — High risk; 2-day stroke risk ~8%"
            redFlags = ["High stroke risk — requires urgent specialist assessment today",
                        "If in AF → anticoagulate not antiplatelet"]
            recs = ["Admit or same-day specialist TIA assessment",
                    "Aspirin 300 mg stat + clopidogrel 300 mg stat (dual antiplatelet)",
                    "Atorvastatin 80 mg", "MRI brain / DWI within 24 h",
                    "Carotid endarterectomy within 48 h if ≥50% ipsilateral stenosis",
                    "Echocardiography + prolonged cardiac monitoring for AF",
                    "BP target <130/80 mmHg long-term"]
        default:
            risk = .critical
            interpretation = "ABCD2 \(Int(score))/7 — Maximum risk; 2-day stroke risk ~8%"
            redFlags = ["Maximum ABCD2 score — very high early stroke risk",
                        "If in AF → anticoagulate not antiplatelet"]
            recs = ["Immediate specialist assessment / emergency admission",
                    "Aspirin 300 mg stat + clopidogrel 300 mg stat (dual antiplatelet)",
                    "Atorvastatin 80 mg", "MRI brain / DWI urgently",
                    "Carotid endarterectomy within 48 h if ≥50% ipsilateral stenosis",
                    "Echocardiography + prolonged cardiac monitoring for AF",
                    "BP target <130/80 mmHg long-term"]
        }

        return ClinicalScore(
            systemName: "ABCD2 Score",
            abbreviation: "ABCD2",
            score: score, maxScore: 7,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Johnston 2007. Predicts 2-day stroke risk after TIA. Score ≤3: low; 4–5: moderate; 6–7: high."
        )
    }

    // MARK: LRINEC Score (Necrotising Fasciitis)

    static func lrinec(_ i: LRINECInput) -> ClinicalScore {
        var pts: Double = 0
        var items: [ScoredItem] = []

        // CRP
        let crpPts: Double = i.crpOver150 ? 4 : 0
        items.append(.init(label: "CRP >150 mg/L", points: 4, present: i.crpOver150))
        pts += crpPts

        // WBC
        let wbcPts: Double = i.wbcOver25 ? 2 : (i.wbc15to25 ? 1 : 0)
        items.append(.init(label: "WBC 15–25 ×10⁹/L (+1) or >25 (+2)", points: wbcPts, present: wbcPts > 0))
        pts += wbcPts

        // Hb
        let hbPts: Double = i.hbBelow11 ? 2 : (i.hb11to13_5 ? 1 : 0)
        items.append(.init(label: "Hb 11–13.5 g/dL (+1) or <11 (+2)", points: hbPts, present: hbPts > 0))
        pts += hbPts

        // Sodium
        let naPts: Double = i.sodiumBelow135 ? 2 : 0
        items.append(.init(label: "Sodium <135 mmol/L", points: 2, present: i.sodiumBelow135))
        pts += naPts

        // Creatinine
        let crPts: Double = i.creatinineOver177 ? 4 : (i.creatinine141to177 ? 2 : 0)
        items.append(.init(label: "Creatinine 141–177 μmol/L (+2) or >177 (+4)", points: crPts, present: crPts > 0))
        pts += crPts

        // Glucose
        let glucPts: Double = i.glucoseOver10 ? 1 : 0
        items.append(.init(label: "Glucose >10 mmol/L", points: 1, present: i.glucoseOver10))
        pts += glucPts

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        switch pts {
        case ..<6:
            risk = .low
            interpretation = "LRINEC \(Int(pts))/17 — Low probability of NF; consider cellulitis"
            recs = ["IV antibiotics for cellulitis (flucloxacillin + metronidazole)",
                    "Elevate and mark erythema margins", "Repeat clinical exam in 12–24 h",
                    "If rapidly spreading or systemic toxicity → reassess for NF"]
        case 6...7:
            risk = .moderate
            interpretation = "LRINEC \(Int(pts))/17 — Moderate concern; thorough surgical evaluation essential"
            redFlags = ["LRINEC 6–7: increased risk of NF — surgical assessment mandatory"]
            recs = ["Urgent surgical review", "MRI soft tissue (if available) — most sensitive for NF",
                    "IV broad-spectrum antibiotics (meropenem + clindamycin + fluconazole if candida risk)",
                    "If clinical picture convincing → proceed to theatre without waiting for MRI",
                    "Finger test / incision and inspection at bedside to confirm diagnosis"]
        default:
            risk = .critical
            interpretation = "LRINEC \(Int(pts))/17 — High probability of Necrotising Fasciitis (PPV ~92%)"
            redFlags = ["LRINEC ≥8 — NECROTISING FASCIITIS LIKELY. LIFE-THREATENING SURGICAL EMERGENCY.",
                        "Delay to surgery is the primary determinant of mortality",
                        "Every hour of delay increases mortality by ~10%"]
            recs = ["IMMEDIATE surgical debridement — no delays",
                    "Wide excision of all necrotic tissue (Finger test: necrotic fascia, no bleeding, gas)",
                    "IV meropenem 1 g TDS + clindamycin 600 mg TDS + fluconazole 400 mg OD",
                    "ICU post-operatively",
                    "Second-look surgery at 24–48 h (planned relook)",
                    "Consider hyperbaric oxygen if available",
                    "Plastic surgery / reconstructive team involvement early",
                    "Inform next of kin — mortality 20–40% even with early surgery"]
        }

        return ClinicalScore(
            systemName: "LRINEC Score",
            abbreviation: "LRINEC",
            score: pts, maxScore: 17,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Wong 2004. Score ≥6: NF risk. ≥8: high probability (PPV 92%). PPV falls if used non-selectively."
        )
    }

    // MARK: Revised Cardiac Risk Index (RCRI)

    static func rcri(_ i: RCRIInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "High-risk surgery (intraperitoneal / intrathoracic / suprainguinal vascular)", points: 1, present: i.highRiskSurgery),
            .init(label: "Ischaemic heart disease (Hx MI, angina, nitrates, Q-waves)", points: 1, present: i.ischemicHeartDisease),
            .init(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure),
            .init(label: "Cerebrovascular disease (Hx stroke / TIA)", points: 1, present: i.cerebrovascularDisease),
            .init(label: "Insulin-dependent diabetes mellitus", points: 1, present: i.insulinDependentDiabetes),
            .init(label: "Pre-op creatinine >177 μmol/L (>2 mg/dL)", points: 1, present: i.preopCreatinineOver2),
        ]
        let score = Double(items.filter(\.present).count)

        let risk: ScoreRisk
        let maceRisk: String
        var recs: [String] = []

        switch score {
        case 0:
            risk = .low; maceRisk = "~0.4% MACE"
            recs = ["Proceed to surgery", "Standard perioperative monitoring"]
        case 1:
            risk = .low; maceRisk = "~1% MACE"
            recs = ["Proceed to surgery", "Cardiology review if symptomatic", "Standard ECG"]
        case 2:
            risk = .moderate; maceRisk = "~2.4% MACE"
            recs = ["Cardiology pre-op assessment", "Continue beta-blockers and statins perioperatively",
                    "Consider stress testing if active cardiac symptoms",
                    "Post-op troponin monitoring if RCRI ≥2"]
        default:
            risk = .high; maceRisk = ">5% MACE"
            recs = ["Formal cardiology evaluation before elective surgery",
                    "Non-invasive stress testing if functional capacity <4 METs",
                    "Consider coronary revascularisation if appropriate before surgery",
                    "Beta-blockade continuation (do NOT start new beta-blocker <2 d pre-op)",
                    "Perioperative troponin × 2 (at 24 h and 48 h post-op)",
                    "Discuss risk/benefit with patient"]
        }

        return ClinicalScore(
            systemName: "Revised Cardiac Risk Index",
            abbreviation: "RCRI",
            score: score, maxScore: 6,
            risk: risk, interpretation: "RCRI \(Int(score))/6 — Predicted \(maceRisk) (major adverse cardiac event)",
            recommendations: recs, items: items,
            redFlags: score >= 3 ? ["RCRI ≥3: formal cardiology assessment recommended before elective surgery"] : [],
            evidenceNote: "Lee 1999. Validated for major non-cardiac surgery. MACE = MI, cardiac arrest, complete heart block."
        )
    }

    // MARK: Caprini VTE Risk

    static func caprini(_ i: CapriniInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Age >75", points: 3, present: i.ageOver75),
            .init(label: "Age 60–74", points: 2, present: i.age60to74),
            .init(label: "Age 41–59", points: 1, present: i.age41to59),
            .init(label: "Active or prior malignancy", points: 2, present: i.activeOrPriorMalignancy),
            .init(label: "Prior VTE", points: 3, present: i.priorVTE),
            .init(label: "Family history of VTE", points: 3, present: i.familyHistoryVTE),
            .init(label: "Thrombophilia (Factor V, APS, etc.)", points: 3, present: i.thrombophilia),
            .init(label: "Minor surgery (<45 min)", points: 1, present: i.minorSurgery),
            .init(label: "Major open surgery (>45 min)", points: 2, present: i.majorSurgery),
            .init(label: "Laparoscopic surgery (>45 min)", points: 2, present: i.laparoscopicSurgeryOver45min),
            .init(label: "Immobility / bed rest", points: 1, present: i.immobilityBedridden),
            .init(label: "Central venous access", points: 2, present: i.centralVenousAccess),
            .init(label: "Hormonal therapy / OCP", points: 1, present: i.hormonalTherapy),
            .init(label: "Sepsis within 30 days", points: 1, present: i.sepsis30d),
            .init(label: "BMI ≥40 kg/m²", points: 1, present: i.bmi40Plus),
            .init(label: "Stroke (prior)", points: 5, present: i.stroke),
            .init(label: "MI (prior)", points: 5, present: i.mi),
            .init(label: "Spinal cord injury", points: 5, present: i.spinalCordInjury),
            .init(label: "Pelvic fracture / hip or knee replacement", points: 5, present: i.pelvisFractureOrHipKneeReplacement),
            .init(label: "Multiple trauma", points: 5, present: i.multipleTrauma),
        ]
        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let risk: ScoreRisk
        let vteRisk: String
        var recs: [String] = []

        switch score {
        case ..<2:
            risk = .low; vteRisk = "Very low (<0.5%)"
            recs = ["Early ambulation", "No pharmacological prophylaxis needed"]
        case 2...3:
            risk = .low; vteRisk = "Low (~1.5%)"
            recs = ["Mechanical prophylaxis (TED stockings + pneumatic compression device)",
                    "LMWH if bleeding risk acceptable (LMWH enoxaparin 40 mg OD)"]
        case 4...5:
            risk = .moderate; vteRisk = "Moderate (~3%)"
            recs = ["LMWH enoxaparin 40 mg OD subcutaneous (start 12 h post-op or pre-op)",
                    "Mechanical prophylaxis (IPC device)", "Continue for 28 days in high-risk surgery",
                    "Consider extended thromboprophylaxis if major abdominal / pelvic surgery"]
        case 6...7:
            risk = .high; vteRisk = "High (>6%)"
            recs = ["LMWH enoxaparin 40 mg OD (or 1.5 mg/kg OD) SC",
                    "Mechanical compression devices (IPC) throughout admission",
                    "Extended LMWH prophylaxis 28 d post-op (cancer surgery, colorectal, pelvic)",
                    "Consider fondaparinux if HIT history",
                    "Ensure adequate hydration + early mobilisation"]
        default:
            risk = .critical; vteRisk = "Very High (>10%)"
            recs = ["LMWH enoxaparin 40 mg OD (or 1.5 mg/kg OD) SC",
                    "Mechanical compression devices (IPC) throughout admission",
                    "Extended LMWH prophylaxis 28 d post-op mandatory",
                    "Consider fondaparinux if HIT history",
                    "Haematology review — consider direct oral anticoagulant if appropriate",
                    "Ensure adequate hydration + early mobilisation"]
        }

        return ClinicalScore(
            systemName: "Caprini VTE Risk Score",
            abbreviation: "Caprini",
            score: score, maxScore: 40,
            risk: risk, interpretation: "Caprini \(Int(score)) — \(vteRisk) VTE risk",
            recommendations: recs, items: items,
            redFlags: score >= 8 ? ["Caprini ≥8: very high VTE risk — extended prophylaxis mandatory"] : [],
            evidenceNote: "Caprini 1991, updated 2013. Widely validated in surgical patients. Score drives LMWH prophylaxis decisions."
        )
    }

    // MARK: Child-Pugh Score (Liver / Cirrhosis)

    static func childPugh(_ i: ChildPughInput) -> ClinicalScore {
        // Bilirubin (μmol/L)
        let bilPts: Double
        if i.bilirubinUmolL < 34 { bilPts = 1 }
        else if i.bilirubinUmolL <= 51 { bilPts = 2 }
        else { bilPts = 3 }

        // Albumin (g/dL)
        let albPts: Double
        if i.albuminGdL > 3.5 { albPts = 1 }
        else if i.albuminGdL >= 2.8 { albPts = 2 }
        else { albPts = 3 }

        // PT/INR
        let inrPts: Double
        if i.ptINR < 1.7 { inrPts = 1 }
        else if i.ptINR <= 2.3 { inrPts = 2 }
        else { inrPts = 3 }

        let score = Double(i.ascites.rawValue + i.encephalopathy.rawValue) + bilPts + albPts + inrPts

        let (classLabel, risk, mortality1yr, mortality2yr) = childPughClass(score)

        var recs: [String] = []
        var redFlags: [String] = []
        switch classLabel {
        case "A":
            recs = ["Well-compensated cirrhosis", "6-monthly surveillance: AFP + USS",
                    "Variceal surveillance OGD every 2–3 years", "Avoid NSAIDs and nephrotoxins",
                    "Nutritional optimisation before elective surgery"]
        case "B":
            recs = ["Decompensated cirrhosis — assess for liver transplant",
                    "OGD for variceal band ligation if not done within 1 year",
                    "Spironolactone + furosemide for ascites management",
                    "Avoid elective surgery if score ≥8; high perioperative mortality",
                    "Hepatology input mandatory before any operation"]
            redFlags = ["Child-Pugh B — surgical mortality 30–40% for major surgery"]
        default:
            recs = ["Severe decompensation — urgent hepatology / transplant referral",
                    "Treat precipitating factor (SBP, GI bleed, sepsis, drugs)",
                    "Avoid all elective surgery (mortality >80%)",
                    "Lactulose ± rifaximin for encephalopathy",
                    "Monitor for hepatorenal syndrome"]
            redFlags = ["Child-Pugh C — surgical mortality >80%; surgery contraindicated unless life-saving"]
        }

        let items: [ScoredItem] = [
            .init(label: "Bilirubin: \(Int(i.bilirubinUmolL)) μmol/L", points: bilPts, present: true),
            .init(label: "Albumin: \(String(format: "%.1f", i.albuminGdL)) g/dL", points: albPts, present: true),
            .init(label: "PT INR: \(String(format: "%.1f", i.ptINR))", points: inrPts, present: true),
            .init(label: "Ascites: \(ascitesLabel(i.ascites))", points: Double(i.ascites.rawValue), present: true),
            .init(label: "Encephalopathy: \(encephLabel(i.encephalopathy))", points: Double(i.encephalopathy.rawValue), present: true),
        ]

        return ClinicalScore(
            systemName: "Child-Pugh Score",
            abbreviation: "Child-Pugh \(classLabel)",
            score: score, maxScore: 15,
            risk: risk,
            interpretation: "Child-Pugh Class \(classLabel) (score \(Int(score))/15) — 1-year mortality ~\(mortality1yr)%, 2-year ~\(mortality2yr)%",
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Child 1964, Pugh 1973. Class A: 5–6; B: 7–9; C: 10–15. Used for surgical risk in liver disease."
        )
    }

    private static func childPughClass(_ s: Double) -> (String, ScoreRisk, Int, Int) {
        if s <= 6 { return ("A", .low, 15, 21) }
        if s <= 9 { return ("B", .high, 40, 60) }
        return ("C", .critical, 72, 82)
    }

    private static func ascitesLabel(_ a: ChildPughInput.AscitesGrade) -> String {
        switch a { case .none: "None"; case .controlled: "Controlled"; case .refractory: "Refractory" }
    }
    private static func encephLabel(_ e: ChildPughInput.EncephalopathyGrade) -> String {
        switch e { case .none: "None"; case .grade1to2: "Grade 1–2"; case .grade3to4: "Grade 3–4" }
    }

    // MARK: MEWS (Modified Early Warning Score)

    static func mews(_ i: MEWSInput) -> ClinicalScore {
        var rrPoints = 0
        switch i.respiratoryRate {
        case ..<9:   rrPoints = 2
        case 9...14: rrPoints = 0
        case 15...20: rrPoints = 1
        case 21...29: rrPoints = 2
        default:     rrPoints = 3
        }
        var spo2Points = 0
        switch i.oxygenSaturation {
        case ..<85:  spo2Points = 3
        case 85...89: spo2Points = 2
        case 90...93: spo2Points = 1
        default:     spo2Points = 0
        }
        var hrPoints = 0
        switch i.heartRate {
        case ..<40:  hrPoints = 2
        case 40...50: hrPoints = 1
        case 51...100: hrPoints = 0
        case 101...110: hrPoints = 1
        case 111...130: hrPoints = 2
        default:     hrPoints = 3
        }
        var sbpPoints = 0
        switch i.systolicBP {
        case ..<70:  sbpPoints = 3
        case 70...80: sbpPoints = 2
        case 81...100: sbpPoints = 1
        case 101...199: sbpPoints = 0
        default:     sbpPoints = 2
        }
        var tempPoints = 0
        switch i.temperature {
        case ..<35.0:  tempPoints = 2
        case 35.0..<36.0: tempPoints = 1
        case 36.0..<38.0: tempPoints = 0
        case 38.0..<38.5: tempPoints = 1
        default:       tempPoints = 2
        }
        let avpuPoints = i.consciousnessAVPU.rawValue
        let urinePoints = i.urineOutput.rawValue
        let total = Double(rrPoints + spo2Points + hrPoints + sbpPoints + tempPoints + avpuPoints + urinePoints)

        let (risk, interp, recs) = mewsRisk(total)
        let items: [ScoredItem] = [
            .init(label: "Respiratory rate", points: Double(rrPoints), present: rrPoints > 0),
            .init(label: "SpO₂", points: Double(spo2Points), present: spo2Points > 0),
            .init(label: "Heart rate", points: Double(hrPoints), present: hrPoints > 0),
            .init(label: "Systolic BP", points: Double(sbpPoints), present: sbpPoints > 0),
            .init(label: "Temperature", points: Double(tempPoints), present: tempPoints > 0),
            .init(label: "AVPU consciousness", points: Double(avpuPoints), present: avpuPoints > 0),
            .init(label: "Urine output", points: Double(urinePoints), present: urinePoints > 0),
        ]
        let redFlags = total >= 5 ? ["MEWS ≥5: immediate senior review and consider ICU referral"] : []
        return ClinicalScore(
            systemName: "Modified Early Warning Score",
            abbreviation: "MEWS \(Int(total))",
            score: total, maxScore: 14,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Subbe 2001. MEWS ≥5 associated with significantly increased risk of ICU admission and death."
        )
    }

    private static func mewsRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0...1: return (.low, "MEWS \(Int(s))/14 — Stable: routine monitoring", ["Routine obs 4–6 hourly"])
        case 2...3: return (.moderate, "MEWS \(Int(s))/14 — Increased risk: enhanced monitoring", ["Increase obs to 1–2 hourly", "Inform nurse in charge", "Review hydration and medications"])
        case 4...5: return (.high, "MEWS \(Int(s))/14 — Urgent: senior review needed", ["Immediate nursing review", "Contact junior doctor", "Consider bloods + ABG", "Increase obs to hourly"])
        default:    return (.critical, "MEWS \(Int(s))/14 — Critical: immediate intervention required", ["Immediate senior/ICU review", "Activate rapid response/MET", "IV access, bloods, ABG now", "Consider resuscitation protocol"])
        }
    }

    // MARK: NEWS2 (National Early Warning Score 2, RCP 2017)

    static func news2(_ i: NEWS2Input) -> ClinicalScore {
        // Respiratory rate
        let rrPoints: Int
        switch i.respiratoryRate {
        case ..<9:    rrPoints = 3
        case 9...11:  rrPoints = 1
        case 12...20: rrPoints = 0
        case 21...24: rrPoints = 2
        default:      rrPoints = 3
        }

        // SpO2 scoring — Scale 2 when on supplemental O2, Scale 1 otherwise
        let spo2Points: Int
        if i.onSupplementalO2 {
            // Scale 2
            switch i.spo2 {
            case ..<88:   spo2Points = 3
            case 88...92: spo2Points = 0
            case 93...94: spo2Points = 1
            case 95...96: spo2Points = 2
            default:      spo2Points = 3
            }
        } else {
            // Scale 1
            switch i.spo2 {
            case ..<92:   spo2Points = 3
            case 92...93: spo2Points = 2
            case 94...95: spo2Points = 1
            default:      spo2Points = 0
            }
        }

        let o2Points = i.onSupplementalO2 ? 2 : 0

        let sbpPoints: Int
        switch i.systolicBP {
        case ..<91:     sbpPoints = 3
        case 91...100:  sbpPoints = 2
        case 101...110: sbpPoints = 1
        case 111...219: sbpPoints = 0
        default:        sbpPoints = 3
        }

        let hrPoints: Int
        switch i.heartRate {
        case ..<41:     hrPoints = 3
        case 41...50:   hrPoints = 1
        case 51...90:   hrPoints = 0
        case 91...110:  hrPoints = 1
        case 111...130: hrPoints = 2
        default:        hrPoints = 3
        }

        let tempPoints: Int
        switch i.temperatureCelsius {
        case ..<35.1:  tempPoints = 3
        case 35.1..<36.1: tempPoints = 1
        case 36.1..<38.1: tempPoints = 0
        case 38.1..<39.1: tempPoints = 1
        default:       tempPoints = 2
        }

        let avpuPoints = i.avpu.news2Points
        let hasRedFlag = rrPoints >= 3 || spo2Points >= 3 || sbpPoints >= 3 || hrPoints >= 3 || tempPoints >= 3 || avpuPoints >= 3

        let total = Double(rrPoints + spo2Points + o2Points + sbpPoints + hrPoints + tempPoints + avpuPoints)

        let (risk, interp, recs) = news2Risk(total, hasRedFlag: hasRedFlag)
        let items: [ScoredItem] = [
            .init(label: "Respiratory rate", points: Double(rrPoints), present: rrPoints > 0),
            .init(label: "SpO₂ (\(i.onSupplementalO2 ? "Scale 2" : "Scale 1"))", points: Double(spo2Points), present: spo2Points > 0),
            .init(label: "Supplemental O₂", points: Double(o2Points), present: o2Points > 0),
            .init(label: "Systolic BP", points: Double(sbpPoints), present: sbpPoints > 0),
            .init(label: "Heart rate", points: Double(hrPoints), present: hrPoints > 0),
            .init(label: "Temperature", points: Double(tempPoints), present: tempPoints > 0),
            .init(label: "AVPU consciousness", points: Double(avpuPoints), present: avpuPoints > 0),
        ]
        var redFlags: [String] = []
        if total >= 7 { redFlags.append("NEWS2 ≥7: continuous monitoring, immediate senior review") }
        if hasRedFlag { redFlags.append("Single parameter score 3: escalate per local protocol") }
        return ClinicalScore(
            systemName: "National Early Warning Score 2",
            abbreviation: "NEWS2 \(Int(total))",
            score: total, maxScore: 20,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Royal College of Physicians 2017. NEWS2 validated for acutely ill adults."
        )
    }

    private static func news2Risk(_ s: Double, hasRedFlag: Bool) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0:
            return (.low, "NEWS2 0/20 — Minimum: routine monitoring",
                    ["Routine obs (minimum 12-hourly)"])
        case 1...4 where !hasRedFlag:
            return (.low, "NEWS2 \(Int(s))/20 — Low: ward-level response",
                    ["Minimum 4–6 hourly obs", "Inform nurse in charge if deteriorating"])
        case 1...4 where hasRedFlag, 5...6:
            return (.moderate, "NEWS2 \(Int(s))/20 — Medium: urgent review",
                    ["Increase obs to 1 hourly", "Inform bedside nurse immediately",
                     "Urgent review by competent clinician within 30 min",
                     "Consider ABG, bloods, ECG"])
        default:
            return (.critical, "NEWS2 \(Int(s))/20 — High: emergency response",
                    ["Continuous monitoring", "Immediate senior review or emergency response",
                     "Consider HDU/ICU transfer", "IV access, bloods, ABG, ECG now",
                     "Escalate to registrar or consultant"])
        }
    }

    // MARK: GCS (Glasgow Coma Scale)

    static func gcs(_ i: GCSInput) -> ClinicalScore {
        let total = Double(i.eyeOpening.rawValue + i.verbalResponse.rawValue + i.motorResponse.rawValue)
        let eyeLabel: String
        switch i.eyeOpening {
        case .spontaneous: eyeLabel = "Spontaneous (4)"
        case .toVoice:     eyeLabel = "To voice (3)"
        case .toPain:      eyeLabel = "To pain (2)"
        case .none:        eyeLabel = "None (1)"
        }
        let verbalLabel: String
        switch i.verbalResponse {
        case .oriented:            verbalLabel = "Oriented (5)"
        case .confused:            verbalLabel = "Confused (4)"
        case .inappropriateWords:  verbalLabel = "Inappropriate words (3)"
        case .sounds:              verbalLabel = "Incomprehensible sounds (2)"
        case .none:                verbalLabel = "None (1)"
        }
        let motorLabel: String
        switch i.motorResponse {
        case .obeys:          motorLabel = "Obeys commands (6)"
        case .localises:      motorLabel = "Localises pain (5)"
        case .withdraws:      motorLabel = "Withdraws (4)"
        case .abnormalFlexion: motorLabel = "Abnormal flexion (3)"
        case .extension_:     motorLabel = "Extension (2)"
        case .none:           motorLabel = "None (1)"
        }
        let items: [ScoredItem] = [
            .init(label: "Eye opening — \(eyeLabel)", points: Double(i.eyeOpening.rawValue), present: i.eyeOpening != .spontaneous),
            .init(label: "Verbal — \(verbalLabel)", points: Double(i.verbalResponse.rawValue), present: i.verbalResponse != .oriented),
            .init(label: "Motor — \(motorLabel)", points: Double(i.motorResponse.rawValue), present: i.motorResponse != .obeys),
        ]
        let (risk, interp, recs) = gcsRisk(total)
        let redFlags: [String] = total <= 8 ? ["GCS ≤8: protect airway — intubation threshold reached"] : []
        return ClinicalScore(
            systemName: "Glasgow Coma Scale",
            abbreviation: "GCS \(Int(total))/15",
            score: total, maxScore: 15,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Teasdale & Jennett 1974. Revised 2014. GCS ≤8: airway at risk. Normal = 15."
        )
    }

    private static func gcsRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 14...15: return (.low, "GCS \(Int(s))/15 — Normal or minimal impairment", ["Document baseline", "Monitor for deterioration"])
        case 9...13:  return (.moderate, "GCS \(Int(s))/15 — Moderate impairment", ["Senior review", "CT head if trauma or focal deficit", "Monitored environment", "Neurological obs every 30 min"])
        case 3...8:   return (.critical, "GCS \(Int(s))/15 — Severe impairment: airway at risk", ["Immediate senior/anaesthetic review", "RSI intubation if GCS ≤8 or falling", "CT head urgently", "ICU referral", "Neurosurgical review if trauma"])
        default:      return (.critical, "GCS \(Int(s))/15 — Severe impairment", ["Immediate resuscitation"])
        }
    }

    // MARK: ASA Physical Status

    static func asa(_ i: ASAInput) -> ClinicalScore {
        let (risk, description, mortality, recs) = asaDetails(i.asaClass)
        let items: [ScoredItem] = [
            .init(label: "ASA Class \(i.asaClass.rawValue): \(description)", points: Double(i.asaClass.rawValue), present: true)
        ]
        return ClinicalScore(
            systemName: "ASA Physical Status Classification",
            abbreviation: "ASA \(i.asaClass.rawValue)",
            score: Double(i.asaClass.rawValue), maxScore: 5,
            risk: risk,
            interpretation: "ASA Class \(i.asaClass.rawValue): \(description). Perioperative mortality ~\(mortality)",
            recommendations: recs, items: items, redFlags: [],
            evidenceNote: "ASA 1963, revised 2020. Widely used for pre-operative risk stratification."
        )
    }

    private static func asaDetails(_ c: ASAInput.ASAClass) -> (ScoreRisk, String, String, [String]) {
        switch c {
        case .i:
            return (.low, "Healthy patient, no systemic disease", "<0.1%",
                    ["Proceed with planned anaesthesia and surgery"])
        case .ii:
            return (.low, "Mild systemic disease — well-controlled DM/HTN, obesity BMI 30–40, mild lung disease, social smoker, pregnancy",
                    "0.2–0.4%",
                    ["Routine pre-op assessment", "Optimise comorbidities pre-operatively"])
        case .iii:
            return (.moderate, "Severe systemic disease — poorly controlled DM/HTN, COPD, morbid obesity, active hepatitis, ESRD on dialysis, Hx MI/CVA/TIA >3 months ago, EF 20–40%",
                    "1.8–4.3%",
                    ["Cardiology / specialist review if not recently seen", "Optimise before elective surgery", "Pre-op ECG, FBC, U&E, LFTs", "Discuss risk/benefit with patient"])
        case .iv:
            return (.high, "Severe systemic disease, constant threat to life — recent MI/CVA/TIA (<3 months), severe valve disease, EF <20%, sepsis, ongoing anticoagulation",
                    "7.8–23%",
                    ["Surgery only if life-saving or essential", "Multi-disciplinary pre-op meeting", "ICU post-op plan", "Detailed informed consent"])
        case .v:
            return (.critical, "Moribund, not expected to survive without surgery — ruptured AAA, massive PE, intracranial bleed with herniation, ischaemic bowel with MOSF",
                    ">50%",
                    ["Emergency surgery only", "Senior surgeon + anaesthetist", "ICU/HDU reserved", "Family/NOK informed of mortality risk"])
        }
    }

    // MARK: MELD Score (MELD-Na)

    static func meld(_ i: MELDInput) -> ClinicalScore {
        let cr = i.onDialysis ? 4.0 : min(i.creatinineMgDL, 4.0)
        let bili = max(i.bilirubinMgDL, 1.0)
        let inr = max(i.inrValue, 1.0)
        let rawMELD = 3.78 * log(bili) + 11.2 * log(inr) + 9.57 * log(cr) + 6.43
        let meldScore = max(6.0, rawMELD)
        // MELD-Na correction
        let na = max(125.0, min(i.sodiumMmolL, 137.0))
        let meldNa = meldScore + 1.32 * (137 - na) - (0.033 * meldScore * (137 - na))
        let finalScore = max(meldScore, meldNa)

        let items: [ScoredItem] = [
            .init(label: "Bilirubin \(String(format: "%.1f", i.bilirubinMgDL)) mg/dL", points: 3.78 * log(bili), present: i.bilirubinMgDL > 1),
            .init(label: "INR \(String(format: "%.2f", i.inrValue))", points: 11.2 * log(inr), present: i.inrValue > 1),
            .init(label: "Creatinine \(String(format: "%.1f", cr)) mg/dL\(i.onDialysis ? " (dialysis)" : "")", points: 9.57 * log(cr), present: cr > 1),
            .init(label: "Sodium \(Int(i.sodiumMmolL)) mmol/L (MELD-Na adjustment)", points: meldNa - meldScore, present: i.sodiumMmolL < 137),
        ]
        let (risk, interp, recs) = meldRisk(finalScore)
        let redFlags: [String] = finalScore >= 20 ? ["MELD ≥20: discuss liver transplant listing with hepatology"] : []
        return ClinicalScore(
            systemName: "MELD-Na Score",
            abbreviation: "MELD-Na \(Int(finalScore.rounded()))",
            score: finalScore.rounded(), maxScore: 40,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Kamath 2001, Kim 2008 (MELD-Na). 90-day transplant waiting list mortality. Used for surgical risk in cirrhosis."
        )
    }

    private static func meldRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case ..<10: return (.low, "MELD-Na \(Int(s.rounded())): 90-day mortality ~1.9%", ["Elective surgery generally safe with optimisation", "Standard anaesthetic risk", "Monitor LFTs post-op"])
        case 10..<20: return (.moderate, "MELD-Na \(Int(s.rounded())): 90-day mortality ~6%", ["Hepatology input pre-operatively", "Optimise nutrition, coagulopathy, renal function", "Avoid hepatotoxic drugs", "Post-op HDU consideration"])
        case 20..<25: return (.high, "MELD-Na \(Int(s.rounded())): 90-day mortality ~20–25%", ["High surgical risk — consider non-operative management if possible", "Hepatology + transplant surgery review", "ICU post-op planning", "Detailed consent with documented mortality risk"])
        default:     return (.critical, "MELD-Na \(Int(s.rounded())): 90-day mortality >50%", ["Surgery contraindicated unless life-saving", "Transplant evaluation urgently", "Palliative care discussion if appropriate", "ICU-level perioperative support required"])
        }
    }

    // MARK: CHA₂DS₂-VASc

    static func cha2ds2vasc(_ i: CHA2DS2VAScInput) -> ClinicalScore {
        var score = 0.0
        var items: [ScoredItem] = []
        items.append(.init(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure))
        if i.congestiveHeartFailure { score += 1 }
        items.append(.init(label: "Hypertension", points: 1, present: i.hypertension))
        if i.hypertension { score += 1 }
        if i.ageOver75 {
            items.append(.init(label: "Age ≥75 years", points: 2, present: true))
            score += 2
        } else {
            items.append(.init(label: "Age 65–74 years", points: 1, present: i.age65to74))
            if i.age65to74 { score += 1 }
        }
        items.append(.init(label: "Diabetes mellitus", points: 1, present: i.diabetes))
        if i.diabetes { score += 1 }
        items.append(.init(label: "Stroke / TIA / thromboembolism", points: 2, present: i.strokeOrTIA))
        if i.strokeOrTIA { score += 2 }
        items.append(.init(label: "Vascular disease (MI, PAD, aortic plaque)", points: 1, present: i.vascularDisease))
        if i.vascularDisease { score += 1 }
        items.append(.init(label: "Female sex", points: 1, present: i.femaleSex))
        if i.femaleSex { score += 1 }

        let (risk, interp, recs) = cha2ds2vascRisk(score, female: i.femaleSex)
        let redFlags: [String] = score >= 2 ? ["CHA₂DS₂-VASc ≥2 (male) or ≥3 (female): anticoagulation recommended by ESC/AHA"] : []
        return ClinicalScore(
            systemName: "CHA₂DS₂-VASc Score",
            abbreviation: "CHA₂DS₂-VASc \(Int(score))",
            score: score, maxScore: 9,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Lip 2010, ESC 2020 AF guidelines. For non-valvular AF only. Score ≥2 (male) or ≥3 (female): OAC recommended."
        )
    }

    private static func cha2ds2vascRisk(_ s: Double, female: Bool) -> (ScoreRisk, String, [String]) {
        let threshold = female ? 3.0 : 2.0
        switch s {
        case 0: return (.low, "CHA₂DS₂-VASc 0 (male) — Very low stroke risk (~0%/yr)", ["No anticoagulation needed", "Reassess annually"])
        case 1: return (female ? .low : .moderate, "CHA₂DS₂-VASc 1 — Annual stroke risk ~1.3%", ["Consider anticoagulation (male)", "Female sex alone does not require OAC", "Individualise risk–benefit"])
        case _ where s >= threshold:
            let annualRisk = s >= 6 ? ">10" : s >= 4 ? "4–8" : "2–3"
            return (.high, "CHA₂DS₂-VASc \(Int(s)) — Annual stroke risk ~\(annualRisk)%",
                    ["Anticoagulation recommended (OAC preferred over aspirin)", "DOAC first-line unless contraindicated (e.g. mechanical valve, moderate–severe mitral stenosis → warfarin)", "Check HAS-BLED score before prescribing", "Baseline renal function, LFTs, FBC"])
        default:
            return (.moderate, "CHA₂DS₂-VASc \(Int(s))", ["Individualise anticoagulation decision"])
        }
    }

    // MARK: HAS-BLED

    static func hasBled(_ i: HASBLEDInput) -> ClinicalScore {
        var score = 0.0
        var items: [ScoredItem] = []
        items.append(.init(label: "H — Hypertension (uncontrolled, SBP >160)", points: 1, present: i.hypertensionUncontrolled))
        if i.hypertensionUncontrolled { score += 1 }
        items.append(.init(label: "A — Abnormal renal function", points: 1, present: i.renalDysfunction))
        if i.renalDysfunction { score += 1 }
        items.append(.init(label: "A — Abnormal liver function", points: 1, present: i.liverDysfunction))
        if i.liverDysfunction { score += 1 }
        items.append(.init(label: "S — Stroke history", points: 1, present: i.strokeHistory))
        if i.strokeHistory { score += 1 }
        items.append(.init(label: "B — Bleeding predisposition / history", points: 1, present: i.priorBleeding))
        if i.priorBleeding { score += 1 }
        items.append(.init(label: "L — Labile INR (TTR <60%)", points: 1, present: i.labileINR))
        if i.labileINR { score += 1 }
        items.append(.init(label: "E — Elderly (age >65)", points: 1, present: i.ageOver65))
        if i.ageOver65 { score += 1 }
        items.append(.init(label: "D — Drugs (antiplatelets/NSAIDs)", points: 1, present: i.drugsOrAlcohol))
        if i.drugsOrAlcohol { score += 1 }
        items.append(.init(label: "D — Alcohol (≥8 units/wk)", points: 1, present: i.alcoholUse))
        if i.alcoholUse { score += 1 }

        let (risk, interp, recs) = hasBledRisk(score)
        let redFlags: [String] = score >= 3 ? ["HAS-BLED ≥3: high bleeding risk — review modifiable factors before anticoagulation"] : []
        return ClinicalScore(
            systemName: "HAS-BLED Bleeding Risk Score",
            abbreviation: "HAS-BLED \(Int(score))",
            score: score, maxScore: 9,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Pisters 2010. Predicts 1-year major bleeding risk in patients on anticoagulation for AF. Used alongside CHA₂DS₂-VASc."
        )
    }

    private static func hasBledRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0...1: return (.low, "HAS-BLED \(Int(s)): Low bleeding risk (~1%/yr)", ["Anticoagulation appropriate if CHA₂DS₂-VASc indicates", "Routine monitoring"])
        case 2:     return (.moderate, "HAS-BLED 2: Moderate bleeding risk (~1.9%/yr)", ["Anticoagulation can be considered — weigh against stroke risk", "Address modifiable risk factors (BP control, avoid NSAIDs)", "Frequent INR monitoring if on warfarin"])
        default:    return (.high, "HAS-BLED \(Int(s)): High bleeding risk (≥3%/yr)", ["Does NOT mean anticoagulation is contraindicated — stroke risk often still exceeds bleeding risk", "Address ALL modifiable factors: hypertension, labile INR, alcohol, NSAIDs", "Consider DOAC over warfarin", "Regular review; involve haematology if complex"])
        }
    }

    // MARK: Glasgow-Blatchford Score

    static func blatchford(_ i: BlatchfordInput) -> ClinicalScore {
        var score = 0.0
        score += Double(i.bloodUreaNitrogen.rawValue)
        score += Double(i.sbp.rawValue)
        if i.heartRateOver100  { score += 1 }
        if i.melaena           { score += 1 }
        if i.syncope           { score += 2 }
        if i.hepaticDisease    { score += 2 }
        if i.cardiacFailure    { score += 2 }

        let hbPoints = i.haemoglobinPoints
        score += Double(hbPoints)

        let items: [ScoredItem] = [
            .init(label: "Blood urea nitrogen", points: Double(i.bloodUreaNitrogen.rawValue), present: i.bloodUreaNitrogen != .under6_5),
            .init(label: "Haemoglobin", points: Double(hbPoints), present: hbPoints > 0),
            .init(label: "Systolic BP", points: Double(i.sbp.rawValue), present: i.sbp != .over109),
            .init(label: "Heart rate >100 bpm", points: 1, present: i.heartRateOver100),
            .init(label: "Melaena", points: 1, present: i.melaena),
            .init(label: "Syncope", points: 2, present: i.syncope),
            .init(label: "Hepatic disease", points: 2, present: i.hepaticDisease),
            .init(label: "Cardiac failure", points: 2, present: i.cardiacFailure),
        ]
        let (risk, interp, recs) = blatchfordRisk(score)
        let redFlags = score >= 6 ? ["Blatchford ≥6: high risk — urgent endoscopy within 24h"] : []
        return ClinicalScore(
            systemName: "Glasgow-Blatchford Score",
            abbreviation: "Blatchford \(Int(score))",
            score: score, maxScore: 23,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Blatchford 2000. Predicts need for intervention in upper GI bleed before endoscopy. Score 0 = safe for outpatient management."
        )
    }

    private static func blatchfordRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0:     return (.low, "Blatchford 0: Very low risk — safe for outpatient management", ["Consider early discharge if no other concerns", "Outpatient endoscopy within 1–2 weeks", "Clear discharge advice on return criteria"])
        case 1...5: return (.moderate, "Blatchford \(Int(s)): Moderate risk — admit for observation", ["Admit and monitor", "Endoscopy within 24 hours", "IV access + group & screen", "NBM if high suspicion of variceal bleed"])
        default:    return (.high, "Blatchford \(Int(s)): High risk — urgent intervention likely", ["Urgent endoscopy within 12–24 hours", "ICU/HDU if haemodynamically unstable", "Correct coagulopathy pre-procedure", "Gastroenterology/GI surgery review", "Consider PPI infusion"])
        }
    }

    // MARK: AIMS65 (Upper GI Bleed In-Hospital Mortality)

    struct AIMS65Input: Equatable {
        var albuminUnder3: Bool = false      // serum albumin <3.0 g/dL (+1)
        var inrOver1point5: Bool = false     // INR >1.5 (+1)
        var alteredMentalStatus: Bool = false // altered mental status (+1)
        var systolicBPUnder90: Bool = false  // systolic BP ≤90 mmHg (+1)
        var ageOver65: Bool = false          // age ≥65 years (+1)
    }

    static func aims65(_ i: AIMS65Input) -> ClinicalScore {
        let flags = [i.albuminUnder3, i.inrOver1point5, i.alteredMentalStatus,
                     i.systolicBPUnder90, i.ageOver65]
        let score = Double(flags.filter { $0 }.count)
        let items: [ScoredItem] = [
            .init(label: "A — Albumin <3.0 g/dL",                           points: 1, present: i.albuminUnder3),
            .init(label: "I — INR >1.5",                                     points: 1, present: i.inrOver1point5),
            .init(label: "M — Altered mental status (disorientation / hepatic encephalopathy)", points: 1, present: i.alteredMentalStatus),
            .init(label: "S — Systolic BP ≤90 mmHg",                        points: 1, present: i.systolicBPUnder90),
            .init(label: "5 — Age ≥65 years",                               points: 1, present: i.ageOver65),
        ]
        let (risk, interp, recs, redFlags): (ScoreRisk, String, [String], [String]) = switch Int(score) {
        case 0:
            (.low,      "AIMS65 0 — In-hospital mortality 0.3%",
             ["Standard upper GI bleed pathway",
              "Early endoscopy within 24 h (within 12 h if haemodynamically unstable)",
              "IV PPI bolus + infusion after endoscopy if peptic ulcer confirmed",
              "Consider discharge within 24 h post-endoscopy if haemostasis confirmed"],
             [])
        case 1:
            (.low,      "AIMS65 1 — In-hospital mortality 1.2%",
             ["IV access × 2; FBC, U&E, coagulation, crossmatch",
              "IV fluid resuscitation; transfuse to Hb ≥70 g/L (>80 if ACS)",
              "Urgent upper GI endoscopy within 24 h",
              "IV PPI if peptic ulcer aetiology likely"],
             [])
        case 2:
            (.moderate, "AIMS65 2 — In-hospital mortality 4.3%",
             ["HDU-level nursing; continuous monitoring",
              "Early endoscopy within 12 h",
              "IV PPI (omeprazole 80 mg bolus then 8 mg/h for 72 h) after endoscopy",
              "Gastroenterology and surgical review",
              "Correct coagulopathy: FFP, platelets, vitamin K as indicated"],
             ["AIMS65 ≥2: consider HDU care"])
        case 3:
            (.high,     "AIMS65 3 — In-hospital mortality 12.7%",
             ["ICU-level care / resuscitation bay",
              "Urgent endoscopy within 12 h — resuscitate before scoping if haemodynamically compromised",
              "Activate massive transfusion protocol if needed",
              "Interventional radiology or surgery on standby",
              "Haematology review for coagulopathy reversal",
              "Consider vasopressors if refractory hypotension"],
             ["AIMS65 ≥3: high in-hospital mortality risk — escalate immediately"])
        default:
            (.critical, "AIMS65 \(Int(score)) — In-hospital mortality \(score >= 5 ? "~24.5%" : "~18.7%")",
             ["Emergency resuscitation; immediate ICU/resuscitation bay",
              "Massive transfusion protocol; correct all coagulopathy urgently",
              "Emergency endoscopy only when haemodynamically stabilised",
              "Surgery or interventional radiology for refractory haemorrhage",
              "Critical care + surgical + haematology joint review",
              "Discuss prognosis and goals of care early"],
             ["AIMS65 ≥4: critical upper GI haemorrhage — mortality approaching 25%"])
        }
        return ClinicalScore(
            systemName: "AIMS65 Score",
            abbreviation: "AIMS65 \(Int(score))/5",
            score: score, maxScore: 5,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Saltzman et al, Gastroenterology 2011. Validated in 29,222 patients. Predicts in-hospital mortality for upper GI haemorrhage. AUROC 0.77 vs Blatchford 0.68 for in-hospital mortality."
        )
    }

    // MARK: BISAP (Bedside Index for Severity in Acute Pancreatitis)

    struct BISAPInput: Equatable {
        var bunOver9mmolL: Bool = false          // BUN >9 mmol/L (>25 mg/dL)
        var impairedMentalStatus: Bool = false   // disorientation, stupor, or coma
        var sirs: Bool = false                   // SIRS (≥2 of 4 SIRS criteria met)
        var ageOver60: Bool = false              // age >60 years
        var pleuralEffusion: Bool = false        // pleural effusion on imaging
    }

    static func bisap(_ i: BISAPInput) -> ClinicalScore {
        let flags = [i.bunOver9mmolL, i.impairedMentalStatus, i.sirs, i.ageOver60, i.pleuralEffusion]
        let score = Double(flags.filter { $0 }.count)
        let items: [ScoredItem] = [
            .init(label: "B — BUN >9 mmol/L (>25 mg/dL)",          points: 1, present: i.bunOver9mmolL),
            .init(label: "I — Impaired mental status (disorientation / stupor / coma)", points: 1, present: i.impairedMentalStatus),
            .init(label: "S — SIRS (≥2 of: temp >38 or <36°C, HR >90, RR >20, WBC >12k or <4k)", points: 1, present: i.sirs),
            .init(label: "A — Age >60 years",                       points: 1, present: i.ageOver60),
            .init(label: "P — Pleural effusion on imaging",         points: 1, present: i.pleuralEffusion),
        ]
        let (risk, interp, recs, redFlags): (ScoreRisk, String, [String], [String]) = switch Int(score) {
        case 0:
            (.low,      "BISAP 0 — Predicted mortality 0.1% — mild pancreatitis very likely",
             ["Aggressive IV fluid resuscitation (Hartmann's / Ringer's lactate preferred)",
              "Monitor urine output, U&E, lipase at 24–48 h",
              "Consider early enteral feeding if tolerated",
              "Abdominal imaging not routine unless diagnosis uncertain"],
             [])
        case 1:
            (.low,      "BISAP 1 — Predicted mortality 0.4% — mild pancreatitis expected",
             ["IV fluid resuscitation; reassess at 6 h and 24 h",
              "Monitor amylase/lipase, FBC, CRP, renal function",
              "Enteral nutrition if not tolerating oral by 48 h"],
             [])
        case 2:
            (.moderate, "BISAP 2 — Predicted mortality 1.6% — moderate severity likely",
             ["Active IV resuscitation; Hartmann's preferred over normal saline",
              "CECT abdomen at 48–72 h if not improving",
              "Nutritional support: nasojejunal tube if oral intake fails by 48 h",
              "Consider HDU monitoring; re-score at 24 h"],
             ["CRP >150 at 48 h suggests necrotising pancreatitis"])
        case 3:
            (.high,     "BISAP 3 — Predicted mortality 5.3% — severe pancreatitis likely",
             ["Urgent HDU/ICU referral",
              "CECT abdomen (pancreatic protocol) as soon as haemodynamically stable",
              "Invasive monitoring; strict fluid balance",
              "Enteral nutrition via nasojejunal tube within 24–48 h",
              "Multidisciplinary review: pancreatic surgery, radiology, intensivist"],
             ["BISAP ≥3: high probability severe or necrotising pancreatitis"])
        case 4:
            (.high,     "BISAP 4 — Predicted mortality 12.7% — severe pancreatitis",
             ["ICU-level care mandatory",
              "CECT for necrosis mapping; interventional radiology on standby",
              "Early nutritional support; consider TPN if enteral route not feasible",
              "Broad-spectrum antibiotics ONLY if infected necrosis confirmed or strongly suspected",
              "Surgical/endoscopic intervention planning for necrosectomy if needed"],
             ["BISAP ≥3: severe pancreatitis confirmed — ICU level care required"])
        default:
            (.critical, "BISAP 5 — Predicted mortality 22.0% — critical pancreatitis",
             ["ICU admission mandatory; intensivist-led care",
              "Urgent CECT for extent of pancreatic necrosis",
              "Multidisciplinary team: HPB surgery, interventional radiology, critical care",
              "Plan step-up approach for infected necrosis: drainage → necrosectomy",
              "Discuss prognosis with family; goals-of-care conversation"],
             ["BISAP 5: critical severity — mortality ~22%; escalate immediately"])
        }
        return ClinicalScore(
            systemName: "BISAP Score",
            abbreviation: "BISAP \(Int(score))/5",
            score: score, maxScore: 5,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Wu et al, Am J Gastroenterol 2008. Validated in 17,992 patients. Predicts in-hospital mortality and severe pancreatitis. BISAP ≥3: sensitivity 64%, specificity 91% for severe pancreatitis."
        )
    }

    // MARK: STOP-BANG (OSA)

    static func stopBang(_ i: STOPBANGInput) -> ClinicalScore {
        let flags = [i.snoring, i.tired, i.observed, i.pressureTreated,
                     i.bmiOver35, i.ageOver50, i.neckOver40cm, i.male]
        let score = Double(flags.filter { $0 }.count)
        let items: [ScoredItem] = [
            .init(label: "S — Snoring loudly", points: 1, present: i.snoring),
            .init(label: "T — Tired / fatigued during day", points: 1, present: i.tired),
            .init(label: "O — Observed apnoea (partner/witness)", points: 1, present: i.observed),
            .init(label: "P — Pressure / hypertension (treated or BP >140/90)", points: 1, present: i.pressureTreated),
            .init(label: "B — BMI >35 kg/m²", points: 1, present: i.bmiOver35),
            .init(label: "A — Age >50 years", points: 1, present: i.ageOver50),
            .init(label: "N — Neck circumference >40 cm", points: 1, present: i.neckOver40cm),
            .init(label: "G — Gender male", points: 1, present: i.male),
        ]
        let (risk, interp, recs) = stopBangRisk(score)
        let redFlags = i.observed ? ["Observed apnoea: high pre-test probability of OSA regardless of total score"] : []
        return ClinicalScore(
            systemName: "STOP-BANG Questionnaire",
            abbreviation: "STOP-BANG \(Int(score))/8",
            score: score, maxScore: 8,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Chung 2008. Pre-operative OSA screening. Sensitivity 84% for moderate–severe OSA (AHI ≥15) at score ≥3."
        )
    }

    private static func stopBangRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0...2: return (.low, "STOP-BANG \(Int(s))/8: Low OSA risk", ["Routine anaesthetic assessment", "Standard post-op oxygen monitoring"])
        case 3...4: return (.moderate, "STOP-BANG \(Int(s))/8: Intermediate OSA risk", ["Pre-op sleep study or SpO₂ overnight if time allows", "Discuss with anaesthesia team pre-op", "Avoid benzodiazepines if possible", "PACU monitoring; consider extended post-op SpO₂"])
        default:    return (.high, "STOP-BANG \(Int(s))/8: High OSA risk", ["Formal sleep study / polysomnography", "If CPAP user: bring CPAP to hospital", "Inform anaesthetist pre-op", "Avoid opioids where possible; use multimodal analgesia", "Extended PACU stay / HDU post-op consideration", "Nurse semi-upright post-operatively"])
        }
    }

    // MARK: PSI/PORT — Community-Acquired Pneumonia Severity Index

    static func psiPort(_ i: PSIPortInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Age (male, per year)", points: Double(i.ageMale), present: i.ageMale > 0),
            .init(label: "Age −10 (female, per year)", points: Double(i.ageFemale), present: i.ageFemale > 0),
            .init(label: "Nursing home resident", points: 10, present: i.nursingHomeResident),
            .init(label: "Neoplastic disease", points: 30, present: i.neoplasticDisease),
            .init(label: "Liver disease", points: 20, present: i.liverDisease),
            .init(label: "Congestive heart failure", points: 10, present: i.congestiveHeartFailure),
            .init(label: "Cerebrovascular disease", points: 10, present: i.cerebrovascularDisease),
            .init(label: "Renal disease", points: 10, present: i.renalDisease),
            .init(label: "Altered mental status", points: 20, present: i.alteredMentalStatus),
            .init(label: "Respiratory rate ≥30/min", points: 20, present: i.respiratoryRateOver30),
            .init(label: "Systolic BP <90 mmHg", points: 20, present: i.systolicBPUnder90),
            .init(label: "Temp <35°C or ≥40°C", points: 15, present: i.tempUnder35orOver40),
            .init(label: "Heart rate ≥125 bpm", points: 10, present: i.heartRateOver125),
            .init(label: "Arterial pH <7.35", points: 30, present: i.arterialPHUnder735),
            .init(label: "BUN ≥11 mmol/L", points: 20, present: i.bunOver11mmoL),
            .init(label: "Sodium <130 mEq/L", points: 20, present: i.sodiumUnder130),
            .init(label: "Glucose ≥14 mmol/L", points: 10, present: i.glucoseOver14),
            .init(label: "Haematocrit <30%", points: 10, present: i.haematocritUnder30),
            .init(label: "PaO₂ <60 mmHg or SpO₂ <90%", points: 10, present: i.pao2Under60orSpO2Under90),
            .init(label: "Pleural effusion on imaging", points: 10, present: i.pleuralEffusion),
        ]
        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let (psiClass, risk, interpretation, recs, redFlags): (Int, ScoreRisk, String, [String], [String])
        switch score {
        case ..<71:
            let cls = score <= 0 || (!i.neoplasticDisease && !i.liverDisease && !i.congestiveHeartFailure
                                     && !i.cerebrovascularDisease && !i.renalDisease
                                     && !i.alteredMentalStatus && !i.respiratoryRateOver30
                                     && !i.systolicBPUnder90 && !i.heartRateOver125
                                     && !i.pao2Under60orSpO2Under90
                                     && (i.ageMale > 0 ? i.ageMale < 50 : i.ageFemale < 40)) ? 1 : 2
            psiClass = cls; risk = .low
            interpretation = "PSI Class \(cls) — 30-day mortality \(cls == 1 ? "<0.1%" : "0.6%")"
            recs = ["Outpatient treatment appropriate", "Amoxicillin 500 mg TDS or doxycycline",
                    "Review in 48 h if not improving", "Return if oxygen saturation falls"]
            redFlags = []
        case 71...90:
            psiClass = 3; risk = .moderate
            interpretation = "PSI Class III — 30-day mortality ~2.8%"
            recs = ["Brief inpatient observation or outpatient with close follow-up",
                    "Amoxicillin-clavulanate ± macrolide", "SpO₂ monitoring", "Review in 24 h"]
            redFlags = []
        case 91...130:
            psiClass = 4; risk = .high
            interpretation = "PSI Class IV — 30-day mortality ~8.2%"
            recs = ["Hospital admission required", "Amoxicillin-clavulanate + clarithromycin IV/oral",
                    "Continuous SpO₂ monitoring", "FBC, U&E, CRP, blood cultures × 2 before antibiotics",
                    "Chest X-ray follow-up at 6 weeks"]
            redFlags = ["Class IV: admission and IV antibiotics mandatory"]
        default:
            psiClass = 5; risk = .critical
            interpretation = "PSI Class V — 30-day mortality ~29%"
            recs = ["ICU-level care required", "Piperacillin-tazobactam + azithromycin IV",
                    "Consider non-invasive ventilation or intubation", "Urgent intensivist review",
                    "Strict fluid balance, vasopressors if shocked", "Blood cultures × 2 stat"]
            redFlags = ["Class V: ICU referral and broad-spectrum IV antibiotics urgently"]
        }

        return ClinicalScore(
            systemName: "Pneumonia Severity Index",
            abbreviation: "PSI/PORT Class \(psiClass)",
            score: score, maxScore: 395,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Fine et al, NEJM 1997. Validated in 52,000+ patients. Class I–II: outpatient. Class III: short stay. IV–V: admit/ICU. 30-day mortality 0.1%→29%."
        )
    }

    // MARK: - SOFA (Sequential Organ Failure Assessment)

    static func sofa(_ i: SOFAInput) -> ClinicalScore {
        let total = i.respiration + i.coagulation + i.liver + i.cardiovascular + i.cns + i.renal
        let items: [(String, Int)] = [
            ("Respiratory — PaO₂/FiO₂", i.respiration),
            ("Coagulation — Platelets", i.coagulation),
            ("Liver — Bilirubin", i.liver),
            ("Cardiovascular — MAP/vasopressors", i.cardiovascular),
            ("CNS — GCS", i.cns),
            ("Renal — Creatinine/UO", i.renal)
        ]
        let (risk, interpretation, recs, redFlags) = sofaRisk(total)
        return ClinicalScore(
            systemName: "Sequential Organ Failure Assessment",
            abbreviation: "SOFA \(total)",
            score: Double(total), maxScore: 24,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Singer M et al, JAMA 2016 (Sepsis-3). Vincent JL et al, ICM 1996. SOFA ≥2 with suspected infection = sepsis. 0–6: <10% mortality, 7–9: ~20%, 10–12: ~45%, ≥13: >50%."
        )
    }

    private static func sofaRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case 0...1:
            return (.low,
                    "SOFA \(s) — no significant organ dysfunction",
                    ["Standard monitoring", "Reassess if clinical deterioration"],
                    [])
        case 2...6:
            return (.low,
                    "SOFA \(s) — organ dysfunction; Sepsis-3 criteria met if infection suspected",
                    ["Blood cultures × 2 and serum lactate", "IV antibiotics within 1h if sepsis",
                     "IV fluid 30 mL/kg crystalloid if lactate ≥4 mmol/L or hypoperfused",
                     "Repeat SOFA in 24h to track trajectory"],
                    ["SOFA ≥2: organ dysfunction — Sepsis-3 criteria met if infection suspected"])
        case 7...9:
            return (.moderate,
                    "SOFA \(s) — significant multi-organ dysfunction; ~15–20% in-hospital mortality",
                    ["Urgent senior/ICU review", "Source control if septic focus identified",
                     "Vasopressors if MAP <65 mmHg after 30 mL/kg crystalloid",
                     "Hourly urine output monitoring", "Repeat SOFA in 12–24h"],
                    ["SOFA 7–9: significant organ failure — ICU assessment urgently"])
        case 10...12:
            return (.high,
                    "SOFA \(s) — severe multi-organ failure; ~40–50% in-hospital mortality",
                    ["ICU admission required", "Vasopressor titration to MAP ≥65 mmHg",
                     "Renal replacement therapy if AKI KDIGO stage 3",
                     "Mechanical ventilation if P:F <200 with respiratory failure",
                     "Surviving Sepsis Campaign 1h bundle"],
                    ["SOFA 10–12: severe organ failure — ICU admission required"])
        default:
            return (.critical,
                    "SOFA \(s) — critical multi-organ failure; >50% in-hospital mortality",
                    ["Emergency ICU admission", "Full organ support: vasopressors, RRT, mechanical ventilation",
                     "Immediate intensivist review", "Goals-of-care discussion with family",
                     "Surviving Sepsis Campaign — all bundle elements within 1h"],
                    ["SOFA ≥13: critical — mortality >50%; emergency ICU escalation"])
        }
    }

    // MARK: - FIB-4 (Liver Fibrosis Index)

    static func fib4(_ i: FIB4Input) -> ClinicalScore {
        guard i.platelet10_9L > 0, i.altIUL > 0 else {
            return ClinicalScore(
                systemName: "FIB-4 Liver Fibrosis Index", abbreviation: "FIB-4 —",
                score: 0, maxScore: 10, risk: .low,
                interpretation: "Incomplete — platelet count and ALT required",
                recommendations: ["Enter platelet count (×10⁹/L) and ALT (IU/L) to calculate"],
                items: [], redFlags: [],
                evidenceNote: "Sterling RK et al, Hepatology 2006."
            )
        }
        let fib4Val = Double(i.age) * i.astIUL / (i.platelet10_9L * sqrt(i.altIUL))
        let items: [(String, Int)] = [
            ("Age (years)", i.age),
            ("AST (IU/L)", Int(i.astIUL)),
            ("Platelets (×10⁹/L)", Int(i.platelet10_9L)),
            ("ALT (IU/L)", Int(i.altIUL))
        ]
        let (risk, interpretation, recs, redFlags) = fib4Risk(fib4Val)
        return ClinicalScore(
            systemName: "FIB-4 Liver Fibrosis Index",
            abbreviation: String(format: "FIB-4 %.2f", fib4Val),
            score: fib4Val, maxScore: 10,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Sterling RK et al, Hepatology 2006; EASL 2021. (Age × AST) ÷ (Platelets × √ALT). <1.30: F0–F1, 90% NPV; 1.30–2.67: indeterminate; >2.67: F2–F4, 80% PPV."
        )
    }

    private static func fib4Risk(_ f: Double) -> (ScoreRisk, String, [String], [String]) {
        switch f {
        case ..<1.30:
            return (.low,
                    String(format: "FIB-4 %.2f — low fibrosis risk; F0–F1 likely (NPV ~90%%)", f),
                    ["No advanced fibrosis expected — routine follow-up",
                     "Repeat FIB-4 annually if metabolic risk factors present",
                     "Lifestyle: reduce alcohol, achieve target weight, treat metabolic syndrome"],
                    [])
        case 1.30...2.67:
            return (.moderate,
                    String(format: "FIB-4 %.2f — indeterminate; further assessment recommended", f),
                    ["Liver elastography (FibroScan) for definitive staging",
                     "Hepatology referral if viral hepatitis, alcohol, or metabolic liver disease",
                     "Repeat FIB-4 in 6–12 months if elastography deferred",
                     "Review hepatotoxic medications"],
                    ["FIB-4 indeterminate: FibroScan or hepatology review recommended"])
        default:
            return (.critical,
                    String(format: "FIB-4 %.2f — high fibrosis risk; significant fibrosis (F2–F4) likely", f),
                    ["Urgent hepatology referral",
                     "FibroScan or liver biopsy for staging",
                     "Endoscopy for variceal surveillance if F3–F4 suspected",
                     "HCC surveillance: 6-monthly ultrasound + AFP if cirrhosis confirmed",
                     "Cease alcohol; optimise weight, diabetes, lipids"],
                    ["FIB-4 >2.67: significant liver fibrosis likely — urgent hepatology referral"])
        }
    }

    // MARK: - CURB-65 (Community-Acquired Pneumonia)

    static func curb65(_ i: CURB65Input) -> ClinicalScore {
        var score = 0
        var items: [(String, Int)] = []
        func add(_ label: String, _ flag: Bool) {
            if flag { score += 1 }
            items.append((label, flag ? 1 : 0))
        }
        add("C — Confusion (new onset, AMT ≤8)", i.confusion)
        add("U — Urea >7 mmol/L", i.ureaDOver7)
        add("R — Respiratory rate ≥30 /min", i.respiratoryRateOver30)
        add("B — BP: SBP <90 or DBP ≤60 mmHg", i.lowBP)
        add("65 — Age ≥65 years", i.ageOver65)

        let (risk, interpretation, recs, redFlags) = curb65Risk(score)
        return ClinicalScore(
            systemName: "CURB-65",
            abbreviation: "CURB-65 \(score)/5",
            score: Double(score), maxScore: 5,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Lim WS et al, Thorax 2003. 30-day mortality: score 0–1 <3%, score 2 ~9%, score 3–5 ~22%. Validated in 1068 patients. Use alongside clinical judgement."
        )
    }

    private static func curb65Risk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case 0...1:
            return (.low,
                    "CURB-65 \(s)/5 — low severity; 30-day mortality <3%",
                    ["Outpatient treatment appropriate in most cases",
                     "Amoxicillin 500 mg TDS × 5 days (first-line, uncomplicated)",
                     "Or doxycycline 200 mg stat then 100 mg OD if penicillin allergy",
                     "Review at 48h if not improving; return if symptoms worsen"],
                    [])
        case 2:
            return (.moderate,
                    "CURB-65 2/5 — moderate severity; 30-day mortality ~9%",
                    ["Consider short inpatient stay or supervised outpatient therapy",
                     "Amoxicillin-clavulanate 625 mg TDS ± clarithromycin 500 mg BD",
                     "SpO₂ monitoring; supplemental O₂ if <94%",
                     "CXR, FBC, CRP, U&E, blood cultures × 2"],
                    ["CURB-65 2: consider inpatient assessment"])
        default:
            return (.high,
                    "CURB-65 \(s)/5 — high severity; 30-day mortality ~\(s >= 4 ? "27–29" : "22")%",
                    ["Hospital admission required (score 3) or urgent ICU assessment (score 4–5)",
                     "Co-amoxiclav + clarithromycin IV or piperacillin-tazobactam + azithromycin",
                     "Continuous SpO₂; escalate O₂ therapy as needed",
                     "Blood cultures × 2 and urine pneumococcal/legionella antigen",
                     "CXR, ABG if SpO₂ <92% or RR >30"],
                    ["CURB-65 ≥3: hospital admission required; score ≥4 consider ICU"])
        }
    }

    // MARK: - Padua Prediction Score (Medical VTE Risk)

    static func padua(_ i: PaduaInput) -> ClinicalScore {
        var score = 0
        var items: [(String, Int)] = []
        func add(_ label: String, _ flag: Bool, pts: Int) {
            if flag { score += pts }
            items.append((label, flag ? pts : 0))
        }
        add("Active/recent cancer (≤6 months or metastatic)", i.activeOrRecentCancer, pts: 3)
        add("Previous VTE (excl. superficial thrombosis)", i.previousVTE, pts: 3)
        add("Reduced mobility ≥3 days (anticipated bed rest)", i.reducedMobility, pts: 3)
        add("Known thrombophilia (inherited or acquired)", i.thrombophilia, pts: 3)
        add("Recent trauma or surgery (≤1 month)", i.recentTraumaOrSurgery, pts: 2)
        add("Age ≥70 years", i.ageOver70, pts: 1)
        add("Heart failure or respiratory failure", i.heartOrRespiratoryFailure, pts: 1)
        add("Acute MI or ischaemic stroke", i.acuteMIOrIschaemicStroke, pts: 1)
        add("Acute infection or inflammatory condition", i.acuteInfectionOrInflammatory, pts: 1)
        add("BMI ≥30 (obese)", i.obese, pts: 1)
        add("Ongoing hormonal treatment (OCP, HRT)", i.ongoingHormonalTreatment, pts: 1)

        let isHighRisk = score >= 4
        let risk: ScoreRisk = isHighRisk ? .high : .low
        let interpretation = isHighRisk
            ? "Padua \(score) — HIGH VTE risk; pharmacological prophylaxis recommended"
            : "Padua \(score) — LOW VTE risk; mechanical prophylaxis sufficient"
        let recs: [String] = isHighRisk
            ? ["Low molecular weight heparin (LMWH) prophylaxis — start immediately",
               "Enoxaparin 40 mg SC OD (CrCl ≥30 mL/min) or fondaparinux 2.5 mg SC OD",
               "Continue until patient is fully mobile (minimum 14 days in high-risk)",
               "Renal dose-adjust if CrCl <30 mL/min",
               "Combine with compression stockings or IPC device",
               "Review and restart prophylaxis if surgery is planned"]
            : ["Graduated compression stockings (class 2)",
               "Intermittent pneumatic compression (IPC) if stockings contraindicated",
               "Early mobilisation — key non-pharmacological intervention",
               "Reassess daily; escalate if score increases to ≥4"]
        let redFlags: [String] = isHighRisk
            ? ["Padua ≥4: high VTE risk — LMWH prophylaxis required unless contraindicated"]
            : []
        return ClinicalScore(
            systemName: "Padua Prediction Score",
            abbreviation: "Padua \(score)",
            score: Double(score), maxScore: 20,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Barbar S et al, J Thromb Haemost 2010. Validated in 1180 medical inpatients. Score ≥4 = high risk (11% VTE without prophylaxis vs 2.2% with LMWH). Complements Caprini for surgical patients."
        )
    }

    // MARK: - P-POSSUM

    static func ppossum(_ i: PPOSSUMInput) -> ClinicalScore {
        let ps = i.agePhys + i.cardiacSigns + i.respiratoryHx + i.sbpPhys +
                 i.hrPhys + i.gcsPhys + i.haemoglobin + i.wbcPhys +
                 i.urea + i.sodiumPhys + i.potassiumPhys + i.ecg
        let os = i.operativeMagnitude + i.numProcedures + i.bloodLoss +
                 i.peritonealSoiling + i.malignancy + i.urgency

        // P-POSSUM logistic regression (Whiteley et al, Br J Surg 1996)
        let lnOddsMort = -9.065 + (0.1692 * Double(ps)) + (0.1550 * Double(os))
        let predictedMortality = exp(lnOddsMort) / (1.0 + exp(lnOddsMort))
        let mortPct = predictedMortality * 100.0

        // Morbidity estimate (original POSSUM equation)
        let lnOddsMorb = -5.91 + (0.16 * Double(ps)) + (0.19 * Double(os))
        let predictedMorbidity = exp(lnOddsMorb) / (1.0 + exp(lnOddsMorb))
        let morbPct = predictedMorbidity * 100.0

        func si(_ label: String, _ pts: Int) -> ScoredItem {
            ScoredItem(label: label, points: Double(pts), present: pts > 1)
        }
        let items: [ScoredItem] = [
            si("Age", i.agePhys),
            si("Cardiac signs", i.cardiacSigns),
            si("Respiratory history", i.respiratoryHx),
            si("Systolic BP", i.sbpPhys),
            si("Heart rate", i.hrPhys),
            si("GCS", i.gcsPhys),
            si("Haemoglobin", i.haemoglobin),
            si("WBC", i.wbcPhys),
            si("Urea", i.urea),
            si("Sodium", i.sodiumPhys),
            si("Potassium", i.potassiumPhys),
            si("ECG", i.ecg),
            si("Operative magnitude", i.operativeMagnitude),
            si("No. of procedures", i.numProcedures),
            si("Blood loss", i.bloodLoss),
            si("Peritoneal soiling", i.peritonealSoiling),
            si("Malignancy", i.malignancy),
            si("Urgency", i.urgency),
        ]
        let (risk, interpretation, recs, redFlags) = ppossumRisk(mortPct: mortPct, morbPct: morbPct, ps: ps, os: os)
        return ClinicalScore(
            systemName: "P-POSSUM",
            abbreviation: String(format: "Mort %.1f%%", mortPct),
            score: mortPct,
            maxScore: 100,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Whiteley MS et al, Br J Surg 1996. P-POSSUM corrects original POSSUM over-prediction in low-risk patients. Physiological score \(ps), Operative score \(os). Predicted morbidity \(String(format: "%.1f", morbPct))%. Validated across general, vascular, and colorectal surgery."
        )
    }

    private static func ppossumRisk(mortPct: Double, morbPct: Double, ps: Int, os: Int) -> (ScoreRisk, String, [String], [String]) {
        let mortStr = String(format: "%.1f", mortPct)
        let morbStr = String(format: "%.1f", morbPct)
        switch mortPct {
        case ..<2:
            return (.low,
                    "P-POSSUM predicted mortality \(mortStr)% — low surgical risk (PS \(ps), OS \(os))",
                    ["Standard perioperative monitoring",
                     "Document score in operative plan for audit",
                     "Predicted morbidity: \(morbStr)%"],
                    [])
        case 2..<5:
            return (.low,
                    "P-POSSUM predicted mortality \(mortStr)% — low-moderate risk (PS \(ps), OS \(os))",
                    ["Ensure adequate preoperative optimisation",
                     "Discuss risk with patient during consent",
                     "Predicted morbidity: \(morbStr)%"],
                    [])
        case 5..<15:
            return (.moderate,
                    "P-POSSUM predicted mortality \(mortStr)% — moderate risk (PS \(ps), OS \(os))",
                    ["Senior surgeon and anaesthetist involvement",
                     "HDU/critical care bed should be arranged",
                     "Explicit discussion of risk in consent process",
                     "Predicted morbidity: \(morbStr)%"],
                    [])
        case 15..<30:
            return (.high,
                    "P-POSSUM predicted mortality \(mortStr)% — high risk (PS \(ps), OS \(os))",
                    ["Consultant-level surgeon required",
                     "ICU bed must be arranged preoperatively",
                     "Consider further optimisation before elective surgery",
                     "Detailed goals-of-care discussion with patient and family",
                     "Predicted morbidity: \(morbStr)%"],
                    ["P-POSSUM mortality ≥15% — high operative risk: ICU bed required"])
        default: // ≥30%
            return (.critical,
                    "P-POSSUM predicted mortality \(mortStr)% — very high risk (PS \(ps), OS \(os))",
                    ["Multi-disciplinary team review before proceeding",
                     "Weigh operative benefit against predicted mortality",
                     "Formal goals-of-care and advance directive discussion",
                     "ICU care essential",
                     "Consider non-operative management if appropriate",
                     "Predicted morbidity: \(morbStr)%"],
                    ["P-POSSUM mortality ≥30% — critical operative risk: MDT review required"])
        }
    }

    // MARK: - APACHE II

    static func apacheII(_ i: APACHEIIInput) -> ClinicalScore {
        let gcsPts = 15 - max(3, min(15, i.gcs))
        let aps = i.tempPoints + i.mapPoints + i.hrPoints + i.rrPoints +
                  i.oxyPoints + i.pHPoints + i.sodiumPoints + i.potassiumPoints +
                  i.creatininePoints + i.haematocritPoints + i.wbcPoints + gcsPts
        let total = aps + i.agePoints + i.chronicHealthPoints

        func si(_ label: String, _ pts: Int) -> ScoredItem {
            ScoredItem(label: label, points: Double(pts), present: pts > 0)
        }
        let items: [ScoredItem] = [
            si("Temperature",        i.tempPoints),
            si("Mean Arterial Pressure", i.mapPoints),
            si("Heart Rate",         i.hrPoints),
            si("Respiratory Rate",   i.rrPoints),
            si("Oxygenation",        i.oxyPoints),
            si("Arterial pH",        i.pHPoints),
            si("Serum Sodium",       i.sodiumPoints),
            si("Serum Potassium",    i.potassiumPoints),
            si("Creatinine",         i.creatininePoints),
            si("Haematocrit",        i.haematocritPoints),
            si("White Cell Count",   i.wbcPoints),
            si("GCS (15 − \(i.gcs))", gcsPts),
            si("Age",                i.agePoints),
            si("Chronic Health",     i.chronicHealthPoints),
        ]
        let (risk, interpretation, recs, redFlags) = apacheIIRisk(total)
        return ClinicalScore(
            systemName: "APACHE II Score",
            abbreviation: "APACHE II \(total)",
            score: Double(total), maxScore: 71,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Knaus WA et al, Crit Care Med 1985. Validated in 5030 ICU admissions. Predicted ICU mortality: <5=~4%, 10–14=~15%, 15–19=~25%, 20–24=~40%, 25–29=~55%, ≥30=~85%. Widely used for pancreatitis (Imrie criteria augment) and post-op ICU prognostication."
        )
    }

    private static func apacheIIRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case 0...4:
            return (.low,
                    "APACHE II \(s) — low severity; predicted ICU mortality ~4%",
                    ["Standard monitoring; reassess if clinical course deteriorates",
                     "Serial APACHE II at 24 h improves prognostic accuracy"],
                    [])
        case 5...9:
            return (.low,
                    "APACHE II \(s) — mild severity; predicted ICU mortality ~8%",
                    ["Close monitoring of vital signs and organ function",
                     "Daily APACHE II re-scoring recommended"],
                    [])
        case 10...14:
            return (.moderate,
                    "APACHE II \(s) — moderate severity; predicted ICU mortality ~15%",
                    ["Consider ICU admission if not already in place",
                     "Optimise fluid resuscitation, oxygenation, and antimicrobials",
                     "Identify and reverse underlying cause"],
                    [])
        case 15...19:
            return (.high,
                    "APACHE II \(s) — high severity; predicted ICU mortality ~25%",
                    ["ICU care indicated",
                     "Senior clinician review urgently",
                     "Discuss goals of care with patient and family",
                     "Organ support (vasopressors, ventilation) as clinically indicated"],
                    ["APACHE II ≥15: ~25% predicted mortality — escalate care now"])
        case 20...24:
            return (.high,
                    "APACHE II \(s) — very high severity; predicted ICU mortality ~40%",
                    ["Full ICU support — vasopressors, mechanical ventilation if required",
                     "Urgent senior specialist review",
                     "Early goals-of-care discussion",
                     "Surgical/source control for sepsis"],
                    ["APACHE II ≥20: ~40% predicted mortality — urgent escalation required"])
        default: // ≥25
            return (.critical,
                    "APACHE II \(s) — critical severity; predicted ICU mortality ≥55%",
                    ["Maximal ICU support with close re-evaluation",
                     "Immediate senior and specialist review",
                     "Formal goals-of-care discussion with family",
                     "Consider palliative pathway if refractory to maximal treatment"],
                    ["APACHE II ≥25: predicted mortality >55% — critical — immediate review"])
        }
    }

    // MARK: - Mannheim Peritonitis Index (MPI)

    static func mpi(_ i: MPIInput) -> ClinicalScore {
        var score = 0
        func add(_ pts: Int, _ cond: Bool) { if cond { score += pts } }
        add(5, i.ageOver50)
        add(5, i.femaleSex)
        add(7, i.organFailure)
        add(4, i.malignancy)
        add(4, i.durationOver24h)
        add(4, i.nonColonicOrigin)
        add(6, i.generalizedPeritonitis)
        score += i.exudate

        let exLabel: String = switch i.exudate {
        case 6:  "Cloudy / purulent exudate"
        case 12: "Faecal / faeculent exudate"
        default: "Clear / serous exudate"
        }
        let items: [ScoredItem] = [
            ScoredItem(label: "Age >50 years",                              points: 5,  present: i.ageOver50),
            ScoredItem(label: "Female sex",                                 points: 5,  present: i.femaleSex),
            ScoredItem(label: "Organ failure (BP <80 / Cr >177 / resp)",    points: 7,  present: i.organFailure),
            ScoredItem(label: "Malignancy",                                 points: 4,  present: i.malignancy),
            ScoredItem(label: "Duration of peritonitis >24 h pre-op",       points: 4,  present: i.durationOver24h),
            ScoredItem(label: "Non-colonic origin (gastric/duodenal/SB)",   points: 4,  present: i.nonColonicOrigin),
            ScoredItem(label: "Diffuse generalised peritonitis",            points: 6,  present: i.generalizedPeritonitis),
            ScoredItem(label: exLabel,                                      points: Double(i.exudate), present: i.exudate > 0),
        ]
        let (risk, interpretation, recs, redFlags) = mpiRisk(score)
        return ClinicalScore(
            systemName: "Mannheim Peritonitis Index",
            abbreviation: "MPI \(score)",
            score: Double(score), maxScore: 47,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Wacha H & Linder MM, Theor Surg 1983. Score <21 = low risk (<9% mortality); 21–29 = intermediate (~29%); ≥30 = high (>60%). Validated across general surgical populations. Guides laparotomy strategy, ICU admission, and goals-of-care discussions."
        )
    }

    private static func mpiRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case ..<21:
            return (.low,
                    "MPI \(s) — low-risk peritonitis (predicted mortality <9%)",
                    ["Standard perioperative care",
                     "Source-control surgery — primary repair / anastomosis appropriate",
                     "Document score for surgical audit"],
                    [])
        case 21..<30:
            return (.moderate,
                    "MPI \(s) — intermediate peritonitis risk (predicted mortality ~29%)",
                    ["Optimise resuscitation before theatre",
                     "ICU or high-dependency admission post-operatively",
                     "Consider damage-control strategy if haemodynamically unstable",
                     "Planned relook at 48 h if contamination was extensive"],
                    ["MPI 21–29: significant predicted mortality — HDU/ICU review required"])
        default:  // ≥30
            return (.critical,
                    "MPI \(s) — high-risk peritonitis (predicted mortality >60%)",
                    ["Aggressive resuscitation — septic shock protocol",
                     "Damage-control laparotomy; defer definitive reconstruction",
                     "Planned open-abdomen / relook strategy",
                     "Mandatory ICU admission",
                     "Early goals-of-care discussion with patient and family"],
                    ["MPI ≥30: predicted mortality >60% — urgent multi-disciplinary decision required"])
        }
    }

    // MARK: - CTSI (Balthazar CT Severity Index)

    static func ctsi(_ i: CTSIInput) -> ClinicalScore {
        let total = i.balthazarGrade + i.necrosisScore
        let (risk, interp, recs, flags) = ctsiRisk(total)
        var items: [ScoreItem] = []
        let gradeLabels = ["A — Normal pancreas", "B — Oedematous pancreas",
                           "C — Peripancreatic fat stranding",
                           "D — Single peripancreatic fluid collection",
                           "E — ≥2 fluid collections or gas in/around pancreas"]
        let gradeLabel = i.balthazarGrade < gradeLabels.count
            ? gradeLabels[i.balthazarGrade] : "Grade \(i.balthazarGrade)"
        items.append(ScoreItem(label: "Balthazar grade — \(gradeLabel)",
                               points: Double(i.balthazarGrade),
                               present: i.balthazarGrade > 0))
        let necLabels = [0: "None", 2: "Necrosis <33%", 4: "Necrosis 33–50%", 6: "Necrosis >50%"]
        items.append(ScoreItem(label: necLabels[i.necrosisScore] ?? "Necrosis",
                               points: Double(i.necrosisScore),
                               present: i.necrosisScore > 0))
        return ClinicalScore(
            systemName: "CT Severity Index",
            abbreviation: "CTSI \(total)/10",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: interp,
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Balthazar EA et al. Radiology 1990; 174:331–336."
        )
    }

    // MARK: - Forrest Classification (peptic ulcer bleeding stigmata)

    static func forrest(_ i: ForrestInput) -> ClinicalScore {
        // Map grade to rebleed risk %, endoscopy recommendation, and score representation
        struct ForrestData {
            let label: String; let rebleedPct: Int; let risk: ScoreRisk
            let recs: [String]; let flags: [String]
        }
        let table: [Int: ForrestData] = [
            1: ForrestData(label: "Ia — Spurting arterial bleeding", rebleedPct: 90, risk: .critical,
                recs: ["Dual endoscopic therapy (injection + thermal/clip)",
                        "IV proton pump inhibitor infusion (80 mg bolus then 8 mg/h for 72 h)",
                        "Repeat endoscopy at 24 h",
                        "Surgical or interventional radiology backup immediately available",
                        "ICU-level monitoring; cross-match 4–6 units blood"],
                flags: ["Active arterial spurting — highest rebleed risk (~90%); surgery/IR if endoscopic haemostasis fails"]),
            2: ForrestData(label: "Ib — Oozing / non-spurting active bleeding", rebleedPct: 55, risk: .critical,
                recs: ["Dual endoscopic therapy",
                        "IV PPI infusion (80 mg bolus then 8 mg/h for 72 h)",
                        "Repeat endoscopy at 24 h if high-risk features persist",
                        "ICU/HDU monitoring; blood transfusion threshold Hb <80 g/L"],
                flags: ["Active oozing — rebleed risk ~55%"]),
            3: ForrestData(label: "IIa — Non-bleeding visible vessel", rebleedPct: 43, risk: .high,
                recs: ["Endoscopic therapy (thermal coagulation ± injection)",
                        "IV PPI infusion 72 h",
                        "Hospital admission; repeat endoscopy in 24 h",
                        "Oral PPI once infusion complete; H. pylori test and treat"],
                flags: ["Visible vessel — rebleed risk ~43%"]),
            4: ForrestData(label: "IIb — Adherent clot", rebleedPct: 22, risk: .moderate,
                recs: ["Attempt clot removal with endoscopic therapy (injection then wash)",
                        "If underlying vessel visible → treat as IIa",
                        "IV PPI infusion 72 h; oral PPI maintenance",
                        "Hospital admission 48–72 h; H. pylori test and treat"],
                flags: []),
            5: ForrestData(label: "IIc — Flat pigmented haematin spot", rebleedPct: 10, risk: .low,
                recs: ["Endoscopic therapy not routinely required",
                        "High-dose oral PPI (40 mg bd for 14 days)",
                        "H. pylori test and treat if not already done",
                        "Early discharge may be appropriate in low-risk patients (Blatchford 0–1)"],
                flags: []),
            6: ForrestData(label: "III — Clean ulcer base", rebleedPct: 5, risk: .low,
                recs: ["No endoscopic therapy required",
                        "Oral PPI (40 mg once daily × 4–8 weeks)",
                        "H. pylori test and treat",
                        "Consider early discharge in Blatchford score 0 patients",
                        "Outpatient follow-up; consider repeat endoscopy at 6–8 weeks if gastric ulcer"],
                flags: [])
        ]
        let data = table[i.grade] ?? table[6]!
        let items: [ScoreItem] = [
            ScoreItem(label: data.label, points: Double(data.rebleedPct), present: true)
        ]
        return ClinicalScore(
            systemName: "Forrest Classification",
            abbreviation: i.grade <= 2 ? "Ia/Ib" : i.grade == 3 ? "IIa" : i.grade == 4 ? "IIb" : i.grade == 5 ? "IIc" : "III",
            score: Double(i.grade), maxScore: 6,
            risk: data.risk,
            interpretation: "\(data.label) — estimated rebleed risk \(data.rebleedPct)%",
            items: items,
            recommendations: data.recs,
            redFlags: data.flags,
            evidenceNote: "Forrest JAH et al. Lancet 1974; 2:394–397. Laine L & Peterson WL. N Engl J Med 1994; 331:717–727."
        )
    }

    // MARK: - NIHSS (NIH Stroke Scale)

    static func nihss(_ i: NIHSSInput) -> ClinicalScore {
        let total = i.consciousness + i.locQuestions + i.locCommands +
                    i.gazeDeviation + i.visualFields + i.facialPalsy +
                    i.motorArmLeft + i.motorArmRight +
                    i.motorLegLeft + i.motorLegRight +
                    i.limbAtaxia + i.sensory + i.language +
                    i.dysarthria + i.extinction

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0:
            (.low, "No stroke deficit — NIHSS 0",
             ["Review for TIA; consider DWI-MRI if symptoms resolved (ABCD² ≥4)",
              "Assess for AF, carotid disease, and modifiable stroke risk factors",
              "Early dual antiplatelet (if TIA/minor stroke): aspirin + clopidogrel for 21 days"],
             [])
        case 1...4:
            (.low, "Minor stroke — NIHSS 1–4",
             ["Admit to stroke unit for monitoring and investigation",
              "Brain CT/MRI within 24 h; MRI DWI preferred for lacunar/posterior fossa lesions",
              "Antiplatelet therapy or anticoagulation per aetiology (AF → NOAC; non-cardioembolic → antiplatelet)",
              "Swallowing screen before oral intake; physiotherapy and OT assessment",
              "Early secondary prevention: BP, lipid, glucose management"],
             [])
        case 5...15:
            (.moderate, "Moderate stroke — NIHSS 5–15",
             ["Immediate stroke unit admission; continuous monitoring",
              "IV alteplase if within 4.5 h of onset and eligible (NIHSS 4–25 typical range)",
              "Consider mechanical thrombectomy if large vessel occlusion (NIHSS ≥6) within 24 h",
              "CT/CTA or MRI/MRA urgently; carotid imaging if anterior circulation stroke",
              "Dysphagia assessment; NG feeding if unsafe swallow",
              "Neurological rehabilitation team referral within 24–48 h"],
             [])
        case 16...20:
            (.high, "Moderate-severe stroke — NIHSS 16–20",
             ["Immediate stroke unit or HDU admission; airway protection assessment",
              "Urgent thrombectomy evaluation for large vessel occlusion",
              "Alteplase if within 4.5 h and no contraindications",
              "Neurosurgical opinion for cerebellar or malignant MCA infarction",
              "Intensive rehabilitation planning; speech and language therapy",
              "Family counselling regarding functional prognosis"],
             ["NIHSS 16–20 — moderate-severe stroke; urgent thrombectomy evaluation and stroke unit care required"])
        default:
            (.high, "Severe stroke — NIHSS ≥21",
             ["ICU or stroke HDU; early discussion with neurosurgical team",
              "Decompressive hemicraniectomy for malignant MCA infarction (age <60 within 48 h)",
              "Consider thrombectomy if LVO identified and within intervention window",
              "Palliative care consultation if appropriate given stroke severity and premorbid status",
              "Full rehabilitation potential assessment after initial stabilisation",
              "Hydration, aspiration pneumonia prevention, pressure care, anticoagulation for DVT prophylaxis"],
             ["NIHSS ≥21 — severe stroke; high mortality and disability risk; ICU-level care and early neurosurgical consultation required"])
        }

        let items: [ScoreItem] = [
            ScoreItem(label: "Level of consciousness (\(["Alert","Not alert/arousable","Obtunded","Unresponsive"][min(i.consciousness,3)]))", points: Double(i.consciousness), present: i.consciousness > 0),
            ScoreItem(label: "LOC questions (month/age) (\(["Both correct","One correct","Neither"][min(i.locQuestions,2)]))", points: Double(i.locQuestions), present: i.locQuestions > 0),
            ScoreItem(label: "LOC commands (open/close eyes, grip) (\(["Both","One","Neither"][min(i.locCommands,2)]))", points: Double(i.locCommands), present: i.locCommands > 0),
            ScoreItem(label: "Gaze (\(["Normal","Partial palsy","Forced deviation"][min(i.gazeDeviation,2)]))", points: Double(i.gazeDeviation), present: i.gazeDeviation > 0),
            ScoreItem(label: "Visual fields (\(["No loss","Partial hemianopia","Complete hemianopia","Bilateral"][min(i.visualFields,3)]))", points: Double(i.visualFields), present: i.visualFields > 0),
            ScoreItem(label: "Facial palsy (\(["Normal","Minor","Partial","Complete"][min(i.facialPalsy,3)]))", points: Double(i.facialPalsy), present: i.facialPalsy > 0),
            ScoreItem(label: "Motor arm left (\(["No drift","Drift <10s","Effort vs gravity","No effort","No movement"][min(i.motorArmLeft,4)]))", points: Double(i.motorArmLeft), present: i.motorArmLeft > 0),
            ScoreItem(label: "Motor arm right (\(["No drift","Drift <10s","Effort vs gravity","No effort","No movement"][min(i.motorArmRight,4)]))", points: Double(i.motorArmRight), present: i.motorArmRight > 0),
            ScoreItem(label: "Motor leg left (\(["No drift","Drift <5s","Effort vs gravity","No effort","No movement"][min(i.motorLegLeft,4)]))", points: Double(i.motorLegLeft), present: i.motorLegLeft > 0),
            ScoreItem(label: "Motor leg right (\(["No drift","Drift <5s","Effort vs gravity","No effort","No movement"][min(i.motorLegRight,4)]))", points: Double(i.motorLegRight), present: i.motorLegRight > 0),
            ScoreItem(label: "Limb ataxia (\(["Absent","One limb","Two limbs"][min(i.limbAtaxia,2)]))", points: Double(i.limbAtaxia), present: i.limbAtaxia > 0),
            ScoreItem(label: "Sensory (\(["Normal","Mild-moderate loss","Severe/absent"][min(i.sensory,2)]))", points: Double(i.sensory), present: i.sensory > 0),
            ScoreItem(label: "Language (\(["No aphasia","Mild aphasia","Severe aphasia","Mute/global"][min(i.language,3)]))", points: Double(i.language), present: i.language > 0),
            ScoreItem(label: "Dysarthria (\(["Normal","Mild-moderate","Severe/intubated"][min(i.dysarthria,2)]))", points: Double(i.dysarthria), present: i.dysarthria > 0),
            ScoreItem(label: "Extinction/inattention (\(["None","One modality","Profound"][min(i.extinction,2)]))", points: Double(i.extinction), present: i.extinction > 0)
        ]

        return ClinicalScore(
            systemName: "NIH Stroke Scale",
            abbreviation: "NIHSS",
            score: Double(total), maxScore: 42,
            risk: risk,
            interpretation: "NIHSS \(total) — \(interp)",
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Brott T et al. Stroke 1989;20:864–870. Adams HP et al. Stroke 1999;30:1765–1769."
        )
    }

    // MARK: - EuroSCORE II (Cardiac Surgery Operative Mortality)

    static func euroScoreII(_ i: EuroScoreIIInput) -> ClinicalScore {
        // Logistic EuroSCORE II — Nashef SAM et al. Eur J Cardiothorac Surg 2012;41:734–745.
        // Predicted mortality % = 100 × eˣ / (1 + eˣ) where x = β₀ + Σ(βᵢ × factor)
        var x = -5.324537

        // Patient factors
        let ageBoost = max(0.0, Double(i.age - 60)) * 0.0285489
        x += ageBoost
        if i.female                    { x += 0.2196434  }
        switch i.renalImpairment {
        case 1:                          x += 0.3541226
        case 2:                          x += 0.6521653
        default: break
        }
        if i.extracardiacArteriopathy  { x += 0.5085682  }
        if i.poorMobility              { x += 0.2971552  }
        if i.previousCardiacSurgery    { x += 1.0023510  }
        if i.chronicLungDisease        { x += 0.1886564  }
        if i.activeEndocarditis        { x += 0.6194522  }
        if i.criticalPreoperativeState { x += 1.0856296  }
        if i.diabetesOnInsulin         { x += 0.3304052  }
        switch i.nyhaClass {
        case 1:                          x += 0.1070545
        case 2:                          x += 0.2338955
        case 3:                          x += 0.5718132
        default: break
        }
        if i.ccsClass4Angina           { x += 0.2218732  }
        switch i.lvFunction {
        case 1:                          x += 0.3196276
        case 2:                          x += 1.5169013
        default: break
        }
        if i.recentMI                  { x += 0.5460218  }
        switch i.pulmonaryHypertension {
        case 1:                          x += 0.6084972
        case 2:                          x += 1.3765812
        default: break
        }
        switch i.urgency {
        case 1:                          x += 0.4084417
        case 2:                          x += 0.9361202
        case 3:                          x += 1.8071808
        default: break
        }
        switch i.weightOfIntervention {
        case 1:                          x += 0.5521478
        case 2:                          x += 0.9724533
        case 3:                          x += 1.6151723
        default: break
        }
        if i.surgeryOnThoracicAorta    { x += 1.1745886  }
        if i.postInfarctSeptalRupture  { x += 1.4630660  }

        let pct = 100.0 * exp(x) / (1.0 + exp(x))
        let pctRounded = (pct * 10).rounded() / 10

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch pct {
        case ..<2:
            (.low, String(format: "Predicted operative mortality %.1f%% (low risk)", pct),
             ["Proceed with standard cardiac surgical care",
              "Routine anaesthetic and surgical team pre-operative assessment",
              "ICU care post-operatively as per unit protocol",
              "Document EuroSCORE II result in surgical consent discussion"],
             [])
        case 2..<5:
            (.moderate, String(format: "Predicted operative mortality %.1f%% (moderate risk)", pct),
             ["Senior anaesthetist and cardiac surgeon review pre-operatively",
              "Detailed consent discussion including predicted mortality risk",
              "Optimise modifiable risk factors before surgery",
              "ICU/HDU post-operative care plan; perfusionist briefing",
              "Consider cardiac catheterisation if not yet done"],
             [])
        default:
            (.high, String(format: "Predicted operative mortality %.1f%% (high risk)", pct),
             ["Multidisciplinary heart team (MDT) review mandatory before proceeding",
              "Comprehensive risk-benefit discussion with patient and family",
              "Explore alternatives: transcatheter procedures (TAVI, MICS) if applicable",
              "Cardiology and anaesthetic co-management; optimise haemodynamics pre-operatively",
              "ICU post-operative care; senior perfusionist and OR team briefing",
              "Consider palliative or conservative pathway if risk exceeds benefit"],
             [String(format: "EuroSCORE II %.1f%% — high operative mortality; MDT review and detailed consent required before proceeding", pct)])
        }

        let nyhaLabels = ["I", "II", "III", "IV"]
        let renalLabels = ["None", "Creatinine 151–176 μmol/L", "Dialysis or >176 μmol/L"]
        let lvLabels = ["Good >50%", "Moderate 31–50%", "Poor ≤30%"]
        let urgencyLabels = ["Elective", "Urgent", "Emergency", "Salvage"]
        let wLabels = ["Isolated CABG", "Single non-CABG procedure", "Two procedures", "Three or more procedures"]
        let phLabels = ["None", "Moderate 31–55 mmHg", "Severe >55 mmHg"]

        let items: [ScoreItem] = [
            ScoreItem(label: "Age \(i.age) years (+\(String(format: "%.3f", ageBoost)) above 60)", points: ageBoost, present: i.age > 60),
            ScoreItem(label: "Female sex +0.220", points: 0.2196434, present: i.female),
            ScoreItem(label: "Renal impairment: \(renalLabels[min(i.renalImpairment, 2)])", points: i.renalImpairment == 1 ? 0.3541226 : 0.6521653, present: i.renalImpairment > 0),
            ScoreItem(label: "Extracardiac arteriopathy +0.509", points: 0.5085682, present: i.extracardiacArteriopathy),
            ScoreItem(label: "Poor mobility +0.297", points: 0.2971552, present: i.poorMobility),
            ScoreItem(label: "Previous cardiac surgery +1.002", points: 1.0023510, present: i.previousCardiacSurgery),
            ScoreItem(label: "Chronic lung disease +0.189", points: 0.1886564, present: i.chronicLungDisease),
            ScoreItem(label: "Active endocarditis +0.619", points: 0.6194522, present: i.activeEndocarditis),
            ScoreItem(label: "Critical preoperative state +1.086", points: 1.0856296, present: i.criticalPreoperativeState),
            ScoreItem(label: "Diabetes on insulin +0.330", points: 0.3304052, present: i.diabetesOnInsulin),
            ScoreItem(label: "NYHA class \(nyhaLabels[min(i.nyhaClass, 3)])", points: [0, 0.1070545, 0.2338955, 0.5718132][min(i.nyhaClass, 3)], present: i.nyhaClass > 0),
            ScoreItem(label: "CCS Class 4 angina +0.222", points: 0.2218732, present: i.ccsClass4Angina),
            ScoreItem(label: "LV function: \(lvLabels[min(i.lvFunction, 2)])", points: [0, 0.3196276, 1.5169013][min(i.lvFunction, 2)], present: i.lvFunction > 0),
            ScoreItem(label: "Recent MI (<90 days) +0.546", points: 0.5460218, present: i.recentMI),
            ScoreItem(label: "Pulmonary hypertension: \(phLabels[min(i.pulmonaryHypertension, 2)])", points: i.pulmonaryHypertension == 1 ? 0.6084972 : 1.3765812, present: i.pulmonaryHypertension > 0),
            ScoreItem(label: "Urgency: \(urgencyLabels[min(i.urgency, 3)])", points: [0, 0.4084417, 0.9361202, 1.8071808][min(i.urgency, 3)], present: i.urgency > 0),
            ScoreItem(label: "Weight of intervention: \(wLabels[min(i.weightOfIntervention, 3)])", points: [0, 0.5521478, 0.9724533, 1.6151723][min(i.weightOfIntervention, 3)], present: i.weightOfIntervention > 0),
            ScoreItem(label: "Surgery on thoracic aorta +1.175", points: 1.1745886, present: i.surgeryOnThoracicAorta),
            ScoreItem(label: "Post-infarct septal rupture +1.463", points: 1.4630660, present: i.postInfarctSeptalRupture)
        ]

        return ClinicalScore(
            systemName: "EuroSCORE II",
            abbreviation: "EuroSCORE",
            score: pctRounded, maxScore: 100,
            risk: risk,
            interpretation: interp,
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Nashef SAM et al. Eur J Cardiothorac Surg 2012;41:734–745. www.euroscore.org"
        )
    }

    // MARK: - Barthel Index (ADL Functional Independence)

    static func barthel(_ i: BarthelInput) -> ClinicalScore {
        // Items and valid point values:
        // feeding: 0, 5, 10  bathing: 0, 5  grooming: 0, 5  dressing: 0, 5, 10
        // bowels: 0, 5, 10   bladder: 0, 5, 10  toiletUse: 0, 5, 10
        // transfers: 0, 5, 10, 15   mobility: 0, 5, 10, 15   stairs: 0, 5, 10
        let total = i.feeding + i.bathing + i.grooming + i.dressing +
                    i.bowels + i.bladder + i.toiletUse +
                    i.transfers + i.mobility + i.stairs

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...20:
            (.high, "Severe functional dependency — total score \(total)/100",
             ["Urgent occupational therapy and physiotherapy assessment",
              "High-dependency care: pressure area care, continence support, assisted feeding",
              "Consider inpatient rehabilitation or care facility placement",
              "Full nursing dependency plan; regular functional reassessment",
              "Screen for delirium, depression, and social support needs"],
             ["Barthel ≤20 — severe dependency; high nursing and care needs; inpatient or institutional care may be required"])
        case 21...60:
            (.moderate, "Moderate functional dependency — score \(total)/100",
             ["Physiotherapy and occupational therapy referral for rehabilitation programme",
              "Assistive device assessment (walking aids, grab rails, bath seat)",
              "Discharge planning: community care needs assessment",
              "Falls risk assessment; structured ADL rehabilitation",
              "Social work review if home support inadequate"],
             [])
        case 61...90:
            (.low, "Mild functional dependency — score \(total)/100",
             ["Occupational therapy home assessment before discharge",
              "Identify specific ADL deficits and target with rehabilitation",
              "Consider community physiotherapy or outpatient rehabilitation",
              "Review home safety and carer support needs"],
             [])
        default:
            (.low, "Functionally independent — score \(total)/100",
             ["Standard discharge planning; no specific ADL support required",
              "Reassess if functional decline develops post-operatively or during admission"],
             [])
        }

        let items: [ScoreItem] = [
            ScoreItem(label: "Feeding (\(["0 — unable","5 — needs help","10 — independent"][min(i.feeding/5, 2)]))", points: Double(i.feeding), present: i.feeding > 0),
            ScoreItem(label: "Bathing (\(i.bathing == 0 ? "0 — dependent" : "5 — independent"))", points: Double(i.bathing), present: i.bathing > 0),
            ScoreItem(label: "Grooming (\(i.grooming == 0 ? "0 — dependent" : "5 — independent"))", points: Double(i.grooming), present: i.grooming > 0),
            ScoreItem(label: "Dressing (\(["0 — dependent","5 — needs help","10 — independent"][min(i.dressing/5, 2)]))", points: Double(i.dressing), present: i.dressing > 0),
            ScoreItem(label: "Bowel control (\(["0 — incontinent","5 — occasional accident","10 — continent"][min(i.bowels/5, 2)]))", points: Double(i.bowels), present: i.bowels > 0),
            ScoreItem(label: "Bladder control (\(["0 — incontinent","5 — occasional accident","10 — continent"][min(i.bladder/5, 2)]))", points: Double(i.bladder), present: i.bladder > 0),
            ScoreItem(label: "Toilet use (\(["0 — dependent","5 — needs help","10 — independent"][min(i.toiletUse/5, 2)]))", points: Double(i.toiletUse), present: i.toiletUse > 0),
            ScoreItem(label: "Transfers bed-chair (\(["0 — unable","5 — major help","10 — minor help","15 — independent"][min(i.transfers/5, 3)]))", points: Double(i.transfers), present: i.transfers > 0),
            ScoreItem(label: "Mobility (\(["0 — immobile","5 — wheelchair","10 — walks with help","15 — independent"][min(i.mobility/5, 3)]))", points: Double(i.mobility), present: i.mobility > 0),
            ScoreItem(label: "Stairs (\(["0 — unable","5 — needs help","10 — independent"][min(i.stairs/5, 2)]))", points: Double(i.stairs), present: i.stairs > 0)
        ]

        return ClinicalScore(
            systemName: "Barthel Index",
            abbreviation: "BI",
            score: Double(total), maxScore: 100,
            risk: risk,
            interpretation: interp,
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Mahoney FI, Barthel DW. Maryland State Med J 1965;14:61–65. Collin C et al. Disabil Rehabil 1988;10:63–67."
        )
    }

    // MARK: - DASI (Duke Activity Status Index)

    static func dasi(_ i: DASIInput) -> ClinicalScore {
        // MET-weighted sum of 12 yes/no functional capacity questions
        // Hlatky MA et al. A brief self-administered questionnaire to determine functional capacity.
        // Am J Cardiol 1989;64:651–654.
        var total = 0.0
        if i.takeCareOfSelf            { total += 2.75 }
        if i.walkIndoors               { total += 1.75 }
        if i.walkOneOrTwoBlocks        { total += 2.75 }
        if i.climbStairs               { total += 5.50 }
        if i.runShortDistance          { total += 8.00 }
        if i.doLightWork               { total += 2.70 }
        if i.doModerateWork            { total += 3.50 }
        if i.doHeavyWork               { total += 8.00 }
        if i.doYardWork                { total += 4.50 }
        if i.haveSexualActivity        { total += 5.25 }
        if i.participateInModerateRecreation { total += 6.00 }
        if i.participateInStrenuous    { total += 7.50 }

        // <34 ≈ <4 METs (poor), 34–46 ≈ 4–6 METs (moderate), >46 ≈ >6 METs (good)
        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case ..<34:
            (.high, "Poor functional capacity (<4 METs) — elevated perioperative cardiac risk",
             ["Formal cardiopulmonary exercise testing (CPET) if major surgery planned",
              "Cardiology pre-operative assessment prior to elective intermediate/high-risk surgery",
              "Optimise modifiable risk factors: blood pressure, diabetes, anaemia, dyspnoea",
              "Consider cardiac stress imaging if functional capacity cannot be adequately assessed",
              "Physiotherapy prehabilitation programme to improve exercise tolerance before surgery"],
             ["DASI <34 — functional capacity below 4 METs; elevated perioperative cardiac risk; cardiology review recommended before major surgery"])
        case 34...46:
            (.moderate, "Moderate functional capacity (4–6 METs)",
             ["Routine pre-operative cardiorespiratory assessment",
              "Optimise cardiovascular risk factors pre-operatively",
              "Anaesthetic team review for high-risk or prolonged procedures",
              "Encourage graduated aerobic conditioning before elective major surgery"],
             [])
        default:
            (.low, "Good functional capacity (>6 METs) — low perioperative cardiac risk",
             ["Standard pre-operative assessment — no additional cardiac workup required for most procedures",
              "Maintain current physical activity levels; document exercise tolerance in surgical consent",
              "Reassess if new cardiorespiratory symptoms develop pre-operatively"],
             [])
        }

        let items: [ScoreItem] = [
            ScoreItem(label: "Can take care of self (ADLs) +2.75", points: 2.75, present: i.takeCareOfSelf),
            ScoreItem(label: "Can walk indoors on level ground +1.75", points: 1.75, present: i.walkIndoors),
            ScoreItem(label: "Can walk 1–2 blocks on level ground +2.75", points: 2.75, present: i.walkOneOrTwoBlocks),
            ScoreItem(label: "Can climb a flight of stairs or walk up a hill +5.50", points: 5.50, present: i.climbStairs),
            ScoreItem(label: "Can run a short distance +8.00", points: 8.00, present: i.runShortDistance),
            ScoreItem(label: "Can do light housework (dusting, washing dishes) +2.70", points: 2.70, present: i.doLightWork),
            ScoreItem(label: "Can do moderate housework (vacuuming, carrying groceries) +3.50", points: 3.50, present: i.doModerateWork),
            ScoreItem(label: "Can do heavy work (scrubbing floors, moving furniture) +8.00", points: 8.00, present: i.doHeavyWork),
            ScoreItem(label: "Can do yardwork (raking, weeding, pushing mower) +4.50", points: 4.50, present: i.doYardWork),
            ScoreItem(label: "Can have sexual activity +5.25", points: 5.25, present: i.haveSexualActivity),
            ScoreItem(label: "Moderate recreation (golf, bowling, dancing) +6.00", points: 6.00, present: i.participateInModerateRecreation),
            ScoreItem(label: "Strenuous sports (swimming, tennis, football) +7.50", points: 7.50, present: i.participateInStrenuous)
        ]

        let rounded = (total * 10).rounded() / 10
        return ClinicalScore(
            systemName: "Duke Activity Status Index",
            abbreviation: "DASI",
            score: rounded, maxScore: 58.2,
            risk: risk,
            interpretation: "DASI \(String(format: "%.1f", rounded)) — \(interp)",
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Hlatky MA et al. Am J Cardiol 1989;64:651–654."
        )
    }

    // MARK: - GRACE Score (ACS Mortality)

    static func grace(_ i: GRACEInput) -> ClinicalScore {
        let agePts   = [0, 18, 36, 55, 73, 91][min(i.ageCategory, 5)]
        let hrPts    = [0,  7, 13, 23, 36, 46][min(i.heartRate, 5)]
        let sbpPts   = [63, 58, 47, 37, 26, 11, 0][min(i.systolicBP, 6)]
        let creatPts = [2,  5,  8, 11, 14, 23, 31][min(i.creatinine, 6)]
        let killipPts = [0, 21, 43, 64][min(i.killipClass, 3)]
        var total = agePts + hrPts + sbpPts + creatPts + killipPts
        if i.cardiacArrest { total += 43 }
        if i.elevatedMarkers { total += 15 }
        if i.stDeviation { total += 30 }

        // In-hospital mortality thresholds (Granger 2003)
        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0..<109:
            (.low, "Low risk — in-hospital mortality <1%",
             ["Evaluate for early discharge with outpatient cardiology follow-up",
              "Antiplatelet therapy (aspirin + P2Y12 inhibitor); statin; beta-blocker",
              "Non-invasive stress test or elective coronary angiography within 72 h",
              "Cardiac rehab referral post-discharge"],
             [])
        case 109...140:
            (.moderate, "Moderate risk — in-hospital mortality 1–3%",
             ["Admission to monitored cardiac care unit or HDU",
              "Serial ECG and troponin at 3–6 h",
              "Dual antiplatelet therapy + anticoagulation per ACS protocol",
              "Coronary angiography within 24 h (intermediate/high-risk NSTEMI pathway)",
              "Cardiology review within 12 h"],
             [])
        default:
            (.high, "High risk — in-hospital mortality >3% (score >140 = high risk)",
             ["Immediate cardiology consult; consider cardiac catheterisation lab activation",
              "Urgent coronary angiography (≤24 h); prepare for PCI or CABG if indicated",
              "Continuous ECG monitoring; IV access; anticoagulation + dual antiplatelet",
              "ICU or CCU level care; haemodynamic monitoring",
              "Serial troponin, ECG; watch for cardiogenic shock and mechanical complications"],
             ["GRACE >140 — high in-hospital mortality; urgent cardiologist involvement required"])
        }

        let items: [ScoreItem] = [
            ScoreItem(label: "Age category (\(["<40","40–49","50–59","60–69","70–79","≥80"][min(i.ageCategory,5)])) +\(agePts)", points: Double(agePts), present: true),
            ScoreItem(label: "Heart rate (\(["<70","70–89","90–109","110–149","150–199","≥200"][min(i.heartRate,5)]) bpm) +\(hrPts)", points: Double(hrPts), present: true),
            ScoreItem(label: "Systolic BP (\(["<80","80–99","100–119","120–139","140–159","160–199","≥200"][min(i.systolicBP,6)]) mmHg) +\(sbpPts)", points: Double(sbpPts), present: true),
            ScoreItem(label: "Creatinine (\(["0–0.39","0.4–0.79","0.8–1.19","1.2–1.59","1.6–1.99","2.0–3.99","≥4.0"][min(i.creatinine,6)]) mg/dL) +\(creatPts)", points: Double(creatPts), present: true),
            ScoreItem(label: "Killip class \(i.killipClass + 1) +\(killipPts)", points: Double(killipPts), present: true),
            ScoreItem(label: "Cardiac arrest at admission +43", points: 43, present: i.cardiacArrest),
            ScoreItem(label: "Elevated cardiac markers +15", points: 15, present: i.elevatedMarkers),
            ScoreItem(label: "ST-segment deviation +30", points: 30, present: i.stDeviation)
        ]

        return ClinicalScore(
            systemName: "GRACE Score",
            abbreviation: "GRACE",
            score: Double(total), maxScore: 372,
            risk: risk,
            interpretation: "GRACE \(total) — \(interp)",
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Granger CB et al. Lancet 2003;362:777–781. Fox KA et al. Eur Heart J 2006;27:2755–2764."
        )
    }

    // MARK: - Surgical Apgar Score

    static func surgicalApgar(_ i: SurgicalApgarInput) -> ClinicalScore {
        // EBL points: >1000=0, 601-1000=1, 101-600=2, ≤100=3
        let eblPts: Int = switch i.estimatedBloodLoss {
        case 0: 0   // >1000
        case 1: 1   // 601-1000
        case 2: 2   // 101-600
        default: 3  // ≤100
        }
        // Lowest MAP points: <40=0, 40-54=1, 55-69=2, ≥70=3
        let mapPts: Int = switch i.lowestMAP {
        case 0: 0   // <40
        case 1: 1   // 40-54
        case 2: 2   // 55-69
        default: 3  // ≥70
        }
        // Lowest HR points: ≥120 or <40=0, 101-119=0, 86-100=1, 56-85=3, 41-55=2, ≤40=0
        let hrPts: Int = switch i.lowestHeartRate {
        case 0: 0   // ≥120
        case 1: 0   // 101-119
        case 2: 1   // 86-100
        case 3: 3   // 56-85 (normal)
        case 4: 2   // 41-55
        default: 0  // ≤40
        }
        let total = eblPts + mapPts + hrPts

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...2:
            (.critical, "Very high risk of major complication or death (~56% 30-day morbidity/mortality)",
             ["Immediate postoperative ICU/HDU admission",
              "Senior surgical and anaesthetic review; consider re-operation if clinical concern",
              "Continuous haemodynamic monitoring; early vasopressor support if MAP <65 mmHg",
              "Serial organ function monitoring (renal, hepatic, respiratory)",
              "Involve critical care team in postoperative management plan"],
             ["SAS ≤2 — very high surgical risk; ICU/HDU admission essential"])
        case 3...4:
            (.high, "High risk of major complication (~27–43% 30-day morbidity/mortality)",
             ["HDU or high-dependency step-down admission",
              "4-hourly vital sign monitoring with early-warning escalation",
              "Daily surgical review; maintain fluid balance chart",
              "DVT prophylaxis and early mobilisation when haemodynamically stable",
              "Consider physiotherapy and enhanced recovery input"],
             ["SAS 3–4 — high surgical risk; HDU monitoring recommended"])
        case 5...6:
            (.moderate, "Moderate risk of major complication (~16–22% 30-day morbidity/mortality)",
             ["Surgical ward admission with 4-hourly observations",
              "Early enhanced recovery protocol (oral fluid, mobilisation by day 1)",
              "Daily surgical review; pain management optimisation",
              "DVT prophylaxis; early removal of urinary catheter"],
             [])
        case 7...8:
            (.low, "Low risk of major complication (~9–10% 30-day morbidity/mortality)",
             ["Standard postoperative ward care",
              "Early mobilisation; regular pain review",
              "Routine enhanced recovery protocol",
              "Discharge planning from day 1"],
             [])
        default:
            (.low, "Very low risk of major complication (~3.5% 30-day morbidity/mortality)",
             ["Standard postoperative ward care; early enhanced recovery",
              "Aim for discharge by standard protocol timeline",
              "Routine outpatient follow-up at 2–4 weeks"],
             [])
        }

        let eblLabels = ["">1000 mL (+0)", "601–1000 mL (+1)", "101–600 mL (+2)", "≤100 mL (+3)"]
        let mapLabels = ["<40 mmHg (+0)", "40–54 mmHg (+1)", "55–69 mmHg (+2)", "≥70 mmHg (+3)"]
        let hrLabels  = ["≥120 bpm (+0)", "101–119 bpm (+0)", "86–100 bpm (+1)", "56–85 bpm (+3)", "41–55 bpm (+2)", "≤40 bpm (+0)"]
        let items: [ScoreItem] = [
            ScoreItem(label: "Estimated blood loss: \(eblLabels[min(i.estimatedBloodLoss, 3)])", points: Double(eblPts), present: true),
            ScoreItem(label: "Lowest MAP: \(mapLabels[min(i.lowestMAP, 3)])", points: Double(mapPts), present: true),
            ScoreItem(label: "Lowest heart rate: \(hrLabels[min(i.lowestHeartRate, 5)])", points: Double(hrPts), present: true)
        ]

        return ClinicalScore(
            systemName: "Surgical Apgar Score",
            abbreviation: "SAS",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: "SAS \(total)/10 — \(interp)",
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Gawande AA et al. J Am Coll Surg 2007;204:201–208. Regenbogen SE et al. Ann Surg 2010;252:706–712."
        )
    }

    // MARK: - Waterlow Pressure Ulcer Risk

    static func waterlow(_ i: WaterlowInput) -> ClinicalScore {
        var total = i.buildWeight + i.skinType + i.sexAge + i.mobility + i.continence + i.appetite
        if i.tissuemalnutrition { total += 8 }
        if i.neurologicalDeficit { total += 5 }
        if i.majorSurgery { total += 5 }
        if i.onCytotoxics { total += 4 }

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...9:
            (.low, "Low risk — no pressure ulcer prevention beyond standard care",
             ["Routine skin inspection and repositioning per ward protocol",
              "Ensure adequate hydration and nutrition",
              "Document baseline skin assessment on admission"],
             [])
        case 10...14:
            (.moderate, "At risk — implement preventive measures",
             ["2-hourly repositioning or use of pressure-redistributing mattress",
              "Daily skin inspection; document any redness or skin changes",
              "Nutritional assessment; consider dietitian referral",
              "Heel protection device if bedbound",
              "Educate patient and carers about pressure ulcer prevention"],
             [])
        case 15...19:
            (.high, "High risk — active prevention protocol required",
             ["High-specification foam or dynamic (alternating pressure) mattress",
              "1–2 hourly repositioning or continuous pressure relief",
              "Heel offloading device; consider barrier cream",
              "Formal nutritional assessment; nutritional supplements if depleted",
              "Daily wound care nurse or tissue viability nurse review",
              "Document wound care plan in nursing records"],
             ["High pressure ulcer risk — tissue viability nurse review recommended"])
        default:
            (.critical, "Very high risk — tissue viability nurse involvement essential",
             ["Dynamic high-specification mattress or air-fluidised bed",
              "Maximum pressure redistribution; skin inspection with every repositioning",
              "Tissue viability nurse referral immediately",
              "Optimise nutrition (consider NG or parenteral if oral inadequate)",
              "Daily formal wound assessment; photograph any skin changes",
              "Consider specialist wound care products (foam, hydrocolloid, silicone)"],
             ["Very high pressure ulcer risk — TVN referral; specialist mattress required"])
        }

        let items: [ScoreItem] = [
            ScoreItem(label: "Build/Weight", points: Double(i.buildWeight), present: i.buildWeight > 0),
            ScoreItem(label: "Skin type", points: Double(i.skinType), present: i.skinType > 0),
            ScoreItem(label: "Sex/Age", points: Double(i.sexAge), present: i.sexAge > 0),
            ScoreItem(label: "Mobility", points: Double(i.mobility), present: i.mobility > 0),
            ScoreItem(label: "Continence", points: Double(i.continence), present: i.continence > 0),
            ScoreItem(label: "Appetite", points: Double(i.appetite), present: i.appetite > 0),
            ScoreItem(label: "Tissue malnutrition / cachexia", points: 8, present: i.tissuemalnutrition),
            ScoreItem(label: "Neurological deficit", points: 5, present: i.neurologicalDeficit),
            ScoreItem(label: "Major surgery / trauma", points: 5, present: i.majorSurgery),
            ScoreItem(label: "Cytotoxics / high-dose steroids", points: 4, present: i.onCytotoxics)
        ]

        return ClinicalScore(
            systemName: "Waterlow Pressure Ulcer Risk",
            abbreviation: "Waterlow",
            score: Double(total), maxScore: 64,
            risk: risk,
            interpretation: "Waterlow \(total) — \(interp)",
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Waterlow J. Nursing Times 1985;81:49–55. Waterlow J. Nursing Times 2005;101:62–66 (revised card)."
        )
    }

    // MARK: - TIMI Risk Score (UA/NSTEMI)

    static func timi(_ i: TIMIInput) -> ClinicalScore {
        var total = 0
        if i.ageOver65 { total += 1 }
        if i.threeOrMoreRiskFactors { total += 1 }
        if i.priorCoronaryArteryStenosis { total += 1 }
        if i.stDeviationOnECG { total += 1 }
        if i.twoOrMoreAnginalEvents { total += 1 }
        if i.aspirinUseInLast7Days { total += 1 }
        if i.elevatedCardiacMarkers { total += 1 }

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...2:
            (.low, "Low risk — 14-day composite event rate ~8%",
             ["Conservative management; serial troponins (0, 3, 6 h)",
              "Non-invasive stress testing before discharge if troponins negative",
              "Dual antiplatelet therapy and anticoagulation per ACS pathway",
              "Cardiology follow-up within 72 h"],
             [])
        case 3...4:
            (.moderate, "Intermediate risk — 14-day composite event rate ~13–20%",
             ["Hospital admission; cardiology review",
              "Inpatient stress testing or early invasive strategy depending on clinical context",
              "Dual antiplatelet + anticoagulation; consider GP IIb/IIIa inhibitor if high-risk features",
              "Echocardiography to assess LV function"],
             [])
        default:
            (.high, "High risk — 14-day composite event rate ~26–40%",
             ["Early invasive strategy (coronary angiography within 24–48 h)",
              "Dual antiplatelet therapy (aspirin + P2Y12 inhibitor)",
              "Anticoagulation (LMWH or fondaparinux) unless contraindicated",
              "Continuous cardiac monitoring; cardiology on-call review urgently",
              "Glycoprotein IIb/IIIa inhibitor if refractory ischaemia or catheter lab planned"],
             ["High TIMI score — early invasive strategy strongly recommended"])
        }

        let items: [ScoreItem] = [
            ScoreItem(label: "Age ≥65",                           points: 1, present: i.ageOver65),
            ScoreItem(label: "≥3 CAD risk factors",              points: 1, present: i.threeOrMoreRiskFactors),
            ScoreItem(label: "Prior coronary stenosis ≥50%",     points: 1, present: i.priorCoronaryArteryStenosis),
            ScoreItem(label: "ST deviation on ECG",              points: 1, present: i.stDeviationOnECG),
            ScoreItem(label: "≥2 anginal events in prior 24 h",  points: 1, present: i.twoOrMoreAnginalEvents),
            ScoreItem(label: "Aspirin use in prior 7 days",      points: 1, present: i.aspirinUseInLast7Days),
            ScoreItem(label: "Elevated cardiac markers",         points: 1, present: i.elevatedCardiacMarkers)
        ]

        return ClinicalScore(
            systemName: "TIMI Risk Score (UA/NSTEMI)",
            abbreviation: "TIMI",
            score: Double(total), maxScore: 7,
            risk: risk,
            interpretation: "TIMI \(total)/7 — \(interp)",
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Antman EM et al. JAMA 2000;284:835–842."
        )
    }

    // MARK: - Clinical Frailty Scale

    static func clinicalFrailty(_ i: ClinicalFrailtyInput) -> ClinicalScore {
        struct CFSData {
            let label: String; let risk: ScoreRisk
            let interp: String; let recs: [String]; let flags: [String]
        }
        let table: [Int: CFSData] = [
            1: CFSData(label: "1 — Very Fit", risk: .low,
                interp: "Robust, active, energetic, well-motivated; regular exercise; among the fittest for age",
                recs: ["Standard surgical risk; no frailty-related pre-operative optimisation required"],
                flags: []),
            2: CFSData(label: "2 — Fit", risk: .low,
                interp: "No active disease symptoms; less fit than CFS 1; exercises or is very active occasionally",
                recs: ["Standard surgical risk; encourage pre-operative exercise optimisation"],
                flags: []),
            3: CFSData(label: "3 — Managing Well", risk: .low,
                interp: "Medical problems well controlled but not regularly active beyond routine walking",
                recs: ["Low frailty surgical risk; encourage pre-operative physical activity",
                       "Ensure chronic conditions optimised before elective surgery"],
                flags: []),
            4: CFSData(label: "4 — Vulnerable", risk: .moderate,
                interp: "Not dependent on others for daily activities but symptoms limit activity; often complains of being slowed down or tired",
                recs: ["Frailty increases perioperative risk — consider comprehensive pre-operative assessment",
                       "Geriatric medicine input for elective surgery",
                       "Optimise nutrition, anaemia, and functional capacity before operation"],
                flags: []),
            5: CFSData(label: "5 — Mildly Frail", risk: .moderate,
                interp: "Evident slowing; depends on others for high-order IADLs (finances, transport, heavy housework, medications)",
                recs: ["Mildly frail — geriatric medicine review recommended",
                       "Shared decision-making discussion: risks vs benefits of surgery",
                       "Prehabilitation programme if time allows",
                       "Enhanced recovery pathway with early physio and dietitian input"],
                flags: ["Mild frailty — perioperative complication and mortality risk elevated"]),
            6: CFSData(label: "6 — Moderately Frail", risk: .high,
                interp: "Help needed with all outside activities and housekeeping; indoors assistance with bathing or dressing",
                recs: ["Moderately frail — senior surgical and geriatric medicine joint review required",
                       "Careful shared decision-making; consider non-operative management where feasible",
                       "If proceeding: enhanced perioperative care, delirium prevention bundle, early HDU",
                       "Involve family/carers in consent process and post-discharge planning",
                       "Nutritional support and prehabilitation"],
                flags: ["Moderate frailty — significantly increased perioperative mortality and morbidity",
                        "Discuss goals of care and ceiling of treatment before proceeding"]),
            7: CFSData(label: "7 — Severely Frail", risk: .critical,
                interp: "Completely dependent for personal care from whatever cause (physical or cognitive); stable, not at high risk of dying within 6 months",
                recs: ["Severely frail — surgery carries very high risk; consider conservative management",
                       "Multidisciplinary review including geriatrics, palliative care if appropriate",
                       "Goals-of-care discussion mandatory before any intervention",
                       "If surgery unavoidable: single-stage minimal-access approach preferred"],
                flags: ["Severe frailty — very high perioperative mortality risk",
                        "Goals-of-care and ceiling-of-treatment discussion mandatory"]),
            8: CFSData(label: "8 — Very Severely Frail", risk: .critical,
                interp: "Completely dependent, approaching end of life; could not recover even from a minor illness",
                recs: ["Surgery very unlikely to confer benefit; palliative/comfort care discussion",
                       "Palliative care team involvement recommended"],
                flags: ["Very severe frailty — surgery unlikely to be appropriate; palliative care review"]),
            9: CFSData(label: "9 — Terminally Ill", risk: .critical,
                interp: "Life expectancy <6 months; not otherwise evidently frail",
                recs: ["Palliative and end-of-life care; surgical intervention not appropriate except for symptom control"],
                flags: ["Terminal illness — surgical intervention not appropriate except for palliative symptom relief"])
        ]
        let data = table[i.level] ?? table[1]!
        let items: [ScoreItem] = [
            ScoreItem(label: data.label, points: Double(i.level), present: true)
        ]
        return ClinicalScore(
            systemName: "Clinical Frailty Scale",
            abbreviation: "CFS \(i.level)",
            score: Double(i.level), maxScore: 9,
            risk: data.risk,
            interpretation: "\(data.label) — \(data.interp)",
            items: items,
            recommendations: data.recs,
            redFlags: data.flags,
            evidenceNote: "Rockwood K et al. CMAJ 2005;173:489–495. Rockwood K & Theou O. Lancet 2019;394:1651–1652."
        )
    }

    // MARK: - Mallampati Classification (airway)

    static func mallampati(_ i: MallampatiInput) -> ClinicalScore {
        // Modified Mallampati class I–IV: higher class = greater predicted difficulty
        let classLabel: String
        let baseRisk: ScoreRisk
        switch i.mallampatiClass {
        case 1:
            classLabel = "Class I — Soft palate, uvula, tonsillar pillars visible"; baseRisk = .low
        case 2:
            classLabel = "Class II — Soft palate and uvula visible (pillars obscured)"; baseRisk = .low
        case 3:
            classLabel = "Class III — Only soft palate and base of uvula visible"; baseRisk = .moderate
        default:
            classLabel = "Class IV — Soft palate not visible (hard palate only)"; baseRisk = .high
        }

        // Each additional predictor elevates overall risk
        var additionalPredictors = 0
        if i.mouthOpening   { additionalPredictors += 1 }
        if i.neckMobility   { additionalPredictors += 1 }
        if i.thyromental    { additionalPredictors += 1 }
        if i.retrognathia   { additionalPredictors += 1 }
        if i.obesity        { additionalPredictors += 1 }
        if i.beardOrDentures { additionalPredictors += 1 }

        let finalRisk: ScoreRisk
        if baseRisk == .high || (baseRisk == .moderate && additionalPredictors >= 1) || additionalPredictors >= 3 {
            finalRisk = .high
        } else if baseRisk == .moderate || additionalPredictors >= 1 {
            finalRisk = .moderate
        } else {
            finalRisk = .low
        }

        let difficultyDesc: String
        switch finalRisk {
        case .high:     difficultyDesc = "anticipated difficult airway — senior anaesthetic input essential"
        case .moderate: difficultyDesc = "potentially difficult airway — plan for airway management alternatives"
        default:        difficultyDesc = "likely straightforward airway — standard precautions"
        }

        var recs: [String] = ["Document airway assessment formally in anaesthetic pre-assessment"]
        switch finalRisk {
        case .high:
            recs += ["Discuss with senior anaesthetist before induction",
                     "Consider awake fibreoptic intubation or video laryngoscopy as primary plan",
                     "Ensure difficult airway trolley immediately available",
                     "Mark airway as difficult in patient record and wristband if required",
                     "Surgical airway standby (front-of-neck access) for cannot-intubate-cannot-oxygenate scenario"]
        case .moderate:
            recs += ["Video laryngoscopy as first-line or standby",
                     "Second anaesthetist/assistant available at induction",
                     "Pre-oxygenate for ≥3 min; consider ramp positioning",
                     "Difficult airway trolley in room"]
        default:
            recs += ["Standard pre-oxygenation; direct laryngoscopy anticipated to be straightforward",
                     "Difficult airway trolley available in department per standard protocol"]
        }

        var flags: [String] = []
        if i.mallampatiClass >= 3 { flags.append("Mallampati class \(i.mallampatiClass) — senior anaesthetic input required") }
        if additionalPredictors >= 2 { flags.append("\(additionalPredictors) additional airway predictors — combined difficult airway risk significantly elevated") }

        let items: [ScoreItem] = [
            ScoreItem(label: classLabel, points: Double(i.mallampatiClass), present: true),
            ScoreItem(label: "Reduced mouth opening", points: 1, present: i.mouthOpening),
            ScoreItem(label: "Restricted neck mobility", points: 1, present: i.neckMobility),
            ScoreItem(label: "Short thyromental distance", points: 1, present: i.thyromental),
            ScoreItem(label: "Retrognathia / micrognathia", points: 1, present: i.retrognathia),
            ScoreItem(label: "Obesity / large neck", points: 1, present: i.obesity),
            ScoreItem(label: "Beard or poorly-fitting dentures", points: 1, present: i.beardOrDentures)
        ]

        return ClinicalScore(
            systemName: "Mallampati Airway Classification",
            abbreviation: "Class \(["I","II","III","IV"][max(0,i.mallampatiClass-1)])",
            score: Double(i.mallampatiClass + additionalPredictors), maxScore: 10,
            risk: finalRisk,
            interpretation: "\(classLabel); \(additionalPredictors) additional predictor(s) — \(difficultyDesc)",
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Mallampati SR et al. Can Anaesth Soc J 1985;32:429–434. Samsoon GL & Young JR. Anaesthesia 1987;42:487–490."
        )
    }

    // MARK: - HEART Score (chest pain risk stratification)

    static func heart(_ i: HEARTInput) -> ClinicalScore {
        let total = i.history + i.ecg + i.ageScore + i.riskFactors + i.troponin
        let (risk, interp, recs, flags) = heartRisk(total)
        let items: [ScoreItem] = [
            ScoreItem(label: "History",      points: Double(i.history),     present: i.history > 0),
            ScoreItem(label: "ECG",          points: Double(i.ecg),         present: i.ecg > 0),
            ScoreItem(label: "Age",          points: Double(i.ageScore),    present: i.ageScore > 0),
            ScoreItem(label: "Risk factors", points: Double(i.riskFactors), present: i.riskFactors > 0),
            ScoreItem(label: "Troponin",     points: Double(i.troponin),    present: i.troponin > 0)
        ]
        return ClinicalScore(
            systemName: "HEART Score",
            abbreviation: "HEART",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: "HEART \(total)/10 — \(interp)",
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Backus BE et al. Neth Heart J 2010;18:422–428. Six AJ et al. Heart 2008;94:1509–1513. Mahler SA et al. Crit Pathw Cardiol 2015;14:1–8."
        )
    }

    private static func heartRisk(_ score: Int) -> (ScoreRisk, String, [String], [String]) {
        switch score {
        case 0...3:
            return (.low,
                    "Low risk — MACE probability <2% at 6 weeks",
                    ["Discharge from ED with outpatient follow-up if clinically stable",
                     "Serial troponins (0 h and 3 h) to confirm negative before discharge",
                     "Aspirin and early outpatient cardiology review",
                     "Discharge instructions: return if symptoms recur"],
                    [])
        case 4...6:
            return (.moderate,
                    "Moderate risk — MACE probability ~12–25% at 6 weeks",
                    ["Hospital observation with serial troponins (0, 3, 6 h)",
                     "Non-invasive stress testing (exercise ECG or stress echo)",
                     "Cardiology review before discharge",
                     "Antiplatelet therapy; consider anticoagulation if ACS confirmed"],
                    [])
        default:
            return (.high,
                    "High risk — MACE probability ~50–65% at 6 weeks",
                    ["Urgent cardiology review and inpatient monitoring",
                     "Early invasive strategy (coronary angiography within 24–48 h)",
                     "Dual antiplatelet therapy (aspirin + P2Y12 inhibitor)",
                     "Anticoagulation (LMWH or fondaparinux) unless contraindicated",
                     "Continuous cardiac monitoring; prepare for intervention"],
                    ["High HEART score — early invasive strategy strongly recommended"])
        }
    }

    // MARK: - NRS-2002 (Nutritional Risk Screening 2002)

    static func nrs2002(_ i: NRS2002Input) -> ClinicalScore {
        let total = i.nutritionalStatus + i.diseaseSeverity + (i.ageOver70 ? 1 : 0)
        let (risk, interp, recs, flags) = nrs2002Risk(total)
        let nsLabels = ["0 — Normal nutritional status",
                        "1 — Mild: weight loss 5–10% in 3 months, or intake 50–75% of requirement",
                        "2 — Moderate: weight loss 5% in 2 months, or BMI 18.5–20.5 with impaired general condition, or intake 25–60%",
                        "3 — Severe: weight loss >5% in 1 month / >15% in 3 months, BMI <18.5, or intake <25%"]
        let dsLabels = ["0 — No disease",
                        "1 — Minor stress: hip fracture, chronic disease with complications, chemotherapy",
                        "2 — Moderate stress: major abdominal surgery, stroke, haematological malignancy, ICU APACHE <10",
                        "3 — Severe stress: head injury, bone marrow transplant, ICU APACHE ≥10"]
        var items: [ScoreItem] = []
        items.append(ScoreItem(
            label: i.nutritionalStatus < nsLabels.count ? nsLabels[i.nutritionalStatus] : "Nutritional status \(i.nutritionalStatus)",
            points: Double(i.nutritionalStatus), present: i.nutritionalStatus > 0))
        items.append(ScoreItem(
            label: i.diseaseSeverity < dsLabels.count ? dsLabels[i.diseaseSeverity] : "Disease severity \(i.diseaseSeverity)",
            points: Double(i.diseaseSeverity), present: i.diseaseSeverity > 0))
        items.append(ScoreItem(label: "Age ≥70 years", points: 1, present: i.ageOver70))
        return ClinicalScore(
            systemName: "NRS-2002",
            abbreviation: "NRS \(total)",
            score: Double(total), maxScore: 7,
            risk: risk,
            interpretation: interp,
            items: items,
            recommendations: recs,
            redFlags: flags,
            evidenceNote: "Kondrup J et al. Clin Nutr 2003; 22:415–421. Validated in 128 RCTs."
        )
    }

    private static func nrs2002Risk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        if s < 3 {
            return (.low, "Not at nutritional risk (score \(s))",
                    ["Routine dietary intake; re-screen weekly if inpatient",
                     "Document baseline weight and BMI",
                     "Re-screen if clinical condition deteriorates"],
                    [])
        } else if s < 5 {
            return (.moderate, "Nutritional risk (score \(s)) — intervention indicated",
                    ["Refer to dietitian for formal nutritional assessment within 24–48 h",
                     "Set individualised nutritional goals (25–35 kcal/kg/day; 1.2–1.5 g protein/kg/day)",
                     "Oral nutritional supplements or enhanced catering as first-line",
                     "Consider enteral nutrition if oral intake insufficient",
                     "Monitor weight, biochemistry (electrolytes, albumin, pre-albumin) regularly"],
                    [])
        } else {
            return (.high, "High nutritional risk (score \(s)) — urgent intervention",
                    ["Immediate dietitian review",
                     "Initiate nutritional support within 24 h; enteral route preferred",
                     "Parenteral nutrition only if enteral route is not feasible",
                     "Monitor for refeeding syndrome: check and correct phosphate, potassium, magnesium",
                     "Weekly formal reassessment; optimise pre-operatively if elective surgery planned"],
                    ["NRS-2002 ≥5 — high risk of peri-operative complications; discuss with nutrition team before surgery"])
        }
    }

    private static func ctsiRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case ..<4:
            return (.low, "Mild — CTSI \(s): low complication risk",
                    ["Supportive management; CT surveillance not routinely required",
                     "Oral nutrition as tolerated",
                     "Monitor for clinical deterioration"],
                    [])
        case 4..<7:
            return (.moderate, "Moderate — CTSI \(s): ~30–50% complication rate",
                    ["HDU monitoring; NPO + IV fluids",
                     "Repeat CT at 48–72 h if not improving clinically",
                     "Surgical / HPB team review",
                     "Consider percutaneous drainage if fluid collection enlarges"],
                    [])
        default:
            return (.critical, "Severe — CTSI \(s): ~50–90% complication rate",
                    ["ICU-level care",
                     "Multi-disciplinary HPB / intensive-care team",
                     "Percutaneous or endoscopic drainage of necrotic collections",
                     "Delayed surgical debridement (step-up approach preferred)",
                     "Parenteral or jejunal nutrition support"],
                    ["CTSI ≥7 — predicted mortality 17%+ and complication rate >50%"])
        }
    }
}
