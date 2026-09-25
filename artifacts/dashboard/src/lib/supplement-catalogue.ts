/**
 * Herbs, teas, bush remedies and supplements — clinical content (decision support only).
 *
 * Source: the practice owner's evidence briefing (Dr Dawit Daniel Kabiye, "Ancient Remedy, Modern
 * Market", Sept 2026) §5 (supplements and herbal products) and §7 (perioperative checklist), and
 * the references it cites: Ang-Lee MK et al. JAMA 2001;286:208-16; OpenAnesthesia / SPAQI 2025;
 * J Clin Anesth 2024 review; Proc (Bayl Univ Med Cent) 2022; Halegoua-DeMarzio D et al. Am J Med
 * 2023 (DILIN, turmeric); NIDDK LiverTox (ashwagandha); Björnsson HK et al. Liver Int 2020;
 * Saper RB et al. JAMA 2008 (Ayurvedic metals); Nortier JL et al. NEJM 2000 and Debelle FD et al.
 * Kidney Int 2008 (aristolochic acid); Schwarz C et al. JAMA Netw Open 2022 (SmartAge).
 *
 * Each item: names (from `drug-classes.ts` when the item has interaction rules, else its own
 * `names`), the main concern, the commonly cited stop time before elective surgery, harms,
 * an evidence note and the source. Stop times are for the CLINICIAN: nothing here stops,
 * prescribes or edits anything, and no stop time is shown to patients from this file (the
 * patient text is the surgeon-approved `HERBAL_PREOP_PATIENT_TEXT`).
 *
 * Twin: `ios/AmiseMedFlow/Services/SupplementCatalogue.swift`. `lint:interaction-parity` fails
 * if any item field or shared text differs. Caribbean bush teas (cerasee, soursop leaf, …) are
 * deliberately NOT items: their pharmacology is not in the briefing — see "Needs sign-off" in
 * docs/clinical-validation/changes/supplements-interactions.md. Registered in
 * clinical-content/registry.json (`supplement-catalogue`); bump the version with a changelog.
 */
import { DRUG_TERMS, containsWholeWord, parseMember } from './drug-classes';

export const SUPPLEMENT_CATALOGUE_VERSION = '1.0.0';

export interface SupplementItem {
  /** Stable id stored with a recorded entry. */
  id: string;
  /** Display name. */
  label: string;
  /** `DRUG_TERMS` key used by the interaction screen ('' = no interaction rules). */
  term: string;
  /** 'name|synonym' list for items without a term ('' when `term` is set: names come from there). */
  names: string;
  /** Main clinical concern (clinician-facing). */
  concern: string;
  /** Commonly cited stop time before elective surgery ('' when none is cited). */
  stopTime: string;
  /** Liver / renal / metal and other harms ('' when none beyond the concern). */
  harms: string;
  /** Evidence note ('' when none). */
  evidence: string;
  /** Citation(s). */
  source: string;
}

