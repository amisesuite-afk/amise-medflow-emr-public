import Foundation

// MARK: - Diagnosis radiation: patient-specific safety filter
//
// The radiation cards are written for a non-pregnant adult with no allergies. Before a card is
// shown for a patient, this filter adapts it (clinical validation 2026-09; SURGEON-DECISIONS A3,
// A4, A14, A22, C5, C7, G2.1, G2.2, G2.6, G2.11, G2.12):
//   - Under-16s: every adult dose is replaced by "weight-based dosing — calculate per BNFc"
//     (no invented paediatric numbers).
//   - Pregnancy (PregnancyContext): NSAIDs are removed from 20 weeks (MHRA 2020 / NICE); DOACs and
//     warfarin are replaced by LMWH (RCOG Green-top 37a/37b); ACE inhibitors / ARBs are removed
//     (NICE NG133); fluoroquinolones and tetracyclines are removed (BNF; NICE NG111 uses
//     cefalexin in pregnancy); ionising imaging is annotated "ultrasound / MRI where it answers
//     the question"; an obstetric handover line leads the plan.
//   - Allergies: plan lines naming a drug the patient is allergic to — or a drug of the same class
//     (penicillins, cephalosporins, NSAIDs, macrolides, fluoroquinolones, sulfonamides,
//     tetracyclines, opioids, contrast) — are removed and replaced by an allergy warning. After a
//     severe / immediate penicillin reaction, cephalosporin lines are removed too (BNF).
//   - Antithrombotics: procedural cards get a procedure-specific peri-procedural plan (no routine
//     bridging; DOAC interruption per PAUSE; BSG/ESGE 2021 endoscopy table; coronary stent
//     windows per ESC/ESAIC 2022) instead of a blanket "hold / bridge".
// Everything stays a suggestion; the clinician edits before anything is saved.

struct RadiationContext {
    var ageYears: Int?
    var pregnancy: PregnancyContext = .none
    var allergies: [AllergyEntry] = []
    var medications: [String] = []
    var pmhText: String = ""

    var isChild: Bool { (ageYears ?? 99) < 16 }

    init(ageYears: Int? = nil, pregnancy: PregnancyContext = .none, allergies: [AllergyEntry] = [],
         medications: [String] = [], pmhText: String = "") {
        self.ageYears = ageYears
        self.pregnancy = pregnancy
        self.allergies = allergies
        self.medications = medications
        self.pmhText = pmhText
    }

    init(patient p: Patient) {
        self.init(ageYears: p.dateOfBirth == nil ? nil : p.ageYears,
                  pregnancy: PregnancyContext.detect(patient: p),
                  allergies: p.allergies.filter { $0.name != Patient.nkdaMarkerName },
                  medications: p.prescriptions.map { $0.drug },
                  pmhText: NegationMatcher.joinClauses(p.pmhEntries.map { Optional($0.condition) } + [p.pmhNotes, p.surgicalHistory]))
    }
}

extension DiagnosisRadiationEngine {

    /// The card for this patient: the diagnosis lookup plus the safety filter.
    static func radiate(for patient: Patient) -> DiagnosisRadiation? {
        radiate(workingDiagnosis: patient.workingDiagnosis, ageYears: patient.ageYears, sex: patient.sex,
                context: RadiationContext(patient: patient))
    }

    static let bnfcDose = "weight-based dosing — calculate per BNFc"

    // MARK: Drug classes (allergy cross-check and pregnancy filter)

