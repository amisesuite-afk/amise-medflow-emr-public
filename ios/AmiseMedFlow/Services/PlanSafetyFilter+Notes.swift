import Foundation

// MARK: - Plan safety filter: patient-specific safety lines
//
// DRIFT NOTE: twin of the note builders in `lib/pane-engine/src/management/planSafety.ts`
// (anticoagulationNotes, diabetesNotes, steroidNote, anaestheticNotes, vteNote, pregnancyNotes,
// paediatricNotes, frailtyNote, highRiskSurgeryNote, oestrogenNote, immunosuppressionNote,
// betaBlockerNote). Wording and sources follow the web; change both together.

extension PlanSafetyFilter {

    /// How the plan the notes go with was built.
    struct PlanShape {
        /// A card with a consent category (operation or procedure planned).
        var operative = false
        /// A medical / obstetric / paediatric emergency card (recognise and redirect): no procedure.
        var emergencyCard = false
        /// A bleeding card (GI bleed, haemorrhage, variceal).
        var bleedingCard = false
        /// The card carries an urgency note (acute presentation).
        var acuteCard = false
        /// An obstetric card (drugs already chosen for pregnancy).
        var pregnancySpecific = false
        /// A cancer card (28-day VTE prophylaxis after major abdominal / pelvic surgery).
        var cancer = false
        /// A thrombosis card (DVT, PE, mesenteric venous thrombosis).
        var thrombosis = false
        /// Ionising imaging among the suggested investigations.
        var ionisingImaging = false
        /// Investigation names already suggested (lowercased), to avoid duplicates.
        var investigationText = ""
    }

    struct Evaluation {
        var notes: [Note]
        var procedure: ProcedureKind
        /// Investigations the patient's medicines or status add (name, rationale).
        var extraInvestigations: [(name: String, rationale: String)]
    }

