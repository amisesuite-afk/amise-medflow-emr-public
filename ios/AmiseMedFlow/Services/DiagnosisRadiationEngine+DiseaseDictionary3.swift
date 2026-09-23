// DiagnosisRadiationEngine+DiseaseDictionary3.swift
// Disease dictionary — Infectious/Tropical (Caribbean specific), Musculoskeletal, Vascular Surgical.

extension DiagnosisRadiationEngine {

    static let _medicalEntries2: [Entry] = [
        // INFECTIOUS / TROPICAL — CARIBBEAN SPECIFIC
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["dengue", "dengue fever", "dengue haemorrhagic fever", "dhf"], radiation: .init(
            conditionName: "Dengue Fever",
            icd10Primary: "A90",
            investigations: [
                .init(name: "Dengue NS1 antigen (days 1–5)", category: .blood, rationale: "Positive in first 5 days — most sensitive early"),
                .init(name: "Dengue IgM/IgG ELISA (day 5+)", category: .blood, rationale: "Seroconversion after day 5"),
                .init(name: "FBC — platelet count", category: .blood, rationale: "Thrombocytopaenia <100,000 → warning sign"),
                .init(name: "Haematocrit (serial)", category: .blood, rationale: "Rising haematocrit >20% → plasma leakage"),
                .init(name: "LFTs / ALT / AST", category: .blood, rationale: "Hepatitis — common in dengue"),
                .init(name: "Urine dipstick", category: .other, rationale: "Proteinuria in severe dengue"),
                .init(name: "CXR / Abdominal USS", category: .imaging, rationale: "Pleural effusion / ascites — severe dengue"),
            ],
            planTemplate: """
- NO aspirin, NSAIDs, or anticoagulants (thrombocytopaenia risk)
- Paracetamol 1 g QDS for fever and pain
- Oral hydration (ORS): 2–3 L/day — monitor urine output
- WARNING SIGNS requiring admission:
  • Abdominal pain, persistent vomiting, bleeding, lethargy, rapid clinical deterioration
  • Platelet <100,000 + symptoms
- SEVERE DENGUE (plasma leakage / organ impairment):
  • IV isotonic crystalloid: Hartmann's 5–10 mL/kg/h — titrate to haematocrit
  • Platelet transfusion only if <10,000 or active bleeding
  • ICU for shock (DSS)
- Monitor: platelet + haematocrit 12-hourly during critical phase (day 4–6)
- Notify Ministry of Health (mandatory — notifiable disease in St Lucia)
- Mosquito protection: DEET repellent, bed nets
""",
            billingCodes: [
                .init(icd10: "A90", icdDescription: "Dengue fever [classical dengue]", cpt: nil, cptDescription: "Supportive management"),
            ],
            consentCategory: nil,
            urgencyNote: "Monitor for warning signs. Admit if platelet trending down or any warning sign present.",
            redFlags: ["Plasma leakage → dengue shock syndrome → aggressive fluids + ICU", "Platelet <10,000 + bleeding → transfuse"],
            followUp: "Platelet count at day 6–7. Recovery usually by day 10–14. Avoid NSAIDs for 2 weeks.",
            guidelineReference: "WHO 2009; PAHO 2010; MOH St Lucia"
        )),

