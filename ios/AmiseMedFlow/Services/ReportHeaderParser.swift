// ReportHeaderParser.swift
// Patient and report identifiers from the text of an imported lab or imaging report
// (Laboratory Services Ltd, Tapion Hospital imaging, ...), and the check that the report
// belongs to the chart it is being filed to. Pure and deterministic: no network, no AI.
//
// Header fields are found by label ("Patient Name:", "DOB", "Lab No:", "Collected:", ...). Several
// labels may share one line; each value runs to the next label. Short labels ("Name", "Age",
// "Sex", "Date") need a separator (":" or "#") so result lines such as "Sex hormone binding
// globulin 40 nmol/L" are not read as headers.
//
// Dates: day/month/year is assumed (Saint Lucia convention). When both numbers are 12 or less the
// date is marked ambiguous; the identity check then reports a DOB that only matches when read as
// month/day instead of silently accepting it.

import Foundation

// MARK: - Dates

struct ReportDate: Equatable {
    var year: Int
    var month: Int
    var day: Int
    var hour: Int?
    var minute: Int?
    /// Both day and month were 12 or less and different: the order was assumed (day first).
    var dayMonthAmbiguous = false

    /// The same date read the other way round (month/day), when that is also a valid date.
    var swapped: ReportDate? {
        guard dayMonthAmbiguous else { return nil }
        var s = self
        s.month = day; s.day = month; s.dayMonthAmbiguous = false
        return ReportDateParser.isValid(year: s.year, month: s.month, day: s.day) ? s : nil
    }

    /// The instant in `timeZone`; a date without a time is taken as 12:00 so it stays on the same
    /// calendar day in any nearby time zone.
    func date(in timeZone: TimeZone) -> Date? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.date(from: DateComponents(year: year, month: month, day: day,
                                             hour: hour ?? 12, minute: minute ?? 0))
    }

    func sameDay(as other: ReportDate) -> Bool {
        year == other.year && month == other.month && day == other.day
    }
}

enum ReportDateParser {
    private static let months = ["jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                                 "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12]

