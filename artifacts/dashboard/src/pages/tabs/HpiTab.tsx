// ─── HpiTab — Adaptive HPI Builder ───────────────────────────────────────────
//
// Merges SYMPTOM_BRANCHES triage questions with CC-matrix SOCRATES prompts into
// a tap-to-fill interview. HPI prose regenerates in real-time as chips are
// selected — same pattern as the Quick Exam tab. No button needed.

import { useMemo, useEffect, useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import SmartTextarea from '@/components/SmartTextarea';
import ChiefComplaintStrip from '@/components/ChiefComplaintStrip';
import { computeRankedDifferentials } from '@/lib/symptom-inference';
import { getSuggestedPhrases } from '@/data/dot-phrases';
import { getMatrixByName } from '@/lib/cc-matrices';
import { SYMPTOM_BRANCHES, type SymptomBranch } from '@/lib/symptom-branches';
import type { EncounterSummary } from '@/lib/db';
import {
  DISEASES, FEATURES, applyModifiers, initPaneState, updatePosterior,
  topDiagnoses, getProtocol, nextBestQuestion,
} from '@workspace/pane-engine';
import type { Feature } from '@workspace/pane-engine';
import { extractFeaturesFromSocrates } from '@/lib/socrates-to-features';
import { isImagingInvestigation, parseImagingToRequest, imagingAlreadyRequested } from '@/lib/imaging-utils';

interface CCEntry { complaint: string; answers: Record<string, string> }

// ── Chip utilities ────────────────────────────────────────────────────────────

function parseChips(hint: string): string[] {
  if (!hint) return [];
  return hint.split(/\s*[·→]\s*/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 60);
}
function strip(opt: string): string { return opt.replace(/\s*\([^)]*\)/g, '').trim(); }
function toggleChip(current: string, label: string, multi: boolean): string {
  if (multi) {
    const parts = current.split(',').map(s => s.trim()).filter(Boolean);
    return parts.includes(label) ? parts.filter(p => p !== label).join(', ') : [...parts, label].join(', ');
  }
  return current.trim() === label ? '' : label;
}
function isActive(current: string, opt: string): boolean {
  return current.split(',').map(s => s.trim()).includes(strip(opt));
}

// ── SYMPTOM_BRANCHES → SOCRATES key map ──────────────────────────────────────

