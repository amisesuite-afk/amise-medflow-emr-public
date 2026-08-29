import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';

/* ── Types ─────────────────────────────────────────────────────────────── */

type ClavienGrade = 'I' | 'II' | 'IIIa' | 'IIIb' | 'IVa' | 'IVb' | 'V';
type CompCategory = 'intraoperative' | 'early_postop' | 'late_postop' | 'near_miss' | 'adverse_event';
type ReviewStatus = 'pending' | 'reviewed' | 'actioned';
type ContribFactor = 'technical' | 'judgment' | 'system' | 'communication' | 'protocol' | 'patient';
type ActionStatus = 'open' | 'in_progress' | 'done';

interface TimelineEvent { time: string; event: string; }
interface WhyEntry     { why: string; answer: string; }
interface ActionItem   { text: string; owner: string; dueDate: string; status: ActionStatus; }

interface RCAAnalysis {
  rootCause: string;
  systemFactors: string[];
  contributingAnalysis: string;
  preventionStrategies: string[];
  learningPoints: string[];
  riskReduction: string;
  summary: string;
}

interface MMCase {
  id: string;
  date: string;
  patientRef: string;
  procedure: string;
  complication: string;
  category: CompCategory;
  grade: ClavienGrade | '';
  gradeSuffix: boolean;
  contributing: ContribFactor[];
  reOperation: boolean;
  icuAdmission: boolean;
  death: boolean;
  lessonsLearned: string;
  actionItems: string;
  reviewStatus: ReviewStatus;
  reviewDate: string;
  reviewedBy: string;
  // RCA / postmortem
  timelineEvents: TimelineEvent[];
  fiveWhys: WhyEntry[];
  structuredActions: ActionItem[];
  rcaSummary: string;
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const GRADES: { id: ClavienGrade; label: string; color: string; bg: string; desc: string }[] = [
  { id: 'I',    color: '#16a34a', bg: '#f0fdf4', label: 'Grade I',    desc: 'Deviation from normal recovery, no pharmacological/surgical/radiological intervention' },
  { id: 'II',   color: '#0d9488', bg: '#f0fdfa', label: 'Grade II',   desc: 'Pharmacological treatment including blood transfusion, TPN' },
  { id: 'IIIa', color: '#d97706', bg: '#fffbeb', label: 'Grade IIIa', desc: 'Surgical, endoscopic or radiological intervention — not under GA' },
  { id: 'IIIb', color: '#b45309', bg: '#fef3c7', label: 'Grade IIIb', desc: 'Surgical, endoscopic or radiological intervention — under GA' },
  { id: 'IVa',  color: '#dc2626', bg: '#fef2f2', label: 'Grade IVa',  desc: 'Single organ dysfunction (including dialysis) — ICU management' },
  { id: 'IVb',  color: '#b91c1c', bg: '#fee2e2', label: 'Grade IVb',  desc: 'Multi-organ dysfunction — ICU management' },
  { id: 'V',    color: '#7f1d1d', bg: '#450a0a', label: 'Grade V',    desc: 'Death' },
];

const CATEGORIES: { id: CompCategory; label: string }[] = [
  { id: 'intraoperative', label: 'Intraoperative' },
  { id: 'early_postop',   label: 'Early postoperative (≤30 days)' },
  { id: 'late_postop',    label: 'Late postoperative (>30 days)' },
  { id: 'near_miss',      label: 'Near miss' },
  { id: 'adverse_event',  label: 'Adverse event (non-surgical)' },
];

const FACTORS: { id: ContribFactor; label: string }[] = [
  { id: 'technical',      label: 'Technical / procedural' },
  { id: 'judgment',       label: 'Clinical judgement' },
  { id: 'system',         label: 'System / process' },
  { id: 'communication',  label: 'Communication' },
  { id: 'protocol',       label: 'Protocol deviation' },
  { id: 'patient',        label: 'Patient factors' },
];

const REVIEW_STYLE: Record<ReviewStatus, { bg: string; fg: string; bd: string; label: string }> = {
  pending:  { bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d', label: 'Pending review' },
  reviewed: { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe', label: 'Reviewed' },
  actioned: { bg: '#f0fdf4', fg: '#166534', bd: '#86efac', label: 'Actioned' },
};

function dbRowToCase(r: Record<string, unknown>): MMCase {
  return {
    id:               r.id as string,
    date:             r.date as string,
    patientRef:       (r.patient_ref as string) ?? '',
    procedure:        (r.procedure as string) ?? '',
    complication:     (r.complication as string) ?? '',
    category:         (r.category as CompCategory) ?? 'early_postop',
    grade:            (r.grade as ClavienGrade | '') ?? '',
    gradeSuffix:      (r.grade_suffix as boolean) ?? false,
    contributing:     (r.contributing as ContribFactor[]) ?? [],
    reOperation:      (r.re_operation as boolean) ?? false,
    icuAdmission:     (r.icu_admission as boolean) ?? false,
    death:            (r.death as boolean) ?? false,
    lessonsLearned:   (r.lessons_learned as string) ?? '',
    actionItems:      (r.action_items as string) ?? '',
    reviewStatus:     (r.review_status as ReviewStatus) ?? 'pending',
    reviewDate:       (r.review_date as string) ?? '',
    reviewedBy:       (r.reviewed_by as string) ?? '',
    timelineEvents:   (r.timeline_events as TimelineEvent[]) ?? [],
    fiveWhys:         (r.five_whys as WhyEntry[]) ?? [],
    structuredActions:(r.structured_actions as ActionItem[]) ?? [],
    rcaSummary:       (r.rca_summary as string) ?? '',
  };
}

const EMPTY_CASE: Omit<MMCase, 'id'> = {
  date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' }),
  patientRef: '', procedure: '', complication: '',
  category: 'early_postop', grade: '', gradeSuffix: false,
  contributing: [], reOperation: false, icuAdmission: false, death: false,
  lessonsLearned: '', actionItems: '',
  reviewStatus: 'pending', reviewDate: '', reviewedBy: '',
  timelineEvents: [], fiveWhys: [], structuredActions: [], rcaSummary: '',
};

/* ── Sub-components ─────────────────────────────────────────────────────── */

function GradeChip({ grade }: { grade: ClavienGrade | '' }) {
  if (!grade) return <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>;
  const g = GRADES.find(x => x.id === grade);
  if (!g) return <span style={{ fontSize: 11, color: '#94a3b8' }}>{grade}</span>;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
      background: g.bg, color: g.color,
      border: `1px solid ${g.color}40`,
    }}>{grade}</span>
  );
}

