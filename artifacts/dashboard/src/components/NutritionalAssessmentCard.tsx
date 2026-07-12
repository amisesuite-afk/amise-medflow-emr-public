import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── MUST Score (Malnutrition Universal Screening Tool) ───────────────────────

function calcMustBmiScore(bmi: number): 0 | 1 | 2 {
  if (bmi > 20)   return 0;
  if (bmi >= 18.5) return 1;
  return 2;
}

// ─── NRS-2002 ────────────────────────────────────────────────────────────────

const NRS_NUTRITIONAL: Array<{ value: number; label: string; criteria: string }> = [
  { value: 0, label: 'Not impaired', criteria: 'Normal nutritional status' },
  { value: 1, label: 'Mild', criteria: 'Weight loss >5% in 3 months OR food intake 50–75% of normal in last week' },
  { value: 2, label: 'Moderate', criteria: 'Weight loss >5% in 2 months OR BMI 18.5–20.5 AND general condition impaired OR food intake 25–50% of normal in last week' },
  { value: 3, label: 'Severe', criteria: 'Weight loss >5% in 1 month (>15% in 3 months) OR BMI <18.5 AND general condition impaired OR food intake 0–25% of normal in last week' },
];

const NRS_DISEASE: Array<{ value: number; label: string; criteria: string; examples: string }> = [
  { value: 0, label: 'None', criteria: 'Normal nutritional requirements', examples: 'Routine check-up, minor elective surgery' },
  { value: 1, label: 'Mild', criteria: 'Requirements slightly increased', examples: 'Hip fracture, chronic disease, COPD, haemodialysis, diabetes, cancer, cirrhosis' },
  { value: 2, label: 'Moderate', criteria: 'Requirements substantially increased', examples: 'Major abdominal surgery, stroke, severe pneumonia, haematologic malignancy' },
  { value: 3, label: 'Severe', criteria: 'Requirements greatly increased', examples: 'Head injury, bone marrow transplant, ICU patient (APACHE II >10)' },
];

function nrsRisk(nutritional: number, disease: number, ageOver70: boolean): { score: number; atRisk: boolean; recommendation: string } {
  const score = nutritional + disease + (ageOver70 ? 1 : 0);
  const atRisk = score >= 3;
  return {
    score,
    atRisk,
    recommendation: atRisk
      ? 'Nutritional support plan required. Refer to dietitian. Consider pre-operative optimisation (target ≥ 7–10 days before major surgery if malnourished).'
      : 'Nutritional risk is low. Re-screen weekly if in hospital, or at next scheduled appointment.',
  };
}

// ─── MUST weight loss options ─────────────────────────────────────────────────

const MUST_WL_OPTIONS: Array<{ value: 0 | 1 | 2; label: string }> = [
  { value: 0, label: '<5% in 3–6 months' },
  { value: 1, label: '5–10% in 3–6 months' },
  { value: 2, label: '>10% in 3–6 months' },
];

const MUST_ACUTE_OPTIONS: Array<{ value: 0 | 2; label: string; detail: string }> = [
  { value: 0, label: 'No acute disease effect', detail: 'Patient eating or expected to eat within 5 days' },
  { value: 2, label: 'Acute disease effect (+2)', detail: 'Acutely ill AND no nutritional intake (or likely not) for >5 days' },
];

