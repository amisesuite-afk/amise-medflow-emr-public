// EmptyDraftNoteTests.swift
// Empty notes that never reached the server are not "pending" and can be discarded
// (ClinicalNote+EmptyDraft.swift).

import XCTest
import SwiftData
@testable import AmiseMedFlow

@MainActor
final class EmptyDraftNoteTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    private func makeNote(text: String? = nil, remoteId: String? = nil, signed: Bool = false) -> ClinicalNote {
        let patient = Patient(fullName: "Test Patient")
        context.insert(patient)
        let note = ClinicalNote(noteType: .soap, patient: patient)
        note.freeText = text
        note.remoteId = remoteId
        if signed { note.status = .signed }
        context.insert(note)
        return note
    }

    func testEmptyUnsentDraftIsDiscarded() {
        let note = makeNote()
        XCTAssertTrue(note.isEmptyUnsentDraft)
        XCTAssertTrue(note.discardIfEmptyDraft(in: context))
        XCTAssertEqual(try context.fetch(FetchDescriptor<ClinicalNote>()).count, 0)
    }

    func testStructuredNoteWithOnlyFreeTextIsNotEmpty() {
        // The SOAP record archived with a consultation PDF keeps its text in freeText.
        let note = makeNote(text: "CC: RUQ pain\n\nPlan: ultrasound")
        XCTAssertFalse(note.isEmpty)
        XCTAssertTrue(note.contentForSync.contains("RUQ pain"))
        XCTAssertFalse(note.discardIfEmptyDraft(in: context))
    }

    func testNotesWithContentOrOnTheServerAreKept() {
        XCTAssertFalse(makeNote(text: "RUQ pain improving").isEmptyUnsentDraft)
        XCTAssertFalse(makeNote(remoteId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301").isEmptyUnsentDraft)
        XCTAssertFalse(makeNote(signed: true).isEmptyUnsentDraft)
        let kept = makeNote(text: "Plan: review in 2 weeks")
        XCTAssertFalse(kept.discardIfEmptyDraft(in: context))
        XCTAssertTrue(kept.isLive)
    }

    func testStructuredFreeTextRoundTripsThroughSyncContent() {
        let note = makeNote(text: "CC: RUQ pain")
        note.plan = "Ultrasound abdomen"
        let content = note.contentForSync
        let copy = makeNote()
        copy.applySyncContent(content)
        XCTAssertEqual(copy.freeText, "CC: RUQ pain")
        XCTAssertEqual(copy.plan, "Ultrasound abdomen")
        // Stable: sending the copy gives the same content (no duplication).
        XCTAssertEqual(copy.contentForSync, content)
    }
}
