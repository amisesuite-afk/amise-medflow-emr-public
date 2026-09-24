// SurgicalVademecum+ColorectalCancer.swift
// Surgical vademecum entries for: Colorectal Cancer

import Foundation

extension SurgicalVademecum {

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

}
