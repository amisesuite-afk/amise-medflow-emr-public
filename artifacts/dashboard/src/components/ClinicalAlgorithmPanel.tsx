import { useState, useMemo, useEffect } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';
import { useAppContext } from '@/context/AppContext';

// ── Shared helpers ────────────────────────────────────────────────────────────

function Num({
  label, value, unit, onChange, hint,
}: {
  label: string; value: string; unit?: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
        {label}
        {unit && <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>{unit}</span>}
        {hint && <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4, fontSize: 10 }}>— {hint}</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db',
          fontSize: 13, color: '#111827', background: '#fff', outline: 'none', width: '100%',
        }}
      />
    </div>
  );
}

function ResultPill({
  label, met, neutral,
}: {
  label: string; met: boolean | null; neutral?: boolean;
}) {
  const bg   = neutral ? '#f3f4f6' : met ? '#fef2f2' : '#f0fdf4';
  const clr  = neutral ? '#6b7280' : met ? '#dc2626'  : '#16a34a';
  const txt  = neutral ? label     : met ? `✓ ${label}` : `✗ ${label}`;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: bg, color: clr, border: `1px solid ${neutral ? '#e5e7eb' : met ? '#fca5a5' : '#86efac'}`,
    }}>
      {txt}
    </span>
  );
}

// ── Checkbox helper ───────────────────────────────────────────────────────────