export const SUPPLEMENT_ITEMS: SupplementItem[] = [
  {
    id: 'garlic', label: 'Garlic (supplement)', term: 'garlic', names: '',
    concern: 'Platelet inhibition; the strongest link to surgical bleeding, especially with anticoagulants',
    stopTime: 'at least 7 days; many advise 2 weeks',
    harms: '',
    evidence: 'Evidence for cardiovascular claims is inconsistent. Normal amounts in food are not the concern.',
    source: 'Ang-Lee MK et al. JAMA 2001;286:208-16; Proc (Bayl Univ Med Cent) 2022',
  },
  {
    id: 'ginkgo', label: 'Ginkgo', term: 'ginkgo', names: '',
    concern: 'Platelet-activating factor inhibition; bleeding, especially with anticoagulants',
    stopTime: 'at least 36 hours; SPAQI advises 2 weeks',
    harms: '',
    evidence: 'Evidence for cognitive claims is inconsistent.',
    source: 'Ang-Lee MK et al. JAMA 2001;286:208-16; OpenAnesthesia / SPAQI 2025',
  },
  {
    id: 'ginger', label: 'Ginger (supplement)', term: 'ginger', names: '',
    concern: 'Thromboxane synthetase inhibition (bleeding)',
    stopTime: '2 weeks (SPAQI)',
    harms: '',
    evidence: 'Normal amounts in food are not the concern; tablets, capsules, extracts and strong teas are.',
    source: 'OpenAnesthesia / SPAQI 2025',
  },
  {
    id: 'turmeric', label: 'Turmeric / curcumin', term: 'turmeric', names: '',
    concern: 'Drug-induced liver injury (hepatocellular, typically 1–4 months after starting; linked to HLA-B*35:01); raises bleeding risk with anticoagulants',
    stopTime: '2 weeks; check LFTs if symptomatic',
    harms: 'Liver: US DILIN reported 10 cases (all since 2011), 5 hospitalised and 1 death from acute liver failure. Metal: some turmeric products have been adulterated with lead chromate.',
    evidence: 'Culinary turmeric is fine; the risk is high-dose, bioavailability-enhanced capsules (black pepper / piperine or nanoparticle forms). Benefit is weak beyond a small effect on osteoarthritis pain.',
    source: 'Halegoua-DeMarzio D et al. Am J Med 2023;136:200-206 (DILIN); J Clin Anesth 2024 review',
  },
  {
    id: 'ashwagandha', label: 'Ashwagandha', term: 'ashwagandha', names: '',
    concern: 'Drug-induced liver injury, typically cholestatic with severe jaundice and itch, resolving over 1–5 months, sometimes fatal',
    stopTime: '2 weeks; check LFTs if symptomatic',
    harms: 'Liver: LiverTox lists it as a likely cause of clinically apparent liver injury. Denmark banned ashwagandha supplements in 2023 (thyroid and sex-hormone effects). Avoid in liver disease, pregnancy and thyroid disease.',
    evidence: 'Small trials suggest reduced perceived stress.',
    source: 'NIDDK LiverTox: Ashwagandha (Dec 2024); Björnsson HK et al. Liver Int 2020;40:825-9',
  },
  {
    id: 'ginseng', label: 'Ginseng', term: 'ginseng', names: '',
    concern: 'Hypoglycaemia, especially in fasting patients (pre-op fast or religious fast); possible platelet effects; reduced INR reported with warfarin',
    stopTime: 'at least 7 days; SPAQI advises 2 weeks',
    harms: '',
    evidence: 'Evidence for energy and cognitive claims is inconsistent.',
    source: 'Ang-Lee MK et al. JAMA 2001;286:208-16; OpenAnesthesia / SPAQI 2025',
  },
  {
    id: 'st_johns_wort', label: "St John's wort", term: 'st johns wort', names: '',
    concern: 'CYP3A4 induction: lowers levels of warfarin, ciclosporin, tacrolimus, DOACs, hormonal contraceptives and many anaesthetic drugs; serotonin syndrome with serotonergic drugs',
    stopTime: 'at least 5 days',
    harms: '',
    evidence: '',
    source: "Ang-Lee MK et al. JAMA 2001;286:208-16; BNF interactions (St John's wort)",
  },
  {
    id: 'kava', label: 'Kava', term: 'kava', names: '',
    concern: 'Potentiates anaesthetic sedation',
    stopTime: '24 hours',
    harms: '',
    evidence: '',
    source: 'Ang-Lee MK et al. JAMA 2001;286:208-16',
  },
  {
    id: 'valerian', label: 'Valerian', term: 'valerian', names: '',
    concern: 'Potentiates anaesthetic sedation; stopping suddenly can cause a benzodiazepine-like withdrawal',
    stopTime: 'taper over 1–2 weeks (do not stop suddenly)',
    harms: '',
    evidence: '',
    source: 'Ang-Lee MK et al. JAMA 2001;286:208-16',
  },
  {
    id: 'echinacea', label: 'Echinacea', term: 'echinacea', names: '',
    concern: 'Immune effects; avoid if immunosuppression is planned',
    stopTime: 'stop early before transplant-type surgery',
    harms: '',
    evidence: '',
    source: 'Ang-Lee MK et al. JAMA 2001;286:208-16',
  },
  {
    id: 'ephedra', label: 'Ephedra (ma huang)', term: 'ephedra', names: '',
    concern: 'Hypertension and arrhythmia (sympathomimetic); interacts with MAOIs and anaesthesia',
    stopTime: 'at least 24 hours; ideally avoid entirely',
    harms: 'Whole-herb ephedra weight-loss supplements caused cardiovascular deaths and were banned by the US FDA in 2004.',
    evidence: '',
    source: 'Ang-Lee MK et al. JAMA 2001;286:208-16',
  },
  {
    id: 'ayurvedic_metals', label: 'Ayurvedic preparation (rasa shastra / metal-based)', term: '',
    names: 'ayurvedic|ayurveda|rasa shastra|bhasma',
    concern: 'Heavy-metal poisoning (lead, mercury, arsenic)',
    stopTime: '',
    harms: 'Metal: 20.7% of Ayurvedic medicines bought online (US- and Indian-made) contained lead, mercury or arsenic; metal-based rasa shastra products were more than twice as likely to contain metals; a 2015 review attributed 19% of published lead-poisoning cases to Ayurvedic medicines.',
    evidence: '',
    source: 'Saper RB et al. JAMA 2008;300:915-23; Public Health Ontario fact sheet (2019)',
  },
  {
    id: 'aristolochia', label: 'Chinese herbal slimming product (aristolochic acid risk)', term: '',
    names: 'aristolochia|aristolochic acid|aristolochia fangchi|guang fang ji|chinese herbal slimming|chinese slimming|slimming pills|herbal weight-loss',
    concern: 'Aristolochic acid nephropathy (rapidly progressive kidney failure) and upper-tract urothelial carcinoma',
    stopTime: '',
    harms: 'Renal and cancer: in the Belgian slimming-pill cluster (Stephania tetrandra substituted with Aristolochia fangchi) more than 100 women developed rapidly progressive kidney failure; 46% of 39 who later had prophylactic ureteronephrectomy had urothelial cancer.',
    evidence: '',
    source: 'Nortier JL et al. N Engl J Med 2000;342:1686-92; Debelle FD et al. Kidney Int 2008',
  },
  {
    id: 'detox_cleanse', label: 'Detox tea / colon cleanse / laxative cleanse', term: '',
    names: 'detox tea|detox teas|colon cleanse|colon cleansing|cleanse tea|laxative tea|slimming tea|skinny tea|body cleanse',
    concern: 'Dehydration, electrolyte disturbance, laxative dependence',
    stopTime: '',
    harms: '',
    evidence: 'No reliable evidence of benefit beyond placebo.',
    source: 'Owner evidence briefing (Kabiye, Sept 2026) §6',
  },
  {
    id: 'iv_vitamin_drip', label: 'IV vitamin drip (outside clinical care)', term: '',
    names: 'iv vitamin drip|vitamin drip|iv vitamin infusion|iv drip therapy|myers cocktail|iv glutathione',
    concern: 'Infection and fluid risks',
    stopTime: '',
    harms: '',
    evidence: 'Little outcome evidence for healthy people outside specific medical indications.',
    source: 'Owner evidence briefing (Kabiye, Sept 2026) §6',
  },
  {
    id: 'spermidine', label: 'Spermidine / "autophagy booster"', term: '',
    names: 'spermidine|autophagy booster|autophagy supplement',
    concern: 'No benefit shown in humans (SmartAge RCT)',
    stopTime: '',
    harms: '',
    evidence: 'The 12-month placebo-controlled SmartAge trial (100 older adults) found no improvement in memory or biomarkers. Recording it is enough.',
    source: 'Schwarz C et al. JAMA Netw Open 2022;5:e2213875 (SmartAge)',
  },
  {
    id: 'bush_tea', label: 'Bush tea / herbal remedy (unspecified)', term: '',
    names: 'bush tea|bush medicine|bush remedy|herbal tea|herbal remedy|herbal mixture|herbal medicine',
    concern: 'Plant not identified: interactions and perioperative risk unknown',
    stopTime: 'identify the plant; stop non-essential herbal products 1–2 weeks before elective surgery (ASA / SPAQI) — clinician to confirm',
    harms: '',
    evidence: '',
    source: 'ASA / SPAQI (OpenAnesthesia 2025); J Clin Anesth 2024 review',
  },
];

