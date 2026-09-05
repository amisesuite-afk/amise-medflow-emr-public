import SwiftUI
import SwiftData
import EventKit

// MARK: - Constants

private let kStartHour = 7
private let kEndHour   = 21
private let kHourH: CGFloat   = 60
private let kGutterW: CGFloat = 48
private var kTimelineH: CGFloat { CGFloat(kEndHour - kStartHour) * kHourH }

// MARK: - Unified entry

private struct CalEntry: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let start: Date
    let end: Date
    let label: String
    let color: Color
    var patient: Patient?
}

private enum CalMode: String, CaseIterable {
    case day   = "Day"
    case week  = "Week"
    case month = "Month"
}

// MARK: - ScheduleView

struct ScheduleView: View {
    @Query(sort: \Patient.createdAt, order: .reverse) private var allPatients: [Patient]
    @EnvironmentObject private var calSvc: CalendarService

    @State private var mode: CalMode = .week
    @State private var anchor: Date  = Calendar.ect.startOfDay(for: .now)
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
        for e in calSvc.events {
            guard let s = e.startDate else { continue }
            let end = e.endDate ?? s.addingTimeInterval(3600)
            out.append(CalEntry(
                id: "K\(e.eventIdentifier ?? UUID().uuidString)",
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

    private func step(_ n: Int) {
        let comp: Calendar.Component = mode == .day ? .day : mode == .week ? .weekOfYear : .month
        anchor = cal.date(byAdding: comp, value: n, to: anchor) ?? anchor
    }

    var body: some View {
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

                    Button { anchor = cal.startOfDay(for: .now) } label: {
                        Text("Today")
                            .font(.system(size: 12, weight: .semibold))
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
                    entries: allEntries.filter { cal.isDate($0.start, inSameDayAs: anchor) }
                ) { entry in
                    if let p = entry.patient { selectedPatient = p }
                    else { selectedEntry = entry }
                }

            case .week:
                WeekCalView(weekStart: weekStart, entries: allEntries) { entry in
                    if let p = entry.patient { selectedPatient = p }
                    else { selectedEntry = entry }
                }

            case .month:
                MonthCalView(monthDate: anchor, entries: allEntries) { d in
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
                        if calSvc.isSyncing { ProgressView().controlSize(.small) }
                        else { Image(systemName: "arrow.clockwise") }
                    }
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
        }
        .task { await calSvc.fetch() }
        .sheet(isPresented: $showAdd) { AppointmentSchedulerView() }
        .sheet(item: $selectedPatient) { PatientDetailView(patient: $0) }
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

// MARK: - Month view

private struct MonthCalView: View {
    let monthDate: Date
    let entries: [CalEntry]
    let onSelectDay: (Date) -> Void

    private let cal = Calendar.ect
    private let dayLetters = ["S", "M", "T", "W", "T", "F", "S"]

    private var monthStart: Date {
        cal.date(from: cal.dateComponents([.year, .month], from: monthDate))!
    }
    private var daysInMonth: Int { cal.range(of: .day, in: .month, for: monthDate)!.count }
    private var leadingBlanks: Int { cal.component(.weekday, from: monthStart) - 1 }

    private var cells: [Date?] {
        var out: [Date?] = Array(repeating: nil, count: leadingBlanks)
        for d in 0..<daysInMonth {
            out.append(cal.date(byAdding: .day, value: d, to: monthStart))
        }
        while out.count % 7 != 0 { out.append(nil) }
        return out
    }

    private func dayEntries(_ date: Date) -> [CalEntry] {
        entries.filter { cal.isDate($0.start, inSameDayAs: date) }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Weekday labels
            HStack(spacing: 0) {
                ForEach(dayLetters.indices, id: \.self) { i in
                    Text(dayLetters[i])
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical, 8)
            Divider()
            let rows = cells.count / 7
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(0..<rows, id: \.self) { row in
                        HStack(alignment: .top, spacing: 0) {
                            ForEach(0..<7, id: \.self) { col in
                                let idx = row * 7 + col
                                let cell: Date? = idx < cells.count ? cells[idx] : nil
                                MonthDayCell(
                                    date: cell,
                                    entries: cell.map { dayEntries($0) } ?? [],
                                    onTap: { if let d = cell { onSelectDay(d) } }
                                )
                            }
                        }
                        if row < rows - 1 { Divider() }
                    }
                }
            }
        }
    }
}

private struct MonthDayCell: View {
    let date: Date?
    let entries: [CalEntry]
    let onTap: () -> Void

    private let cal = Calendar.ect

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 2) {
                if let date {
                    let isToday = cal.isDateInToday(date)
                    ZStack {
                        if isToday { Circle().fill(Color.teal).frame(width: 24, height: 24) }
                        Text("\(cal.component(.day, from: date))")
                            .font(.system(size: 13, weight: isToday ? .bold : .regular))
                            .foregroundStyle(isToday ? .white : .primary)
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 4)

                    ForEach(entries.prefix(3), id: \.id) { e in
                        HStack(spacing: 3) {
                            Circle().fill(e.color).frame(width: 5, height: 5)
                            Text(e.title).font(.system(size: 9)).lineLimit(1).foregroundStyle(.primary)
                        }
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(e.color.opacity(0.1), in: RoundedRectangle(cornerRadius: 3))
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if entries.count > 3 {
                        Text("+\(entries.count - 3) more")
                            .font(.system(size: 9)).foregroundStyle(.secondary)
                            .padding(.horizontal, 4)
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 82, alignment: .topLeading)
            .background((date.map { cal.isDateInToday($0) } ?? false)
                ? Color.teal.opacity(0.05) : Color.clear)
            .overlay(Rectangle().fill(Color.secondary.opacity(0.1)).frame(width: 0.5), alignment: .trailing)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Week view

private struct WeekCalView: View {
    let weekStart: Date
    let entries: [CalEntry]
    let onTap: (CalEntry) -> Void
    private let cal = Calendar.ect

    private var days: [Date] {
        (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: weekStart) }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Day column headers
            HStack(spacing: 0) {
                Spacer().frame(width: kGutterW)
                ForEach(days, id: \.self) { day in
                    let isToday = cal.isDateInToday(day)
                    VStack(spacing: 2) {
                        Text(day.formatted(.dateTime.weekday(.short)))
                            .font(.system(size: 11))
                            .foregroundStyle(isToday ? .teal : .secondary)
                        ZStack {
                            if isToday { Circle().fill(Color.teal).frame(width: 26, height: 26) }
                            Text("\(cal.component(.day, from: day))")
                                .font(.system(size: 15, weight: isToday ? .bold : .regular))
                                .foregroundStyle(isToday ? .white : .primary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical, 6)
            Divider()
            CalTimeline(
                days: days,
                entries: entries.filter { e in days.contains { cal.isDate(e.start, inSameDayAs: $0) } },
                onTap: onTap
            )
        }
    }
}

// MARK: - Day view

private struct DayCalView: View {
    let date: Date
    let entries: [CalEntry]
    let onTap: (CalEntry) -> Void

    var body: some View {
        VStack(spacing: 0) {
            CalTimeline(days: [date], entries: entries, onTap: onTap)
        }
    }
}

// MARK: - Shared timeline (used by both Day and Week)

private struct CalTimeline: View {
    let days: [Date]
    let entries: [CalEntry]
    let onTap: (CalEntry) -> Void

    private let cal = Calendar.ect

    var body: some View {
        GeometryReader { outer in
            let colW = days.isEmpty
                ? outer.size.width - kGutterW
                : (outer.size.width - kGutterW) / CGFloat(days.count)

            ScrollViewReader { svr in
                ScrollView(.vertical, showsIndicators: true) {
                    ZStack(alignment: .topLeading) {

                        // ── Hour gutter + horizontal grid lines ───────────
                        HStack(alignment: .top, spacing: 0) {
                            // Time labels
                            VStack(alignment: .trailing, spacing: 0) {
                                ForEach(Array(kStartHour...kEndHour), id: \.self) { h in
                                    Text(hourLabel(h))
                                        .font(.system(size: 9))
                                        .foregroundStyle(.tertiary)
                                        .frame(width: kGutterW - 6, height: kHourH, alignment: .topTrailing)
                                        .id("h\(h)")
                                }
                            }
                            .padding(.trailing, 4)

                            // Grid area
                            ZStack(alignment: .topLeading) {
                                // Horizontal hour lines
                                VStack(spacing: 0) {
                                    ForEach(Array(kStartHour...kEndHour), id: \.self) { _ in
                                        Color.secondary.opacity(0.1).frame(height: 0.5)
                                        Color.clear.frame(height: kHourH - 0.5)
                                    }
                                }
                                .frame(width: colW * CGFloat(days.count))

                                // Vertical column separators (week view only)
                                if days.count > 1 {
                                    ForEach(1..<days.count, id: \.self) { i in
                                        Color.secondary.opacity(0.12)
                                            .frame(width: 0.5, height: kTimelineH)
                                            .offset(x: colW * CGFloat(i))
                                    }
                                }

                                // Current time indicator
                                let nowComps = cal.dateComponents([.hour, .minute], from: .now)
                                let nowMins = (nowComps.hour ?? 0) * 60 + (nowComps.minute ?? 0) - kStartHour * 60
                                let nowY = CGFloat(nowMins) * kHourH / 60
                                if nowY >= 0 && nowY <= kTimelineH,
                                   let ti = days.firstIndex(where: { cal.isDateInToday($0) }) {
                                    HStack(spacing: 0) {
                                        Circle().fill(Color.red).frame(width: 8, height: 8)
                                        Rectangle().fill(Color.red)
                                            .frame(width: colW - 8, height: 1.5)
                                    }
                                    .offset(x: CGFloat(ti) * colW, y: nowY - 4)
                                }

                                // Events
                                ForEach(entries) { entry in
                                    if let ci = days.firstIndex(where: {
                                        cal.isDate(entry.start, inSameDayAs: $0)
                                    }) {
                                        let yOff = yPos(entry.start)
                                        let h = max(26, eventH(entry))
                                        if yOff >= -kHourH && yOff <= kTimelineH {
                                            CalEventBlock(entry: entry) {
                                                onTap(entry)
                                            }
                                            .frame(width: colW - 5, height: h)
                                            .offset(x: CGFloat(ci) * colW + 2, y: yOff)
                                        }
                                    }
                                }
                            }
                            .frame(width: colW * CGFloat(days.count), height: kTimelineH)
                        }
                    }
                    .frame(width: outer.size.width, height: kTimelineH)
                }
                .onAppear {
                    let target = max(kStartHour, min(kEndHour, cal.component(.hour, from: .now) - 1))
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        withAnimation(.easeOut(duration: 0.3)) { svr.scrollTo("h\(target)", anchor: .top) }
                    }
                }
            }
        }
    }

    private func yPos(_ date: Date) -> CGFloat {
        let c = cal.dateComponents([.hour, .minute], from: date)
        let mins = (c.hour ?? kStartHour) * 60 + (c.minute ?? 0) - kStartHour * 60
        return CGFloat(mins) * kHourH / 60
    }

    private func eventH(_ e: CalEntry) -> CGFloat {
        CGFloat(e.end.timeIntervalSince(e.start) / 60) * kHourH / 60
    }

    private func hourLabel(_ h: Int) -> String {
        switch h {
        case 0, 24: return "12am"
        case 12:    return "12pm"
        default:    return h < 12 ? "\(h)am" : "\(h - 12)pm"
        }
    }
}

// MARK: - Event block

private struct CalEventBlock: View {
    let entry: CalEntry
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(entry.label)
                        .font(.system(size: 8, weight: .heavy))
                        .foregroundStyle(entry.color)
                    Text(DateFormatter.ectShort.string(from: entry.start))
                        .font(.system(size: 8))
                        .foregroundStyle(entry.color.opacity(0.7))
                    Spacer(minLength: 0)
                }
                Text(entry.title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                if let sub = entry.subtitle {
                    Text(sub)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 5)
            .padding(.vertical, 3)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(entry.color.opacity(0.1))
            .overlay(alignment: .leading) {
                Rectangle().fill(entry.color).frame(width: 3)
            }
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay {
                RoundedRectangle(cornerRadius: 4).stroke(entry.color.opacity(0.3), lineWidth: 0.5)
            }
        }
        .buttonStyle(.plain)
    }
}
