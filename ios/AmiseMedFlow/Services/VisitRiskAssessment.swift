import Foundation

// MARK: - Visit risk assessment
//
// A deterministic risk snapshot from what is already in the record: latest vitals / NEWS2,
// acuity, age, allergies, anticoagulants, diabetes, BMI, smoking, pregnancy potential and
// surgical timeline. It is shown at the start of every pathway so high-risk items are seen
// before the history starts. It only flags and explains. It never changes the record.

struct RiskFlag: Identifiable {
    enum Level: Int, Comparable {
        case info = 0, moderate = 1, high = 2
        static func < (a: Level, b: Level) -> Bool { a.rawValue < b.rawValue }
        var label: String {
            switch self {
            case .info:     return "Note"
            case .moderate: return "Moderate"
            case .high:     return "High"
            }
        }
    }

    let id = UUID()
    let level: Level
    let title: String
    let detail: String
    let icon: String
}

enum VisitRiskAssessment {

    static let anticoagulants = [
        "warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban",
        "enoxaparin", "heparin", "clopidogrel", "ticagrelor", "prasugrel"
    ]

    static func assess(_ p: Patient, pathway: ConsultPathway?) -> [RiskFlag] {
        var flags: [RiskFlag] = []
        let acutePathway = pathway == .trauma || pathway == .burns || pathway == .procedure

        // Vitals / NEWS2
        let vitals = p.vitalsEntries.filter(\.hasAnyValue).sorted { $0.recordedAt > $1.recordedAt }
        if let v = vitals.first {
            let hours = Int(Date.now.timeIntervalSince(v.recordedAt) / 3600)
            let when = hours < 1 ? "within the last hour" : "\(hours)h ago"
            if v.news2Score >= 7 || v.news2HasRedFlag {
                flags.append(.init(level: .high, title: "NEWS2 \(v.news2Score)\(v.news2HasRedFlag ? " (red flag)" : "")",
                                   detail: "Recorded \(when). Urgent clinical review; consider escalation.",
                                   icon: "waveform.path.ecg"))
            } else if v.news2Score >= 5 {
                flags.append(.init(level: .moderate, title: "NEWS2 \(v.news2Score)",
                                   detail: "Recorded \(when). Key threshold — urgent ward-based response.",
                                   icon: "waveform.path.ecg"))
            }
            if (pathway == .wardReview || acutePathway), hours >= 12 {
                flags.append(.init(level: .moderate, title: "Vitals \(hours)h old",
                                   detail: "Repeat observations before deciding.", icon: "clock"))
            }
        } else {
            flags.append(.init(level: acutePathway || pathway == .wardReview ? .moderate : .info,
                               title: "No vitals recorded",
                               detail: "Record observations so NEWS2 and risk scores can be calculated.",
                               icon: "waveform.path.ecg"))
        }

        // Acuity
        switch p.acuity {
        case .emergency:
            flags.append(.init(level: .high, title: "Emergency acuity",
                               detail: "Triaged as emergency.", icon: "exclamationmark.triangle.fill"))
        case .urgent:
            flags.append(.init(level: .moderate, title: "Urgent acuity",
                               detail: "Triaged as urgent.", icon: "exclamationmark.triangle"))
        default: break
        }

        // Age
        if p.dateOfBirth == nil {
            flags.append(.init(level: .info, title: "No date of birth",
                               detail: "Age-based risk and screening need a DOB.", icon: "calendar.badge.exclamationmark"))
        } else if p.ageYears >= 75 {
            flags.append(.init(level: .moderate, title: "Age \(p.ageYears)",
                               detail: "Frailty, falls and delirium risk; lower threshold for admission.",
                               icon: "figure.walk"))
        } else if p.ageYears >= 65 {
            flags.append(.init(level: .info, title: "Age \(p.ageYears)",
                               detail: "Consider frailty and polypharmacy.", icon: "figure.walk"))
        }

        // Allergies
        let allergies = p.allergies
        if let severe = allergies.first(where: { $0.severity.lowercased() == "severe" }) {
            flags.append(.init(level: .high, title: "Severe allergy: \(severe.name)",
                               detail: severe.reaction.isEmpty ? "Check before prescribing or procedures." : severe.reaction,
                               icon: "allergens"))
        } else if !allergies.isEmpty {
            flags.append(.init(level: .moderate, title: "Allergies: \(allergies.map(\.name).joined(separator: ", "))",
                               detail: "Check before prescribing.", icon: "allergens"))
        }

        // Anticoagulants / antiplatelets
        let meds = p.prescriptions.map { $0.drug.lowercased() }
        let onAnticoag = anticoagulants.filter { a in meds.contains { $0.contains(a) } }
        if !onAnticoag.isEmpty {
            flags.append(.init(level: acutePathway ? .high : .moderate,
                               title: "Anticoagulant / antiplatelet: \(onAnticoag.joined(separator: ", "))",
                               detail: acutePathway
                                   ? "Bleeding risk — check last dose, INR/renal function and hold/bridge plan."
                                   : "Bleeding risk for any procedure.",
                               icon: "drop.triangle"))
        }

        // Diabetes
        let pmhText = (p.pmhEntries.map(\.condition) + [p.pmhNotes ?? ""]).joined(separator: " ").lowercased()
        let onDiabetesMeds = meds.contains { m in ["insulin", "metformin", "gliclazide", "glibenclamide",
                                                    "sitagliptin", "empagliflozin", "dapagliflozin"].contains { m.contains($0) } }
        if pmhText.contains("diabet") || onDiabetesMeds {
            flags.append(.init(level: acutePathway ? .moderate : .info, title: "Diabetes",
                               detail: "Check glucose/HbA1c; wound healing and infection risk; peri-procedure medication plan.",
                               icon: "drop.fill"))
        }

        // BMI
        if let bmi = p.latestBMI() {
            if bmi >= 40 {
                flags.append(.init(level: .high, title: String(format: "BMI %.0f", bmi),
                                   detail: "Class III obesity — airway, VTE and wound risk.", icon: "scalemass"))
            } else if bmi >= 30 {
                flags.append(.init(level: .moderate, title: String(format: "BMI %.0f", bmi),
                                   detail: "Obesity — VTE and wound risk.", icon: "scalemass"))
            }
        }

        // Smoking
        let social = (p.socialHistory ?? "").lowercased()
        if social.contains("smok") && !social.contains("non-smok") && !social.contains("never smok") {
            flags.append(.init(level: .info, title: "Smoker",
                               detail: "Wound, respiratory and vascular risk; offer cessation support.",
                               icon: "smoke"))
        }

        // Pregnancy potential before imaging / procedures
        if acutePathway, p.sex == .female, p.dateOfBirth != nil, (12...55).contains(p.ageYears) {
            flags.append(.init(level: .moderate, title: "Could be pregnant?",
                               detail: "Confirm pregnancy status before imaging, drugs or procedures.",
                               icon: "questionmark.circle"))
        }

        // Surgical timeline
        if let d = p.postOpDays, d <= 30 {
            flags.append(.init(level: d <= 7 ? .moderate : .info, title: "Post-op day \(d)",
                               detail: "Watch for leak, bleeding, SSI, VTE.", icon: "bandage"))
        }

        return flags.sorted { $0.level > $1.level }
    }

    static func overall(_ flags: [RiskFlag]) -> RiskFlag.Level {
        flags.map(\.level).max() ?? .info
    }
}
