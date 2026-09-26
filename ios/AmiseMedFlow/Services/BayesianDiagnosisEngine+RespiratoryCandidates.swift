// BayesianDiagnosisEngine+RespiratoryCandidates.swift
// Respiratory differential candidate tables

import Foundation

extension BayesianDiagnosisEngine {


    // MARK: - Shortness of breath

    static let shortnessOfBreath: [Candidate] = [
        .init(name: "Asthma (Acute Exacerbation)", icd: "J45.901",
              logPrior: 30, features: [
            .init(key: "character", value: "Wheeze", logLR: 16, evidenceLabel: "Wheeze"),
            .init(key: "timing", value: "Episodic", logLR: 8, evidenceLabel: "Episodic"),
            .init(key: "timing", value: "Nocturnal", logLR: 8, evidenceLabel: "Nocturnal"),
            .init(key: "exacerbating", value: "Exertion", logLR: 6, evidenceLabel: "Exertional"),
            .init(key: "pmh", value: "asthma", logLR: 14, evidenceLabel: "Asthma history"),
            .init(key: "pmh", value: "atopy", logLR: 8, evidenceLabel: "Atopy"),
            .init(key: "age_under", value: "40", logLR: 4, evidenceLabel: "Younger age"),
        ]),
        .init(name: "Heart Failure", icd: "I50.9",
              logPrior: 20, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive dyspnoea"),
            .init(key: "timing", value: "Nocturnal", logLR: 10, evidenceLabel: "Orthopnoea / PND"),
            .init(key: "exam", value: "oedema", logLR: 12, evidenceLabel: "Peripheral oedema"),
            .init(key: "exam", value: "crepitation", logLR: 12, evidenceLabel: "Lung crepitations"),
            .init(key: "exam", value: "raised jvp", logLR: 12, evidenceLabel: "Raised JVP"),
            .init(key: "pmh", value: "heart failure", logLR: 14, evidenceLabel: "Known heart failure"),
            .init(key: "pmh", value: "ischaemic heart", logLR: 10, evidenceLabel: "IHD"),
            .init(key: "inv", value: "bnp", logLR: 14, evidenceLabel: "Elevated BNP"),
            .init(key: "age_over", value: "60", logLR: 6, evidenceLabel: "Older age"),
        ]),
        .init(name: "Community-Acquired Pneumonia", icd: "J18.9",
              logPrior: 25, features: [
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever"),
            .init(key: "character", value: "Sharp", logLR: 6, evidenceLabel: "Pleuritic pain"),
            .init(key: "associations", value: "Cough", logLR: 10, evidenceLabel: "Productive cough"),
            .init(key: "exam", value: "crepitation", logLR: 12, evidenceLabel: "Crepitations"),
            .init(key: "exam", value: "consolidation", logLR: 14, evidenceLabel: "Consolidation"),
            .init(key: "inv", value: "cxr", logLR: 8, evidenceLabel: "CXR performed"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Raised WBC"),
            .init(key: "age_over", value: "65", logLR: 6, evidenceLabel: "Elderly"),
        ]),
        .init(name: "COPD Exacerbation", icd: "J44.1",
              logPrior: 18, features: [
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Progressive"),
            .init(key: "character", value: "Wheeze", logLR: 10, evidenceLabel: "Wheeze"),
            .init(key: "associations", value: "Cough", logLR: 8, evidenceLabel: "Productive cough"),
            .init(key: "pmh", value: "copd", logLR: 18, evidenceLabel: "COPD history"),
            .init(key: "pmh", value: "smoking", logLR: 10, evidenceLabel: "Smoking history"),
            .init(key: "age_over", value: "50", logLR: 8, evidenceLabel: "Age >50"),
        ]),
        .init(name: "Pulmonary Tuberculosis", icd: "A15.0",
              logPrior: 10, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive"),
            .init(key: "associations", value: "Weight loss", logLR: 12, evidenceLabel: "Weight loss"),
            .init(key: "associations", value: "Night sweats", logLR: 12, evidenceLabel: "Night sweats"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Low-grade fever"),
            .init(key: "associations", value: "Haemoptysis", logLR: 14, evidenceLabel: "Haemoptysis"),
            .init(key: "pmh", value: "tb", logLR: 12, evidenceLabel: "Previous TB"),
            .init(key: "pmh", value: "hiv", logLR: 10, evidenceLabel: "Immunocompromised"),
        ]),
    ]

}
