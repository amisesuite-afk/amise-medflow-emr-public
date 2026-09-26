import Foundation

// MARK: - Bayesian differential-diagnosis engine
// Naive-Bayes style: log-posterior = log-prior + Σ log-LR for each observed feature.
// All arithmetic is in integer units scaled to avoid Float imprecision;
// values are converted to probabilities via softmax at the end.

enum BayesianDiagnosisEngine {

    /// Log units per natural-log unit: logPrior, logLR and logPosterior are stored as
    /// round(ln(x) × 5) (DiagnosticDatabase.json "conversionFormula").
    static let logUnitsPerNat = 5.0

    // MARK: - Public output type

    struct DiagnosisResult: Identifiable {
        let id = UUID()
        let name: String
        let icdCode: String
        let probability: Int          // 0–100 % (softmax — display only, NOT the confidence signal)
        let evidence: [String]        // flat list — kept for backwards compat
        // Evidence grouped by input source.
        // Keys: "symptoms" | "exam" | "history" | "investigation" | "score" | "longitudinal"
        let evidenceSources: [String: [String]]
        let confidence: Confidence
        // Primary confidence signals (logGap-based, not softmax-based)
        let rawLogPosterior: Int           // log-posterior before softmax
        let logGap: Int                    // rank-1 minus rank-2 log-posterior gap (0 for non-rank-1)
        let pathognomicFindings: [String]  // fired features with logLR ≥ 18
        /// Clinical urgency tier: 0=routine 1=urgent 2=emergency 3=critical
        /// Drives the safety-net boost and urgency badge in the differential UI.
        let urgency: Int
        /// Every feature that fired for this candidate (positive and negative), with its weight and
        /// citation: the diagnostic-reasoning layer's evidence (DiagnosticReasoningAdapter.swift).
        var firedFeatures: [FiredFeature] = []
        /// The candidate's own feature list (for its cardinal findings that did not fire).
        var candidateFeatures: [Candidate.Feature] = []

        enum Confidence {
            case certain  // logGap ≥ 25 — statistically overwhelming
            case high     // logGap ≥ 15 or pathognomonic finding fired
            case moderate // logGap ≥ 7
            case low      // otherwise

            var label: String {
                switch self {
                case .certain:  "Certain"
                case .high:     "High"
                case .moderate: "Moderate"
                case .low:      "Low"
                }
            }
        }
    }

    // MARK: - Longitudinal context (aggregated from closed encounters)

    struct LongitudinalContext {
        let confirmedDiagnoses: [String]
        let cumulativeInvestigations: [InvestigationEntry]
        let accumulatedPMH: String
        let accumulatedPSHx: String
        let encounterCount: Int
        let lastVisitType: VisitType?
        let daysSinceLastEncounter: Int?

        static let empty = LongitudinalContext(
            confirmedDiagnoses: [],
            cumulativeInvestigations: [],
            accumulatedPMH: "",
            accumulatedPSHx: "",
            encounterCount: 0,
            lastVisitType: nil,
            daysSinceLastEncounter: nil
        )
    }

    // MARK: - Public entry point

