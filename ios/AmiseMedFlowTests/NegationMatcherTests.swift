import XCTest
@testable import AmiseMedFlow

/// NegationMatcher (Services/NegationMatcher.swift) is the Swift twin of the web matcher
/// `lib/triage-engine/src/negation.ts`. These vectors are the same phrases, terms and expected
/// results as `artifacts/dashboard/src/lib/__tests__/negation.test.ts`, in the same order: change
/// both files together (`scripts/src/negation-parity.test.ts` compares them).
/// The negative phrases are the exact wording from the clinical-validation vignettes that fired
/// emergency triage, alarms and operative plans; the positive controls must keep firing.
final class NegationMatcherTests: XCTestCase {

    private func affirmed(_ text: String, _ term: String) -> Bool {
        NegationMatcher.containsAffirmed(text, term)
    }

    private func affirmedWhole(_ text: String, _ term: String) -> Bool {
        NegationMatcher.containsAffirmed(text, term, wholeWord: true)
    }

    /// Scalar offset of the first (or last) occurrence of `needle` in the lowercased `text`.
    private func offset(of needle: String, in text: String, last: Bool = false) -> Int? {
        let lower = text.lowercased()
        guard let r = lower.range(of: needle, options: last ? [.backwards] : []) else { return nil }
        return lower.unicodeScalars.distance(from: lower.unicodeScalars.startIndex, to: r.lowerBound)
    }

    // MARK: - Explicit negations do not match

    static let negatedCases: [(String, String)] = [
        ("No guarding", "guarding"),
        ("No guarding, no rebound", "rebound"),
        ("No guarding, no rebound", "guarding"),
        ("Soft, no peritonism", "peritonism"),
        ("No peritonism or rigidity", "rigid"),
        ("Murphy's sign negative", "murphy"),
        ("Murphy's sign negative", "murphy's"),
        ("Murphy's sign is negative", "murphy"),
        ("no black stools", "black stool"),
        ("No bleeding", "bleeding"),
        ("no vomiting", "vomiting"),
        ("Soft, non-tender", "tender"),
        ("abdomen nontender", "tender"),
        ("afebrile", "febrile"),
        ("Apyrexial, anicteric", "icteric"),
        ("No chest pain described", "chest pain"),
        ("CT: no free gas", "free gas"),
        ("No cholangitis", "cholangitis"),
        ("not jaundiced", "jaundice"),
        ("Patient denies chest pain", "chest pain"),
        ("Painless", "pain"),
        ("pain-free since yesterday", "pain"),
        ("without guarding", "guarding"),
        ("nil vomiting", "vomiting"),
        ("Rovsing -ve", "rovsing"),
        ("negative Murphy's sign", "murphy"),
        ("CT negative for perforation", "perforation"),
        ("Pregnancy test negative", "pregnancy"),
        ("Guarding: absent", "guarding"),
        ("rebound not elicited", "rebound"),
        ("No episodes of severe pain", "severe pain"),
        ("No family history of thyroid cancer", "cancer"),
        ("No difficulty swallowing, no weight loss, no vomiting, no black stools", "weight loss"),
        ("No chest pain, breathlessness or haemoptysis", "breathless"),
        ("No chest pain, breathlessness or haemoptysis", "haemoptysis"),
        ("Irreducible inguinal hernia", "reducible"),
        ("Non-smoker", "smok"),
        ("Appendicitis excluded on CT", "appendicitis"),
        ("He doesn't have a fever", "fever"),
        ("Has not been vomiting", "vomiting"),
    ]

    func testExplicitNegationsDoNotMatch() {
        for (text, term) in Self.negatedCases {
            XCTAssertFalse(affirmed(text, term), "\(text) — \(term)")
        }
    }

