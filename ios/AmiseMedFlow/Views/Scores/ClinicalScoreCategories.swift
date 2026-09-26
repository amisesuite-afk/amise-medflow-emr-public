// ClinicalScoreCategories.swift
// Score category and active-score enumerations, grouping data, and filter helpers.

import SwiftUI

import SwiftUI

// MARK: - Clinical Scores & Scales Tab
// All calculations are deterministic — no AI, no network. HIPAA-safe.

// MARK: - Score category grouping

enum ScoreCategory: String, CaseIterable, Identifiable {
    var id: String { rawValue }
    case all          = "All"
    case acute        = "Acute Abdomen"
    case gi           = "GI / Endoscopy"
    case vascular     = "VTE / Vascular"
    case sepsis       = "Sepsis"
    case preop        = "Pre-op Risk"
    case neuro        = "Neuro / Stroke"
    case cardiac      = "Cardiac / AF"
    case monitoring   = "Monitoring"
}

enum ActiveScore: String, CaseIterable, Identifiable {
    var id: String { rawValue }
    case alvarado         = "Alvarado (Appendicitis)"
    case tokyoChole       = "Tokyo — Cholecystitis"
    case tokyoCholang     = "Tokyo — Cholangitis"
    case ranson           = "Ranson (Pancreatitis)"
    case glasgow          = "Glasgow (Pancreatitis)"
    case rockall          = "Rockall (GI Bleed)"
    case blatchford       = "Blatchford (GI Bleed)"
    case sirs             = "SIRS / Sepsis"
    case qsofa            = "qSOFA (Sepsis)"
    case mews             = "MEWS (Early Warning)"
    case wellsDVT         = "Wells DVT"
    case wellsPE          = "Wells PE"
    case abcd2            = "ABCD² (TIA/Stroke)"
    case gcs              = "GCS (Coma Scale)"
    case lrinec           = "LRINEC (Necrotising Fasciitis)"
    case rcri             = "RCRI (Cardiac Risk)"
    case asa              = "ASA Physical Status"
    case caprini          = "Caprini (VTE Risk)"
    case childPugh        = "Child-Pugh (Liver)"
    case meld             = "MELD-Na (Liver)"
    case cha2ds2vasc      = "CHA₂DS₂-VASc (AF Stroke)"
    case hasBled          = "HAS-BLED (Bleeding)"
    case stopBang         = "STOP-BANG (OSA)"
    case news2            = "NEWS2 (National Early Warning)"
    case psiPort          = "PSI/PORT (Pneumonia Severity)"
    case bisap            = "BISAP (Pancreatitis Severity)"
    case aims65           = "AIMS65 (UGI Bleed Mortality)"
    case sofa             = "SOFA (Organ Failure)"
    case fib4             = "FIB-4 (Liver Fibrosis)"
    case curb65           = "CURB-65 (CAP Severity)"
    case padua            = "Padua (Medical VTE Risk)"
    case apacheII         = "APACHE II (ICU Severity)"
    case ppossum          = "P-POSSUM (Surgical Risk)"
    case mpi              = "Mannheim Peritonitis Index"
    case ctsi             = "CT Severity Index (Pancreatitis)"
    case nrs2002          = "NRS-2002 (Nutritional Risk)"
    case forrest          = "Forrest Classification"
    case heart            = "HEART Score (Chest Pain)"
    case mallampati       = "Mallampati Airway Class"
    case cfs              = "Clinical Frailty Scale"
    case timi             = "TIMI (UA/NSTEMI Risk)"
    case waterlow         = "Waterlow Pressure Ulcer Risk"
    case surgicalApgar    = "Surgical Apgar Score"
    case grace            = "GRACE Score (ACS)"
    case dasi             = "DASI (Functional Capacity)"
    case barthel          = "Barthel Index (ADL)"
    case euroScoreII      = "EuroSCORE II (Cardiac Surgery)"
    case nihss            = "NIHSS (Stroke Severity)"
    case mrs              = "modified Rankin Scale (Disability)"
    case must             = "MUST (Malnutrition Risk)"
    case clavienDindo     = "Clavien-Dindo (Complication Grade)"
    case aldrete          = "Modified Aldrete (PACU Recovery)"
    case fourT            = "4T Score (HIT Probability)"
    case oakland          = "Oakland Score (LGIB Discharge)"
    case kingsCriteria    = "King's College Criteria (ALF)"
    case ecog             = "ECOG Performance Status"
    case rts              = "Revised Trauma Score"
    case kdigo            = "KDIGO AKI Staging"
    case baux             = "Baux Score"
    case iss              = "Injury Severity Score"
    case nutric           = "NUTRIC Score"
    case spesi            = "sPESI (PE Severity)"
    case decaf            = "DECAF (COPD Exacerbation)"
    case hinchey          = "Hinchey (Diverticulitis)"
    case airScore         = "AIR Score (Appendicitis)"
    case perc             = "PERC Rule (PE Rule-out)"
    case shockIndex       = "Shock Index"
    case parkland         = "Parkland Formula (Burns)"
    case pas              = "Paediatric Appendicitis Score"
    case revisedGeneva    = "Revised Geneva Score (PE)"
    case cci              = "Charlson Comorbidity Index"
    case mfi5             = "Modified Frailty Index-5"
    case haps             = "Harmless Acute Pancreatitis Score"
    case glasgowImrie     = "Glasgow-Imrie Score"
    case albi             = "ALBI Score (Liver)"
    case auditC           = "AUDIT-C (Alcohol Screen)"
    case phq9             = "PHQ-9 (Depression)"
    case sapsII           = "SAPS II (ICU Severity)"
    // The local 0–6 stone CT features score (formerly shown as "STONE"); the published STONE score
    // (Moore 2014) is `stoneUreteric`. Case name kept: it is the calculator's form state key.
    case stone            = "Stone CT Features (local 0–6, not STONE)"
    case losAngeles       = "LA Classification (GERD)"
    case meld3            = "MELD 3.0 (Liver Severity)"
    case braden           = "Braden Scale (Pressure Injury)"
    case centor           = "Centor / McIsaac (Pharyngitis)"
    case ipss             = "IPSS (Prostate Symptoms)"
    case trueloveWitts    = "Truelove-Witts (UC Severity)"
    case harveyBradshaw   = "Harvey-Bradshaw Index (Crohn's)"
    case maddrey          = "Maddrey Discriminant Function (Alcoholic Hepatitis)"
    case manning          = "Manning Criteria (IBS)"
    case lace             = "LACE Index (Readmission Risk)"
    case findRisc         = "FINDRISC (T2DM Risk)"
    case mirels           = "Mirels Criteria (Pathological Fracture)"
    case ckdEpi           = "CKD-EPI eGFR (Renal Staging)"
    case ariscat          = "ARISCAT (Pulmonary Complication Risk)"
    case fongCrs          = "Fong CRS (Colorectal Liver Mets)"
    case berlinARDS       = "Berlin Definition (ARDS)"
    case cage             = "CAGE Questionnaire (Alcohol Use Disorder)"
    case dukeIE           = "Duke Criteria (Infective Endocarditis)"
    case mmrc             = "mMRC Dyspnoea Scale"
    case pts              = "Paediatric Trauma Score (PTS)"
    case ripasa           = "RIPASA (Appendicitis Score)"
    case fgsi             = "FGSI (Fournier Gangrene)"
    // Decision rules with an entry in clinical-content/rules/decision-rules.json (ios.activeScore);
    // ClinicalScoringEngine+DecisionRules*.swift, ClinicalScoresView+DecisionRuleForms.swift.
    case stoneUreteric    = "STONE Score (Ureteric Stone)"
    case ottawaAnkle      = "Ottawa Ankle and Foot Rules"
    case ottawaKnee       = "Ottawa Knee Rule"
    case canadianCTHead   = "Canadian CT Head Rule"
    case nexus            = "NEXUS C-Spine Criteria"
    case canadianCSpine   = "Canadian C-Spine Rule"
    case sfSyncope        = "San Francisco Syncope Rule"
    case canadianSyncope  = "Canadian Syncope Risk Score"

