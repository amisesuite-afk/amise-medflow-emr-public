import SwiftUI
import SwiftData
import PhotosUI

struct DocumentsView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var selectedDocForSummary: PatientDocument?
    @State private var summaryText = ""
    @State private var showSummarySheet = false
    @State private var aiError: String?
    @State private var showError = false

    var body: some View {
        List {
            uploadSection

            if patient.documents.isEmpty {
                ContentUnavailableView(
                    "No documents",
                    systemImage: "doc.badge.plus",
                    description: Text("Import photos or scan documents using the button above")
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
                Label("Import Photos / Scans", systemImage: "photo.badge.plus")
            }
            .onChange(of: pickerItems) { _, items in
                Task { await handlePickedItems(items) }
            }
        }
    }

    // MARK: - Document list

    @ViewBuilder
    private var documentsSection: some View {
        Section("Imported Documents (\(patient.documents.count))") {
            ForEach(patient.documents.sorted { $0.uploadedAt > $1.uploadedAt }) { doc in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: doc.fileIcon)
                            .foregroundStyle(.teal)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(doc.fileName).font(.subheadline.weight(.medium))
                            Text(doc.uploadedAt, style: .relative).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            Task { await summarise(doc) }
                        } label: {
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
            .onDelete { indexSet in
                let sorted = patient.documents.sorted { $0.uploadedAt > $1.uploadedAt }
                indexSet.forEach { context.delete(sorted[$0]) }
            }
        }
    }

    // MARK: - Handlers

    private func handlePickedItems(_ items: [PhotosPickerItem]) async {
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            let name = "Scan_\(Int(Date.now.timeIntervalSince1970)).jpg"
            let doc = PatientDocument(fileName: name, mimeType: "image/jpeg")
            doc.localData = data
            doc.patient = patient
            await MainActor.run {
                context.insert(doc)
                patient.updatedAt = .now
                patient.pendingSync = true
            }
        }
        pickerItems = []
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
            selectedDocForSummary = doc
            summaryText = summary
            showSummarySheet = true
        } catch {
            aiError = error.localizedDescription
            showError = true
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
