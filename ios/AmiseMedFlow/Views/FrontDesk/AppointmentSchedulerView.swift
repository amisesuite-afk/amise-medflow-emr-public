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
    @Query(sort: \Patient.createdAt, order: .reverse) private var allPatients: [Patient]

    @EnvironmentObject private var calendarService: CalendarService
    @EnvironmentObject private var sync: SyncService

    // Pre-bound patient (optional — can open scheduler from a patient card)
    var initialPatient: Patient?

    // MARK: Form state
    @State private var selectedPatient: Patient?
    @State private var patientSearch = ""
    @State private var apptType: ApptType = .followUp
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

    // Feedback
    @State private var isSaving = false
    @State private var savedError: String?
    @State private var savedEvent: EKEvent?

    private var effectiveDuration: TimeInterval {
        usesCustomDuration ? customDuration : apptType.ekDuration
    }

    private var filteredPatients: [Patient] {
        let q = patientSearch.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty { return Array(allPatients.prefix(20)) }
        return allPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.phone?.contains(q) ?? false)
        }.prefix(20).map { $0 }
    }

    private var canSave: Bool { selectedPatient != nil }

    // MARK: Body

    var body: some View {
        NavigationStack {
            Form {
                patientSection
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
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(!canSave || isSaving)
                        .fontWeight(.semibold)
                }
            }
            .sheet(isPresented: $showMailComposer) {
                if let p = selectedPatient, let email = p.email, !email.isEmpty {
                    MailComposer(
                        to: [email],
                        subject: "Appointment Confirmation — Amise Medical",
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
            .sheet(isPresented: $showQuestionnaire) {
                AdaptiveQuestionnaireSheet(patient: selectedPatient)
            }
        }
    }

    // MARK: - Sections

    private var patientSection: some View {
        Section("Patient") {
            if let p = selectedPatient {
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
                TextField("Search name, MRN, phone…", text: $patientSearch)
                    .autocorrectionDisabled()

                if !filteredPatients.isEmpty {
                    ForEach(filteredPatients) { patient in
                        Button {
                            selectedPatient = patient
                            patientSearch = ""
                        } label: {
                            HStack {
                                AcuityPip(acuity: patient.acuity)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(patient.fullName).foregroundStyle(.primary)
                                    HStack(spacing: 4) {
                                        if let mrn = patient.mrn {
                                            Text("MRN \(mrn)").font(.caption2).foregroundStyle(.secondary)
                                        }
                                        if let age = patient.ageDisplay {
                                            Text(age).font(.caption2).foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
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
            Text("Events sync to Google Calendar when amisesuite@gmail.com is added in iOS Settings → Calendar → Accounts.")
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

    // MARK: - Save

    private func save() async {
        guard let patient = selectedPatient else { return }
        isSaving = true
        savedError = nil

        do {
            let event = try await calendarService.createTheatreBooking(
                procedure: apptType.rawValue,
                patientName: patient.fullName,
                date: apptDate,
                duration: effectiveDuration,
                notes: notes,
                calendar: selectedCalendar
            )
            savedEvent = event

            if scheduleReminder {
                let notifService = NotificationService()
                await notifService.requestPermission()
                await notifService.scheduleReminders(
                    id: event.eventIdentifier ?? UUID().uuidString,
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
        } catch {
            savedError = error.localizedDescription
            isSaving = false
        }
    }
}