export default function NutritionalAssessmentCard() {
  const { weightKg, heightCm, comorbidities, age } = useAppContext();

  // BMI auto-calc
  const bmiResult = useMemo(() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (!w || !h || h < 50) return null;
    const bmi = w / Math.pow(h / 100, 2);
    return { bmi: parseFloat(bmi.toFixed(1)) };
  }, [weightKg, heightCm]);

  // MUST state
  const [mustWlScore, setMustWlScore] = useState<0 | 1 | 2 | null>(null);
  const [mustAcuteScore, setMustAcuteScore] = useState<0 | 2 | null>(null);
  const [mustManualBmi, setMustManualBmi] = useState('');

  const effectiveBmi = bmiResult?.bmi ?? parseFloat(mustManualBmi);
  const mustBmiScore = effectiveBmi > 0 ? calcMustBmiScore(effectiveBmi) : null;

  const mustScore = mustBmiScore !== null && mustWlScore !== null && mustAcuteScore !== null
    ? mustBmiScore + mustWlScore + mustAcuteScore
    : null;

  function mustRisk(score: number): { level: string; color: string; action: string } {
    if (score === 0) return { level: 'Low', color: '#16a34a', action: 'Routine re-screening: monthly (community), weekly (hospital), each clinic visit (outpatient care).' };
    if (score === 1) return { level: 'Medium', color: '#d97706', action: 'Observe. Document dietary intake for 3 days. If adequate, re-screen weekly; if not adequate, refer to dietitian.' };
    return             { level: 'High', color: '#dc2626', action: 'Treat — refer to dietitian. Improve overall nutritional intake and monitor. Oral nutritional supplements if intake remains <75% of requirements.' };
  }

  // NRS-2002 state
  const [nrsNutritional, setNrsNutritional] = useState<number | null>(null);
  const [nrsDisease, setNrsDisease] = useState<number | null>(null);
  const ageNum = parseInt(age);
  const ageOver70 = ageNum >= 70;
  const nrsResult = nrsNutritional !== null && nrsDisease !== null
    ? nrsRisk(nrsNutritional, nrsDisease, ageOver70)
    : null;

  // Additional nutritional notes
  const [notes, setNotes] = useState('');

  // Flags from comorbidities
  const nutritionalRiskFlags = useMemo(() => {
    const flags: string[] = [];
    const lower = comorbidities.map(c => c.toLowerCase());
    if (lower.some(c => c.includes('cancer') || c.includes('chemo'))) flags.push('Active malignancy / chemotherapy — increased nutritional requirements');
    if (lower.some(c => c.includes('liver cirrhosis'))) flags.push('Liver cirrhosis — protein-energy malnutrition risk; consider BCAA supplementation');
    if (lower.some(c => c.includes('dialysis'))) flags.push('Renal failure / dialysis — protein requirements elevated; restrict phosphate/potassium');
    if (lower.some(c => c.includes('type 1 diabetes') || c.includes('type 2 diabetes'))) flags.push('Diabetes — carbohydrate consistency important; monitor glycaemia perioperatively');
    if (lower.some(c => c.includes('heart failure'))) flags.push('Heart failure — fluid restriction may limit nutritional supplement volumes');
    if (lower.some(c => c.includes('sleep apnoea') || c.includes('obesity'))) flags.push('Obesity / sleep apnoea — consider pre-operative very low calorie diet if BMI >35 for complex surgery');
    return flags;
  }, [comorbidities]);

  const badgeScore = mustScore !== null ? `MUST ${mustScore}` : undefined;

  return (
    <CollapsibleCard title="Nutritional assessment (MUST / NRS-2002)" badge={badgeScore} defaultOpen={false}>

      {/* Clinical flags from PMH */}
      {nutritionalRiskFlags.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '8px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Nutritional risk flags from PMH
          </div>
          {nutritionalRiskFlags.map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: '#78350f', marginBottom: 2 }}>• {f}</div>
          ))}
        </div>
      )}

      {/* MUST */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 10, padding: '5px 8px', background: '#f1f5f9', borderRadius: 5 }}>
          MUST — Malnutrition Universal Screening Tool
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* BMI step */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Step 1: BMI score
              {bmiResult && <span style={{ marginLeft: 8, color: '#6b7280', fontWeight: 400 }}>Auto-calculated: {bmiResult.bmi} kg/m²</span>}
            </div>
            {!bmiResult && (
              <input
                type="number" placeholder="Enter BMI if weight/height not recorded"
                value={mustManualBmi}
                onChange={e => setMustManualBmi(e.target.value)}
                style={{ fontSize: 12, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 5, width: 180 }}
              />
            )}
            {mustBmiScore !== null && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>
                BMI score: <strong style={{ color: mustBmiScore === 0 ? '#16a34a' : mustBmiScore === 1 ? '#d97706' : '#dc2626' }}>{mustBmiScore}</strong>
                <span style={{ color: '#6b7280', marginLeft: 8 }}>
                  {effectiveBmi > 20 ? '(BMI > 20)' : effectiveBmi >= 18.5 ? '(BMI 18.5–20)' : '(BMI < 18.5)'}
                </span>
              </div>
            )}
          </div>

          {/* Weight loss step */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Step 2: Unintentional weight loss score</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {MUST_WL_OPTIONS.map(o => (
                <label key={o.value} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 12 }}>
                  <input type="radio" name="must_wl" checked={mustWlScore === o.value}
                    onChange={() => setMustWlScore(o.value)} />
                  <span style={{ color: '#374151' }}>{o.label}</span>
                  <span style={{ fontWeight: 600, color: o.value === 0 ? '#16a34a' : o.value === 1 ? '#d97706' : '#dc2626' }}>({o.value})</span>
                </label>
              ))}
            </div>
          </div>

          {/* Acute disease step */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Step 3: Acute disease effect</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {MUST_ACUTE_OPTIONS.map(o => (
                <label key={o.value} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', fontSize: 12 }}>
                  <input type="radio" name="must_acute" checked={mustAcuteScore === o.value}
                    onChange={() => setMustAcuteScore(o.value)} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ color: '#374151' }}>{o.label}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{o.detail}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {mustScore !== null && (() => {
          const r = mustRisk(mustScore);
          return (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 7, background: `${r.color}12`, border: `1px solid ${r.color}44` }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: r.color, marginBottom: 4 }}>
                MUST Score: {mustScore} — {r.level} Risk
              </div>
              <div style={{ fontSize: 12, color: '#374151' }}>{r.action}</div>
            </div>
          );
        })()}
      </div>

      {/* NRS-2002 */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 10, padding: '5px 8px', background: '#f1f5f9', borderRadius: 5 }}>
          NRS-2002 — Nutritional Risk Screening
          {ageOver70 && <span style={{ fontSize: 11, color: '#d97706', marginLeft: 8 }}>Age ≥70: +1 point auto-applied</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Nutritional status impairment</div>
            {NRS_NUTRITIONAL.map(n => (
              <label key={n.value}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 12,
                  padding: '7px 10px', borderRadius: 6, marginBottom: 4,
                  background: nrsNutritional === n.value ? '#eff6ff' : '#f8fafc',
                  border: `1px solid ${nrsNutritional === n.value ? '#3b82f6' : '#e2e8f0'}`,
                }}>
                <input type="radio" name="nrs_nutr" value={n.value} checked={nrsNutritional === n.value}
                  onChange={() => setNrsNutritional(n.value)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>Score {n.value} — {n.label}</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>{n.criteria}</div>
                </div>
              </label>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Disease severity</div>
            {NRS_DISEASE.map(d => (
              <label key={d.value}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 12,
                  padding: '7px 10px', borderRadius: 6, marginBottom: 4,
                  background: nrsDisease === d.value ? '#eff6ff' : '#f8fafc',
                  border: `1px solid ${nrsDisease === d.value ? '#3b82f6' : '#e2e8f0'}`,
                }}>
                <input type="radio" name="nrs_disease" value={d.value} checked={nrsDisease === d.value}
                  onChange={() => setNrsDisease(d.value)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>Score {d.value} — {d.label}</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>{d.criteria}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>e.g. {d.examples}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {nrsResult && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 7,
            background: nrsResult.atRisk ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${nrsResult.atRisk ? '#fca5a5' : '#bbf7d0'}`,
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: nrsResult.atRisk ? '#dc2626' : '#16a34a', marginBottom: 4 }}>
              NRS-2002 Score: {nrsResult.score} — {nrsResult.atRisk ? 'At Nutritional Risk' : 'Not at Risk'}
            </div>
            <div style={{ fontSize: 12, color: '#374151' }}>{nrsResult.recommendation}</div>
          </div>
        )}
      </div>

      {/* Nutritional notes */}
      <div className="fld" style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11 }}>Nutritional notes / plan (dietitian referral, supplements, pre-op optimisation)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Dietitian referral made. Commence high-protein ONS (e.g. Ensure Plus) BD. Pre-operative immunonutrition (Impact) 5 days pre-op. Target protein 1.5g/kg/day."
          style={{ minHeight: 70, fontSize: 12 }}
        />
      </div>
    </CollapsibleCard>
  );
}
