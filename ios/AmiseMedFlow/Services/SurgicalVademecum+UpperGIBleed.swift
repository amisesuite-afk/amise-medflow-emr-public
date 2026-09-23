// SurgicalVademecum+UpperGIBleed.swift
// Surgical vademecum entries for: Upper GI Bleed

extension SurgicalVademecum {

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

}
