import Foundation

// MARK: - Diagnosis Radiation Engine
// Matches workingDiagnosis text → structured suggestions:
// investigations, management plan template, billing codes, consent category.
// All suggestions are PRESENTED to the clinician — never auto-applied.

// MARK: - Output types

struct DiagnosisRadiation {
    struct SuggestedInvestigation {
        let name: String
        let category: InvestigationEntry.InvCategory
        let rationale: String
    }
    struct BillingCode {
        let icd10: String
        let icdDescription: String
        let cpt: String?
        let cptDescription: String?
    }

    // MARK: - Clinical scoring criteria
    struct ScoreVariable {
        let id: String
        let label: String
        let unit: String
        let hint: String
        let cutoffValue: Double    // threshold; only used when isBinary == false
        let cutoffIsAbove: Bool    // true = scores if value > cutoff; false = scores if value < cutoff
        let autoFillAge: Int?      // if set, pre-fills with patient age
        let groupId: String?       // variables in same group contribute at most once (highest-priority first)
        let points: Int            // point contribution when this variable scores; can be 2 (weighted) or negative
        let isBinary: Bool         // true = Yes/No toggle; false = numeric field with cutoff threshold

        init(id: String, label: String, unit: String, hint: String,
             cutoffValue: Double, cutoffIsAbove: Bool,
             autoFillAge: Int? = nil, groupId: String? = nil,
             points: Int = 1, isBinary: Bool = false) {
            self.id = id; self.label = label; self.unit = unit; self.hint = hint
            self.cutoffValue = cutoffValue; self.cutoffIsAbove = cutoffIsAbove
            self.autoFillAge = autoFillAge; self.groupId = groupId
            self.points = points; self.isBinary = isBinary
        }
    }
    struct ScoringCriteria {
        let scoreName: String
        let variables: [ScoreVariable]
        let severeThreshold: Int
        let maxScore: Int
        let timingNote: String
        let aboveThresholdLabel: String  // badge label when score ≥ severeThreshold
        let belowThresholdLabel: String  // badge label when score < severeThreshold

        init(scoreName: String, variables: [ScoreVariable],
             severeThreshold: Int, maxScore: Int, timingNote: String,
             aboveThresholdLabel: String = "SEVERE",
             belowThresholdLabel: String = "MILD–MOD") {
            self.scoreName = scoreName; self.variables = variables
            self.severeThreshold = severeThreshold; self.maxScore = maxScore
            self.timingNote = timingNote
            self.aboveThresholdLabel = aboveThresholdLabel
            self.belowThresholdLabel = belowThresholdLabel
        }
    }

    // MARK: - Referral suggestion
    struct ReferralSuggestion: Identifiable {
        let id = UUID()
        let specialty: String
        let urgency: ReferralUrgency
        let reason: String
        let notes: String?

        enum ReferralUrgency: String {
            case emergency = "Emergency"
            case urgent    = "Urgent (2 wk)"
            case routine   = "Routine"

            var color: String {   // semantic name used by the UI
                switch self {
                case .emergency: return "red"
                case .urgent:    return "orange"
                case .routine:   return "secondary"
                }
            }
        }
    }

    let conditionName: String
    let icd10Primary: String
    let investigations: [SuggestedInvestigation]
    let planTemplate: String          // multiline, surgeon edits before saving
    let billingCodes: [BillingCode]
    let consentCategory: String?      // links to operative plan / consent
    let urgencyNote: String?
    let redFlags: [String]
    let followUp: String
    let guidelineReference: String?   // e.g. "NICE NG12; ASGE 2019"
    let scoringCriteria: ScoringCriteria?
    let referralSuggestions: [ReferralSuggestion]

    init(
        conditionName: String,
        icd10Primary: String,
        investigations: [SuggestedInvestigation],
        planTemplate: String,
        billingCodes: [BillingCode],
        consentCategory: String?,
        urgencyNote: String?,
        redFlags: [String],
        followUp: String,
        guidelineReference: String? = nil,
        scoringCriteria: ScoringCriteria? = nil,
        referralSuggestions: [ReferralSuggestion] = []
    ) {
        self.conditionName = conditionName
        self.icd10Primary = icd10Primary
        self.investigations = investigations
        self.planTemplate = planTemplate
        self.billingCodes = billingCodes
        self.consentCategory = consentCategory
        self.urgencyNote = urgencyNote
        self.redFlags = redFlags
        self.followUp = followUp
        self.guidelineReference = guidelineReference
        self.scoringCriteria = scoringCriteria
        self.referralSuggestions = referralSuggestions
    }
}

