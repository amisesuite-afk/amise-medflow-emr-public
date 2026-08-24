import SwiftUI
import SwiftData

struct TriageDashboardView: View {
    @Query(sort: \Patient.createdAt, order: .reverse) private var allPatients: [Patient]
    @Environment(\.dismiss) private var dismiss

    private var wardPatients: [Patient] {
        allPatients.filter { $0.setting == .inpatient || $0.setting == .emergency }
                   .sorted { $0.acuity < $1.acuity }
    }

    private var theatreToday: [Patient] {
        let cal = Calendar.current
        return allPatients.filter { p in
            guard p.setting == .theatre, let op = p.operationDate else { return false }
            return cal.isDateInToday(op)
        }
    }

    private var endoscopyToday: [Patient] {
        let cal = Calendar.current
        return allPatients.filter { p in
            guard p.setting == .endoscopy, let op = p.operationDate else { return false }
            return cal.isDateInToday(op)
        }
    }

    private var highAlertCount: Int {
        wardPatients.filter {
            ($0.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first?.news2Score ?? 0) >= 5
        }.count
    }

    private var acuityGroups: [(Acuity, [Patient])] {
        Acuity.allCases.compactMap { acuity in
            let pts = wardPatients.filter { $0.acuity == acuity }
            return pts.isEmpty ? nil : (acuity, pts)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                // Alert banner
                if highAlertCount > 0 {
                    Section {
                        HStack(spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
                            Text("\(highAlertCount) patient\(highAlertCount == 1 ? "" : "s") with NEWS2 ≥5 — immediate review required")
                                .font(.system(size: 13, weight: .semibold)).foregroundStyle(.red)
                        }
                        .padding(.vertical, 4)
                    }
                }

                // Ward patients by acuity
                if wardPatients.isEmpty {
                    Section {
                        ContentUnavailableView(
                            "No ward patients",
                            systemImage: "bed.double",
                            description: Text("Inpatient and emergency patients appear here.")
                        )
                        .listRowBackground(Color.clear)
                    }
                } else {
                    ForEach(acuityGroups, id: \.0) { acuity, patients in
                        Section {
                            ForEach(patients) { patient in
                                TriagePatientRow(patient: patient)
                            }
                        } header: {
                            HStack(spacing: 6) {
                                Circle().fill(Color(hex: acuity.color)).frame(width: 8, height: 8)
                                Text(acuityLabel(acuity))
                                    .font(.system(size: 11, weight: .heavy))
                                    .textCase(.uppercase).tracking(0.5)
                                Text("(\(patients.count))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                // Today's lists
                if !theatreToday.isEmpty {
                    Section {
                        ForEach(theatreToday) { patient in
                            HStack(spacing: 10) {
                                Image(systemName: "scissors").font(.caption).foregroundStyle(.purple)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(patient.fullName).font(.system(size: 13, weight: .semibold))
                                    if let dx = patient.workingDiagnosis {
                                        Text(dx).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                }
                                Spacer()
                                if let op = patient.operationDate {
                                    Text(op, style: .time)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.purple)
                                }
                            }
                        }
                    } header: {
                        Label("Theatre Today", systemImage: "scissors").foregroundStyle(.purple)
                    }
                }

                if !endoscopyToday.isEmpty {
                    Section {
                        ForEach(endoscopyToday) { patient in
                            HStack(spacing: 10) {
                                Image(systemName: "circle.dotted").font(.caption).foregroundStyle(.cyan)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(patient.fullName).font(.system(size: 13, weight: .semibold))
                                    if let dx = patient.workingDiagnosis {
                                        Text(dx).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                }
                                Spacer()
                                if let op = patient.operationDate {
                                    Text(op, style: .time)
                                        .font(.caption.weight(.semibold)).foregroundStyle(.cyan)
                                }
                            }
                        }
                    } header: {
                        Label("Endoscopy Today", systemImage: "circle.dotted").foregroundStyle(.cyan)
                    }
                }
            }
            .navigationTitle("Triage Dashboard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .overlay(alignment: .topTrailing) {
                summaryPill
                    .padding(.top, 8).padding(.trailing, 16)
            }
        }
    }

    private var summaryPill: some View {
        HStack(spacing: 12) {
            ForEach(Acuity.allCases, id: \.self) { acuity in
                let count = wardPatients.filter { $0.acuity == acuity }.count
                if count > 0 {
                    HStack(spacing: 4) {
                        Circle().fill(Color(hex: acuity.color)).frame(width: 7, height: 7)
                        Text("\(count)").font(.system(size: 11, weight: .heavy)).foregroundStyle(Color(hex: acuity.color))
                    }
                }
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(.regularMaterial, in: Capsule())
    }

    private func acuityLabel(_ acuity: Acuity) -> String {
        switch acuity {
        case .emergency: return "Emergency"
        case .urgent:    return "Urgent"
        case .priority:  return "Priority"
        case .routine:   return "Routine"
        }
    }
}

// MARK: - Triage patient row

struct TriagePatientRow: View {
    let patient: Patient

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color(hex: patient.acuity.color).opacity(0.15))
                    .frame(width: 38, height: 38)
                Text(patient.initials)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color(hex: patient.acuity.color))
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(patient.fullName)
                        .font(.system(size: 14, weight: .semibold))
                    if let ward = patient.ward {
                        Text(ward).font(.caption).foregroundStyle(.secondary)
                    }
                    if let days = patient.postOpDays {
                        Text("POD \(days)")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.teal)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Color.teal.opacity(0.1), in: Capsule())
                    }
                }
                if let dx = patient.workingDiagnosis {
                    Text(dx).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                } else if let cc = patient.chiefComplaint {
                    Text(cc).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                }
                if let v = latestVitals, v.hasAnyValue {
                    HStack(spacing: 6) {
                        if let bp = v.bpString {
                            TriageVitalChip(text: bp, unit: "mmHg",
                                            alert: (v.bpSystolic ?? 120) > 180 || (v.bpSystolic ?? 120) < 90)
                        }
                        if let hr = v.heartRate {
                            TriageVitalChip(text: "\(hr)", unit: "bpm", alert: hr > 130 || hr < 40)
                        }
                        if let spo = v.spo2 {
                            TriageVitalChip(text: "\(spo)", unit: "%", alert: spo < 94)
                        }
                        Spacer()
                        Text("NEWS2 \(v.news2Score)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color(hex: v.news2Color))
                    }
                } else {
                    Text("No vitals")
                        .font(.caption).foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct TriageVitalChip: View {
    let text: String
    let unit: String
    var alert: Bool = false

    var body: some View {
        HStack(spacing: 1) {
            Text(text)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(alert ? .red : .primary)
            Text(unit)
                .font(.system(size: 9)).foregroundStyle(.secondary)
        }
        .padding(.horizontal, 5).padding(.vertical, 2)
        .background((alert ? Color.red : Color.secondary).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 4))
    }
}