    static let drugClasses: [(name: String, members: [String])] = [
        ("penicillin", ["penicillin", "amoxicillin", "amoxycillin", "co-amoxiclav", "augmentin", "flucloxacillin",
                        "piperacillin", "tazocin", "pip-tazo", "benzylpenicillin", "ampicillin", "phenoxymethylpenicillin",
                        "pivmecillinam", "temocillin", "ticarcillin"]),
        ("cephalosporin", ["cephalosporin", "cefalexin", "cephalexin", "cefuroxime", "ceftriaxone", "cefotaxime", "cefazolin",
                           "ceftazidime", "cefixime", "cefoxitin", "cefaclor", "cefepime"]),
        ("NSAID", ["nsaid", "ibuprofen", "diclofenac", "naproxen", "ketorolac", "indomethacin", "indometacin", "celecoxib",
                   "etoricoxib", "mefenamic", "ketoprofen", "piroxicam", "meloxicam"]),
        ("macrolide", ["macrolide", "clarithromycin", "erythromycin", "azithromycin"]),
        ("fluoroquinolone", ["fluoroquinolone", "quinolone", "ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin"]),
        ("sulfonamide", ["sulfonamide", "sulphonamide", "co-trimoxazole", "cotrimoxazole", "sulfamethoxazole", "sulfasalazine"]),
        ("tetracycline", ["tetracycline", "doxycycline", "minocycline", "lymecycline"]),
        ("opioid", ["opioid", "opiate", "morphine", "codeine", "tramadol", "oxycodone", "fentanyl", "pethidine", "diamorphine"]),
        ("iodinated contrast", ["contrast", "iodine", "iodinated"]),
    ]

    /// Lines that already say NOT to use the drug ("avoid NSAIDs", "stop NSAIDs", "if NSAID
    /// contraindicated") are left as written.
    private static let exemptionWords = ["avoid", "stop nsaid", "stop the", "stopped", "contraindicated", "instead of", "do not",
                                         "withhold", "omit", "discontinue", "if allergic", "allergy", "no doac", "no warfarin"]

    // MARK: Filter

    static func applySafety(_ r: DiagnosisRadiation, _ c: RadiationContext) -> DiagnosisRadiation {
        var lines = r.planTemplate.components(separatedBy: "\n")
        var header: [String] = []

        // Allergy cross-check (class-aware).
        let allergyTerms = allergyClasses(c.allergies)
        if !allergyTerms.isEmpty {
            var flagged = 0
            lines = lines.map { line in
                let lower = line.lowercased()
                for a in allergyTerms {
                    if let hit = a.members.first(where: { termAppears($0, in: lower) }), !isExemption(lower) {
                        flagged += 1
                        return "\(indent(of: line))⚠ ALLERGY — \(a.label): \(hit) not suggested (\(a.reason)); choose an alternative (BNF / local antimicrobial guideline)."
                    }
                }
                return line
            }
            if flagged > 0 {
                header.append("- ALLERGY CROSS-CHECK: \(flagged) suggestion(s) removed — recorded \(c.allergies.map(\.name).joined(separator: ", ")).")
            }
        }

        // Pregnancy.
        if c.pregnancy.isPregnant {
            let weeks = c.pregnancy.gestationWeeks.map { " (\($0) weeks)" } ?? ""
            header.append("- PREGNANT\(weeks): inform the obstetric team; plan checked for pregnancy safety — no NSAIDs from 20 weeks, LMWH not DOACs or warfarin, no ACE inhibitors/ARBs, avoid ionising imaging where ultrasound or MRI answers the question.")
            lines = lines.map { pregnancyLine($0, c.pregnancy) }
        }

        // Peri-procedural antithrombotics (procedural cards only).
        if r.consentCategory != nil, let plan = antithromboticPlan(medications: c.medications, pmh: c.pmhText) {
            lines.append(contentsOf: plan)
        }

        var plan = (header + lines).joined(separator: "\n")
        var investigations = r.investigations
        var redFlags = r.redFlags
        var urgency = r.urgencyNote
        var followUp = r.followUp
        var referrals = r.referralSuggestions

        if c.pregnancy.isPregnant {
            investigations = investigations.map { inv in
                guard isIonisingImaging(inv.name) else { return inv }
                return .init(name: inv.name, category: inv.category,
                             rationale: inv.rationale + " — PREGNANCY: use ultrasound / MRI where it answers the question; if CT is essential, discuss with radiology.")
            }
        }

        if c.isChild {
            if r.conditionName.lowercased().contains("hernia") {
                // Children: herniotomy by a paediatric surgeon — adult mesh repairs and trusses do
                // not apply (SURGEON-DECISIONS A22; EHS / British Association of Paediatric Surgeons).
                plan = plan.components(separatedBy: "\n")
                    .filter { l in !["truss", "mesh", "tep", "tapp", "lichtenstein"].contains { keywordMatches($0, in: l.lowercased()) } }
                    .joined(separator: "\n")
                plan += "\n- CHILD: paediatric hernia — refer to a paediatric surgeon for herniotomy (no mesh, no truss); infants need early repair because of the incarceration risk."
            }
            plan = suppressAdultDoses(plan)
            redFlags = redFlags.map { suppressAdultDoses($0) }
            urgency = urgency.map { suppressAdultDoses($0) }
            followUp = suppressAdultDoses(followUp)
            referrals = referrals.map {
                .init(specialty: $0.specialty, urgency: $0.urgency, reason: suppressAdultDoses($0.reason),
                      notes: $0.notes.map { suppressAdultDoses($0) })
            }
            plan = "- CHILD (under 16): adult doses removed — \(bnfcDose); paediatric team / paediatric surgical input.\n" + plan
        }

        return DiagnosisRadiation(
            conditionName: r.conditionName, icd10Primary: r.icd10Primary, investigations: investigations,
            planTemplate: plan, billingCodes: r.billingCodes, consentCategory: r.consentCategory,
            urgencyNote: urgency, redFlags: redFlags, followUp: followUp,
            guidelineReference: r.guidelineReference, scoringCriteria: r.scoringCriteria,
            referralSuggestions: referrals)
    }

