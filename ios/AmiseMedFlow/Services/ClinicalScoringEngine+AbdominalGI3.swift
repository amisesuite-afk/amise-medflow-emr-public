// ClinicalScoringEngine+AbdominalGI3.swift
// Truelove-Witts Severity Index (UC) and Harvey-Bradshaw Index (Crohn's) scoring.

import Foundation


extension ClinicalScoringEngine {

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
