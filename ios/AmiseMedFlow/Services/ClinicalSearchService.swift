import Foundation

// MARK: - ICD-10 Code

struct ICDCode: Identifiable, Equatable, Hashable {
    let id = UUID()
    let code: String
    let description: String
    let category: String

    static func search(_ query: String) -> [ICDCode] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        return allCodes.filter {
            $0.code.lowercased().hasPrefix(q) ||
            $0.description.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    // MARK: Surgical + GI ICD-10 — General & Endoscopic Surgery practice

    static let allCodes: [ICDCode] = [
        // Appendix
        .init(code: "K35.2", description: "Acute appendicitis with generalised peritonitis", category: "Appendix"),
        .init(code: "K35.3", description: "Acute appendicitis with localised peritonitis", category: "Appendix"),
        .init(code: "K36",   description: "Other appendicitis", category: "Appendix"),
        .init(code: "K37",   description: "Unspecified appendicitis", category: "Appendix"),

        // Biliary
        .init(code: "K80.00", description: "Gallstones with acute cholecystitis, without obstruction", category: "Biliary"),
        .init(code: "K80.10", description: "Gallstones with chronic cholecystitis, without obstruction", category: "Biliary"),
        .init(code: "K80.20", description: "Gallstones without cholecystitis, without obstruction", category: "Biliary"),
        .init(code: "K80.30", description: "Gallstones with acute cholangitis", category: "Biliary"),
        .init(code: "K80.50", description: "Gallstones with cholangitis, unspecified", category: "Biliary"),
        .init(code: "K80.60", description: "Gallstones with biliary obstruction", category: "Biliary"),
        .init(code: "K81.0",  description: "Acute cholecystitis", category: "Biliary"),
        .init(code: "K81.1",  description: "Chronic cholecystitis", category: "Biliary"),
        .init(code: "K83.0",  description: "Cholangitis", category: "Biliary"),
        .init(code: "K83.1",  description: "Obstruction of bile duct", category: "Biliary"),
        .init(code: "K87",    description: "Disorders of gallbladder, bile duct in other diseases", category: "Biliary"),

        // Hernia
        .init(code: "K40.30", description: "Unilateral inguinal hernia with obstruction, without gangrene", category: "Hernia"),
        .init(code: "K40.40", description: "Unilateral inguinal hernia with gangrene", category: "Hernia"),
        .init(code: "K40.90", description: "Unilateral inguinal hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K40.20", description: "Bilateral inguinal hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K41.90", description: "Unilateral femoral hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K42.0",  description: "Umbilical hernia with obstruction, without gangrene", category: "Hernia"),
        .init(code: "K42.9",  description: "Umbilical hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K43.0",  description: "Incisional hernia with obstruction, without gangrene", category: "Hernia"),
        .init(code: "K43.2",  description: "Incisional hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K44.9",  description: "Diaphragmatic (hiatus) hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K45.0",  description: "Other specified abdominal hernia with obstruction", category: "Hernia"),
        .init(code: "K46.9",  description: "Unspecified abdominal hernia without obstruction or gangrene", category: "Hernia"),

        // Colorectal
        .init(code: "K57.20", description: "Diverticulitis of large intestine with perforation/abscess, without bleeding", category: "Colorectal"),
        .init(code: "K57.30", description: "Diverticulosis of large intestine without perforation, without bleeding", category: "Colorectal"),
        .init(code: "K57.32", description: "Diverticulosis of large intestine without perforation, with bleeding", category: "Colorectal"),
        .init(code: "K56.0",  description: "Paralytic ileus", category: "Colorectal"),
        .init(code: "K56.2",  description: "Volvulus", category: "Colorectal"),
        .init(code: "K56.50", description: "Intestinal adhesions with partial obstruction", category: "Colorectal"),
        .init(code: "K56.60", description: "Unspecified intestinal obstruction, partial", category: "Colorectal"),
        .init(code: "K63.1",  description: "Perforation of intestine (nontraumatic)", category: "Colorectal"),
        .init(code: "K60.0",  description: "Acute anal fissure", category: "Colorectal"),
        .init(code: "K60.1",  description: "Chronic anal fissure", category: "Colorectal"),
        .init(code: "K60.3",  description: "Anal fistula", category: "Colorectal"),
        .init(code: "K61.0",  description: "Anal abscess", category: "Colorectal"),
        .init(code: "K61.1",  description: "Rectal abscess", category: "Colorectal"),
        .init(code: "K64.0",  description: "First degree haemorrhoids", category: "Colorectal"),
        .init(code: "K64.1",  description: "Second degree haemorrhoids", category: "Colorectal"),
        .init(code: "K64.2",  description: "Third degree haemorrhoids", category: "Colorectal"),
        .init(code: "K64.3",  description: "Fourth degree haemorrhoids", category: "Colorectal"),
        .init(code: "K92.0",  description: "Haematemesis", category: "Colorectal"),
        .init(code: "K92.1",  description: "Melaena", category: "Colorectal"),
        .init(code: "K92.2",  description: "Gastrointestinal haemorrhage, unspecified", category: "Colorectal"),

        // Colorectal Cancer
        .init(code: "C18.0",  description: "Malignant neoplasm of caecum", category: "Colorectal Cancer"),
        .init(code: "C18.2",  description: "Malignant neoplasm of ascending colon", category: "Colorectal Cancer"),
        .init(code: "C18.4",  description: "Malignant neoplasm of transverse colon", category: "Colorectal Cancer"),
        .init(code: "C18.6",  description: "Malignant neoplasm of descending colon", category: "Colorectal Cancer"),
        .init(code: "C18.7",  description: "Malignant neoplasm of sigmoid colon", category: "Colorectal Cancer"),
        .init(code: "C19",    description: "Malignant neoplasm of rectosigmoid junction", category: "Colorectal Cancer"),
        .init(code: "C20",    description: "Malignant neoplasm of rectum", category: "Colorectal Cancer"),
        .init(code: "C21.0",  description: "Malignant neoplasm of anus, unspecified", category: "Colorectal Cancer"),
        .init(code: "K63.5",  description: "Polyp of colon", category: "Colorectal Cancer"),

        // Upper GI
        .init(code: "K21.0",  description: "GORD with oesophagitis", category: "Upper GI"),
        .init(code: "K21.9",  description: "GORD without oesophagitis", category: "Upper GI"),
        .init(code: "K22.0",  description: "Achalasia of cardia", category: "Upper GI"),
        .init(code: "K22.1",  description: "Ulcer of oesophagus", category: "Upper GI"),
        .init(code: "K22.6",  description: "Mallory-Weiss syndrome", category: "Upper GI"),
        .init(code: "K25.0",  description: "Gastric ulcer, acute with haemorrhage", category: "Upper GI"),
        .init(code: "K25.4",  description: "Gastric ulcer, chronic with haemorrhage", category: "Upper GI"),
        .init(code: "K25.9",  description: "Gastric ulcer, unspecified", category: "Upper GI"),
        .init(code: "K26.0",  description: "Duodenal ulcer, acute with haemorrhage", category: "Upper GI"),
        .init(code: "K26.9",  description: "Duodenal ulcer, unspecified", category: "Upper GI"),
        .init(code: "K29.0",  description: "Acute haemorrhagic gastritis", category: "Upper GI"),
        .init(code: "K31.1",  description: "Adult hypertrophic pyloric stenosis", category: "Upper GI"),
        .init(code: "K31.5",  description: "Obstruction of duodenum", category: "Upper GI"),
        .init(code: "K31.7",  description: "Polyp of stomach and duodenum", category: "Upper GI"),
        .init(code: "C15.5",  description: "Malignant neoplasm of lower oesophagus", category: "Upper GI"),
        .init(code: "C16.0",  description: "Malignant neoplasm of cardia of stomach", category: "Upper GI"),
        .init(code: "C16.2",  description: "Malignant neoplasm of body of stomach", category: "Upper GI"),

        // Pancreas
        .init(code: "K85.10", description: "Biliary acute pancreatitis without necrosis or infection", category: "Pancreas"),
        .init(code: "K85.20", description: "Alcohol-induced acute pancreatitis without necrosis", category: "Pancreas"),
        .init(code: "K85.90", description: "Acute pancreatitis, unspecified", category: "Pancreas"),
        .init(code: "K86.1",  description: "Other chronic pancreatitis", category: "Pancreas"),
        .init(code: "C25.0",  description: "Malignant neoplasm of head of pancreas", category: "Pancreas"),
        .init(code: "C25.1",  description: "Malignant neoplasm of body of pancreas", category: "Pancreas"),

        // Liver
        .init(code: "K70.1",  description: "Alcoholic hepatitis", category: "Liver"),
        .init(code: "K74.60", description: "Unspecified cirrhosis of liver", category: "Liver"),
        .init(code: "K75.0",  description: "Abscess of liver", category: "Liver"),
        .init(code: "C22.0",  description: "Liver cell carcinoma", category: "Liver"),
        .init(code: "C78.7",  description: "Secondary malignant neoplasm of liver and intrahepatic bile duct", category: "Liver"),

        // Breast
        .init(code: "C50.919", description: "Malignant neoplasm of breast, unspecified, unspecified side", category: "Breast"),
        .init(code: "N60.01",  description: "Solitary cyst of right breast", category: "Breast"),
        .init(code: "N60.09",  description: "Solitary cyst of breast, unspecified", category: "Breast"),
        .init(code: "N61.0",   description: "Mastitis without abscess", category: "Breast"),
        .init(code: "N61.1",   description: "Abscess of the breast and nipple", category: "Breast"),
        .init(code: "N63.0",   description: "Unspecified lump in unspecified breast", category: "Breast"),

        // Thyroid / Parathyroid
        .init(code: "E04.0",  description: "Nontoxic diffuse goitre", category: "Thyroid"),
        .init(code: "E04.1",  description: "Nontoxic single thyroid nodule", category: "Thyroid"),
        .init(code: "E04.2",  description: "Nontoxic multinodular goitre", category: "Thyroid"),
        .init(code: "E05.00", description: "Thyrotoxicosis with diffuse goitre (Graves') without crisis", category: "Thyroid"),
        .init(code: "E06.1",  description: "Subacute thyroiditis", category: "Thyroid"),
        .init(code: "C73",    description: "Malignant neoplasm of thyroid gland", category: "Thyroid"),
        .init(code: "E21.0",  description: "Primary hyperparathyroidism", category: "Thyroid"),

        // Peritoneum
        .init(code: "K65.0",  description: "Generalised (acute) peritonitis", category: "Peritoneum"),
        .init(code: "K65.1",  description: "Peritoneal abscess", category: "Peritoneum"),
        .init(code: "K65.9",  description: "Peritonitis, unspecified", category: "Peritoneum"),

        // Skin / Soft Tissue
        .init(code: "L02.211", description: "Cutaneous abscess of abdominal wall", category: "Skin/Soft Tissue"),
        .init(code: "L02.31",  description: "Cutaneous abscess of buttock", category: "Skin/Soft Tissue"),
        .init(code: "L02.411", description: "Cutaneous abscess of right axilla", category: "Skin/Soft Tissue"),
        .init(code: "L03.011", description: "Cellulitis of right finger", category: "Skin/Soft Tissue"),
        .init(code: "L03.119", description: "Cellulitis of unspecified part of limb", category: "Skin/Soft Tissue"),
        .init(code: "L05.01",  description: "Pilonidal cyst with abscess", category: "Skin/Soft Tissue"),
        .init(code: "L05.91",  description: "Pilonidal cyst without abscess", category: "Skin/Soft Tissue"),

        // Trauma
        .init(code: "S36.00XA", description: "Unspecified injury of spleen, initial encounter", category: "Trauma"),
        .init(code: "S36.112A", description: "Minor laceration of liver, initial encounter", category: "Trauma"),
        .init(code: "S36.30XA", description: "Unspecified injury of stomach, initial encounter", category: "Trauma"),
        .init(code: "S36.400A", description: "Unspecified injury of duodenum, initial encounter", category: "Trauma"),

        // Post-op complications
        .init(code: "T81.30XA", description: "Disruption of wound, unspecified, initial encounter", category: "Post-op"),
        .init(code: "T81.40XA", description: "Infection following a procedure, initial encounter", category: "Post-op"),
        .init(code: "T81.500A", description: "Unspecified complication of foreign body, initial encounter", category: "Post-op"),
        .init(code: "K91.1",    description: "Postgastric surgery syndromes", category: "Post-op"),
        .init(code: "K91.89",   description: "Other postprocedural complications of digestive system", category: "Post-op"),
    ]
}

// MARK: - Surgical Formulary

struct SurgicalDrug: Identifiable, Equatable, Hashable {
    let id = UUID()
    let name: String
    let category: String
    let commonDoses: String
    let route: String
    let notes: String
    var sideEffects: String = ""