    /// Free-text plan drafts (SOAPDraftEngine): the same child-dose and pregnancy rules as the
    /// cards, applied line by line.
    static func draftPlanSafety(_ plan: String, context c: RadiationContext) -> String {
        var text = plan
        if c.pregnancy.isPregnant {
            text = text.components(separatedBy: "\n").map { pregnancyLine($0, c.pregnancy) }.joined(separator: "\n")
            let weeks = c.pregnancy.gestationWeeks.map { " (\($0) weeks)" } ?? ""
            text = "PREGNANT\(weeks): obstetric team informed; drugs and imaging checked for pregnancy safety.\n" + text
        }
        if c.isChild { text = suppressAdultDoses(text) }
        return text
    }

    // MARK: Allergy helpers

    private struct AllergyTerms {
        let label: String
        let reason: String
        let members: [String]
    }

    private static func allergyClasses(_ allergies: [AllergyEntry]) -> [AllergyTerms] {
        var out: [AllergyTerms] = []
        for a in allergies {
            let name = a.name.lowercased()
            let reaction = a.reaction.lowercased()
            let reason = [a.severity, a.reaction].filter { !$0.isEmpty }.joined(separator: ": ")
            var matchedClass = false
            for cls in drugClasses where cls.members.contains(where: { name.contains($0) }) || name.contains(cls.name.lowercased()) {
                matchedClass = true
                out.append(AllergyTerms(label: "\(a.name) (\(cls.name) class)", reason: reason, members: cls.members))
                // BNF: after an immediate / severe penicillin reaction, avoid cephalosporins too.
                let immediate = a.severity.lowercased() == "severe"
                    || ["anaphyla", "angio", "urticaria", "hives", "collapse", "bronchospasm", "swelling"].contains { reaction.contains($0) }
                if cls.name == "penicillin" && immediate {
                    if let ceph = drugClasses.first(where: { $0.name == "cephalosporin" }) {
                        out.append(AllergyTerms(label: "\(a.name) (immediate reaction — cephalosporins avoided, BNF)",
                                                reason: reason, members: ceph.members))
                    }
                }
            }
            if !matchedClass, name.count >= 4 {
                out.append(AllergyTerms(label: a.name, reason: reason, members: [name]))
            }
        }
        return out
    }

    private static func termAppears(_ term: String, in lower: String) -> Bool {
        keywordMatches(term, in: lower)
    }

    private static func isExemption(_ lower: String) -> Bool {
        exemptionWords.contains { lower.contains($0) }
    }