    static func infer(
        chiefComplaint: String?,
        socratesSelections: [String: Set<String>],
        pmhNotes: String?,
        surgicalHistory: String?,
        examAbdo: String?,
        examGeneral: String?,
        examCVS: String? = nil,
        examResp: String? = nil,
        examNeuro: String? = nil,
        examMSK: String? = nil,
        examSkin: String? = nil,
        examOther: String? = nil,
        investigations: [InvestigationEntry],
        ageYears: Int,
        sex: Sex,
        longitudinal: LongitudinalContext = .empty,
        medications: [String] = [],
        socialHistoryText: String? = nil,
        bmi: Double? = nil,
        alvaradoScore: Int? = nil,
        glasgowPancreatitisScore: Int? = nil,
        ransonScore: Int? = nil,
        tokyoCholecystitisGrade: Int? = nil,
        tokyoCholangitisGrade: Int? = nil,
        rockallScore: Int? = nil,
        blatchfordScore: Int? = nil,
        wellsDVTScore: Double? = nil,
        wellsPEScore: Double? = nil,
        abcd2Score: Int? = nil,
        lrinecScore: Int? = nil,
        qsofaScore: Int? = nil,
        psiScore: Int? = nil,         // PSI/PORT class (1–5) for pneumonia severity
        capriniScore: Int? = nil,     // Caprini VTE risk total score
        bisapScore: Int? = nil,       // BISAP (0–5) for acute pancreatitis severity; ≥3 = severe
        aims65Score: Int? = nil,      // AIMS65 (0–5) for upper GI bleed in-hospital mortality
        sofaScore: Int? = nil,        // SOFA (0–24); ≥2 with infection = sepsis (Sepsis-3)
        fib4Score: Double? = nil,     // FIB-4 (continuous); >2.67 = significant fibrosis
        curb65Score: Int? = nil,      // CURB-65 (0–5); ≥3 = hospital admission for CAP
        paduaScore: Int? = nil,       // Padua (0–20); ≥4 = high VTE risk in medical patients
        apacheIIScore: Int? = nil,    // APACHE II (0–71); ≥20 = high ICU mortality risk
        ppossumMortPct10: Int? = nil, // P-POSSUM predicted mortality ×10 (e.g. 85 = 8.5%)
        mpiScore: Int? = nil,         // MPI (0–47); ≥21 = significant mortality; ≥30 = critical
        ctsiScore: Int? = nil,        // CTSI (0–10); ≥4 = moderate, ≥7 = severe pancreatitis
        nrs2002Score: Int? = nil,     // NRS-2002 (0–7); ≥3 = nutritional risk — malnutrition boosts
        forrestGrade: Int? = nil,     // Forrest grade (1–6); 1–2=active bleed, 3=visible vessel (high rebleed)
        heartScore: Int? = nil,       // HEART Score (0–10); ≥4 = moderate/high MACE risk
        mallampatiClass: Int? = nil,  // Mallampati class (1–4); ≥3 = potentially difficult airway
        cfsScore: Int? = nil,         // CFS (1–9); ≥5 = mild frailty — boosts frailty-related candidates
        timiScore: Int? = nil,        // TIMI (0–7); ≥3 = intermediate, ≥5 = high ACS risk
        waterlowScore: Int? = nil,    // Waterlow (0–64); ≥15 = high, ≥20 = very high pressure ulcer risk
        surgicalApgarScore: Int? = nil, // Surgical Apgar (0–10); ≤4 = high risk of major surgical complication
        graceScore: Int? = nil,       // GRACE (0–372); >140 = high in-hospital ACS mortality
        dasiScore: Int? = nil,        // DASI (0–58); <34 = poor functional capacity (<4 METs)
        barthelScore: Int? = nil,     // Barthel Index (0–100); ≤20 = severe ADL dependency
        euroScoreII: Int? = nil,      // EuroSCORE II predicted mortality ×10 (e.g. 35 = 3.5%); ≥50 = high risk
        nihssScore: Int? = nil,       // NIHSS (0–42); ≥16 = moderate-severe/severe stroke
        mrsScore: Int? = nil,         // mRS (0–6); ≥3 = moderate-severe disability
        mustScore: Int? = nil,        // MUST (0–6); ≥2 = high malnutrition risk
        clavienDindoScore: Int? = nil, // Clavien-Dindo grade 0–7; ≥3 = procedural/surgical intervention required
        aldreteScore: Int? = nil,     // Modified Aldrete 0–10; <9 = not fit for PACU discharge
        fourTScore: Int? = nil,       // 4T Score 0–8; ≥4 = intermediate/high HIT probability
        oaklandScore: Int? = nil,     // Oakland Score 0–29; ≤8=low risk, ≥15=high risk LGIB
        kingsCriteriaScore: Int? = nil, // King's College Criteria 0=not met, 1=met (transplant referral)
        childPughScore: Int? = nil,   // Child-Pugh 5–15; class A≤6, B7–9, C≥10
        meldScore: Int? = nil,        // MELD 6–40; ≥15 = transplant listing threshold
        asaScore: Int? = nil,         // ASA Physical Status 1–6
        ecogScore: Int? = nil,        // ECOG 0–4; ≥2 = reduced fitness
        rtsScore: Int? = nil,         // RTS ×100 as Int; <400 = critical trauma
        kdigoStage: Int? = nil,       // KDIGO AKI 0–3
        bauxScore: Int? = nil,        // Baux score (age + TBSA [+17 inhalation]); ≥40 = significant burns
        issScore: Int? = nil,         // ISS 0–75; ≥16 = major trauma
        nutricScore: Int? = nil,      // NUTRIC 0–9; ≥6 = high nutritional risk in ICU
        spesiScore: Int? = nil,       // sPESI 0–6; 0 = low risk PE, ≥1 = high risk PE
        decafScore: Int? = nil,       // DECAF 0–6; ≥3 = high risk COPD exacerbation
        hincheyGrade: Int? = nil,     // Hinchey 1–4; ≥3 = emergency surgery for diverticulitis
        airScore: Int? = nil,         // AIR 0–12; ≥9 = high-risk appendicitis
        percViolations: Int? = nil,   // PERC 0–8; 0 = PE excluded (low pretest)
        shockIndex: Int? = nil,       // SI × 100; ≥100 = significant haemodynamic compromise
        parklandVolume: Int? = nil,   // burns fluid (mL); presence indicates significant burn injury
        pasScore: Int? = nil,         // PAS 0–10; ≥7 = high-risk paediatric appendicitis
        revisedGenevaScore: Int? = nil, // Revised Geneva 0–22; ≥11 = high probability PE
        cciScore: Int? = nil,           // CCI 0–37 (age-adjusted); ≥5 = high comorbidity burden
        mfi5Score: Int? = nil,          // mFI-5 0–5; ≥3 = severe frailty; modifies all diagnoses
        hapsScore: Int? = nil,          // HAPS 0–3; 3 = harmless AP; <3 = potentially severe
        glasgowImrieScore: Int? = nil,  // Glasgow-Imrie 0–8; ≥3 = severe AP (48-h variables)
        albiScore: Double? = nil,       // ALBI continuous; Grade 1 ≤-2.60, Grade 3 >-1.39
        auditCScore: Int? = nil,        // AUDIT-C 0–12; ≥4(M)/≥3(F) = hazardous drinking
        phq9Score: Int? = nil,          // PHQ-9 0–27; ≥10 = moderate depression
        sapsIIScore: Int? = nil,        // SAPS II 0–163; ≥40 = >30% predicted mortality
        stoneScore: Int? = nil,         // Stone CT features 0–6 (local; not STONE); ≥4 = legacy ureteric colic boost
        losAngelesGrade: Int? = nil,    // LA Class 0–4; ≥3 = severe oesophagitis
        meld3Score: Double? = nil,      // MELD 3.0 continuous; ≥15 = transplant threshold
        bradenScore: Int? = nil,        // Braden 6–23; ≤12 = high/very-high pressure injury risk
        centorScore: Int? = nil,        // Centor/McIsaac -1–5; ≥3 = moderate GAS probability
        ipssScore: Int? = nil,          // IPSS 0–35; ≥20 = severe LUTS suggesting BPH/obstruction
        trueloveWittsScore: Int? = nil, // Truelove-Witts 1–3; 3 = severe UC/colitis
        harveyBradshawScore: Int? = nil,// Harvey-Bradshaw 0+; ≥8 = moderate–severe Crohn's activity
        maddreyScore: Double? = nil,    // Maddrey DF continuous; ≥32 = severe alcoholic hepatitis
        manningScore: Int? = nil,       // Manning 0–6; ≥3 = probable IBS
        laceScore: Int? = nil,          // LACE 0–19; ≥10 = high 30-day readmission risk
        findRiscScore: Int? = nil,      // FINDRISC 0–26; ≥12 = T2DM screening required
        mirelsScore: Int? = nil,        // Mirels 4–12; ≥9 = prophylactic fixation
        ckdEpiEgfr: Double? = nil,      // CKD-EPI eGFR mL/min/1.73m²; <60 = CKD
        ariscatScore: Int? = nil,       // ARISCAT 0–123; ≥26 = intermediate/high PPC risk
        fongCrsScore: Int? = nil,       // Fong CRS 0–5; ≥3 = poor prognosis for CLM resection
        berlinPFRatio: Double? = nil,   // Berlin ARDS PaO₂/FiO₂ ratio; <300 = ARDS
        cageScore: Int? = nil,          // CAGE 0–4; ≥2 = probable alcohol use disorder
        dukeIEScore: Double? = nil,     // Duke IE classification score (majorCount×2 + minorCount)
        mmrcGrade: Int? = nil,          // mMRC dyspnoea grade 0–4; ≥3 = severe impairment
        ptsScore: Int? = nil,           // Paediatric Trauma Score −6 to +12; ≤8 = major trauma
        ripasaScore: Double? = nil,     // RIPASA 0–16; ≥7.5 = probable appendicitis
        fgsiScore: Int? = nil,          // FGSI 0+; ≥9 = high-mortality Fournier gangrene
        hincheyStage: Int? = nil,       // Hinchey 1–5; ≥3 = purulent/faecal peritonitis
        sirsScore: Int? = nil,          // SIRS 0–4; ≥2 = systemic inflammatory response
        mewsScore: Int? = nil,          // MEWS 0–14; ≥5 = urgent deterioration
        independentNews2: Int? = nil,   // Standalone NEWS2 0–20; ≥7 = urgent response
        gcsScore: Int? = nil,           // GCS 3–15; ≤8 = severe neurological impairment
        rcriScore: Int? = nil,          // RCRI 0–6; ≥2 = elevated periop cardiac risk
        stopBangScore: Int? = nil,      // STOP-BANG 0–8; ≥3 = intermediate/high OSA risk
        cha2ds2vascScore: Int? = nil,   // CHA₂DS₂-VASc 0–9; ≥2M/≥3F = anticoagulation
        hasBledScore: Int? = nil,       // HAS-BLED 0–9; ≥3 = high bleeding risk
        // Decision rules added with ios-outcomes-calculators (decision-rules.json `ios.param`): the
        // stored value becomes the rule's band feature (DecisionRuleEvidence); no legacy adjustment.
        stoneUretericScore: Int? = nil,  // STONE (Moore 2014) 0–13
        ottawaAnkleScore: Int? = nil,    // Ottawa ankle and foot rules: criteria present
        ottawaKneeScore: Int? = nil,     // Ottawa knee rule: criteria present
        canadianCTHeadScore: Int? = nil, // Canadian CT head rule: 0 none, 1 medium, 2 high
        nexusScore: Int? = nil,          // NEXUS: low-risk criteria not met
        canadianCSpineScore: Int? = nil, // Canadian C-spine rule: 0 no imaging, 1 imaging
        sfSyncopeScore: Int? = nil,      // San Francisco syncope rule (prognostic: display only)
        canadianSyncopeScore: Int? = nil, // Canadian syncope risk score (prognostic: display only)
        latestHR: Int? = nil,         // measured heart rate (bpm)
        latestSBP: Int? = nil,        // systolic BP (mmHg)
        latestTemp: Double? = nil,    // temperature (°C)
        latestSpO2: Int? = nil,       // oxygen saturation (%)
        latestRR: Int? = nil,         // respiratory rate (breaths/min)
        news2Score: Int? = nil,       // computed NEWS2 score (0–20)
        specialtyHint: String? = nil, // e.g. "cardiology" — narrows matrix cross-query to that specialty
        hpi: String? = nil            // history of presenting complaint: read negation-aware by the curated "finding" features
    ) -> [DiagnosisResult] {
        // Pool routing reads the chief complaint only. Investigation text used to be appended
        // to the complaint before routing, so a report ("US: no gallstones", "urine dipstick")
        // replaced the complaint's pool (clinical validation 2026-09). Both texts are matched
        // negation-aware at word starts (RouteText): "no vomiting" does not route to vomiting.
        // Resulted investigations still add pools through the secondary merges further down
        // (evL), which never replace the complaint's own pool.
        let baseCC = chiefComplaint ?? ""
        guard !baseCC.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !investigations.isEmpty else { return [] }
        let investigationLines = investigations.map { inv -> String in
            inv.status == .resulted && !inv.result.isEmpty ? "\(inv.name): \(inv.result)" : inv.name
        }
        let ccL = RouteText(baseCC)
        let evL = RouteText(NegationMatcher.joinClauses([baseCC] + investigationLines))

        var candidates: [Candidate]
        var seenNames = Set<String>()
        func mergePool(_ name: String) {
            guard let extra = externalPool(name) else { return }
            let novel = extra.filter { seenNames.insert($0.name).inserted }
            candidates.append(contentsOf: novel)
        }
        switch true {
        case ccL.contains("jaundice") || ccL.contains("yellow") ||
             ccL.contains("dark urine") || ccL.contains("pale stool") ||
             ccL.contains("clay stool") || (ccL.contains("pruritus") && ccL.contains("jaund")):
            candidates = externalPool("jaundice") ?? jaundice
        case ccL.contains("dysphagia") || ccL.contains("swallow") ||
             ccL.contains("odynophagia") || ccL.contains("painful swallow") ||
             ccL.contains("difficulty eating"):
            candidates = externalPool("dysphagia") ?? dysphagia
        case ccL.contains("rectal bleed") || ccL.contains("blood per rectum") ||
             ccL.contains("haematochezia") || ccL.contains("bpr"):
            candidates = externalPool("rectalBleeding") ?? rectalBleeding
        case ccL.contains("bowel habit") || ccL.contains("change in stool") ||
             ccL.contains("constipation") || ccL.contains("diarrhoea") || ccL.contains("diarrhea"):
            candidates = externalPool("bowelHabit") ?? bowelHabit
        case ccL.contains("breast") && (ccL.contains("lump") || ccL.contains("mass") ||
             ccL.contains("nipple") || ccL.contains("discharge") || ccL.contains("pain") ||
             ccL.contains("skin change") || ccL.contains("dimpling")) ||
             (ccL.contains("axillary") && ccL.contains("lump")):
            candidates = externalPool("breastLump") ?? breastLump
        case ccL.contains("neck") && (ccL.contains("lump") || ccL.contains("swelling") || ccL.contains("mass")) ||
             ccL.contains("lymphadenopathy") || ccL.contains("lymph node") ||
             ccL.contains("facial swelling") || ccL.contains("submandibular swelling"):
            candidates = externalPool("neckLump") ?? neckLump
        case ccL.contains("thyroid") || ccL.contains("hypothyroid") ||
             ccL.contains("hyperthyroid") || ccL.contains("graves") ||
             ccL.contains("goitre") || ccL.contains("hashimoto") ||
             ccL.contains("thyrotoxic") || ccL.contains("tsh") ||
             ccL.contains("hoarseness") || ccL.contains("voice change") ||
             ccL.contains("heat intolerance") || ccL.contains("cold intolerance") ||
             (ccL.contains("tremor") && (ccL.contains("thyroid") || ccL.contains("weight loss"))):
            candidates = externalPool("thyroidPathology") ?? thyroidPathology
        case ccL.contains("hernia") || (ccL.contains("groin") && ccL.contains("lump")):
            candidates = externalPool("hernia") ?? hernia
        case ccL.contains("perianal") || ccL.contains("haemorrhoid") ||
             ccL.contains("hemorrhoid") || ccL.contains("anal pain") || ccL.contains("piles") ||
             ccL.contains("anal discharge") || ccL.contains("pruritus ani") ||
             ccL.contains("fecal incontinence") || ccL.contains("faecal incontinence") ||
             (ccL.contains("anal") && ccL.contains("lump")):
            candidates = externalPool("perianal") ?? perianal
        case ccL.contains("weight loss") || ccL.contains("anorexia") || ccL.contains("cachexia"):
            candidates = externalPool("weightLoss") ?? weightLoss
        case ccL.contains("reflux") || ccL.contains("heartburn") ||
             ccL.contains("gerd") || ccL.contains("gord") ||
             ccL.contains("bloating") || ccL.contains("indigestion") ||
             ccL.contains("dyspepsia") || ccL.contains("regurgitat"):
            candidates = externalPool("refluxGERD") ?? refluxGERD
        case ccL.contains("right iliac fossa") || ccL.contains("rif pain") ||
             ccL.contains("appendic") || ccL.contains("rlq pain"):
            candidates = externalPool("rightIliacFossaPain") ?? []
        case ccL.contains("biliary colic") || ccL.contains("cholecystit") ||
             (ccL.contains("gallstone") && !ccL.contains("pancreat")) ||
             (ccL.contains("gallbladder") && !ccL.contains("pancreat")):
            candidates = externalPool("biliaryColic") ?? []
        case ccL.contains("pancreatitis") || ccL.contains("acute pancreatic") ||
             (ccL.contains("epigast") && ccL.contains("back") && ccL.contains("amylase")):
            candidates = externalPool("acutePancreatitis") ?? []
        case ccL.contains("groin pain") || ccL.contains("inguinal pain"):
            candidates = externalPool("groinPain") ?? groinPain
        case ccL.contains("abdom") || ccL.contains("belly") || ccL.contains("stomach") ||
             ccL.contains("upper abdom") || ccL.contains("epigast") ||
             ccL.contains("right upper") || ccL.contains("right lower") ||
             ccL.contains("ruq") || ccL.contains("llq") || ccL.contains("rlq"):
            candidates = externalPool("abdominalPain") ?? abdominalPain
        case ccL.contains("chest pain") || ccL.contains("chest tightness") ||
             ccL.contains("chest heaviness") || ccL.contains("palpitation"):
            candidates = externalPool("chestPain") ?? chestPain
        case ccL.contains("short") && ccL.contains("breath") ||
             ccL.contains("dyspnoea") || ccL.contains("breathless") ||
             ccL.contains("sob") || ccL.contains("wheez"):
            candidates = externalPool("shortnessOfBreath") ?? shortnessOfBreath
        case ccL.contains("fever") || ccL.contains("infection") || ccL.contains("pyrexia") ||
             ccL.contains("dengue") || ccL.contains("leptospir") || ccL.contains("typhoid") ||
             ccL.contains("rigor") || ccL.contains("chills"):
            candidates = externalPool("feverInfection") ?? feverInfection
        case ccL.contains("urinary") || ccL.contains("dysuria") || ccL.contains("haematuria") ||
             ccL.contains("frequency") || ccL.contains("urine") || ccL.contains("uti"):
            candidates = externalPool("urinarySymptoms") ?? urinarySymptoms
        case ccL.contains("joint") || ccL.contains("arthrit") || ccL.contains("gout") ||
             ccL.contains("musculoskelet") || ccL.contains("swollen joint") ||
             ccL.contains("joint pain") || ccL.contains("arthralgia"):
            candidates = externalPool("jointPain") ?? jointPain
        case ccL.contains("hypertension") || ccL.contains("high blood pressure") ||
             ccL.contains("htn") || ccL.contains("bp review") || ccL.contains("blood pressure"):
            candidates = externalPool("hypertensionReview") ?? hypertensionReview
        case ccL.contains("diabetes") || ccL.contains("diabetic") || ccL.contains("glucose") ||
             ccL.contains("hba1c") || ccL.contains("dm2") || ccL.contains("dm1"):
            candidates = externalPool("diabetesReview") ?? diabetesReview
        case ccL.contains("nausea") || ccL.contains("vomiting") || ccL.contains("vomit") ||
             ccL.contains("emesis") || ccL.contains("retching"):
            candidates = externalPool("nauseaVomiting") ?? nauseaVomiting
        case ccL.contains("haematemesis") || ccL.contains("hematemesis") ||
             ccL.contains("melaena") || ccL.contains("melena") ||
             ccL.contains("coffee ground") || ccL.contains("upper gi bleed") ||
             (ccL.contains("blood") && ccL.contains("vomit")):
            candidates = externalPool("upperGIBleed") ?? upperGIBleed
        case ccL.contains("post-op") || ccL.contains("post op") || ccL.contains("postop") ||
             ccL.contains("post-operative") || ccL.contains("post operative") ||
             ccL.contains("post surgery") || ccL.contains("post-surgery"):
            candidates = externalPool("postOpReview") ?? postOpReview
        case ccL.contains("adrenal") || ccL.contains("conn") || ccL.contains("cushing") ||
             ccL.contains("pheochromocytoma") || ccL.contains("phaeochromocytoma") ||
             ccL.contains("incidentaloma") || ccL.contains("hyperaldosterone"):
            candidates = externalPool("adrenalEndocrine") ?? adrenalEndocrine
        case ccL.contains("vascular") || ccL.contains("mesenteric") ||
             ccL.contains("ischaemia") || ccL.contains("ischemia") ||
             ccL.contains("aortic") || ccL.contains("claudicat") ||
             ccL.contains("limb ischaemia") || ccL.contains("peripheral arterial") ||
             ccL.contains("varicose vein") || ccL.contains("non-healing ulcer") ||
             ccL.contains("venous ulcer") || ccL.contains("pulsatile mass") ||
             ccL.contains("arterial ulcer"):
            candidates = externalPool("vascularSurgical") ?? vascularSurgical
        case ccL.contains("bowel obstruct") || ccL.contains("small bowel") ||
             ccL.contains("volvulus") || ccL.contains("intussuscep") ||
             (ccL.contains("obstruction") && (ccL.contains("bowel") || ccL.contains("intesti"))):
            candidates = externalPool("smallBowelObstruction") ?? smallBowelObstruction
        case ccL.contains("pilonidal") || ccL.contains("coccyx") || ccL.contains("sacrococcygeal"):
            candidates = externalPool("pilonidalDisease") ?? pilonidalDisease
        case ccL.contains("renal colic") || ccL.contains("kidney stone") ||
             ccL.contains("ureteric") || ccL.contains("nephrolithiasis") ||
             ccL.contains("loin to groin") || ccL.contains("renal calcul"):
            candidates = externalPool("renalColic") ?? renalColic
        case ccL.contains("stroke") || ccL.contains("tia") || ccL.contains("transient ischaem") ||
             ccL.contains("facial droop") || ccL.contains("hemiplegia") || ccL.contains("hemiparesis") ||
             ccL.contains("aphasia") || ccL.contains("dysphasia") || ccL.contains("dysarthria") ||
             ccL.contains("speech difficulty") || ccL.contains("gait disturbance") ||
             (ccL.contains("sudden") && (ccL.contains("weakness") || ccL.contains("numbness"))) ||
             (ccL.contains("visual") && (ccL.contains("sudden") || ccL.contains("loss"))):
            candidates = externalPool("strokeTIA") ?? strokeTIA
        case ccL.contains("anaemia") || ccL.contains("anemia") ||
             (ccL.contains("fatigue") && ccL.contains("pallor")) ||
             ccL.contains("low haemoglobin") || ccL.contains("low hemoglobin"):
            candidates = externalPool("anaemia") ?? anaemia
        case (ccL.contains("wound") || ccL.contains("surgical site")) &&
             (ccL.contains("infect") || ccL.contains("discharge") || ccL.contains("dehisc")) ||
             ccL.contains("cellulitis") ||
             (ccL.contains("abscess") && !ccL.contains("perianal") && !ccL.contains("pilonidal")):
            candidates = externalPool("woundInfection") ?? woundInfection
        case ccL.contains("sepsis") || ccL.contains("septic") || ccL.contains("bacteraemia") ||
             ccL.contains("sirs") || (ccL.contains("fever") && ccL.contains("shock")):
            candidates = externalPool("sepsisConditions") ?? sepsisConditions
        case ccL.contains("necrotis") || ccL.contains("fasciitis") || ccL.contains("fournier") ||
             (ccL.contains("wound") && ccL.contains("necrot")) ||
             (ccL.contains("skin") && ccL.contains("infect") && ccL.contains("severe")):
            candidates = externalPool("necrotizingInfection") ?? necrotizingInfection
        case ccL.contains("pulmonary embol") || ccL.contains("pe ") || ccL == "pe" ||
             ccL.contains("haemoptysis") || ccL.contains("hemoptysis") ||
             (ccL.contains("breathless") && ccL.contains("chest pain") && ccL.contains("leg")):
            candidates = externalPool("venousThromboEmbolism") ?? venousThromboEmbolism
        case ccL.contains("limb ischaem") || ccL.contains("acute ischaem") ||
             ccL.contains("cold leg") || ccL.contains("cold foot") || ccL.contains("cold limb") ||
             (ccL.contains("limb") && (ccL.contains("pale") || ccL.contains("pulseless"))):
            candidates = externalPool("acuteLimbIschaemia") ?? acuteLimbIschaemia
        case ccL.contains("skin") && (ccL.contains("lump") || ccL.contains("lesion") || ccL.contains("mole") || ccL.contains("growth")) ||
             ccL.contains("melanoma") || ccL.contains("bcc") || ccL.contains("scc") ||
             ccL.contains("sebaceous") || ccL.contains("lipoma") ||
             (ccL.contains("lump") && (ccL.contains("back") || ccL.contains("arm") || ccL.contains("scalp") || ccL.contains("face"))):
            candidates = externalPool("skinLesion") ?? skinLesion
        case ccL.contains("scrotum") || ccL.contains("testicular") || ccL.contains("testicle") ||
             ccL.contains("orchit") || ccL.contains("hydrocele") || ccL.contains("varicocele") ||
             ccL.contains("epididym") || (ccL.contains("scrotal") && ccL.contains("lump")):
            candidates = externalPool("scrotalTesticular") ?? scrotalTesticular
        case ccL.contains("urinary retention") || ccL.contains("unable to void") ||
             ccL.contains("acute retention") || ccL.contains("retention of urine") ||
             (ccL.contains("prostate") && !ccL.contains("cancer")) ||
             ccL.contains("bph") || ccL.contains("urethral stricture") || ccL.contains("lower urinary"):
            candidates = externalPool("urinaryRetention") ?? urinaryRetention
        case ccL.contains("rectal prolapse") || ccL.contains("prolapse") && ccL.contains("rectum") ||
             (ccL.contains("protrusion") && ccL.contains("anus")):
            candidates = externalPool("rectalProlapse") ?? rectalProlapse
        case ccL.contains("parotid") || ccL.contains("salivary") || ccL.contains("submandibular gland") ||
             ccL.contains("sublingual gland") || (ccL.contains("jaw") && ccL.contains("swelling")):
            candidates = externalPool("parotidSalivary") ?? parotidSalivary
        case ccL.contains("follow-up") || ccL.contains("follow up") ||
             (ccL.contains("follow") && ccL.contains("up")):
            candidates = externalPool("postOpReview") ?? postOpReview
        case ccL.contains("ercp") || (ccL.contains("biliary") && !ccL.contains("hernia")):
            candidates = externalPool("biliaryColic") ?? []
        case ccL.contains("endoscopy finding") || ccL.contains("scope finding") ||
             ccL.contains("colonoscopy finding") || ccL.contains("barrett") ||
             ccL.contains("polyp") || ccL.contains("varices"):
            candidates = externalPool("endoscopyFinding") ?? []
        case ccL.contains("screen"):
            candidates = externalPool("weightLoss") ?? weightLoss

        // ── General medicine pools (wide-net; added 2026-09) ────────────
        case ccL.contains("headache") || ccL.contains("migraine") ||
             ccL.contains("thunderclap") || ccL.contains("head ache"):
            candidates = externalPool("headache") ?? []
        case ccL.contains("dizzin") || ccL.contains("vertigo") ||
             ccL.contains("presyncope") || ccL.contains("pre-syncope") ||
             (ccL.contains("syncope") && !ccL.contains("vasovagal syncopal")):
            candidates = externalPool("dizzinessVertigo") ?? []
        case ccL.contains("back pain") || ccL.contains("backpain") ||
             ccL.contains("lumbar") || ccL.contains("sciatica") ||
             ccL.contains("radiculopathy") || ccL.contains("lumbago") ||
             (ccL.contains("back") && (ccL.contains("ache") || ccL.contains("pain"))):
            candidates = externalPool("backPain") ?? []
        case ccL.contains("fatigue") || ccL.contains("tired") ||
             ccL.contains("lethargy") || ccL.contains("exhaustion") ||
             ccL.contains("lack of energy") || ccL.contains("low energy"):
            candidates = externalPool("fatigue") ?? []
        case ccL.contains("cough") || ccL.contains("haemoptysis") ||
             ccL.contains("hemoptysis") || ccL.contains("coughing"):
            candidates = externalPool("cough") ?? []

        // ── Gynaecology & Obstetrics ──────────────────────────────────────
        case ccL.contains("pelvic pain") || ccL.contains("pelvi") && ccL.contains("pain"):
            candidates = externalPool("pelvicPain") ?? []
        case ccL.contains("vaginal bleed") || ccL.contains("per vaginum") ||
             ccL.contains("pvb") || ccL.contains("postcoital") ||
             ccL.contains("intermenstrual") || ccL.contains("postmenopausal bleed") ||
             (ccL.contains("bleed") && (ccL.contains("uterine") || ccL.contains("womb"))):
            candidates = externalPool("vaginalBleeding") ?? []
        case ccL.contains("amenorrh") || ccL.contains("irregular period") ||
             ccL.contains("dysmenorrh") || ccL.contains("menstrual") ||
             ccL.contains("period pain") || ccL.contains("pcos") ||
             ccL.contains("polycystic") || ccL.contains("vulv") ||
             ccL.contains("vaginal discharge") || ccL.contains("dyspareunia") ||
             ccL.contains("menopaus") || ccL.contains("gynaecolog") ||
             ccL.contains("gynecolog") || ccL.contains("fertility") ||
             ccL.contains("contraception"):
            candidates = externalPool("gynaecologyGeneral") ?? []
        case ccL.contains("pregnancy") || ccL.contains("pregnant") ||
             ccL.contains("antenatal") || ccL.contains("obstetric") ||
             ccL.contains("hyperemesis") || ccL.contains("eclampsia") ||
             ccL.contains("gestational") || ccL.contains("antepartum") ||
             ccL.contains("postpartum") || ccL.contains("postnatal"):
            candidates = externalPool("obstetricComplications") ?? []

        // ── Paediatrics ───────────────────────────────────────────────────
        case (ccL.contains("child") || ccL.contains("infant") || ccL.contains("paediatric") ||
              ccL.contains("pediatric") || ccL.contains("neonat")) &&
             (ccL.contains("fever") || ccL.contains("febrile") || ccL.contains("infection") ||
              ccL.contains("rash") || ccL.contains("ear") || ccL.contains("throat")):
            candidates = externalPool("paediatricFebrile") ?? []
        case (ccL.contains("child") || ccL.contains("infant") || ccL.contains("paediatric")) &&
             (ccL.contains("abdom") || ccL.contains("vomit") || ccL.contains("bowel") ||
              ccL.contains("gut") || ccL.contains("intussuscep") || ccL.contains("pyloric")):
            candidates = externalPool("paediatricAbdomen") ?? []
        case ccL.contains("intussuscep") || ccL.contains("pyloric stenosis") ||
             ccL.contains("meckel") || ccL.contains("failure to thrive") ||
             ccL.contains("developmental concern") || ccL.contains("growth concern") ||
             ccL.contains("paediatric") || ccL.contains("pediatric"):
            candidates = externalPool("paediatricFebrile") ?? []

        // ── Dermatology ───────────────────────────────────────────────────
        case ccL.contains("eczema") || ccL.contains("dermatitis") ||
             ccL.contains("psoriasis") || ccL.contains("urticaria") || ccL.contains("hives") ||
             ccL.contains("rash") && !ccL.contains("child") ||
             ccL.contains("tinea") || ccL.contains("ringworm") || ccL.contains("fungal skin") ||
             ccL.contains("pityriasis") || ccL.contains("pruritus") ||
             ccL.contains("itch") && !ccL.contains("anal") ||
             ccL.contains("alopecia") || ccL.contains("hair loss") ||
             ccL.contains("nail disorder") || ccL.contains("pigmentation"):
            candidates = externalPool("dermatologyRash") ?? []

        // ── Neurosurgery ──────────────────────────────────────────────────
        case ccL.contains("head injur") || ccL.contains("head trauma") ||
             ccL.contains("skull fracture") || ccL.contains("brain injur") ||
             ccL.contains("subdural") || ccL.contains("extradural") ||
             ccL.contains("intracranial") || ccL.contains("cranial") ||
             ccL.contains("hydrocephal") || ccL.contains("brain tumour") ||
             ccL.contains("brain tumor") || ccL.contains("intracranial pressure") ||
             ccL.contains("space-occupying") || ccL.contains("raised icp"):
            candidates = externalPool("neurosurgicalHead") ?? []

        // ── Cardiology (expanded) ─────────────────────────────────────────
        case ccL.contains("heart failure") || ccL.contains("cardiac failure") ||
             ccL.contains("cardiomyopathy") || ccL.contains("valvular") ||
             ccL.contains("aortic stenosis") || ccL.contains("mitral") ||
             ccL.contains("tamponade") || ccL.contains("low ejection fraction") ||
             ccL.contains("hfref") || ccL.contains("hfpef") ||
             ccL.contains("orthopnoea") || ccL.contains("orthopnea") ||
             ccL.contains("paroxysmal nocturnal dyspnoea") || ccL.contains("pnd") ||
             (ccL.contains("leg") && ccL.contains("swelling") && !ccL.contains("cellulitis")) ||
             (ccL.contains("ankle") && ccL.contains("swelling")) ||
             ccL.contains("exercise intolerance") || ccL.contains("reduced exercise"):
            candidates = externalPool("cardiacFailure") ?? []
        case ccL.contains("atrial fibrillation") || ccL.contains("af ") || ccL == "af" ||
             ccL.contains("arrhythmia") || ccL.contains("svt") ||
             ccL.contains("tachycardia") || ccL.contains("bradycardia") ||
             ccL.contains("heart block") || ccL.contains("wpw") ||
             ccL.contains("ventricular tachycard") || ccL.contains("vt ") || ccL == "vt":
            candidates = externalPool("arrhythmia") ?? []

        // ── Internal Medicine ─────────────────────────────────────────────
        case ccL.contains("ckd") || ccL.contains("chronic kidney") ||
             ccL.contains("renal disease") || ccL.contains("renal failure") ||
             ccL.contains("glomerulonephritis") || ccL.contains("nephrotic") ||
             ccL.contains("nephritis") || ccL.contains("proteinuria review") ||
             ccL.contains("aki") || ccL.contains("acute kidney"):
            candidates = externalPool("chronicKidney") ?? []
        case ccL.contains("liver disease") || ccL.contains("cirrhosis") ||
             ccL.contains("hepatitis") || ccL.contains("nafld") || ccL.contains("nash") ||
             ccL.contains("alcoholic liver") || ccL.contains("portal hypertension") ||
             ccL.contains("ascites") || ccL.contains("hepatic encephal") ||
             ccL.contains("varices") || ccL.contains("hbv") || ccL.contains("hcv"):
            candidates = externalPool("liverDisease") ?? []
        // Mental health → generalMedicine catch-all (depression, anxiety flagged in that pool)
        case ccL.contains("depression") || ccL.contains("anxiety") || ccL.contains("psychosis") ||
             ccL.contains("mental health") || ccL.contains("insomnia") ||
             ccL.contains("substance") || ccL.contains("ptsd") || ccL.contains("eating disorder"):
            candidates = externalPool("generalMedicine") ?? []

        // ── Cardiovascular / Syncope ──────────────────────────────────────
        case ccL.contains("syncope") || ccL.contains("syncopal") ||
             ccL.contains("faint") || ccL.contains("fainting") ||
             ccL.contains("blackout") || ccL.contains("black out") ||
             ccL.contains("loss of consciousness") || ccL.contains("collapse") ||
             ccL.contains("pre-syncope") || ccL.contains("presyncope"):
            candidates = externalPool("syncope") ?? []

        // ── ENT — Sore throat ─────────────────────────────────────────────
        case ccL.contains("sore throat") || ccL.contains("throat pain") ||
             ccL.contains("tonsil") || ccL.contains("tonsillit") ||
             ccL.contains("pharyngit") || ccL.contains("odynophagia") ||
             (ccL.contains("throat") && (ccL.contains("swell") || ccL.contains("infect"))):
            candidates = externalPool("soreThroat") ?? []

        // ── ENT — Epistaxis ───────────────────────────────────────────────
        case ccL.contains("epistaxis") || ccL.contains("nosebleed") ||
             ccL.contains("nose bleed") || ccL.contains("nasal bleed") ||
             ccL.contains("blood from nose"):
            candidates = externalPool("epistaxis") ?? []

        // ── ENT — Rhinosinusitis / nasal ─────────────────────────────────
        case ccL.contains("sinusitis") || ccL.contains("rhinosinusitis") ||
             ccL.contains("nasal polyp") || ccL.contains("blocked nose") ||
             ccL.contains("nasal congestion") || ccL.contains("rhinitis") ||
             ccL.contains("hay fever") || ccL.contains("allergic rhinitis") ||
             ccL.contains("post-nasal drip") || ccL.contains("postnasal drip") ||
             ccL.contains("snoring") || ccL.contains("sleep apnoea") || ccL.contains("sleep apnea") ||
             ccL.contains("osa ") || ccL == "osa" || ccL.contains("deviated septum") ||
             (ccL.contains("nasal") && (ccL.contains("block") || ccL.contains("discharge") || ccL.contains("smell"))):
            candidates = externalPool("rhinosinusitis") ?? []

        // ── ENT — Ear complaints ──────────────────────────────────────────
        case ccL.contains("ear pain") || ccL.contains("otalgia") ||
             ccL.contains("hearing loss") || ccL.contains("tinnitus") ||
             ccL.contains("ear discharge") || ccL.contains("otorrhoea") ||
             ccL.contains("ear fullness") || ccL.contains("otitis") ||
             ccL.contains("ear infect") || ccL.contains("glue ear") ||
             ccL.contains("cholesteatoma") || ccL.contains("bppv") ||
             (ccL.contains("ear") && (ccL.contains("block") || ccL.contains("fluid") || ccL.contains("wax"))):
            candidates = externalPool("earComplaint") ?? []

        // ── Oral / dental ─────────────────────────────────────────────────
        case ccL.contains("mouth ulcer") || ccL.contains("oral ulcer") ||
             ccL.contains("tongue lesion") || ccL.contains("tongue ulcer") ||
             ccL.contains("dental abscess") || ccL.contains("tooth abscess") ||
             ccL.contains("tooth pain") || ccL.contains("toothache") ||
             ccL.contains("jaw pain") || ccL.contains("tmj") ||
             ccL.contains("trismus") || ccL.contains("oral thrush") ||
             ccL.contains("mouth pain") || ccL.contains("oral lesion") ||
             (ccL.contains("mouth") && (ccL.contains("sore") || ccL.contains("bleed") || ccL.contains("white"))):
            candidates = externalPool("oralComplaint") ?? []

        // ── Ophthalmology ─────────────────────────────────────────────────
        case ccL.contains("eye pain") || ccL.contains("red eye") ||
             ccL.contains("visual loss") || ccL.contains("vision loss") ||
             ccL.contains("blurred vision") || ccL.contains("diplopia") ||
             ccL.contains("double vision") || ccL.contains("flashes") ||
             ccL.contains("floaters") || ccL.contains("photophobia") ||
             ccL.contains("eye complaint") || ccL.contains("ocular") ||
             (ccL.contains("eye") && (ccL.contains("swell") || ccL.contains("discharge") || ccL.contains("itch"))):
            candidates = externalPool("eyeComplaint") ?? []

        // ── Neurology — Seizure ───────────────────────────────────────────
        case ccL.contains("seizure") || ccL.contains("convulsion") ||
             ccL.contains("epilepsy") || ccL.contains("fit ") || ccL == "fit" ||
             ccL.contains("tonic-clonic") || ccL.contains("tonic clonic") ||
             ccL.contains("status epilepticus") || ccL.contains("postictal") ||
             (ccL.contains("jerking") && ccL.contains("uncontroll")):
            candidates = externalPool("seizure") ?? []

        // ── Leg swelling (unrouted) ───────────────────────────────────────
        case ccL.contains("leg swelling") || ccL.contains("swollen leg") ||
             ccL.contains("bilateral leg") || ccL.contains("lower limb swelling") ||
             ccL.contains("pitting oedema") || ccL.contains("pitting edema"):
            candidates = externalPool("cardiacFailure") ?? []

        // ── Penile / urethral (unrouted) ──────────────────────────────────
        case ccL.contains("penile") || ccL.contains("penis") ||
             ccL.contains("urethral discharge") || ccL.contains("phimosis") ||
             ccL.contains("paraphimosis") || ccL.contains("priapism"):
            candidates = externalPool("scrotalTesticular") ?? scrotalTesticular

        // ── Easy bruising / coagulopathy (unrouted) ───────────────────────
        case ccL.contains("easy bruising") || ccL.contains("bruising") ||
             ccL.contains("prolonged bleeding") || ccL.contains("coagulopathy") ||
             ccL.contains("thrombocytopenia") || ccL.contains("haemophilia") ||
             ccL.contains("petechiae") || ccL.contains("purpura"):
            candidates = externalPool("anaemia") ?? anaemia

        // ── Night sweats / constitutional (unrouted) ──────────────────────
        case ccL.contains("night sweat") || ccL.contains("drenching sweat") ||
             ccL.contains("constitutional symptom") ||
             (ccL.contains("sweat") && ccL.contains("night")):
            candidates = externalPool("feverInfection") ?? feverInfection

        // ── Peripheral neuropathy / numbness / tingling ───────────────────
        case ccL.contains("peripheral neuropathy") || ccL.contains("neuropathy") ||
             ccL.contains("carpal tunnel") || ccL.contains("tingling") ||
             ccL.contains("numbness") || ccL.contains("paresthesia") || ccL.contains("paraesthesia") ||
             ccL.contains("pins and needles") || ccL.contains("nerve pain") ||
             ccL.contains("numb hands") || ccL.contains("numb feet") ||
             ccL.contains("tingling hands") || ccL.contains("tingling feet") ||
             ccL.contains("ulnar neuropathy") || ccL.contains("guillain") ||
             ccL.contains("meralgia") || ccL.contains("radiculopathy"):
            candidates = externalPool("peripheralNeuropathy") ?? []

        // Tropical & infectious disease
        case ccL.contains("dengue") || ccL.contains("chikungunya") || ccL.contains("leptospirosis") ||
             ccL.contains("zika") || ccL.contains("malaria") || ccL.contains("typhoid") ||
             ccL.contains("tropical fever") || ccL.contains("travel fever") ||
             ccL.contains("returning traveller") || ccL.contains("tropical illness") ||
             (ccL.contains("fever") && (ccL.contains("travel") || ccL.contains("caribbean") ||
              ccL.contains("rash") && ccL.contains("joint"))):
            candidates = externalPool("tropicalInfections") ?? []

        // Rheumatology / inflammatory joint / connective tissue
        case ccL.contains("rheumatoid") || ccL.contains("lupus") || ccL.contains("sle") ||
             ccL.contains("ankylosing") || ccL.contains("polymyalgia") || ccL.contains("pmr") ||
             ccL.contains("giant cell arteritis") || ccL.contains("gca") ||
             ccL.contains("reactive arthritis") || ccL.contains("psoriatic arthritis") ||
             ccL.contains("vasculitis") || ccL.contains("sjogren") || ccL.contains("scleroderma") ||
             (ccL.contains("gout") && !ccL.contains("gouty")) ||
             ccL.contains("pseudogout") || ccL.contains("inflammatory arthritis") ||
             (ccL.contains("morning stiffness") && ccL.contains("joint")):
            candidates = externalPool("rheumatology") ?? []

        // Chest wall / musculoskeletal chest pain (distinct from cardiac chest pain)
        case ccL.contains("costochondritis") || ccL.contains("tietze") ||
             ccL.contains("chest wall pain") || ccL.contains("rib pain") ||
             ccL.contains("pleuritis") || ccL.contains("pleurisy") ||
             (ccL.contains("chest pain") && (ccL.contains("reproduced") || ccL.contains("palpation") ||
              ccL.contains("musculoskeletal") || ccL.contains("positional"))) ||
             (ccL.contains("shingles") && ccL.contains("chest")) ||
             (ccL.contains("pneumothorax") && !ccL.contains("tension")):
            candidates = externalPool("chestWallPain") ?? []
            if ccL.contains("chest pain") { mergePool("chestPain") }

        // Urological oncology / PSA / prostate / bladder / renal mass
        case ccL.contains("elevated psa") || ccL.contains("raised psa") || ccL.contains("high psa") ||
             ccL.contains("prostate cancer") || ccL.contains("prostate mass") ||
             ccL.contains("bladder cancer") || ccL.contains("bladder tumour") || ccL.contains("bladder tumor") ||
             ccL.contains("renal mass") || ccL.contains("renal cancer") || ccL.contains("renal cell") ||
             ccL.contains("urothelial") || ccL.contains("urothelial cancer") ||
             ccL.contains("haematuria") || ccL.contains("hematuria") ||
             ccL.contains("psa screening") || ccL.contains("prostate screening"):
            candidates = externalPool("prostateCancer") ?? []

        // Orthopaedic / trauma / musculoskeletal injury
        case ccL.contains("shoulder pain") || ccL.contains("rotator cuff") ||
             ccL.contains("acl") || ccL.contains("anterior cruciate") ||
             ccL.contains("meniscal") || ccL.contains("knee ligament") ||
             ccL.contains("hip fracture") || ccL.contains("colles") || ccL.contains("wrist fracture") ||
             ccL.contains("achilles") || ccL.contains("stress fracture") ||
             ccL.contains("carpal tunnel") ||
             (ccL.contains("knee") && (ccL.contains("injury") || ccL.contains("giving way") || ccL.contains("locking"))) ||
             (ccL.contains("shoulder") && (ccL.contains("injury") || ccL.contains("unable to lift"))) ||
             (ccL.contains("fracture") && !ccL.contains("hip fracture")):
            candidates = externalPool("orthopaedicTrauma") ?? []
            if ccL.contains("pain") { mergePool("jointPain") }

        // Mental health / psychiatric presentations
        case ccL.contains("depression") || ccL.contains("depressed") || ccL.contains("low mood") ||
             ccL.contains("anxiety") || ccL.contains("anxious") || ccL.contains("panic attack") ||
             ccL.contains("ptsd") || ccL.contains("trauma") ||
             ccL.contains("mental health") || ccL.contains("psychiatric") ||
             ccL.contains("suicidal") || ccL.contains("self-harm") || ccL.contains("self harm") ||
             ccL.contains("phq") || ccL.contains("gad-7") || ccL.contains("bipolar") ||
             ccL.contains("alcohol use") || ccL.contains("substance") ||
             ccL.contains("somatic") || ccL.contains("medically unexplained") ||
             (ccL.contains("feeling") && (ccL.contains("hopeless") || ccL.contains("worthless"))):
            candidates = externalPool("psychiatryMental") ?? []

        // Sleep disorders
        case ccL.contains("sleep apnoea") || ccL.contains("sleep apnea") ||
             ccL.contains("insomnia") || ccL.contains("restless legs") || ccL.contains("rls") ||
             ccL.contains("narcolepsy") || ccL.contains("excessive daytime sleepiness") ||
             ccL.contains("cataplexy") || ccL.contains("sleep paralysis") ||
             ccL.contains("circadian") || ccL.contains("shift work sleep") ||
             ccL.contains("rem behaviour") || ccL.contains("acting out dreams") ||
             (ccL.contains("sleep") && (ccL.contains("problem") || ccL.contains("disorder") ||
              ccL.contains("difficult") || ccL.contains("snoring"))):
            candidates = externalPool("sleepDisorders") ?? []
            if ccL.contains("snoring") || ccL.contains("apnoea") { mergePool("rhinosinusitis") }

        // Menopause / andrology / PCOS / endometriosis
        case ccL.contains("menopause") || ccL.contains("perimenopause") || ccL.contains("hot flush") ||
             ccL.contains("hot flash") || ccL.contains("night sweat") ||
             ccL.contains("premature ovarian") || ccL.contains("poi ") || ccL == "poi" ||
             ccL.contains("hrt") || ccL.contains("hormone replacement") ||
             ccL.contains("erectile dysfunction") || ccL.contains("ed ") ||
             ccL.contains("low testosterone") || ccL.contains("hypogonadism") ||
             ccL.contains("andropause") || ccL.contains("testosterone deficiency") ||
             ccL.contains("osteoporosis") || ccL.contains("osteopenia") ||
             ccL.contains("pcos") || ccL.contains("polycystic ovary") ||
             ccL.contains("endometriosis") || ccL.contains("dysmenorrhoea") || ccL.contains("dysmenorrhea") ||
             ccL.contains("genitourinary syndrome") || ccL.contains("vaginal atrophy") ||
             (ccL.contains("vaginal") && ccL.contains("dryness")):
            candidates = externalPool("menopauseAndrology") ?? []
            if ccL.contains("pelvic pain") || ccL.contains("dysmenorrhoea") { mergePool("pelvicPain") }

        // Haematological malignancy / lymphoma / leukaemia / myeloma
        case ccL.contains("lymphoma") || ccL.contains("hodgkin") || ccL.contains("non-hodgkin") ||
             ccL.contains("leukaemia") || ccL.contains("leukemia") || ccL.contains("aml") ||
             ccL.contains("cll") || ccL.contains("cml") || ccL.contains("myeloma") ||
             ccL.contains("multiple myeloma") || ccL.contains("paraprotein") ||
             ccL.contains("mds") || ccL.contains("myelodysplastic") || ccL.contains("mgus") ||
             ccL.contains("b-symptoms") || ccL.contains("b symptoms") ||
             ccL.contains("bone marrow") || ccL.contains("blast") ||
             (ccL.contains("night sweats") && ccL.contains("lymph")) ||
             (ccL.contains("drenching") && ccL.contains("sweat")) ||
             (ccL.contains("painless") && ccL.contains("lymph node")):
            candidates = externalPool("haematologicalMalignancy") ?? []
            if ccL.contains("anaemia") || ccL.contains("anemia") { mergePool("anaemia") }

        // Geriatric syndromes / frailty / delirium / dementia / falls
        case ccL.contains("frailty") || ccL.contains("frail") ||
             ccL.contains("delirium") || ccL.contains("acute confusion") ||
             ccL.contains("dementia") || ccL.contains("memory loss") || ccL.contains("memory problem") ||
             ccL.contains("alzheimer") || ccL.contains("cognitive decline") ||
             ccL.contains("recurrent falls") || ccL.contains("frequent falls") ||
             ccL.contains("parkinson") || ccL.contains("resting tremor") ||
             ccL.contains("elder abuse") || ccL.contains("polypharmacy") ||
             ccL.contains("sarcopenia") || ccL.contains("muscle wasting") ||
             (ccL.contains("falls") && ccL.contains("elderly")) ||
             (ccL.contains("confusion") && ccL.contains("older")):
            candidates = externalPool("geriatricSyndrome") ?? []
            if ccL.contains("memory") || ccL.contains("cognitive") { mergePool("neurosurgicalHead") }

        // Nutritional / vitamin deficiency / malnutrition
        case ccL.contains("vitamin deficiency") || ccL.contains("b12 deficiency") ||
             ccL.contains("vitamin b12") || ccL.contains("folate deficiency") ||
             ccL.contains("vitamin d deficiency") || ccL.contains("low vitamin d") ||
             ccL.contains("iron deficiency") || ccL.contains("malnutrition") ||
             ccL.contains("wernicke") || ccL.contains("thiamine") ||
             ccL.contains("magnesium deficiency") || ccL.contains("zinc deficiency") ||
             ccL.contains("nutritional") || ccL.contains("micronutrient") ||
             ccL.contains("deficiency anaemia") ||
             (ccL.contains("pernicious") && ccL.contains("anaemia")):
            candidates = externalPool("nutritionDeficiency") ?? []
            if ccL.contains("anaemia") || ccL.contains("anemia") { mergePool("anaemia") }
            if ccL.contains("numb") || ccL.contains("tingling") { mergePool("peripheralNeuropathy") }

        // Fibromyalgia / chronic pain / CFS / CRPS / hypermobility
        case ccL.contains("fibromyalgia") || ccL.contains("fibromyalgia") ||
             ccL.contains("crps") || ccL.contains("complex regional pain") ||
             ccL.contains("chronic fatigue") || ccL.contains("cfs") || ccL.contains("me/cfs") ||
             ccL.contains("myalgic encephalomyelitis") ||
             ccL.contains("hypermobility") || ccL.contains("ehlers-danlos") || ccL.contains("heds") ||
             ccL.contains("central sensitisation") || ccL.contains("central sensitization") ||
             ccL.contains("tmj") || ccL.contains("temporomandibular") ||
             ccL.contains("myofascial") || ccL.contains("trigger point") ||
             ccL.contains("chronic widespread pain") ||
             (ccL.contains("chronic") && ccL.contains("pain") &&
              (ccL.contains("no cause") || ccL.contains("unexplained") || ccL.contains("functional"))):
            candidates = externalPool("fibromyalgiaChronic") ?? []
            if ccL.contains("depression") || ccL.contains("anxiety") { mergePool("psychiatryMental") }
            if ccL.contains("sleep") { mergePool("sleepDisorders") }

        // Allergy / immunology / anaphylaxis / urticaria / drug allergy
        case ccL.contains("anaphylaxis") || ccL.contains("anaphylactic") ||
             ccL.contains("urticaria") || ccL.contains("hives") || ccL.contains("angioedema") ||
             ccL.contains("drug allergy") || ccL.contains("penicillin allergy") ||
             ccL.contains("drug reaction") || ccL.contains("food allergy") ||
             ccL.contains("nut allergy") || ccL.contains("shellfish allergy") ||
             ccL.contains("hay fever") || ccL.contains("allergic rhinitis") ||
             ccL.contains("hereditary angioedema") || ccL.contains("hae") ||
             ccL.contains("mcas") || ccL.contains("mast cell") ||
             ccL.contains("eosinophilic oesophagitis") || ccL.contains("eoe") ||
             ccL.contains("allergy review") || ccL.contains("allergic") ||
             (ccL.contains("swelling") && (ccL.contains("lip") || ccL.contains("tongue") ||
              ccL.contains("throat"))) ||
             (ccL.contains("reaction") && ccL.contains("food")):
            candidates = externalPool("allergyImmunology") ?? []
            if ccL.contains("throat") || ccL.contains("dysphagia") { mergePool("dysphagia") }

        // Metabolic syndrome / obesity / diabetes / dyslipidaemia / NAFLD
        case ccL.contains("metabolic syndrome") || ccL.contains("obesity review") ||
             ccL.contains("weight management") || ccL.contains("bariatric") ||
             ccL.contains("morbid obesity") || ccL.contains("fatty liver") ||
             ccL.contains("nafld") || ccL.contains("nash") ||
             ccL.contains("dyslipidaemia") || ccL.contains("dyslipidemia") ||
             ccL.contains("high cholesterol") || ccL.contains("hypercholesterolaemia") ||
             ccL.contains("cholesterol review") || ccL.contains("lipids review") ||
             ccL.contains("prediabetes") || ccL.contains("impaired fasting") ||
             ccL.contains("insulin resistance") || ccL.contains("hyperuricaemia") ||
             ccL.contains("hyperuricemia") || ccL.contains("gout review") ||
             ccL.contains("cushing") ||
             (ccL.contains("bmi") && ccL.contains("high")) ||
             (ccL.contains("diabetes") && (ccL.contains("type 2") || ccL.contains("t2"))):
            candidates = externalPool("metabolicSyndrome") ?? []
            if ccL.contains("liver") || ccL.contains("fatty") { mergePool("liverDisease") }
            if ccL.contains("gout") || ccL.contains("joint") { mergePool("jointPain") }

        // Oncology complications / CUP / paraneoplastic / cancer complication
        case ccL.contains("cancer complication") || ccL.contains("unknown primary") ||
             ccL.contains("cup ") || ccL == "cup" ||
             ccL.contains("paraneoplastic") || ccL.contains("cancer cachexia") ||
             ccL.contains("tumour lysis") || ccL.contains("tumor lysis") ||
             ccL.contains("tls ") || ccL.contains("hypercalcaemia of malignancy") ||
             ccL.contains("hypercalcemia of malignancy") || ccL.contains("bone metastases") ||
             ccL.contains("bone mets") || ccL.contains("spinal cord compression") ||
             ccL.contains("svc obstruction") || ccL.contains("superior vena cava") ||
             (ccL.contains("metastatic") && ccL.contains("unknown")) ||
             (ccL.contains("oncology") && (ccL.contains("complication") || ccL.contains("review"))):
            candidates = externalPool("oncologyComplications") ?? []
            if ccL.contains("lymphoma") || ccL.contains("myeloma") { mergePool("haematologicalMalignancy") }
            if ccL.contains("back pain") || ccL.contains("spine") { mergePool("backPain") }

        // Sports medicine / athletic injury / exercise-related condition
        case ccL.contains("sports injury") || ccL.contains("athletic injury") ||
             ccL.contains("tennis elbow") || ccL.contains("lateral epicondylitis") ||
             ccL.contains("exertional") || ccL.contains("exercise-induced") ||
             ccL.contains("rhabdomyolysis") || ccL.contains("heat stroke") ||
             ccL.contains("heat exhaustion") || ccL.contains("exertional heat") ||
             ccL.contains("concussion") || ccL.contains("head injury sport") ||
             ccL.contains("acl tear") || ccL.contains("cruciate ligament") ||
             ccL.contains("stress fracture") || ccL.contains("compartment syndrome") ||
             ccL.contains("overuse injury") || ccL.contains("sports medicine") ||
             ccL.contains("return to sport") || ccL.contains("pre-participation") ||
             (ccL.contains("injury") && (ccL.contains("sport") || ccL.contains("training") ||
              ccL.contains("running") || ccL.contains("football") || ccL.contains("cricket"))):
            candidates = externalPool("sportsMedicine") ?? []
            if ccL.contains("shoulder") { mergePool("orthopaedicTrauma") }
            if ccL.contains("knee") || ccL.contains("fracture") { mergePool("orthopaedicTrauma") }

        // HIV / STIs / sexual health
        case ccL.contains("hiv") || ccL.contains("aids") ||
             ccL.contains("sexually transmitted") || ccL.contains("sti ") || ccL == "sti" ||
             ccL.contains("sexual health") || ccL.contains("syphilis") ||
             ccL.contains("gonorrhoea") || ccL.contains("gonorrhea") ||
             ccL.contains("chlamydia") || ccL.contains("pelvic inflammatory") ||
             ccL.contains("pid ") || ccL == "pid" ||
             ccL.contains("genital herpes") || ccL.contains("hsv genital") ||
             ccL.contains("hepatitis b") || ccL.contains("hbv") ||
             ccL.contains("genital warts") || ccL.contains("condyloma") || ccL.contains("hpv") ||
             ccL.contains("anogenital") || ccL.contains("post-exposure prophylaxis") ||
             ccL.contains("prep") || ccL.contains("pep ") ||
             (ccL.contains("discharge") && (ccL.contains("genital") || ccL.contains("urethral") ||
              ccL.contains("penile") || ccL.contains("vaginal"))) ||
             (ccL.contains("ulcer") && (ccL.contains("genital") || ccL.contains("penile") ||
              ccL.contains("vulval"))):
            candidates = externalPool("hivAidsSTI") ?? []
            if ccL.contains("pelvic") || ccL.contains("abdominal") { mergePool("pelvicPain") }

        // Diabetic foot / neuropathic foot / foot ulcer
        case ccL.contains("diabetic foot") || ccL.contains("foot ulcer") ||
             ccL.contains("neuropathic ulcer") || ccL.contains("charcot foot") ||
             ccL.contains("charcot joint") || ccL.contains("diabetic osteomyelitis") ||
             ccL.contains("foot osteomyelitis") || ccL.contains("foot cellulitis") ||
             ccL.contains("rocker bottom") || ccL.contains("tinea pedis") ||
             ccL.contains("fungal foot") || ccL.contains("foot amputation") ||
             ccL.contains("limb salvage") || ccL.contains("wagner grade") ||
             (ccL.contains("foot") && ccL.contains("diabetes")) ||
             (ccL.contains("foot") && (ccL.contains("swollen") || ccL.contains("infected") ||
              ccL.contains("ulcer") || ccL.contains("wound"))):
            candidates = externalPool("diabeticFoot") ?? []
            if ccL.contains("ischaemia") || ccL.contains("arterial") { mergePool("vascularSurgical") }
            if ccL.contains("osteomyelitis") { mergePool("necrotizingInfection") }

        // Toxicology / overdose / poisoning
        case ccL.contains("overdose") || ccL.contains("poisoning") ||
             ccL.contains("paracetamol overdose") || ccL.contains("acetaminophen overdose") ||
             ccL.contains("opioid overdose") || ccL.contains("naloxone") ||
             ccL.contains("carbon monoxide") || ccL.contains("co poisoning") ||
             ccL.contains("organophosphate") || ccL.contains("pesticide poison") ||
             ccL.contains("digoxin toxic") || ccL.contains("digibind") ||
             ccL.contains("tricyclic overdose") || ccL.contains("tca overdose") ||
             ccL.contains("benzodiazepine overdose") || ccL.contains("sedative overdose") ||
             ccL.contains("alcohol poisoning") || ccL.contains("toxidrome") ||
             ccL.contains("drug overdose") || ccL.contains("intentional ingestion") ||
             (ccL.contains("ingestion") && (ccL.contains("toxic") || ccL.contains("accidental"))):
            candidates = externalPool("toxicologyOverdose") ?? []
            if ccL.contains("paracetamol") || ccL.contains("liver") { mergePool("liverDisease") }
            if ccL.contains("cardiac") || ccL.contains("arrhythmia") { mergePool("arrhythmia") }

        // Palliative care / end of life / symptom management in advanced illness
        case ccL.contains("palliative") || ccL.contains("end of life") || ccL.contains("eol ") ||
             ccL.contains("terminal") || ccL.contains("dying") || ccL.contains("hospice") ||
             ccL.contains("goals of care") || ccL.contains("dnacpr") || ccL.contains("dnr") ||
             ccL.contains("advance care plan") || ccL.contains("acp ") ||
             ccL.contains("syringe driver") || ccL.contains("csci") ||
             ccL.contains("opioid rotation") || ccL.contains("opioid conversion") ||
             ccL.contains("malignant bowel obstruction") ||
             ccL.contains("lymphoedema") || ccL.contains("lymphedema") ||
             ccL.contains("pressure ulcer") || ccL.contains("pressure sore") ||
             ccL.contains("kennedy ulcer") ||
             (ccL.contains("cancer pain") && ccL.contains("uncontrolled")) ||
             (ccL.contains("breathless") && ccL.contains("terminal")) ||
             (ccL.contains("agitation") && ccL.contains("dying")):
            candidates = externalPool("palliativeCare") ?? []
            if ccL.contains("pain") { mergePool("weightLoss") }
            if ccL.contains("bowel") { mergePool("smallBowelObstruction") }

        // Haemoglobinopathies — sickle cell disease, G6PD, thalassaemia, HTLV-1 (Caribbean-endemic)
        case ccL.contains("sickle cell") || ccL.contains("sickle") || ccL.contains("hbss") ||
             ccL.contains("hbsc") || ccL.contains("vaso-occlusive") || ccL.contains("vaso occlusive") ||
             ccL.contains("g6pd") || ccL.contains("thalassaemia") || ccL.contains("thalassemia") ||
             ccL.contains("spherocytosis") || ccL.contains("haemoglobinopathy") ||
             ccL.contains("hemoglobinopathy") || ccL.contains("htlv") || ccL.contains("htlv-1") ||
             ccL.contains("aplastic crisis") || ccL.contains("acute chest syndrome") ||
             ccL.contains("parvovirus") || ccL.contains("haemolytic crisis") ||
             ccL.contains("hemolytic crisis") || ccL.contains("exchange transfusion") ||
             (ccL.contains("caribbean") && ccL.contains("anaemia")):
            candidates = externalPool("haemoglobinopathy") ?? []
            if ccL.contains("stroke") || ccL.contains("neurological") { mergePool("neurosurgicalHead") }
            if ccL.contains("chest") || ccL.contains("respiratory") { mergePool("cough") }

        // Coagulation disorders — haemophilia, vWD, ITP, TTP, APS, DIC, HIT, HUS
        case ccL.contains("haemophilia") || ccL.contains("hemophilia") ||
             ccL.contains("von willebrand") || ccL.contains("vwd") ||
             ccL.contains("thrombocytopenia") || ccL.contains("itp") ||
             ccL.contains("ttp") || ccL.contains("thrombotic thrombocytopenic") ||
             ccL.contains("antiphospholipid") || ccL.contains("aps ") ||
             ccL.contains("dic ") || ccL.contains("disseminated intravascular") ||
             ccL.contains("hit ") || ccL.contains("heparin induced") ||
             ccL.contains("hus ") || ccL.contains("haemolytic uraemic") ||
             ccL.contains("hemolytic uremic") || ccL.contains("coagulopathy") ||
             ccL.contains("bleeding disorder") || ccL.contains("clotting disorder") ||
             ccL.contains("factor deficiency") || ccL.contains("lupus anticoagulant") ||
             (ccL.contains("spontaneous") && ccL.contains("bleeding")) ||
             (ccL.contains("platelet") && ccL.contains("fall")):
            candidates = externalPool("coagulationDisorder") ?? []
            if ccL.contains("kidney") || ccL.contains("renal") || ccL.contains("aki") { mergePool("acuteKidneyInjury") }
            if ccL.contains("liver") { mergePool("liverDisease") }

        // Occupational medicine — mesothelioma, asbestosis, occupational asthma, HAVS, silicosis
        case ccL.contains("occupational") || ccL.contains("mesothelioma") ||
             ccL.contains("asbestosis") || ccL.contains("asbestos") ||
             ccL.contains("silicosis") || ccL.contains("silica dust") ||
             ccL.contains("havs") || ccL.contains("hand arm vibration") ||
             ccL.contains("vibration white finger") ||
             ccL.contains("wruld") || ccL.contains("work related upper limb") ||
             ccL.contains("noise induced") || ccL.contains("industrial deafness") ||
             ccL.contains("occupational asthma") || ccL.contains("occupational dermatitis") ||
             ccL.contains("eggshell calcification") || ccL.contains("progressive massive fibrosis") ||
             (ccL.contains("asthma") && ccL.contains("work")) ||
             (ccL.contains("hearing loss") && ccL.contains("noise")) ||
             (ccL.contains("chest") && ccL.contains("asbestos")):
            candidates = externalPool("occupationalMedicine") ?? []
            if ccL.contains("lung") || ccL.contains("respiratory") || ccL.contains("pleural") { mergePool("cough") }
            if ccL.contains("skin") || ccL.contains("dermatitis") { mergePool("skinRash") }

        // Pre-operative assessment — cardiac risk, anaemia, anticoagulation, frailty, diabetes, nutrition
        case ccL.contains("preoperative") || ccL.contains("pre-operative") ||
             ccL.contains("pre operative") || ccL.contains("pre-op") || ccL.contains("preop ") ||
             ccL.contains("rcri") || ccL.contains("cardiac risk surgery") ||
             ccL.contains("fitness for surgery") || ccL.contains("fitness for anaesthesia") ||
             ccL.contains("anaesthetic assessment") || ccL.contains("anesthetic assessment") ||
             ccL.contains("perioperative") || ccL.contains("peri-operative") ||
             ccL.contains("surgical clearance") || ccL.contains("surgical fitness") ||
             ccL.contains("pre-op assessment") || ccL.contains("preoperative assessment") ||
             ccL.contains("prehabilitation") || ccL.contains("eras ") ||
             (ccL.contains("before surgery") && ccL.contains("risk")) ||
             (ccL.contains("surgery") && ccL.contains("assessment")):
            candidates = externalPool("preoperativeAssessment") ?? []
            if ccL.contains("cardiac") || ccL.contains("heart") { mergePool("heartFailure") }
            if ccL.contains("anaemia") || ccL.contains("anemia") { mergePool("anaemia") }

        // Paediatric surgical emergencies
        case ccL.contains("intussusception") || ccL.contains("pyloric stenosis") ||
             ccL.contains("meckel") || ccL.contains("hirschsprung") ||
             ccL.contains("necrotising enterocolitis") || ccL.contains("nec ") ||
             ccL.contains("malrotation") || ccL.contains("midgut volvulus") ||
             ccL.contains("bilious vomiting neonate") ||
             ccL.contains("paediatric hernia") || ccL.contains("pediatric hernia") ||
             (ccL.contains("child") && ccL.contains("obstruction")) ||
             (ccL.contains("neonate") && ccL.contains("vomiting")) ||
             (ccL.contains("infant") && ccL.contains("bowel")):
            candidates = externalPool("paediatricSurgical") ?? []
            if ccL.contains("obstruction") { mergePool("smallBowelObstruction") }
            if ccL.contains("hernia") { mergePool("groinSwelling") }

        // Breast pathology
        case ccL.contains("breast lump") || ccL.contains("breast mass") ||
             ccL.contains("breast pain") || ccL.contains("breast cancer") ||
             ccL.contains("mastitis") || ccL.contains("breast abscess") ||
             ccL.contains("nipple discharge") || ccL.contains("nipple change") ||
             ccL.contains("dcis") || ccL.contains("fibroadenoma") ||
             ccL.contains("phyllodes") || ccL.contains("paget nipple") ||
             ccL.contains("peau dorange") || ccL.contains("mammogram") ||
             (ccL.contains("breast") && (ccL.contains("swelling") || ccL.contains("change") || ccL.contains("discharge"))):
            candidates = externalPool("breastDisease") ?? []
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("oncologyComplications") }
            if ccL.contains("abscess") || ccL.contains("infection") { mergePool("skinRash") }

        // Acute obstetric / gynaecological emergencies
        case ccL.contains("ectopic pregnancy") || ccL.contains("ovarian torsion") ||
             ccL.contains("hellp") || ccL.contains("pre-eclampsia") ||
             ccL.contains("preeclampsia") || ccL.contains("eclampsia") ||
             ccL.contains("placental abruption") || ccL.contains("abruption") ||
             ccL.contains("ovarian cancer") || ccL.contains("endometriosis") ||
             ccL.contains("gestational trophoblastic") || ccL.contains("molar pregnancy") ||
             ccL.contains("gynaecological") || ccL.contains("gynecological") ||
             (ccL.contains("pregnancy") && (ccL.contains("pain") || ccL.contains("bleeding") || ccL.contains("haemorrhage"))):
            candidates = externalPool("acuteObstetricGynae") ?? []
            if ccL.contains("pelvic") { mergePool("pelvicPain") }
            if ccL.contains("bleeding") || ccL.contains("haemorrhage") { mergePool("coagulationDisorder") }

        // Head and neck surgical conditions
        case ccL.contains("thyroid nodule") || ccL.contains("thyroid cancer") ||
             ccL.contains("parathyroid") || ccL.contains("parotid") ||
             ccL.contains("salivary gland") || ccL.contains("sialolithiasis") ||
             ccL.contains("thyroglossal") || ccL.contains("deep neck infection") ||
             ccL.contains("neck abscess") || ccL.contains("neck cancer") ||
             ccL.contains("head neck scc") || ccL.contains("lemierre") ||
             ccL.contains("hypercalcaemia") || ccL.contains("hypercalcemia") ||
             (ccL.contains("neck") && (ccL.contains("mass") || ccL.contains("swelling") || ccL.contains("lump"))) ||
             (ccL.contains("neck") && ccL.contains("abscess")):
            candidates = externalPool("headNeckSurgical") ?? []
            if ccL.contains("lymph") || ccL.contains("lymphoma") { mergePool("haematologicalMalignancy") }
            if ccL.contains("airway") || ccL.contains("swallow") { mergePool("dysphagia") }

        // Tropical and endemic infectious diseases
        case ccL.contains("dengue") || ccL.contains("leptospirosis") ||
             ccL.contains("malaria") || ccL.contains("chikungunya") ||
             ccL.contains("zika") || ccL.contains("typhoid") ||
             ccL.contains("yellow fever") || ccL.contains("leishmaniasis") ||
             ccL.contains("weil disease") || ccL.contains("weil's disease") ||
             ccL.contains("kala-azar") || ccL.contains("kala azar") ||
             ccL.contains("breakbone") || ccL.contains("conjunctival suffusion") ||
             ccL.contains("retro-orbital") || ccL.contains("retroorbital") ||
             (ccL.contains("caribbean") && ccL.contains("fever")) ||
             (ccL.contains("tropical") && ccL.contains("fever")) ||
             (ccL.contains("travel") && ccL.contains("fever") && ccL.contains("rash")):
            candidates = externalPool("tropicalInfectious") ?? []
            if ccL.contains("bleeding") || ccL.contains("haemorrhagic") { mergePool("coagulationDisorder") }
            if ccL.contains("jaundice") || ccL.contains("liver") { mergePool("liverDisease") }

        // Peripheral vascular disease
        case ccL.contains("claudication") || ccL.contains("peripheral arterial") ||
             ccL.contains("pad ") || ccL.contains("limb ischaemia") ||
             ccL.contains("limb ischemia") || ccL.contains("acute limb") ||
             ccL.contains("aortic aneurysm") || ccL.contains("aaa ") ||
             ccL.contains("carotid stenosis") || ccL.contains("mesenteric ischaemia") ||
             ccL.contains("mesenteric ischemia") || ccL.contains("thoracic outlet") ||
             ccL.contains("venous insufficiency") || ccL.contains("varicose vein") ||
             ccL.contains("ankle brachial") || ccL.contains("abi ") ||
             (ccL.contains("leg") && ccL.contains("ischaemia")) ||
             (ccL.contains("absent") && ccL.contains("pulse")) ||
             (ccL.contains("pulsatile") && ccL.contains("mass")):
            candidates = externalPool("peripheralVascular") ?? []
            if ccL.contains("dvt") || ccL.contains("thrombosis") { mergePool("pulmonaryEmbolism") }
            if ccL.contains("stroke") || ccL.contains("tia") { mergePool("neurosurgicalHead") }

        // Spinal and back conditions
        case ccL.contains("cauda equina") || ccL.contains("spinal cord compression") ||
             ccL.contains("epidural abscess") || ccL.contains("disc herniation") ||
             ccL.contains("disc prolapse") || ccL.contains("sciatica") ||
             ccL.contains("spondylolisthesis") || ccL.contains("ankylosing spondylitis") ||
             ccL.contains("spinal stenosis") || ccL.contains("vertebral fracture") ||
             ccL.contains("saddle anaesthesia") || ccL.contains("saddle anesthesia") ||
             ccL.contains("neurogenic claudication") || ccL.contains("bamboo spine") ||
             ccL.contains("sacroiliitis") || ccL.contains("pars defect") ||
             (ccL.contains("back pain") && ccL.contains("leg weakness")) ||
             (ccL.contains("back pain") && ccL.contains("urinary retention")) ||
             (ccL.contains("back pain") && ccL.contains("fever") && ccL.contains("neurological")):
            candidates = externalPool("spinalEmergency") ?? []
            if ccL.contains("cancer") || ccL.contains("malignancy") { mergePool("oncologyComplications") }
            if ccL.contains("infection") || ccL.contains("abscess") { mergePool("bacteraemia") }

        // Necrotising soft tissue infections and complex wounds
        case ccL.contains("necrotising fasciitis") || ccL.contains("necrotizing fasciitis") ||
             ccL.contains("fournier") || ccL.contains("gas gangrene") ||
             ccL.contains("clostridial myonecrosis") || ccL.contains("pyomyositis") ||
             ccL.contains("ludwig") || ccL.contains("descending mediastinitis") ||
             ccL.contains("necrotising mediastinitis") || ccL.contains("fascial necrosis") ||
             ccL.contains("lrinec") || ccL.contains("wound dehiscence") ||
             ccL.contains("burst abdomen") || ccL.contains("lymphoedema") ||
             ccL.contains("lymphedema") || ccL.contains("subcutaneous gas") ||
             (ccL.contains("wound") && ccL.contains("spreading")) ||
             (ccL.contains("crepitus") && (ccL.contains("wound") || ccL.contains("soft tissue") || ccL.contains("perineum"))):
            candidates = externalPool("necroSoftTissue") ?? []
            if ccL.contains("septic") || ccL.contains("bacteraemia") { mergePool("bacteraemia") }
            if ccL.contains("diabetes") { mergePool("diabeticFoot") }

        // Anorectal and benign colorectal conditions
        case ccL.contains("haemorrhoid") || ccL.contains("hemorrhoid") ||
             ccL.contains("anal fissure") || ccL.contains("perianal abscess") ||
             ccL.contains("anal fistula") || ccL.contains("fistula in ano") ||
             ccL.contains("pilonidal") || ccL.contains("rectal prolapse") ||
             ccL.contains("pruritus ani") || ccL.contains("anal cancer") ||
             ccL.contains("anal carcinoma") || ccL.contains("perianal") ||
             ccL.contains("anorectal") ||
             (ccL.contains("anal") && (ccL.contains("pain") || ccL.contains("bleeding") || ccL.contains("discharge"))) ||
             (ccL.contains("rectal") && ccL.contains("prolapse")):
            candidates = externalPool("anorectaColonBenign") ?? []
            if ccL.contains("crohn") || ccL.contains("ibd") { mergePool("inflammatoryBowel") }
            if ccL.contains("cancer") || ccL.contains("carcinoma") { mergePool("oncologyComplications") }

        // Urological surgical conditions
        case ccL.contains("testicular torsion") || ccL.contains("torsion testis") ||
             ccL.contains("epididymo-orchitis") || ccL.contains("epididymitis") ||
             ccL.contains("orchitis") || ccL.contains("bladder cancer") ||
             ccL.contains("renal cell") || ccL.contains("prostate cancer") ||
             ccL.contains("urethral stricture") || ccL.contains("hydrocele") ||
             ccL.contains("varicocele") || ccL.contains("bph") ||
             ccL.contains("benign prostatic") || ccL.contains("urinary retention") ||
             ccL.contains("haematuria") || ccL.contains("hematuria") ||
             ccL.contains("scrotal swelling") || ccL.contains("testicular pain") ||
             (ccL.contains("psa") && ccL.contains("elevated")) ||
             (ccL.contains("prostate") && ccL.contains("enlarged")):
            candidates = externalPool("urologicalSurgical") ?? []
            if ccL.contains("cancer") { mergePool("oncologyComplications") }
            if ccL.contains("infection") || ccL.contains("uti") { mergePool("urinaryTractInfection") }

        // Inflammatory bowel disease and related enteropathies
        case ccL.contains("crohn") || ccL.contains("ulcerative colitis") ||
             ccL.contains("inflammatory bowel") || ccL.contains("ibd ") ||
             ccL.contains("coeliac") || ccL.contains("celiac") ||
             ccL.contains("microscopic colitis") || ccL.contains("radiation enteritis") ||
             ccL.contains("radiation proctitis") || ccL.contains("nsaid enteropathy") ||
             ccL.contains("calprotectin") || ccL.contains("villous atrophy") ||
             ccL.contains("intestinal tb") || ccL.contains("bowel tb") ||
             (ccL.contains("bloody diarrhoea") && ccL.contains("mucus")) ||
             (ccL.contains("diarrhoea") && ccL.contains("weight loss") && ccL.contains("young")):
            candidates = externalPool("inflammatoryBowel") ?? []
            if ccL.contains("perianal") { mergePool("anorectaColonBenign") }
            if ccL.contains("cancer") || ccL.contains("dysplasia") { mergePool("oncologyComplications") }

        // Hepatobiliary malignancy and liver surgical conditions
        case ccL.contains("hepatocellular") || ccL.contains("hcc") ||
             ccL.contains("cholangiocarcinoma") || ccL.contains("klatskin") ||
             ccL.contains("gallbladder cancer") || ccL.contains("gallbladder carcinoma") ||
             ccL.contains("liver metastases") || ccL.contains("hepatic metastases") ||
             ccL.contains("liver cancer") || ccL.contains("hepatic abscess") ||
             ccL.contains("hydatid") || ccL.contains("echinococcus") ||
             ccL.contains("portal hypertension") || ccL.contains("oesophageal varices") ||
             ccL.contains("esophageal varices") || ccL.contains("periampullary") ||
             ccL.contains("bile duct cancer") || ccL.contains("biliary stricture") ||
             (ccL.contains("cirrhosis") && ccL.contains("mass")) ||
             (ccL.contains("afp") && ccL.contains("elevated")) ||
             (ccL.contains("ca19-9") && ccL.contains("elevated")):
            candidates = externalPool("hepatobiliaryMalignancy") ?? []
            if ccL.contains("cancer") || ccL.contains("metastases") { mergePool("oncologyComplications") }
            if ccL.contains("jaundice") { mergePool("jaundice") }

        // Pancreatic surgical conditions
        case ccL.contains("pancreatic cancer") || ccL.contains("pancreatic adenocarcinoma") ||
             ccL.contains("ipmn") || ccL.contains("pancreatic cyst") ||
             ccL.contains("insulinoma") || ccL.contains("gastrinoma") ||
             ccL.contains("zollinger") || ccL.contains("pancreatic net") ||
             ccL.contains("pancreatic neuroendocrine") || ccL.contains("pseudocyst") ||
             ccL.contains("chronic pancreatitis") || ccL.contains("tropical pancreatitis") ||
             ccL.contains("pancreatic duct") || ccL.contains("pancreatic head") ||
             ccL.contains("whipple") ||
             (ccL.contains("fasting") && ccL.contains("hypoglycaemia")) ||
             (ccL.contains("double duct") || ccL.contains("chain of lakes")):
            candidates = externalPool("pancreaticSurgical") ?? []
            if ccL.contains("jaundice") { mergePool("hepatobiliaryMalignancy") }
            if ccL.contains("cancer") { mergePool("oncologyComplications") }

        // Oesophagogastric surgical conditions
        case ccL.contains("oesophageal cancer") || ccL.contains("esophageal cancer") ||
             ccL.contains("gastric cancer") || ccL.contains("stomach cancer") ||
             ccL.contains("boerhaave") || ccL.contains("oesophageal perforation") ||
             ccL.contains("achalasia") || ccL.contains("gastric outlet obstruction") ||
             ccL.contains("mallory-weiss") || ccL.contains("mallory weiss") ||
             ccL.contains("barrett") ||
             ccL.contains("peptic ulcer perforation") || ccL.contains("perforated ulcer") ||
             ccL.contains("pneumomediastinum") || ccL.contains("subcutaneous emphysema") ||
             ccL.contains("virchow") || ccL.contains("krukenberg") ||
             (ccL.contains("dysphagia") && (ccL.contains("cancer") || ccL.contains("weight loss") || ccL.contains("progressive"))) ||
             (ccL.contains("vomiting") && ccL.contains("haematemesis") && ccL.contains("retching")):
            candidates = externalPool("oesophagogastricSurgical") ?? []
            if ccL.contains("cancer") { mergePool("oncologyComplications") }
            if ccL.contains("perforation") || ccL.contains("peritonitis") { mergePool("sepsisConditions") }

        // Thoracic surgical conditions
        case ccL.contains("pneumothorax") || ccL.contains("tension pneumothorax") ||
             ccL.contains("empyema") || ccL.contains("lung cancer") ||
             ccL.contains("mesothelioma") || ccL.contains("mediastinal mass") ||
             ccL.contains("malignant pleural effusion") || ccL.contains("diaphragmatic hernia") ||
             ccL.contains("diaphragmatic rupture") || ccL.contains("pancoast") ||
             ccL.contains("svc syndrome") || ccL.contains("thymoma") ||
             ccL.contains("haemothorax") || ccL.contains("chylothorax") ||
             ccL.contains("pleural mesothelioma") || ccL.contains("pleural biopsy") ||
             ccL.contains("trapped lung") || ccL.contains("pleurodesis") ||
             (ccL.contains("collapsed lung") || ccL.contains("lung collapse")) ||
             (ccL.contains("absent breath sounds") && ccL.contains("chest pain")) ||
             (ccL.contains("bowel sounds") && ccL.contains("chest")):
            candidates = externalPool("thoracicSurgical") ?? []
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("oncologyComplications") }
            if ccL.contains("infection") || ccL.contains("empyema") { mergePool("sepsisConditions") }

