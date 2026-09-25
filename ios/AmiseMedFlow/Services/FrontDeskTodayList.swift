// FrontDeskTodayList.swift
// Privacy rule for the front-desk Check-In lists (iPad Check-In tab, iPhone Check-In tab).
//
// The surgeon's requirement: the front-desk screen can be seen across the counter, so it must not
// show a browsable list of other patients. Before any search, the Check-In list holds only TODAY's
// patients, in the practice time zone (TimeZone.ect, America/St_Lucia by default):
//   - booked today: `Patient.operationDate` (the appointment / list date, as used by
//     TodayDashboardView's theatre, endoscopy and clinic lists) falls on today's date; or
//   - checked in today: `Patient.checkInTime` falls on today's date.
// Everyone else is reachable only through QuestionnairePatientSearch (3+ letters or an MRN, max 5).
// The rows show the name and the time only (appointment time, else arrival time).
// Pure and model-free (the generic overload), so it is unit-tested in FrontDeskListsTests.

import Foundation

enum FrontDeskTodayList {

    /// The time shown next to a name on the today list.
    struct Slot: Equatable {
        enum Kind: Equatable {
            case appointment   // booked for today (operationDate)
            case arrival       // no appointment today; checked in today (checkInTime)
        }
        let time: Date
        let kind: Kind
    }

    /// A Gregorian calendar fixed to `timeZone`, independent of the device's own zone.
    static func calendar(in timeZone: TimeZone) -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal
    }

    /// True when `date` falls on the same calendar day as `now` in `timeZone`.
    static func isSameDay(_ date: Date?, as now: Date, in timeZone: TimeZone) -> Bool {
        guard let date else { return false }
        return calendar(in: timeZone).isDate(date, inSameDayAs: now)
    }

    /// The appointment time when the patient is booked for today, else the arrival time when they
    /// checked in today, else nil (not on today's list).
    static func slot(appointment: Date?, checkIn: Date?,
                     now: Date, timeZone: TimeZone) -> Slot? {
        if let appointment, isSameDay(appointment, as: now, in: timeZone) {
            return Slot(time: appointment, kind: .appointment)
        }
        if let checkIn, isSameDay(checkIn, as: now, in: timeZone) {
            return Slot(time: checkIn, kind: .arrival)
        }
        return nil
    }

    /// True when the candidate is booked or checked in today.
    static func isOnTodaysList(appointment: Date?, checkIn: Date?,
                               now: Date, timeZone: TimeZone) -> Bool {
        slot(appointment: appointment, checkIn: checkIn, now: now, timeZone: timeZone) != nil
    }

    /// Candidates booked or checked in today, earliest slot first (input order on ties).
    static func todays<Candidate>(_ candidates: [Candidate],
                                  appointment: (Candidate) -> Date?,
                                  checkIn: (Candidate) -> Date?,
                                  now: Date,
                                  timeZone: TimeZone) -> [Candidate] {
        let slotted: [(offset: Int, candidate: Candidate, slot: Slot)] = candidates
            .enumerated()
            .compactMap { item -> (offset: Int, candidate: Candidate, slot: Slot)? in
                guard let s = slot(appointment: appointment(item.element),
                                   checkIn: checkIn(item.element),
                                   now: now, timeZone: timeZone) else { return nil }
                return (offset: item.offset, candidate: item.element, slot: s)
            }
        return slotted
            .sorted { a, b in
                a.slot.time != b.slot.time ? a.slot.time < b.slot.time : a.offset < b.offset
            }
            .map { $0.candidate }
    }

    /// "HH:mm" (24-hour) in `timeZone`.
    static func timeText(_ date: Date, timeZone: TimeZone) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.timeZone = timeZone
        df.dateFormat = "HH:mm"
        return df.string(from: date)
    }

    /// The label shown on a today row: "09:30" for an appointment, "Arrived 09:42" for a
    /// check-in without an appointment today.
    static func label(for slot: Slot, timeZone: TimeZone) -> String {
        let time = timeText(slot.time, timeZone: timeZone)
        switch slot.kind {
        case .appointment: return time
        case .arrival:     return "Arrived \(time)"
        }
    }

    // MARK: - Patient overloads

    /// Today's patients for the front-desk Check-In list. Deleted/detached records are dropped
    /// before any attribute is read; duplicate copies collapse to one row (`deduped()`).
    static func todaysPatients(_ patients: [Patient],
                               now: Date = .now,
                               timeZone: TimeZone = .ect) -> [Patient] {
        todays(patients.filter(\.isLive),
               appointment: { $0.operationDate },
               checkIn: { $0.checkInTime },
               now: now, timeZone: timeZone)
            .deduped()
    }

    /// The slot for one patient, or nil when they are not on today's list.
    static func slot(for patient: Patient,
                     now: Date = .now,
                     timeZone: TimeZone = .ect) -> Slot? {
        guard patient.isLive else { return nil }
        return slot(appointment: patient.operationDate, checkIn: patient.checkInTime,
                    now: now, timeZone: timeZone)
    }
}
