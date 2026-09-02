import SwiftUI
import SwiftData
import EventKit

struct OperativePlanView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var plan: OperativePlan?
    @State private var showAIError = false
    @State private var aiError: String?

    var body: some View {
        Group {
            if let plan = plan {
                PlanForm(patient: patient, plan: plan, ai: ai,
                         showAIError: $showAIError, aiError: $aiError,
                         context: context)
            } else {
                ProgressView("Loading plan…")
                    .onAppear { plan = getOrCreate() }
            }
        }
        .onAppear { plan = getOrCreate() }
        .navigationTitle("Operative Plan")
        .navigationBarTitleDisplayMode(.inline)
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: { Text(aiError ?? "Unknown error") }
    }

    private func getOrCreate() -> OperativePlan {
        if let existing = patient.operativePlans.sorted(by: { $0.updatedAt > $1.updatedAt }).first {
            return existing
        }
        let p = OperativePlan()
        p.patient = patient
        if p.consentProcedure.isEmpty, let dx = patient.workingDiagnosis {
            let category = DiagnosisRadiationEngine.radiate(
                workingDiagnosis: dx,
                ageYears: patient.ageYears,
                sex: patient.sex
            )?.consentCategory
            p.consentProcedure = category ?? "Surgery for \(dx)"
        }
        // Safer antibiotic default when penicillin-allergic — clear the beta-lactam default
        if patient.hasPenicillinAllergy {
            p.antibioticProphylaxis = "PENICILLIN ALLERGY — use Clindamycin 600mg IV or discuss with anaesthetist"
        }
        // Note existing anticoagulation in VTE prophylaxis
        if patient.hasAnticoagulation {
            let drugs = patient.activeAnticoagulants.map { $0.drug }.joined(separator: ", ")
            p.vteProphy = "On anticoagulation (\(drugs)) — review bridging protocol"
        }
        context.insert(p)
        return p
    }
}

// MARK: - Plan form (separated so @Bindable can take non-optional)

private struct PlanForm: View {
    @Bindable var patient: Patient
    @Bindable var plan: OperativePlan
    @ObservedObject var ai: AIService
    @Binding var showAIError: Bool
    @Binding var aiError: String?
    let context: ModelContext

    @StateObject private var calSvc = CalendarService()
    @State private var bookingDate = Date().addingTimeInterval(86400)  // default: tomorrow
    @State private var bookingDurationMins: Double = 90
    @State private var bookingNotes = ""
    @State private var bookingCalendar: EKCalendar? = nil
    @State private var isBooking = false
    @State private var bookingMessage: String? = nil
    @State private var bookingSuccess = false

    private var radiationConsentCategory: String? {
        guard let dx = patient.workingDiagnosis else { return nil }
        return DiagnosisRadiationEngine.radiate(
            workingDiagnosis: dx,
            ageYears: patient.ageYears,
            sex: patient.sex
        )?.consentCategory
    }

    private let antibioticChips = [
        "Cefazolin 1g IV", "Cefazolin 2g IV", "Co-amoxiclav 1.2g IV",
        "Metronidazole 500mg IV", "Gentamicin 5mg/kg IV", "Nil (NKDA)"
    ]
    private let vteChips = [
        "Enoxaparin 40mg SC", "Enoxaparin 60mg SC", "Enoxaparin 20mg SC",
        "TED stockings only", "Compression boots", "No prophylaxis"
    ]