        // Colorectal malignancy and CRC surveillance
        case ccL.contains("colon cancer") || ccL.contains("colorectal cancer") ||
             ccL.contains("rectal cancer") || ccL.contains("pseudomyxoma") ||
             ccL.contains("lynch syndrome") || ccL.contains("hnpcc") ||
             ccL.contains("colonic polyp") || ccL.contains("anal scc") ||
             ccL.contains("fit positive") ||
             (ccL.contains("colonoscopy") && ccL.contains("mass")) ||
             (ccL.contains("rectal bleeding") && ccL.contains("weight loss")):
            candidates = externalPool("colorectalMalignancy") ?? []
            if ccL.contains("peritoneal") { mergePool("oncologyComplications") }
            if ccL.contains("lynch") || ccL.contains("hnpcc") { mergePool("geneticsSyndromic") }

        // Endocrine surgical — thyroid and parathyroid
        case ccL.contains("thyroid cancer") || ccL.contains("papillary thyroid") ||
             ccL.contains("follicular thyroid") || ccL.contains("medullary thyroid") ||
             ccL.contains("anaplastic thyroid") || ccL.contains("hyperparathyroidism") ||
             ccL.contains("parathyroid") || ccL.contains("graves disease") ||
             ccL.contains("graves' disease") || ccL.contains("thyroid storm") ||
             ccL.contains("calcitonin") || ccL.contains("ret mutation") ||
             ccL.contains("men2") ||
             (ccL.contains("hypercalcaemia") && ccL.contains("elevated pth")) ||
             (ccL.contains("neck mass") && ccL.contains("thyroid")):
            candidates = externalPool("endocrineSurgical") ?? []
            if ccL.contains("men") { mergePool("adrenalEndocrine") }
            if ccL.contains("cancer") { mergePool("oncologyComplications") }

