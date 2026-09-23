import SwiftUI
import SwiftData

// MARK: - Timeline event model

private struct JourneyEvent: Identifiable {
    let id: UUID
    let date: Date
    let icon: String
    let title: String
    let subtitle: String
    let category: EventCategory

    enum EventCategory {
        case registration, vitals, note, prescription, investigation, procedure, encounter, discharge

        var color: Color {
            switch self {
            case .registration:  return AMColor.accent
            case .vitals:        return .blue
            case .note:          return AMColor.accent
            case .prescription:  return .orange
            case .investigation: return .purple
            case .procedure:     return Color(red: 0.8, green: 0.2, blue: 0.2)
            case .encounter:     return AMColor.accent
            case .discharge:     return .green
            }
        }

        var label: String {
            switch self {
            case .registration:  return "Registration"
            case .vitals:        return "Vitals"
            case .note:          return "Note"
            case .prescription:  return "Prescription"
            case .investigation: return "Investigation"
            case .procedure:     return "Procedure"
            case .encounter:     return "Visit"
            case .discharge:     return "Discharge"
            }
        }
    }
}

// MARK: - View

struct PatientJourneyView: View {
    @Bindable var patient: Patient

    @State private var selectedCategory: JourneyEvent.EventCategory? = nil
    @State private var expandedEventId: UUID? = nil
    @State private var pdfWrapper: PDFDataWrapper? = nil

