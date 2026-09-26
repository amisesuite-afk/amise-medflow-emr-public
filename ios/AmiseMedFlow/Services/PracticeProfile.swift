import Foundation
import Combine

// MARK: - Practice profile
//
// Practice identity (practice name, brand mark, clinician, sites, phone,
// letterhead) used on every generated document, letter, PDF, SMS and email.
// Previously these were hard-coded Amise Medical Services literals scattered
// across the codebase; they now come from `PracticeProfile.current` so the app
// can be piloted by other surgical practices.
//
// Storage: JSON in UserDefaults under `PracticeProfile.defaultsKey`.
// Missing or unreadable JSON falls back to `PracticeProfile.amiseDefault`, whose
// values reproduce the previous hard-coded text byte-for-byte — so behaviour for
// the existing practice is unchanged until someone edits the profile in Settings.
//
// Not covered here (deliberately): `ClinicalLocation` enum raw values
// ("Tapion", "Rodney Bay") — they are persisted in SwiftData and mapped to
// Supabase values by SyncService, so they are data, not display text.

struct PracticeSite: Codable, Equatable, Hashable, Identifiable {
    var id: String
    var name: String
    var address: String
    var phone: String

    init(id: String = UUID().uuidString, name: String, address: String = "", phone: String = "") {
        self.id = id
        self.name = name
        self.address = address
        self.phone = phone
    }
}

extension PracticeSite {
    enum CodingKeys: String, CodingKey {
        case id, name, address, phone
    }

    // Tolerant decoding: an older/partial site entry never invalidates the
    // whole profile.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id      = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name    = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        address = try c.decodeIfPresent(String.self, forKey: .address) ?? ""
        phone   = try c.decodeIfPresent(String.self, forKey: .phone) ?? ""
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(address, forKey: .address)
        try c.encode(phone, forKey: .phone)
    }
}

struct PracticeProfile: Codable, Equatable {
    /// Full practice name — document headers and footers. "Amise Medical Services"
    var practiceName: String
    /// Short practice name — SMS sender prefix and email subjects. "Amise Medical"
    var practiceShortName: String
    /// Large brand mark at the top-left of PDF headers. "AMISE"
    var brandMark: String
    /// Brand tagline shown under the brand mark on consultation PDFs.
    /// "Ambulatory Minimally Invasive Surgery & Endoscopy"
    var brandTagline: String
    /// Clinician's full name with title, no credentials. "Dr Dawit Daniel Kabiye"
    var clinicianName: String
    /// Short, patient-facing form used in appointment emails. "Dr. Dawit Kabiye"
    var clinicianShortName: String
    /// Post-nominals, comma-separated. "MD, DM"
    var clinicianCredentials: String
    /// Medical council registration number (optional). Printed under the
    /// signature on letters when set.
    var clinicianRegistrationNumber: String
    /// Clinician's role line under the signature on letters. "General & Endoscopic Surgeon"
    var clinicianTitle: String
    /// Specialty line. "General & Endoscopic Surgery"
    var specialty: String
    var sites: [PracticeSite]
    /// Primary contact number, formatted for display. "+1 (758) 284-0557"
    var primaryPhone: String
    /// Practice email / Google account used for calendar sync.
    var email: String
    /// Country / jurisdiction shown in footers and letters. "Saint Lucia"
    var country: String
    /// IANA time zone identifier. "America/St_Lucia"
    var timeZoneIdentifier: String
    /// Contact block printed at the top-right of PDF letterheads (first line
    /// emphasised; up to four lines fit).
    var letterheadLines: [String]

    // MARK: - Default (Amise Medical Services — today's exact values)

