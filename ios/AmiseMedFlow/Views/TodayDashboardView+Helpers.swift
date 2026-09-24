// TodayDashboardView+Helpers.swift
// Helper funcs: isToday, createAndInsertPatient from EKEvent.

import SwiftUI
import SwiftData
import EventKit

extension TodayDashboardView {

    // MARK: - Helpers

    func isToday(_ date: Date?) -> Bool {
        guard let date else { return false }
        return cal.isDateInToday(date)
    }

    // Creates a minimal Patient record from a calendar event so the pre-consult
    // questionnaire can be opened immediately without going through the import sheet.
    @discardableResult
    func createAndInsertPatient(from event: EKEvent) -> Patient {
        let parsed = CalendarEventParser.parse(title: event.title ?? "", calLabel: event.calEntryLabel)
        let p = Patient(fullName: parsed.name, setting: parsed.setting)
        p.mrn = MRNGenerator.next(in: context)
        p.operationDate = event.startDate
        p.appointmentType = parsed.appointmentType
        p.acuity = .routine
        context.insert(p)
        try? context.save()
        return p
    }

}
