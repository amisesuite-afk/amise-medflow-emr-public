// UXWalkthroughTests.swift
// Automated UI walkthrough for the surgeon's usability review. Each test launches the app in
// DEBUG demo mode (-UITestDemoMode: synthetic in-memory patients, no sign-in, no Face ID, no
// sync, no Sentry — see AmiseMedFlow/Services/UITestDemoMode.swift), runs one flow, screenshots
// every step and records taps / text entries / scrolls / screens (UXRecorder).
//
// Flows (same on iPhone and iPad; the iPad reaches consultation steps through the record's
// section bar, the iPhone through the record's quick actions):
//   a  Today → patient → consultation → "First visit" pathway → every step (typing in CC, HPI,
//      exam, diagnosis, plan) → Scores (compute + save one) → Save Visit → Complete
//   b  Add a new patient
//   c  Record vitals
//   d  Add a prescription that interacts with warfarin → interaction alert
//   e  Front desk: hand-over questionnaire start screen (front-desk role)
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
                            title: "Today → patient → consultation (First visit, all 12 steps) → score → save & complete",
                            testCase: self)
        ux.run {
            let row = ux.element("today.patientRow", labelContains: "Avery Sample")
            try ux.waitFor(row, "Today: Avery Sample")
            ux.screen("Today")
            try ux.tap(row, "Today row: Avery Sample")
            ux.screen("Patient record")

            if UXRecorder.isPad {
                try ux.tap(ux.element("patient.section.cc"), "Section bar: CC")
            } else {
                try ux.tap(ux.element("patient.quick.Consultation"), "Quick action: Consultation")
            }

            let firstVisit = ux.element("pathway.card.firstVisit")
            try ux.waitFor(firstVisit, "Visit pathway picker (first door)")
            ux.screen("Visit pathway picker")
            try ux.tap(firstVisit, "Pathway: First visit")

            try ux.waitFor(ux.element("consult.step.risk"), "Consultation step bar")
            ux.note("Allergy banner visible in the consultation: "
                    + (ux.element("consult.allergyBanner").exists ? "yes" : "NO"))

            try walkFirstVisitSteps(ux)
            try computeScore(ux)
            try saveAndComplete(ux)
            if UXRecorder.isPad { probeSectionBarSwitch(ux) }
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
                let search = ux.element("consult.dx.search")
                try ux.scrollTo(search, "ICD-10 search field")
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

    /// Next in the step footer; the footer is hidden while the keyboard is up, so then the next
    /// step in the step bar (both one tap).
    @MainActor
    private func advance(_ ux: UXRecorder, to next: (tab: String, label: String)) throws {
        let footerNext = ux.element("consult.next")
        if footerNext.exists && footerNext.isHittable {
            try ux.tap(footerNext, "Next → \(next.label)")
        } else {
            try ux.tap(ux.element("consult.step.\(next.tab)"), "Step bar → \(next.label) (footer hidden by keyboard)")
        }
    }

    @MainActor
    private func computeScore(_ ux: UXRecorder) throws {
        if UXRecorder.isPad {
            try ux.tap(ux.element("patient.section.scores"), "Section bar: Scores")
        } else {
            // Scores is not reachable from inside the consultation on iPhone: back to the record.
            try ux.goBack(previousTitle: "Avery Sample")
            try ux.tap(ux.element("patient.quick.Scores"), "Quick action: Scores")
        }
        try ux.waitFor(ux.element("scores.monitor.news2"), "Clinical Scores screen")
        ux.screen("Clinical scores")

        let suggested = ux.element(identifierPrefix: "scores.card.")
        if suggested.waitForExistence(timeout: 3) {
            ux.note("Diagnosis-driven score chosen: \(suggested.label)")
            try ux.tap(suggested, "Score: first diagnosis-driven suggestion")
        } else {
            ux.note("No diagnosis-driven score offered; NEWS2 used")
            try ux.tap(ux.element("scores.monitor.news2"), "Score: NEWS2")
        }
        try ux.waitFor(ux.element("scores.result"), "Score result card")
        ux.screen("Score form and result")

        let save = ux.element("scores.saveToAssessment")
        try ux.scrollTo(save, "Save score to Assessment")
        try ux.tap(save, "Save score to Assessment")
        ux.snapshot("Score saved to Assessment")

        if UXRecorder.isPad {
            try ux.tap(ux.element("patient.section.plan"), "Section bar: Plan (back to the consultation)")
        } else {
            try ux.goBack(previousTitle: "Avery Sample")
            try ux.tap(ux.element("patient.quick.Consultation"), "Quick action: Consultation (again)")
        }
        try ux.waitFor(ux.element("consult.saveVisit"), "Consultation toolbar")
        ux.screen("Consultation (reopened)")
    }

    @MainActor
    private func saveAndComplete(_ ux: UXRecorder) throws {
        try ux.tap(ux.element("consult.saveVisit"), "Save Visit")
        try ux.tapDialogButton("Save Visit")
        ux.snapshot("Visit saved")
        try ux.tap(ux.element("consult.complete"), "Complete")
        ux.screen("Complete encounter confirmation")
        try ux.tapDialogButton("Mark as Complete")
        ux.screen("Encounter complete")
    }

    /// iPad: does tapping another consultation section in the record's section bar change the
    /// consultation step shown? (Checked for the report; not counted.)
    @MainActor
    private func probeSectionBarSwitch(_ ux: UXRecorder) {
        guard ux.probeTap(ux.element("patient.section.cc")) else {
            ux.note("Probe: could not tap section CC")
            return
        }
        let switched = ux.isSelectedSoon(ux.element("consult.step.cc"), timeout: 3)
        ux.note("Probe (iPad): from the Plan section, tapping section CC "
                + (switched ? "showed the CC step." : "did NOT change the consultation step (still on the previous step)."))
        ux.snapshot("Probe - section bar CC tapped from Plan")
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
            let chip = ux.button(labeled: "RUQ pain")
            try ux.scrollTo(chip, "Chief complaint quick chip")
            try ux.tap(chip, "Chief complaint chip: RUQ pain")
            ux.snapshot("New patient form (filled)")
            try ux.tap(ux.element("addPatient.save"), "Add")

            try ux.uncounted {
                let onToday = ux.element("today.patientRow", labelContains: "Taylor Newpatient")
                ux.note("New outpatient without a date shows on Today: "
                        + (onToday.waitForExistence(timeout: 3) ? "yes" : "NO (only under Patients)"))
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
            try ux.type("16", into: ux.element("vitals.respiratoryRate"), "Respiratory rate")
            try ux.type("36.9", into: ux.element("vitals.temperature"), "Temperature")
            try ux.type("98", into: ux.element("vitals.spo2"), "SpO2")
            ux.snapshot("Vitals entered")

            ux.uncounted {
                let preview = ux.element("vitals.news2Preview")
                ux.bringOnScreen(preview, counted: false, searchUpwards: true)
                ux.note("Live NEWS2 preview: " + (preview.exists ? preview.label : "not shown"))
                ux.snapshot("Live NEWS2 preview")
            }

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
                // The iPhone front desk has no questionnaire entry of its own: it opens only after
                // saving a new appointment (Schedule → + → patient → "Open Pre-Consult
                // Questionnaire" → Save), which writes a calendar event. Not scripted.
                throw UXSkip(reason: "iPhone front desk: the hand-over questionnaire opens only after saving "
                                     + "a new appointment (Schedule → + → pick patient → toggle → Save, which "
                                     + "creates a calendar event); not scripted.")
            }
        }
    }
}
