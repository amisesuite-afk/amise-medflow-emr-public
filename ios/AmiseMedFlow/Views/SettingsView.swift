import SwiftUI
import SwiftData

struct SettingsView: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @EnvironmentObject private var nasBackup: NASBackupService
    @Environment(\.modelContext) private var context

    @State private var showLogin = false
    @State private var showSignOutConfirm = false
    @State private var isSigningOut = false
    @State private var showAIDisclosure = false
    @State private var showClearNASConfirm = false

    var body: some View {
        NavigationStack {
            Form {
                // MARK: Account
                Section("Account") {
                    if let email = sync.currentUserEmail {
                        LabeledContent("Signed in as", value: email)
                        LabeledContent("Role", value: sync.currentUserRole.displayName)
                        Button(role: .destructive) {
                            showSignOutConfirm = true
                        } label: {
                            if isSigningOut {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Text("Sign Out").frame(maxWidth: .infinity)
                            }
                        }
                        .disabled(isSigningOut)
                    } else {
                        Button("Sign In to Sync") { showLogin = true }
                    }
                }

                // MARK: Sync status
                Section("Sync") {
                    LabeledContent("Connection") {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(sync.isConnected ? Color.green : Color.orange)
                                .frame(width: 8, height: 8)
                            Text(sync.isConnected ? "Online" : "Offline")
                        }
                    }

                    if sync.isSyncing {
                        LabeledContent("Status") {
                            HStack(spacing: 6) {
                                ProgressView().scaleEffect(0.7)
                                Text("Syncing…")
                            }
                        }
                    } else if sync.pendingCount > 0 {
                        LabeledContent("Pending") {
                            Text("\(sync.pendingCount) record\(sync.pendingCount == 1 ? "" : "s")")
                                .foregroundStyle(.orange)
                        }
                    }

                    if let last = sync.lastSyncedAt {
                        LabeledContent("Last synced") {
                            Text(last, style: .relative).foregroundStyle(.secondary)
                        }
                    }

                    if let err = sync.syncError {
                        Label(err, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                            .font(.caption)
                    }

                    if sync.isSignedIn && !sync.isSyncing {
                        Button("Sync Now") {
                            Task { await sync.sync(context: context) }
                        }
                    }
                }

                // MARK: Proximity Sync
                Section {
                    LabeledContent("Nearby devices") {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(peerSync.connectedCount > 0 ? Color.green : Color.secondary.opacity(0.4))
                                .frame(width: 8, height: 8)
                            Text(peerSync.connectedCount > 0
                                 ? "\(peerSync.connectedCount) connected"
                                 : (peerSync.nearbyCount > 0 ? "\(peerSync.nearbyCount) found" : "None"))
                        }
                    }

                    if !peerSync.peerSyncStatus.isEmpty {
                        Text(peerSync.peerSyncStatus)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if let last = peerSync.lastPeerSyncAt {
                        LabeledContent("Last device sync") {
                            Text(last, style: .relative).foregroundStyle(.secondary)
                        }
                    }

                    if !peerSync.syncHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Recent syncs")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            ForEach(peerSync.syncHistory.prefix(5)) { event in
                                HStack {
                                    Image(systemName: event.direction == .received ? "arrow.down.circle" : "arrow.up.circle")
                                        .foregroundStyle(event.direction == .received ? Color.accentColor : Color.orange)
                                        .font(.caption)
                                    Text(event.label)
                                        .font(.caption)
                                    Spacer()
                                    Text(event.at, style: .relative)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding(.vertical, 2)
                    }

                    HStack {
                        Button("Sync Now") {
                            peerSync.syncNow()
                        }
                        .disabled(peerSync.connectedCount == 0)

                        Spacer()

                        Button("Restart") {
                            peerSync.restart()
                        }
                        .foregroundStyle(.orange)
                    }
                } header: {
                    Text("Proximity Sync")
                } footer: {
                    Text("Syncs directly between your iPhone and iPad over Bluetooth or WiFi — no internet required.")
                }

                // MARK: NAS Backup
                Section {
                    TextField("WebDAV URL",
                              text: $nasBackup.serverURL,
                              prompt: Text("http://amise-storage:5005"))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)

                    TextField("Username",
                              text: $nasBackup.username,
                              prompt: Text("admin"))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    SecureField("Password", text: $nasBackup.password)

                    // Status row
                    LabeledContent("Status") {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(nasStatusColor)
                                .frame(width: 8, height: 8)
                            Text(nasBackup.connectionStatus.label)
                                .font(.subheadline)
                        }
                    }

                    if let last = nasBackup.lastBackupAt {
                        LabeledContent("Last backup") {
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(last, style: .relative).foregroundStyle(.secondary)
                                Text("\(nasBackup.lastBackupCount) records")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    }

                    if let err = nasBackup.backupError {
                        Label(err, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                            .font(.caption)
                    }

                    HStack(spacing: 12) {
                        Button {
                            Task { await nasBackup.testConnection() }
                        } label: {
                            if nasBackup.isTesting {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Text("Test").frame(maxWidth: .infinity)
                            }
                        }
                        .disabled(nasBackup.isTesting || !nasBackup.isConfigured)

                        Button {
                            Task { await nasBackup.backup(context: context) }
                        } label: {
                            if nasBackup.isBackingUp {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Text("Backup Now").frame(maxWidth: .infinity)
                            }
                        }
                        .disabled(nasBackup.isBackingUp || !nasBackup.isConfigured)
                        .tint(AMColor.accent)
                    }
                    .buttonStyle(.bordered)

                    if nasBackup.isConfigured {
                        Button("Clear NAS Settings", role: .destructive) {
                            showClearNASConfirm = true
                        }
                    }
                } header: {
                    Text("NAS Backup")
                } footer: {
                    Text("Backs up all patient records to a Synology, QNAP, or any WebDAV server.\n\nSynology DSM: Control Panel → File Services → WebDAV → Enable. Port 5005 (HTTP) or 5006 (HTTPS).\n\nExample — over Tailscale: http://amise-storage:5005 or http://100.119.29.97:5005. The iPhone is already on the same Tailnet, so backup works from any network automatically.")
                }

                // MARK: Practice
                Section("Practice") {
                    LabeledContent("Name", value: "Amise Medical Services")
                    LabeledContent("Location", value: "Saint Lucia")
                    LabeledContent("Surgeon", value: "Dr Dawit Daniel Kabiye")
                    LabeledContent("Specialty", value: "General & Endoscopic Surgery")
                }

                // MARK: AI & Privacy
                Section {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "brain.head.profile")
                            .foregroundStyle(.purple)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("AI Features & PHI")
                                .font(.subheadline.weight(.semibold))
                            Text("AI features transmit patient data to the Anthropic API. A HIPAA Business Associate Agreement (BAA) with Anthropic is required before use with real patient data.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)

                    Button("Review AI Disclosure") {
                        UserDefaults.standard.set(false, forKey: "ai_phi_consent_v2")
                        showAIDisclosure = true
                    }
                    .foregroundStyle(.purple)
                } header: {
                    Text("AI & Privacy")
                } footer: {
                    Text("For BAA enquiries: privacy@anthropic.com")
                }

                Section("App") {
                    LabeledContent("Version",
                        value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—")
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showLogin) { LoginView() }
            .sheet(isPresented: $showAIDisclosure) {
                AIConsentSheet(
                    accepted: Binding(
                        get: { UserDefaults.standard.bool(forKey: "ai_phi_consent_v2") },
                        set: { UserDefaults.standard.set($0, forKey: "ai_phi_consent_v2") }
                    ),
                    showSheet: $showAIDisclosure
                )
                .interactiveDismissDisabled(false)
            }
            .confirmationDialog("Sign out?", isPresented: $showSignOutConfirm, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) {
                    Task {
                        isSigningOut = true
                        try? await sync.signOut()
                        isSigningOut = false
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You will need to sign in again to sync your data.")
            }
            .confirmationDialog("Clear NAS Settings?", isPresented: $showClearNASConfirm, titleVisibility: .visible) {
                Button("Clear", role: .destructive) { nasBackup.clearCredentials() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This removes the server URL and credentials. Existing backups on the NAS are not deleted.")
            }
            .onAppear {
                sync.setModelContext(context)
            }
        }
    }

    private var nasStatusColor: Color {
        switch nasBackup.connectionStatus {
        case .unconfigured: return .secondary
        case .ok:
            if nasBackup.isBackingUp { return .accentColor }
            if let last = nasBackup.lastBackupAt {
                return Date.now.timeIntervalSince(last) > 86_400 ? .orange : .green
            }
            return .orange
        case .error: return .red
        }
    }
}
