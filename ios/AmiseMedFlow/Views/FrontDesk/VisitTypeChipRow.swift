// VisitTypeChipRow.swift
// Horizontal visit-type chips (same look as AddPatientView / QuickAddSheet), for the front-desk
// scheduler. Pure selection: the caller decides what a tap changes and when it is saved.

import SwiftUI

struct VisitTypeChipRow: View {
    @Binding var selection: VisitType
    var types: [VisitType] = VisitType.allCases
    /// Accessibility identifier of the row; each chip gets "<identifier>.<case name>".
    var identifier: String = "visitType"
    /// Called after a chip is tapped (not when the selection is set from outside).
    var onTap: ((VisitType) -> Void)? = nil

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(types, id: \.self) { vt in
                        chip(vt).id(vt)
                    }
                }
                .padding(.vertical, 4)
            }
            // A saved type further along the row (e.g. Bronchoscopy) is scrolled into view.
            .onAppear { proxy.scrollTo(selection, anchor: .center) }
            .onChange(of: selection) { _, vt in
                withAnimation { proxy.scrollTo(vt, anchor: .center) }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(identifier)
    }

    private func chip(_ vt: VisitType) -> some View {
        let sel = selection == vt
        let color = Color(hex: vt.accentHex)
        return Button {
            selection = vt
            onTap?(vt)
        } label: {
            HStack(spacing: 4) {
                Image(systemName: vt.icon).font(.system(size: 10))
                Text(vt.rawValue).font(.system(size: 11, weight: sel ? .semibold : .regular))
            }
            .foregroundStyle(sel ? .white : color)
            .padding(.horizontal, 9).padding(.vertical, 5)
            .background(sel ? color : color.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.12), value: sel)
        .accessibilityLabel("Visit type: \(vt.rawValue)")
        .accessibilityAddTraits(sel ? .isSelected : [])
        .accessibilityIdentifier("\(identifier).\(String(describing: vt))")
    }
}
