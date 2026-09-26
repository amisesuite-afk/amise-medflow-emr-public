// PatientScoreAutoPopulator+RecordFill.swift
// Score auto-fill from the record, shared with the web (WhatsMissingCore+Fill.swift ↔
// lib/pane-engine/src/whats-missing/record-fill.ts, same vectors): the fields the populators did not
// read before — Alvarado neutrophils and examination findings, AIR WBC / neutrophil / CRP bands,
// BISAP urea / mental status / SIRS with WBC / pleural effusion, Wells PE heart rate and findings,
// Glasgow-Blatchford findings and history, CURB-65 confusion from ACVPU.
//
// Each merge only adds: a field the record answers is set and marked auto ("from record",
// editable), and its pending entry is removed. Values the populator already set are kept unless the
// record gives the same field a value. No score formula changes.

import Foundation

extension ScoreAutoFill {
    /// Marks a field as filled from the record and drops its "needs attention" entry.
    mutating func markFromRecord(_ key: String) {
        autoFieldKeys.insert(key)
        pendingFields.removeAll { $0.id == key }
    }
}

extension PatientScoreAutoPopulator {

    /// Sets `flag` from the record's boolean field `key` (true or false) and marks it.
    private static func take(_ fill: WhatsMissing.ScoreFill, _ key: String, _ flag: inout Bool,
                             _ f: inout ScoreAutoFill, as autoKey: String) {
        guard let value = fill.bool(key) else { return }
        flag = value || flag
        f.markFromRecord(autoKey)
    }

    static func mergeRecord(_ i: inout AlvaradoInput, _ f: inout ScoreAutoFill, patient: Patient) {
        guard let fill = WhatsMissingPatient.fill("alvarado", patient: patient) else { return }
        take(fill, "migratoryPain", &i.migrationToRIF, &f, as: "migrationToRIF")
        take(fill, "anorexia", &i.anorexia, &f, as: "anorexia")
        take(fill, "nausea", &i.nauseaVomiting, &f, as: "nauseaVomiting")
        take(fill, "rifTenderness", &i.tendernessRIF, &f, as: "tendernessRIF")
        take(fill, "rebound", &i.reboundTenderness, &f, as: "reboundTenderness")
        take(fill, "fever", &i.elevatedTemperature, &f, as: "elevatedTemperature")
        take(fill, "wbcAbove10", &i.wbcElevated, &f, as: "wbcElevated")
        take(fill, "leftShift", &i.neutrophiliaShift, &f, as: "neutrophiliaShift")
    }

    static func mergeRecord(_ i: inout ClinicalScoringEngine.AIRInput, _ f: inout ScoreAutoFill, patient: Patient) {
        guard let fill = WhatsMissingPatient.fill("air", patient: patient) else { return }
        take(fill, "vomiting", &i.vomiting, &f, as: "vomiting")
        take(fill, "painRIF", &i.painRIF, &f, as: "painRIF")
        take(fill, "tempAbove38point5", &i.tempAbove38point5, &f, as: "tempAbove38point5")
        if let v = fill.number("pmn") { i.pmn = Int(v); f.markFromRecord("pmn") }
        if let v = fill.number("wbc") { i.wbc = Int(v); f.markFromRecord("wbc") }
        if let v = fill.number("crp") { i.crp = Int(v); f.markFromRecord("crp") }
    }

    static func mergeRecord(_ i: inout ClinicalScoringEngine.BISAPInput, _ f: inout ScoreAutoFill, patient: Patient) {
        guard let fill = WhatsMissingPatient.fill("bisap", patient: patient) else { return }
        take(fill, "bunAbove25", &i.bunOver9mmolL, &f, as: "bunOver9mmolL")
        take(fill, "impairedMentalStatus", &i.impairedMentalStatus, &f, as: "impairedMentalStatus")
        take(fill, "sirs", &i.sirs, &f, as: "sirs")
        take(fill, "ageAbove60", &i.ageOver60, &f, as: "ageOver60")
        take(fill, "pleuralEffusion", &i.pleuralEffusion, &f, as: "pleuralEffusion")
    }

    static func mergeRecord(_ i: inout WellsPEInput, _ f: inout ScoreAutoFill, patient: Patient) {
        guard let fill = WhatsMissingPatient.fill("wells-pe", patient: patient) else { return }
        take(fill, "dvtSigns", &i.clinicalSignsDVT, &f, as: "clinicalSignsDVT")
        take(fill, "hrAbove100", &i.hrOver100, &f, as: "hrOver100")
        take(fill, "immobilised", &i.immobilisationOrSurgery4w, &f, as: "immobilisationOrSurgery4w")
        take(fill, "priorDvtPe", &i.previousDVTOrPE, &f, as: "previousDVTOrPE")
        take(fill, "haemoptysis", &i.haemoptysis, &f, as: "haemoptysis")
        take(fill, "cancer", &i.malignancyActive, &f, as: "malignancyActive")
    }

    static func mergeRecord(_ i: inout BlatchfordInput, _ f: inout ScoreAutoFill, patient: Patient) {
        guard let fill = WhatsMissingPatient.fill("glasgow-blatchford", patient: patient) else { return }
        take(fill, "melaena", &i.melaena, &f, as: "melaena")
        take(fill, "syncope", &i.syncope, &f, as: "syncope")
        take(fill, "liverDisease", &i.hepaticDisease, &f, as: "hepaticDisease")
        take(fill, "cardiacFailure", &i.cardiacFailure, &f, as: "cardiacFailure")
    }

    static func mergeRecord(_ i: inout CURB65Input, _ f: inout ScoreAutoFill, patient: Patient) {
        guard let fill = WhatsMissingPatient.fill("curb65", patient: patient) else { return }
        take(fill, "confusion", &i.confusion, &f, as: "confusion")
    }
}
