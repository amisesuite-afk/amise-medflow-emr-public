// ClinicalScoringEngine+InputStructs2.swift
// Input structs: WellsDVTInput, WellsPEInput, ABCD2Input, LRINECInput,
// RCRIInput, CapriniInput, ChildPughInput, MEWSInput, NEWS2Input, GCSInput,
// ASAInput, MELDInput, CHA2DS2VAScInput, HASBLEDInput, BlatchfordInput,
// STOPBANGInput, CURB65Input, PaduaInput.

import Foundation

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
    // SpO₂ Scale 2 ONLY for confirmed hypercapnic respiratory failure, on a clinician's decision
    // (RCP NEWS2 2017). Default Scale 1 — supplemental O₂ alone does not switch the scale.
    var useSpO2Scale2: Bool = false
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
