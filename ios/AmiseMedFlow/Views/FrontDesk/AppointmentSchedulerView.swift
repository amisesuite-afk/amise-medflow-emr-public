import SwiftUI
import SwiftData
import EventKit

// MARK: - Appointment type

enum ApptType: String, CaseIterable, Identifiable {
    case newConsult   = "New Consultation"
    case followUp     = "Follow-Up"
    case procedure    = "Procedure"
    case endoscopy    = "Endoscopy / ERCP"
    case emergency    = "Urgent / Emergency"

    var id: String { rawValue }

    var ekDuration: TimeInterval {
        switch self {
        case .newConsult: return 3600      // 60 min
        case .followUp:   return 1800      // 30 min
        case .procedure:  return 7200      // 2 h
        case .endoscopy:  return 5400      // 90 min
        case .emergency:  return 1800      // 30 min
        }
    }

    var icon: String {
        switch self {
        case .newConsult: return "stethoscope"
        case .followUp:   return "arrow.clockwise"
        case .procedure:  return "scalpel"
        case .endoscopy:  return "waveform.path.ecg"
        case .emergency:  return "cross.case.fill"
        }
    }
}

// MARK: - Duration options

private let durations: [(label: String, seconds: TimeInterval)] = [
    ("15 min", 900), ("30 min", 1800), ("45 min", 2700),
    ("1 hour", 3600), ("90 min", 5400), ("2 hours", 7200)
]

// MARK: - AppointmentSchedulerView

