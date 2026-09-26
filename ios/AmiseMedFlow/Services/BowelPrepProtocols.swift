// BowelPrepProtocols.swift
// Bowel preparation protocols for colonoscopy and flexible sigmoidoscopy: regimen data,
// the split-dose timing engine, safety suggestions and the surgeon's sign-off of each
// protocol's wording.
//
// Pure data plus logic. Nothing here reads SwiftData, the network or the clock (callers pass
// dates and time zones in), so every function is unit-testable (BowelPrepTests.swift).
//
// Human authority: the regimen is always the clinician's explicit choice. The safety checks
// only return labelled suggestions with their reasons; they never block or change a choice.
// Doses follow the product labelling (SmPC / US label) and ESGE 2019. Anything not confirmed
// from the labelling carries a "[confirm]" placeholder, and a regimen whose patient-facing
// wording still contains one cannot be signed off.
//
// Surgeon's decision (Dr Kabiye): clear fluids are allowed until 2 hours before the procedure
// (the preparation needs fluid). Nobody is nil by mouth from midnight.

import Foundation

// MARK: - Procedure

enum BowelPrepProcedure: String, Codable, CaseIterable, Identifiable {
    case colonoscopy
    case flexibleSigmoidoscopy

    var id: String { rawValue }

    var title: String {
        switch self {
        case .colonoscopy:           return "Colonoscopy"
        case .flexibleSigmoidoscopy: return "Flexible sigmoidoscopy"
        }
    }

    /// Lower-case form for patient-facing sentences ("your colonoscopy").
    var patientName: String { title.lowercased() }

    /// The bowel-prep procedure for a record, or nil when it is not a lower-GI endoscopy.
    /// Flexible sigmoidoscopy is booked as an appointment type (there is no VisitType for it).
    static func detect(visitType: VisitType?, appointmentType: String?) -> BowelPrepProcedure? {
        let t = (appointmentType ?? "").lowercased()
        if t.contains("sigmoidoscop") && !t.contains("colonoscop") { return .flexibleSigmoidoscopy }
        if visitType == .colonoscopy || t.contains("colonoscop") { return .colonoscopy }
        return nil
    }
}

// MARK: - Regimen data

enum BowelPrepRegimenID: String, Codable, CaseIterable, Identifiable {
    case picosulfateMagnesium = "picosulfate_magnesium"
    case magnesiumCitrate     = "magnesium_citrate"
    case pegAscorbate2L       = "peg_ascorbate_2l"
    case pegAscorbate1L       = "peg_ascorbate_1l"
    case peg4L                = "peg_4l_split"
    case enemaOnly            = "enema_only"

    var id: String { rawValue }
}

enum BowelPrepCategory: String {
    case magnesiumBased, peg, enema
}

struct BowelPrepDose: Equatable {
    /// "Sachet 1", "Litre 1", "Dose 2", "Enema".
    let label: String
    /// Volume in a few words, for the clinician's summary.
    let volumeText: String
    /// Patient-facing instruction for this dose.
    let instruction: String
    /// Time the patient needs to take the dose itself.
    let intakeMinutes: Int
    /// Patient-facing clear-fluid instruction after the dose ("" when none).
    let followOnFluids: String
    /// Time over which those follow-on fluids are drunk.
    let followOnMinutes: Int
}

struct BowelPrepRegimen: Identifiable, Equatable {
    let id: BowelPrepRegimenID
    let displayName: String
    let shortName: String
    let category: BowelPrepCategory
    let productExamples: [String]
    /// Clinician-facing composition.
    let composition: String
    let doses: [BowelPrepDose]
    /// Patient-facing: extra clear fluids the regimen needs.
    let additionalClearFluids: String
    /// Clinician-facing: labelling and guideline source, contraindications.
    let sourceNote: String
    /// Clinician-facing note (items to confirm, product differences).
    let clinicianNote: String
    let procedures: [BowelPrepProcedure]
    /// The labelling allows both doses on the day of the procedure (afternoon lists).
    let sameDayAllowed: Bool
    /// Same-day mode: start of dose 1 to start of dose 2.
    let sameDayIntervalMinutes: Int
    /// The clear fluids after the last dose continue up to the 2-hour stop time.
    let lastDoseFluidsUntilCutoff: Bool
    /// Enema only: minutes before the appointment the enema is given.
    let enemaLeadMinutes: Int
    /// Every regimen's dose wording needs the surgeon's review before patients are given it.
    let requiresSurgeonReview: Bool
}

enum BowelPrepText {
    static let confirm = "[confirm]"

    static let lowResidue =
        "Eat low-fibre (low-residue) food only, for example white bread, white rice, white pasta, " +
        "potatoes without skin, eggs, plain chicken or fish, and plain biscuits. Please avoid fruit, " +
        "vegetables, salad, beans, peas, seeds, nuts, wholemeal or brown bread and high-fibre cereals."

    static let clearFluids =
        "Clear fluids are drinks you can see through: water, clear apple or white grape juice, clear " +
        "broth or bouillon, black tea or coffee (no milk), clear sports drinks and clear jelly. Please " +
        "avoid milk, red or purple drinks, and alcohol."

    static let medicines =
        "Your doctor will advise you about your regular medicines, including any diabetes medicines, " +
        "blood thinners and iron tablets, before you start the preparation. If you have not received " +
        "this advice, please contact the practice before you begin."

    static let whatToExpect =
        "The preparation causes frequent, watery bowel motions, usually starting within a few hours. " +
        "Please stay close to a toilet. By the end, the motions should be a clear or pale yellow liquid. " +
        "A barrier cream can help if your bottom becomes sore."

    static let enemaExpect =
        "The enema usually works within a few minutes. Please stay close to a toilet until your bowel has emptied."

    static let seekHelp =
        "Please contact the practice if you are unable to finish the preparation, keep vomiting, or feel " +
        "dizzy or faint. For severe abdominal pain, collapse or any emergency, call 911 or go to the " +
        "nearest Emergency Department."

    static let afterProcedure =
        "If you receive sedation, a responsible adult must take you home, and you should not drive for 24 hours."

    static let stopIntake =
        "Nothing more to eat or drink from this time. Please follow any advice your doctor has given you " +
        "about your regular medicines."

    static let enemaDayDiet =
        "No special diet is needed the day before. On the morning of your procedure, have a light " +
        "breakfast only (for example toast and tea)."

    static let draftNotice =
        "DRAFT — this protocol wording is awaiting the surgeon's sign-off. Please do not give it to a " +
        "patient until it has been approved."

    /// All shared patient-facing text; part of every regimen's sign-off fingerprint.
    static var sharedPatientText: [String] {
        [lowResidue, clearFluids, medicines, whatToExpect, enemaExpect, seekHelp, afterProcedure, stopIntake]
    }
}

private let esge2019 =
    "ESGE 2019 bowel preparation guideline (Hassan C, et al. Endoscopy 2019;51:775–794): low-fibre diet " +
    "the day before; split dosing; last dose started within 5 hours of the procedure and finished at " +
    "least 2 hours before it; same-day dosing is an alternative for afternoon lists."

extension BowelPrepRegimen {

