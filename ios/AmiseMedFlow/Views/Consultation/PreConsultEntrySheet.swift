import SwiftUI
import SwiftData

// MARK: - Sheet for recording patient's completed pre-consult answers
//
// The doctor/nurse taps "Enter Patient Answers" after reviewing the paper form.
// Fields are merged — never overwrite existing data unless a section is empty.

struct PreConsultEntrySheet: View {
    let patient: Patient
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    // CC
    @State private var selectedCC: String = ""
    @State private var customCC: String = ""
    @State private var duration: String = ""
    @State private var severity: Int = 0

    // Associated symptoms
    @State private var selectedAssoc: Set<String> = []

    // PMH
    @State private var selectedPMH: Set<String> = []
    @State private var customPMH: String = ""

    // PSHx
    @State private var selectedPSHx: Set<String> = []
    @State private var customPSHx: String = ""

    // Medications
    @State private var medications: [MedRow] = [MedRow()]

    // Allergies
    @State private var noKnownAllergies = false
    @State private var allergyRows: [AllergyRow] = [AllergyRow()]

    // Family history
    @State private var selectedFHx: Set<String> = []

    // Social history
    @State private var smokingStatus: String = ""
    @State private var alcoholStatus: String = ""
    @State private var occupation: String = ""

    // Derived CC for assoc chip list
    private var ccForChips: String { selectedCC.isEmpty ? customCC : selectedCC }

    private var assocChips: [String] {
        let lc = ccForChips.lowercased()
        if lc.contains("neck") || lc.contains("thyroid")       { return SOCRATESChips.assocNeck }
        if lc.contains("breast")                               { return SOCRATESChips.assocBreast }
        if lc.contains("chest") || lc.contains("cardiac") ||
           lc.contains("palpitat")                             { return SOCRATESChips.assocChest }
        if lc.contains("rectal") || lc.contains("anal") ||
           lc.contains("haemorrhoid") || lc.contains("bowel")  { return SOCRATESChips.assocAnorectal }
        if lc.contains("dysphagia") || lc.contains("swallow") ||
           lc.contains("reflux") || lc.contains("heartburn")   { return SOCRATESChips.assocDysphagia }
        if lc.contains("urin") || lc.contains("haematuria")    { return SOCRATESChips.assocUrology }
        if lc.contains("skin") || lc.contains("lesion") ||
           lc.contains("mole") || lc.contains("melanoma")      { return SOCRATESChips.assocSkin }
        return SOCRATESChips.assocAbdominal
    }

    var body: some View {
        NavigationStack {
            Form {
                ccSection
                assocSection
                pmhSection
                pshxSection
                medicationsSection
                allergiesSection
                fhxSection
                socialSection
            }
            .navigationTitle("Patient's Answers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        applyAnswers()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }

    // MARK: - Sections

    private var ccSection: some View {
        Section {
            // Tap-to-select chip list
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(ccSurgicalChips) { chip in
                        let selected = selectedCC == chip.label
                        Button {
                            selectedCC = selected ? "" : chip.label
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: chip.icon).font(.system(size: 10))
                                Text(chip.label).font(.system(size: 12, weight: selected ? .semibold : .regular))
                            }
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(selected ? AMColor.accent : AMColor.accentLt, in: Capsule())
                            .foregroundStyle(selected ? Color.white : AMColor.accent)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            }

            TextField("Or describe in their own words…",
                      text: $customCC, axis: .vertical)
                .font(.callout)
                .lineLimit(2...)

            HStack {
                Text("Duration").font(.callout).foregroundStyle(.secondary)
                Spacer()
                TextField("e.g. 3 weeks", text: $duration)
                    .multilineTextAlignment(.trailing)
                    .font(.callout)
            }

            // Severity picker
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Severity").font(.callout).foregroundStyle(.secondary)
                    Spacer()
                    Text(severity == 0 ? "Not specified" : "\(severity)/10")
                        .font(.callout.monospacedDigit())
                        .foregroundStyle(severityColor(severity))
                }
                Slider(value: Binding(get: { Double(severity) }, set: { severity = Int($0) }),
                       in: 0...10, step: 1)
                    .tint(severityColor(severity))
            }
        } header: {
            Label("Reason for Visit", systemImage: "person.fill.questionmark")
        }
    }