function CategoryChip({ cat }: { cat: CompCategory }) {
  const c = CATEGORIES.find(x => x.id === cat);
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 3,
      background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
    }}>{c?.label ?? cat}</span>
  );
}

/* ── Case form ──────────────────────────────────────────────────────────── */

function CaseForm({ initial, onSave, onCancel }: {
  initial?: MMCase;
  onSave: (c: MMCase) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<MMCase, 'id'>>(
    initial ? { ...initial } : { ...EMPTY_CASE }
  );
  const selectedGrade = GRADES.find(g => g.id === form.grade);

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 13, background: 'var(--surface)',
    color: 'var(--fg)',
  };

  function toggleFactor(f: ContribFactor) {
    setForm(v => ({
      ...v,
      contributing: v.contributing.includes(f)
        ? v.contributing.filter(x => x !== f)
        : [...v.contributing, f],
    }));
  }

  function save() {
    if (!form.procedure.trim() || !form.complication.trim()) return;
    onSave({ id: initial?.id ?? '', ...form });
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--surface)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--fg)' }}>
        {initial ? 'Edit case' : 'Log new case'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>DATE</label>
          <input type="date" style={inp} value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>PATIENT REF <span style={{ fontWeight: 400, color: '#94a3b8' }}>(initials / ID)</span></label>
          <input style={inp} value={form.patientRef} onChange={e => setForm(v => ({ ...v, patientRef: e.target.value }))} placeholder="e.g. J.D. / MR-1234" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>PROCEDURE *</label>
          <input style={inp} value={form.procedure} onChange={e => setForm(v => ({ ...v, procedure: e.target.value }))} placeholder="e.g. Laparoscopic cholecystectomy" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>COMPLICATION *</label>
          <input style={inp} value={form.complication} onChange={e => setForm(v => ({ ...v, complication: e.target.value }))} placeholder="e.g. Bile duct injury identified intraoperatively" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>CATEGORY</label>
          <select style={inp} value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value as CompCategory }))}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>CLAVIEN-DINDO GRADE</label>
          <select style={inp} value={form.grade} onChange={e => setForm(v => ({ ...v, grade: e.target.value as ClavienGrade | '' }))}>
            <option value="">— not graded —</option>
            {GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          {selectedGrade && (
            <div style={{ fontSize: 11, color: selectedGrade.color, marginTop: 3 }}>{selectedGrade.desc}</div>
          )}
        </div>
      </div>

      {/* Suffix + outcome checkboxes */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
        {[
          { key: 'gradeSuffix',   label: 'Grade "(d)" — complication at discharge' },
          { key: 'reOperation',   label: 'Re-operation required' },
          { key: 'icuAdmission',  label: 'ICU admission' },
          { key: 'death',         label: 'Death' },
        ].map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!form[key as keyof typeof form]}
              onChange={e => setForm(v => ({ ...v, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Contributing factors */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>CONTRIBUTING FACTORS</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FACTORS.map(f => {
            const on = form.contributing.includes(f.id);
            return (
              <button key={f.id} type="button" onClick={() => toggleFactor(f.id)} style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${on ? '#6366f1' : '#d1d5db'}`,
                background: on ? '#eef2ff' : 'var(--surface)',
                color: on ? '#4338ca' : 'var(--muted)',
                fontWeight: on ? 700 : 400,
              }}>{f.label}</button>
            );
          })}
        </div>
      </div>

      {/* Lessons + actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>LESSONS LEARNED</label>
          <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={form.lessonsLearned} onChange={e => setForm(v => ({ ...v, lessonsLearned: e.target.value }))} placeholder="Key learning points from this case…" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>ACTION ITEMS</label>
          <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={form.actionItems} onChange={e => setForm(v => ({ ...v, actionItems: e.target.value }))} placeholder="Protocol changes, training needs, system fixes…" />
        </div>
      </div>

      {/* Review */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>REVIEW STATUS</label>
          <select style={inp} value={form.reviewStatus} onChange={e => setForm(v => ({ ...v, reviewStatus: e.target.value as ReviewStatus }))}>
            <option value="pending">Pending review</option>
            <option value="reviewed">Reviewed at M&M</option>
            <option value="actioned">Actioned / closed</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>REVIEW DATE</label>
          <input type="date" style={inp} value={form.reviewDate} onChange={e => setForm(v => ({ ...v, reviewDate: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>REVIEWED BY</label>
          <input style={inp} value={form.reviewedBy} onChange={e => setForm(v => ({ ...v, reviewedBy: e.target.value }))} placeholder="Dr. …" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={!form.procedure.trim() || !form.complication.trim()} style={{
          padding: '9px 18px', borderRadius: 7, border: 'none',
          background: form.procedure && form.complication ? 'var(--accent)' : '#d1d5db',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          {initial ? 'Save changes' : 'Log case'}
        </button>
        <button onClick={onCancel} style={{ padding: '9px 18px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Postmortem / RCA panel ─────────────────────────────────────────────── */

function CasePostmortem({ caseData, onBack, onSave }: {
  caseData: MMCase;
  onBack: () => void;
  onSave: (updated: MMCase) => void;
}) {
  const [timeline, setTimeline]   = useState<TimelineEvent[]>(caseData.timelineEvents ?? []);
  const [fiveWhys, setFiveWhys]   = useState<WhyEntry[]>(
    caseData.fiveWhys?.length ? caseData.fiveWhys : [{ why: '', answer: '' }]
  );
  const [actions, setActions]     = useState<ActionItem[]>(caseData.structuredActions ?? []);
  const [analysis, setAnalysis]   = useState<RCAAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseErr, setAnalyseErr] = useState('');
  const [saving, setSaving]       = useState(false);
  const gradeInfo = GRADES.find(g => g.id === caseData.grade);

  const inp: React.CSSProperties = {
    padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 5,
    fontSize: 12, background: 'var(--surface)', color: 'var(--fg)', width: '100%',
  };

  /* helpers */
  function addTimelineEvent() {
    setTimeline(v => [...v, { time: '', event: '' }]);
  }
  function updateTimeline(i: number, field: keyof TimelineEvent, val: string) {
    setTimeline(v => v.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }
  function removeTimeline(i: number) {
    setTimeline(v => v.filter((_, idx) => idx !== i));
  }

  function addWhy() {
    if (fiveWhys.length >= 5) return;
    setFiveWhys(v => [...v, { why: '', answer: '' }]);
  }
  function updateWhy(i: number, field: keyof WhyEntry, val: string) {
    setFiveWhys(v => v.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }
  function removeWhy(i: number) {
    setFiveWhys(v => v.filter((_, idx) => idx !== i));
  }

  function addAction() {
    setActions(v => [...v, { text: '', owner: '', dueDate: '', status: 'open' }]);
  }
  function updateAction(i: number, field: keyof ActionItem, val: string) {
    setActions(v => v.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }
  function removeAction(i: number) {
    setActions(v => v.filter((_, idx) => idx !== i));
  }
  function cycleActionStatus(i: number) {
    const order: ActionStatus[] = ['open', 'in_progress', 'done'];
    setActions(v => v.map((e, idx) => idx === i
      ? { ...e, status: order[(order.indexOf(e.status) + 1) % order.length] }
      : e));
  }

  const ACTION_STATUS_STYLE: Record<ActionStatus, { bg: string; fg: string; bd: string; label: string }> = {
    open:        { bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d', label: 'Open' },
    in_progress: { bg: '#eff6ff', fg: '#1e40af', bd: '#bfdbfe', label: 'In progress' },
    done:        { bg: '#f0fdf4', fg: '#166534', bd: '#86efac', label: 'Done' },
  };

  async function runAnalysis() {
    setAnalysing(true);
    setAnalyseErr('');
    try {
      // Save current RCA data first so the API has the latest timeline + 5 Whys
      await fetch(`/api/mm-cases/${caseData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelineEvents: timeline, fiveWhys, structuredActions: actions }),
      });
      const resp = await fetch(`/api/mm-cases/${caseData.id}/analysis`, { method: 'POST' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = await resp.json() as { analysis: RCAAnalysis };
      setAnalysis(body.analysis);
    } catch (e) {
      setAnalyseErr(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalysing(false);
    }
  }

  async function save() {
    setSaving(true);
    const updated: MMCase = {
      ...caseData,
      timelineEvents: timeline,
      fiveWhys,
      structuredActions: actions,
      rcaSummary: analysis?.summary ?? caseData.rcaSummary,
    };
    try {
      await fetch(`/api/mm-cases/${caseData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timelineEvents: timeline,
          fiveWhys,
          structuredActions: actions,
          rcaSummary: updated.rcaSummary,
        }),
      });
    } catch { /* optimistic */ }
    onSave(updated);
    setSaving(false);
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '14px 16px', marginBottom: 12,
  };
  const sectionHd: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10,
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{
          padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--muted)', fontSize: 12, cursor: 'pointer',
        }}>← Register</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--fg)' }}>{caseData.procedure}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{caseData.complication} · {caseData.date}</div>
        </div>
        {caseData.grade && gradeInfo && (
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 5,
            background: gradeInfo.bg, color: gradeInfo.color, border: `1px solid ${gradeInfo.color}40`,
          }}>{caseData.grade}{caseData.gradeSuffix ? '(d)' : ''}</span>
        )}
        <button onClick={save} disabled={saving} style={{
          padding: '7px 14px', borderRadius: 6, border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}>{saving ? 'Saving…' : 'Save RCA'}</button>
      </div>

      {/* ── Timeline ── */}
      <div style={sectionStyle}>
        <div style={sectionHd}>Timeline reconstruction</div>
        {timeline.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            Document the chronological sequence of events leading to the complication.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {timeline.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 28px', gap: 6, alignItems: 'center' }}>
              <input
                placeholder="HH:MM or stage"
                style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }}
                value={e.time}
                onChange={ev => updateTimeline(i, 'time', ev.target.value)}
              />
              <input
                placeholder="Event description…"
                style={inp}
                value={e.event}
                onChange={ev => updateTimeline(i, 'event', ev.target.value)}
              />
              <button onClick={() => removeTimeline(i)} style={{
                width: 28, height: 28, borderRadius: 4, border: '1px solid #fca5a5',
                background: '#fef2f2', color: '#b91c1c', fontSize: 14, cursor: 'pointer', lineHeight: 1,
              }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addTimelineEvent} style={{
          marginTop: 8, padding: '5px 12px', borderRadius: 5, border: '1px dashed var(--border)',
          background: 'transparent', color: 'var(--accent)', fontSize: 12, cursor: 'pointer',
        }}>+ Add event</button>
      </div>

      {/* ── 5 Whys ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={sectionHd}>5 Whys analysis</div>
          {fiveWhys.length < 5 && (
            <button onClick={addWhy} style={{
              padding: '3px 10px', borderRadius: 5, border: '1px dashed var(--border)',
              background: 'transparent', color: 'var(--accent)', fontSize: 11, cursor: 'pointer',
            }}>+ Why</button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fiveWhys.map((w, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg, #f8f9fb)', position: 'relative',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, color: 'var(--accent)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>Why {i + 1}</span>
                {fiveWhys.length > 1 && (
                  <button onClick={() => removeWhy(i)} style={{
                    background: 'none', border: 'none', color: 'var(--muted)',
                    fontSize: 14, cursor: 'pointer', lineHeight: 1,
                  }}>×</button>
                )}
              </div>
              <input
                placeholder="Why did this happen?"
                style={{ ...inp, marginBottom: 6, fontWeight: 600 }}
                value={w.why}
                onChange={e => updateWhy(i, 'why', e.target.value)}
              />
              <input
                placeholder="Because…"
                style={{ ...inp, color: 'var(--fg)', fontStyle: w.answer ? 'normal' : 'italic' }}
                value={w.answer}
                onChange={e => updateWhy(i, 'answer', e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Structured actions ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={sectionHd}>Action items</div>
          <button onClick={addAction} style={{
            padding: '3px 10px', borderRadius: 5, border: '1px dashed var(--border)',
            background: 'transparent', color: 'var(--accent)', fontSize: 11, cursor: 'pointer',
          }}>+ Action</button>
        </div>
        {actions.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Add specific actions with owners and due dates to drive accountability.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map((a, i) => {
            const st = ACTION_STATUS_STYLE[a.status];
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 130px auto 28px',
                gap: 6, alignItems: 'center',
              }}>
                <input placeholder="Action description…" style={inp} value={a.text}
                  onChange={e => updateAction(i, 'text', e.target.value)} />
                <input placeholder="Owner (Dr / Nurse)" style={inp} value={a.owner}
                  onChange={e => updateAction(i, 'owner', e.target.value)} />
                <input type="date" style={inp} value={a.dueDate}
                  onChange={e => updateAction(i, 'dueDate', e.target.value)} />
                <button onClick={() => cycleActionStatus(i)} style={{
                  padding: '4px 9px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: st.bg, color: st.fg, border: `1px solid ${st.bd}`, whiteSpace: 'nowrap',
                }}>{st.label}</button>
                <button onClick={() => removeAction(i)} style={{
                  width: 28, height: 28, borderRadius: 4, border: '1px solid #fca5a5',
                  background: '#fef2f2', color: '#b91c1c', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                }}>×</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── AI Analysis ── */}
      <div style={sectionStyle}>
        <div style={sectionHd}>AI postmortem analysis</div>

        {!analysis && !caseData.rcaSummary && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Complete the timeline and 5 Whys above, then generate a structured root-cause analysis using AI.
            The analysis is advisory — it does not replace clinical judgement.
          </div>
        )}

        {/* Previously saved summary */}
        {!analysis && caseData.rcaSummary && (
          <div style={{
            padding: 12, borderRadius: 7, background: 'var(--bg, #f8f9fb)',
            border: '1px solid var(--border)', fontSize: 13, color: 'var(--fg)',
            lineHeight: 1.6, marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Previously generated summary
            </div>
            {caseData.rcaSummary}
          </div>
        )}

        {/* Fresh analysis result */}
        {analysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <AnalysisBlock label="Root cause" content={analysis.rootCause} accent="var(--severity-high, #dc2626)" />
            <AnalysisBlock label="Contributing factor analysis" content={analysis.contributingAnalysis} />
            <AnalysisListBlock label="System factors" items={analysis.systemFactors} />
            <AnalysisListBlock label="Prevention strategies" items={analysis.preventionStrategies} accent="#0d9488" />
            <AnalysisListBlock label="Learning points" items={analysis.learningPoints} accent="#6366f1" />
            <AnalysisBlock label="Highest-yield risk reduction" content={analysis.riskReduction} accent="#d97706" />
            <div style={{
              padding: 12, borderRadius: 7, background: '#f0f9ff',
              border: '1px solid #bae6fd', fontSize: 13, color: '#0c4a6e', lineHeight: 1.65,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                M&M presentation summary
              </div>
              {analysis.summary}
            </div>
          </div>
        )}

        {analyseErr && (
          <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>
            Error: {analyseErr}
          </div>
        )}

        <button onClick={runAnalysis} disabled={analysing || !caseData.id} style={{
          padding: '9px 18px', borderRadius: 7, border: 'none',
          background: analysing ? '#d1d5db' : '#6366f1',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: analysing ? 'default' : 'pointer',
        }}>
          {analysing ? 'Analysing…' : (analysis || caseData.rcaSummary) ? 'Regenerate analysis' : 'Generate AI analysis'}
        </button>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
          AI-generated analysis is advisory only. Always apply clinical judgement before acting on any suggestion.
        </div>
      </div>
    </div>
  );
}

function AnalysisBlock({ label, content, accent = 'var(--fg)' }: { label: string; content: string; accent?: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg, #f8f9fb)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.55 }}>{content}</div>
    </div>
  );
}

function AnalysisListBlock({ label, items, accent = '#374151' }: { label: string; items: string[]; accent?: string }) {
  if (!items?.length) return null;
  return (
    <div style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg, #f8f9fb)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

type QIView = 'register' | 'metrics' | 'postmortem';

export default function QualityImprovementTab() {
  const { patientName } = useAppContext();

  const [cases, setCases] = useState<MMCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<QIView>('register');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [postmortemId, setPostmortemId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all');
  const [filterGrade, setFilterGrade] = useState<ClavienGrade | 'all'>('all');

  const loadFromApi = useCallback(async () => {
    try {
      const resp = await fetch('/api/mm-cases');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = await resp.json() as { cases: Record<string, unknown>[] };
      setCases((body.cases ?? []).map(r => dbRowToCase(r)));
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFromApi(); }, [loadFromApi]);

  async function saveCase(c: MMCase) {
    const isNew = !c.id;
    const payload = {
      date: c.date, patientRef: c.patientRef, procedure: c.procedure,
      complication: c.complication, category: c.category, grade: c.grade || undefined,
      gradeSuffix: c.gradeSuffix, contributing: c.contributing,
      reOperation: c.reOperation, icuAdmission: c.icuAdmission, death: c.death,
      lessonsLearned: c.lessonsLearned, actionItems: c.actionItems,
      reviewStatus: c.reviewStatus, reviewDate: c.reviewDate || undefined,
      reviewedBy: c.reviewedBy,
    };
    try {
      if (isNew) {
        const resp = await fetch('/api/mm-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          const body = await resp.json() as { case: { id: string } };
          c = { ...c, id: body.case.id };
        }
      } else {
        await fetch(`/api/mm-cases/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch { /* optimistic update continues */ }
    setCases(prev => isNew ? [c, ...prev] : prev.map(x => x.id === c.id ? c : x));
    setAdding(false);
    setEditId(null);
  }

  async function deleteCase(id: string) {
    try {
      await fetch(`/api/mm-cases/${id}`, { method: 'DELETE' });
    } catch { /* */ }
    setCases(prev => prev.filter(x => x.id !== id));
  }

  async function cycleStatus(id: string) {
    const ORDER: ReviewStatus[] = ['pending', 'reviewed', 'actioned'];
    const c = cases.find(x => x.id === id);
    if (!c) return;
    const next = ORDER[(ORDER.indexOf(c.reviewStatus) + 1) % ORDER.length];
    setCases(prev => prev.map(x => x.id === id ? { ...x, reviewStatus: next } : x));
    try {
      await fetch(`/api/mm-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: next }),
      });
    } catch { /* optimistic update already applied */ }
  }

  /* ── Filtered list ── */
  const filtered = useMemo(() => cases.filter(c =>
    (filterStatus === 'all' || c.reviewStatus === filterStatus) &&
    (filterGrade === 'all' || c.grade === filterGrade)
  ), [cases, filterStatus, filterGrade]);

  /* ── Metrics ── */
  const metrics = useMemo(() => {
    const n = cases.length;
    if (!n) return null;
    const deaths     = cases.filter(c => c.death || c.grade === 'V').length;
    const reOps      = cases.filter(c => c.reOperation).length;
    const icu        = cases.filter(c => c.icuAdmission).length;
    const pending    = cases.filter(c => c.reviewStatus === 'pending').length;
    const gradeCount: Record<string, number> = {};
    for (const g of GRADES) gradeCount[g.id] = cases.filter(c => c.grade === g.id).length;
    const catCount: Record<string, number> = {};
    for (const cat of CATEGORIES) catCount[cat.id] = cases.filter(c => c.category === cat.id).length;
    const factorCount: Record<string, number> = {};
    for (const f of FACTORS) factorCount[f.id] = cases.filter(c => c.contributing.includes(f.id)).length;

    // Trend — cases per month, last 12 months
    const now = new Date();
    const months: Array<{ label: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const count = cases.filter(c => {
        const cd = new Date(c.date);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length;
      months.push({ label, count });
    }

    // Action items across all cases
    const allActions = cases.flatMap(c => c.structuredActions ?? []);
    const actionsOpen       = allActions.filter(a => a.status === 'open').length;
    const actionsInProgress = allActions.filter(a => a.status === 'in_progress').length;
    const actionsDone       = allActions.filter(a => a.status === 'done').length;

    // RCA completion
    const withTimeline = cases.filter(c => (c.timelineEvents ?? []).length > 0).length;
    const withWhys     = cases.filter(c => (c.fiveWhys ?? []).some(w => w.why?.trim())).length;
    const withSummary  = cases.filter(c => c.rcaSummary?.trim()).length;

    // High-severity pending review
    const highGrades = new Set<string>(['IIIb', 'IVa', 'IVb', 'V']);
    const urgentPending = cases.filter(c => highGrades.has(c.grade) && c.reviewStatus === 'pending');

    return {
      n, deaths, reOps, icu, pending, gradeCount, catCount, factorCount,
      months, actionsOpen, actionsInProgress, actionsDone,
      withTimeline, withWhys, withSummary, urgentPending,
    };
  }, [cases]);

  const pill: React.CSSProperties = {
    padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--muted)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };
  const pillActive: React.CSSProperties = {
    ...pill,
    background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)',
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ background: 'var(--panel-hd)', color: '#fff', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Quality Improvement &amp; M&amp;M Register</div>
        <div style={{ fontSize: 12, color: 'var(--sidebar-text)', marginTop: 2 }}>
          Morbidity &amp; Mortality case log · RACS-aligned peer review workflow
          {patientName.trim() ? ` · ${patientName}` : ''}
        </div>
      </div>

      {/* Quick stats */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total cases', value: metrics.n, color: '#0b2545' },
            { label: 'Pending review', value: metrics.pending, color: metrics.pending > 0 ? '#d97706' : '#16a34a' },
            { label: 'Re-operations', value: metrics.reOps, color: metrics.reOps > 0 ? '#dc2626' : '#16a34a' },
            { label: 'Deaths', value: metrics.deaths, color: metrics.deaths > 0 ? '#7f1d1d' : '#16a34a' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button style={view === 'register' ? pillActive : pill} onClick={() => { setView('register'); setPostmortemId(null); }}>
          Case register
          {metrics?.pending ? <span style={{ marginLeft: 6, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 10 }}>{metrics.pending}</span> : null}
        </button>
        <button style={view === 'metrics' ? pillActive : pill} onClick={() => { setView('metrics'); setPostmortemId(null); }}>QI metrics</button>
        {postmortemId && (
          <button style={view === 'postmortem' ? pillActive : pill} onClick={() => setView('postmortem')}>
            ⚕ Postmortem analysis
          </button>
        )}
      </div>

      {/* ── Register view ── */}
      {view === 'register' && (
        <>
          {/* Filters + add */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ReviewStatus | 'all')}
              style={{ ...pill, cursor: 'pointer' }}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="actioned">Actioned</option>
            </select>
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value as ClavienGrade | 'all')}
              style={{ ...pill, cursor: 'pointer' }}>
              <option value="all">All grades</option>
              {GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            {!adding && !editId && (
              <button onClick={() => setAdding(true)} style={{
                padding: '7px 14px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                + Log case
              </button>
            )}
          </div>

          {/* Add form */}
          {adding && (
            <div style={{ marginBottom: 14 }}>
              <CaseForm onSave={saveCase} onCancel={() => setAdding(false)} />
            </div>
          )}

          {/* Case list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>Loading M&amp;M register…</div>
          ) : filtered.length === 0 && !adding ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
              {cases.length === 0
                ? 'No M&M cases logged. Click "Log case" to begin.'
                : 'No cases match the current filter.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => {
                const rs = REVIEW_STYLE[c.reviewStatus];
                const gradeInfo = GRADES.find(g => g.id === c.grade);
                if (editId === c.id) {
                  return (
                    <CaseForm key={c.id} initial={c} onSave={saveCase} onCancel={() => setEditId(null)} />
                  );
                }
                return (
                  <div key={c.id} style={{
                    background: 'var(--surface)',
                    border: `1px solid var(--border)`,
                    borderLeft: `3px solid ${gradeInfo?.color ?? 'var(--border)'}`,
                    borderRadius: 8,
                    padding: '11px 14px',
                  }}>
                    {/* Row 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{c.date}</span>
                      {c.patientRef && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.patientRef}</span>}
                      <GradeChip grade={c.grade} />
                      {c.gradeSuffix && <span style={{ fontSize: 10, color: '#94a3b8' }}>(d)</span>}
                      <CategoryChip cat={c.category} />
                      {c.reOperation && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 600 }}>Re-op</span>}
                      {c.icuAdmission && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 600 }}>ICU</span>}
                      {c.death && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d', fontWeight: 700 }}>Death</span>}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => cycleStatus(c.id)} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                          background: rs.bg, color: rs.fg, border: `1px solid ${rs.bd}`, fontWeight: 700,
                        }}>
                          {rs.label}
                        </button>
                      </span>
                    </div>

                    {/* Row 2 — procedure + complication */}
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>{c.procedure}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}> — {c.complication}</span>
                    </div>

                    {/* Contributing factors */}
                    {c.contributing.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                        {c.contributing.map(f => (
                          <span key={f} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                            {FACTORS.find(x => x.id === f)?.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Lessons + actions */}
                    {(c.lessonsLearned || c.actionItems) && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                        {c.lessonsLearned && <div><b style={{ color: 'var(--fg)' }}>Lessons:</b> {c.lessonsLearned}</div>}
                        {c.actionItems   && <div><b style={{ color: 'var(--fg)' }}>Actions:</b> {c.actionItems}</div>}
                      </div>
                    )}

                    {/* Review info */}
                    {(c.reviewDate || c.reviewedBy) && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {c.reviewedBy && `Reviewed by ${c.reviewedBy}`}{c.reviewDate && ` · ${c.reviewDate}`}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => setEditId(c.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => { setPostmortemId(c.id); setView('postmortem'); }} style={{
                        fontSize: 11, padding: '3px 9px', borderRadius: 4,
                        border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', cursor: 'pointer', fontWeight: 600,
                      }}>
                        Analyse →
                      </button>
                      <button onClick={() => { if (confirm('Remove this case?')) deleteCase(c.id); }} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Postmortem view ── */}
      {view === 'postmortem' && postmortemId && (() => {
        const c = cases.find(x => x.id === postmortemId);
        if (!c) return (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
            Case not found.
          </div>
        );
        return (
          <CasePostmortem
            caseData={c}
            onBack={() => setView('register')}
            onSave={updated => setCases(prev => prev.map(x => x.id === updated.id ? updated : x))}
          />
        );
      })()}

      {/* ── Metrics view ── */}
      {view === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!metrics ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
              Log cases in the Case register to generate QI metrics.
            </div>
          ) : (
            <>
              {/* Clavien-Dindo distribution */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Clavien-Dindo grade distribution
                </div>
                {GRADES.map(g => {
                  const n = metrics.gradeCount[g.id] ?? 0;
                  const pct = metrics.n > 0 ? (n / metrics.n) * 100 : 0;
                  return (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                      <span style={{ width: 44, fontSize: 11, fontWeight: 700, color: g.color }}>{g.id}</span>
                      <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 30, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: n > 0 ? g.color : 'var(--faint)', textAlign: 'right' }}>{n}</span>
                      <span style={{ width: 36, fontSize: 11, color: 'var(--muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Category distribution */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Complication category
                </div>
                {CATEGORIES.map(cat => {
                  const n = metrics.catCount[cat.id] ?? 0;
                  const pct = metrics.n > 0 ? (n / metrics.n) * 100 : 0;
                  return (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                      <span style={{ width: 200, fontSize: 12, color: 'var(--fg)' }}>{cat.label}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#0d9488', borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 30, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: n > 0 ? '#0d9488' : 'var(--faint)', textAlign: 'right' }}>{n}</span>
                    </div>
                  );
                })}
              </div>

              {/* Contributing factors */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Contributing factors
                </div>
                {FACTORS.map(f => {
                  const n = metrics.factorCount[f.id] ?? 0;
                  const pct = metrics.n > 0 ? (n / metrics.n) * 100 : 0;
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                      <span style={{ width: 170, fontSize: 12, color: 'var(--fg)' }}>{f.label}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#6366f1', borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 30, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: n > 0 ? '#6366f1' : 'var(--faint)', textAlign: 'right' }}>{n}</span>
                    </div>
                  );
                })}
              </div>

              {/* Key rate summary */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Key rates (across all logged cases)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Mortality rate', n: metrics.deaths, pct: (metrics.deaths / metrics.n * 100).toFixed(1) },
                    { label: 'Re-operation rate', n: metrics.reOps, pct: (metrics.reOps / metrics.n * 100).toFixed(1) },
                    { label: 'ICU admission rate', n: metrics.icu, pct: (metrics.icu / metrics.n * 100).toFixed(1) },
                  ].map(({ label, n, pct }) => (
                    <div key={label} style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--bg, #f8f9fb)', borderRadius: 7, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: Number(n) > 0 ? '#dc2626' : '#16a34a' }}>{pct}%</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1 }}>{n} of {metrics.n} cases</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                  Rates reflect logged M&M cases only — not all procedures. Log completeness determines accuracy.
                </div>
              </div>

              {/* Trend — cases per month */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Cases logged — last 12 months
                </div>
                {(() => {
                  const maxCount = Math.max(...metrics.months.map(m => m.count), 1);
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64, paddingBottom: 0 }}>
                        {metrics.months.map((m, i) => {
                          const pct = (m.count / maxCount) * 100;
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2, height: '100%' }}>
                              <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 800, visibility: m.count > 0 ? 'visible' : 'hidden', lineHeight: 1 }}>{m.count}</span>
                              <div style={{ width: '100%', background: '#6366f1', height: `${pct}%`, minHeight: m.count > 0 ? 4 : 1, borderRadius: '2px 2px 0 0', opacity: m.count > 0 ? 1 : 0.12 }} />
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 3, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                        {metrics.months.map((m, i) => (
                          <span key={i} style={{ flex: 1, fontSize: 8, textAlign: 'center', color: '#94a3b8', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{m.label}</span>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Action item tracker */}
              {(metrics.actionsOpen + metrics.actionsInProgress + metrics.actionsDone) > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                    Action items — aggregate across all cases
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                    {[
                      { label: 'Open', n: metrics.actionsOpen,       bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d' },
                      { label: 'In progress', n: metrics.actionsInProgress, bg: '#eff6ff', fg: '#1e40af', bd: '#bfdbfe' },
                      { label: 'Done', n: metrics.actionsDone,       bg: '#f0fdf4', fg: '#166534', bd: '#86efac' },
                    ].map(({ label, n, bg, fg, bd }) => (
                      <div key={label} style={{ textAlign: 'center', padding: '10px 8px', background: bg, borderRadius: 7, border: `1px solid ${bd}` }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: fg, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Progress bar */}
                  {(() => {
                    const total = metrics.actionsOpen + metrics.actionsInProgress + metrics.actionsDone;
                    const donePct = total > 0 ? (metrics.actionsDone / total) * 100 : 0;
                    const inPct   = total > 0 ? (metrics.actionsInProgress / total) * 100 : 0;
                    return (
                      <div style={{ height: 8, borderRadius: 4, background: '#fcd34d', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${donePct}%`, background: '#86efac' }} />
                        <div style={{ width: `${inPct}%`, background: '#bfdbfe' }} />
                      </div>
                    );
                  })()}
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                    {(metrics.actionsOpen + metrics.actionsInProgress + metrics.actionsDone)} total structured action items logged
                  </div>
                </div>
              )}

              {/* RCA completion */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Postmortem / RCA completion
                </div>
                {[
                  { label: 'Timeline reconstruction', n: metrics.withTimeline },
                  { label: '5 Whys analysis', n: metrics.withWhys },
                  { label: 'AI postmortem summary', n: metrics.withSummary },
                ].map(({ label, n }) => {
                  const pct = metrics.n > 0 ? (n / metrics.n) * 100 : 0;
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                      <span style={{ width: 190, fontSize: 12, color: 'var(--fg)' }}>{label}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#6366f1', borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 50, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: pct > 0 ? '#6366f1' : 'var(--muted)', textAlign: 'right', fontWeight: pct > 0 ? 700 : 400 }}>
                        {n}/{metrics.n}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* High-severity pending alert */}
              {metrics.urgentPending.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    High-severity cases pending review ({metrics.urgentPending.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {metrics.urgentPending.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <GradeChip grade={c.grade} />
                        <span style={{ fontWeight: 600, color: '#7f1d1d' }}>{c.procedure}</span>
                        <span style={{ color: '#b91c1c' }}>— {c.complication}</span>
                        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11 }}>{c.date}</span>
                        <button onClick={() => { setPostmortemId(c.id); setView('postmortem'); }} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 4,
                          border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontWeight: 700,
                        }}>Review →</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