    // (a) Magnesium-based default
    static let picosulfateMagnesium = BowelPrepRegimen(
        id: .picosulfateMagnesium,
        displayName: "Sodium picosulfate with magnesium oxide and citric acid",
        shortName: "Picolax / CitraFleet (magnesium-based)",
        category: .magnesiumBased,
        productExamples: ["Picolax (Ferring)", "CitraFleet (Casen Recordati)"],
        composition:
            "Per sachet: sodium picosulfate 10 mg, light magnesium oxide 3.5 g, anhydrous citric acid " +
            "12 g (Picolax) or 10.97 g (CitraFleet). Forms magnesium citrate when dissolved.",
        doses: [
            BowelPrepDose(
                label: "Sachet 1",
                volumeText: "1 sachet in about 150 mL of cold water",
                instruction:
                    "Dissolve one sachet in about 150 mL (about half a glass) of cold water and stir for " +
                    "2–3 minutes. The mixture may become warm; if so, wait until it has cooled enough to " +
                    "drink, then drink all of it.",
                intakeMinutes: 15,
                followOnFluids:
                    "Then drink clear fluids, about 250 mL (one glass) every hour, while the preparation is working.",
                followOnMinutes: 240),
            BowelPrepDose(
                label: "Sachet 2",
                volumeText: "1 sachet in about 150 mL of cold water",
                instruction:
                    "Dissolve the second sachet in about 150 mL (about half a glass) of cold water and stir " +
                    "for 2–3 minutes. The mixture may become warm; if so, wait until it has cooled enough " +
                    "to drink, then drink all of it.",
                intakeMinutes: 15,
                followOnFluids:
                    "Then keep drinking clear fluids, about 250 mL (one glass) every hour, until your stop time.",
                followOnMinutes: 180)
        ],
        additionalClearFluids:
            "About 250 mL (one glass) of clear fluid every hour while the preparation is working, after each sachet.",
        sourceNote:
            "Picolax SmPC (Ferring) and CitraFleet SmPC (Casen Recordati), sections 4.2–4.4: one sachet " +
            "in about 150 mL of cold water, two sachets per course, about 250 mL of clear fluid per hour " +
            "while the washout effect lasts. Contraindicated in severe renal impairment (GFR < 30), " +
            "congestive cardiac failure, hypermagnesaemia, rhabdomyolysis, gastrointestinal obstruction " +
            "or perforation, ileus, gastric retention, toxic megacolon and severe dehydration; caution in " +
            "the elderly or debilitated. " + esge2019,
        clinicianNote:
            "Magnesium-based default. [confirm] that the pack insert of the product stocked allows the " +
            "evening + morning split (older Picolax labelling gives both sachets on the day before). " +
            "[confirm] the total extra clear-fluid volume against the pack insert (CitraFleet labelling: " +
            "about 1.5–2 litres). Not for the US ready-to-drink Clenpiq, whose volumes differ.",
        procedures: [.colonoscopy, .flexibleSigmoidoscopy],
        sameDayAllowed: false,
        sameDayIntervalMinutes: 0,
        lastDoseFluidsUntilCutoff: true,
        enemaLeadMinutes: 0,
        requiresSurgeonReview: true)

    // (b) Magnesium citrate bottles (US style)
    static let magnesiumCitrate = BowelPrepRegimen(
        id: .magnesiumCitrate,
        displayName: "Magnesium citrate oral solution",
        shortName: "Magnesium citrate (bottles)",
        category: .magnesiumBased,
        productExamples: ["Magnesium citrate oral solution, 296 mL (10 fl oz) bottle, e.g. Citroma or pharmacy own brand"],
        composition: "Magnesium citrate 1.745 g per 30 mL [confirm against the bottle stocked].",
        doses: [
            BowelPrepDose(
                label: "Bottle 1",
                volumeText: "1 bottle of 296 mL (10 fl oz)",
                instruction:
                    "Drink one bottle of magnesium citrate (296 mL / 10 fl oz), chilled if you prefer, " +
                    "followed by a full glass (about 240 mL) of water or another clear fluid.",
                intakeMinutes: 30,
                followOnFluids: "Then drink clear fluids freely over the next few hours.",
                followOnMinutes: 180),
            BowelPrepDose(
                label: "Bottle 2",
                volumeText: "1 bottle of 296 mL (10 fl oz)",
                instruction:
                    "Drink the second bottle of magnesium citrate (296 mL / 10 fl oz), chilled if you prefer, " +
                    "followed by a full glass (about 240 mL) of water or another clear fluid.",
                intakeMinutes: 30,
                followOnFluids: "Then keep drinking clear fluids until your stop time.",
                followOnMinutes: 120)
        ],
        additionalClearFluids:
            "A full glass (about 240 mL) of clear fluid with each bottle, then clear fluids freely until " +
            "your stop time. Two bottles in total (592 mL), one per dose.",
        sourceNote:
            "US OTC Drug Facts label for magnesium citrate oral solution (1.745 g/30 mL), a saline " +
            "laxative: a full glass (8 fl oz) of liquid with each dose; adult maximum of one bottle in " +
            "24 hours [confirm exact wording on the bottle stocked]. Bowel-preparation use (number of " +
            "bottles and timing) is not on the OTC label. Magnesium: avoid in severe renal impairment, " +
            "heart failure, hypermagnesaemia, obstruction and severe dehydration. " + esge2019 +
            " ESGE names PEG-based and clinically validated non-PEG regimens; magnesium citrate alone is " +
            "not one of the regimens it names.",
        clinicianNote:
            "Surgeon's protocol: two 296 mL bottles, one per split dose (evening before and morning of " +
            "the procedure), each followed by a full glass of clear fluid. Note the OTC label's " +
            "one-bottle-in-24-hours adult maximum: the split keeps the bottles about 9 hours or more apart.",
        procedures: [.colonoscopy, .flexibleSigmoidoscopy],
        sameDayAllowed: false,
        sameDayIntervalMinutes: 0,
        lastDoseFluidsUntilCutoff: true,
        enemaLeadMinutes: 0,
        requiresSurgeonReview: true)

    // (c) Low-volume PEG + ascorbate, 2 L
    static let pegAscorbate2L = BowelPrepRegimen(
        id: .pegAscorbate2L,
        displayName: "Low-volume PEG + ascorbate, 2 litres",
        shortName: "MoviPrep (2 L PEG + ascorbate)",
        category: .peg,
        productExamples: ["MoviPrep (Norgine)"],
        composition:
            "Each litre: sachet A (macrogol 3350 100 g, anhydrous sodium sulfate 7.5 g, sodium chloride " +
            "2.691 g, potassium chloride 1.015 g) + sachet B (ascorbic acid 4.7 g, sodium ascorbate 5.9 g). " +
            "Contains aspartame.",
        doses: [
            BowelPrepDose(
                label: "Litre 1",
                volumeText: "1 sachet A + 1 sachet B made up to 1 litre with water",
                instruction:
                    "Dissolve one sachet A and one sachet B together in water to make 1 litre. Drink it over " +
                    "1 to 2 hours. Try to drink a glassful every 10 to 15 minutes.",
                intakeMinutes: 120,
                followOnFluids: "Then drink at least 500 mL of clear fluid.",
                followOnMinutes: 30),
            BowelPrepDose(
                label: "Litre 2",
                volumeText: "1 sachet A + 1 sachet B made up to 1 litre with water",
                instruction:
                    "Dissolve the second sachet A and sachet B together in water to make 1 litre. Drink it " +
                    "over 1 to 2 hours. Try to drink a glassful every 10 to 15 minutes.",
                intakeMinutes: 120,
                followOnFluids: "Then drink at least 500 mL of clear fluid.",
                followOnMinutes: 30)
        ],
        additionalClearFluids: "At least 500 mL of extra clear fluid after each litre (1 litre extra in total).",
        sourceNote:
            "MoviPrep SmPC (Norgine), sections 4.2–4.4: two litres, each made from sachet A + sachet B in " +
            "1 litre of water and drunk over 1–2 hours; an additional 1 litre of clear fluid during the " +
            "course; split (1 L evening + 1 L morning) or both litres on the morning of the procedure. " +
            "Contraindicated in gastrointestinal obstruction or perforation, ileus, gastric retention, " +
            "toxic megacolon, phenylketonuria (aspartame) and G6PD deficiency (ascorbate). US label: " +
            "16 fl oz of clear liquid after each litre. " + esge2019,
        clinicianNote: "Same-day (afternoon list): litre 2 follows litre 1 and its clear fluid.",
        procedures: [.colonoscopy, .flexibleSigmoidoscopy],
        sameDayAllowed: true,
        sameDayIntervalMinutes: 150,
        lastDoseFluidsUntilCutoff: false,
        enemaLeadMinutes: 0,
        requiresSurgeonReview: true)

