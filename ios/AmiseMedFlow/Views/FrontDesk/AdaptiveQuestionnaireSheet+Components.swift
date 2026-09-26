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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Two columns; one at accessibility text sizes so each option reads on its own line.
    private var columns: [GridItem] {
        dynamicTypeSize.isAccessibilitySize
            ? [GridItem(.flexible())]
            : [GridItem(.flexible()), GridItem(.flexible())]
    }

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
            // Row pitch is the 44 pt touch target (was 8 pt spacing between ~16 pt rows).
            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(options, id: \.self) { opt in
                    let sel = activeBinding.wrappedValue.contains(opt)
                    Button {
                        if sel { activeBinding.wrappedValue.remove(opt) }
                        else   { activeBinding.wrappedValue.insert(opt) }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(sel ? AMColor.accent : .secondary)
                                .scaledFont(size: 14)
                            Text(opt)
                                .font(.caption)
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                            Spacer()
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    // The tick icon was the only sign of the choice.
                    .accessibilityLabel(opt)
                    .accessibilityAddTraits(sel ? .isSelected : [])
                }
            }
        }
        .padding(.vertical, 2)
    }
}
