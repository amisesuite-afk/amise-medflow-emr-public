import Foundation

// MARK: - Clinical acuity engine: recognition rules and confirmed-diagnosis severity
//
// Recognition covers emergencies the text alarms did not: medical, obstetric, paediatric and
// neurological emergencies (recognise + standard first actions as suggestions + the 911 /
// emergency-department redirect), and surgical emergencies written in the history or examination.
// All matching is negation-aware (NegationMatcher). Sources are named next to each rule.

extension ClinicalAcuityEngine {

    static func recognise(_ b: AcuityBuilder) {
        let all = b.all
        let story = b.story
        let child = b.inputs.isChild
        let age = b.inputs.ageYears
        let sbp = b.inputs.vitals?.systolic
        let hr = b.inputs.vitals?.heartRate
        let preg = b.inputs.pregnancy

        // Anaphylaxis — Resus Council UK 2021: airway / breathing / circulation problem with
        // skin or mucosal features after a trigger. IM adrenaline first.
        let allergicFeatures = ["urticaria", "urticarial", "hives", "angioedema", "angio-oedema", "lip swelling",
                                "swollen lips", "tongue swelling", "swollen tongue", "swollen face", "facial swelling",
                                "face swelling", "itchy rash", "blotchy rash"]
        let abcProblem = ["wheeze", "wheezy", "stridor", "noisy breathing", "hoarse", "throat tight", "throat swelling",
                          "difficulty breathing", "hypotension", "collapse", "faint"]
        if b.cc.contains("anaphyla") || (all.containsAny(allergicFeatures) && (all.containsAny(abcProblem) || (sbp ?? 999) < 90)) {
            b.alert(.emergency, .medical, "Anaphylaxis suspected",
                    "Airway/breathing/circulation problem with skin or mucosal features after a trigger (Resus Council UK 2021).",
                    "IM adrenaline 1:1000 \(b.dose("0.5 mg (500 micrograms)")) anterolateral thigh, repeat after 5 minutes if no better; high-flow oxygen; lie flat (legs raised) unless breathing is worse; IV fluid bolus if shocked; remove the trigger.",
                    redirect: true)
        }

        // Acute coronary syndrome — NICE CG95 / NG185: chest pain → ECG within 10 minutes, troponin.
        let chestPain = story.containsAny(["chest pain", "chest tightness", "central chest", "chest heaviness", "crushing chest",
                                           "chest discomfort"])
        if chestPain {
            let highRisk = all.containsAny(["sweat", "diaphore", "clammy", "radiating to the left arm", "radiating to the arm",
                                            "radiating to the jaw", "to the jaw", "down the left arm", "crushing", "heavy"])
            if highRisk {
                b.alert(.emergency, .medical, "Possible acute coronary syndrome (ACS) — cardiac chest pain",
                        "Chest pain with autonomic or radiating features (NICE CG95).",
                        "12-lead ECG within 10 minutes; aspirin \(b.dose("300 mg")) unless contraindicated (NICE NG185); troponin.",
                        redirect: true)
            } else {
                b.alert(.urgent, .medical, "Chest pain — ECG within 10 minutes",
                        "Exclude an acute coronary syndrome, PE and aortic dissection (NICE CG95).",
                        "12-lead ECG within 10 minutes and troponin; if ongoing cardiac-sounding pain, treat as ACS.")
            }
        } else if story.containsAny(["epigastric", "upper abdominal", "indigestion"]),
                  all.containsAny(["sweat", "diaphore", "clammy", "breathless"]),
                  (b.pmh.containsAny(["diabet", "hypertension", "ischaemic heart", "angina", "smok"]) || (age ?? 0) >= 50) {
            b.alert(.urgent, .medical, "Possible cardiac cause (ACS) — epigastric pain with sweating",
                    "Inferior myocardial infarction can present as epigastric pain (NICE CG95).",
                    "12-lead ECG within 10 minutes and troponin before attributing the pain to the gut.")
        } else if story.containsAny(["jaw ache", "jaw pain", "ache in the jaw", "pain in the jaw", "arm ache"]),
                  story.containsAny(["walk", "exertion", "exercise", "stairs", "when she stops", "when he stops"])
                    || all.containsAny(["sweat", "clammy", "breathless"]) {
            // Anginal equivalents (older people, diabetes, women) — NICE CG95.
            b.alert(.urgent, .medical, "Possible acute coronary syndrome (ACS) — anginal equivalent",
                    "Exertional jaw or arm ache, breathlessness or sweating without chest pain (NICE CG95).",
                    "12-lead ECG within 10 minutes and troponin.")
        }

        // Aortic dissection — ESC 2014 aortic disease: tearing chest/back pain.
        if all.containsAny(["tearing", "ripping"]), all.containsAny(["chest", "back", "interscapular"]) {
            b.alert(.emergency, .medical, "Possible aortic dissection — tearing pain",
                    "Sudden tearing chest or back pain (ESC 2014).",
                    "BP in both arms; CT aortogram; no anticoagulation or thrombolysis until excluded.",
                    redirect: true)
        }

        // Stroke — NICE NG128: FAST positive (the text parser raises the FAST alarm); speech + weakness here.
        if all.containsAny(["slurred speech", "dysphasia", "aphasia", "word-finding", "facial droop", "facial weakness"]),
           all.containsAny(["weakness of the", "arm weakness", "leg weakness", "hemiparesis", "hemiplegia", "one-sided weakness",
                            "left-sided weakness", "right-sided weakness", "weak left", "weak right"]) {
            b.alert(.emergency, .medical, "Suspected stroke — FAST positive",
                    "Sudden focal neurological deficit (NICE NG128).",
                    "Check glucose; note the time last known well; immediate CT head at a stroke centre (thrombolysis/thrombectomy windows).",
                    redirect: true)
        }

        // Cauda equina — NICE CKS / GIRFT 2023: emergency MRI.
        if all.containsAny(["saddle anaesthesia", "saddle numbness", "saddle area", "perineal numbness", "cauda equina",
                            "numb when wiping", "bottom feels numb", "numbness around the anus"])
            || (all.containsAny(["back pain", "sciatica", "hurt her back", "hurt his back", "back injury", "lower back"])
                && all.containsAny(["urinary retention", "retention of urine", "incontinence", "reduced anal tone",
                                    "bladder dysfunction", "unable to pass urine", "cannot pass urine", "painless retention"])) {
            b.alert(.emergency, .medical, "Suspected cauda equina syndrome",
                    "Back pain with saddle sensory change or bladder/bowel dysfunction.",
                    "Emergency MRI of the lumbar spine and spinal surgical referral the same day; document perianal sensation, anal tone, post-void residual.",
                    redirect: true)
        }

        // Metastatic spinal cord compression — NICE NG234 (2023).
        let cancer = b.pmh.containsAny(["cancer", "carcinoma", "metasta", "myeloma", "malignan", "lymphoma"])
            || all.containsAny(["metasta", "myeloma"])
        if cancer, all.containsAny(["back pain", "spinal pain", "thoracic pain", "neck pain", "thoracic back"]) {
            if all.containsAny(["leg weakness", "weak legs", "weakness in the legs", "unsteady", "sensory level", "numb legs",
                                "difficulty walking", "cannot walk", "unable to walk", "legs giving way"]) {
                b.alert(.emergency, .medical, "Suspected metastatic spinal cord compression (MSCC)",
                        "Known cancer with spinal pain and neurological signs (NICE NG234).",
                        "MRI whole spine within 24 hours (immediately if neurological deficit); dexamethasone \(b.dose("16 mg")) (NICE NG234); acute oncology / spinal team.",
                        redirect: true)
            } else {
                b.alert(.urgent, .medical, "Possible spinal metastases — cancer with spinal pain",
                        "Spinal pain in known cancer (NICE NG234).",
                        "MRI whole spine within 1 week; safety-net for weakness, numbness or bladder symptoms.")
            }
        }

        // Testicular torsion — EAU 2024 paediatric urology / surgical practice: explore without delay.
        if b.inputs.sex != .female,
           all.containsAny(["testicular pain", "testis pain", "scrotal pain", "pain in the testicle", "testicle", "testicular swelling"]),
           all.containsAny(["sudden", "acute", "high-riding", "high riding", "absent cremasteric", "woke", "vomiting"]) {
            b.alert(.emergency, .surgical, "Possible testicular torsion",
                    "Acute scrotal pain — irreversible ischaemia within hours.",
                    "Immediate surgical exploration; do not delay for imaging.")
        }

        // Ectopic pregnancy — NICE NG126: pregnancy test in any woman of reproductive age with pain.
        if b.inputs.sex == .female, let a = age, (12...55).contains(a) {
            let pregnancyClue = all.containsAny(["positive pregnancy", "pregnancy test positive", "hcg positive", "positive hcg",
                                                 "missed period", "amenorrhoea", "late period", "since lmp", "weeks since last period"])
                || (preg.isPregnant && (preg.gestationWeeks ?? 99) < 14)
            let symptom = all.containsAny(["abdominal pain", "pelvic pain", "iliac fossa", "vaginal bleeding", "spotting", "collapse",
                                           "shoulder tip"])
            if pregnancyClue && symptom {
                let ruptured = (sbp ?? 999) < 100 || all.containsAny(["collapse", "peritonism", "guarding", "free fluid", "haemoperitoneum"])
                b.alert(ruptured ? Acuity.emergency : Acuity.urgent, .obstetric, "Possible ectopic pregnancy\(ruptured ? " — rupture / haemoperitoneum suspected" : "")",
                        "Early pregnancy with pain or bleeding (NICE NG126).",
                        ruptured ? "Emergency gynaecology: resuscitate, cross-match, theatre; surgery only when ruptured (no methotrexate)."
                                 : "Serum hCG and transvaginal ultrasound; early pregnancy assessment the same day.",
                        redirect: ruptured)
            }
        }

        // Eclampsia and pre-eclampsia symptoms — NICE NG133.
        if preg.isPregnant, all.containsAny(["seizure", "fit", "fitting", "convuls", "eclampsia"]) {
            b.alert(.emergency, .obstetric, "Eclampsia — seizure in pregnancy",
                    "Seizure in pregnancy is eclampsia until proven otherwise (NICE NG133).",
                    "Magnesium sulfate \(b.dose("4 g IV over 5–15 minutes, then 1 g/hour for 24 hours (Collaborative Eclampsia Trial regimen)")) (NICE NG133); left lateral position; obstetric emergency team.",
                    redirect: true)
        } else if preg.atOrBeyond20Weeks,
                  all.containsAny(["severe headache", "visual disturbance", "blurred vision", "flashing lights",
                                   "epigastric pain", "right upper quadrant pain", "ruq pain", "upper abdominal pain"]),
                  (b.inputs.vitals?.systolic ?? 0) >= 140 || (b.inputs.vitals?.diastolic ?? 0) >= 90
                    || all.containsAny(["proteinuria", "protein ++", "protein +++", "low platelets", "raised alt"]) {
            b.alert(.emergency, .obstetric, "Pre-eclampsia / HELLP suspected",
                    "Pregnancy ≥20 weeks with hypertension or proteinuria and headache, visual or upper abdominal symptoms (NICE NG133).",
                    "Same-day obstetric admission; FBC (platelets), LFT, creatinine, urine protein; fetal assessment.",
                    redirect: true)
        }
        if preg.isPregnant {
            b.alert(nil, .obstetric,
                    "Pregnant\(preg.gestationWeeks.map { " (\($0) weeks)" } ?? "") — obstetric handover",
                    "Pregnancy-aware plan: no NSAIDs from 20 weeks; LMWH, not DOACs or warfarin; avoid ionising imaging where an alternative exists (ultrasound / MRI).",
                    "Inform the obstetric team; document gestation and fetal assessment.")
        }

        // Airway compromise — stridor, expanding neck haematoma (e.g. after thyroidectomy: SCRAM).
        if all.containsAny(["stridor", "airway compromise", "airway obstruction", "expanding neck", "neck haematoma",
                            "tracheal compression", "tripod position", "drooling"]) {
            b.alert(.emergency, .surgical, "Airway compromise — stridor / neck haematoma",
                    "Threatened airway.",
                    "Call for senior anaesthetic and ENT/surgical help; sit up; high-flow oxygen; after thyroid surgery open the wound at the bedside (SCRAM: skin, cut, retractors, assess, mouth).",
                    redirect: !all.containsAny(["thyroidectomy", "neck surgery", "parathyroidectomy"]))
        }

        // Caustic ingestion.
        if all.containsAny(["caustic", "corrosive", "bleach", "drain cleaner", "alkali ingestion", "acid ingestion", "lye"]) {
            b.alert(.emergency, .medical, "Caustic ingestion — airway risk",
                    "Corrosive injury to the airway and oesophagus.",
                    "Airway assessment first; nil by mouth; no induced vomiting or neutralisation; CT chest/abdomen for perforation; endoscopy timing by the specialist.",
                    redirect: true)
        }

        // GI bleeding (BSG/ESGE 2021; ACG LGIB 2023).
        if all.containsAny(["melaena", "melena", "haematemesis", "hematemesis", "coffee-ground", "coffee ground", "vomiting blood",
                            "black stool", "black stools", "tarry stool", "black tarry", "fresh blood per rectum", "passing blood clots"]) {
            let unstable = (sbp ?? 999) < 100 || (hr ?? 0) > 100
            b.alert(unstable ? Acuity.emergency : Acuity.urgent, .surgical,
                    "GI bleed — haemorrhage\(unstable ? " with haemodynamic compromise (tachycardia/hypotension)" : "")",
                    "Gastrointestinal bleeding (melaena / haematemesis / rectal blood).",
                    "Two large-bore cannulae, FBC, group and cross-match; Glasgow-Blatchford (upper) or Oakland (lower) score; anticoagulant reversal decision; endoscopy timing by risk.")
        }

        // Strangulated / obstructed hernia — WSES 2017: emergency repair; no reduction if strangulation suspected.
        if all.containsAny(["irreducible", "strangulat", "incarcerat"]), all.containsAny(["hernia", "lump", "groin", "swelling"]) {
            b.alert(.emergency, .surgical, "Strangulated / obstructed (incarcerated) hernia",
                    "Irreducible, tender hernia.",
                    "Emergency surgical review and repair; do NOT attempt reduction when strangulation is suspected (WSES 2017).")
        }

        // Bowel obstruction.
        if (all.containsAny(["absolute constipation", "not passed flatus", "no flatus", "not passed wind", "not opened bowels",
                             "unable to pass wind"])
            && all.containsAny(["vomit", "distension", "distended"]))
            || all.containsAny(["small bowel obstruction", "large bowel obstruction", "bowel obstruction", "transition point",
                                "closed loop", "closed-loop"]) {
            b.alert(.urgent, .surgical, "Bowel obstruction suspected",
                    "Vomiting and distension with absolute constipation.",
                    "NBM, IV fluids, NG tube, CT abdomen/pelvis; look for a hernia and signs of strangulation (WSES 2018).")
        }

        // Acute mesenteric ischaemia — ESVS 2017: pain out of proportion + embolic source.
        if all.contains("out of proportion"),
           (all.containsAny(["atrial fibrillation", "irregularly irregular"]) || b.pmh.containsAny(["atrial fibrillation"])
            || b.pmh.contains("af", wholeWord: true) || all.contains("af", wholeWord: true)) {
            b.alert(.emergency, .surgical, "Possible acute mesenteric ischaemia",
                    "Pain out of proportion to the signs with an embolic source (ESVS 2017).",
                    "CT angiography now; heparin; vascular/general surgery; a normal lactate does not exclude it.")
        }

        // Toxic megacolon.
        if all.contains("megacolon") {
            b.alert(.emergency, .surgical, "Toxic megacolon",
                    "Colonic dilatation with systemic toxicity.",
                    "Surgical and gastroenterology review now; no colonoscopy; IV fluids, correct electrolytes; colectomy if no improvement.")
        }

        // Tension pneumothorax — ATLS 10.
        if all.contains("tension pneumothorax")
            || (all.containsAny(["tracheal deviation", "trachea deviated"])
                && all.containsAny(["absent breath sounds", "hyper-resonan", "hyperresonan", "reduced breath sounds"])) {
            b.alert(.emergency, .surgical, "Tension pneumothorax",
                    "Respiratory distress with tracheal deviation and absent breath sounds.",
                    child ? "Immediate needle decompression (paediatric landmarks per APLS/ATLS); chest drain."
                          : "Immediate decompression: adults 4th/5th intercostal space just anterior to the mid-axillary line (ATLS 10); chest drain.",
                    redirect: false)
        }

        // Burns — formal fluids from 15% TBSA in adults and 10% in children (practice default; the ≥ / >
        // choice and its source are logged for sign-off). High-voltage electrical injury: IV fluids
        // and a urine-output target regardless of visible TBSA (ABA; BBA).
        if let tbsa = burnTBSA(b) {
            let threshold = child ? 10.0 : 15.0
            if tbsa >= threshold {
                b.alert(.emergency, .surgical, "Major burn — \(fmt(tbsa))% TBSA",
                        "Above the formal fluid resuscitation threshold (\(child ? "≥10% child" : "≥15% adult")).",
                        "IV fluids (Parkland 4 mL/kg/%TBSA over 24 h from the time of burn, half in the first 8 h); urine output target \(child ? "1 mL/kg/h" : "0.5 mL/kg/h"); refer to a burns service; airway assessment.",
                        redirect: false)
            } else {
                b.raise(.urgent, "recognition", "Burn \(fmt(tbsa))% TBSA")
            }
        }
        if story.containsAny(["high voltage", "high-voltage", "electrical injury", "electrocution", "lightning", "electric shock"]) {
            b.alert(.emergency, .surgical, "Electrical injury",
                    "Deep tissue damage is not shown by the visible burn size.",
                    "IV fluids and a urine-output target regardless of visible TBSA (1–1.5 mL/kg/h if pigmented urine / myoglobinuria); 12-lead ECG and monitoring; CK; check compartments (ABA; BBA).")
        }

        // Children.
        if child, let a = age {
            if a < 1, all.containsAny(["bilious", "green vomit", "vomiting green", "green bile", "vomits green"]) {
                b.alert(.emergency, .paediatric, "Bilious vomiting in an infant",
                        "Malrotation with midgut volvulus until proven otherwise.",
                        "Nil by mouth; emergency paediatric surgical assessment; upper GI contrast study by the paediatric team.",
                        redirect: true)
            }
            if a < 3, all.containsAny(["redcurrant", "currant jelly", "drawing up", "episodes of screaming", "screaming in episodes",
                                       "inconsolable crying", "draws legs up"]) {
                b.alert(.emergency, .paediatric, "Intussusception suspected",
                        "Episodic inconsolable crying with drawing up of the legs, vomiting or blood in the stool.",
                        "Paediatric surgical assessment now; ultrasound; air-enema reduction by the paediatric team.",
                        redirect: true)
            }
            if a < 1, all.contains("projectile") {
                b.alert(.urgent, .paediatric, "Pyloric stenosis suspected",
                        "Projectile non-bilious vomiting in an infant.",
                        "Ultrasound; blood gas and electrolytes (hypochloraemic alkalosis); paediatric surgical referral.")
            }
            if all.containsAny(["non-accidental", "inconsistent history", "unexplained bruising", "bruising in a non-mobile",
                                "non-mobile", "immersion", "glove and stocking", "delay in presentation", "delayed presentation"]) {
                b.alert(.urgent, .safeguarding, "Safeguarding concern — child",
                        "Features that need child-protection assessment (NICE CG89).",
                        "Follow the practice safeguarding procedure and inform the safeguarding lead (local contacts to be supplied by the practice); skeletal survey under 2 years, CT head under 1 year, FBC and clotting (RCR/RCPCH).")
            }
        }
        // Domestic abuse — NICE PH50 (2014); NICE CG110 (pregnancy and complex social factors). Twin
        // of the web safeguardingFlags (lib/triage-engine/src/emergency-recognition.ts, RX.partnerViolence):
        // same pattern, title and action wording. It changes no level; the triage card lists it
        // as a red flag (AcuityAssessment.triageResult).
        if all.containsAny(["domestic violence", "domestic abuse", "partner assault", "hit by her partner", "hit by partner",
                            "assaulted by partner"])
            || partnerViolencePattern.map({ all.matches($0) }) == true {
            b.alert(nil, .safeguarding, "Domestic abuse disclosed\(preg.isPregnant ? " in pregnancy" : "")",
                    "Injury attributed to a partner / domestic abuse (NICE PH50 2014 domestic violence and abuse; NICE CG110 pregnancy and complex social factors)",
                    "Domestic abuse (safeguarding): follow the practice's safeguarding procedure — speak with the patient alone, assess immediate safety, document, and offer referral to specialist domestic-abuse support (NICE PH50); inform the safeguarding lead (local contacts to be supplied by the practice).")
        }

        // Head injury on an anticoagulant — NICE NG232 (wording "CT within 8 hours" logged for sign-off).
        if all.containsAny(["head injury", "hit his head", "hit her head", "hit their head", "struck the head", "fall onto the head"]),
           ["warfarin", "apixaban", "rivaroxaban", "edoxaban", "dabigatran", "clopidogrel", "ticagrelor"].contains(where: { b.medsLower.contains($0) }) {
            b.alert(.urgent, .surgical, "Head injury on an anticoagulant",
                    "Anticoagulated head injury (NICE NG232).",
                    "CT head within 8 hours of the injury; check INR / time of last dose; reversal decision if bleeding is found.")
        }

        // Head injury with reduced consciousness or neurological signs.
        if all.containsAny(["head injury", "hit his head", "hit her head"]),
           all.containsAny(["gcs 8", "gcs 9", "gcs 10", "gcs 11", "gcs 12", "unconscious", "vomited twice", "seizure"]) {
            b.raise(.emergency, "recognition", "Head injury with reduced consciousness, repeated vomiting or seizure (NICE NG232)")
        }

        // Stab / gunshot / evisceration.
        if story.containsAny(["stab wound", "stabbed", "gunshot", "shot in", "evisceration", "impalement"]) {
            b.raise(all.contains("evisceration") ? Acuity.emergency : Acuity.urgent, "recognition", "Penetrating injury")
        }
    }

