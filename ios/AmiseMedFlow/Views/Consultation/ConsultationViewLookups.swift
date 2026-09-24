// ConsultationViewLookups.swift
// Cross-class allergy rules, PMH→Ix map, PMH→medication map, CC→investigations lookup.

import SwiftUI
import SwiftData

// MARK: - Cross-class allergy exclusion rules
// Returns true if a drug name should be excluded given the patient's allergy list.
// Handles drug class cross-reactivity (penicillin → all beta-lactams, etc.)
func crossClassAllergyExcludes(_ drug: String, allergies: [AllergyEntry]) -> Bool {
    let d = drug.lowercased()
    for allergy in allergies {
        let a = allergy.name.lowercased()
        // Direct name match
        if d.contains(a) || a.contains(d) { return true }
        // Penicillin allergy → exclude all beta-lactams
        if a.contains("penicillin") || a.contains("amoxicillin") || a.contains("co-amoxiclav") {
            let betaLactams = ["amoxicillin", "ampicillin", "flucloxacillin", "piperacillin",
                               "co-amoxiclav", "augmentin", "cephalexin", "cefalexin",
                               "cefazolin", "cefuroxime", "ceftriaxone", "ertapenem", "meropenem"]
            if betaLactams.contains(where: { d.contains($0) }) { return true }
        }
        // NSAID allergy/intolerance → exclude all NSAIDs
        if a.contains("nsaid") || a.contains("aspirin") || a.contains("ibuprofen") || a.contains("naproxen") || a.contains("diclofenac") {
            let nsaids = ["ibuprofen", "naproxen", "diclofenac", "indomethacin",
                          "celecoxib", "etoricoxib", "meloxicam", "ketorolac", "piroxicam"]
            if nsaids.contains(where: { d.contains($0) }) { return true }
        }
        // Sulfonamide allergy → exclude sulpha drugs
        if a.contains("sulfonamide") || a.contains("sulfamethoxazole") || a.contains("sulpha") {
            let sulpha = ["trimethoprim", "cotrimoxazole", "co-trimoxazole", "sulfamethoxazole",
                          "sulfasalazine", "sulphasalazine"]
            if sulpha.contains(where: { d.contains($0) }) { return true }
        }
        // Codeine allergy → exclude opioids with similar structure
        if a.contains("codeine") || a.contains("morphine") {
            let opioids = ["codeine", "dihydrocodeine", "tramadol"]
            if opioids.contains(where: { d.contains($0) }) { return true }
        }
    }
    return false
}


// MARK: - PMH → Investigations deterministic map

let pmhInvestigations: [String: [CCInv]] = [
    "Hypertension":            [("U&E", .blood), ("Creatinine / eGFR", .blood), ("ECG", .other),
                                ("Urinalysis", .blood), ("Fasting lipids", .blood)],
    "T2DM":                    [("HbA1c", .blood), ("Fasting glucose", .blood), ("U&E", .blood),
                                ("Fasting lipids", .blood), ("eGFR / Creatinine", .blood),
                                ("Urinary ACR", .blood), ("ECG", .other)],
    "T1DM":                    [("HbA1c", .blood), ("Fasting glucose", .blood), ("U&E", .blood), ("eGFR", .blood)],
    "Ischaemic heart disease": [("ECG", .other), ("Troponin", .blood), ("FBC", .blood),
                                ("Fasting lipids", .blood), ("Echocardiogram", .imaging)],
    "Atrial fibrillation":     [("ECG", .other), ("TFT", .blood), ("INR", .blood),
                                ("Echocardiogram", .imaging), ("U&E", .blood)],
    "Heart failure":           [("BNP / NT-proBNP", .blood), ("ECG", .other), ("FBC", .blood),
                                ("U&E", .blood), ("Echocardiogram", .imaging), ("CXR", .imaging)],
    "CKD":                     [("U&E", .blood), ("eGFR / Creatinine", .blood), ("FBC", .blood),
                                ("Phosphate", .blood), ("PTH", .blood), ("Urinalysis", .blood)],
    "Liver disease / Cirrhosis": [("LFT", .blood), ("INR / coagulation", .blood), ("FBC", .blood),
                                  ("Albumin", .blood), ("USS abdomen", .imaging)],
    "COPD":                    [("Spirometry", .other), ("CXR", .imaging), ("FBC", .blood), ("ABG", .blood)],
    "Asthma":                  [("Spirometry / PEFR", .other), ("CXR", .imaging), ("FBC", .blood)],
    "Malignancy":              [("FBC", .blood), ("LFT", .blood), ("U&E", .blood), ("Albumin", .blood),
                                ("CRP / ESR", .blood), ("CT chest/abdomen/pelvis", .imaging)],
    "DVT / PE":                [("INR", .blood), ("Anti-Xa", .blood), ("USS Doppler legs", .imaging),
                                ("CTPA", .imaging), ("FBC", .blood), ("D-dimer", .blood)],
    "Anaemia":                 [("FBC", .blood), ("Iron studies", .blood), ("B12 / Folate", .blood),
                                ("Reticulocytes", .blood), ("Blood film", .pathology)],
    "Rheumatoid arthritis":    [("FBC", .blood), ("CRP / ESR", .blood), ("LFT", .blood),
                                ("Rheumatoid factor", .blood), ("Anti-CCP", .blood)],
    "Thyroid disease":         [("TFT", .blood), ("TSH", .blood), ("Thyroid USS", .imaging)],
    "OSA":                     [("Sleep study / oximetry", .other), ("ABG", .blood), ("CXR", .imaging)],
]


