import { useState, useMemo, useEffect, useRef } from 'react';
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

function ScoreBadge({ score, max, bg, border, color, label, detail }: {
  score: number; max: number; bg: string; border: string; color: string; label: string; detail?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 18px', borderRadius: 10,
      background: bg, border: `2px solid ${border}`,
    }}>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color, fontWeight: 600 }}>/ {max}</div>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color }}>{label}</div>
        {detail && <div style={{ fontSize: 11, color, marginTop: 2, opacity: 0.8 }}>{detail}</div>}
      </div>
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
      <ScoreBadge score={score} max={10} {...badge}
        detail={score >= 9 ? 'Consider immediate appendicectomy without further imaging in males.'
          : score >= 7 ? 'USS ± CT to confirm. Surgical review mandatory.'
          : 'Active observation, repeat bloods at 6–8 h, USS if uncertain.'} />
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

      <ScoreBadge score={score} max={11} {...badge}
        detail={score >= 5 ? 'ICU admission, aggressive resuscitation, consider ERCP if biliary.'
          : score >= 3 ? 'HDU/monitored bed. CT at 48–72 h. Aggressive IV fluids 250–500 mL/h.'
          : 'Ward-level care. IV fluids, analgesia, NBM. Reassess at 48 h.'} />
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
          { label: 'HR ≥ 100 bpm (+1)', val: tachyc, set: setTachyc },
          { label: 'Melaena (+1)', val: melaena, set: setMelaena },
          { label: 'Syncope (+2)', val: syncope, set: setSyncope },
          { label: 'Hepatic disease (+2)', val: hepatic, set: setHepatic },
          { label: 'Cardiac failure (+2)', val: cardiac, set: setCardiac },
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

      <ScoreBadge score={score} max={23} {...badge}
        detail={score === 0
          ? 'No intervention needed before discharge. Outpatient OGD acceptable.'
          : 'Resuscitate first. Target Hb 70–90 g/L (80–100 if ACS/varices). OGD within 24 h; within 12 h if active haemorrhage.'} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Light's Criteria — Pleural Fluid Analysis
// ══════════════════════════════════════════════════════════════════════════════

const LDHULN = 200;

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
        <strong>Light&apos;s Criteria (1972)</strong> — exudate if ANY criterion met.
        If exudate, consider: parapneumonic, malignancy, PE, TB, pancreatitis.
        If transudate, consider: cardiac failure, hepatic hydrothorax, nephrotic syndrome.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Num label="Pleural LDH"     value={plLDH}  unit="IU/L"  onChange={setPlLDH} />
        <Num label="Serum LDH"       value={seLDH}  unit="IU/L"  onChange={setSeLDH} />
        <Num label="Pleural Protein" value={plProt} unit="g/L"   onChange={setPlProt} />
        <Num label="Serum Protein"   value={seProt} unit="g/L"   onChange={setSeProt} />
      </div>

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
  const warn3hCount  = warn3h.filter(Boolean).length;
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

    if (!within3h && (warn45hCount > 0 || (!isNaN(nih) && nih > 25))) {
      return {
        tpa: false,
        thrombectomy: true,
        reason: '3–4.5 h window with relative contraindication — individualise risk/benefit. Consider thrombectomy evaluation.',
      };
    }

    if (warn3hCount > 0) {
      return {
        tpa: null,
        thrombectomy: within45h,
        reason: `${warn3hCount} relative contraindication${warn3hCount > 1 ? 's' : ''} present in ≤3 h window — team consensus required before tPA. Each must be individually weighed (AHA/ASA 2019).`,
      };
    }

    return {
      tpa: true,
      thrombectomy: within45h,
      reason: `Within ${within3h ? '3 h' : '4.5 h'} window — tPA INDICATED if BP controlled. ${within45h ? 'Also evaluate for LVO/thrombectomy.' : ''}`,
    };
  }, [ctNeg, mins, anyAbsExcl, within3h, within45h, warn3hCount, warn45hCount, nih]);

  const tpaColor   = decision.tpa === true ? '#16a34a' : decision.tpa === false ? '#dc2626' : '#6b7280';
  const tpaBg      = decision.tpa === true ? '#f0fdf4' : decision.tpa === false ? '#fef2f2' : '#f9fafb';
  const tpaBdr     = decision.tpa === true ? '#86efac' : decision.tpa === false ? '#fca5a5' : '#e5e7eb';

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>
        <strong>AHA/ASA 2019 guidelines</strong> — document NIHSS, time of last known well, BP, and CT before activating tPA.
        This tool is a decision aid only — clinical judgement and team consensus are mandatory.
      </div>

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

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#dc2626', marginBottom: 7 }}>
          ■ Absolute contraindications (check ALL that apply)
        </div>
        <CheckList items={ABSOLUTE_EXCLUSIONS} checked={absExcl} setChecked={setAbsExcl} accent="#dc2626" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#d97706', marginBottom: 7 }}>
          ⚠ Relative warnings (3 h window)
        </div>
        <CheckList items={WARNINGS_3H} checked={warn3h} setChecked={setWarn3h} accent="#d97706" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7c3aed', marginBottom: 7 }}>
          ⚠ Additional exclusions (3–4.5 h window only)
        </div>
        <CheckList items={WARNINGS_45H} checked={warn45h} setChecked={setWarn45h} accent="#7c3aed" />
      </div>

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
// qSOFA — Quick Sequential Organ Failure Assessment (Sepsis-3)
// ══════════════════════════════════════════════════════════════════════════════