    var category: ScoreCategory {
        switch self {
        case .alvarado, .tokyoChole, .tokyoCholang, .ranson, .glasgow, .bisap, .mpi, .ctsi:
            return .acute
        case .rockall, .blatchford, .aims65, .forrest:
            return .gi
        case .wellsDVT, .wellsPE, .caprini, .padua:
            return .vascular
        case .sirs, .qsofa, .psiPort, .sofa, .curb65, .apacheII:
            return .sepsis
        case .asa, .childPugh, .meld, .stopBang, .fib4, .ppossum, .nrs2002, .mallampati, .cfs, .barthel:
            return .preop
        case .abcd2, .lrinec, .gcs, .nihss, .mrs:
            return .neuro
        case .must:
            return .preop
        case .clavienDindo, .aldrete:
            return .preop
        case .fourT:
            return .vascular
        case .oakland:
            return .gi
        case .kingsCriteria:
            return .gi
        case .ecog:
            return .preop
        case .rts:
            return .acute
        case .kdigo:
            return .sepsis
        case .baux:
            return .acute
        case .iss:
            return .acute
        case .nutric:
            return .sepsis
        case .spesi:
            return .vascular
        case .decaf:
            return .sepsis
        case .hinchey:
            return .acute
        case .airScore:
            return .acute
        case .perc:
            return .vascular
        case .shockIndex:
            return .cardiac
        case .parkland:
            return .acute
        case .pas:
            return .acute
        case .revisedGeneva:
            return .vascular
        case .cci, .mfi5:
            return .preop
        case .haps, .glasgowImrie:
            return .gi
        case .albi:
            return .gi
        case .auditC:
            return .gi
        case .phq9:
            return .monitoring
        case .sapsII:
            return .sepsis
        case .stone:
            return .acute
        case .losAngeles:
            return .gi
        case .meld3:
            return .gi
        case .braden:
            return .monitoring
        case .centor:
            return .sepsis
        case .ipss:
            return .monitoring
        case .trueloveWitts:
            return .gi
        case .harveyBradshaw:
            return .gi
        case .maddrey:
            return .gi
        case .manning:
            return .gi
        case .lace:
            return .monitoring
        case .findRisc:
            return .monitoring
        case .mirels:
            return .preop
        case .ckdEpi:
            return .monitoring
        case .ariscat:
            return .preop
        case .fongCrs:
            return .gi
        case .berlinARDS:
            return .sepsis
        case .cage:
            return .monitoring
        case .dukeIE:
            return .cardiac
        case .mmrc:
            return .sepsis
        case .pts, .ripasa:
            return .acute
        case .fgsi:
            return .sepsis
        case .stoneUreteric, .ottawaAnkle, .ottawaKnee:
            return .acute
        case .canadianCTHead, .nexus, .canadianCSpine:
            return .neuro
        case .sfSyncope, .canadianSyncope:
            return .cardiac
        case .cha2ds2vasc, .hasBled, .heart, .timi, .grace, .rcri, .dasi, .euroScoreII:
            return .cardiac
        case .mews, .news2, .waterlow, .surgicalApgar:
            return .monitoring
        }
    }

