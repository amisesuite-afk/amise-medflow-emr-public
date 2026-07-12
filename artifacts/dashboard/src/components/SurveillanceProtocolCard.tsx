import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = 'routine' | 'expedited' | 'urgent';

interface SurveillanceRecord {
  id: string;
  protocol: string;
  test: string;
  indication: string;
  procedureDate: string;  // YYYY-MM-DD (when the current procedure was done)
  dueDate: string;        // YYYY-MM-DD
  intervalLabel: string;
  priority: Priority;
  notes: string;
}

interface ProtocolDef {
  category: string;
  name: string;
  test: string;
  intervalDays: number | null;
  intervalLabel: string;
  priority: Priority;
  guidanceNote: string;
}

// ─── Protocol library ─────────────────────────────────────────────────────────

const PROTOCOLS: ProtocolDef[] = [
  // Colonoscopy — BSG 2019
  { category: 'Colonoscopy (BSG 2019)', name: 'Low-risk adenoma — no surveillance', test: 'No further colonoscopy', intervalDays: null, intervalLabel: 'None required', priority: 'routine', guidanceNote: '1–2 tubular adenomas <10 mm. BSG 2019: no routine colonoscopy surveillance.' },
  { category: 'Colonoscopy (BSG 2019)', name: 'Intermediate-risk adenoma — 3 years', test: 'Colonoscopy', intervalDays: 3*365, intervalLabel: '3 years', priority: 'routine', guidanceNote: '3–4 adenomas <10 mm, or 1–2 adenomas 10–19 mm (any histology).' },
  { category: 'Colonoscopy (BSG 2019)', name: 'High-risk adenoma — 1 year', test: 'Colonoscopy', intervalDays: 365, intervalLabel: '1 year', priority: 'expedited', guidanceNote: '5+ adenomas, or any adenoma ≥20 mm.' },
  { category: 'Colonoscopy (BSG 2019)', name: 'SSL ≥10 mm / SSL with dysplasia — 1 year', test: 'Colonoscopy', intervalDays: 365, intervalLabel: '1 year', priority: 'expedited', guidanceNote: 'Sessile serrated lesion ≥10 mm or with any dysplasia.' },
  { category: 'Colonoscopy (BSG 2019)', name: 'HGD / suspected carcinoma — urgent MDT', test: 'MDT referral + repeat colonoscopy', intervalDays: 90, intervalLabel: '3 months (urgent)', priority: 'urgent', guidanceNote: 'High-grade dysplasia or suspected malignancy on biopsy — urgent MDT discussion.' },
  { category: 'Colonoscopy (BSG 2019)', name: 'IBD — annual surveillance colonoscopy', test: 'Colonoscopy with chromoendoscopy', intervalDays: 365, intervalLabel: '1 year', priority: 'expedited', guidanceNote: 'Longstanding UC or Crohn\'s colitis (>10 years, extensive disease).' },
  // Barrett's — BSG 2015
  { category: "Barrett's oesophagus (BSG 2015)", name: "Non-dysplastic Barrett's <3 cm — 5 years", test: 'OGD with quadrantic biopsies (Prague protocol)', intervalDays: 5*365, intervalLabel: '5 years', priority: 'routine', guidanceNote: 'Non-dysplastic Barrett\'s, short segment <3 cm.' },
  { category: "Barrett's oesophagus (BSG 2015)", name: "Non-dysplastic Barrett's ≥3 cm — 3 years", test: 'OGD with quadrantic biopsies (Prague protocol)', intervalDays: 3*365, intervalLabel: '3 years', priority: 'routine', guidanceNote: 'Non-dysplastic Barrett\'s, long segment ≥3 cm.' },
  { category: "Barrett's oesophagus (BSG 2015)", name: "Low-grade dysplasia — 6 months (confirm)", test: 'OGD — confirm LGD, then annual', intervalDays: 180, intervalLabel: '6 months', priority: 'expedited', guidanceNote: 'Confirm LGD at 6 months. If confirmed: annual OGD. Consider endoscopic eradication therapy (RFA/EMR).' },
  { category: "Barrett's oesophagus (BSG 2015)", name: "High-grade dysplasia — urgent MDT", test: 'Urgent MDT + OGD within 3 months', intervalDays: 90, intervalLabel: '3 months (urgent)', priority: 'urgent', guidanceNote: 'Endoscopic eradication therapy (RFA/EMR) indicated. Urgent multidisciplinary discussion.' },
  // Post-operative
  { category: 'Post-operative', name: 'Post-colorectal cancer — CT (annual × 3)', test: 'CT chest/abdomen/pelvis with contrast', intervalDays: 365, intervalLabel: 'Year 1, 2, 3', priority: 'routine', guidanceNote: 'CEA every 3 months for first 2 years. Annual colonoscopy × 5 years.' },
  { category: 'Post-operative', name: 'Post-colorectal cancer — annual colonoscopy × 5 yr', test: 'Colonoscopy', intervalDays: 365, intervalLabel: 'Annually × 5 years', priority: 'routine', guidanceNote: 'Year 1, 3, 5 post-resection (or per oncology recommendation).' },
  { category: 'Post-operative', name: 'Post-gastric ulcer — healing check OGD', test: 'OGD with biopsies', intervalDays: 49, intervalLabel: '6–8 weeks', priority: 'expedited', guidanceNote: 'Confirm mucosal healing and exclude malignancy. CLO test to confirm H. pylori eradication.' },
  { category: 'Post-operative', name: 'Post-ERCP plastic stent — exchange / removal', test: 'ERCP or MRCP + stent exchange', intervalDays: 90, intervalLabel: '3 months', priority: 'routine', guidanceNote: 'Plastic biliary stents must be exchanged every 3 months to prevent occlusion / cholangitis.' },
  { category: 'Post-operative', name: 'Post-thyroidectomy — TFTs + thyroglobulin (6 weeks)', test: 'TFTs, thyroglobulin, anti-Tg antibodies', intervalDays: 42, intervalLabel: '6 weeks', priority: 'routine', guidanceNote: 'Check TFTs 6 weeks post-op for levothyroxine dose adjustment. Stimulated Tg for DTC surveillance.' },
  { category: 'Post-operative', name: 'Post-thyroidectomy — USS neck (6 months)', test: 'Ultrasound neck', intervalDays: 180, intervalLabel: '6 months', priority: 'routine', guidanceNote: 'USS neck at 6 months; annually thereafter if differentiated thyroid cancer.' },
  { category: 'Post-operative', name: 'Post-mastectomy — annual mammogram contralateral', test: 'Mammogram (contralateral breast)', intervalDays: 365, intervalLabel: 'Annually × 5 years', priority: 'routine', guidanceNote: 'Contralateral breast surveillance. Ipsilateral if breast-conserving surgery.' },
  // Pancreas
  { category: 'Pancreas / Other', name: 'Branch-duct IPMN <3 cm — 6 months', test: 'MRCP or EUS', intervalDays: 180, intervalLabel: '6 months (then annually if stable)', priority: 'routine', guidanceNote: 'Without high-risk stigmata (no jaundice, duct dilatation, mural nodule, cytology). Per ISGPS 2017.' },
  { category: 'Pancreas / Other', name: 'Main-duct IPMN — urgent MDT', test: 'MRCP + EUS + urgent MDT referral', intervalDays: 28, intervalLabel: '4 weeks (urgent)', priority: 'urgent', guidanceNote: 'High malignancy risk. Surgical resection should be discussed. Urgent referral.' },
];

