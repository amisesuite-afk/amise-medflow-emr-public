/**
 * AmbientConsultation — phase-based surgical consultation workspace.
 * Phases: history → exam → assessment → plan
 * Shortcuts open inline drawers; never navigate away from the consultation.
 * Light canvas, teal accents, no dark content blocks.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAppContext, type Section, type PriorEncounterSummary } from '@/context/AppContext';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { getAIProviderConfig, segmentSoapWithOllama, type SegmentedSoap } from '@/lib/ai-provider';
import { localSegmentSoap } from '@/lib/local-soap-segmenter';
import { getApiOrigin } from '@/lib/api-origin';
import { getMatrix } from '@/lib/cc-matrices';
import { DISEASES, getDiseaseSpecialty, initPaneState, updatePosterior, topDiagnoses, applyModifiers, getProtocol } from '@workspace/pane-engine';
import { extractFeaturesFromTranscript, detectPathognomonic, type PathognomicMatch } from '@/lib/transcript-dx-mapper';
import { computeReminders } from '@/lib/safety-engine';

// ── Web Speech API ─────────────────────────────────────────────────────────────
const SR_CLASS = (typeof window !== 'undefined')
  ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
  : null;
const SPEECH_SUPPORTED = !!SR_CLASS;
// iOS Safari has webkitSpeechRecognition but ignores continuous=true; use single-session restarts
const IS_IOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/i.test(navigator.userAgent);

// ── Abnormal vitals detection ──────────────────────────────────────────────────
function abnormalVitals(vitals: Record<string, string>): string[] {
  const flags: string[] = [];
  const sbp  = parseFloat(vitals.systolicBp);
  const dbp  = parseFloat(vitals.diastolicBp);
  const hr   = parseFloat(vitals.heartRate);
  const rr   = parseFloat(vitals.respiratoryRate);
  const spo2 = parseFloat(vitals.spo2);
  const temp = parseFloat(vitals.temperatureC);
  if (Number.isFinite(sbp))  { if (sbp > 160)  flags.push(`SBP ${Math.round(sbp)}`);  if (sbp < 90)  flags.push(`SBP ${Math.round(sbp)}↓`); }
  if (Number.isFinite(dbp))  { if (dbp > 100)  flags.push(`DBP ${Math.round(dbp)}`); }
  if (Number.isFinite(hr))   { if (hr  > 100)  flags.push(`HR ${Math.round(hr)}↑`);   if (hr  < 50)  flags.push(`HR ${Math.round(hr)}↓`); }
  if (Number.isFinite(rr))   { if (rr  > 20)   flags.push(`RR ${Math.round(rr)}↑`);   if (rr  < 10)  flags.push(`RR ${Math.round(rr)}↓`); }
  if (Number.isFinite(spo2)) { if (spo2 < 94)  flags.push(`SpO₂ ${Math.round(spo2)}%↓`); }
  if (Number.isFinite(temp)) { if (temp > 38.5) flags.push(`T ${temp.toFixed(1)}°C`);  if (temp < 36.0) flags.push(`T ${temp.toFixed(1)}°C↓`); }
  return flags;
}

// ── Persist call log ───────────────────────────────────────────────────────────
type SegmentSource = 'local' | 'ollama' | 'cloud';

async function persistCallLog(
  patientId: string | null | undefined,
  transcript: string,
  soap: unknown,
  source: SegmentSource,
): Promise<void> {
  if (!patientId || source === 'cloud') return;
  try {
    const headers = await staffAuthHeaders();
    const apiOrigin = getApiOrigin();
    const url = apiOrigin ? `${apiOrigin}/api/calls/ingest` : '/api/calls/ingest';
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ patient_id: patientId, source: 'ambient', direction: 'ambient', transcript, soap_segmented: soap }),
    });
  } catch { /* non-fatal */ }
}

// ── Phase type ─────────────────────────────────────────────────────────────────
type ConsultPhase = 'history' | 'exam' | 'assessment' | 'plan';

// ── Clinical shortcut definitions ──────────────────────────────────────────────
const HISTORY_SHORTCUTS: { section: Section; icon: string; label: string }[] = [
  { section: 'pmh',            icon: '📋', label: 'PMH'         },
  { section: 'surgical',       icon: '🔪', label: 'Surgical Hx' },
  { section: 'medications',    icon: '💊', label: 'Medications'  },
  { section: 'allergies',      icon: '⚠️', label: 'Allergies'    },
  { section: 'examination',    icon: '🩺', label: 'Quick Exam'   },
  { section: 'investigations', icon: '🧪', label: 'Labs'         },
  { section: 'radiology',      icon: '🩻', label: 'Imaging'      },
];

const CC_ITEMS: { id: string; label: string }[] = [
  { id: 'abd_pain',     label: 'Abdominal pain'           },
  { id: 'hernia',       label: 'Groin / hernia lump'       },
  { id: 'breast',       label: 'Breast lump / change'      },
  { id: 'reflux',       label: 'Reflux / heartburn'        },
  { id: 'bowel',        label: 'Change in bowel habit'     },
  { id: 'rectal_bleed', label: 'Rectal bleeding'           },
  { id: 'weight_loss',  label: 'Unintentional weight loss' },
  { id: 'jaundice',     label: 'Jaundice'                  },
  { id: 'wound',        label: 'Wound / post-op review'    },
  { id: 'neck_lump',    label: 'Neck lump / thyroid'       },
  { id: 'dysphagia',    label: 'Difficulty swallowing'     },
  { id: 'bloating',     label: 'Bloating / distension'     },
  { id: 'skin',         label: 'Skin lesion / melanoma'    },
  { id: 'anal',         label: 'Anal pain / haemorrhoids'  },
  { id: 'nausea',       label: 'Nausea / vomiting'         },
  { id: 'followup',     label: 'Follow-up / review'        },
  { id: 'screening',    label: 'Screening / wellness'      },
  { id: 'ercp',         label: 'ERCP / biliary workup'     },
  { id: 'other',        label: 'Other'                     },
];

const COMMON_CONDITIONS = [
  'Hypertension', 'T2DM', 'T1DM', 'IHD', 'Atrial fibrillation',
  'GORD', 'COPD', 'Asthma', 'CKD', 'Hypothyroid',
  'Hyperlipidaemia', 'IBD', 'Stroke/TIA', 'Obesity', 'Cancer',
];

const COMMON_SURGERY = [
  'Appendicectomy', 'Cholecystectomy', 'Hernia repair',
  'Bowel resection', 'Caesarean section', 'Hysterectomy',
  'Thyroidectomy', 'Mastectomy', 'Gastric bypass', 'ERCP',
  'Laparoscopy', 'Other abdominal surgery',
];

const COMMON_ALLERGENS = [
  'Penicillin', 'Amoxicillin', 'Sulfonamides', 'Cephalosporins',
  'NSAIDs', 'Aspirin', 'Codeine', 'Morphine', 'IV contrast', 'Latex',
];

const COMMON_MEDICATIONS = [
  'Aspirin', 'Clopidogrel', 'Warfarin', 'Rivaroxaban', 'Apixaban', 'Enoxaparin',
  'Metformin', 'Insulin', 'Gliclazide', 'SGLT2 inhibitor',
  'ACE inhibitor', 'ARB', 'Beta-blocker', 'Amlodipine', 'Furosemide', 'Statin',
  'PPI / omeprazole', 'NSAIDs', 'Prednisolone', 'Methotrexate', 'Azathioprine',
];

// ── Medication intelligence: standard doses + quick options ──────────────────
type MedInfo = { default: string; options: string[]; note?: string };
const MED_INFO: Record<string, MedInfo> = {
  'Aspirin':          { default: '75 mg OD',        options: ['75 mg OD', '150 mg OD', '300 mg OD (loading)'],          note: 'Take with food. Caution: peptic ulcer, bleeding risk.' },
  'Clopidogrel':      { default: '75 mg OD',        options: ['75 mg OD', '300 mg stat (loading)', '600 mg stat (loading)'], note: 'Monitor for bleeding. Hold 5–7 days pre-op.' },
  'Warfarin':         { default: '5 mg OD',         options: ['1 mg OD', '2 mg OD', '3 mg OD', '5 mg OD', 'dose per INR'], note: 'Dose per INR. Target INR 2–3 (AF/DVT) or 2.5–3.5 (metallic valve).' },
  'Rivaroxaban':      { default: '20 mg OD',        options: ['10 mg OD', '15 mg BD (acute)', '20 mg OD'],              note: 'Take with evening meal. Renal dose-adjust if CrCl <50.' },
  'Apixaban':         { default: '5 mg BD',         options: ['2.5 mg BD', '5 mg BD', '10 mg BD (acute 7d)'],           note: 'Reduce to 2.5 mg BD if ≥2 of: age ≥80, weight ≤60 kg, Cr ≥133.' },
  'Enoxaparin':       { default: '40 mg SC OD',     options: ['20 mg SC OD', '40 mg SC OD', '1.5 mg/kg SC OD (therapeutic)', '1 mg/kg SC BD (therapeutic)'], note: 'Prophylactic vs therapeutic dose. Renally cleared — adjust if CrCl <30.' },
  'Metformin':        { default: '500 mg BD',       options: ['500 mg OD', '500 mg BD', '850 mg BD', '1 g BD', '1 g TDS'], note: 'Take with meals. Hold 48 h peri-contrast/pre-op. Caution: CKD eGFR <30.' },
  'Insulin':          { default: 'as per regimen',  options: ['basal (glargine/detemir)', 'basal-bolus', 'pre-mixed BD', 'sliding scale'], note: 'Document type, units, and timing. Adjust peri-op per protocol.' },
  'Gliclazide':       { default: '80 mg OD',        options: ['40 mg OD', '80 mg OD', '160 mg OD', '80 mg BD'],         note: 'Hold on day of surgery / procedure. Hypoglycaemia risk.' },
  'SGLT2 inhibitor':  { default: 'as prescribed',   options: ['Empagliflozin 10 mg OD', 'Dapagliflozin 10 mg OD', 'Canagliflozin 100 mg OD'], note: 'Hold ≥3 days pre-op (DKA risk). Renal contraindication if eGFR <45.' },
  'ACE inhibitor':    { default: 'as prescribed',   options: ['Ramipril 2.5 mg OD', 'Ramipril 5 mg OD', 'Ramipril 10 mg OD', 'Lisinopril 5 mg OD', 'Lisinopril 10 mg OD'], note: 'Hold on day of surgery (hypotension risk). Monitor K⁺ and renal function.' },
  'ARB':              { default: 'as prescribed',   options: ['Losartan 50 mg OD', 'Losartan 100 mg OD', 'Candesartan 8 mg OD', 'Valsartan 80 mg OD'], note: 'Hold on day of surgery. Similar cautions to ACE inhibitor.' },
  'Beta-blocker':     { default: 'as prescribed',   options: ['Bisoprolol 2.5 mg OD', 'Bisoprolol 5 mg OD', 'Bisoprolol 10 mg OD', 'Atenolol 50 mg OD', 'Carvedilol 6.25 mg BD'], note: 'Continue peri-op (abrupt cessation → rebound tachycardia). Rate-control in AF.' },
  'Amlodipine':       { default: '5 mg OD',         options: ['2.5 mg OD', '5 mg OD', '10 mg OD'],                      note: 'Can cause peripheral oedema. Continue peri-op.' },
  'Furosemide':       { default: '40 mg OD',        options: ['20 mg OD', '40 mg OD', '80 mg OD', '40 mg BD'],          note: 'Monitor electrolytes (K⁺, Na⁺). Hold if dehydrated/hypotensive.' },
  'Statin':           { default: 'as prescribed',   options: ['Atorvastatin 10 mg ON', 'Atorvastatin 20 mg ON', 'Atorvastatin 40 mg ON', 'Rosuvastatin 10 mg ON', 'Simvastatin 40 mg ON'], note: 'Take at night. Continue peri-op (cardioprotective).' },
  'PPI / omeprazole': { default: 'Omeprazole 20 mg OD', options: ['Omeprazole 20 mg OD', 'Omeprazole 40 mg OD', 'Lansoprazole 30 mg OD', 'Pantoprazole 40 mg OD'], note: 'Take 30–60 min before breakfast. Review need at 8 weeks.' },
  'NSAIDs':           { default: 'Ibuprofen 400 mg TDS', options: ['Ibuprofen 400 mg TDS', 'Ibuprofen 600 mg TDS', 'Naproxen 500 mg BD', 'Diclofenac 50 mg TDS'], note: 'Take with food. Avoid in CKD, peptic ulcer, anticoagulation. Hold pre-op.' },
  'Prednisolone':     { default: '5 mg OD',         options: ['1 mg OD', '5 mg OD', '10 mg OD', '20 mg OD', '40 mg OD', '1 mg/kg OD'], note: 'Steroid card. Stress dosing peri-op if on >5 mg >3 months. Bone protection.' },
  'Methotrexate':     { default: '7.5 mg once weekly', options: ['7.5 mg weekly', '10 mg weekly', '15 mg weekly', '20 mg weekly', '25 mg weekly'], note: 'ONCE WEEKLY only — daily dosing is fatal. Folate supplementation required.' },
  'Azathioprine':     { default: '50 mg OD',        options: ['25 mg OD', '50 mg OD', '100 mg OD', '150 mg OD'],        note: 'Monitor FBC monthly. Check TPMT before starting. Drug interaction: allopurinol.' },
};

