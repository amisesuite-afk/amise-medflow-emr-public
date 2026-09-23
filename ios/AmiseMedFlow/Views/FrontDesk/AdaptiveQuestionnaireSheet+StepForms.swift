// AdaptiveQuestionnaireSheet+StepForms.swift
// Step progress strip and step-specific @ViewBuilder question forms.

import SwiftUI
import SwiftData

extension AdaptiveQuestionnaireSheet {

    // MARK: Step progress strip

    var stepProgressStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(Array(phases.enumerated()), id: \.offset) { idx, phase in
                    let done    = idx < safeIndex
                    let current = idx == safeIndex
                    HStack(spacing: 0) {
                        VStack(spacing: 3) {
                            ZStack {
                                Circle()
                                    .fill(done ? AMColor.accent : (current ? AMColor.accent.opacity(0.15) : Color.secondary.opacity(0.1)))
                                    .frame(width: 28, height: 28)
                                if done {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(.white)
                                } else {
                                    Image(systemName: phase.icon)
                                        .font(.system(size: 11, weight: current ? .semibold : .regular))
                                        .foregroundStyle(current ? AMColor.accent : .secondary)
                                }
                            }
                            Text(phase.title)
                                .font(.system(size: 8, weight: current ? .bold : .regular))
                                .foregroundStyle(current ? AMColor.accent : (done ? .teal.opacity(0.6) : .secondary))
                                .lineLimit(1)
                        }
                        .frame(minWidth: 64)
                        if idx < phases.count - 1 {
                            Rectangle()
                                .fill(done ? AMColor.accent.opacity(0.5) : Color.secondary.opacity(0.2))
                                .frame(width: 20, height: 1.5)
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        }
        .background(Color(.secondarySystemBackground))
    }

    // ── Phase guidance banner ─────────────────────────────────────────────────
    // Shown at the top of every phase to guide patients through each step.

    @ViewBuilder
    var phaseGuidanceBanner: some View {
        let info: (icon: String, headline: String, detail: String) = {
            switch currentPhase {
            case .cc:
                return ("1.circle.fill",
                        "What brings you in today?",
                        "Choose the option that best describes your main reason for this visit. If your complaint isn't listed, select \"Other\" and describe it in the text box below.")
            case .socrates:
                return ("waveform.path.ecg",
                        "Tell us about your pain",
                        "Answer as many questions as you can. Tap a choice to select it. Use the slider at the bottom to rate your pain from 0 (no pain) to 10 (worst imaginable).")
            case .symptoms:
                return ("checklist",
                        "Other symptoms you have noticed",
                        "Tap any that apply — even if they seem unrelated to your main problem. Use the search box to find something not listed, or type your own and tap \"Add\".")
            case .redFlags:
                return ("exclamationmark.triangle.fill",
                        "Important warning signs",
                        "Please answer honestly. These questions help us spot symptoms that may need urgent attention. Turn on the toggle next to any that apply to you.")
            case .pmhx:
                return ("cross.case",
                        "Your past health history",
                        "Tick any conditions you have been diagnosed with. For medications, type the names below — or photograph your prescription / medication bag using the camera button.")
            case .social:
                return ("person.2",
                        "Lifestyle & last meal",
                        "These details help us plan your care safely. The \"Last meal\" question is especially important if you may need a procedure or anaesthesia today.")
            }
        }()

        Section {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: info.icon)
                    .font(.system(size: 22))
                    .foregroundStyle(AMColor.accent)
                    .frame(width: 30)
                VStack(alignment: .leading, spacing: 4) {
                    Text(info.headline)
                        .font(.system(size: 14, weight: .semibold))
                    Text(info.detail)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(AMColor.accent.opacity(0.07))
    }

    // ── Phase 0: patient header ───────────────────────────────────────────────

    @ViewBuilder
    func patientHeaderSection(_ patient: Patient) -> some View {
        Section {
            HStack(spacing: 8) {
                AcuityPip(acuity: patient.acuity)
                VStack(alignment: .leading, spacing: 2) {
                    Text(patient.fullName).font(.subheadline.weight(.semibold))
                    HStack(spacing: 6) {
                        if let mrn = patient.mrn, !mrn.isEmpty {
                            Text("MRN \(mrn)")
                                .font(.caption2).foregroundStyle(AMColor.accent)
                        }
                        Text(patient.ageDisplay ?? "").font(.caption2).foregroundStyle(.secondary)
                        Text(patient.sex.rawValue).font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
        } header: {
            Label("Patient", systemImage: "person.crop.circle")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }
    }

    // ── Phase 1: Chief complaint ──────────────────────────────────────────────

    @ViewBuilder
    var phase1CCSection: some View {
        Section {
            // Structured CC picker — maps directly to Bayesian routing
            Picker("Chief complaint", selection: $answers.ccCategory) {
                Text("Select…").tag(Optional<CCCategory>.none)
                ForEach(visibleCCCategories, id: \.self) { cc in
                    Text(cc.rawValue).tag(Optional(cc))
                }
            }
            .pickerStyle(.menu)
            .onChange(of: answers.ccCategory) { _, _ in
                // Reset CC-dependent answers when category changes
                answers.associatedSymptoms = []
                answers.painSite = ""
                answers.painCharacter = nil
                answers.painOnset = nil
                answers.painTiming = nil
                answers.painWorsenedBy = []
                answers.painRelievedBy = []
                answers.painRadiates = false
                answers.painRadiationSite = ""
            }

            let placeholder = answers.ccCategory == .other
                ? "Describe the complaint…"
                : "Additional detail (optional)"
            TextField(placeholder, text: $answers.ccClarification, axis: .vertical)
                .lineLimit(2...)
        } header: {
            Label("Chief Complaint", systemImage: "1.circle.fill")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        } footer: {
            if answers.ccCategory == nil {
                Text("Select the primary reason for today's visit. All subsequent questions adapt to this selection.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    // Demographic gating for CC picker
    var visibleCCCategories: [CCCategory] {
        CCCategory.allCases.filter { cc in
            if cc == .breastSymptom && patientSex == .male { return false }
            return true
        }
    }

    // ── Phase 2: SOCRATES (pain CCs only) ────────────────────────────────────

    @ViewBuilder
    func phase2SocratesSection(cc: CCCategory) -> some View {
        Section {
            TextField("Location (e.g. right lower abdomen, central, diffuse)",
                      text: $answers.painSite, axis: .vertical)
                .lineLimit(1...)

            Picker("Onset speed", selection: $answers.painOnset) {
                Text("Select…").tag(Optional<PainOnset>.none)
                ForEach(PainOnset.allCases, id: \.self) { o in Text(o.rawValue).tag(Optional(o)) }
            }

            if answers.painOnset != nil {
                HStack {
                    Text("Hours since onset")
                    Spacer()
                    TextField("e.g. 6", value: $answers.painOnsetHoursAgo, format: .number)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
            }

            Picker("Character", selection: $answers.painCharacter) {
                Text("Select…").tag(Optional<PainCharacter>.none)
                ForEach(PainCharacter.allCases, id: \.self) { c in Text(c.rawValue).tag(Optional(c)) }
            }
        } header: {
            Label("Pain — Site & Onset", systemImage: "2.circle.fill")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }

        Section {
            Toggle("Does the pain spread to another area?", isOn: $answers.painRadiates)
            if answers.painRadiates {
                TextField("Where does it spread to?", text: $answers.painRadiationSite)
            }

            Picker("Timing pattern", selection: $answers.painTiming) {
                Text("Select…").tag(Optional<PainTiming>.none)
                ForEach(PainTiming.allCases, id: \.self) { t in Text(t.rawValue).tag(Optional(t)) }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Severity: \(answers.severityAnswered ? "\(answers.painSeverity)/10" : "not yet set")")
                    .font(.subheadline)
                Slider(value: Binding(
                    get: { Double(answers.painSeverity) },
                    set: { answers.painSeverity = Int($0); answers.severityAnswered = true }
                ), in: 0...10, step: 1)
                .tint(answers.painSeverity >= 8 ? .red : answers.painSeverity >= 5 ? .orange : .green)
            }
        } header: {
            Label("Pain — Radiation, Timing & Severity", systemImage: "3.circle.fill")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }

        Section {
            QCheckboxGrid(label: "Makes it WORSE", options: cc.worsening, selection: $answers.painWorsenedBy)
            QCheckboxGrid(label: "Makes it BETTER", options: cc.relieving, selection: $answers.painRelievedBy)
        } header: {
            Label("Exacerbating & Relieving Factors", systemImage: "arrow.up.arrow.down")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }
    }

    // ── Phase 3: Associated symptoms (CC-specific list, with type-to-search) ───

    @ViewBuilder
    var phase3AssociatedSection: some View {
        if let cc = answers.ccCategory {
            Section {
                // Type-to-filter (matches web version's symptom entry)
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                        .font(.system(size: 14))
                    TextField("Type to search or add a symptom…", text: $symptomFilter)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.words)
                }

                let q = symptomFilter.trimmingCharacters(in: .whitespaces)
                let filtered = q.isEmpty
                    ? cc.associatedSymptoms
                    : cc.associatedSymptoms.filter { $0.lowercased().contains(q.lowercased()) }

                if !filtered.isEmpty {
                    QCheckboxGrid(label: nil, options: filtered, selection: $answers.associatedSymptoms)
                }

                // Show already-selected custom symptoms not in the filtered list
                let custom = answers.associatedSymptoms.filter { !cc.associatedSymptoms.contains($0) }
                if !custom.isEmpty {
                    QCheckboxGrid(label: "Added", options: custom.sorted(), selection: $answers.associatedSymptoms)
                }

                // "Add custom" when query doesn't match any preset
                if !q.isEmpty && !cc.associatedSymptoms.contains(where: { $0.lowercased() == q.lowercased() }) {
                    Button {
                        answers.associatedSymptoms.insert(q)
                        symptomFilter = ""
                    } label: {
                        Label("Add \"\(q)\"", systemImage: "plus.circle.fill")
                            .foregroundStyle(AMColor.accent)
                    }
                    .buttonStyle(.plain)
                }

                if !answers.associatedSymptoms.isEmpty {
                    Text("Selected: \(answers.associatedSymptoms.sorted().joined(separator: " · "))")
                        .font(.caption2)
                        .foregroundStyle(AMColor.accent)
                }

            } header: {
                Label("Associated Symptoms", systemImage: "list.bullet")
                    .textCase(nil).font(.system(size: 11, weight: .semibold))
            } footer: {
                Text("Search or tap to select. Showing symptoms relevant to \(cc.rawValue.lowercased()).")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    // ── Phase 4: Red flags (demographic-gated) ────────────────────────────────

    @ViewBuilder
    var phase4RedFlagsSection: some View {
        Section {
            Toggle("Unexplained weight loss", isOn: $answers.unexplainedWeightLoss)
            Toggle("Night sweats", isOn: $answers.nightSweats)
            Toggle("Change in a mole or skin lesion", isOn: $answers.changeInMole)
            if patientAge >= 18 {
                Toggle("Coughing up blood (haemoptysis)", isOn: $answers.haemoptysis)
            }
            if patientAge >= 25 {
                Toggle("Blood in urine (haematuria)", isOn: $answers.haematuria)
            }
            if patientSex == .female {
                Toggle("Recent breast change (lump, skin, discharge)", isOn: $answers.breastChange)
            }
        } header: {
            Label("Red Flag Symptoms", systemImage: "exclamationmark.triangle.fill")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.orange)
        } footer: {
            Text("Report any that apply, even if not the main reason for today's visit.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    // ── Phase 5: Past medical history ─────────────────────────────────────────

    @ViewBuilder
    var phase5PMHxSection: some View {
        Section {
            QCheckboxGrid(label: nil,
                          options: PMHxCondition.allCases.map(\.rawValue),
                          rawSelection: Binding(
                            get: { Set(answers.pmhxConditions.map(\.rawValue)) },
                            set: { raws in
                                answers.pmhxConditions = Set(
                                    PMHxCondition.allCases.filter { raws.contains($0.rawValue) }
                                )
                            }
                          ))
            VStack(alignment: .leading, spacing: 8) {
                TextField("Current medications (name and dose)", text: $answers.medications, axis: .vertical)
                    .lineLimit(2...)
                HStack(spacing: 12) {
                    PhotosPicker(
                        selection: $prescriptionPhotoItem,
                        matching: .images,
                        photoLibrary: .shared()
                    ) {
                        Label("Photo of prescription / medication bag",
                              systemImage: "camera.badge.plus")
                            .font(.system(size: 12))
                            .foregroundStyle(AMColor.accent)
                    }
                    .onChange(of: prescriptionPhotoItem) { _, newItem in
                        Task {
                            if let data = try? await newItem?.loadTransferable(type: Data.self) {
                                prescriptionImageData = data
                            }
                        }
                    }
                    if prescriptionImageData != nil {
                        Label("Photo captured", systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                }
            }
            TextField("Known allergies (drug, food, latex, other)", text: $answers.allergies, axis: .vertical)
                .lineLimit(2...)
            TextField("Previous operations / procedures", text: $answers.surgicalHistory, axis: .vertical)
                .lineLimit(2...)
        } header: {
            Label("Past Medical History", systemImage: "cross.case")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }
    }

    // ── Phase 6: Social history & last meal ───────────────────────────────────

    @ViewBuilder
    var phase6SocialSection: some View {
        Section {
            Picker("Smoking status", selection: $answers.smokingStatus) {
                ForEach(SmokingStatus.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Picker("Alcohol use", selection: $answers.alcoholUse) {
                ForEach(AlcoholUse.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            TextField("Occupation (optional)", text: $answers.occupation)
        } header: {
            Label("Social History", systemImage: "person.2")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        }

        Section {
            Toggle("Record last meal time", isOn: Binding(
                get: { answers.lastMealTime != nil },
                set: { answers.lastMealTime = $0 ? .now : nil }
            ))
            if let _ = answers.lastMealTime {
                DatePicker("Last meal",
                           selection: Binding(
                            get: { answers.lastMealTime ?? .now },
                            set: { answers.lastMealTime = $0 }
                           ),
                           displayedComponents: [.date, .hourAndMinute])
            }
        } header: {
            Label("Last Meal", systemImage: "fork.knife")
                .textCase(nil).font(.system(size: 11, weight: .semibold))
        } footer: {
            Text("Required if the patient may need surgery or anaesthesia today.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    // ── Save: single write to canonical Patient fields ────────────────────────
    // This is the ONLY place questionnaire data is written to the patient model.
    // Enforces the single-value-per-variable rule: no other path writes
    // chiefComplaint / hpi / pmhNotes during an encounter session.

    func save() {
        guard let patient else {
            // Walk-in without a registered patient: questionnaire data cannot be
            // persisted without a patient record. Dismiss — front desk should
            // register the patient first, then open the questionnaire from their record.
            dismiss()
            return
        }

        // Structured fields — direct write, no concatenation ambiguity.
        // These are the canonical values for chiefComplaint / hpi / pmhNotes.
        patient.chiefComplaint = answers.chiefComplaintText.isEmpty ? nil : answers.chiefComplaintText
        patient.hpi            = answers.hpiText.isEmpty ? nil : answers.hpiText
        patient.pmhNotes       = answers.pmhxText.isEmpty ? nil : answers.pmhxText

        // P6: surgical history, allergies, and medications from questionnaire.
        // Only write when the questionnaire captured data — never overwrite with blank.
        if !answers.surgicalHistory.isEmpty {
            patient.surgicalHistory = answers.surgicalHistory
        }
        if !answers.allergies.isEmpty {
            // Append questionnaire allergy text as a single AllergyEntry (severity unknown
            // at this stage — front desk captures name only, severity confirmed by clinician).
            let existing = patient.allergies
            let names = answers.allergies
                .components(separatedBy: CharacterSet(charactersIn: ",;"))
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            let existingNames = Set(existing.map { $0.name.lowercased() })
            let newEntries = names.compactMap { name -> AllergyEntry? in
                guard !existingNames.contains(name.lowercased()) else { return nil }
                return AllergyEntry(name: name, severity: "Unknown", reaction: "Not specified")
            }
            if !newEntries.isEmpty {
                patient.allergies = existing + newEntries
            }
        }
        if !answers.medications.isEmpty {
            // Append to pmhNotes as a MEDICATIONS: line so the pipeline can read it.
            let medLine = "MEDICATIONS: \(answers.medications)"
            if let existing = patient.pmhNotes, !existing.contains("MEDICATIONS:") {
                patient.pmhNotes = existing + "\n" + medLine
            } else if patient.pmhNotes == nil {
                patient.pmhNotes = medLine
            }
        }

        // Prescription photo — stored as PatientDocument for later clinical review.
        // AI extraction deferred per HIPAA compliance gate; document is flagged "Other"
        // and the medications free-text field notes a photo is attached.
        if let imageData = prescriptionImageData {
            let doc = PatientDocument(
                fileName: "rx-photo-\(Int(Date.now.timeIntervalSince1970)).jpg",
                mimeType: "image/jpeg",
                category: "Other"
            )
            doc.localData = imageData
            doc.patient = patient
            context.insert(doc)
            let photoNote = "[Prescription photo captured — awaiting clinical review]"
            if !answers.medications.isEmpty {
                answers.medications += "\n" + photoNote
            } else {
                answers.medications = photoNote
            }
        }

        // Human-readable pre-visit note for the doctor
        let note = ClinicalNote(noteType: .other, patient: patient)
        note.freeText = buildReadableNote()
        context.insert(note)

        patient.updatedAt   = .now
        patient.pendingSync = true
        try? context.save()
        Task { await sync.syncIfAuthenticated() }
        dismiss()
    }

    func buildReadableNote() -> String {
        var lines = ["PRE-VISIT QUESTIONNAIRE — \(DateFormatter.ectDateTime.string(from: .now)) ECT"]
        lines.append("")
        lines.append("CHIEF COMPLAINT: \(answers.chiefComplaintText)")
        if !answers.hpiText.isEmpty {
            lines.append("")
            lines.append(answers.hpiText)
        }
        if !answers.pmhxText.isEmpty {
            lines.append("")
            lines.append("PAST HISTORY & SOCIAL")
            lines.append(answers.pmhxText)
        }
        if let t = answers.lastMealTime {
            lines.append("LAST MEAL: \(DateFormatter.ectDateTime.string(from: t)) ECT")
        }
        return lines.joined(separator: "\n")
    }

}
