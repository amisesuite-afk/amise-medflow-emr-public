// ERCPData.swift
// Codable data model for ERCP procedure records.

import Foundation

import SwiftUI
import SwiftData

// MARK: - Data model

struct ERCPData: Codable {
    // Pre-procedure
    var indication: [String] = []
    var indicationOther: String = ""
    var consent: Bool = false
    var operator_: String = ""
    var assistant: String = ""
    var dateOfProcedure: Date?

    // Anaesthesia
    var anaesthesiaType: String = "MAC / Propofol"
    var position: String = "Prone"
    var antibiotic: Bool = false
    var antibioticUsed: String = ""

    // Equipment
    var duodenoscope: String = ""
    var fluoroscopy: Bool = true
    var contrastUsed: String = "Non-ionic (Omnipaque)"

    // Ampulla
    var ampullaAppearance: String = "Normal"
    var ampullaFindings: [String] = []

    // CBD / PD access
    var bileDuctCannulated: Bool = false
    var pancreaticDuctCannulated: Bool = false
    var sphincterotomy: Bool = false
    var sphincterotomyType: String = "Biliary"
    var precut: Bool = false
    var precutType: String = "Needle-knife"

    // Cholangiogram
    var cholangiogramDone: Bool = false
    var cbdDiameter: String = ""  // mm
    var cbdFindings: [String] = []
    var cbdFillDefect: Bool = false

    // Pancreatogram
    var pancreatogramDone: Bool = false
    var pdDiameter: String = ""
    var pdFindings: [String] = []

    // Stone extraction
    var stoneExtraction: Bool = false
    var stoneCount: String = ""
    var stoneSizeMax: String = ""   // mm
    var extractionMethod: [String] = []
    var clearance: String = "Complete"

    // Stenting
    var biliaryStenosis: Bool = false
    var biliaryStenosisLevel: String = "Distal CBD"
    var plasticStent: Bool = false
    var plasticStentSize: String = "10Fr 7cm"
    var metalStent: Bool = false
    var metalStentType: String = "Covered SEMS"
    var pancreaticStent: Bool = false
    var pancreaticStentSize: String = "5Fr 5cm"

    // Brush cytology / forceps biopsy
    var brushCytology: Bool = false
    var forcepsBiopsy: Bool = false
    var biopsySite: String = ""

    // Outcome / complications
    var completionStatus: String = "Complete"
    var complications: [String] = []
    var complicationNotes: String = ""

    // Post-procedure
    var impression: String = ""
    var recommendations: String = ""
    var followUpWeeks: String = "4"

    // Post-ERCP pancreatitis (PEP) risk
    var pepRisk: String = "Standard"
    var indomethacin: Bool = false   // rectal NSAID prophylaxis
    var pancreaticStentForPEP: Bool = false

    // Contrast-related
    var contrastAllergyPremeds: Bool = false
}

extension Patient {
    var ercpData: ERCPData {
        get {
            guard let json = ercpDataJson, let data = json.data(using: .utf8) else { return ERCPData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(ERCPData.self, from: data)) ?? ERCPData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            ercpDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}
