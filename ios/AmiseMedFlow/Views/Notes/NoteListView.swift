import SwiftUI
import SwiftData

struct NoteListView: View {
    let patient: Patient
    @Environment(\.modelContext) private var context

    @State private var showAddSheet = false
    @State private var selectedNoteType: NoteType = .soap
    @State private var editingNote: ClinicalNote?

    private var sortedNotes: [ClinicalNote] {
        patient.clinicalNotes.sorted { $0.createdAt > $1.createdAt }
    }

    var body: some View {
        Group {
            if sortedNotes.isEmpty {
                ContentUnavailableView(
                    "No notes",
                    systemImage: "note.text",
                    description: Text("Tap + to add the first clinical note.")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(sortedNotes) { note in
                    NoteRow(note: note)
                        .contentShape(Rectangle())
                        .onTapGesture { editingNote = note }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) { delete(note) } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    ForEach(NoteType.allCases, id: \.self) { type in
                        Button {
                            addNote(type: type)
                        } label: {
                            Label(type.label, systemImage: type.icon)
                        }
                    }
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(item: $editingNote) { note in
            NoteEditorView(note: note)
        }
    }

    private func addNote(type: NoteType) {
        let note = ClinicalNote(noteType: type, patient: patient)
        context.insert(note)
        editingNote = note
    }

    private func delete(_ note: ClinicalNote) {
        context.delete(note)
    }
}

// MARK: - Note row

struct NoteRow: View {
    let note: ClinicalNote

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.accentColor.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: note.noteType.icon)
                    .font(.system(size: 15))
                    .foregroundStyle(.tint)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(note.noteType.label)
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    if note.status == .signed {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                            .font(.caption)
                    }
                }
                Text(note.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let preview = notePreview(note) {
                    Text(preview)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .padding(.vertical, 3)
    }

    private func notePreview(_ note: ClinicalNote) -> String? {
        if note.noteType.isStructured {
            return [note.assessment, note.plan, note.subjective]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty })
        }
        return note.freeText?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
