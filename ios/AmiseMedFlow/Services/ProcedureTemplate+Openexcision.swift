// ProcedureTemplate+Openexcision.swift
// Open and excision procedures.

import Foundation

extension ProcedureTemplate {

    static let _openExcision: [ProcedureTemplate] = [
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

    ]

}
