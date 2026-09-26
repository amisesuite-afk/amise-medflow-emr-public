// LabReferenceRanges.swift
// Read-only twin of the web's default reference ranges (lib/triage-engine/src/reference-ranges.ts,
// DEFAULT_REFERENCE_RANGES). Conservative adult defaults, each marked "default — replace with your
// laboratory's ranges". Pure and deterministic (no network, no AI).
//
// `pnpm --filter @workspace/scripts run lint:reference-range-parity` parses the `row(...)` lines
// below and fails when any analyte, unit, sex, limit or critical limit differs from the
// TypeScript table, or when an analyte is not a saved name in LabAnalyteCatalog. Change both
// files in the same PR.
//
// Not yet read by LabPanel.hasCriticalValues or the scores (their built-in numbers equal these
// defaults). Syncing the practice's own ranges (Supabase `lab_reference_ranges`, Migration 96)
// to iOS is a follow-up: docs/clinical-validation/changes/lab-feed.md.
//
// Semantics (same as the web): low when value < lower, high when value > upper; critical when
// value < criticalLow or value > criticalHigh; ageMinYears inclusive, ageMaxYears exclusive.

import Foundation

struct LabReferenceRange: Equatable {
    enum Sex: String {
        /// Either sex (stored as "any").
        case either = "any"
        case male
        case female
    }

    /// LabAnalyteCatalog saved name, e.g. "Haemoglobin".
    let analyte: String
    /// Catalogue app unit as displayed; "" for unitless (INR).
    let unit: String
    let sex: Sex
    let ageMinYears: Double?
    let ageMaxYears: Double?
    let lower: Double?
    let upper: Double?
    let criticalLow: Double?
    let criticalHigh: Double?
    let labSource: String
    /// YYYY-MM-DD
    let effectiveFrom: String
}

enum LabReferenceRangeDefaults {
    static let version = "1.0.0"
    static let source = "default — replace with your laboratory's ranges"
    static let effectiveFrom = "2026-09-26"

    private static func row(_ analyte: String, _ unit: String, _ sex: LabReferenceRange.Sex,
                            _ lower: Double?, _ upper: Double?,
                            _ criticalLow: Double?, _ criticalHigh: Double?) -> LabReferenceRange {
        LabReferenceRange(analyte: analyte, unit: unit, sex: sex, ageMinYears: 18, ageMaxYears: nil,
                          lower: lower, upper: upper, criticalLow: criticalLow, criticalHigh: criticalHigh,
                          labSource: source, effectiveFrom: effectiveFrom)
    }

    /// Adults (18 years and over). Children get no default.
    static let all: [LabReferenceRange] = [
        // Haematology
        row("WBC", "×10⁹/L", .either, 4.0, 11.0, nil, nil),
        row("Haemoglobin", "g/dL", .male, 13.0, 17.0, 8.0, nil),
        row("Haemoglobin", "g/dL", .female, 12.0, 15.5, 8.0, nil),
        row("Platelets", "×10⁹/L", .either, 150, 400, 50, nil),
        row("INR", "", .either, 0.8, 1.2, nil, 2.5),
        row("D-dimer", "µg/L FEU", .either, nil, 500, nil, nil),
        // Inflammation
        row("CRP", "mg/L", .either, nil, 5, nil, nil),
        // Renal and electrolytes
        row("Sodium", "mmol/L", .either, 135, 145, 120, 155),
        row("Potassium", "mmol/L", .either, 3.5, 5.3, 2.5, 6.0),
        row("Urea", "mmol/L", .either, 2.5, 7.8, nil, nil),
        row("Creatinine", "µmol/L", .male, 59, 104, nil, 300),
        row("Creatinine", "µmol/L", .female, 45, 84, nil, 300),
        row("eGFR", "mL/min/1.73m²", .either, 60, nil, nil, nil),
        row("Calcium", "mmol/L", .either, 2.2, 2.6, 1.75, 3.0),
        row("Magnesium", "mmol/L", .either, 0.7, 1.0, nil, nil),
        // Glucose
        row("Glucose", "mmol/L", .either, 3.9, 7.8, 3.0, 20.0),
        row("A1c (glycated)", "%", .either, nil, 5.6, nil, nil),
        // Liver
        row("Bilirubin", "µmol/L", .either, nil, 21, nil, nil),
        row("ALT", "U/L", .either, nil, 40, nil, nil),
        row("AST", "U/L", .either, nil, 40, nil, nil),
        row("ALP", "U/L", .either, 30, 130, nil, nil),
        row("GGT", "U/L", .either, nil, 65, nil, nil),
        row("Albumin", "g/L", .either, 35, 50, nil, nil),
        // Pancreas, LDH, lactate, cardiac
        row("Amylase", "U/L", .either, nil, 100, nil, nil),
        row("Lipase", "U/L", .either, nil, 60, nil, nil),
        row("LDH", "U/L", .either, nil, 200, nil, nil),
        row("Lactate", "mmol/L", .either, nil, 2.0, nil, 3.9),
        row("Troponin I", "ng/L", .either, nil, 14, nil, 52),
        row("Troponin T", "ng/L", .either, nil, 14, nil, 52),
        row("Troponin", "ng/L", .either, nil, 14, nil, 52),
        // Tumour markers (stored as reported; compared only in these units)
        row("CEA", "ng/mL", .either, nil, 5, nil, nil),
        row("CA 19-9", "U/mL", .either, nil, 37, nil, nil),
        row("AFP", "ng/mL", .either, nil, 10, nil, nil),
        row("CA-125", "U/mL", .either, nil, 35, nil, nil),
        row("PSA", "ng/mL", .male, nil, 4, nil, nil),
    ]

    /// The default range for a saved name and patient: a sex-specific row wins over either-sex.
    /// `sex` is the patient's sex as stored ("male", "female", anything else = unknown).
    /// `ageYears` nil (unknown) still matches the adult band: the practice sees adults.
    static func range(for analyte: String, sex: String?, ageYears: Double?) -> LabReferenceRange? {
        let patientSex = (sex ?? "").lowercased()
        let matching = all.filter { r in
            guard r.analyte == analyte else { return false }
            if r.sex != .either && r.sex.rawValue != patientSex { return false }
            if let age = ageYears {
                if let minAge = r.ageMinYears, age < minAge { return false }
                if let maxAge = r.ageMaxYears, age >= maxAge { return false }
            }
            return true
        }
        return matching.first(where: { $0.sex != .either }) ?? matching.first
    }

    /// True when `value` (already in the range's unit) is beyond a critical limit.
    static func isCritical(_ value: Double, range: LabReferenceRange) -> Bool {
        if let low = range.criticalLow, value < low { return true }
        if let high = range.criticalHigh, value > high { return true }
        return false
    }
}
