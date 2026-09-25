import Foundation

// MARK: - Consultation pathway ("first door")
//
// The first choice in a consultation: what kind of visit is this? Each pathway orders the
// consultation steps for that visit, so the surgeon moves through the relevant screens in a
// sensible sequence instead of one fixed tab list. Every tab stays reachable through "More".
//
// The recommendation is a suggestion from the record (chief complaint, setting, visit type,
// previous visits). The clinician always chooses. Nothing is changed until they tap.

enum ConsultPathway: String, CaseIterable, Identifiable {
    case firstVisit, followUp, wardReview, procedure, trauma, burns, wellness

    var id: String { rawValue }

    var title: String {
        switch self {
        case .firstVisit: return "First visit"
        case .followUp:   return "Follow-up"
        case .wardReview: return "Ward review"
        case .procedure:  return "Procedure"
        case .trauma:     return "Trauma"
        case .burns:      return "Burns"
        case .wellness:   return "Wellness / Check-up"
        }
    }

    var subtitle: String {
        switch self {
        case .firstVisit: return "New problem — full history, exam, work-up"
        case .followUp:   return "Review progress, results and plan"
        case .wardReview: return "Inpatient round — vitals, NEWS2, checklist"
        case .procedure:  return "Endoscopy or surgery — pre-procedure safety"
        case .trauma:     return "ATLS primary & secondary survey"
        case .burns:      return "TBSA, depth, fluids, referral criteria"
        case .wellness:   return "Risk-based screening and prevention"
        }
    }

    var icon: String {
        switch self {
        case .firstVisit: return "person.fill.questionmark"
        case .followUp:   return "arrow.clockwise"
        case .wardReview: return "bed.double.fill"
        case .procedure:  return "scissors"
        case .trauma:     return "cross.case.fill"
        case .burns:      return "flame.fill"
        case .wellness:   return "heart.text.square"
        }
    }

    var accentHex: String {
        switch self {
        case .firstVisit: return "#0D9488"
        case .followUp:   return "#2563EB"
        case .wardReview: return "#4D7C0F"
        case .procedure:  return "#7C3AED"
        case .trauma:     return "#DC2626"
        case .burns:      return "#EA580C"
        case .wellness:   return "#059669"
        }
    }

    /// Ordered consultation steps for this pathway.
    var steps: [ConsultTab] {
        switch self {
        case .firstVisit:
            return [.risk, .cc, .hpi, .pmh, .pshx, .meds, .allergies, .social,
                    .exam, .investigations, .diagnosis, .plan]
        case .followUp:
            // SOAP plus the standing history, reviewed and updated at every visit: PMH, surgical
            // history, medicines and allergies (owner's instruction, 2026-09-25).
            return [.risk, .history, .hpi, .pmh, .pshx, .meds, .allergies,
                    .exam, .investigations, .diagnosis, .plan]
        case .wardReview:
            return [.ward, .hpi, .exam, .investigations, .diagnosis, .plan]
        case .procedure:
            return [.risk, .cc, .allergies, .meds, .pmh, .pshx, .investigations, .preop, .consent, .plan]
        case .trauma:
            return [.trauma, .allergies, .meds, .pmh, .exam, .investigations, .diagnosis, .plan]
        case .burns:
            return [.burns, .trauma, .allergies, .meds, .pmh, .investigations, .plan]
        case .wellness:
            return [.screening, .pmh, .social, .meds, .allergies, .exam, .investigations, .plan]
        }
    }

    /// Step label: some tabs mean something different in a given pathway.
    func label(for tab: ConsultTab) -> String {
        switch (self, tab) {
        case (.followUp, .hpi):    return "Interval Hx"
        case (.followUp, .history): return "Last visit"
        case (.wardReview, .hpi):  return "Progress"
        case (.procedure, .cc):    return "Indication"
        case (.trauma, .pmh), (.burns, .pmh): return "AMPLE"
        case (.burns, .trauma):    return "ATLS"
        default:                   return tab.rawValue
        }
    }

    /// Visit type recorded when this pathway is chosen. Keeps a more specific existing type
    /// (e.g. ERCP stays ERCP when the procedure pathway is chosen).
    func visitType(keeping current: VisitType?) -> VisitType {
        if let current, ConsultPathway.from(current) == self { return current }
        switch self {
        case .firstVisit: return .newConsult
        case .followUp:   return .followUp
        case .wardReview: return .wardReview
        case .procedure:  return .dayOfSurgery
        case .trauma:     return .trauma
        case .burns:      return .burns
        case .wellness:   return .wellness
        }
    }

