import Foundation
import SwiftData

// Patient identity and duplicate handling.
//
// Lists hide a record only when the SAME record appears twice locally: it has the same
// Supabase row (remoteId) or the same manually-entered MRN. Two records that only share a name
// are NOT hidden. Two different patients can share a name (and often lack a DOB at booking),
// and hiding one of them would make a real chart disappear. Same-name records are instead
// surfaced in the Patients list for the clinician to review (see DuplicatePatientsSheet).

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

    /// Groups of records that look like the same person: same name (case/space-insensitive) and
    /// DOBs that do not contradict each other (equal, or missing on one side). Pairs the clinician
    /// has marked as different people are excluded. Each group has 2+ records, oldest first.
    func possibleDuplicateGroups() -> [[Patient]] {
        let byName = Dictionary(grouping: self) { $0.normalizedName }
        var groups: [[Patient]] = []
        for (name, records) in byName where !name.isEmpty && records.count > 1 {
            let sorted = records.sorted { $0.createdAt < $1.createdAt }
            var remaining = sorted
            while let first = remaining.first {
                remaining.removeFirst()
                var group = [first]
                remaining.removeAll { other in
                    guard group.allSatisfy({ $0.mayBeSamePerson(as: other) }) else { return false }
                    group.append(other)
                    return true
                }
                if group.count > 1 { groups.append(group) }
            }
        }
        return groups.sorted { $0[0].fullName < $1[0].fullName }
    }
}

extension Patient {

    /// Stable identity key: remoteId → manually-entered MRN → local record id.
    /// Auto-generated MRNs (AMF-YYYY-NNNNNN) are excluded because they are unique per record
    /// by construction and say nothing about whether two records are the same person.
    var dedupKey: String {
        if let rid = remoteId, !rid.isEmpty { return rid }
        if let m = mrn, !m.isEmpty, !m.hasPrefix("AMF-") { return m }
        return id.uuidString
    }

    var normalizedName: String { Patient.normalize(fullName) }

    static func normalize(_ name: String) -> String {
        name.lowercased().split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    /// True when the record holds anything clinical. Such records are never offered for removal
    /// by the duplicate review. The clinician must deal with them from the chart itself.
    var hasClinicalData: Bool {
        if dedupRichness > 0 || !documents.isEmpty || !operativePlans.isEmpty ||
            !billingItems.isEmpty || !scoreHistory.isEmpty { return true }
        let text = [hpi, assessmentText, managementPlan, workingDiagnosis, examGeneral, examAbdo]
        return text.contains { !($0 ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    var clinicalDataSummary: String {
        var parts: [String] = []
        func add(_ n: Int, _ label: String) { if n > 0 { parts.append("\(n) \(label)") } }
        add(clinicalNotes.count, "notes")
        add(vitalsEntries.count, "vitals")
        add(prescriptions.count, "Rx")
        add(encounters.count, "encounters")
        add(documents.count, "docs")
        add(operativePlans.count, "op plans")
        add(scoreHistory.count, "scores")
        if parts.isEmpty && hasClinicalData { parts.append("history/assessment text") }
        return parts.isEmpty ? "No clinical data" : parts.joined(separator: " · ")
    }

    fileprivate func mayBeSamePerson(as other: Patient) -> Bool {
        if PatientIdentityStore.markedDistinct(self, other) { return false }
        guard let a = dateOfBirth, let b = other.dateOfBirth else { return true }
        return Calendar.current.isDate(a, inSameDayAs: b)
    }

    fileprivate var dedupRichness: Int {
        encounters.count * 10 +
        vitalsEntries.count * 3 +
        clinicalNotes.count * 2 +
        prescriptions.count
    }
}

// MARK: - Local identity bookkeeping

/// Per-device memory of two things:
/// - Deleted remote records. Deletes on this device are local only (staff accounts cannot delete
///   Supabase patient rows; that is admin-only). Without this list, the next sync pull
///   re-creates every deleted patient.
/// - Same-name pairs the clinician confirmed are different people, so they stop being flagged.
enum PatientIdentityStore {
    private static let deletedKey  = "amf.patients.deletedRemoteIds"
    /// Stored as a newline-joined String so views can observe it with @AppStorage.
    static let distinctKey = "amf.patients.distinctPairs"

    /// `id` is a Supabase remoteId, an "appt:" sentinel, or a peer-sync syncCode.
    static func isDeleted(_ id: String?) -> Bool {
        guard let id, !id.isEmpty else { return false }
        return (UserDefaults.standard.stringArray(forKey: deletedKey) ?? []).contains(id)
    }

    static func markDeleted(_ patient: Patient) {
        var ids = UserDefaults.standard.stringArray(forKey: deletedKey) ?? []
        for key in [patient.remoteId, patient.syncCode] {
            if let key, !key.isEmpty, !ids.contains(key) { ids.append(key) }
        }
        UserDefaults.standard.set(ids, forKey: deletedKey)
    }

    static func markDistinct(_ group: [Patient]) {
        var pairs = distinctPairs
        for a in group { for b in group where a.id != b.id { pairs.insert(pairKey(a, b)) } }
        UserDefaults.standard.set(pairs.sorted().joined(separator: "\n"), forKey: distinctKey)
    }

    static func markedDistinct(_ a: Patient, _ b: Patient) -> Bool {
        distinctPairs.contains(pairKey(a, b))
    }

    private static var distinctPairs: Set<String> {
        let raw = UserDefaults.standard.string(forKey: distinctKey) ?? ""
        return Set(raw.split(separator: "\n").map(String.init))
    }

    private static func pairKey(_ a: Patient, _ b: Patient) -> String {
        [a.syncCode.isEmpty ? a.id.uuidString : a.syncCode,
         b.syncCode.isEmpty ? b.id.uuidString : b.syncCode].sorted().joined(separator: "|")
    }
}

extension ModelContext {
    /// Delete a patient on this device and remember it so sync does not bring it back.
    func deletePatient(_ patient: Patient) {
        PatientIdentityStore.markDeleted(patient)
        delete(patient)
    }
}
