// UXWalkthroughTests.swift
// Automated UI walkthrough for the surgeon's usability review. Each test launches the app in
// DEBUG demo mode (-UITestDemoMode: synthetic in-memory patients, no sign-in, no Face ID, no
// sync, no Sentry — see AmiseMedFlow/Services/UITestDemoMode.swift), runs one flow, screenshots
// every step and records taps / text entries / scrolls / screens (UXRecorder).
//
// Flows (same on iPhone and iPad; the iPad opens the consultation from the record's single
// "Consultation" section, the iPhone from the record's quick actions):
//   a  Today → patient → consultation → "First visit" pathway → every step (typing in CC, HPI,
//      exam, diagnosis, plan) → Tools → Scores (compute + save one, over the current step) →
//      Save snapshot → Complete → review sheet (attest) → Complete visit
//   b  Add a new patient (and check it shows on Today under "Added today")
//   c  Record vitals
//   d  Add a prescription that interacts with warfarin → interaction alert
//   e  Front desk: hand-over questionnaire start screen (front-desk role; iPhone: the Check-In
//      row's "Questionnaire" action)
//
// Run: ios/UIWalkthrough/run.sh (local) or .github/workflows/ios-ui-walkthrough.yml (CI).
// Never calls AI features (AIService); nothing here touches real data or the network.

import XCTest

final class UXWalkthroughTests: XCTestCase {

    /// The "First visit" pathway steps (ConsultPathway.firstVisit.steps), as ConsultTab case names.
    private static let firstVisitSteps: [(tab: String, label: String)] = [
        ("risk", "Risk"), ("cc", "CC"), ("hpi", "HPI"), ("pmh", "PMH"), ("pshx", "PSHx"),
        ("meds", "Meds"), ("allergies", "Allergies"), ("social", "Social"), ("exam", "Exam"),
        ("investigations", "Ix"), ("diagnosis", "Diagnosis"), ("plan", "Plan"),
    ]

    override func setUpWithError() throws {
        // Keep going after an XCTest-internal failure so the metrics and screenshots still land.
        continueAfterFailure = true
    }

    @MainActor
    private func launch(role: String = "doctor") -> XCUIApplication {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launchArguments = ["-UITestDemoMode", "-UITestDemoRole", role]
        app.launch()
        return app
    }

    // MARK: - a. Consultation

    @MainActor
    func testA_ConsultationFlow() throws {
        let app = launch()
        let ux = UXRecorder(app: app, flow: "a_consultation",
                            title: "Today → patient → consultation (First visit, all 12 steps) → Tools: score → save & review/complete",
                            testCase: self)
        ux.run {
            let row = ux.element("today.patientRow", labelContains: "Avery Sample")
            try ux.waitFor(row, "Today: Avery Sample")
            ux.screen("Today")
            try ux.tap(row, "Today row: Avery Sample")
            ux.screen("Patient record")

            if UXRecorder.isPad {
                // One consultation entry in the section bar (UX review M4).
                try ux.tap(ux.element("patient.section.consultation"), "Section bar: Consultation")
            } else {
                try ux.tap(ux.element("patient.quick.Consultation"), "Quick action: Consultation")
            }

            let firstVisit = ux.element("pathway.card.firstVisit")
            try ux.waitFor(firstVisit, "Visit pathway picker (first door)")
            ux.screen("Visit pathway picker")
            try ux.tap(firstVisit, "Pathway: First visit")

            try ux.waitFor(ux.element("consult.step.risk"), "Consultation step bar")
            ux.note("Allergy banner visible in the consultation: "
                    + (ux.element("consult.allergyBanner").exists ? "yes (real allergy)"
                       : ux.element("consult.allergyNKDA").exists ? "no — neutral NKDA line"
                       : ux.element("consult.allergyNotRecorded").exists ? "no — allergies not recorded" : "NO"))
            // Patient identity on the consultation (UX review M1): header on iPhone and the iPad
            // full-screen consultation; inside the iPad record the record header shows it.
            ux.note("Patient identity header in the consultation: "
                    + (ux.element("consult.patientHeader").exists ? "yes" : "no (record header)"))

            try walkFirstVisitSteps(ux)
            try computeScore(ux)
            probeOtherTools(ux)
            try saveAndComplete(ux)
            if UXRecorder.isPad { probeSingleConsultationEntry(ux) }
        }
    }

