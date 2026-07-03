import { useState, useMemo } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';

interface Milestone {
  id: string;
  dayOffset: number;
  label: string;
  detail: string;
  category: 'wound' | 'drain' | 'diet' | 'activity' | 'labs' | 'followup' | 'medication';
  done: boolean;
  notes: string;
}

type ProcedureKey =
  | 'laparoscopic_chole'
  | 'open_chole'
  | 'appendicectomy'
  | 'hernia_lap'
  | 'hernia_open'
  | 'bowel_resection'
  | 'ercp'
  | 'ogd'
  | 'colonoscopy'
  | 'mastectomy'
  | 'thyroidectomy'
  | 'haemorrhoidectomy'
  | 'general_surgery';

const PROCEDURES: Record<ProcedureKey, { label: string; milestones: Omit<Milestone, 'id' | 'done' | 'notes'>[] }> = {
  laparoscopic_chole: {
    label: 'Laparoscopic Cholecystectomy',
    milestones: [
      { dayOffset: 1,  label: 'Post-op review',           detail: 'Assess vital signs, pain, port sites, bowel sounds, return of flatus.', category: 'wound' },
      { dayOffset: 1,  label: 'Commence clear fluids',    detail: 'If alert, no nausea — sips of water, progress to light diet if tolerated.', category: 'diet' },
      { dayOffset: 1,  label: 'Mobilise to chair',        detail: 'Early mobilisation reduces VTE and respiratory complications.', category: 'activity' },
      { dayOffset: 2,  label: 'Discharge criteria check', detail: 'Pain on oral analgesia, tolerating diet, apyrexial, port sites clean.', category: 'wound' },
      { dayOffset: 7,  label: 'Wound review',             detail: 'Check port sites for infection, hernia, dehiscence. Remove skin closure strips.', category: 'wound' },
      { dayOffset: 14, label: 'Suture / clip removal',    detail: 'Remove non-absorbable sutures / staples if used. Confirm wound healing.', category: 'wound' },
      { dayOffset: 14, label: 'Return to work (desk)',     detail: 'Light duties, driving when safe (no emergency stop pain). No heavy lifting.', category: 'activity' },
      { dayOffset: 28, label: 'Return to full activity',   detail: 'Heavy lifting, strenuous exercise — confirm no port-site hernia.', category: 'activity' },
      { dayOffset: 42, label: 'Outpatient follow-up',     detail: 'Review histology of gallbladder specimen. Any ongoing symptoms?', category: 'followup' },
    ],
  },
  open_chole: {
    label: 'Open Cholecystectomy',
    milestones: [
      { dayOffset: 1,  label: 'Drain output check',       detail: 'Check drain character and volume. Remove if output < 30 mL/24h and serous.', category: 'drain' },
      { dayOffset: 2,  label: 'Drain removal',            detail: 'Remove if criteria met (serous, < 30 mL/24h).', category: 'drain' },
      { dayOffset: 2,  label: 'Commence oral diet',       detail: 'Progress from clear fluids if bowel sounds present and no nausea.', category: 'diet' },
      { dayOffset: 5,  label: 'Wound review / discharge', detail: 'Wound inspection, remove drain if still in. Discharge if criteria met.', category: 'wound' },
      { dayOffset: 14, label: 'Suture removal',           detail: 'Remove interrupted sutures. Check wound healing.', category: 'wound' },
      { dayOffset: 28, label: 'Return to light work',     detail: 'Office/light duties. No driving if still taking opioids.', category: 'activity' },
      { dayOffset: 56, label: 'Return to full activity',  detail: 'Heavy lifting, strenuous work.', category: 'activity' },
      { dayOffset: 42, label: 'Follow-up — histology',   detail: 'Review gallbladder histology. Discuss findings.', category: 'followup' },
    ],
  },
  appendicectomy: {
    label: 'Appendicectomy (Laparoscopic)',
    milestones: [
      { dayOffset: 1,  label: 'Post-op assessment',       detail: 'Temp, WBC, C-reactive protein if septic presentation. Port sites.', category: 'labs' },
      { dayOffset: 1,  label: 'Oral diet',                detail: 'Clear fluids on day of surgery, normal diet day 1.', category: 'diet' },
      { dayOffset: 2,  label: 'Discharge if uncomplicated', detail: 'Discharge criteria: apyrexial, oral analgesia, tolerating diet, mobile.', category: 'followup' },
      { dayOffset: 10, label: 'Wound review',             detail: 'Port sites check. Remove skin closures.', category: 'wound' },
      { dayOffset: 21, label: 'Return to full activity',  detail: 'Sports, heavy lifting — sooner for perforated/complicated.', category: 'activity' },
      { dayOffset: 42, label: 'Histology review',         detail: 'Confirm appendix histology. If carcinoid / unexpected finding — MDT discussion.', category: 'followup' },
    ],
  },
  hernia_lap: {
    label: 'Laparoscopic Hernia Repair (TEP/TAPP)',
    milestones: [
      { dayOffset: 1,  label: 'Post-op check',            detail: 'Haematoma, urinary retention, port sites. Confirm voiding.', category: 'wound' },
      { dayOffset: 7,  label: 'Wound review',             detail: 'Port sites, mesh site tenderness, scrotal swelling if inguinal.', category: 'wound' },
      { dayOffset: 14, label: 'Light activity',           detail: 'Walking, light duties. No heavy lifting.', category: 'activity' },
      { dayOffset: 42, label: 'Return to full activity',  detail: 'Lifting, strenuous work, sports.', category: 'activity' },
      { dayOffset: 42, label: 'Follow-up',                detail: 'Check for recurrence, chronic groin pain, mesh complications.', category: 'followup' },
    ],
  },
  hernia_open: {
    label: 'Open Hernia Repair (Lichtenstein)',
    milestones: [
      { dayOffset: 1,  label: 'Wound check',              detail: 'Haematoma formation, voiding, scrotal swelling.', category: 'wound' },
      { dayOffset: 10, label: 'Suture removal',           detail: 'Remove skin sutures. Assess wound.', category: 'wound' },
      { dayOffset: 21, label: 'Light activity',           detail: 'Walking, light work, driving if comfortable.', category: 'activity' },
      { dayOffset: 56, label: 'Full activity',            detail: 'Heavy lifting, manual work, sports.', category: 'activity' },
      { dayOffset: 42, label: 'Follow-up',                detail: 'Recurrence assessment, chronic pain evaluation.', category: 'followup' },
    ],
  },
  bowel_resection: {
    label: 'Bowel Resection (Enhanced Recovery)',
    milestones: [
      { dayOffset: 1,  label: 'Nasogastric tube removal', detail: 'Remove NG tube if no high output, patient comfortable.', category: 'drain' },
      { dayOffset: 1,  label: 'Commence sips / ERAS',    detail: 'Begin oral fluids day 1 per ERAS protocol.', category: 'diet' },
      { dayOffset: 2,  label: 'Mobilise',                 detail: 'Out of bed, chair, corridor walking twice daily.', category: 'activity' },
      { dayOffset: 3,  label: 'Return of bowel function', detail: 'Passage of flatus or stool — document in notes.', category: 'diet' },
      { dayOffset: 3,  label: 'Drain removal',            detail: 'Remove if output < 50 mL/24h, serous, no anastomotic leak signs.', category: 'drain' },
      { dayOffset: 5,  label: 'CRP trend / anastomotic check', detail: 'CRP peak D3–D5. Rising CRP after D5 = leak until proven otherwise.', category: 'labs' },
      { dayOffset: 7,  label: 'Discharge target',         detail: 'ERAS goal: day 5–7. Tolerating solid diet, pain controlled orally, mobile.', category: 'followup' },
      { dayOffset: 14, label: 'Wound review',             detail: 'Wound healing, suture/staple removal.', category: 'wound' },
      { dayOffset: 28, label: 'Outpatient follow-up',     detail: 'Recovery progress, stoma education if applicable, histology review.', category: 'followup' },
      { dayOffset: 42, label: 'Histology + MDT',          detail: 'Confirm pathology staging. MDT for adjuvant therapy if malignancy.', category: 'followup' },
    ],
  },
  ercp: {
    label: 'ERCP',
    milestones: [
      { dayOffset: 0,  label: 'Post-procedure monitoring', detail: '4h observation: pain, amylase at 2h, vital signs q30min.', category: 'labs' },
      { dayOffset: 0,  label: 'Amylase at 2h',            detail: 'If > 3× upper limit: post-ERCP pancreatitis. IV fluids, pain management.', category: 'labs' },
      { dayOffset: 1,  label: 'Commence oral diet',       detail: 'If no pancreatitis, pain controlled — clear fluids then light diet.', category: 'diet' },
      { dayOffset: 1,  label: 'Repeat LFTs / amylase',   detail: 'Confirm trend. Bilirubin should begin falling after successful clearance.', category: 'labs' },
      { dayOffset: 7,  label: 'Repeat LFTs (outpatient)', detail: 'Confirm ductal clearance. If stent placed — plan exchange / removal schedule.', category: 'labs' },
      { dayOffset: 42, label: 'Stent exchange / removal', detail: 'Plastic biliary stent — schedule exchange or removal at 4–6 weeks.', category: 'followup' },
      { dayOffset: 42, label: 'Outpatient review',        detail: 'Symptom review, LFTs, plan for definitive treatment (e.g. cholecystectomy).', category: 'followup' },
    ],
  },
  ogd: {
    label: 'OGD / Gastroscopy',
    milestones: [
      { dayOffset: 0,  label: 'Recovery from sedation',   detail: 'Observe until fully awake, gag reflex returned. No driving for 24h.', category: 'activity' },
      { dayOffset: 0,  label: 'Post-procedure diet',      detail: 'Sips of water after 30 min if gag reflex intact. Light meal after 1h.', category: 'diet' },
      { dayOffset: 7,  label: 'Biopsy results',           detail: 'Histology results expected 7–10 days. Review CLO test result.', category: 'followup' },
      { dayOffset: 42, label: 'Follow-up / H. pylori treatment', detail: 'Review pathology. If H. pylori positive: confirm eradication therapy completed. Test of cure at 4 weeks post-treatment.', category: 'medication' },
    ],
  },
  colonoscopy: {
    label: 'Colonoscopy',
    milestones: [
      { dayOffset: 0,  label: 'Recovery from sedation',   detail: 'Wait until fully alert. No driving for 24h. Mild bloating — normal.', category: 'activity' },
      { dayOffset: 0,  label: 'Resume normal diet',       detail: 'Light meal when fully awake. Normal diet from next meal.', category: 'diet' },
      { dayOffset: 0,  label: 'Post-polypectomy precautions', detail: 'Avoid NSAIDs/aspirin for 7 days. Contact if PR bleeding, abdominal pain, fever.', category: 'medication' },
      { dayOffset: 10, label: 'Histology results',        detail: 'Polyp histology expected 7–10 days. Adenoma → schedule surveillance colonoscopy.', category: 'followup' },
      { dayOffset: 1825, label: 'Surveillance colonoscopy', detail: 'Low-risk adenoma: 5-year surveillance. High-risk: 3-year. Confirm per pathology.', category: 'followup' },
    ],
  },
  mastectomy: {
    label: 'Mastectomy / Breast Surgery',
    milestones: [
      { dayOffset: 1,  label: 'Drain output check',       detail: 'Record volume and character from each drain. Target < 30 mL/24h for removal.', category: 'drain' },
      { dayOffset: 3,  label: 'Drain removal',            detail: 'Remove when < 30 mL/24h serous output — usually day 3–5.', category: 'drain' },
      { dayOffset: 7,  label: 'Wound review',             detail: 'Wound healing, seroma formation, skin flap viability.', category: 'wound' },
      { dayOffset: 14, label: 'Suture removal',           detail: 'Remove skin sutures. Document wound status.', category: 'wound' },
      { dayOffset: 14, label: 'Physiotherapy referral',   detail: 'Arm exercises, lymphoedema prevention, range of motion.', category: 'activity' },
      { dayOffset: 21, label: 'Histology / MDT',          detail: 'Final pathology staging. Multidisciplinary team meeting for adjuvant therapy plan.', category: 'followup' },
      { dayOffset: 42, label: 'Oncology referral',        detail: 'Chemotherapy / radiotherapy / hormone therapy planning as per MDT recommendation.', category: 'followup' },
    ],
  },
  thyroidectomy: {
    label: 'Thyroidectomy',
    milestones: [
      { dayOffset: 0,  label: 'Calcium at 6h',            detail: 'Post-thyroidectomy hypocalcaemia — check corrected calcium at 6h and 24h.', category: 'labs' },
      { dayOffset: 1,  label: 'Calcium check',            detail: 'Repeat corrected calcium. Supplement if symptomatic or Ca < 2.0 mmol/L.', category: 'labs' },
      { dayOffset: 1,  label: 'Wound / drain check',      detail: 'Drain output, haematoma formation, stridor (haematoma → airway emergency).', category: 'drain' },
      { dayOffset: 2,  label: 'Drain removal',            detail: 'Remove drain if haemostasis confirmed and output minimal.', category: 'drain' },
      { dayOffset: 7,  label: 'Wound review',             detail: 'Scar healing, seroma, suture removal (if non-absorbable).', category: 'wound' },
      { dayOffset: 42, label: 'TFTs + histology review',  detail: 'Thyroid function tests. If total thyroidectomy: titrate levothyroxine. Confirm histology.', category: 'labs' },
      { dayOffset: 42, label: 'Laryngoscopy (if RLN risk)', detail: 'ENT laryngoscopy to confirm vocal cord mobility if recurrent laryngeal nerve at risk.', category: 'followup' },
    ],
  },
  haemorrhoidectomy: {
    label: 'Haemorrhoidectomy',
    milestones: [
      { dayOffset: 1,  label: 'First bowel motion',       detail: 'Lactulose / fibre supplement. Expect some pain and bleeding with first BM.', category: 'diet' },
      { dayOffset: 1,  label: 'Sitz baths',               detail: 'Warm water sitz baths 3× daily for 2 weeks to reduce pain and aid healing.', category: 'wound' },
      { dayOffset: 7,  label: 'Wound review',             detail: 'Perianal wound healing. Significant bleeding → proctoscopy.', category: 'wound' },
      { dayOffset: 21, label: 'Return to work',           detail: 'Desk work; heavy lifting and prolonged sitting may be uncomfortable.', category: 'activity' },
      { dayOffset: 42, label: 'Proctoscopy follow-up',    detail: 'Wound healing assessment. Confirm no residual haemorrhoids or stricture.', category: 'followup' },
    ],
  },
  general_surgery: {
    label: 'General Surgical Procedure',
    milestones: [
      { dayOffset: 1,  label: 'Post-op review',           detail: 'Vital signs, wound, drain, pain, return of GI function.', category: 'wound' },
      { dayOffset: 2,  label: 'Mobilisation',             detail: 'Out of bed, supervised ambulation.', category: 'activity' },
      { dayOffset: 3,  label: 'Drain review',             detail: 'Assess drain output character and volume.', category: 'drain' },
      { dayOffset: 7,  label: 'Wound review',             detail: 'Wound healing, infection surveillance.', category: 'wound' },
      { dayOffset: 14, label: 'Suture removal',           detail: 'Remove non-absorbable sutures or staples.', category: 'wound' },
      { dayOffset: 42, label: 'Follow-up',                detail: 'Clinical review, histology results, functional recovery.', category: 'followup' },
    ],
  },
};

