// ClinicalScoringEngine+AbdominalGI2.swift
// Oakland Score, Hinchey Classification, AIR Score, PAS, LA Classification, Truelove-Witts, Harvey-Bradshaw
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

    // MARK: - Oakland Score (Lower GI Bleed — Safe Discharge)

    struct OaklandInput: Equatable {
        var ageScore: Int = 0        // 0=<40; 1=40–69; 2=≥70
        var sexMale: Bool = false    // male = +1
        var previousLGIB: Bool = false  // previous hospital admission for LGIB = +1
        var dre: Int = 0             // 0=no blood on DRE; 1=blood on DRE
        var heartRate: Int = 0       // 0=<70; 1=70–89; 2=≥90 bpm
        var sbp: Int = 0             // 0=≥160 mmHg; 1=130–159; 2=100–129; 3=<100 mmHg
        var hbScore: Int = 0         // 0=Hb≥16 g/dL(M)/≥13(F); scale to 6 = Hb<7 g/dL
    }

    static func oakland(_ i: OaklandInput) -> ClinicalScore {
        let total = i.ageScore + (i.sexMale ? 1 : 0) + (i.previousLGIB ? 1 : 0)
                  + i.dre + i.heartRate + i.sbp + i.hbScore
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String]

        switch total {
        case 0...8:
            risk = .low
            interpretation = "Oakland \(total) — Low risk; safe discharge appropriate (rebleed <5%)"
            recs = ["Outpatient colonoscopy within 2 weeks",
                    "Written discharge advice; return if haematochezia recurs",
                    "GP follow-up and full blood count in 2–3 days"]
            flags = []
        case 9...14:
            risk = .moderate
            interpretation = "Oakland \(total) — Intermediate risk; inpatient observation recommended"
            recs = ["Admit for inpatient colonoscopy within 24 h of bowel preparation",
                    "IV access and fluid resuscitation as required",
                    "Serial haematocrit monitoring every 6 h",
                    "Gastroenterology or colorectal surgery review"]
            flags = ["Intermediate-risk LGIB — inpatient workup required"]
        default:
            risk = .high
            interpretation = "Oakland \(total) — High risk; urgent inpatient management required"
            recs = ["Resuscitate with IV crystalloid; crossmatch and group-and-save",
                    "Urgent colonoscopy after rapid bowel preparation (≤24 h)",
                    "CT angiography if haemodynamically unstable or colonoscopy not feasible",
                    "Interventional radiology and colorectal surgery on standby",
                    "HDU/ICU admission if haemodynamic compromise"]
            flags = ["High-risk LGIB — haemodynamic instability likely",
                     "Urgent endoscopic or radiological haemostasis may be required"]
        }

        return ClinicalScore(
            systemName: "Oakland Score (LGIB)",
            abbreviation: "Oakland \(total)",
            score: Double(total), maxScore: 29,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Age",             points: Double(i.ageScore),         present: i.ageScore > 0),
                ScoredItem(label: "Male sex",        points: i.sexMale ? 1.0 : 0.0,      present: i.sexMale),
                ScoredItem(label: "Previous LGIB",   points: i.previousLGIB ? 1.0 : 0.0, present: i.previousLGIB),
                ScoredItem(label: "Blood on DRE",    points: Double(i.dre),              present: i.dre > 0),
                ScoredItem(label: "Heart rate",      points: Double(i.heartRate),        present: i.heartRate > 0),
                ScoredItem(label: "Systolic BP",     points: Double(i.sbp),              present: i.sbp > 0),
                ScoredItem(label: "Haemoglobin",     points: Double(i.hbScore),          present: i.hbScore > 0)
            ],
            redFlags: flags,
            evidenceNote: "Oakland K et al. BMJ 2017;356:i6432. Validated for safe-discharge decision in acute LGIB presenting to ED. Score ≤8 = 95% probability of safe discharge without adverse outcome."
        )
    }

    // MARK: - Hinchey Classification (Perforated Diverticulitis)
    struct HincheyInput: Equatable {
        var grade: Int = 1  // 1a=pericolic abscess, 1b=mesorectal abscess, 2=pelvic abscess, 3=purulent peritonitis, 4=faecal peritonitis
    }

    static func hinchey(_ i: HincheyInput) -> ClinicalScore {
        let score = Double(i.grade)
        let flags: [String] = i.grade >= 3 ? ["Hinchey III/IV — generalised peritonitis: emergency surgery required"] : []
        let (risk, interp, recs): (ScoreRisk, String, [String])
        switch i.grade {
        case 1:
            (risk, interp, recs) = (
                .low,
                "Hinchey I (pericolic/mesorectal abscess): Localised pericolic or mesorectal abscess. Conservative management appropriate in most cases.",
                [
                    "IV antibiotics: co-amoxiclav 1.2 g TDS or piperacillin-tazobactam 4.5 g TDS",
                    "Nil by mouth until clinical improvement; then clear fluids",
                    "CT-guided percutaneous drainage if abscess >4 cm",
                    "Bowel rest and IV fluids",
                    "Reassess at 48–72 h; consider surgery if failure to improve",
                    "Elective sigmoid resection (laparoscopic Hartmann's or primary anastomosis) 6–8 weeks after recovery"
                ]
            )
        case 2:
            (risk, interp, recs) = (
                .moderate,
                "Hinchey II (pelvic abscess): Pelvic or distant abscess. CT-guided drainage is first-line; surgery if drainage fails.",
                [
                    "CT-guided percutaneous drainage if technically feasible",
                    "IV antibiotics: piperacillin-tazobactam 4.5 g TDS + metronidazole 500 mg TDS",
                    "Monitor WBC, CRP, and fever curve",
                    "Failure to respond at 48–72 h: laparoscopic lavage vs Hartmann's procedure",
                    "Plan interval sigmoid resection 6–8 weeks after recovery"
                ]
            )
        case 3:
            (risk, interp, recs) = (
                .high,
                "Hinchey III (purulent peritonitis): Generalised purulent peritonitis. Emergency surgery required — laparoscopic lavage vs Hartmann's procedure.",
                [
                    "Emergency surgical referral — theatre within 24 h in most cases",
                    "Resuscitation: IV fluids, electrolyte correction, Foley catheter",
                    "IV antibiotics: piperacillin-tazobactam 4.5 g TDS + metronidazole 500 mg TDS",
                    "Laparoscopic lavage and drainage (LADIES trial evidence) in select stable patients",
                    "Hartmann's procedure (sigmoid resection, end colostomy) for haemodynamic instability",
                    "ICU admission post-operatively for organ support if required",
                    "Stoma reversal considered at 6–12 months if patient fit"
                ]
            )
        default:
            (risk, interp, recs) = (
                .critical,
                "Hinchey IV (faecal peritonitis): Generalised faecal peritonitis. Life-threatening — emergency surgery within hours. Mortality 35–50%.",
                [
                    "Emergency surgery — immediate theatre (within 6 hours of diagnosis)",
                    "Aggressive resuscitation: target MAP >65 mmHg, lactate clearance",
                    "Vasopressors if septic shock: noradrenaline first-line",
                    "Hartmann's procedure (sigmoid resection, end colostomy) is standard",
                    "Damage control surgery if physiologically deranged (pH <7.2, T <34°C, coagulopathy)",
                    "ICU admission post-operatively",
                    "Mortality 35–50% — early goals of care discussion with family"
                ]
            )
        }
        return ClinicalScore(
            systemName: "Hinchey Classification",
            abbreviation: "Hinchey \(["0","Ia/Ib","II","III","IV"][min(i.grade, 4)])",
            score: score,
            maxScore: 4,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Grade Ia — pericolic abscess", points: 0, present: i.grade == 1),
                ScoredItem(label: "Grade II — pelvic/distant abscess", points: 0, present: i.grade == 2),
                ScoredItem(label: "Grade III — purulent peritonitis", points: 0, present: i.grade == 3),
                ScoredItem(label: "Grade IV — faecal peritonitis", points: 0, present: i.grade == 4)
            ],
            redFlags: flags,
            evidenceNote: "Hinchey EJ et al. Adv Surg 1978;12:85–109. Modified by Wasvary (1999) to include Grade Ia/Ib. LADIES trial (Br J Surg 2019) supports laparoscopic lavage for Hinchey III in stable patients. Faecal peritonitis (IV) remains a surgical emergency with high mortality."
        )
    }

    // MARK: - AIR Score (Appendicitis Inflammatory Response)
    struct AIRInput: Equatable {
        var vomiting: Bool = false                // 1 pt
        var painRIF: Bool = false                  // 1 pt — pain in right iliac fossa
        var reboundTenderness: Int = 0             // 0=none, 1=mild, 2=moderate, 3=strong
        var tempAbove38point5: Bool = false        // 1 pt — T ≥ 38.5°C
        var pmn: Int = 0                           // 0=<70%, 1=70–84%, 2=≥85%
        var wbc: Int = 0                           // 0=<10, 1=10–14.9, 2=≥15 ×10⁹/L
        var crp: Int = 0                           // 0=<10, 1=10–49, 2=≥50 mg/L
    }

    static func air(_ i: AIRInput) -> ClinicalScore {
        var pts = 0
        if i.vomiting      { pts += 1 }
        if i.painRIF       { pts += 1 }
        pts += min(i.reboundTenderness, 3)
        if i.tempAbove38point5 { pts += 1 }
        pts += min(i.pmn, 2)
        pts += min(i.wbc, 2)
        pts += min(i.crp, 2)

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]

        switch pts {
        case 0...4:
            risk = .low
            interp = "AIR \(pts)/12 — Low risk. Appendicitis unlikely. Consider observation, analgesia, and discharge with safety-net advice. D/W senior if clinical picture worsens."
            flags = []
            recs = [
                "Low risk — active observation or discharge with clear safety-net advice",
                "Reassess at 4–6 hours if admitted; repeat bloods and CRP if borderline",
                "Consider USS abdomen in children and women of childbearing age",
                "Return precautions: worsening pain, fever, vomiting — return immediately",
                "Avoid routine CT in low-risk AIR — radiation exposure not justified"
            ]
        case 5...8:
            risk = .moderate
            interp = "AIR \(pts)/12 — Intermediate risk. Significant probability of appendicitis. Admit for serial observation; imaging and surgical review recommended."
            flags = []
            recs = [
                "Admit for in-hospital observation — serial abdominal examinations",
                "Repeat FBC and CRP at 4–8 hours",
                "Ultrasound abdomen: first-line imaging (no radiation), especially in children and women",
                "CT abdomen/pelvis if USS non-diagnostic and clinical picture unclear",
                "Early surgical review — low threshold for diagnostic laparoscopy if clinical deterioration",
                "IV access and fluids; nil by mouth pending surgical decision"
            ]
        default:
            risk = .high
            interp = "AIR \(pts)/12 — High risk. Appendicitis highly likely. Surgical referral and theatre planning."
            flags = ["AIR ≥ 9 — high-risk appendicitis: urgent surgical assessment required"]
            recs = [
                "Urgent surgical referral — arrange theatre",
                "Nil by mouth, IV access, IV fluids, analgesia (morphine + anti-emetic)",
                "Preoperative bloods: FBC, CRP, U&E, LFT, coagulation, G&S",
                "IV antibiotics at induction: co-amoxiclav 1.2 g or cefuroxime + metronidazole",
                "Laparoscopic appendicectomy is the standard approach — open if laparoscopic not available",
                "Perforation risk increases with each additional hour — avoid unnecessary delay",
                "Imaging only if it will not delay theatre (may be omitted in classic high-risk presentations)"
            ]
        }
        return ClinicalScore(
            systemName: "AIR Score (Appendicitis Inflammatory Response)",
            abbreviation: "AIR \(pts)/12",
            score: Double(pts),
            maxScore: 12,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Vomiting", points: 1, present: i.vomiting),
                ScoredItem(label: "Pain in right iliac fossa", points: 1, present: i.painRIF),
                ScoredItem(label: "Rebound tenderness/guarding (mild)", points: 1, present: i.reboundTenderness == 1),
                ScoredItem(label: "Rebound tenderness/guarding (moderate)", points: 2, present: i.reboundTenderness == 2),
                ScoredItem(label: "Rebound tenderness/guarding (strong)", points: 3, present: i.reboundTenderness == 3),
                ScoredItem(label: "Temperature ≥ 38.5°C", points: 1, present: i.tempAbove38point5),
                ScoredItem(label: "PMN 70–84%", points: 1, present: i.pmn == 1),
                ScoredItem(label: "PMN ≥ 85%", points: 2, present: i.pmn == 2),
                ScoredItem(label: "WBC 10–14.9 × 10⁹/L", points: 1, present: i.wbc == 1),
                ScoredItem(label: "WBC ≥ 15 × 10⁹/L", points: 2, present: i.wbc == 2),
                ScoredItem(label: "CRP 10–49 mg/L", points: 1, present: i.crp == 1),
                ScoredItem(label: "CRP ≥ 50 mg/L", points: 2, present: i.crp == 2)
            ],
            redFlags: flags,
            evidenceNote: "Andersson M, Andersson RE. World J Surg 2008;32:1843–1849. AIR score validated across adult acute surgical populations. Sensitivity 96%, specificity 87% for scores ≥9. Superior to Alvarado in inflammatory marker specificity; requires FBC and CRP. Validated in Swedish and international cohorts."
        )
    }

    // MARK: - Paediatric Appendicitis Score (PAS)
    struct PASInput: Equatable {
        var anorexia: Bool = false              // 1 pt
        var nausea: Bool = false                // 1 pt
        var migration: Bool = false             // 1 pt — pain migrating to RIF
        var tendernessRIF: Bool = false         // 2 pts
        var coughPercussionHop: Bool = false    // 2 pts — cough/percussion/hopping worsens pain
        var pyrexia: Bool = false               // 1 pt — T ≥ 38.0°C
        var leukocytosis: Bool = false          // 2 pts — WBC > 10 × 10⁹/L
        var polymorphonuclearShift: Bool = false // 1 pt — PMN > 7.5 × 10⁹/L
    }

    static func pas(_ i: PASInput) -> ClinicalScore {
        var pts = 0
        if i.anorexia    { pts += 1 }
        if i.nausea      { pts += 1 }
        if i.migration   { pts += 1 }
        if i.tendernessRIF       { pts += 2 }
        if i.coughPercussionHop  { pts += 2 }
        if i.pyrexia     { pts += 1 }
        if i.leukocytosis         { pts += 2 }
        if i.polymorphonuclearShift { pts += 1 }

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]
        switch pts {
        case 0...3:
            risk = .low
            interp = "PAS \(pts)/10 — Low risk. Appendicitis unlikely in this child. Consider discharge with safety-net advice or short observation."
            flags = []
            recs = [
                "Low risk — observation 4–6 hours or discharge with clear safety-net advice",
                "Return immediately if: worsening pain, fever, vomiting, or inability to walk",
                "Consider USS abdomen if diagnosis remains uncertain",
                "Paediatric surgeon review if any deterioration during observation"
            ]
        case 4...6:
            risk = .moderate
            interp = "PAS \(pts)/10 — Intermediate risk. Significant probability of appendicitis. Admit, serial examination, imaging."
            flags = []
            recs = [
                "Admit for in-hospital observation and serial abdominal examinations",
                "FBC + CRP; repeat at 6–8 hours if borderline",
                "USS abdomen: first-line imaging in children (no radiation)",
                "MRI abdomen if USS non-diagnostic (preferred over CT in paediatric patients)",
                "Paediatric surgical review within 2–4 hours",
                "IV access, nil by mouth pending surgical decision"
            ]
        default:
            risk = .high
            interp = "PAS \(pts)/10 — High risk. Appendicitis likely in this child. Urgent surgical referral."
            flags = ["PAS ≥ 7 — high-risk paediatric appendicitis: urgent surgical referral"]
            recs = [
                "Urgent paediatric surgical referral — theatre planning",
                "IV access, IV fluids, analgesia (weight-adjusted morphine + ondansetron)",
                "Nil by mouth, FBC, CRP, U&E, group and save",
                "IV antibiotics at induction: co-amoxiclav (weight-adjusted dose)",
                "Laparoscopic appendicectomy is first-line in children",
                "Consider pre-op USS even in high PAS — may change operative approach if perforation/abscess",
                "Inform parents of perforation risk (~15–20% in paediatric appendicitis)"
            ]
        }
        return ClinicalScore(
            systemName: "Paediatric Appendicitis Score (PAS)",
            abbreviation: "PAS \(pts)/10",
            score: Double(pts),
            maxScore: 10,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Anorexia", points: 1, present: i.anorexia),
                ScoredItem(label: "Nausea / vomiting", points: 1, present: i.nausea),
                ScoredItem(label: "Migration of pain to RIF", points: 1, present: i.migration),
                ScoredItem(label: "Tenderness in right iliac fossa", points: 2, present: i.tendernessRIF),
                ScoredItem(label: "Cough / percussion / hop worsens pain", points: 2, present: i.coughPercussionHop),
                ScoredItem(label: "Pyrexia ≥ 38.0°C", points: 1, present: i.pyrexia),
                ScoredItem(label: "Leukocytosis (WBC > 10 × 10⁹/L)", points: 2, present: i.leukocytosis),
                ScoredItem(label: "Polymorphonuclear shift (PMN > 7.5 × 10⁹/L)", points: 1, present: i.polymorphonuclearShift)
            ],
            redFlags: flags,
            evidenceNote: "Samuel M. J Pediatr Surg 2002;37:877–881. PAS validated in children aged 2–18. Sensitivity 83%, specificity 80% for scores ≥7. Less specific than AIR for adults; use PAS in paediatric populations (<16 yrs). USS first-line imaging in children — CT reserved for diagnostic uncertainty only."
        )
    }

    // MARK: - Los Angeles Classification (GERD / Oesophagitis)
    struct LosAngelesInput: Equatable {
        var grade: Int = 0  // 0=None, 1=Grade A, 2=Grade B, 3=Grade C, 4=Grade D
    }
    static func losAngeles(_ i: LosAngelesInput) -> ClinicalScore {
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch i.grade {
        case 0:
            interp = "No endoscopic oesophagitis"
            risk   = .low
            recs   = ["Non-erosive reflux disease (NERD) if symptoms present",
                      "Empirical PPI trial 4–8 weeks; lifestyle advice (weight loss, head-of-bed elevation)",
                      "Consider 24-h pH/impedance if atypical symptoms or PPI failure"]
        case 1:
            interp = "Grade A — ≥1 mucosal break ≤5 mm, not extending between folds"
            risk   = .low
            recs   = ["PPI once daily (standard dose) for 4–8 weeks",
                      "Lifestyle modifications (avoid late meals, alcohol, tobacco)",
                      "Repeat OGD only if symptoms persist or alarm features develop"]
        case 2:
            interp = "Grade B — ≥1 mucosal break >5 mm, not extending between folds"
            risk   = .moderate
            recs   = ["PPI standard dose twice daily for 8 weeks",
                      "Confirm healing at 8 weeks: repeat OGD to exclude Barrett's",
                      "Consider H. pylori testing and eradication",
                      "Anti-reflux surgery (fundoplication) discussion if PPI-dependent"]
        case 3:
            interp = "Grade C — Mucosal breaks extending between ≥2 folds, <75% circumference"
            risk   = .moderate
            recs   = ["High-dose PPI twice daily for 8 weeks minimum",
                      "Repeat OGD to confirm healing and exclude Barrett's oesophagus",
                      "H. pylori testing mandatory",
                      "Refer for anti-reflux surgery evaluation if PPI refractory",
                      "Biopsy for Barrett's surveillance protocol if columnar metaplasia seen"]
        default:
            interp = "Grade D — Mucosal breaks extending ≥75% of oesophageal circumference"
            risk   = .high
            recs   = ["High-dose PPI twice daily for 8–12 weeks; IV PPI if unable to swallow",
                      "Urgent repeat OGD at 8 weeks — high risk of Barrett's and stricture",
                      "Biopsy from all four quadrants every 2 cm if columnar segment present",
                      "Oesophageal dilation if peptic stricture develops",
                      "Multidisciplinary discussion for anti-reflux surgery or endoscopic therapy"]
        }
        let gradeLabel = ["None","A","B","C","D"][min(i.grade, 4)]
        return ClinicalScore(
            name:          "LA Classification",
            score:         Double(i.grade),
            maxScore:      4,
            risk:          risk,
            interpretation: "Grade \(gradeLabel): \(interp)",
            recommendations: recs,
            evidenceNote:  "Lundell LR et al. Gut 1999;45:172–180. Los Angeles Classification of oesophagitis: Grade A–D based on extent and continuity of mucosal breaks at OGD. Internationally adopted standard; grade predicts PPI response rate (A/B >90%, C/D ~70%) and Barrett's risk (D ~30%)."
        )
    }

    // MARK: - Truelove-Witts Severity Index (Ulcerative Colitis)
    struct TruelovewIttsInput: Equatable {
        var stoolsPerDay: Int = 0         // BM frequency per day
        var macroscopicBlood: Bool = false // Visible blood in stool
        var hrAbove90: Bool = false        // HR > 90 bpm
        var tempAbove375: Bool = false     // Temperature > 37.5°C
        var hbBelow105: Bool = false       // Haemoglobin < 10.5 g/dL (< 105 g/L)
        var esrAbove30: Bool = false       // ESR > 30 mm/hr
    }
    static func truelovewItts(_ i: TruelovewIttsInput) -> ClinicalScore {
        let (interp, risk, score, recs): (String, ScoreRisk, Double, [String])
        let systemic = (i.hrAbove90 ? 1 : 0) + (i.tempAbove375 ? 1 : 0) +
                       (i.hbBelow105 ? 1 : 0) + (i.esrAbove30 ? 1 : 0)
        let hasSystemic = systemic >= 2
        switch (i.stoolsPerDay, i.macroscopicBlood, hasSystemic) {
        case (let n, _, false) where n < 4:
            interp = "Mild UC — < 4 stools/day, no systemic involvement"
            risk   = .low
            score  = 1
            recs   = ["Topical aminosalicylate (suppository or enema) for distal disease",
                      "Oral mesalazine for extensive mild UC",
                      "Outpatient management with gastroenterology review in 2–4 weeks",
                      "Ensure calprotectin and CRP documented"]
        case (4...5, _, false), (4...5, false, _):
            interp = "Moderate UC — 4–5 stools/day without systemic toxicity"
            risk   = .moderate
            score  = 2
            recs   = ["Oral prednisolone 40 mg daily — standard induction",
                      "Continue maintenance aminosalicylate at full dose",
                      "Ensure gastroenterology review within 5–7 days",
                      "Stool MC&S to exclude infective colitis",
                      "FBC, CRP, albumin, LFTs baseline"]
        default:
            interp = "Severe UC — ≥6 stools/day OR ≥4 with systemic toxicity (Truelove-Witts criteria)"
            risk   = .high
            score  = 3
            recs   = ["Admit for IV hydrocortisone 100 mg QDS (or equivalent)",
                      "Daily stool chart and CRP; abdominal X-ray on admission",
                      "Surgical assessment on day of admission — colectomy if not responding",
                      "Assessment at 72 h: Oxford Score/CRP > 45 at day 3 = predict failure",
                      "Biologic rescue therapy (infliximab or ciclosporin) if IV steroids fail at 72 h",
                      "Involve colorectal surgery — nil by mouth if toxic megacolon suspected"]
        }
        return ClinicalScore(
            name:          "Truelove-Witts",
            score:         score,
            maxScore:      3,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Truelove SC, Witts LJ. BMJ 1955;2:1041–1048. Original criteria: mild = <4 stools/day, no systemic features; severe = ≥6/day + one of HR>90, temp>37.5°C, Hb<10.5, ESR>30; moderate = between mild and severe. Remains the cornerstone of inpatient IBD management decisions. ACPGBI/BSG guidelines endorse IV steroids for severe disease with surgical assessment from day 1."
        )
    }

    // MARK: - Harvey-Bradshaw Index (Crohn's Disease Activity)
    struct HarveyBradshawInput: Equatable {
        var generalWellbeing: Int = 0     // 0=very well, 1=slightly below par, 2=poor, 3=very poor, 4=terrible
        var abdominalPain: Int = 0        // 0=none, 1=mild, 2=moderate, 3=severe
        var liquidStoolsPerDay: Int = 0   // number of liquid stools per day
        var abdominalMass: Int = 0        // 0=none, 1=dubious, 2=definite, 3=definite + tender
        var complications: Int = 0        // number present: arthralgia, uveitis, erythema nodosum, aphthous ulcers, pyoderma, anal fissure, fistula, abscess
    }
    static func harveyBradshaw(_ i: HarveyBradshawInput) -> ClinicalScore {
        let total = i.generalWellbeing + i.abdominalPain + i.liquidStoolsPerDay +
                    i.abdominalMass + i.complications
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 0...4:
            interp = "Remission (HBI < 5)"
            risk   = .low
            recs   = ["Continue maintenance therapy (azathioprine, anti-TNF, or vedolizumab)",
                      "Gastroenterology review every 6–12 months",
                      "Annual calprotectin, CRP, FBC, LFTs",
                      "Surveillance ileocolonoscopy per local IBD protocol"]
        case 5...7:
            interp = "Mildly active Crohn's disease (HBI 5–7)"
            risk   = .low
            recs   = ["Review current maintenance therapy — optimise dose",
                      "Check therapeutic drug levels if on anti-TNF",
                      "Enteral nutrition as adjunct in young patients",
                      "Exclude infection: stool MC&S, C. difficile, CMV",
                      "Gastroenterology review within 2–4 weeks"]
        case 8...16:
            interp = "Moderately active Crohn's disease (HBI 8–16)"
            risk   = .moderate
            recs   = ["Prednisolone induction: 40 mg daily tapering over 8 weeks",
                      "Consider biological therapy if corticosteroid-dependent or refractory",
                      "IBD nurse specialist involvement for monitoring and patient education",
                      "MRE or CT enterography to assess extent and exclude complication",
                      "Surgical review if loculated collection, stricture, or fistula identified"]
        default:
            interp = "Severely active Crohn's disease (HBI > 16)"
            risk   = .high
            recs   = ["Hospital admission for IV hydrocortisone or biological rescue",
                      "Urgent cross-sectional imaging (MRI/CT) for abscess, perforation, or fistula",
                      "Surgical assessment — resection or drainage as indicated",
                      "Nutritional support: nasogastric or parenteral nutrition",
                      "Multidisciplinary IBD team decision within 48 hours"]
        }
        return ClinicalScore(
            name:          "Harvey-Bradshaw Index",
            score:         Double(total),
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Harvey RF, Bradshaw JM. Lancet 1980;1:514. 5-item simplified CDAI derivative; remission <5, mild 5–7, moderate 8–16, severe >16. Requires no laboratory values; validated for outpatient monitoring. Correlates with CDAI (r ≈ 0.93). Used in surgical trials for objective preoperative activity stratification."
        )
    }

}
