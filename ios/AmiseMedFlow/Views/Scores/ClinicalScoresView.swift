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
    case airScore         = "AIR Score (Appendicitis)"
    case perc             = "PERC Rule (PE Rule-out)"
    case shockIndex       = "Shock Index"
    case parkland         = "Parkland Formula (Burns)"
    case pas              = "Paediatric Appendicitis Score"
    case revisedGeneva    = "Revised Geneva Score (PE)"
    case cci              = "Charlson Comorbidity Index"
    case mfi5             = "Modified Frailty Index-5"
    case haps             = "Harmless Acute Pancreatitis Score"
    case glasgowImrie     = "Glasgow-Imrie Score"
    case albi             = "ALBI Score (Liver)"
    case auditC           = "AUDIT-C (Alcohol Screen)"
    case phq9             = "PHQ-9 (Depression)"
    case sapsII           = "SAPS II (ICU Severity)"
    case stone            = "STONE Score (Nephrolithiasis)"
    case losAngeles       = "LA Classification (GERD)"
    case meld3            = "MELD 3.0 (Liver Severity)"
    case braden           = "Braden Scale (Pressure Injury)"
    case centor           = "Centor / McIsaac (Pharyngitis)"
    case ipss             = "IPSS (Prostate Symptoms)"
    case trueloveWitts    = "Truelove-Witts (UC Severity)"
    case harveyBradshaw   = "Harvey-Bradshaw Index (Crohn's)"
    case maddrey          = "Maddrey Discriminant Function (Alcoholic Hepatitis)"
    case manning          = "Manning Criteria (IBS)"
    case lace             = "LACE Index (Readmission Risk)"
    case findRisc         = "FINDRISC (T2DM Risk)"
    case mirels           = "Mirels Criteria (Pathological Fracture)"
    case ckdEpi           = "CKD-EPI eGFR (Renal Staging)"
    case ariscat          = "ARISCAT (Pulmonary Complication Risk)"
    case fongCrs          = "Fong CRS (Colorectal Liver Mets)"
    case berlinARDS       = "Berlin Definition (ARDS)"
    case cage             = "CAGE Questionnaire (Alcohol Use Disorder)"
    case dukeIE           = "Duke Criteria (Infective Endocarditis)"
    case mmrc             = "mMRC Dyspnoea Scale"
    case pts              = "Paediatric Trauma Score (PTS)"
    case ripasa           = "RIPASA (Appendicitis Score)"
    case fgsi             = "FGSI (Fournier Gangrene)"

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
        case .asa, .childPugh, .meld, .stopBang, .fib4, .ppossum, .nrs2002, .mallampati, .cfs, .barthel:
            return .preop
        case .abcd2, .lrinec, .gcs, .nihss, .mrs:
            return .neuro
        case .must:
            return .preop
        case .clavienDindo, .aldrete:
            return .preop
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
        case .airScore:
            return .acute
        case .perc:
            return .vascular
        case .shockIndex:
            return .cardiac
        case .parkland:
            return .acute
        case .pas:
            return .acute
        case .revisedGeneva:
            return .vascular
        case .cci, .mfi5:
            return .preop
        case .haps, .glasgowImrie:
            return .gi
        case .albi:
            return .gi
        case .auditC:
            return .gi
        case .phq9:
            return .monitoring
        case .sapsII:
            return .sepsis
        case .stone:
            return .acute
        case .losAngeles:
            return .gi
        case .meld3:
            return .gi
        case .braden:
            return .monitoring
        case .centor:
            return .sepsis
        case .ipss:
            return .monitoring
        case .trueloveWitts:
            return .gi
        case .harveyBradshaw:
            return .gi
        case .maddrey:
            return .gi
        case .manning:
            return .gi
        case .lace:
            return .monitoring
        case .findRisc:
            return .monitoring
        case .mirels:
            return .preop
        case .ckdEpi:
            return .monitoring
        case .ariscat:
            return .preop
        case .fongCrs:
            return .gi
        case .berlinARDS:
            return .sepsis
        case .cage:
            return .monitoring
        case .dukeIE:
            return .cardiac
        case .mmrc:
            return .sepsis
        case .pts, .ripasa:
            return .acute
        case .fgsi:
            return .sepsis
        case .cha2ds2vasc, .hasBled, .heart, .timi, .grace, .rcri, .dasi, .euroScoreII:
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
        case .airScore:       return "allergens"
        case .perc:           return "checkmark.shield.fill"
        case .shockIndex:     return "bolt.heart.fill"
        case .parkland:       return "drop.triangle.fill"
        case .pas:            return "figure.child"
        case .revisedGeneva:  return "lungs"
        case .cci:            return "list.bullet.clipboard.fill"
        case .mfi5:           return "figure.walk.motion"
        case .haps:           return "flame.fill"
        case .glasgowImrie:   return "thermometer.sun.fill"
        case .albi:           return "drop.circle"
        case .auditC:         return "wineglass"
        case .phq9:           return "brain.head.profile"
        case .sapsII:         return "waveform.path.ecg.rectangle"
        case .stone:          return "diamond"
        case .losAngeles:     return "esophagus"
        case .meld3:          return "liver"
        case .braden:         return "bed.double"
        case .centor:         return "microbe"
        case .ipss:           return "drop.degreesign"
        case .trueloveWitts:  return "flame.circle"
        case .harveyBradshaw: return "chart.bar.xaxis"
        case .maddrey:        return "drop.triangle"
        case .manning:        return "list.bullet.clipboard"
        case .lace:           return "arrow.clockwise.heart"
        case .findRisc:       return "chart.line.uptrend.xyaxis"
        case .mirels:         return "figure.walk.broken"
        case .ckdEpi:         return "kidney"
        case .ariscat:        return "lungs"
        case .fongCrs:        return "cross.case"
        case .berlinARDS:     return "lungs.fill"
        case .cage:           return "wineglass.fill"
        case .dukeIE:         return "stethoscope"
        case .mmrc:           return "figure.walk.motion"
        case .pts:            return "cross.circle.fill"
        case .ripasa:         return "allergens"
        case .fgsi:           return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Main view

