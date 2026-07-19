import { useMemo, useCallback, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import SmartTextarea from '@/components/SmartTextarea';
import { computeRankedDifferentials } from '@/lib/symptom-inference';
import { getSuggestedPhrases } from '@/data/dot-phrases';
import { getMatrixByName } from '@/lib/cc-matrices';
import ChiefComplaintStrip from '@/components/ChiefComplaintStrip';

interface CCEntry { complaint: string; answers: Record<string, string> }

// ── Clinical prose composer ────────────────────────────────────────────────────
// Turns CC matrix answers + intake data into a consultant-quality HPI narrative.

function lc(s: string) { return s.charAt(0).toLowerCase() + s.slice(1).trimEnd(); }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

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
  const agePart  = age  ? `${age}-year-old` : '';
  const sexPart  = sex && sex !== 'unknown' ? sex : '';
  const demo     = [agePart, sexPart].filter(Boolean).join(' ');
  const firstName = patientName.trim().split(' ')[0] ?? '';
  const subject  = firstName ? `${firstName}, a ${demo},` : demo ? `A ${demo}` : 'The patient';
  const dur      = durPhrase(durationDays);
  const durClause = dur ? `${dur} history of` : 'a history of';

  const paragraphs: string[] = [];

  // ── No CC matrix — fall back to symptoms + freeText ──────────────────────
  if (entries.length === 0) {
    const cc = symptoms.length > 0 ? symptoms.join(' and ') : 'presenting complaints';
    paragraphs.push(`${cap(subject)} presenting with ${durClause} ${cc}.`);
    if (freeText.trim()) paragraphs.push(cap(lc(freeText.trim())));
    return paragraphs.join('\n\n');
  }

  // ── One paragraph per CC entry ────────────────────────────────────────────
  entries.forEach((entry, idx) => {
    const ans  = entry.answers;
    const noun = primaryNoun(entry.complaint.toLowerCase());

    // Pull SOCRATES fields from the matrix answers
    const onset      = get(ans, 'onset', 'duration', 'presentation');
    const site       = get(ans, 'site');
    const character  = get(ans, 'character');
    const radiation  = get(ans, 'radiation', 'direction');
    const timing     = get(ans, 'timing');
    const assoc      = get(ans, 'assoc', 'symptoms', 'sympt', 'systemic');
    const severity   = get(ans, 'severity', 'qol');
    const exac       = get(ans, 'triggers', 'exac');
    const relief     = get(ans, 'response', 'relief');
    const prev       = get(ans, 'prev', 'prevep', 'previous', 'history');
    const fever      = get(ans, 'fever');
    const vomiting   = get(ans, 'vomiting');
    const bleeding   = get(ans, 'bleeding', 'bleed');
    const weightloss = get(ans, 'weight', 'weightloss');
    const jaundice   = get(ans, 'jaundice');
    const meds       = get(ans, 'meds', 'therapy');

    // ── Sentence 1 — opening ────────────────────────────────────────────────
    // "[Subject] presents with a 2-day history of acute abdominal pain[, with sudden onset / beginning in the epigastrium]."
    let open = idx === 0
      ? `${cap(subject)} presents with ${durClause} ${lc(entry.complaint)}`
      : `Additionally, ${lc(entry.complaint)}`;

    if (onset && onset.length <= 100) open += `, ${lc(onset)}`;
    paragraphs.push(open + '.');

    // ── Sentence 2 — localisation & character ──────────────────────────────
    // "The pain is localised to the right iliac fossa, radiating to the back, constant and colicky in character."
    const locParts: string[] = [];
    if (site)      locParts.push(`localised to the ${lc(site)}`);
    if (radiation) locParts.push(`radiating to ${lc(radiation)}`);
    if (character) locParts.push(`${lc(character)} in character`);
    if (timing)    locParts.push(lc(timing));
    if (locParts.length) {
      paragraphs.push(`The ${noun} is ${locParts.join(', ')}.`);
    }

    // ── Sentence 3 — associated symptoms ───────────────────────────────────
    // "Associated symptoms include nausea and vomiting, fever, and weight loss."
    const assocItems: string[] = [];
    if (assoc)      assocItems.push(lc(assoc));
    if (fever)      assocItems.push(`fever — ${lc(fever)}`);
    if (vomiting)   assocItems.push(`vomiting — ${lc(vomiting)}`);
    if (bleeding)   assocItems.push(`bleeding — ${lc(bleeding)}`);
    if (weightloss) assocItems.push(`weight loss — ${lc(weightloss)}`);
    if (jaundice)   assocItems.push(`jaundice — ${lc(jaundice)}`);
    if (assocItems.length) {
      paragraphs.push(`Associated features include ${assocItems.join('; ')}.`);
    }

    // ── Sentence 4 — severity + modifying factors ───────────────────────────
    const modParts: string[] = [];
    if (severity) modParts.push(cap(lc(severity)));
    if (painScore && idx === 0) modParts.push(`Pain is rated ${painScore}/10`);
    if (exac)     modParts.push(cap(lc(exac)));
    if (relief)   modParts.push(cap(lc(relief)));
    if (modParts.length) paragraphs.push(modParts.join('. ') + '.');

    // ── Sentence 5 — prior history & treatment ──────────────────────────────
    const histParts: string[] = [];
    if (prev) histParts.push(cap(lc(prev)));
    if (meds) histParts.push(cap(lc(meds)));
    if (histParts.length) paragraphs.push(histParts.join('. ') + '.');
  });

  // ── Freetext integration ─────────────────────────────────────────────────
  // Incorporate the patient's own words as a final context sentence, not a quote.
  if (freeText.trim()) {
    paragraphs.push(`In the patient's own words: ${lc(freeText.trim())}.`);
  }

  // Collapse consecutive short paragraphs into one if they read as one thought
  return paragraphs
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HpiTab() {
  const {
    hpiNotes, setHpiNotes,
    freeText, durationDays, painScore,
    symptoms, symptomDetails,
    age, sex, patientName,
    procedureData,
  } = useAppContext();

  const entries = useMemo(
    () => (procedureData['cc'] as CCEntry[] | undefined) ?? [],
    [procedureData],
  );

  const ageNum = age ? Number(age) : null;
  const ranked = useMemo(
    () => computeRankedDifferentials({ symptoms, symptomDetails, age: ageNum, sex }),
    [symptoms, symptomDetails, ageNum, sex],
  );
  const leadingDxId   = useMemo(() => (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0].id   : null, [ranked]);
  const leadingDxName = useMemo(() => (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0].name : null, [ranked]);
  const suggestedPhrases = useMemo(() => getSuggestedPhrases(leadingDxId, 4), [leadingDxId]);

  const hasSourceData = entries.length > 0 || symptoms.length > 0 || freeText.trim().length > 0;

  const compose = useCallback(() => {
    return composeHpiNarrative(
      entries, age, sex, patientName,
      symptoms, durationDays, painScore, freeText,
    );
  }, [entries, age, sex, patientName, symptoms, durationDays, painScore, freeText]);

  // Auto-populate on mount when HPI is blank and source data exists
  useEffect(() => {
    if (hpiNotes.trim()) return;
    const draft = compose();
    if (draft) setHpiNotes(draft);
  // Run only once on mount — deps intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function insertPhrase(text: string) {
    const sep = hpiNotes && !hpiNotes.endsWith('\n') ? '\n\n' : '';
    setHpiNotes(hpiNotes + sep + text);
  }

  function regenerate() {
    const draft = compose();
    if (draft) setHpiNotes(draft);
  }

  return (
    <div className="gap-y">
      <ChiefComplaintStrip />
      <CollapsibleCard title="History of present illness" badge={hpiNotes.trim() ? '✓' : undefined}>
        <div className="fld">
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
            <label style={{ marginBottom: 0, fontWeight: 600 }}>HPI narrative</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {hasSourceData && (
                <button
                  type="button"
                  onClick={regenerate}
                  style={{
                    fontSize: 11, padding: '4px 12px', borderRadius: 5, cursor: 'pointer',
                    border: '1px solid #0d9488',
                    background: hpiNotes.trim() ? 'transparent' : '#0d9488',
                    color: hpiNotes.trim() ? '#0d9488' : '#fff',
                    fontWeight: 700,
                  }}
                  title="Rewrite HPI narrative from CC matrix and intake data"
                >
                  {hpiNotes.trim() ? '↺ Rewrite from CC' : '✦ Auto-draft HPI'}
                </button>
              )}
              <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                🎤 Dictate
              </span>
            </div>
          </div>

          {/* Dx-aware phrase chips */}
          {suggestedPhrases.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Phrases — {leadingDxName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {suggestedPhrases.map(p => (
                  <button key={p.trigger} type="button" onClick={() => insertPhrase(p.text)}
                    title={`Insert: .${p.trigger}`}
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5,
                      border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca',
                      cursor: 'pointer', fontWeight: 500 }}>
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <SmartTextarea
            value={hpiNotes}
            onChange={setHpiNotes}
            placeholder={
              hasSourceData
                ? 'Auto-drafting HPI from CC matrix…'
                : 'Document the presenting illness — onset, site, character, radiation, associations, timing, exacerbating/relieving factors, severity.\n\nTap 🎤 to dictate or type .hpi for a template.'
            }
            style={{ minHeight: 200, width: '100%', lineHeight: 1.65 }}
          />

          {hpiNotes.trim() && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
              Review and edit the draft above before signing — the narrative is based on CC matrix and intake data.
            </div>
          )}
        </div>
      </CollapsibleCard>

      {(freeText.trim() || durationDays) && (
        <CollapsibleCard title="Patient's own words (intake)" defaultOpen={false}>
          {durationDays && (
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Duration:</span> {durationDays} day{durationDays === '1' ? '' : 's'}
            </div>
          )}
          {freeText.trim() && (
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--fg)', fontStyle: 'italic' }}>
              "{freeText.trim()}"
            </div>
          )}
          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
            Verbatim from the patient's intake questionnaire — already incorporated into the HPI draft above.
          </p>
        </CollapsibleCard>
      )}
    </div>
  );
}
