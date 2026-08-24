import SwiftUI
import SwiftData

struct TheatreListView: View {
    // Use createdAt (non-optional) — operationDate is Date? and causes sort issues
    @Query(sort: \Patient.createdAt) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?

    private var theatrePatients: [Patient] {
        allPatients.filter { $0.setting == .theatre }
    }

    var body: some View {
        NavigationStack {
            Group {
                if theatrePatients.isEmpty {
                    ContentUnavailableView(
                        "No theatre cases",
                        systemImage: "scissors",
                        description: Text("Add a theatre case to build the list.")
                    )
                } else {
                    List {
                        ForEach(theatrePatients) { patient in
                            Button { selectedPatient = patient } label: {
                                PatientRow(patient: patient)
                            }
                            .buttonStyle(.plain)
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
            .navigationTitle("Theatre List")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showAdd) {
                AddPatientView(initialSetting: .theatre)
            }
            .sheet(item: $selectedPatient) { p in
                PatientDetailView(patient: p)
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        for i in offsets { context.delete(theatrePatients[i]) }
    }
}

