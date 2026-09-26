import Foundation

// MARK: - Visit type changed during a consultation
//
// The clinician can change the visit type from the step bar (ConsultVisitTypeChip). The pathway
// is never switched automatically: when the current one no longer fits the new visit type, the
// recommended pathway is offered as a one-tap suggestion under the step bar.

extension ConsultPathway {

    /// The pathway to offer after the visit type changed to `visitType`, or nil when `current`
    /// still fits it. The record's recommendation (`recommend(for:)`, computed with the new visit
    /// type) comes first; when that is the current pathway anyway, the visit type's own pathway.
    static func suggestion(afterChangingTo visitType: VisitType,
                           current: ConsultPathway,
                           recommended: Recommendation) -> Recommendation? {
        guard let fitting = from(visitType), fitting != current else { return nil }
        if recommended.pathway != current { return recommended }
        return Recommendation(pathway: fitting, reasons: ["Visit type: \(visitType.rawValue)"])
    }
}
