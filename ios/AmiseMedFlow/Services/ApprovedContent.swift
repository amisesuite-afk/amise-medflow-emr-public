// ApprovedContent.swift
// Approved-content channel (docs/APPROVED-CONTENT-CHANNEL.md): a signed-off release of a shared
// rule file (clinical-content/rules/<name>.json), published once in Supabase
// (public.clinical_content_releases, Migration 98), replaces the bundled copy without an app
// update — but only when every check below passes; otherwise the bundled file stays in force.
//
// Swift twin of lib/triage-engine/src/approved-content (canonical-json.ts, schema-check.ts,
// select.ts). Both platforms run the shared vectors ios/AmiseMedFlowTests/Resources/
// ApprovedContentVectors.json (ApprovedContentTests.swift here, scripts/src/approved-content.test.ts
// on the web); that test also reads this file for the channel policy, the schema keywords and the
// order of the checks. Change both platforms in the same PR.
//
// Pure and synchronous: no I/O here. Storage and use: ApprovedContentStore.swift; fetch:
// SyncService+ApprovedContent.swift; loader: SharedClinicalContent.swift.

import Foundation
import CryptoKit

enum ApprovedContent {

    // MARK: - Policy

    /// The files the channel is enabled for, by content id (= registry id = the file's `id`; the
    /// zebra rules file is zebra-rules.json with id "diagnostic-reasoning-zebras"), and the
    /// top-level keys a release of each may change (besides `version` and `$comment`). Everything
    /// else must stay identical to the bundled file. Same list as APPROVED_CONTENT_POLICY
    /// (select.ts). A file not listed is never overridden.
    static let policy: [String: [String]] = [
        "diagnostic-reasoning-zebras": ["rules"],
        "supplement-catalogue": ["items"],
    ]

    /// Keys every release may differ in, whatever the file.
    static let alwaysMayChange: Set<String> = ["$comment", "version"]

    // MARK: - JSON value

    /// A parsed JSON value. Integers are kept apart from doubles so a large integer is not
    /// silently rounded (canonicalisation refuses integers outside ±(2^53 − 1)).
    enum Value: Codable, Sendable {
        case null
        case bool(Bool)
        case int(Int64)
        case double(Double)
        case string(String)
        case array([Value])
        case object([String: Value])

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if c.decodeNil() { self = .null; return }
            if let b = try? c.decode(Bool.self) { self = .bool(b); return }
            if let i = try? c.decode(Int64.self) { self = .int(i); return }
            if let d = try? c.decode(Double.self) { self = .double(d); return }
            if let s = try? c.decode(String.self) { self = .string(s); return }
            if let a = try? c.decode([Value].self) { self = .array(a); return }
            if let o = try? c.decode([String: Value].self) { self = .object(o); return }
            throw DecodingError.dataCorruptedError(in: c, debugDescription: "Not a JSON value")
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.singleValueContainer()
            switch self {
            case .null: try c.encodeNil()
            case .bool(let b): try c.encode(b)
            case .int(let i): try c.encode(i)
            case .double(let d): try c.encode(d)
            case .string(let s): try c.encode(s)
            case .array(let a): try c.encode(a)
            case .object(let o): try c.encode(o)
            }
        }

        var objectValue: [String: Value]? {
            if case .object(let o) = self { return o }
            return nil
        }

        var stringValue: String? {
            if case .string(let s) = self { return s }
            return nil
        }

        var numberValue: Double? {
            switch self {
            case .int(let i): return Double(i)
            case .double(let d): return d.isFinite ? d : nil
            default: return nil
            }
        }

