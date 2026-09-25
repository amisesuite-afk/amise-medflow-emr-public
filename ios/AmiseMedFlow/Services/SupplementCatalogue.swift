// SupplementCatalogue.swift
// Herbs, teas, bush remedies and supplements — clinical content (decision support only).
//
// Twin of the dashboard's `artifacts/dashboard/src/lib/supplement-catalogue.ts`: the same items,
// fields and shared wording. `lint:interaction-parity` (CI) parses both files and fails on any
// difference. Registered in clinical-content/registry.json (`supplement-catalogue`).
//
// Source: the practice owner's evidence briefing (Dr Dawit Daniel Kabiye, "Ancient Remedy, Modern
// Market", Sept 2026) §5 and §7, and the references it cites: Ang-Lee MK et al. JAMA 2001;
// OpenAnesthesia / SPAQI 2025; J Clin Anesth 2024 review; Proc (Bayl Univ Med Cent) 2022;
// Halegoua-DeMarzio D et al. Am J Med 2023 (DILIN, turmeric); NIDDK LiverTox (ashwagandha);
// Björnsson HK et al. Liver Int 2020; Saper RB et al. JAMA 2008 (Ayurvedic metals); Nortier JL
// et al. NEJM 2000 and Debelle FD et al. Kidney Int 2008 (aristolochic acid); Schwarz C et al.
// JAMA Netw Open 2022 (SmartAge).
//
// Items with interaction rules point at a `DrugClasses.terms` key (`term`), which holds their
// names; the others carry their own `names`. Stop times are for the CLINICIAN: nothing here stops,
// prescribes or edits anything. Caribbean bush teas (cerasee, soursop leaf, …) are deliberately
// not items — their pharmacology is not in the briefing (see "Needs sign-off" in
// docs/clinical-validation/changes/supplements-interactions.md).

import Foundation

struct SupplementItem: Identifiable, Equatable {
    /// Stable id stored with a recorded entry.
    let id: String
    /// Display name.
    let label: String
    /// `DrugClasses.terms` key used by the interaction screen ("" = no interaction rules).
    let term: String
    /// "name|synonym" list for items without a term ("" when `term` is set).
    let names: String
    /// Main clinical concern (clinician-facing).
    let concern: String
    /// Commonly cited stop time before elective surgery ("" when none is cited).
    let stopTime: String
    /// Liver / renal / metal and other harms ("" when none beyond the concern).
    let harms: String
    /// Evidence note ("" when none).
    let evidence: String
    /// Citation(s).
    let source: String
}

struct SupplementPromptText: Equatable {
    let id: String
    let title: String
    let detail: String
}

enum SupplementCatalogue {

    static let catalogueVersion = "1.0.0"

