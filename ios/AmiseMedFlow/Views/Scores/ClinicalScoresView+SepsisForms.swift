// ClinicalScoresView+SepsisForms.swift
// Sepsis / infection / critical care score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    // AnyView on purpose — see formBodyByCategory.
    func sepsisFormBody(_ score: ActiveScore) -> AnyView {
        switch score {
        case .sirs: return AnyView(sirsForm)
        case .qsofa: return AnyView(qsofaForm)
        case .psiPort: return AnyView(psiPortForm)
        case .sofa: return AnyView(sofaForm)
        case .curb65: return AnyView(curb65Form)
        case .apacheII: return AnyView(apacheIIForm)
        case .kdigo: return AnyView(kdigoForm)
        case .nutric: return AnyView(nutricForm)
        default: return sepsisFormBodyB(score)
        }
    }

    // AnyView on purpose — see formBodyByCategory.
    func sepsisFormBodyB(_ score: ActiveScore) -> AnyView {
        switch score {
        case .decaf: return AnyView(decafForm)
        case .centor: return AnyView(centorForm)
        case .berlinARDS: return AnyView(berlinARDSForm)
        case .fgsi: return AnyView(fgsiForm)
        case .sapsII: return AnyView(sapsIIForm)
        case .mmrc: return AnyView(mmrcForm)
        default: return AnyView(EmptyView())
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
        .onChange(of: psiI) { _, _ in recalculate() }
    }

    // MARK: - PSI/PORT sub-sections

    private var psiPortDemographicsSection: some View {
        Group {
            sectionHeader("Demographics")
            mewsSlider(label: "Age — male (years)", autoKey: "ageMale",
                       value: Binding(get: { Double(psiI.ageMale) }, set: { psiI.ageMale = Int($0) }),
                       in: 0...120, step: 1, display: "\(psiI.ageMale) yr")
            mewsSlider(label: "Age — female (enter age − 10)", autoKey: "ageFemale",
                       value: Binding(get: { Double(psiI.ageFemale) }, set: { psiI.ageFemale = Int($0) }),
                       in: 0...110, step: 1, display: "\(psiI.ageFemale) yr")
            scoreToggle("Nursing home resident", binding: $psiI.nursingHomeResident, points: "+10")
        }
    }

    private var psiPortComorbiditySection: some View {
        Group {
            sectionHeader("Comorbidities")
            scoreToggle("Neoplastic disease",       binding: $psiI.neoplasticDisease,     points: "+30", autoKey: "neoplasticDisease")
            scoreToggle("Liver disease",            binding: $psiI.liverDisease,           points: "+20", autoKey: "liverDisease")
            scoreToggle("Congestive heart failure", binding: $psiI.congestiveHeartFailure, points: "+10", autoKey: "congestiveHeartFailure")
            scoreToggle("Cerebrovascular disease",  binding: $psiI.cerebrovascularDisease, points: "+10", autoKey: "cerebrovascularDisease")
            scoreToggle("Renal disease",            binding: $psiI.renalDisease,           points: "+10", autoKey: "renalDisease")
        }
    }

    private var psiPortExamSection: some View {
        Group {
            sectionHeader("Physical Examination")
            scoreToggle("Altered mental status",          binding: $psiI.alteredMentalStatus,    points: "+20", autoKey: "alteredMentalStatus")
            scoreToggle("Respiratory rate > 30 / min",    binding: $psiI.respiratoryRateOver30,  points: "+20", autoKey: "respiratoryRateOver30")
            scoreToggle("Systolic BP < 90 mmHg",          binding: $psiI.systolicBPUnder90,      points: "+20", autoKey: "systolicBPUnder90")
            scoreToggle("Temperature < 35°C or ≥ 40°C",  binding: $psiI.tempUnder35orOver40,    points: "+15", autoKey: "tempUnder35orOver40")
            scoreToggle("Heart rate > 125 bpm",           binding: $psiI.heartRateOver125,       points: "+10", autoKey: "heartRateOver125")
        }
    }

    private var psiPortLabSection: some View {
        Group {
            sectionHeader("Laboratory & Imaging")
            scoreToggle("Arterial pH < 7.35",              binding: $psiI.arterialPHUnder735,       points: "+30", autoKey: "arterialPHUnder735")
            scoreToggle("BUN ≥ 11 mmol/L",                binding: $psiI.bunOver11mmoL,            points: "+20", autoKey: "bunOver11mmoL")
            scoreToggle("Sodium < 130 mmol/L",             binding: $psiI.sodiumUnder130,           points: "+20", autoKey: "sodiumUnder130")
            scoreToggle("Glucose > 14 mmol/L",             binding: $psiI.glucoseOver14,            points: "+10", autoKey: "glucoseOver14")
            scoreToggle("Haematocrit < 30%",               binding: $psiI.haematocritUnder30,       points: "+10", autoKey: "haematocritUnder30")
            scoreToggle("PaO₂ < 60 mmHg or SpO₂ < 90%",  binding: $psiI.pao2Under60orSpO2Under90, points: "+10", autoKey: "pao2Under60orSpO2Under90")
            scoreToggle("Pleural effusion on X-ray",       binding: $psiI.pleuralEffusion,          points: "+10", autoKey: "pleuralEffusion")
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
