// ColonoscopyData.swift
// ColonoscopyData Codable model and Patient+colonoscopyData computed property.

import SwiftUI
import SwiftData


import SwiftUI
import SwiftData

// MARK: - Data model

struct ColonoscopyData: Codable {
    // Pre-procedure
    var indication: [String] = []
    var indicationOther: String = ""
    var consent: Bool = false
    var operator_: String = ""
    var assistant: String = ""
    var dateOfProcedure: Date?

    // Sedation / prep
    var sedationUsed: String = "Midazolam + Fentanyl"
    var sedationDose: String = ""
    var antispasmodic: Bool = false
    var antibiotic: Bool = false
    var antibioticUsed: String = ""

    // Bowel preparation
    var bowelPrepAgent: String = "MoviPrep"
    var bowelPrepQuality: String = "Good"
    var bostonRight: Int = 3        // 0–3 per segment (Boston Bowel Prep Scale)
    var bostonTransverse: Int = 3
    var bostonLeft: Int = 3

    // Procedure
    var colonoscopeModel: String = ""
    var duration: String = ""
    var extentReached: String = "Cecum"
    var ilealIntubation: Bool = false
    var quality: String = "Complete"

    // Segment findings
    var rectumNormal: Bool = true
    var rectumFindings: [String] = []
    var rectumNotes: String = ""

    var sigmoidNormal: Bool = true
    var sigmoidFindings: [String] = []
    var sigmoidNotes: String = ""

    var descendingNormal: Bool = true
    var descendingFindings: [String] = []
    var descendingNotes: String = ""

    var splenicNormal: Bool = true
    var splenicFindings: [String] = []
    var splenicNotes: String = ""

    var transverseNormal: Bool = true
    var transverseFindings: [String] = []
    var transverseNotes: String = ""

    var hepaticNormal: Bool = true
    var hepaticFindings: [String] = []
    var hepaticNotes: String = ""

    var ascendingNormal: Bool = true
    var ascendingFindings: [String] = []
    var ascendingNotes: String = ""

    var cecumNormal: Bool = true
    var cecumFindings: [String] = []
    var cecumNotes: String = ""

    var terminalIleumNormal: Bool = true
    var terminalIleumFindings: [String] = []
    var terminalIleumNotes: String = ""

    // Biopsies
    var biopsyTaken: Bool = false
    var biopsySites: [String] = []
    var biopsyNotes: String = ""

    // Interventions
    var interventionsDone: [String] = []
    var interventionNotes: String = ""

    // Complications / outcome
    var completionStatus: String = "Complete"
    var complications: [String] = []
    var complicationNotes: String = ""

    // Impression / plan
    var impression: String = ""
    var recommendations: String = ""
    var surveillance: String = ""
    var followUpWeeks: String = ""
}

extension Patient {
    var colonoscopyData: ColonoscopyData {
        get {
            guard let json = colonoscopyDataJson,
                  let raw = json.data(using: .utf8) else { return ColonoscopyData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(ColonoscopyData.self, from: raw)) ?? ColonoscopyData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            colonoscopyDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}