    var icon: String {
        switch self {
        case .alvarado:       return "bandage"
        case .tokyoChole:     return "drop.fill"
        case .tokyoCholang:   return "drop.halffull"
        case .ranson, .glasgow: return "flame"
        case .rockall:        return "scope"
        case .blatchford:     return "drop.triangle"
        case .sirs, .qsofa:   return "thermometer.medium"
        case .mews:           return "waveform.path.ecg.rectangle"
        case .news2:          return "waveform.path.ecg.rectangle.fill"
        case .wellsDVT, .wellsPE, .caprini: return "heart.fill"
        case .abcd2:          return "brain.head.profile"
        case .gcs:            return "eye"
        case .lrinec:         return "cross.case.fill"
        case .rcri:           return "waveform.path.ecg"
        case .asa:            return "person.badge.shield.checkmark"
        case .childPugh:      return "staroflife"
        case .meld:           return "staroflife.fill"
        case .cha2ds2vasc:    return "heart.circle"
        case .hasBled:        return "bandage.fill"
        case .stopBang:       return "moon.zzz"
        case .psiPort:        return "lungs"
        case .bisap:          return "flame.fill"
        case .aims65:         return "drop.triangle.fill"
        case .sofa:           return "bolt.heart.fill"
        case .fib4:           return "liver"
        case .curb65:         return "lungs.fill"
        case .padua:          return "figure.walk"
        case .apacheII:       return "cross.circle.fill"
        case .ppossum:        return "scissors"
        case .mpi:            return "cross.circle"
        case .ctsi:           return "photo.on.rectangle"
        case .nrs2002:        return "fork.knife"
        case .forrest:        return "eye.circle"
        case .heart:          return "heart.text.clipboard"
        case .mallampati:     return "mouth"
        case .cfs:            return "figure.walk.circle"
        case .timi:           return "waveform.path.ecg.rectangle"
        case .waterlow:       return "bed.double"
        case .surgicalApgar:  return "cross.case"
        case .grace:          return "chart.line.uptrend.xyaxis"
        case .dasi:           return "figure.run"
        case .barthel:        return "figure.roll"
        case .euroScoreII:    return "heart.text.clipboard.fill"
        case .nihss:          return "brain"
        case .mrs:            return "figure.roll"
        case .must:           return "fork.knife.circle"
        case .clavienDindo:   return "bandage.fill"
        case .aldrete:        return "bed.double.fill"
        case .fourT:          return "syringe.fill"
        case .oakland:        return "drop.degreesign.fill"
        case .kingsCriteria:  return "staroflife.circle.fill"
        case .ecog:           return "figure.stand"
        case .rts:            return "cross.case.circle.fill"
        case .kdigo:          return "drop.circle.fill"
        case .baux:           return "flame.circle.fill"
        case .iss:            return "bandage.fill"
        case .nutric:         return "fork.knife.circle.fill"
        case .spesi:          return "lungs.fill"
        case .decaf:          return "wind"
        case .hinchey:        return "cross.circle.fill"
        case .airScore:       return "allergens"
        case .perc:           return "checkmark.shield.fill"
        case .shockIndex:     return "bolt.heart.fill"
        case .parkland:       return "drop.triangle.fill"
        case .pas:            return "figure.child"
        case .revisedGeneva:  return "lungs"
        case .cci:            return "list.bullet.clipboard.fill"
        case .mfi5:           return "figure.walk.motion"
        case .haps:           return "flame.fill"
        case .glasgowImrie:   return "thermometer.sun.fill"
        case .albi:           return "drop.circle"
        case .auditC:         return "wineglass"
        case .phq9:           return "brain.head.profile"
        case .sapsII:         return "waveform.path.ecg.rectangle"
        case .stone:          return "diamond"
        case .losAngeles:     return "flame"
        case .meld3:          return "liver"
        case .braden:         return "bed.double"
        case .centor:         return "microbe"
        case .ipss:           return "drop.degreesign"
        case .trueloveWitts:  return "flame.circle"
        case .harveyBradshaw: return "chart.bar.xaxis"
        case .maddrey:        return "drop.triangle"
        case .manning:        return "list.bullet.clipboard"
        case .lace:           return "arrow.clockwise.heart"
        case .findRisc:       return "chart.line.uptrend.xyaxis"
        case .mirels:         return "figure.walk.broken"
        case .ckdEpi:         return "kidney"
        case .ariscat:        return "lungs"
        case .fongCrs:        return "cross.case"
        case .berlinARDS:     return "lungs.fill"
        case .cage:           return "wineglass.fill"
        case .dukeIE:         return "stethoscope"
        case .mmrc:           return "figure.walk.motion"
        case .pts:            return "cross.circle.fill"
        case .ripasa:         return "allergens"
        case .fgsi:           return "exclamationmark.triangle.fill"
        case .stoneUreteric:  return "drop.degreesign"
        case .ottawaAnkle:    return "figure.walk"
        case .ottawaKnee:     return "figure.walk.circle"
        case .canadianCTHead: return "brain.head.profile"
        case .nexus:          return "figure.stand"
        case .canadianCSpine: return "figure.stand"
        case .sfSyncope:      return "waveform.path.ecg"
        case .canadianSyncope: return "heart.text.clipboard"
        }
    }
}
