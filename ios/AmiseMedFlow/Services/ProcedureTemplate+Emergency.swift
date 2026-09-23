// ProcedureTemplate+Emergency.swift
// Emergency surgical procedures.

import Foundation

extension ProcedureTemplate {

    static let _emergency: [ProcedureTemplate] = [
        // ── EMERGENCY ───────────────────────────────────────────────────────

        ProcedureTemplate(
            name: "Emergency Exploratory Laparotomy",
            category: .emergency,
            shortName: "Emergency Lap",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board"],
            skinPrep: "Povidone-iodine — rapid prep xiphisternum to groin",
            draping: "Standard laparotomy, full abdomen exposed",
            incision: "Midline laparotomy — xiphisternum to pubis",
            techniqueDescription:
                "Rapid sequence induction. " +
                "Skin to linea alba incised. Peritoneum entered. Systematic four-quadrant abdominal exploration. " +
                "Source of pathology identified. Appropriate surgical intervention performed as per intraoperative findings (e.g. bowel resection, repair of perforation, control of haemorrhage, adhesiolysis). " +
                "Peritoneal lavage with warm saline. " +
                "Drains inserted as indicated. Abdominal closure as appropriate (primary / damage control).",
            closure: "Mass closure 1 loop PDS en masse if physiologically stable. Skin staples or Nylon interrupted sutures. Damage control: temporary closure with Bogota bag / negative pressure wound dressing if indicated.",
            drainUsually: true,
            drainType: "Abdominal drains as per findings",
            specimenUsually: true,
            postOpOrders:
                "ICU/HDU post-op. NGT in situ. DVT prophylaxis. " +
                "IV antibiotics per microbiology. " +
                "Analgesia via epidural / PCA. Drain management per output.",
            followUpWeeks: "4",
            patientDescription:
                "An emergency open operation on the abdomen to identify and treat the cause of acute surgical illness (e.g. perforated bowel, bleeding).",
            specificRisks: [
                "Anastomotic leak",
                "Bowel injury",
                "Wound infection / dehiscence",
                "Stoma formation (temporary or permanent)",
                "Post-op ileus / obstruction",
                "Intra-abdominal abscess",
                "Damage to adjacent structures"
            ],
            alternatives: [
                "Interventional radiology",
                "Non-operative management (if appropriate)"
            ]
        )
    ]

}