// MARK: - PMH → common medication deterministic map
// Drug names must match ClinicalSearchService.searchDrugs() entries exactly.
let pmhToCommonMeds: [String: [String]] = [
    "Hypertension":              ["Amlodipine", "Lisinopril", "Atenolol", "Hydrochlorothiazide", "Ramipril"],
    "T2DM":                      ["Metformin", "Gliclazide", "Sitagliptin", "Empagliflozin", "Insulin glargine"],
    "T1DM":                      ["Insulin glargine", "Insulin aspart", "Metformin"],
    "Ischaemic heart disease":   ["Aspirin", "Atorvastatin", "Bisoprolol", "GTN spray", "Clopidogrel"],
    "Atrial fibrillation":       ["Apixaban", "Warfarin", "Bisoprolol", "Digoxin", "Rivaroxaban"],
    "Heart failure":             ["Furosemide", "Spironolactone", "Ramipril", "Bisoprolol", "Eplerenone"],
    "Stroke / TIA":              ["Aspirin", "Clopidogrel", "Atorvastatin", "Ramipril"],
    "CKD":                       ["Furosemide", "Amlodipine", "Calcium carbonate", "Alfacalcidol", "Erythropoietin"],
    "COPD":                      ["Salbutamol", "Tiotropium", "Salmeterol", "Prednisolone", "Ipratropium"],
    "Asthma":                    ["Salbutamol", "Beclomethasone inhaler", "Montelukast", "Prednisolone"],
    "Liver disease / Cirrhosis": ["Spironolactone", "Furosemide", "Lactulose", "Rifaximin", "Propranolol"],
    "Peptic ulcer disease":      ["Omeprazole", "Amoxicillin", "Clarithromycin", "Metronidazole"],
    "GORD / Reflux":             ["Omeprazole", "Lansoprazole", "Ranitidine", "Gaviscon"],
    "IBD (Crohn's / UC)":        ["Mesalazine", "Prednisolone", "Azathioprine", "Budesonide"],
    "Malignancy":                ["Dexamethasone", "Ondansetron", "Morphine", "Omeprazole"],
    "Thyroid disease":           ["Levothyroxine", "Carbimazole", "Propranolol"],
    "DVT / PE":                  ["Apixaban", "Rivaroxaban", "Warfarin", "Enoxaparin"],
    "Anaemia":                   ["Ferrous sulfate", "Folic acid", "Hydroxocobalamin"],
    "Epilepsy":                  ["Levetiracetam", "Sodium valproate", "Carbamazepine", "Lamotrigine"],
    "Depression / Anxiety":      ["Sertraline", "Fluoxetine", "Amitriptyline", "Diazepam"],
    "Rheumatoid arthritis":      ["Methotrexate", "Hydroxychloroquine", "Prednisolone", "Naproxen"],
    "Osteoporosis":              ["Alendronate", "Calcium carbonate", "Colecalciferol", "Denosumab"],
    "Immunocompromised":         ["Trimethoprim", "Fluconazole", "Aciclovir", "Cotrimoxazole"],
]


