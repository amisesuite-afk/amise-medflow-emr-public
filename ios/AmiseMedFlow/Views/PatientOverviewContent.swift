import SwiftUI
import SwiftData
import UIKit

// PatientOverviewContent.swift
// Patient overview content — shared between iPhone and iPad.

// MARK: - Overview content (shared between iPhone overview tab and iPad panel)

struct PatientOverviewContent: View {
    @Bindable var patient: Patient

    // body reads these once per render into locals (they were read 3-10 times each: every read
    // re-sorted the vitals or notes, re-ran the NEWS2 chart, or decoded the allergies /
    // investigations JSON again).

    var latestVitals: VitalsEntry? {
        ListPerf.newest(patient.vitalsEntries.filter(\.isLive), by: { $0.recordedAt })
    }

    var latestNote: ClinicalNote? {
        ListPerf.newest(patient.clinicalNotes.filter(\.isLive), by: { $0.createdAt })
    }

    var criticalAllergies: [AllergyEntry] {
        patient.allergies.filter {
            $0.severity.lowercased().contains("anaphylaxis") ||
            $0.severity.lowercased().contains("severe")
        }
    }

    func criticalLabSummary(_ labs: LabPanel) -> String {
        let tokens: [String?] = [
            labs.haemoglobin.flatMap { $0.value < 8 ? String(format: "Hb %.1f g/dL", $0.value) : nil },
            labs.platelets.flatMap { $0.value < 50 ? "Plt \(Int($0.value)) ×10⁹/L" : nil },
            labs.creatinine.flatMap { $0.value > 300 ? "Cr \(Int($0.value)) µmol/L" : nil },
            labs.inr.flatMap { $0.value > 2.5 ? String(format: "INR %.1f", $0.value) : nil },
            labs.potassium.flatMap { ($0.value < 2.5 || $0.value > 6.0) ? String(format: "K %.1f mmol/L", $0.value) : nil },
            labs.sodium.flatMap { ($0.value < 120 || $0.value > 155) ? "Na \(Int($0.value)) mmol/L" : nil },
            labs.lactate.flatMap { $0.value >= 4.0 ? String(format: "Lactate %.1f mmol/L", $0.value) : nil },
            labs.calcium.flatMap { ($0.value < 1.75 || $0.value > 3.0) ? String(format: "Ca %.2f mmol/L", $0.value) : nil },
            labs.glucose.flatMap { ($0.value < 3.0 || $0.value > 20.0) ? String(format: "Gluc %.1f mmol/L", $0.value) : nil },
            labs.troponin.flatMap { $0.value > 52 ? String(format: "Trop %.0f ng/L", $0.value) : nil }
        ]
        return tokens.compactMap { $0 }.joined(separator: " · ")
    }

    // MARK: - Clinical checklist

    private struct CheckItem: Identifiable {
        let id: String
        let label: String
        let icon: String
        let done: Bool
    }

    private var checkItems: [CheckItem] {
        var items: [CheckItem] = [
            CheckItem(id: "complaint",     label: "Complaint",    icon: "text.bubble",        done: !(patient.chiefComplaint ?? "").isEmpty),
            CheckItem(id: "diagnosis",     label: "Diagnosis",    icon: "stethoscope",         done: patient.workingDiagnosis != nil),
            CheckItem(id: "allergies",     label: "Allergies",    icon: "exclamationmark.shield", done: !patient.allergies.isEmpty),
            CheckItem(id: "vitals",        label: "Vitals",       icon: "waveform.path.ecg",   done: !patient.vitalsEntries.isEmpty),
            CheckItem(id: "notes",         label: "Note",         icon: "note.text",           done: patient.clinicalNotes.contains { !$0.isEmpty }),
            CheckItem(id: "signed",        label: "Signed",       icon: "checkmark.seal",      done: patient.clinicalNotes.contains { $0.status == .signed }),
            CheckItem(id: "prescriptions", label: "Prescriptions",icon: "pills",               done: !patient.prescriptions.isEmpty),
        ]
        switch patient.setting {
        case .inpatient, .emergency:
            items.append(CheckItem(id: "admission", label: "Admitted", icon: "bed.double",  done: patient.admittedAt != nil))
        case .theatre:
            items.append(CheckItem(id: "opplan",  label: "Op Plan", icon: "scissors",       done: !patient.operativePlans.isEmpty))
            items.append(CheckItem(id: "opdate",  label: "Op Date", icon: "calendar",       done: patient.operationDate != nil))
        case .endoscopy:
            items.append(CheckItem(id: "scopedate", label: "Scope Date", icon: "calendar",  done: patient.operationDate != nil))
        default:
            break
        }
        return items
    }

    @ViewBuilder
    var checklistRow: some View {
        let checkItems = self.checkItems   // built once (was twice per render)
        let pending = checkItems.filter { !$0.done }
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: pending.isEmpty ? "checkmark.circle.fill" : "circle.dotted")
                    .font(.system(size: 11))
                    .foregroundStyle(pending.isEmpty ? .green : .orange)
                Text(pending.isEmpty
                     ? "Chart complete"
                     : "\(pending.count) section\(pending.count == 1 ? "" : "s") pending")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(pending.isEmpty ? .green : .orange)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(checkItems) { item in
                        HStack(spacing: 3) {
                            Image(systemName: item.done ? "checkmark" : "circle")
                                .font(.system(size: 8, weight: .bold))
                            Text(item.label)
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(item.done ? AMColor.accent : .orange)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            (item.done ? AMColor.accent : Color.orange).opacity(0.1),
                            in: Capsule()
                        )
                        .overlay(
                            Capsule()
                                .stroke((item.done ? AMColor.accent : Color.orange).opacity(0.25), lineWidth: 0.5)
                        )
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }

    func notePreview(_ note: ClinicalNote) -> String? {
        if note.noteType.isStructured {
            return [note.assessment, note.plan]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty })
        }
        return note.freeText.map { String($0.prefix(300)) }
    }
}
