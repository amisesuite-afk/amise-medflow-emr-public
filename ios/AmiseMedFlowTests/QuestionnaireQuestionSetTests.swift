// QuestionnaireQuestionSetTests.swift
// The patient questionnaire (AdaptiveQuestionnaireSheet / EncounterAnswers) chooses its symptom
// questions from the complaint's history-frames symptom type: pain questions for pain, lump
// questions for a lump or hernia (history-by-complaint finding 5: a hernia was asked "What is it
// like?" and "Does the pain spread?").

import XCTest
@testable import AmiseMedFlow

final class QuestionnaireQuestionSetTests: XCTestCase {

    func testQuestionSetFollowsTheSymptomType() {
        XCTAssertEqual(CCCategory.hernia.questionSet, .lump)
        XCTAssertEqual(CCCategory.neckLump.questionSet, .lump)
        XCTAssertEqual(CCCategory.abdominalPain.questionSet, .pain)
        XCTAssertEqual(CCCategory.chestPain.questionSet, .pain)
        XCTAssertEqual(CCCategory.perianal.questionSet, .pain)
        XCTAssertEqual(CCCategory.jaundice.questionSet, .other)
        XCTAssertEqual(CCCategory.rectalBleeding.questionSet, .other)
        XCTAssertFalse(CCCategory.hernia.isPainType)
        XCTAssertEqual(CCCategory.hernia.lumpVariant, "hernia")
        XCTAssertEqual(CCCategory.neckLump.lumpVariant, "neck")
    }

    func testHerniaAnswersAreLumpChipsNotPain() {
        var a = EncounterAnswers()
        a.ccCategory = .hernia
        a.lumpSite = "Right groin"
        a.lumpDuration = .months
        a.lumpSizeChange = .slow
        a.lumpPain = .sometimes
        a.lumpBehaviour = [.liesBack, .biggerOnCough]
        let hpi = a.hpiText
        XCTAssertTrue(hpi.contains("SITE: Right groin"), hpi)
        XCTAssertTrue(hpi.contains("ONSET: Months"), hpi)
        XCTAssertTrue(hpi.contains("SIZE CHANGE: Slow growth"), hpi)
        XCTAssertTrue(hpi.contains("REDUCIBILITY: Cough impulse, Reduces on lying down"), hpi)
        XCTAssertFalse(hpi.contains("RADIATION"), hpi)
        let s = a.socratesSelections
        XCTAssertEqual(s["onset"], ["Months"])
        XCTAssertEqual(s["character"], ["Painful at times"])
        XCTAssertEqual(s["associations"], ["Slow growth", "Reduces on lying down", "Cough impulse"])
        XCTAssertNil(s["radiation"])
        XCTAssertNil(s["exacerbating"])
    }

    func testPainComplaintKeepsThePainQuestions() {
        var a = EncounterAnswers()
        a.ccCategory = .abdominalPain
        a.painSite = "Right lower abdomen"
        XCTAssertTrue(a.hpiText.contains("RADIATION: none"))
        XCTAssertEqual(a.socratesSelections["site"], ["Right lower abdomen"])
    }
}
