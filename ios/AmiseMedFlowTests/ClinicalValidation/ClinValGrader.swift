// ClinValGrader.swift
// Clinical validation harness — grading rules.
//
// MIRROR OF scripts/src/clinval/grade.ts. Normalisation, matching, defaults and verdicts must stay
// identical on both platforms (docs/clinical-validation/README.md, "Grading"); change both files
// in the same commit.

import Foundation

enum ClinValGrader {

    static let platform = "ios"
    static let primaryDxSource = "ios.bayes"
    static let defaultTopK = 3
    static let levels = ["routine", "priority", "urgent", "emergency"]

    // MARK: - Normalisation and matching

    static func normalise(_ s: String) -> String {
        var t = s.lowercased()
        for (from, to) in [("\u{2018}", "'"), ("\u{2019}", "'"), ("\u{02BC}", "'"),
                           ("\u{201C}", "\""), ("\u{201D}", "\""),
                           ("\u{2013}", "-"), ("\u{2014}", "-")] {
            t = t.replacingOccurrences(of: from, with: to)
        }
        let collapsed = t.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        return collapsed
    }

    /// True when ANY alternative matches. `icd` is only used by "icd:" alternatives.
    static func matchesAny(_ text: String, _ alternatives: [String], icd: String? = nil) -> Bool {
        let t = normalise(text)
        for alt in alternatives {
            if alt.hasPrefix("re:") {
                let pattern = String(alt.dropFirst(3))
                if let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
                   re.firstMatch(in: t, range: NSRange(t.startIndex..., in: t)) != nil {
                    return true
                }
            } else if alt.hasPrefix("icd:") {
                if let icd, icd.uppercased().hasPrefix(String(alt.dropFirst(4)).uppercased()) { return true }
            } else if t.contains(normalise(alt)) {
                return true
            }
        }
        return false
    }

    static func counts(_ text: String, match: [String], unless: [String]?, icd: String? = nil) -> Bool {
        guard matchesAny(text, match, icd: icd) else { return false }
        if let unless, !unless.isEmpty, matchesAny(text, unless, icd: icd) { return false }
        return true
    }

    static func levelIndex(_ level: String) -> Int { levels.firstIndex(of: level) ?? -1 }

    private static func sourceAllowed(_ source: String, _ prefixes: [String]?) -> Bool {
        guard let prefixes, !prefixes.isEmpty else { return true }
        return prefixes.contains { source.hasPrefix($0) }
    }

    /// Up to ~160 characters of `text` around the first alternative that matches (display only).
    static func snippet(_ text: String, _ alternatives: [String]) -> String {
        let t = normalise(text)
        var found: Range<String.Index>?
        for alt in alternatives where !alt.hasPrefix("icd:") {
            if alt.hasPrefix("re:") {
                if let re = try? NSRegularExpression(pattern: String(alt.dropFirst(3)), options: [.caseInsensitive]),
                   let m = re.firstMatch(in: t, range: NSRange(t.startIndex..., in: t)),
                   let r = Range(m.range, in: t) {
                    found = r
                    break
                }
            } else if let r = t.range(of: normalise(alt)) {
                found = r
                break
            }
        }
        guard let r = found else { return clip(t, 160) }
        let start = t.index(r.lowerBound, offsetBy: -60, limitedBy: t.startIndex) ?? t.startIndex
        let end = t.index(r.upperBound, offsetBy: 80, limitedBy: t.endIndex) ?? t.endIndex
        return (start > t.startIndex ? "..." : "") + String(t[start..<end]) + (end < t.endIndex ? "..." : "")
    }

    private static func clip(_ s: String, _ n: Int) -> String {
        s.count > n ? String(s.prefix(n - 3)) + "..." : s
    }

    // MARK: - Grading

    struct Verdict { let status: String; let detail: String }

    private static func gradeDx(_ e: ClinValExpectation, kind: String, _ out: ClinValOutputs) -> Verdict {
        let source = e.source ?? primaryDxSource
        guard let list = out.differentials[source] else {
            return Verdict(status: "na", detail: "differential source \(source) not produced on ios")
        }
        let k = e.k ?? (kind == "mustRankTopK" ? defaultTopK : list.count)
        func itemText(_ d: ClinValDxItem) -> String { "\(d.name) [\(d.id ?? "")]" }
        let match = e.match ?? []
        let hit = list.first { $0.rank <= k && counts(itemText($0), match: match, unless: e.unless, icd: $0.icd10) }
        let elsewhere = out.differentials.keys.sorted().filter { $0 != source }.compactMap { s -> String? in
            guard let h = out.differentials[s]?.first(where: { counts(itemText($0), match: match, unless: e.unless, icd: $0.icd10) })
            else { return nil }
            return "\(s)#\(h.rank)"
        }
        let also = elsewhere.isEmpty ? "" : "; also in \(elsewhere.joined(separator: ", "))"
        if let hit {
            return Verdict(status: "pass", detail: "'\(hit.name)' at rank \(hit.rank) of \(source) (k=\(k))\(also)")
        }
        let names = list.prefix(k + 2).map { "\($0.rank). \(clip($0.name, 90))" }.joined(separator: " | ")
        return Verdict(status: "fail",
                       detail: "not in top \(k) of \(source): \(list.isEmpty ? "(empty list)" : names)\(also)")
    }

