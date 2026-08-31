import SwiftUI
import SwiftData

struct EndoscopyListView: View {
    @Query(sort: \Patient.createdAt) private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var showAdd = false
    @State private var selectedPatient: Patient?

    private var endoscopyPatients: [Patient] {
        let base = allPatients.filter { $0.setting == .endoscopy }
        return base.sorted {
            switch ($0.operationDate, $1.operationDate) {
            case let (a?, b?): return a < b
            case (_?, nil):    return true
            case (nil, _?):    return false
            default:           return $0.acuity < $1.acuity
            }
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if endoscopyPatients.isEmpty {
                    ContentUnavailableView(
                        "No endoscopy cases",
                        systemImage: "circle.dotted",
                        description: Text("Add an endoscopy case to build the list.")
                    )
                } else {
                    List {
                        ForEach(endoscopyPatients) { patient in
                            Button { selectedPatient = patient } label: {
                                EndoscopyRow(patient: patient)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    markComplete(patient)
                                } label: {
                                    Label("Done", systemImage: "checkmark.circle.fill")
                                }
                                .tint(.teal)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    context.delete(patient)
                                } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Endoscopy List")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    HStack {
                        if !endoscopyPatients.isEmpty {
                            ShareLink(item: endoscopyListText,
                                      subject: Text("Endoscopy List")) {
                                Image(systemName: "square.and.arrow.up")
                            }
                        }
                        Button { showAdd = true } label: { Image(systemName: "plus") }
                    }
                }
            }
            .sheet(isPresented: $showAdd) {
                AddPatientView(initialSetting: .endoscopy)
            }
            .sheet(item: $selectedPatient) { p in
                PatientDetailView(patient: p)
            }
        }
    }

    private var endoscopyListText: String {
        let today = Date.now.formatted(date: .abbreviated, time: .shortened)
        var lines: [String] = []
        lines.append("ENDOSCOPY LIST — \(today)")
        lines.append("Amise Medical Services · Dr Dawit Daniel Kabiye MD DM")
        lines.append(String(repeating: "═", count: 48))
        lines.append("")

        for (i, patient) in endoscopyPatients.enumerated() {
            let dateStr: String
            if let op = patient.operationDate {
                dateStr = op.formatted(.dateTime.month(.abbreviated).day().hour().minute())
            } else {
                dateStr = "Date TBD"
            }
            let scope: String
            if let t = patient.appointmentType, !t.isEmpty { scope = t }
            else if let dx = patient.workingDiagnosis { scope = "Endoscopy: \(dx)" }
            else { scope = patient.chiefComplaint ?? "Scope TBD" }

            lines.append("Case \(i + 1) · \(dateStr)")
            lines.append("\(patient.fullName) · \(patient.sex.rawValue.prefix(1)), \(patient.ageYears)y [\(patient.acuity.label.uppercased())]")
            lines.append("Procedure: \(scope)")
            if let dx = patient.workingDiagnosis { lines.append("Indication: \(dx)") }

            let allergies = patient.allergies
            if allergies.isEmpty {
                lines.append("Allergies: NKDA")
            } else {
                lines.append("Allergies: " + allergies.map { "\($0.name) (\($0.severity))" }.joined(separator: ", "))
            }

            if let mrn = patient.mrn { lines.append("MRN: \(mrn)") }

            if !patient.prescriptions.isEmpty {
                let anticoags = patient.activeAnticoagulants
                if !anticoags.isEmpty {
                    lines.append("⚠ ANTICOAG/ANTIPLATELET: " + anticoags.map { $0.displayLine }.joined(separator: "; "))
                }
                lines.append("Medications: " + patient.prescriptions.map { $0.displayLine }.joined(separator: "; "))
            }

            lines.append(String(repeating: "─", count: 48))
            lines.append("")
        }

        lines.append("Total cases: \(endoscopyPatients.count)")
        lines.append("This list is a summary. Verify all details before proceeding.")
        return lines.joined(separator: "\n")
    }

    private func markComplete(_ patient: Patient) {
        patient.setting = .outpatient
        patient.updatedAt = .now
        patient.pendingSync = true
    }
}

// MARK: - Endoscopy case row

struct EndoscopyRow: View {
    @Bindable var patient: Patient

    private var scopeText: String {
        if let t = patient.appointmentType, !t.isEmpty { return t }
        if let dx = patient.workingDiagnosis { return "Endoscopy: \(dx)" }
        return patient.chiefComplaint ?? "Scope TBD"
    }

