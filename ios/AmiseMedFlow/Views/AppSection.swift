// AppSection.swift
// App section enum for iPad/Mac sidebar navigation.

import SwiftUI

// MARK: - App section enum (iPad/Mac sidebar)

enum AppSection: String, CaseIterable, Hashable, Identifiable {
    case wardRounds  = "Ward Rounds"
    case theatre     = "Theatre"
    case endoscopy   = "Endoscopy"
    case outpatients = "Patients"
    case schedule    = "Schedule"

    var id: String { rawValue }

    var isPatientSection: Bool { self != .schedule }

    var icon: String {
        switch self {
        case .wardRounds:  "bed.double"
        case .theatre:     "scissors"
        case .endoscopy:   "circle.dotted"
        case .outpatients: "person.crop.circle"
        case .schedule:    "calendar"
        }
    }

    var defaultSetting: ClinicalSetting {
        switch self {
        case .wardRounds:  .inpatient
        case .theatre:     .theatre
        case .endoscopy:   .endoscopy
        case .outpatients: .outpatient
        case .schedule:    .outpatient
        }
    }

    var emptyTitle: String {
        switch self {
        case .wardRounds:  "No inpatients"
        case .theatre:     "No theatre cases"
        case .endoscopy:   "No endoscopy cases"
        case .outpatients: "No patients"
        case .schedule:    "No upcoming events"
        }
    }

    var emptyDescription: String {
        switch self {
        case .wardRounds:  "Add an inpatient or emergency patient to begin."
        case .theatre:     "Add a theatre case to build the list."
        case .endoscopy:   "Add an endoscopy case to build the list."
        case .outpatients: "Add an outpatient to get started."
        case .schedule:    "Sync to load calendar events."
        }
    }

    var shortLabel: String {
        switch self {
        case .wardRounds:  "Ward"
        case .theatre:     "Theatre"
        case .endoscopy:   "Scope"
        case .outpatients: "OPD"
        case .schedule:    "Schedule"
        }
    }
}
