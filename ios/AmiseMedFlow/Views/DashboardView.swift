import SwiftUI
import SwiftData

// MARK: - Clinical dashboard — opened by tapping the AMF logo

struct DashboardView: View {
    @Query private var allPatients: [Patient]
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @Environment(\.dismiss) private var dismiss

    // MARK: Derived counts

    private var inpatients: [Patient]  { allPatients.filter { $0.setting == .inpatient || $0.setting == .emergency } }
    private var theatreCases: [Patient] { allPatients.filter { $0.setting == .theatre } }
    private var scopeCases: [Patient]  { allPatients.filter { $0.setting == .endoscopy } }
    private var outpatients: [Patient] { allPatients.filter { $0.setting == .outpatient } }

    private var todayTheatre: [Patient] {
        let cal = Calendar.current
        return theatreCases.filter { p in
            guard let d = p.operationDate else { return false }
            return cal.isDateInToday(d)
        }
    }

    private var todayScope: [Patient] {
        let cal = Calendar.current
        return scopeCases.filter { p in
            guard let d = p.operationDate else { return false }
            return cal.isDateInToday(d)
        }
    }

    // MARK: Alert lists

    private var highNews2: [Patient] {
        allPatients.filter { p in
            guard let v = p.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
                  v.hasAnyValue else { return false }
            return v.news2Score >= 5
        }
    }

    private var emergencyAcuity: [Patient] {
        allPatients.filter { $0.acuity == .emergency }
    }

    private var consentPending: [Patient] {
        (theatreCases + scopeCases).filter { !$0.consentSent }
    }

    private var instructionsPending: [Patient] {
        (theatreCases + scopeCases).filter { !$0.preOpInstructionsSent }
    }

    private var unsignedNotes: Int {
        allPatients.reduce(0) { $0 + $1.clinicalNotes.filter { $0.status == .draft && !$0.isEmpty }.count }
    }