        // Abdominal trauma and solid-organ injury
        case (ccL.contains("splenic") && (ccL.contains("laceration") || ccL.contains("injury") || ccL.contains("rupture"))) ||
             ccL.contains("hepatic laceration") || ccL.contains("liver laceration") ||
             ccL.contains("hollow viscus") || ccL.contains("seat belt sign") ||
             ccL.contains("pancreatic trauma") || ccL.contains("renal trauma") ||
             ccL.contains("bladder rupture") || ccL.contains("diaphragmatic rupture") ||
             ccL.contains("haemoperitoneum") || ccL.contains("damage control") ||
             ccL.contains("reboa") || ccL.contains("peritoneal lavage") ||
             (ccL.contains("blunt") && ccL.contains("abdominal") && ccL.contains("trauma")) ||
             (ccL.contains("trauma") && (ccL.contains("spleen") || ccL.contains("liver") || ccL.contains("kidney"))):
            candidates = externalPool("abdominalTrauma") ?? []
            if ccL.contains("vascular") || ccL.contains("haemorrhage") { mergePool("peripheralVascular") }
            if ccL.contains("septic") { mergePool("sepsisConditions") }

        // Post-operative surgical complications
        case ccL.contains("anastomotic leak") || ccL.contains("anastomotic dehiscence") ||
             ccL.contains("post-operative ileus") || ccL.contains("postoperative ileus") ||
             ccL.contains("intra-abdominal collection") || ccL.contains("post-op haemorrhage") ||
             ccL.contains("pancreatic fistula") || ccL.contains("popf") ||
             ccL.contains("bile leak") || ccL.contains("post-hepatectomy") ||
             ccL.contains("burst abdomen") || ccL.contains("wound dehiscence") ||
             ccL.contains("anastomotic") || ccL.contains("post-hepatectomy liver failure") ||
             (ccL.contains("post") && ccL.contains("operative") && ccL.contains("fever")) ||
             (ccL.contains("drain") && (ccL.contains("bile") || ccL.contains("faeculent") || ccL.contains("haemorrhagic"))):
            candidates = externalPool("postOpComplications") ?? []
            if ccL.contains("septic") || ccL.contains("peritonitis") { mergePool("sepsisConditions") }
            if ccL.contains("haemorrhage") || ccL.contains("bleeding") { mergePool("upperGIBleed") }

        // Mesenteric vascular conditions
        case ccL.contains("mesenteric ischaemia") || ccL.contains("mesenteric ischemia") ||
             ccL.contains("ischaemic colitis") || ccL.contains("ischemic colitis") ||
             ccL.contains("mesenteric venous thrombosis") || ccL.contains("portal vein thrombosis") ||
             ccL.contains("nomi") || ccL.contains("non-occlusive mesenteric") ||
             ccL.contains("visceral aneurysm") || ccL.contains("splenic artery aneurysm") ||
             ccL.contains("mesenteric artery") || ccL.contains("angiodysplasia") ||
             (ccL.contains("abdominal pain") && ccL.contains("atrial fibrillation") && ccL.contains("severe")) ||
             (ccL.contains("postprandial") && ccL.contains("weight loss") && ccL.contains("abdominal pain")) ||
             (ccL.contains("pain") && ccL.contains("out of proportion")):
            candidates = externalPool("mesentericVascular") ?? []
            if ccL.contains("perforation") || ccL.contains("peritonitis") { mergePool("sepsisConditions") }
            if ccL.contains("portal") || ccL.contains("cirrhosis") { mergePool("hepatobiliaryMalignancy") }

        // Endoscopy and ERCP complications
        case ccL.contains("post-ercp pancreatitis") || ccL.contains("ercp perforation") ||
             ccL.contains("ercp complication") || ccL.contains("sphincterotomy bleeding") ||
             ccL.contains("biliary stent") || ccL.contains("stent occlusion") ||
             ccL.contains("stent migration") || ccL.contains("post-polypectomy") ||
             ccL.contains("polypectomy bleeding") || ccL.contains("colonoscopy perforation") ||
             ccL.contains("esd complication") || ccL.contains("emr complication") ||
             ccL.contains("endoscopic perforation") ||
             (ccL.contains("pain") && ccL.contains("after ercp")) ||
             (ccL.contains("bleeding") && ccL.contains("colonoscopy")):
            candidates = externalPool("surgicalEndoscopyComplications") ?? []
            if ccL.contains("pancreatitis") { mergePool("pancreaticSurgical") }
            if ccL.contains("perforation") { mergePool("sepsisConditions") }

        // Abdominal compartment syndrome and open abdomen
        case ccL.contains("abdominal compartment syndrome") ||
             ccL.contains("intra-abdominal hypertension") ||
             ccL.contains("open abdomen") || ccL.contains("damage control laparotomy") ||
             ccL.contains("enterocutaneous fistula") || ccL.contains("enteric fistula") ||
             ccL.contains("abdominal wall haematoma") || ccL.contains("rectus sheath haematoma") ||
             ccL.contains("fascial dehiscence") ||
             (ccL.contains("bowel") && ccL.contains("visible") && ccL.contains("wound")) ||
             (ccL.contains("bladder pressure") && ccL.contains("oliguria")):
            candidates = externalPool("abdominalCompartmentSyndrome") ?? []
            if ccL.contains("septic") { mergePool("sepsisConditions") }
            if ccL.contains("haemorrhage") { mergePool("postOpComplications") }

        // Chronic wound management
        case ccL.contains("pressure ulcer") || ccL.contains("decubitus ulcer") ||
             ccL.contains("venous leg ulcer") || ccL.contains("arterial ulcer") ||
             ccL.contains("wound vac") || ccL.contains("npwt") ||
             ccL.contains("negative pressure wound") || ccL.contains("skin graft") ||
             ccL.contains("wound biofilm") || ccL.contains("pilonidal") ||
             (ccL.contains("non-healing") && ccL.contains("wound")) ||
             (ccL.contains("chronic") && ccL.contains("wound") && ccL.contains("not healing")):
            candidates = externalPool("chronicWoundManagement") ?? []
            if ccL.contains("infection") || ccL.contains("mrsa") { mergePool("necrotisingSoftTissue") }
            if ccL.contains("diabetic") { mergePool("diabeticFoot") }

        // Liver cirrhosis complications
        case ccL.contains("spontaneous bacterial peritonitis") || ccL.contains("sbp") ||
             ccL.contains("hepatic encephalopathy") || ccL.contains("hepatorenal syndrome") ||
             ccL.contains("oesophageal varices") || ccL.contains("variceal bleeding") ||
             ccL.contains("hepatic hydrothorax") || ccL.contains("aclf") ||
             ccL.contains("acute-on-chronic liver") || ccL.contains("hepatic artery thrombosis") ||
             (ccL.contains("cirrhosis") && (ccL.contains("ascites") || ccL.contains("encephalopathy"))) ||
             (ccL.contains("cirrhotic") && ccL.contains("bleeding")):
            candidates = externalPool("liverCirrhosisComplications") ?? []
            if ccL.contains("varices") || ccL.contains("portal") { mergePool("hepatobiliaryMalignancy") }
            if ccL.contains("sepsis") { mergePool("sepsisConditions") }

