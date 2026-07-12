import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── Numeric helpers ──────────────────────────────────────────────────────────

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}
function fmt1(n: number): string { return (Math.round(n * 10) / 10).toFixed(1); }
function fmtInt(n: number): string { return Math.round(n).toString(); }

// ─── Fluid formulas ───────────────────────────────────────────────────────────

/** Holliday-Segar maintenance fluid (mL/hr and mL/day) */
function holidaySegar(wt: number): { perHour: number; perDay: number } {
  let perDay = 0;
  if (wt <= 10) perDay = wt * 100;
  else if (wt <= 20) perDay = 1000 + (wt - 10) * 50;
  else perDay = 1500 + (wt - 20) * 20;
  return { perDay, perHour: perDay / 24 };
}

/** Estimated Blood Volume (mL) */
function ebv(wt: number, sex: 'M' | 'F'): number {
  return wt * (sex === 'M' ? 75 : 65);
}

/** Maximum Allowable Blood Loss (mL) */
function mabl(wt: number, sex: 'M' | 'F', hbStart: number, hbTrigger: number): number {
  return ebv(wt, sex) * (hbStart - hbTrigger) / hbStart;
}

/** Fluid replacement for blood loss — 3:1 crystalloid or 1:1 colloid */
function replacementVol(bloodLoss: number, method: 'crystalloid' | 'colloid' | 'packed_rbcs'): number {
  if (method === 'crystalloid') return bloodLoss * 3;
  if (method === 'colloid') return bloodLoss;
  // Packed RBCs: 1 unit (~300 mL) raises Hb by ~10 g/L in a 70 kg adult
  return bloodLoss; // direct ml-for-ml replacement of estimated loss
}

// ─── Nutritional formulas ─────────────────────────────────────────────────────

function calcBMI(wt: number, htCm: number): number {
  const h = htCm / 100;
  return wt / (h * h);
}

/** MUST (Malnutrition Universal Screening Tool) */
interface MustResult {
  bmiScore: number;
  wtLossScore: number;
  acuteScore: number;
  total: number;
  risk: 'low' | 'medium' | 'high';
  action: string;
}
function mustScore(bmi: number, wtLossPct: number, acuteDisease: boolean): MustResult {
  const bmiScore = bmi >= 20 ? 0 : bmi >= 18.5 ? 1 : 2;
  const wtLossScore = wtLossPct < 5 ? 0 : wtLossPct <= 10 ? 1 : 2;
  const acuteScore = acuteDisease ? 2 : 0;
  const total = bmiScore + wtLossScore + acuteScore;
  const risk: MustResult['risk'] = total === 0 ? 'low' : total === 1 ? 'medium' : 'high';
  const actions: Record<MustResult['risk'], string> = {
    low: 'Routine clinical care. Repeat weekly (hospital) or monthly (community).',
    medium: 'Observe. Document dietary intake for 3 days; if adequate — no concern. If inadequate — refer to dietitian.',
    high: 'Treat. Refer to dietitian. Set nutritional goals. Monitor and review care plan.',
  };
  return { bmiScore, wtLossScore, acuteScore, total, risk, action: actions[risk] };
}

