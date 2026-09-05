import SwiftUI
import SwiftData

@main
struct AmiseMedFlowApp: App {
    @StateObject private var sync = SyncService()
    @StateObject private var peerSync = PeerSyncService()
    @StateObject private var bioAuth = BiometricAuthService()
    @StateObject private var calendarService = CalendarService()
    @StateObject private var notifications = NotificationService()
    @Environment(\.scenePhase) private var scenePhase

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self, PatientDocument.self, OperativePlan.self, BillingLineItem.self])
        func makeContainer(cloudKit: Bool) throws -> ModelContainer {
            let config = ModelConfiguration(
                schema: schema,
                isStoredInMemoryOnly: false,
                cloudKitDatabase: cloudKit ? .automatic : .none
            )
            do {
                return try ModelContainer(for: schema, configurations: [config])
            } catch {
                // Schema mismatch — export pending data before wiping, then retry
                let backupURL = config.url.deletingLastPathComponent()
                    .appendingPathComponent("medflow-backup-\(Int(Date().timeIntervalSince1970)).store")
                try? FileManager.default.copyItem(at: config.url, to: backupURL)
                try? FileManager.default.removeItem(at: config.url)
                return try ModelContainer(for: schema, configurations: [config])
            }
        }
        do {
            if let container = try? makeContainer(cloudKit: true) { return container }
            return try makeContainer(cloudKit: false)
        } catch {
            fatalError("ModelContainer init failed: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ZStack {
                ContentView()
                    .environmentObject(sync)
                    .environmentObject(peerSync)
                    .environmentObject(calendarService)
                    .environmentObject(notifications)
                    .tint(AMColor.accent)
                    .disabled(bioAuth.isLocked)
                    .blur(radius: bioAuth.isLocked ? 12 : 0)

                if bioAuth.isLocked {
                    AppLockScreen(auth: bioAuth)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: bioAuth.isLocked)
        }
        .modelContainer(sharedModelContainer)
        .onChange(of: scenePhase, initial: false) { _, newPhase in
            switch newPhase {
            case .background:
                bioAuth.recordBackground()
                peerSync.stop()
            case .active:
                bioAuth.lockIfTimedOut()
                // Re-sync every time the app comes to the foreground (picks up changes
                // made on another device, including iPhone ↔ iPad in the same room)
                Task { await sync.syncIfAuthenticated() }
                // peerSync.stop() is called on .background; restart it on .active
                // using stored credentials (no-op if never started)
                peerSync.restart()
                // Check notification authorization state (may have changed in Settings)
                Task { await notifications.checkAuthorization() }
            default:
                break
            }
        }
    }
}