    static let items: [SupplementItem] = [
        SupplementItem(
            id: "garlic", label: "Garlic (supplement)", term: "garlic",
            names: "",
            concern: "Platelet inhibition; the strongest link to surgical bleeding, especially with anticoagulants",
            stopTime: "at least 7 days; many advise 2 weeks",
            harms: "",
            evidence: "Evidence for cardiovascular claims is inconsistent. Normal amounts in food are not the concern.",
            source: "Ang-Lee MK et al. JAMA 2001;286:208-16; Proc (Bayl Univ Med Cent) 2022"),
        SupplementItem(
            id: "ginkgo", label: "Ginkgo", term: "ginkgo",
            names: "",
            concern: "Platelet-activating factor inhibition; bleeding, especially with anticoagulants",
            stopTime: "at least 36 hours; SPAQI advises 2 weeks",
            harms: "",
            evidence: "Evidence for cognitive claims is inconsistent.",
            source: "Ang-Lee MK et al. JAMA 2001;286:208-16; OpenAnesthesia / SPAQI 2025"),
        SupplementItem(
            id: "ginger", label: "Ginger (supplement)", term: "ginger",
            names: "",
            concern: "Thromboxane synthetase inhibition (bleeding)",
            stopTime: "2 weeks (SPAQI)",
            harms: "",
            evidence: "Normal amounts in food are not the concern; tablets, capsules, extracts and strong teas are.",
            source: "OpenAnesthesia / SPAQI 2025"),
        SupplementItem(
            id: "turmeric", label: "Turmeric / curcumin", term: "turmeric",
            names: "",
            concern: "Drug-induced liver injury (hepatocellular, typically 1–4 months after starting; linked to HLA-B*35:01); raises bleeding risk with anticoagulants",
            stopTime: "2 weeks; check LFTs if symptomatic",
            harms: "Liver: US DILIN reported 10 cases (all since 2011), 5 hospitalised and 1 death from acute liver failure. Metal: some turmeric products have been adulterated with lead chromate.",
            evidence: "Culinary turmeric is fine; the risk is high-dose, bioavailability-enhanced capsules (black pepper / piperine or nanoparticle forms). Benefit is weak beyond a small effect on osteoarthritis pain.",
            source: "Halegoua-DeMarzio D et al. Am J Med 2023;136:200-206 (DILIN); J Clin Anesth 2024 review"),
        SupplementItem(
            id: "ashwagandha", label: "Ashwagandha", term: "ashwagandha",
            names: "",
            concern: "Drug-induced liver injury, typically cholestatic with severe jaundice and itch, resolving over 1–5 months, sometimes fatal",
            stopTime: "2 weeks; check LFTs if symptomatic",
            harms: "Liver: LiverTox lists it as a likely cause of clinically apparent liver injury. Denmark banned ashwagandha supplements in 2023 (thyroid and sex-hormone effects). Avoid in liver disease, pregnancy and thyroid disease.",
            evidence: "Small trials suggest reduced perceived stress.",
            source: "NIDDK LiverTox: Ashwagandha (Dec 2024); Björnsson HK et al. Liver Int 2020;40:825-9"),
        SupplementItem(
            id: "ginseng", label: "Ginseng", term: "ginseng",
            names: "",
            concern: "Hypoglycaemia, especially in fasting patients (pre-op fast or religious fast); possible platelet effects; reduced INR reported with warfarin",
            stopTime: "at least 7 days; SPAQI advises 2 weeks",
            harms: "",
            evidence: "Evidence for energy and cognitive claims is inconsistent.",
            source: "Ang-Lee MK et al. JAMA 2001;286:208-16; OpenAnesthesia / SPAQI 2025"),
        SupplementItem(
            id: "st_johns_wort", label: "St John's wort", term: "st johns wort",
            names: "",
            concern: "CYP3A4 induction: lowers levels of warfarin, ciclosporin, tacrolimus, DOACs, hormonal contraceptives and many anaesthetic drugs; serotonin syndrome with serotonergic drugs",
            stopTime: "at least 5 days",
            harms: "",
            evidence: "",
            source: "Ang-Lee MK et al. JAMA 2001;286:208-16; BNF interactions (St John's wort)"),
        SupplementItem(
            id: "kava", label: "Kava", term: "kava",
            names: "",
            concern: "Potentiates anaesthetic sedation",
            stopTime: "24 hours",
            harms: "",
            evidence: "",
            source: "Ang-Lee MK et al. JAMA 2001;286:208-16"),
        SupplementItem(
            id: "valerian", label: "Valerian", term: "valerian",
            names: "",
            concern: "Potentiates anaesthetic sedation; stopping suddenly can cause a benzodiazepine-like withdrawal",
            stopTime: "taper over 1–2 weeks (do not stop suddenly)",
            harms: "",
            evidence: "",
            source: "Ang-Lee MK et al. JAMA 2001;286:208-16"),
        SupplementItem(
            id: "echinacea", label: "Echinacea", term: "echinacea",
            names: "",
            concern: "Immune effects; avoid if immunosuppression is planned",
            stopTime: "stop early before transplant-type surgery",
            harms: "",
            evidence: "",
            source: "Ang-Lee MK et al. JAMA 2001;286:208-16"),
        SupplementItem(
            id: "ephedra", label: "Ephedra (ma huang)", term: "ephedra",
            names: "",
            concern: "Hypertension and arrhythmia (sympathomimetic); interacts with MAOIs and anaesthesia",
            stopTime: "at least 24 hours; ideally avoid entirely",
            harms: "Whole-herb ephedra weight-loss supplements caused cardiovascular deaths and were banned by the US FDA in 2004.",
            evidence: "",
            source: "Ang-Lee MK et al. JAMA 2001;286:208-16"),
        SupplementItem(
            id: "ayurvedic_metals", label: "Ayurvedic preparation (rasa shastra / metal-based)", term: "",
            names: "ayurvedic|ayurveda|rasa shastra|bhasma",
            concern: "Heavy-metal poisoning (lead, mercury, arsenic)",
            stopTime: "",
            harms: "Metal: 20.7% of Ayurvedic medicines bought online (US- and Indian-made) contained lead, mercury or arsenic; metal-based rasa shastra products were more than twice as likely to contain metals; a 2015 review attributed 19% of published lead-poisoning cases to Ayurvedic medicines.",
            evidence: "",
            source: "Saper RB et al. JAMA 2008;300:915-23; Public Health Ontario fact sheet (2019)"),
        SupplementItem(
            id: "aristolochia", label: "Chinese herbal slimming product (aristolochic acid risk)", term: "",
            names: "aristolochia|aristolochic acid|aristolochia fangchi|guang fang ji|chinese herbal slimming|chinese slimming|slimming pills|herbal weight-loss",
            concern: "Aristolochic acid nephropathy (rapidly progressive kidney failure) and upper-tract urothelial carcinoma",
            stopTime: "",
            harms: "Renal and cancer: in the Belgian slimming-pill cluster (Stephania tetrandra substituted with Aristolochia fangchi) more than 100 women developed rapidly progressive kidney failure; 46% of 39 who later had prophylactic ureteronephrectomy had urothelial cancer.",
            evidence: "",
            source: "Nortier JL et al. N Engl J Med 2000;342:1686-92; Debelle FD et al. Kidney Int 2008"),
        SupplementItem(
            id: "detox_cleanse", label: "Detox tea / colon cleanse / laxative cleanse", term: "",
            names: "detox tea|detox teas|colon cleanse|colon cleansing|cleanse tea|laxative tea|slimming tea|skinny tea|body cleanse",
            concern: "Dehydration, electrolyte disturbance, laxative dependence",
            stopTime: "",
            harms: "",
            evidence: "No reliable evidence of benefit beyond placebo.",
            source: "Owner evidence briefing (Kabiye, Sept 2026) §6"),
        SupplementItem(
            id: "iv_vitamin_drip", label: "IV vitamin drip (outside clinical care)", term: "",
            names: "iv vitamin drip|vitamin drip|iv vitamin infusion|iv drip therapy|myers cocktail|iv glutathione",
            concern: "Infection and fluid risks",
            stopTime: "",
            harms: "",
            evidence: "Little outcome evidence for healthy people outside specific medical indications.",
            source: "Owner evidence briefing (Kabiye, Sept 2026) §6"),
        SupplementItem(
            id: "spermidine", label: "Spermidine / \"autophagy booster\"", term: "",
            names: "spermidine|autophagy booster|autophagy supplement",
            concern: "No benefit shown in humans (SmartAge RCT)",
            stopTime: "",
            harms: "",
            evidence: "The 12-month placebo-controlled SmartAge trial (100 older adults) found no improvement in memory or biomarkers. Recording it is enough.",
            source: "Schwarz C et al. JAMA Netw Open 2022;5:e2213875 (SmartAge)"),
        SupplementItem(
            id: "bush_tea", label: "Bush tea / herbal remedy (unspecified)", term: "",
            names: "bush tea|bush medicine|bush remedy|herbal tea|herbal remedy|herbal mixture|herbal medicine",
            concern: "Plant not identified: interactions and perioperative risk unknown",
            stopTime: "identify the plant; stop non-essential herbal products 1–2 weeks before elective surgery (ASA / SPAQI) — clinician to confirm",
            harms: "",
            evidence: "",
            source: "ASA / SPAQI (OpenAnesthesia 2025); J Clin Anesth 2024 review"),
    ]