    @MainActor
    private func walkFirstVisitSteps(_ ux: UXRecorder) throws {
        let steps = Self.firstVisitSteps
        for (i, step) in steps.enumerated() {
            let stepButton = ux.element("consult.step.\(step.tab)")
            if !ux.isSelectedSoon(stepButton) {
                ux.note("Step \(step.label) was not active after advancing; tapped it in the step bar")
                try ux.tap(stepButton, "Step bar → \(step.label) (recovery)")
            }

            switch step.tab {
            case "cc":
                try ux.type("Right upper quadrant pain for 3 days",
                            into: ux.element("consult.cc.field"), "CC: type chief complaint")
            case "hpi":
                let editor = ux.element("consult.hpi.editor")
                try ux.scrollTo(editor, "HPI text editor")
                try ux.type("3 days of constant RUQ pain radiating to the right shoulder, worse after fatty food, "
                            + "with nausea. No jaundice. No fever at home.",
                            into: editor, "HPI: type history")
            case "exam":
                try ux.type("Alert, comfortable at rest. Not jaundiced.",
                            into: ux.element("consult.exam.General appearance"), "Exam: general appearance")
                try ux.type("Tender RUQ, Murphy's sign positive, no guarding.",
                            into: ux.element("consult.exam.Abdomen"), "Exam: abdomen")
            case "diagnosis":
                // The working-diagnosis search is the first section of the step (UX review M11).
                let search = ux.element("consult.dx.search")
                try ux.scrollTo(search, "ICD-10 search field", upwards: true)
                try ux.type("cholecystitis", into: search, "Diagnosis: search ICD-10")
                try ux.tap(ux.element("consult.dx.suggestion"), "Diagnosis: pick first ICD-10 match")
            case "plan":
                let editor = ux.element("consult.plan.editor")
                try ux.scrollTo(editor, "Plan text editor")
                try ux.type("Ultrasound abdomen, FBC, LFTs, CRP. Analgesia and antiemetic. "
                            + "Review with results; discuss laparoscopic cholecystectomy.",
                            into: editor, "Plan: type management plan")
            default:
                break
            }

            ux.screen("Consultation step \(i + 1) - \(step.label)")
            if i + 1 < steps.count { try advance(ux, to: steps[i + 1]) }
        }
    }

    /// Next in the step footer; while the keyboard is up the footer is hidden and the keyboard
    /// toolbar's "Next" does the same (UX review M11); else the step bar (all one tap).
    @MainActor
    private func advance(_ ux: UXRecorder, to next: (tab: String, label: String)) throws {
        let footerNext = ux.element("consult.next")
        let keyboardNext = ux.element("consult.keyboard.next")
        if ux.isHittableSafely(footerNext) {
            try ux.tap(footerNext, "Next → \(next.label)")
        } else if ux.isHittableSafely(keyboardNext) {
            try ux.tap(keyboardNext, "Keyboard toolbar: Next → \(next.label)")
        } else {
            try ux.tap(ux.element("consult.step.\(next.tab)"), "Step bar → \(next.label) (footer hidden by keyboard)")
        }
    }

    /// Opens a tool from the consultation toolbar's Tools menu (over the current step).
    @MainActor
    private func openTool(_ ux: UXRecorder, _ tool: String, label: String) throws {
        try ux.tap(ux.element("consult.tools"), "Tools menu")
        try ux.tap(ux.element(identifier: "consult.tools.\(tool)", orLabel: label), "Tools: \(label)")
    }