    // (d) 1 L PEG + ascorbate
    static let pegAscorbate1L = BowelPrepRegimen(
        id: .pegAscorbate1L,
        displayName: "1 litre PEG + ascorbate",
        shortName: "Plenvu (1 L PEG + ascorbate)",
        category: .peg,
        productExamples: ["Plenvu (Norgine)"],
        composition:
            "Dose 1 sachet: macrogol 3350 100 g, anhydrous sodium sulfate 9 g, sodium chloride 2 g, " +
            "potassium chloride 1 g. Dose 2 sachet A: macrogol 3350 40 g, sodium chloride 3.2 g, potassium " +
            "chloride 1.2 g; sachet B: sodium ascorbate 48.11 g, ascorbic acid 7.54 g. Contains aspartame [confirm].",
        doses: [
            BowelPrepDose(
                label: "Dose 1",
                volumeText: "Dose 1 sachet in 500 mL of water",
                instruction: "Dissolve the Dose 1 sachet in 500 mL of water. Drink it over 30 minutes.",
                intakeMinutes: 30,
                followOnFluids: "Then drink at least 500 mL of clear fluid over the next 30 minutes.",
                followOnMinutes: 30),
            BowelPrepDose(
                label: "Dose 2",
                volumeText: "Dose 2 sachets A and B together in 500 mL of water",
                instruction: "Dissolve Dose 2 sachets A and B together in 500 mL of water. Drink it over 30 minutes.",
                intakeMinutes: 30,
                followOnFluids: "Then drink at least 500 mL of clear fluid over the next 30 minutes.",
                followOnMinutes: 30)
        ],
        additionalClearFluids: "At least 500 mL of extra clear fluid after each dose (1 litre extra in total).",
        sourceNote:
            "Plenvu SmPC (Norgine), sections 4.2–4.4: Dose 1 and Dose 2 each made up to 500 mL with water, " +
            "each followed by at least 500 mL of clear fluid; two-day split (evening + morning) or one-day " +
            "morning dosing. Contraindicated in gastrointestinal obstruction or perforation, ileus, gastric " +
            "retention, toxic megacolon, phenylketonuria and G6PD deficiency (ascorbate). US label: each " +
            "dose over 30 minutes, then 16 fl oz of clear liquid over 30 minutes. " + esge2019,
        clinicianNote:
            "Same-day (afternoon list): Dose 2 starts 2 hours after the start of Dose 1 [confirm the " +
            "interval against the pack insert].",
        procedures: [.colonoscopy, .flexibleSigmoidoscopy],
        sameDayAllowed: true,
        sameDayIntervalMinutes: 120,
        lastDoseFluidsUntilCutoff: false,
        enemaLeadMinutes: 0,
        requiresSurgeonReview: true)

    // (e) Standard 4 L PEG, split 2 L + 2 L
    static let peg4L = BowelPrepRegimen(
        id: .peg4L,
        displayName: "Standard 4 litre PEG (split 2 L + 2 L)",
        shortName: "4 L PEG (Klean-Prep / GoLYTELY type)",
        category: .peg,
        productExamples: ["Klean-Prep (Norgine): 4 sachets, each made up to 1 litre",
                          "GoLYTELY / NuLYTELY: 4 litre jug"],
        composition: "Macrogol (PEG) 3350 with electrolytes; high-volume iso-osmotic solution. Composition varies by brand — see the pack.",
        doses: [
            BowelPrepDose(
                label: "First 2 litres",
                volumeText: "2 litres of made-up solution",
                instruction:
                    "Make up the solution as described on the pack (each Klean-Prep sachet in 1 litre of " +
                    "water, or fill the jug to the marked line). Drink 2 litres: one glass (about 250 mL) " +
                    "every 10 to 15 minutes until the 2 litres are finished.",
                intakeMinutes: 120,
                followOnFluids: "",
                followOnMinutes: 0),
            BowelPrepDose(
                label: "Second 2 litres",
                volumeText: "2 litres of made-up solution",
                instruction:
                    "Drink the remaining 2 litres: one glass (about 250 mL) every 10 to 15 minutes until finished.",
                intakeMinutes: 120,
                followOnFluids: "",
                followOnMinutes: 0)
        ],
        additionalClearFluids:
            "No set extra volume is needed beyond the 4 litres; you may drink other clear fluids until your stop time.",
        sourceNote:
            "Klean-Prep SmPC (Norgine): each sachet in 1 litre of water, 250 mL every 10–15 minutes, up to " +
            "4 litres. GoLYTELY / NuLYTELY US labels: 240 mL every 10 minutes, split dose evening + morning. " +
            "Contraindicated in gastrointestinal obstruction or perforation, ileus, gastric retention and " +
            "toxic megacolon. " + esge2019 + " High-volume split-dose PEG is a recommended regimen.",
        clinicianNote:
            "[confirm] that the local pack allows the 2 L + 2 L split (older Klean-Prep labelling gives " +
            "the 4 litres on the day before).",
        procedures: [.colonoscopy, .flexibleSigmoidoscopy],
        sameDayAllowed: false,
        sameDayIntervalMinutes: 0,
        lastDoseFluidsUntilCutoff: false,
        enemaLeadMinutes: 0,
        requiresSurgeonReview: true)

    // (f) Enema only, flexible sigmoidoscopy
    static let enemaOnly = BowelPrepRegimen(
        id: .enemaOnly,
        displayName: "Enema only (flexible sigmoidoscopy)",
        shortName: "Enema only",
        category: .enema,
        productExamples: ["Phosphate enema, e.g. Fleet Ready-to-Use enema (133 mL) or Phosphates Enema BP Formula B (128 mL)",
                          "Sodium citrate micro-enema, e.g. Micralax (5 mL)"],
        composition: "Single rectal enema; no oral preparation.",
        doses: [
            BowelPrepDose(
                label: "Enema",
                volumeText: "One Fleet enema (133 mL)",
                instruction:
                    "At home, about 2 hours before your appointment, use one Fleet enema (133 mL). " +
                    "Lie on your left side with your knees " +
                    "bent, gently insert the nozzle and squeeze in the contents. Try to hold it for a few " +
                    "minutes before going to the toilet.",
                intakeMinutes: 0,
                followOnFluids: "",
                followOnMinutes: 0)
        ],
        additionalClearFluids: "None needed.",
        sourceNote:
            "Product labels (Fleet Ready-to-Use enema; Micralax). The ESGE 2019 guideline covers oral " +
            "preparation for colonoscopy; enema-only preparation for flexible sigmoidoscopy is local " +
            "practice [confirm]. Phosphate enemas: caution in renal impairment, heart failure and " +
            "dehydration [confirm against the product label].",
        clinicianNote:
            "Surgeon's protocol: one Fleet phosphate enema at home about 2 hours before; light breakfast " +
            "on the morning. Phosphate enema cautions (renal impairment, heart failure, dehydration) per " +
            "the Fleet label.",
        procedures: [.flexibleSigmoidoscopy],
        sameDayAllowed: false,
        sameDayIntervalMinutes: 0,
        lastDoseFluidsUntilCutoff: false,
        enemaLeadMinutes: 120,
        requiresSurgeonReview: true)

