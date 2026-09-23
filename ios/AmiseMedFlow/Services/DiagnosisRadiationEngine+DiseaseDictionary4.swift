// DiagnosisRadiationEngine+DiseaseDictionary4.swift
// Disease dictionary — Acute Surgical Abdomen, Urology/Renal, Neurology (Stroke/TIA), Haematology.

extension DiagnosisRadiationEngine {

    static let _medicalEntries3: [Entry] = [
        // ACUTE SURGICAL ABDOMEN
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["bowel obstruction", "small bowel obstruction", "sbo", "intestinal obstruction", "volvulus", "adhesion obstruction"], radiation: .init(
            conditionName: "Small Bowel Obstruction",
            icd10Primary: "K56.60",
            investigations: [
                .init(name: "AXR (Supine + Erect / Lateral decubitus)", category: .imaging, rationale: "Dilated loops >3 cm + air-fluid levels = SBO"),
                .init(name: "CT Abdomen/Pelvis (with contrast — IV ± oral)", category: .imaging, rationale: "Gold standard — identifies cause (adhesion, hernia, tumour), transition point, strangulation"),
                .init(name: "FBC / U&E / Creatinine / LFTs", category: .blood, rationale: "Electrolyte derangement; leucocytosis suggests strangulation"),
                .init(name: "Lactate (serum)", category: .blood, rationale: "Raised >2 → ischaemia / strangulation"),
                .init(name: "Amylase / Lipase", category: .blood, rationale: "Exclude pancreatitis; elevated in SBO"),
                .init(name: "Group and Screen", category: .blood, rationale: "Pre-operative requirement"),
            ],
            planTemplate: """
- IMMEDIATE:
  • NBM; IV access × 2; urinary catheter (fluid balance)
  • IV crystalloid resuscitation: 0.9% NaCl or Hartmann's
  • Nasogastric tube (NG) on free drainage — decompress + reduce vomiting
  • IV antiemetic: ondansetron 8 mg or metoclopramide 10 mg
  • Analgesia: IV morphine 2.5–5 mg titrated (do not withhold — does not mask signs)
  • Electrolyte replacement (K⁺ particularly)
- CONSERVATIVE TRIAL (adhesion SBO, no signs of strangulation):
  • 48–72h NG decompression + IV fluids; serial clinical examination
  • Water-soluble contrast study (Gastrografin) at 24h — therapeutic + diagnostic
  • 80% adhesion SBO resolves conservatively
- OPERATIVE INDICATIONS:
  • Strangulation (peritonism, fever, leucocytosis, lactate rise, blood supply)
  • Complete obstruction failing conservative × 48–72h
  • Hernia (external) → reduce/repair urgently
  • Tumour / volvulus / intussusception → surgery
- Surgical options: adhesiolysis, hernia repair, resection ± anastomosis
- Broad-spectrum antibiotics if operative: co-amoxiclav 1.2g IV or cefuroxime + metronidazole
""",
            billingCodes: [
                .init(icd10: "K56.60", icdDescription: "Unspecified intestinal obstruction", cpt: "44005", cptDescription: "Enterolysis (lysis of adhesions)"),
                .init(icd10: "K56.60", icdDescription: "SBO", cpt: "44120", cptDescription: "Enterectomy, resection of small intestine"),
            ],
            consentCategory: "Laparotomy / Adhesiolysis",
            urgencyNote: "Any signs of strangulation (fever, peritonism, tachycardia, raised lactate) → emergency OT — do not delay.",
            redFlags: ["Strangulation → emergency laparotomy", "Closed-loop obstruction → ischaemia rapid — CT urgent"],
            followUp: "Follow-up at 2–6 weeks post-operatively. Bowel function review. Recurrence counselling.",
            guidelineReference: "EAST Guidelines; ACPGBI 2020; WSES 2017"
        )),

