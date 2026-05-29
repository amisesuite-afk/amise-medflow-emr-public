import { useMemo } from 'react';
import { useAppContext, EMPTY_TRAUMA_DATA } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { ManagementPanel } from '@/components/ManagementPanel';
import {
  ISS_REGIONS, AIS_LABELS,
  issScore, nissScore, interpretIss,
  BURN_REGIONS, BURN_DEGREE_LABELS,
  calcTbsa, parklandFormula, bauxScore, interpretBaux,
  type BurnDegree,
} from '@/lib/clinical-scales';

const MECHANISMS = ['Blunt', 'Penetrating', 'Burns', 'Blast', 'Fall', 'RTA'];
const PRE_HOSPITAL_OPTIONS = ['IV access', 'Fluid given', 'Splint/immobilisation', 'Tourniquet', 'Intubation', 'CPR', 'Haemostasis'];

const ABCDE: { key: string; letter: string; title: string; hint: string }[] = [
  { key: 'A', letter: 'A', title: 'Airway + C-spine', hint: 'Patency, obstruction, intubation required? C-collar applied?' },
  { key: 'B', letter: 'B', title: 'Breathing', hint: 'Rate, SpO2, breath sounds, chest wall movement, pneumothorax?' },
  { key: 'C', letter: 'C', title: 'Circulation', hint: 'HR, SBP, cap refill, haemorrhage, IV access, fluids.' },
  { key: 'D', letter: 'D', title: 'Disability', hint: 'GCS total + E/V/M, pupils (size, equality, reaction), BM.' },
  { key: 'E', letter: 'E', title: 'Exposure / Environment', hint: 'Full exposure, temperature, log roll, obvious injuries.' },
];

const SECONDARY_REGIONS = [
  'Head / Scalp', 'Face', 'Eyes', 'ENT', 'Neck', 'Chest',
  'Abdomen', 'Pelvis', 'Genitourinary', 'Spine', 'Left Upper Limb',
  'Right Upper Limb', 'Left Lower Limb', 'Right Lower Limb', 'Neurovascular Status',
];

function row(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #1f2937' }}>
      <span style={{ minWidth: 120, fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ flex: 1 }}>{value}</span>
    </div>
  );
}

