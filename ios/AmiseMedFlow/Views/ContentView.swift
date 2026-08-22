import SwiftUI
import SwiftData

struct ContentView: View {
    @EnvironmentObject private var sync: SyncService

    var body: some View {
        TabView {
            WardRoundView()
                .tabItem { Label("Ward Rounds", systemImage: "bed.double") }
            TheatreListView()
                .tabItem { Label("Theatre", systemImage: "scissors") }
            EndoscopyListView()
                .tabItem { Label("Endoscopy", systemImage: "circle.dotted") }
            PatientListView()
                .tabItem { Label("Patients", systemImage: "person.crop.circle") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(SyncService())
        .modelContainer(for: Patient.self, inMemory: true)
}
