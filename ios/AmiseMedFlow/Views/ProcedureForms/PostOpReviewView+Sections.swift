// PostOpReviewView+Sections.swift
// Section @ViewBuilder functions and helpers for PostOpReviewView.

import SwiftUI
import SwiftData


extension PostOpReviewView {

    // MARK: Sections

    var reviewHeaderSection: some View {
        Section("Review Details") {
            TextField("Reviewed by", text: $data.reviewedBy)
                .onChange(of: data.reviewedBy) { _, _ in save() }
            Toggle("Set review date", isOn: $hasReviewDate)
                .onChange(of: hasReviewDate) { _, on in
                    data.reviewDate = on ? (data.reviewDate ?? .now) : nil; save()
                }
            if hasReviewDate {
                DatePicker("Review date", selection: Binding(
                    get: { data.reviewDate ?? .now },
                    set: { data.reviewDate = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
            Stepper("Post-op day: \(data.postOpDay)", value: $data.postOpDay, in: 0...365)
                .onChange(of: data.postOpDay) { _, _ in save() }
            TextField("Procedure reviewed", text: $data.procedure)
                .onChange(of: data.procedure) { _, _ in save() }
        }
    }

    var symptomsSection: some View {
        Section("Symptoms") {
            VStack(alignment: .leading, spacing: 4) {
                Text("Pain score (VAS 0–10)")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                HStack {
                    Text("0").font(.caption).foregroundStyle(.secondary)
                    Slider(value: Binding(
                        get: { Double(data.pain) },
                        set: { data.pain = Int($0); save() }
                    ), in: 0...10, step: 1)
                    Text("10").font(.caption).foregroundStyle(.secondary)
                    Text("\(data.pain)")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(data.pain >= 7 ? .red : data.pain >= 4 ? .orange : .green)
                        .frame(width: 28)
                }
            }
            Toggle("Nausea", isOn: $data.nausea)
                .onChange(of: data.nausea) { _, _ in save() }
            Toggle("Vomiting", isOn: $data.vomiting)
                .onChange(of: data.vomiting) { _, _ in save() }
            Toggle("Fever", isOn: $data.fever)
                .onChange(of: data.fever) { _, _ in save() }
            Toggle("Dyspnoea", isOn: $data.dyspnoea)
                .onChange(of: data.dyspnoea) { _, _ in save() }
        }
    }

    var woundSection: some View {
        Section("Wound Assessment") {
            Toggle("Wound inspected", isOn: $data.woundInspected)
                .onChange(of: data.woundInspected) { _, _ in save() }
            if data.woundInspected {
                Picker("Status", selection: $data.woundStatus) {
                    ForEach(["Clean and dry", "Moist", "Erythematous",
                             "Discharging", "Dehisced", "Not yet reviewed"], id: \.self) { Text($0) }
                }
                .onChange(of: data.woundStatus) { _, _ in save() }
                chipMultiSelect("Findings", options: woundFindingOptions, selected: $data.woundFindings)
                    .onChange(of: data.woundFindings) { _, _ in save() }
                TextField("Wound notes", text: $data.woundNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.woundNotes) { _, _ in save() }
            }
            Toggle("Drain present", isOn: $data.drainPresent)
                .onChange(of: data.drainPresent) { _, _ in save() }
        }
    }

    var drainSection: some View {
        Section("Drain") {
            HStack {
                Text("Output")
                Spacer()
                TextField("—", text: $data.drainOutput)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 70)
                    .onChange(of: data.drainOutput) { _, _ in save() }
                Text("mL / 24 h").foregroundStyle(.secondary)
            }
            Picker("Fluid character", selection: $data.drainFluid) {
                ForEach(drainFluidOptions, id: \.self) { Text($0) }
            }
            .onChange(of: data.drainFluid) { _, _ in save() }
            Toggle("Drain removed today", isOn: $data.drainRemoved)
                .onChange(of: data.drainRemoved) { _, _ in save() }
        }
    }

    var giRecoverySection: some View {
        Section("GI Recovery") {
            Toggle("Flatus passed", isOn: $data.flatus)
                .onChange(of: data.flatus) { _, _ in save() }
            Toggle("Bowels opened", isOn: $data.bowelsOpen)
                .onChange(of: data.bowelsOpen) { _, _ in save() }
            Toggle("Tolerating diet", isOn: $data.toleratingDiet)
                .onChange(of: data.toleratingDiet) { _, _ in save() }
            if data.toleratingDiet {
                Picker("Diet type", selection: $data.dietType) {
                    ForEach(["Sips only", "Free fluids", "Soft diet", "Normal diet", "Nil by mouth"], id: \.self) { Text($0) }
                }
                .onChange(of: data.dietType) { _, _ in save() }
            }
        }
    }

    var urinarySection: some View {
        Section("Urinary") {
            Toggle("Urinary catheter in situ", isOn: $data.urinaryCatheter)
                .onChange(of: data.urinaryCatheter) { _, _ in save() }
            if data.urinaryCatheter {
                HStack {
                    Text("Urine output")
                    Spacer()
                    TextField("—", text: $data.urineOutput)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 70)
                        .onChange(of: data.urineOutput) { _, _ in save() }
                    Text("mL / 24 h").foregroundStyle(.secondary)
                }
                Toggle("Catheter removed today", isOn: $data.catheterRemoved)
                    .onChange(of: data.catheterRemoved) { _, _ in save() }
            }
        }
    }

    var mobilityVTESection: some View {
        Section("Mobility & VTE") {
            Toggle("Mobilising", isOn: $data.mobilising)
                .onChange(of: data.mobilising) { _, _ in save() }
            Toggle("Physiotherapy seen", isOn: $data.physioSeen)
                .onChange(of: data.physioSeen) { _, _ in save() }
            Toggle("DVT prophylaxis given today", isOn: $data.dvtProphylaxisGiven)
                .onChange(of: data.dvtProphylaxisGiven) { _, _ in save() }
            Toggle("TEDs worn", isOn: $data.teds)
                .onChange(of: data.teds) { _, _ in save() }
        }
    }

    var vitalsSection: some View {
        Section("Vitals Overview") {
            Toggle("Temperature normal", isOn: $data.tempNormal)
                .onChange(of: data.tempNormal) { _, _ in save() }
            Toggle("Blood pressure normal", isOn: $data.bpNormal)
                .onChange(of: data.bpNormal) { _, _ in save() }
            Toggle("Heart rate normal", isOn: $data.hrNormal)
                .onChange(of: data.hrNormal) { _, _ in save() }
            HStack {
                Text("NEWS2 score")
                Spacer()
                TextField("—", text: $data.news2)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
                    .onChange(of: data.news2) { _, _ in save() }
            }
            TextField("Vitals notes", text: $data.vitalsNotes)
                .onChange(of: data.vitalsNotes) { _, _ in save() }
        }
    }

    var labsSection: some View {
        Section("Investigations") {
            let resultedInvs = patient.investigations
                .filter { $0.status == .resulted && !$0.result.isEmpty }
                .sorted { ($0.resultedAt ?? $0.orderedAt) > ($1.resultedAt ?? $1.orderedAt) }
            if !resultedInvs.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Resulted investigations", systemImage: "flask.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.teal)
                    ForEach(Array(resultedInvs.prefix(8)), id: \.id) { inv in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: inv.category.icon)
                                .font(.system(size: 10))
                                .foregroundStyle(.teal)
                                .frame(width: 14)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(inv.name)
                                    .font(.system(size: 12, weight: .medium))
                                Text(inv.result)
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    if resultedInvs.count > 8 {
                        Text("+\(resultedInvs.count - 8) more")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            chipMultiSelect("Labs ordered", options: labOptions, selected: $data.labsOrdered)
                .onChange(of: data.labsOrdered) { _, _ in save() }
            TextField("Lab / investigation notes", text: $data.labNotes, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.labNotes) { _, _ in save() }
        }
    }

    var assessmentSection: some View {
        Section {
            TextField("Assessment", text: $data.assessment, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.assessment) { _, _ in save() }
            TextField("Plan for today", text: $data.plan, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.plan) { _, _ in save() }
        } header: {
            HStack {
                Text("Assessment & Plan")
                Spacer()
                MedicalDictationButton(mode: .consultation, patient: patient) { polished in
                    data.assessment += (data.assessment.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    var dischargeSection: some View {
        Section("Discharge Planning") {
            Toggle("Set expected discharge date", isOn: $hasExpectedDischarge)
                .onChange(of: hasExpectedDischarge) { _, on in
                    data.expectedDischargeDate = on ? (data.expectedDischargeDate ?? .now) : nil; save()
                }
            if hasExpectedDischarge {
                DatePicker("Expected discharge", selection: Binding(
                    get: { data.expectedDischargeDate ?? .now },
                    set: { data.expectedDischargeDate = $0; save() }
                ), displayedComponents: [.date])
            }
            chipMultiSelect("Barriers to discharge", options: dischargeBarrierOptions,
                            selected: $data.dischargeBarriers)
                .onChange(of: data.dischargeBarriers) { _, _ in save() }
        }
    }

    // MARK: Helpers

    func save() {
        patient.postOpReviewData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
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
                            else  { selected.wrappedValue.append(opt) }
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
