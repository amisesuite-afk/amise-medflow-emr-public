// ScheduleView+CalendarViews.swift
// Month, Week, Day, shared timeline, and event-block sub-views for ScheduleView.

import SwiftUI
import SwiftData
import EventKit


// MARK: - Month view

struct MonthCalView: View {
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

    var body: some View {
        // Once per render: `cells` was rebuilt twice per day cell (~84 times, 31 calendar
        // additions each), and every cell filtered all entries with a calendar comparison.
        let cells = self.cells
        let byDay = ListPerf.groupedByDay(entries, date: { $0.start }, calendar: cal)
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
                                    entries: cell.map { byDay[cal.startOfDay(for: $0)] ?? [] } ?? [],
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
            .background {
                (date.map { cal.isDateInToday($0) } ?? false) ? Color.teal.opacity(0.05) : Color.clear
            }
            .overlay(Rectangle().fill(Color.secondary.opacity(0.1)).frame(width: 0.5), alignment: .trailing)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Week view

struct WeekCalView: View {
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
                entries: ListPerf.onDays(entries, days: days, date: { $0.start }, calendar: cal),
                onTap: onTap
            )
        }
    }
}

// MARK: - Day view

struct DayCalView: View {
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
                    // Investigation status badges for scheduled patients (worked out by ScheduleView)
                    switch entry.labBadge {
                    case .criticalLabs:
                        Image(systemName: "flask.fill")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundStyle(.red)
                    case .pending:
                        Image(systemName: "clock.badge.exclamationmark")
                            .font(.system(size: 7))
                            .foregroundStyle(.orange)
                    case .resulted:
                        Image(systemName: "flask")
                            .font(.system(size: 7))
                            .foregroundStyle(.teal)
                    case nil:
                        EmptyView()
                    }
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
            .background { entry.color.opacity(0.1) }
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