    // MARK: - Shared wording (twins of the web constants; compared by lint:interaction-parity)

    static let sectionTitle = "Herbs, teas, bush remedies & supplements"
    static let patientQuestion = "Do you take any herbs, bush teas, bush medicines, vitamins or supplements? Please include teas and remedies from the garden or market."
    static let disclosureRationale = "50–70% of surgical patients do not disclose herbal use (J Clin Anesth 2024 review). Ask explicitly, including local bush teas, which patients often do not count as medicine."
    static let herbalPreOpPatientText = "Herbal remedies, bush teas and supplements: please stop them 2 weeks before your operation or procedure. This includes garlic tablets, ginkgo, ginseng, ginger supplements, turmeric (curcumin), St John's wort, kava, echinacea, ashwagandha, ephedra (ma huang) and bush teas or herbal mixtures (tablets, capsules, extracts or strong teas — normal amounts in food are fine). Why: some of these increase bleeding, change how the anaesthetic or sedation works, raise blood pressure or blood sugar problems, or stop your other medicines working properly. When: this applies to planned operations and to procedures with sedation or an anaesthetic, including gastroscopy, colonoscopy and ERCP. If your operation is less than 2 weeks away, stop them now and tell the team what you take. If you take valerian every night, do not stop it suddenly — call the clinic. This does not apply to medicines prescribed by a doctor: do not stop any prescribed medicine unless the clinic tells you to. Please bring all your herbs, teas and supplements (or their labels) to your appointment."

