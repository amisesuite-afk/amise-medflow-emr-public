// LabReportParser.swift
// Deterministic parser for the text of a lab result report (Laboratory Services Ltd PDF, pasted
// text, or on-device OCR). No network, no AI: the text never leaves the device.
//
// Output: header (name, DOB/age, sex, lab number, collection/report dates; ReportHeaderParser) and
// result rows (analyte, value, unit, reference range, H/L flag). Tolerant of layout:
//   - one row per line, columns separated by spaces or tabs, in the usual orders
//     (Test Result [Flag] Units Range, Test Result Units Range Flag, Test: Result Units (Range));
//   - flags attached to the value ("13.5H", "7.9*") or in their own column;
//   - units before the value; "x10^9/L" style units; "<5" / ">90" values;
//   - two results side by side on one line;
//   - one cell per line (label line, then value / unit / range lines);
//   - several pages (form-feed separated) with repeated headers.
// Lines it cannot read as a result are ignored; lines it can read but does not recognise become
// unmapped rows (never dropped). Every row is shown to the clinician, editable, before anything is
// saved (LabReportReviewView); nothing here writes to the record.

import Foundation

// MARK: - Rows

enum LabSpecimen: String, Equatable {
    case blood, urine, other
}

struct ParsedLabRow: Identifiable, Equatable {
    var id = UUID()
    /// The analyte text as printed.
    var reportLabel: String
    /// Catalogue key; nil = unmapped.
    var analyteKey: String?
    /// The value as printed ("13.5", "<5", "Negative").
    var valueText: String
    var unit: String
    var referenceRange: String
    var flag: String
    /// Other words on the line ("fasting", "(Na)", method names).
    var comment: String
    var section: String?
    var specimen: LabSpecimen
    var page: Int
    var sourceLine: String
}

struct ParsedLabReport: Equatable {
    var header: ReportHeader
    var rows: [ParsedLabRow]
    var pageCount: Int
    /// The table layout looked column-by-column (labels and values on separate runs of lines),
    /// which cannot be paired reliably.
    var layoutWarning: Bool
}

// MARK: - Parser

enum LabReportParser {

    struct Line: Equatable {
        let text: String
        let page: Int
    }

    static func parse(text: String, now: Date = Date()) -> ParsedLabReport {
        let lines = split(text)
        let header = ReportHeaderParser.parse(lines: lines.map(\.text), now: now)
        var rows: [ParsedLabRow] = []
        var section: String?
        var specimen = LabSpecimen.blood
        var bareLabelRun = 0
        var layoutWarning = false

        var i = 0
        while i < lines.count {
            let line = lines[i]
            if header.headerLineIndices.contains(i) || isColumnHeader(line.text) || line.text.isEmpty {
                i += 1; continue
            }

            // One cell per line: an analyte label alone, then its value/unit/range lines.
            if isBareAnalyteLabel(line.text) {
                bareLabelRun += 1
                if bareLabelRun >= 3 { layoutWarning = true }
                let previousWasBare = i > 0 && isBareAnalyteLabel(lines[i - 1].text)
                if previousWasBare {
                    i += 1; continue           // column-by-column layout: never pair by position
                }
                var joined = line.text
                var j = i + 1
                var found = false
                while j < lines.count, j <= i + 4 {
                    let next = lines[j].text
                    if header.headerLineIndices.contains(j) || isBareAnalyteLabel(next)
                        || sectionTitle(next) != nil || next.isEmpty { break }
                    joined += " " + next
                    j += 1
                    if let m = matchAnalyte(joined), parseTail(m.rest, allowQualitative: true) != nil {
                        found = true; break
                    }
                }
                if found {
                    while j < lines.count, j <= i + 7, isTailOnly(lines[j].text) {
                        joined += " " + lines[j].text
                        j += 1
                    }
                    rows += parseLine(joined, section: section, specimen: specimen, page: line.page)
                    bareLabelRun = 0
                    i = j
                } else {
                    i += 1
                }
                continue
            }
            bareLabelRun = 0

            if let title = sectionTitle(line.text) {
                section = title
                specimen = specimenFor(section: title, current: specimen)
                i += 1; continue
            }

            rows += parseLine(line.text, section: section, specimen: specimen, page: line.page)
            i += 1
        }

        return ParsedLabReport(header: header,
                               rows: deduplicated(rows),
                               pageCount: (lines.map(\.page).max() ?? 0) + 1,
                               layoutWarning: layoutWarning)
    }

