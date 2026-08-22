import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var sync: SyncService

    var body: some View {
        NavigationStack {
            Form {
                Section("Sync Status") {
                    LabeledContent("Connection") {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(sync.isConnected ? Color.green : Color.red)
                                .frame(width: 8, height: 8)
                            Text(sync.isConnected ? "Online" : "Offline")
                                .foregroundStyle(sync.isConnected ? .green : .red)
                        }
                    }
                    if sync.pendingCount > 0 {
                        LabeledContent("Pending") {
                            Text("\(sync.pendingCount) record\(sync.pendingCount == 1 ? "" : "s")")
                                .foregroundStyle(.orange)
                        }
                    }
                    if let last = sync.lastSyncedAt {
                        LabeledContent("Last synced") {
                            Text(last, style: .relative)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Practice") {
                    LabeledContent("Name", value: "Amise Medical Services")
                    LabeledContent("Location", value: "Saint Lucia")
                    LabeledContent("Surgeon", value: "Dr Dawit Daniel Kabiye")
                    LabeledContent("Specialty", value: "General & Endoscopic Surgery")
                }

                Section("App") {
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—")
                }
            }
            .navigationTitle("Settings")
        }
    }
}
