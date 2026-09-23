// ERCPFormView+Sections.swift
// Pre-procedure Labs, Pre-procedure, Ampulla, Access, Cholangiogram,
// Pancreatogram, Stone Extraction, Stenting, Biopsy, Complications,
// PEP Prophylaxis, Impression — @ViewBuilder section vars.

import SwiftUI
import SwiftData

extension ERCPFormView {

    // MARK: Pre-procedure Labs (read-only)

    @ViewBuilder
    var preProcedureLabsSection: some View {
        let labs = LabPanel.parse(from: patient.investigations)
        let nonLabResults = patient.investigations.filter { $0.status == .resulted && $0.category != .blood }
        let hasAny = labs.bilirubin != nil || labs.alt != nil || labs.alp != nil ||
                     labs.inr != nil || labs.haemoglobin != nil || labs.creatinine != nil ||
                     !nonLabResults.isEmpty

        if hasAny {
            Section {
                if let bil = labs.bilirubin {
                    labRow("Bilirubin", value: String(format: "%.1f µmol/L", bil.value),
                           flag: bil.value > 100 ? "Elevated" : nil, critical: bil.value > 200)
                }
                if let alt = labs.alt {
                    labRow("ALT", value: "\(Int(alt.value)) U/L",
                           flag: alt.value > 120 ? "Elevated" : nil, critical: alt.value > 400)
                }
                if let alp = labs.alp {
                    labRow("ALP", value: "\(Int(alp.value)) U/L", flag: nil, critical: false)
                }
                if let inr = labs.inr {
                    labRow("INR", value: String(format: "%.1f", inr.value),
                           flag: inr.value > 1.5 ? "Elevated — bleeding risk" : nil, critical: inr.value > 2.5)
                }
                if let hb = labs.haemoglobin {
                    labRow("Haemoglobin", value: String(format: "%.1f g/dL", hb.value),
                           flag: hb.value < 10 ? "Low — anaemia" : nil, critical: hb.value < 8)
                }
                if let cr = labs.creatinine {
                    labRow("Creatinine", value: "\(Int(cr.value)) µmol/L",
                           flag: cr.value > 130 ? "Elevated — contrast risk" : nil, critical: cr.value > 300)
                }
                ForEach(Array(nonLabResults.prefix(4))) { inv in
                    labRow(inv.name, value: inv.result.isEmpty ? "Resulted" : inv.result, flag: nil, critical: false)
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

    func labRow(_ name: String, value: String, flag: String?, critical: Bool) -> some View {
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
            TextField("Operator", text: $data.operator_)
                .onChange(of: data.operator_) { _, _ in save() }
            TextField("Assistant", text: $data.assistant)
                .onChange(of: data.assistant) { _, _ in save() }
            Toggle("Date of procedure", isOn: $hasProcedureDate)
                .onChange(of: hasProcedureDate) { _, on in
                    data.dateOfProcedure = on ? (data.dateOfProcedure ?? .now) : nil; save()
                }
            if hasProcedureDate {
                DatePicker("Date", selection: Binding(
                    get: { data.dateOfProcedure ?? .now },
                    set: { data.dateOfProcedure = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
            Picker("Anaesthesia", selection: $data.anaesthesiaType) {
                ForEach(["MAC / Propofol", "General ETT", "Spinal", "Local + sedation"], id: \.self) { Text($0) }
            }
            .onChange(of: data.anaesthesiaType) { _, _ in save() }
            Picker("Position", selection: $data.position) {
                ForEach(["Prone", "Left lateral", "Supine"], id: \.self) { Text($0) }
            }
            .onChange(of: data.position) { _, _ in save() }
            Toggle("Antibiotic prophylaxis", isOn: $data.antibiotic)
                .onChange(of: data.antibiotic) { _, _ in save() }
            if data.antibiotic {
                TextField("Antibiotic", text: $data.antibioticUsed)
                    .onChange(of: data.antibioticUsed) { _, _ in save() }
            }
            Toggle("Fluoroscopy", isOn: $data.fluoroscopy)
                .onChange(of: data.fluoroscopy) { _, _ in save() }
            TextField("Duodenoscope", text: $data.duodenoscope)
                .onChange(of: data.duodenoscope) { _, _ in save() }
            TextField("Contrast", text: $data.contrastUsed)
                .onChange(of: data.contrastUsed) { _, _ in save() }
            Toggle("Contrast allergy pre-meds given", isOn: $data.contrastAllergyPremeds)
                .onChange(of: data.contrastAllergyPremeds) { _, _ in save() }
        }
    }

    // MARK: Ampulla

    var ampullaSection: some View {
        Section("Ampulla of Vater") {
            Picker("Appearance", selection: $data.ampullaAppearance) {
                ForEach(["Normal", "Abnormal", "Not identified", "Surgically altered"], id: \.self) { Text($0) }
            }
            .onChange(of: data.ampullaAppearance) { _, _ in save() }
            if data.ampullaAppearance == "Abnormal" {
                chipMultiSelect("Findings", options: ampullaOptions, selected: $data.ampullaFindings)
                    .onChange(of: data.ampullaFindings) { _, _ in save() }
            }
        }
    }

    // MARK: Access / Sphincterotomy

    var accessSection: some View {
        Section("Duct Access") {
            Toggle("Bile duct cannulated", isOn: $data.bileDuctCannulated)
                .onChange(of: data.bileDuctCannulated) { _, _ in save() }
            Toggle("Pancreatic duct cannulated", isOn: $data.pancreaticDuctCannulated)
                .onChange(of: data.pancreaticDuctCannulated) { _, _ in save() }
            Toggle("Pancreatogram performed", isOn: $data.pancreatogramDone)
                .onChange(of: data.pancreatogramDone) { _, _ in save() }
            Toggle("Sphincterotomy", isOn: $data.sphincterotomy)
                .onChange(of: data.sphincterotomy) { _, _ in save() }
            if data.sphincterotomy {
                Picker("Type", selection: $data.sphincterotomyType) {
                    ForEach(["Biliary", "Pancreatic", "Minor papilla", "Combined"], id: \.self) { Text($0) }
                }
                .onChange(of: data.sphincterotomyType) { _, _ in save() }
            }
            Toggle("Pre-cut", isOn: $data.precut)
                .onChange(of: data.precut) { _, _ in save() }
            if data.precut {
                Picker("Pre-cut type", selection: $data.precutType) {
                    ForEach(["Needle-knife", "Transpancreatic", "Fistulotomy"], id: \.self) { Text($0) }
                }
                .onChange(of: data.precutType) { _, _ in save() }
            }
        }
    }

    // MARK: Cholangiogram

    var cholangiogramSection: some View {
        Section("Cholangiogram (CBD)") {
            Toggle("Cholangiogram performed", isOn: $data.cholangiogramDone)
                .onChange(of: data.cholangiogramDone) { _, _ in save() }
            if data.cholangiogramDone {
                HStack {
                    Text("CBD diameter")
                    Spacer()
                    TextField("—", text: $data.cbdDiameter)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.cbdDiameter) { _, _ in save() }
                    Text("mm").foregroundStyle(.secondary)
                }
                chipMultiSelect("Findings", options: cbdFindingOptions, selected: $data.cbdFindings)
                    .onChange(of: data.cbdFindings) { _, _ in save() }
            }

            // Biliary stenosis / stenting
            Toggle("Biliary stricture / stenosis", isOn: $data.biliaryStenosis)
                .onChange(of: data.biliaryStenosis) { _, _ in save() }
            if data.biliaryStenosis {
                Picker("Level", selection: $data.biliaryStenosisLevel) {
                    ForEach(["Distal CBD", "Mid CBD", "Hilar (Bismuth I)", "Hilar (Bismuth II)",
                             "Hilar (Bismuth IIIa)", "Hilar (Bismuth IIIb)", "Hilar (Bismuth IV)"], id: \.self) { Text($0) }
                }
                .onChange(of: data.biliaryStenosisLevel) { _, _ in save() }
            }
        }
    }

    // MARK: Pancreatogram

    var pancreatogramSection: some View {
        Section("Pancreatogram (PD)") {
            HStack {
                Text("PD diameter")
                Spacer()
                TextField("—", text: $data.pdDiameter)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
                    .onChange(of: data.pdDiameter) { _, _ in save() }
                Text("mm").foregroundStyle(.secondary)
            }
            chipMultiSelect("Findings", options: pdFindingOptions, selected: $data.pdFindings)
                .onChange(of: data.pdFindings) { _, _ in save() }
        }
    }

    // MARK: Stone Extraction

    var stoneSection: some View {
        Section("Stone Extraction") {
            Toggle("Stone extraction attempted", isOn: $data.stoneExtraction)
                .onChange(of: data.stoneExtraction) { _, _ in save() }
            if data.stoneExtraction {
                HStack {
                    Text("Stone count")
                    Spacer()
                    TextField("—", text: $data.stoneCount)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.stoneCount) { _, _ in save() }
                }
                HStack {
                    Text("Largest stone")
                    Spacer()
                    TextField("—", text: $data.stoneSizeMax)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.stoneSizeMax) { _, _ in save() }
                    Text("mm").foregroundStyle(.secondary)
                }
                chipMultiSelect("Extraction method", options: extractionOptions, selected: $data.extractionMethod)
                    .onChange(of: data.extractionMethod) { _, _ in save() }
                Picker("Clearance", selection: $data.clearance) {
                    ForEach(["Complete", "Partial", "Incomplete — large stones", "Incomplete — multiple stones"], id: \.self) { Text($0) }
                }
                .onChange(of: data.clearance) { _, _ in save() }
            }
        }
    }

    // MARK: Stenting

    var stentSection: some View {
        Section("Stenting") {
            Toggle("Plastic biliary stent", isOn: $data.plasticStent)
                .onChange(of: data.plasticStent) { _, _ in save() }
            if data.plasticStent {
                TextField("Size (e.g. 10Fr 7cm)", text: $data.plasticStentSize)
                    .onChange(of: data.plasticStentSize) { _, _ in save() }
            }
            Toggle("Metal biliary stent (SEMS)", isOn: $data.metalStent)
                .onChange(of: data.metalStent) { _, _ in save() }
            if data.metalStent {
                Picker("Type", selection: $data.metalStentType) {
                    ForEach(["Covered SEMS", "Uncovered SEMS", "Partially covered SEMS"], id: \.self) { Text($0) }
                }
                .onChange(of: data.metalStentType) { _, _ in save() }
            }
            Toggle("Pancreatic stent", isOn: $data.pancreaticStent)
                .onChange(of: data.pancreaticStent) { _, _ in save() }
            if data.pancreaticStent {
                TextField("Size (e.g. 5Fr 5cm)", text: $data.pancreaticStentSize)
                    .onChange(of: data.pancreaticStentSize) { _, _ in save() }
            }
        }
    }

    // MARK: Biopsy

    var biopsySection: some View {
        Section("Tissue Sampling") {
            Toggle("Brush cytology", isOn: $data.brushCytology)
                .onChange(of: data.brushCytology) { _, _ in save() }
            Toggle("Forceps biopsy", isOn: $data.forcepsBiopsy)
                .onChange(of: data.forcepsBiopsy) { _, _ in save() }
            if data.brushCytology || data.forcepsBiopsy {
                TextField("Site / lesion", text: $data.biopsySite)
                    .onChange(of: data.biopsySite) { _, _ in save() }
            }
        }
    }

    // MARK: Complications

    var complicationsSection: some View {
        Section("Outcome & Complications") {
            Picker("Completion", selection: $data.completionStatus) {
                ForEach(["Complete", "Incomplete — anatomy", "Incomplete — patient intolerance",
                         "Incomplete — technical"], id: \.self) { Text($0) }
            }
            .onChange(of: data.completionStatus) { _, _ in save() }
            chipMultiSelect("Complications", options: complicationOptions, selected: $data.complications)
                .onChange(of: data.complications) { _, _ in save() }
            if !data.complications.isEmpty && !data.complications.contains("None") {
                TextField("Complication details", text: $data.complicationNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.complicationNotes) { _, _ in save() }
            }
        }
    }

    // MARK: PEP Prophylaxis

    var pepProphylaxisSection: some View {
        Section("Post-ERCP Pancreatitis Prophylaxis") {
            Picker("PEP risk", selection: $data.pepRisk) {
                ForEach(["Standard", "High", "Very high"], id: \.self) { Text($0) }
            }
            .onChange(of: data.pepRisk) { _, _ in save() }
            Toggle("Rectal indomethacin given", isOn: $data.indomethacin)
                .onChange(of: data.indomethacin) { _, _ in save() }
            Toggle("Prophylactic pancreatic stent placed", isOn: $data.pancreaticStentForPEP)
                .onChange(of: data.pancreaticStentForPEP) { _, _ in save() }

            if data.pepRisk != "Standard" && !data.indomethacin {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Text("High-risk ERCP — consider rectal indomethacin prophylaxis")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                .listRowBackground(Color.orange.opacity(0.06))
            }
        }
    }

    // MARK: Impression

    var impressionSection: some View {
        Section {
            TextField("Endoscopic impression", text: $data.impression, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.impression) { _, _ in save() }
            TextField("Recommendations / management", text: $data.recommendations, axis: .vertical)
                .lineLimit(3...)
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

}
