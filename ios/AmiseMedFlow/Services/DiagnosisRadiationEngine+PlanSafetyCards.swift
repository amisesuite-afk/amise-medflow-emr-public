// DiagnosisRadiationEngine+PlanSafetyCards.swift
// Cards added by the iOS plan-safety programme (clinical validation 2026-09, owner-approved "fix
// all gaps"; docs/clinical-validation/changes/ios-plan-safety.md). They are checked FIRST
// (DiagnosisRadiationEngine.lookupOrder) because each one is more specific than a generic keyword
// elsewhere ("pre-operative assessment … AF on warfarin" used to reach the AF card, "adrenal
// incidentaloma … hypertension" the hypertension card, "perforated peptic ulcer" the elective
// peptic ulcer card). Wording follows the web protocol fixes (SURGEON-DECISIONS A/B; the web
// protocols in lib/pane-engine/src/management) where the same guideline applies.
// Doses appear only where the named guideline states them; under-16s never see them, and every
// card goes through the patient safety filter (PlanSafetyFilter) before it is shown.

import Foundation

extension DiagnosisRadiationEngine {

    fileprivate typealias SI = DiagnosisRadiation.SuggestedInvestigation

    fileprivate static func psCard(_ keywords: [String], _ name: String, icd: String, inv: [SI], plan: String,
                                   consent: String? = nil, urgency: String? = nil, redFlags: [String] = [],
                                   followUp: String, ref: String) -> Entry {
        Entry(keywords: keywords, radiation: .init(
            conditionName: name, icd10Primary: icd, investigations: inv, planTemplate: plan,
            billingCodes: [.init(icd10: icd, icdDescription: name, cpt: nil, cptDescription: nil)],
            consentCategory: consent, urgencyNote: urgency, redFlags: redFlags, followUp: followUp,
            guidelineReference: ref))
    }

    static let _planSafetyEntries: [Entry] = _planSafetyRetentionEntries + _planSafetyNSAPEntries + _planSafetyPeriopEntries + _planSafetyGIEntries + _planSafetyEndocrineBreastEntries
        + _planSafetyOtherEntries

    // MARK: - Peri-operative