    static let all: [BowelPrepRegimen] =
        [picosulfateMagnesium, magnesiumCitrate, pegAscorbate2L, pegAscorbate1L, peg4L, enemaOnly]

    static func regimen(_ id: BowelPrepRegimenID) -> BowelPrepRegimen {
        all.first { $0.id == id } ?? picosulfateMagnesium
    }

    static func available(for procedure: BowelPrepProcedure) -> [BowelPrepRegimen] {
        all.filter { $0.procedures.contains(procedure) }
    }

    /// Default before any safety suggestion: magnesium-based for colonoscopy, enema for flexi sig.
    static func defaultID(for procedure: BowelPrepProcedure) -> BowelPrepRegimenID {
        procedure == .flexibleSigmoidoscopy ? .enemaOnly : .picosulfateMagnesium
    }

    /// Everything patient-facing for this regimen (dose wording, fluids, shared sheet text).
    var patientFacingText: String {
        var parts: [String] = [displayName]
        for d in doses {
            parts += [d.label, d.volumeText, d.instruction, d.followOnFluids]
        }
        parts.append(additionalClearFluids)
        if category == .enema { parts.append(BowelPrepText.enemaDayDiet) }
        parts += BowelPrepText.sharedPatientText
        return parts.joined(separator: "\n")
    }

    /// Full wording the surgeon reviews: patient-facing text plus sources and notes.
    var wordingForReview: String {
        [patientFacingText, productExamples.joined(separator: "; "), composition, sourceNote, clinicianNote]
            .joined(separator: "\n")
    }

    /// Patient-facing wording still holds a "[confirm]" placeholder.
    var hasPlaceholders: Bool { patientFacingText.contains(BowelPrepText.confirm) }

    /// Stable fingerprint of the reviewed wording (FNV-1a 64). A sign-off lapses when it changes.
    var wordingFingerprint: String { BowelPrepSignOff.fnv1a64(wordingForReview) }
}

// MARK: - Timing engine

enum BowelPrepListType: String {
    case morning, afternoon

    var label: String {
        switch self {
        case .morning:   return "Morning list"
        case .afternoon: return "Afternoon list"
        }
    }
}

enum BowelPrepDosingMode: String {
    case split, sameDay, enemaOnly
}

struct BowelPrepScheduleOptions: Codable, Equatable {
    /// First (evening) dose, minutes after midnight on the day before. ESGE: early evening, e.g. 17:00–19:00.
    var eveningDoseMinutes: Int = 18 * 60
    /// Last dose starts this many minutes before the procedure (4–6 h; ESGE: within 5 h).
    var secondDoseLeadMinutes: Int = 5 * 60
    /// Clear fluids only from this time on the day before (minutes after midnight).
    var clearFluidsFromMinutes: Int = 13 * 60
    /// Afternoon lists: both doses on the day, when the product labelling allows it.
    var afternoonSameDay: Bool = false

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        eveningDoseMinutes     = (try? c.decodeIfPresent(Int.self, forKey: .eveningDoseMinutes)) ?? 18 * 60
        secondDoseLeadMinutes  = (try? c.decodeIfPresent(Int.self, forKey: .secondDoseLeadMinutes)) ?? 5 * 60
        clearFluidsFromMinutes = (try? c.decodeIfPresent(Int.self, forKey: .clearFluidsFromMinutes)) ?? 13 * 60
        afternoonSameDay       = (try? c.decodeIfPresent(Bool.self, forKey: .afternoonSameDay)) ?? false
    }
}

struct BowelPrepStep: Identifiable, Equatable {
    enum Kind: String {
        case lowResidueDiet, clearFluidsOnly, dose, fluids, enema, stopIntake, procedure
    }

    let id: Int
    let kind: Kind
    let start: Date
    let end: Date?
    let title: String
    let detail: String
    /// Something taken by mouth (food, fluid or a dose). Must all end by the 2-hour stop time.
    let isOralIntake: Bool
}

struct BowelPrepSchedule {
    let regimenID: BowelPrepRegimenID
    let procedure: BowelPrepProcedure
    let appointment: Date
    let timeZone: TimeZone
    let listType: BowelPrepListType
    let mode: BowelPrepDosingMode
    /// Clear fluids only from this time (nil for enema only).
    let clearFluidsFrom: Date?
    /// Nothing by mouth after this time: 2 hours before the procedure.
    let lastIntakeBy: Date
    /// Start time of each dose, in order.
    let doseStarts: [Date]
    /// Chronological timetable.
    let steps: [BowelPrepStep]
    let warnings: [String]

    /// Latest moment anything is taken by mouth.
    var latestOralIntake: Date? {
        steps.filter(\.isOralIntake).map { $0.end ?? $0.start }.max()
    }
}

enum BowelPrepScheduler {
    /// Surgeon's rule and ESGE 2019: everything by mouth finished at least 2 h before.
    static let finalIntakeMinutesBefore = 120
    /// Last dose starts 4–6 h before the procedure.
    static let secondDoseLeadRange = 240...360
    /// Appointments from 12:00 are afternoon lists.
    static let afternoonFromHour = 12

