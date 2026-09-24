import SwiftUI
import SwiftData

// Clinician-driven review of records that look like the same person (same name, DOBs that do
// not contradict each other). Nothing is removed automatically:
// - Only records with NO clinical data (notes, vitals, Rx, encounters, documents, plans,
//   scores, history/assessment text) can be removed from here, after confirmation.
// - A record holding clinical data is never removed from this screen.
// - "Different people" stops a group from being flagged again on this device.

/// Banner shown at the top of patient lists when possible duplicates exist.
struct DuplicatePatientsBanner: View {
    let patients: [Patient]
    // Owned by the parent list, which presents DuplicatePatientsSheet. The sheet must not hang
    // off this row: the row disappears once the last group is resolved.
    @Binding var showReview: Bool
    // Observed so the banner updates when a group is marked "different people".
    @AppStorage(PatientIdentityStore.distinctKey) private var distinctPairs = ""

    var body: some View {
        let _ = distinctPairs
        let groups = patients.possibleDuplicateGroups()
        if !groups.isEmpty {
            Button { showReview = true } label: {
                HStack(spacing: 8) {
                    Image(systemName: "person.2.badge.gearshape.fill")
                        .foregroundStyle(.orange)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(groups.count) possible duplicate \(groups.count == 1 ? "patient" : "patients")")
                            .font(.subheadline.weight(.semibold))
                        Text(groups.map { "\($0[0].fullName) ×\($0.count)" }.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    Text("Review")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.orange)
                }
            }
            .buttonStyle(.plain)
        }
    }
}

struct DuplicatePatientsSheet: View {
    @Query(sort: \Patient.createdAt) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var pendingRemoval: [Patient] = []
    @State private var confirmRemoval = false
    // Records removed in this session are dropped from the list first, then deleted on the next
    // main-actor turn, so no row is still rendering a patient at the moment SwiftData deletes it.
    @State private var removedIDs: Set<UUID> = []
    @AppStorage(PatientIdentityStore.distinctKey) private var distinctPairs = ""

    private var groups: [[Patient]] {
        allPatients.filter { !removedIDs.contains($0.id) }.possibleDuplicateGroups()
    }

    var body: some View {
        let _ = distinctPairs
        NavigationStack {
            List {
                if groups.isEmpty {
                    ContentUnavailableView("No duplicates",
                                           systemImage: "checkmark.seal",
                                           description: Text("Every patient name is unique, or has been confirmed as a different person."))
                }
                ForEach(groups, id: \.first!.id) { group in
                    groupSection(group)
                }
            }
            .navigationTitle("Possible duplicates")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .confirmationDialog(removalTitle, isPresented: $confirmRemoval, titleVisibility: .visible) {
                Button("Remove from this device", role: .destructive) { performRemoval() }
                Button("Cancel", role: .cancel) { pendingRemoval = [] }
            } message: {
                Text("These records have no clinical data. The copy with the most information is kept. "
                     + "Records already uploaded stay in the cloud until an admin deletes them there.")
            }
        }
    }

    // MARK: - Group

    /// The record to keep: the one with clinical data if any, otherwise the oldest.
    private func keeper(of group: [Patient]) -> Patient { group.duplicateKeeper }

    private func removable(in group: [Patient]) -> [Patient] {
        let keep = keeper(of: group)
        return group.filter { $0.id != keep.id && !$0.hasClinicalData }
    }

    @ViewBuilder
    private func groupSection(_ group: [Patient]) -> some View {
        let keep = keeper(of: group)
        let extra = removable(in: group)
        Section {
            ForEach(group) { p in
                row(p, isKeeper: p.id == keep.id)
            }
            if !extra.isEmpty {
                Button(role: .destructive) {
                    pendingRemoval = extra
                    confirmRemoval = true
                } label: {
                    Label("Keep \(keep.mrn ?? "first record"), remove \(extra.count) empty \(extra.count == 1 ? "copy" : "copies")",
                          systemImage: "trash")
                }
            }
            Button {
                PatientIdentityStore.markDistinct(group)
            } label: {
                Label("These are different people", systemImage: "person.2")
            }
        } header: {
            Text("\(group[0].fullName) — \(group.count) records")
        } footer: {
            if group.filter(\.hasClinicalData).count > 1 {
                Text("More than one of these records has clinical data. Open each chart to check; they cannot be removed from here.")
            }
        }
    }

    private func row(_ p: Patient, isKeeper: Bool) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Text(p.mrn ?? "No MRN")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                if isKeeper {
                    Text("KEEP")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(AMColor.accent)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(AMColor.accentLt, in: RoundedRectangle(cornerRadius: 4))
                }
                Spacer()
                Text(p.setting.rawValue)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Text(detailLine(p))
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(p.clinicalDataSummary)
                .font(.caption2.weight(.medium))
                .foregroundStyle(p.hasClinicalData ? AMColor.accent : .secondary)
        }
        .padding(.vertical, 2)
    }

    private func detailLine(_ p: Patient) -> String {
        var parts: [String] = []
        if let dob = p.dateOfBirth {
            parts.append("DOB \(dob.formatted(date: .abbreviated, time: .omitted))")
        } else {
            parts.append("No DOB")
        }
        if let phone = p.phone, !phone.isEmpty { parts.append(phone) }
        parts.append("Created \(p.createdAt.formatted(date: .abbreviated, time: .shortened))")
        return parts.joined(separator: " · ")
    }

    // MARK: - Removal

    private var removalTitle: String {
        let n = pendingRemoval.count
        return "Remove \(n) empty \(n == 1 ? "record" : "records")?"
    }

    private func performRemoval() {
        // Re-check at the moment of removal: never delete a record that gained clinical data.
        let victims = pendingRemoval.filter { !$0.isDeleted && !$0.hasClinicalData }
        pendingRemoval = []
        removedIDs.formUnion(victims.map(\.id))
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(400))   // let the list animate the rows out
            for p in victims where !p.isDeleted { context.deletePatient(p) }
            try? context.save()
        }
    }
}
