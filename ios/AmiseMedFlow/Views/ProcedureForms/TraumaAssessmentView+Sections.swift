// TraumaAssessmentView+Sections.swift
// ISS, secondary survey, burns, and helper sections for TraumaAssessmentView.



extension TraumaAssessmentView {

    // MARK: ISS

    var issSection: some View {
        Group {
            HStack(spacing: 20) {
                issBadge("ISS", score: data.iss)
                issBadge("NISS", score: data.niss)
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(issCategory(data.iss))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(issColor(data.iss))
                    if data.iss == 75 {
                        Text("Unsurvivable").font(.caption2).foregroundStyle(.red)
                    }
                }
            }
            .padding(.vertical, 4)
            .listRowBackground(Color.secondary.opacity(0.05))

            aisRow("Head & Neck", value: $data.aisHead)
            aisRow("Face", value: $data.aisFace)
            aisRow("Chest", value: $data.aisChest)
            aisRow("Abdomen & Pelvis", value: $data.aisAbdomen)
            aisRow("Extremities & Pelvis", value: $data.aisExtremities)
            aisRow("External / Skin", value: $data.aisSkinSurface)
        }
    }

    // MARK: Secondary Survey

    var secondarySection: some View {
        Group {
            ForEach(secondaryRegions, id: \.self) { region in
                TextField(region, text: Binding(
                    get: { data.secondarySurveyNotes[region] ?? "" },
                    set: { data.secondarySurveyNotes[region] = $0.isEmpty ? nil : $0; save() }
                ), axis: .vertical)
                .lineLimit(1...)
            }
        }
    }

    // MARK: Burns

    var burnsSection: some View {
        Group {
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TBSA").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                    Text(String(format: "%.1f%%", data.tbsa))
                        .font(.system(size: 22, weight: .heavy))
                        .foregroundStyle(data.tbsa > 20 ? .red : data.tbsa > 10 ? .orange : .primary)
                }
                if let parkland = data.parklandVolume {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Parkland (24h)").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                        Text(String(format: "%.0f mL", parkland))
                            .font(.system(size: 18, weight: .semibold)).foregroundStyle(.blue)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("First 8h").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                        Text(String(format: "%.0f mL", parkland / 2))
                            .font(.system(size: 14)).foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.vertical, 4)
            .listRowBackground(Color.orange.opacity(0.06))

            HStack {
                TextField("Weight (kg)", text: $data.weightKg)
                    .keyboardType(.decimalPad)
                    .onChange(of: data.weightKg) { _, _ in save() }
                Text("kg").foregroundStyle(.secondary)
            }

            Text("Rule of Nines — tap region to toggle")
                .font(.caption).foregroundStyle(.secondary)

            ForEach(burnRegionKeys.keys.sorted(), id: \.self) { region in
                let maxPct = burnRegionKeys[region] ?? 9.0
                HStack {
                    Text(region).frame(width: 140, alignment: .leading)
                    Slider(value: Binding(
                        get: { data.burnRegions[region] ?? 0 },
                        set: { data.burnRegions[region] = $0; save() }
                    ), in: 0...maxPct, step: 0.5)
                    Text(String(format: "%.1f%%", data.burnRegions[region] ?? 0))
                        .font(.system(size: 12, weight: .semibold))
                        .frame(width: 44, alignment: .trailing)
                        .foregroundStyle((data.burnRegions[region] ?? 0) > 0 ? .orange : .secondary)
                }
            }

            Toggle("Inhalation injury", isOn: $data.inhalationInjury)
                .onChange(of: data.inhalationInjury) { _, _ in save() }

            if patient.ageYears > 0 {
                let baux = Double(patient.ageYears) + data.tbsa + (data.inhalationInjury ? 17 : 0)
                LabeledContent("Revised Baux Score") {
                    Text(String(format: "%.0f", baux))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(baux > 120 ? .red : baux > 80 ? .orange : .primary)
                }
            }

            TextField("Burns notes", text: $data.burnsNotes, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.burnsNotes) { _, _ in save() }
        }
    }

    // MARK: Helpers

    func save() {
        patient.traumaData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    func collapsibleSection<Content: View>(_ title: String, icon: String, key: String, @ViewBuilder content: () -> Content) -> some View {
        Section {
            if expandedSection == key {
                content()
            }
        } header: {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    expandedSection = expandedSection == key ? nil : key
                }
            } label: {
                HStack {
                    Image(systemName: icon).font(.system(size: 11))
                    Text(title).font(.system(size: 12, weight: .semibold))
                    Spacer()
                    Image(systemName: expandedSection == key ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
                .foregroundStyle(expandedSection == key ? AMColor.accent : .primary)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    func multiSelectRow(_ label: String, options: [String], selected: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 12)).foregroundStyle(.secondary)
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

    @ViewBuilder
    func vitalRow(_ label: String, value: Binding<String>, keyboard: UIKeyboardType = .numberPad) -> some View {
        HStack {
            Text(label).layoutPriority(1)
            Spacer()
            TextField("—", text: value)
                .keyboardType(keyboard)
                .multilineTextAlignment(.trailing)
                .frame(width: 80)
                .onChange(of: value.wrappedValue) { _, _ in save() }
        }
    }

    @ViewBuilder
    func vitalField(_ placeholder: String, value: Binding<String>) -> some View {
        TextField(placeholder, text: value)
            .keyboardType(.numberPad)
            .frame(width: 50)
            .multilineTextAlignment(.center)
            .onChange(of: value.wrappedValue) { _, _ in save() }
    }

    @ViewBuilder
    func gcsPicker(_ label: String, selection: Binding<String>, max: Int) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.system(size: 9)).foregroundStyle(.secondary)
            Picker("", selection: selection) {
                ForEach(1...max, id: \.self) { n in Text("\(n)").tag("\(n)") }
            }
            .pickerStyle(.wheel)
            .frame(height: 80)
            .clipped()
            .onChange(of: selection.wrappedValue) { _, _ in save() }
        }
    }

    @ViewBuilder
    func aisRow(_ region: String, value: Binding<Int>) -> some View {
        HStack {
            Text(region)
            Spacer()
            Picker("AIS", selection: value) {
                ForEach(aisOptions, id: \.self) { n in
                    Text("\(n)").tag(n)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 220)
            .onChange(of: value.wrappedValue) { _, _ in save() }
        }
    }

    func issBadge(_ label: String, score: Int) -> some View {
        VStack(spacing: 1) {
            Text(label).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
            Text("\(score)")
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(issColor(score))
        }
    }

    func issColor(_ score: Int) -> Color {
        switch score {
        case 0...15: return .green
        case 16...24: return .orange
        default: return .red
        }
    }

    func issCategory(_ score: Int) -> String {
        switch score {
        case 0: return "No injury"
        case 1...8: return "Minor"
        case 9...15: return "Moderate"
        case 16...24: return "Serious"
        case 25...40: return "Severe"
        case 41...74: return "Critical"
        default: return "Unsurvivable"
        }
    }

    func gcsColor(_ score: Int) -> Color {
        switch score {
        case 13...15: return .green
        case 9...12: return .orange
        default: return .red
        }
    }

}
