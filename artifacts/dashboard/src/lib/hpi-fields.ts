/**
 * The questions the Adaptive HPI card (HpiTab) and the CC strip (ChiefComplaintStrip) ask for a
 * complaint.
 *
 * A curated CC template (cc-matrices.ts) keeps its own prompts. Any other complaint — a typed one,
 * an intake symptom, "Other / general surgical" — gets the history frame for its symptom type
 * (@workspace/triage-engine/history-frames): SOCRATES for pain, the cough / lump / bleeding …
 * questions otherwise. Before, every such complaint fell back to the pain SOCRATES of
 * "Other / general surgical" (abdominal sites for a cough), and the first-word template match sent
 * "Abdominal pain" to the abdominal-mass template and "Upper abdominal pain" to the upper GI bleed
 * one (docs/clinical-validation/changes/history-by-complaint.md).
 */

import { getMatrixByName, type CCPromptField, type CCTemplate } from '@/lib/cc-matrices';
import { SYMPTOM_BRANCHES, type SymptomBranch } from '@/lib/symptom-branches';
import {
  resolveFrame, webKeyFor, type FrameDimension, type ResolvedFrame,
} from '@workspace/triage-engine/history-frames';

/** SmartSymptomPicker branch question → answer key (HpiTab and ChiefComplaintStrip). */
export const BRANCH_KEY: Record<string, string> = {
  'Location': 'site',       'Site': 'site',           'Site / radiation': 'site',
  'Character': 'character', 'Type': 'character',      'Colour': 'character',
  'Associated': 'assoc',    'Associated features': 'assoc', 'Associated symptoms': 'assoc',
  'Onset': 'onset',         'Onset / duration': 'onset',
  'Radiation': 'radiation', 'Spread': 'radiation',
  'Severity': 'severity',   'Amount': 'severity',
  'Timing': 'timing',       'Pattern': 'timing',      'Frequency': 'timing',
  'Triggers': 'triggers',   'Exacerbating factors': 'triggers',
  'Relief': 'relief',
  'Timeframe': 'duration',  'Duration': 'duration',
};

export const MULTI_KEYS = new Set([
  'assoc', 'associated', 'symptoms', 'sympt', 'systemic', 'risk', 'alarm',
  'aggravating', 'aggravating_factors', 'relieving', 'relieving_factors',
  'triggers', 'relief', 'timing', 'radiation', 'spread',
  // Checklist-style fields where multiple simultaneous findings are the clinical
  // norm, not the exception (verified against each field's own hint text in
  // cc-matrices.ts, which lists discrete co-occurring items). Previously missing
  // from this set, so selecting a second chip silently erased the first
  // (e.g. "Fever" replacing "Tachycardia" instead of both being recorded) --
  // a real clinical-documentation data-loss bug, not just a UX nitpick.
  'sepsis', 'signs', 'infection', 'alvarado', 'blatchford', 'ranson',
  'reynolds', 'chronic', 'staging', 'compressive', 'gi', 'haemodynamic',
]);

export interface HpiField {
  key: string;
  label: string;
  chips: string[];
  multi: boolean;
  /** A SmartSymptomPicker branch question. */
  triage: boolean;
  /** The history-frame question (frame fields only): exclusive chips, question text. */
  dim?: FrameDimension;
}

export interface HpiFieldSet {
  fields: HpiField[];
  /** Curated CC template, or undefined when the history frame supplies the questions. */
  template?: CCTemplate;
  /** The history frame for the complaint (always resolved, for the frame switcher). */
  frame: ResolvedFrame;
}

// Prefixes that qualify a complaint name but don't identify the symptom branch
const LEADING_ADJ = /^(acute|chronic|upper|lower|left|right|bilateral|recurrent|unexplained|suspected|possible|mild|moderate|severe|strangulated|irreducible|obstructive|perforated|anastomotic)\s+/;

