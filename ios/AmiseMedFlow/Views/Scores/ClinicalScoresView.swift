import SwiftUI

// MARK: - Clinical Scores & Scales Tab
// All calculations are deterministic — no AI, no network. HIPAA-safe.

// MARK: - Score category grouping

enum ScoreCategory: String, CaseIterable, Identifiable {
    var id: String { rawValue }
    case all          = "All"
    case acute        = "Acute Abdomen"
    case gi           = "GI / Endoscopy"
    case vascular     = "VTE / Vascular"
    case sepsis       = "Sepsis"
    case preop        = "Pre-op Risk"
    case neuro        = "Neuro / Stroke"
}

enum ActiveScore: String, CaseIterable, Identifiable {
    var id: String { rawValue }
    case alvarado         = "Alvarado (Appendicitis)"
    case tokyoChole       = "Tokyo — Cholecystitis"
    case tokyoCholang     = "Tokyo — Cholangitis"
    case ranson           = "Ranson (Pancreatitis)"
    case glasgow          = "Glasgow (Pancreatitis)"
    case rockall          = "Rockall (GI Bleed)"
    case sirs             = "SIRS / Sepsis"
    case qsofa            = "qSOFA (Sepsis)"
    case wellsDVT         = "Wells DVT"
    case wellsPE          = "Wells PE"
    case abcd2            = "ABCD² (TIA/Stroke)"
    case lrinec           = "LRINEC (Necrotising Fasciitis)"
    case rcri             = "RCRI (Cardiac Risk)"
    case caprini          = "Caprini (VTE Risk)"
    case childPugh        = "Child-Pugh (Liver)"

    var category: ScoreCategory {
        switch self {
        case .alvarado, .tokyoChole, .tokyoCholang, .ranson, .glasgow:
            return .acute
        case .rockall:
            return .gi
        case .wellsDVT, .wellsPE, .caprini:
            return .vascular
        case .sirs, .qsofa:
            return .sepsis
        case .rcri, .childPugh:
            return .preop
        case .abcd2, .lrinec:
            return .neuro
        }
    }

    var icon: String {
        switch self {
        case .alvarado:    return "bandage"
        case .tokyoChole:  return "drop.fill"
        case .tokyoCholang: return "drop.halffull"
        case .ranson, .glasgow: return "flame"
        case .rockall:     return "scope"
        case .sirs, .qsofa: return "thermometer.medium"
        case .wellsDVT, .wellsPE, .caprini: return "heart.fill"
        case .abcd2:       return "brain.head.profile"
        case .lrinec:      return "cross.case.fill"
        case .rcri:        return "waveform.path.ecg"
        case .childPugh:   return "staroflife"
        }
    }
}

// MARK: - Main view

struct ClinicalScoresView: View {
    @Bindable var patient: Patient

    @State private var selectedCategory: ScoreCategory = .all
    @State private var selectedScore: ActiveScore? = nil
    @State private var result: ClinicalScore? = nil

    // Alvarado
    @State private var alv = AlvaradoInput()
    // Tokyo Cholecystitis
    @State private var tkyC = TokyoCholecystitisInput()
    // Tokyo Cholangitis
    @State private var tkyG = TokyoCholangitisInput()
    // Ranson
    @State private var ran = RansonInput()
    // Glasgow
    @State private var glas = GlasgowPancreatitisInput()
    // Rockall
    @State private var rock = RockallInput()
    // SIRS
    @State private var sirsI = SIRSInput()
    // qSOFA
    @State private var qsofaI = QSOFAInput()
    // Wells DVT
    @State private var wDVT = WellsDVTInput()
    // Wells PE
    @State private var wPE  = WellsPEInput()
    // ABCD2
    @State private var abcd = ABCD2Input()
    // ABCD2 helper for duration (three-way choice)
    @State private var abcdDuration: Int = 0  // 0 = <10min, 1 = 10-59min, 2 = ≥60min
    // LRINEC
    @State private var lrin = LRINECInput()
    // RCRI
    @State private var rcriI = RCRIInput()
    // Caprini
    @State private var cap = CapriniInput()
    // Child-Pugh
    @State private var cp = ChildPughInput()

    var filteredScores: [ActiveScore] {
        guard selectedCategory != .all else { return ActiveScore.allCases }
        return ActiveScore.allCases.filter { $0.category == selectedCategory }
    }

    var body: some View {
        VStack(spacing: 0) {
            categoryBar
            if let score = selectedScore {
                ScrollView {
                    VStack(spacing: 16) {
                        inputForm(for: score)
                        if let r = result {
                            resultCard(r)
                        }
                    }
                    .padding()
                }
            } else {
                scoreGrid
            }
        }
        .onChange(of: selectedScore) { _, _ in recalculate() }
    }

    // MARK: - Category filter bar

