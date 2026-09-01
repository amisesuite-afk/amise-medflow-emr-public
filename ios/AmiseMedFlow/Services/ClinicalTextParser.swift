import Foundation

// Keyword-based clinical NLP that runs entirely on-device.
// Parses free text (HPI, exam findings, notes) and returns:
//   - featureAugments: additional SOCRATES-keyed features to pass to BayesianDiagnosisEngine
//   - clinicalAlarms:  critical pattern detections requiring immediate action
//   - ccHint:          inferred chief complaint if none is set
enum ClinicalTextParser {

    // MARK: - Types

    struct ParseResult {
        var featureAugments: [String: Set<String>]
        var clinicalAlarms: [ClinicalAlarm]
        var ccHint: String?
    }

    struct ClinicalAlarm: Identifiable {
        let id = UUID()
        let title: String
        let detail: String
        let severity: AlarmSeverity
        let systemImage: String
        let action: String

        enum AlarmSeverity {
            case emergency  // red — act now, do not defer
            case critical   // deep orange — urgent escalation
            case warning    // amber — close monitoring
        }
    }

    // MARK: - Public entry point

    static func parse(
        hpi: String?,
        examGeneral: String?,
        examAbdo: String?,
        examOther: String?,
        notes: String?
    ) -> ParseResult {
        let text = [hpi, examGeneral, examAbdo, examOther, notes]
            .compactMap { $0?.lowercased() }
            .joined(separator: " ")

        var features: [String: Set<String>] = [:]
        var alarms: [ClinicalAlarm] = []

        func add(_ dim: String, _ chip: String) { features[dim, default: []].insert(chip) }
        func has(_ kw: String) -> Bool { text.contains(kw) }
        func any(_ kws: [String]) -> Bool { kws.contains { text.contains($0) } }
        func all(_ kws: [String]) -> Bool { kws.allSatisfy { text.contains($0) } }

        // MARK: Site
        if any(["rlq", "right iliac fossa", "right lower quadrant", "mcburney", "right iliac"]) { add("site", "RLQ") }
        if any(["epigastric", "epigastrium", "upper middle"]) { add("site", "Epigastric") }
        if any(["ruq", "right upper quadrant", "right hypochondrium"]) { add("site", "RUQ") }
        if any(["luq", "left upper quadrant", "left hypochondrium"]) { add("site", "LUQ") }
        if any(["llq", "left iliac fossa", "left lower quadrant", "left iliac"]) { add("site", "LLQ") }
        if any(["periumbilical", "peri-umbilical", "umbilical region", "around navel"]) { add("site", "Periumbilical") }
        if any(["suprapubic", "supra-pubic", "pelvic"]) { add("site", "Suprapubic") }
        if any(["diffuse", "generalised", "generalized", "throughout the abdomen", "whole abdomen", "pan-abdominal"]) { add("site", "Diffuse") }
        if any(["loin", "flank", "renal angle", "cva tenderness"]) { add("site", "Loin") }
        if any(["groin", "inguinal region", "inguinal area"]) { add("site", "Groin") }
        if any(["chest", "precordial", "retrosternal", "substernal"]) { add("site", "Chest") }
        if any(["perineal", "perianal", "anal", "rectal"]) { add("site", "Perineal") }

        // MARK: Character
        if any(["sharp", "stabbing", "lancinating", "knife-like"]) { add("character", "Sharp"); add("character", "Stabbing") }
        if any(["dull", "aching", "heavy", "deep ache"]) { add("character", "Dull"); add("character", "Aching") }
        if any(["colicky", "colic", "cramp", "cramping", "spasm"]) { add("character", "Colicky"); add("character", "Cramping") }
        if any(["burning", "heartburn", "acid", "fire"]) { add("character", "Burning") }
        if any(["throbbing", "pulsating", "pulsatile"]) { add("character", "Throbbing") }
        if any(["pressure", "tightness", "tight", "constricting", "squeezing"]) { add("character", "Pressure") }
        if any(["bloating", "bloated", "distension", "distended"]) { add("character", "Bloating") }
        if any(["pulling", "dragging"]) { add("character", "Pulling") }

        // MARK: Radiation
        if any(["radiates to back", "radiation to back", "radiating to back", "through to back", "back pain"]) { add("radiation", "Back") }
        if any(["right shoulder tip", "shoulder tip", "right shoulder"]) { add("radiation", "Right shoulder") }
        if any(["loin to groin", "radiates to groin", "groin radiation", "to the groin"]) { add("radiation", "Groin") }
        if any(["jaw pain", "radiates to jaw", "to the jaw"]) { add("radiation", "Jaw") }
        if any(["radiates to arm", "left arm pain", "down the arm", "arm pain"]) { add("radiation", "Arm") }
        if any(["radiates to chest", "up to chest", "to the chest"]) { add("radiation", "Chest") }

        // MARK: Associations
        if has("nausea") { add("associations", "Nausea") }
        if any(["vomit", "emesis", "sick", "retching"]) { add("associations", "Vomiting") }
        if any(["fever", "pyrexia", "febrile", "hyperthermia", "temperature"]) { add("associations", "Fever") }
        if any(["rigor", "shiver", "chills", "sweats"]) { add("associations", "Rigors") }
        if any(["anorexia", "no appetite", "poor appetite", "off food", "not eating", "reduced appetite"]) { add("associations", "Anorexia") }
        if any(["weight loss", "losing weight", "lost weight", "unintentional weight"]) { add("associations", "Weight loss") }
        if any(["jaundice", "jaundiced", "icteric", "yellow", "scleral icterus", "sclera yellow"]) { add("associations", "Jaundice") }
        if any(["rectal bleed", "pr bleed", "blood pr", "bright red blood", "brbpr", "haematochezia", "hematochezia"]) { add("associations", "Rectal bleeding") }
        if any(["melaena", "melena", "tarry stool", "dark stool", "black stool"]) { add("associations", "Melaena") }
        if any(["change in bowel", "altered bowel", "constipation", "diarrhoea", "diarrhea", "loose stool"]) { add("associations", "Change in bowel habit") }
        if any(["dysphagia", "difficulty swallowing", "food sticking", "odynophagia"]) { add("associations", "Dysphagia") }
        if any(["heartburn", "acid reflux", "gord", "gerd", "regurgitation"]) { add("associations", "Heartburn") }
        if any(["haematuria", "hematuria", "blood in urine", "red urine", "frank haematuria"]) { add("associations", "Haematuria") }
        if any(["dysuria", "burning urination", "stinging urination", "pain on urination"]) { add("associations", "Dysuria") }

        // MARK: Timing
        if any(["constant", "continuous", "unremitting", "persistent"]) { add("timing", "Constant") }
        if any(["intermittent", "comes and goes", "episodic", "on and off"]) { add("timing", "Intermittent") }
        if any(["progressive", "worsening", "getting worse", "escalating"]) { add("timing", "Progressive") }
        if any(["after eating", "post-prandial", "postprandial", "after meals", "after food"]) { add("timing", "Post-prandial") }
        if any(["nocturnal", "wakes at night", "night pain", "overnight"]) { add("timing", "Nocturnal") }
        if any(["sudden onset", "sudden", "instantaneous", "thunderclap"]) { add("onset", "Sudden") }

        // MARK: Exacerbating
        if any(["worse on movement", "movement aggravates", "aggravated by movement", "movement makes"]) { add("exacerbating", "Movement") }
        if any(["after eating worsens", "eating worsens", "worse after food"]) { add("exacerbating", "Eating") }
        if any(["fatty food", "fatty meal", "fried food", "greasy food"]) { add("exacerbating", "Fatty food") }
        if any(["lying flat", "lying down", "supine", "worse lying"]) { add("exacerbating", "Lying flat") }
        if any(["deep breath", "inspiration", "pleuritic", "breathing worsens"]) { add("exacerbating", "Deep breathing") }
        if any(["cough", "coughing", "worse on cough"]) { add("exacerbating", "Coughing") }
        if any(["straining", "valsalva", "straining worsens"]) { add("exacerbating", "Straining") }
        if any(["alcohol", "alcohol worsens", "after drinking"]) { add("exacerbating", "Alcohol") }
        if any(["nsaid", "ibuprofen worsens", "aspirin worsens"]) { add("exacerbating", "NSAIDs") }

        // MARK: Relieving
        if any(["antacid", "gaviscon", "omeprazole relieves", "ppi relieves"]) { add("relieving", "Antacids") }
        if any(["sitting forward", "leaning forward", "forward lean"]) { add("relieving", "Sitting forward") }
        if any(["opening bowels", "defaecation", "defecation", "after bowel movement"]) { add("relieving", "Defaecation") }
        if any(["vomiting relieves", "better after vomiting"]) { add("relieving", "Vomiting") }
        if any(["nothing relieves", "nothing makes it better", "no relief"]) { add("relieving", "Nothing") }
        if any(["rest", "resting", "bed rest", "better with rest"]) { add("relieving", "Rest") }

        // MARK: Severity (numeric pain scores in text)
        let severityPhrases = ["1/10", "2/10", "3/10"]
        let moderatePhrases = ["4/10", "5/10", "6/10"]
        let severePhrases   = ["7/10", "8/10", "9/10"]
        if any(severityPhrases) || has("mild") { add("severity", "Mild (1–3/10)") }
        if any(moderatePhrases) || has("moderate") { add("severity", "Moderate (4–6/10)") }
        if any(severePhrases) || (has("severe") && !has("severe vomiting")) { add("severity", "Severe (7–9/10)") }
        if any(["10/10", "excruciating", "worst pain", "worst ever"]) { add("severity", "Worst (10/10)") }

        // MARK: Exam → "exam" feature bucket (fed as examAbdo/examGeneral to engine)
        if any(["guarding", "muscle guarding", "voluntary guarding", "involuntary guarding"]) { add("exam", "Guarding") }
        if any(["rebound", "rebound tenderness", "release pain"]) { add("exam", "Rebound") }
        if any(["peritonism", "peritoneal", "board-like", "rigid abdomen", "board like rigidity", "involuntary guarding"]) { add("exam", "Peritonism") }
        if has("murphy") { add("exam", "Murphy's sign") }
        if has("rovsing") { add("exam", "Rovsing's sign") }
        if has("psoas sign") { add("exam", "Psoas sign") }
        if has("obturator sign") { add("exam", "Obturator sign") }
        if any(["tinkling", "hyperactive bowel", "high-pitched bowel"]) { add("exam", "Tinkling bowel sounds") }
        if any(["absent bowel", "silent abdomen", "no bowel sounds"]) { add("exam", "Absent bowel sounds") }
        if any(["shifting dullness", "fluid thrill", "ascites"]) { add("exam", "Ascites") }
        if any(["pulsatile mass", "expansile mass", "pulsatile abdominal"]) { add("exam", "Pulsatile mass") }
        if any(["pallor", "pale", "anaemic", "anemic", "conjunctival pallor", "palmar pallor"]) { add("exam", "Pallor") }
        if any(["tachycardia", "heart rate over 100", "pulse over 100", "rapid pulse", "fast heart"]) { add("exam", "Tachycardia") }
        if any(["hypotension", "low bp", "low blood pressure", "bp drop", "systolic below 90"]) { add("exam", "Hypotension") }
        if any(["crepitus", "subcutaneous gas", "surgical emphysema", "gas in tissue"]) { add("exam", "Crepitus") }
        if any(["cullen", "grey turner", "grey-turner", "bruising flanks", "periumbilical bruising"]) { add("exam", "Peritoneal haemorrhage signs") }
        if any(["mass", "lump", "swelling", "palpable mass", "palpable lump"]) { add("exam", "Mass/lump") }
        if any(["tenderness rlq", "tender rlq", "rlq tender", "mcburney point"]) { add("exam", "RLQ tenderness") }
        if any(["neck stiffness", "nuchal rigidity", "kernig", "brudzinski"]) { add("exam", "Meningism") }
        if any(["lymphadenopathy", "lymph node", "enlarged node", "palpable node"]) { add("exam", "Lymphadenopathy") }
        if any(["jaundice", "icteric", "scleral icterus"]) { add("exam", "Jaundice") }
        if any(["hepatomegaly", "enlarged liver", "palpable liver"]) { add("exam", "Hepatomegaly") }
        if any(["splenomegaly", "enlarged spleen", "palpable spleen"]) { add("exam", "Splenomegaly") }

        // MARK: Investigation results mentioned in text → "inv" bucket
        if any(["raised crp", "elevated crp", "crp elevated", "crp raised", "crp >", "crp:"]) { add("inv", "Raised CRP") }
        if any(["raised wbc", "raised white cell", "elevated wbc", "leukocytosis", "neutrophilia"]) { add("inv", "Leukocytosis") }
        if any(["raised bilirubin", "elevated bilirubin", "hyperbilirubinaemia"]) { add("inv", "Raised bilirubin") }
        if any(["raised amylase", "raised lipase", "elevated amylase", "elevated lipase"]) { add("inv", "Raised amylase/lipase") }
        if any(["dilated loop", "small bowel dilation", "air-fluid level", "air fluid level"]) { add("inv", "Bowel dilation on imaging") }
        if any(["gallstone", "cholelithiasis", "biliary calculi", "uss gallstone"]) { add("inv", "Gallstones on USS") }
        if any(["free air", "free gas", "pneumoperitoneum", "subdiaphragmatic air"]) { add("inv", "Pneumoperitoneum") }
        if any(["raised troponin", "troponin positive", "elevated troponin"]) { add("inv", "Positive troponin") }
        if any(["anaemia", "anemia", "low haemoglobin", "low hemoglobin", "hb low"]) { add("inv", "Anaemia") }

        // MARK: CC hint from clinical text
        var ccHint: String? = nil
        if ccHint == nil && any(["rlq", "mcburney", "appendicitis"]) { ccHint = "Abdominal pain" }
        if ccHint == nil && any(["chest pain", "angina", "troponin"]) { ccHint = "Chest pain" }
        if ccHint == nil && any(["dysphagia", "difficulty swallowing", "food sticking"]) { ccHint = "Dysphagia" }
        if ccHint == nil && any(["rectal bleed", "pr bleed", "bright red blood pr"]) { ccHint = "Rectal bleeding" }
        if ccHint == nil && any(["wound", "surgical site"]) && any(["infect", "discharge", "dehisc"]) { ccHint = "Wound / Post-op" }
        if ccHint == nil && has("hernia") { ccHint = "Hernia" }
        if ccHint == nil && any(["jaundice", "icteric"]) { ccHint = "Jaundice" }
        if ccHint == nil && any(["haematemesis", "hematemesis", "vomiting blood"]) { ccHint = "Nausea / Vomiting" }
        if ccHint == nil && any(["back pain", "loin pain", "renal colic", "ureteric"]) { ccHint = "Urinary symptoms" }
        if ccHint == nil && any(["shortness of breath", "dyspnoea", "dyspnea", "breathlessness"]) { ccHint = "Shortness of breath" }
        if ccHint == nil && any(["fever", "pyrexia", "febrile"]) { ccHint = "Fever / Infection" }

        // MARK: Clinical alarms — critical pattern detection
        // FAST stroke screen
        if any(["facial droop", "face droop", "facial weakness", "facial asymmetry"]) &&
           any(["arm weakness", "limb weakness", "hemiplegia", "hemiparesis", "arm drift"]) {
            alarms.append(ClinicalAlarm(
                title: "FAST Screen Positive",
                detail: "Facial droop + arm weakness detected — suspect acute stroke",
                severity: .emergency,
                systemImage: "brain.head.profile",
                action: "Urgent CT head + neurology review. Thrombolysis window: 4.5 h from onset."
            ))
        }

        // Thunderclap / worst headache
        if any(["thunderclap", "worst headache", "worst headache ever", "sudden severe headache", "instantaneous headache"]) {
            alarms.append(ClinicalAlarm(
                title: "Thunderclap Headache",
                detail: "Sudden severe headache — subarachnoid haemorrhage until proven otherwise",
                severity: .emergency,
                systemImage: "exclamationmark.circle.fill",
                action: "CT head (non-contrast). If negative + <6 h onset → LP. Neurosurgery referral."
            ))
        }

        // Sepsis criteria
        let hasFeverOrHypothermia = any(["fever", "pyrexia", "febrile", "temperature 38", "temperature 39", "hypothermia", "temperature 35"])
        let hasTachycardiaOrHypotension = any(["tachycardia", "hypotension", "bp drop", "septic", "shock"])
        let hasOrganDysfunction = any(["confusion", "altered gcs", "reduced consciousness", "oliguria", "elevated lactate", "raised lactate"])
        if hasFeverOrHypothermia && (hasTachycardiaOrHypotension || hasOrganDysfunction) {
            alarms.append(ClinicalAlarm(
                title: "Possible Sepsis",
                detail: "Systemic inflammatory response with potential infection source",
                severity: .critical,
                systemImage: "thermometer.medium",
                action: "Sepsis Six: O₂ · blood cultures × 2 · IV antibiotics · IV fluids · lactate · urine output. qSOFA score."
            ))
        }

        // Ruptured AAA
        if any(["pulsatile mass", "expansile mass", "pulsatile aorta", "aaa", "aortic aneurysm"]) &&
           any(["hypotension", "collapse", "shock", "severe back pain", "bp drop"]) {
            alarms.append(ClinicalAlarm(
                title: "Suspected Ruptured AAA",
                detail: "Pulsatile mass + haemodynamic compromise — catastrophic if missed",
                severity: .emergency,
                systemImage: "waveform.path.ecg",
                action: "Emergency vascular surgery. Group & cross-match × 6 u. Permissive hypotension (SBP 70–90). CT angiography only if haemodynamically stable."
            ))
        }

        // Necrotising fasciitis
        if any(["pain out of proportion", "disproportionate pain", "severe pain with minimal signs"]) &&
           any(["wound", "limb", "soft tissue", "leg", "arm", "perineum"]) &&
           any(["crepitus", "gas in tissue", "rapidly spreading", "spreading erythema", "septic", "haemodynamic"]) {
            alarms.append(ClinicalAlarm(
                title: "Suspect Necrotising Fasciitis",
                detail: "Pain disproportionate to signs + systemic sepsis = NF until proven otherwise",
                severity: .emergency,
                systemImage: "bandage.fill",
                action: "Emergency surgical debridement. Broad-spectrum IV antibiotics (piperacillin/tazobactam + clindamycin). No delay for imaging if diagnosis suspected."
            ))
        }

        // Acute limb ischaemia (6 Ps count)
        let sixPCount = [
            any(["pain", "painful leg", "painful limb"]),
            any(["pallor", "pale limb", "white leg"]),
            any(["pulseless", "absent pulse", "no pulse"]),
            any(["paraesthesia", "pins and needles", "numbness"]),
            any(["paralysis", "cannot move", "weakness", "powerless"]),
            any(["perishin", "cold limb", "cold leg", "cold foot", "ice cold"])
        ].filter { $0 }.count
        if sixPCount >= 4 && any(["limb", "leg", "foot", "arm", "hand"]) {
            alarms.append(ClinicalAlarm(
                title: "Acute Limb Ischaemia",
                detail: "\(sixPCount) of 6 Ps present — limb-threatening emergency",
                severity: .emergency,
                systemImage: "arrow.triangle.2.circlepath",
                action: "Emergency vascular surgery. IV unfractionated heparin (5000 u bolus). Revascularise within 6 h to preserve limb."
            ))
        }

        // Major upper GI bleed
        if any(["haematemesis", "hematemesis", "vomiting blood", "coffee ground vomit"]) &&
           any(["melaena", "melena", "hypotension", "shock", "haemodynamic", "collapse"]) {
            alarms.append(ClinicalAlarm(
                title: "Major Upper GI Haemorrhage",
                detail: "Haematemesis + haemodynamic compromise — high mortality without intervention",
                severity: .critical,
                systemImage: "drop.fill",
                action: "2 × large-bore IV access. Group & cross-match. Blatchford score. Urgent OGD (within 24 h). IV PPI + terlipressin if variceal suspected."
            ))
        }

        // Testicular torsion
        if any(["scrotal pain", "testicular pain", "testis pain"]) &&
           any(["sudden", "acute", "rapid onset", "immediate"]) {
            alarms.append(ClinicalAlarm(
                title: "Exclude Testicular Torsion",
                detail: "Acute scrotal pain — irreversible ischaemia if missed beyond 6 h",
                severity: .emergency,
                systemImage: "exclamationmark.triangle.fill",
                action: "Doppler USS KUB. If unavailable or high clinical suspicion → immediate surgical exploration. Do not delay for imaging."
            ))
        }

        // Meningism with fever
        if any(["neck stiffness", "nuchal rigidity", "kernig", "brudzinski"]) &&
           any(["fever", "pyrexia", "photophobia", "petechiae", "purpura", "rash"]) {
            alarms.append(ClinicalAlarm(
                title: "Meningitis / Meningococcaemia",
                detail: "Meningeal signs with fever — treat immediately, investigate after",
                severity: .emergency,
                systemImage: "cross.case.fill",
                action: "IV benzylpenicillin immediately (do not wait for LP). CT head → LP if safe. Dexamethasone if bacterial suspected. Notify public health."
            ))
        }

        // Bowel obstruction with peritonism (strangulation)
        if any(["obstruction", "obstructed", "bowel obstruct"]) &&
           any(["peritonism", "rebound", "guarding", "vascular compromise", "board-like"]) {
            alarms.append(ClinicalAlarm(
                title: "Bowel Obstruction + Peritonism",
                detail: "Peritoneal signs suggest strangulation — perforation risk is high",
                severity: .critical,
                systemImage: "exclamationmark.triangle",
                action: "Emergency surgical review. NBM + IV fluids + NG drainage. CT abdomen/pelvis. Prepare for operative intervention."
            ))
        }

        // Haemodynamic instability (generic)
        if any(["haemodynamic instability", "haemodynamically unstable", "hemodynamically unstable",
                "systolic 70", "systolic 60", "bp 70", "bp 60", "peri-arrest", "cardiac arrest"]) {
            alarms.append(ClinicalAlarm(
                title: "Haemodynamic Instability",
                detail: "Critically low blood pressure — immediate resuscitation required",
                severity: .emergency,
                systemImage: "waveform.path.ecg.rectangle.fill",
                action: "ABCDE approach. IV access × 2. Fluid challenge (250–500 mL crystalloid). Identify and treat cause. Consider vasopressors."
            ))
        }

        return ParseResult(
            featureAugments: features,
            clinicalAlarms: alarms,
            ccHint: ccHint
        )
    }
}
