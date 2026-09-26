// ClinicalScoresView+AcuteForms.swift
// Acute / trauma / GI emergency score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    // AnyView on purpose — see formBodyByCategory.
    func acuteFormBody(_ score: ActiveScore) -> AnyView {
        switch score {
        case .alvarado: return AnyView(alvaradoForm)
        case .tokyoChole: return AnyView(tokyoCholecystitisForm)
        case .tokyoCholang: return AnyView(tokyoCholangitisForm)
        case .ranson: return AnyView(ransonForm)
        case .glasgow: return AnyView(glasgowForm)
        case .bisap: return AnyView(bisapForm)
        case .mpi: return AnyView(mpiForm)
        case .ctsi: return AnyView(ctsiForm)
        case .rts: return AnyView(rtsForm)
        default: return acuteFormBodyB(score)
        }
    }

    // AnyView on purpose — see formBodyByCategory.
    func acuteFormBodyB(_ score: ActiveScore) -> AnyView {
        switch score {
        case .baux: return AnyView(bauxForm)
        case .iss: return AnyView(issForm)
        case .hinchey: return AnyView(hincheyForm)
        case .airScore: return AnyView(airScoreForm)
        case .parkland: return AnyView(parklandForm)
        case .pas: return AnyView(pasForm)
        case .stone: return AnyView(stoneForm)
        case .pts: return AnyView(ptsForm)
        case .ripasa: return AnyView(ripasaForm)
        default: return AnyView(EmptyView())
        }
    }


    // MARK: - Alvarado

    private var alvaradoForm: some View {
        Group {
            scoreToggle("Pain migration to RIF", binding: $alv.migrationToRIF, points: "+1")
            scoreToggle("Anorexia", binding: $alv.anorexia, points: "+1")
            scoreToggle("Nausea / vomiting", binding: $alv.nauseaVomiting, points: "+1")
            scoreToggle("Tenderness in RIF", binding: $alv.tendernessRIF, points: "+2")
            scoreToggle("Rebound tenderness", binding: $alv.reboundTenderness, points: "+1")
            scoreToggle("Elevated temperature ≥37.3°C", binding: $alv.elevatedTemperature, points: "+1", autoKey: "elevatedTemperature")
            scoreToggle("WBC >10,000/μL", binding: $alv.wbcElevated, points: "+2", autoKey: "wbcElevated")
            scoreToggle("Neutrophilia >75%", binding: $alv.neutrophiliaShift, points: "+1")
        }
        .onChange(of: alv) { _, _ in recalculate() }
    }


    // MARK: - Tokyo Cholecystitis

    private var tokyoCholecystitisForm: some View {
        Group {
            sectionHeader("Local Inflammation")
            scoreToggle("Local inflammation signs (mild)", binding: $tkyC.localInflammationSignsMild, points: "Grade I")
            scoreToggle("WBC >18,000/μL", binding: $tkyC.wbcAbove18, points: "Grade II", autoKey: "wbcAbove18")
            scoreToggle("Palpable tender RUQ mass", binding: $tkyC.palpableTenderRUQMass, points: "Grade II")
            scoreToggle("Symptoms >72 hours", binding: $tkyC.durationOver72h, points: "Grade II")
            scoreToggle("Marked local inflammation", binding: $tkyC.markedLocalInflammation, points: "Grade II")
            sectionHeader("Organ Dysfunction (Grade III)")
            scoreToggle("Cardiovascular (SBP <90 or vasopressor)", binding: $tkyC.cardiovascularDysfunction, points: "III")
            scoreToggle("Neurological (altered consciousness)", binding: $tkyC.neurologicalDysfunction, points: "III")
            scoreToggle("Respiratory (PaO₂/FiO₂ <300)", binding: $tkyC.respiratoryDysfunction, points: "III")
            scoreToggle("Renal (oliguria, Cr >2 mg/dL)", binding: $tkyC.renalDysfunction, points: "III")
            scoreToggle("Hepatic (PT-INR >1.5)", binding: $tkyC.hepaticDysfunction, points: "III")
            scoreToggle("Haematological (platelets <100k)", binding: $tkyC.haematologicalDysfunction, points: "III")
        }
        .onChange(of: tkyC) { _, _ in recalculate() }
    }


    // MARK: - Tokyo Cholangitis

    private var tokyoCholangitisForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            tokyoCholangitisGrade1and2
            tokyoCholangitisGrade3
        }
        .onChange(of: tkyG) { _, _ in recalculate() }
    }

    @ViewBuilder private var tokyoCholangitisGrade1and2: some View {
        Group {
            sectionHeader("Diagnosis (TG18)")
            scoreToggle("Cholangitis confirmed (Charcot's triad or imaging)", binding: $tkyG.cholangitisConfirmed, points: "Dx")
            sectionHeader("Grade II — Moderate (any 2)")
            scoreToggle("WBC >12,000 or <4,000/μL",        binding: $tkyG.wbcAbove12OrBelow4,  points: "II")
            scoreToggle("Fever ≥39°C",                     binding: $tkyG.temperatureAbove39,  points: "II")
            scoreToggle("Age ≥75 years",                   binding: $tkyG.ageAbove75,          points: "II")
            scoreToggle("Total bilirubin ≥5 mg/dL (≥85 µmol/L)", binding: $tkyG.bilirubinAbove5, points: "II")
            scoreToggle("Hypoalbuminaemia (<0.7 × lower limit of normal)", binding: $tkyG.albuminBelow0_7xLLN, points: "II")
        }
    }

    @ViewBuilder private var tokyoCholangitisGrade3: some View {
        Group {
            sectionHeader("Grade III — Severe (any organ dysfunction)")
            scoreToggle("Cardiovascular (dopamine ≥5 µg/kg/min or any noradrenaline)", binding: $tkyG.cardiovascularDysfunction, points: "III")
            scoreToggle("Neurological (disturbed consciousness)", binding: $tkyG.neurologicalDysfunction,  points: "III")
            scoreToggle("Respiratory (PaO₂/FiO₂ <300)",           binding: $tkyG.respiratoryDysfunction,   points: "III")
            scoreToggle("Renal (oliguria, Cr >2 mg/dL)",           binding: $tkyG.renalDysfunction,         points: "III")
            scoreToggle("Hepatic (PT-INR >1.5)",                   binding: $tkyG.hepaticDysfunction,       points: "III")
            scoreToggle("Haematological (platelets <100k)",        binding: $tkyG.haematologicalDysfunction, points: "III")
        }
    }


    // MARK: - Ranson

    private var ransonForm: some View {
        Group {
            sectionHeader("At Admission")
            scoreToggle("Age >55 years", binding: $ran.ageOver55, points: "+1", autoKey: "ageOver55")
            scoreToggle("WBC >16,000/μL", binding: $ran.wbcOver16k, points: "+1", autoKey: "wbcOver16k")
            scoreToggle("Glucose >11 mmol/L (>200 mg/dL)", binding: $ran.glucoseOver200, points: "+1", autoKey: "glucoseOver200")
            scoreToggle("LDH >350 IU/L", binding: $ran.ldhOver350, points: "+1", autoKey: "ldhOver350")
            scoreToggle("AST >250 IU/L", binding: $ran.astOver250, points: "+1", autoKey: "astOver250")
            sectionHeader("At 48 Hours")
            scoreToggle("Haematocrit fall >10%", binding: $ran.hctFallOver10, points: "+1", autoKey: "hctFallOver10")
            scoreToggle("BUN rise >1.8 mmol/L", binding: $ran.bunRiseOver5, points: "+1", autoKey: "bunRiseOver5")
            scoreToggle("Calcium <2 mmol/L", binding: $ran.calciumBelow8, points: "+1", autoKey: "calciumBelow8")
            scoreToggle("PaO₂ <60 mmHg", binding: $ran.pao2Below60, points: "+1", autoKey: "pao2Below60")
        }
        .onChange(of: ran) { _, _ in recalculate() }
    }


    // MARK: - Glasgow Pancreatitis

    private var glasgowForm: some View {
        Group {
            Text("Glasgow (PANCREAS) — all at 48 hours.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            scoreToggle("Age >55 years", binding: $glas.ageOver55, points: "+1", autoKey: "ageOver55")
            scoreToggle("WBC >15,000/μL", binding: $glas.wbcOver15k, points: "+1", autoKey: "wbcOver15k")
            scoreToggle("Glucose >10 mmol/L", binding: $glas.glucoseOver10, points: "+1", autoKey: "glucoseOver10")
            scoreToggle("Urea >16 mmol/L", binding: $glas.ureaOver16, points: "+1", autoKey: "ureaOver16")
            scoreToggle("PaO₂ <60 mmHg", binding: $glas.pao2Below60, points: "+1", autoKey: "pao2Below60")
            scoreToggle("Calcium <2 mmol/L", binding: $glas.calciumBelow2, points: "+1", autoKey: "calciumBelow2")
            scoreToggle("Albumin <32 g/L", binding: $glas.albuminBelow32, points: "+1", autoKey: "albuminBelow32")
            scoreToggle("LDH >600 IU/L or AST >200 IU/L", binding: $glas.ldhOver600OrAstOver200, points: "+1", autoKey: "ldhOver600OrAstOver200")
        }
        .onChange(of: glas) { _, _ in recalculate() }
    }


    // MARK: - BISAP

    private var bisapForm: some View {
        Group {
            scoreToggle("B — BUN >9 mmol/L (>25 mg/dL)",            binding: $bisapI.bunOver9mmolL,          points: "+1", autoKey: "bunOver9mmolL")
            scoreToggle("I — Impaired mental status",                 binding: $bisapI.impairedMentalStatus,   points: "+1", autoKey: "impairedMentalStatus")
            scoreToggle("S — SIRS (≥2 of: temp >38 or <36°C, HR >90, RR >20, WBC abnormal)", binding: $bisapI.sirs, points: "+1", autoKey: "sirs")
            scoreToggle("A — Age >60 years",                          binding: $bisapI.ageOver60,              points: "+1", autoKey: "ageOver60")
            scoreToggle("P — Pleural effusion on imaging",            binding: $bisapI.pleuralEffusion,        points: "+1", autoKey: "pleuralEffusion")
        }
        .onChange(of: bisapI) { _, _ in recalculate() }
    }


    // MARK: - CTSI (Balthazar CT Severity Index)

    private var ctsiForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Balthazar CT Severity Index (Balthazar et al, Radiology 1990). Requires CT abdomen with IV contrast. Score = Balthazar grade (0–4) + necrosis extent (0/2/4/6). Total 0–10.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Balthazar Grade")
                apacheSegment("Pancreatic Appearance on CT", selection: $ctsiI.balthazarGrade,
                    options: [
                        (0, "A — Normal pancreas"),
                        (1, "B — Oedematous pancreas, no peripancreatic inflammation"),
                        (2, "C — Peripancreatic fat stranding"),
                        (3, "D — Single poorly-defined peripancreatic fluid collection"),
                        (4, "E — ≥2 fluid collections or gas in/around pancreas")
                    ])
                sectionHeader("Necrosis Score")
                apacheSegment("Pancreatic Necrosis (IV contrast CT)", selection: $ctsiI.necrosisScore,
                    options: [
                        (0, "None"),
                        (2, "<33% of pancreatic parenchyma"),
                        (4, "33–50% necrosis"),
                        (6, ">50% necrosis")
                    ])
            }
            .onChange(of: ctsiI) { _, _ in recalculate() }
        }
    }


    // MARK: - MPI

    private var mpiForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Mannheim Peritonitis Index (Wacha & Linder 1983). Max score 47. <21 = low risk (<9% mortality), 21–29 = intermediate (~29%), ≥30 = high (>60%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            mpiBodySection
        }
        .onChange(of: mpiI) { _, _ in recalculate() }
    }

    @ViewBuilder private var mpiBodySection: some View {
        Group {
            sectionHeader("Patient Factors")
            scoreToggle("Age >50 years",                                   binding: $mpiI.ageOver50,              points: "+5")
            scoreToggle("Female sex",                                      binding: $mpiI.femaleSex,              points: "+5")
            scoreToggle("Organ failure (SBP <80, Cr >177 µmol/L, resp. failure)", binding: $mpiI.organFailure,    points: "+7")
            scoreToggle("Malignancy",                                      binding: $mpiI.malignancy,             points: "+4")
            sectionHeader("Peritonitis Factors")
            scoreToggle("Pre-operative duration >24 h",                    binding: $mpiI.durationOver24h,        points: "+4")
            scoreToggle("Origin of sepsis not colonic",                    binding: $mpiI.nonColonicOrigin,       points: "+4")
            scoreToggle("Diffuse generalised peritonitis",                 binding: $mpiI.generalizedPeritonitis, points: "+6")
            apacheSegment("Exudate", selection: $mpiI.exudate,
                options: [(0, "Clear / serous"), (6, "Cloudy / purulent"), (12, "Faecal")])
        }
    }


    private var rtsForm: some View {
        Group {
            mewsSlider(label: "Glasgow Coma Scale", autoKey: "glasgowComaScore",
                       value: Binding(get: { Double(rtsI.glasgowComaScore) },
                                      set: { rtsI.glasgowComaScore = Int($0) }),
                       in: 3...15, step: 1, display: "\(rtsI.glasgowComaScore)")
            mewsSlider(label: "Systolic BP (mmHg)", autoKey: "systolicBP",
                       value: Binding(get: { Double(rtsI.systolicBP) },
                                      set: { rtsI.systolicBP = Int($0) }),
                       in: 0...200, step: 1, display: "\(rtsI.systolicBP) mmHg")
            mewsSlider(label: "Respiratory Rate (breaths/min)", autoKey: "respiratoryRate",
                       value: Binding(get: { Double(rtsI.respiratoryRate) },
                                      set: { rtsI.respiratoryRate = Int($0) }),
                       in: 0...40, step: 1, display: "\(rtsI.respiratoryRate) bpm")
        }
        .onChange(of: rtsI) { _, _ in recalculate() }
    }

}
