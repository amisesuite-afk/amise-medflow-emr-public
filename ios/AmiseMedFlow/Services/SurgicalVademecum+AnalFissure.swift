// SurgicalVademecum+AnalFissure.swift
// Surgical vademecum entries for: Anal Fissure

import Foundation

extension SurgicalVademecum {

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

}
