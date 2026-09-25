// ImagingReportParser.swift
// Deterministic parser for the text of an imaging report (Tapion Hospital imaging PDF; OKEU or
// St Jude's the same way). No structured values: it finds the patient header, accession/study
// number, exam date, modality and examination title, and splits the narrative into Findings and
// Impression/Conclusion under the usual headings. The full text is always kept (it is stored with
// the attached PDF). Images (DICOM) are never imported: they stay in the hospital portal.
//
// Also here: which kind of report a text is (lab or imaging), and the "Portal link" check
// (a pasted address is opened in Safari only; never fetched, and never stored when it carries
// credentials).

import Foundation

// MARK: - Modality

enum ImagingModality: String, CaseIterable, Identifiable, Codable {
    case ultrasound, ct, mri, xray, fluoroscopy, mammography, nuclear, pet, dexa, other

    var id: String { rawValue }

    /// Short label used in the saved investigation name ("US Abdomen", "CT Abdomen/Pelvis").
    var shortLabel: String {
        switch self {
        case .ultrasound:  return "US"
        case .ct:          return "CT"
        case .mri:         return "MRI"
        case .xray:        return "X-ray"
        case .fluoroscopy: return "Fluoroscopy"
        case .mammography: return "Mammography"
        case .nuclear:     return "Nuclear medicine"
        case .pet:         return "PET-CT"
        case .dexa:        return "DEXA"
        case .other:       return "Imaging"
        }
    }

    var displayName: String {
        switch self {
        case .ultrasound:  return "Ultrasound"
        case .ct:          return "CT"
        case .mri:         return "MRI / MRCP"
        case .xray:        return "X-ray"
        case .fluoroscopy: return "Fluoroscopy / contrast study"
        case .mammography: return "Mammography"
        case .nuclear:     return "Nuclear medicine"
        case .pet:         return "PET-CT"
        case .dexa:        return "DEXA"
        case .other:       return "Other imaging"
        }
    }

