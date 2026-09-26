// WhatsMissingCore+Probe.swift
// Which of the decision layer's missing inputs would change the answer: each is probed by re-running
// the same decision with an adverse value from the rules (CFS 7, ASA IV, eGFR 25, pregnant, BMI 42,
// HAS-BLED 3, NEWS2 7). A band change (e.g. Treat → Observe for elective hernia repair) makes it a
// decision-tier gap, ranked by |P − treat threshold|. Nothing in the decision engine changes.
//
// DRIFT NOTE: Swift twin of lib/pane-engine/src/whats-missing/decision-probe.ts (same vectors).

import Foundation

extension WhatsMissing {

    private static func probed(_ patient: TreatmentDecisions.DecisionPatient, _ key: String,
                               _ value: ProbeValue) -> TreatmentDecisions.DecisionPatient {
        var p = patient
        let n = value.number
        switch key {
        case "cfs": p.cfs = n
        case "asa": p.asa = n
        case "egfr": p.egfr = n
        case "pregnancy": p.pregnancy = "pregnant"
        case "bmi": p.bmi = n
        case "hasBled": p.hasBled = n
        case "news2": p.news2 = n
        default: break
        }
        return p
    }

    /// The missing inputs of each decision, probed (base and probe through the same line filter).
    static func decisionGaps(_ input: TreatmentDecisions.Input, rules: Rules,
                             content: TreatmentDecisions.Content,
                             filter: @escaping TreatmentDecisions.LineFilter = TreatmentDecisions.identityFilter) -> [DecisionGap] {
        let base = TreatmentDecisions.decisionSupport(input, content, filter)
        var out: [DecisionGap] = []
        for d in base.decisions {
            let def = content.decisions.first { $0.id == d.id }
            if let risk = def?.riskScore, d.missing.contains(where: { $0.hasPrefix("Calculate the ") }) {
                out.append(DecisionGap(key: "score:\(risk)", decisionId: d.id, decisionLabel: d.label, effect: "",
                                       flip: nil, distance: nil))
            }
            for di in rules.decisionInputs {
                guard let info = content.missingInputs[di.key],
                      d.missing.contains(where: { $0.hasPrefix("Record \(info.label) to refine") }) else { continue }
                var probeInput = input
                probeInput.patient = probed(input.patient, di.key, di.probe)
                let probe = TreatmentDecisions.decisionSupport(probeInput, content, filter)
                let after = probe.decisions.first { $0.id == d.id }
                var flip: Flip? = nil
                var distance: Double? = nil
                if let after = after, let p = d.probability {
                    for o in d.options {
                        guard let a = after.options.first(where: { $0.id == o.id }),
                              o.band != .unknown, a.band != .unknown, a.band != o.band else { continue }
                        flip = Flip(option: o.label, from: o.band.rawValue, to: a.band.rawValue)
                        distance = TreatmentDecisions.round4(abs(p - o.treatThreshold.point))
                        break
                    }
                }
                out.append(DecisionGap(key: di.key, decisionId: d.id, decisionLabel: d.label, effect: info.effect,
                                       flip: flip, distance: distance))
            }
        }
        return out
    }
}
