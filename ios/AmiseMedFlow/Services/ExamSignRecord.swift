// ExamSignRecord.swift
// The Exam-step sign chips (evidence-exam 1.0.0) are stored as lines in the "Other / additional
// findings" field (Patient.examOther), so they sync, back up and print with the examination:
//
//   [sign] Murphy's sign: present.
//   [sign] No Murphy's sign (examined).
//
// The line text after the prefix is the web record line (artifacts/dashboard/src/lib/
// exam-evidence-features.ts signChipText), so both platforms read the same wording. Unrecorded
// signs were not examined: nothing is ever written as normal by itself.
//
// The Bayesian engine reads the chips through `states(in:)` ("sign" features) and scores the
// free text without the lines of signs that carry their own likelihood ratios
// (`strippingEngineSignLines`), so each sign counts once. Lines of red-flag ("twin") signs stay in
// the text: the text finding is how the engine weighs them.

import Foundation

enum ExamSignRecord {

    static let prefix = "[sign] "

    /// The web record line of a sign: "Murphy's sign: present" / "No Murphy's sign (examined)".
    static func chipText(_ sign: ExamEvidenceCatalogue.Sign, state: String) -> String {
        state == "present" ? "\(sign.name): present" : "No \(lowerFirstWord(sign.name)) (examined)"
    }

    /// The line stored in examOther.
    static func line(_ sign: ExamEvidenceCatalogue.Sign, state: String) -> String {
        prefix + chipText(sign, state: state) + "."
    }

    /// Lower-cases the first letter unless the first word is a name ("Murphy's") or an acronym ("ABPI").
    static func lowerFirstWord(_ name: String) -> String {
        let first = name.split(separator: " ").first.map(String.init) ?? ""
        let chars = Array(first)
        let possessive = first.lowercased().hasSuffix("'s") || first.lowercased().hasSuffix("’s")
        let acronym = chars.count > 1 && chars[1].isLetter && chars[1].isUppercase
        if possessive || acronym || name.isEmpty { return name }
        return name.prefix(1).lowercased() + name.dropFirst()
    }

    private static func parse(_ rawLine: String) -> (id: String, state: String)? {
        let trimmed = rawLine.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix(prefix) else { return nil }
        var body = String(trimmed.dropFirst(prefix.count)).trimmingCharacters(in: .whitespaces)
        if body.hasSuffix(".") { body = String(body.dropLast()) }
        let key = body.lowercased()
        for sign in ExamEvidenceCatalogue.signs {
            if chipText(sign, state: "present").lowercased() == key { return (sign.id, "present") }
            if chipText(sign, state: "absent").lowercased() == key { return (sign.id, "absent") }
        }
        return nil
    }

    /// Sign id → "present" / "absent" for the chip lines in `text`.
    static func states(in text: String?) -> [String: String] {
        var out: [String: String] = [:]
        for line in (text ?? "").components(separatedBy: .newlines) {
            if let hit = parse(line) { out[hit.id] = hit.state }
        }
        return out
    }

    /// `text` with one sign set (nil = not examined: its line removed). Returns nil when empty.
    static func settingState(_ state: String?, signID: String, in text: String?) -> String? {
        var lines = (text ?? "").components(separatedBy: .newlines).filter { line in
            guard let hit = parse(line) else { return true }
            return hit.id != signID
        }
        while let last = lines.last, last.trimmingCharacters(in: .whitespaces).isEmpty { lines.removeLast() }
        if let state, let sign = ExamEvidenceCatalogue.sign(signID) {
            lines.append(line(sign, state: state))
        }
        let joined = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        return joined.isEmpty ? nil : joined
    }

    /// The free text without the lines of signs that carry their own likelihood ratios ("lr"), so the
    /// engine does not also read them as free-text findings.
    static func strippingEngineSignLines(_ text: String) -> String {
        guard text.contains(prefix) else { return text }
        return text.components(separatedBy: .newlines).filter { line in
            guard let hit = parse(line), let sign = ExamEvidenceCatalogue.sign(hit.id) else { return true }
            return sign.engine != "lr"
        }.joined(separator: "\n")
    }

    /// `text` with every state in `states` written (clinical-validation runner: inputs.examSigns).
    static func merged(text: String?, states: [String: String]) -> String? {
        var out = text
        for id in states.keys.sorted() { out = settingState(states[id], signID: id, in: out) }
        return out
    }
}
