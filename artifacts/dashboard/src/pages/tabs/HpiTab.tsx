import { useMemo, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import SmartTextarea from '@/components/SmartTextarea';
import { computeRankedDifferentials } from '@/lib/symptom-inference';
import { getSuggestedPhrases } from '@/data/dot-phrases';
import { getMatrixByName } from '@/lib/cc-matrices';

interface CCEntry { complaint: string; answers: Record<string, string> }

const SOCRATES_PROMPTS = [
  { label: 'Site', hint: 'Where is the problem? Any radiation?' },
  { label: 'Onset', hint: 'When did it start? Sudden or gradual?' },
  { label: 'Character', hint: 'Nature of symptom — dull, sharp, colicky, pressure…' },
  { label: 'Radiation', hint: 'Does it spread anywhere?' },
  { label: 'Associations', hint: 'Other symptoms? Nausea, fever, weight loss, bleeding…' },
  { label: 'Timing', hint: 'Constant or intermittent? Frequency? Getting worse?' },
  { label: 'Exacerbating / relieving', hint: 'What makes it better or worse?' },
  { label: 'Severity', hint: 'Impact on daily life. Previous episodes or treatments.' },
];

export default function HpiTab() {
  const { hpiNotes, setHpiNotes, freeText, durationDays, painScore, symptoms, symptomDetails, age, sex, procedureData } = useAppContext();
  const entries = useMemo(() => (procedureData['cc'] as CCEntry[] | undefined) ?? [], [procedureData]);

  const ageNum = age ? Number(age) : null;

  const ranked = useMemo(
    () => computeRankedDifferentials({ symptoms, symptomDetails, age: ageNum, sex }),
    [symptoms, symptomDetails, ageNum, sex],
  );

  // Use the top-ranked dx (if confidence ≥ 40%) to drive contextual suggestions
  const leadingDxId = useMemo(
    () => (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0].id : null,
    [ranked],
  );

  const leadingDxName = useMemo(
    () => (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0].name : null,
    [ranked],
  );

  const suggestedPhrases = useMemo(
    () => getSuggestedPhrases(leadingDxId, 4),
    [leadingDxId],
  );

  function insertPhrase(text: string) {
    const sep = hpiNotes && !hpiNotes.endsWith('\n') ? '\n\n' : '';
    setHpiNotes(hpiNotes + sep + text);
  }

  const autoFill = useCallback(() => {
    const lines: string[] = [];
    const agePart  = age  ? `${age}-year-old` : '';
    const sexPart  = sex && sex !== 'unknown' ? sex : '';
    const demoParts = [agePart, sexPart].filter(Boolean);
    if (demoParts.length) {
      lines.push(`${demoParts.join(' ')} presenting with:`);
      lines.push('');
    }
    if (entries.length > 0) {
      entries.forEach(entry => {
        const tpl = getMatrixByName(entry.complaint);
        lines.push(entry.complaint.toUpperCase());
        tpl.prompts.forEach(p => {
          const ans = entry.answers[p.key]?.trim();
          if (ans) lines.push(`  ${p.label}: ${ans}`);
        });
        lines.push('');
      });
    } else if (symptoms.length > 0) {
      lines.push(`Presenting complaints: ${symptoms.join(', ')}`);
      lines.push('');
    }
    if (durationDays) lines.push(`Duration: ${durationDays} days`);
    if (painScore)    lines.push(`Pain score: ${painScore}/10`);
    if (freeText.trim()) {
      lines.push('');
      lines.push(`Patient description: ${freeText.trim()}`);
    }
    const draft = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (draft) setHpiNotes(draft);
  }, [age, sex, entries, symptoms, durationDays, painScore, freeText, setHpiNotes]);

  const hasAutoFillData = entries.length > 0 || symptoms.length > 0 || freeText.trim();

  return (
    <div className="gap-y">
      <CollapsibleCard title="History of present illness" badge={hpiNotes.trim() ? '✓' : undefined}>
        <div className="fld">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
            <label style={{ marginBottom: 0 }}>HPI narrative</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {hasAutoFillData && (
                <button
                  type="button"
                  onClick={autoFill}
                  style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
                    border: '1px solid #0d9488', background: hpiNotes.trim() ? '#f0fdfa' : '#0d9488',
                    color: hpiNotes.trim() ? '#0d9488' : '#fff', fontWeight: 600,
                  }}
                  title="Populate HPI from chief complaint matrix and intake data"
                >
                  {hpiNotes.trim() ? '↺ Re-fill from CC' : '⬇ Fill from CC data'}
                </button>
              )}
              <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                🎤 Tap mic to dictate · type <code style={{ fontSize: 10, background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>.hpi</code> for template
              </span>
            </div>
          </div>

          {/* Context-aware phrase suggestions based on leading differential */}
          {suggestedPhrases.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Suggested for {leadingDxName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {suggestedPhrases.map(p => (
                  <button
                    key={p.trigger}
                    type="button"
                    onClick={() => insertPhrase(p.text)}
                    title={`Insert: .${p.trigger}`}
                    style={{
                      fontSize: 11,
                      padding: '3px 9px',
                      borderRadius: 5,
                      border: '1px solid #c7d2fe',
                      background: '#eef2ff',
                      color: '#4338ca',
                      cursor: 'pointer',
                      fontWeight: 500,
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
            onChange={setHpiNotes}
            placeholder={
              'Document the presenting illness in the patient\'s own words and the clinician\'s synthesis.\n\n' +
              'SOCRATES — Site · Onset · Character · Radiation · Associations · Timing · Exacerbating/Relieving · Severity\n\n' +
              'Tap the 🎤 microphone button (top-right corner) to dictate by voice\nOr type .hpi / .hpiabd to expand a template'
            }
            style={{ minHeight: 180, width: '100%' }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SOCRATES prompts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {SOCRATES_PROMPTS.map(p => (
              <div key={p.label} style={{ fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{p.label}:</span> {p.hint}
              </div>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      {(freeText.trim() || durationDays) && (
        <CollapsibleCard title="Pre-visit complaint summary" defaultOpen={false}>
          {durationDays && (
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Duration:</span> {durationDays} days
            </div>
          )}
          {freeText.trim() && (
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--fg)' }}>{freeText}</div>
          )}
          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
            Patient-entered complaint from triage/intake — incorporate above into the HPI narrative.
          </p>
        </CollapsibleCard>
      )}
    </div>
  );
}
