// AdaptiveQuestionnaireSheet+Components.swift
// Reusable QCheckboxGrid component for multi-select questionnaire inputs.

import SwiftUI
import SwiftData


// MARK: - Reusable checkbox grid

struct QCheckboxGrid: View {
    let label: String?
    let options: [String]
    var selection: Binding<Set<String>>?
    var rawSelection: Binding<Set<String>>?

    init(label: String?, options: [String], selection: Binding<Set<String>>) {
        self.label = label
        self.options = options
        self.selection = selection
        self.rawSelection = nil
    }

    init(label: String?, options: [String], rawSelection: Binding<Set<String>>) {
        self.label = label
        self.options = options
        self.selection = nil
        self.rawSelection = rawSelection
    }

    private var activeBinding: Binding<Set<String>> {
        selection ?? rawSelection!
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let label {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(options, id: \.self) { opt in
                    let sel = activeBinding.wrappedValue.contains(opt)
                    Button {
                        if sel { activeBinding.wrappedValue.remove(opt) }
                        else   { activeBinding.wrappedValue.insert(opt) }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(sel ? AMColor.accent : .secondary)
                                .font(.system(size: 14))
                            Text(opt)
                                .font(.caption)
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
