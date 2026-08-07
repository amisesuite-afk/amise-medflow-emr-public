import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { CC_TEMPLATES, CC_BY_CATEGORY, getMatrixByName, type CCCategory, type CCTemplate } from '@/lib/cc-matrices';
import { SYMPTOM_BRANCHES } from '@/lib/symptom-branches';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CCEntry { complaint: string; answers: Record<string, string> }

// Maps triage branch question labels → SOCRATES answer keys (same as HpiTab)
const BRANCH_KEY: Record<string, string> = {
  'Location': 'site',       'Site': 'site',           'Site / radiation': 'site',
  'Character': 'character', 'Type': 'character',       'Colour': 'character',
  'Associated': 'assoc',    'Associated features': 'assoc', 'Associated symptoms': 'assoc',
  'Features': 'assoc',
  'Onset': 'onset',         'Onset / duration': 'onset',   'History': 'onset',
  'Radiation': 'radiation', 'Spread': 'radiation',
  'Severity': 'severity',   'Amount': 'severity',
  'Timing': 'timing',       'Pattern': 'timing',       'Frequency': 'timing',
  'Triggers': 'triggers',   'Exacerbating factors': 'triggers',
  'Relief': 'relief',
  'Timeframe': 'duration',  'Duration': 'duration',
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CAT_ICONS: Record<CCCategory, string> = {
  'Acute Abdomen':          '🚨',
  'GI / Hepatobiliary':     '🫃',
  'Colorectal / Lower GI':  '🔵',
  'Hernia & Abdominal Wall':'🦵',
  'Breast & Endocrine':     '🎯',
  'Endoscopy & ERCP':       '🔭',
  'Anorectal / Perianal':   '🩹',
  'Vascular & Soft Tissue': '🫀',
  'Post-op / Follow-up':    '✅',
  'Other Surgical':         '✏️',
};

const URGENCY_BADGE: Record<string, { bg: string; text: string }> = {
  emergency: { bg: '#7f1d1d', text: '#fca5a5' },
  urgent:    { bg: '#431407', text: '#fb923c' },
  soon:      { bg: '#422006', text: '#fbbf24' },
  routine:   { bg: '#052e16', text: '#86efac' },
};

// ── Parse hint text into tappable chip options ─────────────────────────────────
// Hints use "·" as separator, with optional parenthetical descriptions.
// e.g. "RUQ · Epigastric · Periumbilical → RIF · LIF · Generalised"

function parseChipOptions(hint: string): string[] {
  if (!hint) return [];
  return hint
    .split(/\s*[·→]\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 60);
}

// Strip parentheticals for the chip label ("Sudden (perforation)" → "Sudden")
function chipLabel(opt: string): string {
  return opt.replace(/\s*\([^)]*\)/g, '').trim();
}

// Multi-select fields — comma-accumulate; others replace
const MULTI_KEYS = new Set([
  'assoc', 'associated', 'associated_symptoms', 'associated_features', 'features',
  'symptoms', 'sympt', 'systemic', 'risk', 'riskfactors', 'alarm', 'meds', 'prev_surg', 'concerns',
  'aggravating', 'aggravating_factors', 'relieving', 'relieving_factors',
  'triggers', 'relief', 'timing', 'timing_&_pattern',
  'radiation', 'spread',
]);

function toggleChip(current: string, opt: string, multi: boolean): string {
  const label = chipLabel(opt);
  if (multi) {
    const parts = current.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.includes(label)) return parts.filter(p => p !== label).join(', ');
    return [...parts, label].join(', ');
  }
  // Single — replace if different, clear if same
  return current.trim() === label ? '' : label;
}

function isChipActive(current: string, opt: string): boolean {
  const label = chipLabel(opt);
  return current.split(',').map(s => s.trim()).includes(label);
}

// ── Sub-component: one SOCRATES field ─────────────────────────────────────────

