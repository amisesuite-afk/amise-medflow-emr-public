import Foundation

// MARK: - Bayesian differential-diagnosis engine
// Naive-Bayes style: log-posterior = log-prior + Σ log-LR for each observed feature.
// All arithmetic is in integer units scaled to avoid Float imprecision;
// values are converted to probabilities via softmax at the end.

enum BayesianDiagnosisEngine {

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
        latestHR: Int? = nil,         // measured heart rate (bpm)
        latestSBP: Int? = nil,        // systolic BP (mmHg)
        latestTemp: Double? = nil,    // temperature (°C)
        latestSpO2: Int? = nil,       // oxygen saturation (%)
        latestRR: Int? = nil,         // respiratory rate (breaths/min)
        news2Score: Int? = nil,       // computed NEWS2 score (0–20)
        specialtyHint: String? = nil  // e.g. "cardiology" — narrows matrix cross-query to that specialty
    ) -> [DiagnosisResult] {
        // Build a synthetic CC string from investigation names + results so that
        // investigation findings also drive pool routing (not just scoring).
        // Combines real CC + inv terms so existing keyword cases fire unchanged.
        let invTerms = investigations.flatMap { inv -> [String] in
            var t = [inv.name.lowercased()]
            if inv.status == .resulted { t.append(inv.result.lowercased()) }
            return t
        }.joined(separator: " ")
        let baseCCL = (chiefComplaint ?? "").lowercased()
        guard !baseCCL.isEmpty || !invTerms.isEmpty else { return [] }
        let ccL = baseCCL.isEmpty ? invTerms : (invTerms.isEmpty ? baseCCL : baseCCL + " " + invTerms)

        var candidates: [Candidate]
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
            candidates = externalPool("acutePancreatitis") ?? biliaryColic
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
        var seenNames = Set<String>(candidates.map(\.name))
        func mergePool(_ name: String) {
            guard let extra = externalPool(name) else { return }
            let novel = extra.filter { seenNames.insert($0.name).inserted }
            candidates.append(contentsOf: novel)
        }
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
        // Secondary merges: investigation-first overlays
        if ccL.contains("afp") || ccL.contains("liver lesion") || ccL.contains("hepatic mass") ||
           ccL.contains("hcc") || ccL.contains("hepatocellular") { mergePool("hepatobiliaryMalignancy") }
        if ccL.contains("ca19-9") || ccL.contains("pancreatic cyst") || ccL.contains("ipmn") ||
           ccL.contains("pancreatic mass") { mergePool("pancreaticSurgical") }
        if ccL.contains("cea") || ccL.contains("positive fit") || ccL.contains("fit positive") ||
           ccL.contains("colonic mass") || ccL.contains("colonoscopy finding") { mergePool("colorectalMalignancy") }
        if ccL.contains("ca-125") || ccL.contains("ca125") || ccL.contains("adnexal mass") ||
           ccL.contains("ovarian cyst") || ccL.contains("ovarian mass") { mergePool("gynaecologicalSurgical") }
        if ccL.contains("psa elevated") || ccL.contains("elevated psa") || ccL.contains("pirads") ||
           ccL.contains("renal mass") || ccL.contains("renal lesion") || ccL.contains("bladder mass") { mergePool("urologicalSurgical") }
        if ccL.contains("adrenal mass") || ccL.contains("adrenal lesion") || ccL.contains("adrenal incidentaloma") ||
           ccL.contains("metanephrine") || ccL.contains("aldosterone renin") { mergePool("parathyroidAdrenal") }
        if ccL.contains("bethesda") || ccL.contains("tirads") || ccL.contains("thyroid nodule") ||
           ccL.contains("calcitonin elevated") || ccL.contains("fnac") { mergePool("thyroidNoduleAssessment") }
        if ccL.contains("lung nodule") || ccL.contains("pulmonary nodule") ||
           ccL.contains("lung lesion") || ccL.contains("lung mass") { mergePool("thoracicSurgical") }
        if ccL.contains("abnormal lfts") || ccL.contains("deranged lfts") || ccL.contains("elevated bilirubin") ||
           ccL.contains("elevated alt") || ccL.contains("elevated ast") { mergePool("jaundice") }
        if (ccL.contains("iron deficiency") || ccL.contains("ida ") || ccL.contains("microcytic anaemia")) &&
           !ccL.contains("menorrhagia") { mergePool("colorectalMalignancy") }
        // Lab-finding-driven secondary merges — investigation results as chief complaints.
        // invTerms (investigation names + results) flows into ccL above, so these fire
        // whenever a resulted investigation contains the matching term.
        if ccL.contains("troponin") { mergePool("chestPain"); mergePool("arrhythmia") }
        if ccL.contains("d-dimer") || ccL.contains("ddimer") || ccL.contains("d dimer") {
            mergePool("venousThromboEmbolism")
        }
        if ccL.contains("amylase") || ccL.contains("lipase") { mergePool("acutePancreatitis") }
        if ccL.contains("lactate") {
            mergePool("sepsisConditions"); mergePool("mesentericVascular")
        }
        if ccL.contains("bnp") || ccL.contains("pro-bnp") || ccL.contains("nt-pro") ||
           ccL.contains("brain natriuretic") { mergePool("cardiacFailure") }
        if ccL.contains("hypercalcaemia") ||
           (ccL.contains("calcium") && (ccL.contains("elevated") || ccL.contains("raised") || ccL.contains("high"))) {
            mergePool("adrenalEndocrine"); mergePool("oncologyComplications")
        }
        if ccL.contains("raised inr") || ccL.contains("elevated inr") ||
           (ccL.contains("inr") && (ccL.contains("elevated") || ccL.contains("raised") || ccL.contains("high"))) {
            mergePool("coagulationDisorder")
        }
        if ccL.contains("raised crp") || ccL.contains("elevated crp") ||
           (ccL.contains("crp") && (ccL.contains("elevated") || ccL.contains("raised") || ccL.contains("high"))) {
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
        let matrixExtra = matrixCandidates(forCC: ccL, specialtyHint: specialtyHint)
        let matrixNovel = matrixExtra.filter { seenNames.insert($0.name).inserted }
        candidates.append(contentsOf: matrixNovel.prefix(12))

        // Cap total candidates at 45 (raised from 35 to accommodate matrix overlay)
        if candidates.count > 45 { candidates = Array(candidates.prefix(45)) }

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
            let isHigh  = combined.contains("elevated") || combined.contains("raised") ||
                          combined.contains(" high") || result.hasPrefix("high") ||
                          combined.contains(">") || combined.contains("abnormal")
            let isLow   = combined.contains(" low") || result.hasPrefix("low") ||
                          combined.contains("decreased") || combined.contains("deficient") ||
                          combined.contains("<")

            if name.contains("wbc") || name.contains("white cell") ||
               name.contains("leukocyte") || name.contains("leucocyte") ||
               name.contains("neutrophil") || name.contains("white blood cell") {
                if isHigh { labAssocChips.insert("raised wbc") }
                if isLow  { labAssocChips.insert("leukopenia") }
            }
            if name.contains("crp") || name.contains("c-reactive") {
                if isHigh { labAssocChips.insert("elevated crp") }
            }
            if name.contains("lactate") || name.contains("lactic acid") {
                if isHigh { labAssocChips.insert("elevated lactate") }
            }
            if name.contains("troponin") {
                if isHigh { labAssocChips.insert("elevated troponin") }
            }
            if name.contains("d-dimer") || name.contains("d dimer") || name.contains("ddimer") {
                if isHigh { labAssocChips.insert("elevated d-dimer") }
            }
            if name.contains("alt") || name.contains("ast") || name.contains("alp") ||
               name.contains("ggt") || name.contains("lft") ||
               name.contains("liver function") || name.contains("transaminase") ||
               name.contains("alkaline phosphatase") {
                if isHigh { labAssocChips.insert("elevated liver enzymes") }
            }
            if name.contains("bilirubin") {
                if isHigh { labAssocChips.insert("raised bilirubin") }
            }
            if name.contains("inr") || (name.contains("prothrombin") && name.contains("time")) {
                if isHigh { labAssocChips.insert("raised inr") }
            }
            if name.contains("creatinine") || name.contains("egfr") ||
               (name.contains("urea") && !name.contains("uric")) ||
               name.contains("bun") || name.contains("renal function") {
                if isHigh || (name.contains("egfr") && isLow) {
                    labAssocChips.insert("renal impairment")
                }
            }
            if name.contains("calcium") && !name.contains("channel") {
                if isHigh { labAssocChips.insert("hypercalcaemia") }
            }
            if name.contains("esr") || name.contains("erythrocyte sedimentation") {
                if isHigh { labAssocChips.insert("elevated esr") }
            }
            if name.contains("amylase") {
                if isHigh { labAssocChips.insert("elevated amylase") }
            }
            if name.contains("lipase") {
                if isHigh { labAssocChips.insert("elevated lipase") }
            }
            if name.contains("glucose") || name.contains("blood sugar") || name.contains("bgl") {
                if isHigh { labAssocChips.insert("elevated glucose") }
            }
            if name.contains("ldh") || name.contains("lactate dehydrogenase") {
                if isHigh { labAssocChips.insert("elevated ldh") }
            }
            if name.contains("haemoglobin") || name.contains("hemoglobin") ||
               name.contains("hgb") ||
               (name.count <= 4 && name.hasPrefix("hb")) ||
               (name.contains("fbc") && result.contains("anaemi")) {
                if isLow { labAssocChips.insert("Anaemia symptoms") }
            }
        }
        // Measured vital signs → association chips so that BDE features keyed to
        // "associations" fire from objective observations, not only manual SOCRATES entry.
        var vitalsChips: Set<String> = []
        if let hr = latestHR {
            if hr > 100 { vitalsChips.insert("tachycardia") }
            if hr < 50  { vitalsChips.insert("bradycardia") }
        }
        if let sbp = latestSBP, sbp < 100 { vitalsChips.insert("hypotension") }
        if let temp = latestTemp {
            if temp >= 38.0 { vitalsChips.insert("fever") }
            if temp < 36.0  { vitalsChips.insert("hypothermia") }
        }
        if let spo2 = latestSpO2, spo2 < 94 { vitalsChips.insert("oxygen desaturation") }
        if let rr = latestRR, rr > 20        { vitalsChips.insert("tachypnoea") }

        // Merge lab chips + vitals chips into socratesSelections["associations"] so that every
        // DiagnosticDatabase.json "associations" feature fires from objective measurements.
        let allAssocChips = labAssocChips.union(vitalsChips)
        var enrichedSocrates = socratesSelections
        if !allAssocChips.isEmpty {
            var assocSet = enrichedSocrates["associations"] ?? Set<String>()
            assocSet.formUnion(allAssocChips)
            enrichedSocrates["associations"] = assocSet
        }

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
            examOther: examOther ?? "",
            investigations: mergedInvestigations,
            age: ageYears,
            sex: sex,
            medications: medications,
            socialText: socialHistoryText ?? "",
            bmi: bmi
        )

        // Urgency safety-net boost: applied AFTER feature scoring so the boost
        // supplements — rather than replaces — evidence-based ranking.
        // urgency=1 (+8)  ≈ one moderate positive finding  → same-day assessment
        // urgency=2 (+16) ≈ a strong clinical sign         → immediate evaluation
        // urgency=3 (+24) ≈ a pathognomonic finding        → life-threatening
        // This ensures "don't miss" diagnoses (PE, ACS, ectopic) appear in the
        // differential even when the presenting history is sparse or atypical.
        let urgencyLabels = ["", "Urgent — same-day assessment required",
                             "Emergency — immediate evaluation required",
                             "CRITICAL — potentially life-threatening; do not miss"]
        for i in scored.indices where scored[i].candidate.urgency > 0 {
            let u = scored[i].candidate.urgency
            let boost = u * 8
            scored[i].logPosterior += boost
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
        if let alv = alvaradoScore {
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
        if let dvt = wellsDVTScore {
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
        if let pe = wellsPEScore {
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
        if let lr = lrinecScore {
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

        // NEWS2 → acuity-sensitive candidates (sepsis, PE, pneumonia, MI, cardiac failure, ARDS)
        // Fires when NEWS2 ≥ 5 (medium risk) or ≥ 7 (high risk).
        if let news2 = news2Score, news2 >= 5 {
            let (adj, label): (Int, String) = news2 >= 7
                ? (12, "NEWS2 \(news2) — high risk, consider critical care escalation")
                : (6,  "NEWS2 \(news2) — medium risk")
            let news2Targets = ["sepsis", "pulmonary embol", "pneumonia", "myocardial infarct",
                                "acute coronary", "cardiac failure", "heart failure", "bacteraemia",
                                "ards", "respiratory distress", "septic shock", "cardiac tamponade",
                                "aortic dissect"]
            for i in scored.indices where news2Targets.contains(where: {
                scored[i].candidate.name.lowercased().contains($0)
            }) {
                scored[i].logPosterior += adj
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
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
                scored[i].logPosterior += Double(adj)
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
            }
        }

        // HEART: boosts ACS/cardiac chest pain candidates based on risk stratification
        if let hs = heartScore, hs >= 4 {
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
                scored[i].logPosterior += Double(adj)
                scored[i].evidence.insert(label, at: 0)
                scored[i].evidenceSources["score", default: []].insert(label, at: 0)
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
                        scored[i].logPosterior = -9999
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

        struct Feature {
            let key: String          // dimension id or sentinel like "exam", "pmh", "inv"
            let value: String        // chip label or keyword fragment
            let logLR: Int           // positive = increases probability, negative = decreases
            let evidenceLabel: String
        }
    }

    // MARK: - Scoring

    struct ScoredCandidate {
        let candidate: Candidate
        var logPosterior: Int
        var evidence: [String]
        var evidenceSources: [String: [String]] = [:]
        var pathognomicFindings: [String] = []   // features with logLR ≥ 18 that fired
    }

    private static func score(
        candidates: [Candidate],
        socrates: [String: Set<String>],
        pmh: String, pshx: String,
        examAbdo: String, examGeneral: String,
        examCVS: String = "", examResp: String = "",
        examNeuro: String = "", examMSK: String = "",
        examSkin: String = "", examOther: String = "",
        investigations: [InvestigationEntry],
        age: Int, sex: Sex,
        medications: [String] = [],
        socialText: String = "",
        bmi: Double? = nil
    ) -> [ScoredCandidate] {
        let pmhL = pmh.lowercased()
        let pshxL = pshx.lowercased()
        let examL = [examAbdo, examGeneral, examCVS, examResp, examNeuro, examMSK, examSkin, examOther]
            .joined(separator: " ").lowercased()
        let invNames = investigations.map { $0.name.lowercased() }
        let invResults = investigations.filter { $0.status == .resulted }
            .map { $0.name.lowercased() + " " + $0.result.lowercased() }
        let medsL = medications.map { $0.lowercased() }
        let socialL = socialText.lowercased()

        return candidates.map { c in
            var logP = c.logPrior
            var evidence: [String] = []
            var evidenceSources: [String: [String]] = [:]
            var pathognomicFindings: [String] = []

            // Pre-pass: collect DAG node IDs for features that have already fired,
            // so downstream correlated features receive CPT-based discounting.
            // Covers both canonical keys AND synonym keys so discounting fires for
            // specialist-pool features that use non-standard key names.
            var observedNetworkIDs = Set<String>()
            for f in c.features {
                guard let nid = Self.featureNetworkID(key: f.key, value: f.value) else { continue }
                let fired: Bool
                switch f.key {
                case "associations", "onset", "character", "radiation",
                     "timing", "exacerbating", "relieving", "severity", "site":
                    let sel = socrates[f.key] ?? []
                    fired = sel.contains(where: { $0.lowercased().contains(f.value.lowercased()) })
                case "associated":
                    // Synonym for "associations" — check against canonical associations set.
                    let sel = socrates["associations"] ?? []
                    let words = f.value.lowercased().split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    fired = words.isEmpty
                        ? sel.contains(where: { $0.lowercased().contains(f.value.lowercased()) })
                        : words.allSatisfy { w in sel.contains(where: { $0.lowercased().contains(w) }) }
                case "exam":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy { examL.contains($0) }
                case "exam_general":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy { examGeneral.lowercased().contains($0) } ||
                            words.allSatisfy { examL.contains($0) }
                case "exam_abdo":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy { examAbdo.lowercased().contains($0) } ||
                            words.allSatisfy { examL.contains($0) }
                case "exam_cvs":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy { examCVS.lowercased().contains($0) } ||
                            words.allSatisfy { examL.contains($0) }
                default:
                    fired = false
                }
                if fired { observedNetworkIDs.insert(nid) }
            }

            // Helper: match a coded/free-text finding value against investigation results
            // filtered to a specific imaging or lab modality.
            func invModalityMatch(keywords: [String], finding: String) -> Bool {
                let fv = finding.lowercased().replacingOccurrences(of: "_", with: " ")
                let toks = fv.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                let src = invResults.filter { r in keywords.contains(where: { r.contains($0) }) }
                if toks.isEmpty { return src.contains(where: { $0.contains(fv) }) }
                return src.contains(where: { r in toks.filter { r.contains($0) }.count >= max(1, toks.count / 2) })
            }

            for f in c.features {
                var triggered = false
                var sourceKey = "other"
                switch f.key {
                case "onset", "site", "character", "radiation", "associations",
                     "timing", "exacerbating", "relieving", "severity":
                    let sel = socrates[f.key] ?? []
                    triggered = sel.contains(where: {
                        $0.lowercased().contains(f.value.lowercased())
                    })
                    sourceKey = "symptoms"
                case "exam":
                    // Space-separated value = all words must appear in exam text (AND logic).
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words.allSatisfy { examL.contains($0) }
                    sourceKey = "exam"
                case "pmh":
                    triggered = pmhL.contains(f.value.lowercased())
                    sourceKey = "history"
                case "pshx":
                    triggered = pshxL.contains(f.value.lowercased())
                    sourceKey = "history"
                case "inv":
                    // First try exact substring match (fast path for short feature values).
                    // For multi-word values the exact phrase rarely survives abbreviation
                    // differences (e.g. "axr" vs "abdominal x-ray"), so fall back to a
                    // majority-token match: require ≥60% of significant tokens (≥4 chars,
                    // not stop-words) to appear in any single invNames or invResults entry.
                    let fv = f.value.lowercased()
                    let stop: Set<String> = ["with","and","the","for","that","this","from","into","positive","negative","confirmed","elevated","raised","normal","abnormal","level","result"]
                    let fTokens = fv.split(separator: " ").map(String.init)
                        .filter { $0.count >= 4 && !stop.contains($0) }
                    let threshold = max(1, Int((Double(fTokens.count) * 0.6).rounded(.up)))
                    func tokenMatch(_ src: String) -> Bool {
                        src.contains(fv) ||
                        (fTokens.count >= 2 && fTokens.filter { src.contains($0) }.count >= threshold)
                    }
                    triggered = invNames.contains(where: { tokenMatch($0) }) ||
                                invResults.contains(where: { tokenMatch($0) })
                    sourceKey = "investigation"
                case "age_over":
                    if let threshold = Int(f.value) { triggered = age >= threshold }
                    sourceKey = "demographics"
                case "age_under":
                    if let threshold = Int(f.value) { triggered = age > 0 && age < threshold }
                    sourceKey = "demographics"
                case "sex_female":
                    triggered = sex == .female
                    sourceKey = "demographics"
                case "sex_male":
                    triggered = sex == .male
                    sourceKey = "demographics"
                case "med":
                    triggered = medsL.contains(where: { $0.contains(f.value.lowercased()) })
                    sourceKey = "history"
                case "social":
                    triggered = socialL.contains(f.value.lowercased())
                    sourceKey = "history"
                case "bmi_over":
                    if let threshold = Double(f.value), let bmiVal = bmi { triggered = bmiVal >= threshold }
                    sourceKey = "demographics"
                case "bmi_under":
                    if let threshold = Double(f.value), let bmiVal = bmi { triggered = bmiVal > 0 && bmiVal < threshold }
                    sourceKey = "demographics"

                // Non-standard DB key synonyms — aliases used in specialist pools that
                // are semantically equivalent to standard keys but named differently.
                case "associated":
                    // Free-text association phrases; match against all clinical text.
                    let broadText = ([examAbdo, examGeneral, examCVS, examResp, examNeuro,
                                      examMSK, examSkin, examOther, pmh] +
                                     socrates.values.flatMap { Array($0) })
                        .joined(separator: " ").lowercased()
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                        .filter { $0.count >= 4 }
                    triggered = words.isEmpty ? broadText.contains(f.value.lowercased())
                               : words.allSatisfy { broadText.contains($0) }
                    sourceKey = "symptoms"

                case "investigations":
                    // Synonym for "inv" — matches against investigation names + results.
                    let fv = f.value.lowercased()
                    let stop2: Set<String> = ["with","and","the","for","that","this","from","into","positive","negative","confirmed","elevated","raised","normal","abnormal","level","result"]
                    let fTok = fv.split(separator: " ").map(String.init).filter { $0.count >= 4 && !stop2.contains($0) }
                    let thr = max(1, Int((Double(fTok.count) * 0.6).rounded(.up)))
                    func invMatch(_ src: String) -> Bool {
                        src.contains(fv) || (fTok.count >= 2 && fTok.filter { src.contains($0) }.count >= thr)
                    }
                    triggered = invNames.contains(where: { invMatch($0) }) ||
                                invResults.contains(where: { invMatch($0) })
                    sourceKey = "investigation"

                case "exam_general":
                    // Matches against examGeneral text specifically, then broad exam.
                    let egL = examGeneral.lowercased()
                    let words2 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words2.allSatisfy { egL.contains($0) } ||
                                words2.allSatisfy { examL.contains($0) }
                    sourceKey = "exam"

                case "exam_abdo":
                    // Matches against examAbdo text specifically, then broad exam.
                    let eaL = examAbdo.lowercased()
                    let words3 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words3.allSatisfy { eaL.contains($0) } ||
                                words3.allSatisfy { examL.contains($0) }
                    sourceKey = "exam"

                case "exam_cvs":
                    let eCVS = examCVS.lowercased()
                    let words4 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words4.allSatisfy { eCVS.contains($0) } ||
                                words4.allSatisfy { examL.contains($0) }
                    sourceKey = "exam"

                case "socrates_character":
                    // DB stores character chips under this key; match against character SOCRATES.
                    let charSel = socrates["character"] ?? []
                    let fvLow = f.value.lowercased()
                    triggered = charSel.contains(where: { $0.lowercased().contains(fvLow) })
                    sourceKey = "symptoms"

                case "history", "risk_factors", "risk":
                    // Broad historical risk factor — match against PMH + medications + social.
                    let histText = ([pmh] + medsL + [socialText]).joined(separator: " ").lowercased()
                    triggered = histText.contains(f.value.lowercased())
                    sourceKey = "history"

                // ── SOCRATES synonym keys ─────────────────────────────────────────────
                case "socrates_timing", "duration":
                    let timeSel = (socrates["timing"] ?? []).union(socrates["duration"] ?? [])
                    let fvT = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = timeSel.contains(where: { $0.lowercased().contains(fvT) }) ||
                                examL.contains(fvT)
                    sourceKey = "symptoms"

                case "socrates_duration":
                    let durSel = (socrates["timing"] ?? []).union(socrates["duration"] ?? [])
                    let fvSD = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = durSel.contains(where: { $0.lowercased().contains(fvSD) })
                    sourceKey = "symptoms"

                case "socrates_site":
                    let siteSel = socrates["site"] ?? []
                    triggered = siteSel.contains(where: { $0.lowercased().contains(f.value.lowercased()) })
                    sourceKey = "symptoms"

                case "aggravating":
                    let aggSel = (socrates["exacerbating"] ?? []).union(socrates["aggravating"] ?? [])
                    let fvAgg = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = aggSel.contains(where: { $0.lowercased().contains(fvAgg) })
                    sourceKey = "symptoms"

                case "pain":
                    let painSel = (socrates["character"] ?? []).union(socrates["severity"] ?? [])
                    let fvPain = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = painSel.contains(where: { $0.lowercased().contains(fvPain) }) ||
                                examL.contains(fvPain)
                    sourceKey = "symptoms"

                // ── Imaging investigation result keys ────────────────────────────────
                case "ct_abdomen":
                    triggered = invModalityMatch(keywords: ["ct ", "ct-", "computed tomography", "abdomen ct", "abdo ct"], finding: f.value)
                    sourceKey = "investigation"

                case "ultrasound", "uss":
                    triggered = invModalityMatch(keywords: ["ultrasound", "uss", "u/s", "sonograph"], finding: f.value)
                    sourceKey = "investigation"

                case "cxr":
                    triggered = invModalityMatch(keywords: ["cxr", "chest x-ray", "chest xray", "chest x ray", "chest radiograph"], finding: f.value)
                    sourceKey = "investigation"

                case "mri":
                    triggered = invModalityMatch(keywords: ["mri", "magnetic resonance"], finding: f.value)
                    sourceKey = "investigation"

                case "ecg":
                    triggered = invModalityMatch(keywords: ["ecg", "ekg", "electrocardiograph", "electrocardiogram"], finding: f.value)
                    sourceKey = "investigation"

                case "biopsy":
                    triggered = invModalityMatch(keywords: ["biopsy", "histolog", "patholog", "tissue diagnos"], finding: f.value)
                    sourceKey = "investigation"

                // ── Lab investigation result keys ────────────────────────────────────
                case "wbc":
                    let fvWBC = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let wbcSrc = invResults.filter { $0.contains("wbc") || $0.contains("white cell") ||
                                                     $0.contains("white blood cell") || $0.contains("leukocyt") }
                    if !wbcSrc.isEmpty {
                        if fvWBC.contains("markedly") {
                            triggered = wbcSrc.contains(where: { $0.contains("markedly") || $0.contains("severely") })
                        } else {
                            triggered = wbcSrc.contains(where: { $0.contains("elevat") || $0.contains("high") ||
                                                                   $0.contains("raised") || $0.contains("neutrophil") ||
                                                                   $0.contains("leukocytosis") || $0.contains(fvWBC) })
                        }
                    }
                    sourceKey = "investigation"

                case "iron_deficiency_anaemia":
                    triggered = invResults.contains(where: {
                        $0.contains("iron deficiency") || $0.contains("ferritin") ||
                        $0.contains("microcytic") || $0.contains("hypochromic") || $0.contains("iron deficien")
                    })
                    sourceKey = "investigation"

                case "hba1c":
                    triggered = invResults.contains(where: { $0.contains("hba1c") || $0.contains("glycated haemoglobin") || $0.contains("hemoglobin a1c") })
                    sourceKey = "investigation"

                case "lactate":
                    let lacSrc = invResults.filter { $0.contains("lactate") || $0.contains("lactic acid") }
                    let fvLac = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = lacSrc.contains(where: { $0.contains(fvLac) }) ||
                                (fvLac.contains("elevated") || fvLac.contains("above") || fvLac.contains("raised"))
                                && lacSrc.contains(where: { $0.contains("elevat") || $0.contains("high") ||
                                                             $0.contains("raised") || $0.contains("≥") || $0.contains(">=") })
                    sourceKey = "investigation"

                case "blood_culture":
                    triggered = invModalityMatch(keywords: ["blood culture", "blood cx", "bacteraemia", "bacteremia"], finding: f.value)
                    sourceKey = "investigation"

                // ── Examination finding keys ─────────────────────────────────────────
                case "splenomegaly":
                    triggered = examL.contains("splenomegaly") || examL.contains("enlarged spleen") || examL.contains("spleen enlarged")
                    sourceKey = "exam"

                case "haematuria":
                    let fvHaem = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let haemSrc = [examAbdo, examGeneral, examOther].joined(separator: " ").lowercased()
                    triggered = haemSrc.contains("haematuria") || haemSrc.contains("hematuria") ||
                                haemSrc.contains("blood in urine") ||
                                invResults.contains(where: { $0.contains("haematuria") || $0.contains("hematuria") }) ||
                                (fvHaem == "microscopic" && (haemSrc.contains("microscopic") || haemSrc.contains("dipstick")))
                    sourceKey = "exam"

                case "rash":
                    let fvRash = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let rashSrc = [examSkin, examGeneral].joined(separator: " ").lowercased()
                    let rashToks = fvRash.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = rashToks.isEmpty ? rashSrc.contains("rash") || rashSrc.contains(fvRash)
                               : rashToks.allSatisfy { rashSrc.contains($0) }
                    sourceKey = "exam"

                case "distribution":
                    let fvDist = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let distSrc = [examSkin, examGeneral].joined(separator: " ").lowercased()
                    let distToks = fvDist.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = distToks.isEmpty ? distSrc.contains(fvDist)
                               : distToks.filter { distSrc.contains($0) }.count >= max(1, distToks.count / 2)
                    sourceKey = "exam"

                case "hearing":
                    let hearSrc = [examNeuro, examOther, examGeneral].joined(separator: " ").lowercased()
                    let fvHear = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = hearSrc.contains("hearing") || hearSrc.contains("ear") || hearSrc.contains(fvHear)
                    sourceKey = "exam"

                case "haemodynamic_instability":
                    let hdSrc = [examGeneral, examCVS, examAbdo].joined(separator: " ").lowercased()
                    triggered = hdSrc.contains("haemodynamic") || hdSrc.contains("hemodynamic") ||
                                hdSrc.contains("shocked") || hdSrc.contains("shock") ||
                                (hdSrc.contains("tachycardia") && hdSrc.contains("hypotension")) ||
                                (socrates["associations"] ?? []).contains(where: {
                                    let s = $0.lowercased()
                                    return s.contains("hypotension") || s.contains("tachycardia")
                                })
                    sourceKey = "exam"

                // ── History / demographics ───────────────────────────────────────────
                case "age":
                    let fvAge = f.value.lowercased()
                    switch true {
                    case fvAge == "young_adult" || fvAge == "young": triggered = age < 35
                    case fvAge == "middle_aged":                     triggered = age >= 35 && age < 60
                    case fvAge == "elderly" || fvAge == "older" || fvAge == "old": triggered = age >= 65
                    default:
                        let nums = fvAge.components(separatedBy: CharacterSet(charactersIn: "0123456789").inverted)
                                        .compactMap(Int.init)
                        if let n = nums.first {
                            if fvAge.contains("over") || fvAge.contains("above") || fvAge.contains(">") ||
                               fvAge.contains("older") || fvAge.hasPrefix("over_") {
                                triggered = age >= n
                            } else if fvAge.contains("under") || fvAge.contains("below") || fvAge.contains("<") {
                                triggered = age > 0 && age < n
                            }
                        }
                    }
                    sourceKey = "demographics"

                case "fever":
                    let feverSrc = [examGeneral, examAbdo].joined(separator: " ").lowercased()
                    triggered = feverSrc.contains("fever") || feverSrc.contains("febrile") ||
                                feverSrc.contains("pyrexia") ||
                                (socrates["associations"] ?? []).contains(where: { $0.lowercased().contains("fever") })
                    sourceKey = "symptoms"

                case "family_history":
                    let fvFH = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let fhToks = fvFH.split(separator: " ").map(String.init).filter { $0.count >= 3 }
                    triggered = fhToks.isEmpty ? pmhL.contains("family history") || pmhL.contains(fvFH)
                               : pmhL.contains("family") &&
                                 fhToks.filter { pmhL.contains($0) }.count >= max(1, fhToks.count / 2)
                    sourceKey = "history"

                case "weight_loss":
                    let wlSrc = ([examGeneral, pmh, socialText] + socrates.values.flatMap { Array($0) })
                                .joined(separator: " ").lowercased()
                    triggered = wlSrc.contains("weight loss") || wlSrc.contains("weight_loss") ||
                                wlSrc.contains("losing weight") || wlSrc.contains("cachexia") ||
                                wlSrc.contains("unintentional weight")
                    sourceKey = "symptoms"

                case "headache":
                    let hdSrc2 = (socrates.values.flatMap { Array($0) } + [examGeneral, examNeuro, examOther])
                                .joined(separator: " ").lowercased()
                    let fvHD = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let hdToks = fvHD.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = hdToks.isEmpty ? hdSrc2.contains("headache") || hdSrc2.contains(fvHD)
                               : hdToks.allSatisfy { hdSrc2.contains($0) }
                    sourceKey = "symptoms"

                case "hypertension":
                    let htSrc = [pmh, socialText].joined(separator: " ").lowercased()
                    triggered = htSrc.contains("hypertension") || htSrc.contains(" htn") || htSrc.contains("high blood pressure")
                    sourceKey = "history"

                case "diabetes":
                    let dbSrc = [pmh, socialText].joined(separator: " ").lowercased()
                    triggered = dbSrc.contains("diabetes") || dbSrc.contains("diabetic") ||
                                dbSrc.contains(" dm2") || dbSrc.contains(" dm1") || dbSrc.contains(" dm ")
                    sourceKey = "history"

                case "location":
                    let fvLoc = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let locToks = fvLoc.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    let locSrc = (invResults + [examAbdo, examGeneral]).joined(separator: " ").lowercased()
                    triggered = locToks.isEmpty ? locSrc.contains(fvLoc)
                               : locToks.filter { locSrc.contains($0) }.count >= max(1, locToks.count / 2)
                    sourceKey = "exam"

                case "recurrence":
                    let recSrc = [pmh, socialText].joined(separator: " ").lowercased()
                    triggered = recSrc.contains("recurr") || recSrc.contains(f.value.lowercased().replacingOccurrences(of: "_", with: " "))
                    sourceKey = "history"

                // ── Short clinical abbreviation keys (≤3 chars, missed by default pass 2) ──
                case "crp":
                    let crpSrc = invResults.filter { $0.contains("crp") || $0.contains("c-reactive protein") || $0.contains("c reactive protein") }
                    let fvCRP = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = crpSrc.contains(where: { $0.contains(fvCRP) }) ||
                                (fvCRP.contains("elevated") || fvCRP.contains("raised") || fvCRP.contains("rising"))
                                && crpSrc.contains(where: { $0.contains("elevat") || $0.contains("high") || $0.contains("raised") || $0.contains("rising") })
                    sourceKey = "investigation"

                case "esr_crp", "crp_esr", "wbc_crp":
                    let inflSrc = invResults.filter { $0.contains("crp") || $0.contains("esr") || $0.contains("wbc") ||
                                                       $0.contains("erythrocyte sedimentation") || $0.contains("inflammatory marker") }
                    let fvInfl = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = inflSrc.contains(where: { $0.contains("elevat") || $0.contains("raised") || $0.contains("high") || $0.contains(fvInfl) })
                    sourceKey = "investigation"

                case "ogd":
                    triggered = invModalityMatch(keywords: ["ogd", "oesophagogastroduodenoscopy", "upper endoscopy", "upper gi endoscopy", "gastroscopy"], finding: f.value)
                    sourceKey = "investigation"

                case "ct":
                    triggered = invModalityMatch(keywords: ["ct ", "ct-", "computed tomography"], finding: f.value)
                    sourceKey = "investigation"

                case "us":
                    triggered = invModalityMatch(keywords: ["ultrasound", "uss", "u/s", "sonograph"], finding: f.value)
                    sourceKey = "investigation"

                case "fbc":
                    let fvFBC = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let fbcSrc = invResults.filter { $0.contains("fbc") || $0.contains("full blood count") || $0.contains("complete blood count") }
                    triggered = fbcSrc.contains(where: { $0.contains(fvFBC) }) ||
                                (fbcSrc.contains(where: { $0.contains("anaemia") || $0.contains("pancytopenia") || $0.contains("neutropenia") }))
                    sourceKey = "investigation"

                case "fna":
                    triggered = invModalityMatch(keywords: ["fna", "fine needle", "fnac", "fine-needle"], finding: f.value)
                    sourceKey = "investigation"

                case "ck":
                    let ckSrc = invResults.filter { $0.contains(" ck ") || $0.contains("creatine kinase") || $0.contains("ck:") || $0.hasPrefix("ck ") }
                    let fvCK = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = ckSrc.contains(where: { $0.contains("elevat") || $0.contains("raised") || $0.contains("high") || $0.contains(fvCK) })
                    sourceKey = "investigation"

                case "mri_dwi":
                    triggered = invModalityMatch(keywords: ["mri", "dwi", "diffusion weighted", "diffusion-weighted"], finding: f.value)
                    sourceKey = "investigation"

                case "hla_b27":
                    triggered = invResults.contains(where: { $0.contains("hla") && $0.contains("b27") }) ||
                                invResults.contains(where: { $0.contains("hla-b27") || $0.contains("hla b27") })
                    sourceKey = "investigation"

                case "hpv":
                    triggered = invResults.contains(where: { $0.contains("hpv") || $0.contains("human papillomavirus") })
                    sourceKey = "investigation"

                case "alt_ast":
                    let liverSrc = invResults.filter { $0.contains("alt") || $0.contains("ast") || $0.contains("alanine") || $0.contains("aspartate") }
                    let fvLiver = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = liverSrc.contains(where: { $0.contains("elevat") || $0.contains("raised") || $0.contains("above") || $0.contains(fvLiver) })
                    sourceKey = "investigation"

                case "pcr":
                    let fvPCR = f.value.lowercased()
                    triggered = invResults.contains(where: { $0.contains("pcr") && ($0.contains("positive") || fvPCR.contains("positive") || $0.contains("detected")) })
                    sourceKey = "investigation"

                case "bp":
                    let bpSrc = [examCVS, examGeneral].joined(separator: " ").lowercased()
                    let fvBP = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = bpSrc.contains("hypertension") || bpSrc.contains("severely elevated") ||
                                bpSrc.contains("markedly elevated") || bpSrc.contains("bp elevated") ||
                                bpSrc.contains(fvBP) ||
                                (socrates["associations"] ?? []).contains(where: { $0.lowercased().contains("hyperten") })
                    sourceKey = "exam"

                case "bmi":
                    let fvBMI = f.value.lowercased()
                    if let b = bmi {
                        switch true {
                        case fvBMI.contains("above_30") || fvBMI.contains("overweight") || fvBMI.contains("obese"): triggered = b >= 30
                        case fvBMI.contains("lean") || fvBMI.contains("normal"):                                      triggered = b < 25
                        default:
                            if let n = fvBMI.components(separatedBy: CharacterSet(charactersIn:"0123456789").inverted).compactMap(Int.init).first {
                                triggered = fvBMI.contains("above") || fvBMI.contains("over") ? b >= Double(n) : b < Double(n)
                            }
                        }
                    } else {
                        triggered = pmhL.contains("obese") || pmhL.contains("overweight") || pmhL.contains("obesity")
                    }
                    sourceKey = "demographics"

                case "sex":
                    let fvSex = f.value.lowercased()
                    triggered = (fvSex == "male" && sex == .male) || (fvSex == "female" && sex == .female)
                    sourceKey = "demographics"

                case "age_over_50":
                    triggered = age >= 50
                    sourceKey = "demographics"

                default:
                    // Pass 1: SOCRATES dict lookup — specialist early-form chips may store
                    // any custom DB key (e.g. lucid_interval, ecg, triad_nph) into
                    // socratesSelections, letting specialty pool features fire from intake
                    // without structural changes to those pools.
                    if let sel = socrates[f.key], !sel.isEmpty {
                        triggered = sel.contains(where: { $0.lowercased().contains(f.value.lowercased()) })
                        sourceKey = "symptoms"
                    }
                    // Pass 2: Singleton clinical-finding keys — the DB stores ~5500 unique keys
                    // that encode the finding name directly (e.g. "flank_or_loin_pain",
                    // "retrosternal_chest_pain_squeezing"). Extract meaningful words from the
                    // key and look for them in the broad clinical record.
                    if !triggered {
                        let keyStop: Set<String> = ["pain","sign","test","with","type","form",
                                                     "and","the","for","from","that","this",
                                                     "into","also","show","seen","find","rate",
                                                     "does","have","been","true","false","over",
                                                     "under","each","both","when","more","less"]
                        let keyToks = f.key.lowercased()
                            .replacingOccurrences(of: "_or_", with: " ")
                            .replacingOccurrences(of: "_", with: " ")
                            .split(separator: " ").map(String.init)
                            .filter { $0.count >= 4 && !keyStop.contains($0) }
                        if !keyToks.isEmpty {
                            let broadSrc = ([pmh, pshx, examAbdo, examGeneral, examCVS,
                                             examResp, examNeuro, examMSK, examSkin, examOther,
                                             socialText]
                                            + invResults + invNames
                                            + socrates.values.flatMap { Array($0) })
                                .joined(separator: " ").lowercased()
                            let matchCount = keyToks.filter { broadSrc.contains($0) }.count
                            let threshold  = max(1, keyToks.count / 2)
                            let findingPresent = matchCount >= threshold
                            let fvL = f.value.lowercased()
                            let isNegated = fvL == "absent" || fvL == "false" || fvL == "no" ||
                                            fvL == "negative" || fvL == "none" || fvL == "normal"
                            triggered  = isNegated ? !findingPresent : findingPresent
                            sourceKey  = "symptoms"
                        }
                    }
                }

                if triggered {
                    // Apply CPT-based discounting when a correlated parent feature has
                    // already been observed — avoids double-counting co-occurring findings.
                    let effectiveLR: Int
                    if let nid = Self.featureNetworkID(key: f.key, value: f.value) {
                        let adj = BayesianFeatureNetwork.adjustedLogLR(
                            featureID: nid,
                            featurePresent: true,
                            observedIDs: observedNetworkIDs,
                            baseLogLR: Double(f.logLR)
                        )
                        effectiveLR = Int(adj.rounded())
                    } else {
                        effectiveLR = f.logLR
                    }
                    logP += effectiveLR
                    if effectiveLR > 0 && !f.evidenceLabel.isEmpty {
                        evidence.append(f.evidenceLabel)
                        // Suppress demographics from the evidence panel (age/sex are context, not findings)
                        if sourceKey != "demographics" && sourceKey != "other" {
                            evidenceSources[sourceKey, default: []].append(f.evidenceLabel)
                        }
                    }
                    // Track pathognomonic findings (LR+ ≥ 36 ≙ logLR ≥ 18) — these gravitationally enforce working diagnosis
                    if f.logLR >= 18 && !f.evidenceLabel.isEmpty {
                        pathognomicFindings.append(f.evidenceLabel)
                    }
                }
            }

            return ScoredCandidate(candidate: c, logPosterior: logP, evidence: evidence,
                                   evidenceSources: evidenceSources, pathognomicFindings: pathognomicFindings)
        }
    }

    // MARK: - Feature → DAG node ID mapping
    // Maps (feature key, value) pairs to BayesianFeatureNetwork node IDs so CPT-based
    // discounting fires when correlated features co-occur in the same candidate scoring pass.

    private static func featureNetworkID(key: String, value: String) -> String? {
        let v = value.lowercased()
        switch key {
        case "associations",
             "associated":  // synonym — same DAG mapping
            if v.contains("raised wbc") || v.contains("elevated wbc") || v.contains("leukocytosis") { return "wbc_elevated" }
            if v.contains("elevated crp") || v.contains("raised crp") { return "crp_elevated" }
            if v.contains("elevated lactate") || v.contains("raised lactate") { return "lactate_raised" }
            if v.contains("fever") || v.contains("pyrexia") { return "fever" }
            if v.contains("tachycardia") { return "tachycardia" }
            if v.contains("hypotension") { return "hypotension" }
            if v.contains("haemoptysis") || v.contains("hemoptysis") { return "haemoptysis" }
            if v.contains("dyspnoea") || v.contains("dyspnea") || v.contains("shortness of breath") { return "dyspnoea" }
            if v.contains("pleuritic") { return "pleuritic_pain" }
            if v.contains("dark urine") { return "dark_urine" }
            if v.contains("pale stool") || v.contains("clay stool") { return "pale_stool" }
            if v.contains("jaundice") { return "jaundice" }
            if v.contains("paraesthesia") || v.contains("paresthesia") || v.contains("numbness") { return "paresthesia" }
        case "exam",
             "exam_general",  // synonym keys — same physical-exam DAG mapping
             "exam_abdo",
             "exam_cvs":
            if v.contains("guarding") { return "guarding" }
            if v.contains("rebound") { return "rebound" }
            if v.contains("rigidity") { return "rigidity" }
            if v.contains("pallor") && !v.contains("limb") && !v.contains("leg") && !v.contains("arm") { return "pallor" }
            if v.contains("cold") && (v.contains("limb") || v.contains("extremit") || v.contains("foot") || v.contains("leg")) { return "cold_limb" }
            if v.contains("absent pulse") || v.contains("pulse absent") || v.contains("pulseless") { return "pulselessness" }
            if v.contains("murphy") { return "murphy_sign" }
            if v.contains("jaundice") { return "jaundice" }
        case "onset", "character",
             "socrates_character":  // synonym — same onset/character mapping
            if v.contains("pleuritic") { return "pleuritic_pain" }
            if v.contains("dyspnoea") || v.contains("dyspnea") { return "dyspnoea" }
        case "site",
             "socrates_site":  // synonym
            if v.contains("right upper") || v.contains("ruq") { return "ruq_pain" }
        default:
            break
        }
        return nil
    }

    // MARK: - Log-gap normalisation → top 5 results
    // Architecture: logGap (rank-1 minus rank-2 log-posterior) is the primary confidence
    // signal — it measures how much the evidence statistically separates rank-1 from the field.
    // Softmax probability is computed for display only and is NOT the architectural decision metric.

    private static func topResults(from scored: [ScoredCandidate]) -> [DiagnosisResult] {
        guard !scored.isEmpty else { return [] }

        // Sort by log-posterior BEFORE softmax — this preserves the gap signal
        let byLogP = scored.sorted { $0.logPosterior > $1.logPosterior }

        // logGap: rank-1 minus rank-2 in log-posterior space (or rank-1's own score if only one)
        let logGap = byLogP.count >= 2
            ? byLogP[0].logPosterior - byLogP[1].logPosterior
            : max(byLogP[0].logPosterior, 0)

        // Softmax for display only
        let maxScore = byLogP[0].logPosterior
        let exps = byLogP.map { exp(Double($0.logPosterior - maxScore)) }
        let total = exps.reduce(0, +)

        let withProb = zip(byLogP, exps).map { (s, e) -> (ScoredCandidate, Int) in
            let prob = total > 0 ? Int((e / total) * 100.0) : 0
            return (s, prob)
        }

        return withProb.prefix(5).enumerated().map { (idx, pair) in
            let (s, prob) = pair
            // Only rank-1 carries the gap; lower ranks carry 0
            let gap = idx == 0 ? logGap : 0

            // Confidence driven by logGap (rank-1) or pathognomonic finding (any rank)
            let conf: DiagnosisResult.Confidence
            switch gap {
            case 25...: conf = .certain
            case 15...: conf = .high
            case 7...:  conf = .moderate
            default:
                conf = s.pathognomicFindings.isEmpty ? .low : .high
            }

            return DiagnosisResult(
                name: s.candidate.name,
                icdCode: s.candidate.icd,
                probability: prob,
                evidence: Array(s.evidence.prefix(6)),
                evidenceSources: s.evidenceSources.mapValues { Array($0.prefix(4)) },
                confidence: conf,
                rawLogPosterior: s.logPosterior,
                logGap: gap,
                pathognomicFindings: s.pathognomicFindings,
                urgency: s.candidate.urgency
            )
        }
    }

    // MARK: - External diagnostic database (DiagnosticDatabase.json)
    // JSON file in the app bundle; evidence-based LR values with citations.
    // Engine prefers loaded pools; falls back to hardcoded arrays if absent.

    struct CandidateSpec: Codable {
        let name: String
        let icd: String
        let logPrior: Int
        /// Clinical urgency tier (0=routine, 1=urgent, 2=emergency, 3=critical).
        /// Drives two behaviours:
        ///   a) Matrix overlay bypass: urgency ≥ 1 exempts from the logPrior > 45 noise filter.
        ///   b) Bayesian logPrior boost: urgency × 8 added at scoring so "don't miss"
        ///      diagnoses surface even with sparse feature evidence.
        let urgency: Int?
        let features: [FeatureSpec]

        struct FeatureSpec: Codable {
            let key: String
            let value: String
            let logLR: Int
            let evidenceLabel: String
            let citation: String?
        }

        func toCandidate() -> Candidate {
            Candidate(name: name, icd: icd, logPrior: logPrior,
                      urgency: urgency ?? 0,
                      features: features.map { f in
                          Candidate.Feature(key: f.key, value: f.value,
                                            logLR: f.logLR, evidenceLabel: f.evidenceLabel)
                      })
        }
    }

    /// Wrapper matching the JSON pool object `{"candidates": [...]}`
    struct PoolSpec: Codable {
        let candidates: [CandidateSpec]
    }

    /// Top-level matrix section of DiagnosticDatabase.json.
    /// Encodes the ICD-11 / SNOMED CT polyhierarchy: each disease is tagged with
    /// all its body systems and clinical specialties, enabling cross-specialty query.
    struct MatrixSpec: Codable {
        let version: String
        let authority: String
        /// system name → [disease names]
        let systemIndex: [String: [String]]
        /// specialty name → [disease names]
        let specialtyIndex: [String: [String]]
        /// CC keyword → [system names]  (lowercase keys)
        let ccToSystems: [String: [String]]
        /// Z-axis: urgency tier → [disease names]
        /// Tiers: "critical" (life-threatening, urgency=3),
        ///        "emergency" (organ/limb threat, urgency=2),
        ///        "urgent" (function threat, urgency=1),
        ///        "routine" (non-urgent, urgency=0)
        let urgencyIndex: [String: [String]]
    }

    struct CandidateDatabase: Codable {
        let version: String
        let pools: [String: PoolSpec]
        let matrix: MatrixSpec?
    }

    // Lazy-loaded once at first access; nil if file absent or unparseable.
    static let externalDatabase: CandidateDatabase? = {
        guard let url = Bundle.main.url(forResource: "DiagnosticDatabase", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(CandidateDatabase.self, from: data)
    }()

    // Convenience: load a candidate pool from the external database, or return nil.
    private static func externalPool(_ name: String) -> [Candidate]? {
        externalDatabase?.pools[name].map { $0.candidates.map { $0.toCandidate() } }
    }

    /// Cross-specialty matrix query implementing an X/Y/Z polyhierarchy model.
    ///
    /// **X axis** — `ccToSystems`: CC keywords → body systems
    /// **Y axis** — `systemIndex` / `specialtyIndex`: systems → disease names,
    ///   optionally narrowed to a specialty context via `specialtyHint`
    /// **Z axis** — `urgencyIndex`: urgency tier safety net
    ///   - `critical` (urgency=3, life-threatening) and `emergency` (urgency=2,
    ///     organ/limb threat) diseases that fall in the X-axis system set are always
    ///     included, bypassing the specialty intersection entirely — a clinician in
    ///     any specialty must never miss an immediately life- or organ-threatening
    ///     diagnosis that is system-relevant to the presenting CC.
    ///   - `urgent` / `routine` diseases are subject to the full X-Y filter.
    static func matrixCandidates(forCC cc: String, specialtyHint: String? = nil) -> [Candidate] {
        guard let db = externalDatabase, let mx = db.matrix else { return [] }
        let ccL = cc.lowercased()

        // ── X axis: CC → body systems ────────────────────────────────────────
        var matchedSystems = Set<String>()
        for (keyword, systems) in mx.ccToSystems where ccL.contains(keyword) {
            systems.forEach { matchedSystems.insert($0) }
        }
        guard !matchedSystems.isEmpty else { return [] }

        // ── Y axis: systems → full disease name set ───────────────────────────
        var allSystemDiseases = Set<String>()
        for system in matchedSystems {
            mx.systemIndex[system]?.forEach { allSystemDiseases.insert($0) }
        }

        // ── Z axis: safety-net — critical + emergency diseases ────────────────
        // These bypass specialty filtering; their urgency score ensures they rank
        // high enough to be surfaced in the final differential.
        var safetyNetDiseases = Set<String>()
        for tier in ["critical", "emergency"] {
            mx.urgencyIndex[tier]?.forEach {
                if allSystemDiseases.contains($0) { safetyNetDiseases.insert($0) }
            }
        }

        // ── Y × specialty: narrow the non-safety-net diseases ────────────────
        // UI hint names (e.g. "General & GI Surgery") use human-readable labels;
        // specialtyIndex keys use camelCase (e.g. "generalSurgery"). The expansion
        // map handles compound names; bidirectional contains handles simple ones.
        var filteredDiseases = allSystemDiseases
        if let hint = specialtyHint, !hint.isEmpty {
            let hintL = hint.lowercased()
            let hintExpansion: [String: [String]] = [
                "general & gi surgery":  ["generalSurgery", "upperGISurgery", "colorectalSurgery", "gastroenterology"],
                "cardiovascular":        ["cardiology", "vascularSurgery", "cardiothoracicSurgery"],
                "endocrine & metabolic": ["endocrinology"],
                "urology & renal":       ["urology", "nephrology"],
                "musculoskeletal":       ["orthopaedics", "rheumatology"],
                "infectious & tropical": ["infectiousDisease"],
                "internal medicine":     ["internalMedicine"],
            ]
            var specialtyDiseases = Set<String>()
            if let keys = hintExpansion[hintL] {
                for key in keys {
                    mx.specialtyIndex[key]?.forEach { specialtyDiseases.insert($0) }
                }
            } else {
                for (key, diseases) in mx.specialtyIndex {
                    let kL = key.lowercased()
                    if kL.contains(hintL) || hintL.contains(kL) {
                        specialtyDiseases.formUnion(diseases)
                    }
                }
            }
            if !specialtyDiseases.isEmpty {
                filteredDiseases = filteredDiseases.intersection(specialtyDiseases)
            }
        }

        // Merge: specialty-filtered diseases ∪ Z-axis safety net
        let diseaseNames = filteredDiseases.union(safetyNetDiseases)
        guard !diseaseNames.isEmpty else { return [] }

        // ── Look up candidates from pools ─────────────────────────────────────
        // Threshold filter: logPrior > 45 = very common background diseases that
        // pollute cross-specialty results (back pain, gastroenteritis etc.).
        // Exemptions: urgency ≥ 1 bypasses logPrior cap; Z-axis safety-net
        // diseases bypass both the logPrior cap and specialty filter (above).
        var seen = Set<String>()
        var result: [Candidate] = []
        for (_, poolSpec) in db.pools {
            for spec in poolSpec.candidates where diseaseNames.contains(spec.name) && seen.insert(spec.name).inserted {
                let u = spec.urgency ?? 0
                guard spec.logPrior <= 45 || u >= 1 else { continue }
                result.append(spec.toCandidate())
            }
        }
        return result.sorted { $0.logPrior > $1.logPrior }
    }

    // MARK: - Diagnostic catalogue (search + browse)

    /// A lightweight descriptor used for browsing and search — no scoring weights.
    struct CatalogueEntry: Identifiable {
        let id = UUID()
        let name: String
        let icd: String
        let pool: String        // pool key (e.g. "headache", "abdominalPain")
        let logPrior: Int       // base prevalence — higher = more common

        /// Clinical priority tier derived from logPrior:
        ///   A (≥40) — very common; B (25–39) — common;
        ///   C (10–24) — less common; D (<10) — rare / contextual
        var tier: String {
            switch logPrior {
            case 40...: return "A"
            case 25..<40: return "B"
            case 10..<25: return "C"
            default: return "D"
            }
        }
    }

    /// All candidates from the external database across all pools, deduplicated by name.
    static var allCatalogueEntries: [CatalogueEntry] {
        guard let db = externalDatabase else { return [] }
        var seen = Set<String>()
        var result: [CatalogueEntry] = []
        for (poolKey, poolSpec) in db.pools.sorted(by: { $0.key < $1.key }) {
            for spec in poolSpec.candidates {
                guard seen.insert(spec.name).inserted else { continue }
                result.append(CatalogueEntry(name: spec.name, icd: spec.icd,
                                              pool: poolKey, logPrior: spec.logPrior))
            }
        }
        return result.sorted { $0.logPrior > $1.logPrior }
    }

    /// Search catalogue by diagnosis name, ICD code, or pool (symptom domain).
    /// Returns up to 20 matches, sorted by prevalence descending.
    static func searchCatalogue(_ query: String) -> [CatalogueEntry] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        return allCatalogueEntries.filter {
            $0.name.lowercased().contains(q) ||
            $0.icd.lowercased().hasPrefix(q) ||
            $0.pool.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    // MARK: - Candidate tables

    // ── Abdominal pain ────────────────────────────────────────────────

    private static let abdominalPain: [Candidate] = [
        .init(name: "Acute Appendicitis", icd: "K37",
              logPrior: 30, features: [
            .init(key: "site", value: "RLQ", logLR: 12, evidenceLabel: "RLQ pain"),
            .init(key: "site", value: "Periumbilical", logLR: 6, evidenceLabel: "Periumbilical onset"),
            .init(key: "onset", value: "Sudden", logLR: 8, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Nausea", logLR: 4, evidenceLabel: "Nausea"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Anorexia", logLR: 8, evidenceLabel: "Anorexia"),
            .init(key: "character", value: "Sharp", logLR: 5, evidenceLabel: "Sharp pain"),
            .init(key: "exam", value: "rebound", logLR: 14, evidenceLabel: "Rebound tenderness"),
            .init(key: "exam", value: "guarding", logLR: 12, evidenceLabel: "Guarding"),
            .init(key: "exam", value: "rovsing", logLR: 10, evidenceLabel: "Rovsing positive"),
            .init(key: "exam", value: "mcburney", logLR: 12, evidenceLabel: "McBurney's tender"),
            .init(key: "age_over", value: "15", logLR: 3, evidenceLabel: "Peak incidence age"),
            .init(key: "age_over", value: "60", logLR: -5, evidenceLabel: ""),
            .init(key: "site", value: "LLQ", logLR: -8, evidenceLabel: ""),
            .init(key: "site", value: "RUQ", logLR: -10, evidenceLabel: ""),
        ]),
        .init(name: "Acute Cholecystitis", icd: "K81.0",
              logPrior: 28, features: [
            .init(key: "site", value: "RUQ", logLR: 14, evidenceLabel: "RUQ pain"),
            .init(key: "radiation", value: "Right shoulder", logLR: 12, evidenceLabel: "Radiation to right shoulder"),
            .init(key: "exacerbating", value: "Fatty food", logLR: 10, evidenceLabel: "Worse with fatty food"),
            .init(key: "associations", value: "Nausea", logLR: 6, evidenceLabel: "Nausea/vomiting"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Jaundice", logLR: 6, evidenceLabel: "Jaundice"),
            .init(key: "character", value: "Colicky", logLR: 5, evidenceLabel: "Colicky character"),
            .init(key: "exam", value: "murphy", logLR: 14, evidenceLabel: "Murphy's sign positive"),
            .init(key: "exam", value: "tender ruq", logLR: 10, evidenceLabel: "RUQ tender"),
            .init(key: "inv", value: "ultrasound", logLR: 6, evidenceLabel: "Abdominal USS ordered"),
            .init(key: "inv", value: "gallstone", logLR: 16, evidenceLabel: "Gallstones on USS"),
            .init(key: "pmh", value: "gallstone", logLR: 10, evidenceLabel: "Known gallstones"),
            .init(key: "sex_female", value: "", logLR: 4, evidenceLabel: "Female sex (higher prevalence)"),
            .init(key: "age_over", value: "40", logLR: 4, evidenceLabel: "Age >40"),
        ]),
        .init(name: "Biliary Colic", icd: "K80.20",
              logPrior: 25, features: [
            .init(key: "site", value: "RUQ", logLR: 12, evidenceLabel: "RUQ pain"),
            .init(key: "character", value: "Colicky", logLR: 12, evidenceLabel: "Colicky pain"),
            .init(key: "exacerbating", value: "Fatty food", logLR: 10, evidenceLabel: "Fatty food trigger"),
            .init(key: "radiation", value: "Right shoulder", logLR: 8, evidenceLabel: "Radiation to right shoulder"),
            .init(key: "timing", value: "Episodic", logLR: 8, evidenceLabel: "Episodic"),
            .init(key: "timing", value: "Post-prandial", logLR: 8, evidenceLabel: "Post-prandial"),
            .init(key: "associations", value: "Nausea", logLR: 5, evidenceLabel: "Nausea"),
            .init(key: "associations", value: "Fever", logLR: -8, evidenceLabel: ""),   // fever → cholecystitis
            .init(key: "pmh", value: "gallstone", logLR: 10, evidenceLabel: "Known gallstones"),
            .init(key: "inv", value: "gallstone", logLR: 14, evidenceLabel: "Gallstones on USS"),
            .init(key: "sex_female", value: "", logLR: 3, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Acute Pancreatitis", icd: "K85.90",
              logPrior: 20, features: [
            .init(key: "site", value: "Epigastric", logLR: 12, evidenceLabel: "Epigastric pain"),
            .init(key: "radiation", value: "Back", logLR: 16, evidenceLabel: "Radiation to back"),
            .init(key: "relieving", value: "Sitting forward", logLR: 12, evidenceLabel: "Relief sitting forward"),
            .init(key: "exacerbating", value: "Alcohol", logLR: 12, evidenceLabel: "Alcohol history"),
            .init(key: "exacerbating", value: "Fatty food", logLR: 8, evidenceLabel: "Fatty food"),
            .init(key: "associations", value: "Vomiting", logLR: 6, evidenceLabel: "Vomiting"),
            .init(key: "associations", value: "Nausea", logLR: 4, evidenceLabel: "Nausea"),
            .init(key: "character", value: "Severe", logLR: 4, evidenceLabel: "Severe pain"),
            .init(key: "inv", value: "lipase", logLR: 16, evidenceLabel: "Lipase elevated"),
            .init(key: "inv", value: "amylase", logLR: 12, evidenceLabel: "Amylase elevated"),
            .init(key: "pmh", value: "gallstone", logLR: 8, evidenceLabel: "Known gallstones (biliary cause)"),
            .init(key: "pmh", value: "alcohol", logLR: 10, evidenceLabel: "Alcohol use"),
        ]),
        .init(name: "Peptic Ulcer Disease", icd: "K27.90",
              logPrior: 20, features: [
            .init(key: "site", value: "Epigastric", logLR: 12, evidenceLabel: "Epigastric pain"),
            .init(key: "character", value: "Burning", logLR: 10, evidenceLabel: "Burning character"),
            .init(key: "relieving", value: "Antacids", logLR: 12, evidenceLabel: "Antacid relief"),
            .init(key: "relieving", value: "Eating", logLR: 6, evidenceLabel: "Relief with eating"),
            .init(key: "exacerbating", value: "NSAIDs", logLR: 10, evidenceLabel: "NSAID use"),
            .init(key: "timing", value: "Nocturnal", logLR: 6, evidenceLabel: "Nocturnal pain"),
            .init(key: "associations", value: "Melaena", logLR: 14, evidenceLabel: "Melaena"),
            .init(key: "associations", value: "Haematochezia", logLR: 8, evidenceLabel: "Rectal bleeding"),
            .init(key: "pmh", value: "helicobacter", logLR: 10, evidenceLabel: "H. pylori history"),
            .init(key: "pmh", value: "ulcer", logLR: 12, evidenceLabel: "Previous peptic ulcer"),
            .init(key: "pmh", value: "nsaid", logLR: 8, evidenceLabel: "NSAID history"),
        ]),
        .init(name: "GERD / Oesophagitis", icd: "K21.00",
              logPrior: 18, features: [
            .init(key: "site", value: "Epigastric", logLR: 8, evidenceLabel: "Epigastric pain"),
            .init(key: "character", value: "Burning", logLR: 10, evidenceLabel: "Burning sensation"),
            .init(key: "associations", value: "Heartburn", logLR: 14, evidenceLabel: "Heartburn"),
            .init(key: "exacerbating", value: "Lying flat", logLR: 12, evidenceLabel: "Worse lying flat"),
            .init(key: "exacerbating", value: "Alcohol", logLR: 4, evidenceLabel: "Alcohol"),
            .init(key: "relieving", value: "Antacids", logLR: 10, evidenceLabel: "Antacid relief"),
            .init(key: "timing", value: "Post-prandial", logLR: 8, evidenceLabel: "Post-prandial"),
            .init(key: "timing", value: "Nocturnal", logLR: 6, evidenceLabel: "Nocturnal"),
        ]),
        .init(name: "Irritable Bowel Syndrome", icd: "K58.90",
              logPrior: 15, features: [
            .init(key: "character", value: "Cramping", logLR: 10, evidenceLabel: "Cramping pain"),
            .init(key: "site", value: "LLQ", logLR: 6, evidenceLabel: "LLQ pain"),
            .init(key: "site", value: "Diffuse", logLR: 4, evidenceLabel: "Diffuse pain"),
            .init(key: "relieving", value: "Defaecation", logLR: 14, evidenceLabel: "Relief with defaecation"),
            .init(key: "timing", value: "Intermittent", logLR: 6, evidenceLabel: "Intermittent"),
            .init(key: "timing", value: "Worse over time", logLR: -4, evidenceLabel: ""),
            .init(key: "associations", value: "Change in bowel habit", logLR: 8, evidenceLabel: "Change in bowel habit"),
            .init(key: "associations", value: "Fever", logLR: -8, evidenceLabel: ""),
            .init(key: "age_under", value: "50", logLR: 4, evidenceLabel: "Younger age"),
        ]),
        .init(name: "Acute Diverticulitis", icd: "K57.32",
              logPrior: 18, features: [
            .init(key: "site", value: "LLQ", logLR: 14, evidenceLabel: "LLQ pain"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Change in bowel habit", logLR: 8, evidenceLabel: "Change in bowel habit"),
            .init(key: "character", value: "Constant", logLR: 4, evidenceLabel: "Constant pain"),
            .init(key: "exam", value: "llq tender", logLR: 10, evidenceLabel: "LLQ tenderness"),
            .init(key: "age_over", value: "50", logLR: 10, evidenceLabel: "Age >50"),
            .init(key: "pmh", value: "divert", logLR: 14, evidenceLabel: "Known diverticular disease"),
        ]),
        .init(name: "Inguinal Hernia", icd: "K40.90",
              logPrior: 15, features: [
            .init(key: "site", value: "Groin", logLR: 16, evidenceLabel: "Groin pain"),
            .init(key: "character", value: "Pulling", logLR: 10, evidenceLabel: "Pulling sensation"),
            .init(key: "exacerbating", value: "Straining", logLR: 10, evidenceLabel: "Worse with straining"),
            .init(key: "exacerbating", value: "Coughing", logLR: 8, evidenceLabel: "Worse with coughing"),
            .init(key: "exam", value: "cough impulse", logLR: 14, evidenceLabel: "Cough impulse"),
            .init(key: "exam", value: "reducible", logLR: 10, evidenceLabel: "Reducible swelling"),
            .init(key: "sex_male", value: "", logLR: 6, evidenceLabel: "Male sex (higher prevalence)"),
        ]),
        .init(name: "Renal / Ureteric Colic", icd: "N20.10",
              logPrior: 12, features: [
            .init(key: "site", value: "Loin", logLR: 14, evidenceLabel: "Loin pain"),
            .init(key: "site", value: "Groin", logLR: 10, evidenceLabel: "Radiation to groin"),
            .init(key: "character", value: "Colicky", logLR: 12, evidenceLabel: "Colicky pain"),
            .init(key: "associations", value: "Haematuria", logLR: 16, evidenceLabel: "Haematuria"),
            .init(key: "associations", value: "Nausea", logLR: 4, evidenceLabel: "Nausea"),
            .init(key: "radiation", value: "Groin", logLR: 12, evidenceLabel: "Radiation to groin"),
            .init(key: "pmh", value: "renal stone", logLR: 14, evidenceLabel: "Previous renal stones"),
            .init(key: "pmh", value: "kidney stone", logLR: 14, evidenceLabel: "Previous kidney stones"),
        ]),
    ]

    // ── Jaundice ──────────────────────────────────────────────────────

    private static let jaundice: [Candidate] = [
        .init(name: "Choledocholithiasis", icd: "K80.50",
              logPrior: 35, features: [
            .init(key: "site", value: "RUQ", logLR: 10, evidenceLabel: "RUQ pain"),
            .init(key: "character", value: "Colicky", logLR: 8, evidenceLabel: "Colicky pain"),
            .init(key: "associations", value: "Fever", logLR: 6, evidenceLabel: "Fever"),
            .init(key: "pmh", value: "gallstone", logLR: 14, evidenceLabel: "Known gallstones"),
            .init(key: "inv", value: "bilirubin", logLR: 12, evidenceLabel: "Elevated bilirubin"),
            .init(key: "inv", value: "alp", logLR: 8, evidenceLabel: "Raised ALP"),
            .init(key: "inv", value: "cbd", logLR: 14, evidenceLabel: "Dilated CBD on USS"),
            .init(key: "inv", value: "ultrasound", logLR: 4, evidenceLabel: "USS performed"),
        ]),
        .init(name: "Ascending Cholangitis", icd: "K83.09",
              logPrior: 25, features: [
            .init(key: "associations", value: "Fever", logLR: 14, evidenceLabel: "Fever (Charcot's triad)"),
            .init(key: "associations", value: "Rigors", logLR: 14, evidenceLabel: "Rigors"),
            .init(key: "site", value: "RUQ", logLR: 10, evidenceLabel: "RUQ pain"),
            .init(key: "exam", value: "septic", logLR: 12, evidenceLabel: "Septic appearance"),
            .init(key: "inv", value: "wbc", logLR: 10, evidenceLabel: "Raised WBC"),
            .init(key: "pmh", value: "gallstone", logLR: 10, evidenceLabel: "Known gallstones"),
            .init(key: "age_over", value: "60", logLR: 4, evidenceLabel: "Elderly"),
        ]),
        .init(name: "Carcinoma of Head of Pancreas", icd: "C25.0",
              logPrior: 15, features: [
            .init(key: "timing", value: "Progressive", logLR: 14, evidenceLabel: "Progressive jaundice"),
            .init(key: "timing", value: "Worse over time", logLR: 12, evidenceLabel: "Worsening over time"),
            .init(key: "associations", value: "Weight loss", logLR: 16, evidenceLabel: "Weight loss"),
            .init(key: "associations", value: "Anorexia", logLR: 10, evidenceLabel: "Anorexia"),
            .init(key: "character", value: "Dull", logLR: 6, evidenceLabel: "Dull background pain"),
            .init(key: "radiation", value: "Back", logLR: 8, evidenceLabel: "Back pain"),
            .init(key: "exam", value: "courvoisier", logLR: 16, evidenceLabel: "Courvoisier's sign"),
            .init(key: "exam", value: "palpable.*gall", logLR: 12, evidenceLabel: "Palpable gallbladder"),
            .init(key: "age_over", value: "55", logLR: 10, evidenceLabel: "Age >55"),
            .init(key: "inv", value: "ca 19", logLR: 14, evidenceLabel: "CA 19-9 elevated"),
            .init(key: "inv", value: "dilated pancreatic", logLR: 14, evidenceLabel: "Dilated pancreatic duct"),
        ]),
        .init(name: "Viral Hepatitis", icd: "B17.9",
              logPrior: 18, features: [
            .init(key: "onset", value: "Gradual", logLR: 8, evidenceLabel: "Gradual onset"),
            .init(key: "associations", value: "Fever", logLR: 6, evidenceLabel: "Fever"),
            .init(key: "timing", value: "Progressive", logLR: 4, evidenceLabel: "Progressive"),
            .init(key: "exam", value: "hepatomegaly", logLR: 10, evidenceLabel: "Hepatomegaly"),
            .init(key: "exam", value: "tender liver", logLR: 8, evidenceLabel: "Tender liver"),
            .init(key: "inv", value: "alt", logLR: 12, evidenceLabel: "Raised ALT"),
            .init(key: "inv", value: "ast", logLR: 10, evidenceLabel: "Raised AST"),
            .init(key: "age_under", value: "40", logLR: 6, evidenceLabel: "Younger age"),
        ]),
        .init(name: "Haemolytic Jaundice", icd: "D59.9",
              logPrior: 8, features: [
            .init(key: "associations", value: "Fever", logLR: 4, evidenceLabel: "Fever"),
            .init(key: "site", value: "RUQ", logLR: -4, evidenceLabel: ""),
            .init(key: "inv", value: "anaemia", logLR: 12, evidenceLabel: "Anaemia"),
            .init(key: "inv", value: "reticulocyte", logLR: 10, evidenceLabel: "Reticulocytosis"),
            .init(key: "pmh", value: "sickle", logLR: 14, evidenceLabel: "Sickle cell disease"),
            .init(key: "pmh", value: "thalassaemia", logLR: 12, evidenceLabel: "Thalassaemia"),
        ]),
    ]

    // ── Dysphagia ─────────────────────────────────────────────────────

    private static let dysphagia: [Candidate] = [
        .init(name: "Oesophageal Carcinoma", icd: "C15.9",
              logPrior: 20, features: [
            .init(key: "timing", value: "Progressive", logLR: 16, evidenceLabel: "Progressive dysphagia"),
            .init(key: "timing", value: "Worse over time", logLR: 14, evidenceLabel: "Worsening"),
            .init(key: "associations", value: "Weight loss", logLR: 16, evidenceLabel: "Weight loss"),
            .init(key: "associations", value: "Anorexia", logLR: 10, evidenceLabel: "Anorexia"),
            .init(key: "character", value: "Progressive", logLR: 12, evidenceLabel: "Solid → liquid progression"),
            .init(key: "age_over", value: "55", logLR: 12, evidenceLabel: "Age >55"),
            .init(key: "pmh", value: "gerd", logLR: 8, evidenceLabel: "GERD history"),
            .init(key: "pmh", value: "barrett", logLR: 14, evidenceLabel: "Barrett's oesophagus"),
            .init(key: "exacerbating", value: "Alcohol", logLR: 6, evidenceLabel: "Alcohol"),
            .init(key: "inv", value: "oesophagoscopy", logLR: 12, evidenceLabel: "Endoscopy performed"),
            .init(key: "inv", value: "ogd", logLR: 8, evidenceLabel: "OGD performed"),
        ]),
        .init(name: "GERD / Oesophagitis", icd: "K21.00",
              logPrior: 30, features: [
            .init(key: "associations", value: "Heartburn", logLR: 16, evidenceLabel: "Heartburn"),
            .init(key: "exacerbating", value: "Lying flat", logLR: 12, evidenceLabel: "Worse lying flat"),
            .init(key: "exacerbating", value: "Eating", logLR: 6, evidenceLabel: "After eating"),
            .init(key: "timing", value: "Post-prandial", logLR: 10, evidenceLabel: "Post-prandial"),
            .init(key: "character", value: "Burning", logLR: 12, evidenceLabel: "Burning"),
            .init(key: "relieving", value: "Antacids", logLR: 12, evidenceLabel: "Antacid relief"),
            .init(key: "timing", value: "Progressive", logLR: -6, evidenceLabel: ""),
        ]),
        .init(name: "Achalasia", icd: "K22.0",
              logPrior: 15, features: [
            .init(key: "timing", value: "Intermittent", logLR: 8, evidenceLabel: "Intermittent dysphagia"),
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Progressive"),
            .init(key: "associations", value: "Vomiting", logLR: 8, evidenceLabel: "Regurgitation"),
            .init(key: "onset", value: "Gradual", logLR: 6, evidenceLabel: "Gradual onset"),
            .init(key: "timing", value: "Nocturnal", logLR: 8, evidenceLabel: "Nocturnal regurgitation"),
        ]),
        .init(name: "Oesophageal Stricture / Peptic", icd: "K22.2",
              logPrior: 12, features: [
            .init(key: "pmh", value: "gerd", logLR: 12, evidenceLabel: "GERD history"),
            .init(key: "pmh", value: "reflux", logLR: 12, evidenceLabel: "Reflux history"),
            .init(key: "associations", value: "Heartburn", logLR: 8, evidenceLabel: "Heartburn"),
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Progressive stricture"),
            .init(key: "age_over", value: "50", logLR: 6, evidenceLabel: "Older age"),
        ]),
    ]

    // ── Rectal bleeding ───────────────────────────────────────────────

    private static let rectalBleeding: [Candidate] = [
        .init(name: "Haemorrhoids", icd: "K64.9",
              logPrior: 40, features: [
            .init(key: "character", value: "Bright", logLR: 12, evidenceLabel: "Bright red blood"),
            .init(key: "timing", value: "Post-defaecation", logLR: 10, evidenceLabel: "After defaecation"),
            .init(key: "associations", value: "Constipation", logLR: 8, evidenceLabel: "Constipation"),
            .init(key: "site", value: "Perineal", logLR: 8, evidenceLabel: "Perineal"),
            .init(key: "exam", value: "haemorrhoid", logLR: 14, evidenceLabel: "Haemorrhoids on PR"),
            .init(key: "associations", value: "Fever", logLR: -6, evidenceLabel: ""),
        ]),
        .init(name: "Colorectal Carcinoma", icd: "C18.9",
              logPrior: 15, features: [
            .init(key: "associations", value: "Change in bowel habit", logLR: 14, evidenceLabel: "Change in bowel habit"),
            .init(key: "associations", value: "Weight loss", logLR: 14, evidenceLabel: "Weight loss"),
            .init(key: "associations", value: "Anorexia", logLR: 8, evidenceLabel: "Anorexia"),
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive symptoms"),
            .init(key: "age_over", value: "50", logLR: 12, evidenceLabel: "Age >50"),
            .init(key: "exam", value: "mass", logLR: 14, evidenceLabel: "Palpable abdominal mass"),
            .init(key: "inv", value: "cea", logLR: 12, evidenceLabel: "Raised CEA"),
            .init(key: "inv", value: "anaemia", logLR: 10, evidenceLabel: "Iron deficiency anaemia"),
            .init(key: "pmh", value: "polyp", logLR: 12, evidenceLabel: "Previous polyps"),
            .init(key: "pmh", value: "colorectal", logLR: 12, evidenceLabel: "FH colorectal cancer"),
        ]),
        .init(name: "Inflammatory Bowel Disease", icd: "K51.90",
              logPrior: 18, features: [
            .init(key: "associations", value: "Diarrhoea", logLR: 12, evidenceLabel: "Diarrhoea"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Fever"),
            .init(key: "character", value: "Cramping", logLR: 8, evidenceLabel: "Crampy pain"),
            .init(key: "timing", value: "Intermittent", logLR: 6, evidenceLabel: "Relapsing-remitting"),
            .init(key: "age_under", value: "45", logLR: 6, evidenceLabel: "Younger patient"),
            .init(key: "pmh", value: "crohn", logLR: 14, evidenceLabel: "Crohn's disease"),
            .init(key: "pmh", value: "colitis", logLR: 14, evidenceLabel: "Ulcerative colitis"),
        ]),
        .init(name: "Anal Fissure", icd: "K60.2",
              logPrior: 20, features: [
            .init(key: "character", value: "Sharp", logLR: 10, evidenceLabel: "Sharp anal pain"),
            .init(key: "site", value: "Perineal", logLR: 8, evidenceLabel: "Perineal pain"),
            .init(key: "exacerbating", value: "Defaecation", logLR: 12, evidenceLabel: "Pain during defaecation"),
            .init(key: "associations", value: "Constipation", logLR: 10, evidenceLabel: "Constipation"),
            .init(key: "exam", value: "fissure", logLR: 16, evidenceLabel: "Fissure on PR exam"),
        ]),
    ]

    // ── Change in bowel habit ─────────────────────────────────────────

    private static let bowelHabit: [Candidate] = [
        .init(name: "Colorectal Carcinoma", icd: "C18.9",
              logPrior: 20, features: [
            .init(key: "associations", value: "Rectal bleeding", logLR: 12, evidenceLabel: "Rectal bleeding"),
            .init(key: "associations", value: "Weight loss", logLR: 14, evidenceLabel: "Weight loss"),
            .init(key: "timing", value: "Progressive", logLR: 12, evidenceLabel: "Progressive change"),
            .init(key: "age_over", value: "50", logLR: 14, evidenceLabel: "Age >50"),
            .init(key: "inv", value: "cea", logLR: 12, evidenceLabel: "Raised CEA"),
            .init(key: "inv", value: "anaemia", logLR: 10, evidenceLabel: "Anaemia"),
            .init(key: "pmh", value: "polyp", logLR: 10, evidenceLabel: "Previous polyps"),
        ]),
        .init(name: "Irritable Bowel Syndrome", icd: "K58.90",
              logPrior: 35, features: [
            .init(key: "relieving", value: "Defaecation", logLR: 14, evidenceLabel: "Relief with defaecation"),
            .init(key: "character", value: "Cramping", logLR: 10, evidenceLabel: "Crampy pain"),
            .init(key: "timing", value: "Intermittent", logLR: 8, evidenceLabel: "Intermittent"),
            .init(key: "age_under", value: "50", logLR: 6, evidenceLabel: "Younger patient"),
            .init(key: "associations", value: "Fever", logLR: -8, evidenceLabel: ""),
            .init(key: "associations", value: "Rectal bleeding", logLR: -6, evidenceLabel: ""),
        ]),
        .init(name: "Inflammatory Bowel Disease", icd: "K51.90",
              logPrior: 18, features: [
            .init(key: "associations", value: "Rectal bleeding", logLR: 10, evidenceLabel: "Rectal bleeding"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "timing", value: "Intermittent", logLR: 6, evidenceLabel: "Relapsing"),
            .init(key: "age_under", value: "45", logLR: 6, evidenceLabel: "Younger patient"),
            .init(key: "pmh", value: "crohn", logLR: 14, evidenceLabel: "Crohn's disease"),
            .init(key: "pmh", value: "colitis", logLR: 14, evidenceLabel: "Ulcerative colitis"),
        ]),
        .init(name: "Diverticular Disease", icd: "K57.90",
              logPrior: 15, features: [
            .init(key: "site", value: "LLQ", logLR: 8, evidenceLabel: "LLQ pain"),
            .init(key: "age_over", value: "50", logLR: 12, evidenceLabel: "Age >50"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Fever (diverticulitis)"),
            .init(key: "pmh", value: "divert", logLR: 14, evidenceLabel: "Known diverticular disease"),
        ]),
    ]

    // ── Hernia / groin lump ───────────────────────────────────────────

    private static let hernia: [Candidate] = [
        .init(name: "Inguinal Hernia", icd: "K40.90",
              logPrior: 50, features: [
            .init(key: "site", value: "Groin", logLR: 16, evidenceLabel: "Groin location"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "exacerbating", value: "Straining", logLR: 10, evidenceLabel: "Worse with straining"),
            .init(key: "exacerbating", value: "Coughing", logLR: 10, evidenceLabel: "Worse with coughing"),
            .init(key: "exam", value: "cough impulse", logLR: 14, evidenceLabel: "Cough impulse"),
            .init(key: "exam", value: "reducible", logLR: 12, evidenceLabel: "Reducible"),
            .init(key: "pshx", value: "hernia", logLR: 8, evidenceLabel: "Previous hernia repair"),
        ]),
        .init(name: "Femoral Hernia", icd: "K41.90",
              logPrior: 15, features: [
            .init(key: "site", value: "Groin", logLR: 10, evidenceLabel: "Groin"),
            .init(key: "sex_female", value: "", logLR: 8, evidenceLabel: "Female sex"),
            .init(key: "exam", value: "below inguinal", logLR: 12, evidenceLabel: "Below inguinal ligament"),
            .init(key: "character", value: "Pulling", logLR: 6, evidenceLabel: "Pulling sensation"),
        ]),
        .init(name: "Umbilical Hernia", icd: "K42.9",
              logPrior: 18, features: [
            .init(key: "site", value: "Periumbilical", logLR: 16, evidenceLabel: "Periumbilical"),
            .init(key: "exam", value: "umbilical", logLR: 14, evidenceLabel: "Umbilical defect"),
            .init(key: "pmh", value: "obesity", logLR: 6, evidenceLabel: "Obesity"),
            .init(key: "pmh", value: "ascites", logLR: 6, evidenceLabel: "Ascites/raised IAP"),
        ]),
        .init(name: "Incisional Hernia", icd: "K43.9",
              logPrior: 12, features: [
            .init(key: "pshx", value: "", logLR: 12, evidenceLabel: "Previous abdominal surgery"),
            .init(key: "exam", value: "scar", logLR: 12, evidenceLabel: "Surgical scar present"),
            .init(key: "pmh", value: "obesity", logLR: 6, evidenceLabel: "Obesity"),
        ]),
    ]

    // ── Perianal ──────────────────────────────────────────────────────

    private static let perianal: [Candidate] = [
        .init(name: "Haemorrhoids", icd: "K64.9",
              logPrior: 50, features: [
            .init(key: "associations", value: "Rectal bleeding", logLR: 10, evidenceLabel: "Rectal bleeding"),
            .init(key: "associations", value: "Constipation", logLR: 8, evidenceLabel: "Constipation"),
            .init(key: "exam", value: "haemorrhoid", logLR: 16, evidenceLabel: "Haemorrhoids on PR"),
            .init(key: "exam", value: "prolapse", logLR: 10, evidenceLabel: "Prolapsing haemorrhoids"),
        ]),
        .init(name: "Anal Fissure", icd: "K60.2",
              logPrior: 20, features: [
            .init(key: "character", value: "Sharp", logLR: 12, evidenceLabel: "Sharp pain"),
            .init(key: "exacerbating", value: "Straining", logLR: 10, evidenceLabel: "Pain with defaecation"),
            .init(key: "associations", value: "Constipation", logLR: 10, evidenceLabel: "Constipation"),
        ]),
        .init(name: "Perianal Abscess", icd: "K61.0",
              logPrior: 15, features: [
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever"),
            .init(key: "character", value: "Throbbing", logLR: 10, evidenceLabel: "Throbbing pain"),
            .init(key: "exam", value: "fluctuant", logLR: 14, evidenceLabel: "Fluctuant swelling"),
            .init(key: "exam", value: "erythema", logLR: 10, evidenceLabel: "Erythema"),
        ]),
        .init(name: "Anal Fistula", icd: "K60.3",
              logPrior: 10, features: [
            .init(key: "pmh", value: "abscess", logLR: 14, evidenceLabel: "Previous perianal abscess"),
            .init(key: "pmh", value: "crohn", logLR: 10, evidenceLabel: "Crohn's disease"),
            .init(key: "exam", value: "external opening", logLR: 14, evidenceLabel: "External opening noted"),
        ]),
    ]

    // ── Weight loss ───────────────────────────────────────────────────

    private static let weightLoss: [Candidate] = [
        .init(name: "Gastrointestinal Malignancy", icd: "C26.9",
              logPrior: 25, features: [
            .init(key: "age_over", value: "55", logLR: 12, evidenceLabel: "Age >55"),
            .init(key: "associations", value: "Anorexia", logLR: 10, evidenceLabel: "Anorexia"),
            .init(key: "associations", value: "Dysphagia", logLR: 10, evidenceLabel: "Dysphagia"),
            .init(key: "associations", value: "Rectal bleeding", logLR: 10, evidenceLabel: "Rectal bleeding"),
            .init(key: "associations", value: "Change in bowel habit", logLR: 10, evidenceLabel: "Change in bowel habit"),
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive"),
            .init(key: "exam", value: "mass", logLR: 14, evidenceLabel: "Palpable mass"),
        ]),
        .init(name: "Inflammatory Bowel Disease", icd: "K51.90",
              logPrior: 15, features: [
            .init(key: "associations", value: "Diarrhoea", logLR: 12, evidenceLabel: "Diarrhoea"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Fever"),
            .init(key: "age_under", value: "45", logLR: 8, evidenceLabel: "Younger patient"),
            .init(key: "pmh", value: "crohn", logLR: 14, evidenceLabel: "Crohn's disease"),
        ]),
        .init(name: "Diabetes Mellitus Type 2", icd: "E11.9",
              logPrior: 15, features: [
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes history"),
            .init(key: "inv", value: "hba1c", logLR: 12, evidenceLabel: "Elevated HbA1c"),
            .init(key: "inv", value: "glucose", logLR: 10, evidenceLabel: "Elevated glucose"),
        ]),
        .init(name: "Hyperthyroidism", icd: "E05.90",
              logPrior: 10, features: [
            .init(key: "exam", value: "tremor", logLR: 12, evidenceLabel: "Tremor"),
            .init(key: "exam", value: "goitre", logLR: 12, evidenceLabel: "Goitre"),
            .init(key: "exam", value: "tachycardia", logLR: 10, evidenceLabel: "Tachycardia"),
            .init(key: "inv", value: "tsh", logLR: 12, evidenceLabel: "Suppressed TSH"),
            .init(key: "sex_female", value: "", logLR: 4, evidenceLabel: "Female sex"),
        ]),
    ]

    // ── Groin pain (non-hernia) ───────────────────────────────────────

    private static let groinPain: [Candidate] = [
        .init(name: "Acute Appendicitis", icd: "K37",
              logPrior: 25, features: [
            .init(key: "site", value: "RLQ", logLR: 12, evidenceLabel: "RLQ pain"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Nausea", logLR: 6, evidenceLabel: "Nausea"),
            .init(key: "onset", value: "Sudden", logLR: 8, evidenceLabel: "Sudden onset"),
        ]),
        .init(name: "Inguinal Hernia", icd: "K40.90",
              logPrior: 30, features: [
            .init(key: "exam", value: "cough impulse", logLR: 14, evidenceLabel: "Cough impulse"),
            .init(key: "exacerbating", value: "Straining", logLR: 10, evidenceLabel: "Straining"),
            .init(key: "sex_male", value: "", logLR: 6, evidenceLabel: "Male sex"),
        ]),
        .init(name: "Renal / Ureteric Colic", icd: "N20.10",
              logPrior: 20, features: [
            .init(key: "character", value: "Colicky", logLR: 12, evidenceLabel: "Colicky"),
            .init(key: "associations", value: "Haematuria", logLR: 16, evidenceLabel: "Haematuria"),
            .init(key: "site", value: "Loin", logLR: 12, evidenceLabel: "Loin-to-groin radiation"),
        ]),
        .init(name: "Ovarian Pathology", icd: "N83.20",
              logPrior: 18, features: [
            .init(key: "sex_female", value: "", logLR: 12, evidenceLabel: "Female sex"),
            .init(key: "timing", value: "Episodic", logLR: 8, evidenceLabel: "Episodic pain"),
            .init(key: "site", value: "LLQ", logLR: 8, evidenceLabel: "LLQ/RLQ location"),
            .init(key: "site", value: "RLQ", logLR: 8, evidenceLabel: "LLQ/RLQ location"),
        ]),
    ]

    // ── Breast lump ───────────────────────────────────────────────────

    private static let breastLump: [Candidate] = [
        .init(name: "Benign Breast Cyst", icd: "N60.09",
              logPrior: 35, features: [
            .init(key: "timing", value: "Episodic", logLR: 8, evidenceLabel: "Cyclical symptoms"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex"),
            .init(key: "age_under", value: "55", logLR: 6, evidenceLabel: "Pre/peri-menopausal"),
            .init(key: "exam", value: "smooth", logLR: 8, evidenceLabel: "Smooth, mobile"),
            .init(key: "exam", value: "tender", logLR: 6, evidenceLabel: "Tender on palpation"),
        ]),
        .init(name: "Fibroadenoma", icd: "N60.29",
              logPrior: 25, features: [
            .init(key: "age_under", value: "35", logLR: 10, evidenceLabel: "Younger woman"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex"),
            .init(key: "exam", value: "mobile", logLR: 10, evidenceLabel: "Mobile lump ('breast mouse')"),
            .init(key: "exam", value: "firm", logLR: 6, evidenceLabel: "Firm texture"),
        ]),
        .init(name: "Breast Carcinoma", icd: "C50.919",
              logPrior: 15, features: [
            .init(key: "age_over", value: "40", logLR: 12, evidenceLabel: "Age >40"),
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Enlarging lump"),
            .init(key: "exam", value: "hard", logLR: 12, evidenceLabel: "Hard lump"),
            .init(key: "exam", value: "irregular", logLR: 12, evidenceLabel: "Irregular border"),
            .init(key: "exam", value: "skin change", logLR: 14, evidenceLabel: "Skin changes"),
            .init(key: "exam", value: "tethered", logLR: 12, evidenceLabel: "Tethered to skin/chest"),
            .init(key: "exam", value: "nipple", logLR: 10, evidenceLabel: "Nipple change/discharge"),
            .init(key: "associations", value: "Anorexia", logLR: 6, evidenceLabel: "Constitutional symptoms"),
            .init(key: "pmh", value: "breast", logLR: 8, evidenceLabel: "FH breast cancer"),
            .init(key: "sex_female", value: "", logLR: 4, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Breast Abscess", icd: "N61.1",
              logPrior: 8, features: [
            .init(key: "associations", value: "Fever", logLR: 14, evidenceLabel: "Fever"),
            .init(key: "character", value: "Throbbing", logLR: 10, evidenceLabel: "Throbbing pain"),
            .init(key: "exam", value: "fluctuant", logLR: 14, evidenceLabel: "Fluctuant swelling"),
            .init(key: "exam", value: "erythema", logLR: 12, evidenceLabel: "Erythema"),
        ]),
        .init(name: "Fat Necrosis", icd: "N64.1",
              logPrior: 8, features: [
            .init(key: "pshx", value: "trauma", logLR: 14, evidenceLabel: "History of trauma"),
            .init(key: "pshx", value: "surgery", logLR: 10, evidenceLabel: "Previous breast surgery"),
            .init(key: "exam", value: "hard", logLR: 8, evidenceLabel: "Hard lump"),
            .init(key: "exam", value: "skin", logLR: 6, evidenceLabel: "Skin tethering"),
            .init(key: "timing", value: "Gradual", logLR: 6, evidenceLabel: "Develops weeks after injury"),
        ]),
        .init(name: "Phyllodes Tumour", icd: "D48.6",
              logPrior: 4, features: [
            .init(key: "timing", value: "Progressive", logLR: 12, evidenceLabel: "Rapidly enlarging"),
            .init(key: "exam", value: "large", logLR: 10, evidenceLabel: "Large lump"),
            .init(key: "exam", value: "lobulated", logLR: 8, evidenceLabel: "Lobulated surface"),
            .init(key: "exam", value: "mobile", logLR: 6, evidenceLabel: "Mobile"),
            .init(key: "age_over", value: "35", logLR: 6, evidenceLabel: "Middle age"),
            .init(key: "age_under", value: "55", logLR: 4, evidenceLabel: "Pre-menopausal / peri-menopausal"),
        ]),
    ]

    // ── Neck / thyroid lump ───────────────────────────────────────────

    private static let neckLump: [Candidate] = [
        .init(name: "Benign Thyroid Nodule", icd: "E04.1",
              logPrior: 35, features: [
            .init(key: "exam", value: "midline", logLR: 10, evidenceLabel: "Midline lump"),
            .init(key: "exam", value: "moves on swallow", logLR: 16, evidenceLabel: "Moves on swallowing"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex (higher prevalence)"),
            .init(key: "timing", value: "Progressive", logLR: 4, evidenceLabel: "Slowly enlarging"),
        ]),
        .init(name: "Reactive Lymphadenopathy", icd: "R59.9",
              logPrior: 30, features: [
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever"),
            .init(key: "exam", value: "tender", logLR: 8, evidenceLabel: "Tender nodes"),
            .init(key: "exam", value: "multiple", logLR: 8, evidenceLabel: "Multiple nodes"),
            .init(key: "age_under", value: "40", logLR: 6, evidenceLabel: "Younger patient"),
        ]),
        .init(name: "Thyroid Carcinoma", icd: "C73",
              logPrior: 10, features: [
            .init(key: "exam", value: "hard", logLR: 10, evidenceLabel: "Hard nodule"),
            .init(key: "exam", value: "fixed", logLR: 12, evidenceLabel: "Fixed nodule"),
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Rapidly enlarging"),
            .init(key: "age_over", value: "45", logLR: 6, evidenceLabel: "Age >45"),
            .init(key: "pmh", value: "radiation", logLR: 12, evidenceLabel: "History of radiation"),
            .init(key: "inv", value: "fnac", logLR: 14, evidenceLabel: "FNAC suspicious"),
        ]),
        .init(name: "Lymphoma", icd: "C85.90",
              logPrior: 8, features: [
            .init(key: "associations", value: "Weight loss", logLR: 12, evidenceLabel: "Weight loss"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "B symptoms"),
            .init(key: "exam", value: "rubbery", logLR: 10, evidenceLabel: "Rubbery nodes"),
            .init(key: "exam", value: "multiple", logLR: 8, evidenceLabel: "Multiple node groups"),
            .init(key: "exam", value: "generalised", logLR: 8, evidenceLabel: "Generalised lymphadenopathy"),
        ]),
        .init(name: "Branchial Cyst", icd: "Q18.0",
              logPrior: 12, features: [
            .init(key: "site", value: "Anterior triangle", logLR: 14, evidenceLabel: "Anterior triangle of neck"),
            .init(key: "age_under", value: "30", logLR: 10, evidenceLabel: "Young adult"),
            .init(key: "character", value: "Cystic", logLR: 14, evidenceLabel: "Cystic / fluctuant"),
            .init(key: "exam", value: "smooth", logLR: 8, evidenceLabel: "Smooth, fluctuant"),
            .init(key: "exam", value: "transilluminates", logLR: 10, evidenceLabel: "Transilluminates"),
            .init(key: "timing", value: "Progressive", logLR: 6, evidenceLabel: "Slowly enlarging"),
        ]),
        .init(name: "Thyroglossal Duct Cyst", icd: "Q89.2",
              logPrior: 12, features: [
            .init(key: "site", value: "Midline", logLR: 16, evidenceLabel: "Midline neck"),
            .init(key: "exam", value: "moves on swallow", logLR: 16, evidenceLabel: "Moves on swallowing"),
            .init(key: "exam", value: "moves on tongue protrusion", logLR: 18, evidenceLabel: "Moves on tongue protrusion"),
            .init(key: "age_under", value: "25", logLR: 8, evidenceLabel: "Young patient"),
            .init(key: "character", value: "Cystic", logLR: 10, evidenceLabel: "Cystic texture"),
        ]),
        .init(name: "Carotid Body Tumour", icd: "D44.6",
              logPrior: 5, features: [
            .init(key: "site", value: "Anterior triangle", logLR: 12, evidenceLabel: "Anterior triangle, carotid bifurcation level"),
            .init(key: "exam", value: "pulsatile", logLR: 16, evidenceLabel: "Pulsatile lump"),
            .init(key: "exam", value: "bruit", logLR: 14, evidenceLabel: "Bruit audible"),
            .init(key: "exam", value: "transmits pulse", logLR: 14, evidenceLabel: "Transmits arterial pulsation"),
            .init(key: "character", value: "Firm", logLR: 6, evidenceLabel: "Firm, compressible"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Middle-age/older"),
        ]),
    ]

    // MARK: - Chest pain

    private static let chestPain: [Candidate] = [
        .init(name: "Acute Coronary Syndrome", icd: "I24.9",
              logPrior: 30, features: [
            .init(key: "character", value: "Pressure", logLR: 14, evidenceLabel: "Pressure-like pain"),
            .init(key: "character", value: "Crushing", logLR: 14, evidenceLabel: "Crushing pain"),
            .init(key: "radiation", value: "Arm", logLR: 14, evidenceLabel: "Radiation to arm"),
            .init(key: "radiation", value: "Jaw", logLR: 12, evidenceLabel: "Radiation to jaw"),
            .init(key: "associations", value: "Nausea", logLR: 6, evidenceLabel: "Nausea"),
            .init(key: "exacerbating", value: "Exertion", logLR: 10, evidenceLabel: "Exertional"),
            .init(key: "relieving", value: "Nitrates", logLR: 14, evidenceLabel: "Nitrate relief"),
            .init(key: "onset", value: "Sudden", logLR: 8, evidenceLabel: "Sudden onset"),
            .init(key: "pmh", value: "ischaemic heart", logLR: 12, evidenceLabel: "IHD history"),
            .init(key: "pmh", value: "diabetes", logLR: 6, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "hypertension", logLR: 5, evidenceLabel: "Hypertension"),
            .init(key: "age_over", value: "45", logLR: 8, evidenceLabel: "Age >45"),
            .init(key: "sex_male", value: "", logLR: 4, evidenceLabel: "Male sex"),
            .init(key: "inv", value: "troponin", logLR: 18, evidenceLabel: "Troponin elevated"),
            .init(key: "inv", value: "ecg", logLR: 8, evidenceLabel: "ECG performed"),
        ]),
        .init(name: "Stable Angina", icd: "I20.9",
              logPrior: 20, features: [
            .init(key: "timing", value: "Episodic", logLR: 10, evidenceLabel: "Episodic"),
            .init(key: "exacerbating", value: "Exertion", logLR: 14, evidenceLabel: "Exertional"),
            .init(key: "relieving", value: "Rest", logLR: 10, evidenceLabel: "Relief with rest"),
            .init(key: "character", value: "Pressure", logLR: 10, evidenceLabel: "Pressure"),
            .init(key: "pmh", value: "ischaemic heart", logLR: 12, evidenceLabel: "IHD"),
            .init(key: "pmh", value: "diabetes", logLR: 5, evidenceLabel: "Diabetes"),
            .init(key: "age_over", value: "50", logLR: 6, evidenceLabel: "Older age"),
        ]),
        .init(name: "Pulmonary Embolism", icd: "I26.99",
              logPrior: 12, features: [
            .init(key: "character", value: "Sharp", logLR: 10, evidenceLabel: "Pleuritic chest pain"),
            .init(key: "associations", value: "Shortness of breath", logLR: 12, evidenceLabel: "Dyspnoea"),
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "pmh", value: "dvt", logLR: 14, evidenceLabel: "Previous DVT"),
            .init(key: "pmh", value: "pe", logLR: 14, evidenceLabel: "Previous PE"),
            .init(key: "pmh", value: "malignancy", logLR: 10, evidenceLabel: "Malignancy"),
            .init(key: "inv", value: "d-dimer", logLR: 12, evidenceLabel: "Elevated D-dimer"),
            .init(key: "inv", value: "ctpa", logLR: 18, evidenceLabel: "CTPA performed"),
        ]),
        .init(name: "GERD / Oesophagitis", icd: "K21.00",
              logPrior: 25, features: [
            .init(key: "character", value: "Burning", logLR: 12, evidenceLabel: "Burning sensation"),
            .init(key: "exacerbating", value: "Lying flat", logLR: 12, evidenceLabel: "Worse lying flat"),
            .init(key: "exacerbating", value: "Eating", logLR: 6, evidenceLabel: "After meals"),
            .init(key: "relieving", value: "Antacids", logLR: 12, evidenceLabel: "Antacid relief"),
            .init(key: "timing", value: "Post-prandial", logLR: 8, evidenceLabel: "Post-prandial"),
        ]),
        .init(name: "Musculoskeletal Chest Pain", icd: "M79.3",
              logPrior: 20, features: [
            .init(key: "exacerbating", value: "Movement", logLR: 14, evidenceLabel: "Movement"),
            .init(key: "exacerbating", value: "Deep breathing", logLR: 10, evidenceLabel: "Deep breathing"),
            .init(key: "exacerbating", value: "Coughing", logLR: 8, evidenceLabel: "Coughing"),
            .init(key: "character", value: "Sharp", logLR: 8, evidenceLabel: "Sharp pain"),
            .init(key: "exam", value: "tender", logLR: 12, evidenceLabel: "Chest wall tenderness"),
            .init(key: "inv", value: "troponin", logLR: -8, evidenceLabel: ""),
        ]),
    ]

    // MARK: - Shortness of breath

    private static let shortnessOfBreath: [Candidate] = [
        .init(name: "Asthma (Acute Exacerbation)", icd: "J45.901",
              logPrior: 30, features: [
            .init(key: "character", value: "Wheeze", logLR: 16, evidenceLabel: "Wheeze"),
            .init(key: "timing", value: "Episodic", logLR: 8, evidenceLabel: "Episodic"),
            .init(key: "timing", value: "Nocturnal", logLR: 8, evidenceLabel: "Nocturnal"),
            .init(key: "exacerbating", value: "Exertion", logLR: 6, evidenceLabel: "Exertional"),
            .init(key: "pmh", value: "asthma", logLR: 14, evidenceLabel: "Asthma history"),
            .init(key: "pmh", value: "atopy", logLR: 8, evidenceLabel: "Atopy"),
            .init(key: "age_under", value: "40", logLR: 4, evidenceLabel: "Younger age"),
        ]),
        .init(name: "Heart Failure", icd: "I50.9",
              logPrior: 20, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive dyspnoea"),
            .init(key: "timing", value: "Nocturnal", logLR: 10, evidenceLabel: "Orthopnoea / PND"),
            .init(key: "exam", value: "oedema", logLR: 12, evidenceLabel: "Peripheral oedema"),
            .init(key: "exam", value: "crepitation", logLR: 12, evidenceLabel: "Lung crepitations"),
            .init(key: "exam", value: "raised jvp", logLR: 12, evidenceLabel: "Raised JVP"),
            .init(key: "pmh", value: "heart failure", logLR: 14, evidenceLabel: "Known heart failure"),
            .init(key: "pmh", value: "ischaemic heart", logLR: 10, evidenceLabel: "IHD"),
            .init(key: "inv", value: "bnp", logLR: 14, evidenceLabel: "Elevated BNP"),
            .init(key: "age_over", value: "60", logLR: 6, evidenceLabel: "Older age"),
        ]),
        .init(name: "Community-Acquired Pneumonia", icd: "J18.9",
              logPrior: 25, features: [
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever"),
            .init(key: "character", value: "Sharp", logLR: 6, evidenceLabel: "Pleuritic pain"),
            .init(key: "associations", value: "Cough", logLR: 10, evidenceLabel: "Productive cough"),
            .init(key: "exam", value: "crepitation", logLR: 12, evidenceLabel: "Crepitations"),
            .init(key: "exam", value: "consolidation", logLR: 14, evidenceLabel: "Consolidation"),
            .init(key: "inv", value: "cxr", logLR: 8, evidenceLabel: "CXR performed"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Raised WBC"),
            .init(key: "age_over", value: "65", logLR: 6, evidenceLabel: "Elderly"),
        ]),
        .init(name: "COPD Exacerbation", icd: "J44.1",
              logPrior: 18, features: [
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Progressive"),
            .init(key: "character", value: "Wheeze", logLR: 10, evidenceLabel: "Wheeze"),
            .init(key: "associations", value: "Cough", logLR: 8, evidenceLabel: "Productive cough"),
            .init(key: "pmh", value: "copd", logLR: 18, evidenceLabel: "COPD history"),
            .init(key: "pmh", value: "smoking", logLR: 10, evidenceLabel: "Smoking history"),
            .init(key: "age_over", value: "50", logLR: 8, evidenceLabel: "Age >50"),
        ]),
        .init(name: "Pulmonary Tuberculosis", icd: "A15.0",
              logPrior: 10, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive"),
            .init(key: "associations", value: "Weight loss", logLR: 12, evidenceLabel: "Weight loss"),
            .init(key: "associations", value: "Night sweats", logLR: 12, evidenceLabel: "Night sweats"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Low-grade fever"),
            .init(key: "associations", value: "Haemoptysis", logLR: 14, evidenceLabel: "Haemoptysis"),
            .init(key: "pmh", value: "tb", logLR: 12, evidenceLabel: "Previous TB"),
            .init(key: "pmh", value: "hiv", logLR: 10, evidenceLabel: "Immunocompromised"),
        ]),
    ]

    // MARK: - Fever / Infection (Caribbean-weighted)

    private static let feverInfection: [Candidate] = [
        .init(name: "Dengue Fever", icd: "A90",
              logPrior: 35, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Severe", logLR: 8, evidenceLabel: "Severe pain"),
            .init(key: "associations", value: "Bone pain", logLR: 14, evidenceLabel: "Bone/joint pain"),
            .init(key: "associations", value: "Rash", logLR: 12, evidenceLabel: "Rash"),
            .init(key: "associations", value: "Headache", logLR: 8, evidenceLabel: "Headache"),
            .init(key: "associations", value: "Retroorbital pain", logLR: 14, evidenceLabel: "Retroorbital pain"),
            .init(key: "exam", value: "petechiae", logLR: 14, evidenceLabel: "Petechiae"),
            .init(key: "inv", value: "thrombocytopenia", logLR: 14, evidenceLabel: "Thrombocytopenia"),
            .init(key: "inv", value: "platelet", logLR: 10, evidenceLabel: "Low platelets"),
            .init(key: "inv", value: "ns1", logLR: 18, evidenceLabel: "NS1 antigen positive"),
            .init(key: "inv", value: "dengue", logLR: 18, evidenceLabel: "Dengue serology positive"),
        ]),
        .init(name: "Community-Acquired Pneumonia", icd: "J18.9",
              logPrior: 25, features: [
            .init(key: "associations", value: "Cough", logLR: 10, evidenceLabel: "Cough"),
            .init(key: "character", value: "Sharp", logLR: 6, evidenceLabel: "Pleuritic pain"),
            .init(key: "exam", value: "crepitation", logLR: 12, evidenceLabel: "Crepitations"),
            .init(key: "exam", value: "consolidation", logLR: 14, evidenceLabel: "Consolidation"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Raised WBC"),
            .init(key: "age_over", value: "65", logLR: 6, evidenceLabel: "Elderly"),
        ]),
        .init(name: "Urinary Tract Infection", icd: "N39.0",
              logPrior: 20, features: [
            .init(key: "associations", value: "Dysuria", logLR: 14, evidenceLabel: "Dysuria"),
            .init(key: "associations", value: "Frequency", logLR: 10, evidenceLabel: "Frequency"),
            .init(key: "site", value: "Suprapubic", logLR: 8, evidenceLabel: "Suprapubic discomfort"),
            .init(key: "associations", value: "Haematuria", logLR: 8, evidenceLabel: "Haematuria"),
            .init(key: "inv", value: "leucocyte", logLR: 12, evidenceLabel: "Leucocytes on urine dip"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex (higher prevalence)"),
        ]),
        .init(name: "Leptospirosis", icd: "A27.9",
              logPrior: 15, features: [
            .init(key: "associations", value: "Jaundice", logLR: 10, evidenceLabel: "Jaundice"),
            .init(key: "associations", value: "Headache", logLR: 6, evidenceLabel: "Headache"),
            .init(key: "associations", value: "Myalgia", logLR: 10, evidenceLabel: "Severe myalgia"),
            .init(key: "associations", value: "Conjunctival injection", logLR: 12, evidenceLabel: "Conjunctival suffusion"),
            .init(key: "pmh", value: "water exposure", logLR: 12, evidenceLabel: "Water/animal exposure"),
            .init(key: "inv", value: "leptospira", logLR: 18, evidenceLabel: "Leptospira serology"),
            .init(key: "inv", value: "alt", logLR: 8, evidenceLabel: "Elevated ALT"),
            .init(key: "inv", value: "creatinine", logLR: 8, evidenceLabel: "Elevated creatinine"),
        ]),
        .init(name: "Typhoid Fever", icd: "A01.00",
              logPrior: 12, features: [
            .init(key: "onset", value: "Gradual", logLR: 8, evidenceLabel: "Gradual onset"),
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Step-ladder fever"),
            .init(key: "associations", value: "Anorexia", logLR: 6, evidenceLabel: "Anorexia"),
            .init(key: "associations", value: "Constipation", logLR: 6, evidenceLabel: "Early constipation"),
            .init(key: "associations", value: "Diarrhoea", logLR: 6, evidenceLabel: "Later diarrhoea"),
            .init(key: "exam", value: "rose spots", logLR: 14, evidenceLabel: "Rose spots"),
            .init(key: "exam", value: "hepatosplenomegaly", logLR: 10, evidenceLabel: "Hepatosplenomegaly"),
            .init(key: "inv", value: "widal", logLR: 12, evidenceLabel: "Widal positive"),
        ]),
        .init(name: "Cellulitis / SSTI", icd: "L03.90",
              logPrior: 15, features: [
            .init(key: "exam", value: "erythema", logLR: 14, evidenceLabel: "Erythema"),
            .init(key: "exam", value: "warm", logLR: 10, evidenceLabel: "Warmth"),
            .init(key: "exam", value: "swelling", logLR: 10, evidenceLabel: "Swelling"),
            .init(key: "exam", value: "tender", logLR: 8, evidenceLabel: "Tenderness"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Elevated WBC"),
            .init(key: "inv", value: "crp", logLR: 8, evidenceLabel: "Elevated CRP"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes (risk factor)"),
        ]),
    ]

    // MARK: - Urinary symptoms

    private static let urinarySymptoms: [Candidate] = [
        .init(name: "Urinary Tract Infection", icd: "N39.0",
              logPrior: 45, features: [
            .init(key: "associations", value: "Dysuria", logLR: 14, evidenceLabel: "Dysuria"),
            .init(key: "associations", value: "Frequency", logLR: 10, evidenceLabel: "Frequency"),
            .init(key: "associations", value: "Haematuria", logLR: 8, evidenceLabel: "Haematuria"),
            .init(key: "site", value: "Suprapubic", logLR: 8, evidenceLabel: "Suprapubic pain"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Fever (pyelonephritis)"),
            .init(key: "site", value: "Loin", logLR: 8, evidenceLabel: "Loin pain (upper tract)"),
            .init(key: "inv", value: "leucocyte", logLR: 12, evidenceLabel: "Leucocytes on dipstick"),
            .init(key: "inv", value: "nitrite", logLR: 10, evidenceLabel: "Nitrites on dipstick"),
            .init(key: "sex_female", value: "", logLR: 8, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Renal / Ureteric Colic", icd: "N20.10",
              logPrior: 20, features: [
            .init(key: "character", value: "Colicky", logLR: 12, evidenceLabel: "Colicky pain"),
            .init(key: "site", value: "Loin", logLR: 12, evidenceLabel: "Loin to groin"),
            .init(key: "site", value: "Groin", logLR: 10, evidenceLabel: "Radiation to groin"),
            .init(key: "associations", value: "Haematuria", logLR: 14, evidenceLabel: "Haematuria"),
            .init(key: "pmh", value: "renal stone", logLR: 14, evidenceLabel: "Previous stones"),
            .init(key: "inv", value: "ct kub", logLR: 16, evidenceLabel: "CT KUB stone"),
        ]),
        .init(name: "Benign Prostatic Hypertrophy", icd: "N40.0",
              logPrior: 15, features: [
            .init(key: "associations", value: "Poor stream", logLR: 12, evidenceLabel: "Poor stream"),
            .init(key: "associations", value: "Frequency", logLR: 8, evidenceLabel: "Frequency"),
            .init(key: "associations", value: "Nocturia", logLR: 10, evidenceLabel: "Nocturia"),
            .init(key: "associations", value: "Incomplete emptying", logLR: 10, evidenceLabel: "Incomplete emptying"),
            .init(key: "age_over", value: "55", logLR: 12, evidenceLabel: "Age >55"),
            .init(key: "sex_male", value: "", logLR: 20, evidenceLabel: "Male sex"),
            .init(key: "inv", value: "psa", logLR: 8, evidenceLabel: "PSA checked"),
        ]),
        .init(name: "Carcinoma of Prostate", icd: "C61",
              logPrior: 8, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive symptoms"),
            .init(key: "associations", value: "Haematuria", logLR: 8, evidenceLabel: "Haematuria"),
            .init(key: "associations", value: "Bone pain", logLR: 10, evidenceLabel: "Bone pain (metastatic)"),
            .init(key: "age_over", value: "60", logLR: 12, evidenceLabel: "Age >60"),
            .init(key: "sex_male", value: "", logLR: 20, evidenceLabel: "Male sex"),
            .init(key: "inv", value: "psa", logLR: 14, evidenceLabel: "Elevated PSA"),
            .init(key: "exam", value: "hard", logLR: 12, evidenceLabel: "Hard nodule on PR"),
        ]),
    ]

    // MARK: - Joint pain / Musculoskeletal

    private static let jointPain: [Candidate] = [
        .init(name: "Gout", icd: "M10.9",
              logPrior: 35, features: [
            .init(key: "onset", value: "Sudden", logLR: 12, evidenceLabel: "Sudden onset"),
            .init(key: "site", value: "First MTP / big toe", logLR: 16, evidenceLabel: "First MTP joint"),
            .init(key: "character", value: "Severe", logLR: 10, evidenceLabel: "Severe pain"),
            .init(key: "exam", value: "erythema", logLR: 10, evidenceLabel: "Erythema"),
            .init(key: "exam", value: "swelling", logLR: 8, evidenceLabel: "Swelling"),
            .init(key: "pmh", value: "gout", logLR: 14, evidenceLabel: "Previous gout"),
            .init(key: "pmh", value: "hyperuricaemia", logLR: 10, evidenceLabel: "Hyperuricaemia"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Age >40"),
            .init(key: "exacerbating", value: "Alcohol", logLR: 8, evidenceLabel: "Alcohol trigger"),
            .init(key: "inv", value: "uric acid", logLR: 12, evidenceLabel: "Elevated uric acid"),
        ]),
        .init(name: "Septic Arthritis", icd: "M00.9",
              logPrior: 10, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Fever", logLR: 14, evidenceLabel: "Fever"),
            .init(key: "character", value: "Severe", logLR: 8, evidenceLabel: "Severe pain"),
            .init(key: "exam", value: "hot", logLR: 12, evidenceLabel: "Hot joint"),
            .init(key: "exam", value: "effusion", logLR: 10, evidenceLabel: "Effusion"),
            .init(key: "inv", value: "wbc", logLR: 10, evidenceLabel: "Elevated WBC"),
            .init(key: "inv", value: "synovial", logLR: 16, evidenceLabel: "Synovial fluid WBC elevated"),
        ]),
        .init(name: "Osteoarthritis", icd: "M19.90",
              logPrior: 25, features: [
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Progressive"),
            .init(key: "timing", value: "Worse over time", logLR: 8, evidenceLabel: "Worsening"),
            .init(key: "exacerbating", value: "Movement", logLR: 8, evidenceLabel: "Worse with movement"),
            .init(key: "relieving", value: "Rest", logLR: 6, evidenceLabel: "Better with rest"),
            .init(key: "associations", value: "Stiffness", logLR: 6, evidenceLabel: "Morning stiffness <1h"),
            .init(key: "age_over", value: "50", logLR: 10, evidenceLabel: "Age >50"),
            .init(key: "inv", value: "x-ray", logLR: 8, evidenceLabel: "X-ray changes"),
        ]),
        .init(name: "Rheumatoid Arthritis", icd: "M06.9",
              logPrior: 12, features: [
            .init(key: "timing", value: "Progressive", logLR: 6, evidenceLabel: "Progressive"),
            .init(key: "timing", value: "Intermittent", logLR: 4, evidenceLabel: "Flares"),
            .init(key: "associations", value: "Symmetrical", logLR: 12, evidenceLabel: "Symmetrical joint involvement"),
            .init(key: "associations", value: "Morning stiffness", logLR: 12, evidenceLabel: "Morning stiffness >1h"),
            .init(key: "exam", value: "deformity", logLR: 10, evidenceLabel: "Joint deformity"),
            .init(key: "pmh", value: "rheumatoid", logLR: 16, evidenceLabel: "Known RA"),
            .init(key: "inv", value: "rf", logLR: 10, evidenceLabel: "Positive RF"),
            .init(key: "inv", value: "anti-ccp", logLR: 14, evidenceLabel: "Anti-CCP positive"),
            .init(key: "sex_female", value: "", logLR: 4, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Sickle Cell Crisis", icd: "D57.219",
              logPrior: 10, features: [
            .init(key: "character", value: "Severe", logLR: 10, evidenceLabel: "Severe pain"),
            .init(key: "character", value: "Aching", logLR: 8, evidenceLabel: "Bone/joint aching"),
            .init(key: "onset", value: "Sudden", logLR: 6, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Fever", logLR: 6, evidenceLabel: "Fever (if infective trigger)"),
            .init(key: "pmh", value: "sickle", logLR: 20, evidenceLabel: "Sickle cell disease"),
            .init(key: "inv", value: "sickle", logLR: 20, evidenceLabel: "Sickle cell on film"),
        ]),
    ]

    // MARK: - Hypertension review

    private static let hypertensionReview: [Candidate] = [
        .init(name: "Essential Hypertension", icd: "I10",
              logPrior: 65, features: [
            .init(key: "pmh", value: "hypertension", logLR: 16, evidenceLabel: "Known hypertension"),
            .init(key: "pmh", value: "diabetes", logLR: 5, evidenceLabel: "Diabetes (comorbidity)"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Age >40"),
            .init(key: "associations", value: "Headache", logLR: 4, evidenceLabel: "Headache"),
            .init(key: "associations", value: "Dizziness", logLR: 3, evidenceLabel: "Dizziness"),
            .init(key: "inv", value: "ecg", logLR: 4, evidenceLabel: "ECG for LVH"),
            .init(key: "inv", value: "creatinine", logLR: 4, evidenceLabel: "Renal function"),
        ]),
        .init(name: "Secondary Hypertension", icd: "I15.9",
              logPrior: 8, features: [
            .init(key: "age_under", value: "35", logLR: 8, evidenceLabel: "Young age"),
            .init(key: "associations", value: "Headache", logLR: 6, evidenceLabel: "Headache"),
            .init(key: "associations", value: "Sweating", logLR: 8, evidenceLabel: "Episodic sweating (phaeochromocytoma)"),
            .init(key: "associations", value: "Hypokalaemia", logLR: 8, evidenceLabel: "Hypokalaemia (Conn's)"),
            .init(key: "pmh", value: "ckd", logLR: 10, evidenceLabel: "CKD (renal HTN)"),
            .init(key: "inv", value: "renin", logLR: 10, evidenceLabel: "Renin/aldosterone ratio"),
        ]),
        .init(name: "Hypertensive Urgency / Emergency", icd: "I16.9",
              logPrior: 5, features: [
            .init(key: "character", value: "Severe", logLR: 10, evidenceLabel: "Severe headache"),
            .init(key: "associations", value: "Visual change", logLR: 12, evidenceLabel: "Visual disturbance"),
            .init(key: "associations", value: "Chest pain", logLR: 10, evidenceLabel: "Chest pain"),
            .init(key: "associations", value: "Confusion", logLR: 12, evidenceLabel: "Confusion"),
            .init(key: "exam", value: "papilloedema", logLR: 16, evidenceLabel: "Papilloedema"),
        ]),
    ]

    // MARK: - Diabetes review

    private static let diabetesReview: [Candidate] = [
        .init(name: "Type 2 Diabetes Mellitus", icd: "E11.9",
              logPrior: 55, features: [
            .init(key: "pmh", value: "diabetes", logLR: 16, evidenceLabel: "Known T2DM"),
            .init(key: "pmh", value: "t2dm", logLR: 16, evidenceLabel: "T2DM"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Age >40"),
            .init(key: "associations", value: "Polyuria", logLR: 10, evidenceLabel: "Polyuria"),
            .init(key: "associations", value: "Polydipsia", logLR: 10, evidenceLabel: "Polydipsia"),
            .init(key: "associations", value: "Weight loss", logLR: 6, evidenceLabel: "Weight loss"),
            .init(key: "inv", value: "hba1c", logLR: 16, evidenceLabel: "HbA1c elevated"),
            .init(key: "inv", value: "glucose", logLR: 12, evidenceLabel: "Fasting glucose elevated"),
            .init(key: "pmh", value: "hypertension", logLR: 4, evidenceLabel: "Hypertension (comorbidity)"),
        ]),
        .init(name: "Type 1 Diabetes Mellitus", icd: "E10.9",
              logPrior: 10, features: [
            .init(key: "age_under", value: "35", logLR: 6, evidenceLabel: "Younger onset"),
            .init(key: "associations", value: "Weight loss", logLR: 8, evidenceLabel: "Weight loss at diagnosis"),
            .init(key: "pmh", value: "t1dm", logLR: 18, evidenceLabel: "Known T1DM"),
            .init(key: "inv", value: "c-peptide", logLR: 12, evidenceLabel: "Low C-peptide"),
        ]),
        .init(name: "Diabetic Complications", icd: "E11.69",
              logPrior: 15, features: [
            .init(key: "associations", value: "Neuropathy", logLR: 12, evidenceLabel: "Peripheral neuropathy"),
            .init(key: "associations", value: "Visual change", logLR: 10, evidenceLabel: "Retinopathy symptoms"),
            .init(key: "associations", value: "Foot pain", logLR: 10, evidenceLabel: "Diabetic foot"),
            .init(key: "pmh", value: "diabetes", logLR: 10, evidenceLabel: "Diabetes"),
            .init(key: "inv", value: "albumin", logLR: 10, evidenceLabel: "Microalbuminuria"),
            .init(key: "inv", value: "creatinine", logLR: 8, evidenceLabel: "Renal impairment"),
        ]),
    ]

    // MARK: - Vascular surgical

    private static let vascularSurgical: [Candidate] = [
        .init(name: "Acute Mesenteric Ischaemia", icd: "K55.0",
              logPrior: 8, features: [
            .init(key: "onset", value: "Sudden", logLR: 12, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Severe", logLR: 10, evidenceLabel: "Severe pain"),
            .init(key: "character", value: "Constant", logLR: 8, evidenceLabel: "Constant pain"),
            .init(key: "associations", value: "Vomiting", logLR: 6, evidenceLabel: "Vomiting"),
            .init(key: "associations", value: "Bloody stool", logLR: 14, evidenceLabel: "Bloody stool (late sign)"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 14, evidenceLabel: "Atrial fibrillation (embolic risk)"),
            .init(key: "pmh", value: "af", logLR: 14, evidenceLabel: "AF"),
            .init(key: "pmh", value: "vascular", logLR: 8, evidenceLabel: "Vascular disease"),
            .init(key: "exam", value: "periton", logLR: 12, evidenceLabel: "Peritonism"),
            .init(key: "age_over", value: "60", logLR: 8, evidenceLabel: "Age >60"),
        ]),
        .init(name: "Abdominal Aortic Aneurysm", icd: "I71.4",
              logPrior: 10, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Tearing", logLR: 16, evidenceLabel: "Tearing pain"),
            .init(key: "radiation", value: "Back", logLR: 12, evidenceLabel: "Radiation to back"),
            .init(key: "radiation", value: "Flank", logLR: 10, evidenceLabel: "Flank radiation"),
            .init(key: "exam", value: "pulsatile", logLR: 18, evidenceLabel: "Pulsatile mass"),
            .init(key: "pmh", value: "smoking", logLR: 8, evidenceLabel: "Smoking history"),
            .init(key: "pmh", value: "hypertension", logLR: 6, evidenceLabel: "Hypertension"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "age_over", value: "60", logLR: 8, evidenceLabel: "Age >60"),
        ]),
        .init(name: "Peripheral Arterial Disease", icd: "I70.209",
              logPrior: 14, features: [
            .init(key: "character", value: "Cramping", logLR: 10, evidenceLabel: "Cramping pain"),
            .init(key: "associations", value: "Claudication", logLR: 16, evidenceLabel: "Intermittent claudication"),
            .init(key: "exacerbating", value: "Walking", logLR: 14, evidenceLabel: "Walking exacerbates"),
            .init(key: "relieving", value: "Rest", logLR: 10, evidenceLabel: "Rest relieves"),
            .init(key: "exam", value: "cold", logLR: 10, evidenceLabel: "Cold limb"),
            .init(key: "exam", value: "absent pulse", logLR: 14, evidenceLabel: "Absent pulses"),
            .init(key: "exam", value: "ulcer", logLR: 10, evidenceLabel: "Ischaemic ulcer"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "smoking", logLR: 8, evidenceLabel: "Smoking"),
        ]),
        .init(name: "Critical Limb Ischaemia", icd: "I70.249",
              logPrior: 6, features: [
            .init(key: "character", value: "Rest pain", logLR: 18, evidenceLabel: "Rest pain"),
            .init(key: "timing", value: "Constant", logLR: 10, evidenceLabel: "Constant pain"),
            .init(key: "exam", value: "gangrene", logLR: 20, evidenceLabel: "Gangrene / tissue loss"),
            .init(key: "exam", value: "ulcer", logLR: 12, evidenceLabel: "Non-healing ulcer"),
            .init(key: "exam", value: "cold", logLR: 10, evidenceLabel: "Cold limb"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "vascular", logLR: 10, evidenceLabel: "Peripheral vascular disease"),
        ]),
        .init(name: "Aortic Dissection", icd: "I71.00",
              logPrior: 5, features: [
            .init(key: "onset", value: "Sudden", logLR: 14, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Tearing", logLR: 18, evidenceLabel: "Tearing / ripping pain"),
            .init(key: "radiation", value: "Back", logLR: 14, evidenceLabel: "Interscapular radiation"),
            .init(key: "radiation", value: "Chest", logLR: 10, evidenceLabel: "Chest radiation"),
            .init(key: "pmh", value: "hypertension", logLR: 10, evidenceLabel: "Hypertension"),
            .init(key: "pmh", value: "marfan", logLR: 14, evidenceLabel: "Marfan syndrome"),
        ]),
    ]

    // MARK: - Small bowel obstruction / volvulus

    private static let smallBowelObstruction: [Candidate] = [
        .init(name: "Small Bowel Obstruction", icd: "K56.60",
              logPrior: 25, features: [
            .init(key: "character", value: "Colicky", logLR: 14, evidenceLabel: "Colicky pain"),
            .init(key: "associations", value: "Vomiting", logLR: 12, evidenceLabel: "Vomiting"),
            .init(key: "associations", value: "Distension", logLR: 14, evidenceLabel: "Abdominal distension"),
            .init(key: "associations", value: "No bowel motion", logLR: 14, evidenceLabel: "Absolute constipation"),
            .init(key: "exam", value: "distension", logLR: 12, evidenceLabel: "Distended abdomen"),
            .init(key: "exam", value: "high pitched", logLR: 14, evidenceLabel: "Tinkling / high-pitched bowel sounds"),
            .init(key: "exam", value: "scar", logLR: 10, evidenceLabel: "Laparotomy scar"),
            .init(key: "pshx", value: "laparotomy", logLR: 12, evidenceLabel: "Previous laparotomy (adhesions)"),
            .init(key: "pshx", value: "abdominal surgery", logLR: 10, evidenceLabel: "Previous abdominal surgery"),
            .init(key: "inv", value: "dilated loops", logLR: 16, evidenceLabel: "Dilated bowel on imaging"),
        ]),
        .init(name: "Large Bowel Obstruction", icd: "K56.609",
              logPrior: 14, features: [
            .init(key: "character", value: "Colicky", logLR: 10, evidenceLabel: "Colicky pain"),
            .init(key: "associations", value: "Distension", logLR: 14, evidenceLabel: "Marked distension"),
            .init(key: "associations", value: "No bowel motion", logLR: 12, evidenceLabel: "Absolute constipation"),
            .init(key: "onset", value: "Gradual", logLR: 8, evidenceLabel: "Gradual onset"),
            .init(key: "pmh", value: "colorectal", logLR: 14, evidenceLabel: "Colorectal cancer"),
            .init(key: "age_over", value: "60", logLR: 6, evidenceLabel: "Age >60"),
            .init(key: "exam", value: "mass", logLR: 12, evidenceLabel: "Palpable mass"),
        ]),
        .init(name: "Sigmoid Volvulus", icd: "K56.2",
              logPrior: 10, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Distension", logLR: 16, evidenceLabel: "Massive distension"),
            .init(key: "associations", value: "No bowel motion", logLR: 12, evidenceLabel: "Absolute constipation"),
            .init(key: "pmh", value: "constipation", logLR: 8, evidenceLabel: "Chronic constipation"),
            .init(key: "age_over", value: "60", logLR: 6, evidenceLabel: "Elderly"),
            .init(key: "inv", value: "coffee bean", logLR: 18, evidenceLabel: "Coffee-bean sign on AXR"),
        ]),
        .init(name: "Paralytic Ileus", icd: "K56.0",
              logPrior: 12, features: [
            .init(key: "associations", value: "Distension", logLR: 10, evidenceLabel: "Distension"),
            .init(key: "associations", value: "Nausea", logLR: 6, evidenceLabel: "Nausea"),
            .init(key: "exam", value: "absent bowel sounds", logLR: 14, evidenceLabel: "Absent bowel sounds"),
            .init(key: "pshx", value: "surgery", logLR: 12, evidenceLabel: "Recent surgery"),
            .init(key: "pmh", value: "pancreatitis", logLR: 8, evidenceLabel: "Pancreatitis"),
        ]),
    ]

    // MARK: - Pilonidal disease

    private static let pilonidalDisease: [Candidate] = [
        .init(name: "Pilonidal Sinus", icd: "L05.91",
              logPrior: 30, features: [
            .init(key: "site", value: "Natal cleft", logLR: 20, evidenceLabel: "Natal cleft / coccyx"),
            .init(key: "site", value: "Coccyx", logLR: 16, evidenceLabel: "Coccyx"),
            .init(key: "character", value: "Dull ache", logLR: 8, evidenceLabel: "Dull aching pain"),
            .init(key: "exam", value: "sinus", logLR: 18, evidenceLabel: "Sinus/pit visible"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "age_under", value: "35", logLR: 6, evidenceLabel: "Young adult"),
            .init(key: "associations", value: "Hair", logLR: 10, evidenceLabel: "Hair in sinus"),
        ]),
        .init(name: "Pilonidal Abscess", icd: "L05.01",
              logPrior: 20, features: [
            .init(key: "onset", value: "Rapid", logLR: 12, evidenceLabel: "Rapid onset of pain"),
            .init(key: "character", value: "Throbbing", logLR: 10, evidenceLabel: "Throbbing pain"),
            .init(key: "site", value: "Natal cleft", logLR: 20, evidenceLabel: "Natal cleft"),
            .init(key: "exam", value: "swelling", logLR: 14, evidenceLabel: "Fluctuant swelling"),
            .init(key: "exam", value: "erythema", logLR: 12, evidenceLabel: "Surrounding erythema"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Systemic fever"),
            .init(key: "pshx", value: "pilonidal", logLR: 14, evidenceLabel: "Previous pilonidal disease"),
        ]),
    ]

    // MARK: - Renal colic

    private static let renalColic: [Candidate] = [
        .init(name: "Renal Colic / Ureteric Calculus", icd: "N20.1",
              logPrior: 35, features: [
            .init(key: "onset", value: "Sudden", logLR: 12, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Colicky", logLR: 16, evidenceLabel: "Colicky pain"),
            .init(key: "radiation", value: "Loin to groin", logLR: 20, evidenceLabel: "Loin-to-groin radiation"),
            .init(key: "radiation", value: "Groin", logLR: 14, evidenceLabel: "Groin radiation"),
            .init(key: "associations", value: "Haematuria", logLR: 16, evidenceLabel: "Haematuria"),
            .init(key: "associations", value: "Nausea", logLR: 6, evidenceLabel: "Nausea/vomiting"),
            .init(key: "associations", value: "Restless", logLR: 10, evidenceLabel: "Patient writhing/restless"),
            .init(key: "pmh", value: "kidney stone", logLR: 16, evidenceLabel: "Previous kidney stones"),
            .init(key: "inv", value: "haematuria", logLR: 14, evidenceLabel: "Haematuria on urine dipstick"),
        ]),
        .init(name: "Pyelonephritis", icd: "N10",
              logPrior: 20, features: [
            .init(key: "site", value: "Loin", logLR: 12, evidenceLabel: "Loin pain"),
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Dysuria", logLR: 10, evidenceLabel: "Dysuria"),
            .init(key: "associations", value: "Frequency", logLR: 8, evidenceLabel: "Urinary frequency"),
            .init(key: "exam", value: "renal angle", logLR: 14, evidenceLabel: "Renal angle tenderness"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Renal Cell Carcinoma", icd: "C64.9",
              logPrior: 8, features: [
            .init(key: "associations", value: "Haematuria", logLR: 14, evidenceLabel: "Painless haematuria"),
            .init(key: "associations", value: "Weight loss", logLR: 10, evidenceLabel: "Weight loss"),
            .init(key: "exam", value: "mass", logLR: 14, evidenceLabel: "Flank mass"),
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Progressive"),
            .init(key: "age_over", value: "50", logLR: 6, evidenceLabel: "Age >50"),
            .init(key: "pmh", value: "smoking", logLR: 8, evidenceLabel: "Smoking"),
        ]),
    ]

    // MARK: - Stroke / TIA

    private static let strokeTIA: [Candidate] = [
        .init(name: "Ischaemic Stroke", icd: "I63.9",
              logPrior: 25, features: [
            .init(key: "onset", value: "Sudden", logLR: 16, evidenceLabel: "Sudden onset — FAST"),
            .init(key: "associations", value: "Facial droop", logLR: 18, evidenceLabel: "Facial droop"),
            .init(key: "associations", value: "Arm weakness", logLR: 16, evidenceLabel: "Arm weakness"),
            .init(key: "associations", value: "Speech difficulty", logLR: 16, evidenceLabel: "Speech difficulty"),
            .init(key: "associations", value: "Visual change", logLR: 12, evidenceLabel: "Visual disturbance"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 14, evidenceLabel: "Atrial fibrillation"),
            .init(key: "pmh", value: "hypertension", logLR: 8, evidenceLabel: "Hypertension"),
            .init(key: "pmh", value: "diabetes", logLR: 6, evidenceLabel: "Diabetes"),
            .init(key: "age_over", value: "55", logLR: 8, evidenceLabel: "Age >55"),
        ]),
        .init(name: "Transient Ischaemic Attack", icd: "G45.9",
              logPrior: 15, features: [
            .init(key: "timing", value: "Resolved", logLR: 16, evidenceLabel: "Symptoms resolved (<24h)"),
            .init(key: "onset", value: "Sudden", logLR: 14, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Facial droop", logLR: 12, evidenceLabel: "Transient facial droop"),
            .init(key: "associations", value: "Arm weakness", logLR: 12, evidenceLabel: "Transient limb weakness"),
            .init(key: "associations", value: "Speech difficulty", logLR: 12, evidenceLabel: "Transient dysphasia"),
            .init(key: "pmh", value: "hypertension", logLR: 8, evidenceLabel: "Hypertension"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 12, evidenceLabel: "Atrial fibrillation"),
        ]),
        .init(name: "Intracranial Haemorrhage", icd: "I61.9",
              logPrior: 8, features: [
            .init(key: "character", value: "Thunderclap", logLR: 20, evidenceLabel: "Thunderclap headache"),
            .init(key: "onset", value: "Sudden", logLR: 14, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Vomiting", logLR: 10, evidenceLabel: "Vomiting"),
            .init(key: "associations", value: "Decreased GCS", logLR: 16, evidenceLabel: "Reduced consciousness"),
            .init(key: "pmh", value: "hypertension", logLR: 10, evidenceLabel: "Hypertension"),
            .init(key: "pmh", value: "anticoagul", logLR: 12, evidenceLabel: "On anticoagulation"),
        ]),
    ]

    // MARK: - Anaemia

    private static let anaemia: [Candidate] = [
        .init(name: "Iron Deficiency Anaemia", icd: "D50.9",
              logPrior: 40, features: [
            .init(key: "character", value: "Fatigue", logLR: 8, evidenceLabel: "Fatigue"),
            .init(key: "associations", value: "Breathlessness", logLR: 8, evidenceLabel: "Exertional dyspnoea"),
            .init(key: "associations", value: "Pallor", logLR: 10, evidenceLabel: "Pallor"),
            .init(key: "associations", value: "Palpitations", logLR: 6, evidenceLabel: "Palpitations"),
            .init(key: "pmh", value: "rectal bleed", logLR: 12, evidenceLabel: "Rectal bleeding"),
            .init(key: "pmh", value: "menorrhagia", logLR: 12, evidenceLabel: "Menorrhagia"),
            .init(key: "pmh", value: "gastrointestinal", logLR: 8, evidenceLabel: "GI pathology"),
            .init(key: "inv", value: "ferritin", logLR: 14, evidenceLabel: "Low ferritin"),
            .init(key: "inv", value: "microcytic", logLR: 12, evidenceLabel: "Microcytic anaemia"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Macrocytic Anaemia (B12 / Folate)", icd: "D51.9",
              logPrior: 20, features: [
            .init(key: "associations", value: "Neuropathy", logLR: 12, evidenceLabel: "Peripheral neuropathy"),
            .init(key: "associations", value: "Sore tongue", logLR: 10, evidenceLabel: "Glossitis"),
            .init(key: "pmh", value: "gastric", logLR: 10, evidenceLabel: "Gastric surgery / atrophic gastritis"),
            .init(key: "pmh", value: "crohn", logLR: 8, evidenceLabel: "Crohn's (terminal ileum)"),
            .init(key: "pmh", value: "alcohol", logLR: 8, evidenceLabel: "Alcohol use"),
            .init(key: "inv", value: "macrocytic", logLR: 14, evidenceLabel: "Macrocytic anaemia"),
            .init(key: "inv", value: "b12", logLR: 16, evidenceLabel: "Low B12"),
            .init(key: "inv", value: "folate", logLR: 14, evidenceLabel: "Low folate"),
        ]),
        .init(name: "Anaemia of Chronic Disease", icd: "D63.1",
              logPrior: 18, features: [
            .init(key: "pmh", value: "chronic", logLR: 8, evidenceLabel: "Chronic illness"),
            .init(key: "pmh", value: "rheumatoid", logLR: 10, evidenceLabel: "Rheumatoid arthritis"),
            .init(key: "pmh", value: "malignancy", logLR: 12, evidenceLabel: "Malignancy"),
            .init(key: "pmh", value: "ckd", logLR: 10, evidenceLabel: "CKD"),
            .init(key: "inv", value: "normocytic", logLR: 10, evidenceLabel: "Normocytic anaemia"),
            .init(key: "inv", value: "esr", logLR: 8, evidenceLabel: "Elevated ESR/CRP"),
        ]),
        .init(name: "Haemolytic Anaemia", icd: "D59.9",
              logPrior: 8, features: [
            .init(key: "associations", value: "Jaundice", logLR: 14, evidenceLabel: "Jaundice"),
            .init(key: "associations", value: "Dark urine", logLR: 12, evidenceLabel: "Dark urine (haemoglobinuria)"),
            .init(key: "pmh", value: "sickle", logLR: 14, evidenceLabel: "Sickle cell disease"),
            .init(key: "pmh", value: "autoimmune", logLR: 10, evidenceLabel: "Autoimmune disease"),
            .init(key: "inv", value: "reticulocyte", logLR: 12, evidenceLabel: "Raised reticulocyte count"),
            .init(key: "inv", value: "ldh", logLR: 10, evidenceLabel: "Elevated LDH"),
            .init(key: "inv", value: "direct coombs", logLR: 14, evidenceLabel: "Positive direct Coombs"),
        ]),
    ]

    // MARK: - Wound infection / surgical site

    private static let woundInfection: [Candidate] = [
        .init(name: "Surgical Site Infection (SSI)", icd: "T81.40XA",
              logPrior: 35, features: [
            .init(key: "associations", value: "Discharge", logLR: 16, evidenceLabel: "Wound discharge"),
            .init(key: "associations", value: "Redness", logLR: 12, evidenceLabel: "Wound erythema"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Systemic fever"),
            .init(key: "exam", value: "erythema", logLR: 12, evidenceLabel: "Perioperative erythema"),
            .init(key: "exam", value: "swelling", logLR: 10, evidenceLabel: "Wound swelling"),
            .init(key: "exam", value: "fluctuant", logLR: 14, evidenceLabel: "Fluctuant collection"),
            .init(key: "pshx", value: "surgery", logLR: 16, evidenceLabel: "Recent surgery"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes (risk factor)"),
        ]),
        .init(name: "Wound Dehiscence", icd: "T81.31XA",
              logPrior: 10, features: [
            .init(key: "associations", value: "Burst", logLR: 18, evidenceLabel: "Wound burst / opening"),
            .init(key: "associations", value: "Pink tissue visible", logLR: 16, evidenceLabel: "Viscera visible"),
            .init(key: "pshx", value: "laparotomy", logLR: 14, evidenceLabel: "Midline laparotomy"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "malnutrition", logLR: 8, evidenceLabel: "Malnutrition"),
            .init(key: "pmh", value: "steroid", logLR: 8, evidenceLabel: "Steroid use"),
        ]),
        .init(name: "Mesh Infection (Post-Hernioplasty)", icd: "T85.698A",
              logPrior: 8, features: [
            .init(key: "pshx", value: "hernia", logLR: 16, evidenceLabel: "Previous hernia repair"),
            .init(key: "pshx", value: "mesh", logLR: 18, evidenceLabel: "Mesh implant"),
            .init(key: "associations", value: "Sinus", logLR: 14, evidenceLabel: "Persistent sinus"),
            .init(key: "associations", value: "Discharge", logLR: 12, evidenceLabel: "Purulent discharge"),
            .init(key: "timing", value: "Months", logLR: 10, evidenceLabel: "Delayed presentation (months)"),
        ]),
    ]

    // MARK: - Sepsis / SIRS

    private static let sepsisConditions: [Candidate] = [
        .init(name: "Sepsis (Intra-abdominal Source)", icd: "A41.9",
              logPrior: 30, features: [
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever >38°C"),
            .init(key: "associations", value: "Tachycardia", logLR: 10, evidenceLabel: "Heart rate >90"),
            .init(key: "associations", value: "Hypotension", logLR: 16, evidenceLabel: "SBP <100 mmHg"),
            .init(key: "associations", value: "Confusion", logLR: 12, evidenceLabel: "Altered mentation"),
            .init(key: "associations", value: "Oliguria", logLR: 12, evidenceLabel: "Urine output <0.5 mL/kg/h"),
            .init(key: "exam", value: "periton", logLR: 12, evidenceLabel: "Peritonism"),
            .init(key: "inv", value: "lactate", logLR: 16, evidenceLabel: "Lactate ≥2 mmol/L"),
            .init(key: "inv", value: "wbc", logLR: 10, evidenceLabel: "WBC >12 or <4 ×10⁹/L"),
            .init(key: "inv", value: "crp", logLR: 8, evidenceLabel: "Elevated CRP"),
            .init(key: "pmh", value: "diabetes", logLR: 6, evidenceLabel: "Diabetes (risk factor)"),
            .init(key: "age_over", value: "65", logLR: 6, evidenceLabel: "Elderly"),
        ]),
        .init(name: "Septic Shock", icd: "R65.21",
              logPrior: 12, features: [
            .init(key: "associations", value: "Hypotension", logLR: 18, evidenceLabel: "MAP <65 mmHg despite resuscitation"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever or hypothermia"),
            .init(key: "associations", value: "Confusion", logLR: 14, evidenceLabel: "Encephalopathy"),
            .init(key: "associations", value: "Oliguria", logLR: 14, evidenceLabel: "Oliguria / renal failure"),
            .init(key: "inv", value: "lactate", logLR: 20, evidenceLabel: "Lactate ≥4 mmol/L"),
            .init(key: "inv", value: "creatinine", logLR: 10, evidenceLabel: "Rising creatinine"),
            .init(key: "inv", value: "blood culture", logLR: 14, evidenceLabel: "Positive blood cultures"),
        ]),
        .init(name: "Ascending Cholangitis (Sepsis)", icd: "K83.0",
              logPrior: 20, features: [
            .init(key: "associations", value: "Jaundice", logLR: 14, evidenceLabel: "Jaundice — Charcot's triad"),
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever — Charcot's triad"),
            .init(key: "site", value: "Right upper quadrant", logLR: 12, evidenceLabel: "RUQ pain — Charcot's triad"),
            .init(key: "associations", value: "Confusion", logLR: 14, evidenceLabel: "Confusion — Reynolds' pentad"),
            .init(key: "associations", value: "Hypotension", logLR: 14, evidenceLabel: "Shock — Reynolds' pentad"),
            .init(key: "inv", value: "bili", logLR: 12, evidenceLabel: "Raised bilirubin"),
            .init(key: "inv", value: "alp", logLR: 10, evidenceLabel: "Raised ALP"),
            .init(key: "pmh", value: "gallstone", logLR: 12, evidenceLabel: "Gallstone history"),
        ]),
        .init(name: "Urosepsis", icd: "A41.51",
              logPrior: 18, features: [
            .init(key: "associations", value: "Dysuria", logLR: 10, evidenceLabel: "Dysuria / LUTS"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Loin pain", logLR: 10, evidenceLabel: "Loin / renal angle pain"),
            .init(key: "exam", value: "renal angle", logLR: 12, evidenceLabel: "Renal angle tenderness"),
            .init(key: "inv", value: "leucocyte", logLR: 12, evidenceLabel: "Leucocytes on urine dip"),
            .init(key: "inv", value: "nitrite", logLR: 10, evidenceLabel: "Nitrites on urine dip"),
            .init(key: "pmh", value: "uti", logLR: 8, evidenceLabel: "Recurrent UTI history"),
            .init(key: "sex_female", value: "", logLR: 4, evidenceLabel: "Female sex"),
        ]),
    ]

    // MARK: - Necrotising Soft Tissue Infection

    private static let necrotizingInfection: [Candidate] = [
        .init(name: "Necrotising Fasciitis", icd: "M72.6",
              logPrior: 20, features: [
            .init(key: "onset", value: "Rapid", logLR: 12, evidenceLabel: "Rapid progression (hours)"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain disproportionate to appearance"),
            .init(key: "exam", value: "crepitus", logLR: 20, evidenceLabel: "Crepitus (gas in tissue)"),
            .init(key: "exam", value: "skin necrosis", logLR: 18, evidenceLabel: "Skin necrosis / bullae"),
            .init(key: "exam", value: "dishwater fluid", logLR: 18, evidenceLabel: "Thin grey / dishwater discharge"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever / systemic toxicity"),
            .init(key: "associations", value: "Hypotension", logLR: 14, evidenceLabel: "Haemodynamic instability"),
            .init(key: "inv", value: "crp", logLR: 14, evidenceLabel: "CRP >150 mg/L (LRINEC)"),
            .init(key: "inv", value: "wbc", logLR: 10, evidenceLabel: "WBC >15 ×10⁹/L"),
            .init(key: "inv", value: "gas", logLR: 20, evidenceLabel: "Gas in soft tissue on CT"),
            .init(key: "pmh", value: "diabetes", logLR: 10, evidenceLabel: "Diabetes (key risk factor)"),
            .init(key: "pmh", value: "immunosuppression", logLR: 8, evidenceLabel: "Immunosuppression"),
        ]),
        .init(name: "Fournier's Gangrene", icd: "N49.3",
              logPrior: 10, features: [
            .init(key: "site", value: "Scrotum", logLR: 20, evidenceLabel: "Scrotal / perineal involvement"),
            .init(key: "site", value: "Perineum", logLR: 18, evidenceLabel: "Perineal necrosis"),
            .init(key: "onset", value: "Rapid", logLR: 12, evidenceLabel: "Rapid onset"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain"),
            .init(key: "exam", value: "crepitus", logLR: 20, evidenceLabel: "Perineal crepitus"),
            .init(key: "exam", value: "swelling", logLR: 10, evidenceLabel: "Scrotal swelling and erythema"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "pmh", value: "diabetes", logLR: 14, evidenceLabel: "Diabetes (major risk factor)"),
            .init(key: "sex_male", value: "", logLR: 10, evidenceLabel: "Male sex (10:1 ratio)"),
        ]),
        .init(name: "Severe Cellulitis / SSTI", icd: "L03.90",
              logPrior: 30, features: [
            .init(key: "onset", value: "Gradual", logLR: 6, evidenceLabel: "Gradual onset over days"),
            .init(key: "exam", value: "erythema", logLR: 12, evidenceLabel: "Demarcated erythema"),
            .init(key: "exam", value: "warm", logLR: 10, evidenceLabel: "Warmth"),
            .init(key: "exam", value: "tender", logLR: 8, evidenceLabel: "Tenderness"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Systemic fever"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Elevated WBC"),
            .init(key: "pmh", value: "diabetes", logLR: 6, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "lymphoedema", logLR: 10, evidenceLabel: "Lymphoedema / venous disease"),
        ]),
        .init(name: "Gas Gangrene (Clostridial Myonecrosis)", icd: "A48.0",
              logPrior: 6, features: [
            .init(key: "onset", value: "Sudden", logLR: 12, evidenceLabel: "Sudden onset, rapid progression"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Extreme pain"),
            .init(key: "exam", value: "crepitus", logLR: 20, evidenceLabel: "Crepitus in muscle"),
            .init(key: "exam", value: "bronze skin", logLR: 16, evidenceLabel: "Bronze / mottled skin discolouration"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Systemic toxicity"),
            .init(key: "pshx", value: "surgery", logLR: 10, evidenceLabel: "Recent surgery or trauma"),
            .init(key: "pmh", value: "vascular", logLR: 8, evidenceLabel: "Vascular disease"),
        ]),
    ]

    // MARK: - Venous Thromboembolism (DVT / PE)

    private static let venousThromboEmbolism: [Candidate] = [
        .init(name: "Pulmonary Embolism", icd: "I26.99",
              logPrior: 20, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Pleuritic", logLR: 12, evidenceLabel: "Pleuritic chest pain"),
            .init(key: "associations", value: "Breathlessness", logLR: 12, evidenceLabel: "Dyspnoea"),
            .init(key: "associations", value: "Haemoptysis", logLR: 14, evidenceLabel: "Haemoptysis"),
            .init(key: "associations", value: "Leg swelling", logLR: 12, evidenceLabel: "Leg swelling (DVT)"),
            .init(key: "associations", value: "Hypoxia", logLR: 14, evidenceLabel: "SpO₂ <94%"),
            .init(key: "associations", value: "Tachycardia", logLR: 12, evidenceLabel: "Heart rate >100"),
            .init(key: "pmh", value: "dvt", logLR: 14, evidenceLabel: "Previous DVT / PE"),
            .init(key: "pmh", value: "malignancy", logLR: 10, evidenceLabel: "Active malignancy"),
            .init(key: "pshx", value: "surgery", logLR: 10, evidenceLabel: "Recent surgery (<4 weeks)"),
            .init(key: "inv", value: "d-dimer", logLR: 12, evidenceLabel: "Elevated D-dimer"),
            .init(key: "inv", value: "ctpa", logLR: 20, evidenceLabel: "CTPA positive for PE"),
            .init(key: "inv", value: "s1q3t3", logLR: 10, evidenceLabel: "S1Q3T3 on ECG"),
        ]),
        .init(name: "Deep Vein Thrombosis (Proximal)", icd: "I82.409",
              logPrior: 25, features: [
            .init(key: "site", value: "Leg", logLR: 12, evidenceLabel: "Leg / calf"),
            .init(key: "associations", value: "Calf swelling", logLR: 14, evidenceLabel: "Calf swelling >3 cm"),
            .init(key: "associations", value: "Pitting oedema", logLR: 10, evidenceLabel: "Pitting oedema"),
            .init(key: "exam", value: "tender", logLR: 10, evidenceLabel: "Deep vein tenderness"),
            .init(key: "exam", value: "warm", logLR: 8, evidenceLabel: "Warmth over calf"),
            .init(key: "pmh", value: "dvt", logLR: 14, evidenceLabel: "Previous DVT"),
            .init(key: "pmh", value: "malignancy", logLR: 10, evidenceLabel: "Active malignancy"),
            .init(key: "pshx", value: "surgery", logLR: 10, evidenceLabel: "Recent surgery"),
            .init(key: "inv", value: "d-dimer", logLR: 10, evidenceLabel: "Elevated D-dimer"),
            .init(key: "inv", value: "duplex", logLR: 20, evidenceLabel: "Compression duplex positive"),
        ]),
        .init(name: "Massive Pulmonary Embolism", icd: "I26.09",
              logPrior: 5, features: [
            .init(key: "associations", value: "Hypotension", logLR: 18, evidenceLabel: "SBP <90 mmHg"),
            .init(key: "associations", value: "Syncope", logLR: 14, evidenceLabel: "Syncope / near-syncope"),
            .init(key: "associations", value: "Breathlessness", logLR: 12, evidenceLabel: "Severe dyspnoea"),
            .init(key: "associations", value: "Tachycardia", logLR: 14, evidenceLabel: "HR >100"),
            .init(key: "associations", value: "Cyanosis", logLR: 14, evidenceLabel: "Cyanosis"),
            .init(key: "exam", value: "rv strain", logLR: 18, evidenceLabel: "RV strain on ECHO"),
            .init(key: "inv", value: "troponin", logLR: 12, evidenceLabel: "Raised troponin (RV injury)"),
            .init(key: "inv", value: "bnp", logLR: 10, evidenceLabel: "Raised BNP (RV failure)"),
            .init(key: "inv", value: "ctpa", logLR: 20, evidenceLabel: "Bilateral / saddle PE on CTPA"),
        ]),
    ]

    // MARK: - Acute Limb Ischaemia

    private static let acuteLimbIschaemia: [Candidate] = [
        .init(name: "Acute Limb Ischaemia", icd: "I74.3",
              logPrior: 20, features: [
            .init(key: "onset", value: "Sudden", logLR: 14, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain"),
            .init(key: "associations", value: "Cold limb", logLR: 16, evidenceLabel: "Cold limb"),
            .init(key: "associations", value: "Pallor", logLR: 14, evidenceLabel: "Limb pallor"),
            .init(key: "associations", value: "Paraesthesia", logLR: 14, evidenceLabel: "Paraesthesia (neural ischaemia)"),
            .init(key: "associations", value: "Paralysis", logLR: 18, evidenceLabel: "Paralysis (late — severe)"),
            .init(key: "exam", value: "absent pulse", logLR: 18, evidenceLabel: "Absent distal pulses"),
            .init(key: "exam", value: "cold", logLR: 14, evidenceLabel: "Cold compared to contralateral"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 14, evidenceLabel: "AF (embolic source)"),
            .init(key: "pmh", value: "af", logLR: 14, evidenceLabel: "AF"),
            .init(key: "pmh", value: "vascular", logLR: 10, evidenceLabel: "Peripheral arterial disease"),
        ]),
        .init(name: "Arterial Embolism (Limb)", icd: "I74.4",
              logPrior: 15, features: [
            .init(key: "onset", value: "Sudden", logLR: 16, evidenceLabel: "Abrupt onset — minutes"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain"),
            .init(key: "exam", value: "absent pulse", logLR: 18, evidenceLabel: "Absent pulse to level of occlusion"),
            .init(key: "pmh", value: "atrial fibrillation", logLR: 16, evidenceLabel: "Atrial fibrillation"),
            .init(key: "pmh", value: "cardiac", logLR: 10, evidenceLabel: "Cardiac disease (thrombus source)"),
            .init(key: "pmh", value: "aortic aneurysm", logLR: 12, evidenceLabel: "Known AAA (thrombus source)"),
        ]),
        .init(name: "Acute-on-Chronic Limb Ischaemia", icd: "I70.209",
              logPrior: 18, features: [
            .init(key: "timing", value: "Gradual then acute", logLR: 10, evidenceLabel: "Gradual onset on background claudication"),
            .init(key: "pmh", value: "claudication", logLR: 14, evidenceLabel: "Pre-existing claudication"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetes"),
            .init(key: "pmh", value: "smoking", logLR: 8, evidenceLabel: "Smoking"),
            .init(key: "pmh", value: "vascular", logLR: 10, evidenceLabel: "Peripheral arterial disease"),
            .init(key: "exam", value: "ulcer", logLR: 12, evidenceLabel: "Non-healing ulcer"),
            .init(key: "exam", value: "absent pulse", logLR: 14, evidenceLabel: "Absent distal pulses"),
        ]),
        .init(name: "Compartment Syndrome", icd: "M79.A10",
              logPrior: 10, features: [
            .init(key: "character", value: "Severe", logLR: 14, evidenceLabel: "Pain out of proportion to injury"),
            .init(key: "associations", value: "Tightness", logLR: 12, evidenceLabel: "Tense / tight compartment"),
            .init(key: "associations", value: "Paraesthesia", logLR: 14, evidenceLabel: "Paraesthesia in compartment distribution"),
            .init(key: "exacerbating", value: "Passive stretch", logLR: 16, evidenceLabel: "Pain on passive stretch of muscles"),
            .init(key: "pshx", value: "trauma", logLR: 12, evidenceLabel: "Trauma / fracture"),
            .init(key: "pshx", value: "reperfusion", logLR: 14, evidenceLabel: "Reperfusion after ischaemia"),
            .init(key: "inv", value: "ck", logLR: 10, evidenceLabel: "Markedly elevated CK"),
        ]),
    ]

    // ── Skin lesion ───────────────────────────────────────────────────

    private static let skinLesion: [Candidate] = [
        .init(name: "Melanoma", icd: "C43.9",
              logPrior: 12, features: [
            .init(key: "timing", value: "Progressive", logLR: 12, evidenceLabel: "Enlarging lesion"),
            .init(key: "character", value: "Irregular borders", logLR: 14, evidenceLabel: "Irregular borders (ABCDE)"),
            .init(key: "character", value: "Pigmented", logLR: 8, evidenceLabel: "Pigmented lesion"),
            .init(key: "exam", value: "ill-defined", logLR: 12, evidenceLabel: "Ill-defined border"),
            .init(key: "exam", value: "regional nodes", logLR: 16, evidenceLabel: "Regional lymphadenopathy"),
            .init(key: "exam", value: "satellite", logLR: 14, evidenceLabel: "Satellite lesions"),
            .init(key: "exam", value: "ulcerated", logLR: 10, evidenceLabel: "Ulcerated surface"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Age >40"),
            .init(key: "pmh", value: "sun", logLR: 8, evidenceLabel: "Sun exposure history"),
        ]),
        .init(name: "Basal Cell Carcinoma", icd: "C44.91",
              logPrior: 20, features: [
            .init(key: "character", value: "Non-pigmented", logLR: 6, evidenceLabel: "Non-pigmented"),
            .init(key: "exam", value: "well-defined", logLR: 8, evidenceLabel: "Pearly / rolled border"),
            .init(key: "exam", value: "ulcerated", logLR: 10, evidenceLabel: "Central ulceration (rodent ulcer)"),
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Slowly enlarging"),
            .init(key: "age_over", value: "50", logLR: 8, evidenceLabel: "Older patient"),
            .init(key: "site", value: "Face", logLR: 10, evidenceLabel: "Head / neck location"),
        ]),
        .init(name: "Squamous Cell Carcinoma", icd: "C44.92",
              logPrior: 15, features: [
            .init(key: "exam", value: "ulcerated", logLR: 12, evidenceLabel: "Ulcerated"),
            .init(key: "exam", value: "raised", logLR: 8, evidenceLabel: "Raised / indurated"),
            .init(key: "exam", value: "crusted", logLR: 10, evidenceLabel: "Crusting"),
            .init(key: "pmh", value: "radiation", logLR: 12, evidenceLabel: "Radiation history"),
            .init(key: "pmh", value: "immunosuppressed", logLR: 10, evidenceLabel: "Immunosuppression"),
            .init(key: "age_over", value: "50", logLR: 8, evidenceLabel: "Older patient"),
        ]),
        .init(name: "Lipoma", icd: "D17.9",
              logPrior: 30, features: [
            .init(key: "character", value: "Soft", logLR: 12, evidenceLabel: "Soft, compressible"),
            .init(key: "exam", value: "mobile", logLR: 8, evidenceLabel: "Mobile, subcutaneous"),
            .init(key: "exam", value: "non-tender", logLR: 6, evidenceLabel: "Non-tender"),
            .init(key: "exam", value: "well-defined", logLR: 8, evidenceLabel: "Well-defined border"),
            .init(key: "timing", value: "Progressive", logLR: 4, evidenceLabel: "Slow growth"),
        ]),
        .init(name: "Sebaceous Cyst (Epidermoid)", icd: "L72.0",
              logPrior: 25, features: [
            .init(key: "exam", value: "punctum", logLR: 16, evidenceLabel: "Punctum visible"),
            .init(key: "exam", value: "smooth", logLR: 6, evidenceLabel: "Smooth, dome-shaped"),
            .init(key: "exam", value: "mobile", logLR: 6, evidenceLabel: "Mobile over underlying tissue"),
            .init(key: "associations", value: "Discharge", logLR: 10, evidenceLabel: "Cheesy discharge"),
            .init(key: "associations", value: "Itching", logLR: 4, evidenceLabel: "Itching"),
        ]),
        .init(name: "Dermatofibroma", icd: "D23.9",
              logPrior: 15, features: [
            .init(key: "character", value: "Flat", logLR: 10, evidenceLabel: "Flat firm papule"),
            .init(key: "exam", value: "dimple sign", logLR: 14, evidenceLabel: "Dimple sign positive"),
            .init(key: "exam", value: "firm", logLR: 6, evidenceLabel: "Firm"),
            .init(key: "site", value: "Thigh", logLR: 8, evidenceLabel: "Lower extremity"),
            .init(key: "site", value: "Lower leg", logLR: 8, evidenceLabel: "Lower extremity"),
        ]),
    ]

    // ── Scrotal / testicular ──────────────────────────────────────────

    private static let scrotalTesticular: [Candidate] = [
        .init(name: "Testicular Torsion", icd: "N44.00",
              logPrior: 20, features: [
            .init(key: "onset", value: "Sudden", logLR: 16, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain"),
            .init(key: "associations", value: "Nausea", logLR: 10, evidenceLabel: "Nausea / vomiting"),
            .init(key: "exam", value: "absent cremasteric reflex", logLR: 18, evidenceLabel: "Absent cremasteric reflex"),
            .init(key: "exam", value: "tender testis", logLR: 12, evidenceLabel: "Tender, high-riding testis"),
            .init(key: "exam", value: "warm", logLR: 6, evidenceLabel: "Warm scrotum"),
            .init(key: "age_under", value: "25", logLR: 12, evidenceLabel: "Peak incidence < 25 yr"),
        ]),
        .init(name: "Epididymo-Orchitis", icd: "N45.3",
              logPrior: 25, features: [
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Dysuria", logLR: 10, evidenceLabel: "Dysuria"),
            .init(key: "exam", value: "tender", logLR: 10, evidenceLabel: "Tender epididymis / testis"),
            .init(key: "exam", value: "warm and erythematous", logLR: 12, evidenceLabel: "Erythema"),
            .init(key: "exam", value: "normal cremasteric reflex", logLR: 8, evidenceLabel: "Cremasteric reflex present"),
            .init(key: "age_over", value: "30", logLR: 6, evidenceLabel: "Adult — STI or UTI source"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Leukocytosis"),
        ]),
        .init(name: "Hydrocele", icd: "N43.3",
              logPrior: 25, features: [
            .init(key: "exam", value: "transilluminates", logLR: 16, evidenceLabel: "Transillumination positive"),
            .init(key: "exam", value: "scrotal oedema", logLR: 6, evidenceLabel: "Diffuse scrotal swelling"),
            .init(key: "exam", value: "non-tender", logLR: 6, evidenceLabel: "Non-tender"),
            .init(key: "character", value: "Smooth", logLR: 8, evidenceLabel: "Smooth swelling surrounding testis"),
            .init(key: "timing", value: "Progressive", logLR: 6, evidenceLabel: "Slowly enlarging"),
        ]),
        .init(name: "Varicocele", icd: "I86.1",
              logPrior: 15, features: [
            .init(key: "character", value: "Dull", logLR: 8, evidenceLabel: "Dull aching dragging pain"),
            .init(key: "exacerbating", value: "Standing", logLR: 12, evidenceLabel: "Worse on standing / Valsalva"),
            .init(key: "relieving", value: "Lying down", logLR: 10, evidenceLabel: "Relieved by lying"),
            .init(key: "exam", value: "bag of worms", logLR: 16, evidenceLabel: "'Bag of worms' on palpation"),
            .init(key: "site", value: "Left", logLR: 8, evidenceLabel: "Left-sided (most common)"),
        ]),
        .init(name: "Testicular Tumour", icd: "C62.90",
              logPrior: 10, features: [
            .init(key: "timing", value: "Progressive", logLR: 12, evidenceLabel: "Enlarging, painless mass"),
            .init(key: "exam", value: "non-tender", logLR: 8, evidenceLabel: "Non-tender hard mass"),
            .init(key: "exam", value: "no transillumination", logLR: 10, evidenceLabel: "No transillumination"),
            .init(key: "exam", value: "mass separate", logLR: 8, evidenceLabel: "Epididymis separate from mass"),
            .init(key: "age_over", value: "15", logLR: 6, evidenceLabel: "Peak 15–35 yr"),
            .init(key: "age_under", value: "40", logLR: 6, evidenceLabel: "Young male"),
            .init(key: "inv", value: "afp", logLR: 14, evidenceLabel: "Elevated AFP / β-hCG"),
            .init(key: "inv", value: "ldh", logLR: 8, evidenceLabel: "Elevated LDH"),
        ]),
    ]

    // ── Urinary retention / LUTS ──────────────────────────────────────

    private static let urinaryRetention: [Candidate] = [
        .init(name: "Benign Prostatic Hyperplasia", icd: "N40.1",
              logPrior: 35, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive LUTS"),
            .init(key: "associations", value: "Hesitancy", logLR: 10, evidenceLabel: "Hesitancy"),
            .init(key: "associations", value: "Poor stream", logLR: 10, evidenceLabel: "Poor stream"),
            .init(key: "associations", value: "Nocturia", logLR: 8, evidenceLabel: "Nocturia"),
            .init(key: "age_over", value: "50", logLR: 12, evidenceLabel: "Age >50"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "exam", value: "enlarged, benign", logLR: 14, evidenceLabel: "Smooth, enlarged prostate on DRE"),
            .init(key: "inv", value: "psa", logLR: 8, evidenceLabel: "PSA measured"),
            .init(key: "inv", value: "ultrasound", logLR: 6, evidenceLabel: "Bladder/prostate USS"),
        ]),
        .init(name: "Prostate Carcinoma", icd: "C61",
              logPrior: 12, features: [
            .init(key: "exam", value: "hard, irregular", logLR: 16, evidenceLabel: "Hard, irregular prostate on DRE"),
            .init(key: "age_over", value: "60", logLR: 10, evidenceLabel: "Age >60"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "associations", value: "Weight loss", logLR: 10, evidenceLabel: "Weight loss / constitutional symptoms"),
            .init(key: "associations", value: "Haematuria", logLR: 8, evidenceLabel: "Haematuria"),
            .init(key: "pmh", value: "prostate", logLR: 10, evidenceLabel: "Family history"),
            .init(key: "inv", value: "psa", logLR: 14, evidenceLabel: "Elevated PSA"),
        ]),
        .init(name: "Urethral Stricture", icd: "N35.9",
              logPrior: 10, features: [
            .init(key: "associations", value: "Poor stream", logLR: 14, evidenceLabel: "Poor or spraying stream"),
            .init(key: "associations", value: "Hesitancy", logLR: 8, evidenceLabel: "Hesitancy"),
            .init(key: "pmh", value: "sti", logLR: 12, evidenceLabel: "STI (gonococcal) history"),
            .init(key: "pshx", value: "urethral", logLR: 12, evidenceLabel: "Urethral instrumentation / catheterisation"),
            .init(key: "pshx", value: "trauma", logLR: 10, evidenceLabel: "Pelvic trauma"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
        ]),
        .init(name: "Neurogenic Bladder", icd: "N31.9",
              logPrior: 8, features: [
            .init(key: "pmh", value: "spinal", logLR: 14, evidenceLabel: "Spinal cord injury / disease"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetic neuropathy"),
            .init(key: "pmh", value: "multiple sclerosis", logLR: 12, evidenceLabel: "Multiple sclerosis"),
            .init(key: "exam", value: "bladder palpable", logLR: 12, evidenceLabel: "Palpable bladder"),
            .init(key: "inv", value: "urodynamics", logLR: 12, evidenceLabel: "Urodynamic studies"),
        ]),
    ]

    // ── Rectal prolapse ───────────────────────────────────────────────

    private static let rectalProlapse: [Candidate] = [
        .init(name: "Full-Thickness Rectal Prolapse", icd: "K62.3",
              logPrior: 25, features: [
            .init(key: "character", value: "Protrusion", logLR: 16, evidenceLabel: "Visible protrusion through anus"),
            .init(key: "exacerbating", value: "Defaecation", logLR: 12, evidenceLabel: "Worse on defaecation"),
            .init(key: "exacerbating", value: "Straining", logLR: 10, evidenceLabel: "Straining"),
            .init(key: "relieving", value: "Manual reduction", logLR: 14, evidenceLabel: "Manually reducible"),
            .init(key: "associations", value: "Soiling", logLR: 10, evidenceLabel: "Faecal soiling"),
            .init(key: "associations", value: "Mucus discharge", logLR: 8, evidenceLabel: "Mucus discharge"),
            .init(key: "age_over", value: "60", logLR: 8, evidenceLabel: "Older patient"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex (multiparous)"),
        ]),
        .init(name: "Third/Fourth-Degree Haemorrhoids", icd: "K64.2",
              logPrior: 30, features: [
            .init(key: "character", value: "Soft protrusion", logLR: 10, evidenceLabel: "Soft, reducible lump at anus"),
            .init(key: "associations", value: "Rectal bleeding", logLR: 12, evidenceLabel: "Bright red bleeding"),
            .init(key: "exacerbating", value: "Defaecation", logLR: 8, evidenceLabel: "Worse on defaecation"),
            .init(key: "exam", value: "external haemorrhoids", logLR: 10, evidenceLabel: "Haemorrhoids visible"),
            .init(key: "relieving", value: "Manual reduction", logLR: 8, evidenceLabel: "Reducible"),
        ]),
        .init(name: "Rectocele", icd: "N81.6",
              logPrior: 12, features: [
            .init(key: "sex_female", value: "", logLR: 14, evidenceLabel: "Female sex"),
            .init(key: "associations", value: "Incomplete emptying", logLR: 12, evidenceLabel: "Incomplete evacuation"),
            .init(key: "associations", value: "Straining", logLR: 8, evidenceLabel: "Straining at stool"),
            .init(key: "pmh", value: "obstetric", logLR: 10, evidenceLabel: "Obstetric trauma"),
            .init(key: "exam", value: "anterior wall bulge", logLR: 14, evidenceLabel: "Anterior rectal wall bulge on PR"),
        ]),
        .init(name: "Rectal Polyp (prolapsing)", icd: "K62.1",
              logPrior: 10, features: [
            .init(key: "character", value: "Intermittent protrusion", logLR: 10, evidenceLabel: "Intermittent prolapse"),
            .init(key: "associations", value: "Rectal bleeding", logLR: 10, evidenceLabel: "Rectal bleeding"),
            .init(key: "associations", value: "Mucus discharge", logLR: 8, evidenceLabel: "Mucus per rectum"),
            .init(key: "exam", value: "blood on glove", logLR: 8, evidenceLabel: "Blood on glove"),
        ]),
    ]

    // ── Parotid / salivary gland ──────────────────────────────────────

    private static let parotidSalivary: [Candidate] = [
        .init(name: "Pleomorphic Adenoma", icd: "D11.0",
              logPrior: 35, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Slowly enlarging"),
            .init(key: "exam", value: "smooth", logLR: 8, evidenceLabel: "Smooth, lobulated"),
            .init(key: "exam", value: "mobile", logLR: 10, evidenceLabel: "Mobile"),
            .init(key: "exam", value: "non-tender", logLR: 6, evidenceLabel: "Non-tender"),
            .init(key: "exam", value: "facial nerve intact", logLR: 8, evidenceLabel: "Facial nerve function preserved"),
            .init(key: "age_over", value: "30", logLR: 4, evidenceLabel: "Middle-age peak"),
        ]),
        .init(name: "Sialadenitis (Parotid)", icd: "K11.20",
              logPrior: 20, features: [
            .init(key: "exacerbating", value: "Eating", logLR: 14, evidenceLabel: "Worse on eating / salivary stimulation"),
            .init(key: "character", value: "Painful", logLR: 10, evidenceLabel: "Painful swelling"),
            .init(key: "associations", value: "Fever", logLR: 10, evidenceLabel: "Fever"),
            .init(key: "exam", value: "tender", logLR: 10, evidenceLabel: "Tender gland"),
            .init(key: "exam", value: "erythema", logLR: 8, evidenceLabel: "Overlying skin erythema"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Leukocytosis"),
        ]),
        .init(name: "Sialolithiasis (Duct Stone)", icd: "K11.5",
              logPrior: 15, features: [
            .init(key: "exacerbating", value: "Eating", logLR: 14, evidenceLabel: "Colicky swelling with meals"),
            .init(key: "character", value: "Colicky", logLR: 12, evidenceLabel: "Episodic / colicky"),
            .init(key: "exam", value: "stone palpable", logLR: 16, evidenceLabel: "Stone bimanually palpable in duct"),
            .init(key: "exam", value: "firm", logLR: 6, evidenceLabel: "Firm, tender gland"),
            .init(key: "inv", value: "ultrasound", logLR: 12, evidenceLabel: "USS — ductal calculus"),
        ]),
        .init(name: "Parotid Carcinoma", icd: "C07",
              logPrior: 5, features: [
            .init(key: "exam", value: "firm, fixed", logLR: 14, evidenceLabel: "Fixed, hard mass"),
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Rapidly enlarging"),
            .init(key: "exam", value: "facial nerve", logLR: 16, evidenceLabel: "Facial nerve palsy"),
            .init(key: "associations", value: "Pain", logLR: 8, evidenceLabel: "Pain"),
            .init(key: "age_over", value: "50", logLR: 8, evidenceLabel: "Older patient"),
            .init(key: "inv", value: "fnac", logLR: 14, evidenceLabel: "FNAC suspicious"),
        ]),
        .init(name: "Warthin's Tumour", icd: "D11.0",
              logPrior: 10, features: [
            .init(key: "exam", value: "smooth", logLR: 6, evidenceLabel: "Smooth, soft"),
            .init(key: "exam", value: "mobile", logLR: 6, evidenceLabel: "Mobile"),
            .init(key: "exam", value: "non-tender", logLR: 6, evidenceLabel: "Non-tender"),
            .init(key: "age_over", value: "50", logLR: 10, evidenceLabel: "Older male"),
            .init(key: "sex_male", value: "", logLR: 6, evidenceLabel: "Male sex"),
            .init(key: "pmh", value: "smoking", logLR: 10, evidenceLabel: "Smoking history"),
        ]),
    ]

    // ── Reflux / Heartburn / Dyspepsia ───────────────────────────────
    // Pathognomonic features drive each candidate; CC = "Reflux / Heartburn"
    // maps here directly rather than falling to the generic abdominalPain list.

    private static let refluxGERD: [Candidate] = [

        // 1. GERD / Oesophagitis — most prevalent in reflux CC context
        .init(name: "GERD / Oesophagitis", icd: "K21.00",
              logPrior: 55, features: [
            // Pathognomonic: burning retrosternal heartburn
            .init(key: "character",    value: "Burning",         logLR: 16, evidenceLabel: "Burning retrosternal / epigastric pain"),
            .init(key: "associations", value: "Heartburn",       logLR: 16, evidenceLabel: "Heartburn (pathognomonic)"),
            .init(key: "associations", value: "Regurgitation",   logLR: 14, evidenceLabel: "Acid regurgitation"),
            .init(key: "exacerbating", value: "Lying flat",      logLR: 14, evidenceLabel: "Worse lying flat / nocturnal"),
            .init(key: "exacerbating", value: "Eating",          logLR: 10, evidenceLabel: "Post-prandial worsening"),
            .init(key: "timing",       value: "Post-prandial",   logLR: 10, evidenceLabel: "Post-prandial onset"),
            .init(key: "relieving",    value: "Antacids",        logLR: 14, evidenceLabel: "Antacid relief"),
            .init(key: "relieving",    value: "Sitting up",      logLR: 10, evidenceLabel: "Upright posture relieves"),
            .init(key: "exacerbating", value: "Alcohol",         logLR:  8, evidenceLabel: "Alcohol exacerbates"),
            .init(key: "exacerbating", value: "Coffee",          logLR:  8, evidenceLabel: "Caffeine exacerbates"),
            .init(key: "associations", value: "Belching",        logLR:  8, evidenceLabel: "Frequent belching"),
            .init(key: "timing",       value: "Nocturnal",       logLR: 10, evidenceLabel: "Nocturnal symptoms"),
            .init(key: "pmh",          value: "gerd",            logLR: 12, evidenceLabel: "Known GERD history"),
            .init(key: "pmh",          value: "reflux",          logLR: 12, evidenceLabel: "Reflux history"),
            .init(key: "pmh",          value: "obese",           logLR:  6, evidenceLabel: "Obesity — GERD risk factor"),
            .init(key: "inv",          value: "ogd",             logLR: 14, evidenceLabel: "OGD — oesophagitis"),
            .init(key: "inv",          value: "oesophagitis",    logLR: 16, evidenceLabel: "Endoscopic oesophagitis confirmed"),
            .init(key: "med",          value: "prazole",         logLR: 10, evidenceLabel: "PPI therapy prescribed (active acid suppression)"),
            .init(key: "med",          value: "antacid",         logLR:  6, evidenceLabel: "Antacid use"),
            .init(key: "bmi_over",     value: "30",              logLR:  8, evidenceLabel: "Obesity (BMI ≥30) — GERD risk factor"),
            .init(key: "social",       value: "smok",            logLR:  4, evidenceLabel: "Smoking — reduces LOS tone"),
            .init(key: "social",       value: "alcohol",         logLR:  6, evidenceLabel: "Alcohol use — precipitates reflux"),
        ]),

        // 2. Hiatus Hernia — very common co-diagnosis with GERD
        .init(name: "Hiatus Hernia", icd: "K44.9",
              logPrior: 40, features: [
            .init(key: "associations", value: "Heartburn",       logLR: 12, evidenceLabel: "Heartburn with positional component"),
            .init(key: "associations", value: "Regurgitation",   logLR: 12, evidenceLabel: "Regurgitation"),
            .init(key: "exacerbating", value: "Lying flat",      logLR: 12, evidenceLabel: "Worse lying flat"),
            .init(key: "exacerbating", value: "Bending forward", logLR: 10, evidenceLabel: "Worse bending forward"),
            .init(key: "timing",       value: "Post-prandial",   logLR:  8, evidenceLabel: "Post-prandial fullness"),
            .init(key: "associations", value: "Bloating",        logLR:  8, evidenceLabel: "Epigastric bloating / fullness"),
            .init(key: "age_over",     value: "50",              logLR:  8, evidenceLabel: "Age >50 (higher prevalence)"),
            .init(key: "pmh",          value: "obese",           logLR:  8, evidenceLabel: "Obesity"),
            .init(key: "pmh",          value: "hiatus",          logLR: 16, evidenceLabel: "Known hiatus hernia"),
            .init(key: "inv",          value: "barium",          logLR: 16, evidenceLabel: "Barium swallow — hiatus hernia"),
            .init(key: "inv",          value: "cxr",             logLR: 10, evidenceLabel: "CXR — retrocardiac gas shadow"),
            .init(key: "inv",          value: "ogd",             logLR: 12, evidenceLabel: "OGD — proximal gastric mucosa above diaphragm"),
            .init(key: "med",          value: "prazole",         logLR:  6, evidenceLabel: "PPI use — suggests acid-related pathology"),
            .init(key: "bmi_over",     value: "30",              logLR:  8, evidenceLabel: "Obesity increases hiatus hernia risk"),
        ]),

        // 3. Functional Dyspepsia — post-prandial bloating/fullness without structural cause
        .init(name: "Functional Dyspepsia", icd: "K30",
              logPrior: 35, features: [
            .init(key: "associations", value: "Bloating",        logLR: 14, evidenceLabel: "Post-prandial bloating / fullness (pathognomonic for FD)"),
            .init(key: "associations", value: "Nausea",          logLR:  8, evidenceLabel: "Nausea"),
            .init(key: "character",    value: "Fullness",        logLR: 12, evidenceLabel: "Early satiety / fullness"),
            .init(key: "timing",       value: "Intermittent",    logLR:  8, evidenceLabel: "Intermittent, variable symptoms"),
            .init(key: "exacerbating", value: "Stress",          logLR:  8, evidenceLabel: "Stress-related"),
            .init(key: "age_under",    value: "45",              logLR:  8, evidenceLabel: "Younger patient (FD more common)"),
            .init(key: "relieving",    value: "Antacids",        logLR:  6, evidenceLabel: "Partial antacid relief"),
            .init(key: "inv",          value: "normal ogd",      logLR: 14, evidenceLabel: "Normal OGD (no structural cause)"),
            .init(key: "associations", value: "Weight loss",     logLR:-10, evidenceLabel: "Weight loss argues against FD"),
            .init(key: "timing",       value: "Progressive",     logLR: -8, evidenceLabel: "Progressive course argues against FD"),
        ]),

        // 4. H. Pylori Gastritis — very common in Caribbean / tropical regions
        .init(name: "H. Pylori Gastritis", icd: "K29.30",
              logPrior: 30, features: [
            // CLO / urea breath test are pathognomonic
            .init(key: "inv",          value: "clo",             logLR: 20, evidenceLabel: "CLO test positive (pathognomonic)"),
            .init(key: "inv",          value: "urea breath",     logLR: 20, evidenceLabel: "Urea breath test positive"),
            .init(key: "inv",          value: "h. pylori",       logLR: 18, evidenceLabel: "H. pylori detected"),
            .init(key: "pmh",          value: "h. pylori",       logLR: 16, evidenceLabel: "Previous H. pylori infection"),
            .init(key: "associations", value: "Nausea",          logLR:  8, evidenceLabel: "Nausea / vomiting"),
            .init(key: "character",    value: "Gnawing",         logLR:  8, evidenceLabel: "Gnawing epigastric pain"),
            .init(key: "timing",       value: "Post-prandial",   logLR:  6, evidenceLabel: "Post-prandial onset"),
            .init(key: "exacerbating", value: "NSAIDs",          logLR: 10, evidenceLabel: "NSAIDs / aspirin use"),
            .init(key: "pmh",          value: "nsaids",          logLR: 10, evidenceLabel: "NSAID use (gastritis risk factor)"),
            .init(key: "inv",          value: "ogd antrum",      logLR: 14, evidenceLabel: "Antral erythema / nodularity on OGD"),
            .init(key: "med",          value: "aspirin",         logLR: 10, evidenceLabel: "Aspirin use — gastric mucosal risk"),
            .init(key: "med",          value: "ibuprofen",       logLR:  8, evidenceLabel: "NSAID use — gastritis risk factor"),
            .init(key: "med",          value: "diclofenac",      logLR:  8, evidenceLabel: "NSAID use — gastritis risk factor"),
            .init(key: "med",          value: "naproxen",        logLR:  8, evidenceLabel: "NSAID use — gastritis risk factor"),
        ]),

        // 5. Peptic Ulcer Disease
        .init(name: "Peptic Ulcer Disease", icd: "K27.9",
              logPrior: 25, features: [
            .init(key: "character",    value: "Gnawing",         logLR: 12, evidenceLabel: "Gnawing / burning epigastric pain"),
            .init(key: "timing",       value: "Nocturnal",       logLR: 12, evidenceLabel: "Nocturnal pain (pathognomonic for duodenal ulcer)"),
            .init(key: "relieving",    value: "Food",            logLR: 12, evidenceLabel: "Relief with food (duodenal) — pathognomonic"),
            .init(key: "exacerbating", value: "Eating",          logLR: 10, evidenceLabel: "Worse with eating (gastric ulcer pattern)"),
            .init(key: "pmh",          value: "nsaids",          logLR: 14, evidenceLabel: "NSAID / aspirin use"),
            .init(key: "pmh",          value: "h. pylori",       logLR: 14, evidenceLabel: "H. pylori infection"),
            .init(key: "pmh",          value: "ulcer",           logLR: 14, evidenceLabel: "Previous peptic ulcer"),
            .init(key: "pmh",          value: "steroids",        logLR:  8, evidenceLabel: "Steroid use"),
            .init(key: "associations", value: "Haematemesis",    logLR: 16, evidenceLabel: "Haematemesis (red flag — bleeding ulcer)"),
            .init(key: "associations", value: "Melaena",         logLR: 16, evidenceLabel: "Melaena (red flag — upper GI bleed)"),
            .init(key: "age_over",     value: "45",              logLR:  6, evidenceLabel: "Age >45"),
            .init(key: "inv",          value: "ulcer",           logLR: 18, evidenceLabel: "OGD — ulcer confirmed"),
            .init(key: "inv",          value: "h. pylori",       logLR: 14, evidenceLabel: "H. pylori positive"),
            .init(key: "med",          value: "aspirin",         logLR: 14, evidenceLabel: "Aspirin — PUD risk factor"),
            .init(key: "med",          value: "ibuprofen",       logLR: 10, evidenceLabel: "NSAID use — PUD risk factor"),
            .init(key: "med",          value: "diclofenac",      logLR: 10, evidenceLabel: "NSAID use — PUD risk factor"),
            .init(key: "med",          value: "naproxen",        logLR: 10, evidenceLabel: "NSAID use — PUD risk factor"),
            .init(key: "med",          value: "warfarin",        logLR:  8, evidenceLabel: "Anticoagulation — bleeding risk"),
            .init(key: "med",          value: "apixaban",        logLR:  8, evidenceLabel: "Anticoagulation — bleeding risk"),
            .init(key: "med",          value: "rivaroxaban",     logLR:  8, evidenceLabel: "Anticoagulation — bleeding risk"),
        ]),

        // 6. Barrett's Oesophagus — complication of chronic GERD; requires surveillance
        .init(name: "Barrett's Oesophagus", icd: "K22.70",
              logPrior: 10, features: [
            .init(key: "pmh",          value: "gerd",            logLR: 16, evidenceLabel: "Chronic GERD >5 years (key risk factor)"),
            .init(key: "pmh",          value: "reflux",          logLR: 14, evidenceLabel: "Long-standing reflux history"),
            .init(key: "pmh",          value: "barrett",         logLR: 20, evidenceLabel: "Known Barrett's oesophagus"),
            .init(key: "sex_male",     value: "",                logLR:  8, evidenceLabel: "Male sex (3:1 risk ratio)"),
            .init(key: "age_over",     value: "50",              logLR: 10, evidenceLabel: "Age >50"),
            .init(key: "pmh",          value: "obese",           logLR:  6, evidenceLabel: "Obesity"),
            .init(key: "pmh",          value: "smoking",         logLR:  6, evidenceLabel: "Smoking history"),
            .init(key: "inv",          value: "barrett",         logLR: 20, evidenceLabel: "OGD — columnar-lined oesophagus / intestinal metaplasia"),
            .init(key: "inv",          value: "biopsy",          logLR: 14, evidenceLabel: "Biopsy — intestinal metaplasia confirmed"),
            .init(key: "social",       value: "smok",            logLR:  8, evidenceLabel: "Smoking — independent Barrett's risk factor"),
            .init(key: "bmi_over",     value: "30",              logLR:  6, evidenceLabel: "Obesity — abdominal pressure increases risk"),
            .init(key: "med",          value: "prazole",         logLR:  8, evidenceLabel: "PPI therapy — suggests chronic GERD (Barrett's substrate)"),
        ]),

        // 7. Eosinophilic Oesophagitis
        .init(name: "Eosinophilic Oesophagitis", icd: "K20.0",
              logPrior: 8, features: [
            .init(key: "associations", value: "Dysphagia",       logLR: 14, evidenceLabel: "Dysphagia (frequently solid foods)"),
            .init(key: "associations", value: "Food bolus",      logLR: 18, evidenceLabel: "Food bolus impaction (pathognomonic)"),
            .init(key: "pmh",          value: "atop",            logLR: 12, evidenceLabel: "Atopy / eczema / asthma / allergic rhinitis"),
            .init(key: "pmh",          value: "asthma",          logLR: 10, evidenceLabel: "Asthma"),
            .init(key: "pmh",          value: "allerg",          logLR: 10, evidenceLabel: "Food or environmental allergies"),
            .init(key: "age_under",    value: "40",              logLR:  8, evidenceLabel: "Younger patient (peak 20–40 yrs)"),
            .init(key: "sex_male",     value: "",                logLR:  6, evidenceLabel: "Male sex (3:1 ratio)"),
            .init(key: "inv",          value: "eosinophil",      logLR: 20, evidenceLabel: "Biopsy — ≥15 eosinophils/HPF (pathognomonic)"),
            .init(key: "inv",          value: "rings",           logLR: 16, evidenceLabel: "OGD — oesophageal rings / furrows"),
            .init(key: "relieving",    value: "Antacids",        logLR: -6, evidenceLabel: "Poor antacid response (argues against GERD)"),
        ]),

        // 8. Oesophageal Carcinoma — red flag; low prior but high LR features
        .init(name: "Oesophageal Carcinoma", icd: "C15.9",
              logPrior: 5, features: [
            // Pathognomonic: progressive dysphagia (solids → liquids)
            .init(key: "associations", value: "Dysphagia",       logLR: 18, evidenceLabel: "Progressive dysphagia — RED FLAG"),
            .init(key: "timing",       value: "Progressive",     logLR: 16, evidenceLabel: "Relentlessly progressive symptoms"),
            .init(key: "associations", value: "Weight loss",     logLR: 16, evidenceLabel: "Significant weight loss — RED FLAG"),
            .init(key: "associations", value: "Anorexia",        logLR: 10, evidenceLabel: "Anorexia"),
            .init(key: "age_over",     value: "55",              logLR: 12, evidenceLabel: "Age >55"),
            .init(key: "pmh",          value: "barrett",         logLR: 16, evidenceLabel: "Barrett's oesophagus (major risk factor)"),
            .init(key: "pmh",          value: "gerd",            logLR:  8, evidenceLabel: "Long-standing GERD"),
            .init(key: "pmh",          value: "smoking",         logLR:  8, evidenceLabel: "Smoking history"),
            .init(key: "exacerbating", value: "Alcohol",         logLR:  6, evidenceLabel: "Alcohol use"),
            .init(key: "sex_male",     value: "",                logLR:  6, evidenceLabel: "Male sex"),
            .init(key: "exam",         value: "cervical lymph",  logLR: 14, evidenceLabel: "Cervical lymphadenopathy"),
            .init(key: "exam",         value: "mass",            logLR: 12, evidenceLabel: "Epigastric mass"),
            .init(key: "inv",          value: "ogd",             logLR: 14, evidenceLabel: "OGD indicated"),
            .init(key: "inv",          value: "biopsy",          logLR: 20, evidenceLabel: "Biopsy — carcinoma confirmed"),
            .init(key: "inv",          value: "ct",              logLR: 10, evidenceLabel: "CT staging performed"),
        ]),

        // 9. Laryngopharyngeal Reflux (LPR / Silent Reflux)
        // Atypical GERD variant — hoarseness + globus without classic heartburn
        .init(name: "Laryngopharyngeal Reflux", icd: "K21.00",
              logPrior: 18, features: [
            .init(key: "associations", value: "Hoarseness",          logLR: 16, evidenceLabel: "Hoarseness / voice change (LPR hallmark)"),
            .init(key: "associations", value: "Globus",              logLR: 14, evidenceLabel: "Globus sensation (lump in throat)"),
            .init(key: "associations", value: "Nocturnal cough",     logLR: 14, evidenceLabel: "Nocturnal cough / wheeze"),
            .init(key: "exacerbating", value: "Lying flat",          logLR: 12, evidenceLabel: "Worse lying flat"),
            .init(key: "associations", value: "Heartburn",           logLR: -4, evidenceLabel: "Absence of classic heartburn supports LPR over GERD"),
            .init(key: "pmh",          value: "reflux",              logLR: 10, evidenceLabel: "Reflux history"),
            .init(key: "pmh",          value: "asthma",              logLR:  6, evidenceLabel: "Asthma (reflux-triggered)"),
            .init(key: "exacerbating", value: "Coffee",              logLR:  8, evidenceLabel: "Caffeine / coffee exacerbates"),
            .init(key: "relieving",    value: "Antacids",            logLR:  8, evidenceLabel: "Partial antacid / PPI relief"),
        ]),

        // 10. NSAID / Aspirin Gastropathy
        // Drug-induced gastric mucosal injury; key risk in Caribbean where NSAIDs are OTC
        .init(name: "NSAID / Aspirin Gastropathy", icd: "K29.60",
              logPrior: 18, features: [
            .init(key: "pmh",          value: "nsaids",              logLR: 18, evidenceLabel: "NSAID / aspirin use (primary risk factor)"),
            .init(key: "pmh",          value: "aspirin",             logLR: 16, evidenceLabel: "Regular aspirin use"),
            .init(key: "exacerbating", value: "NSAIDs",              logLR: 18, evidenceLabel: "NSAIDs / aspirin directly worsen symptoms"),
            .init(key: "character",    value: "Gnawing",             logLR: 10, evidenceLabel: "Gnawing epigastric pain"),
            .init(key: "site",         value: "Epigastric",          logLR: 10, evidenceLabel: "Epigastric location"),
            .init(key: "associations", value: "Nausea",              logLR:  8, evidenceLabel: "Nausea"),
            .init(key: "associations", value: "Haematemesis",        logLR: 14, evidenceLabel: "Haematemesis — mucosal erosion (red flag)"),
            .init(key: "inv",          value: "erosion",             logLR: 16, evidenceLabel: "OGD — gastric erosions confirmed"),
            .init(key: "age_over",     value: "65",                  logLR:  8, evidenceLabel: "Age >65 (high-risk for NSAID gastropathy)"),
            .init(key: "pmh",          value: "steroids",            logLR:  8, evidenceLabel: "Concurrent steroid use (additive risk)"),
        ]),
    ]

    // MARK: – Thyroid Pathology
    private static let thyroidPathology: [Candidate] = [
        .init(name: "Papillary Thyroid Carcinoma", icd: "C73",
              logPrior: 30, features: [
            .init(key: "exam",       value: "thyroid nodule",   logLR: 18, evidenceLabel: "Solitary thyroid nodule — RED FLAG"),
            .init(key: "exam",       value: "firm nodule",      logLR: 16, evidenceLabel: "Hard/firm nodule"),
            .init(key: "exam",       value: "lymph node",       logLR: 16, evidenceLabel: "Cervical lymphadenopathy"),
            .init(key: "timing",     value: "Progressive",      logLR: 12, evidenceLabel: "Progressive growth"),
            .init(key: "associations", value: "Hoarseness",     logLR: 14, evidenceLabel: "Hoarseness — recurrent laryngeal nerve"),
            .init(key: "associations", value: "Dysphagia",      logLR: 10, evidenceLabel: "Dysphagia"),
            .init(key: "sex_female", value: "",                 logLR:  8, evidenceLabel: "Female sex (3:1 ratio)"),
            .init(key: "pmh",        value: "radiation",        logLR: 16, evidenceLabel: "Prior neck radiation"),
            .init(key: "inv",        value: "ultrasound",       logLR: 14, evidenceLabel: "USS thyroid — microcalcification, irregular margin"),
            .init(key: "inv",        value: "fnac",             logLR: 20, evidenceLabel: "FNAC — malignant cells"),
            .init(key: "inv",        value: "tsh",              logLR:  6, evidenceLabel: "TSH suppressed or normal"),
        ]),
        .init(name: "Benign Thyroid Nodule / Colloid Goitre", icd: "E04.1",
              logPrior: 55, features: [
            .init(key: "exam",       value: "thyroid nodule",   logLR: 14, evidenceLabel: "Smooth, soft thyroid nodule"),
            .init(key: "exam",       value: "soft nodule",      logLR: 10, evidenceLabel: "Soft/cystic nodule"),
            .init(key: "timing",     value: "Stable",           logLR: 10, evidenceLabel: "Slow / stable growth over years"),
            .init(key: "sex_female", value: "",                 logLR:  6, evidenceLabel: "Female sex"),
            .init(key: "inv",        value: "ultrasound",       logLR: 12, evidenceLabel: "USS — anechoic/cystic, no suspicious features"),
            .init(key: "inv",        value: "tsh",              logLR:  8, evidenceLabel: "TSH — normal"),
            .init(key: "inv",        value: "fnac",             logLR: 14, evidenceLabel: "FNAC — benign (Bethesda II)"),
        ]),
        .init(name: "Graves' Disease / Hyperthyroidism", icd: "E05.0",
              logPrior: 35, features: [
            .init(key: "associations", value: "Palpitations",   logLR: 14, evidenceLabel: "Palpitations — pathognomonic triad sign"),
            .init(key: "associations", value: "Weight loss",    logLR: 14, evidenceLabel: "Weight loss despite good appetite"),
            .init(key: "associations", value: "Tremor",         logLR: 12, evidenceLabel: "Fine tremor of hands"),
            .init(key: "associations", value: "Sweating",       logLR: 12, evidenceLabel: "Heat intolerance, sweating"),
            .init(key: "exam",         value: "exophthalmos",   logLR: 20, evidenceLabel: "Exophthalmos — pathognomonic for Graves'"),
            .init(key: "exam",         value: "goitre",         logLR: 14, evidenceLabel: "Diffuse smooth goitre with bruit"),
            .init(key: "exam",         value: "bruit",          logLR: 16, evidenceLabel: "Thyroid bruit — highly specific for Graves'"),
            .init(key: "sex_female",   value: "",               logLR:  8, evidenceLabel: "Female sex (7:1)"),
            .init(key: "inv",          value: "tsh",            logLR: 18, evidenceLabel: "TSH suppressed (<0.01)"),
            .init(key: "inv",          value: "t4",             logLR: 16, evidenceLabel: "Free T4/T3 elevated"),
            .init(key: "inv",          value: "trab",           logLR: 20, evidenceLabel: "TSH receptor antibodies positive"),
        ]),
        .init(name: "Hashimoto's Thyroiditis / Hypothyroidism", icd: "E06.3",
              logPrior: 35, features: [
            .init(key: "associations", value: "Fatigue",        logLR: 12, evidenceLabel: "Fatigue, lethargy"),
            .init(key: "associations", value: "Weight gain",    logLR: 12, evidenceLabel: "Weight gain"),
            .init(key: "associations", value: "Cold intolerance", logLR: 12, evidenceLabel: "Cold intolerance"),
            .init(key: "associations", value: "Constipation",   logLR: 10, evidenceLabel: "Constipation"),
            .init(key: "associations", value: "Bradycardia",    logLR: 10, evidenceLabel: "Bradycardia"),
            .init(key: "exam",         value: "goitre",         logLR: 14, evidenceLabel: "Rubbery/firm goitre"),
            .init(key: "sex_female",   value: "",               logLR: 10, evidenceLabel: "Female sex (10:1)"),
            .init(key: "inv",          value: "tsh",            logLR: 18, evidenceLabel: "TSH elevated (>4.5)"),
            .init(key: "inv",          value: "tpo",            logLR: 18, evidenceLabel: "Anti-TPO antibodies positive"),
            .init(key: "inv",          value: "t4",             logLR: 14, evidenceLabel: "Free T4 low"),
        ]),
        .init(name: "Toxic Multinodular Goitre / Adenoma", icd: "E05.2",
              logPrior: 25, features: [
            .init(key: "exam",         value: "multinodular",   logLR: 16, evidenceLabel: "Multinodular goitre"),
            .init(key: "age_over",     value: "50",             logLR: 10, evidenceLabel: "Typically age >50"),
            .init(key: "associations", value: "Palpitations",   logLR: 12, evidenceLabel: "Palpitations / AF"),
            .init(key: "associations", value: "Weight loss",    logLR: 10, evidenceLabel: "Weight loss"),
            .init(key: "inv",          value: "tsh",            logLR: 14, evidenceLabel: "TSH suppressed"),
            .init(key: "inv",          value: "scan",           logLR: 14, evidenceLabel: "Isotope scan — hot nodule(s)"),
        ]),
        .init(name: "De Quervain's Thyroiditis", icd: "E06.1",
              logPrior: 15, features: [
            .init(key: "character",    value: "Painful",        logLR: 18, evidenceLabel: "Painful thyroid — pathognomonic"),
            .init(key: "onset",        value: "Acute",          logLR: 14, evidenceLabel: "Acute onset, weeks after URTI"),
            .init(key: "pmh",          value: "viral",          logLR: 12, evidenceLabel: "Recent viral illness"),
            .init(key: "associations", value: "Fever",          logLR: 10, evidenceLabel: "Fever, malaise"),
            .init(key: "associations", value: "Palpitations",   logLR:  8, evidenceLabel: "Transient hyperthyroid phase"),
            .init(key: "inv",          value: "esr",            logLR: 14, evidenceLabel: "ESR markedly elevated"),
            .init(key: "inv",          value: "tsh",            logLR: 10, evidenceLabel: "TSH may be suppressed initially"),
        ]),
        .init(name: "Medullary Thyroid Carcinoma", icd: "C73",
              logPrior: 8, features: [
            .init(key: "associations", value: "Diarrhoea",      logLR: 16, evidenceLabel: "Secretory diarrhoea — pathognomonic"),
            .init(key: "associations", value: "Flushing",       logLR: 14, evidenceLabel: "Flushing — calcitonin secretion"),
            .init(key: "exam",         value: "firm nodule",    logLR: 14, evidenceLabel: "Hard thyroid nodule"),
            .init(key: "exam",         value: "lymph node",     logLR: 14, evidenceLabel: "Cervical nodes"),
            .init(key: "pmh",          value: "men2",           logLR: 20, evidenceLabel: "MEN2 syndrome / family history"),
            .init(key: "inv",          value: "calcitonin",     logLR: 20, evidenceLabel: "Serum calcitonin elevated — specific"),
            .init(key: "inv",          value: "fnac",           logLR: 18, evidenceLabel: "FNAC — amyloid stroma, C-cells"),
        ]),
        .init(name: "Anaplastic Thyroid Carcinoma", icd: "C73",
              logPrior: 3, features: [
            .init(key: "timing",       value: "Rapid",          logLR: 20, evidenceLabel: "Rapidly enlarging neck mass — hallmark"),
            .init(key: "associations", value: "Stridor",        logLR: 18, evidenceLabel: "Stridor — tracheal compression — RED FLAG"),
            .init(key: "associations", value: "Dysphagia",      logLR: 14, evidenceLabel: "Dysphagia"),
            .init(key: "associations", value: "Hoarseness",     logLR: 14, evidenceLabel: "Hoarseness — RLN invasion"),
            .init(key: "age_over",     value: "65",             logLR: 12, evidenceLabel: "Age >65"),
            .init(key: "pmh",          value: "goitre",         logLR: 10, evidenceLabel: "Long-standing goitre"),
            .init(key: "inv",          value: "ct",             logLR: 14, evidenceLabel: "CT — invasive mass, calcification"),
            .init(key: "inv",          value: "biopsy",         logLR: 20, evidenceLabel: "Biopsy — undifferentiated carcinoma"),
        ]),
    ]

    // MARK: – Nausea & Vomiting
    private static let nauseaVomiting: [Candidate] = [
        .init(name: "Acute Gastroenteritis", icd: "K52.9",
              logPrior: 55, features: [
            .init(key: "onset",        value: "Acute",          logLR: 14, evidenceLabel: "Acute onset <72h"),
            .init(key: "associations", value: "Diarrhoea",      logLR: 16, evidenceLabel: "Diarrhoea — gastroenteritis hallmark"),
            .init(key: "associations", value: "Fever",          logLR: 10, evidenceLabel: "Low-grade fever"),
            .init(key: "associations", value: "Cramps",         logLR: 10, evidenceLabel: "Colicky abdominal cramps"),
            .init(key: "pmh",          value: "contact",        logLR: 14, evidenceLabel: "Sick contacts / recent travel"),
            .init(key: "pmh",          value: "food",           logLR: 14, evidenceLabel: "Suspect food ingestion"),
            .init(key: "exam",         value: "normal",         logLR:  8, evidenceLabel: "Benign abdominal exam"),
        ]),
        .init(name: "Gastroparesis", icd: "K31.84",
              logPrior: 20, features: [
            .init(key: "timing",       value: "Postprandial",   logLR: 16, evidenceLabel: "Vomiting of undigested food hours after meal"),
            .init(key: "character",    value: "Undigested food", logLR: 18, evidenceLabel: "Vomitus contains undigested food — pathognomonic"),
            .init(key: "associations", value: "Early satiety",  logLR: 14, evidenceLabel: "Early satiety, bloating"),
            .init(key: "associations", value: "Weight loss",    logLR: 10, evidenceLabel: "Weight loss"),
            .init(key: "pmh",          value: "diabetes",       logLR: 16, evidenceLabel: "Diabetes mellitus (autonomic neuropathy)"),
            .init(key: "pmh",          value: "surgery",        logLR: 12, evidenceLabel: "Prior gastric surgery"),
            .init(key: "inv",          value: "gastric empty",  logLR: 20, evidenceLabel: "Gastric emptying study — delayed"),
        ]),
        .init(name: "Gastric Outlet Obstruction", icd: "K31.1",
              logPrior: 15, features: [
            .init(key: "character",    value: "Projectile",     logLR: 18, evidenceLabel: "Projectile vomiting — classic"),
            .init(key: "character",    value: "Non-bilious",    logLR: 16, evidenceLabel: "Non-bilious vomitus"),
            .init(key: "timing",       value: "Progressive",    logLR: 14, evidenceLabel: "Progressive worsening"),
            .init(key: "associations", value: "Weight loss",    logLR: 12, evidenceLabel: "Significant weight loss"),
            .init(key: "associations", value: "Distension",     logLR: 14, evidenceLabel: "Epigastric distension / succussion splash"),
            .init(key: "pmh",          value: "peptic ulcer",   logLR: 14, evidenceLabel: "History of peptic ulcer disease"),
            .init(key: "pmh",          value: "malignancy",     logLR: 14, evidenceLabel: "Gastric malignancy"),
            .init(key: "inv",          value: "ogd",            logLR: 18, evidenceLabel: "OGD — pyloric obstruction"),
        ]),
        .init(name: "Small Bowel Obstruction", icd: "K56.60",
              logPrior: 25, features: [
            .init(key: "character",    value: "Bilious",        logLR: 16, evidenceLabel: "Bilious vomiting — distal to pylorus"),
            .init(key: "associations", value: "Distension",     logLR: 16, evidenceLabel: "Abdominal distension"),
            .init(key: "associations", value: "Colicky pain",   logLR: 14, evidenceLabel: "Colicky central abdominal pain"),
            .init(key: "associations", value: "Obstipation",    logLR: 16, evidenceLabel: "Absolute constipation — RED FLAG"),
            .init(key: "pmh",          value: "surgery",        logLR: 16, evidenceLabel: "Prior abdominal surgery (adhesions)"),
            .init(key: "exam",         value: "tinkling bowel", logLR: 14, evidenceLabel: "High-pitched / tinkling bowel sounds"),
            .init(key: "inv",          value: "xray",           logLR: 16, evidenceLabel: "AXR — air-fluid levels, dilated loops"),
            .init(key: "inv",          value: "ct",             logLR: 18, evidenceLabel: "CT abdomen — transition point"),
        ]),
        .init(name: "Appendicitis (with nausea)", icd: "K37",
              logPrior: 20, features: [
            .init(key: "onset",        value: "Acute",          logLR: 12, evidenceLabel: "Acute onset"),
            .init(key: "associations", value: "RIF pain",       logLR: 18, evidenceLabel: "Migration to right iliac fossa — pathognomonic"),
            .init(key: "associations", value: "Anorexia",       logLR: 14, evidenceLabel: "Anorexia"),
            .init(key: "associations", value: "Fever",          logLR: 12, evidenceLabel: "Low-grade fever"),
            .init(key: "exam",         value: "mcburney",       logLR: 18, evidenceLabel: "McBurney's point tenderness"),
            .init(key: "exam",         value: "rebound",        logLR: 14, evidenceLabel: "Rebound tenderness"),
            .init(key: "inv",          value: "wcc",            logLR: 12, evidenceLabel: "Raised WCC / neutrophilia"),
            .init(key: "inv",          value: "crp",            logLR: 12, evidenceLabel: "Elevated CRP"),
        ]),
        .init(name: "Cyclic Vomiting Syndrome", icd: "G43.A0",
              logPrior: 8, features: [
            .init(key: "timing",       value: "Episodic",       logLR: 18, evidenceLabel: "Stereotyped episodes — pathognomonic"),
            .init(key: "timing",       value: "Recurrent",      logLR: 16, evidenceLabel: "Recurrent with symptom-free intervals"),
            .init(key: "onset",        value: "Rapid",          logLR: 12, evidenceLabel: "Rapid onset vomiting episodes"),
            .init(key: "pmh",          value: "migraine",       logLR: 14, evidenceLabel: "Personal / family history of migraine"),
            .init(key: "exam",         value: "normal",         logLR: 10, evidenceLabel: "Normal between episodes"),
        ]),
        .init(name: "Drug-Induced Nausea / Vomiting", icd: "R11.2",
              logPrior: 25, features: [
            .init(key: "pmh",          value: "medication",     logLR: 18, evidenceLabel: "New medication / opioids / chemotherapy"),
            .init(key: "timing",       value: "Post-medication", logLR: 16, evidenceLabel: "Temporal relation to drug initiation"),
            .init(key: "exam",         value: "normal",         logLR: 10, evidenceLabel: "Normal abdominal exam"),
        ]),
    ]

    // MARK: – Upper GI Bleed
    private static let upperGIBleed: [Candidate] = [
        .init(name: "Bleeding Peptic Ulcer", icd: "K27.4",
              logPrior: 45, features: [
            .init(key: "character",    value: "Melaena",        logLR: 16, evidenceLabel: "Melaena — digested blood from upper GI"),
            .init(key: "associations", value: "Epigastric pain", logLR: 14, evidenceLabel: "Epigastric pain preceding bleed"),
            .init(key: "onset",        value: "Acute",          logLR: 12, evidenceLabel: "Acute haematemesis"),
            .init(key: "pmh",          value: "nsaid",          logLR: 16, evidenceLabel: "NSAID / aspirin use — major risk factor"),
            .init(key: "pmh",          value: "h.pylori",       logLR: 14, evidenceLabel: "H. pylori infection"),
            .init(key: "pmh",          value: "peptic ulcer",   logLR: 18, evidenceLabel: "Known peptic ulcer"),
            .init(key: "pmh",          value: "anticoagulant",  logLR: 12, evidenceLabel: "Anticoagulant use"),
            .init(key: "exam",         value: "epigastric tender", logLR: 12, evidenceLabel: "Epigastric tenderness"),
            .init(key: "inv",          value: "ogd",            logLR: 20, evidenceLabel: "OGD — ulcer with stigmata of haemorrhage"),
            .init(key: "inv",          value: "hb",             logLR: 14, evidenceLabel: "Haemoglobin drop"),
        ]),
        .init(name: "Oesophageal Varices Bleed", icd: "I85.01",
              logPrior: 20, features: [
            .init(key: "character",    value: "Haematemesis",   logLR: 20, evidenceLabel: "Massive haematemesis — RED FLAG / life-threatening"),
            .init(key: "pmh",          value: "cirrhosis",      logLR: 20, evidenceLabel: "Liver cirrhosis — pathognomonic risk"),
            .init(key: "pmh",          value: "alcohol",        logLR: 14, evidenceLabel: "Alcohol excess"),
            .init(key: "pmh",          value: "hepatitis",      logLR: 14, evidenceLabel: "Chronic hepatitis B/C"),
            .init(key: "exam",         value: "jaundice",       logLR: 12, evidenceLabel: "Jaundice, spider naevi"),
            .init(key: "exam",         value: "ascites",        logLR: 16, evidenceLabel: "Ascites"),
            .init(key: "exam",         value: "splenomegaly",   logLR: 14, evidenceLabel: "Splenomegaly"),
            .init(key: "inv",          value: "ogd",            logLR: 20, evidenceLabel: "OGD — bleeding varices"),
            .init(key: "inv",          value: "lft",            logLR: 14, evidenceLabel: "Deranged LFTs / coagulopathy"),
        ]),
        .init(name: "Mallory-Weiss Tear", icd: "K22.6",
              logPrior: 20, features: [
            .init(key: "onset",        value: "After retching", logLR: 20, evidenceLabel: "Haematemesis after forceful retching — pathognomonic"),
            .init(key: "pmh",          value: "alcohol",        logLR: 14, evidenceLabel: "Alcohol excess"),
            .init(key: "pmh",          value: "pregnancy",      logLR: 10, evidenceLabel: "Hyperemesis gravidarum"),
            .init(key: "character",    value: "Bright red",     logLR: 14, evidenceLabel: "Bright red blood — arterial bleed"),
            .init(key: "inv",          value: "ogd",            logLR: 20, evidenceLabel: "OGD — mucosal tear at GOJ"),
        ]),
        .init(name: "Dieulafoy Lesion", icd: "K31.82",
              logPrior: 5, features: [
            .init(key: "character",    value: "Massive",        logLR: 14, evidenceLabel: "Massive, painless haematemesis"),
            .init(key: "onset",        value: "Recurrent",      logLR: 16, evidenceLabel: "Recurrent self-limiting bleeds"),
            .init(key: "exam",         value: "normal",         logLR:  8, evidenceLabel: "No obvious upper GI cause on initial OGD"),
            .init(key: "inv",          value: "ogd",            logLR: 20, evidenceLabel: "OGD — visible vessel without ulceration"),
        ]),
        .init(name: "Gastric / Oesophageal Malignancy Bleed", icd: "C16.9",
              logPrior: 10, features: [
            .init(key: "associations", value: "Weight loss",    logLR: 16, evidenceLabel: "Weight loss — RED FLAG"),
            .init(key: "associations", value: "Dysphagia",      logLR: 14, evidenceLabel: "Dysphagia"),
            .init(key: "timing",       value: "Progressive",    logLR: 14, evidenceLabel: "Progressive symptoms"),
            .init(key: "age_over",     value: "55",             logLR: 12, evidenceLabel: "Age >55"),
            .init(key: "exam",         value: "mass",           logLR: 16, evidenceLabel: "Epigastric mass"),
            .init(key: "inv",          value: "ogd",            logLR: 20, evidenceLabel: "OGD + biopsy — malignancy"),
            .init(key: "inv",          value: "ct",             logLR: 14, evidenceLabel: "CT staging"),
        ]),
    ]

    // MARK: – Post-operative Review
    private static let postOpReview: [Candidate] = [
        .init(name: "Surgical Site Infection", icd: "T81.40",
              logPrior: 40, features: [
            .init(key: "onset",        value: "3–7 days post-op", logLR: 16, evidenceLabel: "Onset 3–7 days post-operatively"),
            .init(key: "associations", value: "Wound pain",     logLR: 14, evidenceLabel: "Increasing wound pain"),
            .init(key: "associations", value: "Fever",          logLR: 14, evidenceLabel: "Fever >38°C"),
            .init(key: "exam",         value: "erythema",       logLR: 16, evidenceLabel: "Wound erythema, warmth"),
            .init(key: "exam",         value: "discharge",      logLR: 18, evidenceLabel: "Purulent wound discharge — diagnostic"),
            .init(key: "exam",         value: "induration",     logLR: 12, evidenceLabel: "Periincisional induration"),
            .init(key: "inv",          value: "wcc",            logLR: 12, evidenceLabel: "WCC raised / neutrophilia"),
            .init(key: "inv",          value: "crp",            logLR: 12, evidenceLabel: "CRP elevated"),
        ]),
        .init(name: "Anastomotic Leak", icd: "K91.89",
              logPrior: 10, features: [
            .init(key: "onset",        value: "3–5 days post-op", logLR: 18, evidenceLabel: "Onset days 3–5 — peak anastomotic leak window"),
            .init(key: "associations", value: "Fever",          logLR: 16, evidenceLabel: "Fever — sentinel sign"),
            .init(key: "associations", value: "Peritonism",     logLR: 20, evidenceLabel: "Peritonism / sepsis — RED FLAG"),
            .init(key: "associations", value: "Tachycardia",    logLR: 16, evidenceLabel: "Tachycardia / clinical deterioration"),
            .init(key: "exam",         value: "peritonism",     logLR: 18, evidenceLabel: "Generalised peritonism"),
            .init(key: "inv",          value: "ct",             logLR: 20, evidenceLabel: "CT abdomen — leak / free fluid / gas"),
            .init(key: "inv",          value: "crp",            logLR: 16, evidenceLabel: "CRP >150 at day 3 — predictive"),
        ]),
        .init(name: "Post-operative Ileus", icd: "K56.0",
              logPrior: 35, features: [
            .init(key: "onset",        value: "0–5 days post-op", logLR: 14, evidenceLabel: "Expected in first 3–5 days post abdominal surgery"),
            .init(key: "associations", value: "Distension",     logLR: 14, evidenceLabel: "Abdominal distension"),
            .init(key: "associations", value: "No bowel sounds", logLR: 16, evidenceLabel: "Absent bowel sounds"),
            .init(key: "associations", value: "No flatus",      logLR: 14, evidenceLabel: "No flatus / no stool"),
            .init(key: "associations", value: "Nausea",         logLR: 12, evidenceLabel: "Nausea / vomiting"),
            .init(key: "pmh",          value: "opioid",         logLR: 12, evidenceLabel: "Opioid use"),
            .init(key: "inv",          value: "xray",           logLR: 12, evidenceLabel: "AXR — dilated loops, no transition point"),
        ]),
        .init(name: "Post-operative DVT / PE", icd: "I82.409",
              logPrior: 15, features: [
            .init(key: "associations", value: "Calf pain",      logLR: 14, evidenceLabel: "Calf pain / swelling (DVT)"),
            .init(key: "associations", value: "Breathlessness", logLR: 16, evidenceLabel: "Breathlessness — PE RED FLAG"),
            .init(key: "associations", value: "Chest pain",     logLR: 14, evidenceLabel: "Pleuritic chest pain — PE"),
            .init(key: "associations", value: "Tachycardia",    logLR: 14, evidenceLabel: "Tachycardia"),
            .init(key: "pmh",          value: "dvt",            logLR: 14, evidenceLabel: "Prior DVT / PE"),
            .init(key: "pmh",          value: "immobile",       logLR: 12, evidenceLabel: "Post-op immobility"),
            .init(key: "inv",          value: "doppler",        logLR: 18, evidenceLabel: "Duplex USS — DVT"),
            .init(key: "inv",          value: "ctpa",           logLR: 20, evidenceLabel: "CTPA — pulmonary emboli"),
            .init(key: "inv",          value: "d-dimer",        logLR: 12, evidenceLabel: "D-dimer elevated"),
        ]),
        .init(name: "Post-operative Haemorrhage", icd: "T81.0",
              logPrior: 10, features: [
            .init(key: "onset",        value: "0–24h",          logLR: 16, evidenceLabel: "Primary haemorrhage: first 24h"),
            .init(key: "associations", value: "Tachycardia",    logLR: 16, evidenceLabel: "Tachycardia / hypotension — RED FLAG"),
            .init(key: "associations", value: "Drain output",   logLR: 18, evidenceLabel: "Heavy drain output / haematoma expanding"),
            .init(key: "associations", value: "Pallor",         logLR: 12, evidenceLabel: "Pallor / anaemia"),
            .init(key: "exam",         value: "haematoma",      logLR: 16, evidenceLabel: "Expanding wound haematoma"),
            .init(key: "inv",          value: "hb",             logLR: 14, evidenceLabel: "Falling haemoglobin"),
        ]),
        .init(name: "Incisional Hernia", icd: "K43.2",
              logPrior: 15, features: [
            .init(key: "timing",       value: "Weeks-months post-op", logLR: 16, evidenceLabel: "Develops weeks to months after laparotomy"),
            .init(key: "exam",         value: "fascial defect",  logLR: 20, evidenceLabel: "Palpable fascial defect — diagnostic"),
            .init(key: "exam",         value: "bulge",          logLR: 16, evidenceLabel: "Visible/palpable wound bulge on straining"),
            .init(key: "associations", value: "Reducible",      logLR: 14, evidenceLabel: "Reducible on lying flat"),
            .init(key: "pmh",          value: "obesity",        logLR: 12, evidenceLabel: "Obesity / poor nutrition"),
            .init(key: "pmh",          value: "wound infection", logLR: 12, evidenceLabel: "Prior wound infection"),
            .init(key: "inv",          value: "ultrasound",     logLR: 14, evidenceLabel: "USS or CT — hernia sac contents"),
        ]),
    ]

    // MARK: – Adrenal & Endocrine
    private static let adrenalEndocrine: [Candidate] = [
        .init(name: "Adrenal Incidentaloma (Benign)", icd: "D35.00",
              logPrior: 50, features: [
            .init(key: "exam",         value: "asymptomatic",   logLR: 14, evidenceLabel: "Incidentally found on imaging — most common presentation"),
            .init(key: "inv",          value: "ct",             logLR: 18, evidenceLabel: "CT — well-defined, low HU (<10), <4 cm"),
            .init(key: "inv",          value: "mri",            logLR: 16, evidenceLabel: "MRI — chemical shift loss of signal"),
            .init(key: "inv",          value: "hormones",       logLR: 14, evidenceLabel: "Normal adrenal hormone screen"),
            .init(key: "age_over",     value: "40",             logLR: 10, evidenceLabel: "More common age >40"),
        ]),
        .init(name: "Conn's Syndrome (Primary Hyperaldosteronism)", icd: "E26.01",
              logPrior: 15, features: [
            .init(key: "associations", value: "Hypertension",   logLR: 16, evidenceLabel: "Resistant hypertension — key presentation"),
            .init(key: "associations", value: "Hypokalaemia",   logLR: 20, evidenceLabel: "Spontaneous hypokalaemia — pathognomonic"),
            .init(key: "associations", value: "Weakness",       logLR: 12, evidenceLabel: "Muscle weakness / cramps (hypokalaemia)"),
            .init(key: "associations", value: "Polyuria",       logLR: 10, evidenceLabel: "Polyuria / polydipsia (hypokalaemia)"),
            .init(key: "inv",          value: "aldo:renin",     logLR: 20, evidenceLabel: "Aldosterone:renin ratio >30 — diagnostic"),
            .init(key: "inv",          value: "ct",             logLR: 14, evidenceLabel: "CT adrenal — adenoma"),
            .init(key: "inv",          value: "avs",            logLR: 18, evidenceLabel: "Adrenal vein sampling — lateralisation"),
        ]),
        .init(name: "Cushing's Syndrome", icd: "E24.9",
              logPrior: 10, features: [
            .init(key: "associations", value: "Weight gain",    logLR: 14, evidenceLabel: "Central obesity / weight gain"),
            .init(key: "exam",         value: "moon face",      logLR: 18, evidenceLabel: "Moon face — Cushingoid features"),
            .init(key: "exam",         value: "buffalo hump",   logLR: 18, evidenceLabel: "Buffalo hump"),
            .init(key: "exam",         value: "striae",         logLR: 16, evidenceLabel: "Purple striae — pathognomonic"),
            .init(key: "exam",         value: "hypertension",   logLR: 12, evidenceLabel: "Hypertension"),
            .init(key: "associations", value: "Diabetes",       logLR: 12, evidenceLabel: "Hyperglycaemia / steroid diabetes"),
            .init(key: "associations", value: "Hirsutism",      logLR: 12, evidenceLabel: "Hirsutism (women)"),
            .init(key: "pmh",          value: "steroid",        logLR: 16, evidenceLabel: "Exogenous steroid use — most common cause"),
            .init(key: "inv",          value: "cortisol",       logLR: 18, evidenceLabel: "24h UFC elevated / midnight salivary cortisol"),
            .init(key: "inv",          value: "dexamethasone",  logLR: 18, evidenceLabel: "ODST — non-suppression"),
            .init(key: "inv",          value: "acth",           logLR: 14, evidenceLabel: "ACTH to distinguish adrenal vs. pituitary"),
        ]),
        .init(name: "Phaeochromocytoma", icd: "D35.00",
              logPrior: 5, features: [
            .init(key: "associations", value: "Paroxysmal hypertension", logLR: 20, evidenceLabel: "Paroxysmal hypertension — classic triad"),
            .init(key: "associations", value: "Headache",      logLR: 18, evidenceLabel: "Severe headache — triad component"),
            .init(key: "associations", value: "Sweating",      logLR: 18, evidenceLabel: "Diaphoresis — triad component"),
            .init(key: "associations", value: "Palpitations",  logLR: 18, evidenceLabel: "Palpitations — triad component"),
            .init(key: "associations", value: "Pallor",        logLR: 14, evidenceLabel: "Pallor (not flushing in most)"),
            .init(key: "pmh",          value: "men2",          logLR: 16, evidenceLabel: "MEN2 / VHL / NF1 syndrome"),
            .init(key: "inv",          value: "metanephrines", logLR: 20, evidenceLabel: "Plasma/urine metanephrines — highly sensitive"),
            .init(key: "inv",          value: "ct",            logLR: 14, evidenceLabel: "CT/MRI adrenal — hypervascular mass"),
            .init(key: "inv",          value: "mibg",          logLR: 18, evidenceLabel: "MIBG scan — functional imaging"),
        ]),
        .init(name: "Adrenocortical Carcinoma", icd: "C74.00",
              logPrior: 3, features: [
            .init(key: "exam",         value: "large mass",    logLR: 18, evidenceLabel: "Large adrenal mass >4 cm — HIGH concern"),
            .init(key: "timing",       value: "Progressive",   logLR: 14, evidenceLabel: "Progressive growth on follow-up imaging"),
            .init(key: "associations", value: "Virilisation",  logLR: 18, evidenceLabel: "Virilisation / feminisation — autonomous steroid"),
            .init(key: "associations", value: "Cushing features", logLR: 14, evidenceLabel: "Rapid-onset Cushing features"),
            .init(key: "associations", value: "Weight loss",   logLR: 14, evidenceLabel: "Weight loss — RED FLAG"),
            .init(key: "inv",          value: "ct",            logLR: 18, evidenceLabel: "CT — irregular, >10 HU, heterogeneous, >4 cm"),
            .init(key: "inv",          value: "biopsy",        logLR: 20, evidenceLabel: "Biopsy (only if uncertain origin — not adrenal primary)"),
            .init(key: "inv",          value: "steroids",      logLR: 14, evidenceLabel: "Mixed steroid hypersecretion profile"),
        ]),
    ]
}
