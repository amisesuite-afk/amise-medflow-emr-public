import SwiftUI
import SwiftData
import UIKit

// PatientDetailSection.swift
// Patient detail section navigation enum and PDF data wrapper.

// MARK: - PDF share helpers

struct PDFDataWrapper: Identifiable {
    let id = UUID()
    let data: Data
}

// MARK: - Patient detail section enum (iPad/Mac sidebar)

enum PatientDetailSection: String, CaseIterable, Identifiable, Hashable {
    // Summary
    case overview       = "Overview"
    // Consultation sub-sections (map to ConsultTab)
    case cc             = "Chief Complaint"
    case hpi            = "History of Present Illness"
    case pmh            = "Past Medical History"
    case pshx           = "Surgical History"
    case medications    = "Drug / Medication History"
    case allergies      = "Allergies"
    case social         = "Social History"
    case exam           = "Examination"
    case investigations = "Investigations"
    case assessment     = "Assessment / Dx"
    case plan           = "Management Plan"
    // Clinical
    case notes          = "Notes"
    case vitals         = "Vitals"
    case prescriptions  = "Prescriptions"
    case billing        = "Billing"
    case operative      = "Operative Plan"
    case documents      = "Documents"
    case demographics   = "Demographics"
    case trauma         = "Trauma / ATLS"
    case ogd            = "OGD Report"
    case surgery        = "Operative Note"
    case ercp           = "ERCP Report"
    case bronchoscopy   = "Bronchoscopy Report"
    case history        = "Visit History"
    case scores         = "Clinical Scores"
    case journey        = "Patient Journey"
    // Procedure forms (iPad-accessible — iPhone uses ClinicalHubView)
    case colonoscopy       = "Colonoscopy Report"
    case discharge         = "Discharge Summary"
    case postOp            = "Post-op Review"
    case consent           = "Surgical Consent"
    case preOpChecklist    = "Pre-op Checklist"
    case referral          = "Referral Letter"
    case patientInstructions = "Patient Instructions"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .overview:       "person.text.rectangle"
        case .cc:             "text.bubble"
        case .hpi:            "doc.text"
        case .pmh:            "clock.arrow.circlepath"
        case .pshx:           "scissors"
        case .medications:    "pills"
        case .allergies:      "exclamationmark.shield"
        case .social:         "person.2"
        case .exam:           "stethoscope"
        case .investigations: "testtube.2"
        case .assessment:     "brain.head.profile"
        case .plan:           "list.bullet.clipboard"
        case .notes:          "note.text"
        case .vitals:         "waveform.path.ecg"
        case .prescriptions:  "pills"
        case .billing:        "dollarsign.circle"
        case .operative:      "scissors"
        case .documents:      "doc.badge.plus"
        case .demographics:   "square.and.pencil"
        case .trauma:         "cross.case.fill"
        case .ogd:            "scope"
        case .surgery:        "scissors"
        case .ercp:           "waveform.and.magnifyingglass"
        case .bronchoscopy:   "lungs"
        case .history:        "clock.badge.checkmark"
        case .scores:         "chart.bar.doc.horizontal"
        case .journey:        "arrow.triangle.branch"
        case .colonoscopy:       "circle.dotted.and.circle"
        case .discharge:         "rectangle.portrait.and.arrow.right"
        case .postOp:            "bandage"
        case .consent:           "signature"
        case .preOpChecklist:    "checklist"
        case .referral:          "envelope.open"
        case .patientInstructions: "doc.text.fill"
        }
    }

    var shortLabel: String {
        switch self {
        case .overview:       "Overview"
        case .cc:             "CC"
        case .hpi:            "HPI"
        case .pmh:            "PMH/FHx"
        case .pshx:           "PSHx"
        case .medications:    "Meds/Drugs"
        case .allergies:      "Allergies"
        case .social:         "Social"
        case .exam:           "Exam"
        case .investigations: "Ix"
        case .assessment:     "Assess"
        case .plan:           "Plan"
        case .notes:          "Notes"
        case .vitals:         "Vitals"
        case .prescriptions:  "Rx"
        case .billing:        "Billing"
        case .operative:      "Op Plan"
        case .documents:      "Docs"
        case .demographics:   "Details"
        case .trauma:         "Trauma"
        case .ogd:            "OGD"
        case .surgery:        "Op Note"
        case .ercp:           "ERCP"
        case .bronchoscopy:   "Bronch"
        case .history:        "History"
        case .scores:         "Scores"
        case .journey:        "Journey"
        case .colonoscopy:       "Scope"
        case .discharge:         "Discharge"
        case .postOp:            "Post-op"
        case .consent:           "Consent"
        case .preOpChecklist:    "Pre-op Cx"
        case .referral:          "Referral"
        case .patientInstructions: "Pt Instr"
        }
    }

    var consultTab: ConsultTab? {
        switch self {
        case .cc:             .cc
        case .hpi:            .hpi
        case .pmh:            .pmh
        case .pshx:           .pshx
        case .medications:    .meds
        case .allergies:      .allergies
        case .social:         .social
        case .exam:           .exam
        case .investigations: .investigations
        case .assessment:     .diagnosis
        case .plan:           .plan
        default:              nil
        }
    }
}