    @ViewBuilder
    private func quickChips(_ values: [String], current: String, onTap: @escaping (String) -> Void) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(values, id: \.self) { v in
                    let sel = v == current
                    Button(v) { onTap(v) }
                        .font(.caption2.weight(sel ? .semibold : .regular))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                        .foregroundStyle(sel ? Color.white : AMColor.accent)
                        .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    var body: some View {
        List {
            consentSection
            if !perioperativeFlags.isEmpty { perioperativeFlagsSection }
            theatreBookingSection
            anaesthesiaSection
            whoSignIn
            whoTimeOut
            whoSignOut
            progressSection
            teamSection
            aiSection
        }
    }

    // MARK: - Perioperative flags (deterministic, derived from prescriptions + PMH notes)

    private struct PeriopFlag: Identifiable {
        let id = UUID()
        enum Band { case moderate, high, critical }
        let band: Band
        let title: String
        let detail: String
        let action: String
    }

    private var perioperativeFlags: [PeriopFlag] {
        var flags: [PeriopFlag] = []

        // Steroid stress-dose
        if patient.hasSteroidTherapy {
            let drugs = patient.activeSteroids.map { $0.drug }.joined(separator: ", ")
            flags.append(PeriopFlag(
                band: .high,
                title: "Steroid stress-dose required",
                detail: "Patient on \(drugs). Risk of adrenal insufficiency perioperatively.",
                action: "Hydrocortisone 50–100 mg IV at induction; double maintenance dose post-op × 48 h."
            ))
        }

        // Anticoagulation bridging — enhanced (already noted in anaesthesia section too)
        if patient.hasAnticoagulation {
            let drugs = patient.activeAnticoagulants.map { $0.drug }.joined(separator: ", ")
            flags.append(PeriopFlag(
                band: .high,
                title: "Anticoagulation — bridging protocol",
                detail: "On \(drugs). Perioperative management required.",
                action: "Stop per drug protocol. Consider LMWH bridging if high thrombotic risk. Document post-op restart plan."
            ))
        }

        // OSA / CPAP continuation
        if patient.hasOSAinHistory {
            let bmi = patient.latestBMI() ?? 0
            let band: PeriopFlag.Band = bmi >= 35 ? .high : .moderate
            flags.append(PeriopFlag(
                band: band,
                title: "OSA — CPAP continuation required",
                detail: bmi >= 35 ? "OSA with BMI ≥35 — significantly elevated airway and aspiration risk." : "Obstructive sleep apnoea noted in history.",
                action: "Instruct patient to bring CPAP machine. Apply in recovery. Inform anaesthetist pre-op. Avoid sedative pre-medication."
            ))
        }

        // Obesity — aspiration / airway risk
        if let bmi = patient.latestBMI(), bmi >= 35, !patient.hasOSAinHistory {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Obesity — aspiration & airway risk",
                detail: String(format: "BMI %.0f kg/m².", bmi),
                action: "RSI induction indicated. Ramped position. Inform anaesthetist."
            ))
        }