function QsofaCalc() {
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);

  const score = checks.filter(Boolean).length;

  const badge = score >= 2
    ? { label: 'HIGH RISK — suspect sepsis, full SOFA assessment', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }
    : score === 1
    ? { label: 'Intermediate — monitor, reassess if deteriorates', bg: '#fffbeb', color: '#92400e', border: '#fcd34d' }
    : { label: 'Criteria not met — sepsis less likely on bedside assessment', bg: '#f0fdf4', color: '#166534', border: '#86efac' };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>qSOFA (Sepsis-3)</strong> — bedside screening tool. Score ≥2 = high risk for
        sepsis-related organ dysfunction; warrants full SOFA, source investigation, and early intervention.
      </div>
      <CheckList
        items={[
          'Altered mentation (GCS < 15 or new confusion)',
          'Respiratory rate ≥ 22 /min',
          'Systolic BP ≤ 100 mmHg',
        ]}
        checked={checks}
        setChecked={setChecks}
        accent="#dc2626"
      />
      <div style={{ marginTop: 14 }}>
        <ScoreBadge score={score} max={3} {...badge}
          detail={score >= 2
            ? 'Blood cultures × 2, lactate, IV access, 30 mL/kg IVF bolus, empiric antibiotics within 1 h. Calculate full SOFA.'
            : 'Continue assessment. Recheck vitals at 30–60 min. Escalate if worsening.'} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NEWS2 — National Early Warning Score 2
// ══════════════════════════════════════════════════════════════════════════════

function news2RR(v: number) { return v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3; }
function news2SpO2(v: number) { return v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0; }
function news2SBP(v: number) { return v <= 90 ? 3 : v <= 100 ? 2 : v <= 110 ? 1 : v <= 219 ? 0 : 3; }
function news2HR(v: number) { return v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3; }
function news2Temp(v: number) { return v <= 35.0 ? 3 : v <= 36.0 ? 1 : v <= 38.0 ? 0 : v <= 39.0 ? 1 : 2; }

