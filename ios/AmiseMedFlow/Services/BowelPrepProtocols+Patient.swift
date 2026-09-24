// BowelPrepProtocols+Patient.swift
// Reads the facts the bowel-prep safety checks need from a Patient, the same way
// VisitRiskAssessment and the score auto-populator do (stored scores first, then the latest
// resulted lab via latestLab(named:)). Read-only: nothing here changes the record.

import Foundation

extension BowelPrepPatientFacts {
    init(patient p: Patient) {
        let meds = p.prescriptions.map { $0.drug.lowercased() }
        let history = (p.pmhEntries.map(\.condition) + [p.pmhNotes ?? ""]).joined(separator: " ")
        let presentation = [p.chiefComplaint, p.hpi, p.workingDiagnosis, p.assessmentText]
            .compactMap { $0 }
            .joined(separator: " ")

        // Magnesium: value plus the unit when the result text states it.
        let magnesiumEntry = p.investigations
            .filter { $0.status == .resulted && $0.name.lowercased().contains("magnesium") }
            .sorted { ($0.resultedAt ?? $0.orderedAt) < ($1.resultedAt ?? $1.orderedAt) }
            .last
        var unit: String?
        if let text = magnesiumEntry?.result.lowercased() {
            if text.contains("mmol") { unit = "mmol" }
            else if text.contains("mg/dl") || text.contains("mg / dl") { unit = "mgdl" }
        }

        self.init(
            ageYears: p.dateOfBirth == nil ? nil : p.ageYears,
            egfr: p.ckdEpiEgfr ?? p.latestLab(named: ["egfr"]),
            creatinineUmolL: p.creatinineUmolL(),
            magnesium: magnesiumEntry.flatMap { p.parseLabNumber($0.result) },
            magnesiumUnit: unit,
            cfs: p.cfsScore,
            kdigoStage: p.kdigoStage,
            historyText: history,
            presentationText: presentation,
            onDiabetesMedicine: meds.contains { m in BowelPrepSafety.diabetesMedicines.contains { m.contains($0) } })
    }
}

extension BowelPrepProcedure {
    /// The bowel-prep procedure for this patient's booking, or nil.
    static func detect(for p: Patient) -> BowelPrepProcedure? {
        detect(visitType: p.visitType, appointmentType: p.appointmentType)
    }
}
