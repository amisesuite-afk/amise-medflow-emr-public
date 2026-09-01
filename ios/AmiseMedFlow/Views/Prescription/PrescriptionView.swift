import SwiftUI
import SwiftData

struct PrescriptionView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @State private var showAddSheet = false
    @State private var radiationExpanded = false

    private var interactions: [DrugInteractionAlert] {
        let names = patient.prescriptions.map { $0.drug }
        return DrugInteractionService.check(drugs: names)
    }

    private var radiationPlan: DiagnosisRadiation? {
        DiagnosisRadiationEngine.radiate(
            workingDiagnosis: patient.workingDiagnosis,
            ageYears: patient.ageYears,
            sex: patient.sex
        )
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            List {
                if !interactions.isEmpty {
                    interactionsSection
                }

                if let plan = radiationPlan {
                    radiationPlanSection(plan)
                }

                prescriptionsSection

                if let dx = patient.workingDiagnosis, radiationPlan == nil {
                    Section {
                        Label(dx, systemImage: "stethoscope")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } header: {
                        Text("Context: working diagnosis")
                    }
                }
            }
            .navigationTitle("Prescriptions")
            .navigationBarTitleDisplayMode(.inline)

            // FAB stack — share + add
            VStack(spacing: 12) {
                if !patient.prescriptions.isEmpty {
                    ShareLink(item: medicationListText,
                              subject: Text("Medication List — \(patient.fullName)")) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(AMColor.accent)
                            .frame(width: 44, height: 44)
                            .background(AMColor.accentLt, in: Circle())
                            .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
                    }
                    .buttonStyle(.plain)
                }

                Button { showAddSheet = true } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                        .background(AMColor.accent, in: Circle())
                        .shadow(color: AMColor.accent.opacity(0.4), radius: 8, y: 4)
                }
                .buttonStyle(.plain)
            }
            .padding(.trailing, 20)
            .padding(.bottom, 24)
        }
        .sheet(isPresented: $showAddSheet) {
            AddPrescriptionSheet(patient: patient)
        }
    }

    // MARK: - Medication list export

    private var medicationListText: String {
        let today = Date.now.formatted(date: .abbreviated, time: .shortened)
        var lines: [String] = []
        lines.append("MEDICATION LIST — \(today)")
        lines.append("Patient: \(patient.fullName) · \(patient.sex.rawValue.prefix(1)), \(patient.ageYears)y")
        if let mrn = patient.mrn, !mrn.isEmpty { lines.append("MRN: \(mrn)") }
        if let dx = patient.workingDiagnosis {
            let icd = patient.workingDiagnosisICD.map { " (\($0))" } ?? ""
            lines.append("Diagnosis: \(dx)\(icd)")
        }
        lines.append("Prescribed by: Dr Dawit Daniel Kabiye")
        lines.append(String(repeating: "─", count: 48))
        lines.append("")

        let sorted = patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }
        for (i, rx) in sorted.enumerated() {
            lines.append("\(i + 1). \(rx.drug)")
            var detail: [String] = []
            if !rx.dose.isEmpty { detail.append(rx.dose) }
            if !rx.route.isEmpty { detail.append(rx.route) }
            if !rx.frequency.isEmpty { detail.append(rx.frequency) }
            if !detail.isEmpty { lines.append("   \(detail.joined(separator: " · "))") }
            if !rx.duration.isEmpty { lines.append("   Duration: \(rx.duration)") }
            if !rx.indication.isEmpty { lines.append("   For: \(rx.indication)") }
            if let instr = rx.instructions, !instr.isEmpty { lines.append("   Note: \(instr)") }
        }

        lines.append("")
        lines.append(String(repeating: "─", count: 48))
        let allergyList = patient.allergies
        if allergyList.isEmpty {
            lines.append("Allergies: NKDA")
        } else {
            lines.append("Allergies: \(allergyList.map { "\($0.name) (\($0.reaction), \($0.severity))" }.joined(separator: "; "))")
        }
        lines.append("")
        lines.append("Total: \(sorted.count) medication\(sorted.count == 1 ? "" : "s")")
        lines.append("Verify all doses and indications before dispensing.")
        return lines.joined(separator: "\n")
    }

    // MARK: - Radiation plan suggestion

    @ViewBuilder
    private func radiationPlanSection(_ plan: DiagnosisRadiation) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.teal)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Suggested Management")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.teal)
                        Text(plan.conditionName)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { radiationExpanded.toggle() }
                    } label: {
                        Image(systemName: radiationExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }

                if !plan.planTemplate.isEmpty {
                    if radiationExpanded {
                        Text(plan.planTemplate)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    } else {
                        Text(plan.planTemplate)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                    }
                }

                if !plan.redFlags.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(plan.redFlags.prefix(2), id: \.self) { flag in
                            HStack(alignment: .top, spacing: 5) {
                                Image(systemName: "flag.fill")
                                    .font(.system(size: 8))
                                    .foregroundStyle(.red)
                                    .padding(.top, 2)
                                Text(flag)
                                    .font(.system(size: 10))
                                    .foregroundStyle(.red.opacity(0.8))
                            }
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        } header: {
            Label("Rx Guidance · \(plan.conditionName)", systemImage: "wand.and.stars")
                .foregroundStyle(.teal)
        } footer: {
            if let ref = plan.guidelineReference {
                Text(ref).font(.caption2).foregroundStyle(.tertiary)
            }
        }
    }

    // MARK: - Interaction alerts

    @ViewBuilder
    private var interactionsSection: some View {
        Section {
            ForEach(interactions) { alert in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: alert.interaction.severity.icon)
                            .foregroundStyle(alert.interaction.severity.color)
                        Text("\(alert.drugA) + \(alert.drugB)")
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(alert.interaction.severity.rawValue)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(alert.interaction.severity.color)
                    }
                    Text(alert.interaction.clinicalEffect)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(alert.interaction.management)
                        .font(.caption.italic())
                        .foregroundStyle(.orange)
                }
                .padding(.vertical, 2)
            }
        } header: {
            Label("Drug Interactions (\(interactions.count))", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
        }
    }

    // MARK: - Prescription list

    @ViewBuilder
    private var prescriptionsSection: some View {
        Section {
            if patient.prescriptions.isEmpty {
                ContentUnavailableView(
                    "No prescriptions",
                    systemImage: "pills",
                    description: Text("Tap + to add a prescription")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }) { rx in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(rx.drug).font(.subheadline.weight(.semibold))
                        Text(rx.displayLine).font(.caption).foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            if !rx.duration.isEmpty {
                                Label(rx.duration, systemImage: "clock")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                            if !rx.indication.isEmpty {
                                Text("For: \(rx.indication)").font(.caption2).foregroundStyle(.tertiary)
                            }
                        }
                        if let instr = rx.instructions, !instr.isEmpty {
                            Text(instr).font(.caption2.italic()).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
                .onDelete { indexSet in
                    let sorted = patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }
                    indexSet.forEach { context.delete(sorted[$0]) }
                    patient.updatedAt = .now
                    patient.pendingSync = true
                }
            }
        } header: {
            Text("Current Prescriptions")
        }
    }
}

