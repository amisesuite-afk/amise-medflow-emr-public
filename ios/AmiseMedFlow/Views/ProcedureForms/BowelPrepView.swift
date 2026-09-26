import SwiftUI
import SwiftData
import UIKit

// MARK: - Bowel preparation (colonoscopy / flexible sigmoidoscopy)
//
// The clinician picks the preparation (pre-selected: magnesium-based, or PEG when a safety
// check points that way), sees the split-dose timetable in practice time, and shares or prints
// a patient sheet. Safety checks are dismissible suggestions and never change the choice.
// Nothing is sent automatically; every share / print is audit-logged.
// Stored in Patient.pathwayDataJson → PathwayData.bowelPrep (syncs with the pathway data).

struct BowelPrepShareItem: Identifiable {
    let id = UUID()
    let items: [Any]
}

struct BowelPrepView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var plan = BowelPrepPlan()
    @State private var facts = BowelPrepPatientFacts()
    @State private var signOffs: [String: BowelPrepSignOffRecord] = [:]
    @State private var shareItem: BowelPrepShareItem?
    @State private var showDismissed = false

    private enum ShareFormat: String { case pdf, text, print }

    // MARK: Derived

    private var procedure: BowelPrepProcedure {
        plan.procedure ?? BowelPrepProcedure.detect(for: patient) ?? .colonoscopy
    }

    private var suggestions: [BowelPrepSuggestion] { BowelPrepSafety.suggestions(for: facts) }

    private var suggestedID: BowelPrepRegimenID {
        BowelPrepSafety.suggestedRegimen(for: procedure, suggestions: suggestions)
    }

    private var selectedID: BowelPrepRegimenID {
        if let chosen = plan.regimen, BowelPrepRegimen.regimen(chosen).procedures.contains(procedure) {
            return chosen
        }
        return suggestedID
    }

    private var regimen: BowelPrepRegimen { BowelPrepRegimen.regimen(selectedID) }

    /// The clinician has explicitly chosen the regimen shown.
    private var isConfirmed: Bool { plan.regimen == selectedID }

    private var isSignedOff: Bool { BowelPrepSignOff.isSignedOff(regimen, records: signOffs) }

    private var appointment: Date? { plan.appointment ?? patient.operationDate }

    private var schedule: BowelPrepSchedule? {
        guard let appt = appointment else { return nil }
        return BowelPrepScheduler.schedule(regimen: regimen, procedure: procedure, appointment: appt,
                                           options: plan.options, timeZone: .ect)
    }

    private var visibleSuggestions: [BowelPrepSuggestion] {
        suggestions.filter { !plan.dismissedSuggestions.contains($0.id) }
    }

    private var dismissedSuggestionList: [BowelPrepSuggestion] {
        suggestions.filter { plan.dismissedSuggestions.contains($0.id) }
    }

    // MARK: Body

    var body: some View {
        Form {
            procedureSection
            regimenSection
            if !suggestions.isEmpty { safetySection }
            if regimen.category != .enema { timingSection }
            scheduleSection
            shareSection
        }
        .navigationTitle("Bowel Preparation")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $shareItem) { item in
            ShareSheet(items: item.items)
        }
        .onAppear { load() }
    }

    // MARK: Procedure and appointment

    private var procedureSection: some View {
        Section {
            Picker("Procedure", selection: Binding(
                get: { procedure },
                set: { plan.procedureRaw = $0.rawValue; save() })) {
                ForEach(BowelPrepProcedure.allCases) { p in
                    Text(p.title).tag(p)
                }
            }
            if let appt = appointment {
                DatePicker("Date and time", selection: Binding(
                    get: { appt },
                    set: { plan.appointment = $0; save() }))
                    .environment(\.timeZone, .ect)
                if plan.appointment != nil, patient.operationDate != nil {
                    Button("Use the booked procedure date") {
                        plan.appointment = nil
                        save()
                    }
                    .font(.caption)
                }
                if let s = schedule {
                    LabeledContent("List", value: s.listType.label)
                }
            } else {
                Button {
                    plan.appointment = defaultAppointment()
                    save()
                } label: {
                    Label("Set procedure date and time", systemImage: "calendar.badge.plus")
                }
            }
        } header: {
            Text("Procedure")
        } footer: {
            Text("Times are in practice time (\(TimeZone.ect.identifier)).")
        }
    }

    // MARK: Regimen

    private var regimenSection: some View {
        Section {
            Picker("Preparation", selection: Binding(
                get: { selectedID },
                set: { choose($0) })) {
                ForEach(BowelPrepRegimen.available(for: procedure)) { r in
                    Text(r.shortName).tag(r.id)
                }
            }

            if !isConfirmed {
                VStack(alignment: .leading, spacing: 6) {
                    Text(selectedID == BowelPrepRegimen.defaultID(for: procedure)
                         ? "Default preparation — not yet chosen."
                         : "Suggested from the safety checks — not yet chosen.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button {
                        choose(selectedID)
                    } label: {
                        Label("Choose \(regimen.shortName)", systemImage: "checkmark.circle")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(.vertical, 2)
            } else if let at = plan.chosenAt {
                Label("Chosen by the clinician · \(DateFormatter.ectShort.string(from: at))",
                      systemImage: "checkmark.seal.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
            }

            if !isSignedOff { signOffBanner }

            ForEach(Array(regimen.doses.enumerated()), id: \.offset) { _, dose in
                VStack(alignment: .leading, spacing: 3) {
                    Text(dose.label).font(.subheadline.weight(.semibold))
                    Text(dose.volumeText).font(.caption).foregroundStyle(.secondary)
                    Text(dose.instruction).font(.caption)
                    if !dose.followOnFluids.isEmpty {
                        Text(dose.followOnFluids).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 2)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("Extra clear fluids").font(.subheadline.weight(.semibold))
                Text(regimen.additionalClearFluids).font(.caption)
            }

            DisclosureGroup("Products, source and cautions") {
                VStack(alignment: .leading, spacing: 6) {
                    Text(regimen.productExamples.joined(separator: "\n")).font(.caption)
                    Text(regimen.composition).font(.caption).foregroundStyle(.secondary)
                    Text(regimen.sourceNote).font(.caption).foregroundStyle(.secondary)
                    Text(regimen.clinicianNote).font(.caption).foregroundStyle(.secondary)
                }
            }
            .font(.subheadline)
        } header: {
            Text("Bowel prep")
        } footer: {
            Text("The preparation is the clinician's choice. Safety suggestions never change it.")
        }
    }

    private var signOffBanner: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 2) {
                Text("Protocol wording awaiting surgeon sign-off")
                    .font(.subheadline.weight(.semibold))
                Text(regimen.hasPlaceholders
                     ? "Contains [confirm] items that must be resolved before it can be signed off."
                     : "The surgeon approves each protocol in Settings → Bowel Prep Protocols. Sheets are marked DRAFT until then.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    }

    // MARK: Safety suggestions

    private var safetySection: some View {
        Section {
            ForEach(visibleSuggestions) { s in
                suggestionBadge(s, dismissed: false)
            }
            if !dismissedSuggestionList.isEmpty {
                Button(dismissedToggleTitle) {
                    showDismissed.toggle()
                }
                .font(.caption)
                if showDismissed {
                    ForEach(dismissedSuggestionList) { s in
                        suggestionBadge(s, dismissed: true)
                    }
                }
            }
        } header: {
            Text("Safety suggestions")
        } footer: {
            Text("From the record (eGFR, creatinine, magnesium, history, frailty, age). Suggestions only — they never block or change the preparation.")
        }
    }

    private var dismissedToggleTitle: String {
        if showDismissed { return "Hide dismissed suggestions" }
        let n = dismissedSuggestionList.count
        return "Show \(n) dismissed suggestion\(n == 1 ? "" : "s")"
    }

    private func levelColor(_ level: BowelPrepSuggestion.Level) -> Color {
        switch level {
        case .avoid:   return .red
        case .caution: return .orange
        case .plan:    return .blue
        }
    }

    private func suggestionBadge(_ s: BowelPrepSuggestion, dismissed: Bool) -> some View {
        let applies = s.affects.contains(selectedID)
        let tint = levelColor(s.level)
        return HStack(alignment: .top, spacing: 8) {
            Image(systemName: s.level.icon)
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 3) {
                Text(s.title)
                    .font(.subheadline.weight(.semibold))
                Text(s.reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if applies {
                    Text("Applies to the selected preparation")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(tint)
                }
            }
            Spacer(minLength: 0)
            Button {
                toggleDismiss(s)
            } label: {
                Image(systemName: dismissed ? "arrow.uturn.backward.circle" : "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(dismissed ? "Restore suggestion" : "Dismiss suggestion")
        }
        .padding(8)
        .background(tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
        .opacity(dismissed ? 0.6 : 1)
    }

    // MARK: Timing

    private var timingSection: some View {
        Section {
            if regimen.doses.count >= 2 && schedule?.mode != .sameDay {
                DatePicker("First dose (evening before)",
                           selection: minutesBinding(\.eveningDoseMinutes),
                           displayedComponents: .hourAndMinute)
                    .environment(\.timeZone, .ect)
            }
            Stepper(value: Binding(
                get: { plan.options.secondDoseLeadMinutes },
                set: { plan.options.secondDoseLeadMinutes = $0; save() }),
                    in: BowelPrepScheduler.secondDoseLeadRange, step: 30) {
                LabeledContent("Last dose starts", value: "\(leadText) before")
            }
            DatePicker("Clear fluids only from (day before)",
                       selection: minutesBinding(\.clearFluidsFromMinutes),
                       displayedComponents: .hourAndMinute)
                .environment(\.timeZone, .ect)
            if let s = schedule, s.listType == .afternoon, regimen.sameDayAllowed {
                Toggle("Same-day preparation (afternoon list)", isOn: Binding(
                    get: { plan.options.afternoonSameDay },
                    set: { plan.options.afternoonSameDay = $0; save() }))
            }
        } header: {
            Text("Timing (split dose, ESGE 2019)")
        } footer: {
            Text("Low-residue diet the day before, then clear fluids only. The last dose starts 4–6 hours before the procedure and everything by mouth finishes at least 2 hours before. Nobody is nil by mouth from midnight.")
        }
    }

    private var leadText: String {
        let m = plan.options.secondDoseLeadMinutes
        return m % 60 == 0 ? "\(m / 60) h" : "\(m / 60) h \(m % 60) min"
    }

    private func minutesBinding(_ key: WritableKeyPath<BowelPrepScheduleOptions, Int>) -> Binding<Date> {
        Binding(
            get: {
                let m = plan.options[keyPath: key]
                return Calendar.ect.date(bySettingHour: m / 60, minute: m % 60, second: 0, of: Date.now) ?? Date.now
            },
            set: { newValue in
                let c = Calendar.ect.dateComponents([.hour, .minute], from: newValue)
                plan.options[keyPath: key] = (c.hour ?? 0) * 60 + (c.minute ?? 0)
                save()
            })
    }

    // MARK: Timetable

    private var scheduleSection: some View {
        Section {
            if let s = schedule {
                ForEach(s.steps) { step in
                    stepRow(step)
                }
                ForEach(s.warnings, id: \.self) { w in
                    Label(w, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            } else {
                Text("Set the procedure date and time to calculate the timetable.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text("Timetable")
        } footer: {
            if let s = schedule {
                Text("Everything by mouth finishes by \(BowelPrepFormat.shortDayTime(s.lastIntakeBy, .ect)) — 2 hours before the procedure.")
            }
        }
    }

    private func stepRow(_ step: BowelPrepStep) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(BowelPrepFormat.when(step, .ect))
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(step.kind == .stopIntake ? Color.red : AMColor.accent)
                .frame(width: 118, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(step.title)
                    .font(.subheadline.weight(.semibold))
                Text(step.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    // MARK: Share / print

    private var shareSection: some View {
        Section {
            Button {
                share(.pdf)
            } label: {
                Label("Share prep instructions (PDF)", systemImage: "square.and.arrow.up")
            }
            Button {
                share(.text)
            } label: {
                Label("Share as text", systemImage: "text.bubble")
            }
            Button {
                share(.print)
            } label: {
                Label("Print", systemImage: "printer")
            }
        } header: {
            Text("Patient instructions")
        } footer: {
            Text(shareFooter)
        }
        .disabled(schedule == nil || !isConfirmed)
    }

    private var shareFooter: String {
        var parts: [String] = []
        if !isConfirmed { parts.append("Choose the preparation first.") }
        if appointment == nil { parts.append("Set the procedure date and time first.") }
        if !isSignedOff { parts.append("The sheet is marked DRAFT until the surgeon signs off this protocol.") }
        parts.append("Nothing is sent automatically. Each share or print is recorded in the audit log.")
        if let last = plan.lastSharedAt {
            parts.append("Last shared \(DateFormatter.ectShort.string(from: last)).")
        }
        return parts.joined(separator: " ")
    }

    private func share(_ format: ShareFormat) {
        guard let s = schedule, isConfirmed else { return }
        let sheet = BowelPrepPatientSheet.build(patientName: patient.fullName, procedure: procedure,
                                                regimen: regimen, schedule: s,
                                                practice: PracticeProfile.current, signedOff: isSignedOff)
        AuditLog.record("export", "document", patient: patient,
                        details: ["kind": "bowel_prep_instructions",
                                  "format": format.rawValue,
                                  "regimen": regimen.id.rawValue,
                                  "signed_off": isSignedOff ? "yes" : "no"])
        plan.lastSharedAt = .now
        save()
        switch format {
        case .pdf:
            shareItem = BowelPrepShareItem(items: [ProcedureFormPDF.bowelPrepInstructions(patient: patient, sheet: sheet)])
        case .text:
            shareItem = BowelPrepShareItem(items: [sheet.plainText])
        case .print:
            printPDF(ProcedureFormPDF.bowelPrepInstructions(patient: patient, sheet: sheet))
        }
    }

    private func printPDF(_ data: Data) {
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = "Bowel preparation instructions"
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printingItem = data
        controller.present(animated: true, completionHandler: nil)
    }

    // MARK: Persistence

    private func load() {
        plan = patient.pathwayData.bowelPrep
        facts = BowelPrepPatientFacts(patient: patient)
        signOffs = BowelPrepSignOff.load()
    }

    private func save() {
        var all = patient.pathwayData
        all.bowelPrep = plan
        patient.pathwayData = all
        patient.pendingSync = true
        try? context.save()
    }

    private func choose(_ id: BowelPrepRegimenID) {
        plan.regimenID = id.rawValue
        plan.chosenAt = .now
        save()
    }

    private func toggleDismiss(_ s: BowelPrepSuggestion) {
        if let i = plan.dismissedSuggestions.firstIndex(of: s.id) {
            plan.dismissedSuggestions.remove(at: i)
        } else {
            plan.dismissedSuggestions.append(s.id)
        }
        save()
    }

    private func defaultAppointment() -> Date {
        let cal = Calendar.ect
        let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: .now)) ?? .now
        return cal.date(bySettingHour: 8, minute: 0, second: 0, of: tomorrow) ?? tomorrow
    }
}

// MARK: - Settings: surgeon sign-off of protocol wording

struct BowelPrepSignOffView: View {
    let canApprove: Bool
    let approverName: String
    @State private var records: [String: BowelPrepSignOffRecord] = [:]

    var body: some View {
        List {
            Section {
                Text("Each protocol's dose and timing wording must be approved by the surgeon before patient sheets are issued without the DRAFT mark. Approval is stored on this device and lapses automatically if the wording changes in a later app version.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !canApprove {
                    Label("Only a doctor account can approve protocol wording.", systemImage: "lock")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
            Section("Protocols") {
                ForEach(BowelPrepRegimen.all) { r in
                    NavigationLink {
                        BowelPrepProtocolDetailView(regimen: r, canApprove: canApprove,
                                                    approverName: approverName, records: $records)
                    } label: {
                        row(r)
                    }
                }
            }
        }
        .navigationTitle("Bowel Prep Protocols")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { records = BowelPrepSignOff.load() }
    }

    private func row(_ r: BowelPrepRegimen) -> some View {
        let signed = BowelPrepSignOff.isSignedOff(r, records: records)
        return VStack(alignment: .leading, spacing: 2) {
            Text(r.shortName).font(.subheadline.weight(.semibold))
            if signed, let rec = records[r.id.rawValue] {
                Text("Signed off by \(rec.signedBy) · \(DateFormatter.ectShort.string(from: rec.signedAt))")
                    .font(.caption)
                    .foregroundStyle(.green)
            } else if r.hasPlaceholders {
                Text("Contains [confirm] items — cannot be signed off yet")
                    .font(.caption)
                    .foregroundStyle(.orange)
            } else {
                Text("Protocol wording awaiting surgeon sign-off")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
    }
}

struct BowelPrepProtocolDetailView: View {
    let regimen: BowelPrepRegimen
    let canApprove: Bool
    let approverName: String
    @Binding var records: [String: BowelPrepSignOffRecord]
    @State private var confirmApprove = false

    private var isSignedOff: Bool { BowelPrepSignOff.isSignedOff(regimen, records: records) }

    var body: some View {
        List {
            Section("Preparation") {
                Text(regimen.displayName).font(.subheadline.weight(.semibold))
                Text(regimen.productExamples.joined(separator: "\n")).font(.caption)
                Text(regimen.composition).font(.caption).foregroundStyle(.secondary)
            }
            Section("Doses (patient wording)") {
                ForEach(Array(regimen.doses.enumerated()), id: \.offset) { _, dose in
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(dose.label) — \(dose.volumeText)").font(.subheadline.weight(.semibold))
                        Text(dose.instruction).font(.caption)
                        if !dose.followOnFluids.isEmpty {
                            Text(dose.followOnFluids).font(.caption)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text("Extra clear fluids").font(.subheadline.weight(.semibold))
                    Text(regimen.additionalClearFluids).font(.caption)
                }
                if regimen.category == .enema {
                    Text(BowelPrepText.enemaDayDiet).font(.caption)
                }
            }
            Section("Shared sheet wording") {
                ForEach(BowelPrepText.sharedPatientText, id: \.self) { t in
                    Text(t).font(.caption)
                }
            }
            Section("Source") {
                Text(regimen.sourceNote).font(.caption)
                Text(regimen.clinicianNote).font(.caption).foregroundStyle(.secondary)
            }
            Section {
                if isSignedOff, let rec = records[regimen.id.rawValue] {
                    Label("Signed off by \(rec.signedBy) · \(DateFormatter.ectShort.string(from: rec.signedAt))",
                          systemImage: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                    Button("Withdraw approval", role: .destructive) {
                        BowelPrepSignOff.withdraw(regimen.id)
                        records = BowelPrepSignOff.load()
                        AuditLog.record("update", "document",
                                        details: ["kind": "bowel_prep_protocol",
                                                  "regimen": regimen.id.rawValue,
                                                  "sign_off": "withdrawn"])
                    }
                    .disabled(!canApprove)
                } else {
                    Label("Protocol wording awaiting surgeon sign-off", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                    Button("Approve this wording") { confirmApprove = true }
                        .disabled(!canApprove || regimen.hasPlaceholders)
                    if regimen.hasPlaceholders {
                        Text("Resolve every [confirm] item in the patient wording first.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("Surgeon sign-off")
            }
        }
        .navigationTitle(regimen.shortName)
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Approve this wording?", isPresented: $confirmApprove, titleVisibility: .visible) {
            Button("Approve") {
                if BowelPrepSignOff.approve(regimen, by: approverName) {
                    records = BowelPrepSignOff.load()
                    AuditLog.record("sign", "document",
                                    details: ["kind": "bowel_prep_protocol",
                                              "regimen": regimen.id.rawValue,
                                              "sign_off": "approved"])
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You confirm you have checked the doses, volumes and timings against the product labelling (SmPC) and ESGE 2019, and that patients may be given this wording.")
        }
    }
}