// ── Shared wording (twins on iOS; compared by lint:interaction-parity) ────────────────────

/** Clinician-facing heading of the structured history item. */
export const SUPPLEMENT_SECTION_TITLE = 'Herbs, teas, bush remedies & supplements';

/** Patient question (front-desk questionnaire, web intake, iOS questionnaire). Asks; never instructs. */
export const SUPPLEMENT_PATIENT_QUESTION =
  'Do you take any herbs, bush teas, bush medicines, vitamins or supplements? Please include teas and remedies from the garden or market.';

/** Why the question is mandatory (clinician help text). */
export const SUPPLEMENT_DISCLOSURE_RATIONALE =
  '50–70% of surgical patients do not disclose herbal use (J Clin Anesth 2024 review). Ask explicitly, including local bush teas, which patients often do not count as medicine.';

/**
 * Patient pre-op text for herbal products — surgeon decision 2026-09-25 (docs/clinical-validation/
 * SURGEON-DECISIONS.md). The same words are in the front-desk instructions and the api-server prep
 * templates; `lint:patient-instructions` pins them. Prescribed medicines stay under hazard H-10.
 */
export const HERBAL_PREOP_PATIENT_TEXT =
  "Herbal remedies, bush teas and supplements: please stop them 2 weeks before your operation or procedure. This includes garlic tablets, ginkgo, ginseng, ginger supplements, turmeric (curcumin), St John's wort, kava, echinacea, ashwagandha, ephedra (ma huang) and bush teas or herbal mixtures (tablets, capsules, extracts or strong teas — normal amounts in food are fine). Why: some of these increase bleeding, change how the anaesthetic or sedation works, raise blood pressure or blood sugar problems, or stop your other medicines working properly. When: this applies to planned operations and to procedures with sedation or an anaesthetic, including gastroscopy, colonoscopy and ERCP. If your operation is less than 2 weeks away, stop them now and tell the team what you take. If you take valerian every night, do not stop it suddenly — call the clinic. This does not apply to medicines prescribed by a doctor: do not stop any prescribed medicine unless the clinic tells you to. Please bring all your herbs, teas and supplements (or their labels) to your appointment.";

