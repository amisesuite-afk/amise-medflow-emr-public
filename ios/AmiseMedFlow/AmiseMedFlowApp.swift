import SwiftUI
import SwiftData

@main
struct AmiseMedFlowApp: App {
    @StateObject private var sync = SyncService()
    @StateObject private var peerSync = PeerSyncService()
    @StateObject private var nasBackup = NASBackupService()
    @StateObject private var bioAuth = BiometricAuthService()
    @StateObject private var calendarService = CalendarService()
    @StateObject private var notifications = NotificationService()
    @Environment(\.scenePhase) private var scenePhase

    let sharedModelContainer: ModelContainer

    init() {
        // First, so a crash anywhere during launch is still reported (and so a store failure
        // below can be reported: the container used to be built before this ran).
        CrashReporting.start()
        sharedModelContainer = Self.makeModelContainer()
    }

    /// Opens the on-device store without ever deleting or resetting it (see StoreHealth.swift):
    /// on disk → retry the untouched file → move it aside (timestamped, never deleted) and open
    /// a fresh store once → in-memory fallback, which shows a red banner and blocks new patients
    /// and note signing. Every failed step is reported with its error domain and code only.
    private static func makeModelContainer() -> ModelContainer {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self, PatientDocument.self, OperativePlan.self, BillingLineItem.self, Encounter.self, ScoreHistoryEntry.self])

        // CloudKit sync requires iCloud entitlement — not configured, so use local store only.
        let config = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false,
            cloudKitDatabase: .none
        )
        let storeURL = config.url

        let outcome = StoreRecovery.open(
            openOnDisk: { try ModelContainer(for: schema, configurations: [config]) },
            storeFileState: { StoreRecovery.fileState(at: storeURL) },
            moveAside: { try StoreRecovery.moveStoreAside(storeURL: storeURL) },
            openInMemory: {
                let memoryConfig = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
                return try ModelContainer(for: schema, configurations: [memoryConfig])
            }
        )

        StoreHealth.record(status: outcome.status, storeURL: storeURL)

        let outcomeTag: String
        switch outcome.status {
        case .onDisk:               outcomeTag = "on_disk"
        case .onDiskAfterMoveAside: outcomeTag = "moved_aside"
        case .inMemoryFallback:     outcomeTag = "in_memory_fallback"
        }
        if !outcome.failures.isEmpty {
            CrashReporting.breadcrumb("Store opened: \(outcomeTag)", category: "storage")
        }
        for failure in outcome.failures {
            CrashReporting.captureStoreFailure(domain: failure.domain, code: failure.code,
                                               stage: failure.stage.rawValue, outcome: outcomeTag)
        }

        guard let container = outcome.container else {
            fatalError("SwiftData: even an in-memory container failed to initialize.")
        }
        return container
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                ContentView()
                    .environmentObject(sync)
                    .environmentObject(peerSync)
                    .environmentObject(nasBackup)
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
