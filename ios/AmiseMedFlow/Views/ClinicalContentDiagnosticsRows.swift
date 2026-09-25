// ClinicalContentDiagnosticsRows.swift
// Settings → Diagnostics rows for the bundled clinical content: DiagnosticDatabase.json
// version and content date, and whether the differential engine is using it or its built-in
// fallback lists (DiagnosticDatabaseInfo.swift). Display only.

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
    }
}
