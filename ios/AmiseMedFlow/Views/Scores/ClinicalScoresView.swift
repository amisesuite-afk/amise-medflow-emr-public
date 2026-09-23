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

    // MARK: - Patient-contextualised default view (three-block layout)

    private var patientContextView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {

                // ── Block 1: Monitoring ──────────────────────────────────────
                contextBlock(title: "MONITORING", icon: "waveform.path.ecg.rectangle") {
                    HStack(spacing: 12) {
                        monitoringPill(.news2)
                        monitoringPill(.mews)
                    }
                }

                // ── Block 2: Clinical — diagnosis-driven ─────────────────────
                if !cachedRecommendations.isEmpty {
                    contextBlock(title: dxBlockTitle, icon: "stethoscope") {
                        clinicalScoreGrid(Array(cachedRecommendations.prefix(4)))
                    }
                } else {
                    // No diagnosis set yet — nudge without cluttering
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle")
                            .foregroundStyle(AMColor.accent)
                        Text("Set a working diagnosis to see tailored scores.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .background(AMColor.accentLt.opacity(0.35), in: RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal)
                }

                // ── Block 3: Risk profile — age, setting, PMH ────────────────
                let riskScores = riskProfileScores
                if !riskScores.isEmpty {
                    contextBlock(title: "RISK PROFILE", icon: "shield.lefthalf.filled") {
                        clinicalScoreGrid(riskScores.map {
                            DiagnosisScoreRecommendation(score: $0,
                                                        rationale: $0.category.rawValue,
                                                        priority: 99)
                        })
                    }
                }

                // ── Block 4: Recorded score history ──────────────────────────
                if !patient.scoreHistory.isEmpty {
                    contextBlock(title: "RECORDED SCORES", icon: "clock.arrow.circlepath") {
                        scoreHistoryList
                    }
                }

                // ── Secondary: browse full catalogue ─────────────────────────
                Button { showingAllScores = true } label: {
                    HStack {
                        Text("Browse all \(ActiveScore.allCases.count) scores")
                            .font(.subheadline)
                            .foregroundStyle(AMColor.accent)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .buttonStyle(.plain)
                .padding(.horizontal)
            }
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }

    // MARK: - Context block chrome

    private func contextBlock<Content: View>(
        title: String, icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(AMColor.accent)
                Text(title)
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(AMColor.accent)
                    .kerning(0.8)
            }
            .padding(.horizontal)
            content()
        }
    }

    private var dxBlockTitle: String {
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            let icd = patient.workingDiagnosisICD.map { " · \($0)" } ?? ""
            return "FOR: \(dx.uppercased())\(icd)"
        }
        return "CLINICAL"
    }

    // MARK: - Monitoring pills (Block 1)

    private func monitoringPill(_ score: ActiveScore) -> some View {
        let latestVitals = patient.vitalsEntries
            .sorted { $0.recordedAt > $1.recordedAt }
            .first
        let savedEntry = patient.scoreHistory
            .filter { $0.scoreName == score.rawValue }
            .sorted { $0.recordedAt > $1.recordedAt }
            .first

        // NEWS2: derive live value directly from most-recent vitals
        let liveNews2: (value: Int, risk: String)? = {
            guard score == .news2, let v = latestVitals, v.hasAnyValue else { return nil }
            return (v.news2Score, v.news2Risk)
        }()

        let displayScore: String? = liveNews2.map { "\($0.value)" } ?? savedEntry?.abbreviation
        let displayRisk:  String? = liveNews2.map { $0.risk }       ?? savedEntry?.riskRaw
        let riskCol = displayRisk.map { scoreHistoryColor($0) } ?? Color.secondary

        return Button {
            selectedScore = score
            result = nil
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Image(systemName: score.icon)
                        .font(.callout)
                        .foregroundStyle(AMColor.accent)
                    Spacer()
                    if let val = displayScore {
                        Text(val)
                            .font(.title2.weight(.bold).monospacedDigit())
                            .foregroundStyle(riskCol)
                    }
                }
                Text(monitoringShortName(score))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                if let risk = displayRisk {
                    Text(risk)
                        .font(.caption2)
                        .foregroundStyle(riskCol)
                } else if liveNews2 == nil && savedEntry == nil {
                    Text("Tap to record")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let v = latestVitals, score == .news2 {
                    Text("Vitals: \(v.recordedAt, style: .relative)")
                        .font(.system(size: 9))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 12))
            .overlay {
                RoundedRectangle(cornerRadius: 12)
                    .stroke(displayScore != nil ? riskCol.opacity(0.4) : AMColor.line, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal)
    }

    private func monitoringShortName(_ score: ActiveScore) -> String {
        switch score {
        case .news2: return "NEWS2"
        case .mews:  return "MEWS"
        default:     return score.rawValue.components(separatedBy: " (").first ?? score.rawValue
        }
    }

    // MARK: - Clinical / risk score grid (Blocks 2 & 3)

    private func clinicalScoreGrid(_ recs: [DiagnosisScoreRecommendation]) -> some View {
        let cols = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: cols, spacing: 10) {
            ForEach(recs) { rec in
                Button {
                    selectedScore = rec.score
                    result = nil
                } label: {
                    compactScoreCard(rec)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal)
    }

    private func compactScoreCard(_ rec: DiagnosisScoreRecommendation) -> some View {
        let savedEntry = patient.scoreHistory
            .filter { $0.scoreName == rec.score.rawValue }
            .sorted { $0.recordedAt > $1.recordedAt }
            .first

        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: rec.score.icon)
                    .font(.subheadline)
                    .foregroundStyle(AMColor.accent)
                Spacer()
                if let entry = savedEntry {
                    Text(entry.abbreviation)
                        .font(.caption2.monospacedDigit().weight(.bold))
                        .foregroundStyle(scoreHistoryColor(entry.riskRaw))
                }
            }
            Text(rec.score.rawValue.components(separatedBy: " (").first ?? rec.score.rawValue)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            Text(rec.rationale)
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 10))
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .stroke(AMColor.line, lineWidth: 1)
        }
    }

    // MARK: - Score history list (Block 4)

    private var scoreHistoryList: some View {
        let entries = patient.scoreHistory.sorted { $0.recordedAt > $1.recordedAt }
        return VStack(spacing: 0) {
            ForEach(entries) { entry in
                HStack(spacing: 10) {
                    Circle()
                        .fill(scoreHistoryColor(entry.riskRaw))
                        .frame(width: 8, height: 8)
                    Text(entry.scoreName)
                        .font(.caption.weight(.medium))
                        .lineLimit(1)
                    Spacer()
                    Text(entry.abbreviation)
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(scoreHistoryColor(entry.riskRaw))
                    Text(entry.recordedAt, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    Button {
                        if let match = ActiveScore.allCases.first(where: { $0.rawValue == entry.scoreName }) {
                            selectedScore = match
                            result = nil
                        }
                    } label: {
                        Image(systemName: "arrow.right.circle")
                            .font(.caption)
                            .foregroundStyle(AMColor.accent)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal)
                .padding(.vertical, 9)
                .background(Color(uiColor: .systemBackground))
                if entry.id != entries.last?.id {
                    Divider().padding(.leading)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    // MARK: - Score browse catalogue (shown when showingAllScores = true)

    private var scoreGrid: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Back to patient view
                Button {
                    showingAllScores = false
                } label: {
                    Label("Back to patient view", systemImage: "chevron.left")
                        .font(.subheadline)
                        .foregroundStyle(AMColor.accent)
                }
                .buttonStyle(.plain)
                .padding(.horizontal)
                .padding(.vertical, 10)

                if !recommendedScores.isEmpty {
                    Text("Recommended scores are marked ✦")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal)
                        .padding(.bottom, 6)
                }

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
                .padding(.horizontal)
                .padding(.bottom)
                .padding(.top, 4)
            }
        }
    }

    private func scoreCard(_ score: ActiveScore) -> some View {
        let lastEntry = patient.scoreHistory
            .filter { $0.scoreName == score.rawValue }
            .sorted { $0.recordedAt > $1.recordedAt }
            .first
        let isRecommended = recommendedScores.contains(where: { $0.score == score })

        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: score.icon)
                    .font(.title3)
                    .foregroundStyle(isRecommended ? AMColor.accent : .secondary)
                Spacer()
                if let entry = lastEntry {
                    Text(entry.abbreviation)
                        .font(.caption2.monospacedDigit().weight(.semibold))
                        .foregroundStyle(scoreHistoryColor(entry.riskRaw))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(scoreHistoryColor(entry.riskRaw).opacity(0.12), in: Capsule())
                } else {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            Text(score.rawValue)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)
            HStack(spacing: 4) {
                if isRecommended {
                    Image(systemName: "sparkle")
                        .font(.caption2)
                        .foregroundStyle(AMColor.accent)
                }
                Text(score.category.rawValue)
                    .font(.caption2)
                    .foregroundStyle(isRecommended ? AMColor.accent : .secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isRecommended ? AMColor.accent.opacity(0.3) : Color.clear, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }

    // MARK: - Result card

    private func resultCard(_ r: ClinicalScore) -> some View {
        // Layer 5: check if score corroborates working diagnosis
        let corroborates = bayesianCorroboration(
            score: r,
            workingDx: patient.workingDiagnosis?.lowercased() ?? ""
        )

        return VStack(alignment: .leading, spacing: 14) {
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

            // Layer 5: Bayesian corroboration banner
            if corroborates, let dx = patient.workingDiagnosis, !dx.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "brain.head.profile")
                        .font(.caption)
                        .foregroundStyle(AMColor.accent)
                    Text("Score corroborates working diagnosis: \(dx)")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(AMColor.accent)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AMColor.accentLt.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
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
        let scoreStr  = score == Double(Int(score)) ? "\(Int(score))" : String(format: "%.1f", score)
        let maxStr    = max == Double(Int(max))   ? "\(Int(max))"   : String(format: "%.0f", max)
        let scoreLabel = max > 0 ? "\(scoreStr)/\(maxStr)" : scoreStr
        return VStack(spacing: 2) {
            Text(scoreLabel)
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
        case .rockall:
            let (input, fill) = PatientScoreAutoPopulator.rockall(patient: patient)
            rock = input; autoFill = fill
        case .asa:
            let (input, fill) = PatientScoreAutoPopulator.asa(patient: patient)
            asaI = input; autoFill = fill
        case .mrs:
            let (input, fill) = PatientScoreAutoPopulator.mRS(patient: patient)
            mrsI = input; autoFill = fill
        case .clavienDindo:
            let (input, fill) = PatientScoreAutoPopulator.clavienDindo(patient: patient)
            cdI = input; autoFill = fill
        case .aldrete:
            let (input, fill) = PatientScoreAutoPopulator.aldrete(patient: patient)
            aldreteI = input; autoFill = fill
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
        case .gcs:
            let (input, fill) = PatientScoreAutoPopulator.gcs(patient: patient)
            gcsI = input; autoFill = fill
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
        case .airScore:
            let (input, fill) = PatientScoreAutoPopulator.airScore(patient: patient)
            airI = input; autoFill = fill
        case .perc:
            let (input, fill) = PatientScoreAutoPopulator.perc(patient: patient)
            percI = input; autoFill = fill
        case .shockIndex:
            let (input, fill) = PatientScoreAutoPopulator.shockIndex(patient: patient)
            siI = input; autoFill = fill
        case .parkland:
            let (input, fill) = PatientScoreAutoPopulator.parkland(patient: patient)
            parklandI = input; autoFill = fill
        case .pas:
            let (input, fill) = PatientScoreAutoPopulator.pas(patient: patient)
            pasI = input; autoFill = fill
        case .revisedGeneva:
            let (input, fill) = PatientScoreAutoPopulator.revisedGeneva(patient: patient)
            rgI = input; autoFill = fill
        case .cci:
            let (input, fill) = PatientScoreAutoPopulator.cci(patient: patient)
            cciI = input; autoFill = fill
        case .mfi5:
            let (input, fill) = PatientScoreAutoPopulator.mfi5(patient: patient)
            mfi5I = input; autoFill = fill
        case .haps:
            let (input, fill) = PatientScoreAutoPopulator.haps(patient: patient)
            hapsI = input; autoFill = fill
        case .glasgowImrie:
            let (input, fill) = PatientScoreAutoPopulator.glasgowImrie(patient: patient)
            glasgowImrieI = input; autoFill = fill
        case .albi:
            let (input, fill) = PatientScoreAutoPopulator.albi(patient: patient)
            albiI = input; autoFill = fill
        case .auditC:
            let (input, fill) = PatientScoreAutoPopulator.auditC(patient: patient)
            auditCI = input; autoFill = fill
        case .phq9:
            let (input, fill) = PatientScoreAutoPopulator.phq9(patient: patient)
            phq9I = input; autoFill = fill
        case .sapsII:
            let (input, fill) = PatientScoreAutoPopulator.sapsII(patient: patient)
            sapsIII = input; autoFill = fill
        case .stone:
            let (input, fill) = PatientScoreAutoPopulator.stone(patient: patient)
            stoneI = input; autoFill = fill
        case .losAngeles:
            let (input, fill) = PatientScoreAutoPopulator.losAngeles(patient: patient)
            losAngelesI = input; autoFill = fill
        case .meld3:
            let (input, fill) = PatientScoreAutoPopulator.meld3(patient: patient)
            meld3I = input; autoFill = fill
        case .braden:
            let (input, fill) = PatientScoreAutoPopulator.braden(patient: patient)
            bradenI = input; autoFill = fill
        case .centor:
            let (input, fill) = PatientScoreAutoPopulator.centor(patient: patient)
            centorI = input; autoFill = fill
        case .ipss:
            let (input, fill) = PatientScoreAutoPopulator.ipss(patient: patient)
            ipssI = input; autoFill = fill
        case .trueloveWitts:
            let (input, fill) = PatientScoreAutoPopulator.trueloveWitts(patient: patient)
            trueloveI = input; autoFill = fill
        case .harveyBradshaw:
            let (input, fill) = PatientScoreAutoPopulator.harveyBradshaw(patient: patient)
            harveyI = input; autoFill = fill
        case .maddrey:
            let (input, fill) = PatientScoreAutoPopulator.maddrey(patient: patient)
            maddreyI = input; autoFill = fill
        case .manning:
            let (input, fill) = PatientScoreAutoPopulator.manning(patient: patient)
            manningI = input; autoFill = fill
        case .lace:
            let (input, fill) = PatientScoreAutoPopulator.lace(patient: patient)
            laceI = input; autoFill = fill
        case .findRisc:
            let (input, fill) = PatientScoreAutoPopulator.findRisc(patient: patient)
            findRiscI = input; autoFill = fill
        case .mirels:
            let (input, fill) = PatientScoreAutoPopulator.mirels(patient: patient)
            mirelsI = input; autoFill = fill
        case .ckdEpi:
            let (input, fill) = PatientScoreAutoPopulator.ckdEpi(patient: patient)
            ckdEpiI = input; autoFill = fill
        case .ariscat:
            let (input, fill) = PatientScoreAutoPopulator.ariscat(patient: patient)
            ariscatI = input; autoFill = fill
        case .fongCrs:
            let (input, fill) = PatientScoreAutoPopulator.fongCrs(patient: patient)
            fongI = input; autoFill = fill
        case .berlinARDS:
            let (input, fill) = PatientScoreAutoPopulator.berlinARDS(patient: patient)
            berlinI = input; autoFill = fill
        case .cage:
            let (input, fill) = PatientScoreAutoPopulator.cage(patient: patient)
            cageI = input; autoFill = fill
        case .dukeIE:
            let (input, fill) = PatientScoreAutoPopulator.dukeIE(patient: patient)
            dukeI = input; autoFill = fill
        case .mmrc:
            let (input, fill) = PatientScoreAutoPopulator.mmrc(patient: patient)
            mmrcI = input; autoFill = fill
        case .pts:
            let (input, fill) = PatientScoreAutoPopulator.pts(patient: patient)
            ptsI = input; autoFill = fill
        case .ripasa:
            let (input, fill) = PatientScoreAutoPopulator.ripasa(patient: patient)
            ripasaI = input; autoFill = fill
        case .fgsi:
            let (input, fill) = PatientScoreAutoPopulator.fgsi(patient: patient)
            fgsiI = input; autoFill = fill
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
        guard r.score.isFinite else { return }
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        fmt.timeStyle = .short
        let scoreStr     = r.score == Double(Int(r.score)) ? "\(Int(r.score))" : String(format: "%.1f", r.score)
        let maxStr       = r.maxScore.isFinite && r.maxScore == Double(Int(r.maxScore)) ? "\(Int(r.maxScore))" : String(format: "%.1f", r.maxScore)
        let scoreDisplay = r.maxScore > 0 ? "\(scoreStr)/\(maxStr)" : scoreStr
        var line = "[\(fmt.string(from: .now))] \(r.systemName): \(scoreDisplay) — \(r.risk.rawValue) Risk. \(r.interpretation)"

        // Layer 5: annotate when score strongly corroborates working diagnosis
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            let dxLower = dx.lowercased()
            let isCorroborating: Bool = bayesianCorroboration(score: r, workingDx: dxLower)
            if isCorroborating {
                line += " [Corroborates working diagnosis: \(dx)]"
            }
        }

        if let existing = patient.assessmentText, !existing.isEmpty {
            patient.assessmentText = existing + "\n" + line
        } else {
            patient.assessmentText = line
        }

        // Persist to score history (Layer 7)
        let entry = ScoreHistoryEntry(
            scoreName: r.systemName,
            abbreviation: r.abbreviation,
            scoreValue: r.score,
            maxScore: r.maxScore,
            riskRaw: r.risk.rawValue
        )
        entry.patient = patient
        modelContext.insert(entry)
        // Persist computed score to patient Bayesian fields so the engine picks it up
        if let score = selectedScore, let r = result {
            persistScoreToPatient(score, r)
        }
        patient.updatedAt   = .now
        patient.pendingSync = true
        scoreSaved = true
    }

    /// Layer 5 — returns true when a score result strongly supports the current working diagnosis.
    private func bayesianCorroboration(score: ClinicalScore, workingDx: String) -> Bool {
        let name = score.systemName.lowercased()
        guard score.risk == .high || score.risk == .critical else { return false }
        if name.contains("alvarado")   && workingDx.contains("appendicit")       { return true }
        if name.contains("air")        && workingDx.contains("appendicit")       { return true }
        if name.contains("ripasa")     && workingDx.contains("appendicit")       { return true }
        if name.contains("tokyo")      && (workingDx.contains("cholecystitis") ||
                                           workingDx.contains("cholangitis"))    { return true }
        if name.contains("ranson")     && workingDx.contains("pancreatitis")     { return true }
        if name.contains("bisap")      && workingDx.contains("pancreatitis")     { return true }
        if name.contains("blatchford") && workingDx.contains("bleed")            { return true }
        if name.contains("rockall")    && workingDx.contains("bleed")            { return true }
        if name.contains("wells")      && (workingDx.contains("dvt") ||
                                           workingDx.contains("pulmonary embolism")) { return true }
        if name.contains("qsofa")      && workingDx.contains("sepsis")           { return true }
        if name.contains("lrinec")     && workingDx.contains("fasciitis")        { return true }
        if name.contains("fgsi")       && workingDx.contains("fournier")         { return true }
        if name.contains("abcd")       && (workingDx.contains("tia") ||
                                           workingDx.contains("stroke"))         { return true }
        if name.contains("cha2ds2")    && workingDx.contains("atrial")           { return true }
        if name.contains("heart")      && (workingDx.contains("acute coronary") ||
                                           workingDx.contains("acs") ||
                                           workingDx.contains("angina"))         { return true }
        if name.contains("timi")       && (workingDx.contains("nstemi") ||
                                           workingDx.contains("unstable angina") ||
                                           workingDx.contains("acs"))            { return true }
        if name.contains("grace")      && (workingDx.contains("myocardial") ||
                                           workingDx.contains("acs") ||
                                           workingDx.contains("nstemi"))         { return true }
        if name.contains("euroscore")  && (workingDx.contains("cardiac surgery") ||
                                           workingDx.contains("valve") ||
                                           workingDx.contains("cabg"))           { return true }
        if name.contains("duke")       && workingDx.contains("endocarditis")     { return true }
        return false
    }

    // MARK: - Recalculate

    func recalculate() {
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
        case .airScore:      ClinicalScoringEngine.air(airI)
        case .perc:          ClinicalScoringEngine.perc(percI)
        case .shockIndex:    ClinicalScoringEngine.shockIndex(siI)
        case .parkland:      ClinicalScoringEngine.parkland(parklandI)
        case .pas:           ClinicalScoringEngine.pas(pasI)
        case .revisedGeneva: ClinicalScoringEngine.revisedGeneva(rgI)
        case .cci:           ClinicalScoringEngine.cci(cciI)
        case .mfi5:          ClinicalScoringEngine.mfi5(mfi5I)
        case .haps:          ClinicalScoringEngine.haps(hapsI)
        case .glasgowImrie:  ClinicalScoringEngine.glasgowImrie(glasgowImrieI)
        case .albi:          ClinicalScoringEngine.albi(albiI)
        case .auditC:        ClinicalScoringEngine.auditC(auditCI)
        case .phq9:          ClinicalScoringEngine.phq9(phq9I)
        case .sapsII:        ClinicalScoringEngine.sapsII(sapsIII)
        case .stone:         ClinicalScoringEngine.stone(stoneI)
        case .losAngeles:    ClinicalScoringEngine.losAngeles(losAngelesI)
        case .meld3:         ClinicalScoringEngine.meld3(meld3I)
        case .braden:        ClinicalScoringEngine.braden(bradenI)
        case .centor:        ClinicalScoringEngine.centor(centorI)
        case .ipss:          ClinicalScoringEngine.ipss(ipssI)
        case .trueloveWitts: ClinicalScoringEngine.truelovewItts(trueloveI)
        case .harveyBradshaw:ClinicalScoringEngine.harveyBradshaw(harveyI)
        case .maddrey:       ClinicalScoringEngine.maddrey(maddreyI)
        case .manning:       ClinicalScoringEngine.manning(manningI)
        case .lace:          ClinicalScoringEngine.lace(laceI)
        case .findRisc:      ClinicalScoringEngine.findrisc(findRiscI)
        case .mirels:        ClinicalScoringEngine.mirels(mirelsI)
        case .ckdEpi:        ClinicalScoringEngine.ckdEpi(ckdEpiI)
        case .ariscat:       ClinicalScoringEngine.ariscat(ariscatI)
        case .fongCrs:       ClinicalScoringEngine.fongCRS(fongI)
        case .berlinARDS:    ClinicalScoringEngine.berlinARDS(berlinI)
        case .cage:          ClinicalScoringEngine.cage(cageI)
        case .dukeIE:        ClinicalScoringEngine.dukeIE(dukeI)
        case .mmrc:          ClinicalScoringEngine.mmrc(mmrcI)
        case .pts:           ClinicalScoringEngine.pts(ptsI)
        case .ripasa:        ClinicalScoringEngine.ripasa(ripasaI)
        case .fgsi:          ClinicalScoringEngine.fgsi(fgsiI)
        }
        // NOTE: patient fields are written only on explicit save (saveScoreToAssessment),
        // NOT here, to prevent @Bindable mutation on every form input change which caused
        // continuous re-renders, score value corruption (browsed-but-unsaved scores
        // overwriting previously recorded scores with 0), and crash on navigation away.
    }

    // MARK: - Persist computed score to patient Bayesian fields (called only on explicit save)

    private func persistScoreToPatient(_ score: ActiveScore, _ r: ClinicalScore) {
        guard r.score.isFinite else { return }
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
        case .airScore:      patient.airScore = intScore
        case .perc:          patient.percViolations = intScore
        case .shockIndex:    patient.shockIndex = Int((r.score * 100).rounded())
        case .caprini:       patient.capriniScore = intScore
        case .parkland:      patient.parklandVolume = intScore
        case .pas:           patient.pasScore = intScore
        case .revisedGeneva: patient.revisedGenevaScore = intScore
        case .cci:           patient.cciScore = intScore
        case .mfi5:          patient.mfi5Score = intScore
        case .haps:          patient.hapsScore = intScore
        case .glasgowImrie:  patient.glasgowImrieScore = intScore
        case .albi:          patient.albiScore    = r.score
        case .auditC:        patient.auditCScore  = intScore
        case .phq9:          patient.phq9Score    = intScore
        case .sapsII:        patient.sapsIIScore    = intScore
        case .stone:         patient.stoneScore     = intScore
        case .losAngeles:    patient.losAngelesGrade = intScore
        case .meld3:         patient.meld3Score     = r.score
        case .braden:        patient.bradenScore         = intScore
        case .centor:        patient.centorScore         = intScore
        case .ipss:          patient.ipssScore           = intScore
        case .trueloveWitts: patient.trueloveWittsScore  = intScore
        case .harveyBradshaw:patient.harveyBradshawScore = intScore
        case .maddrey:       patient.maddreyScore  = r.score
        case .manning:       patient.manningScore  = intScore
        case .lace:          patient.laceScore     = intScore
        case .findRisc:      patient.findRiscScore = intScore
        case .mirels:        patient.mirelsScore   = intScore
        case .ckdEpi:        patient.ckdEpiEgfr    = r.score
        case .ariscat:       patient.ariscatScore  = intScore
        case .fongCrs:       patient.fongCrsScore  = intScore
        case .berlinARDS:    patient.berlinPFRatio  = r.score
        case .cage:          patient.cageScore      = intScore
        case .dukeIE:        patient.dukeIEScore    = r.score
        case .mmrc:          patient.mmrcGrade      = intScore
        case .pts:           patient.ptsScore       = intScore
        case .ripasa:        patient.ripasaScore    = r.score
        case .fgsi:          patient.fgsiScore      = intScore
        case .sirs:          patient.sirsScore          = intScore
        case .mews:          patient.mewsScore          = intScore
        case .news2:         patient.independentNews2   = intScore
        case .gcs:           patient.gcsScore           = intScore
        case .rcri:          patient.rcriScore          = intScore
        case .stopBang:      patient.stopBangScore      = intScore
        case .cha2ds2vasc:   patient.cha2ds2vascScore   = intScore
        case .hasBled:       patient.hasBledScore       = intScore
        }
    }

}