// MARK: - Add Prescription Sheet

struct AddPrescriptionSheet: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var drugQuery = ""
    @State private var drugSuggestions: [SurgicalDrug] = []
    @State private var selectedDrug: SurgicalDrug?
    @State private var dose = ""
    @State private var route = "Oral"
    @State private var frequency = ""
    @State private var duration = ""
    @State private var indication = ""
    @State private var instructions = ""

    private let freqChips   = ["OD", "BD", "TDS", "QDS", "PRN", "STAT", "Nocte", "Weekly"]
    private let durationChips = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "Ongoing"]

    private var liveInteractions: [DrugInteractionAlert] {
        guard !drugQuery.isEmpty else { return [] }
        let existingDrugs = patient.prescriptions.map { $0.drug }
        return DrugInteractionService.check(drugs: existingDrugs + [drugQuery])
            .filter { $0.drugA == drugQuery || $0.drugB == drugQuery }
    }

    private var allergyMatches: [AllergyEntry] {
        guard drugQuery.count >= 3 else { return [] }
        let q = drugQuery.lowercased()
        return patient.allergies.filter { entry in
            let n = entry.name.lowercased()
            return n.contains(q) || q.contains(n)
        }
    }

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
        NavigationStack {
            Form {
                Section("Drug") {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Image(systemName: "pills").foregroundStyle(.secondary)
                            TextField("Search drug name", text: $drugQuery)
                                .autocorrectionDisabled()
                                .onChange(of: drugQuery) { _, q in
                                    drugSuggestions = q.count >= 2 ? ClinicalSearchService.searchDrugs(q) : []
                                    selectedDrug = nil
                                }
                        }

                        if !drugSuggestions.isEmpty {
                            Divider().padding(.top, 6)
                            ForEach(drugSuggestions.prefix(5)) { drug in
                                Button {
                                    drugQuery = drug.name
                                    selectedDrug = drug
                                    if dose.isEmpty && !drug.commonDoses.isEmpty { dose = drug.commonDoses }
                                    route = drug.route
                                    drugSuggestions = []
                                    if indication.isEmpty { indication = patient.workingDiagnosis ?? "" }
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(drug.name).font(.subheadline).foregroundStyle(.primary)
                                            Text(drug.category).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if !drug.commonDoses.isEmpty {
                                            Text(drug.commonDoses).font(.caption2).foregroundStyle(.tertiary)
                                        }
                                    }
                                }
                                .padding(.vertical, 4)
                                Divider()
                            }
                        }
                    }

                    if let drug = selectedDrug, !drug.commonDoses.isEmpty {
                        Button(drug.commonDoses) { dose = drug.commonDoses }
                            .font(.caption)
                            .buttonStyle(.bordered)
                            .tint(dose == drug.commonDoses ? .teal : .secondary)
                    }
                }

                if !allergyMatches.isEmpty {
                    Section {
                        ForEach(allergyMatches) { entry in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "exclamationmark.shield.fill")
                                    .foregroundStyle(.red)
                                    .font(.system(size: 14))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("ALLERGY: \(entry.name)")
                                        .font(.subheadline.weight(.bold))
                                        .foregroundStyle(.red)
                                    Text("\(entry.reaction) — \(entry.severity)")
                                        .font(.caption)
                                        .foregroundStyle(.red.opacity(0.8))
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    } header: {
                        Label("Allergy Alert", systemImage: "exclamationmark.shield.fill")
                            .foregroundStyle(.red)
                    }
                }

                if !liveInteractions.isEmpty {
                    Section {
                        ForEach(liveInteractions) { alert in
                            HStack(spacing: 6) {
                                Image(systemName: alert.interaction.severity.icon)
                                    .foregroundStyle(alert.interaction.severity.color)
                                Text(alert.interaction.clinicalEffect)
                                    .font(.caption)
                            }
                        }
                    } header: {
                        Label("Interaction Warning", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    }
                }

                Section("Dosing") {
                    TextField("Dose (e.g. 500 mg)", text: $dose)
                    Picker("Route", selection: $route) {
                        ForEach(["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "PR", "SL"], id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                    TextField("Frequency", text: $frequency)
                    quickChips(freqChips, current: frequency) { frequency = $0 }
                    TextField("Duration", text: $duration)
                    quickChips(durationChips, current: duration) { duration = $0 }
                }

                Section("Clinical") {
                    TextField("Indication", text: $indication)
                    TextField("Special instructions", text: $instructions, axis: .vertical)
                        .lineLimit(2...)
                }
            }
            .navigationTitle("Add Prescription")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled(drugQuery.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() {
        let rx = Prescription(
            drug: drugQuery.trimmingCharacters(in: .whitespaces),
            dose: dose,
            route: route,
            frequency: frequency,
            duration: duration,
            indication: indication
        )
        rx.instructions = instructions.isEmpty ? nil : instructions
        rx.patient = patient
        context.insert(rx)
        patient.updatedAt = .now
        patient.pendingSync = true
        dismiss()
    }
}
