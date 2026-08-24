import SwiftUI
import SwiftData

struct NoteListView: View {
    let patient: Patient
    @Environment(\.modelContext) private var context

    @State private var editingNote: ClinicalNote?

    private var sortedNotes: [ClinicalNote] {
        // Drafts first, then by date descending
        patient.clinicalNotes.sorted {
            if $0.status == .draft && $1.status != .draft { return true }
            if $0.status != .draft && $1.status == .draft { return false }
            return $0.createdAt > $1.createdAt
        }
    }

    private var draftCount: Int {
        patient.clinicalNotes.filter { $0.status == .draft && !$0.isEmpty }.count
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
                if draftCount > 0 {
                    HStack(spacing: 6) {
                        Image(systemName: "pencil.circle.fill")
                            .foregroundStyle(.orange)
                            .font(.caption)
                        Text("\(draftCount) unsigned draft\(draftCount == 1 ? "" : "s")")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.orange)
                        Spacer()
                        Text("Swipe right to sign")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.horizontal, 4)
                    .padding(.vertical, 6)
                    .listRowBackground(Color.orange.opacity(0.06))
                }

                ForEach(sortedNotes) { note in
                    NoteRow(note: note)
                        .contentShape(Rectangle())
                        .onTapGesture { editingNote = note }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            if note.status == .draft {
                                Button {
                                    signNote(note)
                                } label: {
                                    Label("Sign", systemImage: "checkmark.seal")
                                }
                                .tint(.green)
                            }
                        }
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

    private func signNote(_ note: ClinicalNote) {
        note.status = .signed
        note.updatedAt = .now
        note.pendingSync = true
    }

    private func delete(_ note: ClinicalNote) {
        context.delete(note)
    }
}

// MARK: - Note row

struct NoteRow: View {
    let note: ClinicalNote

    private var typeColor: Color {
        switch note.noteType {
        case .soap, .progress:   return .blue
        case .operative:         return Color(hex: "7C3AED")
        case .endoscopy:         return Color(hex: "0891B2")
        case .discharge:         return Color(hex: "0D9488")
        case .consultation:      return .orange
        case .referralLetter:    return .indigo
        case .other:             return .secondary
        }
    }

    private var isDraft: Bool { note.status == .draft }

    var body: some View {
        HStack(spacing: 12) {
            // Type-coloured icon tile
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(typeColor.opacity(0.12))
                    .frame(width: 36, height: 36)
                Image(systemName: note.noteType.icon)
                    .font(.system(size: 15))
                    .foregroundStyle(typeColor)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(note.noteType.label)
                        .font(.subheadline.weight(.medium))

                    if isDraft {
                        Text("DRAFT")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(.orange, in: Capsule())
                    }

                    Spacer()

                    if !isDraft {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                            .font(.caption)
                    }
                }

                Text(note.updatedAt, style: .relative)
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
        .opacity(isDraft ? 0.9 : 1.0)
    }

    private func notePreview(_ note: ClinicalNote) -> String? {
        if note.noteType.isStructured {
            return [note.assessment, note.plan, note.subjective]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty })
        }
        // Show only the first meaningful line of free text
        return note.freeText?
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first(where: { !$0.isEmpty && !$0.hasPrefix("DISCHARGE") && !$0.hasPrefix("OPERATIVE") && !$0.hasPrefix("ENDOSCOPY") && !$0.hasPrefix("CONSULTATION") })
    }
}