        var isInteger: Bool {
            switch self {
            case .int: return true
            case .double(let d): return d.isFinite && d == d.rounded(.towardZero)
            default: return false
            }
        }
    }

    /// Parses JSON data into a Value (nil when it is not JSON).
    static func parse(_ data: Data) -> Value? {
        try? JSONDecoder().decode(Value.self, from: data)
    }

    // MARK: - Canonical JSON + SHA-256 (definition: canonical-json.ts header)

    struct CanonicalError: Error, Sendable {
        let text: String
    }

    static let maxSafeInteger: Int64 = 9_007_199_254_740_991
    private static let maxDepth = 64

    /// Canonical text: keys sorted by UTF-16 code units, no whitespace, minimal string escapes,
    /// numbers in plain decimal with shortest round-trip digits.
    static func canonicalJSON(_ value: Value) throws -> String {
        var out = ""
        try write(value, into: &out, depth: 0)
        return out
    }

    private static func write(_ value: Value, into out: inout String, depth: Int) throws {
        guard depth <= maxDepth else { throw CanonicalError(text: "nested deeper than \(maxDepth)") }
        switch value {
        case .null:
            out += "null"
        case .bool(let b):
            out += b ? "true" : "false"
        case .int(let i):
            out += try canonicalInteger(i)
        case .double(let d):
            out += try canonicalNumber(d)
        case .string(let s):
            out += canonicalString(s)
        case .array(let items):
            out += "["
            for (index, item) in items.enumerated() {
                if index > 0 { out += "," }
                try write(item, into: &out, depth: depth + 1)
            }
            out += "]"
        case .object(let members):
            let keys = members.keys.sorted { $0.utf16.lexicographicallyPrecedes($1.utf16) }
            out += "{"
            for (index, key) in keys.enumerated() {
                if index > 0 { out += "," }
                out += canonicalString(key)
                out += ":"
                if let member = members[key] {
                    try write(member, into: &out, depth: depth + 1)
                }
            }
            out += "}"
        }
    }

    static func canonicalInteger(_ i: Int64) throws -> String {
        guard i >= -maxSafeInteger && i <= maxSafeInteger else {
            throw CanonicalError(text: "integer outside ±(2^53 − 1)")
        }
        return String(i)
    }

    static func canonicalNumber(_ d: Double) throws -> String {
        guard d.isFinite else { throw CanonicalError(text: "non-finite number") }
        if d == d.rounded(.towardZero) {
            guard abs(d) <= Double(maxSafeInteger) else { throw CanonicalError(text: "integer outside ±(2^53 − 1)") }
            return String(Int64(d))
        }
        // Double.description gives the shortest digits that round-trip (like ECMAScript).
        return plainDecimal(d.description)
    }

    /// Rewrites "1e-07", "-1.5e-7", "123.45", "1.5e+21" in plain decimal notation (twin of plainDecimal in canonical-json.ts).
    static func plainDecimal(_ text: String) -> String {
        var s = Substring(text)
        let negative = s.hasPrefix("-")
        if negative { s = s.dropFirst() }
        var mantissa = s
        var exponent = 0
        if let e = s.firstIndex(where: { $0 == "e" || $0 == "E" }) {
            mantissa = s[s.startIndex..<e]
            exponent = Int(s[s.index(after: e)...]) ?? 0
        }
        let parts = mantissa.split(separator: ".", maxSplits: 1, omittingEmptySubsequences: false)
        let intPart = parts.isEmpty ? "" : String(parts[0])
        let fracPart = parts.count > 1 ? String(parts[1]) : ""
        var digits = Array(intPart + fracPart)
        var point = intPart.count + exponent
        var lead = 0
        while lead < digits.count - 1 && digits[lead] == "0" { lead += 1 }
        digits.removeFirst(lead)
        point -= lead
        while let last = digits.last, last == "0" { digits.removeLast() }
        if digits.isEmpty { return "0" }
        let body: String
        if point <= 0 {
            body = "0." + String(repeating: "0", count: -point) + String(digits)
        } else if point >= digits.count {
            body = String(digits) + String(repeating: "0", count: point - digits.count)
        } else {
            body = String(digits[0..<point]) + "." + String(digits[point...])
        }
        return negative ? "-" + body : body
    }

    static func canonicalString(_ s: String) -> String {
        var out = "\""
        for scalar in s.unicodeScalars {
            switch scalar.value {
            case 0x22: out += "\\\""
            case 0x5C: out += "\\\\"
            case 0x08: out += "\\b"
            case 0x0C: out += "\\f"
            case 0x0A: out += "\\n"
            case 0x0D: out += "\\r"
            case 0x09: out += "\\t"
            case 0..<0x20:
                let hex = String(scalar.value, radix: 16)
                out += "\\u" + String(repeating: "0", count: max(0, 4 - hex.count)) + hex
            default:
                out.unicodeScalars.append(scalar)
            }
        }
        out += "\""
        return out
    }

    /// SHA-256 of the UTF-8 bytes of a text, as 64 lowercase hex digits.
    static func sha256Hex(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// SHA-256 of the canonical text of a value (nil when it cannot be canonicalised).
    static func contentSha256(_ value: Value) -> String? {
        guard let text = try? canonicalJSON(value) else { return nil }
        return sha256Hex(text)
    }

    /// Structural equality of two JSON values (numbers by value).
    static func jsonEqual(_ a: Value, _ b: Value) -> Bool {
        switch (a, b) {
        case (.null, .null): return true
        case (.bool(let x), .bool(let y)): return x == y
        case (.string(let x), .string(let y)): return x == y
        case (.array(let x), .array(let y)):
            return x.count == y.count && zip(x, y).allSatisfy { jsonEqual($0, $1) }
        case (.object(let x), .object(let y)):
            guard x.count == y.count else { return false }
            for (k, v) in x {
                guard let w = y[k], jsonEqual(v, w) else { return false }
            }
            return true
        default:
            if let x = a.numberValue, let y = b.numberValue { return x == y }
            return false
        }
    }

    // MARK: - Semver

    /// (major, minor, patch), or nil unless the text is exactly MAJOR.MINOR.PATCH (no pre-release,
    /// no leading zeros, at most 9 digits each).
    static func parseSemver(_ text: String) -> [Int]? {
        let parts = text.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3 else { return nil }
        var out: [Int] = []
        for part in parts {
            guard !part.isEmpty, part.count <= 9,
                  part.allSatisfy({ $0.isASCII && $0.isNumber }),
                  !(part.count > 1 && part.first == "0"),
                  let n = Int(part) else { return nil }
            out.append(n)
        }
        return out
    }

    /// Negative, zero or positive as a < b, a = b, a > b.
    static func compareSemver(_ a: [Int], _ b: [Int]) -> Int {
        for i in 0..<3 where a[i] != b[i] { return a[i] - b[i] }
        return 0
    }

    // MARK: - Schema check (twin of schema-check.ts)

    /// Every schema keyword the checker understands (annotations included). Same list as
    /// SCHEMA_CHECK_KEYWORDS; any other keyword makes the schema check fail (fail-closed).
    static let supportedKeywords: Set<String> = [
        "$comment", "$defs", "$id", "$ref", "$schema", "additionalProperties", "allOf", "anyOf", "const",
        "default", "description", "enum", "examples", "exclusiveMaximum", "exclusiveMinimum", "items",
        "maxItems", "maxLength", "maxProperties", "maximum", "minItems", "minLength", "minProperties",
        "minimum", "oneOf", "pattern", "patternProperties", "properties", "propertyNames", "required",
        "title", "type",
    ]

    /// Problems found checking `data` against `schema` (empty = valid), at most 20: key paths and
    /// rule names only, never a value.
    static func schemaProblems(schema: Value, data: Value) -> [String] {
        let checker = SchemaChecker(root: schema)
        checker.check(schema, data, path: "", depth: 0)
        return checker.problems
    }

    private final class SchemaChecker {
        let root: Value
        var problems: [String] = []
        var regexCache: [String: NSRegularExpression?]
        private let maxProblems = 20

        init(root: Value, regexCache: [String: NSRegularExpression?] = [:]) {
            self.root = root
            self.regexCache = regexCache
        }

        private func add(_ path: String, _ message: String) {
            if problems.count < maxProblems { problems.append("\(path.isEmpty ? "/" : path): \(message)") }
        }

        private func regex(_ pattern: String) -> NSRegularExpression? {
            if let cached = regexCache[pattern] { return cached }
            let re = try? NSRegularExpression(pattern: pattern)
            regexCache[pattern] = re
            return re
        }

        private func matches(_ re: NSRegularExpression, _ s: String) -> Bool {
            re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
        }

        private func resolveRef(_ ref: String) -> Value? {
            if ref == "#" { return root }
            guard ref.hasPrefix("#/") else { return nil }
            var node: Value = root
            for raw in ref.dropFirst(2).split(separator: "/", omittingEmptySubsequences: false) {
                let part = (String(raw).removingPercentEncoding ?? String(raw))
                    .replacingOccurrences(of: "~1", with: "/").replacingOccurrences(of: "~0", with: "~")
                guard let next = node.objectValue?[part] else { return nil }
                node = next
            }
            switch node {
            case .bool, .object: return node
            default: return nil
            }
        }

        private func typeMatches(_ type: String, _ v: Value) -> Bool {
            switch (type, v) {
            case ("null", .null), ("boolean", .bool), ("object", .object), ("array", .array), ("string", .string):
                return true
            case ("number", _):
                return v.numberValue != nil
            case ("integer", _):
                return v.isInteger
            default:
                return false
            }
        }

        private func passes(_ schema: Value, _ data: Value, path: String, depth: Int) -> Bool {
            let sub = SchemaChecker(root: root, regexCache: regexCache)
            sub.check(schema, data, path: path, depth: depth)
            regexCache = sub.regexCache
            return sub.problems.isEmpty
        }

        private func number(_ v: Value?) -> Double? { v?.numberValue }

        func check(_ schemaValue: Value, _ data: Value, path: String, depth: Int) {
            if problems.count >= maxProblems { return }
            if depth > 256 { add(path, "schema nested too deeply"); return }
            if case .bool(let allowed) = schemaValue {
                if !allowed { add(path, "not allowed (false schema)") }
                return
            }
            guard let schema = schemaValue.objectValue else { add(path, "schema is not an object"); return }

            for key in schema.keys.sorted() where !ApprovedContent.supportedKeywords.contains(key) {
                add(path, "unsupported schema keyword \"\(key)\"")
            }

            if let ref = schema["$ref"] {
                if let r = ref.stringValue, let target = resolveRef(r) {
                    check(target, data, path: path, depth: depth + 1)
                } else {
                    add(path, "unresolved $ref")
                }
            }

            if let type = schema["type"] {
                let types: [String]
                switch type {
                case .string(let t): types = [t]
                case .array(let list): types = list.compactMap(\.stringValue)
                default: types = []
                }
                if !types.contains(where: { typeMatches($0, data) }) {
                    add(path, "expected \(types.joined(separator: " or "))")
                    return
                }
            }
            if let allowed = schema["enum"] {
                if case .array(let list) = allowed, list.contains(where: { ApprovedContent.jsonEqual($0, data) }) {
                    // allowed
                } else {
                    add(path, "not one of the allowed values")
                }
            }
            if let constant = schema["const"], !ApprovedContent.jsonEqual(constant, data) {
                add(path, "not the required constant")
            }

            if case .string(let s) = data {
                let length = s.unicodeScalars.count
                if let minL = number(schema["minLength"]), Double(length) < minL { add(path, "shorter than \(minL)") }
                if let maxL = number(schema["maxLength"]), Double(length) > maxL { add(path, "longer than \(maxL)") }
                if let pattern = schema["pattern"] {
                    if let p = pattern.stringValue, let re = regex(p) {
                        if !matches(re, s) { add(path, "does not match the pattern") }
                    } else {
                        add(path, "invalid pattern in schema")
                    }
                }
            }

            if let x = data.numberValue {
                if let min = number(schema["minimum"]), x < min { add(path, "below \(min)") }
                if let max = number(schema["maximum"]), x > max { add(path, "above \(max)") }
                if let xmin = number(schema["exclusiveMinimum"]), x <= xmin { add(path, "not above \(xmin)") }
                if let xmax = number(schema["exclusiveMaximum"]), x >= xmax { add(path, "not below \(xmax)") }
            }

            if case .array(let items) = data {
                if let minI = number(schema["minItems"]), Double(items.count) < minI { add(path, "fewer than \(minI) items") }
                if let maxI = number(schema["maxItems"]), Double(items.count) > maxI { add(path, "more than \(maxI) items") }
                if let itemSchema = schema["items"] {
                    switch itemSchema {
                    case .bool, .object:
                        for (i, item) in items.enumerated() {
                            check(itemSchema, item, path: "\(path)/\(i)", depth: depth + 1)
                        }
                    default:
                        add(path, "unsupported \"items\" form")
                    }
                }
            }

            if case .object(let members) = data {
                if let minP = number(schema["minProperties"]), Double(members.count) < minP { add(path, "fewer than \(minP) properties") }
                if let maxP = number(schema["maxProperties"]), Double(members.count) > maxP { add(path, "more than \(maxP) properties") }
                if case .array(let required)? = schema["required"] {
                    for name in required.compactMap(\.stringValue) where members[name] == nil {
                        add(path, "missing \"\(name)\"")
                    }
                }
                let props = schema["properties"]?.objectValue ?? [:]
                let patternProps = schema["patternProperties"]?.objectValue ?? [:]
                for key in members.keys.sorted(by: { $0.utf16.lexicographicallyPrecedes($1.utf16) }) {
                    guard let value = members[key] else { continue }
                    let childPath = path + "/" + key.replacingOccurrences(of: "~", with: "~0").replacingOccurrences(of: "/", with: "~1")
                    var matched = false
                    if let propSchema = props[key] {
                        matched = true
                        check(propSchema, value, path: childPath, depth: depth + 1)
                    }
                    for pattern in patternProps.keys.sorted() {
                        guard let re = regex(pattern), let sub = patternProps[pattern] else {
                            add(path, "invalid patternProperties pattern")
                            continue
                        }
                        if matches(re, key) {
                            matched = true
                            check(sub, value, path: childPath, depth: depth + 1)
                        }
                    }
                    if !matched, let additional = schema["additionalProperties"] {
                        check(additional, value, path: childPath, depth: depth + 1)
                    }
                    if let names = schema["propertyNames"] {
                        check(names, .string(key), path: childPath, depth: depth + 1)
                    }
                }
            }

            if let all = schema["allOf"] {
                if case .array(let list) = all {
                    for sub in list { check(sub, data, path: path, depth: depth + 1) }
                } else {
                    add(path, "allOf is not a list")
                }
            }
            if let any = schema["anyOf"] {
                var ok = false
                if case .array(let list) = any {
                    ok = list.contains { passes($0, data, path: path, depth: depth + 1) }
                }
                if !ok { add(path, "matches none of anyOf") }
            }
            if let one = schema["oneOf"] {
                var n = 0
                if case .array(let list) = one {
                    n = list.filter { passes($0, data, path: path, depth: depth + 1) }.count
                }
                if n != 1 { add(path, n == 0 ? "matches none of oneOf" : "matches more than one of oneOf") }
            }
        }
    }

    // MARK: - Releases and selection (twin of select.ts)

    /// One row of public.clinical_content_releases (field names as PostgREST returns them).
    struct Release: Codable, Sendable {
        let id: String?
        let content_id: String
        let version: String
        let sha256: String
        let body: Value
        let published_at: String?
        let signoff_ref: String?
        let revoked_at: String?
    }

    enum RejectReason: String, Sendable {
        case wrongContent = "wrong-content"
        case revoked = "revoked"
        case badVersion = "bad-version"
        case notNewer = "not-newer"
        case malformed = "malformed"
        case hashMismatch = "hash-mismatch"
        case idMismatch = "id-mismatch"
        case versionMismatch = "version-mismatch"
        case schemaInvalid = "schema-invalid"
        case pinnedFieldChanged = "pinned-field-changed"
    }

    struct Rejected: Sendable {
        let version: String
        let reason: RejectReason
        /// Key path or check that failed (never a content value).
        let detail: String?
    }

    enum Source: String, Sendable {
        case bundled
        case release
    }

    struct Selection: Sendable {
        let contentId: String
        let source: Source
        /// The content in force.
        let body: Value
        /// Version of the content in force.
        let version: String
        let bundledVersion: String
        /// The release in force (nil when the bundled file is).
        let release: Release?
        /// Releases tried before the one in force (or all of them, when the bundled file is in force).
        let rejected: [Rejected]
    }

    private enum Outcome {
        case pass
        case reject(RejectReason, String?)
    }

    private static func isHex64(_ s: String) -> Bool {
        s.utf8.count == 64 && s.utf8.allSatisfy { (0x30...0x39).contains($0) || (0x61...0x66).contains($0) }
    }

    /// The ten checks, in the order of select.ts (the first failure is the release's reason).
    private static func check(_ r: Release, contentId: String, bundled: Value, bundledSemver: [Int]?,
                              schema: Value, mayChange: [String]) -> Outcome {
        guard r.content_id == contentId else { return .reject(.wrongContent, nil) }
        if let revoked = r.revoked_at, !revoked.isEmpty { return .reject(.revoked, nil) }
        guard let v = parseSemver(r.version) else { return .reject(.badVersion, nil) }
        guard let floor = bundledSemver, compareSemver(v, floor) > 0 else { return .reject(.notNewer, nil) }
        guard let body = r.body.objectValue else { return .reject(.malformed, "body is not an object") }
        guard let canonical = try? canonicalJSON(r.body) else { return .reject(.malformed, "body cannot be canonicalised") }
        guard isHex64(r.sha256), sha256Hex(canonical) == r.sha256 else { return .reject(.hashMismatch, nil) }
        guard body["id"]?.stringValue == contentId else { return .reject(.idMismatch, nil) }
        guard body["version"]?.stringValue == r.version else { return .reject(.versionMismatch, nil) }
        let problems = schemaProblems(schema: schema, data: r.body)
        if let first = problems.first { return .reject(.schemaInvalid, first) }
        let bundledObject = bundled.objectValue ?? [:]
        let free = alwaysMayChange.union(mayChange)
        let keys = Set(bundledObject.keys).union(body.keys).sorted { $0.utf16.lexicographicallyPrecedes($1.utf16) }
        for key in keys where !free.contains(key) {
            let before = bundledObject[key]
            let after = body[key]
            if (before == nil) != (after == nil) { return .reject(.pinnedFieldChanged, "/\(key)") }
            if let before, let after, (try? canonicalJSON(before)) != (try? canonicalJSON(after)) {
                return .reject(.pinnedFieldChanged, "/\(key)")
            }
        }
        return .pass
    }

    /// Which copy is in force: the highest-version release that passes every check, else the bundled file.
    static func select(contentId: String, bundled: Value, schema: Value, mayChange: [String],
                       releases: [Release]) -> Selection {
        let bundledVersion = bundled.objectValue?["version"]?.stringValue ?? ""
        let bundledSemver = parseSemver(bundledVersion)
        let ordered = releases.enumerated().sorted { a, b in
            let va = parseSemver(a.element.version)
            let vb = parseSemver(b.element.version)
            switch (va, vb) {
            case let (x?, y?):
                let c = compareSemver(y, x)
                return c != 0 ? c < 0 : a.offset < b.offset
            case (.some, .none): return true
            case (.none, .some): return false
            case (.none, .none): return a.offset < b.offset
            }
        }.map(\.element)

        var rejected: [Rejected] = []
        for r in ordered {
            switch check(r, contentId: contentId, bundled: bundled, bundledSemver: bundledSemver,
                         schema: schema, mayChange: mayChange) {
            case .reject(let reason, let detail):
                rejected.append(Rejected(version: r.version, reason: reason, detail: detail))
            case .pass:
                return Selection(contentId: contentId, source: .release, body: r.body, version: r.version,
                                 bundledVersion: bundledVersion, release: r, rejected: rejected)
            }
        }
        return Selection(contentId: contentId, source: .bundled, body: bundled, version: bundledVersion,
                         bundledVersion: bundledVersion, release: nil, rejected: rejected)
    }

    /// `select` with the file's channel policy: a file the channel is not enabled for always gets
    /// its bundled copy (no release is looked at).
    static func selectForChannel(contentId: String, bundled: Value, schema: Value, releases: [Release]) -> Selection {
        guard let mayChange = policy[contentId] else {
            return select(contentId: contentId, bundled: bundled, schema: schema, mayChange: [], releases: [])
        }
        return select(contentId: contentId, bundled: bundled, schema: schema, mayChange: mayChange, releases: releases)
    }
}