        Entry(keywords: ["leptospirosis", "weil's disease", "weil disease"], radiation: .init(
            conditionName: "Leptospirosis",
            icd10Primary: "A27.9",
            investigations: [
                .init(name: "Leptospira IgM ELISA (day 5–7+)", category: .blood, rationale: "Serological diagnosis — most sensitive after day 5"),
                .init(name: "MAT (Microscopic Agglutination Test)", category: .blood, rationale: "Gold standard serological test — 4× rise in paired sera"),
                .init(name: "Leptospira PCR (blood — days 1–5)", category: .blood, rationale: "Early diagnosis — first week of illness"),
                .init(name: "FBC — WBC, platelet", category: .blood, rationale: "Leukocytosis, thrombocytopaenia"),
                .init(name: "U&E / Creatinine / Urine", category: .blood, rationale: "Renal failure — Weil's disease"),
                .init(name: "LFTs / Bilirubin / CK", category: .blood, rationale: "Hepatic involvement and myositis"),
                .init(name: "CXR", category: .imaging, rationale: "Pulmonary haemorrhage — severe leptospirosis"),
                .init(name: "Blood cultures", category: .blood, rationale: "First week — leptospiraemia; exclude bacteraemia"),
            ],
            planTemplate: """
- MILD (febrile illness, no organ involvement):
  • Doxycycline 100 mg BD × 7 days (oral)
  • Alternative: amoxicillin 500 mg TDS × 7 days
- MODERATE-SEVERE (jaundice, renal impairment, haemorrhage):
  • ADMIT — IV penicillin G 1.5 MU 6-hourly × 7 days (Weil's disease)
  • Or ceftriaxone 1 g IV OD × 7 days
  • Monitor renal function daily — haemodialysis if AKI
  • Platelet + coagulation — DIC management
  • Pulmonary: O₂ support; consider steroids for haemorrhagic pneumonitis
- Notify Public Health — mandatory notifiable disease
- Exposure history: flood water, soil, rodents — workplace / environmental
""",
            billingCodes: [
                .init(icd10: "A27.9", icdDescription: "Leptospirosis, unspecified", cpt: nil, cptDescription: "Antibiotic management"),
            ],
            consentCategory: nil,
            urgencyNote: "Weil's disease (jaundice + renal failure): ADMIT immediately. IV penicillin.",
            redFlags: ["AKI → nephrology + possible dialysis", "Pulmonary haemorrhage → ICU + mechanical ventilation", "DIC → haematology"],
            followUp: "Renal function weekly × 4 weeks. LFTs normalise in 4–6 weeks.",
            guidelineReference: "WHO Guidelines; PAHO"
        )),

        Entry(keywords: ["typhoid", "typhoid fever", "enteric fever", "salmonella typhi"], radiation: .init(
            conditionName: "Typhoid Fever",
            icd10Primary: "A01.00",
            investigations: [
                .init(name: "Blood cultures (×2, different sites)", category: .blood, rationale: "Gold standard week 1–2 — Salmonella Typhi"),
                .init(name: "Widal test (week 2+)", category: .blood, rationale: "Serological — O titre >1:160 significant but non-specific"),
                .init(name: "Stool culture (week 3+)", category: .other, rationale: "Salmonella Typhi — late disease"),
                .init(name: "FBC — relative leucopaenia, anaemia", category: .blood, rationale: "Classic: WBC often normal or low"),
                .init(name: "LFTs", category: .blood, rationale: "Hepatic involvement"),
                .init(name: "U&E / Creatinine", category: .blood, rationale: "Renal function"),
                .init(name: "Chest X-ray", category: .imaging, rationale: "Pneumonia, perforation"),
            ],
            planTemplate: """
- MILD / UNCOMPLICATED:
  • Azithromycin 1 g OD × 5 days (treatment of choice for uncomplicated typhoid — highly effective in Caribbean region)
  • Alternative: ciprofloxacin 500 mg BD × 7–10 days (if susceptible — check fluoroquinolone resistance)
- SEVERE / COMPLICATED (admit):
  • IV ceftriaxone 2 g OD × 7–14 days
  • Or IV azithromycin 500 mg OD if IV route needed
- Perforation / haemorrhage → emergency surgical management
- Supportive: IV fluids + paracetamol for fever
- CONTACT TRACING: food handlers → stool culture
- Notify Public Health (mandatory)
- Food safety / hand hygiene education
""",
            billingCodes: [
                .init(icd10: "A01.00", icdDescription: "Typhoid fever, unspecified", cpt: nil, cptDescription: "Antibiotic management"),
            ],
            consentCategory: nil,
            urgencyNote: "Admit if toxic / unable to tolerate orals. Blood cultures before antibiotics.",
            redFlags: ["Intestinal perforation → emergency surgery", "Haemorrhage → transfusion + surgery", "Encephalopathy → IV antibiotics + steroids"],
            followUp: "Stool culture 3 months post-treatment. Typhoid vaccination for household contacts.",
            guidelineReference: "WHO 2011; CDC; IDSA"
        )),

