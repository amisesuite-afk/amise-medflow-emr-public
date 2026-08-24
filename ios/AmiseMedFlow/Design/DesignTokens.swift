import SwiftUI

// MARK: - Color tokens — mirrors the web dashboard CSS variables

enum AMColor {
    // Primary accent  (#00b4a0 Caribbean turquoise)
    static let accent    = Color(hex: "00b4a0")
    static let accentDk  = Color(hex: "008f7e")
    static let accentLt  = Color(hex: "d6f5f1")
    static let accent2   = Color(hex: "0077a8")

    // Coral & gold
    static let coral     = Color(hex: "f26d51")
    static let gold      = Color(hex: "f5b800")

    // App & card backgrounds (adaptive light / dark)
    static let bg        = Color(adaptive: Color(hex: "f0f7f6"), dark: Color(hex: "0c1917"))
    static let card      = Color(adaptive: .white,              dark: Color(hex: "122120"))
    static let line      = Color(adaptive: Color(hex: "cde7e3"), dark: Color(hex: "1a3430"))

    // Text
    static let ink       = Color(adaptive: Color(hex: "122320"), dark: Color(hex: "c8e8e4"))
    static let muted     = Color(hex: "4e6660")
    static let faint     = Color(hex: "85aaa4")

    // Sidebar — always dark regardless of system appearance
    static let sidebarBg     = Color(hex: "071714")
    static let sidebarHd     = Color(hex: "091f1c")
    static let sidebarText   = Color(hex: "6ab8ae")
    static let sidebarActive = Color(hex: "40e0d0")
    static let sidebarGroup  = Color(hex: "3e7a72")

    // Acuity (matching web)
    static let emergency = Color(hex: "b91c1c")
    static let urgentCol = Color(hex: "b91c1c")
    static let priorityCol = Color(hex: "a16207")
    static let reviewCol  = Color(hex: "4d7c0f")
    static let routineCol = Color(hex: "00b4a0")
}

// MARK: - Adaptive Color helper (UIKit-backed)

extension Color {
    init(adaptive light: Color, dark: Color) {
        self.init(UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

// MARK: - Card modifier — matches web .ccard

extension View {
    func amCard() -> some View {
        self
            .padding(14)
            .background(AMColor.card)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(AMColor.line, lineWidth: 1)
            )
            .shadow(
                color: Color(hex: "14302c").opacity(0.08),
                radius: 4, x: 0, y: 2
            )
    }
}

// MARK: - Section label modifier — 11 px uppercase heavy, #4e6660

extension Text {
    func amSectionLabel() -> some View {
        self
            .font(.system(size: 11, weight: .heavy))
            .textCase(.uppercase)
            .foregroundStyle(AMColor.muted)
            .tracking(0.7)
    }
}
