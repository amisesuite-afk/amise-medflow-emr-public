import SwiftUI
import SwiftData

struct EndoscopyListView: View {
    @Query(sort: \Patient.createdAt) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?

    private var endoscopyPatients: [Patient] {
        allPatients.filter { $0.setting == .endoscopy }
    }

    var body: some View {
        NavigationStack {
            Group {
                if endoscopyPatients.isEmpty {
                    ContentUnavailableView(
                        "No endoscopy cases",
                        systemImage: "circle.dotted",
                        description: Text("Add an endoscopy case to build the list.")
                    )
                } else {
                    List {
                        ForEach(endoscopyPatients) { patient in
                            Button { selectedPatient = patient } label: {
                                PatientRow(patient: patient)
                            }
                            .buttonStyle(.plain)
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
            .navigationTitle("Endoscopy List")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showAdd) {
                AddPatientView(initialSetting: .endoscopy)
            }
            .sheet(item: $selectedPatient) { p in
                PatientDetailView(patient: p)
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        for i in offsets { context.delete(endoscopyPatients[i]) }
    }
}

