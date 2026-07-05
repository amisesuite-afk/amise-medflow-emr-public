import { useState, useMemo } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';

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

type AlgoTool = 'lights' | 'stroke';

const TOOLS: { id: AlgoTool; icon: string; label: string; hint: string }[] = [
  { id: 'lights', icon: '💧', label: "Light's Criteria",  hint: 'Pleural fluid — transudate vs exudate' },
  { id: 'stroke', icon: '🧠', label: 'Code Stroke tPA',   hint: 'AHA/ASA 2019 — IV thrombolysis decision' },
];

export default function ClinicalAlgorithmPanel() {
  const [active, setActive] = useState<AlgoTool | null>(null);

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
                minWidth: 160, transition: 'all 0.12s',
              }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? '#1d4ed8' : '#111827' }}>{t.label}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{t.hint}</div>
            </button>
          );
        })}
      </div>

      {/* Active tool */}
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
