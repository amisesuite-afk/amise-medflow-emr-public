import SwiftUI
import SwiftData

@main
struct AmiseMedFlowApp: App {
    @StateObject private var sync = SyncService()

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self, PatientDocument.self, OperativePlan.self, BillingLineItem.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false, cloudKitDatabase: .automatic)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            // Schema changed — wipe old store and start fresh
            try? FileManager.default.removeItem(at: config.url)
            do {
                return try ModelContainer(for: schema, configurations: [config])
            } catch {
                fatalError("ModelContainer init failed: \(error)")
            }
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sync)
                .tint(AMColor.accent)
        }
        .modelContainer(sharedModelContainer)
    }
}
