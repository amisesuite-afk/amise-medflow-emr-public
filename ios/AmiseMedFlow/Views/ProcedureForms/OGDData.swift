// OGDData.swift
// OGDData Codable model and Patient+ogdData computed property.

import SwiftUI
import SwiftData


import SwiftUI
import SwiftData

// MARK: - Data model

struct OGDData: Codable {
    // Pre-procedure
    var indication: [String] = []
    var indicationOther: String = ""
    var consent: Bool = false
    var sedationUsed: String = "Midazolam + Fentanyl"
    var sedationDose: String = ""
    var antibiotic: Bool = false
    var antibioticUsed: String = ""
    var antispasmodic: Bool = false

    // Procedure
    var endoscopeModel: String = ""
    var operator_: String = ""
    var assistant: String = ""
    var dateOfProcedure: Date?
    var duration: String = ""    // minutes
    var quality: String = "Good"

    // Oesophagus findings
    var oesophagusNormal: Bool = true
    var oesophagusFindings: [String] = []
    var oesophagusNotes: String = ""
    var zLineCm: String = ""     // distance from incisors

    // Stomach findings
    var stomachNormal: Bool = true
    var stomachFindings: [String] = []
    var stomachNotes: String = ""

    // Duodenum findings
    var duodenumNormal: Bool = true
    var duodenumFindings: [String] = []
    var duodenumNotes: String = ""

    // Barrett's
    var barretts: Bool = false
    var barrettsCm: String = ""
    var pragueCmC: String = ""
    var pragueCmM: String = ""

    // H. pylori / biopsies
    var hpTestDone: Bool = false
    var hpResult: String = "Pending"
    var biopsyTaken: Bool = false
    var biopsySites: [String] = []
    var biopsyNotes: String = ""

    // Interventions
    var interventionsDone: [String] = []
    var interventionNotes: String = ""

    // Impression / plan
    var impression: String = ""
    var recommendations: String = ""
    var followUpWeeks: String = ""
}

extension Patient {
    var ogdData: OGDData {
        get {
            guard let json = ogdDataJson, let data = json.data(using: .utf8) else { return OGDData() }
            return (try? JSONDecoder().decode(OGDData.self, from: data)) ?? OGDData()
        }
        set {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            ogdDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}
