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
}
