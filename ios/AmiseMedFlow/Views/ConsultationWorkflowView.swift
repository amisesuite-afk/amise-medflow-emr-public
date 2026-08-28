import SwiftUI

// MARK: - Consultation Workflow View
// A step-by-step progress guide for the consultation workflow.
// Shows completion status of each stage and deep-links into the relevant view.

struct ConsultationWorkflowView: View {
    @Bindable var patient: Patient
    var onNavigate: ((PatientDetailSection) -> Void)? = nil

    private enum Stage: Int, CaseIterable {
        case intake, history, examination, investigations, assessment, plan

        var title: String {
            switch self {
            case .intake:         return "Intake"
            case .history:        return "History"
            case .examination:    return "Examination"
            case .investigations: return "Investigations"
            case .assessment:     return "Assessment"
            case .plan:           return "Plan & Notes"
            }
        }

        var icon: String {
            switch self {
            case .intake:         return "person.fill.badge.plus"
            case .history:        return "text.bubble.fill"
            case .examination:    return "stethoscope"
            case .investigations: return "flask"
            case .assessment:     return "doc.text.magnifyingglass"
            case .plan:           return "list.bullet.clipboard"
            }
        }

        var detail: String {
            switch self {
            case .intake:         return "Demographics, phone, allergies, NOK"
            case .history:        return "Chief complaint, HPI, PMH, social history"
            case .examination:    return "General, CVS, respiratory, abdominal findings"
            case .investigations: return "Ordered tests and awaited results"
            case .assessment:     return "Working diagnosis and ICD code"
            case .plan:           return "Management plan and signed note"
            }
        }

        var destination: PatientDetailSection {
            switch self {
            case .intake:         return .demographics
            case .history:        return .hpi
            case .examination:    return .exam
            case .investigations: return .investigations
            case .assessment:     return .assessment
            case .plan:           return .notes
            }
        }
    }

    private func isComplete(_ stage: Stage) -> Bool {
        switch stage {
        case .intake:
            return !(patient.chiefComplaint ?? "").isEmpty &&
                   patient.dateOfBirth != nil &&
                   !(patient.phone ?? "").isEmpty &&
                   !(patient.nokName ?? "").isEmpty
        case .history:
            return !(patient.hpi ?? "").isEmpty && !(patient.pmhNotes ?? "").isEmpty
        case .examination:
            let filled = [patient.examGeneral, patient.examCVS, patient.examResp, patient.examAbdo, patient.examNeuro]
            return filled.compactMap({ $0 }).contains { !$0.isEmpty }
        case .investigations:
            return !patient.investigations.isEmpty
        case .assessment:
            return patient.workingDiagnosis != nil
        case .plan:
            return !(patient.managementPlan ?? "").isEmpty ||
                   patient.clinicalNotes.contains { $0.status == .signed && !$0.isEmpty }
        }
    }

    private var completedCount: Int { Stage.allCases.filter { isComplete($0) }.count }
    private var total: Int { Stage.allCases.count }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("\(completedCount) of \(total) stages complete")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(completedCount == total ? .green : AMColor.accent)
                        Spacer()
                        Text("\(Int(Double(completedCount) / Double(total) * 100))%")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundStyle(completedCount == total ? .green : AMColor.accent)
                    }
                    ProgressView(value: Double(completedCount), total: Double(total))
                        .tint(completedCount == total ? .green : AMColor.accent)
                }
                .padding(.vertical, 4)
            }

            Section("Consultation Steps") {
                ForEach(Stage.allCases, id: \.rawValue) { stage in
                    stageRow(stage)
                }
            }

            if completedCount < total {
                Section {
                    nextActionRow
                }
            }
        }
        .navigationTitle("Consultation Workflow")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func stageRow(_ stage: Stage) -> some View {
        let done = isComplete(stage)
        let content = HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(done ? Color.green.opacity(0.15) : Color.secondary.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: done ? "checkmark" : stage.icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(done ? .green : .secondary)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(stage.title)
                        .font(.system(size: 14, weight: .semibold))
                    if done {
                        Text("Done")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.green)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.green.opacity(0.12), in: Capsule())
                    } else if stage.rawValue == nextIncompleteStage?.rawValue {
                        Text("Next")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(AMColor.accent)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(AMColor.accent.opacity(0.12), in: Capsule())
                    }
                }
                Text(stage.detail)
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
            Spacer()
            if onNavigate != nil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
        .opacity(done ? 1.0 : 0.85)

        if let navigate = onNavigate {
            Button { navigate(stage.destination) } label: { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var nextIncompleteStage: Stage? {
        Stage.allCases.first { !isComplete($0) }
    }

    @ViewBuilder
    private var nextActionRow: some View {
        if let next = nextIncompleteStage {
            VStack(alignment: .leading, spacing: 4) {
                Label("Next: \(next.title)", systemImage: next.icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AMColor.accent)
                Text(nextActionHint(next))
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
        }
    }

    private func nextActionHint(_ stage: Stage) -> String {
        switch stage {
        case .intake:
            return "Go to Demographics tab to complete patient details."
        case .history:
            return "Open Consultation → HPI tab to record the presenting history."
        case .examination:
            return "Open Consultation → Examination tab to document findings."
        case .investigations:
            return "Open Consultation → Investigations tab to order tests."
        case .assessment:
            return "Open Assessment tab to enter a working diagnosis."
        case .plan:
            return "Open Notes tab to create a plan or sign a clinical note."
        }
    }
}
