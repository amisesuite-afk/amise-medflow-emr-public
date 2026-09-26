import SwiftUI
import SwiftData
import EventKit

// MARK: - Constants

let kStartHour = 7
let kEndHour   = 21
let kHourH: CGFloat   = 60
let kGutterW: CGFloat = 48
var kTimelineH: CGFloat { CGFloat(kEndHour - kStartHour) * kHourH }

// MARK: - Unified entry

struct CalEntry: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let start: Date
    let end: Date
    let label: String
    let color: Color
    var patient: Patient?
    /// Investigation badge for a scheduled patient (day and week blocks), worked out once per
    /// render by ScheduleView instead of by every block (which decoded the investigations JSON
    /// up to three times each, on every re-render).
    var labBadge: CalLabBadge? = nil
}

enum CalLabBadge {
    case criticalLabs, pending, resulted

    /// Same precedence as before: critical values, else ordered/pending, else a recorded result.
    static func badge(for patient: Patient) -> CalLabBadge? {
        let investigations = patient.investigations
        if LabPanel.parse(from: investigations).hasCriticalValues { return .criticalLabs }
        if investigations.contains(where: { $0.status == .ordered || $0.status == .pending }) { return .pending }
        if investigations.contains(where: { $0.status == .resulted && !$0.result.isEmpty }) { return .resulted }
        return nil
    }
}

private enum CalMode: String, CaseIterable {
    case day   = "Day"
    case week  = "Week"
    case month = "Month"
}

// MARK: - ScheduleView

struct ScheduleView: View {
    @Query(sort: \Patient.createdAt, order: .reverse) private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    @EnvironmentObject private var calSvc: CalendarService

    @State private var mode: CalMode = .week
    @State var anchor: Date  = Calendar.ect.startOfDay(for: .now)
    @State private var selectedPatient: Patient?
    @State private var selectedEntry: CalEntry?
    @State private var showAdd = false

    private let cal = Calendar.ect

    private var weekStart: Date {
        // Start week on Sunday
        var comps = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: anchor)
        comps.weekday = 1
        return cal.date(from: comps) ?? anchor
    }

    private var allEntries: [CalEntry] {
        var out: [CalEntry] = []
        for p in allPatients where (p.setting == .theatre || p.setting == .endoscopy) {
            guard let s = p.operationDate else { continue }
            let c: Color = p.setting == .endoscopy ? .cyan : .purple
            let lb = p.setting == .endoscopy ? "ENDO" : "THTR"
            out.append(CalEntry(id: "L\(p.id.uuidString)", title: p.fullName,
                subtitle: p.appointmentType ?? p.workingDiagnosis ?? p.chiefComplaint,
                start: s, end: s.addingTimeInterval(7200), label: lb, color: c, patient: p))
        }
        for (ordinal, e) in calSvc.events.enumerated() {
            guard let s = e.startDate else { continue }
            let end = e.endDate ?? s.addingTimeInterval(3600)
            out.append(CalEntry(
                // Stable across renders (an event without an identifier used to get a fresh
                // UUID each render, so its block was torn down and rebuilt every time).
                id: ListPerf.calendarEntryID(eventIdentifier: e.eventIdentifier, title: e.title,
                                             start: s, ordinal: ordinal),
                title: e.title ?? "Event",
                subtitle: e.calendar?.title,
                start: s, end: end,
                label: e.calEntryLabel,
                color: e.calEntryColor
            ))
        }
        return out.sorted { $0.start < $1.start }
    }

    private var periodLabel: String {
        switch mode {
        case .day:
            return anchor.formatted(.dateTime.weekday(.wide).month(.wide).day().year())
        case .week:
            let end = cal.date(byAdding: .day, value: 6, to: weekStart)!
            return "\(weekStart.formatted(.dateTime.month(.abbreviated).day())) – \(end.formatted(.dateTime.month(.abbreviated).day().year()))"
        case .month:
            return anchor.formatted(.dateTime.month(.wide).year())
        }
    }

    /// Day/week entries with their investigation badges (only the visible patients' JSON is decoded).
    private func withLabBadges(_ entries: [CalEntry]) -> [CalEntry] {
        entries.map { entry in
            guard let p = entry.patient, p.isLive else { return entry }
            var e = entry
            e.labBadge = CalLabBadge.badge(for: p)
            return e
        }
    }

    private func step(_ n: Int) {
        let comp: Calendar.Component = mode == .day ? .day : mode == .week ? .weekOfYear : .month
        anchor = cal.date(byAdding: comp, value: n, to: anchor) ?? anchor
    }

    var body: some View {
        let entries = allEntries
        VStack(spacing: 0) {
            // ── Header ─────────────────────────────────────────────
            HStack(spacing: 12) {
                Picker("", selection: $mode) {
                    ForEach(CalMode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(width: 210)

                Spacer()

                HStack(spacing: 2) {
                    Button { step(-1) } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .semibold))
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)

                    Button {
                        anchor = cal.startOfDay(for: .now)
                        Task { await calSvc.sync() }
                    } label: {
                        HStack(spacing: 4) {
                            if calSvc.isSyncing {
                                ProgressView().controlSize(.mini).tint(.teal)
                            }
                            Text("Today")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .padding(.horizontal, 12).padding(.vertical, 5)
                        .background(Color.teal.opacity(0.12), in: Capsule())
                        .foregroundStyle(.teal)
                    }
                    .buttonStyle(.plain)

                    Button { step(1) } label: {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 10)

            Text(periodLabel)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.bottom, 8)

            if let err = calSvc.error {
                Label(err, systemImage: "exclamationmark.triangle")
                    .font(.caption).foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16).padding(.bottom, 4)
            }

            Divider()

            // ── Calendar body ───────────────────────────────────────
            switch mode {
            case .day:
                DayCalView(date: anchor,
                    entries: withLabBadges(entries.filter { cal.isDate($0.start, inSameDayAs: anchor) })
                ) { entry in
                    if let p = entry.patient { selectedPatient = p }
                    else { selectedEntry = entry }
                }

            case .week:
                let start = weekStart
                let days = (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
                WeekCalView(weekStart: start,
                            entries: withLabBadges(ListPerf.onDays(entries, days: days,
                                                                   date: { $0.start }, calendar: cal))) { entry in
                    if let p = entry.patient { selectedPatient = p }
                    else { selectedEntry = entry }
                }

            case .month:
                MonthCalView(monthDate: anchor, entries: entries) { d in
                    anchor = d; mode = .day
                }
            }
        }
        .navigationTitle("Schedule")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                HStack {
                    Button { Task { await calSvc.sync() } } label: {
                        if calSvc.isSyncing {
                            ProgressView().controlSize(.small)
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel("Schedule appointment")
                        .accessibilityIdentifier("schedule.add")
                }
            }
        }
        .task { await calSvc.sync() }
        .onAppear {
            CrashReporting.breadcrumb("Opened schedule")
            let today = cal.startOfDay(for: .now)
            if anchor != today { anchor = today }
        }
        .sheet(isPresented: $showAdd) { AppointmentSchedulerView() }
        .patientRecordPresentation(item: $selectedPatient)
        .sheet(item: $selectedEntry) { entry in
            let setting: ClinicalSetting = {
                switch entry.label {
                case "THTR": return .theatre
                case "ENDO": return .endoscopy
                default:     return .outpatient
                }
            }()
            AddPatientView(
                initialSetting: setting,
                initialName: entry.title,
                initialProcedure: entry.subtitle ?? "",
                operationDate: (setting == .theatre || setting == .endoscopy) ? entry.start : nil
            )
        }
    }
}
