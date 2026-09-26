// BayesianDiagnosisEngine+CardiovascularCandidates.swift
// Cardiovascular / Vascular differential candidate tables

import Foundation

extension BayesianDiagnosisEngine {


    // MARK: - Chest pain

    static let chestPain: [Candidate] = [
        .init(name: "Acute Coronary Syndrome", icd: "I24.9",
              logPrior: 30, features: [
            .init(key: "character", value: "Pressure", logLR: 14, evidenceLabel: "Pressure-like pain"),
            .init(key: "character", value: "Crushing", logLR: 14, evidenceLabel: "Crushing pain"),
            .init(key: "radiation", value: "Arm", logLR: 14, evidenceLabel: "Radiation to arm"),
            .init(key: "radiation", value: "Jaw", logLR: 12, evidenceLabel: "Radiation to jaw"),
            .init(key: "associations", value: "Nausea", logLR: 6, evidenceLabel: "Nausea"),
            .init(key: "exacerbating", value: "Exertion", logLR: 10, evidenceLabel: "Exertional"),
            .init(key: "relieving", value: "Nitrates", logLR: 14, evidenceLabel: "Nitrate relief"),
            .init(key: "onset", value: "Sudden", logLR: 8, evidenceLabel: "Sudden onset"),
            .init(key: "pmh", value: "ischaemic heart", logLR: 12, evidenceLabel: "IHD history"),
            .init(key: "pmh", value: "diabetes", logLR: 6, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "hypertension", logLR: 5, evidenceLabel: "Hypertension"),
            .init(key: "age_over", value: "45", logLR: 8, evidenceLabel: "Age >45"),
            .init(key: "sex_male", value: "", logLR: 4, evidenceLabel: "Male sex"),
            .init(key: "inv", value: "troponin", logLR: 18, evidenceLabel: "Troponin elevated"),
            .init(key: "inv", value: "ecg", logLR: 8, evidenceLabel: "ECG performed"),
        ]),
        .init(name: "Stable Angina", icd: "I20.9",
              logPrior: 20, features: [
            .init(key: "timing", value: "Episodic", logLR: 10, evidenceLabel: "Episodic"),
            .init(key: "exacerbating", value: "Exertion", logLR: 14, evidenceLabel: "Exertional"),
            .init(key: "relieving", value: "Rest", logLR: 10, evidenceLabel: "Relief with rest"),
            .init(key: "character", value: "Pressure", logLR: 10, evidenceLabel: "Pressure"),
            .init(key: "pmh", value: "ischaemic heart", logLR: 12, evidenceLabel: "IHD"),
            .init(key: "pmh", value: "diabetes", logLR: 5, evidenceLabel: "Diabetes"),
            .init(key: "age_over", value: "50", logLR: 6, evidenceLabel: "Older age"),
        ]),
        .init(name: "Pulmonary Embolism", icd: "I26.99",
              logPrior: 12, features: [
            .init(key: "character", value: "Sharp", logLR: 10, evidenceLabel: "Pleuritic chest pain"),
            .init(key: "associations", value: "Shortness of breath", logLR: 12, evidenceLabel: "Dyspnoea"),
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "pmh", value: "dvt", logLR: 14, evidenceLabel: "Previous DVT"),
            .init(key: "pmh", value: "pe", logLR: 14, evidenceLabel: "Previous PE"),
            .init(key: "pmh", value: "malignancy", logLR: 10, evidenceLabel: "Malignancy"),
            .init(key: "inv", value: "d-dimer", logLR: 12, evidenceLabel: "Elevated D-dimer"),
            .init(key: "inv", value: "ctpa", logLR: 18, evidenceLabel: "CTPA performed"),
        ]),
        .init(name: "GERD / Oesophagitis", icd: "K21.00",
              logPrior: 25, features: [
            .init(key: "character", value: "Burning", logLR: 12, evidenceLabel: "Burning sensation"),
            .init(key: "exacerbating", value: "Lying flat", logLR: 12, evidenceLabel: "Worse lying flat"),
            .init(key: "exacerbating", value: "Eating", logLR: 6, evidenceLabel: "After meals"),
            .init(key: "relieving", value: "Antacids", logLR: 12, evidenceLabel: "Antacid relief"),
            .init(key: "timing", value: "Post-prandial", logLR: 8, evidenceLabel: "Post-prandial"),
        ]),
        .init(name: "Musculoskeletal Chest Pain", icd: "M79.3",
              logPrior: 20, features: [
            .init(key: "exacerbating", value: "Movement", logLR: 14, evidenceLabel: "Movement"),
            .init(key: "exacerbating", value: "Deep breathing", logLR: 10, evidenceLabel: "Deep breathing"),
            .init(key: "exacerbating", value: "Coughing", logLR: 8, evidenceLabel: "Coughing"),
            .init(key: "character", value: "Sharp", logLR: 8, evidenceLabel: "Sharp pain"),
            .init(key: "exam", value: "tender", logLR: 12, evidenceLabel: "Chest wall tenderness"),
            .init(key: "inv", value: "troponin", logLR: -8, evidenceLabel: ""),
        ]),
    ]

    // MARK: - Vascular surgical

    static let vascularSurgical: [Candidate] = [
        .init(name: "Acute Mesenteric Ischaemia", icd: "K55.0",
              logPrior: 8, features: [
            .init(key: "onset", value: "Sudden", logLR: 12, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Severe", logLR: 10, evidenceLabel: "Severe pain"),
            .init(key: "character", value: "Constant", logLR: 8, evidenceLabel: "Constant pain"),
            .init(key: "associations", value: "Vomiting", logLR: 6, evidenceLabel: "Vomiting"),
            .init(key: "associations", value: "Bloody stool", logLR: 14, evidenceLabel: "Bloody stool (late sign)"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 14, evidenceLabel: "Atrial fibrillation (embolic risk)"),
            .init(key: "pmh", value: "af", logLR: 14, evidenceLabel: "AF"),
            .init(key: "pmh", value: "vascular", logLR: 8, evidenceLabel: "Vascular disease"),
            .init(key: "exam", value: "periton", logLR: 12, evidenceLabel: "Peritonism"),
            .init(key: "age_over", value: "60", logLR: 8, evidenceLabel: "Age >60"),
        ]),
        .init(name: "Abdominal Aortic Aneurysm", icd: "I71.4",
              logPrior: 10, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Tearing", logLR: 16, evidenceLabel: "Tearing pain"),
            .init(key: "radiation", value: "Back", logLR: 12, evidenceLabel: "Radiation to back"),
            .init(key: "radiation", value: "Flank", logLR: 10, evidenceLabel: "Flank radiation"),
            .init(key: "exam", value: "pulsatile", logLR: 18, evidenceLabel: "Pulsatile mass"),
            .init(key: "pmh", value: "smoking", logLR: 8, evidenceLabel: "Smoking history"),
            .init(key: "pmh", value: "hypertension", logLR: 6, evidenceLabel: "Hypertension"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "age_over", value: "60", logLR: 8, evidenceLabel: "Age >60"),
        ]),
        .init(name: "Peripheral Arterial Disease", icd: "I70.209",
              logPrior: 14, features: [
            .init(key: "character", value: "Cramping", logLR: 10, evidenceLabel: "Cramping pain"),
            .init(key: "associations", value: "Claudication", logLR: 16, evidenceLabel: "Intermittent claudication"),
            .init(key: "exacerbating", value: "Walking", logLR: 14, evidenceLabel: "Walking exacerbates"),
            .init(key: "relieving", value: "Rest", logLR: 10, evidenceLabel: "Rest relieves"),
            .init(key: "exam", value: "cold", logLR: 10, evidenceLabel: "Cold limb"),
            .init(key: "exam", value: "absent pulse", logLR: 14, evidenceLabel: "Absent pulses"),
            .init(key: "exam", value: "ulcer", logLR: 10, evidenceLabel: "Ischaemic ulcer"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "smoking", logLR: 8, evidenceLabel: "Smoking"),
        ]),
        .init(name: "Critical Limb Ischaemia", icd: "I70.249",
              logPrior: 6, features: [
            .init(key: "character", value: "Rest pain", logLR: 18, evidenceLabel: "Rest pain"),
            .init(key: "timing", value: "Constant", logLR: 10, evidenceLabel: "Constant pain"),
            .init(key: "exam", value: "gangrene", logLR: 20, evidenceLabel: "Gangrene / tissue loss"),
            .init(key: "exam", value: "ulcer", logLR: 12, evidenceLabel: "Non-healing ulcer"),
            .init(key: "exam", value: "cold", logLR: 10, evidenceLabel: "Cold limb"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "vascular", logLR: 10, evidenceLabel: "Peripheral vascular disease"),
        ]),
        .init(name: "Aortic Dissection", icd: "I71.00",
              logPrior: 5, features: [
            .init(key: "onset", value: "Sudden", logLR: 14, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Tearing", logLR: 18, evidenceLabel: "Tearing / ripping pain"),
            .init(key: "radiation", value: "Back", logLR: 14, evidenceLabel: "Interscapular radiation"),
            .init(key: "radiation", value: "Chest", logLR: 10, evidenceLabel: "Chest radiation"),
            .init(key: "pmh", value: "hypertension", logLR: 10, evidenceLabel: "Hypertension"),
            .init(key: "pmh", value: "marfan", logLR: 14, evidenceLabel: "Marfan syndrome"),
        ]),
    ]

    // MARK: - Stroke / TIA

    static let strokeTIA: [Candidate] = [
        .init(name: "Ischaemic Stroke", icd: "I63.9",
              logPrior: 25, features: [
            .init(key: "onset", value: "Sudden", logLR: 16, evidenceLabel: "Sudden onset — FAST"),
            .init(key: "associations", value: "Facial droop", logLR: 18, evidenceLabel: "Facial droop"),
            .init(key: "associations", value: "Arm weakness", logLR: 16, evidenceLabel: "Arm weakness"),
            .init(key: "associations", value: "Speech difficulty", logLR: 16, evidenceLabel: "Speech difficulty"),
            .init(key: "associations", value: "Visual change", logLR: 12, evidenceLabel: "Visual disturbance"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 14, evidenceLabel: "Atrial fibrillation"),
            .init(key: "pmh", value: "hypertension", logLR: 8, evidenceLabel: "Hypertension"),
            .init(key: "pmh", value: "diabetes", logLR: 6, evidenceLabel: "Diabetes"),
            .init(key: "age_over", value: "55", logLR: 8, evidenceLabel: "Age >55"),
        ]),
        .init(name: "Transient Ischaemic Attack", icd: "G45.9",
              logPrior: 15, features: [
            .init(key: "timing", value: "Resolved", logLR: 16, evidenceLabel: "Symptoms resolved (<24h)"),
            .init(key: "onset", value: "Sudden", logLR: 14, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Facial droop", logLR: 12, evidenceLabel: "Transient facial droop"),
            .init(key: "associations", value: "Arm weakness", logLR: 12, evidenceLabel: "Transient limb weakness"),
            .init(key: "associations", value: "Speech difficulty", logLR: 12, evidenceLabel: "Transient dysphasia"),
            .init(key: "pmh", value: "hypertension", logLR: 8, evidenceLabel: "Hypertension"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 12, evidenceLabel: "Atrial fibrillation"),
        ]),
        .init(name: "Intracranial Haemorrhage", icd: "I61.9",
              logPrior: 8, features: [
            .init(key: "character", value: "Thunderclap", logLR: 20, evidenceLabel: "Thunderclap headache"),
            .init(key: "onset", value: "Sudden", logLR: 14, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Vomiting", logLR: 10, evidenceLabel: "Vomiting"),
            .init(key: "associations", value: "Decreased GCS", logLR: 16, evidenceLabel: "Reduced consciousness"),
            .init(key: "pmh", value: "hypertension", logLR: 10, evidenceLabel: "Hypertension"),
            .init(key: "pmh", value: "anticoagul", logLR: 12, evidenceLabel: "On anticoagulation"),
        ]),
    ]

    // MARK: - Venous Thromboembolism (DVT / PE)

    static let venousThromboEmbolism: [Candidate] = [
        .init(name: "Pulmonary Embolism", icd: "I26.99",
              logPrior: 20, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Pleuritic", logLR: 12, evidenceLabel: "Pleuritic chest pain"),
            .init(key: "associations", value: "Breathlessness", logLR: 12, evidenceLabel: "Dyspnoea"),
            .init(key: "associations", value: "Haemoptysis", logLR: 14, evidenceLabel: "Haemoptysis"),
            .init(key: "associations", value: "Leg swelling", logLR: 12, evidenceLabel: "Leg swelling (DVT)"),
            .init(key: "associations", value: "Hypoxia", logLR: 14, evidenceLabel: "SpO₂ <94%"),
            .init(key: "associations", value: "Tachycardia", logLR: 12, evidenceLabel: "Heart rate >100"),
            .init(key: "pmh", value: "dvt", logLR: 14, evidenceLabel: "Previous DVT / PE"),
            .init(key: "pmh", value: "malignancy", logLR: 10, evidenceLabel: "Active malignancy"),
            .init(key: "pshx", value: "surgery", logLR: 10, evidenceLabel: "Recent surgery (<4 weeks)"),
            .init(key: "inv", value: "d-dimer", logLR: 12, evidenceLabel: "Elevated D-dimer"),
            .init(key: "inv", value: "ctpa", logLR: 20, evidenceLabel: "CTPA positive for PE"),
            .init(key: "inv", value: "s1q3t3", logLR: 10, evidenceLabel: "S1Q3T3 on ECG"),
        ]),
        .init(name: "Deep Vein Thrombosis (Proximal)", icd: "I82.409",
              logPrior: 25, features: [
            .init(key: "site", value: "Leg", logLR: 12, evidenceLabel: "Leg / calf"),
            .init(key: "associations", value: "Calf swelling", logLR: 14, evidenceLabel: "Calf swelling >3 cm"),
            .init(key: "associations", value: "Pitting oedema", logLR: 10, evidenceLabel: "Pitting oedema"),
            .init(key: "exam", value: "tender", logLR: 10, evidenceLabel: "Deep vein tenderness"),
            .init(key: "exam", value: "warm", logLR: 8, evidenceLabel: "Warmth over calf"),
            .init(key: "pmh", value: "dvt", logLR: 14, evidenceLabel: "Previous DVT"),
            .init(key: "pmh", value: "malignancy", logLR: 10, evidenceLabel: "Active malignancy"),
            .init(key: "pshx", value: "surgery", logLR: 10, evidenceLabel: "Recent surgery"),
            .init(key: "inv", value: "d-dimer", logLR: 10, evidenceLabel: "Elevated D-dimer"),
            .init(key: "inv", value: "duplex", logLR: 20, evidenceLabel: "Compression duplex positive"),
        ]),
        .init(name: "Massive Pulmonary Embolism", icd: "I26.09",
              logPrior: 5, features: [
            .init(key: "associations", value: "Hypotension", logLR: 18, evidenceLabel: "SBP <90 mmHg"),
            .init(key: "associations", value: "Syncope", logLR: 14, evidenceLabel: "Syncope / near-syncope"),
            .init(key: "associations", value: "Breathlessness", logLR: 12, evidenceLabel: "Severe dyspnoea"),
            .init(key: "associations", value: "Tachycardia", logLR: 14, evidenceLabel: "HR >100"),
            .init(key: "associations", value: "Cyanosis", logLR: 14, evidenceLabel: "Cyanosis"),
            .init(key: "exam", value: "rv strain", logLR: 18, evidenceLabel: "RV strain on ECHO"),
            .init(key: "inv", value: "troponin", logLR: 12, evidenceLabel: "Raised troponin (RV injury)"),
            .init(key: "inv", value: "bnp", logLR: 10, evidenceLabel: "Raised BNP (RV failure)"),
            .init(key: "inv", value: "ctpa", logLR: 20, evidenceLabel: "Bilateral / saddle PE on CTPA"),
        ]),
    ]

    // MARK: - Acute Limb Ischaemia

    static let acuteLimbIschaemia: [Candidate] = [
        .init(name: "Acute Limb Ischaemia", icd: "I74.3",
              logPrior: 20, features: [
            .init(key: "onset", value: "Sudden", logLR: 14, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain"),
            .init(key: "associations", value: "Cold limb", logLR: 16, evidenceLabel: "Cold limb"),
            .init(key: "associations", value: "Pallor", logLR: 14, evidenceLabel: "Limb pallor"),
            .init(key: "associations", value: "Paraesthesia", logLR: 14, evidenceLabel: "Paraesthesia (neural ischaemia)"),
            .init(key: "associations", value: "Paralysis", logLR: 18, evidenceLabel: "Paralysis (late — severe)"),
            .init(key: "exam", value: "absent pulse", logLR: 18, evidenceLabel: "Absent distal pulses"),
            .init(key: "exam", value: "cold", logLR: 14, evidenceLabel: "Cold compared to contralateral"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 14, evidenceLabel: "AF (embolic source)"),
            .init(key: "pmh", value: "af", logLR: 14, evidenceLabel: "AF"),
            .init(key: "pmh", value: "vascular", logLR: 10, evidenceLabel: "Peripheral arterial disease"),
        ]),
        .init(name: "Arterial Embolism (Limb)", icd: "I74.4",
              logPrior: 15, features: [
            .init(key: "onset", value: "Sudden", logLR: 16, evidenceLabel: "Abrupt onset — minutes"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain"),
            .init(key: "exam", value: "absent pulse", logLR: 18, evidenceLabel: "Absent pulse to level of occlusion"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 16, evidenceLabel: "Atrial fibrillation"),
            .init(key: "pmh", value: "cardiac", logLR: 10, evidenceLabel: "Cardiac disease (thrombus source)"),
            .init(key: "pmh", value: "aortic aneurysm", logLR: 12, evidenceLabel: "Known AAA (thrombus source)"),
        ]),
        .init(name: "Acute-on-Chronic Limb Ischaemia", icd: "I70.209",
              logPrior: 18, features: [
            .init(key: "timing", value: "Gradual then acute", logLR: 10, evidenceLabel: "Gradual onset on background claudication"),
            .init(key: "pmh", value: "claudication", logLR: 14, evidenceLabel: "Pre-existing claudication"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "smoking", logLR: 8, evidenceLabel: "Smoking"),
            .init(key: "pmh", value: "vascular", logLR: 10, evidenceLabel: "Peripheral arterial disease"),
            .init(key: "exam", value: "ulcer", logLR: 12, evidenceLabel: "Non-healing ulcer"),
            .init(key: "exam", value: "absent pulse", logLR: 14, evidenceLabel: "Absent distal pulses"),
        ]),
        .init(name: "Compartment Syndrome", icd: "M79.A10",
              logPrior: 10, features: [
            .init(key: "character", value: "Severe", logLR: 14, evidenceLabel: "Pain out of proportion to injury"),
            .init(key: "associations", value: "Tightness", logLR: 12, evidenceLabel: "Tense / tight compartment"),
            .init(key: "associations", value: "Paraesthesia", logLR: 14, evidenceLabel: "Paraesthesia in compartment distribution"),
            .init(key: "exacerbating", value: "Passive stretch", logLR: 16, evidenceLabel: "Pain on passive stretch of muscles"),
            .init(key: "pshx", value: "trauma", logLR: 12, evidenceLabel: "Trauma / fracture"),
            .init(key: "pshx", value: "reperfusion", logLR: 14, evidenceLabel: "Reperfusion after ischaemia"),
            .init(key: "inv", value: "ck", logLR: 10, evidenceLabel: "Markedly elevated CK"),
        ]),
    ]

}
