import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { downloadAsWord } from './lib/pdfExport';

interface Sheet {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

const SHEETS: Sheet[] = [
  {
    id: 'lap_chole',
    title: 'After your laparoscopic cholecystectomy',
    tags: ['cholecystectomy', 'gallbladder', 'laparoscopic'],
    content: `WHAT WAS DONE
Your gallbladder was removed through small keyhole incisions using a camera and instruments. Most patients go home the same day or next morning.

YOUR RECOVERY
• Pain: Expect shoulder tip pain for 1–2 days (from the gas used). Simple analgesia (paracetamol + ibuprofen) will help.
• Wounds: Keep the plasters dry for 5 days. Small dissolvable stitches under the skin will not need removing.
• Diet: Start with light meals and gradually return to normal. A low-fat diet is NOT required long-term.
• Activity: Light activity from day 1. Avoid heavy lifting (>5 kg) for 2 weeks. Driving when you can perform an emergency stop comfortably (usually 5–7 days).
• Work: Office work 1 week; manual work 2–4 weeks.

CALL US OR GO TO ER IF YOU HAVE
• Fever above 38.5°C
• Increasing abdominal pain not controlled by pain relief
• Jaundice (yellow skin or eyes)
• Wound breakdown or discharge
• Inability to keep fluids down

FOLLOW-UP: As arranged — usually 2–4 weeks.`,
  },
  {
    id: 'appendicectomy',
    title: 'After your appendicectomy',
    tags: ['appendix', 'appendicectomy'],
    content: `WHAT WAS DONE
Your appendix was removed (appendicectomy), usually by keyhole surgery (laparoscopic). This is a safe and common operation.

YOUR RECOVERY
• Pain: Mild to moderate — paracetamol and ibuprofen alternated every 4 hours as needed.
• Wounds: Keep dressings dry for 5 days. Sutures are usually dissolvable.
• Diet: Light diet on day 1; normal eating from day 2 onwards.
• Activity: Rest for 1 week. Avoid heavy lifting for 2–4 weeks. Return to driving when comfortable.
• Return to work: Desk work 1–2 weeks; physical work 4–6 weeks.

GO TO ER IMMEDIATELY IF
• Temperature >38.5°C
• Worsening abdominal pain or swelling
• Wound opening or discharge
• Vomiting or inability to eat or drink

FOLLOW-UP: Appointment arranged as per discharge instructions.`,
  },
  {
    id: 'hernia_repair',
    title: 'After your hernia repair',
    tags: ['hernia', 'repair', 'inguinal', 'umbilical', 'incisional'],
    content: `WHAT WAS DONE
Your hernia was repaired — the weak spot in the abdominal wall was closed, usually with a lightweight mesh to strengthen the area and reduce recurrence.

YOUR RECOVERY
• Pain: Groin discomfort for 2–3 weeks is normal. Paracetamol and ibuprofen as needed.
• Swelling: Some bruising and swelling in the groin or scrotum is expected and will settle in 2–3 weeks.
• Wounds: Keep dressings dry for 5–7 days.
• Activity: Walk from day 1. Avoid lifting >5 kg for 4 weeks. Gradually increase activity after 4 weeks.
• Driving: After 1–2 weeks when comfortable with emergency stop.
• Return to work: Light work 2 weeks; heavy work/manual labour 4–6 weeks.

GO TO ER IF
• Fever >38.5°C
• Severe pain not controlled by analgesia
• Wound redness, warmth, or discharge
• Swelling in the groin that is hard and painful (could signal mesh complication)`,
  },
  {
    id: 'colonoscopy',
    title: 'After your colonoscopy',
    tags: ['colonoscopy', 'scope', 'bowel', 'polypectomy', 'colon'],
    content: `WHAT WAS DONE
A flexible camera was passed through your rectum to examine the lining of your entire colon. Biopsies, polyp removal (polypectomy), or other treatment may have been performed.

IMMEDIATELY AFTER
• Bloating and passing wind is very common — this is air from the examination and will pass quickly.
• You may feel a little drowsy if sedation was given — do not drive for 24 hours. A responsible adult must take you home.
• You may eat and drink normally straight away unless your doctor has advised otherwise. Start with a light meal.
• Continue to gently dab or rinse instead of wiping after bowel movements for the first 24–48 hours to prevent irritation.

IF A POLYP WAS REMOVED (POLYPECTOMY)
• Avoid strenuous activity and heavy lifting for 24 hours.
• A small amount of blood in your stool is normal for 1–2 days after polypectomy. Slight spotting can occur for up to 2 weeks.
• Blood thinners (aspirin, warfarin, clopidogrel/Plavix): discuss with your surgeon when to restart — usually 1–2 days after a small polyp. Do not restart without advice.
• Avoid NSAIDs (ibuprofen, naproxen, diclofenac) for 7 days after polypectomy.
• No air travel for 24 hours.

BIOPSY RESULTS
If biopsies were taken, results are usually available within 2–3 weeks. We will contact you or arrange a clinic appointment to discuss them. Your next surveillance colonoscopy timing depends on the findings (typically 1, 3, 5, or 10 years).

GO TO THE EMERGENCY ROOM IMMEDIATELY IF
• Rectal bleeding more than a tablespoon, or bleeding that does not stop after 30 minutes
• Severe or worsening abdominal pain or distension
• Fever above 38.5°C
• Difficulty passing stool or wind for more than 48 hours

FOLLOW-UP: As arranged by your surgical team.`,
  },
  {
    id: 'ogd',
    title: 'After your gastroscopy (OGD)',
    tags: ['ogd', 'gastroscopy', 'endoscopy', 'upper gi', 'stomach', 'oesophagus', 'duodenum'],
    content: `WHAT WAS DONE
A thin, flexible camera (gastroscope) was passed through your mouth to examine your oesophagus (food pipe), stomach, and the first part of your small intestine (duodenum). Biopsies or treatment may have been performed.

IMMEDIATELY AFTER
• A mild sore throat or discomfort on swallowing is normal and will settle within 1–2 days. Throat lozenges may help.
• Bloating and belching are common — trapped air from the examination will pass quickly.
• You may feel a little drowsy if sedation was given.
• You may eat and drink normally once any numbness from the local throat spray has worn off (usually within 1 hour). Start with a light meal and avoid very hot or spicy food for 24 hours.

IF YOU HAD SEDATION: Do not drive, operate machinery, or make important decisions for 24 hours. A responsible adult must accompany you home.
IF NO SEDATION WAS GIVEN: You may leave immediately and drive as normal once the throat numbness has gone.

BIOPSIES
If a biopsy was taken, you may notice a very small amount of blood in your saliva — this is normal and will settle quickly. Avoid vigorous gargling for 24 hours.
Results are usually available within 2–3 weeks. We will contact you to discuss.

GO TO THE EMERGENCY ROOM IF YOU HAVE
• Difficulty swallowing or new chest pain after leaving the unit
• Vomiting blood, or black/tarry stools
• Severe or worsening abdominal or chest pain
• Fever above 38°C
• Any sudden change that concerns you

FOLLOW-UP: As arranged by your surgical team.`,
  },
  {
    id: 'bronchoscopy',
    title: 'After your bronchoscopy',
    tags: ['bronchoscopy', 'bronch', 'lung', 'airway', 'chest', 'respiratory'],
    content: `WHAT WAS DONE
A thin, flexible camera (bronchoscope) was passed through your nose or mouth and into your airways to examine your lungs and air passages. Biopsies, washings, or lavage may have been taken.

IMMEDIATELY AFTER
• Hoarseness, a mild sore throat, or a sore nose are common and will settle within 1–2 days.
• A small amount of blood-tinged mucus when you cough is normal for up to 24 hours after the procedure.
• Do NOT eat or drink anything until the numbness from the local anaesthetic has completely worn off — the nurse will tell you when it is safe (usually about 2 hours after the procedure).
• A mild temperature (below 38°C) for up to 24 hours is not unusual.
• You may feel drowsy if sedation was given.

IF YOU HAD SEDATION: Do not drive, operate machinery, or sign legal documents for 24 hours. A responsible adult must accompany you home.

BIOPSY RESULTS
Results are usually available within 1–2 weeks. We will contact you or arrange a clinic appointment to discuss findings.

GO TO THE EMERGENCY ROOM IMMEDIATELY IF YOU HAVE
• Coughing up bright red (frank) blood
• Increasing breathlessness, wheezing, or difficulty breathing
• Fever above 38°C
• Chest pain
• Any sudden change that worries you

FOLLOW-UP: Please keep your follow-up appointment even if you are feeling well.`,
  },
  {
    id: 'ercp',
    title: 'After your ERCP procedure',
    tags: ['ercp', 'bile duct', 'stent', 'stone'],
    content: `WHAT WAS DONE
ERCP (Endoscopic Retrograde Cholangiopancreatography) is a procedure to examine and treat your bile duct using a camera and X-ray guidance. Stones may have been removed and/or a stent placed.

AFTER YOUR PROCEDURE
• You will be monitored for several hours before going home or to the ward.
• You may have a mild sore throat or bloating — this will settle.
• Eat lightly for the rest of the day; normal diet next day unless advised otherwise.

IMPORTANT — WATCH FOR PANCREATITIS
The most common complication is pancreatitis (inflammation of the pancreas).

GO TO ER IMMEDIATELY IF you develop
• Worsening abdominal/back pain (especially in the upper abdomen)
• Nausea and vomiting that worsens
• Fever >38°C
• Yellowing of the skin or eyes (jaundice)

FOLLOW-UP: As arranged. If a stent was placed, a further ERCP may be needed in 4–8 weeks for removal or exchange.`,
  },
  {
    id: 'general_surgery',
    title: 'General post-operative instructions',
    tags: ['general', 'surgery', 'post-op'],
    content: `PAIN MANAGEMENT
• Paracetamol 1g every 6 hours (max 4g/day) + ibuprofen 400mg every 8 hours with food (unless kidney or stomach issues).
• Take pain relief regularly for the first 2–3 days even if pain is mild — do not wait until the pain is severe.

WOUND CARE
• Keep wounds clean and dry for at least 5 days.
• Dissolvable stitches do not need removal.
• Non-dissolvable sutures will be removed at your follow-up appointment.

ACTIVITY
• Gentle walking from day 1 — this reduces the risk of blood clots.
• Avoid heavy lifting for at least 4 weeks.
• Do not drive until you can perform an emergency stop comfortably without pain.

DIET
• Eat small, light meals initially. Normal diet can resume once nausea settles.

SIGNS OF INFECTION (seek medical attention)
• Fever >38°C
• Wound redness, swelling, or discharge
• Increasing pain after the first 2 days

BLOOD CLOT SIGNS (go to ER)
• Calf swelling or pain (DVT)
• Sudden chest pain or breathlessness (PE)`,
  },
];

// Working diagnosis → handout sheet, for the diagnoses (not procedures) that
// unambiguously imply one sheet. Mirrors SurgicalConsentTab's
// DISEASE_ID_TO_TEMPLATE — same three diagnoses, same caution about only
// including unambiguous cases. The colonoscopy/OGD/ERCP/bronchoscopy sheets
// are procedure-driven, not diagnosis-driven, so they're deliberately left
// out of this map.
const DISEASE_ID_TO_SHEET: Record<string, string> = {
  cholecystitis:   'lap_chole',
  appendicitis:    'appendicectomy',
  inguinal_hernia: 'hernia_repair',
};

function printSheet(sheet: Sheet, patient: { name: string; dob: string; nhi: string }) {
  const issued = new Date().toLocaleDateString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'long' });
  const safeContent = sheet.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${sheet.title} — ${patient.name || 'Patient'}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:32px auto;font-size:13px;line-height:1.65;color:#1a1a1a}
    .lh{border-bottom:2px solid #b91c1c;padding-bottom:10px;margin-bottom:14px}
    .lh-name{font-size:19px;font-weight:800;color:#b91c1c}
    .lh-sub{font-size:11px;color:#374151;margin-top:2px}
    h1{font-size:16px;font-weight:800;color:#1e3a5f;margin:0 0 8px}
    .pt{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:12px}
    pre{white-space:pre-wrap;font-family:inherit;margin:0;font-size:13px;line-height:1.7}
    .ft{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#94a3b8}
    @media print{body{margin:16px;max-width:100%}}
  </style></head><body>
  <div class="lh">
    <div class="lh-name">AMISE MEDICAL SERVICES</div>
    <div class="lh-sub">Dr Dawit Daniel Kabiye, MD, DM &mdash; General &amp; Endoscopic Surgery &mdash; Saint Lucia</div>
    <div class="lh-sub">Tapion Hospital: (758) 459-2227 / 284-0557 &nbsp;&nbsp;|&nbsp;&nbsp; Rodney Bay: (758) 452-9557 / 720-7111</div>
  </div>
  <h1>${sheet.title}</h1>
  ${patient.name ? `<div class="pt"><strong>${patient.name}</strong>${patient.dob ? ` &middot; DOB: ${patient.dob}` : ''}${patient.nhi ? ` &middot; NHI: ${patient.nhi}` : ''} &nbsp;|&nbsp; Issued: ${issued}</div>` : ''}
  <pre>${safeContent}</pre>
  <div class="ft">Amise Medical Services &middot; ${issued} &middot; For ${patient.name || 'patient'} only. If concerned, call (758) 459-2227 or attend the nearest emergency department.</div>
  <script>window.onload = () => window.print();</script>
  </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
}

function wordExportSheet(sheet: Sheet, patient: { name: string; dob: string; nhi: string }) {
  const issued = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const body = `
    <div style="border-bottom:2pt solid #b91c1c;margin-bottom:12px;padding-bottom:8px">
      <div style="font-size:15pt;font-weight:700;color:#b91c1c">AMISE MEDICAL SERVICES</div>
      <div style="font-size:9pt;color:#6B7280">Dr Dawit Daniel Kabiye, MD, DM &mdash; General &amp; Endoscopic Surgery &mdash; Saint Lucia</div>
    </div>
    <h1>${sheet.title}</h1>
    ${patient.name ? `<h2>${patient.name}${patient.dob ? ` &middot; DOB: ${patient.dob}` : ''}${patient.nhi ? ` &middot; NHI: ${patient.nhi}` : ''} | ${issued}</h2>` : ''}
    <p class="narrative">${sheet.content.replace(/\n/g, '<br>')}</p>
    <div class="footer">Amise Medical Services &middot; ${issued} &middot; For ${patient.name || 'patient'} only.</div>`;
  const fname = `${(patient.name || 'Patient').replace(/\s+/g, '_')}_${sheet.id}_${new Date().toISOString().slice(0, 10)}`;
  downloadAsWord(body, fname, sheet.title);
}

export default function PatientEducationTab() {
  const { patientName, dob, nhiNumber, assessment, plan, symptoms, workingDiagnosis } = useAppContext();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Sheet | null>(null);
  const [copied, setCopied] = useState(false);

  const patient = { name: patientName ?? '', dob: dob ?? '', nhi: nhiNumber ?? '' };
  const allText = [assessment, plan, ...symptoms].join(' ').toLowerCase();
  const suggestedSheetId = workingDiagnosis?.diseaseId ? DISEASE_ID_TO_SHEET[workingDiagnosis.diseaseId] : undefined;

  const scored = SHEETS.map(s => {
    let score = 0;
    for (const tag of s.tags) {
      if (allText.includes(tag)) score += 2;
      if (search && s.title.toLowerCase().includes(search.toLowerCase())) score += 3;
      if (search && tag.includes(search.toLowerCase())) score += 2;
    }
    if (s.id === suggestedSheetId) score += 10;
    return { ...s, score };
  }).sort((a, b) => b.score - a.score);

  const visible = search
    ? scored.filter(s => s.score > 0 || s.title.toLowerCase().includes(search.toLowerCase()))
    : scored;

  async function copy(content: string) {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="gap-y">
      <CollapsibleCard title="Patient education sheets">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
          placeholder="Search by procedure or condition…"
          style={{ fontSize: 13, padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, width: '100%', marginBottom: 10 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map(s => (
            <button key={s.id} type="button"
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 7,
                border: `1px solid ${selected?.id === s.id ? '#3b82f6' : '#e2e8f0'}`,
                background: selected?.id === s.id ? '#eff6ff' : '#fff',
                cursor: 'pointer',
              }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.title}
                {s.id === suggestedSheetId && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', background: '#e0f2fe', borderRadius: 4, padding: '1px 6px' }}>
                    Suggested for {workingDiagnosis?.diseaseId?.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.tags.join(' · ')}</div>
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {selected && (
        <CollapsibleCard title={selected.title}>
          {patient.name && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '6px 12px', marginBottom: 10, fontSize: 12, color: '#0369a1' }}>
              Will print for: <strong>{patient.name}</strong>
              {patient.dob ? ` · DOB: ${patient.dob}` : ''}
              {patient.nhi ? ` · NHI: ${patient.nhi}` : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => printSheet(selected, patient)}
              style={{ fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer' }}>
              🖨 Print
            </button>
            <button type="button" onClick={() => wordExportSheet(selected, patient)}
              style={{ fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}>
              📄 Word
            </button>
            <button type="button" onClick={() => void copy(selected.content)}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' }}>
              {copied ? '✓ Copied' : '📋 Copy text'}
            </button>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.7, color: '#1e293b', margin: 0 }}>
            {selected.content}
          </pre>
        </CollapsibleCard>
      )}
    </div>
  );
}