    private static func textItems(_ kind: String, _ out: ClinValOutputs) -> [ClinValSourcedText] {
        let alarms = out.alarms.map { ClinValSourcedText(source: $0.source, text: "\($0.title) — \($0.detail)") }
        switch kind {
        case "alarms": return alarms
        case "redFlags": return out.redFlags + alarms
        case "investigations": return out.investigations
        case "reasoning": return out.reasoning ?? []
        case "missing": return out.missing ?? []
        case "missingTop": return Array((out.missing ?? []).prefix(1))
        default: return out.management
        }
    }

    private static func gradeText(_ e: ClinValExpectation, include: Bool, kind: String, _ out: ClinValOutputs) -> Verdict {
        if let sources = e.sources, !sources.isEmpty, !sources.contains(where: { $0.hasPrefix("ios.") }) {
            return Verdict(status: "na", detail: "sources \(sources.joined(separator: ", ")) are not ios sources")
        }
        if kind == "reasoning" && out.reasoning == nil {
            return Verdict(status: "na", detail: "no diagnostic-reasoning output on ios")
        }
        if (kind == "missing" || kind == "missingTop") && out.missing == nil {
            return Verdict(status: "na", detail: "no what's-missing output on ios")
        }
        let items = textItems(kind, out).filter { sourceAllowed($0.source, e.sources) }
        let hits = items.filter { counts($0.text, match: e.match ?? [], unless: e.unless) }
        let label: String
        switch kind {
        case "alarms": label = "alarm"
        case "redFlags": label = "red flag"
        case "investigations": label = "investigation"
        case "reasoning": label = "reasoning line"
        case "missing": label = "what's-missing line"
        case "missingTop": label = "top what's-missing item"
        default: label = "management item"
        }
        if include {
            if let h = hits.first {
                return Verdict(status: "pass", detail: "\(label) found in \(h.source): \"\(snippet(h.text, e.match ?? []))\"")
            }
            var seen: [String] = []
            for i in items where !seen.contains(i.source) { seen.append(i.source) }
            let detail = items.isEmpty
                ? "no \(label) output\(e.sources.map { " from " + $0.joined(separator: ", ") } ?? "") on ios"
                : "no \(label) matched among \(items.count) (\(seen.joined(separator: ", ")))"
            return Verdict(status: "fail", detail: detail)
        }
        if let h = hits.first {
            let more = hits.count > 1 ? " (+\(hits.count - 1) more)" : ""
            return Verdict(status: "fail", detail: "forbidden \(label) present in \(h.source): \"\(snippet(h.text, e.match ?? []))\"\(more)")
        }
        return Verdict(status: "pass", detail: "none of \(items.count) \(label)s matched")
    }

    private static func fmt(_ v: Double) -> String {
        v.rounded() == v ? String(Int(v)) : String(v)
    }

    private static func gradeScoreValue(_ e: ClinValExpectation, _ out: ClinValOutputs) -> Verdict {
        let items = out.scoreValues.filter { $0.score == e.score && $0.mode == e.mode }
        guard !items.isEmpty else {
            return Verdict(status: "na", detail: "no \(e.mode ?? "?") for \(e.score ?? "?") on ios")
        }
        let want = [e.equalsNumber.map { "= \(fmt($0))" }, e.min.map { "≥ \(fmt($0))" }, e.max.map { "≤ \(fmt($0))" }]
            .compactMap { $0 }.joined(separator: ", ")
        var bad = false
        var all: [String] = []
        for it in items {
            let label = it.label.map { " (\(String($0.prefix(60))))" } ?? ""
            all.append("\(it.source)=\(it.value.map(fmt) ?? "null")\(label)")
            guard let v = it.value else { bad = true; continue }
            if let eq = e.equalsNumber, abs(v - eq) >= 1e-6 { bad = true }
            if let lo = e.min, v < lo - 1e-6 { bad = true }
            if let hi = e.max, v > hi + 1e-6 { bad = true }
        }
        return bad
            ? Verdict(status: "fail", detail: "expected \(want); got \(all.joined(separator: "; "))")
            : Verdict(status: "pass", detail: "\(want): \(all.joined(separator: "; "))")
    }