// MARK: - CC → suggested investigations lookup

typealias CCInv = (name: String, category: InvestigationEntry.InvCategory)

let ccInvestigations: [String: [CCInv]] = [
    "Abdominal pain": [
        ("FBC", .blood), ("U&E", .blood), ("LFT", .blood), ("Lipase / Amylase", .blood),
        ("CRP", .blood), ("Urinalysis", .blood), ("β-hCG (females)", .blood),
        ("Abdominal USS", .imaging), ("CT abdomen/pelvis", .imaging),
    ],
    "Jaundice": [
        ("FBC", .blood), ("LFT", .blood), ("GGT", .blood), ("ALP", .blood),
        ("Bilirubin (direct/indirect)", .blood), ("INR / coagulation", .blood),
        ("Hepatitis serology", .blood), ("Abdominal USS", .imaging),
        ("CT abdomen/pelvis", .imaging), ("MRCP", .imaging), ("CA 19-9", .blood),
    ],
    "Dysphagia": [
        ("FBC", .blood), ("U&E", .blood), ("LFT", .blood), ("Albumin", .blood),
        ("OGD / Gastroscopy", .endoscopy), ("Barium swallow", .imaging),
        ("CT thorax/abdomen", .imaging), ("pH manometry", .other),
    ],
    "Reflux / Heartburn": [
        ("FBC", .blood), ("OGD / Gastroscopy", .endoscopy),
        ("H. pylori breath test", .other), ("pH manometry", .other),
    ],
    "Rectal bleeding": [
        ("FBC", .blood), ("LFT", .blood), ("Coagulation", .blood), ("CEA", .blood),
        ("Colonoscopy", .endoscopy), ("Flexible sigmoidoscopy", .endoscopy),
        ("CT colonography", .imaging),
    ],
    "Change in bowel habit": [
        ("FBC", .blood), ("LFT", .blood), ("CEA", .blood), ("CRP", .blood),
        ("Faecal calprotectin", .other), ("Colonoscopy", .endoscopy),
        ("CT abdomen/pelvis", .imaging),
    ],
    "Weight loss": [
        ("FBC", .blood), ("U&E", .blood), ("LFT", .blood), ("TFT", .blood),
        ("CRP / ESR", .blood), ("CEA", .blood), ("CA 19-9", .blood), ("PSA (males)", .blood),
        ("CT chest/abdomen/pelvis", .imaging), ("OGD / Gastroscopy", .endoscopy),
        ("Colonoscopy", .endoscopy),
    ],
    "Hernia": [
        ("FBC", .blood), ("U&E", .blood), ("ECG", .other),
        ("Abdominal USS", .imaging), ("CT abdomen/pelvis", .imaging),
    ],
    "Breast lump": [
        ("FBC", .blood), ("USS breast", .imaging), ("Mammogram", .imaging),
        ("Core needle biopsy", .pathology), ("ER/PR/HER2 receptor status", .pathology),
    ],
    "Neck lump": [
        ("FBC", .blood), ("TFT", .blood), ("LDH", .blood), ("EBV / CMV serology", .blood),
        ("USS neck", .imaging), ("CT neck/thorax", .imaging), ("FNA", .pathology),
    ],
    "Skin lesion": [
        ("Excision biopsy", .pathology), ("Punch biopsy", .pathology),
        ("Wide local excision + SNB", .pathology),
    ],
    "Anal pain": [
        ("FBC", .blood), ("CRP", .blood), ("Proctoscopy", .endoscopy),
        ("MRI pelvis / fistula", .imaging), ("CT abdomen/pelvis", .imaging),
    ],
    "Bloating": [
        ("FBC", .blood), ("LFT", .blood), ("TFT", .blood), ("Faecal calprotectin", .other),
        ("Abdominal USS", .imaging), ("OGD / Gastroscopy", .endoscopy),
        ("Colonoscopy", .endoscopy),
    ],
    "Nausea / Vomiting": [
        ("FBC", .blood), ("U&E", .blood), ("LFT", .blood), ("Glucose", .blood),
        ("AXR", .imaging), ("Abdominal USS", .imaging), ("CT abdomen/pelvis", .imaging),
        ("OGD / Gastroscopy", .endoscopy),
    ],
    "Wound / Post-op": [
        ("FBC", .blood), ("CRP", .blood), ("Wound swab M/C/S", .pathology),
        ("USS wound", .imaging), ("CT abdomen/pelvis", .imaging),
    ],
    "ERCP / Biliary": [
        ("FBC", .blood), ("LFT", .blood), ("INR", .blood), ("Lipase / Amylase", .blood),
        ("Abdominal USS", .imaging), ("MRCP", .imaging), ("ERCP", .endoscopy),
    ],
    "Screening": [
        ("Colonoscopy", .endoscopy), ("Faecal immunochemical test (FIT)", .other),
        ("Mammogram", .imaging), ("USS abdomen", .imaging),
    ],
    "Chest pain": [
        ("FBC", .blood), ("Troponin I/T (serial)", .blood), ("ECG", .other),
        ("CXR", .imaging), ("D-dimer", .blood), ("BNP / NT-proBNP", .blood),
        ("Echo", .imaging), ("CT pulmonary angiogram", .imaging),
    ],
    "Shortness of breath": [
        ("FBC", .blood), ("BNP / NT-proBNP", .blood), ("CRP", .blood),
        ("Spirometry / PFTs", .other), ("CXR", .imaging), ("Echo", .imaging),
        ("CT thorax", .imaging), ("ABG", .blood), ("Sputum M/C/S", .pathology),
    ],
    "Fever / Infection": [
        ("FBC", .blood), ("CRP / ESR", .blood), ("Blood cultures ×2", .blood),
        ("Urinalysis + M/C/S", .pathology), ("CXR", .imaging),
        ("Dengue serology (NS1 + IgM/IgG)", .blood), ("Malaria RDT / thick film", .blood),
        ("LFT", .blood), ("Leptospira serology", .blood), ("Widal test", .blood),
    ],
    "Urinary symptoms": [
        ("Urinalysis", .blood), ("Urine M/C/S", .pathology),
        ("FBC", .blood), ("U&E + creatinine", .blood), ("PSA (males)", .blood),
        ("USS KUB", .imaging), ("CT KUB", .imaging),
    ],
    "Joint pain": [
        ("FBC", .blood), ("CRP / ESR", .blood), ("Uric acid", .blood),
        ("Rheumatoid factor / anti-CCP", .blood), ("ANA / dsDNA", .blood),
        ("X-ray affected joint", .imaging), ("Synovial fluid M/C/S + crystals", .pathology),
    ],
    "Hypertension review": [
        ("FBC", .blood), ("U&E + creatinine", .blood), ("Fasting glucose / HbA1c", .blood),
        ("Fasting lipids", .blood), ("Urinalysis + ACR", .blood),
        ("ECG", .other), ("Echo", .imaging), ("Fundoscopy", .other),
    ],
    "Diabetes review": [
        ("HbA1c", .blood), ("Fasting glucose", .blood), ("U&E + creatinine", .blood),
        ("Urinalysis + ACR (microalbuminuria)", .blood), ("Lipids", .blood),
        ("ECG", .other), ("Foot exam", .other),
    ],
    "Thyroid symptoms": [
        ("TFT (TSH + Free T4 + T3)", .blood), ("Anti-TPO / anti-thyroglobulin", .blood),
        ("FBC", .blood), ("USS thyroid", .imaging), ("FNA if nodule", .pathology),
    ],
]

// Common baseline investigation chips (fallback when no CC-specific set exists)
let commonBaselineInvs: [CCInv] = [
    ("FBC", .blood), ("U&E", .blood), ("LFTs", .blood), ("CRP", .blood),
    ("Coagulation (INR/APTT)", .blood), ("Blood glucose", .blood),
    ("Group & Save", .blood), ("Blood cultures", .blood),
    ("CXR", .imaging), ("AXR", .imaging), ("USS abdomen", .imaging),
    ("ECG", .other), ("Urinalysis", .other),
]

