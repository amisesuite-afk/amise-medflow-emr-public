import { ChangeEvent, useMemo, useState } from 'react';
import { adaptiveTriage, AdaptiveTriageInput, AdaptiveTriageResult, Sex, VitalSigns } from '@/lib/adaptive-triage';

type Tab = 'intake' | 'triage' | 'script' | 'ops';
type ChipGroupProps = { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void; };

const symptomOptions = [
  'abdominal pain', 'jaundice', 'dark urine', 'pale stool', 'vomiting', 'rectal bleeding', 'black stool',
  'dysphagia', 'weight loss', 'breast lump', 'breast pain', 'nipple discharge', 'hernia', 'wound discharge',
  'fever after surgery', 'shortness of breath', 'chest pain', 'admin enquiry',
];
const comorbidityOptions = ['diabetes', 'hypertension', 'kidney disease', 'atrial fibrillation', 'heart failure', 'stroke', 'cancer', 'chemotherapy', 'steroid use', 'liver disease'];
const medicationOptions = ['aspirin', 'clopidogrel', 'warfarin', 'Xarelto/rivaroxaban', 'Eliquis/apixaban', 'heparin/enoxaparin', 'insulin', 'gliclazide/Diamicron', 'metformin'];
const surgicalHistoryOptions = ['lap chole', 'ERCP', 'appendicectomy', 'hernia repair', 'C-section', 'breast biopsy', 'bowel surgery'];
const toxicHabitOptions = ['smoker', 'alcohol use', 'vaping', 'recreational drugs'];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitCsv(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function ChipGroup({ title, options, selected, onToggle }: ChipGroupProps) {
  return (
    <section className="card compact">
      <div className="sectionTitle"><h2>{title}</h2><span>{selected.length} selected</span></div>
      <div className="chips">
        {options.map(option => (
          <button key={option} type="button" className={selected.includes(option) ? 'chip selected' : 'chip'} onClick={() => onToggle(option)}>
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}

function actionLabel(action: AdaptiveTriageResult['recommendedAction']): string {
  switch (action) {
    case 'emergency_now': return 'Escalate now / emergency pathway';
    case 'same_day_call': return 'Same-day clinical call';
    case 'priority_24_48h': return 'Priority clinical review in 24–48h';
    case 'routine_booking': return 'Routine booking pathway';
    case 'admin_review': return 'Administrative review';
  }
}

function formatAppointmentType(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('intake');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('unknown');
  const [durationDays, setDurationDays] = useState('');
  const [painScore, setPainScore] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [surgicalHistory, setSurgicalHistory] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [toxicHabits, setToxicHabits] = useState<string[]>([]);
  const [allergies, setAllergies] = useState('');
  const [freeText, setFreeText] = useState('');
  const [isPostOp, setIsPostOp] = useState(false);
  const [postOpDays, setPostOpDays] = useState('');
  const [pregnancyPossible, setPregnancyPossible] = useState(false);
  const [vitals, setVitals] = useState<Record<keyof VitalSigns, string>>({
    systolicBp: '', diastolicBp: '', heartRate: '', temperatureC: '', respiratoryRate: '', spo2: '', glucoseMmol: '',
  });

  const updateVital = (key: keyof VitalSigns) => (event: ChangeEvent<HTMLInputElement>) =>
    setVitals(current => ({ ...current, [key]: event.target.value }));

  const triageInput: AdaptiveTriageInput = useMemo(() => ({
    age: toNumber(age),
    sex,
    symptoms,
    freeText,
    comorbidities,
    surgicalHistory,
    medications,
    toxicHabits,
    allergies: splitCsv(allergies),
    vitalSigns: {
      systolicBp: toNumber(vitals.systolicBp),
      diastolicBp: toNumber(vitals.diastolicBp),
      heartRate: toNumber(vitals.heartRate),
      temperatureC: toNumber(vitals.temperatureC),
      respiratoryRate: toNumber(vitals.respiratoryRate),
      spo2: toNumber(vitals.spo2),
      glucoseMmol: toNumber(vitals.glucoseMmol),
    },
    durationDays: toNumber(durationDays),
    painScore: toNumber(painScore),
    isPostOp,
    postOpDays: toNumber(postOpDays),
    pregnancyPossible,
  }), [age, sex, symptoms, freeText, comorbidities, surgicalHistory, medications, toxicHabits, allergies, vitals, durationDays, painScore, isPostOp, postOpDays, pregnancyPossible]);

  const result = useMemo(() => adaptiveTriage(triageInput), [triageInput]);
  const allReasons = result.reasons.length ? result.reasons : ['No red flags detected yet.'];

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Amise Medical Services • Verdance Software Division</p>
          <h1>Adaptive Front Desk Triage</h1>
          <p className="subtle">Compact intake, risk scoring, suggested adaptive sections, and safe front-desk scripting for supervised clinical workflows.</p>
        </div>
        <div className={`score ${result.acuity}`}>
          <span>Acuity</span>
          <strong>{result.acuity.toUpperCase()}</strong>
          <small>Score {result.score}</small>
        </div>
      </header>

      <nav className="tabs" aria-label="Workflow tabs">
        {(['intake', 'triage', 'script', 'ops'] as Tab[]).map(tab => (
          <button key={tab} type="button" className={activeTab === tab ? 'tab active' : 'tab'} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </nav>

      {activeTab === 'intake' && (
        <>
          <div className="grid">
            <section className="card">
              <div className="sectionTitle"><h2>Patient basics</h2><span>{result.missingCriticalFields.length} missing</span></div>
              <div className="formGrid">
                <label>Age<input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 57" /></label>
                <label>Sex
                  <select value={sex} onChange={e => setSex(e.target.value as Sex)}>
                    <option value="unknown">Unknown</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>Duration days<input inputMode="numeric" value={durationDays} onChange={e => setDurationDays(e.target.value)} placeholder="e.g. 3" /></label>
                <label>Pain score<input inputMode="numeric" min="0" max="10" value={painScore} onChange={e => setPainScore(e.target.value)} placeholder="0–10" /></label>
              </div>
              <div className="checks">
                <label><input type="checkbox" checked={isPostOp} onChange={e => setIsPostOp(e.target.checked)} /> Post-op / recent procedure</label>
                <label><input type="checkbox" checked={pregnancyPossible} onChange={e => setPregnancyPossible(e.target.checked)} /> Pregnancy possible</label>
                {isPostOp && <label className="inlineInput">Post-op days<input inputMode="numeric" value={postOpDays} onChange={e => setPostOpDays(e.target.value)} placeholder="days" /></label>}
              </div>
            </section>

            <section className="card result">
              <h2>Recommended action</h2>
              <p className="action">{actionLabel(result.recommendedAction)}</p>
              <p><b>Appointment type:</b> {formatAppointmentType(result.appointmentType)}</p>
              <p className="warning">{result.safetyMessage}</p>
            </section>
          </div>

          <section className="card">
            <div className="sectionTitle"><h2>Vital signs / quick measurements</h2><span>optional but high value</span></div>
            <div className="formGrid vitals">
              <label>SBP<input inputMode="numeric" value={vitals.systolicBp} onChange={updateVital('systolicBp')} placeholder="120" /></label>
              <label>DBP<input inputMode="numeric" value={vitals.diastolicBp} onChange={updateVital('diastolicBp')} placeholder="80" /></label>
              <label>HR<input inputMode="numeric" value={vitals.heartRate} onChange={updateVital('heartRate')} placeholder="88" /></label>
              <label>Temp °C<input inputMode="decimal" value={vitals.temperatureC} onChange={updateVital('temperatureC')} placeholder="37.0" /></label>
              <label>RR<input inputMode="numeric" value={vitals.respiratoryRate} onChange={updateVital('respiratoryRate')} placeholder="16" /></label>
              <label>SpO₂ %<input inputMode="numeric" value={vitals.spo2} onChange={updateVital('spo2')} placeholder="98" /></label>
              <label>RBS mmol/L<input inputMode="decimal" value={vitals.glucoseMmol} onChange={updateVital('glucoseMmol')} placeholder="6.4" /></label>
            </div>
          </section>

          <ChipGroup title="Symptoms / reason" options={symptomOptions} selected={symptoms} onToggle={v => setSymptoms(cur => toggle(cur, v))} />
          <ChipGroup title="Comorbidities" options={comorbidityOptions} selected={comorbidities} onToggle={v => setComorbidities(cur => toggle(cur, v))} />
          <ChipGroup title="Surgical history" options={surgicalHistoryOptions} selected={surgicalHistory} onToggle={v => setSurgicalHistory(cur => toggle(cur, v))} />
          <ChipGroup title="Medications" options={medicationOptions} selected={medications} onToggle={v => setMedications(cur => toggle(cur, v))} />
          <ChipGroup title="Toxic habits" options={toxicHabitOptions} selected={toxicHabits} onToggle={v => setToxicHabits(cur => toggle(cur, v))} />

          <section className="card">
            <h2>Free text and allergies</h2>
            <label>Patient message<textarea value={freeText} onChange={e => setFreeText(e.target.value)} placeholder="Paste patient message here..." /></label>
            <label>Allergies<input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="comma separated, e.g. penicillin, latex" /></label>
          </section>
        </>
      )}

      {activeTab === 'triage' && (
        <section className="card twoCol">
          <div>
            <h2>Reasons detected</h2>
            <ul>{allReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
            <h2>Missing critical fields</h2>
            {result.missingCriticalFields.length
              ? <ul>{result.missingCriticalFields.map(field => <li key={field}>{field}</li>)}</ul>
              : <p className="subtle">Minimum administrative intake complete.</p>}
          </div>
          <div>
            <h2>Questions to ask next</h2>
            <ul>{result.questionsToAsk.map(question => <li key={question}>{question}</li>)}</ul>
            <h2>Adaptive EMR blocks</h2>
            <div className="chips static">{result.suggestedBlocks.map(block => <span className="chip selected" key={block}>{block}</span>)}</div>
          </div>
        </section>
      )}

      {activeTab === 'script' && (
        <section className="card">
          <h2>Safe front-desk script</h2>
          <div className="scriptBox">{result.frontDeskScript}</div>
          <p className="warning">Do not add clinical advice, diagnoses, medication instructions, fees, or results interpretation to this script.</p>
        </section>
      )}

      {activeTab === 'ops' && (
        <section className="card twoCol">
          <div>
            <h2>Operational checklist</h2>
            <ul>
              <li>Use <b>dry_run</b> first, then <b>supervised</b>, then <b>auto</b> only after staff sign-off.</li>
              <li>Keep urgent, priority, and review cases out of automatic booking.</li>
              <li>Confirm demographics, medications, allergies, and anticoagulants before procedural scheduling.</li>
              <li>Document every escalation in Supabase and calendar notes.</li>
            </ul>
          </div>
          <div>
            <h2>Current routing</h2>
            <ul>
              <li>New consult: Rodney Bay</li>
              <li>Follow-up/post-op: Castries</li>
              <li>ERCP work-up: Rodney Bay</li>
              <li>Procedure/emergency: Tapion pathway</li>
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
