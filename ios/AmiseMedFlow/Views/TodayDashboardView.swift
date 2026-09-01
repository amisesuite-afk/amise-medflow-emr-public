import SwiftUI
import SwiftData

struct TodayDashboardView: View {
    @Query private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var selectedPatient: Patient?
    @State private var showAdd = false

    private let cal = Calendar.current

    // MARK: - Patient groups

    private var wardPatients: [Patient] {
        allPatients
            .filter { $0.setting == .inpatient || $0.setting == .emergency }
            .sorted { $0.acuity < $1.acuity }
    }

    private var theatreToday: [Patient] {
        allPatients
            .filter { $0.setting == .theatre && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
    }

    private var endoscopyToday: [Patient] {
        allPatients
            .filter { $0.setting == .endoscopy && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
    }

    private var clinicToday: [Patient] {
        allPatients
            .filter { $0.setting == .outpatient && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
    }

    private var highAcuityWard: [Patient] {
        wardPatients.filter { p in
            guard let v = p.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first
            else { return p.setting == .emergency }
            return v.news2Risk == "High" || v.news2HasRedFlag
        }
    }

    private var isAnythingOn: Bool {
        !wardPatients.isEmpty || !theatreToday.isEmpty || !endoscopyToday.isEmpty || !clinicToday.isEmpty
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            Group {
                if isAnythingOn {
                    List {
                        if !highAcuityWard.isEmpty { alertSection }
                        if !wardPatients.isEmpty   { wardSection }
                        if !theatreToday.isEmpty   { theatreSection }
                        if !endoscopyToday.isEmpty { endoscopySection }
                        if !clinicToday.isEmpty    { clinicSection }
                    }
                    .listStyle(.insetGrouped)
                } else {
                    emptyState
                }
            }
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Text(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(item: $selectedPatient) { PatientDetailView(patient: $0) }
            .sheet(isPresented: $showAdd) { AddPatientView() }
        }
    }

    // MARK: - Alert Section

    @ViewBuilder
    private var alertSection: some View {
        Section {
            ForEach(highAcuityWard) { patient in
                Button { selectedPatient = patient } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .font(.system(size: 14))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(patient.fullName)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.primary)
                            if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
                                Text("NEWS2 \(v.news2Score) · \(v.news2Risk) risk")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            } else if patient.setting == .emergency {
                                Text("Emergency admission")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                        Spacer()
                        if let ward = patient.ward, let bed = patient.bedNumber {
                            Text("\(ward) · \(bed)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.red.opacity(0.06))
            }
        } header: {
            Label("Alerts — High acuity", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
                .font(.system(size: 11, weight: .heavy))
                .textCase(nil)
        }
    }

    // MARK: - Ward Section

    @ViewBuilder
    private var wardSection: some View {
        Section {
            ForEach(wardPatients) { patient in
                Button { selectedPatient = patient } label: {
                    TodayPatientRow(patient: patient, style: .ward)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Ward Round", systemImage: "bed.double.fill")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(wardPatients.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }
        }
    }

    // MARK: - Theatre Section

    @ViewBuilder
    private var theatreSection: some View {
        Section {
            ForEach(theatreToday) { patient in
                Button { selectedPatient = patient } label: {
                    TodayPatientRow(patient: patient, style: .theatre)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Theatre", systemImage: "scalpel")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(theatreToday.count) \(theatreToday.count == 1 ? "case" : "cases")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Endoscopy Section

    @ViewBuilder
    private var endoscopySection: some View {
        Section {
            ForEach(endoscopyToday) { patient in
                Button { selectedPatient = patient } label: {
                    TodayPatientRow(patient: patient, style: .endoscopy)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Endoscopy", systemImage: "eye.circle")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(endoscopyToday.count) \(endoscopyToday.count == 1 ? "case" : "cases")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Clinic Section

    @ViewBuilder
    private var clinicSection: some View {
        Section {
            ForEach(clinicToday) { patient in
                Button { selectedPatient = patient } label: {
                    TodayPatientRow(patient: patient, style: .clinic)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Clinic", systemImage: "stethoscope")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(clinicToday.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 56))
                .foregroundStyle(AMColor.accent)
            Text("Nothing scheduled today")
                .font(.headline)
            Text("Ward patients and today's theatre, endoscopy, and clinic lists will appear here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button {
                showAdd = true
            } label: {
                Label("Add Patient", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20).padding(.vertical, 10)
                    .background(AMColor.accent, in: Capsule())
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    private func isToday(_ date: Date?) -> Bool {
        guard let date else { return false }
        return cal.isDateInToday(date)
    }
}

// MARK: - Today patient row

private enum TodayRowStyle { case ward, theatre, endoscopy, clinic }

private struct TodayPatientRow: View {
    let patient: Patient
    let style: TodayRowStyle

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    private var accentColor: Color {
        switch style {
        case .ward:      return patient.setting == .emergency ? .red : .teal
        case .theatre:   return .purple
        case .endoscopy: return .cyan
        case .clinic:    return .orange
        }
    }

    private var subtitleText: String {
        switch style {
        case .ward:
            var parts: [String] = []
            if let w = patient.ward { parts.append(w) }
            if let b = patient.bedNumber { parts.append("Bed \(b)") }
            if let dx = patient.workingDiagnosis { parts.append(dx) }
            else if let cc = patient.chiefComplaint { parts.append(cc) }
            return parts.joined(separator: " · ")
        case .theatre, .endoscopy:
            var parts: [String] = []
            if let t = patient.operationDate {
                parts.append(t.formatted(.dateTime.hour().minute()))
            }
            if let apt = patient.appointmentType { parts.append(apt) }
            else if let dx = patient.workingDiagnosis { parts.append(dx) }
            else if let cc = patient.chiefComplaint { parts.append(cc) }
            if let asa = patient.asaClass {
                let roman = ["I","II","III","IV","V"]
                parts.append("ASA \(roman[min(asa-1, 4)])")
            }
            return parts.joined(separator: " · ")
        case .clinic:
            var parts: [String] = []
            if let t = patient.operationDate {
                parts.append(t.formatted(.dateTime.hour().minute()))
            }
            if let apt = patient.appointmentType { parts.append(apt) }
            else if let dx = patient.workingDiagnosis { parts.append(dx) }
            else if let cc = patient.chiefComplaint { parts.append(cc) }
            return parts.joined(separator: " · ")
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            // Accent stripe
            RoundedRectangle(cornerRadius: 2)
                .fill(accentColor)
                .frame(width: 3, height: 36)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(patient.fullName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.primary)
                    if patient.hasCriticalAllergy {
                        Image(systemName: "exclamationmark.shield.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.red)
                    }
                    if patient.hasPenicillinAllergy {
                        Image(systemName: "pills.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.orange)
                    }
                }
                Text(subtitleText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // NEWS2 badge (ward only) or post-op day
            if style == .ward, let v = latestVitals {
                NEWS2Badge(score: v.news2Score, risk: v.news2Risk)
            } else if style == .ward, let days = patient.postOpDays {
                Text("POD \(days)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.1), in: Capsule())
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - NEWS2 badge

private struct NEWS2Badge: View {
    let score: Int
    let risk: String

    private var color: Color {
        switch risk {
        case "High":   return .red
        case "Medium": return .orange
        default:       return .green
        }
    }

    var body: some View {
        HStack(spacing: 3) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text("N2:\(score)")
                .font(.caption2.monospacedDigit().weight(.semibold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 6).padding(.vertical, 3)
        .background(color.opacity(0.10), in: Capsule())
    }
}