    static func calendar(_ timeZone: TimeZone) -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal
    }

    static func listType(for appointment: Date, timeZone: TimeZone) -> BowelPrepListType {
        let hour = calendar(timeZone).component(.hour, from: appointment)
        return hour < afternoonFromHour ? .morning : .afternoon
    }

    static func schedule(regimen: BowelPrepRegimen,
                         procedure: BowelPrepProcedure = .colonoscopy,
                         appointment: Date,
                         options: BowelPrepScheduleOptions = BowelPrepScheduleOptions(),
                         timeZone: TimeZone) -> BowelPrepSchedule {
        let cal = calendar(timeZone)
        let dayOf = cal.startOfDay(for: appointment)
        let dayBefore = cal.date(byAdding: .day, value: -1, to: dayOf) ?? dayOf.addingTimeInterval(-86_400)
        func at(_ day: Date, _ minutes: Int) -> Date {
            cal.date(byAdding: .minute, value: minutes, to: day) ?? day.addingTimeInterval(TimeInterval(minutes * 60))
        }
        func before(_ minutes: Int) -> Date { appointment.addingTimeInterval(TimeInterval(-minutes * 60)) }
        func later(_ date: Date, _ minutes: Int) -> Date { date.addingTimeInterval(TimeInterval(minutes * 60)) }
        func time(_ d: Date) -> String { BowelPrepFormat.time(d, timeZone) }

        let cutoff = before(finalIntakeMinutesBefore)
        let list = listType(for: appointment, timeZone: timeZone)
        var steps: [BowelPrepStep] = []
        var warnings: [String] = []

        func add(_ kind: BowelPrepStep.Kind, _ start: Date, _ end: Date?, _ title: String, _ detail: String, oral: Bool) {
            steps.append(BowelPrepStep(id: steps.count, kind: kind, start: start, end: end,
                                       title: title, detail: detail, isOralIntake: oral))
        }

        let stopDetail = BowelPrepText.stopIntake
        let procedureTitle = "Your \(procedure.patientName)"
        let procedureDetail = "Appointment time. \(BowelPrepText.afterProcedure)"

        // Enema only (flexible sigmoidoscopy): no oral preparation.
        if regimen.category == .enema {
            let enemaTime = before(regimen.enemaLeadMinutes)
            add(.clearFluidsOnly, dayOf, cutoff, "Light breakfast, then clear fluids",
                "\(BowelPrepText.enemaDayDiet) After breakfast, clear fluids until \(time(cutoff)).", oral: true)
            if let dose = regimen.doses.first {
                add(.enema, enemaTime, nil, dose.label, dose.instruction, oral: false)
            }
            add(.stopIntake, cutoff, nil, "Stop all food and drink", stopDetail, oral: false)
            add(.procedure, appointment, nil, procedureTitle, procedureDetail, oral: false)
            return BowelPrepSchedule(regimenID: regimen.id, procedure: procedure, appointment: appointment,
                                     timeZone: timeZone, listType: list, mode: .enemaOnly,
                                     clearFluidsFrom: nil, lastIntakeBy: cutoff, doseStarts: [enemaTime],
                                     steps: ordered(steps), warnings: warnings)
        }

        let sameDayRequested = list == .afternoon && options.afternoonSameDay
        let sameDay = sameDayRequested && regimen.sameDayAllowed
        if sameDayRequested && !regimen.sameDayAllowed {
            warnings.append("Same-day dosing is not in this product's labelling; the split-dose timetable is shown.")
        }

        // Diet the day before.
        let clearFrom = at(dayBefore, options.clearFluidsFromMinutes)
        add(.lowResidueDiet, dayBefore, clearFrom, "Low-residue diet", BowelPrepText.lowResidue, oral: true)
        add(.clearFluidsOnly, clearFrom, cutoff, "Clear fluids only",
            "No solid food from \(time(clearFrom)). Clear fluids are allowed, and needed, until \(time(cutoff)) " +
            "on \(BowelPrepFormat.day(cutoff, timeZone)). \(BowelPrepText.clearFluids)", oral: true)

        // Last dose: starts 4–6 h before and, with its own fluids, ends by the stop time.
        let lead = min(max(options.secondDoseLeadMinutes, secondDoseLeadRange.lowerBound), secondDoseLeadRange.upperBound)
        guard let lastDose = regimen.doses.last else {
            return BowelPrepSchedule(regimenID: regimen.id, procedure: procedure, appointment: appointment,
                                     timeZone: timeZone, listType: list, mode: .split, clearFluidsFrom: clearFrom,
                                     lastIntakeBy: cutoff, doseStarts: [], steps: ordered(steps), warnings: warnings)
        }
        let lastNeeds = lastDose.intakeMinutes + (regimen.lastDoseFluidsUntilCutoff ? 0 : lastDose.followOnMinutes)
        var lastStart = before(lead)
        let latestAllowedStart = later(cutoff, -lastNeeds)
        if lastStart > latestAllowedStart {
            lastStart = max(latestAllowedStart, before(secondDoseLeadRange.upperBound))
            warnings.append("The last dose starts at \(time(lastStart)) so that it and its fluids finish by \(time(cutoff)).")
        }

        var starts: [Date] = [lastStart]
        if regimen.doses.count >= 2 {
            let firstStart = sameDay
                ? later(lastStart, -regimen.sameDayIntervalMinutes)
                : at(dayBefore, options.eveningDoseMinutes)
            starts = [firstStart, lastStart]
        }
        let doses = Array(regimen.doses.suffix(starts.count))

        for (i, pair) in zip(doses, starts).enumerated() {
            let (dose, start) = pair
            let isLast = i == starts.count - 1
            let intakeEnd = min(later(start, dose.intakeMinutes), cutoff)
            add(.dose, start, intakeEnd, dose.label, "\(dose.instruction) (\(dose.volumeText))", oral: true)
            if !dose.followOnFluids.isEmpty {
                let fluidsEnd = isLast && regimen.lastDoseFluidsUntilCutoff
                    ? cutoff
                    : min(later(intakeEnd, dose.followOnMinutes), cutoff)
                if fluidsEnd > intakeEnd {
                    add(.fluids, intakeEnd, fluidsEnd, "Clear fluids after \(dose.label.lowercased())",
                        dose.followOnFluids, oral: true)
                }
            }
        }

        if starts.count == 2, let first = doses.first {
            let firstDone = later(starts[0], first.intakeMinutes + first.followOnMinutes)
            if firstDone > starts[1] {
                warnings.append("The first dose and its fluids run into the second dose — adjust the timings.")
            }
            if !sameDay && clearFrom > starts[0] {
                warnings.append("Clear fluids start after the first dose — move the clear-fluid time earlier.")
            }
        }

        add(.stopIntake, cutoff, nil, "Stop all food and drink", stopDetail, oral: false)
        add(.procedure, appointment, nil, procedureTitle, procedureDetail, oral: false)

        return BowelPrepSchedule(regimenID: regimen.id, procedure: procedure, appointment: appointment,
                                 timeZone: timeZone, listType: list, mode: sameDay ? .sameDay : .split,
                                 clearFluidsFrom: clearFrom, lastIntakeBy: cutoff, doseStarts: starts,
                                 steps: ordered(steps), warnings: warnings)
    }

    /// Chronological order (ties keep insertion order), renumbered.
    private static func ordered(_ steps: [BowelPrepStep]) -> [BowelPrepStep] {
        steps
            .sorted { ($0.start, $0.id) < ($1.start, $1.id) }
            .enumerated()
            .map { i, s in
                BowelPrepStep(id: i, kind: s.kind, start: s.start, end: s.end,
                              title: s.title, detail: s.detail, isOralIntake: s.isOralIntake)
            }
    }
}

// MARK: - Formatting (always in the practice time zone passed in)

enum BowelPrepFormat {
    static func formatter(_ format: String, _ timeZone: TimeZone) -> DateFormatter {
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_GB")
        df.timeZone = timeZone
        df.dateFormat = format
        return df
    }

    /// "18:00"
    static func time(_ date: Date, _ timeZone: TimeZone) -> String {
        formatter("HH:mm", timeZone).string(from: date)
    }

    /// "Sunday 4 October"
    static func day(_ date: Date, _ timeZone: TimeZone) -> String {
        formatter("EEEE d MMMM", timeZone).string(from: date)
    }

    /// "Sun 4 Oct, 18:00"
    static func shortDayTime(_ date: Date, _ timeZone: TimeZone) -> String {
        formatter("EEE d MMM, HH:mm", timeZone).string(from: date)
    }

