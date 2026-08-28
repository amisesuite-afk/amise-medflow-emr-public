import SwiftUI
import SwiftData
import PhotosUI
import QuickLook

// MARK: - Camera picker wrapper

private struct CameraPickerView: UIViewControllerRepresentable {
    var completion: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.allowsEditing = false
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPickerView
        init(_ parent: CameraPickerView) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.originalImage] as? UIImage { parent.completion(img) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

struct DocumentsView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false
    @State private var pendingCameraImage: UIImage? = nil
    @State private var showCategoryPicker = false
    @State private var pendingCategory  = "Imaging"
    @State private var pendingFileName = ""

    @State private var selectedDocForSummary: PatientDocument?
    @State private var summaryText     = ""
    @State private var showSummarySheet = false
    @State private var previewDoc:      PatientDocument?
    @State private var pdfPreviewDoc:   PatientDocument?
    @State private var aiError:         String?
    @State private var showError        = false

    private let categories = ["Clinical Notes", "Imaging", "Lab / Bloods", "Pathology", "Referral", "Consent", "Operative", "Other"]

    var body: some View {
        List {
            uploadSection

            if patient.documents.isEmpty {
                ContentUnavailableView(
                    "No documents",
                    systemImage: "doc.badge.plus",
                    description: Text("Import photos or take a photo with the camera")
                )
                .listRowBackground(Color.clear)
            } else {
                documentsSection
            }
        }
        .navigationTitle("Documents")
        .navigationBarTitleDisplayMode(.inline)
        .alert("AI Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(aiError ?? "Unknown error")
        }
        .sheet(isPresented: $showSummarySheet) {
            if let doc = selectedDocForSummary {
                DocumentSummarySheet(document: doc, summary: summaryText)
            }
        }
        .sheet(item: $previewDoc) { doc in
            ImagePreviewSheet(document: doc)
        }
        .sheet(item: $pdfPreviewDoc) { doc in
            if let data = doc.localData {
                PDFPreviewSheet(data: data, fileName: doc.fileName)
                    .ignoresSafeArea()
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPickerView { image in
                pendingCameraImage = image
                pendingFileName = "Photo_\(Date.now.formatted(.dateTime.month().day().hour().minute()))"
                pendingCategory = "Imaging"
                showCategoryPicker = true
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showCategoryPicker) {
            cameraSaveSheet
        }
    }

    // MARK: - Camera save sheet

    private var cameraSaveSheet: some View {
        NavigationStack {
            Form {
                Section("Document Name") {
                    TextField("Name", text: $pendingFileName)
                }
                Section("Category") {
                    Picker("Category", selection: $pendingCategory) {
                        ForEach(categories, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
            }
            .navigationTitle("Save Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Discard") {
                        pendingCameraImage = nil
                        showCategoryPicker = false
                    }
                    .foregroundStyle(.red)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let img = pendingCameraImage,
                           let data = img.jpegData(compressionQuality: 0.85) {
                            let name = pendingFileName.trimmingCharacters(in: .whitespaces)
                            let fileName = name.isEmpty ? "Photo.jpg" : "\(name).jpg"
                            let doc = PatientDocument(fileName: fileName, mimeType: "image/jpeg", category: pendingCategory)
                            doc.localData = data
                            doc.patient = patient
                            context.insert(doc)
                            patient.updatedAt = .now
                            patient.pendingSync = true
                            Task { await uploadToStorage(doc: doc, data: data) }
                        }
                        pendingCameraImage = nil
                        showCategoryPicker = false
                    }
                }
            }
        }
    }

    // MARK: - Upload

    @ViewBuilder
    private var uploadSection: some View {
        Section {
            PhotosPicker(
                selection: $pickerItems,
                maxSelectionCount: 5,
                matching: .any(of: [.images])
            ) {
                Label("Import from Photo Library", systemImage: "photo.badge.plus")
            }
            .onChange(of: pickerItems) { _, items in
                Task { await handlePickedItems(items) }
            }

            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button {
                    showCamera = true
                } label: {
                    Label("Take Photo (Camera)", systemImage: "camera.fill")
                }
            }
        }
    }

    // MARK: - Document list (grouped by category)

    private var groupedDocuments: [(String, [PatientDocument])] {
        let sorted = patient.documents.sorted { $0.uploadedAt > $1.uploadedAt }
        let grouped = Dictionary(grouping: sorted) { $0.category ?? "Other" }
        let order = categories
        return order.compactMap { cat in
            guard let docs = grouped[cat], !docs.isEmpty else { return nil }
            return (cat, docs)
        }
    }

    @ViewBuilder
    private var documentsSection: some View {
        ForEach(groupedDocuments, id: \.0) { category, docs in
            Section(category) {
                ForEach(docs) { doc in
                    DocumentRow(doc: doc, ai: ai,
                                onPreview: {
                                    if doc.mimeType.contains("pdf") { pdfPreviewDoc = doc }
                                    else { previewDoc = doc }
                                },
                                onSummarise: { Task { await summarise(doc) } })
                }
                .onDelete { indexSet in
                    indexSet.forEach { context.delete(docs[$0]) }
                }
            }
        }
    }

    // MARK: - Handlers

    private func handlePickedItems(_ items: [PhotosPickerItem]) async {
        let ts = Date.now.formatted(.dateTime.month(.abbreviated).day().hour().minute())
        for (i, item) in items.enumerated() {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            let suffix = items.count > 1 ? "_\(i + 1)" : ""
            let name = "Scan_\(ts)\(suffix).jpg"
            let doc = PatientDocument(fileName: name, mimeType: "image/jpeg", category: "Imaging")
            doc.localData = data
            doc.patient = patient
            await MainActor.run {
                context.insert(doc)
                patient.updatedAt = .now
                patient.pendingSync = true
            }
            await uploadToStorage(doc: doc, data: data)
        }
        pickerItems = []
    }

    private func uploadToStorage(doc: PatientDocument, data: Data) async {
        guard let remotePatientId = patient.remoteId else { return }
        let path = "\(remotePatientId)/\(doc.fileName)"
        do {
            try await SupabaseConfig.client.storage
                .from(AppConfig.supabaseStorageBucket)
                .upload(path, data: data, options: .init(contentType: doc.mimeType, upsert: true))
            // Store the storage path — never a public URL (PHI must stay access-controlled)
            doc.storageUrl = path
            // Persist metadata to patient_documents so the doc survives device reinstall
            await insertDocumentMetadata(doc: doc, patientId: remotePatientId)
        } catch {
            // Non-fatal: doc is saved locally regardless
        }
    }

    private func insertDocumentMetadata(doc: PatientDocument, patientId: String) async {
        guard doc.remoteId == nil else { return }  // already persisted
        struct DocRow: Encodable {
            let patient_id: String
            let file_name: String
            let mime_type: String
            let storage_url: String?
            let ai_summary: String?
            let extracted_text: String?
            let category: String?
        }
        let row = DocRow(
            patient_id: patientId,
            file_name: doc.fileName,
            mime_type: doc.mimeType,
            storage_url: doc.storageUrl,
            ai_summary: doc.aiSummary,
            extracted_text: doc.extractedText,
            category: doc.category
        )
        struct DocResponse: Decodable { let id: String }
        if let response = try? await SupabaseConfig.client
            .from("patient_documents")
            .insert(row)
            .select("id")
            .execute()
            .value as [DocResponse],
           let first = response.first {
            doc.remoteId = first.id
        }
    }

    // Fetch a short-lived signed URL on demand (600 s = 10 min) — never store the result
    static func signedURL(forPath path: String) async -> URL? {
        return try? await SupabaseConfig.client.storage
            .from(AppConfig.supabaseStorageBucket)
            .createSignedURL(path: path, expiresIn: 600)
    }

    private func summarise(_ doc: PatientDocument) async {
        let extracted = doc.extractedText ?? "(Image document — \(doc.fileName))"
        do {
            let summary = try await ai.summariseDocument(
                fileName: doc.fileName,
                extractedText: extracted,
                patient: patient
            )
            doc.aiSummary = summary
            patient.updatedAt = .now
            patient.pendingSync = true
            // Persist AI summary to Supabase if the doc row exists
            if let remoteId = doc.remoteId {
                struct SummaryPatch: Encodable { let ai_summary: String }
                _ = try? await SupabaseConfig.client
                    .from("patient_documents")
                    .update(SummaryPatch(ai_summary: summary))
                    .eq("id", value: remoteId)
                    .execute()
            }
            selectedDocForSummary = doc
            summaryText = summary
            showSummarySheet = true
        } catch {
            aiError = error.localizedDescription
            showError = true
        }
    }
}

// MARK: - Document row

private struct DocumentRow: View {
    @Bindable var doc: PatientDocument
    let ai: AIService
    let onPreview: () -> Void
    let onSummarise: () -> Void

    @State private var isEditingName = false
    @State private var editName = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                // Thumbnail
                if doc.mimeType.contains("image"), let data = doc.localData,
                   let uiImg = UIImage(data: data) {
                    Button(action: onPreview) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 56, height: 56)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.25), lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(action: onPreview) {
                        Image(systemName: doc.fileIcon)
                            .font(.title2)
                            .foregroundStyle(.teal)
                            .frame(width: 56, height: 56)
                            .background(Color.teal.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }

                VStack(alignment: .leading, spacing: 2) {
                    if isEditingName {
                        HStack {
                            TextField("Document name", text: $editName)
                                .font(.subheadline.weight(.medium))
                                .onSubmit {
                                    let trimmed = editName.trimmingCharacters(in: .whitespaces)
                                    if !trimmed.isEmpty { doc.fileName = trimmed }
                                    isEditingName = false
                                }
                            Button { isEditingName = false } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    } else {
                        Button {
                            editName = doc.fileName
                            isEditingName = true
                        } label: {
                            Text(doc.fileName)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(2)
                                .foregroundStyle(.primary)
                        }
                        .buttonStyle(.plain)
                    }
                    Text(doc.uploadedAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(action: onSummarise) {
                    Label("AI Read", systemImage: "sparkles")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .tint(.purple)
                .disabled(ai.isGenerating)
            }

            if let summary = doc.aiSummary {
                Divider()
                Text(summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(4)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Image preview sheet

struct ImagePreviewSheet: View {
    let document: PatientDocument
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let data = document.localData, let uiImg = UIImage(data: data) {
                    ScrollView([.horizontal, .vertical]) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity)
                    }
                } else {
                    ContentUnavailableView(
                        "Image unavailable",
                        systemImage: "photo",
                        description: Text("The image data could not be loaded.")
                    )
                }
            }
            .navigationTitle(document.fileName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                if let data = document.localData, let uiImg = UIImage(data: data) {
                    ToolbarItem(placement: .navigationBarLeading) {
                        ShareLink(item: Image(uiImage: uiImg), preview: SharePreview(document.fileName, image: Image(uiImage: uiImg))) {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
            }
        }
    }
}

// MARK: - PDF preview via QuickLook

struct PDFPreviewSheet: UIViewControllerRepresentable {
    let data: Data
    let fileName: String
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UINavigationController {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        _ = try? data.write(to: url)
        let ql = QLPreviewController()
        ql.dataSource = context.coordinator
        let nav = UINavigationController(rootViewController: ql)
        return nav
    }

    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, QLPreviewControllerDataSource {
        let parent: PDFPreviewSheet
        init(_ parent: PDFPreviewSheet) { self.parent = parent }

        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

        func previewController(_ controller: QLPreviewController,
                               previewItemAt index: Int) -> any QLPreviewItem {
            FileManager.default.temporaryDirectory
                .appendingPathComponent(parent.fileName) as NSURL
        }
    }
}

// MARK: - Summary sheet

struct DocumentSummarySheet: View {
    let document: PatientDocument
    let summary: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(summary)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle(document.fileName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    ShareLink(item: summary) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
    }
}
