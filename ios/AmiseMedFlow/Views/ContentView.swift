// ContentView.swift
// Root content view — adapts to size class.

import SwiftUI
import SwiftData

// MARK: - Root (adapts to size class)

struct ContentView: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @Environment(\.modelContext) private var modelContext

    private var isPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }

    var body: some View {
        Group {
            if isPad && sync.currentUserRole == .frontDesk {
                FrontDeskPadView()
            } else {
                CompactRootView()
            }
        }
        .onAppear {
            // Inject context so cloud sync works even if Settings is never opened
            sync.setModelContext(modelContext)
            // Start peer-to-peer sync only if email is already resolved (cached session).
            // If nil, the onChange below will start it once restoreSession() finishes.
            if let email = sync.currentUserEmail, !email.isEmpty {
                peerSync.start(context: modelContext, email: email)
            }
        }
        .onChange(of: sync.currentUserEmail) { _, email in
            guard let email, !email.isEmpty else {
                // Sign-out path: clear storedEmail so restart() on next foreground
                // doesn't resume advertising under the old account's identity.
                peerSync.signOut()
                return
            }
            // Stop any session that may have started with an empty email hash,
            // then restart with the real address so peer matching is correct.
            peerSync.stop()
            peerSync.start(context: modelContext, email: email)
        }
        .fullScreenCover(isPresented: Binding(
            get: { !sync.isSignedIn },
            set: { _ in }
        )) {
            LoginView()
                .environmentObject(sync)
        }
        // Show AI/PHI consent gate once per installation, after sign-in
        .requireAIConsent()
    }
}

// MARK: - iPhone: tab view

private struct CompactRootView: View {
    @EnvironmentObject private var sync: SyncService

    var body: some View {
        switch sync.currentUserRole {
        case .frontDesk:
            CompactFrontDeskView()
        default:
            TabView {
                TodayDashboardView()
                    .tabItem { Label("Today", systemImage: "calendar.day.timeline.left") }
                WardRoundView()
                    .tabItem { Label("Ward", systemImage: "bed.double") }
                ScheduleView()
                    .tabItem { Label("Schedule", systemImage: "calendar") }
                PatientListView()
                    .tabItem { Label("Patients", systemImage: "person.crop.circle") }
                SettingsView()
                    .tabItem { Label("Settings", systemImage: "gearshape") }
            }
        }
    }
}
