/**
 * LiveConsultNote — reads AppContext and renders a live clinical document.
 * Updates in real time as voice, vitals, and exam data are entered.
 * Compact copy button exports the full plain-text note to clipboard.
 */
import { useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';

const DOCTOR = 'Dr Dawit Daniel Kabiye';
const SPECIALTY = 'Specialist General & Endoscopic Surgery';

function fmtDate() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function calcBmi(wt: string, ht: string): string | null {
  const w = parseFloat(wt);
  const h = parseFloat(ht) / 100;
  if (!w || !h) return null;
  return (w / (h * h)).toFixed(1);
}

function vitalsLine(vitals: Record<string, string>, wt: string, ht: string): string {
  const parts: string[] = [];
  const sbp = vitals.systolicBp, dbp = vitals.diastolicBp;
  if (sbp || dbp) parts.push(`BP ${sbp || '—'}/${dbp || '—'} mmHg`);
  if (vitals.heartRate) parts.push(`HR ${vitals.heartRate} bpm`);
  if (vitals.respiratoryRate) parts.push(`RR ${vitals.respiratoryRate}/min`);
  if (vitals.spo2) parts.push(`SpO₂ ${vitals.spo2}%`);
  if (vitals.temperatureC) parts.push(`Temp ${vitals.temperatureC}°C`);
  if (vitals.glucoseMmol) parts.push(`Glucose ${vitals.glucoseMmol} mmol/L`);
  if (wt) parts.push(`Wt ${wt} kg`);
  if (ht) parts.push(`Ht ${ht} cm`);
  const bmi = calcBmi(wt, ht);
  if (bmi) parts.push(`BMI ${bmi}`);
  return parts.join('  ·  ');
}

function hasVitals(vitals: Record<string, string>, wt: string, ht: string) {
  return Object.values(vitals).some(v => v.trim()) || wt.trim() || ht.trim();
}

interface SectionProps { label: string; text?: string; list?: string[]; color?: string }

function NoteSection({ label, text, list, color = '#0d9488' }: SectionProps) {
  const lines = list && list.length > 0 ? list : [];
  const body = text?.trim() || lines.map(l => `• ${l}`).join('\n');
  if (!body) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1e293b', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {body}
      </div>
    </div>
  );
}

interface ExamSectionProps { notes: Record<string, string>; general?: string; cardio?: string; resp?: string; abdomen?: string }

function ExamSection({ notes, general, cardio, resp, abdomen }: ExamSectionProps) {
  const systems: [string, string][] = [
    ['General', general || notes.general || ''],
    ['Cardiovascular', cardio || notes.cardiovascular || ''],
    ['Respiratory', resp || notes.respiratory || ''],
    ['Abdomen', abdomen || notes.abdomen || ''],
    ['Wound', notes.wound || ''],
    ['Breast', notes.breast || ''],
    ['Neurological', notes.neurological || ''],
    ['Extremities', notes.extremities || ''],
  ].filter(([, v]) => v.trim()) as [string, string][];

  if (systems.length === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0d9488', marginBottom: 3 }}>
        Examination
      </div>
      {systems.map(([sys, text]) => (
        <div key={sys} style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{sys}:&nbsp;</span>
          <span style={{ fontSize: 13, lineHeight: 1.7, color: '#1e293b', fontFamily: 'Georgia, "Times New Roman", serif' }}>{text}</span>
        </div>
      ))}
    </div>
  );
}

