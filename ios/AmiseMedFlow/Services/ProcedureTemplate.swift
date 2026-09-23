import SwiftUI

// MARK: - Procedure Template Library
//
// Each template pre-populates both SurgeryNoteData and ConsentFormData so the
// surgeon only fills in patient-specific findings and intraoperative detail.
// Indication and intraoperative findings fields are always left blank.

struct ProcedureTemplate: Identifiable {
    let id = UUID()
    let name: String
    let category: Category
    let shortName: String

    // Surgery note fields
    let anaesthesiaType: String
    let position: String
    let positioning: [String]
    let skinPrep: String
    let draping: String
    let incision: String
    let techniqueDescription: String    // fills procedureDescription
    let closure: String
    let drainUsually: Bool
    let drainType: String
    let specimenUsually: Bool
    let postOpOrders: String
    let followUpWeeks: String

    // Consent form fields
    let patientDescription: String      // plain-language for patient
    let specificRisks: [String]
    let alternatives: [String]

    enum Category: String, CaseIterable {
        case laparoscopic = "Laparoscopic"
        case open_        = "Open / Excision"
        case breast       = "Breast & Endocrine"
        case endoscopy    = "Endoscopy"
        case emergency    = "Emergency"
    }

    // Apply this template to a SurgeryNoteData, preserving any already-entered
    // patient-specific content (indication, findings, team, dates, timing).
    func applySurgeryFields(to data: inout SurgeryNoteData) {
        data.procedureName   = name
        data.anaesthesiaType = anaesthesiaType
        data.position        = position
        data.positioning     = positioning
        data.skinPrep        = skinPrep
        data.draping         = draping
        data.incision        = incision
        data.procedureDescription = techniqueDescription
        data.closure         = closure
        data.drainInserted   = drainUsually
        data.drainType       = drainUsually ? drainType : ""
        data.specimensSent   = specimenUsually
        if data.postOpOrders.isEmpty { data.postOpOrders = postOpOrders }
        data.followUpWeeks   = followUpWeeks
    }

    // Apply this template to a ConsentFormData, preserving surgeon name, date,
    // patient name, and any custom notes already entered.
    func applyConsentFields(to data: inout ConsentFormData) {
        data.procedureName        = name
        data.procedureDescription = patientDescription
        data.anaesthesiaType      = "\(anaesthesiaType) anaesthesia"
        data.specificRisks        = specificRisks
        data.alternativesTreated  = alternatives
    }
}

// MARK: - Template Library

extension ProcedureTemplate {

