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
    case cardiac      = "Cardiac / AF"
    case monitoring   = "Monitoring"
}

enum ActiveScore: String, CaseIterable, Identifiable {
    var id: String { rawValue }
    case alvarado         = "Alvarado (Appendicitis)"
    case tokyoChole       = "Tokyo — Cholecystitis"
    case tokyoCholang     = "Tokyo — Cholangitis"
    case ranson           = "Ranson (Pancreatitis)"
    case glasgow          = "Glasgow (Pancreatitis)"
    case rockall          = "Rockall (GI Bleed)"
    case blatchford       = "Blatchford (GI Bleed)"
    case sirs             = "SIRS / Sepsis"
    case qsofa            = "qSOFA (Sepsis)"
    case mews             = "MEWS (Early Warning)"
    case wellsDVT         = "Wells DVT"
    case wellsPE          = "Wells PE"
    case abcd2            = "ABCD² (TIA/Stroke)"
    case gcs              = "GCS (Coma Scale)"
    case lrinec           = "LRINEC (Necrotising Fasciitis)"
    case rcri             = "RCRI (Cardiac Risk)"
    case asa              = "ASA Physical Status"
    case caprini          = "Caprini (VTE Risk)"
    case childPugh        = "Child-Pugh (Liver)"
    case meld             = "MELD-Na (Liver)"
    case cha2ds2vasc      = "CHA₂DS₂-VASc (AF Stroke)"
    case hasBled          = "HAS-BLED (Bleeding)"
    case stopBang         = "STOP-BANG (OSA)"

    var category: ScoreCategory {
        switch self {
        case .alvarado, .tokyoChole, .tokyoCholang, .ranson, .glasgow:
            return .acute
        case .rockall, .blatchford:
            return .gi
        case .wellsDVT, .wellsPE, .caprini:
            return .vascular
        case .sirs, .qsofa:
            return .sepsis
        case .rcri, .asa, .childPugh, .meld, .stopBang:
            return .preop
        case .abcd2, .lrinec, .gcs:
            return .neuro
        case .cha2ds2vasc, .hasBled:
            return .cardiac
        case .mews:
            return .monitoring
        }
    }

    var icon: String {
        switch self {
        case .alvarado:       return "bandage"
        case .tokyoChole:     return "drop.fill"
        case .tokyoCholang:   return "drop.halffull"
        case .ranson, .glasgow: return "flame"
        case .rockall:        return "scope"
        case .blatchford:     return "drop.triangle"
        case .sirs, .qsofa:   return "thermometer.medium"
        case .mews:           return "waveform.path.ecg.rectangle"
        case .wellsDVT, .wellsPE, .caprini: return "heart.fill"
        case .abcd2:          return "brain.head.profile"
        case .gcs:            return "eye"
        case .lrinec:         return "cross.case.fill"
        case .rcri:           return "waveform.path.ecg"
        case .asa:            return "person.badge.shield.checkmark"
        case .childPugh:      return "staroflife"
        case .meld:           return "staroflife.fill"
        case .cha2ds2vasc:    return "heart.circle"
        case .hasBled:        return "bandage.fill"
        case .stopBang:       return "moon.zzz"
        }
    }
}

// MARK: - Main view

