// ClinicalScoringEngine+InputStructs1.swift
// Input structs: AlvaradoInput, TokyoCholecystitisInput, TokyoCholangitisInput,
// RansonInput, GlasgowPancreatitisInput, RockallInput, SIRSInput, QSOFAInput.

import Foundation

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
