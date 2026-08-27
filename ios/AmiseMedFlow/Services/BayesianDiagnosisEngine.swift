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
        let probability: Int          // 0–100 %
        let evidence: [String]        // human-readable supporting features
        let confidence: Confidence

        enum Confidence {
            case high     // ≥ 55 %
            case moderate // 30–54 %
            case low      // < 30 %

            var label: String {
                switch self { case .high: "High"; case .moderate: "Moderate"; case .low: "Low" }
            }
        }
    }

    // MARK: - Public entry point

    static func infer(
        chiefComplaint: String?,
        socratesSelections: [String: Set<String>],
        pmhNotes: String?,
        surgicalHistory: String?,
        examAbdo: String?,
        examGeneral: String?,
        investigations: [InvestigationEntry],
        ageYears: Int,
        sex: Sex
    ) -> [DiagnosisResult] {
        guard let cc = chiefComplaint, !cc.isEmpty else { return [] }
        let ccL = cc.lowercased()

        let candidates: [Candidate]
        switch true {
        case ccL.contains("jaundice") || ccL.contains("yellow"):
            candidates = jaundice
        case ccL.contains("dysphagia") || ccL.contains("swallow"):
            candidates = dysphagia
        case ccL.contains("rectal bleed") || ccL.contains("blood per rectum") ||
             ccL.contains("haematochezia") || ccL.contains("bpr"):
            candidates = rectalBleeding
        case ccL.contains("bowel habit") || ccL.contains("change in stool") ||
             ccL.contains("constipation") || ccL.contains("diarrhoea") || ccL.contains("diarrhea"):
            candidates = bowelHabit
        case ccL.contains("breast") && (ccL.contains("lump") || ccL.contains("mass")):
            candidates = breastLump
        case ccL.contains("neck") && (ccL.contains("lump") || ccL.contains("swelling") || ccL.contains("mass")):
            candidates = neckLump
        case ccL.contains("thyroid"):
            candidates = neckLump
        case ccL.contains("hernia") || (ccL.contains("groin") && ccL.contains("lump")):
            candidates = hernia
        case ccL.contains("perianal") || ccL.contains("haemorrhoid") ||
             ccL.contains("hemorrhoid") || ccL.contains("anal pain") || ccL.contains("piles"):
            candidates = perianal
        case ccL.contains("weight loss") || ccL.contains("anorexia") || ccL.contains("cachexia"):
            candidates = weightLoss
        case ccL.contains("groin pain") || ccL.contains("right iliac") || ccL.contains("inguinal pain"):
            candidates = groinPain
        case ccL.contains("abdom") || ccL.contains("belly") || ccL.contains("stomach") ||
             ccL.contains("upper abdom") || ccL.contains("epigast") ||
             ccL.contains("right upper") || ccL.contains("right lower") ||
             ccL.contains("ruq") || ccL.contains("llq") || ccL.contains("rlq"):
            candidates = abdominalPain
        case ccL.contains("chest pain") || ccL.contains("chest tightness") ||
             ccL.contains("chest heaviness") || ccL.contains("palpitation"):
            candidates = chestPain
        case ccL.contains("short") && ccL.contains("breath") ||
             ccL.contains("dyspnoea") || ccL.contains("breathless") ||
             ccL.contains("sob") || ccL.contains("wheez"):
            candidates = shortnessOfBreath
        case ccL.contains("fever") || ccL.contains("infection") || ccL.contains("pyrexia") ||
             ccL.contains("dengue") || ccL.contains("leptospir") || ccL.contains("typhoid") ||
             ccL.contains("rigor") || ccL.contains("chills"):
            candidates = feverInfection
        case ccL.contains("urinary") || ccL.contains("dysuria") || ccL.contains("haematuria") ||
             ccL.contains("frequency") || ccL.contains("urine") || ccL.contains("uti"):
            candidates = urinarySymptoms
        case ccL.contains("joint") || ccL.contains("arthrit") || ccL.contains("gout") ||
             ccL.contains("musculoskelet") || ccL.contains("swollen joint") ||
             ccL.contains("joint pain") || ccL.contains("arthralgia"):
            candidates = jointPain
        case ccL.contains("hypertension") || ccL.contains("high blood pressure") ||
             ccL.contains("htn") || ccL.contains("bp review") || ccL.contains("blood pressure"):
            candidates = hypertensionReview
        case ccL.contains("diabetes") || ccL.contains("diabetic") || ccL.contains("glucose") ||
             ccL.contains("hba1c") || ccL.contains("dm2") || ccL.contains("dm1"):
            candidates = diabetesReview
        case ccL.contains("thyroid") || ccL.contains("hypothyroid") || ccL.contains("hyperthyroid") ||
             ccL.contains("graves") || ccL.contains("goitre"):
            candidates = neckLump    // existing thyroid candidates
        default:
            candidates = abdominalPain   // safest surgical default
        }

        let scored = score(
            candidates: candidates,
            socrates: socratesSelections,
            pmh: pmhNotes ?? "",
            pshx: surgicalHistory ?? "",
            examAbdo: examAbdo ?? "",
            examGeneral: examGeneral ?? "",
            investigations: investigations,
            age: ageYears,
            sex: sex
        )

        return topResults(from: scored)
    }

    // MARK: - Internal candidate type

    private struct Candidate {
        let name: String
        let icd: String
        let logPrior: Int            // higher = more prevalent in this CC context
        let features: [Feature]

        struct Feature {
            let key: String          // dimension id or sentinel like "exam", "pmh", "inv"
            let value: String        // chip label or keyword fragment
            let logLR: Int           // positive = increases probability, negative = decreases
            let evidenceLabel: String
        }
    }

    // MARK: - Scoring

    private struct ScoredCandidate {
        let candidate: Candidate
        var logPosterior: Int
        var evidence: [String]
    }

    private static func score(
        candidates: [Candidate],
        socrates: [String: Set<String>],
        pmh: String, pshx: String,
        examAbdo: String, examGeneral: String,
        investigations: [InvestigationEntry],
        age: Int, sex: Sex
    ) -> [ScoredCandidate] {
        let pmhL = pmh.lowercased()
        let pshxL = pshx.lowercased()
        let examL = (examAbdo + " " + examGeneral).lowercased()
        let invNames = investigations.map { $0.name.lowercased() }
        let invResults = investigations.filter { $0.status == .resulted }
            .map { $0.name.lowercased() + " " + $0.result.lowercased() }

        return candidates.map { c in
            var logP = c.logPrior
            var evidence: [String] = []

            for f in c.features {
                var triggered = false
                switch f.key {
                case "onset", "site", "character", "radiation", "associations",
                     "timing", "exacerbating", "relieving", "severity":
                    let sel = socrates[f.key] ?? []
                    triggered = sel.contains(where: {
                        $0.lowercased().contains(f.value.lowercased())
                    })
                case "exam":
                    triggered = examL.contains(f.value.lowercased())
                case "pmh":
                    triggered = pmhL.contains(f.value.lowercased())
                case "pshx":
                    triggered = pshxL.contains(f.value.lowercased())
                case "inv":
                    triggered = invNames.contains(where: { $0.contains(f.value.lowercased()) }) ||
                                invResults.contains(where: { $0.contains(f.value.lowercased()) })
                case "age_over":
                    if let threshold = Int(f.value) { triggered = age >= threshold }
                case "age_under":
                    if let threshold = Int(f.value) { triggered = age > 0 && age < threshold }
                case "sex_female":
                    triggered = sex == .female
                case "sex_male":
                    triggered = sex == .male
                default:
                    break
                }

                if triggered {
                    logP += f.logLR
                    if f.logLR > 0 { evidence.append(f.evidenceLabel) }
                }
            }

            return ScoredCandidate(candidate: c, logPosterior: logP, evidence: evidence)
        }
    }

    // MARK: - Softmax normalisation → top 5 results

    private static func topResults(from scored: [ScoredCandidate]) -> [DiagnosisResult] {
        guard !scored.isEmpty else { return [] }

        let maxScore = scored.map(\.logPosterior).max() ?? 0
        let exps = scored.map { exp(Double($0.logPosterior - maxScore)) }
        let total = exps.reduce(0, +)

        let withProb = zip(scored, exps).map { (s, e) -> (ScoredCandidate, Int) in
            let prob = total > 0 ? Int((e / total) * 100.0) : 0
            return (s, prob)
        }

        let top5 = withProb
            .sorted { $0.1 > $1.1 }
            .prefix(5)

        return top5.map { (s, prob) in
            let conf: DiagnosisResult.Confidence
            switch prob {
            case 55...: conf = .high
            case 30...: conf = .moderate
            default:    conf = .low
            }
            return DiagnosisResult(
                name: s.candidate.name,
                icdCode: s.candidate.icd,
                probability: prob,
                evidence: Array(s.evidence.prefix(4)),
                confidence: conf
            )
        }
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
            .init(key: "exam", value: "tender.*ruq", logLR: 10, evidenceLabel: "RUQ tender"),
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
            .init(key: "exam", value: "tender.*liver", logLR: 8, evidenceLabel: "Tender liver"),
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
}
