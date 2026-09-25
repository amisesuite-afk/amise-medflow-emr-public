import SwiftUI
import SwiftData

struct PrescriptionView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) var context
    @State var showAddSheet = false
    @State var radiationExpanded = false
    @State var dosingExpanded = false
    /// Accessibility text sizes stack the dosing guide header and rows vertically.
    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    var interactions: [DrugInteractionAlert] {
        let names = patient.prescriptions.map { $0.drug }
        return DrugInteractionService.check(drugs: names)
    }

    private var radiationPlan: DiagnosisRadiation? {
        DiagnosisRadiationEngine.radiate(for: patient)
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            List {
                // Shown whenever two or more drugs were screened, so an empty result carries the
                // "absence of an alert does not mean there is no interaction" note (H-07).
                let alerts = interactions
                if !alerts.isEmpty || patient.prescriptions.count >= 2 {
                    interactionsSection(alerts)
                }

                if let plan = radiationPlan {
                    radiationPlanSection(plan)
                }

                if let dx = patient.workingDiagnosis {
                    let dosing = DiagnosisDosingGuide.lookup(diagnosis: dx)
                    if !dosing.isEmpty {
                        let labs = LabPanel.parse(from: patient.investigations)
                        dosingGuideSection(entries: dosing, dx: dx, labs: labs)
                    }
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
                    .accessibilityLabel("Share medication list")
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
                .accessibilityLabel("Add prescription")
                .accessibilityIdentifier("rx.add")
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
        lines.append("Prescribed by: \(PracticeProfile.current.clinicianName)")
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
        let allergyList = patient.recordedAllergies
        if allergyList.isEmpty {
            lines.append("Allergies: \(patient.noAllergyStatusText)")
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
                        .scaledFont(size: 13, weight: .semibold)
                        .foregroundStyle(.teal)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Suggested Management")
                            .scaledFont(size: 12, weight: .bold)
                            .foregroundStyle(.teal)
                        Text(plan.conditionName)
                            .scaledFont(size: 11)
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                    Spacer()
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { radiationExpanded.toggle() }
                    } label: {
                        Image(systemName: radiationExpanded ? "chevron.up" : "chevron.down")
                            .scaledFont(size: 11)
                            .foregroundStyle(.secondary)
                            .expandedHitArea(horizontal: 14, vertical: 14)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(radiationExpanded ? "Show less of the plan" : "Show the full plan")
                }

                if !plan.planTemplate.isEmpty {
                    if radiationExpanded {
                        Text(plan.planTemplate)
                            .scaledFont(size: 11)
                            .foregroundStyle(.secondary)
                    } else {
                        Text(plan.planTemplate)
                            .scaledFont(size: 11)
                            .foregroundStyle(.secondary)
                            .lineLimit(dynamicTypeSize.isAccessibilitySize ? 6 : 3)
                    }
                }

                if !plan.redFlags.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(plan.redFlags.prefix(2), id: \.self) { flag in
                            HStack(alignment: .top, spacing: 5) {
                                Image(systemName: "flag.fill")
                                    .scaledFont(size: 8)
                                    .foregroundStyle(.red)
                                    .padding(.top, 2)
                                    .accessibilityHidden(true)
                                Text(flag)
                                    .scaledFont(size: 10)
                                    .foregroundStyle(.red.opacity(0.8))
                            }
                            .accessibilityElement(children: .combine)
                            .accessibilityLabel(Text("Red flag: \(flag)"))
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

}
