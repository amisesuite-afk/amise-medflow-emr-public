// OGDFormView+Sections.swift
// OGDFormView section views and helpers.

import SwiftUI
import SwiftData


extension OGDFormView {

    // MARK: Pre-procedure Labs (read-only)

    @ViewBuilder
    var preProcedureLabsSection: some View {
        let labs = LabPanel.parse(from: patient.investigations)
        let hasRelevant = labs.haemoglobin != nil || labs.platelets != nil || labs.inr != nil

        if hasRelevant {
            Section {
                if let hb = labs.haemoglobin {
                    ogdLabRow("Haemoglobin", value: String(format: "%.1f g/dL", hb.value),
                              flag: hb.value < 10 ? "Low — anaemia" : nil, critical: hb.value < 8)
                }
                if let plt = labs.platelets {
                    ogdLabRow("Platelets", value: "\(Int(plt.value)) ×10⁹/L",
                              flag: plt.value < 100 ? "Low — biopsy risk" : nil, critical: plt.value < 50)
                }
                if let inr = labs.inr {
                    ogdLabRow("INR", value: String(format: "%.1f", inr.value),
                              flag: inr.value > 1.5 ? "Elevated — bleeding risk" : nil, critical: inr.value > 2.5)
                }
            } header: {
                Text("Pre-procedure Results")
            } footer: {
                if labs.hasCriticalValues {
                    Label("Critical lab values — review before proceeding", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption2).foregroundStyle(.red)
                }
            }
        }
    }

    func ogdLabRow(_ name: String, value: String, flag: String?, critical: Bool) -> some View {
        HStack {
            Text(name).foregroundStyle(.primary)
            Spacer()
            if let f = flag {
                Text(f)
                    .font(.caption)
                    .foregroundStyle(critical ? .red : .orange)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background((critical ? Color.red : Color.orange).opacity(0.1), in: Capsule())
            }
            Text(value)
                .font(.system(.subheadline, design: .monospaced))
                .foregroundStyle(critical ? .red : flag != nil ? .orange : .secondary)
        }
    }

    // MARK: Pre-procedure

