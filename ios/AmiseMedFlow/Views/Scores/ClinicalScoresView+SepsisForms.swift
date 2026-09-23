// ClinicalScoresView+SepsisForms.swift
// Sepsis / infection / critical care score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    @ViewBuilder func sepsisFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .sirs:       sirsForm
        case .qsofa:      qsofaForm
        case .psiPort:    psiPortForm
        case .sofa:       sofaForm
        case .curb65:     curb65Form
        case .apacheII:   apacheIIForm
        case .kdigo:      kdigoForm
        case .nutric:     nutricForm
        default:          sepsisFormBodyB(score)
        }
    }

    @ViewBuilder func sepsisFormBodyB(_ score: ActiveScore) -> some View {
        switch score {
        case .decaf:      decafForm
        case .centor:     centorForm
        case .berlinARDS: berlinARDSForm
        case .fgsi:       fgsiForm
        case .sapsII:     sapsIIForm
        case .mmrc:       mmrcForm
        default:          EmptyView()
        }
    }


    // MARK: - SIRS

    private var sirsForm: some View {
        Group {
            scoreToggle("Temperature >38°C or <36°C", binding: $sirsI.tempAbove38OrBelow36, points: "+1", autoKey: "tempAbove38OrBelow36")
            scoreToggle("Heart rate >90 bpm", binding: $sirsI.heartRateOver90, points: "+1", autoKey: "heartRateOver90")
            scoreToggle("RR >20 or PaCO₂ <32 mmHg", binding: $sirsI.rrOver20OrPaCO2Below32, points: "+1", autoKey: "rrOver20OrPaCO2Below32")
            scoreToggle("WBC >12k, <4k, or >10% bands", binding: $sirsI.wbcOver12kOrBelow4kOr10PctBands, points: "+1", autoKey: "wbcOver12kOrBelow4kOr10PctBands")
            scoreToggle("Suspected infection source", binding: $sirsI.suspectedInfection, points: "Req.")
            scoreToggle("Positive blood culture", binding: $sirsI.positiveBloodCulture, points: "Bacteraemia")
        }
        .onChange(of: sirsI) { _, _ in recalculate() }
    }


    // MARK: - qSOFA

    private var qsofaForm: some View {
        Group {
            Text("Quick SOFA — bedside assessment. Values pre-filled from latest vitals where available.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            scoreToggle("Suspected infection source", binding: $qsofaI.suspectedInfection, points: "Req.")
            scoreToggle("Altered mentation (GCS <15)", binding: $qsofaI.alteredMentation, points: "+1", autoKey: "alteredMentation")
            scoreToggle("Respiratory rate >22/min", binding: $qsofaI.rrOver22, points: "+1", autoKey: "rrOver22")
            scoreToggle("Systolic BP <100 mmHg", binding: $qsofaI.sbpUnder100, points: "+1", autoKey: "sbpUnder100")
        }
        .onChange(of: qsofaI) { _, _ in recalculate() }
    }


    // MARK: - PSI/PORT

    private var psiPortForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            psiPortDemographicsSection
            psiPortComorbiditySection
            psiPortExamSection
            psiPortLabSection
        }
    }


    // MARK: - SOFA

    private var sofaForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            sofaDomainSection(
                "Respiratory — PaO₂/FiO₂ (mmHg)",
                selection: $sofaI.respiration,
                labels: ["≥400 mmHg", "300–399", "200–299 (+resp support)", "100–199 (+resp support)", "<100 (+resp support)"]
            )
            sofaDomainSection(
                "Coagulation — Platelets (×10³/µL)",
                selection: $sofaI.coagulation,
                labels: ["≥150", "100–149", "50–99", "20–49", "<20"]
            )
            sofaDomainSection(
                "Liver — Bilirubin (µmol/L)",
                selection: $sofaI.liver,
                labels: ["<20", "20–32", "33–101", "102–204", ">204"]
            )
            sofaDomainSection(
                "Cardiovascular — MAP/Vasopressors",
                selection: $sofaI.cardiovascular,
                labels: ["MAP ≥70 mmHg", "MAP <70 mmHg", "Dopamine ≤5 or any dobutamine",
                         "Dopamine 5–15 or noradrenaline ≤0.1 µg/kg/min",
                         "Dopamine >15 or noradrenaline >0.1 µg/kg/min"]
            )
            sofaDomainSection(
                "CNS — Glasgow Coma Scale",
                selection: $sofaI.cns,
                labels: ["GCS 15", "GCS 13–14", "GCS 10–12", "GCS 6–9", "GCS <6"]
            )
            sofaDomainSection(
                "Renal — Creatinine (µmol/L) / Urine Output",
                selection: $sofaI.renal,
                labels: ["<110 µmol/L", "110–170", "171–299", "300–440 or UO <0.5 mL/kg/h", ">440 or UO <200 mL/day"]
            )
        }
        .onChange(of: sofaI) { _, _ in recalculate() }
    }


    // MARK: - CURB-65

    private var curb65Form: some View {
        Group {
            Text("Community-Acquired Pneumonia severity. Score ≥3 → consider hospital admission.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            scoreToggle("C — Confusion (new disorientation to person, place, or time)", binding: $curb65I.confusion,             points: "+1", autoKey: "confusion")
            scoreToggle("U — Urea >7 mmol/L (BUN >19 mg/dL)",                          binding: $curb65I.ureaDOver7,            points: "+1", autoKey: "ureaDOver7")
            scoreToggle("R — Respiratory rate ≥30 /min",                                binding: $curb65I.respiratoryRateOver30, points: "+1", autoKey: "respiratoryRateOver30")
            scoreToggle("B — Low BP: SBP <90 or DBP ≤60 mmHg",                         binding: $curb65I.lowBP,                 points: "+1", autoKey: "lowBP")
            scoreToggle("65 — Age ≥65 years",                                           binding: $curb65I.ageOver65,             points: "+1", autoKey: "ageOver65")
        }
        .onChange(of: curb65I) { _, _ in recalculate() }
    }

}