    static func search(_ query: String) -> [SurgicalDrug] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        return allDrugs.filter {
            $0.name.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    static let allDrugs: [SurgicalDrug] = [

        // ─── ANALGESICS — Opioids ────────────────────────────────────────────
        .init(name: "Morphine",       category: "Opioid Analgesic",  commonDoses: "2.5–10 mg",  route: "IV/SC/PO",  notes: "Titrate to pain; caution in renal impairment", sideEffects: "Nausea, constipation, respiratory depression, sedation, pruritus"),
        .init(name: "Fentanyl",       category: "Opioid Analgesic",  commonDoses: "25–100 mcg", route: "IV/transdermal", notes: "Rapid onset; preferred in renal failure", sideEffects: "Respiratory depression, sedation, nausea, pruritus, chest wall rigidity (rapid IV)"),
        .init(name: "Oxycodone",      category: "Opioid Analgesic",  commonDoses: "5–10 mg",    route: "PO",        notes: "IR q4-6h or SR q12h", sideEffects: "Constipation, nausea, sedation, dizziness, urinary retention"),
        .init(name: "Tramadol",       category: "Opioid Analgesic",  commonDoses: "50–100 mg",  route: "PO/IV",     notes: "Avoid with SSRIs/SNRIs (serotonin syndrome)", sideEffects: "Nausea, dizziness, serotonin syndrome risk, seizures, constipation"),
        .init(name: "Codeine",        category: "Opioid Analgesic",  commonDoses: "30–60 mg",   route: "PO",        notes: "Prodrug — variable CYP2D6 metabolism", sideEffects: "Constipation, nausea, sedation; variable efficacy due to CYP2D6 polymorphism"),
        .init(name: "Pethidine",      category: "Opioid Analgesic",  commonDoses: "25–50 mg",   route: "IV/IM",     notes: "Avoid in renal failure (norpethidine accumulation)", sideEffects: "Norpethidine accumulation (seizures in renal failure), nausea, respiratory depression"),
        .init(name: "Buprenorphine",  category: "Opioid Analgesic",  commonDoses: "5–20 mcg/h patch; 0.3 mg SL", route: "Transdermal/SL/IV", notes: "Partial agonist; ceiling effect; useful in opioid-tolerant patients", sideEffects: "Nausea, dizziness, constipation, skin reactions (patch), headache"),

        // ─── ANALGESICS — Non-opioid ─────────────────────────────────────────
        .init(name: "Paracetamol",    category: "Non-opioid Analgesic", commonDoses: "500–1000 mg q4-6h", route: "PO/IV/PR", notes: "Max 4 g/day; reduce in hepatic impairment", sideEffects: "Hepatotoxicity in overdose; safe and well tolerated at therapeutic doses"),
        .init(name: "Ibuprofen",      category: "NSAID",               commonDoses: "400–800 mg TDS",    route: "PO",       notes: "Avoid post-op GI bleed, renal failure", sideEffects: "GI irritation/ulceration, renal impairment, fluid retention, hypertension"),
        .init(name: "Diclofenac",     category: "NSAID",               commonDoses: "50–75 mg",          route: "PO/PR/IM", notes: "Avoid in renal failure; 75 mg IM once", sideEffects: "GI irritation, renal impairment, elevated LFTs, cardiovascular risk"),
        .init(name: "Ketorolac",      category: "NSAID",               commonDoses: "15–30 mg",          route: "IV/IM",    notes: "Max 5 days; avoid in renal impairment", sideEffects: "GI bleeding risk, renal impairment, platelet inhibition"),
        .init(name: "Celecoxib",      category: "COX-2 Inhibitor",     commonDoses: "100–200 mg BD",     route: "PO",       notes: "Preferred NSAID post cardiac/bowel surgery", sideEffects: "GI irritation (less than non-selective NSAIDs), cardiovascular risk, fluid retention"),
        .init(name: "Gabapentin",     category: "Neuropathic Analgesic", commonDoses: "100–300 mg TDS",  route: "PO",       notes: "Peri-op opioid-sparing; neuropathic pain; dose-titrate", sideEffects: "Dizziness, somnolence, peripheral oedema, weight gain, ataxia"),
        .init(name: "Pregabalin",     category: "Neuropathic Analgesic", commonDoses: "75–150 mg BD",    route: "PO",       notes: "Neuropathic pain; anxiety; peri-op opioid-sparing", sideEffects: "Dizziness, somnolence, weight gain, peripheral oedema, dependence potential"),
        .init(name: "Amitriptyline",  category: "Neuropathic Analgesic", commonDoses: "10–75 mg nocte",  route: "PO",       notes: "Neuropathic pain (low 10–25 mg); depression (full dose); sleep", sideEffects: "Sedation, dry mouth, constipation, urinary retention, QT prolongation, orthostatic hypotension"),

        // ─── ANTIBIOTICS ─────────────────────────────────────────────────────
        .init(name: "Cefazolin",      category: "Antibiotic — Prophylaxis", commonDoses: "1–2 g",       route: "IV",    notes: "First-line surgical prophylaxis; repeat if >3h surgery", sideEffects: "Rash, diarrhoea, rare anaphylaxis"),
        .init(name: "Cefuroxime",     category: "Antibiotic — Prophylaxis", commonDoses: "1.5 g",       route: "IV",    notes: "Colorectal prophylaxis (with metronidazole)", sideEffects: "Rash, diarrhoea, rare anaphylaxis"),
        .init(name: "Cefalexin",      category: "Antibiotic",               commonDoses: "500 mg QDS",  route: "PO",    notes: "Skin/soft tissue infections; UTI", sideEffects: "Diarrhoea, nausea, rash; ~1% cross-reactivity with penicillin"),
        .init(name: "Metronidazole",  category: "Antibiotic",               commonDoses: "500 mg TDS",  route: "IV/PO", notes: "Anaerobic cover; avoid alcohol; ↑ warfarin INR", sideEffects: "Metallic taste, nausea, disulfiram-like reaction with alcohol, peripheral neuropathy (prolonged)"),
        .init(name: "Amoxicillin",    category: "Antibiotic — Penicillin",  commonDoses: "500 mg TDS",  route: "PO/IV", notes: "Common outpatient antibiotic; broad coverage", sideEffects: "Diarrhoea, maculopapular rash (in EBV), urticaria, rare anaphylaxis"),
        .init(name: "Co-amoxiclav",   category: "Antibiotic",               commonDoses: "1.2 g TDS",   route: "IV",    notes: "Broad spectrum; biliary/abdominal sepsis; skin/soft tissue", sideEffects: "Diarrhoea, cholestatic jaundice, rash, nausea; avoid if previous co-amoxiclav hepatotoxicity"),
        .init(name: "Piperacillin/tazobactam", category: "Antibiotic",     commonDoses: "4.5 g QDS",   route: "IV",    notes: "Broad-spectrum; complicated intra-abdominal infections", sideEffects: "Diarrhoea, hypokalaemia, rash, elevated LFTs, neurotoxicity (renal failure/high doses)"),
        .init(name: "Ciprofloxacin",  category: "Antibiotic",               commonDoses: "400 mg BD",   route: "IV",    notes: "Gram-negative cover; ↑ warfarin INR; avoid with macrolides/steroids", sideEffects: "Tendonitis/tendon rupture, QT prolongation, GI upset, photosensitivity, CNS effects (dizziness, confusion)"),
        .init(name: "Gentamicin",     category: "Antibiotic — Aminoglycoside", commonDoses: "3–5 mg/kg OD", route: "IV", notes: "Gram-negative sepsis; monitor levels; nephrotoxic/ototoxic", sideEffects: "Nephrotoxicity, irreversible ototoxicity, vestibular toxicity; monitor levels closely"),
        .init(name: "Vancomycin",     category: "Antibiotic",               commonDoses: "15–20 mg/kg BD", route: "IV", notes: "MRSA; monitor troughs; infuse over ≥60 min", sideEffects: "Red man syndrome (rapid infusion), nephrotoxicity, ototoxicity, thrombophlebitis"),
        .init(name: "Meropenem",      category: "Antibiotic — Carbapenem",  commonDoses: "500 mg–1 g TDS", route: "IV", notes: "Reserve for resistant organisms/sepsis", sideEffects: "Diarrhoea, nausea, headache, seizures (high doses/renal failure), C. difficile"),
        .init(name: "Ertapenem",      category: "Antibiotic — Carbapenem",  commonDoses: "1 g OD",          route: "IV/IM", notes: "Community-acquired intra-abdominal infections", sideEffects: "Diarrhoea, nausea, headache, infusion-site reactions"),
        .init(name: "Fluconazole",    category: "Antifungal",               commonDoses: "200–400 mg OD",   route: "IV/PO", notes: "Candida; ↑ warfarin INR significantly; CYP2C9/3A4 inhibitor", sideEffects: "Nausea, headache, QT prolongation, hepatotoxicity; major drug interactions"),
        .init(name: "Azithromycin",   category: "Antibiotic — Macrolide",   commonDoses: "500 mg OD x3 or 250 mg OD x5", route: "PO/IV", notes: "Atypical cover; CAP; STIs; H. pylori second-line", sideEffects: "QT prolongation, GI upset, hepatotoxicity; cardiac risk with pre-existing heart disease"),
        .init(name: "Doxycycline",    category: "Antibiotic — Tetracycline", commonDoses: "100 mg BD",       route: "PO",    notes: "Atypical/intracellular organisms; malaria prophylaxis; MRSA SSTIs", sideEffects: "Photosensitivity, oesophageal ulceration (take with water upright), GI upset, teratogenic"),
        .init(name: "Trimethoprim",   category: "Antibiotic",               commonDoses: "200 mg BD",         route: "PO",    notes: "Uncomplicated UTI; 7 days", sideEffects: "Nausea, rash, hyperkalaemia, folate deficiency (prolonged use); avoid in first trimester"),
        .init(name: "Nitrofurantoin", category: "Antibiotic",               commonDoses: "100 mg BD (modified-release)", route: "PO", notes: "Lower UTI only; avoid eGFR <45 mL/min", sideEffects: "Nausea, pulmonary reactions (long-term use), peripheral neuropathy, hepatotoxicity"),
        .init(name: "Clindamycin",    category: "Antibiotic",               commonDoses: "300–450 mg QDS",   route: "PO/IV", notes: "Skin/soft tissue MRSA; anaerobes; dental prophylaxis", sideEffects: "C. difficile colitis (highest risk among antibiotics), diarrhoea, pseudomembranous colitis"),

        // ─── ANTICOAGULANTS ──────────────────────────────────────────────────
        .init(name: "Enoxaparin",     category: "LMWH",               commonDoses: "20–40 mg OD (prophylaxis); 1 mg/kg BD (treatment)", route: "SC", notes: "Adjust in renal failure; anti-Xa monitoring if BMI >35 or eGFR <30", sideEffects: "Bleeding, HIT (lower risk than UFH), injection-site bruising"),
        .init(name: "Heparin (unfractionated)", category: "Anticoagulant", commonDoses: "5000 units TDS (prophylaxis)", route: "SC/IV", notes: "Monitor APTT for treatment; reversible with protamine", sideEffects: "Bleeding, HIT Type II (thrombocytopenia + thrombosis), osteoporosis (long-term)"),
        .init(name: "Warfarin",       category: "Anticoagulant",      commonDoses: "Dose by INR",             route: "PO",  notes: "Multiple interactions; monitor INR; reverse with Vit K or FFP", sideEffects: "Bleeding, skin necrosis (early initiation), teratogenic; extensive drug and food interactions"),
        .init(name: "Rivaroxaban",    category: "DOAC",               commonDoses: "10 mg OD (VTE prophylaxis); 15–20 mg OD (AF/treatment)", route: "PO", notes: "Omit 24–48h before surgery; reverse with andexanet alfa", sideEffects: "Bleeding, nausea, elevated LFTs; limited reversal options"),
        .init(name: "Apixaban",       category: "DOAC",               commonDoses: "2.5–5 mg BD",             route: "PO",  notes: "Omit 24–48h before surgery; fewer GI bleeds than rivaroxaban", sideEffects: "Bleeding, nausea; lower GI bleed risk than rivaroxaban or dabigatran"),
        .init(name: "Dabigatran",     category: "DOAC",               commonDoses: "110–150 mg BD",           route: "PO",  notes: "Reverse with idarucizumab; higher GI bleed risk", sideEffects: "GI bleeding, dyspepsia, oesophagitis; higher GI bleed rate than VKA"),
        .init(name: "Fondaparinux",   category: "Anticoagulant",      commonDoses: "2.5 mg OD (prophylaxis); 5–10 mg OD (treatment)", route: "SC", notes: "No HIT risk; avoid eGFR <20 mL/min; no antidote", sideEffects: "Bleeding; no reversal agent; accumulates in renal failure"),

        // ─── ANTICOAGULANT REVERSAL ───────────────────────────────────────────
        .init(name: "Vitamin K",      category: "Anticoagulant Reversal", commonDoses: "1–10 mg",           route: "IV/PO", notes: "Reverses warfarin; IV onset 4–6h; flush IV slowly over 20 min", sideEffects: "Anaphylaxis (IV — rare), prolonged warfarin resistance after large doses"),
        .init(name: "Protamine",      category: "Anticoagulant Reversal", commonDoses: "1 mg per 100 units heparin", route: "IV slow", notes: "Reverses UFH; partial LMWH reversal only", sideEffects: "Hypotension, bradycardia, anaphylaxis (fish allergy/protamine insulin risk), pulmonary hypertension"),
        .init(name: "Idarucizumab",   category: "Anticoagulant Reversal", commonDoses: "5 g IV",            route: "IV",    notes: "Specific reversal of dabigatran; approved for urgent surgery/bleeding", sideEffects: "Hypersensitivity reactions, headache, constipation; generally well-tolerated"),
        .init(name: "Tranexamic acid", category: "Antifibrinolytic",      commonDoses: "1 g IV then 1 g over 8h; 1 g TDS PO", route: "IV/PO", notes: "Trauma/major haemorrhage; give within 3h of injury for best effect", sideEffects: "Nausea, diarrhoea, visual disturbances; thromboembolic risk if given late post-injury"),

        // ─── GI / PPI / ANTIEMETICS ──────────────────────────────────────────
        .init(name: "Omeprazole",     category: "PPI",                commonDoses: "20–40 mg OD",  route: "PO/IV",  notes: "GI protection with NSAIDs/steroids; UGIB", sideEffects: "Headache, diarrhoea, nausea, hypomagnesaemia (long-term), C. difficile risk, B12 deficiency (long-term)"),
        .init(name: "Pantoprazole",   category: "PPI",                commonDoses: "40–80 mg OD",  route: "PO/IV",  notes: "IV available; 80 mg bolus + infusion for UGIB", sideEffects: "Headache, diarrhoea, nausea, hypomagnesaemia (long-term), C. difficile risk"),
        .init(name: "Lansoprazole",   category: "PPI",                commonDoses: "15–30 mg OD",  route: "PO",     notes: "Standard PPI; 30 mg for H. pylori eradication", sideEffects: "Headache, diarrhoea, nausea, hypomagnesaemia (long-term)"),
        .init(name: "Ranitidine",     category: "H2 Antagonist",      commonDoses: "150 mg BD",    route: "PO/IV",  notes: "H2 blocker; less potent than PPI; stress ulcer prophylaxis IV", sideEffects: "Headache, dizziness, constipation; note previous market withdrawal (NDMA contamination)"),
        .init(name: "Ondansetron",    category: "Antiemetic",         commonDoses: "4–8 mg TDS",   route: "PO/IV",  notes: "Post-op nausea; QT prolongation risk", sideEffects: "Headache, constipation, QT prolongation; serotonin syndrome risk with SSRIs"),
        .init(name: "Metoclopramide", category: "Antiemetic / Prokinetic", commonDoses: "10 mg TDS", route: "PO/IV/IM", notes: "Prokinetic; max 5 days; extrapyramidal side effects", sideEffects: "Extrapyramidal reactions (esp. young women), tardive dyskinesia (long-term), sedation, QT prolongation"),
        .init(name: "Cyclizine",      category: "Antiemetic",         commonDoses: "50 mg TDS",    route: "PO/IV/IM", notes: "First-line post-op nausea; antihistamine mechanism", sideEffects: "Sedation, dry mouth, blurred vision, urinary retention"),
        .init(name: "Domperidone",    category: "Antiemetic / Prokinetic", commonDoses: "10 mg TDS before meals", route: "PO", notes: "Gastroparesis; nausea; max 1 week continuous use", sideEffects: "QT prolongation (avoid in cardiac disease), galactorrhoea, headache"),
        .init(name: "Prochlorperazine", category: "Antiemetic",       commonDoses: "5–10 mg TDS or 3 mg BD buccal", route: "PO/IM/buccal", notes: "Vertigo, labyrinthitis, nausea", sideEffects: "Extrapyramidal reactions, sedation, postural hypotension, tardive dyskinesia (long-term)"),
        .init(name: "Hyoscine butylbromide", category: "Antispasmodic", commonDoses: "20 mg QDS", route: "PO/IV/IM", notes: "Bowel colic/spasm; endoscopy prep (gut relaxation)", sideEffects: "Dry mouth, blurred vision, tachycardia, urinary retention; minimal CNS effects (does not cross BBB)"),
        .init(name: "Sucralfate",     category: "Mucosal Protectant",  commonDoses: "1 g QDS, 1h before meals", route: "PO", notes: "Stress ulcer prophylaxis; peptic ulcer; UGIB adjunct", sideEffects: "Constipation, dry mouth; binds other medications — space by 2 hours"),
        .init(name: "Loperamide",     category: "Antidiarrhoeal",      commonDoses: "2 mg after each loose stool; max 16 mg/day", route: "PO", notes: "Acute/chronic diarrhoea; high-output stoma management", sideEffects: "Constipation, abdominal cramps; avoid in infective diarrhoea with bloody stools/fever"),

        // ─── BOWEL PREP / LAXATIVES ──────────────────────────────────────────
        .init(name: "Polyethylene glycol (PEG)", category: "Bowel Prep", commonDoses: "2–4 L",    route: "PO",    notes: "Colonoscopy/bowel prep; day before procedure; split-dose preferred", sideEffects: "Bloating, nausea, cramping; electrolyte disturbance with large volumes"),
        .init(name: "Sodium picosulfate", category: "Bowel Prep",        commonDoses: "1 sachet × 2", route: "PO", notes: "Split-dose bowel prep (Picolax/Picoprep); ensure adequate hydration", sideEffects: "Abdominal cramping, dehydration, electrolyte disturbance; ensure adequate fluid intake"),
        .init(name: "Bisacodyl",      category: "Laxative",            commonDoses: "5–10 mg",    route: "PO/PR", notes: "Stimulant laxative; bowel prep adjunct; constipation", sideEffects: "Abdominal cramping, electrolyte disturbance; avoid long-term use"),
        .init(name: "Lactulose",      category: "Laxative",            commonDoses: "15–30 mL BD", route: "PO",   notes: "Osmotic laxative; hepatic encephalopathy (50 mL TDS until 2–3 stools/day)", sideEffects: "Bloating, flatulence, abdominal cramps, diarrhoea with excess"),
        .init(name: "Docusate sodium", category: "Laxative",           commonDoses: "100–200 mg BD", route: "PO", notes: "Stool softener; post-op opioid-induced constipation", sideEffects: "Diarrhoea with excess; minimal side effects at therapeutic doses"),
        .init(name: "Senna",          category: "Laxative",            commonDoses: "2–4 tablets nocte", route: "PO", notes: "Stimulant laxative; constipation; post-op bowel care", sideEffects: "Abdominal cramping, brown discoloration of urine; avoid in bowel obstruction"),
        .init(name: "Macrogol (Movicol)", category: "Laxative",        commonDoses: "1–2 sachets OD–BD", route: "PO", notes: "Osmotic laxative; well tolerated in elderly; faecal impaction (8 sachets/day x3)", sideEffects: "Bloating, abdominal cramps, nausea; generally mild and well-tolerated"),

        // ─── IV FLUIDS ────────────────────────────────────────────────────────
        .init(name: "Normal Saline (0.9% NaCl)", category: "IV Fluid", commonDoses: "1 L over 4–8h", route: "IV", notes: "Maintenance/resuscitation; use Hartmann's in preference for large volumes", sideEffects: "Hyperchloraemic metabolic acidosis (excess volumes), fluid overload, peripheral oedema"),
        .init(name: "Hartmann's (Ringer's Lactate)", category: "IV Fluid", commonDoses: "1 L over 4–8h", route: "IV", notes: "Balanced crystalloid; preferred for surgical patients and large-volume resuscitation", sideEffects: "Fluid overload; avoid in hyperkalaemia (K+ 4 mmol/L); negligible lactate load clinically"),
        .init(name: "5% Dextrose",    category: "IV Fluid",            commonDoses: "1 L over 8–12h", route: "IV",  notes: "Hypoglycaemia; maintenance alongside electrolyte replacement; drug vehicle", sideEffects: "Hyperglycaemia (in diabetics), hyponatraemia (dilutional), cerebral oedema (if over-infused)"),
        .init(name: "Human Albumin 4.5%", category: "IV Colloid",       commonDoses: "250–500 mL",  route: "IV",  notes: "Hepatic failure; perioperative hypoalbuminaemia; SBP prophylaxis", sideEffects: "Fluid overload, coagulopathy (large volumes), rare anaphylaxis"),
        .init(name: "Gelofusine",     category: "IV Colloid",           commonDoses: "500 mL bolus", route: "IV",  notes: "Plasma expander for hypovolaemia; anaphylaxis risk", sideEffects: "Anaphylactic/anaphylactoid reactions, coagulopathy with large volumes, pruritus"),

        // ─── DVT PROPHYLAXIS ─────────────────────────────────────────────────
        .init(name: "TED stockings",  category: "Mechanical DVT Prophylaxis", commonDoses: "Apply on admission", route: "External", notes: "Combine with LMWH for high-risk surgical patients; correct sizing essential", sideEffects: "Pressure ulcers if incorrectly sized; contraindicated in peripheral arterial disease"),
        .init(name: "Pneumatic compression device", category: "Mechanical DVT Prophylaxis", commonDoses: "Intraoperative + post-op until mobilising", route: "External", notes: "Preferred when LMWH contraindicated (high bleeding risk)", sideEffects: "Discomfort; compartment syndrome risk if applied too tightly (rare)"),

        // ─── STEROIDS ────────────────────────────────────────────────────────
        .init(name: "Hydrocortisone", category: "Corticosteroid",      commonDoses: "100 mg TDS",  route: "IV",    notes: "Adrenal crisis; peri-op steroid cover; severe asthma/anaphylaxis", sideEffects: "Hyperglycaemia, hypertension, fluid retention, immunosuppression, GI ulceration (with NSAIDs)"),
        .init(name: "Dexamethasone",  category: "Corticosteroid",      commonDoses: "4–8 mg",      route: "IV/PO", notes: "Post-op nausea; cerebral oedema; croup; 4 mg intraoperative single dose", sideEffects: "Hyperglycaemia, insomnia, mood changes, fluid retention; full steroid SE with repeated use"),
        .init(name: "Prednisolone",   category: "Corticosteroid",      commonDoses: "10–40 mg OD", route: "PO",    notes: "IBD; autoimmune; stress-dose coverage peri-op if on >5 mg/day chronically", sideEffects: "Hyperglycaemia, weight gain, osteoporosis (long-term), adrenal suppression, immunosuppression, peptic ulceration"),
        .init(name: "Methylprednisolone", category: "Corticosteroid",  commonDoses: "125–500 mg OD", route: "IV/IM/PO", notes: "IBD flare; acute inflammatory; acute spinal cord injury (3h window)", sideEffects: "Hyperglycaemia, insomnia, immunosuppression, GI ulceration, avascular necrosis (high/prolonged doses)"),

        // ─── INSULIN / GLYCAEMIC CONTROL ─────────────────────────────────────
        .init(name: "Actrapid (soluble insulin)", category: "Insulin", commonDoses: "Variable by sliding scale", route: "IV/SC", notes: "Peri-op glycaemic control; variable rate insulin infusion", sideEffects: "Hypoglycaemia, hypokalaemia (IV infusion), lipodystrophy at injection site"),
        .init(name: "Insulin detemir", category: "Insulin (Long-acting)", commonDoses: "Individualised",         route: "SC",    notes: "Continue at 80% of usual dose peri-operatively", sideEffects: "Hypoglycaemia, weight gain, injection-site lipodystrophy, oedema"),
        .init(name: "Insulin glargine (Lantus)", category: "Insulin (Long-acting)", commonDoses: "Individualised OD", route: "SC", notes: "Once daily basal insulin; continue peri-operatively at reduced dose", sideEffects: "Hypoglycaemia, injection-site reactions, oedema, weight gain"),
        .init(name: "Metformin",      category: "Hypoglycaemic",       commonDoses: "500–1000 mg BD–TDS", route: "PO", notes: "HOLD 24–48h before contrast/surgery; lactic acidosis risk", sideEffects: "GI upset (nausea, diarrhoea), lactic acidosis (rare — hold in renal failure/contrast), B12 deficiency (long-term)"),
        .init(name: "Gliclazide",     category: "Sulphonylurea",       commonDoses: "40–320 mg OD–BD",    route: "PO", notes: "HOLD on day of surgery (hypoglycaemia risk); lower hypoglycaemia risk than glibenclamide", sideEffects: "Hypoglycaemia, weight gain, nausea"),
        .init(name: "Glibenclamide",  category: "Sulphonylurea",       commonDoses: "2.5–15 mg OD",       route: "PO", notes: "Avoid in elderly — prolonged hypoglycaemia risk; HOLD perioperatively", sideEffects: "Prolonged severe hypoglycaemia (especially in elderly/renal impairment), weight gain"),

        // ─── ANTIHYPERTENSIVES ───────────────────────────────────────────────
        .init(name: "Amlodipine",     category: "Calcium Channel Blocker", commonDoses: "5–10 mg OD",     route: "PO", notes: "Hypertension; angina; continue peri-operatively", sideEffects: "Ankle oedema, flushing, headache, palpitations, gingival hyperplasia"),
        .init(name: "Nifedipine",     category: "Calcium Channel Blocker", commonDoses: "30–60 mg OD (SR)", route: "PO", notes: "Hypertension; Raynaud's; use SR/LA formulation only", sideEffects: "Flushing, headache, ankle oedema, reflex tachycardia; avoid immediate-release in ischaemic heart disease"),
        .init(name: "Lisinopril",     category: "ACE Inhibitor",       commonDoses: "2.5–40 mg OD",      route: "PO", notes: "Heart failure; diabetic nephropathy; HOLD 24h pre-op if hypotension risk", sideEffects: "Dry cough (10–15%), hyperkalaemia, renal impairment, angioedema (rare), first-dose hypotension"),
        .init(name: "Ramipril",       category: "ACE Inhibitor",       commonDoses: "1.25–10 mg OD",     route: "PO", notes: "Heart failure; post-MI; nephroprotection", sideEffects: "Dry cough, hyperkalaemia, renal impairment, angioedema, hypotension; HOLD 24h pre-op"),
        .init(name: "Losartan",       category: "ARB",                 commonDoses: "25–100 mg OD",      route: "PO", notes: "ACE inhibitor cough alternative; nephroprotection in T2DM; hepatic elimination", sideEffects: "Hyperkalaemia, renal impairment, dizziness, hypotension; HOLD 24h pre-op"),
        .init(name: "Atenolol",       category: "Beta-blocker",        commonDoses: "25–100 mg OD",      route: "PO", notes: "Hypertension; angina; continue peri-operatively", sideEffects: "Bradycardia, fatigue, cold extremities, bronchospasm (avoid in asthma), impaired hypoglycaemia awareness"),
        .init(name: "Metoprolol",     category: "Beta-blocker (β1-selective)", commonDoses: "25–200 mg BD; 47.5–190 mg OD (XL)", route: "PO/IV", notes: "Hypertension; heart failure; perioperative cardiac protection", sideEffects: "Bradycardia, fatigue, cold extremities, dizziness; less bronchospasm than non-selective agents"),
        .init(name: "Carvedilol",     category: "Alpha/Beta-blocker",  commonDoses: "3.125–25 mg BD",    route: "PO", notes: "Heart failure (preferred beta-blocker); portal hypertension in cirrhosis", sideEffects: "Postural hypotension, bradycardia, fatigue, dizziness, oedema, bronchospasm"),
        .init(name: "Bisoprolol",     category: "Beta-blocker (β1-selective)", commonDoses: "1.25–10 mg OD", route: "PO", notes: "Heart failure; rate control AF; highly β1-selective", sideEffects: "Bradycardia, fatigue, cold extremities, dizziness; minimal bronchospasm risk"),
        .init(name: "Furosemide",     category: "Loop Diuretic",       commonDoses: "20–80 mg OD–BD",    route: "PO/IV", notes: "Fluid overload; heart failure; acute pulmonary oedema (80–120 mg IV)", sideEffects: "Hypokalaemia, hyponatraemia, hypomagnesaemia, ototoxicity (high IV doses), dehydration, gout"),
        .init(name: "Spironolactone", category: "Potassium-sparing Diuretic", commonDoses: "25–100 mg OD", route: "PO", notes: "Heart failure; ascites/cirrhosis; primary hyperaldosteronism", sideEffects: "Hyperkalaemia, gynaecomastia, menstrual irregularities, impotence, GI upset"),
        .init(name: "Hydrochlorothiazide", category: "Thiazide Diuretic", commonDoses: "12.5–25 mg OD", route: "PO", notes: "Hypertension; usually combined with ACE inhibitor/ARB", sideEffects: "Hypokalaemia, hyponatraemia, hyperuricaemia/gout, hyperglycaemia, photosensitivity"),

        // ─── STATINS / LIPID-LOWERING ─────────────────────────────────────────
        .init(name: "Atorvastatin",   category: "Statin",              commonDoses: "10–80 mg nocte",    route: "PO", notes: "Cardiovascular risk reduction; first-line statin; continue peri-operatively", sideEffects: "Myalgia, myopathy, rhabdomyolysis (rare), elevated LFTs, new-onset diabetes (long-term)"),
        .init(name: "Simvastatin",    category: "Statin",              commonDoses: "10–40 mg nocte",    route: "PO", notes: "Cardiovascular risk reduction; CYP3A4 interactions with macrolides/azoles", sideEffects: "Myalgia, rhabdomyolysis (dose-dependent, especially with CYP3A4 inhibitors), elevated LFTs"),
        .init(name: "Rosuvastatin",   category: "Statin",              commonDoses: "5–40 mg OD",        route: "PO", notes: "High-potency statin; less CYP3A4 interaction than simvastatin", sideEffects: "Myalgia, proteinuria (high doses), elevated LFTs, headache"),

        // ─── ANTIPLATELETS ───────────────────────────────────────────────────
        .init(name: "Aspirin",        category: "Antiplatelet / NSAID", commonDoses: "75–300 mg OD (antiplatelet); 300–600 mg loading", route: "PO", notes: "Continue low-dose for cardiac stents; consider holding for major surgery", sideEffects: "GI irritation/ulceration, bleeding, bronchospasm (aspirin-sensitive asthma)"),
        .init(name: "Clopidogrel",    category: "Antiplatelet",        commonDoses: "75 mg OD; 300–600 mg loading dose",               route: "PO", notes: "Dual antiplatelet post-ACS/PCI; stop 5–7 days pre-surgery", sideEffects: "Bleeding, bruising, TTP (rare), rash, GI upset"),

        // ─── THYROID MEDICATIONS ─────────────────────────────────────────────
        .init(name: "Levothyroxine",  category: "Thyroid Hormone",     commonDoses: "25–200 mcg OD (titrate to TSH)", route: "PO", notes: "Hypothyroidism; take 30 min before food on empty stomach", sideEffects: "Palpitations, tremor, insomnia, weight loss, angina — if overdosed or dose increased too rapidly"),
        .init(name: "Carbimazole",    category: "Antithyroid",         commonDoses: "10–40 mg OD (initial); 5–15 mg OD (maintenance)", route: "PO", notes: "Hyperthyroidism; Graves' disease; WARN re agranulocytosis (report sore throat immediately)", sideEffects: "Agranulocytosis (0.2–0.5% — warn patient), rash, nausea, arthralgia, hepatotoxicity"),
        .init(name: "Propylthiouracil", category: "Antithyroid",       commonDoses: "100–200 mg TDS (initial)",         route: "PO", notes: "Preferred in first trimester and thyroid storm; risk of hepatotoxicity", sideEffects: "Agranulocytosis, fulminant hepatotoxicity (rare but serious), rash, arthralgia"),

        // ─── CARDIAC ─────────────────────────────────────────────────────────
        .init(name: "Digoxin",        category: "Cardiac Glycoside",   commonDoses: "62.5–250 mcg OD",   route: "PO/IV", notes: "Rate control in AF; heart failure; narrow therapeutic index — monitor levels", sideEffects: "Nausea, vomiting, yellow/green visual disturbances, bradycardia, heart block; digitalis toxicity"),
        .init(name: "Amiodarone",     category: "Antiarrhythmic",      commonDoses: "200 mg TDS (loading 1 week); 200 mg OD (maintenance)", route: "PO/IV", notes: "AF/flutter/VT/VF; many interactions; long half-life (40–55 days)", sideEffects: "Thyroid dysfunction, photosensitivity, corneal deposits, pulmonary toxicity, hepatotoxicity, peripheral neuropathy"),

        // ─── PRE-OP / ENDOSCOPY / ANAESTHETIC ADJUNCTS ───────────────────────
        .init(name: "Midazolam",      category: "Benzodiazepine / Sedative", commonDoses: "1–5 mg titrated IV; 0.05–0.1 mg/kg IM pre-op", route: "IV/IM/oral", notes: "Endoscopy/procedure sedation; anxiolysis; anterograde amnesia", sideEffects: "Respiratory depression (with opioids), paradoxical agitation, anterograde amnesia, hypotension"),
        .init(name: "Propofol",       category: "IV Anaesthetic",      commonDoses: "1–2.5 mg/kg induction; 4–12 mg/kg/h TIVA",     route: "IV",    notes: "Anaesthetic induction/maintenance; procedural sedation; rapid recovery", sideEffects: "Pain on injection, hypotension, bradycardia, respiratory depression, propofol infusion syndrome (high-dose prolonged)"),
        .init(name: "Glucagon",       category: "GI Adjunct",          commonDoses: "0.5–1 mg IV/IM",                               route: "IV/IM", notes: "GI smooth muscle relaxation for endoscopy/ERCP; hypoglycaemia rescue", sideEffects: "Nausea, vomiting, tachycardia; rebound hypoglycaemia after hypoglycaemia rescue"),
        .init(name: "Neostigmine",    category: "Neuromuscular Reversal", commonDoses: "2.5–5 mg with atropine 1.2 mg IV",           route: "IV slow", notes: "Reversal of non-depolarising muscle relaxants; ALWAYS give with atropine", sideEffects: "Bradycardia, bronchospasm, increased secretions, bowel cramps, nausea (prevented by atropine)"),
        .init(name: "Atropine",       category: "Anticholinergic",     commonDoses: "0.3–0.6 mg IV (bradycardia); 1.2 mg with neostigmine", route: "IV/IM", notes: "Bradycardia; pre-op anti-sialagogue; neostigmine reversal cover", sideEffects: "Tachycardia, dry mouth, blurred vision, urinary retention, confusion (elderly), pyrexia"),
        .init(name: "Sugammadex",     category: "Neuromuscular Reversal", commonDoses: "2–16 mg/kg IV (dose by block depth)",        route: "IV",    notes: "Specific reversal of rocuronium/vecuronium; superior to neostigmine", sideEffects: "Hypersensitivity/anaphylaxis (1:3,000–1:10,000), bradycardia, recurrence of block if underdosed"),
        .init(name: "Naloxone",       category: "Opioid Reversal",     commonDoses: "100–200 mcg IV titrated; 0.4 mg IM/IN",         route: "IV/IM/IN", notes: "Opioid overdose reversal; short half-life (repeat dosing/infusion may be needed)", sideEffects: "Acute opioid withdrawal (agitation, tachycardia, pulmonary oedema), abrupt pain recurrence, vomiting"),

        // ─── ELECTROLYTES ────────────────────────────────────────────────────
        .init(name: "Potassium chloride IV", category: "Electrolyte",  commonDoses: "20–40 mmol in 1 L over 4h (max 20 mmol/h via peripheral)", route: "IV", notes: "Hypokalaemia correction; NEVER give as bolus — fatal arrhythmia; MUST be diluted", sideEffects: "Hyperkalaemia (cardiac arrest if rapid), infusion-site pain/phlebitis; MUST be diluted and given slowly"),
        .init(name: "Magnesium sulfate", category: "Electrolyte",      commonDoses: "2–4 g IV over 20 min; 1–2 g for hypomagnesaemia", route: "IV/IM", notes: "Pre-eclampsia/eclampsia; refractory VF; torsades de pointes; hypomagnesaemia", sideEffects: "Flushing, hypotension, loss of patellar reflex (toxicity precursor), respiratory depression, cardiac arrest (severe toxicity)"),
        .init(name: "Calcium gluconate", category: "Electrolyte",      commonDoses: "10 mL of 10% IV (1 g); repeat as needed",       route: "IV slow", notes: "Hypocalcaemia; hyperkalaemia cardioprotection; CCB toxicity; transfusion with citrated blood", sideEffects: "Bradycardia/arrhythmia (rapid infusion), venous irritation/necrosis (extravasation), hypercalcaemia with excess"),
        .init(name: "Sodium bicarbonate", category: "Electrolyte",     commonDoses: "50 mmol (50 mL 8.4%) IV; dose = BE × weight × 0.3", route: "IV", notes: "Severe metabolic acidosis (pH <7.1); TCA overdose; hyperkalaemia (temporising)", sideEffects: "Hyperosmolality, metabolic alkalosis, paradoxical CNS acidosis, hypokalaemia, fluid overload"),

        // ─── WOUND CARE / TOPICAL ────────────────────────────────────────────
        .init(name: "Silver sulfadiazine 1% cream", category: "Topical Antimicrobial", commonDoses: "Apply BD to burns/wounds", route: "Topical", notes: "Burns management; infected wounds; broad-spectrum including Pseudomonas", sideEffects: "Transient leucopenia, argyria (rare, prolonged use), sulfonamide hypersensitivity, pain on application"),
        .init(name: "Mupirocin (Bactroban)", category: "Topical Antibiotic", commonDoses: "Apply TDS for 5–7 days", route: "Topical", notes: "MRSA nasal decolonisation; skin/wound infections; impetigo", sideEffects: "Local irritation, stinging, contact dermatitis; avoid eyes and mucous membranes"),
        .init(name: "Chlorhexidine gluconate", category: "Antiseptic", commonDoses: "0.5–2% solution or 4% surgical scrub", route: "Topical", notes: "Surgical site prep; wound irrigation; catheter care; CRBSI prevention", sideEffects: "Skin staining (0.5%), rare anaphylaxis (especially in body cavities/catheters); avoid contact with middle ear"),

        // ─── HAEMATINICS / VITAMINS ──────────────────────────────────────────
        .init(name: "Ferrous sulfate", category: "Iron Supplement",    commonDoses: "200 mg TDS (treatment); 200 mg OD (prophylaxis)", route: "PO", notes: "Iron deficiency anaemia; pre-op haemoglobin optimisation; take with vitamin C", sideEffects: "Constipation, nausea, black stools, GI cramping, epigastric pain; take after food if intolerant"),
        .init(name: "Folic acid",      category: "Vitamin",            commonDoses: "5 mg OD (treatment); 400 mcg OD (prophylaxis)",   route: "PO", notes: "Folate deficiency anaemia; methotrexate co-prescription; pre-conception", sideEffects: "Generally very well tolerated; may mask B12 deficiency neurological complications if given alone"),
        .init(name: "Vitamin B12 (cyanocobalamin)", category: "Vitamin", commonDoses: "1000 mcg IM every 3 months (malabsorption/pernicious anaemia)", route: "IM/PO", notes: "B12 deficiency; post gastrectomy/ileal resection; pernicious anaemia", sideEffects: "Minimal; injection-site reactions; acne (rare); polycythaemia with high doses"),
        .init(name: "Vitamin D3 (cholecalciferol)", category: "Vitamin", commonDoses: "800–4000 IU OD (maintenance); 50,000 IU weekly x 6–12 (loading)", route: "PO", notes: "Vitamin D deficiency; bone health; post-bariatric surgery supplementation", sideEffects: "Hypercalcaemia in excess (nausea, confusion, renal stones, polyuria), weakness"),
        .init(name: "Thiamine (Vitamin B1)", category: "Vitamin",      commonDoses: "100 mg TDS PO; 100–200 mg IV (Wernicke's prevention)",              route: "PO/IV", notes: "Alcohol-related disease; malnutrition; Wernicke's — give BEFORE glucose in alcoholics", sideEffects: "Anaphylaxis (IV Pabrinex — rare but potentially fatal); GI upset; well tolerated orally"),
    ]
}

// MARK: - Bayesian Triage / Pathway Engine

struct DifferentialDx {
    let name: String
    let probability: Int  // estimated pre-test probability (0–100), not summing to 100
}

struct TriageResult {
    let suggestedAcuity: Acuity
    let redFlags: [String]
    let pathway: String
    let confidencePercent: Int
    let differentials: [DifferentialDx]
}

enum ClinicalPathwayEngine {
    static func assess(chiefComplaint: String, pmh: String = "") -> TriageResult {
        let cc = chiefComplaint.lowercased()
        let history = pmh.lowercased()

        var redFlags: [String] = []
        var suggestedAcuity: Acuity = .routine
        var pathway = "General Surgery Outpatient"
        var confidence = 60
        var differentials: [DifferentialDx] = []

        // --- Red flag detection ---
        let emergencyKeywords = ["rigidity", "peritonitis", "septic shock", "haemodynamic instability",
                                  "perforation", "massive haemorrhage", "ruptured", "acute abdomen",
                                  "strangulated", "ischemia", "bowel necrosis"]
        let urgentKeywords = ["acute", "severe pain", "vomiting blood", "haematemesis", "melaena",
                               "unable to open bowels", "complete obstruction", "high fever", "jaundice",
                               "cholangitis", "pancreatitis", "perforated"]

        for kw in emergencyKeywords where cc.contains(kw) || history.contains(kw) {
            redFlags.append("⚠️ \(kw.capitalized)")
            suggestedAcuity = .emergency
        }

        if suggestedAcuity != .emergency {
            for kw in urgentKeywords where cc.contains(kw) {
                suggestedAcuity = .urgent
                break
            }
        }

        // --- Pathway assignment ---
        if cc.contains("append") || cc.contains("right iliac fossa") || cc.contains("rif pain") {
            pathway = "Appendicitis Pathway"
            differentials = [.init(name: "Acute appendicitis", probability: 68),
                             .init(name: "Mesenteric adenitis", probability: 45),
                             .init(name: "Ovarian cyst / torsion", probability: 30),
                             .init(name: "Ectopic pregnancy", probability: 22)]
            if suggestedAcuity == .routine { suggestedAcuity = .urgent }
            confidence = 72
            if cc.contains("peritonitis") || cc.contains("perforation") {
                redFlags.append("⚠️ Possible perforated appendicitis")
                suggestedAcuity = .emergency
            }
        } else if cc.contains("gall") || cc.contains("biliary") || cc.contains("cholecyst") || cc.contains("ruc pain") || cc.contains("right upper") {
            pathway = "Biliary Pathway"
            differentials = [.init(name: "Biliary colic", probability: 65),
                             .init(name: "Acute cholecystitis", probability: 55),
                             .init(name: "Choledocholithiasis", probability: 38),
                             .init(name: "Cholangitis", probability: 18)]
            confidence = 75
            if cc.contains("cholangitis") || cc.contains("jaundice") {
                redFlags.append("⚠️ Possible Charcot's triad — exclude cholangitis")
                suggestedAcuity = .urgent
            }
        } else if cc.contains("hernia") {
            pathway = "Hernia Pathway"
            differentials = [.init(name: "Inguinal hernia", probability: 72),
                             .init(name: "Femoral hernia", probability: 38),
                             .init(name: "Umbilical hernia", probability: 30),
                             .init(name: "Incisional hernia", probability: 22)]
            confidence = 85
            if cc.contains("obstruct") || cc.contains("strangulat") || cc.contains("can't reduce") {
                redFlags.append("⚠️ Possible strangulated/obstructed hernia")
                suggestedAcuity = .emergency
            }
        } else if cc.contains("rectal bleed") || cc.contains("pr bleed") || cc.contains("melaena") || cc.contains("haematemesis") {
            pathway = "GI Haemorrhage Pathway"
            differentials = [.init(name: "Haemorrhoids", probability: 58),
                             .init(name: "Diverticular bleed", probability: 42),
                             .init(name: "Colorectal cancer", probability: 32),
                             .init(name: "Peptic ulcer disease", probability: 28),
                             .init(name: "Angiodysplasia", probability: 18)]
            confidence = 70
            if cc.contains("massive") || cc.contains("shocked") {
                redFlags.append("⚠️ Massive GI haemorrhage — resuscitate urgently")
                suggestedAcuity = .emergency
            } else {
                suggestedAcuity = .urgent
            }
        } else if cc.contains("obstruct") || cc.contains("distension") || cc.contains("vomiting") && cc.contains("not open bowels") {
            pathway = "Bowel Obstruction Pathway"
            differentials = [.init(name: "Adhesional obstruction", probability: 55),
                             .init(name: "Colorectal cancer", probability: 38),
                             .init(name: "Hernia", probability: 30),
                             .init(name: "Volvulus", probability: 22),
                             .init(name: "Diverticular disease", probability: 18)]
            confidence = 65
            suggestedAcuity = .urgent
            if cc.contains("volvulus") || cc.contains("ischaemia") {
                redFlags.append("⚠️ Possible closed-loop obstruction")
                suggestedAcuity = .emergency
            }
        } else if cc.contains("breast") || cc.contains("lump") && (cc.contains("axilla") || cc.contains("nipple")) {
            pathway = "Breast Surgery Pathway"
            differentials = [.init(name: "Fibroadenoma", probability: 45),
                             .init(name: "Breast cyst", probability: 38),
                             .init(name: "Breast carcinoma", probability: 30),
                             .init(name: "Mastitis / abscess", probability: 22),
                             .init(name: "Gynaecomastia", probability: 12)]
            confidence = 60
            if cc.contains("skin tether") || cc.contains("nipple retract") || cc.contains("peau d'orange") {
                redFlags.append("⚠️ Signs suspicious for malignancy — urgent triple assessment")
                suggestedAcuity = .priority
            }
        } else if cc.contains("thyroid") || cc.contains("goitre") || cc.contains("neck swelling") {
            pathway = "Thyroid Pathway"
            differentials = [.init(name: "Multinodular goitre", probability: 55),
                             .init(name: "Solitary thyroid nodule", probability: 45),
                             .init(name: "Thyroid carcinoma", probability: 28),
                             .init(name: "Thyroiditis", probability: 22)]
            confidence = 70
            if cc.contains("stridor") || cc.contains("dysphagia") || cc.contains("rapidly growing") {
                redFlags.append("⚠️ Compressive/invasive — urgent assessment")
                suggestedAcuity = .priority
            }
        } else if cc.contains("pancreatit") || cc.contains("epigastric") && (cc.contains("severe") || cc.contains("radiating to back")) {
            pathway = "Pancreatitis Pathway"
            differentials = [.init(name: "Acute pancreatitis", probability: 65),
                             .init(name: "Peptic ulcer disease", probability: 32),
                             .init(name: "Aortic aneurysm", probability: 18),
                             .init(name: "Myocardial infarction", probability: 14)]
            confidence = 68
            suggestedAcuity = .urgent
        } else if cc.contains("colorectal") || cc.contains("change in bowel habit") || cc.contains("rectal mass") || cc.contains("weight loss") {
            pathway = "Colorectal Screening Pathway"
            differentials = [.init(name: "Diverticular disease", probability: 52),
                             .init(name: "IBS", probability: 48),
                             .init(name: "Colorectal carcinoma", probability: 38),
                             .init(name: "Polyps", probability: 35),
                             .init(name: "IBD", probability: 28)]
            confidence = 60
            if cc.contains("weight loss") || cc.contains("iron deficiency") {
                redFlags.append("⚠️ Red flag symptoms — urgent colonoscopy")
                suggestedAcuity = .priority
            }
        } else if cc.contains("abscess") || cc.contains("perianal") || cc.contains("fistula") || cc.contains("fissure") {
            pathway = "Anorectal Pathway"
            differentials = [.init(name: "Haemorrhoids", probability: 60),
                             .init(name: "Anal fissure", probability: 50),
                             .init(name: "Perianal abscess", probability: 42),
                             .init(name: "Anal fistula", probability: 35),
                             .init(name: "Pilonidal disease", probability: 28)]
            confidence = 78
            if cc.contains("sepsis") || cc.contains("necrotising") {
                redFlags.append("⚠️ Possible necrotising infection — urgent surgical review")
                suggestedAcuity = .emergency
            }
        } else if cc.contains("ercp") || cc.contains("common bile duct") || cc.contains("cbd stone") {
            pathway = "ERCP / Biliary Endoscopy Pathway"
            differentials = [.init(name: "Choledocholithiasis", probability: 72),
                             .init(name: "Biliary stricture", probability: 38),
                             .init(name: "Cholangiocarcinoma", probability: 22),
                             .init(name: "Post-ERCP pancreatitis", probability: 15)]
            confidence = 80
        }

        // Undifferentiated abdominal pain default
        if differentials.isEmpty {
            differentials = [.init(name: "Biliary disease", probability: 38),
                             .init(name: "Appendicitis", probability: 28),
                             .init(name: "Diverticular disease", probability: 25),
                             .init(name: "IBD", probability: 18),
                             .init(name: "Gynaecological cause", probability: 15)]
            pathway = "Undifferentiated Abdominal Pain — Further Assessment Required"
            confidence = 40
        }

        return TriageResult(
            suggestedAcuity: suggestedAcuity,
            redFlags: redFlags,
            pathway: pathway,
            confidencePercent: confidence,
            differentials: differentials
        )
    }
}

// MARK: - Search service facade

enum ClinicalSearchService {
    static func searchICD(_ query: String) -> [ICDCode] { ICDCode.search(query) }
    static func searchDrugs(_ query: String) -> [SurgicalDrug] { SurgicalDrug.search(query) }
}