    static let amiseDefault = PracticeProfile(
        practiceName: "Amise Medical Services",
        practiceShortName: "Amise Medical",
        brandMark: "AMISE",
        brandTagline: "Ambulatory Minimally Invasive Surgery & Endoscopy",
        clinicianName: "Dr Dawit Daniel Kabiye",
        clinicianShortName: "Dr. Dawit Kabiye",
        clinicianCredentials: "MD, DM",
        clinicianRegistrationNumber: "",
        clinicianTitle: "General & Endoscopic Surgeon",
        specialty: "General & Endoscopic Surgery",
        sites: [
            PracticeSite(id: "tapion",
                         name: "Tapion Hospital",
                         address: "Tapion, Castries, Saint Lucia",
                         phone: "+1 (758) 284-0557"),
            PracticeSite(id: "rodney-bay",
                         name: "Rodney Bay",
                         address: "Rodney Bay, Gros Islet, Saint Lucia",
                         phone: "+1 (758) 720-7111")
        ],
        primaryPhone: "+1 (758) 284-0557",
        email: "amisesuite@gmail.com",
        country: "Saint Lucia",
        timeZoneIdentifier: "America/St_Lucia",
        letterheadLines: [
            "Amise Medical Services",
            "Saint Lucia, West Indies",
            "+1 758 284 0557  ·  amisemedical.com"
        ]
    )

    // MARK: - Derived display strings

