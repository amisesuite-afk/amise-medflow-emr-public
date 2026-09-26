// WhatsMissingCore+Fill.swift
// Score auto-fill from the record: which calculator fields the record already answers ("from
// record", editable) and which record inputs a score needs that are not on file.
//
// DRIFT NOTE: Swift twin of lib/pane-engine/src/whats-missing/record-fill.ts — same thresholds
// (the shared clinical-content/rules/whats-missing-rules.json), same field keys (the web calculator names; the populators map
// them to the iOS input structs), same vectors. Numeric inputs fill true and false; history and
// examination findings fill only when affirmed. No score formula is computed or changed here.

import Foundation

extension WhatsMissing {

    /// Scores whose inputs this module fills or checks.
    static let fillableScores: [String] = [
        "news2", "qsofa", "alvarado", "air", "glasgow-blatchford", "curb65", "wells-pe", "wells-dvt", "caprini", "rcri", "bisap",
        "tg18-cholecystitis", "tg18-cholangitis",
    ]

    /// A filled value: a tick (Bool) or a number (urea, Hb, SBP, an AIR band 0–2).
    enum FillValue: Decodable, Equatable {
        case bool(Bool)
        case number(Double)

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let b = try? c.decode(Bool.self) { self = .bool(b) } else { self = .number(try c.decode(Double.self)) }
        }