const PRIORITY_STYLE: Record<Priority, { color: string; bg: string; label: string }> = {
  routine:   { color: '#065f46', bg: '#d1fae5', label: 'Routine' },
  expedited: { color: '#92400e', bg: '#fef3c7', label: 'Expedited' },
  urgent:    { color: '#991b1b', bg: '#fee2e2', label: 'Urgent' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayECT(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/St_Lucia' }));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(s: string): string {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en-LC', { day:'numeric', month:'long', year:'numeric' });
}

function daysUntil(s: string): number {
  const today = new Date(todayECT());
  const due = new Date(s);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function uid() { return Math.random().toString(36).slice(2, 8); }

const CATEGORIES = Array.from(new Set(PROTOCOLS.map(p => p.category)));

// ─── Component ────────────────────────────────────────────────────────────────

export default function SurveillanceProtocolCard() {
  const { patientName, dob, procedureData, setProcedureData } = useAppContext();

  const records = (procedureData['surveillance'] ?? []) as SurveillanceRecord[];
  function setRecords(r: SurveillanceRecord[]) {
    setProcedureData({ ...procedureData, surveillance: r });
  }

  const [showAdd, setShowAdd] = useState(false);
  const [filterCat, setFilterCat] = useState(CATEGORIES[0]);
  const [selectedProto, setSelectedProto] = useState<ProtocolDef | null>(null);
  const [indication, setIndication] = useState('');
  const [overrideDue, setOverrideDue] = useState('');

  function handleAdd() {
    if (!selectedProto) return;
    const today = todayECT();
    const dueDateAuto = selectedProto.intervalDays ? addDays(today, selectedProto.intervalDays) : '';
    const dueDate = overrideDue || dueDateAuto;
    const rec: SurveillanceRecord = {
      id: uid(),
      protocol: selectedProto.name,
      test: selectedProto.test,
      indication: indication.trim(),
      procedureDate: today,
      dueDate,
      intervalLabel: selectedProto.intervalLabel,
      priority: selectedProto.priority,
      notes: selectedProto.guidanceNote,
    };
    setRecords([...records, rec]);
    setSelectedProto(null);
    setIndication('');
    setOverrideDue('');
    setShowAdd(false);
  }

  function removeRecord(id: string) {
    setRecords(records.filter(r => r.id !== id));
  }

  function printRecallLetter(rec: SurveillanceRecord) {
    const dob_ = dob ? ` (DOB: ${fmtDate(dob)})` : '';
    const urgent = rec.priority === 'urgent';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
    <title>Surveillance Recall — ${patientName || 'Patient'}</title>
    <style>
      body{font-family:Georgia,serif;font-size:12px;margin:0;padding:40px;color:#111;max-width:680px}
      .header{border-bottom:2px solid #1e3a2e;padding-bottom:10px;margin-bottom:20px}
      h1{font-size:14px;margin:0;color:#1e3a2e}
      .sub{font-size:11px;color:#555}
      .highlight{background:${urgent?'#fee2e2':'#f0fdf4'};border:1.5px solid ${urgent?'#fca5a5':'#6ee7b7'};border-radius:6px;padding:12px 16px;margin:16px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      td{padding:5px 10px;font-size:11px;vertical-align:top;border-bottom:1px solid #e5e7eb}
      td:first-child{width:160px;font-weight:700;color:#555}
      .sig{margin-top:32px;font-size:11px}
      .footer{margin-top:24px;font-size:10px;color:#777;border-top:1px solid #ddd;padding-top:8px}
      @media print{button{display:none}}
    </style></head><body>
    <div class="header">
      <h1>AMISE MEDICAL SERVICES</h1>
      <div class="sub">Mr Dawit Daniel Kabiye, MD, DM · Consultant General &amp; Endoscopic Surgeon<br>
      Rodney Bay Medical Centre &amp; Tapion Hospital · Saint Lucia · Tel: +1 (758) 284-0557</div>
    </div>
    <p>${fmtDate(todayECT())}</p>
    <p>Dear <strong>${patientName || 'Patient'}${dob_}</strong>,</p>
    <p>Following your recent procedure on <strong>${fmtDate(rec.procedureDate)}</strong>, you have been enrolled in a surveillance programme as summarised below.</p>
    ${urgent ? '<p><strong style="color:#991b1b">⚠ This is an urgent recommendation. Please contact the practice immediately.</strong></p>' : ''}
    <div class="highlight">
      <strong>${rec.protocol}</strong>${rec.indication ? `<br><em>Reason: ${rec.indication}</em>` : ''}
    </div>
    <table>
      <tr><td>Test required</td><td>${rec.test}</td></tr>
      <tr><td>Interval</td><td>${rec.intervalLabel}</td></tr>
      ${rec.dueDate ? `<tr><td>Due by</td><td><strong>${fmtDate(rec.dueDate)}</strong></td></tr>` : ''}
      <tr><td>Priority</td><td>${rec.priority.charAt(0).toUpperCase()+rec.priority.slice(1)}</td></tr>
    </table>
    <p>Please contact the practice at the number above to schedule your appointment <strong>at least 4 weeks before the due date</strong>.</p>
    <p>If you develop any new or worsening symptoms before your surveillance date — including rectal bleeding, change in bowel habit, unintentional weight loss, abdominal pain, or any other concern — please contact us promptly or attend the nearest emergency department.</p>
    <p>This letter is for your records. A copy has been retained in your medical file.</p>
    <div class="sig">
      <p>Yours sincerely,<br><br>
      <strong>Mr Dawit Daniel Kabiye, MD, DM</strong><br>
      Consultant General &amp; Endoscopic Surgeon<br>
      Amise Medical Services, Saint Lucia</p>
    </div>
    <div class="footer">
      Clinical information on this letter is confidential. If you believe you have received it in error, please contact the practice immediately.
      · Guideline reference: ${rec.notes}
    </div>
    <br><button onclick="window.print()">🖨 Print</button>&nbsp;<button onclick="window.close()">Close</button>
    </body></html>`);
    w.document.close();
  }

  const sortedRecords = [...records].sort((a, b) => {
    const pri = { urgent: 0, expedited: 1, routine: 2 };
    return (pri[a.priority] - pri[b.priority]) || a.dueDate.localeCompare(b.dueDate);
  });

  const urgent = sortedRecords.filter(r => r.priority === 'urgent').length;
  const overdue = sortedRecords.filter(r => r.dueDate && daysUntil(r.dueDate) < 0).length;

  const filteredProtos = PROTOCOLS.filter(p => p.category === filterCat);

  return (
    <CollapsibleCard
      title={`Surveillance Protocol Recall${records.length > 0 ? ` (${records.length}${urgent ? ` · ${urgent} urgent` : ''}${overdue ? ` · ${overdue} overdue` : ''})` : ''}`}
      defaultOpen={false}
    >
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Record evidence-based surveillance recommendations for this patient. Generate a dated recall letter for their records.
      </p>

      {/* Active records */}
      {sortedRecords.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '14px 0', color: '#9ca3af', fontSize: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 10 }}>
          No surveillance protocols recorded for this patient.
        </div>
      )}

      {sortedRecords.map(rec => {
        const ps = PRIORITY_STYLE[rec.priority];
        const days = rec.dueDate ? daysUntil(rec.dueDate) : null;
        const isOverdue = days !== null && days < 0;
        return (
          <div key={rec.id} style={{ border: `1.5px solid ${isOverdue ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{rec.protocol}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: ps.bg, color: ps.color }}>
                    {ps.label}
                  </span>
                  {isOverdue && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#fee2e2', color: '#991b1b' }}>OVERDUE</span>}
                </div>
                <div style={{ fontSize: 11, color: '#374151' }}>
                  <strong>Test:</strong> {rec.test}
                  {rec.indication && <> · <em>{rec.indication}</em></>}
                </div>
                {rec.dueDate && (
                  <div style={{ fontSize: 11, color: isOverdue ? '#b91c1c' : '#6b7280', marginTop: 2 }}>
                    {isOverdue
                      ? `⚠ Due date passed: ${fmtDate(rec.dueDate)} (${Math.abs(days!)} days ago)`
                      : `Due: ${fmtDate(rec.dueDate)} (in ${days} days · ${rec.intervalLabel})`}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => printRecallLetter(rec)}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                  🖨 Letter
                </button>
                <button onClick={() => removeRecord(rec.id)}
                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add protocol panel */}
      {showAdd && (
        <div style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 14, marginBottom: 10, background: '#f9fafb' }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e3a2e' }}>Add surveillance protocol</div>

          {/* Category chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { setFilterCat(cat); setSelectedProto(null); }}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid #d1d5db',
                  background: filterCat === cat ? '#1e3a2e' : '#fff', color: filterCat === cat ? '#fff' : '#374151' }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Protocol list */}
          <div style={{ marginBottom: 10 }}>
            {filteredProtos.map(p => {
              const sel = selectedProto?.name === p.name;
              const ps = PRIORITY_STYLE[p.priority];
              return (
                <div key={p.name} onClick={() => setSelectedProto(sel ? null : p)}
                  style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 5, cursor: 'pointer',
                    border: `1.5px solid ${sel ? '#1e3a2e' : '#e5e7eb'}`,
                    background: sel ? '#f0fdf4' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: sel ? 700 : 400 }}>{p.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: ps.bg, color: ps.color, flexShrink: 0, marginLeft: 8 }}>
                      {p.intervalLabel}
                    </span>
                  </div>
                  {sel && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{p.guidanceNote}</div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedProto && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Indication / specific finding (optional)</div>
                <input type="text" value={indication} onChange={e => setIndication(e.target.value)}
                  placeholder={`e.g. ${selectedProto.category.includes('Colonoscopy') ? '3 tubular adenomas, largest 12 mm, transverse colon' : selectedProto.category.includes("Barrett") ? "Barrett's segment C2M4, no dysplasia" : 'specify clinical indication'}`}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              {selectedProto.intervalDays && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>
                    Due date (auto: {fmtDate(addDays(todayECT(), selectedProto.intervalDays))} · override if needed)
                  </div>
                  <input type="date" value={overrideDue || addDays(todayECT(), selectedProto.intervalDays)}
                    onChange={e => setOverrideDue(e.target.value)}
                    style={{ padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db' }} />
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={!selectedProto}
              style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: !selectedProto ? '#9ca3af' : '#1e3a2e', color: '#fff' }}>
              Add to patient record
            </button>
            <button onClick={() => { setShowAdd(false); setSelectedProto(null); setIndication(''); setOverrideDue(''); }}
              style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      {!showAdd && (
        <button onClick={() => setShowAdd(true)}
          style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: '#1e3a2e', color: '#fff', border: 'none', cursor: 'pointer' }}>
          + Add Surveillance Protocol
        </button>
      )}
    </CollapsibleCard>
  );
}