    /// ["MD", "DM"] — individual post-nominals.
    var credentialList: [String] {
        clinicianCredentials
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    /// "MD DM" — credentials without commas, for compact footer lines.
    var credentialsCompact: String {
        clinicianCredentials
            .replacingOccurrences(of: ",", with: " ")
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
    }

    /// "Dr Dawit Daniel Kabiye MD DM" — footers, meta lines, list exports.
    var clinicianSignature: String {
        Self.join([clinicianName, credentialsCompact], separator: " ")
    }

    /// "Dr Dawit Daniel Kabiye, MD, DM" — pre-filled surgeon fields on forms.
    var clinicianNameWithCredentials: String {
        Self.join([clinicianName, clinicianCredentials], separator: ", ")
    }

    /// "Dr Dawit Daniel Kabiye  MD · DM" — PDF letterheads, signature blocks, letters.
    var clinicianLetterheadName: String {
        Self.join([clinicianName, credentialList.joined(separator: " · ")], separator: "  ")
    }

    /// "Dr Dawit Daniel Kabiye  MD · DM  ·  General & Endoscopic Surgery" — PDF header subtitle.
    var clinicianLetterheadLine: String {
        Self.join([clinicianLetterheadName, specialty], separator: "  ·  ")
    }

    /// "Consultant General & Endoscopic Surgeon" — letter sign-off role line.
    var consultantTitle: String {
        let t = clinicianTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty || t.lowercased().hasPrefix("consultant") { return t }
        return "Consultant \(t)"
    }

    /// "Amise Medical Services, Saint Lucia"
    var practiceNameWithCountry: String {
        Self.join([practiceName, country], separator: ", ")
    }

    /// "Amise Medical Services · Saint Lucia" — patient-facing headers and footers.
    var practiceNameAndCountryDotted: String {
        Self.join([practiceName, country], separator: " · ")
    }

    /// Short practice name, falling back to the full name when unset.
    var displayShortPracticeName: String {
        let s = practiceShortName.trimmingCharacters(in: .whitespacesAndNewlines)
        return s.isEmpty ? practiceName : s
    }

    /// Patient-facing clinician name, falling back to the full name when unset.
    var displayShortClinicianName: String {
        let s = clinicianShortName.trimmingCharacters(in: .whitespacesAndNewlines)
        return s.isEmpty ? clinicianName : s
    }

    /// "+1(758)284-0557" — primary phone with whitespace removed, for SMS bodies.
    var primaryPhoneCompact: String {
        primaryPhone.filter { !$0.isWhitespace }
    }

    /// "Registration No. X" when a registration number is set; appended under
    /// the signature on letters.
    var registrationLine: String? {
        let reg = clinicianRegistrationNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        return reg.isEmpty ? nil : "Registration No. \(reg)"
    }

    /// Letter sign-off lines followed by the registration line when set.
    func signOff(_ lines: [String]) -> [String] {
        var out = lines
        if let reg = registrationLine { out.append(reg) }
        return out
    }

    /// Resolved time zone; falls back to the default practice zone if the
    /// stored identifier is not a valid IANA identifier.
    var timeZone: TimeZone {
        TimeZone(identifier: timeZoneIdentifier)
            ?? TimeZone(identifier: PracticeProfile.amiseDefault.timeZoneIdentifier)
            ?? TimeZone(secondsFromGMT: -4 * 3600)!
    }

    var hasValidTimeZone: Bool {
        TimeZone(identifier: timeZoneIdentifier) != nil
    }

    /// Letterhead contact block built from the individual fields — offered in
    /// Settings as a one-tap way to rebuild `letterheadLines` after editing.
    var suggestedLetterheadLines: [String] {
        [practiceName, country, Self.join([primaryPhone, email], separator: "  ·  ")]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    /// Joins the non-empty (trimmed) parts with `separator`. Used for header /
    /// footer lines so an unset field never leaves a dangling "·" or ",".
    static func join(_ parts: [String], separator: String) -> String {
        parts
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: separator)
    }

    /// Trims every field, drops blank letterhead lines and completely empty sites.
    func normalized() -> PracticeProfile {
        func t(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }
        var p = self
        p.practiceName                = t(practiceName)
        p.practiceShortName           = t(practiceShortName)
        p.brandMark                   = t(brandMark)
        p.brandTagline                = t(brandTagline)
        p.clinicianName               = t(clinicianName)
        p.clinicianShortName          = t(clinicianShortName)
        p.clinicianCredentials        = t(clinicianCredentials)
        p.clinicianRegistrationNumber = t(clinicianRegistrationNumber)
        p.clinicianTitle              = t(clinicianTitle)
        p.specialty                   = t(specialty)
        p.primaryPhone                = t(primaryPhone)
        p.email                       = t(email)
        p.country                     = t(country)
        p.timeZoneIdentifier          = t(timeZoneIdentifier)
        p.letterheadLines             = letterheadLines.map(t).filter { !$0.isEmpty }
        p.sites = sites
            .map { PracticeSite(id: $0.id, name: t($0.name), address: t($0.address), phone: t($0.phone)) }
            .filter { !($0.name.isEmpty && $0.address.isEmpty && $0.phone.isEmpty) }
        return p
    }

    // MARK: - Persistence

    static let defaultsKey = "amf.practiceProfile"

    private static let cacheLock = NSLock()
    private static var cachedCurrent: PracticeProfile?

    /// The active practice profile (from UserDefaults.standard, cached).
    /// Falls back to `amiseDefault` when nothing is stored or the stored JSON
    /// cannot be decoded.
    static var current: PracticeProfile {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        if let cached = cachedCurrent { return cached }
        let loaded = load(from: .standard)
        cachedCurrent = loaded
        return loaded
    }

    /// Loads the profile stored in `defaults`, or `amiseDefault`.
    static func load(from defaults: UserDefaults) -> PracticeProfile {
        decode(defaults.data(forKey: defaultsKey))
    }

    /// Decodes profile JSON; nil, empty or corrupt data yields `amiseDefault`.
    static func decode(_ data: Data?) -> PracticeProfile {
        guard let data = data, !data.isEmpty,
              let profile = try? JSONDecoder().decode(PracticeProfile.self, from: data) else {
            return .amiseDefault
        }
        return profile
    }

    /// Persists this profile as JSON and refreshes `current`.
    @discardableResult
    func save(to defaults: UserDefaults = .standard) -> Bool {
        guard let data = try? JSONEncoder().encode(self) else { return false }
        defaults.set(data, forKey: PracticeProfile.defaultsKey)
        PracticeProfile.invalidateCache()
        return true
    }

    /// Removes any stored profile so `current` reverts to `amiseDefault`.
    static func reset(in defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: defaultsKey)
        invalidateCache()
    }

    static func invalidateCache() {
        cacheLock.lock()
        cachedCurrent = nil
        cacheLock.unlock()
    }
}

