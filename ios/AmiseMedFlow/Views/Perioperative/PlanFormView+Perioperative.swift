// PlanFormView+Perioperative.swift
// Deterministic perioperative safety flags derived from prescriptions and PMH notes.

import SwiftUI
import SwiftData
import EventKit

extension PlanForm {

    // MARK: - Perioperative flags (deterministic, derived from prescriptions + PMH notes)

    struct PeriopFlag: Identifiable {
        let id = UUID()
        enum Band { case moderate, high, critical }
        let band: Band
        let title: String
        let detail: String
        let action: String
    }

    var perioperativeFlags: [PeriopFlag] {
        var flags: [PeriopFlag] = []

        // Steroid stress-dose
        if patient.hasSteroidTherapy {
            let drugs = patient.activeSteroids.map { $0.drug }.joined(separator: ", ")
            flags.append(PeriopFlag(
                band: .high,
                title: "Steroid stress-dose required",
                detail: "Patient on \(drugs). Risk of adrenal insufficiency perioperatively.",
                action: "Hydrocortisone 50–100 mg IV at induction; double maintenance dose post-op × 48 h."
            ))
        }

        // Anticoagulation bridging — enhanced (already noted in anaesthesia section too)
        if patient.hasAnticoagulation {
            let drugs = patient.activeAnticoagulants.map { $0.drug }.joined(separator: ", ")
            flags.append(PeriopFlag(
                band: .high,
                title: "Anticoagulation — bridging protocol",
                detail: "On \(drugs). Perioperative management required.",
                action: "Stop per drug protocol. Consider LMWH bridging if high thrombotic risk. Document post-op restart plan."
            ))
        }

        // OSA / CPAP continuation
        if patient.hasOSAinHistory {
            let bmi = patient.latestBMI() ?? 0
            let band: PeriopFlag.Band = bmi >= 35 ? .high : .moderate
            flags.append(PeriopFlag(
                band: band,
                title: "OSA — CPAP continuation required",
                detail: bmi >= 35 ? "OSA with BMI ≥35 — significantly elevated airway and aspiration risk." : "Obstructive sleep apnoea noted in history.",
                action: "Instruct patient to bring CPAP machine. Apply in recovery. Inform anaesthetist pre-op. Avoid sedative pre-medication."
            ))
        }

        // Obesity — aspiration / airway risk
        if let bmi = patient.latestBMI(), bmi >= 35, !patient.hasOSAinHistory {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Obesity — aspiration & airway risk",
                detail: String(format: "BMI %.0f kg/m².", bmi),
                action: "RSI induction indicated. Ramped position. Inform anaesthetist."
            ))
        }

        // Diabetes — perioperative glucose management
        if patient.hasDiabetesInHistory {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Diabetes — glucose monitoring required",
                detail: "Diabetes mellitus noted. Risk of hypo/hyperglycaemia perioperatively.",
                action: "VRIII sliding scale if glucose >12 mmol/L or >2 h NPO. Monitor 1–2 hourly."
            ))
        }

        // PSHx → adhesion / anatomy flags (keyword scan of persisted surgicalHistory)
        let pshx = (patient.surgicalHistory ?? "").lowercased()
        let adhesionKeywords = ["laparotomy", "bowel resection", "anterior resection", "hartmann",
                                "apr", "whipple", "liver resection", "pancreatectomy"]
        if adhesionKeywords.contains(where: { pshx.contains($0) }) {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Previous abdominal surgery — adhesions likely",
                detail: "Prior major abdominal procedure documented in surgical history.",
                action: "Counsel patient on adhesion risk. Consider laparoscopic-first approach with low threshold for conversion. Ensure bowel prep discussed if indicated."
            ))
        }

        // Gastric bypass / sleeve — anatomy altered
        if pshx.contains("gastric bypass") || pshx.contains("sleeve") || pshx.contains("bariatric") {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Altered upper GI anatomy — bariatric surgery",
                detail: "Gastric bypass or sleeve gastrectomy in surgical history.",
                action: "Standard NG/OG placement may not be suitable. ERCP approach altered. Inform anaesthetist and scrub team."
            ))
        }

        // Splenectomy — asplenic immunocompromise
        if pshx.contains("splenectomy") {
            flags.append(PeriopFlag(
                band: .moderate,
                title: "Asplenic patient — infection risk",
                detail: "Splenectomy documented. Increased risk of overwhelming post-splenectomy infection (OPSI).",
                action: "Confirm vaccinations (pneumococcal, Hib, meningococcal). Antibiotic prophylaxis per local protocol if not already on it."
            ))
        }

        // Lab-based perioperative flags from investigation results
        var riskInputs = SurgicalRiskInputs(
            pmh: [],
            medicationNames: patient.prescriptions.map { $0.drug },
            ageYears: patient.ageYears,
            bmiKgM2: patient.latestBMI(),
            socialChips: []
        )
        riskInputs.labs = LabPanel.parse(from: patient.investigations)
        let labAlerts = SurgicalRiskEngine.assess(riskInputs).filter {
            $0.domain == .periop || $0.domain == .nutrition || $0.domain == .anticoag || $0.domain == .healing
        }
        for alert in labAlerts {
            let band: PeriopFlag.Band = switch alert.band {
            case .critical: .critical
            case .high:     .high
            default:        .moderate
            }
            if !flags.contains(where: { $0.title == alert.title }) {
                flags.append(PeriopFlag(band: band, title: alert.title, detail: alert.detail, action: alert.action))
            }
        }

        return flags
    }

    @ViewBuilder
    var perioperativeFlagsSection: some View {
        Section {
            ForEach(perioperativeFlags) { flag in
                perioperativeFlagRow(flag)
            }
        } header: {
            Label("Perioperative Alerts", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
        } footer: {
            Text("Deterministic flags from prescriptions, PMH, and surgical history. Verify and document actions before proceeding.")
                .font(.caption2).foregroundStyle(.tertiary)
        }
    }

    @ViewBuilder
    func perioperativeFlagRow(_ flag: PeriopFlag) -> some View {
        let bandColor: Color = {
            switch flag.band {
            case .moderate: return .orange
            case .high:     return Color(red: 0.85, green: 0.2, blue: 0.1)
            case .critical: return .red
            }
        }()
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(bandColor)
                Text(flag.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(bandColor)
            }
            Text(flag.detail)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 4) {
                Image(systemName: "arrow.right.circle.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(.teal)
                    .padding(.top, 1)
                Text(flag.action)
                    .font(.caption)
                    .foregroundStyle(.teal)
            }
        }
        .padding(.vertical, 4)
    }

}
