// ConsentFormView+Sections.swift
// Pre-operative investigations, consent sections, and helpers for ConsentFormView.

import SwiftUI
import SwiftData


extension ConsentFormView {

    // MARK: - Pre-operative investigations (read-only)

    @ViewBuilder
    var preOpInvestigationsSection: some View {
        let labs = LabPanel.parse(from: patient.investigations)
        let resulted = patient.investigations.filter { $0.status == .resulted }
        let pending = patient.investigations.filter { $0.status == .ordered || $0.status == .pending }

        if !resulted.isEmpty || !pending.isEmpty {
            Section {
                if labs.hasCriticalValues {
                    Label("Critical lab values — review before signing consent", systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.red)
                }
                let labTokens: [String] = [
                    labs.haemoglobin.map { String(format: "Hb %.1f g/dL", $0.value) },
                    labs.platelets.map { "Plt \(Int($0.value)) ×10⁹/L" },
                    labs.inr.map { String(format: "INR %.1f", $0.value) },
                    labs.sodium.map { "Na \(Int($0.value)) mmol/L" },
                    labs.potassium.map { String(format: "K %.1f mmol/L", $0.value) },
                    labs.creatinine.map { "Cr \(Int($0.value)) µmol/L" }
                ].compactMap { $0 }
                if !labTokens.isEmpty {
                    Text(labTokens.joined(separator: "  ·  "))
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(labs.hasCriticalValues ? .red : .primary)
                }
                let imaging = resulted.filter { $0.category != .blood && !$0.result.isEmpty }
                ForEach(Array(imaging.prefix(3))) { inv in
                    HStack(alignment: .top) {
                        Text(inv.name).font(.caption.weight(.medium))
                        Spacer()
                        Text(inv.result).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    }
                }
                if !pending.isEmpty {
                    Text("\(pending.count) investigation\(pending.count == 1 ? "" : "s") still pending")
                        .font(.caption).foregroundStyle(.orange)
                }
            } header: {
                Text("Pre-operative Investigations")
            }
        }
    }

    var headerSection: some View {
        Section("Consent Details") {
            Picker("Type", selection: $data.consentType) {
                ForEach(["Elective", "Emergency", "Assent (minor)", "Proxy consent"], id: \.self) { Text($0) }
            }
            .onChange(of: data.consentType) { _, _ in save() }
            DatePicker("Date", selection: Binding(
                get: { data.consentDate },
                set: { data.consentDate = $0; save() }
            ), displayedComponents: [.date])
            TextField("Surgeon", text: $data.surgeonName)
                .onChange(of: data.surgeonName) { _, _ in save() }
            TextField("Anaesthetist", text: $data.anaesthetistName)
                .onChange(of: data.anaesthetistName) { _, _ in save() }
        }
    }

