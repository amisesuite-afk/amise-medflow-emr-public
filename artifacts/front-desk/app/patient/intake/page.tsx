'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

const TEAL = '#0d9488';
const API  = process.env.NEXT_PUBLIC_API_URL ?? 'https://amise-medflow-api.onrender.com';

// ── Types ─────────────────────────────────────────────────────────────────────

type VisitType = 'surgical' | 'endoscopy' | 'followup' | 'unsure';
type Screen    = 'visit' | 'complaint' | 'specifics' | 'detail' | 'final' | 'bailout' | 'done';

interface Step3Answers {
  fattyFoodWorse?: boolean; painRadiates?: boolean; fever?: boolean; jaundice?: boolean;
  burningHungry?: boolean; wakesAtNight?: boolean; blackBlood?: boolean; nsaids?: boolean;
  bloodColour?: 'bright' | 'dark'; bloodLocation?: 'paper' | 'bowl';
  bowelChange?: boolean; familyHistoryCancer?: boolean;
  dysphagiaDuration?: string; weightLossDue?: boolean; regurgitation?: boolean;
  reducible?: 'yes' | 'no' | 'sometimes'; stuck?: boolean;
  lastScope?: 'never' | '1-5yr' | 'over5yr'; familyHistoryColon?: boolean;
  severity?: number; durationDays?: string;
}

