import SwiftUI

// MARK: - Compact sync status indicator for toolbars

/// A small dual-icon badge showing cloud + peer sync state.
/// Tap to see a popover with details. Used in navigation toolbars throughout the app.
struct SyncStatusBar: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @State private var showPopover = false

    private var cloudColor: Color {
        if sync.isSyncing            { return .accentColor }
        if sync.pendingCount > 0     { return .orange }
        return .secondary
    }

    private var peerColor: Color {
        if peerSync.connectedCount > 0 { return .green }
        if peerSync.nearbyCount > 0    { return .orange }
        return .secondary
    }

    private var anyActivity: Bool {
        sync.isSyncing || peerSync.connectedCount > 0
    }

    var body: some View {
        Button { showPopover = true } label: {
            HStack(spacing: 5) {
                // Cloud sync icon
                ZStack(alignment: .topTrailing) {
                    Image(systemName: sync.isSyncing ? "arrow.triangle.2.circlepath" : "cloud")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(cloudColor)
                        .symbolEffect(.rotate, isActive: sync.isSyncing)
                    if sync.pendingCount > 0 && !sync.isSyncing {
                        Text("\(min(sync.pendingCount, 9))")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(minWidth: 11, minHeight: 11)
                            .background(Color.orange, in: Circle())
                            .offset(x: 5, y: -5)
                    }
                }

                // Peer sync icon
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "antenna.radiowaves.left.and.right")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(peerColor)
                    if peerSync.connectedCount > 0 {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 6, height: 6)
                            .offset(x: 4, y: -4)
                    }
                }
            }
            .padding(.vertical, 2)
            .padding(.horizontal, 4)
        }
        .buttonStyle(.plain)
        .popover(isPresented: $showPopover, arrowEdge: .top) {
            SyncStatusPopover()
                .environmentObject(sync)
                .environmentObject(peerSync)
        }
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var parts: [String] = []
        if sync.isSyncing {
            parts.append("Cloud sync in progress")
        } else if sync.pendingCount > 0 {
            parts.append("\(sync.pendingCount) records pending cloud sync")
        } else {
            parts.append("Cloud synced")
        }
        if peerSync.connectedCount > 0 {
            parts.append("\(peerSync.connectedCount) device\(peerSync.connectedCount == 1 ? "" : "s") connected")
        } else if peerSync.nearbyCount > 0 {
            parts.append("\(peerSync.nearbyCount) nearby device\(peerSync.nearbyCount == 1 ? "" : "s")")
        } else {
            parts.append("No devices nearby")
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Popover detail view

private struct SyncStatusPopover: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            Text("Sync Status")
                .font(.headline)
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Cloud sync section
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Cloud", systemImage: "cloud.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)

                        HStack(spacing: 8) {
                            Circle()
                                .fill(cloudStatusColor)
                                .frame(width: 8, height: 8)
                            Text(cloudStatusText)
                                .font(.subheadline)
                        }

                        if let last = sync.lastSyncedAt {
                            Text("Last sync \(last, style: .relative)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Divider()

                    // Peer sync section
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Nearby Devices", systemImage: "antenna.radiowaves.left.and.right")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)

                        HStack(spacing: 8) {
                            Circle()
                                .fill(peerStatusColor)
                                .frame(width: 8, height: 8)
                            Text(peerStatusText)
                                .font(.subheadline)
                        }

                        if let last = peerSync.lastPeerSyncAt {
                            Text("Last device sync \(last, style: .relative)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        if !peerSync.peerSyncStatus.isEmpty {
                            Text(peerSync.peerSyncStatus)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        // Recent sync history (last 3)
                        if !peerSync.syncHistory.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(peerSync.syncHistory.prefix(3)) { event in
                                    HStack(spacing: 6) {
                                        Image(systemName: event.direction == .received
                                              ? "arrow.down.circle.fill"
                                              : "arrow.up.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(event.direction == .received ? Color.accentColor : Color.orange)
                                        Text(event.label)
                                            .font(.caption)
                                        Spacer()
                                        Text(event.at, style: .relative)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                            .padding(.top, 2)
                        }

                        HStack(spacing: 12) {
                            Button("Sync Now") { peerSync.syncNow() }
                                .disabled(peerSync.connectedCount == 0)
                                .buttonStyle(.bordered)
                                .controlSize(.small)

                            Button("Restart") { peerSync.restart() }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                                .tint(.orange)
                        }
                        .padding(.top, 4)
                    }
                }
                .padding(16)
            }
        }
        .frame(minWidth: 260, maxWidth: 320)
        .presentationCompactAdaptation(.popover)
    }

    private var cloudStatusColor: Color {
        if sync.isSyncing        { return .accentColor }
        if sync.pendingCount > 0 { return .orange }
        return .green
    }

    private var cloudStatusText: String {
        if sync.isSyncing        { return "Syncing…" }
        if sync.pendingCount > 0 { return "\(sync.pendingCount) pending" }
        return "Up to date"
    }

    private var peerStatusColor: Color {
        if peerSync.connectedCount > 0 { return .green }
        if peerSync.nearbyCount > 0    { return .orange }
        return .secondary
    }

    private var peerStatusText: String {
        if peerSync.connectedCount > 0 {
            return "\(peerSync.connectedCount) device\(peerSync.connectedCount == 1 ? "" : "s") connected"
        }
        if peerSync.nearbyCount > 0 {
            return "\(peerSync.nearbyCount) device\(peerSync.nearbyCount == 1 ? "" : "s") nearby"
        }
        return "No devices detected"
    }
}
