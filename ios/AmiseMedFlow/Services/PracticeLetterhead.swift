import UIKit

// MARK: - Practice letterhead drawing
//
// Shared drawing for the parts of the teal/navy PDF header bands that carry
// practice identity. Geometry and attributes match the previous hard-coded
// drawing exactly, so default-profile PDFs render identically.

enum PracticeLetterhead {

    /// Large, tracked brand mark (e.g. "AMISE") at the top-left of a header band.
    static func drawBrandMark(at point: CGPoint) {
        let mark = PracticeProfile.current.brandMark
        guard !mark.isEmpty else { return }
        mark.draw(at: point,
                  withAttributes: [.font: UIFont.systemFont(ofSize: 22, weight: .black),
                                   .foregroundColor: UIColor.white,
                                   .kern: 4])
    }

    /// Right-hand contact block: the profile's letterhead lines, first line
    /// emphasised. Lines land at y = 18, 31, 43 (then every 12pt); at most four
    /// lines are drawn so the block stays above the header separator.
    static func drawContactBlock(x: CGFloat, width: CGFloat = 160) {
        let lines = Array(PracticeProfile.current.letterheadLines.prefix(4))
        for (i, line) in lines.enumerated() {
            if i == 0 {
                line.draw(
                    in: CGRect(x: x, y: 18, width: width, height: 12),
                    withAttributes: [.font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                                     .foregroundColor: UIColor.white.withAlphaComponent(0.90)])
            } else {
                let y: CGFloat = i == 1 ? 31 : 43 + CGFloat(i - 2) * 12
                line.draw(
                    in: CGRect(x: x, y: y, width: width, height: 11),
                    withAttributes: [.font: UIFont.systemFont(ofSize: 7),
                                     .foregroundColor: UIColor.white.withAlphaComponent(0.72)])
            }
        }
    }
}
