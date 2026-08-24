import SwiftUI
import SwiftData

@main
struct AmiseMedFlowApp: App {
    @StateObject private var sync = SyncService()

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
                // Schema mismatch — wipe local store and retry once
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
            ContentView()
                .environmentObject(sync)
                .tint(AMColor.accent)
        }
        .modelContainer(sharedModelContainer)
    }
}