        Entry(keywords: ["perforated", "viscus perforation", "gastric perforation", "duodenal perforation", "perforated peptic ulcer", "peritonitis", "pneumoperitoneum"], radiation: .init(
            conditionName: "Perforated Viscus / Peritonitis",
            icd10Primary: "K27.1",
            investigations: [
                .init(name: "Erect CXR (free gas under diaphragm)", category: .imaging, rationale: "Pneumoperitoneum — present in 75% of perforations"),
                .init(name: "CT Abdomen/Pelvis (IV contrast)", category: .imaging, rationale: "Confirms perforation site, extent, collections"),
                .init(name: "FBC / CRP / U&E / LFTs / Coagulation", category: .blood, rationale: "Sepsis assessment; pre-operative baseline"),
                .init(name: "Lactate", category: .blood, rationale: "Sepsis severity and organ perfusion"),
                .init(name: "Blood cultures × 2", category: .blood, rationale: "Before antibiotics — bacteraemia likely"),
                .init(name: "Group and Crossmatch", category: .blood, rationale: "Pre-operative requirement"),
                .init(name: "Urine MC&S / Catheter", category: .other, rationale: "Fluid balance monitoring; exclude renal cause"),
            ],
            planTemplate: """
- IMMEDIATE RESUSCITATION (Sepsis Six within 1 hour):
  • O₂ (target SpO₂ >94%)
  • IV access × 2 + blood cultures before antibiotics
  • IV broad-spectrum antibiotics: tazobactam/piperacillin 4.5g 8-hourly + metronidazole 500mg TDS
  • IV fluid resuscitation: 500 mL crystalloid bolus → reassess
  • Urinary catheter — strict fluid balance
  • Serial lactate
  • NBM + NG tube on free drainage
  • Analgesia: IV morphine (do not withhold)
  • Urgent surgical review
- OPERATIVE MANAGEMENT (most require surgery):
  • PERFORATED PU:
    - Laparoscopic washout + omental patch (Graham's patch)
    - Open repair if laparoscopy contraindicated / contamination heavy
  • COLONIC PERFORATION:
    - Hartmann's procedure (sigmoid — most common) or primary anastomosis if fit + low contamination
  • POST-OPERATIVE: proton pump inhibitor IV → oral; H. pylori eradication (PU)
- NON-OPERATIVE (sealed perforation — CT confirmed, stable, low CRP):
  • Selected cases: IV antibiotics + strict monitoring + CT at 48h
  • Surgery if any deterioration
""",
            billingCodes: [
                .init(icd10: "K27.1", icdDescription: "Peptic ulcer, acute with perforation", cpt: "43840", cptDescription: "Gastrorrhaphy, suture of perforated duodenal/gastric ulcer"),
            ],
            consentCategory: "Emergency Laparotomy / Laparoscopy for Perforated Viscus",
            urgencyNote: "Perforated viscus with peritonitis: SURGICAL EMERGENCY. Antibiotics + OT within 1 hour of decision.",
            redFlags: ["Septic shock → ICU-level resuscitation in parallel with OT", "Faecal peritonitis → higher mortality — senior surgeon required"],
            followUp: "H. pylori testing at 6 weeks post-discharge. PPI for 8 weeks. Endoscopy at 6–8 weeks to confirm healing.",
            guidelineReference: "NICE CG184; WSES 2016; BOA/ACPGBI 2018"
        )),