struct ClinicalScoresView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var modelContext

    @State var selectedCategory: ScoreCategory = .all
    @State var selectedScore: ActiveScore? = nil
    @State var result: ClinicalScore? = nil
    @State var isExportingScoresPDF = false
    @State var scoresShareURL: URL? = nil
    @State var showScoresShareSheet = false
    /// When true the full 101-score browse catalogue is shown; default is patient-specific view.
    @State var showingAllScores = false

    // Alvarado
    @State var alv = AlvaradoInput()
    // Tokyo Cholecystitis
    @State var tkyC = TokyoCholecystitisInput()
    // Tokyo Cholangitis
    @State var tkyG = TokyoCholangitisInput()
    // Ranson
    @State var ran = RansonInput()
    // Glasgow
    @State var glas = GlasgowPancreatitisInput()
    // Rockall
    @State var rock = RockallInput()
    // SIRS
    @State var sirsI = SIRSInput()
    // qSOFA
    @State var qsofaI = QSOFAInput()
    // Wells DVT
    @State var wDVT = WellsDVTInput()
    // Wells PE
    @State var wPE  = WellsPEInput()
    // ABCD2
    @State var abcd = ABCD2Input()
    // ABCD2 helper for duration (three-way choice)
    @State var abcdDuration: Int = 0  // 0 = <10min, 1 = 10-59min, 2 = ≥60min
    // LRINEC
    @State var lrin = LRINECInput()
    // RCRI
    @State var rcriI = RCRIInput()
    // Caprini
    @State var cap = CapriniInput()
    // Child-Pugh
    @State var cp = ChildPughInput()
    // MEWS
    @State var mewsI = MEWSInput()
    // GCS
    @State var gcsI = GCSInput()
    // ASA
    @State var asaI = ASAInput()
    // MELD
    @State var meldI = MELDInput()
    // CHA2DS2-VASc
    @State var cha2I = CHA2DS2VAScInput()
    // HAS-BLED
    @State var hblI = HASBLEDInput()
    // Blatchford
    @State var blatchI = BlatchfordInput()
    // STOP-BANG
    @State var sbangI = STOPBANGInput()
    // NEWS2
    @State var news2I = NEWS2Input()
    // PSI/PORT
    @State var psiI = PSIPortInput()
    // BISAP
    @State var bisapI = ClinicalScoringEngine.BISAPInput()
    // AIMS65
    @State var aims65I = ClinicalScoringEngine.AIMS65Input()
    // SOFA
    @State var sofaI = SOFAInput()
    // FIB-4
    @State var fib4I = FIB4Input()
    // CURB-65
    @State var curb65I = CURB65Input()
    // Padua
    @State var paduaI = PaduaInput()
    // APACHE II
    @State var apacheIII = APACHEIIInput()
    // P-POSSUM
    @State var ppossumI = PPOSSUMInput()
    // MPI
    @State var mpiI = MPIInput()
    // CTSI
    @State var ctsiI = CTSIInput()
    // NRS-2002
    @State var nrsI = NRS2002Input()
    // Forrest Classification
    @State var forrestI = ForrestInput()
    // HEART Score
    @State var heartI = HEARTInput()
    // Mallampati Airway
    @State var mallampatiI = MallampatiInput()
    // Clinical Frailty Scale
    @State var cfsI = ClinicalFrailtyInput()
    // TIMI
    @State var timiI = TIMIInput()
    // Waterlow
    @State var waterlowI = WaterlowInput()
    // Surgical Apgar Score
    @State var surgApgarI = SurgicalApgarInput()
    // GRACE Score
    @State var graceI = GRACEInput()
    // DASI
    @State var dasiI = DASIInput()
    // Barthel Index
    @State var barthelI = BarthelInput()
    // EuroSCORE II
    @State var euroScI = EuroScoreIIInput()
    // NIHSS
    @State var nihssI = NIHSSInput()
    // mRS
    @State var mrsI = ClinicalScoringEngine.MRSInput()
    // MUST
    @State var mustI = ClinicalScoringEngine.MUSTInput()
    // Clavien-Dindo
    @State var cdI = ClinicalScoringEngine.ClavienDindoInput()
    // Aldrete
    @State var aldreteI = ClinicalScoringEngine.AldreteInput()
    // 4T
    @State var fourTI = ClinicalScoringEngine.FourTInput()
    // Oakland
    @State var oaklandI = ClinicalScoringEngine.OaklandInput()
    // King's Criteria
    @State var kingsI = ClinicalScoringEngine.KingsCriteriaInput()
    // ECOG
    @State var ecogI = ClinicalScoringEngine.ECOGInput()
    // RTS
    @State var rtsI = ClinicalScoringEngine.RTSInput()
    // KDIGO AKI
    @State var kdigoI = ClinicalScoringEngine.KDIGOInput()
    // Baux Score
    @State var bauxI = ClinicalScoringEngine.BauxInput()
    // ISS
    @State var issI = ClinicalScoringEngine.ISSInput()
    // NUTRIC
    @State var nutricI = ClinicalScoringEngine.NUTRICInput()
    // sPESI
    @State var spesiI = ClinicalScoringEngine.SPESIInput()
    // DECAF
    @State var decafI = ClinicalScoringEngine.DECAFInput()
    // Hinchey
    @State var hincheyI = ClinicalScoringEngine.HincheyInput()
    // AIR Score
    @State var airI = ClinicalScoringEngine.AIRInput()
    // PERC Rule
    @State var percI = ClinicalScoringEngine.PERCInput()
    // Shock Index
    @State var siI = ClinicalScoringEngine.ShockIndexInput()
    // Parkland Formula
    @State var parklandI = ClinicalScoringEngine.ParklandInput()
    // PAS
    @State var pasI = ClinicalScoringEngine.PASInput()
    // Revised Geneva
    @State var rgI = ClinicalScoringEngine.RevisedGenevaInput()
    @State var cciI = ClinicalScoringEngine.CCIInput()
    @State var mfi5I = ClinicalScoringEngine.MFI5Input()
    @State var hapsI = ClinicalScoringEngine.HAPSInput()
    @State var glasgowImrieI = ClinicalScoringEngine.GlasgowImrieInput()
    @State var albiI         = ClinicalScoringEngine.ALBIInput()
    @State var auditCI       = ClinicalScoringEngine.AUDITCInput()
    @State var phq9I         = ClinicalScoringEngine.PHQ9Input()
    @State var sapsIII       = ClinicalScoringEngine.SAPSIIInput()
    @State var stoneI        = ClinicalScoringEngine.STONEInput()
    @State var losAngelesI   = ClinicalScoringEngine.LosAngelesInput()
    @State var meld3I        = ClinicalScoringEngine.MELD3Input()
    @State var bradenI       = ClinicalScoringEngine.BradenInput()
    @State var centorI       = ClinicalScoringEngine.CentorInput()
    @State var ipssI         = ClinicalScoringEngine.IPSSInput()
    @State var trueloveI     = ClinicalScoringEngine.TruelovewIttsInput()
    @State var harveyI       = ClinicalScoringEngine.HarveyBradshawInput()
    @State var maddreyI      = ClinicalScoringEngine.MaddreyInput(ptSeconds: 14, controlPTSeconds: 12, bilirubinMgDL: 1.0)
    @State var manningI      = ClinicalScoringEngine.ManningInput(painRelievedByDefecation: false, looserStoolsWithOnsetOfPain: false, increasedFrequencyWithOnsetOfPain: false, abdomenVisiblyDistended: false, mucusPerRectum: false, feelingOfIncompleteEmptying: false)
    @State var laceI         = ClinicalScoringEngine.LACEInput(lengthOfStayDays: 1, acuteAdmission: false, charlsonIndex: 0, edVisitsLast6Months: 0)
    @State var findRiscI     = ClinicalScoringEngine.FINDRISCInput(ageGroup: 0, bmi: 22, waistCircumferenceCm: 80, sex: "male", physicalActivityMinPerWeek: 150, vegetablesFruitDaily: true, hypertensionMeds: false, highBloodGlucoseHistory: false, familyHistoryDiabetes: 0)
    @State var mirelsI       = ClinicalScoringEngine.MirelsInput(site: 2, pain: 1, lesionType: 1, lesionSizeRatio: 1)
    @State var ckdEpiI       = ClinicalScoringEngine.CKDEPIInput(serumCreatinineMgDL: 0.9, ageYears: 50, sex: "male", raceAA: false)
    @State var ariscatI      = ClinicalScoringEngine.ARISCATInput(age: 50, spo2Preop: 98, respiratoryInfection: false, preOpHaemoglobin: 13.5, surgicalIncision: 0, surgicalDurationHrs: 1.0, emergencyProcedure: false)
    @State var fongI         = ClinicalScoringEngine.FongCRSInput(nodePosivePrimaryTumour: false, diseaseFreeIntervalLess12Mo: false, moreThanOneHepaticTumour: false, largestTumourOver5cm: false, ceaOver200: false)
    @State var berlinI       = ClinicalScoringEngine.BerlinARDSInput(pao2FiO2Ratio: 300.0, peepOrCPAP: 5, acuteOnsetWithin1Week: true, bilateralOpacitiesOnImaging: false, notExplainedByCardiacFailure: false)
    @State var cageI         = ClinicalScoringEngine.CAGEInput(feltCutDown: false, annoyedByCriticism: false, feltGuilty: false, eyeOpener: false)
    @State var dukeI         = ClinicalScoringEngine.DukeInput(positiveBloodCultures: 0, endocardialInvolvement: 0, predisposedHeartCondition: false, ivDrugUse: false, feverGe38: false, vascularPhenomena: false, immunologicPhenomena: false, positiveBloodCultureMinor: false, echoMinor: false)
    @State var mmrcI         = ClinicalScoringEngine.MMRCInput(grade: 0)
    @State var ptsI          = ClinicalScoringEngine.PTSInput(weight: 0, airway: 0, systolicBP: 0, cns: 0, openWound: 0, fracture: 0)
    // RIPASA Score
    @State var ripasaI = ClinicalScoringEngine.RIPASAInput(male: false, age14to39: false, foreignNational: false, migratingToRIF: false, anorexia: false, nausea: false, vomiting: false, durationUnder48h: false, rofFossaTenderness: false, guarding: false, reboundTenderness: false, rovsing: false, fever37_5to38_5: false, elevatedWBC: false, abnormalUrinalysis: false)
    // FGSI
    @State var fgsiI = ClinicalScoringEngine.FGSIInput(temperature: 37.0, heartRate: 80, respiratoryRate: 16, sodium: 138.0, potassium: 4.0, creatinine: 88.0, haematocrit: 40.0, wbc: 7.0, bicarbonate: 24.0)

    // Auto-population tracking
    @State var autoFill = ScoreAutoFill()
    @State var mewsSaved = false
    @State var news2Saved = false
    @State var scoreSaved = false

    /// Cached Layer 2 recommendations — computed once on appear / dx change, not on every body eval.
    @State var cachedRecommendations: [DiagnosisScoreRecommendation] = []

    var filteredScores: [ActiveScore] {
        guard selectedCategory != .all else { return ActiveScore.allCases }
        return ActiveScore.allCases.filter { $0.category == selectedCategory }
    }

    /// Layer 2 recommendations — backed by cache so the grid stays fast.
    var recommendedScores: [DiagnosisScoreRecommendation] { cachedRecommendations }

    /// Layer 3: risk-profile scores derived from patient age, setting, and PMH.
    var riskProfileScores: [ActiveScore] {
        var scores: [ActiveScore] = [.asa]
        let age: Int = {
            guard let dob = patient.dateOfBirth else { return 0 }
            return Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
        }()
        let pmh = (patient.pmhNotes ?? "").lowercased()
        let isAdmitted = patient.setting == .inpatient || patient.setting == .emergency
        if isAdmitted { scores.append(.caprini) }
        if age >= 60 || pmh.contains("card") || pmh.contains("coronary") ||
           pmh.contains("ischaem") || pmh.contains("valve") {
            scores.append(.rcri)
        }
        if age >= 65 || pmh.contains("frail") { scores.append(.cfs) }
        if !scores.contains(.rcri),
           (pmh.contains("diabet") || pmh.contains("renal") ||
            pmh.contains("liver") || pmh.contains("cancer")) {
            scores.append(.cci)
        }
        return Array(scores.prefix(4))
    }

    private func refreshRecommendations() {
        cachedRecommendations = DiagnosisScoreMapper.recommendations(for: patient)
        if selectedCategory == .all,
           let cat = DiagnosisScoreMapper.suggestedCategory(for: patient.chiefComplaint) {
            selectedCategory = cat
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            if let score = selectedScore {
                // Score form — shown over either mode
                ScrollView {
                    VStack(spacing: 16) {
                        inputForm(for: score)
                        if let r = result {
                            resultCard(r)
                        }
                    }
                    .padding()
                }
            } else if showingAllScores {
                // Browse mode: full catalogue with category filter
                categoryBar
                scoreGrid
            } else {
                // Default: patient-specific curated view
                patientContextView
            }
        }
        .onAppear { refreshRecommendations() }
        .onChange(of: patient.workingDiagnosis)    { _, _ in refreshRecommendations() }
        .onChange(of: patient.workingDiagnosisICD) { _, _ in refreshRecommendations() }
        .onChange(of: selectedScore) { _, newScore in
            if let score = newScore { autoPopulate(for: score) } else { autoFill = ScoreAutoFill() }
            recalculate()
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    Task { await exportScoresPDF() }
                } label: {
                    if isExportingScoresPDF {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("Export PDF", systemImage: "square.and.arrow.up")
                    }
                }
                .disabled(isExportingScoresPDF || patient.scoreHistory.isEmpty)
            }
        }
        .sheet(isPresented: $showScoresShareSheet) {
            if let url = scoresShareURL {
                ShareSheet(items: [url])
            }
        }
    }

    private func exportScoresPDF() async {
        isExportingScoresPDF = true
        defer { isExportingScoresPDF = false }

        let data = ClinicalScoresPDF.generate(patient: patient)

        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd_HHmm"
        let stamp    = df.string(from: Date())
        let safeName = patient.fullName
            .components(separatedBy: .whitespacesAndNewlines)
            .joined(separator: "_")
        let fileName = "ClinicalScores_\(safeName)_\(stamp).pdf"

        // Save to Documents tab
        let doc = PatientDocument(fileName: fileName, mimeType: "application/pdf", category: "Clinical Scores")
        doc.localData = data
        doc.patient   = patient
        modelContext.insert(doc)
        patient.updatedAt  = .now
        patient.pendingSync = true

        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try? data.write(to: tmp)
        scoresShareURL      = tmp
        showScoresShareSheet = true
    }

}