struct AppointmentSchedulerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \Patient.createdAt, order: .reverse) private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @EnvironmentObject private var calendarService: CalendarService
    @EnvironmentObject private var sync: SyncService

    // Pre-bound patient (optional — can open scheduler from a patient card)
    var initialPatient: Patient?

    // MARK: Form state
    @State private var selectedPatient: Patient?
    @State private var patientSearch = ""
    @State private var apptType: ApptType = .followUp
    /// Saved to `patient.visitType`: the patient's current type once one is chosen, else New Consult.
    @State private var visitType: VisitType = .newConsult
    @State private var apptDate = Calendar.ect.date(byAdding: .day, value: 1, to: Calendar.ect.startOfDay(for: .now)) ?? .now
    @State private var customDuration: TimeInterval = 1800
    @State private var usesCustomDuration = false
    @State private var selectedCalendar: EKCalendar?
    @State private var notes = ""

    // Outbound actions
    @State private var sendEmail = false
    @State private var sendSMS = false
    @State private var scheduleReminder = true
    @State private var openQuestionnaire = false

    // Compose sheet state
    @State private var showMailComposer = false
    @State private var showSMSComposer = false
    @State private var showQuestionnaire = false
    @State private var showAddPatient = false

    // Feedback
    @State private var isSaving = false
    @State private var savedError: String?
    @State private var savedEvent: EKEvent?
    /// The booking was saved to the patient's record (it is, before the calendar write).
    @State private var recordSaved = false

    private var effectiveDuration: TimeInterval {
        usesCustomDuration ? customDuration : apptType.ekDuration
    }

    /// Maps appointment type to the corresponding clinical setting so the
    /// patient record is updated when a procedure or endoscopy is scheduled.
    private var impliedSetting: ClinicalSetting? { apptType.impliedSetting }

    // Privacy (surgeon's requirement): the scheduler is opened at the front desk, whose screen can
    // be seen across the counter, so there is no default patient list. Names appear only after a
    // real search: 3+ letters of the name or an MRN, at most 5 matches (QuestionnairePatientSearch).
    private var filteredPatients: [Patient] {
        QuestionnairePatientSearch.matches(query: patientSearch, in: allPatients)
    }

    private var trimmedPatientSearch: String { QuestionnairePatientSearch.normalized(patientSearch) }

    private var patientSearchHint: String {
        QuestionnairePatientSearch.isNameSearch(trimmedPatientSearch)
            ? "No match. Check the spelling or use the MRN."
            : "Type at least \(QuestionnairePatientSearch.minimumNameLength) letters of the name, or the MRN."
    }

    private var canSave: Bool { selectedPatient?.isLive == true }

    // MARK: Body

    var body: some View {
        NavigationStack {
            Form {
                calendarErrorSection
                patientSection
                visitTypeSection
                appointmentSection
                calendarSection
                outboundSection
                notesSection
            }
            .navigationTitle("Schedule Appointment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("fd.scheduler.cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(!canSave || isSaving)
                        .fontWeight(.semibold)
                        .accessibilityIdentifier("fd.scheduler.save")
                }
            }
            .sheet(isPresented: $showMailComposer) {
                if let p = selectedPatient, let email = p.email, !email.isEmpty {
                    MailComposer(
                        to: [email],
                        subject: "Appointment Confirmation — \(PracticeProfile.current.displayShortPracticeName)",
                        body: AppointmentMessage.emailBody(
                            patientName: p.fullName,
                            date: apptDate,
                            type: apptType.rawValue
                        ),
                        isPresented: $showMailComposer
                    )
                }
            }
            .sheet(isPresented: $showSMSComposer) {
                if let p = selectedPatient, let phone = p.phone, !phone.isEmpty {
                    SMSComposer(
                        recipients: [phone],
                        body: AppointmentMessage.smsBody(
                            patientName: p.fullName,
                            date: apptDate,
                            type: apptType.rawValue
                        ),
                        isPresented: $showSMSComposer
                    )
                }
            }
            // Patient hand-over mode: full screen on iPad, staff-only exit.
            .patientHandoverPresentation(isPresented: $showQuestionnaire,
                                         patient: selectedPatient,
                                         entryPoint: .scheduler)
            .sheet(isPresented: $showAddPatient) {
                AddPatientView(
                    initialSetting: impliedSetting ?? .outpatient,
                    initialProcedure: apptType == .procedure || apptType == .endoscopy ? apptType.rawValue : "",
                    operationDate: apptDate,
                    initialVisitType: visitType
                )
            }
            .onAppear {
                // Opened from a patient card: start with that patient, so staff never need to
                // search for someone already on screen.
                if selectedPatient == nil, let p = initialPatient, p.isLive {
                    select(p)
                }
            }
        }
    }

    // MARK: - Sections

    private var patientSection: some View {
        Section {
            if let p = selectedPatient, p.isLive {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.fullName).fontWeight(.semibold)
                        HStack(spacing: 6) {
                            if let mrn = p.mrn { Text("MRN \(mrn)").font(.caption).foregroundStyle(.secondary) }
                            if let dob = p.ageDisplay { Text(dob).font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                    Spacer()
                    Button("Change") { selectedPatient = nil; patientSearch = "" }
                        .font(.caption).foregroundStyle(AMColor.accent)
                }
            } else {
                TextField("Name (3+ letters) or MRN…", text: $patientSearch)
                    .autocorrectionDisabled()

                if !trimmedPatientSearch.isEmpty && filteredPatients.isEmpty {
                    Text(patientSearchHint)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !filteredPatients.isEmpty {
                    ForEach(filteredPatients) { patient in
                        Button {
                            select(patient)
                        } label: {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(patient.fullName).foregroundStyle(.primary)
                                if let mrn = patient.mrn, !mrn.isEmpty {
                                    Text("MRN \(mrn)").font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                Button {
                    showAddPatient = true
                } label: {
                    Label("Register New Patient", systemImage: "person.badge.plus")
                        .foregroundStyle(AMColor.accent)
                }
            }
        } header: {
            Text("Patient")
        } footer: {
            if selectedPatient?.isLive != true {
                Text("For privacy, no patient list is shown. At most \(QuestionnairePatientSearch.maxResults) matches appear.")
            }
        }
    }

    /// A chosen patient brings their current visit type (New Consult when none is recorded).
    private func select(_ patient: Patient) {
        selectedPatient = patient
        patientSearch = ""
        visitType = patient.visitType ?? .newConsult
    }

    private var visitTypeSection: some View {
        Section {
            VisitTypeChipRow(selection: $visitType, identifier: "fd.scheduler.visitType") { vt in
                // The booking type follows (duration, theatre / scope list); staff can change it.
                if let suggested = ApptType.suggested(for: vt) { apptType = suggested }
            }
        } header: {
            Text("Visit Type")
        } footer: {
            if let p = selectedPatient, p.isLive, p.visitType != visitType {
                Text("Saved to the record with the appointment (now: \(p.visitType?.rawValue ?? "not set")).")
            }
        }
    }

    private var appointmentSection: some View {
        Section("Appointment") {
            Picker("Type", selection: $apptType) {
                ForEach(ApptType.allCases) { t in
                    Label(t.rawValue, systemImage: t.icon).tag(t)
                }
            }

            DatePicker("Date & Time",
                       selection: $apptDate,
                       in: Date.now...,
                       displayedComponents: [.date, .hourAndMinute])
                .environment(\.timeZone, TimeZone.ect)
                .environment(\.locale, Locale(identifier: "en_LC"))

            Toggle("Custom Duration", isOn: $usesCustomDuration.animation())
            if usesCustomDuration {
                Picker("Duration", selection: $customDuration) {
                    ForEach(durations, id: \.seconds) { d in
                        Text(d.label).tag(d.seconds)
                    }
                }
                .pickerStyle(.segmented)
            } else {
                let mins = Int(apptType.ekDuration / 60)
                Text("Duration: \(mins < 60 ? "\(mins) min" : "\(mins / 60) hr\(mins % 60 > 0 ? " \(mins % 60) min" : "")")")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var calendarAccountHint: String {
        let email = PracticeProfile.current.email
        let account = email.isEmpty ? "your practice Google account" : email
        return "Events sync to Google Calendar when \(account) is added in iOS Settings → Calendar → Accounts."
    }

    private var calendarSection: some View {
        Section {
            let cals = calendarService.availableCalendars()
            if !cals.isEmpty {
                Picker("Calendar", selection: $selectedCalendar) {
                    Text("Default").tag(Optional<EKCalendar>.none)
                    ForEach(cals, id: \.calendarIdentifier) { cal in
                        HStack {
                            Circle()
                                .fill(Color(cgColor: cal.cgColor))
                                .frame(width: 10, height: 10)
                            Text(cal.title)
                        }
                        .tag(Optional(cal))
                    }
                }
            }
        } header: {
            Text("Google Calendar")
        } footer: {
            Text(calendarAccountHint)
                .font(.caption2)
        }
    }

    private var outboundSection: some View {
        Section("Notify Patient") {
            Toggle(isOn: $sendEmail) {
                Label("Email Confirmation", systemImage: "envelope")
            }
            .disabled(selectedPatient?.email?.isEmpty != false)

            Toggle(isOn: $sendSMS) {
                Label("SMS Reminder", systemImage: "message")
            }
            .disabled(selectedPatient?.phone?.isEmpty != false)

            Toggle(isOn: $scheduleReminder) {
                Label("Device Reminder (1 hr before + morning)", systemImage: "bell")
            }

            Toggle(isOn: $openQuestionnaire) {
                Label("Open Pre-Consult Questionnaire", systemImage: "list.clipboard")
            }
        }
    }

    private var notesSection: some View {
        Section("Notes") {
            TextField("Clinical notes, special instructions…", text: $notes, axis: .vertical)
                .lineLimit(3...6)
        }
    }

    // MARK: - Calendar error

    /// Shown when the calendar write failed (e.g. calendar access denied): the error, that the
    /// record was saved anyway, and a retry. It used to be recorded in `savedError` and never shown,
    /// so Save silently did nothing.
    @ViewBuilder
    private var calendarErrorSection: some View {
        if let error = savedError {
            Section {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("fd.scheduler.calendarError")
                if recordSaved {
                    Text("The visit type and appointment were saved to the patient's record. The calendar entry was not made.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Button {
                    Task { await save() }
                } label: {
                    Label("Retry Calendar", systemImage: "arrow.clockwise")
                }
                .disabled(isSaving || selectedPatient?.isLive != true)
                .accessibilityIdentifier("fd.scheduler.retryCalendar")
                if recordSaved {
                    Button("Done Without Calendar") {
                        guard let p = selectedPatient, p.isLive else { dismiss(); return }
                        Task { await finish(patient: p, eventId: nil) }
                    }
                    .disabled(isSaving)
                    .accessibilityIdentifier("fd.scheduler.doneWithoutCalendar")
                }
            } header: {
                Text("Calendar Not Updated")
            }
        }
    }

    // MARK: - Save

    /// Saves the booking to the patient's record first (on the device, synced like any edit), then
    /// writes the practice calendar. A calendar failure is shown with a retry; the record is kept.
    private func save() async {
        guard let patient = selectedPatient, patient.isLive else { return }
        isSaving = true
        savedError = nil

        // 1. The record: visit type, booking type, and for a procedure / endoscopy the setting and
        //    date, whatever happens to the calendar.
        let change = ApptType.applyBooking(apptType, visitType: visitType, date: apptDate, to: patient)
        if change.visitTypeChanged {
            AuditLog.record("update", "patient", patient: patient,
                            details: ["field": "visit_type", "to": visitType.rawValue])
        }
        if change.appointmentTypeChanged {
            AuditLog.record("update", "patient", patient: patient,
                            details: ["field": "appointment_type", "to": apptType.rawValue])
        }
        if change.edited { try? context.save() }
        recordSaved = true

        // 2. The practice calendar (staff only): booking type and visit type in the title.
        do {
            let event = try await calendarService.createTheatreBooking(
                procedure: ApptType.eventLabel(apptType, visitType: visitType),
                patientName: patient.fullName,
                date: apptDate,
                duration: effectiveDuration,
                notes: notes,
                calendar: selectedCalendar
            )
            savedEvent = event
            // The record may have been removed or merged by sync during the calendar request.
            guard patient.isLive else { isSaving = false; dismiss(); return }
            await finish(patient: patient, eventId: event.eventIdentifier)
        } catch {
            savedError = error.localizedDescription
            isSaving = false
        }
    }

    /// Reminders and the chosen follow-on (email, SMS, questionnaire), then close.
    private func finish(patient: Patient, eventId: String?) async {
        isSaving = true
        if scheduleReminder {
            let notifService = NotificationService()
            await notifService.requestPermission()
            await notifService.scheduleReminders(
                id: eventId ?? UUID().uuidString,
                patientName: patient.fullName,
                date: apptDate,
                type: apptType.rawValue
            )
        }
        isSaving = false

        if sendEmail && MailComposer.canSendMail && patient.email?.isEmpty == false {
            showMailComposer = true
        } else if sendSMS && SMSComposer.canSendText && patient.phone?.isEmpty == false {
            showSMSComposer = true
        } else if openQuestionnaire {
            showQuestionnaire = true
        } else {
            dismiss()
        }
    }
}
