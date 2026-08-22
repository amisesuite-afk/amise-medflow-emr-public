import Foundation
import SwiftUI

// MARK: - Deterministic Drug Interaction Engine

struct DrugInteraction: Identifiable {
    let id = UUID()
    let drug1Pattern: String
    let drug2Pattern: String
    let severity: Severity
    let mechanism: String
    let clinicalEffect: String
    let management: String

    enum Severity: String {
        case contraindicated = "Contraindicated"
        case major           = "Major"
        case moderate        = "Moderate"
        case minor           = "Minor"

        var color: Color {
            switch self {
            case .contraindicated: return .red
            case .major:           return .orange
            case .moderate:        return Color(hex: "#EAB308")
            case .minor:           return .blue
            }
        }

        var icon: String {
            switch self {
            case .contraindicated: return "xmark.octagon.fill"
            case .major:           return "exclamationmark.triangle.fill"
            case .moderate:        return "exclamationmark.circle.fill"
            case .minor:           return "info.circle.fill"
            }
        }
    }
}

struct DrugInteractionAlert: Identifiable {
    let id = UUID()
    let drugA: String
    let drugB: String
    let interaction: DrugInteraction
}

enum DrugInteractionService {

    static func check(drugs: [String]) -> [DrugInteractionAlert] {
        guard drugs.count >= 2 else { return [] }
        var alerts: [DrugInteractionAlert] = []
        let normalised = drugs.map { $0.lowercased() }

        for i in 0..<normalised.count {
            for j in (i+1)..<normalised.count {
                let a = normalised[i]
                let b = normalised[j]
                for rule in rules {
                    let p1 = rule.drug1Pattern.lowercased()
                    let p2 = rule.drug2Pattern.lowercased()
                    if (a.contains(p1) && b.contains(p2)) || (a.contains(p2) && b.contains(p1)) {
                        alerts.append(DrugInteractionAlert(
                            drugA: drugs[i],
                            drugB: drugs[j],
                            interaction: rule
                        ))
                    }
                }
            }
        }
        return alerts.sorted { $0.interaction.severity.rawValue < $1.interaction.severity.rawValue }
    }

    // MARK: - Surgical Practice Interaction Rules