// ── Prompts (supplement-prompts.ts; iOS SupplementAlerts.swift) ─────────────────────────────
// Clinician-facing "ask about" prompts and alerts. Each only suggests a question or shows a
// concern; none changes the record. Trigger words are matched negation-aware.

export interface SupplementPromptText { id: string; title: string; detail: string }

export const SUPPLEMENT_PROMPTS: SupplementPromptText[] = [
  {
    id: 'not_asked',
    title: 'Herbs, teas, bush remedies & supplements not asked',
    detail: '50–70% of surgical patients do not disclose herbal use (J Clin Anesth 2024 review). Ask explicitly, including local bush teas, and record the answer (none, or what is taken).',
  },
  {
    id: 'ashwagandha_avoid',
    title: 'Ashwagandha: avoid in liver disease, pregnancy and thyroid disease (LiverTox; Danish ban 2023)',
    detail: 'Ashwagandha is recorded and the record shows liver disease, pregnancy or thyroid disease. Decision support only — the clinician decides.',
  },
  {
    id: 'liver',
    title: 'Raised LFTs / hepatitis — ask about herbal products',
    detail: 'If unexplained, ask about turmeric / curcumin (especially capsules with black pepper / piperine), ashwagandha and other herbal products: herbal liver injury is often not volunteered (DILIN; LiverTox).',
  },
  {
    id: 'lead',
    title: 'Anaemia, abdominal pain, neuropathy or raised lead — ask about Ayurvedic products',
    detail: 'If unexplained, ask about Ayurvedic (rasa shastra) preparations and turmeric products (some adulterated with lead chromate); consider a blood lead level (Saper JAMA 2008).',
  },
  {
    id: 'aristolochic',
    title: 'Renal failure or upper-tract urothelial cancer — ask about Chinese herbal products',
    detail: 'Ask about Chinese herbal products, slimming pills and Chinese herbal weight-loss products (aristolochic acid nephropathy and urothelial carcinoma: Nortier NEJM 2000; Debelle Kidney Int 2008).',
  },
  {
    id: 'detox',
    title: 'Low potassium or sodium, dehydration or chronic constipation — ask about detox teas and cleanses',
    detail: 'If unexplained, ask about detox teas, colon cleanses and laxative "cleanse" products (dehydration, electrolyte disturbance, laxative dependence).',
  },
  {
    id: 'iv_drip',
    title: 'Fever or skin / line-site infection — ask about IV drips',
    detail: 'Ask about recent IV vitamin drips given outside clinical care (infection and fluid risks).',
  },
  {
    id: 'periop_note',
    title: 'Decision support only',
    detail: 'The clinician decides whether anything is stopped; nothing is stopped automatically.',
  },
];

