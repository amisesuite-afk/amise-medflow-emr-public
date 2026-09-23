// SurgicalVademecum+PerforatedViscus.swift
// Surgical vademecum entries for: Perforated Viscus

extension SurgicalVademecum {

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

}