        Entry(keywords: ["urinary tract infection", "uti", "cystitis", "pyelonephritis"], radiation: .init(
            conditionName: "Urinary Tract Infection",
            icd10Primary: "N39.0",
            investigations: [
                .init(name: "Urine dipstick (nitrites + leucocytes)", category: .other, rationale: "Bedside diagnosis — >90% sensitivity combined"),
                .init(name: "Urine MC&S", category: .other, rationale: "Culture and sensitivities — guide antibiotic choice"),
                .init(name: "FBC / CRP (if systemic features)", category: .blood, rationale: "Sepsis assessment"),
                .init(name: "U&E / Creatinine", category: .blood, rationale: "Renal function if pyelonephritis"),
                .init(name: "Blood cultures (if temp >38.5°C)", category: .blood, rationale: "Urosepsis — before antibiotics"),
                .init(name: "Renal Ultrasound", category: .imaging, rationale: "Obstruction — hydronephrosis, calculi"),
                .init(name: "CT KUB (no contrast)", category: .imaging, rationale: "Renal calculi if suspected"),
            ],
            planTemplate: """
- UNCOMPLICATED LOWER UTI (female, non-pregnant):
  • Nitrofurantoin 100 mg MR BD × 5 days (first-line — St Lucia)
  • Or trimethoprim 200 mg BD × 7 days (if low resistance)
  • Or amoxicillin-clavulanate 625 mg TDS × 5–7 days (if culture-guided)
- UPPER UTI / PYELONEPHRITIS (outpatient, mild):
  • Ciprofloxacin 500 mg BD × 7–14 days PO (if susceptible)
  • Or co-amoxiclav 625 mg TDS × 10–14 days
- PYELONEPHRITIS (severe / sepsis): ADMIT
  • IV ceftriaxone 1–2 g OD; switch to oral after 24h afebrile
- COMPLICATED UTI (catheter, immunosuppressed, male, pregnancy): culture-guided treatment
- Increase oral fluids >2 L/day; treat constipation
- If recurrent (≥3/year female): consider prophylaxis — trimethoprim 100 mg nocte
""",
            billingCodes: [
                .init(icd10: "N39.0", icdDescription: "Urinary tract infection, site not specified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Systemically unwell + sepsis criteria: admit urgently. Blood cultures before antibiotics.",
            redFlags: ["Sepsis criteria → IV antibiotics within 1h", "Obstructed infected kidney → emergency urology + nephrostomy"],
            followUp: "Urine MC&S 5–7 days post-antibiotic. If recurrent: renal USS + urology referral.",
            guidelineReference: "NICE NG112; EAU 2022"
        )),

        Entry(keywords: ["cellulitis", "soft tissue infection", "erysipelas"], radiation: .init(
            conditionName: "Cellulitis",
            icd10Primary: "L03.90",
            investigations: [
                .init(name: "FBC / CRP / Blood cultures (if systemic)", category: .blood, rationale: "Severity and bacteraemia"),
                .init(name: "Blood glucose / HbA1c", category: .blood, rationale: "Diabetes — major risk factor"),
                .init(name: "Wound swab", category: .other, rationale: "If open wound / ulcer — microbiological"),
                .init(name: "X-ray of affected area", category: .imaging, rationale: "Exclude osteomyelitis, gas (NF)"),
                .init(name: "MRI soft tissue", category: .imaging, rationale: "If necrotising fasciitis suspected"),
            ],
            planTemplate: """
- Mark the advancing edge with a skin marker pen + photograph — reassess at 24h
- MILD (no systemic features): ORAL
  • Flucloxacillin 500 mg QDS × 5–7 days (Staph/Strep — first choice)
  • If penicillin allergy: clarithromycin 500 mg BD or doxycycline 200 mg OD
- MODERATE / SEVERE (systemic features / spreading rapidly): ADMIT + IV
  • Flucloxacillin 2 g IV 6-hourly
  • MRSA risk (health-care associated / PVL): add vancomycin
- Elevate affected limb
- Treat underlying cause: tinea pedis (portal of entry) — clotrimazole cream
- Diabetes: optimise glycaemic control
""",
            billingCodes: [
                .init(icd10: "L03.90", icdDescription: "Cellulitis, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "If rapidly spreading or systemically unwell: admit urgently. Rule out necrotising fasciitis.",
            redFlags: ["Crepitus / gas on imaging / extreme pain out of proportion → necrotising fasciitis → emergency OT"],
            followUp: "Review at 48h. If not improving → re-examine edge, consider IV switch or MRI.",
            guidelineReference: "NICE NG141; CREST 2005; IDSA 2014"
        )),
    ]

}