    func testRegexMatchesAreNegatedToo() {
        XCTAssertFalse(NegationMatcher.testAffirmed(#"\b(bleed(ing)?|melaena)\b"#, "No bleeding. No melaena."))
        XCTAssertFalse(NegationMatcher.testAffirmed(#"\b(chest pain|crushing pain|left arm|jaw pain)\b"#, "No chest pain described"))
        XCTAssertFalse(NegationMatcher.testAffirmed(#"\b(severe (abdominal |belly |stomach )?pain|acute abdomen)\b"#, "no episodes of severe pain"))
    }

    // MARK: - Positive findings still match (positive controls)

    static let positiveCases: [(String, String)] = [
        ("guarding present", "guarding"),
        ("rigid abdomen with guarding", "guarding"),
        ("rigid abdomen with guarding", "rigid"),
        ("Murphy's sign positive", "murphy"),
        ("RIF tenderness with rebound", "rebound"),
        ("Febrile 38.9", "febrile"),
        ("Jaundiced", "jaundice"),
        ("Haematemesis this morning", "haematemesis"),
        ("Tender RIF", "tender"),
        ("Localised guarding in the RIF", "guarding"),
        ("CT: free gas under the diaphragm", "free gas"),
        ("Adhesive SBO with strangulation", "strangulation"),
    ]

    func testPositiveFindingsStillMatch() {
        for (text, term) in Self.positiveCases {
            XCTAssertTrue(affirmed(text, term), "\(text) — \(term)")
        }
    }

    // MARK: - Scope ends where a new assertion starts

    func testACommaEndsTheScope() {
        XCTAssertTrue(affirmed("No vomiting, rigid abdomen", "rigid"))
    }

    func testButEndsTheScope() {
        XCTAssertTrue(affirmed("No rebound but guarding in RIF", "guarding"))
    }

    func testAndEndsTheScope() {
        // Safety bias: over-triage.
        XCTAssertTrue(affirmed("No nausea and vomiting", "vomiting"))
    }

    func testWithEndsTheScope() {
        XCTAssertTrue(affirmed("No fever with rigid abdomen", "rigid"))
    }

    func testAFullStopEndsTheScope() {
        XCTAssertTrue(affirmed("No vomiting. Guarding in RIF.", "guarding"))
    }

    func testNonNegatesOnlyItsOwnWord() {
        XCTAssertTrue(affirmed("Non-bilious vomiting", "vomiting"))
        XCTAssertTrue(affirmed("Non-operative management of appendicitis", "appendicitis"))
    }

    func testANegationMoreThanFiveWordsBackDoesNotReachTheTerm() {
        XCTAssertTrue(affirmed("No history of any previous abdominal surgery in the past, rigid", "rigid"))
        XCTAssertTrue(affirmed("No recent travel to any tropical area this year guarding", "guarding"))
    }

    func testThePostCueMustBeClose() {
        XCTAssertTrue(affirmed("rigid abdomen, CT negative", "rigid"))
        XCTAssertTrue(affirmed("rigid abdomen CT scan negative", "rigid"))
    }

    // MARK: - Hedges and pseudo-negations are not negations

    static let keptCases: [(String, String)] = [
        ("Appendicitis cannot be excluded", "appendicitis"),
        ("Perforation not excluded", "perforation"),
        ("Perforation not ruled out", "perforation"),
        ("No improvement in pain", "pain"),
        ("No change in the guarding", "guarding"),
        ("Pain not relieved by analgesia", "pain"),
        ("?appendicitis", "appendicitis"),
        ("CT to exclude perforation", "perforation"),
        ("Can't swallow saliva", "swallow"),
        ("Unable to pass flatus", "flatus"),
        ("Nil by mouth, guarding in RIF", "guarding"),
        ("No doubt peritonitis", "peritonitis"),
        ("It hasn't stopped bleeding", "bleeding"),
        ("Vomiting has not settled", "vomiting"),
        ("I don't know if it is bleeding", "bleeding"),
        ("Bleeding has not yet settled", "bleeding"),
        ("Ex-smoker", "smok"),
    ]

    func testHedgesAndPseudoNegationsAreKept() {
        for (text, term) in Self.keptCases {
            XCTAssertTrue(affirmed(text, term), "\(text) — \(term)")
        }
    }

    // MARK: - Terms written as negatives keep matching

    func testACueInsideTheTermDoesNotNegateTheTerm() {
        XCTAssertTrue(affirmed("Absolute constipation, no flatus for 2 days", "no flatus"))
        XCTAssertTrue(affirmed("Distended with absent bowel sounds", "absent bowel sounds"))
        XCTAssertTrue(affirmed("Irreducible, tender lump", "irreducible"))
    }

    // MARK: - Several occurrences: one affirmed occurrence is enough

    func testFindsTheAffirmedOccurrence() {
        let text = "No guarding on admission. Now guarding in the RIF."
        XCTAssertTrue(affirmed(text, "guarding"))
        XCTAssertEqual(NegationMatcher.findAffirmed(text, "guarding")?.index,
                       offset(of: "guarding", in: text, last: true))
    }

    func testContainsAnyAffirmed() {
        XCTAssertFalse(NegationMatcher.containsAnyAffirmed("No rebound, no guarding", ["rebound", "guarding"]))
        XCTAssertTrue(NegationMatcher.containsAnyAffirmed("No rebound; guarding present", ["rebound", "guarding"]))
    }

    // MARK: - wholeWord option

    func testWholeWordRequiresWordBoundaries() {
        XCTAssertFalse(affirmedWhole("Hinchey III diverticulitis", "hinchey i"))
        XCTAssertTrue(affirmedWhole("Hinchey III diverticulitis", "hinchey iii"))
        XCTAssertFalse(affirmedWhole("Bethesda VI", "bethesda v"))
        XCTAssertFalse(affirmedWhole("Primary hyperparathyroidism for parathyroidectomy", "thyroidectomy"))
        XCTAssertFalse(affirmedWhole("Irreducible inguinal hernia", "reducible inguinal"))
    }

    func testWholeWordAllowsAPluralAfterALongFinalWordAndDigitsAfterACode() {
        XCTAssertTrue(affirmedWhole("SBO secondary to adhesions", "adhesion"))
        XCTAssertFalse(affirmedWhole("Tokyo grade is unclear", "grade i"))
        XCTAssertTrue(affirmedWhole("K35.30 perforated appendicitis", "k35.3"))
        XCTAssertFalse(affirmedWhole("diameter 16mm", "6mm"))
    }

    func testSubstringSemanticsAreTheDefault() {
        XCTAssertTrue(affirmed("Acute appendicitis", "append"))
    }

    // MARK: - isNegatedAt and joinClauses

    func testIsNegatedAtUsesOffsetsIntoTheText() {
        let text = "Soft, no guarding"
        let i = offset(of: "guarding", in: text)!
        XCTAssertTrue(NegationMatcher.isNegatedAt(text, start: i, end: i + "guarding".count))
    }

    func testJoinClausesKeepsANegationInsideItsOwnItem() {
        let text = NegationMatcher.joinClauses(["No vomiting", "Fever"])
        XCTAssertTrue(affirmed(text, "fever"))
        XCTAssertFalse(affirmed(text, "vomiting"))
    }

    // MARK: - iOS-only (not in the web file; the parity check stops here)

    func testRegexPositiveControl() {
        XCTAssertTrue(NegationMatcher.testAffirmed(#"\b(bleed(ing)?|melaena)\b"#, "Melaena since Tuesday"))
    }

    func testSourceAnswersManyTerms() {
        let source = NegationMatcher.Source("Soft, no guarding. Murphy's sign negative. Tender RUQ.")
        XCTAssertFalse(source.contains("guarding"))
        XCTAssertFalse(source.contains("murphy"))
        XCTAssertTrue(source.contains("tender"))
        XCTAssertEqual(source.firstAffirmed(["guarding", "murphy", "tender"]), "tender")
    }
}
