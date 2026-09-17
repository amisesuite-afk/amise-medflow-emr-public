import Foundation

// MARK: - Enums

enum SurgicalSystem: String, CaseIterable, Identifiable {
    case upperGI       = "Upper GI"
    case hepatobiliary = "Hepatobiliary"
    case colorectal    = "Colorectal"
    case hernia        = "Hernia"
    case perianal      = "Perianal"
    case endocrine     = "Endocrine"
    case breast        = "Breast"
    case vascular      = "Vascular"
    case emergency     = "Emergency"
    case endoscopy     = "Endoscopy"
    var id: String { rawValue }

    var icon: String {
        switch self {
        case .upperGI:       return "fork.knife"
        case .hepatobiliary: return "drop.fill"
        case .colorectal:    return "arrow.triangle.2.circlepath"
        case .hernia:        return "circle.dotted"
        case .perianal:      return "figure.walk"
        case .endocrine:     return "waveform.path.ecg"
        case .breast:        return "heart.fill"
        case .vascular:      return "bolt.heart"
        case .emergency:     return "exclamationmark.triangle.fill"
        case .endoscopy:     return "camera.metering.center.weighted"
        }
    }
}

enum SurgicalUrgency: String, CaseIterable {
    case elective  = "Elective"
    case urgent    = "Urgent (24–72 h)"
    case emergency = "Emergency (<6 h)"
    case immediate = "Immediate"

    var color: String {
        switch self {
        case .elective:  return "green"
        case .urgent:    return "orange"
        case .emergency: return "red"
        case .immediate: return "purple"
        }
    }
}

enum OperativeApproach: String {
    case laparoscopic   = "Laparoscopic"
    case open           = "Open"
    case roboticAssist  = "Robotic-assisted"
    case endoscopic     = "Endoscopic"
    case percutaneous   = "Percutaneous"
    case hybrid         = "Hybrid"
}

// MARK: - Models

struct SurgicalInvestigation: Identifiable {
    let id = UUID()
    let name: String
    let rationale: String
    let urgency: String        // "Routine" / "Urgent" / "Stat"
    let keyFindings: [String]
}

struct Complication: Identifiable {
    let id = UUID()
    let name: String
    let incidence: String      // e.g. "2–5%"
    let management: String
}

struct OperativeOption: Identifiable {
    let id = UUID()
    let name: String
    let approach: OperativeApproach
    let indication: String
    let keySteps: [String]
    let complications: [Complication]
    let consentPoints: [String]
    let operativeTime: String  // e.g. "45–90 min"
    let los: String            // expected length of stay
}

struct SurgicalAlgorithm {
    let clinicalQuestion: String
    let urgencyAssessment: String
    let operativeIndications: [String]
    let nonOperativeIndications: [String]
    let operativeOptions: [OperativeOption]
    let nonOperativeManagement: [String]
    let pitfalls: [String]
    let keyScores: [String]    // e.g. "Alvarado score", "Ranson criteria"
}

struct PostOpProtocol {
    let icu: Bool
    let diet: String
    let mobilisation: String
    let analgesia: String
    let drains: String
    let antibiotics: String
    let thromboembolicProphylaxis: String
    let specialInstructions: [String]
}

struct FollowUpProtocol {
    let woundCheck: String     // e.g. "Day 7–10"
    let clinicReview: String   // e.g. "4–6 weeks"
    let surveillance: String   // e.g. "Annual colonoscopy"
    let pathologyReview: String
    let redFlagReturn: [String]
}

struct SurgicalCondition: Identifiable {
    let id: String             // e.g. "acute_appendicitis"
    let name: String
    let icd10: String
    let system: SurgicalSystem
    let urgency: SurgicalUrgency
    let summary: String
    let redFlags: [String]
    let investigations: [SurgicalInvestigation]
    let algorithm: SurgicalAlgorithm
    let postOp: PostOpProtocol?
    let followUp: FollowUpProtocol
    let searchAliases: [String]
    let pearls: [String]       // key clinical pearls / teaching points
}

// MARK: - Vademecum Database

enum SurgicalVademecum {

    // MARK: Appendix

