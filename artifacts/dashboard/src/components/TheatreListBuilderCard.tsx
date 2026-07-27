import { useState, useEffect, useCallback } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProcGroup = 'hepatobiliary' | 'hernia' | 'colorectal' | 'upper_gi' | 'endoscopy' | 'breast_thyroid' | 'other';
type SessionKey = 'morning' | 'afternoon' | 'full_day' | 'ercp';

interface ProcedureTemplate {
  name: string; durationMin: number; position: string;
  anaesthetic: string; equipment: string[]; antibiotics: string; group: ProcGroup;
}

interface ApiCase {
  id: string; sessionId: string; patientName: string; procedure: string;
  durationMin: number; position?: string | null; anaesthetic?: string | null;
  equipment?: string[] | null; antibiotics?: string | null; notes?: string | null;
  procGroup?: string; sortOrder: number;
}

interface ApiSession {
  id: string; session_date: string; session_type: SessionKey;
  location_key: string; status: 'draft' | 'published' | 'cancelled';
  cal_summary?: string | null;
  startHHMM: string; locationLabel: string; sessionLabel: string; capacityMin: number;
  cases: ApiCase[];
}

// ─── Procedure templates ──────────────────────────────────────────────────────

const T: ProcedureTemplate[] = [
  // Hepatobiliary
  { group: 'hepatobiliary', name: 'Laparoscopic cholecystectomy', durationMin: 60,
    position: 'Supine (reverse Trendelenburg)', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Clip applicator', 'LigaSure / harmonic'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'hepatobiliary', name: 'Laparoscopic cholecystectomy + IOC', durationMin: 75,
    position: 'Supine (reverse Trendelenburg)', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Clip applicator', 'IOC set', 'C-arm fluoroscopy'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'hepatobiliary', name: 'Laparoscopic CBD exploration (LCBDE)', durationMin: 120,
    position: 'Supine', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Choledochoscope', 'Dormia basket', 'C-arm fluoroscopy', 'T-tube'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'hepatobiliary', name: 'Open cholecystectomy', durationMin: 90,
    position: 'Supine', anaesthetic: 'GA',
    equipment: ['General set', 'Retractor system'], antibiotics: 'Cefazolin 2g IV' },
  // Hernia
  { group: 'hernia', name: 'Inguinal hernia repair — TAPP/TEP', durationMin: 60,
    position: 'Supine (Trendelenburg)', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Lightweight mesh', 'Tacker'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'hernia', name: 'Inguinal hernia repair — Lichtenstein', durationMin: 45,
    position: 'Supine', anaesthetic: 'Spinal or GA',
    equipment: ['General set', 'Polypropylene mesh'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'hernia', name: 'Femoral hernia repair (open)', durationMin: 45,
    position: 'Supine', anaesthetic: 'Spinal or GA',
    equipment: ['General set', 'Mesh'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'hernia', name: 'Umbilical hernia repair', durationMin: 30,
    position: 'Supine', anaesthetic: 'GA or LA + sedation',
    equipment: ['General set', 'Mesh (small)'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'hernia', name: 'Incisional hernia repair (component separation)', durationMin: 120,
    position: 'Supine', anaesthetic: 'GA',
    equipment: ['General set', 'Large mesh', 'Retractor system', 'Drains'], antibiotics: 'Cefazolin 2g IV + Metronidazole 500mg IV' },
  { group: 'hernia', name: 'Laparoscopic hiatal hernia repair + fundoplication', durationMin: 120,
    position: 'Supine (reverse Trendelenburg, split legs)', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Liver retractor', 'Bougie 56Fr'], antibiotics: 'Cefazolin 2g IV' },
  // Colorectal
  { group: 'colorectal', name: 'Laparoscopic appendicectomy', durationMin: 45,
    position: 'Supine', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Clip applicator or Endo-GIA'], antibiotics: 'Cefazolin 2g + Metronidazole 500mg IV' },
  { group: 'colorectal', name: 'Open appendicectomy', durationMin: 45,
    position: 'Supine', anaesthetic: 'GA',
    equipment: ['General set'], antibiotics: 'Cefazolin 2g + Metronidazole 500mg IV' },
  { group: 'colorectal', name: 'Laparoscopic right hemicolectomy', durationMin: 150,
    position: 'Supine', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Linear + circular stapler', 'Vessel sealer'], antibiotics: 'Cefazolin 2g + Metronidazole 500mg IV' },
  { group: 'colorectal', name: 'Laparoscopic anterior resection', durationMin: 180,
    position: 'Lloyd-Davies (lithotomy)', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Circular stapler 29mm', 'Linear stapler', 'Vessel sealer', 'Rectal washout kit'],
    antibiotics: 'Cefazolin 2g + Metronidazole 500mg IV' },
  { group: 'colorectal', name: "Hartmann's procedure", durationMin: 120,
    position: 'Lloyd-Davies', anaesthetic: 'GA',
    equipment: ['General + laparoscopic stack', 'Linear stapler', 'Stoma bag kit'], antibiotics: 'Cefazolin 2g + Metronidazole 500mg IV' },
  { group: 'colorectal', name: 'Haemorrhoidectomy (Ferguson)', durationMin: 45,
    position: 'Lloyd-Davies or prone jack-knife', anaesthetic: 'Spinal or GA',
    equipment: ['Proctoscopy set', 'Diathermy'], antibiotics: 'None routine' },
  // Upper GI
  { group: 'upper_gi', name: 'Laparoscopic Nissen fundoplication', durationMin: 120,
    position: 'Supine (split legs, reverse Trendelenburg)', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Liver retractor', 'Bougie 56Fr'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'upper_gi', name: 'Laparoscopic sleeve gastrectomy (LSG)', durationMin: 90,
    position: 'Supine (split legs)', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Linear stapler (green/blue loads)', 'Bougie 36Fr'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'upper_gi', name: 'Laparoscopic Roux-en-Y gastric bypass (RYGB)', durationMin: 150,
    position: 'Supine (split legs)', anaesthetic: 'GA',
    equipment: ['Laparoscopic stack', 'Circular stapler 21mm', 'Linear stapler'], antibiotics: 'Cefazolin 2g IV' },
  // Endoscopy
  { group: 'endoscopy', name: 'OGD — diagnostic', durationMin: 15,
    position: 'Left lateral', anaesthetic: 'Conscious sedation (Midazolam + Fentanyl)',
    equipment: ['Upper GI endoscopy tower', 'Gastroscope (GIF-H290)'], antibiotics: 'None' },
  { group: 'endoscopy', name: 'OGD — biopsy / dilation / injection', durationMin: 25,
    position: 'Left lateral', anaesthetic: 'Conscious sedation',
    equipment: ['Upper GI endoscopy tower', 'Biopsy forceps', 'Injection needle / balloon dilator'], antibiotics: 'None' },
  { group: 'endoscopy', name: 'OGD — variceal banding', durationMin: 30,
    position: 'Left lateral', anaesthetic: 'Conscious sedation',
    equipment: ['Upper GI endoscopy tower', '6-band variceal banding kit'], antibiotics: 'Ceftriaxone 1g IV' },
  { group: 'endoscopy', name: 'Colonoscopy — diagnostic', durationMin: 40,
    position: 'Left lateral', anaesthetic: 'Conscious sedation',
    equipment: ['Lower GI endoscopy tower', 'Colonoscope (CF-HQ190)'], antibiotics: 'None' },
  { group: 'endoscopy', name: 'Colonoscopy + polypectomy / EMR', durationMin: 60,
    position: 'Left lateral', anaesthetic: 'Conscious sedation',
    equipment: ['Lower GI endoscopy tower', 'Cold snare', 'Hot snare', 'Haemostatic clips'], antibiotics: 'None' },
  { group: 'endoscopy', name: 'ERCP — sphincterotomy / stone extraction', durationMin: 75,
    position: 'Prone', anaesthetic: 'Propofol TIVA (deep sedation)',
    equipment: ['ERCP duodenoscope', 'C-arm fluoroscopy', 'Sphincterotome', 'Extraction balloon', 'Dormia basket', 'Contrast medium'],
    antibiotics: 'Ciprofloxacin 400mg IV' },
  { group: 'endoscopy', name: 'ERCP — biliary stenting (plastic / SEMS)', durationMin: 90,
    position: 'Prone', anaesthetic: 'Propofol TIVA (deep sedation)',
    equipment: ['ERCP duodenoscope', 'C-arm fluoroscopy', 'Sphincterotome', 'Stent delivery system', 'Plastic stents / SEMS'],
    antibiotics: 'Ciprofloxacin 400mg IV' },
  // Breast & Thyroid
  { group: 'breast_thyroid', name: 'Wide local excision (WLE)', durationMin: 45,
    position: 'Supine (arm extended)', anaesthetic: 'GA',
    equipment: ['General set', 'Diathermy'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'breast_thyroid', name: 'Mastectomy (simple / modified radical)', durationMin: 120,
    position: 'Supine (arm extended)', anaesthetic: 'GA',
    equipment: ['General set', 'LigaSure', 'JP drain'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'breast_thyroid', name: 'Sentinel node biopsy (SLNB)', durationMin: 45,
    position: 'Supine (arm extended)', anaesthetic: 'GA',
    equipment: ['General set', 'Gamma probe (nuclear medicine pre-op)'], antibiotics: 'Cefazolin 2g IV' },
  { group: 'breast_thyroid', name: 'Total thyroidectomy', durationMin: 120,
    position: 'Supine (neck extended, shoulder roll)', anaesthetic: 'GA',
    equipment: ['Thyroid set', 'Harmonic scalpel', 'Nerve integrity monitor (NIM)', 'Hemovac drain'], antibiotics: 'None routine' },
  { group: 'breast_thyroid', name: 'Hemithyroidectomy / thyroid lobectomy', durationMin: 90,
    position: 'Supine (neck extended)', anaesthetic: 'GA',
    equipment: ['Thyroid set', 'Harmonic scalpel', 'NIM'], antibiotics: 'None routine' },
  { group: 'breast_thyroid', name: 'Parathyroidectomy', durationMin: 90,
    position: 'Supine (neck extended)', anaesthetic: 'GA',
    equipment: ['Parathyroid set', 'Harmonic scalpel', 'Rapid iPTH assay', 'NIM'], antibiotics: 'None routine' },
  // Other
  { group: 'other', name: 'Soft tissue excision (lipoma / sebaceous cyst)', durationMin: 20,
    position: 'Variable', anaesthetic: 'LA or LA + sedation',
    equipment: ['Minor set', 'Diathermy'], antibiotics: 'None routine' },
  { group: 'other', name: 'Wound debridement + VAC application', durationMin: 30,
    position: 'Variable', anaesthetic: 'GA or Regional',
    equipment: ['Debridement set', 'VAC dressing system'], antibiotics: 'As per microbiology' },
  { group: 'other', name: 'Abscess incision & drainage (I&D)', durationMin: 20,
    position: 'Variable', anaesthetic: 'GA or LA',
    equipment: ['Minor set', 'Packing material'], antibiotics: 'None routine' },
];

const GROUP_LABELS: Record<ProcGroup, string> = {
  hepatobiliary: 'Hepatobiliary', hernia: 'Hernia', colorectal: 'Colorectal',
  upper_gi: 'Upper GI', endoscopy: 'Endoscopy', breast_thyroid: 'Breast & Thyroid', other: 'Other',
};

const LOCATIONS = [
  { id: 'tapion',      label: 'Tapion Hospital Theatre' },
  { id: 'rodney_bay',  label: 'Rodney Bay Day Surgery' },
  { id: 'tapion_ercp', label: 'Tapion ERCP / Endoscopy Suite' },
];

const SESSION_TYPES: [SessionKey, string][] = [
  ['morning',   'Morning list (08:30)'],
  ['afternoon', 'Afternoon list (13:30)'],
  ['full_day',  'Full day (08:30)'],
  ['ercp',      'ERCP / Endo (08:30)'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMins(t: string, m: number): string {
  const [h, mm] = t.split(':').map(Number);
  const total = h * 60 + (mm ?? 0) + m;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function defaultDate(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/St_Lucia' }));
  const d = now.getDay();
  const add = d === 0 ? 2 : d === 1 ? 1 : d === 2 ? 0 : d === 3 ? 1 : d === 4 ? 0 : d === 5 ? 1 : 0;
  const dt = new Date(now);
  dt.setDate(dt.getDate() + add);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function displayDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-LC', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function turnover(procGroup?: string) { return procGroup === 'endoscopy' ? 10 : 15; }

function buildSchedule(cases: ApiCase[], startHHMM: string) {
  const result: { start: string; end: string }[] = [];
  let cur = startHHMM;
  for (const c of cases) {
    const end = addMins(cur, c.durationMin);
    result.push({ start: cur, end });
    cur = addMins(end, turnover(c.procGroup));
  }
  return result;
}

const EMPTY_ADD = {
  patientName: '', procedure: '', durationMin: '', notes: '',
  position: '', anaesthetic: '', equipment: [] as string[], antibiotics: '', group: 'other' as ProcGroup,
};

// ─── SessionCard ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: ApiSession;
  dateStr: string;
  onReload: () => void;
}

function SessionCard({ session, dateStr, onReload }: SessionCardProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [add, setAdd] = useState({ ...EMPTY_ADD });
  const [publishing, setPublishing] = useState(false);

  const cases = [...session.cases].sort((a, b) => a.sortOrder - b.sortOrder);
  const schedule = buildSchedule(cases, session.startHHMM);
  const totalSurgical = cases.reduce((s, c) => s + c.durationMin, 0);
  const totalTurnover = cases.length > 1
    ? cases.slice(0, -1).reduce((s, c) => s + turnover(c.procGroup), 0) : 0;
  const totalWithTurnover = totalSurgical + totalTurnover;
  const capacity = session.capacityMin;
  const pct = Math.min(100, Math.round((totalWithTurnover / capacity) * 100));
  const overrun = totalWithTurnover > capacity;
  const pctColor = overrun ? '#ef4444' : pct > 85 ? '#f59e0b' : '#10b981';
  const groups = Object.keys(GROUP_LABELS) as ProcGroup[];

  function handleTemplateChange(name: string) {
    const tpl = T.find(t => t.name === name);
    if (tpl) {
      setAdd(s => ({ ...s, procedure: tpl.name, durationMin: String(tpl.durationMin), position: tpl.position, anaesthetic: tpl.anaesthetic, equipment: [...tpl.equipment], antibiotics: tpl.antibiotics, group: tpl.group }));
    } else {
      setAdd(s => ({ ...s, procedure: name }));
    }
  }

  async function handleAddCase() {
    if (!add.patientName.trim() || !add.procedure.trim()) return;
    const dur = parseInt(add.durationMin, 10) || 60;
    try {
      const res = await fetch(`/api/theatre/sessions/${session.id}/cases`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: add.patientName.trim(),
          procedure: add.procedure.trim(),
          durationMin: dur,
          position: add.position || undefined,
          anaesthetic: add.anaesthetic || undefined,
          equipment: add.equipment.length ? add.equipment : undefined,
          antibiotics: add.antibiotics || undefined,
          notes: add.notes.trim() || undefined,
          procGroup: add.group,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAdd({ ...EMPTY_ADD });
      setShowAdd(false);
      onReload();
    } catch (e) {
      alert('Failed to add case: ' + String(e));
    }
  }

  async function handleDelete(caseId: string) {
    if (!confirm('Remove this case from the list?')) return;
    try {
      const res = await fetch(`/api/theatre/cases/${caseId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      onReload();
    } catch (e) {
      alert('Failed to delete case: ' + String(e));
    }
  }

  async function handleMove(idx: number, dir: 'up' | 'down') {
    const moved = [...cases];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    [moved[idx], moved[swapIdx]] = [moved[swapIdx], moved[idx]];
    const order = moved.map((c, i) => ({ id: c.id, sortOrder: i }));
    try {
      const res = await fetch(`/api/theatre/sessions/${session.id}/cases/reorder`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error(await res.text());
      onReload();
    } catch (e) {
      alert('Failed to reorder: ' + String(e));
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/theatre/sessions/${session.id}/publish`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      alert(data.calendarUpdated
        ? 'Operating list published and Google Calendar event updated.'
        : 'Operating list published. (No Google Calendar event linked — database updated only.)');
      onReload();
    } catch (e) {
      alert('Failed to publish: ' + String(e));
    } finally {
      setPublishing(false);
    }
  }

  function printList() {
    const w = window.open('', '_blank');
    if (!w) return;
    const caseRows = cases.map((c, i) => {
      const s = schedule[i];
      const noAbx = !c.antibiotics || c.antibiotics === 'None' || c.antibiotics === 'None routine';
      return `<div class="case">
        <div class="ch">Case ${i + 1} &nbsp;·&nbsp; ${s?.start ?? '?'}–${s?.end ?? '?'} (${c.durationMin} min)</div>
        <table>
          <tr><td class="l">Patient</td><td><strong>${c.patientName}</strong></td></tr>
          <tr><td class="l">Procedure</td><td><strong>${c.procedure}</strong></td></tr>
          <tr><td class="l">Position</td><td>${c.position || '—'}</td></tr>
          <tr><td class="l">Anaesthesia</td><td>${c.anaesthetic || '—'}</td></tr>
          <tr><td class="l">Equipment</td><td>${c.equipment?.length ? c.equipment.join(', ') : '—'}</td></tr>
          <tr><td class="l">Antibiotics</td><td>${noAbx ? 'None' : (c.antibiotics || '—')}</td></tr>
          ${c.notes ? `<tr><td class="l">Notes</td><td><em>${c.notes}</em></td></tr>` : ''}
        </table>
      </div>`;
    }).join('');
    const finish = schedule.length ? schedule[schedule.length - 1].end : session.startHHMM;
    w.document.write(`<!DOCTYPE html><html><head><title>Theatre List — ${displayDate(dateStr)}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:28px;color:#111}
      h1{font-size:16px;margin:0 0 2px}
      .sub{font-size:11px;color:#555;margin-bottom:14px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 20px;font-size:11px;padding:8px 12px;background:#f5f5f5;border:1px solid #ddd;margin-bottom:14px}
      .case{border:1px solid #ccc;margin-bottom:10px;page-break-inside:avoid}
      .ch{background:#1e3a2e;color:#fff;padding:5px 10px;font-size:12px;font-weight:700}
      table{width:100%;border-collapse:collapse}
      td{padding:3px 10px;font-size:11px;vertical-align:top}
      td.l{width:90px;color:#555;font-weight:600}
      tr:nth-child(even){background:#f9f9f9}
      .sum{margin-top:14px;padding:8px 12px;border:2px solid #1e3a2e;font-size:11px}
      .warn{color:#b91c1c;font-weight:700}
      .disc{margin-top:16px;font-size:10px;color:#777;border-top:1px solid #ddd;padding-top:6px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>Theatre Operating List</h1>
    <div class="sub">AMISE MEDICAL SERVICES · ${session.locationLabel}</div>
    <div class="meta">
      <div><strong>Date:</strong> ${displayDate(dateStr)}</div>
      <div><strong>Session:</strong> ${session.sessionLabel} (${session.startHHMM})</div>
      <div><strong>Surgeon:</strong> Mr Dawit Daniel Kabiye, MD, DM</div>
      <div><strong>Estimated finish:</strong> ${finish}</div>
      <div><strong>Cases:</strong> ${cases.length}</div>
      <div><strong>Total surgical time:</strong> ${totalSurgical} min${totalTurnover > 0 ? ` + ${totalTurnover} min turnover = ${totalWithTurnover} min` : ''}</div>
    </div>
    ${caseRows}
    <div class="sum">
      Block: ${capacity} min &nbsp;|&nbsp; Used: ${totalWithTurnover} min &nbsp;|&nbsp; Remaining: ${Math.max(0, capacity - totalWithTurnover)} min
      ${overrun ? '<br><span class="warn">⚠ LIST EXCEEDS BLOCK CAPACITY BY ' + (totalWithTurnover - capacity) + ' MIN</span>' : ''}
    </div>
    <div class="disc">This list is for theatre coordination only. All clinical decisions remain with the operating surgeon. · Generated ${new Date().toLocaleString('en-LC', { timeZone: 'America/St_Lucia' })}</div>
    <br><button onclick="window.print()">🖨 Print</button>&nbsp;<button onclick="window.close()">Close</button>
    </body></html>`);
    w.document.close();
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
      {/* Session header */}
      <div style={{ background: '#1e3a2e', color: '#fff', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {session.cal_summary || session.sessionLabel}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
            {session.startHHMM} · {session.locationLabel}
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10, letterSpacing: '0.5px',
          background: session.status === 'published' ? '#10b981' : 'rgba(255,255,255,.2)',
          color: '#fff',
        }}>
          {session.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
        </span>
      </div>

      <div style={{ padding: '12px 14px' }}>
        {/* Capacity bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>Block: {capacity} min</span>
            <span style={{ color: overrun ? '#b91c1c' : '#374151', fontWeight: overrun ? 700 : 400 }}>
              {totalWithTurnover} / {capacity} min {overrun ? '⚠ overrun' : `(${capacity - totalWithTurnover} min free)`}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: pctColor, transition: 'width .3s' }} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 3, fontSize: 10, color: '#9ca3af' }}>
            <span style={{ color: '#10b981' }}>■ Surgical: {totalSurgical} min</span>
            {totalTurnover > 0 && <span style={{ color: '#6b7280' }}>■ Turnover: {totalTurnover} min</span>}
            {schedule.length > 0 && <span>Est. finish: {schedule[schedule.length - 1].end}</span>}
          </div>
        </div>

        {/* Cases */}
        {cases.length === 0 && (
          <div style={{ textAlign: 'center', padding: '14px 0', color: '#9ca3af', fontSize: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 10 }}>
            No cases yet — add the first case below.
          </div>
        )}

        {cases.map((c, i) => {
          const s = schedule[i];
          return (
            <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 7, marginBottom: 7, overflow: 'hidden' }}>
              <div style={{ background: '#374151', color: '#fff', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Case {i + 1} · {s?.start ?? '?'}–{s?.end ?? '?'} ({c.durationMin} min)</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleMove(i, 'up')} disabled={i === 0}
                    style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 11, cursor: 'pointer', opacity: i === 0 ? .3 : 1 }}>▲</button>
                  <button onClick={() => handleMove(i, 'down')} disabled={i === cases.length - 1}
                    style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 11, cursor: 'pointer', opacity: i === cases.length - 1 ? .3 : 1 }}>▼</button>
                  <button onClick={() => handleDelete(c.id)}
                    style={{ background: 'rgba(239,68,68,.4)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ padding: '7px 10px', fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{c.patientName} — {c.procedure}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>{[c.position, c.anaesthetic].filter(Boolean).join(' · ')}</div>
                {c.equipment?.length ? <div style={{ color: '#374151', fontSize: 11, marginTop: 2 }}>Equipment: {c.equipment.join(', ')}</div> : null}
                {c.antibiotics && c.antibiotics !== 'None' && c.antibiotics !== 'None routine' &&
                  <div style={{ color: '#374151', fontSize: 11, marginTop: 2 }}>Prophylaxis: {c.antibiotics}</div>}
                {c.notes && <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>{c.notes}</div>}
              </div>
            </div>
          );
        })}

        {/* Add case form */}
        {showAdd && (
          <div style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 12, marginBottom: 10, background: '#f9fafb' }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e3a2e' }}>Add case to list</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Patient name *</div>
                <input type="text" value={add.patientName} onChange={e => setAdd(s => ({ ...s, patientName: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  onKeyDown={e => e.key === 'Enter' && void handleAddCase()} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Duration (min)</div>
                <input type="number" value={add.durationMin} onChange={e => setAdd(s => ({ ...s, durationMin: e.target.value }))}
                  placeholder="60" min={5} max={600}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Procedure template (auto-fills details)</div>
              <select value={T.find(t => t.name === add.procedure) ? add.procedure : ''}
                onChange={e => handleTemplateChange(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db' }}>
                <option value="">— Select template to auto-fill —</option>
                {groups.map(g => (
                  <optgroup key={g} label={GROUP_LABELS[g]}>
                    {T.filter(t => t.group === g).map(t => (
                      <option key={t.name} value={t.name}>{t.name} ({t.durationMin} min)</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Procedure name * (edit if needed)</div>
              <input type="text" value={add.procedure} onChange={e => setAdd(s => ({ ...s, procedure: e.target.value }))}
                placeholder="e.g. Laparoscopic cholecystectomy"
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            </div>
            {add.procedure && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 11, color: '#166534' }}>
                {add.position && <div>Position: {add.position}</div>}
                {add.anaesthetic && <div>Anaesthesia: {add.anaesthetic}</div>}
                {add.equipment.length > 0 && <div>Equipment: {add.equipment.join(', ')}</div>}
                {add.antibiotics && <div>Antibiotics: {add.antibiotics}</div>}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Notes (optional)</div>
              <input type="text" value={add.notes} onChange={e => setAdd(s => ({ ...s, notes: e.target.value }))}
                placeholder="e.g. first case, known difficult airway, DVT prophylaxis required"
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                onKeyDown={e => e.key === 'Enter' && void handleAddCase()} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void handleAddCase()} disabled={!add.patientName.trim() || !add.procedure.trim()}
                style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: (!add.patientName.trim() || !add.procedure.trim()) ? '#9ca3af' : '#1e3a2e', color: '#fff' }}>
                Add to list
              </button>
              <button onClick={() => { setShowAdd(false); setAdd({ ...EMPTY_ADD }); }}
                style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)}
              style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: '#1e3a2e', color: '#fff', border: 'none', cursor: 'pointer' }}>
              + Add Case
            </button>
          )}
          {cases.length > 0 && (
            <>
              <button onClick={printList}
                style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                🖨 Print
              </button>
              {session.status !== 'published' && (
                <button onClick={() => void handlePublish()} disabled={publishing}
                  style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: '#0b8278', color: '#fff', border: 'none',
                    cursor: publishing ? 'wait' : 'pointer', opacity: publishing ? .7 : 1 }}>
                  {publishing ? 'Publishing…' : 'Publish →'}
                </button>
              )}
            </>
          )}
        </div>

        {cases.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
            {cases.length} case{cases.length !== 1 ? 's' : ''} · {totalSurgical} min surgical · {totalWithTurnover} min total
            {!overrun && ` · ${capacity - totalWithTurnover} min remaining`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TheatreListBuilderCard() {
  const [date, setDate] = useState(defaultDate);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newSessionType, setNewSessionType] = useState<SessionKey>('morning');
  const [newLocationKey, setNewLocationKey] = useState('tapion');
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/theatre/sessions?date=${d}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { sessions: ApiSession[] };
      setSessions(data.sessions ?? []);
    } catch (e) {
      setError('Could not load sessions. Check Google Calendar credentials and try again.');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(date); }, [date, reload]);

  async function createSession() {
    setCreating(true);
    try {
      const res = await fetch('/api/theatre/sessions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, sessionType: newSessionType, locationKey: newLocationKey }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowCreate(false);
      void reload(date);
    } catch (e) {
      alert('Failed to create session: ' + String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <CollapsibleCard title="Theatre Operating List" defaultOpen={false}>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Sessions are driven by Google Calendar — select a date to load theatre and endoscopy lists. Add cases to each session and publish to update the calendar event.
      </p>

      {/* Date picker row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Date</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db' }} />
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8 }}>{displayDate(date)}</div>
        <button onClick={() => void reload(date)} disabled={loading}
          style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer', marginBottom: 0 }}>
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, marginBottom: 12, fontSize: 12, color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 12 }}>
          Loading sessions from Google Calendar…
        </div>
      )}

      {/* Session cards */}
      {!loading && sessions.map(s => (
        <SessionCard key={s.id} session={s} dateStr={date} onReload={() => void reload(date)} />
      ))}

      {/* Empty state */}
      {!loading && sessions.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 12 }}>
          No theatre or endoscopy sessions found in Google Calendar for this date.
        </div>
      )}

      {/* Create manual session */}
      {!loading && !showCreate && (
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer', marginTop: 4 }}>
          + Create manual session
        </button>
      )}

      {!loading && showCreate && (
        <div style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 14, background: '#f9fafb', marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e3a2e' }}>Create manual session</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Session type</div>
              <select value={newSessionType} onChange={e => setNewSessionType(e.target.value as SessionKey)}
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db' }}>
                {SESSION_TYPES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Location</div>
              <select value={newLocationKey} onChange={e => setNewLocationKey(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db' }}>
                {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void createSession()} disabled={creating}
              style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: '#1e3a2e', color: '#fff', opacity: creating ? .7 : 1 }}>
              {creating ? 'Creating…' : 'Create session'}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
