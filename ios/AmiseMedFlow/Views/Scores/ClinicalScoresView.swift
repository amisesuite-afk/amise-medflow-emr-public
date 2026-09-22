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
    case news2            = "NEWS2 (National Early Warning)"
    case psiPort          = "PSI/PORT (Pneumonia Severity)"
    case bisap            = "BISAP (Pancreatitis Severity)"
    case aims65           = "AIMS65 (UGI Bleed Mortality)"
    case sofa             = "SOFA (Organ Failure)"
    case fib4             = "FIB-4 (Liver Fibrosis)"
    case curb65           = "CURB-65 (CAP Severity)"
    case padua            = "Padua (Medical VTE Risk)"
    case apacheII         = "APACHE II (ICU Severity)"
    case ppossum          = "P-POSSUM (Surgical Risk)"
    case mpi              = "Mannheim Peritonitis Index"
    case ctsi             = "CT Severity Index (Pancreatitis)"
    case nrs2002          = "NRS-2002 (Nutritional Risk)"
    case forrest          = "Forrest Classification"
    case heart            = "HEART Score (Chest Pain)"
    case mallampati       = "Mallampati Airway Class"
    case cfs              = "Clinical Frailty Scale"
    case timi             = "TIMI (UA/NSTEMI Risk)"
    case waterlow         = "Waterlow Pressure Ulcer Risk"
    case surgicalApgar    = "Surgical Apgar Score"
    case grace            = "GRACE Score (ACS)"
    case dasi             = "DASI (Functional Capacity)"
    case barthel          = "Barthel Index (ADL)"
    case euroScoreII      = "EuroSCORE II (Cardiac Surgery)"
    case nihss            = "NIHSS (Stroke Severity)"
    case mrs              = "modified Rankin Scale (Disability)"
    case must             = "MUST (Malnutrition Risk)"
    case clavienDindo     = "Clavien-Dindo (Complication Grade)"
    case aldrete          = "Modified Aldrete (PACU Recovery)"
    case fourT            = "4T Score (HIT Probability)"
    case oakland          = "Oakland Score (LGIB Discharge)"
    case kingsCriteria    = "King's College Criteria (ALF)"
    case ecog             = "ECOG Performance Status"
    case rts              = "Revised Trauma Score"
    case kdigo            = "KDIGO AKI Staging"
    case baux             = "Baux Score"
    case iss              = "Injury Severity Score"
    case nutric           = "NUTRIC Score"
    case spesi            = "sPESI (PE Severity)"
    case decaf            = "DECAF (COPD Exacerbation)"
    case hinchey          = "Hinchey (Diverticulitis)"

    var category: ScoreCategory {
        switch self {
        case .alvarado, .tokyoChole, .tokyoCholang, .ranson, .glasgow, .bisap, .mpi, .ctsi:
            return .acute
        case .rockall, .blatchford, .aims65, .forrest:
            return .gi
        case .wellsDVT, .wellsPE, .caprini, .padua:
            return .vascular
        case .sirs, .qsofa, .psiPort, .sofa, .curb65, .apacheII:
            return .sepsis
        case .rcri, .asa, .childPugh, .meld, .stopBang, .fib4, .ppossum, .nrs2002, .mallampati, .cfs, .dasi, .barthel, .euroScoreII:
            return .preop
        case .abcd2, .lrinec, .gcs, .nihss, .mrs:
            return .neuro
        case .must:
            return .preop
        case .clavienDindo, .aldrete:
            return .monitoring
        case .fourT:
            return .vascular
        case .oakland:
            return .gi
        case .kingsCriteria:
            return .gi
        case .ecog:
            return .preop
        case .rts:
            return .acute
        case .kdigo:
            return .sepsis
        case .baux:
            return .acute
        case .iss:
            return .acute
        case .nutric:
            return .sepsis
        case .spesi:
            return .vascular
        case .decaf:
            return .sepsis
        case .hinchey:
            return .acute
        case .cha2ds2vasc, .hasBled, .heart, .timi, .grace:
            return .cardiac
        case .mews, .news2, .waterlow, .surgicalApgar:
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
        case .news2:          return "waveform.path.ecg.rectangle.fill"
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
        case .psiPort:        return "lungs"
        case .bisap:          return "flame.fill"
        case .aims65:         return "drop.triangle.fill"
        case .sofa:           return "bolt.heart.fill"
        case .fib4:           return "liver"
        case .curb65:         return "lungs.fill"
        case .padua:          return "figure.walk"
        case .apacheII:       return "cross.circle.fill"
        case .ppossum:        return "scissors"
        case .mpi:            return "cross.circle"
        case .ctsi:           return "photo.on.rectangle"
        case .nrs2002:        return "fork.knife"
        case .forrest:        return "eye.circle"
        case .heart:          return "heart.text.clipboard"
        case .mallampati:     return "mouth"
        case .cfs:            return "figure.walk.circle"
        case .timi:           return "waveform.path.ecg.rectangle"
        case .waterlow:       return "bed.double"
        case .surgicalApgar:  return "cross.case"
        case .grace:          return "chart.line.uptrend.xyaxis"
        case .dasi:           return "figure.run"
        case .barthel:        return "figure.roll"
        case .euroScoreII:    return "heart.text.clipboard.fill"
        case .nihss:          return "brain"
        case .mrs:            return "figure.roll"
        case .must:           return "fork.knife.circle"
        case .clavienDindo:   return "bandage.fill"
        case .aldrete:        return "bed.double.fill"
        case .fourT:          return "syringe.fill"
        case .oakland:        return "drop.degreesign.fill"
        case .kingsCriteria:  return "staroflife.circle.fill"
        case .ecog:           return "figure.stand"
        case .rts:            return "cross.case.circle.fill"
        case .kdigo:          return "drop.circle.fill"
        case .baux:           return "flame.circle.fill"
        case .iss:            return "bandage.fill"
        case .nutric:         return "fork.knife.circle.fill"
        case .spesi:          return "lungs.fill"
        case .decaf:          return "wind"
        case .hinchey:        return "cross.circle.fill"
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
    // NEWS2
    @State private var news2I = NEWS2Input()
    // PSI/PORT
    @State private var psiI = PSIPortInput()
    // BISAP
    @State private var bisapI = ClinicalScoringEngine.BISAPInput()
    // AIMS65
    @State private var aims65I = ClinicalScoringEngine.AIMS65Input()
    // SOFA
    @State private var sofaI = SOFAInput()
    // FIB-4
    @State private var fib4I = FIB4Input()
    // CURB-65
    @State private var curb65I = CURB65Input()
    // Padua
    @State private var paduaI = PaduaInput()
    // APACHE II
    @State private var apacheIII = APACHEIIInput()
    // P-POSSUM
    @State private var ppossumI = PPOSSUMInput()
    // MPI
    @State private var mpiI = MPIInput()
    // CTSI
    @State private var ctsiI = CTSIInput()
    // NRS-2002
    @State private var nrsI = NRS2002Input()
    // Forrest Classification
    @State private var forrestI = ForrestInput()
    // HEART Score
    @State private var heartI = HEARTInput()
    // Mallampati Airway
    @State private var mallampatiI = MallampatiInput()
    // Clinical Frailty Scale
    @State private var cfsI = ClinicalFrailtyInput()
    // TIMI
    @State private var timiI = TIMIInput()
    // Waterlow
    @State private var waterlowI = WaterlowInput()
    // Surgical Apgar Score
    @State private var surgApgarI = SurgicalApgarInput()
    // GRACE Score
    @State private var graceI = GRACEInput()
    // DASI
    @State private var dasiI = DASIInput()
    // Barthel Index
    @State private var barthelI = BarthelInput()
    // EuroSCORE II
    @State private var euroScI = EuroScoreIIInput()
    // NIHSS
    @State private var nihssI = NIHSSInput()
    // mRS
    @State private var mrsI = MRSInput()
    // MUST
    @State private var mustI = ClinicalScoringEngine.MUSTInput()
    // Clavien-Dindo
    @State private var cdI = ClinicalScoringEngine.ClavienDindoInput()
    // Aldrete
    @State private var aldreteI = ClinicalScoringEngine.AldreteInput()
    // 4T
    @State private var fourTI = ClinicalScoringEngine.FourTInput()
    // Oakland
    @State private var oaklandI = ClinicalScoringEngine.OaklandInput()
    // King's Criteria
    @State private var kingsI = ClinicalScoringEngine.KingsCriteriaInput()
    // ECOG
    @State private var ecogI = ClinicalScoringEngine.ECOGInput()
    // RTS
    @State private var rtsI = ClinicalScoringEngine.RTSInput()
    // KDIGO AKI
    @State private var kdigoI = ClinicalScoringEngine.KDIGOInput()
    // Baux Score
    @State private var bauxI = ClinicalScoringEngine.BauxInput()
    // ISS
    @State private var issI = ClinicalScoringEngine.ISSInput()
    // NUTRIC
    @State private var nutricI = ClinicalScoringEngine.NUTRICInput()
    // sPESI
    @State private var spesiI = ClinicalScoringEngine.SPESIInput()
    // DECAF
    @State private var decafI = ClinicalScoringEngine.DECAFInput()
    // Hinchey
    @State private var hincheyI = ClinicalScoringEngine.HincheyInput()

    // Auto-population tracking
    @State private var autoFill = ScoreAutoFill()
    @State private var mewsSaved = false
    @State private var news2Saved = false
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

            // Score history for current system
            let history = patient.scoreHistory
                .filter { $0.scoreName == r.systemName }
                .sorted { $0.recordedAt > $1.recordedAt }
                .prefix(5)
            if !history.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Recent saves")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ForEach(Array(history), id: \.id) { entry in
                        HStack {
                            Text(entry.abbreviation)
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(scoreHistoryColor(entry.riskRaw))
                            Text("— \(entry.riskRaw)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(entry.recordedAt, style: .date)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
                .padding(10)
                .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
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
        news2Saved = false
        scoreSaved = false
        switch score {
        case .alvarado:
            let (input, fill) = PatientScoreAutoPopulator.alvarado(patient: patient)
            alv = input; autoFill = fill
        case .tokyoChole:
            let (input, fill) = PatientScoreAutoPopulator.tokyoCholecystitis(patient: patient)
            tkyC = input; autoFill = fill
        case .tokyoCholang:
            let (input, fill) = PatientScoreAutoPopulator.tokyoCholangitis(patient: patient)
            tkyG = input; autoFill = fill
        case .blatchford:
            let (input, fill) = PatientScoreAutoPopulator.blatchford(patient: patient)
            blatchI = input; autoFill = fill
        case .news2:
            let (input, fill) = PatientScoreAutoPopulator.news2(patient: patient)
            news2I = input; autoFill = fill
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
        case .psiPort:
            let (input, fill) = PatientScoreAutoPopulator.psiPort(patient: patient)
            psiI = input; autoFill = fill
        case .bisap:
            let (input, fill) = PatientScoreAutoPopulator.bisap(patient: patient)
            bisapI = input; autoFill = fill
        case .aims65:
            let (input, fill) = PatientScoreAutoPopulator.aims65(patient: patient)
            aims65I = input; autoFill = fill
        case .sofa:
            let (input, fill) = PatientScoreAutoPopulator.sofa(patient: patient)
            sofaI = input; autoFill = fill
        case .fib4:
            let (input, fill) = PatientScoreAutoPopulator.fib4(patient: patient)
            fib4I = input; autoFill = fill
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
        case .meld:
            let (input, fill) = PatientScoreAutoPopulator.meld(patient: patient)
            meldI = input; autoFill = fill
        case .sirs:
            let (input, fill) = PatientScoreAutoPopulator.sirs(patient: patient)
            sirsI = input; autoFill = fill
        case .qsofa:
            let (input, fill) = PatientScoreAutoPopulator.qsofa(patient: patient)
            qsofaI = input; autoFill = fill
        case .childPugh:
            let (input, fill) = PatientScoreAutoPopulator.childPugh(patient: patient)
            cp = input; autoFill = fill
        case .lrinec:
            let (input, fill) = PatientScoreAutoPopulator.lrinec(patient: patient)
            lrin = input; autoFill = fill
        case .ranson:
            let (input, fill) = PatientScoreAutoPopulator.ranson(patient: patient)
            ran = input; autoFill = fill
        case .glasgow:
            let (input, fill) = PatientScoreAutoPopulator.glasgowPancreatitis(patient: patient)
            glas = input; autoFill = fill
        case .curb65:
            let (input, fill) = PatientScoreAutoPopulator.curb65(patient: patient)
            curb65I = input; autoFill = fill
        case .padua:
            let (input, fill) = PatientScoreAutoPopulator.padua(patient: patient)
            paduaI = input; autoFill = fill
        case .apacheII:
            let (input, fill) = PatientScoreAutoPopulator.apacheII(patient: patient)
            apacheIII = input; autoFill = fill
        case .ppossum:
            let (input, fill) = PatientScoreAutoPopulator.ppossum(patient: patient)
            ppossumI = input; autoFill = fill
        case .mpi:
            let (input, fill) = PatientScoreAutoPopulator.mpi(patient: patient)
            mpiI = input; autoFill = fill
        case .ctsi:
            let (input, fill) = PatientScoreAutoPopulator.ctsi(patient: patient)
            ctsiI = input; autoFill = fill
        case .nrs2002:
            let (input, fill) = PatientScoreAutoPopulator.nrs2002(patient: patient)
            nrsI = input; autoFill = fill
        case .forrest:
            let (input, fill) = PatientScoreAutoPopulator.forrest(patient: patient)
            forrestI = input; autoFill = fill
        case .heart:
            let (input, fill) = PatientScoreAutoPopulator.heart(patient: patient)
            heartI = input; autoFill = fill
        case .mallampati:
            let (input, fill) = PatientScoreAutoPopulator.mallampati(patient: patient)
            mallampatiI = input; autoFill = fill
        case .cfs:
            let (input, fill) = PatientScoreAutoPopulator.cfs(patient: patient)
            cfsI = input; autoFill = fill
        case .timi:
            let (input, fill) = PatientScoreAutoPopulator.timi(patient: patient)
            timiI = input; autoFill = fill
        case .waterlow:
            let (input, fill) = PatientScoreAutoPopulator.waterlow(patient: patient)
            waterlowI = input; autoFill = fill
        case .surgicalApgar:
            let (input, fill) = PatientScoreAutoPopulator.surgicalApgar(patient: patient)
            surgApgarI = input; autoFill = fill
        case .grace:
            let (input, fill) = PatientScoreAutoPopulator.grace(patient: patient)
            graceI = input; autoFill = fill
        case .dasi:
            let (input, fill) = PatientScoreAutoPopulator.dasi(patient: patient)
            dasiI = input; autoFill = fill
        case .barthel:
            let (input, fill) = PatientScoreAutoPopulator.barthel(patient: patient)
            barthelI = input; autoFill = fill
        case .euroScoreII:
            let (input, fill) = PatientScoreAutoPopulator.euroScoreII(patient: patient)
            euroScI = input; autoFill = fill
        case .nihss:
            let (input, fill) = PatientScoreAutoPopulator.nihss(patient: patient)
            nihssI = input; autoFill = fill
        case .must:
            let (input, fill) = PatientScoreAutoPopulator.must(patient: patient)
            mustI = input; autoFill = fill
        case .clavienDindo:
            // Clavien-Dindo grade is recorded post-operatively — no auto-populate from text
            autoFill = ScoreAutoFill()
        case .aldrete:
            // Aldrete is a bedside recovery assessment — no clinical-text auto-populate
            autoFill = ScoreAutoFill()
        case .fourT:
            let (input, fill) = PatientScoreAutoPopulator.fourT(patient: patient)
            fourTI = input; autoFill = fill
        case .oakland:
            let (input, fill) = PatientScoreAutoPopulator.oakland(patient: patient)
            oaklandI = input; autoFill = fill
        case .kingsCriteria:
            let (input, fill) = PatientScoreAutoPopulator.kingsCriteria(patient: patient)
            kingsI = input; autoFill = fill
        case .ecog:
            let (input, fill) = PatientScoreAutoPopulator.ecog(patient: patient)
            ecogI = input; autoFill = fill
        case .rts:
            let (input, fill) = PatientScoreAutoPopulator.rts(patient: patient)
            rtsI = input; autoFill = fill
        case .kdigo:
            let (input, fill) = PatientScoreAutoPopulator.kdigo(patient: patient)
            kdigoI = input; autoFill = fill
        case .baux:
            let (input, fill) = PatientScoreAutoPopulator.baux(patient: patient)
            bauxI = input; autoFill = fill
        case .iss:
            let (input, fill) = PatientScoreAutoPopulator.iss(patient: patient)
            issI = input; autoFill = fill
        case .nutric:
            let (input, fill) = PatientScoreAutoPopulator.nutric(patient: patient)
            nutricI = input; autoFill = fill
        case .spesi:
            let (input, fill) = PatientScoreAutoPopulator.spesi(patient: patient)
            spesiI = input; autoFill = fill
        case .decaf:
            let (input, fill) = PatientScoreAutoPopulator.decaf(patient: patient)
            decafI = input; autoFill = fill
        case .hinchey:
            let (input, fill) = PatientScoreAutoPopulator.hinchey(patient: patient)
            hincheyI = input; autoFill = fill
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
        // Persist to score history
        let entry = ScoreHistoryEntry(
            scoreName: r.systemName,
            abbreviation: r.abbreviation,
            scoreValue: r.score,
            maxScore: r.maxScore,
            riskRaw: r.risk.rawValue
        )
        entry.patient = patient
        modelContext.insert(entry)
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
        case .news2:        ClinicalScoringEngine.news2(news2I)
        case .psiPort:      ClinicalScoringEngine.psiPort(psiI)
        case .bisap:        ClinicalScoringEngine.bisap(bisapI)
        case .aims65:       ClinicalScoringEngine.aims65(aims65I)
        case .sofa:         ClinicalScoringEngine.sofa(sofaI)
        case .fib4:         ClinicalScoringEngine.fib4(fib4I)
        case .curb65:       ClinicalScoringEngine.curb65(curb65I)
        case .padua:        ClinicalScoringEngine.padua(paduaI)
        case .apacheII:     ClinicalScoringEngine.apacheII(apacheIII)
        case .ppossum:      ClinicalScoringEngine.ppossum(ppossumI)
        case .mpi:          ClinicalScoringEngine.mpi(mpiI)
        case .ctsi:         ClinicalScoringEngine.ctsi(ctsiI)
        case .nrs2002:      ClinicalScoringEngine.nrs2002(nrsI)
        case .forrest:      ClinicalScoringEngine.forrest(forrestI)
        case .heart:        ClinicalScoringEngine.heart(heartI)
        case .mallampati:   ClinicalScoringEngine.mallampati(mallampatiI)
        case .cfs:          ClinicalScoringEngine.clinicalFrailty(cfsI)
        case .timi:         ClinicalScoringEngine.timi(timiI)
        case .waterlow:     ClinicalScoringEngine.waterlow(waterlowI)
        case .surgicalApgar: ClinicalScoringEngine.surgicalApgar(surgApgarI)
        case .grace:         ClinicalScoringEngine.grace(graceI)
        case .dasi:          ClinicalScoringEngine.dasi(dasiI)
        case .barthel:       ClinicalScoringEngine.barthel(barthelI)
        case .euroScoreII:   ClinicalScoringEngine.euroScoreII(euroScI)
        case .nihss:         ClinicalScoringEngine.nihss(nihssI)
        case .mrs:           ClinicalScoringEngine.mRS(mrsI)
        case .must:          ClinicalScoringEngine.must(mustI)
        case .clavienDindo:  ClinicalScoringEngine.clavienDindo(cdI)
        case .aldrete:       ClinicalScoringEngine.aldrete(aldreteI)
        case .fourT:         ClinicalScoringEngine.fourT(fourTI)
        case .oakland:       ClinicalScoringEngine.oakland(oaklandI)
        case .kingsCriteria: ClinicalScoringEngine.kingsCriteria(kingsI)
        case .ecog:          ClinicalScoringEngine.ecog(ecogI)
        case .rts:           ClinicalScoringEngine.rts(rtsI)
        case .kdigo:         ClinicalScoringEngine.kdigo(kdigoI)
        case .baux:          ClinicalScoringEngine.baux(bauxI)
        case .iss:           ClinicalScoringEngine.iss(issI)
        case .nutric:        ClinicalScoringEngine.nutric(nutricI)
        case .spesi:         ClinicalScoringEngine.spesi(spesiI)
        case .decaf:         ClinicalScoringEngine.decaf(decafI)
        case .hinchey:       ClinicalScoringEngine.hinchey(hincheyI)
        }
        // Feed score results back to Bayesian engine via patient model fields.
        // Each score is stored once computed so the pipeline can apply post-hoc
        // adjustments on every subsequent infer() call without re-entering the score.
        guard let r = result else { return }
        let intScore = Int(r.score)
        switch score {
        case .alvarado:     patient.alvaradoScore            = intScore
        case .glasgow:      patient.glasgowPancreatitisScore = intScore
        case .ranson:       patient.ransonScore              = intScore
        case .tokyoChole:   patient.tokyoCholecystitisGrade  = intScore
        case .tokyoCholang: patient.tokyoCholangitisGrade    = intScore
        case .rockall:      patient.rockallScore             = intScore
        case .blatchford:   patient.blatchfordScore          = intScore
        case .wellsDVT:     patient.wellsDVTScore            = r.score
        case .wellsPE:      patient.wellsPEScore             = r.score
        case .abcd2:        patient.abcd2Score               = intScore
        case .lrinec:       patient.lrinecScore              = intScore
        case .qsofa:        patient.qsofaScore               = intScore
        case .psiPort:
            // Store the PSI class (1–5) extracted from the abbreviation string
            patient.psiScore = Int(r.abbreviation.components(separatedBy: "Class ").last ?? "") ?? 0
        case .bisap:        patient.bisapScore  = intScore
        case .aims65:       patient.aims65Score = intScore
        case .sofa:         patient.sofaScore   = intScore
        case .fib4:         patient.fib4Score   = r.score
        case .curb65:       patient.curb65Score   = intScore
        case .padua:        patient.paduaScore    = intScore
        case .apacheII:     patient.apacheIIScore    = intScore
        case .ppossum:      patient.ppossumMortPct10 = Int(r.score * 10)
        case .mpi:          patient.mpiScore = intScore
        case .ctsi:         patient.ctsiScore = intScore
        case .nrs2002:      patient.nrs2002Score = intScore
        case .forrest:      patient.forrestGrade = intScore
        case .heart:        patient.heartScore = intScore
        case .mallampati:   patient.mallampatiScore = intScore
        case .cfs:          patient.cfsScore = intScore
        case .timi:         patient.timiScore = intScore
        case .waterlow:     patient.waterlowScore = intScore
        case .surgicalApgar: patient.surgicalApgarScore = intScore
        case .grace:         patient.graceScore = intScore
        case .dasi:          patient.dasiScore = intScore
        case .barthel:       patient.barthelScore = intScore
        case .euroScoreII:   patient.euroScoreII = Int((r.score * 10).rounded())
        case .nihss:         patient.nihssScore = intScore
        case .mrs:           patient.mrsScore = intScore
        case .must:          patient.mustScore = intScore
        case .clavienDindo:  patient.clavienDindoScore = intScore
        case .aldrete:       patient.aldreteScore = intScore
        case .fourT:         patient.fourTScore = intScore
        case .oakland:       patient.oaklandScore = intScore
        case .kingsCriteria: patient.kingsCriteriaScore = intScore
        case .childPugh:     patient.childPughScore = intScore
        case .meld:          patient.meldScore = intScore
        case .asa:           patient.asaScore = intScore
        case .ecog:          patient.ecogScore = intScore
        case .rts:           patient.rtsScore = Int((r.score * 100).rounded())
        case .kdigo:         patient.kdigoStage = intScore
        case .baux:          patient.bauxScore = intScore
        case .iss:           patient.issScore = intScore
        case .nutric:        patient.nutricScore = intScore
        case .spesi:         patient.spesiScore = intScore
        case .decaf:         patient.decafScore = intScore
        case .hinchey:       patient.hincheyGrade = intScore
        case .caprini:       patient.capriniScore = intScore
        default: break
        }
        patient.updatedAt = .now
        patient.pendingSync = true
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
        case .news2:        news2Form
        case .psiPort:      psiPortForm
        case .bisap:        bisapForm
        case .aims65:       aims65Form
        case .sofa:         sofaForm
        case .fib4:         fib4Form
        case .curb65:       curb65Form
        case .padua:        paduaForm
        case .apacheII:     apacheIIForm
        case .ppossum:      ppossumForm
        case .mpi:          mpiForm
        case .ctsi:         ctsiForm
        case .nrs2002:      nrs2002Form
        case .forrest:      forrestForm
        case .heart:        heartForm
        case .mallampati:   mallampatiForm
        case .cfs:          cfsForm
        case .timi:         timiForm
        case .waterlow:     waterlowForm
        case .surgicalApgar: surgicalApgarForm
        case .grace:         graceForm
        case .dasi:          dasiForm
        case .barthel:       barthelForm
        case .euroScoreII:   euroScoreIIForm
        case .nihss:         nihssForm
        case .mrs:           mrsForm
        case .must:          mustForm
        case .clavienDindo:  clavienDindoForm
        case .aldrete:       aldreteForm
        case .fourT:         fourTForm
        case .oakland:       oaklandForm
        case .kingsCriteria: kingsCriteriaForm
        case .ecog:          ecogForm
        case .rts:           rtsForm
        case .kdigo:         kdigoForm
        case .baux:          bauxForm
        case .iss:           issForm
        case .nutric:        nutricForm
        case .spesi:         spesiForm
        case .decaf:         decafForm
        case .hinchey:       hincheyForm
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

    @ViewBuilder private var tokyoCholangitisGrade1and2: some View {
        Group {
            scoreToggle("Cholangitis confirmed (Charcot's / imaging)", binding: $tkyG.cholangitisConfirmed, points: "Req.")
            sectionHeader("Grade II Criteria (any = at least Grade II)")
            scoreToggle("WBC >12k or <4k", binding: $tkyG.wbcAbove12OrBelow4, points: "II", autoKey: "wbcAbove12OrBelow4")
            scoreToggle("Temperature >39°C", binding: $tkyG.temperatureAbove39, points: "II", autoKey: "temperatureAbove39")
            scoreToggle("Age >75 years", binding: $tkyG.ageAbove75, points: "II", autoKey: "ageAbove75")
            scoreToggle("Bilirubin >85 μmol/L (>5 mg/dL)", binding: $tkyG.bilirubinAbove5, points: "II", autoKey: "bilirubinAbove5")
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
            scoreToggle("CRP >150 mg/L",           binding: $lrin.crpOver150,        points: "+4", autoKey: "crpOver150")
            scoreToggle("WBC >25 ×10⁹/L",          binding: $lrin.wbcOver25,         points: "+2", autoKey: "wbcOver25")
            scoreToggle("WBC 15–25 ×10⁹/L",        binding: $lrin.wbc15to25,         points: "+1", autoKey: "wbc15to25")
            scoreToggle("Hb <11 g/dL",             binding: $lrin.hbBelow11,         points: "+2", autoKey: "hbBelow11")
            scoreToggle("Hb 11–13.5 g/dL",         binding: $lrin.hb11to13_5,        points: "+1", autoKey: "hb11to13_5")
            scoreToggle("Sodium <135 mmol/L",       binding: $lrin.sodiumBelow135,    points: "+2", autoKey: "sodiumBelow135")
            scoreToggle("Creatinine >177 μmol/L",   binding: $lrin.creatinineOver177, points: "+4", autoKey: "creatinineOver177")
            scoreToggle("Creatinine 141–177 μmol/L",binding: $lrin.creatinine141to177,points: "+2", autoKey: "creatinine141to177")
            scoreToggle("Glucose >10 mmol/L",       binding: $lrin.glucoseOver10,     points: "+1", autoKey: "glucoseOver10")
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
            if autoFill.isAuto("bilirubinUmolL") || autoFill.isAuto("albuminGdL") || autoFill.isAuto("ptINR") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Bilirubin, albumin, and INR pre-filled from latest labs — review values.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
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

            mewsSlider(label: "Bilirubin (μmol/L)", autoKey: "bilirubinUmolL",
                       value: $cp.bilirubinUmolL, in: 0...400, step: 5,
                       display: "\(Int(cp.bilirubinUmolL)) μmol/L")
            mewsSlider(label: "Albumin (g/dL)", autoKey: "albuminGdL",
                       value: $cp.albuminGdL, in: 1.0...5.0, step: 0.1,
                       display: String(format: "%.1f g/dL", cp.albuminGdL))
            mewsSlider(label: "PT-INR", autoKey: "ptINR",
                       value: $cp.ptINR, in: 0.8...5.0, step: 0.1,
                       display: String(format: "%.1f", cp.ptINR))
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

    // MARK: - NEWS2

    private var news2Form: some View {
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
                       value: Binding(get: { Double(news2I.respiratoryRate) }, set: { news2I.respiratoryRate = Int($0) }),
                       in: 4...50, step: 1, display: "\(news2I.respiratoryRate)")
            mewsSlider(label: "SpO₂ (%)", autoKey: "spo2",
                       value: Binding(get: { Double(news2I.spo2) }, set: { news2I.spo2 = Int($0) }),
                       in: 70...100, step: 1, display: "\(news2I.spo2)%")
            scoreToggle("On supplemental oxygen", binding: $news2I.onSupplementalO2, points: "+2", autoKey: "onSupplementalO2")
            mewsSlider(label: "Systolic BP (mmHg)", autoKey: "systolicBP",
                       value: Binding(get: { Double(news2I.systolicBP) }, set: { news2I.systolicBP = Int($0) }),
                       in: 40...260, step: 2, display: "\(news2I.systolicBP)")
            mewsSlider(label: "Heart Rate (bpm)", autoKey: "heartRate",
                       value: Binding(get: { Double(news2I.heartRate) }, set: { news2I.heartRate = Int($0) }),
                       in: 20...200, step: 1, display: "\(news2I.heartRate)")
            mewsSlider(label: "Temperature (°C)", autoKey: "temperatureCelsius",
                       value: $news2I.temperatureCelsius, in: 33.0...42.0, step: 0.1,
                       display: String(format: "%.1f°C", news2I.temperatureCelsius))
            mewsPickerRow(label: "AVPU — Consciousness", autoKey: "avpu") {
                Picker("AVPU", selection: $news2I.avpu) {
                    Text("Alert (0)").tag(AVPU.alert)
                    Text("Confused (3)").tag(AVPU.confused)
                    Text("Voice (3)").tag(AVPU.voice)
                    Text("Pain (3)").tag(AVPU.pain)
                    Text("Unresponsive (3)").tag(AVPU.unresponsive)
                }
                .pickerStyle(.segmented)
            }
            Divider().padding(.vertical, 4)
            Button(action: saveNEWS2ToVitals) {
                Label(
                    news2Saved ? "Saved to vitals" : "Save readings to Vitals",
                    systemImage: news2Saved ? "checkmark.circle.fill" : "waveform.path.ecg"
                )
                .font(.subheadline.weight(.medium))
                .foregroundStyle(news2Saved ? .green : .teal)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    (news2Saved ? Color.green : Color.teal).opacity(0.1),
                    in: RoundedRectangle(cornerRadius: 10)
                )
            }
            .buttonStyle(.plain)
            .disabled(news2Saved)
            .animation(.easeInOut(duration: 0.2), value: news2Saved)
        }
        .onChange(of: news2I) { _, _ in news2Saved = false; recalculate() }
    }

    private func saveNEWS2ToVitals() {
        let entry = VitalsEntry(patient: patient)
        entry.respiratoryRate    = news2I.respiratoryRate
        entry.spo2               = news2I.spo2
        entry.bpSystolic         = news2I.systolicBP
        entry.heartRate          = news2I.heartRate
        entry.temperatureCelsius = news2I.temperatureCelsius
        entry.avpu               = news2I.avpu
        modelContext.insert(entry)
        news2Saved = true
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
            if autoFill.isAuto("bilirubinMgDL") || autoFill.isAuto("creatinineMgDL")
                || autoFill.isAuto("inrValue") || autoFill.isAuto("sodiumMmolL") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Pre-filled from latest lab results — review values.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
            mewsSlider(label: "Bilirubin (mg/dL)", autoKey: "bilirubinMgDL",
                       value: $meldI.bilirubinMgDL, in: 0.1...40.0, step: 0.1,
                       display: String(format: "%.1f", meldI.bilirubinMgDL))
            mewsSlider(label: "Creatinine (mg/dL)", autoKey: "creatinineMgDL",
                       value: $meldI.creatinineMgDL, in: 0.1...10.0, step: 0.1,
                       display: String(format: "%.1f", meldI.creatinineMgDL))
            mewsSlider(label: "INR", autoKey: "inrValue",
                       value: $meldI.inrValue, in: 0.8...8.0, step: 0.1,
                       display: String(format: "%.1f", meldI.inrValue))
            mewsSlider(label: "Sodium (mmol/L)", autoKey: "sodiumMmolL",
                       value: $meldI.sodiumMmolL, in: 110.0...145.0, step: 1.0,
                       display: "\(Int(meldI.sodiumMmolL)) mmol/L")
            scoreToggle("On dialysis (creatinine capped at 4.0)", binding: $meldI.onDialysis,
                        points: "", autoKey: "onDialysis")
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
            if autoFill.isAuto("isMale") || autoFill.isAuto("bloodUreaNitrogen")
                || autoFill.isAuto("haemoglobin") || autoFill.isAuto("sbp") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Sex, BUN, Hb, and SBP pre-filled from patient record — review values.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
            scoreToggle("Patient is male", binding: $blatchI.isMale, points: "", autoKey: "isMale")

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

            scoreToggle("Heart rate >100 bpm", binding: $blatchI.heartRateOver100, points: "+1", autoKey: "heartRateOver100")
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
                            .padding(.top, 1)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(field.label)
                                .font(.caption)
                                .foregroundStyle(.primary)
                            Text(field.source)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        // Confirm button: sets toggle true + writes to PMH.
                        // MEWS/NEWS2 pending fields are vitals measurements — use Save to Vitals instead.
                        if selectedScore != .mews && selectedScore != .news2 {
                            Button("Yes") {
                                confirmPendingField(field)
                            }
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(.orange, in: Capsule())
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(10)
            .background(.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.orange.opacity(0.3), lineWidth: 1))
            .padding(.bottom, 8)
        }
    }

    // MARK: - Confirm pending variable

    private func confirmPendingField(_ field: PendingScoreField) {
        guard let score = selectedScore else { return }

        // Append a dated audit line to PMH notes
        let fmt = DateFormatter(); fmt.dateStyle = .medium
        let line = "[\(fmt.string(from: .now))] \(field.label) — confirmed (\(score.rawValue))"
        if let existing = patient.pmhNotes, !existing.isEmpty {
            patient.pmhNotes = existing + "\n" + line
        } else {
            patient.pmhNotes = line
        }

        // Set the matching boolean toggle on the current score input
        switch score {
        case .caprini:
            switch field.id {
            case "priorVTE":            cap.priorVTE = true
            case "thrombophilia":       cap.thrombophilia = true
            case "familyHistoryVTE":    cap.familyHistoryVTE = true
            case "centralVenousAccess": cap.centralVenousAccess = true
            case "immobilityBedridden": cap.immobilityBedridden = true
            case "sepsis30d":           cap.sepsis30d = true
            default: break
            }
        case .wellsDVT:
            switch field.id {
            case "localizedTendernessDeepVein": wDVT.localizedTendernessDeepVein = true
            case "entireLegSwollen":            wDVT.entireLegSwollen = true
            case "calfSwellingOver3cm":         wDVT.calfSwellingOver3cm = true
            case "pittingOedema":               wDVT.pittingOedema = true
            case "collateralSuperficialVeins":  wDVT.collateralSuperficialVeins = true
            case "paralysisParesisPlastercast": wDVT.paralysisParesisPlastercast = true
            default: break
            }
        case .wellsPE:
            switch field.id {
            case "clinicalSignsDVT":        wPE.clinicalSignsDVT = true
            case "hrOver100":               wPE.hrOver100 = true
            case "haemoptysis":             wPE.haemoptysis = true
            case "alternativeDxLessLikely": wPE.alternativeDxLessLikely = true
            default: break
            }
        case .rcri:
            switch field.id {
            case "insulinDependentDiabetes": rcriI.insulinDependentDiabetes = true
            case "preopCreatinineOver2":     rcriI.preopCreatinineOver2 = true
            default: break
            }
        case .stopBang:
            switch field.id {
            case "snoring":      sbangI.snoring = true
            case "tired":        sbangI.tired = true
            case "observed":     sbangI.observed = true
            case "neckOver40cm": sbangI.neckOver40cm = true
            default: break
            }
        case .cha2ds2vasc:
            switch field.id {
            case "congestiveHeartFailure": cha2I.congestiveHeartFailure = true
            case "vascularDisease":        cha2I.vascularDisease = true
            default: break
            }
        case .hasBled:
            switch field.id {
            case "hypertensionUncontrolled": hblI.hypertensionUncontrolled = true
            case "renalDysfunction":         hblI.renalDysfunction = true
            case "liverDysfunction":         hblI.liverDysfunction = true
            case "priorBleeding":            hblI.priorBleeding = true
            case "labileINR":                hblI.labileINR = true
            case "alcoholUse":              hblI.alcoholUse = true
            default: break
            }
        case .abcd2:
            switch field.id {
            case "bpOver140_90":          abcd.bpOver140_90 = true
            case "unilateralWeakness":    abcd.unilateralWeakness = true
            case "speechWithoutWeakness": abcd.speechWithoutWeakness = true
            case "durationOver60min":     abcd.durationOver60min = true;  abcdDuration = 2
            case "duration10to59min":     abcd.duration10to59min = true;  abcdDuration = 1
            default: break
            }
        case .sirs:
            switch field.id {
            case "suspectedInfection":              sirsI.suspectedInfection = true
            case "wbcOver12kOrBelow4kOr10PctBands": sirsI.wbcOver12kOrBelow4kOr10PctBands = true
            default: break
            }
        case .qsofa:
            switch field.id {
            case "suspectedInfection": qsofaI.suspectedInfection = true
            case "alteredMentation":   qsofaI.alteredMentation = true
            case "rrOver22":           qsofaI.rrOver22 = true
            case "sbpUnder100":        qsofaI.sbpUnder100 = true
            default: break
            }
        case .ranson:
            switch field.id {
            case "hctFallOver10": ran.hctFallOver10 = true
            case "bunRiseOver5":  ran.bunRiseOver5 = true
            case "calciumBelow8": ran.calciumBelow8 = true
            case "pao2Below60":   ran.pao2Below60 = true
            default: break
            }
        case .glasgow:
            switch field.id {
            case "pao2Below60": glas.pao2Below60 = true
            default: break
            }
        case .aims65:
            switch field.id {
            case "albuminUnder3":       aims65I.albuminUnder3       = true
            case "inrOver1point5":      aims65I.inrOver1point5      = true
            case "alteredMentalStatus": aims65I.alteredMentalStatus = true
            case "systolicBPUnder90":   aims65I.systolicBPUnder90   = true
            default: break
            }
        case .bisap:
            switch field.id {
            case "bunOver9mmolL":       bisapI.bunOver9mmolL       = true
            case "impairedMentalStatus": bisapI.impairedMentalStatus = true
            case "sirs":                bisapI.sirs                 = true
            case "pleuralEffusion":     bisapI.pleuralEffusion      = true
            default: break
            }
        case .psiPort:
            switch field.id {
            case "alteredMentalStatus":      psiI.alteredMentalStatus      = true
            case "arterialPHUnder735":       psiI.arterialPHUnder735       = true
            case "bunOver11mmoL":            psiI.bunOver11mmoL            = true
            case "sodiumUnder130":           psiI.sodiumUnder130           = true
            case "glucoseOver14":            psiI.glucoseOver14            = true
            case "haematocritUnder30":       psiI.haematocritUnder30       = true
            case "pao2Under60orSpO2Under90": psiI.pao2Under60orSpO2Under90 = true
            case "pleuralEffusion":          psiI.pleuralEffusion          = true
            case "nursingHomeResident":      psiI.nursingHomeResident      = true
            default: break
            }
        case .sofa:
            // SOFA domain levels are adjusted via pickers; pending fields flag component elevations
            switch field.id {
            case "respirationElevated":   if sofaI.respiration < 1 { sofaI.respiration = 1 }
            case "coagulationElevated":   if sofaI.coagulation < 1 { sofaI.coagulation = 1 }
            case "liverElevated":         if sofaI.liver < 1       { sofaI.liver = 1 }
            case "cnsElevated":           if sofaI.cns < 1         { sofaI.cns = 1 }
            case "renalElevated":         if sofaI.renal < 1       { sofaI.renal = 1 }
            default: break
            }
        case .fib4:
            // FIB-4 inputs are continuous sliders; no boolean pending fields
            break
        case .curb65:
            switch field.id {
            case "confusion":              curb65I.confusion              = true
            case "ureaDOver7":             curb65I.ureaDOver7             = true
            case "respiratoryRateOver30":  curb65I.respiratoryRateOver30  = true
            case "lowBP":                  curb65I.lowBP                  = true
            case "ageOver65":              curb65I.ageOver65              = true
            default: break
            }
        case .padua:
            switch field.id {
            case "activeOrRecentCancer":         paduaI.activeOrRecentCancer         = true
            case "previousVTE":                  paduaI.previousVTE                  = true
            case "reducedMobility":              paduaI.reducedMobility              = true
            case "thrombophilia":                paduaI.thrombophilia                = true
            case "recentTraumaOrSurgery":        paduaI.recentTraumaOrSurgery        = true
            case "ageOver70":                    paduaI.ageOver70                    = true
            case "heartOrRespiratoryFailure":    paduaI.heartOrRespiratoryFailure    = true
            case "acuteMIOrIschaemicStroke":     paduaI.acuteMIOrIschaemicStroke     = true
            case "acuteInfectionOrInflammatory": paduaI.acuteInfectionOrInflammatory = true
            case "obese":                        paduaI.obese                        = true
            case "ongoingHormonalTreatment":     paduaI.ongoingHormonalTreatment     = true
            default: break
            }
        case .apacheII:
            // APACHE II fields are numeric selectors, not toggles — no pending-confirm action
            break
        case .ppossum:
            // P-POSSUM fields are numeric selectors — no boolean toggle confirm
            break
        case .mpi:
            switch field.id {
            case "ageOver50":            mpiI.ageOver50            = true
            case "femaleSex":            mpiI.femaleSex            = true
            case "organFailure":         mpiI.organFailure         = true
            case "malignancy":           mpiI.malignancy           = true
            case "durationOver24h":      mpiI.durationOver24h      = true
            case "nonColonicOrigin":     mpiI.nonColonicOrigin     = true
            case "generalizedPeritonitis": mpiI.generalizedPeritonitis = true
            default: break
            }
        case .ctsi:
            // CTSI fields are numeric selectors — no boolean toggle confirm
            break
        case .nrs2002:
            switch field.id {
            case "ageOver70": nrsI.ageOver70 = true
            default: break
            }
        case .forrest:
            // Forrest grade is a single numeric picker — no boolean toggle confirm
            break
        case .heart:
            // HEART domain scores are numeric pickers — no boolean toggle confirm
            break
        case .timi:
            switch field.id {
            case "ageOver65":                   timiI.ageOver65 = true
            case "threeOrMoreRiskFactors":      timiI.threeOrMoreRiskFactors = true
            case "priorCoronaryArteryStenosis": timiI.priorCoronaryArteryStenosis = true
            case "stDeviationOnECG":            timiI.stDeviationOnECG = true
            case "twoOrMoreAnginalEvents":      timiI.twoOrMoreAnginalEvents = true
            case "aspirinUseInLast7Days":       timiI.aspirinUseInLast7Days = true
            case "elevatedCardiacMarkers":      timiI.elevatedCardiacMarkers = true
            default: break
            }
        case .cfs:
            // CFS is a single ordinal picker — no boolean toggle confirm
            break
        case .mallampati:
            switch field.id {
            case "mouthOpening":   mallampatiI.mouthOpening   = true
            case "neckMobility":   mallampatiI.neckMobility   = true
            case "thyromental":    mallampatiI.thyromental    = true
            case "retrognathia":   mallampatiI.retrognathia   = true
            case "obesity":        mallampatiI.obesity        = true
            case "beardOrDentures": mallampatiI.beardOrDentures = true
            default: break
            }
        case .waterlow:
            switch field.id {
            case "tissuemalnutrition": waterlowI.tissuemalnutrition = true
            case "neurologicalDeficit": waterlowI.neurologicalDeficit = true
            case "majorSurgery":       waterlowI.majorSurgery = true
            case "onCytotoxics":       waterlowI.onCytotoxics = true
            default: break
            }
        case .surgicalApgar:
            // All fields are numeric pickers — no boolean toggle confirm
            break
        case .grace:
            switch field.id {
            case "cardiacArrest":    graceI.cardiacArrest = true
            case "elevatedMarkers":  graceI.elevatedMarkers = true
            case "stDeviation":      graceI.stDeviation = true
            default: break
            }
        case .barthel:
            // All fields are numeric pickers — no boolean toggle confirm
            break
        case .euroScoreII:
            switch field.id {
            case "female":                    euroScI.female = true
            case "extracardiacArteriopathy":  euroScI.extracardiacArteriopathy = true
            case "poorMobility":              euroScI.poorMobility = true
            case "previousCardiacSurgery":    euroScI.previousCardiacSurgery = true
            case "chronicLungDisease":        euroScI.chronicLungDisease = true
            case "activeEndocarditis":        euroScI.activeEndocarditis = true
            case "criticalPreoperativeState": euroScI.criticalPreoperativeState = true
            case "diabetesOnInsulin":         euroScI.diabetesOnInsulin = true
            case "ccsClass4Angina":           euroScI.ccsClass4Angina = true
            case "recentMI":                  euroScI.recentMI = true
            case "surgeryOnThoracicAorta":    euroScI.surgeryOnThoracicAorta = true
            case "postInfarctSeptalRupture":  euroScI.postInfarctSeptalRupture = true
            default: break
            }
        case .dasi:
            // All fields are boolean toggles; auto-confirmed from patient-reported keywords
            switch field.id {
            case "takeCareOfSelf":           dasiI.takeCareOfSelf = true
            case "walkIndoors":              dasiI.walkIndoors = true
            case "walkOneOrTwoBlocks":       dasiI.walkOneOrTwoBlocks = true
            case "climbStairs":              dasiI.climbStairs = true
            case "runShortDistance":         dasiI.runShortDistance = true
            case "doLightWork":              dasiI.doLightWork = true
            case "doModerateWork":           dasiI.doModerateWork = true
            case "doHeavyWork":              dasiI.doHeavyWork = true
            case "doYardWork":               dasiI.doYardWork = true
            case "haveSexualActivity":       dasiI.haveSexualActivity = true
            case "participateInModerateRecreation": dasiI.participateInModerateRecreation = true
            case "participateInStrenuous":   dasiI.participateInStrenuous = true
            default: break
            }
        case .nihss:
            // NIHSS fields are numeric pickers — auto-fill applies only consciousness level from text
            break
        case .must:
            // MUST fields are categorical pickers confirmed directly in the form
            break
        case .clavienDindo:
            break
        case .aldrete:
            break
        case .fourT:
            break
        case .oakland:
            break
        case .kingsCriteria:
            break
        case .childPugh, .meld, .asa:
            break
        case .ecog, .rts, .kdigo, .baux, .iss, .apacheII, .sofa, .nutric, .caprini, .curb65:
            break
        case .spesi:
            switch field.id {
            case "cancer":                  spesiI.cancer = true
            case "cardiopulmonaryDisease":  spesiI.cardiopulmonaryDisease = true
            case "heartRateAbove109":       spesiI.heartRateAbove109 = true
            case "sbpBelow100":             spesiI.sbpBelow100 = true
            case "spo2Below90":             spesiI.spo2Below90 = true
            default: break
            }
        case .decaf:
            switch field.id {
            case "eosinopenia":          decafI.eosinopenia = true
            case "consolidation":        decafI.consolidation = true
            case "acidaemia":            decafI.acidaemia = true
            case "atrialFibrillation":   decafI.atrialFibrillation = true
            default: break
            }
        case .hinchey:
            // Grade is a numeric picker — no boolean toggle confirm
            break
        default: break
        }

        // Promote field from pending to auto-confirmed (teal badge)
        autoFill.autoFieldKeys.insert(field.id)
        autoFill.pendingFields.removeAll { $0.id == field.id }
        recalculate()
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

    // MARK: - PSI/PORT

    private var psiPortForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            psiPortDemographicsSection
            psiPortComorbiditySection
            psiPortExamSection
            psiPortLabSection
        }
    }

    @ViewBuilder private var psiPortDemographicsSection: some View {
        Group {
            sectionHeader("Demographics")
            if patient.sex == .male {
                mewsSlider(label: "Age (years, male: +1/yr)", autoKey: "ageMale",
                           value: Binding(get: { Double(psiI.ageMale) }, set: { psiI.ageMale = Int($0) }),
                           in: 0...120, step: 1, display: "\(psiI.ageMale)")
            } else {
                mewsSlider(label: "Age − 10 (female adj, +1/yr)", autoKey: "ageFemale",
                           value: Binding(get: { Double(psiI.ageFemale) }, set: { psiI.ageFemale = Int($0) }),
                           in: 0...110, step: 1, display: "\(psiI.ageFemale)")
            }
            scoreToggle("Nursing home resident", binding: $psiI.nursingHomeResident, points: "+10", autoKey: "nursingHomeResident")
        }
        .onChange(of: psiI) { _, _ in recalculate() }
    }

    @ViewBuilder private var psiPortComorbiditySection: some View {
        Group {
            sectionHeader("Comorbidities")
            scoreToggle("Neoplastic disease",           binding: $psiI.neoplasticDisease,      points: "+30", autoKey: "neoplasticDisease")
            scoreToggle("Liver disease",                binding: $psiI.liverDisease,            points: "+20", autoKey: "liverDisease")
            scoreToggle("Congestive heart failure",     binding: $psiI.congestiveHeartFailure,  points: "+10", autoKey: "congestiveHeartFailure")
            scoreToggle("Cerebrovascular disease",      binding: $psiI.cerebrovascularDisease,  points: "+10", autoKey: "cerebrovascularDisease")
            scoreToggle("Renal disease",                binding: $psiI.renalDisease,            points: "+10", autoKey: "renalDisease")
        }
        .onChange(of: psiI) { _, _ in recalculate() }
    }

    @ViewBuilder private var psiPortExamSection: some View {
        Group {
            sectionHeader("Examination Findings")
            scoreToggle("Altered mental status",                   binding: $psiI.alteredMentalStatus,      points: "+20", autoKey: "alteredMentalStatus")
            scoreToggle("Respiratory rate >30 breaths/min",        binding: $psiI.respiratoryRateOver30,    points: "+20", autoKey: "respiratoryRateOver30")
            scoreToggle("Systolic BP <90 mmHg",                    binding: $psiI.systolicBPUnder90,        points: "+20", autoKey: "systolicBPUnder90")
            scoreToggle("Temperature <35°C or >40°C",              binding: $psiI.tempUnder35orOver40,      points: "+15", autoKey: "tempUnder35orOver40")
            scoreToggle("Heart rate >125 bpm",                     binding: $psiI.heartRateOver125,         points: "+10", autoKey: "heartRateOver125")
        }
        .onChange(of: psiI) { _, _ in recalculate() }
    }

    @ViewBuilder private var psiPortLabSection: some View {
        Group {
            sectionHeader("Laboratory & Radiology")
            scoreToggle("Arterial pH <7.35",                       binding: $psiI.arterialPHUnder735,       points: "+30", autoKey: "arterialPHUnder735")
            scoreToggle("BUN >11 mmol/L (>30 mg/dL)",             binding: $psiI.bunOver11mmoL,            points: "+20", autoKey: "bunOver11mmoL")
            scoreToggle("Sodium <130 mmol/L",                      binding: $psiI.sodiumUnder130,           points: "+20", autoKey: "sodiumUnder130")
            scoreToggle("Glucose >14 mmol/L (>250 mg/dL)",        binding: $psiI.glucoseOver14,            points: "+10", autoKey: "glucoseOver14")
            scoreToggle("Haematocrit <30%",                        binding: $psiI.haematocritUnder30,       points: "+10", autoKey: "haematocritUnder30")
            scoreToggle("PaO₂ <60 mmHg or SpO₂ <90%",            binding: $psiI.pao2Under60orSpO2Under90, points: "+10", autoKey: "pao2Under60orSpO2Under90")
            scoreToggle("Pleural effusion on imaging",             binding: $psiI.pleuralEffusion,          points: "+10", autoKey: "pleuralEffusion")
        }
        .onChange(of: psiI) { _, _ in recalculate() }
    }

    // MARK: - AIMS65

    private var aims65Form: some View {
        Group {
            scoreToggle("A — Albumin <3.0 g/dL",                     binding: $aims65I.albuminUnder3,       points: "+1", autoKey: "albuminUnder3")
            scoreToggle("I — INR >1.5",                               binding: $aims65I.inrOver1point5,      points: "+1", autoKey: "inrOver1point5")
            scoreToggle("M — Altered mental status",                  binding: $aims65I.alteredMentalStatus, points: "+1", autoKey: "alteredMentalStatus")
            scoreToggle("S — Systolic BP ≤90 mmHg",                  binding: $aims65I.systolicBPUnder90,   points: "+1", autoKey: "systolicBPUnder90")
            scoreToggle("5 — Age ≥65 years",                         binding: $aims65I.ageOver65,           points: "+1", autoKey: "ageOver65")
        }
        .onChange(of: aims65I) { _, _ in recalculate() }
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

    private func sofaDomainSection(_ title: String, selection: Binding<Int>, labels: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Picker("", selection: selection) {
                Text("0").tag(0)
                Text("1").tag(1)
                Text("2").tag(2)
                Text("3").tag(3)
                Text("4").tag(4)
            }
            .pickerStyle(.segmented)
            if selection.wrappedValue < labels.count {
                Text(labels[selection.wrappedValue])
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 1)
            }
        }
    }

    // MARK: - FIB-4

    private var fib4Form: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Formula: (Age × AST) ÷ (Platelets × √ALT)")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.bottom, 2)
            mewsSlider(label: "Age (years)", autoKey: "age",
                       value: Binding(get: { Double(fib4I.age) }, set: { fib4I.age = Int($0) }),
                       in: 18...100, step: 1, display: "\(fib4I.age) yr")
            mewsSlider(label: "AST (IU/L)", autoKey: "astIUL",
                       value: $fib4I.astIUL, in: 5...500, step: 1,
                       display: "\(Int(fib4I.astIUL)) IU/L")
            mewsSlider(label: "Platelets (×10⁹/L)", autoKey: "platelet10_9L",
                       value: $fib4I.platelet10_9L, in: 10...600, step: 5,
                       display: "\(Int(fib4I.platelet10_9L))")
            mewsSlider(label: "ALT (IU/L)", autoKey: "altIUL",
                       value: $fib4I.altIUL, in: 5...500, step: 1,
                       display: "\(Int(fib4I.altIUL)) IU/L")
        }
        .onChange(of: fib4I) { _, _ in recalculate() }
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

    // MARK: - Padua Prediction Score

    private var paduaForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            paduaHighRiskSection
            paduaLowRiskSection
        }
    }

    @ViewBuilder private var paduaHighRiskSection: some View {
        Group {
            Text("Medical inpatient VTE risk. Score ≥4 → high risk; consider pharmacoprophylaxis.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            sectionHeader("High-risk Factors (+3 each)")
            scoreToggle("Active / recent cancer (treatment ≤6 months or metastatic)",  binding: $paduaI.activeOrRecentCancer, points: "+3", autoKey: "activeOrRecentCancer")
            scoreToggle("Previous VTE (excluding superficial vein thrombosis)",         binding: $paduaI.previousVTE,          points: "+3", autoKey: "previousVTE")
            scoreToggle("Reduced mobility ≥3 days (bed rest / limited ambulation)",    binding: $paduaI.reducedMobility,      points: "+3", autoKey: "reducedMobility")
            scoreToggle("Known thrombophilic condition (hereditary or acquired)",       binding: $paduaI.thrombophilia,        points: "+3", autoKey: "thrombophilia")
        }
        .onChange(of: paduaI) { _, _ in recalculate() }
    }

    @ViewBuilder private var paduaLowRiskSection: some View {
        Group {
            sectionHeader("Intermediate / Low-risk Factors")
            scoreToggle("Recent trauma or surgery ≤1 month",  binding: $paduaI.recentTraumaOrSurgery,       points: "+2", autoKey: "recentTraumaOrSurgery")
            scoreToggle("Age ≥70 years",                      binding: $paduaI.ageOver70,                   points: "+1", autoKey: "ageOver70")
            scoreToggle("Heart failure or respiratory failure",binding: $paduaI.heartOrRespiratoryFailure,   points: "+1", autoKey: "heartOrRespiratoryFailure")
            scoreToggle("Acute MI or ischaemic stroke",        binding: $paduaI.acuteMIOrIschaemicStroke,    points: "+1", autoKey: "acuteMIOrIschaemicStroke")
            scoreToggle("Acute infection or rheumatological disorder", binding: $paduaI.acuteInfectionOrInflammatory, points: "+1", autoKey: "acuteInfectionOrInflammatory")
            scoreToggle("BMI ≥30 kg/m² (obese)",             binding: $paduaI.obese,                       points: "+1", autoKey: "obese")
            scoreToggle("Ongoing hormonal treatment",          binding: $paduaI.ongoingHormonalTreatment,    points: "+1", autoKey: "ongoingHormonalTreatment")
        }
        .onChange(of: paduaI) { _, _ in recalculate() }
    }

    // MARK: - APACHE II

    private var apacheIIForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("ICU severity scoring. APS + Age + Chronic Health. Score ≥20 → high ICU mortality.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            apacheIIVitalsSection
            apacheIILabsSection
            apacheIIContextSection
        }
    }

    @ViewBuilder private var apacheIIVitalsSection: some View {
        Group {
            sectionHeader("Acute Physiology — Vitals")
            sofaDomainSection("Temperature (°C)", selection: $apacheIII.tempPoints,
                labels: ["36.0–38.4 (0)", "38.5–38.9 (1)", "32.0–33.9 (2)",
                         "30.0–31.9 or 39.0–40.9 (3)", "≥41.0 or ≤29.9 (4)"])
            apacheSegment("Mean Arterial Pressure (mmHg)", selection: $apacheIII.mapPoints,
                options: [(0, "70–109 mmHg"), (2, "110–129 or 50–69"), (3, "130–159"), (4, "≥160 or ≤49")])
            apacheSegment("Heart Rate (bpm)", selection: $apacheIII.hrPoints,
                options: [(0, "70–109"), (2, "110–139 or 55–69"), (3, "140–179 or 40–54"), (4, "≥180 or ≤39")])
            sofaDomainSection("Respiratory Rate (br/min)", selection: $apacheIII.rrPoints,
                labels: ["12–24 (0)", "10–11 or 25–34 (1)", "6–9 (2)", "35–49 (3)", "≥50 or ≤5 (4)"])
            sofaDomainSection("Oxygenation (A-aDO₂ or PaO₂ mmHg)", selection: $apacheIII.oxyPoints,
                labels: ["No deficit / PaO₂ >70 (0)", "PaO₂ 61–70 (1)",
                         "A-a 200–349 or PaO₂ 55–60 (2)", "A-a 350–499 (3)", "A-a ≥500 or PaO₂ <55 (4)"])
        }
        .onChange(of: apacheIII) { _, _ in recalculate() }
    }

    @ViewBuilder private var apacheIILabsSection: some View {
        Group {
            sectionHeader("Acute Physiology — Labs")
            sofaDomainSection("Arterial pH", selection: $apacheIII.pHPoints,
                labels: ["7.33–7.49 (0)", "7.50–7.59 (1)", "7.25–7.32 or 7.60–7.69 (2)",
                         "7.15–7.24 or ≥7.70 (3)", "<7.15 (4)"])
            sofaDomainSection("Serum Sodium (mmol/L)", selection: $apacheIII.sodiumPoints,
                labels: ["130–149 (0)", "150–154 (1)", "155–159 or 120–129 (2)",
                         "160–179 or 111–119 (3)", "≥180 or ≤110 (4)"])
            apacheSegment("Serum Potassium (mmol/L)", selection: $apacheIII.potassiumPoints,
                options: [(0, "3.5–5.4"), (1, "5.5–5.9 or 3.0–3.4"),
                          (2, "6.0–6.9 or 2.5–2.9"), (4, "≥7.0 or <2.5")])
            apacheSegment("Creatinine (µmol/L)", selection: $apacheIII.creatininePoints,
                options: [(0, "53–123 µmol/L"), (2, "124–176 or 44–52"),
                          (3, "177–309"), (4, "≥310 or <44 (double if ARF)")])
            apacheSegment("Haematocrit (%)", selection: $apacheIII.haematocritPoints,
                options: [(0, "30–45.9%"), (1, "46–49.9% or 20–29.9%"),
                          (2, "50–59.9%"), (4, "≥60% or <20%")])
            apacheSegment("WBC (×10³/mm³)", selection: $apacheIII.wbcPoints,
                options: [(0, "3–14.9"), (1, "15–19.9 or 1–2.9"),
                          (2, "20–39.9"), (4, "≥40 or <1")])
        }
        .onChange(of: apacheIII) { _, _ in recalculate() }
    }

    @ViewBuilder private var apacheIIContextSection: some View {
        Group {
            sectionHeader("GCS")
            VStack(alignment: .leading, spacing: 6) {
                Text("Glasgow Coma Scale (3–15). APACHE II points = 15 − GCS.")
                    .font(.caption).foregroundStyle(.secondary)
                Stepper("GCS: \(apacheIII.gcs)", value: $apacheIII.gcs, in: 3...15)
                    .font(.subheadline)
            }
            sectionHeader("Age")
            apacheSegment("Age Points", selection: $apacheIII.agePoints,
                options: [(0, "≤44 years"), (2, "45–54"), (3, "55–64"), (5, "65–74"), (6, "≥75")])
            sectionHeader("Chronic Health")
            apacheSegment("Chronic Health Points", selection: $apacheIII.chronicHealthPoints,
                options: [(0, "None / no severe organ insufficiency"),
                          (2, "Elective postoperative patient"),
                          (5, "Non-operative or emergency postop — severe organ insufficiency or immunocompromised")])
        }
        .onChange(of: apacheIII) { _, _ in recalculate() }
    }

    // Generic helper for APACHE II parameters with non-contiguous point values
    private func apacheSegment(_ title: String, selection: Binding<Int>,
                                options: [(Int, String)]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Picker("", selection: selection) {
                ForEach(0..<options.count, id: \.self) { idx in
                    Text("\(options[idx].0)").tag(options[idx].0)
                }
            }
            .pickerStyle(.segmented)
            if let match = options.first(where: { $0.0 == selection.wrappedValue }) {
                Text(match.1)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 1)
            }
        }
    }

    // MARK: - P-POSSUM

    private var ppossumForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Portsmouth POSSUM surgical mortality/morbidity predictor. Logistic regression: ln(R/1−R) = −9.065 + 0.1692×PS + 0.1550×OS. Score both pre-operatively for consent and retrospectively for audit.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            ppossumPhysiologicalSection
            ppossumOperativeSection
        }
    }

    @ViewBuilder private var ppossumPhysiologicalSection: some View {
        Group {
            sectionHeader("Physiological Score (PS)")
            apacheSegment("Age", selection: $ppossumI.agePhys,
                options: [(1, "≤60 years"), (2, "61–70"), (4, "71–80"), (8, "≥81")])
            apacheSegment("Cardiac Signs", selection: $ppossumI.cardiacSigns,
                options: [(1, "No failure"), (2, "Medication only"), (4, "Peripheral oedema / warfarin / digoxin"), (8, "Raised JVP or cardiomegaly")])
            apacheSegment("Respiratory History", selection: $ppossumI.respiratoryHx,
                options: [(1, "No dyspnoea"), (2, "Exertional dyspnoea"), (4, "Limiting dyspnoea / COPD"), (8, "Breathless at rest")])
            apacheSegment("Systolic BP (mmHg)", selection: $ppossumI.sbpPhys,
                options: [(1, "110–130"), (2, "131–170 or 100–109"), (4, "≥171 or 90–99"), (8, "≤89")])
            apacheSegment("Heart Rate (bpm)", selection: $ppossumI.hrPhys,
                options: [(1, "51–80"), (2, "81–100 or ≤50"), (4, "101–120"), (8, "≥121")])
            apacheSegment("GCS", selection: $ppossumI.gcsPhys,
                options: [(1, "15 — alert"), (2, "12–14"), (4, "9–11"), (8, "≤8")])
        }
        .onChange(of: ppossumI) { _, _ in recalculate() }
        Group {
            apacheSegment("Haemoglobin (g/dL)", selection: $ppossumI.haemoglobin,
                options: [(1, "13.0–16.0"), (2, "11.5–12.9 or 16.1–17.0"), (4, "10.0–11.4 or 17.1–18.0"), (8, "≤9.9 or ≥18.1")])
            apacheSegment("WBC (×10³/μL)", selection: $ppossumI.wbcPhys,
                options: [(1, "4–10"), (2, "10.1–20.0 or 3.1–3.9"), (4, "≥20.1 or ≤3.0")])
            apacheSegment("Urea (mmol/L)", selection: $ppossumI.urea,
                options: [(1, "<7.5"), (2, "7.5–10.0"), (4, "10.1–15.0"), (8, "≥15.1")])
            apacheSegment("Serum Sodium (mmol/L)", selection: $ppossumI.sodiumPhys,
                options: [(1, "136–145"), (2, "131–135 or 146–150"), (4, "126–130"), (8, "≤125")])
            apacheSegment("Serum Potassium (mmol/L)", selection: $ppossumI.potassiumPhys,
                options: [(1, "3.5–5.0"), (2, "3.2–3.4 or 5.1–5.3"), (4, "2.9–3.1 or 5.4–5.9"), (8, "≤2.8 or ≥6.0")])
            apacheSegment("ECG", selection: $ppossumI.ecg,
                options: [(1, "Normal"), (2, "AF 60–90 bpm"), (4, "AF other rate or >5 ectopics"), (8, "Q waves / ST changes / BBB")])
        }
        .onChange(of: ppossumI) { _, _ in recalculate() }
    }

    @ViewBuilder private var ppossumOperativeSection: some View {
        Group {
            sectionHeader("Operative Score (OS)")
            apacheSegment("Operative Magnitude", selection: $ppossumI.operativeMagnitude,
                options: [(1, "Minor"), (2, "Moderate"), (4, "Major"), (8, "Major+")])
            apacheSegment("Number of Procedures", selection: $ppossumI.numProcedures,
                options: [(1, "1"), (2, "2"), (4, "≥3")])
            apacheSegment("Blood Loss (mL)", selection: $ppossumI.bloodLoss,
                options: [(1, "<100"), (2, "101–500"), (4, "501–999"), (8, "≥1000")])
            apacheSegment("Peritoneal Soiling", selection: $ppossumI.peritonealSoiling,
                options: [(1, "None"), (2, "Minor serosal / haematoma"), (4, "Local pus"), (8, "Free bowel content / pus / blood")])
            apacheSegment("Malignancy", selection: $ppossumI.malignancy,
                options: [(1, "None"), (2, "Primary only"), (4, "Nodal disease"), (8, "Distant metastases")])
            apacheSegment("Urgency", selection: $ppossumI.urgency,
                options: [(1, "Elective"), (4, "Emergency >2 h (resuscitated)"), (8, "Emergency <2 h (not resuscitated)")])
        }
        .onChange(of: ppossumI) { _, _ in recalculate() }
    }

    // MARK: - NRS-2002

    private var nrs2002Form: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Nutritional Risk Screening 2002 (Kondrup et al, Clin Nutr 2003). Score ≥3 = at nutritional risk; initiate nutritional support plan. Validated in 128 randomised trials.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Nutritional Status (impaired nutrition)")
                apacheSegment("Nutritional Status Score", selection: $nrsI.nutritionalStatus,
                    options: [
                        (0, "Normal nutritional status"),
                        (1, "Mild — weight loss >5% in 3 months, or food intake 50–75% of normal in past week"),
                        (2, "Moderate — weight loss >5% in 2 months, or BMI 18.5–20.5 with impaired general condition, or food intake 25–60% of normal"),
                        (3, "Severe — weight loss >5% in 1 month (>15% in 3 months), BMI <18.5, or food intake <25% of normal")
                    ])
                sectionHeader("Disease Severity (stress metabolism)")
                apacheSegment("Disease Severity Score", selection: $nrsI.diseaseSeverity,
                    options: [
                        (0, "Normal requirements"),
                        (1, "Minor — hip fracture, chronic disease with complications (liver cirrhosis, COPD, haemodialysis, diabetes, chemotherapy)"),
                        (2, "Moderate — major abdominal surgery, stroke, haematological malignancy, ICU APACHE II <10"),
                        (3, "Severe — head injury, bone marrow transplant, ICU APACHE II ≥10")
                    ])
                scoreToggle("Age ≥70 years", binding: $nrsI.ageOver70, points: "+1", autoKey: "ageOver70")
            }
            .onChange(of: nrsI) { _, _ in recalculate() }
        }
    }

    // MARK: - TIMI Risk Score (UA/NSTEMI)

    private var timiForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("TIMI Risk Score for UA/NSTEMI (Antman et al, JAMA 2000). 7 binary risk factors; score 0–7. 0–2 = low risk (~8% 14-day MACE), 3–4 = intermediate (~13–20%), 5–7 = high (~26–40%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Risk Factors")
                scoreToggle("Age ≥65 years", binding: $timiI.ageOver65, points: "+1", autoKey: "ageOver65")
                scoreToggle("≥3 CAD risk factors (FH / HTN / hypercholesterolaemia / DM / active smoker)", binding: $timiI.threeOrMoreRiskFactors, points: "+1", autoKey: "threeOrMoreRiskFactors")
                scoreToggle("Known CAD: prior coronary stenosis ≥50%", binding: $timiI.priorCoronaryArteryStenosis, points: "+1", autoKey: "priorCoronaryArteryStenosis")
                scoreToggle("ST-segment deviation on presenting ECG", binding: $timiI.stDeviationOnECG, points: "+1", autoKey: "stDeviationOnECG")
                scoreToggle("≥2 anginal events in prior 24 hours", binding: $timiI.twoOrMoreAnginalEvents, points: "+1", autoKey: "twoOrMoreAnginalEvents")
                scoreToggle("Aspirin use in the prior 7 days (angina despite aspirin)", binding: $timiI.aspirinUseInLast7Days, points: "+1", autoKey: "aspirinUseInLast7Days")
                scoreToggle("Elevated serum cardiac markers (troponin or CK-MB)", binding: $timiI.elevatedCardiacMarkers, points: "+1", autoKey: "elevatedCardiacMarkers")
            }
            .onChange(of: timiI) { _, _ in recalculate() }
        }
    }

    // MARK: - GRACE Score (ACS Mortality)

    private var graceForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("GRACE Score (Granger CB et al, Lancet 2003; Fox KA et al, Eur Heart J 2006). Predicts in-hospital and 6-month mortality after ACS. Score 0–372. In-hospital mortality: Low <109 (<1%), Moderate 109–140 (1–3%), High >140 (>3%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Age")
                apacheSegment("Age Category", selection: $graceI.ageCategory,
                    options: [
                        (0, "<40 years (+0)"),
                        (1, "40–49 years (+18)"),
                        (2, "50–59 years (+36)"),
                        (3, "60–69 years (+55)"),
                        (4, "70–79 years (+73)"),
                        (5, "≥80 years (+91)")
                    ])
                sectionHeader("Heart Rate (bpm)")
                apacheSegment("Heart Rate", selection: $graceI.heartRate,
                    options: [
                        (0, "<70 bpm (+0)"),
                        (1, "70–89 bpm (+7)"),
                        (2, "90–109 bpm (+13)"),
                        (3, "110–149 bpm (+23)"),
                        (4, "150–199 bpm (+36)"),
                        (5, "≥200 bpm (+46)")
                    ])
                sectionHeader("Systolic Blood Pressure (mmHg)")
                apacheSegment("Systolic BP", selection: $graceI.systolicBP,
                    options: [
                        (0, "<80 mmHg (+63)"),
                        (1, "80–99 mmHg (+58)"),
                        (2, "100–119 mmHg (+47)"),
                        (3, "120–139 mmHg (+37)"),
                        (4, "140–159 mmHg (+26)"),
                        (5, "160–199 mmHg (+11)"),
                        (6, "≥200 mmHg (+0)")
                    ])
                sectionHeader("Serum Creatinine (mg/dL)")
                apacheSegment("Creatinine", selection: $graceI.creatinine,
                    options: [
                        (0, "0–0.39 mg/dL (+2)"),
                        (1, "0.4–0.79 mg/dL (+5)"),
                        (2, "0.8–1.19 mg/dL (+8)"),
                        (3, "1.2–1.59 mg/dL (+11)"),
                        (4, "1.6–1.99 mg/dL (+14)"),
                        (5, "2.0–3.99 mg/dL (+23)"),
                        (6, "≥4.0 mg/dL (+31)")
                    ])
                sectionHeader("Killip Class (Heart Failure Status)")
                apacheSegment("Killip Class", selection: $graceI.killipClass,
                    options: [
                        (0, "Class I — No CHF signs (+0)"),
                        (1, "Class II — Mild CHF (rales / elevated JVP) (+21)"),
                        (2, "Class III — Acute pulmonary oedema (+43)"),
                        (3, "Class IV — Cardiogenic shock (+64)")
                    ])
                sectionHeader("Additional Risk Factors")
                scoreToggle("Cardiac arrest at admission", binding: $graceI.cardiacArrest, points: "+43", autoKey: "cardiacArrest")
                scoreToggle("Elevated cardiac biomarkers (troponin or CK-MB above ULN)", binding: $graceI.elevatedMarkers, points: "+15", autoKey: "elevatedMarkers")
                scoreToggle("ST-segment deviation on ECG (depression or transient elevation)", binding: $graceI.stDeviation, points: "+30", autoKey: "stDeviation")
            }
            .onChange(of: graceI) { _, _ in recalculate() }
        }
    }

    // MARK: - Surgical Apgar Score

    private var surgicalApgarForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Surgical Apgar Score (Gawande et al, J Am Coll Surg 2007; Regenbogen et al, Ann Surg 2010). Three intraoperative variables; score 0–10. Higher score = lower risk. Score ≤4: high risk (~27–56% 30-day major complication/death); 5–6 moderate (~16–22%); 7–8 low (~9–10%); 9–10 very low (~3.5%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Estimated Blood Loss")
                apacheSegment("Estimated Blood Loss (EBL)", selection: $surgApgarI.estimatedBloodLoss,
                    options: [
                        (0, ">1 000 mL (0 points)"),
                        (1, "601–1 000 mL (1 point)"),
                        (2, "101–600 mL (2 points)"),
                        (3, "≤100 mL (3 points)")
                    ])
                sectionHeader("Lowest Intraoperative Mean Arterial Pressure")
                apacheSegment("Lowest MAP", selection: $surgApgarI.lowestMAP,
                    options: [
                        (0, "<40 mmHg (0 points)"),
                        (1, "40–54 mmHg (1 point)"),
                        (2, "55–69 mmHg (2 points)"),
                        (3, "≥70 mmHg (3 points)")
                    ])
                sectionHeader("Lowest Intraoperative Heart Rate")
                apacheSegment("Lowest Heart Rate", selection: $surgApgarI.lowestHeartRate,
                    options: [
                        (0, "≥120 bpm (0 points)"),
                        (1, "101–119 bpm (0 points)"),
                        (2, "86–100 bpm (1 point)"),
                        (3, "56–85 bpm (3 points — normal)"),
                        (4, "41–55 bpm (2 points)"),
                        (5, "≤40 bpm (0 points)")
                    ])
            }
            .onChange(of: surgApgarI) { _, _ in recalculate() }
        }
    }

    // MARK: - Waterlow Pressure Ulcer Risk

    private var waterlowForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Waterlow Pressure Ulcer Risk Assessment (Waterlow J, Nursing Times 1985; revised 2005). Scores six patient factors plus four special risk categories. Low risk 0–9; at risk 10–14; high risk 15–19; very high risk ≥20.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Build / Weight for Height")
                apacheSegment("Build", selection: $waterlowI.buildWeight,
                    options: [
                        (0, "0 — Average"),
                        (1, "1 — Above average"),
                        (2, "2 — Obese"),
                        (3, "3 — Below average")
                    ])
                sectionHeader("Skin Type / Visual Risk Areas")
                apacheSegment("Skin Type", selection: $waterlowI.skinType,
                    options: [
                        (0, "0 — Healthy"),
                        (1, "1 — Tissue paper / fragile"),
                        (2, "2 — Dry"),
                        (3, "3 — Oedematous"),
                        (4, "4 — Clammy / pyrexia"),
                        (5, "5 — Discoloured (but not broken)"),
                        (6, "6 — Broken or spot")
                    ])
                sectionHeader("Sex and Age")
                apacheSegment("Sex / Age", selection: $waterlowI.sexAge,
                    options: [
                        (0, "0 — Male 14–49"),
                        (1, "1 — Female 14–49 / Male 50–64"),
                        (2, "2 — Female 50–64 / Male 65–74"),
                        (3, "3 — Female 65–74 / Male 75–80"),
                        (4, "4 — Female 75–80"),
                        (5, "5 — 81+")
                    ])
                sectionHeader("Mobility")
                apacheSegment("Mobility", selection: $waterlowI.mobility,
                    options: [
                        (0, "0 — Fully mobile"),
                        (1, "1 — Restless / fidgety"),
                        (2, "2 — Apathetic"),
                        (3, "3 — Restricted / chair-fast"),
                        (4, "4 — Inert / in traction"),
                        (5, "5 — Chairbound / bedridden")
                    ])
                sectionHeader("Continence")
                apacheSegment("Continence", selection: $waterlowI.continence,
                    options: [
                        (0, "0 — Complete / catheterised"),
                        (1, "1 — Occasionally incontinent"),
                        (2, "2 — Catheterised but incontinent of faeces"),
                        (3, "3 — Doubly incontinent")
                    ])
                sectionHeader("Appetite / Nutritional Status")
                apacheSegment("Appetite", selection: $waterlowI.appetite,
                    options: [
                        (0, "0 — Average"),
                        (1, "1 — Poor"),
                        (2, "2 — NG tube / fluids only"),
                        (3, "3 — NBM / anorexic")
                    ])
                sectionHeader("Special Risk Factors")
                scoreToggle("Tissue malnutrition: cachexia / terminal / cardiac failure / peripheral vascular / anaemia / smoking", binding: $waterlowI.tissuemalnutrition, points: "+8", autoKey: "tissuemalnutrition")
                scoreToggle("Neurological deficit: diabetes / motor-sensory / paraplegia", binding: $waterlowI.neurologicalDeficit, points: "+5", autoKey: "neurologicalDeficit")
                scoreToggle("Major surgery or trauma: orthopaedic below waist / spinal / >2 h on operating table", binding: $waterlowI.majorSurgery, points: "+5", autoKey: "majorSurgery")
                scoreToggle("Medication: cytotoxic agents / high-dose steroids", binding: $waterlowI.onCytotoxics, points: "+4", autoKey: "onCytotoxics")
            }
            .onChange(of: waterlowI) { _, _ in recalculate() }
        }
    }

    // MARK: - EuroSCORE II

    private var euroScoreIIForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("EuroSCORE II — European System for Cardiac Operative Risk Evaluation II (Nashef 2012). Logistic model predicting in-hospital operative mortality for cardiac surgery. Low <2%, Moderate 2–5%, High ≥5%.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Patient Demographics")
                // Age is a continuous variable — use a Stepper-like apacheSegment with representative bands
                apacheSegment("Age (years)", selection: $euroScI.age,
                    options: [
                        (60, "60 — reference (age ≤60 = 0 boost)"),
                        (65, "65"),
                        (70, "70"),
                        (75, "75"),
                        (80, "80"),
                        (85, "85"),
                        (90, "≥90")
                    ])
                scoreToggle("Female sex", binding: $euroScI.female, points: "+0.22", autoKey: "female")
                sectionHeader("Co-Morbidities")
                apacheSegment("Renal Impairment", selection: $euroScI.renalImpairment,
                    options: [
                        (0, "0 — None (creatinine ≤150 μmol/L)"),
                        (1, "1 — Creatinine 151–176 μmol/L"),
                        (2, "2 — Dialysis or creatinine >176 μmol/L")
                    ])
                scoreToggle("Extracardiac arteriopathy (claudication, carotid stenosis, aortic intervention)", binding: $euroScI.extracardiacArteriopathy, points: "+0.51", autoKey: "extracardiacArteriopathy")
                scoreToggle("Poor mobility (musculoskeletal or neurological dysfunction)", binding: $euroScI.poorMobility, points: "+0.30", autoKey: "poorMobility")
                scoreToggle("Previous cardiac surgery (redo procedure)", binding: $euroScI.previousCardiacSurgery, points: "+1.00", autoKey: "previousCardiacSurgery")
                scoreToggle("Chronic lung disease (long-term bronchodilators or steroids)", binding: $euroScI.chronicLungDisease, points: "+0.19", autoKey: "chronicLungDisease")
                scoreToggle("Active endocarditis (on antibiotics at time of surgery)", binding: $euroScI.activeEndocarditis, points: "+0.62", autoKey: "activeEndocarditis")
                scoreToggle("Critical preoperative state (VT/VF, cardiac massage, ventilated, acute renal failure, IABP/LVAD)", binding: $euroScI.criticalPreoperativeState, points: "+1.09", autoKey: "criticalPreoperativeState")
                scoreToggle("Diabetes mellitus on insulin", binding: $euroScI.diabetesOnInsulin, points: "+0.33", autoKey: "diabetesOnInsulin")
                sectionHeader("Cardiac Status")
                apacheSegment("NYHA Class", selection: $euroScI.nyhaClass,
                    options: [
                        (0, "I — No symptoms"),
                        (1, "II — Symptoms on moderate exertion"),
                        (2, "III — Symptoms on mild exertion"),
                        (3, "IV — Symptoms at rest")
                    ])
                scoreToggle("CCS Class IV angina (symptoms at rest)", binding: $euroScI.ccsClass4Angina, points: "+0.22", autoKey: "ccsClass4Angina")
                apacheSegment("LV Function (EF)", selection: $euroScI.lvFunction,
                    options: [
                        (0, "0 — Good: EF >50%"),
                        (1, "1 — Moderate: EF 31–50%"),
                        (2, "2 — Poor: EF ≤30%")
                    ])
                scoreToggle("Recent MI within 90 days", binding: $euroScI.recentMI, points: "+0.55", autoKey: "recentMI")
                apacheSegment("Pulmonary Hypertension", selection: $euroScI.pulmonaryHypertension,
                    options: [
                        (0, "0 — None or trivial (PASP ≤30 mmHg)"),
                        (1, "1 — Moderate (PASP 31–55 mmHg)"),
                        (2, "2 — Severe (PASP >55 mmHg)")
                    ])
                sectionHeader("Operation Details")
                apacheSegment("Urgency", selection: $euroScI.urgency,
                    options: [
                        (0, "0 — Elective"),
                        (1, "1 — Urgent (not immediately life-threatening)"),
                        (2, "2 — Emergency (before next working day)"),
                        (3, "3 — Salvage (CPR en route to OR)")
                    ])
                apacheSegment("Weight of Procedure", selection: $euroScI.weightOfIntervention,
                    options: [
                        (0, "0 — Isolated CABG"),
                        (1, "1 — Single non-CABG procedure"),
                        (2, "2 — Two procedures"),
                        (3, "3 — Three or more procedures")
                    ])
                scoreToggle("Surgery on thoracic aorta", binding: $euroScI.surgeryOnThoracicAorta, points: "+1.17", autoKey: "surgeryOnThoracicAorta")
                scoreToggle("Post-infarct ventricular septal rupture", binding: $euroScI.postInfarctSeptalRupture, points: "+1.46", autoKey: "postInfarctSeptalRupture")
            }
            .onChange(of: euroScI) { _, _ in recalculate() }
        }
    }

    // MARK: - Barthel Index (ADL Functional Independence)

    private var barthelForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Barthel Index of Activities of Daily Living (Mahoney & Barthel 1965). 10 items totalling 0–100. Higher score = greater independence. Severe dependency 0–20; Moderate 21–60; Mild 61–90; Independent ≥91.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Self-Care")
                apacheSegment("Feeding", selection: $barthelI.feeding,
                    options: [(0, "0 — Unable / totally dependent"), (5, "5 — Needs help (e.g. cutting food)"), (10, "10 — Independent")])
                apacheSegment("Bathing", selection: $barthelI.bathing,
                    options: [(0, "0 — Dependent"), (5, "5 — Independent (can bath/shower unsupervised)")])
                apacheSegment("Grooming", selection: $barthelI.grooming,
                    options: [(0, "0 — Dependent (face, hair, teeth, shaving)"), (5, "5 — Independent")])
                apacheSegment("Dressing", selection: $barthelI.dressing,
                    options: [(0, "0 — Dependent"), (5, "5 — Needs help but does ≥50% unaided"), (10, "10 — Independent")])
                sectionHeader("Continence")
                apacheSegment("Bowel Control", selection: $barthelI.bowels,
                    options: [(0, "0 — Incontinent or needs enemas"), (5, "5 — Occasional accident (<once/week)"), (10, "10 — Continent")])
                apacheSegment("Bladder Control", selection: $barthelI.bladder,
                    options: [(0, "0 — Incontinent or catheterised and unable to manage"), (5, "5 — Occasional accident (<once/24 h)"), (10, "10 — Continent")])
                apacheSegment("Toilet Use", selection: $barthelI.toiletUse,
                    options: [(0, "0 — Dependent"), (5, "5 — Needs help but can do something unaided"), (10, "10 — Independent (on/off, wiping, clothing)")])
                sectionHeader("Mobility & Transfers")
                apacheSegment("Transfers (Bed ↔ Chair)", selection: $barthelI.transfers,
                    options: [
                        (0,  "0 — Unable; no sitting balance"),
                        (5,  "5 — Major help needed (physical, 2 people)"),
                        (10, "10 — Minor help needed (verbal or physical)"),
                        (15, "15 — Independent")
                    ])
                apacheSegment("Mobility (Level Ground)", selection: $barthelI.mobility,
                    options: [
                        (0,  "0 — Immobile"),
                        (5,  "5 — Wheelchair independent, including corners"),
                        (10, "10 — Walks with help of 1 person (verbal or physical) ≥50 m"),
                        (15, "15 — Independent (may use aid) ≥50 m")
                    ])
                apacheSegment("Stairs", selection: $barthelI.stairs,
                    options: [(0, "0 — Unable"), (5, "5 — Needs help (verbal, physical, or carrying aid)"), (10, "10 — Independent up and down")])
            }
            .onChange(of: barthelI) { _, _ in recalculate() }
        }
    }

    // MARK: - DASI (Duke Activity Status Index)

    private var dasiForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Duke Activity Status Index (Hlatky MA et al. Am J Cardiol 1989;64:651–654). 12 yes/no questions weighted by MET equivalent. DASI <34 ≈ <4 METs (poor functional capacity, elevated perioperative cardiac risk); 34–46 ≈ 4–6 METs (moderate); >46 ≈ >6 METs (good).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Activities of Daily Living")
                scoreToggle("Can take care of yourself (eating, dressing, bathing, toilet)", binding: $dasiI.takeCareOfSelf, points: "+2.75", autoKey: "takeCareOfSelf")
                scoreToggle("Can walk indoors on level ground", binding: $dasiI.walkIndoors, points: "+1.75", autoKey: "walkIndoors")
                scoreToggle("Can walk 1–2 blocks on level ground", binding: $dasiI.walkOneOrTwoBlocks, points: "+2.75", autoKey: "walkOneOrTwoBlocks")
                sectionHeader("Physical Exertion")
                scoreToggle("Can climb a flight of stairs or walk up a hill", binding: $dasiI.climbStairs, points: "+5.50", autoKey: "climbStairs")
                scoreToggle("Can run a short distance", binding: $dasiI.runShortDistance, points: "+8.00", autoKey: "runShortDistance")
                sectionHeader("Household Work")
                scoreToggle("Can do light housework (dusting, washing dishes)", binding: $dasiI.doLightWork, points: "+2.70", autoKey: "doLightWork")
                scoreToggle("Can do moderate housework (vacuuming, sweeping, carrying groceries)", binding: $dasiI.doModerateWork, points: "+3.50", autoKey: "doModerateWork")
                scoreToggle("Can do heavy work (scrubbing floors, moving furniture)", binding: $dasiI.doHeavyWork, points: "+8.00", autoKey: "doHeavyWork")
                scoreToggle("Can do yardwork (raking, weeding, pushing lawn mower)", binding: $dasiI.doYardWork, points: "+4.50", autoKey: "doYardWork")
                sectionHeader("Recreation")
                scoreToggle("Can have sexual activity", binding: $dasiI.haveSexualActivity, points: "+5.25", autoKey: "haveSexualActivity")
                scoreToggle("Moderate recreation (golf, bowling, dancing, doubles tennis)", binding: $dasiI.participateInModerateRecreation, points: "+6.00", autoKey: "participateInModerateRecreation")
                scoreToggle("Strenuous sports (swimming, singles tennis, football, basketball, skiing)", binding: $dasiI.participateInStrenuous, points: "+7.50", autoKey: "participateInStrenuous")
            }
            .onChange(of: dasiI) { _, _ in recalculate() }
        }
    }

    // MARK: - Clinical Frailty Scale

    private var cfsForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Clinical Frailty Scale (Rockwood et al, CMAJ 2005). 9-level ordinal scale for adults ≥65. Levels 1–3 = non-frail; 4 = vulnerable; 5–6 = frail (mild–moderate); 7–8 = severe; 9 = terminal illness. Each level ≥5 increases perioperative mortality and morbidity.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Frailty Level")
                apacheSegment("CFS Level", selection: $cfsI.level,
                    options: [
                        (1, "1 — Very Fit: robust, active, energetic; exercises regularly; among fittest for age"),
                        (2, "2 — Fit: no active disease symptoms; exercises or very active occasionally"),
                        (3, "3 — Managing Well: medical problems well controlled; not regularly active beyond routine walking"),
                        (4, "4 — Vulnerable: not dependent; but symptoms limit activities; often tired/slowed down"),
                        (5, "5 — Mildly Frail: evident slowing; dependent on others for heavy housework, finances, medications"),
                        (6, "6 — Moderately Frail: needs help with all outside activities; bathing or dressing indoors"),
                        (7, "7 — Severely Frail: completely dependent for personal care; stable, not at high risk of dying <6 months"),
                        (8, "8 — Very Severely Frail: completely dependent; approaching end of life; minor illness could be fatal"),
                        (9, "9 — Terminally Ill: life expectancy <6 months; not otherwise evidently frail")
                    ])
            }
            .onChange(of: cfsI) { _, _ in recalculate() }
        }
    }

    // MARK: - Mallampati Airway Classification

    private var mallampatiForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Modified Mallampati Airway Classification (Mallampati et al, Can Anaesth Soc J 1985; Samsoon & Young, Anaesthesia 1987). Class I–IV based on oropharyngeal visibility. Additional predictors further increase difficult airway risk.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Mallampati Class (mouth open, tongue protruded, no phonation)")
                apacheSegment("Mallampati Class", selection: $mallampatiI.mallampatiClass,
                    options: [
                        (1, "Class I — Soft palate, uvula, fauces, tonsillar pillars fully visible"),
                        (2, "Class II — Soft palate, uvula, fauces visible (pillars obscured by tongue)"),
                        (3, "Class III — Soft palate and base of uvula visible only"),
                        (4, "Class IV — Only hard palate visible (soft palate not seen)")
                    ])
                sectionHeader("Additional Airway Predictors")
                scoreToggle("Reduced mouth opening (<4 cm / <3 finger-breadths)", binding: $mallampatiI.mouthOpening, points: "+risk", autoKey: "mouthOpening")
                scoreToggle("Restricted neck extension (<80°)", binding: $mallampatiI.neckMobility, points: "+risk", autoKey: "neckMobility")
                scoreToggle("Short thyromental distance (<6 cm / <3 finger-breadths)", binding: $mallampatiI.thyromental, points: "+risk", autoKey: "thyromental")
                scoreToggle("Retrognathia / micrognathia", binding: $mallampatiI.retrognathia, points: "+risk", autoKey: "retrognathia")
                scoreToggle("Obesity (BMI ≥30) or neck circumference ≥40 cm", binding: $mallampatiI.obesity, points: "+risk", autoKey: "obesity")
                scoreToggle("Beard or poorly-fitting dentures", binding: $mallampatiI.beardOrDentures, points: "+risk", autoKey: "beardOrDentures")
            }
            .onChange(of: mallampatiI) { _, _ in recalculate() }
        }
    }

    // MARK: - HEART Score

    private var heartForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("HEART Score for chest pain triage (Backus et al, Neth Heart J 2010). Five domains 0–2 each; total 0–10. ≤3=low risk (<2% MACE), 4–6=moderate (~12–25%), ≥7=high (~50–65%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("History (clinical suspicion)")
                apacheSegment("History", selection: $heartI.history,
                    options: [
                        (0, "0 — Slightly suspicious (history mostly non-cardiac)"),
                        (1, "1 — Moderately suspicious (mixed cardiac and non-cardiac features)"),
                        (2, "2 — Highly suspicious (history predominantly cardiac)")
                    ])
                sectionHeader("ECG")
                apacheSegment("ECG", selection: $heartI.ecg,
                    options: [
                        (0, "0 — Normal ECG"),
                        (1, "1 — Non-specific repolarisation disturbance (LBBB, LVH, early repol, digoxin changes)"),
                        (2, "2 — Significant ST deviation (new ST depression/elevation ≥2 mm, TWI)")
                    ])
                sectionHeader("Age")
                apacheSegment("Age", selection: $heartI.ageScore,
                    options: [
                        (0, "0 — Age <45"),
                        (1, "1 — Age 45–64"),
                        (2, "2 — Age ≥65")
                    ])
                sectionHeader("Risk Factors")
                apacheSegment("Risk Factors", selection: $heartI.riskFactors,
                    options: [
                        (0, "0 — No known risk factors"),
                        (1, "1 — 1–2 risk factors (HTN, hypercholesterolaemia, DM, obesity BMI>30, smoking, +FH) OR atherosclerosis without disease"),
                        (2, "2 — ≥3 risk factors OR known atherosclerotic disease (prior MI, PCI, CABG, stroke, PAD)")
                    ])
                sectionHeader("Troponin")
                apacheSegment("Troponin", selection: $heartI.troponin,
                    options: [
                        (0, "0 — ≤ normal limit"),
                        (1, "1 — 1–3× normal limit"),
                        (2, "2 — >3× normal limit")
                    ])
            }
            .onChange(of: heartI) { _, _ in recalculate() }
        }
    }

    // MARK: - Forrest Classification

    private var forrestForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Forrest Classification of peptic ulcer bleeding (Forrest et al, Lancet 1974; Laine & Peterson, N Engl J Med 1994). Endoscopic classification. Guides need for endoscopic haemostasis and rebleeding risk stratification.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Endoscopic Finding")
                apacheSegment("Forrest Grade", selection: $forrestI.grade,
                    options: [
                        (1, "Ia — Spurting haemorrhage (active bleeding jet; rebleed ~90%)"),
                        (2, "Ib — Oozing haemorrhage (active bleeding ooze; rebleed ~55%)"),
                        (3, "IIa — Visible vessel (non-bleeding; rebleed ~43%)"),
                        (4, "IIb — Adherent clot (rebleed ~22%)"),
                        (5, "IIc — Flat pigmented spot (rebleed ~10%)"),
                        (6, "III — Clean ulcer base (rebleed ~5%)")
                    ])
            }
            .onChange(of: forrestI) { _, _ in recalculate() }
        }
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

    @ViewBuilder private var mpiBodySection: some View {
        Group {
            sectionHeader("Patient Factors")
            scoreToggle("Age >50 years",         binding: $mpiI.ageOver50,   points: "+5", autoKey: "ageOver50")
            scoreToggle("Female sex",             binding: $mpiI.femaleSex,   points: "+5", autoKey: "femaleSex")
            scoreToggle("Organ failure (BP <80 mmHg, Cr >177 µmol/L, or respiratory failure)",
                        binding: $mpiI.organFailure, points: "+7", autoKey: "organFailure")
            scoreToggle("Malignancy",             binding: $mpiI.malignancy,  points: "+4", autoKey: "malignancy")
        }
        .onChange(of: mpiI) { _, _ in recalculate() }
        Group {
            sectionHeader("Operative Findings")
            scoreToggle("Pre-op peritonitis duration >24 h",
                        binding: $mpiI.durationOver24h,       points: "+4", autoKey: "durationOver24h")
            scoreToggle("Non-colonic source (gastric / duodenal / small bowel)",
                        binding: $mpiI.nonColonicOrigin,      points: "+4", autoKey: "nonColonicOrigin")
            scoreToggle("Generalised (4-quadrant) peritonitis",
                        binding: $mpiI.generalizedPeritonitis, points: "+6", autoKey: "generalizedPeritonitis")
            apacheSegment("Exudate Character", selection: $mpiI.exudate,
                options: [(0, "Clear / serous"), (6, "Cloudy / purulent"), (12, "Faecal / faeculent")])
        }
        .onChange(of: mpiI) { _, _ in recalculate() }
    }

    private func scoreHistoryColor(_ riskRaw: String) -> Color {
        switch riskRaw {
        case ScoreRisk.low.rawValue:      return .green
        case ScoreRisk.moderate.rawValue: return .orange
        case ScoreRisk.high.rawValue:     return Color(red: 0.9, green: 0.4, blue: 0.1)
        default:                          return .red
        }
    }

    // MARK: - NIHSS (NIH Stroke Scale)

    private var nihssForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("NIH Stroke Scale (Brott T et al. Stroke 1989;20:864–870; Adams HP et al. Stroke 1999;30:2315–2328). 15 items; total 0–42. 0 = no deficit; 1–4 = minor; 5–15 = moderate; 16–20 = moderate-severe; 21–42 = severe. Requires bedside neurological examination.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Level of Consciousness (Item 1a–1c)")
                apacheSegment("1a. Consciousness Level", selection: $nihssI.consciousness,
                    options: [
                        (0, "0 — Alert; keenly responsive"),
                        (1, "1 — Not alert; arousable by minor stimulation"),
                        (2, "2 — Not alert; requires repeated stimulation or painful stimuli"),
                        (3, "3 — Unresponsive or responds only with reflex motor")
                    ])
                apacheSegment("1b. LOC Questions (month + age)", selection: $nihssI.locQuestions,
                    options: [
                        (0, "0 — Both correct"),
                        (1, "1 — One correct (or intubated / dysarthric / dysphasic)"),
                        (2, "2 — Neither correct")
                    ])
                apacheSegment("1c. LOC Commands (open/close eyes, grip/release)", selection: $nihssI.locCommands,
                    options: [
                        (0, "0 — Both obeyed"),
                        (1, "1 — One obeyed"),
                        (2, "2 — Neither obeyed")
                    ])
                sectionHeader("Eye Movements & Visual Fields (Items 2–3)")
                apacheSegment("2. Best Gaze", selection: $nihssI.gazeDeviation,
                    options: [
                        (0, "0 — Normal"),
                        (1, "1 — Partial gaze palsy; gaze abnormal but not forced"),
                        (2, "2 — Forced deviation; total gaze paresis not overcome by oculocephalic manoeuvre")
                    ])
                apacheSegment("3. Visual Fields", selection: $nihssI.visualFields,
                    options: [
                        (0, "0 — No visual loss"),
                        (1, "1 — Partial hemianopia"),
                        (2, "2 — Complete hemianopia"),
                        (3, "3 — Bilateral hemianopia / cortical blindness")
                    ])
                sectionHeader("Face & Motor Function (Items 4–8)")
                apacheSegment("4. Facial Palsy", selection: $nihssI.facialPalsy,
                    options: [
                        (0, "0 — Normal"),
                        (1, "1 — Minor paralysis (flattened nasolabial fold, asymmetric smile)"),
                        (2, "2 — Partial paralysis (lower face only)"),
                        (3, "3 — Complete paralysis; upper and lower face")
                    ])
                apacheSegment("5a. Motor Arm — Left", selection: $nihssI.motorArmLeft,
                    options: [
                        (0, "0 — No drift; holds 90° (or 45°) for 10 s"),
                        (1, "1 — Drift; holds 90° but drifts before 10 s; does not hit bed"),
                        (2, "2 — Some effort against gravity; arm cannot reach or maintain 90°"),
                        (3, "3 — No effort against gravity; arm falls"),
                        (4, "4 — No movement")
                    ])
                apacheSegment("5b. Motor Arm — Right", selection: $nihssI.motorArmRight,
                    options: [
                        (0, "0 — No drift"),
                        (1, "1 — Drift before 10 s"),
                        (2, "2 — Some effort against gravity"),
                        (3, "3 — No effort against gravity"),
                        (4, "4 — No movement")
                    ])
                apacheSegment("6a. Motor Leg — Left", selection: $nihssI.motorLegLeft,
                    options: [
                        (0, "0 — No drift; holds 30° for 5 s"),
                        (1, "1 — Drift; leg falls by end of 5 s but does not hit bed"),
                        (2, "2 — Some effort against gravity; falls to bed within 5 s"),
                        (3, "3 — No effort against gravity; falls immediately"),
                        (4, "4 — No movement")
                    ])
                apacheSegment("6b. Motor Leg — Right", selection: $nihssI.motorLegRight,
                    options: [
                        (0, "0 — No drift"),
                        (1, "1 — Drift before 5 s"),
                        (2, "2 — Some effort against gravity"),
                        (3, "3 — No effort against gravity"),
                        (4, "4 — No movement")
                    ])
                sectionHeader("Coordination, Sensation & Language (Items 7–11)")
                apacheSegment("7. Limb Ataxia", selection: $nihssI.limbAtaxia,
                    options: [
                        (0, "0 — Absent"),
                        (1, "1 — Present in one limb"),
                        (2, "2 — Present in two limbs")
                    ])
                apacheSegment("8. Sensory", selection: $nihssI.sensory,
                    options: [
                        (0, "0 — Normal; no sensory loss"),
                        (1, "1 — Mild-moderate sensory loss; feels pinprick as less sharp"),
                        (2, "2 — Severe to total sensory loss; patient unaware of being touched")
                    ])
                apacheSegment("9. Best Language", selection: $nihssI.language,
                    options: [
                        (0, "0 — No aphasia; normal"),
                        (1, "1 — Mild-moderate aphasia; some obvious loss; can identify"),
                        (2, "2 — Severe aphasia; fragmentary expression; cannot identify"),
                        (3, "3 — Mute; global aphasia; no usable speech or auditory comprehension")
                    ])
                apacheSegment("10. Dysarthria", selection: $nihssI.dysarthria,
                    options: [
                        (0, "0 — Normal"),
                        (1, "1 — Mild-moderate; slurred but understandable"),
                        (2, "2 — Severe; unintelligible or mute / intubated")
                    ])
                apacheSegment("11. Extinction / Inattention", selection: $nihssI.extinction,
                    options: [
                        (0, "0 — No abnormality"),
                        (1, "1 — Inattention or extinction to one modality"),
                        (2, "2 — Profound hemi-inattention / extinction to more than one modality")
                    ])
            }
            .onChange(of: nihssI) { _, _ in recalculate() }
        }
    }

    // MARK: - modified Rankin Scale (mRS)

    private var mrsForm: some View {
        Group {
            apacheSegment("Disability Level", selection: $mrsI.level,
                options: [
                    (0, "0 — No symptoms"),
                    (1, "1 — No significant disability; performs all usual activities despite symptoms"),
                    (2, "2 — Slight disability; unable to perform all previous activities, independent"),
                    (3, "3 — Moderate disability; requires some help, walks without assistance"),
                    (4, "4 — Moderately severe disability; unable to walk or attend to bodily needs without assistance"),
                    (5, "5 — Severe disability; bedridden, incontinent, requires constant nursing care"),
                    (6, "6 — Dead")
                ])
        }
        .onChange(of: mrsI) { _, _ in recalculate() }
    }

    // MARK: - MUST (Malnutrition Universal Screening Tool)

    private var mustForm: some View {
        Group {
            apacheSegment("1. BMI Score", selection: $mustI.bmiScore,
                options: [
                    (0, "0 — BMI >20 kg/m²"),
                    (1, "1 — BMI 18.5–20 kg/m²"),
                    (2, "2 — BMI <18.5 kg/m²")
                ])
            apacheSegment("2. Unintentional Weight Loss (past 3–6 months)", selection: $mustI.weightLossScore,
                options: [
                    (0, "0 — Weight loss <5%"),
                    (1, "1 — Weight loss 5–10%"),
                    (2, "2 — Weight loss >10%")
                ])
            apacheSegment("3. Acute Disease Effect", selection: $mustI.acuteDiseaseScore,
                options: [
                    (0, "0 — No acute disease effect (or not applicable)"),
                    (2, "2 — Acutely ill and no nutritional intake likely for >5 days")
                ])
        }
        .onChange(of: mustI) { _, _ in recalculate() }
    }

    // MARK: - Clavien-Dindo

    private var clavienDindoForm: some View {
        Group {
            apacheSegment("Complication Grade", selection: $cdI.grade,
                options: [
                    (0, "None — Uneventful postoperative course"),
                    (1, "Grade I — Minor deviation; bedside management only (antiemetic, analgesia, diuretic, physio)"),
                    (2, "Grade II — Pharmacological treatment, blood transfusion, or TPN required"),
                    (3, "Grade IIIa — Surgical/endoscopic/radiological intervention without GA"),
                    (4, "Grade IIIb — Surgical/endoscopic/radiological intervention under GA"),
                    (5, "Grade IVa — Life-threatening; single organ dysfunction (ICU)"),
                    (6, "Grade IVb — Life-threatening; multiorgan dysfunction (ICU)"),
                    (7, "Grade V — Death")
                ])
        }
        .onChange(of: cdI) { _, _ in recalculate() }
    }

    // MARK: - Modified Aldrete

    private var aldreteForm: some View {
        Group {
            apacheSegment("Activity — Voluntary limb movement", selection: $aldreteI.activity,
                options: [
                    (0, "0 — Unable to move any extremity on command"),
                    (1, "1 — Able to move 2 extremities on command"),
                    (2, "2 — Able to move all extremities on command")
                ])
            apacheSegment("Respiration", selection: $aldreteI.respiration,
                options: [
                    (0, "0 — Apnoeic"),
                    (1, "1 — Dyspnoea, shallow or limited breathing"),
                    (2, "2 — Able to breathe deeply and cough freely")
                ])
            apacheSegment("Circulation — BP vs. pre-operative baseline", selection: $aldreteI.circulation,
                options: [
                    (0, "0 — BP ±>50 mmHg of pre-op value"),
                    (1, "1 — BP ±20–50 mmHg of pre-op value"),
                    (2, "2 — BP ±<20 mmHg of pre-op value")
                ])
            apacheSegment("Consciousness", selection: $aldreteI.consciousness,
                options: [
                    (0, "0 — Not responding to stimuli"),
                    (1, "1 — Arousable on calling"),
                    (2, "2 — Fully awake")
                ])
            apacheSegment("Oxygen Saturation", selection: $aldreteI.oxygenSat,
                options: [
                    (0, "0 — SpO₂ <90% even with O₂ supplementation"),
                    (1, "1 — Needs O₂ supplementation to maintain SpO₂ ≥90%"),
                    (2, "2 — SpO₂ ≥92% on room air")
                ])
        }
        .onChange(of: aldreteI) { _, _ in recalculate() }
    }

    // MARK: - 4T Score (HIT)

    private var fourTForm: some View {
        Group {
            apacheSegment("1. Thrombocytopenia", selection: $fourTI.thrombocytopenia,
                options: [
                    (0, "0 — Platelet fall <30%, or nadir <10 × 10⁹/L"),
                    (1, "1 — Platelet fall 30–50%, or nadir 10–19 × 10⁹/L"),
                    (2, "2 — Platelet fall >50% AND nadir ≥20 × 10⁹/L")
                ])
            apacheSegment("2. Timing of platelet fall", selection: $fourTI.timing,
                options: [
                    (0, "0 — Platelet fall <4 days, no recent heparin exposure"),
                    (1, "1 — Consistent with days 5–10 but not clear; or fall after day 10"),
                    (2, "2 — Onset days 5–10, or ≤1 day if heparin exposure in past 30 days")
                ])
            apacheSegment("3. Thrombosis or other sequelae", selection: $fourTI.thrombosis,
                options: [
                    (0, "0 — None"),
                    (1, "1 — Progressive or recurrent thrombosis; non-necrotising skin lesions"),
                    (2, "2 — New proven thrombosis, skin necrosis, or acute systemic reaction after IV heparin bolus")
                ])
            apacheSegment("4. Other cause for thrombocytopenia", selection: $fourTI.otherCause,
                options: [
                    (0, "0 — Definite other cause present"),
                    (1, "1 — Possible other cause"),
                    (2, "2 — No other cause evident")
                ])
        }
        .onChange(of: fourTI) { _, _ in recalculate() }
    }

    // MARK: - Oakland Score (LGIB)

    private var oaklandForm: some View {
        Group {
            apacheSegment("Age", selection: $oaklandI.ageScore,
                options: [
                    (0, "0 — Age <40 years"),
                    (1, "1 — Age 40–69 years"),
                    (2, "2 — Age ≥70 years")
                ])
            scoreToggle("Male sex", binding: $oaklandI.sexMale, points: "+1")
            scoreToggle("Previous hospital admission for LGIB", binding: $oaklandI.previousLGIB, points: "+1")
            apacheSegment("Digital rectal examination (DRE)", selection: $oaklandI.dre,
                options: [
                    (0, "0 — No blood on DRE"),
                    (1, "1 — Blood on DRE")
                ])
            apacheSegment("Heart rate (bpm)", selection: $oaklandI.heartRate,
                options: [
                    (0, "0 — Heart rate <70 bpm"),
                    (1, "1 — Heart rate 70–89 bpm"),
                    (2, "2 — Heart rate ≥90 bpm")
                ])
            apacheSegment("Systolic blood pressure (mmHg)", selection: $oaklandI.sbp,
                options: [
                    (0, "0 — SBP ≥160 mmHg"),
                    (1, "1 — SBP 130–159 mmHg"),
                    (2, "2 — SBP 100–129 mmHg"),
                    (3, "3 — SBP <100 mmHg")
                ])
            apacheSegment("Haemoglobin (g/dL)", selection: $oaklandI.hbScore,
                options: [
                    (0, "0 — Hb ≥16.0 (M) / ≥13.0 (F) g/dL"),
                    (1, "1 — Hb 13.0–15.9 (M) / 11.0–12.9 (F) g/dL"),
                    (2, "2 — Hb 11.0–12.9 (M) / 9.0–10.9 (F) g/dL"),
                    (3, "3 — Hb 9.0–10.9 (M) / 7.0–8.9 (F) g/dL"),
                    (4, "4 — Hb 7.0–8.9 g/dL"),
                    (5, "5 — Hb <7.0 g/dL")
                ])
        }
        .onChange(of: oaklandI) { _, _ in recalculate() }
    }

    private var kingsCriteriaForm: some View {
        Group {
            scoreToggle("Paracetamol (acetaminophen) aetiology", binding: $kingsI.isParacetamol, points: "arm")
            Divider().padding(.vertical, 4)
            if kingsI.isParacetamol {
                Text("Paracetamol arm — Criteria").font(.caption).foregroundStyle(.secondary).padding(.top, 2)
                scoreToggle("Arterial pH < 7.30 (after resuscitation)", binding: $kingsI.acidosisPhBelow730, points: "single")
                Text("— OR all three of —").font(.caption).foregroundStyle(.secondary).italic()
                scoreToggle("Prothrombin time > 100 s", binding: $kingsI.ptAbove100, points: "triple")
                scoreToggle("Creatinine > 300 µmol/L", binding: $kingsI.creatinineAbove300, points: "triple")
                scoreToggle("Hepatic encephalopathy grade III or IV", binding: $kingsI.encephalopathyGrade34, points: "triple")
            } else {
                Text("Non-paracetamol arm — Criteria").font(.caption).foregroundStyle(.secondary).padding(.top, 2)
                scoreToggle("Prothrombin time > 100 s (alone sufficient)", binding: $kingsI.ptAbove100, points: "major")
                Text("— OR ≥ 3 of the following —").font(.caption).foregroundStyle(.secondary).italic()
                scoreToggle("Prothrombin time > 50 s", binding: $kingsI.ptAbove50, points: "minor")
                scoreToggle("Age < 10 or > 40 years", binding: $kingsI.ageUnder10OrAbove40, points: "minor")
                scoreToggle("Jaundice to encephalopathy > 7 days", binding: $kingsI.jaundiceToDays, points: "minor")
                scoreToggle("Bilirubin > 300 µmol/L", binding: $kingsI.bilirubinAbove300, points: "minor")
                scoreToggle("Unfavourable aetiology (drug/indeterminate)", binding: $kingsI.unfavourableAetiology, points: "minor")
            }
        }
        .onChange(of: kingsI) { _, _ in recalculate() }
    }

    private var ecogForm: some View {
        Group {
            apacheSegment("Performance Status Grade", selection: $ecogI.grade,
                options: [
                    (0, "0 — Fully active, no restriction"),
                    (1, "1 — Restricted strenuous activity"),
                    (2, "2 — Ambulatory; unable to work"),
                    (3, "3 — Limited self-care; >50% bedbound"),
                    (4, "4 — Completely disabled; bedbound")
                ])
        }
        .onChange(of: ecogI) { _, _ in recalculate() }
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

    private var kdigoForm: some View {
        Group {
            apacheSegment("Creatinine Rise from Baseline", selection: $kdigoI.creatinineRise,
                options: [
                    (0, "0 — <1.5× baseline"),
                    (1, "1 — 1.5–1.9× baseline"),
                    (2, "2 — 2.0–2.9× baseline"),
                    (3, "3 — ≥3× or >354 µmol/L")
                ])
            apacheSegment("Urine Output", selection: $kdigoI.urineOutput,
                options: [
                    (0, "0 — Normal"),
                    (1, "1 — <0.5 mL/kg/h ×6 h"),
                    (2, "2 — <0.5 mL/kg/h ×12 h"),
                    (3, "3 — <0.3 mL/kg/h ×24 h or anuria ×12 h")
                ])
            scoreToggle("Renal replacement therapy required", binding: $kdigoI.requiresRRT, points: "Stage 3")
        }
        .onChange(of: kdigoI) { _, _ in recalculate() }
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

    // MARK: - NUTRIC Score (#62)

    private var nutricForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(nutricI.age) }, set: { nutricI.age = Int($0) }),
                       range: 18...100, step: 1, unit: "yrs")
            apacheSegment("APACHE II score at ICU admission", selection: $nutricI.apacheII,
                options: [
                    (0, "< 15"),
                    (10, "15–19"),
                    (20, "20–27"),
                    (28, "≥ 28")
                ])
            apacheSegment("SOFA score at ICU admission", selection: $nutricI.sofa,
                options: [
                    (0, "< 6"),
                    (6, "6–9"),
                    (10, "≥ 10")
                ])
            apacheSegment("Number of comorbidities (Charlson-equivalent)", selection: $nutricI.comorbidities,
                options: [
                    (0, "0–1"),
                    (2, "≥ 2")
                ])
            apacheSegment("Days from hospital admission to ICU", selection: $nutricI.daysHospitalToICU,
                options: [
                    (0, "0–1 days"),
                    (2, "≥ 2 days")
                ])
        }
        .onChange(of: nutricI) { _, _ in recalculate() }
    }

    // MARK: - sPESI (#67)

    private var spesiForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(spesiI.age) }, set: { spesiI.age = Int($0) }),
                       range: 18...110, step: 1, unit: "yrs")
            scoreToggle("Active cancer (treatment within 6 months or palliative)",
                        binding: $spesiI.cancer, points: "+1", autoKey: "cancer")
            scoreToggle("Chronic cardiopulmonary disease (heart failure or COPD)",
                        binding: $spesiI.cardiopulmonaryDisease, points: "+1", autoKey: "cardiopulmonaryDisease")
            scoreToggle("Heart rate ≥ 110 bpm",
                        binding: $spesiI.heartRateAbove109, points: "+1", autoKey: "heartRateAbove109")
            scoreToggle("Systolic BP < 100 mmHg",
                        binding: $spesiI.sbpBelow100, points: "+1", autoKey: "sbpBelow100")
            scoreToggle("SpO₂ < 90%",
                        binding: $spesiI.spo2Below90, points: "+1", autoKey: "spo2Below90")
        }
        .onChange(of: spesiI) { _, _ in recalculate() }
    }

    // MARK: - DECAF (#68)

    private var decafForm: some View {
        Group {
            apacheSegment("MRC Dyspnoea Grade (baseline, pre-exacerbation)", selection: $decafI.dyspnoeaMRC,
                options: [
                    (1, "Grade 1 — breathless on strenuous exercise"),
                    (2, "Grade 2 — breathless hurrying on flat"),
                    (3, "Grade 3 — walks slower than peers; stops for breath"),
                    (4, "Grade 4 — stops for breath after 100 m on flat"),
                    (5, "Grade 5 — too breathless to leave house / undress")
                ])
            scoreToggle("Eosinopenia (eosinophils < 0.05 × 10⁹/L)",
                        binding: $decafI.eosinopenia, points: "+1", autoKey: "eosinopenia")
            scoreToggle("Consolidation on chest X-ray",
                        binding: $decafI.consolidation, points: "+1", autoKey: "consolidation")
            scoreToggle("Acidaemia (pH < 7.30 on ABG)",
                        binding: $decafI.acidaemia, points: "+1", autoKey: "acidaemia")
            scoreToggle("Atrial fibrillation (new or pre-existing)",
                        binding: $decafI.atrialFibrillation, points: "+1", autoKey: "atrialFibrillation")
        }
        .onChange(of: decafI) { _, _ in recalculate() }
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

}
