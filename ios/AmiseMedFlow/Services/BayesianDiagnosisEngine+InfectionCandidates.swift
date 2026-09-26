// BayesianDiagnosisEngine+InfectionCandidates.swift
// Infection / Sepsis / Soft Tissue differential candidate tables

import Foundation

extension BayesianDiagnosisEngine {


    // MARK: - Fever / Infection (Caribbean-weighted)

    static let feverInfection: [Candidate] = [
        .init(name: "Dengue Fever", icd: "A90",
              logPrior: 35, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Severe", logLR: 8, evidenceLabel: "Severe pain"),
            .init(key: "associations", value: "Bone pain", logLR: 14, evidenceLabel: "Bone/joint pain"),
            .init(key: "associations", value: "Rash", logLR: 12, evidenceLabel: "Rash"),
            .init(key: "associations", value: "Headache", logLR: 8, evidenceLabel: "Headache"),
            .init(key: "associations", value: "Retroorbital pain", logLR: 14, evidenceLabel: "Retroorbital pain"),
            .init(key: "exam", value: "petechiae", logLR: 14, evidenceLabel: "Petechiae"),
            .init(key: "inv", value: "thrombocytopenia", logLR: 14, evidenceLabel: "Thrombocytopenia"),
            .init(key: "inv", value: "platelet", logLR: 10, evidenceLabel: "Low platelets"),
            .init(key: "inv", value: "ns1", logLR: 18, evidenceLabel: "NS1 antigen positive"),
            .init(key: "inv", value: "dengue", logLR: 18, evidenceLabel: "Dengue serology positive"),
        ]),
        .init(name: "Community-Acquired Pneumonia", icd: "J18.9",
              logPrior: 25, features: [
            .init(key: "associations", value: "Cough", logLR: 10, evidenceLabel: "Cough"),
            .init(key: "character", value: "Sharp", logLR: 6, evidenceLabel: "Pleuritic pain"),
            .init(key: "exam", value: "crepitation", logLR: 12, evidenceLabel: "Crepitations"),
            .init(key: "exam", value: "consolidation", logLR: 14, evidenceLabel: "Consolidation"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Raised WBC"),
            .init(key: "age_over", value: "65", logLR: 6, evidenceLabel: "Elderly"),
        ]),
        .init(name: "Urinary Tract Infection", icd: "N39.0",
              logPrior: 20, features: [
            .init(key: "associations", value: "Dysuria", logLR: 14, evidenceLabel: "Dysuria"),
            .init(key: "associations", value: "Frequency", logLR: 10, evidenceLabel: "Frequency"),
            .init(key: "site", value: "Suprapubic", logLR: 8, evidenceLabel: "Suprapubic discomfort"),
            .init(key: "associations", value: "Haematuria", logLR: 8, evidenceLabel: "Haematuria"),
            .init(key: "inv", value: "leucocyte", logLR: 12, evidenceLabel: "Leucocytes on urine dip"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex (higher prevalence)"),
        ]),
        .init(name: "Leptospirosis", icd: "A27.9",
              logPrior: 15, features: [
            .init(key: "associations", value: "Jaundice", logLR: 10, evidenceLabel: "Jaundice"),
            .init(key: "associations", value: "Headache", logLR: 6, evidenceLabel: "Headache"),
            .init(key: "associations", value: "Myalgia", logLR: 10, evidenceLabel: "Severe myalgia"),
            .init(key: "associations", value: "Conjunctival injection", logLR: 12, evidenceLabel: "Conjunctival suffusion"),
            .init(key: "pmh", value: "water exposure", logLR: 12, evidenceLabel: "Water/animal exposure"),
            .init(key: "inv", value: "leptospira", logLR: 18, evidenceLabel: "Leptospira serology"),
            .init(key: "inv", value: "alt", logLR: 8, evidenceLabel: "Elevated ALT"),
            .init(key: "inv", value: "creatinine", logLR: 8, evidenceLabel: "Elevated creatinine"),
        ]),
        .init(name: "Typhoid Fever", icd: "A01.00",
              logPrior: 12, features: [
            .init(key: "onset", value: "Gradual", logLR: 8, evidenceLabel: "Gradual onset"),
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Step-ladder fever"),
            .init(key: "associations", value: "Anorexia", logLR: 6, evidenceLabel: "Anorexia"),
            .init(key: "associations", value: "Constipation", logLR: 6, evidenceLabel: "Early constipation"),
            .init(key: "associations", value: "Diarrhoea", logLR: 6, evidenceLabel: "Later diarrhoea"),
            .init(key: "exam", value: "rose spots", logLR: 14, evidenceLabel: "Rose spots"),
            .init(key: "exam", value: "hepatosplenomegaly", logLR: 10, evidenceLabel: "Hepatosplenomegaly"),
            .init(key: "inv", value: "widal", logLR: 12, evidenceLabel: "Widal positive"),
        ]),
        .init(name: "Cellulitis / SSTI", icd: "L03.90",
              logPrior: 15, features: [
            .init(key: "exam", value: "erythema", logLR: 14, evidenceLabel: "Erythema"),
            .init(key: "exam", value: "warm", logLR: 10, evidenceLabel: "Warmth"),
            .init(key: "exam", value: "swelling", logLR: 10, evidenceLabel: "Swelling"),
            .init(key: "exam", value: "tender", logLR: 8, evidenceLabel: "Tenderness"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Elevated WBC"),
            .init(key: "inv", value: "crp", logLR: 8, evidenceLabel: "Elevated CRP"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes (risk factor)"),
        ]),
    ]

    // MARK: - Wound infection / surgical site

    static let woundInfection: [Candidate] = [
        .init(name: "Surgical Site Infection (SSI)", icd: "T81.40XA",
              logPrior: 35, features: [
            .init(key: "associations", value: "Discharge", logLR: 16, evidenceLabel: "Wound discharge"),
            .init(key: "associations", value: "Redness", logLR: 12, evidenceLabel: "Wound erythema"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Systemic fever"),
            .init(key: "exam", value: "erythema", logLR: 12, evidenceLabel: "Perioperative erythema"),
            .init(key: "exam", value: "swelling", logLR: 10, evidenceLabel: "Wound swelling"),
            .init(key: "exam", value: "fluctuant", logLR: 14, evidenceLabel: "Fluctuant collection"),
            .init(key: "pshx", value: "surgery", logLR: 16, evidenceLabel: "Recent surgery"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes (risk factor)"),
        ]),
        .init(name: "Wound Dehiscence", icd: "T81.31XA",
              logPrior: 10, features: [
            .init(key: "associations", value: "Burst", logLR: 18, evidenceLabel: "Wound burst / opening"),
            .init(key: "associations", value: "Pink tissue visible", logLR: 16, evidenceLabel: "Viscera visible"),
            .init(key: "pshx", value: "laparotomy", logLR: 14, evidenceLabel: "Midline laparotomy"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "malnutrition", logLR: 8, evidenceLabel: "Malnutrition"),
            .init(key: "pmh", value: "steroid", logLR: 8, evidenceLabel: "Steroid use"),
        ]),
        .init(name: "Mesh Infection (Post-Hernioplasty)", icd: "T85.698A",
              logPrior: 8, features: [
            .init(key: "pshx", value: "hernia", logLR: 16, evidenceLabel: "Previous hernia repair"),
            .init(key: "pshx", value: "mesh", logLR: 18, evidenceLabel: "Mesh implant"),
            .init(key: "associations", value: "Sinus", logLR: 14, evidenceLabel: "Persistent sinus"),
            .init(key: "associations", value: "Discharge", logLR: 12, evidenceLabel: "Purulent discharge"),
            .init(key: "timing", value: "Months", logLR: 10, evidenceLabel: "Delayed presentation (months)"),
        ]),
    ]

    // MARK: - Sepsis / SIRS

    static let sepsisConditions: [Candidate] = [
        .init(name: "Sepsis (Intra-abdominal Source)", icd: "A41.9",
              logPrior: 30, features: [
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever >38°C"),
            .init(key: "associations", value: "Tachycardia", logLR: 10, evidenceLabel: "Heart rate >90"),
            .init(key: "associations", value: "Hypotension", logLR: 16, evidenceLabel: "SBP <100 mmHg"),
            .init(key: "associations", value: "Confusion", logLR: 12, evidenceLabel: "Altered mentation"),
            .init(key: "associations", value: "Oliguria", logLR: 12, evidenceLabel: "Urine output <0.5 mL/kg/h"),
            .init(key: "exam", value: "periton", logLR: 12, evidenceLabel: "Peritonism"),
            .init(key: "inv", value: "lactate", logLR: 16, evidenceLabel: "Lactate ≥2 mmol/L"),
            .init(key: "inv", value: "wbc", logLR: 10, evidenceLabel: "WBC >12 or <4 ×10⁹/L"),
            .init(key: "inv", value: "crp", logLR: 8, evidenceLabel: "Elevated CRP"),
            .init(key: "pmh", value: "diabetes", logLR: 6, evidenceLabel: "Diabetes (risk factor)"),
            .init(key: "age_over", value: "65", logLR: 6, evidenceLabel: "Elderly"),
        ]),
        .init(name: "Septic Shock", icd: "R65.21",
              logPrior: 12, features: [
            .init(key: "associations", value: "Hypotension", logLR: 18, evidenceLabel: "MAP <65 mmHg despite resuscitation"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever or hypothermia"),
            .init(key: "associations", value: "Confusion", logLR: 14, evidenceLabel: "Encephalopathy"),
            .init(key: "associations", value: "Oliguria", logLR: 14, evidenceLabel: "Oliguria / renal failure"),
            .init(key: "inv", value: "lactate", logLR: 20, evidenceLabel: "Lactate ≥4 mmol/L"),
            .init(key: "inv", value: "creatinine", logLR: 10, evidenceLabel: "Rising creatinine"),
            .init(key: "inv", value: "blood culture", logLR: 14, evidenceLabel: "Positive blood cultures"),
        ]),
        .init(name: "Ascending Cholangitis (Sepsis)", icd: "K83.0",
              logPrior: 20, features: [
            .init(key: "associations", value: "Jaundice", logLR: 14, evidenceLabel: "Jaundice — Charcot's triad"),
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever — Charcot's triad"),
            .init(key: "site", value: "Right upper quadrant", logLR: 12, evidenceLabel: "RUQ pain — Charcot's triad"),
            .init(key: "associations", value: "Confusion", logLR: 14, evidenceLabel: "Confusion — Reynolds' pentad"),
            .init(key: "associations", value: "Hypotension", logLR: 14, evidenceLabel: "Shock — Reynolds' pentad"),
            .init(key: "inv", value: "bili", logLR: 12, evidenceLabel: "Raised bilirubin"),
            .init(key: "inv", value: "alp", logLR: 10, evidenceLabel: "Raised ALP"),
            .init(key: "pmh", value: "gallstone", logLR: 12, evidenceLabel: "Gallstone history"),
        ]),
        .init(name: "Urosepsis", icd: "A41.51",
              logPrior: 18, features: [
            .init(key: "associations", value: "Dysuria", logLR: 10, evidenceLabel: "Dysuria / LUTS"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Loin pain", logLR: 10, evidenceLabel: "Loin / renal angle pain"),
            .init(key: "exam", value: "renal angle", logLR: 12, evidenceLabel: "Renal angle tenderness"),
            .init(key: "inv", value: "leucocyte", logLR: 12, evidenceLabel: "Leucocytes on urine dip"),
            .init(key: "inv", value: "nitrite", logLR: 10, evidenceLabel: "Nitrites on urine dip"),
            .init(key: "pmh", value: "uti", logLR: 8, evidenceLabel: "Recurrent UTI history"),
            .init(key: "sex_female", value: "", logLR: 4, evidenceLabel: "Female sex"),
        ]),
    ]

    // MARK: - Necrotising Soft Tissue Infection

    static let necrotizingInfection: [Candidate] = [
        .init(name: "Necrotising Fasciitis", icd: "M72.6",
              logPrior: 20, features: [
            .init(key: "onset", value: "Rapid", logLR: 12, evidenceLabel: "Rapid progression (hours)"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain disproportionate to appearance"),
            .init(key: "exam", value: "crepitus", logLR: 20, evidenceLabel: "Crepitus (gas in tissue)"),
            .init(key: "exam", value: "skin necrosis", logLR: 18, evidenceLabel: "Skin necrosis / bullae"),
            .init(key: "exam", value: "dishwater fluid", logLR: 18, evidenceLabel: "Thin grey / dishwater discharge"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever / systemic toxicity"),
            .init(key: "associations", value: "Hypotension", logLR: 14, evidenceLabel: "Haemodynamic instability"),
            .init(key: "inv", value: "crp", logLR: 14, evidenceLabel: "CRP >150 mg/L (LRINEC)"),
            .init(key: "inv", value: "wbc", logLR: 10, evidenceLabel: "WBC >15 ×10⁹/L"),
            .init(key: "inv", value: "gas", logLR: 20, evidenceLabel: "Gas in soft tissue on CT"),
            .init(key: "pmh", value: "diabetes", logLR: 10, evidenceLabel: "Diabetes (key risk factor)"),
            .init(key: "pmh", value: "immunosuppression", logLR: 8, evidenceLabel: "Immunosuppression"),
        ]),
        .init(name: "Fournier's Gangrene", icd: "N49.3",
              logPrior: 10, features: [
            .init(key: "site", value: "Scrotum", logLR: 20, evidenceLabel: "Scrotal / perineal involvement"),
            .init(key: "site", value: "Perineum", logLR: 18, evidenceLabel: "Perineal necrosis"),
            .init(key: "onset", value: "Rapid", logLR: 12, evidenceLabel: "Rapid onset"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain"),
            .init(key: "exam", value: "crepitus", logLR: 20, evidenceLabel: "Perineal crepitus"),
            .init(key: "exam", value: "swelling", logLR: 10, evidenceLabel: "Scrotal swelling and erythema"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "pmh", value: "diabetes", logLR: 14, evidenceLabel: "Diabetes (major risk factor)"),
            .init(key: "sex_male", value: "", logLR: 10, evidenceLabel: "Male sex (10:1 ratio)"),
        ]),
        .init(name: "Severe Cellulitis / SSTI", icd: "L03.90",
              logPrior: 30, features: [
            .init(key: "onset", value: "Gradual", logLR: 6, evidenceLabel: "Gradual onset over days"),
            .init(key: "exam", value: "erythema", logLR: 12, evidenceLabel: "Demarcated erythema"),
            .init(key: "exam", value: "warm", logLR: 10, evidenceLabel: "Warmth"),
            .init(key: "exam", value: "tender", logLR: 8, evidenceLabel: "Tenderness"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Systemic fever"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Elevated WBC"),
            .init(key: "pmh", value: "diabetes", logLR: 6, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "lymphoedema", logLR: 10, evidenceLabel: "Lymphoedema / venous disease"),
        ]),
        .init(name: "Gas Gangrene (Clostridial Myonecrosis)", icd: "A48.0",
              logPrior: 6, features: [
            .init(key: "onset", value: "Sudden", logLR: 12, evidenceLabel: "Sudden onset, rapid progression"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Extreme pain"),
            .init(key: "exam", value: "crepitus", logLR: 20, evidenceLabel: "Crepitus in muscle"),
            .init(key: "exam", value: "bronze skin", logLR: 16, evidenceLabel: "Bronze / mottled skin discolouration"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Systemic toxicity"),
            .init(key: "pshx", value: "surgery", logLR: 10, evidenceLabel: "Recent surgery or trauma"),
            .init(key: "pmh", value: "vascular", logLR: 8, evidenceLabel: "Vascular disease"),
        ]),
    ]

}
