import SwiftUI
import SwiftData

// MARK: - Main view

struct ClinicalScoresView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) var modelContext

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