export default function LiveConsultNote({ onFinalise }: { onFinalise?: () => void }) {
  const ctx = useAppContext();
  const noteRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const {
    patientName, age, sex, dob,
    vitals, weightKg, heightCm,
    hpiNotes, comorbidities, pmhNotes,
    medications, medicationsText, surgicalHistory,
    allergies,
    examNotes, examGeneral, examCardio, examResp, examAbdomen,
    assessment, plan,
    visitType,
  } = ctx;

  const hasAnyContent = !!(
    hpiNotes?.trim() || assessment?.trim() || plan?.trim() ||
    comorbidities?.length || medications?.length ||
    allergies?.trim() || examGeneral?.trim() || examCardio?.trim() ||
    examResp?.trim() || examAbdomen?.trim() ||
    Object.values(examNotes ?? {}).some(v => v?.trim()) ||
    hasVitals(vitals ?? {}, weightKg ?? '', heightCm ?? '')
  );

  function buildPlainText(): string {
    const lines: string[] = [];
    lines.push(DOCTOR);
    lines.push(SPECIALTY);
    lines.push(fmtDate());
    lines.push('');
    if (patientName) {
      const info = [patientName, sex !== 'unknown' ? sex.toUpperCase() : '', age ? `${age} years` : '', dob].filter(Boolean).join(', ');
      lines.push(`PATIENT: ${info}`);
    }
    const vtLabel = visitType ? visitType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Consultation';
    lines.push(`VISIT TYPE: ${vtLabel}`);
    lines.push('');
    const vl = vitalsLine(vitals ?? {}, weightKg ?? '', heightCm ?? '');
    if (vl) { lines.push('VITALS'); lines.push(vl); lines.push(''); }
    if (hpiNotes?.trim()) { lines.push('HISTORY OF PRESENTING ILLNESS'); lines.push(hpiNotes.trim()); lines.push(''); }
    if (comorbidities?.length || pmhNotes?.trim()) {
      lines.push('PAST MEDICAL HISTORY');
      comorbidities?.forEach(c => lines.push(`• ${c}`));
      if (pmhNotes?.trim()) lines.push(pmhNotes.trim());
      lines.push('');
    }
    if (surgicalHistory?.length) {
      lines.push('SURGICAL HISTORY');
      surgicalHistory.forEach(s => lines.push(`• ${s}`));
      lines.push('');
    }
    const allMeds = [medicationsText?.trim(), ...(medications ?? [])].filter(Boolean).join('\n');
    if (allMeds) { lines.push('CURRENT MEDICATIONS'); lines.push(allMeds); lines.push(''); }
    if (allergies?.trim()) { lines.push('ALLERGIES'); lines.push(allergies.trim()); lines.push(''); }
    const examSystems: [string, string][] = [
      ['General', examGeneral || examNotes?.general || ''],
      ['Cardiovascular', examCardio || examNotes?.cardiovascular || ''],
      ['Respiratory', examResp || examNotes?.respiratory || ''],
      ['Abdomen', examAbdomen || examNotes?.abdomen || ''],
      ['Wound', examNotes?.wound || ''],
      ['Breast', examNotes?.breast || ''],
      ['Neurological', examNotes?.neurological || ''],
      ['Extremities', examNotes?.extremities || ''],
    ].filter(([, v]) => v?.trim()) as [string, string][];
    if (examSystems.length) {
      lines.push('EXAMINATION');
      examSystems.forEach(([sys, txt]) => lines.push(`${sys}: ${txt}`));
      lines.push('');
    }
    if (assessment?.trim()) { lines.push('ASSESSMENT'); lines.push(assessment.trim()); lines.push(''); }
    if (plan?.trim()) { lines.push('PLAN'); lines.push(plan.trim()); lines.push(''); }
    lines.push(`Signed: ${DOCTOR}`);
    return lines.join('\n');
  }

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(buildPlainText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  if (!hasAnyContent) {
    return (
      <div style={{ padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎙</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Note builds here as you dictate</div>
        <div style={{ fontSize: 12 }}>Speak into the microphone above — SOAP sections populate automatically</div>
      </div>
    );
  }

  const vtLabel = visitType
    ? visitType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Consultation';

  const allMeds = [medicationsText?.trim(), ...(medications ?? [])].filter(Boolean);
  const vl = vitalsLine(vitals ?? {}, weightKg ?? '', heightCm ?? '');

  return (
    <div style={{ position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Live Note
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void copyNote()}
            style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
              background: copied ? '#0d9488' : '#fff', color: copied ? '#fff' : '#374151',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy note'}
          </button>
          {onFinalise && (
            <button
              type="button"
              onClick={onFinalise}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none',
                background: '#0d9488', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              📄 Finalise
            </button>
          )}
        </div>
      </div>

      {/* Document */}
      <div
        ref={noteRef}
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '20px 24px',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '2px solid #0d9488', paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>{DOCTOR}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginTop: 1 }}>{SPECIALTY}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginTop: 1 }}>{fmtDate()}</div>
        </div>

        {/* Patient / Visit identity */}
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
          {patientName && (
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', fontFamily: 'system-ui, sans-serif', marginBottom: 2 }}>
              {patientName}
              {(age || (sex && sex !== 'unknown')) && (
                <span style={{ fontWeight: 400, fontSize: 13, color: '#64748b' }}>
                  {' '}— {[sex !== 'unknown' ? (sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : sex) : null, age ? `${age} y` : null].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
            {vtLabel}
          </div>
        </div>

        {/* Vitals */}
        {vl && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0d9488', marginBottom: 3, fontFamily: 'system-ui, sans-serif' }}>
              Vital Signs
            </div>
            <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.8 }}>{vl}</div>
          </div>
        )}

        <NoteSection label="History of Presenting Illness" text={hpiNotes} />
        <NoteSection label="Past Medical History"
          text={pmhNotes}
          list={pmhNotes ? undefined : comorbidities}
        />
        {comorbidities?.length > 0 && pmhNotes?.trim() && (
          <NoteSection label="" list={comorbidities} />
        )}
        <NoteSection label="Surgical History" list={surgicalHistory} />
        <NoteSection label="Current Medications"
          text={allMeds.length > 0 ? allMeds.join('\n') : undefined}
        />
        <NoteSection label="Allergies" text={allergies} />

        <ExamSection
          notes={examNotes ?? {}}
          general={examGeneral}
          cardio={examCardio}
          resp={examResp}
          abdomen={examAbdomen}
        />

        <NoteSection label="Assessment / Impression" text={assessment} color="#dc2626" />
        <NoteSection label="Plan" text={plan} color="#2563eb" />

        {/* Signature */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4, fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
          {DOCTOR} · {SPECIALTY}
        </div>
      </div>
    </div>
  );
}
