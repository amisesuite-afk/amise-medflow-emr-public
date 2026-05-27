import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { ICD_CODES, type IcdCode } from '@/data/icd-db';
import { getCdsSuggestions } from '@/lib/clinical-cds';
import { useSpeechInput } from '@/hooks/useSpeechInput';

// ── Differential prompts with common signs ────────────────────────────────────

type DiffOption = { name: string; signs: string[] };

const DIFFERENTIAL_PROMPTS: Record<string, DiffOption[]> = {
  ercp_workup: [
    { name: 'Choledocholithiasis',        signs: ['RUQ pain', 'jaundice', 'fever', "Murphy's sign"] },
    { name: 'Cholangiocarcinoma',         signs: ['jaundice', 'weight loss', 'pruritis', 'dark urine'] },
    { name: 'Pancreatic head carcinoma',  signs: ['painless jaundice', 'weight loss', "Courvoisier's sign"] },
    { name: 'Primary sclerosing cholangitis', signs: ['jaundice', 'pruritis', 'fatigue', 'IBD'] },
    { name: 'Acute cholangitis',          signs: ["Charcot's triad", 'fever', 'RUQ pain', 'jaundice'] },
    { name: 'Acute hepatitis',            signs: ['jaundice', 'RUQ pain', 'nausea', 'fatigue'] },
  ],
  breast: [
    { name: 'Fibroadenoma',              signs: ['smooth', 'mobile', 'rubbery', 'young female'] },
    { name: 'Fibrocystic change',        signs: ['cyclical pain', 'bilateral', 'nodularity', 'premenstrual'] },
    { name: 'Breast carcinoma',          signs: ['hard', 'irregular', 'fixed', 'skin change', 'lymph nodes'] },
    { name: 'Phyllodes tumour',          signs: ['large', 'rapid growth', 'smooth', 'older female'] },
    { name: 'Mastitis / abscess',        signs: ['erythema', 'hot', 'tender', 'fever', 'lactating'] },
    { name: 'Fat necrosis',              signs: ['post-trauma', 'firm', 'skin dimpling', 'irregular'] },
    { name: 'Ductal carcinoma in situ',  signs: ['nipple discharge', 'microcalcification', 'mammographic'] },
  ],
  post_op: [
    { name: 'Surgical site infection',   signs: ['erythema', 'warmth', 'discharge', 'fever', 'pain'] },
    { name: 'Wound dehiscence',          signs: ['wound opening', 'serosanguinous', 'post-exertion'] },
    { name: 'Intra-abdominal collection',signs: ['fever', 'ileus', 'abdominal pain', 'leucocytosis'] },
    { name: 'Anastomotic leak',          signs: ['fever', 'peritonitis', 'tachycardia', 'feculent drain'] },
    { name: 'Pulmonary embolism',        signs: ['dyspnoea', 'tachycardia', 'pleuritic pain', 'leg swelling'] },
    { name: 'Deep vein thrombosis',      signs: ['leg swelling', 'calf tenderness', "Homans' sign"] },
    { name: 'Ileus / obstruction',       signs: ['distension', 'no flatus', 'vomiting', 'absent bowel sounds'] },
  ],
  diabetic_foot: [
    { name: 'Diabetic foot ulcer',       signs: ['neuropathy', 'pressure area', 'painless', 'callous'] },
    { name: 'Necrotising fasciitis',     signs: ['crepitus', 'rapid spread', 'systemic sepsis', 'disproportionate pain'] },
    { name: 'Osteomyelitis',             signs: ['bone exposure', 'probes to bone', 'chronic', 'non-healing'] },
    { name: 'Peripheral arterial disease', signs: ['absent pulses', 'claudication', 'rest pain', 'ABPI <0.9'] },
    { name: 'Cellulitis',               signs: ['erythema', 'warmth', 'spreading border', 'no fluctuance'] },
    { name: 'Abscess',                  signs: ['fluctuance', 'localised', 'pus', 'tender'] },
  ],
  new_consult: [
    { name: 'Acute appendicitis',        signs: ['RIF pain', "Rovsing's", 'rebound', 'fever', 'migration'] },
    { name: 'Cholecystitis',             signs: ["Murphy's sign", 'RUQ pain', 'fever', 'post-fatty meal'] },
    { name: 'Diverticulitis',            signs: ['LIF pain', 'fever', 'altered bowel habit', 'elderly'] },
    { name: 'Bowel obstruction',         signs: ['colicky pain', 'distension', 'vomiting', 'no flatus'] },
    { name: 'Hernia (complicated)',      signs: ['groin lump', 'irreducible', 'tender', 'vomiting'] },
    { name: 'Peptic ulcer disease',      signs: ['epigastric pain', 'antacid relief', 'Helicobacter', 'nausea'] },
    { name: 'Pancreatitis',             signs: ['epigastric pain', 'radiation to back', 'vomiting', 'elevated amylase'] },
  ],
};

// ── CDS urgency styles ────────────────────────────────────────────────────────

