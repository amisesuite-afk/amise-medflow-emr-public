// ClinicalScoresView+AcuteForms.swift
// Acute / trauma / GI emergency score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    func acuteFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .alvarado:     alvaradoForm
        case .tokyoChole:   tokyoCholecystitisForm
        case .tokyoCholang: tokyoCholangitisForm
        case .ranson:       ransonForm
        case .glasgow:      glasgowForm
        case .bisap:        bisapForm
        case .mpi:          mpiForm
        case .ctsi:         ctsiForm
        case .rts:          rtsForm
        default:            acuteFormBodyB(score)
        }
    }

    func acuteFormBodyB(_ score: ActiveScore) -> some View {
        switch score {
        case .baux:         bauxForm
        case .iss:          issForm
        case .hinchey:      hincheyForm
        case .airScore:     airScoreForm
        case .parkland:     parklandForm
        case .pas:          pasForm
        case .stone:        stoneForm
        case .pts:          ptsForm
        case .ripasa:       ripasaForm
        default:            EmptyView()
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
            scoreToggle("WBC >18,000/μL", binding: $tkyC.wbcAbove18, points: "Grade I", autoKey: "wbcAbove18")
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


    // MARK: - Baux Score (#60)

    private var bauxForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(bauxI.age) }, set: { bauxI.age = Int($0) }),
                       range: 0...120, step: 1, unit: "yrs")
            mewsSlider("Total Body Surface Area Burned", value: Binding(get: { Double(bauxI.tbsa) }, set: { bauxI.tbsa = Int($0) }),
                       range: 0...100, step: 1, unit: "%")
            scoreToggle("Inhalation injury confirmed", binding: $bauxI.hasInhalationInjury, points: "+17")
        }
        .onChange(of: bauxI) { _, _ in recalculate() }
    }


    // MARK: - ISS (#61)

    private var issForm: some View {
        Group {
            apacheSegment("Head/Neck (incl. C-spine) — AIS", selection: $issI.head,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("Face — AIS", selection: $issI.face,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("Chest (incl. T-spine) — AIS", selection: $issI.chest,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("Abdomen/Pelvis (incl. L-spine) — AIS", selection: $issI.abdomen,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("Extremity/Pelvis — AIS", selection: $issI.extremity,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("External (burns, lacerations) — AIS", selection: $issI.external,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
        }
        .onChange(of: issI) { _, _ in recalculate() }
    }


    // MARK: - Hinchey (#69)

    private var hincheyForm: some View {
        Group {
            apacheSegment("Hinchey Grade", selection: $hincheyI.grade,
                options: [
                    (1, "Grade Ia/Ib — pericolic or mesorectal abscess"),
                    (2, "Grade II — pelvic or distant abscess"),
                    (3, "Grade III — generalised purulent peritonitis"),
                    (4, "Grade IV — generalised faecal peritonitis")
                ])
        }
        .onChange(of: hincheyI) { _, _ in recalculate() }
    }


    // MARK: - AIR Score (#70)

    private var airScoreForm: some View {
        Group {
            scoreToggle("Vomiting", binding: $airI.vomiting, points: "+1", autoKey: "vomiting")
            scoreToggle("Pain in right iliac fossa", binding: $airI.painRIF, points: "+1", autoKey: "painRIF")
            apacheSegment("Rebound tenderness / guarding", selection: $airI.reboundTenderness,
                options: [
                    (0, "Absent"),
                    (1, "Mild — pain on release of pressure"),
                    (2, "Moderate — involuntary guarding"),
                    (3, "Strong — board-like rigidity / peritonism")
                ])
            scoreToggle("Temperature ≥ 38.5°C", binding: $airI.tempAbove38point5, points: "+1", autoKey: "tempAbove38point5")
            apacheSegment("PMN (polymorphonuclear leucocytes)", selection: $airI.pmn,
                options: [
                    (0, "< 70%"),
                    (1, "70–84%  (+1)"),
                    (2, "≥ 85%   (+2)")
                ])
            apacheSegment("WBC (white blood cell count)", selection: $airI.wbc,
                options: [
                    (0, "< 10 × 10⁹/L"),
                    (1, "10–14.9 × 10⁹/L  (+1)"),
                    (2, "≥ 15 × 10⁹/L     (+2)")
                ])
            apacheSegment("CRP (C-reactive protein)", selection: $airI.crp,
                options: [
                    (0, "< 10 mg/L"),
                    (1, "10–49 mg/L  (+1)"),
                    (2, "≥ 50 mg/L   (+2)")
                ])
        }
        .onChange(of: airI) { _, _ in recalculate() }
    }


    // MARK: - Parkland Formula (#73)

    private var parklandForm: some View {
        Group {
            mewsSlider("Body weight (kg)", value: $parklandI.weightKg,
                       range: 1...250, step: 1, unit: "kg")
            mewsSlider("Total body surface area burned (%TBSA)", value: $parklandI.tbsaPercent,
                       range: 0...100, step: 1, unit: "%")
            scoreToggle("Inhalation injury (adds 10% to TBSA)", binding: $parklandI.hasInhalationInjury, points: "+10% TBSA")
        }
        .onChange(of: parklandI) { _, _ in recalculate() }
    }


    // MARK: - Paediatric Appendicitis Score (#74)

    private var pasForm: some View {
        Group {
            scoreToggle("Anorexia", binding: $pasI.anorexia, points: "+1", autoKey: "anorexia")
            scoreToggle("Nausea or vomiting", binding: $pasI.nausea, points: "+1", autoKey: "nausea")
            scoreToggle("Migration of pain to right iliac fossa", binding: $pasI.migration, points: "+1", autoKey: "migration")
            scoreToggle("Tenderness in right iliac fossa", binding: $pasI.tendernessRIF, points: "+2", autoKey: "tendernessRIF")
            scoreToggle("Pain with cough, percussion, or hopping", binding: $pasI.coughPercussionHop, points: "+2", autoKey: "coughPercussionHop")
            scoreToggle("Pyrexia (temperature ≥ 38°C)", binding: $pasI.pyrexia, points: "+1", autoKey: "pyrexia")
            scoreToggle("Leukocytosis (WBC ≥ 10 × 10⁹/L)", binding: $pasI.leukocytosis, points: "+2", autoKey: "leukocytosis")
            scoreToggle("Polymorphonuclear leucocyte shift > 75%", binding: $pasI.polymorphonuclearShift, points: "+1", autoKey: "polymorphonuclearShift")
        }
        .onChange(of: pasI) { _, _ in recalculate() }
    }


    // MARK: - STONE Score
    private var stoneForm: some View {
        Group {
            Text("Based on unenhanced CT findings. Score ≥4 = high probability of ureteric colic.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            VStack(alignment: .leading, spacing: 4) {
                Text("Stone size on CT")
                Picker("Stone size", selection: $stoneI.sizeMm) {
                    Text("Not seen / > 10 mm (0 pts)").tag(0)
                    Text("1–5 mm (2 pts)").tag(3)
                    Text("6–10 mm (1 pt)").tag(7)
                }
                .pickerStyle(.menu)
            }
            Toggle("Tightness at ureter/UVJ (hydronephrosis expected)", isOn: Binding(
                get: { stoneI.toUreters > 0 },
                set: { stoneI.toUreters = $0 ? 1 : 0 }
            ))
            scoreToggle("Obstruction (hydronephrosis or ureteric dilation)", binding: $stoneI.obstruction, points: "+1")
            scoreToggle("Nausea / vomiting", binding: $stoneI.nausea, points: "+1")
            scoreToggle("Erythrocytes in urine (haematuria)", binding: $stoneI.erythrocytes, points: "+1")
        }
        .onChange(of: stoneI) { _, _ in recalculate() }
    }


    // MARK: - Paediatric Trauma Score

    private var ptsForm: some View {
        Group {
            Text("PTS: 6 parameters scored +2/+1/−1. Range −6 to +12. Score ≤8 = major trauma — triage to paediatric trauma centre.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            VStack(alignment: .leading, spacing: 4) {
                Text("Weight")
                Picker("Weight", selection: $ptsI.weight) {
                    Text(">20 kg (+2)").tag(0)
                    Text("10–20 kg (+1)").tag(1)
                    Text("<10 kg (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.weight) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Airway")
                Picker("Airway", selection: $ptsI.airway) {
                    Text("Normal (+2)").tag(0)
                    Text("Maintainable (+1)").tag(1)
                    Text("Unmaintainable (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.airway) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Systolic BP")
                Picker("BP", selection: $ptsI.systolicBP) {
                    Text(">90 mmHg (+2)").tag(0)
                    Text("50–90 mmHg (+1)").tag(1)
                    Text("<50 mmHg (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.systolicBP) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("CNS")
                Picker("CNS", selection: $ptsI.cns) {
                    Text("Awake (+2)").tag(0)
                    Text("Obtunded/LOC (+1)").tag(1)
                    Text("Comatose (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.cns) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Open wound")
                Picker("Wound", selection: $ptsI.openWound) {
                    Text("None (+2)").tag(0)
                    Text("Minor (+1)").tag(1)
                    Text("Major / penetrating (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.openWound) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Fracture")
                Picker("Fracture", selection: $ptsI.fracture) {
                    Text("None (+2)").tag(0)
                    Text("Closed (+1)").tag(1)
                    Text("Open / multiple (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.fracture) { _, _ in recalculate() }
            }
        }
    }


    // MARK: - RIPASA Score

    private var ripasaForm: some View {
        Group {
            Text("RIPASA: Right Iliac Fossa Pain Assessment Score. Score ≥7.5 = probable appendicitis (sensitivity 98%, specificity 81%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            scoreToggle("Male sex", binding: $ripasaI.male, points: "+1")
            scoreToggle("Age 14–39 years", binding: $ripasaI.age14to39, points: "+1")
            scoreToggle("Foreign national", binding: $ripasaI.foreignNational, points: "+1")
            scoreToggle("Pain migrating to RIF", binding: $ripasaI.migratingToRIF, points: "+0.5")
            scoreToggle("Anorexia", binding: $ripasaI.anorexia, points: "+1")
            scoreToggle("Nausea", binding: $ripasaI.nausea, points: "+1")
            scoreToggle("Vomiting", binding: $ripasaI.vomiting, points: "+1")
            scoreToggle("Duration < 48 hours", binding: $ripasaI.durationUnder48h, points: "+1")
            scoreToggle("RIF tenderness", binding: $ripasaI.rofFossaTenderness, points: "+1")
            scoreToggle("Guarding", binding: $ripasaI.guarding, points: "+2")
            scoreToggle("Rebound tenderness", binding: $ripasaI.reboundTenderness, points: "+1")
            scoreToggle("Rovsing's sign", binding: $ripasaI.rovsing, points: "+2")
            scoreToggle("Fever 37.5–38.5 °C", binding: $ripasaI.fever37_5to38_5, points: "+1")
            scoreToggle("Elevated WBC", binding: $ripasaI.elevatedWBC, points: "+2", autoKey: "wbcElevated")
            scoreToggle("Abnormal urinalysis", binding: $ripasaI.abnormalUrinalysis, points: "+1")
        }
        .onChange(of: ripasaI) { _, _ in recalculate() }
    }

}