    private var categoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ScoreCategory.allCases) { cat in
                    Button {
                        selectedCategory = cat
                        selectedScore = nil
                        result = nil
                    } label: {
                        Text(cat.rawValue)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(selectedCategory == cat
                                ? AMColor.accent
                                : Color.secondary.opacity(0.12),
                                in: Capsule())
                            .foregroundStyle(selectedCategory == cat ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }

    // MARK: - Score selection grid

    private var scoreGrid: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
                ForEach(filteredScores) { score in
                    Button {
                        selectedScore = score
                        result = nil
                    } label: {
                        scoreCard(score)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
    }

    private func scoreCard(_ score: ActiveScore) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: score.icon)
                    .font(.title3)
                    .foregroundStyle(AMColor.accent)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            Text(score.rawValue)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)
            Text(score.category.rawValue)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }

    // MARK: - Result card

    private func resultCard(_ r: ClinicalScore) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(r.systemName)
                        .font(.headline)
                    Text(r.interpretation)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                riskBadge(r.risk, score: r.score, max: r.maxScore)
            }

            if !r.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Red Flags", systemImage: "exclamationmark.octagon.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.red)
                    ForEach(r.redFlags, id: \.self) { flag in
                        Text("• \(flag)")
                            .font(.caption)
                            .foregroundStyle(.red.opacity(0.85))
                    }
                }
                .padding(10)
                .background { Color.red.opacity(0.08) }
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            if !r.recommendations.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Recommendations")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ForEach(Array(r.recommendations.enumerated()), id: \.0) { idx, rec in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(idx + 1).")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AMColor.accent)
                                .frame(width: 18, alignment: .leading)
                            Text(rec)
                                .font(.caption)
                        }
                    }
                }
            }

            // Score breakdown
            VStack(alignment: .leading, spacing: 4) {
                Text("Score Breakdown")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                ForEach(r.items.filter(\.present)) { item in
                    HStack {
                        Text("✓ \(item.label)")
                            .font(.caption)
                        Spacer()
                        Text(item.points == Double(Int(item.points))
                             ? "+\(Int(item.points))"
                             : "+\(String(format: "%.1f", item.points))")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(AMColor.accent)
                    }
                }
            }

            if let note = r.evidenceNote {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.top, 4)
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.07), radius: 6, y: 3)
    }

    private func riskBadge(_ risk: ScoreRisk, score: Double, max: Double) -> some View {
        let color: Color = switch risk {
        case .low:      .green
        case .moderate: .orange
        case .high:     Color(red: 0.9, green: 0.4, blue: 0.1)
        case .critical: .red
        }
        let scoreStr = score == Double(Int(score)) ? "\(Int(score))" : String(format: "%.1f", score)
        let maxStr   = max == Double(Int(max))   ? "\(Int(max))"   : String(format: "%.0f", max)
        return VStack(spacing: 2) {
            Text("\(scoreStr)/\(maxStr)")
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(color)
            Text(risk.rawValue)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Recalculate

    private func recalculate() {
        guard let score = selectedScore else { result = nil; return }
        result = switch score {
        case .alvarado:     ClinicalScoringEngine.alvarado(alv)
        case .tokyoChole:   ClinicalScoringEngine.tokyoCholecystitis(tkyC)
        case .tokyoCholang: ClinicalScoringEngine.tokyoCholangitis(tkyG)
        case .ranson:       ClinicalScoringEngine.ranson(ran)
        case .glasgow:      ClinicalScoringEngine.glasgowPancreatitis(glas)
        case .rockall:      ClinicalScoringEngine.rockall(rock)
        case .sirs:         ClinicalScoringEngine.sirs(sirsI)
        case .qsofa:        ClinicalScoringEngine.qsofa(qsofaI)
        case .wellsDVT:     ClinicalScoringEngine.wellsDVT(wDVT)
        case .wellsPE:      ClinicalScoringEngine.wellsPE(wPE)
        case .abcd2:        ClinicalScoringEngine.abcd2(abcd)
        case .lrinec:       ClinicalScoringEngine.lrinec(lrin)
        case .rcri:         ClinicalScoringEngine.rcri(rcriI)
        case .caprini:      ClinicalScoringEngine.caprini(cap)
        case .childPugh:    ClinicalScoringEngine.childPugh(cp)
        }
    }

    // MARK: - Input forms

    @ViewBuilder
    private func inputForm(for score: ActiveScore) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Back / title header
            HStack {
                Button {
                    selectedScore = nil
                    result = nil
                } label: {
                    Label("All Scores", systemImage: "chevron.left")
                        .font(.subheadline)
                }
                Spacer()
                Text(score.rawValue)
                    .font(.headline)
            }
            .padding(.bottom, 12)

            switch score {
            case .alvarado:     alvaradoForm
            case .tokyoChole:   tokyoCholecystitisForm
            case .tokyoCholang: tokyoCholangitisForm
            case .ranson:       ransonForm
            case .glasgow:      glasgowForm
            case .rockall:      rockallForm
            case .sirs:         sirsForm
            case .qsofa:        qsofaForm
            case .wellsDVT:     wellsDVTForm
            case .wellsPE:      wellsPEForm
            case .abcd2:        abcd2Form
            case .lrinec:       lrinecForm
            case .rcri:         rcriForm
            case .caprini:      capriniForm
            case .childPugh:    childPughForm
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }

    // MARK: - Alvarado

    private var alvaradoForm: some View {
        Group {
            scoreToggle("Pain migration to RIF", binding: $alv.migrationToRIF, points: "+1")
            scoreToggle("Anorexia", binding: $alv.anorexia, points: "+1")
            scoreToggle("Nausea / vomiting", binding: $alv.nauseaVomiting, points: "+1")
            scoreToggle("Tenderness in RIF", binding: $alv.tendernessRIF, points: "+2")
            scoreToggle("Rebound tenderness", binding: $alv.reboundTenderness, points: "+1")
            scoreToggle("Elevated temperature ≥37.3°C", binding: $alv.elevatedTemperature, points: "+1")
            scoreToggle("WBC >10,000/μL", binding: $alv.wbcElevated, points: "+2")
            scoreToggle("Neutrophilia >75%", binding: $alv.neutrophiliaShift, points: "+1")
        }
        .onChange(of: alv.migrationToRIF)     { _, _ in recalculate() }
        .onChange(of: alv.anorexia)           { _, _ in recalculate() }
        .onChange(of: alv.nauseaVomiting)     { _, _ in recalculate() }
        .onChange(of: alv.tendernessRIF)      { _, _ in recalculate() }
        .onChange(of: alv.reboundTenderness)  { _, _ in recalculate() }
        .onChange(of: alv.elevatedTemperature){ _, _ in recalculate() }
        .onChange(of: alv.wbcElevated)        { _, _ in recalculate() }
        .onChange(of: alv.neutrophiliaShift)  { _, _ in recalculate() }
    }

    // MARK: - Tokyo Cholecystitis

    private var tokyoCholecystitisForm: some View {
        Group {
            sectionHeader("Local Inflammation")
            scoreToggle("Local inflammation signs (mild)", binding: $tkyC.localInflammationSignsMild, points: "Grade I")
            scoreToggle("WBC >18,000/μL", binding: $tkyC.wbcAbove18, points: "Grade I")
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
        .onChange(of: tkyC.localInflammationSignsMild)    { _, _ in recalculate() }
        .onChange(of: tkyC.wbcAbove18)                   { _, _ in recalculate() }
        .onChange(of: tkyC.durationOver72h)               { _, _ in recalculate() }
        .onChange(of: tkyC.markedLocalInflammation)       { _, _ in recalculate() }
        .onChange(of: tkyC.cardiovascularDysfunction)     { _, _ in recalculate() }
        .onChange(of: tkyC.neurologicalDysfunction)       { _, _ in recalculate() }
        .onChange(of: tkyC.respiratoryDysfunction)        { _, _ in recalculate() }
        .onChange(of: tkyC.renalDysfunction)              { _, _ in recalculate() }
        .onChange(of: tkyC.hepaticDysfunction)            { _, _ in recalculate() }
        .onChange(of: tkyC.haematologicalDysfunction)     { _, _ in recalculate() }
    }

    // MARK: - Tokyo Cholangitis

    private var tokyoCholangitisForm: some View {
        Group {
            scoreToggle("Cholangitis confirmed (Charcot's / imaging)", binding: $tkyG.cholangitisConfirmed, points: "Req.")
            sectionHeader("Grade II Criteria (any = at least Grade II)")
            scoreToggle("WBC >12k or <4k", binding: $tkyG.wbcAbove12OrBelow4, points: "II")
            scoreToggle("Temperature >39°C", binding: $tkyG.temperatureAbove39, points: "II")
            scoreToggle("Age >75 years", binding: $tkyG.ageAbove75, points: "II")
            scoreToggle("Bilirubin >85 μmol/L (>5 mg/dL)", binding: $tkyG.bilirubinAbove5, points: "II")
            scoreToggle("Albumin <0.7 × LLN", binding: $tkyG.albuminBelow0_7xLLN, points: "II")
            sectionHeader("Grade III Organ Dysfunction")
            scoreToggle("Cardiovascular dysfunction", binding: $tkyG.cardiovascularDysfunction, points: "III")
            scoreToggle("Neurological dysfunction", binding: $tkyG.neurologicalDysfunction, points: "III")
            scoreToggle("Respiratory dysfunction", binding: $tkyG.respiratoryDysfunction, points: "III")
            scoreToggle("Renal dysfunction", binding: $tkyG.renalDysfunction, points: "III")
            scoreToggle("Hepatic dysfunction", binding: $tkyG.hepaticDysfunction, points: "III")
            scoreToggle("Haematological dysfunction", binding: $tkyG.haematologicalDysfunction, points: "III")
        }
        .onChange(of: tkyG.cholangitisConfirmed)      { _, _ in recalculate() }
        .onChange(of: tkyG.wbcAbove12OrBelow4)        { _, _ in recalculate() }
        .onChange(of: tkyG.temperatureAbove39)        { _, _ in recalculate() }
        .onChange(of: tkyG.ageAbove75)                { _, _ in recalculate() }
        .onChange(of: tkyG.bilirubinAbove5)           { _, _ in recalculate() }
        .onChange(of: tkyG.albuminBelow0_7xLLN)       { _, _ in recalculate() }
        .onChange(of: tkyG.cardiovascularDysfunction) { _, _ in recalculate() }
        .onChange(of: tkyG.neurologicalDysfunction)   { _, _ in recalculate() }
        .onChange(of: tkyG.respiratoryDysfunction)    { _, _ in recalculate() }
        .onChange(of: tkyG.renalDysfunction)          { _, _ in recalculate() }
        .onChange(of: tkyG.hepaticDysfunction)        { _, _ in recalculate() }
        .onChange(of: tkyG.haematologicalDysfunction) { _, _ in recalculate() }
    }

    // MARK: - Ranson

    private var ransonForm: some View {
        Group {
            sectionHeader("At Admission")
            scoreToggle("Age >55 years", binding: $ran.ageOver55, points: "+1")
            scoreToggle("WBC >16,000/μL", binding: $ran.wbcOver16k, points: "+1")
            scoreToggle("Glucose >11 mmol/L (>200 mg/dL)", binding: $ran.glucoseOver200, points: "+1")
            scoreToggle("LDH >350 IU/L", binding: $ran.ldhOver350, points: "+1")
            scoreToggle("AST >250 IU/L", binding: $ran.astOver250, points: "+1")
            sectionHeader("At 48 Hours")
            scoreToggle("Haematocrit fall >10%", binding: $ran.hctFallOver10, points: "+1")
            scoreToggle("BUN rise >1.8 mmol/L", binding: $ran.bunRiseOver5, points: "+1")
            scoreToggle("Calcium <2 mmol/L", binding: $ran.calciumBelow8, points: "+1")
            scoreToggle("PaO₂ <60 mmHg", binding: $ran.pao2Below60, points: "+1")
        }
        .onChange(of: ran.ageOver55)     { _, _ in recalculate() }
        .onChange(of: ran.wbcOver16k)    { _, _ in recalculate() }
        .onChange(of: ran.glucoseOver200){ _, _ in recalculate() }
        .onChange(of: ran.ldhOver350)    { _, _ in recalculate() }
        .onChange(of: ran.astOver250)    { _, _ in recalculate() }
        .onChange(of: ran.hctFallOver10) { _, _ in recalculate() }
        .onChange(of: ran.bunRiseOver5)  { _, _ in recalculate() }
        .onChange(of: ran.calciumBelow8) { _, _ in recalculate() }
        .onChange(of: ran.pao2Below60)   { _, _ in recalculate() }
    }

    // MARK: - Glasgow Pancreatitis

    private var glasgowForm: some View {
        Group {
            Text("Glasgow (PANCREAS) — all at 48 hours.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            scoreToggle("Age >55 years", binding: $glas.ageOver55, points: "+1")
            scoreToggle("WBC >15,000/μL", binding: $glas.wbcOver15k, points: "+1")
            scoreToggle("Glucose >10 mmol/L", binding: $glas.glucoseOver10, points: "+1")
            scoreToggle("Urea >16 mmol/L", binding: $glas.ureaOver16, points: "+1")
            scoreToggle("PaO₂ <60 mmHg", binding: $glas.pao2Below60, points: "+1")
            scoreToggle("Calcium <2 mmol/L", binding: $glas.calciumBelow2, points: "+1")
            scoreToggle("Albumin <32 g/L", binding: $glas.albuminBelow32, points: "+1")
            scoreToggle("LDH >600 IU/L or AST >200 IU/L", binding: $glas.ldhOver600OrAstOver200, points: "+1")
        }
        .onChange(of: glas.ageOver55)            { _, _ in recalculate() }
        .onChange(of: glas.wbcOver15k)           { _, _ in recalculate() }
        .onChange(of: glas.glucoseOver10)         { _, _ in recalculate() }
        .onChange(of: glas.ureaOver16)            { _, _ in recalculate() }
        .onChange(of: glas.pao2Below60)           { _, _ in recalculate() }
        .onChange(of: glas.calciumBelow2)         { _, _ in recalculate() }
        .onChange(of: glas.albuminBelow32)        { _, _ in recalculate() }
        .onChange(of: glas.ldhOver600OrAstOver200){ _, _ in recalculate() }
    }

    // MARK: - Rockall

    private var rockallForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Age")
            Picker("Age group", selection: $rock.ageGroup) {
                Text("< 60 years (0)").tag(RockallInput.AgeGroup.under60)
                Text("60–79 years (+1)").tag(RockallInput.AgeGroup.sixtyTo79)
                Text("≥ 80 years (+2)").tag(RockallInput.AgeGroup.over80)
            }
            .pickerStyle(.segmented)
            .onChange(of: rock.ageGroup) { _, _ in recalculate() }

            sectionHeader("Shock")
            Picker("Shock", selection: $rock.shock) {
                Text("None (0)").tag(RockallInput.ShockStatus.none)
                Text("Pulse >100, SBP ≥100 (+1)").tag(RockallInput.ShockStatus.pulse100SBPOver100)
                Text("SBP <100 (+2)").tag(RockallInput.ShockStatus.sbpBelow100)
            }
            .pickerStyle(.segmented)
            .onChange(of: rock.shock) { _, _ in recalculate() }

            sectionHeader("Comorbidity")
            Picker("Comorbidity", selection: $rock.comorbidity) {
                Text("None (0)").tag(RockallInput.Comorbidity.none)
                Text("CCF / IHD / Major (+2)").tag(RockallInput.Comorbidity.anyMajor)
                Text("Renal / Liver / Malignancy (+3)").tag(RockallInput.Comorbidity.renalOrLiverOrMalignancy)
            }
            .pickerStyle(.segmented)
            .onChange(of: rock.comorbidity) { _, _ in recalculate() }

            sectionHeader("Endoscopy Diagnosis (post-scope)")
            Picker("Diagnosis", selection: $rock.diagnosis) {
                Text("Mallory-Weiss / no lesion (0)").tag(RockallInput.EndoscopyDiagnosis.malloryWeissOrNoLesion)
                Text("Other diagnosis (+1)").tag(RockallInput.EndoscopyDiagnosis.allOtherDiagnoses)
                Text("Upper GI malignancy (+2)").tag(RockallInput.EndoscopyDiagnosis.upperGIMalignancy)
            }
            .pickerStyle(.segmented)
            .onChange(of: rock.diagnosis) { _, _ in recalculate() }

            scoreToggle("Major stigmata of haemorrhage", binding: $rock.majorStigmata, points: "+2")
                .onChange(of: rock.majorStigmata) { _, _ in recalculate() }
        }
    }

    // MARK: - SIRS

    private var sirsForm: some View {
        Group {
            scoreToggle("Temperature >38°C or <36°C", binding: $sirsI.tempAbove38OrBelow36, points: "+1")
            scoreToggle("Heart rate >90 bpm", binding: $sirsI.heartRateOver90, points: "+1")
            scoreToggle("RR >20 or PaCO₂ <32 mmHg", binding: $sirsI.rrOver20OrPaCO2Below32, points: "+1")
            scoreToggle("WBC >12k, <4k, or >10% bands", binding: $sirsI.wbcOver12kOrBelow4kOr10PctBands, points: "+1")
            scoreToggle("Suspected infection source", binding: $sirsI.suspectedInfection, points: "Req.")
            scoreToggle("Positive blood culture", binding: $sirsI.positiveBloodCulture, points: "Bacteraemia")
        }
        .onChange(of: sirsI.tempAbove38OrBelow36)            { _, _ in recalculate() }
        .onChange(of: sirsI.heartRateOver90)                 { _, _ in recalculate() }
        .onChange(of: sirsI.rrOver20OrPaCO2Below32)          { _, _ in recalculate() }
        .onChange(of: sirsI.wbcOver12kOrBelow4kOr10PctBands){ _, _ in recalculate() }
        .onChange(of: sirsI.suspectedInfection)              { _, _ in recalculate() }
        .onChange(of: sirsI.positiveBloodCulture)            { _, _ in recalculate() }
    }

    // MARK: - qSOFA

    private var qsofaForm: some View {
        Group {
            Text("Quick SOFA — bedside assessment only. No lab values required.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            scoreToggle("Suspected infection source", binding: $qsofaI.suspectedInfection, points: "Req.")
            scoreToggle("Altered mentation (GCS <15)", binding: $qsofaI.alteredMentation, points: "+1")
            scoreToggle("Respiratory rate >22/min", binding: $qsofaI.rrOver22, points: "+1")
            scoreToggle("Systolic BP <100 mmHg", binding: $qsofaI.sbpUnder100, points: "+1")
        }
        .onChange(of: qsofaI.suspectedInfection) { _, _ in recalculate() }
        .onChange(of: qsofaI.alteredMentation)   { _, _ in recalculate() }
        .onChange(of: qsofaI.rrOver22)           { _, _ in recalculate() }
        .onChange(of: qsofaI.sbpUnder100)        { _, _ in recalculate() }
    }

    // MARK: - Wells DVT

    private var wellsDVTForm: some View {
        Group {
            scoreToggle("Active cancer (treatment/palliation ≤6 months)", binding: $wDVT.activeCancer, points: "+1")
            scoreToggle("Paralysis, paresis or plaster cast of lower limb", binding: $wDVT.paralysisParesisPlastercast, points: "+1")
            scoreToggle("Bedridden ≥3 days or surgery within 12 weeks", binding: $wDVT.bedridden3dOrSurgery12w, points: "+1")
            scoreToggle("Localised tenderness along deep vein distribution", binding: $wDVT.localizedTendernessDeepVein, points: "+1")
            scoreToggle("Entire leg swollen", binding: $wDVT.entireLegSwollen, points: "+1")
            scoreToggle("Calf swelling >3 cm vs asymptomatic leg", binding: $wDVT.calfSwellingOver3cm, points: "+1")
            scoreToggle("Pitting oedema in symptomatic leg only", binding: $wDVT.pittingOedema, points: "+1")
            scoreToggle("Collateral superficial veins (non-varicose)", binding: $wDVT.collateralSuperficialVeins, points: "+1")
            scoreToggle("Alternative diagnosis at least as likely as DVT", binding: $wDVT.alternativeDiagnosisAsLikely, points: "−2")
            scoreToggle("Previously documented DVT", binding: $wDVT.previousDVT, points: "+1")
        }
        .onChange(of: wDVT.activeCancer)                   { _, _ in recalculate() }
        .onChange(of: wDVT.paralysisParesisPlastercast)    { _, _ in recalculate() }
        .onChange(of: wDVT.bedridden3dOrSurgery12w)        { _, _ in recalculate() }
        .onChange(of: wDVT.localizedTendernessDeepVein)    { _, _ in recalculate() }
        .onChange(of: wDVT.entireLegSwollen)               { _, _ in recalculate() }
        .onChange(of: wDVT.calfSwellingOver3cm)            { _, _ in recalculate() }
        .onChange(of: wDVT.pittingOedema)                  { _, _ in recalculate() }
        .onChange(of: wDVT.collateralSuperficialVeins)     { _, _ in recalculate() }
        .onChange(of: wDVT.alternativeDiagnosisAsLikely)   { _, _ in recalculate() }
        .onChange(of: wDVT.previousDVT)                    { _, _ in recalculate() }
    }

    // MARK: - Wells PE

    private var wellsPEForm: some View {
        Group {
            scoreToggle("Clinical signs / symptoms of DVT", binding: $wPE.clinicalSignsDVT, points: "+3")
            scoreToggle("Alternative Dx less likely than PE", binding: $wPE.alternativeDxLessLikely, points: "+3")
            scoreToggle("Heart rate >100 bpm", binding: $wPE.hrOver100, points: "+1.5")
            scoreToggle("Immobilisation ≥3 days or surgery within 4 weeks", binding: $wPE.immobilisationOrSurgery4w, points: "+1.5")
            scoreToggle("Previous DVT or PE", binding: $wPE.previousDVTOrPE, points: "+1.5")
            scoreToggle("Haemoptysis", binding: $wPE.haemoptysis, points: "+1")
            scoreToggle("Malignancy (treatment ≤6 months or palliative)", binding: $wPE.malignancyActive, points: "+1")
        }
        .onChange(of: wPE.clinicalSignsDVT)        { _, _ in recalculate() }
        .onChange(of: wPE.alternativeDxLessLikely) { _, _ in recalculate() }
        .onChange(of: wPE.hrOver100)               { _, _ in recalculate() }
        .onChange(of: wPE.immobilisationOrSurgery4w){ _, _ in recalculate() }
        .onChange(of: wPE.previousDVTOrPE)         { _, _ in recalculate() }
        .onChange(of: wPE.haemoptysis)             { _, _ in recalculate() }
        .onChange(of: wPE.malignancyActive)        { _, _ in recalculate() }
    }

    // MARK: - ABCD2

    private var abcd2Form: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Age")
            Picker("Age", selection: $abcd.ageOver60) {
                Text("< 60 years (0)").tag(false)
                Text("≥ 60 years (+1)").tag(true)
            }
            .pickerStyle(.segmented)
            .onChange(of: abcd.ageOver60) { _, _ in recalculate() }

            sectionHeader("BP at Presentation")
            Picker("BP", selection: $abcd.bpOver140_90) {
                Text("Normal (0)").tag(false)
                Text("SBP ≥140 or DBP ≥90 (+1)").tag(true)
            }
            .pickerStyle(.segmented)
            .onChange(of: abcd.bpOver140_90) { _, _ in recalculate() }

            sectionHeader("Clinical Features of TIA")
            VStack(spacing: 0) {
                scoreToggle("Unilateral weakness", binding: $abcd.unilateralWeakness, points: "+2")
                    .onChange(of: abcd.unilateralWeakness) { _, _ in
                        if abcd.unilateralWeakness { abcd.speechWithoutWeakness = false }
                        recalculate()
                    }
                scoreToggle("Speech disturbance without weakness", binding: $abcd.speechWithoutWeakness, points: "+1")
                    .onChange(of: abcd.speechWithoutWeakness) { _, _ in
                        if abcd.speechWithoutWeakness { abcd.unilateralWeakness = false }
                        recalculate()
                    }
            }

            sectionHeader("Duration of Symptoms")
            Picker("Duration", selection: $abcdDuration) {
                Text("< 10 min (0)").tag(0)
                Text("10–59 min (+1)").tag(1)
                Text("≥ 60 min (+2)").tag(2)
            }
            .pickerStyle(.segmented)
            .onChange(of: abcdDuration) { _, v in
                abcd.duration10to59min  = (v == 1)
                abcd.durationOver60min  = (v == 2)
                recalculate()
            }

            scoreToggle("Diabetes mellitus", binding: $abcd.diabetes, points: "+1")
                .onChange(of: abcd.diabetes) { _, _ in recalculate() }
        }
    }

    // MARK: - LRINEC

    private var lrinecForm: some View {
        Group {
            sectionHeader("Laboratory Values")
            scoreToggle("CRP >150 mg/L", binding: $lrin.crpOver150, points: "+4")
            scoreToggle("WBC >25 ×10⁹/L", binding: $lrin.wbcOver25, points: "+2")
            scoreToggle("WBC 15–25 ×10⁹/L", binding: $lrin.wbc15to25, points: "+1")
            scoreToggle("Hb <11 g/dL", binding: $lrin.hbBelow11, points: "+2")
            scoreToggle("Hb 11–13.5 g/dL", binding: $lrin.hb11to13_5, points: "+1")
            scoreToggle("Sodium <135 mmol/L", binding: $lrin.sodiumBelow135, points: "+2")
            scoreToggle("Creatinine >177 μmol/L", binding: $lrin.creatinineOver177, points: "+4")
            scoreToggle("Creatinine 141–177 μmol/L", binding: $lrin.creatinine141to177, points: "+2")
            scoreToggle("Glucose >10 mmol/L", binding: $lrin.glucoseOver10, points: "+1")
        }
        .onChange(of: lrin.crpOver150)          { _, _ in recalculate() }
        .onChange(of: lrin.wbcOver25)           { _, _ in recalculate() }
        .onChange(of: lrin.wbc15to25)           { _, _ in recalculate() }
        .onChange(of: lrin.hbBelow11)           { _, _ in recalculate() }
        .onChange(of: lrin.hb11to13_5)          { _, _ in recalculate() }
        .onChange(of: lrin.sodiumBelow135)      { _, _ in recalculate() }
        .onChange(of: lrin.creatinineOver177)   { _, _ in recalculate() }
        .onChange(of: lrin.creatinine141to177)  { _, _ in recalculate() }
        .onChange(of: lrin.glucoseOver10)       { _, _ in recalculate() }
    }

    // MARK: - RCRI

    private var rcriForm: some View {
        Group {
            Text("Revised Cardiac Risk Index — for non-cardiac surgery.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            scoreToggle("High-risk surgery (intrathoracic, intraabdominal or suprainguinal vascular)", binding: $rcriI.highRiskSurgery, points: "+1")
            scoreToggle("History of ischaemic heart disease", binding: $rcriI.ischemicHeartDisease, points: "+1")
            scoreToggle("History of congestive heart failure", binding: $rcriI.congestiveHeartFailure, points: "+1")
            scoreToggle("History of cerebrovascular disease", binding: $rcriI.cerebrovascularDisease, points: "+1")
            scoreToggle("Insulin-dependent diabetes mellitus", binding: $rcriI.insulinDependentDiabetes, points: "+1")
            scoreToggle("Pre-op creatinine >177 μmol/L (>2 mg/dL)", binding: $rcriI.preopCreatinineOver2, points: "+1")
        }
        .onChange(of: rcriI.highRiskSurgery)           { _, _ in recalculate() }
        .onChange(of: rcriI.ischemicHeartDisease)      { _, _ in recalculate() }
        .onChange(of: rcriI.congestiveHeartFailure)    { _, _ in recalculate() }
        .onChange(of: rcriI.cerebrovascularDisease)    { _, _ in recalculate() }
        .onChange(of: rcriI.insulinDependentDiabetes)  { _, _ in recalculate() }
        .onChange(of: rcriI.preopCreatinineOver2)      { _, _ in recalculate() }
    }

    // MARK: - Caprini

    private var capriniForm: some View {
        Group {
            sectionHeader("Age")
            scoreToggle("Age 41–59 years", binding: $cap.age41to59, points: "+1")
            scoreToggle("Age 60–74 years", binding: $cap.age60to74, points: "+2")
            scoreToggle("Age ≥75 years", binding: $cap.ageOver75, points: "+3")
            sectionHeader("Risk Factors")
            scoreToggle("Minor surgery (current)", binding: $cap.minorSurgery, points: "+1")
            scoreToggle("Major surgery (>45 min)", binding: $cap.majorSurgery, points: "+2")
            scoreToggle("Laparoscopic surgery >45 min", binding: $cap.laparoscopicSurgeryOver45min, points: "+2")
            scoreToggle("Immobility / bed-rest", binding: $cap.immobilityBedridden, points: "+1")
            scoreToggle("Central venous access", binding: $cap.centralVenousAccess, points: "+2")
            scoreToggle("Active / prior malignancy", binding: $cap.activeOrPriorMalignancy, points: "+2")
            scoreToggle("Prior VTE", binding: $cap.priorVTE, points: "+3")
            scoreToggle("Family history of VTE", binding: $cap.familyHistoryVTE, points: "+3")
            scoreToggle("Thrombophilia", binding: $cap.thrombophilia, points: "+3")
            scoreToggle("Hormonal therapy / OCP", binding: $cap.hormonalTherapy, points: "+1")
            scoreToggle("Sepsis within 30 days", binding: $cap.sepsis30d, points: "+1")
            scoreToggle("BMI ≥40 kg/m²", binding: $cap.bmi40Plus, points: "+1")
            sectionHeader("High-Risk Events (+5 each)")
            scoreToggle("Stroke", binding: $cap.stroke, points: "+5")
            scoreToggle("Myocardial infarction", binding: $cap.mi, points: "+5")
            scoreToggle("Spinal cord injury", binding: $cap.spinalCordInjury, points: "+5")
            scoreToggle("Pelvis fracture / hip or knee replacement", binding: $cap.pelvisFractureOrHipKneeReplacement, points: "+5")
            scoreToggle("Multiple trauma", binding: $cap.multipleTrauma, points: "+5")
        }
        .onChange(of: cap.ageOver75)                        { _, _ in recalculate() }
        .onChange(of: cap.age60to74)                        { _, _ in recalculate() }
        .onChange(of: cap.age41to59)                        { _, _ in recalculate() }
        .onChange(of: cap.activeOrPriorMalignancy)          { _, _ in recalculate() }
        .onChange(of: cap.priorVTE)                         { _, _ in recalculate() }
        .onChange(of: cap.familyHistoryVTE)                 { _, _ in recalculate() }
        .onChange(of: cap.thrombophilia)                    { _, _ in recalculate() }
        .onChange(of: cap.minorSurgery)                     { _, _ in recalculate() }
        .onChange(of: cap.majorSurgery)                     { _, _ in recalculate() }
        .onChange(of: cap.laparoscopicSurgeryOver45min)     { _, _ in recalculate() }
        .onChange(of: cap.immobilityBedridden)              { _, _ in recalculate() }
        .onChange(of: cap.centralVenousAccess)              { _, _ in recalculate() }
        .onChange(of: cap.hormonalTherapy)                  { _, _ in recalculate() }
        .onChange(of: cap.sepsis30d)                        { _, _ in recalculate() }
        .onChange(of: cap.bmi40Plus)                        { _, _ in recalculate() }
        .onChange(of: cap.stroke)                           { _, _ in recalculate() }
        .onChange(of: cap.mi)                               { _, _ in recalculate() }
        .onChange(of: cap.spinalCordInjury)                 { _, _ in recalculate() }
        .onChange(of: cap.pelvisFractureOrHipKneeReplacement){ _, _ in recalculate() }
        .onChange(of: cap.multipleTrauma)                   { _, _ in recalculate() }
    }

    // MARK: - Child-Pugh

    private var childPughForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Ascites")
            Picker("Ascites", selection: $cp.ascites) {
                Text("None (1)").tag(ChildPughInput.AscitesGrade.none)
                Text("Controlled (2)").tag(ChildPughInput.AscitesGrade.controlled)
                Text("Refractory (3)").tag(ChildPughInput.AscitesGrade.refractory)
            }
            .pickerStyle(.segmented)
            .onChange(of: cp.ascites) { _, _ in recalculate() }

            sectionHeader("Encephalopathy Grade")
            Picker("Encephalopathy", selection: $cp.encephalopathy) {
                Text("None (1)").tag(ChildPughInput.EncephalopathyGrade.none)
                Text("Grade 1–2 (2)").tag(ChildPughInput.EncephalopathyGrade.grade1to2)
                Text("Grade 3–4 (3)").tag(ChildPughInput.EncephalopathyGrade.grade3to4)
            }
            .pickerStyle(.segmented)
            .onChange(of: cp.encephalopathy) { _, _ in recalculate() }

            sectionHeader("Bilirubin (μmol/L)")
            HStack {
                Slider(value: $cp.bilirubinUmolL, in: 0...400, step: 5)
                    .onChange(of: cp.bilirubinUmolL) { _, _ in recalculate() }
                Text("\(Int(cp.bilirubinUmolL)) μmol/L")
                    .font(.caption.monospacedDigit())
                    .frame(width: 80, alignment: .trailing)
            }

            sectionHeader("Albumin (g/dL)")
            HStack {
                Slider(value: $cp.albuminGdL, in: 1.0...5.0, step: 0.1)
                    .onChange(of: cp.albuminGdL) { _, _ in recalculate() }
                Text(String(format: "%.1f g/dL", cp.albuminGdL))
                    .font(.caption.monospacedDigit())
                    .frame(width: 80, alignment: .trailing)
            }

            sectionHeader("PT-INR")
            HStack {
                Slider(value: $cp.ptINR, in: 0.8...5.0, step: 0.1)
                    .onChange(of: cp.ptINR) { _, _ in recalculate() }
                Text(String(format: "%.1f", cp.ptINR))
                    .font(.caption.monospacedDigit())
                    .frame(width: 80, alignment: .trailing)
            }
        }
    }

    // MARK: - Shared helpers

    private func scoreToggle(_ label: String, binding: Binding<Bool>, points: String) -> some View {
        Toggle(isOn: binding) {
            HStack {
                Text(label)
                    .font(.subheadline)
                Spacer()
                Text(points)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(binding.wrappedValue ? AMColor.accent : .secondary)
            }
        }
        .toggleStyle(.switch)
        .tint(AMColor.accent)
        .padding(.vertical, 2)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .padding(.top, 8)
    }
}
