// SurgicalVademecum+AcutePancreatitis.swift
// Surgical vademecum entries for: Acute Pancreatitis

import Foundation

extension SurgicalVademecum {

    // MARK: Acute Pancreatitis

    static let acutePancreatitis = SurgicalCondition(
        id: "acute_pancreatitis",
        name: "Acute Pancreatitis",
        icd10: "K85.9",
        system: .hepatobiliary,
        urgency: .urgent,
        summary: "Acute inflammatory process of the pancreas. Gallstones (40%) and alcohol (30%) are most common causes in Saint Lucia. 80% mild and self-limiting; 20% severe with local or systemic complications and 10–30% mortality.",
        redFlags: [
            "Ranson ≥3 at 48 h — severe disease",
            "CTSI (CT Severity Index) ≥7 — necrotising pancreatitis",
            "Organ failure: renal, respiratory, cardiovascular",
            "Infected pancreatic necrosis — sepsis, multi-organ failure",
            "Vascular complications: SMA, portal vein thrombosis"
        ],
        investigations: [
            SurgicalInvestigation(name: "Serum amylase / lipase", rationale: "Lipase >3× ULN diagnostic. More specific and sensitive than amylase. Remains elevated longer", urgency: "Stat", keyFindings: ["Lipase >3× ULN = acute pancreatitis", "Normal lipase does not exclude late presentation"]),
            SurgicalInvestigation(name: "FBC, CRP, LFTs, RFTs, glucose, calcium", rationale: "Ranson criteria, organ function, aetiology (LFTs if gallstone)", urgency: "Stat", keyFindings: ["WBC >16 = severity criterion", "CRP >150 at 48 h = severe", "LFTs deranged → biliary aetiology"]),
            SurgicalInvestigation(name: "USS Abdomen", rationale: "Identify gallstones, CBD dilatation, free fluid. Pancreas often not visualised due to gas", urgency: "Stat", keyFindings: ["Gallstones / biliary sludge", "CBD dilatation"]),
            SurgicalInvestigation(name: "CT Abdomen/Pelvis with IV contrast", rationale: "Not routinely at admission. Perform if diagnosis unclear, or if no improvement at 48–72 h to assess severity and complications", urgency: "Urgent (48–72 h)", keyFindings: ["Pancreatic necrosis (% non-enhancement)", "Peripancreatic collections", "Gas in necrosis (infected)", "CTSI scoring"]),
            SurgicalInvestigation(name: "MRCP", rationale: "If gallstone pancreatitis and CBD stone suspected before ERCP", urgency: "Urgent", keyFindings: ["CBD stone", "Pancreatic duct disruption"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Severity? Aetiology? Indication for ERCP, surgery, or interventional radiology?",
            urgencyAssessment: "Atlanta 2012: Mild (no organ failure, no local complications), Moderately Severe (transient organ failure <48 h or local complications), Severe (persistent organ failure >48 h). Ranson: ≥3 = severe.",
            operativeIndications: [
                "Infected pancreatic necrosis not responding to drainage (step-up approach failure)",
                "Abdominal compartment syndrome",
                "Gallstone pancreatitis: lap cholecystectomy same admission (mild) or after recovery (severe)",
                "Persistent biliary obstruction with cholangitis: ERCP"
            ],
            nonOperativeIndications: [
                "Mild acute pancreatitis: IV fluids, analgesia, early oral feeding",
                "Sterile necrosis: conservative management (necrosis alone is not an indication for intervention)",
                "Peripancreatic collections: observe; intervene only if symptomatic or infected"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Step-Up Approach: Radiological Drainage → Video-Assisted Retroperitoneal Debridement (VARD)",
                    approach: .percutaneous,
                    indication: "Infected pancreatic necrosis — avoid open necrosectomy if possible",
                    keySteps: [
                        "CT-guided percutaneous drain into necrotic collection",
                        "Assess response: if improved, continue drainage",
                        "If no improvement at 72 h: VARD or endoscopic drainage",
                        "VARD: retroperitoneal approach via drain tract, debride necrosis under direct vision",
                        "Minimise collateral damage — serial procedures often needed"
                    ],
                    complications: [
                        Complication(name: "Pancreatic fistula", incidence: "25–50%", management: "Nil, octreotide, ERCP stenting, surgery"),
                        Complication(name: "Haemorrhage from necrosectomy", incidence: "5–10%", management: "IR embolisation, return to theatre"),
                        Complication(name: "Enteric fistula", incidence: "5%", management: "Conservative or surgical repair")
                    ],
                    consentPoints: [
                        "Multiple procedures likely",
                        "Prolonged hospital stay (weeks to months)",
                        "Pancreatic exocrine/endocrine insufficiency",
                        "Haemorrhage",
                        "Enteric fistula"
                    ],
                    operativeTime: "60–120 min per session",
                    los: "Weeks to months"
                )
            ],
            nonOperativeManagement: [
                "Moderate goal-directed IV fluids (Hartmann's / Ringer's lactate): 1.5 mL/kg/h after a 10 mL/kg bolus only if hypovolaemic, reassessed at 12–24 h — avoid aggressive fluids (WATERFALL 2022; ACG 2024)",
                "Early oral/enteral nutrition via NGT (not parenteral): within 24 h if tolerated",
                "Analgesia: morphine or fentanyl PCA; NSAIDs if renal function permits",
                "Antibiotics: NOT prophylactic. Only if documented or suspected infection",
                "ERCP + sphincterotomy within 24 h if acute cholangitis complicating gallstone pancreatitis",
                "Lap cholecystectomy: same admission for mild gallstone pancreatitis; after full recovery for severe"
            ],
            pitfalls: [
                "Early CT: often misleading at <48 h — necrosis not yet demarcated",
                "Sterile necrosis: NEVER intervene unless symptomatic mass effect or persistent symptoms",
                "Delay of cholecystectomy after mild gallstone pancreatitis = 30% recurrence rate",
                "Enteral > parenteral nutrition — significantly reduces mortality in severe pancreatitis",
                "Probiotic use in severe acute pancreatitis (PROPATRIA trial): increased mortality — do not use"
            ],
            keyScores: ["Atlanta Classification 2012", "Ranson criteria (at 0 h and 48 h)", "CTSI (Balthazar)", "APACHE II", "BISAP score"]
        ),
        postOp: PostOpProtocol(
            icu: true,
            diet: "Early enteral feeding via NGT within 24 h if possible. Advance as tolerated. Low-fat diet on discharge",
            mobilisation: "As tolerated; bed rest during acute phase",
            analgesia: "PCA morphine or fentanyl; step down to oral as improving",
            drains: "Radiological drains left in until output <50 mL/day and imaging confirms resolution",
            antibiotics: "IV antibiotics (carbapenems or piperacillin-tazobactam) only if proven infection. Meropenem for infected necrosis",
            thromboembolicProphylaxis: "LMWH when haemostasis secure, TED stockings, pneumatic compression",
            specialInstructions: [
                "Pancreatic enzyme supplementation (Creon) if exocrine insufficiency post-necrosis",
                "Monitor blood glucose: insulin if new-onset diabetes",
                "Abstain from alcohol indefinitely (alcoholic aetiology)",
                "Cholecystectomy before discharge (mild gallstone pancreatitis)"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "2–4 weeks if surgical intervention",
            clinicReview: "4–6 weeks; repeat CT if severe to assess resolution of collections",
            surveillance: "Lipid panel (hyperlipidaemia aetiology); MRCP if ductal disruption/pseudocyst",
            pathologyReview: "Not applicable",
            redFlagReturn: [
                "Increasing abdominal pain (pseudocyst, abscess, fistula)",
                "Fever (infected collection, cholangitis)",
                "Jaundice (biliary obstruction)",
                "Vomiting (gastric outlet obstruction from pseudocyst)"
            ]
        ),
        searchAliases: ["pancreatitis", "acute pancreatitis", "pancreas", "amylase", "lipase", "Ranson", "necrotising", "pseudocyst"],
        pearls: [
            "Hartmann's/Ringer's lactate is preferred over NS — reduces SIRS response compared to normal saline",
            "Routine prophylactic antibiotics do not improve mortality in acute pancreatitis (multiple RCTs)",
            "Organised pancreatic necrosis after 4+ weeks is walled-off necrosis — amenable to endoscopic or VARD drainage",
            "If aetiology unclear: IgG4 (autoimmune), Ca 19-9 (malignancy), triglycerides, calcium",
            "Pancreatic pseudocyst: only intervene if symptomatic or >6 cm persisting beyond 6 weeks"
        ]
    )

}
