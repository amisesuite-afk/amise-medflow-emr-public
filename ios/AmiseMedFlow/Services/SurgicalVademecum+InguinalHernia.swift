// SurgicalVademecum+InguinalHernia.swift
// Surgical vademecum entries for: Inguinal Hernia

extension SurgicalVademecum {

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

}