        // Colonoscopy pathology and CRC surveillance
        case ccL.contains("adenoma") || ccL.contains("colorectal polyp") ||
             ccL.contains("sessile serrated") || ccL.contains("fap") ||
             ccL.contains("familial adenomatous polyposis") ||
             ccL.contains("diverticular disease") || ccL.contains("diverticulitis") ||
             ccL.contains("colonoscopy surveillance") || ccL.contains("crc surveillance") ||
             (ccL.contains("fit positive") && ccL.contains("colonoscopy")) ||
             (ccL.contains("polyp") && ccL.contains("colonoscopy")) ||
             (ccL.contains("diverticul") && ccL.contains("colon")):
            candidates = externalPool("colonoscopyPathology") ?? []
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("colorectalMalignancy") }
            if ccL.contains("lynch") || ccL.contains("fap") { mergePool("geneticsSyndromic") }

        // Critical care surgical complications
        case ccL.contains("mods") || ccL.contains("multi-organ dysfunction") ||
             ccL.contains("ards") || ccL.contains("clostridium difficile") ||
             ccL.contains("c. diff") || ccL.contains("cdiff") ||
             ccL.contains("post-operative pe") ||
             ccL.contains("stress ulcer") || ccL.contains("post-operative pneumonia") ||
             (ccL.contains("pulmonary embolism") && ccL.contains("post")) ||
             (ccL.contains("icu") && ccL.contains("surgical") && ccL.contains("complication")) ||
             (ccL.contains("mechanical ventilation") && ccL.contains("abdominal")):
            candidates = externalPool("criticalCareSurgical") ?? []
            if ccL.contains("sepsis") { mergePool("sepsisConditions") }
            if ccL.contains("pe") || ccL.contains("dvt") { mergePool("peripheralVascular") }

        // Surgical site infections
        case ccL.contains("surgical site infection") || ccL.contains("ssi") ||
             ccL.contains("wound infection") || ccL.contains("mrsa") ||
             ccL.contains("infected mesh") || ccL.contains("fournier") ||
             ccL.contains("crbsi") || ccL.contains("gas gangrene") ||
             ccL.contains("catheter infection") || ccL.contains("clostridial") ||
             (ccL.contains("wound") && (ccL.contains("purulent") || ccL.contains("discharge") || ccL.contains("infected"))) ||
             (ccL.contains("mesh") && ccL.contains("infection")):
            candidates = externalPool("surgicalSiteInfection") ?? []
            if ccL.contains("fournier") || ccL.contains("necrotising") { mergePool("necrotisingSoftTissue") }
            if ccL.contains("sepsis") { mergePool("sepsisConditions") }

        // Thyroid nodule assessment
        case ccL.contains("thyroid nodule") || ccL.contains("thyroid mass") ||
             ccL.contains("goitre") || ccL.contains("goiter") ||
             ccL.contains("thyroid cancer") || ccL.contains("papillary thyroid") ||
             ccL.contains("follicular thyroid") || ccL.contains("medullary thyroid") ||
             ccL.contains("bethesda") || ccL.contains("fnac thyroid") ||
             ccL.contains("thyroid lymphoma") || ccL.contains("de quervain") ||
             ccL.contains("subacute thyroiditis") ||
             (ccL.contains("neck mass") && ccL.contains("thyroid")) ||
             (ccL.contains("calcitonin") && ccL.contains("elevated")):
            candidates = externalPool("thyroidNoduleAssessment") ?? []
            if ccL.contains("men2") || ccL.contains("ret mutation") { mergePool("adrenalEndocrine") }
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("oncologyComplications") }

        // Carotid and endovascular conditions
        case ccL.contains("carotid stenosis") || ccL.contains("carotid endarterectomy") ||
             ccL.contains("carotid body tumour") || ccL.contains("carotid dissection") ||
             ccL.contains("vertebral artery") || ccL.contains("leriche") ||
             ccL.contains("aortoiliac") || ccL.contains("renal artery stenosis") ||
             ccL.contains("visceral aneurysm") || ccL.contains("splenic artery aneurysm") ||
             (ccL.contains("tia") && ccL.contains("carotid")) ||
             (ccL.contains("stroke") && ccL.contains("carotid")) ||
             (ccL.contains("amaurosis") && ccL.contains("fugax")):
            candidates = externalPool("carotidEndovascular") ?? []
            if ccL.contains("stroke") || ccL.contains("tia") { mergePool("peripheralVascular") }
            if ccL.contains("aneurysm") { mergePool("aorticConditions") }

        // Post-thoracotomy complications
        case ccL.contains("bronchopleural fistula") || ccL.contains("post-thoracotomy") ||
             ccL.contains("chylothorax") || ccL.contains("haemothorax") ||
             ccL.contains("empyema") || ccL.contains("post-pneumonectomy") ||
             ccL.contains("oesophagectomy leak") || ccL.contains("anastomotic leak") && ccL.contains("oesophageal") ||
             ccL.contains("recurrent laryngeal") || ccL.contains("vocal cord palsy") ||
             (ccL.contains("thoracotomy") && ccL.contains("complication")) ||
             (ccL.contains("air leak") && ccL.contains("chest drain")):
            candidates = externalPool("postThoracotomyComplications") ?? []
            if ccL.contains("sepsis") || ccL.contains("empyema") { mergePool("sepsisConditions") }
            if ccL.contains("leak") || ccL.contains("anastomotic") { mergePool("postOpComplications") }

        // Anorectal and pelvic floor conditions
        case ccL.contains("haemorrhoids") || ccL.contains("hemorrhoids") ||
             ccL.contains("anal fissure") || ccL.contains("perianal abscess") ||
             ccL.contains("anal fistula") || ccL.contains("rectal prolapse") ||
             ccL.contains("faecal incontinence") || ccL.contains("fecal incontinence") ||
             ccL.contains("pilonidal") || ccL.contains("rectovaginal fistula") ||
             ccL.contains("pruritus ani") || ccL.contains("soiling") ||
             (ccL.contains("perianal") && ccL.contains("discharge")) ||
             (ccL.contains("rectal bleeding") && ccL.contains("perianal")):
            candidates = externalPool("anorectalFunctional") ?? []
            if ccL.contains("crohn") { mergePool("colonoscopyPathology") }
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("colorectalMalignancy") }

        // Abdominal wall defects and hernias
        case ccL.contains("incisional hernia") || ccL.contains("parastomal hernia") ||
             ccL.contains("epigastric hernia") || ccL.contains("spigelian") ||
             ccL.contains("diastasis recti") || ccL.contains("lumbar hernia") ||
             ccL.contains("obturator hernia") || ccL.contains("richter hernia") ||
             (ccL.contains("hernia") && ccL.contains("abdominal wall")) ||
             (ccL.contains("bulge") && ccL.contains("incision")) ||
             (ccL.contains("hernia") && ccL.contains("repair") && ccL.contains("complication")):
            candidates = externalPool("abdominalWallDefects") ?? []
            if ccL.contains("strangulated") || ccL.contains("obstructed") { mergePool("intestinalObstruction") }
            if ccL.contains("mesh") && ccL.contains("infection") { mergePool("surgicalSiteInfection") }

        // Groin, inguinal and sports hernias
        case ccL.contains("inguinal hernia") || ccL.contains("femoral hernia") ||
             ccL.contains("sports hernia") || ccL.contains("athletic pubalgia") ||
             ccL.contains("groin pain") || ccL.contains("groin swelling") ||
             ccL.contains("hydrocele") || ccL.contains("varicocele") ||
             ccL.contains("psoas abscess") || ccL.contains("inguinal lymph") ||
             (ccL.contains("groin") && ccL.contains("lump")) ||
             (ccL.contains("scrotum") && (ccL.contains("swelling") || ccL.contains("pain"))):
            candidates = externalPool("groinSportsHernia") ?? []
            if ccL.contains("strangulated") { mergePool("intestinalObstruction") }
            if ccL.contains("testicular") || ccL.contains("torsion") { mergePool("urologicalEmergency") }

        // Renal and urological conditions
        case ccL.contains("renal colic") || ccL.contains("ureteric colic") ||
             ccL.contains("nephrolithiasis") || ccL.contains("kidney stone") ||
             ccL.contains("hydronephrosis") || ccL.contains("renal cell carcinoma") ||
             ccL.contains("bladder cancer") || ccL.contains("prostate cancer") ||
             ccL.contains("haematuria") || ccL.contains("luts") ||
             ccL.contains("urothelial") || ccL.contains("testicular torsion") ||
             ccL.contains("benign prostatic") || ccL.contains("bph") ||
             (ccL.contains("loin") && ccL.contains("pain")) ||
             (ccL.contains("flank pain") && ccL.contains("blood")):
            candidates = externalPool("renalUrolithiasis") ?? []
            if ccL.contains("sepsis") || ccL.contains("pyelonephritis") { mergePool("sepsisConditions") }
            if ccL.contains("obstruction") { mergePool("intestinalObstruction") }

        // Primary GI lymphoma and rare GI tumours
        case ccL.contains("gi lymphoma") || ccL.contains("malt lymphoma") ||
             ccL.contains("gastric lymphoma") || ccL.contains("dlbcl") ||
             ccL.contains("eatl") || ccL.contains("gist") ||
             ccL.contains("gastrointestinal stromal") || ccL.contains("carcinoid") ||
             ccL.contains("neuroendocrine") || ccL.contains("net") ||
             ccL.contains("peritoneal mesothelioma") || ccL.contains("desmoid") ||
             ccL.contains("chromogranin") || ccL.contains("5-hiaa") ||
             (ccL.contains("abdominal mass") && ccL.contains("lymphoma")) ||
             (ccL.contains("flushing") && ccL.contains("diarrhoea")):
            candidates = externalPool("primaryGILymphoma") ?? []
            if ccL.contains("h. pylori") || ccL.contains("helicobacter") { mergePool("upperGIDisease") }
            if ccL.contains("b-symptoms") || ccL.contains("lymphadenopathy") { mergePool("oncologyComplications") }

        // Inflammatory bowel disease
        case ccL.contains("crohn") || ccL.contains("crohn's disease") ||
             ccL.contains("ulcerative colitis") || ccL.contains("inflammatory bowel") ||
             ccL.contains("ibd") || ccL.contains("toxic megacolon") ||
             ccL.contains("microscopic colitis") || ccL.contains("short bowel syndrome") ||
             ccL.contains("entero-enteric fistula") || ccL.contains("enterovesical") ||
             ccL.contains("intestinal stricture") || ccL.contains("ibd flare") ||
             (ccL.contains("colitis") && (ccL.contains("bloody") || ccL.contains("chronic"))) ||
             (ccL.contains("diarrhoea") && ccL.contains("bloody") && ccL.contains("chronic")):
            candidates = externalPool("inflammatoryBowelDisease") ?? []
            if ccL.contains("abscess") || ccL.contains("fistula") { mergePool("anorectalFunctional") }
            if ccL.contains("stricture") || ccL.contains("obstruction") { mergePool("intestinalObstruction") }

        // Cardiac surgical conditions
        case ccL.contains("acute coronary syndrome") || ccL.contains("acs") ||
             ccL.contains("aortic dissection") || ccL.contains("cardiac tamponade") ||
             ccL.contains("infective endocarditis") || ccL.contains("stemi") ||
             ccL.contains("nstemi") || ccL.contains("heart failure") ||
             ccL.contains("hypertrophic cardiomyopathy") || ccL.contains("hocm") ||
             ccL.contains("pulmonary hypertension") || ccL.contains("mediastinitis") ||
             ccL.contains("post-cabg") || ccL.contains("post cardiac surgery") ||
             (ccL.contains("troponin") && ccL.contains("elevated")) ||
             (ccL.contains("chest pain") && ccL.contains("diaphoresis")) ||
             (ccL.contains("pericardial") && ccL.contains("effusion")):
            candidates = externalPool("cardiacSurgical") ?? []
            if ccL.contains("dissection") || ccL.contains("aortic") { mergePool("aorticConditions") }
            if ccL.contains("sepsis") || ccL.contains("endocarditis") { mergePool("sepsisConditions") }

        // Parathyroid and adrenal conditions
        case ccL.contains("hyperparathyroidism") || ccL.contains("hypercalcaemia") ||
             ccL.contains("phaeochromocytoma") || ccL.contains("pheochromocytoma") ||
             ccL.contains("conn's syndrome") || ccL.contains("primary aldosteronism") ||
             ccL.contains("adrenal incidentaloma") || ccL.contains("cushing") ||
             ccL.contains("adrenocortical carcinoma") || ccL.contains("men1") ||
             ccL.contains("multiple endocrine neoplasia") || ccL.contains("sestamibi") ||
             ccL.contains("adrenalectomy") ||
             (ccL.contains("adrenal") && ccL.contains("mass")) ||
             (ccL.contains("parathyroid") && ccL.contains("surgery")) ||
             (ccL.contains("elevated") && ccL.contains("pth")):
            candidates = externalPool("parathyroidAdrenal") ?? []
            if ccL.contains("men") || ccL.contains("multiple endocrine") { mergePool("thyroidNoduleAssessment") }
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("oncologyComplications") }

        // Bariatric and metabolic surgery complications
        case ccL.contains("bariatric") || ccL.contains("sleeve gastrectomy") ||
             ccL.contains("gastric bypass") || ccL.contains("rygb") ||
             ccL.contains("dumping syndrome") || ccL.contains("marginal ulcer") ||
             ccL.contains("internal hernia post bypass") || ccL.contains("anastomotic leak") && ccL.contains("bariatric") ||
             ccL.contains("nutritional deficiency post bariatric") ||
             (ccL.contains("weight loss surgery") && ccL.contains("complication")) ||
             (ccL.contains("gerd") && ccL.contains("sleeve")) ||
             (ccL.contains("gallstone") && ccL.contains("post bariatric")):
            candidates = externalPool("bariatricMetabolic") ?? []
            if ccL.contains("gallstone") || ccL.contains("biliary") { mergePool("hepatobiliaryAcute") }
            if ccL.contains("leak") || ccL.contains("peritonitis") { mergePool("postOpComplications") }

        // Transplant surgery complications
        case ccL.contains("transplant rejection") || ccL.contains("graft rejection") ||
             ccL.contains("hepatic artery thrombosis") || ccL.contains("ptld") ||
             ccL.contains("post-transplant") || ccL.contains("tacrolimus toxicity") ||
             ccL.contains("cyclosporine nephrotoxicity") || ccL.contains("biliary stricture") ||
             ccL.contains("primary non-function") || ccL.contains("cmv post-transplant") ||
             ccL.contains("pcp pneumonia") && ccL.contains("transplant") ||
             (ccL.contains("liver") && ccL.contains("transplant")) ||
             (ccL.contains("renal") && ccL.contains("transplant") && ccL.contains("dysfunction")):
            candidates = externalPool("transplantSurgery") ?? []
            if ccL.contains("lymphoma") || ccL.contains("ebv") { mergePool("primaryGILymphoma") }
            if ccL.contains("infection") || ccL.contains("sepsis") { mergePool("sepsisConditions") }

        // Chronic wound care
        case ccL.contains("diabetic foot") || ccL.contains("venous ulcer") ||
             ccL.contains("pressure ulcer") || ccL.contains("decubitus") ||
             ccL.contains("calciphylaxis") || ccL.contains("pyoderma gangrenosum") ||
             ccL.contains("hidradenitis suppurativa") || ccL.contains("marjolin") ||
             ccL.contains("keloid") || ccL.contains("hypertrophic scar") ||
             ccL.contains("chronic wound") || ccL.contains("wound healing") ||
             (ccL.contains("ulcer") && ccL.contains("non-healing")) ||
             (ccL.contains("wound") && ccL.contains("chronic")):
            candidates = externalPool("chronicWoundCare") ?? []
            if ccL.contains("osteomyelitis") { mergePool("spinalNeurosurgical") }
            if ccL.contains("vascular") || ccL.contains("abpi") { mergePool("peripheralVascular") }

        // Haematological surgical conditions
        case ccL.contains("splenic abscess") || ccL.contains("splenomegaly") ||
             ccL.contains("splenic rupture") || ccL.contains("haemophilia") ||
             ccL.contains("itp") || ccL.contains("immune thrombocytopaenia") ||
             ccL.contains("hereditary spherocytosis") || ccL.contains("myelofibrosis") ||
             ccL.contains("splenic vein thrombosis") || ccL.contains("splenectomy") ||
             ccL.contains("hypersplenism") || ccL.contains("jak2") ||
             (ccL.contains("spleen") && ccL.contains("pain")) ||
             (ccL.contains("left upper quadrant") && ccL.contains("mass")):
            candidates = externalPool("haematologicalSurgical") ?? []
            if ccL.contains("trauma") { mergePool("traumaAbdominal") }
            if ccL.contains("portal hypertension") || ccL.contains("varices") { mergePool("liverCirrhosisComplications") }

        // Spinal and neurosurgical conditions
        case ccL.contains("disc herniation") || ccL.contains("cauda equina") ||
             ccL.contains("spinal cord compression") || ccL.contains("cervical myelopathy") ||
             ccL.contains("spinal stenosis") || ccL.contains("epidural abscess") ||
             ccL.contains("vertebral osteomyelitis") || ccL.contains("radiculopathy") ||
             ccL.contains("sciatica") || ccL.contains("myelopathy") ||
             ccL.contains("neurogenic claudication") || ccL.contains("sacral fracture") ||
             ccL.contains("spinal metastasis") || ccL.contains("saddle anaesthesia") ||
             (ccL.contains("back pain") && ccL.contains("neurological")) ||
             (ccL.contains("leg weakness") && ccL.contains("back pain")) ||
             (ccL.contains("urinary retention") && ccL.contains("back pain")):
            candidates = externalPool("spinalNeurosurgical") ?? []
            if ccL.contains("malignancy") || ccL.contains("metastasis") { mergePool("oncologyComplications") }
            if ccL.contains("sepsis") || ccL.contains("abscess") { mergePool("sepsisConditions") }

        // Gynaecological surgical conditions
        case ccL.contains("ovarian torsion") || ccL.contains("ectopic pregnancy") ||
             ccL.contains("pelvic inflammatory disease") || ccL.contains("pid") ||
             ccL.contains("endometriosis") || ccL.contains("ovarian cancer") ||
             ccL.contains("uterine fibroid") || ccL.contains("fibroids") ||
             ccL.contains("bartholin") || ccL.contains("cervical cancer") ||
             ccL.contains("endometrial cancer") || ccL.contains("postmenopausal bleeding") ||
             (ccL.contains("adnexal") && ccL.contains("mass")) ||
             (ccL.contains("pelvic pain") && ccL.contains("female")) ||
             (ccL.contains("lower abdominal pain") && ccL.contains("female")):
            candidates = externalPool("gynaecologicalSurgical") ?? []
            if ccL.contains("ectopic") || ccL.contains("haemoperitoneum") { mergePool("acuteAbdominalPain") }
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("oncologyComplications") }

        // ── Investigation-first chief complaints ──────────────────────────────
        // Fired when the presenting reason IS an investigation result, not a
        // symptom: incidental imaging findings, elevated tumour markers,
        // positive endoscopy/biopsy/lab — routes to the specialty pool whose
        // candidates carry matching `inv` features.

        // Elevated tumour markers — hepatobiliary / pancreatic / colorectal
        case ccL.contains("elevated afp") || ccL.contains("afp elevated") ||
             ccL.contains("afp raised") || ccL.contains("raised afp") ||
             (ccL.contains("afp") && ccL.contains("abnormal")) ||
             ccL.contains("liver lesion") || ccL.contains("liver mass") ||
             ccL.contains("hepatic lesion") || ccL.contains("hepatic mass") ||
             ccL.contains("hcc surveillance") || ccL.contains("hepatocellular") ||
             (ccL.contains("liver") && (ccL.contains("incidental") || ccL.contains("finding on ct") || ccL.contains("finding on mri"))) ||
             (ccL.contains("ct") && ccL.contains("liver") && ccL.contains("mass")):
            candidates = externalPool("hepatobiliaryMalignancy") ?? []
            if ccL.contains("cirrhosis") || ccL.contains("portal hypertension") { mergePool("liverCirrhosisComplications") }
            if ccL.contains("metastasis") || ccL.contains("mets") { mergePool("oncologyComplications") }

        // Elevated CA19-9 / pancreatic cyst / IPMN
        case ccL.contains("elevated ca19-9") || ccL.contains("ca19-9 elevated") ||
             ccL.contains("ca 19-9") || ccL.contains("raised ca19-9") ||
             ccL.contains("pancreatic cyst") || ccL.contains("pancreatic lesion") ||
             ccL.contains("ipmn") || ccL.contains("intraductal papillary") ||
             ccL.contains("pancreatic mass") || ccL.contains("pancreatic incidentaloma") ||
             (ccL.contains("pancreas") && (ccL.contains("cyst") || ccL.contains("lesion") || ccL.contains("mass"))) ||
             (ccL.contains("ct") && ccL.contains("pancreas") && ccL.contains("finding")):
            candidates = externalPool("pancreaticSurgical") ?? []
            if ccL.contains("jaundice") || ccL.contains("biliary") { mergePool("jaundice") }
            if ccL.contains("ca19-9") || ccL.contains("weight loss") { mergePool("oncologyComplications") }

        // Elevated CEA / colorectal surveillance / positive FIT
        case ccL.contains("elevated cea") || ccL.contains("cea elevated") ||
             ccL.contains("raised cea") || ccL.contains("cea rising") ||
             ccL.contains("positive fit") || ccL.contains("fit positive") ||
             ccL.contains("fit test positive") || ccL.contains("fob positive") ||
             ccL.contains("fob test positive") || ccL.contains("colonoscopy finding") ||
             ccL.contains("polyp on colonoscopy") || ccL.contains("colorectal polyp") ||
             ccL.contains("colonic mass") || ccL.contains("ct colonography") ||
             (ccL.contains("cea") && ccL.contains("surveillance")) ||
             (ccL.contains("bowel cancer") && ccL.contains("screening")):
            candidates = externalPool("colorectalMalignancy") ?? []
            if ccL.contains("polyp") || ccL.contains("adenoma") { mergePool("colonoscopyPathology") }
            if ccL.contains("lynch") || ccL.contains("hnpcc") { mergePool("oncologyComplications") }

        // Elevated CA-125 / adnexal / ovarian finding
        case ccL.contains("elevated ca-125") || ccL.contains("ca-125 elevated") ||
             ccL.contains("ca125 elevated") || ccL.contains("raised ca125") ||
             ccL.contains("adnexal mass") || ccL.contains("adnexal cyst") ||
             ccL.contains("ovarian cyst") || ccL.contains("ovarian mass") ||
             ccL.contains("complex ovarian") || ccL.contains("pelvic mass on") ||
             (ccL.contains("ca-125") && ccL.contains("abnormal")) ||
             (ccL.contains("ultrasound") && ccL.contains("ovarian") && ccL.contains("mass")):
            candidates = externalPool("gynaecologicalSurgical") ?? []
            if ccL.contains("ascites") || ccL.contains("omental") { mergePool("oncologyComplications") }

        // Elevated PSA / prostate finding / renal mass / bladder mass
        case ccL.contains("elevated psa") || ccL.contains("psa elevated") ||
             ccL.contains("raised psa") || ccL.contains("psa rising") ||
             ccL.contains("renal mass") || ccL.contains("renal lesion") ||
             ccL.contains("renal incidentaloma") || ccL.contains("kidney mass") ||
             ccL.contains("bladder mass") || ccL.contains("bladder lesion") ||
             ccL.contains("pirads") || ccL.contains("mpMRI prostate") ||
             ccL.contains("haematuria investigation") ||
             (ccL.contains("ct") && ccL.contains("renal") && ccL.contains("lesion")) ||
             (ccL.contains("psa") && ccL.contains("screening")) ||
             (ccL.contains("prostate") && ccL.contains("biopsy")):
            candidates = externalPool("urologicalSurgical") ?? []
            if ccL.contains("haematuria") || ccL.contains("bladder") { mergePool("renalUrolithiasis") }
            if ccL.contains("renal") && ccL.contains("cancer") { mergePool("oncologyComplications") }

        // Elevated PTH / hypercalcaemia / adrenal mass / phaeochromocytoma
        case ccL.contains("elevated pth") || ccL.contains("pth elevated") ||
             ccL.contains("raised pth") || ccL.contains("hyperparathyroid") ||
             ccL.contains("adrenal mass") || ccL.contains("adrenal lesion") ||
             ccL.contains("adrenal incidentaloma") || ccL.contains("incidental adrenal") ||
             ccL.contains("elevated metanephrine") || ccL.contains("metanephrine elevated") ||
             ccL.contains("elevated aldosterone") || ccL.contains("aldo:renin") ||
             ccL.contains("aldosterone renin") || ccL.contains("elevated cortisol") ||
             (ccL.contains("ct") && ccL.contains("adrenal") && (ccL.contains("mass") || ccL.contains("lesion"))) ||
             (ccL.contains("conn") && ccL.contains("screen")) ||
             (ccL.contains("cushing") && ccL.contains("screen")):
            candidates = externalPool("parathyroidAdrenal") ?? []
            if ccL.contains("men") || ccL.contains("multiple endocrine") { mergePool("endocrineSurgical") }
            if ccL.contains("phaeochromocytoma") || ccL.contains("crisis") { mergePool("sepsisConditions") }

        // Elevated calcitonin / thyroid nodule cytology / FNAC result
        case ccL.contains("elevated calcitonin") || ccL.contains("calcitonin elevated") ||
             ccL.contains("raised calcitonin") || ccL.contains("calcitonin abnormal") ||
             ccL.contains("bethesda") || ccL.contains("fnac result") ||
             ccL.contains("thyroid cytology") || ccL.contains("tirads") ||
             ccL.contains("thyroid nodule") || ccL.contains("thyroid incidentaloma") ||
             (ccL.contains("ultrasound") && ccL.contains("thyroid") && (ccL.contains("nodule") || ccL.contains("mass"))) ||
             (ccL.contains("thyroid") && (ccL.contains("biopsy") || ccL.contains("fnac") || ccL.contains("fna"))):
            candidates = externalPool("thyroidNoduleAssessment") ?? []
            if ccL.contains("medullary") || ccL.contains("calcitonin") { mergePool("endocrineSurgical") }
            if ccL.contains("men2") || ccL.contains("ret mutation") { mergePool("parathyroidAdrenal") }

        // Lung nodule / pulmonary incidentaloma
        case ccL.contains("lung nodule") || ccL.contains("pulmonary nodule") ||
             ccL.contains("lung lesion") || ccL.contains("pulmonary lesion") ||
             ccL.contains("lung mass") || ccL.contains("lung incidentaloma") ||
             ccL.contains("ct chest finding") || ccL.contains("ground glass opacity") ||
             (ccL.contains("ct chest") && (ccL.contains("nodule") || ccL.contains("mass") || ccL.contains("lesion"))) ||
             (ccL.contains("incidental") && ccL.contains("pulmonary")):
            candidates = externalPool("thoracicSurgical") ?? []
            if ccL.contains("pleural") { mergePool("pleural") }
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("oncologyComplications") }

        // Elevated amylase / lipase — investigation-first acute pancreatitis
        case (ccL.contains("elevated amylase") || ccL.contains("amylase elevated") ||
              ccL.contains("raised amylase") || ccL.contains("lipase elevated") ||
              ccL.contains("elevated lipase") || ccL.contains("raised lipase")) &&
             !ccL.contains("chest pain"):
            candidates = externalPool("acutePancreatitis") ?? externalPool("biliaryColic") ?? []
            if ccL.contains("gallstone") || ccL.contains("biliary") { mergePool("biliaryColic") }

        // Abnormal LFTs / elevated bilirubin — investigation-first jaundice workup
        case ccL.contains("abnormal lfts") || ccL.contains("deranged lfts") ||
             ccL.contains("elevated bilirubin") || ccL.contains("elevated alt") ||
             ccL.contains("elevated ast") || ccL.contains("elevated ggt") ||
             ccL.contains("elevated alp") || ccL.contains("lft abnormal") ||
             ccL.contains("liver function abnormal") || ccL.contains("hepatitis screen") ||
             (ccL.contains("liver") && ccL.contains("blood test") && ccL.contains("abnormal")) ||
             (ccL.contains("lfts") && (ccL.contains("raised") || ccL.contains("high") || ccL.contains("abnormal"))):
            candidates = externalPool("jaundice") ?? jaundice
            if ccL.contains("gallstone") || ccL.contains("biliary") { mergePool("biliaryColic") }
            if ccL.contains("hepatitis") { mergePool("liverDisease") }

        // Iron deficiency anaemia — investigation-first GI malignancy workup
        case (ccL.contains("iron deficiency anaemia") || ccL.contains("iron deficiency anemia") ||
              ccL.contains("ida ") || ccL.contains("microcytic anaemia") ||
              ccL.contains("unexplained anaemia") || ccL.contains("occult gi bleed") ||
              ccL.contains("positive faecal occult") || ccL.contains("fob positive")) &&
             !ccL.contains("heavy period") && !ccL.contains("menorrhagia") && !ccL.contains("child"):
            candidates = externalPool("colorectalMalignancy") ?? []
            if ccL.contains("oesophagus") || ccL.contains("stomach") || ccL.contains("gastric") { mergePool("oesophagogastricSurgical") }
            mergePool("anaemia")

        // ── End investigation-first routing ────────────────────────────────

        // Skin and soft tissue tumours
        case ccL.contains("melanoma") || ccL.contains("basal cell") ||
             ccL.contains("squamous cell carcinoma") || ccL.contains("skin cancer") ||
             ccL.contains("gist") || ccL.contains("gastrointestinal stromal") ||
             ccL.contains("desmoid") || ccL.contains("retroperitoneal sarcoma") ||
             ccL.contains("merkel cell") || ccL.contains("soft tissue sarcoma") ||
             ccL.contains("lipoma") || ccL.contains("subcutaneous mass") ||
             ccL.contains("marjolin") || ccL.contains("pseudomyxoma peritonei") ||
             (ccL.contains("skin") && (ccL.contains("lesion") || ccL.contains("mass") || ccL.contains("nodule"))) ||
             (ccL.contains("pigmented") && ccL.contains("lesion")):
            candidates = externalPool("softTissueTumours") ?? []
            if ccL.contains("cancer") || ccL.contains("sarcoma") || ccL.contains("melanoma") { mergePool("oncologyComplications") }
            if ccL.contains("retroperitoneal") { mergePool("abdominalTrauma") }

        // Stoma and peristomal complications
        case ccL.contains("parastomal hernia") || ccL.contains("stoma prolapse") ||
             ccL.contains("stoma retraction") || ccL.contains("stomal ischaemia") ||
             ccL.contains("stoma necrosis") || ccL.contains("stoma stenosis") ||
             ccL.contains("high output stoma") || ccL.contains("high-output stoma") ||
             ccL.contains("peristomal") || ccL.contains("loop stoma") ||
             (ccL.contains("stoma") && (ccL.contains("problem") || ccL.contains("complication") || ccL.contains("leaking") || ccL.contains("pain"))) ||
             (ccL.contains("colostomy") && ccL.contains("prolapse")) ||
             (ccL.contains("ileostomy") && (ccL.contains("high output") || ccL.contains("dehydration"))):
            candidates = externalPool("stomaComplications") ?? []
            if ccL.contains("crohn") || ccL.contains("ibd") { mergePool("inflammatoryBowel") }
            if ccL.contains("hernia") { mergePool("abdominalWallHernia") }

        // Bariatric and metabolic surgery complications
        case ccL.contains("marginal ulcer") || ccL.contains("staple line leak") ||
             ccL.contains("dumping syndrome") || ccL.contains("post-bariatric") ||
             ccL.contains("postbariatric") || ccL.contains("gastric bypass") ||
             ccL.contains("sleeve gastrectomy") || ccL.contains("rygb") ||
             ccL.contains("gastric band") || ccL.contains("band slippage") ||
             ccL.contains("band erosion") || ccL.contains("internal hernia") && ccL.contains("bypass") ||
             ccL.contains("bariatric") || ccL.contains("petersen defect") ||
             (ccL.contains("weight regain") && ccL.contains("surgery")) ||
             (ccL.contains("nutritional deficiency") && ccL.contains("bariatric")):
            candidates = externalPool("bariatricSurgical") ?? []
            if ccL.contains("leak") || ccL.contains("septic") { mergePool("postOpComplications") }
            if ccL.contains("nutritional") || ccL.contains("deficiency") { mergePool("nutritionalDeficiency") }

        // Intestinal obstruction (mechanical)
        case ccL.contains("small bowel obstruction") || ccL.contains("large bowel obstruction") ||
             ccL.contains("sigmoid volvulus") || ccL.contains("caecal volvulus") ||
             ccL.contains("gallstone ileus") || ccL.contains("intussusception") ||
             ccL.contains("ogilvie") || ccL.contains("pseudo-obstruction") ||
             ccL.contains("colonic pseudo-obstruction") ||
             (ccL.contains("bowel obstruction") && (ccL.contains("adhesion") || ccL.contains("hernia") || ccL.contains("cancer"))) ||
             (ccL.contains("volvulus") && (ccL.contains("sigmoid") || ccL.contains("caecal"))) ||
             (ccL.contains("air fluid levels") && ccL.contains("distension")) ||
             (ccL.contains("colicky") && ccL.contains("distension") && ccL.contains("vomiting")):
            candidates = externalPool("intestinalObstruction") ?? []
            if ccL.contains("strangulated") || ccL.contains("ischaemia") { mergePool("sepsisConditions") }
            if ccL.contains("cancer") || ccL.contains("malignant") { mergePool("colorectalMalignancy") }
            if ccL.contains("hernia") { mergePool("abdominalWallHernia") }

        default:
            // Wide-net general medicine catch-all — no longer surgical-biased
            candidates = externalPool("generalMedicine") ?? []
        }

        // ── Multi-pool augmentation ──────────────────────────────────────
        // When the CC spans several symptom domains (e.g. "chest pain and
        // shortness of breath"), merge candidates from up to two secondary
        // pools so the Bayesian scorer sees the full differential.
        seenNames.formUnion(candidates.map(\.name))
        // Secondary pool: respiratory
        if ccL.contains("cough") || ccL.contains("breathless") ||
           ccL.contains("dyspnoea") || ccL.contains("dyspnea") { mergePool("cough") }
        // Secondary pool: nausea/vomiting overlay
        if ccL.contains("nausea") || ccL.contains("vomiting") { mergePool("nauseaVomiting") }
        // Secondary pool: systemic infection / fever overlay
        if ccL.contains("fever") || ccL.contains("pyrexia") { mergePool("feverInfection") }
        // Secondary pool: neurological overlay
        if ccL.contains("headache") || ccL.contains("migraine") { mergePool("headache") }
        // Secondary pool: chest pain overlay
        if ccL.contains("chest pain") || ccL.contains("chest tightness") { mergePool("chestPain") }
        // Secondary pool: weight loss / constitutional overlay
        if ccL.contains("weight loss") || ccL.contains("losing weight") { mergePool("weightLoss") }
        // Secondary pool: pelvic / gynaecological overlay
        if ccL.contains("pelvic") || ccL.contains("menstrual") || ccL.contains("vaginal") { mergePool("pelvicPain") }
        // Secondary pool: arrhythmia overlay on palpitations / chest pain
        if ccL.contains("palpitation") || ccL.contains("atrial") { mergePool("arrhythmia") }
        // Secondary pool: heart failure overlay on dyspnoea
        if ccL.contains("breathless") || ccL.contains("oedema") || ccL.contains("edema") { mergePool("cardiacFailure") }
        // Secondary pool: jaundice overlay on liver symptoms
        if ccL.contains("jaundice") || ccL.contains("yellow") { mergePool("liverDisease") }
        // Secondary pool: biliary overlay when RUQ or biliary keywords present
        if ccL.contains("right upper") || ccL.contains("ruq") || ccL.contains("cholecyst") ||
           ccL.contains("gallbladder") || ccL.contains("biliary") { mergePool("biliaryColic") }
        // Secondary pool: pancreatitis overlay on epigastric with back radiation
        if ccL.contains("pancreat") || ccL.contains("amylase") ||
           (ccL.contains("epigast") && ccL.contains("back")) { mergePool("acutePancreatitis") }
        // Secondary pool: appendicitis overlay on RIF or periumbilical pain
        if ccL.contains("right iliac") || ccL.contains("rif") || ccL.contains("appendic") ||
           (ccL.contains("periumbilical") && ccL.contains("migrat")) { mergePool("rightIliacFossaPain") }
        // Secondary pool: syncope overlay on dizziness / presyncope / collapse
        if ccL.contains("syncope") || ccL.contains("faint") || ccL.contains("collapse") ||
           ccL.contains("blackout") { mergePool("syncope") }
        // Secondary pool: seizure overlay on loss of consciousness / convulsion
        if ccL.contains("seizure") || ccL.contains("convulsion") ||
           ccL.contains("postictal") { mergePool("seizure") }
        // Secondary pool: ENT throat overlay on neck pain / odynophagia
        if ccL.contains("throat") || ccL.contains("tonsil") ||
           ccL.contains("odynophagia") { mergePool("soreThroat") }
        // Secondary pool: eye overlay on headache with visual / temporal arteritis context
        if ccL.contains("visual") || ccL.contains("diplopia") || ccL.contains("photophobia") ||
           (ccL.contains("eye") && (ccL.contains("pain") || ccL.contains("red"))) { mergePool("eyeComplaint") }
        // Secondary pool: VTE overlay on leg swelling / breathlessness combination
        if (ccL.contains("leg") && ccL.contains("swelling")) ||
           (ccL.contains("breathless") && ccL.contains("leg")) { mergePool("venousThromboEmbolism") }
        // Secondary pool: ear overlay on dizziness/vertigo with auditory symptoms
        if ccL.contains("tinnitus") || (ccL.contains("hearing") && ccL.contains("loss")) ||
           (ccL.contains("ear") && ccL.contains("pain")) { mergePool("earComplaint") }
        // Secondary pool: rhinosinusitis overlay on cough or headache with nasal symptoms
        if ccL.contains("nasal") || ccL.contains("sinus") ||
           (ccL.contains("cough") && ccL.contains("post-nasal")) { mergePool("rhinosinusitis") }
        // Secondary pool: peripheral neuropathy overlay on diabetic or B12-related presentations
        if (ccL.contains("diabet") && ccL.contains("numb")) ||
           (ccL.contains("b12") || ccL.contains("vitamin b")) { mergePool("peripheralNeuropathy") }
        // Secondary pool: oral overlay on neck lump / sore throat when mouth symptoms present
        if ccL.contains("mouth") || ccL.contains("tongue") ||
           ccL.contains("dental") || ccL.contains("jaw") { mergePool("oralComplaint") }
        // Secondary pool: tropical infections overlay on fever with travel / rash / arthralgia
        if ccL.contains("dengue") || ccL.contains("travel") ||
           (ccL.contains("fever") && ccL.contains("rash")) { mergePool("tropicalInfections") }
        // Secondary pool: rheumatology overlay on joint pain / inflammatory markers
        if ccL.contains("rheumatoid") || ccL.contains("inflammatory") ||
           (ccL.contains("joint") && ccL.contains("morning")) { mergePool("rheumatology") }
        // Secondary pool: chest wall overlay on musculoskeletal chest pain presentations
        if (ccL.contains("chest") && ccL.contains("wall")) ||
           ccL.contains("costochondritis") || ccL.contains("pleurisy") { mergePool("chestWallPain") }
        // Secondary pool: urological oncology overlay on haematuria / voiding / psa context
        if ccL.contains("haematuria") || ccL.contains("hematuria") ||
           ccL.contains("psa") || (ccL.contains("bladder") && ccL.contains("blood")) { mergePool("prostateCancer") }
        // Secondary pool: orthopaedic overlay on joint/limb injury or fracture context
        if (ccL.contains("fracture") || ccL.contains("ligament") || ccL.contains("tendon")) ||
           (ccL.contains("joint") && ccL.contains("injury")) { mergePool("orthopaedicTrauma") }
        // Secondary pool: psychiatric overlay on unexplained somatic / chronic fatigue context
        if ccL.contains("medically unexplained") || ccL.contains("somatic") ||
           (ccL.contains("depression") || ccL.contains("anxiety")) { mergePool("psychiatryMental") }
        // Secondary pool: sleep overlay on OSA / daytime fatigue / snoring context
        if ccL.contains("daytime sleepiness") || ccL.contains("snoring") ||
           (ccL.contains("sleep") && ccL.contains("problem")) { mergePool("sleepDisorders") }
        // Secondary pool: menopause/andrology overlay on hormonal / climacteric presentations
        if ccL.contains("hot flush") || ccL.contains("night sweat") || ccL.contains("hrt") ||
           ccL.contains("testosterone") || ccL.contains("menopause") { mergePool("menopauseAndrology") }
        // Secondary pool: haematological malignancy overlay on lymphadenopathy / B-symptoms / paraprotein
        if ccL.contains("lymph node") || ccL.contains("lymphadenopathy") ||
           ccL.contains("night sweats") || ccL.contains("paraprotein") ||
           (ccL.contains("weight loss") && ccL.contains("sweat")) { mergePool("haematologicalMalignancy") }
        // Secondary pool: geriatric overlay on confusion / falls / frailty in elderly context
        if ccL.contains("confusion") || ccL.contains("delirium") || ccL.contains("falls") ||
           ccL.contains("frail") || ccL.contains("dementia") { mergePool("geriatricSyndrome") }
        // Secondary pool: nutritional deficiency overlay on anaemia / neuropathy / fatigue
        if ccL.contains("deficiency") || ccL.contains("vitamin") || ccL.contains("malnutrition") ||
           (ccL.contains("anaemia") && ccL.contains("diet")) { mergePool("nutritionDeficiency") }
        // Secondary pool: fibromyalgia/chronic pain overlay on widespread pain / fatigue / functional presentations
        if ccL.contains("widespread pain") || ccL.contains("fibromyalgia") ||
           ccL.contains("chronic fatigue") || ccL.contains("myofascial") { mergePool("fibromyalgiaChronic") }
        // Secondary pool: allergy overlay on urticaria / angioedema / drug reaction
        if ccL.contains("allergy") || ccL.contains("urticaria") || ccL.contains("angioedema") ||
           ccL.contains("anaphyla") { mergePool("allergyImmunology") }
        // Secondary pool: metabolic syndrome overlay on obesity / lipids / NAFLD / gout
        if ccL.contains("cholesterol") || ccL.contains("lipid") || ccL.contains("obesity") ||
           ccL.contains("metabolic") { mergePool("metabolicSyndrome") }
        // Secondary pool: oncology complications overlay on known cancer with new symptom
        if ccL.contains("cancer") && (ccL.contains("complication") || ccL.contains("back pain") ||
           ccL.contains("confusion") || ccL.contains("calcium")) { mergePool("oncologyComplications") }
        // Secondary pool: sports medicine overlay on athletic/exertional presentations
        if ccL.contains("sport") || ccL.contains("athletic") || ccL.contains("exertional") ||
           ccL.contains("rhabdomyo") { mergePool("sportsMedicine") }
        // Secondary pool: HIV/STI overlay on sexual health / unexplained immunosuppression
        if ccL.contains("sexual") || ccL.contains("sti") || ccL.contains("hiv") ||
           ccL.contains("genital") { mergePool("hivAidsSTI") }
        // Secondary pool: diabetic foot overlay on foot/wound presentations in diabetes
        if (ccL.contains("foot") && ccL.contains("diabet")) ||
           ccL.contains("charcot") || ccL.contains("foot ulcer") { mergePool("diabeticFoot") }
        // Secondary pool: toxicology overlay on altered consciousness or drug ingestion history
        if ccL.contains("overdose") || ccL.contains("poisoning") ||
           ccL.contains("toxidrome") { mergePool("toxicologyOverdose") }
        // Secondary pool: palliative overlay on advanced cancer / end-of-life symptom review
        if ccL.contains("palliative") || ccL.contains("end of life") ||
           ccL.contains("terminal") { mergePool("palliativeCare") }
        // Secondary pool: haemoglobinopathy overlay on haemolytic anaemia or Caribbean ancestry
        if ccL.contains("sickle") || ccL.contains("g6pd") || ccL.contains("thalassaemia") ||
           ccL.contains("haemolytic") || ccL.contains("htlv") ||
           (ccL.contains("caribbean") && ccL.contains("anaemia")) { mergePool("haemoglobinopathy") }
        // Secondary pool: coagulation overlay on bleeding, bruising, platelet, or clotting concerns
        if ccL.contains("coagulopathy") || ccL.contains("bleeding disorder") ||
           ccL.contains("platelet") || ccL.contains("thrombocytopenia") ||
           (ccL.contains("spontaneous") && ccL.contains("bleed")) { mergePool("coagulationDisorder") }
        // Secondary pool: occupational disease overlay on work-related or industrial exposure
        if ccL.contains("occupational") || ccL.contains("asbestos") || ccL.contains("silicosis") ||
           ccL.contains("mesothelioma") || ccL.contains("havs") ||
           (ccL.contains("work") && ccL.contains("exposure")) { mergePool("occupationalMedicine") }
        // Secondary pool: pre-op risk overlay on surgical fitness or perioperative review
        if ccL.contains("perioperative") || ccL.contains("pre-op") || ccL.contains("preoperative") ||
           ccL.contains("surgical clearance") ||
           (ccL.contains("surgery") && ccL.contains("risk")) { mergePool("preoperativeAssessment") }
        if ccL.contains("intussusception") || ccL.contains("pyloric") ||
           ccL.contains("meckel") || ccL.contains("hirschsprung") ||
           (ccL.contains("child") && ccL.contains("bowel")) { mergePool("paediatricSurgical") }
        if ccL.contains("breast") || ccL.contains("nipple") ||
           ccL.contains("mastitis") || ccL.contains("fibroadenoma") { mergePool("breastDisease") }
        if ccL.contains("ectopic") || ccL.contains("ovarian torsion") ||
           ccL.contains("hellp") || ccL.contains("endometriosis") { mergePool("acuteObstetricGynae") }
        if ccL.contains("thyroid") || ccL.contains("parathyroid") || ccL.contains("parotid") ||
           (ccL.contains("neck") && ccL.contains("mass")) { mergePool("headNeckSurgical") }
        if ccL.contains("dengue") || ccL.contains("chikungunya") || ccL.contains("leptospirosis") ||
           ccL.contains("malaria") || ccL.contains("zika") ||
           (ccL.contains("caribbean") && ccL.contains("fever")) { mergePool("tropicalInfectious") }
        if ccL.contains("claudication") || ccL.contains("limb ischaemia") || ccL.contains("varicose") ||
           ccL.contains("aortic aneurysm") || ccL.contains("carotid stenosis") ||
           (ccL.contains("peripheral") && ccL.contains("arterial")) { mergePool("peripheralVascular") }
        if ccL.contains("sciatica") || ccL.contains("cauda equina") || ccL.contains("disc herniation") ||
           ccL.contains("spinal stenosis") || ccL.contains("vertebral fracture") ||
           (ccL.contains("back pain") && ccL.contains("leg")) { mergePool("spinalEmergency") }
        if ccL.contains("necrotising fasciitis") || ccL.contains("necrotizing fasciitis") ||
           ccL.contains("fournier") || ccL.contains("gas gangrene") || ccL.contains("pyomyositis") ||
           ccL.contains("ludwig") || ccL.contains("lymphoedema") ||
           (ccL.contains("crepitus") && ccL.contains("wound")) { mergePool("necroSoftTissue") }
        if ccL.contains("haemorrhoid") || ccL.contains("anal fissure") ||
           ccL.contains("perianal") || ccL.contains("pilonidal") ||
           (ccL.contains("anal") && ccL.contains("pain")) { mergePool("anorectaColonBenign") }
        if ccL.contains("testicular") || ccL.contains("haematuria") ||
           ccL.contains("prostate") || ccL.contains("bladder cancer") ||
           ccL.contains("urinary retention") { mergePool("urologicalSurgical") }
        if ccL.contains("crohn") || ccL.contains("ulcerative colitis") ||
           ccL.contains("coeliac") || ccL.contains("calprotectin") ||
           ccL.contains("ibd") { mergePool("inflammatoryBowel") }
        if ccL.contains("hepatocellular") || ccL.contains("hcc") ||
           ccL.contains("cholangiocarcinoma") || ccL.contains("portal hypertension") ||
           ccL.contains("liver metastases") || ccL.contains("hepatic abscess") ||
           (ccL.contains("cirrhosis") && ccL.contains("mass")) { mergePool("hepatobiliaryMalignancy") }
        if ccL.contains("insulinoma") || ccL.contains("ipmn") || ccL.contains("gastrinoma") ||
           ccL.contains("pancreatic cyst") || ccL.contains("chronic pancreatitis") ||
           (ccL.contains("fasting") && ccL.contains("hypoglycaemia")) { mergePool("pancreaticSurgical") }
        if ccL.contains("achalasia") || ccL.contains("barrett") || ccL.contains("mallory-weiss") ||
           ccL.contains("oesophageal cancer") || ccL.contains("gastric cancer") ||
           ccL.contains("boerhaave") || ccL.contains("gastric outlet obstruction") ||
           (ccL.contains("dysphagia") && ccL.contains("weight loss")) { mergePool("oesophagogastricSurgical") }
        if ccL.contains("pneumothorax") || ccL.contains("empyema") ||
           ccL.contains("lung cancer") || ccL.contains("mesothelioma") ||
           ccL.contains("pleural effusion") || ccL.contains("mediastinal mass") ||
           (ccL.contains("absent breath sounds") && ccL.contains("chest")) { mergePool("thoracicSurgical") }
        if ccL.contains("colon cancer") || ccL.contains("colorectal cancer") ||
           ccL.contains("rectal cancer") || ccL.contains("pseudomyxoma") ||
           ccL.contains("lynch syndrome") || ccL.contains("hnpcc") ||
           ccL.contains("fit positive") ||
           (ccL.contains("rectal bleeding") && ccL.contains("weight loss")) { mergePool("colorectalMalignancy") }
        if ccL.contains("thyroid cancer") || ccL.contains("papillary thyroid") ||
           ccL.contains("follicular thyroid") || ccL.contains("hyperparathyroidism") ||
           ccL.contains("parathyroid") || ccL.contains("graves disease") ||
           ccL.contains("medullary thyroid") || ccL.contains("calcitonin") ||
           (ccL.contains("neck mass") && ccL.contains("thyroid")) { mergePool("endocrineSurgical") }
        if (ccL.contains("splenic") && ccL.contains("injury")) ||
           ccL.contains("haemoperitoneum") || ccL.contains("hepatic laceration") ||
           ccL.contains("hollow viscus") || ccL.contains("seat belt sign") ||
           ccL.contains("damage control") ||
           (ccL.contains("blunt") && ccL.contains("abdominal")) { mergePool("abdominalTrauma") }
        if ccL.contains("anastomotic leak") || ccL.contains("anastomotic") ||
           ccL.contains("bile leak") || ccL.contains("pancreatic fistula") ||
           ccL.contains("burst abdomen") || ccL.contains("wound dehiscence") ||
           (ccL.contains("post") && ccL.contains("operative") && ccL.contains("fever")) ||
           (ccL.contains("drain") && ccL.contains("bile")) { mergePool("postOpComplications") }
        if ccL.contains("melanoma") || ccL.contains("basal cell") ||
           ccL.contains("gist") || ccL.contains("desmoid") ||
           ccL.contains("retroperitoneal sarcoma") || ccL.contains("merkel cell") ||
           ccL.contains("soft tissue sarcoma") || ccL.contains("lipoma") ||
           (ccL.contains("skin") && ccL.contains("lesion")) { mergePool("softTissueTumours") }
        if (ccL.contains("stoma") && (ccL.contains("problem") || ccL.contains("complication"))) ||
           ccL.contains("parastomal") || ccL.contains("peristomal") ||
           ccL.contains("stoma prolapse") || ccL.contains("high output stoma") { mergePool("stomaComplications") }
        if ccL.contains("bariatric") || ccL.contains("sleeve gastrectomy") ||
           ccL.contains("gastric bypass") || ccL.contains("rygb") ||
           ccL.contains("marginal ulcer") || ccL.contains("dumping syndrome") ||
           ccL.contains("petersen defect") { mergePool("bariatricSurgical") }
        if ccL.contains("small bowel obstruction") || ccL.contains("large bowel obstruction") ||
           ccL.contains("sigmoid volvulus") || ccL.contains("caecal volvulus") ||
           ccL.contains("gallstone ileus") || ccL.contains("intussusception") ||
           ccL.contains("ogilvie") ||
           (ccL.contains("bowel obstruction") && ccL.contains("adhesion")) { mergePool("intestinalObstruction") }
        if ccL.contains("mesenteric ischaemia") || ccL.contains("ischaemic colitis") ||
           ccL.contains("portal vein thrombosis") || ccL.contains("angiodysplasia") ||
           ccL.contains("nomi") || ccL.contains("splenic artery aneurysm") ||
           (ccL.contains("postprandial") && ccL.contains("weight loss")) { mergePool("mesentericVascular") }
        if ccL.contains("post-ercp") || ccL.contains("ercp complication") ||
           ccL.contains("biliary stent") || ccL.contains("stent occlusion") ||
           ccL.contains("post-polypectomy") ||
           ccL.contains("colonoscopy perforation") { mergePool("surgicalEndoscopyComplications") }
        if ccL.contains("abdominal compartment") ||
           ccL.contains("intra-abdominal hypertension") ||
           ccL.contains("open abdomen") || ccL.contains("enterocutaneous fistula") ||
           ccL.contains("rectus sheath haematoma") { mergePool("abdominalCompartmentSyndrome") }
        if ccL.contains("pressure ulcer") || ccL.contains("venous ulcer") ||
           ccL.contains("pilonidal") || ccL.contains("wound vac") ||
           ccL.contains("skin graft") ||
           (ccL.contains("non-healing") && ccL.contains("wound")) { mergePool("chronicWoundManagement") }
        if ccL.contains("sbp") || ccL.contains("hepatic encephalopathy") ||
           ccL.contains("hepatorenal") || ccL.contains("variceal bleeding") ||
           ccL.contains("aclf") || ccL.contains("hepatic hydrothorax") ||
           (ccL.contains("cirrhosis") && ccL.contains("ascites")) { mergePool("liverCirrhosisComplications") }
        if ccL.contains("adenoma") || ccL.contains("colorectal polyp") ||
           ccL.contains("diverticulitis") || ccL.contains("colonoscopy surveillance") ||
           (ccL.contains("polyp") && ccL.contains("colonoscopy")) { mergePool("colonoscopyPathology") }
        if ccL.contains("mods") || ccL.contains("ards") || ccL.contains("c. diff") ||
           ccL.contains("stress ulcer") ||
           (ccL.contains("icu") && ccL.contains("surgical")) { mergePool("criticalCareSurgical") }
        if ccL.contains("surgical site infection") || ccL.contains("wound infection") ||
           ccL.contains("infected mesh") || ccL.contains("fournier") ||
           (ccL.contains("wound") && ccL.contains("purulent")) { mergePool("surgicalSiteInfection") }
        if ccL.contains("thyroid nodule") || ccL.contains("goitre") ||
           ccL.contains("bethesda") || ccL.contains("de quervain") ||
           (ccL.contains("neck mass") && ccL.contains("thyroid")) { mergePool("thyroidNoduleAssessment") }
        if ccL.contains("carotid") || ccL.contains("amaurosis fugax") ||
           ccL.contains("renal artery stenosis") || ccL.contains("leriche") ||
           ccL.contains("visceral aneurysm") { mergePool("carotidEndovascular") }
        if ccL.contains("bronchopleural") || ccL.contains("chylothorax") ||
           ccL.contains("post-thoracotomy") || ccL.contains("empyema") ||
           (ccL.contains("air leak") && ccL.contains("chest")) { mergePool("postThoracotomyComplications") }
        if ccL.contains("haemorrhoids") || ccL.contains("anal fissure") ||
           ccL.contains("perianal abscess") || ccL.contains("pilonidal") ||
           ccL.contains("rectal prolapse") || ccL.contains("faecal incontinence") { mergePool("anorectalFunctional") }
        if ccL.contains("incisional hernia") || ccL.contains("parastomal hernia") ||
           ccL.contains("diastasis recti") || ccL.contains("obturator hernia") { mergePool("abdominalWallDefects") }
        if ccL.contains("inguinal hernia") || ccL.contains("femoral hernia") ||
           ccL.contains("groin pain") || ccL.contains("hydrocele") ||
           ccL.contains("varicocele") || ccL.contains("sports hernia") { mergePool("groinSportsHernia") }
        if ccL.contains("haematuria") || ccL.contains("renal colic") ||
           ccL.contains("kidney stone") || ccL.contains("ureteric colic") ||
           ccL.contains("testicular torsion") || ccL.contains("prostate") { mergePool("renalUrolithiasis") }
        if ccL.contains("carcinoid") || ccL.contains("neuroendocrine") ||
           ccL.contains("gist") || ccL.contains("gi lymphoma") ||
           ccL.contains("malt lymphoma") || ccL.contains("desmoid") { mergePool("primaryGILymphoma") }
        if ccL.contains("crohn") || ccL.contains("ulcerative colitis") ||
           ccL.contains("toxic megacolon") || ccL.contains("short bowel") ||
           ccL.contains("microscopic colitis") ||
           (ccL.contains("colitis") && ccL.contains("bloody")) { mergePool("inflammatoryBowelDisease") }
        if ccL.contains("ovarian torsion") || ccL.contains("ectopic pregnancy") ||
           ccL.contains("pelvic inflammatory") || ccL.contains("endometriosis") ||
           ccL.contains("ovarian cancer") || ccL.contains("bartholin") ||
           (ccL.contains("adnexal") && ccL.contains("mass")) { mergePool("gynaecologicalSurgical") }
        if ccL.contains("acs") || ccL.contains("stemi") || ccL.contains("nstemi") ||
           ccL.contains("aortic dissection") || ccL.contains("cardiac tamponade") ||
           ccL.contains("endocarditis") || ccL.contains("heart failure") ||
           ccL.contains("hocm") || ccL.contains("mediastinitis") { mergePool("cardiacSurgical") }
        if ccL.contains("hyperparathyroidism") || ccL.contains("hypercalcaemia") ||
           ccL.contains("phaeochromocytoma") || ccL.contains("conn's") ||
           ccL.contains("cushing") || ccL.contains("adrenal mass") ||
           ccL.contains("men1") { mergePool("parathyroidAdrenal") }
        if ccL.contains("splenomegaly") || ccL.contains("splenic rupture") ||
           ccL.contains("haemophilia") || ccL.contains("itp") ||
           ccL.contains("spherocytosis") || ccL.contains("myelofibrosis") ||
           ccL.contains("splenic vein") { mergePool("haematologicalSurgical") }
        if ccL.contains("transplant rejection") || ccL.contains("post-transplant") ||
           ccL.contains("hepatic artery thrombosis") || ccL.contains("ptld") ||
           ccL.contains("tacrolimus") || ccL.contains("cyclosporine") { mergePool("transplantSurgery") }
        if ccL.contains("bariatric") || ccL.contains("rygb") || ccL.contains("sleeve gastrectomy") ||
           ccL.contains("dumping syndrome") || ccL.contains("marginal ulcer") ||
           ccL.contains("internal hernia") { mergePool("bariatricMetabolic") }
        if ccL.contains("diabetic foot") || ccL.contains("venous ulcer") ||
           ccL.contains("pressure ulcer") || ccL.contains("calciphylaxis") ||
           ccL.contains("pyoderma gangrenosum") || ccL.contains("hidradenitis") ||
           ccL.contains("keloid") { mergePool("chronicWoundCare") }
        if ccL.contains("cauda equina") || ccL.contains("disc herniation") ||
           ccL.contains("cervical myelopathy") || ccL.contains("spinal stenosis") ||
           ccL.contains("epidural abscess") || ccL.contains("vertebral osteomyelitis") ||
           ccL.contains("neurogenic claudication") || ccL.contains("saddle anaesthesia") { mergePool("spinalNeurosurgical") }
        // Secondary merges: investigation-first overlays (complaint + investigations, evL)
        if evL.contains("afp") || evL.contains("liver lesion") || evL.contains("hepatic mass") ||
           evL.contains("hcc") || evL.contains("hepatocellular") { mergePool("hepatobiliaryMalignancy") }
        if evL.contains("ca19-9") || evL.contains("pancreatic cyst") || evL.contains("ipmn") ||
           evL.contains("pancreatic mass") { mergePool("pancreaticSurgical") }
        if evL.contains("cea") || evL.contains("positive fit") || evL.contains("fit positive") ||
           evL.contains("colonic mass") || evL.contains("colonoscopy finding") { mergePool("colorectalMalignancy") }
        if evL.contains("ca-125") || evL.contains("ca125") || evL.contains("adnexal mass") ||
           evL.contains("ovarian cyst") || evL.contains("ovarian mass") { mergePool("gynaecologicalSurgical") }
        if evL.contains("psa elevated") || evL.contains("elevated psa") || evL.contains("pirads") ||
           evL.contains("renal mass") || evL.contains("renal lesion") || evL.contains("bladder mass") { mergePool("urologicalSurgical") }
        if evL.contains("adrenal mass") || evL.contains("adrenal lesion") || evL.contains("adrenal incidentaloma") ||
           evL.contains("metanephrine") || evL.contains("aldosterone renin") { mergePool("parathyroidAdrenal") }
        if evL.contains("bethesda") || evL.contains("tirads") || evL.contains("thyroid nodule") ||
           evL.contains("calcitonin elevated") || evL.contains("fnac") { mergePool("thyroidNoduleAssessment") }
        if evL.contains("lung nodule") || evL.contains("pulmonary nodule") ||
           evL.contains("lung lesion") || evL.contains("lung mass") { mergePool("thoracicSurgical") }
        if evL.contains("abnormal lfts") || evL.contains("deranged lfts") || evL.contains("elevated bilirubin") ||
           evL.contains("elevated alt") || evL.contains("elevated ast") { mergePool("jaundice") }
        if (evL.contains("iron deficiency") || evL.contains("ida ") || evL.contains("microcytic anaemia")) &&
           !evL.contains("menorrhagia") { mergePool("colorectalMalignancy") }
        // Lab-finding-driven secondary merges. evL is the complaint plus the investigation
        // names and resulted reports (negation-aware), so these fire when a resulted
        // investigation names the finding; they add pools and never replace the route.
        if evL.contains("troponin") { mergePool("chestPain"); mergePool("arrhythmia") }
        if evL.contains("d-dimer") || evL.contains("ddimer") || evL.contains("d dimer") {
            mergePool("venousThromboEmbolism")
        }
        if evL.contains("amylase") || evL.contains("lipase") { mergePool("acutePancreatitis") }
        if evL.contains("lactate") {
            mergePool("sepsisConditions"); mergePool("mesentericVascular")
        }
        if evL.contains("bnp") || evL.contains("pro-bnp") || evL.contains("nt-pro") ||
           evL.contains("brain natriuretic") { mergePool("cardiacFailure") }
        if evL.contains("hypercalcaemia") ||
           (evL.contains("calcium") && (evL.contains("elevated") || evL.contains("raised") || evL.contains("high"))) {
            mergePool("adrenalEndocrine"); mergePool("oncologyComplications")
        }
        if evL.contains("raised inr") || evL.contains("elevated inr") ||
           (evL.contains("inr") && (evL.contains("elevated") || evL.contains("raised") || evL.contains("high"))) {
            mergePool("coagulationDisorder")
        }
        if evL.contains("raised crp") || evL.contains("elevated crp") ||
           (evL.contains("crp") && (evL.contains("elevated") || evL.contains("raised") || evL.contains("high"))) {
            if !candidates.isEmpty { /* crp is non-specific — enrich existing pool only, no redirect */ }
        }

        // Matrix cross-query: ICD-11 polyhierarchy overlay.
        // Surfaces diseases that belong to the systems implied by this CC but
        // were not in the primary pool dispatch — e.g. a patient presenting with
        // "chest pain" gets cardiovascular AND respiratory candidates including
        // those tagged to both systems (PE, cardiac tamponade, etc.).
        // specialtyHint narrows the result to a specialty context (e.g. a CC
        // selected from the Cardiology block filters to cardiology diseases only).
        // Limited to 12 novel entries to keep the candidate list manageable.
        //
        // Condition-neutral safety net (DiagnosticDatabase.json "presentations"): the curated
        // common and dangerous causes of this complaint from every specialty (medical,
        // surgical, obstetric, paediatric) go first and replace same-named and superseded
        // legacy pool entries, so a complaint never depends on one specialty pool.
        // matrixOnlyWithoutPresentation: when a presentation matched, its curated candidates
        // already span the systems, so the matrix's unreviewed system-wide extras are skipped;
        // the matrix still widens complaints that match no presentation.
        let core = presentationCandidates(for: ccL)
        if core.candidates.isEmpty {
            let matrixExtra = matrixCandidates(forCC: ccL.text, specialtyHint: specialtyHint)
            let matrixNovel = matrixExtra.filter { seenNames.insert($0.name).inserted }
            candidates.append(contentsOf: matrixNovel.prefix(12))
        } else {
            let coreNames = Set(core.candidates.map(\.name))
            candidates = core.candidates + candidates.filter {
                !coreNames.contains($0.name) && !core.supersedes.contains($0.name)
            }
            seenNames.formUnion(coreNames)
        }

        // Canonical curated content: a legacy pool entry that has a curated equivalent (same
        // name, or listed under the curated candidate's "supersedes") is replaced by the
        // curated version, once, whatever route or merge brought it in.
        var canonicalNames = Set<String>()
        candidates = candidates.compactMap { c in
            let canonical = curatedReplacements[c.name]?.toCandidate() ?? c
            return canonicalNames.insert(canonical.name).inserted ? canonical : nil
        }

        // Demographic applicability (DiagnosticDatabase.json "applicability"): no ectopic
        // pregnancy for a man, no pre-eclampsia unless pregnancy or the puerperium is recorded,
        // no testicular torsion for a woman. Unknown age (0) or unspecified sex never filters.
        let pregnancy = PregnancyStatus.from(
            texts: [baseCC, hpi ?? "", pmhNotes ?? "", examAbdo ?? "", examGeneral ?? "", examOther ?? ""] + investigationLines,
            surgicalHistory: surgicalHistory ?? "")
        candidates = candidates.filter {
            $0.applicability?.applies(ageYears: ageYears, sex: sex, pregnancy: pregnancy) ?? true
        }

        // Cap total candidates at 60 (raised from 45 for the presentation safety net; curated
        // candidates come first so the cap only trims pool and matrix extras).
        if candidates.count > 60 { candidates = Array(candidates.prefix(60)) }

        // Merge longitudinal context into scoring inputs.
        // Confirmed past diagnoses are appended to pmh so existing "pmh" feature
        // keys fire naturally (e.g. a past "Cholelithiasis" feeds the gallstone
        // features in abdominalPain candidates).
        let mergedPMH = [pmhNotes ?? "", longitudinal.accumulatedPMH,
                         longitudinal.confirmedDiagnoses.joined(separator: " ")]
            .filter { !$0.isEmpty }.joined(separator: " ")
        let mergedPSHx = [surgicalHistory ?? "", longitudinal.accumulatedPSHx]
            .filter { !$0.isEmpty }.joined(separator: " ")
        let mergedInvestigations = investigations + longitudinal.cumulativeInvestigations

        // Build lab-derived association chips from resulted investigations.
        // Maps recognised lab abnormalities to standardised chip strings that
        // match the "associations" feature values in DiagnosticDatabase.json,
        // fulfilling the "investigations as chief complaints" directive:
        // lab findings now contribute Bayesian weight inside every selected pool.
        var labAssocChips: Set<String> = []
        for inv in mergedInvestigations where inv.status == .resulted {
            let name    = inv.name.lowercased()
            let result  = inv.result.lowercased()
            let combined = name + " " + result
            // Whole-word name matching (LabNameMatch): "Fasting glucose" is not AST, "Alpha
            // fetoprotein" is not ALP, "Lactate dehydrogenase" is not lactate, "HBsAg" is not Hb.
            let nameWords = LabNameMatch.words(of: inv.name)
            func named(_ keywords: String...) -> Bool { LabNameMatch.matchesAny(nameWords, keywords) }
            let isHigh  = combined.contains("elevated") || combined.contains("raised") ||
                          combined.contains(" high") || result.hasPrefix("high") ||
                          combined.contains(">") || combined.contains("abnormal")
            let isLow   = combined.contains(" low") || result.hasPrefix("low") ||
                          combined.contains("decreased") || combined.contains("deficient") ||
                          combined.contains("<")

            if named("wbc", "white cell", "leukocyte", "leucocyte", "neutrophil", "white blood cell") {
                if isHigh { labAssocChips.insert("raised wbc") }
                if isLow  { labAssocChips.insert("leukopenia") }
            }
            if named("crp", "c-reactive") {
                if isHigh { labAssocChips.insert("elevated crp") }
            }
            if named("lactate", "lactic acid") {
                if isHigh { labAssocChips.insert("elevated lactate") }
            }
            if named("troponin") {
                if isHigh { labAssocChips.insert("elevated troponin") }
            }
            if named("d-dimer", "ddimer") {
                if isHigh { labAssocChips.insert("elevated d-dimer") }
            }
            if named("alt", "ast", "alp", "ggt", "lft", "lfts", "liver function", "transaminase",
                     "alkaline phosphatase") {
                if isHigh { labAssocChips.insert("elevated liver enzymes") }
            }
            if named("bilirubin") {
                if isHigh { labAssocChips.insert("raised bilirubin") }
            }
            if named("inr") || (named("prothrombin") && nameWords.contains("time")) {
                if isHigh { labAssocChips.insert("raised inr") }
            }
            if named("creatinine", "egfr", "urea", "bun", "renal function") {
                if isHigh || (named("egfr") && isLow) {
                    labAssocChips.insert("renal impairment")
                }
            }
            if named("calcium") {
                if isHigh { labAssocChips.insert("hypercalcaemia") }
            }
            if named("esr", "erythrocyte sedimentation") {
                if isHigh { labAssocChips.insert("elevated esr") }
            }
            if named("amylase") {
                if isHigh { labAssocChips.insert("elevated amylase") }
            }
            if named("lipase") {
                if isHigh { labAssocChips.insert("elevated lipase") }
            }
            if named("glucose", "blood sugar", "bgl") {
                if isHigh { labAssocChips.insert("elevated glucose") }
            }
            if named("ldh", "lactate dehydrogenase") {
                if isHigh { labAssocChips.insert("elevated ldh") }
            }
            if named("haemoglobin", "hemoglobin", "hgb", "hb") ||
               (named("fbc") && result.contains("anaemi")) {
                if isLow { labAssocChips.insert("Anaemia symptoms") }
            }
        }
        // Numeric results ("Potassium: 7.2 mmol/L") carry no words such as "raised", so the
        // loop above misses them: LabPanel reads the most recent value of each analyte and
        // numericLabChips turns it into the same chips (thresholds in the helper).
        labAssocChips.formUnion(numericLabChips(LabPanel.parse(from: mergedInvestigations)))

        // Measured vital signs → association chips so that BDE features keyed to
        // "associations" fire from objective observations, not only manual SOCRATES entry.
        // Heart rate, respiratory rate and blood pressure are judged against age-appropriate
        // limits (VitalLimits: APLS 7th edition bands for children), not adult ones.
        let limits = VitalLimits.forAge(ageYears)
        var vitalsChips: Set<String> = []
        if let hr = latestHR {
            if hr > limits.maxHeartRate { vitalsChips.insert("tachycardia") }
            if hr < limits.minHeartRate { vitalsChips.insert("bradycardia") }
        }
        if let sbp = latestSBP, sbp < limits.minSystolic { vitalsChips.insert("hypotension") }
        if let temp = latestTemp {
            if temp >= 38.0 { vitalsChips.insert("fever") }
            if temp < 36.0  { vitalsChips.insert("hypothermia") }
        }
        if let spo2 = latestSpO2, spo2 < 94 { vitalsChips.insert("oxygen desaturation") }
        if let rr = latestRR, rr > limits.maxRespiratoryRate { vitalsChips.insert("tachypnoea") }

        // Merge lab chips + vitals chips into socratesSelections["associations"] so that every
        // DiagnosticDatabase.json "associations" feature fires from objective measurements.
        let allAssocChips = labAssocChips.union(vitalsChips)
        var enrichedSocrates = socratesSelections
        if !allAssocChips.isEmpty {
            var assocSet = enrichedSocrates["associations"] ?? Set<String>()
            assocSet.formUnion(allAssocChips)
            enrichedSocrates["associations"] = assocSet
        }

        // Evidence-exam (DiagnosticDatabase.json 2.2.0): the Exam-step sign chips (lines in
        // examOther, ExamSignRecord) and the stored decision-rule results (DecisionRuleEvidence).
        // The free text is scored without the lines of signs that carry their own likelihood
        // ratios, so each sign counts once.
        let examSignStates = ExamSignRecord.states(in: examOther)
        let examOtherText = ExamSignRecord.strippingEngineSignLines(examOther ?? "")
        var ruleValues: [String: Double] = [:]
        if let v = alvaradoScore { ruleValues["alvarado"] = Double(v) }
        if let v = airScore { ruleValues["air"] = Double(v) }
        if let v = wellsPEScore { ruleValues["wells-pe"] = v }
        if let v = percViolations { ruleValues["perc"] = Double(v) }
        if let v = wellsDVTScore { ruleValues["wells-dvt"] = v }
        if let v = heartScore { ruleValues["heart"] = Double(v) }
        if let v = centorScore { ruleValues["centor"] = Double(v) }
        if let v = lrinecScore { ruleValues["lrinec"] = Double(v) }
        if let v = stoneUretericScore { ruleValues["stone"] = Double(v) }
        if let v = ottawaAnkleScore { ruleValues["ottawa-ankle"] = Double(v) }
        if let v = ottawaKneeScore { ruleValues["ottawa-knee"] = Double(v) }
        if let v = canadianCTHeadScore { ruleValues["canadian-ct-head"] = Double(v) }
        if let v = nexusScore { ruleValues["nexus"] = Double(v) }
        if let v = canadianCSpineScore { ruleValues["canadian-c-spine"] = Double(v) }
        // Prognostic: observedBands leaves them out (they never change the differential).
        if let v = sfSyncopeScore { ruleValues["sf-syncope"] = Double(v) }
        if let v = canadianSyncopeScore { ruleValues["canadian-syncope"] = Double(v) }
        let ruleBands: Set<String> = DecisionRuleEvidence.replacesLegacyAdjustments
            ? DecisionRuleEvidence.observedBands(ruleValues) : []
        let legacyRules = !DecisionRuleEvidence.replacesLegacyAdjustments

        var scored = score(
            candidates: candidates,
            socrates: enrichedSocrates,
            pmh: mergedPMH,
            pshx: mergedPSHx,
            examAbdo: examAbdo ?? "",
            examGeneral: examGeneral ?? "",
            examCVS: examCVS ?? "",
            examResp: examResp ?? "",
            examNeuro: examNeuro ?? "",
            examMSK: examMSK ?? "",
            examSkin: examSkin ?? "",
            examOther: examOtherText,
            investigations: mergedInvestigations,
            age: ageYears,
            sex: sex,
            medications: medications,
            socialText: socialHistoryText ?? "",
            bmi: bmi,
            complaint: baseCC,
            hpi: hpi ?? "",
            examSigns: examSignStates,
            ruleBands: ruleBands
        )

        // Evidence from resulted reports (DiagnosticDatabase.json 2.1.0): a curated diagnosis that
        // the complaint's route did not bring in joins the list when one of its strong features
        // (logLR ≥ reportEvidenceMinLogLR, a likelihood ratio of about 10) is in a resulted report
        // or an evidence chip — "CT: acute necrotising pancreatitis" when the complaint is
        // breathlessness on day 3 of the admission. The history alone never adds one: a past
        // diagnosis in the PMH does not. The candidate cap does not apply to these.
        let listedNames = Set(scored.map(\.candidate.name))
        let unlisted = (externalDatabase?.pools[corePoolName]?.candidates ?? [])
            .map { $0.toCandidate() }
            .filter { c in
                !listedNames.contains(c.name)
                    && (c.applicability?.applies(ageYears: ageYears, sex: sex, pregnancy: pregnancy) ?? true)
            }
        if !unlisted.isEmpty {
            let fromReports = score(
                candidates: unlisted,
                socrates: enrichedSocrates,
                pmh: mergedPMH,
                pshx: mergedPSHx,
                examAbdo: examAbdo ?? "",
                examGeneral: examGeneral ?? "",
                examCVS: examCVS ?? "",
                examResp: examResp ?? "",
                examNeuro: examNeuro ?? "",
                examMSK: examMSK ?? "",
                examSkin: examSkin ?? "",
                examOther: examOtherText,
                investigations: mergedInvestigations,
                age: ageYears,
                sex: sex,
                medications: medications,
                socialText: socialHistoryText ?? "",
                bmi: bmi,
                complaint: baseCC,
                hpi: hpi ?? "",
                examSigns: examSignStates,
                ruleBands: ruleBands
            ).filter(\.reportEvidence)
            scored.append(contentsOf: fromReports)
        }

        // Urgency label. Urgency no longer adds to the log-posterior (it used to add
        // urgency × 8, up to +24 ≈ a likelihood ratio of 120, which ranked every critical
        // diagnosis above better-supported ones and made the list follow urgency rather than
        // evidence). "Do not miss" visibility now comes from the reserved places in
        // topResults (dontMissSlots): ranks 1–3 are the most probable diagnoses and ranks
        // 4–5 the most probable emergency / critical ones not already listed.
        let urgencyLabels = ["", "Urgent — same-day assessment required",
                             "Emergency — immediate evaluation required",
                             "CRITICAL — potentially life-threatening; do not miss"]
        for i in scored.indices where scored[i].candidate.urgency > 0 {
            let u = scored[i].candidate.urgency
            let label = urgencyLabels[min(u, 3)]
            scored[i].evidence.insert(label, at: 0)
            scored[i].evidenceSources["score", default: []].insert(label, at: 0)
        }

        // Confirmed prior diagnoses boost the matching candidate's prior by 20 log
        // units — equivalent to a strong positive finding — so follow-up encounters
        // for a known disease don't start from scratch.
        if !longitudinal.confirmedDiagnoses.isEmpty {
            let confirmedL = longitudinal.confirmedDiagnoses.map { $0.lowercased() }
            for i in scored.indices {
                let nameL = scored[i].candidate.name.lowercased()
                if confirmedL.contains(where: { nameL.contains($0) || $0.contains(nameL) }) {
                    scored[i].logPosterior += 20
                    scored[i].evidence.insert("Previously confirmed diagnosis", at: 0)
                    scored[i].evidenceSources["longitudinal", default: []].insert("Previously confirmed", at: 0)
                }
            }
        }

        // Alvarado score feedback: adjust appendicitis log-posterior based on
        // a computed Alvarado score (0–10) entered in the Clinical Scores tab.
        // This is the POC for clinical score → Bayesian engine integration.
        if legacyRules, let alv = alvaradoScore {
            let adj: Int
            let label: String
            switch alv {
            case 7...10: adj = 18; label = "Alvarado \(alv)/10 — high probability"
            case 5...6:  adj = 8;  label = "Alvarado \(alv)/10 — compatible"
            case 4:      adj = 2;  label = "Alvarado \(alv)/10 — borderline"
            default:     adj = -8; label = "Alvarado \(alv)/10 — low probability"
            }
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("appendicitis") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // Glasgow / Ranson → pancreatitis severity adjustment
        // Both scores measure severity of acute pancreatitis; ≥3 = severe.
        // Take the higher of the two to avoid double-penalising mild cases.
        let pancreatitisAdj: (Int, String)? = {
            func grade(_ val: Int, system: String) -> (Int, String) {
                switch val {
                case 3...: return (16, "\(system) \(val) — severe pancreatitis")
                case 2:    return (8,  "\(system) \(val) — moderate pancreatitis")
                default:   return (-4, "\(system) \(val) — mild pancreatitis")
                }
            }
            if let g = glasgowPancreatitisScore, let r = ransonScore {
                let gPair = grade(g, system: "Glasgow"); let rPair = grade(r, system: "Ranson")
                return gPair.0 >= rPair.0 ? gPair : rPair
            }
            if let g = glasgowPancreatitisScore { return grade(g, system: "Glasgow") }
            if let r = ransonScore              { return grade(r, system: "Ranson") }
            return nil
        }()
        if let (adj, label) = pancreatitisAdj {
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("pancreatitis") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // Tokyo Grade → cholecystitis / cholangitis adjustment
        // Grade I (mild) → conservative management likely; Grade III (severe) → urgent intervention.
        func tokyoAdj(_ grade: Int) -> (Int, String) {
            switch grade {
            case 3: return (16, "Tokyo Grade III — severe, urgent intervention")
            case 2: return (8,  "Tokyo Grade II — moderate severity")
            default: return (-4, "Tokyo Grade I — mild")
            }
        }
        if let g = tokyoCholecystitisGrade {
            let (adj, label) = tokyoAdj(g)
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("cholecystitis") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }
        if let g = tokyoCholangitisGrade {
            let (adj, label) = tokyoAdj(g)
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("cholangitis") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // Rockall / Blatchford → UGI bleed candidate weighting
        // Rockall ≥5 = high rebleed mortality; Blatchford ≥6 = needs inpatient endoscopy.
        if let rk = rockallScore {
            let (adj, label): (Int, String) = switch rk {
            case 8...: (18, "Rockall \(rk) — very high risk UGI bleed")
            case 5...: (12, "Rockall \(rk) — high risk UGI bleed")
            case 3...: (6,  "Rockall \(rk) — intermediate risk")
            default:   (-4, "Rockall \(rk) — low risk")
            }
            let ugiTargets = ["peptic ulcer", "varices", "mallory", "dieulafoy", "malignancy bleed"]
            for i in scored.indices where ugiTargets.contains(where: { scored[i].candidate.name.lowercased().contains($0) }) {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }
        if let bf = blatchfordScore {
            let (adj, label): (Int, String) = switch bf {
            case 12...: (16, "Blatchford \(bf) — very high risk, admit + OGD")
            case 6...:  (10, "Blatchford \(bf) — high risk, endoscopy required")
            default:    (-4, "Blatchford \(bf) — possible outpatient management")
            }
            let ugiTargets = ["peptic ulcer", "varices", "mallory", "dieulafoy", "malignancy bleed"]
            for i in scored.indices where ugiTargets.contains(where: { scored[i].candidate.name.lowercased().contains($0) }) {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // Wells DVT → DVT candidates
        if legacyRules, let dvt = wellsDVTScore {
            let (adj, label): (Int, String) = dvt >= 3 ? (16, "Wells DVT \(Int(dvt)) — high probability (~53%)")
                                              : dvt >= 1 ? (8, "Wells DVT \(Int(dvt)) — moderate probability (~17%)")
                                              : (-6, "Wells DVT \(Int(dvt)) — low probability (~5%)")
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("deep vein") ||
                                          scored[i].candidate.name.lowercased().contains("dvt") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // Wells PE → PE candidates
        if legacyRules, let pe = wellsPEScore {
            let (adj, label): (Int, String) = pe >= 7 ? (16, "Wells PE \(pe) — high probability (~41%)")
                                              : pe >= 5 ? (10, "Wells PE \(pe) — moderate probability (~16%)")
                                              : (-6, "Wells PE \(pe) — low probability (~3%)")
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("pulmonary embol") ||
                                          scored[i].candidate.name.lowercased().contains(" pe ") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // ABCD² → TIA/stroke candidates
        if let abcd = abcd2Score {
            let (adj, label): (Int, String) = abcd >= 6 ? (16, "ABCD² \(abcd)/7 — high 2-day stroke risk (~8%)")
                                              : abcd >= 4 ? (10, "ABCD² \(abcd)/7 — moderate risk (~4%)")
                                              : (-4, "ABCD² \(abcd)/7 — lower risk (~1%)")
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("tia") ||
                                          scored[i].candidate.name.lowercased().contains("transient") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // LRINEC → necrotising soft tissue infection candidates
        if legacyRules, let lr = lrinecScore {
            let (adj, label): (Int, String) = lr >= 8 ? (18, "LRINEC \(lr) — high risk necrotising fasciitis (PPV 93%)")
                                              : lr >= 6 ? (12, "LRINEC \(lr) — moderate risk (PPV 51%)")
                                              : (-4, "LRINEC \(lr) — low risk")
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("necrotis") ||
                                          scored[i].candidate.name.lowercased().contains("fasciitis") ||
                                          scored[i].candidate.name.lowercased().contains("fournier") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // qSOFA → sepsis candidates
        if let qs = qsofaScore {
            let (adj, label): (Int, String) = qs >= 2 ? (16, "qSOFA \(qs)/3 — high risk organ dysfunction (Sepsis-3)")
                                              : qs == 1 ? (6,  "qSOFA \(qs)/3 — monitor closely")
                                              : (-4, "qSOFA 0 — low risk")
            for i in scored.indices where scored[i].candidate.name.lowercased().contains("sepsis") ||
                                          scored[i].candidate.name.lowercased().contains("bacteraemia") {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // NEWS2 → physiological derangement (the shock / sepsis context). Fires when NEWS2 ≥ 5
        // (medium risk) or ≥ 7 (high risk). NEWS2 measures how ill the patient is, not the cause
        // (RCP 2017; Smith GB et al. Resuscitation 2013;84:465-70: NEWS predicts cardiac arrest,
        // unanticipated ICU admission and death within 24 h), so the adjustment follows the
        // candidate's urgency tier rather than its name: critical diagnoses (urgency ≥
        // news2FullShareUrgency) take all of it, emergency ones (one tier below) half, the rest
        // none. Before DiagnosticDatabase 2.1.0 a fixed list (sepsis, PE, pneumonia, ACS, heart
        // failure …) took all of it, so a shocked patient with a perforation, severe pancreatitis,
        // an anastomotic leak or a neck haematoma was listed behind pneumonia and ACS (clinical
        // validation, iOS run 36182660885).
        if let news2 = news2Score, news2 >= 5 {
            let (adj, label): (Int, String) = news2 >= 7
                ? (12, "NEWS2 \(news2) — high risk, consider critical care escalation")
                : (6,  "NEWS2 \(news2) — medium risk")
            for i in scored.indices {
                let urgency = scored[i].candidate.urgency
                let share = urgency >= Self.news2FullShareUrgency ? adj
                    : (urgency == Self.news2FullShareUrgency - 1 ? adj / 2 : 0)
                guard share > 0 else { continue }
                scored[i].logPosterior += share
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // PSI/PORT Class → pneumonia and aspiration severity
        // Class I/II (low) → outpatient; Class III (moderate) → short stay; IV–V (severe) → admit/ICU.
        if let psi = psiScore {
            let (adj, label): (Int, String) = switch psi {
            case 5:  (18, "PSI Class V — very severe pneumonia, ICU level care")
            case 4:  (12, "PSI Class IV — severe pneumonia, hospitalisation required")
            case 3:  (6,  "PSI Class III — moderate risk, consider short admission")
            default: (-4, "PSI Class I/II — low risk, outpatient management possible")
            }
            let pneumoniaTargets = ["pneumonia", "aspiration", "pleuritis", "empyema"]
            for i in scored.indices where pneumoniaTargets.contains(where: {
                scored[i].candidate.name.lowercased().contains($0)
            }) {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // Caprini VTE Risk Score → DVT and PE candidates
        // 0–1: Low; 2: Moderate; 3–4: High; ≥5: Very high (extended prophylaxis indicated).
        if let cap = capriniScore {
            let (adj, label): (Int, String) = switch cap {
            case 5...: (14, "Caprini \(cap) — very high VTE risk, extended prophylaxis indicated")
            case 3...: (10, "Caprini \(cap) — high VTE risk")
            case 2:    (6,  "Caprini \(cap) — moderate VTE risk")
            default:   (-4, "Caprini \(cap) — low VTE risk")
            }
            let vteTargets = ["deep vein", "dvt", "pulmonary embol", "venous thrombo"]
            for i in scored.indices where vteTargets.contains(where: {
                scored[i].candidate.name.lowercased().contains($0)
            }) {
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // BISAP Score → pancreatitis severity candidates
        // ≥3 signals severe/necrotising pancreatitis; scores of 0–2 suggest milder disease.
        if let bis = bisapScore {
            let pancreatitisTargets = ["pancreatitis", "pancreatic pseudocyst", "necrotis"]
            let necrotisTargets     = ["necrotis", "pseudocyst"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard pancreatitisTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let isNecrotising = necrotisTargets.contains(where: { nameLow.contains($0) })
                let (adj, label): (Int, String) = switch bis {
                case 5:    (isNecrotising ? 20 : 10,  "BISAP 5 — critical pancreatitis, ~22% mortality")
                case 4:    (isNecrotising ? 16 : 8,   "BISAP 4 — severe pancreatitis, ~12.7% mortality")
                case 3:    (isNecrotising ? 12 : 6,   "BISAP 3 — severe pancreatitis, ~5.3% mortality")
                case 2:    (isNecrotising ? -4 : 2,   "BISAP 2 — moderate severity, 1.6% mortality")
                default:   (isNecrotising ? -8 : -2,  "BISAP \(bis) — mild pancreatitis predicted")
                }
                scored[i].logPosterior += adj
                if adj > 0 {
                    scored[i].evidence.insert(label, at: 0)
                    scored[i].evidenceSources["score", default: []].insert(label, at: 0)
                }
            }
        }

        // AIMS65 Score → upper GI haemorrhage candidates
        // Predicts in-hospital mortality for UGIB; ≥3 = high risk (12.7%+).
        if let aims = aims65Score, aims > 0 {
            let ugiTargets = ["bleeding peptic", "peptic ulcer", "oesophageal varices",
                              "gastric", "gastro-oesophageal", "mallory", "haemorrhage", "hemorrhage"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard ugiTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch aims {
                case 4...: (16, "AIMS65 \(aims) — critical UGIB, mortality \(aims >= 5 ? "~24.5%" : "~18.7%")")
                case 3:    (12, "AIMS65 3 — high-risk UGIB, in-hospital mortality ~12.7%")
                case 2:    (8,  "AIMS65 2 — moderate UGIB risk, mortality ~4.3%")
                default:   (4,  "AIMS65 1 — low UGIB risk, mortality ~1.2%")
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // SOFA: boosts sepsis/organ-failure candidates; severity-graded adjustment
        if let sofa = sofaScore {
            let sepsisTargets  = ["sepsis", "bacteraemia", "septicaemia", "shock", "mods", "multi-organ",
                                   "toxic shock", "candidaemia", "fungal sepsis"]
            let criticalTargets = ["mods", "multi-organ", "ards", "organ dysfunction"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                let isSepsis   = sepsisTargets.contains(where:  { nameLow.contains($0) })
                let isCritical = criticalTargets.contains(where: { nameLow.contains($0) })
                guard isSepsis || isCritical else { continue }
                let (adj, label): (Int, String) = switch sofa {
                case 13...: (isCritical ? 22 : 16, "SOFA \(sofa) — critical organ failure, mortality >50%")
                case 10...12: (isCritical ? 18 : 12, "SOFA \(sofa) — severe organ failure, ~40–50% mortality")
                case 7...9:  (isCritical ? 12 : 8,  "SOFA \(sofa) — significant organ dysfunction, ~20% mortality")
                case 2...6:  (isCritical ? 6 : 4,   "SOFA \(sofa) — organ dysfunction; sepsis criteria met if infected")
                default:     (isCritical ? -4 : -2,  "SOFA \(sofa) — no significant organ dysfunction")
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // FIB-4: boosts liver fibrosis / cirrhosis candidates
        if let fib4 = fib4Score, fib4 > 0 {
            let liverTargets = ["cirrhosis", "fibrosis", "hepatitis", "nafld", "nash", "alcoholic hepat",
                                 "liver disease", "chronic liver", "fatty liver"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard liverTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch fib4 {
                case 2.67...: (14, String(format: "FIB-4 %.2f — significant fibrosis (F2–F4) likely", fib4))
                case 1.30...: (6,  String(format: "FIB-4 %.2f — indeterminate; fibrosis cannot be excluded", fib4))
                default:      (-4, String(format: "FIB-4 %.2f — low fibrosis risk (F0–F1)", fib4))
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // CURB-65: boosts pneumonia/pulmonary sepsis candidates; severity-graded
        if let curb = curb65Score {
            let pneumoniaTargets = ["pneumonia", "pulmonary sepsis", "pulmonary infection",
                                     "community-acquired", "atypical pneumonia", "legionella"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard pneumoniaTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch curb {
                case 4...: (16, "CURB-65 \(curb) — high severity CAP, ~27–29% 30-day mortality")
                case 3:    (12, "CURB-65 3 — high severity CAP, ~22% 30-day mortality; admit")
                case 2:    (8,  "CURB-65 2 — moderate CAP, ~9% mortality; consider admit")
                case 1:    (4,  "CURB-65 1 — low-moderate CAP, outpatient with monitoring")
                default:   (-2, "CURB-65 0 — low severity CAP, <3% mortality; outpatient")
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Padua: boosts VTE candidates when medical inpatient risk is high
        if let pad = paduaScore, pad >= 2 {
            let vteTargets = ["deep vein thrombosis", "pulmonary embolism", "dvt", "vte",
                               "venous thromboembolism", "thrombosis"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard vteTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch pad {
                case 6...: (14, "Padua \(pad) — very high VTE risk (multiple major risk factors)")
                case 4...5: (10, "Padua \(pad) — high VTE risk; LMWH prophylaxis indicated")
                default:    (4,  "Padua \(pad) — intermediate VTE risk; reassess daily")
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // APACHE II: boosts sepsis, critical illness, and pancreatitis when severity is high
        if let apache = apacheIIScore, apache >= 10 {
            let sepsisTargets = ["sepsis", "septic shock", "bacteraemia", "systemic infection",
                                  "pancreatitis", "peritonitis", "organ failure", "critical illness",
                                  "pneumonia", "pulmonary", "ards", "mesenteric ischaemia"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard sepsisTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch apache {
                case 25...: (18, "APACHE II \(apache) — critical: predicted mortality >55%")
                case 20...24: (14, "APACHE II \(apache) — very high severity: ~40% predicted mortality")
                case 15...19: (10, "APACHE II \(apache) — high severity: ~25% predicted mortality")
                default:      (5,  "APACHE II \(apache) — moderate severity: ~15% predicted mortality")
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // P-POSSUM: boosts surgical complication and sepsis candidates when operative mortality is high
        if let ppmx10 = ppossumMortPct10, ppmx10 >= 50 { // ≥5% predicted mortality
            let mortPct = Double(ppmx10) / 10.0
            let surgicalTargets = ["post-operative complication", "anastomotic leak", "surgical site infection",
                                    "wound dehiscence", "pulmonary embolism", "sepsis", "septic shock",
                                    "acute kidney injury", "myocardial infarction", "pneumonia", "ileus"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard surgicalTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch mortPct {
                case 30...: (12, String(format: "P-POSSUM predicted mortality %.1f%% — critical operative risk", mortPct))
                case 15..<30: (8, String(format: "P-POSSUM predicted mortality %.1f%% — high operative risk", mortPct))
                default:    (4, String(format: "P-POSSUM predicted mortality %.1f%% — moderate operative risk", mortPct))
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // MPI: boosts peritonitis, septic abdomen, and abdominal-sepsis candidates
        if let mpi = mpiScore, mpi >= 21 {
            let peritonitisTargets = ["peritonitis", "septic abdomen", "abdominal sepsis",
                                       "bowel perforation", "hollow viscus perforation", "anastomotic leak",
                                       "sepsis", "septic shock", "acute kidney injury", "ileus"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard peritonitisTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch mpi {
                case 30...: (14, "MPI ≥30 — high peritonitis severity (predicted mortality >60%)")
                case 21..<30: (8, "MPI 21–29 — intermediate peritonitis severity (~29% mortality)")
                default:    (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // NRS-2002: boosts malnutrition-related and post-operative complication candidates
        if let nrs = nrs2002Score, nrs >= 3 {
            let malnutritionTargets = ["malnutrition", "protein-energy malnutrition",
                                        "sarcopenia", "cachexia", "nutritional deficiency",
                                        "wound dehiscence", "surgical site infection",
                                        "anastomotic leak", "poor wound healing", "pressure ulcer"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard malnutritionTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch nrs {
                case 5...: (10, "NRS-2002 ≥5 — high nutritional risk; significantly elevated surgical complication risk")
                case 3..<5: (5, "NRS-2002 3–4 — nutritional risk; increased complication risk")
                default:   (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // CTSI: boosts pancreatitis and pancreatic necrosis candidates based on CT severity
        if let ctsi = ctsiScore, ctsi >= 4 {
            let pancreatitisTargets = ["pancreatitis", "pancreatic necrosis", "pancreatic abscess",
                                        "pseudocyst", "walled-off necrosis", "splenic vein thrombosis"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard pancreatitisTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch ctsi {
                case 7...: (14, "CTSI ≥7 — severe pancreatitis (mortality 17%+, complication rate >50%)")
                case 4..<7: (8, "CTSI 4–6 — moderate pancreatitis (~30–50% complication rate)")
                default:    (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Forrest: boosts upper GI bleed / peptic ulcer candidates based on endoscopic grade
        if let fg = forrestGrade {
            let giBleedTargets = ["peptic ulcer", "duodenal ulcer", "gastric ulcer",
                                   "upper gi bleed", "upper gastrointestinal bleed",
                                   "haematemesis", "hematemesis", "melena", "melaena",
                                   "mallory-weiss", "dieulafoy"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard giBleedTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch fg {
                case 1, 2: (14, "Forrest Ia/Ib — active bleeding; rebleed risk 55–90%; endoscopic therapy required")
                case 3:    (10, "Forrest IIa — visible vessel; rebleed risk 43%; endoscopic therapy recommended")
                case 4:    (7,  "Forrest IIb — adherent clot; rebleed risk 22%; high-risk stigmata")
                case 5:    (3,  "Forrest IIc — flat spot; rebleed risk 10%; lower-risk stigmata")
                default:   (0,  "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // TIMI: boosts ACS/UA/NSTEMI candidates based on risk score
        if let timi = timiScore, timi >= 3 {
            let acsTargets = ["acute coronary syndrome", "unstable angina", "nstemi",
                               "myocardial infarction", "angina", "ischaemic heart disease",
                               "coronary artery disease", "aortic stenosis"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard acsTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch timi {
                case 5...: (12, "TIMI ≥5 — high risk UA/NSTEMI (~26–40% 14-day MACE)")
                case 3..<5: (7, "TIMI 3–4 — intermediate risk UA/NSTEMI (~13–20% 14-day MACE)")
                default:   (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // CFS: frailty ≥5 boosts sarcopenia, malnutrition, delirium, deconditioning candidates
        if let cfs = cfsScore, cfs >= 5 {
            let frailtyTargets = ["sarcopenia", "frailty", "malnutrition", "protein-energy malnutrition",
                                   "delirium", "deconditioning", "falls", "dementia", "cognitive impairment",
                                   "pressure ulcer", "functional decline", "cachexia"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard frailtyTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch cfs {
                case 7...: (12, "CFS ≥7 — severe frailty; very high risk of functional decline and perioperative complications")
                case 5..<7: (6, "CFS 5–6 — frailty; elevated perioperative risk; geriatric review recommended")
                default:   (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Mallampati: boosts OSA and obesity hypoventilation when class 3–4 (crowded oropharynx)
        if let mc = mallampatiClass, mc >= 3 {
            let osaTargets = ["obstructive sleep apnoea", "obstructive sleep apnea",
                               "obesity hypoventilation", "osa", "sleep disordered breathing"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard osaTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let adj = mc >= 4 ? 8 : 5
                let label = "Mallampati class \(mc) — crowded oropharynx; elevated OSA risk"
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // HEART: boosts ACS/cardiac chest pain candidates based on risk stratification
        if legacyRules, let hs = heartScore, hs >= 4 {
            let acstargets = ["acute coronary syndrome", "unstable angina", "myocardial infarction",
                               "nstemi", "stemi", "angina", "aortic dissection",
                               "pulmonary embolism", "myocarditis", "cardiac chest pain"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard acstargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch hs {
                case 7...: (14, "HEART ≥7 — high MACE risk (~50–65%); early invasive strategy recommended")
                case 4..<7: (7, "HEART 4–6 — moderate MACE risk (~12–25%); observation and serial troponins")
                default:   (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Waterlow: boosts pressure ulcer, wound dehiscence, skin breakdown candidates
        if let wl = waterlowScore, wl >= 15 {
            let wlTargets = ["pressure ulcer", "pressure injury", "pressure sore", "decubitus",
                              "wound dehiscence", "skin breakdown", "skin integrity",
                              "venous ulcer", "diabetic foot ulcer", "leg ulcer"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard wlTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch wl {
                case 20...: (12, "Waterlow ≥20 — very high pressure ulcer risk; dynamic mattress + immediate TVN referral")
                case 15..<20: (7, "Waterlow 15–19 — high pressure ulcer risk; active prevention protocol + TVN review")
                default:   (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // GRACE: boosts ACS and cardiac-related candidates based on mortality risk score
        if let grace = graceScore, grace >= 109 {
            let graceTargets = ["acute coronary syndrome", "myocardial infarction", "nstemi", "stemi",
                                 "unstable angina", "cardiac chest pain", "aortic dissection",
                                 "pulmonary embolism", "cardiogenic shock", "heart failure"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard graceTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch grace {
                case 141...: (14, "GRACE >140 — high in-hospital ACS mortality; urgent cardiology involvement")
                case 109...140: (8, "GRACE 109–140 — moderate in-hospital ACS mortality (~1–3%); cardiac monitoring")
                default:   (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Surgical Apgar: low score boosts post-operative complication and organ failure candidates
        if let sas = surgicalApgarScore, sas <= 4 {
            let sasTargets = ["post-operative complication", "anastomotic leak", "wound dehiscence",
                               "surgical site infection", "sepsis", "organ failure", "pulmonary embolism",
                               "acute kidney injury", "haemorrhage", "ileus", "re-operation"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard sasTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch sas {
                case 0...2: (12, "Surgical Apgar ≤2 — very high risk of major complication or death (~56%)")
                case 3...4: (7,  "Surgical Apgar 3–4 — high risk of major post-operative complication (~27–43%)")
                default:   (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // DASI: poor functional capacity boosts perioperative risk and cardiorespiratory candidates
        if let dasi = dasiScore, dasi < 34 {
            let dasiTargets = ["heart failure", "coronary artery disease", "angina", "myocardial infarction",
                               "pulmonary hypertension", "chronic obstructive pulmonary disease", "cardiomyopathy",
                               "aortic stenosis", "peripheral arterial disease", "deconditioning",
                               "post-operative complication", "pulmonary embolism", "anaemia"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard dasiTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch dasi {
                case 0...20: (12, "DASI \(dasi) — severely poor functional capacity (<4 METs); markedly elevated perioperative cardiac risk")
                default:     (7,  "DASI \(dasi) — poor functional capacity (<4 METs); elevated perioperative cardiac risk")
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Barthel: severe dependency boosts conditions associated with functional impairment and rehabilitation need
        if let bi = barthelScore, bi <= 60 {
            let biTargets = ["stroke", "frailty", "deconditioning", "heart failure", "dementia",
                             "parkinson", "multiple sclerosis", "spinal cord", "hip fracture",
                             "post-operative complication", "delirium", "pressure ulcer", "fall"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard biTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch bi {
                case 0...20: (12, "Barthel ≤20 — severe ADL dependency; indicates major functional impairment")
                case 21...60: (6, "Barthel 21–60 — moderate ADL dependency; significant functional limitation")
                default: (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // EuroSCORE II: high predicted operative mortality boosts cardiac and perioperative risk candidates
        if let es = euroScoreII, es >= 20 { // ≥2.0% predicted mortality
            let esTargets = ["coronary artery disease", "aortic stenosis", "mitral regurgitation",
                              "aortic regurgitation", "heart failure", "cardiomyopathy",
                              "infective endocarditis", "aortic dissection", "thoracic aortic aneurysm",
                              "post-operative complication", "cardiac tamponade"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard esTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let pctTenths = es
                let (adj, label): (Int, String) = switch pctTenths {
                case 50...: (14, "EuroSCORE II ≥5% — high predicted operative mortality; major cardiac disease burden")
                case 20..<50: (8, "EuroSCORE II 2–5% — elevated operative mortality risk; significant cardiac pathology")
                default: (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // NIHSS: higher stroke severity boosts stroke/TIA and neurological candidates
        if let nihss = nihssScore, nihss >= 1 {
            let nihssTargets = ["ischaemic stroke", "hemorrhagic stroke", "tia", "transient ischaemic",
                                 "subarachnoid haemorrhage", "intracerebral haemorrhage",
                                 "cerebral venous sinus thrombosis", "cerebral abscess",
                                 "subdural haematoma", "epidural haematoma", "brain tumour",
                                 "hemiplegia", "hemiparesis", "aphasia", "dysarthria",
                                 "carotid artery disease", "vertebrobasilar insufficiency"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard nihssTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch nihss {
                case 16...: (12, "NIHSS ≥16 — moderate-severe/severe neurological deficit; major stroke until proven otherwise")
                case 5..<16: (7, "NIHSS 5–15 — moderate stroke deficit; significant neurological involvement")
                case 1..<5: (3, "NIHSS 1–4 — minor stroke deficit; neurological cause likely")
                default: (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // mRS: pre-existing disability boosts stroke, dementia, and neurodegenerative candidates
        if let mrs = mrsScore, mrs >= 2 {
            let mrsTargets = ["ischaemic stroke", "hemorrhagic stroke", "tia",
                               "subarachnoid haemorrhage", "cerebral venous sinus thrombosis",
                               "dementia", "vascular dementia", "parkinson", "multiple sclerosis",
                               "motor neurone disease", "spinal cord injury",
                               "hemiplegia", "hemiparesis", "frailty syndrome",
                               "post-stroke depression"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard mrsTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch mrs {
                case 4...: (10, "mRS ≥4 — severe pre-existing neurological disability; major neurological disease burden")
                case 3: (6, "mRS 3 — moderate disability requiring some help; significant neurological disease")
                case 2: (3, "mRS 2 — slight disability; some neurological disease likely")
                default: (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // MUST: high malnutrition risk boosts malnutrition, cachexia, GI malabsorption,
        // and chronic-disease candidates where nutritional depletion is a key feature
        if let must = mustScore, must >= 1 {
            let mustTargets = ["malnutrition", "cachexia", "anorexia nervosa", "bulimia",
                               "crohn", "ulcerative colitis", "coeliac", "short bowel",
                               "pancreatic exocrine insufficiency",
                               "gastric cancer", "oesophageal cancer", "colorectal cancer",
                               "liver failure", "chronic liver disease", "cirrhosis",
                               "chronic kidney disease", "end-stage renal disease",
                               "congestive heart failure", "copd", "chronic obstructive",
                               "inflammatory bowel", "protein-energy malnutrition",
                               "dysphagia", "swallowing difficulty",
                               "frailty syndrome", "sarcopaenia"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard mustTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let (adj, label): (Int, String) = switch must {
                case 2...: (9, "MUST ≥2 — high malnutrition risk; supports diagnoses with nutritional depletion as a key feature")
                case 1: (4, "MUST 1 — medium malnutrition risk; nutritional status warrants monitoring")
                default: (0, "")
                }
                guard adj > 0 else { continue }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Clavien-Dindo: grade ≥3 indicates a serious surgical complication requiring
        // procedural or intensive intervention — boosts post-op complication candidates
        if let cd = clavienDindoScore, cd >= 2 {
            let cdTargets = ["anastomotic leak", "anastomotic", "wound dehiscence",
                             "surgical site infection", "intra-abdominal abscess",
                             "post-operative haemorrhage", "haematoma",
                             "ileus", "post-operative ileus", "small bowel obstruction",
                             "bile leak", "biliary leak", "bile duct injury",
                             "pancreatic fistula", "duodenal stump leak",
                             "pulmonary embolism", "deep vein thrombosis",
                             "pneumonia", "urinary tract infection",
                             "post-operative sepsis", "sepsis", "septic shock",
                             "acute kidney injury", "acute renal failure",
                             "cardiac complications", "myocardial infarction",
                             "respiratory failure", "renal failure",
                             "multi-organ failure", "multi-organ dysfunction"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard cdTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let adj: Int
                let label: String
                switch cd {
                case 5...: adj = 12; label = "Clavien-Dindo ≥IVa — life-threatening complication; severe organ dysfunction strongly supports this diagnosis"
                case 4:    adj = 10; label = "Clavien-Dindo IIIb — return-to-theatre complication; major surgical complication"
                case 3:    adj = 8;  label = "Clavien-Dindo IIIa — procedural intervention required; significant surgical complication"
                default:   adj = 5;  label = "Clavien-Dindo II — pharmacological intervention; post-operative complication"
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Aldrete: low score (<7) in the post-operative setting boosts causes of
        // delayed awakening, respiratory compromise, and haemodynamic instability
        if let ald = aldreteScore, ald < 7 {
            let aldTargets = ["delayed emergence", "post-operative confusion",
                              "respiratory depression", "respiratory failure",
                              "airway obstruction", "laryngospasm", "bronchospasm",
                              "hypotension", "hypovolaemia", "vasovagal",
                              "opioid toxicity", "opiate overdose", "benzodiazepine",
                              "hypoxia", "hypoxaemia", "oxygen desaturation",
                              "hypothermia", "malignant hyperthermia",
                              "anaphylaxis", "anaphylactic shock",
                              "hypoglycaemia", "hyponatraemia",
                              "cardiac arrest", "arrhythmia", "atrial fibrillation",
                              "pulmonary oedema", "aspiration", "aspiration pneumonia"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard aldTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let adj: Int
                let label: String
                switch ald {
                case ..<4: adj = 10; label = "Aldrete <4/10 — severely impaired PACU recovery; immediate anaesthetic review required"
                case 4..<7: adj = 6; label = "Aldrete <7/10 — impaired PACU recovery; consider anaesthetic/systemic cause"
                default:    adj = 3; label = "Aldrete borderline — monitor for evolving complication in PACU"
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // 4T Score: intermediate/high HIT probability boosts HIT and related thrombotic candidates
        if let ft = fourTScore, ft >= 4 {
            let hitTargets = ["heparin-induced thrombocytopenia", "hit ",
                              "thrombocytopenia", "immune thrombocytopenia",
                              "deep vein thrombosis", "pulmonary embolism",
                              "arterial thrombosis", "limb ischaemia", "limb ischemia",
                              "cerebral venous thrombosis", "adrenal haemorrhage"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard hitTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let adj: Int
                let label: String
                switch ft {
                case 6...: adj = 14; label = "4T Score ≥6 — high HIT probability; strongly supports thrombocytopaenic/thrombotic aetiology"
                case 4:    adj = 8;  label = "4T Score 4–5 — intermediate HIT probability; consider HIT in differential"
                default:   adj = 8;  label = "4T Score 4–5 — intermediate HIT probability; consider HIT in differential"
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Oakland Score: high score boosts significant LGIB candidates
        if let oak = oaklandScore, oak >= 9 {
            let oakTargets = ["lower gastrointestinal bleed", "lower gi bleed",
                              "lower gastrointestinal haemorrhage",
                              "diverticular bleed", "diverticular haemorrhage",
                              "angiodysplasia", "haemorrhoid", "anal fissure",
                              "colorectal cancer", "rectal cancer", "colon cancer",
                              "ischaemic colitis", "ischemic colitis",
                              "inflammatory bowel", "crohn", "ulcerative colitis",
                              "rectal polyp", "mesenteric ischaemia"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard oakTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let adj: Int
                let label: String
                switch oak {
                case 15...: adj = 9; label = "Oakland ≥15 — high-risk LGIB; haemodynamically significant lower GI haemorrhage"
                default:    adj = 5; label = "Oakland 9–14 — intermediate-risk LGIB; significant lower GI bleeding requiring inpatient workup"
                }
                scored[i].logPosterior += adj
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // King's College Criteria met: boosts acute liver failure and its major causes
        if let kc = kingsCriteriaScore, kc >= 1 {
            let kcTargets = ["acute liver failure", "fulminant liver failure",
                             "paracetamol toxicity", "paracetamol overdose", "acetaminophen",
                             "hepatic encephalopathy", "wilson", "autoimmune hepatitis",
                             "viral hepatitis", "hepatitis a", "hepatitis b", "hepatitis e",
                             "ischaemic hepatitis", "congestive hepatopathy",
                             "budd-chiari", "veno-occlusive", "drug-induced liver injury",
                             "mushroom poisoning", "amanita", "liver failure",
                             "acute-on-chronic liver failure", "hepatorenal syndrome"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard kcTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "King's College Criteria met — acute liver failure requiring transplant referral; strongly supports hepatic aetiology"
                scored[i].logPosterior += 15
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // Child-Pugh score: boosts cirrhosis and its complications by class
        if let cp = childPughScore {
            let cpTargets: [(fragment: String, threshold: Int, adj: Int)] = [
                ("cirrhosis", 7, 12), ("portal hypertension", 7, 10), ("hepatic encephalopathy", 7, 9),
                ("variceal", 7, 9), ("oesophageal varic", 7, 8), ("ascites", 7, 8),
                ("spontaneous bacterial peritonitis", 10, 7), ("hepatorenal", 10, 8),
                ("hepatocellular carcinoma", 5, 4), ("hepatitis", 5, 3), ("liver failure", 10, 10)
            ]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                for rule in cpTargets {
                    guard cp >= rule.threshold, nameLow.contains(rule.fragment) else { continue }
                    let label = "Child-Pugh \(cp) — cirrhotic liver disease severity supports hepatic aetiology"
                    scored[i].logPosterior += rule.adj
                    scored[i].evidence.append(label)
                    scored[i].evidenceSources["score", default: []].append(label)
                    break
                }
            }
        }

        // MELD score: boosts end-stage liver disease spectrum
        if let meld = meldScore, meld >= 10 {
            let meldTargets = ["cirrhosis", "portal hypertension", "hepatic encephalopathy",
                               "variceal haemorrhage", "hepatorenal syndrome", "ascites",
                               "spontaneous bacterial peritonitis", "liver failure",
                               "hepatocellular carcinoma"]
            let adj = meld >= 25 ? 12 : meld >= 15 ? 8 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard meldTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "MELD \(meld) — end-stage liver disease probability significantly elevated"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // ECOG: poor performance status boosts cancer, frailty, and neurodegenerative diagnoses
        if let ecog = ecogScore, ecog >= 2 {
            let ecogTargets = ["cancer", "carcinoma", "metastasis", "lymphoma", "sarcoma",
                               "frailty", "sarcopenia", "malnutrition", "cachexia",
                               "dementia", "parkinson", "motor neurone", "cerebral palsy",
                               "heart failure", "chronic respiratory failure"]
            let adj = ecog >= 3 ? 8 : 5
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard ecogTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "ECOG \(ecog) — reduced performance status supports diagnosis of debilitating or advanced disease"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // RTS: low score boosts trauma-related diagnoses
        if let rts = rtsScore, rts < 700 {  // RTS <7.00 (stored ×100)
            let traumaTargets = ["trauma", "injury", "fracture", "haemorrhage", "haematoma",
                                 "splenic rupture", "hepatic laceration", "rib fracture",
                                 "pneumothorax", "haemothorax", "traumatic brain", "subdural",
                                 "extradural", "aortic injury", "mesenteric injury",
                                 "bladder rupture", "pelvic fracture"]
            let adj = rts < 400 ? 12 : rts < 600 ? 7 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard traumaTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "RTS \(String(format: "%.2f", Double(rts)/100)) — trauma severity score supports traumatic aetiology"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // KDIGO AKI: boosts renal and sepsis diagnoses
        if let ak = kdigoStage, ak >= 1 {
            let akiTargets = ["acute kidney injury", "aki", "acute renal failure",
                              "acute tubular necrosis", "renal papillary necrosis",
                              "hepatorenal syndrome", "sepsis", "septic shock",
                              "rhabdomyolysis", "contrast nephropathy",
                              "prerenal azotaemia", "hypovolaemia",
                              "obstructive uropathy", "urinary obstruction",
                              "myeloma", "amyloid", "glomerulonephritis"]
            let adj = ak >= 3 ? 12 : ak == 2 ? 8 : 5
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard akiTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "KDIGO AKI Stage \(ak) — acute kidney injury severity supports renal/precipitating diagnosis"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Baux Score: boosts burn and inhalation injury diagnoses
        if let bx = bauxScore, bx >= 40 {
            let burnTargets = ["burn", "inhalation injury", "smoke inhalation", "chemical burn",
                               "flame burn", "electrical burn", "scald", "radiation burn"]
            let adj = bx >= 120 ? 12 : bx >= 80 ? 8 : bx >= 60 ? 6 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard burnTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Baux Score \(bx) — significant burn injury supports burn/inhalation diagnoses"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // ISS: boosts trauma diagnoses by severity
        if let is_ = issScore, is_ >= 9 {
            let traumaTargets = ["trauma", "injury", "fracture", "haemothorax", "pneumothorax",
                                 "haemoperitoneum", "splenic laceration", "liver laceration",
                                 "aortic injury", "traumatic brain injury", "tbi",
                                 "crush injury", "blast injury", "polytrauma", "blunt abdominal"]
            let adj = is_ >= 25 ? 12 : is_ >= 16 ? 8 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard traumaTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "ISS \(is_) — \(is_ >= 25 ? "major" : "moderate") trauma severity supports traumatic diagnoses"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // NUTRIC: boosts malnutrition and ICU-associated weakness/frailty candidates
        if let nt = nutricScore, nt >= 5 {
            let nutricTargets = ["malnutrition", "sarcopenia", "cachexia", "frailty",
                                 "icu-acquired weakness", "critical illness myopathy",
                                 "protein-energy malnutrition", "undernutrition"]
            let adj = nt >= 6 ? 8 : 5
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard nutricTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "NUTRIC \(nt) — high nutritional risk supports malnutrition/wasting diagnoses"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // sPESI: boosts pulmonary embolism in high-risk patients
        if let sp = spesiScore, sp >= 1 {
            let spesiTargets = ["pulmonary embolism", "pe", "venous thromboembolism", "vte",
                                "deep vein thrombosis", "right heart strain"]
            let adj = sp >= 3 ? 12 : 8
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard spesiTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "sPESI \(sp) — high-risk PE; boosts thromboembolic diagnoses"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // DECAF: boosts COPD exacerbation and respiratory failure diagnoses
        if let dc = decafScore, dc >= 2 {
            let decafTargets = ["copd", "chronic obstructive pulmonary disease",
                                "acute exacerbation", "respiratory failure",
                                "hypercapnic respiratory failure", "type 2 respiratory failure"]
            let adj = dc >= 3 ? 10 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard decafTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "DECAF \(dc) — moderate/high-risk COPD exacerbation"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Hinchey: boosts complicated diverticulitis and peritonitis diagnoses
        if let hg = hincheyGrade, hg >= 2 {
            let hincheyTargets = ["diverticulitis", "diverticular", "peritonitis",
                                  "complicated diverticulitis", "sigmoid diverticulitis",
                                  "intra-abdominal sepsis", "colonic perforation"]
            let adj = hg >= 3 ? 14 : 9
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard hincheyTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Hinchey \(hg) — complicated diverticulitis; boosts septic/surgical diagnoses"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // AIR: boosts appendicitis and peritonitis diagnoses
        if legacyRules, let air = airScore, air >= 5 {
            let airTargets = ["appendicitis", "acute appendicitis", "perforated appendicitis",
                              "appendicular abscess", "appendicular mass", "peritonitis"]
            let adj = air >= 9 ? 15 : 9
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard airTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "AIR \(air) — intermediate/high-risk appendicitis; boosts appendicitis diagnoses"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // PERC: negative PERC (0 violations) suppresses PE in low-pretest context
        if legacyRules, let pv = percViolations, pv == 0 {
            let peTargets = ["pulmonary embolism", "pe ", "venous thromboembolism", "dvt", "deep vein thrombosis"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard peTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "PERC Rule met (0/8 violations) — PE less likely in low-pretest setting"
                scored[i].logPosterior -= 6
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Shock Index: high SI boosts haemorrhagic and septic shock diagnoses
        if let si = shockIndex, si >= 100 {
            let siTargets = ["haemorrhagic shock", "hemorrhagic shock", "hypovolaemic shock",
                             "hypovolemic shock", "septic shock", "traumatic shock",
                             "gastrointestinal bleed", "ruptured aortic aneurysm",
                             "ruptured ectopic", "postpartum haemorrhage", "major trauma"]
            let adj = si >= 140 ? 14 : 9
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard siTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Shock Index \(Double(si)/100) ≥ 1.0 — significant haemodynamic compromise; boosts shock diagnoses"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Parkland: significant burn injury boosts burn-related diagnoses
        if let pv = parklandVolume, pv > 0 {
            let burnTargets = ["burns", "thermal injury", "chemical burns", "electrical burns",
                               "inhalation injury", "toxic epidermal necrolysis"]
            let adj = pv >= 10000 ? 14 : pv >= 5000 ? 10 : 7
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard burnTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Parkland volume \(pv) mL calculated — significant burn injury confirmed"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // PAS: boosts paediatric appendicitis diagnoses
        if let ps = pasScore, ps >= 4 {
            let pasTargets = ["appendicitis", "acute appendicitis", "perforated appendicitis",
                              "appendicular abscess", "mesenteric adenitis"]
            let adj = ps >= 7 ? 14 : 8
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard pasTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "PAS \(ps) — intermediate/high-risk paediatric appendicitis"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Revised Geneva: boosts pulmonary embolism diagnoses
        if let rg = revisedGenevaScore, rg >= 4 {
            let rgTargets = ["pulmonary embolism", "pe ", "venous thromboembolism", "vte",
                             "right ventricular strain", "dvt"]
            let adj = rg >= 11 ? 13 : 8
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard rgTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Revised Geneva \(rg) — moderate/high PE probability"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // CCI boost: high comorbidity burden elevates chronic disease differentials
        if let cc = cciScore, cc >= 3 {
            let cciTargets = ["chronic", "malignancy", "cancer", "heart failure", "renal", "liver",
                              "diabetes", "dementia", "copd", "peripheral vascular", "lymphoma",
                              "leukaemia", "metastatic", "cirrhosis"]
            let adj = cc >= 5 ? 7 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard cciTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "CCI \(cc) — high comorbidity burden increases chronic/oncological differentials"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // mFI-5 boost: frailty elevates post-operative complications and frailty-related presentations
        if let mf = mfi5Score, mf >= 2 {
            let mfTargets = ["delirium", "deconditioning", "aspiration", "pneumonia", "heart failure",
                             "urinary tract infection", "sepsis", "ileus", "pressure", "wound"]
            let adj = mf >= 3 ? 7 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard mfTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "mFI-5 = \(mf) — frailty elevates post-operative complication risk"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // HAPS boost: score < 3 elevates severe pancreatitis / complications
        if let haps = hapsScore {
            let hapsTargets = ["pancreatitis", "pancreatic", "pancreas", "peripancreatic",
                               "pseudocyst", "necrotising", "infected necrosis", "splanchnic"]
            if haps < 3 {
                let adj = 9
                for i in scored.indices {
                    let nameLow = scored[i].candidate.name.lowercased()
                    guard hapsTargets.contains(where: { nameLow.contains($0) }) else { continue }
                    let label = "HAPS \(haps)/3 — not harmless; severe acute pancreatitis cannot be excluded"
                    scored[i].logPosterior += adj
                    scored[i].evidence.append(label)
                    scored[i].evidenceSources["score", default: []].append(label)
                }
            }
        }

        // BISAP boost: ≥3 elevates severe pancreatitis candidates
        if let bisap = bisapScore {
            let bisapTargets = ["pancreatitis", "pancreatic", "pancreas", "peripancreatic",
                                "pseudocyst", "necrotising", "infected necrosis", "splanchnic",
                                "organ failure", "multi-organ"]
            if bisap >= 3 {
                let adj = bisap >= 4 ? 9 : 7
                for i in scored.indices {
                    let nameLow = scored[i].candidate.name.lowercased()
                    guard bisapTargets.contains(where: { nameLow.contains($0) }) else { continue }
                    let label = "BISAP \(bisap)/5 — severe acute pancreatitis; ICU monitoring indicated"
                    scored[i].logPosterior += adj
                    scored[i].evidence.append(label)
                    scored[i].evidenceSources["score", default: []].append(label)
                }
            }
        }

        // Glasgow-Imrie boost: ≥3 elevates severe pancreatitis candidates
        if let gi = glasgowImrieScore {
            let giTargets = ["pancreatitis", "pancreatic", "pancreas", "peripancreatic",
                             "pseudocyst", "necrotising", "infected necrosis", "cholangitis"]
            if gi >= 3 {
                let adj = gi >= 5 ? 9 : 7
                for i in scored.indices {
                    let nameLow = scored[i].candidate.name.lowercased()
                    guard giTargets.contains(where: { nameLow.contains($0) }) else { continue }
                    let label = "Glasgow-Imrie \(gi)/8 — severe acute pancreatitis predicted"
                    scored[i].logPosterior += adj
                    scored[i].evidence.append(label)
                    scored[i].evidenceSources["score", default: []].append(label)
                }
            }
        }

        // ALBI boost: severe dysfunction elevates hepatic/biliary candidates
        if let albi = albiScore, albi > -1.39 {
            let albiTargets = ["liver", "hepatic", "hepatocellular", "cirrhosis", "cholangiocarcinoma",
                               "hepatitis", "portal hypertension", "varices", "ascites"]
            let adj = albi > -1.0 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard albiTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "ALBI Grade 3 (\(String(format: "%.2f", albi))) — severe hepatic dysfunction"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // AUDIT-C boost: hazardous drinking elevates alcohol-related and hepatic candidates
        if let ac = auditCScore, ac >= 4 {
            let acTargets = ["alcohol", "alcoholic", "liver", "hepatic", "pancreatitis",
                             "oesophageal", "gastritis", "neuropathy", "delirium tremens"]
            let adj = ac >= 8 ? 8 : 5
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard acTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "AUDIT-C \(ac)/12 — hazardous/harmful drinking"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // SAPS II boost: high ICU severity elevates critical/sepsis candidates
        if let saps = sapsIIScore, saps >= 40 {
            let sapsTargets = ["sepsis", "septic shock", "multi-organ", "organ failure",
                               "peritonitis", "necrotising", "ischaemia", "infarction"]
            let adj = saps >= 70 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard sapsTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "SAPS II \(saps) — high ICU severity (predicted mortality ≥30%)"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Stone CT features boost (the local 0–6 score formerly labelled "STONE"; weights unchanged):
        // a high score elevates renal/ureteric colic candidates. The published STONE score
        // (stoneUretericScore) enters as a decision-rule band instead (DecisionRuleEvidence).
        if let st = stoneScore, st >= 4 {
            let stTargets = ["nephrolithiasis", "ureteric colic", "renal colic", "kidney stone",
                             "urolithiasis", "hydronephrosis", "obstructive uropathy"]
            let adj = st == 5 ? 9 : 7
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard stTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Stone CT features \(st)/6 — high probability ureteric colic"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // MELD 3.0 boost: severe hepatic dysfunction elevates liver/cirrhosis candidates
        if let m3 = meld3Score, m3 >= 15 {
            let meldTargets = ["cirrhosis", "hepatic", "liver failure", "portal hypertension",
                               "varices", "ascites", "encephalopathy", "hepatocellular"]
            let adj = m3 >= 25 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard meldTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "MELD 3.0 \(String(format: "%.1f", m3)) — significant/severe hepatic dysfunction"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Centor/McIsaac boost: high score raises streptococcal pharyngitis / tonsillitis candidates
        if legacyRules, let ct = centorScore, ct >= 3 {
            let ctTargets = ["streptococcal", "strep", "pharyngitis", "tonsillitis", "tonsil", "peritonsillar"]
            let adj = ct >= 4 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard ctTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Centor/McIsaac \(ct)/5 — significant GAS pharyngitis probability"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // IPSS boost: severe LUTS raises BPH / bladder-outlet-obstruction candidates
        if let ip = ipssScore, ip >= 20 {
            let ipTargets = ["benign prostatic", "bph", "prostatic hyperplasia",
                             "bladder outlet", "urinary retention", "prostate"]
            let adj = ip >= 30 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard ipTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "IPSS \(ip)/35 — severe lower urinary tract symptoms"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Truelove-Witts boost: severe colitis raises UC / colitis candidates
        if let tw = trueloveWittsScore, tw >= 3 {
            let twTargets = ["ulcerative colitis", "colitis", "inflammatory bowel",
                             "severe colitis", "toxic megacolon"]
            let adj = 9
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard twTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Truelove-Witts score \(tw)/3 — severe UC activity"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Harvey-Bradshaw boost: moderate–severe score raises Crohn's disease candidates
        if let hb = harveyBradshawScore, hb >= 8 {
            let hbTargets = ["crohn", "crohn's", "inflammatory bowel", "ileitis",
                             "terminal ileitis", "small bowel inflammation"]
            let adj = hb >= 16 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard hbTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Harvey-Bradshaw Index \(hb) — moderate/severe Crohn's activity"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Maddrey boost: severe alcoholic hepatitis raises hepatitis/liver candidates
        if let md = maddreyScore, md >= 32 {
            let mdTargets = ["alcoholic hepatitis", "alcoholic liver", "liver failure",
                             "hepatic failure", "cirrhosis", "hepatitis"]
            let adj = md >= 54 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard mdTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Maddrey DF \(String(format: "%.1f", md)) — severe alcoholic hepatitis"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Manning boost: probable IBS raises functional bowel candidates
        if let mn = manningScore, mn >= 3 {
            let mnTargets = ["irritable bowel", "ibs", "functional bowel", "functional abdominal"]
            let adj = mn >= 5 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard mnTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Manning Criteria \(mn)/6 — probable IBS"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // FINDRISC boost: high T2DM risk raises diabetes and metabolic candidates
        if let fr = findRiscScore, fr >= 15 {
            let frTargets = ["type 2 diabetes", "diabetes mellitus", "prediabetes",
                             "impaired glucose", "metabolic syndrome", "insulin resistance"]
            let adj = fr >= 21 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard frTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "FINDRISC \(fr) — high T2DM risk"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Mirels boost: high pathological fracture risk raises bone met / metastatic cancer candidates
        if let mr = mirelsScore, mr >= 9 {
            let mrTargets = ["bone metastasis", "metastatic", "pathological fracture",
                             "skeletal metastasis", "bony metastasis", "osseous metastasis"]
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard mrTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Mirels \(mr)/12 — high pathological fracture risk"
                scored[i].logPosterior += 9
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // CKD-EPI boost: reduced eGFR raises CKD / renal failure candidates
        if let egfr = ckdEpiEgfr, egfr < 60 {
            let ckdTargets = ["chronic kidney disease", "ckd", "renal failure",
                              "renal impairment", "renal insufficiency", "nephropathy"]
            let adj = egfr < 15 ? 9 : (egfr < 30 ? 6 : 4)
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard ckdTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "CKD-EPI eGFR \(String(format: "%.1f", egfr)) — CKD stage \(egfr < 15 ? "G5" : egfr < 30 ? "G4" : "G3")"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Fong boost: high CRS raises colorectal liver metastasis candidates
        if let fong = fongCrsScore, fong >= 3 {
            let fongTargets = ["colorectal liver", "hepatic metastasis", "liver metastasis",
                               "colorectal cancer", "colorectal carcinoma", "colon cancer"]
            let adj = fong >= 5 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard fongTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Fong CRS \(fong)/5 — poor prognosis colorectal liver metastases"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Berlin ARDS boost: low PF ratio boosts ARDS and acute respiratory failure candidates
        if let pf = berlinPFRatio, pf < 300 {
            let berlTargets = ["acute respiratory distress", "ards", "respiratory failure", "respiratory distress"]
            let adj = pf < 100 ? 9 : (pf < 200 ? 7 : 5)
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard berlTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Berlin ARDS PF ratio \(Int(pf)) — \(pf < 100 ? "severe" : pf < 200 ? "moderate" : "mild") ARDS"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // CAGE boost: probable AUD raises alcohol-related disorder candidates
        if let cage = cageScore, cage >= 2 {
            let cageTargets = ["alcohol use disorder", "alcoholic hepatitis", "alcoholic liver",
                               "alcohol dependence", "alcohol withdrawal", "alcoholic cirrhosis"]
            let adj = cage >= 3 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard cageTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "CAGE \(cage)/4 — probable alcohol use disorder"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Duke IE boost: major criteria raise infective endocarditis candidates
        if let duke = dukeIEScore, duke >= 2 {
            let dukeTargets = ["infective endocarditis", "endocarditis", "cardiac vegetation",
                               "bacteraemia", "bacteremia"]
            let adj = duke >= 4 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard dukeTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Duke IE score \(Int(duke)) — \(duke >= 4 ? "definite" : "possible") infective endocarditis"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // mMRC boost: severe dyspnoea raises COPD and chronic respiratory disease candidates
        if let mmrc = mmrcGrade, mmrc >= 3 {
            let mmrcTargets = ["copd", "chronic obstructive pulmonary", "emphysema",
                               "respiratory failure", "pulmonary hypertension", "heart failure"]
            let adj = mmrc >= 4 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard mmrcTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "mMRC grade \(mmrc) — severe dyspnoea"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // PTS boost: major paediatric trauma raises trauma-related diagnosis candidates
        if let pts = ptsScore, pts <= 8 {
            let ptsTargets = ["trauma", "traumatic injury", "paediatric trauma", "polytrauma",
                              "head injury", "abdominal trauma", "thoracic trauma"]
            let adj = pts <= 0 ? 9 : (pts <= 5 ? 7 : 5)
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard ptsTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "PTS \(pts) — \(pts <= 0 ? "critical" : "major") paediatric trauma"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Caprini boost: high VTE risk raises DVT and PE candidates
        if let caprini = capriniScore, caprini >= 5 {
            let capriniTargets = ["deep vein thrombosis", "dvt", "pulmonary embolism", "pe",
                                  "thromboembolism", "venous thrombosis"]
            let adj = caprini >= 9 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard capriniTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Caprini \(caprini) — \(caprini >= 9 ? "very high" : "high") VTE risk"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Child-Pugh boost: Class B/C raises cirrhosis and portal hypertension candidates
        if let cp = childPughScore, cp >= 7 {
            let cpTargets = ["cirrhosis", "portal hypertension", "hepatic encephalopathy",
                             "liver failure", "oesophageal varices", "spontaneous bacterial peritonitis",
                             "hepatorenal syndrome", "liver disease"]
            let adj = cp >= 10 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard cpTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Child-Pugh \(cp) — Class \(cp >= 10 ? "C" : "B") cirrhosis"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // RIPASA boost: probable appendicitis raises appendicitis candidates
        if let ripasa = ripasaScore, ripasa >= 7.5 {
            let ripasaTargets = ["appendicitis", "appendix", "right iliac fossa", "rif pain"]
            let adj = ripasa >= 11.5 ? 9 : 7
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard ripasaTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = String(format: "RIPASA %.1f — \(ripasa >= 11.5 ? "very probable" : "probable") appendicitis", ripasa)
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // FGSI boost: high FGSI raises Fournier gangrene candidates
        if let fgsi = fgsiScore, fgsi >= 1 {
            let fgsiTargets = ["fournier", "necrotising fasciitis", "necrotizing fasciitis",
                               "perianal gangrene", "scrotal gangrene", "perineal gangrene"]
            let adj = fgsi >= 9 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard fgsiTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "FGSI \(fgsi) — \(fgsi >= 9 ? "high-mortality" : "active") Fournier gangrene"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Hinchey boost: high stage raises perforated diverticulitis and peritonitis candidates
        if let hinchey = hincheyStage, hinchey >= 3 {
            let hincheyTargets = ["diverticulitis", "perforated diverticulitis", "peritonitis",
                                  "faecal peritonitis", "purulent peritonitis"]
            let adj = hinchey >= 4 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard hincheyTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Hinchey Stage \(hinchey) — \(hinchey >= 4 ? "faecal peritonitis" : "purulent peritonitis")"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // SIRS boost: ≥2 criteria raises sepsis/infection candidates
        if let sirs = sirsScore, sirs >= 2 {
            let sirsTargets = ["sepsis", "infection", "pneumonia", "peritonitis", "cholangitis",
                               "pyelonephritis", "meningitis", "endocarditis", "abscess"]
            let adj = sirs >= 4 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard sirsTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "SIRS \(sirs)/4 criteria — systemic inflammatory response"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // MEWS / NEWS2 deterioration boost
        let deteriorationScore = mewsScore ?? independentNews2
        if let ds = deteriorationScore, ds >= 5 {
            let deteriorTargets = ["sepsis", "shock", "respiratory failure", "acute heart failure",
                                   "acute coronary syndrome", "pulmonary embolism", "stroke",
                                   "acute liver failure", "diabetic ketoacidosis"]
            let adj = ds >= 7 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard deteriorTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "Early warning score \(ds) — significant clinical deterioration"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // GCS boost: impaired consciousness raises neurological/metabolic candidates
        if let gcs = gcsScore, gcs <= 13 {
            let gcsTargets = ["stroke", "traumatic brain injury", "subdural haematoma",
                              "subarachnoid haemorrhage", "hepatic encephalopathy",
                              "diabetic ketoacidosis", "hypoglycaemia", "meningitis", "sepsis"]
            let adj = gcs <= 8 ? 9 : 6
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard gcsTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "GCS \(gcs)/15 — \(gcs <= 8 ? "severe" : "moderate") neurological impairment"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // RCRI boost: elevated score raises periop cardiac complications candidates
        if let rcri = rcriScore, rcri >= 2 {
            let rcriTargets = ["acute coronary syndrome", "myocardial infarction", "heart failure",
                               "cardiac arrest", "atrial fibrillation", "perioperative"]
            let adj = rcri >= 3 ? 6 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard rcriTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "RCRI \(rcri) — elevated perioperative cardiac risk"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // STOP-BANG boost: intermediate/high OSA raises obstructive sleep apnoea candidates
        if let sb = stopBangScore, sb >= 3 {
            let sbTargets = ["obstructive sleep apnoea", "sleep apnoea", "obesity hypoventilation",
                             "pulmonary hypertension", "right heart failure"]
            let adj = sb >= 5 ? 6 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard sbTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "STOP-BANG \(sb)/8 — intermediate/high OSA risk"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // CHA₂DS₂-VASc boost: high score raises AF-related stroke candidates
        if let chads = cha2ds2vascScore, chads >= 2 {
            let chadsTargets = ["atrial fibrillation", "ischaemic stroke", "TIA",
                                "cerebral embolism", "cardioembolic stroke"]
            let adj = chads >= 4 ? 6 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard chadsTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "CHA₂DS₂-VASc \(chads) — high AF-related stroke risk"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // HAS-BLED boost: high score raises bleeding risk candidates
        if let hasbled = hasBledScore, hasbled >= 3 {
            let hasbledTargets = ["gastrointestinal bleeding", "haematemesis", "melaena",
                                  "intracranial haemorrhage", "anticoagulant-related bleeding"]
            let adj = hasbled >= 5 ? 6 : 4
            for i in scored.indices {
                let nameLow = scored[i].candidate.name.lowercased()
                guard hasbledTargets.contains(where: { nameLow.contains($0) }) else { continue }
                let label = "HAS-BLED \(hasbled)/9 — high bleeding risk on anticoagulation"
                scored[i].logPosterior += adj
                scored[i].evidence.append(label)
                scored[i].evidenceSources["score", default: []].append(label)
            }
        }

        // Surgical exclusion: if PSHx documents organ removal, that candidate
        // is set to log-posterior −9999 (≈0 after softmax) so it does not appear.
        let pshxCheckL = mergedPSHx.lowercased()
        let exclusions: [(keywords: [String], fragments: [String])] = [
            (["appendect"], ["appendicitis"]),
            (["cholecystect"], ["cholecystitis", "biliary colic", "cholelithiasis", "gallstone"]),
            (["gastrectomy", "total gastrect"], ["gastric cancer", "gastric ulcer"]),
            (["colectomy", "hemicolectomy", "proctocolect"], ["colorectal cancer", "diverticular"]),
            (["thyroidect"], ["thyroid cancer", "thyroid nodule", "goitre", "hyperthyroidism", "thyrotoxicosis"]),
            (["splenect"], ["splenic rupture", "splenic trauma", "spleen"]),
            (["oophorect", "salpingo-oophorect"], ["ovarian torsion", "ovarian cyst", "ovarian cancer"]),
            (["hysterect"], ["uterine cancer", "endometrial cancer", "uterine fibroid", "fibroid uterus"]),
        ]
        for rule in exclusions {
            guard rule.keywords.contains(where: { pshxCheckL.contains($0) }) else { continue }
            for fragment in rule.fragments {
                for i in scored.indices {
                    if scored[i].candidate.name.lowercased().contains(fragment) {
                        scored[i].logPosterior = excludedLogPosterior
                    }
                }
            }
        }

        return topResults(from: scored)
    }

    // MARK: - Internal candidate type

    struct Candidate {
        let name: String
        let icd: String
        let logPrior: Int            // higher = more prevalent in this CC context
        var urgency: Int = 0         // 0=routine 1=urgent 2=emergency 3=critical
        let features: [Feature]
        /// Sex / age / pregnancy the diagnosis can apply to (nil = anyone). See `Applicability`.
        var applicability: Applicability? = nil

        struct Feature {
            let key: String          // dimension id or sentinel like "exam", "pmh", "inv"
            let value: String        // chip label or keyword fragment
            let logLR: Int           // positive = increases probability, negative = decreases
            let evidenceLabel: String
            /// Masking contexts under which a negative feature is not counted
            /// (BayesianDiagnosisEngine+Context.swift); nil for the built-in lists.
            var maskedBy: [String]? = nil
            /// Source of the weight (DiagnosticDatabase.json feature citation); nil for the built-in lists.
            var citation: String? = nil
        }
    }
}