    /// (regex, case-sensitive, modality) in priority order: the more specific test first.
    /// Short abbreviations that are also ordinary words or titles ("US", "CT", "PET", "MR") only
    /// count in capitals.
    private static let patterns: [(String, Bool, ImagingModality)] = [
        (#"\bPET(?:\s*[-/]?\s*CT)?\b"#, true, .pet),
        (#"positron\s+emission"#, false, .pet),
        (#"mammo(?:gram|graphy)?\b|\btomosynthesis"#, false, .mammography),
        (#"\bdexa\b|\bdxa\b|bone\s+densitometry"#, false, .dexa),
        (#"\bmrcp\b|\bmri\b|\bmra\b|magnetic\s+resonance"#, false, .mri),
        (#"\bMR\b"#, true, .mri),
        (#"\bCTA?\b|\bCECT\b|\bHRCT\b"#, true, .ct),
        (#"computed\s+tomography|\bcat\s+scan|\bct\s*-?\s*(?:scan|angiogra|abdomen|chest|head|brain|thorax|pelvis|urogra|colonogra|kub)"#, false, .ct),
        (#"\bUSG?\b"#, true, .ultrasound),
        (#"ultraso(?:und|nography)|sonograph|\bdoppler\b|\beus\b|echograph|duplex"#, false, .ultrasound),
        (#"fluoroscop|barium|(?:contrast|water-?soluble|gastrografin)\s+(?:swallow|meal|enema|study|follow)|cholangiogra(?:m|phy)|\bivu\b|urethrogra|fistulogra|sinogra|\bhsg\b"#, false, .fluoroscopy),
        (#"scintigra|nuclear\s+medicine|\bhida\b|\bmibg\b|\bspect\b|isotope|bone\s+scan|\bmag3\b|\bdmsa\b"#, false, .nuclear),
        (#"x-?ray|radiograph|\bcxr\b|\baxr\b|plain\s+film|\bkub\b|chest\s+(?:pa|ap)\b"#, false, .xray),
    ]

    private static let compiled: [(NSRegularExpression, ImagingModality)] = patterns.map {
        (try! NSRegularExpression(pattern: $0.0, options: $0.1 ? [] : [.caseInsensitive]), $0.2)
    }

    /// The modality named in `text`, if any.
    static func detect(in text: String) -> ImagingModality? {
        let range = NSRange(location: 0, length: (text as NSString).length)
        for (re, modality) in compiled where re.firstMatch(in: text, range: range) != nil {
            return modality
        }
        return nil
    }
}

// MARK: - Parsed report

struct ParsedImagingReport: Equatable {
    var header: ReportHeader
    var modality: ImagingModality?
    var examTitle: String?
    var clinicalHistory: String
    var technique: String
    var comparison: String
    var findings: String
    var impression: String
    var fullText: String
}

enum ImagingSection: Hashable {
    case findings, impression, clinical, technique, comparison, signature
}

enum ImagingReportParser {

    private static let headingWords: [(words: [String], section: ImagingSection)] = [
        (["final impression", "impression", "impressions", "conclusion", "conclusions", "opinion",
          "summary", "diagnosis", "interpretation", "radiologist's impression",
          "radiologist impression", "comment", "comments"], .impression),
        (["findings", "finding", "report", "results", "result", "observations", "description",
          "details"], .findings),
        (["clinical history", "clinical information", "clinical details", "clinical indication",
          "clinical data", "clinical notes", "clinical", "indication", "indications", "history",
          "reason for exam", "reason for study", "reason for examination", "reason for referral",
          "referral reason"], .clinical),
        (["technique", "protocol", "method", "procedure details", "procedure"], .technique),
        (["comparison", "comparisons", "prior studies", "previous studies", "prior", "previous"], .comparison),
        (["reported by", "dictated by", "electronically signed by", "electronically signed",
          "signed by", "verified by", "transcribed by", "radiologist", "consultant radiologist",
          "reporting radiologist"], .signature),
    ]

    /// (section, text after the heading on the same line) when `line` starts with a heading.
    static func heading(_ line: String) -> (ImagingSection, String)? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        let lower = trimmed.lowercased()
        var best: (ImagingSection, String, Int)?
        for group in headingWords {
            for w in group.words where lower.hasPrefix(w) {
                let after = trimmed.dropFirst(w.count)
                let rest = after.trimmingCharacters(in: .whitespaces)
                // Heading alone on its line, or followed by ":" / "-". A signature line
                // ("Electronically signed by Dr …") ends the report text with or without a colon.
                let isAlone = rest.isEmpty || rest == ":" || rest == "-"
                let hasSeparator = after.first == ":" || rest.hasPrefix(":") || rest.hasPrefix("- ")
                let isSignature = group.section == .signature && (after.first == " " || isAlone || hasSeparator)
                guard isAlone || hasSeparator || isSignature else { continue }
                if best == nil || w.count > best!.2 {
                    let text = rest.drop(while: { $0 == ":" || $0 == "-" || $0 == " " })
                    best = (group.section, String(text), w.count)
                }
            }
        }
        return best.map { ($0.0, $0.1) }
    }

    static func parse(text: String, now: Date = Date()) -> ParsedImagingReport {
        let lines = LabReportParser.split(text).map(\.text)
        let header = ReportHeaderParser.parse(lines: lines, now: now)

        var buckets: [ImagingSection: [String]] = [:]
        var current: ImagingSection?
        var preamble: [String] = []
        var examTitle = header.examTitle

        for (i, line) in lines.enumerated() {
            if line.range(of: #"^page\s+\d+(\s+of\s+\d+)?$"#, options: [.regularExpression, .caseInsensitive]) != nil {
                continue
            }
            if let h = heading(line) {
                let (section, rest) = h
                current = section
                if !rest.isEmpty { buckets[section, default: []].append(rest) }
                continue
            }
            if header.headerLineIndices.contains(i) { continue }
            guard !line.isEmpty else {
                if let current { buckets[current, default: []].append("") }
                continue
            }
            if let current {
                buckets[current, default: []].append(line)
            } else {
                preamble.append(line)
            }
        }

        // Title: the labelled exam, else the first early line that names a modality.
        if examTitle == nil {
            examTitle = preamble.prefix(20).first { l in
                ImagingModality.detect(in: l) != nil && l.count <= 100 && l.filter(\.isLetter).count >= 2
            }
        }
        let titleText = examTitle ?? ""
        let modality = ImagingModality.detect(in: titleText)
            ?? ImagingModality.detect(in: preamble.prefix(25).joined(separator: " "))

        func sectionText(_ s: ImagingSection) -> String {
            joinParagraphs(buckets[s] ?? [])
        }
        var findings = sectionText(.findings)
        // No headings at all: the body is the findings.
        if buckets.isEmpty {
            findings = joinParagraphs(preamble.filter { $0 != examTitle })
        }

        return ParsedImagingReport(header: header,
                                   modality: modality,
                                   examTitle: examTitle.map(cleanTitle),
                                   clinicalHistory: sectionText(.clinical),
                                   technique: sectionText(.technique),
                                   comparison: sectionText(.comparison),
                                   findings: findings,
                                   impression: sectionText(.impression),
                                   fullText: text.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// Lines joined into paragraphs (blank line = paragraph break), trimmed.
    static func joinParagraphs(_ lines: [String]) -> String {
        var paragraphs: [String] = []
        var current: [String] = []
        for l in lines {
            if l.isEmpty {
                if !current.isEmpty { paragraphs.append(current.joined(separator: " ")); current = [] }
            } else if l.hasPrefix("-") || l.hasPrefix("•") || l.range(of: #"^\d+[.)]\s"#, options: .regularExpression) != nil {
                if !current.isEmpty { paragraphs.append(current.joined(separator: " ")) }
                current = [l]
            } else {
                current.append(l)
            }
        }
        if !current.isEmpty { paragraphs.append(current.joined(separator: " ")) }
        return paragraphs.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func cleanTitle(_ raw: String) -> String {
        let t = raw.trimmingCharacters(in: CharacterSet(charactersIn: " :-"))
        return t.count > 100 ? String(t.prefix(100)) : t
    }

    /// The saved investigation name: "<modality> <exam>", without repeating the modality.
    static func investigationName(modality: ImagingModality, exam: String) -> String {
        let e = exam.trimmingCharacters(in: .whitespaces)
        guard !e.isEmpty else { return modality.shortLabel + " report" }
        if ImagingModality.detect(in: e) == modality { return e }
        return modality.shortLabel + " " + e
    }
}

// MARK: - Which kind of report

enum ReportKind: String, CaseIterable, Identifiable {
    case lab, imaging
    var id: String { rawValue }
}

enum ReportKindGuesser {
    /// Imaging when the text has imaging headings (Findings / Impression / Conclusion) or names
    /// a modality and has few lab rows; lab otherwise.
    static func guess(text: String) -> ReportKind {
        let lines = LabReportParser.split(text).map(\.text)
        let headings = lines.compactMap { ImagingReportParser.heading($0)?.0 }
        let imagingHeadings = headings.filter { $0 == .impression || $0 == .findings || $0 == .technique }.count
        let modality = ImagingModality.detect(in: lines.prefix(30).joined(separator: " ")) != nil
        let labRows = LabReportParser.parse(text: text).rows.filter { $0.analyteKey != nil }.count
        var imagingScore = imagingHeadings * 2 + (modality ? 2 : 0)
        if lines.contains(where: { $0.lowercased().contains("radiolog") }) { imagingScore += 1 }
        if labRows >= 3, labRows * 2 >= imagingScore { return .lab }
        if imagingScore >= 3 { return .imaging }
        return labRows > 0 ? .lab : (imagingScore > 0 ? .imaging : .lab)
    }
}

// MARK: - Portal link

enum PortalLinkError: Error, Equatable {
    case notALink
    case notWeb
    case containsCredentials

    var message: String {
        switch self {
        case .notALink: return "This is not a web address."
        case .notWeb: return "Only http(s) portal addresses can be saved."
        case .containsCredentials:
            return "This address contains a login or access token. Paste the study's address without it — MedFlow never stores portal credentials."
        }
    }
}

enum PortalLink {
    private static let credentialNames: Set<String> = [
        "token", "access_token", "id_token", "auth", "authtoken", "auth_token", "session",
        "sessionid", "session_id", "sid", "jsessionid", "password", "pass", "pwd", "passwd",
        "key", "apikey", "api_key", "secret", "sig", "signature", "jwt", "otp", "code", "ticket",
        "user", "username", "login",
    ]

    /// A pasted portal address, checked: http(s), a host, no user:password@ and no
    /// credential-like query or fragment parameters. Never fetched.
    static func validate(_ raw: String) -> Result<URL, PortalLinkError> {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains(" "),
              let comps = URLComponents(string: trimmed),
              let scheme = comps.scheme?.lowercased() else { return .failure(.notALink) }
        guard scheme == "https" || scheme == "http" else { return .failure(.notWeb) }
        guard let host = comps.host, !host.isEmpty, let url = comps.url else { return .failure(.notALink) }
        if comps.user != nil || comps.password != nil { return .failure(.containsCredentials) }
        var names = (comps.queryItems ?? []).map { $0.name.lowercased() }
        if let fragment = comps.fragment,
           let fragmentItems = URLComponents(string: "x:?" + fragment)?.queryItems {
            names += fragmentItems.map { $0.name.lowercased() }
        }
        if names.contains(where: { n in credentialNames.contains(n) || n.hasSuffix("token") || n.hasSuffix("password") }) {
            return .failure(.containsCredentials)
        }
        return .success(url)
    }
}