    static let _planSafetyPeriopEntries: [Entry] = [

        psCard(["pre-operative assessment", "preoperative assessment", "pre-op assessment", "preop assessment"],
             "Pre-operative Assessment", icd: "Z01.818",
             inv: [SI(name: "FBC", category: .blood, rationale: "Anaemia before major surgery (NICE NG45)"),
                   SI(name: "U&E / creatinine / eGFR", category: .blood, rationale: "Renal function, potassium; drug dosing (NICE NG45)"),
                   SI(name: "HbA1c (known diabetes, if not done in the last 3 months)", category: .blood, rationale: "Glycaemic control (CPOC 2021)"),
                   SI(name: "Ferritin and transferrin saturation (iron studies) if anaemic or major surgery", category: .blood, rationale: "Treat iron deficiency before surgery"),
                   SI(name: "NT-proBNP / BNP and troponin if RCRI ≥ 1, age ≥ 65 or poor functional capacity before intermediate/high-risk surgery", category: .blood, rationale: "Cardiac risk stratification (ESC/ESAIC 2022; CCS 2017)"),
                   SI(name: "Transthoracic echocardiography only if a murmur, heart failure or unexplained breathlessness", category: .imaging, rationale: "ESC/ESAIC 2022"),
                   SI(name: "Group and save (major surgery)", category: .blood, rationale: "Transfusion readiness")],
             plan: """
- Pre-operative assessment (NICE NG45; CPOC 2021): tests by ASA grade and surgical grade — no routine tests for fit patients having minor/intermediate surgery
- Functional capacity: METs ≥ 4 (climbs two flights of stairs) or DASI; RCRI and ASA recorded
- 12-lead ECG if age ≥ 65, or cardiovascular, renal or diabetic disease, before intermediate or major surgery (NICE NG45)
- RCRI ≥ 1 or poor functional capacity: NT-proBNP / troponin; cardiology / anaesthetic review before listing if raised (ESC/ESAIC 2022)
- Electrolytes: if K⁺ ≥ 6.0 mmol/L defer elective surgery until corrected; on haemodialysis — dialysis the day before surgery and recheck K⁺
- Anaemia: treat iron deficiency (IV iron if surgery < 6 weeks away) before major elective surgery
- Medicines reconciliation: antithrombotics, diabetes medicines, steroids and hormonal drugs — see the patient-specific lines below
- Fasting: food up to 6 h and clear fluids up to 2 h before anaesthesia (AAGBI 2010; ESA 2011)
- Frailty, cognition and delirium risk recorded; shared decision-making and consent
""", consent: "Planned operation (see diagnosis)",
             followUp: "Pre-assessment outcome to the surgical and anaesthetic teams before listing.",
             ref: "NICE NG45 (2016) Routine preoperative tests; CPOC 2021; ESC/ESAIC 2022 non-cardiac surgery; AAGBI 2010 / ESA 2011 fasting"),

        psCard(["anastomotic leak"], "Suspected Anastomotic Leak", icd: "K91.89",
             inv: [SI(name: "CT abdomen/pelvis with IV contrast (± rectal contrast for a left-sided / rectal anastomosis)", category: .imaging, rationale: "Leak, collection, free gas"),
                   SI(name: "FBC, CRP, U&E, lactate, blood cultures", category: .blood, rationale: "Sepsis; CRP rising after day 3 is a warning sign"),
                   SI(name: "Group and save", category: .blood, rationale: "Possible return to theatre")],
             plan: """
- Low threshold: tachycardia, rising CRP, ileus or confusion after an anastomosis is a leak until proven otherwise
- Sepsis Six: IV antibiotics per local policy, IV fluids, oxygen, lactate, urine output
- NBM; senior surgical review now
- Contained collection: image-guided percutaneous drainage + antibiotics
- Generalised peritonitis or instability: return to theatre (washout ± defunctioning stoma / take-down of the anastomosis)
- Critical care (HDU/ICU) review if organ dysfunction
""", consent: "Return to theatre / relaparotomy", urgency: "Suspected anastomotic leak: senior surgical review and CT now.",
             redFlags: ["Peritonitis or shock → return to theatre"],
             followUp: "Stoma care and follow-up; contrast study before any stoma reversal.",
             ref: "ACPGBI / ESCP anastomotic leak guidance; NICE NG51 sepsis"),

        psCard(["femoral hernia"], "Femoral Hernia", icd: "K41.90",
             inv: [SI(name: "Groin ultrasound if the diagnosis is uncertain", category: .imaging, rationale: "Femoral vs inguinal vs lymph node"),
                   SI(name: "Obstruction / strangulation: FBC, U&E, lactate, group and save; CT only if it will not delay surgery", category: .blood, rationale: "Resuscitation and ischaemia")],
             plan: """
- Femoral hernia: prompt (early) repair recommended regardless of symptoms — high strangulation risk (HerniaSurge 2018)
- Elective: laparoscopic TEP/TAPP or open repair (low / Lockwood approach; McEvedy / high approach if bowel resection is likely)
- Strangulated / obstructed (tender irreducible lump, small bowel obstruction, Richter's): emergency surgery — emergency repair with inspection of bowel viability ± resection; do not attempt reduction if strangulation is suspected (WSES 2017)
- Obstruction from a hernia is not managed with a water-soluble contrast or conservative trial
""", consent: "Femoral hernia repair", urgency: "Irreducible / tender femoral hernia: same-day surgical review.",
             redFlags: ["Tender, irreducible or obstructed → emergency theatre"],
             followUp: "Wound review 2 weeks; return if pain, swelling or vomiting.",
             ref: "HerniaSurge 2018 International guidelines for groin hernia management; WSES 2017 emergency hernia repair"),

        psCard(["incisional hernia", "ventral hernia", "parastomal hernia"], "Incisional / Ventral Hernia", icd: "K43.9",
             inv: [SI(name: "CT abdomen (defect size, loss of domain) before repair of a large or complex hernia", category: .imaging, rationale: "EHS classification (W1–W3)"),
                   SI(name: "Pre-operative assessment bloods per NICE NG45", category: .blood, rationale: "Baseline")],
             plan: """
- Classify the defect (EHS: width W1 < 4 cm, W2 4–10 cm, W3 > 10 cm); optimise before elective repair — smoking cessation, weight (BMI < 35 where possible), diabetes control (EHS/AHS 2020)
- Elective mesh repair (open sublay or laparoscopic) for symptomatic hernias; watchful waiting is reasonable for small asymptomatic hernias
- Parastomal hernia: stoma nurse, support belt; repair (Sugarbaker / keyhole mesh) if symptomatic or obstructing
- Obstructed / strangulated: emergency surgery
""", consent: "Incisional hernia repair", redFlags: ["Tender, irreducible or obstructed → emergency theatre"],
             followUp: "Review 2 and 6 weeks after repair.",
             ref: "European / Americas Hernia Society ventral hernia guideline (2020); EHS parastomal hernia guideline (2018)"),

        psCard(["perforated peptic ulcer", "perforated duodenal ulcer", "perforated gastric ulcer", "perforated ulcer"],
             "Perforated Peptic Ulcer", icd: "K27.5",
             inv: [SI(name: "CT abdomen/pelvis with IV contrast (erect CXR if CT delayed)", category: .imaging, rationale: "Free gas, site, contamination"),
                   SI(name: "FBC, U&E, LFTs, lactate, blood cultures, group and save", category: .blood, rationale: "Sepsis; pre-operative"),
                   SI(name: "H. pylori testing (biopsy at surgery / serology)", category: .other, rationale: "Eradication after repair (WSES 2020)")],
             plan: """
- Sepsis Six within 1 hour: blood cultures, IV antibiotics per local policy, IV fluids, oxygen, lactate, urine output; NBM, NG tube, IV PPI
- Source control without delay: laparoscopic or open repair of the perforation with an omental (Graham) patch and peritoneal washout (WSES 2020)
- Septic shock / organ dysfunction: critical care (ICU/HDU) before and after surgery
- Non-operative management only for selected stable patients with a sealed perforation on CT (WSES 2020)
- H. pylori test and eradication; stop NSAIDs; repeat OGD at 6–8 weeks for a gastric ulcer
""", consent: "Laparoscopic / open repair of perforated ulcer", urgency: "Perforated peptic ulcer: emergency surgery after resuscitation.",
             redFlags: ["Septic shock → ICU and source control now"],
             followUp: "OGD 6–8 weeks (gastric ulcer); H. pylori eradication confirmed.",
             ref: "WSES 2020 guidelines for perforated and bleeding peptic ulcer; NICE NG51"),
    ]