    // MARK: - Prompts (SupplementAlerts.swift; web supplement-prompts.ts)
    // Clinician-facing "ask about" prompts and alerts. Each only suggests a question or shows a
    // concern; none changes the record. Trigger words are matched negation-aware.

    static let prompts: [SupplementPromptText] = [
        SupplementPromptText(
            id: "not_asked",
            title: "Herbs, teas, bush remedies & supplements not asked",
            detail: "50–70% of surgical patients do not disclose herbal use (J Clin Anesth 2024 review). Ask explicitly, including local bush teas, and record the answer (none, or what is taken)."),
        SupplementPromptText(
            id: "ashwagandha_avoid",
            title: "Ashwagandha: avoid in liver disease, pregnancy and thyroid disease (LiverTox; Danish ban 2023)",
            detail: "Ashwagandha is recorded and the record shows liver disease, pregnancy or thyroid disease. Decision support only — the clinician decides."),
        SupplementPromptText(
            id: "liver",
            title: "Raised LFTs / hepatitis — ask about herbal products",
            detail: "If unexplained, ask about turmeric / curcumin (especially capsules with black pepper / piperine), ashwagandha and other herbal products: herbal liver injury is often not volunteered (DILIN; LiverTox)."),
        SupplementPromptText(
            id: "lead",
            title: "Anaemia, abdominal pain, neuropathy or raised lead — ask about Ayurvedic products",
            detail: "If unexplained, ask about Ayurvedic (rasa shastra) preparations and turmeric products (some adulterated with lead chromate); consider a blood lead level (Saper JAMA 2008)."),
        SupplementPromptText(
            id: "aristolochic",
            title: "Renal failure or upper-tract urothelial cancer — ask about Chinese herbal products",
            detail: "Ask about Chinese herbal products, slimming pills and Chinese herbal weight-loss products (aristolochic acid nephropathy and urothelial carcinoma: Nortier NEJM 2000; Debelle Kidney Int 2008)."),
        SupplementPromptText(
            id: "detox",
            title: "Low potassium or sodium, dehydration or chronic constipation — ask about detox teas and cleanses",
            detail: "If unexplained, ask about detox teas, colon cleanses and laxative \"cleanse\" products (dehydration, electrolyte disturbance, laxative dependence)."),
        SupplementPromptText(
            id: "iv_drip",
            title: "Fever or skin / line-site infection — ask about IV drips",
            detail: "Ask about recent IV vitamin drips given outside clinical care (infection and fluid risks)."),
        SupplementPromptText(
            id: "periop_note",
            title: "Decision support only",
            detail: "The clinician decides whether anything is stopped; nothing is stopped automatically."),
    ]