    @MainActor
    private func computeScore(_ ux: UXRecorder) throws {
        // Scores open over the current step from the consultation's Tools menu, on both devices
        // (UX review: before, the iPhone had to leave the consultation and reopen it).
        try openTool(ux, "scores", label: "Clinical Scores")
        ux.note("Patient identity in the Tools sheet: "
                + (ux.element("consult.tools.patient").waitForExistence(timeout: 3) ? "yes" : "NO"))
        try ux.waitFor(ux.element("scores.monitor.news2"), "Clinical Scores screen")
        ux.screen("Clinical scores")

        let suggested = ux.element(identifierPrefix: "scores.card.")
        var usedNEWS2 = false
        if suggested.waitForExistence(timeout: 3) {
            ux.note("Diagnosis-driven score chosen: \(suggested.label)")
            try ux.tap(suggested, "Score: first diagnosis-driven suggestion")
        } else {
            ux.note("No diagnosis-driven score offered; NEWS2 used")
            try ux.tap(ux.element("scores.monitor.news2"), "Score: NEWS2")
            usedNEWS2 = true
        }
        if !usedNEWS2 && !ux.element("scores.result").waitForExistence(timeout: 5) {
            ux.note("The suggested score showed no result without further input; NEWS2 used instead")
            ux.snapshot("Suggested score form (no result yet)")
            try ux.tap(ux.button(labeled: "Back to patient scores"), "Back to patient scores")
            try ux.tap(ux.element("scores.monitor.news2"), "Score: NEWS2")
        }
        try ux.waitFor(ux.element("scores.result"), "Score result card")
        ux.screen("Score form and result")

        let save = ux.element("scores.saveToAssessment")
        try ux.scrollTo(save, "Save score to Assessment")
        try ux.tap(save, "Save score to Assessment")
        ux.snapshot("Score saved to Assessment")

        try ux.tap(ux.element("consult.tools.done"), "Done (back to the consultation)")
        try ux.waitFor(ux.element("consult.saveVisit"), "Consultation toolbar")
        ux.note("Consultation step after closing Scores: "
                + (ux.isSelectedSoon(ux.element("consult.step.plan"), timeout: 3) ? "still Plan (kept)" : "NOT Plan"))
        ux.screen("Consultation (back on the same step)")
    }

    /// Vitals and Prescriptions are in the same Tools menu (checked for the report; not counted).
    @MainActor
    private func probeOtherTools(_ ux: UXRecorder) {
        ux.uncounted {
            for (tool, label, marker) in [("vitals", "Vitals", "vitals.record"),
                                          ("prescriptions", "Prescriptions", "rx.add")] {
                do {
                    try openTool(ux, tool, label: label)
                    let shown = ux.element(marker).waitForExistence(timeout: 5)
                        || ux.element("vitals.add").exists
                    ux.note("Tools → \(label) from inside the consultation: " + (shown ? "opens over the step" : "NOT shown"))
                    ux.snapshot("Tools - \(label)")
                    try ux.tap(ux.element("consult.tools.done"), "Done")
                } catch {
                    ux.note("Tools → \(label): \(error)")
                }
            }
        }
    }

    @MainActor
    private func saveAndComplete(_ ux: UXRecorder) throws {
        ux.note("On-screen Save snapshot / Complete explanation on the last step: "
                + (ux.element("consult.actionsExplanation").exists ? "yes" : "no"))
        try ux.tap(ux.element("consult.saveVisit"), "Save snapshot")
        try ux.tapDialogButton("Save Visit")
        ux.snapshot("Visit snapshot saved")
        try ux.tap(ux.element("consult.complete"), "Complete")
        // Review and complete (UX review M8): missing steps, unedited auto-content, attestation.
        let attest = ux.element("consult.completeSheet.attest")
        try ux.waitFor(attest, "Review and complete sheet")
        ux.screen("Review and complete")
        let missing = ux.element("consult.completeSheet.missing")
        if missing.exists { ux.note("Review sheet, not yet documented: \(missing.label)") }
        ux.note("Review sheet lists unedited app-filled content: "
                + (ux.element("consult.completeSheet.unconfirmed").exists ? "yes" : "none"))
        let confirm = ux.element("consult.completeSheet.confirm")
        ux.note("Complete visit enabled before the attestation: " + (confirm.isEnabled ? "YES" : "no"))
        try ux.scrollTo(attest, "Attestation")
        try ux.tap(attest, "Tick: I have reviewed this record")
        try ux.scrollTo(confirm, "Complete visit")
        try ux.tap(confirm, "Complete visit")
        ux.screen("Encounter complete")
    }