// MARK: - Engine

enum DiagnosisRadiationEngine {

    // MARK: Public API

    /// The card for a working diagnosis. `context` (age, pregnancy, allergies, medications)
    /// applies the patient safety filter (DiagnosisRadiationEngine+SafetyFilter); views that show
    /// a plan to the clinician use `radiate(for:)`, which always passes it.
    static func radiate(
        workingDiagnosis: String?,
        ageYears: Int,
        sex: Sex,
        context: RadiationContext? = nil
    ) -> DiagnosisRadiation? {
        guard let dx = workingDiagnosis, !dx.isEmpty else { return nil }
        let dxL = dx.lowercased()
        // Lookup order: explicit precedence entries (specific diagnoses that a generic keyword
        // used to capture — e.g. "hyperparathyroidism … nephrolithiasis" → renal colic, "cellulitis
        // … type 2 diabetes" → diabetes, "large bowel obstruction" → small bowel obstruction), then
        // the original dictionary, then the cards added for diagnoses that had none.
        guard var base = lookupOrder.first(where: { entry in
            entry.keywords.contains { DiagnosisRadiationEngine.keywordMatches($0, in: dxL) }
        })?.radiation else { return nil }
        // Inject referral suggestions from the lookup table (kept separate to avoid
        // repeating them in every Entry init).
        let refs = referralTable[base.conditionName] ?? additionalReferralTable[base.conditionName] ?? []
        if !refs.isEmpty {
            base = DiagnosisRadiation(
                conditionName: base.conditionName,
                icd10Primary: base.icd10Primary,
                investigations: base.investigations,
                planTemplate: base.planTemplate,
                billingCodes: base.billingCodes,
                consentCategory: base.consentCategory,
                urgencyNote: base.urgencyNote,
                redFlags: base.redFlags,
                followUp: base.followUp,
                guidelineReference: base.guidelineReference,
                scoringCriteria: base.scoringCriteria,
                referralSuggestions: refs
            )
        }
        base = withVTELine(base)
        if let context { base = applySafety(base, context) }
        return base
    }

    /// Precedence entries, the original dictionary, then the added cards.
    static let lookupOrder: [Entry] = _precedenceEntries
        + allEntries.filter { precedenceConditionNames.contains($0.radiation.conditionName) }
        + allEntries
        + _additionalEntries

    /// Existing cards that must win over a generic keyword elsewhere in the diagnosis (E6).
    static let precedenceConditionNames: Set<String> = ["Cellulitis"]

    /// NICE NG89 (2018, updated 2019): every operative / procedural card carries a VTE line.
    static func withVTELine(_ r: DiagnosisRadiation) -> DiagnosisRadiation {
        guard r.consentCategory != nil, !r.planTemplate.lowercased().contains("vte prophylaxis") else { return r }
        let line = "- VTE prophylaxis (NICE NG89): assess VTE and bleeding risk on admission; mechanical ± pharmacological prophylaxis (LMWH, dose adjusted for weight and renal function) unless contraindicated; extended prophylaxis (28 days) after major abdominal or pelvic cancer surgery."
        return DiagnosisRadiation(
            conditionName: r.conditionName, icd10Primary: r.icd10Primary, investigations: r.investigations,
            planTemplate: r.planTemplate.trimmingCharacters(in: .newlines) + "\n" + line + "\n",
            billingCodes: r.billingCodes, consentCategory: r.consentCategory, urgencyNote: r.urgencyNote,
            redFlags: r.redFlags, followUp: r.followUp, guidelineReference: r.guidelineReference,
            scoringCriteria: r.scoringCriteria, referralSuggestions: r.referralSuggestions)
    }

    // MARK: Keyword matching

