// ScaledFont.swift
// Dynamic Type for the fixed point sizes used across the app. `.font(.system(size: 14))` never
// grows with the user's text size; `.scaledFont(size: 14)` is exactly 14 pt at the default size
// and grows (or shrinks) with Dynamic Type like the nearest text style, so screens look the same
// at the default setting and stay readable for clinicians who use larger text.

import SwiftUI

private struct ScaledSystemFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let weight: Font.Weight
    private let design: Font.Design
    private let monospacedDigit: Bool

    init(size: CGFloat, weight: Font.Weight, design: Font.Design,
         relativeTo textStyle: Font.TextStyle, monospacedDigit: Bool) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: textStyle)
        self.weight = weight
        self.design = design
        self.monospacedDigit = monospacedDigit
    }

    func body(content: Content) -> some View {
        let font = Font.system(size: size, weight: weight, design: design)
        content.font(monospacedDigit ? font.monospacedDigit() : font)
    }
}

extension Font.TextStyle {
    /// The text style whose default (Large) size is nearest to `pointSize`, so a scaled fixed
    /// size grows at the same rate as system text of that size.
    static func nearest(toPointSize pointSize: CGFloat) -> Font.TextStyle {
        switch pointSize {
        case ..<11.5: return .caption2     // 11
        case ..<12.5: return .caption      // 12
        case ..<13.5: return .footnote     // 13
        case ..<15.5: return .subheadline  // 15
        case ..<16.5: return .callout      // 16
        case ..<18.5: return .body         // 17
        case ..<21:   return .title3       // 20
        case ..<25:   return .title2       // 22
        case ..<31:   return .title        // 28
        default:      return .largeTitle   // 34
        }
    }
}

extension View {
    /// `.font(.system(size:weight:design:))` that follows Dynamic Type: `size` at the default text
    /// size, scaled like `relativeTo` (default: the nearest text style) otherwise. Cap it with
    /// `.dynamicTypeSize(...)` where a dense layout genuinely cannot grow.
    func scaledFont(size: CGFloat,
                    weight: Font.Weight = .regular,
                    design: Font.Design = .default,
                    relativeTo textStyle: Font.TextStyle? = nil,
                    monospacedDigit: Bool = false) -> some View {
        modifier(ScaledSystemFont(size: size, weight: weight, design: design,
                                  relativeTo: textStyle ?? .nearest(toPointSize: size),
                                  monospacedDigit: monospacedDigit))
    }

    /// Minimum 44 × 44 pt hit area (Apple HIG) around a small control without changing how it
    /// looks: the frame grows, the drawn content keeps its own size (centred by default).
    func minimumTouchTarget(_ side: CGFloat = 44, alignment: Alignment = .center) -> some View {
        frame(minWidth: side, minHeight: side, alignment: alignment)
            .contentShape(Rectangle())
    }

    /// Adds invisible hit area around a small control without changing its layout size, for
    /// places where growing the frame to 44 pt would push the surrounding layout around. Use it
    /// inside a Button's label (the label's shape is what the button hit-tests).
    func expandedHitArea(horizontal: CGFloat = 0, vertical: CGFloat = 0) -> some View {
        padding(.horizontal, horizontal)
            .padding(.vertical, vertical)
            .contentShape(Rectangle())
            .padding(.horizontal, -horizontal)
            .padding(.vertical, -vertical)
    }
}
