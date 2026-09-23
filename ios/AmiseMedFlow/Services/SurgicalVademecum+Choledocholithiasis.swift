// SurgicalVademecum+Choledocholithiasis.swift
// Surgical vademecum entries for: Choledocholithiasis

extension SurgicalVademecum {

    // MARK: Choledocholithiasis

    static let choledocholithiasis = SurgicalCondition(
        id: "choledocholithiasis",
        name: "Choledocholithiasis",
        icd10: "K80.5",
        system: .hepatobiliary,
        urgency: .urgent,
        summary: "Stone(s) in the common bile duct. Secondary (gallstone migration) in 85%; primary (de novo) in 15%. Can cause biliary colic, jaundice, cholangitis, pancreatitis.",
        redFlags: [
            "Acute cholangitis (Charcot's triad: RUQ pain, fever, jaundice)",
            "Reynold's pentad: adds hypotension + confusion → septic shock",
            "Severe acute pancreatitis with CBD obstruction",
            "Bilirubin rapidly rising"
        ],
        investigations: [
            SurgicalInvestigation(name: "LFTs", rationale: "Obstructive pattern: raised ALP, GGT, bilirubin. ALT/AST transiently spike with passage", urgency: "Stat", keyFindings: ["Raised ALP + GGT > raised ALT", "Conjugated hyperbilirubinaemia"]),
            SurgicalInvestigation(name: "Amylase / Lipase", rationale: "Exclude gallstone pancreatitis", urgency: "Stat", keyFindings: ["Lipase >3× ULN = pancreatitis"]),
            SurgicalInvestigation(name: "USS Abdomen", rationale: "CBD dilatation >6 mm (>8 mm post-cholecystectomy) suggests obstruction. Stone visible in 50% only", urgency: "Urgent", keyFindings: ["CBD >6 mm", "Stone in duct (posterior acoustic shadow)", "Gallbladder distension"]),
            SurgicalInvestigation(name: "MRCP", rationale: "Non-invasive gold standard. Sensitivity 95% for CBD stones. Defines anatomy before ERCP", urgency: "Urgent", keyFindings: ["Filling defect in CBD", "Level of obstruction", "Hilar anatomy"]),
            SurgicalInvestigation(name: "ERCP", rationale: "Therapeutic first-line: sphincterotomy + stone extraction. Diagnostic if MRCP unavailable", urgency: "Urgent", keyFindings: ["Stone extraction", "Stricture", "Cholangiogram anatomy"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "CBD clearance — endoscopic or surgical? Cholecystectomy timing?",
            urgencyAssessment: "Tokyo Guidelines cholangitis grade: I = mild (medical), II = moderate (ERCP 24–48 h), III = severe/septic (emergency ERCP/PTC).",
            operativeIndications: [
                "Failed ERCP clearance → laparoscopic CBD exploration (LCBDE)",
                "CBD exploration at time of lap cholecystectomy (single-stage)",
                "Post-cholecystectomy: failed ERCP → open CBD exploration"
            ],
            nonOperativeIndications: [
                "ERCP + sphincterotomy (first-line endoscopic clearance)",
                "PTC (percutaneous transhepatic cholangiography) if ERCP fails or anatomy precludes"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "ERCP + Sphincterotomy + Stone Extraction",
                    approach: .endoscopic,
                    indication: "First-line for CBD stones; pre- or post-cholecystectomy",
                    keySteps: [
                        "Sedation or GA (per anaesthetic)",
                        "Side-viewing duodenoscope to ampulla",
                        "Selective CBD cannulation (sphincterotome)",
                        "Cholangiogram: define stones, number, CBD diameter",
                        "Sphincterotomy",
                        "Balloon sweep and/or basket extraction",
                        "Lithotripsy if stone >15 mm (mechanical, laser, or ESWL)",
                        "Plastic or metal stent if incomplete clearance"
                    ],
                    complications: [
                        Complication(name: "Post-ERCP pancreatitis", incidence: "3–5%", management: "IV fluids, analgesia; rectal indomethacin prophylaxis"),
                        Complication(name: "Bleeding", incidence: "1–2%", management: "Endoscopic haemostasis, rarely surgery"),
                        Complication(name: "Perforation", incidence: "<1%", management: "Conservative if retroperitoneal; surgery if free perforation"),
                        Complication(name: "Cholangitis post-ERCP", incidence: "1–3%", management: "IV antibiotics, re-drainage")
                    ],
                    consentPoints: [
                        "Post-ERCP pancreatitis (most common — 3–5%)",
                        "Bleeding",
                        "Perforation",
                        "Incomplete stone clearance (may need second ERCP or surgery)",
                        "Cholangitis",
                        "Contrast allergy"
                    ],
                    operativeTime: "30–60 min",
                    los: "Day case to overnight"
                ),
                OperativeOption(
                    name: "Laparoscopic CBD Exploration (LCBDE)",
                    approach: .laparoscopic,
                    indication: "CBD clearance at time of cholecystectomy or failed ERCP",
                    keySteps: [
                        "Standard lap cholecystectomy ports + additional port for choledochotomy",
                        "Intraoperative cholangiogram via cystic duct",
                        "Transcystic approach (stones <8 mm): balloon/basket via cystic duct",
                        "Choledochotomy (stones >8 mm or multiple): longitudinal incision anterior CBD",
                        "Extract stones under fluoroscopy/choledochoscopy",
                        "Closure over T-tube or primary closure with choledochoscopy confirmation"
                    ],
                    complications: [
                        Complication(name: "Bile leak", incidence: "3–5%", management: "ERCP stent ± drain"),
                        Complication(name: "Retained stone", incidence: "2–5%", management: "Post-op ERCP or T-tube cholangiogram")
                    ],
                    consentPoints: [
                        "T-tube placement if choledochotomy (removed at 6 weeks)",
                        "Bile leak",
                        "Retained stone requiring ERCP",
                        "Conversion to open"
                    ],
                    operativeTime: "90–180 min",
                    los: "2–4 days"
                )
            ],
            nonOperativeManagement: [
                "Nil if cholangitis: IV antibiotics (piperacillin-tazobactam or ceftriaxone + metronidazole)",
                "IV fluids, analgesia",
                "Emergency ERCP if Grade II/III cholangitis",
                "Interval ERCP within 72 h for Grade I"
            ],
            pitfalls: [
                "Charcot's triad present in only 70% of cholangitis — do not require all three",
                "Normal USS does not exclude CBD stones — CBD may not be dilated with acute passage",
                "Cholangioscopy (SpyGlass) for stones resistant to conventional extraction",
                "Consider Mirizzi syndrome if large stone with obstructive jaundice and no dilated CBD on USS"
            ],
            keyScores: ["Tokyo Guidelines 2018 (cholangitis grade)", "ASGE criteria (CBD stone probability)"]
        ),
        postOp: PostOpProtocol(
            icu: false,
            diet: "Post-ERCP: clear fluids 4 h, normal diet if no pancreatitis",
            mobilisation: "Same day (ERCP)",
            analgesia: "Regular paracetamol; opioid PRN if pancreatitis develops",
            drains: "T-tube if choledochotomy: clamp day 3, cholangiogram day 7–10, remove if clear",
            antibiotics: "Continue 5–7 days IV if cholangitis",
            thromboembolicProphylaxis: "LMWH, TED stockings",
            specialInstructions: [
                "Monitor amylase 4 h post-ERCP (baseline + 4 h level)",
                "Warn re: post-sphincterotomy bleeding risk with anticoagulants",
                "If T-tube: drain care, flush protocol, gravity drainage"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "Not applicable (ERCP)",
            clinicReview: "4–6 weeks if LCBDE or cholecystectomy",
            surveillance: "Repeat USS/LFTs at 4–6 weeks if concern about residual stones",
            pathologyReview: "Not applicable",
            redFlagReturn: [
                "Jaundice returning",
                "Fever, rigors (cholangitis)",
                "Severe epigastric / back pain (pancreatitis)",
                "Pale stools, dark urine"
            ]
        ),
        searchAliases: ["CBD stone", "choledocholithiasis", "common bile duct stone", "ERCP", "cholangitis", "Charcot", "bile duct stone", "obstructive jaundice"],
        pearls: [
            "ASGE high-probability criteria for CBD stone: CBD >6 mm + clinical cholangitis or bilirubin >4 mg/dL → proceed to ERCP without MRCP",
            "Pre-ERCP rectal indomethacin 100 mg reduces post-ERCP pancreatitis by ~50%",
            "SpyGlass cholangioscopy for stones resistant to conventional endoscopic techniques",
            "Single-stage lap cholecystectomy + LCBDE comparable to two-stage ERCP + lap chole in experienced hands"
        ]
    )

}