    static func evaluate(_ s: Signals, shape: PlanShape) -> Evaluation {
        let procedural = !shape.emergencyCard
        let proc: ProcedureKind = shape.emergencyCard ? .none : procedure(s, operative: shape.operative)
        let bleeding = shape.bleedingCard || activeBleeding(s)
        let acuteIllness = shape.emergencyCard || shape.bleedingCard || shape.acuteCard || findingPresent(s.assessment, acuteIllnessText)
        let emergency = emergencyText(s)

        var notes: [Note] = []
        notes += paediatricNotes(s)
        notes += pregnancyNotes(s, shape: shape, operative: proc == .surgery || proc == .endoscopyHigh)
        notes += anticoagulationNotes(s, procedure: proc, bleeding: bleeding && !shape.emergencyCard, emergency: emergency)
        notes += diabetesNotes(s, procedure: proc, acuteIllness: acuteIllness)
        if let n = steroidNote(s, procedure: proc, acuteIllness: acuteIllness) { notes.append(n) }
        if proc != .none { notes += anaestheticNotes(s) }
        // iOS addition: the clinician asks about VTE prophylaxis in the assessment ("VTE
        // prophylaxis decision", "day 1 after under-running …") — give the NICE NG89 line.
        let vteAsked = test(#"\b(vte prophylaxis|thromboprophylaxis|vte risk|caprini)\b"#, s.assessment)
        if (proc == .surgery && procedural) || (bleeding && procedural && shape.operative) || (vteAsked && !shape.emergencyCard) {
            if let n = vteNote(s, shape: shape, bleeding: bleeding) { notes.append(n) }
        }
        if proc != .none || acuteIllness, let n = frailtyNote(s) { notes.append(n) }
        if proc == .surgery, let n = highRiskSurgeryNote(s, emergency: emergency) { notes.append(n) }
        if let n = oestrogenNote(s, shape: shape, procedure: proc) { notes.append(n) }
        if let n = immunosuppressionNote(s, acuteIllness: acuteIllness) { notes.append(n) }
        if acuteIllness, let n = betaBlockerNote(s) { notes.append(n) }
        if s.allergy.classes.contains(where: { $0.id == "penicillin" }) && !s.allergy.immediatePenicillin,
           let cls = s.allergy.classes.first(where: { $0.id == "penicillin" }), let text = cls.cautionText {
            notes.append(Note(kind: .allergy, severity: .warning, text: text))
        }
        notes.sort { $0.severity < $1.severity }

        var extra: [(name: String, rationale: String)] = []
        let inv = shape.investigationText
        let type1 = test(#"\btype\s*(?:1|i)\s+diabet|\bt1dm\b|\biddm\b"#, s.text)
        if proc != .none && (type1 || !drugsPresent(s.meds, insulins).isEmpty) && !inv.contains("ketone") {
            extra.append((name: "Capillary blood glucose and blood ketones", rationale: "Insulin-treated diabetes — CPOC 2021"))
        }
        if proc != .none, s.female, let age = s.age, age >= 12, age <= 55, s.pregnancy == .unknown,
           !inv.contains("hcg"), !inv.contains("pregnan") {
            extra.append((name: "Pregnancy test (urine or serum β-hCG) — result required", rationale: "Before surgery or ionising imaging (NICE NG45)"))
        }
        let onVKA = !drugsPresent(s.meds, vka).isEmpty
        if onVKA && (proc != .none || bleeding) && !inv.contains("inr") && !inv.contains("coagulation") {
            extra.append((name: "INR (warfarin)", rationale: bleeding ? "Reversal decision (BSH; BSG/ESGE 2021)" : "Day before the procedure — proceed when < 1.5 (BSG/ESGE 2021; ACCP 2022)"))
        }
        // NICE NG45 (web-last-gaps): haemostasis tests before surgery only with liver disease,
        // heparin, a bleeding disorder, jaundice or an emergency operation (warfarin: the INR above).
        if proc == .surgery && !onVKA && coagulationIndicated(s, emergency: emergency)
            && !["inr", "coagulation", "clotting", "aptt", "prothrombin"].contains(where: { inv.contains($0) }) {
            extra.append((name: "Clotting screen (PT/INR, APTT)", rationale: "NICE NG45: liver disease, heparin, a bleeding disorder, jaundice or an emergency operation"))
        }
        if !drugsPresent(s.meds, doacs).isEmpty && (proc != .none || bleeding)
            // "U&E" alone does not prompt the creatinine clearance the DOAC timing needs.
            && !inv.contains("renal function") && !inv.contains("creatinine") && !inv.contains("egfr") && !inv.contains("crcl") {
            extra.append((name: "Renal function (creatinine, eGFR / creatinine clearance)", rationale: "DOAC interruption timing depends on CrCl (PAUSE 2019; BSG/ESGE 2021)"))
        }
        return Evaluation(notes: notes, procedure: proc, extraInvestigations: extra)
    }

    /// The notes as plan lines ("- PATIENT-SPECIFIC SAFETY CHECKS …" then one line per note).
    static func planLines(_ notes: [Note]) -> [String] {
        guard !notes.isEmpty else { return [] }
        return ["- PATIENT-SPECIFIC SAFETY CHECKS (review before acting):"]
            + notes.map { "- [\($0.severity.label)] \($0.text)" }
    }

    // MARK: Anticoagulants / antiplatelets

    static func anticoagulationNotes(_ s: Signals, procedure: ProcedureKind, bleeding: Bool, emergency: Bool) -> [Note] {
        var notes: [Note] = []
        let vkaFound = drugsPresent(s.meds, vka)
        let doac = drugsPresent(s.meds, doacs)
        let p2 = drugsPresent(s.meds, p2y12)
        let asp = drugsPresent(s.meds, aspirin)
        let mechanicalValve = test(#"\bmechanical\s+(?:heart\s+|mitral\s+|aortic\s+)?valve|\bmechanical\s+(?:mvr|avr)\b|metallic valve"#, s.text)
        let stent = stentInfo(s.text)

        if bleeding {
            if let v = vkaFound.first {
                notes.append(Note(kind: .anticoagulation, severity: .critical,
                    text: "Anticoagulant-associated bleeding (\(vkaFound.joined(separator: ", "))): withhold \(v) and check the INR now. Major or life-threatening bleeding: reverse with IV vitamin K (phytomenadione) 5 mg plus four-factor prothrombin complex concentrate, dosed by INR and weight (BSH warfarin guideline; BSG/ESGE 2021). No heparin substitution while bleeding. Plan when to restart \(v) with the specialist once haemostasis is secure (BSG/ESGE 2021: about 7 days after GI bleeding; earlier if thrombotic risk is high)."))
            }
            if let d = doac.first {
                notes.append(Note(kind: .anticoagulation, severity: .critical,
                    text: "Anticoagulant-associated bleeding (\(doac.joined(separator: ", "))): withhold \(d); record the time of the last dose and check renal function. Major or life-threatening bleeding: reversal — \(d == "dabigatran" ? "idarucizumab" : "andexanet alfa (where available) or prothrombin complex concentrate"); seek haematology advice (BSG/ESGE 2021; BSH). No heparin substitution while bleeding. Plan when to restart the anticoagulant once haemostasis is secure."))
            }
            if !p2.isEmpty || !asp.isEmpty {
                notes.append(Note(kind: .antiplatelet, severity: .warning,
                    text: "Antiplatelet therapy (\((p2 + asp).joined(separator: ", "))) with bleeding: aspirin for secondary prevention should not be stopped routinely, or should be restarted as soon as haemostasis is achieved; withhold \(p2.isEmpty ? "other antiplatelets" : p2.joined(separator: "/")) and discuss with cardiology if there is a coronary stent or recent ACS (BSG/ESGE 2021; ESGE 2021 NVUGIH)."))
            }
            return notes
        }

        // An injury on an anticoagulant (fall, head injury, fracture) is not an elective
        // peri-procedural question: exclude bleeding and keep reversal ready (web-last-gaps;
        // NICE NG232 2023; ACC 2020 ECDP). PlanSafetyFilter+PromptParity.swift.
        if let n = injuryOnAnticoagulantNote(s) { return [n] }

        if procedure == .none { return notes }

        if emergency && procedure == .surgery {
            if let v = vkaFound.first {
                notes.append(Note(kind: .anticoagulation, severity: .critical,
                    text: "Emergency surgery on \(v): check the INR now; if surgery cannot wait, reverse with IV vitamin K plus four-factor prothrombin complex concentrate dosed by INR and weight (BSH warfarin guideline). No bridging; plan restart after surgery with the team."))
            }
            if let d = doac.first {
                notes.append(Note(kind: .anticoagulation, severity: .critical,
                    text: d == "dabigatran"
                        ? "Emergency surgery on dabigatran: record the time of the last dose and renal function; if surgery cannot wait, reverse with idarucizumab 5 g IV (ESC/ESAIC 2022). Plan restart after surgery."
                        : "Emergency surgery on \(d): record the time of the last dose and renal function, and send an anti-Xa level where available; if surgery cannot be delayed and the drug is likely active, discuss reversal with prothrombin complex concentrate with haematology — andexanet alfa is licensed for life-threatening bleeding, not for surgery (ESC/ESAIC 2022). Plan restart after surgery."))
            }
            if !p2.isEmpty {
                notes.append(Note(kind: .antiplatelet, severity: .warning,
                    text: "\(p2.joined(separator: "/")) before emergency surgery: record the last dose; platelet transfusion only for bleeding; discuss with cardiology if there is a recent coronary stent (ESC/ESAIC 2022)."))
            }
            return notes
        }

        let what = procedure == .surgery ? "surgery" : procedure == .endoscopyHigh ? "this high-risk endoscopic procedure" : "this low-risk endoscopic procedure"

        if stent.present && (!p2.isEmpty || !asp.isEmpty || stent.months != nil) {
            let window: Double = stent.acs ? 12 : 6
            let inWindow = stent.months.map { $0 < window } ?? (!p2.isEmpty && !asp.isEmpty)
            if inWindow && procedure != .endoscopyLow {
                let about = stent.months.map { " (about \(Int($0.rounded())) months)" } ?? ""
                notes.append(Note(kind: .antiplatelet, severity: .critical,
                    text: "Recent coronary stent\(about)\(stent.acs ? " after an acute coronary syndrome" : ""): defer elective \(procedure == .surgery ? "surgery" : "polypectomy / high-risk procedure") until \(Int(window)) months after \(stent.acs ? "the ACS" : "elective PCI") unless cardiology agrees; do not stop dual antiplatelet therapy without cardiology input (ESC/ESAIC 2022 non-cardiac surgery; BSG/ESGE 2021)."))
            }
        }

        if let v = vkaFound.first {
            if procedure == .endoscopyLow {
                notes.append(Note(kind: .anticoagulation, severity: .warning,
                    text: "\(v) and \(what): continue \(v); check the INR in the week before and, if above the therapeutic range, reduce the dose and recheck (BSG/ESGE 2021). No bridging."))
            } else if mechanicalValve {
                notes.append(Note(kind: .anticoagulation, severity: .critical,
                    text: "\(v) with a mechanical heart valve and \(what): stop \(v) 5 days before; bridging with LMWH (treatment dose) or UFH is indicated for a mechanical valve — plan with cardiology/haematology (ACC/AHA 2020 valvular heart disease; BSG/ESGE 2021). Check the INR the day before; resume \(v) the evening of the procedure or the next day if haemostasis is secure."))
            } else {
                notes.append(Note(kind: .anticoagulation, severity: .warning,
                    text: "\(v) and \(what): stop \(v) 5 days before; check the INR the day before (proceed when < 1.5). No bridging for most patients with atrial fibrillation (BRIDGE trial 2015; ACCP 2022 perioperative guideline); bridge with LMWH only for a mechanical valve, VTE within 3 months or a high-risk thrombophilia, with specialist advice. Resume \(v) the evening of the procedure or the next day at the usual dose if haemostasis is secure."))
            }
        }
        if let d = doac.first {
            let text: String
            if procedure == .endoscopyLow {
                text = "\(d) and \(what): omit the morning dose on the day of the procedure (BSG/ESGE 2021). No bridging."
            } else if procedure == .endoscopyHigh {
                text = "\(d) and \(what): stop \(d) 3 days before the procedure (last dose 3 days before\(d == "dabigatran" ? "; 5 days before if CrCl 30–50 mL/min" : "")); restart 2–3 days after if haemostasis is secure (BSG/ESGE 2021). No bridging."
            } else if d == "dabigatran" {
                text = "dabigatran and surgery (PAUSE 2019): CrCl ≥ 50 mL/min — omit 1 day before a low-bleed-risk and 2 days before a high-bleed-risk operation; CrCl 30–50 — 2 and 4 days. Resume 1 day after low-risk and 2–3 days after high-risk surgery. No bridging, no routine pre-operative coagulation test (ACCP 2022)."
            } else {
                text = "\(d) and surgery (PAUSE 2019): omit 1 day before a low-bleed-risk and 2 days before a high-bleed-risk operation (check renal function); resume 1 day after low-risk and 2–3 days after high-risk surgery. No bridging, no routine pre-operative coagulation test (ACCP 2022)."
            }
            notes.append(Note(kind: .anticoagulation, severity: .warning, text: text))
        }
        if let p = p2.first {
            if procedure == .endoscopyLow {
                notes.append(Note(kind: .antiplatelet, severity: .info, text: "\(p) and \(what): continue (BSG/ESGE 2021)."))
            } else if procedure == .endoscopyHigh {
                notes.append(Note(kind: .antiplatelet, severity: .warning,
                    text: "\(p) and \(what): if thrombotic risk is low, stop \(p) 7 days before and continue aspirin if prescribed; if there is a coronary stent within its high-risk window or other high thrombotic risk, liaise with cardiology first (BSG/ESGE 2021)."))
            } else {
                notes.append(Note(kind: .antiplatelet, severity: .warning,
                    text: "\(p) and surgery: if thrombotic risk allows, stop clopidogrel 5 days, ticagrelor 3–5 days or prasugrel 7 days before; continue aspirin; discuss with cardiology if there is a coronary stent or recent ACS (ESC/ESAIC 2022)."))
            }
        }
        if !asp.isEmpty && p2.isEmpty {
            notes.append(Note(kind: .antiplatelet, severity: .info,
                text: procedure == .surgery
                    ? "Low-dose aspirin for secondary prevention: usually continue through surgery unless the bleeding risk is prohibitive (e.g. intracranial, spinal) — ESC/ESAIC 2022."
                    : "Low-dose aspirin: continue for endoscopic procedures (BSG/ESGE 2021); discuss for ESD, large colonic EMR (> 2 cm) or ampullectomy."))
        }
        return notes
    }

    // MARK: Diabetes, steroids, anaesthetic hazards

    static func diabetesNotes(_ s: Signals, procedure: ProcedureKind, acuteIllness: Bool) -> [Note] {
        var notes: [Note] = []
        let sg = drugsPresent(s.meds, sglt2)
        if !sg.isEmpty {
            if acuteIllness {
                notes.append(Note(kind: .diabetes, severity: .critical,
                    text: "SGLT2 inhibitor (\(sg.joined(separator: ", "))) in acute illness: stop it now — risk of euglycaemic diabetic ketoacidosis; check blood ketones and a venous gas even if glucose is normal (MHRA 2016/2020; JBDS 2023)."))
            }
            if procedure != .none {
                notes.append(Note(kind: .diabetes, severity: .warning,
                    text: "SGLT2 inhibitor (\(sg.joined(separator: ", "))): withhold the day before and the day of the procedure (CPOC 2021; FDA labelling advises 3 days, 4 for ertugliflozin — surgeon to choose); check blood ketones before and after, even if glucose is normal; restart when eating and drinking normally."))
            }
        }
        if procedure != .none {
            let su = drugsPresent(s.meds, sulfonylureas)
            if !su.isEmpty {
                notes.append(Note(kind: .diabetes, severity: .info,
                    text: "Sulfonylurea (\(su.joined(separator: ", "))): omit on the day of the procedure; capillary glucose monitoring, target 6–12 mmol/L (CPOC 2021)."))
            }
            if !drugsPresent(s.meds, ["metformin"]).isEmpty {
                notes.append(Note(kind: .diabetes, severity: .info,
                    text: "Metformin: continue if only one meal is missed; omit if more than one meal will be missed, eGFR < 60 mL/min or IV contrast is planned (CPOC 2021)."))
            }
            let type1 = test(#"\btype\s*(?:1|i)\s+diabet|\bt1dm\b|\biddm\b"#, s.text)
            if type1 || !drugsPresent(s.meds, insulins).isEmpty {
                notes.append(Note(kind: .diabetes, severity: .warning,
                    text: "\(type1 ? "Type 1 diabetes" : "Insulin-treated diabetes"): continue basal (long-acting) insulin — never omit it; give 80% of the usual dose the evening before and on the day; variable-rate IV insulin if more than one meal will be missed; capillary glucose and ketone monitoring; first on the list where possible (CPOC 2021)."))
            }
        }
        return notes
    }

    static func steroidNote(_ s: Signals, procedure: ProcedureKind, acuteIllness: Bool) -> Note? {
        let st = drugsPresent(s.meds, steroids)
        guard !st.isEmpty, procedure != .none || acuteIllness else { return nil }
        return Note(kind: .steroid, severity: .warning,
            text: "Long-term glucocorticoid (\(st.joined(separator: ", "))): do not stop it. If ≥ 5 mg prednisolone (or equivalent) for > 4 weeks, give steroid cover — hydrocortisone 100 mg IV at induction or at the start of the acute illness, then 200 mg/24 h (infusion, or 50 mg IV/IM 6-hourly) while unwell or nil by mouth, then double the usual oral dose for 48 h (AAGBI/Society for Endocrinology 2020).")
    }

    static func anaestheticNotes(_ s: Signals) -> [Note] {
        var notes: [Note] = []
        if s.allergy.latex {
            notes.append(Note(kind: .anaesthetic, severity: .critical, text: "Latex allergy: latex-free theatre, ward and equipment; schedule first on the list; alert the theatre team and anaesthetist (NAP6 2018)."))
        }
        if s.allergy.chlorhexidine {
            notes.append(Note(kind: .anaesthetic, severity: .critical, text: "Chlorhexidine allergy: use an alternative skin preparation and chlorhexidine-free catheters, lines and lubricants; alert the theatre team (NAP6 2018; MHRA 2012)."))
        }
        if test(#"\bmalignant hyperthermia|\bmh[- ]?susceptib\w*|\bmhs\b"#, s.text) {
            notes.append(Note(kind: .anaesthetic, severity: .critical, text: "Malignant hyperthermia susceptibility (personal or family history): trigger-free anaesthesia — avoid volatile agents and suxamethonium (TIVA); dantrolene immediately available; refer to the MH unit for testing if not done (AAGBI malignant hyperthermia guideline 2011; EMHG 2020)."))
        }
        if test(#"suxamethonium apnoea|suxamethonium apnea|scoline apnoea|succinylcholine apn\w*|butyrylcholinesterase|pseudocholinesterase|cholinesterase deficiency"#, s.text) {
            notes.append(Note(kind: .anaesthetic, severity: .critical, text: "Suxamethonium apnoea history: avoid suxamethonium and mivacurium (e.g. rocuronium with sugammadex available); alert the anaesthetist; butyrylcholinesterase testing and family screening (RCoA guidance)."))
        }
        let stopBang = capture(#"stop-?bang\s*(?:score\s*)?(?:of\s*|=\s*|:\s*)?([0-8])"#, s.text).flatMap { Int($0) }
        if test(#"\bosa\b|obstructive sleep ap"#, s.text) || (stopBang ?? 0) >= 5 {
            notes.append(Note(kind: .anaesthetic, severity: .warning, text: "Known or suspected obstructive sleep apnoea (STOP-Bang ≥ 5): anaesthetic review before listing; bring CPAP; opioid-sparing analgesia; continuous pulse oximetry after surgery; consider a sleep study (SAMBA 2012; ASA 2014)."))
        }
        return notes
    }

    // MARK: VTE, pregnancy, children, frailty

    static func vteNote(_ s: Signals, shape: PlanShape, bleeding: Bool) -> Note? {
        if s.child { return nil } // NICE NG89 covers people aged 16 and over.
        let anticoagulated = !drugsPresent(s.meds, vka + doacs).isEmpty
        // Pharmacological part by renal function (web operative templates, web-last-gaps: dialysis
        // is checked first, and the renally adjusted lines carry no enoxaparin 40 mg example).
        let pharmacological: String
        if test(#"\b(dialysis|haemodialysis|hemodialysis|esrf|eskd)\b"#, s.text) {
            pharmacological = "plus pharmacological prophylaxis dose-adjusted for renal failure — unfractionated heparin 5000 units SC 8–12-hourly or a renally adjusted LMWH on dialysis, per the renal team / local protocol (BNF)"
        } else if let e = s.egfr, e < 30 {
            pharmacological = "plus LMWH dose-adjusted for renal function — eGFR/CrCl \(Int(e.rounded())) mL/min: enoxaparin 20 mg SC once daily or unfractionated heparin (BNF)"
        } else {
            pharmacological = "plus LMWH — e.g. enoxaparin 40 mg SC once daily, dose-adjust in renal impairment — CrCl < 30 mL/min: 20 mg once daily (BNF)"
        }
        var parts = ["VTE prophylaxis (NICE NG89): assess VTE and bleeding risk on admission and after surgery (NG89, 2018)."]
        if bleeding {
            parts.append("Active bleeding / high bleeding risk: mechanical prophylaxis (intermittent pneumatic compression) now; start LMWH once haemostasis is secure — reassess daily.")
        } else if anticoagulated {
            parts.append("On therapeutic anticoagulation: see the anticoagulation plan; while it is interrupted after surgery use mechanical prophylaxis and prophylactic-dose LMWH when bleeding risk allows.")
        } else {
            parts.append("Mechanical prophylaxis (anti-embolism stockings or intermittent pneumatic compression) unless contraindicated (e.g. peripheral arterial disease), \(pharmacological) — from 6–12 h after surgery if bleeding risk allows, for at least 7 days.")
        }
        if shape.cancer {
            parts.append("Major abdominal or pelvic cancer surgery: extend pharmacological prophylaxis to 28 days after surgery.")
        }
        if s.pregnancy == .pregnant { parts.append("Pregnant: LMWH dose by booking weight (RCOG Green-top 37a 2015).") }
        return Note(kind: .vte, severity: .warning, text: parts.joined(separator: " "))
    }

    static func pregnancyNotes(_ s: Signals, shape: PlanShape, operative: Bool) -> [Note] {
        if s.pregnancy == .pregnant && !shape.pregnancySpecific {
            let g = s.gestationWeeks.map { "\($0) weeks" } ?? "gestation not recorded"
            var parts = ["Pregnant (\(g)): involve the obstetric team now; fetal heart / CTG monitoring as the obstetric team advises (from viability, about 24 weeks)."]
            if (s.gestationWeeks ?? 20) >= 20 {
                parts.append("From 20 weeks: left lateral tilt or manual uterine displacement whenever supine (aortocaval compression); no NSAIDs.")
            }
            parts.append("Prefer ultrasound or MRI to CT where they answer the question; anticoagulation with LMWH — DOACs and warfarin are contraindicated in pregnancy (warfarin is teratogenic) (RCOG GTG 37a/b).")
            if operative, (s.gestationWeeks.map { $0 >= 24 && $0 < 34 } ?? true) {
                parts.append("If 24–34 weeks and preterm delivery is possible, the obstetric team to consider antenatal corticosteroids.")
            }
            parts.append("(ACOG Committee Opinions 775 (2019) and 723 (2017); RCOG Green-top 37a.)")
            return [Note(kind: .pregnancy, severity: .critical, text: parts.joined(separator: " "))]
        }
        if s.pregnancy == .unknown, s.female, let age = s.age, age >= 12, age <= 55, operative || shape.ionisingImaging {
            return [Note(kind: .pregnancy, severity: .warning,
                         text: "β-HCG: result required before surgery, ionising imaging or a drug that is unsafe in pregnancy — do not record it as negative without a result.")]
        }
        return []
    }

    static func paediatricNotes(_ s: Signals) -> [Note] {
        guard s.child else { return [] }
        var notes = [Note(kind: .paediatric, severity: .critical,
                          text: "Under 16 (\(s.age.map { "\($0) years" } ?? "age not recorded")): adult doses removed — all doses and fluid volumes are weight-based; calculate per BNFc (fluids per APLS). Paediatric vital-sign ranges apply.")]
        if s.infant {
            notes.append(Note(kind: .paediatric, severity: .critical,
                              text: "Infant: recognise and redirect — same-day paediatric surgical / paediatric emergency assessment; adult templates do not apply."))
        }
        return notes
    }

    /// Frailty or cognitive impairment with a procedure or acute illness (CPOC 2021; NICE CG103).
    static func frailtyNote(_ s: Signals) -> Note? {
        let m = capture(#"\b(frail\w*|cfs\s*[5-9]|clinical frailty scale\s*[5-9]|dementia|cognitive impairment|previous (?:post-?operative )?delirium|delirium)\b"#, s.text)
        let old = (s.age ?? 0) >= 80
        guard (m != nil && (s.age.map { $0 >= 65 } ?? true)) || old else { return nil }
        let what = m ?? "age \(s.age ?? 0)"
        return Note(kind: .frailty, severity: .warning,
            text: "Frailty / delirium risk (\(what)\(s.age.map { ", age \($0)" } ?? "")): delirium prevention and 4AT screening (NICE CG103); comprehensive geriatric assessment and elderly-medicine (geriatric) input; shared decision-making with goals of care and a treatment-escalation plan documented (CPOC 2021 perioperative care for people living with frailty).")
    }

    static func highRiskSurgeryNote(_ s: Signals, emergency: Bool) -> Note? {
        // iOS: read the assessment with "day 3 after laparotomy" / "post-laparotomy" removed, so a
        // past operation does not raise the planned-emergency-laparotomy line.
        let planned = replaceAll(notAPlannedOperation, in: s.assessment, with: " ")
        guard emergency, test(#"\b(emergency (?:laparotomy|laparoscopy|surgery|operation|repair|resection|hartmann\w*)|laparotomy)\b"#, planned) else { return nil }
        return Note(kind: .surgicalRisk, severity: .warning,
            text: "Emergency laparotomy / high-risk surgery: document the predicted mortality risk pre-operatively (NELA risk calculator or P-POSSUM); if ≥ 5%, consultant surgeon and anaesthetist present and planned post-operative critical care (NELA; RCS 2018 The Higher Risk General Surgical Patient). Age ≥ 65 or frail: elderly-medicine (geriatric) review.")
    }

    static func oestrogenNote(_ s: Signals, shape: PlanShape, procedure: ProcedureKind) -> Note? {
        let found = drugsPresent(s.meds, oestrogens)
        guard !found.isEmpty else { return nil }
        let vte = shape.thrombosis || test(#"\b(dvt|deep vein thrombosis|pulmonary embol\w*|\bpe\b|venous thrombo\w*|vte|mesenteric venous|cerebral venous)\b"#, s.assessment)
        if vte {
            return Note(kind: .hormonal, severity: .warning, text: "Oestrogen-containing contraceptive / HRT (\(found.joined(separator: ", "))): a VTE risk factor — stop it and offer non-oestrogen contraception (FSRH/UKMEC 2016; NICE NG158).")
        }
        if procedure == .surgery {
            return Note(kind: .hormonal, severity: .info, text: "Oestrogen-containing contraceptive / HRT (\(found.joined(separator: ", "))): consider stopping it 4 weeks before major elective surgery, with alternative contraception (NICE NG89).")
        }
        return nil
    }

    static func immunosuppressionNote(_ s: Signals, acuteIllness: Bool) -> Note? {
        let drugs = drugsPresent(s.meds, immunosuppressants + steroids.filter { $0 != "fludrocortisone" })
        let condition = capture(#"\b(transplant\w*|hiv|aids|chemotherapy|neutropeni\w*|asplen\w*|splenectomy|immunosuppress\w*|immunocompromis\w*)\b"#, s.history)
        guard !drugs.isEmpty || condition != nil else { return nil }
        let what = (drugs + (condition.map { [$0] } ?? [])).joined(separator: ", ")
        let mtx = acuteIllness && drugs.contains("methotrexate")
            ? " Withhold methotrexate during acute infection or AKI and restart with the prescribing specialist once recovered (BNF; BSR 2017 DMARD guideline)."
            : ""
        return Note(kind: .immunosuppression, severity: .warning,
            text: "Immunosuppressed (\(what)): fever, peritonism and a raised white cell count may be blunted — lower threshold for imaging, senior review and escalation.\(mtx)")
    }

    static func betaBlockerNote(_ s: Signals) -> Note? {
        let bb = drugsPresent(s.meds, betaBlockers)
        guard !bb.isEmpty else { return nil }
        return Note(kind: .haemodynamics, severity: .info,
            text: "Beta-blocker (\(bb.joined(separator: ", "))): tachycardia may be blunted — heart rate can under-read shock or sepsis (ATLS 10).")
    }
}