/** Negation-aware trigger words for the prompts (lowercase; matched in the clinical text). */
export const SUPPLEMENT_TRIGGER_TERMS: Record<string, string[]> = {
  liver: ['hepatitis', 'drug-induced liver injury', 'deranged lft', 'raised lft', 'abnormal lft', 'transaminitis', 'raised transaminases', 'elevated transaminases', 'liver injury'],
  lead: ['lead poisoning', 'lead toxicity', 'raised lead', 'elevated lead', 'raised blood lead', 'elevated blood lead', 'plumbism', 'basophilic stippling'],
  anaemia: ['anaemia', 'anemia', 'anaemic', 'anemic'],
  abdominalPain: ['abdominal pain', 'abdo pain', 'abdominal colic'],
  neuropathy: ['neuropathy', 'wrist drop', 'foot drop'],
  aristolochic: ['rapidly progressive renal failure', 'rapidly progressive kidney', 'rapidly progressive glomerulonephritis', 'rpgn', 'upper tract urothelial', 'upper-tract urothelial', 'renal pelvis tumour', 'renal pelvis carcinoma', 'ureteric tumour', 'ureteric carcinoma', 'ureteral carcinoma', 'aristolochic', 'balkan nephropathy', 'chinese herb nephropathy'],
  dehydration: ['dehydration', 'dehydrated', 'chronic constipation', 'laxative abuse', 'laxative misuse'],
  lineInfection: ['cellulitis', 'line infection', 'line-site infection', 'cannula site infection', 'phlebitis', 'injection site infection'],
  fever: ['fever', 'pyrexia', 'febrile'],
  liverDisease: ['cirrhosis', 'chronic liver disease', 'liver disease', 'hepatitis', 'fatty liver', 'nafld', 'masld', 'hepatic impairment'],
  thyroidDisease: ['thyroid', 'hypothyroid', 'hyperthyroid', 'graves', 'hashimoto', 'thyroiditis', 'goitre', 'goiter'],
};

/** Prompt text by id (throws on an unknown id: a programming error caught by the tests). */
export function supplementPrompt(id: string): SupplementPromptText {
  const p = SUPPLEMENT_PROMPTS.find(x => x.id === id);
  if (!p) throw new Error(`unknown supplement prompt "${id}"`);
  return p;
}

// ── Lookup ───────────────────────────────────────────────────────────────────────────────

const byId = new Map(SUPPLEMENT_ITEMS.map(i => [i.id, i]));

export function supplementById(id: string | null | undefined): SupplementItem | undefined {
  return id ? byId.get(id) : undefined;
}

/** Every name of an item (lowercased): the term's members, or the item's own `names`. */
export function supplementNames(item: SupplementItem): string[] {
  if (item.term) return (DRUG_TERMS[item.term]?.members ?? []).flatMap(m => parseMember(m).names);
  return parseMember(item.names).names;
}

/** Catalogue items named in a free-text entry (whole words, case-insensitive), in catalogue order. */
export function matchSupplements(text: string): SupplementItem[] {
  const lc = text.trim().toLowerCase();
  if (!lc) return [];
  return SUPPLEMENT_ITEMS.filter(item => supplementNames(item).some(n => containsWholeWord(n, lc)));
}

/** Search for the picker: label or any name starting with / containing the query. */
export function searchSupplements(query: string): SupplementItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SUPPLEMENT_ITEMS;
  return SUPPLEMENT_ITEMS.filter(item =>
    item.label.toLowerCase().includes(q) || supplementNames(item).some(n => n.includes(q)));
}

/**
 * Clinician-facing perioperative alert:
 * "Supplement: <name> — <concern>. Commonly cited stop time: <…> before elective surgery (source)."
 * Informational only — the clinician decides; nothing is stopped automatically.
 */
export function perioperativeAlertText(item: SupplementItem): string {
  const stop = item.stopTime ? ` Commonly cited stop time: ${item.stopTime} before elective surgery` : '';
  return `Supplement: ${item.label} — ${item.concern}.${stop} (${item.source}).`;
}