    /// iPad: the record's section bar has one Consultation entry, no per-step items (UX review M4).
    /// (Checked for the report; not counted.)
    @MainActor
    private func probeSingleConsultationEntry(_ ux: UXRecorder) {
        let perStep = ["cc", "hpi", "exam", "plan"].filter { ux.element("patient.section.\($0)").exists }
        ux.note("Probe (iPad): section bar consultation entries: "
                + (ux.element("patient.section.consultation").exists ? "one \"Consultation\"" : "none")
                + (perStep.isEmpty ? ", no per-step items" : ", per-step items still present: \(perStep.joined(separator: ", "))"))
        ux.note("Probe (iPad): header Save Visit present: "
                + (ux.element("patient.saveVisit").exists ? "YES (two save buttons)" : "no (one save model)"))
        ux.note("Probe (iPad): header safety strip: "
                + (ux.element("patient.header.safety").exists ? "yes" : "NO"))
        ux.snapshot("Probe - section bar")
    }

    // MARK: - b. Add a new patient

    @MainActor
    func testB_AddPatient() throws {
        let app = launch()
        let ux = UXRecorder(app: app, flow: "b_add_patient",
                            title: "Today → + → name + chief complaint → Add", testCase: self)
        ux.run {
            let add = ux.element("today.addPatient")
            try ux.waitFor(add, "Today: Add patient")
            ux.screen("Today")
            try ux.tap(add, "Add patient (+)")
            let name = ux.element("addPatient.name")
            try ux.waitFor(name, "New Patient form")
            ux.screen("New patient form")
            try ux.type("Taylor Newpatient", into: name, "Full name")
            // The keyboard covers the chips below (run 36181523764, iPhone): put it away first.
            ux.dismissKeyboard()
            let chip = ux.button(labeled: "RUQ pain")
            try ux.scrollTo(chip, "Chief complaint quick chip")
            try ux.tap(chip, "Chief complaint chip: RUQ pain")
            ux.snapshot("New patient form (filled)")
            try ux.tap(ux.element("addPatient.save"), "Add")

            try ux.uncounted {
                let onToday = ux.element("today.patientRow", labelContains: "Taylor Newpatient")
                ux.note("New outpatient without a date shows on Today: "
                        + (onToday.waitForExistence(timeout: 3) ? "yes (Added today)" : "NO (only under Patients)"))
                ux.snapshot("Today after adding")
                try ux.openTab("Patients")
                let row = ux.element("patients.row", labelContains: "Taylor Newpatient")
                try ux.scrollTo(row, "New patient in the Patients list")
                ux.screen("Patients list with the new patient")
            }
        }
    }

    // MARK: - c. Record vitals

    @MainActor
    func testC_RecordVitals() throws {
        let app = launch()
        let ux = UXRecorder(app: app, flow: "c_record_vitals",
                            title: "Today → clinic patient → Vitals → record BP/HR/RR/T/SpO2 → Save",
                            testCase: self)
        ux.run {
            let row = ux.element("today.patientRow", labelContains: "Casey Specimen")
            try ux.waitFor(row, "Today: Casey Specimen")
            ux.screen("Today")
            try ux.tap(row, "Today row: Casey Specimen")
            ux.screen("Patient record")
            if UXRecorder.isPad {
                try ux.tap(ux.element("patient.section.vitals"), "Section bar: Vitals")
            } else {
                try ux.openTab("Vitals")
            }
            let record = ux.element("vitals.record")
            try ux.waitFor(record, "Vitals (none recorded)")
            ux.screen("Vitals")
            try ux.tap(record, "Record Vitals")
            try ux.waitFor(ux.element("vitals.bpSystolic"), "Record Vitals form")
            ux.screen("Record vitals form")

            try ux.type("128", into: ux.element("vitals.bpSystolic"), "Systolic BP")
            try ux.type("82", into: ux.element("vitals.bpDiastolic"), "Diastolic BP")
            try ux.type("76", into: ux.element("vitals.heartRate"), "Heart rate")
            // The live NEWS2 preview sits at the top of the form: capture it while it is on screen
            // (scrolling the sheet back up could dismiss it).
            let preview = ux.element("vitals.news2Preview")
            ux.note("Live NEWS2 preview after BP and HR: " + (preview.exists ? preview.label : "not shown"))
            ux.snapshot("Live NEWS2 preview")
            try ux.type("16", into: ux.element("vitals.respiratoryRate"), "Respiratory rate")
            try ux.type("36.9", into: ux.element("vitals.temperature"), "Temperature")
            try ux.type("98", into: ux.element("vitals.spo2"), "SpO2")
            ux.snapshot("Vitals entered")

            try ux.tap(ux.element("vitals.save"), "Save")
            try ux.waitFor(ux.element("vitals.add"), "Vitals history")
            ux.screen("Vitals history")
        }
    }

