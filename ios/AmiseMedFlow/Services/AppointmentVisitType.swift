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
}