    private var allEvents: [JourneyEvent] {
        var events: [JourneyEvent] = []

        // Registration / admission
        let regDate = patient.admittedAt ?? patient.createdAt
        events.append(JourneyEvent(
            id: UUID(),
            date: regDate,
            icon: "person.badge.plus",
            title: "Patient Registered",
            subtitle: "\(patient.setting.rawValue) · \(patient.location.rawValue)\(patient.mrn.map { " · MRN \($0)" } ?? "")",
            category: .registration
        ))

        // Chief complaint (if present)
        if let cc = patient.chiefComplaint, !cc.isEmpty {
            events.append(JourneyEvent(
                id: UUID(),
                date: regDate.addingTimeInterval(60),
                icon: "text.bubble",
                title: "Chief Complaint",
                subtitle: String(cc.prefix(100)),
                category: .registration
            ))
        }

        // Vitals entries
        for v in patient.vitalsEntries where v.hasAnyValue {
            var parts: [String] = []
            if let bp = v.bpString      { parts.append("BP \(bp)") }
            if let hr = v.heartRate     { parts.append("HR \(hr)") }
            if let t  = v.temperatureCelsius { parts.append(String(format: "T %.1f°C", t)) }
            if let sp = v.spo2          { parts.append("SpO₂ \(sp)%") }
            let subtitle = parts.isEmpty ? "NEWS2 \(v.news2Score)" : parts.joined(separator: "  ·  ")
            events.append(JourneyEvent(
                id: v.id,
                date: v.recordedAt,
                icon: v.news2HasRedFlag ? "waveform.path.ecg.rectangle.fill" : "waveform.path.ecg",
                title: "Vitals — NEWS2 \(v.news2Score) (\(v.news2Risk))",
                subtitle: subtitle,
                category: .vitals
            ))
        }

        // Clinical notes
        for note in patient.clinicalNotes {
            let status = note.status == .signed ? "Signed" : "Draft"
            let preview: String = {
                if note.noteType.isStructured {
                    return [note.assessment, note.plan, note.subjective]
                        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .first(where: { !$0.isEmpty })
                        .map { String($0.prefix(120)) } ?? ""
                }
                return (note.freeText ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    .components(separatedBy: "\n").first(where: { !$0.isEmpty }).map { String($0.prefix(120)) } ?? ""
            }()
            events.append(JourneyEvent(
                id: note.id,
                date: note.createdAt,
                icon: note.status == .signed ? "doc.text.fill" : "doc.text",
                title: "\(note.noteType.label) [\(status)]",
                subtitle: preview,
                category: .note
            ))
        }

        // Prescriptions
        for rx in patient.prescriptions {
            events.append(JourneyEvent(
                id: rx.id,
                date: rx.prescribedAt,
                icon: "pills.fill",
                title: "Prescribed: \(rx.drug)",
                subtitle: "\(rx.dose)  \(rx.route)  \(rx.frequency)" + (rx.indication.isEmpty ? "" : "  ·  \(rx.indication)"),
                category: .prescription
            ))
        }

        // Investigations
        for inv in patient.investigations {
            let dateUsed = inv.resultedAt ?? inv.orderedAt
            let statusLabel = inv.status.rawValue
            let detail = inv.result.isEmpty ? statusLabel : "\(statusLabel): \(inv.result)"
            events.append(JourneyEvent(
                id: inv.id,
                date: dateUsed,
                icon: inv.category.icon,
                title: "\(inv.name) [\(statusLabel)]",
                subtitle: detail,
                category: .investigation
            ))
        }

        // Operative plans
        for op in patient.operativePlans {
            let procName = op.consentProcedure.isEmpty ? "Operative Plan" : op.consentProcedure
            events.append(JourneyEvent(
                id: op.id,
                date: op.updatedAt,
                icon: "scissors.badge.ellipsis",
                title: procName,
                subtitle: "Anaesthesia: \(op.anaesthesiaType)  ·  WHO \(op.whoCompletedCount)/\(op.whoTotalCount)",
                category: .procedure
            ))
        }

        // Surgery data (if procedure name filled)
        let surgery = patient.surgeryData
        if !surgery.procedureName.isEmpty, let opDate = surgery.dateOfSurgery {
            events.append(JourneyEvent(
                id: UUID(),
                date: opDate,
                icon: "cross.case.fill",
                title: "Operative Note: \(surgery.procedureName)",
                subtitle: [surgery.surgeon, surgery.anaesthetist].filter { !$0.isEmpty }.joined(separator: " · "),
                category: .procedure
            ))
        }

        // Completed encounters (previous visits)
        for enc in patient.encounters where enc.isComplete {
            events.append(JourneyEvent(
                id: enc.id,
                date: enc.encounterDate,
                icon: "clock.badge.checkmark.fill",
                title: "Visit: \(enc.visitType.rawValue)",
                subtitle: enc.workingDiagnosis ?? enc.chiefComplaint ?? enc.visitType.rawValue,
                category: .encounter
            ))
        }

        // Discharge (from discharge summary data, if discharge date set)
        let discharge = patient.dischargeSummaryData
        if let dd = discharge.dischargeDate {
            events.append(JourneyEvent(
                id: UUID(),
                date: dd,
                icon: "figure.walk.departure",
                title: "Discharged",
                subtitle: [discharge.dischargeDestination, discharge.dischargeDiagnosis].filter { !$0.isEmpty }.joined(separator: " · "),
                category: .discharge
            ))
        }

        // Sort chronologically
        return events.sorted { $0.date < $1.date }
    }

    private var filteredEvents: [JourneyEvent] {
        guard let cat = selectedCategory else { return allEvents }
        return allEvents.filter { $0.category == cat }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Filter chips
                filterChips

                // Summary stats row
                statsSummaryRow

                // Timeline
                if filteredEvents.isEmpty {
                    emptyState
                } else {
                    timelineList
                }
            }
            .padding(.bottom, 40)
        }
        .background(AMColor.bg)
        .navigationTitle("Patient Journey")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    let pdf = ProcedureFormPDF.journeyTimeline(patient: patient)
                    pdfWrapper = PDFDataWrapper(data: pdf)
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data as Any])
                .ignoresSafeArea()
        }
    }

    // MARK: - Filter chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(label: "All", isSelected: selectedCategory == nil) {
                    selectedCategory = nil
                }
                ForEach([
                    JourneyEvent.EventCategory.registration,
                    .vitals, .note, .prescription,
                    .investigation, .procedure, .encounter, .discharge
                ], id: \.label) { cat in
                    let count = allEvents.filter { $0.category == cat }.count
                    if count > 0 {
                        FilterChip(label: cat.label, count: count, color: cat.color,
                                   isSelected: selectedCategory == cat) {
                            selectedCategory = selectedCategory == cat ? nil : cat
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Color(.systemBackground))
    }

    // MARK: - Stats summary

    private var statsSummaryRow: some View {
        let noteCount = allEvents.filter { $0.category == .note }.count
        let rxCount = allEvents.filter { $0.category == .prescription }.count
        let vitalCount = allEvents.filter { $0.category == .vitals }.count
        let invCount = allEvents.filter { $0.category == .investigation }.count

        return HStack(spacing: 0) {
            StatTile(value: noteCount, label: "Notes")
            Divider().frame(height: 32)
            StatTile(value: rxCount, label: "Rx")
            Divider().frame(height: 32)
            StatTile(value: vitalCount, label: "Vitals")
            Divider().frame(height: 32)
            StatTile(value: invCount, label: "Ix")
        }
        .padding(.vertical, 10)
        .background(Color(.systemBackground))

    }

    // MARK: - Timeline

    private var timelineList: some View {
        LazyVStack(spacing: 0, pinnedViews: []) {
            ForEach(Array(filteredEvents.enumerated()), id: \.element.id) { index, event in
                TimelineEventRow(
                    event: event,
                    isFirst: index == 0,
                    isLast: index == filteredEvents.count - 1,
                    isExpanded: expandedEventId == event.id
                ) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        expandedEventId = expandedEventId == event.id ? nil : event.id
                    }
                }
            }
        }
        .padding(.top, 8)
        .padding(.horizontal, 16)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "clock.badge.xmark")
                .font(.system(size: 40))
                .foregroundStyle(AMColor.muted)
            Text("No events recorded")
                .font(.subheadline)
                .foregroundStyle(AMColor.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }
}