    // MARK: - d. Prescription with interaction alert

    @MainActor
    func testD_PrescriptionInteraction() throws {
        let app = launch()
        let ux = UXRecorder(app: app, flow: "d_prescription",
                            title: "Today → ward patient on warfarin → Prescriptions → add ibuprofen → interaction alert",
                            testCase: self)
        ux.run {
            let row = ux.element("today.patientRow", labelContains: "Morgan Example")
            try ux.waitFor(row, "Today: Morgan Example")
            ux.screen("Today")
            try ux.tap(row, "Today row: Morgan Example")
            ux.screen("Patient record")
            if UXRecorder.isPad {
                try ux.tap(ux.element("patient.section.prescriptions"), "Section bar: Rx")
            } else {
                try ux.tap(ux.element("patient.quick.Prescriptions"), "Quick action: Prescriptions")
            }
            let add = ux.element("rx.add")
            try ux.waitFor(add, "Prescriptions")
            ux.screen("Prescriptions")
            try ux.tap(add, "Add prescription (+)")
            let search = ux.element("rx.drugSearch")
            try ux.waitFor(search, "Add Prescription form")
            ux.screen("Add prescription form")

            try ux.type("Ibuprofen", into: search, "Drug search")
            ux.snapshot("Drug typed")
            try ux.tap(ux.element("rx.drugSuggestion", labelContains: "Ibuprofen"), "Pick Ibuprofen (formulary)")

            let live = ux.element("rx.liveInteraction")
            try ux.scrollTo(live, "Interaction warning while prescribing")
            ux.note("Warning while prescribing: \(live.label)")
            ux.screen("Add prescription - interaction warning")

            try ux.tap(ux.element("rx.save"), "Add")
            let alert = ux.element("rx.interactionAlert")
            try ux.waitFor(alert, "Interaction alert on the prescription list")
            ux.note("Alert on the list: \(alert.label)")
            ux.screen("Prescriptions - interaction alert")
        }
    }

    // MARK: - e. Front desk hand-over questionnaire

    @MainActor
    func testE_FrontDeskHandover() throws {
        let app = launch(role: "front_desk")
        let ux = UXRecorder(app: app, flow: "e_frontdesk_handover",
                            title: "Front desk → Questionnaire → find patient → hand-over start screen",
                            testCase: self)
        ux.run {
            if UXRecorder.isPad {
                let questionnaireTab = ux.element("fd.tab.Questionnaire")
                try ux.waitFor(questionnaireTab, "Front desk sidebar")
                ux.screen("Front desk - Check-In")
                try ux.tap(questionnaireTab, "Sidebar: Questionnaire")
                let search = ux.element("fd.questionnaire.search")
                try ux.waitFor(search, "Questionnaire tab")
                ux.screen("Front desk - Questionnaire")
                try ux.type("Ave", into: search, "Find patient (3+ letters)")
                let result = ux.element("fd.questionnaire.result", labelContains: "Avery")
                try ux.waitFor(result, "Search result")
                ux.snapshot("Search result")
                try ux.tap(result, "Pick patient → hand the iPad over")
                try ux.waitFor(ux.element(identifier: "questionnaire.staffExit", orLabel: "Staff: exit"),
                               "Hand-over questionnaire")
                ux.screen("Hand-over questionnaire - start")
            } else {
                let search = app.textFields.firstMatch
                try ux.waitFor(search, "Front desk Check-In")
                ux.screen("Front desk (iPhone) - Check-In")
                try ux.type("Ave", into: search, "Find patient (3+ letters)")
                ux.snapshot("Search result")
                // The Check-In row's own "Questionnaire" action (UX review m3), as on the iPad.
                let action = ux.element("fd.checkin.questionnaire", labelContains: "Avery")
                try ux.tap(action.exists ? action : ux.element("fd.checkin.questionnaire"),
                           "Row action: Questionnaire → hand the phone over")
                try ux.waitFor(ux.element(identifier: "questionnaire.staffExit", orLabel: "Staff: exit"),
                               "Hand-over questionnaire")
                ux.screen("Hand-over questionnaire - start")
            }
        }
    }
}
