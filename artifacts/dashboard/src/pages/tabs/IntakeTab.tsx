import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import PathwaySuggestions from '@/components/PathwaySuggestions';
import SmartSymptomPicker from '@/components/SmartSymptomPicker';
import { VitalSigns } from '@/lib/adaptive-triage';

const VITAL_KEYS: { key: keyof VitalSigns; label: string; placeholder: string }[] = [
  { key: 'systolicBp',     label: 'SBP',      placeholder: '120' },
  { key: 'diastolicBp',    label: 'DBP',      placeholder: '80'  },
  { key: 'heartRate',      label: 'HR',       placeholder: '88'  },
  { key: 'temperatureC',   label: 'Temp °C',  placeholder: '37.0'},
  { key: 'respiratoryRate',label: 'RR',       placeholder: '16'  },
  { key: 'spo2',           label: 'SpO₂ %',  placeholder: '98'  },
  { key: 'glucoseMmol',    label: 'RBS',      placeholder: '6.4' },
];

function vitalClass(key: keyof VitalSigns, raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return '';
  if (key === 'systolicBp' && n < 90) return 'danger';
  if (key === 'heartRate' && n > 120) return 'danger';
  if (key === 'respiratoryRate' && n > 24) return 'danger';
  if (key === 'temperatureC' && n >= 38) return 'warn';
  if (key === 'spo2' && n < 94) return 'danger';
  if (key === 'glucoseMmol' && (n < 3.5 || n > 20)) return 'danger';
  return '';
}

export default function IntakeTab() {
  const {
    patientName, setPatientName,
    age, setAge, sex, setSex, dob, setDob, phone, setPhone,
    durationDays, setDurationDays, painScore, setPainScore,
    isPostOp, setIsPostOp, postOpDays, setPostOpDays,
    pregnancyPossible, setPregnancyPossible,
    vitals, updateVital,
    symptoms,
    freeText, setFreeText,
    triageResult,
  } = useAppContext();

  return (
    <div className="gap-y">
      {/* Patient demographics */}
      <CollapsibleCard title="Patient" badge={triageResult.missingCriticalFields.length > 0 ? `${triageResult.missingCriticalFields.length} missing` : undefined} badgeVariant={triageResult.missingCriticalFields.length > 0 ? 'warn' : 'default'}>
        <div className="form-grid">
          <div className="fld">
            <label>Full name</label>
            <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Marie Joseph" />
          </div>
          <div className="fld">
            <label>Age</label>
            <input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 57" />
          </div>
          <div className="fld">
            <label>Sex</label>
            <select value={sex} onChange={e => setSex(e.target.value as any)}>
              <option value="unknown">—</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="fld">
            <label>Date of birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} />
          </div>
          <div className="fld">
            <label>Phone</label>
            <input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 758 …" />
          </div>
          <div className="fld">
            <label>Duration (days)</label>
            <input inputMode="numeric" value={durationDays} onChange={e => setDurationDays(e.target.value)} placeholder="e.g. 3" />
          </div>
          <div className="fld">
            <label>Pain score (0–10)</label>
            <input inputMode="numeric" value={painScore} onChange={e => setPainScore(e.target.value)} placeholder="0–10"
              className={painScore && Number(painScore) >= 8 ? 'danger' : painScore && Number(painScore) >= 5 ? 'warn' : ''} />
          </div>
        </div>
        <div className="check-row" style={{ marginTop: 10 }}>
          <label>
            <input type="checkbox" checked={isPostOp} onChange={e => setIsPostOp(e.target.checked)} />
            Post-op / recent procedure
          </label>
          <label>
            <input type="checkbox" checked={pregnancyPossible} onChange={e => setPregnancyPossible(e.target.checked)} />
            Pregnancy possible
          </label>
          {isPostOp && (
            <div className="inline-field">
              <span>Days since op:</span>
              <input inputMode="numeric" value={postOpDays} onChange={e => setPostOpDays(e.target.value)} placeholder="days" />
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* Vital signs */}
      <CollapsibleCard title="Vital signs" badge={triageResult.vitalRedFlags.length > 0 ? `${triageResult.vitalRedFlags.length} alert` : 'optional'} badgeVariant={triageResult.vitalRedFlags.length > 0 ? 'danger' : 'default'}>
        <div className="form-grid cols-7">
          {VITAL_KEYS.map(({ key, label, placeholder }) => (
            <div className="fld" key={key}>
              <label>{label}</label>
              <input
                inputMode="decimal"
                value={vitals[key]}
                onChange={e => updateVital(key, e.target.value)}
                placeholder={placeholder}
                className={vitalClass(key, vitals[key])}
              />
            </div>
          ))}
        </div>
        {triageResult.vitalRedFlags.length > 0 && (
          <div className="vital-flags" style={{ marginTop: 8 }}>
            {triageResult.vitalRedFlags.map(f => (
              <span key={f.label} className={`vflag ${f.severity}`}>{f.label}: {f.value}</span>
            ))}
          </div>
        )}
      </CollapsibleCard>

      {/* Smart adaptive symptom picker + differential inference */}
      <CollapsibleCard
        title="Symptoms / reason for visit"
        badge={symptoms.length || undefined}
      >
        <SmartSymptomPicker />
      </CollapsibleCard>

      {/* Clinical pathway suggestions — shown when specific combos detected */}
      <PathwaySuggestions />

      {/* Free text */}
      <CollapsibleCard title="Patient message / notes" defaultOpen={false}>
        <div className="fld">
          <label>Patient message (paste or type)</label>
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Paste patient email or WhatsApp message here…"
            style={{ minHeight: 100 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
