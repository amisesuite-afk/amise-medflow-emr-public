// BayesianDiagnosisEngine+AbdominalGICandidates2.swift
// GI / Abdominal Surgery differential candidate tables — part 2.



extension BayesianDiagnosisEngine {

    // MARK: - Small bowel obstruction / volvulus

    static let smallBowelObstruction: [Candidate] = [
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

    static let pilonidalDisease: [Candidate] = [
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

    // ── Rectal prolapse ───────────────────────────────────────────────

    static let rectalProlapse: [Candidate] = [
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

    // ── Reflux / Heartburn / Dyspepsia ───────────────────────────────
    // Pathognomonic features drive each candidate; CC = "Reflux / Heartburn"
    // maps here directly rather than falling to the generic abdominalPain list.

    static let refluxGERD: [Candidate] = [

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

    // MARK: – Nausea & Vomiting
    static let nauseaVomiting: [Candidate] = [
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
    static let upperGIBleed: [Candidate] = [
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

}
