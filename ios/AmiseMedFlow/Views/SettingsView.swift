import SwiftUI
import SwiftData

struct SettingsView: View {
    @EnvironmentObject private var sync: SyncService
    @Environment(\.modelContext) private var context

    @State private var showLogin = false
    @State private var showSignOutConfirm = false
    @State private var isSigningOut = false

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

                // MARK: Practice
                Section("Practice") {
                    LabeledContent("Name", value: "Amise Medical Services")
                    LabeledContent("Location", value: "Saint Lucia")
                    LabeledContent("Surgeon", value: "Dr Dawit Daniel Kabiye")
                    LabeledContent("Specialty", value: "General & Endoscopic Surgery")
                }

                Section("App") {
                    LabeledContent("Version",
                        value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—")
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showLogin) { LoginView() }
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