    /// Negation-aware trigger words for the prompts (lowercase; matched in the clinical text).
    static let triggerTerms: [String: [String]] = [
        "liver": ["hepatitis", "drug-induced liver injury", "deranged lft", "raised lft", "abnormal lft", "transaminitis", "raised transaminases", "elevated transaminases", "liver injury"],
        "lead": ["lead poisoning", "lead toxicity", "raised lead", "elevated lead", "raised blood lead", "elevated blood lead", "plumbism", "basophilic stippling"],
        "anaemia": ["anaemia", "anemia", "anaemic", "anemic"],
        "abdominalPain": ["abdominal pain", "abdo pain", "abdominal colic"],
        "neuropathy": ["neuropathy", "wrist drop", "foot drop"],
        "aristolochic": ["rapidly progressive renal failure", "rapidly progressive kidney", "rapidly progressive glomerulonephritis", "rpgn", "upper tract urothelial", "upper-tract urothelial", "renal pelvis tumour", "renal pelvis carcinoma", "ureteric tumour", "ureteric carcinoma", "ureteral carcinoma", "aristolochic", "balkan nephropathy", "chinese herb nephropathy"],
        "dehydration": ["dehydration", "dehydrated", "chronic constipation", "laxative abuse", "laxative misuse"],
        "lineInfection": ["cellulitis", "line infection", "line-site infection", "cannula site infection", "phlebitis", "injection site infection"],
        "fever": ["fever", "pyrexia", "febrile"],
        "liverDisease": ["cirrhosis", "chronic liver disease", "liver disease", "hepatitis", "fatty liver", "nafld", "masld", "hepatic impairment"],
        "thyroidDisease": ["thyroid", "hypothyroid", "hyperthyroid", "graves", "hashimoto", "thyroiditis", "goitre", "goiter"],
    ]

    static func prompt(_ id: String) -> SupplementPromptText {
        prompts.first { $0.id == id } ?? SupplementPromptText(id: id, title: id, detail: "")
    }

    // MARK: - Lookup

    static func item(id: String?) -> SupplementItem? {
        guard let id = id else { return nil }
        return items.first { $0.id == id }
    }

    /// Every name of an item (lowercased): the term's members, or the item's own `names`.
    static func names(of item: SupplementItem) -> [String] {
        if !item.term.isEmpty {
            return (DrugClasses.terms[item.term]?.members ?? []).flatMap { DrugClasses.parseMember($0).names }
        }
        return DrugClasses.parseMember(item.names).names
    }

    /// Catalogue items named in a free-text entry (whole words, case-insensitive), in catalogue order.
    static func match(_ text: String) -> [SupplementItem] {
        let lc = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !lc.isEmpty else { return [] }
        return items.filter { item in names(of: item).contains { DrugClasses.containsWholeWord($0, in: lc) } }
    }

    /// Picker search: label or any name containing the query; everything for an empty query.
    static func search(_ query: String) -> [SupplementItem] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return items }
        return items.filter { item in
            item.label.lowercased().contains(q) || names(of: item).contains { $0.contains(q) }
        }
    }

    /// Clinician-facing perioperative alert (same text as the web `perioperativeAlertText`):
    /// "Supplement: <name> — <concern>. Commonly cited stop time: <…> before elective surgery (source)."
    /// Informational only — the clinician decides; nothing is stopped automatically.
    static func perioperativeAlertText(_ item: SupplementItem) -> String {
        let stop = item.stopTime.isEmpty ? "" : " Commonly cited stop time: \(item.stopTime) before elective surgery"
        return "Supplement: \(item.label) — \(item.concern).\(stop) (\(item.source))."
    }
}