        // ══════════════════════════════════════════════════════════════
        // PILONIDAL DISEASE
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["pilonidal", "pilonidal sinus", "pilonidal abscess", "pilonidal cyst", "natal cleft"], radiation: .init(
            conditionName: "Pilonidal Sinus Disease",
            icd10Primary: "L05.91",
            investigations: [
                .init(name: "Clinical examination (natal cleft inspection)", category: .other, rationale: "Diagnosis is clinical — sinus pits, abscess, discharge"),
                .init(name: "FBC / CRP (if systemic features)", category: .blood, rationale: "Abscess with cellulitis or systemic infection"),
                .init(name: "Wound swab (if discharging)", category: .other, rationale: "Microbiological — guide antibiotics if infected"),
                .init(name: "MRI pelvis (if complex/recurrent)", category: .imaging, rationale: "Delineate complex sinus network; exclude fistula-in-ano"),
            ],
            planTemplate: """
- ACUTE PILONIDAL ABSCESS:
  • Incision & Drainage (I&D) under LA/GA — incision lateral to midline
  • Do NOT perform definitive sinus excision at time of acute abscess
  • Pack wound; review at 24–48h
  • Antibiotics only if significant surrounding cellulitis: flucloxacillin 500mg QDS × 5 days
- CHRONIC PILONIDAL SINUS (definitive surgery, elective):
  • Pit picking (Lord-Millar) — minimal, day case, high recurrence
  • Wide excision with primary closure (off-midline Z-plasty / Bascom cleft-lift) — preferred for complex/recurrent
  • Excision with Limberg flap or Karydakis procedure — best outcomes, low recurrence
  • Excision open (healing by secondary intention) — simple, slow healing
- HAIR REMOVAL: regular laser/IPL to natal cleft reduces recurrence
- BODY WEIGHT: obesity increases recurrence — weight management
- HYGIENE: keep natal cleft dry; avoid hair accumulation
""",
            billingCodes: [
                .init(icd10: "L05.01", icdDescription: "Pilonidal cyst with abscess", cpt: "10060", cptDescription: "Incision & drainage of abscess, simple"),
                .init(icd10: "L05.91", icdDescription: "Pilonidal cyst without abscess, uninfected", cpt: "11770", cptDescription: "Excision of pilonidal cyst, simple"),
                .init(icd10: "L05.91", icdDescription: "Pilonidal sinus", cpt: "11771", cptDescription: "Excision of pilonidal cyst, extensive"),
            ],
            consentCategory: "Pilonidal Sinus Excision / Flap Repair",
            urgencyNote: "Acute abscess → urgent I&D (can be done under LA in rooms); definitive excision planned 6–8 weeks later.",
            redFlags: ["Necrotising infection (rare but life-threatening) → broad-spectrum IV antibiotics + emergency OT"],
            followUp: "Wound review at 1–2 weeks. Recurrence rate post-excision 10–30% — counsel patient. Hair removal follow-up.",
            guidelineReference: "ACPGBI 2019; ASCRS 2019; Royal College of Surgeons 2018"
        )),

        // ══════════════════════════════════════════════════════════════
        // UROLOGY / RENAL
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["renal colic", "kidney stone", "ureteric calculus", "ureteric stone", "nephrolithiasis", "loin to groin pain"], radiation: .init(
            conditionName: "Renal Colic / Ureteric Calculus",
            icd10Primary: "N20.1",
            investigations: [
                .init(name: "CT KUB (non-contrast)", category: .imaging, rationale: "Gold standard — sensitivity >95%; stone size, site, obstruction"),
                .init(name: "Urine dipstick + MC&S", category: .other, rationale: "Haematuria; exclude infection (infected stone → emergency)"),
                .init(name: "FBC / U&E / Creatinine / CRP", category: .blood, rationale: "Renal function; sepsis assessment; AKI from obstruction"),
                .init(name: "Serum calcium / Uric acid / Parathyroid hormone", category: .blood, rationale: "Metabolic workup — recurrent stones or bilateral"),
                .init(name: "24h Urine (stone metabolic screen)", category: .other, rationale: "Calcium, oxalate, citrate, uric acid — recurrent disease"),
                .init(name: "Plain AXR (KUB)", category: .imaging, rationale: "Radio-opaque stones (calcium oxalate/phosphate) — follow-up"),
            ],
            planTemplate: """
- ANALGESIA (FIRST PRIORITY):
  • Diclofenac 75 mg IM or PR (NSAID — first line, reduces ureteric spasm)
  • If NSAID contraindicated: IV morphine 2.5–5 mg + antiemetic
  • Paracetamol 1g IV/PO as adjunct
- ANTIEMETIC: ondansetron 8 mg IV/PO or metoclopramide 10 mg
- ALPHA BLOCKER (MET — medical expulsive therapy):
  • Tamsulosin 400 mcg OD × 4 weeks (stones ≤10 mm distal ureter — improves passage rate)
- HYDRATION: IV fluids if vomiting; oral fluids otherwise (high-volume hydration does not speed passage)
- STONE MANAGEMENT:
  • <5 mm: observe — 90% pass spontaneously (MET)
  • 5–10 mm: MET + urology follow-up; ESWL if no spontaneous passage at 4 weeks
  • >10 mm or obstructed infected system:
    - Urgent urology referral → ureteroscopy (URS) + laser lithotripsy
    - JJ stent / nephrostomy if obstructed + infected (emergency drainage)
- ADMIT IF: fever + obstruction (infected obstructed kidney = emergency), AKI, intractable pain, solitary kidney
- METABOLIC WORKUP: 24h urine + calcium/uric acid after acute episode
""",
            billingCodes: [
                .init(icd10: "N20.1", icdDescription: "Calculus of ureter", cpt: "52356", cptDescription: "Ureteroscopy with laser lithotripsy"),
                .init(icd10: "N20.0", icdDescription: "Calculus of kidney", cpt: "50590", cptDescription: "Shock wave lithotripsy (ESWL), renal/ureteral"),
                .init(icd10: "N20.1", icdDescription: "Ureteric stone", cpt: "50386", cptDescription: "Removal of ureteric stent"),
            ],
            consentCategory: "Ureteroscopy / Laser Lithotripsy / ESWL",
            urgencyNote: "Infected obstructed system (fever + urinary obstruction) = UROLOGICAL EMERGENCY → drainage within 12 hours.",
            redFlags: ["Fever + flank pain + obstruction → septic shock risk → emergency urology drainage (nephrostomy or stent)", "AKI from bilateral obstruction or solitary kidney → urgent decompression"],
            followUp: "Urology at 4–6 weeks with stone analysis. 24h urine metabolic workup. Dietary advice (increase fluid, reduce oxalate). Urine MC&S 1 week post-procedure.",
            guidelineReference: "EAU Guidelines 2023; NICE CG194; AUA 2019"
        )),

        Entry(keywords: ["acute kidney injury", "aki", "renal failure acute", "oliguria", "anuria"], radiation: .init(
            conditionName: "Acute Kidney Injury",
            icd10Primary: "N17.9",
            investigations: [
                .init(name: "U&E / Creatinine (serial — baseline vs current)", category: .blood, rationale: "KDIGO staging: Stage 1 ×1.5 baseline; Stage 2 ×2; Stage 3 ×3 or >354 µmol/L"),
                .init(name: "Urinalysis + urine MC&S", category: .other, rationale: "Casts (ATN), protein/blood (GN), infection (prerenal from sepsis)"),
                .init(name: "Urine Na / urine osmolality", category: .other, rationale: "FENa <1% prerenal; >2% intrinsic; urine osmol >500 prerenal"),
                .init(name: "FBC / CRP / Blood cultures (if febrile)", category: .blood, rationale: "Sepsis — commonest cause of AKI; blood cultures before antibiotics"),
                .init(name: "Renal Ultrasound", category: .imaging, rationale: "Obstruction (hydronephrosis) — postrenal AKI → relieve urgently"),
                .init(name: "ECG", category: .other, rationale: "Hyperkalaemia — peaked T waves, wide QRS → emergency"),
                .init(name: "Calcium / Phosphate / Bicarbonate / Lactate", category: .blood, rationale: "Metabolic complications of AKI"),
            ],
            planTemplate: """
- IDENTIFY & TREAT CAUSE:
  • PRERENAL (commonest — dehydration, sepsis, cardiac output): IV fluid challenge; treat sepsis
  • INTRINSIC (ATN, nephritis, drugs): stop nephrotoxins (NSAIDs, aminoglycosides, contrast, ACE inhibitors in volume depletion)
  • POSTRENAL (obstruction): urgent renal USS → nephrostomy/stent if hydronephrosis
- FLUID MANAGEMENT:
  • Hypovolaemia: 500 mL 0.9% NaCl bolus → reassess response (JVP, UO, BP)
  • Oliguric AKI (UO <0.5 mL/kg/h): furosemide challenge 20–40 mg IV after adequate volume replacement
  • Fluid overload: fluid restrict ± furosemide; consider dialysis
- HYPERKALAEMIA MANAGEMENT:
  • K⁺ >6.0 or ECG changes: 10 mL 10% calcium gluconate IV (cardioprotection)
  • Insulin 10 units + 50% dextrose 50 mL IV (shift K⁺ intracellularly)
  • Salbutamol 10–20 mg nebulised (K⁺ shift)
  • Kayexalate / patiromer / sodium zirconium (GI elimination)
  • Restrict dietary K⁺; stop K⁺-sparing drugs
- RENAL REPLACEMENT THERAPY (RRT) — indications:
  • Refractory hyperkalaemia (K⁺ >6.5 despite treatment)
  • Refractory acidosis (pH <7.1)
  • Fluid overload unresponsive to diuretics
  • Uraemic encephalopathy or pericarditis
- DRUG DOSING: adjust all renally-cleared drugs; check BNF
""",
            billingCodes: [
                .init(icd10: "N17.9", icdDescription: "Acute kidney injury, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Hyperkalaemia >6.5 + ECG changes: IMMEDIATE treatment — calcium gluconate IV first.",
            redFlags: ["ECG changes (peaked T, wide QRS) → hyperkalaemia emergency", "Anuria → obstruction excluded? → urgent USS", "Uraemic encephalopathy → dialysis"],
            followUp: "Nephrology review if no recovery at 48–72h. Repeat U&E at 48h, then weekly until creatinine stable. Avoid nephrotoxins long-term.",
            guidelineReference: "KDIGO AKI 2012; NICE AKI 2013 (NG148); RCP 2015"
        )),
    ]

}
