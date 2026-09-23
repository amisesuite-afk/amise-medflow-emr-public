// TraumaData.swift
// TraumaData Codable model and Patient+trauma computed properties.

import SwiftUI
import SwiftData


import SwiftUI
import SwiftData

// MARK: - Data model

struct TraumaData: Codable {
    // MIST
    var mechanism: [String] = []
    var timeOfInjury: Date?
    var injuriesSuspected: String = ""
    var signsAtScene: String = ""
    var preHospitalInterventions: [String] = []

    // Vitals on admission
    var hr: String = ""
    var sbp: String = ""
    var dbp: String = ""
    var rr: String = ""
    var spo2: String = ""
    var temp: String = ""
    var gcs: String = ""
    var glucose: String = ""
    var pupils: String = ""
    var pain: String = ""
    var ebl: String = ""

    // ABCDE
    var airway: String = "Patent"
    var airwayNotes: String = ""
    var breathingRate: String = ""
    var breathingSounds: String = "Clear bilaterally"
    var breathingNotes: String = ""
    var circulationHR: String = ""
    var circulationBP: String = ""
    var circulationNotes: String = ""
    var gcsE: String = "4"
    var gcsV: String = "5"
    var gcsM: String = "6"
    var disabilityNotes: String = ""
    var exposureNotes: String = ""

    // ISS — AIS per region (0–6)
    var aisHead: Int = 0
    var aisFace: Int = 0
    var aisChest: Int = 0
    var aisAbdomen: Int = 0
    var aisExtremities: Int = 0
    var aisSkinSurface: Int = 0

    // Secondary survey (14 regions)
    var secondarySurveyNotes: [String: String] = [:]

    // Burns
    var burnRegions: [String: Double] = [:]
    var inhalationInjury: Bool = false
    var burnsNotes: String = ""
    var weightKg: String = ""

    // Interventions
    var interventions: [String] = []
    var notes: String = ""

    var iss: Int {
        let scores = [aisHead, aisFace, aisChest, aisAbdomen, aisExtremities, aisSkinSurface]
        let top3 = scores.filter { $0 > 0 }.sorted(by: >).prefix(3)
        return top3.map { $0 * $0 }.reduce(0, +)
    }

    var niss: Int {
        let scores = [aisHead, aisFace, aisChest, aisAbdomen, aisExtremities, aisSkinSurface]
        let top3 = scores.sorted(by: >).prefix(3)
        return top3.map { $0 * $0 }.reduce(0, +)
    }

    var tbsa: Double {
        burnRegions.values.reduce(0, +)
    }

    var parklandVolume: Double? {
        guard let wt = Double(weightKg), wt > 0, tbsa > 0 else { return nil }
        return 4 * wt * tbsa
    }

    var revisedBaux: Double? {
        // Requires age — stored externally
        return nil
    }

    var gcsTotalDisplay: Int {
        (Int(gcsE) ?? 0) + (Int(gcsV) ?? 0) + (Int(gcsM) ?? 0)
    }

    var mtpTrigger: Bool {
        guard let hrVal = Int(hr), let sbpVal = Int(sbp) else { return false }
        return hrVal > 120 && sbpVal < 90
    }
}

extension Patient {
    var traumaData: TraumaData {
        get {
            guard let json = traumaDataJson, let data = json.data(using: .utf8) else { return TraumaData() }
            return (try? JSONDecoder().decode(TraumaData.self, from: data)) ?? TraumaData()
        }
        set {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            traumaDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}
