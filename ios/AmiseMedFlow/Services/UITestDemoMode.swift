// UITestDemoMode.swift
// Demo mode for the automated UI walkthrough (AmiseMedFlowUITests). DEBUG builds only: this whole
// file, and every check of `UITestDemoMode.isActive` elsewhere, sits inside `#if DEBUG`, so none
// of it exists in a Release (TestFlight / App Store) build.
//
// Turned on only by the launch argument `-UITestDemoMode` (the UI tests pass it; nothing in the
// app sets it). While on:
//   • the app is unlocked and "signed in" as a synthetic clinician (no Face ID, no login screen,
//     no Supabase session); `-UITestDemoRole front_desk` opens the front-desk layout instead;
//   • the SwiftData store is in memory only and is seeded with a few SYNTHETIC demo patients
//     (below) — the on-disk store is never opened, read or written;
//   • nothing leaves the device: cloud sync, realtime, peer (nearby) sync, the audit-log upload,
//     Sentry crash reporting and the calendar are all off;
//   • the one-time AI disclosure sheet is not shown (AI is off in this build anyway).
//
// Demo data rules: every name is an obvious placeholder, every MRN starts "DEMO-", no phone
// numbers, emails or addresses. Never put real patient data here.

#if DEBUG
import Foundation
import SwiftData

enum UITestDemoMode {

    static let launchArgument = "-UITestDemoMode"
    static let roleArgument = "-UITestDemoRole"

    /// True only when the app was launched with `-UITestDemoMode` (UI tests).
    static let isActive: Bool = ProcessInfo.processInfo.arguments.contains(launchArgument)

