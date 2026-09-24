// BronchoscopyData.swift
// BronchoscopyData Codable model and Patient+bronchoscopyData computed property.

import SwiftUI
import SwiftData

// MARK: - Data model

struct BronchoscopyData: Codable, Equatable {
    // Pre-procedure
    var indication: [String] = []
    var indicationOther: String = ""
    var consent: Bool = false
    var operator_: String = ""
    var assistant: String = ""
    var dateOfProcedure: Date?

    // Sedation
    var sedationUsed: String = "MAC / Propofol"
    var sedationDose: String = ""
    var oxygenSupplementation: String = "Nasal prongs"
    var topicalAnaesthesia: String = "Lidocaine spray + 2% instillation"

    // Approach
    var approach: String = "Trans-nasal"        // Trans-nasal / Trans-oral
    var bronchoscopeModel: String = ""
    var duration: String = ""
    var quality: String = "Good"

    // Upper airway
    var nasopharynxNormal: Bool = true
    var nasopharynxNotes: String = ""

    var larynxNormal: Bool = true
    var larynxNotes: String = ""
    var vocalCordsNormal: Bool = true
    var vocalCordsFindings: [String] = []
    var vocalCordsNotes: String = ""

    // Trachea & carina
    var tracheaNormal: Bool = true
    var tracheaFindings: [String] = []
    var tracheaNotes: String = ""

    var carinaNormal: Bool = true
    var carinaFindings: [String] = []
    var carinaNotes: String = ""

    // Right bronchial tree
    var rightMainNormal: Bool = true
    var rightMainNotes: String = ""

    var rightUpperLobeNormal: Bool = true
    var rightUpperLobeFindings: [String] = []
    var rightUpperLobeNotes: String = ""

    var rightMiddleLobeNormal: Bool = true
    var rightMiddleLobeFindings: [String] = []
    var rightMiddleLobeNotes: String = ""

    var rightLowerLobeNormal: Bool = true
    var rightLowerLobeFindings: [String] = []
    var rightLowerLobeNotes: String = ""

    // Left bronchial tree
    var leftMainNormal: Bool = true
    var leftMainNotes: String = ""

    var leftUpperLobeNormal: Bool = true
    var leftUpperLobeFindings: [String] = []
    var leftUpperLobeNotes: String = ""

    var leftLowerLobeNormal: Bool = true
    var leftLowerLobeFindings: [String] = []
    var leftLowerLobeNotes: String = ""

    // BAL / Specimens
    var balPerformed: Bool = false
    var balSite: String = ""
    var biopsyTaken: Bool = false
    var biopsySites: [String] = []
    var biopsyNotes: String = ""

    // Interventions
    var interventionsDone: [String] = []
    var interventionNotes: String = ""

    // Complications
    var completionStatus: String = "Complete"
    var complications: [String] = []
    var complicationNotes: String = ""

    // Impression / plan
    var impression: String = ""
    var recommendations: String = ""
    var followUpWeeks: String = ""
}

extension Patient {
    var bronchoscopyData: BronchoscopyData {
        get {
            guard let json = bronchoscopyDataJson,
                  let raw = json.data(using: .utf8) else { return BronchoscopyData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(BronchoscopyData.self, from: raw)) ?? BronchoscopyData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            bronchoscopyDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}
