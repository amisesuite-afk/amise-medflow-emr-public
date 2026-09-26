// ProcedureTemplate+Bronchoscopy.swift
// Bronchoscopy procedures.

import Foundation

extension ProcedureTemplate {

    static let _bronchoscopy: [ProcedureTemplate] = [
        // ── BRONCHOSCOPY ────────────────────────────────────────────────────

        ProcedureTemplate(
            name: "Flexible Bronchoscopy (Diagnostic)",
            category: .endoscopy,
            shortName: "Bronchoscopy",
            anaesthesiaType: "MAC / Propofol sedation",
            position: "Supine / semi-recumbent",
            positioning: [],
            skinPrep: "Not applicable",
            draping: "Endoscopy drape",
            incision: "Not applicable — trans-nasal or trans-oral bronchoscopy",
            techniqueDescription:
                "Patient in supine/semi-recumbent position with supplemental oxygen via nasal prongs and continuous SpO₂ monitoring. " +
                "IV access established. Topical anaesthesia applied: lidocaine spray to oropharynx, and 2% lidocaine instilled via bronchoscope to vocal cords and carina. " +
                "Olympus BF-1TH190 flexible bronchoscope introduced trans-nasally / trans-orally. " +
                "Systematic inspection performed: nasopharynx, larynx, vocal cords (mobility confirmed bilaterally), subglottis, trachea, carina (sharp, midline). " +
                "Right main bronchus: upper lobe (RB1, RB2, RB3), middle lobe (RB4, RB5), lower lobe (RB6–RB10) inspected. " +
                "Left main bronchus: upper lobe (LB1–LB3, lingula LB4–LB5), lower lobe (LB6–LB10) inspected. " +
                "Bronchoalveolar lavage (BAL) and/or endobronchial biopsies performed as indicated. " +
                "All specimens labelled and sent for cytology, microbiology, and/or histology as appropriate. " +
                "Bronchoscope withdrawn under vision. Procedure well tolerated.",
            closure: "Not applicable.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Nil by mouth 1 hour post-procedure (topical anaesthesia). " +
                "Supplemental oxygen for 30 minutes post-procedure. Monitor SpO₂. " +
                "Await BAL and biopsy results — review in clinic once available. " +
                "Discharge 1 hour after sedation recovery.",
            followUpWeeks: "2",
            patientDescription:
                "A flexible camera (bronchoscope) passed through the nose or mouth and into the airway to examine the lungs and airways. " +
                "Samples (washings or biopsies) may be taken for laboratory testing.",
            specificRisks: [
                "Transient oxygen desaturation",
                "Bronchospasm",
                "Haemorrhage after biopsy (1–2%)",
                "Pneumothorax (after transbronchial biopsy, ~5%)",
                "Reaction to sedation / local anaesthetic",
                "Failure to reach target lesion",
                "Infection"
            ],
            alternatives: [
                "CT-guided percutaneous biopsy",
                "Surgical resection / VATS biopsy",
                "Sputum cytology",
                "Observation and repeat imaging"
            ]
        ),

        ProcedureTemplate(
            name: "Flexible Bronchoscopy + EBUS-TBNA",
            category: .endoscopy,
            shortName: "Bronch + EBUS",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: [],
            skinPrep: "Not applicable",
            draping: "Endoscopy drape",
            incision: "Not applicable — trans-oral bronchoscopy",
            techniqueDescription:
                "Patient under general anaesthesia with LMA / ETT airway. " +
                "Endobronchial ultrasound (EBUS) bronchoscope (Olympus BF-UC190F) introduced trans-orally. " +
                "Standard white-light survey bronchoscopy performed to assess endobronchial anatomy and mucosa. " +
                "EBUS mode engaged: real-time ultrasound used to identify mediastinal and hilar lymph nodes. " +
                "TBNA (transbronchial needle aspiration): 22G needle passed through working channel under real-time ultrasound guidance. " +
                "Target lymph node stations sampled (e.g. 4R, 4L, 7, 10R, 10L, 11R, 11L) — 3 passes per station. " +
                "Rapid on-site evaluation (ROSE) performed if cytopathologist present. " +
                "All samples in CytoLyt / formalin as instructed by pathology. Bronchoscope withdrawn.",
            closure: "Not applicable.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Recovery room: monitor SpO₂ and haemoptysis. " +
                "Await EBUS-TBNA cytology / histology — results guide staging and management. " +
                "Chest X-ray post-procedure to exclude pneumomediastinum. " +
                "Discharge same day if uncomplicated.",
            followUpWeeks: "2",
            patientDescription:
                "A flexible camera with an ultrasound probe is passed through the mouth into the airway to biopsy lymph nodes around the lungs. " +
                "This is used for staging lung cancer or diagnosing other conditions affecting lymph nodes.",
            specificRisks: [
                "Bleeding",
                "Infection / mediastinitis (rare)",
                "Bronchospasm",
                "Pneumomediastinum",
                "Reaction to general anaesthetic",
                "Incomplete sampling requiring repeat procedure"
            ],
            alternatives: [
                "Mediastinoscopy",
                "CT-guided biopsy",
                "PET-CT for staging (non-invasive)",
                "Surgical biopsy / VATS"
            ]
        ),

    ]

}