    // MARK: Lines

    /// Lines with whitespace collapsed and dashes/minus signs folded; "\u{000C}" (form feed)
    /// starts a new page.
    static func split(_ text: String) -> [Line] {
        var out: [Line] = []
        var page = 0
        let unified = text
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: "\u{2028}", with: "\n")
            .replacingOccurrences(of: "\u{000C}", with: "\n\u{000C}\n")
        for raw in unified.components(separatedBy: "\n") {
            if raw == "\u{000C}" { page += 1; continue }
            var s = raw
            for dash in ["–", "—", "−", "‐"] { s = s.replacingOccurrences(of: dash, with: "-") }
            s = s.replacingOccurrences(of: "\u{00A0}", with: " ")
                 .replacingOccurrences(of: "\t", with: " ")
                 .replacingOccurrences(of: "|", with: " ")
            s = s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                 .trimmingCharacters(in: .whitespaces)
            out.append(Line(text: s, page: page))
        }
        return out
    }

    private static let columnWords: Set<String> = [
        "test", "tests", "result", "results", "units", "unit", "flag", "flags", "reference",
        "range", "ranges", "ref", "interval", "investigation", "parameter", "analyte", "value",
        "normal", "biological", "specimen", "method",
    ]

    static func isColumnHeader(_ line: String) -> Bool {
        let words = line.lowercased()
            .components(separatedBy: CharacterSet.letters.inverted)
            .filter { !$0.isEmpty }
        guard !words.isEmpty, !line.contains(where: \.isNumber) else { return false }
        return words.filter { columnWords.contains($0) }.count >= 2
    }

    /// A section heading: a short line without digits, in capitals or ending with ":".
    static func sectionTitle(_ line: String) -> String? {
        guard !line.isEmpty, !line.contains(where: \.isNumber), !isBareAnalyteLabel(line) else { return nil }
        let words = line.split(separator: " ")
        let letters = line.filter(\.isLetter)
        guard (1...6).contains(words.count), letters.count >= 3 else { return nil }
        let isCaps = letters == letters.uppercased()
        guard isCaps || line.hasSuffix(":") else { return nil }
        return line.trimmingCharacters(in: CharacterSet(charactersIn: " :"))
    }

    private static let bloodSectionWords = [
        "haematolog", "hematolog", "biochem", "chemistry", "blood", "serum", "plasma", "profile",
        "function", "count", "coagulation", "clotting", "lipid", "renal", "kidney", "liver",
        "thyroid", "electrolyte", "marker", "immunolog", "serolog", "endocrin", "hormone",
        "cardiac", "pancrea", "iron", "vitamin", "diabet", "glucose", "u&e", "fbc", "cbc", "lft",
    ]

    /// Specimen for rows under a new heading. A sub-heading inside a urine section ("MICROSCOPY",
    /// "CHEMICAL EXAMINATION", a stray "NEGATIVE") keeps the urine specimen; only a recognisable
    /// blood-section heading leaves it.
    static func specimenFor(section: String, current: LabSpecimen = .blood) -> LabSpecimen {
        let s = section.lowercased()
        if s.contains("urin") { return .urine }
        for word in ["stool", "faec", "fec", "csf", "fluid", "sputum", "swab", "semen"] where s.contains(word) {
            return .other
        }
        if current != .blood, !bloodSectionWords.contains(where: { s.contains($0) }) { return current }
        return .blood
    }

    // MARK: Analyte labels

    private static let boundary: Set<Character> = [" ", ":", "(", "[", ",", "=", "#", "-", ".", "*"]
    private static let specimenPrefixes = ["serum ", "s. ", "s-", "plasma ", "p. ", "p-", "whole blood ", "blood "]

    /// The catalogue analyte printed at the start of `text`: key, label as printed, the rest.
    static func matchAnalyte(_ text: String) -> (key: String, label: String, rest: String, alias: String)? {
        var candidates = [text]
        for prefix in specimenPrefixes where text.lowercased().hasPrefix(prefix) {
            candidates.append(String(text.dropFirst(prefix.count)))
        }
        for (n, candidate) in candidates.enumerated() {
            for (alias, key) in LabAnalyteCatalog.aliasIndex {
                guard let r = candidate.range(of: alias, options: [.caseInsensitive, .anchored]) else { continue }
                if r.upperBound < candidate.endIndex, !boundary.contains(candidate[r.upperBound]) { continue }
                let prefixLength = n == 0 ? 0 : text.count - candidate.count
                let labelLength = prefixLength + candidate.distance(from: candidate.startIndex, to: r.upperBound)
                let labelEnd = text.index(text.startIndex, offsetBy: labelLength)
                return (key, String(text[..<labelEnd]), String(candidate[r.upperBound...]), alias)
            }
        }
        return nil
    }

    static func isBareAnalyteLabel(_ line: String) -> Bool {
        guard let m = matchAnalyte(line) else { return false }
        return m.rest.trimmingCharacters(in: CharacterSet(charactersIn: " :-=*")).isEmpty
    }

    // MARK: Tokens

    private static let numberRe = try! NSRegularExpression(
        pattern: #"^(<=|>=|<|>|≤|≥)?=?(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)(\*{1,2}|[HhLl]{1,2}|\([HhLl]\)|↑|↓)?$"#)

    /// A value token: (number text with any comparator, attached flag).
    static func valueToken(_ token: String) -> (value: String, flag: String)? {
        let ns = token as NSString
        guard let m = numberRe.firstMatch(in: token, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let comparator = m.range(at: 1).location != NSNotFound ? ns.substring(with: m.range(at: 1)) : ""
        let number = ns.substring(with: m.range(at: 2))
        let flag = m.range(at: 3).location != NSNotFound
            ? ns.substring(with: m.range(at: 3)).trimmingCharacters(in: CharacterSet(charactersIn: "()"))
            : ""
        return (comparator + number, flag.uppercased())
    }

    private static let comparators: Set<String> = ["<", ">", "<=", ">=", "≤", "≥"]

    private static let flagWords: Set<String> = [
        "H", "L", "HH", "LL", "HI", "LO", "HIGH", "LOW", "A", "ABN", "ABNORMAL", "C", "CRIT",
        "CRITICAL", "*", "**", "↑", "↓", "N", "NORMAL", "!", "+",
    ]

    static func flagToken(_ token: String) -> String? {
        let t = token.trimmingCharacters(in: CharacterSet(charactersIn: "()[]")).uppercased()
        return flagWords.contains(t) ? t : nil
    }

    private static let qualitativeSingle: Set<String> = [
        "negative", "positive", "reactive", "non-reactive", "nonreactive", "detected", "nil",
        "trace", "absent", "present", "pending", "clear", "cloudy", "turbid", "yellow", "straw",
        "amber", "few", "moderate", "many", "occasional", "rare", "neg", "pos", "+", "++",
        "+++", "++++",
    ]
    private static let qualitativePairs: Set<String> = ["not detected", "non reactive", "see comment", "to follow", "not seen"]

    private static let genericUnitRe = try! NSRegularExpression(pattern: #"^[A-Za-zµμ%]{1,6}/[A-Za-z0-9.µμ]{1,8}$"#)

    static func isUnitToken(_ token: String) -> Bool {
        let t = token.trimmingCharacters(in: CharacterSet(charactersIn: "()[],;"))
        guard !t.isEmpty else { return false }
        if t.lowercased() == "ratio" { return true }
        let n = LabUnits.normalise(t)
        if LabUnits.known.contains(n) { return true }
        return genericUnitRe.firstMatch(in: t, range: NSRange(location: 0, length: (t as NSString).length)) != nil
    }

    private static let digitUnitRes: [NSRegularExpression] = [
        try! NSRegularExpression(
            pattern: #"(?<![\d.])(?:(?:x|×)\s*)?10\s*(?:\^|\*|e|E)?\s*(?:12|9|6|3|¹²|⁹|⁶|³)\s*/\s*(?:l|ul|µl|μl|mm3|mm³|cumm)(?![A-Za-z])"#,
            options: [.caseInsensitive]),
        try! NSRegularExpression(pattern: #"ml\s*/\s*min\s*/\s*1\.73\s*(?:m\s*(?:2|²|\^2)?)?"#, options: [.caseInsensitive]),
        try! NSRegularExpression(pattern: #"mm\s*/\s*1st\s*h(?:ou)?r?"#, options: [.caseInsensitive]),
    ]

    private static let twoSidedRangeRe = try! NSRegularExpression(
        pattern: #"[\(\[]?\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:-|to)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*[\)\]]?"#,
        options: [.caseInsensitive])
    private static let oneSidedRangeRe = try! NSRegularExpression(
        pattern: #"[\(\[]?\s*(<=|>=|<|>|≤|≥|up\s+to|less\s+than|greater\s+than)\s*(\d+(?:\.\d+)?)\s*[\)\]]?"#,
        options: [.caseInsensitive])

    private static let leadingRangeRe = try! NSRegularExpression(
        pattern: #"^\s*[\(\[]?\s*\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\s*[\)\]]?(?=\s+[<>]?\d)"#,
        options: [.caseInsensitive])

    private static let gluedUnitRe = try! NSRegularExpression(
        pattern: #"^([<>]?\d+(?:\.\d+)?)([A-Za-zµμ%/][A-Za-z0-9/µμ%.^]*)$"#)

    /// "138mmol/L" → ["138", "mmol/L"]; anything else unchanged.
    static func splitGluedUnit(_ token: String) -> [String] {
        let ns = token as NSString
        guard let m = gluedUnitRe.firstMatch(in: token, range: NSRange(location: 0, length: ns.length)) else { return [token] }
        let number = ns.substring(with: m.range(at: 1))
        let unit = ns.substring(with: m.range(at: 2))
        return isUnitToken(unit) ? [number, unit] : [token]
    }

    /// Removes the first match of `re` from `s` and returns it (trimmed).
    private static func extract(_ re: NSRegularExpression, from s: inout String) -> String? {
        let ns = s as NSString
        guard let m = re.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let found = ns.substring(with: m.range)
        s = ns.replacingCharacters(in: m.range, with: " ")
        return found.trimmingCharacters(in: .whitespaces)
    }

    // MARK: Tail (everything after the analyte label)

    struct Tail: Equatable {
        var value: String
        var unit: String
        var range: String
        var flag: String
        var comment: [String]
        /// Text of a second result printed on the same line.
        var remainder: String?
    }

    /// Value, unit, range and flag from the text after the label; nil when there is no value.
    static func parseTail(_ text: String, allowQualitative: Bool) -> Tail? {
        var s = " " + text + " "
        var unit = ""
        var comment: [String] = []
        var leadingRange = ""

        // Units that contain digits come out first, so their digits are not read as a value/range.
        for re in digitUnitRes {
            if unit.isEmpty, let u = extract(re, from: &s) { unit = u }
        }

        // A reference range printed before the value ("Hb 12.0 - 16.0 11.2 g/dL").
        if let r = extract(leadingRangeRe, from: &s) { leadingRange = r }

        var tokens = s.split(separator: " ").flatMap { splitGluedUnit(String($0)) }
        // Leading separators ("Sodium: 138", "Urea = 5.1", "K - 4.2").
        while let first = tokens.first, [":", "=", "-", ":-"].contains(first) { tokens.removeFirst() }
        if let first = tokens.first, first.hasPrefix(":") || first.hasPrefix("=") {
            tokens[0] = String(first.drop(while: { $0 == ":" || $0 == "=" }))
            if tokens[0].isEmpty { tokens.removeFirst() }
        }

        // Find the value within the first few tokens.
        var value: String?
        var flag = ""
        var idx = 0
        while idx < tokens.count, idx < 7 {
            let t = tokens[idx]
            if comparators.contains(t), idx + 1 < tokens.count, let v = valueToken(tokens[idx + 1]) {
                value = t + v.value; flag = v.flag; idx += 2; break
            }
            if let v = valueToken(t) {
                value = v.value; flag = v.flag; idx += 1; break
            }
            if allowQualitative {
                if idx + 1 < tokens.count,
                   qualitativePairs.contains((t + " " + tokens[idx + 1]).lowercased()) {
                    value = t + " " + tokens[idx + 1]; idx += 2; break
                }
                if qualitativeSingle.contains(t.lowercased()) {
                    value = t; idx += 1; break
                }
            }
            if unit.isEmpty, isUnitToken(t) { unit = t; idx += 1; continue }
            comment.append(t)
            idx += 1
        }
        guard let value else { return nil }

        var after = Array(tokens[idx...])

        // A second result on the same line ("Sodium 138 mmol/L Potassium 4.2 mmol/L").
        var remainder: String?
        if after.count >= 2 {
            for j in 0..<after.count {
                let candidate = after[j...].joined(separator: " ")
                guard let m = matchAnalyte(candidate) else { continue }
                let restTokens = m.rest.split(separator: " ").map(String.init)
                let nextIsNumber = restTokens.first.map { valueToken($0.trimmingCharacters(in: CharacterSet(charactersIn: ":="))) != nil } ?? false
                let hasNumber = restTokens.prefix(4).contains { valueToken($0) != nil }
                if (m.alias.count >= 3 && hasNumber) || nextIsNumber {
                    remainder = candidate
                    after = Array(after[..<j])
                    break
                }
            }
        }

        var rest = " " + after.joined(separator: " ") + " "
        var range = leadingRange
        if let r = extract(twoSidedRangeRe, from: &rest) {
            range = r
        } else if let r = extract(oneSidedRangeRe, from: &rest) {
            range = r
        }
        var leftovers = rest.split(separator: " ").map(String.init)

        // Units: two tokens together first ("mg/L FEU", "mL/min/1.73 m2"), then single tokens.
        if unit.isEmpty {
            for k in 0..<max(0, leftovers.count - 1) {
                let pair = leftovers[k] + leftovers[k + 1]
                if LabUnits.known.contains(LabUnits.normalise(pair)), !LabUnits.known.contains(LabUnits.normalise(leftovers[k])) || leftovers[k + 1].uppercased() == "FEU" {
                    unit = leftovers[k] + " " + leftovers[k + 1]
                    leftovers.removeSubrange(k...(k + 1))
                    break
                }
            }
        }
        var kept: [String] = []
        for t in leftovers {
            if unit.isEmpty, isUnitToken(t) { unit = t; continue }
            if unit.uppercased().hasSuffix("FEU") == false, t.uppercased() == "FEU", !unit.isEmpty {
                unit += " FEU"; continue
            }
            if flag.isEmpty, let f = flagToken(t) { flag = f; continue }
            kept.append(t)
        }
        comment += kept

        // A range printed before the value ends up in the comment.
        if range.isEmpty, !comment.isEmpty {
            var c = " " + comment.joined(separator: " ") + " "
            var found = extract(twoSidedRangeRe, from: &c)
            if found == nil { found = extract(oneSidedRangeRe, from: &c) }
            if let r = found {
                range = r
                comment = c.split(separator: " ").map(String.init)
            }
        }

        comment = comment
            .map { $0.trimmingCharacters(in: CharacterSet(charactersIn: ":=")) }
            .filter { !$0.isEmpty && $0 != "-" }

        return Tail(value: value,
                    unit: unit.trimmingCharacters(in: CharacterSet(charactersIn: "()[],;")),
                    range: range.trimmingCharacters(in: CharacterSet(charactersIn: "()[] ")),
                    flag: flag,
                    comment: comment,
                    remainder: remainder)
    }

    /// A line holding only a unit, a range and/or a flag (one-cell-per-line layouts).
    static func isTailOnly(_ line: String) -> Bool {
        guard !line.isEmpty else { return false }
        var s = " " + line + " "
        var took = false
        for re in digitUnitRes {
            if extract(re, from: &s) != nil { took = true }
        }
        if extract(twoSidedRangeRe, from: &s) != nil {
            took = true
        } else if extract(oneSidedRangeRe, from: &s) != nil {
            took = true
        }
        for t in s.split(separator: " ").map(String.init) {
            if isUnitToken(t) || flagToken(t) != nil { took = true; continue }
            return false
        }
        return took
    }

    // MARK: One line

    static func parseLine(_ line: String, section: String?, specimen: LabSpecimen, page: Int) -> [ParsedLabRow] {
        var rows: [ParsedLabRow] = []
        var remaining: String? = line
        var guardCount = 0
        while let text = remaining, !text.isEmpty, guardCount < 6 {
            guardCount += 1
            guard let parsed = parseOne(text, section: section, specimen: specimen, page: page, sourceLine: line) else { break }
            rows.append(parsed.0)
            remaining = parsed.1
        }
        return rows
    }

    private static func parseOne(_ text: String, section: String?, specimen: LabSpecimen,
                                 page: Int, sourceLine: String) -> (ParsedLabRow, String?)? {
        if let m = matchAnalyte(text), let tail = parseTail(m.rest, allowQualitative: true) {
            var key: String? = m.key
            var rowSpecimen = specimen
            let commentText = tail.comment.joined(separator: " ").lowercased()
            if let analyte = LabAnalyteCatalog.analyte(forKey: m.key) {
                for remap in analyte.qualifierRemaps where commentText.contains(remap.word) {
                    key = remap.key; break
                }
            }
            if commentText.contains("urin") { rowSpecimen = .urine }
            var label = m.label.trimmingCharacters(in: CharacterSet(charactersIn: " :=-"))
            if rowSpecimen != .blood {
                // Same analyte in urine (or another fluid) is a different test: never file it
                // under the blood name the scores read.
                key = nil
                if rowSpecimen == .urine, !label.lowercased().contains("urin") { label = "Urine " + label }
            }
            let row = ParsedLabRow(reportLabel: label, analyteKey: key, valueText: tail.value,
                                   unit: tail.unit, referenceRange: tail.range, flag: tail.flag,
                                   comment: tail.comment.joined(separator: " "), section: section,
                                   specimen: rowSpecimen, page: page, sourceLine: sourceLine)
            return (row, tail.remainder)
        }
        return parseGeneric(text, section: section, specimen: specimen, page: page, sourceLine: sourceLine)
    }

    /// An unrecognised analyte: label = the words before the value. Kept only when the line looks
    /// like a result (a unit, range or flag with a number; or a short label with a word result).
    private static func parseGeneric(_ text: String, section: String?, specimen: LabSpecimen,
                                     page: Int, sourceLine: String) -> (ParsedLabRow, String?)? {
        let tokens = text.split(separator: " ").map(String.init)
        guard let first = tokens.first, first.first?.isLetter == true else { return nil }
        var k = 1
        while k < tokens.count, k <= 8 {
            let t = tokens[k]
            if valueToken(t) != nil || comparators.contains(t)
                || qualitativeSingle.contains(t.lowercased())
                || (k + 1 < tokens.count && qualitativePairs.contains((t + " " + tokens[k + 1]).lowercased())) {
                break
            }
            k += 1
        }
        guard k < tokens.count, k <= 8 else { return nil }
        let label = tokens[..<k].joined(separator: " ").trimmingCharacters(in: CharacterSet(charactersIn: " :=-"))
        guard label.filter(\.isLetter).count >= 2, label.count <= 60 else { return nil }
        guard let tail = parseTail(tokens[k...].joined(separator: " "), allowQualitative: true) else { return nil }
        let numeric = valueToken(tail.value) != nil
        if numeric {
            guard !tail.unit.isEmpty || !tail.range.isEmpty || !tail.flag.isEmpty else { return nil }
        } else {
            guard k <= 6, tokens.count <= 10 else { return nil }
        }
        var saved = label
        if specimen == .urine, !label.lowercased().contains("urin") { saved = "Urine " + label }
        let row = ParsedLabRow(reportLabel: saved, analyteKey: nil, valueText: tail.value,
                               unit: tail.unit, referenceRange: tail.range, flag: tail.flag,
                               comment: tail.comment.joined(separator: " "), section: section,
                               specimen: specimen, page: page, sourceLine: sourceLine)
        return (row, tail.remainder)
    }

    /// Drops repeats of the same result (a header table printed again on page 2).
    static func deduplicated(_ rows: [ParsedLabRow]) -> [ParsedLabRow] {
        var seen = Set<String>()
        var out: [ParsedLabRow] = []
        for r in rows {
            let key = [r.analyteKey ?? r.reportLabel.lowercased(), r.valueText, r.unit.lowercased(),
                       r.specimen.rawValue].joined(separator: "\u{1F}")
            if seen.insert(key).inserted { out.append(r) }
        }
        return out
    }
}

// MARK: - Assessment of one (possibly edited) row

enum LabAbnormality: Equatable {
    case normal, high, low, abnormal, unknown

    var isAbnormal: Bool { self == .high || self == .low || self == .abnormal }

    var label: String {
        switch self {
        case .high: return "High"
        case .low: return "Low"
        case .abnormal: return "Abnormal"
        case .normal: return "Normal"
        case .unknown: return ""
        }
    }
}

enum LabRowIssue: Equatable {
    case unmapped
    case readAsOther([String])
    case nonNumeric
    case unitMissing(expected: String)
    case unitAmbiguous(String)
    case unitUnexpected(unit: String, expected: String)
    case implausible(String)
    case censored(String)
    case negative
    case scoreMisread(String)
    case urine
    case alreadyInRecord

    var message: String {
        switch self {
        case .unmapped:
            return "Not recognised: saved under the name shown; no score reads it."
        case .readAsOther(let readers):
            return "Scores would read this name as \(readers.joined(separator: ", ")). Rename it or leave it unticked."
        case .nonNumeric:
            return "No number to save for this analyte."
        case .unitMissing(let expected):
            return "No unit printed. Check it and type the unit (the app expects \(expected))."
        case .unitAmbiguous(let reason):
            return "\(reason). Not converted — check the value."
        case .unitUnexpected(let unit, let expected):
            return "Unit “\(unit)” is not one this analyte is reported in (expected \(expected)). Not converted."
        case .implausible(let name):
            return "Value is outside any possible range for \(name). Check the PDF."
        case .censored(let reading):
            return "Reported beyond the lab's limit; scores will read \(reading)."
        case .negative:
            return "Negative value: scores read numbers without their minus sign."
        case .scoreMisread(let message):
            return message
        case .urine:
            return "Urine result: saved separately from the blood value."
        case .alreadyInRecord:
            return "Already in the record (same test, value and time)."
        }
    }

    /// The row starts unticked.
    var excludesByDefault: Bool {
        switch self {
        case .readAsOther, .nonNumeric, .unitMissing, .unitAmbiguous, .unitUnexpected,
             .implausible, .alreadyInRecord:
            return true
        case .unmapped, .censored, .negative, .scoreMisread, .urine:
            return false
        }
    }

    /// Needs the clinician's attention before saving (included rows with these need the
    /// "I have checked the flagged values" tick).
    var isWarning: Bool {
        switch self {
        case .unmapped, .urine, .censored: return false
        default: return true
        }
    }
}

struct LabRowAssessment: Equatable {
    /// The printed number, if any.
    var number: Double?
    var censor: String?
    /// Value text to save (converted, or as printed).
    var storedValue: String
    /// Unit to save.
    var storedUnit: String
    /// "converted from 1.2 mg/dL"
    var conversionNote: String?
    var abnormality: LabAbnormality
    var issues: [LabRowIssue]

    var excludedByDefault: Bool { issues.contains { $0.excludesByDefault } }
    var needsAttention: Bool { issues.contains { $0.isWarning } }
}

enum LabRowNormaliser {

    private static let numberRe = try! NSRegularExpression(
        pattern: #"^\s*(<=|>=|<|>|≤|≥)?\s*=?\s*(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)\s*$"#)

    /// The number in a value text ("13.5", "<5", "1,234"); nil for words.
    static func number(from valueText: String) -> (value: Double, censor: String?)? {
        let ns = valueText as NSString
        guard let m = numberRe.firstMatch(in: valueText, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let censor = m.range(at: 1).location != NSNotFound ? ns.substring(with: m.range(at: 1)) : nil
        let digits = ns.substring(with: m.range(at: 2)).replacingOccurrences(of: ",", with: "")
        guard let v = Double(digits) else { return nil }
        return (v, censor)
    }

    static func format(_ v: Double, decimals: Int) -> String {
        String(format: "%.\(max(0, min(decimals, 4)))f", v)
    }

    static func assess(analyteKey: String?, name: String, valueText: String, unit: String,
                       referenceRange: String, flag: String, specimen: LabSpecimen) -> LabRowAssessment {
        var issues: [LabRowIssue] = []
        let parsed = number(from: valueText)
        let printedUnit = unit.trimmingCharacters(in: .whitespaces)
        // "7,800" is saved as "7800": the readers stop at a comma (latestLab) or read it as a
        // decimal point (LabPanel).
        var storedValue = valueText.trimmingCharacters(in: .whitespaces)
        if parsed != nil { storedValue = storedValue.replacingOccurrences(of: ",", with: "") }
        var storedUnit = printedUnit
        var conversionNote: String?

        if let analyte = LabAnalyteCatalog.analyte(forKey: analyteKey) {
            if let parsed {
                var appValue: Double?
                if let appUnit = analyte.appUnit {
                    let u = LabUnits.normalise(printedUnit)
                    if printedUnit.isEmpty || u.isEmpty {
                        if analyte.unitAliases.contains("") || !analyte.unitRequired {
                            appValue = parsed.value
                        } else {
                            issues.append(.unitMissing(expected: appUnit))
                        }
                    } else if analyte.unitAliases.contains(u) {
                        appValue = parsed.value
                    } else if let factor = analyte.conversions[u] {
                        let converted = parsed.value * factor
                        appValue = converted
                        storedValue = (parsed.censor ?? "") + format(converted, decimals: analyte.decimals)
                        storedUnit = appUnit
                        conversionNote = "converted from \(valueText.trimmingCharacters(in: .whitespaces)) \(printedUnit)"
                    } else if let reason = analyte.ambiguousUnits[u] {
                        issues.append(.unitAmbiguous(reason))
                    } else {
                        issues.append(.unitUnexpected(unit: printedUnit, expected: appUnit))
                    }
                } else {
                    appValue = parsed.value
                }
                if let v = appValue {
                    if parsed.censor == nil, let p = analyte.plausible, !p.contains(v) {
                        issues.append(.implausible(analyte.name))
                    }
                    if let rule = analyte.misread, rule.applies(to: v) {
                        issues.append(.scoreMisread(rule.message))
                    }
                }
                if parsed.censor != nil {
                    issues.append(.censored(storedValue.trimmingCharacters(in: CharacterSet(charactersIn: "<>=≤≥ "))))
                }
                if parsed.value < 0 { issues.append(.negative) }
            } else {
                issues.append(.nonNumeric)
            }
        } else {
            issues.append(.unmapped)
            let readers = LabPanelProbe.readers(ofName: name)
            if !readers.isEmpty { issues.append(.readAsOther(readers)) }
            if let parsed, parsed.value < 0, !readers.isEmpty { issues.append(.negative) }
        }
        if specimen == .urine { issues.append(.urine) }

        return LabRowAssessment(number: parsed?.value, censor: parsed?.censor,
                                storedValue: storedValue, storedUnit: storedUnit,
                                conversionNote: conversionNote,
                                abnormality: abnormality(value: parsed?.value, range: referenceRange, flag: flag),
                                issues: issues)
    }

    private static let rangeTwo = try! NSRegularExpression(
        pattern: #"([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:-|to)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)"#, options: [.caseInsensitive])
    private static let rangeOne = try! NSRegularExpression(
        pattern: #"(<=|>=|<|>|≤|≥|up\s+to|less\s+than|greater\s+than)\s*(\d+(?:\.\d+)?)"#, options: [.caseInsensitive])

    /// From the printed flag first, else by comparing the printed value with the printed range.
    static func abnormality(value: Double?, range: String, flag: String) -> LabAbnormality {
        let f = flag.trimmingCharacters(in: CharacterSet(charactersIn: "()[] ")).uppercased()
        switch f {
        case "H", "HH", "HI", "HIGH", "↑": return .high
        case "L", "LL", "LO", "LOW", "↓": return .low
        case "A", "ABN", "ABNORMAL", "*", "**", "C", "CRIT", "CRITICAL", "!", "+": return .abnormal
        case "N", "NORMAL": return .normal
        default: break
        }
        guard let value else { return .unknown }
        let ns = range as NSString
        let full = NSRange(location: 0, length: ns.length)
        func rangeNumber(_ r: NSRange) -> Double? {
            Double(ns.substring(with: r).replacingOccurrences(of: ",", with: "").replacingOccurrences(of: "+", with: ""))
        }
        if let m = rangeTwo.firstMatch(in: range, range: full),
           let lo = rangeNumber(m.range(at: 1)),
           let hi = rangeNumber(m.range(at: 2)), lo <= hi {
            if value < lo { return .low }
            if value > hi { return .high }
            return .normal
        }
        if let m = rangeOne.firstMatch(in: range, range: full),
           let limit = rangeNumber(m.range(at: 2)) {
            let op = ns.substring(with: m.range(at: 1)).lowercased()
            if op.hasPrefix("<") || op == "≤" || op.hasPrefix("up") || op.hasPrefix("less") {
                return value > limit ? .high : .normal
            }
            return value < limit ? .low : .normal
        }
        return .unknown
    }
}