    /// Timetable label for a step.
    static func when(_ step: BowelPrepStep, _ timeZone: TimeZone) -> String {
        switch step.kind {
        case .lowResidueDiet:
            let until = step.end.map { " until \(time($0, timeZone))" } ?? ""
            return formatter("EEE d MMM", timeZone).string(from: step.start) + until
        case .clearFluidsOnly:
            let startTime = time(step.start, timeZone)
            if startTime == "00:00" {
                let until = step.end.map { " until \(time($0, timeZone))" } ?? ""
                return formatter("EEE d MMM", timeZone).string(from: step.start) + until
            }
            return "From " + shortDayTime(step.start, timeZone)
        case .fluids:
            let until = step.end.map { "–\(time($0, timeZone))" } ?? ""
            return shortDayTime(step.start, timeZone) + until
        case .dose, .enema, .stopIntake, .procedure:
            return shortDayTime(step.start, timeZone)
        }
    }
}

// MARK: - Safety suggestions

/// What the safety checks read from the record. Built from a Patient in
/// BowelPrepProtocols+Patient.swift; tests build it directly.
struct BowelPrepPatientFacts: Equatable {
    var ageYears: Int?
    var egfr: Double?
    var creatinineUmolL: Double?
    var magnesium: Double?
    /// "mmol" or "mgdl" when the result text states the unit.
    var magnesiumUnit: String?
    var cfs: Int?
    var kdigoStage: Int?
    /// PMH entries and PMH notes, lower-cased.
    var historyText: String = ""
    /// Chief complaint, HPI, working diagnosis and assessment, lower-cased.
    var presentationText: String = ""
    var onDiabetesMedicine: Bool = false

    init(ageYears: Int? = nil, egfr: Double? = nil, creatinineUmolL: Double? = nil,
         magnesium: Double? = nil, magnesiumUnit: String? = nil, cfs: Int? = nil,
         kdigoStage: Int? = nil, historyText: String = "", presentationText: String = "",
         onDiabetesMedicine: Bool = false) {
        self.ageYears = ageYears
        self.egfr = egfr
        self.creatinineUmolL = creatinineUmolL
        self.magnesium = magnesium
        self.magnesiumUnit = magnesiumUnit
        self.cfs = cfs
        self.kdigoStage = kdigoStage
        self.historyText = historyText.lowercased()
        self.presentationText = presentationText.lowercased()
        self.onDiabetesMedicine = onDiabetesMedicine
    }
}

struct BowelPrepSuggestion: Identifiable, Equatable {
    enum Level: Int, Comparable {
        case plan = 0, caution = 1, avoid = 2
        static func < (a: Level, b: Level) -> Bool { a.rawValue < b.rawValue }

        var label: String {
            switch self {
            case .plan:    return "Plan"
            case .caution: return "Caution"
            case .avoid:   return "Consider avoiding"
            }
        }

        var icon: String {
            switch self {
            case .plan:    return "info.circle.fill"
            case .caution: return "exclamationmark.triangle.fill"
            case .avoid:   return "hand.raised.fill"
            }
        }
    }

    /// Stable id (used to remember a dismissal).
    let id: String
    let level: Level
    /// Always phrased as a suggestion, e.g. "Suggested: consider PEG-based prep (eGFR 24)".
    let title: String
    /// Why, with the value or text that triggered it.
    let reason: String
    /// Regimens the concern applies to.
    let affects: Set<BowelPrepRegimenID>
    /// The concern points towards a PEG-based preparation.
    let suggestsPEG: Bool
}

enum BowelPrepSafety {
    static let magnesiumBased: Set<BowelPrepRegimenID> = [.picosulfateMagnesium, .magnesiumCitrate]
    static let pegBased: Set<BowelPrepRegimenID> = [.pegAscorbate2L, .pegAscorbate1L, .peg4L]
    static let ascorbatePEG: Set<BowelPrepRegimenID> = [.pegAscorbate2L, .pegAscorbate1L]
    static var oral: Set<BowelPrepRegimenID> { magnesiumBased.union(pegBased) }

    static let diabetesMedicines = ["insulin", "metformin", "gliclazide", "glibenclamide",
                                    "sitagliptin", "empagliflozin", "dapagliflozin"]