    static let acuteAppendicitis = SurgicalCondition(
        id: "acute_appendicitis",
        name: "Acute Appendicitis",
        icd10: "K37",
        system: .emergency,
        urgency: .emergency,
        summary: "Inflammation of the vermiform appendix due to luminal obstruction. Most common surgical emergency. Peak incidence 10–30 years. Lifetime risk ~7%.",
        redFlags: [
            "Peritonitis / rigid abdomen",
            "Haemodynamic instability",
            "Perforation with generalised peritonitis",
            "Septic shock",
            "Failed non-operative management"
        ],
        investigations: [
            SurgicalInvestigation(name: "FBC", rationale: "Leucocytosis (WBC >10) supports diagnosis; >15 suggests perforation/abscess", urgency: "Stat", keyFindings: ["WBC >10×10⁹/L", "Neutrophilia"]),
            SurgicalInvestigation(name: "CRP", rationale: "Elevated in appendicitis; >100 mg/L suggests perforation or abscess", urgency: "Stat", keyFindings: ["CRP >10 supports inflammation", ">100 suggests complication"]),
            SurgicalInvestigation(name: "β-hCG (females)", rationale: "Exclude ectopic pregnancy before operative intervention", urgency: "Stat", keyFindings: ["Positive: exclude ectopic first"]),
            SurgicalInvestigation(name: "Urinalysis / MSU", rationale: "Exclude UTI / renal colic mimics; mild pyuria can occur in appendicitis", urgency: "Stat", keyFindings: ["Heavy pyuria + bacteriuria = UTI"]),
            SurgicalInvestigation(name: "CT Abdomen/Pelvis with IV contrast", rationale: "Gold standard — sensitivity 94%, specificity 95%. Use in diagnostic uncertainty or obese patients", urgency: "Urgent", keyFindings: ["Dilated appendix >6 mm", "Periappendiceal fat stranding", "Appendicolith", "Free fluid / air"]),
            SurgicalInvestigation(name: "USS Abdomen", rationale: "First-line in children/pregnant women. Sensitivity 86%, specificity 81%. Operator-dependent", urgency: "Urgent", keyFindings: ["Non-compressible appendix >6 mm", "Target sign"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Is there an indication for appendicectomy?",
            urgencyAssessment: "Calculate Alvarado score. Score ≥7 = high probability → proceed to theatre. Score 4–6 = observe ± CT. Score <4 = observe / discharge.",
            operativeIndications: [
                "Alvarado ≥7 with clinical peritonism",
                "CT-confirmed uncomplicated appendicitis (most cases)",
                "Failed non-operative management (antibiotics)",
                "Perforation / generalised peritonitis",
                "Appendix abscess not amenable to percutaneous drainage"
            ],
            nonOperativeIndications: [
                "Uncomplicated appendicitis in selected patients (APPAC trial: 73% success at 5 yrs)",
                "Appendix abscess/phlegmon: IV antibiotics ± interval appendicectomy",
                "High anaesthetic risk where benefit-risk favours antibiotics"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Laparoscopic Appendicectomy",
                    approach: .laparoscopic,
                    indication: "Standard of care for most patients",
                    keySteps: [
                        "GA, supine or left lateral tilt",
                        "3-port: umbilical 12 mm, RIF 5 mm, suprapubic 5 mm",
                        "Identify appendix at taenia coli confluence",
                        "Divide mesoappendix with LigaSure/Harmonic",
                        "Double endo-loop or stapler across base",
                        "Extract in retrieval bag",
                        "Irrigate fossa if contaminated",
                        "Closure: umbilical fascia, skin"
                    ],
                    complications: [
                        Complication(name: "Wound infection", incidence: "2–4%", management: "Antibiotics ± drainage"),
                        Complication(name: "Intra-abdominal abscess", incidence: "1–3%", management: "CT-guided drainage ± antibiotics"),
                        Complication(name: "Stump leak / blow-out", incidence: "<1%", management: "Re-operation"),
                        Complication(name: "Bleeding", incidence: "<1%", management: "Haemostasis / return to theatre")
                    ],
                    consentPoints: [
                        "Risk of conversion to open (~2–5%)",
                        "SSI, intra-abdominal collection",
                        "Injury to surrounding structures (caecum, ileum, ureter)",
                        "Stump appendicitis if base not properly divided",
                        "General anaesthetic risks",
                        "Incidental findings requiring further management"
                    ],
                    operativeTime: "30–60 min",
                    los: "Overnight / 23-hour stay"
                ),
                OperativeOption(
                    name: "Open Appendicectomy",
                    approach: .open,
                    indication: "Conversion from lap, grossly contaminated field, limited lap equipment",
                    keySteps: [
                        "Gridiron (McBurney) or Lanz incision",
                        "Split external oblique, internal oblique, transversus",
                        "Identify caecum, trace taenia to appendix",
                        "Divide mesoappendix, ligate appendicular artery",
                        "Crush base, ligate, divide — purse-string optional",
                        "Close in layers"
                    ],
                    complications: [
                        Complication(name: "Wound infection", incidence: "5–10%", management: "Antibiotics ± drainage"),
                        Complication(name: "Adhesive obstruction (long-term)", incidence: "3–5%", management: "Conservative / surgical")
                    ],
                    consentPoints: [
                        "Higher wound infection rate than laparoscopic",
                        "Longer recovery",
                        "Adhesion risk"
                    ],
                    operativeTime: "30–60 min",
                    los: "2–3 days"
                )
            ],
            nonOperativeManagement: [
                "IV co-amoxiclav 1.2 g TDS or piperacillin-tazobactam 4.5 g TDS",
                "Oral switch when apyrexial, tolerating diet (usually 48 h)",
                "Total 10-day antibiotic course",
                "Serial clinical review: if any deterioration → theatre",
                "Interval appendicectomy: controversial — offer at 6–12 weeks"
            ],
            pitfalls: [
                "Retrocaecal appendix: pain may be in flank — do not dismiss",
                "Pelvic appendix in females: differentiate from PID (gynaec review)",
                "Pregnant patient: appendix displaced superiorly — pain may be RUQ",
                "Elderly: presentation blunted — perforation rate higher",
                "Alvarado score originally validated in males — apply cautiously in females"
            ],
            keyScores: ["Alvarado score (MANTRELS)", "AIR score", "pAAS (paediatric)"]
        ),
        postOp: PostOpProtocol(
            icu: false,
            diet: "Free fluids when bowel sounds return (usually 4–6 h post-op), advance to normal diet",
            mobilisation: "Same day — sit out, walk within 4–6 h",
            analgesia: "Regular paracetamol + ibuprofen; opioid PRN for 24 h only",
            drains: "Not routinely. If used for abscess: remove when <50 mL/24 h",
            antibiotics: "Single-dose prophylaxis pre-incision. If perforated: continue 3–5 days IV then oral",
            thromboembolicProphylaxis: "LMWH day of surgery, compression stockings, early mobilisation",
            specialInstructions: [
                "No heavy lifting for 2 weeks",
                "Driving: 1 week (lap), 2–3 weeks (open)",
                "Return to sport: 4–6 weeks"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "Day 7–10 (GP or nurse-led)",
            clinicReview: "4–6 weeks post-op",
            surveillance: "None unless pathology shows unexpected finding",
            pathologyReview: "Histology at clinic review — exclude carcinoid, Crohn's, adenocarcinoma",
            redFlagReturn: [
                "Fever >38°C after discharge",
                "Increasing abdominal pain",
                "Wound dehiscence or discharge",
                "Inability to tolerate oral intake"
            ]
        ),
        searchAliases: ["appendix", "appendicitis", "RIF pain", "McBurney", "Alvarado", "appendicectomy", "appendectomy"],
        pearls: [
            "Do not delay analgesia pending diagnosis — it does not mask signs",
            "Alvarado ≥7 in a male: no CT needed — go to theatre",
            "Alvarado 4–6: CT or observation protocol (repeat exam 6–8 h)",
            "Normal appendix on lap: inspect 60 cm terminal ileum (Crohn's, Meckel's)",
            "Carcinoid <2 cm at tip: appendicectomy curative",
            "Mucinous cystadenoma at base: right hemicolectomy required"
        ]
    )

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

    // MARK: Inguinal Hernia

    static let inguinalHernia = SurgicalCondition(
        id: "inguinal_hernia",
        name: "Inguinal Hernia",
        icd10: "K40.9",
        system: .hernia,
        urgency: .elective,
        summary: "Protrusion of abdominal contents through the inguinal canal. Most common hernia (75%). Indirect (through deep inguinal ring — congenital) vs direct (through Hesselbach's triangle — acquired weakness). Male:female 8:1.",
        redFlags: [
            "Irreducibility with signs of bowel obstruction — emergency repair",
            "Strangulation: ischaemic bowel — immediate surgery",
            "Systemic sepsis from strangulated bowel"
        ],
        investigations: [
            SurgicalInvestigation(name: "Clinical examination", rationale: "Most hernias diagnosed clinically. Cough impulse, reducibility, trans-illumination in children", urgency: "Routine", keyFindings: ["Visible / palpable groin lump", "Expansile cough impulse", "Reducible / irreducible"]),
            SurgicalInvestigation(name: "USS Groin", rationale: "Equivocal examination, occult hernia, recurrent hernia, or to differentiate from lymphadenopathy / lipoma", urgency: "Routine", keyFindings: ["Hernial sac with contents", "Dynamic assessment with Valsalva"]),
            SurgicalInvestigation(name: "CT Abdomen/Pelvis", rationale: "Acute presentation with obstruction: assess bowel viability, define anatomy", urgency: "Urgent", keyFindings: ["Incarcerated contents", "Free air (perforation)", "Bowel wall thickening (ischaemia)"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Operative vs watchful waiting? Open mesh vs laparoscopic?",
            urgencyAssessment: "Symptomatic inguinal hernia: elective repair. Asymptomatic: watchful waiting acceptable (male). Acute irreducibility: urgent reduction ± emergency repair.",
            operativeIndications: [
                "Symptomatic hernia (pain, limitation of activity)",
                "Irreducible or incarcerated hernia",
                "Strangulated hernia — emergency",
                "All femoral hernias (high strangulation risk — repair promptly)",
                "Patient preference (asymptomatic)"
            ],
            nonOperativeIndications: [
                "Asymptomatic minimal-risk hernia in elderly comorbid male (watchful waiting)",
                "Patient refusal of surgery",
                "Medically unfit for anaesthesia"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Laparoscopic TEP (Totally Extraperitoneal)",
                    approach: .laparoscopic,
                    indication: "Bilateral hernias, recurrent hernia after open repair, active patients, bilateral repair",
                    keySteps: [
                        "GA, supine, Trendelenburg",
                        "Infraumbilical 10 mm port (balloon dissection of preperitoneal space)",
                        "Two 5 mm ports in midline",
                        "Develop preperitoneal space — identify Cooper's ligament, external iliac vessels, vas, testicular vessels",
                        "Reduce hernia sac",
                        "Place 15×10 cm lightweight mesh covering all potential hernia sites",
                        "Mesh fixation (tack or fibrin glue) — avoid nerve territory",
                        "Desufflate slowly — mesh drops onto posterior wall"
                    ],
                    complications: [
                        Complication(name: "Seroma", incidence: "5–10%", management: "Observation (resolves); aspiration if symptomatic"),
                        Complication(name: "Chronic groin pain", incidence: "5–15%", management: "Physio, analgesia, nerve block; rare neurectomy"),
                        Complication(name: "Recurrence", incidence: "1–3%", management: "Repeat lap or open Lichtenstein"),
                        Complication(name: "Vas / testicular vessel injury", incidence: "<1%", management: "Vascular repair; testicular loss rare")
                    ],
                    consentPoints: [
                        "Conversion to open or TAPP",
                        "Seroma",
                        "Chronic groin pain (neuralgia)",
                        "Recurrence",
                        "Testicular injury / ischaemia",
                        "Mesh-related complications (infection, migration)"
                    ],
                    operativeTime: "45–90 min",
                    los: "Day case / overnight"
                ),
                OperativeOption(
                    name: "Open Lichtenstein Tension-Free Mesh Repair",
                    approach: .open,
                    indication: "Standard open repair; suitable for all anatomic types; preferred for strangulated or complex hernias",
                    keySteps: [
                        "GA or spinal or LA + sedation",
                        "Oblique groin incision 1 cm above inguinal ligament",
                        "Open external oblique aponeurosis",
                        "Identify ilioinguinal and iliohypogastric nerves",
                        "Mobilise spermatic cord",
                        "Indirect sac: reduce or ligate at deep ring",
                        "Direct sac: reduce and plicate",
                        "Polypropylene mesh sutured to conjoint tendon + inguinal ligament with keyhole for cord",
                        "Close external oblique, Scarpa's, skin"
                    ],
                    complications: [
                        Complication(name: "Chronic groin pain", incidence: "10–15%", management: "Physio, analgesia, nerve block, triple neurectomy"),
                        Complication(name: "Seroma / haematoma", incidence: "5%", management: "Observation, aspiration if symptomatic"),
                        Complication(name: "Recurrence", incidence: "1–5%", management: "Re-repair"),
                        Complication(name: "Wound infection", incidence: "1–2%", management: "Antibiotics ± drainage")
                    ],
                    consentPoints: [
                        "Chronic groin pain (most common serious complication)",
                        "Recurrence",
                        "Wound infection",
                        "Testicular swelling / ischaemia",
                        "Seroma",
                        "Nerve injury (hypoaesthesia inner thigh)"
                    ],
                    operativeTime: "30–60 min",
                    los: "Day case"
                )
            ],
            nonOperativeManagement: [
                "Watchful waiting — safe for asymptomatic males; annual review",
                "Truss: temporary measure only, not curative",
                "Acute irreducibility: gentle reduction in Trendelenburg with sedation/analgesia before theatre if no signs of strangulation"
            ],
            pitfalls: [
                "Never attempt forceful reduction of an irreducible hernia without establishing viability",
                "Femoral hernia: higher strangulation risk than inguinal — repair promptly even if asymptomatic",
                "Recurrent hernia after open: prefer TEP to avoid scarring in anterior plane",
                "Bilateral hernias: TEP more efficient than bilateral open",
                "Avoid fixing mesh in the triangle of pain (lateral to iliopubic tract) and triangle of doom (medial to iliac vessels)"
            ],
            keyScores: ["EHS classification (primary/recurrent, medial/lateral/combined, hernia size)"]
        ),
        postOp: PostOpProtocol(
            icu: false,
            diet: "Normal diet day of surgery",
            mobilisation: "Walking within 2–4 h of surgery",
            analgesia: "Regular paracetamol + ibuprofen × 5 days; scrotal support for comfort",
            drains: "Not routinely",
            antibiotics: "Single-dose prophylaxis pre-incision; no post-op antibiotics routinely",
            thromboembolicProphylaxis: "Compression stockings; LMWH if inpatient overnight",
            specialInstructions: [
                "No heavy lifting >10 kg for 4–6 weeks",
                "Driving: 1 week (automatic) or 2 weeks (manual)",
                "Sexual activity: 2–4 weeks",
                "Return to manual work: 4–6 weeks"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "Day 7–10 (GP or nurse-led)",
            clinicReview: "6 weeks post-op",
            surveillance: "None routine",
            pathologyReview: "Not applicable",
            redFlagReturn: [
                "Increasing groin pain (haematoma, infection)",
                "Testicular swelling or pain",
                "Recurrence of lump",
                "Fever, wound discharge"
            ]
        ),
        searchAliases: ["inguinal hernia", "groin hernia", "hernia repair", "TEP", "Lichtenstein", "TAPP", "direct hernia", "indirect hernia"],
        pearls: [
            "Indirect hernia: through deep inguinal ring — lateral to inferior epigastric vessels",
            "Direct hernia: through Hesselbach's triangle — medial to inferior epigastric vessels; rarely strangulates",
            "EHS Grade I (<1.5 cm): prefer TEP; Grade III (>3 cm): open Lichtenstein or TAPP",
            "Bilateral: TEP under one anaesthetic superior to staged open repairs",
            "Chronic groin pain post-repair: ilioinguinal / iliohypogastric / genitofemoral nerve injury — triple neurectomy if severe"
        ]
    )

    // MARK: Colorectal Cancer

    static let colorectalCancer = SurgicalCondition(
        id: "colorectal_cancer",
        name: "Colorectal Cancer",
        icd10: "C18.9",
        system: .colorectal,
        urgency: .urgent,
        summary: "Third most common cancer worldwide. 95% adenocarcinoma. Left-sided (sigmoid/rectum) most common. 5-year survival: Stage I 90%, Stage II 75%, Stage III 55%, Stage IV 10–15%.",
        redFlags: [
            "Bowel obstruction — emergency surgery or stenting",
            "Perforation with faecal peritonitis — immediate surgery",
            "Major haemorrhage requiring transfusion",
            "Rapidly deteriorating condition with suspected complication"
        ],
        investigations: [
            SurgicalInvestigation(name: "Colonoscopy + Biopsy", rationale: "Diagnostic gold standard. Full colonic evaluation essential to exclude synchronous lesions", urgency: "Urgent", keyFindings: ["Histological confirmation", "Lesion location and size", "Synchronous polyps or tumours"]),
            SurgicalInvestigation(name: "CT Chest/Abdomen/Pelvis with contrast", rationale: "Staging: local extent, nodal status, distant metastases", urgency: "Urgent", keyFindings: ["T staging (wall layers involved)", "N staging (nodes >1 cm suspicious)", "M staging (liver, lung, peritoneum)"]),
            SurgicalInvestigation(name: "MRI Pelvis (rectal cancer)", rationale: "Essential for rectal tumours: CRM distance, sphincter involvement, EMVI, T-stage", urgency: "Urgent", keyFindings: ["CRM <1 mm = involved", "Low rectal cancer: sphincter distance", "Extramural vascular invasion (EMVI)"]),
            SurgicalInvestigation(name: "CEA", rationale: "Baseline for monitoring; elevated pre-op predicts recurrence risk; post-op surveillance marker", urgency: "Routine", keyFindings: [">5 ng/mL = elevated (non-specific)", "Rising CEA post-op = investigate for recurrence"]),
            SurgicalInvestigation(name: "FBC, LFTs, renal function", rationale: "Pre-operative assessment, nutritional status, organ function", urgency: "Urgent", keyFindings: ["Anaemia (iron deficiency — right-sided)", "LFT derangement (hepatic mets)"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Curative or palliative intent? Colonic vs rectal? Neoadjuvant needed?",
            urgencyAssessment: "MDT discussion mandatory for all cases. Emergency presentation (obstruction/perforation): emergency surgery. Elective: staging complete → MDT → plan.",
            operativeIndications: [
                "Curative resection: TNM Stage I–III and selected Stage IV",
                "Palliative resection for symptomatic primary (obstruction, bleeding) in Stage IV",
                "Emergency colectomy for obstruction or perforation",
                "Completion surgery after local excision with adverse histology"
            ],
            nonOperativeIndications: [
                "Stage IV with unresectable metastases and asymptomatic primary: palliative systemic therapy",
                "Rectal cancer: complete clinical response to CRT (watch and wait protocol — MERCURY II criteria)",
                "High surgical risk with asymptomatic disease: endoscopic stenting for obstruction"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Laparoscopic Right Hemicolectomy",
                    approach: .laparoscopic,
                    indication: "Caecal, ascending, proximal transverse colon cancer",
                    keySteps: [
                        "GA, supine, left lateral tilt",
                        "Medial-to-lateral approach: identify ileocolic vessels",
                        "D3 lymphadenectomy along superior mesenteric vessels",
                        "Mobilise right colon: white line of Toldt, hepatic flexure",
                        "Extracorporeal or intracorporeal ileocolic anastomosis",
                        "Check anastomosis perfusion, mesenteric defect closure"
                    ],
                    complications: [
                        Complication(name: "Anastomotic leak", incidence: "2–4%", management: "CT-guided drain / re-operation"),
                        Complication(name: "Wound infection", incidence: "5–10%", management: "Antibiotics ± drainage"),
                        Complication(name: "Ileus", incidence: "5–10%", management: "Nasogastric tube, nil by mouth, IV fluids")
                    ],
                    consentPoints: [
                        "Anastomotic leak requiring re-operation or stoma",
                        "Conversion to open",
                        "Wound / intra-abdominal infection",
                        "Ileus",
                        "Ureteric / duodenal / SMA injury",
                        "Chyle leak"
                    ],
                    operativeTime: "90–150 min",
                    los: "3–5 days (ERAS)"
                ),
                OperativeOption(
                    name: "Laparoscopic Anterior Resection (LAR) with TME",
                    approach: .laparoscopic,
                    indication: "Sigmoid and upper rectal cancer",
                    keySteps: [
                        "GA, Lloyd-Davies position",
                        "Medial-to-lateral approach: IMA ligation at origin or preserving left colic",
                        "Total mesorectal excision in holy plane — sharp dissection",
                        "Divide rectum with linear stapler",
                        "Circular stapled colorectal/coloanal anastomosis",
                        "Defunctioning loop ileostomy (distal anastomosis <10 cm from anal verge)",
                        "Drain in pelvis"
                    ],
                    complications: [
                        Complication(name: "Anastomotic leak", incidence: "5–15% (risk highest <6 cm from AV)", management: "Re-operation, Hartmann's or defunctioning stoma"),
                        Complication(name: "Low anterior resection syndrome (LARS)", incidence: "30–70%", management: "Bowel rehabilitation, LARS score, biofeedback"),
                        Complication(name: "Urinary dysfunction", incidence: "10–30%", management: "Catheter, pelvic floor physio, urology referral"),
                        Complication(name: "Sexual dysfunction", incidence: "20–40% male", management: "Erectile dysfunction management, urology")
                    ],
                    consentPoints: [
                        "Anastomotic leak — temporary or permanent stoma",
                        "Low anterior resection syndrome: frequency, urgency, incontinence",
                        "Urinary dysfunction",
                        "Sexual / erectile dysfunction",
                        "Permanent stoma (if sphincter-saving not possible)"
                    ],
                    operativeTime: "180–300 min",
                    los: "5–7 days"
                )
            ],
            nonOperativeManagement: [
                "Neoadjuvant chemoradiotherapy (CRT) for rectal cancer: T3/T4 or N+ — reduces local recurrence",
                "Short-course radiotherapy: T3 resectable rectal cancer (5 × 5 Gy)",
                "Colonic stenting: acute malignant obstruction as bridge to elective surgery",
                "FOLFOX / CAPOX adjuvant chemotherapy: Stage III (6 months), selected Stage II high-risk"
            ],
            pitfalls: [
                "Always examine entire colon — synchronous cancers in 5%, synchronous polyps in 30%",
                "MRI pelvis mandatory for all rectal cancers — guides neoadjuvant decision",
                "CRM involvement on MRI: neoadjuvant CRT before surgery",
                "Watch and wait for complete clinical response: strict patient selection and follow-up",
                "Hartmann's vs primary anastomosis in emergency: decision based on patient stability, bowel preparation, surgeon experience"
            ],
            keyScores: ["TNM staging (8th edition AJCC)", "LARS score", "CRM status on MRI", "EMVI on MRI"]
        ),
        postOp: PostOpProtocol(
            icu: false,
            diet: "ERAS protocol: oral carbohydrate loading pre-op, early oral fluids post-op (day 0–1), normal diet day 2–3",
            mobilisation: "Sit out day 0, walk day 1 (ERAS)",
            analgesia: "Epidural or TAP block × 48 h; transition to PO multimodal analgesia",
            drains: "Pelvic drain: remove day 3–4 if drain amylase <500 U/L (confirms no leak)",
            antibiotics: "Single-dose prophylaxis (cefazolin + metronidazole). Post-op antibiotics only if anastomotic leak or SSI",
            thromboembolicProphylaxis: "LMWH for 28 days post major colorectal cancer surgery, TED stockings, pneumatic compression, early mobilisation",
            specialInstructions: [
                "Ileostomy formation: stoma education pre-op, stoma nurse review day 1–2",
                "Ileostomy output >1.5 L/day: high-output management, loperamide, electrolyte monitoring",
                "Drain amylase day 3: if >500 U/L = suspect anastomotic leak"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "Day 7–10",
            clinicReview: "4–6 weeks; then 3-monthly × 2 years, 6-monthly × 3 years",
            surveillance: "CEA 3-monthly × 2 years, then 6-monthly × 3 years; CT CAP 6-monthly × 2 years; Colonoscopy at 1 year, then 3-yearly",
            pathologyReview: "Histology at first clinic: margins, nodal yield (≥12 nodes), stage, MSI status — guides adjuvant chemotherapy",
            redFlagReturn: [
                "Fever, perineal / abdominal pain (anastomotic leak, abscess)",
                "High ileostomy output (dehydration)",
                "Rectal bleeding from anastomosis",
                "New abdominal mass or symptoms suggestive of recurrence"
            ]
        ),
        searchAliases: ["colorectal cancer", "colon cancer", "rectal cancer", "CRC", "bowel cancer", "colonoscopy", "TME", "anterior resection", "hemicolectomy"],
        pearls: [
            "D3 right-sided resection: oncological adequacy requires ligation of ileocolic vessels at origin",
            "TME quality determines local recurrence rate — holy plane dissection mandatory",
            "MSI/dMMR status: Lynch syndrome? Immunotherapy benefit in Stage IV",
            "Hartmann's reversal: consider at 3–6 months if patient fit and oncological situation allows",
            "ERAS reduces LOS by 2–3 days without increasing complications"
        ]
    )

    // MARK: Haemorrhoids

    static let haemorrhoids = SurgicalCondition(
        id: "haemorrhoids",
        name: "Haemorrhoids",
        icd10: "K64.9",
        system: .perianal,
        urgency: .elective,
        summary: "Cushions of submucosal vascular tissue in the anal canal that have become symptomatic through prolapse, bleeding, or thrombosis. Internal (above dentate line) vs external (below). Graded I–IV.",
        redFlags: [
            "Massive rectal haemorrhage requiring transfusion",
            "Thrombosed strangulated prolapse — emergency haemorrhoidectomy",
            "Suspected malignancy — always biopsy unusual lesions"
        ],
        investigations: [
            SurgicalInvestigation(name: "Proctoscopy", rationale: "Visualise internal haemorrhoids. Grading and plan treatment", urgency: "Routine", keyFindings: ["Grade I: bleeding only", "Grade II: prolapse, spontaneous reduction", "Grade III: prolapse requiring manual reduction", "Grade IV: irreducible"]),
            SurgicalInvestigation(name: "Rigid / flexible sigmoidoscopy", rationale: "Exclude proximal mucosal disease causing bleeding (polyp, cancer, IBD)", urgency: "Urgent (if any red-flag symptoms)", keyFindings: ["Proximal mucosal disease", "Polyp / mass"]),
            SurgicalInvestigation(name: "Colonoscopy", rationale: "Age >45 with rectal bleeding, family history of CRC, change in bowel habit, or any atypical feature", urgency: "Urgent", keyFindings: ["Proximal colonic disease"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Conservative / office-based vs surgical? Grade determines management.",
            urgencyAssessment: "Grade I–II: conservative + office. Grade III: office procedures or surgery. Grade IV: surgery. Acutely thrombosed prolapsed: emergency haemorrhoidectomy if <72 h.",
            operativeIndications: [
                "Grade III/IV internal haemorrhoids",
                "Failed office-based procedures (Grade II/III)",
                "Acutely thrombosed strangulated prolapse (<72 h)",
                "Symptomatic external haemorrhoids"
            ],
            nonOperativeIndications: [
                "Grade I–II: dietary fibre, Sitz baths, topical agents",
                "Grade I–II: rubber band ligation (most effective office procedure)",
                "Grade I–III: injection sclerotherapy, infrared coagulation"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Rubber Band Ligation (RBL)",
                    approach: .endoscopic,
                    indication: "Grade I–II, selected Grade III",
                    keySteps: [
                        "Proctoscope insertion",
                        "Suction band applicator above dentate line",
                        "Place band at apex of haemorrhoid pedicle",
                        "Typically three haemorrhoids at separate sessions or same-day triple banding"
                    ],
                    complications: [
                        Complication(name: "Pain (if too close to dentate)", incidence: "5–10%", management: "Analgesia; remove band if severe"),
                        Complication(name: "Bleeding (band release)", incidence: "1–2%", management: "Observation; rarely transfusion"),
                        Complication(name: "Sepsis (Fournier's)", incidence: "<0.1%", management: "Urgent surgical debridement")
                    ],
                    consentPoints: [
                        "Recurrence — may require repeat treatment",
                        "Pain post-procedure (1–2 days)",
                        "Bleeding when band separates (7–10 days)",
                        "Rare: perineal sepsis (Fournier's) — return immediately if fever/pain"
                    ],
                    operativeTime: "5–10 min",
                    los: "Office procedure"
                ),
                OperativeOption(
                    name: "Haemorrhoidectomy (Milligan-Morgan)",
                    approach: .open,
                    indication: "Grade III/IV, failed office procedures, acutely thrombosed prolapse",
                    keySteps: [
                        "GA or spinal, lithotomy or prone jack-knife",
                        "Identify three primary haemorrhoidal columns (3, 7, 11 o'clock)",
                        "Elliptical incision incorporating external haemorrhoid",
                        "Dissect to pedicle above dentate line",
                        "Transfixion suture at pedicle, excise haemorrhoid",
                        "Leave wounds open (Milligan-Morgan) or close (Ferguson)",
                        "Preserve mucosal bridges between wounds"
                    ],
                    complications: [
                        Complication(name: "Post-op pain", incidence: "Near universal", management: "Multimodal analgesia, Sitz baths, laxatives"),
                        Complication(name: "Urinary retention", incidence: "10–20%", management: "Catheterisation"),
                        Complication(name: "Haemorrhage (primary/secondary)", incidence: "2–4%", management: "Return to theatre if primary; secondary: antibiotics + EUA"),
                        Complication(name: "Anal stenosis (long-term)", incidence: "1–2%", management: "Dilatation, anoplasty"),
                        Complication(name: "Incontinence", incidence: "1–3%", management: "Conservative; biofeedback; rarely SFPF")
                    ],
                    consentPoints: [
                        "Significant post-operative pain (1–2 weeks)",
                        "Urinary retention",
                        "Secondary haemorrhage (7–14 days)",
                        "Anal stenosis",
                        "Faecal incontinence (minor)",
                        "Recurrence (5–10% over 5 years)"
                    ],
                    operativeTime: "30–60 min",
                    los: "Day case to overnight"
                )
            ],
            nonOperativeManagement: [
                "High-fibre diet (25–35 g/day), adequate hydration",
                "Sitz baths 10–15 min BD–TDS",
                "Topical agents: hydrocortisone/lidocaine suppositories for acute symptoms",
                "Stool softeners (lactulose, docusate sodium)",
                "Rubber band ligation: most effective non-surgical option — 70–90% success Grade I/II"
            ],
            pitfalls: [
                "Never attribute rectal bleeding to haemorrhoids without excluding proximal pathology (age-appropriate)",
                "Thrombosed external haemorrhoid: excision within 72 h dramatically reduces pain vs conservative",
                "Avoid RBL in anticoagulated patients — risk of delayed haemorrhage",
                "Fournier's gangrene post-RBL: any fever/perineal pain within 7 days is emergency"
            ],
            keyScores: ["Goligher classification (Grade I–IV)"]
        ),
        postOp: PostOpProtocol(
            icu: false,
            diet: "High-fibre diet from day 1; adequate hydration",
            mobilisation: "Same day",
            analgesia: "Regular paracetamol + ibuprofen + metronidazole (anti-inflammatory, reduces pain and secondary haemorrhage risk), topical lidocaine gel, laxatives to prevent hard stool",
            drains: "None",
            antibiotics: "Metronidazole 400 mg TDS × 5–7 days reduces secondary haemorrhage",
            thromboembolicProphylaxis: "LMWH only if inpatient; early mobilisation",
            specialInstructions: [
                "Sitz baths × 3/day for 2 weeks",
                "Lactulose or Fybogel × 4 weeks",
                "No straining",
                "Return to work: desk 1–2 weeks; manual 3–4 weeks"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "2–4 weeks clinic review",
            clinicReview: "4–6 weeks",
            surveillance: "None unless recurrence",
            pathologyReview: "Histology if any atypical appearance — exclude melanoma or carcinoma",
            redFlagReturn: [
                "Significant rectal bleeding",
                "Fever, perineal pain (secondary haemorrhage, infection)",
                "Urinary retention >12 h"
            ]
        ),
        searchAliases: ["haemorrhoids", "hemorrhoids", "piles", "rectal bleeding", "prolapse", "rubber band", "haemorrhoidectomy", "anal"],
        pearls: [
            "Rectal bleeding = haemorrhoids only after colonoscopy if age >45 or red-flag symptoms",
            "Acutely thrombosed prolapsed haemorrhoids within 72 h: emergency haemorrhoidectomy gives rapid relief",
            "Stapled haemorrhoidopexy (PPH): faster recovery but higher recurrence — now largely abandoned",
            "HALO (haemorrhoidal artery ligation) ± RAR: effective for Grade II–III, reduced pain vs open"
        ]
    )

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
                "Aggressive IV crystalloid resuscitation: Hartmann's/Ringer's lactate 250–500 mL/h first 12–24 h",
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

    // MARK: Upper GI Bleed

    static let upperGIBleed = SurgicalCondition(
        id: "upper_gi_bleed",
        name: "Upper GI Haemorrhage",
        icd10: "K92.2",
        system: .upperGI,
        urgency: .emergency,
        summary: "Bleeding from a source proximal to the ligament of Treitz. Most common causes: peptic ulcer disease (50%), oesophageal varices (10%), Mallory-Weiss tear (5%). Mortality 10% overall, higher in variceal and re-bleeding.",
        redFlags: [
            "Haemodynamic instability — immediate resuscitation",
            "Haematemesis with haemodynamic compromise",
            "Melaena with tachycardia / hypotension",
            "Rockall score ≥5 — high re-bleed and mortality risk",
            "Known cirrhosis with variceal bleed — specific protocol"
        ],
        investigations: [
            SurgicalInvestigation(name: "FBC, coagulation, cross-match", rationale: "Baseline Hb, platelet count, INR. Group and save ± cross-match 4–6 units", urgency: "Stat", keyFindings: ["Hb <80 g/L — transfusion threshold (restrictive, Hb <70 in most; <80 in variceal)", "INR >1.5 — correct coagulopathy", "Thrombocytopaenia <50 — platelet transfusion"]),
            SurgicalInvestigation(name: "UECs, LFTs, glucose", rationale: "Renal function (pre-renal AKI), LFT (cirrhosis), glucose", urgency: "Stat", keyFindings: ["Raised urea:creatinine ratio >100 suggests upper GI source", "LFT derangement suggests cirrhosis"]),
            SurgicalInvestigation(name: "Emergency OGD (within 24 h, within 12 h if haemodynamically unstable)", rationale: "Diagnostic + therapeutic. Identifies source, allows endoscopic haemostasis", urgency: "Urgent/Stat", keyFindings: ["Forrest classification (Ia/b active bleed; IIa/b stigmata of recent bleed; IIc/III clean base)", "Forrest Ia: immediate haemostasis"]),
            SurgicalInvestigation(name: "CT Angiography", rationale: "Active bleeding if OGD fails, patient too unstable for repeat OGD, or post-op arterial bleed", urgency: "Stat", keyFindings: ["Active extravasation — embolise", "Pseudoaneurysm"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Variceal vs non-variceal? Endoscopic haemostasis or surgery? IR embolisation?",
            urgencyAssessment: "Glasgow-Blatchford score at presentation: ≥1 = admit and endoscope. Rockall pre-endoscopy score ≥3 = urgent OGD. Variceal suspected: give terlipressin + antibiotics before OGD.",
            operativeIndications: [
                "Failed endoscopic haemostasis (two attempts)",
                "Haemodynamic instability despite resuscitation with active bleeding",
                "Re-bleeding after successful initial endoscopy (second OGD first)",
                "Aorto-enteric fistula (immediate laparotomy)",
                "Gastric outlet obstruction from chronic ulcer"
            ],
            nonOperativeIndications: [
                "Non-variceal: dual endoscopic therapy (injection + thermal or clipping)",
                "Variceal: band ligation ± terlipressin; TIPS if refractory",
                "IR: angiographic embolisation for arterial bleed post-failed endoscopy",
                "PPI: IV pantoprazole infusion 80 mg bolus then 8 mg/h × 72 h post endoscopic haemostasis"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Emergency Laparotomy — Bleeding Peptic Ulcer",
                    approach: .open,
                    indication: "Failed endoscopy, haemodynamic instability, DU with visible vessel",
                    keySteps: [
                        "Upper midline laparotomy",
                        "Duodenotomy / gastrotomy to expose ulcer",
                        "Under-running of bleeding vessel (gastroduodenal artery) with 0 Vicryl",
                        "Pyloroplasty to close duodenotomy if required",
                        "Partial gastrectomy (Billroth II) for large gastric ulcer",
                        "Vagotomy: now rarely performed"
                    ],
                    complications: [
                        Complication(name: "Re-bleeding", incidence: "10–15%", management: "Angiographic embolisation before re-operation"),
                        Complication(name: "Anastomotic leak (Billroth)", incidence: "3–5%", management: "Re-operation"),
                        Complication(name: "Mortality (emergency surgery)", incidence: "10–30%", management: "Resuscitation, ICU")
                    ],
                    consentPoints: [
                        "High operative mortality in haemodynamically compromised patient",
                        "Re-bleeding",
                        "Anastomotic leak",
                        "ICU admission likely",
                        "Blood transfusion"
                    ],
                    operativeTime: "60–120 min",
                    los: "ICU + 7–14 days"
                )
            ],
            nonOperativeManagement: [
                "ABC resuscitation: 2 large-bore IV, cross-match, fluid resuscitation",
                "Restrictive transfusion: target Hb 70–80 g/L (80 g/L in variceal/cardiovascular disease)",
                "IV PPI: omeprazole/pantoprazole 80 mg bolus + 8 mg/h × 72 h post haemostasis",
                "Variceal: terlipressin 2 mg IV stat, ceftriaxone 1 g IV OD × 5 days, band ligation on OGD",
                "H. pylori testing at OGD — eradicate if positive (reduces recurrence)",
                "TIPS referral for refractory variceal bleeding"
            ],
            pitfalls: [
                "Transfuse to 70–80 g/L — over-transfusion worsens variceal bleeding by increasing portal pressure",
                "Always test for H. pylori at OGD if peptic ulcer — failure to treat = 50–80% recurrence",
                "Aorto-enteric fistula: any UGIB in patient with previous aortic graft — immediate laparotomy",
                "Dieulafoy lesion: small artery in mucosa without ulceration — easy to miss on OGD; may need repeat scope"
            ],
            keyScores: ["Glasgow-Blatchford Score (pre-endoscopy)", "Rockall Score (pre + post-endoscopy)", "Forrest Classification (endoscopic)"]
        ),
        postOp: PostOpProtocol(
            icu: true,
            diet: "NBM for 24 h post-emergency surgery; NGT if gastroparesis; advance as tolerated",
            mobilisation: "As tolerated — ICU protocol",
            analgesia: "Morphine PCA; avoid NSAIDs and antiplatelet agents",
            drains: "Nasogastric drainage; intra-abdominal drain if anastomosis",
            antibiotics: "Cephalosporin + metronidazole if peritonitis",
            thromboembolicProphylaxis: "LMWH when haemostasis secure (24–48 h); TED stockings",
            specialInstructions: [
                "Restart anticoagulation at 48–72 h if haemostasis secure (MDT decision)",
                "PPI (omeprazole 40 mg OD) life-long if continued NSAID/antiplatelet use",
                "H. pylori eradication: confirm successful eradication at 4 weeks (urea breath test)"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "Day 7–10",
            clinicReview: "4–6 weeks; repeat OGD at 6–8 weeks (gastric ulcer) to confirm healing and exclude malignancy",
            surveillance: "Annual OGD if Barrett's identified; H. pylori confirmation of eradication",
            pathologyReview: "Biopsy any gastric ulcer at OGD — exclude malignancy; repeat OGD until healed",
            redFlagReturn: [
                "Recurrent haematemesis or melaena",
                "Syncope or haemodynamic compromise",
                "Epigastric pain worsening"
            ]
        ),
        searchAliases: ["upper GI bleed", "haematemesis", "melena", "melaena", "peptic ulcer", "variceal bleed", "Rockall", "Blatchford", "OGD emergency"],
        pearls: [
            "Glasgow-Blatchford = 0: safe for outpatient OGD within 24 h",
            "Forrest Ia/IIa: dual endoscopic therapy — clips + injection or thermal — superior to single modality",
            "Variceal bleed: TIPS for refractory disease (Baveno VI criteria)",
            "Dabigatran reversal: idarucizumab 5 g IV before emergency endoscopy if haemodynamically compromised"
        ]
    )

    // MARK: Anal Fissure

    static let analFissure = SurgicalCondition(
        id: "anal_fissure",
        name: "Anal Fissure",
        icd10: "K60.0",
        system: .perianal,
        urgency: .elective,
        summary: "Longitudinal tear in the anoderm distal to the dentate line. Acute (<6 weeks) vs chronic (>6 weeks with fibrosis, sentinel pile, and hypertrophied anal papilla). 90% posterior midline. Pathophysiology: high internal anal sphincter tone + ischaemia.",
        redFlags: [
            "Lateral fissure — consider Crohn's disease, HIV, TB, syphilis, malignancy",
            "Multiple fissures — exclude inflammatory bowel disease",
            "Non-healing despite treatment — biopsy to exclude carcinoma"
        ],
        investigations: [
            SurgicalInvestigation(name: "Clinical examination (DRE deferred if pain-limiting)", rationale: "Diagnosis clinical: split skin visible at anal margin. Gentle traction reveals fissure. Do not force examination in acute phase", urgency: "Routine", keyFindings: ["Skin tag (sentinel pile) at base", "Fibrosis at margins (chronic)", "Exposed internal sphincter fibres (chronic)"]),
            SurgicalInvestigation(name: "Anorectal manometry", rationale: "If surgical treatment planned: assess baseline sphincter pressures. Resting pressure >90 mmHg supports internal sphincterotomy", urgency: "Routine", keyFindings: ["High resting IAS tone", "Normal squeeze pressure"]),
            SurgicalInvestigation(name: "Colonoscopy / Sigmoidoscopy", rationale: "Only if atypical location, multiple fissures, or IBD suspected", urgency: "Routine", keyFindings: ["IBD", "Malignancy"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Medical management or surgical sphincterotomy?",
            urgencyAssessment: "Stepwise: acute fissure → medical first. Chronic fissure unresponsive to medical treatment → botulinum toxin or lateral internal sphincterotomy (LIS).",
            operativeIndications: [
                "Chronic fissure failed 8–12 weeks of medical treatment",
                "Fissure with hypertrophied anal papilla / sentinel pile requiring excision",
                "Patient preference after failed conservative care"
            ],
            nonOperativeIndications: [
                "Acute fissure: topical GTN 0.2% TDS or diltiazem 2% BD",
                "Botulinum toxin injection: 20–30 units into internal sphincter bilateral — first-line for chronic in patients preferring to avoid surgery",
                "Fibre supplementation, Sitz baths, topical anaesthetic for acute"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Lateral Internal Sphincterotomy (LIS)",
                    approach: .open,
                    indication: "Chronic fissure, failed conservative/botox, high resting tone on manometry",
                    keySteps: [
                        "GA or spinal, lithotomy",
                        "Identify inter-sphincteric groove at 3 o'clock",
                        "Submucosal injection of bupivacaine with adrenaline",
                        "Open technique: 1 cm radial incision, dissect to IAS under direct vision",
                        "Divide IAS to level of dentate line (not above)",
                        "Haemostasis, no closure required",
                        "Closed technique: scalpel blade inserted laterally into inter-sphincteric groove, divide IAS by sweeping blade medially"
                    ],
                    complications: [
                        Complication(name: "Incontinence (flatus/faecal)", incidence: "1–10% (risk higher in women, multipara)", management: "Biofeedback physio; sphincter repair rarely required"),
                        Complication(name: "Recurrence", incidence: "2–5%", management: "Repeat LIS or botulinum toxin"),
                        Complication(name: "Haematoma / abscess", incidence: "1–2%", management: "Drainage")
                    ],
                    consentPoints: [
                        "Risk of incontinence (gas, liquid stool) — carefully counsel women and elderly",
                        "Recurrence requiring further treatment",
                        "Haematoma",
                        "Preferred alternative to botulinum toxin: lower recurrence but irreversible"
                    ],
                    operativeTime: "15–30 min",
                    los: "Day case"
                )
            ],
            nonOperativeManagement: [
                "Topical GTN 0.2–0.4% TDS × 8 weeks: heals 50–70% acute; headache main side-effect",
                "Topical diltiazem 2% BD × 8 weeks: similar efficacy, fewer headaches",
                "Botulinum toxin 20–30 units bilaterally into IAS: 70–80% healing chronic fissure",
                "Warm Sitz baths after each bowel motion",
                "Ispaghula husk / Fybogel to maintain soft stool",
                "Topical anaesthetic (lidocaine 5%) for symptomatic relief pre-defaecation"
            ],
            pitfalls: [
                "Lateral fissure: mandatory investigation for Crohn's, HIV, STI, carcinoma — do not treat as primary fissure",
                "LIS in women with low squeeze pressure on manometry: high incontinence risk — prefer botox",
                "GTN headache (30%): start with low dose 0.1% and build up; prescribe paracetamol prophylactically",
                "Failure to heal with medical treatment at 12 weeks: escalate — do not continue indefinitely"
            ],
            keyScores: ["None specific — clinical diagnosis and manometry"]
        ),
        postOp: PostOpProtocol(
            icu: false,
            diet: "High-fibre diet from day 1",
            mobilisation: "Same day",
            analgesia: "Paracetamol + ibuprofen; topical lidocaine gel; Sitz baths",
            drains: "None",
            antibiotics: "None routinely",
            thromboembolicProphylaxis: "None routinely for day case",
            specialInstructions: [
                "Sitz baths × 3/day for 2 weeks",
                "Fybogel or Lactulose to maintain soft stool",
                "Return to work: 1 week desk; 2 weeks manual"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "Not applicable (day case, no wound)",
            clinicReview: "6–8 weeks — assess healing, continence",
            surveillance: "None unless recurrence",
            pathologyReview: "If sentinel pile excised — histology to exclude malignancy",
            redFlagReturn: [
                "New incontinence post-LIS",
                "Perianal abscess / swelling",
                "Failure to heal at 12 weeks"
            ]
        ),
        searchAliases: ["anal fissure", "fissure", "anal pain", "sphincterotomy", "LIS", "GTN", "diltiazem", "botulinum toxin"],
        pearls: [
            "GTN / diltiazem: chemical sphincterotomy — useful as first-line, but recurrence 30–50% at 1 year",
            "Botulinum toxin: effective bridge if medical treatment fails before committing to LIS",
            "LIS should only divide IAS to the dentate line — any higher risks incontinence",
            "Women with multiparity: always check manometry before LIS — squeeze pressure often low baseline"
        ]
    )

    // MARK: Perforated Viscus

    static let perforatedViscus = SurgicalCondition(
        id: "perforated_viscus",
        name: "Perforated Viscus",
        icd10: "K63.1",
        system: .emergency,
        urgency: .immediate,
        summary: "Full-thickness disruption of the gastrointestinal wall causing peritoneal contamination. Most common causes: perforated duodenal ulcer (PUD), perforated diverticulitis, colonic perforation from malignancy, iatrogenic (post-endoscopy). Life-threatening surgical emergency.",
        redFlags: [
            "Generalised peritonitis — immediate laparotomy",
            "Haemodynamic instability / septic shock",
            "Free gas on erect CXR or CT — all require urgent surgery unless patient explicitly refuses",
            "Faecal peritonitis (colonic perforation) — highest mortality"
        ],
        investigations: [
            SurgicalInvestigation(name: "Erect CXR", rationale: "Free subdiaphragmatic gas in 70–80% of perforations. Quick bedside test", urgency: "Stat", keyFindings: ["Free air under diaphragm = perforation until proven otherwise"]),
            SurgicalInvestigation(name: "CT Abdomen/Pelvis with IV contrast (oral contrast only if tolerated)", rationale: "Gold standard — identifies site, extent of contamination, associated pathology", urgency: "Stat", keyFindings: ["Pneumoperitoneum", "Site of perforation (pericolic fat stranding, duodenal defect)", "Free fluid", "Extraluminal contrast"]),
            SurgicalInvestigation(name: "FBC, CRP, LFTs, RFTs, lactate, coagulation, cross-match", rationale: "Organ function, coagulopathy, severity — guide resuscitation and operative risk", urgency: "Stat", keyFindings: ["Lactate >2 mmol/L = tissue hypoperfusion", "WBC >20 = severe sepsis", "Elevated creatinine = AKI"])
        ],
        algorithm: SurgicalAlgorithm(
            clinicalQuestion: "Immediate surgery vs brief resuscitation then surgery? Peritoneal lavage vs resection?",
            urgencyAssessment: "Peritonitis with free gas = emergency surgery after brief resuscitation (<60 min). No systemic compromise + localised perforation in selected DU patients: trial of conservative management (Boey criteria).",
            operativeIndications: [
                "All: generalised peritonitis with pneumoperitoneum → surgery",
                "Faecal peritonitis (colonic perforation) → resection mandatory",
                "Haemodynamic instability not responding to resuscitation",
                "Perforated diverticulitis Hinchey III/IV",
                "Perforated malignancy"
            ],
            nonOperativeIndications: [
                "Perforated DU: highly selected, Boey score 0, symptoms <24 h, no peritonitis — Taylor protocol (NGT, IV PPIs, IV antibiotics) with very close monitoring",
                "Contained perforation on CT with no generalised peritonitis"
            ],
            operativeOptions: [
                OperativeOption(
                    name: "Laparoscopic / Open Graham Patch Repair (Perforated DU)",
                    approach: .laparoscopic,
                    indication: "Perforated duodenal ulcer with generalised peritonitis",
                    keySteps: [
                        "GA, supine",
                        "Lap: 4-port, identify perforation site (anterior DU)",
                        "Graham patch: omental flap sutured over perforation with 2–0 Vicryl",
                        "Peritoneal lavage 4–6 L warm saline",
                        "Drain near repair site",
                        "Open: upper midline, same technique"
                    ],
                    complications: [
                        Complication(name: "Leak from patch repair", incidence: "2–5%", management: "Re-operation or IR drainage"),
                        Complication(name: "Intra-abdominal abscess", incidence: "5–10%", management: "CT-guided drainage"),
                        Complication(name: "Mortality (perforated DU)", incidence: "5–10% (higher with delayed surgery)", management: "ICU management")
                    ],
                    consentPoints: [
                        "High operative risk in peritonitis and sepsis",
                        "Leak from repair",
                        "ICU admission",
                        "Blood transfusion",
                        "Mortality risk"
                    ],
                    operativeTime: "60–90 min",
                    los: "ICU + 5–7 days"
                ),
                OperativeOption(
                    name: "Emergency Hartmann's Procedure (Perforated Sigmoid)",
                    approach: .open,
                    indication: "Perforated diverticulitis Hinchey III/IV, perforated sigmoid malignancy",
                    keySteps: [
                        "GA, Lloyd-Davies or supine",
                        "Lower midline laparotomy",
                        "Identify and mobilise perforated segment",
                        "Resect sigmoid colon — adequate proximal and distal margins",
                        "End colostomy in LIF (Hartmann's)",
                        "Oversew rectal stump or staple",
                        "Peritoneal lavage 6–10 L",
                        "Abdominal closure ± VAC (damage control)"
                    ],
                    complications: [
                        Complication(name: "Mortality (Hinchey IV)", incidence: "20–40%", management: "ICU, damage control surgery"),
                        Complication(name: "Wound dehiscence", incidence: "5–10%", management: "VAC, delayed closure"),
                        Complication(name: "Stoma complications", incidence: "10–20%", management: "Stoma nurse; revision if prolapse/retraction"),
                        Complication(name: "Permanent stoma (if not reversed)", incidence: "30–50%", management: "Counselling for permanent stoma")
                    ],
                    consentPoints: [
                        "High mortality in faecal peritonitis",
                        "Permanent stoma likelihood",
                        "ICU admission",
                        "Multiple operations",
                        "Wound dehiscence"
                    ],
                    operativeTime: "90–150 min",
                    los: "ICU + 10–21 days"
                )
            ],
            nonOperativeManagement: [
                "Taylor protocol (perforated DU): NBM, NGT on free drainage, IV omeprazole 80 mg/h, IV piperacillin-tazobactam, 4-hourly clinical reassessment — convert to surgery if deteriorating",
                "Resuscitation: 2 large-bore IV, crystalloid bolus 500 mL, early vasopressors if shock, ICU consult"
            ],
            pitfalls: [
                "Delay kills — maximum acceptable delay from perforation to theatre in generalised peritonitis is 6 h",
                "Colonic perforation: do not attempt primary anastomosis in contaminated field without diverting stoma in unstable patient",
                "Post-endoscopy perforation: early (within hours) — immediate laparotomy; late (>24 h, contained): may be managed conservatively",
                "Boey score ≥1: do not attempt conservative management of perforated DU"
            ],
            keyScores: ["Boey score (0–3): 0 = low risk; ≥2 = 60% mortality", "Hinchey classification (diverticular perforation: I–IV)", "POSSUM / P-POSSUM for operative risk"]
        ),
        postOp: PostOpProtocol(
            icu: true,
            diet: "NBM until bowel function returns; NGT if ileus; TPN if prolonged ileus",
            mobilisation: "ICU protocol; aim to sit out day 1–2",
            analgesia: "Epidural or PCA morphine; step down to oral as improving",
            drains: "Intra-abdominal drain: remove when output <50 mL serous and CRP trending down",
            antibiotics: "IV piperacillin-tazobactam 4.5 g TDS × 5–7 days (or per microbiology sensitivities from peritoneal fluid)",
            thromboembolicProphylaxis: "LMWH 24–48 h post-op, TED stockings, pneumatic compression",
            specialInstructions: [
                "H. pylori eradication if peptic ulcer perforation (test at 6 weeks, treat if positive)",
                "PPI life-long post DU repair",
                "Hartmann's reversal: consider at 6 months if patient fit and fit for anaesthesia",
                "Stoma nurse review pre- and post-op"
            ]
        ),
        followUp: FollowUpProtocol(
            woundCheck: "Day 7–10",
            clinicReview: "4–6 weeks; plan Hartmann's reversal at 6 months if appropriate",
            surveillance: "Colonoscopy at 3 months (perforated diverticulitis — exclude malignancy) or (perforated colon — ensure primary pathology treated)",
            pathologyReview: "Perforated segment histology: exclude malignancy, confirm diverticular disease or Crohn's",
            redFlagReturn: [
                "Fever, abdominal pain (subphrenic / pelvic abscess)",
                "Wound dehiscence",
                "High stoma output (>1.5 L/day) — dehydration",
                "Failure to pass flatus/faeces"
            ]
        ),
        searchAliases: ["perforated viscus", "peptic ulcer perforation", "perforated DU", "pneumoperitoneum", "peritonitis", "Hartmann", "Graham patch", "perforated diverticulitis"],
        pearls: [
            "Time to theatre is the most important modifiable outcome factor — each hour of delay increases mortality 2%",
            "Boey score: ASA III/IV = 1 pt; pre-op shock = 1 pt; symptoms >24 h = 1 pt — score ≥2 is very high risk",
            "Laparoscopic Graham patch in experienced hands is equivalent to open in haemodynamically stable patient",
            "Perforated malignancy: resect tumour — patch repair risks delayed leak and delays cancer treatment"
        ]
    )

    // MARK: - Main Database

    static let allConditions: [SurgicalCondition] = [
        acuteAppendicitis,
        acuteCholecystitis,
        choledocholithiasis,
        inguinalHernia,
        colorectalCancer,
        haemorrhoids,
        acutePancreatitis,
        upperGIBleed,
        analFissure,
        perforatedViscus
    ]
}
