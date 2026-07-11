/**
 * VitalsStrip — compact inline vitals entry.
 * Numeric-only inputs, laid out in a tight grid.
 * Reads/writes directly to AppContext.
 */
import { useAppContext } from '@/context/AppContext';
import type { VitalsState } from '@/context/AppContext';

type VitalKey = keyof VitalsState;

const FIELDS: { key: VitalKey; label: string; unit: string; width: number }[] = [
  { key: 'systolicBp',     label: 'SBP',    unit: 'mmHg', width: 56 },
  { key: 'diastolicBp',    label: 'DBP',    unit: 'mmHg', width: 56 },
  { key: 'heartRate',      label: 'HR',     unit: 'bpm',  width: 50 },
  { key: 'respiratoryRate',label: 'RR',     unit: '/min', width: 50 },
  { key: 'spo2',           label: 'SpO₂',   unit: '%',    width: 50 },
  { key: 'temperatureC',   label: 'Temp',   unit: '°C',   width: 52 },
  { key: 'glucoseMmol',    label: 'Gluc',   unit: 'mmol', width: 52 },
];

export default function VitalsStrip() {
  const { vitals, updateVital, weightKg, setWeightKg, heightCm, setHeightCm } = useAppContext();

  const field = (key: VitalKey, label: string, unit: string, width: number) => (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <label style={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={vitals[key] ?? ''}
        onChange={e => updateVital(key, e.target.value)}
        style={{
          width,
          textAlign: 'center',
          padding: '5px 4px',
          borderRadius: 6,
          border: vitals[key] ? '1.5px solid #0d9488' : '1.5px solid #e2e8f0',
          fontSize: 14,
          fontWeight: 700,
          color: '#0f172a',
          background: vitals[key] ? '#f0fdfa' : '#f8fafc',
          outline: 'none',
        }}
        placeholder="—"
      />
      <span style={{ fontSize: 9, color: '#94a3b8' }}>{unit}</span>
    </div>
  );

  const extraField = (
    label: string,
    unit: string,
    value: string,
    onChange: (v: string) => void,
    width: number,
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <label style={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width,
          textAlign: 'center',
          padding: '5px 4px',
          borderRadius: 6,
          border: value ? '1.5px solid #0d9488' : '1.5px solid #e2e8f0',
          fontSize: 14,
          fontWeight: 700,
          color: '#0f172a',
          background: value ? '#f0fdfa' : '#f8fafc',
          outline: 'none',
        }}
        placeholder="—"
      />
      <span style={{ fontSize: 9, color: '#94a3b8' }}>{unit}</span>
    </div>
  );

  // BMI
  const bmi = (() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm) / 100;
    if (!w || !h) return null;
    const v = w / (h * h);
    const cat = v < 18.5 ? 'Underweight' : v < 25 ? 'Normal' : v < 30 ? 'Overweight' : 'Obese';
    return { value: v.toFixed(1), cat };
  })();

  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        Vital Signs
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {FIELDS.map(f => field(f.key, f.label, f.unit, f.width))}
        {extraField('Wt', 'kg', weightKg, setWeightKg, 52)}
        {extraField('Ht', 'cm', heightCm, setHeightCm, 52)}
        {bmi && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, justifyContent: 'flex-end', paddingBottom: 16 }}>
            <span style={{
              fontSize: 13, fontWeight: 800, padding: '4px 8px', borderRadius: 6,
              background: bmi.cat === 'Normal' ? '#dcfce7' : bmi.cat === 'Obese' ? '#fee2e2' : '#fef9c3',
              color: bmi.cat === 'Normal' ? '#16a34a' : bmi.cat === 'Obese' ? '#dc2626' : '#92400e',
            }}>
              BMI {bmi.value}
            </span>
            <span style={{ fontSize: 9, color: '#94a3b8' }}>{bmi.cat}</span>
          </div>
        )}
      </div>
    </div>
  );
}
