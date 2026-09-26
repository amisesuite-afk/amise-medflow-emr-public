import Foundation

// MARK: - Scheduler: visit type ↔ booking type
//
// The front-desk scheduler (AppointmentSchedulerView) books a calendar slot by `ApptType`
// (duration, theatre / endoscopy list) and records the patient's `VisitType` (which consultation
// pathway and record sections the clinician sees). Administrative only: nothing here is shown to
// the patient, and the email / SMS texts keep the booking type alone.

extension ApptType {
    /// Booking type that goes with a visit type, applied when staff tap a visit-type chip (they can
    /// still change it). nil = no obvious booking type (telephone): leave the current one.
    static func suggested(for visitType: VisitType) -> ApptType? {
        switch visitType {
        case .newConsult, .wellness:                     return .newConsult
        case .followUp, .postOp, .wardReview:            return .followUp
        case .ogd, .colonoscopy, .ercp, .bronchoscopy:   return .endoscopy
        case .surgeryElective, .surgeryEmergency, .dayOfSurgery: return .procedure
        case .urgentReview, .trauma, .burns:             return .emergency
        case .telephone:                                 return nil
        }
    }

    /// Calendar event label (practice calendar, staff only): the booking type, then the visit type
    /// when it adds something ("Endoscopy / ERCP · Colonoscopy"). Said once when they are the same
    /// words ("New Consultation" / "New Consult", "Follow-Up" / "Follow-up").
    static func eventLabel(_ type: ApptType, visitType: VisitType) -> String {
        let t = type.rawValue
        let v = visitType.rawValue
        let tl = t.lowercased(), vl = v.lowercased()
        if tl.hasPrefix(vl) || vl.hasPrefix(tl) { return t }
        return "\(t) · \(v)"
    }

    /// Clinical setting a booking puts the patient in (theatre / endoscopy list), or nil.
    var impliedSetting: ClinicalSetting? {
        switch self {
        case .procedure: return .theatre
        case .endoscopy: return .endoscopy
        default:         return nil
        }
    }

    /// What `applyBooking` changed on the record.
    struct BookingRecordChange: Equatable {
        var edited = false
        var visitTypeChanged = false
        var appointmentTypeChanged = false
    }

    /// The record part of a booking, saved on the device before the calendar write and whatever
    /// happens to it (calendar access denied, no calendar): the visit type; the booking type
    /// (`appointmentType`, synced as patients.appointment_type) unless the record holds a more
    /// specific label from elsewhere (a calendar import's "Colonoscopy"); for a procedure or
    /// endoscopy, the setting and date. Marks the record for sync only when something changed.
    @discardableResult
    static func applyBooking(_ type: ApptType, visitType: VisitType, date: Date,
                             to patient: Patient) -> BookingRecordChange {
        var change = BookingRecordChange()
        if let setting = type.impliedSetting {
            if patient.setting != setting { patient.setting = setting; change.edited = true }
            if patient.operationDate != date { patient.operationDate = date; change.edited = true }
        }
        let current = patient.appointmentType ?? ""
        let isSchedulerLabel = ApptType.allCases.contains { $0.rawValue == current }
        if (current.isEmpty || isSchedulerLabel) && current != type.rawValue {
            patient.appointmentType = type.rawValue
            change.edited = true
            change.appointmentTypeChanged = true
        }
        // Visit type: decides the consultation pathway and the record sections. Front desk may set
        // it (visit_type is on the Migration 89 allow-list, FrontDeskPatientColumns).
        if patient.visitType != visitType {
            patient.visitType = visitType
            change.edited = true
            change.visitTypeChanged = true
        }
        if change.edited {
            patient.updatedAt = .now
            patient.pendingSync = true
        }
        return change
    }
}
