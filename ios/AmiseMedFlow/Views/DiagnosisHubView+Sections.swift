// DiagnosisHubView+Sections.swift
// Clinical reasoning card, action sheet, and photo processing
// sections for DiagnosisHubView.

import SwiftUI
import PhotosUI
import UIKit


extension DiagnosisHubView {

    // MARK: - Clinical reasoning card

    @ViewBuilder
    func reasoningCard(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "brain")
                    .font(.system(size: 13))
                    .foregroundStyle(.teal)
                Text("Clinical Narrative")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(.secondary)
                    .tracking(0.5)
                Spacer()
                Button("Expand") { showReasoning = true }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
            }
            Text(text)
                .font(.system(size: 13))
                .lineLimit(6)
                .foregroundStyle(.primary)
        }
        .padding(14)
        .background(Color.teal.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.teal.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Actions

    func draftPlan() async {
        guard patient.workingDiagnosis != nil else { return }
        isDraftingPlan = true
        defer { isDraftingPlan = false }
        let draft = SOAPDraftEngine.draft(patient: patient)
        let planText = draft.p.isEmpty ? draft.a : draft.p
        if !planText.isEmpty {
            patient.managementPlan = planText
            patient.updatedAt = .now
            patient.pendingSync = true
            planDrafted = true
        } else {
            aiErrorMessage = "Insufficient clinical data to generate a plan. Please complete the examination and assessment first."
            showAIError = true
        }
    }

    func generateReasoning() async {
        isGeneratingReasoning = true
        defer { isGeneratingReasoning = false }
        let text = SOAPDraftEngine.narrativeSummary(patient: patient)
        if text.isEmpty || text == "Clinical summary to be completed." {
            aiErrorMessage = "Insufficient clinical data to generate a narrative. Please complete the consultation first."
            showAIError = true
        } else {
            clinicalReasoning = text
            showReasoning = true
        }
    }

    // MARK: - Photo processing

    func processPickedPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        await parseImageData(data)
    }

    func processUIImage(_ image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.85) else { return }
        await parseImageData(data)
    }

    @MainActor
    func parseImageData(_ data: Data) async {
        isParsingImage = true
        defer { isParsingImage = false }
        // AIService disabled pending HIPAA BAA. Present a blank editable result
        // so the clinician can enter values manually after capturing the image.
        parsedResult = ParsedResult(
            testName: "Lab / Imaging Result",
            category: "Other",
            results: "(Image captured — please enter result values below)",
            abnormal: [],
            urgent: false,
            summary: "AI image analysis is unavailable. Please enter the result details manually."
        )
        showResultConfirm = true
    }

    func addParsedResult(_ parsed: ParsedResult) {
        let category: InvestigationEntry.InvCategory = {
            switch parsed.category.lowercased() {
            case let s where s.contains("blood"): return .blood
            case let s where s.contains("imaging"): return .imaging
            case let s where s.contains("radiol"): return .imaging
            case let s where s.contains("pathol"): return .pathology
            case let s where s.contains("endosc"): return .endoscopy
            default: return .other
            }
        }()
        var entry = InvestigationEntry(
            name: parsed.testName,
            category: category,
            status: .resulted
        )
        entry.result = parsed.results
        entry.resultedAt = Date()
        entry.suggestedFor = patient.workingDiagnosis ?? ""

        var invs = patient.investigations
        invs.append(entry)
        patient.investigations = invs
        patient.updatedAt = .now
        patient.pendingSync = true
    }

}