    /// True when `keyword` occurs in `text` starting at a word boundary. Keywords shorter than five
    /// characters ("mi", "pe", "tb", "af", "aki", "acs") must also end at a word boundary; longer
    /// ones may run on ("haemorrhoid" finds "haemorrhoids"). Pass both strings lowercased.
    ///
    /// A plain substring test attached the ACS plan to "abdominal" and "ischaemia" ("mi"), the PE
    /// plan to "suspected" and "penetrating" ("pe"), TB to "TBSA", AKI to "taking" and AF to
    /// "after" (clinical validation, soft-tissue/trauma/burns findings).
    static func keywordMatches(_ keyword: String, in text: String) -> Bool {
        guard !keyword.isEmpty else { return false }
        let needsEndBoundary = keyword.count < 5
        var searchStart = text.startIndex
        while searchStart < text.endIndex,
              let found = text.range(of: keyword, range: searchStart..<text.endIndex) {
            let startsWord = found.lowerBound == text.startIndex
                || !isWordCharacter(text[text.index(before: found.lowerBound)])
            let endsWord = !needsEndBoundary
                || found.upperBound == text.endIndex
                || !isWordCharacter(text[found.upperBound])
            if startsWord && endsWord { return true }
            searchStart = text.index(after: found.lowerBound)
        }
        return false
    }

    private static func isWordCharacter(_ c: Character) -> Bool {
        c.isLetter || c.isNumber
    }

    // MARK: - Referral lookup table

    private typealias RS = DiagnosisRadiation.ReferralSuggestion
    private typealias RU = DiagnosisRadiation.ReferralSuggestion.ReferralUrgency