/** Caloric and protein targets */
interface NutritionTargets {
  minCal: number; maxCal: number;
  minProt: number; maxProt: number;
  minFluid: number; maxFluid: number;
}
function nutritionTargets(wt: number, stress: 'maintenance' | 'moderate' | 'high'): NutritionTargets {
  const calPerKg = stress === 'maintenance' ? [25, 30] : stress === 'moderate' ? [30, 35] : [35, 40];
  const protPerKg = stress === 'maintenance' ? [1.2, 1.5] : stress === 'moderate' ? [1.5, 2.0] : [2.0, 2.5];
  return {
    minCal: wt * calPerKg[0], maxCal: wt * calPerKg[1],
    minProt: wt * protPerKg[0], maxProt: wt * protPerKg[1],
    minFluid: wt * 30, maxFluid: wt * 35,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

type ReplacementMethod = 'crystalloid' | 'colloid' | 'packed_rbcs';
type StressLevel = 'maintenance' | 'moderate' | 'high';

export default function FluidNutritionTab() {
  const ctx = useAppContext();

  // Shared patient inputs
  const [weightStr, setWeightStr] = useState(ctx.weightKg || '');
  const [heightStr, setHeightStr] = useState(ctx.heightCm || '');
  const [sexInput, setSexInput]   = useState<'M' | 'F'>(
    ctx.sex === 'male' ? 'M' : ctx.sex === 'female' ? 'F' : 'M'
  );

  const wt = parseNum(weightStr);
  const ht = parseNum(heightStr);
  const bmi = wt && ht ? calcBMI(wt, ht) : null;

  // ── Fluid panel state ──
  const [hbStartStr, setHbStartStr] = useState('');
  const [hbTriggerStr, setHbTriggerStr] = useState('80');
  const [bloodLossStr, setBloodLossStr] = useState('');
  const [replMethod, setReplMethod] = useState<ReplacementMethod>('crystalloid');

  // ── MUST panel state ──
  const [wtLossStr, setWtLossStr] = useState('');
  const [acuteDisease, setAcuteDisease] = useState(false);

  // ── Nutrition panel state ──
  const [stress, setStress] = useState<StressLevel>('maintenance');

  // ── Derived: fluid ──
  const fluid = useMemo(() => {
    if (!wt) return null;
    const hs = holidaySegar(wt);
    const hbS = parseNum(hbStartStr);
    const hbT = parseNum(hbTriggerStr);
    const mablVal = hbS && hbT && hbS > hbT ? mabl(wt, sexInput, hbS, hbT) : null;
    const bloodLoss = parseNum(bloodLossStr);
    const replVol = bloodLoss ? replacementVol(bloodLoss, replMethod) : null;
    const ebvVal = ebv(wt, sexInput);
    return { hs, mablVal, ebvVal, bloodLoss, replVol };
  }, [wt, sexInput, hbStartStr, hbTriggerStr, bloodLossStr, replMethod]);

  // ── Derived: MUST ──
  const must = useMemo(() => {
    if (!bmi) return null;
    const wtLoss = parseNum(wtLossStr);
    return mustScore(bmi, wtLoss ?? 0, acuteDisease);
  }, [bmi, wtLossStr, acuteDisease]);

  // ── Derived: nutrition ──
  const nutrition = useMemo(() => {
    if (!wt) return null;
    return nutritionTargets(wt, stress);
  }, [wt, stress]);

  const riskColor: Record<string, string> = { low: '#15803d', medium: '#b45309', high: '#dc2626' };
  const riskBg: Record<string, string> = { low: '#f0fdf4', medium: '#fefce8', high: '#fef2f2' };
  const riskBorder: Record<string, string> = { low: '#86efac', medium: '#fde047', high: '#fca5a5' };

  return (
    <div className="gap-y">

      {/* Header */}
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '16px 20px', color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Fluid & Nutrition Calculator</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          Perioperative fluid management · MUST screening · Nutritional targets — verify against clinical judgment
        </div>
      </div>

      {/* ── Shared patient inputs ───────────────────────────────────────── */}
      <CollapsibleCard title="Patient">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <Field label="Weight (kg)">
            <input style={inp} type="number" min="1" max="300" value={weightStr}
              onChange={e => setWeightStr(e.target.value)} placeholder="e.g. 75" />
          </Field>
          <Field label="Height (cm)">
            <input style={inp} type="number" min="50" max="250" value={heightStr}
              onChange={e => setHeightStr(e.target.value)} placeholder="e.g. 170" />
          </Field>
          <Field label="Sex">
            <select style={inp} value={sexInput} onChange={e => setSexInput(e.target.value as 'M' | 'F')}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </Field>
          {bmi && (
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
              <Chip label="BMI" value={fmt1(bmi)} unit="kg/m²"
                color={bmi < 18.5 ? '#dc2626' : bmi >= 30 ? '#b45309' : '#15803d'} />
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* ── Fluid Management ───────────────────────────────────────────── */}
      <CollapsibleCard title="Fluid Management">
        {!wt ? (
          <div style={noData}>Enter weight above to calculate fluid requirements.</div>
        ) : (
          <>
            {/* Maintenance */}
            <SectionLabel>Maintenance Fluids (Holliday-Segar)</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <Chip label="Rate" value={fmt1(fluid!.hs.perHour)} unit="mL/hr" color="#1d4ed8" />
              <Chip label="Daily volume" value={fmtInt(fluid!.hs.perDay)} unit="mL/day" color="#1d4ed8" />
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
              4 mL/kg/hr (first 10 kg) + 2 mL/kg/hr (10–20 kg) + 1 mL/kg/hr (&gt;20 kg). Adjust for fever (+10–12% per °C above 37°C), drains, insensible losses.
            </div>

            {/* EBV + MABL */}
            <SectionLabel>Estimated Blood Volume & Maximum Allowable Blood Loss</SectionLabel>
            <div style={{ marginBottom: 10 }}>
              <Chip label="EBV" value={fmtInt(fluid!.ebvVal)} unit="mL"
                color="#7c3aed" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              <Field label="Starting Hb (g/L)">
                <input style={inp} type="number" min="40" max="200" value={hbStartStr}
                  onChange={e => setHbStartStr(e.target.value)} placeholder="e.g. 130" />
              </Field>
              <Field label="Trigger Hb (g/L)">
                <input style={inp} type="number" min="40" max="200" value={hbTriggerStr}
                  onChange={e => setHbTriggerStr(e.target.value)} placeholder="e.g. 80" />
              </Field>
            </div>
            {fluid?.mablVal != null ? (
              <div style={{ marginBottom: 14 }}>
                <Chip label="MABL" value={fmtInt(fluid.mablVal)} unit="mL"
                  color={fluid.mablVal < 500 ? '#dc2626' : '#15803d'} />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  MABL = EBV × (Hb_start − Hb_trigger) / Hb_start. Consider cell salvage if MABL &lt; 500 mL.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                Enter starting and trigger Hb to calculate MABL.
              </div>
            )}

            {/* Intraoperative replacement */}
            <SectionLabel>Intraoperative Blood Loss Replacement</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              <Field label="Estimated blood loss (mL)">
                <input style={inp} type="number" min="0" max="20000" value={bloodLossStr}
                  onChange={e => setBloodLossStr(e.target.value)} placeholder="e.g. 300" />
              </Field>
              <Field label="Replacement method">
                <select style={inp} value={replMethod} onChange={e => setReplMethod(e.target.value as ReplacementMethod)}>
                  <option value="crystalloid">Crystalloid (3:1)</option>
                  <option value="colloid">Colloid (1:1)</option>
                  <option value="packed_rbcs">Packed RBCs (1:1)</option>
                </select>
              </Field>
            </div>
            {fluid?.replVol != null && (
              <div style={{ marginBottom: 8 }}>
                <Chip label="Replacement volume" value={fmtInt(fluid.replVol)} unit="mL"
                  color="#0f766e" />
                {replMethod === 'packed_rbcs' && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    1 unit pRBC (~280–300 mL) raises Hb ≈ 10 g/L in a 70 kg adult. Adjust for patient size.
                  </div>
                )}
              </div>
            )}

            {/* Transfusion triggers */}
            <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Transfusion Triggers (NICE / AABB)
              </div>
              {[
                { hb: '< 70 g/L', action: 'Transfuse (symptomatic or active bleeding)', color: '#dc2626' },
                { hb: '70–80 g/L', action: 'Consider transfusion in symptomatic patients or post-cardiac surgery', color: '#b45309' },
                { hb: '> 80 g/L', action: 'Avoid transfusion unless symptomatic or high clinical risk', color: '#15803d' },
              ].map(row => (
                <div key={row.hb} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4, alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700, color: row.color, minWidth: 70 }}>{row.hb}</span>
                  <span style={{ color: '#475569' }}>{row.action}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CollapsibleCard>

      {/* ── MUST Nutritional Screening ──────────────────────────────────── */}
      <CollapsibleCard title="MUST Nutritional Screening">
        {!bmi ? (
          <div style={noData}>Enter weight and height above to calculate BMI for MUST scoring.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
              {/* Step 1: BMI score */}
              <div style={mustStepBox}>
                <div style={mustStepLabel}>Step 1: BMI</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{fmt1(bmi)} kg/m²</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {bmi >= 20 ? 'Score 0 (≥ 20)' : bmi >= 18.5 ? 'Score 1 (18.5–20)' : 'Score 2 (< 18.5)'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>
                  {must!.bmiScore}
                </div>
              </div>

              {/* Step 2: Weight loss */}
              <div style={mustStepBox}>
                <div style={mustStepLabel}>Step 2: Unintentional weight loss (past 3–6 months)</div>
                <input style={{ ...inp, marginTop: 4 }} type="number" min="0" max="50" value={wtLossStr}
                  onChange={e => setWtLossStr(e.target.value)} placeholder="% body weight lost" />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {parseNum(wtLossStr) === null ? '—' : parseNum(wtLossStr)! < 5 ? 'Score 0 (< 5%)' : parseNum(wtLossStr)! <= 10 ? 'Score 1 (5–10%)' : 'Score 2 (> 10%)'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8' }}>
                  {must!.wtLossScore}
                </div>
              </div>

              {/* Step 3: Acute disease */}
              <div style={mustStepBox}>
                <div style={mustStepLabel}>Step 3: Acute disease effect</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  Acutely ill and there has been or is likely to be no nutritional intake for &gt; 5 days?
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={acuteDisease}
                    onChange={e => setAcuteDisease(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Yes (score +2)</span>
                </label>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>
                  {must!.acuteScore}
                </div>
              </div>
            </div>

            {/* MUST result */}
            {must && (
              <div style={{
                background: riskBg[must.risk], border: `2px solid ${riskBorder[must.risk]}`,
                borderRadius: 10, padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>MUST Total Score</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: riskColor[must.risk] }}>{must.total}</div>
                  </div>
                  <div style={{ background: riskColor[must.risk], color: '#fff', borderRadius: 8, padding: '6px 16px', fontWeight: 800, fontSize: 14 }}>
                    {must.risk.toUpperCase()} RISK
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                  {must.action}
                </div>
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
              MUST — BAPEN 2003. Validated for use in hospital and community settings. Reassess weekly in hospital.
            </div>
          </>
        )}
      </CollapsibleCard>

      {/* ── Nutritional Requirements ───────────────────────────────────── */}
      <CollapsibleCard title="Nutritional Requirements">
        {!wt ? (
          <div style={noData}>Enter weight above to calculate nutritional targets.</div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Field label="Metabolic stress level">
                <select style={inp} value={stress} onChange={e => setStress(e.target.value as StressLevel)}>
                  <option value="maintenance">Maintenance (post-op, ambulant, mild illness)</option>
                  <option value="moderate">Moderate stress (major surgery, infection, sepsis)</option>
                  <option value="high">High stress (ICU, severe sepsis, burns, trauma)</option>
                </select>
              </Field>
            </div>

            {nutrition && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
                  <NutrChip label="Energy" min={fmtInt(nutrition.minCal)} max={fmtInt(nutrition.maxCal)} unit="kcal/day" color="#1d4ed8" />
                  <NutrChip label="Protein" min={fmt1(nutrition.minProt)} max={fmt1(nutrition.maxProt)} unit="g/day" color="#7c3aed" />
                  <NutrChip label="Fluid" min={fmtInt(nutrition.minFluid)} max={fmtInt(nutrition.maxFluid)} unit="mL/day" color="#0f766e" />
                </div>

                {/* Per-kg reference */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Per-kg targets ({fmtInt(wt)} kg)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12 }}>
                    {[
                      { label: 'Energy', val: `${stress === 'maintenance' ? '25–30' : stress === 'moderate' ? '30–35' : '35–40'} kcal/kg/day` },
                      { label: 'Protein', val: `${stress === 'maintenance' ? '1.2–1.5' : stress === 'moderate' ? '1.5–2.0' : '2.0–2.5'} g/kg/day` },
                      { label: 'Fluid', val: '30–35 mL/kg/day' },
                    ].map(r => (
                      <div key={r.label}>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{r.label}: </span>
                        <span style={{ color: '#334155' }}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Route guidance */}
                <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Route Decision
                  </div>
                  {[
                    { condition: 'Gut functioning + able to eat', route: 'Oral diet ± supplements (first choice)', color: '#15803d' },
                    { condition: 'Gut functioning, cannot swallow safely', route: 'Enteral (NGT or NJT) — prefer over PN', color: '#1d4ed8' },
                    { condition: 'Gut non-functional, ileus &gt; 5 days, malabsorption', route: 'Parenteral Nutrition (PN) — pharmacy involvement essential', color: '#7c3aed' },
                  ].map(r => (
                    <div key={r.condition} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 5, alignItems: 'flex-start' }}>
                      <span style={{ color: r.color, fontWeight: 700, minWidth: 6 }}>•</span>
                      <span><strong style={{ color: '#334155' }}>{r.condition}:</strong> <span style={{ color: '#475569' }}>{r.route}</span></span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Monitor: weight, fluid balance, U&E, glucose, phosphate (refeeding risk), LFTs on PN.
                  </div>
                </div>

                {/* Refeeding warning */}
                {(must && must.risk === 'high') || (bmi && bmi < 16) ? (
                  <div style={{ marginTop: 8, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>⚠ Refeeding Syndrome Risk</div>
                    <div style={{ fontSize: 12, color: '#7f1d1d' }}>
                      High MUST score or severe undernutrition detected. Start at 10 kcal/kg/day, increase slowly over 4–7 days. Monitor phosphate, potassium, magnesium closely. Supplement thiamine before feeding. NICE CG32 guidance applies.
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </CollapsibleCard>

    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Chip({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ background: '#f8fafc', border: `1px solid ${color}40`, borderRadius: 8, padding: '8px 12px', display: 'inline-block', minWidth: 120 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 2 }}>
        {value} <span style={{ fontSize: 11, fontWeight: 500 }}>{unit}</span>
      </div>
    </div>
  );
}

function NutrChip({ label, min, max, unit, color }: { label: string; min: string; max: string; unit: string; color: string }) {
  return (
    <div style={{ background: '#f8fafc', border: `1px solid ${color}40`, borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 2 }}>
        {min}–{max}
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8' }}>{unit}</div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 13, color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box',
};
const noData: React.CSSProperties = { fontSize: 12, color: '#94a3b8' };
const mustStepBox: React.CSSProperties = {
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px',
};
const mustStepLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
};