function PromptField({
  label, hint, value, onChange,
}: {
  label: string; hint: string; value: string;
  onChange: (v: string) => void;
}) {
  const options = parseChipOptions(hint);
  const multi   = MULTI_KEYS.has(label.toLowerCase().replace(/\s+/g, '_'));
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Field label — for front desk reference only */}
      <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>

      {/* Tappable chip options */}
      {options.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {options.map(opt => {
            const active = isChipActive(value, opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(toggleChip(value, opt, multi))}
                style={{
                  padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', border: `1px solid ${active ? '#0d9488' : '#334155'}`,
                  background: active ? '#0d9488' : '#1e293b',
                  color: active ? '#fff' : '#94a3b8',
                  transition: 'all 0.1s',
                }}
              >
                {chipLabel(opt)}
              </button>
            );
          })}
        </div>
      )}

      {/* Free-text input — always available for custom / additional detail */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={options.length > 0 ? 'Add detail or type custom answer…' : hint}
        style={{
          padding: '7px 10px', borderRadius: 7,
          border: `1px solid ${value ? '#0d9488' : '#334155'}`,
          fontSize: 13, color: '#f1f5f9', background: '#1e293b',
          outline: 'none', transition: 'border-color 0.1s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = '#0d9488')}
        onBlur={e => (e.currentTarget.style.borderColor = value ? '#0d9488' : '#334155')}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ChiefComplaintStrip() {
  const {
    symptoms, symptomDetails, procedureData, setProcedureData,
    setEncounterType, activeCcKey, setActiveCcKey, setActiveSection, freeText,
  } = useAppContext();

  const [expanded, setExpanded]       = useState<number | null>(null);
  const [showPicker, setShowPicker]   = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [catFilter, setCatFilter]     = useState<CCCategory | ''>('');
  const [searchQ, setSearchQ]         = useState('');

  const entries: CCEntry[] = (procedureData['cc'] as CCEntry[] | undefined) ?? [];

  // Restore activeCcKey when entries already exist but key was cleared (e.g. patient reload)
  useEffect(() => {
    if (activeCcKey !== null) return;
    const first = entries[0];
    if (!first) return;
    const matrix = getMatrixByName(first.complaint);
    setActiveCcKey(matrix.id);
    setEncounterType(matrix.encounterType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  // Auto-populate CC entries from intake symptoms or freeText the first time
  // consultation opens. Also translates symptomDetails into structured SOCRATES
  // answers so intake selections are visible in consultation.
  useEffect(() => {
    if (entries.length > 0) return;

    // freeText-only path: no symptoms but patient message/referral text present
    if (symptoms.length === 0) {
      const ft = freeText.trim();
      if (!ft) return;
      setProcedureData({ ...procedureData, cc: [{ complaint: ft.slice(0, 200), answers: {} }] });
      setExpanded(0);
      return;
    }

    const initial = symptoms.slice(0, 3).map(s => {
      const matrix  = getMatrixByName(s);
      const details = symptomDetails[s] ?? symptomDetails[s.toLowerCase()] ?? [];
      const branches = SYMPTOM_BRANCHES[s] ?? SYMPTOM_BRANCHES[s.toLowerCase()] ?? [];
      const answers: Record<string, string> = {};

      if (details.length > 0 && branches.length > 0) {
        for (const branch of branches) {
          const selected = branch.options.filter(opt => details.includes(opt));
          if (selected.length === 0) continue;
          // Use same BRANCH_KEY table as HpiTab so answers land on the right SOCRATES keys
          const key = BRANCH_KEY[branch.question]
            ?? branch.question.toLowerCase().replace(/\W+/g, '_');
          const prev = answers[key];
          answers[key] = prev ? `${prev}, ${selected.join(', ')}` : selected.join(', ');
        }
      }

      return { complaint: s, answers };
    });

    setProcedureData({ ...procedureData, cc: initial });
    const first = initial[0];
    if (first) {
      const matrix = getMatrixByName(first.complaint);
      setActiveCcKey(matrix.id);
      setEncounterType(matrix.encounterType);
    }
    setExpanded(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function activateMatrix(complaint: string) {
    const matrix = getMatrixByName(complaint);
    setActiveCcKey(matrix.id);
    setEncounterType(matrix.encounterType);
  }

  function setEntries(next: CCEntry[]) {
    setProcedureData({ ...procedureData, cc: next });
    if (next.length > 0) activateMatrix(next[0]!.complaint);
    else setActiveCcKey(null);
  }

  function addComplaint(name: string) {
    const trimmed = name.trim();
    if (!trimmed || entries.length >= 3 || entries.some(e => e.complaint === trimmed)) return;
    const next = [...entries, { complaint: trimmed, answers: {} }];
    setEntries(next);
    setExpanded(next.length - 1);
    setShowPicker(false);
    setCustomInput('');
    setSearchQ('');
  }

  function removeComplaint(idx: number) {
    const next = entries.filter((_, i) => i !== idx);
    setEntries(next);
    if (expanded === idx) setExpanded(null);
    else if (expanded !== null && expanded > idx) setExpanded(expanded - 1);
  }

  function setAnswer(entryIdx: number, key: string, value: string) {
    const next = entries.map((e, i) =>
      i === entryIdx ? { ...e, answers: { ...e.answers, [key]: value } } : e
    );
    setProcedureData({ ...procedureData, cc: next });
  }

  const intakeSuggestions = symptoms.filter(s => !entries.some(e => e.complaint === s));
  const categories = Object.keys(CC_BY_CATEGORY) as CCCategory[];

  const matchesCriteria = (t: CCTemplate) => {
    const matchCat = !catFilter || t.category === catFilter;
    const matchQ   = !searchQ || t.name.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchQ;
  };
  const newTemplates:   CCTemplate[] = CC_TEMPLATES.filter(t => matchesCriteria(t) && !entries.some(e => e.complaint === t.name));
  const alreadyAdded:  CCTemplate[] = CC_TEMPLATES.filter(t => matchesCriteria(t) &&  entries.some(e => e.complaint === t.name));

  // Progress for each entry
  function progress(entry: CCEntry): { answered: number; total: number } {
    const tpl = getMatrixByName(entry.complaint);
    const answered = tpl.prompts.filter(p => entry.answers[p.key]?.trim()).length;
    return { answered, total: tpl.prompts.length };
  }

  return (
    <div style={{ borderRadius: 10, border: '1px solid #1e293b', background: '#0f172a', marginBottom: 8, overflow: 'hidden' }}>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
        borderBottom: (entries.length > 0 || showPicker) ? '1px solid #1e293b' : 'none',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', flexShrink: 0 }}>
          Chief Complaint
        </span>
        {entries.length > 0 && symptoms.length > 0 && entries.some(e => symptoms.includes(e.complaint)) && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#0d9488', background: '#ccfbf1', borderRadius: 4, padding: '2px 7px', letterSpacing: '0.04em', flexShrink: 0 }}>
            ↑ FROM INTAKE
          </span>
        )}

        {/* Active CC chips */}
        {entries.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {entries.map((entry, i) => {
              const tpl    = getMatrixByName(entry.complaint);
              const prog   = progress(entry);
              const isOpen = expanded === i;
              const ub     = URGENCY_BADGE[tpl.urgency];
              const allDone = prog.answered === prog.total && prog.total > 0;

              return (
                <button key={i} type="button" onClick={() => setExpanded(isOpen ? null : i)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${isOpen ? '#0d9488' : allDone ? '#15803d' : '#334155'}`,
                    background: isOpen ? '#0d948818' : allDone ? '#15803d18' : '#1e293b',
                    color: isOpen ? '#2dd4bf' : allDone ? '#86efac' : '#cbd5e1',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
                  }}>
                  <span>{tpl.icon}</span>
                  <span>{entry.complaint}</span>
                  {ub && (
                    <span style={{ fontSize: 9, background: ub.bg, color: ub.text, borderRadius: 3, padding: '1px 5px' }}>
                      {tpl.urgency}
                    </span>
                  )}
                  {/* Progress ring-style badge */}
                  <span style={{
                    fontSize: 10, borderRadius: 999, padding: '1px 6px', fontWeight: 700,
                    background: allDone ? '#15803d' : prog.answered > 0 ? '#0d9488' : '#334155',
                    color: '#fff',
                  }}>
                    {prog.answered}/{prog.total}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{isOpen ? '▲' : '▼'}</span>
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); removeComplaint(i); }}
                    style={{ fontSize: 13, color: '#64748b', cursor: 'pointer', marginLeft: 1, lineHeight: 1 }}
                  >
                    ×
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {entries.length === 0 && !showPicker && (
          <span style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', flex: 1 }}>
            Select presenting complaint → targeted Q&A opens automatically
          </span>
        )}

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
          {entries.length < 3 && (
            <button type="button" onClick={() => { setShowPicker(p => !p); setExpanded(null); }}
              style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none',
                background: showPicker ? '#334155' : '#0d9488',
                color: '#fff', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap',
              }}>
              {showPicker ? '✕ Close' : '+ Add CC'}
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded SOCRATES panel ── */}
      {expanded !== null && entries[expanded] && (() => {
        const entry = entries[expanded]!;
        const tpl   = getMatrixByName(entry.complaint);
        const prog  = progress(entry);
        const allDone = prog.answered === prog.total && prog.total > 0;

        return (
          <div style={{ background: '#0b1929', borderBottom: showPicker ? '1px solid #1e293b' : 'none' }}>

            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: '1px solid #1e293b',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{entry.complaint}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{tpl.category}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {allDone && (
                  <span style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>✓ Complete</span>
                )}
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: allDone ? '#052e16' : '#1e293b',
                  color: allDone ? '#86efac' : '#94a3b8',
                  border: `1px solid ${allDone ? '#15803d' : '#334155'}`,
                }}>
                  {prog.answered} / {prog.total} answered
                </div>
              </div>
            </div>

            {/* Clinical pearl */}
            {tpl.pearl && (
              <div style={{
                fontSize: 11, color: '#94a3b8', background: '#0d2137',
                borderLeft: '3px solid #0d9488', padding: '7px 14px',
                margin: '0', lineHeight: 1.5,
              }}>
                💡 {tpl.pearl}
              </div>
            )}

            {/* Prompt fields */}
            <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {tpl.prompts.map(p => (
                <PromptField
                  key={p.key}
                  label={p.label}
                  hint={p.hint ?? ''}
                  value={entry.answers[p.key] ?? ''}
                  onChange={v => setAnswer(expanded, p.key, v)}
                />
              ))}
            </div>

            {/* Investigation hints */}
            {(tpl.labs.length > 0 || tpl.imaging.length > 0) && (
              <div style={{ padding: '0 16px 12px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {tpl.labs.length > 0 && (
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>Labs: </span>
                    {tpl.labs.slice(0, 6).join(' · ')}
                    {tpl.labs.length > 6 ? ' …' : ''}
                  </div>
                )}
                {tpl.imaging.length > 0 && (
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>Imaging: </span>
                    {tpl.imaging.slice(0, 3).join(' · ')}
                    {tpl.imaging.length > 3 ? ' …' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Closed-loop trigger — once all fields answered, surface HPI */}
            <div style={{
              padding: '10px 16px 14px',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              justifyContent: allDone ? 'flex-end' : 'space-between',
              alignItems: 'center',
              gap: 8,
            }}>
              {!allDone && (
                <span style={{ fontSize: 11, color: '#475569' }}>
                  {prog.total - prog.answered} field{prog.total - prog.answered !== 1 ? 's' : ''} remaining
                </span>
              )}
              <button
                type="button"
                onClick={() => { setExpanded(null); setActiveSection('hpi'); }}
                style={{
                  padding: '7px 18px', borderRadius: 7, cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  border: allDone ? 'none' : '1px solid #334155',
                  background: allDone ? '#0d9488' : '#1e293b',
                  color: allDone ? '#fff' : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                {allDone ? '✓ CC done — Review HPI →' : 'Skip to HPI →'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── CC Picker ── */}
      {showPicker && (
        <div style={{ padding: '12px 14px', background: '#0f172a' }}>

          {/* Intake suggestions */}
          {intakeSuggestions.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                From intake questionnaire
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {intakeSuggestions.map(s => (
                  <button key={s} type="button" onClick={() => addComplaint(s)}
                    style={{
                      padding: '5px 13px', borderRadius: 20, border: '1px solid #0d9488',
                      background: '#0d948820', color: '#2dd4bf', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search + custom */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              type="text" value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search complaints…"
              autoFocus
              style={{
                flex: 1, minWidth: 160, padding: '7px 12px', borderRadius: 7,
                border: '1px solid #334155', fontSize: 13, color: '#f1f5f9',
                background: '#1e293b', outline: 'none',
              }}
            />
            <input
              type="text" value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addComplaint(customInput)}
              placeholder="Custom complaint (Enter)"
              style={{
                flex: 1, minWidth: 160, padding: '7px 12px', borderRadius: 7,
                border: '1px solid #334155', fontSize: 13, color: '#f1f5f9',
                background: '#1e293b', outline: 'none',
              }}
            />
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" onClick={() => setCatFilter('')}
              style={{
                padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                fontWeight: catFilter === '' ? 700 : 500,
                background: catFilter === '' ? '#0d9488' : '#1e293b',
                color: catFilter === '' ? '#fff' : '#94a3b8',
              }}>All</button>
            {categories.map(cat => (
              <button key={cat} type="button" onClick={() => setCatFilter(catFilter === cat ? '' : cat)}
                style={{
                  padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  fontWeight: catFilter === cat ? 700 : 500,
                  background: catFilter === cat ? '#0d9488' : '#1e293b',
                  color: catFilter === cat ? '#fff' : '#94a3b8',
                }}>
                {CAT_ICONS[cat]} {cat}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 5, maxHeight: 320, overflowY: 'auto',
          }}>
            {newTemplates.map(t => {
              const ub = URGENCY_BADGE[t.urgency];
              return (
                <button key={t.id} type="button" onClick={() => addComplaint(t.name)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                    padding: '9px 12px', borderRadius: 8, border: '1px solid #1e293b',
                    background: '#1e293b', color: '#cbd5e1', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0d948820'; e.currentTarget.style.borderColor = '#0d9488'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#1e293b'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <span style={{ fontSize: 15 }}>{t.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{t.name}</span>
                    {ub && (
                      <span style={{ fontSize: 9, background: ub.bg, color: ub.text, borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>
                        {t.urgency}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{t.category}</div>
                </button>
              );
            })}

            {/* Already-added matches — shown greyed so the user sees them, but not re-clickable */}
            {alreadyAdded.map(t => (
              <div key={t.id}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                  padding: '9px 12px', borderRadius: 8, border: '1px solid #1e293b',
                  background: '#0f172a', color: '#334155', textAlign: 'left', opacity: 0.7,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <span style={{ fontSize: 15, filter: 'grayscale(1)' }}>{t.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{t.name}</span>
                  <span style={{ fontSize: 10, color: '#0d9488', fontWeight: 700 }}>✓ added</span>
                </div>
                <div style={{ fontSize: 10, color: '#334155' }}>{t.category}</div>
              </div>
            ))}
          </div>

          {newTemplates.length === 0 && alreadyAdded.length > 0 && (
            <div style={{ fontSize: 12, color: '#0d9488', textAlign: 'center', padding: '10px 0 4px' }}>
              All matching complaints are already in your list ↑
            </div>
          )}
          {newTemplates.length === 0 && alreadyAdded.length === 0 && (
            <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '16px 0' }}>
              No matches — type in the custom field and press Enter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
