import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

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
    tags: ['colonoscopy', 'scope', 'bowel'],
    content: `WHAT WAS DONE
A flexible camera was passed through your bowel to examine the lining of your colon. Biopsies or polyp removal may have been performed.

IMMEDIATELY AFTER
• You may feel bloated and pass wind — this is normal and will settle quickly.
• You may feel a little drowsy if sedation was given — do not drive for 24 hours.
• Resume normal diet and fluids straight away unless advised otherwise.

IF A POLYP WAS REMOVED
• Avoid strenuous activity for 24 hours.
• You may see a small amount of blood in your stool — this is normal for 1–2 days.

GO TO ER IMMEDIATELY IF
• Significant rectal bleeding (more than a teaspoon)
• Severe abdominal pain or distension
• Fever >38.5°C
• No bowel movement within 24 hours if you were having a bowel problem

RESULTS: If biopsies were taken, results are usually available in 2–3 weeks. We will contact you to discuss.`,
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

export default function PatientEducationTab() {
  const { assessment, symptoms } = useAppContext();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Sheet | null>(null);
  const [copied, setCopied] = useState(false);

  const allText = [assessment, ...symptoms].join(' ').toLowerCase();

  const scored = SHEETS.map(s => {
    let score = 0;
    for (const tag of s.tags) {
      if (allText.includes(tag)) score += 2;
      if (search && s.title.toLowerCase().includes(search.toLowerCase())) score += 3;
      if (search && tag.includes(search.toLowerCase())) score += 2;
    }
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
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.tags.join(' · ')}</div>
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {selected && (
        <CollapsibleCard title={selected.title}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={() => void copy(selected.content)}
              style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
              {copied ? '✓ Copied' : 'Copy text'}
            </button>
            <button type="button" onClick={() => window.print()}
              style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
              Print
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
