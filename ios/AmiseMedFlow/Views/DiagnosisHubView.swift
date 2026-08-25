import SwiftUI
import PhotosUI
import UIKit

// MARK: - Diagnosis Hub
// Central command-centre view shown in Overview section.
// Working diagnosis radiates outward to Investigations, Prescriptions,
// Management Plan, and Notes — each with live status counts and quick actions.

struct DiagnosisHubView: View {
    @Bindable var patient: Patient
    var onNavigate: ((PatientDetailSection) -> Void)?

    @StateObject private var ai = AIService()
    @Environment(\.modelContext) private var context

    // Photo / camera state
    @State private var photoPickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var capturedImage: UIImage?
    @State private var isParsingImage = false
    @State private var parsedResult: ParsedResult?
    @State private var showResultConfirm = false
    @State private var showAIError = false

    // Plan draft
    @State private var isDraftingPlan = false
    @State private var planDrafted = false

    // Clinical reasoning
    @State private var isGeneratingReasoning = false
    @State private var clinicalReasoning: String?
    @State private var showReasoning = false

    // MARK: - Computed helpers

    private var investigations: [InvestigationEntry] {
        patient.investigations
    }
    private var pendingInvs: Int {
        investigations.filter { $0.status == .ordered || $0.status == .pending }.count
    }
    private var resultedInvs: Int {
        investigations.filter { $0.status == .resulted }.count
    }
    private var activeRx: Int { patient.prescriptions.count }
    private var hasPlan: Bool { !(patient.managementPlan ?? "").isEmpty }
    private var signedNotes: Int {
        patient.clinicalNotes.filter { $0.status == .signed }.count
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                diagnosisCard
                domainGrid
                resultUploadCard
                if let reasoning = clinicalReasoning {
                    reasoningCard(reasoning)
                }
            }
            .padding(16)
        }
        .background(AMColor.bg)
        // Photo picker change handler
        .onChange(of: photoPickerItem) { _, item in
            guard let item else { return }
            Task { await processPickedPhoto(item) }
        }
        // Camera sheet
        .sheet(isPresented: $showCamera) {
            CameraCapture { image in
                showCamera = false
                if let image {
                    Task { await processUIImage(image) }
                }
            }
        }
        // Confirm parsed result
        .sheet(isPresented: $showResultConfirm) {
            if let parsed = parsedResult {
                ParsedResultConfirmView(parsed: parsed, patient: patient) {
                    addParsedResult(parsed)
                    showResultConfirm = false
                } onCancel: {
                    showResultConfirm = false
                }
            }
        }
        // Clinical reasoning sheet
        .sheet(isPresented: $showReasoning) {
            if let text = clinicalReasoning {
                NavigationStack {
                    ScrollView {
                        Text(text)
                            .font(.system(size: 14))
                            .padding(20)
                    }
                    .navigationTitle("Clinical Reasoning")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") { showReasoning = false }
                        }
                    }
                }
            }
        }
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(ai.error ?? "Unknown error")
        }
    }

    // MARK: - Diagnosis card (central hub)

    private var diagnosisCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "stethoscope")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.teal)
                Text("Working Diagnosis")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(.secondary)
                    .tracking(0.5)
                Spacer()
                Button {
                    onNavigate?(.assessment)
                } label: {
                    Text("Edit")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AMColor.accent)
                }
            }

            if let dx = patient.workingDiagnosis {
                VStack(alignment: .leading, spacing: 4) {
                    Text(dx)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.primary)
                    if let icd = patient.workingDiagnosisICD {
                        Text(icd)
                            .font(.system(size: 11).monospaced())
                            .foregroundStyle(.secondary)
                    }
                }

                // Radiation indicator
                HStack(spacing: 6) {
                    Image(systemName: "arrow.triangle.branch")
                        .font(.system(size: 10))
                        .foregroundStyle(.teal)
                    Text("Radiates to: Plan · Prescriptions · Investigations · Billing")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Divider()

                // Action buttons
                HStack(spacing: 10) {
                    // Auto-draft plan
                    Button {
                        Task { await draftPlan() }
                    } label: {
                        HStack(spacing: 4) {
                            if isDraftingPlan {
                                ProgressView().scaleEffect(0.7)
                            } else {
                                Image(systemName: planDrafted ? "checkmark.circle.fill" : "sparkles")
                            }
                            Text(planDrafted ? "Plan Drafted" : "Draft Plan")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(planDrafted ? .green : .purple)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(
                            (planDrafted ? Color.green : Color.purple).opacity(0.1),
                            in: Capsule()
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(isDraftingPlan)

                    // Clinical reasoning
                    Button {
                        Task { await generateReasoning() }
                    } label: {
                        HStack(spacing: 4) {
                            if isGeneratingReasoning {
                                ProgressView().scaleEffect(0.7)
                            } else {
                                Image(systemName: "brain")
                            }
                            Text("Reasoning")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(.teal)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Color.teal.opacity(0.1), in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(isGeneratingReasoning)
                }
            } else {
                // No diagnosis yet — prompt
                VStack(spacing: 8) {
                    Text("No working diagnosis set")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button {
                        onNavigate?(.assessment)
                    } label: {
                        Label("Set Diagnosis", systemImage: "plus.circle")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(AMColor.accent)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(AMColor.accentLt.opacity(0.3), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            }
        }
        .padding(14)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.teal.opacity(0.25), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }

    // MARK: - 2x2 domain grid

    private var domainGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            domainCard(
                title: "Investigations",
                icon: "flask",
                color: .blue,
                line1: pendingInvs > 0 ? "\(pendingInvs) pending" : (resultedInvs > 0 ? "\(resultedInvs) resulted" : "None ordered"),
                line2: resultedInvs > 0 ? "\(resultedInvs) with results" : nil,
                dot: pendingInvs > 0 ? .orange : (resultedInvs > 0 ? .green : .secondary),
                destination: .investigations
            )
            domainCard(
                title: "Prescriptions",
                icon: "pills.fill",
                color: .green,
                line1: activeRx > 0 ? "\(activeRx) active" : "None active",
                line2: nil,
                dot: activeRx > 0 ? .green : .secondary,
                destination: .prescriptions
            )
            domainCard(
                title: "Management Plan",
                icon: "list.bullet.clipboard",
                color: .purple,
                line1: hasPlan ? "Plan recorded" : "Not drafted",
                line2: hasPlan ? nil : "Tap to draft with AI",
                dot: hasPlan ? .green : .orange,
                destination: .plan
            )
            domainCard(
                title: "Clinical Notes",
                icon: "note.text",
                color: .orange,
                line1: signedNotes > 0 ? "\(signedNotes) signed" : "No signed notes",
                line2: patient.clinicalNotes.isEmpty ? nil : "\(patient.clinicalNotes.count) total",
                dot: signedNotes > 0 ? .green : .secondary,
                destination: .notes
            )
        }
    }

    @ViewBuilder
    private func domainCard(
        title: String,
        icon: String,
        color: Color,
        line1: String,
        line2: String?,
        dot: Color,
        destination: PatientDetailSection
    ) -> some View {
        Button { onNavigate?(destination) } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(color)
                    Text(title)
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(.secondary)
                        .tracking(0.3)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
                HStack(spacing: 5) {
                    Circle()
                        .fill(dot)
                        .frame(width: 6, height: 6)
                    Text(line1)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.primary)
                }
                if let l2 = line2 {
                    Text(l2)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(color.opacity(0.15), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.03), radius: 3, y: 1)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Result upload card

    private var resultUploadCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "camera.viewfinder")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.indigo)
                Text("Upload Result")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(.secondary)
                    .tracking(0.5)
                Spacer()
                if isParsingImage {
                    HStack(spacing: 6) {
                        ProgressView().scaleEffect(0.8)
                        Text("Reading…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Text("Photograph a lab result, imaging report, or document — AI extracts values and adds to investigations.")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 10) {
                // Camera button
                Button {
                    showCamera = true
                } label: {
                    Label("Camera", systemImage: "camera.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.indigo)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Color.indigo.opacity(0.1), in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(isParsingImage)

                // Photo library picker
                PhotosPicker(selection: $photoPickerItem, matching: .images) {
                    Label("Photo Library", systemImage: "photo.on.rectangle")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.indigo)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Color.indigo.opacity(0.1), in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(isParsingImage)
            }
        }
        .padding(14)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.indigo.opacity(0.2), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.03), radius: 3, y: 1)
    }

    // MARK: - Clinical reasoning card

    @ViewBuilder
    private func reasoningCard(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "brain")
                    .font(.system(size: 13))
                    .foregroundStyle(.teal)
                Text("Clinical Reasoning")
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

    private func draftPlan() async {
        guard patient.workingDiagnosis != nil else { return }
        isDraftingPlan = true
        defer { isDraftingPlan = false }
        do {
            let plan = try await ai.draftDiagnosisPlan(patient: patient)
            patient.managementPlan = plan
            patient.updatedAt = .now
            patient.pendingSync = true
            planDrafted = true
        } catch {
            showAIError = true
        }
    }

    private func generateReasoning() async {
        isGeneratingReasoning = true
        defer { isGeneratingReasoning = false }
        do {
            let text = try await ai.generateClinicalReasoning(patient: patient)
            clinicalReasoning = text
            showReasoning = true
        } catch {
            showAIError = true
        }
    }

    // MARK: - Photo processing

    private func processPickedPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        await parseImageData(data)
    }

    private func processUIImage(_ image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.85) else { return }
        await parseImageData(data)
    }

    @MainActor
    private func parseImageData(_ data: Data) async {
        isParsingImage = true
        defer { isParsingImage = false }
        do {
            let raw = try await ai.analyseResultImage(data, patient: patient)
            // Try to parse JSON response
            if let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") {
                let jsonStr = String(raw[start...end])
                if let jsonData = jsonStr.data(using: .utf8),
                   let obj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                    let parsed = ParsedResult(
                        testName:  (obj["testName"] as? String)  ?? "Lab Result",
                        category:  (obj["category"] as? String)  ?? "Other",
                        results:   (obj["results"] as? String)   ?? raw,
                        abnormal:  (obj["abnormal"] as? [String]) ?? [],
                        urgent:    (obj["urgent"] as? Bool)       ?? false,
                        summary:   (obj["summary"] as? String)   ?? ""
                    )
                    parsedResult = parsed
                    showResultConfirm = true
                    return
                }
            }
            // Fallback — show raw text as result
            parsedResult = ParsedResult(
                testName: "Result",
                category: "Other",
                results: raw,
                abnormal: [],
                urgent: false,
                summary: ""
            )
            showResultConfirm = true
        } catch {
            showAIError = true
        }
    }

    private func addParsedResult(_ parsed: ParsedResult) {
        let category: InvestigationEntry.InvCategory = {
            switch parsed.category.lowercased() {
            case let s where s.contains("blood"): return .blood
            case let s where s.contains("imaging"), let s2 where s2.contains("radiol"): return .imaging
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

// MARK: - Parsed result model

struct ParsedResult {
    let testName: String
    let category: String
    let results: String
    let abnormal: [String]
    let urgent: Bool
    let summary: String
}

// MARK: - Confirm parsed result sheet

struct ParsedResultConfirmView: View {
    let parsed: ParsedResult
    let patient: Patient
    var onConfirm: () -> Void
    var onCancel: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section("Detected Test") {
                    LabeledContent("Test name", value: parsed.testName)
                    LabeledContent("Category", value: parsed.category)
                    if parsed.urgent {
                        Label("URGENT result — review immediately", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .font(.caption.weight(.semibold))
                    }
                }

                if !parsed.summary.isEmpty {
                    Section("Clinical Summary") {
                        Text(parsed.summary).font(.subheadline)
                    }
                }

                if !parsed.abnormal.isEmpty {
                    Section("Abnormal Values") {
                        ForEach(parsed.abnormal, id: \.self) { v in
                            Label(v, systemImage: "exclamationmark.circle")
                                .foregroundStyle(.orange)
                                .font(.caption)
                        }
                    }
                }

                Section("Extracted Results") {
                    Text(parsed.results)
                        .font(.system(size: 12).monospaced())
                        .foregroundStyle(.primary)
                }

                Section {
                    Text("Adding to \(patient.fullName)'s investigations as a Resulted entry.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Confirm Result")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add to Record") { onConfirm() }
                        .bold()
                }
            }
        }
    }
}

// MARK: - Camera capture wrapper

struct CameraCapture: UIViewControllerRepresentable {
    var onCapture: (UIImage?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onCapture: onCapture) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onCapture: (UIImage?) -> Void
        init(onCapture: @escaping (UIImage?) -> Void) { self.onCapture = onCapture }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onCapture(info[.originalImage] as? UIImage)
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCapture(nil)
        }
    }
}
