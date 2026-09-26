// LifestylePractices+Patient.swift
// Builds the LifestylePractices context from a patient record (web twin:
// artifacts/dashboard/src/lib/lifestyle-context-web.ts). The lifestyle record itself is
// PathwayData.lifestyle (patients.pathway_data_json), shared with the dashboard.

import Foundation

extension LifestylePractices {

    /// Visit types that mean a procedure or operation is booked or under way.
    static let procedureVisitTypes: Set<VisitType> = [
        .dayOfSurgery, .ercp, .ogd, .colonoscopy, .surgeryElective, .surgeryEmergency, .bronchoscopy,
    ]

    /// True when an operation date today or later is recorded, or the visit is a procedure visit.
    static func procedureBooked(operationDate: Date?, visitType: VisitType?, now: Date = .now) -> Bool {
        if let vt = visitType, procedureVisitTypes.contains(vt) { return true }
        guard let op = operationDate else { return false }
        return op >= Calendar.ect.startOfDay(for: now)
    }

    static func context(for patient: Patient, now: Date = .now) -> Context {
        let pmh = patient.pmhEntries.map { Optional($0.condition) } + [patient.pmhNotes]
        return Context(
            lifestyle: patient.pathwayData.lifestyle,
            ageYears: patient.dateOfBirth == nil ? nil : patient.ageYears,
            diagnosisText: NegationMatcher.joinClauses([patient.workingDiagnosis, patient.workingDiagnosisICD]),
            problemText: NegationMatcher.joinClauses(pmh),
            complaintText: NegationMatcher.joinClauses([patient.chiefComplaint, patient.associatedSymptoms]),
            medicationText: NegationMatcher.joinClauses(patient.prescriptions.map { Optional($0.drug) }),
            bmi: patient.latestBMI(),
            procedureBooked: procedureBooked(operationDate: patient.operationDate, visitType: patient.visitType, now: now)
        )
    }
}