const BRANCH_KEY: Record<string, string> = {
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
const MULTI_KEYS = new Set([
  'assoc', 'associated', 'symptoms', 'sympt', 'systemic', 'risk', 'alarm',
  'aggravating', 'aggravating_factors', 'relieving', 'relieving_factors',
  'triggers', 'relief', 'timing', 'radiation', 'spread',
]);

// ── Field type ────────────────────────────────────────────────────────────────

interface HpiField { key: string; label: string; chips: string[]; multi: boolean; triage: boolean }

// Prefixes that qualify a complaint name but don't identify the symptom branch
const LEADING_ADJ = /^(acute|chronic|upper|lower|left|right|bilateral|recurrent|unexplained|suspected|possible|mild|moderate|severe|strangulated|irreducible|obstructive|perforated|anastomotic)\s+/;

function findBranches(complaint: string): SymptomBranch[] {
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

function buildFields(complaint: string): HpiField[] {
  const branches = findBranches(complaint);
  const matrix = getMatrixByName(complaint);

  const seen = new Set<string>();
  const fields: HpiField[] = [];

  for (const b of branches) {
    const key = BRANCH_KEY[b.question] ?? b.question.toLowerCase().replace(/\W+/g, '_');
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({ key, label: b.question, chips: b.options, multi: MULTI_KEYS.has(key), triage: true });
  }

  for (const p of matrix.prompts) {
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    const chips = parseChips(p.hint);
    fields.push({ key: p.key, label: p.label, chips, multi: MULTI_KEYS.has(p.key), triage: false });
  }

  return fields;
}

// ── HpiBuilderCard — sequential one-question-at-a-time SOCRATES interview ─────

function HpiBuilderCard({ entry, onAnswerChange, onReset, paneNextQuestion }: {
  entry: CCEntry;
  onAnswerChange: (key: string, value: string) => void;
  onReset: () => void;
  paneNextQuestion?: Feature | null;
}) {
  const rawFields = useMemo(() => buildFields(entry.complaint), [entry.complaint]);
  const matrix    = getMatrixByName(entry.complaint);
  const { age, sex } = useAppContext();
  const ageNum = parseInt(age, 10) || null;
  // Filter out fields that don't apply to this patient's sex or age.
  // LMP is only relevant for females of potentially fertile age (≥10 y).
  const fields = useMemo(() => rawFields.filter(f => {
    if (f.key === 'lmp') return sex === 'female' && (ageNum === null || ageNum >= 10);
    return true;
  }), [rawFields, sex, ageNum]);
  const filled  = fields.filter(f => entry.answers[f.key]?.trim()).length;

  // openIdx: which field is currently expanded for input.
  // fields.length = all answered, no field open.
  const [openIdx, setOpenIdx] = useState(() => {
    const first = fields.findIndex(f => !entry.answers[f.key]?.trim());
    return first >= 0 ? first : fields.length;
  });

  // Reset to first unanswered when complaint changes
  useEffect(() => {
    const first = fields.findIndex(f => !entry.answers[f.key]?.trim());
    setOpenIdx(first >= 0 ? first : fields.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.complaint]);

  // Return to field 0 after ↺ Clear (all answers wiped)
  useEffect(() => {
    if (filled === 0) setOpenIdx(0);
  }, [filled]);

  function advance(fromIdx: number) {
    setOpenIdx(fromIdx + 1); // may become fields.length (= all done, no open field)
  }

  function handleChip(idx: number, field: HpiField, chip: string) {
    const val = toggleChip(entry.answers[field.key] ?? '', strip(chip), field.multi);
    onAnswerChange(field.key, val);
    // Auto-advance after single-select chip selection
    if (!field.multi && val.trim()) {
      setTimeout(() => advance(idx), 300);
    }
  }

  return (
    <div style={{ background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b', overflow: 'hidden', marginBottom: 10 }}>

      {/* ── Card header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', borderBottom: '1px solid #1e293b', background: '#070d1a',
      }}>
        <span style={{ fontSize: 12 }}>{matrix.icon ?? '📋'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{entry.complaint}</span>
        {filled > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#064e3b', color: '#34d399' }}>
            {filled}/{fields.length} answered
          </span>
        )}
        <button
          type="button"
          onClick={onReset}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid #334155', background: 'transparent', color: '#64748b', cursor: 'pointer' }}
        >
          ↺ Clear
        </button>
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>

        {fields.map((field, idx) => {
          const value    = entry.answers[field.key] ?? '';
          const isOpen   = idx === openIdx;
          const answered = value.trim().length > 0;

          // Hide fields not yet reached (unanswered and beyond current question)
          if (!answered && !isOpen) return null;

          const accent = field.triage ? '#0d9488' : '#3b82f6';

          // ── Compact answered row ──
          if (answered && !isOpen) {
            return (
              <button
                key={field.key}
                type="button"
                onClick={() => setOpenIdx(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${accent}30`, background: `${accent}0a`,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 70, flexShrink: 0 }}>
                  {field.label}
                </span>
                <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                  {value.length > 52 ? value.slice(0, 50) + '…' : value}
                </span>
                <span style={{ fontSize: 10, color: accent, flexShrink: 0 }}>✎</span>
              </button>
            );
          }

          // ── Expanded (active) field ──
          const isLast = idx === fields.length - 1;
          return (
            <div key={field.key} style={{
              display: 'flex', flexDirection: 'column', gap: 7,
              padding: '10px 12px', borderRadius: 9,
              border: `1.5px solid ${accent}55`, background: '#070d1a',
              marginTop: idx > 0 && fields[idx - 1] && (entry.answers[fields[idx - 1].key] ?? '').trim() ? 4 : 0,
            }}>
              {/* Label + counter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {field.label}
                </span>
                {field.triage && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, border: `1px solid ${accent}`, color: accent }}>
                    TRIAGE
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#334155' }}>
                  {idx + 1} / {fields.length}
                </span>
              </div>

              {/* PANE next-best-question hint — shown only on the active field */}
              {paneNextQuestion && (
                <div style={{
                  fontSize: 10, color: '#0d9488',
                  background: 'rgba(13,148,136,0.08)',
                  border: '1px solid rgba(13,148,136,0.2)',
                  padding: '3px 8px', borderRadius: 5,
                  display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
                }}>
                  <span>🎯</span>
                  <span>Most discriminating: <strong>{paneNextQuestion.label}</strong></span>
                </div>
              )}

              {/* Chips */}
              {field.chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {field.chips.map(chip => {
                    const active = isActive(value, chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleChip(idx, field, chip)}
                        style={{
                          padding: '5px 13px', borderRadius: 20, fontSize: 12,
                          fontWeight: active ? 700 : 400, cursor: 'pointer',
                          border: `1px solid ${active ? accent : '#334155'}`,
                          background: active ? accent : '#1e293b',
                          color: active ? '#fff' : '#94a3b8',
                          transition: 'all 0.12s',
                        }}
                      >
                        {strip(chip)}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Text input + Next button */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={value}
                  onChange={e => onAnswerChange(field.key, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !isLast) advance(idx); }}
                  placeholder={field.chips.length > 0 ? 'Add detail or type custom answer…' : `${field.label}…`}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12, outline: 'none',
                    border: `1px solid ${value ? accent : '#1e293b'}`,
                    background: '#0a0f1e', color: '#e2e8f0',
                    transition: 'border-color 0.1s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = accent)}
                  onBlur={e => (e.currentTarget.style.borderColor = value ? accent : '#1e293b')}
                />
                {!isLast && (
                  <button
                    type="button"
                    onClick={() => advance(idx)}
                    style={{
                      padding: '6px 13px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      border: `1px solid ${accent}`, background: 'transparent',
                      color: accent, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {fields.length === 0 && (
          <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>
            No structured questions available — document in the HPI narrative below.
          </div>
        )}
      </div>
    </div>
  );
}

// ── prose utilities ───────────────────────────────────────────────────────────

function lc(s: string): string {
  if (!s) return s;
  // Preserve all-caps anatomical abbreviations: RUQ, RIF, LIF, LUQ, RLQ, etc.
  if (s.length >= 2 && /^[A-Z]{2}/.test(s)) return s.trimEnd();
  return s.charAt(0).toLowerCase() + s.slice(1).trimEnd();
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Lowercase every comma-separated item in a list (handles "Nausea, Vomiting, Fever" → "nausea, vomiting, fever")
function lcList(s: string): string {
  return s.split(',').map(item => {
    const t = item.trim();
    if (!t) return t;
    if (t.length >= 2 && /^[A-Z]{2}/.test(t)) return t; // preserve abbreviations
    return t.charAt(0).toLowerCase() + t.slice(1);
  }).join(', ');
}

function primaryNoun(cc: string): string {
  if (/pain/.test(cc))                  return 'pain';
  if (/bleed|haemorrhage/.test(cc))     return 'bleeding';
  if (/swelling|lump|mass/.test(cc))    return 'swelling';
  if (/dysphagia/.test(cc))             return 'dysphagia';
  if (/dyspnoea|breath/.test(cc))       return 'dyspnoea';
  if (/nausea|vomit/.test(cc))          return 'vomiting';
  if (/jaundice/.test(cc))              return 'jaundice';
  if (/wound/.test(cc))                 return 'wound';
  return cc.split(' ')[0] ?? 'symptom';
}

function durPhrase(durationDays: string): string {
  const d = parseInt(durationDays, 10);
  if (!d) return '';
  if (d === 1) return 'a 1-day';
  if (d < 7)   return `a ${d}-day`;
  const w = Math.round(d / 7);
  return w === 1 ? 'a 1-week' : `a ${w}-week`;
}

function get(ans: Record<string, string>, ...keys: string[]): string {
  return keys.map(k => ans[k]?.trim()).find(v => v && v.length > 0) ?? '';
}

function composeHpiNarrative(
  entries: CCEntry[],
  age: string,
  sex: string,
  patientName: string,
  symptoms: string[],
  durationDays: string,
  painScore: string,
  freeText: string,
): string {
  const agePart   = age  ? `${age}-year-old` : '';
  const sexPart   = sex && sex !== 'unknown' ? sex : '';
  const demo      = [agePart, sexPart].filter(Boolean).join(' ');
  const firstName = patientName.trim().split(' ')[0] ?? '';
  const subject   = firstName ? `${firstName}, a ${demo},` : demo ? `A ${demo}` : 'The patient';
  const dur       = durPhrase(durationDays);
  const durClause = dur ? `${dur} history of` : 'a history of';
  const paragraphs: string[] = [];

  if (entries.length === 0) {
    const cc = symptoms.length > 0 ? symptoms.join(' and ') : 'presenting complaints';
    paragraphs.push(`${cap(subject)} presenting with ${durClause} ${cc}.`);
    if (freeText.trim()) paragraphs.push(cap(lc(freeText.trim())));
    return paragraphs.join('\n\n');
  }

  entries.forEach((entry, idx) => {
    const ans  = entry.answers;
    const noun = primaryNoun(entry.complaint.toLowerCase());

    const ccDuration  = get(ans, 'duration');
    const onset       = get(ans, 'onset', 'presentation');
    const site        = get(ans, 'site');
    const character   = get(ans, 'character');
    const radiation   = get(ans, 'radiation', 'direction');
    const timing      = get(ans, 'timing');
    const assoc       = get(ans, 'assoc', 'symptoms', 'sympt', 'systemic');
    const severity    = get(ans, 'severity', 'qol');
    const exac        = get(ans, 'triggers', 'exac');
    const relief      = get(ans, 'response', 'relief');
    const prev        = get(ans, 'prev', 'prevep', 'previous', 'history');
    const fever       = get(ans, 'fever');
    const vomiting    = get(ans, 'vomiting');
    const bleeding    = get(ans, 'bleeding', 'bleed');
    const weightloss  = get(ans, 'weight', 'weightloss');
    const jaundice    = get(ans, 'jaundice');
    const meds        = get(ans, 'meds', 'therapy');

    // Per-entry duration: CC chip "duration" key beats the context durationDays field
    const entryDurClause = ccDuration
      ? formatCcDur(ccDuration)
      : durClause;

    let open = idx === 0
      ? `${cap(subject)} presents with ${entryDurClause} ${lc(entry.complaint)}`
      : `Additionally, ${lc(entry.complaint)}`;
    if (onset && onset.length <= 100) open += `, ${lc(onset)}`;
    paragraphs.push(open + '.');

    const locParts: string[] = [];
    if (site)      locParts.push(`localised to the ${lc(site)}`);
    if (radiation) locParts.push(`radiating to ${lc(radiation)}`);
    if (character) locParts.push(`${lc(character)} in character`);
    if (timing)    locParts.push(lc(timing));
    if (locParts.length) paragraphs.push(`The ${noun} is ${locParts.join(', ')}.`);

    const assocItems: string[] = [];
    if (assoc)      assocItems.push(lcList(assoc));
    if (fever)      assocItems.push(`fever — ${lc(fever)}`);
    if (vomiting)   assocItems.push(`vomiting — ${lc(vomiting)}`);
    if (bleeding)   assocItems.push(`bleeding — ${lc(bleeding)}`);
    if (weightloss) assocItems.push(`weight loss — ${lc(weightloss)}`);
    if (jaundice)   assocItems.push(`jaundice — ${lc(jaundice)}`);
    if (assocItems.length) paragraphs.push(`Associated features include ${assocItems.join('; ')}.`);

    const modParts: string[] = [];
    // Numeric severity from CC matrix chips and free-text pain score both become "Pain rated X/10"
    const severityNum = severity ? parseInt(severity.trim(), 10) : NaN;
    const effectiveScore = !isNaN(severityNum) ? String(severityNum) : (painScore && idx === 0 ? painScore : '');
    if (effectiveScore) modParts.push(`Pain is rated ${effectiveScore}/10`);
    // Non-numeric severity text (e.g. "Moderate", "Worst of life") rendered as-is
    if (severity && isNaN(severityNum)) modParts.push(cap(lc(severity)));
    if (exac)  modParts.push(`Aggravated by ${lcList(exac)}`);
    if (relief) modParts.push(`Relieved by ${lcList(relief)}`);
    if (modParts.length) paragraphs.push(modParts.join('. ') + '.');

    const histParts: string[] = [];
    if (prev) histParts.push(cap(lc(prev)));
    if (meds) histParts.push(cap(lc(meds)));
    if (histParts.length) paragraphs.push(histParts.join('. ') + '.');
  });

  if (freeText.trim()) {
    paragraphs.push(`In the patient's own words: ${lc(freeText.trim())}.`);
  }

  return paragraphs.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Medical Background Strip ──────────────────────────────────────────────────

function MedBgChips({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 9, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {items.slice(0, 5).map(item => (
        <span key={item} style={{
          fontSize: 11, padding: '1px 7px', borderRadius: 10,
          background: `${color}18`, color, border: `1px solid ${color}44`,
        }}>{item}</span>
      ))}
      {items.length > 5 && (
        <span style={{ fontSize: 10, color: '#64748b' }}>+{items.length - 5} more</span>
      )}
    </div>
  );
}

function MedicalBackgroundStrip({ comorbidities, allergies, medications, surgicalHistory }: {
  comorbidities: string[];
  allergies: string;
  medications: string[];
  surgicalHistory: string[];
}) {
  const allergyItems = allergies.split(',').map(s => s.trim()).filter(Boolean);
  const hasAny = comorbidities.length || allergyItems.length || medications.length || surgicalHistory.length;
  if (!hasAny) return null;

  const nkda = allergyItems.length === 1 && /nkda|no known/i.test(allergyItems[0]);

  return (
    <div style={{
      borderRadius: 8, border: '1px solid #1e293b',
      background: '#080f1e', padding: '8px 12px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>
        Patient background
      </div>
      <MedBgChips label="PMH" items={comorbidities} color="#f59e0b" />
      {allergyItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: nkda ? '#22c55e' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Allergies
          </span>
          {nkda
            ? <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>NKDA</span>
            : allergyItems.slice(0, 5).map(a => (
                <span key={a} style={{
                  fontSize: 11, padding: '1px 7px', borderRadius: 10,
                  background: '#ef444418', color: '#ef4444', border: '1px solid #ef444444',
                  fontWeight: 700,
                }}>{a}</span>
              ))
          }
          {allergyItems.length > 5 && <span style={{ fontSize: 10, color: '#64748b' }}>+{allergyItems.length - 5}</span>}
        </div>
      )}
      <MedBgChips label="Meds" items={medications} color="#3b82f6" />
      <MedBgChips label="Surgical Hx" items={surgicalHistory} color="#8b5cf6" />
    </div>
  );
}

// ── formatCcDur — CC duration chip → prose phrase ────────────────────────────

function formatCcDur(d: string): string {
  const t = d.trim();
  if (!t) return '';
  if (/episodic|recurrent/i.test(t)) return 'an episodic history of';
  const adj = t
    .replace(/^<\s*/, 'less than ')
    .replace(/^>\s*/, 'more than ')
    .replace(/–/g, '–') // keep en-dash
    .replace(/\s+days?\b/gi, '-day')
    .replace(/\s+hours?\b/gi, '-hour')
    .replace(/\s+weeks?\b/gi, '-week')
    .replace(/\s*\/\s*(recurrent|ongoing|episodic)/i, '')
    .trim();
  return `a ${adj} history of`;
}

// ── AgeGenderGate — required before HPI content ───────────────────────────────

function AgeGenderGate({ age, setAge, sex, setSex }: {
  age: string;
  setAge: (v: string) => void;
  sex: string;
  setSex: (v: string) => void;
}) {
  const ageMissing = !age.trim();
  const sexMissing = !sex || sex === 'unknown';
  if (!ageMissing && !sexMissing) return null;

  return (
    <div style={{
      borderRadius: 8, border: '2px solid #f59e0b',
      background: 'rgba(245,158,11,0.08)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fcd34d' }}>
          Age and sex required to generate HPI prose
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Age (years)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            step={1}
            value={age}
            onChange={e => setAge(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 45"
            autoFocus={ageMissing}
            style={{
              width: 90, padding: '6px 10px', borderRadius: 6, fontSize: 14,
              border: `2px solid ${ageMissing ? '#f59e0b' : '#334155'}`,
              background: '#070d1a', color: '#f1f5f9',
              outline: 'none', fontWeight: 600,
            }}
          />
        </div>
        {sexMissing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Sex
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['male', 'female', 'other'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  style={{
                    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer',
                    border: `2px solid ${sex === s ? '#f59e0b' : '#334155'}`,
                    background: sex === s ? '#f59e0b' : '#1e293b',
                    color: sex === s ? '#000' : '#94a3b8',
                    transition: 'all 0.1s',
                    textTransform: 'capitalize',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const TZ = 'America/St_Lucia';

function fmtEncDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-LC', {
      timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ── PriorEncounterCard ────────────────────────────────────────────────────────

function PriorEncounterCard({
  enc, onPullHistory,
}: {
  enc: EncounterSummary;
  onPullHistory: (enc: EncounterSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const days = daysSince(enc.createdAt);
  const daysLabel = days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;

  return (
    <div style={{
      border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', background: '#0a1628',
    }}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10, color: open ? '▾' : '▸' }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 68 }}>{fmtEncDate(enc.createdAt)}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
          background: '#1e3a5f', color: '#60a5fa', letterSpacing: '0.04em',
        }}>
          {enc.encounterType.replace('_', ' ').toUpperCase()}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {enc.chiefComplaint ?? '—'}
        </span>
        <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{daysLabel}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 10px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>

            {(enc.diagnosis || enc.icd10Code) && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', minWidth: 52 }}>Dx</span>
                <span style={{ fontSize: 12, color: '#e2e8f0' }}>
                  {enc.diagnosis ?? ''}
                  {enc.icd10Code ? <span style={{ color: '#64748b', marginLeft: 5 }}>({enc.icd10Code})</span> : null}
                </span>
              </div>
            )}

            {enc.planDescription && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', minWidth: 52 }}>Plan</span>
                <span style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
                  {enc.planDescription.length > 180
                    ? enc.planDescription.slice(0, 178) + '…'
                    : enc.planDescription}
                </span>
              </div>
            )}

            {enc.followUpDate && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', minWidth: 52 }}>F/U</span>
                <span style={{ fontSize: 12, color: '#fcd34d' }}>{fmtEncDate(enc.followUpDate)}</span>
                {enc.followUpNotes && (
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>— {enc.followUpNotes}</span>
                )}
              </div>
            )}

            {!enc.diagnosis && !enc.planDescription && !enc.followUpDate && (
              <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>No assessment or plan recorded.</div>
            )}

            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                onClick={() => onPullHistory(enc)}
                style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 5,
                  border: '1px solid #0d9488', background: 'transparent',
                  color: '#0d9488', fontWeight: 700, cursor: 'pointer',
                }}
              >
                ↑ Pull interval history into HPI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ContinuityBanner ──────────────────────────────────────────────────────────

function ContinuityBanner({
  enc, onContinue, onDismiss,
}: {
  enc: EncounterSummary;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  const days = daysSince(enc.createdAt);
  return (
    <div style={{
      borderRadius: 8, border: '1px solid #f59e0b',
      background: 'rgba(245,158,11,0.07)', padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔄</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fcd34d', marginBottom: 2 }}>
            Returning patient — last seen {days === 1 ? '1 day ago' : `${days} days ago`}
          </div>
          <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.4 }}>
            {enc.chiefComplaint && (
              <span>For: <strong>{enc.chiefComplaint}</strong>{enc.diagnosis ? `. Dx: ${enc.diagnosis}` : ''}. </span>
            )}
            Is this a follow-up to that episode?
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            fontSize: 14, lineHeight: 1, background: 'none', border: 'none',
            color: '#64748b', cursor: 'pointer', padding: '0 2px',
          }}
          title="Dismiss"
        >×</button>
      </div>
      <div style={{ display: 'flex', gap: 8, paddingLeft: 24 }}>
        <button
          type="button"
          onClick={onContinue}
          style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 5,
            background: '#0d9488', border: 'none', color: '#fff',
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          Continue episode
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 5,
            border: '1px solid #334155', background: 'transparent',
            color: '#94a3b8', cursor: 'pointer',
          }}
        >
          New problem
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HpiTab() {
  const {
    hpiNotes, setHpiNotes,
    freeText, setFreeText,
    durationDays, setDurationDays,
    painScore, setPainScore,
    symptoms, symptomDetails,
    isPostOp, setIsPostOp,
    postOpDays, setPostOpDays,
    pregnancyPossible, setPregnancyPossible,
    age, setAge, sex, setSex, patientName,
    procedureData, setProcedureData,
    patientId, encounterId,
    recentEncounters,
    comorbidities, allergies, medications, surgicalHistory,
    paneState, setPaneState,
    orderedInvestigations, setOrderedInvestigations,
    radiologyRequests, setRadiologyRequests,
  } = useAppContext();

  const entries = useMemo(
    () => (procedureData['cc'] as CCEntry[] | undefined) ?? [],
    [procedureData],
  );

  // ── Prior encounters (Phase 1 + 2) ──────────────────────────────────────────
  // Filter out the current encounter; show up to 3 most recent
  const priorEncounters = useMemo(
    () => recentEncounters.filter(e => e.id !== encounterId).slice(0, 3),
    [recentEncounters, encounterId],
  );

  // Phase 2: detect returning patient within 180 days
  const mostRecent = priorEncounters[0] ?? null;
  const withinSixMonths = mostRecent ? daysSince(mostRecent.createdAt) <= 180 : false;

  const [continuityDismissed, setContinuityDismissed] = useState(false);
  const [continuityEncId, setContinuityEncId] = useState<string | null>(null);

  // Reset banner when patient changes
  useEffect(() => {
    setContinuityDismissed(false);
    setContinuityEncId(null);
  }, [patientId]);

  const showContinuityBanner =
    !continuityDismissed &&
    withinSixMonths &&
    mostRecent != null &&
    // Don't prompt for acute/emergency prior encounters — continuity only makes sense for outpatient follow-up
    mostRecent.encounterType !== 'emergency' &&
    mostRecent.encounterType !== 'major_emergency' &&
    mostRecent.encounterType !== 'trauma' &&
    // Don't show if HPI already has significant content
    hpiNotes.trim().length < 30;

  function handleContinueEpisode() {
    if (!mostRecent) return;
    setContinuityEncId(mostRecent.id);
    setContinuityDismissed(true);
    // Pre-populate HPI with interval history prompt
    const dateFmt = fmtEncDate(mostRecent.createdAt);
    const days = daysSince(mostRecent.createdAt);
    const dxClause = mostRecent.diagnosis ? ` with ${mostRecent.diagnosis}` : '';
    const priorCC = mostRecent.chiefComplaint ?? 'presenting complaint';
    const intervalDraft =
      `Interval history — follow-up ${days} days since last review (${dateFmt}).\n` +
      `Patient was previously seen for ${priorCC}${dxClause}.\n` +
      (mostRecent.planDescription ? `Prior plan: ${mostRecent.planDescription}\n` : '') +
      `\nInterval: [Document changes since last visit, response to treatment, new symptoms, compliance with plan]`;
    setHpiNotes(intervalDraft);
    prevLiveRef.current = '';
  }

  void continuityEncId; // referenced above; used to highlight linked prior encounter

  const ageNum = age ? Number(age) : null;
  const ranked = useMemo(
    () => computeRankedDifferentials({ symptoms, symptomDetails, age: ageNum, sex }),
    [symptoms, symptomDetails, ageNum, sex],
  );
  const leadingDxId   = (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0]!.id   : null;
  const leadingDxName = (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0]!.name : null;
  const suggestedPhrases = useMemo(() => getSuggestedPhrases(leadingDxId, 4), [leadingDxId]);

  // ── Live prose — recomputes on every chip tap ────────────────────────────────
  const liveProse = useMemo(
    () => composeHpiNarrative(entries, age, sex, patientName, symptoms, durationDays, painScore, freeText),
    [entries, age, sex, patientName, symptoms, durationDays, painScore, freeText],
  );

  // Keep narrative in sync with live prose unless the doctor has manually edited it.
  // We detect "manually edited" by checking if hpiNotes diverges from the previous auto-draft.
  const prevLiveRef = useRef('');
  useEffect(() => {
    if (!liveProse) return;
    if (hpiNotes === '' || hpiNotes === prevLiveRef.current) {
      setHpiNotes(liveProse);
    }
    prevLiveRef.current = liveProse;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveProse]);

  // Re-seed PANE from scratch using all current CC entries' SOCRATES answers.
  // Called on every chip tap so the differential updates in real-time.
  function reseedPane(updatedEntries: CCEntry[]) {
    const parsedAge = parseInt(age, 10) || null;
    const diseases  = applyModifiers(DISEASES, parsedAge, sex);
    let   state     = initPaneState(diseases);
    for (const entry of updatedEntries) {
      const features = extractFeaturesFromSocrates(entry.complaint, entry.answers);
      for (const [featureId, present] of Object.entries(features)) {
        if (FEATURES.some(f => f.id === featureId)) {
          state = updatePosterior(state, diseases, featureId, present as boolean);
        }
      }
    }
    setPaneState(state);
    return state;
  }

  // Seed ordered investigations from top-3 PANE differentials.
  // Only called when an HpiBuilderCard entry has all fields answered.
  function seedInvestigationsFromPane(state: ReturnType<typeof initPaneState>) {
    const parsedAge = parseInt(age, 10) || null;
    const diseases  = applyModifiers(DISEASES, parsedAge, sex);
    const top = topDiagnoses(state, diseases, 3);
    if (!top.length) return;
    const urgencyRank: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };
    const byLabel = new Map<string, { label: string; urgency: 'stat' | 'urgent' | 'routine' }>();
    for (const { disease } of top) {
      const protocol = getProtocol(disease.id);
      if (!protocol?.investigations.length) continue;
      for (const inv of protocol.investigations) {
        const k = inv.label.toLowerCase().trim();
        const cur = byLabel.get(k);
        if (!cur || (urgencyRank[inv.urgency] ?? 2) < (urgencyRank[cur.urgency] ?? 2)) {
          byLabel.set(k, inv);
        }
      }
    }
    const sorted = [...byLabel.values()].sort(
      (a, b) => (urgencyRank[a.urgency] ?? 2) - (urgencyRank[b.urgency] ?? 2),
    );

    // Route: lab items → orderedInvestigations, imaging items → radiologyRequests
    const labItems     = sorted.filter(inv => !isImagingInvestigation(inv.label));
    const imagingItems = sorted.filter(inv => isImagingInvestigation(inv.label));

    const existing = new Set(orderedInvestigations.map((s: string) => s.toLowerCase().trim()));
    const toAdd = labItems.map(inv => inv.label).filter(l => !existing.has(l.toLowerCase().trim()));
    if (toAdd.length) setOrderedInvestigations([...toAdd, ...orderedInvestigations]);

    const newImaging = imagingItems
      .map(inv => parseImagingToRequest(inv.label, inv.urgency))
      .filter(req => !imagingAlreadyRequested(
        (radiologyRequests as { modality: string; anatomicalRegion: string; clinicalQuestion?: string }[]),
        req,
      ));
    if (newImaging.length) setRadiologyRequests([...newImaging, ...radiologyRequests]);
  }

  // Returns SOCRATES fields for an entry filtered by patient sex/age — same as HpiBuilderCard.
  function entryFields(entry: CCEntry): HpiField[] {
    const parsedAge = parseInt(age, 10) || null;
    return buildFields(entry.complaint).filter(f => {
      if (f.key === 'lmp') return sex === 'female' && (parsedAge === null || parsedAge >= 10);
      return true;
    });
  }

  function updateAnswer(entryIdx: number, key: string, value: string) {
    const updated = entries.map((e, i) =>
      i === entryIdx ? { ...e, answers: { ...e.answers, [key]: value } } : e,
    );
    setProcedureData({ ...procedureData, cc: updated });

    // Real-time PANE re-seed: updates differential posteriors as chips are tapped
    const newState = reseedPane(updated);

    // Seed investigation list once the updated entry has all its sex/age-filtered fields filled
    const updatedEntry = updated[entryIdx]!;
    const fields = entryFields(updatedEntry);
    const allFilled = fields.length > 0 && fields.every(f => updatedEntry.answers[f.key]?.trim());
    if (allFilled) seedInvestigationsFromPane(newState);
  }

  // On mount — re-seed PANE and populate investigations from pre-existing SOCRATES answers.
  // Handles pre-loaded patients whose CC was completed before real-time seeding was introduced.
  const mountSeededRef = useRef(false);
  useEffect(() => {
    if (mountSeededRef.current) return;
    mountSeededRef.current = true;
    if (entries.length === 0) return;
    const hasAnswers = entries.some(e => Object.values(e.answers).some(v => v?.trim()));
    if (!hasAnswers) return;
    const state = reseedPane(entries);
    for (const entry of entries) {
      const fields = entryFields(entry);
      if (fields.length > 0 && fields.every(f => entry.answers[f.key]?.trim())) {
        seedInvestigationsFromPane(state);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetEntry(entryIdx: number) {
    const updated = entries.map((e, i) => i === entryIdx ? { ...e, answers: {} } : e);
    setProcedureData({ ...procedureData, cc: updated });
    // Force the narrative effect to regenerate from the cleared answers.
    // Without this, a manually-edited (or previously auto-generated) hpiNotes
    // would not update because prevLiveRef.current still matched the old draft.
    prevLiveRef.current = '';
    setHpiNotes('');
  }

  function insertPhrase(text: string) {
    const sep = hpiNotes && !hpiNotes.endsWith('\n') ? '\n\n' : '';
    setHpiNotes(hpiNotes + sep + text);
    prevLiveRef.current = ''; // mark as manually edited
  }

  function regenerate() {
    setHpiNotes(liveProse);
    prevLiveRef.current = liveProse;
  }

  // Derive the most discriminating PANE question from the current posterior state.
  // Shown as a hint in the active HpiBuilderCard field so the clinician knows what to probe next.
  const paneNextQuestion = useMemo<Feature | null>(() => {
    if (!paneState) return null;
    const parsedAge = parseInt(age, 10) || null;
    const diseases = applyModifiers(DISEASES, parsedAge, sex);
    return nextBestQuestion(paneState, diseases, FEATURES);
  }, [paneState, age, sex]);

  const hasSourceData = entries.length > 0 || symptoms.length > 0 || freeText.trim().length > 0;
  const narrativeEdited = hpiNotes !== liveProse && hpiNotes.trim().length > 0;

  return (
    <div className="gap-y">

      {/* ── Age / sex gate — must complete before HPI prose generates ── */}
      <AgeGenderGate age={age} setAge={setAge} sex={sex} setSex={v => setSex(v as 'male' | 'female' | 'other' | 'unknown')} />

      {/* ── Medical background — PMH, Allergies, Meds, Surgical at a glance ── */}
      <MedicalBackgroundStrip
        comorbidities={comorbidities}
        allergies={allergies}
        medications={medications}
        surgicalHistory={surgicalHistory}
      />

      {/* ── CC strip — add / edit complaints ── */}
      <ChiefComplaintStrip />

      {/* ── Phase 2: Continuity banner (returning patient within 6 months) ── */}
      {showContinuityBanner && mostRecent && (
        <ContinuityBanner
          enc={mostRecent}
          onContinue={handleContinueEpisode}
          onDismiss={() => setContinuityDismissed(true)}
        />
      )}

      {/* ── Phase 1: Prior encounters context panel ── */}
      {patientId && priorEncounters.length > 0 && (
        <CollapsibleCard
          title={`Prior encounters (${priorEncounters.length})`}
          defaultOpen={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {priorEncounters.map(enc => (
              <PriorEncounterCard
                key={enc.id}
                enc={enc}
                onPullHistory={prior => {
                  const dateFmt = fmtEncDate(prior.createdAt);
                  const days = daysSince(prior.createdAt);
                  const dxClause = prior.diagnosis ? ` Dx: ${prior.diagnosis}.` : '';
                  const planClause = prior.planDescription ? ` Plan: ${prior.planDescription}.` : '';
                  const intervalText =
                    `\n\n[Interval history — ${days} days since ${dateFmt}]${dxClause}${planClause}\n` +
                    `Interval: `;
                  const sep = hpiNotes && !hpiNotes.endsWith('\n') ? '' : '';
                  setHpiNotes(hpiNotes + sep + intervalText);
                  prevLiveRef.current = '';
                }}
              />
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* ── Context: duration, pain, flags ── */}
      <CollapsibleCard title="Context" defaultOpen={!!(durationDays || painScore || freeText)}>
        <div className="form-grid cols-2">
          <div className="fld">
            <label>Duration of symptoms (days)</label>
            <input
              type="number" inputMode="numeric" min={0} step={1}
              value={durationDays}
              onChange={e => setDurationDays(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 3"
            />
          </div>
          <div className="fld">
            <label>Pain score (0–10)</label>
            <input
              type="number" inputMode="numeric" min={0} max={10} step={1}
              value={painScore}
              onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setPainScore(v && Number(v) > 10 ? '10' : v); }}
              placeholder="0–10"
              className={painScore && Number(painScore) >= 8 ? 'danger' : painScore && Number(painScore) >= 5 ? 'warn' : ''}
            />
          </div>
        </div>
        <div className="check-row" style={{ marginTop: 8 }}>
          <label>
            <input type="checkbox" checked={isPostOp} onChange={e => setIsPostOp(e.target.checked)} />
            Post-op / recent procedure
          </label>
          <label>
            <input type="checkbox" checked={pregnancyPossible} onChange={e => setPregnancyPossible(e.target.checked)} />
            Pregnancy possible
          </label>
          {isPostOp && (
            <div className="inline-field">
              <span>Days since op:</span>
              <input
                type="number" inputMode="numeric" min={0} step={1}
                value={postOpDays}
                onChange={e => setPostOpDays(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="days"
              />
            </div>
          )}
        </div>
        <div className="fld" style={{ marginTop: 10 }}>
          <label>Patient message / referral notes</label>
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Paste patient email or WhatsApp message here — incorporated into the HPI prose below…"
            style={{ minHeight: 70 }}
          />
        </div>
      </CollapsibleCard>

      {/* ── Adaptive HPI builder cards ── */}
      {entries.length === 0 ? (
        <div style={{
          padding: '24px 16px', textAlign: 'center', borderRadius: 10,
          border: '1px dashed #334155', color: '#64748b', fontSize: 13,
        }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#94a3b8' }}>No chief complaint selected</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Add a complaint in the CC strip above — triage questions and SOCRATES prompts
            will appear here and auto-generate the HPI prose below.
          </div>
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 9, fontWeight: 800, color: '#475569',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 6, paddingLeft: 2,
          }}>
            Adaptive HPI · {entries.length} complaint{entries.length !== 1 ? 's' : ''}
          </div>
          {entries.map((entry, idx) => (
            <HpiBuilderCard
              key={entry.complaint + idx}
              entry={entry}
              onAnswerChange={(key, value) => updateAnswer(idx, key, value)}
              onReset={() => resetEntry(idx)}
              paneNextQuestion={paneNextQuestion}
            />
          ))}
        </>
      )}

      {/* ── HPI narrative — live, auto-updating ── */}
      <CollapsibleCard
        title="HPI narrative"
        badge={hpiNotes.trim() ? '✓' : undefined}
      >
        <div className="fld">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6, flexWrap: 'wrap', gap: 6,
          }}>
            <label style={{ marginBottom: 0, fontWeight: 600, fontSize: 12 }}>
              {narrativeEdited
                ? 'Edited narrative'
                : 'Live draft — updates as you tap above'}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {narrativeEdited && hasSourceData && (
                <button
                  type="button"
                  onClick={regenerate}
                  style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 5,
                    border: '1px solid #0d9488', background: 'transparent',
                    color: '#0d9488', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ↺ Regenerate from CC
                </button>
              )}
            </div>
          </div>

          {suggestedPhrases.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
              }}>
                Phrases — {leadingDxName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {suggestedPhrases.map(p => (
                  <button
                    key={p.trigger}
                    type="button"
                    onClick={() => insertPhrase(p.text)}
                    title={`.${p.trigger}`}
                    style={{
                      fontSize: 11, padding: '3px 9px', borderRadius: 5,
                      border: '1px solid #c7d2fe', background: '#eef2ff',
                      color: '#4338ca', cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <SmartTextarea
            value={hpiNotes}
            onChange={v => { setHpiNotes(v); prevLiveRef.current = ''; }}
            placeholder={
              hasSourceData
                ? 'Tap triage chips above to auto-build the HPI…'
                : 'Document the presenting illness — onset, site, character, radiation, associations, timing, exacerbating/relieving factors, severity.'
            }
            style={{ minHeight: 200, width: '100%', lineHeight: 1.65 }}
          />

          {hpiNotes.trim() && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
              Review and edit the draft above before signing — generated from CC matrix and intake data.
            </div>
          )}
        </div>
      </CollapsibleCard>

    </div>
  );
}