    // Checked before the hernia card: "post-operative urinary retention after inguinal hernia repair".
    static let _planSafetyRetentionEntries: [Entry] = [
        psCard(["post-operative urinary retention", "postoperative urinary retention", "post-op urinary retention"],
             "Post-operative Urinary Retention", icd: "R33.8",
             inv: [SI(name: "Bladder scan (residual volume)", category: .imaging, rationale: "Confirm retention"),
                   SI(name: "U&E / creatinine", category: .blood, rationale: "Obstructive AKI"),
                   SI(name: "Urinalysis / urine culture (catheter specimen)", category: .other, rationale: "Infection")],
             plan: """
- Bladder scan; residual > 600 mL or symptomatic → urethral catheter (in-out or indwelling)
- Monitor for post-obstructive diuresis if the residual was large (hourly urine output; replace losses)
- Treat pain and constipation; review anticholinergic and opioid drugs
- Alpha-blocker (tamsulosin) before a trial without catheter (TWOC) in men (EAU)
""", followUp: "TWOC before discharge or within 1 week; urology if failed TWOC.",
             ref: "EAU non-neurogenic male LUTS guideline (2023); BAUS retention guidance"),
    ]

    // MARK: - Non-specific abdominal pain

    static let _planSafetyNSAPEntries: [Entry] = [
        psCard(["non-specific lower abdominal pain", "non-specific abdominal pain", "nonspecific abdominal pain"],
             "Non-specific Abdominal Pain", icd: "R10.30",
             inv: [SI(name: "Urinalysis (dipstick) ± urine culture", category: .other, rationale: "UTI / ureteric colic"),
                   SI(name: "Pregnancy test (urine or serum β-hCG) in women of reproductive age", category: .blood, rationale: "Ectopic pregnancy must be excluded (NICE NG126)"),
                   SI(name: "FBC, CRP", category: .blood, rationale: "Inflammation; AIR / Alvarado components")],
             plan: """
- Low probability of appendicitis (AIR ≤ 4, Alvarado ≤ 4): no operation; discharge with safety-net advice and review within 24–48 h, or observe if the diagnosis is uncertain (WSES 2020)
- Women of reproductive age: pregnancy test result before discharge or imaging; consider gynaecological causes (ovulation pain, ovarian cyst)
- Return urgently if the pain worsens, localises, or fever or vomiting develops
""", followUp: "Review within 24–48 h if symptoms persist.",
             ref: "WSES Jerusalem guidelines 2020 (appendicitis scores); NICE NG126 (2019, updated 2023)"),
    ]

