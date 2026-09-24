import SwiftUI
import PhotosUI
import SwiftData
import PDFKit
import PencilKit

struct DocumentsView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) var context
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
    @State private var showFilePicker   = false
    @State private var pendingFileCategory = "Lab / Bloods"

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

            Button {
                showFilePicker = true
            } label: {
                Label("Import PDF / File", systemImage: "doc.badge.plus")
            }
        }
        .sheet(isPresented: $showFilePicker) {
            pdfCategoryPicker
        }
    }

    // MARK: - PDF / file picker sheet (category selection → Files picker)

    @State private var showDocumentPicker = false

    private var pdfCategoryPicker: some View {
        NavigationStack {
            Form {
                Section("Select category first, then choose the file") {
                    Picker("Category", selection: $pendingFileCategory) {
                        ForEach(categories, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
                Section {
                    Button {
                        showDocumentPicker = true
                    } label: {
                        Label("Choose File from Files App…", systemImage: "folder.badge.plus")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .navigationTitle("Import File")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showFilePicker = false }
                }
            }
            .fullScreenCover(isPresented: $showDocumentPicker) {
                FilePicker(
                    allowedTypes: [.pdf, .image, .plainText, .data,
                                   UTType(filenameExtension: "docx") ?? .data,
                                   UTType(filenameExtension: "xlsx") ?? .data]
                ) { urls in
                    Task { await handlePickedFiles(urls, category: pendingFileCategory) }
                    showDocumentPicker = false
                    showFilePicker = false
                }
                .ignoresSafeArea()
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
                    indexSet.forEach {
                        // Tombstone → soft delete on the server at the next sync (all devices).
                        AuditLog.record("delete", "document", patient: patient,
                                        resourceId: docs[$0].remoteId ?? docs[$0].id.uuidString)
                        SyncTombstones.add(docs[$0].remoteId, in: .documents)
                        context.delete(docs[$0])
                    }
                }
            }
        }
    }

    // MARK: - Handlers

    private func handlePickedFiles(_ urls: [URL], category: String) async {
        for url in urls {
            guard url.startAccessingSecurityScopedResource() else { continue }
            defer { url.stopAccessingSecurityScopedResource() }
            guard let data = try? Data(contentsOf: url) else { continue }
            let fileName = url.lastPathComponent
            let mimeType: String
            if fileName.lowercased().hasSuffix(".pdf") { mimeType = "application/pdf" }
            else if fileName.lowercased().hasSuffix(".jpg") || fileName.lowercased().hasSuffix(".jpeg") { mimeType = "image/jpeg" }
            else if fileName.lowercased().hasSuffix(".png") { mimeType = "image/png" }
            else { mimeType = "application/octet-stream" }
            let doc = PatientDocument(fileName: fileName, mimeType: mimeType, category: category)
            doc.localData = data
            doc.patient = patient
            await MainActor.run {
                context.insert(doc)
                patient.updatedAt = .now
                patient.pendingSync = true
            }
            await uploadToStorage(doc: doc, data: data)
        }
    }

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
        } catch is AIError {
            // AIService disabled pending HIPAA BAA — build a local summary from available metadata
            let name = doc.fileName
            let category = doc.category.rawValue
            let textSnippet: String
            if let ext = doc.extractedText, !ext.isEmpty {
                let trimmed = ext.trimmingCharacters(in: .whitespacesAndNewlines)
                textSnippet = trimmed.count > 400 ? String(trimmed.prefix(400)) + "…" : trimmed
            } else {
                textSnippet = ""
            }
            var parts: [String] = []
            parts.append("Document: \(name)")
            parts.append("Category: \(category)")
            let df = DateFormatter()
            df.dateStyle = .medium; df.timeStyle = .none
            df.timeZone = TimeZone.ect
            parts.append("Uploaded: \(df.string(from: doc.uploadedAt))")
            if !textSnippet.isEmpty {
                parts.append("")
                parts.append("Extracted content preview:")
                parts.append(textSnippet)
            } else {
                parts.append("No text extracted from this document. Please review the original file.")
            }
            let summary = parts.joined(separator: "\n")
            doc.aiSummary = summary
            patient.updatedAt = .now
            patient.pendingSync = true
            selectedDocForSummary = doc
            summaryText = summary
            showSummarySheet = true
        } catch {
            aiError = error.localizedDescription
            showError = true
        }
    }
}