    private var pendingInvestigations: Int {
        allPatients.reduce(0) { $0 + $1.investigations.filter { $0.status == .ordered || $0.status == .pending }.count }
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Section count tiles
                    sectionCountRow

                    // Today's list
                    if !todayTheatre.isEmpty || !todayScope.isEmpty {
                        todaySection
                    }

                    // Active alerts
                    alertsSection

                    // Sync status
                    syncSection
                }
                .padding(20)
            }
            .navigationTitle("Clinical Overview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Section count tiles

    private var sectionCountRow: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
            countTile(label: "Ward", count: inpatients.count, color: Color(hex: "#2563EB"), icon: "bed.double")
            countTile(label: "Theatre", count: theatreCases.count, color: Color(hex: "#7C3AED"), icon: "scissors")
            countTile(label: "Scope", count: scopeCases.count, color: Color(hex: "#0891B2"), icon: "circle.dotted")
            countTile(label: "OPD", count: outpatients.count, color: Color(hex: "#0D9488"), icon: "person.crop.circle")
        }
    }

    private func countTile(label: String, count: Int, color: Color, icon: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(color)
            Text("\(count)")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundStyle(count > 0 ? .primary : .secondary)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(color.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.15), lineWidth: 0.5))
    }

    // MARK: - Today's list

    private var todaySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Today", systemImage: "calendar")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(spacing: 0) {
                ForEach(todayTheatre + todayScope) { patient in
                    HStack(spacing: 10) {
                        AcuityPip(acuity: patient.acuity)

                        VStack(alignment: .leading, spacing: 1) {
                            Text(patient.fullName)
                                .font(.system(size: 13, weight: .semibold))
                            Text([
                                patient.setting.rawValue,
                                patient.operationDate.map {
                                    $0.formatted(.dateTime.hour().minute())
                                }
                            ].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        // Checklist badges
                        HStack(spacing: 4) {
                            Image(systemName: patient.consentSent ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(patient.consentSent ? .green : .orange)
                            Image(systemName: patient.preOpInstructionsSent ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(patient.preOpInstructionsSent ? .green : .orange)
                        }
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)

                    if patient.id != (todayTheatre + todayScope).last?.id {
                        Divider().padding(.leading, 12)
                    }
                }
            }
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator).opacity(0.5), lineWidth: 0.5))
        }
    }

    // MARK: - Alerts

    private var alertsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            let totalAlerts = highNews2.count + emergencyAcuity.count + consentPending.count + instructionsPending.count + unsignedNotes + pendingInvestigations

            Label(totalAlerts == 0 ? "No active alerts" : "\(totalAlerts) item\(totalAlerts == 1 ? "" : "s") need attention",
                  systemImage: totalAlerts == 0 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(totalAlerts == 0 ? .green : .orange)

            if totalAlerts > 0 {
                VStack(spacing: 0) {
                    if !emergencyAcuity.isEmpty {
                        alertRow(icon: "bolt.heart.fill", color: .red,
                                 title: "Emergency acuity",
                                 detail: emergencyAcuity.map { $0.fullName }.joined(separator: ", "))
                    }
                    if !highNews2.isEmpty {
                        alertRow(icon: "waveform.path.ecg", color: .red,
                                 title: "NEWS2 ≥ 5",
                                 detail: highNews2.map { p in
                                    let score = p.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first?.news2Score ?? 0
                                    return "\(p.fullName) (\(score))"
                                 }.joined(separator: ", "))
                    }
                    if !consentPending.isEmpty {
                        alertRow(icon: "doc.badge.ellipsis", color: .orange,
                                 title: "Consent not sent",
                                 detail: "\(consentPending.count) theatre / scope case\(consentPending.count == 1 ? "" : "s")")
                    }
                    if !instructionsPending.isEmpty {
                        alertRow(icon: "list.bullet.clipboard", color: .orange,
                                 title: "Instructions not sent",
                                 detail: "\(instructionsPending.count) case\(instructionsPending.count == 1 ? "" : "s")")
                    }
                    if unsignedNotes > 0 {
                        alertRow(icon: "pencil.circle", color: .orange,
                                 title: "Unsigned draft notes",
                                 detail: "\(unsignedNotes) note\(unsignedNotes == 1 ? "" : "s") awaiting signature")
                    }
                    if pendingInvestigations > 0 {
                        alertRow(icon: "clock.badge.exclamationmark", color: .secondary,
                                 title: "Investigations pending",
                                 detail: "\(pendingInvestigations) result\(pendingInvestigations == 1 ? "" : "s") awaited")
                    }
                }
                .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator).opacity(0.5), lineWidth: 0.5))
            }
        }
    }

    private func alertRow(icon: String, color: Color, title: String, detail: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(color)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
    }

    // MARK: - Sync status

    private var syncSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(spacing: 0) {
                HStack {
                    Image(systemName: "cloud")
                        .foregroundStyle(sync.pendingCount > 0 ? .orange : .green)
                        .frame(width: 20)
                    Text(sync.isSyncing ? "Syncing…"
                         : sync.pendingCount > 0 ? "\(sync.pendingCount) pending"
                         : "Up to date")
                        .font(.system(size: 13))
                    Spacer()
                    if let last = sync.lastSyncedAt {
                        Text(last, style: .relative)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)

                Divider().padding(.leading, 12)

                HStack {
                    Image(systemName: "antenna.radiowaves.left.and.right")
                        .foregroundStyle(peerSync.connectedCount > 0 ? .green : .secondary)
                        .frame(width: 20)
                    Text(peerSync.connectedCount > 0
                         ? "\(peerSync.connectedCount) device\(peerSync.connectedCount == 1 ? "" : "s") connected"
                         : peerSync.nearbyCount > 0
                         ? "\(peerSync.nearbyCount) nearby"
                         : "No devices nearby")
                        .font(.system(size: 13))
                    Spacer()
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
            }
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator).opacity(0.5), lineWidth: 0.5))
        }
    }
}
