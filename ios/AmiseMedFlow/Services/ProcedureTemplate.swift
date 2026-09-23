// ProcedureTemplate.swift
// Operative procedure template type and aggregated template library.

import Foundation

import SwiftUI

// MARK: - Procedure Template Library
//
// Each template pre-populates both SurgeryNoteData and ConsentFormData so the
// surgeon only fills in patient-specific findings and intraoperative detail.
// Indication and intraoperative findings fields are always left blank.

struct ProcedureTemplate: Identifiable {
    let id = UUID()
    let name: String
    let category: Category
    let shortName: String

    // Surgery note fields
    let anaesthesiaType: String
    let position: String
    let positioning: [String]
    let skinPrep: String
    let draping: String
    let incision: String
    let techniqueDescription: String    // fills procedureDescription
    let closure: String
    let drainUsually: Bool
    let drainType: String
    let specimenUsually: Bool
    let postOpOrders: String
    let followUpWeeks: String

    // Consent form fields
    let patientDescription: String      // plain-language for patient
    let specificRisks: [String]
    let alternatives: [String]

    enum Category: String, CaseIterable {
        case laparoscopic = "Laparoscopic"
        case open_        = "Open / Excision"
        case breast       = "Breast & Endocrine"
        case endoscopy    = "Endoscopy"
        case emergency    = "Emergency"
    }

    // Apply this template to a SurgeryNoteData, preserving any already-entered
    // patient-specific content (indication, findings, team, dates, timing).
    func applySurgeryFields(to data: inout SurgeryNoteData) {
        data.procedureName   = name
        data.anaesthesiaType = anaesthesiaType
        data.position        = position
        data.positioning     = positioning
        data.skinPrep        = skinPrep
        data.draping         = draping
        data.incision        = incision
        data.procedureDescription = techniqueDescription
        data.closure         = closure
        data.drainInserted   = drainUsually
        data.drainType       = drainUsually ? drainType : ""
        data.specimensSent   = specimenUsually
        if data.postOpOrders.isEmpty { data.postOpOrders = postOpOrders }
        data.followUpWeeks   = followUpWeeks
    }

    // Apply this template to a ConsentFormData, preserving surgeon name, date,
    // patient name, and any custom notes already entered.
    func applyConsentFields(to data: inout ConsentFormData) {
        data.procedureName        = name
        data.procedureDescription = patientDescription
        data.anaesthesiaType      = "\(anaesthesiaType) anaesthesia"
        data.specificRisks        = specificRisks
        data.alternativesTreated  = alternatives
    }
}

// MARK: - Template Library

extension ProcedureTemplate {

    static let all: [ProcedureTemplate] =
        _laparoscopic + _openExcision + _breastEndocrine + _endoscopy + _bronchoscopy + _emergency

    // MARK: - Search / filter helpers

    static func search(_ query: String) -> [ProcedureTemplate] {
        guard query.count >= 2 else { return all }
        let q = query.lowercased()
        return all.filter {
            $0.name.lowercased().contains(q) ||
            $0.shortName.lowercased().contains(q) ||
            $0.category.rawValue.lowercased().contains(q)
        }
    }

    static var byCategory: [(Category, [ProcedureTemplate])] {
        Category.allCases.compactMap { cat in
            let items = all.filter { $0.category == cat }
            return items.isEmpty ? nil : (cat, items)
        }
    }
}