const CAT_COLORS: Record<Milestone['category'], { bg: string; text: string; border: string; icon: string }> = {
  wound:      { bg: '#f0fdf4', text: '#15803d', border: '#86efac', icon: '🩹' },
  drain:      { bg: '#f0f9ff', text: '#0369a1', border: '#7dd3fc', icon: '🔵' },
  diet:       { bg: '#fefce8', text: '#a16207', border: '#fde68a', icon: '🍽' },
  activity:   { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff', icon: '🏃' },
  labs:       { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: '🧪' },
  followup:   { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', icon: '📅' },
  medication: { bg: '#fdf2f8', text: '#9d174d', border: '#f9a8d4', icon: '💊' },
};

function uid() { return Math.random().toString(36).slice(2, 9); }

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-LC', { timeZone: 'America/St_Lucia', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PostOpMilestonesCard() {
  const [procedure, setProcedure] = useState<ProcedureKey | ''>('');
  const [procDate, setProcDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [generated, setGenerated] = useState(false);

  function generate() {
    if (!procedure) return;
    const base = new Date(procDate + 'T12:00:00');
    const template = PROCEDURES[procedure].milestones;
    setMilestones(template.map(m => ({ ...m, id: uid(), done: false, notes: '' })));
    setGenerated(true);
  }

  function toggleDone(id: string) {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m));
  }

  function setNote(id: string, notes: string) {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, notes } : m));
  }

  const base = new Date(procDate + 'T12:00:00');
  const done = milestones.filter(m => m.done).length;
  const overdue = milestones.filter(m => !m.done && new Date(procDate + 'T12:00:00').getTime() + m.dayOffset * 86400000 < Date.now()).length;

  const badge = useMemo(() => {
    if (!generated) return undefined;
    if (overdue > 0) return `${overdue} overdue`;
    if (done > 0) return `${done}/${milestones.length}`;
    return undefined;
  }, [generated, overdue, done, milestones.length]);

  return (
    <CollapsibleCard title="Post-operative Follow-up Milestones" defaultOpen={false} badge={badge}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Procedure</label>
          <select value={procedure} onChange={e => { setProcedure(e.target.value as ProcedureKey); setGenerated(false); }}
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db' }}>
            <option value="">— select procedure —</option>
            {(Object.keys(PROCEDURES) as ProcedureKey[]).map(k => (
              <option key={k} value={k}>{PROCEDURES[k].label}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '0 0 160px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Procedure date</label>
          <input type="date" value={procDate} onChange={e => { setProcDate(e.target.value); setGenerated(false); }}
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" onClick={generate} disabled={!procedure}
            style={{
              padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 700,
              background: procedure ? '#1e40af' : '#9ca3af', color: '#fff', border: 'none', cursor: procedure ? 'pointer' : 'not-allowed',
            }}>
            {generated ? '↻ Regenerate' : 'Generate milestones'}
          </button>
        </div>
      </div>

      {generated && milestones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {milestones.map(m => {
            const cs = CAT_COLORS[m.category];
            const targetDate = addDays(base, m.dayOffset);
            const isOverdue = !m.done && new Date(base.getTime() + m.dayOffset * 86400000) < new Date();
            return (
              <div key={m.id} style={{
                border: `1px solid ${m.done ? '#86efac' : isOverdue ? '#fca5a5' : cs.border}`,
                borderLeft: `4px solid ${m.done ? '#16a34a' : isOverdue ? '#ef4444' : cs.text}`,
                borderRadius: 7, overflow: 'hidden',
                background: m.done ? '#f0fdf4' : isOverdue ? '#fef2f2' : cs.bg,
              }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={m.done} onChange={() => toggleDone(m.id)}
                    style={{ marginTop: 2, accentColor: '#16a34a', width: 15, height: 15, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{cs.icon} {m.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? '#dc2626' : m.done ? '#16a34a' : cs.text,
                        background: isOverdue ? '#fee2e2' : m.done ? '#f0fdf4' : undefined, padding: '1px 6px', borderRadius: 10 }}>
                        {m.dayOffset === 0 ? 'Same day' : m.dayOffset < 7 ? `Day ${m.dayOffset}` : m.dayOffset < 365 ? `Day ${m.dayOffset}` : `Year ${Math.round(m.dayOffset/365)}`} · {targetDate}
                        {isOverdue && ' · ⚠ Overdue'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>{m.detail}</div>
                  </div>
                </label>
                <div style={{ padding: '0 12px 8px' }}>
                  <input value={m.notes} onChange={e => setNote(m.id, e.target.value)} placeholder="Notes…"
                    style={{ width: '100%', fontSize: 11, padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: '#9ca3af', paddingTop: 4 }}>
            {done}/{milestones.length} milestones complete{overdue > 0 ? ` · ${overdue} overdue` : ''}
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