// ── Examination: default normal text per system ───────────────────────────────
const EXAM_NORMALS: Record<string, string> = {
  General:     'Well-appearing and comfortable at rest. Haemodynamically stable. Afebrile. No pallor, jaundice, cyanosis, or peripheral oedema. No acute distress.',
  Abdomen:     'Abdomen soft and non-tender on palpation. No guarding, rigidity, or rebound tenderness. Bowel sounds present and normal. No hepatosplenomegaly or palpable masses. Hernial orifices intact. No shifting dullness or fluid thrill.',
  CVS:         'Heart sounds I and II present and normal. No murmurs, rubs, or gallops audible. JVP not elevated. Peripheral pulses present and equal bilaterally. Capillary refill time less than two seconds. No peripheral oedema.',
  Resp:        'Chest clear to auscultation bilaterally with equal air entry. No wheeze, crackles, or pleural rub. Respiratory rate and pattern normal. Trachea central. Percussion note resonant throughout.',
  Extremities: 'Peripheral pulses palpable bilaterally including dorsalis pedis and posterior tibial. No peripheral oedema. Calves soft and non-tender bilaterally. No features of peripheral arterial disease. Skin warm and well-perfused.',
  Wound:       'Wound healing by primary intention. No surrounding erythema, induration, swelling, or purulent discharge. Wound edges well-approximated. Sutures/staples intact. No features of wound dehiscence or infection.',
  Perianal:    'Anus and perianal skin normal on inspection. Digital rectal examination: normal sphincter tone. No masses, tenderness, or blood on the examining glove.',
  Breast:      "No visible skin changes, peau d'orange, or nipple retraction. No nipple discharge. No palpable masses on bimanual examination of either breast. No cervical, supraclavicular, or axillary lymphadenopathy.",
  Neck:        'No goitre or palpable thyroid mass. Trachea central. No cervical or supraclavicular lymphadenopathy.',
  Hernia:      'No inguinal, femoral, or umbilical hernia palpable. Hernial orifices intact. No cough impulse.',
  Neuro:       'Alert and oriented in time, place, and person. GCS 15/15. No focal neurological deficit. Cranial nerves grossly intact. Motor power and sensation preserved in all four limbs. Coordination intact. Reflexes symmetrical.',
  Skin:        "Skin intact. No rashes, lesions, ulceration, or hyperpigmentation. No jaundice, cyanosis, or pallor. No spider naevi or caput medusae.",
};

// ── CC → recommended exam systems ─────────────────────────────────────────────
const CC_EXAM_MAP: Record<string, string[]> = {
  abd_pain:     ['General', 'Abdomen', 'CVS', 'Resp'],
  hernia:       ['General', 'Abdomen', 'Hernia', 'CVS'],
  breast:       ['General', 'Breast', 'CVS'],
  reflux:       ['General', 'Abdomen', 'CVS'],
  bowel:        ['General', 'Abdomen', 'Perianal', 'CVS'],
  rectal_bleed: ['General', 'Abdomen', 'Perianal'],
  weight_loss:  ['General', 'Abdomen', 'CVS', 'Resp'],
  jaundice:     ['General', 'Abdomen', 'CVS', 'Resp'],
  wound:        ['General', 'Wound', 'Extremities'],
  neck_lump:    ['General', 'Neck', 'CVS'],
  dysphagia:    ['General', 'Abdomen', 'Neck', 'CVS'],
  bloating:     ['General', 'Abdomen', 'CVS'],
  skin:         ['General', 'Wound'],
  anal:         ['General', 'Abdomen', 'Perianal'],
  nausea:       ['General', 'Abdomen', 'CVS'],
  followup:     ['General', 'Abdomen'],
  screening:    ['General', 'Abdomen', 'CVS', 'Resp', 'Breast'],
  ercp:         ['General', 'Abdomen', 'CVS', 'Resp'],
  other:        ['General', 'Abdomen', 'CVS'],
};

const ALL_STD_EXAM = ['General', 'Abdomen', 'CVS', 'Resp', 'Extremities', 'Wound'];

// CC key → ranked disease specialties for deterministic differential suggestions
const CC_DX_SPECIALTY: Record<string, string[]> = {
  abd_pain:     ['general_surgery', 'hepatobiliary', 'colorectal'],
  hernia:       ['hernia', 'general_surgery'],
  breast:       ['breast'],
  reflux:       ['upper_gi', 'general_surgery'],
  bowel:        ['colorectal', 'general_surgery'],
  rectal_bleed: ['colorectal', 'general_surgery'],
  weight_loss:  ['upper_gi', 'general_surgery', 'colorectal', 'breast', 'hepatobiliary'],
  jaundice:     ['hepatobiliary', 'general_surgery'],
  wound:        ['post_op', 'skin_soft_tissue', 'vascular', 'general_surgery'],
  neck_lump:    ['endocrine'],
  dysphagia:    ['upper_gi', 'general_surgery'],
  bloating:     ['upper_gi', 'general_surgery', 'colorectal'],
  skin:         ['skin_soft_tissue', 'general_surgery'],
  anal:         ['colorectal'],
  nausea:       ['upper_gi', 'general_surgery', 'hepatobiliary'],
  ercp:         ['hepatobiliary'],
  urinary:      ['urology'],
  scrotal:      ['urology'],
  postop:       ['post_op', 'general_surgery'],
};

const COMMON_LABS = [
  'FBC', 'U&E', 'LFT', 'CRP', 'Coags', 'Lipase', 'Amylase',
  'GXM', 'HbA1c', 'TSH', 'Blood cultures', 'CA-125', 'CEA',
];

const COMMON_IMAGING = [
  'CT Abdomen/Pelvis', 'USS Abdomen', 'CXR', 'AXR',
  'CT Chest', 'MRI Abdomen', 'USS Liver/Biliary', 'ERCP',
  'Mammogram', 'USS Breast', 'CT Chest/Abdo/Pelvis',
];

// ── Shared drawer styles ───────────────────────────────────────────────────────
const drawerStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const chipBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 11px',
  borderRadius: 16,
  fontSize: 12,
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
  border: `1.5px solid ${active ? '#0d9488' : 'var(--line)'}`,
  background: active ? '#0d9488' : 'var(--card)',
  color: active ? '#fff' : 'var(--ink)',
  transition: 'all 0.12s',
  minHeight: 32,
});

const drawerTextarea: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'var(--card)',
  color: 'var(--ink)',
  fontSize: 13,
  lineHeight: 1.6,
  fontFamily: 'Georgia, serif',
  outline: 'none',
  resize: 'vertical' as const,
  boxSizing: 'border-box' as const,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--muted)',
};

// ── Compact dropdown field row inside a shared card ───────────────────────────
function HistoryFieldRow({
  icon, label, isOpen, onToggle,
  summaryText, hasData,
  noneLabel, onNone,
  onAdvance,
  isLast,
  children,
}: {
  icon: string; label: string; isOpen: boolean; onToggle: () => void;
  summaryText: string; hasData: boolean;
  noneLabel?: string; onNone?: () => void;
  onAdvance?: () => void;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '11px 14px', background: isOpen ? 'rgba(0,180,160,0.04)' : 'none',
          border: 'none', cursor: 'pointer', textAlign: 'left' as const,
          transition: 'background 0.12s',
        }}
      >
        <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.07em',
          textTransform: 'uppercase' as const,
          color: hasData ? 'var(--accent)' : 'var(--muted)',
          flexShrink: 0, minWidth: 84, transition: 'color 0.15s',
        }}>{label}</span>
        <span style={{
          fontSize: 12.5, color: hasData ? 'var(--ink)' : 'var(--faint)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textAlign: 'left' as const,
        }}>
          {summaryText}
        </span>
        {!isOpen && !hasData && noneLabel && onNone && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onNone(); onAdvance?.(); }}
            style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9,
              border: '1px solid var(--line)', background: 'transparent',
              color: 'var(--muted)', cursor: 'pointer', flexShrink: 0,
              userSelect: 'none' as const, lineHeight: '16px', display: 'inline-block',
            }}
          >
            {noneLabel}
          </span>
        )}
        {hasData && !isOpen && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
            flexShrink: 0, display: 'inline-block',
          }} />
        )}
        <span style={{
          color: 'var(--muted)', fontSize: 11, flexShrink: 0, lineHeight: 1,
          display: 'inline-block',
          transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        }}>▾</span>
      </button>

      {isOpen && (
        <div style={{
          padding: '8px 14px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
          borderTop: '1px solid var(--line)',
          background: 'rgba(0,180,160,0.02)',
        }}>
          {children}
          {onAdvance && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onAdvance} style={{
                fontSize: 11, fontWeight: 700, padding: '4px 13px', borderRadius: 9,
                border: '1px solid rgba(0,180,160,0.4)', background: 'rgba(0,180,160,0.08)',
                color: 'var(--accent)', cursor: 'pointer',
              }}>Next ›</button>
            </div>
          )}
        </div>
      )}

      {!isLast && (
        <div style={{ height: 1, background: 'var(--line)' }} />
      )}
    </div>
  );
}

