import SwiftUI
import SwiftData

struct SettingsView: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @EnvironmentObject private var nasBackup: NASBackupService
    @Environment(\.modelContext) private var context
    @ObservedObject private var practiceStore = PracticeProfileStore.shared

    @State private var showLogin = false
    @State private var showSignOutConfirm = false
    @State private var isSigningOut = false
    @State private var showAIDisclosure = false
    @State private var testReportSent = false
    @State private var backupCheckMessage: String?
    @State private var isCheckingBackup = false
    @State private var showRestoreConfirm = false
    @State private var showClearNASConfirm = false
    @State private var showPairing = false
    @State private var deviceToForget: PairedPeerDevice?

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

                    // Kept on this device; retried after the next sign-in.
                    if let notice = sync.syncNotice {
                        Label(notice, systemImage: "lock")
                            .foregroundStyle(.orange)
                            .font(.caption)
                    }

                    if sync.isSignedIn && !sync.isSyncing {
                        Button("Sync Now") {
                            Task { await sync.sync(context: context) }
                        }
                    }
                }

                // MARK: Nearby devices (proximity sync)
                Section {
                    LabeledContent("Status") {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(peerSync.connectedCount > 0 ? Color.green : Color.secondary.opacity(0.4))
                                .frame(width: 8, height: 8)
                            Text(peerSync.connectedCount > 0
                                 ? "\(peerSync.connectedCount) connected"
                                 : (peerSync.nearbyCount > 0 ? "\(peerSync.nearbyCount) found" : "None"))
                        }
                    }

                    // One-time pairing needed (e.g. after updating from a build without it).
                    if let prompt = peerSync.pairingPrompt {
                        HStack(alignment: .firstTextBaseline) {
                            Label(prompt, systemImage: "link.badge.plus")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.orange)
                            Spacer()
                            Button("Not now") { peerSync.dismissPairingPrompt() }
                                .buttonStyle(.borderless)
                                .font(.caption)
                        }
                    }

                    ForEach(peerSync.pairedDevices) { device in
                        HStack(spacing: 10) {
                            Image(systemName: Self.deviceSymbol(device.name))
                                .foregroundStyle(AMColor.accent)
                                .frame(width: 22)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(device.name)
                                if let pairedAt = device.pairedAt {
                                    Text("Paired \(pairedAt.formatted(date: .abbreviated, time: .omitted))")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Button("Forget", role: .destructive) { deviceToForget = device }
                                .buttonStyle(.borderless)
                        }
                    }

                    Button {
                        showPairing = true
                    } label: {
                        Label("Pair a device", systemImage: "plus.circle")
                    }
                    .disabled(!peerSync.isRunning)

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
                    Text("Nearby devices")
                } footer: {
                    Text("Syncs directly between your paired iPhone and iPad over Bluetooth or WiFi — no internet required. Pair each device once with a 6-digit code; both must be signed in to the same account. Forget a device you no longer use.")
                }

                // MARK: NAS Backup
                Section {
                    TextField("WebDAV URL",
                              text: $nasBackup.serverURL,
                              prompt: Text("http://your-nas:5005"))
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

                    // Documents and photos in the last backup run (NASBackupService+Documents).
                    if let docs = nasBackup.lastDocumentsSummary, !nasBackup.isBackingUp {
                        LabeledContent("Documents") {
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("\(docs.fileCount) · \(NASDocumentBackup.megabytes(docs.totalBytes))")
                                    .foregroundStyle(docs.complete ? Color.secondary : Color.orange)
                                Text(docs.complete
                                     ? "\(docs.uploadedCount) uploaded, \(docs.reusedCount) unchanged · \(Int(docs.seconds.rounded())) s"
                                     : "Incomplete: \(docs.documentCount) of \(docs.expectedCount) saved")
                                    .font(.caption2)
                                    .foregroundStyle(docs.complete ? Color.secondary : Color.orange)
                            }
                        }
                    }

                    if let progress = nasBackup.documentProgress {
                        VStack(alignment: .leading, spacing: 4) {
                            ProgressView(value: Double(progress.done), total: Double(max(progress.total, 1)))
                                .tint(AMColor.accent)
                            Text(progress.total == 0
                                 ? "Preparing documents…"
                                 : "Documents \(progress.done) of \(progress.total) · \(NASDocumentBackup.megabytes(progress.uploadedBytes)) sent")
                                .font(.caption)
                                .foregroundStyle(.secondary)
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
                        Button {
                            isCheckingBackup = true
                            Task {
                                backupCheckMessage = await nasBackup.verifyLatestBackup(context: context)
                                isCheckingBackup = false
                            }
                        } label: {
                            Label(isCheckingBackup ? "Checking backup…" : "Verify latest backup (test restore)",
                                  systemImage: "checkmark.shield")
                        }
                        .disabled(isCheckingBackup || nasBackup.lastBackupPath == nil)

                        Button {
                            showRestoreConfirm = true
                        } label: {
                            Label("Restore missing records from backup", systemImage: "arrow.down.doc")
                        }
                        .disabled(isCheckingBackup || nasBackup.lastBackupPath == nil)

                        if let msg = backupCheckMessage {
                            Text(msg)
                                .font(.caption)
                                .foregroundStyle(msg.hasPrefix("Backup OK") || msg.hasPrefix("Restore complete")
                                                 ? Color.green : Color.orange)
                        }

                        Button("Clear NAS Settings", role: .destructive) {
                            showClearNASConfirm = true
                        }
                    }
                } header: {
                    Text("NAS Backup")
                } footer: {
                    Text("Backs up all patient records, documents and photos to a Synology, QNAP, or any WebDAV server. Unchanged documents are not uploaded again: later backups point to the copy in an earlier backup folder, so keep the older folders.\n\nSynology DSM: Control Panel → File Services → WebDAV → Enable. Port 5005 (HTTP) or 5006 (HTTPS).\n\nExample — over Tailscale: http://your-nas:5005 (Tailscale machine name) or http://100.x.y.z:5005 (its Tailscale IP). If this device is on the same Tailnet as the NAS, backup works from any network automatically.")
                }

                // MARK: Practice
                Section {
                    LabeledContent("Name", value: practiceStore.profile.practiceName)
                    LabeledContent("Location", value: practiceStore.profile.country)
                    LabeledContent("Surgeon", value: practiceStore.profile.clinicianName)
                    LabeledContent("Specialty", value: practiceStore.profile.specialty)
                    NavigationLink {
                        PracticeProfileView(store: practiceStore)
                    } label: {
                        Label("Practice Profile", systemImage: "building.2")
                    }
                    NavigationLink {
                        BowelPrepSignOffView(canApprove: sync.currentUserRole == .doctor,
                                             approverName: sync.currentUserEmail ?? practiceStore.profile.clinicianName)
                    } label: {
                        Label("Bowel Prep Protocols", systemImage: "checkmark.seal")
                    }
                } header: {
                    Text("Practice")
                } footer: {
                    Text("Practice, clinician and contact details printed on documents, letters, PDFs, SMS and email. Bowel prep protocol wording is signed off by the surgeon here.")
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

                Section {
                    // Store status, file size and moved-aside copies (StoreHealth.swift).
                    StoreDiagnosticsRows()
                    // DiagnosticDatabase.json version and whether the differential uses it
                    // (DiagnosticDatabaseInfo.swift, clinical-content/registry.json).
                    ClinicalContentDiagnosticsRows()
                    LabeledContent("Crash & freeze reporting", value: CrashReporting.statusText)
                    LabeledContent("Audit events waiting to upload", value: "\(AuditLog.pendingCount)")
                    if CrashReporting.isEnabled {
                        Button(testReportSent ? "Test report sent" : "Send test report") {
                            CrashReporting.sendTestEvent()
                            testReportSent = true
                        }
                        .disabled(testReportSent)
                    }
                } header: {
                    Text("Diagnostics")
                } footer: {
                    Text(CrashReporting.isEnabled
                         ? "Crash and freeze reports contain technical details only (code location, device, iOS and app version) — never patient data or screenshots."
                         : "Add SENTRY_DSN to Configuration.xcconfig to turn on crash and freeze reporting.")
                }
            }
            .navigationTitle("Settings")
            .alert("Restore missing records?", isPresented: $showRestoreConfirm) {
                Button("Restore") {
                    isCheckingBackup = true
                    Task {
                        backupCheckMessage = await nasBackup.restoreMissingRecords(context: context, using: peerSync)
                        isCheckingBackup = false
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Adds patients, notes, prescriptions, vitals, billing, documents and photos from the latest NAS backup that are missing on this device. Nothing already on the device is replaced by older backup data, and documents deleted on this device are not brought back.")
            }
            .sheet(isPresented: $showLogin) { LoginView() }
            .sheet(isPresented: $showPairing) {
                PeerPairingSheet().environmentObject(peerSync)
            }
            .confirmationDialog("Forget this device?",
                                isPresented: Binding(get: { deviceToForget != nil },
                                                     set: { if !$0 { deviceToForget = nil } }),
                                titleVisibility: .visible,
                                presenting: deviceToForget) { device in
                Button("Forget \(device.name)", role: .destructive) {
                    peerSync.forgetDevice(device)
                    deviceToForget = nil
                }
                Button("Cancel", role: .cancel) { deviceToForget = nil }
            } message: { _ in
                Text("It will no longer sync with this device until you pair it again. Records already on either device are kept.")
            }
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

    private static func deviceSymbol(_ name: String) -> String {
        let lower = name.lowercased()
        if lower.contains("ipad")   { return "ipad" }
        if lower.contains("iphone") { return "iphone" }
        return "ipad.and.iphone"
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
