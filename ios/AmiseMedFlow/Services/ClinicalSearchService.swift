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
    var contraindications: String = ""
    var renalDosing: String = ""
    var hepaticDosing: String = ""
    var monitoring: String = ""

    static func search(_ query: String) -> [SurgicalDrug] {
        guard query.count >= 1 else { return [] }
        let q = query.lowercased()
        let formularyHits = allDrugs.filter {
            $0.name.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }
        let formularyNames = Set(formularyHits.map { $0.name.lowercased() })
        let customHits = CustomDrugStore.shared.asDrugs.filter {
            $0.name.lowercased().contains(q) && !formularyNames.contains($0.name.lowercased())
        }
        return (formularyHits + customHits).prefix(20).map { $0 }
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
        _drugs1 + _drugs2 + _drugs3 + _drugs4 + _drugs5 + _drugs6 + _drugs7 + _drugs8 + _drugs9

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

    private static let _drugs6: [SurgicalDrug] = [

        // ─── BONE HEALTH / OSTEOPOROSIS ───────────────────────────────────────
        .init(name: "Alendronate (Fosamax)", category: "Bisphosphonate",
              commonDoses: "70 mg once weekly PO (osteoporosis); 10 mg OD (Paget's)",
              route: "PO",
              notes: "Take fasting with full glass of water; remain upright ≥30 min post-dose; dental review before starting",
              sideEffects: "Oesophageal ulceration/oesophagitis, musculoskeletal pain, osteonecrosis of jaw (ONJ), atypical femoral fracture (long-term)",
              contraindications: "Oesophageal stricture/achalasia, inability to sit/stand upright for 30 min, hypocalcaemia, eGFR <35 mL/min",
              renalDosing: "Avoid if eGFR <35 mL/min — risk of renal toxicity and bisphosphonate accumulation",
              hepaticDosing: "No dose adjustment required (not hepatically metabolised)",
              monitoring: "Dental review before starting; correct hypocalcaemia/vitamin D deficiency first; BMD (DEXA) every 1–2 years; renal function before starting"),

        .init(name: "Risedronate (Actonel)", category: "Bisphosphonate",
              commonDoses: "35 mg once weekly PO; 5 mg OD",
              route: "PO",
              notes: "As per alendronate (upright 30 min post-dose, fasting); alternative if GI intolerance to alendronate",
              sideEffects: "Oesophageal/GI irritation (less than alendronate), musculoskeletal pain, ONJ, atypical femoral fracture",
              contraindications: "Oesophageal disorders, inability to remain upright 30 min, hypocalcaemia, eGFR <30 mL/min",
              renalDosing: "Avoid if eGFR <30 mL/min",
              hepaticDosing: "No adjustment needed",
              monitoring: "Dental review; correct vitamin D/calcium deficiency; BMD monitoring; renal function"),

        .init(name: "Zoledronic acid (Aclasta/Zometa)", category: "Bisphosphonate — IV",
              commonDoses: "5 mg IV over ≥15 min once yearly (osteoporosis); 4 mg IV q3–4 weeks (bone mets/hypercalcaemia)",
              route: "IV infusion",
              notes: "Annual IV dosing for osteoporosis (superior adherence); potent; pre-hydrate; fracture prevention in Paget's disease",
              sideEffects: "Acute-phase reaction (flu-like: fever, myalgia — first dose, 24–72h, treat with paracetamol); ONJ; atypical femoral fracture; hypocalcaemia; renal toxicity",
              contraindications: "eGFR <35 mL/min (osteoporosis indication); hypocalcaemia; pregnancy",
              renalDosing: "Avoid if eGFR <35 mL/min for osteoporosis; oncology use requires dose reduction (consult SPC)",
              hepaticDosing: "No hepatic dose adjustment",
              monitoring: "Renal function, calcium/phosphate, FBC before each dose; dental review before starting; calcium + vitamin D supplementation required"),

        .init(name: "Denosumab (Prolia/Xgeva)", category: "RANK-L Inhibitor — Bone",
              commonDoses: "60 mg SC every 6 months (osteoporosis — Prolia); 120 mg SC every 4 weeks (bone mets — Xgeva)",
              route: "SC",
              notes: "No renal dose adjustment needed (unlike bisphosphonates); reversal of bone loss on discontinuation — switch to bisphosphonate before stopping",
              sideEffects: "Hypocalcaemia (risk with renal impairment — supplement calcium/D3), ONJ, atypical femoral fracture, serious infections (cellulitis), back pain, rebound vertebral fractures on discontinuation",
              contraindications: "Hypocalcaemia (correct before starting); pregnancy; known hypersensitivity",
              renalDosing: "No dose adjustment required; however, severe CKD (eGFR <30) has HIGH risk of hypocalcaemia — monitor calcium closely and supplement",
              hepaticDosing: "No hepatic metabolism; no dose adjustment",
              monitoring: "Calcium and vitamin D levels before each injection and after (especially in renal impairment); dental review before starting; BMD at 2 years"),

        .init(name: "Calcium carbonate + D3 (Adcal-D3)", category: "Calcium / Vitamin D Supplement",
              commonDoses: "2 tablets BD (1500 mg calcium carbonate = 600 mg elemental Ca, 400 IU D3)",
              route: "PO (chewable)",
              notes: "Bone health supplementation; co-prescribe with bisphosphonates/denosumab; take with meals (PO absorption); separate from levothyroxine by ≥4h",
              sideEffects: "Constipation, nausea, flatulence, hypercalcaemia in excess; milk-alkali syndrome (high-dose prolonged use)",
              contraindications: "Hypercalcaemia, hypercalciuria (calcium oxalate nephrolithiasis risk), sarcoidosis, vitamin D toxicity",
              renalDosing: "Use with caution in CKD — calcium load may worsen vascular calcification; monitor calcium; activated vitamin D (alfacalcidol) preferred in eGFR <30",
              hepaticDosing: "No hepatic adjustment needed",
              monitoring: "Serum calcium (avoid hypercalcaemia); urine calcium if long-term high-dose"),

        // ─── UTI / LOWER URINARY TRACT ANTIBIOTICS ────────────────────────────
        .init(name: "Nitrofurantoin (Macrobid)", category: "Antibiotic — Urinary",
              commonDoses: "50–100 mg QDS × 7 days (treatment); 50–100 mg nocte (prophylaxis)",
              route: "PO",
              notes: "Lower UTI only (achieves urinary but NOT tissue concentrations — not for pyelonephritis); take with food; urine turns brown",
              sideEffects: "Nausea (take with food), pulmonary reactions (acute pneumonitis or chronic fibrosis — prolonged use), peripheral neuropathy, hepatotoxicity, brown urine discolouration",
              contraindications: "eGFR <45 mL/min (inadequate urinary concentrations, accumulates systemically); G6PD deficiency; neonates <3 months",
              renalDosing: "AVOID if eGFR <45 mL/min — no urinary efficacy and systemic accumulation increases toxicity risk",
              hepaticDosing: "Use with caution in hepatic disease (hepatotoxicity risk); avoid in severe hepatic impairment",
              monitoring: "LFTs and CXR if pulmonary symptoms during long-term use; renal function before prescribing"),

        .init(name: "Trimethoprim", category: "Antibiotic — Urinary",
              commonDoses: "200 mg BD × 7 days (treatment); 100 mg nocte (prophylaxis)",
              route: "PO",
              notes: "Lower UTI; avoid in first trimester (folate antagonist); resistance now ~20–30% in many regions — check local sensitivities",
              sideEffects: "GI upset, rash, hyperkalaemia (blocks tubular potassium secretion — risk with ACE inhibitors/ARBs/potassium-sparing diuretics), raised creatinine (inhibits tubular secretion, not true renal impairment), megaloblastic anaemia (prolonged use)",
              contraindications: "First trimester pregnancy (folate antagonist); concurrent methotrexate; severe renal impairment",
              renalDosing: "eGFR 15–30: use half dose. eGFR <15: avoid. Monitor potassium if combined with ACE inhibitor/ARB",
              hepaticDosing: "No dose adjustment required",
              monitoring: "U&E if on ACE inhibitor/ARB (hyperkalaemia); FBC for prolonged courses"),

        .init(name: "Fosfomycin (Monurol)", category: "Antibiotic — Urinary",
              commonDoses: "3 g oral granules single dose (uncomplicated UTI); 8 g IV TDS (complicated/systemic)",
              route: "PO/IV",
              notes: "Single-dose convenience for uncomplicated UTI in women; active against ESBL-producing E. coli and MRSA (IV use); IV for complicated/resistant UTI",
              sideEffects: "Diarrhoea (oral), nausea, headache; IV: hyponatraemia, hypokalaemia (contains sodium), elevated LFTs",
              contraindications: "Severe renal impairment (oral single-dose: eGFR <10); known hypersensitivity",
              renalDosing: "Oral single dose: avoid if eGFR <10. IV: dose reduction required in CKD — adjust to renal function per SPC",
              hepaticDosing: "No dose adjustment for oral; caution with IV in hepatic impairment (monitor LFTs)",
              monitoring: "No routine monitoring for single oral dose; IV: U&E (sodium, potassium), LFTs, cultures"),

        // ─── ANTISPASMODICS ───────────────────────────────────────────────────
        .init(name: "Hyoscine butylbromide (Buscopan)", category: "Antispasmodic",
              commonDoses: "10–20 mg QDS PO; 20 mg IV/IM (acute spasm)",
              route: "PO/IV/IM",
              notes: "Smooth muscle spasm (IBS, biliary colic, ureteric colic, post-op); does NOT cross BBB (quaternary amine — no CNS sedation); IV onset immediate",
              sideEffects: "Dry mouth, tachycardia, urinary retention, constipation, blurred vision (antimuscarinic); minimal CNS effects (unlike hyoscine hydrobromide)",
              contraindications: "Myasthenia gravis, paralytic ileus, megacolon, narrow-angle glaucoma, tachyarrhythmia, urinary retention (BPH)",
              renalDosing: "No dose adjustment needed",
              hepaticDosing: "No dose adjustment needed",
              monitoring: "HR (IV use can cause tachycardia); symptom response"),

        .init(name: "Mebeverine (Colofac)", category: "Antispasmodic — Direct",
              commonDoses: "135 mg TDS (20 min before meals); 200 mg BD (prolonged-release)",
              route: "PO",
              notes: "IBS abdominal cramping; selective smooth muscle relaxant (no antimuscarinic side effects — useful in elderly, BPH, glaucoma)",
              sideEffects: "Generally very well tolerated; rare: allergic reactions (rash, urticaria, angioedema); no antimuscarinic effects",
              contraindications: "Paralytic ileus; known hypersensitivity",
              renalDosing: "No adjustment required",
              hepaticDosing: "No adjustment required",
              monitoring: "Clinical response — no laboratory monitoring needed"),

        // ─── TOPICAL STEROIDS ─────────────────────────────────────────────────
        .init(name: "Hydrocortisone 1% cream", category: "Topical Corticosteroid — Mild",
              commonDoses: "Apply sparingly BD–QDS; thin layer",
              route: "Topical",
              notes: "Mild potency — safe for face, flexures, infants; eczema, contact/seborrhoeic dermatitis, insect bites; limit to 1–2 weeks on face",
              sideEffects: "Skin atrophy, striae, telangiectasias, perioral dermatitis (prolonged facial use), acneiform eruption, systemic absorption (extensive/occluded sites), adrenal suppression (rare)",
              contraindications: "Infected skin (apply only after treating infection); rosacea; peri-orbital (glaucoma risk); varicella/herpes simplex",
              renalDosing: "Not applicable (topical)",
              hepaticDosing: "Not applicable (topical)",
              monitoring: "Assess for skin atrophy with prolonged use; no lab monitoring for mild potency topicals"),

        .init(name: "Betamethasone valerate 0.1% (Betnovate)", category: "Topical Corticosteroid — Potent",
              commonDoses: "Apply sparingly OD–BD; thin layer; limit duration",
              route: "Topical",
              notes: "Potent topical steroid; eczema (not face), psoriasis, lichen planus; avoid face and flexures; fingertip unit (FTU) for dosing",
              sideEffects: "Skin atrophy, striae, telangiectasias, perioral dermatitis (if used on face), tachyphylaxis, HPA suppression (large surface areas/occlusion), secondary infection",
              contraindications: "Infected skin, rosacea, acne vulgaris, perioral dermatitis, face/flexures (long-term), nappy area in infants",
              renalDosing: "Not applicable (topical)",
              hepaticDosing: "Not applicable (topical)",
              monitoring: "Weigh risks of prolonged use against benefits; no lab monitoring for appropriate topical use"),

        .init(name: "Clobetasol propionate 0.05% (Dermovate)", category: "Topical Corticosteroid — Very Potent",
              commonDoses: "Apply sparingly OD–BD; maximum 2 weeks; maximum 50 g/week",
              route: "Topical",
              notes: "Very potent — reserve for severe/resistant eczema, psoriasis, lichen sclerosus; AVOID on face; max 50 g/week; step down to lower potency as soon as possible",
              sideEffects: "Significant adrenal suppression, skin atrophy, striae (irreversible), Cushing's syndrome (systemic absorption), secondary infection (especially tinea), hypertrichosis",
              contraindications: "Face/flexures/groin, infections, rosacea, widespread plaque psoriasis (rebound risk), neonates",
              renalDosing: "Not applicable",
              hepaticDosing: "Potential increased systemic absorption in severe hepatic impairment — use minimum effective amount",
              monitoring: "Limit to 2-week courses; reassess regularly; children: suppress HPA — minimize use"),

        // ─── ANTICOAGULATION — Additional ─────────────────────────────────────
        .init(name: "Fondaparinux (Arixtra)", category: "Anticoagulant — Factor Xa Inhibitor",
              commonDoses: "2.5 mg SC OD (VTE prophylaxis); 5–10 mg SC OD (treatment, weight-adjusted: <50 kg: 5 mg; 50–100 kg: 7.5 mg; >100 kg: 10 mg)",
              route: "SC",
              notes: "Synthetic pentasaccharide; HIT-safe alternative to heparin (no platelet factor 4 binding); no reversal agent licensed (andexanet alfa off-label); renal excretion",
              sideEffects: "Bleeding (no reversal agent — use PCC or rFVIIa in emergencies), thrombocytopenia (less than heparin — HIT extremely rare), injection-site reactions, elevated LFTs",
              contraindications: "eGFR <20 mL/min (prophylaxis); eGFR <30 mL/min (treatment); body weight <50 kg (prophylaxis); bacterial endocarditis; active bleeding",
              renalDosing: "Prophylaxis: avoid if eGFR <20 mL/min. Treatment: avoid if eGFR <30 mL/min. Half-life markedly prolonged in renal impairment",
              hepaticDosing: "Hepatic impairment: no dose adjustment; however, liver disease may worsen bleeding risk",
              monitoring: "Anti-Xa activity (for treatment doses or extremes of weight/renal function); renal function before starting; platelets (lower HIT risk than UFH/LMWH)"),

        .init(name: "Edoxaban (Lixiana/Savaysa)", category: "Anticoagulant — DOAC (Factor Xa inhibitor)",
              commonDoses: "60 mg OD (AF/VTE treatment); 30 mg OD if weight ≤60 kg, eGFR 15–50, or P-gp inhibitor co-prescribed",
              route: "PO",
              notes: "VTE treatment (after ≥5–10 days parenteral anticoagulation) and secondary prevention; non-valvular AF; dose reduce in low weight/renal impairment/P-gp inhibitors",
              sideEffects: "Bleeding (major/minor), anaemia, rash, elevated LFTs, GI upset; reversal: andexanet alfa (licensed), 4-factor PCC (unlicensed)",
              contraindications: "Mechanical heart valves, haemodynamically significant mitral stenosis, eGFR <15 mL/min, active bleeding, pregnancy/breastfeeding, antiphospholipid syndrome",
              renalDosing: "eGFR 15–50 mL/min: reduce to 30 mg OD. eGFR <15 mL/min: avoid. Renal function at least annually (3–6 monthly if eGFR <60)",
              hepaticDosing: "Moderate–severe hepatic impairment: avoid (altered haemostasis). Mild: use with caution",
              monitoring: "Renal function (annually, or more frequently if borderline); LFTs; signs of bleeding; weight; check for P-gp inhibitors/inducers"),

        // ─── PROKINETICS ──────────────────────────────────────────────────────
        .init(name: "Domperidone (Motilium)", category: "Prokinetic / Antiemetic",
              commonDoses: "10 mg TDS (before meals and at bedtime); maximum 30 mg/day; maximum 1 week",
              route: "PO/PR (suppository)",
              notes: "Gastroparesis; post-op nausea; GORD in infants/elderly; does NOT cross BBB (unlike metoclopramide — no EPS/tardive dyskinesia); cardiac risk at higher doses",
              sideEffects: "QTc prolongation (especially if CYP3A4 inhibitors co-prescribed), gynaecomastia/galactorrhoea (dopamine antagonism on pituitary), dry mouth",
              contraindications: "GI perforation/obstruction, prolactinoma, QTc >470 ms (male) or >450 ms (female), concomitant CYP3A4 inhibitors (ketoconazole, clarithromycin, amiodarone), serious hepatic impairment",
              renalDosing: "Dose reduce in severe renal impairment (eGFR <30); use BD instead of TDS",
              hepaticDosing: "Avoid in moderate–severe hepatic impairment (reduced first-pass — higher plasma levels)",
              monitoring: "ECG if at cardiac risk (QTc); minimum effective dose, maximum 1 week; avoid CYP3A4 inhibitors concurrently"),

        // ─── ONCOLOGY SUPPORTIVE CARE ─────────────────────────────────────────
        .init(name: "Filgrastim (G-CSF, Neupogen/Zarzio)", category: "Colony-Stimulating Factor",
              commonDoses: "5 mcg/kg SC OD (starting 24h after chemotherapy, for up to 14 days); prophylaxis: 5 mcg/kg OD × 5–7 days",
              route: "SC/IV",
              notes: "Prevention/treatment of febrile neutropenia after myelosuppressive chemotherapy; bone marrow failure; stem cell mobilisation; NOT for concurrent chemo",
              sideEffects: "Bone pain (very common — treat with paracetamol, NOT NSAIDs in oncology), splenomegaly/rupture (rare), leucocytosis, thrombocytopenia, allergic reactions, ARDS (rare)",
              contraindications: "Concurrent myelosuppressive chemotherapy or radiotherapy; AML (caution — may stimulate leukaemia growth); hypersensitivity to E. coli-derived proteins",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "No dose adjustment required",
              monitoring: "FBC (WBC, neutrophil count) during therapy — stop when neutrophil count adequate (>2×10⁹/L); spleen size if prolonged use"),

        .init(name: "Granisetron (Kytril)", category: "Antiemetic — 5-HT3 Antagonist",
              commonDoses: "1–2 mg IV before chemotherapy; 1 mg BD PO × 5 days (chemo); 3 mg patch (transdermal, 7-day)",
              route: "PO/IV/transdermal",
              notes: "CINV prevention and treatment; post-op nausea; transdermal patch for prolonged coverage; similar efficacy to ondansetron",
              sideEffects: "Headache, constipation, QTc prolongation, elevated LFTs, dizziness",
              contraindications: "Congenital long QT syndrome; concomitant QT-prolonging drugs with caution; hypersensitivity",
              renalDosing: "No dose adjustment",
              hepaticDosing: "No dose adjustment in mild–moderate; use with caution in severe hepatic impairment",
              monitoring: "ECG if QTc risk; LFTs with prolonged use; electrolytes (hypokalaemia/hypomagnesaemia worsen QTc risk)"),

        // ─── PALLIATIVE CARE ──────────────────────────────────────────────────
        .init(name: "Hyoscine hydrobromide (Kwells/Scopoderm patch)", category: "Anticholinergic — Sedating",
              commonDoses: "200–400 mcg SC/IV (death rattle/secretion control); 1.5 mg patch 72h (motion sickness)",
              route: "SC/IV/transdermal/oral",
              notes: "Palliative care (\"death rattle\" — terminal secretions); motion sickness; centrally-acting (crosses BBB) — sedating. Distinct from hyoscine BUTYLBROMIDE (Buscopan) which does NOT cross BBB",
              sideEffects: "Sedation/drowsiness (useful in palliative context), dry mouth, urinary retention, confusion (elderly), tachycardia, blurred vision, paradoxical agitation (children)",
              contraindications: "Narrow-angle glaucoma, urinary retention (BPH), myasthenia gravis, pyloric stenosis",
              renalDosing: "No formal adjustment; use minimum effective dose in renal impairment",
              hepaticDosing: "Reduce dose in hepatic impairment (prolonged half-life)",
              monitoring: "Symptom control; secretion reduction (palliative use); avoid confusion in elderly"),

        .init(name: "Cyclizine", category: "Antiemetic — H1 Antihistamine / Anticholinergic",
              commonDoses: "50 mg TDS PO/IV/IM; 150 mg/24h CSCI (syringe driver)",
              route: "PO/IV/IM/SC (CSCI)",
              notes: "Nausea/vomiting; palliative care (CSCI); vestibular causes of nausea; motion sickness; post-op N&V; compatible with most syringe-driver drugs",
              sideEffects: "Sedation, dry mouth, urinary retention, tachycardia, blurred vision, constipation; tachycardia may be undesirable in IHD",
              contraindications: "Narrow-angle glaucoma, urinary retention (BPH), severe hepatic failure, porphyria",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Avoid in severe hepatic impairment (porphyria precipitation risk, prolonged sedation)",
              monitoring: "Symptom control; HR if cardiac concerns; check syringe-driver compatibility if CSCI"),

        // ─── DIABETES — Kidney-Safe Options ───────────────────────────────────
        .init(name: "Linagliptin (Trajenta)", category: "Antidiabetic — DPP-4 inhibitor",
              commonDoses: "5 mg OD",
              route: "PO",
              notes: "Unique DPP-4 inhibitor with NO renal dose adjustment required (primarily biliary/GI excretion); T2DM; useful in advanced CKD",
              sideEffects: "Nasopharyngitis, arthralgia (rare), pancreatitis (rare signal), bullous pemphigoid (rare), hypoglycaemia only if combined with insulin/sulphonylurea",
              contraindications: "Type 1 DM, history of pancreatitis (caution — signal not proven), diabetic ketoacidosis",
              renalDosing: "NO dose adjustment required at any level of renal impairment — key advantage over other DPP-4 inhibitors",
              hepaticDosing: "No dose adjustment required",
              monitoring: "HbA1c; signs of pancreatitis; skin changes (bullous pemphigoid — rare)"),

        // ─── ADDITIONAL ANTIBIOTICS ───────────────────────────────────────────
        .init(name: "Ceftazidime", category: "Antibiotic — Cephalosporin (Anti-pseudomonal)",
              commonDoses: "1–2 g TDS IV/IM; 3 g TDS (serious infection/cystic fibrosis)",
              route: "IV/IM",
              notes: "Anti-pseudomonal cephalosporin; HAP, VAP, febrile neutropenia, meningitis; weaker Gram-positive activity than ceftriaxone",
              sideEffects: "Rash, diarrhoea, C. difficile, hypersensitivity, phlebitis, elevated LFTs, transient leucopenia",
              contraindications: "Cephalosporin hypersensitivity; caution in penicillin allergy (cross-reactivity ~1–2%)",
              renalDosing: "eGFR 30–50: 1 g BD. eGFR 15–30: 500 mg BD. eGFR <15: 500 mg OD. Renal impairment increases seizure risk at high doses",
              hepaticDosing: "No dose adjustment required",
              monitoring: "Renal function; levels if prolonged use/renal impairment; culture and sensitivity"),

        .init(name: "Amikacin", category: "Antibiotic — Aminoglycoside",
              commonDoses: "15–20 mg/kg OD IV (actual body weight; extended interval dosing); adjust in renal impairment",
              route: "IV",
              notes: "Gram-negative infections including Pseudomonas, ESBL organisms resistant to gentamicin; broader spectrum than gentamicin; TDM essential",
              sideEffects: "Nephrotoxicity (irreversible — ACR monitoring), irreversible ototoxicity/vestibular toxicity, neuromuscular blockade",
              contraindications: "Pre-existing significant hearing impairment (relative); myasthenia gravis (relative — neuromuscular blockade); concurrent nephrotoxic drugs without careful monitoring",
              renalDosing: "Dose adjustment based on TDM (target trough <5 mg/L and peak 20–30 mg/L); interval extended in renal impairment; TDM is MANDATORY",
              hepaticDosing: "No hepatic dose adjustment (eliminated renally); however, liver disease often coexists with renal impairment — adjust per renal function",
              monitoring: "TDM (peak and trough levels); renal function (daily in ICU); audiology if prolonged use; urinalysis for nephrotoxicity"),

        .init(name: "Piperacillin/tazobactam (Tazocin) Extended Infusion", category: "Antibiotic — Extended Infusion",
              commonDoses: "4.5 g over 4h TDS (extended infusion preferred); 4.5 g QDS standard",
              route: "IV",
              notes: "Extended infusion (EI) optimises pharmacodynamics for time-dependent killing — superior to standard bolus for severe infections and higher MIC organisms; same total daily dose",
              sideEffects: "Same as standard piperacillin/tazobactam; stability limit 12h at room temperature — prepare fresh",
              contraindications: "Penicillin hypersensitivity; SAMBA protocol — check local guidelines for EI use",
              renalDosing: "eGFR 20–40: 4.5 g TDS standard dosing. eGFR <20: 4.5 g BD. Adjust further by TDM if available",
              hepaticDosing: "No hepatic dose adjustment",
              monitoring: "Renal function; electrolytes (contains sodium); clinical response; drug compatibility (give separately from other infusions)"),

        // ─── HAEMOSTASIS / OBSTETRICS ─────────────────────────────────────────
        .init(name: "Oxytocin (Syntocinon)", category: "Uterotonic / Haemostatic",
              commonDoses: "5 units slow IV (active management 3rd stage / PPH); 10 units IM; 10–40 units/L infusion at 10–40 mU/min (augmentation)",
              route: "IV/IM",
              notes: "Uterotonic for PPH prevention/treatment; augmentation of labour; caesarean section; SLOW IV injection — bolus causes hypotension/tachycardia; NOT for induction in women with previous uterine surgery (prefer titrated regimes)",
              sideEffects: "Hypotension/cardiovascular collapse (rapid IV bolus), tachycardia, fluid retention/hyponatraemia (prolonged high-dose — antidiuretic effect), uterine hyperstimulation, fetal distress",
              contraindications: "Hypertonic uterine contractions, foetal distress, cephalopelvic disproportion, placenta praevia; rapid IV bolus contraindicated (give slowly)",
              renalDosing: "No dose adjustment; monitor fluid balance (antidiuretic effect with high doses)",
              hepaticDosing: "No dose adjustment; hepatic metabolism (short half-life ~5 min)",
              monitoring: "Continuous fetal monitoring (CTG) during augmentation; fluid balance (hyponatraemia risk with prolonged use); BP and HR after IV administration"),

        // ─── IRON / ANAEMIA ───────────────────────────────────────────────────
        .init(name: "Ferrous fumarate (Fersamal)", category: "Iron Supplement",
              commonDoses: "210 mg BD–TDS (treatment); 210 mg OD (prophylaxis)",
              route: "PO",
              notes: "Iron deficiency anaemia; better tolerated than ferrous sulfate (less GI irritation); take with vitamin C to enhance absorption; pre-op Hb optimisation",
              sideEffects: "Constipation, nausea, epigastric pain, black stools, diarrhoea; better GI profile than ferrous sulfate in some patients",
              contraindications: "Haemochromatosis, haemosiderosis, repeated blood transfusions, anaemia not due to iron deficiency, concomitant parenteral iron",
              renalDosing: "No dose adjustment; accumulation of iron stores possible in advanced CKD — check iron studies before prescribing",
              hepaticDosing: "Caution in hepatic disease (iron metabolism altered); check iron stores",
              monitoring: "Ferritin and transferrin saturation after 4–6 weeks; Hb response (rise ≥20 g/L in 4 weeks expected); reticulocyte count"),

        // ─── CALCIUM CHANNEL BLOCKER — Additional ─────────────────────────────
        .init(name: "Nifedipine (Adalat)", category: "Calcium Channel Blocker (DHP)",
              commonDoses: "5–10 mg TDS (standard-release); 30–90 mg OD (SR); 10 mg SL/buccal (hypertensive urgency — bite and swallow)",
              route: "PO",
              notes: "Hypertension; angina; Raynaud's; tocolysis (off-label); SR formulation preferred; reflex tachycardia less with SR form",
              sideEffects: "Peripheral oedema (dose-related, common), headache, flushing, reflex tachycardia, gingival hyperplasia (long-term)",
              contraindications: "Cardiogenic shock, haemodynamically significant aortic stenosis, within 1 month of acute MI, unstable angina; avoid short-acting in MI (harmful)",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Reduce dose in hepatic impairment (increased plasma levels — longer dosing interval or lower dose); SR form more predictable",
              monitoring: "BP and HR; ankle oedema; avoid grapefruit juice (CYP3A4 inhibition)"),
    ]

    private static let _drugs7: [SurgicalDrug] = [

        // ─── ANTIBIOTICS — Key Additions ──────────────────────────────────────
        .init(name: "Clindamycin", category: "Antibiotic — Lincosamide",
              commonDoses: "150–450 mg QDS PO; 300–900 mg TDS–QDS IV",
              route: "PO/IV/topical",
              notes: "Anaerobic and Gram-positive cover; skin/soft tissue (MRSA community strains); dental infections; bone/joint; C. difficile risk; NOT for CNS infections (poor penetration)",
              sideEffects: "C. difficile colitis (high risk — use minimum necessary duration), GI upset, oesophageal ulceration (take with water upright), rash, hepatotoxicity (rare)",
              contraindications: "Previous clindamycin-associated diarrhoea/colitis; avoid unnecessary prolonged courses (C. diff risk)",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Reduce dose and frequency in severe hepatic impairment (active liver disease — accumulation); monitor LFTs",
              monitoring: "Stool for C. difficile if diarrhoea develops; LFTs with prolonged IV use; local sensitivities"),

        .init(name: "Benzathine penicillin G (Bicillin L-A)", category: "Antibiotic — Long-acting Penicillin",
              commonDoses: "1.2 MU IM single dose (syphilis primary/secondary/latent <1yr); 2.4 MU IM × 3 doses weekly (late latent/tertiary); 1.2 MU IM monthly (rheumatic fever prophylaxis)",
              route: "Deep IM only",
              notes: "Long-acting depot penicillin; syphilis treatment; rheumatic fever secondary prophylaxis (critical in Caribbean); NEVER IV (cardiac arrest); deep gluteal IM only",
              sideEffects: "Injection-site pain (very common), Jarisch-Herxheimer reaction (syphilis — fever/chills 2–8h post first dose), anaphylaxis",
              contraindications: "Penicillin allergy (anaphylaxis); NEVER administer IV — fatal; not for neurosyphilis (use IV penicillin G)",
              renalDosing: "No dose adjustment for standard dosing; caution in severe renal failure with very high doses",
              hepaticDosing: "No dose adjustment",
              monitoring: "VDRL/RPR titres at 3, 6, 12 months (syphilis); Jarisch-Herxheimer reaction — pre-warn patient; observe 30 min post injection (anaphylaxis)"),

        .init(name: "Cefepime", category: "Antibiotic — Cephalosporin (4th generation)",
              commonDoses: "1–2 g BD–TDS IV; 2 g TDS (febrile neutropenia/meningitis/Pseudomonas)",
              route: "IV/IM",
              notes: "Broad-spectrum including Pseudomonas and ESBL (partial); febrile neutropenia; HAP/VAP; meningitis; overcomes many AmpC-mediated resistances",
              sideEffects: "Neurotoxicity (encephalopathy, seizures — especially in renal impairment; risk higher than other cephalosporins), rash, C. difficile, elevated LFTs",
              contraindications: "Cephalosporin hypersensitivity; use with extreme caution in seizure history/renal impairment (neurotoxicity)",
              renalDosing: "eGFR 30–60: 1–2 g BD. eGFR 11–29: 1–2 g OD. eGFR <11: 500 mg–1 g OD. Neurotoxicity risk increases with renal impairment — reduce dose",
              hepaticDosing: "No dose adjustment",
              monitoring: "Renal function (neurotoxicity risk proportional to exposure); neuro status in ICU; cultures and sensitivities"),

        .init(name: "Aztreonam", category: "Antibiotic — Monobactam",
              commonDoses: "1–2 g TDS–QDS IV/IM; 500 mg TDS–QDS (urinary tract)",
              route: "IV/IM",
              notes: "Gram-negative aerobic coverage only (like gentamicin without renal toxicity); safe in penicillin/cephalosporin allergy; no anaerobic or Gram-positive activity — combine accordingly",
              sideEffects: "GI upset, elevated LFTs, rash (cross-reactivity with ceftazidime — caution), phlebitis (IV), C. difficile (rare)",
              contraindications: "Aztreonam hypersensitivity; caution if ceftazidime allergy (some cross-reactivity due to identical R1 side chain)",
              renalDosing: "eGFR 10–30: 50% dose. eGFR <10: 25% dose or 500 mg after loading dose",
              hepaticDosing: "No dose adjustment in mild–moderate; use with caution in severe hepatic impairment",
              monitoring: "Renal function; LFTs with prolonged use; culture and sensitivity"),

        .init(name: "Ceftolozane/tazobactam (Zerbaxa)", category: "Antibiotic — Reserve Cephalosporin",
              commonDoses: "1.5 g TDS IV (over 1h); 3 g TDS (HAP/VAP)",
              route: "IV",
              notes: "Reserve antibiotic for MDR Pseudomonas aeruginosa (including those resistant to carbapenems); complicated intra-abdominal infections (with metronidazole); HAP/VAP",
              sideEffects: "GI upset, elevated LFTs, headache, hypokalaemia, fever, C. difficile",
              contraindications: "Cephalosporin hypersensitivity; only use for confirmed/suspected MDR Gram-negative infections — antimicrobial stewardship",
              renalDosing: "eGFR 30–50: 750 mg TDS. eGFR 15–29: 375 mg TDS. CRRT: specialist guidance required",
              hepaticDosing: "No hepatic dose adjustment",
              monitoring: "Culture and sensitivity (resistance confirmation before use); renal function; LFTs; antimicrobial stewardship review"),

        // ─── ANALGESICS — Additional ──────────────────────────────────────────
        .init(name: "Hydromorphone (Dilaudid)", category: "Opioid Analgesic",
              commonDoses: "1–4 mg PO q4–6h; 0.2–1 mg IV/SC q4–6h",
              route: "PO/IV/SC",
              notes: "5–7× more potent than morphine; useful when morphine poorly tolerated (less histamine release, less nausea in some patients); renally eliminated — accumulates in renal failure",
              sideEffects: "Respiratory depression, sedation, constipation, nausea, pruritus (less than morphine), confusion/myoclonus in renal failure (metabolite accumulation)",
              contraindications: "Opioid-naive patients without appropriate monitoring; severe respiratory depression; avoid in renal failure (active metabolite accumulation)",
              renalDosing: "Avoid or use extreme caution in eGFR <30 — hydromorphone-3-glucuronide accumulates and causes neuroexcitatory effects (myoclonus, seizures). Fentanyl preferred in renal failure",
              hepaticDosing: "Reduce initial dose in hepatic impairment (reduced first-pass/clearance); titrate carefully",
              monitoring: "Pain scores; sedation scale; respiratory rate; renal function if prolonged use"),

        .init(name: "Tapentadol (Palexia)", category: "Opioid Analgesic / NRI",
              commonDoses: "50–250 mg BD (SR); 50–100 mg q4–6h (IR); max 500 mg/day",
              route: "PO",
              notes: "Dual mechanism: mu-opioid agonist + noradrenaline reuptake inhibitor; less constipation and nausea than equianalgesic oxycodone; neuropathic and nociceptive pain",
              sideEffects: "Nausea, dizziness, constipation (less than oxycodone), somnolence, headache, serotonin syndrome risk (with SSRIs/SNRIs/MAOIs — less than tramadol)",
              contraindications: "MAO inhibitors (within 14 days), seizure disorder (relative), severe respiratory depression, severe hepatic/renal impairment (IR: eGFR <30)",
              renalDosing: "IR formulation: avoid if eGFR <30. SR: use with caution; dose reduce",
              hepaticDosing: "Severe hepatic impairment (Child-Pugh C): avoid IR; SR max 50 mg TDS",
              monitoring: "Pain scores; respiratory function; avoid concomitant serotonergic drugs"),

        // ─── INSULIN — Long-acting / Basal ────────────────────────────────────
        .init(name: "Insulin glargine (Lantus/Toujeo)", category: "Insulin — Long-acting Basal",
              commonDoses: "Individualised SC; typically 0.2–0.4 units/kg OD at same time each day; titrate by 2 units every 3 days to fasting target",
              route: "SC only",
              notes: "Peakless 24h basal insulin; once-daily injection; do NOT mix with other insulins in syringe; Toujeo (300 units/mL) ≠ Lantus (100 units/mL) — not interchangeable",
              sideEffects: "Hypoglycaemia (nocturnal less common than NPH), lipodystrophy at injection sites, weight gain, injection-site reactions, local allergy",
              contraindications: "Hypoglycaemia episode; never given IV (concentration/acidity — fatal); do not mix with other insulins",
              renalDosing: "Reduce dose in renal impairment (reduced insulin clearance increases hypoglycaemia risk); frequent glucose monitoring required",
              hepaticDosing: "Reduce dose in hepatic impairment (reduced gluconeogenesis + insulin degradation altered); titrate carefully",
              monitoring: "Fasting glucose (target 4–7 mmol/L); HbA1c; hypoglycaemic episodes; injection-site rotation; annual eye/foot/renal review"),

        .init(name: "Insulin detemir (Levemir)", category: "Insulin — Long-acting Basal",
              commonDoses: "Individualised SC; typically OD or BD; start 0.1–0.2 units/kg OD; adjust every 3 days",
              route: "SC only",
              notes: "Long-acting basal insulin (18–24h); weight-neutral advantage over glargine/NPH; predictable absorption (albumin binding reduces variability); BD dosing possible",
              sideEffects: "Hypoglycaemia, lipodystrophy, weight gain (less than glargine/NPH), injection-site reactions",
              contraindications: "Never IV; do not mix with other insulins",
              renalDosing: "Dose reduce in renal impairment; monitor closely (hypoglycaemia risk)",
              hepaticDosing: "Reduce dose; careful titration in hepatic impairment",
              monitoring: "Fasting/pre-dose glucose; HbA1c every 3 months; hypoglycaemia frequency"),

        .init(name: "Insulin degludec (Tresiba)", category: "Insulin — Ultra-long-acting Basal",
              commonDoses: "Individualised SC; typically OD at any time (consistent); titrate to fasting glucose target",
              route: "SC only",
              notes: "Ultra-long-acting (>42h half-life); very flat profile; lowest hypoglycaemia risk of all basal insulins; dose can be changed by ≥8h if needed; available 100 and 200 units/mL",
              sideEffects: "Hypoglycaemia (lowest rate of all basal insulins), weight gain, injection-site reactions, lipodystrophy",
              contraindications: "Never IV; do not mix with other insulins; 200 units/mL pen max 160 units/dose",
              renalDosing: "Reduce dose in renal impairment; less affected by renal clearance than older insulins but still monitor",
              hepaticDosing: "Reduce dose; monitor glucose closely",
              monitoring: "Fasting glucose; HbA1c; hypoglycaemia diary — often used to convert patients from NPH with hypoglycaemia problems"),

        .init(name: "Insulin regular (Actrapid/Humulin R)", category: "Insulin — Short-acting",
              commonDoses: "SC: 4–20 units 30 min before meals (patient-specific); IV infusion: 0.05–0.1 units/kg/h (DKA/perioperative); variable rate IV (VRIII/sliding scale)",
              route: "SC/IV",
              notes: "Only insulin that can be used IV (DKA, hyperkalaemia, peri-op); inject SC 30 min before meals (slower onset than rapid-acting); available for VRIII sliding scales",
              sideEffects: "Hypoglycaemia, weight gain, hypokalaemia (IV use — especially DKA protocol), lipodystrophy",
              contraindications: "Active hypoglycaemia; always use with dextrose for IV hyperkalaemia management",
              renalDosing: "Reduce dose; renal impairment prolongs insulin action (reduced renal clearance + insulin sensitivity changes)",
              hepaticDosing: "Reduce dose; hepatic impairment increases hypoglycaemia risk (reduced gluconeogenesis)",
              monitoring: "Glucose hourly during IV infusion; potassium in DKA protocol (replacement essential); fluid balance"),

        // ─── ANTI-MALARIALS ────────────────────────────────────────────────────
        .init(name: "Artemether/lumefantrine (Riamet/Coartem)", category: "Antimalarial — ACT",
              commonDoses: "4 tablets (80/480 mg) at 0, 8, 24, 36, 48, 60 h (adult >35 kg); always take with fat-containing food/milk",
              route: "PO",
              notes: "First-line treatment for uncomplicated Plasmodium falciparum malaria; artemisinin combination therapy (ACT); MUST take with food (poor absorption when fasted); complete 6-dose course",
              sideEffects: "Headache, dizziness, sleep disturbance, arthralgia/myalgia, palpitations, QTc prolongation, anorexia, nausea; generally well tolerated",
              contraindications: "Severe malaria (use IV artesunate), first trimester of pregnancy (teratogenicity — use quinine+doxycycline), QTc >500 ms, concomitant QT-prolonging drugs, mefloquine within 12h",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Use with caution in severe hepatic impairment; no formal dose recommendation",
              monitoring: "Repeat blood film at day 3, 7, 28 to confirm clearance; ECG if cardiac risk (QTc); glucose in children (hypoglycaemia risk)"),

        .init(name: "Artesunate IV (Malacef)", category: "Antimalarial — Artesunate IV",
              commonDoses: "2.4 mg/kg IV at 0, 12, 24h then OD until PO possible (minimum 3 days); then switch to ACT oral",
              route: "IV",
              notes: "Treatment of severe/complicated malaria (P. falciparum); superior to IV quinine (AQUAMAT/SEAQUAMAT trials); always follow with 3-day oral ACT on recovery",
              sideEffects: "Post-artesunate delayed haemolysis (PADH — occurs 2–4 weeks post treatment, especially in hyperparasitaemia; monitor Hb); hepatotoxicity, neurotoxicity (rare at therapeutic doses)",
              contraindications: "Not for uncomplicated malaria; hypersensitivity to artemisinins",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "No dose adjustment; monitor LFTs",
              monitoring: "Blood film for parasitaemia daily until negative; Hb at day 7, 14, 28 (PADH); renal function; blood glucose; LFTs"),

        .init(name: "Chloroquine phosphate", category: "Antimalarial / DMARD",
              commonDoses: "Treatment: 600 mg base loading, then 300 mg at 6h, then 300 mg OD × 2 days; Prophylaxis: 300 mg weekly (start 1 week before travel, 4 weeks after); SLE/RA: 150–300 mg OD",
              route: "PO",
              notes: "Prophylaxis where sensitive (now limited areas); SLE; RA; amoebic liver abscess; NOT for P. falciparum in most regions (widespread resistance). Caribbean: P. vivax/P. malariae still sensitive",
              sideEffects: "GI upset, headache, pruritus (common in Black African patients), retinal toxicity (cumulative dose — annual ophthalmology screen), cardiomyopathy (rare, high dose), QTc prolongation",
              contraindications: "Retinal disease/macular degeneration, G6PD deficiency (haemolysis), porphyria, pre-existing cardiac conduction defects",
              renalDosing: "eGFR <10: reduce dose (accumulation); avoid if severe renal failure",
              hepaticDosing: "Caution in hepatic impairment (hepatotoxicity risk, reduced clearance)",
              monitoring: "Baseline ophthalmology + annual review (retinal toxicity); G6PD screen in at-risk populations; ECG if cardiac risk; LFTs"),

        .init(name: "Atovaquone/proguanil (Malarone)", category: "Antimalarial — Prophylaxis/Treatment",
              commonDoses: "Prophylaxis: 1 adult tablet (250/100 mg) OD starting 1–2 days before travel, continue 7 days after. Treatment: 4 tablets OD × 3 days",
              route: "PO",
              notes: "Preferred prophylaxis for short trips to endemic areas (short pre/post travel dosing); treatment of uncomplicated falciparum malaria; take with food/milk",
              sideEffects: "GI upset (nausea, vomiting, abdominal pain), headache, dizziness, mouth ulcers, elevated LFTs; generally well tolerated",
              contraindications: "eGFR <30 mL/min (treatment); eGFR <30 (prophylaxis — use doxycycline or chloroquine if sensitive); pregnancy (limited data — avoid unless benefit outweighs risk); severe hepatic impairment",
              renalDosing: "Treatment: avoid if eGFR <30 (proguanil accumulates). Prophylaxis: avoid if eGFR <30",
              hepaticDosing: "Caution in severe hepatic impairment (proguanil conversion to active metabolite reduced)",
              monitoring: "LFTs; renal function before prescribing; adherence counselling (must take with food for absorption)"),

        .init(name: "Quinine sulfate", category: "Antimalarial",
              commonDoses: "Treatment: 600 mg TDS × 5–7 days (+ doxycycline 7 days); IV quinine: 20 mg/kg loading over 4h then 10 mg/kg q8h (HDU/ICU); Cramps: 200–300 mg nocte",
              route: "PO/IV",
              notes: "Oral: second-line uncomplicated malaria; IV: second-line severe malaria (if artesunate unavailable); leg cramps (unlicensed, last resort); narrow therapeutic index; cardiac monitoring required IV",
              sideEffects: "Cinchonism (tinnitus, dizziness, nausea, visual disturbances, headache), QTc prolongation, hypoglycaemia (stimulates insulin), thrombocytopenia, haemolysis (G6PD), tinnitus",
              contraindications: "Haemoglobinuria (blackwater fever), optic neuritis, tinnitus, G6PD deficiency (relative), haemolytic anaemia",
              renalDosing: "Reduce IV maintenance dose (by 1/3) in renal failure; accumulation of metabolites",
              hepaticDosing: "Reduce dose in hepatic impairment (prolonged half-life)",
              monitoring: "Continuous cardiac monitoring (QTc) during IV infusion; blood glucose every 4–6h (hypoglycaemia risk); blood film; blood quinine levels if available"),

        .init(name: "Primaquine", category: "Antimalarial — Anti-hypnozoite",
              commonDoses: "P. vivax/ovale radical cure: 15 mg base OD × 14 days; Pneumocystis: 30 mg OD with clindamycin",
              route: "PO",
              notes: "Eradicates dormant liver stages (hypnozoites) of P. vivax and P. ovale — prevents relapse; G6PD TESTING MANDATORY before prescribing (life-threatening haemolysis)",
              sideEffects: "Haemolytic anaemia (severe/life-threatening in G6PD deficiency), methaemoglobinaemia, GI upset, abdominal pain",
              contraindications: "G6PD deficiency (ABSOLUTE — test first), pregnancy, breastfeeding (unless infant G6PD normal), rheumatoid arthritis/SLE",
              renalDosing: "No formal dose adjustment, but avoid in severe renal impairment",
              hepaticDosing: "Avoid in active hepatic disease",
              monitoring: "G6PD level BEFORE starting — mandatory; FBC (Hb, haematocrit) weekly during treatment; methaemoglobin if cyanosis"),

        // ─── GI — Additional ──────────────────────────────────────────────────
        .init(name: "Famotidine (Pepcid)", category: "H2-receptor Antagonist",
              commonDoses: "20–40 mg BD (active ulcer); 20 mg OD (maintenance/prophylaxis); 20 mg IV BD (inpatient acid suppression when PO not possible)",
              route: "PO/IV",
              notes: "Peptic ulcer; GORD; alternative to PPI (fewer drug interactions); useful when PPI causes side effects; less cimetidine-type drug interactions than ranitidine",
              sideEffects: "Headache, dizziness, constipation/diarrhoea, elevated LFTs (rare), QTc prolongation (IV high-dose), thrombocytopenia (rare)",
              contraindications: "Hypersensitivity to H2 blockers; caution in QTc prolongation (IV); phenylketonuria (some formulations contain phenylalanine)",
              renalDosing: "eGFR <50: 50% dose reduction or double interval (accumulation); eGFR <30: 50% dose, 36–48h intervals",
              hepaticDosing: "No dose adjustment in hepatic impairment",
              monitoring: "Renal function before dosing in renal impairment; symptom response; ECG if IV in at-risk patients"),

        .init(name: "Pancreatin (Creon)", category: "Pancreatic Enzyme Supplement",
              commonDoses: "Creon 10,000–25,000 units lipase with each main meal; 5,000–10,000 with snacks; titrate to symptoms",
              route: "PO",
              notes: "Exocrine pancreatic insufficiency (chronic pancreatitis, pancreatic cancer, post-pancreatectomy, cystic fibrosis); swallow whole or open capsule and mix with food; do NOT crush (inactivated by acid)",
              sideEffects: "GI discomfort, nausea, constipation/diarrhoea (dose-dependent), fibrosing colonopathy (very high doses in CF), hyperuricaemia (high doses), perioral soreness (if powder contacts mucosa)",
              contraindications: "Acute pancreatitis; known porcine allergy; early stages of acute pancreatitis",
              renalDosing: "No renal dose adjustment needed",
              hepaticDosing: "No hepatic dose adjustment",
              monitoring: "Stool frequency and consistency; weight; nutritional status; fat-soluble vitamins (A, D, E, K) in chronic use; consider fibrosing colonopathy if doses >10,000 units/kg/day in CF"),

        .init(name: "Loperamide (Imodium)", category: "Antidiarrhoeal",
              commonDoses: "4 mg initially (loading), then 2 mg after each loose stool; max 16 mg/day (adults); ileostomy output management: titrate to output",
              route: "PO",
              notes: "Acute diarrhoea; ileostomy/colostomy high output management; post-op diarrhoea; peripheral mu-opioid agonist (does NOT cross BBB at therapeutic doses); avoid in infectious diarrhoea until culture",
              sideEffects: "Constipation, abdominal cramping, nausea, bloating; toxic megacolon risk (infectious colitis with bloody/fever diarrhoea — avoid), QTc prolongation (very high/illegal doses)",
              contraindications: "Bloody diarrhoea, high fever (possible infectious colitis — exclude first), pseudomembranous colitis, ileus, bowel obstruction, acute inflammatory bowel disease",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Use with caution in severe hepatic impairment (reduced first-pass; risk of CNS effects at therapeutic doses)",
              monitoring: "Stool frequency and consistency; avoid if diarrhoea is bloody/febrile; ileostomy output volume"),

        .init(name: "Sucralfate (Antepsin)", category: "Mucosal Protective Agent",
              commonDoses: "1 g QDS (1h before meals and at bedtime, on empty stomach) for 4–8 weeks",
              route: "PO",
              notes: "Peptic ulcer treatment (alternative to PPIs); stress ulcer prophylaxis (lower C. diff risk than PPIs in ICU); take on empty stomach (1h before food); binds many drugs — space administration",
              sideEffects: "Constipation (most common), nausea, aluminium accumulation (renal failure — avoid), drug binding (decreases absorption of many drugs if taken simultaneously)",
              contraindications: "Severe renal failure (aluminium toxicity — accumulation); avoid concomitant antacids",
              renalDosing: "Avoid in eGFR <30 (aluminium accumulation — encephalopathy, osteomalacia, anaemia)",
              hepaticDosing: "No dose adjustment needed",
              monitoring: "Aluminium levels in renal impairment; space other drug doses by ≥2h; symptom response"),
    ]

    private static let _drugs8: [SurgicalDrug] = [

        // ─── LUPUS / SYSTEMIC AUTOIMMUNE ──────────────────────────────────────
        .init(name: "Belimumab (Benlysta)", category: "Immunosuppressant — Anti-BLyS (Biologic)",
              commonDoses: "10 mg/kg IV over 1h at 0, 2, 4 weeks then monthly; 200 mg SC weekly",
              route: "IV infusion / SC",
              notes: "Systemic lupus erythematosus (SLE) with active disease despite standard therapy; do not use in severe active lupus nephritis or CNS lupus; screen for TB, hepatitis B before starting",
              sideEffects: "Infusion/injection-site reactions, serious infections, depression/suicidal ideation (monitor), nausea, diarrhoea, hypersensitivity reactions, progressive multifocal leukoencephalopathy (PML — rare)",
              contraindications: "Active or prior history of PML, severe active lupus nephritis or CNS lupus (excluded from trials), active serious infection, live vaccines within 30 days",
              renalDosing: "No dose adjustment recommended (limited data in severe renal impairment)",
              hepaticDosing: "No dose adjustment (not hepatically cleared)",
              monitoring: "Disease activity scores (SLEDAI); full blood count; renal function; complement (C3, C4, dsDNA) every 3–6 months; depression screening; TB screening before starting"),

        .init(name: "Cyclophosphamide (Cytoxan/Endoxan)", category: "Immunosuppressant / Alkylating Agent",
              commonDoses: "IV pulse: 500–1000 mg/m² every 4 weeks (lupus nephritis — Euro-Lupus: 500 mg fortnightly × 6 doses); PO: 1–2 mg/kg/day",
              route: "IV/PO",
              notes: "Lupus nephritis (induction); vasculitis; oncology; always use MESNA for haemorrhagic cystitis prophylaxis (IV doses); adequate hydration essential; teratogen — contraception mandatory",
              sideEffects: "Haemorrhagic cystitis (MESNA prevents — mandatory with IV doses), myelosuppression, nausea/vomiting (use 5-HT3 antiemetic), alopecia, infertility (consider egg/sperm banking), bladder cancer (long-term), immunosuppression, SIADH",
              contraindications: "Pregnancy (teratogen), breastfeeding, active infections, severe myelosuppression, haemorrhagic cystitis, severe renal/hepatic impairment",
              renalDosing: "eGFR 10–50: 75% dose. eGFR <10: 50% dose; avoid if possible",
              hepaticDosing: "Reduce dose in hepatic impairment (prodrug — requires hepatic conversion to active metabolite)",
              monitoring: "FBC and U&E before each pulse; urinalysis (haematuria); LFTs; pregnancy test before treatment; urine cytology annually (bladder cancer); fertility counselling"),

        .init(name: "Rituximab (MabThera/Rituxan)", category: "Immunosuppressant — Anti-CD20 (Biologic)",
              commonDoses: "SLE/vasculitis: 375 mg/m² weekly × 4 or 1 g × 2 (2 weeks apart); lymphoma: 375 mg/m² OD × 4–8 cycles",
              route: "IV infusion",
              notes: "Refractory SLE/lupus nephritis; ANCA vasculitis (licensed); RA; B-cell lymphoma; always pre-medicate with paracetamol + antihistamine + methylprednisolone; screen for hepatitis B/TB before starting",
              sideEffects: "Infusion reactions (first infusion — pre-medicate), progressive multifocal leukoencephalopathy (PML — rare), serious infections, hypogammaglobulinaemia, hepatitis B reactivation, tumour lysis syndrome (lymphoma)",
              contraindications: "Active severe infection; hepatitis B surface antigen positivity without prophylaxis; live vaccines within 4 weeks; pregnancy (avoid)",
              renalDosing: "No dose adjustment; monitor for tumour lysis syndrome in haematological disease",
              hepaticDosing: "No formal dose adjustment; monitor for hepatitis B reactivation (prophylax if coreAb positive)",
              monitoring: "FBC and immunoglobulins; hepatitis B serology before treatment; PML screening (JC virus antibodies); infection screening; CD19/CD20 B cell counts"),

        // ─── DERMATOLOGY / SKIN ───────────────────────────────────────────────
        .init(name: "Isotretinoin (Roaccutane/Accutane)", category: "Retinoid — Systemic",
              commonDoses: "0.5–1 mg/kg/day PO in 1–2 divided doses; cumulative dose 120–150 mg/kg total course",
              route: "PO",
              notes: "Severe nodulocystic/scarring acne; teratogen — mandatory pregnancy prevention programme (iPLEDGE/pregnancy test monthly); with food (fat-enhanced absorption); course typically 4–6 months",
              sideEffects: "Teratogenicity (Category X — mandatory contraception), cheilitis/dry lips (very common — use emollient), dry skin, photosensitivity, elevated triglycerides/LFTs, mood changes/depression (monitor), myalgia, night blindness, pseudotumour cerebri (with tetracyclines)",
              contraindications: "Pregnancy (Category X — ABSOLUTE), breastfeeding, concurrent tetracyclines (pseudotumour cerebri), liver disease, hyperlipidaemia",
              renalDosing: "Use with caution; no formal renal dose adjustment",
              hepaticDosing: "Contraindicated in significant hepatic impairment; avoid if LFTs >3× upper limit normal",
              monitoring: "Pregnancy test monthly (female); LFTs and fasting lipids at baseline, 6–8 weeks, then 3-monthly; mood assessment; ophthalmic review if night blindness"),

        .init(name: "Permethrin 5% cream (Lyclear)", category: "Antiparasitic — Topical",
              commonDoses: "Scabies: apply from neck down, leave 8–12h, wash off; repeat after 1 week. Head lice: apply to scalp 10 min, rinse",
              route: "Topical",
              notes: "Scabies (first-line); head lice; crusted/Norwegian scabies requires systemic ivermectin in addition; treat all household contacts simultaneously; wash/bag all clothing/bedding",
              sideEffects: "Local burning/stinging/pruritus on application (common — not allergy), temporary worsening of itch (post-scabicide reaction lasts 2–4 weeks — do not re-treat immediately), rarely contact dermatitis",
              contraindications: "Hypersensitivity to pyrethrins/chrysanthemums; avoid mucosal surfaces and eyes",
              renalDosing: "Not applicable (topical; negligible systemic absorption)",
              hepaticDosing: "Not applicable (topical)",
              monitoring: "Clinical resolution at 4 weeks (itch may persist 4 weeks after successful treatment — do not retreat unless new lesions); treat all contacts"),

        .init(name: "Ivermectin (Stromectol)", category: "Antiparasitic — Systemic",
              commonDoses: "Scabies: 200 mcg/kg PO single dose, repeat in 2 weeks; Crusted scabies: multiple doses (specialist guidance); Strongyloides: 200 mcg/kg OD × 2 days",
              route: "PO",
              notes: "Crusted/Norwegian scabies (systemic required alongside topical); strongyloidiasis; filariasis; Caribbean-relevant (filariasis, strongyloides endemic); take fasting",
              sideEffects: "Mazzotti reaction (fever, rash, pruritus, oedema — from dying microfilariae, especially filariasis treatment), dizziness, headache, GI upset, transient visual disturbances",
              contraindications: "Pregnancy (teratogen — use permethrin topically); CNS conditions (blood-brain barrier disruption — drugs increasing BBB permeability); children <15 kg",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Use with caution in severe hepatic impairment",
              monitoring: "Clinical resolution; microfilaria counts (filariasis); Mazzotti reaction monitoring; repeat stool examination (strongyloides)"),

        .init(name: "Tacrolimus 0.1% ointment (Protopic)", category: "Topical Immunomodulator",
              commonDoses: "Apply BD to affected skin until clear; use minimum effective amount; reduce to OD or PRN as symptoms improve",
              route: "Topical",
              notes: "Atopic dermatitis (moderate–severe, adults; steroid-sparing); face/flexures where topical steroids cause atrophy; does NOT cause skin atrophy (unlike steroids); FDA black-box: theoretical malignancy risk (not confirmed in humans)",
              sideEffects: "Burning/stinging/pruritus on application (common, improves after first few days), increased risk of infections (local), photosensitivity; theoretical lymphoma risk (Black Box Warning — not confirmed in humans at recommended doses)",
              contraindications: "Active skin infections (bacterial/viral/fungal — treat first), immunocompromised patients (relative), active malignancy at site, Netherton syndrome",
              renalDosing: "Not applicable (topical; minimal systemic absorption)",
              hepaticDosing: "Not applicable (topical; caution in severe hepatic impairment — increased systemic exposure)",
              monitoring: "Skin response; use minimum effective dose; sun protection (photosensitivity); review every 3–6 months; reassess if not responding at 6 weeks"),

        .init(name: "Terbinafine (Lamisil)", category: "Antifungal — Allylamine",
              commonDoses: "Onychomycosis: 250 mg OD × 6 weeks (fingernails), 12 weeks (toenails); Tinea: 250 mg OD × 2–6 weeks PO; Cream/gel: apply OD–BD × 1–2 weeks",
              route: "PO/topical",
              notes: "Dermatophyte fungal infections (tinea pedis/corporis/capitis/unguium); NOT effective against Candida; hepatotoxicity risk with systemic — liver function test recommended",
              sideEffects: "GI upset, headache, rash, taste/smell disturbance (may be prolonged or permanent — WARN patient), hepatotoxicity (rare but serious), bone marrow suppression (rare)",
              contraindications: "Active hepatic disease, taste/smell disorders (worsens), avoid in hepatic/renal impairment without monitoring",
              renalDosing: "eGFR <50: 50% dose (PO); avoid if severe renal impairment",
              hepaticDosing: "Avoid in chronic or active hepatic disease — hepatotoxicity risk; no dose adjustment if using topical form",
              monitoring: "LFTs before starting (PO systemic courses); repeat at 6 weeks if prolonged course; taste/smell — warn before prescribing; culture/sensitivity before starting"),

        .init(name: "Clotrimazole 1% cream/pessary (Canesten)", category: "Antifungal — Topical Azole",
              commonDoses: "Skin: apply BD–TDS × 2–4 weeks. Vaginal: 500 mg pessary single dose or 200 mg × 3 days; 1% cream intravaginally × 6 nights",
              route: "Topical/intravaginal",
              notes: "Superficial dermatophyte and candidal infections; vaginal candidiasis (thrush); oral candidiasis (lozenges — Canesten Oral); safe in pregnancy (topical/vaginal)",
              sideEffects: "Local burning/stinging/erythema (mild); contact dermatitis (rare); systemic absorption negligible",
              contraindications: "Hypersensitivity to imidazoles; avoid eyes; vaginal pessaries may damage condoms/diaphragms",
              renalDosing: "Not applicable (topical)",
              hepaticDosing: "Not applicable (topical)",
              monitoring: "Clinical response at 2 weeks; consider oral fluconazole for recurrent vaginal candidiasis; diabetes screening if recurrent"),

        // ─── EYE MEDICATIONS ─────────────────────────────────────────────────
        .init(name: "Chloramphenicol eye drops 0.5%", category: "Ophthalmic Antibiotic",
              commonDoses: "1 drop every 2h (acute infection — reduce to QDS once improving); ointment 1% apply at night × 5 days",
              route: "Ophthalmic (topical)",
              notes: "Bacterial conjunctivitis (first-line OTC/primary care); blepharitis; broad-spectrum including Staphylococci, H. influenzae; systemic absorption minimal but aplastic anaemia reported (idiosyncratic — extremely rare)",
              sideEffects: "Local stinging/burning on instillation, hypersensitivity reactions; aplastic anaemia (extremely rare — reported with topical eye drops, mechanism unclear)",
              contraindications: "Known hypersensitivity; contact lens wearers (remove lenses before instillation — reinsert 15 min later); avoid in pregnancy (1st trimester)",
              renalDosing: "Not applicable (ophthalmic topical)",
              hepaticDosing: "Not applicable (ophthalmic topical)",
              monitoring: "Clinical response in 48h; no improvement → culture and sensitivity; contact lens advice"),

        .init(name: "Fusidic acid 1% eye drops (Fucithalmic)", category: "Ophthalmic Antibiotic",
              commonDoses: "1 drop BD (viscous gel vehicle — prolongs contact time) × 7 days",
              route: "Ophthalmic (topical)",
              notes: "Bacterial conjunctivitis (especially staphylococcal); BD dosing advantage (viscous gel); less broad-spectrum than chloramphenicol but targeted for Gram-positive organisms",
              sideEffects: "Transient blurred vision after instillation (gel vehicle — temporary), local stinging/burning, hypersensitivity (rare)",
              contraindications: "Hypersensitivity to fusidic acid; contact lens wearers (remove before instillation)",
              renalDosing: "Not applicable",
              hepaticDosing: "Not applicable",
              monitoring: "Clinical response; blurred vision is expected transiently after instillation (advise patient)"),

        .init(name: "Latanoprost 0.005% eye drops (Xalatan)", category: "Ophthalmic — Prostaglandin Analogue",
              commonDoses: "1 drop OD in affected eye(s), preferably in the evening",
              route: "Ophthalmic (topical)",
              notes: "Open-angle glaucoma; ocular hypertension (first-line); increases uveoscleral outflow; irreversible iris pigmentation change — warn patients; evening dosing more effective",
              sideEffects: "Iris pigmentation change (permanent brownish discolouration — warn before prescribing), increased eyelash growth (hypertrichosis), conjunctival hyperaemia, periorbital skin darkening, macular oedema (aphakic/pseudophakic eyes)",
              contraindications: "Aphakic eyes without posterior lens capsule (macular oedema risk); uveitis/anterior segment inflammation; contact lens wearers (instill without lenses — wait 15 min before reinserting)",
              renalDosing: "Not applicable (ophthalmic topical)",
              hepaticDosing: "Not applicable (ophthalmic topical)",
              monitoring: "IOP at 4–6 weeks (response assessment); iris colour at each visit; annual optic disc and visual field; systemic absorption can cause bradycardia — caution with systemic beta-blockers"),

        .init(name: "Timolol 0.25%/0.5% eye drops (Timoptol)", category: "Ophthalmic — Beta-blocker",
              commonDoses: "1 drop BD (0.25% initially — increase to 0.5% if needed); once-daily formulation (gel) available",
              route: "Ophthalmic (topical)",
              notes: "Open-angle glaucoma; ocular hypertension; reduces aqueous humour production; systemic absorption occurs — cardiac/respiratory side effects possible despite topical use",
              sideEffects: "Bronchospasm (contraindicated in asthma/COPD), bradycardia, hypotension, masking of hypoglycaemia symptoms, corneal anaesthesia, dry eyes, contact dermatitis",
              contraindications: "Asthma, COPD, severe bradycardia, 2nd/3rd degree AV block, cardiogenic shock; caution in diabetes mellitus (hypoglycaemia masking); use lacrimal punctal occlusion to minimise systemic absorption",
              renalDosing: "Not applicable (topical); however systemic effects accumulate in renal failure",
              hepaticDosing: "Not applicable (topical); systemic effects more pronounced in hepatic impairment",
              monitoring: "IOP; pulse and BP (systemic absorption); respiratory function; advise nasolacrimal occlusion after instillation to reduce systemic absorption"),

        .init(name: "Prednisolone sodium phosphate 0.5% eye drops", category: "Ophthalmic Corticosteroid",
              commonDoses: "1 drop QDS–hourly (acute inflammation); taper as response occurs; post-operative: QDS × 4 weeks then taper",
              route: "Ophthalmic (topical)",
              notes: "Post-operative ocular inflammation (cataract/vitreoretinal surgery); uveitis; anterior segment inflammation; DO NOT use for infective conjunctivitis (worsens); ophthalmologist supervision for prolonged use",
              sideEffects: "Raised IOP (steroid-induced glaucoma — especially with prolonged use), posterior subcapsular cataract (prolonged use), secondary infections (masked symptoms), delayed wound healing, corneal thinning",
              contraindications: "Ocular viral infections (herpes simplex — dangerous, fungal, bacterial — unless covered), untreated glaucoma (raises IOP), acute purulent conjunctivitis; avoid without ophthalmologist supervision beyond 2 weeks",
              renalDosing: "Not applicable",
              hepaticDosing: "Not applicable",
              monitoring: "IOP at 2–4 weeks (steroid responders can develop dangerous rise); slit-lamp exam; clinical response; taper slowly; ophthalmology follow-up"),

        .init(name: "Hypromellose 0.3% eye drops (artificial tears)", category: "Ophthalmic — Lubricant",
              commonDoses: "1–2 drops PRN as needed (typically 4–6× daily or more); no maximum dose",
              route: "Ophthalmic (topical)",
              notes: "Dry eye syndrome (keratoconjunctivitis sicca); post-operative lubrication; preservative-free formulations preferred for frequent use or contact lens wear; safe in pregnancy",
              sideEffects: "Transient blurred vision immediately after instillation; preservative (benzalkonium chloride) toxicity with very frequent use (prefer preservative-free unit doses)",
              contraindications: "Hypersensitivity to components; preservative-containing drops: avoid contact lens wear (wait 15 min)",
              renalDosing: "Not applicable",
              hepaticDosing: "Not applicable",
              monitoring: "Use preservative-free formulation if >4× daily or contact lens wear; Schirmer's test for dry eye diagnosis"),

        // ─── NEBULISER MEDICATIONS — Additional ───────────────────────────────
        .init(name: "Tobramycin nebulised (TOBI/Bramitob)", category: "Antibiotic — Inhaled Aminoglycoside",
              commonDoses: "300 mg nebulised BD (28 days on, 28 days off cycling); administer with jet nebuliser (not ultrasonic)",
              route: "Nebulised",
              notes: "Cystic fibrosis with chronic Pseudomonas aeruginosa colonisation; not for acute infections; alternating cycle reduces resistance emergence; use after airway clearance physiotherapy",
              sideEffects: "Tinnitus/hearing loss (monitor audiology), voice alteration/dysphonia, bronchospasm (pre-treat with SABA), cough, sputum increase (initially), renal toxicity (minimal with inhalation — less than IV)",
              contraindications: "Hypersensitivity to aminoglycosides; monitor for ototoxicity; not for acute exacerbations",
              renalDosing: "Minimal systemic absorption with inhalation; however, systemic levels should be checked if renal impairment pre-exists",
              hepaticDosing: "Not applicable (inhaled route)",
              monitoring: "Audiometry and vestibular function before each cycle and at 6 months; renal function and drug levels if impairment; lung function (FEV1)"),

        .init(name: "Ipratropium/salbutamol (Combivent)", category: "Bronchodilator — Combined SAMA+SABA",
              commonDoses: "1 unit dose (2.5 mL: salbutamol 2.5 mg + ipratropium 500 mcg) nebulised TDS–QDS; MDI: 2 puffs QDS",
              route: "Nebulised/MDI",
              notes: "Acute COPD exacerbation; severe acute asthma (add ipratropium to salbutamol); greater bronchodilation than either agent alone; more convenient than separate nebulisation",
              sideEffects: "Tachycardia, tremor, palpitations, hypokalaemia (salbutamol component), dry mouth, urinary retention (ipratropium component), paradoxical bronchospasm",
              contraindications: "Hypersensitivity to soya lecithin (MDI — contains soya); narrow-angle glaucoma (protect eyes during nebulisation); urinary retention (BPH)",
              renalDosing: "No dose adjustment",
              hepaticDosing: "No dose adjustment",
              monitoring: "SpO2 and respiratory rate; HR (tachycardia); serum potassium (hypokalaemia risk — especially with concurrent steroids/diuretics/xanthines)"),

        .init(name: "Dornase alfa (Pulmozyme/DNase)", category: "Mucolytic — Recombinant DNase",
              commonDoses: "2.5 mg nebulised OD (CF); some patients benefit from BD dosing; use jet nebuliser",
              route: "Nebulised",
              notes: "Cystic fibrosis (reduces sputum viscosity — cleaves extracellular DNA from neutrophils); use after airway clearance physiotherapy; keep refrigerated (2–8°C); bring to room temperature before use",
              sideEffects: "Voice alteration, pharyngitis, chest pain (pleuritic), rash, conjunctivitis, rhinitis; generally well tolerated",
              contraindications: "Hypersensitivity to dornase alfa or CHO cell-derived products",
              renalDosing: "Not applicable (inhaled — no systemic effect)",
              hepaticDosing: "Not applicable",
              monitoring: "FEV1 and FVC (lung function); pulmonary exacerbation frequency; microbiological cultures"),

        // ─── VACCINES ─────────────────────────────────────────────────────────
        .init(name: "Yellow Fever vaccine (Stamaril)", category: "Vaccine — Live Attenuated",
              commonDoses: "0.5 mL SC single dose (lifelong immunity from 2017 WHO update); booster if at ongoing risk; minimum age 9 months",
              route: "SC",
              notes: "Required for entry to many endemic countries (incl. parts of Caribbean, South/Central America, Africa); administered ONLY at designated Yellow Fever vaccination centres; valid 10 days after vaccination",
              sideEffects: "Injection-site reactions, headache, myalgia, mild fever; viscerotropic disease (rare but potentially fatal — avoid in immunocompromised/elderly/thymus disorders); neurotropic disease (encephalitis — rare in infants)",
              contraindications: "Immunocompromised (HIV CD4 <200, chemotherapy), age <6 months (absolute), 6–9 months (generally avoid), thymus disorders (thymoma, myasthenia), age >60 years (elevated viscerotropic disease risk — weigh risk/benefit), pregnancy (relative — vaccinate if travel unavoidable)",
              renalDosing: "Not applicable",
              hepaticDosing: "Not applicable; avoid in severe hepatic impairment",
              monitoring: "Observe 30 min post-vaccination (anaphylaxis); issue international certificate of vaccination; record batch number; enquire re thymus/immune status before administration"),

        .init(name: "Hepatitis B vaccine (Engerix-B/HBvaxPRO)", category: "Vaccine — Recombinant",
              commonDoses: "Primary: 3 doses at 0, 1, 6 months (standard); accelerated: 0, 1, 2 months + booster 12 months; rapid: 0, 7, 21 days + booster 12 months (travel). HBvaxPRO 40 mcg for haemodialysis",
              route: "IM (deltoid)",
              notes: "Prevention of hepatitis B; part of childhood immunisation schedule (most countries); occupational (healthcare workers); post-exposure prophylaxis (with HBIG); check anti-HBs at 4–8 weeks post-primary course",
              sideEffects: "Injection-site reactions, mild fever, headache, fatigue; anaphylaxis (rare)",
              contraindications: "Hypersensitivity to yeast or any vaccine component; defer if febrile illness (mild illness not a contraindication)",
              renalDosing: "Standard schedule; however, immunocompromised/CKD patients may need double dose or additional booster (check anti-HBs titre); 40 mcg formulation for haemodialysis patients",
              hepaticDosing: "Not applicable",
              monitoring: "Anti-HBs titre 4–8 weeks after completing primary course (target >10 mIU/mL); repeat 3-dose course if non-responder; annual anti-HBs in haemodialysis patients"),

        .init(name: "Hepatitis A vaccine (Havrix/Avaxim)", category: "Vaccine — Inactivated",
              commonDoses: "Primary: 2 doses at 0 and 6–12 months; single dose gives protection from 2 weeks onwards (14 days before travel)",
              route: "IM (deltoid)",
              notes: "Travellers to endemic areas; post-exposure prophylaxis (within 14 days of exposure); long-lasting immunity after 2-dose course (potentially lifelong after booster); combined with Hep B (Twinrix) available",
              sideEffects: "Injection-site reactions, mild fever, headache, fatigue; anaphylaxis (rare)",
              contraindications: "Hypersensitivity to vaccine components or formaldehyde; defer in febrile illness",
              renalDosing: "No dose adjustment; immunocompromised patients may have reduced immune response",
              hepaticDosing: "Not applicable",
              monitoring: "Serological testing not routine (high seroconversion rate); check if immunocompromised (may need additional dose)"),

        .init(name: "Typhoid vaccine (Typherix/Typhim Vi)", category: "Vaccine — Polysaccharide",
              commonDoses: "0.5 mL IM single dose; booster every 3 years if ongoing exposure. Oral: Vivotif 1 capsule alternate days × 3 doses (give 3 days before travel)",
              route: "IM (injected) / PO (oral live)",
              notes: "Caribbean travel prophylaxis; also relevant to food handlers, laboratory workers; oral vaccine (live) requires refrigeration; oral vaccine reduces adherence to antibiotics after taking",
              sideEffects: "IM: injection-site pain, mild fever, myalgia; oral (live): GI upset (nausea, abdominal pain, diarrhoea)",
              contraindications: "Oral live: immunocompromised, antibiotics within 24h of oral dose, antimalarials (proguanil/mefloquine — reduces efficacy; take ≥3 days apart). IM: hypersensitivity",
              renalDosing: "Not applicable",
              hepaticDosing: "Not applicable",
              monitoring: "No post-vaccination serology required; oral vaccine — ensure cold chain compliance; spacing of antimalarials"),

        .init(name: "HPV vaccine (Gardasil-9/Cervarix)", category: "Vaccine — Recombinant VLP",
              commonDoses: "9–14 years: 2 doses 6–12 months apart; 15–26 years: 3 doses at 0, 2, 6 months; 27–45 years: shared decision-making",
              route: "IM (deltoid)",
              notes: "Prevention of HPV-related cervical/anal/oropharyngeal/penile/vulval/vaginal cancers and genital warts (Gardasil-9: 9 strains); most effective before sexual debut; males and females",
              sideEffects: "Injection-site reactions (pain, swelling — most common), syncope (post-vaccination — observe 15 min), fever, headache, dizziness",
              contraindications: "Hypersensitivity to yeast (Gardasil) or any component; pregnancy (defer until after — no evidence of harm but not routinely given)",
              renalDosing: "Not applicable",
              hepaticDosing: "Not applicable",
              monitoring: "Observe 15 min (syncope risk — especially adolescents); no serology required; does not replace cervical screening"),

        .init(name: "Pneumococcal vaccine — Conjugate (Prevenar 13/PCV15/PCV20)", category: "Vaccine — Conjugate",
              commonDoses: "Single dose IM (adults at risk/≥65 yrs); infant schedule varies by national programme (primary 2/3 doses + booster); immunocompromised: 2 doses of PCV13 then PPSV23 (8 weeks later)",
              route: "IM",
              notes: "High-risk adults: asplenia, CKD, immunocompromised, diabetes, chronic liver/heart/lung disease, CSF leaks; post-splenectomy mandatory; may require PPSV23 sequentially",
              sideEffects: "Injection-site reactions, mild fever, myalgia; anaphylaxis (rare)",
              contraindications: "Hypersensitivity to diphtheria toxoid (conjugate carrier); febrile illness (defer)",
              renalDosing: "No dose adjustment; CKD is an indication for vaccination",
              hepaticDosing: "No dose adjustment; cirrhosis/chronic liver disease is an indication",
              monitoring: "High-risk patients: consider anti-pneumococcal antibody levels after vaccination to confirm response; PPSV23 5 years after PCV13 in asplenic patients"),

        .init(name: "Tetanus/Diphtheria/Pertussis (Td/IPV or Tdap — Boostrix/Adacel)", category: "Vaccine — Inactivated Combination",
              commonDoses: "Booster: single dose IM/SC every 10 years (or when wound management requires); pregnancy: 1 dose each pregnancy (27–36 weeks gestation for infant pertussis protection)",
              route: "IM",
              notes: "Tetanus prophylaxis in wounds (assess last vaccination; consider HTIG if >10 years or high-risk wound); pertussis booster in pregnancy (cocoon strategy for neonate); diphtheria prophylaxis",
              sideEffects: "Injection-site reactions (pain, redness, swelling), fever, myalgia, headache; arthus reaction (severe local reaction if too many boosters — avoid giving >1 tetanus-containing vaccine in 5 years)",
              contraindications: "Previous anaphylaxis to this vaccine or components; severe local reaction (arthus) within 10 years: postpone tetanus boosters; encephalopathy within 7 days of pertussis component",
              renalDosing: "Not applicable",
              hepaticDosing: "Not applicable",
              monitoring: "Document date of all tetanus doses; assess wound characteristics (clean/tetanus-prone); consider HTIG if >10 years since last dose for contaminated wounds; avoid >1 tetanus dose in 5-year window"),

        .init(name: "Meningococcal ACWY vaccine (Menveo/Nimenrix)", category: "Vaccine — Conjugate",
              commonDoses: "Single dose IM (adolescents, travellers, asplenic/complement deficiency); booster every 5 years for ongoing high-risk (asplenia, meningitis belt travel)",
              route: "IM",
              notes: "Meningococcal disease prevention; mandatory for Hajj/Umrah; sub-Saharan Africa travel (meningitis belt); asplenia/complement deficiency; adolescent programme in many countries; add MenB (Bexsero) for comprehensive cover",
              sideEffects: "Injection-site reactions, headache, mild fever, myalgia, fatigue; anaphylaxis (rare)",
              contraindications: "Hypersensitivity to diphtheria toxoid or any component; defer if febrile illness",
              renalDosing: "Not applicable",
              hepaticDosing: "Not applicable",
              monitoring: "Ensure conjugate (not plain polysaccharide) for long-term protection; post-splenectomy: give ≥2 weeks before elective splenectomy if possible; document on patient's record"),
    ]

    // ─── ONCOLOGY / CHEMOTHERAPY ─────────────────────────────────────────────
    private static let _drugs9: [SurgicalDrug] = [

        // Platinum agents
        .init(name: "Cisplatin",         category: "Chemotherapy — Platinum Agent",
              commonDoses: "75–100 mg/m² IV q3 weeks (in 0.9% NaCl with aggressive hydration)",
              route: "IV infusion",
              notes: "Testicular, bladder, ovarian, lung, oesophageal, gastric, H&N cancers; pre- and post-hydration mandatory (1–2 L NS); antiemetics essential (NK1 + 5-HT3 + dex); cumulative nephrotoxicity",
              sideEffects: "Nephrotoxicity (dose-limiting — hydration mandatory), ototoxicity (irreversible high-frequency hearing loss), neuropathy (cumulative), severe nausea/vomiting, myelosuppression, electrolyte wasting (Mg²⁺, K⁺, Na⁺), alopecia",
              contraindications: "eGFR <60 mL/min (relative — consider carboplatin), pre-existing neuropathy/hearing loss, pregnancy, breastfeeding",
              renalDosing: "eGFR 50–60: use with caution. eGFR <50: switch to carboplatin. eGFR <30: contraindicated",
              hepaticDosing: "No standard dose adjustment; use with caution in severe hepatic impairment",
              monitoring: "U&E, Mg²⁺, Cr before each cycle; audiogram at baseline and after cumulative dose; neuropathy assessment; urine output ≥100 mL/h during infusion"),

        .init(name: "Carboplatin",       category: "Chemotherapy — Platinum Agent",
              commonDoses: "AUC 5–6 IV q3 weeks (Calvert formula: dose (mg) = AUC × [GFR + 25])",
              route: "IV infusion",
              notes: "Ovarian, lung, testicular, endometrial cancers; less nephrotoxic and emetogenic than cisplatin; dose by Calvert formula using eGFR (cap at 125 mL/min per ASCO); preferred in renal impairment",
              sideEffects: "Myelosuppression (dose-limiting — especially thrombocytopenia), nausea/vomiting (less severe than cisplatin), nephrotoxicity (less common), peripheral neuropathy, ototoxicity (less than cisplatin), hypersensitivity (>6 cycles — carboplatin allergy)",
              contraindications: "Severe bone marrow suppression, history of severe platinum hypersensitivity, pregnancy",
              renalDosing: "Dose by Calvert formula (GFR-based); reduce GFR cap to 125 mL/min (ASCO); eGFR <15: avoid",
              hepaticDosing: "No standard adjustment; use with caution",
              monitoring: "FBC, renal function, Mg²⁺ before each cycle; Calvert formula requires accurate eGFR; allergy protocol after ≥6 cycles"),

        .init(name: "Oxaliplatin",       category: "Chemotherapy — Platinum Agent",
              commonDoses: "85 mg/m² IV q2 weeks (FOLFOX) or 130 mg/m² IV q3 weeks (CAPOX)",
              route: "IV infusion over 2–6h",
              notes: "Colorectal cancer (metastatic and adjuvant); in 5% dextrose ONLY (not NaCl — precipitates); two neuropathy syndromes: acute cold-triggered and cumulative sensory",
              sideEffects: "Acute neuropathy (cold-triggered paraesthesiae — avoid cold after infusion), cumulative sensory peripheral neuropathy (dose-limiting), nausea, myelosuppression, fatigue, laryngopharyngeal dysaesthesia (acute — benign)",
              contraindications: "Severe neuropathy at baseline, pregnancy; avoid cold exposure immediately post-infusion",
              renalDosing: "eGFR 30–59: consider dose reduction. eGFR <30: avoid",
              hepaticDosing: "No standard adjustment; use with caution in severe impairment",
              monitoring: "FBC, renal function before each cycle; neuropathy grading; advise re cold avoidance for 3–5 days post-infusion"),

        .init(name: "Ifosfamide",        category: "Chemotherapy — Alkylating Agent",
              commonDoses: "1.2–2.5 g/m²/day IV × 5 days q3 weeks (with MESNA)",
              route: "IV infusion",
              notes: "Sarcoma, testicular, cervical cancers; ALWAYS give MESNA (prevents haemorrhagic cystitis); aggressive hydration required; encephalopathy risk — discontinue if confusion/hallucinations; methylene blue for ifosfamide encephalopathy",
              sideEffects: "Haemorrhagic cystitis (MESNA mandatory), CNS toxicity/encephalopathy (confusion, hallucinations — stop drug immediately), myelosuppression, nausea/vomiting, alopecia, nephrotoxicity (Fanconi syndrome — tubular)",
              contraindications: "Severe bone marrow suppression, renal impairment (nephrotoxicity risk), urinary tract obstruction, prior cisplatin-induced nephrotoxicity (increases CNS toxicity)",
              renalDosing: "Dose reduction required; avoid eGFR <30 mL/min",
              hepaticDosing: "Reduce dose in severe hepatic impairment (prodrug requiring hepatic activation)",
              monitoring: "FBC, renal function, urinalysis (blood — stop if haemorrhagic cystitis despite MESNA); neurological status throughout infusion"),

        // Antimetabolites / Fluoropyrimidines
        .init(name: "5-Fluorouracil (5-FU)", category: "Chemotherapy — Fluoropyrimidine",
              commonDoses: "400 mg/m² IV bolus then 2400 mg/m² CI over 46h q2 weeks (FOLFOX/FOLFIRI); 500–1000 mg/m² CI over 5 days q4 weeks",
              route: "IV bolus / continuous infusion",
              notes: "Colorectal, gastric, oesophageal, pancreatic, breast, H&N cancers; dose-limiting toxicity differs — bolus: myelosuppression/mucositis; infusion: palmar-plantar erythrodysaesthesia (PPE); DPD deficiency → fatal toxicity (test before starting)",
              sideEffects: "Mucositis/stomatitis, diarrhoea, myelosuppression, PPE (hand-foot syndrome with infusion regimens), cardiotoxicity (vasospasm — chest pain, ECG changes; stop immediately), DPD deficiency → severe toxicity",
              contraindications: "DPD deficiency (DPYD genotyping recommended before treatment — severe/fatal toxicity risk), recent MI, current coronary artery disease (relative), pregnancy",
              renalDosing: "No standard dose reduction; however renal failure reduces drug clearance — use with caution",
              hepaticDosing: "Reduce dose in severe hepatic impairment (bilirubin >3× ULN: reduce by 50%)",
              monitoring: "FBC, LFTs before each cycle; mucositis assessment; DPD/DPYD testing before starting; cardiotoxicity monitoring (ECG if symptoms)"),

        .init(name: "Capecitabine (Xeloda)", category: "Chemotherapy — Fluoropyrimidine (Oral)",
              commonDoses: "1250 mg/m² BD PO (days 1–14, q3 weeks); adjuvant CRC: 1250 mg/m² BD × 14 days; hepatic metastases: 1000 mg/m² BD",
              route: "PO (with food, 30 min after meals)",
              notes: "Oral prodrug of 5-FU; colorectal, gastric, breast cancers; warfarin interaction (↑ INR significantly — frequent monitoring); renal dosing essential; DPD deficiency testing recommended",
              sideEffects: "PPE/hand-foot syndrome (dose-limiting — moisturise, dose reduce; inform patient early), diarrhoea, mucositis, nausea, fatigue, hyperbilirubinaemia, cardiotoxicity (same as 5-FU), warfarin interaction",
              contraindications: "DPD deficiency, eGFR <30 mL/min, warfarin (relative — use LMWH instead), pregnancy",
              renalDosing: "eGFR 30–50: 75% dose. eGFR <30: contraindicated",
              hepaticDosing: "Mild–moderate: no adjustment. Severe: avoid (limited data)",
              monitoring: "FBC, renal function, LFTs before each cycle; PPE assessment; INR if on warfarin (check weekly); DPD testing before starting"),

        .init(name: "Gemcitabine (Gemzar)", category: "Chemotherapy — Antimetabolite (Nucleoside Analogue)",
              commonDoses: "1000–1250 mg/m² IV over 30 min on days 1, 8 (q3 weeks) or days 1, 8, 15 (q4 weeks); pancreatic: 1000 mg/m² weekly × 7 then weekly × 3 q4 weeks",
              route: "IV infusion over 30 min",
              notes: "Pancreatic, NSCLC, bladder, ovarian, breast cancers; infusion over 30 min (longer infusion ↑ toxicity); flu-like syndrome common first 24h; radiation sensitiser — avoid concurrent radiotherapy",
              sideEffects: "Myelosuppression (especially thrombocytopenia), flu-like syndrome (fever, myalgia, headache — within 24h), nausea, transaminitis, peripheral oedema, pulmonary toxicity (rare — pneumonitis), haemolytic uraemic syndrome (rare)",
              contraindications: "Concurrent radiation therapy (increased toxicity), severe hepatic impairment, pregnancy",
              renalDosing: "No standard dose adjustment; use with caution; gemcitabine-associated HUS risk higher in renal impairment",
              hepaticDosing: "Mild: no adjustment. Severe hepatic impairment: avoid or use with caution",
              monitoring: "FBC and LFTs before each dose; renal function (HUS — microangiopathic haemolysis); pulmonary symptoms"),

        // Anthracyclines
        .init(name: "Doxorubicin (Adriamycin)", category: "Chemotherapy — Anthracycline",
              commonDoses: "60–75 mg/m² IV q3 weeks (single agent); 40–50 mg/m² IV (combination); liposomal (Caelyx): 40–50 mg/m² q4 weeks",
              route: "IV bolus / infusion (vesicant — central line preferred)",
              notes: "Breast, lymphoma (CHOP), sarcoma, gastric, hepatocellular cancers; VESICANT — extravasation causes severe tissue necrosis (use central line or secure peripheral, give antidote dexrazoxane); cumulative cardiotoxicity — lifetime max dose 450–550 mg/m²",
              sideEffects: "Cardiotoxicity (dilated cardiomyopathy — cumulative; lifetime dose limit 450–550 mg/m²), myelosuppression, alopecia, nausea/vomiting, mucositis, red discolouration of urine (benign — warn patient), extravasation necrosis (vesicant)",
              contraindications: "LVEF <45–50% (baseline echo mandatory), prior anthracycline to cumulative maximum, uncontrolled cardiac failure, pregnancy",
              renalDosing: "No standard dose adjustment for conventional doxorubicin",
              hepaticDosing: "Bilirubin 1.2–3 mg/dL: 50% dose. Bilirubin >3 mg/dL: 25% dose",
              monitoring: "LVEF by echo before, during (q3 cycles ≥300 mg/m²) and after; FBC before each cycle; cumulative dose tracking; cardiac symptoms"),

        .init(name: "Epirubicin",        category: "Chemotherapy — Anthracycline",
              commonDoses: "60–100 mg/m² IV q3 weeks (breast — EC/FEC regimen); up to 120 mg/m² (dose-intense); lifetime maximum 900–1000 mg/m²",
              route: "IV bolus / infusion (vesicant)",
              notes: "Breast, gastric cancers; FEC-T/EC-T regimens; same mechanism as doxorubicin but different toxicity profile; higher lifetime dose limit (900 mg/m²); VESICANT",
              sideEffects: "Cardiotoxicity (cumulative — lower risk per mg than doxorubicin), myelosuppression, alopecia, nausea/vomiting, mucositis, red discolouration of urine (benign), amenorrhoea",
              contraindications: "LVEF <50%, prior anthracycline at cumulative limit, uncontrolled cardiac failure, pregnancy",
              renalDosing: "No dose adjustment for conventional doses",
              hepaticDosing: "Bilirubin 1.2–3 mg/dL: 50% dose. Bilirubin >3 mg/dL: 25% dose; AST 2–4× ULN: 50% dose",
              monitoring: "LVEF by echo before and during treatment; FBC before each cycle; cumulative dose tracking"),

        // Taxanes
        .init(name: "Paclitaxel (Taxol)", category: "Chemotherapy — Taxane",
              commonDoses: "175 mg/m² IV over 3h q3 weeks; or 80 mg/m² IV weekly (dose-dense); nab-paclitaxel (Abraxane): 100–125 mg/m² IV weekly or 260 mg/m² q3 weeks",
              route: "IV infusion (premedication with dex + antihistamine required)",
              notes: "Breast, ovarian, NSCLC, endometrial, H&N cancers; Cremophor-based vehicle (solvent) → premedication mandatory (dexamethasone 8 mg IV + diphenhydramine + H2 blocker); hypersensitivity reactions common without premedication",
              sideEffects: "Peripheral sensory neuropathy (dose-limiting cumulative), myelosuppression (nadir day 8), alopecia, arthralgia/myalgia (D2–3 post-infusion), hypersensitivity reactions (prevent with premedication), bradycardia",
              contraindications: "Pre-existing grade ≥2 neuropathy, neutrophils <1500/µL, Cremophor hypersensitivity (use nab-paclitaxel instead), pregnancy",
              renalDosing: "No standard dose adjustment",
              hepaticDosing: "Bilirubin >1.25× ULN: dose reduce 25–50% depending on LFTs; AST >10× ULN: avoid",
              monitoring: "Neuropathy grading; FBC; LFTs; hypersensitivity monitoring during infusion (first 15 min); pre-medication check"),

        .init(name: "Docetaxel (Taxotere)", category: "Chemotherapy — Taxane",
              commonDoses: "75–100 mg/m² IV q3 weeks (single agent/combination); 75 mg/m² (combination with carboplatin); dexamethasone premedication 8 mg BD × 3 days",
              route: "IV infusion over 1h (premedication required)",
              notes: "Breast, NSCLC, prostate, gastric, H&N cancers; dexamethasone premedication × 3 days mandatory (prevents fluid retention and hypersensitivity); cumulative fluid retention syndrome (weight gain, oedema)",
              sideEffects: "Myelosuppression (dose-limiting — febrile neutropenia risk higher than paclitaxel), alopecia, fluid retention/oedema (cumulative — steroid premedication reduces), nail changes, peripheral neuropathy, hypersensitivity, fatigue",
              contraindications: "Neutrophils <1500/µL, severe hepatic impairment, polysorbate-80 hypersensitivity, pregnancy",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Bilirubin >ULN or AST/ALT >3.5× ULN (with elevated bilirubin): avoid; AST/ALT >1.5× ULN + bilirubin normal: 25% dose reduction",
              monitoring: "FBC before each cycle; liver function; fluid retention assessment (weight weekly, oedema); neuropathy grading"),

        // Vinca Alkaloids
        .init(name: "Vincristine",       category: "Chemotherapy — Vinca Alkaloid",
              commonDoses: "1.4 mg/m² IV (max 2 mg per dose) weekly (CHOP) or q3 weeks",
              route: "IV bolus only (FATAL if intrathecal — intrathecal vincristine is absolutely fatal)",
              notes: "Lymphoma (CHOP/CHVPP), leukaemia, paediatric solid tumours; NEVER give intrathecal (invariably fatal — safety measures mandatory); dose-cap 2 mg regardless of BSA; severe constipation — prophylactic laxatives mandatory",
              sideEffects: "Peripheral neuropathy (dose-limiting — sensory then motor; stockings-and-gloves distribution), severe constipation (ileus risk — prophylactic laxatives mandatory), alopecia, jaw pain, SIADH",
              contraindications: "INTRATHECAL ADMINISTRATION (ABSOLUTELY FATAL), demyelinating Charcot-Marie-Tooth disease, pre-existing severe neuropathy, pregnancy",
              renalDosing: "No dose adjustment",
              hepaticDosing: "Bilirubin >3 mg/dL: 50% dose; severe impairment: 75% dose reduction",
              monitoring: "Neuropathy assessment; constipation/bowel function (prophylactic laxatives); SIADH (sodium); dose cap 2 mg — document clearly"),

        .init(name: "Vinorelbine (Navelbine)", category: "Chemotherapy — Vinca Alkaloid",
              commonDoses: "IV: 25–30 mg/m² weekly; oral: 60 mg/m² weekly × 3 then 80 mg/m² weekly if tolerated",
              route: "IV infusion over 6–10 min (vesicant) / PO capsule",
              notes: "NSCLC, breast cancer; IV is a VESICANT — central line strongly preferred; oral formulation available (no IV extravasation risk, but GI toxicity); granulocyte nadir day 7–10",
              sideEffects: "Myelosuppression (neutropenia — dose-limiting), peripheral neuropathy, nausea/vomiting, constipation, alopecia (less than other vinca alkaloids), phlebitis/extravasation necrosis (IV — vesicant)",
              contraindications: "Neutrophils <1000/µL, bowel obstruction (PO only), intrathecal use (fatal), pregnancy",
              renalDosing: "No standard dose adjustment",
              hepaticDosing: "Bilirubin 2–3 mg/dL: 50% dose. Bilirubin >3 mg/dL: 25% dose",
              monitoring: "FBC weekly; neuropathy assessment; constipation; extravasation precautions"),

        // Targeted therapies — Small molecule inhibitors
        .init(name: "Imatinib (Gleevec/Glivec)", category: "Chemotherapy — Tyrosine Kinase Inhibitor",
              commonDoses: "CML: 400 mg OD PO (chronic phase); 600–800 mg OD (accelerated/blast); GIST: 400 mg OD; c-Kit exon 9 mutation: 800 mg OD",
              route: "PO (with food and large glass of water)",
              notes: "CML, GIST, Ph+ ALL; taken with food to reduce GI upset; multiple drug interactions (CYP3A4 substrate/inhibitor); first-line TKI for CML; monitor for fluid retention",
              sideEffects: "Nausea/vomiting (take with food), oedema/fluid retention, myelosuppression, muscle cramps (common — tonic water/quinine), transaminitis, rash, fatigue",
              contraindications: "Pregnancy (teratogen), breastfeeding; relative: severe cardiac failure",
              renalDosing: "eGFR 20–39: 50% starting dose; eGFR <20: not recommended",
              hepaticDosing: "Mild–moderate: use with caution; severe: 25% dose reduction",
              monitoring: "FBC weekly × 1 month, biweekly × 2 months, then monthly; LFTs monthly × 3 then q3 months; cytogenetic response (BCR-ABL PCR monitoring)"),

        .init(name: "Erlotinib (Tarceva)", category: "Chemotherapy — EGFR Tyrosine Kinase Inhibitor",
              commonDoses: "NSCLC: 150 mg OD PO (1h before or 2h after meals); pancreatic: 100 mg OD PO (with gemcitabine)",
              route: "PO (fasting — food significantly increases absorption → toxicity)",
              notes: "NSCLC with EGFR mutation (exon 19 del/L858R), pancreatic cancer; MUST be taken fasting; smoking reduces efficacy by 50% — discourage smoking; rash correlates with response",
              sideEffects: "Rash/acneiform eruption (80–90% — correlates with efficacy; treat with tetracycline), diarrhoea (dose-limiting), interstitial lung disease (rare but serious — stop drug), hepatotoxicity, fatigue",
              contraindications: "Interstitial lung disease (contraindicated), pregnancy; caution smoking (reduces levels significantly)",
              renalDosing: "No standard adjustment (minimal renal excretion)",
              hepaticDosing: "Use with caution; hold if bilirubin >3× ULN or transaminases >5× ULN",
              monitoring: "Rash management; LFTs; pulmonary symptoms (ILD — stop immediately); smoking cessation counselling"),

        .init(name: "Sorafenib (Nexavar)", category: "Chemotherapy — Multi-Kinase Inhibitor",
              commonDoses: "400 mg BD PO (without food — 1h before or 2h after meals)",
              route: "PO",
              notes: "Hepatocellular carcinoma (first-line advanced), renal cell carcinoma, thyroid cancer; Raf/VEGFR/PDGFR inhibitor; hand-foot skin reaction (HFSR) very common — active skin care essential from day 1",
              sideEffects: "HFSR/hand-foot skin reaction (dose-limiting — painful blisters on pressure points; prophylactic urea cream), diarrhoea, hypertension (monitor BP from day 1), fatigue, alopecia, bleeding, QT prolongation, cardiac ischaemia",
              contraindications: "Pregnancy, squamous NSCLC (increased bleeding risk), severe hepatic impairment",
              renalDosing: "No dose adjustment (eGFR >30); eGFR <30: limited data — caution",
              hepaticDosing: "Child-Pugh A/B: full dose. Child-Pugh C: not recommended",
              monitoring: "BP weekly × 6 weeks then monthly; HFSR grading; LFTs; ECG (QT prolongation)"),

        .init(name: "Sunitinib (Sutent)",  category: "Chemotherapy — Multi-Kinase Inhibitor",
              commonDoses: "GIST/RCC: 50 mg OD PO × 4 weeks, 2 weeks off (4/2 schedule); pNET: 37.5 mg OD continuous",
              route: "PO (with or without food)",
              notes: "Renal cell carcinoma, GIST (imatinib-resistant), pancreatic NET; VEGFR/PDGFR/c-Kit inhibitor; thyroid function testing mandatory (hypothyroidism); yellow skin discolouration (benign — warn patient)",
              sideEffects: "Hypertension (treat proactively — poor control → drug hold), hypothyroidism (cumulative — check TSH monthly), HFSR, diarrhoea, mucositis, fatigue, yellow skin/hair (benign), myelosuppression, hepatotoxicity, cardiac toxicity",
              contraindications: "Pregnancy, uncontrolled hypertension",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Child-Pugh A/B: no adjustment. Child-Pugh C: not recommended",
              monitoring: "BP weekly × 6 weeks; TSH monthly; FBC and LFTs every 2 cycles; ECG (QT prolongation); LVEF at baseline and periodically"),

        // Monoclonal antibodies — Targeted
        .init(name: "Trastuzumab (Herceptin)", category: "Chemotherapy — HER2 Monoclonal Antibody",
              commonDoses: "8 mg/kg IV loading (q3 weekly), 6 mg/kg IV maintenance q3 weeks; or 4 mg/kg loading, 2 mg/kg weekly; SC formulation: 600 mg SC q3 weeks (fixed dose)",
              route: "IV infusion / SC injection",
              notes: "HER2+ breast cancer (early and metastatic), HER2+ gastric/gastro-oesophageal cancer; requires HER2 3+ IHC or FISH amplification; LVEF monitoring mandatory; first infusion reaction common; avoid concurrent anthracyclines (cardiac risk additive)",
              sideEffects: "Cardiotoxicity (cardiomyopathy — particularly with anthracyclines; hold if LVEF drops ≥10% or below 50%), infusion reactions (first infusion — chills, fever — pre-medicate), myelosuppression (mild), ILD (rare), diarrhoea",
              contraindications: "LVEF <50% (relative — hold and reassess), pregnancy (HPW after completion before conception), concurrent anthracyclines (cardiac)",
              renalDosing: "No dose adjustment (not renally cleared)",
              hepaticDosing: "No dose adjustment",
              monitoring: "LVEF by echo before, every 3 months during and after treatment; LVEF hold protocol: drop ≥16% absolute or to below 50% → hold 4 weeks → recheck; FBC"),

        .init(name: "Bevacizumab (Avastin)", category: "Chemotherapy — VEGF Monoclonal Antibody",
              commonDoses: "CRC: 5 mg/kg IV q2 weeks (with FOLFOX/FOLFIRI) or 7.5 mg/kg q3 weeks; NSCLC/RCC: 15 mg/kg IV q3 weeks; hold 4–8 weeks before/after surgery",
              route: "IV infusion (initial 90 min; subsequent 60 then 30 min if tolerated)",
              notes: "CRC, NSCLC, RCC, ovarian, cervical, glioblastoma; MUST withhold 4–6 weeks pre-surgery and 4 weeks post-surgery (impaired wound healing); arterial thrombotic events, GI perforation risk",
              sideEffects: "Hypertension (monitor closely; treat with antihypertensives), proteinuria (check U-PCR), arterial thromboembolism (ATE — MI, stroke), GI perforation (1–3% — stop permanently), wound healing impairment, bleeding (epistaxis, haemoptysis), fistula formation",
              contraindications: "Recent haemoptysis, recent arterial thrombotic event, GI perforation history, uncontrolled hypertension, wound healing (surgical — hold peri-operatively), pregnancy",
              renalDosing: "No dose adjustment (not renally cleared); proteinuria monitoring essential",
              hepaticDosing: "No dose adjustment",
              monitoring: "BP every 2–3 weeks; U-PCR before each cycle (hold for >2 g/24h); ATE symptoms; GI symptoms (perforation risk)"),

        .init(name: "Cetuximab (Erbitux)",  category: "Chemotherapy — EGFR Monoclonal Antibody",
              commonDoses: "400 mg/m² IV loading over 2h, then 250 mg/m² weekly over 1h; or 500 mg/m² IV q2 weeks",
              route: "IV infusion (premedication with antihistamine)",
              notes: "RAS wild-type CRC, H&N squamous cell carcinoma; ONLY effective in KRAS/NRAS/BRAF wild-type CRC — mandatory RAS/BRAF testing before prescribing; acneiform rash correlates with efficacy; first infusion reactions common",
              sideEffects: "Acneiform rash (80–90% — correlates with efficacy; treat with tetracycline + topical), hypomagnesaemia (supplement Mg²⁺ throughout), first-infusion hypersensitivity/anaphylaxis (pre-medicate), diarrhoea, fatigue",
              contraindications: "KRAS mutant CRC (no benefit), pregnancy",
              renalDosing: "No dose adjustment",
              hepaticDosing: "No dose adjustment",
              monitoring: "RAS/BRAF status before prescribing; Mg²⁺ weekly (supplement to maintain ≥0.7 mmol/L); rash management protocol; infusion reaction monitoring"),

        // Immunotherapy (ICIs)
        .init(name: "Pembrolizumab (Keytruda)", category: "Chemotherapy — PD-1 Immune Checkpoint Inhibitor",
              commonDoses: "200 mg IV q3 weeks or 400 mg IV q6 weeks (fixed dose, all indications)",
              route: "IV infusion over 30 min",
              notes: "NSCLC (PD-L1+), melanoma, HNSCC, urothelial, CRC (MSI-H/dMMR), gastric, oesophageal, cervical, endometrial, TNBC, TMB-H solid tumours; PD-L1/MSI/TMB testing for indication-specific use; immune-mediated adverse events affect every organ",
              sideEffects: "Immune-related adverse events (irAEs — any organ): pneumonitis, colitis/diarrhoea, hepatitis, endocrinopathies (hypothyroidism, hypophysitis, adrenal insufficiency — permanent), rash, nephritis, myocarditis (rare but potentially fatal); fatigue",
              contraindications: "Active autoimmune disease requiring immunosuppression (relative — assess risk/benefit), organ transplant (risk of graft rejection), pregnancy; caution: prior severe irAE",
              renalDosing: "No dose adjustment",
              hepaticDosing: "No dose adjustment for mild–moderate; limited data in severe impairment",
              monitoring: "TFTs, LFTs, renal function, glucose, cortisol at baseline and each cycle; CXR/CT if respiratory symptoms (pneumonitis); early steroid treatment for irAEs (prednisolone 1–2 mg/kg); permanent endocrinopathies require lifelong hormone replacement"),

        .init(name: "Nivolumab (Opdivo)",   category: "Chemotherapy — PD-1 Immune Checkpoint Inhibitor",
              commonDoses: "240 mg IV q2 weeks or 480 mg IV q4 weeks (flat dose); in combination with ipilimumab: 1 mg/kg IV q3 or q6 weeks",
              route: "IV infusion over 30 min",
              notes: "Melanoma, NSCLC, RCC, urothelial, HNSCC, CRC (MSI-H), oesophageal, gastric, HCC; similar irAE profile to pembrolizumab; combination with ipilimumab increases efficacy AND irAE frequency",
              sideEffects: "irAEs (same spectrum as pembrolizumab — pneumonitis, colitis, hepatitis, endocrinopathies, rash, nephritis, myocarditis); fatigue; combination with ipilimumab → significantly higher grade 3–4 irAE rate",
              contraindications: "Active autoimmune disease, organ transplant, pregnancy; prior severe irAE with any ICI (relative)",
              renalDosing: "No dose adjustment",
              hepaticDosing: "No dose adjustment for mild–moderate",
              monitoring: "Same as pembrolizumab; TFTs, LFTs, renal function, cortisol, glucose; higher vigilance with ipilimumab combination"),

        .init(name: "Ipilimumab (Yervoy)",  category: "Chemotherapy — CTLA-4 Immune Checkpoint Inhibitor",
              commonDoses: "Melanoma: 3 mg/kg IV q3 weeks × 4 doses; adjuvant melanoma: 10 mg/kg q3 weeks × 4, then q12 weeks × 3 years; combination with nivolumab: 1 mg/kg IV q6 weeks",
              route: "IV infusion over 30 min–3h",
              notes: "Melanoma (CTLA-4 blockade); higher dose/combination → superior efficacy but significantly more severe irAEs; permanently discontinue for grade 3–4 irAE (except endocrinopathy); CTLA-4 blockade irAEs typically later-onset and more severe than PD-1",
              sideEffects: "irAEs (more severe than PD-1 inhibitors): colitis/diarrhoea (dose-limiting — grade 3–4 in ~20% at 3 mg/kg), hepatitis, rash/dermatitis, hypophysitis, pneumonitis, nephritis, uveitis; grade 3–4 irAE in >50% at 10 mg/kg",
              contraindications: "Active autoimmune disease, organ transplant, pregnancy; grade 3–4 prior irAE",
              renalDosing: "No dose adjustment",
              hepaticDosing: "No dose adjustment for mild–moderate",
              monitoring: "LFTs, renal function, TFTs, cortisol, ACTH before each cycle; early high-dose steroids for grade 2+ colitis/hepatitis; infliximab for steroid-refractory colitis; mycophenolate for steroid-refractory hepatitis"),

        // Hormonal therapies
        .init(name: "Tamoxifen",           category: "Chemotherapy — SERM (Oestrogen Receptor Modulator)",
              commonDoses: "20 mg OD PO × 5–10 years (breast cancer); 5 mg OD (prevention/risk reduction)",
              route: "PO",
              notes: "ER+ breast cancer (pre- and post-menopausal); adjuvant 5–10 years significantly improves overall survival; switch to aromatase inhibitor (post-menopausal) after 2–5 years; CYP2D6 metaboliser status affects efficacy (avoid CYP2D6 inhibitors: paroxetine, fluoxetine)",
              sideEffects: "Hot flushes, vaginal discharge/dryness, menstrual irregularities, endometrial cancer risk (1–2-fold increase — annual gynaecological review; report abnormal bleeding), thromboembolic events (DVT/PE — hold surgery), mood changes, cataracts",
              contraindications: "Pregnancy (teratogen), active thromboembolic disease, avoid concurrent CYP2D6 inhibitors (reduce active metabolite endoxifen — reduced efficacy)",
              renalDosing: "No dose adjustment",
              hepaticDosing: "Use with caution in severe hepatic impairment",
              monitoring: "Annual gynaecological review + any abnormal uterine bleeding investigated (transvaginal US/biopsy); ophthalmological review; bone density (may improve in post-menopausal); annual smear"),

        .init(name: "Anastrozole (Arimidex)", category: "Chemotherapy — Aromatase Inhibitor",
              commonDoses: "1 mg OD PO × 5–10 years (post-menopausal)",
              route: "PO",
              notes: "ER+ breast cancer (post-menopausal only — oestrogen suppression requires menopause; ineffective in pre-menopausal); adjuvant 5–10 years; superior to tamoxifen in post-menopausal women; no uterine cancer risk",
              sideEffects: "Hot flushes, joint pain/stiffness (arthralgias — very common; consider switching to letrozole), bone loss (osteoporosis — DEXA scan, calcium/Vit D, bisphosphonate if high risk), vaginal dryness, headache",
              contraindications: "Pre-menopausal patients (ineffective), pregnancy, osteoporosis (relative — use with bone protection)",
              renalDosing: "No dose adjustment",
              hepaticDosing: "Mild–moderate: no adjustment. Severe: avoid",
              monitoring: "DEXA scan at baseline and 1–2 yearly; calcium/Vit D supplementation; joint symptoms; lipid profile"),

        .init(name: "Letrozole (Femara)",  category: "Chemotherapy — Aromatase Inhibitor",
              commonDoses: "2.5 mg OD PO × 5–10 years (adjuvant); 2.5 mg OD (metastatic)",
              route: "PO",
              notes: "ER+ breast cancer (post-menopausal); alternative to anastrozole — similar efficacy; often used when intolerant of anastrozole arthralgias; also used for ovulation induction (off-label); may have fewer joint side effects than anastrozole for some patients",
              sideEffects: "Hot flushes, bone loss/osteoporosis (DEXA monitoring), arthralgias (common but may be less than anastrozole), fatigue, hypercholesterolaemia, headache",
              contraindications: "Pre-menopausal patients, pregnancy",
              renalDosing: "eGFR >10: no adjustment. Severe: no recommendation",
              hepaticDosing: "Mild–moderate: no adjustment. Severe (Child-Pugh C): 50% dose (2.5 mg alternate days)",
              monitoring: "DEXA scan; lipid profile; joint symptoms"),

        .init(name: "Fulvestrant (Faslodex)", category: "Chemotherapy — Oestrogen Receptor Degrader (SERD)",
              commonDoses: "500 mg IM monthly (two 250 mg injections on day 1, then day 15 of cycle 1, then monthly); slow IM injection into buttock — not IV",
              route: "IM injection (gluteal)",
              notes: "ER+ HER2- advanced/metastatic breast cancer (post-menopausal and pre-menopausal with ovarian suppression); CDK4/6 inhibitor combinations; no cross-resistance with tamoxifen; injection site reactions common",
              sideEffects: "Injection site reactions (pain, inflammation, warmth — common), hot flushes, nausea, fatigue, hepatotoxicity, thromboembolism (less than tamoxifen), arthralgia",
              contraindications: "Pregnancy, coagulopathy/anticoagulation (relative — IM injection risk), severe hepatic impairment",
              renalDosing: "No dose adjustment",
              hepaticDosing: "Mild–moderate (Child-Pugh A/B): no adjustment. Severe (Child-Pugh C): not recommended",
              monitoring: "LFTs; injection site assessment; response assessment by imaging"),

        // Anti-nausea (chemo-specific)
        .init(name: "Granisetron (Kytril)", category: "Antiemetic — 5-HT3 Antagonist",
              commonDoses: "1–2 mg IV before chemotherapy; 1 mg BD PO × 5 days (or 2 mg OD); 3 mg patch (Sancuso — apply 24–48h before chemo, replace q7 days)",
              route: "IV/PO/transdermal patch",
              notes: "Prevention and treatment of chemotherapy-induced nausea/vomiting (CINV); highly emetogenic regimens (HEC) require combination with NK1 antagonist + dexamethasone (3-drug regimen); once daily dosing (long half-life)",
              sideEffects: "Headache, constipation, QT prolongation (less than older agents); transdermal patch: application-site reactions",
              contraindications: "Known QT prolongation/concurrent QT-prolonging drugs (caution); serotonin syndrome risk with serotonergic drugs",
              renalDosing: "No dose adjustment required",
              hepaticDosing: "Use with caution in severe hepatic impairment",
              monitoring: "QT interval if risk factors; bowel function (constipation); CINV assessment"),

        .init(name: "Aprepitant/Fosaprepitant (Emend)", category: "Antiemetic — NK1 Receptor Antagonist",
              commonDoses: "PO: 125 mg day 1, 80 mg days 2–3 (with ondansetron + dex for HEC); IV fosaprepitant: 150 mg single dose day 1 (alternative to 3-day PO course)",
              route: "PO/IV",
              notes: "Prevention of acute and delayed CINV from highly emetogenic chemotherapy (HEC: cisplatin, anthracycline-cyclophosphamide combinations); triple therapy with 5-HT3 antagonist + dexamethasone; CYP3A4 substrate AND moderate inhibitor",
              sideEffects: "Hiccoughs, fatigue, constipation, diarrhoea; increases dexamethasone levels (reduce dex dose by 50%); reduces warfarin effect; CYP3A4 interactions",
              contraindications: "Concurrent pimozide or terfenadine; pregnancy (limited data); severe hepatic impairment",
              renalDosing: "No dose adjustment",
              hepaticDosing: "Mild–moderate: no adjustment. Severe (Child-Pugh >9): use with caution — limited data",
              monitoring: "CINV response; INR if on warfarin; drug interactions (CYP3A4)"),
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
