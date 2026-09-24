import XCTest
@testable import AmiseMedFlow

final class PracticeProfileTests: XCTestCase {

    private var suiteName: String = ""
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "PracticeProfileTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        super.tearDown()
    }

    // MARK: - Round trips

    func testDefaultRoundTripsThroughJSON() throws {
        let data = try JSONEncoder().encode(PracticeProfile.amiseDefault)
        let decoded = try JSONDecoder().decode(PracticeProfile.self, from: data)
        XCTAssertEqual(decoded, PracticeProfile.amiseDefault)
    }

    func testDefaultRoundTripsThroughUserDefaults() {
        XCTAssertTrue(PracticeProfile.amiseDefault.save(to: defaults))
        XCTAssertNotNil(defaults.data(forKey: PracticeProfile.defaultsKey))
        XCTAssertEqual(PracticeProfile.load(from: defaults), PracticeProfile.amiseDefault)
    }

    func testCustomProfileRoundTripsThroughUserDefaults() {
        var custom = PracticeProfile.amiseDefault
        custom.practiceName = "Harbour Surgical Associates"
        custom.clinicianName = "Dr Jane Smith"
        custom.clinicianCredentials = "FRCS, FACS"
        custom.clinicianRegistrationNumber = "MC-1234"
        custom.sites = [PracticeSite(id: "main", name: "Main Clinic", address: "1 Harbour Rd", phone: "+1 246 555 0100")]
        custom.timeZoneIdentifier = "America/Barbados"
        custom.letterheadLines = ["Harbour Surgical Associates", "Bridgetown, Barbados"]
        custom.brandMark = "HSA"

        custom.save(to: defaults)
        let loaded = PracticeProfile.load(from: defaults)

        XCTAssertEqual(loaded, custom)
        XCTAssertNotEqual(loaded, PracticeProfile.amiseDefault)
        XCTAssertEqual(loaded.clinicianSignature, "Dr Jane Smith FRCS FACS")
        XCTAssertEqual(loaded.timeZone.identifier, "America/Barbados")
    }

    // MARK: - Fallback to default

    func testMissingKeyFallsBackToDefault() {
        XCTAssertNil(defaults.data(forKey: PracticeProfile.defaultsKey))
        XCTAssertEqual(PracticeProfile.load(from: defaults), PracticeProfile.amiseDefault)
    }

    func testNilAndEmptyDataFallBackToDefault() {
        XCTAssertEqual(PracticeProfile.decode(nil), PracticeProfile.amiseDefault)
        XCTAssertEqual(PracticeProfile.decode(Data()), PracticeProfile.amiseDefault)
    }

    func testCorruptJSONFallsBackToDefault() {
        defaults.set(Data("this is not json {".utf8), forKey: PracticeProfile.defaultsKey)
        XCTAssertEqual(PracticeProfile.load(from: defaults), PracticeProfile.amiseDefault)
    }

    func testWrongTypesFallBackToDefault() {
        let json = #"{"practiceName": 42, "clinicianName": ["Dr X"]}"#
        XCTAssertEqual(PracticeProfile.decode(Data(json.utf8)), PracticeProfile.amiseDefault)
    }

    func testEmptyObjectFallsBackToDefault() {
        XCTAssertEqual(PracticeProfile.decode(Data("{}".utf8)), PracticeProfile.amiseDefault)
    }

    func testNonDataValueUnderKeyFallsBackToDefault() {
        defaults.set("a plain string", forKey: PracticeProfile.defaultsKey)
        XCTAssertEqual(PracticeProfile.load(from: defaults), PracticeProfile.amiseDefault)
    }

    func testPartialJSONKeepsSavedValuesAndDoesNotInheritAmiseIdentity() {
        let json = #"{"practiceName": "Harbour Surgical", "clinicianName": "Dr Jane Smith"}"#
        let p = PracticeProfile.decode(Data(json.utf8))
        XCTAssertEqual(p.practiceName, "Harbour Surgical")
        XCTAssertEqual(p.clinicianName, "Dr Jane Smith")
        XCTAssertEqual(p.primaryPhone, "")
        XCTAssertEqual(p.country, "")
        XCTAssertTrue(p.sites.isEmpty)
        XCTAssertEqual(p.brandMark, "")
        XCTAssertTrue(p.letterheadLines.isEmpty)
        XCTAssertEqual(p.timeZoneIdentifier, PracticeProfile.amiseDefault.timeZoneIdentifier)
        // Short-name fallbacks use this practice's own full names.
        XCTAssertEqual(p.displayShortPracticeName, "Harbour Surgical")
        XCTAssertEqual(p.displayShortClinicianName, "Dr Jane Smith")
    }

    func testResetRemovesStoredProfile() {
        var custom = PracticeProfile.amiseDefault
        custom.practiceName = "Other Practice"
        custom.save(to: defaults)
        PracticeProfile.reset(in: defaults)
        XCTAssertNil(defaults.data(forKey: PracticeProfile.defaultsKey))
        XCTAssertEqual(PracticeProfile.load(from: defaults), PracticeProfile.amiseDefault)
    }

    // MARK: - Default output is byte-identical to the previous literals

    func testDefaultDerivedStringsMatchLegacyLiterals() {
        let p = PracticeProfile.amiseDefault
        XCTAssertEqual(p.practiceName, "Amise Medical Services")
        XCTAssertEqual(p.clinicianName, "Dr Dawit Daniel Kabiye")
        XCTAssertEqual(p.clinicianSignature, "Dr Dawit Daniel Kabiye MD DM")
        XCTAssertEqual(p.clinicianNameWithCredentials, "Dr Dawit Daniel Kabiye, MD, DM")
        XCTAssertEqual(p.practiceNameWithCountry, "Amise Medical Services, Saint Lucia")
        XCTAssertEqual(p.displayShortPracticeName, "Amise Medical")
        XCTAssertEqual(p.displayShortClinicianName, "Dr. Dawit Kabiye")
        XCTAssertEqual(p.primaryPhone, "+1 (758) 284-0557")
        XCTAssertEqual(p.primaryPhoneCompact, "+1(758)284-0557")
        XCTAssertEqual(p.practiceName.uppercased(), "AMISE MEDICAL SERVICES")
        XCTAssertEqual(p.letterheadLines, [
            "Amise Medical Services",
            "Saint Lucia, West Indies",
            "+1 758 284 0557  ·  amisemedical.com"
        ])
        XCTAssertEqual(p.brandMark, "AMISE")
        XCTAssertEqual(p.brandTagline, "Ambulatory Minimally Invasive Surgery & Endoscopy")
        XCTAssertEqual(p.timeZone.identifier, "America/St_Lucia")
        XCTAssertEqual(p.practiceNameAndCountryDotted, "Amise Medical Services · Saint Lucia")
        XCTAssertEqual(p.clinicianLetterheadName, "Dr Dawit Daniel Kabiye  MD · DM")
        XCTAssertEqual(p.clinicianLetterheadLine,
                       "Dr Dawit Daniel Kabiye  MD · DM  ·  General & Endoscopic Surgery")
        XCTAssertEqual(p.consultantTitle, "Consultant General & Endoscopic Surgeon")
        XCTAssertNil(p.registrationLine)
        XCTAssertEqual(p.signOff(["A"]), ["A"])
        // Referral-letter template sign-off (NoteEditorView+Generation.templateFor).
        XCTAssertEqual(
            p.signOff([p.clinicianName, p.clinicianTitle, p.practiceNameWithCountry]).joined(separator: "\n"),
            "Dr Dawit Daniel Kabiye\nGeneral & Endoscopic Surgeon\nAmise Medical Services, Saint Lucia")
        // Consultation letter sign-off (ConsultationView+Sheets.generateLetter).
        XCTAssertEqual(
            p.signOff([p.clinicianLetterheadName, p.consultantTitle, p.practiceNameWithCountry]).joined(separator: "\n"),
            "Dr Dawit Daniel Kabiye  MD · DM\nConsultant General & Endoscopic Surgeon\nAmise Medical Services, Saint Lucia")
        XCTAssertEqual(
            PracticeProfile.join([p.clinicianSignature, p.specialty], separator: " — "),
            "Dr Dawit Daniel Kabiye MD DM — General & Endoscopic Surgery")
        XCTAssertEqual(
            PracticeProfile.join([p.specialty, p.practiceName, p.country], separator: ", "),
            "General & Endoscopic Surgery, Amise Medical Services, Saint Lucia")
        XCTAssertEqual(
            PracticeProfile.join([p.specialty, p.country], separator: ", "),
            "General & Endoscopic Surgery, Saint Lucia")
        XCTAssertEqual(
            PracticeProfile.join([p.practiceName, p.clinicianSignature, p.country, "Confidential clinical document"],
                                 separator: " · "),
            "Amise Medical Services · Dr Dawit Daniel Kabiye MD DM · Saint Lucia · Confidential clinical document")
        XCTAssertEqual(
            PracticeProfile.join([p.practiceName, p.country,
                                  "Administrative form — not a clinical record",
                                  "For appointment scheduling purposes only"],
                                 separator: "  ·  "),
            "Amise Medical Services  ·  Saint Lucia  ·  Administrative form — not a clinical record  ·  For appointment scheduling purposes only")
    }

    // MARK: - Helpers

    func testJoinSkipsEmptyParts() {
        XCTAssertEqual(PracticeProfile.join(["A", "", "  ", "B"], separator: " · "), "A · B")
        XCTAssertEqual(PracticeProfile.join(["", ""], separator: ", "), "")
    }

    func testCredentialsWithoutCommasOrEmpty() {
        var p = PracticeProfile.amiseDefault
        p.clinicianCredentials = ""
        XCTAssertEqual(p.clinicianSignature, "Dr Dawit Daniel Kabiye")
        XCTAssertEqual(p.clinicianNameWithCredentials, "Dr Dawit Daniel Kabiye")
        XCTAssertEqual(p.clinicianLetterheadName, "Dr Dawit Daniel Kabiye")
    }

    func testRegistrationNumberAppendedToSignOff() {
        var p = PracticeProfile.amiseDefault
        p.clinicianRegistrationNumber = " MC-1234 "
        XCTAssertEqual(p.signOff(["Dr Dawit Daniel Kabiye"]),
                       ["Dr Dawit Daniel Kabiye", "Registration No. MC-1234"])
    }

    func testConsultantTitleNotDoubled() {
        var p = PracticeProfile.amiseDefault
        p.clinicianTitle = "Consultant Surgeon"
        XCTAssertEqual(p.consultantTitle, "Consultant Surgeon")
        p.clinicianTitle = ""
        XCTAssertEqual(p.consultantTitle, "")
    }

    func testCustomCredentialsFormatting() {
        var p = PracticeProfile.amiseDefault
        p.clinicianName = "Dr Jane Smith"
        p.clinicianCredentials = "MBBS, FRCS (Gen Surg)"
        XCTAssertEqual(p.clinicianSignature, "Dr Jane Smith MBBS FRCS (Gen Surg)")
        XCTAssertEqual(p.clinicianLetterheadName, "Dr Jane Smith  MBBS · FRCS (Gen Surg)")
        XCTAssertEqual(p.clinicianNameWithCredentials, "Dr Jane Smith, MBBS, FRCS (Gen Surg)")
    }

    func testInvalidTimeZoneFallsBack() {
        var p = PracticeProfile.amiseDefault
        p.timeZoneIdentifier = "Not/AZone"
        XCTAssertFalse(p.hasValidTimeZone)
        XCTAssertEqual(p.timeZone.identifier, "America/St_Lucia")
    }

    func testNormalizedTrimsAndDropsBlankEntries() {
        var p = PracticeProfile.amiseDefault
        p.practiceName = "  Amise Medical Services \n"
        p.letterheadLines = ["Line 1", "   ", ""]
        p.sites.append(PracticeSite(name: " ", address: "", phone: ""))
        let n = p.normalized()
        XCTAssertEqual(n.practiceName, "Amise Medical Services")
        XCTAssertEqual(n.letterheadLines, ["Line 1"])
        XCTAssertEqual(n.sites, PracticeProfile.amiseDefault.sites)
    }

    func testStoreSaveAndReset() {
        let store = PracticeProfileStore(defaults: defaults)
        XCTAssertTrue(store.isDefault)

        var custom = store.profile
        custom.clinicianName = "Dr Jane Smith"
        store.save(custom)
        XCTAssertEqual(store.profile.clinicianName, "Dr Jane Smith")
        XCTAssertFalse(store.isDefault)
        XCTAssertEqual(PracticeProfile.load(from: defaults).clinicianName, "Dr Jane Smith")

        store.resetToDefault()
        XCTAssertTrue(store.isDefault)
        XCTAssertEqual(PracticeProfile.load(from: defaults), PracticeProfile.amiseDefault)
    }
}