    /// Injury attributed to a partner, or domestic / intimate-partner abuse named: the web
    /// RX.partnerViolence pattern (emergency-recognition.ts), matched negation-aware.
    static let partnerViolencePattern: NSRegularExpression? = try? NSRegularExpression(
        pattern: #"\b((pushed|hit|punched|kicked|slapped|strangled|assaulted|beaten|attacked|choked) by (her |his |my )?(partner|husband|boyfriend|ex|wife|girlfriend)|(partner|husband|boyfriend)\b[^.;\n]{0,15}\b(pushed|hit|punched|kicked|slapped|strangled|assaulted|beat|attacked|choked)|domestic (violence|abuse)|intimate partner (violence|abuse))\b"#,
        options: [.caseInsensitive])

    /// TBSA % written in the text or the confirmed diagnosis ("27% TBSA", "TBSA 14%").
    static func burnTBSA(_ b: AcuityBuilder) -> Double? {
        let text = (b.all.lower + " " + (b.inputs.workingDiagnosis ?? "").lowercased())
        let patterns = [#"(\d{1,3}(?:\.\d)?)\s*%\s*(?:tbsa|total body surface|body surface area|burn)"#,
                        #"tbsa\s*(?:of\s*)?(\d{1,3}(?:\.\d)?)\s*%"#]
        let ns = text as NSString
        for p in patterns {
            guard let re = try? NSRegularExpression(pattern: p, options: [.caseInsensitive]),
                  let m = re.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)),
                  let v = Double(ns.substring(with: m.range(at: 1))), v > 0, v <= 100 else { continue }
            return v
        }
        return nil
    }

    // MARK: Confirmed diagnosis severity

    /// Diagnoses that are not an acute presentation in themselves: a pre-operative assessment, an
    /// elective plan, screening, or a history entry.
    static let nonAcuteDiagnosisContext = [
        "pre-operative assessment", "preoperative assessment", "pre-operative planning", "elective", "screening",
        "surveillance", "history of", "previous", "incidental", "asymptomatic",
    ]

    /// Diagnosis → level. Most severe tier first; a term is matched on word starts (whole word
    /// under 5 characters). Practice triage mapping (listed under "Needs sign-off"): time-critical
    /// conditions are emergencies, conditions needing same-day surgical or medical care are urgent,
    /// suspected cancer and other expedited outpatient problems are priority (CLAUDE.md: red flags
    /// are not emergencies).
    static let diagnosisTiers: [(level: Acuity, terms: [String])] = [
        (.emergency, ["septic shock", "ruptured", "rupture", "perforat", "peritonitis", "strangulat", "mesenteric ischaem",
                      "mesenteric ischem", "bowel ischaem", "necrotising", "necrotizing", "fournier", "gangren",
                      "aortic dissection", "stemi", "myocardial infarction", "acute coronary", "pulmonary embol",
                      "tension pneumothorax", "ectopic", "torsion", "cauda equina", "cord compression", "subarachnoid",
                      "intracranial haemorrhage", "intracerebral haemorrhage", "stroke", "meningitis", "meningococcal",
                      "encephalitis", "ketoacidosis", "dka", "hyperosmolar", "anaphyla", "eclampsia", "hellp", "abruption",
                      "status epilepticus", "hyperkalaemia", "limb ischaemia", "volvulus", "intussusception", "malrotation",
                      "toxic megacolon", "variceal", "sepsis", "urosepsis", "neutropenic", "hypoglycaemia", "airway", "epiglottitis",
                      "caustic", "boerhaave", "hypertensive emergency", "heart block", "ventricular tachycardia",
                      "haemothorax", "splenic laceration", "splenic injury", "evisceration", "aortic aneurysm", "aaa",
                      "haemorrhagic shock", "thyroid storm", "adrenal crisis", "addisonian", "pulmonary oedema",
                      "life-threatening asthma", "acute severe asthma", "pre-eclampsia", "preeclampsia", "electrical injury",
                      "anuria", "bolus obstruction", "compartment syndrome", "major burn", "inhalation injury"]),
        (.urgent, ["cholangitis", "appendicitis", "cholecystitis", "pancreatitis", "diverticulitis", "obstruction", "obstructed",
                   "incarcerat", "abscess", "pyelonephritis", "pneumonia", "thrombosis", "dvt", "acute kidney injury", "aki",
                   "fast af", "rapid af", "uncontrolled af", "bleed", "haemorrhage", "haematemesis", "melaena", "cellulitis",
                   "hyponatraemia", "hypercalcaemia", "hypocalcaemia", "burn", "scald", "fracture", "head injury", "epididymo",
                   "retention", "renal colic", "ureteric", "colitis", "heart failure", "transient ischaemic", "tia",
                   "hyperglycaemi", "hyperemesis", "pyloric stenosis", "wound infection", "surgical site infection",
                   "anastomotic leak", "delirium", "dehydration", "mallory", "choledocholithiasis", "osteomyelitis",
                   "diabetic foot infection", "stab wound", "gunshot", "penetrating", "non-accidental", "safeguarding",
                   "acute hepatitis", "mesenteric", "jaundice", "pleural effusion", "empyema", "orchitis"]),
        (.priority, ["suspected", "carcinoma", "cancer", "malignan", "neoplasm", "tumour", "mass", "alarm feature", "anaemia",
                     "haematuria", "pharyngeal pouch", "dysphagia", "seizure", "tetanus-prone", "goitre", "compression",
                     "nipple discharge", "breast lump", "lump", "lymphoma", "melanoma", "polyp", "fit positive", "charcot",
                     "foot ulcer", "asthma"]),
    ]

    /// Words that keep a clause of the diagnosis acute when another clause is a history, a
    /// screening or an elective context.
    static let acuteDiagnosisMarkers = ["acute", "emergency", "urgent"]

    /// The part of the confirmed diagnosis that sets the level. The whole text when no non-acute
    /// context is written. Otherwise only the clauses (split at "—", "–", ";", ",", brackets) that
    /// say acute / emergency / urgent and carry no non-acute context, or nil when there are none:
    /// "Acute appendicitis — emergency laparoscopic appendicectomy; history of suxamethonium
    /// apnoea" is read as "Acute appendicitis — emergency laparoscopic appendicectomy" (urgent);
    /// "Recurrent diverticulitis — elective laparoscopic sigmoid colectomy" stays non-acute (nil).
    /// Before 1.1.0 any non-acute word anywhere (the "history of" a past anaesthetic problem)
    /// made the whole diagnosis non-acute.
    static func acuteDiagnosisText(_ dx: String) -> String? {
        let lower = dx.lowercased()
        guard nonAcuteDiagnosisContext.contains(where: { lower.contains($0) }) else { return dx }
        let clauses = dx.components(separatedBy: CharacterSet(charactersIn: "—–;,()"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let acute = clauses.filter { clause in
            let l = clause.lowercased()
            return !nonAcuteDiagnosisContext.contains(where: { l.contains($0) })
                && NegationMatcher.Source(clause).containsAny(acuteDiagnosisMarkers, wordStart: true)
        }
        return acute.isEmpty ? nil : acute.joined(separator: ". ")
    }

    static func diagnosisLevel(_ diagnosis: String?) -> (level: Acuity, term: String)? {
        guard let trimmed = diagnosis?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty,
              let dx = acuteDiagnosisText(trimmed) else { return nil }
        let source = NegationMatcher.Source(dx)
        // An obstructed / incarcerated / strangulated hernia is an emergency (WSES 2017).
        if source.contains("hernia"),
           source.containsAny(["obstruct", "incarcerat", "irreducible", "strangulat"]) {
            return (.emergency, "hernia with obstruction")
        }
        for tier in diagnosisTiers {
            for term in tier.terms where source.contains(term, wholeWord: term.count < 5, wordStart: true) {
                return (tier.level, term)
            }
        }
        return nil
    }

    static func diagnosisSeverity(_ b: AcuityBuilder) {
        guard let hit = diagnosisLevel(b.inputs.workingDiagnosis) else { return }
        b.raise(hit.level, "diagnosis", "Confirmed diagnosis: \(b.inputs.workingDiagnosis ?? "") (\(hit.term))")
    }

    // MARK: Suspected cancer (NICE NG12)

    /// The NG12 / BSG criteria behind the Diagnosis tab card (SuspectedCancerScreening.prompt:
    /// FIT ≥10 µg Hb/g, iron-deficiency anaemia, rectal bleeding ≥50, weight loss with abdominal
    /// pain ≥40, nipple change ≥50, visible haematuria ≥45) raise the level to priority: an
    /// expedited (2-week-wait or urgent) outpatient pathway, never an emergency (CLAUDE.md: red
    /// flags are not emergencies). The ferritin-check card changes nothing.
    static func suspectedCancer(_ b: AcuityBuilder) {
        guard let card = b.inputs.suspectedCancer, card.kind == .suspectedCancer else { return }
        b.raise(.priority, "suspected cancer", "\(card.title) — \(card.rationale)")
    }
}
