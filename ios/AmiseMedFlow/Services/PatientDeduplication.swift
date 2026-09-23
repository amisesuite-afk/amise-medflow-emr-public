import Foundation

// Canonical deduplication logic for the patient list views.
// Identity priority: remoteId (Supabase UUID) → mrn → fullName+DOB.
// When two records share a key, the richer one (most clinical data,
// latest createdAt on tie) wins; sort order from the caller is preserved.

extension Array where Element == Patient {

    func deduped() -> [Patient] {
        var seen: [String: Patient] = [:]
        for p in self {
            let key = p.dedupKey
            if let existing = seen[key] {
                if p.dedupRichness > existing.dedupRichness ||
                   (p.dedupRichness == existing.dedupRichness && p.createdAt > existing.createdAt) {
                    seen[key] = p
                }
            } else {
                seen[key] = p
            }
        }
        return filter { seen[$0.dedupKey]?.id == $0.id }
    }
}

extension Patient {

    /// Stable identity key: remoteId → manually-entered MRN → fullName+DOB.
    /// Auto-generated MRNs (AMF-YYYY-NNNNNN) are excluded from the key because
    /// each "Add" tap increments the counter, so accidental duplicate creations
    /// would otherwise appear as distinct patients.
    var dedupKey: String {
        if let rid = remoteId, !rid.isEmpty { return rid }
        if let m = mrn, !m.isEmpty, !m.hasPrefix("AMF-") { return m }
        let dob = dateOfBirth.map { Int($0.timeIntervalSinceReferenceDate) } ?? 0
        return "\(fullName.lowercased().trimmingCharacters(in: .whitespaces))|\(dob)"
    }

    fileprivate var dedupRichness: Int {
        encounters.count * 10 +
        vitalsEntries.count * 3 +
        clinicalNotes.count * 2 +
        prescriptions.count
    }
}
