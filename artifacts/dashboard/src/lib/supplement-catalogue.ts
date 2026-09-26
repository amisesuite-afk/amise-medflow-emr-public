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
 * The content lives once, as data: clinical-content/rules/supplement-catalogue.json (schema
 * clinical-content/schemas/supplement-catalogue.schema.json). iOS reads the same file
 * (`ios/AmiseMedFlow/Services/SupplementCatalogue.swift`, bundled folder "rules"). Change the JSON,
 * not a platform copy: `lint:shared-content` validates it and checks these types and the Swift
 * Codable structs against the schema; `lint:interaction-parity` checks that every item's `term`
 * exists on both platforms. Caribbean bush teas (cerasee, soursop leaf, …) are deliberately NOT
 * items: their pharmacology is not in the briefing — see "Needs sign-off" in
 * docs/clinical-validation/changes/supplements-interactions.md. Registered in
 * clinical-content/registry.json (`supplement-catalogue`); bump the JSON `version` with a changelog.
 */
import rawSupplementCatalogue from '../../../../clinical-content/rules/supplement-catalogue.json';
import { DRUG_TERMS, containsWholeWord, parseMember } from './drug-classes';

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

export interface SupplementPromptText { id: string; title: string; detail: string }

/** Shared wording (clinician heading, patient question, rationale, approved patient paragraph). */
export interface SupplementWording {
  sectionTitle: string;
  patientQuestion: string;
  disclosureRationale: string;
  herbalPreOpPatientText: string;
}

/** clinical-content/rules/supplement-catalogue.json (checked against its schema by lint:shared-content). */
export interface SupplementCatalogueContent {
  id: string;
  version: string;
  items: SupplementItem[];
  text: SupplementWording;
  prompts: SupplementPromptText[];
  triggerTerms: Record<string, string[]>;
}

const CONTENT = rawSupplementCatalogue as SupplementCatalogueContent;

export const SUPPLEMENT_CATALOGUE_VERSION: string = CONTENT.version;

export const SUPPLEMENT_ITEMS: SupplementItem[] = CONTENT.items;

// ── Shared wording (the same JSON fields on iOS) ─────────────────────────────────────────

/** Clinician-facing heading of the structured history item. */
export const SUPPLEMENT_SECTION_TITLE: string = CONTENT.text.sectionTitle;

/** Patient question (front-desk questionnaire, web intake, iOS questionnaire). Asks; never instructs. */
export const SUPPLEMENT_PATIENT_QUESTION: string = CONTENT.text.patientQuestion;

/** Why the question is mandatory (clinician help text). */
export const SUPPLEMENT_DISCLOSURE_RATIONALE: string = CONTENT.text.disclosureRationale;

/**
 * Patient pre-op text for herbal products — surgeon decision 2026-09-25 (docs/clinical-validation/
 * SURGEON-DECISIONS.md). The same words are in the front-desk instructions and the api-server prep
 * templates; `lint:patient-instructions` pins them. Prescribed medicines stay under hazard H-10.
 */
export const HERBAL_PREOP_PATIENT_TEXT: string = CONTENT.text.herbalPreOpPatientText;

// ── Prompts (supplement-prompts.ts; iOS SupplementAlerts.swift) ─────────────────────────────
// Clinician-facing "ask about" prompts and alerts. Each only suggests a question or shows a
// concern; none changes the record. Trigger words are matched negation-aware.

export const SUPPLEMENT_PROMPTS: SupplementPromptText[] = CONTENT.prompts;

/** Negation-aware trigger words for the prompts (lowercase; matched in the clinical text). */
export const SUPPLEMENT_TRIGGER_TERMS: Record<string, string[]> = CONTENT.triggerTerms;

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
