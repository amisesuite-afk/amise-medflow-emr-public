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

    static func search(_ query: String) -> [SurgicalDrug] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        return allDrugs.filter {
            $0.name.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    static let allDrugs: [SurgicalDrug] = [
        // Analgesics — Opioids
        .init(name: "Morphine",       category: "Opioid Analgesic",  commonDoses: "2.5–10 mg",  route: "IV/SC/PO", notes: "Titrate to pain; caution in renal impairment"),
        .init(name: "Fentanyl",       category: "Opioid Analgesic",  commonDoses: "25–100 mcg", route: "IV/transdermal", notes: "Rapid onset; preferred in renal failure"),
        .init(name: "Oxycodone",      category: "Opioid Analgesic",  commonDoses: "5–10 mg",    route: "PO",       notes: "IR q4-6h or SR q12h"),
        .init(name: "Tramadol",       category: "Opioid Analgesic",  commonDoses: "50–100 mg",  route: "PO/IV",    notes: "Avoid with SSRIs/SNRIs (serotonin syndrome)"),
        .init(name: "Codeine",        category: "Opioid Analgesic",  commonDoses: "30–60 mg",   route: "PO",       notes: "Prodrug — variable metabolism"),
        .init(name: "Pethidine",      category: "Opioid Analgesic",  commonDoses: "25–50 mg",   route: "IV/IM",    notes: "Avoid in renal failure (norpethidine accumulation)"),

        // Analgesics — Non-opioid
        .init(name: "Paracetamol",    category: "Non-opioid Analgesic", commonDoses: "500–1000 mg q4-6h", route: "PO/IV/PR", notes: "Max 4 g/day; reduce in hepatic impairment"),
        .init(name: "Ibuprofen",      category: "NSAID",               commonDoses: "400–800 mg TDS",    route: "PO",       notes: "Avoid post-op GI bleed, renal failure"),
        .init(name: "Diclofenac",     category: "NSAID",               commonDoses: "50–75 mg",          route: "PO/PR/IM", notes: "Avoid in renal failure; 75 mg IM once"),
        .init(name: "Ketorolac",      category: "NSAID",               commonDoses: "15–30 mg",          route: "IV/IM",    notes: "Max 5 days; avoid in renal impairment"),
        .init(name: "Celecoxib",      category: "COX-2 Inhibitor",     commonDoses: "100–200 mg BD",     route: "PO",       notes: "Preferred NSAID post cardiac/bowel surgery"),

        // Antibiotics — Surgical Prophylaxis
        .init(name: "Cefazolin",      category: "Antibiotic — Prophylaxis", commonDoses: "1–2 g",       route: "IV",  notes: "First-line prophylaxis; repeat if >3h surgery"),
        .init(name: "Cefuroxime",     category: "Antibiotic — Prophylaxis", commonDoses: "1.5 g",       route: "IV",  notes: "Colorectal prophylaxis with metronidazole"),
        .init(name: "Metronidazole",  category: "Antibiotic",               commonDoses: "500 mg TDS",  route: "IV/PO", notes: "Anaerobic cover; avoid alcohol; ↑ warfarin INR"),
        .init(name: "Co-amoxiclav",   category: "Antibiotic",               commonDoses: "1.2 g TDS",   route: "IV",  notes: "Broad spectrum; biliary/abdominal sepsis"),
        .init(name: "Piperacillin/tazobactam", category: "Antibiotic",     commonDoses: "4.5 g QDS",   route: "IV",  notes: "Broad-spectrum; complicated intra-abdominal"),
        .init(name: "Ciprofloxacin",  category: "Antibiotic",               commonDoses: "400 mg BD",   route: "IV",  notes: "Gram-negative cover; ↑ warfarin INR"),
        .init(name: "Gentamicin",     category: "Antibiotic — Aminoglycoside", commonDoses: "3–5 mg/kg once daily", route: "IV", notes: "Monitor levels; nephrotoxic; ototoxic"),
        .init(name: "Vancomycin",     category: "Antibiotic",               commonDoses: "15–20 mg/kg BD", route: "IV", notes: "MRSA; monitor troughs; infuse over ≥60 min"),
        .init(name: "Meropenem",      category: "Antibiotic — Carbapenem",  commonDoses: "500 mg–1 g TDS", route: "IV", notes: "Reserve for resistant organisms/sepsis"),
        .init(name: "Ertapenem",      category: "Antibiotic — Carbapenem",  commonDoses: "1 g once daily",  route: "IV/IM", notes: "Community-acquired intra-abdominal infections"),
        .init(name: "Fluconazole",    category: "Antifungal",               commonDoses: "200–400 mg OD",   route: "IV/PO", notes: "Candida; ↑ warfarin INR significantly"),

        // Anticoagulants
        .init(name: "Enoxaparin",     category: "LMWH",               commonDoses: "20–40 mg OD (prophylaxis); 1 mg/kg BD (treatment)", route: "SC", notes: "Adjust in renal failure; anti-Xa monitoring"),
        .init(name: "Heparin (unfractionated)", category: "Anticoagulant", commonDoses: "5000 units TDS (prophylaxis)", route: "SC/IV", notes: "Monitor APTT; reversible with protamine"),
        .init(name: "Warfarin",       category: "Anticoagulant",      commonDoses: "Dose by INR",             route: "PO",  notes: "Multiple interactions; monitor INR; reverse with Vit K or FFP"),
        .init(name: "Rivaroxaban",    category: "DOAC",               commonDoses: "10 mg OD (VTE prophylaxis)", route: "PO", notes: "Omit 24–48h before surgery; reverse with andexanet alfa"),
        .init(name: "Apixaban",       category: "DOAC",               commonDoses: "2.5–5 mg BD",             route: "PO",  notes: "Omit 24–48h before surgery"),
        .init(name: "Dabigatran",     category: "DOAC",               commonDoses: "110–150 mg BD",           route: "PO",  notes: "Reverse with idarucizumab"),

        // Reversal Agents
        .init(name: "Vitamin K",      category: "Anticoagulant Reversal", commonDoses: "1–10 mg",          route: "IV/PO", notes: "Reverses warfarin; IV onset 4–6h"),
        .init(name: "Protamine",      category: "Anticoagulant Reversal", commonDoses: "1 mg per 100 units heparin", route: "IV slow", notes: "Reverses UFH; partial LMWH reversal"),
        .init(name: "Idarucizumab",   category: "Anticoagulant Reversal", commonDoses: "5 g IV",           route: "IV",    notes: "Specific reversal of dabigatran"),
        .init(name: "Tranexamic acid", category: "Antifibrinolytic",      commonDoses: "1 g TDS",           route: "IV/PO", notes: "Trauma/major haemorrhage; early use"),

        // GI / PPI
        .init(name: "Omeprazole",     category: "PPI",                commonDoses: "20–40 mg OD",  route: "PO/IV",  notes: "GI protection with NSAIDs/steroids"),
        .init(name: "Pantoprazole",   category: "PPI",                commonDoses: "40–80 mg OD",  route: "PO/IV",  notes: "IV available; 80 mg bolus + infusion for UGIB"),
        .init(name: "Lansoprazole",   category: "PPI",                commonDoses: "15–30 mg OD",  route: "PO",     notes: "Standard PPI"),
        .init(name: "Ranitidine",     category: "H2 Antagonist",      commonDoses: "150 mg BD",    route: "PO/IV",  notes: "H2 blocker; less potent than PPI"),
        .init(name: "Ondansetron",    category: "Antiemetic",         commonDoses: "4–8 mg TDS",   route: "PO/IV",  notes: "Post-op nausea; QT prolongation risk"),
        .init(name: "Metoclopramide", category: "Antiemetic / Prokinetic", commonDoses: "10 mg TDS", route: "PO/IV/IM", notes: "Prokinetic; max 5 days; extrapyramidal SE"),
        .init(name: "Cyclizine",      category: "Antiemetic",         commonDoses: "50 mg TDS",    route: "PO/IV/IM", notes: "First-line post-op nausea"),
        .init(name: "Hyoscine butylbromide", category: "Antispasmodic", commonDoses: "20 mg QDS", route: "PO/IV/IM", notes: "Bowel colic/spasm"),

        // Bowel Prep
        .init(name: "Polyethylene glycol (PEG)", category: "Bowel Prep", commonDoses: "2–4 L",    route: "PO",    notes: "Colonoscopy/bowel prep; day before procedure"),
        .init(name: "Sodium picosulfate", category: "Bowel Prep",        commonDoses: "1 sachet x2", route: "PO", notes: "Split-dose bowel prep (Picolax/Picoprep)"),
        .init(name: "Bisacodyl",      category: "Laxative",            commonDoses: "5–10 mg",    route: "PO/PR", notes: "Stimulant; bowel prep/constipation"),
        .init(name: "Lactulose",      category: "Laxative",            commonDoses: "15–30 mL BD", route: "PO",   notes: "Osmotic; hepatic encephalopathy"),
        .init(name: "Docusate sodium", category: "Laxative",           commonDoses: "100–200 mg BD", route: "PO", notes: "Stool softener; post-op opioid constipation"),
        .init(name: "Senna",          category: "Laxative",            commonDoses: "2–4 tablets nocte", route: "PO", notes: "Stimulant laxative"),

        // Fluids
        .init(name: "Normal Saline (0.9% NaCl)", category: "IV Fluid", commonDoses: "1 L over 4–8h", route: "IV", notes: "Maintenance/resuscitation; hyperchloraemic acidosis with excess"),
        .init(name: "Hartmann's (Ringer's Lactate)", category: "IV Fluid", commonDoses: "1 L over 4–8h", route: "IV", notes: "Balanced crystalloid; preferred for surgical patients"),
        .init(name: "Human Albumin 4.5%", category: "IV Colloid",       commonDoses: "250–500 mL",  route: "IV",  notes: "Hepatic failure, perioperative hypoalbuminaemia"),
        .init(name: "Gelofusine",     category: "IV Colloid",           commonDoses: "500 mL bolus", route: "IV",  notes: "Plasma expander; anaphylaxis risk"),

        // Thromboprophylaxis add-on
        .init(name: "TED stockings",  category: "Mechanical DVT Prophylaxis", commonDoses: "Apply on admission", route: "External", notes: "Combine with LMWH for high-risk surgical patients"),
        .init(name: "Pneumatic compression device", category: "Mechanical DVT Prophylaxis", commonDoses: "Intraoperative + post-op", route: "External", notes: "Reduced bleeding risk vs LMWH"),

        // Steroids
        .init(name: "Hydrocortisone", category: "Corticosteroid",      commonDoses: "100 mg TDS",  route: "IV",  notes: "Adrenal crisis; peri-op steroid cover"),
        .init(name: "Dexamethasone",  category: "Corticosteroid",      commonDoses: "4–8 mg",      route: "IV/PO", notes: "Post-op nausea; reduce oedema; 4 mg with anaesthesia"),
        .init(name: "Prednisolone",   category: "Corticosteroid",      commonDoses: "10–40 mg OD", route: "PO",  notes: "IBD/autoimmune; stress-dose coverage peri-op"),

        // Insulin
        .init(name: "Actrapid (soluble insulin)", category: "Insulin", commonDoses: "Variable by sliding scale", route: "IV/SC", notes: "Post-op glycaemic control; peri-op sliding scale"),
        .init(name: "Insulin detemir", category: "Insulin (Long-acting)", commonDoses: "Individualised", route: "SC", notes: "Continue at 80% of usual dose peri-operatively"),
        .init(name: "Metformin",      category: "Hypoglycaemic",       commonDoses: "500–1000 mg BD-TDS", route: "PO", notes: "HOLD 24–48h before contrast/surgery; lactic acidosis risk"),
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