    private var scopeIcon: String {
        let text = (patient.appointmentType ?? patient.chiefComplaint ?? "").lowercased()
        if text.contains("ercp")        { return "arrow.triangle.branch" }
        if text.contains("colonoscopy") { return "arrow.up.right.circle" }
        if text.contains("ogd") || text.contains("gastroscopy") { return "arrow.down.right.circle" }
        return "circle.dotted"
    }

    private var timeText: String {
        guard let date = patient.operationDate else { return "Date TBD" }
        return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }

    private var news2Label: (score: Int, color: Color, risk: String)? {
        guard let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
              v.hasAnyValue else { return nil }
        return (v.news2Score, Color(hex: v.news2Color), v.news2Risk)
    }

    private var asaColor: Color {
        switch patient.asaClass ?? 0 {
        case 1, 2: return .green
        case 3:    return .orange
        default:   return .red
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(Color(hex: "0891B2"))
                .frame(width: 3)
                .padding(.vertical, -8)

            VStack(alignment: .leading, spacing: 4) {
                // Row 1: time · name · acuity
                HStack(spacing: 6) {
                    Text(timeText)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color(hex: "0891B2"))
                    Spacer()
                    AcuityPip(acuity: patient.acuity)
                    Text(patient.fullName)
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                }

                // Row 2: scope type + indication
                HStack(spacing: 6) {
                    Image(systemName: scopeIcon)
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "0891B2"))
                    Text(scopeText)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                }

                // Row 3: status badges
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        Text(patient.ageDisplay.map { "\(patient.sex.rawValue.prefix(1).uppercased()), \($0)" } ?? String(patient.sex.rawValue.prefix(1).uppercased()))
                            .font(.caption2).foregroundStyle(.secondary)

                        if let dx = patient.workingDiagnosis {
                            Text("·").font(.caption2).foregroundStyle(.tertiary)
                            Text(dx).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }

                        // ASA class badge
                        if let asa = patient.asaClass {
                            Text("ASA \(["I","II","III","IV","V"][min(asa-1, 4)])")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(asaColor)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(asaColor.opacity(0.1), in: Capsule())
                        } else {
                            Text("ASA ?")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color.secondary.opacity(0.08), in: Capsule())
                        }

                        // Consent badge
                        Button {
                            patient.consentSent.toggle()
                            patient.updatedAt = .now
                            patient.pendingSync = true
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: patient.consentSent ? "checkmark.circle.fill" : "xmark.circle")
                                    .font(.system(size: 8))
                                Text("Consent")
                                    .font(.system(size: 9, weight: .semibold))
                            }
                            .foregroundStyle(patient.consentSent ? .green : .orange)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background((patient.consentSent ? Color.green : Color.orange).opacity(0.1), in: Capsule())
                        }
                        .buttonStyle(.plain)

                        // Instructions badge
                        Button {
                            patient.preOpInstructionsSent.toggle()
                            patient.updatedAt = .now
                            patient.pendingSync = true
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: patient.preOpInstructionsSent ? "checkmark.circle.fill" : "xmark.circle")
                                    .font(.system(size: 8))
                                Text("Instructions")
                                    .font(.system(size: 9, weight: .semibold))
                            }
                            .foregroundStyle(patient.preOpInstructionsSent ? .green : .orange)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background((patient.preOpInstructionsSent ? Color.green : Color.orange).opacity(0.1), in: Capsule())
                        }
                        .buttonStyle(.plain)

                        if patient.hasCriticalAllergy {
                            Image(systemName: "exclamationmark.shield.fill")
                                .font(.system(size: 9, weight: .bold)).foregroundStyle(.red)
                        } else if !patient.allergies.isEmpty {
                            Image(systemName: "exclamationmark.shield")
                                .font(.system(size: 9, weight: .semibold)).foregroundStyle(.orange)
                        }
                        if patient.hasAnticoagulation {
                            Image(systemName: "drop.fill")
                                .font(.system(size: 9, weight: .bold)).foregroundStyle(.purple)
                        }
                    }
                }

                // Row 4: NEWS2
                HStack(spacing: 4) {
                    if let n = news2Label {
                        Circle().fill(n.color).frame(width: 6, height: 6)
                        Text("NEWS2 \(n.score)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(n.color)
                        Text("· \(n.risk)")
                            .font(.system(size: 9))
                            .foregroundStyle(n.color.opacity(0.8))
                    } else {
                        Circle().fill(Color.secondary.opacity(0.3)).frame(width: 6, height: 6)
                        Text("No vitals recorded")
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
            }
            .padding(.leading, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 16))
    }
}
