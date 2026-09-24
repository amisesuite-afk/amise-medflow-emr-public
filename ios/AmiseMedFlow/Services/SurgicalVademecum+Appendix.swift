// SurgicalVademecum+Appendix.swift
// Surgical vademecum entries for: Appendix

import Foundation

extension SurgicalVademecum {

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

}