        // Diabetes — perioperative glucose management
        if patient.hasDiabetesInHistory {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Diabetes — glucose monitoring required",
                detail: "Diabetes mellitus noted. Risk of hypo/hyperglycaemia perioperatively.",
                action: "VRIII sliding scale if glucose >12 mmol/L or >2 h NPO. Monitor 1–2 hourly."
            ))
        }

        // PSHx → adhesion / anatomy flags (keyword scan of persisted surgicalHistory)
        let pshx = (patient.surgicalHistory ?? "").lowercased()
        let adhesionKeywords = ["laparotomy", "bowel resection", "anterior resection", "hartmann",
                                "apr", "whipple", "liver resection", "pancreatectomy"]
        if adhesionKeywords.contains(where: { pshx.contains($0) }) {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Previous abdominal surgery — adhesions likely",
                detail: "Prior major abdominal procedure documented in surgical history.",
                action: "Counsel patient on adhesion risk. Consider laparoscopic-first approach with low threshold for conversion. Ensure bowel prep discussed if indicated."
            ))
        }

        // Gastric bypass / sleeve — anatomy altered
        if pshx.contains("gastric bypass") || pshx.contains("sleeve") || pshx.contains("bariatric") {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Altered upper GI anatomy — bariatric surgery",
                detail: "Gastric bypass or sleeve gastrectomy in surgical history.",
                action: "Standard NG/OG placement may not be suitable. ERCP approach altered. Inform anaesthetist and scrub team."
            ))
        }

        // Splenectomy — asplenic immunocompromise
        if pshx.contains("splenectomy") {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Asplenic patient — infection risk",
                detail: "Splenectomy documented. Increased risk of overwhelming post-splenectomy infection (OPSI).",
                action: "Confirm vaccinations (pneumococcal, Hib, meningococcal). Antibiotic prophylaxis per local protocol if not already on it."
            ))
        }

        return flags
    }

    @ViewBuilder
    private var perioperativeFlagsSection: some View {
        Section {
            ForEach(perioperativeFlags) { flag in
                perioperativeFlagRow(flag)
            }
        } header: {
            Label("Perioperative Alerts", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
        } footer: {
            Text("Deterministic flags from prescriptions, PMH, and surgical history. Verify and document actions before proceeding.")
                .font(.caption2).foregroundStyle(.tertiary)
        }
    }

    @ViewBuilder
    private func perioperativeFlagRow(_ flag: PeriopFlag) -> some View {
        let bandColor: Color = {
            switch flag.band {
            case .moderate: return .orange
            case .high:     return Color(red: 0.85, green: 0.2, blue: 0.1)
            case .critical: return .red
            }
        }()
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(bandColor)
                Text(flag.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(bandColor)
            }
            Text(flag.detail)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 4) {
                Image(systemName: "arrow.right.circle.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(.teal)
                    .padding(.top, 1)
                Text(flag.action)
                    .font(.caption)
                    .foregroundStyle(.teal)
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Theatre / procedure booking

    @ViewBuilder
    private var theatreBookingSection: some View {
        Section {
            // Procedure field (mirrors consent, editable here)
            VStack(alignment: .leading, spacing: 4) {
                Text("PROCEDURE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                Text(plan.consentProcedure.isEmpty ? "Set procedure in Consent section" : plan.consentProcedure)
                    .font(.callout)
                    .foregroundStyle(plan.consentProcedure.isEmpty ? .tertiary : .primary)
            }

            // Patient
            VStack(alignment: .leading, spacing: 4) {
                Text("PATIENT").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                Text(patient.fullName)
                    .font(.callout)
            }

            // Date & time
            DatePicker("Date & time", selection: $bookingDate, in: Date()...)
                .datePickerStyle(.compact)
                .font(.callout)

            // Duration
            VStack(alignment: .leading, spacing: 8) {
                Text("ESTIMATED DURATION").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach([30, 60, 90, 120, 150, 180, 240], id: \.self) { mins in
                            let label = mins < 60 ? "\(mins) min" : (mins % 60 == 0 ? "\(mins/60)h" : "\(mins/60)h \(mins%60)m")
                            let sel = Int(bookingDurationMins) == mins
                            Button(label) { bookingDurationMins = Double(mins) }
                                .font(.caption2.weight(sel ? .semibold : .regular))
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(sel ? Color.white : AMColor.accent)
                                .buttonStyle(.plain)
                        }
                    }
                }
            }

            // Theatre notes
            ZStack(alignment: .topLeading) {
                TextEditor(text: $bookingNotes)
                    .frame(minHeight: 60)
                    .font(.callout)
                if bookingNotes.isEmpty {
                    Text("Special instructions, equipment, implants…")
                        .foregroundStyle(.tertiary).font(.caption)
                        .padding(.top, 8).padding(.leading, 4)
                        .allowsHitTesting(false)
                }
            }

            // Feedback
            if let msg = bookingMessage {
                HStack(spacing: 8) {
                    Image(systemName: bookingSuccess ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(bookingSuccess ? .green : .red)
                    Text(msg)
                        .font(.caption)
                        .foregroundStyle(bookingSuccess ? .green : .red)
                }
            }

            // Book button
            Button {
                Task { await requestBooking() }
            } label: {
                HStack(spacing: 8) {
                    if isBooking {
                        ProgressView().scaleEffect(0.8)
                    } else {
                        Image(systemName: "calendar.badge.plus")
                    }
                    Text(isBooking ? "Booking…" : "Add to iOS Calendar")
                        .font(.callout.weight(.semibold))
                    Spacer()
                    let dur = Int(bookingDurationMins)
                    let label = dur < 60 ? "\(dur) min" : (dur % 60 == 0 ? "\(dur/60)h" : "\(dur/60)h \(dur%60)m")
                    Text(label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .foregroundStyle(plan.consentProcedure.isEmpty || isBooking ? Color.secondary : AMColor.accent)
            .disabled(plan.consentProcedure.isEmpty || isBooking)
            .buttonStyle(.plain)
        } header: {
            Label("Theatre / Procedure Booking", systemImage: "calendar.badge.plus")
        } footer: {
            Text("Creates an event in your iOS Calendar (synced to Google Calendar if connected).")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private func requestBooking() async {
        isBooking = true
        bookingMessage = nil
        defer { isBooking = false }

        let notes = [
            "Patient: \(patient.fullName)",
            patient.ageYears > 0 ? "Age: \(patient.ageYears) yrs · \(patient.sex.rawValue)" : nil,
            patient.mrn.flatMap { $0.isEmpty ? nil : "MRN: \($0)" },
            plan.anaesthesiaType.isEmpty ? nil : "Anaesthesia: \(plan.anaesthesiaType)",
            plan.antibioticProphylaxis.isEmpty ? nil : "Abx: \(plan.antibioticProphylaxis)",
            plan.specialEquipment.isEmpty ? nil : "Equipment: \(plan.specialEquipment)",
            bookingNotes.isEmpty ? nil : bookingNotes,
        ].compactMap { $0 }.joined(separator: "\n")

        do {
            try await calSvc.createTheatreBooking(
                procedure: plan.consentProcedure,
                patientName: patient.fullName,
                date: bookingDate,
                duration: bookingDurationMins * 60,
                notes: notes,
                calendar: bookingCalendar
            )
            bookingSuccess = true
            bookingMessage = "Booking added to iOS Calendar for \(bookingDate.formatted(date: .abbreviated, time: .shortened))"
        } catch {
            bookingSuccess = false
            bookingMessage = error.localizedDescription
        }
    }

    // MARK: - Consent

    @ViewBuilder
    private var consentSection: some View {
        Section("Surgical Consent") {
            if let dx = patient.workingDiagnosis {
                Label("Diagnosis: \(dx)", systemImage: "stethoscope")
                    .font(.caption).foregroundStyle(.secondary)
            }
            if plan.consentProcedure.isEmpty, let cat = radiationConsentCategory {
                Button {
                    plan.consentProcedure = cat
                    touch()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "wand.and.stars")
                            .font(.system(size: 12))
                            .foregroundStyle(.teal)
                        Text("Suggested: \(cat)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.teal)
                    }
                }
                .buttonStyle(.plain)
            }
            TextField("Procedure to consent for", text: $plan.consentProcedure, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: plan.consentProcedure) { _, _ in touch() }
            Toggle("Consent obtained and signed", isOn: $plan.consentSigned)
                .tint(.teal)
                .onChange(of: plan.consentSigned) { _, _ in touch() }
        }
    }

    // MARK: - Anaesthesia

    @ViewBuilder
    private var anaesthesiaSection: some View {
        Section("Anaesthesia & Preparation") {
            // Safety alerts relevant to anaesthesia planning
            if patient.hasCriticalAllergy {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.shield.fill").foregroundStyle(.red)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CRITICAL ALLERGY").font(.system(size: 11, weight: .heavy)).foregroundStyle(.red)
                        Text(patient.criticalAllergies.map { "\($0.name) — \($0.reaction)" }.joined(separator: "\n"))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            if patient.hasPenicillinAllergy {
                Label("Penicillin allergy — avoid beta-lactam antibiotics", systemImage: "exclamationmark.circle.fill")
                    .font(.caption).foregroundStyle(.orange)
            }
            if patient.hasAnticoagulation {
                HStack(spacing: 6) {
                    Image(systemName: "drop.fill").foregroundStyle(.purple).font(.caption)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Anticoagulant therapy").font(.caption.weight(.semibold)).foregroundStyle(.purple)
                        Text(patient.activeAnticoagulants.map { $0.drug }.joined(separator: ", "))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            Picker("ASA Class", selection: Binding<Int>(
                get: { patient.asaClass ?? 0 },
                set: {
                    patient.asaClass = $0 == 0 ? nil : $0
                    patient.updatedAt = .now
                    patient.pendingSync = true
                }
            )) {
                Text("Not set").tag(0)
                Text("ASA I — Healthy").tag(1)
                Text("ASA II — Mild systemic disease").tag(2)
                Text("ASA III — Severe systemic disease").tag(3)
                Text("ASA IV — Life-threatening disease").tag(4)
                Text("ASA V — Moribund").tag(5)
            }

            Picker("Anaesthesia type", selection: $plan.anaesthesiaType) {
                ForEach(["General", "Spinal", "Epidural", "Local + Sedation", "Local only", "Regional"], id: \.self) { Text($0).tag($0) }
            }
            .onChange(of: plan.anaesthesiaType) { _, _ in touch() }
            Picker("Patient position", selection: $plan.positioning) {
                ForEach(["Supine", "Lloyd-Davies", "Left lateral", "Right lateral", "Prone", "Lithotomy", "Trendelenburg", "Reverse Trendelenburg"], id: \.self) { Text($0).tag($0) }
            }
            .onChange(of: plan.positioning) { _, _ in touch() }
            TextField("Antibiotic prophylaxis", text: $plan.antibioticProphylaxis)
                .onChange(of: plan.antibioticProphylaxis) { _, _ in touch() }
            quickChips(antibioticChips, current: plan.antibioticProphylaxis) {
                plan.antibioticProphylaxis = $0; touch()
            }
            TextField("VTE prophylaxis", text: $plan.vteProphy)
                .onChange(of: plan.vteProphy) { _, _ in touch() }
            quickChips(vteChips, current: plan.vteProphy) {
                plan.vteProphy = $0; touch()
            }
            TextField("Special equipment / implants", text: $plan.specialEquipment, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: plan.specialEquipment) { _, _ in touch() }
        }
    }

    // MARK: - WHO Sign In

    @ViewBuilder
    private var whoSignIn: some View {
        Section {
            Toggle("Patient identity confirmed", isOn: $plan.whoIdentityConfirmed).onChange(of: plan.whoIdentityConfirmed) { _, _ in touch() }
            Toggle("Site marked", isOn: $plan.whoSiteMarked).onChange(of: plan.whoSiteMarked) { _, _ in touch() }
            Toggle("Anaesthesia safety check complete", isOn: $plan.whoAnaesthesiaCheckDone).onChange(of: plan.whoAnaesthesiaCheckDone) { _, _ in touch() }
            Toggle("Pulse oximeter on and functioning", isOn: $plan.whoPulseOxOk).onChange(of: plan.whoPulseOxOk) { _, _ in touch() }
            Toggle("Allergies reviewed", isOn: $plan.whoAllergiesReviewed).onChange(of: plan.whoAllergiesReviewed) { _, _ in touch() }
            Toggle("Aspiration risk assessed", isOn: $plan.whoAspirationRisk).onChange(of: plan.whoAspirationRisk) { _, _ in touch() }
            Toggle("Airway risk assessed", isOn: $plan.whoAirwayRisk).onChange(of: plan.whoAirwayRisk) { _, _ in touch() }
        } header: {
            Label("Sign In — before induction", systemImage: "1.circle.fill")
        }
    }

    // MARK: - WHO Time Out

    @ViewBuilder
    private var whoTimeOut: some View {
        Section {
            Toggle("Team introduced by name and role", isOn: $plan.whoTeamIntroduced).onChange(of: plan.whoTeamIntroduced) { _, _ in touch() }
            Toggle("Consent and procedure confirmed", isOn: $plan.whoProcedureConfirmed).onChange(of: plan.whoProcedureConfirmed) { _, _ in touch() }
            Toggle("Antibiotic given within 60 min", isOn: $plan.whoAntibioticGiven).onChange(of: plan.whoAntibioticGiven) { _, _ in touch() }
            Toggle("Critical steps discussed", isOn: $plan.whoCriticalStepsDiscussed).onChange(of: plan.whoCriticalStepsDiscussed) { _, _ in touch() }
            Toggle("Imaging displayed", isOn: $plan.whoImagingDisplayed).onChange(of: plan.whoImagingDisplayed) { _, _ in touch() }
            Toggle("Sterility confirmed", isOn: $plan.whoSterilityConfirmed).onChange(of: plan.whoSterilityConfirmed) { _, _ in touch() }
        } header: {
            Label("Time Out — before incision", systemImage: "2.circle.fill")
        }
    }

    // MARK: - WHO Sign Out

    @ViewBuilder
    private var whoSignOut: some View {
        Section {
            Toggle("Swabs, instruments, needles counted", isOn: $plan.whoSwabsCounted).onChange(of: plan.whoSwabsCounted) { _, _ in touch() }
            Toggle("Specimen labelled correctly", isOn: $plan.whoSpecimenLabelled).onChange(of: plan.whoSpecimenLabelled) { _, _ in touch() }
            Toggle("Equipment problems noted", isOn: $plan.whoEquipmentIssues).onChange(of: plan.whoEquipmentIssues) { _, _ in touch() }
            Toggle("Key concerns for recovery documented", isOn: $plan.whoRecoveryConcerns).onChange(of: plan.whoRecoveryConcerns) { _, _ in touch() }
        } header: {
            Label("Sign Out — before patient leaves", systemImage: "3.circle.fill")
        }
    }

    // MARK: - WHO progress

    @ViewBuilder
    private var progressSection: some View {
        Section {
            let done = plan.whoCompletedCount
            let total = plan.whoTotalCount
            ProgressView(value: Double(done), total: Double(total))
                .tint(done == total ? .green : .orange)
            Text("\(done) / \(total) items complete")
                .font(.caption)
                .foregroundStyle(done == total ? .green : .secondary)
        }
    }

    // MARK: - Team notes

    @ViewBuilder
    private var teamSection: some View {
        Section("Team Notes") {
            TextField("Surgical team, scrub nurse, special instructions…",
                      text: $plan.surgicalTeamNote, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: plan.surgicalTeamNote) { _, _ in touch() }
        }
    }

    // MARK: - AI op note

    @ViewBuilder
    private var aiSection: some View {
        Section("AI Operative Note") {
            Button {
                Task { await draftOpNote() }
            } label: {
                HStack {
                    Label("Draft Operative Note", systemImage: "sparkles")
                    Spacer()
                    if ai.isGenerating { ProgressView() }
                }
            }
            .disabled(ai.isGenerating || plan.consentProcedure.isEmpty)
            .foregroundStyle(.purple)
        }
    }

    // MARK: - Helpers

    private func touch() {
        plan.updatedAt = .now
        plan.pendingSync = true
    }

    private func draftOpNote() async {
        let ctx = [
            plan.anaesthesiaType.isEmpty ? "" : "Anaesthesia: \(plan.anaesthesiaType)",
            plan.positioning.isEmpty    ? "" : "Position: \(plan.positioning)",
            plan.specialEquipment.isEmpty ? "" : "Equipment: \(plan.specialEquipment)",
            plan.surgicalTeamNote.isEmpty ? "" : plan.surgicalTeamNote,
        ].filter { !$0.isEmpty }.joined(separator: ". ")
        do {
            let text = try await ai.generateOpNote(
                patient: patient,
                procedure: plan.consentProcedure,
                findings: ctx.isEmpty ? "As per operative plan" : ctx
            )
            let note = ClinicalNote(noteType: .operative, patient: patient)
            note.freeText = text
            context.insert(note)
            patient.updatedAt = .now
            patient.pendingSync = true
        } catch {
            aiError = error.localizedDescription
            showAIError = true
        }
    }
}