    /// Role of the synthetic user: `-UITestDemoRole <user_profiles role>` (e.g. `front_desk`),
    /// doctor when absent or unknown.
    static var role: UserRole {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: roleArgument), i + 1 < args.count,
              let role = UserRole(rawValue: args[i + 1]) else { return .doctor }
        return role
    }

    /// Synthetic session identity (".invalid" is a reserved domain: it can never be delivered).
    static let userEmail = "demo.clinician@example.invalid"
    static let userId = "00000000-0000-4000-8000-000000000001"

    // MARK: - In-memory store

    /// An in-memory container seeded with the demo patients. Never touches the on-disk store.
    static func makeSeededContainer(schema: Schema) -> ModelContainer {
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true, cloudKitDatabase: .none)
        do {
            let container = try ModelContainer(for: schema, configurations: [config])
            let context = ModelContext(container)
            seed(context)
            try context.save()
            return container
        } catch {
            fatalError("UITestDemoMode: in-memory store could not be created (\(error))")
        }
    }

    // MARK: - Synthetic demo patients

    /// Four synthetic patients, one per walkthrough flow:
    ///   Avery Sample     — checked in, waiting for the doctor (consultation flow); penicillin
    ///                      anaphylaxis so the allergy banner shows.
    ///   Morgan Example   — ward patient with a high NEWS2 and warfarin (prescription interaction).
    ///   Riley Placeholder— on today's endoscopy list.
    ///   Casey Specimen   — in today's clinic, no vitals yet (record-vitals flow).
    static func seed(_ context: ModelContext) {
        let cal = Calendar.current
        let now = Date()
        let startOfDay = cal.startOfDay(for: now)
        let endOfDay = cal.date(byAdding: .day, value: 1, to: startOfDay) ?? now
        func yearsAgo(_ years: Int) -> Date? { cal.date(byAdding: .year, value: -years, to: now) }
        // Earlier / later today, clamped so the time is always today (the Today lists filter on it).
        func earlierToday(minutes: Int) -> Date { max(startOfDay, now.addingTimeInterval(TimeInterval(-60 * minutes))) }
        func laterToday(minutes: Int) -> Date { min(endOfDay.addingTimeInterval(-60), now.addingTimeInterval(TimeInterval(60 * minutes))) }

        // 1 — Waiting for the doctor (first-visit consultation).
        let avery = Patient(fullName: "Avery Sample", sex: .female, setting: .outpatient,
                            location: .rodney_bay, acuity: .routine)
        avery.dateOfBirth = yearsAgo(46)
        avery.mrn = "DEMO-0001"
        avery.encounterStatus = .waiting
        avery.checkInTime = earlierToday(minutes: 12)
        avery.pmhNotes = "CONDITIONS: Hypertension"
        avery.allergies = [AllergyEntry(name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis")]
        context.insert(avery)
        addPrescription(to: avery, drug: "Amlodipine", dose: "5 mg", frequency: "OD",
                        indication: "Hypertension", in: context)
        addVitals(to: avery, at: earlierToday(minutes: 10), sys: 138, dia: 84, hr: 78, rr: 14,
                  temp: 36.8, spo2: 98, in: context)

        // 2 — Ward patient: high NEWS2, on warfarin.
        let morgan = Patient(fullName: "Morgan Example", sex: .male, setting: .inpatient,
                             location: .tapion, acuity: .urgent)
        morgan.dateOfBirth = yearsAgo(71)
        morgan.mrn = "DEMO-0002"
        morgan.ward = "Surgical Ward (demo)"
        morgan.bedNumber = "7"
        morgan.admittedAt = now.addingTimeInterval(-2 * 86_400)
        morgan.visitType = .wardReview
        morgan.encounterStatus = .withDoctor
        morgan.chiefComplaint = "Abdominal distension and vomiting"
        morgan.workingDiagnosis = "Adhesional small bowel obstruction"
        morgan.workingDiagnosisICD = "K56.5"
        morgan.pmhNotes = "CONDITIONS: Atrial fibrillation, Hypertension"
        morgan.allergies = [Patient.nkdaMarkerEntry()]
        context.insert(morgan)
        addPrescription(to: morgan, drug: "Warfarin", dose: "3 mg", frequency: "OD",
                        indication: "Atrial fibrillation", in: context)
        addPrescription(to: morgan, drug: "Paracetamol", dose: "1 g", frequency: "QDS",
                        indication: "Analgesia", in: context)
        addVitals(to: morgan, at: earlierToday(minutes: 40), sys: 98, dia: 60, hr: 112, rr: 24,
                  temp: 38.4, spo2: 93, in: context)

        // 3 — Today's endoscopy list.
        let riley = Patient(fullName: "Riley Placeholder", sex: .female, setting: .endoscopy,
                            location: .rodney_bay, acuity: .routine)
        riley.dateOfBirth = yearsAgo(58)
        riley.mrn = "DEMO-0003"
        riley.visitType = .colonoscopy
        riley.operationDate = laterToday(minutes: 90)
        riley.chiefComplaint = "Change in bowel habit"
        riley.allergies = [Patient.nkdaMarkerEntry()]
        context.insert(riley)

        // 4 — Today's clinic, follow-up, no vitals yet.
        let casey = Patient(fullName: "Casey Specimen", sex: .male, setting: .outpatient,
                            location: .rodney_bay, acuity: .routine)
        casey.dateOfBirth = yearsAgo(34)
        casey.mrn = "DEMO-0004"
        casey.visitType = .followUp
        casey.operationDate = laterToday(minutes: 150)
        casey.chiefComplaint = "Post-op wound review"
        casey.surgicalHistory = "Laparoscopic appendicectomy (demo)"
        context.insert(casey)
    }

    private static func addPrescription(to patient: Patient, drug: String, dose: String,
                                        frequency: String, indication: String,
                                        in context: ModelContext) {
        let rx = Prescription(drug: drug, dose: dose, route: "Oral", frequency: frequency,
                              duration: "Ongoing", indication: indication)
        rx.patient = patient
        context.insert(rx)
    }

    private static func addVitals(to patient: Patient, at date: Date, sys: Int, dia: Int, hr: Int,
                                  rr: Int, temp: Double, spo2: Int, in context: ModelContext) {
        let v = VitalsEntry(patient: patient, recordedAt: date)
        v.bpSystolic = sys
        v.bpDiastolic = dia
        v.heartRate = hr
        v.respiratoryRate = rr
        v.temperatureCelsius = temp
        v.spo2 = spo2
        context.insert(v)
    }
}
#endif
