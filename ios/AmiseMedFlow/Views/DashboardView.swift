import SwiftUI
import SwiftData

// MARK: - Clinical dashboard — opened by tapping the AMF logo

struct DashboardView: View {
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    // SyncService / PeerSyncService are observed by DashboardSyncSection only: they publish many
    // times during a sync, and observing them here re-ran every patient summary on each publish.
    @Environment(\.dismiss) private var dismiss

    // MARK: Body

    var body: some View {
        // Every count and alert list once per render. Before, each tile, badge and alert row
        // recomputed its list from all patients: ~20 `deduped()` passes over the whole store per
        // render, every patient's vitals sorted 2-3 times and every patient's investigations JSON
        // decoded 6-8 times - and the screen re-rendered on every sync publish.
        let summary = DashboardSummary(patients: allPatients, calendar: .current)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Section count tiles
                    sectionCountRow(summary)

                    // Today's list
                    if !summary.today.isEmpty {
                        todaySection(summary.today)
                    }

                    // Active alerts
                    alertsSection(summary)

                    // Sync status
                    DashboardSyncSection()
                }
                .padding(20)
            }
            .navigationTitle("Clinical Overview")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { CrashReporting.breadcrumb("Opened clinical overview") }
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

    private func sectionCountRow(_ summary: DashboardSummary) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
            countTile(label: "Ward", count: summary.inpatientCount, color: Color(hex: "#2563EB"), icon: "bed.double")
            countTile(label: "Theatre", count: summary.theatreCount, color: Color(hex: "#7C3AED"), icon: "scissors")
            countTile(label: "Scope", count: summary.scopeCount, color: Color(hex: "#0891B2"), icon: "circle.dotted")
            countTile(label: "OPD", count: summary.outpatientCount, color: Color(hex: "#0D9488"), icon: "person.crop.circle")
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

    private func todaySection(_ today: [Patient]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Today", systemImage: "calendar")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(spacing: 0) {
                ForEach(today) { patient in
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

                    if patient.id != today.last?.id {
                        Divider().padding(.leading, 12)
                    }
                }
            }
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator).opacity(0.5), lineWidth: 0.5))
        }
    }

    // MARK: - Alerts

    private func alertsSection(_ summary: DashboardSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            let totalAlerts = summary.totalAlerts
            let emergencyAcuity = summary.emergencyAcuity
            let highNews2 = summary.highNews2
            let consentPending = summary.consentPendingCount
            let instructionsPending = summary.instructionsPendingCount
            let unsignedNotes = summary.unsignedNotes
            let pendingInvestigations = summary.pendingInvestigations
            let patientsWithNewResults = summary.withNewResults

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
                                 detail: highNews2.map { "\($0.patient.fullName) (\($0.score))" }
                                    .joined(separator: ", "))
                    }
                    if consentPending > 0 {
                        alertRow(icon: "doc.badge.ellipsis", color: .orange,
                                 title: "Consent not sent",
                                 detail: "\(consentPending) theatre / scope case\(consentPending == 1 ? "" : "s")")
                    }
                    if instructionsPending > 0 {
                        alertRow(icon: "list.bullet.clipboard", color: .orange,
                                 title: "Instructions not sent",
                                 detail: "\(instructionsPending) case\(instructionsPending == 1 ? "" : "s")")
                    }
                    if unsignedNotes > 0 {
                        alertRow(icon: "pencil.circle", color: .orange,
                                 title: "Unsigned draft notes",
                                 detail: "\(unsignedNotes) note\(unsignedNotes == 1 ? "" : "s") awaiting signature")
                    }
                    if !patientsWithNewResults.isEmpty {
                        alertRow(icon: "flask.fill", color: .teal,
                                 title: "Results available",
                                 detail: ListPerf.namesSummary(patientsWithNewResults.map { $0.fullName }, shown: 3))
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
}

// MARK: - Sync status

/// The dashboard's sync rows, in their own view so that SyncService / PeerSyncService publishes
/// (many per sync) re-render only these rows, not the patient summaries.
private struct DashboardSyncSection: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService

    var body: some View {
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
                        .foregroundStyle(peerSync.connectedCount > 0 ? Color.green
                                         : peerSync.nearbyCount > 0  ? Color.orange
                                         : peerSync.isRunning        ? AMColor.accent
                                         : Color.secondary)
                        .frame(width: 20)
                    Text(peerSync.connectedCount > 0
                         ? "\(peerSync.connectedCount) device\(peerSync.connectedCount == 1 ? "" : "s") connected"
                         : peerSync.nearbyCount > 0
                         ? "\(peerSync.nearbyCount) nearby"
                         : peerSync.pairingPrompt ?? (peerSync.isRunning ? "Scanning…" : "No devices nearby"))
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

// MARK: - Summary (computed once per render)

/// Counts and alert lists of the clinical dashboard, with the same filters and dedup as before.
/// `patients` must already exclude deleted records (`isLive`).
private struct DashboardSummary {
    var inpatientCount = 0
    var theatreCount = 0
    var scopeCount = 0
    var outpatientCount = 0
    /// Today's theatre cases, then today's scope cases.
    var today: [Patient] = []
    var highNews2: [(patient: Patient, score: Int)] = []
    var emergencyAcuity: [Patient] = []
    var consentPendingCount = 0
    var instructionsPendingCount = 0
    var unsignedNotes = 0
    var pendingInvestigations = 0
    var withNewResults: [Patient] = []

    var totalAlerts: Int {
        highNews2.count + emergencyAcuity.count + consentPendingCount + instructionsPendingCount
            + unsignedNotes + pendingInvestigations + withNewResults.count
    }

    init(patients allPatients: [Patient], calendar cal: Calendar) {
        let inpatients   = allPatients.filter { $0.setting == .inpatient || $0.setting == .emergency }.deduped()
        let theatreCases = allPatients.filter { $0.setting == .theatre }.deduped()
        let scopeCases   = allPatients.filter { $0.setting == .endoscopy }.deduped()
        let outpatients  = allPatients.filter { $0.setting == .outpatient }.deduped()
        inpatientCount = inpatients.count
        theatreCount = theatreCases.count
        scopeCount = scopeCases.count
        outpatientCount = outpatients.count

        func isToday(_ p: Patient) -> Bool {
            guard let d = p.operationDate else { return false }
            return cal.isDateInToday(d)
        }
        today = theatreCases.filter(isToday) + scopeCases.filter(isToday)

        emergencyAcuity = allPatients.filter { $0.acuity == .emergency }.deduped()
        consentPendingCount = (theatreCases + scopeCases).filter { !$0.consentSent }.count
        instructionsPendingCount = (theatreCases + scopeCases).filter { !$0.preOpInstructionsSent }.count

        // One dedup pass over all patients (was one per alert list, per use), then each
        // patient's vitals and investigations read once.
        for p in allPatients.deduped() {
            if let v = ListPerf.newest(p.vitalsEntries.filter(\.isLive), by: { $0.recordedAt }), v.hasAnyValue {
                let score = v.news2Score
                if score >= 5 { highNews2.append((p, score)) }
            }
            unsignedNotes += p.clinicalNotes.filter { $0.isLive && $0.status == .draft && !$0.isEmpty }.count
            let investigations = p.investigations
            pendingInvestigations += investigations.filter { $0.status == .ordered || $0.status == .pending }.count
            if investigations.contains(where: { $0.status == .resulted && !$0.result.isEmpty }) {
                withNewResults.append(p)
            }
        }
    }
}
