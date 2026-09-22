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
        let items: [ScoredItem] = [
            ScoredItem(label: "Respiratory — PaO₂/FiO₂", points: Double(i.respiration), present: i.respiration > 0),
            ScoredItem(label: "Coagulation — Platelets", points: Double(i.coagulation), present: i.coagulation > 0),
            ScoredItem(label: "Liver — Bilirubin", points: Double(i.liver), present: i.liver > 0),
            ScoredItem(label: "Cardiovascular — MAP/vasopressors", points: Double(i.cardiovascular), present: i.cardiovascular > 0),
            ScoredItem(label: "CNS — GCS", points: Double(i.cns), present: i.cns > 0),
            ScoredItem(label: "Renal — Creatinine/UO", points: Double(i.renal), present: i.renal > 0)
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
        let items: [ScoredItem] = [
            ScoredItem(label: "Age (years)", points: Double(i.age), present: true),
            ScoredItem(label: "AST (IU/L)", points: i.astIUL, present: true),
            ScoredItem(label: "Platelets (×10⁹/L)", points: i.platelet10_9L, present: true),
            ScoredItem(label: "ALT (IU/L)", points: i.altIUL, present: true)
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
        var items: [ScoredItem] = []
        func add(_ label: String, _ flag: Bool) {
            if flag { score += 1 }
            items.append(ScoredItem(label: label, points: flag ? 1 : 0, present: flag))
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
        var items: [ScoredItem] = []
        func add(_ label: String, _ flag: Bool, pts: Int) {
            if flag { score += pts }
            items.append(ScoredItem(label: label, points: Double(flag ? pts : 0), present: flag))
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
        var items: [ScoredItem] = []
        let gradeLabels = ["A — Normal pancreas", "B — Oedematous pancreas",
                           "C — Peripancreatic fat stranding",
                           "D — Single peripancreatic fluid collection",
                           "E — ≥2 fluid collections or gas in/around pancreas"]
        let gradeLabel = i.balthazarGrade < gradeLabels.count
            ? gradeLabels[i.balthazarGrade] : "Grade \(i.balthazarGrade)"
        items.append(ScoredItem(label: "Balthazar grade — \(gradeLabel)",
                               points: Double(i.balthazarGrade),
                               present: i.balthazarGrade > 0))
        let necLabels = [0: "None", 2: "Necrosis <33%", 4: "Necrosis 33–50%", 6: "Necrosis >50%"]
        items.append(ScoredItem(label: necLabels[i.necrosisScore] ?? "Necrosis",
                               points: Double(i.necrosisScore),
                               present: i.necrosisScore > 0))
        return ClinicalScore(
            systemName: "CT Severity Index",
            abbreviation: "CTSI \(total)/10",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
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
        let items: [ScoredItem] = [
            ScoredItem(label: data.label, points: Double(data.rebleedPct), present: true)
        ]
        return ClinicalScore(
            systemName: "Forrest Classification",
            abbreviation: i.grade <= 2 ? "Ia/Ib" : i.grade == 3 ? "IIa" : i.grade == 4 ? "IIb" : i.grade == 5 ? "IIc" : "III",
            score: Double(i.grade), maxScore: 6,
            risk: data.risk,
            interpretation: "\(data.label) — estimated rebleed risk \(data.rebleedPct)%",
            recommendations: data.recs,
            items: items,
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

        let items: [ScoredItem] = [
            ScoredItem(label: "Level of consciousness (\(["Alert","Not alert/arousable","Obtunded","Unresponsive"][min(i.consciousness,3)]))", points: Double(i.consciousness), present: i.consciousness > 0),
            ScoredItem(label: "LOC questions (month/age) (\(["Both correct","One correct","Neither"][min(i.locQuestions,2)]))", points: Double(i.locQuestions), present: i.locQuestions > 0),
            ScoredItem(label: "LOC commands (open/close eyes, grip) (\(["Both","One","Neither"][min(i.locCommands,2)]))", points: Double(i.locCommands), present: i.locCommands > 0),
            ScoredItem(label: "Gaze (\(["Normal","Partial palsy","Forced deviation"][min(i.gazeDeviation,2)]))", points: Double(i.gazeDeviation), present: i.gazeDeviation > 0),
            ScoredItem(label: "Visual fields (\(["No loss","Partial hemianopia","Complete hemianopia","Bilateral"][min(i.visualFields,3)]))", points: Double(i.visualFields), present: i.visualFields > 0),
            ScoredItem(label: "Facial palsy (\(["Normal","Minor","Partial","Complete"][min(i.facialPalsy,3)]))", points: Double(i.facialPalsy), present: i.facialPalsy > 0),
            ScoredItem(label: "Motor arm left (\(["No drift","Drift <10s","Effort vs gravity","No effort","No movement"][min(i.motorArmLeft,4)]))", points: Double(i.motorArmLeft), present: i.motorArmLeft > 0),
            ScoredItem(label: "Motor arm right (\(["No drift","Drift <10s","Effort vs gravity","No effort","No movement"][min(i.motorArmRight,4)]))", points: Double(i.motorArmRight), present: i.motorArmRight > 0),
            ScoredItem(label: "Motor leg left (\(["No drift","Drift <5s","Effort vs gravity","No effort","No movement"][min(i.motorLegLeft,4)]))", points: Double(i.motorLegLeft), present: i.motorLegLeft > 0),
            ScoredItem(label: "Motor leg right (\(["No drift","Drift <5s","Effort vs gravity","No effort","No movement"][min(i.motorLegRight,4)]))", points: Double(i.motorLegRight), present: i.motorLegRight > 0),
            ScoredItem(label: "Limb ataxia (\(["Absent","One limb","Two limbs"][min(i.limbAtaxia,2)]))", points: Double(i.limbAtaxia), present: i.limbAtaxia > 0),
            ScoredItem(label: "Sensory (\(["Normal","Mild-moderate loss","Severe/absent"][min(i.sensory,2)]))", points: Double(i.sensory), present: i.sensory > 0),
            ScoredItem(label: "Language (\(["No aphasia","Mild aphasia","Severe aphasia","Mute/global"][min(i.language,3)]))", points: Double(i.language), present: i.language > 0),
            ScoredItem(label: "Dysarthria (\(["Normal","Mild-moderate","Severe/intubated"][min(i.dysarthria,2)]))", points: Double(i.dysarthria), present: i.dysarthria > 0),
            ScoredItem(label: "Extinction/inattention (\(["None","One modality","Profound"][min(i.extinction,2)]))", points: Double(i.extinction), present: i.extinction > 0)
        ]

        return ClinicalScore(
            systemName: "NIH Stroke Scale",
            abbreviation: "NIHSS",
            score: Double(total), maxScore: 42,
            risk: risk,
            interpretation: "NIHSS \(total) — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Brott T et al. Stroke 1989;20:864–870. Adams HP et al. Stroke 1999;30:1765–1769."
        )
    }

    // MARK: - modified Rankin Scale (mRS)

    struct MRSInput: Equatable {
        // modified Rankin Scale (van Swieten JC et al. Stroke 1988;19:604–607)
        // 0–6 ordinal scale of stroke-related disability / dependence
        // 0 = no symptoms; 1 = no significant disability; 2 = slight disability;
        // 3 = moderate disability; 4 = moderately severe disability;
        // 5 = severe disability; 6 = dead
        var level: Int = 0   // 0–6
    }

    static func mRS(_ i: MRSInput) -> ClinicalScore {
        let level = max(0, min(6, i.level))

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch level {
        case 0:
            (.low, "No symptoms",
             ["Confirm aetiology and initiate secondary prevention (antiplatelet/anticoagulation, statin, antihypertensive)",
              "Risk factor optimisation: BP <130/80, LDL-C <1.8 mmol/L in stroke/TIA",
              "Outpatient neurology or stroke follow-up at 1 month"],
             [])
        case 1:
            (.low, "No significant disability despite symptoms — all usual duties and activities carried out",
             ["Secondary prevention as above",
              "Reassure re: functional recovery; lifestyle counselling (exercise, diet, smoking cessation)",
              "Driving may be permitted subject to local DVLA / transport authority guidelines"],
             [])
        case 2:
            (.low, "Slight disability — unable to carry out some previous activities but independent without assistance in own affairs",
             ["Outpatient physiotherapy and occupational therapy assessment",
              "Driving restrictions: assess individually; typically restricted ≥1 month post-stroke",
              "Cognitive assessment if memory or executive function concerns",
              "Secondary prevention and risk factor control"],
             [])
        case 3:
            (.moderate, "Moderate disability — requiring some help but able to walk without assistance",
             ["Inpatient or community stroke rehabilitation programme",
              "OT home assessment for adaptive equipment and environmental modification",
              "Speech and language therapy if communication or swallowing affected",
              "Carer support services referral",
              "Antispasticity management if upper/lower limb spasticity present"],
             [])
        case 4:
            (.high, "Moderately severe disability — unable to walk and attend to own bodily needs without assistance",
             ["Inpatient rehabilitation or specialist nursing facility",
              "Multidisciplinary stroke team: physiotherapy, OT, SLT, dietetics, psychology",
              "Spasticity management, pressure ulcer prevention, deep vein thrombosis prophylaxis",
              "Carer training and community discharge planning",
              "Depression and post-stroke emotional lability screening (PHQ-9)"],
             ["mRS 4 — high care dependency; discharge planning must address 24-hour care needs"])
        case 5:
            (.high, "Severe disability — bedridden, incontinent and requiring constant nursing care and attention",
             ["Ongoing inpatient or long-term care placement",
              "Goal-setting with family: rehabilitation potential vs. palliative approach",
              "Enteral nutrition if dysphagia prevents adequate oral intake",
              "Spasticity, contracture, and pressure care intensive management",
              "Palliative care team involvement if appropriate"],
             ["mRS 5 — severe dependency; high mortality within 1 year; multi-disciplinary goals-of-care discussion required"])
        default: // 6
            (.high, "Dead",
             ["Document cause of death; complete relevant notifications",
              "Offer family bereavement support",
              "Mortality and morbidity review if stroke care quality concerns"],
             ["mRS 6 — patient deceased"])
        }

        let labels = ["No symptoms",
                      "No significant disability",
                      "Slight disability — independent",
                      "Moderate disability — walks unaided",
                      "Moderately severe disability — needs assistance",
                      "Severe disability — fully dependent",
                      "Dead"]
        let items = [ScoredItem(label: "mRS Level \(level): \(labels[level])", points: Double(level), present: true)]

        return ClinicalScore(
            systemName: "modified Rankin Scale",
            abbreviation: "mRS \(level)",
            score: Double(level), maxScore: 6,
            risk: risk,
            interpretation: "mRS \(level) — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "van Swieten JC et al. Stroke 1988;19:604–607. Rankin J. Scott Med J 1957;2:200–215."
        )
    }

    // MARK: - MUST (Malnutrition Universal Screening Tool)

    struct MUSTInput: Equatable {
        var bmiScore: Int = 0         // 0 = BMI >20; 1 = 18.5–20; 2 = <18.5
        var weightLossScore: Int = 0  // 0 = <5%; 1 = 5–10%; 2 = >10% in past 3–6 months
        var acuteDiseaseScore: Int = 0 // 0 = no effect; 2 = acutely ill and nil/negligible intake likely >5 days
    }

    static func must(_ i: MUSTInput) -> ClinicalScore {
        let total = max(0, i.bmiScore + i.weightLossScore + i.acuteDiseaseScore)

        let (risk, abbrev, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0:
            (.low, "Low Risk",
             ["Routine nutritional care; re-screen weekly (hospital) or monthly (community/care home)",
              "Encourage balanced diet and adequate fluid intake"],
             [])
        case 1:
            (.moderate, "Medium Risk",
             ["Document 3-day food intake; if adequate, re-screen weekly (hospital)",
              "If intake inadequate, refer to dietitian or implement local nutritional protocol",
              "Consider high-protein / high-energy oral nutritional supplements"],
             ["MUST 1 — medium malnutrition risk; dietetic review recommended"])
        default:
            (.high, "High Risk",
             ["Urgent dietitian referral",
              "Initiate nutritional support plan within 24 hours: oral supplements, enteral, or parenteral route based on clinical status",
              "Multi-disciplinary nutrition team involvement (dietitian, nurse, pharmacist)",
              "Optimise metabolic control before elective surgery; delay if correctable",
              "Re-screen weekly; document nutritional support goals and response"],
             ["MUST ≥2 — high malnutrition risk; associated with increased morbidity, prolonged LOS, and higher mortality",
              "Surgery risk: malnutrition doubles 30-day complication rate; address before elective procedures"])
        }

        let bmiLabels    = ["BMI >20 kg/m² (+0)", "BMI 18.5–20 kg/m² (+1)", "BMI <18.5 kg/m² (+2)"]
        let wlLabels     = ["Weight loss <5% (+0)", "Weight loss 5–10% (+1)", "Weight loss >10% (+2)"]
        let acuteLabel   = i.acuteDiseaseScore == 2 ? "Acute disease effect: Yes (+2)" : "Acute disease effect: No (+0)"

        let items = [
            ScoredItem(label: bmiLabels[min(2, i.bmiScore)],           points: Double(i.bmiScore),           present: i.bmiScore > 0),
            ScoredItem(label: wlLabels[min(2, i.weightLossScore)],     points: Double(i.weightLossScore),     present: i.weightLossScore > 0),
            ScoredItem(label: acuteLabel,                               points: Double(i.acuteDiseaseScore),  present: i.acuteDiseaseScore > 0)
        ]

        return ClinicalScore(
            systemName: "Malnutrition Universal Screening Tool",
            abbreviation: "MUST \(total)",
            score: Double(total), maxScore: 6,
            risk: risk,
            interpretation: "MUST \(total) — \(abbrev)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Stratton RJ et al. Clin Nutr 2004;23:1060–1066. BAPEN MUST toolkit. Validated across hospital, community, and care-home settings."
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

        let items: [ScoredItem] = [
            ScoredItem(label: "Age \(i.age) years (+\(String(format: "%.3f", ageBoost)) above 60)", points: ageBoost, present: i.age > 60),
            ScoredItem(label: "Female sex +0.220", points: 0.2196434, present: i.female),
            ScoredItem(label: "Renal impairment: \(renalLabels[min(i.renalImpairment, 2)])", points: i.renalImpairment == 1 ? 0.3541226 : 0.6521653, present: i.renalImpairment > 0),
            ScoredItem(label: "Extracardiac arteriopathy +0.509", points: 0.5085682, present: i.extracardiacArteriopathy),
            ScoredItem(label: "Poor mobility +0.297", points: 0.2971552, present: i.poorMobility),
            ScoredItem(label: "Previous cardiac surgery +1.002", points: 1.0023510, present: i.previousCardiacSurgery),
            ScoredItem(label: "Chronic lung disease +0.189", points: 0.1886564, present: i.chronicLungDisease),
            ScoredItem(label: "Active endocarditis +0.619", points: 0.6194522, present: i.activeEndocarditis),
            ScoredItem(label: "Critical preoperative state +1.086", points: 1.0856296, present: i.criticalPreoperativeState),
            ScoredItem(label: "Diabetes on insulin +0.330", points: 0.3304052, present: i.diabetesOnInsulin),
            ScoredItem(label: "NYHA class \(nyhaLabels[min(i.nyhaClass, 3)])", points: [0, 0.1070545, 0.2338955, 0.5718132][min(i.nyhaClass, 3)], present: i.nyhaClass > 0),
            ScoredItem(label: "CCS Class 4 angina +0.222", points: 0.2218732, present: i.ccsClass4Angina),
            ScoredItem(label: "LV function: \(lvLabels[min(i.lvFunction, 2)])", points: [0, 0.3196276, 1.5169013][min(i.lvFunction, 2)], present: i.lvFunction > 0),
            ScoredItem(label: "Recent MI (<90 days) +0.546", points: 0.5460218, present: i.recentMI),
            ScoredItem(label: "Pulmonary hypertension: \(phLabels[min(i.pulmonaryHypertension, 2)])", points: i.pulmonaryHypertension == 1 ? 0.6084972 : 1.3765812, present: i.pulmonaryHypertension > 0),
            ScoredItem(label: "Urgency: \(urgencyLabels[min(i.urgency, 3)])", points: [0, 0.4084417, 0.9361202, 1.8071808][min(i.urgency, 3)], present: i.urgency > 0),
            ScoredItem(label: "Weight of intervention: \(wLabels[min(i.weightOfIntervention, 3)])", points: [0, 0.5521478, 0.9724533, 1.6151723][min(i.weightOfIntervention, 3)], present: i.weightOfIntervention > 0),
            ScoredItem(label: "Surgery on thoracic aorta +1.175", points: 1.1745886, present: i.surgeryOnThoracicAorta),
            ScoredItem(label: "Post-infarct septal rupture +1.463", points: 1.4630660, present: i.postInfarctSeptalRupture)
        ]

        return ClinicalScore(
            systemName: "EuroSCORE II",
            abbreviation: "EuroSCORE",
            score: pctRounded, maxScore: 100,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
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

        let items: [ScoredItem] = [
            ScoredItem(label: "Feeding (\(["0 — unable","5 — needs help","10 — independent"][min(i.feeding/5, 2)]))", points: Double(i.feeding), present: i.feeding > 0),
            ScoredItem(label: "Bathing (\(i.bathing == 0 ? "0 — dependent" : "5 — independent"))", points: Double(i.bathing), present: i.bathing > 0),
            ScoredItem(label: "Grooming (\(i.grooming == 0 ? "0 — dependent" : "5 — independent"))", points: Double(i.grooming), present: i.grooming > 0),
            ScoredItem(label: "Dressing (\(["0 — dependent","5 — needs help","10 — independent"][min(i.dressing/5, 2)]))", points: Double(i.dressing), present: i.dressing > 0),
            ScoredItem(label: "Bowel control (\(["0 — incontinent","5 — occasional accident","10 — continent"][min(i.bowels/5, 2)]))", points: Double(i.bowels), present: i.bowels > 0),
            ScoredItem(label: "Bladder control (\(["0 — incontinent","5 — occasional accident","10 — continent"][min(i.bladder/5, 2)]))", points: Double(i.bladder), present: i.bladder > 0),
            ScoredItem(label: "Toilet use (\(["0 — dependent","5 — needs help","10 — independent"][min(i.toiletUse/5, 2)]))", points: Double(i.toiletUse), present: i.toiletUse > 0),
            ScoredItem(label: "Transfers bed-chair (\(["0 — unable","5 — major help","10 — minor help","15 — independent"][min(i.transfers/5, 3)]))", points: Double(i.transfers), present: i.transfers > 0),
            ScoredItem(label: "Mobility (\(["0 — immobile","5 — wheelchair","10 — walks with help","15 — independent"][min(i.mobility/5, 3)]))", points: Double(i.mobility), present: i.mobility > 0),
            ScoredItem(label: "Stairs (\(["0 — unable","5 — needs help","10 — independent"][min(i.stairs/5, 2)]))", points: Double(i.stairs), present: i.stairs > 0)
        ]

        return ClinicalScore(
            systemName: "Barthel Index",
            abbreviation: "BI",
            score: Double(total), maxScore: 100,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
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

        let items: [ScoredItem] = [
            ScoredItem(label: "Can take care of self (ADLs) +2.75", points: 2.75, present: i.takeCareOfSelf),
            ScoredItem(label: "Can walk indoors on level ground +1.75", points: 1.75, present: i.walkIndoors),
            ScoredItem(label: "Can walk 1–2 blocks on level ground +2.75", points: 2.75, present: i.walkOneOrTwoBlocks),
            ScoredItem(label: "Can climb a flight of stairs or walk up a hill +5.50", points: 5.50, present: i.climbStairs),
            ScoredItem(label: "Can run a short distance +8.00", points: 8.00, present: i.runShortDistance),
            ScoredItem(label: "Can do light housework (dusting, washing dishes) +2.70", points: 2.70, present: i.doLightWork),
            ScoredItem(label: "Can do moderate housework (vacuuming, carrying groceries) +3.50", points: 3.50, present: i.doModerateWork),
            ScoredItem(label: "Can do heavy work (scrubbing floors, moving furniture) +8.00", points: 8.00, present: i.doHeavyWork),
            ScoredItem(label: "Can do yardwork (raking, weeding, pushing mower) +4.50", points: 4.50, present: i.doYardWork),
            ScoredItem(label: "Can have sexual activity +5.25", points: 5.25, present: i.haveSexualActivity),
            ScoredItem(label: "Moderate recreation (golf, bowling, dancing) +6.00", points: 6.00, present: i.participateInModerateRecreation),
            ScoredItem(label: "Strenuous sports (swimming, tennis, football) +7.50", points: 7.50, present: i.participateInStrenuous)
        ]

        let rounded = (total * 10).rounded() / 10
        return ClinicalScore(
            systemName: "Duke Activity Status Index",
            abbreviation: "DASI",
            score: rounded, maxScore: 58.2,
            risk: risk,
            interpretation: "DASI \(String(format: "%.1f", rounded)) — \(interp)",
            recommendations: recs,
            items: items,
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

        let items: [ScoredItem] = [
            ScoredItem(label: "Age category (\(["<40","40–49","50–59","60–69","70–79","≥80"][min(i.ageCategory,5)])) +\(agePts)", points: Double(agePts), present: true),
            ScoredItem(label: "Heart rate (\(["<70","70–89","90–109","110–149","150–199","≥200"][min(i.heartRate,5)]) bpm) +\(hrPts)", points: Double(hrPts), present: true),
            ScoredItem(label: "Systolic BP (\(["<80","80–99","100–119","120–139","140–159","160–199","≥200"][min(i.systolicBP,6)]) mmHg) +\(sbpPts)", points: Double(sbpPts), present: true),
            ScoredItem(label: "Creatinine (\(["0–0.39","0.4–0.79","0.8–1.19","1.2–1.59","1.6–1.99","2.0–3.99","≥4.0"][min(i.creatinine,6)]) mg/dL) +\(creatPts)", points: Double(creatPts), present: true),
            ScoredItem(label: "Killip class \(i.killipClass + 1) +\(killipPts)", points: Double(killipPts), present: true),
            ScoredItem(label: "Cardiac arrest at admission +43", points: 43, present: i.cardiacArrest),
            ScoredItem(label: "Elevated cardiac markers +15", points: 15, present: i.elevatedMarkers),
            ScoredItem(label: "ST-segment deviation +30", points: 30, present: i.stDeviation)
        ]

        return ClinicalScore(
            systemName: "GRACE Score",
            abbreviation: "GRACE",
            score: Double(total), maxScore: 372,
            risk: risk,
            interpretation: "GRACE \(total) — \(interp)",
            recommendations: recs,
            items: items,
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

        let eblLabels = [">1000 mL (+0)", "601-1000 mL (+1)", "101-600 mL (+2)", "≤100 mL (+3)"]
        let mapLabels = ["<40 mmHg (+0)", "40–54 mmHg (+1)", "55–69 mmHg (+2)", "≥70 mmHg (+3)"]
        let hrLabels  = ["≥120 bpm (+0)", "101–119 bpm (+0)", "86–100 bpm (+1)", "56–85 bpm (+3)", "41–55 bpm (+2)", "≤40 bpm (+0)"]
        let items: [ScoredItem] = [
            ScoredItem(label: "Estimated blood loss: \(eblLabels[min(i.estimatedBloodLoss, 3)])", points: Double(eblPts), present: true),
            ScoredItem(label: "Lowest MAP: \(mapLabels[min(i.lowestMAP, 3)])", points: Double(mapPts), present: true),
            ScoredItem(label: "Lowest heart rate: \(hrLabels[min(i.lowestHeartRate, 5)])", points: Double(hrPts), present: true)
        ]

        return ClinicalScore(
            systemName: "Surgical Apgar Score",
            abbreviation: "SAS",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: "SAS \(total)/10 — \(interp)",
            recommendations: recs,
            items: items,
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

        let items: [ScoredItem] = [
            ScoredItem(label: "Build/Weight", points: Double(i.buildWeight), present: i.buildWeight > 0),
            ScoredItem(label: "Skin type", points: Double(i.skinType), present: i.skinType > 0),
            ScoredItem(label: "Sex/Age", points: Double(i.sexAge), present: i.sexAge > 0),
            ScoredItem(label: "Mobility", points: Double(i.mobility), present: i.mobility > 0),
            ScoredItem(label: "Continence", points: Double(i.continence), present: i.continence > 0),
            ScoredItem(label: "Appetite", points: Double(i.appetite), present: i.appetite > 0),
            ScoredItem(label: "Tissue malnutrition / cachexia", points: 8, present: i.tissuemalnutrition),
            ScoredItem(label: "Neurological deficit", points: 5, present: i.neurologicalDeficit),
            ScoredItem(label: "Major surgery / trauma", points: 5, present: i.majorSurgery),
            ScoredItem(label: "Cytotoxics / high-dose steroids", points: 4, present: i.onCytotoxics)
        ]

        return ClinicalScore(
            systemName: "Waterlow Pressure Ulcer Risk",
            abbreviation: "Waterlow",
            score: Double(total), maxScore: 64,
            risk: risk,
            interpretation: "Waterlow \(total) — \(interp)",
            recommendations: recs,
            items: items,
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

        let items: [ScoredItem] = [
            ScoredItem(label: "Age ≥65",                           points: 1, present: i.ageOver65),
            ScoredItem(label: "≥3 CAD risk factors",              points: 1, present: i.threeOrMoreRiskFactors),
            ScoredItem(label: "Prior coronary stenosis ≥50%",     points: 1, present: i.priorCoronaryArteryStenosis),
            ScoredItem(label: "ST deviation on ECG",              points: 1, present: i.stDeviationOnECG),
            ScoredItem(label: "≥2 anginal events in prior 24 h",  points: 1, present: i.twoOrMoreAnginalEvents),
            ScoredItem(label: "Aspirin use in prior 7 days",      points: 1, present: i.aspirinUseInLast7Days),
            ScoredItem(label: "Elevated cardiac markers",         points: 1, present: i.elevatedCardiacMarkers)
        ]

        return ClinicalScore(
            systemName: "TIMI Risk Score (UA/NSTEMI)",
            abbreviation: "TIMI",
            score: Double(total), maxScore: 7,
            risk: risk,
            interpretation: "TIMI \(total)/7 — \(interp)",
            recommendations: recs,
            items: items,
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
        let items: [ScoredItem] = [
            ScoredItem(label: data.label, points: Double(i.level), present: true)
        ]
        return ClinicalScore(
            systemName: "Clinical Frailty Scale",
            abbreviation: "CFS \(i.level)",
            score: Double(i.level), maxScore: 9,
            risk: data.risk,
            interpretation: "\(data.label) — \(data.interp)",
            recommendations: data.recs,
            items: items,
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

        let items: [ScoredItem] = [
            ScoredItem(label: classLabel, points: Double(i.mallampatiClass), present: true),
            ScoredItem(label: "Reduced mouth opening", points: 1, present: i.mouthOpening),
            ScoredItem(label: "Restricted neck mobility", points: 1, present: i.neckMobility),
            ScoredItem(label: "Short thyromental distance", points: 1, present: i.thyromental),
            ScoredItem(label: "Retrognathia / micrognathia", points: 1, present: i.retrognathia),
            ScoredItem(label: "Obesity / large neck", points: 1, present: i.obesity),
            ScoredItem(label: "Beard or poorly-fitting dentures", points: 1, present: i.beardOrDentures)
        ]

        return ClinicalScore(
            systemName: "Mallampati Airway Classification",
            abbreviation: "Class \(["I","II","III","IV"][max(0,i.mallampatiClass-1)])",
            score: Double(i.mallampatiClass + additionalPredictors), maxScore: 10,
            risk: finalRisk,
            interpretation: "\(classLabel); \(additionalPredictors) additional predictor(s) — \(difficultyDesc)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Mallampati SR et al. Can Anaesth Soc J 1985;32:429–434. Samsoon GL & Young JR. Anaesthesia 1987;42:487–490."
        )
    }

    // MARK: - HEART Score (chest pain risk stratification)

    static func heart(_ i: HEARTInput) -> ClinicalScore {
        let total = i.history + i.ecg + i.ageScore + i.riskFactors + i.troponin
        let (risk, interp, recs, flags) = heartRisk(total)
        let items: [ScoredItem] = [
            ScoredItem(label: "History",      points: Double(i.history),     present: i.history > 0),
            ScoredItem(label: "ECG",          points: Double(i.ecg),         present: i.ecg > 0),
            ScoredItem(label: "Age",          points: Double(i.ageScore),    present: i.ageScore > 0),
            ScoredItem(label: "Risk factors", points: Double(i.riskFactors), present: i.riskFactors > 0),
            ScoredItem(label: "Troponin",     points: Double(i.troponin),    present: i.troponin > 0)
        ]
        return ClinicalScore(
            systemName: "HEART Score",
            abbreviation: "HEART",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: "HEART \(total)/10 — \(interp)",
            recommendations: recs,
            items: items,
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
        var items: [ScoredItem] = []
        items.append(ScoredItem(
            label: i.nutritionalStatus < nsLabels.count ? nsLabels[i.nutritionalStatus] : "Nutritional status \(i.nutritionalStatus)",
            points: Double(i.nutritionalStatus), present: i.nutritionalStatus > 0))
        items.append(ScoredItem(
            label: i.diseaseSeverity < dsLabels.count ? dsLabels[i.diseaseSeverity] : "Disease severity \(i.diseaseSeverity)",
            points: Double(i.diseaseSeverity), present: i.diseaseSeverity > 0))
        items.append(ScoredItem(label: "Age ≥70 years", points: 1, present: i.ageOver70))
        return ClinicalScore(
            systemName: "NRS-2002",
            abbreviation: "NRS \(total)",
            score: Double(total), maxScore: 7,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
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

    // MARK: - Clavien-Dindo Classification (Surgical Complication Grading)

    struct ClavienDindoInput: Equatable {
        // 0=None, 1=Grade I, 2=Grade II, 3=Grade IIIa, 4=Grade IIIb,
        // 5=Grade IVa, 6=Grade IVb, 7=Grade V
        var grade: Int = 0
    }

    static func clavienDindo(_ i: ClavienDindoInput) -> ClinicalScore {
        let gradeStrings = ["None", "I", "II", "IIIa", "IIIb", "IVa", "IVb", "V"]
        let gradeStr = i.grade < gradeStrings.count ? gradeStrings[i.grade] : "?"
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var flags: [String] = []

        switch i.grade {
        case 0:
            risk = .low
            interpretation = "No complication — uneventful postoperative course"
        case 1:
            risk = .low
            interpretation = "Grade I — Minor deviation; bedside management only"
            recs = ["Antiemetics, antipyretics, analgesia, diuretics, or electrolytes as needed",
                    "Physiotherapy permitted",
                    "Wound drainage at bedside is included in this grade"]
        case 2:
            risk = .moderate
            interpretation = "Grade II — Pharmacological treatment beyond Grade I allowances"
            recs = ["Blood transfusion or total parenteral nutrition if indicated",
                    "Antimicrobials for organ-space infection",
                    "Document drug name, dose, and indication"]
            flags = ["Complication requiring drug therapy beyond simple analgesia/antiemetic"]
        case 3:
            risk = .high
            interpretation = "Grade IIIa — Surgical/endoscopic/radiological intervention; no general anaesthesia"
            recs = ["Proceed to indicated intervention under local/regional anaesthesia",
                    "Obtain informed consent; document indication and technique",
                    "Radiological drainage, bedside washout, or flexible endoscopy as appropriate"]
            flags = ["Procedural intervention required (no GA)"]
        case 4:
            risk = .high
            interpretation = "Grade IIIb — Surgical/endoscopic/radiological intervention; general anaesthesia"
            recs = ["Return to theatre or interventional suite under GA",
                    "Anaesthetic review and pre-operative optimisation",
                    "Inform next of kin; consent for return to theatre"]
            flags = ["Return to theatre required — GA", "Anaesthetic review needed"]
        case 5:
            risk = .critical
            interpretation = "Grade IVa — Life-threatening complication; single organ dysfunction"
            recs = ["Immediate ICU admission",
                    "Single organ support (e.g. renal replacement, mechanical ventilation)",
                    "Senior surgeon and intensivist co-management",
                    "Daily MDT review; family meeting within 24 h"]
            flags = ["Life-threatening — ICU required", "Single organ failure"]
        case 6:
            risk = .critical
            interpretation = "Grade IVb — Life-threatening complication; multiorgan dysfunction"
            recs = ["Immediate ICU admission with multiorgan support",
                    "Senior surgeon, intensivist, and relevant specialist co-management",
                    "Consider goals-of-care discussion with family",
                    "Daily MDT review; detailed documentation of trajectory"]
            flags = ["Life-threatening — ICU required", "Multiorgan failure", "Consider goals-of-care discussion"]
        default:
            risk = .critical
            interpretation = "Grade V — Death"
            recs = ["Complete incident documentation and mortality review",
                    "M&M case registration",
                    "Coroner notification per local jurisdiction if required"]
            flags = ["Fatal complication — mortality review mandatory"]
        }

        return ClinicalScore(
            systemName: "Clavien-Dindo Classification",
            abbreviation: "Clavien-Dindo \(gradeStr)",
            score: Double(i.grade), maxScore: 7,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [ScoredItem(label: "Complication grade: \(gradeStr)", points: Double(i.grade), present: i.grade > 0)],
            redFlags: flags,
            evidenceNote: "Dindo D, Demartines N, Clavien PA. Ann Surg 2004;240:205–213. Dindo D et al. World J Surg 2010. Standard surgical complication classification used in ACS NSQIP and ESCP audits."
        )
    }

    // MARK: - Modified Aldrete Recovery Score (PACU Discharge Readiness)

    struct AldreteInput: Equatable {
        var activity: Int = 0       // 0=No movement; 1=Moves 2 limbs; 2=Moves all limbs
        var respiration: Int = 0    // 0=Apnoeic; 1=Dyspnoea/shallow; 2=Deep/coughs freely
        var circulation: Int = 0    // 0=BP >±50 mmHg pre-op; 1=±20–50 mmHg; 2=±20 mmHg
        var consciousness: Int = 0  // 0=Unresponsive; 1=Arousable on calling; 2=Fully awake
        var oxygenSat: Int = 0      // 0=<90% on O₂; 1=Needs O₂ to maintain ≥90%; 2=≥92% RA
    }

    static func aldrete(_ i: AldreteInput) -> ClinicalScore {
        let total = i.activity + i.respiration + i.circulation + i.consciousness + i.oxygenSat
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String] = []

        switch total {
        case 9...10:
            risk = .low
            interpretation = "Score \(total)/10 — Fit for discharge from PACU"
            recs = ["Transfer to ward when pain and nausea controlled",
                    "Confirm vital signs stable ≥15 min before transfer",
                    "Hand over written PACU summary to ward nurse"]
        case 7..<9:
            risk = .moderate
            interpretation = "Score \(total)/10 — Continued PACU observation; reassess in 30 min"
            recs = ["Identify and address limiting parameters",
                    "Oxygen supplementation if SpO₂ <92% on air",
                    "Anti-emetics and analgesia as required",
                    "Anaesthetist review if score not improving at 60 min"]
        default:
            risk = .high
            interpretation = "Score \(total)/10 — Not fit for transfer; active management required"
            recs = ["Ongoing PACU monitoring with anaesthetist review",
                    "Active management of circulatory, respiratory, or neurological deficiencies",
                    "Consider ICU/HDU referral if score ≤4 or not improving"]
            if i.circulation == 0 { flags.append("Haemodynamic instability — BP >50 mmHg from baseline") }
            if i.respiration == 0 { flags.append("Apnoea — airway management required") }
            if i.consciousness == 0 { flags.append("Unresponsive — anaesthetic review urgent") }
            if i.oxygenSat == 0    { flags.append("Hypoxaemia on supplemental O₂") }
        }

        return ClinicalScore(
            systemName: "Modified Aldrete Recovery Score",
            abbreviation: "Aldrete \(total)/10",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Activity",          points: Double(i.activity),      present: i.activity > 0),
                ScoredItem(label: "Respiration",       points: Double(i.respiration),   present: i.respiration > 0),
                ScoredItem(label: "Circulation",       points: Double(i.circulation),   present: i.circulation > 0),
                ScoredItem(label: "Consciousness",     points: Double(i.consciousness), present: i.consciousness > 0),
                ScoredItem(label: "Oxygen saturation", points: Double(i.oxygenSat),     present: i.oxygenSat > 0)
            ],
            redFlags: flags,
            evidenceNote: "Aldrete JA, Kroulik D. Anesth Analg 1970;49:924–934. Aldrete JA. J Clin Anesth 1995;7:89–91 (modified). Score ≥9/10 = fit for PACU discharge."
        )
    }

    // MARK: - 4T Score (Heparin-Induced Thrombocytopenia)

    struct FourTInput: Equatable {
        // Each domain 0–2
        var thrombocytopenia: Int = 0   // 0=<30% fall or nadir<10; 1=30–50% or nadir 10–19; 2=≥50% fall and nadir≥20
        var timing: Int = 0             // 0=<4 days without recent heparin; 1=consistent but not clear; 2=5–10 days or ≤1 day if prior heparin within 30 days
        var thrombosis: Int = 0         // 0=none; 1=progressive/recurrent or erythematous skin lesions; 2=new thrombosis, skin necrosis, or acute systemic reaction after IV heparin bolus
        var otherCause: Int = 0         // 0=definite other cause; 1=possible other cause; 2=no other cause evident
    }

    static func fourT(_ i: FourTInput) -> ClinicalScore {
        let total = i.thrombocytopenia + i.timing + i.thrombosis + i.otherCause
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String]

        switch total {
        case 0...3:
            risk = .low
            interpretation = "4T Score \(total) — Low probability of HIT (<5%)"
            recs = ["HIT unlikely; continue heparin if clinically indicated",
                    "No need for HIT-specific antibody testing based on score alone",
                    "Monitor platelet count per clinical indication"]
            flags = []
        case 4...5:
            risk = .moderate
            interpretation = "4T Score \(total) — Intermediate probability of HIT (~10–30%)"
            recs = ["Discontinue all heparin products (including flushes and LMWH) pending investigation",
                    "Send anti-PF4/heparin ELISA antibody assay urgently",
                    "Switch to alternative non-heparin anticoagulant (argatroban, fondaparinux, or danaparoid) if anticoagulation required",
                    "Haematology review",
                    "Do NOT give warfarin until platelet count has recovered to ≥150 × 10⁹/L"]
            flags = ["Intermediate HIT probability — stop heparin and test anti-PF4 antibodies",
                     "Risk of venous and arterial limb-threatening thrombosis"]
        default:
            risk = .critical
            interpretation = "4T Score \(total) — High probability of HIT (>80%)"
            recs = ["Immediately discontinue ALL heparin-containing products",
                    "Initiate non-heparin anticoagulation urgently (argatroban or bivalirudin for HIT with thrombosis)",
                    "Send anti-PF4/heparin ELISA and serotonin release assay (SRA)",
                    "Urgent haematology consult",
                    "Doppler ultrasound to exclude DVT/thrombosis",
                    "Do NOT give warfarin, platelet transfusions, or LMWH",
                    "Anticoagulate for minimum 4 weeks after platelet recovery"]
            flags = ["HIGH probability HIT — immediate heparin cessation mandatory",
                     "Life-threatening thrombotic complication risk",
                     "Urgent haematology review required"]
        }

        return ClinicalScore(
            systemName: "4T Score",
            abbreviation: "4T \(total)/8",
            score: Double(total), maxScore: 8,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Thrombocytopenia",     points: Double(i.thrombocytopenia), present: i.thrombocytopenia > 0),
                ScoredItem(label: "Timing of platelet fall", points: Double(i.timing),        present: i.timing > 0),
                ScoredItem(label: "Thrombosis / skin necrosis", points: Double(i.thrombosis), present: i.thrombosis > 0),
                ScoredItem(label: "Other cause",           points: Double(i.otherCause),       present: i.otherCause > 0)
            ],
            redFlags: flags,
            evidenceNote: "Warkentin TE et al. Thromb Haemost 2003;90:759–765. Lo GK et al. J Thromb Haemost 2006;4:759–765. Validated pre-test probability tool for HIT diagnosis; positive predictive value ~50–80% at high scores."
        )
    }

    // MARK: - Oakland Score (Lower GI Bleed — Safe Discharge)

    struct OaklandInput: Equatable {
        var ageScore: Int = 0        // 0=<40; 1=40–69; 2=≥70
        var sexMale: Bool = false    // male = +1
        var previousLGIB: Bool = false  // previous hospital admission for LGIB = +1
        var dre: Int = 0             // 0=no blood on DRE; 1=blood on DRE
        var heartRate: Int = 0       // 0=<70; 1=70–89; 2=≥90 bpm
        var sbp: Int = 0             // 0=≥160 mmHg; 1=130–159; 2=100–129; 3=<100 mmHg
        var hbScore: Int = 0         // 0=Hb≥16 g/dL(M)/≥13(F); scale to 6 = Hb<7 g/dL
    }

    static func oakland(_ i: OaklandInput) -> ClinicalScore {
        let total = i.ageScore + (i.sexMale ? 1 : 0) + (i.previousLGIB ? 1 : 0)
                  + i.dre + i.heartRate + i.sbp + i.hbScore
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String]

        switch total {
        case 0...8:
            risk = .low
            interpretation = "Oakland \(total) — Low risk; safe discharge appropriate (rebleed <5%)"
            recs = ["Outpatient colonoscopy within 2 weeks",
                    "Written discharge advice; return if haematochezia recurs",
                    "GP follow-up and full blood count in 2–3 days"]
            flags = []
        case 9...14:
            risk = .moderate
            interpretation = "Oakland \(total) — Intermediate risk; inpatient observation recommended"
            recs = ["Admit for inpatient colonoscopy within 24 h of bowel preparation",
                    "IV access and fluid resuscitation as required",
                    "Serial haematocrit monitoring every 6 h",
                    "Gastroenterology or colorectal surgery review"]
            flags = ["Intermediate-risk LGIB — inpatient workup required"]
        default:
            risk = .high
            interpretation = "Oakland \(total) — High risk; urgent inpatient management required"
            recs = ["Resuscitate with IV crystalloid; crossmatch and group-and-save",
                    "Urgent colonoscopy after rapid bowel preparation (≤24 h)",
                    "CT angiography if haemodynamically unstable or colonoscopy not feasible",
                    "Interventional radiology and colorectal surgery on standby",
                    "HDU/ICU admission if haemodynamic compromise"]
            flags = ["High-risk LGIB — haemodynamic instability likely",
                     "Urgent endoscopic or radiological haemostasis may be required"]
        }

        return ClinicalScore(
            systemName: "Oakland Score (LGIB)",
            abbreviation: "Oakland \(total)",
            score: Double(total), maxScore: 29,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Age",             points: Double(i.ageScore),         present: i.ageScore > 0),
                ScoredItem(label: "Male sex",        points: i.sexMale ? 1.0 : 0.0,      present: i.sexMale),
                ScoredItem(label: "Previous LGIB",   points: i.previousLGIB ? 1.0 : 0.0, present: i.previousLGIB),
                ScoredItem(label: "Blood on DRE",    points: Double(i.dre),              present: i.dre > 0),
                ScoredItem(label: "Heart rate",      points: Double(i.heartRate),        present: i.heartRate > 0),
                ScoredItem(label: "Systolic BP",     points: Double(i.sbp),              present: i.sbp > 0),
                ScoredItem(label: "Haemoglobin",     points: Double(i.hbScore),          present: i.hbScore > 0)
            ],
            redFlags: flags,
            evidenceNote: "Oakland K et al. BMJ 2017;356:i6432. Validated for safe-discharge decision in acute LGIB presenting to ED. Score ≤8 = 95% probability of safe discharge without adverse outcome."
        )
    }

    // MARK: - King's College Criteria (Acute Liver Failure — Transplant Referral)

    struct KingsCriteriaInput: Equatable {
        var isParacetamol: Bool = false  // true = paracetamol aetiology; false = non-paracetamol

        // Shared / non-paracetamol criteria
        var ptAbove100: Bool = false          // PT >100 s (INR >6.5) — single-criterion for non-paracetamol
        var ptAbove50: Bool = false           // PT >50 s (one of 5 non-paracetamol minor criteria)
        var ageUnder10OrAbove40: Bool = false // Age <10 or >40 years
        var jaundiceToDays: Bool = false      // Jaundice-to-encephalopathy interval >7 days
        var bilirubinAbove300: Bool = false   // Bilirubin >300 µmol/L
        var unfavourableAetiology: Bool = false // Drug (non-paracetamol), Wilson's, or indeterminate

        // Paracetamol-specific
        var acidosisPhBelow730: Bool = false  // Arterial pH <7.30 after resuscitation (strongest predictor)
        var creatinineAbove300: Bool = false  // Creatinine >300 µmol/L (or anuria)
        var encephalopathyGrade34: Bool = false // Grade III or IV hepatic encephalopathy
    }

    static func kingsCriteria(_ i: KingsCriteriaInput) -> ClinicalScore {
        let met: Bool
        let interpretation: String
        var recs: [String]
        var flags: [String]

        if i.isParacetamol {
            // Paracetamol: pH criterion OR (PT+Cr+Encephalopathy triple)
            let tripleMet = i.ptAbove100 && i.creatinineAbove300 && i.encephalopathyGrade34
            met = i.acidosisPhBelow730 || tripleMet
            if i.acidosisPhBelow730 {
                interpretation = "King's Criteria MET — Arterial pH <7.30 (paracetamol ALF)"
            } else if tripleMet {
                interpretation = "King's Criteria MET — Triple criterion: PT>100 + Cr>300 + Grade III/IV encephalopathy"
            } else {
                let countNear = [i.ptAbove100, i.creatinineAbove300, i.encephalopathyGrade34].filter { $0 }.count
                interpretation = "King's Criteria NOT met — monitor closely (\(countNear)/3 triple criteria present)"
            }
        } else {
            // Non-paracetamol: PT>100 alone, OR ≥3 of 5 minor criteria
            let minorCount = [i.ageUnder10OrAbove40, i.jaundiceToDays, i.ptAbove50,
                               i.bilirubinAbove300, i.unfavourableAetiology].filter { $0 }.count
            met = i.ptAbove100 || minorCount >= 3
            if i.ptAbove100 {
                interpretation = "King's Criteria MET — PT >100 s (non-paracetamol ALF)"
            } else if minorCount >= 3 {
                interpretation = "King's Criteria MET — \(minorCount)/5 minor criteria satisfied (non-paracetamol ALF)"
            } else {
                interpretation = "King's Criteria NOT met — \(minorCount)/5 minor criteria; re-evaluate as disease evolves"
            }
        }

        if met {
            recs = ["Urgent hepatology/transplant centre referral — do not delay",
                    "Contact nearest liver transplant unit immediately",
                    "Ensure adequate venous access; correct coagulopathy only if active bleeding",
                    "N-acetylcysteine infusion if paracetamol aetiology (continue even if criteria met)",
                    "ICU-level monitoring: GCS/encephalopathy grade, ICP monitoring if grade III–IV",
                    "Avoid sedation, nephrotoxins, and hepatotoxic drugs",
                    "Low threshold for renal replacement therapy",
                    "Glucose and electrolyte correction; lactulose for encephalopathy"]
            flags = ["KING'S CRITERIA MET — immediate liver transplant unit referral indicated",
                     "Without transplant, mortality in paracetamol ALF meeting criteria ≈85%"]
        } else {
            recs = ["Continue intensive monitoring of PT, bilirubin, creatinine, and encephalopathy grade",
                    "Hepatology review; daily reassessment against criteria as disease may evolve",
                    "N-acetylcysteine if paracetamol aetiology regardless of criteria status",
                    "Identify and treat underlying aetiology (viral, autoimmune, Wilson's, ischaemic, Budd-Chiari)",
                    "Maintain close liaison with liver transplant unit — early informal notification recommended"]
            flags = []
        }

        let score: Double = met ? 1 : 0
        return ClinicalScore(
            systemName: "King's College Criteria (ALF)",
            abbreviation: met ? "King's: REFER" : "King's: Monitor",
            score: score, maxScore: 1,
            risk: met ? .critical : .moderate,
            interpretation: interpretation,
            recommendations: recs,
            items: i.isParacetamol ? [
                ScoredItem(label: "Arterial pH <7.30",                           points: i.acidosisPhBelow730 ? 1.0 : 0.0,   present: i.acidosisPhBelow730),
                ScoredItem(label: "PT >100 s",                                   points: i.ptAbove100 ? 1.0 : 0.0,           present: i.ptAbove100),
                ScoredItem(label: "Creatinine >300 µmol/L",                     points: i.creatinineAbove300 ? 1.0 : 0.0,   present: i.creatinineAbove300),
                ScoredItem(label: "Grade III/IV encephalopathy",                 points: i.encephalopathyGrade34 ? 1.0 : 0.0, present: i.encephalopathyGrade34)
            ] : [
                ScoredItem(label: "PT >100 s (single criterion)",               points: i.ptAbove100 ? 2.0 : 0.0,            present: i.ptAbove100),
                ScoredItem(label: "Age <10 or >40 years",                       points: i.ageUnder10OrAbove40 ? 1.0 : 0.0,  present: i.ageUnder10OrAbove40),
                ScoredItem(label: "Jaundice-to-encephalopathy >7 days",         points: i.jaundiceToDays ? 1.0 : 0.0,       present: i.jaundiceToDays),
                ScoredItem(label: "PT >50 s",                                   points: i.ptAbove50 ? 1.0 : 0.0,            present: i.ptAbove50),
                ScoredItem(label: "Bilirubin >300 µmol/L",                     points: i.bilirubinAbove300 ? 1.0 : 0.0,    present: i.bilirubinAbove300),
                ScoredItem(label: "Unfavourable aetiology (drug/Wilson's/indeterminate)", points: i.unfavourableAetiology ? 1.0 : 0.0, present: i.unfavourableAetiology)
            ],
            redFlags: flags,
            evidenceNote: "O'Grady JG et al. Gastroenterology 1989;97:439–445. Standard transplant referral criteria for acute liver failure used by British Society of Gastroenterology and AASLD. Paracetamol ALF: pH <7.30 alone sufficient."
        )
    }

    // MARK: - ECOG / WHO Performance Status
    struct ECOGInput: Equatable {
        var grade: Int = 0   // 0=fully active; 1=restricted; 2=ambulatory/self-care; 3=limited; 4=bedbound
    }

    static func ecog(_ i: ECOGInput) -> ClinicalScore {
        let g = min(max(i.grade, 0), 4)
        let (risk, desc): (ScoreRisk, String)
        switch g {
        case 0: (risk, desc) = (.low,      "ECOG 0 — Fully active. No restriction on pre-illness activities. Fit for all treatment modalities.")
        case 1: (risk, desc) = (.low,      "ECOG 1 — Restricted in strenuous activity; ambulatory and capable of light work. Fit for most therapies.")
        case 2: (risk, desc) = (.moderate, "ECOG 2 — Ambulatory; capable of all self-care but unable to work. Up >50% of waking hours. Reduced tolerance for aggressive therapy.")
        case 3: (risk, desc) = (.high,     "ECOG 3 — Limited self-care. Confined to bed or chair >50% of waking hours. Palliative intent typically favoured.")
        default:(risk, desc) = (.high,     "ECOG 4 — Completely disabled. No self-care. Entirely confined to bed or chair. Surgery extremely high-risk.")
        }
        let flags: [String] = g >= 3 ? ["ECOG ≥3: major elective surgery carries prohibitive risk — multidisciplinary team discussion essential"] :
                              g >= 2 ? ["ECOG 2: reduced surgical fitness — optimise before elective procedures"] : []
        return ClinicalScore(
            systemName: "ECOG Performance Status",
            abbreviation: "ECOG \(g)",
            score: Double(g),
            maxScore: 4,
            risk: risk,
            interpretation: desc,
            recommendations: g >= 3 ? [
                "Multidisciplinary team discussion before any elective surgery",
                "Palliative intent should be considered as primary management approach",
                "Nutritional support and rehabilitation assessment recommended"
            ] : g >= 2 ? [
                "Anaesthetic pre-assessment and cardiopulmonary exercise testing (CPET) if surgery planned",
                "Pre-operative optimisation: nutrition, physiotherapy, anaemia treatment",
                "Consider less invasive surgical approaches (laparoscopic, endoscopic)"
            ] : [
                "Standard pre-operative assessment",
                "Document baseline functional status in surgical consent documentation"
            ],
            items: [ScoredItem(label: "Performance grade \(g)", points: Double(g), present: true)],
            redFlags: flags,
            evidenceNote: "Oken MM et al. Am J Clin Oncol 1982;5:649–655. WHO/Eastern Cooperative Oncology Group. Standard metric for functional reserve in oncology and surgical fitness."
        )
    }

    // MARK: - Revised Trauma Score (RTS)
    struct RTSInput: Equatable {
        var glasgowComaScore: Int = 15    // 3–15
        var systolicBP: Int = 120         // mmHg
        var respiratoryRate: Int = 16     // breaths/min
    }

    static func rts(_ i: RTSInput) -> ClinicalScore {
        func gcsCoded(_ v: Int) -> Int {
            if v >= 13 { return 4 }; if v >= 9 { return 3 }; if v >= 6 { return 2 }
            if v >= 4 { return 1 }; return 0
        }
        func sbpCoded(_ v: Int) -> Int {
            if v > 89  { return 4 }; if v >= 76 { return 3 }; if v >= 50 { return 2 }
            if v >  0  { return 1 }; return 0
        }
        func rrCoded(_ v: Int) -> Int {
            if v >= 10 && v <= 29 { return 4 }; if v >= 6 { return 3 }
            if v >= 1 { return 2 }; if v > 29 { return 4 }; return 0
        }
        let gcs = gcsCoded(max(3, min(15, i.glasgowComaScore)))
        let sbp = sbpCoded(max(0, i.systolicBP))
        let rr  = rrCoded(max(0, i.respiratoryRate))
        // Weighted RTS (Triage Revised Trauma Score: 0–7.84)
        let rtsScore = 0.9368 * Double(gcs) + 0.7326 * Double(sbp) + 0.2908 * Double(rr)
        let (risk, interp): (ScoreRisk, String)
        switch rtsScore {
        case 7...:  (risk, interp) = (.low,      "RTS \(String(format: "%.2f", rtsScore)) — Minor injury. Predicted survival ~98%. Standard triage.")
        case 4...:  (risk, interp) = (.moderate, "RTS \(String(format: "%.2f", rtsScore)) — Moderate-severe injury. Predicted survival ~60–75%. Priority triage.")
        case 1...:  (risk, interp) = (.high,     "RTS \(String(format: "%.2f", rtsScore)) — Critical injury. Predicted survival ~25–50%. Immediate triage.")
        default:    (risk, interp) = (.high,     "RTS \(String(format: "%.2f", rtsScore)) — Unsurvivable / expectant. Predicted survival <5%.")
        }
        let flags: [String] = rtsScore < 4 ? ["RTS <4: activate major trauma protocol; immediate senior trauma surgeon and anaesthesia"] : []
        return ClinicalScore(
            systemName: "Revised Trauma Score",
            abbreviation: "RTS \(String(format: "%.2f", rtsScore))",
            score: rtsScore,
            maxScore: 7.84,
            risk: risk,
            interpretation: interp,
            recommendations: rtsScore < 4 ? [
                "Activate major trauma protocol immediately",
                "Airway management priority — consider early intubation",
                "Haemorrhage control — transfusion protocol activation",
                "Immediate CT trauma survey if patient stable for transport",
                "Notify operating theatre for emergency damage-control surgery"
            ] : rtsScore < 7 ? [
                "Priority assessment — full trauma workup",
                "Repeat vitals and GCS every 15 minutes",
                "IV access ×2, analgesia, splintage of long-bone fractures"
            ] : [
                "Standard trauma assessment",
                "Analgesia and appropriate wound management"
            ],
            items: [
                ScoredItem(label: "GCS coded (\(i.glasgowComaScore) → \(gcs))", points: Double(gcs), present: true),
                ScoredItem(label: "SBP coded (\(i.systolicBP) mmHg → \(sbp))",  points: Double(sbp), present: true),
                ScoredItem(label: "RR coded (\(i.respiratoryRate) bpm → \(rr))",  points: Double(rr),  present: true)
            ],
            redFlags: flags,
            evidenceNote: "Champion HR et al. J Trauma 1989;29:623–629. Weighted RTS; ISS complement for TRISS survival probability. Coded GCS + SBP + RR."
        )
    }

    // MARK: - KDIGO AKI Staging (Acute Kidney Injury)
    struct KDIGOInput: Equatable {
        var stage: Int = 0           // 0=No AKI; 1=Stage1; 2=Stage2; 3=Stage3
        var creatinineRise: Int = 0  // 0=<1.5×base; 1=1.5–1.9×; 2=2.0–2.9×; 3=≥3× or >354µmol/L
        var urineOutput: Int = 0     // 0=normal; 1=<0.5mL/kg/h ×6h; 2=<0.5mL/kg/h ×12h; 3=<0.3mL/kg/h ×24h or anuria ×12h
        var requiresRRT: Bool = false
    }

    static func kdigo(_ i: KDIGOInput) -> ClinicalScore {
        let stage = i.requiresRRT ? 3 : max(i.creatinineRise, i.urineOutput)
        let (risk, interp): (ScoreRisk, String)
        switch stage {
        case 0: (risk, interp) = (.low,      "No KDIGO AKI criteria met. Monitor renal function in high-risk perioperative patients.")
        case 1: (risk, interp) = (.moderate, "KDIGO AKI Stage 1 — 1.5–1.9× creatinine rise OR UO <0.5 mL/kg/h for ≥6 h. Risk of progression to Stage 2–3 ~30%.")
        case 2: (risk, interp) = (.high,     "KDIGO AKI Stage 2 — 2.0–2.9× creatinine rise OR UO <0.5 mL/kg/h for ≥12 h. CKD risk high; nephrology input recommended.")
        default:(risk, interp) = (.high,     "KDIGO AKI Stage 3 — ≥3× creatinine rise or ≥354 µmol/L, OR UO <0.3 mL/kg/h ×24 h/anuria ×12 h, OR RRT required. Mortality ≥50% in ICU context.")
        }
        let flags: [String] = stage >= 3 ? ["KDIGO Stage 3 / RRT required — urgent nephrology referral; ICU-level monitoring essential"] :
                              stage >= 2 ? ["KDIGO Stage 2 — nephrology input; avoid nephrotoxins; optimise haemodynamics"] : []
        return ClinicalScore(
            systemName: "KDIGO AKI Staging",
            abbreviation: "KDIGO AKI Stage \(stage)",
            score: Double(stage),
            maxScore: 3,
            risk: risk,
            interpretation: interp,
            recommendations: stage >= 3 ? [
                "Urgent nephrology referral for RRT assessment",
                "Strict fluid balance and daily weights",
                "Avoid all nephrotoxins (NSAIDs, aminoglycosides, contrast)",
                "Review and renally-adjust all drug dosages",
                "Plan for renal recovery — consider renal biopsy if diagnosis unclear"
            ] : stage >= 2 ? [
                "Nephrology review within 24 hours",
                "Optimise cardiac output and renal perfusion pressure",
                "Bladder catheterisation for accurate urine output monitoring",
                "Avoid nephrotoxins; adjust drug doses for eGFR"
            ] : stage == 1 ? [
                "Monitor creatinine and urine output closely (4-hourly)",
                "Identify and treat reversible causes: hypovolaemia, obstruction, nephrotoxins",
                "Optimise fluid status — target euvolaemia"
            ] : [
                "Monitor renal function in high-risk patients (major surgery, sepsis, contrast exposure)",
                "Baseline creatinine documented for perioperative comparison"
            ],
            items: [
                ScoredItem(label: "Creatinine rise (\(["<1.5×", "1.5–1.9×", "2.0–2.9×", "≥3×/354+"][min(i.creatinineRise,3)])", points: Double(i.creatinineRise), present: i.creatinineRise > 0),
                ScoredItem(label: "Urine output criterion (\(["normal", "<0.5 ×6h", "<0.5 ×12h", "<0.3 ×24h"][min(i.urineOutput,3)])", points: Double(i.urineOutput), present: i.urineOutput > 0),
                ScoredItem(label: "Renal replacement therapy required", points: i.requiresRRT ? 3.0 : 0.0, present: i.requiresRRT)
            ],
            redFlags: flags,
            evidenceNote: "KDIGO AKI Work Group. Kidney Int Suppl 2012;2:1–138. Stage based on highest criterion met (creatinine rise or urine output). RRT requirement automatically stage 3."
        )
    }

    // MARK: - Baux Score (Burn Mortality)
    struct BauxInput: Equatable {
        var age: Int = 40               // years
        var tbsa: Int = 20              // % total body surface area burned
        var hasInhalationInjury: Bool = false
    }

    static func baux(_ i: BauxInput) -> ClinicalScore {
        // Baux = age + TBSA; revised Baux adds 17 for inhalation injury
        let rawBaux = i.age + i.tbsa
        let score = Double(i.hasInhalationInjury ? rawBaux + 17 : rawBaux)
        let (risk, interp): (ScoreRisk, String)
        switch score {
        case ..<40:  (risk, interp) = (.low,      "Baux \(Int(score)): Expected mortality <5% in a specialist burns unit.")
        case 40..<80:(risk, interp) = (.moderate, "Baux \(Int(score)): Expected mortality 5–40%. Burns unit admission mandatory.")
        case 80..<120:(risk,interp) = (.high,     "Baux \(Int(score)): Expected mortality 40–80%. ICU-level burns care required.")
        default:     (risk, interp) = (.critical, "Baux \(Int(score)): Expected mortality >80%. Discuss goals of care with family.")
        }
        let flags = score >= 120 ? ["Baux ≥120 — mortality >80%; early goals-of-care discussion"] :
                    score >= 100 ? ["Baux ≥100 — mortality >60%; palliative pathway consideration"] : []
        return ClinicalScore(
            systemName: "Baux Score (Revised)",
            abbreviation: "Baux \(Int(score))",
            score: score,
            maxScore: 200,
            risk: risk,
            interpretation: interp,
            recommendations: score >= 80 ? [
                "Immediate transfer to specialist burns unit / ICU",
                "Early intubation if inhalation injury — don't delay for oedema progression",
                "Formal fluid resuscitation: Parkland formula (4 mL × kg × %TBSA) — first 50% in 8 h",
                "Escharotomy assessment within 2 hours for circumferential full-thickness burns",
                "Burns surgery: early excision and grafting within 48–72 h",
                "Multidisciplinary team: burns surgeon, ICU, nutrition, physiotherapy, psychology"
            ] : score >= 40 ? [
                "Burns unit admission",
                "Fluid resuscitation per Parkland formula",
                "Wound care: silver sulfadiazine / biosynthetic dressing",
                "Early nutritional support — burns have extreme hypermetabolic demand",
                "Analgesia and sedation protocol"
            ] : [
                "Wound assessment and dressing",
                "Tetanus prophylaxis",
                "Analgesia",
                "Outpatient burns review if <15% TBSA, no face/hand/genitalia involvement"
            ],
            items: [
                ScoredItem(label: "Age (\(i.age) years)", points: Double(i.age), present: true),
                ScoredItem(label: "% TBSA burned (\(i.tbsa)%)", points: Double(i.tbsa), present: true),
                ScoredItem(label: "Inhalation injury (+17)", points: 17.0, present: i.hasInhalationInjury)
            ],
            redFlags: flags,
            evidenceNote: "Baux AC. Rev Chir 1961;10:3–10. Revised Baux adds 17 for inhalation injury (Ryan CM et al. J Burn Care Rehabil 1998). Correlates with la Lund–Browder chart TBSA estimate."
        )
    }

    // MARK: - Injury Severity Score (ISS)
    struct ISSInput: Equatable {
        // AIS severity 0–5 for six body regions. 6 = unsurvivable (auto-scores 75).
        var head: Int = 0          // head/neck (including cervical spine)
        var face: Int = 0          // face
        var chest: Int = 0         // chest (including thoracic spine)
        var abdomen: Int = 0       // abdomen/pelvic contents (including lumbar spine)
        var extremity: Int = 0     // extremity/pelvis (including pelvic girdle)
        var external: Int = 0      // external (burns, lacerations, crush)
    }

    static func iss(_ i: ISSInput) -> ClinicalScore {
        let regions = [i.head, i.face, i.chest, i.abdomen, i.extremity, i.external]
        let regionNames = ["Head/Neck", "Face", "Chest", "Abdomen/Pelvis", "Extremity/Pelvis", "External"]
        // If any region AIS=6 → ISS=75 (maximum, non-survivable)
        if regions.contains(6) {
            return ClinicalScore(
                systemName: "Injury Severity Score",
                abbreviation: "ISS 75",
                score: 75,
                maxScore: 75,
                risk: .critical,
                interpretation: "ISS 75 (AIS 6 region): Injury deemed non-survivable. Goals-of-care discussion essential.",
                recommendations: ["Immediate trauma team activation", "Goals-of-care discussion with next of kin", "Palliative care consult"],
                items: zip(regionNames, regions).map { ScoredItem(label: "\($0.0) AIS \($0.1)", points: Double($0.1 * $0.1), present: $0.1 > 0) },
                redFlags: ["AIS 6 — non-survivable injury"],
                evidenceNote: "Baker SP et al. J Trauma 1974;14:187–196."
            )
        }
        // Top 3 AIS squared summed
        let top3 = regions.sorted(by: >).prefix(3)
        let score = Double(top3.reduce(0) { $0 + $1 * $1 })
        let (risk, interp): (ScoreRisk, String)
        switch score {
        case ..<9:   (risk, interp) = (.low,      "ISS \(Int(score)): Minor injury. Standard trauma management.")
        case 9..<16: (risk, interp) = (.moderate, "ISS \(Int(score)): Moderate injury. Trauma team review recommended.")
        case 16..<25:(risk, interp) = (.high,     "ISS \(Int(score)): Severe injury. Trauma centre activation; ICU admission likely.")
        default:     (risk, interp) = (.critical, "ISS \(Int(score)): Critical injury. Mortality risk significant; trauma centre mandatory.")
        }
        let flags = score >= 25 ? ["ISS ≥25 — major trauma; activate major trauma protocol"] : []
        return ClinicalScore(
            systemName: "Injury Severity Score",
            abbreviation: "ISS \(Int(score))",
            score: score,
            maxScore: 75,
            risk: risk,
            interpretation: interp,
            recommendations: score >= 25 ? [
                "Major trauma centre transfer if not already there",
                "Full primary and secondary ATLS survey",
                "CT trauma series (head, C-spine, thorax, abdomen, pelvis)",
                "Massive haemorrhage protocol if haemodynamically unstable",
                "Damage control surgery: haemorrhage control first, definitive repair delayed",
                "Activate trauma team: surgery, orthopaedics, neurosurgery, anaesthesia"
            ] : score >= 16 ? [
                "Trauma team activation",
                "Systematic ATLS primary survey with resuscitation",
                "Targeted imaging per clinical findings",
                "ICU admission planning",
                "Orthopaedic and specialist review as indicated"
            ] : [
                "ATLS primary survey",
                "Appropriate imaging and monitoring",
                "Consider trauma team notification",
                "Discharge with clear head-injury/fracture advice if criteria met"
            ],
            items: zip(regionNames, regions).map { ScoredItem(label: "\($0.0) AIS \($0.1)", points: Double($0.1 * $0.1), present: $0.1 > 0) },
            redFlags: flags,
            evidenceNote: "Baker SP et al. J Trauma 1974;14:187–196. ISS = sum of squares of top 3 AIS body regions. ISS ≥16 = major trauma. AIS 6 auto-scores 75."
        )
    }

    // MARK: - NUTRIC Score (Nutritional Risk in Critically Ill)
    struct NUTRICInput: Equatable {
        var age: Int = 50              // years
        var apacheII: Int = 10         // APACHE II score at ICU admission
        var sofa: Int = 4              // SOFA score at ICU admission
        var comorbidities: Int = 0     // number of comorbidities (0, 1, ≥2)
        var daysHospitalToICU: Int = 0 // days from hospital admission to ICU (0=same day; 1=1 day; 2=≥2 days)
        // IL-6 excluded (high-NUTRIC version not widely used)
    }

    static func nutric(_ i: NUTRICInput) -> ClinicalScore {
        var pts = 0
        // Age
        switch i.age {
        case ..<50: pts += 0
        case 50..<75: pts += 1
        case 75...: pts += 2
        default: break
        }
        // APACHE II
        switch i.apacheII {
        case ..<15: pts += 0
        case 15..<20: pts += 1
        case 20..<28: pts += 2
        case 28...: pts += 3
        default: break
        }
        // SOFA
        switch i.sofa {
        case ..<6: pts += 0
        case 6..<10: pts += 1
        case 10...: pts += 2
        default: break
        }
        // Comorbidities
        pts += min(2, i.comorbidities)
        // Days hospital → ICU
        switch i.daysHospitalToICU {
        case 0: pts += 0
        case 1: pts += 1
        case 2...: pts += 2
        default: break
        }
        let score = Double(pts)
        let (risk, interp): (ScoreRisk, String)
        switch score {
        case ..<5:  (risk, interp) = (.low,      "NUTRIC \(pts): Low nutritional risk. Standard nutritional targets. Monitor for change.")
        case 5..<6: (risk, interp) = (.moderate, "NUTRIC \(pts): Moderate nutritional risk. Consider enhanced protein delivery and close dietitian review.")
        default:    (risk, interp) = (.high,     "NUTRIC \(pts): High nutritional risk (≥6). Aggressive nutritional support associated with improved outcomes. Dietitian-led plan essential.")
        }
        let flags = score >= 6 ? ["NUTRIC ≥6 — high risk; early dietitian involvement and enhanced protein targets (1.5–2 g/kg/day) recommended"] : []
        return ClinicalScore(
            systemName: "NUTRIC Score",
            abbreviation: "NUTRIC \(pts)",
            score: score,
            maxScore: 9,
            risk: risk,
            interpretation: interp,
            recommendations: score >= 6 ? [
                "Dietitian review within 24 hours of ICU admission",
                "High-protein target: 1.5–2.0 g/kg/day actual body weight",
                "Early enteral nutrition within 24–48 h if haemodynamically stable",
                "Monitor tolerance: gastric residual volumes, abdominal distension",
                "Consider supplemental parenteral nutrition if enteral target not met by day 3–7",
                "Daily reassessment of nutritional adequacy"
            ] : [
                "Standard protein target: 1.2–1.5 g/kg/day",
                "Enteral nutrition preferred route; start within 24–48 h",
                "Monitor nutritional adequacy daily",
                "Reassess NUTRIC if clinical status changes"
            ],
            items: [
                ScoredItem(label: "Age \(i.age) yrs", points: i.age >= 75 ? 2 : i.age >= 50 ? 1 : 0, present: i.age >= 50),
                ScoredItem(label: "APACHE II \(i.apacheII)", points: i.apacheII >= 28 ? 3 : i.apacheII >= 20 ? 2 : i.apacheII >= 15 ? 1 : 0, present: i.apacheII >= 15),
                ScoredItem(label: "SOFA \(i.sofa)", points: i.sofa >= 10 ? 2 : i.sofa >= 6 ? 1 : 0, present: i.sofa >= 6),
                ScoredItem(label: "Comorbidities (\(i.comorbidities))", points: Double(min(2, i.comorbidities)), present: i.comorbidities > 0),
                ScoredItem(label: "Days hospital→ICU (\(i.daysHospitalToICU))", points: min(2, Double(i.daysHospitalToICU)), present: i.daysHospitalToICU > 0)
            ],
            redFlags: flags,
            evidenceNote: "Heyland DK et al. JPEN 2011;35:596–605. NUTRIC ≥6 (without IL-6) predicts benefit from high-protein enteral nutrition. Validated in mechanically ventilated ICU patients."
        )
    }

    // MARK: - sPESI (Simplified Pulmonary Embolism Severity Index)
    struct SPESIInput: Equatable {
        var age: Int = 40               // years
        var cancer: Bool = false         // active malignancy
        var cardiopulmonaryDisease: Bool = false  // chronic cardiopulmonary disease (chronic HF or COPD)
        var heartRateAbove109: Bool = false       // HR ≥110 bpm at presentation
        var sbpBelow100: Bool = false             // SBP <100 mmHg
        var spo2Below90: Bool = false             // SpO2 <90% on room air
    }

    static func spesi(_ i: SPESIInput) -> ClinicalScore {
        var pts = 0
        var items: [ScoredItem] = []

        let agePt = i.age > 80 ? 1 : 0
        pts += agePt
        items.append(ScoredItem(label: "Age >80 years", points: 1, present: i.age > 80))
        items.append(ScoredItem(label: "Active cancer", points: 1, present: i.cancer))
        if i.cancer { pts += 1 }
        items.append(ScoredItem(label: "Chronic cardiopulmonary disease (HF or COPD)", points: 1, present: i.cardiopulmonaryDisease))
        if i.cardiopulmonaryDisease { pts += 1 }
        items.append(ScoredItem(label: "HR ≥110 bpm", points: 1, present: i.heartRateAbove109))
        if i.heartRateAbove109 { pts += 1 }
        items.append(ScoredItem(label: "SBP <100 mmHg", points: 1, present: i.sbpBelow100))
        if i.sbpBelow100 { pts += 1 }
        items.append(ScoredItem(label: "SpO₂ <90%", points: 1, present: i.spo2Below90))
        if i.spo2Below90 { pts += 1 }

        let score = Double(pts)
        let flags: [String] = pts >= 1 ? ["sPESI ≥1 — high-risk PE: 30-day mortality ~10.9% vs 1.0% for sPESI 0"] : []
        let (risk, interp): (ScoreRisk, String)
        if pts == 0 {
            (risk, interp) = (.low, "sPESI 0/6: Low-risk PE. Consider outpatient treatment or short hospital stay. 30-day mortality ~1.0%. Criteria: age ≤80, no cancer, no cardiopulmonary disease, HR <110, SBP ≥100, SpO2 ≥90%.")
        } else {
            (risk, interp) = (.high, "sPESI \(pts)/6: High-risk PE. Inpatient management required. 30-day mortality ~10.9%. Consider systemic anticoagulation, risk stratify further with echocardiogram and troponin.")
        }
        return ClinicalScore(
            systemName: "Simplified PESI",
            abbreviation: "sPESI \(pts)/6",
            score: score,
            maxScore: 6,
            risk: risk,
            interpretation: interp,
            recommendations: pts == 0 ? [
                "Consider outpatient management with LMWH or DOAC (e.g. rivaroxaban 15 mg BD for 21 days then 20 mg OD)",
                "Oral anticoagulation for minimum 3 months; assess duration based on provoked vs unprovoked",
                "Arrange close follow-up within 7–14 days",
                "Educate on signs of PE recurrence and bleeding"
            ] : [
                "Admit for inpatient anticoagulation and monitoring",
                "Initiate parenteral anticoagulation (LMWH or UFH) immediately",
                "Echo + troponin/BNP to risk-stratify for intermediate-high vs high-risk PE",
                "If massive PE (haemodynamic instability): systemic thrombolysis or catheter-directed therapy",
                "If intermediate-high risk: consider NOAC after clinical stability, monitor for deterioration",
                "Supplemental oxygen to maintain SpO2 ≥95%",
                "Avoid bed rest in haemodynamically stable patients — early mobilisation"
            ],
            items: items,
            redFlags: flags,
            evidenceNote: "Jiménez D et al. Lancet 2010;376:1043–1048. sPESI validated across multiple cohorts. sPESI 0 identifies patients safe for outpatient PE treatment. ESC 2019 guidelines recommend sPESI for initial PE risk stratification."
        )
    }

    // MARK: - DECAF Score (COPD Exacerbation Severity)
    struct DECAFInput: Equatable {
        var dyspnoeaMRC: Int = 3         // Medical Research Council dyspnoea grade 1–5 (at baseline pre-exacerbation)
        var eosinopenia: Bool = false    // Eosinophils <0.05×10⁹/L on admission bloods
        var consolidation: Bool = false  // Chest X-ray consolidation at presentation
        var acidaemia: Bool = false      // pH <7.30 on arterial blood gas
        var atrialFibrillation: Bool = false  // AF on ECG or history of paroxysmal AF
    }

    static func decaf(_ i: DECAFInput) -> ClinicalScore {
        var pts = 0
        var items: [ScoredItem] = []

        // Dyspnoea MRC ≥4 or ≥5
        let dyspPts: Double = i.dyspnoeaMRC >= 5 ? 2 : (i.dyspnoeaMRC >= 4 ? 1 : 0)
        pts += dyspPts
        items.append(ScoredItem(label: "MRC dyspnoea grade \(i.dyspnoeaMRC) (MRC 3=0, MRC 4=1, MRC 5a/5b=2)", points: dyspPts, present: i.dyspnoeaMRC >= 4))
        items.append(ScoredItem(label: "Eosinopenia (eosinophils <0.05×10⁹/L)", points: 1, present: i.eosinopenia))
        if i.eosinopenia { pts += 1 }
        items.append(ScoredItem(label: "Consolidation on CXR", points: 1, present: i.consolidation))
        if i.consolidation { pts += 1 }
        items.append(ScoredItem(label: "Acidaemia (pH <7.30)", points: 1, present: i.acidaemia))
        if i.acidaemia { pts += 1 }
        items.append(ScoredItem(label: "Atrial fibrillation (AF)", points: 1, present: i.atrialFibrillation))
        if i.atrialFibrillation { pts += 1 }

        let score = Double(pts)
        let flags: [String] = pts >= 3 ? ["DECAF ≥3 — in-hospital mortality 25–49%: consider early ICU/HDU referral"] : []
        let (risk, interp): (ScoreRisk, String)
        switch pts {
        case 0...1:
            (risk, interp) = (.low, "DECAF \(pts)/6: Low risk. In-hospital mortality ~1.4–2.5%. Standard ward management appropriate. Consider early supported discharge pathway if ≤1.")
        case 2:
            (risk, interp) = (.moderate, "DECAF \(pts)/6: Moderate risk. In-hospital mortality ~6.3%. Admission required; close monitoring for deterioration.")
        default:
            (risk, interp) = (.high, "DECAF \(pts)/6: High risk. In-hospital mortality 25–49%. Early ICU/HDU assessment required. Consider NIV if pH <7.35.")
        }
        return ClinicalScore(
            systemName: "DECAF Score",
            abbreviation: "DECAF \(pts)/6",
            score: score,
            maxScore: 6,
            risk: risk,
            interpretation: interp,
            recommendations: pts >= 3 ? [
                "Early ICU/HDU referral — high mortality group",
                "Non-invasive ventilation (NIV) if pH <7.35 with hypercapnia",
                "Controlled oxygen therapy: target SpO2 88–92% (24% Venturi mask)",
                "Systemic corticosteroids: prednisolone 30–40 mg daily for 5 days",
                "Antibiotics if sputum purulent or consolidation on CXR",
                "Bronchodilators: salbutamol and ipratropium nebulisers",
                "Thromboprophylaxis with LMWH",
                "Review goals of care and ceiling of treatment early"
            ] : pts == 2 ? [
                "Admit to respiratory ward; 4-hourly observations minimum",
                "Controlled oxygen therapy: SpO2 88–92%",
                "Systemic corticosteroids and bronchodilators",
                "Antibiotics if purulent sputum or fever",
                "Monitor for acidaemia — repeat ABG at 1 h if pH <7.35 on arrival",
                "LMWH thromboprophylaxis"
            ] : [
                "Standard medical ward admission",
                "Controlled oxygen: SpO2 88–92%",
                "Oral prednisolone 30 mg for 5 days",
                "Short-acting bronchodilators (salbutamol + ipratropium nebulisers 4-hourly)",
                "Consider early supported discharge at 24–48 h if clinical improvement"
            ],
            items: items,
            redFlags: flags,
            evidenceNote: "Steer J et al. Thorax 2012;67:970–976. DECAF validated in UK COPD cohorts (n=920). DECAF 0–1 identifies low-risk patients suitable for early discharge pathways. Superior to APACHE II for acute COPD exacerbations."
        )
    }

    // MARK: - Hinchey Classification (Perforated Diverticulitis)
    struct HincheyInput: Equatable {
        var grade: Int = 1  // 1a=pericolic abscess, 1b=mesorectal abscess, 2=pelvic abscess, 3=purulent peritonitis, 4=faecal peritonitis
    }

    static func hinchey(_ i: HincheyInput) -> ClinicalScore {
        let score = Double(i.grade)
        let flags: [String] = i.grade >= 3 ? ["Hinchey III/IV — generalised peritonitis: emergency surgery required"] : []
        let (risk, interp, recs): (ScoreRisk, String, [String])
        switch i.grade {
        case 1:
            (risk, interp, recs) = (
                .low,
                "Hinchey I (pericolic/mesorectal abscess): Localised pericolic or mesorectal abscess. Conservative management appropriate in most cases.",
                [
                    "IV antibiotics: co-amoxiclav 1.2 g TDS or piperacillin-tazobactam 4.5 g TDS",
                    "Nil by mouth until clinical improvement; then clear fluids",
                    "CT-guided percutaneous drainage if abscess >4 cm",
                    "Bowel rest and IV fluids",
                    "Reassess at 48–72 h; consider surgery if failure to improve",
                    "Elective sigmoid resection (laparoscopic Hartmann's or primary anastomosis) 6–8 weeks after recovery"
                ]
            )
        case 2:
            (risk, interp, recs) = (
                .moderate,
                "Hinchey II (pelvic abscess): Pelvic or distant abscess. CT-guided drainage is first-line; surgery if drainage fails.",
                [
                    "CT-guided percutaneous drainage if technically feasible",
                    "IV antibiotics: piperacillin-tazobactam 4.5 g TDS + metronidazole 500 mg TDS",
                    "Monitor WBC, CRP, and fever curve",
                    "Failure to respond at 48–72 h: laparoscopic lavage vs Hartmann's procedure",
                    "Plan interval sigmoid resection 6–8 weeks after recovery"
                ]
            )
        case 3:
            (risk, interp, recs) = (
                .high,
                "Hinchey III (purulent peritonitis): Generalised purulent peritonitis. Emergency surgery required — laparoscopic lavage vs Hartmann's procedure.",
                [
                    "Emergency surgical referral — theatre within 24 h in most cases",
                    "Resuscitation: IV fluids, electrolyte correction, Foley catheter",
                    "IV antibiotics: piperacillin-tazobactam 4.5 g TDS + metronidazole 500 mg TDS",
                    "Laparoscopic lavage and drainage (LADIES trial evidence) in select stable patients",
                    "Hartmann's procedure (sigmoid resection, end colostomy) for haemodynamic instability",
                    "ICU admission post-operatively for organ support if required",
                    "Stoma reversal considered at 6–12 months if patient fit"
                ]
            )
        default:
            (risk, interp, recs) = (
                .critical,
                "Hinchey IV (faecal peritonitis): Generalised faecal peritonitis. Life-threatening — emergency surgery within hours. Mortality 35–50%.",
                [
                    "Emergency surgery — immediate theatre (within 6 hours of diagnosis)",
                    "Aggressive resuscitation: target MAP >65 mmHg, lactate clearance",
                    "Vasopressors if septic shock: noradrenaline first-line",
                    "Hartmann's procedure (sigmoid resection, end colostomy) is standard",
                    "Damage control surgery if physiologically deranged (pH <7.2, T <34°C, coagulopathy)",
                    "ICU admission post-operatively",
                    "Mortality 35–50% — early goals of care discussion with family"
                ]
            )
        }
        return ClinicalScore(
            systemName: "Hinchey Classification",
            abbreviation: "Hinchey \(["0","Ia/Ib","II","III","IV"][min(i.grade, 4)])",
            score: score,
            maxScore: 4,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Grade Ia — pericolic abscess", points: 0, present: i.grade == 1),
                ScoredItem(label: "Grade II — pelvic/distant abscess", points: 0, present: i.grade == 2),
                ScoredItem(label: "Grade III — purulent peritonitis", points: 0, present: i.grade == 3),
                ScoredItem(label: "Grade IV — faecal peritonitis", points: 0, present: i.grade == 4)
            ],
            redFlags: flags,
            evidenceNote: "Hinchey EJ et al. Adv Surg 1978;12:85–109. Modified by Wasvary (1999) to include Grade Ia/Ib. LADIES trial (Br J Surg 2019) supports laparoscopic lavage for Hinchey III in stable patients. Faecal peritonitis (IV) remains a surgical emergency with high mortality."
        )
    }

    // MARK: - AIR Score (Appendicitis Inflammatory Response)
    struct AIRInput: Equatable {
        var vomiting: Bool = false                // 1 pt
        var painRIF: Bool = false                  // 1 pt — pain in right iliac fossa
        var reboundTenderness: Int = 0             // 0=none, 1=mild, 2=moderate, 3=strong
        var tempAbove38point5: Bool = false        // 1 pt — T ≥ 38.5°C
        var pmn: Int = 0                           // 0=<70%, 1=70–84%, 2=≥85%
        var wbc: Int = 0                           // 0=<10, 1=10–14.9, 2=≥15 ×10⁹/L
        var crp: Int = 0                           // 0=<10, 1=10–49, 2=≥50 mg/L
    }

    static func air(_ i: AIRInput) -> ClinicalScore {
        var pts = 0
        if i.vomiting      { pts += 1 }
        if i.painRIF       { pts += 1 }
        pts += min(i.reboundTenderness, 3)
        if i.tempAbove38point5 { pts += 1 }
        pts += min(i.pmn, 2)
        pts += min(i.wbc, 2)
        pts += min(i.crp, 2)

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]

        switch pts {
        case 0...4:
            risk = .low
            interp = "AIR \(pts)/12 — Low risk. Appendicitis unlikely. Consider observation, analgesia, and discharge with safety-net advice. D/W senior if clinical picture worsens."
            flags = []
            recs = [
                "Low risk — active observation or discharge with clear safety-net advice",
                "Reassess at 4–6 hours if admitted; repeat bloods and CRP if borderline",
                "Consider USS abdomen in children and women of childbearing age",
                "Return precautions: worsening pain, fever, vomiting — return immediately",
                "Avoid routine CT in low-risk AIR — radiation exposure not justified"
            ]
        case 5...8:
            risk = .moderate
            interp = "AIR \(pts)/12 — Intermediate risk. Significant probability of appendicitis. Admit for serial observation; imaging and surgical review recommended."
            flags = []
            recs = [
                "Admit for in-hospital observation — serial abdominal examinations",
                "Repeat FBC and CRP at 4–8 hours",
                "Ultrasound abdomen: first-line imaging (no radiation), especially in children and women",
                "CT abdomen/pelvis if USS non-diagnostic and clinical picture unclear",
                "Early surgical review — low threshold for diagnostic laparoscopy if clinical deterioration",
                "IV access and fluids; nil by mouth pending surgical decision"
            ]
        default:
            risk = .high
            interp = "AIR \(pts)/12 — High risk. Appendicitis highly likely. Surgical referral and theatre planning."
            flags = ["AIR ≥ 9 — high-risk appendicitis: urgent surgical assessment required"]
            recs = [
                "Urgent surgical referral — arrange theatre",
                "Nil by mouth, IV access, IV fluids, analgesia (morphine + anti-emetic)",
                "Preoperative bloods: FBC, CRP, U&E, LFT, coagulation, G&S",
                "IV antibiotics at induction: co-amoxiclav 1.2 g or cefuroxime + metronidazole",
                "Laparoscopic appendicectomy is the standard approach — open if laparoscopic not available",
                "Perforation risk increases with each additional hour — avoid unnecessary delay",
                "Imaging only if it will not delay theatre (may be omitted in classic high-risk presentations)"
            ]
        }
        return ClinicalScore(
            systemName: "AIR Score (Appendicitis Inflammatory Response)",
            abbreviation: "AIR \(pts)/12",
            score: Double(pts),
            maxScore: 12,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Vomiting", points: 1, present: i.vomiting),
                ScoredItem(label: "Pain in right iliac fossa", points: 1, present: i.painRIF),
                ScoredItem(label: "Rebound tenderness/guarding (mild)", points: 1, present: i.reboundTenderness == 1),
                ScoredItem(label: "Rebound tenderness/guarding (moderate)", points: 2, present: i.reboundTenderness == 2),
                ScoredItem(label: "Rebound tenderness/guarding (strong)", points: 3, present: i.reboundTenderness == 3),
                ScoredItem(label: "Temperature ≥ 38.5°C", points: 1, present: i.tempAbove38point5),
                ScoredItem(label: "PMN 70–84%", points: 1, present: i.pmn == 1),
                ScoredItem(label: "PMN ≥ 85%", points: 2, present: i.pmn == 2),
                ScoredItem(label: "WBC 10–14.9 × 10⁹/L", points: 1, present: i.wbc == 1),
                ScoredItem(label: "WBC ≥ 15 × 10⁹/L", points: 2, present: i.wbc == 2),
                ScoredItem(label: "CRP 10–49 mg/L", points: 1, present: i.crp == 1),
                ScoredItem(label: "CRP ≥ 50 mg/L", points: 2, present: i.crp == 2)
            ],
            redFlags: flags,
            evidenceNote: "Andersson M, Andersson RE. World J Surg 2008;32:1843–1849. AIR score validated across adult acute surgical populations. Sensitivity 96%, specificity 87% for scores ≥9. Superior to Alvarado in inflammatory marker specificity; requires FBC and CRP. Validated in Swedish and international cohorts."
        )
    }

    // MARK: - PERC Rule (Pulmonary Embolism Rule-out Criteria)
    struct PERCInput: Equatable {
        var age: Int = 40                    // years
        var hrAbove99: Bool = false           // HR ≥ 100 bpm
        var spo2Below95: Bool = false         // SpO2 < 95%
        var legSwelling: Bool = false         // unilateral leg swelling
        var haemoptysis: Bool = false
        var exogenousEstrogen: Bool = false   // OCP, HRT, or other exogenous oestrogen
        var priorDVTorPE: Bool = false
        var recentSurgeryOrTrauma: Bool = false  // hospitalisation for surgery or trauma in past 4 weeks
    }

    static func perc(_ i: PERCInput) -> ClinicalScore {
        var criteria = 0  // how many PERC criteria are VIOLATED (not met)
        if i.age >= 50          { criteria += 1 }
        if i.hrAbove99          { criteria += 1 }
        if i.spo2Below95        { criteria += 1 }
        if i.legSwelling        { criteria += 1 }
        if i.haemoptysis        { criteria += 1 }
        if i.exogenousEstrogen  { criteria += 1 }
        if i.priorDVTorPE       { criteria += 1 }
        if i.recentSurgeryOrTrauma { criteria += 1 }

        let allMet = criteria == 0

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]

        if allMet {
            risk = .low
            interp = "PERC Rule met (0/8 criteria failed). In patients with pre-test probability < 15%, PE can be excluded without D-dimer or imaging — reducing unnecessary workup and radiation."
            flags = []
            recs = [
                "PERC-negative: PE excluded in low pre-test probability setting (<15%)",
                "No D-dimer or CTPA required if pre-test clinical probability is genuinely low",
                "Reassess if symptoms worsen, new onset tachycardia, or SpO2 drops",
                "Document clinical probability assessment alongside PERC result",
                "If pre-test probability is ≥15%, PERC rule does NOT apply — proceed to Wells + D-dimer"
            ]
        } else {
            risk = .moderate
            interp = "PERC Rule NOT met (\(criteria)/8 criteria failed). Further evaluation required — proceed with clinical probability assessment (Wells PE) and D-dimer or direct imaging."
            flags = criteria >= 3 ? ["PERC ≥ 3 criteria: proceed directly to Wells PE + CTPA pathway"] : []
            recs = [
                "PERC-positive: PE not excluded — formal risk stratification required",
                "Apply Wells PE score to determine pre-test probability",
                "D-dimer if Wells PE low/moderate probability; CTPA if high probability or D-dimer positive",
                "Anticoagulation immediately if Wells PE high probability and no contraindication while awaiting imaging",
                "Consider bilateral leg Doppler USS if CTPA contraindicated or inconclusive"
            ]
        }
        return ClinicalScore(
            systemName: "PERC Rule (PE Rule-out Criteria)",
            abbreviation: allMet ? "PERC Met" : "PERC Fail \(criteria)/8",
            score: Double(criteria),
            maxScore: 8,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Age ≥ 50 years", points: 1, present: i.age >= 50),
                ScoredItem(label: "Heart rate ≥ 100 bpm", points: 1, present: i.hrAbove99),
                ScoredItem(label: "SpO₂ < 95%", points: 1, present: i.spo2Below95),
                ScoredItem(label: "Unilateral leg swelling", points: 1, present: i.legSwelling),
                ScoredItem(label: "Haemoptysis", points: 1, present: i.haemoptysis),
                ScoredItem(label: "Exogenous oestrogen use", points: 1, present: i.exogenousEstrogen),
                ScoredItem(label: "Prior DVT or PE", points: 1, present: i.priorDVTorPE),
                ScoredItem(label: "Recent surgery or trauma requiring hospitalisation (≤4 weeks)", points: 1, present: i.recentSurgeryOrTrauma)
            ],
            redFlags: flags,
            evidenceNote: "Kline JA et al. J Thromb Haemost 2004;2:1247–1255. PERC validated in ED cohorts; reduces CTPA use by ~20% in low-pretest-probability patients. Must be applied only when physician-assessed pre-test probability is <15%. Not a standalone rule — requires gestalt clinical probability estimate first."
        )
    }

    // MARK: - Shock Index (Haemodynamic Instability)
    struct ShockIndexInput: Equatable {
        var heartRate: Int = 80       // bpm
        var systolicBP: Int = 120     // mmHg
    }

    static func shockIndex(_ i: ShockIndexInput) -> ClinicalScore {
        guard i.systolicBP > 0 else {
            return ClinicalScore(
                systemName: "Shock Index",
                abbreviation: "SI — Invalid",
                score: 0,
                maxScore: 3,
                risk: .critical,
                interpretation: "Invalid: systolic BP must be > 0.",
                recommendations: ["Check vital signs — systolic BP cannot be zero."],
                items: [],
                redFlags: ["SBP = 0 entered — verify patient vitals immediately"],
                evidenceNote: ""
            )
        }
        let si = Double(i.heartRate) / Double(i.systolicBP)
        let siRounded = (si * 100).rounded() / 100

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]

        switch si {
        case ..<0.6:
            risk = .low
            interp = "Shock Index \(siRounded) — Normal. No haemodynamic compromise. Routine monitoring appropriate."
            flags = []
            recs = [
                "Normal range — routine vital-sign monitoring",
                "Reassess if clinical condition changes"
            ]
        case 0.6..<1.0:
            risk = .moderate
            interp = "Shock Index \(siRounded) — Mild abnormality. Some studies suggest slight increase in adverse outcomes. Correlate clinically."
            flags = []
            recs = [
                "Mild elevation — ensure adequate IV access",
                "Reassess in 15–30 minutes",
                "Consider fluid responsiveness assessment if clinical concern"
            ]
        case 1.0..<1.4:
            risk = .high
            interp = "Shock Index \(siRounded) — Significant haemodynamic compromise. Associated with 30-day mortality up to 30% in trauma. Urgent assessment required."
            flags = ["SI ≥ 1.0 — significant haemorrhagic shock risk: urgent assessment"]
            recs = [
                "Urgent assessment — likely haemodynamic compromise",
                "Large-bore IV access ×2 (14–16G), cross-match, activate MTP protocol if trauma",
                "IV fluid resuscitation: balanced crystalloid, targeting MAP >65 mmHg",
                "Identify source of blood loss: abdominal USS (FAST), chest X-ray",
                "Vasopressors (noradrenaline) if fluid-unresponsive hypotension",
                "Consider damage-control resuscitation: 1:1:1 (pRBC:FFP:platelets)",
                "Activate trauma team if trauma mechanism"
            ]
        default:
            risk = .critical
            interp = "Shock Index \(siRounded) — Severe haemodynamic compromise (class III–IV haemorrhagic shock). Immediate resuscitation and source control required. Mortality risk > 50% without intervention."
            flags = ["SI ≥ 1.4 — severe haemorrhagic shock: immediate resuscitation and surgical control"]
            recs = [
                "Immediate resuscitation — class III/IV haemorrhagic shock",
                "Activate massive transfusion protocol (MTP): 1:1:1 ratio",
                "Immediate surgical/interventional haemostasis — IR embolisation or emergency surgery",
                "Permissive hypotension (target SBP 80–90 mmHg) until haemostasis achieved",
                "TXA 1 g IV within 3 hours of injury (CRASH-2 trial)",
                "Correct hypothermia, acidaemia, coagulopathy — the 'lethal triad'",
                "ICU admission post-resuscitation"
            ]
        }
        return ClinicalScore(
            systemName: "Shock Index",
            abbreviation: "SI \(siRounded)",
            score: si,
            maxScore: 3,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Heart rate (bpm)", points: i.heartRate, present: true),
                ScoredItem(label: "Systolic BP (mmHg)", points: i.systolicBP, present: true),
                ScoredItem(label: "Shock Index (HR ÷ SBP)", points: Int(siRounded * 100), present: true)
            ],
            redFlags: flags,
            evidenceNote: "Allgöwer M, Burri C. Dtsch Med Wochenschr 1967;92:1947–1950. Shock Index validated in trauma (Mutschler 2013) and obstetric haemorrhage (Bhatt 2018). SI ≥ 1.0 predicts need for massive transfusion (sensitivity 87%). Limitations: less reliable in patients on beta-blockers or with pre-existing hypertension/bradycardia."
        )
    }

    // MARK: - Parkland Formula (Burns Fluid Resuscitation)
    struct ParklandInput: Equatable {
        var weightKg: Double = 70     // body weight in kilograms
        var tbsaPercent: Double = 20  // total body surface area burned (%)
        var hasInhalationInjury: Bool = false
    }

    static func parkland(_ i: ParklandInput) -> ClinicalScore {
        // Parkland: 4 mL × kg × TBSA% in 24 h (adults)
        // Modified Brooke (commonly used): 2 mL × kg × TBSA%
        // Using Parkland (4 mL/kg/%TBSA) — the established UK/Caribbean standard
        let totalVol = 4.0 * i.weightKg * i.tbsaPercent
        let firstHalf = totalVol / 2     // first 8 h from time of burn
        let secondHalf = totalVol / 2    // next 16 h
        let rateFirst8h = firstHalf / 8
        let rateNext16h = secondHalf / 16

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        switch i.tbsaPercent {
        case ..<15:
            risk = .low
            interp = "Minor burn (TBSA \(Int(i.tbsaPercent))%). Total Parkland volume: \(Int(totalVol)) mL over 24 h. May be managed with oral fluids if alert. IV access recommended."
            flags = []
        case 15..<25:
            risk = .moderate
            interp = "Moderate burn (TBSA \(Int(i.tbsaPercent))%). Total Parkland volume: \(Int(totalVol)) mL over 24 h. IV resuscitation mandatory."
            flags = []
        case 25..<40:
            risk = .high
            interp = "Major burn (TBSA \(Int(i.tbsaPercent))%). Total Parkland volume: \(Int(totalVol)) mL. Risk of burn shock — aggressive resuscitation and ICU admission."
            flags = ["Major burn ≥25% TBSA — burn shock risk: strict fluid monitoring required"]
        default:
            risk = .critical
            interp = "Critical burn (TBSA \(Int(i.tbsaPercent))%). Total Parkland volume: \(Int(totalVol)) mL. Life-threatening — burns unit, early intubation if inhalation injury."
            flags = ["Critical burn ≥40% TBSA — mortality risk >50%; burns centre transfer if available"]
        }
        let inhalationNote = i.hasInhalationInjury ? " Inhalation injury: early intubation strongly recommended — airway oedema peaks at 8–12 h." : ""
        return ClinicalScore(
            systemName: "Parkland Formula (Burns Fluid)",
            abbreviation: "Parkland \(Int(totalVol)) mL",
            score: totalVol,
            maxScore: 4 * 100 * 100,
            risk: risk,
            interpretation: interp + inhalationNote,
            recommendations: [
                "Parkland formula: 4 mL × \(Int(i.weightKg)) kg × \(Int(i.tbsaPercent))% TBSA = \(Int(totalVol)) mL Hartmann's/Ringer's lactate over 24 h",
                "First half (\(Int(firstHalf)) mL) in first 8 h from TIME OF BURN (not from arrival) — at \(Int(rateFirst8h)) mL/h",
                "Second half (\(Int(secondHalf)) mL) over next 16 h — at \(Int(rateNext16h)) mL/h",
                "Target urine output: 0.5–1.0 mL/kg/h (adult) — titrate infusion rate accordingly",
                "Urinary catheter mandatory — strict fluid balance; avoid under- and over-resuscitation",
                "Do NOT include colloid in first 12 h (Parkland protocol)",
                "Add colloid (albumin 5%) from 12–24 h if resuscitation requirements excessive",
                i.hasInhalationInjury ? "INHALATION INJURY: early anaesthetic/ICU review for intubation before oedema develops" : "Analgesia: IV morphine + anti-emetic; oral if minor burn",
                "Wound care: cool running water for 20 min if <3 h post-burn; non-adherent dressings",
                "Transfer to regional burns unit if: TBSA >15% adult, full-thickness, face/hands/perineum/circumferential"
            ],
            items: [
                ScoredItem(label: "Weight (\(Int(i.weightKg)) kg)", points: Int(i.weightKg), present: true),
                ScoredItem(label: "TBSA burned (\(Int(i.tbsaPercent))%)", points: Int(i.tbsaPercent), present: true),
                ScoredItem(label: "Total 24 h volume: \(Int(totalVol)) mL Hartmann's", points: Int(totalVol), present: true),
                ScoredItem(label: "First 8 h: \(Int(firstHalf)) mL at \(Int(rateFirst8h)) mL/h", points: Int(firstHalf), present: true),
                ScoredItem(label: "Next 16 h: \(Int(secondHalf)) mL at \(Int(rateNext16h)) mL/h", points: Int(secondHalf), present: true),
                ScoredItem(label: "Inhalation injury (+additional airway management)", points: 0, present: i.hasInhalationInjury)
            ],
            redFlags: flags,
            evidenceNote: "Baxter CR, Shires T. Ann N Y Acad Sci 1968;150:874–894. Parkland formula: 4 mL/kg/%TBSA Hartmann's in 24 h. Standard in UK (ISBI, NICE). The formula is a guide — adjust rate to urine output 0.5–1 mL/kg/h. Over-resuscitation causes abdominal compartment syndrome and pulmonary oedema; under-resuscitation causes burn shock. Reassess fluid rate hourly."
        )
    }

    // MARK: - Paediatric Appendicitis Score (PAS)
    struct PASInput: Equatable {
        var anorexia: Bool = false              // 1 pt
        var nausea: Bool = false                // 1 pt
        var migration: Bool = false             // 1 pt — pain migrating to RIF
        var tendernessRIF: Bool = false         // 2 pts
        var coughPercussionHop: Bool = false    // 2 pts — cough/percussion/hopping worsens pain
        var pyrexia: Bool = false               // 1 pt — T ≥ 38.0°C
        var leukocytosis: Bool = false          // 2 pts — WBC > 10 × 10⁹/L
        var polymorphonuclearShift: Bool = false // 1 pt — PMN > 7.5 × 10⁹/L
    }

    static func pas(_ i: PASInput) -> ClinicalScore {
        var pts = 0
        if i.anorexia    { pts += 1 }
        if i.nausea      { pts += 1 }
        if i.migration   { pts += 1 }
        if i.tendernessRIF       { pts += 2 }
        if i.coughPercussionHop  { pts += 2 }
        if i.pyrexia     { pts += 1 }
        if i.leukocytosis         { pts += 2 }
        if i.polymorphonuclearShift { pts += 1 }

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]
        switch pts {
        case 0...3:
            risk = .low
            interp = "PAS \(pts)/10 — Low risk. Appendicitis unlikely in this child. Consider discharge with safety-net advice or short observation."
            flags = []
            recs = [
                "Low risk — observation 4–6 hours or discharge with clear safety-net advice",
                "Return immediately if: worsening pain, fever, vomiting, or inability to walk",
                "Consider USS abdomen if diagnosis remains uncertain",
                "Paediatric surgeon review if any deterioration during observation"
            ]
        case 4...6:
            risk = .moderate
            interp = "PAS \(pts)/10 — Intermediate risk. Significant probability of appendicitis. Admit, serial examination, imaging."
            flags = []
            recs = [
                "Admit for in-hospital observation and serial abdominal examinations",
                "FBC + CRP; repeat at 6–8 hours if borderline",
                "USS abdomen: first-line imaging in children (no radiation)",
                "MRI abdomen if USS non-diagnostic (preferred over CT in paediatric patients)",
                "Paediatric surgical review within 2–4 hours",
                "IV access, nil by mouth pending surgical decision"
            ]
        default:
            risk = .high
            interp = "PAS \(pts)/10 — High risk. Appendicitis likely in this child. Urgent surgical referral."
            flags = ["PAS ≥ 7 — high-risk paediatric appendicitis: urgent surgical referral"]
            recs = [
                "Urgent paediatric surgical referral — theatre planning",
                "IV access, IV fluids, analgesia (weight-adjusted morphine + ondansetron)",
                "Nil by mouth, FBC, CRP, U&E, group and save",
                "IV antibiotics at induction: co-amoxiclav (weight-adjusted dose)",
                "Laparoscopic appendicectomy is first-line in children",
                "Consider pre-op USS even in high PAS — may change operative approach if perforation/abscess",
                "Inform parents of perforation risk (~15–20% in paediatric appendicitis)"
            ]
        }
        return ClinicalScore(
            systemName: "Paediatric Appendicitis Score (PAS)",
            abbreviation: "PAS \(pts)/10",
            score: Double(pts),
            maxScore: 10,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Anorexia", points: 1, present: i.anorexia),
                ScoredItem(label: "Nausea / vomiting", points: 1, present: i.nausea),
                ScoredItem(label: "Migration of pain to RIF", points: 1, present: i.migration),
                ScoredItem(label: "Tenderness in right iliac fossa", points: 2, present: i.tendernessRIF),
                ScoredItem(label: "Cough / percussion / hop worsens pain", points: 2, present: i.coughPercussionHop),
                ScoredItem(label: "Pyrexia ≥ 38.0°C", points: 1, present: i.pyrexia),
                ScoredItem(label: "Leukocytosis (WBC > 10 × 10⁹/L)", points: 2, present: i.leukocytosis),
                ScoredItem(label: "Polymorphonuclear shift (PMN > 7.5 × 10⁹/L)", points: 1, present: i.polymorphonuclearShift)
            ],
            redFlags: flags,
            evidenceNote: "Samuel M. J Pediatr Surg 2002;37:877–881. PAS validated in children aged 2–18. Sensitivity 83%, specificity 80% for scores ≥7. Less specific than AIR for adults; use PAS in paediatric populations (<16 yrs). USS first-line imaging in children — CT reserved for diagnostic uncertainty only."
        )
    }

    // MARK: - Revised Geneva Score (Pulmonary Embolism)
    struct RevisedGenevaInput: Equatable {
        var age: Int = 40                       // years
        var priorDVTorPE: Bool = false           // 3 pts
        var surgeryOrFractureInMonth: Bool = false // 2 pts — surgery or fracture ≤ 1 month
        var activeMalignancy: Bool = false       // 2 pts
        var unilateralLimbPain: Bool = false     // 3 pts
        var haemoptysis: Bool = false            // 2 pts
        var heartRateAbove74: Bool = false       // HR 75–94 = 3 pts
        var heartRateAbove94: Bool = false       // HR ≥ 95 = 5 pts
        var painOnPalpationLimbAndEdema: Bool = false // 4 pts
    }

    static func revisedGeneva(_ i: RevisedGenevaInput) -> ClinicalScore {
        var pts = 0
        if i.age >= 65 { pts += 1 }
        if i.priorDVTorPE             { pts += 3 }
        if i.surgeryOrFractureInMonth { pts += 2 }
        if i.activeMalignancy         { pts += 2 }
        if i.unilateralLimbPain       { pts += 3 }
        if i.haemoptysis              { pts += 2 }
        if i.heartRateAbove94 {
            pts += 5
        } else if i.heartRateAbove74 {
            pts += 3
        }
        if i.painOnPalpationLimbAndEdema { pts += 4 }

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]
        switch pts {
        case 0...3:
            risk = .low
            interp = "Revised Geneva \(pts)/22 — Low clinical probability for PE. D-dimer recommended; if negative, PE excluded."
            flags = []
            recs = [
                "Low probability — D-dimer testing: negative result excludes PE in low-probability patients",
                "If D-dimer positive: CTPA (CT pulmonary angiography)",
                "Combine with PERC rule: if all 8 PERC criteria met AND low pretest probability → no D-dimer needed",
                "Consider leg Doppler USS if CTPA contraindicated",
                "Reassess if symptoms change or new tachycardia develops"
            ]
        case 4...10:
            risk = .moderate
            interp = "Revised Geneva \(pts)/22 — Moderate clinical probability for PE. D-dimer or direct CTPA depending on clinical urgency."
            flags = []
            recs = [
                "Moderate probability — D-dimer if not clinically decompensated",
                "CTPA if D-dimer positive or clinical status deteriorating",
                "IV access; oxygen if SpO2 < 94%; analgesia",
                "Low-molecular-weight heparin (LMWH) if clinical deterioration occurs while awaiting imaging",
                "Echocardiography if haemodynamically unstable to rule out massive PE"
            ]
        default:
            risk = .high
            interp = "Revised Geneva \(pts)/22 — High clinical probability for PE. CTPA immediately; anticoagulate without awaiting result."
            flags = ["Revised Geneva ≥ 11 — high probability PE: CTPA and anticoagulation without delay"]
            recs = [
                "High probability — anticoagulate immediately (LMWH or unfractionated heparin) unless contraindicated",
                "CTPA urgent — do not delay anticoagulation for imaging result",
                "Haemodynamically unstable massive PE: consider systemic thrombolysis (alteplase 100 mg) or surgical embolectomy",
                "sPESI score to assess severity and disposition (ambulatory vs. HDU/ICU)",
                "Cardiac echo to assess right ventricular strain (prognostic)",
                "Notify ITU/HDU if hypotensive, HR > 120, or SpO2 < 90%"
            ]
        }
        return ClinicalScore(
            systemName: "Revised Geneva Score (PE)",
            abbreviation: "Geneva \(pts)/22",
            score: Double(pts),
            maxScore: 22,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Age ≥ 65 years", points: 1, present: i.age >= 65),
                ScoredItem(label: "Prior DVT or PE", points: 3, present: i.priorDVTorPE),
                ScoredItem(label: "Surgery or fracture ≤ 1 month", points: 2, present: i.surgeryOrFractureInMonth),
                ScoredItem(label: "Active malignancy", points: 2, present: i.activeMalignancy),
                ScoredItem(label: "Unilateral lower-limb pain", points: 3, present: i.unilateralLimbPain),
                ScoredItem(label: "Haemoptysis", points: 2, present: i.haemoptysis),
                ScoredItem(label: "Heart rate 75–94 bpm", points: 3, present: i.heartRateAbove74 && !i.heartRateAbove94),
                ScoredItem(label: "Heart rate ≥ 95 bpm", points: 5, present: i.heartRateAbove94),
                ScoredItem(label: "Pain on deep palpation of lower limb AND oedema", points: 4, present: i.painOnPalpationLimbAndEdema)
            ],
            redFlags: flags,
            evidenceNote: "Le Gal G et al. Ann Intern Med 2006;144:165–171. Revised Geneva Score validated in 965 consecutive patients; AUC 0.74. Low risk: 7% PE prevalence; Moderate: 29%; High: 64%. Does not require physician gestalt — all items are objective. Equivalent performance to Wells PE in meta-analyses."
        )
    }

    // MARK: - Charlson Comorbidity Index (#76)

    struct CCIInput: Equatable {
        // 1-point conditions
        var myocardialInfarction: Bool = false
        var congestiveHeartFailure: Bool = false
        var peripheralVascularDisease: Bool = false
        var cerebrovascularDisease: Bool = false
        var dementia: Bool = false
        var chronicPulmonaryDisease: Bool = false
        var connectiveTissueDisease: Bool = false
        var pepticulcer: Bool = false
        var mildLiverDisease: Bool = false
        var diabetesUncomplicated: Bool = false
        // 2-point conditions
        var diabetesWithEndOrganDamage: Bool = false
        var hemiplecia: Bool = false
        var moderateOrSevereCKD: Bool = false
        var solidTumour: Bool = false
        // 3-point conditions
        var leukaemia: Bool = false
        var lymphoma: Bool = false
        // 4-point conditions — 6 in original, but age-adjusted variant adjusts later
        var moderateOrSevereLiverDisease: Bool = false
        var metastaticSolidTumour: Bool = false
        var aids: Bool = false
        // Age for age-adjusted CCI
        var age: Int = 60
    }

    static func cci(_ i: CCIInput) -> ClinicalScore {
        var pts = 0
        if i.myocardialInfarction        { pts += 1 }
        if i.congestiveHeartFailure      { pts += 1 }
        if i.peripheralVascularDisease   { pts += 1 }
        if i.cerebrovascularDisease      { pts += 1 }
        if i.dementia                    { pts += 1 }
        if i.chronicPulmonaryDisease     { pts += 1 }
        if i.connectiveTissueDisease     { pts += 1 }
        if i.pepticulcer                 { pts += 1 }
        if i.mildLiverDisease            { pts += 1 }
        if i.diabetesUncomplicated       { pts += 1 }
        if i.diabetesWithEndOrganDamage  { pts += 2 }
        if i.hemiplecia                  { pts += 2 }
        if i.moderateOrSevereCKD         { pts += 2 }
        if i.solidTumour                 { pts += 2 }
        if i.leukaemia                   { pts += 2 }
        if i.lymphoma                    { pts += 2 }
        if i.moderateOrSevereLiverDisease { pts += 3 }
        if i.metastaticSolidTumour       { pts += 6 }
        if i.aids                        { pts += 6 }

        // Age adjustment (+1 per decade over 40)
        let agePoints: Int
        if i.age >= 80        { agePoints = 4 }
        else if i.age >= 70   { agePoints = 3 }
        else if i.age >= 60   { agePoints = 2 }
        else if i.age >= 50   { agePoints = 1 }
        else                  { agePoints = 0 }
        let totalPts = pts + agePoints

        // 10-year survival estimate (Charlson original)
        let survivalPct: String
        let risk: ScoreRisk
        let interp: String
        switch totalPts {
        case 0:
            survivalPct = "~98%"
            risk = .low
            interp = "CCI \(totalPts) — minimal comorbidity burden; excellent 10-year survival estimate (\(survivalPct))."
        case 1...2:
            survivalPct = "~90%"
            risk = .low
            interp = "CCI \(totalPts) — low comorbidity burden; 10-year survival estimate \(survivalPct). Standard perioperative risk."
        case 3...4:
            survivalPct = "~77%"
            risk = .moderate
            interp = "CCI \(totalPts) — moderate comorbidity burden; 10-year survival estimate \(survivalPct). Increased perioperative and long-term risk."
        case 5...6:
            survivalPct = "~53%"
            risk = .high
            interp = "CCI \(totalPts) — high comorbidity burden; 10-year survival estimate \(survivalPct). Significant impact on surgical outcomes and eligibility."
        default:
            survivalPct = "< 30%"
            risk = .critical
            interp = "CCI \(totalPts) — very high comorbidity burden; 10-year survival estimate \(survivalPct). Major clinical and ethical implications for operative planning."
        }

        let flags: [String] = totalPts >= 5 ? ["CCI ≥ 5: high comorbidity burden — consider geriatric review and MDT planning before major surgery"] : []
        let recs: [String]
        switch totalPts {
        case 0...2:
            recs = ["No additional comorbidity-directed workup required beyond standard assessment."]
        case 3...4:
            recs = [
                "Optimise major comorbidities pre-operatively.",
                "Discuss CCI score with anaesthesia team during pre-operative assessment.",
                "Document comorbidity status in consent discussion."
            ]
        default:
            recs = [
                "Consider multidisciplinary team review before major elective surgery.",
                "Ensure detailed informed consent documenting elevated comorbidity risk.",
                "Consider geriatric or specialist review for high-scoring individual conditions.",
                "CCI is a validated independent predictor of surgical mortality and post-operative complications."
            ]
        }

        return ClinicalScore(
            name: "Charlson Comorbidity Index",
            score: Double(totalPts),
            maxScore: 37,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Myocardial infarction (history)", points: 1, present: i.myocardialInfarction),
                ScoredItem(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure),
                ScoredItem(label: "Peripheral vascular disease", points: 1, present: i.peripheralVascularDisease),
                ScoredItem(label: "Cerebrovascular disease / TIA", points: 1, present: i.cerebrovascularDisease),
                ScoredItem(label: "Dementia", points: 1, present: i.dementia),
                ScoredItem(label: "Chronic pulmonary disease (COPD / asthma)", points: 1, present: i.chronicPulmonaryDisease),
                ScoredItem(label: "Connective tissue disease / rheumatological disease", points: 1, present: i.connectiveTissueDisease),
                ScoredItem(label: "Peptic ulcer disease", points: 1, present: i.pepticulcer),
                ScoredItem(label: "Mild liver disease (cirrhosis without portal hypertension)", points: 1, present: i.mildLiverDisease),
                ScoredItem(label: "Diabetes mellitus (uncomplicated)", points: 1, present: i.diabetesUncomplicated),
                ScoredItem(label: "Diabetes with end-organ damage", points: 2, present: i.diabetesWithEndOrganDamage),
                ScoredItem(label: "Hemiplegia / paraplegia", points: 2, present: i.hemiplecia),
                ScoredItem(label: "Moderate/severe CKD (creatinine > 3 mg/dL or dialysis)", points: 2, present: i.moderateOrSevereCKD),
                ScoredItem(label: "Any solid tumour (within 5 years, without metastasis)", points: 2, present: i.solidTumour),
                ScoredItem(label: "Leukaemia (AML, CML, ALL, CLL)", points: 2, present: i.leukaemia),
                ScoredItem(label: "Lymphoma / multiple myeloma / Waldenström's", points: 2, present: i.lymphoma),
                ScoredItem(label: "Moderate/severe liver disease (portal hypertension, varices, ascites)", points: 3, present: i.moderateOrSevereLiverDisease),
                ScoredItem(label: "Metastatic solid tumour", points: 6, present: i.metastaticSolidTumour),
                ScoredItem(label: "AIDS (not just HIV+)", points: 6, present: i.aids),
                ScoredItem(label: "Age \(i.age) years — \(agePoints) age-adjustment point(s)", points: Double(agePoints), present: agePoints > 0)
            ],
            redFlags: flags,
            evidenceNote: "Charlson ME et al. J Chronic Dis 1987;40:373–383. Validated for 10-year mortality prediction. Age-adjusted CCI widely used in surgical outcomes research (NSQIP, ERAS protocols). CCI ≥ 3 independently predicts post-operative complications; CCI ≥ 5 is associated with 30-day surgical mortality in major abdominal surgery."
        )
    }

    // MARK: - Modified Frailty Index-5 (mFI-5) (#77)

    struct MFI5Input: Equatable {
        var diabetes: Bool = false          // DM requiring medication
        var functionalDependence: Bool = false  // partial or total dependence for ADL
        var COPD: Bool = false              // COPD or pneumonia hospitalisation in past year
        var congestiveHeartFailure: Bool = false
        var hypertension: Bool = false      // requiring medication
    }

    static func mfi5(_ i: MFI5Input) -> ClinicalScore {
        var pts = 0
        if i.diabetes               { pts += 1 }
        if i.functionalDependence   { pts += 1 }
        if i.COPD                   { pts += 1 }
        if i.congestiveHeartFailure { pts += 1 }
        if i.hypertension           { pts += 1 }

        let risk: ScoreRisk
        let interp: String
        switch pts {
        case 0:
            risk = .low
            interp = "mFI-5 = 0 — non-frail. No frailty-related risk factors. Standard perioperative pathway appropriate."
        case 1:
            risk = .low
            interp = "mFI-5 = 1 — mild frailty signal. Modest increase in post-operative complications. Standard pathway with attention to hydration and early mobilisation."
        case 2:
            risk = .moderate
            interp = "mFI-5 = 2 — moderate frailty. Significantly increased risk of post-operative complications, prolonged LOS, and 30-day mortality. Consider prehabilitation."
        default:
            risk = .high
            interp = "mFI-5 ≥ 3 — severe frailty. Markedly elevated surgical risk. MDT review, comprehensive geriatric assessment, and shared decision-making strongly recommended before major surgery."
        }

        let flags: [String] = pts >= 3 ? ["mFI-5 ≥ 3: severe frailty — consider comprehensive geriatric assessment and MDT before proceeding with major surgery"] : []
        let recs: [String]
        switch pts {
        case 0...1:
            recs = ["Frailty score does not indicate a need for additional pre-operative assessment."]
        case 2:
            recs = [
                "Consider prehabilitation (exercise, nutrition optimisation) before elective major surgery.",
                "Ensure anaesthetic pre-assessment documents functional status.",
                "Plan early post-operative mobilisation and nutrition support."
            ]
        default:
            recs = [
                "Refer for comprehensive geriatric assessment before major elective surgery.",
                "Discuss operative risk and goals of care with patient and family.",
                "Consider minimally invasive surgical approaches where oncologically and technically appropriate.",
                "Engage ERAS protocol with emphasis on early nutrition and physiotherapy."
            ]
        }

        return ClinicalScore(
            name: "Modified Frailty Index-5 (mFI-5)",
            score: Double(pts),
            maxScore: 5,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Diabetes mellitus (requiring medication)", points: 1, present: i.diabetes),
                ScoredItem(label: "Functional dependence (partial or total — ADL)", points: 1, present: i.functionalDependence),
                ScoredItem(label: "COPD or pneumonia requiring hospitalisation (past year)", points: 1, present: i.COPD),
                ScoredItem(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure),
                ScoredItem(label: "Hypertension requiring medication", points: 1, present: i.hypertension)
            ],
            redFlags: flags,
            evidenceNote: "Subramaniam S et al. J Am Coll Surg 2018;226:173–181. mFI-5 derived from 11-item mFI. Validated in NSQIP database (n > 1.4 million). Each point increment independently predicts 30-day mortality, serious complications, and non-home discharge. Comparable predictive performance to full 11-item index in major abdominal and vascular surgery."
        )
    }

    // MARK: - Harmless Acute Pancreatitis Score (HAPS) (#78)

    struct HAPSInput: Equatable {
        var peritonismAbsent: Bool = false    // no peritoneal irritation on exam
        var creatinineNormal: Bool = false    // serum creatinine ≤ 177 µmol/L (< 2 mg/dL)
        var haematocritNormal: Bool = false   // haematocrit ≤ 43% (male) or ≤ 39.6% (female)
    }

    static func haps(_ i: HAPSInput) -> ClinicalScore {
        let pts = [i.peritonismAbsent, i.creatinineNormal, i.haematocritNormal].filter { $0 }.count
        let isHarmless = pts == 3

        let risk: ScoreRisk
        let interp: String
        if isHarmless {
            risk = .low
            interp = "HAPS = 3/3 — ALL three criteria met. HARMLESS acute pancreatitis. Predicted mild course; uneventful recovery without intervention expected (NPV ~97–99%). Conservative management appropriate; early oral rehydration may be considered."
        } else {
            risk = .high
            interp = "HAPS \(pts)/3 — Not all criteria met. Cannot classify as harmless. Severe or complicated pancreatitis cannot be excluded. Treat as potentially severe — IV fluids, nil by mouth, monitoring, and reassessment with APACHE II / BISAP / CT if clinically indicated."
        }

        let flags: [String] = !isHarmless ? ["HAPS < 3: potentially severe acute pancreatitis — do not apply conservative 'harmless' pathway; escalate monitoring and consider CT for severity staging"] : []
        let recs: [String]
        if isHarmless {
            recs = [
                "HAPS predicts harmless course with high NPV — conservative management appropriate.",
                "Early oral fluids (if tolerated) and analgesia.",
                "Monitor amylase/lipase trend; discharge when clinically stable.",
                "Investigate aetiology (gallstones, alcohol): US abdomen, LFTs."
            ]
        } else {
            recs = [
                "HAPS does not confirm harmless course — standard acute pancreatitis pathway applies.",
                "IV fluid resuscitation (crystalloid 250–500 mL/h in first 12–24 h).",
                "Nil by mouth; nasogastric tube if vomiting.",
                "Repeat bloods at 24–48 h; consider CT abdomen if no improvement at 48–72 h.",
                "BISAP and APACHE II scores recommended for formal severity stratification."
            ]
        }

        return ClinicalScore(
            name: "Harmless Acute Pancreatitis Score (HAPS)",
            score: Double(pts),
            maxScore: 3,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "No peritoneal irritation on abdominal examination", points: 1, present: i.peritonismAbsent),
                ScoredItem(label: "Serum creatinine ≤ 177 µmol/L (< 2 mg/dL)", points: 1, present: i.creatinineNormal),
                ScoredItem(label: "Haematocrit ≤ 43% (male) / ≤ 39.6% (female)", points: 1, present: i.haematocritNormal)
            ],
            redFlags: flags,
            evidenceNote: "Lankisch PG et al. Am J Gastroenterol 2009;104:2943–2949. HAPS validated in 397 patients (prospective) and 1444 (validation cohort). All 3 criteria met on admission: PPV 98% for mild AP, NPV 99% for exclusion of severe AP. Simple bedside score requiring no imaging. Does not replace CT for complications. Comparable to APACHE II for early risk stratification."
        )
    }


    // MARK: – #80 Glasgow-Imrie

    struct GlasgowImrieInput: Equatable {
        var pao2Below59: Bool = false         // PaO₂ < 59.2 mmHg (< 7.9 kPa)
        var ageAbove55: Bool = false           // Age > 55 years
        var wbcAbove15: Bool = false           // WBC > 15 × 10⁹/L
        var calciumBelow2: Bool = false        // Serum calcium < 2.0 mmol/L
        var albuminBelow32: Bool = false       // Serum albumin < 32 g/L
        var ldh180: Bool = false              // LDH > 600 IU/L (original) or > 3× ULN (some versions)
        var ast100: Bool = false              // AST / ALT > 200 IU/L
        var glucoseAbove10: Bool = false       // Serum glucose > 10 mmol/L (non-diabetic)
    }

    static func glasgowImrie(_ i: GlasgowImrieInput) -> ClinicalScore {
        let pts = [i.pao2Below59, i.ageAbove55, i.wbcAbove15, i.calciumBelow2,
                   i.albuminBelow32, i.ldh180, i.ast100, i.glucoseAbove10].filter { $0 }.count

        let risk: ScoreRisk
        let interp: String
        switch pts {
        case 0...2:
            risk = .low
            interp = "Glasgow-Imrie \(pts)/8 — Mild acute pancreatitis. Low predicted complication rate (< 5% mortality). Standard IV fluid resuscitation, analgesia, and supportive care. Reassess at 48 h. Note: score is calculated on first 48 h data and may not be complete at admission."
        case 3:
            risk = .moderate
            interp = "Glasgow-Imrie 3/8 — Moderate-to-severe pancreatitis predicted. Mortality risk ~10–15%. Organ complications possible. IV fluid resuscitation, close monitoring, HDU/ICU consideration if any organ dysfunction present. CT at 48–72 h."
        default:
            risk = .high
            interp = "Glasgow-Imrie \(pts)/8 — Severe acute pancreatitis. Mortality risk 30–50% (≥ 3 criteria historically associated with severe disease). Immediate HDU/ICU admission, aggressive resuscitation, CT imaging, and HPB/gastroenterology specialist review."
        }

        let flags: [String] = pts >= 3 ? ["Glasgow-Imrie ≥ 3: severe acute pancreatitis predicted — HDU/ICU and specialist review required"] : []
        let recs: [String]
        if pts < 3 {
            recs = [
                "Mild acute pancreatitis predicted — aggressive fluid resuscitation for first 24 h.",
                "Early oral intake when tolerated (24–48 h).",
                "US abdomen to assess for gallstones and common bile duct dilation.",
                "Monitor with serial bloods at 24 and 48 h.",
                "Consider ERCP within 24–48 h if biliary pancreatitis with cholangitis."
            ]
        } else {
            recs = [
                "Severe acute pancreatitis predicted — HDU/ICU admission.",
                "Aggressive IV crystalloid resuscitation (250–500 mL/h) guided by urine output.",
                "CT abdomen with contrast at 48–72 h to assess for necrosis and complications.",
                "Nasojejunal feeding preferred if enteral route feasible; PN if not.",
                "Antibiotics only if infected necrosis confirmed or high clinical suspicion.",
                "Multidisciplinary HPB/ICU/gastroenterology review.",
                "ERCP if biliary aetiology with cholangitis (within 24 h for cholangitis)."
            ]
        }

        return ClinicalScore(
            name: "Glasgow-Imrie Pancreatitis Score",
            score: Double(pts),
            maxScore: 8,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "PaO₂ < 59.2 mmHg (< 7.9 kPa)", points: 1, present: i.pao2Below59),
                ScoredItem(label: "Age > 55 years", points: 1, present: i.ageAbove55),
                ScoredItem(label: "WBC > 15 × 10⁹/L", points: 1, present: i.wbcAbove15),
                ScoredItem(label: "Serum calcium < 2.0 mmol/L", points: 1, present: i.calciumBelow2),
                ScoredItem(label: "Serum albumin < 32 g/L", points: 1, present: i.albuminBelow32),
                ScoredItem(label: "LDH > 600 IU/L (or > 3× ULN)", points: 1, present: i.ldh180),
                ScoredItem(label: "AST/ALT > 200 IU/L", points: 1, present: i.ast100),
                ScoredItem(label: "Serum glucose > 10 mmol/L (non-diabetic)", points: 1, present: i.glucoseAbove10)
            ],
            redFlags: flags,
            evidenceNote: "Imrie CW et al. Br J Surg 1978;65:478–480. Modified by Blamey SL et al. Gut 1984;25:1340–1346. Eight variables, assessed at 48 h from admission. Score ≥ 3 predicts severe acute pancreatitis with sensitivity ~70%, specificity ~85%. Widely used in UK/Commonwealth clinical practice. Variables must be based on worst values within first 48 h — not all may be available at admission. Compare with BISAP (admission-only) and APACHE II (daily, more complex)."
        )
    }

    // MARK: - ALBI Score (Albumin-Bilirubin)
    struct ALBIInput: Equatable {
        var albuminGperL: Double = 40.0   // g/L  (normal 35–50)
        var bilirubinUmolL: Double = 17.0 // μmol/L (normal <21)
    }
    static func albi(_ i: ALBIInput) -> ClinicalScore {
        // ALBI = (log₁₀(bilirubin_μmol/L) × 0.66) + (albumin_g/L × −0.085)
        let bili = max(i.bilirubinUmolL, 0.1)
        let alb  = i.albuminGperL
        let score = (log10(bili) * 0.66) + (alb * -0.085)
        let rounded = (score * 100).rounded() / 100
        let (grade, risk, recs): (String, ScoreRisk, [String])
        switch score {
        case ..<(-2.60):
            grade = "Grade 1 — Well-preserved liver function"
            risk  = .low
            recs  = ["Major hepatic resection is generally safe",
                     "Child-Pugh A equivalent functional reserve",
                     "Proceed with planned surgical strategy"]
        case -2.60 ..< -1.39:
            grade = "Grade 2 — Moderate liver dysfunction"
            risk  = .moderate
            recs  = ["Limit resection to <50% hepatic volume",
                     "Consider portal vein embolisation if extended resection planned",
                     "Optimise nutrition and correct coagulopathy pre-operatively",
                     "Hepatology review recommended"]
        default:
            grade = "Grade 3 — Severe liver dysfunction"
            risk  = .high
            recs  = ["Major hepatic resection carries prohibitive risk — avoid",
                     "Prioritise liver function optimisation (lactulose, diuretics, albumin infusion)",
                     "Consider transplant evaluation if HCC / end-stage disease",
                     "Multidisciplinary hepatobiliary conference mandatory"]
        }
        return ClinicalScore(
            name:          "ALBI Score",
            score:         rounded,
            maxScore:      nil,
            risk:          risk,
            interpretation: grade,
            recommendations: recs,
            evidenceNote:  "Johnson PJ et al. J Clin Oncol 2015;33:550–558. Continuous hepatic reserve score using albumin and bilirubin. Validated in HCC, cholangiocarcinoma, and resectional hepatic surgery. Preferred over Child-Pugh for granular hepatic reserve stratification."
        )
    }

    // MARK: - AUDIT-C (Alcohol Use Disorders Identification Test — Consumption)
    struct AUDITCInput: Equatable {
        var frequency: Int = 0   // Q1: 0=never,1=monthly,2=2-4×/month,3=2-3×/week,4=4+/week
        var typicalDrinks: Int = 0 // Q2: 0=1-2,1=3-4,2=5-6,3=7-9,4=10+
        var bingeDrinks: Int = 0   // Q3: 0=never,1=<monthly,2=monthly,3=weekly,4=daily
        var isFemale: Bool = false
    }
    static func auditC(_ i: AUDITCInput) -> ClinicalScore {
        let total = i.frequency + i.typicalDrinks + i.bingeDrinks
        let threshold = i.isFemale ? 3 : 4
        let (interp, risk, recs): (String, ScoreRisk, [String])
        if total < threshold {
            interp = "Negative screen — low-risk alcohol use"
            risk   = .low
            recs   = ["No specific alcohol-related intervention indicated",
                      "Encourage continued low-risk drinking patterns"]
        } else if total <= 7 {
            interp = "Positive screen — hazardous or harmful drinking"
            risk   = .moderate
            recs   = ["Brief motivational intervention (5–15 min) recommended",
                      "Assess for alcohol dependence (CAGE/full AUDIT)",
                      "Counsel on safe drinking limits: ≤14 units/week, ≤3 units/occasion",
                      "Pre-operative alcohol cessation ≥4 weeks reduces surgical complications"]
        } else {
            interp = "High-risk — probable alcohol use disorder"
            risk   = .high
            recs   = ["Urgent addiction medicine / liaison psychiatry referral",
                      "Assess for alcohol dependence before elective surgery",
                      "Anticipate alcohol withdrawal — consider CIWA-Ar monitoring post-op",
                      "Pre-operative abstinence ≥4 weeks mandatory for elective cases",
                      "Supplement thiamine (100 mg TDS × 5 days) peri-operatively"]
        }
        return ClinicalScore(
            name:          "AUDIT-C",
            score:         Double(total),
            maxScore:      12,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Bush K et al. Arch Intern Med 1998;158:1789–1795. 3-item alcohol consumption sub-scale of the full AUDIT. Threshold ≥4 (men) / ≥3 (women). Validated for pre-operative alcohol risk screening; hazardous drinking independently increases surgical mortality and SSI rate."
        )
    }

    // MARK: - PHQ-9 (Patient Health Questionnaire — Depression)
    struct PHQ9Input: Equatable {
        var anhedonia: Int = 0       // Q1: 0–3
        var depressedMood: Int = 0   // Q2: 0–3
        var sleepProblem: Int = 0    // Q3: 0–3
        var fatigue: Int = 0         // Q4: 0–3
        var appetiteChange: Int = 0  // Q5: 0–3
        var selfWorth: Int = 0       // Q6: 0–3
        var concentration: Int = 0  // Q7: 0–3
        var psychomotor: Int = 0     // Q8: 0–3
        var suicidalThought: Int = 0 // Q9: 0–3
    }
    static func phq9(_ i: PHQ9Input) -> ClinicalScore {
        let total = i.anhedonia + i.depressedMood + i.sleepProblem + i.fatigue +
                    i.appetiteChange + i.selfWorth + i.concentration + i.psychomotor +
                    i.suicidalThought
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 0...4:
            interp = "Minimal or no depressive symptoms"
            risk   = .low
            recs   = ["Monitor at routine follow-up",
                      "Lifestyle counselling if sub-threshold symptoms present"]
        case 5...9:
            interp = "Mild depression"
            risk   = .low
            recs   = ["Active monitoring — reassess in 4–6 weeks",
                      "Consider watchful waiting with structured follow-up",
                      "Low-intensity psychological intervention (guided self-help) appropriate"]
        case 10...14:
            interp = "Moderate depression"
            risk   = .moderate
            recs   = ["Treatment indicated — offer antidepressant OR structured psychotherapy",
                      "Advise adequate sleep, physical activity, and social engagement",
                      "Pre-operatively: assess impact on surgical recovery and consent capacity",
                      "Psychiatric liaison review if elective major surgery planned"]
        case 15...19:
            interp = "Moderately severe depression"
            risk   = .high
            recs   = ["Active treatment required — combined antidepressant + CBT preferred",
                      "Psychiatric referral within 1–2 weeks",
                      "Consider delaying elective surgery until stabilised",
                      "Safety planning if passive suicidal ideation present (Q9 ≥1)"]
        default:
            interp = "Severe depression"
            risk   = .high
            recs   = ["Urgent psychiatric assessment required",
                      "If Q9 ≥2 (active suicidal ideation): same-day emergency psychiatry review",
                      "Withhold elective surgery until psychiatric clearance obtained",
                      "Inpatient psychiatric admission may be required"]
        }
        var finalRecs = recs
        if i.suicidalThought >= 2 {
            finalRecs.insert("⚠️ Active suicidal ideation (Q9 ≥2) — immediate risk assessment required", at: 0)
        }
        return ClinicalScore(
            name:          "PHQ-9",
            score:         Double(total),
            maxScore:      27,
            risk:          risk,
            interpretation: interp,
            recommendations: finalRecs,
            evidenceNote:  "Kroenke K, Spitzer RL, Williams JBW. J Gen Intern Med 2001;16:606–613. Validated 9-item depression scale. Each item scored 0 (not at all) to 3 (nearly every day), total 0–27. Pre-operative depression screening recommended by ANZCA and RCoA pre-assessment guidelines; undertreated depression independently predicts poor surgical outcomes and prolonged rehabilitation."
        )
    }

    // MARK: - SAPS II (Simplified Acute Physiology Score II)
    struct SAPSIIInput: Equatable {
        // Age
        var ageYears: Int = 0
        // Vitals (worst in first 24 h ICU)
        var heartRateMax: Int = 0       // bpm
        var sbpMin: Int = 0             // systolic, mmHg
        var tempMax: Double = 37.0      // °C
        // Oxygenation
        var pao2FiO2: Int = 0           // mmHg (for non-ventilated use actual PaO₂; 0=on ventilator)
        var onVentilator: Bool = false
        // Labs
        var urineOutputML: Int = 0      // mL/24 h
        var bunMmolL: Double = 0        // mmol/L (× 2.8 to get mg/dL)
        var wbc: Double = 0             // × 10⁹/L
        var sodiumMmolL: Int = 0        // mmol/L
        var potassiumMmolL: Double = 0  // mmol/L
        var bicarbonateMmolL: Int = 0   // mmol/L
        var bilirubinUmolL: Double = 0  // μmol/L
        // Neuro (GCS)
        var gcsScore: Int = 15
        // Admission type
        var scheduledSurgical: Bool = false
        var unscheduledSurgical: Bool = false
        // Chronic disease
        var metastaticCancer: Bool = false
        var haematologicalMalignancy: Bool = false
        var aids: Bool = false
    }
    static func sapsII(_ i: SAPSIIInput) -> ClinicalScore {
        var points = 0
        // Age
        switch i.ageYears {
        case ..<40:  points += 0
        case 40...59: points += 7
        case 60...69: points += 12
        case 70...74: points += 15
        case 75...79: points += 16
        default:     points += 18
        }
        // Heart rate
        switch i.heartRateMax {
        case ..<40:         points += 11
        case 40...69:       points += 2
        case 70...119:      points += 0
        case 120...159:     points += 4
        default:            points += 7
        }
        // Systolic BP (use minimum)
        switch i.sbpMin {
        case ..<70:         points += 13
        case 70...99:       points += 5
        case 100...199:     points += 0
        default:            points += 2
        }
        // Temperature (use maximum)
        if i.tempMax >= 39.0 { points += 3 }
        // PaO₂/FiO₂ (only if ventilated)
        if i.onVentilator {
            switch i.pao2FiO2 {
            case ..<100:   points += 11
            case 100...199: points += 9
            default:       points += 6
            }
        }
        // Urine output
        switch i.urineOutputML {
        case ..<500:        points += 11
        case 500...999:     points += 4
        default:            points += 0
        }
        // BUN (mg/dL equivalent: mmol/L × 2.8)
        let bunMgDL = i.bunMmolL * 2.8
        switch bunMgDL {
        case ..<28:         points += 0
        case 28...83:       points += 6
        default:            points += 10
        }
        // WBC
        switch i.wbc {
        case ..<1.0:        points += 12
        case 1.0...19.9:    points += 0
        default:            points += 3
        }
        // Sodium
        switch i.sodiumMmolL {
        case ..<125:        points += 5
        case 125...144:     points += 0
        default:            points += 1
        }
        // Potassium
        if i.potassiumMmolL < 3.0 || i.potassiumMmolL >= 5.0 { points += 3 }
        // Bicarbonate
        switch i.bicarbonateMmolL {
        case ..<15:         points += 6
        case 15...19:       points += 3
        default:            points += 0
        }
        // Bilirubin (μmol/L; 68.4 = 4 mg/dL, 102.6 = 6 mg/dL)
        switch i.bilirubinUmolL {
        case ..<68.4:       points += 0
        case 68.4...102.5:  points += 4
        default:            points += 9
        }
        // GCS
        switch i.gcsScore {
        case ..<6:          points += 26
        case 6...8:         points += 13
        case 9...10:        points += 7
        case 11...13:       points += 5
        default:            points += 0
        }
        // Admission type
        if i.scheduledSurgical        { points += 0 }
        else if i.unscheduledSurgical { points += 8 }
        else                          { points += 6 } // medical
        // Chronic disease
        if i.metastaticCancer              { points += 9 }
        if i.haematologicalMalignancy      { points += 10 }
        if i.aids                          { points += 17 }
        // Probability of hospital mortality: ln(p/1-p) = −7.7631 + 0.0737×SAPS + 0.9971×ln(SAPS+1)
        let s = Double(points)
        let logit = -7.7631 + 0.0737 * s + 0.9971 * log(s + 1)
        let mortalityPct = (exp(logit) / (1 + exp(logit)) * 100).rounded()
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch points {
        case 0...29:
            interp = "Low severity (predicted mortality ~10%)"
            risk   = .low
            recs   = ["Standard ICU monitoring protocol",
                      "Early mobilisation and rehabilitation planning",
                      "Daily goal-directed fluid strategy"]
        case 30...59:
            interp = "Moderate severity (predicted mortality ~30%)"
            risk   = .moderate
            recs   = ["Intensify monitoring: hourly vitals, 6-hourly labs",
                      "Senior ICU review twice daily",
                      "Consider early subspecialty involvement (renal, respiratory)",
                      "ICU duration expected 5–10 days — communicate to family"]
        case 60...89:
            interp = "High severity (predicted mortality ~60%)"
            risk   = .high
            recs   = ["Consultant-led daily ICU round mandatory",
                      "Goals-of-care discussion with patient and family",
                      "Optimise organ support: vasopressors, renal replacement as indicated",
                      "Avoid further major surgery unless life-saving"]
        default:
            interp = "Very high severity (predicted mortality >80%)"
            risk   = .high
            recs   = ["Urgent goals-of-care and ceiling-of-treatment discussion",
                      "Palliative/comfort-measures pathway should be formally considered",
                      "Any invasive interventions require consultant and family agreement",
                      "Document DNACPR decision if appropriate after discussion"]
        }
        return ClinicalScore(
            name:          "SAPS II",
            score:         Double(points),
            maxScore:      163,
            risk:          risk,
            interpretation: "\(interp)\nEstimated hospital mortality: \(Int(mortalityPct))%",
            recommendations: recs,
            evidenceNote:  "Le Gall JR et al. JAMA 1993;270:2957–2963. Simplified Acute Physiology Score II; 17 variables scored from worst values in first 24 h of ICU admission. Calibrated for hospital mortality prediction across mixed ICU populations. SAPS II ≥40 correlates with >30% hospital mortality."
        )
    }

    // MARK: - STONE Score (Nephrolithiasis Risk)
    struct STONEInput: Equatable {
        var sizeMm: Int = 0          // Stone size on CT (mm): 1–5mm=2, 6–10mm=1, >10mm=0
        var toUreters: Int = 0       // Tightness at ureter/UVJ: yes=1, no=0
        var obstruction: Bool = false // Hydronephrosis/ureteric dilation: yes=1
        var nausea: Bool = false      // Nausea/vomiting: yes=1
        var erythrocytes: Bool = false // Haematuria: yes=1
    }
    static func stone(_ i: STONEInput) -> ClinicalScore {
        // Size: >10mm=0, 6–10mm=1, 1–5mm=2, <1mm=0
        let sizeScore: Int
        switch i.sizeMm {
        case 1...5:    sizeScore = 2
        case 6...10:   sizeScore = 1
        default:       sizeScore = 0
        }
        let total = sizeScore + i.toUreters + (i.obstruction ? 1 : 0) +
                    (i.nausea ? 1 : 0) + (i.erythrocytes ? 1 : 0)
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 0...1:
            interp = "Low probability of ureteric colic"
            risk   = .low
            recs   = ["Consider alternative diagnoses (MSK, GI)",
                      "CT KUB if clinical suspicion persists despite low score",
                      "Urine dipstick and urinalysis; analgesia"]
        case 2...3:
            interp = "Intermediate probability of ureteric colic"
            risk   = .moderate
            recs   = ["CT KUB (unenhanced) recommended to confirm stone and size",
                      "Urinalysis, FBC, U&E, CRP",
                      "Analgesia (NSAIDs first-line unless contraindicated)",
                      "Alpha-blocker (tamsulosin) for distal ureteric stones ≤10 mm",
                      "Urology review if stone ≥6 mm, obstruction, or infection"]
        default:
            interp = "High probability of ureteric colic"
            risk   = .high
            recs   = ["CT KUB urgent to characterise stone; check for infection or solitary kidney",
                      "If infected obstructed system: urgent urology — percutaneous nephrostomy or ureteric stent",
                      "Analgesia: diclofenac 75 mg IM or rectal + IV morphine if required",
                      "U&E, FBC, CRP, urine MC&S",
                      "Admit if: stone ≥10 mm, obstruction, infection, uncontrolled pain, solitary kidney"]
        }
        return ClinicalScore(
            name:          "STONE Score",
            score:         Double(total),
            maxScore:      5,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Moore CL et al. Ann Emerg Med 2014;64:239–247. 5-variable pre-imaging score: Size (<1/1–5/6–10/>10 mm = 0/2/1/0), Tightness (UVJ narrowing = +1), Obstruction (hydronephrosis = +1), Nausea (+1), Erythrocytes (+1). Score 0–5; ≥4 = high probability. Validated to triage CT KUB use in suspected ureteric colic."
        )
    }

    // MARK: - Los Angeles Classification (GERD / Oesophagitis)
    struct LosAngelesInput: Equatable {
        var grade: Int = 0  // 0=None, 1=Grade A, 2=Grade B, 3=Grade C, 4=Grade D
    }
    static func losAngeles(_ i: LosAngelesInput) -> ClinicalScore {
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch i.grade {
        case 0:
            interp = "No endoscopic oesophagitis"
            risk   = .low
            recs   = ["Non-erosive reflux disease (NERD) if symptoms present",
                      "Empirical PPI trial 4–8 weeks; lifestyle advice (weight loss, head-of-bed elevation)",
                      "Consider 24-h pH/impedance if atypical symptoms or PPI failure"]
        case 1:
            interp = "Grade A — ≥1 mucosal break ≤5 mm, not extending between folds"
            risk   = .low
            recs   = ["PPI once daily (standard dose) for 4–8 weeks",
                      "Lifestyle modifications (avoid late meals, alcohol, tobacco)",
                      "Repeat OGD only if symptoms persist or alarm features develop"]
        case 2:
            interp = "Grade B — ≥1 mucosal break >5 mm, not extending between folds"
            risk   = .moderate
            recs   = ["PPI standard dose twice daily for 8 weeks",
                      "Confirm healing at 8 weeks: repeat OGD to exclude Barrett's",
                      "Consider H. pylori testing and eradication",
                      "Anti-reflux surgery (fundoplication) discussion if PPI-dependent"]
        case 3:
            interp = "Grade C — Mucosal breaks extending between ≥2 folds, <75% circumference"
            risk   = .moderate
            recs   = ["High-dose PPI twice daily for 8 weeks minimum",
                      "Repeat OGD to confirm healing and exclude Barrett's oesophagus",
                      "H. pylori testing mandatory",
                      "Refer for anti-reflux surgery evaluation if PPI refractory",
                      "Biopsy for Barrett's surveillance protocol if columnar metaplasia seen"]
        default:
            interp = "Grade D — Mucosal breaks extending ≥75% of oesophageal circumference"
            risk   = .high
            recs   = ["High-dose PPI twice daily for 8–12 weeks; IV PPI if unable to swallow",
                      "Urgent repeat OGD at 8 weeks — high risk of Barrett's and stricture",
                      "Biopsy from all four quadrants every 2 cm if columnar segment present",
                      "Oesophageal dilation if peptic stricture develops",
                      "Multidisciplinary discussion for anti-reflux surgery or endoscopic therapy"]
        }
        let gradeLabel = ["None","A","B","C","D"][min(i.grade, 4)]
        return ClinicalScore(
            name:          "LA Classification",
            score:         Double(i.grade),
            maxScore:      4,
            risk:          risk,
            interpretation: "Grade \(gradeLabel): \(interp)",
            recommendations: recs,
            evidenceNote:  "Lundell LR et al. Gut 1999;45:172–180. Los Angeles Classification of oesophagitis: Grade A–D based on extent and continuity of mucosal breaks at OGD. Internationally adopted standard; grade predicts PPI response rate (A/B >90%, C/D ~70%) and Barrett's risk (D ~30%)."
        )
    }

    // MARK: - MELD 3.0 (Model for End-stage Liver Disease — 2022 update)
    struct MELD3Input: Equatable {
        var isFemale: Bool = false
        var creatinineMmolL: Double = 70.0   // μmol/L
        var bilirubinMmolL: Double = 17.0    // μmol/L
        var inr: Double = 1.0
        var sodiumMmolL: Int = 138            // mmol/L
        var albuminGperL: Double = 40.0      // g/L
    }
    static func meld3(_ i: MELD3Input) -> ClinicalScore {
        // MELD 3.0 = 4.56 × ln(bilirubin_mg/dL) + 0.82×(137−sodium) − 0.24×(137−sodium)×ln(creatinine_mg/dL)
        //            + 9.09×ln(INR) + 11.14×ln(creatinine_mg/dL) + 1.85 + (female: +1.33) + (albumin: −(4.92×albumin/35))
        // Convert SI units to mg/dL equivalents used in the formula:
        let bilMgDL  = max(1.0, i.bilirubinMmolL / 17.1)
        let creatMgDL = min(4.0, max(1.0, i.creatinineMmolL / 88.4)) // capped at 4 per UNOS
        let na = Double(min(max(i.sodiumMmolL, 125), 137)) // clamp 125–137
        let alb = i.albuminGperL / 10.0  // g/L → g/dL
        var score = 4.56 * log(bilMgDL)
                  + 0.82 * (137 - na)
                  - 0.24 * (137 - na) * log(creatMgDL)
                  + 9.09 * log(i.inr)
                  + 11.14 * log(creatMgDL)
                  + 1.85
        if i.isFemale { score += 1.33 }
        score -= (4.92 * alb / 3.5)
        score = max(6, score)
        let rounded = (score * 10).rounded() / 10
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch Int(rounded) {
        case 6...9:
            interp = "Low severity — 90-day mortality ~2%"
            risk   = .low
            recs   = ["Optimise hepatic risk factors (abstinence, nutrition, infection control)",
                      "Semi-annual surveillance (LFTs, US abdomen, AFP if cirrhotic)",
                      "Reassess MELD 3.0 at each visit"]
        case 10...14:
            interp = "Moderate severity — 90-day mortality ~6%"
            risk   = .moderate
            recs   = ["Hepatology review — quarterly monitoring",
                      "Manage complications: diuretics for ascites, beta-blocker for varices",
                      "Nutritional optimisation; referral to dietitian",
                      "Discuss liver transplant evaluation if aetiology is reversible or stable"]
        case 15...19:
            interp = "Significant — 90-day mortality ~20%"
            risk   = .moderate
            recs   = ["Transplant list assessment — most centres list at MELD ≥15",
                      "Hospitalise for management of hepatic decompensation if present",
                      "TIPS assessment if recurrent variceal bleed or refractory ascites"]
        default:
            interp = "Severe — 90-day mortality >50%"
            risk   = .high
            recs   = ["Urgent transplant listing — MELD ≥25 = active waitlist priority at most centres",
                      "ICU-level monitoring for ACLF / multiorgan dysfunction",
                      "Discuss goals of care if transplant not feasible"]
        }
        return ClinicalScore(
            name:          "MELD 3.0",
            score:         rounded,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Kim WR et al. Hepatology 2021;74:1913–1922. MELD 3.0 adds sex (+1.33 for female), albumin term, and recalibrates coefficients on 280 000+ UNOS patients. Reduces sex disparity in waitlist outcomes vs MELD-Na. Adopted by UNOS/OPTN 2022 for organ allocation. Score ≥15 = transplant listing threshold at most centres."
        )
    }

    // MARK: - Braden Scale (Pressure Injury Risk)
    struct BradenInput: Equatable {
        var sensoryPerception: Int = 4  // 1=Complete, 2=Very, 3=Slightly, 4=No impairment
        var moisture: Int = 4           // 1=Constantly, 2=Very, 3=Occasionally, 4=Rarely moist
        var activity: Int = 4           // 1=Bedfast, 2=Chairfast, 3=Walks occasionally, 4=Walks frequently
        var mobility: Int = 4           // 1=Completely limited, 2=Very, 3=Slightly, 4=No limitation
        var nutrition: Int = 4          // 1=Very poor, 2=Probably inadequate, 3=Adequate, 4=Excellent
        var frictionShear: Int = 3      // 1=Problem, 2=Potential problem, 3=No apparent problem (max 3)
    }
    static func braden(_ i: BradenInput) -> ClinicalScore {
        let total = i.sensoryPerception + i.moisture + i.activity +
                    i.mobility + i.nutrition + i.frictionShear
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 19...23:
            interp = "No risk or low risk of pressure injury"
            risk   = .low
            recs   = ["Routine preventive care",
                      "Moisturise skin; reposition every 2–4 hours",
                      "Reassess if clinical condition deteriorates"]
        case 15...18:
            interp = "Low risk — pressure injury possible"
            risk   = .low
            recs   = ["Pressure-redistributing mattress (foam or alternating air)",
                      "Reposition every 2 hours; document position changes",
                      "Nutritional optimisation: dietitian review",
                      "Skin inspection twice daily"]
        case 13...14:
            interp = "Moderate risk — pressure injury likely without intervention"
            risk   = .moderate
            recs   = ["Active pressure-relieving mattress mandatory",
                      "Heel protectors; no dragging in bed",
                      "Physiotherapy for mobility promotion",
                      "Nutritional support (high-protein diet / supplement)",
                      "Formal wound care plan if any skin break detected"]
        case 10...12:
            interp = "High risk — pressure injury expected without intensive prevention"
            risk   = .high
            recs   = ["Dynamic (alternating pressure) mattress and cushion",
                      "Reposition every 2 hours; consider tilt-and-space seating",
                      "Dietitian — nutritional support or enteral feeds",
                      "Wound/tissue viability specialist review",
                      "Document skin assessment and interventions daily"]
        default:
            interp = "Very high risk — pressure injury imminent"
            risk   = .high
            recs   = ["Urgent tissue viability nurse assessment",
                      "High-specification low-air-loss or lateral rotation mattress",
                      "Maximum repositioning: every 1–2 hours or continuous lateral rotation",
                      "Skin barrier products; transparent film over bony prominences",
                      "Urgent nutritional support — IV if enteral not possible",
                      "Photograph and document all existing skin changes immediately"]
        }
        return ClinicalScore(
            name:          "Braden Scale",
            score:         Double(total),
            maxScore:      23,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Bergstrom N et al. Nurs Res 1987;36:205–210. 6-subscale scale (Sensory Perception, Moisture, Activity, Mobility, Nutrition, Friction/Shear); total 6–23 — lower score = higher risk. Threshold ≤18 = at risk in most guidelines. Endorsed by NICE (CG179) and AHRQ; widely used alongside Waterlow Scale."
        )
    }

    // MARK: - Centor / McIsaac Score (Group A Streptococcal Pharyngitis)
    struct CentorInput: Equatable {
        var tonsillarExudate: Bool = false  // Tonsillar swelling or exudate
        var tenderAnteriorCervical: Bool = false // Tender anterior cervical lymphadenopathy
        var feverHistory: Bool = false      // History of fever or temperature > 38°C
        var noCough: Bool = false           // Absence of cough (+1)
        var ageGroup: Int = 1              // 0=<15yr(+1), 1=15–44yr(0), 2=≥45yr(-1)
    }
    static func centor(_ i: CentorInput) -> ClinicalScore {
        var total = (i.tonsillarExudate ? 1 : 0) +
                    (i.tenderAnteriorCervical ? 1 : 0) +
                    (i.feverHistory ? 1 : 0) +
                    (i.noCough ? 1 : 0)
        switch i.ageGroup {
        case 0: total += 1   // <15 yr
        case 2: total -= 1   // ≥45 yr
        default: break
        }
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case ..<1:
            interp = "Score ≤0 — Group A Strep very unlikely (<10%)"
            risk   = .low
            recs   = ["No antibiotic indicated",
                      "Symptomatic treatment: analgesia, throat lozenges, adequate hydration",
                      "Advise likely viral aetiology; reassure and safety-net"]
        case 1:
            interp = "Score 1 — GAS probability ~10%"
            risk   = .low
            recs   = ["No antibiotic indicated",
                      "Symptomatic management only",
                      "Rapid antigen test (RADT) only if clinical uncertainty persists"]
        case 2:
            interp = "Score 2 — GAS probability ~17%"
            risk   = .low
            recs   = ["Consider RADT before prescribing",
                      "If RADT positive or unavailable and symptoms severe: phenoxymethylpenicillin 500 mg TDS × 10 days",
                      "If RADT negative: no antibiotic"]
        case 3:
            interp = "Score 3 — GAS probability ~35%"
            risk   = .moderate
            recs   = ["RADT recommended; treat if positive",
                      "If RADT unavailable: empirical antibiotic appropriate",
                      "Phenoxymethylpenicillin 500 mg TDS × 10 days (or amoxicillin 500 mg BD × 10 days)",
                      "If penicillin allergy: clarithromycin 250 mg BD × 5 days"]
        default:
            interp = "Score ≥4 — GAS probability ~50–60%"
            risk   = .high
            recs   = ["Prescribe antibiotic without awaiting RADT",
                      "Phenoxymethylpenicillin 500 mg TDS × 10 days (first-line per SIGN/NICE)",
                      "Consider throat swab for culture in immunocompromised patients",
                      "If no improvement in 48–72 h: review and culture",
                      "Admit if peritonsillar abscess (quinsy) suspected: trismus, unilateral uvular deviation"]
        }
        return ClinicalScore(
            name:          "Centor / McIsaac",
            score:         Double(total),
            maxScore:      5,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Centor RM et al. Med Decis Making 1981;1:239–246; McIsaac WJ et al. CMAJ 1998;158:75–83. Modified Centor: 4 clinical criteria + age adjustment (−1 if ≥45; +1 if <15). Score ≥4 = 50–60% GAS probability. NICE NG84 and SIGN 160 recommend against routine antibiotic prescribing for scores ≤1 and RADT-guided therapy for scores 2–3."
        )
    }

    // MARK: - IPSS (International Prostate Symptom Score)
    struct IPSSInput: Equatable {
        // 7 items 0–5 each + QoL 0–6
        var incompleteEmptying: Int = 0  // Q1
        var frequency: Int = 0          // Q2
        var intermittency: Int = 0      // Q3
        var urgency: Int = 0            // Q4
        var weakStream: Int = 0         // Q5
        var straining: Int = 0          // Q6
        var nocturia: Int = 0           // Q7 (0–5)
        var qualityOfLife: Int = 0      // QoL 0=delighted, 6=terrible
    }
    static func ipss(_ i: IPSSInput) -> ClinicalScore {
        let symptomTotal = i.incompleteEmptying + i.frequency + i.intermittency + i.urgency +
                           i.weakStream + i.straining + i.nocturia
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch symptomTotal {
        case 0...7:
            interp = "Mild LUTS (Score 0–7)"
            risk   = .low
            recs   = ["Watchful waiting appropriate if QoL acceptable",
                      "Lifestyle advice: fluid management, reduce caffeine/alcohol, bladder training",
                      "Annual review with IPSS reassessment",
                      "PSA and DRE if not done within 12 months"]
        case 8...19:
            interp = "Moderate LUTS (Score 8–19)"
            risk   = .moderate
            recs   = ["Medical treatment indicated if QoL affected (QoL ≥3)",
                      "Alpha-blocker (tamsulosin 400 mcg daily) — first-line for voiding symptoms",
                      "5-alpha-reductase inhibitor (finasteride) if prostate >30 mL on USS",
                      "Combination therapy for large prostate with bothersome LUTS",
                      "Uroflowmetry and post-void residual assessment",
                      "Urology referral if trial of treatment ineffective at 3 months"]
        default:
            interp = "Severe LUTS (Score 20–35)"
            risk   = .high
            recs   = ["Urology referral for surgical evaluation",
                      "Consider TURP, HoLEP, or minimally invasive therapy",
                      "Rule out acute/chronic retention: US bladder for post-void residual",
                      "Urgent catheterisation if retention present",
                      "PSA + DRE mandatory; MRI prostate if PSA elevated",
                      "Assess for neurological cause if obstructive symptoms disproportionate"]
        }
        let qolLabel = ["Delighted","Pleased","Mostly satisfied","Mixed","Mostly dissatisfied","Unhappy","Terrible"][min(i.qualityOfLife, 6)]
        var finalRecs = recs
        if i.qualityOfLife >= 4 {
            finalRecs.insert("QoL '\(qolLabel)' (≥4) — symptoms significantly impacting life; escalate treatment", at: 0)
        }
        return ClinicalScore(
            name:          "IPSS",
            score:         Double(symptomTotal),
            maxScore:      35,
            risk:          risk,
            interpretation: "\(interp) | QoL: \(i.qualityOfLife)/6 (\(qolLabel))",
            recommendations: finalRecs,
            evidenceNote:  "Barry MJ et al. J Urol 1992;148:1549–1557. 7 symptom questions + 1 QoL question; each 0–5 = total 0–35. AUA/EAU endorsed. Mild 0–7, Moderate 8–19, Severe 20–35. QoL 0=Delighted, 6=Terrible; QoL ≥4 warrants treatment escalation regardless of symptom score."
        )
    }

    // MARK: - Truelove-Witts Severity Index (Ulcerative Colitis)
    struct TruelovewIttsInput: Equatable {
        var stoolsPerDay: Int = 0         // BM frequency per day
        var macroscopicBlood: Bool = false // Visible blood in stool
        var hrAbove90: Bool = false        // HR > 90 bpm
        var tempAbove375: Bool = false     // Temperature > 37.5°C
        var hbBelow105: Bool = false       // Haemoglobin < 10.5 g/dL (< 105 g/L)
        var esrAbove30: Bool = false       // ESR > 30 mm/hr
    }
    static func truelovewItts(_ i: TruelovewIttsInput) -> ClinicalScore {
        let (interp, risk, score, recs): (String, ScoreRisk, Double, [String])
        let systemic = (i.hrAbove90 ? 1 : 0) + (i.tempAbove375 ? 1 : 0) +
                       (i.hbBelow105 ? 1 : 0) + (i.esrAbove30 ? 1 : 0)
        let hasSystemic = systemic >= 2
        switch (i.stoolsPerDay, i.macroscopicBlood, hasSystemic) {
        case (let n, _, false) where n < 4:
            interp = "Mild UC — < 4 stools/day, no systemic involvement"
            risk   = .low
            score  = 1
            recs   = ["Topical aminosalicylate (suppository or enema) for distal disease",
                      "Oral mesalazine for extensive mild UC",
                      "Outpatient management with gastroenterology review in 2–4 weeks",
                      "Ensure calprotectin and CRP documented"]
        case (4...5, _, false), (4...5, false, _):
            interp = "Moderate UC — 4–5 stools/day without systemic toxicity"
            risk   = .moderate
            score  = 2
            recs   = ["Oral prednisolone 40 mg daily — standard induction",
                      "Continue maintenance aminosalicylate at full dose",
                      "Ensure gastroenterology review within 5–7 days",
                      "Stool MC&S to exclude infective colitis",
                      "FBC, CRP, albumin, LFTs baseline"]
        default:
            interp = "Severe UC — ≥6 stools/day OR ≥4 with systemic toxicity (Truelove-Witts criteria)"
            risk   = .high
            score  = 3
            recs   = ["Admit for IV hydrocortisone 100 mg QDS (or equivalent)",
                      "Daily stool chart and CRP; abdominal X-ray on admission",
                      "Surgical assessment on day of admission — colectomy if not responding",
                      "Assessment at 72 h: Oxford Score/CRP > 45 at day 3 = predict failure",
                      "Biologic rescue therapy (infliximab or ciclosporin) if IV steroids fail at 72 h",
                      "Involve colorectal surgery — nil by mouth if toxic megacolon suspected"]
        }
        return ClinicalScore(
            name:          "Truelove-Witts",
            score:         score,
            maxScore:      3,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Truelove SC, Witts LJ. BMJ 1955;2:1041–1048. Original criteria: mild = <4 stools/day, no systemic features; severe = ≥6/day + one of HR>90, temp>37.5°C, Hb<10.5, ESR>30; moderate = between mild and severe. Remains the cornerstone of inpatient IBD management decisions. ACPGBI/BSG guidelines endorse IV steroids for severe disease with surgical assessment from day 1."
        )
    }

    // MARK: - Harvey-Bradshaw Index (Crohn's Disease Activity)
    struct HarveyBradshawInput: Equatable {
        var generalWellbeing: Int = 0     // 0=very well, 1=slightly below par, 2=poor, 3=very poor, 4=terrible
        var abdominalPain: Int = 0        // 0=none, 1=mild, 2=moderate, 3=severe
        var liquidStoolsPerDay: Int = 0   // number of liquid stools per day
        var abdominalMass: Int = 0        // 0=none, 1=dubious, 2=definite, 3=definite + tender
        var complications: Int = 0        // number present: arthralgia, uveitis, erythema nodosum, aphthous ulcers, pyoderma, anal fissure, fistula, abscess
    }
    static func harveyBradshaw(_ i: HarveyBradshawInput) -> ClinicalScore {
        let total = i.generalWellbeing + i.abdominalPain + i.liquidStoolsPerDay +
                    i.abdominalMass + i.complications
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 0...4:
            interp = "Remission (HBI < 5)"
            risk   = .low
            recs   = ["Continue maintenance therapy (azathioprine, anti-TNF, or vedolizumab)",
                      "Gastroenterology review every 6–12 months",
                      "Annual calprotectin, CRP, FBC, LFTs",
                      "Surveillance ileocolonoscopy per local IBD protocol"]
        case 5...7:
            interp = "Mildly active Crohn's disease (HBI 5–7)"
            risk   = .low
            recs   = ["Review current maintenance therapy — optimise dose",
                      "Check therapeutic drug levels if on anti-TNF",
                      "Enteral nutrition as adjunct in young patients",
                      "Exclude infection: stool MC&S, C. difficile, CMV",
                      "Gastroenterology review within 2–4 weeks"]
        case 8...16:
            interp = "Moderately active Crohn's disease (HBI 8–16)"
            risk   = .moderate
            recs   = ["Prednisolone induction: 40 mg daily tapering over 8 weeks",
                      "Consider biological therapy if corticosteroid-dependent or refractory",
                      "IBD nurse specialist involvement for monitoring and patient education",
                      "MRE or CT enterography to assess extent and exclude complication",
                      "Surgical review if loculated collection, stricture, or fistula identified"]
        default:
            interp = "Severely active Crohn's disease (HBI > 16)"
            risk   = .high
            recs   = ["Hospital admission for IV hydrocortisone or biological rescue",
                      "Urgent cross-sectional imaging (MRI/CT) for abscess, perforation, or fistula",
                      "Surgical assessment — resection or drainage as indicated",
                      "Nutritional support: nasogastric or parenteral nutrition",
                      "Multidisciplinary IBD team decision within 48 hours"]
        }
        return ClinicalScore(
            name:          "Harvey-Bradshaw Index",
            score:         Double(total),
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Harvey RF, Bradshaw JM. Lancet 1980;1:514. 5-item simplified CDAI derivative; remission <5, mild 5–7, moderate 8–16, severe >16. Requires no laboratory values; validated for outpatient monitoring. Correlates with CDAI (r ≈ 0.93). Used in surgical trials for objective preoperative activity stratification."
        )
    }

    // MARK: - #93 Maddrey Discriminant Function (Alcoholic Hepatitis)

    struct MaddreyInput: Equatable {
        var ptSeconds: Double          // patient PT in seconds
        var controlPTSeconds: Double   // control PT in seconds
        var bilirubinMgDL: Double      // serum bilirubin in mg/dL
    }

    static func maddrey(_ i: MaddreyInput) -> ClinicalScore {
        let mdf = 4.6 * (i.ptSeconds - i.controlPTSeconds) + i.bilirubinMgDL
        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if mdf >= 32 {
            risk  = .critical
            interp = "Severe alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). 28-day mortality 35–45% without treatment."
            recs  = [
                "Consider prednisolone 40 mg/day × 28 days if no contraindications",
                "Reassess with Lille model at day 7 — Lille ≥0.45 indicates steroid non-response",
                "Hepatology / gastroenterology urgent review",
                "Pentoxifylline no longer preferred per recent evidence (STOPAH trial)",
                "N-acetylcysteine as adjunct if renal impairment present",
                "Abstinence counselling and addiction medicine referral",
                "Monitor for hepatorenal syndrome, SBP, hepatic encephalopathy"
            ]
            flags = ["mDF ≥ 32 — high 28-day mortality without corticosteroid therapy"]
        } else if mdf >= 20 {
            risk  = .high
            interp = "Moderately severe alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). Elevated mortality risk; close monitoring required."
            recs  = [
                "Hepatology review within 24–48 hours",
                "Intensive nutritional support — target 35–40 kcal/kg/day",
                "Strict alcohol cessation",
                "Monitor renal function and coagulation daily"
            ]
        } else {
            risk  = .moderate
            interp = "Mild–moderate alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). Lower short-term mortality; supportive management."
            recs  = [
                "Alcohol abstinence — cornerstone of management",
                "Nutritional optimisation",
                "Monitor LFTs, coagulation weekly",
                "Hepatology outpatient follow-up within 2 weeks"
            ]
        }

        return ClinicalScore(
            name:          "Maddrey Discriminant Function",
            score:         mdf,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Maddrey WC et al. Gastroenterology 1978;75:193. Formula: 4.6 × (PT_patient − PT_control) + bilirubin(mg/dL). mDF ≥32 defines severe disease with ≥35% 28-day mortality; the steroid-treatment threshold. STOPAH (NEJM 2015) confirmed prednisolone reduces 28-day mortality for mDF ≥32 but not long-term survival. Lille score at day 7 guides continuation vs. cessation."
        )
    }

    // MARK: - #94 Manning Criteria for IBS

    struct ManningInput: Equatable {
        var painRelievedByDefecation: Bool
        var looserStoolsWithOnsetOfPain: Bool
        var increasedFrequencyWithOnsetOfPain: Bool
        var abdomenVisiblyDistended: Bool
        var mucusPerRectum: Bool
        var feelingOfIncompleteEmptying: Bool
    }

    static func manning(_ i: ManningInput) -> ClinicalScore {
        var score = 0
        if i.painRelievedByDefecation        { score += 1 }
        if i.looserStoolsWithOnsetOfPain     { score += 1 }
        if i.increasedFrequencyWithOnsetOfPain { score += 1 }
        if i.abdomenVisiblyDistended         { score += 1 }
        if i.mucusPerRectum                  { score += 1 }
        if i.feelingOfIncompleteEmptying     { score += 1 }

        let risk: ScoreRisk
        let interp: String
        var recs: [String]

        switch score {
        case 0, 1:
            risk  = .low
            interp = "Manning \(score)/6 — IBS unlikely. Consider organic pathology."
            recs  = [
                "Evaluate for organic causes: IBD, colorectal neoplasia, coeliac disease",
                "Colonoscopy if alarm features (rectal bleeding, weight loss, age >45, family history CRC)",
                "Coeliac serology (anti-tTG IgA)"
            ]
        case 2, 3:
            risk  = .moderate
            interp = "Manning \(score)/6 — Possible IBS. Consider targeted workup to exclude organic disease."
            recs  = [
                "Full blood count, CRP, faecal calprotectin to exclude IBD",
                "Coeliac serology",
                "Dietary assessment — low-FODMAP trial if organic disease excluded",
                "Rome IV criteria reassessment at follow-up"
            ]
        default:
            risk  = .high
            interp = "Manning \(score)/6 — Probable IBS (≥3 criteria met). Sensitivity 58–78%, specificity 67–74%."
            recs  = [
                "Confirm Rome IV criteria for IBS subtype classification (IBS-C, IBS-D, IBS-M)",
                "Faecal calprotectin to exclude IBD before committing to IBS diagnosis",
                "Colonoscopy only if alarm features present",
                "Dietary modification — low-FODMAP diet with dietitian support",
                "Antispasmodics (mebeverine, hyoscine) for pain management",
                "Cognitive behavioural therapy or gut-directed hypnotherapy for refractory symptoms"
            ]
        }

        return ClinicalScore(
            name:          "Manning Criteria for IBS",
            score:         Double(score),
            maxScore:      6,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Manning AP et al. BMJ 1978;2:653. Six symptom criteria for IBS diagnosis (score ≥3 supports diagnosis). Sensitivity 58–78%, specificity 67–74%. Superseded by Rome IV for formal classification but widely used clinically. Should not replace investigation when alarm features present."
        )
    }

    // MARK: - #95 LACE Index (30-Day Readmission Risk)

    struct LACEInput: Equatable {
        var lengthOfStayDays: Int    // L: 0–14+ days
        var acuteAdmission: Bool     // A: unplanned/acute vs elective
        var charlsonIndex: Int       // C: CCI score (clamped to 0–4)
        var edVisitsLast6Months: Int // E: number of ED visits (clamped to 0–4)
    }

    static func lace(_ i: LACEInput) -> ClinicalScore {
        // L — length of stay (0–7 scale)
        let los = i.lengthOfStayDays
        let lScore: Int
        switch los {
        case 0:      lScore = 0
        case 1:      lScore = 1
        case 2:      lScore = 2
        case 3:      lScore = 3
        case 4...6:  lScore = 4
        case 7...13: lScore = 5
        default:     lScore = 7
        }

        // A — admission type (0 or 3)
        let aScore = i.acuteAdmission ? 3 : 0

        // C — Charlson Comorbidity Index (capped at 4)
        let cScore = min(i.charlsonIndex, 4)

        // E — ED visits in last 6 months (capped at 4)
        let eScore = min(i.edVisitsLast6Months, 4)

        let total = lScore + aScore + cScore + eScore

        let risk: ScoreRisk
        let interp: String
        var recs: [String]

        if total >= 10 {
            risk  = .critical
            interp = "LACE \(total) — High 30-day readmission risk (≥10). Intensive post-discharge support required."
            recs  = [
                "Arrange 48–72 hour post-discharge telephone review",
                "Early GP/primary care follow-up within 7 days",
                "Medication reconciliation and patient education prior to discharge",
                "Community nurse or case manager referral",
                "Review and address all modifiable risk factors (polypharmacy, social support)",
                "Consider transitional care programme enrolment"
            ]
        } else if total >= 7 {
            risk  = .high
            interp = "LACE \(total) — Elevated 30-day readmission risk (7–9). Enhanced discharge planning recommended."
            recs  = [
                "Structured discharge planning: written care plan, medication list, clear follow-up",
                "Primary care follow-up within 14 days",
                "Patient/carer education on warning signs requiring re-presentation",
                "Ensure all investigations and outstanding results reviewed before discharge"
            ]
        } else if total >= 4 {
            risk  = .moderate
            interp = "LACE \(total) — Moderate 30-day readmission risk (4–6). Standard discharge planning with follow-up."
            recs  = [
                "Routine discharge planning with outpatient follow-up arranged",
                "Medication reconciliation",
                "Clear written discharge instructions"
            ]
        } else {
            risk  = .low
            interp = "LACE \(total) — Low 30-day readmission risk (<4). Standard discharge."
            recs  = ["Standard discharge with routine outpatient review"]
        }

        return ClinicalScore(
            name:          "LACE Index",
            score:         Double(total),
            maxScore:      19,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "van Walraven C et al. CMAJ 2010;182:551. Validated 30-day readmission risk score: L (length of stay, 0–7), A (acute admission, 0/3), C (Charlson min 0–4), E (ED visits 0–4). Total 0–19; score ≥10 = high risk (readmission rate ≈21%). Widely used for discharge planning and transitional care resource allocation."
        )
    }

    // MARK: - #96 FINDRISC (Finnish Type 2 Diabetes Risk Score)

    struct FINDRISCInput: Equatable {
        var ageGroup: Int          // 0=<45, 2=45–54, 3=55–64, 4=≥65
        var bmi: Double            // kg/m²
        var waistCircumferenceCm: Double
        var sex: String            // "male" or "female"
        var physicalActivityMinPerWeek: Int  // 0=<30 min, 2=≥30 min
        var vegetablesFruitDaily: Bool      // eats veg/fruit daily
        var hypertensionMeds: Bool          // on antihypertensive medication
        var highBloodGlucoseHistory: Bool   // ever found high blood glucose
        var familyHistoryDiabetes: Int      // 0=none, 3=second-degree, 5=first-degree
    }

    static func findrisc(_ i: FINDRISCInput) -> ClinicalScore {
        var score = 0

        // Age
        score += i.ageGroup

        // BMI
        if i.bmi >= 30 { score += 3 } else if i.bmi >= 25 { score += 1 }

        // Waist circumference (sex-specific thresholds)
        if i.sex.lowercased() == "male" {
            if i.waistCircumferenceCm >= 102 { score += 4 } else if i.waistCircumferenceCm >= 94 { score += 3 }
        } else {
            if i.waistCircumferenceCm >= 88 { score += 4 } else if i.waistCircumferenceCm >= 80 { score += 3 }
        }

        // Physical activity
        if i.physicalActivityMinPerWeek == 0 { score += 2 }

        // Diet
        if !i.vegetablesFruitDaily { score += 1 }

        // Hypertension medication
        if i.hypertensionMeds { score += 2 }

        // History of high blood glucose
        if i.highBloodGlucoseHistory { score += 5 }

        // Family history
        score += i.familyHistoryDiabetes

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case 0...6:
            risk  = .low
            interp = "FINDRISC \(score) — Low risk. Estimated 1-in-100 chance of developing T2DM over 10 years."
            recs  = [
                "Maintain healthy weight (BMI 18.5–24.9)",
                "Minimum 150 min/week moderate physical activity",
                "Healthy diet: high fibre, low glycaemic index, limited processed food",
                "Reassess annually if risk factors change"
            ]
        case 7...11:
            risk  = .moderate
            interp = "FINDRISC \(score) — Slightly elevated risk. ~1-in-25 chance of T2DM over 10 years."
            recs  = [
                "Weight reduction if BMI >25 — even 5–7% weight loss significantly reduces progression",
                "Structured physical activity programme",
                "Dietary review with focus on carbohydrate quality",
                "Fasting plasma glucose or HbA1c to establish baseline"
            ]
        case 12...14:
            risk  = .high
            interp = "FINDRISC \(score) — Moderate risk. ~1-in-6 chance of T2DM over 10 years."
            recs  = [
                "Fasting plasma glucose AND HbA1c — exclude undiagnosed T2DM or prediabetes",
                "Intensive lifestyle intervention: structured dietary programme and 150–210 min/week activity",
                "Consider referral to structured diabetes prevention programme",
                "Reassess in 6–12 months"
            ]
            flags = ["FINDRISC ≥12 — screen for undiagnosed T2DM with FPG and HbA1c"]
        case 15...20:
            risk  = .high
            interp = "FINDRISC \(score) — High risk. ~1-in-3 chance of T2DM over 10 years."
            recs  = [
                "Urgent fasting plasma glucose and HbA1c — high probability of undiagnosed T2DM",
                "Refer to structured diabetes prevention or management programme",
                "Cardiovascular risk assessment (lipids, BP, smoking status)",
                "Intensive lifestyle intervention with dietitian and exercise physiologist"
            ]
            flags = ["FINDRISC ≥15 — 1-in-3 risk; immediate diabetes screening and prevention referral"]
        default:
            risk  = .critical
            interp = "FINDRISC \(score) — Very high risk. ~1-in-2 chance of T2DM over 10 years."
            recs  = [
                "Immediate fasting plasma glucose and HbA1c to confirm or exclude T2DM",
                "Cardiology risk stratification",
                "Referral to endocrinology or diabetes clinic if prediabetes confirmed",
                "Metformin consideration for high-risk prediabetes (ADA guidance)",
                "Intensive multidisciplinary lifestyle intervention"
            ]
            flags = ["FINDRISC ≥21 — very high risk; T2DM likely or already present; immediate workup"]
        }

        return ClinicalScore(
            name:          "FINDRISC",
            score:         Double(score),
            maxScore:      26,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Lindström J, Tuomilehto J. Diabetes Care 2003;26:725. 8-item self-administered T2DM risk questionnaire. Score 0–26; validated against OGTT in Finnish population cohorts. AUC 0.85 for predicting T2DM over 10 years. Recommended by IDF and many national guidelines as first-line screening tool. Score ≥12 triggers biochemical screening; ≥15 requires immediate clinical assessment."
        )
    }

    // MARK: - #97 Mirels Criteria (Pathological Fracture Risk)

    struct MirelsInput: Equatable {
        var site: Int        // 1=upper limb, 2=lower limb, 3=peritrochanteric
        var pain: Int        // 1=mild, 2=moderate, 3=functional
        var lesionType: Int  // 1=blastic, 2=mixed, 3=lytic
        var lesionSizeRatio: Int // 1=<1/3 cortex, 2=1/3–2/3, 3=>2/3
    }

    static func mirels(_ i: MirelsInput) -> ClinicalScore {
        let total = i.site + i.pain + i.lesionType + i.lesionSizeRatio
        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if total >= 9 {
            risk  = .critical
            interp = "Mirels \(total)/12 — High fracture risk. Prophylactic fixation strongly recommended before radiotherapy."
            recs  = [
                "Urgent orthopaedic surgery / oncology review for prophylactic fixation",
                "Avoid weight-bearing on the affected limb until fixed",
                "Postoperative radiotherapy to the fixation site",
                "Multidisciplinary oncology bone meeting review",
                "Pain management: bisphosphonate or RANK-L inhibitor (denosumab)"
            ]
            flags = ["Mirels ≥9 — prophylactic fixation recommended; do not delay for radiotherapy alone"]
        } else if total == 8 {
            risk  = .high
            interp = "Mirels \(total)/12 — Indeterminate fracture risk. Consider prophylactic fixation (borderline threshold)."
            recs  = [
                "Multidisciplinary review: orthopaedic surgery, radiation oncology, medical oncology",
                "Individual clinical assessment — patient fitness, systemic disease burden, expected survival",
                "If not fixating, restrict weight-bearing; radiotherapy to lesion",
                "Repeat imaging in 4–6 weeks to assess progression"
            ]
        } else {
            risk  = .moderate
            interp = "Mirels \(total)/12 — Lower fracture risk. Radiotherapy and conservative management appropriate."
            recs  = [
                "Radiotherapy to the lesion",
                "Weight-bearing as tolerated if lower-limb lesion",
                "Regular reassessment — repeat imaging at 6–8 weeks",
                "Bone-modifying agent (bisphosphonate or denosumab)",
                "Reassess if pain escalates or lesion enlarges"
            ]
        }

        return ClinicalScore(
            name:          "Mirels Criteria",
            score:         Double(total),
            maxScore:      12,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Mirels H. Clin Orthop Relat Res 1989;249:256. Four-variable scoring system for pathological fracture risk in metastatic bone disease: site (1–3), pain (1–3), lesion type (1–3), radiological size ratio (1–3). Total 4–12. Score ≥9 = prophylactic fixation recommended (fracture risk >33%). Score 8 = borderline (15% fracture risk). Score ≤7 = radiotherapy alone acceptable (<4% fracture risk). Widely used in surgical oncology and orthopaedic oncology multidisciplinary practice."
        )
    }

    // MARK: - #98 CKD-EPI eGFR (Chronic Kidney Disease Staging)

    struct CKDEPIInput: Equatable {
        var serumCreatinineMgDL: Double  // serum creatinine in mg/dL
        var ageYears: Int
        var sex: String                  // "male" or "female"
        var raceAA: Bool                 // African American (2021 equation drops this; retained for legacy)
    }

    static func ckdEpi(_ i: CKDEPIInput) -> ClinicalScore {
        // CKD-EPI 2021 (race-free) Cr equation
        // eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^(-1.200) × 0.9938^Age [× 1.012 if female]
        let kappa: Double = i.sex.lowercased() == "female" ? 0.7 : 0.9
        let alpha: Double = i.sex.lowercased() == "female" ? -0.241 : -0.302
        let scr = i.serumCreatinineMgDL
        let ratio = scr / kappa
        let term1 = pow(min(ratio, 1.0), alpha)
        let term2 = pow(max(ratio, 1.0), -1.200)
        let term3 = pow(0.9938, Double(i.ageYears))
        let sexFactor: Double = i.sex.lowercased() == "female" ? 1.012 : 1.0
        let egfr = 142.0 * term1 * term2 * term3 * sexFactor

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        let egfrStr = String(format: "%.1f", egfr)
        let (stage, stageName) = ckdStage(egfr)

        switch stage {
        case 1:
            risk  = .low
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G1 (\(stageName)). Normal/high GFR."
            recs  = [
                "Treat underlying cause (proteinuria, hypertension, diabetes)",
                "Annual ACR (albumin:creatinine ratio) to assess proteinuria",
                "Blood pressure target <130/80 mmHg (ACEi/ARB if proteinuria present)",
                "Nephrology referral if cause unclear or rapidly progressive"
            ]
        case 2:
            risk  = .low
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G2 (\(stageName)). Mildly decreased."
            recs  = [
                "Identify and treat underlying cause",
                "Monitor annually: eGFR, ACR, BP, electrolytes",
                "Avoid nephrotoxins (NSAIDs, IV contrast without precautions)"
            ]
        case 3:
            risk  = .moderate
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G3 (\(stageName)). Moderately decreased."
            recs  = [
                "Nephrology co-management if not yet involved",
                "6-monthly monitoring: eGFR, ACR, potassium, bicarbonate, phosphate, Hb",
                "Avoid all nephrotoxins; adjust medication doses to eGFR",
                "Anaemia work-up: iron studies, consider erythropoiesis-stimulating agents",
                "Calcium-phosphate management; vitamin D supplementation if deficient",
                "Dietary sodium restriction and protein optimisation"
            ]
        case 4:
            risk  = .high
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G4 (\(stageName)). Severely decreased."
            recs  = [
                "Nephrology review — renal replacement therapy planning",
                "AV fistula creation referral if haemodialysis planned",
                "Peritoneal dialysis and transplant workup discussion",
                "3-monthly monitoring of all metabolic parameters",
                "Review all medications for dose adjustment"
            ]
            flags = ["eGFR <30 — prepare for renal replacement therapy; nephrology must be involved"]
        default:
            risk  = .critical
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G5 (\(stageName)). Kidney failure."
            recs  = [
                "Urgent nephrology review — dialysis or transplant required if not already initiated",
                "Emergency haemodialysis if symptomatic uraemia, severe hyperkalaemia, or fluid overload",
                "Conservative pathway discussion if dialysis not appropriate",
                "Palliative care input for uraemic symptom management if appropriate"
            ]
            flags = ["eGFR <15 — kidney failure; renal replacement therapy or conservative pathway urgently"]
        }

        return ClinicalScore(
            name:          "CKD-EPI eGFR",
            score:         egfr,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Inker LA et al. NEJM 2021;385:1737. CKD-EPI 2021 race-free creatinine equation. eGFR ≥90 = G1, 60–89 = G2, 45–59 = G3a, 30–44 = G3b, 15–29 = G4, <15 = G5. KDIGO 2022 guidelines recommend staging by both eGFR and albuminuria (ACR) categories. The 2021 update removed the race coefficient; prior versions using the AF-American race multiplier are no longer recommended by major nephrology societies."
        )
    }

    private static func ckdStage(_ egfr: Double) -> (Int, String) {
        if egfr >= 90      { return (1, "normal or high") }
        else if egfr >= 60 { return (2, "mildly decreased") }
        else if egfr >= 45 { return (3, "mildly–moderately decreased") }
        else if egfr >= 30 { return (3, "moderately–severely decreased") }
        else if egfr >= 15 { return (4, "severely decreased") }
        else               { return (5, "kidney failure") }
    }

    // MARK: - #99 ARISCAT Score (Postoperative Pulmonary Complications)

    struct ARISCATInput: Equatable {
        var age: Int             // years
        var spo2Preop: Int       // pre-operative SpO₂ (%)
        var respiratoryInfection: Bool  // acute URTI in last month
        var preOpHaemoglobin: Double    // g/dL
        var surgicalIncision: Int  // 0=peripheral, 1=upper abdominal, 2=intrathoracic
        var surgicalDurationHrs: Double // planned/actual operative duration (hours)
        var emergencyProcedure: Bool
    }

    static func ariscat(_ i: ARISCATInput) -> ClinicalScore {
        var score = 0

        // Age
        if i.age >= 80      { score += 16 }
        else if i.age >= 51 { score += 3 }

        // SpO₂
        if i.spo2Preop <= 90      { score += 24 }
        else if i.spo2Preop <= 95 { score += 8 }

        // Respiratory infection
        if i.respiratoryInfection { score += 17 }

        // Pre-op haemoglobin
        if i.preOpHaemoglobin <= 10 { score += 11 }

        // Surgical incision
        if i.surgicalIncision == 2      { score += 24 }   // intrathoracic
        else if i.surgicalIncision == 1 { score += 15 }   // upper abdominal

        // Duration
        if i.surgicalDurationHrs >= 3      { score += 16 }
        else if i.surgicalDurationHrs >= 2 { score += 8 }

        // Emergency
        if i.emergencyProcedure { score += 8 }

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if score >= 45 {
            risk  = .critical
            interp = "ARISCAT \(score) — High risk of postoperative pulmonary complications (PPC rate ~42%)."
            recs  = [
                "Preoperative physiotherapy and breathing exercises — begin ≥2 weeks before surgery",
                "Optimise pre-existing respiratory conditions (asthma, COPD)",
                "Treat any current URTI; delay elective surgery until resolved",
                "Correct anaemia preoperatively (transfusion or IV iron as appropriate)",
                "Discuss enhanced recovery after surgery (ERAS) pulmonary protocol with anaesthesia",
                "Plan postoperative care: HDU/ICU likely; early physiotherapy post-op",
                "Consider regional anaesthesia techniques to reduce systemic opioid use"
            ]
            flags = ["ARISCAT ≥45 — high PPC risk; preoperative optimisation and HDU/ICU planning required"]
        } else if score >= 26 {
            risk  = .high
            interp = "ARISCAT \(score) — Intermediate risk of postoperative pulmonary complications (PPC rate ~13%)."
            recs  = [
                "Preoperative respiratory physiotherapy if time permits",
                "Optimise respiratory comorbidities",
                "Anaesthetic review: consider lung-protective ventilation strategy",
                "Early postoperative mobilisation and incentive spirometry",
                "Monitor SpO₂ closely in recovery"
            ]
        } else {
            risk  = .low
            interp = "ARISCAT \(score) — Low risk of postoperative pulmonary complications (PPC rate ~1.6%)."
            recs  = [
                "Standard ERAS respiratory protocol",
                "Early mobilisation and breathing exercises postoperatively",
                "Routine monitoring"
            ]
        }

        return ClinicalScore(
            name:          "ARISCAT Score",
            score:         Double(score),
            maxScore:      123,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Canet J et al. Anesthesiology 2010;113:1338. Validated 7-item preoperative risk score for postoperative pulmonary complications (PPC). Score 0–123; low <26 (PPC 1.6%), intermediate 26–44 (12.8%), high ≥45 (42.1%). Originally developed and validated in a European multicentre cohort of 2,464 non-cardiac surgical patients. Included in ESA/ESAIC preoperative assessment guidelines."
        )
    }

    // MARK: - #100 Fong Clinical Risk Score (Colorectal Liver Metastases)

    struct FongCRSInput: Equatable {
        var nodePosivePrimaryTumour: Bool    // lymph node–positive primary CRC
        var diseaseFreeIntervalLess12Mo: Bool // DFI < 12 months from primary resection
        var moreThanOneHepaticTumour: Bool   // > 1 hepatic metastasis
        var largestTumourOver5cm: Bool       // largest hepatic met > 5 cm
        var ceaOver200: Bool                 // preoperative CEA > 200 ng/mL
    }

    static func fongCRS(_ i: FongCRSInput) -> ClinicalScore {
        var score = 0
        if i.nodePosivePrimaryTumour        { score += 1 }
        if i.diseaseFreeIntervalLess12Mo    { score += 1 }
        if i.moreThanOneHepaticTumour       { score += 1 }
        if i.largestTumourOver5cm          { score += 1 }
        if i.ceaOver200                    { score += 1 }

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case 0:
            risk  = .low
            interp = "Fong CRS \(score)/5 — Favourable prognosis. Estimated 5-year survival ~60% after hepatic resection."
            recs  = [
                "Proceed to hepatic resection if technically feasible and patient fit",
                "Colorectal MDT review",
                "Perioperative systemic chemotherapy (FOLFOX/CAPOX) per EPOC trial principles",
                "Consider ablation for small residual lesions if margins tight"
            ]
        case 1, 2:
            risk  = .moderate
            interp = "Fong CRS \(score)/5 — Intermediate prognosis. Estimated 5-year survival ~40% after hepatic resection."
            recs  = [
                "Colorectal liver MDT — hepato-pancreato-biliary surgeon, oncologist, radiologist",
                "Perioperative chemotherapy (FOLFOX/CAPOX): consider neoadjuvant to test tumour biology",
                "Staging FDG-PET CT to exclude extrahepatic disease before committing to resection",
                "Hepatic resection if ≥1 cm negative margin achievable and FLR adequate"
            ]
        case 3, 4:
            risk  = .high
            interp = "Fong CRS \(score)/5 — Poor prognosis. Estimated 5-year survival ~20% after hepatic resection."
            recs  = [
                "Oncology-led MDT discussion — systemic chemotherapy as primary treatment",
                "PET-CT mandatory to exclude extrahepatic disease",
                "Surgery only if good response to chemotherapy (≥30% tumour shrinkage) and fit patient",
                "Consider ablative techniques as alternative to open resection"
            ]
            flags = ["CRS ≥3 — poor prognosis; chemotherapy response before surgery is critical"]
        default:
            risk  = .critical
            interp = "Fong CRS \(score)/5 — Very poor prognosis. Surgery unlikely to confer survival benefit."
            recs  = [
                "Systemic chemotherapy — reassess for hepatic surgery after documented response",
                "Clinical trial enrolment if available (e.g. EGFR/VEGF-targeted therapy for RAS wild-type)",
                "Best supportive care and palliative care involvement early",
                "Reassess resectability after 3–4 cycles with repeat CT/PET"
            ]
            flags = ["CRS 5/5 — very poor 5-year survival; surgery not recommended without prior response to chemotherapy"]
        }

        return ClinicalScore(
            name:          "Fong Clinical Risk Score",
            score:         Double(score),
            maxScore:      5,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Fong Y et al. Ann Surg 1999;230:309. Five-variable CRS for predicting outcome after hepatic resection of colorectal liver metastases: node-positive primary, DFI <12 months, >1 hepatic tumour, largest tumour >5 cm, preoperative CEA >200 ng/mL. Score 0–5; each point progressively worsens 5-year survival (score 0 ≈60%; score 5 ≈14%). Validated in multiple external cohorts and widely used in hepato-pancreato-biliary surgical oncology decision-making."
        )
    }

    // MARK: - #101 Berlin Criteria for ARDS

    struct BerlinARDSInput: Equatable {
        var pao2FiO2Ratio: Double          // PaO₂ / FiO₂ ratio (mmHg)
        var peepOrCPAP: Int                // PEEP/CPAP applied (cmH₂O)
        var acuteOnsetWithin1Week: Bool    // onset within 1 week of clinical insult
        var bilateralOpacitiesOnImaging: Bool // not explained by effusions/collapse/nodules
        var notExplainedByCardiacFailure: Bool // not fully explained by cardiac failure/fluid overload
    }

    static func berlinARDS(_ i: BerlinARDSInput) -> ClinicalScore {
        // Berlin 2012: requires all 3 non-severity criteria first
        var qualifies = i.acuteOnsetWithin1Week && i.bilateralOpacitiesOnImaging && i.notExplainedByCardiacFailure

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        // Minimum PEEP ≥5 cmH₂O required for classification
        let peepMet = i.peepOrCPAP >= 5

        if !qualifies || !peepMet {
            risk  = .low
            interp = "Berlin criteria not fully met — ARDS not confirmed. Review onset, imaging, and cardiac/fluid status."
            recs  = [
                "Confirm acute onset within 7 days of clinical insult",
                "Ensure bilateral opacities on chest X-ray/CT (not explained by effusions, collapse or nodules)",
                "Exclude cardiac failure / fluid overload as primary cause (echocardiography if uncertain)",
                "PEEP ≥5 cmH₂O required for Berlin classification"
            ]
            return ClinicalScore(
                name:          "Berlin ARDS Criteria",
                score:         i.pao2FiO2Ratio,
                maxScore:      nil,
                risk:          risk,
                interpretation: interp,
                recommendations: recs,
                evidenceNote:  "ARDS Definition Task Force. JAMA 2012;307:2526. Berlin definition replaced the 1994 AECC criteria. Three severity categories based on PaO₂/FiO₂ with PEEP ≥5 cmH₂O: mild 200–300 mmHg (27% mortality), moderate 100–200 mmHg (32%), severe <100 mmHg (45%)."
            )
        }

        let ratio = i.pao2FiO2Ratio
        if ratio > 300 {
            risk  = .low
            interp = "PaO₂/FiO₂ \(String(format: "%.0f", ratio)) mmHg — Berlin criteria met but PF ratio >300: not ARDS. Monitor."
            recs  = ["Continue monitoring; repeat ABG if condition deteriorates"]
        } else if ratio >= 200 {
            risk  = .moderate
            interp = "Mild ARDS — PaO₂/FiO₂ \(String(format: "%.0f", ratio)) mmHg (200–300). 27% mortality."
            recs  = [
                "Lung-protective ventilation: tidal volume 6 mL/kg PBW, plateau pressure <30 cmH₂O",
                "Treat underlying cause (pneumonia, sepsis, aspiration, trauma)",
                "Daily spontaneous breathing trial when appropriate",
                "Fluid-conservative strategy after resuscitation phase",
                "Early prone positioning if condition deteriorates to moderate/severe"
            ]
        } else if ratio >= 100 {
            risk  = .high
            interp = "Moderate ARDS — PaO₂/FiO₂ \(String(format: "%.0f", ratio)) mmHg (100–200). 32% mortality."
            recs  = [
                "Lung-protective ventilation mandatory: tidal volume 4–6 mL/kg PBW",
                "PEEP optimisation — consider PEEP-FiO₂ table or oesophageal pressure monitoring",
                "Prone positioning ≥16 hours/day — mortality benefit demonstrated",
                "Neuromuscular blockade for 48 hours if persistent dyssynchrony",
                "Consider recruiting manoeuvres cautiously",
                "Treat underlying cause aggressively"
            ]
            flags = ["Moderate ARDS PF <200 — prone positioning indicated; consider NMB"]
        } else {
            risk  = .critical
            interp = "Severe ARDS — PaO₂/FiO₂ \(String(format: "%.0f", ratio)) mmHg (<100). 45% mortality."
            recs  = [
                "Mandatory lung-protective ventilation: tidal volume 4–6 mL/kg PBW",
                "Prone positioning ≥16 hours/day — mandatory for PF <150",
                "Neuromuscular blockade early (cisatracurium 48 hours)",
                "High PEEP strategy",
                "ECMO referral if PaO₂/FiO₂ <80 despite prone ventilation — consult ECMO centre",
                "Early multidisciplinary ICU review",
                "Family meeting regarding prognosis"
            ]
            flags = ["Severe ARDS PF <100 — ECMO referral threshold; mortality 45%"]
        }

        return ClinicalScore(
            name:          "Berlin ARDS Criteria",
            score:         ratio,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "ARDS Definition Task Force. JAMA 2012;307:2526. Berlin definition: acute onset <7 days, bilateral opacities not explained by effusions/collapse/nodules, respiratory failure not explained by cardiac failure/fluid overload, PEEP/CPAP ≥5 cmH₂O. Mild: PaO₂/FiO₂ 200–300 (27% mortality); Moderate 100–200 (32%); Severe <100 (45%). Replaces 1994 AECC criteria; validated in 4,188 patients from 3 multicentre cohorts."
        )
    }

    // MARK: - #102 CAGE Questionnaire (Alcohol Use Disorder Screen)

    struct CAGEInput: Equatable {
        var feltCutDown: Bool         // Ever felt you should Cut down drinking?
        var annoyedByCriticism: Bool  // People Annoyed you by criticising drinking?
        var feltGuilty: Bool          // Ever felt Guilty about drinking?
        var eyeOpener: Bool           // Ever had a drink first thing in morning (Eye-opener)?
    }

    static func cage(_ i: CAGEInput) -> ClinicalScore {
        let score = [i.feltCutDown, i.annoyedByCriticism, i.feltGuilty, i.eyeOpener].filter { $0 }.count

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case 0:
            risk  = .low
            interp = "CAGE \(score)/4 — Alcohol use disorder unlikely."
            recs  = ["Advise safe drinking limits: ≤14 units/week (spread over ≥3 days)"]
        case 1:
            risk  = .moderate
            interp = "CAGE \(score)/4 — Possible alcohol use disorder. Proceed to full AUDIT questionnaire."
            recs  = [
                "Complete AUDIT questionnaire for full assessment",
                "Brief motivational counselling regarding alcohol intake",
                "Recheck at next appointment"
            ]
        default:
            risk  = .high
            interp = "CAGE \(score)/4 — Probable alcohol use disorder (≥2 positive responses; sensitivity 71–84%, specificity 76–96%)."
            recs  = [
                "Formal alcohol use disorder assessment (AUDIT, DSM-5 criteria)",
                "Addiction medicine / alcohol liaison nurse referral",
                "Assess for alcohol dependence — withdrawal risk if admitted (use CIWA-Ar)",
                "Prescribe thiamine (vitamin B₁) before any glucose in dependent patients",
                "Consider naltrexone or acamprosate for pharmacological support",
                "Brief intervention and motivational interviewing"
            ]
            if score >= 3 {
                flags = ["CAGE ≥3 — high probability of dependence; assess withdrawal risk before any surgical admission"]
            }
        }

        return ClinicalScore(
            name:          "CAGE Questionnaire",
            score:         Double(score),
            maxScore:      4,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Ewing JA. JAMA 1984;252:1905. Four-item alcohol use disorder screening tool (Cut down, Annoyed, Guilty, Eye-opener). Score ≥2 = significant sensitivity for AUD (71–84%) and dependence (77–91%). Positive CAGE should prompt AUDIT questionnaire for full characterisation. In surgical patients, alcohol dependence markedly increases complications — thiamine, CIWA-Ar monitoring, and addiction referral before elective procedures."
        )
    }

    // MARK: - #103 Duke Criteria for Infective Endocarditis

    struct DukeInput: Equatable {
        // Major criteria
        var positiveBloodCultures: Int      // 0 = none, 1 = single typical organism, 2 = ≥2 cultures or persistent bacteraemia
        var endocardialInvolvement: Int     // 0 = none, 1 = vegetation/abscess on echo, 2 = new valve regurgitation
        // Minor criteria (each Boolean = 1 point)
        var predisposedHeartCondition: Bool // known valve disease, prosthetic valve, prior IE
        var ivDrugUse: Bool
        var feverGe38: Bool
        var vascularPhenomena: Bool         // emboli, Janeway lesions, mycotic aneurysm
        var immunologicPhenomena: Bool      // Osler nodes, Roth spots, RF positive, glomerulonephritis
        var positiveBloodCultureMinor: Bool // blood culture positive but not meeting major criteria
        var echoMinor: Bool                 // echo findings consistent with IE but not meeting major
    }

    static func dukeIE(_ i: DukeInput) -> ClinicalScore {
        let majorCount = (i.positiveBloodCultures >= 1 ? 1 : 0) + (i.endocardialInvolvement >= 1 ? 1 : 0)
        let minorCount = [i.predisposedHeartCondition, i.ivDrugUse, i.feverGe38,
                          i.vascularPhenomena, i.immunologicPhenomena,
                          i.positiveBloodCultureMinor, i.echoMinor].filter { $0 }.count

        let classification: String
        let risk: ScoreRisk
        var recs: [String]
        var flags: [String] = []

        // Duke classification rules
        if majorCount == 2 ||
           (majorCount == 1 && minorCount >= 3) ||
           minorCount >= 5 {
            classification = "DEFINITE IE"
            risk  = .critical
            recs  = [
                "Cardiology and infectious diseases urgent co-management",
                "Transoesophageal echocardiography (TOE) if TTE non-diagnostic",
                "Blood cultures × 3 sets before antibiotics if not yet collected",
                "Empirical antibiotics per local guidelines (typically vancomycin ± gentamicin)",
                "Target antibiotic therapy to blood culture organisms when available",
                "Assess for surgical indications: haemodynamic compromise, uncontrolled infection, prevention of embolism",
                "Dental focus treatment after initial antibiotic stabilisation"
            ]
            flags = ["Definite IE — urgent cardiology + ID review; assess surgical threshold"]
        } else if majorCount == 1 && minorCount == 1 {
            classification = "POSSIBLE IE"
            risk  = .high
            recs  = [
                "Repeat blood cultures × 3 sets (ideally before antibiotics if clinically stable)",
                "Transthoracic echocardiography urgently; TOE if TTE non-diagnostic",
                "Cardiology review",
                "Do not delay empirical antibiotics if patient haemodynamically unstable",
                "FDG-PET/CT or SPECT/CT if echocardiography inconclusive and prosthetic valve"
            ]
            flags = ["Possible IE — blood cultures and echo urgently required"]
        } else if majorCount == 0 && minorCount >= 1 {
            classification = "POSSIBLE IE"
            risk  = .moderate
            recs  = [
                "Blood cultures × 3 sets",
                "Transthoracic echocardiography",
                "Fever workup: urine, CXR, wound sites",
                "Cardiology review if clinical suspicion remains"
            ]
        } else {
            classification = "REJECTED (IE unlikely)"
            risk  = .low
            recs  = [
                "Seek alternative diagnosis for fever and symptoms",
                "If resolution within 4 days of antibiotics, rejection is supported",
                "Monitor clinical course — reconsider if new criteria develop"
            ]
        }

        let score = Double(majorCount * 2 + minorCount)
        return ClinicalScore(
            name:          "Duke Criteria for IE",
            score:         score,
            maxScore:      nil,
            risk:          risk,
            interpretation: "\(classification) — \(majorCount) major, \(minorCount) minor criteria met.",
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Durack DT et al. Am J Med 1994;96:200. Modified Duke Criteria (Li 2000): 2 major OR 1 major+3 minor OR 5 minor = definite IE; 1 major+1 minor OR 3 minor = possible. Major criteria: (1) typical organisms in ≥2 blood cultures / persistent bacteraemia, (2) endocardial involvement on echo / new valve regurgitation. Sensitivity ~80% for native-valve IE; lower for prosthetic or pacemaker infection — FDG-PET/CT and WBC-SPECT/CT added in 2015 ESC modification. Pathological criteria (operative/histological) provide definitive diagnosis."
        )
    }

    // MARK: - #104 mMRC Dyspnoea Scale

    struct MMRCInput: Equatable {
        var grade: Int   // 0 = no dyspnoea on strenuous exercise; to 4 = too breathless to leave house
    }

    static func mmrc(_ i: MMRCInput) -> ClinicalScore {
        let grade = max(0, min(4, i.grade))
        let risk: ScoreRisk
        let interp: String
        var recs: [String]

        switch grade {
        case 0:
            risk  = .low
            interp = "mMRC Grade 0 — Breathlessness only with strenuous exercise. No functional impairment."
            recs  = ["Maintain exercise capacity; reassess if symptoms develop"]
        case 1:
            risk  = .low
            interp = "mMRC Grade 1 — Breathless when hurrying on level ground or walking up a slight hill."
            recs  = [
                "Optimise any underlying respiratory or cardiac disease",
                "Pulmonary function tests if not done",
                "Smoking cessation counselling if smoker"
            ]
        case 2:
            risk  = .moderate
            interp = "mMRC Grade 2 — Walks slower than peers on level ground due to breathlessness, or stops after ≤15 min walking."
            recs  = [
                "Spirometry and respiratory review",
                "Consider COPD assessment (GOLD staging) if applicable",
                "Structured exercise rehabilitation programme",
                "Optimise COPD/cardiac medications"
            ]
        case 3:
            risk  = .high
            interp = "mMRC Grade 3 — Stops for breath after walking about 100 m or after a few minutes on level ground."
            recs  = [
                "Urgent respiratory / cardiology review",
                "Pulmonary rehabilitation programme (strong evidence in COPD)",
                "Home nebuliser and oxygen assessment if indicated",
                "Review all optimisable causes: bronchodilators, diuretics, anaemia correction",
                "Assess perioperative risk if surgery planned (functional capacity <4 METs)"
            ]
        default:
            risk  = .critical
            interp = "mMRC Grade 4 — Too breathless to leave house, or breathless when dressing/undressing."
            recs  = [
                "Urgent assessment of all reversible causes",
                "Home oxygen assessment (ambulatory and nocturnal oximetry)",
                "Palliative care referral for refractory breathlessness if appropriate",
                "Consider pulmonary rehabilitation even at this grade — evidence supports benefit",
                "Preoperative risk stratification: functional capacity <4 METs significantly increases perioperative cardiac risk"
            ]
        }

        return ClinicalScore(
            name:          "mMRC Dyspnoea Scale",
            score:         Double(grade),
            maxScore:      4,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Fletcher CM et al. BMJ 1959;1:257. Modified Medical Research Council scale for breathlessness: 0 (strenuous exercise only) to 4 (too breathless to leave house). Grade ≥2 used in GOLD COPD classification; grade ≥2 with CAT <10 = mMRC primary metric. Widely used in perioperative assessment to grade functional capacity. Correlates with 6-minute walk test (r = −0.65) and health-related quality of life measures."
        )
    }

    // MARK: - #105 Paediatric Trauma Score (PTS)

    struct PTSInput: Equatable {
        var weight: Int          // 0 = >20 kg (+2), 1 = 10–20 kg (+1), 2 = <10 kg (−1)
        var airway: Int          // 0 = normal (+2), 1 = maintainable (+1), 2 = unmaintainable (−1)
        var systolicBP: Int      // 0 = >90 mmHg (+2), 1 = 50–90 mmHg (+1), 2 = <50 mmHg (−1)
        var cns: Int             // 0 = awake (+2), 1 = obtunded (+1), 2 = comatose (−1)
        var openWound: Int       // 0 = none (+2), 1 = minor (+1), 2 = major/penetrating (−1)
        var fracture: Int        // 0 = none (+2), 1 = closed (+1), 2 = open/multiple (−1)
    }

    static func pts(_ i: PTSInput) -> ClinicalScore {
        let points: [[Int: Int]] = [
            [0: 2, 1: 1, 2: -1], [0: 2, 1: 1, 2: -1],
            [0: 2, 1: 1, 2: -1], [0: 2, 1: 1, 2: -1],
            [0: 2, 1: 1, 2: -1], [0: 2, 1: 1, 2: -1]
        ]
        let vals = [i.weight, i.airway, i.systolicBP, i.cns, i.openWound, i.fracture]
        var score = 0
        for (j, v) in vals.enumerated() {
            switch v {
            case 0:  score += points[j][0] ?? 0
            case 1:  score += points[j][1] ?? 0
            default: score += points[j][2] ?? 0
            }
        }
        score = max(-6, min(12, score))

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case 9...12:
            risk  = .low
            interp = "PTS \(score) — Minor/no major trauma. Low mortality risk."
            recs  = ["Standard paediatric assessment and monitoring",
                     "Reassess if clinical condition changes"]
        case 6...8:
            risk  = .moderate
            interp = "PTS \(score) — Moderate paediatric trauma. Potential for significant injury."
            recs  = ["Secondary survey for occult injuries",
                     "IV access, fluid resuscitation if haemodynamically compromised",
                     "Urgent paediatric surgical review",
                     "CT trauma protocol as clinically indicated"]
        case 0...5:
            risk  = .high
            interp = "PTS \(score) — Major paediatric trauma. High risk of significant morbidity and mortality."
            recs  = ["Immediate trauma team activation",
                     "Primary ABCDE survey — airway management priority",
                     "IV/IO access, blood transfusion protocol activation",
                     "CT trauma protocol (head, C-spine, chest, abdomen, pelvis)",
                     "Paediatric surgery + neurosurgery review",
                     "Consider transfer to paediatric major trauma centre"]
            flags = ["PTS ≤8: triage to a paediatric trauma centre when available"]
        default:
            risk  = .critical
            interp = "PTS \(score) — Critical paediatric trauma. Immediate resuscitation required."
            recs  = ["Immediate life-saving interventions (airway, haemorrhage control, decompression)",
                     "Full trauma team response",
                     "Massive transfusion protocol consideration",
                     "Urgent neurosurgical consultation if head injury",
                     "Immediate transfer to paediatric trauma centre"]
            flags = ["PTS ≤0: critical — immediate resuscitation and trauma centre transfer"]
        }

        return ClinicalScore(
            name:          "Paediatric Trauma Score (PTS)",
            score:         Double(score),
            maxScore:      12,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Tepas JJ et al. J Pediatr Surg 1987;22(1):14. PTS assesses weight, airway, systolic BP, CNS, open wound, fracture: each parameter scored +2/+1/−1. Range −6 to +12. Score ≤8 = major trauma requiring paediatric trauma centre; used as triage criterion. Comparable in predictive accuracy to the Revised Trauma Score (RTS) for paediatric populations. PTS ≤0 = 100% mortality in original series."
        )
    }

    // MARK: - #110 RIPASA Score (Right Iliac Fossa Pain / Appendicitis)

    struct RIPASAInput: Equatable {
        var male: Bool
        var age14to39: Bool          // foreign national adds 1 point
        var foreignNational: Bool
        var migratingToRIF: Bool
        var anorexia: Bool
        var nausea: Bool
        var vomiting: Bool
        var durationUnder48h: Bool
        var rofFossaTenderness: Bool
        var guarding: Bool
        var reboundTenderness: Bool
        var rovsing: Bool
        var fever37_5to38_5: Bool
        var elevatedWBC: Bool
        var abnormalUrinalysis: Bool
    }

    static func ripasa(_ i: RIPASAInput) -> ClinicalScore {
        var score = 0.0

        if i.male { score += 1.0 }
        if i.age14to39 { score += 1.0 }
        if i.foreignNational { score += 1.0 }
        if i.migratingToRIF { score += 0.5 }
        if i.anorexia { score += 1.0 }
        if i.nausea { score += 1.0 }
        if i.vomiting { score += 1.0 }
        if i.durationUnder48h { score += 1.0 }
        if i.rofFossaTenderness { score += 1.0 }
        if i.guarding { score += 2.0 }
        if i.reboundTenderness { score += 1.0 }
        if i.rovsing { score += 2.0 }
        if i.fever37_5to38_5 { score += 1.0 }
        if i.elevatedWBC { score += 1.0 }
        if i.abnormalUrinalysis { score += 1.0 }

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case ..<5.5:
            risk  = .low
            interp = String(format: "RIPASA %.1f — Low probability of appendicitis. Observe with serial assessment.", score)
            recs  = ["Observe for 4–12 hours; repeat clinical assessment",
                     "Analgesia and IV fluids as needed",
                     "Consider alternative diagnoses: ovarian pathology, mesenteric adenitis, Meckel's diverticulitis",
                     "Discharge with written advice if improving and tolerating oral fluids"]
        case 5.5..<7.5:
            risk  = .moderate
            interp = String(format: "RIPASA %.1f — Intermediate probability. Further investigation required.", score)
            recs  = ["CT abdomen with IV contrast or USS (ultrasound guided)",
                     "Serial examination 2–4 hourly",
                     "FBC, CRP, urinalysis",
                     "Surgical review",
                     "Low threshold for diagnostic laparoscopy if no imaging clarification"]
        case 7.5..<11.5:
            risk  = .high
            interp = String(format: "RIPASA %.1f — High probability of appendicitis. Surgical intervention warranted.", score)
            recs  = ["Surgical consent for laparoscopic appendicectomy",
                     "IV antibiotics (pre-operative prophylaxis): co-amoxiclav or metronidazole + gentamicin",
                     "CT abdomen if atypical features or diagnostic uncertainty",
                     "NBM — arrange operating list",
                     "IV fluids and analgesia"]
            flags = ["RIPASA ≥7.5: appendicitis probable — consult surgeon urgently"]
        default:
            risk  = .critical
            interp = String(format: "RIPASA %.1f — Very high probability / suspected perforation. Immediate intervention.", score)
            recs  = ["Emergency laparoscopic appendicectomy",
                     "IV broad-spectrum antibiotics commenced immediately (piperacillin-tazobactam or meropenem if sepsis)",
                     "Urgent CT if perforation suspected and stable enough to delay",
                     "NBM, IV fluids, analgesia, anti-emetics",
                     "ICU/HDU booking if septic shock suspected"]
            flags = ["RIPASA ≥11.5: probable perforated appendicitis — emergency surgery; IV broad-spectrum antibiotics now"]
        }

        return ClinicalScore(
            name:          "RIPASA Score",
            score:         score,
            maxScore:      16,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Chong CF et al. Singapore Med J 2010;51(3):220. RIPASA (Right Iliac Fossa Pain Assessment Score) validated in Asian and Middle Eastern populations where Alvarado under-performs. 15 parameters; score <5.5=exclude, 5.5–7.5=observe, 7.5–11.5=probable appendicitis, ≥11.5=appendicitis very probable. Sensitivity 98%, specificity 81% vs Alvarado's sensitivity 71–88% in same populations. Incorporates demographic factors (sex, age, foreign national origin) that reflect different presentations and healthcare-seeking behaviour in Asian patients."
        )
    }

    // MARK: - #111 Fournier Gangrene Severity Index (FGSI)

    struct FGSIInput: Equatable {
        var temperature: Double     // °C
        var heartRate: Int          // bpm
        var respiratoryRate: Int    // breaths/min
        var sodium: Double          // mmol/L
        var potassium: Double       // mmol/L
        var creatinine: Double      // μmol/L
        var haematocrit: Double     // %
        var wbc: Double             // ×10⁹/L
        var bicarbonate: Double     // mmol/L
    }

    static func fgsi(_ i: FGSIInput) -> ClinicalScore {
        var score = 0

        // Temperature deviation from normal (36.0–38.4 = 0)
        let tempDev = abs(i.temperature - 37.0)
        score += tempDev >= 4.0 ? 4 : (tempDev >= 2.0 ? 3 : (tempDev >= 1.0 ? 2 : (tempDev > 0.5 ? 1 : 0)))

        // Heart rate (bpm)
        score += i.heartRate < 55 ? 4 : (i.heartRate < 70 ? 3 : (i.heartRate < 110 ? 0 : (i.heartRate < 140 ? 2 : (i.heartRate < 180 ? 3 : 4))))

        // Respiratory rate (breaths/min)
        score += i.respiratoryRate < 6 ? 4 : (i.respiratoryRate < 10 ? 3 : (i.respiratoryRate < 12 ? 2 : (i.respiratoryRate < 25 ? 0 : (i.respiratoryRate < 35 ? 1 : (i.respiratoryRate < 50 ? 3 : 4)))))

        // Sodium (mmol/L)
        score += i.sodium < 111 ? 4 : (i.sodium < 122 ? 3 : (i.sodium < 132 ? 2 : (i.sodium < 152 ? 0 : (i.sodium < 162 ? 1 : (i.sodium < 172 ? 2 : (i.sodium < 182 ? 3 : 4))))))

        // Potassium (mmol/L)
        score += i.potassium < 2.5 ? 4 : (i.potassium < 3.0 ? 2 : (i.potassium < 3.5 ? 1 : (i.potassium <= 5.5 ? 0 : (i.potassium < 6.0 ? 1 : (i.potassium < 7.0 ? 3 : 4)))))

        // Creatinine (μmol/L)
        score += i.creatinine < 53 ? 3 : (i.creatinine < 107 ? 0 : (i.creatinine < 168 ? 2 : (i.creatinine < 309 ? 3 : 4)))

        // Haematocrit (%)
        score += i.haematocrit < 20 ? 4 : (i.haematocrit < 30 ? 2 : (i.haematocrit < 46 ? 0 : (i.haematocrit < 50 ? 1 : (i.haematocrit < 60 ? 2 : 4))))

        // WBC (×10⁹/L)
        score += i.wbc < 1.0 ? 4 : (i.wbc < 3.0 ? 2 : (i.wbc < 15.0 ? 0 : (i.wbc < 20.0 ? 1 : (i.wbc < 40.0 ? 2 : 4))))

        // Bicarbonate (mmol/L)
        score += i.bicarbonate < 15 ? 4 : (i.bicarbonate < 18 ? 3 : (i.bicarbonate < 22 ? 2 : (i.bicarbonate < 32 ? 0 : (i.bicarbonate < 41 ? 1 : 2))))

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if score <= 9 {
            risk  = .high
            interp = "FGSI \(score) — Lower severity Fournier gangrene. Early mortality risk ~8–15%."
            recs  = ["Emergency wide surgical debridement — do not delay",
                     "IV broad-spectrum antibiotics: carbapenem + glycopeptide + metronidazole",
                     "ICU admission",
                     "Urology or colorectal surgery involvement depending on source",
                     "Repeat debridement at 24–48 hours",
                     "Vacuum-assisted wound closure (VAC) after debridement",
                     "Consider hyperbaric oxygen therapy if available"]
            flags = ["Fournier gangrene: emergency debridement regardless of FGSI — any score is life-threatening"]
        } else {
            risk  = .critical
            interp = "FGSI \(score) — Severe Fournier gangrene. High mortality risk ≥50%."
            recs  = ["Immediate emergency debridement — prognosis worsens with every hour of delay",
                     "Aggressive ICU resuscitation: MAP ≥65 mmHg, ScvO₂ ≥70%, lactate clearance",
                     "Broad-spectrum IV antibiotics: meropenem + vancomycin + metronidazole (consider IVIG)",
                     "Multiple planned re-debridements (typically 24–48 h intervals until clean margins)",
                     "Consider faecal diversion (defunctioning colostomy) if perianal involvement",
                     "Plastic/reconstructive surgery involvement for wound reconstruction planning",
                     "Hyperbaric oxygen therapy (5–10 sessions) — reduces mortality in observational data",
                     "Early family discussion regarding prognosis"]
            flags = ["FGSI ≥9: mortality ≥50% — immediate ICU + emergency surgery; critical prognosis discussion with family"]
        }

        return ClinicalScore(
            name:          "Fournier Gangrene Severity Index (FGSI)",
            score:         Double(score),
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Laor E et al. J Urol 1995;154:89. FGSI based on the APACHE II physiological subscale: 9 parameters, each scored 0–4 deviation from normal. Original threshold FGSI >9 predicts death (sensitivity 75%, specificity 84%; mortality 73% vs 12% for ≤9 in original series). Modern series report lower mortality with aggressive ICU care but FGSI >9 still identifies high-risk cohort. Note: FGSI does not capture extent of skin involvement — the Uludag FGSI (UFGSI) adds age and extent of involvement and has higher predictive accuracy in some series."
        )
    }


}
