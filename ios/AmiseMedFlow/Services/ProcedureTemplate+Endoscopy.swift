// ProcedureTemplate+Endoscopy.swift
// Endoscopy and ERCP procedures.

import Foundation

extension ProcedureTemplate {

    static let _endoscopy: [ProcedureTemplate] = [
        // ── ENDOSCOPY ───────────────────────────────────────────────────────

        ProcedureTemplate(
            name: "Oesophago-gastro-duodenoscopy (OGD)",
            category: .endoscopy,
            shortName: "OGD",
            anaesthesiaType: "MAC / Propofol sedation",
            position: "Left lateral",
            positioning: [],
            skinPrep: "Not applicable",
            draping: "Endoscopy drape",
            incision: "Not applicable — per-oral endoscopy",
            techniqueDescription:
                "Patient in left lateral position with supplemental oxygen via nasal prongs. " +
                "Bite guard in situ. Pharynx sprayed with 10% lidocaine. " +
                "Olympus EV-3 gastroscope passed under direct vision per-orally. " +
                "Oesophagus, gastro-oesophageal junction, stomach (including retroflexion in fundus), pylorus, and duodenum to D2 inspected. " +
                "Biopsies taken as indicated. Photographs of all significant findings.",
            closure: "Not applicable.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Nil by mouth 1 hour post-procedure then light diet. " +
                "If biopsy for H. pylori — await results and treat if positive. " +
                "If Barrett's — arrange surveillance interval per guidelines. " +
                "Discharge 30 minutes after sedation recovery.",
            followUpWeeks: "2",
            patientDescription:
                "A flexible camera (endoscope) passed through the mouth to examine the oesophagus, stomach, and the first part of the small bowel. " +
                "Biopsies may be taken for testing.",
            specificRisks: [
                "Perforation (rare)",
                "Bleeding after biopsy/treatment",
                "Aspiration",
                "Reaction to sedation",
                "Sore throat (common, temporary)"
            ],
            alternatives: [
                "Barium swallow / CT scan",
                "Conservative management / watchful waiting"
            ]
        ),

        ProcedureTemplate(
            name: "Colonoscopy (Diagnostic)",
            category: .endoscopy,
            shortName: "Colonoscopy",
            anaesthesiaType: "MAC / Midazolam + Fentanyl sedation",
            position: "Left lateral",
            positioning: [],
            skinPrep: "Not applicable",
            draping: "Endoscopy drape",
            incision: "Not applicable — per-anal endoscopy",
            techniqueDescription:
                "Patient in left lateral position. Digital rectal examination performed. " +
                "Olympus CF-HQ190 colonoscope introduced per-anally. " +
                "Scope advanced to caecum — caecal intubation confirmed by appendix orifice and ileocaecal valve. " +
                "Ileum intubated and inspected. " +
                "Systematic withdrawal and inspection of all colonic segments (ascending, hepatic flexure, transverse, splenic flexure, descending, sigmoid, rectum). " +
                "Boston Bowel Prep Scale scores recorded per segment. " +
                "Biopsies taken as indicated. Photographs of all findings. " +
                "Retroflexion in rectum performed.",
            closure: "Not applicable.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Light diet same day. Normal activities next day. " +
                "If biopsies taken — await histology. " +
                "Next surveillance interval as per findings and guidelines.",
            followUpWeeks: "2",
            patientDescription:
                "A flexible camera passed through the back passage to examine the full length of the large bowel. " +
                "Small samples (biopsies) may be taken for laboratory testing.",
            specificRisks: [
                "Perforation (1 in 1000)",
                "Post-polypectomy bleeding",
                "Aspiration",
                "Reaction to sedation",
                "Incomplete examination — repeat may be required",
                "Abdominal discomfort / bloating (common, temporary)"
            ],
            alternatives: [
                "CT colonography (virtual colonoscopy)",
                "Barium enema",
                "Flexible sigmoidoscopy"
            ]
        ),

        ProcedureTemplate(
            name: "Colonoscopy + Polypectomy",
            category: .endoscopy,
            shortName: "Colonoscopy + Polyp",
            anaesthesiaType: "MAC / Midazolam + Fentanyl sedation",
            position: "Left lateral",
            positioning: [],
            skinPrep: "Not applicable",
            draping: "Endoscopy drape",
            incision: "Not applicable — per-anal endoscopy",
            techniqueDescription:
                "Standard colonoscopy to caecum as above. " +
                "Polyp(s) identified and assessed — size, morphology (Paris classification), NICE/JNET pattern. " +
                "Cold snare polypectomy (≤10 mm): snare applied at base, polyp removed, retrieved in suction trap. " +
                "Hot snare EMR (>10 mm flat lesion): submucosal lift with saline + methylene blue, snare resection en bloc or piecemeal. " +
                "Haemostasis with APC / clip / adrenaline injection as required. " +
                "All polyps retrieved for histology.",
            closure: "Not applicable.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Light diet same day. Avoid NSAIDs / anticoagulants for 7 days if not contraindicated. " +
                "Return to ED if significant rectal bleeding. " +
                "Next surveillance colonoscopy per polyp pathology and guidelines (1, 3, or 5 years).",
            followUpWeeks: "4",
            patientDescription:
                "Examination of the large bowel with a camera, and removal of any polyp(s) found using a wire loop (snare). " +
                "The removed tissue is sent to pathology.",
            specificRisks: [
                "Post-polypectomy bleeding — immediate or delayed (1 in 100)",
                "Perforation",
                "Incomplete removal requiring further procedure",
                "Abdominal discomfort",
                "Reaction to sedation"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Surgical resection (large or non-liftable lesions)"
            ]
        ),

        ProcedureTemplate(
            name: "ERCP + Biliary Sphincterotomy",
            category: .endoscopy,
            shortName: "ERCP + Sphinct.",
            anaesthesiaType: "General",
            position: "Prone",
            positioning: [],
            skinPrep: "Not applicable",
            draping: "Endoscopy drape with fluoroscopy access",
            incision: "Not applicable — per-oral duodenoscopy",
            techniqueDescription:
                "Patient prone. Prophylactic IV antibiotics administered. " +
                "Olympus TJF-Q180V duodenoscope advanced to D2 under direct vision. " +
                "Major papilla identified. Selective deep cannulation of the bile duct achieved with Dreamtome catheter / guidewire technique. " +
                "Cholangiogram performed — CBD calibre, filling defects, strictures documented. " +
                "Biliary sphincterotomy performed with cutting current — incision up to papillary roof. " +
                "Stones extracted using balloon sweep / Dormia basket. " +
                "Fluoroscopic confirmation of duct clearance. Post-sphincterotomy appearance checked.",
            closure: "Not applicable.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Nil by mouth 4 hours post-procedure, then clear fluids. " +
                "Monitor amylase at 4 hours. Monitor for pancreatitis, bleeding, cholangitis. " +
                "PR indomethacin 100 mg given at end of procedure (pancreatitis prophylaxis). " +
                "Discharge next day if no complications.",
            followUpWeeks: "2",
            patientDescription:
                "A flexible camera is passed through the mouth and stomach into the small bowel. " +
                "A cut is made in the bile duct opening (sphincterotomy) and any stones in the bile duct are removed.",
            specificRisks: [
                "Post-ERCP pancreatitis (3–5%)",
                "Bleeding after sphincterotomy",
                "Perforation",
                "Cholangitis / sepsis",
                "Contrast reaction",
                "Incomplete clearance requiring repeat ERCP",
                "Aspiration"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Surgical exploration of common bile duct",
                "Percutaneous transhepatic cholangiogram (PTC)"
            ]
        ),

        ProcedureTemplate(
            name: "ERCP + Biliary Stent Insertion",
            category: .endoscopy,
            shortName: "ERCP + Stent",
            anaesthesiaType: "General",
            position: "Prone",
            positioning: [],
            skinPrep: "Not applicable",
            draping: "Endoscopy drape with fluoroscopy",
            incision: "Not applicable — per-oral duodenoscopy",
            techniqueDescription:
                "Patient prone. IV antibiotics given. Duodenoscope to D2. " +
                "Selective CBD cannulation with guidewire. Cholangiogram — stricture level, length, degree of duct dilatation documented. " +
                "Brush cytology / biopsy taken from stricture if indicated. " +
                "Sphincterotomy performed. Guidewire advanced across stricture. " +
                "Plastic stent (10Fr, selected length) / SEMS positioned across stricture with proximal flange above and distal flange below. " +
                "Adequate drainage confirmed fluoroscopically — bile / contrast efflux observed.",
            closure: "Not applicable.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Monitor for cholangitis, pancreatitis, jaundice resolution. " +
                "LFTs at 24–48h. PR indomethacin at end of procedure. " +
                "Plastic stent exchange planned 3 months. SEMS — per malignancy protocol.",
            followUpWeeks: "4",
            patientDescription:
                "A flexible camera is passed through the mouth into the bile duct. A small plastic or metal tube (stent) is placed in the bile duct to relieve a blockage and allow bile to drain.",
            specificRisks: [
                "Post-ERCP pancreatitis",
                "Cholangitis / sepsis",
                "Stent migration / occlusion requiring replacement",
                "Bleeding",
                "Perforation",
                "Contrast reaction"
            ],
            alternatives: [
                "Surgical bypass",
                "Percutaneous transhepatic drainage",
                "Conservative management / watchful waiting"
            ]
        ),

        ProcedureTemplate(
            name: "Flexible Sigmoidoscopy",
            category: .endoscopy,
            shortName: "Flex Sig",
            anaesthesiaType: "No sedation (or minimal)",
            position: "Left lateral",
            positioning: [],
            skinPrep: "Not applicable",
            draping: "Endoscopy drape",
            incision: "Not applicable — per-anal endoscopy",
            techniqueDescription:
                "Patient in left lateral position. No sedation or Entonox for analgesia. " +
                "Digital rectal examination. Flexible sigmoidoscope introduced per-anally. " +
                "Scope advanced to splenic flexure / descending colon. " +
                "Systematic inspection on withdrawal — rectum, sigmoid, descending colon. " +
                "Biopsies / photographs as indicated.",
            closure: "Not applicable.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Normal diet same day. Return to normal activities immediately. " +
                "Await histology if biopsies taken.",
            followUpWeeks: "2",
            patientDescription:
                "A short flexible camera passed through the back passage to examine the lower large bowel (rectum and sigmoid colon). Usually performed without sedation.",
            specificRisks: [
                "Perforation (very rare)",
                "Bleeding after biopsy",
                "Abdominal discomfort / bloating (common, brief)"
            ],
            alternatives: [
                "Full colonoscopy",
                "CT colonography"
            ]
        ),

    ]

}
