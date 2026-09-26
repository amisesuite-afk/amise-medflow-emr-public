// SurgeryNoteData.swift
// Codable data model for surgery operative notes.

import Foundation

import SwiftUI
import SwiftData

// MARK: - Data model

struct SurgeryNoteData: Codable {
    // Preamble
    var dateOfSurgery: Date?
    var surgeon: String = ""
    var assistant: String = ""
    var anaesthetist: String = ""
    var scrubNurse: String = ""
    var circNurse: String = ""

    // Anaesthesia
    var anaesthesiaType: String = "General"
    var anaesthesiaDetails: String = ""
    var airwayManagement: String = "ETT"

    // Procedure info
    var procedureName: String = ""
    var procedureType: String = "Elective"
    var position: String = "Supine"
    var positioning: [String] = []
    var skinPrep: String = "Chlorhexidine/alcohol"
    var draping: String = "Standard surgical draping"

    // WHO checklist
    var whoSignIn: Bool = false
    var whoTimeout: Bool = false
    var whoSignOut: Bool = false

    // Findings
    var indication: String = ""
    var findingsIntraoperative: String = ""

    // Procedure description
    var incision: String = ""
    var procedureDescription: String = ""
    var haemostasis: String = ""
    var closure: String = ""

    // Specimens
    var specimensSent: Bool = false
    var specimensDetails: String = ""

    // Implants
    var implantsUsed: Bool = false
    var implantsDetails: String = ""

    // Drain / catheter
    var drainInserted: Bool = false
    var drainType: String = ""
    var catheterInserted: Bool = false

    // Blood loss / fluids
    var eblMl: String = ""
    var fluidsMl: String = ""
    var bloodProductsMl: String = ""
    var urineOutputMl: String = ""

    // Duration
    var startTime: Date?
    var endTime: Date?
    var durationMinutes: Int {
        guard let s = startTime, let e = endTime else { return 0 }
        return max(0, Int(e.timeIntervalSince(s) / 60))
    }

    // Complications
    var intraopComplications: [String] = []
    var intraopComplicationNotes: String = ""

    // Post-op
    var recoveryRoom: String = "Smooth recovery"
    var postOpOrders: String = ""
    var followUpWeeks: String = "2"
}

extension Patient {
    var surgeryData: SurgeryNoteData {
        get {
            guard let json = surgeryDataJson, let data = json.data(using: .utf8) else { return SurgeryNoteData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(SurgeryNoteData.self, from: data)) ?? SurgeryNoteData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            surgeryDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}
