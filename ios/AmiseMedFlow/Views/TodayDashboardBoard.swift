// TodayDashboardBoard.swift
// Everything the Today screen lists, computed once per render.

import SwiftUI
import SwiftData
import EventKit

/// The Today screen's lists and counts. TodayDashboardView builds one per render and hands it to
/// every section. Before, each section, header count, summary tile and the search/import helpers
/// recomputed its list from all patients (filter, sort, `deduped()`), so one render filtered and
/// de-duplicated the whole patient store 20–40 times, re-sorted each ward patient's vitals several
/// times and decoded every patient's investigations JSON several times. The results are the same.
struct TodayBoard {
    var readyForDoctor: [Patient] = []
    var ward: [Patient] = []
    var highAcuityWard: [Patient] = []
    var withNewResults: [Patient] = []
    var theatre: [Patient] = []
    var endoscopy: [Patient] = []
    var clinic: [Patient] = []
    var calendarEvents: [EKEvent] = []
    /// Every patient above, once each (search and the summary total).
    var allToday: [Patient] = []
    var unimportedCalEventCount = 0
    /// NEWS2 of the most recent vitals entry per ward patient (alert rows).
    var latestNEWS2: [UUID: News2Snapshot] = [:]
    /// "FBC, U&E +2 more" per patient in `withNewResults`.
    var resultsSummary: [UUID: String] = [:]

    var isAnythingOn: Bool {
        !readyForDoctor.isEmpty || !ward.isEmpty ||
        !theatre.isEmpty || !endoscopy.isEmpty || !clinic.isEmpty ||
        !calendarEvents.isEmpty
    }

    var totalCount: Int { allToday.count }

    init() {}

    /// `patients` must already exclude deleted records (`isLive`).
    init(patients: [Patient], events: [EKEvent], calendar cal: Calendar) {
        func isToday(_ date: Date?) -> Bool {
            guard let date else { return false }
            return cal.isDateInToday(date)
        }

        ward = patients
            .filter { $0.setting == .inpatient || $0.setting == .emergency }
            .sorted { $0.acuity < $1.acuity }
            .deduped()

        theatre = patients
            .filter { $0.setting == .theatre && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
            .deduped()

        endoscopy = patients
            .filter { $0.setting == .endoscopy && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
            .deduped()

        clinic = patients
            .filter { $0.setting == .outpatient && isToday($0.operationDate) }
            .sorted { ($0.operationDate ?? .now) < ($1.operationDate ?? .now) }
            .deduped()

        // Latest vitals once per ward patient (was a full sort per patient, twice per render).
        for p in ward {
            if let v = ListPerf.newest(p.vitalsEntries.filter(\.isLive), by: { $0.recordedAt }) {
                latestNEWS2[p.id] = News2Snapshot(v)
            }
        }
        highAcuityWard = ward.filter { p in
            guard let n = latestNEWS2[p.id] else { return p.setting == .emergency }
            return n.risk == "High" || n.hasRedFlag
        }

        // Investigations JSON decoded once per patient (was once per use, four uses per render).
        for p in patients.deduped() {
            let resulted = p.investigations.filter { $0.status == .resulted && !$0.result.isEmpty }
            guard !resulted.isEmpty else { continue }
            withNewResults.append(p)
            resultsSummary[p.id] = ListPerf.namesSummary(resulted.map { $0.name }, shown: 2)
        }

        readyForDoctor = patients
            .filter { $0.encounterStatus == .waiting && isToday($0.checkInTime) }
            .sorted { ($0.checkInTime ?? .distantPast) < ($1.checkInTime ?? .distantPast) }
            .deduped()

        // Calendar events from iOS EventKit (syncs with Google Calendar when the user adds their
        // Google account in iOS Settings → Calendar → Accounts)
        calendarEvents = events
            .filter { isToday($0.startDate) && !$0.isAllDay }
            .sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }

        allToday = ListPerf.uniqued(readyForDoctor + highAcuityWard + ward +
                                    theatre + endoscopy + clinic, id: { $0.id })

        // Calendar events today that don't yet have a matching patient record
        let existingNames = Set(allToday.map { $0.fullName.lowercased().trimmingCharacters(in: .whitespaces) })
        unimportedCalEventCount = calendarEvents.filter { event in
            guard let title = event.title, !title.isEmpty else { return false }
            let parsed = CalendarEventParser.parse(title: title, calLabel: event.calEntryLabel)
            return !parsed.name.isEmpty && !existingNames.contains(parsed.name.lowercased().trimmingCharacters(in: .whitespaces))
        }.count
    }
}