    var procedureSection: some View {
        Section("Procedure") {
            TextField("Procedure name", text: $data.procedureName)
                .onChange(of: data.procedureName) { _, new in
                    save()
                    suggestedTemplate = matchTemplate(for: new)
                }

            if let t = suggestedTemplate {
                Button {
                    t.applyConsentFields(to: &data)
                    suggestedTemplate = nil
                    save()
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 14))
                            .foregroundStyle(AMColor.accent)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Apply \"\(t.name)\" template")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(AMColor.accent)
                            Text("Pre-fills description · specific risks · alternatives · anaesthesia")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            suggestedTemplate = nil
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.tertiary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())   // whole row tappable, not only its text
                }
                .buttonStyle(.plain)
                .listRowBackground(AMColor.accentLt.opacity(0.25))
            }

            TextField("Indication / diagnosis", text: $data.indication, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.indication) { _, _ in save() }
            TextField("Procedure description (for patient)", text: $data.procedureDescription, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.procedureDescription) { _, _ in save() }
            Picker("Side / site", selection: $data.sideOrSite) {
                ForEach(["Not applicable", "Left", "Right", "Bilateral", "Midline", "Upper abdomen", "Lower abdomen"], id: \.self) { Text($0) }
            }
            .onChange(of: data.sideOrSite) { _, _ in save() }
        }
    }

    var generalRisksSection: some View {
        Section {
            ForEach(data.generalRisks, id: \.self) { risk in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(AMColor.accent)
                        .font(.system(size: 14))
                    Text(risk)
                        .font(.subheadline)
                }
            }
        } header: {
            Text("General Risks (always included)")
        } footer: {
            Text("These risks apply to all surgical procedures and are pre-selected.")
                .font(.caption2)
        }
    }

    var specificRisksSection: some View {
        Section("Procedure-Specific Risks") {
            chipMultiSelect("Select applicable risks", options: specificRiskOptions, selected: $data.specificRisks)
                .onChange(of: data.specificRisks) { _, _ in save() }
            TextField("Other specific risks", text: $data.specificRisksOther, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.specificRisksOther) { _, _ in save() }
        }
    }

    var alternativesSection: some View {
        Section("Alternative Treatments Discussed") {
            chipMultiSelect("", options: alternativeOptions, selected: $data.alternativesTreated)
                .onChange(of: data.alternativesTreated) { _, _ in save() }
            TextField("Other alternatives", text: $data.alternativesOther)
                .onChange(of: data.alternativesOther) { _, _ in save() }
        }
    }

    var anaesthesiaSection: some View {
        Section("Anaesthesia") {
            Picker("Type", selection: $data.anaesthesiaType) {
                ForEach(anaesthesiaOptions, id: \.self) { Text($0) }
            }
            .onChange(of: data.anaesthesiaType) { _, _ in save() }
            Toggle("Anaesthesia risks discussed", isOn: $data.anaesthesiaRisksDiscussed)
                .onChange(of: data.anaesthesiaRisksDiscussed) { _, _ in save() }
        }
    }

    var bloodProductsSection: some View {
        Section("Blood Products") {
            Toggle("Blood products / transfusion discussed", isOn: $data.bloodProductsDiscussed)
                .onChange(of: data.bloodProductsDiscussed) { _, _ in save() }
            Toggle("Patient declines blood products", isOn: $data.bloodProductsDeclined)
                .onChange(of: data.bloodProductsDeclined) { _, _ in save() }
                .tint(.red)
        }
    }

    var capacitySection: some View {
        Section("Patient Understanding & Capacity") {
            Toggle("Decision-making capacity confirmed", isOn: $data.capacityConfirmed)
                .onChange(of: data.capacityConfirmed) { _, _ in save() }
            Toggle("Interpreter required", isOn: $data.interpreterRequired)
                .onChange(of: data.interpreterRequired) { _, _ in save() }
            if data.interpreterRequired {
                TextField("Interpreter name / language", text: $data.interpreterName)
                    .onChange(of: data.interpreterName) { _, _ in save() }
            }
            TextField("Questions asked by patient", text: $data.questionsAsked, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.questionsAsked) { _, _ in save() }
            Toggle("Questions answered to patient's satisfaction", isOn: $data.questionsAnswered)
                .onChange(of: data.questionsAnswered) { _, _ in save() }
        }
    }

    var signatureSection: some View {
        Section("Signature Block") {
            TextField("Patient printed name", text: $data.patientPrintedName)
                .onChange(of: data.patientPrintedName) { _, _ in save() }
            TextField("Witness name", text: $data.witnessName)
                .onChange(of: data.witnessName) { _, _ in save() }
            TextField("Witness designation", text: $data.witnessDesignation,
                      prompt: Text("e.g. Registered Nurse"))
                .onChange(of: data.witnessDesignation) { _, _ in save() }
        }
    }

    var additionalSection: some View {
        Section("Additional Notes") {
            TextField("Any other relevant information", text: $data.additionalNotes, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.additionalNotes) { _, _ in save() }
        }
    }

    // MARK: Helpers

    func save() {
        patient.consentFormData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    func matchTemplate(for name: String) -> ProcedureTemplate? {
        let q = name.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 4 else { return nil }
        if let t = ProcedureTemplate.all.first(where: { $0.name.lowercased().contains(q) || q.contains($0.name.lowercased()) }) {
            return t
        }
        let stopWords: Set<String> = ["the","and","or","of","for","a","an","with","on","in","to"]
        let queryWords = Set(q.components(separatedBy: .whitespacesAndNewlines)
            .map { $0.trimmingCharacters(in: .punctuationCharacters) }
            .filter { $0.count > 2 && !stopWords.contains($0) })
        return ProcedureTemplate.all.first { template in
            let tWords = Set(template.name.lowercased().components(separatedBy: .whitespacesAndNewlines)
                .filter { $0.count > 2 && !stopWords.contains($0) })
            return queryWords.intersection(tWords).count >= 2
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
                        let chipColor: Color = on ? AMColor.accent : Color.secondary.opacity(0.12)
                        Button {
                            if on { selected.wrappedValue.removeAll { $0 == opt } }
                            else  { selected.wrappedValue.append(opt) }
                        } label: {
                            Text(opt)
                                .font(.system(size: 11, weight: on ? .semibold : .regular))
                                .foregroundStyle(on ? .white : .primary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(chipColor, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

}
