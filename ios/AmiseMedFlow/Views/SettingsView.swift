import SwiftUI
import SwiftData

struct SettingsView: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @Environment(\.modelContext) private var context

    @State private var showLogin = false
    @State private var showSignOutConfirm = false
    @State private var isSigningOut = false
    @State private var showAIDisclosure = false

    var body: some View {
        NavigationStack {
            Form {
                // MARK: Account
                Section("Account") {
                    if let email = sync.currentUserEmail {
                        LabeledContent("Signed in as", value: email)
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
                } header: {
                    Text("Proximity Sync")
                } footer: {
                    Text("Syncs directly between your iPhone and iPad over Bluetooth or WiFi — no internet required.")
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
            .onAppear {
                sync.setModelContext(context)
            }
        }
    }
}