    private static let isoRe = try! NSRegularExpression(
        pattern: #"(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)"#)
    private static let numericRe = try! NSRegularExpression(
        pattern: #"(?<!\d)(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?!\d)"#)
    private static let dayMonthNameRe = try! NSRegularExpression(
        pattern: #"(?<!\d)(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s\-/.,]+(\d{4}|\d{2})(?!\d)"#,
        options: [.caseInsensitive])
    private static let monthNameDayRe = try! NSRegularExpression(
        pattern: #"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)"#,
        options: [.caseInsensitive])
    private static let timeRe = try! NSRegularExpression(
        pattern: #"(?<!\d)(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?(?![\d])"#,
        options: [.caseInsensitive])

    static func isValid(year: Int, month: Int, day: Int) -> Bool {
        guard (1...12).contains(month), day >= 1, year >= 1850, year <= 2200 else { return false }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        guard let d = cal.date(from: DateComponents(year: year, month: month, day: 1)),
              let range = cal.range(of: .day, in: .month, for: d) else { return false }
        return range.contains(day)
    }

    /// The first date in `text`. `isBirthDate` picks the century of a two-digit year so the date
    /// is not in the future (relative to `now`); other two-digit years are 20xx.
    static func parse(_ text: String, isBirthDate: Bool = false, now: Date = Date()) -> ReportDate? {
        let ns = text as NSString
        let full = NSRange(location: 0, length: ns.length)
        var candidates: [(location: Int, date: ReportDate, end: Int)] = []

        if let m = isoRe.firstMatch(in: text, range: full),
           let y = Int(ns.substring(with: m.range(at: 1))),
           let mo = Int(ns.substring(with: m.range(at: 2))),
           let d = Int(ns.substring(with: m.range(at: 3))),
           isValid(year: y, month: mo, day: d) {
            candidates.append((m.range.location, ReportDate(year: y, month: mo, day: d), NSMaxRange(m.range)))
        }
        if let m = numericRe.firstMatch(in: text, range: full),
           let a = Int(ns.substring(with: m.range(at: 1))),
           let b = Int(ns.substring(with: m.range(at: 2))) {
            let y = fullYear(ns.substring(with: m.range(at: 3)), isBirthDate: isBirthDate, now: now)
            var date: ReportDate?
            if a > 12, isValid(year: y, month: b, day: a) {
                date = ReportDate(year: y, month: b, day: a)
            } else if b > 12, isValid(year: y, month: a, day: b) {
                date = ReportDate(year: y, month: a, day: b)          // month/day printed
            } else if isValid(year: y, month: b, day: a) {
                date = ReportDate(year: y, month: b, day: a, dayMonthAmbiguous: a != b)
            }
            if let date { candidates.append((m.range.location, date, NSMaxRange(m.range))) }
        }
        if let m = dayMonthNameRe.firstMatch(in: text, range: full),
           let d = Int(ns.substring(with: m.range(at: 1))),
           let mo = months[ns.substring(with: m.range(at: 2)).lowercased()] {
            let y = fullYear(ns.substring(with: m.range(at: 3)), isBirthDate: isBirthDate, now: now)
            if isValid(year: y, month: mo, day: d) {
                candidates.append((m.range.location, ReportDate(year: y, month: mo, day: d), NSMaxRange(m.range)))
            }
        }
        if let m = monthNameDayRe.firstMatch(in: text, range: full),
           let mo = months[ns.substring(with: m.range(at: 1)).lowercased()],
           let d = Int(ns.substring(with: m.range(at: 2))),
           let y = Int(ns.substring(with: m.range(at: 3))),
           isValid(year: y, month: mo, day: d) {
            candidates.append((m.range.location, ReportDate(year: y, month: mo, day: d), NSMaxRange(m.range)))
        }

        guard var best = candidates.min(by: { $0.location < $1.location }) else { return nil }
        // A time just after the date.
        let tailRange = NSRange(location: best.end, length: max(0, min(ns.length - best.end, 16)))
        if let t = timeRe.firstMatch(in: text, range: tailRange),
           var h = Int(ns.substring(with: t.range(at: 1))),
           let mi = Int(ns.substring(with: t.range(at: 2))) {
            if t.range(at: 3).location != NSNotFound {
                let ampm = ns.substring(with: t.range(at: 3)).lowercased()
                if ampm.hasPrefix("p"), h < 12 { h += 12 }
                if ampm.hasPrefix("a"), h == 12 { h = 0 }
            }
            if (0...23).contains(h), (0...59).contains(mi) {
                best.date.hour = h
                best.date.minute = mi
            }
        }
        return best.date
    }

    private static func fullYear(_ s: String, isBirthDate: Bool, now: Date) -> Int {
        guard let v = Int(s) else { return 0 }
        guard s.count == 2 else { return v }
        let current = Calendar(identifier: .gregorian).component(.year, from: now) % 100
        if isBirthDate { return v > current ? 1900 + v : 2000 + v }
        return 2000 + v
    }
}

// MARK: - Header

struct ReportHeader: Equatable {
    /// The first patient name printed.
    var patientName: String?
    /// Every distinct name printed (normalised); more than one means a mixed or wrong report.
    var allPatientNames: [String] = []
    var dateOfBirth: ReportDate?
    var ageYears: Int?
    var sex: Sex?
    var accession: String?
    var hospitalNumber: String?
    var collected: ReportDate?
    var received: ReportDate?
    var reported: ReportDate?
    var examDate: ReportDate?
    var examTitle: String?
    /// Line indices (in the parsed line array) that held header labels.
    var headerLineIndices: Set<Int> = []
}

enum ReportHeaderField: Equatable {
    case name, dob, age, ageSex, sex, accession, hospitalNumber
    case collected, received, reported, examDate, genericDate, exam
    case ignored        // labels that only end the previous value (doctor, address, phone, ...)
}

enum ReportHeaderParser {

    /// (regex for the label, field, separator required)
    private static let labelSpecs: [(pattern: String, field: ReportHeaderField, needsSeparator: Bool)] = [
        (#"patient'?s?\s+name"#, .name, false),
        (#"pt\.?\s+name"#, .name, false),
        (#"name\s+of\s+patient"#, .name, false),
        (#"patient"#, .name, true),
        (#"name"#, .name, true),
        (#"date\s+of\s+birth"#, .dob, false),
        (#"birth\s*date"#, .dob, false),
        (#"d\.\s?o\.\s?b\.?"#, .dob, false),
        (#"dob"#, .dob, false),
        (#"age\s*/\s*sex"#, .ageSex, false),
        (#"age\s*/\s*gender"#, .ageSex, false),
        (#"sex\s*/\s*age"#, .ageSex, false),
        (#"age"#, .age, true),
        (#"sex"#, .sex, true),
        (#"gender"#, .sex, true),
        (#"lab(?:oratory)?\s*(?:no|number|ref(?:erence)?|id|#)\.?"#, .accession, false),
        (#"accession\s*(?:no|number|#)?\.?"#, .accession, false),
        (#"specimen\s*(?:no|number|id)\.?"#, .accession, false),
        (#"sample\s*(?:no|number|id)\.?"#, .accession, false),
        (#"request\s*(?:no|number|id)\.?"#, .accession, false),
        (#"episode\s*(?:no|number)\.?"#, .accession, false),
        (#"order\s*(?:no|number)\.?"#, .accession, false),
        (#"study\s*(?:no|number|id)\.?"#, .accession, false),
        (#"exam(?:ination)?\s*(?:no|number|id)\.?"#, .accession, false),
        (#"report\s*(?:no|number|id)\.?"#, .accession, false),
        (#"ref(?:erence)?\s*(?:no|number)\.?"#, .accession, false),
        (#"mrn"#, .hospitalNumber, true),
        (#"hospital\s*(?:no|number)\.?"#, .hospitalNumber, false),
        (#"patient\s*id"#, .hospitalNumber, false),
        (#"chart\s*(?:no|number)\.?"#, .hospitalNumber, false),
        (#"(?:date\s+)?(?:of\s+)?collect(?:ed|ion)(?:\s+date)?(?:\s*/\s*time)?"#, .collected, true),
        (#"sample\s+date"#, .collected, true),
        (#"specimen\s+(?:date|collected)"#, .collected, true),
        (#"drawn"#, .collected, true),
        (#"(?:date\s+)?received(?:\s+date)?"#, .received, true),
        (#"(?:date\s+)?report(?:ed)?\s*(?:date|on)?"#, .reported, true),
        (#"authori[sz]ed(?:\s+on)?"#, .reported, true),
        (#"(?:date\s+)?(?:verified|validated|released|printed)(?:\s+on)?"#, .reported, true),
        (#"(?:exam(?:ination)?|study|scan|procedure)\s+date"#, .examDate, true),
        (#"date\s+of\s+(?:exam(?:ination)?|study|scan|procedure)"#, .examDate, true),
        (#"date"#, .genericDate, true),
        (#"exam(?:ination)?(?:\s+type)?"#, .exam, true),
        (#"study(?:\s+type)?"#, .exam, true),
        (#"procedure"#, .exam, true),
        (#"(?:referring|requesting|ordering)\s+(?:doctor|physician|clinician)"#, .ignored, true),
        (#"(?:doctor|physician|consultant|clinician|requested\s+by|referred\s+by|ordered\s+by)"#, .ignored, true),
        (#"(?:tel(?:ephone)?|phone|fax|e-?mail|address|location|ward|clinic|source|insurance|page)"#, .ignored, true),
    ]

    private static let compiled: [(re: NSRegularExpression, field: ReportHeaderField)] = labelSpecs.map { spec in
        let sep = spec.needsSeparator ? #"\s*[:#]"# : #"\s*[:#.\-]?"#
        let pattern = #"(?<![A-Za-z0-9])(?:"# + spec.pattern + #")(?![A-Za-z])"# + sep
        return (try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive]), spec.field)
    }

    struct LabelHit: Equatable {
        let location: Int
        let end: Int
        let field: ReportHeaderField
    }

    /// Label occurrences in one line: overlaps resolved (earliest, then longest), in order.
    static func labels(in line: String) -> [LabelHit] {
        let ns = line as NSString
        let full = NSRange(location: 0, length: ns.length)
        var hits: [LabelHit] = []
        for spec in compiled {
            for m in spec.re.matches(in: line, range: full) {
                hits.append(LabelHit(location: m.range.location, end: NSMaxRange(m.range), field: spec.field))
            }
        }
        hits.sort { $0.location != $1.location ? $0.location < $1.location : $0.end > $1.end }
        var kept: [LabelHit] = []
        for h in hits where kept.last.map({ h.location >= $0.end }) ?? true {
            kept.append(h)
        }
        return kept
    }

    /// (field, value) pairs of one line.
    static func fields(in line: String) -> [(field: ReportHeaderField, value: String)] {
        let ns = line as NSString
        let hits = labels(in: line)
        var out: [(field: ReportHeaderField, value: String)] = []
        for (i, h) in hits.enumerated() {
            let end = i + 1 < hits.count ? hits[i + 1].location : ns.length
            guard end >= h.end else { continue }
            let raw = ns.substring(with: NSRange(location: h.end, length: end - h.end))
            let value = raw.trimmingCharacters(in: CharacterSet(charactersIn: " \t:#-|,;"))
            out.append((h.field, value))
        }
        return out
    }

    static func parse(lines: [String], now: Date = Date()) -> ReportHeader {
        var h = ReportHeader()
        var normalisedNames: [String] = []
        for (index, line) in lines.enumerated() {
            let pairs = fields(in: line)
            guard !pairs.isEmpty else { continue }
            var usedLine = false
            for (field, value) in pairs {
                switch field {
                case .name:
                    guard let name = cleanName(value) else { continue }
                    usedLine = true
                    if h.patientName == nil { h.patientName = name }
                    let key = PatientIdentityMatcher.nameTokens(name).sorted().joined(separator: " ")
                    if !key.isEmpty, !normalisedNames.contains(key) {
                        normalisedNames.append(key)
                        h.allPatientNames.append(name)
                    }
                case .dob:
                    usedLine = true
                    if h.dateOfBirth == nil { h.dateOfBirth = ReportDateParser.parse(value, isBirthDate: true, now: now) }
                    if h.ageYears == nil { h.ageYears = age(in: value, allowBare: false) }
                case .age:
                    usedLine = true
                    if h.ageYears == nil { h.ageYears = age(in: value, allowBare: true) }
                case .ageSex:
                    usedLine = true
                    if h.ageYears == nil { h.ageYears = age(in: value, allowBare: true) }
                    if h.sex == nil { h.sex = sex(in: value) }
                case .sex:
                    usedLine = true
                    if h.sex == nil { h.sex = sex(in: value) }
                case .accession:
                    usedLine = true
                    if h.accession == nil { h.accession = identifier(value) }
                case .hospitalNumber:
                    usedLine = true
                    if h.hospitalNumber == nil { h.hospitalNumber = identifier(value) }
                case .collected:
                    usedLine = true
                    if h.collected == nil { h.collected = ReportDateParser.parse(value, now: now) }
                case .received:
                    usedLine = true
                    if h.received == nil { h.received = ReportDateParser.parse(value, now: now) }
                case .reported:
                    usedLine = true
                    if h.reported == nil { h.reported = ReportDateParser.parse(value, now: now) }
                case .examDate:
                    usedLine = true
                    if h.examDate == nil { h.examDate = ReportDateParser.parse(value, now: now) }
                case .genericDate:
                    usedLine = true
                    if h.examDate == nil { h.examDate = ReportDateParser.parse(value, now: now) }
                case .exam:
                    usedLine = true
                    let title = value.trimmingCharacters(in: .whitespaces)
                    if h.examTitle == nil, title.count >= 2, title.count <= 120 { h.examTitle = title }
                case .ignored:
                    usedLine = true
                }
            }
            if usedLine { h.headerLineIndices.insert(index) }
        }
        return h
    }

    // MARK: Value cleaning

    /// A printed name without trailing age/sex/ids; nil when it does not look like a name.
    static func cleanName(_ raw: String) -> String? {
        // "DOE, JANE F 45Y" / "DOE, JANE M/45": a sex marker just before the age is not a name.
        var s = raw.replacingOccurrences(of: #"[\s/]+(?:m|f|male|female)[\s/]*(?=\d)"#, with: " ",
                                         options: [.regularExpression, .caseInsensitive])
        if let digit = s.firstIndex(where: { $0.isNumber }) { s = String(s[..<digit]) }
        s = s.replacingOccurrences(of: #"\((?:m|f|male|female)\)"#, with: "",
                                   options: [.regularExpression, .caseInsensitive])
        s = s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        s = s.trimmingCharacters(in: CharacterSet(charactersIn: " \t:#-|,;/("))
        let letters = s.filter { $0.isLetter }.count
        guard letters >= 2, s.count <= 80 else { return nil }
        return s
    }

    static func age(in raw: String, allowBare: Bool) -> Int? {
        let lower = raw.lowercased()
        let withUnit = try! NSRegularExpression(pattern: #"(?<!\d)(\d{1,3})\s*(?:y|yr|yrs|year|years)\b"#)
        let ns = lower as NSString
        if let m = withUnit.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)),
           let v = Int(ns.substring(with: m.range(at: 1))), v < 130 { return v }
        guard allowBare else { return nil }
        let bare = try! NSRegularExpression(pattern: #"^\s*(\d{1,3})(?!\d)(?!\s*(?:m|mo|mth|months|d|days|w|wk|weeks)\b)"#)
        if let m = bare.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)),
           let v = Int(ns.substring(with: m.range(at: 1))), v < 130 { return v }
        return nil
    }

    static func sex(in raw: String) -> Sex? {
        let tokens = raw.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
        for t in tokens {
            let letters = t.filter(\.isLetter)
            if ["m", "male", "man"].contains(letters) { return .male }
            if ["f", "female", "woman"].contains(letters) { return .female }
        }
        return nil
    }

    static func identifier(_ raw: String) -> String? {
        let token = raw.split(whereSeparator: { $0 == " " || $0 == "\t" }).first.map(String.init) ?? ""
        let cleaned = token.trimmingCharacters(in: CharacterSet(charactersIn: ":#.,;|"))
        return cleaned.count >= 2 && cleaned.count <= 40 ? cleaned : nil
    }
}

// MARK: - Identity check

/// Does the report belong to this chart? Never auto-files to anyone: the result only decides
/// whether the clinician must confirm explicitly.
struct ReportIdentityCheck: Equatable {
    enum NameResult: Equatable {
        case exact
        /// Same person as far as the name goes, but not identical (middle name, initial, joined names).
        case compatible(String)
        case mismatch
        case missingInReport
    }
    enum DOBResult: Equatable {
        case match
        /// Matches only if the printed date is read month/day.
        case matchesOnlyIfSwapped
        case mismatch
        case missingInReport
        case missingInChart
    }

    var name: NameResult
    var dob: DOBResult
    var sexMismatch = false
    var ageMismatch = false
    var multipleNamesInReport = false

    /// True when name and DOB both agree and nothing else conflicts.
    var isConsistent: Bool {
        let nameOK: Bool
        switch name {
        case .exact, .compatible: nameOK = true
        default: nameOK = false
        }
        return nameOK && dob == .match && !sexMismatch && !ageMismatch && !multipleNamesInReport
    }

    /// The clinician must tick "This report belongs to …" before anything is saved.
    var requiresConfirmation: Bool { !isConsistent }

    /// Plain-language reasons, most important first.
    var messages: [String] {
        var out: [String] = []
        if multipleNamesInReport { out.append("The report contains more than one patient name.") }
        switch name {
        case .mismatch: out.append("The name on the report does not match this chart.")
        case .missingInReport: out.append("No patient name was found on the report.")
        case .compatible(let note): out.append("Name is similar but not identical (\(note)).")
        case .exact: break
        }
        switch dob {
        case .mismatch: out.append("The date of birth on the report does not match this chart.")
        case .matchesOnlyIfSwapped: out.append("The date of birth matches only if the report's date is read month/day — check it.")
        case .missingInReport: out.append("No date of birth was found on the report.")
        case .missingInChart: out.append("This chart has no date of birth to compare.")
        case .match: break
        }
        if sexMismatch { out.append("The sex on the report does not match this chart.") }
        if ageMismatch { out.append("The age on the report does not match this chart.") }
        return out
    }
}

enum PatientIdentityMatcher {

    private static let titles: Set<String> = ["mr", "mrs", "ms", "miss", "mstr", "master", "dr", "prof", "rev", "mx"]

    /// Lowercased, accent-free name words without titles; apostrophes joined ("O'Neil" → "oneil"),
    /// hyphens and punctuation split.
    static func nameTokens(_ name: String) -> [String] {
        let folded = name.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "’", with: "")
            .replacingOccurrences(of: "`", with: "")
        return folded
            .components(separatedBy: CharacterSet.letters.inverted)
            .filter { !$0.isEmpty && !titles.contains($0) }
    }

    static func compareNames(report: String?, chart: String) -> ReportIdentityCheck.NameResult {
        guard let report, !nameTokens(report).isEmpty else { return .missingInReport }
        let a = nameTokens(report), b = nameTokens(chart)
        guard !b.isEmpty else { return .mismatch }
        if Set(a) == Set(b) { return .exact }
        if a.joined() == b.joined() {
            return .compatible("spacing or hyphen differs")
        }
        let (small, large) = a.count <= b.count ? (a, b) : (b, a)
        guard small.count >= 2 else { return .mismatch }
        var remaining = large
        var fullMatches = 0
        var usedInitial = false
        var usedJoin = false
        for token in small {
            if let i = remaining.firstIndex(of: token) {
                remaining.remove(at: i); fullMatches += 1
            } else if let j = joinedPairIndex(token, in: remaining) {
                remaining.removeSubrange(j...(j + 1)); fullMatches += 1; usedJoin = true
            } else if token.count == 1, let i = remaining.firstIndex(where: { $0.first == token.first }) {
                remaining.remove(at: i); usedInitial = true
            } else if let i = remaining.firstIndex(where: { $0.count == 1 && token.first == $0.first }) {
                remaining.remove(at: i); usedInitial = true
            } else {
                return .mismatch
            }
        }
        guard fullMatches >= 1 else { return .mismatch }
        var notes: [String] = []
        if !remaining.isEmpty { notes.append("extra name on one side") }
        if usedInitial { notes.append("initial only") }
        if usedJoin { notes.append("joined names") }
        return .compatible(notes.isEmpty ? "word order" : notes.joined(separator: ", "))
    }

    /// Where the patient search starts for a shared report: the surname as printed ("DOE, JANE"
    /// → "DOE", "Mr Jane Doe" → "Doe"), or the whole name when the surname is too short to search.
    /// Staff still choose the patient themselves; nothing is selected automatically.
    static func searchSeed(from reportName: String?) -> String {
        guard let name = reportName?.trimmingCharacters(in: .whitespaces), !name.isEmpty else { return "" }
        let surname: String
        if let comma = name.firstIndex(of: ",") {
            surname = String(name[..<comma])
        } else {
            surname = name.split(separator: " ").last.map(String.init) ?? name
        }
        let trimmed = surname.trimmingCharacters(in: .whitespaces.union(.punctuationCharacters))
        return trimmed.count >= QuestionnairePatientSearch.minimumNameLength ? trimmed : name
    }

    private static func joinedPairIndex(_ token: String, in words: [String]) -> Int? {
        guard words.count >= 2 else { return nil }
        for i in 0..<(words.count - 1) where words[i] + words[i + 1] == token { return i }
        return nil
    }

    /// The chart DOB as calendar days: in each time zone given (a DOB saved at local midnight on
    /// one device may read as the previous day in UTC).
    static func chartDOBDays(_ dob: Date, timeZones: [TimeZone]) -> [ReportDate] {
        timeZones.map { tz in
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = tz
            let c = cal.dateComponents([.year, .month, .day], from: dob)
            return ReportDate(year: c.year ?? 0, month: c.month ?? 0, day: c.day ?? 0)
        }
    }

    static func check(header: ReportHeader,
                      chartName: String,
                      chartDOB: Date?,
                      chartSex: Sex,
                      timeZones: [TimeZone],
                      now: Date = Date()) -> ReportIdentityCheck {
        let name = compareNames(report: header.patientName, chart: chartName)
        let dob: ReportIdentityCheck.DOBResult
        if let reportDOB = header.dateOfBirth {
            if let chartDOB {
                let days = chartDOBDays(chartDOB, timeZones: timeZones)
                if days.contains(where: { $0.sameDay(as: reportDOB) }) {
                    dob = .match
                } else if let swapped = reportDOB.swapped, days.contains(where: { $0.sameDay(as: swapped) }) {
                    dob = .matchesOnlyIfSwapped
                } else {
                    dob = .mismatch
                }
            } else {
                dob = .missingInChart
            }
        } else {
            dob = .missingInReport
        }
        var result = ReportIdentityCheck(name: name, dob: dob)
        result.multipleNamesInReport = header.allPatientNames.count > 1
        if let s = header.sex, chartSex != .unspecified, s != chartSex { result.sexMismatch = true }
        if let age = header.ageYears, let chartDOB,
           let chartAge = Calendar(identifier: .gregorian).dateComponents([.year], from: chartDOB, to: now).year,
           abs(chartAge - age) > 1 {
            result.ageMismatch = true
        }
        return result
    }
}