    private static func indent(of line: String) -> String {
        let prefix = line.prefix { $0 == " " || $0 == "-" || $0 == "•" }
        return prefix.isEmpty ? "- " : String(prefix)
    }

    // MARK: Pregnancy helpers

    private static func pregnancyLine(_ line: String, _ p: PregnancyContext) -> String {
        let lower = line.lowercased()
        guard !isExemption(lower) else { return line }
        func has(_ terms: [String]) -> Bool { terms.contains { keywordMatches($0, in: lower) } }
        let nsaids = drugClasses.first { $0.name == "NSAID" }?.members ?? []
        if p.atOrBeyond20Weeks, has(nsaids) {
            return "\(indent(of: line))⚠ PREGNANCY (≥20 weeks): NSAID removed — NSAIDs are avoided from 20 weeks (MHRA 2020; NICE); use paracetamol, opioid if needed."
        }
        if has(["apixaban", "rivaroxaban", "edoxaban", "dabigatran", "doac", "doacs", "warfarin"]) {
            return "\(indent(of: line))⚠ PREGNANCY: DOAC / warfarin removed — treatment-dose LMWH by weight instead (RCOG Green-top 37a/37b); obstetric haematology input."
        }
        if has(["ace inhibitor", "ace-i", "acei", "ramipril", "lisinopril", "enalapril", "perindopril", "losartan", "candesartan",
                "valsartan", "irbesartan", "arb"]) {
            return "\(indent(of: line))⚠ PREGNANCY: ACE inhibitor / ARB removed (contraindicated, NICE NG133) — obstetric team to choose labetalol, nifedipine or methyldopa."
        }
        if has(["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin", "fluoroquinolone", "doxycycline", "tetracycline"]) {
            return "\(indent(of: line))⚠ PREGNANCY: fluoroquinolone / tetracycline removed (BNF) — e.g. cefalexin for pyelonephritis in pregnancy (NICE NG111); obstetric input."
        }
        if (p.gestationWeeks ?? 0) < 13, has(["trimethoprim"]) {
            return "\(indent(of: line))⚠ PREGNANCY (first trimester / gestation unknown): trimethoprim removed (folate antagonist, BNF; NICE NG109)."
        }
        if has(["methotrexate"]) {
            return "\(indent(of: line))⚠ PREGNANCY: methotrexate only within an early-pregnancy (ectopic) protocol by gynaecology; never when ruptured (NICE NG126)."
        }
        if isIonisingImaging(lower) {
            return line + " — PREGNANCY: ultrasound / MRI where it answers the question; if CT is essential, discuss with radiology."
        }
        return line
    }

    static func isIonisingImaging(_ text: String) -> Bool {
        let lower = text.lowercased()
        return ["ct", "ctpa", "cect", "cta", "x-ray", "xray", "radiograph", "cxr", "axr", "fluoroscopy", "contrast study",
                "barium", "ivu", "kub x"].contains { keywordMatches($0, in: lower) }
    }

    // MARK: Paediatric dose suppression

    private static let doseRegex: NSRegularExpression? = try? NSRegularExpression(
        pattern: #"\b\d+(?:[.,]\d+)?(?:\s*(?:–|-|to)\s*\d+(?:[.,]\d+)?)?\s*(?:mg|g|mcg|µg|micrograms?|units?|iu|ml|mmol|meq)\b(?!\s*/\s*(?:l|dl|min|m2|m²)\b)(?:\s*/\s*kg)?(?:\s*/\s*(?:h|hr|hour|day|d|24\s*h)\b)?"#,
        options: [.caseInsensitive])

