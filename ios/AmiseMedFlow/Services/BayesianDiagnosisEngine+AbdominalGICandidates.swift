// BayesianDiagnosisEngine+AbdominalGICandidates.swift
// GI / Abdominal Surgery differential candidate tables

extension BayesianDiagnosisEngine {

    // MARK: - Candidate tables

    // ── Abdominal pain ────────────────────────────────────────────────

    static let abdominalPain: [Candidate] = [
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

    static let jaundice: [Candidate] = [
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

    static let dysphagia: [Candidate] = [
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

    static let rectalBleeding: [Candidate] = [
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

    static let bowelHabit: [Candidate] = [
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

    static let hernia: [Candidate] = [
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

    static let perianal: [Candidate] = [
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

    static let weightLoss: [Candidate] = [
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

    static let groinPain: [Candidate] = [
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