    private static func defaultPlatforms(_ kind: String) -> [String] {
        switch kind {
        case "pathway": return ["ios"]
        case "dxVariant": return ["web"]
        default: return ["ios", "web"]
        }
    }

    private static func result(_ e: ClinValExpectation, kind: String, _ v: Verdict) -> ClinValExpectationResult {
        let knownGap = e.knownGap?.includes(platform) ?? false
        let unverified = e.unverified?.includes(platform) ?? false
        let detail = v.status == "fail" && knownGap && e.knownGapNote != nil
            ? "\(v.detail) [known gap: \(e.knownGapNote!)]" : v.detail
        return ClinValExpectationResult(
            id: e.id, kind: kind, severity: e.severity, status: v.status, detail: detail,
            knownGap: knownGap, unverified: unverified,
            blocking: e.severity == "critical" && v.status == "fail" && !knownGap && !unverified,
            gapResolved: v.status == "pass" && (knownGap || unverified),
            guidelineRefs: e.guidelineRefs ?? [], note: e.note, proposedFix: e.proposedFix)
    }

    static func grade(_ vignette: ClinValVignette, _ out: ClinValOutputs) -> [ClinValExpectationResult] {
        vignette.expected.all.map { (pair: (String, ClinValExpectation)) -> ClinValExpectationResult in
            let (kind, e) = pair
            let platforms = e.platforms ?? defaultPlatforms(kind)
            guard platforms.contains(platform) else {
                return result(e, kind: kind, Verdict(status: "na", detail: "not applicable to ios"))
            }
            let v: Verdict
            switch kind {
            case "mustRankTopK", "mustNotMiss":
                v = gradeDx(e, kind: kind, out)
            case "emergencyLevel":
                if let lv = out.emergencyLevel {
                    if let got = lv.level {
                        let okLow = e.atLeast.map { levelIndex(got) >= levelIndex($0) } ?? true
                        let okHigh = e.atMost.map { levelIndex(got) <= levelIndex($0) } ?? true
                        let want = [e.atLeast.map { "≥ \($0)" }, e.atMost.map { "≤ \($0)" }].compactMap { $0 }.joined(separator: ", ")
                        v = Verdict(status: okLow && okHigh ? "pass" : "fail",
                                    detail: "\(lv.source): \(got) (\(lv.raw)); expected \(want)")
                    } else {
                        v = Verdict(status: "fail", detail: "level not determined (\(lv.raw))")
                    }
                } else {
                    v = Verdict(status: "na", detail: "no emergency level on ios")
                }
            case "mustAlarm": v = gradeText(e, include: true, kind: "alarms", out)
            case "mustNotAlarm": v = gradeText(e, include: false, kind: "alarms", out)
            case "redFlags": v = gradeText(e, include: true, kind: "redFlags", out)
            case "scoreRecommended":
                let key = e.score ?? ""
                if let hit = out.recommendedScores.first(where: { $0.score == key }) {
                    v = Verdict(status: "pass", detail: "\(key) recommended by \(hit.source)")
                } else {
                    var seen: [String] = []
                    for r in out.recommendedScores where !seen.contains(r.score) { seen.append(r.score) }
                    v = Verdict(status: "fail", detail: "\(key) not recommended; recommended: \(seen.isEmpty ? "(none)" : seen.joined(separator: ", "))")
                }
            case "scoreValue": v = gradeScoreValue(e, out)
            case "investigationInclude": v = gradeText(e, include: true, kind: "investigations", out)
            case "investigationExclude": v = gradeText(e, include: false, kind: "investigations", out)
            case "managementInclude": v = gradeText(e, include: true, kind: "management", out)
            case "managementExclude": v = gradeText(e, include: false, kind: "management", out)
            case "pathway":
                let want = e.equalsString ?? ""
                if let p = out.pathway {
                    v = Verdict(status: p.value == want ? "pass" : "fail",
                                detail: "recommended \(p.value) (\(p.reasons.joined(separator: "; "))); expected \(want)")
                } else {
                    v = Verdict(status: "na", detail: "no consultation pathway on ios")
                }
            case "reasoningInclude": v = gradeText(e, include: true, kind: "reasoning", out)
            case "reasoningExclude": v = gradeText(e, include: false, kind: "reasoning", out)
            case "missingTop": v = gradeText(e, include: true, kind: "missingTop", out)
            case "missingInclude": v = gradeText(e, include: true, kind: "missing", out)
            case "missingExclude": v = gradeText(e, include: false, kind: "missing", out)
            case "dxVariant":
                v = Verdict(status: "na", detail: "no dx-variant engine on ios")
            default:
                v = Verdict(status: "na", detail: "unknown expectation kind \(kind)")
            }
            return result(e, kind: kind, v)
        }
    }
}