    static func words(_ text: String) -> Set<String> {
        Set(text.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty })
    }

    /// First phrase (substring) or whole word found in `text`.
    static func firstMatch(_ text: String, phrases: [String], words ws: [String] = []) -> String? {
        let t = text.lowercased()
        if let p = phrases.first(where: { t.contains($0) }) { return p }
        let set = words(t)
        return ws.first { set.contains($0) }
    }

    private static func number(_ v: Double) -> String { String(format: "%.0f", v) }
    private static func decimal(_ v: Double) -> String {
        var s = String(format: "%.2f", v)
        while s.hasSuffix("0") { s.removeLast() }
        if s.hasSuffix(".") { s.removeLast() }
        return s
    }

    /// Suggestions from the record. Deterministic; never blocks and never changes a choice.
    static func suggestions(for f: BowelPrepPatientFacts) -> [BowelPrepSuggestion] {
        var out: [BowelPrepSuggestion] = []
        let allText = f.historyText + " " + f.presentationText
        let magnesiumAndEnema = magnesiumBased.union([.enemaOnly])

        // Renal function
        let ckdPhrases = ["ckd 4", "ckd4", "ckd stage 4", "ckd iv", "stage 4 ckd", "ckd 5", "ckd5", "ckd stage 5",
                          "ckd v", "stage 5 ckd", "chronic kidney disease stage 4", "chronic kidney disease stage 5",
                          "end-stage renal", "end stage renal", "dialysis"]
        let ckdMatch = firstMatch(f.historyText, phrases: ckdPhrases, words: ["esrd", "eskd"])
        if let egfr = f.egfr, egfr < 30 {
            out.append(.init(
                id: "renal_severe", level: .avoid,
                title: "Suggested: consider PEG-based prep (eGFR \(number(egfr)))",
                reason: "eGFR \(number(egfr)) mL/min/1.73 m². Sodium picosulfate/magnesium and magnesium citrate " +
                        "are contraindicated in severe renal impairment (GFR < 30) in the product labelling: " +
                        "magnesium can accumulate. Phosphate enemas also need caution.",
                affects: magnesiumAndEnema, suggestsPEG: true))
        } else if let m = ckdMatch {
            out.append(.init(
                id: "renal_severe", level: .avoid,
                title: "Suggested: consider PEG-based prep (CKD 4–5 in history)",
                reason: "History mentions \"\(m)\". Magnesium-based preparations are contraindicated in severe " +
                        "renal impairment in the product labelling. Check a current eGFR.",
                affects: magnesiumAndEnema, suggestsPEG: true))
        } else if let egfr = f.egfr, egfr < 60 {
            out.append(.init(
                id: "renal_moderate", level: .caution,
                title: "Caution with magnesium-based prep (eGFR \(number(egfr)))",
                reason: "eGFR \(number(egfr)) mL/min/1.73 m². The labelling advises caution in renal impairment. " +
                        "Consider checking U&E and hydration; a PEG-based prep is an alternative.",
                affects: magnesiumBased, suggestsPEG: false))
        } else if f.egfr == nil, let cr = f.creatinineUmolL, cr >= 150 {
            out.append(.init(
                id: "renal_unknown", level: .caution,
                title: "Check eGFR before a magnesium-based prep (creatinine \(number(cr)) µmol/L)",
                reason: "Creatinine \(number(cr)) µmol/L and no eGFR recorded. Magnesium-based preparations are " +
                        "contraindicated when GFR is below 30.",
                affects: magnesiumBased, suggestsPEG: false))
        }

        // Heart failure
        if let m = firstMatch(allText,
                              phrases: ["heart failure", "cardiac failure", "congestive cardiac"],
                              words: ["ccf", "chf", "hfref", "hfpef", "lvsd"]) {
            out.append(.init(
                id: "heart_failure", level: .avoid,
                title: "Suggested: consider PEG-based prep (heart failure)",
                reason: "Record mentions \"\(m)\". The sodium picosulfate/magnesium labelling lists congestive " +
                        "cardiac failure as a contraindication (fluid and electrolyte shifts); PEG-based " +
                        "preparations are iso-osmotic. Plan fluid balance with the clinician. Phosphate enemas " +
                        "also need caution.",
                affects: magnesiumAndEnema, suggestsPEG: true))
        }

        // Hypermagnesaemia
        if let m = firstMatch(allText, phrases: ["hypermagnes"]) {
            out.append(.init(
                id: "hypermagnesaemia", level: .avoid,
                title: "Suggested: consider PEG-based prep (hypermagnesaemia)",
                reason: "Record mentions \"\(m)\". Hypermagnesaemia is a contraindication to magnesium-based preparations.",
                affects: magnesiumBased, suggestsPEG: true))
        } else if let mg = f.magnesium {
            let unit = f.magnesiumUnit
            let highMmol = (unit == "mmol" || (unit == nil && mg < 1.6)) && mg > 1.05
            let highMgdl = (unit == "mgdl" || (unit == nil && mg >= 2.7)) && mg > 2.6
            if highMmol || highMgdl {
                let shown = highMmol ? "\(decimal(mg)) mmol/L" : "\(decimal(mg)) mg/dL"
                out.append(.init(
                    id: "hypermagnesaemia", level: .avoid,
                    title: "Suggested: consider PEG-based prep (magnesium \(shown))",
                    reason: "Latest magnesium \(shown) is above the reference range. Hypermagnesaemia is a " +
                            "contraindication to magnesium-based preparations.",
                    affects: magnesiumBased, suggestsPEG: true))
            } else if unit == nil && mg >= 1.6 && mg < 2.7 {
                out.append(.init(
                    id: "magnesium_units", level: .caution,
                    title: "Check magnesium units (\(decimal(mg)))",
                    reason: "Magnesium \(decimal(mg)) is high if in mmol/L but normal if in mg/dL. Check the " +
                            "unit before a magnesium-based prep.",
                    affects: magnesiumBased, suggestsPEG: false))
            }
        }

        // Obstruction / ileus — every oral preparation
        let obstructionPhrases = ["bowel obstruction", "intestinal obstruction", "colonic obstruction",
                                  "obstructing", "ileus", "volvulus", "pseudo-obstruction", "pseudo obstruction",
                                  "toxic megacolon", "perforat"]
        if let m = firstMatch(f.presentationText + " " + f.historyText, phrases: obstructionPhrases) {
            out.append(.init(
                id: "obstruction", level: .avoid,
                title: "Suggested: clinician review before any oral prep (suspected obstruction or ileus)",
                reason: "Record mentions \"\(m)\". All oral bowel preparations, magnesium-based and PEG, are " +
                        "contraindicated with known or suspected bowel obstruction, ileus or perforation in the " +
                        "product labelling.",
                affects: oral, suggestsPEG: false))
        }

        // Severe dehydration / AKI
        let dehydrationMatch = firstMatch(f.presentationText,
                                          phrases: ["dehydrat", "acute kidney injury", "hypovolaem", "hypovolem"],
                                          words: ["aki"])
        let akiStage = (f.kdigoStage ?? 0) >= 1 ? f.kdigoStage : nil
        if dehydrationMatch != nil || akiStage != nil {
            let why = dehydrationMatch.map { "Record mentions \"\($0)\"." } ?? "KDIGO AKI stage \(akiStage ?? 0) recorded."
            out.append(.init(
                id: "dehydration", level: .avoid,
                title: "Suggested: consider PEG-based prep (dehydration / AKI)",
                reason: "\(why) Severe dehydration is a contraindication to sodium picosulfate/magnesium in the " +
                        "labelling. Consider correcting fluid status before any preparation.",
                affects: magnesiumAndEnema, suggestsPEG: true))
        }

        // Elderly / frail
        var frailParts: [String] = []
        if let age = f.ageYears, age >= 75 { frailParts.append("age \(age)") }
        if let cfs = f.cfs, cfs >= 5 { frailParts.append("CFS \(cfs)") }
        if !frailParts.isEmpty {
            let label = frailParts.joined(separator: ", ")
            out.append(.init(
                id: "elderly_frail", level: .caution,
                title: "Caution with magnesium-based prep (\(label))",
                reason: "The labelling advises caution in elderly or debilitated patients: risk of dehydration, " +
                        "hyponatraemia and hypermagnesaemia. Consider checking U&E; a PEG-based prep may be preferred.",
                affects: magnesiumBased, suggestsPEG: false))
        }

        // Ascorbate-containing PEG
        if let m = firstMatch(f.historyText, phrases: ["g6pd", "glucose-6-phosphate", "glucose 6 phosphate"]) {
            out.append(.init(
                id: "g6pd", level: .avoid,
                title: "Consider avoiding ascorbate-containing PEG (G6PD deficiency)",
                reason: "History mentions \"\(m)\". MoviPrep and Plenvu contain ascorbate; their labelling lists " +
                        "G6PD deficiency as a contraindication. A 4 L PEG is an alternative.",
                affects: ascorbatePEG, suggestsPEG: false))
        }
        if let m = firstMatch(f.historyText, phrases: ["phenylketonuria"], words: ["pku"]) {
            out.append(.init(
                id: "pku", level: .avoid,
                title: "Consider avoiding aspartame-containing PEG (phenylketonuria)",
                reason: "History mentions \"\(m)\". MoviPrep and Plenvu contain aspartame, a source of phenylalanine.",
                affects: ascorbatePEG, suggestsPEG: false))
        }

        // Diabetes: a planning flag only. No medicine doses.
        let diabetesInHistory = f.historyText.contains("diabet")
        if diabetesInHistory || f.onDiabetesMedicine {
            out.append(.init(
                id: "diabetes", level: .plan,
                title: "Diabetes: plan diabetes medicines with the clinician",
                reason: (diabetesInHistory ? "Diabetes in the history." : "On a diabetes medicine.") +
                        " The low-residue diet, clear fluids and preparation change food intake. Agree a plan " +
                        "for diabetes medicines and glucose checks before the prep. This app gives no medicine doses.",
                affects: Set(BowelPrepRegimenID.allCases), suggestsPEG: false))
        }

        return out.sorted { $0.level > $1.level }
    }

    /// The pre-selected regimen: magnesium-based unless a suggestion points to PEG
    /// (a 4 L PEG when ascorbate-containing PEG is also flagged). Flexible sigmoidoscopy: enema.
    /// Only a pre-selection; the clinician must still choose.
    static func suggestedRegimen(for procedure: BowelPrepProcedure,
                                 suggestions: [BowelPrepSuggestion]) -> BowelPrepRegimenID {
        let base = BowelPrepRegimen.defaultID(for: procedure)
        guard procedure == .colonoscopy, suggestions.contains(where: \.suggestsPEG) else { return base }
        let ascorbateFlagged = suggestions.contains { $0.level == .avoid && $0.affects.contains(.pegAscorbate2L) }
        return ascorbateFlagged ? .peg4L : .pegAscorbate2L
    }
}

// MARK: - Surgeon sign-off of protocol wording (stored per regimen, on this device)

