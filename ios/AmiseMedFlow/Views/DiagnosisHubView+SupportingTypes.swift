// DiagnosisHubView+SupportingTypes.swift
// Supporting types for DiagnosisHubView: ParsedResult, ParsedResultConfirmView,
// and CameraCapture (UIViewControllerRepresentable).

import SwiftUI
import PhotosUI
import UIKit


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