function CheckList({ items, checked, setChecked, accent }: {
  items: string[]; checked: boolean[]; setChecked: (v: boolean[]) => void; accent: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => (
        <label key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
          padding: '7px 11px', borderRadius: 7, fontSize: 12,
          background: checked[i] ? `${accent}12` : '#f9fafb',
          border: `1px solid ${checked[i] ? accent : '#e5e7eb'}`,
          color: checked[i] ? accent : '#374151',
          fontWeight: checked[i] ? 600 : 400,
        }}>
          <input
            type="checkbox"
            checked={checked[i]}
            onChange={e => {
              const n = [...checked];
              n[i] = e.target.checked;
              setChecked(n);
            }}
            style={{ marginTop: 1, accentColor: accent, flexShrink: 0 }}
          />
          {item}
        </label>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Alvarado Score — Acute Appendicitis
// ══════════════════════════════════════════════════════════════════════════════

const ALVARADO_ITEMS = [
  { label: 'Migration of pain to RIF', points: 1 },
  { label: 'Anorexia', points: 1 },
  { label: 'Nausea / Vomiting', points: 1 },
  { label: 'RIF tenderness', points: 2 },
  { label: 'Rebound tenderness', points: 1 },
  { label: 'Elevated temperature >37.3°C', points: 1 },
  { label: 'Leucocytosis WBC >10,000', points: 2 },
  { label: 'Left shift (neutrophilia)', points: 1 },
];

function AlvaradoCalc() {
  const [checked, setChecked] = useState<boolean[]>(Array(ALVARADO_ITEMS.length).fill(false));

  const score = useMemo(() =>
    ALVARADO_ITEMS.reduce((sum, item, i) => sum + (checked[i] ? item.points : 0), 0),
    [checked]);

  const badge = score >= 9
    ? { label: 'Near-certain appendicitis', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }
    : score >= 7
    ? { label: 'Likely appendicitis — surgical review', bg: '#fffbeb', color: '#92400e', border: '#fcd34d' }
    : { label: 'Low probability — observe / repeat', bg: '#f0fdf4', color: '#166534', border: '#86efac' };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>Alvarado Score (MANTRELS)</strong> — max 10 points. Score ≥7 = likely; ≥9 = near-certain.
        RIF tenderness and leucocytosis each score 2 points.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
        {ALVARADO_ITEMS.map((item, i) => (
          <label key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '8px 12px', borderRadius: 7, fontSize: 12,
            background: checked[i] ? '#fff7ed' : '#f9fafb',
            border: `1px solid ${checked[i] ? '#fb923c' : '#e5e7eb'}`,
            color: checked[i] ? '#c2410c' : '#374151',
            fontWeight: checked[i] ? 600 : 400,
          }}>
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={e => {
                const n = [...checked];
                n[i] = e.target.checked;
                setChecked(n);
              }}
              style={{ accentColor: '#fb923c', flexShrink: 0 }}
            />
            <span style={{ flex: 1 }}>{item.label}</span>
            <span style={{
              fontWeight: 700, fontSize: 13,
              color: checked[i] ? '#c2410c' : '#9ca3af',
            }}>+{item.points}</span>
          </label>
        ))}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 18px', borderRadius: 10,
        background: badge.bg, border: `2px solid ${badge.border}`,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: badge.color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 10, color: badge.color, fontWeight: 600 }}>/ 10</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: badge.color }}>{badge.label}</div>
          <div style={{ fontSize: 11, color: badge.color, marginTop: 2, opacity: 0.8 }}>
            {score >= 9 ? 'Consider immediate appendicectomy without further imaging in males.'
              : score >= 7 ? 'USS ± CT to confirm. Surgical review mandatory.'
              : 'Active observation, repeat bloods at 6–8 h, USS if uncertain.'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Ranson Criteria — Acute Pancreatitis Severity
// ══════════════════════════════════════════════════════════════════════════════

const RANSON_ADMISSION = [
  'Age > 55 years',
  'WBC > 16,000 /mm³',
  'Glucose > 11 mmol/L (200 mg/dL)',
  'LDH > 350 IU/L',
  'AST > 250 IU/L',
];

const RANSON_48H = [
  'Haematocrit fall > 10%',
  'BUN rise > 1.8 mmol/L (5 mg/dL)',
  'Calcium < 2 mmol/L (8 mg/dL)',
  'PO₂ < 60 mmHg',
  'Base deficit > 4 mEq/L',
  'Fluid sequestration > 6 L',
];

function RansonCalc() {
  const [adm, setAdm] = useState<boolean[]>(Array(RANSON_ADMISSION.length).fill(false));
  const [h48, setH48] = useState<boolean[]>(Array(RANSON_48H.length).fill(false));

  const score = adm.filter(Boolean).length + h48.filter(Boolean).length;

  const badge = score >= 5
    ? { label: 'CRITICAL — mortality >40%', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }
    : score >= 3
    ? { label: 'SEVERE — mortality ~15%', bg: '#fffbeb', color: '#92400e', border: '#fcd34d' }
    : score >= 2
    ? { label: 'MILD — monitor closely', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' }
    : { label: 'MILD — mortality <1%', bg: '#f0fdf4', color: '#166534', border: '#86efac' };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>Ranson Criteria</strong> — 5 at admission + 6 at 48 h = 11 total.
        Score 0–2 mild, 3–4 severe (~15% mortality), ≥5 critical (&gt;40% mortality).
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#374151', marginBottom: 8 }}>
          At Admission
        </div>
        <CheckList items={RANSON_ADMISSION} checked={adm} setChecked={setAdm} accent="#2563eb" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#374151', marginBottom: 8 }}>
          At 48 Hours
        </div>
        <CheckList items={RANSON_48H} checked={h48} setChecked={setH48} accent="#7c3aed" />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 18px', borderRadius: 10,
        background: badge.bg, border: `2px solid ${badge.border}`,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: badge.color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 10, color: badge.color, fontWeight: 600 }}>/ 11</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: badge.color }}>{badge.label}</div>
          <div style={{ fontSize: 11, color: badge.color, marginTop: 2, opacity: 0.8 }}>
            {score >= 5 ? 'ICU admission, aggressive resuscitation, consider ERCP if biliary.'
              : score >= 3 ? 'HDU/monitored bed. CT at 48–72 h. Aggressive IV fluids 250–500 mL/h.'
              : 'Ward-level care. IV fluids, analgesia, NBM. Reassess at 48 h.'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Glasgow-Blatchford Score — Upper GI Bleed Risk Stratification
// ══════════════════════════════════════════════════════════════════════════════

function BlatchfordCalc() {
  const [bun,      setBun]      = useState('');
  const [hb,       setHb]       = useState('');
  const [sbp,      setSbp]      = useState('');
  const [tachyc,   setTachyc]   = useState(false);
  const [melaena,  setMelaena]  = useState(false);
  const [syncope,  setSyncope]  = useState(false);
  const [hepatic,  setHepatic]  = useState(false);
  const [cardiac,  setCardiac]  = useState(false);
  const [sex,      setSex]      = useState<'male' | 'female' | ''>('');

  const bunVal = parseFloat(bun);
  const hbVal  = parseFloat(hb);
  const sbpVal = parseFloat(sbp);

  const bunPts = !isNaN(bunVal)
    ? bunVal >= 25 ? 6 : bunVal >= 10 ? 4 : bunVal >= 8 ? 3 : bunVal >= 6.5 ? 2 : 0
    : 0;

  const hbPts = !isNaN(hbVal) && sex
    ? sex === 'male'
      ? hbVal < 100 ? 6 : hbVal < 120 ? 3 : 0
      : hbVal < 100 ? 6 : hbVal < 120 ? 1 : 0
    : 0;

  const sbpPts = !isNaN(sbpVal)
    ? sbpVal < 90 ? 3 : sbpVal < 100 ? 2 : sbpVal < 110 ? 1 : 0
    : 0;

  const score = bunPts + hbPts + sbpPts
    + (tachyc ? 1 : 0)
    + (melaena ? 1 : 0)
    + (syncope ? 2 : 0)
    + (hepatic ? 2 : 0)
    + (cardiac ? 2 : 0);

  const badge = score === 0
    ? { label: 'LOW RISK — outpatient management', bg: '#f0fdf4', color: '#166534', border: '#86efac' }
    : { label: 'ADMIT + OGD within 24 h', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>Glasgow-Blatchford Score</strong> — score 0 = low risk (outpatient).
        ≥1 = hospital admission + OGD. Hb thresholds differ by sex.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Sex</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['male', 'female'] as const).map(s => (
              <button key={s} type="button" onClick={() => setSex(s)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  background: sex === s ? '#2563eb' : '#f3f4f6',
                  color: sex === s ? '#fff' : '#6b7280',
                }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <Num label="BUN" value={bun} unit="mmol/L" onChange={setBun} hint={bunPts > 0 ? `+${bunPts}` : ''} />
        <Num label={`Hb${sex ? ` (${sex})` : ''}`} value={hb} unit="g/L" onChange={setHb} hint={hbPts > 0 ? `+${hbPts}` : ''} />
        <Num label="Systolic BP" value={sbp} unit="mmHg" onChange={setSbp} hint={sbpPts > 0 ? `+${sbpPts}` : ''} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
        {[
          { label: 'HR ≥ 100 bpm (+1)', val: tachyc, set: setTachyc, pts: 1 },
          { label: 'Melaena (+1)', val: melaena, set: setMelaena, pts: 1 },
          { label: 'Syncope (+2)', val: syncope, set: setSyncope, pts: 2 },
          { label: 'Hepatic disease (+2)', val: hepatic, set: setHepatic, pts: 2 },
          { label: 'Cardiac failure (+2)', val: cardiac, set: setCardiac, pts: 2 },
        ].map(({ label, val, set }) => (
          <label key={label} style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            padding: '7px 11px', borderRadius: 7, fontSize: 12,
            background: val ? '#fef2f218' : '#f9fafb',
            border: `1px solid ${val ? '#fca5a5' : '#e5e7eb'}`,
            color: val ? '#dc2626' : '#374151',
            fontWeight: val ? 600 : 400,
          }}>
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
              style={{ accentColor: '#dc2626', flexShrink: 0 }} />
            {label}
          </label>
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 18px', borderRadius: 10,
        background: badge.bg, border: `2px solid ${badge.border}`,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: badge.color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 10, color: badge.color, fontWeight: 600 }}>pts</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: badge.color }}>{badge.label}</div>
          <div style={{ fontSize: 11, color: badge.color, marginTop: 2, opacity: 0.8 }}>
            {score === 0
              ? 'No intervention needed before discharge. Outpatient OGD acceptable.'
              : 'Resuscitate first. Target Hb 70–90 g/L (80–100 if ACS/varices). OGD within 24 h; within 12 h if active haemorrhage.'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Light's Criteria — Pleural Fluid Analysis
// ══════════════════════════════════════════════════════════════════════════════

const LDHULN = 200; // typical ULN for serum LDH (IU/L) — 2/3 = 133

function LightsCriteriaCalc() {
  const [plLDH,  setPlLDH]  = useState('');
  const [seLDH,  setSeLDH]  = useState('');
  const [plProt, setPlProt] = useState('');
  const [seProt, setSeProt] = useState('');

  const result = useMemo(() => {
    const pl = parseFloat(plLDH);
    const sl = parseFloat(seLDH);
    const pp = parseFloat(plProt);
    const sp = parseFloat(seProt);

    const hasProt  = !isNaN(pp) && !isNaN(sp) && sp > 0;
    const hasLDHr  = !isNaN(pl) && !isNaN(sl) && sl > 0;
    const hasLDHabs= !isNaN(pl);

    const c1 = hasProt  ? (pp / sp) > 0.5  : null;
    const c2 = hasLDHr  ? (pl / sl) > 0.6  : null;
    const c3 = hasLDHabs? pl > (2 / 3) * LDHULN : null;

    const anyMet = [c1, c2, c3].some(c => c === true);
    const allNull = [c1, c2, c3].every(c => c === null);

    let verdict: 'exudate' | 'transudate' | null = null;
    if (!allNull) {
      verdict = anyMet ? 'exudate' : 'transudate';
    }

    return { c1, c2, c3, verdict };
  }, [plLDH, seLDH, plProt, seProt]);

  const verdictBg   = result.verdict === 'exudate' ? '#fef2f2' : result.verdict === 'transudate' ? '#eff6ff' : '#f9fafb';
  const verdictClr  = result.verdict === 'exudate' ? '#991b1b' : result.verdict === 'transudate' ? '#1e40af' : '#6b7280';
  const verdictBdr  = result.verdict === 'exudate' ? '#fca5a5' : result.verdict === 'transudate' ? '#bfdbfe' : '#e5e7eb';

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>Light's Criteria (1972)</strong> — exudate if ANY criterion met.
        If exudate, consider: parapneumonic, malignancy, PE, TB, pancreatitis.
        If transudate, consider: cardiac failure, hepatic hydrothorax, nephrotic syndrome.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Num label="Pleural LDH"     value={plLDH}  unit="IU/L"  onChange={setPlLDH} />
        <Num label="Serum LDH"       value={seLDH}  unit="IU/L"  onChange={setSeLDH} />
        <Num label="Pleural Protein" value={plProt} unit="g/L"   onChange={setPlProt} />
        <Num label="Serum Protein"   value={seProt} unit="g/L"   onChange={setSeProt} />
      </div>

      {/* Criteria results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {[
          { label: `Pleural protein / serum protein > 0.5 (${!isNaN(parseFloat(plProt)) && !isNaN(parseFloat(seProt)) && parseFloat(seProt) > 0 ? (parseFloat(plProt) / parseFloat(seProt)).toFixed(2) : '—'})`, met: result.c1 },
          { label: `Pleural LDH / serum LDH > 0.6 (${!isNaN(parseFloat(plLDH)) && !isNaN(parseFloat(seLDH)) && parseFloat(seLDH) > 0 ? (parseFloat(plLDH) / parseFloat(seLDH)).toFixed(2) : '—'})`, met: result.c2 },
          { label: `Pleural LDH > ⅔ ULN serum LDH (>${Math.round((2/3) * LDHULN)} IU/L)`, met: result.c3 },
        ].map((c, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px',
            borderRadius: 8, border: '1px solid #e5e7eb',
            background: c.met === null ? '#fafafa' : c.met ? '#fef2f2' : '#f0fdf4',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              background: c.met === null ? '#e5e7eb' : c.met ? '#dc2626' : '#16a34a',
              color: '#fff',
            }}>
              {c.met === null ? '?' : c.met ? '✓' : '✗'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Verdict */}
      <div style={{
        padding: '12px 16px', borderRadius: 10,
        background: verdictBg, border: `2px solid ${verdictBdr}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>
          {result.verdict === 'exudate' ? '🔴' : result.verdict === 'transudate' ? '🔵' : '⬜'}
        </span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: verdictClr, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {result.verdict === 'exudate' ? 'EXUDATE' : result.verdict === 'transudate' ? 'TRANSUDATE' : 'Enter values to classify'}
          </div>
          {result.verdict === 'exudate' && (
            <div style={{ fontSize: 11, color: '#991b1b', marginTop: 2 }}>
              Investigate cause — parapneumonic collection, malignancy, TB, PE, pancreatitis
            </div>
          )}
          {result.verdict === 'transudate' && (
            <div style={{ fontSize: 11, color: '#1e40af', marginTop: 2 }}>
              Systemic cause — treat underlying condition (cardiac failure, hepatic, renal)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Code Stroke — IV tPA decision tool (AHA/ASA 2019)
// ══════════════════════════════════════════════════════════════════════════════

const ABSOLUTE_EXCLUSIONS = [
  'Previous intracranial haemorrhage or significant head trauma <3 months',
  'Ischaemic stroke <3 months',
  'Intracranial / intraspinal surgery <3 months',
  'Intracranial neoplasm, AVM, or aneurysm',
  'Active internal bleeding (not menses)',
  'Suspected aortic dissection',
  'Infective endocarditis',
  'Significant closed-head / facial trauma <3 months',
  'Blood pressure >185/110 mmHg (unresponsive to treatment)',
];

const WARNINGS_3H = [
  'Mild / rapidly improving stroke symptoms (NIHSS < 5)',
  'Major surgery / serious trauma <14 days',
  'Post-MI pericarditis or recent MI',
  'GI / urinary haemorrhage <21 days',
  'Arterial puncture non-compressible site <7 days',
  'Platelet count < 100,000/mm³',
  'INR > 1.7 (or PT > 15 s)',
  'LMWH therapeutic dose <24 h',
  'Blood glucose < 2.8 or > 22.2 mmol/L',
  'CT showing multilobar infarction > 1/3 hemisphere',
];

const WARNINGS_45H = [
  'Age > 80 years',
  'NIHSS > 25',
  'History of stroke + diabetes',
  'Any anticoagulant use (regardless of INR)',
];

type YesNo = 'yes' | 'no' | '';

function CodeStrokeTPA() {
  const [ctNeg,      setCtNeg]      = useState<YesNo>('');
  const [onsetMins,  setOnsetMins]  = useState('');
  const [nihss,      setNihss]      = useState('');
  const [absExcl,    setAbsExcl]    = useState<boolean[]>(Array(ABSOLUTE_EXCLUSIONS.length).fill(false));
  const [warn3h,     setWarn3h]     = useState<boolean[]>(Array(WARNINGS_3H.length).fill(false));
  const [warn45h,    setWarn45h]    = useState<boolean[]>(Array(WARNINGS_45H.length).fill(false));

  const mins = parseFloat(onsetMins);
  const nih  = parseFloat(nihss);
  const within3h  = !isNaN(mins) && mins <= 180;
  const within45h = !isNaN(mins) && mins <= 270;

  const anyAbsExcl   = absExcl.some(Boolean);
  const warn45hCount = warn45h.filter(Boolean).length;

  const decision = useMemo<{ tpa: boolean | null; thrombectomy: boolean | null; reason: string }>(() => {
    if (ctNeg !== 'yes') return { tpa: null, thrombectomy: null, reason: 'Confirm CT shows no haemorrhage before proceeding.' };
    if (isNaN(mins))     return { tpa: null, thrombectomy: null, reason: 'Enter time since onset (minutes).' };
    if (anyAbsExcl)      return { tpa: false, thrombectomy: within45h, reason: 'Absolute exclusion criterion present — tPA CONTRAINDICATED.' };

    if (!within45h) {
      return {
        tpa: false,
        thrombectomy: true,
        reason: `Onset > 4.5 h — tPA not indicated. Consider mechanical thrombectomy if LVO present (within 6–24 h per DAWN/DEFUSE-3 criteria).`,
      };
    }

    if (!within3h && (warn45hCount > 0 || !isNaN(nih) && nih > 25)) {
      return {
        tpa: false,
        thrombectomy: true,
        reason: '3–4.5 h window with relative contraindication — individualise risk/benefit. Consider thrombectomy evaluation.',
      };
    }

    return {
      tpa: true,
      thrombectomy: within45h,
      reason: `Within ${within3h ? '3 h' : '4.5 h'} window — tPA INDICATED if BP controlled. ${within45h ? 'Also evaluate for LVO/thrombectomy.' : ''}`,
    };
  }, [ctNeg, mins, anyAbsExcl, within3h, within45h, warn45hCount, nih]);

  const tpaColor   = decision.tpa === true ? '#16a34a' : decision.tpa === false ? '#dc2626' : '#6b7280';
  const tpaBg      = decision.tpa === true ? '#f0fdf4' : decision.tpa === false ? '#fef2f2' : '#f9fafb';
  const tpaBdr     = decision.tpa === true ? '#86efac' : decision.tpa === false ? '#fca5a5' : '#e5e7eb';

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>
        <strong>AHA/ASA 2019 guidelines</strong> — document NIHSS, time of last known well, BP, and CT before activating tPA.
        This tool is a decision aid only — clinical judgement and team consensus are mandatory.
      </div>

      {/* Step 1 — CT & onset */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5 }}>CT brain — no haemorrhage?</div>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['yes', 'no'] as const).map(opt => (
              <button key={opt} type="button" onClick={() => setCtNeg(opt)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  background: ctNeg === opt ? (opt === 'yes' ? '#16a34a' : '#dc2626') : '#f3f4f6',
                  color: ctNeg === opt ? '#fff' : '#6b7280',
                  transition: 'all 0.12s',
                }}>
                {opt === 'yes' ? '✓ Confirmed' : '✗ Haemorrhage / not done'}
              </button>
            ))}
          </div>
        </div>
        <Num label="Time since onset" value={onsetMins} unit="min" onChange={setOnsetMins}
          hint={`${!isNaN(mins) ? (within3h ? '≤ 3 h' : within45h ? '3–4.5 h' : '> 4.5 h') : ''}`} />
        <Num label="NIHSS" value={nihss} unit="" onChange={setNihss} hint="0 = no deficit · 42 = max" />
      </div>

      {/* Time badge */}
      {!isNaN(mins) && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', borderRadius: 8, marginBottom: 14,
          background: within3h ? '#f0fdf4' : within45h ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${within3h ? '#86efac' : within45h ? '#fcd34d' : '#fca5a5'}`,
          color: within3h ? '#166534' : within45h ? '#92400e' : '#991b1b',
          fontSize: 12, fontWeight: 700,
        }}>
          {within3h ? '✓ Within 3 h window' : within45h ? '⚠ 3–4.5 h window' : '✗ Beyond 4.5 h — tPA window closed'}
          <span style={{ fontWeight: 400 }}>({Math.floor(mins / 60)}h {mins % 60}m)</span>
        </div>
      )}

      {/* Absolute exclusions */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#dc2626', marginBottom: 7 }}>
          ■ Absolute contraindications (check ALL that apply)
        </div>
        <CheckList items={ABSOLUTE_EXCLUSIONS} checked={absExcl} setChecked={setAbsExcl} accent="#dc2626" />
      </div>

      {/* Relative warnings 3h */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#d97706', marginBottom: 7 }}>
          ⚠ Relative warnings (3 h window)
        </div>
        <CheckList items={WARNINGS_3H} checked={warn3h} setChecked={setWarn3h} accent="#d97706" />
      </div>

      {/* Additional warnings 4.5h */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7c3aed', marginBottom: 7 }}>
          ⚠ Additional exclusions (3–4.5 h window only)
        </div>
        <CheckList items={WARNINGS_45H} checked={warn45h} setChecked={setWarn45h} accent="#7c3aed" />
      </div>

      {/* Decision */}
      <div style={{
        padding: '14px 16px', borderRadius: 10, marginTop: 4,
        background: tpaBg, border: `2px solid ${tpaBdr}`,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>
            {decision.tpa === true ? '✅' : decision.tpa === false ? '🚫' : '⬜'}
          </span>
          <div style={{ fontSize: 15, fontWeight: 800, color: tpaColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            IV tPA: {decision.tpa === true ? 'INDICATED' : decision.tpa === false ? 'CONTRAINDICATED' : 'PENDING DATA'}
          </div>
          {decision.thrombectomy === true && (
            <ResultPill label="Evaluate for thrombectomy" met={true} />
          )}
          {decision.thrombectomy === false && (
            <ResultPill label="Thrombectomy not indicated" met={false} />
          )}
        </div>
        <div style={{ fontSize: 12, color: tpaColor, opacity: 0.85 }}>{decision.reason}</div>
        {decision.tpa === true && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#166534', background: '#dcfce7', padding: '7px 11px', borderRadius: 7 }}>
            <strong>Pre-tPA checklist:</strong> BP ≤185/110 · Glucose 2.8–22.2 mmol/L · No anticoagulants ·
            Platelets ≥100k · INR ≤1.7 · Consent / next-of-kin · Neurosurgery backup available
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main panel — tool selector
// ══════════════════════════════════════════════════════════════════════════════

type AlgoTool = 'alvarado' | 'ranson' | 'blatchford' | 'lights' | 'stroke';

const TOOLS: { id: AlgoTool; icon: string; label: string; hint: string }[] = [
  { id: 'alvarado',   icon: '⚡', label: 'Alvarado Score',    hint: 'Acute appendicitis — surgical decision' },
  { id: 'ranson',     icon: '🔥', label: 'Ranson Criteria',   hint: 'Acute pancreatitis severity' },
  { id: 'blatchford', icon: '🩸', label: 'Glasgow-Blatchford', hint: 'Upper GI bleed — risk stratification' },
  { id: 'lights',     icon: '💧', label: "Light's Criteria",   hint: 'Pleural fluid — transudate vs exudate' },
  { id: 'stroke',     icon: '🧠', label: 'Code Stroke tPA',    hint: 'AHA/ASA 2019 — IV thrombolysis decision' },
];

const CC_TOOL_MAP: Partial<Record<string, AlgoTool>> = {
  'acute_appendicitis': 'alvarado',
  'acute_pancreatitis': 'ranson',
  'gi_bleed_upper':     'blatchford',
  'acute_cholangitis':  'lights',
  'bowel_obstruction':  'lights',
};

export default function ClinicalAlgorithmPanel() {
  const { activeCcKey } = useAppContext();
  const [active, setActive] = useState<AlgoTool | null>(null);

  // Auto-activate matching tool when CC changes
  useEffect(() => {
    if (!activeCcKey) return;
    const mapped = CC_TOOL_MAP[activeCcKey];
    if (mapped) setActive(mapped);
  }, [activeCcKey]);

  return (
    <CollapsibleCard title="Clinical Algorithms" defaultOpen={false}>
      {/* Tool selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: active ? 16 : 0 }}>
        {TOOLS.map(t => {
          const isSel = active === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setActive(isSel ? null : t.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '10px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${isSel ? '#2563eb' : '#e2e8f0'}`,
                background: isSel ? '#eff6ff' : '#fff',
                minWidth: 140, transition: 'all 0.12s',
              }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? '#1d4ed8' : '#111827' }}>{t.label}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{t.hint}</div>
            </button>
          );
        })}
      </div>

      {/* Active tool */}
      {active === 'alvarado' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c2410c', marginBottom: 10 }}>
            ⚡ ALVARADO SCORE — Acute Appendicitis
          </div>
          <AlvaradoCalc />
        </div>
      )}

      {active === 'ranson' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b45309', marginBottom: 10 }}>
            🔥 RANSON CRITERIA — Acute Pancreatitis Severity
          </div>
          <RansonCalc />
        </div>
      )}

      {active === 'blatchford' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626', marginBottom: 10 }}>
            🩸 GLASGOW-BLATCHFORD — Upper GI Bleed Risk
          </div>
          <BlatchfordCalc />
        </div>
      )}

      {active === 'lights' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2563eb', marginBottom: 10 }}>
            💧 LIGHT&apos;S CRITERIA — Pleural Fluid Classification
          </div>
          <LightsCriteriaCalc />
        </div>
      )}

      {active === 'stroke' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626', marginBottom: 10 }}>
            🧠 CODE STROKE — IV tPA Decision (AHA/ASA 2019)
          </div>
          <CodeStrokeTPA />
        </div>
      )}
    </CollapsibleCard>
  );
}