interface DetailQ {
  id: string;
  question: string;
  hint?: string;
  type: 'yesno' | 'severity' | 'duration' | 'bloodcolour' | 'reducible';
  stateKey?: keyof Step3Answers;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const SURGICAL_COMPLAINTS = [
  { value: 'abdominal-pain',  label: 'Abdominal pain',          icon: '🫃' },
  { value: 'lump',            label: 'Lump or swelling',        icon: '🔵' },
  { value: 'hernia',          label: 'Hernia',                  icon: '🔺' },
  { value: 'bowel-change',    label: 'Change in bowel habits',  icon: '🔄' },
  { value: 'rectal-bleeding', label: 'Rectal bleeding',         icon: '🔴' },
  { value: 'weight-loss',     label: 'Unexplained weight loss', icon: '⚖️' },
  { value: 'other',           label: 'Something else',          icon: '💬' },
];

const ENDOSCOPY_COMPLAINTS = [
  { value: 'heartburn',       label: 'Heartburn / acid reflux',       icon: '🔥' },
  { value: 'swallowing',      label: 'Difficulty swallowing',         icon: '🤐' },
  { value: 'stomach-pain',    label: 'Stomach pain / possible ulcer', icon: '🌀' },
  { value: 'screening',       label: 'Colonoscopy screening',         icon: '🔬' },
  { value: 'rectal-bleeding', label: 'Rectal bleeding',               icon: '🔴' },
  { value: 'other',           label: 'Something else',                icon: '💬' },
];

const ABDOMEN_LOCATIONS = [
  { value: 'upper-right',    label: 'Upper right (below ribs)',            track: 'gallbladder' },
  { value: 'upper-centre',   label: 'Upper centre / left (stomach area)',  track: 'gastric' },
  { value: 'lower-right',    label: 'Lower right',                         track: 'appendix' },
  { value: 'periumbilical',  label: 'Around the belly button',             track: 'periumbilical' },
  { value: 'diffuse',        label: 'All over / moves around',             track: 'diffuse' },
];
const LUMP_LOCATIONS = [
  { value: 'groin',   label: 'Groin / inner thigh', track: 'groin-lump' },
  { value: 'abdomen', label: 'Abdomen / belly',     track: 'abdominal-lump' },
  { value: 'neck',    label: 'Neck / throat',       track: 'neck-lump' },
  { value: 'other',   label: 'Other location',      track: 'other-lump' },
];
const HERNIA_TYPES = [
  { value: 'inguinal',   label: 'Groin (inguinal)',                 track: 'inguinal-hernia' },
  { value: 'umbilical',  label: 'Belly button (umbilical)',         track: 'umbilical-hernia' },
  { value: 'incisional', label: 'Old scar / previous surgery site', track: 'incisional-hernia' },
  { value: 'unsure',     label: 'Not sure',                        track: 'hernia-unsure' },
];
const BOWEL_CHANGES = [
  { value: 'looser',      label: 'More frequent / looser stools',              track: 'diarrhoea' },
  { value: 'harder',      label: 'Less frequent / harder stools',              track: 'constipation' },
  { value: 'alternating', label: 'Alternating diarrhoea and constipation',     track: 'ibs-like' },
  { value: 'ribbon',      label: 'Ribbon-thin or pencil-thin stools',          track: 'mass-effect' },
];
const GERD_FREQUENCY = [
  { value: 'mild',     label: 'Occasional (1–2 times per week)', track: 'mild-gerd' },
  { value: 'moderate', label: 'Several times per week',          track: 'gerd' },
  { value: 'daily',    label: 'Daily or constant',               track: 'severe-gerd' },
];
const DYSPHAGIA_TYPE = [
  { value: 'solids-only', label: 'Difficulty with solids, OK with liquids', track: 'mechanical-dysphagia' },
  { value: 'both',        label: 'Difficulty with both solids and liquids',  track: 'severe-dysphagia' },
  { value: 'pain',        label: 'Painful swallowing',                       track: 'odynophagia' },
];
const SCOPE_HISTORY = [
  { value: 'never',   label: 'Never had a colonoscopy', track: 'routine-screening' },
  { value: '1-5yr',   label: 'Had one 1–5 years ago',   track: 'surveillance' },
  { value: 'over5yr', label: 'More than 5 years ago',   track: 'overdue-screening' },
];

function getStep2Options(complaint: string) {
  switch (complaint) {
    case 'abdominal-pain': return { title: 'Where is the pain?',        options: ABDOMEN_LOCATIONS, hint: 'Point to the area that bothers you most.' };
    case 'lump':           return { title: 'Where is the lump?',        options: LUMP_LOCATIONS,    hint: 'Select the location closest to where you feel it.' };
    case 'hernia':         return { title: 'Which type of hernia?',     options: HERNIA_TYPES,      hint: '' };
    case 'bowel-change':   return { title: 'What kind of change?',      options: BOWEL_CHANGES,     hint: '' };
    case 'heartburn':      return { title: 'How often does it happen?', options: GERD_FREQUENCY,    hint: '' };
    case 'swallowing':     return { title: 'What type of difficulty?',  options: DYSPHAGIA_TYPE,    hint: '' };
    case 'screening':      return { title: 'Last colonoscopy?',         options: SCOPE_HISTORY,     hint: '' };
    default: return null;
  }
}

function needsStep2(complaint: string) {
  return ['abdominal-pain','lump','hernia','bowel-change','heartburn','swallowing','screening'].includes(complaint);
}

function getDetailQuestions(visitType: VisitType | '', complaintTrack: string, complaint: string): DetailQ[] {
  if (visitType === 'followup' || visitType === 'unsure') return [];
  const qs: DetailQ[] = [];
  const isScreening      = complaintTrack.includes('screening') || complaintTrack === 'surveillance' || complaint === 'screening';
  const isGallbladder    = complaintTrack === 'gallbladder';
  const isGastric        = ['gastric','peptic-ulcer','stomach-pain'].includes(complaintTrack);
  const isRectalBleeding = ['rectal-bleeding','lower-gi-bleeding','endo-rectal-bleeding'].includes(complaintTrack) || complaint === 'rectal-bleeding';
  const isDysphagia      = ['mechanical-dysphagia','severe-dysphagia','odynophagia','swallowing'].includes(complaintTrack);
  const isHernia         = complaintTrack.includes('hernia');
  const isWeightLoss     = complaint === 'weight-loss' || complaintTrack === 'weight-loss';
  const isAppendix       = complaintTrack === 'appendix';
  const isBowel          = ['diarrhoea','constipation','ibs-like','mass-effect','bowel-change'].includes(complaintTrack);
  // "How severe is your discomfort?" only fits complaints that are
  // themselves a pain/discomfort symptom — weight loss, rectal bleeding and
  // bowel-habit changes get their own clinically-relevant yes/no questions
  // below instead of a pain score that doesn't describe what they reported.
  const isPainless       = isWeightLoss || isRectalBleeding || (isBowel && !isHernia) || isScreening;

  if (!isPainless)
    qs.push({ id:'severity', question:'How severe is your discomfort?', hint:'1 = very mild · 10 = worst imaginable', type:'severity', stateKey:'severity' });
  qs.push({ id:'duration', question:'How long have you had this?', type:'duration', stateKey:'durationDays' });

  if (isGallbladder) {
    qs.push({ id:'fatty',    question:'Is the pain worse after eating fatty or greasy food?',    type:'yesno', stateKey:'fattyFoodWorse' });
    qs.push({ id:'radiates', question:'Does the pain spread to your back or right shoulder?',    type:'yesno', stateKey:'painRadiates' });
    qs.push({ id:'fever',    question:'Have you had fever, chills, or shivering?',              type:'yesno', stateKey:'fever' });
    qs.push({ id:'jaundice', question:'Have you noticed yellowing of your eyes or skin?',       type:'yesno', stateKey:'jaundice' });
  }
  if (isAppendix) {
    qs.push({ id:'fever-a',  question:'Have you had fever, chills, or shivering?',              type:'yesno', stateKey:'fever' });
    qs.push({ id:'nausea',   question:'Have you had nausea or vomiting with the pain?',         type:'yesno', stateKey:'blackBlood' });
  }
  if (isGastric) {
    qs.push({ id:'burning',  question:'Is it a burning feeling when your stomach is empty or before meals?', type:'yesno', stateKey:'burningHungry' });
    qs.push({ id:'night',    question:'Does it wake you at night?',                             type:'yesno', stateKey:'wakesAtNight' });
    qs.push({ id:'bl-stool', question:'Have you noticed blood in your vomit or black / tarry stools?', type:'yesno', stateKey:'blackBlood' });
    qs.push({ id:'nsaids',   question:'Do you regularly take aspirin, ibuprofen, or anti-inflammatory tablets?', type:'yesno', stateKey:'nsaids' });
  }
  if (isRectalBleeding) {
    qs.push({ id:'bl-col',   question:'What colour is the blood?',                              type:'bloodcolour', stateKey:'bloodColour' });
    qs.push({ id:'bowel-rb', question:'Have your bowel habits changed recently?',               type:'yesno', stateKey:'bowelChange' });
    qs.push({ id:'fam-ca',   question:'Does anyone in your family have a history of bowel or colon cancer?', type:'yesno', stateKey:'familyHistoryCancer' });
  }
  if (isDysphagia) {
    qs.push({ id:'wl-dys',   question:'Are you losing weight because eating has become difficult?', type:'yesno', stateKey:'weightLossDue' });
    qs.push({ id:'regurg',   question:'Do you sometimes regurgitate undigested food?',          type:'yesno', stateKey:'regurgitation' });
  }
  if (isHernia) {
    qs.push({ id:'reducible',question:'Can you push the hernia back in?',                       type:'reducible', stateKey:'reducible' });
    qs.push({ id:'stuck',    question:'Has it ever been stuck out and you could not push it back in?', type:'yesno', stateKey:'stuck' });
  }
  if (isScreening)
    qs.push({ id:'fam-col',  question:'Does anyone in your family have a history of colon cancer or polyps?', type:'yesno', stateKey:'familyHistoryColon' });
  if (isWeightLoss) {
    qs.push({ id:'appetite', question:'Have you also had a change in your appetite?',           type:'yesno', stateKey:'burningHungry' });
    qs.push({ id:'bowel-wl', question:'Have you noticed any bowel changes alongside the weight loss?', type:'yesno', stateKey:'bowelChange' });
  }
  if (isBowel && !isRectalBleeding) {
    qs.push({ id:'blood-b',  question:'Have you noticed any blood in your stool?',             type:'yesno', stateKey:'blackBlood' });
    qs.push({ id:'fam-bowel',question:'Does anyone in your family have a history of bowel cancer?', type:'yesno', stateKey:'familyHistoryCancer' });
  }
  return qs;
}

function computeComplexityScore(
  visitType: string, symptoms: string[], durationDays: number | null,
  severity: number | null, priorTreatment: string, isReferral: boolean, complaintTrack: string,
): number {
  let s = 0;
  if (symptoms.length > 3) s += 2;
  if (durationDays && durationDays >= 90) s += 2;
  if (severity && severity >= 7) s += 2;
  const hasWeightLoss     = symptoms.some(x => x.toLowerCase().includes('weight'));
  const hasRectalBleeding = symptoms.some(x => x.toLowerCase().includes('bleed'));
  const hasBowelChange    = symptoms.some(x => x.toLowerCase().includes('bowel'));
  const hasJaundice       = symptoms.some(x => x.toLowerCase().includes('jaundice'));
  if ((hasWeightLoss && hasRectalBleeding) || (hasWeightLoss && hasBowelChange)) s += 3;
  if (hasJaundice) s += 2;
  if (['mechanical-dysphagia','severe-dysphagia','mass-effect'].includes(complaintTrack)) s += 3;
  if (priorTreatment.trim()) s += 2;
  if (isReferral) s += 1;
  if (visitType === 'unsure') s += 3;
  return Math.min(s, 15);
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function Fade({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.14s', willChange: 'opacity' }}>
      {children}
    </div>
  );
}

function Dots({ phase }: { phase: 0 | 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
      {([0, 1, 2, 3] as const).map(i => (
        <div key={i} style={{
          height: 6, borderRadius: 3,
          width: i === phase ? 22 : 6,
          background: i <= phase ? TEAL : '#e2e8f0',
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  );
}

function OptionCard({ icon, label, sub, onClick, active, isPicking }: {
  icon?: string; label: string; sub?: string;
  onClick: () => void; active?: boolean; isPicking?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '15px 18px', marginBottom: 10,
        background: active || isPicking ? `${TEAL}10` : '#fff',
        border: active || isPicking ? `2px solid ${TEAL}` : '1.5px solid #e2e8f0',
        borderRadius: 12, cursor: 'pointer', textAlign: 'left',
        transform: isPicking ? 'scale(0.985)' : 'scale(1)',
        transition: 'all 0.12s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {icon && <span style={{ fontSize: 22, flexShrink: 0, width: 28, textAlign: 'center' }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sub}</div>}
      </div>
      {!sub && !active  && <span style={{ color: '#d1d5db', fontSize: 16, flexShrink: 0 }}>›</span>}
      {active && !isPicking && <span style={{ color: TEAL, fontSize: 16, flexShrink: 0 }}>✓</span>}
    </button>
  );
}

function BigYesNo({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
      {([{ l: 'Yes', v: true }, { l: 'No', v: false }] as const).map(({ l, v }) => {
        const active = value === v;
        return (
          <button key={l} type="button" onClick={() => onChange(v)}
            style={{
              flex: 1, padding: '20px 12px', borderRadius: 12,
              border: active ? `2px solid ${TEAL}` : '1.5px solid #e2e8f0',
              background: active ? `${TEAL}12` : '#fff',
              color: active ? TEAL : '#374151',
              fontSize: 18, fontWeight: active ? 800 : 500, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

function SeverityPicker({ value, onChange }: { value: number | undefined; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const active = value === n;
        const clr = n <= 3 ? '#065f46' : n <= 6 ? '#92400e' : '#991b1b';
        const bg  = n <= 3 ? '#d1fae5' : n <= 6 ? '#fef3c7' : '#fee2e2';
        return (
          <button key={n} type="button" onClick={() => onChange(n)}
            style={{
              width: 44, height: 44, borderRadius: 9,
              border: active ? `2px solid ${clr}` : '1.5px solid #e2e8f0',
              background: active ? bg : '#f8fafc',
              color: active ? clr : '#64748b',
              fontSize: 15, fontWeight: active ? 800 : 400, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {n}
          </button>
        );
      })}
    </div>
  );
}

function NextBtn({ label = 'Continue →', onClick, disabled }: { label?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        width: '100%', marginTop: 22, padding: '15px', borderRadius: 10,
        border: 'none', background: disabled ? '#e2e8f0' : TEAL,
        color: disabled ? '#94a3b8' : '#fff',
        fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>
      {label}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ background: 'none', border: 'none', color: TEAL, fontSize: 20, cursor: 'pointer', padding: 0, marginRight: 12 }}
      aria-label="Back">←</button>
  );
}

function SkipLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        width: '100%', marginTop: 14, padding: '12px', borderRadius: 8,
        border: '1px dashed #cbd5e1', background: 'transparent',
        color: '#94a3b8', fontSize: 13, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>
      {"I'd rather discuss this with the doctor →"}
    </button>
  );
}

function QTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: '#1e293b', lineHeight: 1.3, letterSpacing: '-0.01em' }}>{children}</p>;
}
function QHint({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>{children}</p>;
}

// Tip + soft word-count guidance for free-text "describe in your own words" fields.
// Most phone keyboards have a built-in microphone for dictation — no custom
// speech-recognition code needed (and it works inside in-app browsers too).
function FreeTextAid({ text }: { text: string }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
      <span>🎤 Prefer to talk? Tap the microphone on your keyboard to dictate.</span>
      <span style={{ flexShrink: 0, color: words > 150 ? '#d97706' : '#cbd5e1' }}>{words} words</span>
    </div>
  );
}

const inputSty = {
  width: '100%', padding: '13px 14px', border: '1.5px solid #d1d5db', borderRadius: 10,
  fontSize: 15, color: '#1e293b', boxSizing: 'border-box' as const, fontFamily: 'inherit',
  WebkitAppearance: 'none' as const,
};
const textareaSty = { ...inputSty, resize: 'vertical' as const, minHeight: 80, lineHeight: '1.6' };

// ── Main component ────────────────────────────────────────────────────────────

export default function IntakePage() {
  const router = useRouter();
  const sb     = getPatientClient();

  const [patientId, setPatientId]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible]       = useState(true);
  const [picking, setPicking]       = useState('');
  const [screen, setScreen]         = useState<Screen>('visit');
  const [detailIdx, setDetailIdx]   = useState(0);
  const [priorIntakes, setPriorIntakes] = useState<{ id: string; submitted_at: string; chief_complaint: string | null }[]>([]);

  const [visitType, setVisitType]   = useState<VisitType | ''>('');
  const [complaint, setComplaint]   = useState('');
  const [unsureText, setUnsureText] = useState('');
  const [specifics, setSpecifics]   = useState('');
  const [complaintTrack, setTrack]  = useState('');
  const [s3, setS3]                 = useState<Step3Answers>({});

  const [currentMeds, setCurrentMeds]       = useState('');
  const [allergies, setAllergies]           = useState('');
  const [isReferral, setIsReferral]         = useState<boolean | null>(null);
  const [referralDoc, setReferralDoc]       = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [bailName, setBailName]   = useState('');
  const [bailPhone, setBailPhone] = useState('');

  const setS3Field = useCallback(<K extends keyof Step3Answers>(k: K, v: Step3Answers[K]) => {
    setS3(prev => ({ ...prev, [k]: v }));
  }, []);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }
      const { data: pat } = await sb.from('patients').select('id, full_name').single();
      if (!pat) { setLoading(false); return; }
      setPatientId(pat.id);
      setBailName(pat.full_name ?? '');
      const { data: intakes } = await sb
        .from('patient_intake')
        .select('id, submitted_at, chief_complaint')
        .eq('patient_id', pat.id)
        .order('submitted_at', { ascending: false })
        .limit(3);
      setPriorIntakes(intakes ?? []);
      setLoading(false);
    })();
  }, [router, sb]);

  function fade(fn: () => void) {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 140);
  }