// ── Recorded history (patient-level; stored in patients.pathway_data_json "supplements") ──

export type SupplementStatus = 'not_asked' | 'none' | 'taking';

export interface SupplementEntry {
  id: string;
  /** Catalogue id when the entry names a catalogue item, else null (free text). */
  catalogueId: string | null;
  /** What the patient takes, as recorded ("Garlic (supplement)", "cerasee tea"). */
  name: string;
  /** Dose / how often / why, free text. */
  details: string;
}

export interface SupplementHistory {
  status: SupplementStatus;
  entries: SupplementEntry[];
  /** When the question was last answered (ISO 8601, seconds precision), or null. */
  askedAt: string | null;
}

export const EMPTY_SUPPLEMENT_HISTORY: SupplementHistory = { status: 'not_asked', entries: [], askedAt: null };

/** Tolerant reader for stored JSON (unknown / missing keys → defaults; never throws). */
export function normaliseSupplementHistory(raw: unknown): SupplementHistory {
  if (!raw || typeof raw !== 'object') return EMPTY_SUPPLEMENT_HISTORY;
  const r = raw as Record<string, unknown>;
  const entries: SupplementEntry[] = Array.isArray(r.entries)
    ? r.entries.flatMap((e, i) => {
        if (!e || typeof e !== 'object') return [];
        const x = e as Record<string, unknown>;
        const name = typeof x.name === 'string' ? x.name.trim() : '';
        if (!name) return [];
        return [{
          id: typeof x.id === 'string' && x.id ? x.id : `entry-${i}`,
          catalogueId: typeof x.catalogueId === 'string' && byId.has(x.catalogueId) ? x.catalogueId : null,
          name,
          details: typeof x.details === 'string' ? x.details : '',
        }];
      })
    : [];
  const status: SupplementStatus = entries.length > 0 ? 'taking'
    : r.status === 'none' ? 'none'
    : r.status === 'taking' ? 'taking'
    : 'not_asked';
  return { status, entries, askedAt: typeof r.askedAt === 'string' ? r.askedAt : null };
}

/** ISO 8601 without fractional seconds (iOS JSONDecoder `.iso8601` rejects milliseconds). */
export function isoSeconds(d: Date = new Date()): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Catalogue items of the recorded entries (by stored id, else by the entry's words), de-duplicated. */
export function recordedSupplementItems(h: SupplementHistory): SupplementItem[] {
  const out: SupplementItem[] = [];
  for (const e of h.entries) {
    const items = [supplementById(e.catalogueId), ...matchSupplements(e.name)].filter(Boolean) as SupplementItem[];
    for (const it of items) if (!out.includes(it)) out.push(it);
  }
  return out;
}

/** Entry strings for the drug-interaction screen (a recorded supplement is screened like a drug). */
export function supplementInteractionEntries(h: SupplementHistory): string[] {
  return h.entries.map(e => {
    const item = supplementById(e.catalogueId);
    // A catalogue entry always carries a name the term matches (its label may be free text).
    return item?.term && !matchSupplements(e.name).includes(item) ? `${e.name} (${item.label})` : e.name;
  });
}

/** SOAP / note background line. */
export function supplementNoteLine(h: SupplementHistory): string {
  if (h.status === 'not_asked' && h.entries.length === 0) return 'Supplements: not asked.';
  if (h.entries.length === 0) return h.status === 'none' ? 'Supplements: none reported.' : 'Supplements: taking (not named).';
  const list = h.entries.map(e => (e.details.trim() ? `${e.name} (${e.details.trim()})` : e.name));
  return `Supplements: ${list.join('; ')}.`;
}

// ── Stored JSON (patients.pathway_data_json, shared with iOS PathwayData) ─────────────────

/** Parse a stored pathway_data_json string; unknown / broken JSON → {}. */
export function parsePathwayJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** The JSON to write: `existing` with only its `supplements` key replaced. */
export function mergeSupplementsIntoPathwayJson(existing: unknown, history: SupplementHistory): string {
  const obj = parsePathwayJson(existing);
  obj.supplements = {
    status: history.entries.length > 0 ? 'taking' : history.status,
    entries: history.entries.map(e => ({ id: e.id, catalogueId: e.catalogueId, name: e.name, details: e.details })),
    askedAt: history.askedAt,
  };
  return JSON.stringify(obj);
}