export function findBranches(complaint: string): SymptomBranch[] {
  // Strip parenthetical qualifiers e.g. "(haematemesis / melaena)"
  const clean = complaint.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();

  if (SYMPTOM_BRANCHES[clean]) return SYMPTOM_BRANCHES[clean];

  // Try each slash-separated segment with and without a leading adjective
  // e.g. 'Nausea / vomiting' → 'nausea' (miss) → 'vomiting' (hit)
  for (const seg of clean.split(/\s*\/\s*/)) {
    const s = seg.trim();
    if (!s) continue;
    if (SYMPTOM_BRANCHES[s]) return SYMPTOM_BRANCHES[s];
    const st = s.replace(LEADING_ADJ, '');
    if (st !== s && SYMPTOM_BRANCHES[st]) return SYMPTOM_BRANCHES[st];
  }

  // Strip leading adjective from the full name
  // e.g. 'Acute abdominal pain' → 'abdominal pain'; 'Obstructive jaundice' → 'jaundice'
  const stripped = clean.replace(LEADING_ADJ, '');
  if (stripped !== clean && SYMPTOM_BRANCHES[stripped]) return SYMPTOM_BRANCHES[stripped];

  // Trailing n-gram (n = 3 → 1): 'inguinal / groin hernia' → 'hernia'
  const words = clean.replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  for (let n = Math.min(words.length - 1, 3); n >= 1; n--) {
    const phrase = words.slice(-n).join(' ');
    if (SYMPTOM_BRANCHES[phrase]) return SYMPTOM_BRANCHES[phrase];
  }

  return [];
}

/** The curated template for a complaint, unless the clinician switched frame or none matches. */
export function templateFor(complaint: string, frameOverride?: string | null): CCTemplate | undefined {
  if (frameOverride) return undefined;
  const tpl = getMatrixByName(complaint);
  return tpl.id === 'other_surgical' ? undefined : tpl;
}

/** Triage branch questions, then the template's prompts or the history frame's questions. */
export function hpiFieldSet(complaint: string, frameOverride?: string | null): HpiFieldSet {
  const frame = resolveFrame(complaint, undefined, frameOverride);
  const template = templateFor(complaint, frameOverride);
  const seen = new Set<string>();
  const seenLabels = new Set<string>();
  const fields: HpiField[] = [];

  for (const b of findBranches(complaint)) {
    const key = BRANCH_KEY[b.question] ?? b.question.toLowerCase().replace(/\W+/g, '_');
    if (seen.has(key)) continue;
    seen.add(key);
    seenLabels.add(b.question.toLowerCase());
    fields.push({ key, label: b.question, chips: b.options, multi: MULTI_KEYS.has(key), triage: true });
  }

  if (template) {
    for (const p of template.prompts) {
      if (seen.has(p.key)) continue;
      seen.add(p.key);
      fields.push({ key: p.key, label: p.label, chips: parseChips(p.hint), multi: MULTI_KEYS.has(p.key), triage: false });
    }
  } else {
    for (const d of frame.dimensions) {
      const key = webKeyFor(d);
      if (seen.has(key) || seenLabels.has(d.title.toLowerCase())) continue;
      seen.add(key);
      fields.push({ key, label: d.title, chips: d.options.map(o => o.label), multi: d.multiSelect, triage: false, dim: d });
    }
  }
  return { fields, template, frame };
}

export function buildFields(complaint: string, frameOverride?: string | null): HpiField[] {
  return hpiFieldSet(complaint, frameOverride).fields;
}

/**
 * CC-strip prompts (ChiefComplaintStrip's one-question card): the template's prompts, or the
 * history frame's questions as prompts (chips joined into the hint; `multi` from the frame).
 */
export function historyPrompts(complaint: string, frameOverride?: string | null): (CCPromptField & { multi?: boolean; dim?: FrameDimension })[] {
  const template = templateFor(complaint, frameOverride);
  if (template) return template.prompts;
  return resolveFrame(complaint, undefined, frameOverride).dimensions.map(d => ({
    key: webKeyFor(d), label: d.title, hint: d.options.map(o => o.label).join(' · '), multi: d.multiSelect, dim: d,
  }));
}

export function parseChips(hint: string): string[] {
  if (!hint) return [];
  return hint.split(/\s*[·→]\s*/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 60);
}