    static let rules: [DrugInteraction] = [
        // --- Anticoagulant interactions ---
        .init(drug1Pattern: "warfarin", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "Synergistic antihaemostatic effect: NSAID inhibits platelet function and may cause GI mucosal injury",
              clinicalEffect: "Significantly increased risk of major bleeding, particularly GI haemorrhage",
              management: "Avoid combination if possible; if necessary, add PPI and monitor INR closely"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "metronidazole",
              severity: .major,
              mechanism: "Metronidazole inhibits CYP2C9 reducing warfarin metabolism",
              clinicalEffect: "INR may rise 2–3-fold within 2–3 days",
              management: "Halve warfarin dose; check INR every 2–3 days; consider alternative antibiotic"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "ciprofloxacin",
              severity: .major,
              mechanism: "Ciprofloxacin inhibits CYP1A2 and reduces gut flora contributing to Vitamin K",
              clinicalEffect: "Unpredictable INR elevation — risk of over-anticoagulation",
              management: "Monitor INR within 2–3 days; consider dose reduction"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "fluconazole",
              severity: .major,
              mechanism: "Fluconazole strongly inhibits CYP2C9 (major warfarin metaboliser)",
              clinicalEffect: "INR may double or more; risk of serious haemorrhage",
              management: "Reduce warfarin dose by 25–50%; monitor INR daily until stable"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "aspirin",
              severity: .major,
              mechanism: "Additive antihaemostatic effect; aspirin inhibits platelet aggregation",
              clinicalEffect: "Greatly increased bleeding risk; GI haemorrhage in particular",
              management: "Use low-dose aspirin only if cardiovascular benefit clearly outweighs risk; add PPI"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "clopidogrel",
              severity: .major,
              mechanism: "Dual antiplatelet + anticoagulant effect",
              clinicalEffect: "Highly increased bleeding risk — triple therapy requires cardiologist input",
              management: "Specialist review required; use for minimum necessary duration"),

        // --- NSAIDs + renal ---
        .init(drug1Pattern: "nsaid", drug2Pattern: "ace inhibitor",
              severity: .moderate,
              mechanism: "NSAIDs blunt prostaglandin-mediated afferent vasodilation; impair renin-angiotensin effect of ACE-I",
              clinicalEffect: "Acute kidney injury risk; reduced antihypertensive efficacy; hyperkalaemia",
              management: "Avoid combination in CKD; monitor renal function and electrolytes"),

        .init(drug1Pattern: "ibuprofen", drug2Pattern: "ace inhibitor",
              severity: .moderate,
              mechanism: "NSAIDs reduce renal prostaglandins; antagonise ACE inhibitor effect",
              clinicalEffect: "AKI risk, loss of BP control",
              management: "Use paracetamol instead; monitor renal function"),

        .init(drug1Pattern: "diclofenac", drug2Pattern: "ace inhibitor",
              severity: .moderate,
              mechanism: "NSAIDs blunt prostaglandin-mediated vasodilation",
              clinicalEffect: "AKI risk, loss of BP control",
              management: "Use paracetamol instead"),

        .init(drug1Pattern: "ketorolac", drug2Pattern: "enoxaparin",
              severity: .major,
              mechanism: "Additive antihaemostatic effect — ketorolac inhibits platelet aggregation and causes GI mucosal damage",
              clinicalEffect: "Significantly increased post-operative haemorrhage risk",
              management: "Avoid concurrent use; if both needed, monitor for bleeding"),

        // --- Serotonin syndrome ---
        .init(drug1Pattern: "tramadol", drug2Pattern: "ssri",
              severity: .major,
              mechanism: "Tramadol is a weak serotonin and noradrenaline reuptake inhibitor; additive effect with SSRIs",
              clinicalEffect: "Serotonin syndrome: agitation, clonus, hyperthermia, tachycardia",
              management: "Prefer alternative opioid (oxycodone, morphine); if combined, monitor closely"),

        .init(drug1Pattern: "tramadol", drug2Pattern: "venlafaxine",
              severity: .major,
              mechanism: "Dual serotonergic mechanism — same as with SSRIs",
              clinicalEffect: "Serotonin syndrome risk",
              management: "Avoid; use morphine or oxycodone instead"),

        .init(drug1Pattern: "tramadol", drug2Pattern: "snri",
              severity: .major,
              mechanism: "Dual serotonergic effect",
              clinicalEffect: "Serotonin syndrome risk",
              management: "Avoid combination; choose a different opioid analgesic"),

        // --- Respiratory depression ---
        .init(drug1Pattern: "opioid", drug2Pattern: "benzodiazepine",
              severity: .major,
              mechanism: "Synergistic CNS and respiratory depression",
              clinicalEffect: "Risk of fatal respiratory depression; death reported with concurrent use",
              management: "Avoid concurrent use; if unavoidable, use lowest possible doses and monitor for respiratory depression"),

        .init(drug1Pattern: "morphine", drug2Pattern: "midazolam",
              severity: .major,
              mechanism: "Synergistic CNS depression",
              clinicalEffect: "Respiratory depression, apnoea",
              management: "Use lowest effective dose; ensure resuscitation facilities available"),

        .init(drug1Pattern: "fentanyl", drug2Pattern: "midazolam",
              severity: .major,
              mechanism: "Synergistic CNS depression",
              clinicalEffect: "Respiratory depression, apnoea",
              management: "Standard anaesthetic precautions; monitoring required"),

        // --- Metformin + contrast ---
        .init(drug1Pattern: "metformin", drug2Pattern: "contrast",
              severity: .major,
              mechanism: "Iodinated contrast may cause acute kidney injury, reducing metformin excretion leading to accumulation",
              clinicalEffect: "Risk of lactic acidosis (rare but potentially fatal)",
              management: "Hold metformin 48h before and after IV contrast; resume once renal function confirmed stable"),

        // --- Aminoglycosides ---
        .init(drug1Pattern: "gentamicin", drug2Pattern: "furosemide",
              severity: .major,
              mechanism: "Both ototoxic; furosemide may increase gentamicin levels",
              clinicalEffect: "Irreversible sensorineural hearing loss; nephrotoxicity",
              management: "Monitor gentamicin levels; use lowest effective dose; avoid if alternatives available"),

        .init(drug1Pattern: "gentamicin", drug2Pattern: "vancomycin",
              severity: .major,
              mechanism: "Synergistic nephrotoxicity",
              clinicalEffect: "Acute kidney injury — additive renal tubular toxicity",
              management: "Monitor renal function and drug levels closely; ensure adequate hydration"),

        .init(drug1Pattern: "gentamicin", drug2Pattern: "nsaid",
              severity: .moderate,
              mechanism: "NSAIDs reduce renal perfusion; increase gentamicin exposure",
              clinicalEffect: "Increased nephrotoxicity and ototoxicity",
              management: "Avoid if possible; monitor renal function and gentamicin levels"),

        // --- Methotrexate ---
        .init(drug1Pattern: "methotrexate", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "NSAIDs reduce renal clearance of methotrexate via prostaglandin-mediated mechanisms",
              clinicalEffect: "Methotrexate toxicity: bone marrow suppression, mucositis, renal failure",
              management: "Avoid concurrent use; if unavoidable, reduce methotrexate dose and monitor FBC/LFTs"),

        .init(drug1Pattern: "methotrexate", drug2Pattern: "ciprofloxacin",
              severity: .major,
              mechanism: "Ciprofloxacin competes with methotrexate for renal tubular secretion",
              clinicalEffect: "Methotrexate toxicity",
              management: "Avoid; use alternative antibiotic"),

        .init(drug1Pattern: "methotrexate", drug2Pattern: "co-amoxiclav",
              severity: .moderate,
              mechanism: "Amoxicillin reduces renal tubular methotrexate excretion",
              clinicalEffect: "Risk of methotrexate accumulation and toxicity",
              management: "Use alternative antibiotic where possible; monitor FBC"),

        // --- Clopidogrel + PPI ---
        .init(drug1Pattern: "clopidogrel", drug2Pattern: "omeprazole",
              severity: .moderate,
              mechanism: "Omeprazole inhibits CYP2C19, the enzyme that converts clopidogrel to its active metabolite",
              clinicalEffect: "Reduced antiplatelet efficacy — increased risk of cardiovascular events",
              management: "Use pantoprazole instead (least CYP2C19 interaction); consult cardiology before stopping clopidogrel"),

        .init(drug1Pattern: "clopidogrel", drug2Pattern: "lansoprazole",
              severity: .moderate,
              mechanism: "CYP2C19 inhibition reduces clopidogrel activation",
              clinicalEffect: "Reduced antiplatelet effect",
              management: "Prefer pantoprazole; cardiologist input for dual antiplatelet patients"),

        // --- Ondansetron QT ---
        .init(drug1Pattern: "ondansetron", drug2Pattern: "ciprofloxacin",
              severity: .moderate,
              mechanism: "Both prolong the QT interval via hERG channel blockade",
              clinicalEffect: "Risk of torsades de pointes and ventricular arrhythmia",
              management: "Avoid if QTc > 500 ms; ECG monitoring if combined; consider alternative antiemetic"),

        .init(drug1Pattern: "ondansetron", drug2Pattern: "fluconazole",
              severity: .moderate,
              mechanism: "Additive QT prolongation + fluconazole inhibits ondansetron metabolism",
              clinicalEffect: "Risk of QT prolongation and arrhythmia",
              management: "ECG monitoring; avoid high-dose ondansetron; consider cyclizine instead"),
    ]
}