// ── Smart exam system row ──────────────────────────────────────────────────────
function ExamRow({
  name, value, onChange, isRelevant, normalText, isOpen, onToggle,
}: {
  name: string; value: string; onChange: (v: string) => void;
  isRelevant: boolean; normalText: string; isOpen: boolean; onToggle: () => void;
}) {
  const filled  = !!value.trim() && value !== 'Not done';
  const notDone = value === 'Not done';
  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${filled ? 'rgba(0,180,160,0.4)' : isRelevant ? 'rgba(0,180,160,0.22)' : 'var(--line)'}`,
      background: 'var(--card)', overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      <button type="button" onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, width: '100%',
          padding: '8px 12px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left' as const,
        }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
          background: filled ? 'var(--accent)' : notDone ? 'var(--faint)' : isRelevant ? 'rgba(0,180,160,0.35)' : 'transparent',
          border: (filled || notDone) ? 'none' : `1.5px solid ${isRelevant ? 'rgba(0,180,160,0.55)' : 'var(--line)'}`,
        }} />
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const,
          color: filled ? 'var(--accent)' : isRelevant ? 'var(--accent)' : 'var(--muted)',
          flexShrink: 0, minWidth: 80, transition: 'color 0.15s',
        }}>{name}</span>
        {!isOpen && (
          filled ? (
            <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' as const }}>
              {value.length > 65 ? value.slice(0, 65) + '…' : value}
            </span>
          ) : notDone ? (
            <span style={{ fontSize: 11, color: 'var(--faint)', fontStyle: 'italic', flex: 1, textAlign: 'left' as const }}>Not done</span>
          ) : isRelevant ? (
            <span style={{ fontSize: 11, color: 'rgba(0,180,160,0.75)', flex: 1, textAlign: 'left' as const }}>tap to examine ›</span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--faint)', flex: 1, textAlign: 'left' as const }}>—</span>
          )
        )}
        {!filled && !notDone && (
          <span role="button"
            onClick={e => { e.stopPropagation(); onChange(normalText); }}
            style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9,
              border: '1px solid rgba(0,180,160,0.4)', background: 'rgba(0,180,160,0.07)',
              color: 'var(--accent)', cursor: 'pointer', flexShrink: 0,
              whiteSpace: 'nowrap' as const, userSelect: 'none' as const,
            }}>Normal</span>
        )}
        {filled && !isOpen && (
          <span role="button"
            onClick={e => { e.stopPropagation(); onChange(''); }}
            style={{
              fontSize: 11, padding: '1px 5px', borderRadius: 9,
              border: '1px solid var(--line)', background: 'transparent',
              color: 'var(--faint)', cursor: 'pointer', flexShrink: 0,
              userSelect: 'none' as const,
            }}>✕</span>
        )}
        <span style={{
          color: 'var(--muted)', fontSize: 11, flexShrink: 0, lineHeight: 1,
          display: 'inline-block',
          transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        }}>▾</span>
      </button>

      {isOpen && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '8px 12px 10px', background: 'rgba(0,180,160,0.02)' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap' as const }}>
            <button type="button" onClick={() => onChange(normalText)}
              style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                border: '1px solid rgba(0,180,160,0.4)', background: 'rgba(0,180,160,0.08)',
                color: 'var(--accent)', cursor: 'pointer',
              }}>✓ Normal</button>
            <button type="button" onClick={() => { onChange('Not done'); onToggle(); }}
              style={{
                fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'transparent',
                color: 'var(--muted)', cursor: 'pointer',
              }}>Not done</button>
            {value && (
              <button type="button" onClick={() => onChange('')}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 8, marginLeft: 'auto',
                  border: '1px solid var(--line)', background: 'transparent',
                  color: 'var(--faint)', cursor: 'pointer',
                }}>Clear</button>
            )}
          </div>
          <textarea
            value={value === 'Not done' ? '' : value}
            onChange={e => onChange(e.target.value)}
            placeholder={`${name} — tap Normal above, or type findings…`}
            style={{ ...drawerTextarea, minHeight: 56 }}
            rows={3}
          />
        </div>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  visitType?: string;
  onDetailedMode: () => void;
  onFinalise: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function AmbientConsultation({ visitType, onDetailedMode, onFinalise }: Props) {
  const ctx = useAppContext();
  const {
    activeCcKey, setActiveCcKey, symptoms, hpiNotes, setHpiNotes,
    vitals, activeSection, setActiveSection,
    allergies: allergyText, setAllergies,
    examNotes, setExamNotes,
    examGeneral, setExamGeneral,
    examCardio, setExamCardio,
    examResp, setExamResp,
    examAbdomen, setExamAbdomen,
    examNeuro: _examNeuro, setExamNeuro: _setExamNeuro,
    examExtremities, setExamExtremities,
    examWound, setExamWound,
    assessment, plan,
    orderedInvestigations, setOrderedInvestigations,
    radiologyRequests, setRadiologyRequests,
    comorbidities, setComorbidities,
    pmhNotes, setPmhNotes,
    surgicalHistory, setSurgicalHistory,
    surgicalNotes, setSurgicalNotes,
    medications, setMedications,
    medicationsText, setMedicationsText,
    triageResult,
  } = ctx;

  // ── Phase & drawer state ───────────────────────────────────────────────────
  const [consultPhase, setConsultPhase] = useState<ConsultPhase>('history');
  const [activeDrawer, setActiveDrawer] = useState<Section | null>(null);
  const [dismissedPrompts, setDismissedPrompts] = useState<string[]>([]);
  const [hpiCollapsed, setHpiCollapsed] = useState(false);
  const [assessAccordion, setAssessAccordion] = useState(false);
  // History-phase collapsible section accordion
  const [openSec, setOpenSec] = useState<string | null>('cc');
  const toggleSec = (id: string) => setOpenSec(s => s === id ? null : id);
  const [extraCcKeys, setExtraCcKeys] = useState<string[]>([]);
  const [pendingMed, setPendingMed] = useState<{ name: string; dose: string } | null>(null);
  const [workingDxId, setWorkingDxId] = useState<string | null>(null);
  const [dxSearch, setDxSearch] = useState('');
  const [dxDropOpen, setDxDropOpen] = useState(false);
  // CC-mapped or Bayesian ranked disease suggestions for Assessment
  const suggestedDx = useMemo(() => {
    if (ctx.paneTop.length > 0) return ctx.paneTop.slice(0, 5);
    const specOrder = CC_DX_SPECIALTY[activeCcKey ?? ''] ?? [];
    const sorted = [...DISEASES].sort((a, b) => {
      const ai = specOrder.indexOf(getDiseaseSpecialty(a.id));
      const bi = specOrder.indexOf(getDiseaseSpecialty(b.id));
      const aRank = ai === -1 ? 999 : ai;
      const bRank = bi === -1 ? 999 : bi;
      if (aRank !== bRank) return aRank - bRank;
      return b.prior - a.prior;
    });
    return sorted.slice(0, 5).map(d => ({ disease: d, probability: d.prior }));
  }, [ctx.paneTop, activeCcKey]);
  const SEC_ORDER = ['cc', 'pmh', 'surgical', 'medications', 'allergies'] as const;
  const advanceSec = (current: string) => {
    const idx = SEC_ORDER.indexOf(current as typeof SEC_ORDER[number]);
    setOpenSec(idx >= 0 && idx < SEC_ORDER.length - 1 ? SEC_ORDER[idx + 1] : null);
  };
  // Quick exam: which system is expanded + CC-specific extra systems (Perianal, Breast, etc.)
  const [openExamSys, setOpenExamSys] = useState<string | null>(null);
  const [extraExams, setExtraExams] = useState<Record<string, string>>({});

  // Wrap phase change to keep sidebar rail in sync
  function changePhase(phase: ConsultPhase) {
    setConsultPhase(phase);
    const sectionMap: Record<ConsultPhase, Section> = {
      history: 'hpi', exam: 'examination', assessment: 'assessment', plan: 'plan',
    };
    setActiveSection(sectionMap[phase]);
  }

  // Sync sidebar icon taps → consultation phase
  useEffect(() => {
    const H = ['hpi','pmh','surgical','medications','allergies','nurse_apcq','family_hx','toxic','ros'];
    const E = ['examination','wounds'];
    const A = ['assessment','ai_consultant'];
    const P = ['plan','prescriptions','dosing','fluid_nutrition','referring_providers'];
    let target: ConsultPhase | null = null;
    if (H.includes(activeSection)) target = 'history';
    else if (E.includes(activeSection)) target = 'exam';
    else if (A.includes(activeSection)) target = 'assessment';
    else if (P.includes(activeSection)) target = 'plan';
    if (target && target !== consultPhase) setConsultPhase(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Auto-seed standard exam fields with normal text when entering exam phase
  // Triggered by consultPhase change (full flow) OR activeDrawer opening to
  // 'examination' (Quick Exam tab bar shortcut, which sets activeDrawer not activeSection)
  useEffect(() => {
    if (consultPhase !== 'exam' && activeDrawer !== 'examination') return;
    if (!examGeneral.trim())     setExamGeneral(EXAM_NORMALS.General);
    if (!examAbdomen.trim())     setExamAbdomen(EXAM_NORMALS.Abdomen);
    if (!examCardio.trim())      setExamCardio(EXAM_NORMALS.CVS);
    if (!examResp.trim())        setExamResp(EXAM_NORMALS.Resp);
    if (!examExtremities.trim()) setExamExtremities(EXAM_NORMALS.Extremities);
    if (!examWound.trim())       setExamWound(EXAM_NORMALS.Wound);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultPhase, activeDrawer]);

  // ── Voice state ────────────────────────────────────────────────────────────
  const [micOpen, setMicOpen]         = useState(false);
  const [recording, setRecording]     = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [interim, setInterim]         = useState('');
  const [segmenting, setSegmenting]   = useState(false);
  const [pendingSoap, setPendingSoap] = useState<SegmentedSoap | null>(null);
  const [voiceError, setVoiceError]   = useState<string | null>(null);
  const [accepted, setAccepted]       = useState(false);
  const [segmentSource, setSegmentSource] = useState<SegmentSource | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  // ── Photo state ────────────────────────────────────────────────────────────
  const [cameraRef] = useState(() => ({ current: null as HTMLInputElement | null }));

  // ── DX engine state ────────────────────────────────────────────────────────
  const [pathognomicAlerts, setPathognomicAlerts] = useState<PathognomicMatch[]>([]);
  const [dxUpdatedAt, setDxUpdatedAt] = useState<number | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const ccMatrix  = activeCcKey ? getMatrix(activeCcKey) : null;
  const ccLabel   = ccMatrix?.name ?? (symptoms.length > 0 ? symptoms.slice(0, 2).join(', ') : null);
  const vitalFlags = abnormalVitals(vitals as Record<string, string>);

  const safetyReminders = useMemo(() => computeReminders({
    activeCcKey, symptoms, hpiNotes, examNotes, assessment, plan,
    orderedInvestigations,
    radiologyRequests: radiologyRequests as object[],
  }), [activeCcKey, symptoms, hpiNotes, examNotes, assessment, plan, orderedInvestigations, radiologyRequests]);

  const activeReminder = safetyReminders.find(r => !dismissedPrompts.includes(r.id)) ?? null;

  // Section completion dots
  const sectionDone: Partial<Record<Section, boolean>> = {
    pmh:            comorbidities.length > 0 || !!pmhNotes.trim(),
    surgical:       surgicalHistory.length > 0 || !!surgicalNotes.trim(),
    medications:    medications.length > 0 || !!medicationsText.trim(),
    allergies:      !!allergyText.trim(),
    examination:    !!(examGeneral || examAbdomen || examCardio || examResp),
    investigations: orderedInvestigations.length > 0,
    radiology:      radiologyRequests.length > 0,
  };

  // ── Voice helpers ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    recogRef.current?.stop();
    setRecording(false);
    setInterim('');
  }, []);

  const startRecording = useCallback(async () => {
    if (!SR_CLASS) return;

    // Pre-check permission where the API is available (Chrome, Firefox, modern Safari).
    // If already denied, surface a clear message immediately rather than letting the
    // browser fire a cryptic 'not-allowed' error on recog.start().
    if ('permissions' in navigator) {
      try {
        const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (perm.state === 'denied') {
          setVoiceError(
            'Microphone access is blocked. On iPhone/iPad: Settings → Safari → Microphone → Allow. On desktop: tap the lock icon in the address bar and allow microphone, then tap Retry.',
          );
          return;
        }
      } catch { /* Permissions API not supported on this browser — proceed */ }
    }

    setPendingSoap(null);
    setAccepted(false);
    setVoiceError(null);
    setTranscript('');
    const recog = new SR_CLASS();
    // iOS Safari silently ignores continuous=true; single-session + onend restart is the correct workaround
    recog.continuous    = !IS_IOS;
    recog.interimResults = !IS_IOS;
    recog.lang = 'en-GB';
    recog.onresult = (e: SpeechRecognitionEvent) => {
      let fin = '';
      let int = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' ';
        else int += e.results[i][0].transcript;
      }
      if (fin) setTranscript(prev => prev + fin);
      setInterim(int);
    };
    recog.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') { setRecording(false); return; }
      const MESSAGES: Record<string, string> = {
        'not-allowed':
          'Microphone access blocked. On iPhone/iPad: Settings → Safari → Microphone → Allow. On desktop: tap the lock icon and allow microphone, then tap Retry.',
        'service-not-allowed':
          'Speech recognition is unavailable in this browser — use the Full HPI editor to type.',
        'network':
          'Speech recognition requires an internet connection — check connectivity and tap Retry.',
      };
      setVoiceError(MESSAGES[e.error] ?? `Mic error: ${e.error} — tap Retry.`);
      setRecording(false);
    };
    recog.onend = () => {
      setInterim('');
      // iOS: restart if surgeon is still in recording mode (continuous simulation)
      if (IS_IOS) {
        setRecording(prev => {
          if (prev) {
            try { recog.start(); } catch { /* already stopped or aborted */ }
            return true;
          }
          return false;
        });
      } else {
        setRecording(false);
      }
    };
    recogRef.current = recog;
    recog.start();
    setRecording(true);
  }, []);

  useEffect(() => () => { recogRef.current?.stop(); }, []);

  // Auto-seed HPI from staff intake data when the field is blank
  useEffect(() => {
    if (hpiNotes.trim()) return; // don't overwrite anything already typed/loaded
    const parts: string[] = [];
    if (ccLabel) parts.push(ccLabel);
    const symptomNames = symptoms.filter(Boolean);
    if (symptomNames.length > 0) parts.push(symptomNames.join(', '));
    if (visitType && visitType !== 'new_consult') {
      const vtLabel = visitType.replace(/_/g, ' ');
      parts.push(`(${vtLabel})`);
    }
    const redFlags = (triageResult.reasons ?? []).filter((r: string) =>
      !r.toLowerCase().includes('admin') && !r.toLowerCase().includes('score')
    );
    const seed = parts.join(' — ');
    if (!seed) return;
    const draft = redFlags.length > 0
      ? `${seed}.\n\nRed flags noted on intake: ${redFlags.join('; ')}.`
      : `${seed}.`;
    setHpiNotes(draft);
  // run once on mount; intentional empty-dep omission
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCcKey]);

  async function handleSegment() {
    const text = (transcript + ' ' + interim).trim();
    if (!text) return;
    stopRecording();
    setSegmenting(true);
    setVoiceError(null);
    setSegmentSource(null);
    try {
      const local = localSegmentSoap(text);
      if (local.confidence >= 0.7) {
        setPendingSoap(local.segmented);
        setSegmentSource('local');
        void persistCallLog(ctx.patientId, text, local.segmented, 'local');
        return;
      }
      const aiConfig = getAIProviderConfig();
      if (aiConfig.type === 'ollama') {
        try {
          const r = await segmentSoapWithOllama(text, visitType, aiConfig);
          setPendingSoap(r);
          setSegmentSource('ollama');
          void persistCallLog(ctx.patientId, text, r, 'ollama');
          return;
        } catch { /* fall through */ }
      }
      const apiOrigin = getApiOrigin();
      const url = apiOrigin ? `${apiOrigin}/api/voice/segment` : '/api/voice/segment';
      const headers = await staffAuthHeaders();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ transcript: text, visitType, patientId: ctx.patientId ?? undefined }),
      });
      const data = await res.json() as { segmented?: SegmentedSoap; error?: string };
      if (!res.ok || !data.segmented) throw new Error(data.error ?? 'Segmentation failed');
      setPendingSoap(data.segmented);
      setSegmentSource('cloud');
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Segmentation failed');
    } finally {
      setSegmenting(false);
    }
  }

  function acceptSoap() {
    if (!pendingSoap) return;
    const s = pendingSoap;
    if (s.hpi?.trim()) setHpiNotes(hpiNotes ? hpiNotes + '\n\n' + s.hpi : s.hpi);
    if (s.assessment?.trim()) ctx.setAssessment(assessment ? assessment + '\n\n' + s.assessment : s.assessment);
    if (s.plan?.trim()) ctx.setPlan(plan ? plan + '\n\n' + s.plan : s.plan);
    if (s.allergies?.trim()) setAllergies(s.allergies);
    if (s.examination) {
      const ex = s.examination;
      const next = { ...examNotes };
      const map: [string, string][] = [
        ['general','general'],['cardiovascular','cardiovascular'],
        ['respiratory','respiratory'],['abdomen','abdomen'],
        ['wound','wound'],['breast','breast'],
        ['neurological','neurological'],['extremities','extremities'],
      ];
      for (const [k, src] of map) {
        const t = ex[src]?.trim();
        if (t) next[k] = next[k] ? next[k] + ' ' + t : t;
      }
      setExamNotes(next);
      if (ex.general?.trim())        setExamGeneral(ex.general);
      if (ex.cardiovascular?.trim()) setExamCardio(ex.cardiovascular);
      if (ex.respiratory?.trim())    setExamResp(ex.respiratory);
      if (ex.abdomen?.trim())        setExamAbdomen(ex.abdomen);
    }
    if (s.pmh?.length) {
      const txt = s.pmh.join('; ');
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\nPMH (dictated): ' + txt : 'PMH (dictated): ' + txt);
    }
    if (s.unsegmented?.trim()) {
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\n\n' + s.unsegmented : s.unsegmented);
    }
    void (async () => {
      const fullText = transcript;
      if (!fullText.trim()) return;
      const patho = detectPathognomonic(fullText);
      if (patho.length) setPathognomicAlerts(patho);
      const observed = extractFeaturesFromTranscript(fullText);
      if (!observed.length) return;
      const ageN = ctx.age ? parseInt(ctx.age, 10) : null;
      const modDiseases = applyModifiers(DISEASES, ageN, ctx.sex);
      let state = ctx.paneState ?? initPaneState(modDiseases);
      for (const { featureId, observed: obs } of observed) state = updatePosterior(state, modDiseases, featureId, obs);
      const top = topDiagnoses(state, modDiseases, 8);
      ctx.setPaneState(state);
      ctx.setPaneTop(top);
      setDxUpdatedAt(Date.now());
    })();
    setPendingSoap(null);
    setTranscript('');
    setAccepted(true);
    setTimeout(() => setAccepted(false), 3000);
  }

  // ── Phase transitions ──────────────────────────────────────────────────────
  function enterExam() {
    changePhase('exam');
    setActiveDrawer(null);
  }

  function enterAssessment() {
    const parts: string[] = [];
    if (ccLabel) parts.push(`Chief Complaint: ${ccLabel}`);
    if (visitType) parts.push(`\nVisit Type: ${visitType.replace(/_/g, ' ')}`);
    if (hpiNotes.trim()) parts.push(`\n\nPresenting History:\n${hpiNotes.trim()}`);
    const pmhStr = comorbidities.filter(c => c !== 'NKPMH').join(', ') || pmhNotes.trim();
    if (pmhStr) parts.push(`\n\nPast Medical History: ${pmhStr}`);
    const surgStr = surgicalHistory.filter(s => s !== 'No prior surgery').join(', ') || surgicalNotes.trim();
    if (surgStr) parts.push(`\n\nSurgical History: ${surgStr}`);
    else if (surgicalHistory.includes('No prior surgery')) parts.push('\n\nSurgical History: No prior surgery');
    const medsStr = medications.filter(m => m !== 'None').join(', ') || medicationsText.trim();
    if (medsStr) parts.push(`\n\nMedications: ${medsStr}`);
    else if (medications.includes('None')) parts.push('\n\nMedications: None');
    if (allergyText) parts.push(`\n\nAllergies: ${allergyText}`);
    const examParts: string[] = [];
    if (examGeneral)    examParts.push(`  General: ${examGeneral}`);
    if (examAbdomen)    examParts.push(`  Abdomen: ${examAbdomen}`);
    if (examCardio)     examParts.push(`  CVS: ${examCardio}`);
    if (examResp)       examParts.push(`  Resp: ${examResp}`);
    if (examExtremities) examParts.push(`  Extremities: ${examExtremities}`);
    if (examWound)      examParts.push(`  Wound: ${examWound}`);
    if (examParts.length) parts.push(`\n\nExamination:\n${examParts.join('\n')}`);
    if (orderedInvestigations.length) parts.push(`\n\nInvestigations ordered: ${orderedInvestigations.join(', ')}`);
    if (radiologyRequests.length) {
      const imgStr = radiologyRequests.map(r => `${r.modality} ${r.anatomicalRegion}`).join(', ');
      parts.push(`\n\nImaging ordered: ${imgStr}`);
    }
    // Clinical notes: supplementary only — Working Dx and differentials are shown
    // as structured UI above, not duplicated here. Only seed red flags from the
    // protocol (dictionary-first) and leave space for surgeon's additional notes.
    const dxForAssess = workingDxId ?? (suggestedDx.length > 0 ? suggestedDx[0].disease.id : null);
    const protoForAssess = dxForAssess ? getProtocol(dxForAssess) : null;
    const rfForAssess = protoForAssess?.redFlags.map(r => `⚠ ${r}`).join('\n') ?? '';

    parts.push('\n\n' + '─'.repeat(40));
    if (rfForAssess) parts.push(`\n\nRed Flags to monitor:\n${rfForAssess}`);
    parts.push('\n\nAdditional clinical notes / missing information:');

    const draft = parts.join('');
    if (!assessment.trim()) ctx.setAssessment(draft);
    changePhase('assessment');
    setActiveDrawer(null);
  }

  function buildProtocolPlan(dxId: string, isAutoSuggested: boolean): string {
    const proto = getProtocol(dxId);
    if (!proto) return '';
    const IMAGING_KW = ['uss', 'ct ', 'mri', 'mrcp', 'pet', 'cxr', 'x-ray', 'xr ', 'ultrasound', 'scan', 'echo', 'angio', 'radiograph', 'chest x', 'ercp'];
    const isImaging = (label: string) => IMAGING_KW.some(k => label.toLowerCase().includes(k));
    const labInvx     = proto.investigations.filter(i => !isImaging(i.label));
    const imagingInvx = proto.investigations.filter(i => isImaging(i.label));
    const labLines  = labInvx.map(i => `   [${i.urgency.toUpperCase()}] ${i.label}`).join('\n');
    const imgLines  = imagingInvx.map(i => `   [${i.urgency.toUpperCase()}] ${i.label}`).join('\n');
    const immediate = proto.management.filter(m => m.phase === 'immediate').map(m => `   • ${m.step}`).join('\n');
    const surgical  = proto.management.filter(m => m.phase === 'surgical').map(m => `   • ${m.step}`).join('\n');
    const conserv   = proto.management.filter(m => m.phase === 'conservative').map(m => `   • ${m.step}`).join('\n');
    const followup  = proto.management.filter(m => m.phase === 'followup').map(m => `   • ${m.step}`).join('\n');
    const rfLines   = proto.redFlags.map(r => `   ⚠ ${r}`).join('\n');
    const dxLabel   = DISEASES.find(d => d.id === dxId)?.label ?? proto.label;
    const icd10     = DISEASES.find(d => d.id === dxId)?.icd10 ?? '';
    return (
      `Management Plan — ${dxLabel}${isAutoSuggested ? ' ⚠ AI suggestion — confirm diagnosis' : ''}\n` +
      `ICD-10: ${icd10}\n\n` +
      (proto.keyPoints.length ? `Key Points:\n${proto.keyPoints.map(k => `   • ${k}`).join('\n')}\n\n` : '') +
      `1. Investigations (Labs):\n${labLines || '   —'}\n\n` +
      `2. Imaging:\n${imgLines || '   —'}\n\n` +
      `3. Procedures / Referrals:\n   ${proto.referral ?? ''}\n\n` +
      `4. Management:\n${[immediate, conserv, surgical].filter(Boolean).join('\n') || '   —'}\n\n` +
      `5. Follow-up:\n${followup || '   —'}\n\n` +
      `6. Red Flags / Safety-net:\n${rfLines || '   —'}\n`
    );
  }

  function enterPlan() {
    // Confirmed working Dx: ALWAYS seed from protocol — surgeon has committed to a diagnosis.
    // No working Dx: use top suggestion if plan is still empty, otherwise preserve user edits.
    if (workingDxId) {
      const built = buildProtocolPlan(workingDxId, false);
      if (built) ctx.setPlan(built);
    } else if (!plan.trim()) {
      const topId = suggestedDx.length > 0 ? suggestedDx[0].disease.id : null;
      const built = topId ? buildProtocolPlan(topId, true) : '';
      if (built) {
        ctx.setPlan(built);
        setWorkingDxId(topId!);
      } else {
        ctx.setPlan(
          'Management Plan\n\n' +
          '1. Investigations (Labs):\n   \n\n' +
          '2. Imaging:\n   \n\n' +
          '3. Procedures / Referrals:\n   \n\n' +
          '4. Medications:\n   \n\n' +
          '5. Follow-up:\n   \n\n' +
          '6. Safety-net / Patient instructions:\n   \n',
        );
      }
    }
    changePhase('plan');
  }

  // ── AI Consult for complex / unclear presentations ─────────────────────────
  const [aiConsulting, setAiConsulting] = useState(false);
  const [aiConsultError, setAiConsultError] = useState<string | null>(null);

  async function aiAssist(_phase: string) {
    if (aiConsulting) return;
    setAiConsulting(true);
    setAiConsultError(null);
    try {
      const headers = await staffAuthHeaders();
      const dxForQuery = workingDxId ?? (suggestedDx.length > 0 ? suggestedDx[0].disease.id : null);
      const dxLabel = dxForQuery ? (DISEASES.find(d => d.id === dxForQuery)?.label ?? '') : '';
      const icd10 = dxForQuery ? (DISEASES.find(d => d.id === dxForQuery)?.icd10 ?? '') : '';
      const body = {
        consultationType: 'clinical_decision_support',
        specificQuestion: `Patient presents with: ${ctx.symptoms.join(', ') || 'see history'}. ${dxLabel ? `Working impression: ${dxLabel} (${icd10}).` : 'Diagnosis unclear.'} Please provide differential, recommended investigations, and management outline.`,
        patientContext: {
          demographics: { name: ctx.patientName ?? '', age: ctx.age ?? '', sex: ctx.sex ?? '', dob: ctx.dob ?? '' },
          vitals: {},
          symptoms: ctx.symptoms,
          examFindings: {
            general: examGeneral ? [examGeneral] : [],
            abdomen: examAbdomen ? [examAbdomen] : [],
            cardiovascular: examCardio ? [examCardio] : [],
            respiratory: examResp ? [examResp] : [],
            extremities: examExtremities ? [examExtremities] : [],
          },
          investigations: {},
          assessment: assessment,
          medications: [],
          allergies: allergyText ? [{ allergen: allergyText, reaction: '', severity: 'unknown' }] : [],
          comorbidities: [],
          rosFindings: {},
        },
        icd10Codes: dxForQuery ? [{ code: icd10, description: dxLabel }] : [],
        guidelinesContext: [],
        patientId: ctx.patientId ?? undefined,
      };
      const res = await fetch('/api/ai-consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`AI consult failed (${res.status})`);
      const data = await res.json() as {
        assessmentSummary?: string;
        recommendations?: Array<{ text: string; priority: string }>;
        redFlags?: string[];
        suggestedInvestigations?: string[];
      };
      const lines: string[] = ['\n\n── AI Clinical Decision Support ──'];
      if (data.assessmentSummary) lines.push(data.assessmentSummary);
      if (data.redFlags?.length) lines.push('\nRed Flags: ' + data.redFlags.join('; '));
      if (data.suggestedInvestigations?.length) lines.push('\nSuggested Investigations: ' + data.suggestedInvestigations.join('; '));
      if (data.recommendations?.length) {
        lines.push('\nRecommendations:');
        data.recommendations.forEach((r, i) => lines.push(`  ${i + 1}. [${r.priority.toUpperCase()}] ${r.text}`));
      }
      lines.push('── (AI suggestion — confirm with clinical judgement) ──');
      ctx.setAssessment((assessment ? assessment : '') + lines.join('\n'));
    } catch (err) {
      setAiConsultError(err instanceof Error ? err.message : 'AI consult failed');
    } finally {
      setAiConsulting(false);
    }
  }

  // Auto-populate plan from protocol the moment working Dx is confirmed or changed.
  // Fires regardless of phase so when the surgeon arrives at Plan it's already there.
  useEffect(() => {
    if (!workingDxId) return;
    const built = buildProtocolPlan(workingDxId, false);
    if (built) ctx.setPlan(built);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingDxId]);

  const fullTranscript = transcript + (interim ? interim : '');

  // ── Dictate button handler ─────────────────────────────────────────────────
  function handleDictateClick() {
    if (!micOpen) {
      setMicOpen(true);
      if (!recording && !pendingSoap) void startRecording();
    } else if (recording) {
      void handleSegment();
    } else {
      setMicOpen(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Phase indicator bar
  const phases: { key: ConsultPhase; label: string }[] = [
    { key: 'history',    label: 'History'    },
    { key: 'exam',       label: 'Exam'       },
    { key: 'assessment', label: 'Assessment' },
    { key: 'plan',       label: 'Plan'       },
  ];
  const phaseIdx = phases.findIndex(p => p.key === consultPhase);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Phase breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {phases.map((p, i) => {
          const done = i < phaseIdx;
          const active = i === phaseIdx;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                if (done) changePhase(p.key);
              }}
              disabled={i > phaseIdx}
              title={done ? `Return to ${p.label}` : active ? `Current phase: ${p.label}` : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', border: 'none', cursor: done ? 'pointer' : 'default',
                fontSize: 11, fontWeight: active ? 800 : done ? 600 : 500,
                background: 'transparent',
                color: active ? '#0d9488' : done ? 'var(--ink)' : 'var(--muted)',
                opacity: i > phaseIdx ? 0.45 : 1,
                transition: 'all 0.12s',
              }}
            >
              {done && <span style={{ fontSize: 10, color: '#0d9488' }}>✓</span>}
              {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', display: 'inline-block', flexShrink: 0 }} />}
              {p.label}
              {i < phases.length - 1 && (
                <span style={{ marginLeft: 6, color: 'var(--muted)', opacity: 0.4 }}>›</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Persistent shortcut rail — sticky at top, accessible from all consultation phases ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 8,
        background: 'var(--bg)', borderBottom: '1px solid var(--line)',
        paddingTop: 4, paddingBottom: 8,
      }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {HISTORY_SHORTCUTS.map(({ section, icon, label }) => {
            const done = !!sectionDone[section as keyof typeof sectionDone];
            // In history phase, PMH/Surgical/Meds/Allergies scroll into section cards
            const histSecs = ['pmh', 'surgical', 'medications', 'allergies'];
            const isHistSec = histSecs.includes(section);
            const isActive = isHistSec && consultPhase === 'history'
              ? openSec === section
              : activeDrawer === section;
            return (
              <button
                key={section}
                type="button"
                onClick={() => {
                  if (isHistSec && consultPhase === 'history') {
                    toggleSec(section);
                    setActiveDrawer(null);
                  } else {
                    setActiveDrawer(d => d === section ? null : section);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '6px 12px', borderRadius: 18, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, minHeight: 36, position: 'relative',
                  border: `1.5px solid ${isActive ? 'var(--accent)' : done ? 'var(--accent)' : 'var(--line)'}`,
                  background: isActive ? 'var(--accent)' : done ? 'rgba(0,180,160,0.08)' : 'var(--card)',
                  color: isActive ? '#fff' : done ? 'var(--accent)' : 'var(--ink)',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {done && !isActive && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                )}
                <span style={{ fontSize: 14 }}>{icon}</span>
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveDrawer(d => d === 'attachments' ? null : 'attachments')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              padding: '6px 12px', borderRadius: 18, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, minHeight: 36, whiteSpace: 'nowrap',
              border: `1.5px solid ${activeDrawer === 'attachments' ? '#0d9488' : ctx.examPhotos.length > 0 ? '#0d9488' : 'var(--line)'}`,
              background: activeDrawer === 'attachments' ? '#0d9488' : ctx.examPhotos.length > 0 ? 'rgba(13,148,136,0.08)' : 'var(--card)',
              color: activeDrawer === 'attachments' ? '#fff' : ctx.examPhotos.length > 0 ? '#0d9488' : 'var(--ink)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 14 }}>📷</span>
            Photos{ctx.examPhotos.length > 0 ? ` (${ctx.examPhotos.length})` : ''}
          </button>
        </div>
      </div>

      {/* ── Inline drawers — expand below rail, all phases ── */}
      {activeDrawer === 'pmh' && (
        <div style={drawerStyle}>
          <div style={{ ...sectionLabel }}>Past Medical History</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {COMMON_CONDITIONS.map(c => {
              const on = comorbidities.includes(c);
              return (
                <button key={c} type="button"
                  onClick={() => setComorbidities(on ? comorbidities.filter(x => x !== c) : [...comorbidities, c])}
                  style={chipBtn(on)}>
                  {on ? '✓ ' : ''}{c}
                </button>
              );
            })}
            {comorbidities.length > 0 && (
              <button type="button" onClick={() => setComorbidities([])} style={chipBtn(false)}>Clear all</button>
            )}
          </div>
          <textarea value={pmhNotes} onChange={e => setPmhNotes(e.target.value)}
            placeholder="Additional conditions, relevant detail (e.g. year of diagnosis, control status)…"
            style={drawerTextarea} rows={2} />
        </div>
      )}

      {activeDrawer === 'surgical' && (
        <div style={drawerStyle}>
          <div style={sectionLabel}>Surgical History</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['No prior surgery', ...COMMON_SURGERY].map(s => {
              const on = surgicalHistory.includes(s);
              return (
                <button key={s} type="button"
                  onClick={() => setSurgicalHistory(on ? surgicalHistory.filter(x => x !== s) : [...surgicalHistory, s])}
                  style={chipBtn(on)}>
                  {on ? '✓ ' : ''}{s}
                </button>
              );
            })}
          </div>
          <textarea value={surgicalNotes} onChange={e => setSurgicalNotes(e.target.value)}
            placeholder="Other procedures, dates, complications…"
            style={drawerTextarea} rows={2} />
        </div>
      )}

      {activeDrawer === 'medications' && (
        <div style={drawerStyle}>
          <div style={sectionLabel}>Current Medications</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
            <button type="button" onClick={() => { setMedications(medications.includes('None') ? [] : ['None']); if (!medications.includes('None')) { setMedicationsText(''); setPendingMed(null); } }}
              style={chipBtn(medications.includes('None'))}>
              {medications.includes('None') ? '✓ ' : ''}None
            </button>
            {!medications.includes('None') && COMMON_MEDICATIONS.map(med => {
              const on = medicationsText.split('\n').some(l => l.trim().toLowerCase().startsWith(med.toLowerCase()));
              return (
                <button key={med} type="button"
                  onClick={() => {
                    if (on) {
                      const lines = medicationsText.split('\n').map(s => s.trim()).filter(Boolean);
                      const newLines = lines.filter(l => !l.toLowerCase().startsWith(med.toLowerCase()));
                      setMedicationsText(newLines.join('\n'));
                      setMedications(newLines);
                      if (pendingMed?.name === med) setPendingMed(null);
                    } else {
                      setPendingMed({ name: med, dose: MED_INFO[med]?.default ?? '' });
                    }
                  }}
                  style={pendingMed?.name === med ? { ...chipBtn(false), border: '2px solid var(--accent)', background: 'rgba(0,180,160,0.08)' } : chipBtn(on)}>
                  {on ? '✓ ' : ''}{med}
                </button>
              );
            })}
          </div>
          {pendingMed && (
            <div style={{ borderRadius: 8, border: '1px solid rgba(0,180,160,0.35)', background: 'rgba(0,180,160,0.04)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{pendingMed.name}</span>
                <button type="button" onClick={() => setPendingMed(null)} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(MED_INFO[pendingMed.name]?.options ?? []).map(opt => (
                  <button key={opt} type="button" onClick={() => setPendingMed(p => p ? { ...p, dose: opt } : null)}
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                      border: pendingMed.dose === opt ? '1px solid var(--accent)' : '1px solid var(--line)',
                      background: pendingMed.dose === opt ? 'rgba(0,180,160,0.12)' : 'transparent',
                      color: pendingMed.dose === opt ? 'var(--accent)' : 'var(--muted)',
                    }}>{opt}</button>
                ))}
              </div>
              <input value={pendingMed.dose}
                onChange={e => setPendingMed(p => p ? { ...p, dose: e.target.value } : null)}
                placeholder="Custom dose / frequency…"
                style={{ ...drawerTextarea, resize: 'none' as const, padding: '5px 8px', fontSize: 12 }} />
              {MED_INFO[pendingMed.name]?.note && (
                <div style={{ fontSize: 11, color: 'var(--coral)', lineHeight: 1.4 }}>⚠ {MED_INFO[pendingMed.name].note}</div>
              )}
              <button type="button" onClick={() => {
                const line = pendingMed.dose.trim() ? `${pendingMed.name} ${pendingMed.dose.trim()}` : pendingMed.name;
                const lines = medicationsText.split('\n').map(s => s.trim()).filter(Boolean);
                const newLines = [...lines, line];
                setMedicationsText(newLines.join('\n'));
                setMedications(newLines);
                setPendingMed(null);
              }} style={{ alignSelf: 'flex-end', fontSize: 12, fontWeight: 700, padding: '5px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                + Add
              </button>
            </div>
          )}
          <textarea
            value={medicationsText}
            onChange={e => {
              setMedicationsText(e.target.value);
              setMedications(e.target.value ? e.target.value.split('\n').map(s => s.trim()).filter(Boolean) : []);
            }}
            placeholder={'One per line:\nAmlodipine 5 mg OD\nMetformin 500 mg BD\nAtorvastatin 20 mg ON'}
            style={drawerTextarea} rows={5} />
        </div>
      )}

      {activeDrawer === 'allergies' && (
        <div style={drawerStyle}>
          <div style={sectionLabel}>Drug Allergies</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button type="button" onClick={() => setAllergies('NKDA')} style={chipBtn(allergyText === 'NKDA')}>
              {allergyText === 'NKDA' ? '✓ ' : ''}NKDA
            </button>
            {COMMON_ALLERGENS.map(a => {
              const on = allergyText.includes(a);
              return (
                <button key={a} type="button"
                  onClick={() => {
                    if (allergyText === 'NKDA') { setAllergies(a); return; }
                    const curr = allergyText.split(',').map(s => s.trim()).filter(Boolean);
                    setAllergies(on ? curr.filter(x => x !== a).join(', ') : [...curr, a].join(', '));
                  }}
                  style={chipBtn(on)}>
                  {on ? '✓ ' : ''}{a}
                </button>
              );
            })}
          </div>
          <input
            value={allergyText === 'NKDA' ? '' : allergyText}
            onChange={e => setAllergies(e.target.value)}
            placeholder="Other allergen / reaction detail…"
            style={{ ...drawerTextarea, resize: undefined }}
          />
        </div>
      )}

      {activeDrawer === 'examination' && (() => {
        const ccPlan = activeCcKey ? (CC_EXAM_MAP[activeCcKey] ?? ['General', 'Abdomen', 'CVS', 'Resp']) : ['General', 'Abdomen', 'CVS', 'Resp'];
        const ccExtras = ccPlan.filter(s => !ALL_STD_EXAM.includes(s));
        const relevantStd = ccPlan.filter(s => ALL_STD_EXAM.includes(s));
        const nonRelevantStd = ALL_STD_EXAM.filter(s => !ccPlan.includes(s));
        const orderedSystems = [...relevantStd, ...nonRelevantStd];

        const stdExamFields: Record<string, [string, (v: string) => void]> = {
          General:     [examGeneral,     setExamGeneral],
          Abdomen:     [examAbdomen,     setExamAbdomen],
          CVS:         [examCardio,      setExamCardio],
          Resp:        [examResp,        setExamResp],
          Extremities: [examExtremities, setExamExtremities],
          Wound:       [examWound,       setExamWound],
        };

        const handleSetAllNormal = () => {
          ccPlan.forEach(sys => {
            const text = EXAM_NORMALS[sys] ?? `${sys}: Normal.`;
            if (stdExamFields[sys]) stdExamFields[sys][1](text);
            else setExtraExams(prev => ({ ...prev, [sys]: text }));
          });
          setOpenExamSys(null);
        };

        return (
          <div style={drawerStyle}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={sectionLabel}>
                  {ccLabel ? `Examination — ${ccLabel}` : 'Examination'}
                </span>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                  Prose entry · shared with Full Exam tab
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" onClick={handleSetAllNormal}
                  style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                    border: '1px solid rgba(0,180,160,0.4)', background: 'rgba(0,180,160,0.08)',
                    color: 'var(--accent)', cursor: 'pointer',
                  }}>All normal</button>
                <button type="button" onClick={enterExam}
                  style={{
                    fontSize: 11, color: 'var(--accent)', border: '1px solid rgba(0,180,160,0.3)',
                    background: 'rgba(0,180,160,0.06)', padding: '3px 9px', borderRadius: 5,
                    cursor: 'pointer', fontWeight: 600,
                  }}>Full Exam →</button>
              </div>
            </div>

            {/* Standard systems: CC-relevant first, then rest */}
            {orderedSystems.map(sys => {
              const [val, setter] = stdExamFields[sys];
              return (
                <ExamRow key={sys}
                  name={sys} value={val} onChange={setter}
                  isRelevant={relevantStd.includes(sys)}
                  normalText={EXAM_NORMALS[sys] ?? `${sys}: Normal.`}
                  isOpen={openExamSys === sys}
                  onToggle={() => setOpenExamSys(s => s === sys ? null : sys)}
                />
              );
            })}

            {/* CC-specific extra systems (Perianal, Breast, Neck, Hernia) */}
            {ccExtras.map(sys => (
              <ExamRow key={sys}
                name={sys}
                value={extraExams[sys] ?? ''}
                onChange={v => setExtraExams(prev => ({ ...prev, [sys]: v }))}
                isRelevant
                normalText={EXAM_NORMALS[sys] ?? `${sys}: Normal.`}
                isOpen={openExamSys === sys}
                onToggle={() => setOpenExamSys(s => s === sys ? null : sys)}
              />
            ))}

            {/* Additional findings */}
            <div>
              <div style={{ ...sectionLabel, marginBottom: 4, color: 'var(--muted)' }}>Additional findings</div>
              <textarea value={examNotes['additional'] ?? ''} onChange={e => setExamNotes({ ...examNotes, additional: e.target.value })}
                placeholder="Any additional examination findings…"
                style={drawerTextarea} rows={2} />
            </div>
          </div>
        );
      })()}

      {activeDrawer === 'investigations' && (
        <div style={drawerStyle}>
          <div style={sectionLabel}>Blood Tests / Labs</div>
          {orderedInvestigations.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {orderedInvestigations.map(inv => (
                <span key={inv} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 14, fontSize: 12, fontWeight: 600,
                  background: 'rgba(13,148,136,0.1)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)',
                }}>
                  {inv}
                  <button type="button" onClick={() => setOrderedInvestigations(orderedInvestigations.filter(x => x !== inv))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0d9488', padding: '0 0 0 2px', fontSize: 12, lineHeight: 1 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ ...sectionLabel, marginTop: 2 }}>Add common:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {COMMON_LABS.filter(l => !orderedInvestigations.includes(l)).map(lab => (
              <button key={lab} type="button"
                onClick={() => setOrderedInvestigations([...orderedInvestigations, lab])}
                style={chipBtn(false)}>
                + {lab}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeDrawer === 'radiology' && (
        <div style={drawerStyle}>
          <div style={sectionLabel}>Imaging Requests</div>
          {radiologyRequests.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {radiologyRequests.map(r => (
                <span key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 14, fontSize: 12, fontWeight: 600,
                  background: 'rgba(13,148,136,0.1)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)',
                }}>
                  {r.modality} {r.anatomicalRegion}
                  <button type="button" onClick={() => setRadiologyRequests(radiologyRequests.filter(x => x.id !== r.id))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0d9488', padding: '0 0 0 2px', fontSize: 12, lineHeight: 1 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ ...sectionLabel, marginTop: 2 }}>Add:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {COMMON_IMAGING.filter(img => !radiologyRequests.some(r => `${r.modality} ${r.anatomicalRegion}` === img)).map(img => {
              const [modality, ...rest] = img.split(' ');
              return (
                <button key={img} type="button"
                  onClick={() => setRadiologyRequests([...radiologyRequests, {
                    id: crypto.randomUUID(), modality: modality ?? img,
                    anatomicalRegion: rest.join(' '), laterality: '', urgency: 'routine',
                    indication: ccLabel ?? '', clinicalQuestion: '', ctContrast: '',
                    ctEgfr: '', mriProtocol: '', scopeType: '', functionalType: '',
                    resultReceived: false, resultNotes: '',
                  }])}
                  style={chipBtn(false)}>
                  + {img}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeDrawer === 'attachments' && (
        <div style={drawerStyle}>
          <div style={sectionLabel}>Clinical Photos</div>
          <input
            ref={el => { cameraRef.current = el; }}
            type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => {
                const dataUrl = ev.target?.result as string;
                if (dataUrl) ctx.setExamPhotos([
                  ...ctx.examPhotos,
                  { id: crypto.randomUUID(), dataUrl, mimeType: file.type, bodyRegion: 'wound', description: '', distanceCm: '', dateAdded: new Date().toISOString() },
                ]);
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={() => cameraRef.current?.click()}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #0d9488',
              background: 'rgba(13,148,136,0.06)', color: '#0d9488', fontSize: 13, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>
            📷 Capture photo
          </button>
          {ctx.examPhotos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ctx.examPhotos.map(p => (
                <div key={p.id} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img src={p.dataUrl} alt={p.bodyRegion}
                    style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '1.5px solid var(--line)' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Abnormal vitals alert ── */}
      {vitalFlags.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 8,
          background: '#fef2f2', border: '1px solid #fca5a5',
        }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Abnormal vitals:</span>
          <span style={{ fontSize: 12, color: '#dc2626' }}>{vitalFlags.join(' · ')}</span>
        </div>
      )}

      {/* ════════════════════════════════════════
          HISTORY PHASE
      ════════════════════════════════════════ */}
      {consultPhase === 'history' && (
        <>
          {/* ── Prior visit baseline strip — follow-up visits only ── */}
          {visitType === 'follow_up' && ctx.priorEncounterSummary && (
            <PriorVisitStrip summary={ctx.priorEncounterSummary} />
          )}

          {/* ── Clinical history — compact dropdown rows ── */}
          <div style={{
            borderRadius: 10, border: '1px solid var(--line)',
            background: 'var(--card)', overflow: 'hidden',
          }}>
            {/* Chief Complaint */}
            <HistoryFieldRow
              icon="🩺" label="Chief Complaint"
              isOpen={openSec === 'cc'} onToggle={() => toggleSec('cc')}
              hasData={!!activeCcKey}
              summaryText={(() => {
                const allSelected = [activeCcKey, ...extraCcKeys].filter(Boolean) as string[];
                if (allSelected.length === 0) return 'Tap to select';
                return allSelected.map(k => CC_ITEMS.find(c => c.id === k)?.label ?? k).join(', ');
              })()}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CC_ITEMS.map(cc => {
                  const isPrimary = activeCcKey === cc.id;
                  const isExtra   = extraCcKeys.includes(cc.id);
                  const on = isPrimary || isExtra;
                  return (
                    <button key={cc.id} type="button" style={chipBtn(on)} onClick={() => {
                      if (isPrimary) {
                        // Deselect primary — promote first extra to primary if any
                        const [next, ...rest] = extraCcKeys;
                        setActiveCcKey(next ?? null);
                        setExtraCcKeys(rest);
                      } else if (isExtra) {
                        setExtraCcKeys(extraCcKeys.filter(k => k !== cc.id));
                      } else if (!activeCcKey) {
                        // No primary yet — set as primary and auto-advance
                        setActiveCcKey(cc.id);
                        if (!hpiNotes.trim()) setHpiNotes(cc.label + ' — ');
                        advanceSec('cc');
                      } else {
                        // Primary already set — add as extra, stay open for more
                        setExtraCcKeys([...extraCcKeys, cc.id]);
                      }
                    }}>{cc.label}</button>
                  );
                })}
              </div>
            </HistoryFieldRow>

            {/* Past Medical History */}
            <HistoryFieldRow
              icon="📋" label="PMH"
              isOpen={openSec === 'pmh'} onToggle={() => toggleSec('pmh')}
              hasData={comorbidities.length > 0 || pmhNotes.includes('NKPMH')}
              summaryText={
                pmhNotes.includes('NKPMH') ? 'No PMH'
                : comorbidities.length > 0
                  ? comorbidities.slice(0, 4).join(', ') + (comorbidities.length > 4 ? ` +${comorbidities.length - 4}` : '')
                  : 'No PMH'
              }
              noneLabel="No PMH"
              onNone={() => { setPmhNotes('No known past medical history (NKPMH)'); setComorbidities([]); }}
              onAdvance={() => advanceSec('pmh')}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button type="button"
                  style={{ ...chipBtn(pmhNotes.includes('NKPMH')), fontSize: 11, padding: '3px 9px' }}
                  onClick={() => {
                    if (pmhNotes.includes('NKPMH')) { setPmhNotes(''); }
                    else { setPmhNotes('No known past medical history (NKPMH)'); setComorbidities([]); advanceSec('pmh'); }
                  }}>
                  No PMH
                </button>
                {!pmhNotes.includes('NKPMH') && COMMON_CONDITIONS.map(cond => {
                  const on = comorbidities.includes(cond);
                  return (
                    <button key={cond} type="button" style={chipBtn(on)}
                      onClick={() => setComorbidities(on ? comorbidities.filter(c => c !== cond) : [...comorbidities, cond])}>
                      {on ? '✓ ' : ''}{cond}
                    </button>
                  );
                })}
              </div>
              <textarea value={pmhNotes.includes('NKPMH') ? '' : pmhNotes} onChange={e => setPmhNotes(e.target.value)}
                placeholder="Additional detail…"
                style={drawerTextarea} rows={2} />
            </HistoryFieldRow>

            {/* Surgical History */}
            <HistoryFieldRow
              icon="🔪" label="Surgical Hx"
              isOpen={openSec === 'surgical'} onToggle={() => toggleSec('surgical')}
              hasData={surgicalHistory.length > 0}
              summaryText={
                surgicalHistory.includes('No prior surgery') ? 'No prior surgery'
                : surgicalHistory.length > 0
                  ? surgicalHistory.slice(0, 3).join(', ') + (surgicalHistory.length > 3 ? ` +${surgicalHistory.length - 3}` : '')
                  : 'None'
              }
              noneLabel="No surgery"
              onNone={() => setSurgicalHistory(['No prior surgery'])}
              onAdvance={() => advanceSec('surgical')}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['No prior surgery', ...COMMON_SURGERY].map(s => {
                  const on = surgicalHistory.includes(s);
                  return (
                    <button key={s} type="button"
                      onClick={() => {
                        setSurgicalHistory(on ? surgicalHistory.filter(x => x !== s) : [...surgicalHistory, s]);
                        if (s === 'No prior surgery' && !on) advanceSec('surgical');
                      }}
                      style={chipBtn(on)}>
                      {on ? '✓ ' : ''}{s}
                    </button>
                  );
                })}
              </div>
              <textarea value={surgicalNotes} onChange={e => setSurgicalNotes(e.target.value)}
                placeholder="Procedures, dates, complications…"
                style={drawerTextarea} rows={2} />
            </HistoryFieldRow>

            {/* Medications */}
            <HistoryFieldRow
              icon="💊" label="Medications"
              isOpen={openSec === 'medications'} onToggle={() => toggleSec('medications')}
              hasData={medications.length > 0 || !!medicationsText.trim()}
              summaryText={
                medications.includes('None') ? 'None'
                : medications.length > 0
                  ? medications.slice(0, 3).join(', ') + (medications.length > 3 ? ` +${medications.length - 3}` : '')
                  : 'None'
              }
              noneLabel="None"
              onNone={() => { setMedications(['None']); setMedicationsText(''); }}
              onAdvance={() => advanceSec('medications')}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 2 }}>
                <button type="button"
                  onClick={() => {
                    if (medications.includes('None')) { setMedications([]); }
                    else { setMedications(['None']); setMedicationsText(''); setPendingMed(null); advanceSec('medications'); }
                  }}
                  style={chipBtn(medications.includes('None'))}>
                  {medications.includes('None') ? '✓ ' : ''}None
                </button>
                {!medications.includes('None') && COMMON_MEDICATIONS.map(med => {
                  const on = medicationsText.split('\n').some(l => l.trim().toLowerCase().startsWith(med.toLowerCase()));
                  return (
                    <button key={med} type="button"
                      onClick={() => {
                        if (on) {
                          const lines = medicationsText.split('\n').map(s => s.trim()).filter(Boolean);
                          const newLines = lines.filter(l => !l.toLowerCase().startsWith(med.toLowerCase()));
                          setMedicationsText(newLines.join('\n'));
                          setMedications(newLines);
                          if (pendingMed?.name === med) setPendingMed(null);
                        } else {
                          setPendingMed({ name: med, dose: MED_INFO[med]?.default ?? '' });
                        }
                      }}
                      style={pendingMed?.name === med ? { ...chipBtn(false), border: '2px solid var(--accent)', background: 'rgba(0,180,160,0.08)' } : chipBtn(on)}>
                      {on ? '✓ ' : ''}{med}
                    </button>
                  );
                })}
              </div>
              {pendingMed && (
                <div style={{ borderRadius: 8, border: '1px solid rgba(0,180,160,0.35)', background: 'rgba(0,180,160,0.04)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{pendingMed.name}</span>
                    <button type="button" onClick={() => setPendingMed(null)} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(MED_INFO[pendingMed.name]?.options ?? []).map(opt => (
                      <button key={opt} type="button" onClick={() => setPendingMed(p => p ? { ...p, dose: opt } : null)}
                        style={{ fontSize: 11, padding: '3px 9px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                          border: pendingMed.dose === opt ? '1px solid var(--accent)' : '1px solid var(--line)',
                          background: pendingMed.dose === opt ? 'rgba(0,180,160,0.12)' : 'transparent',
                          color: pendingMed.dose === opt ? 'var(--accent)' : 'var(--muted)',
                        }}>{opt}</button>
                    ))}
                  </div>
                  <input value={pendingMed.dose}
                    onChange={e => setPendingMed(p => p ? { ...p, dose: e.target.value } : null)}
                    placeholder="Custom dose / frequency…"
                    style={{ padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' as const }} />
                  {MED_INFO[pendingMed.name]?.note && (
                    <div style={{ fontSize: 11, color: 'var(--coral)', lineHeight: 1.4 }}>⚠ {MED_INFO[pendingMed.name].note}</div>
                  )}
                  <button type="button" onClick={() => {
                    const line = pendingMed.dose.trim() ? `${pendingMed.name} ${pendingMed.dose.trim()}` : pendingMed.name;
                    const lines = medicationsText.split('\n').map(s => s.trim()).filter(Boolean);
                    const newLines = [...lines, line];
                    setMedicationsText(newLines.join('\n'));
                    setMedications(newLines);
                    setPendingMed(null);
                  }} style={{ alignSelf: 'flex-end', fontSize: 12, fontWeight: 700, padding: '5px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                    + Add
                  </button>
                </div>
              )}
              <textarea
                value={medicationsText}
                onChange={e => {
                  setMedicationsText(e.target.value);
                  setMedications(e.target.value ? e.target.value.split('\n').map(s => s.trim()).filter(Boolean) : []);
                }}
                placeholder={'One per line:\nAmlodipine 5 mg OD\nMetformin 500 mg BD'}
                style={drawerTextarea} rows={4} />
            </HistoryFieldRow>

            {/* Allergies */}
            <HistoryFieldRow
              icon="⚠️" label="Allergies"
              isOpen={openSec === 'allergies'} onToggle={() => toggleSec('allergies')}
              hasData={!!allergyText.trim()}
              summaryText={allergyText || 'NKDA'}
              noneLabel="NKDA"
              onNone={() => { setAllergies('NKDA'); setOpenSec(null); }}
              isLast
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 2 }}>
                <button type="button"
                  onClick={() => {
                    if (allergyText === 'NKDA') { setAllergies(''); }
                    else { setAllergies('NKDA'); setOpenSec(null); }
                  }}
                  style={chipBtn(allergyText === 'NKDA')}>
                  {allergyText === 'NKDA' ? '✓ ' : ''}NKDA
                </button>
                {COMMON_ALLERGENS.map(a => {
                  const on = allergyText.includes(a);
                  return (
                    <button key={a} type="button"
                      onClick={() => {
                        if (allergyText === 'NKDA') { setAllergies(a); return; }
                        const curr = allergyText.split(',').map(s => s.trim()).filter(Boolean);
                        setAllergies(on ? curr.filter(x => x !== a).join(', ') : [...curr, a].join(', '));
                      }}
                      style={chipBtn(on)}>
                      {on ? '✓ ' : ''}{a}
                    </button>
                  );
                })}
              </div>
              <input
                value={allergyText === 'NKDA' ? '' : allergyText}
                onChange={e => setAllergies(e.target.value)}
                placeholder="Other allergen / reaction…"
                style={{ ...drawerTextarea, resize: undefined }}
              />
            </HistoryFieldRow>
          </div>

          {/* ── Presenting History ── */}
          <div style={{
            borderRadius: 10,
            border: `1px solid ${hpiNotes.trim() ? 'rgba(0,180,160,0.4)' : 'var(--line)'}`,
            background: 'var(--card)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px',
              borderBottom: '1px solid var(--line)',
            }}>
              <span style={{ fontSize: 13 }}>📝</span>
              <span style={{ ...sectionLabel, color: hpiNotes.trim() ? 'var(--accent)' : 'var(--muted)' }}>
                {ccLabel ? `${ccLabel} — History` : 'Presenting History'}
              </span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={handleDictateClick}
                disabled={!SPEECH_SUPPORTED && !micOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 7, border: 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: recording ? '#dc2626' : micOpen ? 'var(--accent)' : 'rgba(0,180,160,0.1)',
                  color: recording ? '#fff' : micOpen ? '#fff' : 'var(--accent)',
                  transition: 'all 0.15s',
                }}
                title={recording ? 'Stop & analyse' : micOpen ? 'Close mic' : 'Dictate HPI'}
              >
                <span style={{
                  display: 'inline-block', width: 6, height: 6,
                  borderRadius: '50%', flexShrink: 0,
                  background: recording ? '#fff' : 'currentColor',
                  animation: recording ? 'ambPulse 1s ease-in-out infinite' : 'none',
                }} />
                {recording ? 'Stop' : segmenting ? 'Analysing…' : accepted ? '✓ Loaded' : '🎙 Dictate'}
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection('hpi'); onDetailedMode(); }}
                style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  border: '1px solid var(--line)', background: 'transparent',
                  color: 'var(--muted)', cursor: 'pointer',
                }}
              >Full HPI ↗</button>
            </div>
            <textarea
              value={hpiNotes}
              onChange={e => setHpiNotes(e.target.value)}
              placeholder={
                ccLabel
                  ? `Presenting history of ${ccLabel}. Dictate or type directly.`
                  : 'Presenting history — tap 🎙 Dictate to start, or type directly.'
              }
              style={{
                display: 'block', width: '100%', minHeight: 140,
                padding: '10px 14px', border: 'none', resize: 'vertical' as const,
                background: 'transparent', color: 'var(--ink)',
                fontSize: 15, lineHeight: 1.75, fontFamily: 'Georgia, serif',
                outline: 'none', boxSizing: 'border-box' as const,
              }}
            />
            {micOpen && (
              <div style={{
                borderTop: `1px solid ${recording ? 'rgba(220,38,38,0.3)' : 'var(--line)'}`,
                padding: '10px 14px',
                background: recording ? 'rgba(220,38,38,0.03)' : 'rgba(0,180,160,0.03)',
              }}>
                {(fullTranscript || recording) && (
                  <div style={{
                    fontSize: 13, lineHeight: 1.6, color: 'var(--muted)',
                    fontFamily: 'Georgia, serif', maxHeight: 80, overflowY: 'auto',
                    marginBottom: pendingSoap ? 10 : 0,
                  }}>
                    {transcript}
                    {interim && <span style={{ color: 'var(--ink)', opacity: 0.5 }}>{interim}</span>}
                    {recording && !fullTranscript && <span style={{ fontStyle: 'italic' }}>Listening…</span>}
                  </div>
                )}
                {pendingSoap && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#d97706', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      PREVIEW — review then accept
                      {segmentSource && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 8,
                          background: segmentSource === 'cloud' ? 'rgba(59,130,246,.15)' : 'rgba(16,185,129,.15)',
                          color: segmentSource === 'cloud' ? '#2563eb' : '#059669',
                        }}>
                          {segmentSource === 'local' ? '⚡ Local' : segmentSource === 'ollama' ? '🟢 Ollama' : '🤖 Cloud'}
                        </span>
                      )}
                    </div>
                    {([
                      ['HPI', pendingSoap.hpi],
                      ['Assessment', pendingSoap.assessment],
                      ['Plan', pendingSoap.plan],
                      ...Object.entries(pendingSoap.examination ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => [`Exam — ${k}`, v]),
                    ] as [string, string | undefined][]).filter(([, v]) => v?.trim()).map(([label, text]) => (
                      <div key={label} style={{
                        background: 'var(--bg)', borderRadius: 7, padding: '8px 11px',
                        border: '1px solid var(--line)',
                      }}>
                        <div style={{ ...sectionLabel, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink)', fontFamily: 'Georgia, serif' }}>{text}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={acceptSoap}
                        style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none',
                          background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                        ↓ Accept
                      </button>
                      <button type="button" onClick={() => { setPendingSoap(null); setTranscript(''); }}
                        style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid var(--line)',
                          background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
                        Discard
                      </button>
                    </div>
                  </div>
                )}
                {!pendingSoap && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!recording && transcript && !segmenting && (
                      <button type="button" onClick={() => void handleSegment()}
                        style={{ padding: '5px 14px', borderRadius: 6, border: 'none',
                          background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Analyse transcript →
                      </button>
                    )}
                    {!recording && (
                      <button type="button" onClick={() => { setTranscript(''); setVoiceError(null); setMicOpen(false); }}
                        style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
                        Close
                      </button>
                    )}
                    {segmenting && <span style={{ fontSize: 11, color: '#d97706' }}>Analysing…</span>}
                  </div>
                )}
                {voiceError && (
                  <div style={{
                    marginTop: 6, padding: '8px 10px', borderRadius: 6,
                    background: '#fef2f2', border: '1px solid #fca5a5',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#b91c1c', lineHeight: 1.5 }}>{voiceError}</span>
                    <button
                      type="button"
                      onClick={() => { setVoiceError(null); void startRecording(); }}
                      style={{
                        flexShrink: 0, padding: '3px 10px', borderRadius: 5,
                        border: '1px solid #fca5a5', background: '#fff',
                        color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── AI quiet prompt — one at a time ── */}
          {activeReminder && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 8,
              border: `1px solid ${activeReminder.urgency === 'flag' ? 'rgba(217,119,6,0.35)' : 'var(--line)'}`,
              background: activeReminder.urgency === 'flag' ? 'rgba(217,119,6,0.05)' : 'var(--card)',
            }}>
              <span style={{ fontSize: 14, color: activeReminder.urgency === 'flag' ? '#d97706' : 'var(--muted)', flexShrink: 0 }}>
                {activeReminder.urgency === 'flag' ? '◈' : '○'}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{activeReminder.text}</span>
              <button
                type="button"
                onClick={() => setDismissedPrompts(p => [...p, activeReminder.id])}
                style={{ border: 'none', background: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                title="Dismiss"
              >✕</button>
            </div>
          )}

          {/* ── Live DX differential ── */}
          {(pathognomicAlerts.length > 0 || (dxUpdatedAt && ctx.paneTop.length > 0)) && (
            <div style={{
              borderRadius: 9, border: '1px solid var(--line)',
              background: 'var(--card)', padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={sectionLabel}>Differential (from transcript)</div>
              {pathognomicAlerts.map(a => (
                <div key={a.diseaseId} style={{
                  background: a.specificity === 'definitive' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${a.specificity === 'definitive' ? '#fca5a5' : '#fde68a'}`,
                  borderRadius: 7, padding: '5px 10px', fontSize: 12,
                  color: a.specificity === 'definitive' ? '#991b1b' : '#92400e',
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 800 }}>{a.specificity === 'definitive' ? '⚠ Pathognomonic:' : '◈ Strong indicator:'}</span>
                  {a.diseaseLabel}
                  <span style={{ opacity: 0.6, fontStyle: 'italic' }}>— {a.finding}</span>
                </div>
              ))}
              {ctx.paneTop.slice(0, 3).map(r => (
                <div key={r.disease.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 20, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${Math.round(r.probability * 100)}%`,
                      background: r.probability > 0.5 ? '#0d9488' : r.probability > 0.25 ? '#d97706' : '#94a3b8',
                      borderRadius: 5, transition: 'width 0.4s ease',
                    }} />
                    <span style={{
                      position: 'absolute', left: 8, top: 0, bottom: 0,
                      display: 'flex', alignItems: 'center',
                      fontSize: 11, fontWeight: 600,
                      color: r.probability > 0.5 ? '#fff' : 'var(--ink)',
                    }}>
                      {r.disease.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, color: 'var(--muted)', textAlign: 'right' }}>
                    {Math.round(r.probability * 100)}%
                  </span>
                </div>
              ))}
              {(() => {
                const top1 = ctx.paneTop[0];
                if (!top1 || top1.probability < 0.3) return null;
                const proto = getProtocol(top1.disease.id);
                if (!proto) return null;
                const statInvx = proto.investigations.filter(i => i.urgency === 'stat' || i.urgency === 'urgent').slice(0, 3);
                if (!statInvx.length) return null;
                return (
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--ink)' }}>
                    <div style={{ ...sectionLabel, color: '#0d9488', marginBottom: 4 }}>
                      If {top1.disease.label}
                    </div>
                    {statInvx.map(i => (
                      <div key={i.label} style={{ display: 'flex', gap: 5, marginBottom: 2 }}>
                        <span style={{ color: i.urgency === 'stat' ? '#dc2626' : '#d97706', fontWeight: 700 }}>{i.urgency.toUpperCase()}</span>
                        <span>{i.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Phase actions ── */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            paddingTop: 6, borderTop: '1px solid var(--line)',
          }}>
            <button type="button" onClick={enterExam}
              style={{
                padding: '10px 18px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--card)',
                color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
              🩺 Examination →
            </button>
            <button type="button" onClick={enterAssessment}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
              Continue to Assessment →
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          EXAM PHASE
      ════════════════════════════════════════ */}
      {consultPhase === 'exam' && (
        <>
          {/* HPI accordion */}
          <div style={{ borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setHpiCollapsed(c => !c)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 14px',
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--ink)',
              }}
            >
              <span>
                📝 HPI — {hpiNotes.trim()
                  ? hpiNotes.trim().slice(0, 70) + (hpiNotes.trim().length > 70 ? '…' : '')
                  : 'Not documented'}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{hpiCollapsed ? '▼' : '▲'}</span>
            </button>
            {!hpiCollapsed && (
              <textarea
                value={hpiNotes}
                onChange={e => setHpiNotes(e.target.value)}
                style={{
                  display: 'block', width: '100%', padding: '0 14px 12px',
                  border: 'none', background: 'transparent', color: 'var(--ink)',
                  fontSize: 14, lineHeight: 1.7, fontFamily: 'Georgia, serif',
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  minHeight: 80,
                }}
              />
            )}
          </div>

          {/* Examination workspace */}
          <div style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px 8px',
              borderBottom: '1px solid var(--line)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>🩺 Examination</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" onClick={handleDictateClick}
                  disabled={!SPEECH_SUPPORTED && !micOpen}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 7, border: 'none',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: recording ? '#dc2626' : micOpen ? '#0d9488' : 'rgba(13,148,136,0.1)',
                    color: recording ? '#fff' : micOpen ? '#fff' : '#0d9488',
                  }}>
                  <span style={{
                    display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: recording ? '#fff' : 'currentColor',
                    animation: recording ? 'ambPulse 1s ease-in-out infinite' : 'none',
                  }} />
                  {recording ? 'Stop' : '🎙 Dictate'}
                </button>
                <button type="button" onClick={() => { setActiveSection('examination'); onDetailedMode(); }}
                  style={{ fontSize: 11, color: 'var(--muted)', border: '1px solid var(--line)',
                    background: 'none', padding: '4px 9px', borderRadius: 5, cursor: 'pointer' }}>
                  Full Exam ↗
                </button>
              </div>
            </div>

            {/* Exam dictation transcript (shown in exam phase) */}
            {micOpen && fullTranscript && (
              <div style={{
                padding: '8px 14px', borderBottom: '1px solid var(--line)',
                background: recording ? 'rgba(220,38,38,0.03)' : 'rgba(13,148,136,0.03)',
                fontSize: 13, color: 'var(--muted)', fontFamily: 'Georgia, serif', lineHeight: 1.6,
              }}>
                {transcript}
                {interim && <span style={{ opacity: 0.5 }}>{interim}</span>}
                {recording && !fullTranscript && <span style={{ fontStyle: 'italic' }}>Listening…</span>}
              </div>
            )}
            {pendingSoap && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#d97706', letterSpacing: '0.06em' }}>
                  PREVIEW — review then accept
                </div>
                {([
                  ['HPI', pendingSoap.hpi],
                  ...Object.entries(pendingSoap.examination ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => [`Exam — ${k}`, v]),
                ] as [string, string | undefined][]).filter(([, v]) => v?.trim()).map(([label, text]) => (
                  <div key={label} style={{ background: 'var(--bg)', borderRadius: 7, padding: '7px 10px', border: '1px solid var(--line)' }}>
                    <div style={{ ...sectionLabel, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', fontFamily: 'Georgia, serif' }}>{text}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={acceptSoap}
                    style={{ flex: 1, padding: '7px', borderRadius: 7, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    ↓ Accept
                  </button>
                  <button type="button" onClick={() => { setPendingSoap(null); setTranscript(''); }}
                    style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Exam region textareas */}
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                ['General', examGeneral, setExamGeneral],
                ['Abdomen', examAbdomen, setExamAbdomen],
                ['CVS', examCardio, setExamCardio],
                ['Respiratory', examResp, setExamResp],
                ['Extremities', examExtremities, setExamExtremities],
                ['Wound', examWound, setExamWound],
              ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
                <div key={label}>
                  <div style={{ ...sectionLabel, marginBottom: 4 }}>{label}</div>
                  <textarea
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder={label === 'General' ? 'e.g. Alert and oriented, comfortable at rest, no pallor…' : `${label}…`}
                    rows={2}
                    style={drawerTextarea}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Phase nav */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => changePhase('history')}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)',
                background: 'var(--card)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ← History
            </button>
            <button type="button" onClick={enterAssessment}
              style={{ flex: 1, padding: '10px 18px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Continue to Assessment →
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          ASSESSMENT PHASE
      ════════════════════════════════════════ */}
      {consultPhase === 'assessment' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', borderRadius: 7,
            background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.2)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Assessment
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              — Draft pre-populated from collected data. Review and edit before finalising.
            </span>
          </div>

          {/* ── Unified Diagnosis Picker ── */}
          {(() => {
            const activeDx = workingDxId ? DISEASES.find(d => d.id === workingDxId) : null;
            const activeProto = workingDxId ? getProtocol(workingDxId) : null;
            const isSearching = dxSearch.length > 0;
            const searchHits = isSearching
              ? DISEASES.filter(d => d.label.toLowerCase().includes(dxSearch.toLowerCase()) || d.icd10.toLowerCase().includes(dxSearch.toLowerCase())).slice(0, 8)
              : [];
            const listRows = isSearching ? searchHits : suggestedDx.map(r => ({ disease: r.disease, probability: r.probability }));

            return (
              <div style={{ borderRadius: 9, border: `1px solid ${workingDxId ? 'rgba(0,180,160,0.45)' : 'var(--line)'}`, background: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)' }}>
                  <span style={sectionLabel}>Working Diagnosis</span>
                  {activeDx && (
                    <>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{activeDx.label}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--muted)', background: 'var(--bg)', padding: '2px 7px', borderRadius: 5 }}>{activeDx.icd10}</span>
                      <button type="button" onClick={() => setWorkingDxId(null)} style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
                    </>
                  )}
                  {!activeDx && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {suggestedDx.length > 0 ? (ctx.paneTop.length > 0 ? 'probabilistic ranking' : 'symptom-mapped suggestions') : 'search to select'}
                    </span>
                  )}
                </div>

                {/* Search input */}
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
                  <input
                    value={dxSearch}
                    onChange={e => { setDxSearch(e.target.value); setDxDropOpen(true); }}
                    onFocus={() => setDxDropOpen(true)}
                    onBlur={() => setTimeout(() => setDxDropOpen(false), 150)}
                    placeholder={activeDx ? `Change diagnosis — currently ${activeDx.label}` : 'Search diagnosis or ICD-10 code…'}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}
                  />
                </div>

                {/* Ranked list — search results or engine suggestions */}
                {(listRows.length > 0) && (
                  <div style={{ padding: '6px 14px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {isSearching ? (
                      searchHits.map(d => {
                        const isSelected = workingDxId === d.id;
                        return (
                          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7,
                              background: isSelected ? 'rgba(0,180,160,0.08)' : 'var(--bg)',
                              border: isSelected ? '1.5px solid rgba(0,180,160,0.4)' : '1px solid var(--line)' }}>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{d.label}</span>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700 }}>{d.icd10}</span>
                              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{getDiseaseSpecialty(d.id).replace(/_/g, ' ')}</span>
                            </div>
                            <button type="button" onMouseDown={() => { setWorkingDxId(isSelected ? null : d.id); setDxSearch(''); setDxDropOpen(false); }}
                              style={{ flexShrink: 0, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                                background: isSelected ? 'var(--accent)' : 'var(--card)',
                                color: isSelected ? '#fff' : 'var(--muted)', whiteSpace: 'nowrap' as const }}>
                              {isSelected ? '✓ Set' : 'Use →'}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      suggestedDx.map(r => {
                        const isSelected = workingDxId === r.disease.id;
                        return (
                          <div key={r.disease.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button type="button" onClick={() => setWorkingDxId(isSelected ? null : r.disease.id)}
                              style={{ flex: 1, position: 'relative', height: 32, background: 'var(--bg)', borderRadius: 7, overflow: 'hidden',
                                border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--line)', cursor: 'pointer', padding: 0 }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${Math.max(6, Math.round(r.probability * 100))}%`,
                                background: r.probability > 0.5 ? '#0d9488' : r.probability > 0.25 ? '#d97706' : '#94a3b8',
                                borderRadius: 7, transition: 'width 0.3s', opacity: 0.85 }} />
                              <span style={{ position: 'absolute', left: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center',
                                fontSize: 12, fontWeight: 600, color: r.probability > 0.4 ? '#fff' : 'var(--ink)', gap: 7 }}>
                                {r.disease.label}
                                <span style={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.8 }}>{r.disease.icd10}</span>
                              </span>
                              <span style={{ position: 'absolute', right: 9, top: 0, bottom: 0, display: 'flex', alignItems: 'center',
                                fontSize: 11, fontWeight: 700, color: r.probability > 0.4 ? 'rgba(255,255,255,0.85)' : 'var(--muted)' }}>
                                {Math.round(r.probability * 100)}%
                              </span>
                            </button>
                            <button type="button" onClick={() => setWorkingDxId(isSelected ? null : r.disease.id)}
                              style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                                background: isSelected ? 'var(--accent)' : 'var(--card)',
                                color: isSelected ? '#fff' : 'var(--muted)', whiteSpace: 'nowrap' as const }}>
                              {isSelected ? '✓ Set' : 'Use →'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Selected Dx detail — key points, red flags, protocol actions preview */}
                {activeProto && (() => {
                  const IMAGING_KW = ['uss', 'ct ', 'mri', 'mrcp', 'pet', 'cxr', 'x-ray', 'xr ', 'ultrasound', 'scan', 'echo', 'angio', 'radiograph', 'chest x', 'ercp'];
                  const isImaging = (label: string) => IMAGING_KW.some(k => label.toLowerCase().includes(k));
                  const labs    = activeProto.investigations.filter(i => !isImaging(i.label));
                  const imaging = activeProto.investigations.filter(i =>  isImaging(i.label));
                  const immediate = activeProto.management.filter(m => m.phase === 'immediate');
                  const labelStyle: React.CSSProperties = {
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                    color: 'var(--muted)', marginBottom: 3, marginTop: 6,
                  };
                  const urgencyColor = (u: string) => u === 'stat' ? '#ef4444' : u === 'urgent' ? '#d97706' : 'var(--muted)';
                  return (
                    <div style={{ borderTop: '1px solid var(--line)', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {activeProto.keyPoints.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
                          {activeProto.keyPoints.map((k, i) => <div key={i}>• {k}</div>)}
                        </div>
                      )}
                      {activeProto.redFlags.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--coral)', lineHeight: 1.6, marginTop: 4 }}>
                          {activeProto.redFlags.map((r, i) => <div key={i}>⚠ {r}</div>)}
                        </div>
                      )}

                      {/* Protocol Actions — labs */}
                      {labs.length > 0 && (
                        <>
                          <div style={labelStyle}>Labs</div>
                          {labs.map((inv, i) => (
                            <div key={i} style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, display: 'flex', gap: 5, alignItems: 'baseline' }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: urgencyColor(inv.urgency), flexShrink: 0 }}>[{inv.urgency.toUpperCase()}]</span>
                              {inv.label}
                            </div>
                          ))}
                        </>
                      )}

                      {/* Protocol Actions — imaging */}
                      {imaging.length > 0 && (
                        <>
                          <div style={labelStyle}>Imaging</div>
                          {imaging.map((inv, i) => (
                            <div key={i} style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.6, display: 'flex', gap: 5, alignItems: 'baseline' }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: urgencyColor(inv.urgency), flexShrink: 0 }}>[{inv.urgency.toUpperCase()}]</span>
                              {inv.label}
                            </div>
                          ))}
                        </>
                      )}

                      {/* Protocol Actions — immediate management */}
                      {immediate.length > 0 && (
                        <>
                          <div style={labelStyle}>Immediate Management</div>
                          {immediate.map((m, i) => (
                            <div key={i} style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.6 }}>• {m.step}</div>
                          ))}
                        </>
                      )}

                      {activeProto.referral && (
                        <>
                          <div style={labelStyle}>Referral</div>
                          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, lineHeight: 1.6 }}>{activeProto.referral}</div>
                        </>
                      )}

                      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>
                        Full plan with surgical options and follow-up in Plan phase →
                      </div>
                    </div>
                  );
                })()}

                {/* Ask AI footer */}
                <div style={{ borderTop: '1px solid var(--line)', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button type="button" onClick={() => { void aiAssist('assessment'); }}
                    disabled={aiConsulting}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px dashed var(--accent)', background: 'transparent',
                      color: aiConsulting ? 'var(--muted)' : 'var(--accent)', fontSize: 12, fontWeight: 600,
                      cursor: aiConsulting ? 'not-allowed' : 'pointer', letterSpacing: '0.01em',
                      opacity: aiConsulting ? 0.6 : 1 }}>
                    {aiConsulting ? '✦ Consulting AI…' : '✦ Ask AI — complex or unclear presentation'}
                  </button>
                  {aiConsultError && (
                    <div style={{ fontSize: 11, color: 'var(--coral)', paddingLeft: 2 }}>{aiConsultError}</div>
                  )}
                </div>
              </div>
            );
          })()}

          <div style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 0' }}>
              <div style={sectionLabel}>Clinical Notes</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Working Dx and differentials above — add red flags, missing information, or free text here</div>
            </div>
            <textarea
              value={assessment}
              onChange={e => ctx.setAssessment(e.target.value)}
              placeholder="Additional clinical observations, red flags to monitor, missing information…"
              style={{
                display: 'block', width: '100%', minHeight: 180,
                padding: '10px 14px', border: 'none', background: 'transparent',
                color: 'var(--ink)', fontSize: 14, lineHeight: 1.75,
                fontFamily: 'Georgia, serif', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box' as const,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => changePhase('exam')}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)',
                background: 'var(--card)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ← Exam
            </button>
            <button type="button" onClick={enterPlan}
              style={{ flex: 1, padding: '10px 18px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Continue to Plan →
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          PLAN PHASE
      ════════════════════════════════════════ */}
      {consultPhase === 'plan' && (
        <>
          {/* Assessment accordion */}
          <div style={{ borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <button type="button" onClick={() => setAssessAccordion(a => !a)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              <span>🎯 Assessment</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{assessAccordion ? '▲' : '▼'}</span>
            </button>
            {assessAccordion && (
              <div style={{ padding: '0 14px 12px', fontSize: 13, color: 'var(--ink)',
                lineHeight: 1.7, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                {assessment || 'No assessment entered.'}
              </div>
            )}
          </div>

          <div style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 0' }}>
              <div style={sectionLabel}>Management Plan</div>
            </div>
            <textarea
              value={plan}
              onChange={e => ctx.setPlan(e.target.value)}
              placeholder="Management plan — investigations, procedures, referrals, medications, follow-up, safety-net…"
              style={{
                display: 'block', width: '100%', minHeight: 280,
                padding: '10px 14px', border: 'none', background: 'transparent',
                color: 'var(--ink)', fontSize: 14, lineHeight: 1.75,
                fontFamily: 'Georgia, serif', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => changePhase('assessment')}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)',
                background: 'var(--card)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ← Assessment
            </button>
            <button type="button" onClick={onFinalise}
              style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '2px solid #0d9488',
                background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              📋 Complete & Summary
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes ambPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}

// ── Prior Visit Baseline Strip ────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function PriorVisitStrip({ summary: s }: { summary: PriorEncounterSummary }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = s.encounterType.replace(/_/g, ' ');

  // Compact vital pills for the always-visible header strip
  const headerVitals = s.vitals ? (() => {
    const v = s.vitals;
    const items: string[] = [];
    if (v.sbp !== null && v.dbp !== null) items.push(`BP ${v.sbp}/${v.dbp}`);
    if (v.hr !== null) items.push(`HR ${v.hr}`);
    if (v.weightKg !== null) items.push(`${v.weightKg} kg`);
    if (v.spo2 !== null) items.push(`SpO₂ ${v.spo2}%`);
    return items.join(' · ');
  })() : null;

  return (
    <div style={{
      borderRadius: 10,
      border: '1px solid #bae6fd',
      background: '#f0f9ff',
      padding: '10px 14px',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase',
              color: '#0284c7', background: '#e0f2fe', borderRadius: 5, padding: '2px 7px', flexShrink: 0,
            }}>
              Prior visit
            </span>
            <span style={{ fontWeight: 700, color: '#0c4a6e', fontSize: 13 }}>
              {fmtDate(s.encounterDate)}
            </span>
            <span style={{ color: '#64748b', fontSize: 12 }}>{typeLabel}</span>
            {s.chiefComplaint && (
              <span style={{ color: '#475569', fontSize: 12 }}>· {s.chiefComplaint}</span>
            )}
          </div>
          {headerVitals && !expanded && (
            <div style={{ fontSize: 11, color: '#0369a1', paddingLeft: 2 }}>
              {headerVitals}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{ fontSize: 11, color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}
        >
          {expanded ? 'Hide ▲' : 'Show ▼'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.assessment && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 3 }}>
                Assessment
              </div>
              <div style={{ fontSize: 12, color: '#1e293b', whiteSpace: 'pre-wrap', background: '#fff', borderRadius: 6, padding: '6px 10px', border: '1px solid #e0f2fe' }}>
                {s.assessment}
              </div>
            </div>
          )}
          {s.plan && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 3 }}>
                Plan
              </div>
              <div style={{ fontSize: 12, color: '#1e293b', whiteSpace: 'pre-wrap', background: '#fff', borderRadius: 6, padding: '6px 10px', border: '1px solid #e0f2fe' }}>
                {s.plan}
              </div>
            </div>
          )}
          {s.medications.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 3 }}>
                Medications at last visit
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {s.medications.map(m => (
                  <span key={m} style={{ fontSize: 11, background: '#fff', border: '1px solid #bae6fd', borderRadius: 5, padding: '2px 8px', color: '#0c4a6e' }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
          {s.vitals && (() => {
            const v = s.vitals;
            const fmt = (n: number | null, unit: string, decimals = 0) =>
              n !== null ? `${decimals ? n.toFixed(decimals) : n} ${unit}` : null;
            const pills: { label: string; value: string; danger?: boolean; warn?: boolean }[] = [
              v.sbp !== null && v.dbp !== null
                ? { label: 'BP', value: `${v.sbp}/${v.dbp}`, danger: v.sbp > 160 || v.sbp < 90, warn: v.sbp >= 140 }
                : null,
              v.hr !== null ? { label: 'HR', value: `${v.hr} bpm`, danger: v.hr > 120 || v.hr < 50 } : null,
              v.spo2 !== null ? { label: 'SpO₂', value: `${v.spo2}%`, danger: v.spo2 < 94 } : null,
              v.tempC !== null ? { label: 'T', value: `${v.tempC}°C`, warn: v.tempC >= 38, danger: v.tempC >= 39 } : null,
              v.rr !== null ? { label: 'RR', value: fmt(v.rr, '/min')!, danger: v.rr > 24 } : null,
              v.weightKg !== null ? { label: 'Wt', value: fmt(v.weightKg, 'kg', 1)! } : null,
              v.bmi !== null ? { label: 'BMI', value: fmt(v.bmi, '', 1)!, warn: v.bmi >= 30, danger: v.bmi >= 35 } : null,
            ].filter((x): x is NonNullable<typeof x> => x !== null);
            if (!pills.length) return null;
            return (
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 5 }}>
                  Baseline vitals at prior visit
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {pills.map(p => (
                    <span key={p.label} style={{
                      fontSize: 11, borderRadius: 5, padding: '2px 8px',
                      background: p.danger ? '#fee2e2' : p.warn ? '#fef3c7' : '#fff',
                      border: `1px solid ${p.danger ? '#fca5a5' : p.warn ? '#fde68a' : '#bae6fd'}`,
                      color: p.danger ? '#991b1b' : p.warn ? '#92400e' : '#0c4a6e',
                      fontWeight: 600,
                    }}>
                      <span style={{ opacity: 0.7, fontWeight: 400 }}>{p.label} </span>{p.value}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
          {s.allergies && (
            <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
              ⚠ Allergies on record: {s.allergies}
            </div>
          )}
          {s.surgicalHistory.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 3 }}>
                Surgical history
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>{s.surgicalHistory.join(' · ')}</div>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>
            Read-only — from prior encounter record. Confirm with patient before relying on this data.
          </div>
        </div>
      )}
    </div>
  );
}
