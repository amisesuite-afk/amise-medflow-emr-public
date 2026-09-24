// BurnsAssessmentView.swift
// Burns pathway: TBSA by region (paediatric-adjusted rule of nines), depth, special areas,
// modified Parkland estimate and burns-unit referral criteria.
// Calculations are estimates for the clinician to verify. Nothing is prescribed.

import SwiftUI
import SwiftData

struct BurnsAssessmentView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @State private var data = BurnsAssessment()
    @State private var loaded = false
    @State private var addedToExam = false

    private var age: Int? { patient.dateOfBirth == nil ? nil : patient.ageYears }

    var body: some View {
        Form {
            summarySection
            circumstancesSection
            regionsSection
            featuresSection
            fluidsSection
            referralSection
            notesSection
        }
        .onAppear(perform: load)
    }

    // MARK: - Sections

    private var summarySection: some View {
        Section {
            HStack(spacing: 16) {
                metric("TBSA", String(format: "%.1f%%", data.tbsa(ageYears: age)),
                       color: data.tbsa(ageYears: age) > 15 ? .red : data.tbsa(ageYears: age) > 10 ? .orange : .primary)
                metric("Full thickness", String(format: "%.0f%%", data.fullThicknessPct), color: .primary)
                if let a = age {
                    metric("Rev. Baux", String(format: "%.0f", Double(a) + data.tbsa(ageYears: age) + (data.inhalation ? 17 : 0)),
                           color: .secondary)
                }
            }
            if age.map({ $0 < 10 }) == true {
                Label("Child: head and leg proportions adjusted for age (Lund–Browder chart preferred).",
                      systemImage: "figure.and.child.holdinghands")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if age == nil {
                Label("No DOB — adult proportions used.", systemImage: "calendar.badge.exclamationmark")
                    .font(.caption).foregroundStyle(.orange)
            }
        }
    }

    private var circumstancesSection: some View {
        Section("Circumstances") {
            Picker("Mechanism", selection: binding(\.mechanism)) {
                Text("Not set").tag("")
                ForEach(BurnsAssessment.mechanisms, id: \.self) { Text($0).tag($0) }
            }
            Toggle("Time of burn known", isOn: Binding(
                get: { data.timeOfBurn != nil },
                set: { data.timeOfBurn = $0 ? (data.timeOfBurn ?? .now) : nil; save() }))
            if data.timeOfBurn != nil {
                DatePicker("Time of burn", selection: Binding(
                    get: { data.timeOfBurn ?? .now },
                    set: { data.timeOfBurn = $0; save() }))
            }
            HStack {
                Text("Weight")
                Spacer()
                TextField("kg", value: Binding(
                    get: { data.weightKg },
                    set: { data.weightKg = $0; save() }), format: .number)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
                Text("kg").foregroundStyle(.secondary)
            }
            Picker("Predominant depth", selection: binding(\.depth)) {
                Text("Not set").tag("")
                ForEach(BurnsAssessment.depths, id: \.self) { Text($0).tag($0) }
            }
        }
    }

    private var regionsSection: some View {
        Section {
            ForEach(BurnsAssessment.regions, id: \.self) { region in
                let pct = BurnsAssessment.regionPercent(region, ageYears: age)
                let fraction = data.regionFractions[region] ?? 0
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(region).font(.subheadline)
                        Spacer()
                        Text(String(format: "%.0f%% of %.1f%%", fraction * 100, pct))
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(fraction > 0 ? .orange : .secondary)
                    }
                    Slider(value: Binding(
                        get: { data.regionFractions[region] ?? 0 },
                        set: { data.regionFractions[region] = ($0 * 20).rounded() / 20; save() }), in: 0...1)
                        .tint(.orange)
                }
            }
            Stepper(String(format: "Full thickness: %.0f%% TBSA", data.fullThicknessPct),
                    value: Binding(get: { data.fullThicknessPct },
                                   set: { data.fullThicknessPct = max(0, $0); save() }),
                    in: 0...100, step: 1)
        } header: {
            Text("Area burned by region")
        } footer: {
            Text("Slide to the fraction of each region burned. Do not count simple erythema.")
        }
    }

    private var featuresSection: some View {
        Section("Features") {
            ForEach(BurnsAssessment.specialAreaOptions, id: \.self) { area in
                Toggle(area, isOn: Binding(
                    get: { data.specialAreas.contains(area) },
                    set: { on in
                        if on { if !data.specialAreas.contains(area) { data.specialAreas.append(area) } }
                        else { data.specialAreas.removeAll { $0 == area } }
                        save()
                    }))
            }
            Toggle("Circumferential", isOn: binding(\.circumferential))
            Toggle("Inhalation injury suspected", isOn: binding(\.inhalation))
            Toggle("Non-accidental injury concern", isOn: binding(\.nonAccidentalConcern))
            Toggle("Significant comorbidity or pregnancy", isOn: binding(\.comorbidityOrPregnancy))
        }
    }

    @ViewBuilder
    private var fluidsSection: some View {
        Section {
            if let total = data.parkland24h(ageYears: age) {
                let needs = data.needsFluidResuscitation(ageYears: age)
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        metric("24 h total", String(format: "%.0f mL", total), color: needs ? .red : .secondary)
                        metric("First 8 h", String(format: "%.0f mL", total / 2), color: .primary)
                        metric("Next 16 h", String(format: "%.0f mL", total / 2), color: .primary)
                    }
                    if let tob = data.timeOfBurn {
                        let elapsed = max(0, Date.now.timeIntervalSince(tob) / 3600)
                        Text(String(format: "%.1f h since burn — the first-8 h volume is timed from the burn, not from arrival.", elapsed))
                            .font(.caption).foregroundStyle(elapsed >= 8 ? .red : .secondary)
                    }
                    Text(needs
                         ? "Above formal resuscitation threshold (>15% adult, >10% child)."
                         : "Below formal resuscitation threshold (>15% adult, >10% child) — oral fluids may suffice.")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(needs ? .red : .secondary)
                }
            } else {
                Text("Enter weight and burned area for a fluid estimate.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        } header: {
            Text("Fluids — modified Parkland (estimate)")
        } footer: {
            Text("4 mL × kg × %TBSA crystalloid over 24 h. Clinician to verify; titrate to urine output (adult 0.5 mL/kg/h, child 1 mL/kg/h). Children also need maintenance fluids.")
        }
    }

    private var referralSection: some View {
        let criteria = data.referralCriteria(ageYears: age)
        return Section {
            if criteria.isEmpty {
                Label("No burns-unit referral criteria met so far.", systemImage: "checkmark.circle")
                    .font(.subheadline).foregroundStyle(.green)
            } else {
                Label("Discuss with burns unit", systemImage: "phone.arrow.up.right")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.red)
                ForEach(criteria, id: \.self) { c in
                    Text("• \(c)").font(.caption)
                }
            }
        } header: {
            Text("Referral criteria")
        }
    }

    private var notesSection: some View {
        Section {
            TextField("Notes (first aid given, tetanus status, dressings)", text: binding(\.notes), axis: .vertical)
                .lineLimit(2...6)
            Button {
                let summary = data.summary(ageYears: age)
                let existing = patient.examOther ?? ""
                patient.examOther = existing.isEmpty ? summary : existing + "\n\n" + summary
                patient.updatedAt = .now
                patient.pendingSync = true
                try? context.save()
                addedToExam = true
            } label: {
                Label(addedToExam ? "Added to examination" : "Add burns summary to examination",
                      systemImage: addedToExam ? "checkmark.circle.fill" : "text.badge.plus")
            }
            .disabled(data.tbsa(ageYears: age) == 0 && data.mechanism.isEmpty)
        }
    }

    // MARK: - Helpers

    private func metric(_ label: String, _ value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
            Text(value).font(.system(size: 18, weight: .bold).monospacedDigit()).foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func binding<T>(_ keyPath: WritableKeyPath<BurnsAssessment, T>) -> Binding<T> {
        Binding(get: { data[keyPath: keyPath] },
                set: { data[keyPath: keyPath] = $0; save() })
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        data = patient.pathwayData.burns
        if data.weightKg == nil {
            data.weightKg = patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }
                .first(where: { $0.weightKg != nil })?.weightKg
        }
    }

    private func save() {
        var all = patient.pathwayData
        all.burns = data
        patient.pathwayData = all
    }
}