function NEWS2Calc() {
  const [rr,      setRr]      = useState('');
  const [spo2,    setSpo2]    = useState('');
  const [onO2,    setOnO2]    = useState(false);
  const [sbp,     setSbp]     = useState('');
  const [hr,      setHr]      = useState('');
  const [temp,    setTemp]    = useState('');
  const [cvpu,    setCvpu]    = useState(false);

  const rrV   = parseFloat(rr);
  const spo2V = parseFloat(spo2);
  const sbpV  = parseFloat(sbp);
  const hrV   = parseFloat(hr);
  const tempV = parseFloat(temp);

  const scores = {
    rr:   !isNaN(rrV)   ? news2RR(rrV)     : null,
    spo2: !isNaN(spo2V) ? news2SpO2(spo2V) : null,
    o2:   onO2 ? 2 : 0,
    sbp:  !isNaN(sbpV)  ? news2SBP(sbpV)   : null,
    hr:   !isNaN(hrV)   ? news2HR(hrV)      : null,
    temp: !isNaN(tempV) ? news2Temp(tempV)  : null,
    cons: cvpu ? 3 : 0,
  };

  const filledScores = Object.values(scores).filter(s => s !== null) as number[];
  const total = filledScores.reduce((a, b) => a + b, 0);
  const hasAny3 = filledScores.some(s => s === 3);
  const anyFilled = filledScores.length > 0;

  const risk = anyFilled
    ? (total >= 7 || (hasAny3 && total >= 5)) ? 'high'
    : (total >= 5 || hasAny3) ? 'medium'
    : total >= 1 ? 'low-medium'
    : 'low'
    : null;

  const badge = risk === 'high'
    ? { label: 'HIGH RISK — emergency assessment', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }
    : risk === 'medium'
    ? { label: 'MEDIUM — urgent review within 30 min', bg: '#fffbeb', color: '#92400e', border: '#fcd34d' }
    : risk === 'low-medium'
    ? { label: 'LOW-MEDIUM — reassess 4–6 hourly', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' }
    : { label: 'LOW — minimum monitoring (12 hourly)', bg: '#f0fdf4', color: '#166534', border: '#86efac' };

  const PARAMS: { label: string; value: string; unit: string; onChange: (v: string) => void; hint: string }[] = [
    { label: 'Respiratory Rate', value: rr,   unit: '/min', onChange: setRr,   hint: scores.rr !== null ? `+${scores.rr}` : '' },
    { label: 'SpO₂',            value: spo2,  unit: '%',    onChange: setSpo2, hint: scores.spo2 !== null ? `+${scores.spo2}` : '' },
    { label: 'Systolic BP',     value: sbp,   unit: 'mmHg', onChange: setSbp,  hint: scores.sbp !== null ? `+${scores.sbp}` : '' },
    { label: 'Heart Rate',      value: hr,    unit: 'bpm',  onChange: setHr,   hint: scores.hr !== null ? `+${scores.hr}` : '' },
    { label: 'Temperature',     value: temp,  unit: '°C',   onChange: setTemp, hint: scores.temp !== null ? `+${scores.temp}` : '' },
  ];

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>NEWS2 (Royal College of Physicians 2017)</strong> — aggregate score: Low=0, Low-Med=1–4,
        Medium=5–6 or any single 3, High≥7. Any single parameter score of 3 alone warrants urgent review.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 10, marginBottom: 14 }}>
        {PARAMS.map(p => <Num key={p.label} {...p} />)}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1,
          padding: '7px 11px', borderRadius: 7, fontSize: 12,
          background: onO2 ? '#fef9c312' : '#f9fafb',
          border: `1px solid ${onO2 ? '#fcd34d' : '#e5e7eb'}`,
          color: onO2 ? '#92400e' : '#374151', fontWeight: onO2 ? 600 : 400,
        }}>
          <input type="checkbox" checked={onO2} onChange={e => setOnO2(e.target.checked)}
            style={{ accentColor: '#d97706', flexShrink: 0 }} />
          Supplemental O₂ (+2)
        </label>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1,
          padding: '7px 11px', borderRadius: 7, fontSize: 12,
          background: cvpu ? '#fef2f212' : '#f9fafb',
          border: `1px solid ${cvpu ? '#fca5a5' : '#e5e7eb'}`,
          color: cvpu ? '#dc2626' : '#374151', fontWeight: cvpu ? 600 : 400,
        }}>
          <input type="checkbox" checked={cvpu} onChange={e => setCvpu(e.target.checked)}
            style={{ accentColor: '#dc2626', flexShrink: 0 }} />
          New confusion / CVPU (+3)
        </label>
      </div>

      {anyFilled && badge ? (
        <ScoreBadge score={total} max={20} {...badge}
          detail={risk === 'high'
            ? 'Continuous monitoring. Emergency assessment by competent clinician. Consider HDU/ICU.'
            : risk === 'medium'
            ? 'Urgent review by clinician competent in acute illness. Consider critical care liaison.'
            : 'Increase frequency of monitoring. Inform nurse in charge.'} />
      ) : (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f9fafb', border: '2px solid #e5e7eb', color: '#6b7280', fontSize: 13 }}>
          Enter vital signs to calculate NEWS2 score
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Caprini VTE Risk Score — Surgical patients
// ══════════════════════════════════════════════════════════════════════════════

const CAPRINI_1PT = [
  'Age 41–60 years',
  'Minor surgery (<45 min)',
  'BMI > 25 kg/m²',
  'Swollen legs (current)',
  'Varicose veins',
  'Oral contraceptives or HRT',
  'Pregnancy or ≤1 month postpartum',
  'History of recurrent spontaneous abortion',
  'Sepsis or serious infection within 1 month',
  'Bed rest >72 hours pre-operatively',
  'Central venous access',
];

const CAPRINI_2PT = [
  'Age 61–74 years',
  'Open surgery or laparoscopy >45 min',
  'Malignancy (current or prior)',
  'Confined to bed >72 hours',
  'Personal or family history DVT/PE',
  'Known thrombophilia (Factor V Leiden, protein C/S deficiency, etc.)',
];

const CAPRINI_3PT = [
  'Age ≥75 years',
  'Prior DVT or PE (personal)',
];

const CAPRINI_5PT = [
  'Stroke or TIA within 1 month',
  'Hip, pelvis, or femur fracture within 1 month',
  'Acute spinal cord injury / paralysis within 1 month',
  'Multiple trauma within 1 month',
  'Elective major lower limb arthroplasty',
];

function CapriniCalc() {
  const [c1, setC1] = useState<boolean[]>(Array(CAPRINI_1PT.length).fill(false));
  const [c2, setC2] = useState<boolean[]>(Array(CAPRINI_2PT.length).fill(false));
  const [c3, setC3] = useState<boolean[]>(Array(CAPRINI_3PT.length).fill(false));
  const [c5, setC5] = useState<boolean[]>(Array(CAPRINI_5PT.length).fill(false));

  const score =
    c1.filter(Boolean).length * 1 +
    c2.filter(Boolean).length * 2 +
    c3.filter(Boolean).length * 3 +
    c5.filter(Boolean).length * 5;

  const badge = score >= 9
    ? { label: 'HIGHEST RISK (≥9) — extended prophylaxis', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }
    : score >= 5
    ? { label: 'HIGH RISK (5–8) — pharmacoprophylaxis + compression', bg: '#fffbeb', color: '#92400e', border: '#fcd34d' }
    : score >= 3
    ? { label: 'MODERATE RISK (3–4) — pharmacoprophylaxis ± compression', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' }
    : score >= 2
    ? { label: 'LOW-MODERATE RISK (2) — compression ± pharmacoprophylaxis', bg: '#fefce8', color: '#713f12', border: '#fde68a' }
    : { label: 'LOW RISK (0–1) — early mobilisation + compression stockings', bg: '#f0fdf4', color: '#166534', border: '#86efac' };

  const groupStyle = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', marginBottom: 6, marginTop: 4,
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>Caprini VTE Risk Score</strong> — validated for surgical patients.
        Score ≥5 = high risk VTE; pharmacoprophylaxis strongly recommended unless contraindicated.
        Score ≥9 = highest risk; consider 30-day extended prophylaxis post-discharge.
      </div>

      <div style={{ ...groupStyle, color: '#374151' }}>1 point each</div>
      <CheckList items={CAPRINI_1PT} checked={c1} setChecked={setC1} accent="#6b7280" />

      <div style={{ ...groupStyle, color: '#2563eb', marginTop: 12 }}>2 points each</div>
      <CheckList items={CAPRINI_2PT} checked={c2} setChecked={setC2} accent="#2563eb" />

      <div style={{ ...groupStyle, color: '#7c3aed', marginTop: 12 }}>3 points each</div>
      <CheckList items={CAPRINI_3PT} checked={c3} setChecked={setC3} accent="#7c3aed" />

      <div style={{ ...groupStyle, color: '#dc2626', marginTop: 12 }}>5 points each</div>
      <CheckList items={CAPRINI_5PT} checked={c5} setChecked={setC5} accent="#dc2626" />

      <div style={{ marginTop: 14 }}>
        <ScoreBadge score={score} max={50} {...badge}
          detail={score >= 9
            ? 'LMWH × 30 days post-discharge + sequential compression device + early mobilisation.'
            : score >= 5
            ? 'LMWH or unfractionated heparin BD/TDS + sequential compression device.'
            : score >= 3
            ? 'LMWH or UFH + compression stockings. Assess bleeding risk before initiating.'
            : 'Compression stockings throughout hospital stay. Encourage early mobilisation.'} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ASA Physical Status Classification
// ══════════════════════════════════════════════════════════════════════════════

const ASA_CLASSES = [
  {
    grade: 'ASA I',
    desc: 'Normal, healthy patient',
    examples: 'No organic, physiological, biochemical, or psychiatric disturbance. Healthy, non-smoking, minimal alcohol use.',
    bg: '#f0fdf4', color: '#166534', border: '#86efac',
  },
  {
    grade: 'ASA II',
    desc: 'Mild systemic disease — no functional limitation',
    examples: 'Well-controlled DM or HTN, obesity (BMI <40), mild lung disease, current smoker, social alcohol, pregnancy.',
    bg: '#f0fdf4', color: '#15803d', border: '#86efac',
  },
  {
    grade: 'ASA III',
    desc: 'Severe systemic disease — substantive functional limitation',
    examples: 'Poorly controlled DM/HTN, COPD, morbid obesity (BMI ≥40), active hepatitis, alcohol dependence, implanted pacemaker, moderate ESRD, history of MI >3 months, CVA >3 months.',
    bg: '#fffbeb', color: '#92400e', border: '#fcd34d',
  },
  {
    grade: 'ASA IV',
    desc: 'Severe systemic disease — constant threat to life',
    examples: 'Recent MI or CVA (<3 months), severe cardiac valve dysfunction, refractory CHF, severe ESRD, ongoing cardiac ischaemia, sepsis.',
    bg: '#fff7ed', color: '#c2410c', border: '#fb923c',
  },
  {
    grade: 'ASA V',
    desc: 'Moribund — not expected to survive without the operation',
    examples: 'Ruptured aortic aneurysm, massive trauma, intracranial bleed with mass effect, ischaemic bowel with multi-organ failure, haemodynamically unstable.',
    bg: '#fef2f2', color: '#991b1b', border: '#fca5a5',
  },
  {
    grade: 'ASA VI',
    desc: 'Brain-dead — organ donation',
    examples: 'Declared brain-dead patient maintained for organ donation purposes.',
    bg: '#f3f4f6', color: '#374151', border: '#d1d5db',
  },
];

function AsaCalc() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>ASA Physical Status Classification (ASA 2020)</strong> — click to select.
        Emergency modifier (E): add "E" suffix for emergency surgery at same grade (e.g. ASA IIE).
        Higher ASA correlates with increased perioperative morbidity and mortality.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ASA_CLASSES.map((c, i) => {
          const isSel = selected === i;
          return (
            <button
              key={c.grade}
              type="button"
              onClick={() => setSelected(isSel ? null : i)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
                padding: '10px 13px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${isSel ? c.border : '#e5e7eb'}`,
                background: isSel ? c.bg : '#fafafa',
                transition: 'all 0.12s',
              }}
            >
              <div style={{
                flexShrink: 0, fontSize: 11, fontWeight: 900, letterSpacing: '0.04em',
                color: isSel ? c.color : '#6b7280',
                minWidth: 52,
              }}>
                {c.grade}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: isSel ? 700 : 500, color: isSel ? c.color : '#374151' }}>
                  {c.desc}
                </div>
                {isSel && (
                  <div style={{ fontSize: 11, color: c.color, marginTop: 4, opacity: 0.85 }}>
                    {c.examples}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: ASA_CLASSES[selected].bg,
          border: `2px solid ${ASA_CLASSES[selected].border}`,
          color: ASA_CLASSES[selected].color,
          fontSize: 13, fontWeight: 700,
        }}>
          Selected: {ASA_CLASSES[selected].grade} — {ASA_CLASSES[selected].desc}
          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4 }}>
            Add "E" suffix for emergency procedures (e.g. {ASA_CLASSES[selected].grade}E).
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RCRI — Revised Cardiac Risk Index (Lee 1999)
// ══════════════════════════════════════════════════════════════════════════════

const RCRI_ITEMS = [
  'High-risk surgery (intraperitoneal, intrathoracic, or supra-inguinal vascular)',
  'History of ischaemic heart disease (MI, positive stress test, current angina, nitrate use, ECG Q-waves)',
  'History of congestive heart failure (pulmonary oedema, S3 gallop, paroxysmal nocturnal dyspnoea)',
  'History of cerebrovascular disease (TIA or stroke)',
  'Insulin-dependent diabetes mellitus',
  'Preoperative creatinine > 177 μmol/L (2.0 mg/dL) — or on dialysis',
];

function RcriCalc() {
  const [checked, setChecked] = useState<boolean[]>(Array(RCRI_ITEMS.length).fill(false));

  const score = checked.filter(Boolean).length;

  const mace = score === 0 ? '0.4%' : score === 1 ? '1.0%' : score === 2 ? '2.4%' : '5.4%';

  const badge = score >= 3
    ? { label: `HIGH RISK — MACE ~${mace}`, bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }
    : score === 2
    ? { label: `ELEVATED RISK — MACE ~${mace}`, bg: '#fffbeb', color: '#92400e', border: '#fcd34d' }
    : score === 1
    ? { label: `LOW RISK — MACE ~${mace}`, bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' }
    : { label: `VERY LOW RISK — MACE ~${mace}`, bg: '#f0fdf4', color: '#166534', border: '#86efac' };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
        <strong>RCRI (Lee Criteria, 1999)</strong> — predicts major adverse cardiac events (MACE)
        in patients undergoing non-cardiac surgery. Each criterion = 1 point.
        Score ≥3 warrants cardiology review and optimisation before elective surgery.
      </div>
      <CheckList items={RCRI_ITEMS} checked={checked} setChecked={setChecked} accent="#2563eb" />
      <div style={{ marginTop: 14 }}>
        <ScoreBadge score={score} max={6} {...badge}
          detail={score >= 3
            ? 'Cardiology review recommended. Consider non-invasive cardiac testing and optimisation before elective surgery. Discuss risk/benefit.'
            : score === 2
            ? 'Elevated perioperative cardiac risk. Consider cardiology review for major elective procedures. Optimise medical therapy.'
            : 'Proceed with planned surgery. Standard perioperative monitoring.'} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main panel — tool selector
// ══════════════════════════════════════════════════════════════════════════════

type AlgoTool = 'alvarado' | 'ranson' | 'blatchford' | 'lights' | 'stroke'
  | 'qsofa' | 'news2' | 'caprini' | 'asa' | 'rcri';

const TOOLS: { id: AlgoTool; icon: string; label: string; hint: string }[] = [
  { id: 'alvarado',   icon: '⚡', label: 'Alvarado Score',    hint: 'Acute appendicitis — surgical decision' },
  { id: 'ranson',     icon: '🔥', label: 'Ranson Criteria',   hint: 'Acute pancreatitis severity' },
  { id: 'blatchford', icon: '🩸', label: 'Glasgow-Blatchford', hint: 'Upper GI bleed — risk stratification' },
  { id: 'lights',     icon: '💧', label: "Light's Criteria",   hint: 'Pleural fluid — transudate vs exudate' },
  { id: 'stroke',     icon: '🧠', label: 'Code Stroke tPA',    hint: 'AHA/ASA 2019 — IV thrombolysis decision' },
  { id: 'qsofa',      icon: '🚨', label: 'qSOFA',              hint: 'Sepsis-3 bedside screening' },
  { id: 'news2',      icon: '📊', label: 'NEWS2',              hint: 'National Early Warning Score 2' },
  { id: 'caprini',    icon: '🩺', label: 'Caprini VTE',        hint: 'VTE risk — surgical prophylaxis' },
  { id: 'asa',        icon: '🏥', label: 'ASA Status',         hint: 'Anaesthetic risk classification' },
  { id: 'rcri',       icon: '❤️', label: 'RCRI',              hint: 'Cardiac risk — non-cardiac surgery' },
];

const CC_TOOL_MAP: Partial<Record<string, AlgoTool>> = {
  'acute_appendicitis': 'alvarado',
  'acute_pancreatitis': 'ranson',
  'gi_bleed_upper':     'blatchford',
  'pleural_effusion':   'lights',
  'empyema':            'lights',
};

interface ClinicalAlgorithmPanelProps {
  requestedTool?: string | null;
}

export default function ClinicalAlgorithmPanel({ requestedTool }: ClinicalAlgorithmPanelProps) {
  const { activeCcKey } = useAppContext();
  const [active, setActive] = useState<AlgoTool | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-activate matching tool when CC changes; clear if no mapping
  useEffect(() => {
    const mapped = activeCcKey ? CC_TOOL_MAP[activeCcKey] : undefined;
    setActive(mapped ?? null);
    if (mapped) setPanelOpen(true);
  }, [activeCcKey]);

  // Open and activate when a tool is requested from CDS panel
  useEffect(() => {
    if (!requestedTool) return;
    const valid = TOOLS.find(t => t.id === requestedTool);
    if (valid) {
      setActive(requestedTool as AlgoTool);
      setPanelOpen(true);
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [requestedTool]);

  return (
    <div ref={panelRef}>
      <CollapsibleCard
        title="Clinical Algorithms & Scoring Tools"
        open={panelOpen}
        onOpenChange={setPanelOpen}
      >
        {/* Tool selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: active ? 16 : 0 }}>
          {TOOLS.map(t => {
            const isSel = active === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setActive(isSel ? null : t.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${isSel ? '#2563eb' : '#e2e8f0'}`,
                  background: isSel ? '#eff6ff' : '#fff',
                  minWidth: 130, transition: 'all 0.12s',
                }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isSel ? '#1d4ed8' : '#111827' }}>{t.label}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{t.hint}</div>
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

        {active === 'qsofa' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626', marginBottom: 10 }}>
              🚨 qSOFA — Sepsis-3 Bedside Screen
            </div>
            <QsofaCalc />
          </div>
        )}

        {active === 'news2' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1e40af', marginBottom: 10 }}>
              📊 NEWS2 — National Early Warning Score
            </div>
            <NEWS2Calc />
          </div>
        )}

        {active === 'caprini' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7c3aed', marginBottom: 10 }}>
              🩺 CAPRINI VTE RISK — Surgical Patients
            </div>
            <CapriniCalc />
          </div>
        )}

        {active === 'asa' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0369a1', marginBottom: 10 }}>
              🏥 ASA PHYSICAL STATUS CLASSIFICATION
            </div>
            <AsaCalc />
          </div>
        )}

        {active === 'rcri' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#be185d', marginBottom: 10 }}>
              ❤️ RCRI — Revised Cardiac Risk Index
            </div>
            <RcriCalc />
          </div>
        )}
      </CollapsibleCard>
    </div>
  );
}