const URGENCY_STYLE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  urgent:   { bg: '#fff1f2', border: '#fca5a5', color: '#991b1b', dot: '#ef4444' },
  relevant: { bg: '#fffbeb', border: '#fcd34d', color: '#78350f', dot: '#f59e0b' },
  consider: { bg: '#f0fdf4', border: '#86efac', color: '#14532d', dot: '#22c55e' },
};

// ── Diagnosis search + ICD picker ────────────────────────────────────────────

function splitLabel(label: string): { code: string; desc: string } {
  const idx = label.indexOf(' — ');
  return idx === -1 ? { code: label, desc: '' } : { code: label.slice(0, idx), desc: label.slice(idx + 3) };
}

function DiagnosisPicker() {
  const { icdCodes, setIcdCodes, assessment, setAssessment } = useAppContext();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered: IcdCode[] = query.trim().length < 2 ? [] :
    ICD_CODES.filter(c =>
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 14);

  // Group filtered by category
  const grouped: Record<string, IcdCode[]> = {};
  for (const c of filtered) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  function select(code: IcdCode) {
    const label = `${code.code} — ${code.description}`;
    if (!icdCodes.includes(label)) {
      setIcdCodes([...icdCodes, label]);
      if (!assessment.trim()) setAssessment(code.description);
    }
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function remove(label: string) {
    setIcdCodes(icdCodes.filter(c => c !== label));
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* ── Selected diagnoses ── */}
      {icdCodes.length > 0 && (
        <div style={{
          border: '1.5px solid #bfdbfe',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 12,
          boxShadow: '0 1px 4px rgba(3,105,161,.07)',
        }}>
          {icdCodes.map((label, i) => {
            const { code, desc } = splitLabel(label);
            const isPrimary = i === 0;
            return (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: isPrimary ? '#eff6ff' : '#fafafa',
                  borderBottom: i < icdCodes.length - 1 ? '1px solid #e5e7eb' : 'none',
                }}
              >
                {/* Primary / Secondary badge */}
                <span style={{
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  padding: '3px 7px',
                  borderRadius: 4,
                  background: isPrimary ? '#1e40af' : '#e5e7eb',
                  color: isPrimary ? '#fff' : '#6b7280',
                  minWidth: 70,
                  textAlign: 'center',
                }}>
                  {isPrimary ? 'Primary Dx' : `2° Dx`}
                </span>

                {/* ICD code badge */}
                <span style={{
                  flexShrink: 0,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  background: isPrimary ? '#0369a1' : '#4b5563',
                  padding: '3px 9px',
                  borderRadius: 5,
                  letterSpacing: '0.04em',
                }}>
                  {code}
                </span>

                {/* Description */}
                <span style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: isPrimary ? 700 : 400,
                  color: isPrimary ? '#1e3a5f' : '#374151',
                }}>
                  {desc}
                </span>

                <button
                  type="button"
                  onClick={() => remove(label)}
                  title="Remove"
                  style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Search input ── */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 16, color: '#9ca3af', pointerEvents: 'none',
        }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={e => { setOpen(true); (e.target as HTMLInputElement).style.borderColor = '#0369a1'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#d1d5db'; }}
          placeholder={icdCodes.length > 0
            ? 'Add another diagnosis…'
            : 'Search diagnosis by name or ICD-10 code  (e.g. "cholangitis", "C18", "appendicitis")'}
          style={{
            width: '100%',
            fontSize: 13,
            padding: '11px 14px 11px 38px',
            border: '1.5px solid #d1d5db',
            borderRadius: 8,
            background: '#fff',
            outline: 'none',
          }}
        />
      </div>

      {/* ── Dropdown ── */}
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 70,
          background: '#fff',
          border: '1px solid #e0e7ff',
          borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          maxHeight: 360,
          overflowY: 'auto',
        }}>
          {Object.entries(grouped).map(([category, codes]) => (
            <div key={category}>
              <div style={{
                padding: '5px 14px 4px',
                fontSize: 9.5,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: '#0369a1',
                background: '#f0f9ff',
                borderBottom: '1px solid #e0f2fe',
              }}>
                {category}
              </div>
              {codes.map(c => {
                const label = `${c.code} — ${c.description}`;
                const added = icdCodes.includes(label);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => select(c)}
                    disabled={added}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '10px 14px',
                      background: added ? '#f0fdf4' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: added ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = '#f0f9ff'; }}
                    onMouseLeave={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    {/* Code badge */}
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#0369a1',
                      background: '#dbeafe',
                      padding: '3px 8px',
                      borderRadius: 4,
                      minWidth: 62,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {c.code}
                    </span>
                    <span style={{ flex: 1, fontSize: 13.5, color: '#111827', fontWeight: 500 }}>
                      {c.description}
                    </span>
                    {added && (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>
                        ✓ Added
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && filtered.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 70,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '14px 16px', fontSize: 13, color: '#6b7280', marginTop: 0,
        }}>
          No results for <strong>"{query}"</strong> — try a broader term or different spelling
        </div>
      )}
    </div>
  );
}

// ── Mic button ────────────────────────────────────────────────────────────────

function MicButton({ listening, supported, onToggle }: { listening: boolean; supported: boolean; onToggle: () => void }) {
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={listening ? 'Stop dictation' : 'Dictate'}
      style={{
        background: listening ? '#ef4444' : '#f9fafb',
        border: `1px solid ${listening ? '#ef4444' : '#d1d5db'}`,
        borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
        color: listening ? '#fff' : '#6b7280', fontSize: 13, lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}
    >
      {listening ? '⏹ Stop' : '🎙 Dictate'}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AssessmentTab() {
  const {
    assessment, setAssessment,
    differentials, setDifferentials,
    triageResult,
    symptoms, examFindings, vitals, investigationResults,
    comorbidities, age, sex, isPostOp, procedureData, rosFindings,
  } = useAppContext();

  const apptType = triageResult.appointmentType;
  const ddxOptions: DiffOption[] = DIFFERENTIAL_PROMPTS[apptType] ?? DIFFERENTIAL_PROMPTS['new_consult'];

  const assessmentMic = useSpeechInput();
  const differentialsMic = useSpeechInput();

  const cdsSuggestions = getCdsSuggestions({
    symptoms, examFindings, vitals, investigationResults,
    comorbidities, assessment, rosFindings, age, sex, isPostOp, procedureData,
  });

  function addDiff(name: string) {
    const line = differentials.trim() ? `${differentials.trim()}\n${name}` : name;
    setDifferentials(line);
  }

  return (
    <div className="gap-y">

      {/* CDS suggestions */}
      {cdsSuggestions.length > 0 && (
        <CollapsibleCard
          title={`Clinical Decision Support — ${cdsSuggestions.length} active suggestion${cdsSuggestions.length > 1 ? 's' : ''}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cdsSuggestions.map(s => {
              const style = URGENCY_STYLE[s.urgency];
              return (
                <div key={s.scaleKey} style={{
                  background: style.bg, border: `1px solid ${style.border}`,
                  borderRadius: 8, padding: '8px 12px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ color: style.dot, fontSize: 10, marginTop: 3 }}>●</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: style.color }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.triggerReason}</div>
                    {s.needsLabs && !s.labsPresent && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' }}>
                        Add lab results in Investigations to complete this score
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: style.color, background: style.border, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                  }}>
                    {s.categoryTag}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
            Navigate to the <strong>Scales</strong> tab to complete and score each tool.
          </div>
        </CollapsibleCard>
      )}

      {/* ── Working Diagnosis ── */}
      <CollapsibleCard title="Working diagnosis">

        {/* Diagnosis search with ICD-10 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280' }}>
                Diagnosis + ICD-10 code
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                Search by name or code — first selected = primary diagnosis
              </div>
            </div>
          </div>
          <DiagnosisPicker />
        </div>

        {/* Clinical impression / reasoning */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#6b7280', margin: 0,
            }}>
              Clinical impression / reasoning
            </label>
            <MicButton
              listening={assessmentMic.listening}
              supported={assessmentMic.supported}
              onToggle={() => {
                if (assessmentMic.listening) {
                  assessmentMic.stop();
                } else {
                  assessmentMic.start(text => setAssessment(assessment ? `${assessment} ${text}` : text));
                }
              }}
            />
          </div>
          <textarea
            value={assessment}
            onChange={e => setAssessment(e.target.value)}
            placeholder="Clinical impression, supporting evidence, reasoning, degree of certainty…"
            style={{ minHeight: 90, width: '100%' }}
          />
        </div>
      </CollapsibleCard>

      {/* ── Differential Diagnoses ── */}
      <CollapsibleCard title="Differential diagnoses">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: '#6b7280', margin: 0,
          }}>
            Differentials — free text or use prompts
          </label>
          <MicButton
            listening={differentialsMic.listening}
            supported={differentialsMic.supported}
            onToggle={() => {
              if (differentialsMic.listening) {
                differentialsMic.stop();
              } else {
                differentialsMic.start(text => setDifferentials(differentials ? `${differentials}\n${text}` : text));
              }
            }}
          />
        </div>
        <textarea
          value={differentials}
          onChange={e => setDifferentials(e.target.value)}
          placeholder="1. …\n2. …\n3. …"
          style={{ minHeight: 80, width: '100%', marginBottom: 12 }}
        />

        {/* Differential chips with common signs */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', marginBottom: 7 }}>
          Suggested for {apptType.replace(/_/g, ' ')}
          <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#bbb' }}>
            — brackets show shared features
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {ddxOptions.map(d => (
            <button
              key={d.name}
              type="button"
              onClick={() => addDiff(d.name)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                cursor: 'pointer',
                textAlign: 'left',
                gap: 3,
                transition: 'background .12s, border-color .12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#bfdbfe';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                + {d.name}
              </span>
              <span style={{ fontSize: 10.5, color: '#6b7280', fontStyle: 'italic' }}>
                [{d.signs.join(' · ')}]
              </span>
            </button>
          ))}
        </div>
      </CollapsibleCard>

    </div>
  );
}
