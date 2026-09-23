// PreConsultEntrySheet+ApplyLogic.swift
// Pre-consult answer application and helper logic for PreConsultEntrySheet.

import SwiftUI
import SwiftData


extension PreConsultEntrySheet {

    // MARK: - Apply logic

    func applyAnswers() {
        let cc = !selectedCC.isEmpty ? selectedCC
               : (!customCC.trimmingCharacters(in: .whitespaces).isEmpty ? customCC.trimmingCharacters(in: .whitespaces) : nil)

        // CC — only set if currently empty
        if let cc, (patient.chiefComplaint ?? "").isEmpty {
            patient.chiefComplaint = cc
        }

        // Duration — prepend to HPI if HPI is empty
        if !duration.trimmingCharacters(in: .whitespaces).isEmpty,
           (patient.hpi ?? "").isEmpty {
            patient.hpi = "Duration: \(duration.trimmingCharacters(in: .whitespaces))."
        }

        // Associated symptoms — merge with existing
        if !selectedAssoc.isEmpty {
            var existing = Set(
                (patient.associatedSymptoms ?? "")
                    .components(separatedBy: ",")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }
            )
            existing.formUnion(selectedAssoc)
            patient.associatedSymptoms = existing.sorted().joined(separator: ", ")
        }

        // PMH — append unique entries
        var pmh = patient.pmhEntries
        let existingPMH = Set(pmh.map { $0.condition.lowercased() })
        for cond in selectedPMH.sorted() where !existingPMH.contains(cond.lowercased()) {
            pmh.append(PMHEntry(condition: cond))
        }
        for cond in customPMH
            .components(separatedBy: ",")
            .map({ $0.trimmingCharacters(in: .whitespaces) })
            .filter({ !$0.isEmpty }) {
            if !existingPMH.contains(cond.lowercased()) {
                pmh.append(PMHEntry(condition: cond))
            }
        }
        patient.pmhEntries = pmh

        // PSHx — append unique entries
        var pshx = patient.pshxEntries
        let existingPSHx = Set(pshx.map { $0.procedure.lowercased() })
        for proc in selectedPSHx.sorted() where !existingPSHx.contains(proc.lowercased()) {
            pshx.append(PSHxEntry(procedure: proc))
        }
        for proc in customPSHx
            .components(separatedBy: ",")
            .map({ $0.trimmingCharacters(in: .whitespaces) })
            .filter({ !$0.isEmpty }) {
            if !existingPSHx.contains(proc.lowercased()) {
                pshx.append(PSHxEntry(procedure: proc))
            }
        }
        patient.pshxEntries = pshx

        // Medications — append as Prescription objects
        for med in medications {
            let drug = med.drug.trimmingCharacters(in: .whitespaces)
            guard !drug.isEmpty else { continue }
            let rx = Prescription(
                drug: drug,
                dose: med.dose.trimmingCharacters(in: .whitespaces),
                frequency: med.freq.trimmingCharacters(in: .whitespaces)
            )
            rx.patient = patient
            context.insert(rx)
        }

        // Allergies
        if noKnownAllergies {
            // Patient declared NKDA — don't overwrite an existing list, but record intent in pmhNotes
            if patient.allergies.isEmpty {
                // already NKDA by empty list — nothing to set
            }
        } else {
            var existing = patient.allergies
            let existingNames = Set(existing.map { $0.name.lowercased() })
            for row in allergyRows {
                let name = row.name.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { continue }
                if !existingNames.contains(name.lowercased()) {
                    existing.append(AllergyEntry(name: name, severity: row.severity, reaction: row.reaction))
                }
            }
            patient.allergies = existing
        }

        // Family history — append to existing notes
        if !selectedFHx.isEmpty {
            let fhText = selectedFHx.sorted().joined(separator: ", ")
            if let existing = patient.familyHistoryNotes, !existing.isEmpty {
                patient.familyHistoryNotes = existing + "; " + fhText
            } else {
                patient.familyHistoryNotes = fhText
            }
        }

        // Social history — set only if empty
        if (patient.socialHistory ?? "").isEmpty {
            var parts: [String] = []
            if !smokingStatus.isEmpty  { parts.append("Smoking: \(smokingStatus)") }
            if !alcoholStatus.isEmpty  { parts.append("Alcohol: \(alcoholStatus)") }
            if !occupation.trimmingCharacters(in: .whitespaces).isEmpty {
                parts.append("Occupation: \(occupation.trimmingCharacters(in: .whitespaces))")
            }
            if !parts.isEmpty {
                patient.socialHistory = parts.joined(separator: " · ")
            }
        }

        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    // MARK: - Helpers

    func toggle(_ set: inout Set<String>, _ value: String) {
        if set.contains(value) { set.remove(value) } else { set.insert(value) }
    }

    func severityColor(_ v: Int) -> Color {
        switch v {
        case 0:    return .secondary
        case 1...3: return .green
        case 4...6: return .orange
        default:   return .red
        }
    }

}
