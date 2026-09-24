import SwiftUI
import UIKit

// MARK: - Compact sync status indicator for toolbars

/// Three-icon badge: cloud (Supabase) · antenna (MultipeerConnectivity) · drive (NAS/WebDAV).
/// Tap to see a popover with details. Used in navigation toolbars throughout the app.
struct SyncStatusBar: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @EnvironmentObject private var nasBackup: NASBackupService
    @State private var showPopover = false
    @State private var spinAngle: Double = 0

    private var cloudColor: Color {
        if sync.isSyncing             { return .accentColor }
        if !sync.isSignedIn           { return .red }
        if sync.syncError != nil      { return .red }
        if sync.pendingCount > 0      { return .orange }
        if sync.lastSyncedAt == nil   { return .orange }
        return .secondary
    }

    private var peerColor: Color {
        if peerSync.connectedCount > 0 { return .green }
        if peerSync.nearbyCount > 0    { return .orange }
        if peerSync.isRunning          { return AMColor.accent }  // scanning, no peers yet
        return .secondary
    }

    private var nasColor: Color {
        if nasBackup.isBackingUp                  { return .accentColor }
        if nasBackup.backupError != nil           { return .red }
        guard nasBackup.isConfigured              else { return .secondary }
        if let last = nasBackup.lastBackupAt {
            return Date.now.timeIntervalSince(last) > 86_400 ? .orange : .secondary
        }
        return .orange  // configured but never backed up
    }

    var body: some View {
        Button { showPopover = true } label: {
            HStack(spacing: 5) {
                // Cloud sync icon
                ZStack(alignment: .topTrailing) {
                    Image(systemName: sync.isSyncing ? "arrow.triangle.2.circlepath" : "cloud")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(cloudColor)
                        .rotationEffect(.degrees(sync.isSyncing ? spinAngle : 0))
                        .animation(sync.isSyncing
                            ? .linear(duration: 1).repeatForever(autoreverses: false)
                            : .default,
                            value: spinAngle)
                        .onAppear { if sync.isSyncing { spinAngle = 360 } }
                        .onChange(of: sync.isSyncing) { _, syncing in
                            spinAngle = syncing ? 360 : 0
                        }
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

                // NAS / WebDAV icon — shown when configured, or when backing up / error
                if nasBackup.isConfigured || nasBackup.isBackingUp {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: nasBackup.isBackingUp
                              ? "arrow.triangle.2.circlepath"
                              : "externaldrive.fill")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(nasColor)
                        if nasBackup.backupError != nil && !nasBackup.isBackingUp {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 6, height: 6)
                                .offset(x: 4, y: -4)
                        }
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
                .environmentObject(nasBackup)
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
        if nasBackup.isConfigured {
            if nasBackup.isBackingUp {
                parts.append("NAS backup in progress")
            } else if let last = nasBackup.lastBackupAt {
                parts.append("NAS backup \(last.formatted(.relative(presentation: .named)))")
            }
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Popover detail view

private struct SyncStatusPopover: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @EnvironmentObject private var nasBackup: NASBackupService
    @Environment(\.modelContext) private var context

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
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

                        if let email = sync.currentUserEmail {
                            Text(email)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        } else {
                            Text("Not signed in — sync disabled")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }

                        if let last = sync.lastSyncedAt {
                            Text("Last sync \(last, style: .relative)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else if sync.isSignedIn {
                            Text("Sync has not completed yet")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }

                        if let err = sync.syncError {
                            Text("Error: \(err)")
                                .font(.caption)
                                .foregroundStyle(.red)
                                .lineLimit(3)
                        }

                        // Kept on this device; retried after the next sign-in.
                        if let notice = sync.syncNotice {
                            Label(notice, systemImage: "lock")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }

                        Button {
                            Task { await sync.syncIfAuthenticated() }
                        } label: {
                            Label("Sync Now", systemImage: "arrow.clockwise")
                                .font(.caption.weight(.medium))
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.mini)
                        .disabled(sync.isSyncing || !sync.isSignedIn)
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

                        if peerSync.peerSyncStatus == "Proximity sync unavailable" {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Local network access required.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Button {
                                    if let url = URL(string: UIApplication.openSettingsURLString) {
                                        UIApplication.shared.open(url)
                                    }
                                } label: {
                                    Label("Open Settings", systemImage: "gear")
                                        .font(.caption.weight(.medium))
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.mini)
                                .tint(.orange)
                            }
                        } else if !peerSync.peerSyncStatus.isEmpty {
                            Text(peerSync.peerSyncStatus)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

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

                    // NAS backup section — only when configured
                    if nasBackup.isConfigured {
                        Divider()

                        VStack(alignment: .leading, spacing: 8) {
                            Label("NAS Backup", systemImage: "externaldrive.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.secondary)

                            HStack(spacing: 8) {
                                Circle()
                                    .fill(nasStatusColor)
                                    .frame(width: 8, height: 8)
                                Text(nasStatusText)
                                    .font(.subheadline)
                            }

                            if let last = nasBackup.lastBackupAt {
                                Text("Last backup \(last, style: .relative) · \(nasBackup.lastBackupCount) records")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            if let err = nasBackup.backupError {
                                Text(err)
                                    .font(.caption)
                                    .foregroundStyle(.red)
                                    .lineLimit(3)
                            }

                            Button {
                                Task { await nasBackup.backup(context: context) }
                            } label: {
                                Label("Backup Now", systemImage: "arrow.clockwise")
                                    .font(.caption.weight(.medium))
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                            .disabled(nasBackup.isBackingUp)
                        }
                    }
                }
                .padding(16)
            }
        }
        .frame(minWidth: 260, maxWidth: 320)
        .presentationCompactAdaptation(.popover)
    }

    private var cloudStatusText: String {
        if sync.isSyncing         { return "Syncing…" }
        if !sync.isSignedIn       { return "Not signed in" }
        if sync.syncError != nil  { return "Sync error" }
        if sync.pendingCount > 0  { return "\(sync.pendingCount) pending" }
        if sync.lastSyncedAt == nil { return "Waiting to sync…" }
        return "Up to date"
    }

    private var cloudStatusColor: Color {
        if sync.isSyncing         { return .accentColor }
        if !sync.isSignedIn       { return .red }
        if sync.syncError != nil  { return .red }
        if sync.pendingCount > 0  { return .orange }
        if sync.lastSyncedAt == nil { return .orange }
        return .green
    }

    private var peerStatusColor: Color {
        if peerSync.connectedCount > 0 { return .green }
        if peerSync.nearbyCount > 0    { return .orange }
        if peerSync.isRunning          { return AMColor.accent }
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

    private var nasStatusColor: Color {
        if nasBackup.isBackingUp                  { return .accentColor }
        if nasBackup.backupError != nil           { return .red }
        if let last = nasBackup.lastBackupAt {
            return Date.now.timeIntervalSince(last) > 86_400 ? .orange : .green
        }
        return .orange
    }

    private var nasStatusText: String {
        if nasBackup.isBackingUp { return "Backing up…" }
        if nasBackup.backupError != nil { return "Backup error" }
        if nasBackup.lastBackupAt != nil { return "Ready" }
        return "Not yet backed up"
    }
}