    static func from(_ visitType: VisitType?) -> ConsultPathway? {
        switch visitType {
        case .newConsult, .urgentReview, .telephone: return .firstVisit
        case .followUp, .postOp:                     return .followUp
        case .wardReview:                            return .wardReview
        case .dayOfSurgery, .ercp, .ogd, .colonoscopy, .bronchoscopy,
             .surgeryElective, .surgeryEmergency:    return .procedure
        case .trauma:                                return .trauma
        case .burns:                                 return .burns
        case .wellness:                              return .wellness
        case nil:                                    return nil
        }
    }

    // MARK: - Recommendation

    struct Recommendation {
        let pathway: ConsultPathway
        let reasons: [String]
    }

    /// Suggest a pathway from the record. First matching rule wins, most specific first.
    static func recommend(for p: Patient) -> Recommendation {
        // Whole words, negation-aware: "Heartburn", "burning pain" and "inflamed" are not burns,
        // "portal", "aorta", "stable" and "crushing chest pain" are not trauma, "no trauma" is not
        // trauma. Inflected forms that used to match as substrings are listed explicitly
        // ("burnt", "stabbed"); plurals of words of four letters or more match ("burns", "stabs").
        let cc = NegationMatcher.Source(p.chiefComplaint ?? "")
        func mentions(_ words: [String]) -> String? { cc.firstAffirmed(words, wholeWord: true) }

        if let w = mentions(["burn", "burnt", "burned", "scald", "scalded", "flame",
                             "electrical injury", "chemical injury"]) {
            return .init(pathway: .burns, reasons: ["Chief complaint mentions \"\(w)\""])
        }
        if p.visitType == .burns {
            return .init(pathway: .burns, reasons: ["Booked as a burns visit"])
        }
        if p.visitType == .trauma {
            return .init(pathway: .trauma, reasons: ["Booked as a trauma visit"])
        }
        if let w = mentions(["trauma", "traumatic", "rta", "road traffic", "mvc", "fall from",
                             "assault", "assaulted", "stab", "stabbed", "gunshot", "machete", "chop",
                             "chopped", "crush", "crushed", "injury", "injuries"]) {
            return .init(pathway: .trauma, reasons: ["Chief complaint mentions \"\(w)\""])
        }
        if p.setting == .inpatient || p.visitType == .wardReview {
            var r = ["Inpatient"]
            if let ward = p.ward, !ward.isEmpty { r.append("Ward \(ward)") }
            if let d = p.postOpDays { r.append("Post-op day \(d)") }
            return .init(pathway: .wardReview, reasons: r)
        }
        if let vt = p.visitType, from(vt) == .procedure {
            return .init(pathway: .procedure, reasons: ["Booked for \(vt.rawValue)"])
        }
        if p.setting == .theatre || p.setting == .endoscopy {
            return .init(pathway: .procedure, reasons: ["Listed in \(p.setting.rawValue.lowercased())"])
        }
        if let op = p.operationDate, Calendar.current.isDateInToday(op) {
            return .init(pathway: .procedure, reasons: ["Procedure scheduled today"])
        }
        if p.visitType == .wellness {
            return .init(pathway: .wellness, reasons: ["Booked as a check-up"])
        }
        if let w = mentions(["check-up", "checkup", "check up", "screening", "wellness",
                             "physical", "medical exam", "annual review"]) {
            return .init(pathway: .wellness, reasons: ["Chief complaint mentions \"\(w)\""])
        }
        // Returning patient: a follow-up of the last problem, unless today's complaint is a new,
        // different one (VisitContinuity).
        if let last = VisitContinuity.lastVisit(for: p) {
            let days = Calendar.current.dateComponents([.day], from: last.date, to: .now).day ?? 0
            let seen = "Seen before — last visit \(days) day\(days == 1 ? "" : "s") ago"
            if VisitContinuity.isSameProblem(current: p.chiefComplaint, previous: last) {
                return .init(pathway: .followUp,
                             reasons: [seen] + (last.problem.map { ["Continuing: \($0)"] } ?? []))
            }
            return .init(pathway: .firstVisit,
                         reasons: [seen, "New complaint — last visit was for \(last.problem ?? "another problem")"])
        }
        if p.visitType == .followUp || p.visitType == .postOp {
            return .init(pathway: .followUp, reasons: ["Booked as \(p.visitType!.rawValue)"])
        }
        return .init(pathway: .firstVisit, reasons: ["No previous visits on record"])
    }
}
