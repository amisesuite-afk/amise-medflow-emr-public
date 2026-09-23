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

    @State private var selectedCategory: ScoreCategory = .all
    @State private var selectedScore: ActiveScore? = nil
    @State private var result: ClinicalScore? = nil
    @State private var isExportingScoresPDF = false
    @State private var scoresShareURL: URL? = nil
    @State private var showScoresShareSheet = false
    /// When true the full 101-score browse catalogue is shown; default is patient-specific view.
    @State private var showingAllScores = false

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
    @State private var mrsI = ClinicalScoringEngine.MRSInput()
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
    // AIR Score
    @State private var airI = ClinicalScoringEngine.AIRInput()
    // PERC Rule
    @State private var percI = ClinicalScoringEngine.PERCInput()
    // Shock Index
    @State private var siI = ClinicalScoringEngine.ShockIndexInput()
    // Parkland Formula
    @State private var parklandI = ClinicalScoringEngine.ParklandInput()
    // PAS
    @State private var pasI = ClinicalScoringEngine.PASInput()
    // Revised Geneva
    @State private var rgI = ClinicalScoringEngine.RevisedGenevaInput()
    @State private var cciI = ClinicalScoringEngine.CCIInput()
    @State private var mfi5I = ClinicalScoringEngine.MFI5Input()
    @State private var hapsI = ClinicalScoringEngine.HAPSInput()
    @State private var glasgowImrieI = ClinicalScoringEngine.GlasgowImrieInput()
    @State private var albiI         = ClinicalScoringEngine.ALBIInput()
    @State private var auditCI       = ClinicalScoringEngine.AUDITCInput()
    @State private var phq9I         = ClinicalScoringEngine.PHQ9Input()
    @State private var sapsIII       = ClinicalScoringEngine.SAPSIIInput()
    @State private var stoneI        = ClinicalScoringEngine.STONEInput()
    @State private var losAngelesI   = ClinicalScoringEngine.LosAngelesInput()
    @State private var meld3I        = ClinicalScoringEngine.MELD3Input()
    @State private var bradenI       = ClinicalScoringEngine.BradenInput()
    @State private var centorI       = ClinicalScoringEngine.CentorInput()
    @State private var ipssI         = ClinicalScoringEngine.IPSSInput()
    @State private var trueloveI     = ClinicalScoringEngine.TruelovewIttsInput()
    @State private var harveyI       = ClinicalScoringEngine.HarveyBradshawInput()
    @State private var maddreyI      = ClinicalScoringEngine.MaddreyInput(ptSeconds: 14, controlPTSeconds: 12, bilirubinMgDL: 1.0)
    @State private var manningI      = ClinicalScoringEngine.ManningInput(painRelievedByDefecation: false, looserStoolsWithOnsetOfPain: false, increasedFrequencyWithOnsetOfPain: false, abdomenVisiblyDistended: false, mucusPerRectum: false, feelingOfIncompleteEmptying: false)
    @State private var laceI         = ClinicalScoringEngine.LACEInput(lengthOfStayDays: 1, acuteAdmission: false, charlsonIndex: 0, edVisitsLast6Months: 0)
    @State private var findRiscI     = ClinicalScoringEngine.FINDRISCInput(ageGroup: 0, bmi: 22, waistCircumferenceCm: 80, sex: "male", physicalActivityMinPerWeek: 150, vegetablesFruitDaily: true, hypertensionMeds: false, highBloodGlucoseHistory: false, familyHistoryDiabetes: 0)
    @State private var mirelsI       = ClinicalScoringEngine.MirelsInput(site: 2, pain: 1, lesionType: 1, lesionSizeRatio: 1)
    @State private var ckdEpiI       = ClinicalScoringEngine.CKDEPIInput(serumCreatinineMgDL: 0.9, ageYears: 50, sex: "male", raceAA: false)
    @State private var ariscatI      = ClinicalScoringEngine.ARISCATInput(age: 50, spo2Preop: 98, respiratoryInfection: false, preOpHaemoglobin: 13.5, surgicalIncision: 0, surgicalDurationHrs: 1.0, emergencyProcedure: false)
    @State private var fongI         = ClinicalScoringEngine.FongCRSInput(nodePosivePrimaryTumour: false, diseaseFreeIntervalLess12Mo: false, moreThanOneHepaticTumour: false, largestTumourOver5cm: false, ceaOver200: false)
    @State private var berlinI       = ClinicalScoringEngine.BerlinARDSInput(pao2FiO2Ratio: 300.0, peepOrCPAP: 5, acuteOnsetWithin1Week: true, bilateralOpacitiesOnImaging: false, notExplainedByCardiacFailure: false)
    @State private var cageI         = ClinicalScoringEngine.CAGEInput(feltCutDown: false, annoyedByCriticism: false, feltGuilty: false, eyeOpener: false)
    @State private var dukeI         = ClinicalScoringEngine.DukeInput(positiveBloodCultures: 0, endocardialInvolvement: 0, predisposedHeartCondition: false, ivDrugUse: false, feverGe38: false, vascularPhenomena: false, immunologicPhenomena: false, positiveBloodCultureMinor: false, echoMinor: false)
    @State private var mmrcI         = ClinicalScoringEngine.MMRCInput(grade: 0)
    @State private var ptsI          = ClinicalScoringEngine.PTSInput(weight: 0, airway: 0, systolicBP: 0, cns: 0, openWound: 0, fracture: 0)
    // RIPASA Score
    @State private var ripasaI = ClinicalScoringEngine.RIPASAInput(male: false, age14to39: false, foreignNational: false, migratingToRIF: false, anorexia: false, nausea: false, vomiting: false, durationUnder48h: false, rofFossaTenderness: false, guarding: false, reboundTenderness: false, rovsing: false, fever37_5to38_5: false, elevatedWBC: false, abnormalUrinalysis: false)
    // FGSI
    @State private var fgsiI = ClinicalScoringEngine.FGSIInput(temperature: 37.0, heartRate: 80, respiratoryRate: 16, sodium: 138.0, potassium: 4.0, creatinine: 88.0, haematocrit: 40.0, wbc: 7.0, bicarbonate: 24.0)

    // Auto-population tracking
    @State private var autoFill = ScoreAutoFill()
    @State private var mewsSaved = false
    @State private var news2Saved = false
    @State private var scoreSaved = false

    /// Cached Layer 2 recommendations — computed once on appear / dx change, not on every body eval.
    @State private var cachedRecommendations: [DiagnosisScoreRecommendation] = []

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
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        fmt.timeStyle = .short
        let scoreStr     = r.score == Double(Int(r.score)) ? "\(Int(r.score))" : String(format: "%.1f", r.score)
        let maxStr       = r.maxScore == Double(Int(r.maxScore)) ? "\(Int(r.maxScore))" : String(format: "%.1f", r.maxScore)
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
        case .albi:          patient.albiScore    = r.score     // continuous Double
        case .auditC:        patient.auditCScore  = intScore
        case .phq9:          patient.phq9Score    = intScore
        case .sapsII:        patient.sapsIIScore    = intScore
        case .stone:         patient.stoneScore     = intScore
        case .losAngeles:    patient.losAngelesGrade = intScore
        case .meld3:         patient.meld3Score     = r.score   // continuous Double
        case .braden:        patient.bradenScore         = intScore
        case .centor:        patient.centorScore         = intScore
        case .ipss:          patient.ipssScore           = intScore
        case .trueloveWitts: patient.trueloveWittsScore  = intScore
        case .harveyBradshaw:patient.harveyBradshawScore = intScore
        case .maddrey:       patient.maddreyScore  = r.score     // continuous Double
        case .manning:       patient.manningScore  = intScore
        case .lace:          patient.laceScore     = intScore
        case .findRisc:      patient.findRiscScore = intScore
        case .mirels:        patient.mirelsScore   = intScore
        case .ckdEpi:        patient.ckdEpiEgfr    = r.score     // continuous Double
        case .ariscat:       patient.ariscatScore  = intScore
        case .fongCrs:       patient.fongCrsScore  = intScore
        case .berlinARDS:    patient.berlinPFRatio  = r.score   // continuous Double (PF ratio)
        case .cage:          patient.cageScore      = intScore
        case .dukeIE:        patient.dukeIEScore    = r.score   // continuous Double (majorCount×2 + minorCount)
        case .mmrc:          patient.mmrcGrade      = intScore
        case .pts:           patient.ptsScore       = intScore
        case .ripasa:        patient.ripasaScore    = r.score   // continuous Double
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
                    Label(showingAllScores ? "All Scores" : "Patient Scores", systemImage: "chevron.left")
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
        formBodyByCategory(score)
    }

    // Split by category to avoid a 101-case @ViewBuilder switch, which generates
    // a deeply-nested _ConditionalContent type that overflows the stack at runtime.
    @ViewBuilder
    private func formBodyByCategory(_ score: ActiveScore) -> some View {
        switch score.category {
        case .all:        EmptyView()
        case .acute:      acuteFormBody(score)
        case .gi:         giFormBody(score)
        case .vascular:   vascularFormBody(score)
        case .sepsis:     sepsisFormBody(score)
        case .preop:      preopFormBody(score)
        case .neuro:      neuroFormBody(score)
        case .cardiac:    cardiacFormBody(score)
        case .monitoring: monitoringFormBody(score)
        }
    }

    @ViewBuilder
    private func acuteFormBody(_ score: ActiveScore) -> some View {
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

    @ViewBuilder
    private func giFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .rockall:        rockallForm
        case .blatchford:     blatchfordForm
        case .aims65:         aims65Form
        case .forrest:        forrestForm
        case .haps:           hapsForm
        case .glasgowImrie:   glasgowImrieForm
        case .albi:           albiForm
        case .auditC:         auditCForm
        case .oakland:        oaklandForm
        case .kingsCriteria:  kingsCriteriaForm
        case .losAngeles:     losAngelesForm
        case .meld3:          meld3Form
        case .trueloveWitts:  trueloveWittsForm
        case .harveyBradshaw: harveyBradshawForm
        case .maddrey:        maddreyForm
        case .manning:        manningForm
        case .fongCrs:        fongCrsForm
        default:              EmptyView()
        }
    }

    @ViewBuilder
    private func vascularFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .wellsDVT:      wellsDVTForm
        case .wellsPE:       wellsPEForm
        case .caprini:       capriniForm
        case .padua:         paduaForm
        case .fourT:         fourTForm
        case .spesi:         spesiForm
        case .perc:          percForm
        case .revisedGeneva: revisedGenevaForm
        default:             EmptyView()
        }
    }

    @ViewBuilder
    private func sepsisFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .sirs:       sirsForm
        case .qsofa:      qsofaForm
        case .psiPort:    psiPortForm
        case .sofa:       sofaForm
        case .curb65:     curb65Form
        case .apacheII:   apacheIIForm
        case .kdigo:      kdigoForm
        case .nutric:     nutricForm
        case .decaf:      decafForm
        case .centor:     centorForm
        case .berlinARDS: berlinARDSForm
        case .fgsi:       fgsiForm
        case .sapsII:     sapsIIForm
        case .mmrc:       mmrcForm
        default:          EmptyView()
        }
    }

    @ViewBuilder
    private func preopFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .rcri:        rcriForm
        case .asa:         asaForm
        case .childPugh:   childPughForm
        case .meld:        meldForm
        case .stopBang:    stopBangForm
        case .fib4:        fib4Form
        case .ppossum:     ppossumForm
        case .nrs2002:     nrs2002Form
        case .mallampati:  mallampatiForm
        case .cfs:         cfsForm
        default:           preopFormBodyB(score)
        }
    }

    @ViewBuilder
    private func preopFormBodyB(_ score: ActiveScore) -> some View {
        switch score {
        case .dasi:        dasiForm
        case .barthel:     barthelForm
        case .euroScoreII: euroScoreIIForm
        case .ecog:        ecogForm
        case .cci:         cciForm
        case .mfi5:        mfi5Form
        case .must:        mustForm
        case .mirels:      mirelsForm
        case .ariscat:     ariscatForm
        case .clavienDindo: clavienDindoForm
        case .aldrete:     aldreteForm
        default:           EmptyView()
        }
    }

    @ViewBuilder
    private func neuroFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .abcd2:  abcd2Form
        case .lrinec: lrinecForm
        case .gcs:    gcsForm
        case .nihss:  nihssForm
        case .mrs:    mrsForm
        default:      EmptyView()
        }
    }

    @ViewBuilder
    private func cardiacFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .cha2ds2vasc: cha2ds2vascForm
        case .hasBled:     hasBledForm
        case .heart:       heartForm
        case .timi:        timiForm
        case .grace:       graceForm
        case .rcri:        rcriForm
        case .dasi:        dasiForm
        case .euroScoreII: euroScoreIIForm
        case .dukeIE:      dukeIEForm
        case .shockIndex:  shockIndexForm
        default:           EmptyView()
        }
    }

    @ViewBuilder
    private func monitoringFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .mews:          mewsForm
        case .news2:         news2Form
        case .waterlow:      waterlowForm
        case .surgicalApgar: surgicalApgarForm
        case .phq9:          phq9Form
        case .braden:        bradenForm
        case .ipss:          ipssForm
        case .lace:          laceForm
        case .findRisc:      findRiscForm
        case .ckdEpi:        ckdEpiForm
        case .cage:          cageForm
        default:             EmptyView()
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

    // Convenience overload: no autoKey, uses `range:` external label and `unit:` for display suffix.
    private func mewsSlider(_ label: String, value: Binding<Double>,
                             range: ClosedRange<Double>, step: Double.Stride, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary).textCase(.uppercase)
            HStack {
                Slider(value: value, in: range, step: step).tint(AMColor.accent)
                let v = value.wrappedValue
                let display = step < 1 ? String(format: "%.2f \(unit)", v) : "\(Int(v)) \(unit)"
                Text(display).font(.caption.monospacedDigit()).frame(width: 66, alignment: .trailing)
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
        case .ecog, .rts, .kdigo, .baux, .iss, .nutric:
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
        case .airScore:
            switch field.id {
            case "vomiting":          airI.vomiting = true
            case "painRIF":           airI.painRIF = true
            case "tempAbove38point5": airI.tempAbove38point5 = true
            default: break
            }
        case .perc:
            switch field.id {
            case "hrAbove99":           percI.hrAbove99 = true
            case "spo2Below95":         percI.spo2Below95 = true
            case "legSwelling":         percI.legSwelling = true
            case "haemoptysis":         percI.haemoptysis = true
            case "exogenousEstrogen":   percI.exogenousEstrogen = true
            case "priorDVTorPE":        percI.priorDVTorPE = true
            case "recentSurgeryOrTrauma": percI.recentSurgeryOrTrauma = true
            default: break
            }
        case .shockIndex:
            // Shock Index is computed from vitals — no boolean confirm
            break
        case .parkland:
            // Parkland formula inputs are numeric sliders — inhalation injury can be pending-confirmed
            if field.id == "hasInhalationInjury" { parklandI.hasInhalationInjury = true }
        case .pas:
            switch field.id {
            case "anorexia":               pasI.anorexia = true
            case "nausea":                 pasI.nausea = true
            case "migration":              pasI.migration = true
            case "tendernessRIF":          pasI.tendernessRIF = true
            case "coughPercussionHop":     pasI.coughPercussionHop = true
            case "pyrexia":                pasI.pyrexia = true
            case "leukocytosis":           pasI.leukocytosis = true
            case "polymorphonuclearShift": pasI.polymorphonuclearShift = true
            default: break
            }
        case .revisedGeneva:
            switch field.id {
            case "priorDVTorPE":                 rgI.priorDVTorPE = true
            case "surgeryOrFractureInMonth":     rgI.surgeryOrFractureInMonth = true
            case "activeMalignancy":             rgI.activeMalignancy = true
            case "unilateralLimbPain":           rgI.unilateralLimbPain = true
            case "haemoptysis":                  rgI.haemoptysis = true
            case "heartRateAbove74":             rgI.heartRateAbove74 = true
            case "heartRateAbove94":             rgI.heartRateAbove94 = true
            case "painOnPalpationLimbAndEdema":  rgI.painOnPalpationLimbAndEdema = true
            default: break
            }
        case .cci:
            switch field.id {
            case "myocardialInfarction":         cciI.myocardialInfarction = true
            case "congestiveHeartFailure":       cciI.congestiveHeartFailure = true
            case "peripheralVascularDisease":    cciI.peripheralVascularDisease = true
            case "cerebrovascularDisease":       cciI.cerebrovascularDisease = true
            case "dementia":                     cciI.dementia = true
            case "chronicPulmonaryDisease":      cciI.chronicPulmonaryDisease = true
            case "connectiveTissueDisease":      cciI.connectiveTissueDisease = true
            case "pepticulcer":                  cciI.pepticulcer = true
            case "mildLiverDisease":             cciI.mildLiverDisease = true
            case "diabetesUncomplicated":        cciI.diabetesUncomplicated = true
            case "diabetesWithEndOrganDamage":   cciI.diabetesWithEndOrganDamage = true
            case "hemiplecia":                   cciI.hemiplecia = true
            case "moderateOrSevereCKD":          cciI.moderateOrSevereCKD = true
            case "solidTumour":                  cciI.solidTumour = true
            case "leukaemia":                    cciI.leukaemia = true
            case "lymphoma":                     cciI.lymphoma = true
            case "moderateOrSevereLiverDisease": cciI.moderateOrSevereLiverDisease = true
            case "metastaticSolidTumour":        cciI.metastaticSolidTumour = true
            case "aids":                         cciI.aids = true
            default: break
            }
        case .mfi5:
            switch field.id {
            case "diabetes":               mfi5I.diabetes = true
            case "functionalDependence":   mfi5I.functionalDependence = true
            case "COPD":                   mfi5I.COPD = true
            case "congestiveHeartFailure": mfi5I.congestiveHeartFailure = true
            case "hypertension":           mfi5I.hypertension = true
            default: break
            }
        case .haps:
            switch field.id {
            case "peritonismAbsent":   hapsI.peritonismAbsent = true
            case "creatinineNormal":   hapsI.creatinineNormal = true
            case "haematocritNormal":  hapsI.haematocritNormal = true
            default: break
            }
        case .glasgowImrie:
            switch field.id {
            case "pao2Below59":      glasgowImrieI.pao2Below59 = true
            case "ageAbove55":       glasgowImrieI.ageAbove55 = true
            case "wbcAbove15":       glasgowImrieI.wbcAbove15 = true
            case "calciumBelow2":    glasgowImrieI.calciumBelow2 = true
            case "albuminBelow32":   glasgowImrieI.albuminBelow32 = true
            case "ldh180":           glasgowImrieI.ldh180 = true
            case "ast100":           glasgowImrieI.ast100 = true
            case "glucoseAbove10":   glasgowImrieI.glucoseAbove10 = true
            default: break
            }
        case .albi:
            // ALBI uses continuous numeric inputs — pending fields prompt the clinician
            // to enter values; confirmPendingField is a no-op for numeric steppers
            break
        case .auditC:
            break
        case .phq9:
            break
        case .sapsII:
            break
        case .stone:
            break
        case .losAngeles:
            break
        case .meld3:
            break
        case .braden:
            break
        case .centor:
            switch field.id {
            case "tonsillarExudate":          centorI.tonsillarExudate = true
            case "tenderAnteriorCervical":    centorI.tenderAnteriorCervical = true
            case "feverHistory":              centorI.feverHistory = true
            case "noCough":                   centorI.noCough = true
            default: break
            }
        case .trueloveWitts:
            switch field.id {
            case "macroscopicBlood":  trueloveI.macroscopicBlood = true
            case "hrAbove90":         trueloveI.hrAbove90 = true
            case "tempAbove375":      trueloveI.tempAbove375 = true
            case "hbBelow105":        trueloveI.hbBelow105 = true
            case "esrAbove30":        trueloveI.esrAbove30 = true
            default: break
            }
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

    // MARK: - PERC Rule (#71)

    private var percForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(percI.age) }, set: { percI.age = Int($0) }),
                       range: 18...110, step: 1, unit: "yrs")
            scoreToggle("Heart rate ≥ 100 bpm", binding: $percI.hrAbove99, points: "PERC fail", autoKey: "hrAbove99")
            scoreToggle("SpO₂ < 95%", binding: $percI.spo2Below95, points: "PERC fail", autoKey: "spo2Below95")
            scoreToggle("Unilateral leg swelling", binding: $percI.legSwelling, points: "PERC fail", autoKey: "legSwelling")
            scoreToggle("Haemoptysis", binding: $percI.haemoptysis, points: "PERC fail", autoKey: "haemoptysis")
            scoreToggle("Exogenous oestrogen (OCP, HRT)", binding: $percI.exogenousEstrogen, points: "PERC fail", autoKey: "exogenousEstrogen")
            scoreToggle("Prior DVT or PE", binding: $percI.priorDVTorPE, points: "PERC fail", autoKey: "priorDVTorPE")
            scoreToggle("Recent surgery or trauma (≤ 4 weeks, requiring hospitalisation)",
                        binding: $percI.recentSurgeryOrTrauma, points: "PERC fail", autoKey: "recentSurgeryOrTrauma")
        }
        .onChange(of: percI) { _, _ in recalculate() }
    }

    // MARK: - Shock Index (#72)

    private var shockIndexForm: some View {
        Group {
            mewsSlider("Heart rate (bpm)", value: Binding(get: { Double(siI.heartRate) }, set: { siI.heartRate = Int($0) }),
                       range: 30...220, step: 1, unit: "bpm")
            mewsSlider("Systolic blood pressure (mmHg)", value: Binding(get: { Double(siI.systolicBP) }, set: { siI.systolicBP = Int($0) }),
                       range: 40...250, step: 1, unit: "mmHg")
        }
        .onChange(of: siI) { _, _ in recalculate() }
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

    // MARK: - Revised Geneva Score (#75)

    private var revisedGenevaForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(rgI.age) }, set: { rgI.age = Int($0) }),
                       range: 18...110, step: 1, unit: "yrs")
            scoreToggle("Prior DVT or PE", binding: $rgI.priorDVTorPE, points: "+3", autoKey: "priorDVTorPE")
            scoreToggle("Surgery or lower-limb fracture within 1 month", binding: $rgI.surgeryOrFractureInMonth, points: "+2", autoKey: "surgeryOrFractureInMonth")
            scoreToggle("Active malignancy (solid or haematological)", binding: $rgI.activeMalignancy, points: "+2", autoKey: "activeMalignancy")
            scoreToggle("Unilateral lower-limb pain", binding: $rgI.unilateralLimbPain, points: "+3", autoKey: "unilateralLimbPain")
            scoreToggle("Haemoptysis", binding: $rgI.haemoptysis, points: "+2", autoKey: "haemoptysis")
            scoreToggle("Heart rate 75–94 bpm", binding: $rgI.heartRateAbove74, points: "+3", autoKey: "heartRateAbove74")
            scoreToggle("Heart rate ≥ 95 bpm", binding: $rgI.heartRateAbove94, points: "+5", autoKey: "heartRateAbove94")
            scoreToggle("Pain on deep palpation of lower limb + unilateral oedema", binding: $rgI.painOnPalpationLimbAndEdema, points: "+4", autoKey: "painOnPalpationLimbAndEdema")
        }
        .onChange(of: rgI) { _, _ in recalculate() }
    }

    // MARK: - Charlson Comorbidity Index (#76)

    private var cciForm: some View {
        Group {
            mewsSlider("Age (years — for age-adjusted CCI)", value: Binding(get: { Double(cciI.age) }, set: { cciI.age = Int($0) }),
                       range: 18...110, step: 1, unit: "yrs")
            sectionHeader("1-Point Conditions")
            scoreToggle("Myocardial infarction (any prior history)", binding: $cciI.myocardialInfarction, points: "+1", autoKey: "myocardialInfarction")
            scoreToggle("Congestive heart failure", binding: $cciI.congestiveHeartFailure, points: "+1", autoKey: "congestiveHeartFailure")
            scoreToggle("Peripheral vascular disease", binding: $cciI.peripheralVascularDisease, points: "+1", autoKey: "peripheralVascularDisease")
            scoreToggle("Cerebrovascular disease / TIA", binding: $cciI.cerebrovascularDisease, points: "+1", autoKey: "cerebrovascularDisease")
            scoreToggle("Dementia", binding: $cciI.dementia, points: "+1", autoKey: "dementia")
            scoreToggle("Chronic pulmonary disease (COPD / asthma)", binding: $cciI.chronicPulmonaryDisease, points: "+1", autoKey: "chronicPulmonaryDisease")
            scoreToggle("Connective tissue / rheumatological disease", binding: $cciI.connectiveTissueDisease, points: "+1", autoKey: "connectiveTissueDisease")
            scoreToggle("Peptic ulcer disease", binding: $cciI.pepticulcer, points: "+1", autoKey: "pepticulcer")
            scoreToggle("Mild liver disease (no portal hypertension)", binding: $cciI.mildLiverDisease, points: "+1", autoKey: "mildLiverDisease")
            scoreToggle("Diabetes mellitus (uncomplicated)", binding: $cciI.diabetesUncomplicated, points: "+1", autoKey: "diabetesUncomplicated")
            sectionHeader("2-Point Conditions")
            scoreToggle("Diabetes with end-organ damage (retinopathy, nephropathy, neuropathy)", binding: $cciI.diabetesWithEndOrganDamage, points: "+2", autoKey: "diabetesWithEndOrganDamage")
            scoreToggle("Hemiplegia / paraplegia", binding: $cciI.hemiplecia, points: "+2", autoKey: "hemiplecia")
            scoreToggle("Moderate/severe CKD (creatinine > 3 mg/dL or dialysis)", binding: $cciI.moderateOrSevereCKD, points: "+2", autoKey: "moderateOrSevereCKD")
            scoreToggle("Solid tumour (within 5 years, no metastasis)", binding: $cciI.solidTumour, points: "+2", autoKey: "solidTumour")
            scoreToggle("Leukaemia (AML, CML, ALL, CLL)", binding: $cciI.leukaemia, points: "+2", autoKey: "leukaemia")
            scoreToggle("Lymphoma / multiple myeloma / Waldenström's", binding: $cciI.lymphoma, points: "+2", autoKey: "lymphoma")
            sectionHeader("3–6-Point Conditions")
            scoreToggle("Moderate/severe liver disease (portal hypertension, varices, ascites)", binding: $cciI.moderateOrSevereLiverDisease, points: "+3", autoKey: "moderateOrSevereLiverDisease")
            scoreToggle("Metastatic solid tumour", binding: $cciI.metastaticSolidTumour, points: "+6", autoKey: "metastaticSolidTumour")
            scoreToggle("AIDS (not HIV+ only)", binding: $cciI.aids, points: "+6", autoKey: "aids")
        }
        .onChange(of: cciI) { _, _ in recalculate() }
    }

    // MARK: - Modified Frailty Index-5 (#77)

    private var mfi5Form: some View {
        Group {
            scoreToggle("Diabetes mellitus (requiring medication)", binding: $mfi5I.diabetes, points: "+1", autoKey: "diabetes")
            scoreToggle("Functional dependence (partial or total — ADL)", binding: $mfi5I.functionalDependence, points: "+1", autoKey: "functionalDependence")
            scoreToggle("COPD or pneumonia requiring hospitalisation (past year)", binding: $mfi5I.COPD, points: "+1", autoKey: "COPD")
            scoreToggle("Congestive heart failure", binding: $mfi5I.congestiveHeartFailure, points: "+1", autoKey: "congestiveHeartFailure")
            scoreToggle("Hypertension requiring medication", binding: $mfi5I.hypertension, points: "+1", autoKey: "hypertension")
        }
        .onChange(of: mfi5I) { _, _ in recalculate() }
    }

    // MARK: - Harmless Acute Pancreatitis Score (#78)

    private var hapsForm: some View {
        Group {
            scoreToggle("No peritoneal irritation on examination", binding: $hapsI.peritonismAbsent, points: "+1", autoKey: "peritonismAbsent")
            scoreToggle("Serum creatinine ≤ 177 µmol/L (< 2 mg/dL)", binding: $hapsI.creatinineNormal, points: "+1", autoKey: "creatinineNormal")
            scoreToggle("Haematocrit ≤ 43% (M) / ≤ 39.6% (F)", binding: $hapsI.haematocritNormal, points: "+1", autoKey: "haematocritNormal")
        }
        .onChange(of: hapsI) { _, _ in recalculate() }
    }

    // MARK: – BISAP Form

    // MARK: – Glasgow-Imrie Form

    private var glasgowImrieForm: some View {
        Group {
            Text("Variables assessed from WORST values within first 48 hours of admission")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            scoreToggle("PaO₂ < 59.2 mmHg (< 7.9 kPa)", binding: $glasgowImrieI.pao2Below59, points: "+1", autoKey: "pao2Below59")
            scoreToggle("Age > 55 years", binding: $glasgowImrieI.ageAbove55, points: "+1", autoKey: "ageAbove55")
            scoreToggle("WBC > 15 × 10⁹/L", binding: $glasgowImrieI.wbcAbove15, points: "+1", autoKey: "wbcAbove15")
            scoreToggle("Serum calcium < 2.0 mmol/L", binding: $glasgowImrieI.calciumBelow2, points: "+1", autoKey: "calciumBelow2")
            scoreToggle("Serum albumin < 32 g/L", binding: $glasgowImrieI.albuminBelow32, points: "+1", autoKey: "albuminBelow32")
            scoreToggle("LDH > 600 IU/L (or > 3× ULN)", binding: $glasgowImrieI.ldh180, points: "+1", autoKey: "ldh180")
            scoreToggle("AST / ALT > 200 IU/L", binding: $glasgowImrieI.ast100, points: "+1", autoKey: "ast100")
            scoreToggle("Serum glucose > 10 mmol/L (non-diabetic)", binding: $glasgowImrieI.glucoseAbove10, points: "+1", autoKey: "glucoseAbove10")
        }
        .onChange(of: glasgowImrieI) { _, _ in recalculate() }
    }

    // MARK: - ALBI
    private var albiForm: some View {
        Group {
            Text("Enter current serum albumin (g/L) and bilirubin (μmol/L). Use most recent lab values.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            HStack {
                Text("Albumin (g/L)")
                Spacer()
                Stepper("\(Int(albiI.albuminGperL)) g/L",
                        value: $albiI.albuminGperL, in: 5...60, step: 1)
                    .fixedSize()
            }
            HStack {
                Text("Bilirubin (μmol/L)")
                Spacer()
                Stepper("\(Int(albiI.bilirubinUmolL)) μmol/L",
                        value: $albiI.bilirubinUmolL, in: 1...500, step: 1)
                    .fixedSize()
            }
            Text("ALBI = (log₁₀(bilirubin) × 0.66) + (albumin × −0.085). Grade 1 ≤−2.60 (safe); Grade 3 >−1.39 (prohibitive risk).")
                .font(.caption2).foregroundStyle(.secondary).padding(.top, 4)
        }
        .onChange(of: albiI) { _, _ in recalculate() }
    }

    // MARK: - AUDIT-C
    private var auditCForm: some View {
        Group {
            Text("3-item alcohol consumption screen. Threshold: ≥4 (men) / ≥3 (women).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            auditCPicker("How often do you have a drink?",
                         labels: ["Never","Monthly or less","2–4×/month","2–3×/week","4+/week"],
                         value: $auditCI.frequency)
            auditCPicker("How many drinks on a typical day?",
                         labels: ["1–2","3–4","5–6","7–9","10+"],
                         value: $auditCI.typicalDrinks)
            auditCPicker("How often do you have 6+ drinks on one occasion?",
                         labels: ["Never","Less than monthly","Monthly","Weekly","Daily or almost daily"],
                         value: $auditCI.bingeDrinks)
            Toggle("Female (lower threshold: ≥3)", isOn: $auditCI.isFemale)
        }
        .onChange(of: auditCI) { _, _ in recalculate() }
    }

    private func auditCPicker(_ label: String, labels: [String], value: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.subheadline)
            Picker("", selection: value) {
                ForEach(0..<labels.count, id: \.self) { idx in
                    Text("(\(idx)) \(labels[idx])").tag(idx)
                }
            }
            .pickerStyle(.menu)
        }
    }

    // MARK: - PHQ-9
    private var phq9Form: some View {
        let items: [(String, WritableKeyPath<ClinicalScoringEngine.PHQ9Input, Int>)] = [
            ("Little interest or pleasure in doing things", \.anhedonia),
            ("Feeling down, depressed, or hopeless", \.depressedMood),
            ("Trouble falling or staying asleep, or sleeping too much", \.sleepProblem),
            ("Feeling tired or having little energy", \.fatigue),
            ("Poor appetite or overeating", \.appetiteChange),
            ("Feeling bad about yourself — or that you are a failure", \.selfWorth),
            ("Trouble concentrating on things", \.concentration),
            ("Moving or speaking so slowly (or being fidgety/restless)", \.psychomotor),
            ("Thoughts that you would be better off dead, or of hurting yourself", \.suicidalThought),
        ]
        return Group {
            Text("Over the last 2 weeks, how often have you been bothered by the following? (0=Not at all, 1=Several days, 2=More than half the days, 3=Nearly every day)")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            ForEach(items.indices, id: \.self) { idx in
                let (itemLabel, kp) = items[idx]
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(idx + 1). \(itemLabel)").font(.subheadline)
                    Picker("", selection: Binding(
                        get: { phq9I[keyPath: kp] },
                        set: { phq9I[keyPath: kp] = $0 }
                    )) {
                        Text("0 — Not at all").tag(0)
                        Text("1 — Several days").tag(1)
                        Text("2 — More than half").tag(2)
                        Text("3 — Nearly every day").tag(3)
                    }
                    .pickerStyle(.segmented)
                }
                .padding(.vertical, 2)
            }
            if phq9I.suicidalThought >= 2 {
                Label("⚠️ Q9 ≥2 — immediate psychiatric risk assessment required",
                      systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                    .font(.footnote.bold())
                    .padding(.top, 4)
            }
        }
        .onChange(of: phq9I) { _, _ in recalculate() }
    }

    // MARK: - SAPS II
    private var sapsIIForm: some View {
        Group {
            Text("Worst values within first 24 hours of ICU admission.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            sapsIIStepper("Age (years)", value: $sapsIII.ageYears, range: 0...120, step: 1)
            sapsIIStepper("Max heart rate (bpm)", value: $sapsIII.heartRateMax, range: 0...300, step: 1)
            sapsIIStepper("Min systolic BP (mmHg)", value: $sapsIII.sbpMin, range: 0...300, step: 1)
            HStack {
                Text("Max temperature (°C)")
                Spacer()
                Stepper(String(format: "%.1f °C", sapsIII.tempMax),
                        value: $sapsIII.tempMax, in: 30.0...45.0, step: 0.1)
                    .fixedSize()
            }
            Toggle("Ventilated (PaO₂/FiO₂ applicable)", isOn: $sapsIII.onVentilator)
            if sapsIII.onVentilator {
                sapsIIStepper("PaO₂/FiO₂ ratio (mmHg)", value: $sapsIII.pao2FiO2, range: 0...600, step: 5)
            }
            sapsIIStepper("Urine output (mL/24 h)", value: $sapsIII.urineOutputML, range: 0...5000, step: 50)
            HStack {
                Text("BUN (mmol/L)")
                Spacer()
                Stepper(String(format: "%.1f mmol/L", sapsIII.bunMmolL),
                        value: $sapsIII.bunMmolL, in: 0...100, step: 0.5)
                    .fixedSize()
            }
            HStack {
                Text("WBC (× 10⁹/L)")
                Spacer()
                Stepper(String(format: "%.1f ×10⁹/L", sapsIII.wbc),
                        value: $sapsIII.wbc, in: 0...100, step: 0.5)
                    .fixedSize()
            }
            sapsIIStepper("Sodium (mmol/L)", value: $sapsIII.sodiumMmolL, range: 100...180, step: 1)
            HStack {
                Text("Potassium (mmol/L)")
                Spacer()
                Stepper(String(format: "%.1f mmol/L", sapsIII.potassiumMmolL),
                        value: $sapsIII.potassiumMmolL, in: 0...10, step: 0.1)
                    .fixedSize()
            }
            sapsIIStepper("Bicarbonate (mmol/L)", value: $sapsIII.bicarbonateMmolL, range: 0...60, step: 1)
            HStack {
                Text("Bilirubin (μmol/L)")
                Spacer()
                Stepper(String(format: "%.0f μmol/L", sapsIII.bilirubinUmolL),
                        value: $sapsIII.bilirubinUmolL, in: 0...600, step: 5)
                    .fixedSize()
            }
            sapsIIStepper("GCS (3–15)", value: $sapsIII.gcsScore, range: 3...15, step: 1)
            Divider()
            Text("Admission type").font(.subheadline.bold())
            Toggle("Scheduled surgical admission", isOn: $sapsIII.scheduledSurgical)
            Toggle("Unscheduled surgical admission", isOn: $sapsIII.unscheduledSurgical)
            Divider()
            Text("Chronic disease").font(.subheadline.bold())
            Toggle("Metastatic cancer", isOn: $sapsIII.metastaticCancer)
            Toggle("Haematological malignancy", isOn: $sapsIII.haematologicalMalignancy)
            Toggle("AIDS", isOn: $sapsIII.aids)
        }
        .onChange(of: sapsIII) { _, _ in recalculate() }
    }

    private func sapsIIStepper(_ label: String, value: Binding<Int>, range: ClosedRange<Int>, step: Int) -> some View {
        HStack {
            Text(label)
            Spacer()
            Stepper("\(value.wrappedValue)", value: value, in: range, step: step)
                .fixedSize()
        }
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

    // MARK: - Los Angeles Classification
    private var losAngelesForm: some View {
        Group {
            Text("Endoscopic grading of oesophagitis at OGD. Select the grade that best matches the observed mucosal breaks.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            Picker("LA Grade", selection: $losAngelesI.grade) {
                Text("None — No erosive oesophagitis").tag(0)
                Text("Grade A — Mucosal break ≤5 mm").tag(1)
                Text("Grade B — Mucosal break >5 mm, not between folds").tag(2)
                Text("Grade C — Breaks between folds, <75% circumference").tag(3)
                Text("Grade D — Breaks ≥75% of oesophageal circumference").tag(4)
            }
            .pickerStyle(.inline)
        }
        .onChange(of: losAngelesI) { _, _ in recalculate() }
    }

    // MARK: - MELD 3.0
    private var meld3Form: some View {
        Group {
            Text("Enter most recent laboratory values. Use current INR, not on anticoagulation adjustment.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            Toggle("Female sex (+1.33 to score)", isOn: $meld3I.isFemale)
            HStack {
                Text("Creatinine (μmol/L)")
                Spacer()
                Stepper(String(format: "%.0f μmol/L", meld3I.creatinineMmolL),
                        value: $meld3I.creatinineMmolL, in: 10...700, step: 5)
                    .fixedSize()
            }
            HStack {
                Text("Bilirubin (μmol/L)")
                Spacer()
                Stepper(String(format: "%.0f μmol/L", meld3I.bilirubinMmolL),
                        value: $meld3I.bilirubinMmolL, in: 1...500, step: 2)
                    .fixedSize()
            }
            HStack {
                Text("INR")
                Spacer()
                Stepper(String(format: "%.1f", meld3I.inr),
                        value: $meld3I.inr, in: 0.8...12.0, step: 0.1)
                    .fixedSize()
            }
            HStack {
                Text("Sodium (mmol/L)")
                Spacer()
                Stepper("\(meld3I.sodiumMmolL) mmol/L",
                        value: $meld3I.sodiumMmolL, in: 120...145, step: 1)
                    .fixedSize()
            }
            HStack {
                Text("Albumin (g/L)")
                Spacer()
                Stepper(String(format: "%.0f g/L", meld3I.albuminGperL),
                        value: $meld3I.albuminGperL, in: 10...60, step: 1)
                    .fixedSize()
            }
            Text("Score ≥15 = transplant listing threshold. ≥25 = active waitlist priority.")
                .font(.caption2).foregroundStyle(.secondary).padding(.top, 4)
        }
        .onChange(of: meld3I) { _, _ in recalculate() }
    }

    // MARK: - Braden Scale
    private var bradenForm: some View {
        Group {
            Text("Each subscale scored 1 (worst) to 3 or 4 (best). Total 6–23; ≤18 = at risk.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            bradenPicker("Sensory Perception",
                         labels: ["1 — Completely limited","2 — Very limited","3 — Slightly limited","4 — No impairment"],
                         value: $bradenI.sensoryPerception)
            bradenPicker("Moisture",
                         labels: ["1 — Constantly moist","2 — Very moist","3 — Occasionally moist","4 — Rarely moist"],
                         value: $bradenI.moisture)
            bradenPicker("Activity",
                         labels: ["1 — Bedfast","2 — Chairfast","3 — Walks occasionally","4 — Walks frequently"],
                         value: $bradenI.activity)
            bradenPicker("Mobility",
                         labels: ["1 — Completely limited","2 — Very limited","3 — Slightly limited","4 — No limitation"],
                         value: $bradenI.mobility)
            bradenPicker("Nutrition",
                         labels: ["1 — Very poor","2 — Probably inadequate","3 — Adequate","4 — Excellent"],
                         value: $bradenI.nutrition)
            bradenPicker("Friction and Shear",
                         labels: ["1 — Problem","2 — Potential problem","3 — No apparent problem"],
                         value: $bradenI.frictionShear)
        }
        .onChange(of: bradenI) { _, _ in recalculate() }
    }

    private func bradenPicker(_ label: String, labels: [String], value: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.subheadline)
            Picker("", selection: value) {
                ForEach(1...labels.count, id: \.self) { idx in
                    Text(labels[idx - 1]).tag(idx)
                }
            }
            .pickerStyle(.menu)
        }
    }

    // MARK: - Centor / McIsaac

    private var centorForm: some View {
        Group {
            scoreToggle("Tonsillar exudate", binding: $centorI.tonsillarExudate, points: "+1", autoKey: "tonsillarExudate")
            scoreToggle("Tender anterior cervical lymphadenopathy", binding: $centorI.tenderAnteriorCervical, points: "+1", autoKey: "tenderAnteriorCervical")
            scoreToggle("Fever history (≥38°C)", binding: $centorI.feverHistory, points: "+1", autoKey: "feverHistory")
            scoreToggle("Absence of cough", binding: $centorI.noCough, points: "+1", autoKey: "noCough")
            VStack(alignment: .leading, spacing: 4) {
                Text("Age group").font(.subheadline)
                Picker("", selection: $centorI.ageGroup) {
                    Text("< 15 years (+1)").tag(0)
                    Text("15–44 years (0)").tag(1)
                    Text("≥ 45 years (−1)").tag(2)
                }
                .pickerStyle(.segmented)
            }
        }
        .onChange(of: centorI) { _, _ in recalculate() }
    }

    // MARK: - IPSS

    private var ipssForm: some View {
        Group {
            ForEach([
                ("Incomplete emptying", \ClinicalScoringEngine.IPSSInput.incompleteEmptying),
                ("Frequency",           \ClinicalScoringEngine.IPSSInput.frequency),
                ("Intermittency",       \ClinicalScoringEngine.IPSSInput.intermittency),
                ("Urgency",             \ClinicalScoringEngine.IPSSInput.urgency),
                ("Weak stream",         \ClinicalScoringEngine.IPSSInput.weakStream),
                ("Straining",           \ClinicalScoringEngine.IPSSInput.straining),
                ("Nocturia",            \ClinicalScoringEngine.IPSSInput.nocturia),
            ], id: \.0) { label, kp in
                ipssItemPicker(label, keyPath: kp)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Quality of life (0 = delighted, 6 = terrible)").font(.subheadline)
                Stepper("\(ipssI.qualityOfLife)", value: $ipssI.qualityOfLife, in: 0...6)
            }
        }
        .onChange(of: ipssI) { _, _ in recalculate() }
    }

    private func ipssItemPicker(_ label: String, keyPath: WritableKeyPath<ClinicalScoringEngine.IPSSInput, Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(label) (0–5)").font(.subheadline)
            Stepper("\(ipssI[keyPath: keyPath])",
                    value: Binding(get: { ipssI[keyPath: keyPath] },
                                   set: { ipssI[keyPath: keyPath] = $0 }),
                    in: 0...5)
        }
    }

    // MARK: - Truelove-Witts

    private var trueloveWittsForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Stools per day").font(.subheadline)
                Stepper("\(trueloveI.stoolsPerDay)", value: $trueloveI.stoolsPerDay, in: 0...30)
            }
            scoreToggle("Macroscopic blood in stool", binding: $trueloveI.macroscopicBlood, points: "+1", autoKey: "macroscopicBlood")
            scoreToggle("Heart rate > 90 bpm", binding: $trueloveI.hrAbove90, points: "+1", autoKey: "hrAbove90")
            scoreToggle("Temperature > 37.5°C", binding: $trueloveI.tempAbove375, points: "+1", autoKey: "tempAbove375")
            scoreToggle("Haemoglobin < 10.5 g/dL", binding: $trueloveI.hbBelow105, points: "+1", autoKey: "hbBelow105")
            scoreToggle("ESR > 30 mm/h", binding: $trueloveI.esrAbove30, points: "+1", autoKey: "esrAbove30")
        }
        .onChange(of: trueloveI) { _, _ in recalculate() }
    }

    // MARK: - Harvey-Bradshaw Index

    private var harveyBradshawForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("General wellbeing (0 = very well, 4 = terrible)").font(.subheadline)
                Stepper("\(harveyI.generalWellbeing)", value: $harveyI.generalWellbeing, in: 0...4)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Abdominal pain (0 = none, 3 = severe)").font(.subheadline)
                Stepper("\(harveyI.abdominalPain)", value: $harveyI.abdominalPain, in: 0...3)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Liquid stools per day").font(.subheadline)
                Stepper("\(harveyI.liquidStoolsPerDay)", value: $harveyI.liquidStoolsPerDay, in: 0...30)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Abdominal mass (0 = none, 3 = tender)").font(.subheadline)
                Stepper("\(harveyI.abdominalMass)", value: $harveyI.abdominalMass, in: 0...3)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Complications (arthralgia, uveitis, etc.)").font(.subheadline)
                Stepper("\(harveyI.complications)", value: $harveyI.complications, in: 0...10)
            }
        }
        .onChange(of: harveyI) { _, _ in recalculate() }
    }

    // MARK: - Maddrey Discriminant Function

    private var maddreyForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Patient PT (seconds)").font(.subheadline)
                HStack {
                    Slider(value: $maddreyI.ptSeconds, in: 10...60, step: 0.5)
                    Text(String(format: "%.1f s", maddreyI.ptSeconds))
                        .frame(width: 60)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Control PT (seconds)").font(.subheadline)
                HStack {
                    Slider(value: $maddreyI.controlPTSeconds, in: 10...20, step: 0.5)
                    Text(String(format: "%.1f s", maddreyI.controlPTSeconds))
                        .frame(width: 60)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Bilirubin (mg/dL)").font(.subheadline)
                HStack {
                    Slider(value: $maddreyI.bilirubinMgDL, in: 0...50, step: 0.5)
                    Text(String(format: "%.1f", maddreyI.bilirubinMgDL))
                        .frame(width: 50)
                        .font(.caption.monospacedDigit())
                }
            }
        }
        .onChange(of: maddreyI.ptSeconds)        { _, _ in recalculate() }
        .onChange(of: maddreyI.controlPTSeconds) { _, _ in recalculate() }
        .onChange(of: maddreyI.bilirubinMgDL)    { _, _ in recalculate() }
    }

    // MARK: - Manning Criteria for IBS

    private var manningForm: some View {
        Group {
            scoreToggle("Pain relieved by defecation",
                        binding: $manningI.painRelievedByDefecation, points: "+1")
            scoreToggle("Looser stools with onset of pain",
                        binding: $manningI.looserStoolsWithOnsetOfPain, points: "+1")
            scoreToggle("Increased stool frequency with onset of pain",
                        binding: $manningI.increasedFrequencyWithOnsetOfPain, points: "+1")
            scoreToggle("Abdomen visibly distended",
                        binding: $manningI.abdomenVisiblyDistended, points: "+1")
            scoreToggle("Mucus per rectum",
                        binding: $manningI.mucusPerRectum, points: "+1")
            scoreToggle("Feeling of incomplete emptying",
                        binding: $manningI.feelingOfIncompleteEmptying, points: "+1")
        }
        .onChange(of: manningI) { _, _ in recalculate() }
    }

    // MARK: - LACE Index

    private var laceForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Length of stay (days)").font(.subheadline)
                Stepper("\(laceI.lengthOfStayDays) day(s)", value: $laceI.lengthOfStayDays, in: 0...30)
            }
            Toggle(isOn: $laceI.acuteAdmission) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Acute (unplanned) admission").font(.subheadline)
                    Text("+3 if acute").font(.caption).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Charlson Comorbidity Index (CCI)").font(.subheadline)
                HStack {
                    Stepper("\(laceI.charlsonIndex)", value: $laceI.charlsonIndex, in: 0...20)
                    Text("(scored 0–4 in LACE)").font(.caption2).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("ED visits in last 6 months").font(.subheadline)
                Stepper("\(laceI.edVisitsLast6Months)", value: $laceI.edVisitsLast6Months, in: 0...10)
            }
        }
        .onChange(of: laceI.lengthOfStayDays)   { _, _ in recalculate() }
        .onChange(of: laceI.acuteAdmission)     { _, _ in recalculate() }
        .onChange(of: laceI.charlsonIndex)      { _, _ in recalculate() }
        .onChange(of: laceI.edVisitsLast6Months){ _, _ in recalculate() }
    }

    // MARK: - FINDRISC

    private var findRiscForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Age group").font(.subheadline)
                Picker("Age", selection: $findRiscI.ageGroup) {
                    Text("< 45 years (+0)").tag(0)
                    Text("45–54 years (+2)").tag(2)
                    Text("55–64 years (+3)").tag(3)
                    Text("≥ 65 years (+4)").tag(4)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("BMI (kg/m²)").font(.subheadline)
                HStack {
                    Slider(value: $findRiscI.bmi, in: 15...50, step: 0.5)
                    Text(String(format: "%.1f", findRiscI.bmi))
                        .frame(width: 50)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Waist circumference (cm)").font(.subheadline)
                HStack {
                    Slider(value: $findRiscI.waistCircumferenceCm, in: 60...150, step: 1)
                    Text(String(format: "%.0f cm", findRiscI.waistCircumferenceCm))
                        .frame(width: 60)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Sex").font(.subheadline)
                Picker("Sex", selection: $findRiscI.sex) {
                    Text("Male").tag("male")
                    Text("Female").tag("female")
                }
                .pickerStyle(.segmented)
            }
            Toggle(isOn: Binding(
                get:  { findRiscI.physicalActivityMinPerWeek == 0 },
                set:  { findRiscI.physicalActivityMinPerWeek = $0 ? 0 : 150 }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("< 30 min moderate physical activity/day").font(.subheadline)
                    Text("+2 if inactive").font(.caption).foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: Binding(
                get:  { !findRiscI.vegetablesFruitDaily },
                set:  { findRiscI.vegetablesFruitDaily = !$0 }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Does NOT eat vegetables/fruit daily").font(.subheadline)
                    Text("+1 if absent").font(.caption).foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: $findRiscI.hypertensionMeds) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("On antihypertensive medication").font(.subheadline)
                    Text("+2").font(.caption).foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: $findRiscI.highBloodGlucoseHistory) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("History of high blood glucose").font(.subheadline)
                    Text("+5").font(.caption).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Family history of diabetes").font(.subheadline)
                Picker("Family history", selection: $findRiscI.familyHistoryDiabetes) {
                    Text("None (+0)").tag(0)
                    Text("Second-degree relative (+3)").tag(3)
                    Text("First-degree relative (+5)").tag(5)
                }
                .pickerStyle(.segmented)
            }
        }
        .onChange(of: findRiscI.ageGroup)                 { _, _ in recalculate() }
        .onChange(of: findRiscI.bmi)                      { _, _ in recalculate() }
        .onChange(of: findRiscI.waistCircumferenceCm)     { _, _ in recalculate() }
        .onChange(of: findRiscI.sex)                      { _, _ in recalculate() }
        .onChange(of: findRiscI.physicalActivityMinPerWeek){ _, _ in recalculate() }
        .onChange(of: findRiscI.vegetablesFruitDaily)     { _, _ in recalculate() }
        .onChange(of: findRiscI.hypertensionMeds)         { _, _ in recalculate() }
        .onChange(of: findRiscI.highBloodGlucoseHistory)  { _, _ in recalculate() }
        .onChange(of: findRiscI.familyHistoryDiabetes)    { _, _ in recalculate() }
    }

    // MARK: - Mirels Criteria

    private var mirelsForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Lesion site").font(.subheadline)
                Picker("Site", selection: $mirelsI.site) {
                    Text("Upper limb (+1)").tag(1)
                    Text("Lower limb (+2)").tag(2)
                    Text("Peritrochanteric (+3)").tag(3)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Pain").font(.subheadline)
                Picker("Pain", selection: $mirelsI.pain) {
                    Text("Mild (+1)").tag(1)
                    Text("Moderate (+2)").tag(2)
                    Text("Functional (+3)").tag(3)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Lesion type (radiological)").font(.subheadline)
                Picker("Lesion", selection: $mirelsI.lesionType) {
                    Text("Blastic (+1)").tag(1)
                    Text("Mixed (+2)").tag(2)
                    Text("Lytic (+3)").tag(3)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Lesion size (cortical diameter)").font(.subheadline)
                Picker("Size", selection: $mirelsI.lesionSizeRatio) {
                    Text("< 1/3 (+1)").tag(1)
                    Text("1/3 – 2/3 (+2)").tag(2)
                    Text("> 2/3 (+3)").tag(3)
                }
                .pickerStyle(.segmented)
            }
        }
        .onChange(of: mirelsI) { _, _ in recalculate() }
    }

    // MARK: - CKD-EPI eGFR

    private var ckdEpiForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Serum creatinine (mg/dL)").font(.subheadline)
                HStack {
                    Slider(value: $ckdEpiI.serumCreatinineMgDL, in: 0.4...15, step: 0.1)
                    Text(String(format: "%.1f", ckdEpiI.serumCreatinineMgDL))
                        .frame(width: 50)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Age (years)").font(.subheadline)
                Stepper("\(ckdEpiI.ageYears) yrs", value: $ckdEpiI.ageYears, in: 18...100)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Sex").font(.subheadline)
                Picker("Sex", selection: $ckdEpiI.sex) {
                    Text("Male").tag("male")
                    Text("Female").tag("female")
                }
                .pickerStyle(.segmented)
            }
        }
        .onChange(of: ckdEpiI.serumCreatinineMgDL) { _, _ in recalculate() }
        .onChange(of: ckdEpiI.ageYears)             { _, _ in recalculate() }
        .onChange(of: ckdEpiI.sex)                  { _, _ in recalculate() }
    }

    // MARK: - ARISCAT Score

    private var ariscatForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Age (years)").font(.subheadline)
                Stepper("\(ariscatI.age) yrs", value: $ariscatI.age, in: 0...110)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Pre-op SpO₂ (%)").font(.subheadline)
                Stepper("\(ariscatI.spo2Preop)%", value: $ariscatI.spo2Preop, in: 70...100)
            }
            Toggle(isOn: $ariscatI.respiratoryInfection) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Acute respiratory infection (last month)").font(.subheadline)
                    Text("+17 if present").font(.caption).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Pre-op haemoglobin (g/dL)").font(.subheadline)
                HStack {
                    Slider(value: $ariscatI.preOpHaemoglobin, in: 5...20, step: 0.5)
                    Text(String(format: "%.1f", ariscatI.preOpHaemoglobin))
                        .frame(width: 50)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Surgical incision type").font(.subheadline)
                Picker("Incision", selection: $ariscatI.surgicalIncision) {
                    Text("Peripheral (+0)").tag(0)
                    Text("Upper abdominal (+15)").tag(1)
                    Text("Intrathoracic (+24)").tag(2)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Planned surgical duration (hours)").font(.subheadline)
                HStack {
                    Slider(value: $ariscatI.surgicalDurationHrs, in: 0.5...10, step: 0.5)
                    Text(String(format: "%.1f h", ariscatI.surgicalDurationHrs))
                        .frame(width: 55)
                        .font(.caption.monospacedDigit())
                }
            }
            Toggle(isOn: $ariscatI.emergencyProcedure) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Emergency procedure").font(.subheadline)
                    Text("+8 if emergency").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .onChange(of: ariscatI.age)                 { _, _ in recalculate() }
        .onChange(of: ariscatI.spo2Preop)           { _, _ in recalculate() }
        .onChange(of: ariscatI.respiratoryInfection){ _, _ in recalculate() }
        .onChange(of: ariscatI.preOpHaemoglobin)    { _, _ in recalculate() }
        .onChange(of: ariscatI.surgicalIncision)    { _, _ in recalculate() }
        .onChange(of: ariscatI.surgicalDurationHrs) { _, _ in recalculate() }
        .onChange(of: ariscatI.emergencyProcedure)  { _, _ in recalculate() }
    }

    // MARK: - Fong Clinical Risk Score

    private var fongCrsForm: some View {
        Group {
            scoreToggle("Lymph node–positive primary tumour",
                        binding: $fongI.nodePosivePrimaryTumour, points: "+1")
            scoreToggle("Disease-free interval < 12 months",
                        binding: $fongI.diseaseFreeIntervalLess12Mo, points: "+1")
            scoreToggle("More than 1 hepatic metastasis",
                        binding: $fongI.moreThanOneHepaticTumour, points: "+1")
            scoreToggle("Largest hepatic tumour > 5 cm",
                        binding: $fongI.largestTumourOver5cm, points: "+1")
            scoreToggle("Preoperative CEA > 200 ng/mL",
                        binding: $fongI.ceaOver200, points: "+1")
        }
        .onChange(of: fongI) { _, _ in recalculate() }
    }

    // MARK: - Berlin ARDS

    private var berlinARDSForm: some View {
        Group {
            Text("Berlin Definition (2012). Requires: acute onset ≤1 week, bilateral opacities not explained by effusions/lobar collapse/nodules, respiratory failure not fully explained by cardiac failure. PF ratio measured with PEEP/CPAP ≥5 cmH₂O.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            HStack {
                Text("PaO₂/FiO₂ ratio (mmHg)")
                Spacer()
                Stepper(String(format: "%.0f", berlinI.pao2FiO2Ratio),
                        onIncrement: { berlinI.pao2FiO2Ratio = min(600, berlinI.pao2FiO2Ratio + 10) },
                        onDecrement: { berlinI.pao2FiO2Ratio = max(0, berlinI.pao2FiO2Ratio - 10) })
                    .fixedSize()
            }
            HStack {
                Text("PEEP/CPAP (cmH₂O)")
                Spacer()
                Stepper("\(berlinI.peepOrCPAP)", value: $berlinI.peepOrCPAP, in: 0...30)
                    .fixedSize()
            }
            scoreToggle("Acute onset within 1 week of clinical insult or new/worsening symptoms",
                        binding: $berlinI.acuteOnsetWithin1Week, points: "Required")
            scoreToggle("Bilateral opacities on CXR/CT not fully explained by effusions, lobar/lung collapse, or nodules",
                        binding: $berlinI.bilateralOpacitiesOnImaging, points: "Required")
            scoreToggle("Respiratory failure not fully explained by cardiac failure or fluid overload",
                        binding: $berlinI.notExplainedByCardiacFailure, points: "Required")
        }
        .onChange(of: berlinI) { _, _ in recalculate() }
    }

    // MARK: - CAGE

    private var cageForm: some View {
        Group {
            Text("CAGE questionnaire: 2 or more positive responses = probable alcohol use disorder (sensitivity ~74%, specificity ~91% for AUD in primary care).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            scoreToggle("C — Have you felt you should Cut down on your drinking?",
                        binding: $cageI.feltCutDown, points: "+1")
            scoreToggle("A — Have people Annoyed you by criticising your drinking?",
                        binding: $cageI.annoyedByCriticism, points: "+1")
            scoreToggle("G — Have you ever felt bad or Guilty about your drinking?",
                        binding: $cageI.feltGuilty, points: "+1")
            scoreToggle("E — Have you ever had a drink first thing in the morning to steady your nerves or get rid of a hangover (Eye-opener)?",
                        binding: $cageI.eyeOpener, points: "+1")
        }
        .onChange(of: cageI) { _, _ in recalculate() }
    }

    // MARK: - Duke Criteria (IE)

    private var dukeIEForm: some View {
        Group {
            Text("Modified Duke Criteria (Li 2000). Definite IE: 2 major, OR 1 major + 3 minor, OR 5 minor. Possible IE: 1 major + 1 minor, OR 3 minor. Rejected: firm alternative diagnosis, resolution with ≤4 days antibiotics, or pathological criteria not met.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            Text("Major criteria").font(.caption).bold().foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text("Positive blood cultures (0 = none, 1 = one set, 2 = ≥2 sets typical organism / persistent)")
                Picker("Blood cultures", selection: $dukeI.positiveBloodCultures) {
                    Text("0 — No typical organism").tag(0)
                    Text("1 — Single culture").tag(1)
                    Text("2 — ≥2 sets typical organism or persistent bacteraemia").tag(2)
                }
                .pickerStyle(.segmented)
                .onChange(of: dukeI.positiveBloodCultures) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Endocardial involvement (echo/new valve regurgitation)")
                Picker("Endocardial", selection: $dukeI.endocardialInvolvement) {
                    Text("0 — None").tag(0)
                    Text("1 — Suggestive").tag(1)
                    Text("2 — Definite oscillating mass / abscess / dehiscence / new regurgitation").tag(2)
                }
                .pickerStyle(.segmented)
                .onChange(of: dukeI.endocardialInvolvement) { _, _ in recalculate() }
            }
            Text("Minor criteria").font(.caption).bold().foregroundStyle(.secondary)
            scoreToggle("Predisposing heart condition (known valve disease, prosthetic valve, prior IE)",
                        binding: $dukeI.predisposedHeartCondition, points: "Minor")
            scoreToggle("Injection drug use",
                        binding: $dukeI.ivDrugUse, points: "Minor")
            scoreToggle("Fever ≥38°C",
                        binding: $dukeI.feverGe38, points: "Minor")
            scoreToggle("Vascular phenomena (major arterial emboli, septic pulmonary infarcts, mycotic aneurysm, intracranial haemorrhage, conjunctival haemorrhage, Janeway lesions)",
                        binding: $dukeI.vascularPhenomena, points: "Minor")
            scoreToggle("Immunological phenomena (glomerulonephritis, Osler nodes, Roth spots, positive rheumatoid factor)",
                        binding: $dukeI.immunologicPhenomena, points: "Minor")
            scoreToggle("Positive blood culture (not meeting major criterion) or serological evidence",
                        binding: $dukeI.positiveBloodCultureMinor, points: "Minor")
            scoreToggle("Echo findings consistent with IE (not meeting major criterion)",
                        binding: $dukeI.echoMinor, points: "Minor")
        }
        .onChange(of: dukeI) { _, _ in recalculate() }
    }

    // MARK: - mMRC Dyspnoea Scale

    private var mmrcForm: some View {
        Group {
            Text("Modified Medical Research Council dyspnoea scale. Grade ≥2 is used in GOLD COPD classification. Grade ≥2 correlates with significant functional impairment and is used in perioperative risk assessment (functional capacity < 4 METs).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            VStack(alignment: .leading, spacing: 4) {
                Text("Dyspnoea grade")
                Picker("mMRC grade", selection: $mmrcI.grade) {
                    Text("0 — Only with strenuous exercise").tag(0)
                    Text("1 — Hurrying on level or walking up a slight hill").tag(1)
                    Text("2 — Walks slower than peers, or stops after ≤15 min on level").tag(2)
                    Text("3 — Stops for breath after ~100 m or few minutes on level ground").tag(3)
                    Text("4 — Too breathless to leave house, or when dressing/undressing").tag(4)
                }
                .pickerStyle(.inline)
                .onChange(of: mmrcI.grade) { _, _ in recalculate() }
            }
        }
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

    // MARK: - FGSI

    private var fgsiForm: some View {
        Group {
            Text("Fournier Gangrene Severity Index. Score ≥9 = high mortality risk (>75%). Based on APACHE-II physiological parameters.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            HStack {
                Text("Temperature (°C)")
                Spacer()
                Stepper(String(format: "%.1f", fgsiI.temperature),
                        onIncrement: { fgsiI.temperature = min(45, fgsiI.temperature + 0.1); recalculate() },
                        onDecrement: { fgsiI.temperature = max(30, fgsiI.temperature - 0.1); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Heart rate (bpm)")
                Spacer()
                Stepper("\(fgsiI.heartRate)", value: $fgsiI.heartRate, in: 20...200, step: 5)
                    .fixedSize()
                    .onChange(of: fgsiI.heartRate) { _, _ in recalculate() }
            }
            HStack {
                Text("Respiratory rate (/min)")
                Spacer()
                Stepper("\(fgsiI.respiratoryRate)", value: $fgsiI.respiratoryRate, in: 4...60, step: 1)
                    .fixedSize()
                    .onChange(of: fgsiI.respiratoryRate) { _, _ in recalculate() }
            }
            HStack {
                Text("Sodium (mmol/L)")
                Spacer()
                Stepper(String(format: "%.0f", fgsiI.sodium),
                        onIncrement: { fgsiI.sodium = min(200, fgsiI.sodium + 1); recalculate() },
                        onDecrement: { fgsiI.sodium = max(90, fgsiI.sodium - 1); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Potassium (mmol/L)")
                Spacer()
                Stepper(String(format: "%.1f", fgsiI.potassium),
                        onIncrement: { fgsiI.potassium = min(10, fgsiI.potassium + 0.1); recalculate() },
                        onDecrement: { fgsiI.potassium = max(1, fgsiI.potassium - 0.1); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Creatinine (μmol/L)")
                Spacer()
                Stepper(String(format: "%.0f", fgsiI.creatinine),
                        onIncrement: { fgsiI.creatinine = min(1000, fgsiI.creatinine + 10); recalculate() },
                        onDecrement: { fgsiI.creatinine = max(10, fgsiI.creatinine - 10); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Haematocrit (%)")
                Spacer()
                Stepper(String(format: "%.0f", fgsiI.haematocrit),
                        onIncrement: { fgsiI.haematocrit = min(75, fgsiI.haematocrit + 1); recalculate() },
                        onDecrement: { fgsiI.haematocrit = max(10, fgsiI.haematocrit - 1); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("WBC (×10⁹/L)")
                Spacer()
                Stepper(String(format: "%.1f", fgsiI.wbc),
                        onIncrement: { fgsiI.wbc = min(60, fgsiI.wbc + 0.5); recalculate() },
                        onDecrement: { fgsiI.wbc = max(0, fgsiI.wbc - 0.5); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Bicarbonate (mmol/L)")
                Spacer()
                Stepper(String(format: "%.0f", fgsiI.bicarbonate),
                        onIncrement: { fgsiI.bicarbonate = min(50, fgsiI.bicarbonate + 1); recalculate() },
                        onDecrement: { fgsiI.bicarbonate = max(5, fgsiI.bicarbonate - 1); recalculate() })
                    .fixedSize()
            }
        }
        .onChange(of: fgsiI) { _, _ in recalculate() }
    }


}