    // MARK: - Upper GI, HPB, colorectal, anorectal

    static let _planSafetyGIEntries: [Entry] = [

        psCard(["pseudoachalasia", "achalasia"], "Achalasia / Pseudoachalasia", icd: "K22.0",
             inv: [SI(name: "OGD (upper GI endoscopy) with careful inspection and biopsy of the cardia", category: .endoscopy, rationale: "Exclude pseudoachalasia (cardia carcinoma) first — ESGE/ESNM 2020"),
                   SI(name: "Barium (contrast) swallow — timed", category: .imaging, rationale: "Bird's beak, emptying"),
                   SI(name: "High-resolution oesophageal manometry", category: .other, rationale: "Diagnosis and Chicago subtype"),
                   SI(name: "CT chest/abdomen (or EUS) if age > 55, short history or weight loss", category: .imaging, rationale: "Pseudoachalasia")],
             plan: """
- OGD first in every patient with dysphagia; older age, short history and rapid weight loss suggest pseudoachalasia — CT / EUS and biopsy (ESGE/ESNM 2020)
- Definitive treatment once pseudoachalasia is excluded: POEM, laparoscopic Heller myotomy with partial fundoplication or pneumatic dilatation, chosen by subtype and patient (ESGE/ESNM 2020; ACG 2020)
- Botulinum toxin only once malignancy is excluded and the patient is unfit for definitive treatment
- Nutritional assessment; soft diet
""", followUp: "Upper GI clinic with manometry and swallow results.",
             ref: "ESGE / ESNM achalasia guideline (2020); ACG clinical guideline achalasia (2020)"),

        psCard(["eosinophilic oesophagitis", "eosinophilic esophagitis"], "Eosinophilic Oesophagitis", icd: "K20.0",
             inv: [SI(name: "OGD with at least six oesophageal biopsies from two levels (proximal and distal)", category: .endoscopy, rationale: "≥ 15 eosinophils per high-power field (BSG 2022)"),
                   SI(name: "FBC (eosinophils), IgE / allergy history", category: .blood, rationale: "Atopy")],
             plan: """
- Diagnosis needs biopsies: at least six from two levels, off PPI where possible (BSG 2022)
- Treatment options: PPI (high dose 8 weeks), topical steroid (budesonide orodispersible or swallowed fluticasone) or an elimination diet with a dietitian (BSG 2022)
- Stricture: endoscopic dilatation after treatment starts
- Food bolus obstruction: emergency OGD (see food bolus pathway)
""", followUp: "Repeat OGD with biopsies after 8–12 weeks of treatment.",
             ref: "BSG guideline on eosinophilic oesophagitis (2022)"),

        psCard(["food bolus", "bolus obstruction"], "Oesophageal Food Bolus Obstruction", icd: "T18.1",
             inv: [SI(name: "Emergency OGD (flexible endoscopy)", category: .endoscopy, rationale: "Within 6 h if complete obstruction (unable to swallow saliva), otherwise within 24 h (ESGE 2016)"),
                   SI(name: "CT neck/chest only if perforation or a bone is suspected", category: .imaging, rationale: "ESGE 2016")],
             plan: """
- Complete obstruction (drooling, unable to swallow saliva): emergency OGD within 6 h — endoscopic bolus removal (push gently into the stomach or extract with a retrieval device) (ESGE 2016)
- Incomplete obstruction: OGD within 24 h
- Oesophageal biopsies at the index endoscopy to find the cause (eosinophilic oesophagitis, stricture, malignancy)
- NBM; IV fluids; no contrast studies before endoscopy
""", consent: "OGD — food bolus removal", urgency: "Complete oesophageal obstruction: emergency OGD within 6 h.",
             redFlags: ["Drooling / unable to swallow saliva → emergency OGD", "Chest pain, fever, surgical emphysema → perforation"],
             followUp: "Follow up biopsy results; treat the cause.",
             ref: "ESGE guideline on removal of foreign bodies in the upper GI tract (2016); BSG 2022 EoE"),

        psCard(["pharyngeal pouch", "zenker"], "Pharyngeal Pouch (Zenker's Diverticulum)", icd: "K22.5",
             inv: [SI(name: "Barium / contrast swallow (first-line)", category: .imaging, rationale: "Confirms pouch and size"),
                   SI(name: "Flexible nasendoscopy / OGD only with care (perforation risk)", category: .endoscopy, rationale: "Exclude malignancy")],
             plan: """
- Contrast swallow first; endoscopy with care
- Symptomatic pouch: endoscopic stapling (diverticulotomy) or open cricopharyngeal myotomy ± excision; flexible endoscopic options (Z-POEM) in experienced centres (NICE IPG22)
- Aspiration risk: dietetic and SALT review
""", redFlags: ["Progressive dysphagia, weight loss or aspiration pneumonia → urgent assessment"],
             followUp: "ENT / upper GI clinic.",
             ref: "NICE IPG22 (2003) Endoscopic stapling of pharyngeal pouch"),

        psCard(["gastric outlet obstruction", "pyloric obstruction"], "Gastric Outlet Obstruction", icd: "K31.1",
             inv: [SI(name: "OGD after gastric decompression (biopsy)", category: .endoscopy, rationale: "Peptic stricture vs malignancy"),
                   SI(name: "CT abdomen with IV contrast", category: .imaging, rationale: "Cause and staging"),
                   SI(name: "U&E, chloride, venous gas", category: .blood, rationale: "Hypochloraemic hypokalaemic metabolic alkalosis")],
             plan: """
- NG tube decompression; NBM
- IV 0.9% sodium chloride with potassium chloride (KCl) replacement to correct hypochloraemic hypokalaemic alkalosis
- IV PPI; nutritional support if prolonged
- Benign (peptic) stricture: endoscopic balloon dilatation + H. pylori eradication; malignant: MDT — stent or gastrojejunostomy
""", urgency: "Gastric outlet obstruction: admit, decompress and correct electrolytes.",
             followUp: "Upper GI MDT if malignant.",
             ref: "BSG / ASGE management of gastric outlet obstruction"),

        psCard(["progressive dysphagia", "peptic stricture", "oesophageal stricture", "dysphagia"], "Dysphagia — Urgent Endoscopy", icd: "R13.10",
             inv: [SI(name: "Urgent OGD (upper GI endoscopy) with biopsy — direct access, within 2 weeks", category: .endoscopy, rationale: "Dysphagia at any age (NICE NG12)"),
                   SI(name: "FBC", category: .blood, rationale: "Anaemia")],
             plan: """
- Dysphagia at any age: urgent direct-access OGD (2-week) — not age-gated (NICE NG12)
- Stricture: biopsy then dilatation; PPI for peptic stricture
- Weight loss / anaemia: upper GI cancer pathway
""", redFlags: ["Dysphagia at any age → urgent 2-week OGD (suspected cancer pathway)"],
             followUp: "Upper GI clinic with results.",
             ref: "NICE NG12 (2015, updated 2023) Suspected cancer: recognition and referral"),

        psCard(["gastric carcinoma", "gastric adenocarcinoma", "suspected gastric"], "Suspected Gastric Cancer", icd: "C16.9",
             inv: [SI(name: "Urgent OGD with biopsy (2-week pathway)", category: .endoscopy, rationale: "NICE NG12: upper abdominal pain with weight loss ≥ 55"),
                   SI(name: "FBC, U&E, LFTs", category: .blood, rationale: "Anaemia; baseline"),
                   SI(name: "CT chest/abdomen/pelvis for staging if cancer confirmed", category: .imaging, rationale: "Staging")],
             plan: """
- Urgent direct-access OGD (2-week wait) for age ≥ 55 with weight loss and upper abdominal pain, reflux or dyspepsia (NICE NG12)
- Confirmed cancer: staging CT ± staging laparoscopy / EUS; upper GI MDT; nutrition
""", redFlags: ["Age ≥ 55 with weight loss and upper abdominal pain → suspected cancer (2-week) pathway"],
             followUp: "Upper GI MDT.",
             ref: "NICE NG12 (2015, updated 2023); BSG/AUGIS gastric cancer guidance"),

        psCard(["pancreatic head", "pancreatic cancer", "pancreatic adenocarcinoma", "pancreatic carcinoma", "malignant biliary obstruction",
                "malignant distal biliary", "periampullary"], "Suspected Pancreatic / Periampullary Cancer", icd: "C25.0",
             inv: [SI(name: "Pancreas-protocol CT (multiphase contrast-enhanced CT of the pancreas) chest/abdomen/pelvis", category: .imaging, rationale: "Diagnosis, resectability, staging (NICE NG85)"),
                   SI(name: "CA 19-9 (after biliary decompression)", category: .blood, rationale: "Baseline tumour marker"),
                   SI(name: "LFTs, coagulation screen (INR) — vitamin K if prolonged", category: .blood, rationale: "Cholestatic coagulopathy"),
                   SI(name: "EUS with fine-needle biopsy (tissue) if tissue is needed", category: .endoscopy, rationale: "Histology before non-surgical treatment"),
                   SI(name: "HbA1c / glucose", category: .blood, rationale: "New-onset diabetes")],
             plan: """
- Refer to the specialist HPB MDT (pancreatic cancer multidisciplinary team) before any treatment decision (NICE NG85)
- Resectable with jaundice: surgery without routine pre-operative biliary drainage; drain (ERCP stent) only if cholangitis, surgery is delayed or neoadjuvant therapy is planned (NICE NG85)
- Pancreatic enzyme replacement, nutrition, diabetes management
- Unresectable: palliative biliary stenting, oncology and palliative care
""", followUp: "HPB MDT outcome; oncology.",
             ref: "NICE NG85 (2018) Pancreatic cancer in adults; ESMO 2023"),

        psCard(["toxic megacolon", "acute severe ulcerative colitis", "steroid-refractory", "fulminant colitis"],
             "Acute Severe Ulcerative Colitis / Toxic Megacolon", icd: "K51.90",
             inv: [SI(name: "Stool culture and C. difficile toxin", category: .other, rationale: "Exclude infection before escalation (BSG 2019)"),
                   SI(name: "CMV testing — colonic biopsy immunohistochemistry / PCR in steroid-refractory colitis", category: .pathology, rationale: "CMV colitis (ECCO 2021)"),
                   SI(name: "Unprepared flexible sigmoidoscopy with minimal insufflation and biopsy — colonoscopy contraindicated in acute severe colitis / toxic megacolon", category: .endoscopy, rationale: "Perforation risk (BSG 2019)"),
                   SI(name: "Plain abdominal X-ray daily (colonic diameter)", category: .imaging, rationale: "Toxic megacolon > 5.5–6 cm"),
                   SI(name: "FBC, CRP, U&E, albumin, magnesium", category: .blood, rationale: "Truelove & Witts; electrolytes")],
             plan: """
- Truelove & Witts: ≥ 6 bloody stools/day plus Hb < 10.5 g/dL, pulse > 90, temperature > 37.8 °C or ESR > 30 → admit (BSG 2019)
- IV hydrocortisone 100 mg QDS (or methylprednisolone 60 mg daily); VTE prophylaxis with LMWH (bleeding is not a contraindication); stop antimotility agents, opioids and anticholinergics; correct potassium and magnesium
- Joint medical–surgical review from admission; day-3 assessment (Oxford / Travis criteria) → rescue ciclosporin or infliximab, or colectomy
- Toxic megacolon, perforation or haemorrhage: emergency subtotal colectomy with end ileostomy
- C. difficile positive: oral vancomycin 125 mg QDS for 10 days (or fidaxomicin) (NICE NG199)
- CMV colitis in steroid-refractory disease: IV ganciclovir (antiviral) with gastroenterology (ECCO 2021)
""", consent: "Emergency subtotal colectomy", urgency: "Acute severe colitis: admit; joint medical–surgical care.",
             redFlags: ["Colonic dilatation > 5.5 cm, peritonism or shock → emergency colectomy"],
             followUp: "IBD team; colorectal surgical follow-up.",
             ref: "BSG IBD guideline (2019); ECCO UC guideline (2021/2022); NICE NG199 C. difficile (2021)"),

        psCard(["clostridioides difficile", "clostridium difficile", "c. difficile", "c difficile", "pseudomembranous"],
             "Clostridioides difficile Infection", icd: "A04.72",
             inv: [SI(name: "Stool C. difficile toxin (GDH + toxin)", category: .other, rationale: "Confirm"),
                   SI(name: "FBC (WCC), creatinine, lactate, albumin", category: .blood, rationale: "Severity (WCC > 15, creatinine rise)"),
                   SI(name: "CT abdomen if severe / fulminant (dilatation, perforation)", category: .imaging, rationale: "Complications")],
             plan: """
- Isolate; stop unnecessary antibiotics, PPIs and antimotility agents (NICE NG199)
- First episode: oral vancomycin 125 mg QDS for 10 days (first line) or fidaxomicin 200 mg BD for 10 days (NICE NG199)
- Life-threatening / fulminant: oral (or NG) vancomycin 500 mg QDS plus IV metronidazole 500 mg TDS; rectal vancomycin if ileus (IDSA/SHEA 2021); urgent surgical review — subtotal colectomy if perforation, toxic megacolon or deterioration
- Critical care review if shock or lactate > 5
""", urgency: "Severe C. difficile: specialist and surgical review.",
             redFlags: ["Ileus, toxic megacolon, shock → surgical review now"],
             followUp: "Recurrence advice; review antibiotic and PPI use.",
             ref: "NICE NG199 (2021) C. difficile infection: antimicrobial prescribing; IDSA/SHEA 2021 update"),

        psCard(["infective colitis", "bloody diarrhoea", "infectious colitis", "stec", "shiga"], "Acute Infective Colitis", icd: "A09",
             inv: [SI(name: "Stool culture / stool PCR including STEC (E. coli O157, Shiga toxin)", category: .other, rationale: "UKHSA STEC guidance"),
                   SI(name: "FBC, U&E, blood film (if STEC suspected)", category: .blood, rationale: "Haemolytic uraemic syndrome surveillance")],
             plan: """
- Oral / IV rehydration
- While STEC is possible: avoid empirical antibiotics (they may increase the risk of haemolytic uraemic syndrome) — IDSA 2017; UKHSA
- Antimotility agents (loperamide, codeine): avoid in bloody diarrhoea
- Notify public health (notifiable); hygiene and exclusion advice for food handlers
- Persistent symptoms: flexible sigmoidoscopy to exclude inflammatory bowel disease
""", followUp: "Stool results; review if symptoms persist beyond 7 days.",
             ref: "IDSA 2017 infectious diarrhoea guideline; UKHSA STEC guidance"),

        psCard(["lynch syndrome", "hereditary non-polyposis"], "Lynch Syndrome Surveillance", icd: "Z15.09",
             inv: [SI(name: "Surveillance colonoscopy (high-quality, chromoendoscopy where available)", category: .endoscopy, rationale: "BSG/ACPGBI/UKCGG 2019")],
             plan: """
- Colonoscopic surveillance every 2 years (MLH1 / MSH2 from age 25; MSH6 / PMS2 from 35) (BSG/ACPGBI/UKCGG 2019)
- Overdue surveillance: book colonoscopy now
- Aspirin: discuss daily aspirin for colorectal cancer prevention (NICE NG151; CAPP2)
- Gynaecological risk discussion for women (endometrial / ovarian); family cascade testing
""", redFlags: ["Lynch syndrome (hereditary colorectal cancer risk) — overdue surveillance needs booking now"],
             followUp: "Surveillance colonoscopy every 2 years.",
             ref: "BSG/ACPGBI/UKCGG hereditary CRC guideline (2019); NICE NG151 (2020)"),

        psCard(["fistula-in-ano", "fistula in ano", "anal fistula", "perianal fistula", "perianal crohn", "transsphincteric"],
             "Fistula-in-ano", icd: "K60.3",
             inv: [SI(name: "MRI pelvis (fistula protocol) — complex, recurrent or Crohn's fistula; endoanal ultrasound as an alternative", category: .imaging, rationale: "Anatomy, sphincter involvement, abscess (ASCRS 2022; ECCO 2022)"),
                   SI(name: "Examination under anaesthesia (EUA)", category: .other, rationale: "Define the tract; drain sepsis")],
             plan: """
- Drain any abscess first (EUA)
- Simple low (intersphincteric / low transsphincteric) fistula in a man without risk factors: fistulotomy (lay-open) (ASCRS 2022)
- Complex fistula (high transsphincteric, anterior in a woman, recurrent, Crohn's, incontinence): loose draining seton, then sphincter-sparing repair — advancement flap, LIFT (ligation of intersphincteric fistula tract) (ASCRS 2022)
- Perianal Crohn's: MRI, EUA + drainage + seton, then anti-TNF (infliximab / adalimumab) with gastroenterology (ECCO 2022)
""", consent: "EUA ± fistulotomy / seton", followUp: "Colorectal clinic 6 weeks; MRI review.",
             ref: "ASCRS clinical practice guideline anorectal abscess, fistula-in-ano (2022); ECCO Crohn's guideline (2022)"),

        psCard(["ischioanal abscess", "ischiorectal abscess", "perianal abscess", "perirectal abscess"], "Perianal / Ischioanal Abscess", icd: "K61.0",
             inv: [SI(name: "Capillary glucose / HbA1c", category: .blood, rationale: "Diabetes control"),
                   SI(name: "FBC, CRP, U&E; blood cultures if systemically unwell", category: .blood, rationale: "Sepsis"),
                   SI(name: "Pus for culture (microbiology) — immunosuppressed, recurrent or diabetic patients", category: .pathology, rationale: "Organism; enteric vs skin flora"),
                   SI(name: "MRI pelvis if recurrent, horseshoe or Crohn's suspected", category: .imaging, rationale: "Extent")],
             plan: """
- Prompt incision and drainage (EUA) — the definitive treatment (ASCRS 2022)
- Antibiotics are added only for cellulitis, systemic sepsis, diabetes, immunosuppression or prosthetic material (ASCRS 2022)
- Diabetes, spreading cellulitis or crepitus: examine for Fournier's gangrene — emergency debridement if present
- Glycaemic control; look for an underlying fistula
""", consent: "EUA and drainage of perianal abscess", urgency: "Perianal abscess: drainage on the next emergency list.",
             redFlags: ["Crepitus, necrosis or sepsis → necrotising infection (Fournier's) — emergency theatre"],
             followUp: "Wound care; review for fistula at 6 weeks.",
             ref: "ASCRS clinical practice guideline (2022)"),

        psCard(["anal squamous", "anal cancer", "anal carcinoma", "anal canal cancer"], "Suspected Anal Cancer", icd: "C21.0",
             inv: [SI(name: "Examination under anaesthesia (EUA) and biopsy of the anal lesion / margin", category: .pathology, rationale: "Histology"),
                   SI(name: "MRI pelvis", category: .imaging, rationale: "Local staging"),
                   SI(name: "CT chest/abdomen/pelvis (± PET-CT)", category: .imaging, rationale: "Nodal and distant staging"),
                   SI(name: "HIV test", category: .blood, rationale: "Risk factor; affects treatment"),
                   SI(name: "Inguinal node ultrasound ± FNA", category: .imaging, rationale: "Nodal staging")],
             plan: """
- Urgent colorectal / anal cancer MDT referral (2-week pathway)
- Treatment is chemoradiotherapy (Nigro regimen) with oncology — surgery is reserved for residual or recurrent disease (ACPGBI 2017; ESMO 2021)
- Cervical screening / HPV-related disease review
""", followUp: "Anal cancer MDT.",
             ref: "ACPGBI anal cancer position statement (2017); ESMO anal cancer guideline (2021)"),

        psCard(["rectal prolapse"], "Rectal Prolapse", icd: "K62.3",
             inv: [SI(name: "FBC, U&E, lactate (incarcerated)", category: .blood, rationale: "Ischaemia")],
             plan: """
- Incarcerated full-thickness prolapse: emergency assessment — reduction under sedation (sugar to reduce oedema) if the bowel is viable
- Strangulated / gangrenous or irreducible: emergency perineal rectosigmoidectomy (Altemeier procedure)
- Elective: laparoscopic ventral mesh rectopexy (fit) or perineal procedure (Delorme / Altemeier) in frail patients (ASCRS 2017)
""", consent: "Reduction / perineal rectosigmoidectomy", urgency: "Incarcerated rectal prolapse: emergency surgical review.",
             redFlags: ["Dusky / black prolapse → strangulation — emergency theatre"],
             followUp: "Colorectal clinic.",
             ref: "ASCRS clinical practice guideline rectal prolapse (2017)"),
    ]
}
