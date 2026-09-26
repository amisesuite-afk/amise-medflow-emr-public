import Foundation
import SwiftData

// MARK: - Medical Record Number generator
//
// Produces AMF-YYYY-NNNNNN (e.g. AMF-2025-000047).
// Counter is per-device via UserDefaults. For a single-surgeon practice on
// one or two iPads this is collision-free in practice. On cloud sync, the
// first device to register a patient wins; the MRN is propagated to other
// devices via SyncService and never regenerated once assigned.

enum MRNGenerator {

    private static let sequenceKey = "amf.mrn.lastSequence"

    /// Return the next MRN and advance the counter.
    ///
    /// Pass every patient this device knows about (including ones pulled from the cloud or a
    /// nearby device). The sequence then continues above the highest AMF number already in use,
    /// so the iPhone and iPad do not both issue the same MRN from their own counters.
    static func next(existing: [Patient] = []) -> String {
        let defaults = UserDefaults.standard
        let inUse = Set(existing.compactMap(\.mrn))
        let highestKnown = inUse.compactMap(sequence(of:)).max() ?? 0
        var next = max(defaults.integer(forKey: sequenceKey), highestKnown) + 1
        let year = Calendar.current.component(.year, from: .now)
        while inUse.contains(formatted(year: year, sequence: next)) { next += 1 }
        defaults.set(next, forKey: sequenceKey)
        return formatted(year: year, sequence: next)
    }

    /// Convenience for code that has a ModelContext but no @Query of patients.
    static func next(in context: ModelContext) -> String {
        next(existing: (try? context.fetch(FetchDescriptor<Patient>())) ?? [])
    }

    /// Assign a new MRN to a patient that was created without one (back-fill).
    /// No-op if the patient already has an MRN.
    static func backfillIfNeeded(_ patient: Patient, existing: [Patient] = []) {
        guard patient.mrn == nil || patient.mrn?.isEmpty == true else { return }
        patient.mrn = next(existing: existing)
    }

    static func backfillIfNeeded(_ patient: Patient, in context: ModelContext) {
        guard patient.mrn == nil || patient.mrn?.isEmpty == true else { return }
        patient.mrn = next(in: context)
    }

    /// The NNNNNN part of an AMF-YYYY-NNNNNN MRN, or nil for manual/other formats.
    static func sequence(of mrn: String) -> Int? {
        let parts = mrn.split(separator: "-")
        guard parts.count == 3, parts[0] == "AMF" else { return nil }
        return Int(parts[2])
    }

    // MARK: - Internal

    static func formatted(year: Int, sequence: Int) -> String {
        String(format: "AMF-%d-%06d", year, sequence)
    }
}
