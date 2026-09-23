// SurgicalVademecum+Haemorrhoids.swift
// Surgical vademecum entries for: Haemorrhoids

extension SurgicalVademecum {

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

}
