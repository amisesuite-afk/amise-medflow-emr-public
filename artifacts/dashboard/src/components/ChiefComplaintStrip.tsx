import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PromptField { key: string; label: string; hint: string }
interface CCEntry     { complaint: string; answers: Record<string, string> }
interface Template    { name: string; icon: string; prompts: PromptField[] }

// ── Surgical complaint templates ──────────────────────────────────────────────

const TEMPLATES: Template[] = [
  { name: 'Abdominal pain', icon: '🫃', prompts: [
    { key: 'site',      label: 'Site',          hint: 'RUQ · Epigastric · Periumbilical · RIF · LIF · Generalised' },
    { key: 'onset',     label: 'Onset',         hint: 'Sudden / gradual · Duration' },
    { key: 'character', label: 'Character',     hint: 'Colicky · Constant · Burning · Sharp · Dull ache' },
    { key: 'radiation', label: 'Radiation',     hint: 'Back · Shoulder tip · Groin · Scapula' },
    { key: 'severity',  label: 'Severity 0–10', hint: '' },
    { key: 'assoc',     label: 'Associated',    hint: 'Nausea · Vomiting · Fever · Jaundice · Anorexia' },
  ]},
  { name: 'Dysphagia', icon: '🍽️', prompts: [
    { key: 'level',       label: 'Level',        hint: 'Solids only · Solids + liquids · Liquids only' },
    { key: 'progression', label: 'Progression',  hint: 'Progressive (malignancy) · Intermittent (motility)' },
    { key: 'duration',    label: 'Duration',     hint: 'When started, over what period' },
    { key: 'odynophagia', label: 'Odynophagia',  hint: 'Pain on swallowing' },
    { key: 'weightloss',  label: 'Weight loss',  hint: 'kg over how long' },
  ]},
  { name: 'Jaundice', icon: '🟡', prompts: [
    { key: 'onset',    label: 'Onset',                    hint: 'Progressive · Fluctuating · Duration' },
    { key: 'pain',     label: 'Pain',                     hint: 'RUQ pain (stones) · Painless (malignancy — Courvoisier)' },
    { key: 'urine',    label: 'Dark urine / pale stools',  hint: 'Obstructive pattern' },
    { key: 'pruritus', label: 'Pruritus',                  hint: 'Suggests cholestasis' },
    { key: 'fever',    label: 'Fever / rigors',            hint: "Charcot's triad → cholangitis" },
    { key: 'weight',   label: 'Weight loss',               hint: 'Malignant jaundice — pancreas / cholangiocarcinoma' },
  ]},
  { name: 'Rectal bleeding', icon: '🩸', prompts: [
    { key: 'colour',  label: 'Colour',       hint: 'Bright red (anorectal) · Dark / melaena (upper GI)' },
    { key: 'amount',  label: 'Amount',       hint: 'Spots · Coating stool · Mixed with stool · Profuse' },
    { key: 'pain',    label: 'Pain',         hint: 'Painful (fissure) · Painless (haemorrhoids · Ca)' },
    { key: 'bowel',   label: 'Bowel habit',  hint: 'Constipation · Diarrhoea · Alternating' },
    { key: 'weight',  label: 'Weight loss',  hint: 'Red flag — colorectal malignancy' },
  ]},
  { name: 'Change in bowel habit', icon: '🔄', prompts: [
    { key: 'direction', label: 'Direction',    hint: 'Constipation · Diarrhoea · Alternating' },
    { key: 'duration',  label: 'Duration',     hint: 'How long · Was there a preceding normal habit' },
    { key: 'blood',     label: 'Blood / mucus',hint: 'Amount · Colour' },
    { key: 'tenesmus',  label: 'Tenesmus',     hint: 'Incomplete evacuation — suggests rectal lesion' },
  ]},
  { name: 'Hernia / groin lump', icon: '🦵', prompts: [
    { key: 'site',  label: 'Site',          hint: 'R / L · Inguinal · Femoral · Umbilical · Incisional · Epigastric' },
    { key: 'reduc', label: 'Reducibility',  hint: 'Reducible · Irreducible · Obstructed · Strangulated' },
    { key: 'onset', label: 'Onset',         hint: 'Sudden · Gradual · Cough / strain precipitant' },
    { key: 'pain',  label: 'Pain',          hint: 'On exertion · At rest · Constant (strangulation!)' },
  ]},
  { name: 'Neck lump', icon: '🔵', prompts: [
    { key: 'site',      label: 'Site',       hint: 'Anterior / posterior triangle · Midline' },
    { key: 'duration',  label: 'Duration',   hint: 'When noticed · Growing' },
    { key: 'character', label: 'Character',  hint: 'Hard · Soft · Mobile · Fixed · Tender · Pulsatile' },
    { key: 'assoc',     label: 'Associated', hint: 'Dysphagia · Voice change · Weight loss · B symptoms' },
  ]},
  { name: 'Breast lump', icon: '🎯', prompts: [
    { key: 'site',      label: 'Site',         hint: 'Quadrant · Subareolar' },
    { key: 'duration',  label: 'Duration',     hint: 'When noticed · Growing' },
    { key: 'character', label: 'Character',    hint: 'Hard · Soft · Mobile · Irregular · Tethered to skin / chest wall' },
    { key: 'discharge', label: 'Nipple discharge', hint: 'Bloody (malignancy) · Serous · Purulent' },
    { key: 'famhx',     label: 'Family history', hint: 'First-degree relatives — breast / ovarian cancer' },
  ]},
  { name: 'Weight loss', icon: '⚖️', prompts: [
    { key: 'amount',   label: 'Amount',      hint: 'kg over what time period — unintentional?' },
    { key: 'anorexia', label: 'Anorexia',    hint: 'Reduced appetite · Early satiety' },
    { key: 'gi',       label: 'GI symptoms', hint: 'Dysphagia · Abdominal pain · Bowel habit change' },
    { key: 'systemic', label: 'B symptoms',  hint: 'Fever · Night sweats · Fatigue (lymphoma / TB)' },
  ]},
  { name: 'Reflux / heartburn', icon: '🔥', prompts: [
    { key: 'duration',  label: 'Duration',       hint: 'Daily · Intermittent · How long' },
    { key: 'triggers',  label: 'Triggers',       hint: 'Postprandial · Lying flat · Fatty / spicy' },
    { key: 'response',  label: 'PPI response',   hint: 'Complete · Partial · None' },
    { key: 'alarm',     label: 'Alarm features', hint: 'Dysphagia · Weight loss · Haematemesis · Anaemia' },
  ]},
  { name: 'Nausea / vomiting', icon: '🤢', prompts: [
    { key: 'onset',    label: 'Onset & frequency', hint: '' },
    { key: 'character',label: 'Character',         hint: 'Bilious · Faeculent · Blood-stained · Undigested food' },
    { key: 'timing',   label: 'Timing re meals',   hint: 'Immediately / delayed — gastroparesis / obstruction' },
    { key: 'assoc',    label: 'Associated',        hint: 'Abdominal pain · Fever · Headache' },
  ]},
  { name: 'Post-op concern', icon: '🏥', prompts: [
    { key: 'procedure', label: 'Procedure & date',  hint: '' },
    { key: 'concern',   label: 'Nature of concern', hint: 'Pain · Discharge · Swelling · Dehiscence · Fever' },
    { key: 'onset',     label: 'Onset post-op',     hint: 'Days after surgery when problem started' },
    { key: 'systemic',  label: 'Systemic',           hint: 'Fever · Malaise · Rigors' },
  ]},
  { name: 'Other', icon: '✏️', prompts: [
    { key: 'onset',     label: 'Onset',     hint: 'When · How started' },
    { key: 'character', label: 'Character', hint: 'Nature of symptom' },
    { key: 'assoc',     label: 'Associated',hint: 'Other symptoms' },
    { key: 'severity',  label: 'Severity',  hint: '0–10' },
  ]},
];

