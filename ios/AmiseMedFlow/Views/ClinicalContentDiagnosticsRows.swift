// ClinicalContentDiagnosticsRows.swift
// Settings → Diagnostics rows for the bundled clinical content: DiagnosticDatabase.json
// version and content date, and whether the differential engine is using it or its built-in
// fallback lists (DiagnosticDatabaseInfo.swift); then the shared rule files
// (clinical-content/rules/*.json, SharedClinicalContent.swift). Display only.

import SwiftUI

struct ClinicalContentDiagnosticsRows: View {

    @State private var status: DiagnosticDatabaseInfo.Status?

    private var engineColor: Color {
        (status?.engineLoaded ?? false) ? Color.green : Color.orange
    }

    var body: some View {
        LabeledContent("Diagnostic database", value: status?.versionText ?? "Checking…")
            .task {
                guard status == nil else { return }
                // The first read decodes a ~4 MB file: keep it off the main thread.
                status = await Task.detached(priority: .utility) {
                    DiagnosticDatabaseInfo.current
                }.value
            }

        if let status {
            LabeledContent("Content updated", value: status.updated)

            LabeledContent("Differential engine") {
                Text(status.engineText)
                    .foregroundStyle(engineColor)
            }

            if !status.engineLoaded {
                VStack(alignment: .leading, spacing: 4) {
                    Text("This build could not read DiagnosticDatabase.json, so the differential uses the smaller built-in candidate lists. Please report this to support.")
                    if let error = status.engineError {
                        Text(error)
                            .font(.caption.monospaced())
                            .textSelection(.enabled)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.vertical, 2)
            }
        }

        SharedRulesDiagnosticsRows()
    }
}

/// Settings → Diagnostics rows for the clinical rule files shared with the web
/// (clinical-content/rules/*.json, SharedClinicalContent.swift): each file's version, or why it
/// could not be read (the feature then shows nothing). Display only.
struct SharedRulesDiagnosticsRows: View {

    @State private var statuses: [SharedClinicalContent.Status]?

    private var summary: String {
        guard let statuses else { return "Checking…" }
        let loaded = statuses.filter(\.loaded).count
        return "\(loaded) of \(statuses.count) loaded"
    }

    var body: some View {
        LabeledContent("Shared clinical rules", value: summary)
            .task {
                guard statuses == nil else { return }
                statuses = await Task.detached(priority: .utility) {
                    SharedClinicalContent.statuses()
                }.value
            }

        if let statuses {
            ForEach(statuses) { status in
                LabeledContent(status.title) {
                    Text(status.valueText)
                        .foregroundStyle(status.loaded ? Color.secondary : Color.orange)
                }
                // Approved-content channel (docs/APPROVED-CONTENT-CHANNEL.md): which copy is in use.
                if status.channelEnabled {
                    Text("Source: \(status.sourceText)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let error = status.error {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("This build could not read \(status.file).json, so this feature shows nothing. Please report this to support.")
                        Text(error)
                            .font(.caption.monospaced())
                            .textSelection(.enabled)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 2)
                }
            }
            Text("Zebra rules and the supplement catalogue can be updated by an approved release published by the practice; a new release is used from the next launch. Any release that fails its checks is ignored and the bundled file is used.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