        var bool: Bool? { if case .bool(let b) = self { return b }; return nil }
        var number: Double? { if case .number(let d) = self { return d }; return nil }
    }

    struct FilledField: Decodable, Equatable {
        let key: String
        let value: FillValue
        /// "demographics" | "vitals" | "labs" | "history" | "findings" | "imaging"
        let source: String
    }

    struct ScoreFill: Decodable, Equatable {
        let score: String
        let fields: [FilledField]
        let missing: [String]

        func value(_ key: String) -> FillValue? { fields.first { $0.key == key }?.value }
        func bool(_ key: String) -> Bool? { value(key)?.bool }
        func number(_ key: String) -> Double? { value(key)?.number }
    }

    struct NormalisedLabs {
        var wbc: Double?
        var neutrophilPct: Double?
        var crp: Double?
        var urea: Double?
        var hb: Double?
        var creatinine: Double?
        var egfr: Double?
        var bilirubin: Double?
        var albumin: Double?
        var inr: Double?
    }

    static func round1(_ x: Double) -> Double { TreatmentDecisions.jsRound(x * 10) / 10 }

    /// Units the calculators use: WBC ×10⁹/L, Hb g/dL, creatinine µmol/L, neutrophils %.
    static func normaliseLabs(_ r: Record, _ rules: Rules) -> NormalisedLabs {
        let l = r.labs
        let wbc = l.wbc.map { $0 > 100 ? round1($0 / 1000) : $0 }
        var neutrophilPct: Double? = nil
        if let n = l.neutrophils {
            if n > rules.thresholds.neutrophilAbsoluteMax { neutrophilPct = n }
            else if let w = wbc, w > 0 { neutrophilPct = round1((n / w) * 100) }
        }
        return NormalisedLabs(
            wbc: wbc,
            neutrophilPct: neutrophilPct,
            crp: l.crp,
            urea: l.urea,
            hb: l.hb.map { $0 > 25 ? round1($0 / 10) : $0 },
            creatinine: l.creatinine.map { $0 < 15 ? TreatmentDecisions.jsRound($0 * 88.4) : $0 },
            egfr: l.egfr,
            bilirubin: l.bilirubin,
            albumin: l.albumin,
            inr: l.inr)
    }

    /// BMI from height and weight (one decimal), or nil.
    static func recordBmi(_ r: Record) -> Double? {
        guard let w = r.weightKg, let h = r.heightCm, h >= 50 else { return nil }
        let m = h / 100
        return round1(w / (m * m))
    }

    /// Observation concepts not recorded, in NEWS2 chart order.
    static func missingObservations(_ r: Record) -> [String] {
        let v = r.vitals
        var out: [String] = []
        if v.rr == nil { out.append("rr") }
        if v.spo2 == nil { out.append("spo2") }
        if v.onOxygen == nil { out.append("o2") }
        if v.sbp == nil { out.append("sbp") }
        if v.hr == nil { out.append("hr") }
        if v.avpu == nil { out.append("avpu") }
        if v.tempC == nil { out.append("temp") }
        return out
    }

    private struct FillBuilder {
        var fields: [FilledField] = []
        var missing: [String] = []
        mutating func set(_ key: String, _ value: Bool, _ source: String) { fields.append(FilledField(key: key, value: .bool(value), source: source)) }
        mutating func set(_ key: String, _ value: Double, _ source: String) { fields.append(FilledField(key: key, value: .number(value), source: source)) }
        mutating func affirmed(_ key: String, _ value: Bool, _ source: String) { if value { set(key, true, source) } }
        mutating func need(_ concept: String) { if !missing.contains(concept) { missing.append(concept) } }
    }

    static func band3(_ v: Double, _ cut: [Double]) -> Double {
        guard cut.count >= 2 else { return 0 }
        return v >= cut[1] ? 2 : (v >= cut[0] ? 1 : 0)
    }

    /// The pre-filled fields and the missing record inputs of one score.
    static func scoreRecordFill(_ score: String, _ r: Record, _ rules: Rules) -> ScoreFill {
        let t = rules.thresholds
        let labs = normaliseLabs(r, rules)
        let v = r.vitals
        var b = FillBuilder()
        let age = r.ageYears

        switch score {
        case "news2":
            for c in missingObservations(r) { b.need(c) }
        case "qsofa":
            if v.rr == nil { b.need("rr") }
            if v.sbp == nil { b.need("sbp") }
            if v.avpu == nil { b.need("avpu") }
        case "alvarado":
            b.affirmed("migratoryPain", r.f("migration"), "findings")
            b.affirmed("anorexia", r.f("anorexia"), "findings")
            b.affirmed("nausea", r.f("nausea") || r.f("vomiting"), "findings")
            b.affirmed("rifTenderness", r.f("rifTenderness"), "findings")
            b.affirmed("rebound", r.f("rebound"), "findings")
            if let temp = v.tempC { b.set("fever", temp >= t.alvaradoFeverC, "vitals") } else { b.need("temp") }
            if let w = labs.wbc { b.set("wbcAbove10", w > t.alvaradoWbc, "labs") } else { b.need("wbc") }
            if let n = labs.neutrophilPct { b.set("leftShift", n > t.alvaradoNeutrophilPct, "labs") } else { b.need("neutrophils") }
        case "air":
            b.affirmed("vomiting", r.f("vomiting"), "findings")
            b.affirmed("painRIF", r.f("rifPain") || r.f("rifTenderness"), "findings")
            if let temp = v.tempC { b.set("tempAbove38point5", temp >= t.airFeverC, "vitals") } else { b.need("temp") }
            if let n = labs.neutrophilPct { b.set("pmn", band3(n, t.airPmnPct), "labs") } else { b.need("neutrophils") }
            if let w = labs.wbc { b.set("wbc", band3(w, t.airWbc), "labs") } else { b.need("wbc") }
            if let c = labs.crp { b.set("crp", band3(c, t.airCrp), "labs") } else { b.need("crp") }
        case "glasgow-blatchford":
            if let u = labs.urea { b.set("ureaMmol", u, "labs") } else { b.need("urea") }
            if let hb = labs.hb { b.set("haemoglobin", hb, "labs") } else { b.need("hb") }
            if r.sex != "unknown" { b.set("isMale", r.sex == "male", "demographics") }
            if let sbp = v.sbp { b.set("systolicBp", sbp, "vitals") } else { b.need("sbp") }
            if let hr = v.hr { b.set("heartRateAbove100", hr > t.gbsHrAbove, "vitals") } else { b.need("hr") }
            b.affirmed("melaena", r.f("melaena"), "findings")
            b.affirmed("syncope", r.f("syncope"), "findings")
            b.affirmed("liverDisease", r.h("liverDisease"), "history")
            b.affirmed("cardiacFailure", r.h("chf"), "history")
        case "curb65":
            let confusedAvpu = v.avpu != nil && v.avpu != "A"
            if confusedAvpu || r.f("confusion") { b.set("confusion", true, confusedAvpu ? "vitals" : "findings") }
            else if v.avpu == "A" { b.set("confusion", false, "vitals") }
            if let u = labs.urea { b.set("ureaMmolAbove7", u > t.curbUreaAbove, "labs") } else { b.need("urea") }
            if let rr = v.rr { b.set("respiratoryRateAbove30", rr >= t.curbRrAtLeast, "vitals") } else { b.need("rr") }
            if let sbp = v.sbp {
                let lowDbp = v.dbp.map { $0 <= t.curbDbpAtMost } ?? false
                b.set("bpLow", sbp < t.curbSbpBelow || lowDbp, "vitals")
            } else { b.need("sbp") }
            if let age = age { b.set("age65orAbove", age >= t.curbAgeAtLeast, "demographics") }
        case "wells-pe":
            b.affirmed("dvtSigns", r.f("dvtSigns"), "findings")
            if let hr = v.hr { b.set("hrAbove100", hr > t.wellsPeHrAbove, "vitals") } else { b.need("hr") }
            b.affirmed("immobilised", r.h("recentSurgery4w") || r.h("immobile"), "history")
            b.affirmed("priorDvtPe", r.h("priorDvt") || r.h("priorPe"), "history")
            b.affirmed("haemoptysis", r.f("haemoptysis"), "findings")
            b.affirmed("cancer", r.h("cancer"), "history")
        case "wells-dvt":
            b.affirmed("activeCancer", r.h("cancer"), "history")
            b.affirmed("bedridden3Days", r.h("recentSurgery12w") || r.h("immobile"), "history")
            b.affirmed("previousDvt", r.h("priorDvt"), "history")
        case "caprini":
            if let age = age {
                b.set("age41_60", age >= 41 && age <= 60, "demographics")
                b.set("age61_74", age >= 61 && age <= 74, "demographics")
                b.set("age75plus", age >= 75, "demographics")
            }
            if let bmi = recordBmi(r) { b.set("bmi25", bmi > t.capriniBmiAbove, "demographics") }
            else {
                if r.heightCm == nil { b.need("height") }
                if r.weightKg == nil { b.need("weight") }
            }
            b.affirmed("malignancy", r.h("cancer"), "history")
            b.affirmed("vteHistory", r.h("priorDvt") || r.h("priorPe"), "history")
            b.affirmed("chf", r.h("chf"), "history")
            b.affirmed("ibd", r.h("ibd"), "history")
            b.affirmed("varicoseVeins", r.h("varicoseVeins"), "history")
            b.affirmed("ocp_hrt", r.h("ocpHrt"), "history")
            b.affirmed("pregnancy_postpartum", r.h("pregnant"), "history")
        case "rcri":
            b.affirmed("ischemicHeartDisease", r.h("ihd"), "history")
            b.affirmed("congestiveHeartFailure", r.h("chf"), "history")
            b.affirmed("cerebrovascularDisease", r.h("cva"), "history")
            b.affirmed("insulinDependentDiabetes", r.h("insulin"), "history")
            if let cr = labs.creatinine { b.set("creatinineAbove177", cr > t.rcriCreatinineAbove, "labs") } else { b.need("creatinine") }
        case "bisap":
            if let u = labs.urea { b.set("bunAbove25", u > t.bisapUreaAbove, "labs") } else { b.need("urea") }
            let impairedAvpu = v.avpu != nil && v.avpu != "A"
            if impairedAvpu || r.f("confusion") { b.set("impairedMentalStatus", true, impairedAvpu ? "vitals" : "findings") }
            else if v.avpu == "A" { b.set("impairedMentalStatus", false, "vitals") }
            else { b.need("avpu") }
            // SIRS: ≥ 2 of temperature, HR, RR, WBC. Filled only when the known criteria decide it.
            let crit: [(met: Bool?, concept: String)] = [
                (met: v.tempC.map { $0 < t.sirsTempBelow || $0 > t.sirsTempAbove }, concept: "temp"),
                (met: v.hr.map { $0 > t.sirsHrAbove }, concept: "hr"),
                (met: v.rr.map { $0 > t.sirsRrAbove }, concept: "rr"),
                (met: labs.wbc.map { $0 < t.sirsWbcBelow || $0 > t.sirsWbcAbove }, concept: "wbc"),
            ]
            let met = crit.filter { $0.met == true }.count
            let unknown = crit.filter { $0.met == nil }
            if met >= 2 { b.set("sirs", true, "vitals") }
            else if met + unknown.count < 2 { b.set("sirs", false, "vitals") }
            else { for c in unknown { b.need(c.concept) } }
            if let age = age { b.set("ageAbove60", age > t.bisapAgeAbove, "demographics") }
            b.affirmed("pleuralEffusion", r.pleuralEffusion, "imaging")
        case "tg18-cholecystitis", "tg18-cholangitis":
            if labs.wbc == nil { b.need("wbc") }
            if labs.crp == nil { b.need("crp") }
            if v.tempC == nil { b.need("temp") }
            if score == "tg18-cholangitis" && labs.bilirubin == nil { b.need("bilirubin") }
            if !r.imagingReported { b.need("imaging-us") }
        default:
            break
        }
        return ScoreFill(score: score, fields: b.fields, missing: b.missing)
    }
}