export default function TraumaTab() {
  const { traumaData, setTraumaData, weightKg, age } = useAppContext();

  const td = traumaData;
  function update(partial: Partial<typeof traumaData>) { setTraumaData(prev => ({ ...prev, ...partial })); }

  function toggleList(list: string[], val: string): string[] {
    return list.includes(val) ? list.filter(v => v !== val) : [...list, val];
  }

  // Derived ISS / NISS
  const iss  = useMemo(() => issScore(td.ais),  [td.ais]);
  const niss = useMemo(() => nissScore(td.ais), [td.ais]);
  const issInterp  = interpretIss(iss);
  const nissInterp = interpretIss(niss);

  // Burns
  const tbsa = useMemo(() => calcTbsa(td.burnRegions), [td.burnRegions]);
  const wt   = parseFloat(weightKg) || 70;
  const ageN = parseInt(age, 10) || 35;
  const parkland = useMemo(
    () => parklandFormula(wt, tbsa, td.burnTimeOfInjury),
    [wt, tbsa, td.burnTimeOfInjury],
  );
  const baux = useMemo(() => bauxScore(ageN, tbsa, td.burnInhalation), [ageN, tbsa, td.burnInhalation]);
  const bauxInterp = interpretBaux(baux);

  const hasBurns = td.mechanism.includes('Burns');

  // Trauma management protocol chips based on mechanism
  const traumaDiseaseMap: Record<string, string> = {
    Blunt:         'blunt_abdominal_trauma',
    Penetrating:   'penetrating_abdominal_trauma',
    Burns:         tbsa >= 20 ? 'thermal_burn_major' : 'thermal_burn_minor',
    Blast:         'blunt_abdominal_trauma',
    Fall:          'traumatic_brain_injury',
    RTA:           'blunt_abdominal_trauma',
  };
  const primaryDiseaseId = td.mechanism.length > 0 ? (traumaDiseaseMap[td.mechanism[0]] ?? null) : null;

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1000, margin: '0 auto' }} className="gap-y">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>
          ⚡ Trauma Assessment — ATLS 11th Edition
        </div>
        <button
          className="chip"
          style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={() => setTraumaData(EMPTY_TRAUMA_DATA)}
        >
          Reset
        </button>
      </div>

      {/* ── Mechanism of Injury ────────────────────────────────────────── */}
      <CollapsibleCard title="Mechanism of Injury">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {MECHANISMS.map(m => (
            <button
              key={m}
              className={`chip${td.mechanism.includes(m) ? ' chip--active' : ''}`}
              onClick={() => update({ mechanism: toggleList(td.mechanism, m) })}
              style={td.mechanism.includes(m) ? { background: '#dc2626', borderColor: '#dc2626', color: '#fff' } : {}}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="fld">
            <label>Time of Injury</label>
            <input
              type="datetime-local"
              value={td.timeOfInjury}
              onChange={e => update({ timeOfInjury: e.target.value })}
            />
          </div>
          <div className="fld">
            <label>GCS on Scene</label>
            <input
              type="number" min={3} max={15} value={td.gcScene}
              onChange={e => update({ gcScene: e.target.value })}
              placeholder="3–15"
            />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>
            Pre-hospital interventions
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRE_HOSPITAL_OPTIONS.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={td.preHospital.includes(opt)}
                  onChange={() => update({ preHospital: toggleList(td.preHospital, opt) })}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      {/* ── Primary Survey ABCDE ───────────────────────────────────────── */}
      <CollapsibleCard title="Primary Survey — ABCDE">
        <div style={{ display: 'grid', gap: 10 }}>
          {ABCDE.map(({ key, letter, title, hint }) => {
            const ps = td.primarySurvey[key] ?? { finding: '', action: '', response: '' };
            return (
              <div key={key} style={{ border: '1px solid #374151', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'baseline' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#dc2626', color: '#fff', fontWeight: 900, fontSize: 14,
                    flexShrink: 0,
                  }}>{letter}</span>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{hint}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {(['finding', 'action', 'response'] as const).map(field => (
                    <div key={field} className="fld" style={{ marginBottom: 0 }}>
                      <label style={{ textTransform: 'capitalize' }}>{field}</label>
                      <input
                        type="text"
                        value={ps[field]}
                        onChange={e => {
                          const updated = { ...td.primarySurvey, [key]: { ...ps, [field]: e.target.value } };
                          update({ primarySurvey: updated });
                        }}
                        placeholder={field === 'finding' ? 'Assessment finding' : field === 'action' ? 'Intervention taken' : 'Patient response'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      {/* ── ISS Calculator ────────────────────────────────────────────── */}
      <CollapsibleCard title={`ISS Calculator — Score: ${iss} (${issInterp.label})`}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12, lineHeight: 1.5 }}>
          Select AIS (Abbreviated Injury Scale) score for each body region. ISS = sum of squares of top-3
          DIFFERENT regions. Any AIS 6 → ISS 75 (unsurvivable).
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {ISS_REGIONS.map(({ key, label }) => {
            const val = td.ais[key] ?? 0;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ minWidth: 200, fontSize: 12, color: '#e2e8f0' }}>{label}</span>
                <select
                  value={val}
                  onChange={e => update({ ais: { ...td.ais, [key]: parseInt(e.target.value) } })}
                  style={{
                    flex: 1, padding: '5px 8px', borderRadius: 5,
                    background: val >= 5 ? '#7f1d1d' : val >= 3 ? '#431407' : '#1e293b',
                    border: `1px solid ${val >= 5 ? '#dc2626' : val >= 3 ? '#ea580c' : '#374151'}`,
                    color: '#e2e8f0', fontSize: 12,
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{AIS_LABELS[n]}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16, padding: '12px 16px', background: '#0f172a', borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>ISS</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: issInterp.color }}>{iss}</div>
            <div style={{ fontSize: 12, color: issInterp.color }}>{issInterp.label}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>NISS</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: nissInterp.color }}>{niss}</div>
            <div style={{ fontSize: 12, color: nissInterp.color }}>{nissInterp.label}</div>
          </div>
          <div style={{ alignSelf: 'flex-end', fontSize: 11, color: '#6b7280', flex: 1 }}>
            ISS ≥16 = major trauma. ISS ≥25 = severe. NISS may better reflect polytrauma in same body region.
          </div>
        </div>

        {/* Resuscitation targets */}
        {iss > 0 && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#1e293b', borderRadius: 6, fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#fbbf24' }}>⚡ Resuscitation Targets</div>
            {td.mechanism.includes('Penetrating') && !td.mechanism.includes('Blunt')
              ? <div>Permissive hypotension (penetrating): target SBP <b>80–90 mmHg</b> until surgical haemostasis.</div>
              : <div>Normotensive resuscitation (blunt/TBI): target SBP <b>≥90 mmHg</b>.</div>
            }
            {(() => {
              const hr  = parseFloat(td.primarySurvey['C']?.finding ?? '');
              const sbp = parseFloat(td.primarySurvey['C']?.action ?? '');
              if (hr > 120 && sbp < 90) {
                return <div style={{ color: '#f87171', fontWeight: 700, marginTop: 4 }}>
                  ⚠ MTP Trigger: HR &gt;120 + SBP &lt;90 — activate Massive Transfusion Protocol (PRBC:FFP:Platelets = 1:1:1).
                </div>;
              }
              return null;
            })()}
          </div>
        )}
      </CollapsibleCard>

      {/* ── Secondary Survey ──────────────────────────────────────────── */}
      <CollapsibleCard title="Secondary Survey (Head to Toe)" defaultOpen={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SECONDARY_REGIONS.map(region => (
            <div key={region} className="fld" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>{region}</label>
              <input
                type="text"
                value={td.secondary[region] ?? ''}
                onChange={e => update({ secondary: { ...td.secondary, [region]: e.target.value } })}
                placeholder="Findings / Normal"
              />
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* ── Burns Assessment (shown only when Burns is selected) ───────── */}
      {hasBurns && (
        <CollapsibleCard title={`Burns Assessment — TBSA: ${tbsa.toFixed(1)}%`}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
            Rule of Nines (adult). Tick affected areas and select burn depth.
            <b style={{ color: '#fbbf24' }}> 1st-degree erythema is NOT counted in TBSA.</b>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="fld" style={{ maxWidth: 260 }}>
              <label>Time of Burn Injury</label>
              <input
                type="datetime-local"
                value={td.burnTimeOfInjury}
                onChange={e => update({ burnTimeOfInjury: e.target.value })}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={td.burnInhalation}
              onChange={e => update({ burnInhalation: e.target.checked })}
            />
            <b style={{ color: '#f87171' }}>Inhalation injury suspected</b>
            <span style={{ color: '#6b7280' }}>(singed nasal hair, hoarse voice, sooty sputum, stridor → intubate early)</span>
          </label>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#111827', color: '#9ca3af', textTransform: 'uppercase', fontSize: 10 }}>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Region</th>
                <th style={{ padding: '6px 10px', textAlign: 'center' }}>%</th>
                <th style={{ padding: '6px 10px', textAlign: 'center' }}>Affected</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Degree</th>
              </tr>
            </thead>
            <tbody>
              {BURN_REGIONS.map((r, i) => {
                const entry = td.burnRegions[r.key] ?? { affected: false, degree: 'SPT' };
                return (
                  <tr key={r.key} style={{ background: i % 2 === 0 ? '#0f172a' : '#1e293b', borderBottom: '1px solid #1f2937' }}>
                    <td style={{ padding: '5px 10px', color: entry.affected ? '#e2e8f0' : '#6b7280' }}>{r.label}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center', color: '#94a3b8' }}>{r.percent}%</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={entry.affected}
                        onChange={e => update({
                          burnRegions: { ...td.burnRegions, [r.key]: { ...entry, affected: e.target.checked } },
                        })}
                      />
                    </td>
                    <td style={{ padding: '5px 10px' }}>
                      {entry.affected && (
                        <select
                          value={entry.degree}
                          onChange={e => update({
                            burnRegions: { ...td.burnRegions, [r.key]: { ...entry, degree: e.target.value } },
                          })}
                          style={{
                            fontSize: 11, padding: '3px 6px', borderRadius: 4,
                            background: '#0f172a', border: '1px solid #374151', color: '#e2e8f0',
                          }}
                        >
                          {(Object.keys(BURN_DEGREE_LABELS) as BurnDegree[]).map(k => (
                            <option key={k} value={k}>{BURN_DEGREE_LABELS[k]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Parkland + Baux */}
          {tbsa > 0 && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#7dd3fc', marginBottom: 8 }}>
                  💧 Parkland Formula (Lactated Ringer's)
                </div>
                {row('TBSA', `${tbsa.toFixed(1)}%`)}
                {row('Weight', `${wt} kg`)}
                {row('Total (24 h)', <b style={{ color: '#7dd3fc', fontSize: 14 }}>{parkland.total.toFixed(0)} mL</b>)}
                {row('First 8 h', `${parkland.first8h.toFixed(0)} mL (${parkland.rateNow.toFixed(0)} mL/hr)`)}
                {row('Next 16 h', `${parkland.next16h.toFixed(0)} mL (${parkland.rateNext16h.toFixed(0)} mL/hr)`)}
                {parkland.warning && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24', background: '#431407', borderRadius: 4, padding: '6px 8px' }}>
                    {parkland.warning}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                  Target UO: 0.5–1 mL/kg/hr adults ({(wt * 0.5).toFixed(0)}–{wt} mL/hr)
                </div>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #374151', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#fca5a5', marginBottom: 8 }}>
                  🔥 Revised Baux Score
                </div>
                {row('Age', ageN.toString())}
                {row('TBSA', `${tbsa.toFixed(1)}%`)}
                {row('Inhalation +17', td.burnInhalation ? '+17' : '0')}
                {row('Baux Score', <b style={{ color: bauxInterp.color, fontSize: 18 }}>{baux}</b>)}
                {row('Prognosis', <b style={{ color: bauxInterp.color }}>{bauxInterp.label}</b>)}
                <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                  Revised Baux &gt;140 ≈ &gt;90% mortality. Consider palliative care discussion.
                </div>
              </div>
            </div>
          )}

          {/* Burns nursing orders */}
          {tbsa > 0 && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#1e293b', borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>Burn Nursing Orders</div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8, color: '#d1d5db' }}>
                <li>IV access × 2 large-bore; avoid burn sites</li>
                {tbsa >= 20 && <li><b>Urinary catheter — strict I&O every hour</b></li>}
                <li>Target UO: 0.5–1 mL/kg/hr adults; 1 mL/kg/hr children</li>
                <li>Analgesia: IV morphine titrated to pain score; paracetamol ATC</li>
                <li>Non-adherent dressings; change as per burns protocol</li>
                <li>Tetanus prophylaxis; check immunisation status</li>
                {tbsa >= 20 && <li>NGT for enteral feeding within 6–8 h; dietitian review</li>}
                {td.burnInhalation && <li><b style={{ color: '#f87171' }}>Inhalation injury — ensure airway secured before oedema develops</b></li>}
                {(tbsa >= 20 || (Object.values(td.burnRegions).some(r => r.affected && ['FT', '4th'].includes(r.degree)))) &&
                  <li><b style={{ color: '#f87171' }}>Transfer criteria met — arrange burns unit transfer</b></li>
                }
              </ul>
            </div>
          )}
        </CollapsibleCard>
      )}

      {/* ── Management Protocol ───────────────────────────────────────── */}
      {primaryDiseaseId && (
        <CollapsibleCard title="Trauma Management Protocol">
          <ManagementPanel diseaseId={primaryDiseaseId} icdCode={null} />
          {td.mechanism.includes('Blunt') && td.mechanism.length > 1 && (
            <ManagementPanel diseaseId="traumatic_brain_injury" icdCode={null} />
          )}
        </CollapsibleCard>
      )}
    </div>
  );
}