    private var assocSection: some View {
        Section {
            if ccForChips.isEmpty {
                Text("Enter a chief complaint above to see associated symptoms")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            } else {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(assocChips, id: \.self) { chip in
                        let on = selectedAssoc.contains(chip)
                        Button { toggle(&selectedAssoc, chip) } label: {
                            Text(chip)
                                .font(.system(size: 12, weight: on ? .semibold : .regular))
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(on ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(on ? Color.white : AMColor.accent)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            }
        } header: {
            Label("Associated Symptoms", systemImage: "list.bullet.clipboard")
        }
    }

    private var pmhSection: some View {
        Section {
            ChipFlow(hSpacing: 8, vSpacing: 8) {
                ForEach(pmhChips, id: \.self) { chip in
                    let on = selectedPMH.contains(chip)
                    Button { toggle(&selectedPMH, chip) } label: {
                        Text(chip)
                            .font(.system(size: 12, weight: on ? .semibold : .regular))
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(on ? Color.blue.opacity(0.8) : Color.blue.opacity(0.08), in: Capsule())
                            .foregroundStyle(on ? Color.white : Color.blue)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)

            TextField("Other conditions (comma-separated)",
                      text: $customPMH, axis: .vertical)
                .font(.callout)
                .lineLimit(2...)
        } header: {
            Label("Past Medical History", systemImage: "heart.text.square")
        }
    }

    private var pshxSection: some View {
        Section {
            ChipFlow(hSpacing: 8, vSpacing: 8) {
                ForEach(pshxChips, id: \.self) { chip in
                    let on = selectedPSHx.contains(chip)
                    Button { toggle(&selectedPSHx, chip) } label: {
                        Text(chip)
                            .font(.system(size: 12, weight: on ? .semibold : .regular))
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(on ? Color(hex: "7C3AED").opacity(0.85) : Color(hex: "7C3AED").opacity(0.08), in: Capsule())
                            .foregroundStyle(on ? Color.white : Color(hex: "7C3AED"))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)

            TextField("Other procedures (comma-separated)",
                      text: $customPSHx, axis: .vertical)
                .font(.callout)
                .lineLimit(2...)
        } header: {
            Label("Past Surgical History", systemImage: "scissors")
        }
    }

    private var medicationsSection: some View {
        Section {
            ForEach($medications) { $med in
                HStack(spacing: 8) {
                    TextField("Medication", text: $med.drug)
                        .font(.callout)
                        .frame(maxWidth: .infinity)
                    TextField("Dose", text: $med.dose)
                        .font(.callout)
                        .frame(maxWidth: 80)
                    TextField("Freq", text: $med.freq)
                        .font(.callout)
                        .frame(maxWidth: 70)
                }
            }
            .onDelete { medications.remove(atOffsets: $0) }

            Button {
                medications.append(MedRow())
            } label: {
                Label("Add medication", systemImage: "plus.circle")
                    .font(.callout)
            }
        } header: {
            Label("Current Medications", systemImage: "pills.fill")
        }
    }

    private var allergiesSection: some View {
        Section {
            Toggle("No known allergies (NKDA)", isOn: $noKnownAllergies)
                .font(.callout)
                .onChange(of: noKnownAllergies) { _, nkda in
                    if nkda { allergyRows = [] }
                    else if allergyRows.isEmpty { allergyRows = [AllergyRow()] }
                }

            if !noKnownAllergies {
                ForEach($allergyRows) { $row in
                    HStack(spacing: 8) {
                        TextField("Substance", text: $row.name)
                            .font(.callout)
                            .frame(maxWidth: .infinity)
                        TextField("Reaction", text: $row.reaction)
                            .font(.callout)
                            .frame(maxWidth: 100)
                        Picker("", selection: $row.severity) {
                            ForEach(["Mild", "Moderate", "Severe", "Anaphylaxis"], id: \.self) {
                                Text($0).tag($0)
                            }
                        }
                        .labelsHidden()
                        .frame(maxWidth: 90)
                    }
                }
                .onDelete { allergyRows.remove(atOffsets: $0) }

                Button {
                    allergyRows.append(AllergyRow())
                } label: {
                    Label("Add allergy", systemImage: "plus.circle")
                        .font(.callout)
                }
            }
        } header: {
            Label("Allergies", systemImage: "exclamationmark.triangle.fill")
        }
    }

    private var fhxSection: some View {
        Section {
            ChipFlow(hSpacing: 8, vSpacing: 8) {
                ForEach(familyHistoryChips, id: \.self) { chip in
                    let on = selectedFHx.contains(chip)
                    Button { toggle(&selectedFHx, chip) } label: {
                        Text(chip)
                            .font(.system(size: 12, weight: on ? .semibold : .regular))
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(on ? Color.indigo.opacity(0.85) : Color.indigo.opacity(0.08), in: Capsule())
                            .foregroundStyle(on ? Color.white : Color.indigo)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
        } header: {
            Label("Family History", systemImage: "person.3.fill")
        }
    }

    private var socialSection: some View {
        Section {
            Picker("Smoking", selection: $smokingStatus) {
                Text("Not recorded").tag("")
                ForEach(["Never", "Ex-smoker", "Current smoker"], id: \.self) { Text($0).tag($0) }
            }
            Picker("Alcohol", selection: $alcoholStatus) {
                Text("Not recorded").tag("")
                ForEach(["None", "Occasional", "Moderate", "Heavy"], id: \.self) { Text($0).tag($0) }
            }
            HStack {
                Text("Occupation").foregroundStyle(.secondary)
                Spacer()
                TextField("Optional", text: $occupation)
                    .multilineTextAlignment(.trailing)
            }
        } header: {
            Label("Social History", systemImage: "person.crop.circle.badge.checkmark")
        }
    }

    // MARK: - Apply logic

    private func applyAnswers() {
        let cc = !selectedCC.isEmpty ? selectedCC
               : (!customCC.trimmingCharacters(in: .whitespaces).isEmpty ? customCC.trimmingCharacters(in: .whitespaces) : nil)

        // CC — only set if currently empty
        if let cc, (patient.chiefComplaint ?? "").isEmpty {
            patient.chiefComplaint = cc
        }

        // Duration — prepend to HPI if HPI is empty
        if !duration.trimmingCharacters(in: .whitespaces).isEmpty,
           (patient.hpi ?? "").isEmpty {
            patient.hpi = "Duration: \(duration.trimmingCharacters(in: .whitespaces))."
        }

        // Associated symptoms — merge with existing
        if !selectedAssoc.isEmpty {
            var existing = Set(
                (patient.associatedSymptoms ?? "")
                    .components(separatedBy: ",")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }
            )
            existing.formUnion(selectedAssoc)
            patient.associatedSymptoms = existing.sorted().joined(separator: ", ")
        }

        // PMH — append unique entries
        var pmh = patient.pmhEntries
        let existingPMH = Set(pmh.map { $0.condition.lowercased() })
        for cond in selectedPMH.sorted() where !existingPMH.contains(cond.lowercased()) {
            pmh.append(PMHEntry(condition: cond))
        }
        for cond in customPMH
            .components(separatedBy: ",")
            .map({ $0.trimmingCharacters(in: .whitespaces) })
            .filter({ !$0.isEmpty }) {
            if !existingPMH.contains(cond.lowercased()) {
                pmh.append(PMHEntry(condition: cond))
            }
        }
        patient.pmhEntries = pmh

        // PSHx — append unique entries
        var pshx = patient.pshxEntries
        let existingPSHx = Set(pshx.map { $0.procedure.lowercased() })
        for proc in selectedPSHx.sorted() where !existingPSHx.contains(proc.lowercased()) {
            pshx.append(PSHxEntry(procedure: proc))
        }
        for proc in customPSHx
            .components(separatedBy: ",")
            .map({ $0.trimmingCharacters(in: .whitespaces) })
            .filter({ !$0.isEmpty }) {
            if !existingPSHx.contains(proc.lowercased()) {
                pshx.append(PSHxEntry(procedure: proc))
            }
        }
        patient.pshxEntries = pshx

        // Medications — append as Prescription objects
        for med in medications {
            let drug = med.drug.trimmingCharacters(in: .whitespaces)
            guard !drug.isEmpty else { continue }
            let rx = Prescription(
                drug: drug,
                dose: med.dose.trimmingCharacters(in: .whitespaces),
                frequency: med.freq.trimmingCharacters(in: .whitespaces)
            )
            rx.patient = patient
            context.insert(rx)
        }

        // Allergies
        if noKnownAllergies {
            // Patient declared NKDA — don't overwrite an existing list, but record intent in pmhNotes
            if patient.allergies.isEmpty {
                // already NKDA by empty list — nothing to set
            }
        } else {
            var existing = patient.allergies
            let existingNames = Set(existing.map { $0.name.lowercased() })
            for row in allergyRows {
                let name = row.name.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { continue }
                if !existingNames.contains(name.lowercased()) {
                    existing.append(AllergyEntry(name: name, severity: row.severity, reaction: row.reaction))
                }
            }
            patient.allergies = existing
        }

        // Family history — append to existing notes
        if !selectedFHx.isEmpty {
            let fhText = selectedFHx.sorted().joined(separator: ", ")
            if let existing = patient.familyHistoryNotes, !existing.isEmpty {
                patient.familyHistoryNotes = existing + "; " + fhText
            } else {
                patient.familyHistoryNotes = fhText
            }
        }

        // Social history — set only if empty
        if (patient.socialHistory ?? "").isEmpty {
            var parts: [String] = []
            if !smokingStatus.isEmpty  { parts.append("Smoking: \(smokingStatus)") }
            if !alcoholStatus.isEmpty  { parts.append("Alcohol: \(alcoholStatus)") }
            if !occupation.trimmingCharacters(in: .whitespaces).isEmpty {
                parts.append("Occupation: \(occupation.trimmingCharacters(in: .whitespaces))")
            }
            if !parts.isEmpty {
                patient.socialHistory = parts.joined(separator: " · ")
            }
        }

        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    // MARK: - Helpers

    private func toggle(_ set: inout Set<String>, _ value: String) {
        if set.contains(value) { set.remove(value) } else { set.insert(value) }
    }

    private func severityColor(_ v: Int) -> Color {
        switch v {
        case 0:    return .secondary
        case 1...3: return .green
        case 4...6: return .orange
        default:   return .red
        }
    }
}

// MARK: - Local row models

private struct MedRow: Identifiable {
    var id = UUID()
    var drug = ""
    var dose = ""
    var freq = ""
}

private struct AllergyRow: Identifiable {
    var id = UUID()
    var name = ""
    var reaction = ""
    var severity = "Mild"
}