// MARK: - Tolerant decoding
//
// Declared in an extension so the memberwise initialiser is kept.
// `practiceName` and `clinicianName` are required — JSON without them (e.g. `{}`)
// is treated as corrupt and the whole profile falls back to the default.
// Any other missing key (e.g. a field added in a later app version) decodes to a
// neutral empty value rather than discarding the practice's saved profile.

extension PracticeProfile {
    enum CodingKeys: String, CodingKey {
        case practiceName, practiceShortName, brandMark, brandTagline
        case clinicianName, clinicianShortName, clinicianCredentials
        case clinicianRegistrationNumber, clinicianTitle, specialty
        case sites, primaryPhone, email, country, timeZoneIdentifier, letterheadLines
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        practiceName                = try c.decode(String.self, forKey: .practiceName)
        clinicianName               = try c.decode(String.self, forKey: .clinicianName)
        practiceShortName           = try c.decodeIfPresent(String.self, forKey: .practiceShortName) ?? ""
        brandMark                   = try c.decodeIfPresent(String.self, forKey: .brandMark) ?? ""
        brandTagline                = try c.decodeIfPresent(String.self, forKey: .brandTagline) ?? ""
        clinicianShortName          = try c.decodeIfPresent(String.self, forKey: .clinicianShortName) ?? ""
        clinicianCredentials        = try c.decodeIfPresent(String.self, forKey: .clinicianCredentials) ?? ""
        clinicianRegistrationNumber = try c.decodeIfPresent(String.self, forKey: .clinicianRegistrationNumber) ?? ""
        clinicianTitle              = try c.decodeIfPresent(String.self, forKey: .clinicianTitle) ?? ""
        specialty                   = try c.decodeIfPresent(String.self, forKey: .specialty) ?? ""
        sites                       = try c.decodeIfPresent([PracticeSite].self, forKey: .sites) ?? []
        primaryPhone                = try c.decodeIfPresent(String.self, forKey: .primaryPhone) ?? ""
        email                       = try c.decodeIfPresent(String.self, forKey: .email) ?? ""
        country                     = try c.decodeIfPresent(String.self, forKey: .country) ?? ""
        timeZoneIdentifier          = try c.decodeIfPresent(String.self, forKey: .timeZoneIdentifier)
                                        ?? PracticeProfile.amiseDefault.timeZoneIdentifier
        letterheadLines             = try c.decodeIfPresent([String].self, forKey: .letterheadLines) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(practiceName, forKey: .practiceName)
        try c.encode(practiceShortName, forKey: .practiceShortName)
        try c.encode(brandMark, forKey: .brandMark)
        try c.encode(brandTagline, forKey: .brandTagline)
        try c.encode(clinicianName, forKey: .clinicianName)
        try c.encode(clinicianShortName, forKey: .clinicianShortName)
        try c.encode(clinicianCredentials, forKey: .clinicianCredentials)
        try c.encode(clinicianRegistrationNumber, forKey: .clinicianRegistrationNumber)
        try c.encode(clinicianTitle, forKey: .clinicianTitle)
        try c.encode(specialty, forKey: .specialty)
        try c.encode(sites, forKey: .sites)
        try c.encode(primaryPhone, forKey: .primaryPhone)
        try c.encode(email, forKey: .email)
        try c.encode(country, forKey: .country)
        try c.encode(timeZoneIdentifier, forKey: .timeZoneIdentifier)
        try c.encode(letterheadLines, forKey: .letterheadLines)
    }
}

// MARK: - Observable wrapper for SwiftUI

/// Publishes the active profile so Settings updates live after an edit.
/// Non-view code should keep reading `PracticeProfile.current`.
final class PracticeProfileStore: ObservableObject {
    static let shared = PracticeProfileStore()

    @Published private(set) var profile: PracticeProfile

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.profile = PracticeProfile.load(from: defaults)
    }

    var isDefault: Bool { profile == .amiseDefault }

    func save(_ newProfile: PracticeProfile) {
        let normalized = newProfile.normalized()
        normalized.save(to: defaults)
        profile = normalized
    }

    func resetToDefault() {
        PracticeProfile.reset(in: defaults)
        profile = .amiseDefault
    }
}
