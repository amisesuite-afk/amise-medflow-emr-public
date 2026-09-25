// PendingSyncDetailView.swift
// Settings → Sync → Pending: every record not yet on the server and why (SyncPendingReasons.swift).
// Shown on this device only; nothing here is sent anywhere.

import SwiftUI
import SwiftData

struct PendingSyncDetailView: View {
    @EnvironmentObject private var sync: SyncService
    @Environment(\.modelContext) private var context
    @State private var items: [PendingRecordSummary] = []

    var body: some View {
        List {
            if items.isEmpty {
                ContentUnavailableView("Nothing pending", systemImage: "checkmark.icloud",
                                       description: Text("Every record on this device is on the server."))
            } else {
                Section {
                    ForEach(reasonCounts, id: \.reason) { entry in
                        LabeledContent(entry.reason.rawValue) {
                            Text("\(entry.count)").monospacedDigit()
                        }
                        .font(.subheadline)
                    }
                } header: {
                    Text("Why records are pending")
                }

                Section("Records") {
                    ForEach(items) { item in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(item.kind).font(.subheadline.weight(.semibold))
                                if let name = item.patientName {
                                    Text("· \(name)").font(.subheadline).lineLimit(1)
                                }
                                Spacer()
                                Text(item.updatedAt, format: .dateTime.day().month().hour().minute())
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Text(item.reason.rawValue)
                                .font(.caption)
                                .foregroundStyle(item.reason == .waiting ? Color.secondary : Color.orange)
                            if let detail = item.detail {
                                Text(detail).font(.caption2).foregroundStyle(.secondary)
                                    .textSelection(.enabled)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
        .navigationTitle("Pending records")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if sync.isSignedIn {
                Button("Sync Now") {
                    Task {
                        await sync.sync(context: context)
                        reload()
                    }
                }
                .disabled(sync.isSyncing)
            }
        }
        .onAppear(perform: reload)
    }

    private struct ReasonCount { let reason: SyncPendingReason; let count: Int }

    private var reasonCounts: [ReasonCount] {
        SyncPendingReason.allCases.compactMap { reason in
            let n = items.filter { $0.reason == reason }.count
            return n > 0 ? ReasonCount(reason: reason, count: n) : nil
        }
    }

    private func reload() {
        items = sync.pendingSummaries(context: context)
    }
}