    /// Replaces adult doses in a text with the BNFc instruction. Urine-output targets and lab
    /// thresholds are not doses and are kept.
    static func suppressAdultDoses(_ text: String) -> String {
        guard let re = doseRegex else { return text }
        return text.components(separatedBy: "\n").map { line -> String in
            let lower = line.lowercased()
            if lower.contains("urine output") || lower.contains(" uo ") { return line }
            let ns = line as NSString
            let matches = re.matches(in: line, range: NSRange(location: 0, length: ns.length))
            guard !matches.isEmpty else { return line }
            var out = line
            for m in matches.reversed() {
                guard let range = Range(m.range, in: out) else { continue }
                out.replaceSubrange(range, with: "[dose: \(bnfcDose)]")
            }
            // Collapse repeated placeholders ("[…] to […]", "[…] / […]").
            while let r = out.range(of: "[dose: \(bnfcDose)] [dose: \(bnfcDose)]") {
                out.replaceSubrange(r, with: "[dose: \(bnfcDose)]")
            }
            return out
        }.joined(separator: "\n")
    }

    // MARK: Peri-procedural antithrombotics

    /// A procedure-specific antithrombotic plan when the patient takes an anticoagulant or
    /// antiplatelet (nil otherwise). Sources: BRIDGE (NEJM 2015) and ACCP 2022 — no routine
    /// bridging for AF; PAUSE (JAMA IM 2019) — DOAC interruption without bridging; BSG/ESGE 2021 —
    /// antithrombotics and endoscopy; ESC/ESAIC 2022 — coronary stents and non-cardiac surgery.
    static func antithromboticPlan(medications: [String], pmh: String) -> [String]? {
        let meds = medications.joined(separator: " ").lowercased()
        let doac = ["apixaban", "rivaroxaban", "edoxaban", "dabigatran"].filter { meds.contains($0) }
        let warfarin = meds.contains("warfarin") || meds.contains("acenocoumarol")
        let p2y12 = ["clopidogrel", "prasugrel", "ticagrelor"].filter { meds.contains($0) }
        let aspirin = meds.contains("aspirin")
        guard !doac.isEmpty || warfarin || !p2y12.isEmpty || aspirin else { return nil }
        let pmhLower = pmh.lowercased()
        var out = ["- PERI-PROCEDURAL ANTITHROMBOTIC PLAN (procedure-specific; decide with the prescriber):"]
        if !doac.isEmpty {
            out.append("  • \(doac.joined(separator: ", ")): no bridging. Omit 1 day before low-bleeding-risk and 2 days before high-bleeding-risk procedures (PAUSE); dabigatran longer when creatinine clearance is reduced. Restart 1 day (low risk) or 2–3 days (high risk) after, once haemostasis is secure.")
        }
        if warfarin {
            let highThrombotic = ["mechanical", "mitral valve replacement", "metallic valve", "vte within 3 months", "recent stroke"]
                .contains { pmhLower.contains($0) || meds.contains($0) }
            out.append("  • Warfarin: for high-bleeding-risk procedures stop 5 days before and check INR the day before; low-risk diagnostic endoscopy — continue (check INR in range).")
            out.append(highThrombotic
                ? "  • High thrombotic risk (mechanical mitral valve / recent VTE or stroke): LMWH bridging decided with haematology/cardiology (BSG/ESGE 2021; ACCP 2022)."
                : "  • No LMWH bridging for most atrial fibrillation (BRIDGE; ACCP 2022) — bridge only for high thrombotic risk (mechanical mitral valve, VTE within 3 months).")
        }
        if !p2y12.isEmpty {
            out.append("  • \(p2y12.joined(separator: ", ")): continue for low-risk diagnostic endoscopy; stop 5–7 days before high-risk procedures (polypectomy / EMR, sphincterotomy, surgery) and continue aspirin (BSG/ESGE 2021).")
        }
        if aspirin {
            out.append("  • Aspirin: usually continue (stop only for very high-bleeding-risk procedures, e.g. ESD, with specialist agreement).")
        }
        let stent = ["stent", "pci", "des ", "drug-eluting", "angioplasty", "nstemi", "stemi", "acute coronary"].contains { pmhLower.contains($0) }
        if stent || !p2y12.isEmpty {
            out.append("  • CORONARY STENT: do not stop P2Y12 inhibitors within 6 months of elective PCI or 12 months of ACS without cardiology agreement — defer elective procedures in that window (ESC/ESAIC 2022).")
        }
        return out
    }
}