    private static let referralTable: [String: [RS]] = [
        "Biliary Colic": [
            RS(specialty: "General / HPB Surgery", urgency: .urgent, reason: "Elective cholecystectomy referral", notes: "Laparoscopic cholecystectomy within 6 weeks of acute episode")
        ],
        "Acute Cholecystitis": [
            RS(specialty: "General Surgery", urgency: .urgent, reason: "Early cholecystectomy (within 72 h or index admission)", notes: "Tokyo Guidelines — Grade I/II: early lap cholecystectomy preferred"),
            RS(specialty: "Interventional Radiology", urgency: .urgent, reason: "Percutaneous cholecystostomy if high surgical risk", notes: nil)
        ],
        "Acute Pancreatitis": [
            RS(specialty: "General / HPB Surgery", urgency: .urgent, reason: "Mild gallstone pancreatitis — cholecystectomy in the same admission", notes: "Necrotising pancreatitis / peripancreatic collections: defer until collections resolve or >6 weeks (IAP/APA; ACG 2024)"),
            RS(specialty: "Gastroenterology", urgency: .urgent, reason: "Urgent ERCP within 24 h if concomitant cholangitis; ERCP for persistent biliary obstruction (ACG 2024)", notes: nil),
            RS(specialty: "Intensive Care", urgency: .urgent, reason: "Severe pancreatitis (Atlanta III / APACHE II ≥8) — HDU/ICU step-up", notes: nil)
        ],
        "Colorectal Cancer": [
            RS(specialty: "Colorectal Surgery", urgency: .urgent, reason: "Urgent 2-week wait (2WW) referral — suspected cancer pathway", notes: "Colonoscopy + CT staging"),
            RS(specialty: "Oncology (MDT)", urgency: .urgent, reason: "Multidisciplinary team discussion before any treatment decision", notes: nil),
            RS(specialty: "Stoma Nurse", urgency: .routine, reason: "Pre-operative stoma counselling and marking", notes: nil)
        ],
        "Appendicitis": [
            RS(specialty: "General Surgery", urgency: .emergency, reason: "Appendicectomy — emergency operative referral", notes: "Alvarado score ≥7 or CT-confirmed: proceed to theatre"),
            RS(specialty: "Emergency Department", urgency: .emergency, reason: "Transfer to ED if not already in-hospital", notes: nil)
        ],
        "Acute Cholangitis": [
            RS(specialty: "Gastroenterology / ERCP", urgency: .emergency, reason: "Biliary decompression (ERCP) within 24 h; Grade III (severe) — as soon as resuscitated (TG18; ACG 2024)", notes: "Tokyo III: Grade III cholangitis = ICU + emergency biliary drainage"),
            RS(specialty: "General Surgery", urgency: .urgent, reason: "Surgical drainage if ERCP unavailable or fails", notes: nil)
        ],
        "Inguinal Hernia": [
            RS(specialty: "General Surgery", urgency: .routine, reason: "Elective hernia repair (open or laparoscopic)", notes: "Emergency referral if obstructed / strangulated"),
            RS(specialty: "Emergency Department", urgency: .emergency, reason: "Obstructed / strangulated hernia — immediate surgical referral", notes: nil)
        ],
        "Umbilical Hernia": [
            RS(specialty: "General Surgery", urgency: .routine, reason: "Elective umbilical hernia repair", notes: nil)
        ],
        "GORD / Reflux Oesophagitis": [
            RS(specialty: "Gastroenterology", urgency: .routine, reason: "OGD + H. pylori if refractory or red flags", notes: nil),
            RS(specialty: "General / Upper GI Surgery", urgency: .routine, reason: "Anti-reflux surgery (fundoplication) if PPI-refractory", notes: nil)
        ],
        "Oesophageal / Gastric Malignancy": [
            RS(specialty: "Upper GI Surgery / MDT", urgency: .urgent, reason: "2-week wait urgent cancer referral", notes: "OGD + CT staging + PET if operable"),
            RS(specialty: "Oncology", urgency: .urgent, reason: "Neoadjuvant chemotherapy discussion (FLOT/MAGIC protocol)", notes: nil)
        ],
        "Acute Mesenteric Ischaemia": [
            RS(specialty: "Vascular Surgery", urgency: .emergency, reason: "Emergency mesenteric revascularisation or laparotomy", notes: "CT angiography — do not delay anticoagulation"),
            RS(specialty: "Interventional Radiology", urgency: .emergency, reason: "Catheter-directed thrombolysis / thrombectomy", notes: nil),
            RS(specialty: "Intensive Care", urgency: .emergency, reason: "HDU/ICU post-operatively", notes: nil)
        ],
        "Abdominal Aortic Aneurysm": [
            RS(specialty: "Vascular Surgery", urgency: .urgent, reason: "EVAR / open repair — size ≥5.5 cm or symptomatic", notes: "Ruptured: emergency referral immediately"),
            RS(specialty: "Interventional Radiology", urgency: .urgent, reason: "EVAR planning / surveillance imaging", notes: nil)
        ],
        "Peripheral Arterial Disease": [
            RS(specialty: "Vascular Surgery", urgency: .urgent, reason: "Revascularisation assessment — angioplasty / bypass", notes: "Ankle-brachial index <0.5 = critical limb ischaemia"),
            RS(specialty: "Cardiology", urgency: .routine, reason: "Cardiovascular risk optimisation — statin + antiplatelet", notes: nil)
        ],
        "Aortic Dissection": [
            RS(specialty: "Cardiothoracic Surgery", urgency: .emergency, reason: "Stanford A — emergency surgery", notes: nil),
            RS(specialty: "Vascular Surgery", urgency: .emergency, reason: "Stanford B — TEVAR or medical management", notes: nil),
            RS(specialty: "Intensive Care", urgency: .emergency, reason: "ICU monitoring, BP control (target SBP 100–120)", notes: nil)
        ],
        "Small Bowel Obstruction": [
            RS(specialty: "General Surgery", urgency: .urgent, reason: "Laparotomy / adhesiolysis if conservative management fails (>48 h)", notes: "CT abdomen/pelvis to confirm and assess for strangulation"),
            RS(specialty: "Emergency Department", urgency: .emergency, reason: "Admit for fluid resuscitation + NG decompression", notes: nil)
        ],
        "Perforated Viscus / Peritonitis": [
            RS(specialty: "General Surgery", urgency: .emergency, reason: "Emergency laparotomy / laparoscopy", notes: "No delay — perforation mortality rises ~1% per hour"),
            RS(specialty: "Intensive Care", urgency: .emergency, reason: "Post-operative ICU — peritonitis with septic shock", notes: nil)
        ],
        "Renal Colic / Ureteric Calculus": [
            RS(specialty: "Urology", urgency: .urgent, reason: "Stone >5 mm or obstructing — ureteroscopy / laser lithotripsy", notes: "ESWL for stones ≤2 cm renal pelvis"),
            RS(specialty: "Nephrology", urgency: .routine, reason: "Metabolic stone workup for recurrent calculi", notes: nil)
        ],
        "Acute Kidney Injury": [
            RS(specialty: "Nephrology", urgency: .urgent, reason: "AKI stage 2/3 — specialist nephrology input", notes: "Intrinsic AKI (e.g. glomerulonephritis) → urgent biopsy consideration"),
            RS(specialty: "Urology", urgency: .urgent, reason: "Obstructive AKI — urgent decompression (DJ stent / nephrostomy)", notes: nil),
            RS(specialty: "Intensive Care", urgency: .urgent, reason: "AKI with haemodynamic compromise or hyperkalaemia refractory to medical management → RRT", notes: nil)
        ],
        "Ischaemic Stroke / TIA": [
            RS(specialty: "Neurology / Stroke Unit", urgency: .emergency, reason: "Acute stroke — thrombolysis window 4.5 h, thrombectomy 24 h", notes: "Suspected TIA: specialist assessment within 24 h — no ABCD² triage (NICE NG128)"),
            RS(specialty: "Radiology", urgency: .emergency, reason: "CT head ± CTA ± MRI (diffusion-weighted)", notes: nil),
            RS(specialty: "Neurosurgery", urgency: .emergency, reason: "Malignant MCA infarct / space-occupying stroke — decompressive craniectomy", notes: nil)
        ],
        "Subarachnoid / Intracranial Haemorrhage": [
            RS(specialty: "Neurosurgery", urgency: .emergency, reason: "SAH — aneurysm coiling / clipping; ICH — haematoma evacuation", notes: nil),
            RS(specialty: "Intensive Care / HDU", urgency: .emergency, reason: "Oral nimodipine 60 mg 4-hourly (NICE NG228), ICP monitoring, vasospasm surveillance", notes: nil)
        ],
        "Atrial Fibrillation": [
            RS(specialty: "Cardiology", urgency: .urgent, reason: "Rate/rhythm control + anticoagulation initiation (CHA₂DS₂-VASc ≥1)", notes: "DC cardioversion if haemodynamically compromised"),
            RS(specialty: "Electrophysiology", urgency: .routine, reason: "Ablation consideration for symptomatic AF refractory to antiarrhythmics", notes: nil)
        ],
        "Iron Deficiency Anaemia": [
            RS(specialty: "Gastroenterology", urgency: .urgent, reason: "OGD + colonoscopy — mandatory to exclude GI malignancy", notes: "Bidirectional scoping: upper + lower same episode"),
            RS(specialty: "Haematology", urgency: .routine, reason: "IV iron (Ferinject) if oral intolerant or severe", notes: nil),
            RS(specialty: "General Surgery", urgency: .urgent, reason: "Colorectal cancer screening / resection if mass found", notes: nil)
        ],
        "Surgical Site Infection / Wound Complication": [
            RS(specialty: "General Surgery", urgency: .urgent, reason: "Wound exploration, debridement, and closure planning", notes: "Mesh infection → specialist referral for mesh removal consideration"),
            RS(specialty: "Plastic Surgery", urgency: .routine, reason: "Complex wound reconstruction (VAC / flap) for large defects", notes: nil),
            RS(specialty: "Microbiology", urgency: .urgent, reason: "Wound swab interpretation + antimicrobial stewardship guidance", notes: nil)
        ],
        "Pilonidal Sinus Disease": [
            RS(specialty: "Colorectal / General Surgery", urgency: .routine, reason: "Elective excision ± flap repair (Bascom / Karydakis / cleft-lift)", notes: "Pilonidal abscess: I&D as emergency, definitive surgery electively"),
            RS(specialty: "Emergency Department", urgency: .emergency, reason: "Acute pilonidal abscess — incision and drainage", notes: nil)
        ],
        "Macrocytic Anaemia (B12 / Folate Deficiency)": [
            RS(specialty: "Haematology", urgency: .routine, reason: "B12 / folate deficiency investigation and replacement", notes: nil),
            RS(specialty: "Gastroenterology", urgency: .routine, reason: "Pernicious anaemia — anti-IF antibodies + OGD if atrophic gastritis suspected", notes: nil)
        ],
    ]

    // MARK: Internal entry type

    struct Entry {
        let keywords: [String]
        let radiation: DiagnosisRadiation
    }

}