    static let all: [ProcedureTemplate] = [

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

        // ── OPEN / EXCISION ─────────────────────────────────────────────────

        ProcedureTemplate(
            name: "Open Inguinal Hernia Repair (Lichtenstein)",
            category: .open_,
            shortName: "Lichtenstein",
            anaesthesiaType: "Local",
            position: "Supine",
            positioning: [],
            skinPrep: "Chlorhexidine/alcohol",
            draping: "Standard draping, inguinal field",
            incision: "Oblique 5–7 cm groin incision overlying the inguinal canal",
            techniqueDescription:
                "Skin and subcutaneous tissue divided. External oblique aponeurosis opened in the direction of its fibres, exposing the inguinal canal. " +
                "Ilioinguinal nerve identified and protected. Hernia sac identified, dissected, and ligated at the neck (indirect) / reduced (direct). " +
                "Tension-free Lichtenstein repair: 15×7.5 cm polypropylene mesh sutured to the inguinal ligament with continuous 2-0 Prolene and to the conjoined tendon with interrupted sutures. " +
                "Keyhole created around the spermatic cord / round ligament. External oblique re-approximated with 2-0 Vicryl.",
            closure: "Scarpa's fascia 2-0 Vicryl. Skin with 3-0 Monocryl subcuticular suture.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "Mobilise same day. Light activities 1 week; no heavy lifting 4 weeks. " +
                "Paracetamol + Ibuprofen regular for 5 days. Discharge same day.",
            followUpWeeks: "4",
            patientDescription:
                "Open repair of inguinal hernia using a synthetic mesh to strengthen the abdominal wall through a small groin incision.",
            specificRisks: [
                "Hernia recurrence",
                "Chronic pain at incision site",
                "Mesh-related complications",
                "Nerve damage / paraesthesia",
                "Haematoma / seroma",
                "Wound infection"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Laparoscopic repair (TEP/TAPP)"
            ]
        ),

        ProcedureTemplate(
            name: "Excision of Pilonidal Sinus",
            category: .open_,
            shortName: "Pilonidal",
            anaesthesiaType: "General",
            position: "Prone",
            positioning: ["Prone frame", "Gel pads"],
            skinPrep: "Povidone-iodine",
            draping: "Standard prone draping",
            incision: "Elliptical excision of pilonidal sinus tract including all pits",
            techniqueDescription:
                "Patient prone. Buttocks taped laterally. Methylene blue injected into sinus to delineate tracts. " +
                "Elliptical incision around all pits and sinuses down to pre-sacral fascia. " +
                "All sinus tracts excised en bloc. Wound either: (1) left open and packed / (2) closed primarily over drain / (3) Karydakis/Bascom/cleft lift repair as indicated. " +
                "Specimen sent for histology.",
            closure: "Primary closure: deep 2-0 PDS mattress sutures. Skin 3-0 Nylon interrupted vertical mattress. Or: wound packed open.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Daily wound dressings. Depilatory cream or laser hair removal post-healing recommended. " +
                "Avoid sitting on wound directly for 2 weeks. Regular Paracetamol + NSAID. " +
                "Discharge same day or day 1. Suture removal 14 days.",
            followUpWeeks: "2",
            patientDescription:
                "Surgical removal of the pilonidal sinus and all associated tracts under general anaesthetic, through an incision over the lower back/buttock cleft.",
            specificRisks: [
                "Recurrence",
                "Wound dehiscence",
                "Wound infection",
                "Seroma / haematoma",
                "Chronic wound / delayed healing"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Incision and drainage of acute abscess only",
                "Minimally invasive techniques (pit picking / VAAPS)"
            ]
        ),

        ProcedureTemplate(
            name: "Haemorrhoidectomy (Milligan-Morgan)",
            category: .open_,
            shortName: "Haemorrhoidectomy",
            anaesthesiaType: "General",
            position: "Lithotomy",
            positioning: ["Leg stirrups"],
            skinPrep: "Povidone-iodine including perianal region",
            draping: "Standard lithotomy draping",
            incision: "Three radial excisions at 3, 7, and 11 o'clock positions",
            techniqueDescription:
                "Patient in lithotomy position. Proctoscopy performed, haemorrhoidal complexes confirmed. " +
                "Three primary haemorrhoidal complexes identified at 3, 7, and 11 o'clock. " +
                "V-shaped external excision. Haemorrhoidal pedicle transfixed and ligated with 2-0 Vicryl. " +
                "Mucocutaneous bridges preserved between each excision. " +
                "Wounds left open. Local anaesthesia (Marcain 0.5%) injected for post-op analgesia. Anal pack inserted.",
            closure: "Wounds left open — Vaseline gauze dressing.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "High-fibre diet + Lactulose + Fybogel for 6 weeks. " +
                "Sitz baths TDS. Paracetamol + Ibuprofen regular. " +
                "Suppositories (Ultraproct/Scheriproct) for 2 weeks. Oral metronidazole 5 days. " +
                "Warn: first bowel motion painful. Discharge same day.",
            followUpWeeks: "6",
            patientDescription:
                "Surgical removal of the main haemorrhoidal complexes through the back passage under general anaesthetic. " +
                "Three excisions are made and the wounds are left to heal naturally.",
            specificRisks: [
                "Post-op pain (significant, expected)",
                "Urinary retention",
                "Bleeding — immediate or delayed (7–14 days)",
                "Anal stenosis",
                "Recurrence",
                "Faecal incontinence (rare)",
                "Anal fistula"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Medical management (medications)",
                "Rubber band ligation",
                "Sclerotherapy",
                "Stapled haemorrhoidopexy (PPH)"
            ]
        ),

        ProcedureTemplate(
            name: "Lateral Internal Sphincterotomy",
            category: .open_,
            shortName: "LIS",
            anaesthesiaType: "Local",
            position: "Lithotomy",
            positioning: ["Leg stirrups"],
            skinPrep: "Povidone-iodine",
            draping: "Standard lithotomy draping",
            incision: "Small lateral perianal incision at 3 o'clock position",
            techniqueDescription:
                "Patient in lithotomy. Fissure confirmed at midline posterior position. " +
                "Small lateral incision at 3 o'clock position in intersphincteric groove. " +
                "Internal sphincter identified and divided up to the dentate line under direct vision (open technique). " +
                "Haemostasis secured. Fissure base curetted if chronic.",
            closure: "Skin closed with 4-0 Vicryl.",
            drainUsually: false,
            drainType: "",
            specimenUsually: false,
            postOpOrders:
                "High-fibre diet + stool softeners. Sitz baths. " +
                "Paracetamol + Ibuprofen. Discharge same day.",
            followUpWeeks: "6",
            patientDescription:
                "A small cut in the internal anal sphincter muscle to reduce pressure and allow a chronic anal fissure to heal.",
            specificRisks: [
                "Faecal incontinence — urgency or gas (5–10%)",
                "Haematoma",
                "Fissure recurrence",
                "Anal fistula"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Medical management (medications)",
                "Botulinum toxin injection"
            ]
        ),

        ProcedureTemplate(
            name: "Incision & Drainage of Abscess",
            category: .open_,
            shortName: "I&D Abscess",
            anaesthesiaType: "Local",
            position: "Supine",
            positioning: [],
            skinPrep: "Povidone-iodine / Chlorhexidine",
            draping: "Standard sterile field",
            incision: "Linear or cruciate incision over point of maximum fluctuance",
            techniqueDescription:
                "Abscess confirmed on examination. Area infiltrated with local anaesthetic. " +
                "Incision made over point of fluctuance. Pus evacuated and cavity explored with finger / probe. " +
                "Loculations broken down. Thorough irrigation with saline. " +
                "Wound debrided. Wound packed with Kaltostat / ribbon gauze.",
            closure: "Wound left open and packed — not primarily closed.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Daily wound packing changes. Oral antibiotics if cellulitis present. " +
                "Paracetamol + Ibuprofen. Review in 5–7 days.",
            followUpWeeks: "1",
            patientDescription:
                "A small operation to open and drain an abscess. A cut is made over the swelling, the pus is released, and the wound is cleaned and packed to allow healing from the inside.",
            specificRisks: [
                "Wound infection",
                "Recurrence",
                "Scar / keloid formation",
                "Fistula formation (perianal abscess)",
                "Haematoma"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Medical management (medications)"
            ]
        ),

        ProcedureTemplate(
            name: "Wide Local Excision of Skin Lesion",
            category: .open_,
            shortName: "WLE Skin",
            anaesthesiaType: "Local",
            position: "Supine",
            positioning: [],
            skinPrep: "Chlorhexidine/alcohol",
            draping: "Standard sterile field",
            incision: "Elliptical excision with 1–2 cm margins (melanoma) or adequate margins per lesion type",
            techniqueDescription:
                "Lesion marked with pen. Margins marked appropriately for lesion type. " +
                "Local anaesthetic infiltrated. Elliptical excision performed down to deep fascia / subcutaneous fat. " +
                "Specimen oriented with sutures (long = lateral, short = superior). " +
                "Wound undermined to achieve primary closure. Haemostasis achieved.",
            closure: "Deep dermal 3-0 Vicryl. Skin 4-0 Nylon interrupted / 4-0 Monocryl subcuticular. Wound dressed with Mepore.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Keep wound dry 48 hours. Paracetamol PRN. " +
                "Suture removal 7–14 days depending on site. " +
                "Await histology — review once results available.",
            followUpWeeks: "2",
            patientDescription:
                "Surgical removal of a skin lesion with a margin of healthy tissue. The removed tissue is sent to a specialist to examine under a microscope.",
            specificRisks: [
                "Wound infection",
                "Scar / keloid formation",
                "Positive margins requiring further excision",
                "Haematoma / seroma",
                "Lymphoedema (if lymph nodes removed)"
            ],
            alternatives: [
                "Conservative management / watchful waiting",
                "Referral to another specialist",
                "Dermatology review"
            ]
        ),

        ProcedureTemplate(
            name: "Hartmann's Procedure",
            category: .open_,
            shortName: "Hartmann's",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board"],
            skinPrep: "Chlorhexidine/alcohol extending to perineum",
            draping: "Standard laparotomy draping",
            incision: "Midline laparotomy from umbilicus to pubis (extended if needed)",
            techniqueDescription:
                "Midline laparotomy. Systematic abdominal exploration. " +
                "Sigmoid colon identified. Inferior mesenteric artery divided at origin after identification of both ureters. " +
                "Sigmoid mobilised. Colon divided proximally with linear stapler. " +
                "Rectum divided at recto-sigmoid junction with linear stapler. " +
                "Specimen removed. End colostomy fashioned in left iliac fossa using the proximal sigmoid stump — matured with 3-0 Vicryl sutures. " +
                "Presacral space irrigated. Rectal stump closed.",
            closure: "Mass closure with 1 loop PDS. Skin with 3-0 Nylon interrupted sutures or skin staples.",
            drainUsually: true,
            drainType: "Blake 19Fr drain in pelvis",
            specimenUsually: true,
            postOpOrders:
                "NGT post-op until tolerating fluids. DVT prophylaxis. " +
                "Stoma nurse review day 1. Enhanced recovery. Target discharge day 5–7. " +
                "Reversal planned 3–6 months if fit and oncological clearance achieved.",
            followUpWeeks: "4",
            patientDescription:
                "Emergency removal of the sigmoid colon through an open abdominal incision, creating a temporary colostomy (bag on the abdomen). " +
                "The operation is performed when primary bowel rejoining is not safe.",
            specificRisks: [
                "Anastomotic leak (not applicable — no anastomosis)",
                "Stoma formation (temporary or permanent)",
                "Bowel injury",
                "Ureteric injury",
                "Post-op ileus / obstruction",
                "Urinary retention",
                "Wound dehiscence"
            ],
            alternatives: [
                "Primary anastomosis (if appropriate)",
                "Palliation / symptom management"
            ]
        ),

        // ── BREAST & ENDOCRINE ───────────────────────────────────────────────

        ProcedureTemplate(
            name: "Total Thyroidectomy",
            category: .breast,
            shortName: "Total Thyroidectomy",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Shoulder roll", "Gel pads"],
            skinPrep: "Chlorhexidine/alcohol — neck to sternal notch",
            draping: "Head ring, neck exposed",
            incision: "Kocher incision — 4–6 cm transverse low cervical crease incision",
            techniqueDescription:
                "Patient supine with neck extended using shoulder roll. " +
                "Kocher incision deepened through platysma. Subplatysmal flaps raised. " +
                "Strap muscles separated in midline and retracted laterally. " +
                "Thyroid lobe elevated and rotated medially. " +
                "Recurrent laryngeal nerve identified and traced from thoracic inlet to laryngeal entry — bilateral. " +
                "Superior and inferior parathyroid glands identified and preserved with their vascular pedicles. " +
                "Berry's ligament divided and thyroid removed. " +
                "Haemostasis secured. Parathyroid viability confirmed — autotransplantation if compromised.",
            closure: "Strap muscles approximated 2-0 Vicryl. Platysma 3-0 Vicryl. Subcuticular 4-0 Monocryl. Steri-Strips.",
            drainUsually: true,
            drainType: "Suction drain size 10 — removed when <20 mL/24h",
            specimenUsually: true,
            postOpOrders:
                "Calcium monitoring 6h and 24h post-op. " +
                "Calcium + Vitamin D supplementation (CalciChew D3) from day 1. " +
                "Levothyroxine commenced day 1 post-op as per endocrine protocol. " +
                "Vocal cord check if concerns. Discharge day 2–3.",
            followUpWeeks: "2",
            patientDescription:
                "Surgical removal of the entire thyroid gland through a small incision in the lower neck. " +
                "The recurrent laryngeal nerves and parathyroid glands are identified and preserved.",
            specificRisks: [
                "Recurrent laryngeal nerve injury — hoarseness (temporary or permanent)",
                "Hypoparathyroidism — low calcium requiring supplementation",
                "Haematoma (airway-threatening)",
                "Wound infection",
                "Hypothyroidism (expected — treated with thyroxine)"
            ],
            alternatives: [
                "Hemithyroidectomy (lobectomy)",
                "Medical management (medications)",
                "Radioiodine ablation",
                "Conservative management / watchful waiting"
            ]
        ),

        ProcedureTemplate(
            name: "Hemithyroidectomy (Lobectomy)",
            category: .breast,
            shortName: "Hemithyroidectomy",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Shoulder roll", "Gel pads"],
            skinPrep: "Chlorhexidine/alcohol — neck to sternal notch",
            draping: "Head ring, neck exposed",
            incision: "Kocher incision — 4–5 cm transverse low cervical crease",
            techniqueDescription:
                "Kocher incision deepened through platysma. Subplatysmal flaps raised. " +
                "Strap muscles separated. Affected lobe identified. " +
                "Recurrent laryngeal nerve traced and protected throughout. " +
                "Ipsilateral parathyroid glands identified and preserved. " +
                "Isthmus divided. Lobe removed. " +
                "Haemostasis secured. Contralateral lobe and parathyroids confirmed intact.",
            closure: "Strap muscles approximated 2-0 Vicryl. Platysma 3-0 Vicryl. Subcuticular 4-0 Monocryl.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Calcium monitoring 6h post-op. Vocal cord check if indicated. " +
                "Paracetamol + Ibuprofen. Discharge day 1–2. " +
                "Thyroid function tests at 6 weeks post-op.",
            followUpWeeks: "2",
            patientDescription:
                "Removal of one lobe of the thyroid gland (one half of the thyroid) through a small incision in the lower neck.",
            specificRisks: [
                "Recurrent laryngeal nerve injury — hoarseness",
                "Hypoparathyroidism (transient)",
                "Haematoma",
                "Hypothyroidism — may require thyroxine",
                "Wound infection"
            ],
            alternatives: [
                "Total thyroidectomy",
                "Conservative management / watchful waiting",
                "Radioiodine ablation"
            ]
        ),

        ProcedureTemplate(
            name: "Wide Local Excision + Sentinel Lymph Node Biopsy",
            category: .breast,
            shortName: "WLE + SLNB",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board"],
            skinPrep: "Chlorhexidine/alcohol — entire breast and axilla",
            draping: "Arm draped into field for axillary access",
            incision: "Curvilinear incision over lesion / wire/RADS localisation site; separate axillary incision for SLNB",
            techniqueDescription:
                "Radioisotope (Tc-99m nanocolloid) injected peri-tumourally previous day. " +
                "Isosulfan blue / Methylene blue dye injected peri-areolar at start of case. " +
                "WLE: Wire/RADS/USS-guided localisation. Excision with ≥1 mm macroscopic margin, specimen oriented (long lateral, short superior, deep suture). Specimen X-ray confirming excision. " +
                "SLNB: Axillary incision. Gamma probe used to identify hot/blue node(s). All hot and blue nodes removed. Node counts documented.",
            closure: "Breast: deep tissues 2-0 Vicryl. Skin 3-0 Monocryl subcuticular. Axilla: 3-0 Monocryl.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Arm exercises from day 1. Paracetamol + Ibuprofen. " +
                "Await pathology — multidisciplinary team meeting. Discharge same day or day 1. " +
                "Results appointment in 2 weeks.",
            followUpWeeks: "2",
            patientDescription:
                "Removal of the breast lump/cancer with a margin of healthy tissue (wide local excision) and removal of the first lymph node draining the breast (sentinel node biopsy) to check if cancer has spread.",
            specificRisks: [
                "Positive margins requiring further excision",
                "Seroma / haematoma",
                "Lymphoedema",
                "Altered sensation / numbness",
                "Cosmetic asymmetry",
                "Wound infection"
            ],
            alternatives: [
                "Mastectomy",
                "Axillary node clearance (if SLNB positive)",
                "Neoadjuvant chemotherapy first"
            ]
        ),

        ProcedureTemplate(
            name: "Simple Mastectomy",
            category: .breast,
            shortName: "Mastectomy",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board"],
            skinPrep: "Chlorhexidine/alcohol — chest and axilla",
            draping: "Standard, arm accessible",
            incision: "Transverse / oblique elliptical incision encompassing nipple-areolar complex",
            techniqueDescription:
                "Elliptical incision including nipple-areolar complex (unless nipple-sparing). " +
                "Skin flaps raised with electrocautery at subcutaneous/breast interface, preserving ≥5 mm dermal thickness. " +
                "Breast tissue dissected off pectoralis major fascia (with fascia if indicated). " +
                "Axillary tail dissected. Specimen removed. " +
                "If immediate reconstruction: oncoplastic/implant/LD flap as per pre-op plan. " +
                "Haemostasis secured.",
            closure: "Deep 2-0 Vicryl. Skin 3-0 Monocryl subcuticular.",
            drainUsually: true,
            drainType: "Two suction drains — axilla and anterior chest wall",
            specimenUsually: true,
            postOpOrders:
                "Drain management: remove when <30 mL/24h. " +
                "Arm exercises day 1. Paracetamol + regular NSAID. " +
                "Breast care nurse referral. Prosthesis fitting at 6 weeks. " +
                "MDT meeting for adjuvant therapy planning. Discharge day 2–3.",
            followUpWeeks: "2",
            patientDescription:
                "Surgical removal of the entire breast including the nipple through a single incision. " +
                "Reconstruction can be discussed separately.",
            specificRisks: [
                "Seroma (very common, may need aspiration)",
                "Wound infection",
                "Skin flap necrosis",
                "Lymphoedema (if axillary surgery also performed)",
                "Altered sensation over chest wall",
                "Psychological impact / body image"
            ],
            alternatives: [
                "Wide local excision + radiotherapy",
                "Neoadjuvant chemotherapy first"
            ]
        ),

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

    // MARK: - Search / filter helpers

    static func search(_ query: String) -> [ProcedureTemplate] {
        guard query.count >= 2 else { return all }
        let q = query.lowercased()
        return all.filter {
            $0.name.lowercased().contains(q) ||
            $0.shortName.lowercased().contains(q) ||
            $0.category.rawValue.lowercased().contains(q)
        }
    }

    static var byCategory: [(Category, [ProcedureTemplate])] {
        Category.allCases.compactMap { cat in
            let items = all.filter { $0.category == cat }
            return items.isEmpty ? nil : (cat, items)
        }
    }
}