function matchTemplate(name: string): Template {
  const l = name.toLowerCase();
  return TEMPLATES.find(t =>
    l.includes(t.name.toLowerCase().split(' ')[0]) || t.name.toLowerCase().includes(l.split(' ')[0])
  ) ?? TEMPLATES[TEMPLATES.length - 1]!;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChiefComplaintStrip() {
  const { symptoms, procedureData, setProcedureData, hpiNotes, setHpiNotes } = useAppContext();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const entries: CCEntry[] = (procedureData['cc'] as CCEntry[] | undefined) ?? [];

  function setEntries(next: CCEntry[]) {
    setProcedureData({ ...procedureData, cc: next });
  }

  function addComplaint(name: string) {
    const trimmed = name.trim();
    if (!trimmed || entries.length >= 3 || entries.some(e => e.complaint === trimmed)) return;
    const next = [...entries, { complaint: trimmed, answers: {} }];
    setEntries(next);
    setExpanded(next.length - 1);
    setShowPicker(false);
    setCustomInput('');
  }

  function removeComplaint(idx: number) {
    setEntries(entries.filter((_, i) => i !== idx));
    if (expanded === idx) setExpanded(null);
    else if (expanded !== null && expanded > idx) setExpanded(expanded - 1);
  }

  function setAnswer(entryIdx: number, key: string, value: string) {
    setEntries(entries.map((e, i) =>
      i === entryIdx ? { ...e, answers: { ...e.answers, [key]: value } } : e
    ));
  }

  function insertHpi() {
    const lines: string[] = [];
    entries.forEach(entry => {
      const tpl = matchTemplate(entry.complaint);
      lines.push(entry.complaint.toUpperCase());
      tpl.prompts.forEach(p => {
        const ans = entry.answers[p.key]?.trim();
        if (ans) lines.push(`  ${p.label}: ${ans}`);
      });
    });
    if (lines.length === 0) return;
    const sep = hpiNotes && !hpiNotes.endsWith('\n') ? '\n\n' : '';
    setHpiNotes(hpiNotes + sep + lines.join('\n'));
  }

  const intakeSuggestions = symptoms.filter(s => !entries.some(e => e.complaint === s));

  return (
    <div style={{ borderRadius: 10, border: '1px solid #1e293b', background: '#0f172a', marginBottom: 8, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: (entries.length > 0 || showPicker) ? '1px solid #1e293b' : 'none' }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569' }}>
          Chief Complaint
        </span>

        {/* Active CC summary when not expanded */}
        {entries.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {entries.map((entry, i) => {
              const tpl = matchTemplate(entry.complaint);
              const answered = Object.values(entry.answers).filter(Boolean).length;
              const isOpen = expanded === i;
              return (
                <button key={i} type="button" onClick={() => setExpanded(isOpen ? null : i)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 11px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${isOpen ? '#0d9488' : '#334155'}`,
                    background: isOpen ? '#0d948818' : '#1e293b',
                    color: isOpen ? '#2dd4bf' : '#cbd5e1',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
                  }}>
                  <span>{tpl.icon}</span>
                  <span>{entry.complaint}</span>
                  {answered > 0 && (
                    <span style={{ fontSize: 10, background: '#0d9488', color: '#fff', borderRadius: 999, padding: '1px 5px' }}>{answered}</span>
                  )}
                  <span style={{ fontSize: 11, color: '#64748b' }}>{isOpen ? '▲' : '▼'}</span>
                  <span role="button" onClick={e => { e.stopPropagation(); removeComplaint(i); }}
                    style={{ fontSize: 13, color: '#64748b', cursor: 'pointer', marginLeft: 1, lineHeight: 1 }}>×</span>
                </button>
              );
            })}
          </div>
        )}

        {entries.length === 0 && !showPicker && (
          <span style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', flex: 1 }}>No complaint selected — tap below to add</span>
        )}

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
          {entries.length > 0 && (
            <button type="button" onClick={insertHpi}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
              → Insert HPI
            </button>
          )}
          {entries.length < 3 && (
            <button type="button" onClick={() => { setShowPicker(p => !p); setExpanded(null); }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: showPicker ? '#334155' : '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {showPicker ? 'Close' : '+ Add'}
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded accordion for active complaint ── */}
      {expanded !== null && entries[expanded] && (() => {
        const entry = entries[expanded]!;
        const tpl = matchTemplate(entry.complaint);
        return (
          <div style={{ padding: '12px 14px', background: '#0f172a', borderBottom: showPicker ? '1px solid #1e293b' : 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0d9488', marginBottom: 10 }}>
              {tpl.icon} {entry.complaint} — targeted history (SOCRATES)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
              {tpl.prompts.map(p => (
                <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                    {p.label}
                    {p.hint && <span style={{ fontWeight: 400, color: '#475569', marginLeft: 4, fontSize: 10 }}>— {p.hint}</span>}
                  </label>
                  <input
                    type="text"
                    value={entry.answers[p.key] ?? ''}
                    onChange={e => setAnswer(expanded, p.key, e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #334155', fontSize: 13, color: '#f1f5f9', background: '#1e293b', outline: 'none' }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Complaint picker ── */}
      {showPicker && (
        <div style={{ padding: '12px 14px', background: '#0f172a' }}>
          {/* Freetext input */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              type="text" value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addComplaint(customInput)}
              placeholder="Type any complaint and press Enter…"
              autoFocus
              style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid #334155', fontSize: 13, color: '#f1f5f9', background: '#1e293b', outline: 'none' }}
            />
            {customInput.trim() && (
              <button type="button" onClick={() => addComplaint(customInput)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Add
              </button>
            )}
          </div>

          {/* Intake suggestions */}
          {intakeSuggestions.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569', marginBottom: 5 }}>
                From questionnaire
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {intakeSuggestions.map(s => (
                  <button key={s} type="button" onClick={() => addComplaint(s)}
                    style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid #3730a3', background: '#1e1b4b', color: '#a5b4fc', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Template list */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569', marginBottom: 5 }}>
              Common surgical complaints
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {TEMPLATES.filter(t => !entries.some(e => e.complaint === t.name)).map(t => (
                <button key={t.name} type="button" onClick={() => addComplaint(t.name)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontSize: 12, cursor: 'pointer', transition: 'all 0.1s' }}>
                  {t.icon} {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