    var preProcedureSection: some View {
        Section("Pre-procedure") {
            chipMultiSelect("Indication", options: indications, selected: $data.indication)
                .onChange(of: data.indication) { _, _ in save() }
            if data.indication.contains("Other") {
                TextField("Other indication", text: $data.indicationOther)
                    .onChange(of: data.indicationOther) { _, _ in save() }
            }
            Toggle("Consent obtained", isOn: $data.consent)
                .onChange(of: data.consent) { _, _ in save() }
            staffField("Operator", text: $data.operator_, role: .surgeon)
            staffField("Assistant", text: $data.assistant, role: .assistant)

            Toggle("Date of procedure", isOn: $hasProcedureDate)
                .onChange(of: hasProcedureDate) { _, on in
                    data.dateOfProcedure = on ? (data.dateOfProcedure ?? .now) : nil
                    save()
                }
            if hasProcedureDate {
                DatePicker("Date", selection: Binding(
                    get: { data.dateOfProcedure ?? .now },
                    set: { data.dateOfProcedure = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
        }
    }

    // MARK: Procedure details

    var procedureSection: some View {
        Section("Procedure Details") {
            TextField("Endoscope model", text: $data.endoscopeModel)
                .onChange(of: data.endoscopeModel) { _, _ in save() }
            HStack {
                Text("Duration")
                Spacer()
                TextField("—", text: $data.duration)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
                    .onChange(of: data.duration) { _, _ in save() }
                Text("min").foregroundStyle(.secondary)
            }
            Picker("Quality / completion", selection: $data.quality) {
                ForEach(["Excellent", "Good", "Adequate", "Incomplete — patient intolerance", "Incomplete — technical"], id: \.self) { Text($0) }
            }
            .onChange(of: data.quality) { _, _ in save() }
            TextField("Sedation used", text: $data.sedationUsed)
                .onChange(of: data.sedationUsed) { _, _ in save() }
            TextField("Sedation dose", text: $data.sedationDose)
                .onChange(of: data.sedationDose) { _, _ in save() }
            Toggle("Antispasmodic given", isOn: $data.antispasmodic)
                .onChange(of: data.antispasmodic) { _, _ in save() }
            Toggle("Antibiotic prophylaxis", isOn: $data.antibiotic)
                .onChange(of: data.antibiotic) { _, _ in save() }
            if data.antibiotic {
                TextField("Antibiotic used", text: $data.antibioticUsed)
                    .onChange(of: data.antibioticUsed) { _, _ in save() }
            }
        }
    }

    // MARK: Oesophagus

    var oesophagusSection: some View {
        Section("Oesophagus") {
            Toggle("Normal", isOn: $data.oesophagusNormal)
                .onChange(of: data.oesophagusNormal) { _, _ in save() }
            if !data.oesophagusNormal {
                chipMultiSelect("Findings", options: oesophagusOptions, selected: $data.oesophagusFindings)
                    .onChange(of: data.oesophagusFindings) { _, _ in save() }
                HStack {
                    Text("Z-line from incisors")
                    Spacer()
                    TextField("—", text: $data.zLineCm).keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing).frame(width: 50)
                        .onChange(of: data.zLineCm) { _, _ in save() }
                    Text("cm").foregroundStyle(.secondary)
                }
                Toggle("Barrett's oesophagus", isOn: $data.barretts)
                    .onChange(of: data.barretts) { _, _ in save() }
                TextField("Notes", text: $data.oesophagusNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.oesophagusNotes) { _, _ in save() }
            }
        }
    }

    // MARK: Barrett's

    var barrettsSection: some View {
        Section("Barrett's — Prague Criteria") {
            HStack {
                Text("Extent (C)")
                Spacer()
                TextField("cm", text: $data.pragueCmC).keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing).frame(width: 60)
                    .onChange(of: data.pragueCmC) { _, _ in save() }
                Text("cm").foregroundStyle(.secondary)
            }
            HStack {
                Text("Maximum (M)")
                Spacer()
                TextField("cm", text: $data.pragueCmM).keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing).frame(width: 60)
                    .onChange(of: data.pragueCmM) { _, _ in save() }
                Text("cm").foregroundStyle(.secondary)
            }
        }
    }

    // MARK: Stomach

    var stomachSection: some View {
        Section("Stomach") {
            Toggle("Normal", isOn: $data.stomachNormal)
                .onChange(of: data.stomachNormal) { _, _ in save() }
            if !data.stomachNormal {
                chipMultiSelect("Findings", options: stomachOptions, selected: $data.stomachFindings)
                    .onChange(of: data.stomachFindings) { _, _ in save() }
                TextField("Notes", text: $data.stomachNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.stomachNotes) { _, _ in save() }
            }
        }
    }

    // MARK: Duodenum

    var duodenumSection: some View {
        Section("Duodenum") {
            Toggle("Normal", isOn: $data.duodenumNormal)
                .onChange(of: data.duodenumNormal) { _, _ in save() }
            if !data.duodenumNormal {
                chipMultiSelect("Findings", options: duodenumOptions, selected: $data.duodenumFindings)
                    .onChange(of: data.duodenumFindings) { _, _ in save() }
                TextField("Notes", text: $data.duodenumNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.duodenumNotes) { _, _ in save() }
            }
        }
    }

    // MARK: H pylori / Biopsy

    var hpBiopsySection: some View {
        Section("H. pylori & Biopsy") {
            Toggle("H. pylori test done", isOn: $data.hpTestDone)
                .onChange(of: data.hpTestDone) { _, _ in save() }
            if data.hpTestDone {
                Picker("Result", selection: $data.hpResult) {
                    ForEach(["Pending", "Positive", "Negative"], id: \.self) { Text($0) }
                }
                .onChange(of: data.hpResult) { _, _ in save() }
            }
            Toggle("Biopsy taken", isOn: $data.biopsyTaken)
                .onChange(of: data.biopsyTaken) { _, _ in save() }
            if data.biopsyTaken {
                chipMultiSelect("Biopsy sites", options: [
                    "Antrum", "Body", "Fundus", "Oesophagus (distal)", "Oesophagus (mid)", "D2", "Other"
                ], selected: $data.biopsySites)
                .onChange(of: data.biopsySites) { _, _ in save() }
                TextField("Biopsy notes", text: $data.biopsyNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.biopsyNotes) { _, _ in save() }
            }
        }
    }

    // MARK: Interventions

    var interventionsSection: some View {
        Section("Interventions Performed") {
            chipMultiSelect("Interventions", options: interventionOptions, selected: $data.interventionsDone)
                .onChange(of: data.interventionsDone) { _, _ in save() }
            TextField("Intervention notes", text: $data.interventionNotes, axis: .vertical).lineLimit(2...)
                .onChange(of: data.interventionNotes) { _, _ in save() }
        }
    }

    // MARK: Impression

    var impressionSection: some View {
        Section {
            chipMultiSelect("Interventions done?", options: interventionOptions, selected: $data.interventionsDone)
                .onChange(of: data.interventionsDone) { _, _ in save() }
            TextField("Endoscopic impression", text: $data.impression, axis: .vertical).lineLimit(3...)
                .onChange(of: data.impression) { _, _ in save() }
            TextField("Recommendations / management", text: $data.recommendations, axis: .vertical).lineLimit(3...)
                .onChange(of: data.recommendations) { _, _ in save() }
            HStack {
                Text("Follow-up")
                Spacer()
                TextField("—", text: $data.followUpWeeks).keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing).frame(width: 50)
                    .onChange(of: data.followUpWeeks) { _, _ in save() }
                Text("weeks").foregroundStyle(.secondary)
            }
        } header: {
            HStack {
                Text("Impression & Plan")
                Spacer()
                MedicalDictationButton(mode: .endoscopy, patient: patient) { polished in
                    data.impression += (data.impression.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    // MARK: Helpers

    func save() {
        if data.operator_.count >= 4 { StaffRegistry.shared.add(data.operator_, to: .surgeon) }
        if data.assistant.count >= 4  { StaffRegistry.shared.add(data.assistant,  to: .assistant) }
        patient.ogdData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    func staffField(_ label: String, text: Binding<String>, role: StaffRegistry.Role) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(label, text: text).onChange(of: text.wrappedValue) { _, _ in save() }
            let q = text.wrappedValue.lowercased()
            let names = StaffRegistry.shared.names(for: role).filter { q.isEmpty || $0.lowercased().contains(q) }
            let showSuggestions = !names.isEmpty && !names.contains(text.wrappedValue)
            if showSuggestions {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(names, id: \.self) { name in
                            Button {
                                text.wrappedValue = name
                                save()
                            } label: {
                                Text(name)
                                    .font(.system(size: 11))
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Color.secondary.opacity(0.12), in: Capsule())
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    func chipMultiSelect(_ label: String, options: [String], selected: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !label.isEmpty {
                Text(label).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(options, id: \.self) { opt in
                        let on = selected.wrappedValue.contains(opt)
                        Button {
                            if on { selected.wrappedValue.removeAll { $0 == opt } }
                            else { selected.wrappedValue.append(opt) }
                        } label: {
                            Text(opt)
                                .font(.system(size: 11, weight: on ? .semibold : .regular))
                                .foregroundStyle(on ? .white : .primary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(on ? AMColor.accent : Color.secondary.opacity(0.12), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

}
