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
        guard query.count >= 1 else { return [] }
        let q = query.lowercased()
        return allDrugs.filter {
            $0.name.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    // Curated subset shown when the search field is focused but empty — the
    // most commonly prescribed drugs in a general/endoscopic surgical practice.
    private static let _popularNames: Set<String> = [
        // Antihypertensives / Cardiac
        "Amlodipine", "Losartan", "Lisinopril", "Ramipril", "Atenolol",
        "Bisoprolol", "Metoprolol", "Furosemide", "Hydrochlorothiazide",
        "Spironolactone", "Valsartan", "Candesartan", "Perindopril",
        // Lipid / Antiplatelet
        "Atorvastatin", "Simvastatin", "Rosuvastatin", "Aspirin", "Clopidogrel",
        // Diabetes
        "Metformin", "Gliclazide", "Insulin aspart (NovoRapid)", "Empagliflozin (Jardiance)",
        // Analgesics / GI
        "Paracetamol", "Ibuprofen", "Naproxen",
        "Omeprazole", "Pantoprazole", "Esomeprazole (Nexium)",
        // Anticoagulants
        "Enoxaparin", "Warfarin",
        // Endocrine
        "Levothyroxine", "Prednisolone",
        // Antiemetics
        "Metoclopramide", "Ondansetron",
        // Respiratory
        "Salbutamol (Albuterol)", "Beclometasone (Clenil, QVAR)",
        // CNS / Psychiatry
        "Sertraline", "Diazepam",
        // Urology
        "Tamsulosin (Flomax)",
        // Allergy
        "Cetirizine (Zyrtec)", "Loratadine (Claritin)", "Chlorphenamine (Piriton)",
        // Antibiotics (common)
        "Amoxicillin", "Co-amoxiclav (Augmentin)", "Doxycycline", "Metronidazole",
        "Ciprofloxacin", "Flucloxacillin",
        // Anaesthetic adjuncts
        "Morphine", "Tramadol",
    ]
    static var popular: [SurgicalDrug] {
        allDrugs.filter { _popularNames.contains($0.name) }
                .sorted { $0.name < $1.name }
    }

    // Split into private sub-arrays to avoid Swift type-checker timeout on large literals.
    static let allDrugs: [SurgicalDrug] =
        _drugs1 + _drugs2 + _drugs3 + _drugs4 + _drugs5

    private static let _drugs1: [SurgicalDrug] = [

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
        .init(name: "Indapamide",         category: "Thiazide-like Diuretic", commonDoses: "1.5 mg OD (SR); 2.5 mg OD",   route: "PO", notes: "Preferred thiazide in elderly; less metabolic disturbance than HCTZ", sideEffects: "Hypokalaemia, hyponatraemia, hyperuricaemia; less hyperglycaemia than thiazides"),
        .init(name: "Chlorthalidone",     category: "Thiazide Diuretic",      commonDoses: "12.5–25 mg OD",               route: "PO", notes: "Longer-acting than HCTZ; preferred in cardiovascular risk reduction", sideEffects: "Hypokalaemia, hyponatraemia, hyperuricaemia, hyperglycaemia, photosensitivity"),
        .init(name: "Valsartan",          category: "ARB",                    commonDoses: "80–320 mg OD",                 route: "PO", notes: "Hypertension; heart failure post-MI; no ACE inhibitor cough", sideEffects: "Hyperkalaemia, renal impairment, dizziness, hypotension; HOLD 24h pre-op"),
        .init(name: "Candesartan",        category: "ARB",                    commonDoses: "4–32 mg OD",                   route: "PO", notes: "Hypertension; heart failure with reduced EF", sideEffects: "Hyperkalaemia, renal impairment, dizziness, hypotension, raised creatinine"),
        .init(name: "Telmisartan",        category: "ARB",                    commonDoses: "20–80 mg OD",                  route: "PO", notes: "Long-acting ARB; once daily; hepatic elimination (safe in renal failure)", sideEffects: "Hyperkalaemia, renal impairment, dizziness, back pain; HOLD 24h pre-op"),
        .init(name: "Irbesartan",         category: "ARB",                    commonDoses: "150–300 mg OD",                route: "PO", notes: "Hypertension; diabetic nephropathy in type 2 DM", sideEffects: "Hyperkalaemia, renal impairment, dizziness, musculoskeletal pain"),
        .init(name: "Olmesartan",         category: "ARB",                    commonDoses: "10–40 mg OD",                  route: "PO", notes: "Hypertension; associated with sprue-like enteropathy (rare)", sideEffects: "Hyperkalaemia, renal impairment, dizziness; sprue-like enteropathy (rare)"),
        .init(name: "Perindopril",        category: "ACE Inhibitor",          commonDoses: "2–10 mg OD",                   route: "PO", notes: "Hypertension; stable coronary artery disease; heart failure", sideEffects: "Dry cough, hyperkalaemia, renal impairment, angioedema, hypotension"),
        .init(name: "Enalapril",          category: "ACE Inhibitor",          commonDoses: "2.5–40 mg OD–BD",             route: "PO/IV", notes: "Hypertension; heart failure; IV available for hypertensive urgency", sideEffects: "Dry cough, hyperkalaemia, renal impairment, angioedema; HOLD 24h pre-op"),
        .init(name: "Captopril",          category: "ACE Inhibitor",          commonDoses: "6.25–50 mg TDS",               route: "PO", notes: "Short-acting; used in hypertensive crisis (acute dose); nephroprotective", sideEffects: "Dry cough, hyperkalaemia, renal impairment, taste disturbance, rash, angioedema"),
        .init(name: "Doxazosin",          category: "Alpha-1 Blocker",        commonDoses: "1–16 mg OD (XL: 4–8 mg OD)",  route: "PO", notes: "Hypertension; BPH; first dose hypotension — start 1 mg nocte", sideEffects: "Postural hypotension (first dose), dizziness, oedema, drowsiness, rhinitis"),
        .init(name: "Prazosin",           category: "Alpha-1 Blocker",        commonDoses: "0.5–20 mg BD–TDS",             route: "PO", notes: "Hypertension; phaeochromocytoma pre-op; first-dose hypotension risk", sideEffects: "First-dose postural hypotension (syncope risk), dizziness, oedema, palpitations"),
        .init(name: "Diltiazem",          category: "Calcium Channel Blocker (non-DHP)", commonDoses: "60–120 mg TDS (standard); 120–360 mg OD (SR)", route: "PO/IV", notes: "Rate control AF; angina; avoid with beta-blockers (bradycardia risk)", sideEffects: "Bradycardia, heart block (with beta-blockers), ankle oedema, constipation, flushing"),
        .init(name: "Verapamil",          category: "Calcium Channel Blocker (non-DHP)", commonDoses: "40–120 mg TDS or 120–480 mg OD (SR)", route: "PO/IV", notes: "Rate control AF/SVT; angina; AVOID with beta-blockers (fatal bradycardia)", sideEffects: "Constipation, bradycardia, heart block, hypotension; NEVER combine with IV beta-blockers"),
        .init(name: "Labetalol",          category: "Alpha/Beta-blocker",     commonDoses: "100–400 mg BD–TDS PO; 50 mg IV bolus or 2 mg/min infusion", route: "PO/IV", notes: "Hypertensive emergency; pregnancy-induced hypertension; IV preferred inpatient", sideEffects: "Postural hypotension, bradycardia, bronchospasm, fatigue, scalp tingling (IV), nausea"),
        .init(name: "Hydralazine",        category: "Vasodilator",            commonDoses: "25–75 mg BD–QDS PO; 5–20 mg slow IV bolus", route: "PO/IV", notes: "Hypertensive emergency (IV); pregnancy hypertension; usually with beta-blocker", sideEffects: "Reflex tachycardia, fluid retention, lupus-like syndrome (prolonged use), headache, flushing"),
        .init(name: "Methyldopa",         category: "Centrally-acting Antihypertensive", commonDoses: "250–500 mg TDS",  route: "PO", notes: "Safe in pregnancy (drug of choice); sedating; Coombs-positive haemolysis risk", sideEffects: "Sedation, dry mouth, postural hypotension, positive Coombs test, hepatotoxicity (rare)"),
        .init(name: "Clonidine",          category: "Centrally-acting Antihypertensive", commonDoses: "50–300 mcg TDS",  route: "PO", notes: "Hypertension; AVOID abrupt withdrawal (rebound crisis); peri-op pain adjunct", sideEffects: "Sedation, dry mouth, rebound hypertension on abrupt withdrawal, bradycardia"),
        .init(name: "Minoxidil",          category: "Vasodilator",            commonDoses: "5–10 mg OD–BD",                route: "PO", notes: "Resistant hypertension; always with diuretic + beta-blocker; hair growth SE", sideEffects: "Fluid retention, reflex tachycardia, hypertrichosis, pericardial effusion (high dose)"),
        .init(name: "Sacubitril/Valsartan (Entresto)", category: "ARNI",     commonDoses: "24/26 mg BD → 49/51 mg BD → 97/103 mg BD", route: "PO", notes: "HFrEF; start after ACE inhibitor washout (≥36h); superior to ACE inhibitor in HF", sideEffects: "Hypotension, hyperkalaemia, renal impairment, angioedema (especially if switching from ACE inhibitor)"),
    ]

    private static let _drugs2: [SurgicalDrug] = [

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

    private static let _drugs3: [SurgicalDrug] = [

        // ─── ANTIBIOTICS — Additional ─────────────────────────────────────────
        .init(name: "Flucloxacillin",     category: "Antibiotic — Penicillin", commonDoses: "500 mg QDS (mild-mod); 1–2 g QDS IV (severe)", route: "PO/IV", notes: "Staphylococcal infections (MSSA); cellulitis; wound infections; take on empty stomach", sideEffects: "GI upset, cholestatic jaundice (avoid if previous hepatic reaction), hypersensitivity, C. difficile"),
        .init(name: "Benzylpenicillin (Penicillin G)", category: "Antibiotic — Penicillin", commonDoses: "600 mg – 2.4 g QDS IV",    route: "IV/IM", notes: "Meningococcal disease; streptococcal sepsis; syphilis; actinomycosis", sideEffects: "Hypersensitivity (anaphylaxis), neurotoxicity (seizures at very high doses), hyperkalaemia (potassium salt)"),
        .init(name: "Phenoxymethylpenicillin (Penicillin V)", category: "Antibiotic — Penicillin", commonDoses: "500 mg QDS PO",      route: "PO", notes: "Streptococcal tonsillitis; prophylaxis post-splenectomy; mild streptococcal cellulitis", sideEffects: "Hypersensitivity, nausea, diarrhoea, oral candidiasis (prolonged use)"),
        .init(name: "Ceftriaxone",        category: "Antibiotic — Cephalosporin", commonDoses: "1–2 g OD IV/IM; 4 g OD (meningitis)", route: "IV/IM", notes: "Community pneumonia; meningitis; gonorrhoea; surgical prophylaxis; biliary excretion", sideEffects: "Biliary sludge/gallstones (prolonged use), hypersensitivity, C. difficile, precipitates with calcium IV"),
        .init(name: "Levofloxacin",       category: "Antibiotic — Fluoroquinolone", commonDoses: "500 mg OD–BD PO/IV",              route: "PO/IV", notes: "Atypical/CAP; UTI; HAP; use with caution — tendon risk, QTc prolongation, disabling ADRs", sideEffects: "Tendon rupture (especially Achilles), QTc prolongation, peripheral neuropathy (may be irreversible), seizures, C. difficile"),
        .init(name: "Clarithromycin",     category: "Antibiotic — Macrolide", commonDoses: "250–500 mg BD PO; 500 mg BD IV",        route: "PO/IV", notes: "Atypical pneumonia; H. pylori eradication; skin infections; CYP3A4 inhibitor — check interactions", sideEffects: "GI upset, taste disturbance, QTc prolongation, hepatotoxicity, many CYP3A4 drug interactions"),
        .init(name: "Erythromycin",       category: "Antibiotic — Macrolide", commonDoses: "250–500 mg QDS PO; 6.25–12.5 mg/kg QDS IV", route: "PO/IV", notes: "Penicillin allergy alternative; gastroparesis prokinetic (low dose IV); Campylobacter", sideEffects: "GI upset (most common), QTc prolongation, phlebitis (IV), hepatotoxicity, ototoxicity (high dose IV)"),
        .init(name: "Co-trimoxazole (Trimethoprim/Sulfamethoxazole)", category: "Antibiotic — Sulfonamide", commonDoses: "960 mg BD PO/IV; 480 mg BD (prophylaxis)", route: "PO/IV", notes: "PCP (pneumocystis) treatment/prophylaxis; MRSA (community); Nocardia; Toxoplasma", sideEffects: "Rash (SJS/TEN risk), hyperkalaemia, renal impairment, folate antagonism (megaloblastic anaemia), G6PD haemolysis"),
        .init(name: "Teicoplanin",        category: "Antibiotic — Glycopeptide", commonDoses: "400 mg OD IV/IM (loading 12-hourly × 3 doses)", route: "IV/IM", notes: "MRSA; Gram-positive infections; CDI (oral); once-daily dosing advantage over vancomycin", sideEffects: "Red man syndrome (less than vancomycin), ototoxicity, nephrotoxicity (less than vancomycin), thrombocytopenia"),
        .init(name: "Linezolid",          category: "Antibiotic — Oxazolidinone", commonDoses: "600 mg BD PO/IV",                    route: "PO/IV", notes: "MRSA (including VRE); equal oral/IV bioavailability; MAO inhibitor — avoid tyramine-rich foods", sideEffects: "Thrombocytopenia (≥2 weeks), serotonin syndrome (with SSRIs/MAOIs), optic neuropathy (prolonged), lactic acidosis"),
        .init(name: "Rifampicin",         category: "Antibiotic — Rifamycin",   commonDoses: "450–600 mg OD PO (30 min before food); 600 mg BD (TB)", route: "PO/IV", notes: "TB (always in combination); MRSA decolonisation; prosthetic joint infections; induces CYP — many interactions", sideEffects: "Orange discolouration of body fluids, hepatotoxicity, powerful CYP inducer (OCP failure, warfarin, etc.), flu-like syndrome"),
        .init(name: "Imipenem/Cilastatin", category: "Antibiotic — Carbapenem", commonDoses: "500 mg QDS IV; 1 g QDS (severe)",       route: "IV", notes: "Broad-spectrum reserve antibiotic; ESBL/AmpC organisms; restrict to MDR infections", sideEffects: "Seizures (especially with renal impairment), nausea, C. difficile, hypersensitivity (cross-react penicillin)"),
        .init(name: "Colistin (Polymyxin E)", category: "Antibiotic — Polymyxin", commonDoses: "9 MU loading, then 4.5 MU BD IV (weight-adjusted)", route: "IV/nebulised", notes: "Last-resort for carbapenem-resistant Gram-negatives (Acinetobacter, Pseudomonas, Klebsiella)", sideEffects: "Nephrotoxicity (dose-limiting, ~50%), neurotoxicity, bronchoconstriction (nebulised), QTc prolongation"),
        .init(name: "Daptomycin",         category: "Antibiotic — Lipopeptide", commonDoses: "4–6 mg/kg OD IV; 6–10 mg/kg (endocarditis/bacteraemia)", route: "IV", notes: "MRSA bacteraemia; right-sided endocarditis; NOT for pulmonary infections (inactivated by surfactant)", sideEffects: "Myopathy/rhabdomyolysis (monitor CK weekly), peripheral neuropathy, eosinophilic pneumonitis, hepatotoxicity"),
        .init(name: "Tigecycline",        category: "Antibiotic — Glycylcycline", commonDoses: "100 mg loading, then 50 mg BD IV",   route: "IV", notes: "MDR Gram-positive and Gram-negative (except Pseudomonas); complicated skin/abdominal infections; resist. pneumonia", sideEffects: "Nausea and vomiting (very common), increased all-cause mortality vs comparators, photosensitivity, pancreatitis"),
        .init(name: "Fusidic acid",       category: "Antibiotic — Fusidane",    commonDoses: "500 mg TDS PO (with food); 580 mg TDS IV", route: "PO/IV/topical", notes: "Staphylococcal infections; MRSA (with rifampicin); skin/soft tissue; bone infections; never as monotherapy (resistance)", sideEffects: "Hepatotoxicity (IV form), jaundice, GI upset, thrombophlebitis (IV), resistance develops rapidly if used alone"),

        // ─── ANTIFUNGALS — Additional ─────────────────────────────────────────
        .init(name: "Nystatin",           category: "Antifungal — Polyene",     commonDoses: "100,000 units QDS oral suspension; 1 pessary/cream OD–BD", route: "Topical/oral", notes: "Oral/oesophageal candidiasis; vaginal candidiasis; NOT absorbed systemically (topical only)", sideEffects: "Nausea, vomiting (oral), contact dermatitis (topical); generally very well tolerated"),
        .init(name: "Itraconazole",       category: "Antifungal — Azole",       commonDoses: "100–200 mg OD–BD PO; 200 mg BD IV (7 days)", route: "PO/IV", notes: "Aspergillosis; histoplasmosis; onychomycosis; CYP3A4 inhibitor — check interactions", sideEffects: "Negative inotropy (avoid in heart failure), CYP3A4 interactions, hepatotoxicity, oedema, GI upset"),
        .init(name: "Voriconazole",       category: "Antifungal — Azole",       commonDoses: "6 mg/kg BD IV × 2 (loading), then 4 mg/kg BD; 200–300 mg BD PO", route: "PO/IV", notes: "Invasive aspergillosis (first-line); Candida; Fusarium; TDM required; CYP interactions", sideEffects: "Visual disturbances (transient, very common), photosensitivity, hallucinations, hepatotoxicity, QTc prolongation, fluorosis (long-term IV)"),
        .init(name: "Caspofungin",        category: "Antifungal — Echinocandin", commonDoses: "70 mg loading IV, then 50 mg OD",      route: "IV", notes: "Invasive candidiasis (including azole-resistant); salvage aspergillosis; minimal drug interactions", sideEffects: "Fever, phlebitis, elevated LFTs, rash, hypokalemia; generally well tolerated"),
        .init(name: "Micafungin",         category: "Antifungal — Echinocandin", commonDoses: "100–150 mg OD IV (treatment); 50 mg OD (prophylaxis)", route: "IV", notes: "Invasive candidiasis/candidaemia; oesophageal candidiasis; prophylaxis in HSCT", sideEffects: "Elevated LFTs, phlebitis, rash, nausea; hepatocellular carcinoma signal in animal studies (not confirmed in humans)"),

        // ─── ANTIVIRALS ───────────────────────────────────────────────────────
        .init(name: "Aciclovir",          category: "Antiviral — Herpesvirus",  commonDoses: "200–400 mg 5×/day PO; 5–10 mg/kg TDS IV", route: "PO/IV/topical", notes: "HSV/VZV treatment and suppression; herpes encephalitis (IV); ensure adequate hydration IV", sideEffects: "Nephrotoxicity (IV — ensure hydration), neurotoxicity (high dose/renal impairment), nausea, headache, phlebitis"),
        .init(name: "Valaciclovir",       category: "Antiviral — Herpesvirus",  commonDoses: "500 mg BD (HSV suppression); 1 g TDS × 7 days (zoster)", route: "PO", notes: "Oral prodrug of aciclovir; higher bioavailability; herpes zoster; genital HSV", sideEffects: "Nausea, headache, thrombotic microangiopathy (immunocompromised, high dose), nephrotoxicity (high dose)"),
        .init(name: "Oseltamivir (Tamiflu)", category: "Antiviral — Influenza", commonDoses: "75 mg BD × 5 days (treatment); 75 mg OD (prophylaxis)",  route: "PO", notes: "Influenza A/B; start within 48h of symptom onset; adjust for renal impairment", sideEffects: "Nausea, vomiting (take with food), headache, insomnia; rare neuropsychiatric effects (monitor)"),

        // ─── LOCAL ANAESTHETICS ───────────────────────────────────────────────
        .init(name: "Lidocaine",          category: "Local Anaesthetic",        commonDoses: "Infiltration: up to 3 mg/kg (plain) or 7 mg/kg (with adrenaline); topical 1–4%", route: "Local infiltration/topical/IV", notes: "Surgical infiltration; topical; epidural; IV antiarrhythmic (1–1.5 mg/kg); max dose critical", sideEffects: "CNS toxicity (tinnitus → seizures → coma), cardiovascular collapse (LAST — use lipid rescue 20%), methaemoglobinaemia"),
        .init(name: "Bupivacaine",        category: "Local Anaesthetic",        commonDoses: "Up to 2 mg/kg; 0.25–0.5% solution; spinal: 2–4 mL 0.5% heavy", route: "Local infiltration/spinal/epidural", notes: "Longer duration (4–8h); spinal/epidural; wound infiltration; higher cardiac toxicity than lidocaine", sideEffects: "Cardiac toxicity (severe — refractory VF if IV administered), CNS toxicity; LAST — lipid rescue; avoid IV use"),
        .init(name: "Ropivacaine",        category: "Local Anaesthetic",        commonDoses: "Up to 3 mg/kg; 0.2–0.75% solution; TAP block: 20 mL each side 0.25%", route: "Local infiltration/epidural/nerve block", notes: "Epidural analgesia; peripheral nerve blocks; TAP blocks; less cardiac toxicity than bupivacaine", sideEffects: "Less cardiotoxic than bupivacaine; CNS toxicity; sensory > motor block at low concentrations"),
        .init(name: "Levobupivacaine",    category: "Local Anaesthetic",        commonDoses: "Up to 2 mg/kg; 0.25–0.75% solution (spinal/epidural/blocks)", route: "Local infiltration/spinal/epidural", notes: "S(-) enantiomer of bupivacaine; similar duration with improved safety profile vs racemic bupivacaine", sideEffects: "Cardiac and CNS toxicity (less than bupivacaine); hypotension with epidural/spinal"),

        // ─── ANAESTHETIC / NEUROMUSCULAR AGENTS ──────────────────────────────
        .init(name: "Rocuronium",         category: "Neuromuscular Blocker — Non-depolarising", commonDoses: "0.6 mg/kg IV (intubating); 1.2 mg/kg (RSI); 0.1–0.2 mg/kg (maintenance)", route: "IV", notes: "Non-depolarising NMB; RSI alternative to suxamethonium; reversible with sugammadex", sideEffects: "Residual paralysis (must monitor NMT), anaphylaxis (rare but most common NMB cause), tachycardia"),
        .init(name: "Vecuronium",         category: "Neuromuscular Blocker — Non-depolarising", commonDoses: "0.1 mg/kg IV (intubating); 0.02 mg/kg (maintenance)",                       route: "IV", notes: "Cardiovascular stability; hepatic elimination (caution in liver failure); reversible with neostigmine/sugammadex", sideEffects: "Residual paralysis, anaphylaxis (rare), histamine release (uncommon vs vecuronium), accumulation in hepatic failure"),
        .init(name: "Suxamethonium (Succinylcholine)", category: "Neuromuscular Blocker — Depolarising", commonDoses: "1–1.5 mg/kg IV; 4 mg/kg IM",                          route: "IV/IM", notes: "Rapid onset (60s) for RSI; brief duration (~10 min); not reversible by sugammadex or neostigmine", sideEffects: "Hyperkalaemia (dangerous in burns/crush/denervation), malignant hyperthermia trigger, bradycardia, myalgia, raised IOP/ICP"),
        .init(name: "Ketamine",           category: "Dissociative Anaesthetic", commonDoses: "1–2 mg/kg IV (induction); 0.1–0.5 mg/kg IV (sedation/analgesia); IM: 4–5 mg/kg", route: "IV/IM", notes: "Anaesthetic induction; procedural sedation; bronchodilator (asthma); haemodynamically stable; analgesic adjunct", sideEffects: "Emergence hallucinations/dysphoria (reduced by midazolam), hypertension, tachycardia, increased secretions, PONV, raised IOP"),
        .init(name: "Etomidate",          category: "IV Anaesthetic",           commonDoses: "0.2–0.3 mg/kg IV",                                                                    route: "IV", notes: "Haemodynamically stable induction (cardiogenic shock, aortic stenosis); single dose for RSI", sideEffects: "Adrenocortical suppression (avoid infusion; single induction dose acceptable), myoclonus, pain on injection, PONV"),
        .init(name: "Thiopentone (Thiopental)", category: "IV Anaesthetic — Barbiturate", commonDoses: "3–5 mg/kg IV (induction); lower in elderly/shocked",                    route: "IV", notes: "Anaesthetic induction (largely replaced by propofol); neuroprotection; status epilepticus (last resort)", sideEffects: "Cardiovascular depression, laryngospasm, histamine release, porphyria exacerbation, necrosis if intra-arterial"),
    ]

    private static let _drugs4: [SurgicalDrug] = [

        // ─── VASOACTIVE / CARDIAC EMERGENCY ──────────────────────────────────
        .init(name: "Epinephrine (Adrenaline)", category: "Vasopressor / Emergency", commonDoses: "Cardiac arrest: 1 mg IV q3-5min; Anaphylaxis: 0.5 mg IM (0.5 mL 1:1000); Infusion: 0.05–2 mcg/kg/min", route: "IV/IM/ET", notes: "Cardiac arrest; anaphylaxis (IM); vasopressor/inotrope infusion; bronchospasm nebulised", sideEffects: "Tachycardia, hypertension, arrhythmia, myocardial ischaemia, peripheral ischaemia (infusion), anxiety, tremor"),
        .init(name: "Noradrenaline (Norepinephrine)", category: "Vasopressor",      commonDoses: "0.01–3 mcg/kg/min IV infusion (via central line)",                                route: "IV central", notes: "Vasodilatory/distributive shock (first-line vasopressor in sepsis); increases SVR with moderate inotropy", sideEffects: "Peripheral ischaemia/digital necrosis (high dose), reflex bradycardia, arrhythmia, hypertension, tissue necrosis if extravasated"),
        .init(name: "Dopamine",           category: "Vasopressor / Inotrope",   commonDoses: "2–20 mcg/kg/min IV infusion",                                                         route: "IV", notes: "Cardiogenic/septic shock; dose-dependent: 2–5 (renal), 5–10 (cardiac), >10 (vasopressor); not preferred over noradrenaline in sepsis", sideEffects: "Tachycardia, arrhythmia (common), ischaemia, nausea, increased pulmonary wedge pressure"),
        .init(name: "Dobutamine",         category: "Inotrope",                 commonDoses: "2.5–20 mcg/kg/min IV infusion",                                                        route: "IV", notes: "Cardiogenic shock; low-output heart failure; stress echocardiography; tachyphylaxis with prolonged use", sideEffects: "Tachycardia, arrhythmia, hypotension (vasodilatory), myocardial ischaemia, tachyphylaxis (>72h)"),
        .init(name: "Vasopressin",        category: "Vasopressor",              commonDoses: "0.03–0.04 units/min IV fixed dose (septic shock adjunct)",                             route: "IV", notes: "Adjunct vasopressor in refractory septic shock (reduces noradrenaline requirements); ADH for diabetes insipidus", sideEffects: "Digital/mesenteric ischaemia, hyponatraemia (excess), coronary ischaemia, decreased cardiac output"),
        .init(name: "GTN (Glyceryl trinitrate)", category: "Nitrate",           commonDoses: "0.4 mg SL PRN; 10–200 mcg/min IV; patch 5–15 mg/24h",                                 route: "SL/IV/topical/buccal", notes: "Acute angina (SL); LVF/pulmonary oedema; hypertensive emergency; oesophageal spasm", sideEffects: "Headache (very common, dose-limiting), hypotension, flushing, tachycardia (reflex), tolerance (nitrate-free interval required)"),
        .init(name: "Isosorbide Mononitrate", category: "Nitrate",              commonDoses: "20 mg BD (asymmetric: morning + afternoon); SR 30–120 mg OD",                          route: "PO", notes: "Chronic angina prophylaxis; nitrate-free interval mandatory (8h) to prevent tolerance", sideEffects: "Headache, flushing, hypotension, dizziness; tolerance with continuous use (use asymmetric dosing)"),
        .init(name: "Adenosine",          category: "Antiarrhythmic",           commonDoses: "6 mg rapid IV → 12 mg → 18 mg if no response",                                         route: "IV rapid bolus", notes: "SVT cardioversion; WPW diagnosis; very short half-life (10s); give as rapid bolus into large vein", sideEffects: "Chest tightness, dyspnoea, flushing (very common, transient), bronchospasm (avoid in asthma — use verapamil), AF (if accessory pathway)"),
        .init(name: "Ticagrelor",         category: "Antiplatelet — P2Y12 inhibitor", commonDoses: "180 mg loading; 90 mg BD maintenance",                                           route: "PO", notes: "ACS/PCI (first-line over clopidogrel in ACS); reversible binding; stop 5 days pre-surgery", sideEffects: "Dyspnoea (common, often resolves), bleeding, bradycardia (first week), gout exacerbation"),
        .init(name: "Prasugrel",          category: "Antiplatelet — P2Y12 inhibitor", commonDoses: "60 mg loading; 10 mg OD maintenance (5 mg if <60 kg or >75 yrs)", route: "PO", notes: "ACS undergoing PCI; avoid if prior TIA/stroke/age >75/weight <60 kg — higher bleeding risk; stop 7 days pre-op", sideEffects: "Bleeding (higher than clopidogrel), TTP (rare), rash, hypotension"),
        .init(name: "Ezetimibe",          category: "Lipid-lowering — Cholesterol Absorption Inhibitor", commonDoses: "10 mg OD",                                             route: "PO", notes: "Hypercholesterolaemia (add-on to statin or monotherapy); reduces LDL ~18%; well tolerated", sideEffects: "GI upset, headache, myalgia (especially with statin combination), hepatotoxicity (rare), elevated LFTs"),
        .init(name: "Fenofibrate",        category: "Lipid-lowering — Fibrate",  commonDoses: "145–200 mg OD",                                                                       route: "PO", notes: "Hypertriglyceridaemia; mixed dyslipidaemia; pancreatitis risk reduction; combine cautiously with statins", sideEffects: "GI upset, myopathy (with statins — lower risk than gemfibrozil), elevated creatinine, cholelithiasis, hepatotoxicity"),
        .init(name: "Ivabradine",         category: "Heart Rate-lowering",       commonDoses: "2.5–7.5 mg BD",                                                                       route: "PO", notes: "Symptomatic angina (sinus rhythm); HFrEF (HR >70 bpm in sinus rhythm, on BB); sinus node inhibitor only", sideEffects: "Visual phosphenes/blurred vision (If-channel), bradycardia, AF (increased risk in HF), headache"),
        .init(name: "Flecainide",         category: "Antiarrhythmic — Class Ic", commonDoses: "50–200 mg BD PO; 2 mg/kg IV (max 150 mg) over 30 min",                               route: "PO/IV", notes: "AF/flutter cardioversion (pill-in-pocket); paroxysmal SVT; AVOID in structural heart disease/post-MI (proarrhythmic)", sideEffects: "Proarrhythmic (severe — contraindicated in structural heart disease), dizziness, visual disturbances, bradycardia/AV block"),
        .init(name: "Sotalol",            category: "Antiarrhythmic — Class III / Beta-blocker", commonDoses: "40–160 mg BD PO",                                              route: "PO", notes: "AF/flutter; ventricular arrhythmia; non-selective beta-blocker + potassium channel blocker; monitor QTc", sideEffects: "QTc prolongation (torsades — dose-related), bradycardia, bronchospasm, fatigue, hypoglycaemia masking"),

        // ─── RESPIRATORY ──────────────────────────────────────────────────────
        .init(name: "Salbutamol (Albuterol)", category: "Bronchodilator — SABA", commonDoses: "2.5–5 mg nebulised PRN; 100–200 mcg MDI (1–2 puffs); 250–500 mcg IV for severe", route: "Inhaled/IV/nebulised", notes: "Acute bronchospasm; asthma; COPD acute exacerbation; hyperkalaemia (high-dose nebulised)", sideEffects: "Tremor, tachycardia, palpitations, hypokalaemia (high dose/repeated), paradoxical bronchospasm"),
        .init(name: "Ipratropium (Atrovent)", category: "Bronchodilator — SAMA", commonDoses: "0.5 mg nebulised QDS; 20–40 mcg MDI (2–4 puffs) QDS",                               route: "Inhaled/nebulised", notes: "COPD; acute asthma (in combination with salbutamol); bronchodilator via anticholinergic mechanism", sideEffects: "Dry mouth, urinary retention, constipation, glaucoma (nebulised — protect eyes), paradoxical bronchospasm"),
        .init(name: "Tiotropium (Spiriva)", category: "Bronchodilator — LAMA",   commonDoses: "18 mcg OD (Handihaler); 5 mcg OD (Respimat)",                                         route: "Inhaled", notes: "COPD maintenance (first-line LAMA); once-daily dosing; reduces exacerbations; not for acute relief", sideEffects: "Dry mouth (most common), urinary retention, constipation, AF, cognitive effects (elderly)"),
        .init(name: "Salmeterol",         category: "Bronchodilator — LABA",     commonDoses: "50 mcg BD inhaled (usually in combination ICS/LABA)",                                 route: "Inhaled", notes: "Asthma maintenance (always with ICS); COPD; NEVER use as monotherapy in asthma (increased mortality risk)", sideEffects: "Tremor, tachycardia, hypokalaemia, paradoxical bronchospasm; increased asthma mortality if used without ICS"),
        .init(name: "Formoterol (Eformoterol)", category: "Bronchodilator — LABA", commonDoses: "6–12 mcg BD inhaled; also used as PRN in asthma SMART regimes",                   route: "Inhaled", notes: "COPD/asthma maintenance; faster onset than salmeterol (also usable PRN); SMART therapy (with budesonide)", sideEffects: "Tremor, tachycardia, hypokalaemia, headache; similar cautions to salmeterol re: monotherapy in asthma"),
        .init(name: "Beclometasone (Clenil, QVAR)", category: "Inhaled Corticosteroid", commonDoses: "100–800 mcg BD (varies by device/indication)",                                 route: "Inhaled", notes: "Asthma controller; rinse mouth after use to prevent oral candidiasis; CFC vs HFA devices: dose NOT interchangeable", sideEffects: "Oral candidiasis, dysphonia, paradoxical bronchospasm, reduced growth velocity in children (high dose), adrenal suppression (very high dose)"),
        .init(name: "Fluticasone (Flixotide, Flovent)", category: "Inhaled Corticosteroid", commonDoses: "100–500 mcg BD",                                                            route: "Inhaled", notes: "Asthma controller (high-potency ICS); often used in combination (Seretide/Symbicort equivalent); rinse mouth", sideEffects: "Oral candidiasis, dysphonia, HPA suppression (higher systemic absorption than beclometasone), adrenal crisis (abrupt cessation)"),
        .init(name: "Budesonide (Pulmicort)", category: "Inhaled Corticosteroid / Nebulised Steroid", commonDoses: "200–1600 mcg BD inhaled; 1–2 mg nebulised BD–QDS (croup)",        route: "Inhaled/nebulised", notes: "Asthma/COPD controller; nebulised for croup in children; used in SMART therapy (with formoterol)", sideEffects: "Oral candidiasis, dysphonia, growth suppression (children), adrenal suppression (high dose)"),
        .init(name: "Montelukast (Singulair)", category: "Leukotriene Receptor Antagonist", commonDoses: "10 mg OD nocte (adult); 5 mg (6–14 yrs); 4 mg (2–5 yrs)",                  route: "PO", notes: "Asthma add-on; allergic rhinitis; aspirin-exacerbated respiratory disease; nocturnal symptoms", sideEffects: "Neuropsychiatric effects (depression, suicidal ideation — FDA black box); GI upset, headache, elevated LFTs"),
        .init(name: "Aminophylline",      category: "Bronchodilator — Xanthine", commonDoses: "5 mg/kg IV loading over 20 min (if not on theophylline); 0.5 mg/kg/h infusion",       route: "IV/PO", notes: "Severe acute asthma/COPD (IV); narrow therapeutic index; TDM required; multiple drug interactions", sideEffects: "Tachycardia, arrhythmia, seizures, nausea/vomiting, tremor; toxicity risk with erythromycin/ciprofloxacin"),
        .init(name: "N-acetylcysteine (Parvolex)", category: "Antidote / Mucolytic", commonDoses: "Paracetamol OD: 150 mg/kg IV over 1h → 50 mg/kg/4h → 100 mg/kg/16h; Mucolytic: 200 mg TDS PO", route: "IV/PO/nebulised", notes: "Paracetamol overdose antidote (first-line); COPD mucolytic; hepatic protection; contrast nephropathy prevention", sideEffects: "Anaphylactoid reaction (IV loading dose — stop, treat, restart at slower rate), nausea, flushing"),

        // ─── GI / HEPATIC — Additional ────────────────────────────────────────
        .init(name: "Esomeprazole (Nexium)", category: "PPI",                    commonDoses: "20–40 mg OD PO; 40–80 mg BD IV (active GI bleed)",                                    route: "PO/IV", notes: "GORD; peptic ulcer; GI bleed prophylaxis; co-prescribe with NSAIDs; H. pylori eradication", sideEffects: "Headache, GI upset, hypomagnesaemia (long-term), C. difficile, osteoporosis/fracture risk (long-term)"),
        .init(name: "Misoprostol",        category: "Prostaglandin / GI Cytoprotective", commonDoses: "200 mcg QDS (with NSAID); 200 mcg PR (labour induction/PPH); 400 mcg SL/vaginal", route: "PO/SL/vaginal/PR", notes: "GI cytoprotection with NSAIDs; cervical ripening; PPH treatment; medical management of miscarriage", sideEffects: "Diarrhoea, nausea, abdominal pain, uterine contractions/cramping, fever, shivering (prostaglandin effect)"),
        .init(name: "Ursodeoxycholic acid (UDCA)", category: "Hepatic Agent",   commonDoses: "8–15 mg/kg/day in 2–3 divided doses",                                                  route: "PO", notes: "Primary biliary cholangitis; gallstone dissolution; intrahepatic cholestasis of pregnancy; NAFLD", sideEffects: "Diarrhoea (especially at high doses), nausea, pruritus, hepatic decompensation (in decompensated cirrhosis)"),
        .init(name: "Mesalazine (5-ASA, Pentasa)", category: "GI Anti-inflammatory", commonDoses: "800 mg TDS (UC active); 400 mg TDS (maintenance)",                                route: "PO/PR", notes: "Ulcerative colitis (treatment and maintenance); Crohn's colitis; rectal preparations for distal disease", sideEffects: "GI upset, headache, hypersensitivity (rare — fever, rash), nephrotoxicity (monitor creatinine), interstitial nephritis"),
        .init(name: "Cholestyramine (Questran)", category: "Bile Acid Sequestrant", commonDoses: "4 g 1–6 times daily (before meals)",                                                route: "PO", notes: "Hypercholesterolaemia; cholestatic pruritus; C. difficile (alternative); take 1h before or 4h after other drugs", sideEffects: "Constipation (most common), flatulence, bloating, fat-soluble vitamin malabsorption (A, D, E, K), drug interactions"),
        .init(name: "Rifaximin",          category: "Antibiotic — GI Non-absorbable", commonDoses: "400 mg TDS (hepatic encephalopathy); 200 mg TDS (traveller's diarrhoea × 3 days)", route: "PO", notes: "Hepatic encephalopathy (with lactulose); prevention of recurrence; minimal systemic absorption", sideEffects: "GI upset (minimal), peripheral oedema; generally very well tolerated; theoretical C. difficile risk"),
        .init(name: "Octreotide",         category: "Somatostatin Analogue",    commonDoses: "50–200 mcg SC/IV TDS; 25–50 mcg/h IV infusion (variceal bleed)",                       route: "SC/IV", notes: "Variceal/oesophageal bleeding; VIPoma/carcinoid syndrome; acromegaly; acute pancreatitis; dump. syndrome post-GI surgery", sideEffects: "GI upset (diarrhoea, steatorrhoea, gallstones on long-term use), bradycardia, hyperglycaemia, injection-site pain"),
    ]

    private static let _drugs5: [SurgicalDrug] = [

        // ─── SEDATION / PSYCHIATRY / CNS ──────────────────────────────────────
        .init(name: "Diazepam",           category: "Benzodiazepine",           commonDoses: "2–10 mg BD–QDS PO; 5–10 mg IV (status epilepticus)",                                    route: "PO/IV/PR/IM", notes: "Anxiety; alcohol withdrawal (CIWA protocol); muscle relaxant; status epilepticus; procedural sedation", sideEffects: "Sedation, respiratory depression (with opioids), dependence (physical + psychological), tolerance, falls in elderly"),
        .init(name: "Lorazepam",          category: "Benzodiazepine",           commonDoses: "1–4 mg IV/IM (status epilepticus); 0.5–2 mg PO/SL (anxiety/pre-op)",                   route: "PO/IV/IM/SL", notes: "First-line for status epilepticus (IV); pre-operative anxiolysis; alcohol withdrawal; amnesic effect", sideEffects: "Respiratory depression (especially IV), sedation, amnesia, paradoxical agitation (elderly), dependence"),
        .init(name: "Temazepam",          category: "Benzodiazepine — Hypnotic", commonDoses: "10–20 mg at bedtime",                                                                  route: "PO", notes: "Short-term insomnia; pre-operative anxiolysis; short duration; avoid in elderly (falls, cognitive impairment)", sideEffects: "Sedation, hangover effect, confusion (elderly), dependence, rebound insomnia on withdrawal"),
        .init(name: "Zopiclone",          category: "Non-benzodiazepine Hypnotic (Z-drug)", commonDoses: "3.75–7.5 mg at bedtime (3.75 mg if elderly/hepatic impairment)",              route: "PO", notes: "Short-term insomnia; avoid long-term use (dependence); bitter metallic taste; avoid in sleep apnoea", sideEffects: "Bitter taste (very common), sedation, hangover, dependence, rebound insomnia, paradoxical agitation (rare)"),
        .init(name: "Zolpidem (Stilnoct)", category: "Non-benzodiazepine Hypnotic (Z-drug)", commonDoses: "5–10 mg at bedtime (5 mg if elderly)",                                      route: "PO", notes: "Short-term insomnia; complex sleep behaviours reported (sleep-driving); not recommended in elderly", sideEffects: "Next-day sedation, complex sleep behaviours (sleep-walking/-driving), dependence, amnesia, hallucinations"),
        .init(name: "Haloperidol",        category: "Antipsychotic — Typical",  commonDoses: "0.5–5 mg BD–TDS PO; 5–10 mg IM/IV (acute psychosis/agitation)",                         route: "PO/IM/IV", notes: "Acute psychosis; delirium; antiemetic (low dose 0.5–1 mg); Tourette's; palliative agitation", sideEffects: "EPS/akathisia/tardive dyskinesia, QTc prolongation (IV), NMS, drowsiness, postural hypotension, hyperprolactinaemia"),
        .init(name: "Olanzapine",         category: "Antipsychotic — Atypical", commonDoses: "5–20 mg OD; 5–10 mg IM (acute agitation)",                                               route: "PO/IM", notes: "Schizophrenia; bipolar mania; delirium; antiemetic (unlicensed, low dose); significant metabolic risk", sideEffects: "Weight gain (marked), metabolic syndrome, sedation, glucose dysregulation, EPS (less than typicals), QTc prolongation"),
        .init(name: "Quetiapine",         category: "Antipsychotic — Atypical", commonDoses: "25–800 mg OD–BD (schizophrenia); 25 mg nocte (delirium/off-label insomnia)",             route: "PO", notes: "Schizophrenia; bipolar; adjunct in depression; low-dose for delirium/insomnia (off-label); sedating at low doses", sideEffects: "Sedation, weight gain, metabolic syndrome, postural hypotension, QTc prolongation, cataracts (long-term — eye checks)"),
        .init(name: "Sertraline",         category: "Antidepressant — SSRI",    commonDoses: "50–200 mg OD (depression); 25–200 mg OD (OCD)",                                         route: "PO", notes: "Depression; OCD; PTSD; panic disorder; social anxiety; preferred SSRI in cardiac disease", sideEffects: "GI upset (nausea early), sexual dysfunction, insomnia/agitation initially, SIADH, serotonin syndrome (combinations), QTc (high dose)"),
        .init(name: "Fluoxetine (Prozac)", category: "Antidepressant — SSRI",   commonDoses: "20–60 mg OD (depression); 60 mg OD (bulimia)",                                           route: "PO", notes: "Depression; OCD; bulimia; long half-life (useful if adherence concern); CYP2D6 inhibitor", sideEffects: "GI upset, insomnia, sexual dysfunction, headache, serotonin syndrome, prolonged half-life (drug interactions persist longer)"),
        .init(name: "Citalopram",         category: "Antidepressant — SSRI",    commonDoses: "20–40 mg OD (max 20 mg if >65 yrs or hepatic impairment — QTc)",                        route: "PO", notes: "Depression; panic disorder; max 20 mg in elderly due to QTc risk; fewer drug interactions than fluoxetine", sideEffects: "GI upset, insomnia/sedation, sexual dysfunction, QTc prolongation (dose-dependent), SIADH, serotonin syndrome"),
        .init(name: "Escitalopram (Lexapro)", category: "Antidepressant — SSRI", commonDoses: "10–20 mg OD (max 10 mg if >65 yrs or hepatic impairment)",                              route: "PO", notes: "Depression; generalised anxiety disorder; S-enantiomer of citalopram; slightly better tolerability; QTc monitoring", sideEffects: "GI upset, insomnia, sexual dysfunction, QTc prolongation, SIADH, serotonin syndrome (with other serotonergic drugs)"),
        .init(name: "Venlafaxine (Efexor)", category: "Antidepressant — SNRI",  commonDoses: "75–375 mg OD (XR formulation); 37.5–225 mg BD (immediate release)",                     route: "PO", notes: "Depression; GAD; social anxiety; panic; pain conditions; discontinuation syndrome on abrupt cessation", sideEffects: "GI upset, hypertension (dose-related), tachycardia, sweating, sexual dysfunction, discontinuation syndrome, QTc"),
        .init(name: "Mirtazapine (Zispin)", category: "Antidepressant — NaSSA", commonDoses: "15–45 mg nocte",                                                                          route: "PO", notes: "Depression (especially with insomnia/poor appetite); antiemetic properties; weight gain; no sexual dysfunction", sideEffects: "Sedation (most at 15 mg — paradoxically less at higher doses), weight gain/increased appetite, agranulocytosis (rare), elevated cholesterol"),

        // ─── ANTICONVULSANTS ──────────────────────────────────────────────────
        .init(name: "Levetiracetam (Keppra)", category: "Anticonvulsant",       commonDoses: "500–3000 mg BD PO/IV",                                                                   route: "PO/IV", notes: "Focal and generalised epilepsy; status epilepticus (IV); no hepatic metabolism; few drug interactions", sideEffects: "Behavioural changes/irritability (most common, esp. in children), somnolence, headache, thrombocytopenia, psychosis"),
        .init(name: "Sodium Valproate (Epilim)", category: "Anticonvulsant / Mood Stabiliser", commonDoses: "200–2500 mg daily in 2 divided doses; target level 50–100 mg/L",       route: "PO/IV", notes: "Focal/generalised epilepsy; bipolar; migraine prophylaxis; AVOID in women of childbearing potential (teratogen)", sideEffects: "Hepatotoxicity (especially <2 yrs), pancreatitis, thrombocytopenia, weight gain, hair loss, tremor, PCOS, teratogen (spina bifida, neurodevelopmental)"),
        .init(name: "Carbamazepine (Tegretol)", category: "Anticonvulsant / Mood Stabiliser", commonDoses: "100–1800 mg daily in 2–3 divided doses; target level 4–12 mg/L",          route: "PO", notes: "Focal epilepsy; trigeminal neuralgia; bipolar disorder (off-label); auto-inducer (reduces own levels); many CYP interactions", sideEffects: "Drowsiness, diplopia, ataxia, rash (SJS risk — HLA-B*1502 screen in Han Chinese), hyponatraemia, agranulocytosis/aplastic anaemia, many drug interactions"),
        .init(name: "Phenytoin (Dilantin, Epanutin)", category: "Anticonvulsant", commonDoses: "150–300 mg nocte PO (TDM essential; target 10–20 mg/L); 15–18 mg/kg IV (loading, STATUS)", route: "PO/IV", notes: "Status epilepticus (IV with ECG monitoring); focal epilepsy; zero-order (saturable) kinetics — small dose change → large level change", sideEffects: "Gingival hyperplasia, hirsutism, acne, cerebellar atrophy (long-term), osteoporosis, SJS, nystagmus/ataxia (toxicity), arrhythmia (rapid IV)"),
        .init(name: "Lamotrigine (Lamictal)", category: "Anticonvulsant / Mood Stabiliser", commonDoses: "25–500 mg OD–BD (titrate slowly to reduce SJS risk; faster if on valproate)",route: "PO", notes: "Focal/generalised epilepsy; bipolar disorder; slow titration mandatory; OCP reduces levels; valproate doubles levels", sideEffects: "Rash (SJS/DRESS — slow titration reduces risk), headache, dizziness, diplopia, insomnia, tremor, blood dyscrasias"),
        .init(name: "Clonazepam (Rivotril)", category: "Benzodiazepine / Anticonvulsant", commonDoses: "0.5–20 mg/day in divided doses; 0.5–1 mg slow IV (status epilepticus)",       route: "PO/IV/IM/SL", notes: "Epilepsy; status epilepticus; myoclonic jerks; panic disorder; restless legs syndrome", sideEffects: "Sedation, ataxia, cognitive impairment, tolerance, dependence, respiratory depression (IV), paradoxical agitation"),

        // ─── MUSCULOSKELETAL / RHEUMATOLOGY ───────────────────────────────────
        .init(name: "Naproxen",           category: "NSAID",                    commonDoses: "250–500 mg BD (max 1250 mg/day)",                                                         route: "PO", notes: "Pain/inflammation; cardiovascular neutral NSAID (vs. other selective NSAIDs); protect GI with PPI", sideEffects: "GI irritation/ulceration, renal impairment, fluid retention, CVS risk (lower than some NSAIDs), hepatotoxicity"),
        .init(name: "Meloxicam (Mobic)",  category: "NSAID — COX-2 preferential", commonDoses: "7.5–15 mg OD",                                                                         route: "PO/IM", notes: "OA/RA/ankylosing spondylitis; preferentially COX-2 (reduced GI side effects vs non-selective); avoid in renal impairment", sideEffects: "GI upset (less than non-selective NSAIDs), fluid retention, renal impairment, cardiovascular risk"),
        .init(name: "Allopurinol (Zyloric)", category: "Uricosuric / XO Inhibitor", commonDoses: "100 mg OD initially (titrate to 300–900 mg/day); START 2–4 weeks after acute gout resolves", route: "PO", notes: "Gout prevention; never start during acute attack (worsens); may worsen acute attack initially — cover with colchicine", sideEffects: "SJS/TEN/DRESS (especially HLA-B*5801 — screen in Han Chinese/Thai); rash, GI upset, hepatotoxicity, allopurinol hypersensitivity syndrome"),
        .init(name: "Colchicine",         category: "Anti-gout",                commonDoses: "500 mcg BD–TDS (acute gout, max 3 days); 500 mcg OD–BD (prophylaxis)",                  route: "PO", notes: "Acute gout; gout prophylaxis when starting allopurinol; familial Mediterranean fever; pericarditis", sideEffects: "Diarrhoea/nausea (dose-limiting, very common), myopathy, peripheral neuropathy, bone marrow suppression (overdose is fatal — narrow TI)"),
        .init(name: "Hydroxychloroquine (Plaquenil)", category: "DMARD / Antimalarial", commonDoses: "200–400 mg OD (max 5 mg/kg/day — retinal toxicity)",                             route: "PO", notes: "SLE; RA; Sjögren's; malaria prophylaxis; anti-inflammatory; annual ophthalmology review for retinopathy", sideEffects: "Retinal toxicity (cumulative dose — annual screening mandatory), GI upset, rash, headache, QTc prolongation"),
        .init(name: "Methotrexate (MTX)", category: "DMARD / Antimetabolite",   commonDoses: "7.5–25 mg ONCE weekly PO/IM/SC (NOT daily — fatal error)",                               route: "PO/IM/SC", notes: "RA; psoriatic arthritis; Crohn's; ectopic pregnancy; ONCE WEEKLY only — daily dosing is fatal; give folic acid 5 mg/week", sideEffects: "Hepatotoxicity (monitor LFTs), pulmonary fibrosis, bone marrow suppression, mucositis, nausea, teratogen; WEEKLY DOSE — daily is fatal"),
        .init(name: "Sulfasalazine (Salazopyrin)", category: "DMARD / Anti-inflammatory", commonDoses: "500 mg OD initially, increase to 1–2 g BD–TDS over 4 weeks",                 route: "PO", notes: "RA; ankylosing spondylitis; ulcerative colitis; slow-acting DMARD (3–6 months for effect); sulfa component", sideEffects: "GI upset (enteric-coated formulation), rash, headache, male infertility (reversible), agranulocytosis, hepatotoxicity, orange urine"),

        // ─── DIABETES — Additional Agents ─────────────────────────────────────
        .init(name: "Insulin aspart (NovoRapid)", category: "Insulin — Rapid-acting", commonDoses: "Individualized SC; inject 0–15 min before meals; usually 4–20 units per meal",   route: "SC/IV", notes: "Mealtime insulin; rapid onset (15 min), peak 1–3h, duration 3–5h; can be used in CSII/pump therapy", sideEffects: "Hypoglycaemia (most common), weight gain, lipodystrophy at injection sites, local reactions"),
        .init(name: "Insulin lispro (Humalog)", category: "Insulin — Rapid-acting",  commonDoses: "Individualized SC; inject 0–15 min before meals",                                   route: "SC/IV", notes: "Mealtime insulin; similar profile to aspart; alternative rapid-acting insulin option", sideEffects: "Hypoglycaemia, weight gain, lipodystrophy, local injection-site reactions"),
        .init(name: "Insulin NPH (Humulin I, Insulatard)", category: "Insulin — Intermediate-acting", commonDoses: "Individualized SC; usually BD (morning + evening)",               route: "SC", notes: "Intermediate-acting background insulin; cloudy suspension — must be mixed before use; twice-daily dosing", sideEffects: "Nocturnal hypoglycaemia (if evening dose too high), weight gain, lipodystrophy, variable absorption"),
        .init(name: "Empagliflozin (Jardiance)", category: "Antidiabetic — SGLT2 inhibitor", commonDoses: "10–25 mg OD (with or without food)",                                        route: "PO", notes: "T2DM; HFrEF (independent of diabetes — 10 mg OD); CKD protection; cardiovascular mortality benefit; HOLD peri-op (DKA risk)", sideEffects: "Genital mycotic infections (very common), UTI, polyuria, euglycaemic DKA (especially peri-op — stop 3–5 days before surgery), Fournier's gangrene (rare)"),
        .init(name: "Dapagliflozin (Forxiga)", category: "Antidiabetic — SGLT2 inhibitor", commonDoses: "10 mg OD",                                                                    route: "PO", notes: "T2DM; HFrEF; CKD; similar benefits to empagliflozin; HOLD peri-operatively (euglycaemic DKA risk)", sideEffects: "Genital mycotic infections, UTI, polyuria, euglycaemic DKA (peri-op — stop 3–5 days before surgery), Fournier's gangrene (rare)"),
        .init(name: "Sitagliptin (Januvia)", category: "Antidiabetic — DPP-4 inhibitor", commonDoses: "100 mg OD (adjust for renal impairment: 50 mg if eGFR 30–45; 25 mg if <30)",  route: "PO", notes: "T2DM; well tolerated; weight neutral; adjust dose in renal impairment; small pancreatitis signal", sideEffects: "Upper respiratory tract infection, nasopharyngitis, pancreatitis (rare), joint pain (rare), hypoglycaemia (only if combined with insulin/sulphonylurea)"),
        .init(name: "Semaglutide (Ozempic/Rybelsus/Wegovy)", category: "Antidiabetic / Anti-obesity — GLP-1 agonist", commonDoses: "0.25–1 mg SC weekly (T2DM); 2.4 mg SC weekly (obesity); 3–14 mg PO OD", route: "SC/PO", notes: "T2DM; obesity; cardiovascular risk reduction; significant weight loss; HOLD week before surgery (aspiration risk)", sideEffects: "Nausea/vomiting/diarrhoea (very common, especially initially), pancreatitis, gallstones, thyroid C-cell tumours (rodents — human significance unclear)"),
        .init(name: "Liraglutide (Victoza/Saxenda)", category: "Antidiabetic / Anti-obesity — GLP-1 agonist", commonDoses: "0.6–1.8 mg SC OD (T2DM); 3 mg OD (obesity)",                route: "SC", notes: "T2DM; obesity; cardiovascular risk reduction; HOLD before surgery; once-daily SC injection", sideEffects: "Nausea, vomiting, diarrhoea, pancreatitis (rare), gallstones, injection-site reactions, thyroid tumours (rodent data)"),
        .init(name: "Pioglitazone (Actos)", category: "Antidiabetic — Thiazolidinedione", commonDoses: "15–45 mg OD",                                                                  route: "PO", notes: "T2DM; NASH (fatty liver, off-label); NOT for bladder cancer risk patients or heart failure; weight gain expected", sideEffects: "Fluid retention/oedema (avoid in HF), weight gain, fracture risk (especially women), bladder cancer signal, hepatotoxicity (rare)"),

        // ─── UROLOGY ──────────────────────────────────────────────────────────
        .init(name: "Tamsulosin (Flomax)", category: "Alpha-blocker — Uroselective", commonDoses: "400 mcg OD (30 min after same meal daily)",                                          route: "PO", notes: "BPH lower urinary tract symptoms; alpha-1a selective; warn about intraoperative floppy iris syndrome (IFIS) before cataract surgery", sideEffects: "Retrograde ejaculation (most common), orthostatic hypotension (less than non-selective), IFIS (cataract surgery), dizziness, rhinitis"),
        .init(name: "Finasteride (Proscar, Propecia)", category: "5-alpha-Reductase Inhibitor", commonDoses: "5 mg OD (BPH); 1 mg OD (male pattern baldness)",                        route: "PO", notes: "BPH (reduces prostate volume over 3–6 months); male pattern alopecia; affects PSA (halves PSA — double value for interpretation)", sideEffects: "Sexual dysfunction (impotence, reduced libido, ejaculatory dysfunction — may be irreversible), gynaecomastia, post-finasteride syndrome (contested), PSA reduction"),
        .init(name: "Dutasteride (Avodart)", category: "5-alpha-Reductase Inhibitor", commonDoses: "500 mcg OD",                                                                        route: "PO", notes: "BPH (dual 5-AR inhibitor — more complete DHT suppression than finasteride); reduces PSA by ~50%", sideEffects: "Sexual dysfunction, gynaecomastia, reduced ejaculate volume; stored in fat — levels persist months after stopping"),
        .init(name: "Oxybutynin (Ditropan)", category: "Anticholinergic / Bladder Antispasmodic", commonDoses: "2.5–5 mg BD–TDS PO; 3.9 mg/day transdermal patch",                   route: "PO/transdermal", notes: "Overactive bladder/urge incontinence; antimuscarinic; significant anticholinergic burden — avoid in elderly if possible", sideEffects: "Dry mouth, constipation, urinary retention, blurred vision, confusion (high anticholinergic burden), heat intolerance"),
        .init(name: "Mirabegron (Betmiga)", category: "Beta-3 Agonist — Bladder",    commonDoses: "25–50 mg OD",                                                                        route: "PO", notes: "Overactive bladder/urge incontinence; alternative to antimuscarinics; avoid in uncontrolled hypertension", sideEffects: "Hypertension (modest), tachycardia, urinary retention (rare), nasopharyngitis, UTI; generally better tolerated than oxybutynin"),

        // ─── ANTIHISTAMINES / ALLERGY ─────────────────────────────────────────
        .init(name: "Chlorphenamine (Piriton)", category: "Antihistamine — First Generation", commonDoses: "4 mg QDS PO; 10–20 mg IV/IM (anaphylaxis adjunct)",                        route: "PO/IV/IM", notes: "Allergic reactions; anaphylaxis (adjunct to adrenaline); urticaria; pre-medication; sedating", sideEffects: "Sedation (significant), antimuscarinic effects (dry mouth, urinary retention), paradoxical excitation (children)"),
        .init(name: "Cetirizine (Zyrtec)", category: "Antihistamine — Second Generation", commonDoses: "10 mg OD",                                                                      route: "PO", notes: "Allergic rhinitis; urticaria; chronic pruritus; low sedation; once-daily dosing; mild sedation vs loratadine", sideEffects: "Mild sedation (more than loratadine, less than first-generation), dry mouth, headache, dizziness"),
        .init(name: "Loratadine (Claritin)", category: "Antihistamine — Second Generation", commonDoses: "10 mg OD",                                                                    route: "PO", notes: "Allergic rhinitis; urticaria; non-sedating; safe in pilots/drivers; least sedating oral antihistamine", sideEffects: "Headache, dry mouth; minimal sedation; generally well tolerated"),
        .init(name: "Fexofenadine (Telfast)", category: "Antihistamine — Second Generation", commonDoses: "120 mg OD (rhinitis); 180 mg OD (urticaria)",                                route: "PO", notes: "Allergic rhinitis; chronic urticaria; non-sedating; does not cross BBB significantly; safe in occupational settings", sideEffects: "Headache, nausea, dizziness; essentially non-sedating; avoid grapefruit/apple juice (reduces absorption)"),
        .init(name: "Promethazine (Phenergan)", category: "Antihistamine / Antiemetic — First Generation", commonDoses: "12.5–25 mg PO/IM/PR; 25 mg IV (slow)",                        route: "PO/IM/PR/IV", notes: "Antiemetic; sedation; allergic conditions; pre-medication; motion sickness; avoid IV (caustic — risk of gangrene)", sideEffects: "Sedation (profound), antimuscarinic effects, respiratory depression (children <2), paradoxical agitation; avoid IV injection — tissue necrosis"),

        // ─── IMMUNOSUPPRESSANTS ────────────────────────────────────────────────
        .init(name: "Azathioprine (Imuran)", category: "Immunosuppressant — Antimetabolite", commonDoses: "1–3 mg/kg OD",                                                               route: "PO", notes: "Organ transplant rejection; autoimmune disease (SLE, IBD, myasthenia gravis); check TPMT before starting (toxicity risk)", sideEffects: "Myelosuppression (dose-related), nausea/GI upset, hepatotoxicity, pancreatitis, malignancy risk (lymphoma), TPMT deficiency → severe toxicity"),
        .init(name: "Ciclosporin (Cyclosporine)", category: "Immunosuppressant — Calcineurin inhibitor", commonDoses: "2.5–15 mg/kg/day in 2 divided doses (TDM-guided; target trough 100–400 ng/mL)", route: "PO/IV", notes: "Solid organ transplant; autoimmune diseases (psoriasis, RA); nephrotoxicity limits long-term use; many CYP3A4/P-gp interactions", sideEffects: "Nephrotoxicity (cumulative, dose-related), hypertension, hypertrichosis, gingival hyperplasia, tremor, neurotoxicity, hyperlipidaemia, diabetes"),
        .init(name: "Tacrolimus (Prograf, Advagraf)", category: "Immunosuppressant — Calcineurin inhibitor", commonDoses: "0.1–0.3 mg/kg/day in 2 divided doses (TDM; target trough 5–15 ng/mL)", route: "PO/IV", notes: "Transplant rejection (superior to ciclosporin in most transplants); topical for atopic dermatitis; many drug interactions", sideEffects: "Nephrotoxicity, neurotoxicity (tremor, headache), diabetes (more than ciclosporin), hypertension, GI upset, alopecia, PTLD/malignancy"),
        .init(name: "Mycophenolate mofetil (CellCept)", category: "Immunosuppressant — Antimetabolite", commonDoses: "1–1.5 g BD (transplant); 500 mg–1 g BD (autoimmune)",            route: "PO/IV", notes: "Transplant (with ciclosporin/tacrolimus); lupus nephritis; myasthenia gravis; teratogen — contraception mandatory", sideEffects: "GI upset (diarrhoea, nausea, vomiting — very common), bone marrow suppression, PML risk, teratogenicity (Category D — contraception required)"),
        .init(name: "Infliximab (Remicade)", category: "Immunosuppressant — Anti-TNF (biologic)", commonDoses: "5 mg/kg IV at 0, 2, 6 weeks, then every 8 weeks",                     route: "IV infusion", notes: "Crohn's disease; ulcerative colitis; RA; psoriatic arthritis; screen for TB and hepatitis B before starting", sideEffects: "Infusion reactions, serious infections (reactivation TB — ALWAYS screen), demyelination, congestive heart failure, lymphoma, lupus-like syndrome, antibody formation"),

        // ─── IV IRON / HAEMATINICS ─────────────────────────────────────────────
        .init(name: "Ferric carboxymaltose (Ferinject)", category: "IV Iron",    commonDoses: "500–1000 mg IV over 15 min (max 20 mg/kg/dose); repeat in 7 days if needed",             route: "IV", notes: "Iron deficiency anaemia when PO intolerant/inadequate; pre-op optimisation; CKD; inflammatory bowel disease", sideEffects: "Hypophosphataemia (common, monitor in high-dose regimens), flushing, hypotension, nausea, anaphylaxis (rare — test dose not required)"),
        .init(name: "Iron sucrose (Venofer)",   category: "IV Iron",             commonDoses: "200 mg IV over 15–30 min; 2–3 times per week",                                           route: "IV", notes: "Iron deficiency in CKD; pre-op anaemia; dialysis patients; more frequent administration than ferric carboxymaltose", sideEffects: "Nausea, hypotension, muscle cramps, hypersensitivity reactions, flushing; anaphylaxis (rare)"),

        // ─── BLOOD PRODUCTS / COAGULATION ─────────────────────────────────────
        .init(name: "Tranexamic acid (Cyklokapron)", category: "Antifibrinolytic", commonDoses: "1 g IV over 10 min (trauma — within 3h); 15–25 mg/kg TDS PO/IV",                       route: "PO/IV/topical", notes: "Major haemorrhage; trauma (CRASH-2 trial); surgical blood loss; menorrhagia; post-partum haemorrhage", sideEffects: "Nausea, diarrhoea, thromboembolic risk (seizures at high IV doses — do not exceed 1 g bolus), colour vision changes"),
        .init(name: "Phytomenadione (Vitamin K1)", category: "Coagulation Factor / Antidote", commonDoses: "1–5 mg IV slow (INR reversal); 10 mg IV (life-threatening bleed); 5–10 mg PO",route: "PO/IV/SC", notes: "Warfarin reversal; Vitamin K deficiency; IV onset 6–12h (full effect); PO takes 12–24h; not for dabigatran/rivaroxaban", sideEffects: "Anaphylaxis (IV — give slowly, dilute); PO/SC generally safe; over-correction locks patient into warfarin resistance for weeks"),
        .init(name: "Prothrombin Complex Concentrate (Beriplex/Octaplex)", category: "Clotting Factor Concentrate", commonDoses: "25–50 units/kg IV (weight and INR guided)",           route: "IV", notes: "Urgent warfarin/VKA reversal; major bleeding; factor replacement; faster reversal than FFP", sideEffects: "Thrombotic events (arterial/venous), DIC (rare), anaphylaxis; monitor INR after administration"),
        .init(name: "Desmopressin (DDAVP)",   category: "Vasopressin Analogue / Haemostatic", commonDoses: "0.3 mcg/kg IV/SC; 150–300 mcg intranasal",                                  route: "IV/SC/intranasal", notes: "Mild haemophilia A / vWD type 1 (test response first); uremic bleeding; central DI; nocturia (intranasal)", sideEffects: "Hyponatraemia/water retention (restrict fluids), facial flushing, tachycardia, headache, hypertension; tachyphylaxis with repeated doses"),

        // ─── EMERGENCY / CRITICAL CARE ────────────────────────────────────────
        .init(name: "Mannitol 20%",       category: "Osmotic Diuretic",          commonDoses: "0.25–1 g/kg IV over 15–30 min",                                                           route: "IV", notes: "Raised ICP (head injury/stroke); cerebral oedema; acute glaucoma; renal protection (controversial)", sideEffects: "Acute renal failure (high dose), fluid overload/pulmonary oedema (rebound), electrolyte disturbances, rebound ICP rise"),
        .init(name: "Alteplase (tPA, Actilyse)", category: "Thrombolytic",       commonDoses: "0.9 mg/kg IV (max 90 mg) for ischaemic stroke; STEMI regimen: 15 mg bolus + infusion", route: "IV", notes: "Acute ischaemic stroke (within 4.5h); STEMI; massive PE; central line occlusion (2 mg intraluminally)", sideEffects: "Intracranial haemorrhage (major risk in stroke), systemic bleeding, anaphylaxis, angioedema (especially with ACE inhibitor)"),
        .init(name: "Hydrocortisone (emergency dose)", category: "Corticosteroid — IV Emergency", commonDoses: "100–200 mg IV (septic shock/adrenal crisis); 50–100 mg QDS IV (severe illness)", route: "IV/IM", notes: "Adrenal crisis; Addisonian crisis; refractory septic shock (adjunct, if on chronic steroids or suspected AI); peri-op steroid cover", sideEffects: "Hyperglycaemia, hypertension, hypokalaemia, immunosuppression, GI haemorrhage (with NSAIDs), fluid retention"),
        .init(name: "Sildenafil (Viagra, Revatio)", category: "PDE5 Inhibitor",  commonDoses: "25–100 mg PRN (erectile dysfunction, 1h before); 20 mg TDS (pulmonary hypertension)",   route: "PO", notes: "Erectile dysfunction; pulmonary arterial hypertension (Revatio); ABSOLUTE CONTRAINDICATION with nitrates (severe hypotension)", sideEffects: "Headache, flushing, dyspepsia, visual disturbances (blue-tinged vision), hypotension (especially with nitrates/alpha-blockers), priapism"),
        .init(name: "Tadalafil (Cialis)",  category: "PDE5 Inhibitor",           commonDoses: "10–20 mg PRN (ED); 5 mg OD (BPH/daily ED); 40 mg OD (pulmonary hypertension)",          route: "PO", notes: "Erectile dysfunction; BPH (5 mg OD); pulmonary hypertension; longest duration (36h — 'weekend pill'); ABSOLUTE contraindication with nitrates", sideEffects: "Headache, myalgia/back pain (characteristic of tadalafil), flushing, dyspepsia, hypotension (with nitrates — absolute CI), visual disturbances"),
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
