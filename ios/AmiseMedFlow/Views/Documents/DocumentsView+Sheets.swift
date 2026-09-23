// DocumentsView+Sheets.swift
// Document row, PencilKit annotation canvas, image/PDF preview sheets, summary sheet.

import SwiftUI
import SwiftData
import PDFKit
import PencilKit
import QuickLook

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

// MARK: - PencilKit annotation canvas

private struct AnnotationCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    let toolPicker: PKToolPicker

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.drawingPolicy = .anyInput
        canvas.tool = PKInkingTool(.pen, color: .systemRed, width: 5)
        toolPicker.setVisible(true, forFirstResponder: canvas)
        toolPicker.addObserver(canvas)
        canvas.becomeFirstResponder()
        return canvas
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        if uiView.drawing != drawing { uiView.drawing = drawing }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: AnnotationCanvas
        init(_ parent: AnnotationCanvas) { self.parent = parent }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            parent.drawing = canvasView.drawing
        }
    }
}

// MARK: - Image preview with annotation

struct ImagePreviewSheet: View {
    @Bindable var document: PatientDocument
    @Environment(\.dismiss) private var dismiss

    @State private var drawing = PKDrawing()
    @State private var annotating = false
    @StateObject private var toolPickerHolder = ToolPickerHolder()

    var body: some View {
        NavigationStack {
            imageBody
                .navigationTitle(document.fileName)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { toolbarItems }
        }
    }

    @ViewBuilder
    private var imageBody: some View {
        if let data = document.localData, let uiImg = UIImage(data: data) {
            ZStack {
                Color.black.ignoresSafeArea()
                GeometryReader { geo in
                    let scale = min(geo.size.width / uiImg.size.width,
                                   geo.size.height / uiImg.size.height)
                    let imgW = uiImg.size.width * scale
                    let imgH = uiImg.size.height * scale
                    ZStack {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(width: imgW, height: imgH)
                        if annotating {
                            AnnotationCanvas(drawing: $drawing,
                                             toolPicker: toolPickerHolder.picker)
                                .frame(width: imgW, height: imgH)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        } else {
            ContentUnavailableView(
                "Image unavailable",
                systemImage: "photo",
                description: Text("The image data could not be loaded.")
            )
        }
    }

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
        ToolbarItem(placement: .confirmationAction) {
            Button("Done") { dismiss() }
        }
        ToolbarItem(placement: .navigationBarLeading) {
            if let rawData = document.localData, let uiImg = UIImage(data: rawData) {
                let exportImg = annotating ? flattenedImage(base: uiImg) : uiImg
                ShareLink(
                    item: Image(uiImage: exportImg),
                    preview: SharePreview(document.fileName, image: Image(uiImage: exportImg))
                ) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
        ToolbarItem(placement: .bottomBar) {
            if document.localData != nil {
                Button {
                    if let rawData = document.localData, let uiImg = UIImage(data: rawData) {
                        if annotating {
                            let flat = flattenedImage(base: uiImg)
                            if let jpeg = flat.jpegData(compressionQuality: 0.92) {
                                document.localData = jpeg
                                drawing = PKDrawing()
                            }
                        }
                    }
                    withAnimation { annotating.toggle() }
                } label: {
                    Label(annotating ? "Save Annotation" : "Annotate",
                          systemImage: annotating ? "checkmark.circle.fill" : "pencil.tip")
                }
                .tint(annotating ? .teal : .primary)
            }
        }
        ToolbarItem(placement: .bottomBar) {
            if annotating {
                Button { drawing = PKDrawing() } label: {
                    Label("Clear", systemImage: "trash")
                }
                .tint(.red)
            }
        }
    }

    // Returns the photo composited with the current PencilKit strokes
    private func flattenedImage(base: UIImage) -> UIImage {
        let scale = UIScreen.main.scale
        let size = base.size
        UIGraphicsBeginImageContextWithOptions(size, false, scale)
        defer { UIGraphicsEndImageContext() }
        base.draw(in: CGRect(origin: .zero, size: size))
        drawing.image(from: CGRect(origin: .zero, size: size), scale: scale)
            .draw(in: CGRect(origin: .zero, size: size))
        return UIGraphicsGetImageFromCurrentImageContext() ?? base
    }
}

// Holds PKToolPicker as an ObservableObject so it persists for the sheet's lifetime
private final class ToolPickerHolder: ObservableObject {
    let picker = PKToolPicker()
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
