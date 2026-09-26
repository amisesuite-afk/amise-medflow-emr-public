// ProcedureTemplate+Laparoscopic.swift
// Laparoscopic procedures.

import Foundation

extension ProcedureTemplate {

    static let _laparoscopic: [ProcedureTemplate] = [
        // ── LAPAROSCOPIC ────────────────────────────────────────────────────

        ProcedureTemplate(
            name: "Laparoscopic Cholecystectomy",
            category: .laparoscopic,
            shortName: "Lap Chole",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Shoulder roll", "Arm board"],
            skinPrep: "Chlorhexidine/alcohol",
            draping: "Standard laparoscopic draping",
            incision: "10 mm umbilical port, 5 mm epigastric port, two 5 mm right subcostal working ports",
            techniqueDescription:
                "Pneumoperitoneum established via Veress needle / Hassan technique at the umbilicus to 15 mmHg. " +
                "Four-port laparoscopic technique used. Patient placed in reverse Trendelenburg with left lateral tilt. " +
                "Critical view of safety achieved with dissection of the hepatocystic triangle. " +
                "Cystic duct and cystic artery identified, doubly clipped with polymer clips and divided. " +
                "Gallbladder dissected from the liver bed using hook diathermy and retrieved in an Endocatch bag via the umbilical port. " +
                "Haemostasis achieved. Thorough peritoneal lavage performed. " +
                "Ports removed under vision. Pneumoperitoneum deflated.",
            closure: "Umbilical fascia closed with 0 Vicryl J-needle. Skin closed with 4-0 Monocryl subcuticular suture and Steri-Strips.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Light diet same day. Mobilise 4 hours post-op. " +
                "Paracetamol 1g QID and Ibuprofen 400mg TDS regular analgesia. " +
                "Ondansetron PRN for nausea. Prophylactic LMWH if risk factors. " +
                "Discharge day 1 post-op if tolerating diet and pain controlled.",
            followUpWeeks: "2",
            patientDescription:
                "Removal of the gallbladder using keyhole (laparoscopic) surgery through three or four small cuts on the abdomen. " +
                "A camera and instruments are passed through the cuts to remove the gallbladder safely.",
            specificRisks: [
                "Bile duct injury",
                "Bile leak",
                "Retained stone in common bile duct",
                "Conversion to open surgery",
                "Post-op ileus / obstruction",
                "Port-site hernia"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Medical management (medications)",
                "Interventional radiology"
            ]
        ),

        ProcedureTemplate(
            name: "Laparoscopic Appendicectomy",
            category: .laparoscopic,
            shortName: "Lap Appendix",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board"],
            skinPrep: "Chlorhexidine/alcohol",
            draping: "Standard laparoscopic draping",
            incision: "10 mm umbilical port, 5 mm left iliac fossa port, 5 mm suprapubic port",
            techniqueDescription:
                "Pneumoperitoneum established via umbilical port to 15 mmHg. " +
                "Three-port technique. Patient tilted left and Trendelenburg to displace bowel. " +
                "Appendix identified and mesoappendix divided with LigaSure / hook diathermy. " +
                "Base of appendix doubly secured with polymer/Vicryl Endoloops and divided. " +
                "Appendix retrieved in Endocatch bag. Peritoneal lavage performed particularly in right iliac fossa and pelvis. " +
                "Ports removed under vision.",
            closure: "Umbilical fascia closed with 0 Vicryl. Skin closed with 4-0 Monocryl subcuticular sutures.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Diet as tolerated same day. Mobilise early. " +
                "Paracetamol 1g QID + Ibuprofen 400mg TDS. " +
                "IV antibiotics intraop; oral continuation if perforated. " +
                "Discharge day 1–2 if uncomplicated.",
            followUpWeeks: "2",
            patientDescription:
                "Keyhole removal of the appendix through three small cuts on the abdomen. " +
                "A camera guides the procedure and the inflamed appendix is removed safely.",
            specificRisks: [
                "Bowel injury",
                "Wound infection",
                "Conversion to open surgery",
                "Stump leak / post-op abscess",
                "Post-op ileus / obstruction"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Medical management (medications)"
            ]
        ),

        ProcedureTemplate(
            name: "Laparoscopic Inguinal Hernia Repair (TEP)",
            category: .laparoscopic,
            shortName: "TEP",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board"],
            skinPrep: "Chlorhexidine/alcohol",
            draping: "Standard laparoscopic draping",
            incision: "12 mm infraumbilical port, two 5 mm midline ports below umbilicus",
            techniqueDescription:
                "Totally extra-peritoneal (TEP) technique. " +
                "Infraumbilical incision to anterior rectus sheath. Balloon dissector inserted and pre-peritoneal space developed. " +
                "Three-port technique in midline. Hernia sac dissected — direct/indirect hernia reduced. " +
                "Myopectineal orifice covered with 15×10 cm lightweight polypropylene mesh fixed with tacks / glue. " +
                "Pneumoperitoneum gradually deflated to allow mesh to unfurl and adhere. " +
                "Peritoneum intact throughout.",
            closure: "Port sites closed with 4-0 Monocryl subcuticular suture.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Mobilise same day. Light lifting restriction 2 weeks, heavy lifting 4–6 weeks. " +
                "Paracetamol + Ibuprofen regular analgesia for 5 days. " +
                "Discharge same day or day 1.",
            followUpWeeks: "4",
            patientDescription:
                "Keyhole repair of inguinal hernia using a synthetic mesh placed through the abdominal wall without entering the peritoneal cavity. " +
                "The mesh reinforces the weakness and prevents the hernia from returning.",
            specificRisks: [
                "Hernia recurrence",
                "Chronic pain at incision site",
                "Mesh-related complications",
                "Nerve damage / paraesthesia",
                "Bladder injury",
                "Vascular injury requiring repair",
                "Conversion to open surgery"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Alternative surgical approach",
                "Open repair (Lichtenstein)"
            ]
        ),

        ProcedureTemplate(
            name: "Laparoscopic Right Hemicolectomy",
            category: .laparoscopic,
            shortName: "Lap RHC",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board", "Leg stirrups"],
            skinPrep: "Chlorhexidine/alcohol",
            draping: "Standard laparoscopic draping",
            incision: "5 mm umbilical camera port, three 5 mm working ports, 4 cm Pfannenstiel/RIF extraction incision",
            techniqueDescription:
                "Five-port laparoscopic technique. Medial-to-lateral dissection of the right mesocolon. " +
                "Ileocolic pedicle identified and divided between clips after lymphadenectomy. " +
                "Right colic vessels divided. Hepatic flexure mobilised. " +
                "Terminal ileum and right/transverse colon divided with linear staplers. " +
                "Specimen extracted via extraction incision. Extra-corporeal ileo-transverse colon side-to-side functional end-to-end anastomosis with linear stapler and closure of enterotomy with PDS suture.",
            closure: "Extraction incision: mass closure with 1 PDS loop. Skin with 4-0 Monocryl subcuticular. Port sites with 4-0 Monocryl.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Enhanced recovery protocol. Clear fluids same evening. Free diet day 1. " +
                "Regular Paracetamol + NSAID. Epidural/PCA analgesia as arranged. " +
                "DVT prophylaxis — LMWH + TED stockings. " +
                "Mobilise day 1. Target discharge day 3–4.",
            followUpWeeks: "4",
            patientDescription:
                "Keyhole removal of the right portion of the large bowel (right hemicolectomy). " +
                "The bowel is rejoined (anastomosis) and the specimen is sent to pathology.",
            specificRisks: [
                "Anastomotic leak",
                "Bowel injury",
                "Post-op ileus / obstruction",
                "Stoma formation (temporary or permanent)",
                "Conversion to open surgery",
                "Urinary retention"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Medical management (medications)",
                "Endoscopic treatment",
                "Interventional radiology",
                "Palliation / symptom management"
            ]
        ),

        ProcedureTemplate(
            name: "Laparoscopic Sigmoid Colectomy",
            category: .laparoscopic,
            shortName: "Lap Sigmoid",
            anaesthesiaType: "General",
            position: "Lloyd-Davies",
            positioning: ["Leg stirrups", "Arm board"],
            skinPrep: "Chlorhexidine/alcohol including perineum",
            draping: "Standard laparoscopic with perineal access",
            incision: "5 mm umbilical port, three 5 mm working ports, 4–5 cm Pfannenstiel extraction incision",
            techniqueDescription:
                "Five-port laparoscopic technique. Patient in Lloyd-Davies position. " +
                "Medial-to-lateral dissection of left mesocolon. Inferior mesenteric artery divided at root after identification of left ureter. " +
                "Sigmoid and proximal rectum mobilised. Left colon divided proximally with linear stapler. " +
                "Rectum divided distally with articulating linear stapler. " +
                "Specimen delivered via extraction incision. Anvil placed in proximal colon and purse-string tied. " +
                "Circular stapler inserted transanally and end-to-end colorectal anastomosis performed. " +
                "Air insufflation test of anastomosis via proctoscope.",
            closure: "Extraction incision mass closure 1 PDS. Skin 4-0 Monocryl. Port sites 4-0 Monocryl.",
            drainUsually: true,
            drainType: "Blake 19Fr drain in pelvis",
            specimenUsually: true,
            postOpOrders:
                "Enhanced recovery. Clear fluids same evening. Diet day 1. " +
                "Paracetamol + NSAID regular. DVT prophylaxis. Mobilise day 1. Target discharge day 3–5.",
            followUpWeeks: "4",
            patientDescription:
                "Keyhole removal of the sigmoid colon with rejoining of the bowel ends (anastomosis). " +
                "The removed bowel is sent to pathology.",
            specificRisks: [
                "Anastomotic leak",
                "Stoma formation (temporary or permanent)",
                "Bowel injury",
                "Urinary retention",
                "Post-op ileus / obstruction",
                "Nerve damage / paraesthesia",
                "Ureteric injury",
                "Conversion to open surgery"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Medical management (medications)",
                "Endoscopic treatment",
                "Palliation / symptom management"
            ]
        ),

        ProcedureTemplate(
            name: "Laparoscopic Nissen Fundoplication",
            category: .laparoscopic,
            shortName: "Lap Nissen",
            anaesthesiaType: "General",
            position: "Reverse Trendelenburg",
            positioning: ["Shoulder roll", "Gel pads"],
            skinPrep: "Chlorhexidine/alcohol",
            draping: "Standard laparoscopic draping",
            incision: "10 mm umbilical camera port, 5 mm left subcostal port, 5 mm epigastric port, 5 mm right working port, 5 mm liver retractor port",
            techniqueDescription:
                "Five-port laparoscopic technique. Liver retracted with Nathanson or fan retractor. " +
                "Phrenoesophageal ligament incised. Oesophagus fully mobilised in mediastinum to achieve ≥3 cm intra-abdominal length without tension. " +
                "Both vagal trunks identified and preserved. Hernia sac excised. " +
                "Posterior crural repair with interrupted 2-0 ethibond sutures, crura approximated posterior to oesophagus. " +
                "Short gastric vessels divided. 360° Nissen wrap constructed over 56Fr bougie with three 2-0 ethibond sutures. " +
                "Bougie removed. Wrap checked to be floppy and 2 cm in length.",
            closure: "Port sites closed with 4-0 Monocryl subcuticular sutures.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Soft/puree diet for 6 weeks — avoid bread, steak, chunky foods. " +
                "Head of bed elevated. Avoid carbonated drinks for 6 weeks. " +
                "Paracetamol + Ibuprofen analgesia. Discharge day 1–2.",
            followUpWeeks: "6",
            patientDescription:
                "Keyhole operation to wrap the top of the stomach around the lower oesophagus to prevent reflux. " +
                "Any hiatus hernia is also repaired at the same time.",
            specificRisks: [
                "Dysphagia (difficulty swallowing) — usually temporary",
                "Wrap failure / recurrence of reflux",
                "Gas bloat syndrome",
                "Oesophageal perforation",
                "Conversion to open surgery",
                "Vagal nerve injury"
            ],
            alternatives: [
                "Medical management (medications)",
                "Lifestyle modification",
                "Alternative surgical approach",
                "Endoscopic treatment"
            ]
        ),

    ]

}