// MARK: - Sub-components

private struct FilterChip: View {
    let label: String
    var count: Int? = nil
    var color: Color = AMColor.accent
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(label)
                    .font(.caption.weight(.medium))
                if let count {
                    Text("\(count)")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background {
                            Capsule().fill(isSelected ? Color.white.opacity(0.3) : color.opacity(0.15))
                        }
                }
            }
            .foregroundStyle(isSelected ? .white : color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background {
                Capsule().fill(isSelected ? color : color.opacity(0.1))
            }
        }
        .buttonStyle(.plain)
    }
}

private struct StatTile: View {
    let value: Int
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.headline.monospacedDigit())
                .foregroundStyle(AMColor.ink)
            Text(label)
                .font(.caption2)
                .foregroundStyle(AMColor.muted)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct TimelineEventRow: View {
    let event: JourneyEvent
    let isFirst: Bool
    let isLast: Bool
    let isExpanded: Bool
    let onTap: () -> Void

    private let df: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_LC")
        f.timeZone = .ect
        f.dateFormat = "dd MMM yyyy  HH:mm"
        return f
    }()

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            // Timeline spine
            VStack(spacing: 0) {
                // Line above dot
                Rectangle()
                    .fill(isFirst ? Color.clear : AMColor.line)
                    .frame(width: 1.5)
                    .frame(height: 14)

                // Category dot
                Circle()
                    .fill(event.category.color)
                    .frame(width: 10, height: 10)
                    .overlay { Circle().stroke(Color(.systemBackground), lineWidth: 2) }

                // Line below dot (extending to bottom of card)
                Rectangle()
                    .fill(isLast ? Color.clear : AMColor.line)
                    .frame(width: 1.5)
                    .frame(maxHeight: .infinity)
            }
            .frame(width: 24)
            .padding(.top, 2)

            // Card content
            Button(action: onTap) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top, spacing: 10) {
                        // Icon
                        Image(systemName: event.icon)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(event.category.color)
                            .frame(width: 24, height: 24)
                            .background {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(event.category.color.opacity(0.1))
                            }

                        VStack(alignment: .leading, spacing: 3) {
                            // Title + timestamp
                            HStack(alignment: .firstTextBaseline) {
                                Text(event.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(AMColor.ink)
                                    .lineLimit(isExpanded ? nil : 1)
                                Spacer(minLength: 8)
                                Text(df.string(from: event.date))
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(AMColor.muted)
                            }

                            // Subtitle
                            if !event.subtitle.isEmpty {
                                Text(event.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(AMColor.muted)
                                    .lineLimit(isExpanded ? nil : 2)
                                    .fixedSize(horizontal: false, vertical: isExpanded)
                            }

                            // Category badge
                            if isExpanded {
                                Text(event.category.label.uppercased())
                                    .font(.system(size: 9, weight: .bold))
                                    .tracking(1)
                                    .foregroundStyle(event.category.color)
                                    .padding(.top, 4)
                            }
                        }
                    }
                    .padding(12)
                }
                .background {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(.systemBackground))
                        .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
                }
            }
            .buttonStyle(.plain)
            .padding(.leading, 10)
            .padding(.bottom, isLast ? 0 : 6)
        }
    }
}
