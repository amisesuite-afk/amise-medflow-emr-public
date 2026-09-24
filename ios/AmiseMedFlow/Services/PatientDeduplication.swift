import Foundation
import SwiftData

// Patient identity and duplicate handling.
//
// Lists show one row per person. Identity uses MRN/remoteId AND name:
// - Two local copies of the same record (same remoteId or manual MRN) collapse to one.
// - Same name + non-conflicting DOB: the extra copies that hold NO clinical data are hidden
//   behind the record that is kept (the one with clinical data, else the oldest). A copy with
//   clinical data is never hidden. Groups marked "different people" are never collapsed.
// The duplicate banner/review sheet (DuplicatePatientsSheet) lets the clinician clean them up.

extension Array where Element == Patient {

    func deduped() -> [Patient] {
        let live = filter(\.isLive)
        var seen: [String: Patient] = [:]
        for p in live {
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
        let unique = live.filter { seen[$0.dedupKey]?.id == $0.id }
        // Hide empty same-name copies behind the record that is kept.
        var hidden = Set<UUID>()
        for group in unique.possibleDuplicateGroups() {
            let keep = group.duplicateKeeper
            for p in group where p.id != keep.id && !p.hasClinicalData { hidden.insert(p.id) }
        }
        return hidden.isEmpty ? unique : unique.filter { !hidden.contains($0.id) }
    }

    /// Existing records that a new registration with this name/DOB would duplicate:
    /// same name, and DOBs that don't contradict (equal, or missing on either side).
    /// One patient per name: a second record is only allowed for a different DOB.
    func registeredMatches(name: String, dateOfBirth: Date?) -> [Patient] {
        let key = Patient.normalize(name)
        guard !key.isEmpty else { return [] }
        return filter { p in
            guard p.isLive, p.normalizedName == key else { return false }
            guard let a = dateOfBirth, let b = p.dateOfBirth else { return true }
            return Calendar.current.isDate(a, inSameDayAs: b)
        }
    }

    /// The record kept from a duplicate group: the first with clinical data, else the oldest.
    var duplicateKeeper: Patient {
        first(where: \.hasClinicalData) ?? self[0]
    }

    /// Groups of records that look like the same person: same name (case/space-insensitive) and
    /// DOBs that do not contradict each other (equal, or missing on one side). Pairs the clinician
    /// has marked as different people are excluded. Each group has 2+ records, oldest first.
    func possibleDuplicateGroups() -> [[Patient]] {
        // Read the "different people" list once, not once per pair.
        let distinct = PatientIdentityStore.distinctPairSet()
        let byName = Dictionary(grouping: filter(\.isLive)) { $0.normalizedName }
        var groups: [[Patient]] = []
        for (name, records) in byName where !name.isEmpty && records.count > 1 {
            let sorted = records.sorted { $0.createdAt < $1.createdAt }
            var remaining = sorted
            while let first = remaining.first {
                remaining.removeFirst()
                var group = [first]
                remaining.removeAll { other in
                    guard group.allSatisfy({ $0.mayBeSamePerson(as: other, distinct: distinct) }) else { return false }
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

    /// Still attached to a context and not deleted. Reading attributes of a deleted model after
    /// save (before @Query refreshes) crashes SwiftData, so lists filter on this first.
    var isLive: Bool { modelContext != nil && !isDeleted }

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

    fileprivate func mayBeSamePerson(as other: Patient, distinct: Set<String>) -> Bool {
        if distinct.contains(PatientIdentityStore.pairKey(self, other)) { return false }
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

    /// `survivors` are the other local records. An id still held by one of them (two local copies
    /// of the same cloud record) is not remembered, so the kept copy keeps syncing.
    static func markDeleted(_ patient: Patient, survivors: [Patient] = []) {
        var ids = UserDefaults.standard.stringArray(forKey: deletedKey) ?? []
        let stillHeld = Set(survivors.filter { $0.id != patient.id }.flatMap { [$0.remoteId, $0.syncCode] }.compactMap { $0 })
        for key in [patient.remoteId, patient.syncCode] {
            if let key, !key.isEmpty, !stillHeld.contains(key), !ids.contains(key) { ids.append(key) }
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

    static func distinctPairSet() -> Set<String> { distinctPairs }

    private static var distinctPairs: Set<String> {
        let raw = UserDefaults.standard.string(forKey: distinctKey) ?? ""
        return Set(raw.split(separator: "\n").map(String.init))
    }

    static func pairKey(_ a: Patient, _ b: Patient) -> String {
        [a.syncCode.isEmpty ? a.id.uuidString : a.syncCode,
         b.syncCode.isEmpty ? b.id.uuidString : b.syncCode].sorted().joined(separator: "|")
    }
}

extension ModelContext {
    /// Delete a patient on this device and remember it so sync does not bring it back.
    @MainActor
    func deletePatient(_ patient: Patient) {
        AuditLog.record("delete", "patient", patient: patient)
        CrashReporting.breadcrumb("Deleted a patient record", category: "action")
        let others = ((try? fetch(FetchDescriptor<Patient>())) ?? []).filter(\.isLive)
        PatientIdentityStore.markDeleted(patient, survivors: others)
        delete(patient)
    }
}
