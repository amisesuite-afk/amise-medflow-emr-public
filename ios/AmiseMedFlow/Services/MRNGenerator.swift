import Foundation

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
    static func next() -> String {
        let defaults = UserDefaults.standard
        let last = defaults.integer(forKey: sequenceKey)
        let next = last + 1
        defaults.set(next, forKey: sequenceKey)
        let year = Calendar.current.component(.year, from: .now)
        return formatted(year: year, sequence: next)
    }

    /// Assign a new MRN to a patient that was created without one (back-fill).
    /// No-op if the patient already has an MRN.
    static func backfillIfNeeded(_ patient: Patient) {
        guard patient.mrn == nil || patient.mrn?.isEmpty == true else { return }
        patient.mrn = next()
    }

    // MARK: - Internal

    static func formatted(year: Int, sequence: Int) -> String {
        String(format: "AMF-%d-%06d", year, sequence)
    }
}