struct ClinicalScoresView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var modelContext

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
    // MEWS
    @State private var mewsI = MEWSInput()
    // GCS
    @State private var gcsI = GCSInput()
    // ASA
    @State private var asaI = ASAInput()
    // MELD
    @State private var meldI = MELDInput()
    // CHA2DS2-VASc
    @State private var cha2I = CHA2DS2VAScInput()
    // HAS-BLED
    @State private var hblI = HASBLEDInput()
    // Blatchford
    @State private var blatchI = BlatchfordInput()
    // STOP-BANG
    @State private var sbangI = STOPBANGInput()

    // Auto-population tracking
    @State private var autoFill = ScoreAutoFill()
    @State private var mewsSaved = false
    @State private var scoreSaved = false

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
        .onChange(of: selectedScore) { _, newScore in
            if let score = newScore { autoPopulate(for: score) } else { autoFill = ScoreAutoFill() }
            recalculate()
        }
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

            if !autoFill.autoFieldKeys.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars")
                        .font(.caption2)
                        .foregroundStyle(.teal)
                    Text("\(autoFill.autoFieldKeys.count) field\(autoFill.autoFieldKeys.count == 1 ? "" : "s") pre-filled from patient record — review teal toggles.")
                        .font(.caption2)
                        .foregroundStyle(.teal)
                }
                .padding(.top, 2)
            }

            if let note = r.evidenceNote {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.top, 4)
            }

            Button(action: { saveScoreToAssessment(r) }) {
                Label(
                    scoreSaved ? "Saved to Assessment" : "Save score to Assessment",
                    systemImage: scoreSaved ? "checkmark.circle.fill" : "note.text.badge.plus"
                )
                .font(.caption.weight(.medium))
                .foregroundStyle(scoreSaved ? .green : AMColor.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    (scoreSaved ? Color.green : AMColor.accent).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 8)
                )
            }
            .buttonStyle(.plain)
            .disabled(scoreSaved)
            .animation(.easeInOut(duration: 0.2), value: scoreSaved)
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

    // MARK: - Auto-populate from patient data

    private func autoPopulate(for score: ActiveScore) {
        mewsSaved = false
        scoreSaved = false
        switch score {
        case .caprini:
            let (input, fill) = PatientScoreAutoPopulator.caprini(patient: patient)
            cap = input; autoFill = fill
        case .wellsDVT:
            let (input, fill) = PatientScoreAutoPopulator.wellsDVT(patient: patient)
            wDVT = input; autoFill = fill
        case .wellsPE:
            let (input, fill) = PatientScoreAutoPopulator.wellsPE(patient: patient)
            wPE = input; autoFill = fill
        case .rcri:
            let (input, fill) = PatientScoreAutoPopulator.rcri(patient: patient)
            rcriI = input; autoFill = fill
        case .stopBang:
            let (input, fill) = PatientScoreAutoPopulator.stopBang(patient: patient)
            sbangI = input; autoFill = fill
        case .cha2ds2vasc:
            let (input, fill) = PatientScoreAutoPopulator.cha2ds2vasc(patient: patient)
            cha2I = input; autoFill = fill
        case .hasBled:
            let (input, fill) = PatientScoreAutoPopulator.hasBled(patient: patient)
            hblI = input; autoFill = fill
        case .abcd2:
            let (input, fill) = PatientScoreAutoPopulator.abcd2(patient: patient)
            abcd = input; autoFill = fill
        case .mews:
            let (input, fill) = PatientScoreAutoPopulator.mews(patient: patient)
            mewsI = input; autoFill = fill
        default:
            autoFill = ScoreAutoFill()
        }
    }

    // MARK: - MEWS write-back

    private func saveMEWSToVitals() {
        let entry = VitalsEntry(patient: patient)
        entry.respiratoryRate    = mewsI.respiratoryRate
        entry.spo2               = mewsI.oxygenSaturation
        entry.heartRate          = mewsI.heartRate
        entry.bpSystolic         = mewsI.systolicBP
        entry.temperatureCelsius = mewsI.temperature
        entry.avpu = switch mewsI.consciousnessAVPU {
        case .alert:        .alert
        case .voice:        .voice
        case .pain:         .pain
        case .unresponsive: .unresponsive
        }
        modelContext.insert(entry)
        mewsSaved = true
    }

    // MARK: - Score write-back

    private func saveScoreToAssessment(_ r: ClinicalScore) {
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        fmt.timeStyle = .short
        let scoreStr = r.score == Double(Int(r.score)) ? "\(Int(r.score))" : String(format: "%.1f", r.score)
        let maxStr   = r.maxScore == Double(Int(r.maxScore)) ? "\(Int(r.maxScore))" : String(format: "%.1f", r.maxScore)
        let line = "[\(fmt.string(from: .now))] \(r.systemName): \(scoreStr)/\(maxStr) — \(r.risk.rawValue) Risk. \(r.interpretation)"
        if let existing = patient.assessmentText, !existing.isEmpty {
            patient.assessmentText = existing + "\n" + line
        } else {
            patient.assessmentText = line
        }
        scoreSaved = true
    }

    // MARK: - Recalculate

    private func recalculate() {
        scoreSaved = false
        guard let score = selectedScore else { result = nil; return }
        result = switch score {
        case .alvarado:     ClinicalScoringEngine.alvarado(alv)
        case .tokyoChole:   ClinicalScoringEngine.tokyoCholecystitis(tkyC)
        case .tokyoCholang: ClinicalScoringEngine.tokyoCholangitis(tkyG)
        case .ranson:       ClinicalScoringEngine.ranson(ran)
        case .glasgow:      ClinicalScoringEngine.glasgowPancreatitis(glas)
        case .rockall:      ClinicalScoringEngine.rockall(rock)
        case .blatchford:   ClinicalScoringEngine.blatchford(blatchI)
        case .sirs:         ClinicalScoringEngine.sirs(sirsI)
        case .qsofa:        ClinicalScoringEngine.qsofa(qsofaI)
        case .mews:         ClinicalScoringEngine.mews(mewsI)
        case .wellsDVT:     ClinicalScoringEngine.wellsDVT(wDVT)
        case .wellsPE:      ClinicalScoringEngine.wellsPE(wPE)
        case .abcd2:        ClinicalScoringEngine.abcd2(abcd)
        case .gcs:          ClinicalScoringEngine.gcs(gcsI)
        case .lrinec:       ClinicalScoringEngine.lrinec(lrin)
        case .rcri:         ClinicalScoringEngine.rcri(rcriI)
        case .asa:          ClinicalScoringEngine.asa(asaI)
        case .caprini:      ClinicalScoringEngine.caprini(cap)
        case .childPugh:    ClinicalScoringEngine.childPugh(cp)
        case .meld:         ClinicalScoringEngine.meld(meldI)
        case .cha2ds2vasc:  ClinicalScoringEngine.cha2ds2vasc(cha2I)
        case .hasBled:      ClinicalScoringEngine.hasBled(hblI)
        case .stopBang:     ClinicalScoringEngine.stopBang(sbangI)
        }
    }

    // MARK: - Input forms

    @ViewBuilder
    private func inputForm(for score: ActiveScore) -> some View {
        VStack(alignment: .leading, spacing: 0) {
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
            formBody(for: score)
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }

    @ViewBuilder
    private func formBody(for score: ActiveScore) -> some View {
        pendingVariablesPanel
        switch score {
        case .alvarado:     alvaradoForm
        case .tokyoChole:   tokyoCholecystitisForm
        case .tokyoCholang: tokyoCholangitisForm
        case .ranson:       ransonForm
        case .glasgow:      glasgowForm
        case .rockall:      rockallForm
        case .blatchford:   blatchfordForm
        case .sirs:         sirsForm
        case .qsofa:        qsofaForm
        case .mews:         mewsForm
        case .wellsDVT:     wellsDVTForm
        case .wellsPE:      wellsPEForm
        case .abcd2:        abcd2Form
        case .gcs:          gcsForm
        case .lrinec:       lrinecForm
        case .rcri:         rcriForm
        case .asa:          asaForm
        case .caprini:      capriniForm
        case .childPugh:    childPughForm
        case .meld:         meldForm
        case .cha2ds2vasc:  cha2ds2vascForm
        case .hasBled:      hasBledForm
        case .stopBang:     stopBangForm
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
            scoreToggle("Elevated temperature ≥37.3°C", binding: $alv.elevatedTemperature, points: "+1")
            scoreToggle("WBC >10,000/μL", binding: $alv.wbcElevated, points: "+2")
            scoreToggle("Neutrophilia >75%", binding: $alv.neutrophiliaShift, points: "+1")
        }
        .onChange(of: alv) { _, _ in recalculate() }
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
        .onChange(of: tkyC) { _, _ in recalculate() }
    }

    // MARK: - Tokyo Cholangitis

    private var tokyoCholangitisForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            tokyoCholangitisGrade1and2
            tokyoCholangitisGrade3
        }
    }

    @ViewBuilder private var tokyoCholangitisGrade1and2: some View {
        Group {
            scoreToggle("Cholangitis confirmed (Charcot's / imaging)", binding: $tkyG.cholangitisConfirmed, points: "Req.")
            sectionHeader("Grade II Criteria (any = at least Grade II)")
            scoreToggle("WBC >12k or <4k", binding: $tkyG.wbcAbove12OrBelow4, points: "II")
            scoreToggle("Temperature >39°C", binding: $tkyG.temperatureAbove39, points: "II")
            scoreToggle("Age >75 years", binding: $tkyG.ageAbove75, points: "II")
            scoreToggle("Bilirubin >85 μmol/L (>5 mg/dL)", binding: $tkyG.bilirubinAbove5, points: "II")
            scoreToggle("Albumin <0.7 × LLN", binding: $tkyG.albuminBelow0_7xLLN, points: "II")
        }
        .onChange(of: tkyG) { _, _ in recalculate() }
    }

    @ViewBuilder private var tokyoCholangitisGrade3: some View {
        Group {
            sectionHeader("Grade III Organ Dysfunction")
            scoreToggle("Cardiovascular dysfunction", binding: $tkyG.cardiovascularDysfunction, points: "III")
            scoreToggle("Neurological dysfunction", binding: $tkyG.neurologicalDysfunction, points: "III")
            scoreToggle("Respiratory dysfunction", binding: $tkyG.respiratoryDysfunction, points: "III")
            scoreToggle("Renal dysfunction", binding: $tkyG.renalDysfunction, points: "III")
            scoreToggle("Hepatic dysfunction", binding: $tkyG.hepaticDysfunction, points: "III")
            scoreToggle("Haematological dysfunction", binding: $tkyG.haematologicalDysfunction, points: "III")
        }
        .onChange(of: tkyG) { _, _ in recalculate() }
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
        .onChange(of: ran) { _, _ in recalculate() }
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
        .onChange(of: glas) { _, _ in recalculate() }
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

            sectionHeader("Shock")
            Picker("Shock", selection: $rock.shock) {
                Text("None (0)").tag(RockallInput.ShockStatus.none)
                Text("Pulse >100, SBP ≥100 (+1)").tag(RockallInput.ShockStatus.pulse100SBPOver100)
                Text("SBP <100 (+2)").tag(RockallInput.ShockStatus.sbpBelow100)
            }
            .pickerStyle(.segmented)

            sectionHeader("Comorbidity")
            Picker("Comorbidity", selection: $rock.comorbidity) {
                Text("None (0)").tag(RockallInput.Comorbidity.none)
                Text("CCF / IHD / Major (+2)").tag(RockallInput.Comorbidity.anyMajor)
                Text("Renal / Liver / Malignancy (+3)").tag(RockallInput.Comorbidity.renalOrLiverOrMalignancy)
            }
            .pickerStyle(.segmented)

            sectionHeader("Endoscopy Diagnosis (post-scope)")
            Picker("Diagnosis", selection: $rock.diagnosis) {
                Text("Mallory-Weiss / no lesion (0)").tag(RockallInput.EndoscopyDiagnosis.malloryWeissOrNoLesion)
                Text("Other diagnosis (+1)").tag(RockallInput.EndoscopyDiagnosis.allOtherDiagnoses)
                Text("Upper GI malignancy (+2)").tag(RockallInput.EndoscopyDiagnosis.upperGIMalignancy)
            }
            .pickerStyle(.segmented)

            scoreToggle("Major stigmata of haemorrhage", binding: $rock.majorStigmata, points: "+2")
        }
        .onChange(of: rock) { _, _ in recalculate() }
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
        .onChange(of: sirsI) { _, _ in recalculate() }
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
        .onChange(of: qsofaI) { _, _ in recalculate() }
    }

    // MARK: - Wells DVT

    private var wellsDVTForm: some View {
        Group {
            scoreToggle("Active cancer (treatment/palliation ≤6 months)",     binding: $wDVT.activeCancer,                  points: "+1",  autoKey: "activeCancer")
            scoreToggle("Paralysis, paresis or plaster cast of lower limb",   binding: $wDVT.paralysisParesisPlastercast,   points: "+1",  autoKey: "paralysisParesisPlastercast")
            scoreToggle("Bedridden ≥3 days or surgery within 12 weeks",       binding: $wDVT.bedridden3dOrSurgery12w,       points: "+1",  autoKey: "bedridden3dOrSurgery12w")
            scoreToggle("Localised tenderness along deep vein distribution",  binding: $wDVT.localizedTendernessDeepVein,  points: "+1",  autoKey: "localizedTendernessDeepVein")
            scoreToggle("Entire leg swollen",                                  binding: $wDVT.entireLegSwollen,              points: "+1",  autoKey: "entireLegSwollen")
            scoreToggle("Calf swelling >3 cm vs asymptomatic leg",            binding: $wDVT.calfSwellingOver3cm,           points: "+1",  autoKey: "calfSwellingOver3cm")
            scoreToggle("Pitting oedema in symptomatic leg only",             binding: $wDVT.pittingOedema,                 points: "+1",  autoKey: "pittingOedema")
            scoreToggle("Collateral superficial veins (non-varicose)",        binding: $wDVT.collateralSuperficialVeins,    points: "+1",  autoKey: "collateralSuperficialVeins")
            scoreToggle("Alternative diagnosis at least as likely as DVT",    binding: $wDVT.alternativeDiagnosisAsLikely,  points: "−2")
            scoreToggle("Previously documented DVT",                           binding: $wDVT.previousDVT,                   points: "+1",  autoKey: "previousDVT")
        }
        .onChange(of: wDVT) { _, _ in recalculate() }
    }

    // MARK: - Wells PE

    private var wellsPEForm: some View {
        Group {
            scoreToggle("Clinical signs / symptoms of DVT",                    binding: $wPE.clinicalSignsDVT,           points: "+3",   autoKey: "clinicalSignsDVT")
            scoreToggle("Alternative Dx less likely than PE",                  binding: $wPE.alternativeDxLessLikely,    points: "+3",   autoKey: "alternativeDxLessLikely")
            scoreToggle("Heart rate >100 bpm",                                 binding: $wPE.hrOver100,                  points: "+1.5", autoKey: "hrOver100")
            scoreToggle("Immobilisation ≥3 days or surgery within 4 weeks",   binding: $wPE.immobilisationOrSurgery4w,  points: "+1.5", autoKey: "immobilisationOrSurgery4w")
            scoreToggle("Previous DVT or PE",                                  binding: $wPE.previousDVTOrPE,            points: "+1.5", autoKey: "previousDVTOrPE")
            scoreToggle("Haemoptysis",                                         binding: $wPE.haemoptysis,                points: "+1",   autoKey: "haemoptysis")
            scoreToggle("Malignancy (treatment ≤6 months or palliative)",     binding: $wPE.malignancyActive,           points: "+1",   autoKey: "malignancyActive")
        }
        .onChange(of: wPE) { _, _ in recalculate() }
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

            sectionHeader("BP at Presentation")
            Picker("BP", selection: $abcd.bpOver140_90) {
                Text("Normal (0)").tag(false)
                Text("SBP ≥140 or DBP ≥90 (+1)").tag(true)
            }
            .pickerStyle(.segmented)

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

            scoreToggle("Diabetes mellitus", binding: $abcd.diabetes, points: "+1", autoKey: "diabetes")
        }
        .onChange(of: abcd) { _, _ in recalculate() }
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
        .onChange(of: lrin) { _, _ in recalculate() }
    }

    // MARK: - RCRI

    private var rcriForm: some View {
        Group {
            Text("Revised Cardiac Risk Index — for non-cardiac surgery.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            scoreToggle("High-risk surgery (intrathoracic, intraabdominal or suprainguinal vascular)", binding: $rcriI.highRiskSurgery,           points: "+1", autoKey: "highRiskSurgery")
            scoreToggle("History of ischaemic heart disease",                                          binding: $rcriI.ischemicHeartDisease,        points: "+1", autoKey: "ischemicHeartDisease")
            scoreToggle("History of congestive heart failure",                                         binding: $rcriI.congestiveHeartFailure,       points: "+1", autoKey: "congestiveHeartFailure")
            scoreToggle("History of cerebrovascular disease",                                          binding: $rcriI.cerebrovascularDisease,       points: "+1", autoKey: "cerebrovascularDisease")
            scoreToggle("Insulin-dependent diabetes mellitus",                                         binding: $rcriI.insulinDependentDiabetes,     points: "+1", autoKey: "insulinDependentDiabetes")
            scoreToggle("Pre-op creatinine >177 μmol/L (>2 mg/dL)",                                  binding: $rcriI.preopCreatinineOver2,         points: "+1", autoKey: "preopCreatinineOver2")
        }
        .onChange(of: rcriI) { _, _ in recalculate() }
    }

    // MARK: - Caprini

    private var capriniForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            capriniAgeSection
            capriniRiskSection
            capriniHighRiskSection
        }
    }

    @ViewBuilder private var capriniAgeSection: some View {
        Group {
            sectionHeader("Age")
            scoreToggle("Age 41–59 years", binding: $cap.age41to59, points: "+1", autoKey: "age41to59")
            scoreToggle("Age 60–74 years", binding: $cap.age60to74, points: "+2", autoKey: "age60to74")
            scoreToggle("Age ≥75 years",   binding: $cap.ageOver75, points: "+3", autoKey: "ageOver75")
        }
        .onChange(of: cap) { _, _ in recalculate() }
    }

    @ViewBuilder private var capriniRiskSection: some View {
        capriniRiskSectionA
        capriniRiskSectionB
    }

    @ViewBuilder private var capriniRiskSectionA: some View {
        Group {
            sectionHeader("Risk Factors")
            scoreToggle("Minor surgery (current)",       binding: $cap.minorSurgery,                 points: "+1")
            scoreToggle("Major surgery (>45 min)",       binding: $cap.majorSurgery,                 points: "+2", autoKey: "majorSurgery")
            scoreToggle("Laparoscopic surgery >45 min",  binding: $cap.laparoscopicSurgeryOver45min, points: "+2", autoKey: "laparoscopicSurgeryOver45min")
            scoreToggle("Immobility / bed-rest",         binding: $cap.immobilityBedridden,          points: "+1", autoKey: "immobilityBedridden")
            scoreToggle("Central venous access",         binding: $cap.centralVenousAccess,          points: "+2", autoKey: "centralVenousAccess")
            scoreToggle("Active / prior malignancy",     binding: $cap.activeOrPriorMalignancy,      points: "+2", autoKey: "activeOrPriorMalignancy")
        }
        .onChange(of: cap) { _, _ in recalculate() }
    }

    @ViewBuilder private var capriniRiskSectionB: some View {
        Group {
            scoreToggle("Prior VTE",              binding: $cap.priorVTE,         points: "+3", autoKey: "priorVTE")
            scoreToggle("Family history of VTE",  binding: $cap.familyHistoryVTE, points: "+3", autoKey: "familyHistoryVTE")
            scoreToggle("Thrombophilia",           binding: $cap.thrombophilia,    points: "+3", autoKey: "thrombophilia")
            scoreToggle("Hormonal therapy / OCP", binding: $cap.hormonalTherapy,  points: "+1", autoKey: "hormonalTherapy")
            scoreToggle("Sepsis within 30 days",  binding: $cap.sepsis30d,        points: "+1", autoKey: "sepsis30d")
            scoreToggle("BMI ≥40 kg/m²",          binding: $cap.bmi40Plus,        points: "+1", autoKey: "bmi40Plus")
        }
        .onChange(of: cap) { _, _ in recalculate() }
    }

    @ViewBuilder private var capriniHighRiskSection: some View {
        Group {
            sectionHeader("High-Risk Events (+5 each)")
            scoreToggle("Stroke",                                    binding: $cap.stroke,                           points: "+5", autoKey: "stroke")
            scoreToggle("Myocardial infarction",                     binding: $cap.mi,                               points: "+5", autoKey: "mi")
            scoreToggle("Spinal cord injury",                        binding: $cap.spinalCordInjury,                 points: "+5", autoKey: "spinalCordInjury")
            scoreToggle("Pelvis fracture / hip or knee replacement", binding: $cap.pelvisFractureOrHipKneeReplacement, points: "+5")
            scoreToggle("Multiple trauma",                           binding: $cap.multipleTrauma,                   points: "+5")
        }
        .onChange(of: cap) { _, _ in recalculate() }
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

            sectionHeader("Encephalopathy Grade")
            Picker("Encephalopathy", selection: $cp.encephalopathy) {
                Text("None (1)").tag(ChildPughInput.EncephalopathyGrade.none)
                Text("Grade 1–2 (2)").tag(ChildPughInput.EncephalopathyGrade.grade1to2)
                Text("Grade 3–4 (3)").tag(ChildPughInput.EncephalopathyGrade.grade3to4)
            }
            .pickerStyle(.segmented)

            sectionHeader("Bilirubin (μmol/L)")
            HStack {
                Slider(value: $cp.bilirubinUmolL, in: 0...400, step: 5)
                Text("\(Int(cp.bilirubinUmolL)) μmol/L")
                    .font(.caption.monospacedDigit())
                    .frame(width: 80, alignment: .trailing)
            }

            sectionHeader("Albumin (g/dL)")
            HStack {
                Slider(value: $cp.albuminGdL, in: 1.0...5.0, step: 0.1)
                Text(String(format: "%.1f g/dL", cp.albuminGdL))
                    .font(.caption.monospacedDigit())
                    .frame(width: 80, alignment: .trailing)
            }

            sectionHeader("PT-INR")
            HStack {
                Slider(value: $cp.ptINR, in: 0.8...5.0, step: 0.1)
                Text(String(format: "%.1f", cp.ptINR))
                    .font(.caption.monospacedDigit())
                    .frame(width: 80, alignment: .trailing)
            }
        }
        .onChange(of: cp) { _, _ in recalculate() }
    }

    // MARK: - MEWS

    private var mewsForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            if autoFill.isAuto("respiratoryRate") || autoFill.isAuto("heartRate") || autoFill.isAuto("systolicBP") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Pre-filled from most recent vitals — verify and adjust if needed.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
            mewsSlider(label: "Respiratory Rate (breaths/min)", autoKey: "respiratoryRate",
                       value: Binding(get: { Double(mewsI.respiratoryRate) }, set: { mewsI.respiratoryRate = Int($0) }),
                       in: 4...50, step: 1, display: "\(mewsI.respiratoryRate)")
            mewsSlider(label: "SpO₂ (%)", autoKey: "oxygenSaturation",
                       value: Binding(get: { Double(mewsI.oxygenSaturation) }, set: { mewsI.oxygenSaturation = Int($0) }),
                       in: 70...100, step: 1, display: "\(mewsI.oxygenSaturation)%")
            mewsSlider(label: "Heart Rate (bpm)", autoKey: "heartRate",
                       value: Binding(get: { Double(mewsI.heartRate) }, set: { mewsI.heartRate = Int($0) }),
                       in: 20...200, step: 1, display: "\(mewsI.heartRate)")
            mewsSlider(label: "Systolic BP (mmHg)", autoKey: "systolicBP",
                       value: Binding(get: { Double(mewsI.systolicBP) }, set: { mewsI.systolicBP = Int($0) }),
                       in: 40...240, step: 2, display: "\(mewsI.systolicBP)")
            mewsSlider(label: "Temperature (°C)", autoKey: "temperature",
                       value: $mewsI.temperature, in: 33.0...42.0, step: 0.1,
                       display: String(format: "%.1f°C", mewsI.temperature))
            mewsPickerRow(label: "AVPU — Consciousness", autoKey: "consciousnessAVPU") {
                Picker("AVPU", selection: $mewsI.consciousnessAVPU) {
                    Text("Alert (0)").tag(MEWSInput.AVPULevel.alert)
                    Text("Voice (1)").tag(MEWSInput.AVPULevel.voice)
                    Text("Pain (2)").tag(MEWSInput.AVPULevel.pain)
                    Text("Unresponsive (3)").tag(MEWSInput.AVPULevel.unresponsive)
                }
                .pickerStyle(.segmented)
            }
            sectionHeader("Urine Output")
            Picker("Urine", selection: $mewsI.urineOutput) {
                Text("Normal (0)").tag(MEWSInput.UrineOutput.normal)
                Text("Low (1)").tag(MEWSInput.UrineOutput.low)
                Text("Nil <10mL/hr (2)").tag(MEWSInput.UrineOutput.nil_)
            }
            .pickerStyle(.segmented)

            Divider().padding(.vertical, 4)
            Button(action: saveMEWSToVitals) {
                Label(
                    mewsSaved ? "Saved to vitals" : "Save readings to Vitals",
                    systemImage: mewsSaved ? "checkmark.circle.fill" : "waveform.path.ecg.rectangle"
                )
                .font(.subheadline.weight(.medium))
                .foregroundStyle(mewsSaved ? .green : .teal)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    (mewsSaved ? Color.green : Color.teal).opacity(0.1),
                    in: RoundedRectangle(cornerRadius: 10)
                )
            }
            .buttonStyle(.plain)
            .disabled(mewsSaved)
            .animation(.easeInOut(duration: 0.2), value: mewsSaved)
        }
        .onChange(of: mewsI) { _, _ in mewsSaved = false; recalculate() }
    }

    private func mewsSlider(label: String, autoKey: String,
                             value: Binding<Double>, in range: ClosedRange<Double>,
                             step: Double.Stride, display: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary).textCase(.uppercase)
                if autoFill.isAuto(autoKey) {
                    HStack(spacing: 3) {
                        Image(systemName: "wand.and.stars").font(.system(size: 8))
                        Text("Auto").font(.system(size: 8, weight: .semibold))
                    }
                    .foregroundStyle(.teal)
                    .padding(.horizontal, 4).padding(.vertical, 1)
                    .background(.teal.opacity(0.12), in: Capsule())
                }
            }
            HStack {
                Slider(value: value, in: range, step: step)
                    .tint(autoFill.isAuto(autoKey) ? .teal : AMColor.accent)
                Text(display).font(.caption.monospacedDigit()).frame(width: 54, alignment: .trailing)
            }
        }
    }

    private func mewsPickerRow<C: View>(label: String, autoKey: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary).textCase(.uppercase)
                if autoFill.isAuto(autoKey) {
                    HStack(spacing: 3) {
                        Image(systemName: "wand.and.stars").font(.system(size: 8))
                        Text("Auto").font(.system(size: 8, weight: .semibold))
                    }
                    .foregroundStyle(.teal)
                    .padding(.horizontal, 4).padding(.vertical, 1)
                    .background(.teal.opacity(0.12), in: Capsule())
                }
            }
            content()
        }
    }

    // MARK: - GCS

    private var gcsForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Eye Opening")
            Picker("Eye", selection: $gcsI.eyeOpening) {
                Text("Spontaneous (4)").tag(GCSInput.EyeScore.spontaneous)
                Text("To Voice (3)").tag(GCSInput.EyeScore.toVoice)
                Text("To Pain (2)").tag(GCSInput.EyeScore.toPain)
                Text("None (1)").tag(GCSInput.EyeScore.none)
            }
            .pickerStyle(.segmented)
            sectionHeader("Verbal Response")
            Picker("Verbal", selection: $gcsI.verbalResponse) {
                Text("Oriented (5)").tag(GCSInput.VerbalScore.oriented)
                Text("Confused (4)").tag(GCSInput.VerbalScore.confused)
                Text("Words (3)").tag(GCSInput.VerbalScore.inappropriateWords)
                Text("Sounds (2)").tag(GCSInput.VerbalScore.sounds)
                Text("None (1)").tag(GCSInput.VerbalScore.none)
            }
            .pickerStyle(.wheel)
            .frame(height: 100)
            sectionHeader("Motor Response")
            Picker("Motor", selection: $gcsI.motorResponse) {
                Text("Obeys (6)").tag(GCSInput.MotorScore.obeys)
                Text("Localises (5)").tag(GCSInput.MotorScore.localises)
                Text("Withdraws (4)").tag(GCSInput.MotorScore.withdraws)
                Text("Flexion (3)").tag(GCSInput.MotorScore.abnormalFlexion)
                Text("Extension (2)").tag(GCSInput.MotorScore.extension_)
                Text("None (1)").tag(GCSInput.MotorScore.none)
            }
            .pickerStyle(.wheel)
            .frame(height: 100)
        }
        .onChange(of: gcsI) { _, _ in recalculate() }
    }

    // MARK: - ASA

    private var asaForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("ASA Physical Status Class")
            ForEach(ASAInput.ASAClass.allCases, id: \.rawValue) { c in
                let desc: String = switch c {
                case .i:   "I — Healthy, no systemic disease"
                case .ii:  "II — Mild systemic disease, well controlled"
                case .iii: "III — Severe systemic disease"
                case .iv:  "IV — Severe disease, constant threat to life"
                case .v:   "V — Moribund, not expected to survive without surgery"
                }
                Button {
                    asaI.asaClass = c
                    recalculate()
                } label: {
                    HStack {
                        Image(systemName: asaI.asaClass == c ? "largecircle.fill.circle" : "circle")
                            .foregroundStyle(asaI.asaClass == c ? AMColor.accent : .secondary)
                        Text(desc).font(.subheadline).foregroundStyle(.primary)
                        Spacer()
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - MELD

    private var meldForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Bilirubin (mg/dL)")
            HStack {
                Slider(value: $meldI.bilirubinMgDL, in: 0.1...40.0, step: 0.1)
                Text(String(format: "%.1f", meldI.bilirubinMgDL)).font(.caption.monospacedDigit()).frame(width: 44, alignment: .trailing)
            }
            sectionHeader("Creatinine (mg/dL)")
            HStack {
                Slider(value: $meldI.creatinineMgDL, in: 0.1...10.0, step: 0.1)
                Text(String(format: "%.1f", meldI.creatinineMgDL)).font(.caption.monospacedDigit()).frame(width: 44, alignment: .trailing)
            }
            sectionHeader("INR")
            HStack {
                Slider(value: $meldI.inrValue, in: 0.8...8.0, step: 0.1)
                Text(String(format: "%.1f", meldI.inrValue)).font(.caption.monospacedDigit()).frame(width: 44, alignment: .trailing)
            }
            sectionHeader("Sodium (mmol/L)")
            HStack {
                Slider(value: $meldI.sodiumMmolL, in: 110.0...145.0, step: 1)
                Text("\(Int(meldI.sodiumMmolL)) mmol/L").font(.caption.monospacedDigit()).frame(width: 80, alignment: .trailing)
            }
            scoreToggle("On dialysis (creatinine capped at 4.0)", binding: $meldI.onDialysis, points: "")
        }
        .onChange(of: meldI) { _, _ in recalculate() }
    }

    // MARK: - CHA₂DS₂-VASc

    private var cha2ds2vascForm: some View {
        Group {
            scoreToggle("Congestive heart failure",                  binding: $cha2I.congestiveHeartFailure, points: "+1", autoKey: "congestiveHeartFailure")
            scoreToggle("Hypertension (treated or BP >140/90)",      binding: $cha2I.hypertension,           points: "+1", autoKey: "hypertension")
            scoreToggle("Age ≥75 years",                             binding: $cha2I.ageOver75,              points: "+2", autoKey: "ageOver75")
            scoreToggle("Age 65–74 years (if not ≥75)",              binding: $cha2I.age65to74,              points: "+1", autoKey: "age65to74")
            scoreToggle("Diabetes mellitus",                         binding: $cha2I.diabetes,               points: "+1", autoKey: "diabetes")
            scoreToggle("Stroke / TIA / thromboembolism",            binding: $cha2I.strokeOrTIA,            points: "+2", autoKey: "strokeOrTIA")
            scoreToggle("Vascular disease (MI, PAD, aortic plaque)", binding: $cha2I.vascularDisease,        points: "+1", autoKey: "vascularDisease")
            scoreToggle("Female sex",                                 binding: $cha2I.femaleSex,              points: "+1", autoKey: "femaleSex")
        }
        .onChange(of: cha2I) { _, _ in recalculate() }
    }

    // MARK: - HAS-BLED

    private var hasBledForm: some View {
        Group {
            scoreToggle("H — Hypertension uncontrolled (SBP >160)",                     binding: $hblI.hypertensionUncontrolled, points: "+1", autoKey: "hypertensionUncontrolled")
            scoreToggle("A — Abnormal renal function (dialysis / Cr >200 μmol/L)",      binding: $hblI.renalDysfunction,         points: "+1", autoKey: "renalDysfunction")
            scoreToggle("A — Abnormal liver function (cirrhosis / bili ×2 / AST ×3)",   binding: $hblI.liverDysfunction,         points: "+1", autoKey: "liverDysfunction")
            scoreToggle("S — Stroke history",                                            binding: $hblI.strokeHistory,            points: "+1", autoKey: "strokeHistory")
            scoreToggle("B — Bleeding (prior or predisposition)",                        binding: $hblI.priorBleeding,            points: "+1", autoKey: "priorBleeding")
            scoreToggle("L — Labile INR (TTR <60%)",                                    binding: $hblI.labileINR,                points: "+1", autoKey: "labileINR")
            scoreToggle("E — Elderly (age >65)",                                         binding: $hblI.ageOver65,                points: "+1", autoKey: "ageOver65")
            scoreToggle("D — Drugs (antiplatelets / NSAIDs)",                            binding: $hblI.drugsOrAlcohol,           points: "+1", autoKey: "drugsOrAlcohol")
            scoreToggle("D — Alcohol (≥8 units/week)",                                  binding: $hblI.alcoholUse,               points: "+1", autoKey: "alcoholUse")
        }
        .onChange(of: hblI) { _, _ in recalculate() }
    }

    // MARK: - Glasgow-Blatchford

    private var blatchfordForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            scoreToggle("Patient is male", binding: $blatchI.isMale, points: "")

            sectionHeader("Blood Urea Nitrogen")
            Picker("BUN", selection: $blatchI.bloodUreaNitrogen) {
                Text("<6.5 mmol/L (0)").tag(BlatchfordInput.BlatchfordBUN.under6_5)
                Text("6.5–7.9 (2)").tag(BlatchfordInput.BlatchfordBUN.bun6_5to7_9)
                Text("8–9.9 (3)").tag(BlatchfordInput.BlatchfordBUN.bun8to9_9)
                Text("10–24.9 (4)").tag(BlatchfordInput.BlatchfordBUN.bun10to24_9)
                Text("≥25 (6)").tag(BlatchfordInput.BlatchfordBUN.bunOver25)
            }
            .pickerStyle(.wheel)
            .frame(height: 100)

            sectionHeader("Haemoglobin")
            if blatchI.isMale {
                Picker("Hb (male)", selection: $blatchI.haemoglobin) {
                    Text("≥13 g/dL (0)").tag(BlatchfordInput.BlatchfordHb.male13plus)
                    Text("12–12.9 (1)").tag(BlatchfordInput.BlatchfordHb.male12to12_9)
                    Text("10–11.9 (3)").tag(BlatchfordInput.BlatchfordHb.male10to11_9)
                    Text("<10 (6)").tag(BlatchfordInput.BlatchfordHb.maleSub10)
                }
                .pickerStyle(.segmented)
            } else {
                Picker("Hb (female)", selection: $blatchI.haemoglobin) {
                    Text("≥12 g/dL (0)").tag(BlatchfordInput.BlatchfordHb.female12plus)
                    Text("10–11.9 (1)").tag(BlatchfordInput.BlatchfordHb.female10to11_9)
                    Text("<10 (6)").tag(BlatchfordInput.BlatchfordHb.femaleSub10)
                }
                .pickerStyle(.segmented)
            }

            sectionHeader("Systolic BP")
            Picker("SBP", selection: $blatchI.sbp) {
                Text(">109 mmHg (0)").tag(BlatchfordInput.BlatchfordSBP.over109)
                Text("100–109 (1)").tag(BlatchfordInput.BlatchfordSBP.sbp100to109)
                Text("90–99 (2)").tag(BlatchfordInput.BlatchfordSBP.sbp90to99)
                Text("<90 (3)").tag(BlatchfordInput.BlatchfordSBP.under90)
            }
            .pickerStyle(.segmented)

            scoreToggle("Heart rate >100 bpm", binding: $blatchI.heartRateOver100, points: "+1")
            scoreToggle("Melaena on presentation", binding: $blatchI.melaena, points: "+1")
            scoreToggle("Syncope", binding: $blatchI.syncope, points: "+2")
            scoreToggle("Hepatic disease", binding: $blatchI.hepaticDisease, points: "+2")
            scoreToggle("Cardiac failure", binding: $blatchI.cardiacFailure, points: "+2")
        }
        .onChange(of: blatchI) { _, _ in recalculate() }
    }

    // MARK: - STOP-BANG

    private var stopBangForm: some View {
        Group {
            scoreToggle("S — Snoring loudly",                          binding: $sbangI.snoring,         points: "+1", autoKey: "snoring")
            scoreToggle("T — Tired / fatigued during day",             binding: $sbangI.tired,           points: "+1", autoKey: "tired")
            scoreToggle("O — Observed apnoea (partner / witness)",     binding: $sbangI.observed,        points: "+1", autoKey: "observed")
            scoreToggle("P — Pressure / hypertension (treated or >140/90)", binding: $sbangI.pressureTreated, points: "+1", autoKey: "pressureTreated")
            scoreToggle("B — BMI >35 kg/m²",                          binding: $sbangI.bmiOver35,       points: "+1", autoKey: "bmiOver35")
            scoreToggle("A — Age >50 years",                          binding: $sbangI.ageOver50,       points: "+1", autoKey: "ageOver50")
            scoreToggle("N — Neck circumference >40 cm",              binding: $sbangI.neckOver40cm,    points: "+1", autoKey: "neckOver40cm")
            scoreToggle("G — Gender: male",                           binding: $sbangI.male,            points: "+1", autoKey: "male")
        }
        .onChange(of: sbangI) { _, _ in recalculate() }
    }

    // MARK: - Pending variables panel

    @ViewBuilder private var pendingVariablesPanel: some View {
        if autoFill.hasPending {
            VStack(alignment: .leading, spacing: 8) {
                Label("Variables to confirm", systemImage: "checklist.unchecked")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
                ForEach(autoFill.pendingFields) { field in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "questionmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(field.label)
                                .font(.caption)
                                .foregroundStyle(.primary)
                            Text(field.source)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                }
            }
            .padding(10)
            .background(.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.orange.opacity(0.3), lineWidth: 1))
            .padding(.bottom, 8)
        }
    }

    // MARK: - Shared helpers

    private func scoreToggle(_ label: String, binding: Binding<Bool>, points: String, autoKey: String? = nil) -> some View {
        let isAuto = autoKey.map { autoFill.isAuto($0) } ?? false
        return Toggle(isOn: binding) {
            HStack(spacing: 6) {
                Text(label)
                    .font(.subheadline)
                if isAuto {
                    HStack(spacing: 3) {
                        Image(systemName: "wand.and.stars")
                            .font(.system(size: 9))
                        Text("Auto")
                            .font(.system(size: 9, weight: .semibold))
                    }
                    .foregroundStyle(.teal)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(.teal.opacity(0.12), in: Capsule())
                }
                Spacer()
                Text(points)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(binding.wrappedValue ? (isAuto ? .teal : AMColor.accent) : .secondary)
            }
        }
        .toggleStyle(.switch)
        .tint(isAuto ? .teal : AMColor.accent)
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
