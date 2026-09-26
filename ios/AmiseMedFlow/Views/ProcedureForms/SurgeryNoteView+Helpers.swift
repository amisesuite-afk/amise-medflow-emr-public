// SurgeryNoteView+Helpers.swift
// Save action, staff registry updates, PDF generation, AI note generation.

import SwiftUI
import SwiftData

extension SurgeryNoteView {

    // MARK: Helpers

    func save() {
        if data.surgeon.count >= 4      { StaffRegistry.shared.add(data.surgeon,       to: .surgeon) }
        if data.assistant.count >= 4    { StaffRegistry.shared.add(data.assistant,     to: .assistant) }
        if data.anaesthetist.count >= 4 { StaffRegistry.shared.add(data.anaesthetist,  to: .anaesthetist) }
        if data.scrubNurse.count >= 4   { StaffRegistry.shared.add(data.scrubNurse,    to: .nurse) }
        if data.circNurse.count >= 4    { StaffRegistry.shared.add(data.circNurse,     to: .nurse) }
        patient.surgeryData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    // Returns the best-matching template when the user types a procedure name,
    // so we can surface a one-tap "Apply template" suggestion without requiring
    // the surgeon to know the picker exists.
    func matchTemplate(for name: String) -> ProcedureTemplate? {
        let q = name.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 4 else { return nil }
        // Exact or substring match first
        if let t = ProcedureTemplate.all.first(where: { $0.name.lowercased().contains(q) || q.contains($0.name.lowercased()) }) {
            return t
        }
        // Word-overlap: require at least 2 significant words to match
        let stopWords: Set<String> = ["the","and","or","of","for","a","an","with","on","in","to"]
        let queryWords = Set(q.components(separatedBy: .whitespacesAndNewlines)
            .map { $0.trimmingCharacters(in: .punctuationCharacters) }
            .filter { $0.count > 2 && !stopWords.contains($0) })
        return ProcedureTemplate.all.first { template in
            let tWords = Set(template.name.lowercased().components(separatedBy: .whitespacesAndNewlines)
                .filter { $0.count > 2 && !stopWords.contains($0) })
            return queryWords.intersection(tWords).count >= 2
        }
    }

    @ViewBuilder
    func whoIcon(_ label: String, done: Bool) -> some View {
        VStack(spacing: 2) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 20))
                .foregroundStyle(done ? .green : .secondary)
            Text(label).font(.system(size: 9)).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    func fluidRow(_ label: String, value: Binding<String>) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField("—", text: value)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 80)
                .onChange(of: value.wrappedValue) { _, _ in save() }
        }
    }

    @ViewBuilder
    func staffField(_ label: String, text: Binding<String>, role: StaffRegistry.Role) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(label, text: text).onChange(of: text.wrappedValue) { _, _ in save() }
            let q = text.wrappedValue.lowercased()
            let names = StaffRegistry.shared.names(for: role).filter { q.isEmpty || $0.lowercased().contains(q) }
            let showSuggestions = !names.isEmpty && !names.contains(text.wrappedValue)
            if showSuggestions {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(names, id: \.self) { name in
                            Button {
                                text.wrappedValue = name
                                save()
                            } label: {
                                Text(name)
                                    .font(.system(size: 11))
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Color.secondary.opacity(0.12), in: Capsule())
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    func chipMultiSelect(_ label: String, options: [String], selected: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !label.isEmpty {
                Text(label).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(options, id: \.self) { opt in
                        let on = selected.wrappedValue.contains(opt)
                        let chipColor: Color = on ? AMColor.accent : Color.secondary.opacity(0.12)
                        Button {
                            if on { selected.wrappedValue.removeAll { $0 == opt } }
                            else { selected.wrappedValue.append(opt) }
                        } label: {
                            Text(opt)
                                .font(.system(size: 11, weight: on ? .semibold : .regular))
                                .foregroundStyle(on ? .white : .primary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(chipColor, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

}
