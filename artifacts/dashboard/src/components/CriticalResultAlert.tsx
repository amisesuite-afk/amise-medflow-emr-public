import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';

interface Alert { test: string; value: string; threshold: string; severity: 'critical' | 'urgent'; action: string; }

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

export default function CriticalResultAlert() {
  const { vitals, investigationResults } = useAppContext();

  const alerts = useMemo<Alert[]>(() => {
    const found: Alert[] = [];

    // ── Vitals ────────────────────────────────────────────────────────────────
    const sbp = parseNum(vitals.systolicBp);
    const dbp = parseNum(vitals.diastolicBp);
    const hr  = parseNum(vitals.heartRate);
    const temp = parseNum(vitals.temperatureC);
    const spo2 = parseNum(vitals.spo2);
    const rr   = parseNum(vitals.respiratoryRate);
    const gluc = parseNum(vitals.glucoseMmol);

    if (sbp !== null && sbp < 80)   found.push({ test: 'Systolic BP', value: `${sbp} mmHg`, threshold: '<80', severity: 'critical', action: 'Immediate fluid resuscitation; consider vasopressors; call anaesthetics' });
    if (sbp !== null && sbp > 200)  found.push({ test: 'Systolic BP', value: `${sbp} mmHg`, threshold: '>200', severity: 'urgent',   action: 'Hypertensive emergency — IV labetalol or hydralazine; ECG; renal function' });
    if (dbp !== null && dbp > 120)  found.push({ test: 'Diastolic BP', value: `${dbp} mmHg`, threshold: '>120', severity: 'urgent',  action: 'Hypertensive urgency — initiate antihypertensive therapy' });
    if (hr  !== null && hr  < 40)   found.push({ test: 'Heart rate',   value: `${hr} bpm`,   threshold: '<40',  severity: 'critical', action: 'Bradycardia — ECG; atropine 0.5 mg IV; transcutaneous pacing if haemodynamically unstable' });
    if (hr  !== null && hr  > 150)  found.push({ test: 'Heart rate',   value: `${hr} bpm`,   threshold: '>150', severity: 'critical', action: 'Tachycardia — 12-lead ECG; ABC assessment; consider AF or SVT' });
    if (spo2 !== null && spo2 < 90) found.push({ test: 'SpO₂',        value: `${spo2}%`,    threshold: '<90%', severity: 'critical', action: 'Hypoxia — high-flow O₂; airway assessment; CXR; ABG' });
    if (rr   !== null && rr   > 30) found.push({ test: 'Resp rate',    value: `${rr}/min`,   threshold: '>30',  severity: 'urgent',   action: 'Tachypnoea — ABG; CXR; consider PE, pneumonia, acidosis' });
    if (temp !== null && temp > 39) found.push({ test: 'Temperature',  value: `${temp}°C`,   threshold: '>39°C', severity: 'urgent', action: 'High fever — sepsis screen (FBC, CRP, blood cultures, urine MC&S); IV antibiotics if indicated' });
    if (temp !== null && temp < 35) found.push({ test: 'Temperature',  value: `${temp}°C`,   threshold: '<35°C', severity: 'urgent', action: 'Hypothermia — active warming; ECG (risk of VF); thyroid function' });
    if (gluc !== null && gluc < 3)  found.push({ test: 'Glucose',      value: `${gluc} mmol/L`, threshold: '<3', severity: 'critical', action: 'Hypoglycaemia — 50 mL 50% dextrose IV or glucagon 1 mg IM; recheck in 15 min' });
    if (gluc !== null && gluc > 20) found.push({ test: 'Glucose',      value: `${gluc} mmol/L`, threshold: '>20', severity: 'urgent', action: 'Hyperglycaemia — check ketones; urinalysis; DKA/HHS protocol if positive' });

    // ── Investigation results (free text — keyword scan) ──────────────────────
    const scan = Object.entries(investigationResults).join(' ').toLowerCase();
    if (/\bhaemoglobin\b.*?\b([0-9.]+)\b/.test(scan)) {
      const m = scan.match(/haemoglobin\b[^0-9]*([0-9.]+)/);
      if (m) {
        const hb = parseFloat(m[1]);
        if (hb < 6) found.push({ test: 'Haemoglobin', value: `${hb} g/dL`, threshold: '<6', severity: 'critical', action: 'Critical anaemia — transfusion threshold met; crossmatch; haematology review' });
        else if (hb < 8) found.push({ test: 'Haemoglobin', value: `${hb} g/dL`, threshold: '<8', severity: 'urgent', action: 'Severe anaemia — consider transfusion; check haematinics; iron deficiency?' });
      }
    }
    if (/\bpotassium\b.*?\b([0-9.]+)\b/.test(scan)) {
      const m = scan.match(/potassium\b[^0-9]*([0-9.]+)/);
      if (m) {
        const k = parseFloat(m[1]);
        if (k < 2.5) found.push({ test: 'Potassium', value: `${k} mmol/L`, threshold: '<2.5', severity: 'critical', action: 'Critical hypokalaemia — IV replacement; cardiac monitoring; stop diuretics' });
        if (k > 6.5) found.push({ test: 'Potassium', value: `${k} mmol/L`, threshold: '>6.5', severity: 'critical', action: 'Critical hyperkalaemia — ECG; calcium gluconate; salbutamol nebuliser; dialysis if refractory' });
      }
    }
    if (/\bcreatinine\b.*?\b([0-9.]+)\b/.test(scan)) {
      const m = scan.match(/creatinine\b[^0-9]*([0-9.]+)/);
      if (m) {
        const cr = parseFloat(m[1]);
        if (cr > 350) found.push({ test: 'Creatinine', value: `${cr} µmol/L`, threshold: '>350', severity: 'urgent', action: 'Acute kidney injury — STOP nephrotoxins; fluid challenge; urology/renal review; consider dialysis' });
      }
    }

    return found;
  }, [vitals, investigationResults]);

  if (alerts.length === 0) return null;

  return (
    <div style={{ position: 'sticky', top: 36, zIndex: 45, marginBottom: 8 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 14px',
          background: a.severity === 'critical' ? '#fef2f2' : '#fff7ed',
          borderBottom: `1px solid ${a.severity === 'critical' ? '#fca5a5' : '#fdba74'}`,
          borderLeft: `4px solid ${a.severity === 'critical' ? '#ef4444' : '#f97316'}`,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{a.severity === 'critical' ? '🚨' : '⚠️'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 12, color: a.severity === 'critical' ? '#991b1b' : '#9a3412' }}>
              {a.severity.toUpperCase()} — {a.test}: {a.value}
            </span>
            <span style={{ fontSize: 11, color: a.severity === 'critical' ? '#b91c1c' : '#b45309', marginLeft: 6 }}>
              → {a.action}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
