// SurgicalVademecum+Gallbladder.swift
// Surgical vademecum entries for: Gallbladder

import Foundation

extension SurgicalVademecum {

    // MARK: Gallbladder

    static let acuteCholecystitis = SurgicalCondition(
        id: "acute_cholecystitis",
        name: "Acute Cholecystitis",
        icd10: "K81.0",
        system: .hepatobiliary,
        urgency: .urgent,
        summary: "Acute inflammation of the gallbladder, 95% due to gallstones impacted in Hartmann's pouch or cystic duct. Acalculous cholecystitis (5%) occurs in critically ill patients.",
        redFlags: [
            "Septic shock / haemodynamic instability",
            "Emphysematous cholecystitis (gas in gallbladder wall)",
            "Perforation / bile peritonitis",
            "Mirizzi syndrome with jaundice",
            "Gangrenous cholecystitis"
        ],
        investigations: [
            SurgicalInvestigation(name: "FBC", rationale: "WBC typically 12–15. Higher suggests empyema or perforation", urgency: "Stat", keyFindings: ["Leucocytosis", "Left shift"]),
            SurgicalInvestigation(name: "LFTs", rationale: "ALP/GGT elevated in biliary obstruction; AST/ALT elevation suggests CBD stone or hepatitis", urgency: "Stat", keyFindings: ["Raised ALP, GGT", "Bilirubin elevation suggests CBD stone"]),
            SurgicalInvestigation(name: "Amylase / Lipase", rationale: "Exclude concurrent pancreatitis (gallstone pancreatitis)", urgency: "Stat", keyFindings: [">3× ULN suggests pancreatitis"]),
            SurgicalInvestigation(name: "USS Abdomen", rationale: "First-line. Sensitivity 88% for cholecystitis. Identifies stones, wall thickening, pericholecystic fluid", urgency: "Urgent", keyFindings: ["Wall thickness >4 mm", "Pericholecystic fluid", "Sonographic Murphy's sign", "Gallstones"]),
            SurgicalInvestigation(name: "CT Abdomen/Pelvis", rationale: "If USS equivocal, if perforation/empyema/emphysematous change suspected", urgency: "Urgent", keyFindings: ["Gas in gallbladder wall (emphysematous)", "Perforation", "Hepatic abscess"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Early vs delayed cholecystectomy? CBD stone?",
            urgencyAssessment: "Tokyo Guidelines 2018: Grade I = mild (outpatient/early lap), Grade II = moderate (early lap preferred), Grade III = severe/organ dysfunction (resuscitate, consider percutaneous).",
            operativeIndications: [
                "Tokyo Grade I or II: early laparoscopic cholecystectomy within 72 h of onset",
                "Empyema gallbladder",
                "Perforation / peritonitis",
                "Failed conservative management",
                "Grade III: stabilise → interval cholecystectomy at 6 weeks"
            ],
            nonOperativeIndications: [
                "Grade III with multi-organ dysfunction: IV antibiotics, percutaneous cholecystostomy",
                "High-risk surgical patients: cholecystostomy as bridge",
                "Acalculous cholecystitis in ICU: cholecystostomy tube"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Laparoscopic Cholecystectomy",
                    approach: .laparoscopic,
                    indication: "Standard of care. Early (<72 h) preferred.",
                    keySteps: [
                        "GA, supine 15° reverse Trendelenburg, left tilt",
                        "4-port: umbilical 10 mm, epigastric 5 mm, RUQ 5 mm, RIF 5 mm",
                        "Dissect hepatocystic triangle — achieve Critical View of Safety (CVS)",
                        "CVS: two structures only entering gallbladder, lower third of GB separated from liver bed",
                        "Clip × 2 cystic duct, × 1 cystic artery — divide both",
                        "Dissect GB from liver bed (hook/Harmonic)",
                        "Extract in bag via umbilical port",
                        "Irrigate, check haemostasis"
                    ],
                    complications: [
                        Complication(name: "Bile duct injury", incidence: "0.3–0.5%", management: "ERCP/stenting or surgical repair; refer to HPB if complex"),
                        Complication(name: "Bleeding (cystic artery / liver bed)", incidence: "1–2%", management: "Haemostasis, conversion if needed"),
                        Complication(name: "Bile leak (cystic duct stump / liver bed)", incidence: "1–2%", management: "ERCP + stent ± drain"),
                        Complication(name: "Port-site hernia", incidence: "1–2% (umbilical)", management: "Fascial closure at 10 mm+ ports"),
                        Complication(name: "Retained stone (CBD)", incidence: "1–5%", management: "ERCP + sphincterotomy")
                    ],
                    consentPoints: [
                        "Conversion to open (~5% elective, higher in acute)",
                        "Bile duct injury — most serious complication",
                        "Bile leak requiring ERCP",
                        "Retained CBD stone requiring ERCP post-op",
                        "Bleeding",
                        "Wound infection",
                        "Hernia at port sites"
                    ],
                    operativeTime: "45–90 min",
                    los: "Overnight to 2 days"
                )
            ],
            nonOperativeManagement: [
                "IV piperacillin-tazobactam 4.5 g TDS or ceftriaxone + metronidazole",
                "IV fluids, analgesia (paracetamol + NSAID + opioid PRN)",
                "NBM initially; clear fluids when improving",
                "Percutaneous cholecystostomy under USS/CT guidance if operative risk prohibitive",
                "Interval cholecystectomy at 6 weeks after acute episode settles"
            ],
            pitfalls: [
                "Always achieve Critical View of Safety before dividing ANY structure",
                "Hartmann's pouch can closely mimic CBD — do not clip without CVS",
                "Subtle CBD dilatation on USS: request MRCP before theatre to exclude choledocholithiasis",
                "Mirizzi syndrome: large stone in Hartmann's eroding into CBD — bile duct repair needed",
                "Acalculous cholecystitis: high mortality, diagnose with scintigraphy if USS equivocal"
            ],
            keyScores: ["Tokyo Guidelines 2018 Grade", "ASA score", "APACHE II (Grade III)"]
        ),
        postOp: PostOpProtocol(
            icu: false,
            diet: "Free fluids 4–6 h post-op, light diet same evening",
            mobilisation: "Same day",
            analgesia: "Regular paracetamol + ibuprofen × 5 days; opioid PRN 24 h only",
            drains: "Not routinely; if placed, remove when <50 mL/24 h serous",
            antibiotics: "Prophylactic cefazolin pre-incision. If acute: continue IV antibiotics 3–5 days",
            thromboembolicProphylaxis: "LMWH, TED stockings, early mobilisation",
            specialInstructions: [
                "No lifting >5 kg for 2 weeks",
                "Driving: 1 week",
                "Return to work: desk 1 week, manual 4 weeks",
                "Low-fat diet for 2–4 weeks while adjusting to absent gallbladder",
                "Pathology review: exclude gallbladder carcinoma (incidence 0.5–1%)"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "Day 7–10",
            clinicReview: "4–6 weeks",
            surveillance: "None unless histology shows incidental carcinoma",
            pathologyReview: "Gallbladder histology at 4–6 weeks review — if T1b+ carcinoma found: refer to HPB for extended resection",
            redFlagReturn: [
                "Jaundice post-op (CBD stone or injury)",
                "Fever, RUQ pain (bile collection, abscess)",
                "Pale stool, dark urine (biliary obstruction)"
            ]
        ),
        searchAliases: ["cholecystitis", "gallbladder", "gallstones", "biliary colic", "cholecystectomy", "biliary", "murphy"],
        pearls: [
            "Never divide a structure until Critical View of Safety is confirmed",
            "Early lap cholecystectomy (within 72 h) is superior to delayed — shorter stay, same safety",
            "If CVS cannot be achieved: fundus-first technique or subtotal cholecystectomy",
            "Routine IOC or IOUS: surgeon preference; mandatory if CBD dilatation or abnormal LFTs",
            "Spillage of stones: retrieve all — retained stones → abscess, fistula"
        ]
    )

}
