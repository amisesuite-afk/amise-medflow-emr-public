// LongitudinalPatterns.swift
// Longitudinal pattern view — read-only, across the patient's visits and results.
//
// Web twin: lib/triage-engine/src/diagnostic-reasoning/longitudinal.ts (same thresholds, grouping
// and wording; vectors in AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json).
//  - Recurring presentations: 3+ visits for the same problem (complaints sharing a meaningful
//    word, VisitContinuity.meaningfulWords).
//  - Trends: creatinine rising (≥ 26.5 µmol/L or ≥ 1.5 × the lowest earlier value, KDIGO 2012),
//    haemoglobin falling (≥ 20 g/L below the highest earlier value), weight loss (≥ 5 % of the
//    highest weight in the 183 days before the latest).
//  - Diagnoses that did not hold: an earlier diagnosis for the same problem later replaced.
// Dates are compared by their first 10 characters (YYYY-MM-DD).

import Foundation

enum LongitudinalPatterns {

    struct Visit: Codable {
        let date: String
        let complaint: String?
        let diagnosis: String?
    }

    struct Point: Codable {
        let date: String
        let value: Double
    }

    struct Input: Codable {
        let visits: [Visit]
        let creatinine: [Point]
        let haemoglobin: [Point]
        let weight: [Point]
    }

    struct Recurring: Codable {
        let problem: String
        let count: Int
        let dates: [String]
    }

    struct TrendItem: Codable {
        let analyte: String
        let from: Double
        let to: Double
        let fromDate: String
        let toDate: String
        let text: String
    }

    struct Unheld: Codable {
        let diagnosis: String
        let date: String
        let replacedBy: String
        let replacedOn: String
    }

    struct Result {
        let recurring: [Recurring]
        let trends: [TrendItem]
        let unheld: [Unheld]

        var isEmpty: Bool { recurring.isEmpty && trends.isEmpty && unheld.isEmpty }
    }

    static let recurringVisits = 3
    static let creatinineRiseUmol = 26.5
    static let creatinineRatio = 1.5
    static let haemoglobinDropGL = 20.0
    static let weightLossFraction = 0.05
    static let weightWindowDays = 183

    static func day(_ date: String) -> String { String(date.prefix(10)) }

    /// Days since 1970-01-01 for a YYYY-MM-DD date (proleptic Gregorian, as Date.UTC on the web).
    static func dayNumber(_ date: String) -> Int {
        let parts = day(date).split(separator: "-").map { Int($0) ?? 0 }
        let y0 = parts.count > 0 ? parts[0] : 1970
        let m = parts.count > 1 && parts[1] > 0 ? parts[1] : 1
        let d = parts.count > 2 && parts[2] > 0 ? parts[2] : 1
        // days_from_civil (H. Hinnant)
        let y = m <= 2 ? y0 - 1 : y0
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (m + 9) % 12
        let doy = (153 * mp + 2) / 5 + d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    /// One decimal, or none when it is a whole number ("72", "71.5").
    static func fmtNum(_ x: Double) -> String {
        let r = (x * 10).rounded() / 10
        return r == r.rounded() ? String(Int(r)) : String(format: "%.1f", r)
    }

    private static func sortedPoints(_ points: [Point]) -> [Point] {
        points.enumerated().sorted { a, b in
            let da = day(a.element.date), db = day(b.element.date)
            return da != db ? da < db : a.offset < b.offset
        }.map(\.element)
    }

    private static func clusters(_ visits: [Visit]) -> [[Visit]] {
        let ordered = visits.enumerated().sorted { a, b in
            let da = day(a.element.date), db = day(b.element.date)
            return da != db ? da < db : a.offset < b.offset
        }.map(\.element)
        var groups: [(words: Set<String>, visits: [Visit])] = []
        for v in ordered {
            let complaint = (v.complaint ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let text = complaint.isEmpty ? (v.diagnosis ?? "").trimmingCharacters(in: .whitespacesAndNewlines) : complaint
            let words = VisitContinuity.meaningfulWords(text)
            if words.isEmpty { continue }
            if let i = groups.firstIndex(where: { !$0.words.isDisjoint(with: words) }) {
                groups[i].visits.append(v)
                groups[i].words.formUnion(words)
            } else {
                groups.append((words: words, visits: [v]))
            }
        }
        return groups.map(\.visits)
    }

    static func patterns(_ input: Input) -> Result {
        var recurring: [Recurring] = []
        var unheld: [Unheld] = []
        for group in clusters(input.visits) {
            if group.count >= recurringVisits, let first = group.first {
                let c = (first.complaint ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let problem = c.isEmpty ? (first.diagnosis ?? "").trimmingCharacters(in: .whitespacesAndNewlines) : c
                recurring.append(Recurring(problem: problem, count: group.count, dates: group.map { day($0.date) }))
            }
            var prev: (dx: String, date: String)? = nil
            for v in group {
                let dx = (v.diagnosis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                if dx.isEmpty { continue }
                if let p = prev, VisitContinuity.meaningfulWords(p.dx).isDisjoint(with: VisitContinuity.meaningfulWords(dx)) {
                    unheld.append(Unheld(diagnosis: p.dx, date: p.date, replacedBy: dx, replacedOn: day(v.date)))
                }
                prev = (dx: dx, date: day(v.date))
            }
        }

        var trends: [TrendItem] = []
        let cr = sortedPoints(input.creatinine).map { Point(date: day($0.date), value: $0.value < 20 ? $0.value * 88.4 : $0.value) }
        if cr.count >= 2, let last = cr.last {
            var base = cr[0]
            for p in cr.dropLast() where p.value < base.value { base = p }
            if last.value > base.value && (last.value - base.value >= creatinineRiseUmol || last.value >= creatinineRatio * base.value) {
                trends.append(TrendItem(
                    analyte: "creatinine", from: base.value, to: last.value, fromDate: base.date, toDate: last.date,
                    text: "Creatinine rising: \(Int(base.value.rounded())) → \(Int(last.value.rounded())) µmol/L (\(base.date) → \(last.date))."))
            }
        }
        let hb = sortedPoints(input.haemoglobin).map { Point(date: day($0.date), value: $0.value > 25 ? $0.value : $0.value * 10) }
        if hb.count >= 2, let last = hb.last {
            var base = hb[0]
            for p in hb.dropLast() where p.value > base.value { base = p }
            if base.value - last.value >= haemoglobinDropGL {
                trends.append(TrendItem(
                    analyte: "haemoglobin", from: base.value, to: last.value, fromDate: base.date, toDate: last.date,
                    text: "Haemoglobin falling: \(fmtNum(base.value / 10)) → \(fmtNum(last.value / 10)) g/dL (\(base.date) → \(last.date))."))
            }
        }
        let wt = sortedPoints(input.weight).map { Point(date: day($0.date), value: $0.value) }
        if wt.count >= 2, let last = wt.last {
            let window = wt.dropLast().filter { dayNumber(last.date) - dayNumber($0.date) <= weightWindowDays }
            if var base = window.first {
                for p in window where p.value > base.value { base = p }
                let loss = base.value > 0 ? (base.value - last.value) / base.value : 0
                if loss >= weightLossFraction {
                    let days = dayNumber(last.date) - dayNumber(base.date)
                    trends.append(TrendItem(
                        analyte: "weight", from: base.value, to: last.value, fromDate: base.date, toDate: last.date,
                        text: "Weight loss \(Int((loss * 100).rounded()))%: \(fmtNum(base.value)) → \(fmtNum(last.value)) kg over \(days) days."))
                }
            }
        }
        return Result(recurring: recurring, trends: trends, unheld: unheld)
    }
}