struct BowelPrepSignOffRecord: Codable, Equatable {
    var fingerprint: String
    var signedAt: Date
    var signedBy: String
}

enum BowelPrepSignOff {
    static let defaultsKey = "amf.bowelPrep.signOff.v1"

    static func fnv1a64(_ text: String) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01b3
        }
        return String(hash, radix: 16)
    }

    static func load(from defaults: UserDefaults = .standard) -> [String: BowelPrepSignOffRecord] {
        guard let data = defaults.data(forKey: defaultsKey) else { return [:] }
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([String: BowelPrepSignOffRecord].self, from: data)) ?? [:]
    }

    static func save(_ records: [String: BowelPrepSignOffRecord], to defaults: UserDefaults = .standard) {
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(records) else { return }
        defaults.set(data, forKey: defaultsKey)
    }

    /// Signed off, for the wording as it is now, with no placeholders left.
    static func isSignedOff(_ regimen: BowelPrepRegimen, records: [String: BowelPrepSignOffRecord]) -> Bool {
        guard !regimen.hasPlaceholders, let r = records[regimen.id.rawValue] else { return false }
        return r.fingerprint == regimen.wordingFingerprint
    }

    /// Records the surgeon's approval of the current wording. Refused while placeholders remain.
    @discardableResult
    static func approve(_ regimen: BowelPrepRegimen, by name: String, at date: Date = Date(),
                        defaults: UserDefaults = .standard) -> Bool {
        guard !regimen.hasPlaceholders else { return false }
        var records = load(from: defaults)
        records[regimen.id.rawValue] = BowelPrepSignOffRecord(fingerprint: regimen.wordingFingerprint,
                                                              signedAt: date, signedBy: name)
        save(records, to: defaults)
        return true
    }

    static func withdraw(_ id: BowelPrepRegimenID, defaults: UserDefaults = .standard) {
        var records = load(from: defaults)
        records.removeValue(forKey: id.rawValue)
        save(records, to: defaults)
    }
}

// MARK: - Stored plan (Patient.pathwayDataJson → PathwayData.bowelPrep)

struct BowelPrepPlan: Codable, Equatable {
    /// The clinician's explicit choice; nil until they choose.
    var regimenID: String?
    var chosenAt: Date?
    var procedureRaw: String?
    /// Overrides Patient.operationDate when set.
    var appointment: Date?
    var options = BowelPrepScheduleOptions()
    var dismissedSuggestions: [String] = []
    var lastSharedAt: Date?

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        regimenID            = (try? c.decodeIfPresent(String.self, forKey: .regimenID)) ?? nil
        chosenAt             = (try? c.decodeIfPresent(Date.self, forKey: .chosenAt)) ?? nil
        procedureRaw         = (try? c.decodeIfPresent(String.self, forKey: .procedureRaw)) ?? nil
        appointment          = (try? c.decodeIfPresent(Date.self, forKey: .appointment)) ?? nil
        options              = (try? c.decodeIfPresent(BowelPrepScheduleOptions.self, forKey: .options)) ?? BowelPrepScheduleOptions()
        dismissedSuggestions = (try? c.decodeIfPresent([String].self, forKey: .dismissedSuggestions)) ?? []
        lastSharedAt         = (try? c.decodeIfPresent(Date.self, forKey: .lastSharedAt)) ?? nil
    }

    var regimen: BowelPrepRegimenID? { regimenID.flatMap(BowelPrepRegimenID.init(rawValue:)) }
    var procedure: BowelPrepProcedure? { procedureRaw.flatMap(BowelPrepProcedure.init(rawValue:)) }
}

// MARK: - Patient-facing sheet

struct BowelPrepPatientSheet: Equatable {
    struct Row: Equatable {
        let when: String
        let title: String
        let text: String
    }

    struct Block: Equatable {
        let title: String
        let body: String
    }

    let heading: String
    let isDraft: Bool
    let intro: String
    let rows: [Row]
    let blocks: [Block]
    let contact: String

    static func build(patientName: String,
                      procedure: BowelPrepProcedure,
                      regimen: BowelPrepRegimen,
                      schedule: BowelPrepSchedule,
                      practice: PracticeProfile,
                      signedOff: Bool) -> BowelPrepPatientSheet {
        let tz = schedule.timeZone
        let apptDay = BowelPrepFormat.day(schedule.appointment, tz)
        let apptTime = BowelPrepFormat.time(schedule.appointment, tz)
        let stop = BowelPrepFormat.time(schedule.lastIntakeBy, tz)

        var intro = "Your \(procedure.patientName) is booked for \(apptDay) at \(apptTime). "
        if regimen.category == .enema {
            intro += "A clear lower bowel allows the doctor to see the lining properly. Please follow this timetable carefully."
        } else {
            intro += "A clear bowel allows the doctor to see the lining properly, so please follow this " +
                     "timetable carefully. You may drink clear fluids until \(stop), 2 hours before your " +
                     "appointment; the preparation needs this fluid to work."
        }
        intro += "\n\nYour preparation: \(regimen.displayName) (\(regimen.productExamples.joined(separator: "; ")))."

        let rows = schedule.steps.map { step in
            Row(when: BowelPrepFormat.when(step, tz), title: step.title, text: step.detail)
        }

        var blocks: [Block] = []
        let doseText = regimen.doses.map { d -> String in
            var s = "\(d.label): \(d.instruction)"
            if !d.followOnFluids.isEmpty { s += " \(d.followOnFluids)" }
            return s
        }.joined(separator: "\n\n")
        blocks.append(Block(title: "How to take your preparation", body: doseText))
        if regimen.category != .enema {
            blocks.append(Block(title: "Extra clear fluids", body: regimen.additionalClearFluids))
            blocks.append(Block(title: "Low-residue food (the day before)", body: BowelPrepText.lowResidue))
        }
        blocks.append(Block(title: "Clear fluids you may drink", body: BowelPrepText.clearFluids))
        blocks.append(Block(title: "Your regular medicines", body: BowelPrepText.medicines))
        blocks.append(Block(title: "What to expect",
                            body: regimen.category == .enema ? BowelPrepText.enemaExpect : BowelPrepText.whatToExpect))
        blocks.append(Block(title: "When to seek help", body: BowelPrepText.seekHelp))
        blocks.append(Block(title: "After your procedure", body: BowelPrepText.afterProcedure))

        let clinician = practice.clinicianNameWithCredentials
        let contact = PracticeProfile.join([
            "If you have any questions, please contact \(practice.practiceName)",
            practice.primaryPhone.isEmpty ? "" : "on \(practice.primaryPhone)"
        ], separator: " ") + "." + (clinician.isEmpty ? "" : "\nPrepared by \(clinician).")

        return BowelPrepPatientSheet(
            heading: "Bowel preparation for your \(procedure.patientName) — \(patientName)",
            isDraft: !signedOff,
            intro: intro,
            rows: rows,
            blocks: blocks,
            contact: contact)
    }

    /// Plain-text version for sharing as a message.
    var plainText: String {
        var lines: [String] = []
        if isDraft { lines += [BowelPrepText.draftNotice, ""] }
        lines += [heading.uppercased(), "", intro, "", "YOUR TIMETABLE"]
        for r in rows { lines += ["• \(r.when) — \(r.title)", "  \(r.text)"] }
        for b in blocks { lines += ["", b.title.uppercased(), b.body] }
        lines += ["", contact]
        return lines.joined(separator: "\n")
    }
}