  function pickAndAdvance(id: string, next: () => void) {
    setPicking(id);
    setTimeout(() => { setPicking(''); fade(next); }, 220);
  }

  function goBack() {
    fade(() => {
      if (screen === 'complaint') { setScreen('visit'); }
      else if (screen === 'specifics') { setScreen('complaint'); }
      else if (screen === 'detail') {
        if (detailIdx > 0) setDetailIdx(i => i - 1);
        else if (specifics) setScreen('specifics');
        else setScreen('complaint');
      }
      else if (screen === 'final') {
        const qs = getDetailQuestions(visitType, complaintTrack, complaint);
        if (qs.length > 0) { setDetailIdx(qs.length - 1); setScreen('detail'); }
        else if (visitType === 'followup') setScreen('visit');
        else if (specifics) setScreen('specifics');
        else setScreen('complaint');
      }
      else if (screen === 'bailout') { setScreen('final'); }
    });
  }

  async function handleSubmit() {
    if (!patientId || submitting) return;
    setSubmitting(true);

    const symptomsList: string[] = [];
    if (s3.jaundice)   symptomsList.push('Jaundice');
    if (s3.fever)      symptomsList.push('Fever');
    if (s3.blackBlood) symptomsList.push('Blood in stool');
    if (complaint === 'rectal-bleeding') symptomsList.push('Rectal bleeding');
    if (complaint === 'weight-loss')     symptomsList.push('Unexplained weight loss');
    if (complaint === 'bowel-change')    symptomsList.push('Change in bowel habits');
    if (s3.bowelChange)   symptomsList.push('Change in bowel habits');
    if (s3.weightLossDue) symptomsList.push('Weight loss (dysphagia-related)');

    const durationDays = s3.durationDays ? parseInt(s3.durationDays) : null;
    const complexity = computeComplexityScore(
      visitType, symptomsList, durationDays,
      s3.severity ?? null, currentMeds, isReferral === true, complaintTrack,
    );

    const chiefComplaint =
      visitType === 'unsure'   ? unsureText.trim() :
      visitType === 'followup' ? 'Follow-up visit' :
      SURGICAL_COMPLAINTS.find(c => c.value === complaint)?.label
      ?? ENDOSCOPY_COMPLAINTS.find(c => c.value === complaint)?.label
      ?? complaint;

    const referralReason = isReferral === true
      ? (referralDoc.trim() ? `Referred by: ${referralDoc.trim()}` : 'Yes — referring doctor not specified')
      : isReferral === false ? 'Self-referred' : null;

    const step3Notes = Object.entries(s3)
      .filter(([k]) => !['severity','durationDays'].includes(k))
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join('; ');

    const { data: insertData, error } = await sb
      .from('patient_intake')
      .insert({
        patient_id:       patientId,
        visit_type:       visitType || null,
        complaint_track:  complaintTrack || null,
        complexity_score: complexity,
        chief_complaint:  chiefComplaint || null,
        symptoms:         symptomsList.length > 0 ? symptomsList : null,
        duration_days:    durationDays,
        severity:         s3.severity ?? null,
        prior_treatment:  null,
        current_meds:     currentMeds.trim() || null,
        allergies_note:   allergies.trim() || null,
        referral_reason:  referralReason,
        additional_notes: [
          step3Notes,
          specifics ? `Location/specifics: ${specifics}` : '',
          additionalNotes.trim(),
        ].filter(Boolean).join('\n') || null,
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (error || !insertData) {
      alert('Could not submit. Please check your connection and try again.');
      return;
    }

    fetch(`${API}/api/patient/intake-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intake_id: insertData.id }),
    }).catch(() => {});

    fade(() => setScreen('done'));
  }

  async function handleBailout() {
    if (!patientId || submitting) return;
    setSubmitting(true);
    const { data: insertData } = await sb
      .from('patient_intake')
      .insert({
        patient_id:       patientId,
        visit_type:       visitType || 'unsure',
        complaint_track:  'minimal',
        complexity_score: 0,
        chief_complaint:  bailName ? `Minimal intake — ${bailName}` : 'Minimal intake',
        additional_notes: bailPhone ? `Patient prefers call at: ${bailPhone}` : 'Patient preferred to discuss with doctor',
      })
      .select('id')
      .single();
    setSubmitting(false);
    if (insertData) {
      fetch(`${API}/api/patient/intake-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intake_id: insertData.id }),
      }).catch(() => {});
    }
    fade(() => setScreen('done'));
  }

  function screenPhase(): 0 | 1 | 2 | 3 {
    if (screen === 'visit') return 0;
    if (screen === 'complaint' || screen === 'specifics') return 1;
    if (screen === 'detail') return 2;
    return 3;
  }

  // ── Screens ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: 64, color: '#94a3b8', fontSize: 14 }}>Loading…</div>;
  }

  if (screen === 'done') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '44px 28px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: '#1e293b' }}>Thank you!</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            Your pre-visit form has been submitted. Our team will review it before your consultation.
          </p>
          <button type="button" onClick={() => router.push('/patient')}
            style={{ padding: '14px 32px', background: TEAL, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Back to portal
          </button>
        </div>
        {priorIntakes.length > 0 && (
          <div style={{ marginTop: 32, textAlign: 'left' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Previous submissions</p>
            {priorIntakes.map(i => (
              <div key={i.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(i.submitted_at).toLocaleDateString('en-LC', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{i.chief_complaint ?? 'No complaint recorded'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (screen === 'bailout') {
    return (
      <Fade visible={visible}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <BackBtn onClick={goBack} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e293b' }}>Just book my appointment</h1>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px', marginBottom: 14 }}>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
            No problem. Leave your preferred contact details and we will reach out to schedule your visit.
          </p>
          <label style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>Your name</label>
          <input style={{ ...inputSty, marginBottom: 14 }} value={bailName} onChange={e => setBailName(e.target.value)} placeholder="Full name" />
          <label style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>Best phone number to reach you</label>
          <input style={inputSty} value={bailPhone} onChange={e => setBailPhone(e.target.value)} placeholder="+1 758…" type="tel" />
        </div>
        <button type="button" onClick={() => void handleBailout()} disabled={submitting || !bailName.trim()}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: !bailName.trim() ? '#e2e8f0' : TEAL, color: !bailName.trim() ? '#94a3b8' : '#fff', fontSize: 15, fontWeight: 700, cursor: !bailName.trim() ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'Saving…' : 'Submit — we will contact you'}
        </button>
      </Fade>
    );
  }

  if (screen === 'visit') {
    const cards = [
      { value: 'surgical',  label: 'Surgical Consultation', sub: 'Abdominal, hernia, lump, bowel, weight loss', icon: '🔪' },
      { value: 'endoscopy', label: 'Endoscopy / Scope',     sub: 'Colonoscopy, gastroscopy, heartburn, swallowing', icon: '🔬' },
      { value: 'followup',  label: 'Follow-up visit',       sub: 'Returning for results or post-op review', icon: '📋' },
      { value: 'unsure',    label: 'Not sure',              sub: 'Describe your concern and we will guide you', icon: '💬' },
    ];
    return (
      <Fade visible={visible}>
        <Dots phase={0} />
        <QTitle>Pre-Visit Form</QTitle>
        <QHint>A few short questions so Dr Kabiye can prepare for your visit.</QHint>
        <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Why are you coming in?</p>
        {cards.map(c => (
          <OptionCard
            key={c.value} icon={c.icon} label={c.label} sub={c.sub}
            active={visitType === c.value} isPicking={picking === c.value}
            onClick={() => pickAndAdvance(c.value, () => {
              setVisitType(c.value as VisitType);
              if (c.value === 'followup') { setTrack('followup'); setScreen('final'); }
              else setScreen('complaint');
            })}
          />
        ))}
        <SkipLink onClick={() => fade(() => setScreen('bailout'))} />
      </Fade>
    );
  }

  if (screen === 'complaint') {
    if (visitType === 'unsure') {
      return (
        <Fade visible={visible}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}><BackBtn onClick={goBack} /></div>
          <Dots phase={1} />
          <QTitle>Describe your concern</QTitle>
          <QHint>In your own words — as much or as little as you like.</QHint>
          <textarea
            style={textareaSty} rows={5} value={unsureText}
            onChange={e => setUnsureText(e.target.value)}
            placeholder="e.g. I've had pain in my stomach for a few months and two other doctors haven't found the cause…"
          />
          <FreeTextAid text={unsureText} />
          <div style={{ height: 12 }} />
          <NextBtn onClick={() => { setTrack('unsure'); fade(() => setScreen('final')); }} disabled={!unsureText.trim()} />
          <SkipLink onClick={() => fade(() => setScreen('bailout'))} />
        </Fade>
      );
    }

    const complaints = visitType === 'surgical' ? SURGICAL_COMPLAINTS : ENDOSCOPY_COMPLAINTS;
    return (
      <Fade visible={visible}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}><BackBtn onClick={goBack} /></div>
        <Dots phase={1} />
        <QTitle>What is your main concern?</QTitle>
        <QHint>Select the one that fits best.</QHint>
        {complaints.map(c => (
          <OptionCard
            key={c.value} icon={c.icon} label={c.label}
            active={complaint === c.value} isPicking={picking === c.value}
            onClick={() => {
              setComplaint(c.value);
              if (c.value === 'other') {
                setUnsureText('');
              } else if (needsStep2(c.value)) {
                pickAndAdvance(c.value, () => setScreen('specifics'));
              } else {
                pickAndAdvance(c.value, () => {
                  setTrack(c.value);
                  const qs = getDetailQuestions(visitType, c.value, c.value);
                  if (qs.length > 0) { setDetailIdx(0); setScreen('detail'); }
                  else setScreen('final');
                });
              }
            }}
          />
        ))}
        {complaint === 'other' && (
          <div style={{ marginTop: 4 }}>
            <textarea style={textareaSty} rows={3} value={unsureText} onChange={e => setUnsureText(e.target.value)} placeholder="Describe your main concern…" />
            <FreeTextAid text={unsureText} />
            <div style={{ height: 12 }} />
            <NextBtn onClick={() => { setTrack('other'); setDetailIdx(0); fade(() => setScreen('detail')); }} disabled={!unsureText.trim()} />
          </div>
        )}
        <SkipLink onClick={() => fade(() => setScreen('bailout'))} />
      </Fade>
    );
  }

  if (screen === 'specifics') {
    const step2 = getStep2Options(complaint);
    if (!step2) {
      const qs = getDetailQuestions(visitType, complaintTrack, complaint);
      if (qs.length > 0) { setDetailIdx(0); setScreen('detail'); } else setScreen('final');
      return null;
    }
    return (
      <Fade visible={visible}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}><BackBtn onClick={goBack} /></div>
        <Dots phase={1} />
        <QTitle>{step2.title}</QTitle>
        {step2.hint && <QHint>{step2.hint}</QHint>}
        {step2.options.map(o => (
          <OptionCard
            key={o.value} label={o.label}
            active={specifics === o.value} isPicking={picking === o.value}
            onClick={() => pickAndAdvance(o.value, () => {
              const track = o.track ?? o.value;
              setSpecifics(o.value);
              setTrack(track);
              const qs = getDetailQuestions(visitType, track, complaint);
              if (qs.length > 0) { setDetailIdx(0); setScreen('detail'); }
              else setScreen('final');
            })}
          />
        ))}
        <SkipLink onClick={() => fade(() => setScreen('bailout'))} />
      </Fade>
    );
  }

  if (screen === 'detail') {
    const qs = getDetailQuestions(visitType, complaintTrack, complaint);
    if (qs.length === 0) { fade(() => setScreen('final')); return null; }
    const q = qs[detailIdx];
    if (!q) { fade(() => setScreen('final')); return null; }
    const isLast = detailIdx === qs.length - 1;
    const advance = () => isLast ? fade(() => setScreen('final')) : fade(() => setDetailIdx(i => i + 1));
    const subFrac = (detailIdx + 1) / qs.length;

    return (
      <Fade visible={visible}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <BackBtn onClick={goBack} />
          <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 2 }}>
            <div style={{ height: 4, borderRadius: 2, background: TEAL, width: `${subFrac * 100}%`, transition: 'width 0.25s' }} />
          </div>
        </div>
        <Dots phase={2} />
        <QTitle>{q.question}</QTitle>
        {q.hint && <QHint>{q.hint}</QHint>}

        {q.type === 'yesno' && (
          <BigYesNo
            value={q.stateKey ? (s3[q.stateKey] as boolean | undefined) : undefined}
            onChange={v => { if (q.stateKey) setS3Field(q.stateKey, v); advance(); }}
          />
        )}

        {q.type === 'severity' && (
          <>
            <SeverityPicker value={s3.severity} onChange={v => setS3Field('severity', v)} />
            <NextBtn onClick={advance} disabled={s3.severity === undefined} />
          </>
        )}

        {q.type === 'duration' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
            {[
              { value: '1',   label: 'Less than 1 week' },
              { value: '7',   label: '1–2 weeks' },
              { value: '14',  label: '2–4 weeks' },
              { value: '30',  label: '1–3 months' },
              { value: '90',  label: '3–6 months' },
              { value: '180', label: 'More than 6 months' },
            ].map(o => (
              <OptionCard
                key={o.value} label={o.label}
                active={s3.durationDays === o.value} isPicking={picking === `dur-${o.value}`}
                onClick={() => pickAndAdvance(`dur-${o.value}`, () => { setS3Field('durationDays', o.value); advance(); })}
              />
            ))}
          </div>
        )}

        {q.type === 'bloodcolour' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
            {([{ value: 'bright' as const, label: 'Bright red', icon: '🔴' }, { value: 'dark' as const, label: 'Dark / black / tarry', icon: '⚫' }]).map(o => (
              <OptionCard
                key={o.value} icon={o.icon} label={o.label}
                active={s3.bloodColour === o.value} isPicking={picking === `bc-${o.value}`}
                onClick={() => pickAndAdvance(`bc-${o.value}`, () => { setS3Field('bloodColour', o.value); advance(); })}
              />
            ))}
          </div>
        )}

        {q.type === 'reducible' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
            {([{ value: 'yes' as const, label: 'Yes, I can push it back in' }, { value: 'sometimes' as const, label: 'Sometimes' }, { value: 'no' as const, label: 'No, it stays out' }]).map(o => (
              <OptionCard
                key={o.value} label={o.label}
                active={s3.reducible === o.value} isPicking={picking === `red-${o.value}`}
                onClick={() => pickAndAdvance(`red-${o.value}`, () => { setS3Field('reducible', o.value); advance(); })}
              />
            ))}
          </div>
        )}

        <SkipLink onClick={() => fade(() => setScreen('bailout'))} />
      </Fade>
    );
  }

  if (screen === 'final') {
    const blk = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', marginBottom: 14 };
    const lbl = { fontSize: 13, fontWeight: 700 as const, color: '#475569', display: 'block' as const, marginBottom: 6 };
    const sml = { fontSize: 12, color: '#94a3b8', display: 'block' as const, marginBottom: 8 };
    return (
      <Fade visible={visible}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}><BackBtn onClick={goBack} /></div>
        <Dots phase={3} />
        <QTitle>Almost done</QTitle>
        <QHint>All fields optional — fill in what you can.</QHint>

        <div style={blk}>
          <label style={lbl} htmlFor="meds">Current medications</label>
          <span style={sml}>Tablets, injections, or supplements you are currently taking.</span>
          <textarea id="meds" style={textareaSty} rows={2} value={currentMeds} onChange={e => setCurrentMeds(e.target.value)} placeholder="e.g. metformin 500mg, lisinopril…" />
        </div>

        <div style={blk}>
          <label style={lbl} htmlFor="allergy">Known allergies</label>
          <input id="allergy" style={inputSty} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g. penicillin, ibuprofen, latex, none known" />
        </div>

        <div style={blk}>
          <span style={lbl}>Were you referred by another doctor?</span>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {([{ l: 'Yes', v: true }, { l: 'No', v: false }] as const).map(({ l, v }) => (
              <button key={l} type="button" onClick={() => setIsReferral(v)}
                style={{
                  flex: 1, padding: '11px', borderRadius: 9,
                  border: isReferral === v ? `2px solid ${TEAL}` : '1.5px solid #e2e8f0',
                  background: isReferral === v ? `${TEAL}12` : '#fff',
                  color: isReferral === v ? TEAL : '#374151',
                  fontSize: 14, fontWeight: isReferral === v ? 700 : 400, cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {l}
              </button>
            ))}
          </div>
          {isReferral === true && (
            <div style={{ marginTop: 12 }}>
              <label style={{ ...lbl, fontSize: 12 }}>Referring doctor or facility</label>
              <input style={inputSty} value={referralDoc} onChange={e => setReferralDoc(e.target.value)} placeholder="e.g. Dr Pierre, Victoria Hospital" />
            </div>
          )}
        </div>

        <div style={blk}>
          <label style={lbl} htmlFor="extra">Anything else for the team to know?</label>
          <textarea id="extra" style={textareaSty} rows={2} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder="Optional — any additional context for your visit." />
        </div>

        <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
          style={{
            width: '100%', padding: '16px', borderRadius: 10, border: 'none',
            background: submitting ? '#99f6e4' : TEAL,
            color: submitting ? '#0f766e' : '#fff',
            fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}>
          {submitting ? 'Submitting…' : 'Submit pre-visit form ✓'}
        </button>

        <SkipLink onClick={() => fade(() => setScreen('bailout'))} />
      </Fade>
    );
  }

  return null;
}
