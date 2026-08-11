import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getProtocol, getProtocolByIcd } from '@workspace/pane-engine';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getActivePathways } from '@/lib/clinical-pathways';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import ResultsTrackerCard from '@/components/ResultsTrackerCard';
import LabInterpretationPanel from '@/components/LabInterpretationPanel';
import { useToast } from '@/components/ToastProvider';
import DocumentCapture from '@/components/DocumentCapture';
import { isImagingInvestigation, parseImagingToRequest, imagingAlreadyRequested } from '@/lib/imaging-utils';

function filterBySex(lab: string, sex: string): boolean {
  if (lab.includes('(M)') && sex === 'female') return false;
  if (lab.includes('(F)') && sex === 'male')   return false;
  return true;
}

function cleanLabel(lab: string): string {
  return lab.replace(/\s*\([MF]\)/g, '').trim();
}

// ── AI result scan ─────────────────────────────────────────────────────────

interface ExtractedResult {
  test: string;
  result: string;
  unit?: string | null;
  refRange?: string | null;
  flag?: 'H' | 'L' | 'C' | 'N' | '';
}

interface ExtractResponse {
  labName?: string | null;
  reportDate?: string | null;
  results: ExtractedResult[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatExtractedValue(r: ExtractedResult): string {
  let value = r.unit ? `${r.result} ${r.unit}` : r.result;
  if (r.flag) value += ` [${r.flag}]`;
  if (r.refRange) value += ` (ref: ${r.refRange})`;
  return value;
}

// ── Lab request print popup ───────────────────────────────────────────────────

function printLabRequest(p: {
  patientName: string; age: string; dob: string; sex: string; mrNumber: string;
  orderedInvestigations: string[]; indication: string; urgency: string; doctorName: string;
}) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeNow = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Exclude imaging studies — they live in the Radiology/Imaging tab, not the lab form
  const labOnly = p.orderedInvestigations.filter(t => !isImagingInvestigation(t));

  const categorised: Record<string, string[]> = {};
  for (const test of labOnly) {
    const tLower = test.toLowerCase().trim();
    let found = false;
    for (const group of LSL_CATALOGUE) {
      const matched = group.tests.some(t => {
        const cleaned = cleanLabel(t).toLowerCase();
        if (cleaned === tLower) return true;
        // Match abbreviation in parentheses e.g. "Full Blood Count (FBC)" → "fbc"
        const abbrev = t.match(/\(([^)]+)\)/)?.[1]?.toLowerCase();
        if (abbrev && abbrev === tLower) return true;
        // Broad substring: test name appears in catalogue name or vice-versa
        if (cleaned.includes(tLower) || tLower.includes(cleaned)) return true;
        return false;
      });
      if (matched) {
        (categorised[group.category] ??= []).push(test);
        found = true;
        break;
      }
    }
    if (!found) (categorised['Other / Custom'] ??= []).push(test);
  }

  const urgencyBg: Record<string, string> = { Routine: '#f3f4f6', Urgent: '#fef3c7', STAT: '#fee2e2' };
  const urgencyColor: Record<string, string> = { Routine: '#374151', Urgent: '#92400e', STAT: '#991b1b' };

  const testSections = Object.entries(categorised).map(([cat, tests]) =>
    `<div class="section-title">${cat}</div><div class="test-grid">${tests.map(t => `<div class="test-item">${t}</div>`).join('')}</div>`
  ).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Lab Request — ${p.patientName || 'Patient'}</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff}
.page{max-width:210mm;margin:0 auto;padding:15mm 14mm}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:9px;border-bottom:2.5px solid #1a3a5c;margin-bottom:12px}
.pname{font-size:16px;font-weight:800;color:#1a3a5c}.psub{font-size:10px;color:#555;margin-top:2px}
.form-title{font-size:14px;font-weight:800;text-align:center;text-transform:uppercase;letter-spacing:.12em;color:#1a3a5c;margin-bottom:11px}
.patient-box{border:1.5px solid #1a3a5c;border-radius:5px;padding:9px 12px;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px}
.pf label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;display:block;margin-bottom:2px}.pf span{font-size:12px;font-weight:600}
.info-row{display:flex;gap:18px;align-items:center;margin-bottom:10px;padding:7px 11px;border:1px solid #e5e7eb;border-radius:5px;background:#f9fafb}
.info-row label{font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-right:5px}
.badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;background:${urgencyBg[p.urgency] ?? '#f3f4f6'};color:${urgencyColor[p.urgency] ?? '#374151'}}
.section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1a3a5c;margin:9px 0 4px;padding-bottom:2px;border-bottom:1px solid #e5e7eb}
.test-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px 10px}
.test-item{font-size:11px;padding:3px 0;display:flex;align-items:center;gap:4px}.test-item::before{content:'☐';font-size:13px;color:#374151;flex-shrink:0}
.sign-row{display:flex;justify-content:space-between;margin-top:20px;padding-top:11px;border-top:1px solid #e5e7eb}
.sign-block{min-width:190px}.sign-line{border-bottom:1.5px solid #111;height:18px;margin-bottom:3px}
.sign-label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}.sign-name{font-size:11px;font-weight:700;margin-top:2px}
.footer{margin-top:14px;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:7px}
@media print{@page{margin:10mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><div class="page">
<div class="header">
  <div><div class="pname">Amise Medical Services</div>
  <div class="psub">Dr Dawit Daniel Kabiye MD, DM · General &amp; Endoscopic Surgery</div>
  <div class="psub">Rodney Bay Medical Centre, Saint Lucia · Tel: +1 (758) 284-0557</div></div>
  <div style="text-align:right"><div class="psub">Laboratory Services Ltd · Tapion, Saint Lucia</div>
  <div class="psub">Tel: (758) 459-2000</div>
  <div class="psub" style="margin-top:4px;font-weight:700">Date: ${today} · ${timeNow}</div></div>
</div>
<div class="form-title">Laboratory Request Form</div>
<div class="patient-box">
  <div class="pf"><label>Patient name</label><span>${p.patientName || '—'}</span></div>
  <div class="pf"><label>Date of birth</label><span>${p.dob || '—'}</span></div>
  <div class="pf"><label>Age / Sex</label><span>${p.age ? `${p.age}y` : '—'} · ${p.sex !== 'unknown' ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1) : '—'}</span></div>
  <div class="pf"><label>MRN</label><span>${p.mrNumber || '—'}</span></div>
</div>
<div class="info-row">
  <div><label>Urgency</label><span class="badge">${p.urgency}</span></div>
  <div style="flex:1"><label>Clinical indication</label><span>${p.indication || 'See clinical notes'}</span></div>
</div>
${testSections}
<div class="sign-row">
  <div class="sign-block"><div class="sign-line"></div><div class="sign-label">Requesting Clinician Signature</div><div class="sign-name">${p.doctorName}</div></div>
  <div class="sign-block" style="text-align:right"><div class="sign-line"></div><div class="sign-label">Date &amp; Time</div><div class="sign-name">${today}</div></div>
</div>
<div class="footer">Amise Medical Services · Confidential Patient Information · Retain for laboratory records${p.mrNumber ? ` · MRN: ${p.mrNumber}` : ''}</div>
</div></body></html>`;

  const popup = window.open('', '_blank', 'width=860,height=1100,menubar=yes');
  if (!popup) { alert('Pop-up blocked — please allow pop-ups to print.'); return; }
  popup.document.write(html);
  popup.document.close();
  popup.addEventListener('load', () => { popup.focus(); popup.print(); });
}

// ── Laboratory Services Ltd — Saint Lucia ─────────────────────────────────────
const LSL_CATALOGUE: { category: string; tests: string[] }[] = [
  {
    category: 'Haematology',
    tests: [
      'Full Blood Count (FBC)', 'Peripheral Blood Film', 'Reticulocyte Count',
      'ESR', 'D-Dimer', 'Prothrombin Time (PT/INR)', 'APTT',
      'Blood Group & Type', 'Crossmatch',
    ],
  },
  {
    category: 'Biochemistry',
    tests: [
      'Urea & Electrolytes (U&E)', 'Creatinine + eGFR', 'Liver Function Tests (LFTs)',
      'Amylase', 'Lipase', 'Lipid Profile', 'HbA1c',
      'Fasting Glucose', 'Random Glucose', 'Uric Acid',
      'Calcium', 'Magnesium', 'Phosphate',
      'Ferritin', 'Serum Iron / TIBC', 'Vitamin B12', 'Folate',
      'TSH', 'Free T4', 'CRP', 'Albumin', 'Troponin I', 'BNP',
    ],
  },
  {
    category: 'Tumour Markers',
    tests: ['PSA (M)', 'CA-125 (F)', 'CEA', 'AFP', 'CA 19-9'],
  },
  {
    category: 'Microbiology',
    tests: [
      'Blood Culture ×2', 'Urine MCS', 'Wound Swab MCS',
      'Stool MCS', 'Throat Swab MCS', 'Sputum MCS', 'High Vaginal Swab (F)',
    ],
  },
  {
    category: 'Serology',
    tests: [
      'HBsAg (Hepatitis B)', 'Hepatitis C Antibody', 'HIV Combo (4th gen)',
      'Syphilis (RPR)', 'H. pylori Antigen',
    ],
  },
  {
    category: 'Urine',
    tests: [
      'Urine Dipstick + Microscopy', 'Urine Pregnancy Test (F)',
      '24-hr Urine Protein', 'Urine Albumin:Creatinine Ratio',
    ],
  },
];

function LslPanel({
  sex, orderedInvestigations, setOrderedInvestigations,
}: {
  sex: string;
  orderedInvestigations: string[];
  setOrderedInvestigations: (v: string[]) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categories = LSL_CATALOGUE.map(g => g.category);
  const shown = activeCategory
    ? LSL_CATALOGUE.filter(g => g.category === activeCategory)
    : LSL_CATALOGUE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Category filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        <button type="button" onClick={() => setActiveCategory(null)} style={{
          padding: '4px 11px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
          border: activeCategory === null ? '1.5px solid #1a3a5c' : '1px solid #d1d5db',
          background: activeCategory === null ? '#1a3a5c' : '#f9fafb',
          color: activeCategory === null ? '#fff' : '#374151',
          fontWeight: activeCategory === null ? 700 : 400,
        }}>All</button>
        {categories.map(cat => (
          <button key={cat} type="button" onClick={() => setActiveCategory(cat === activeCategory ? null : cat)} style={{
            padding: '4px 11px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
            border: activeCategory === cat ? '1.5px solid #1a3a5c' : '1px solid #d1d5db',
            background: activeCategory === cat ? '#1a3a5c' : '#f9fafb',
            color: activeCategory === cat ? '#fff' : '#374151',
            fontWeight: activeCategory === cat ? 700 : 400,
          }}>{cat}</button>
        ))}
      </div>

      {/* Test grid by category */}
      {shown.map(group => {
        const available = group.tests.filter(t =>
          filterBySex(t, sex) && !orderedInvestigations.includes(cleanLabel(t))
        );
        if (available.length === 0) return null;
        return (
          <div key={group.category}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', marginBottom: 5 }}>
              {group.category}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {available.map(test => {
                const label = cleanLabel(test);
                return (
                  <button key={test} type="button"
                    onClick={() => {
                      if (!orderedInvestigations.includes(label))
                        setOrderedInvestigations([...orderedInvestigations, label]);
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 12,
                      border: '1px solid #c7d2fe', background: '#eef2ff',
                      color: '#3730a3', cursor: 'pointer', fontWeight: 500,
                    }}
                  >+ {label}</button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
        Laboratory Services Ltd · Tapion, Saint Lucia · Tel: (758) 459-2000
      </div>
    </div>
  );
}

export default function InvestigationsTab() {
  const {
    orderedInvestigations, setOrderedInvestigations,
    investigationResults, setInvestigationResults,
    radiologyRequests, setRadiologyRequests,
    symptoms, symptomDetails, sex,
    patientName, age, dob, hpiNotes, mrNumber,
    workingDiagnosis, icdCodes, paneTop, paneConverged,
  } = useAppContext();

  // Derive protocol from working diagnosis or ICD code (mirrors PlanTab logic)
  const activeDiseaseId = (paneConverged && paneTop[0]?.probability >= 0.85)
    ? paneTop[0].disease.id
    : null;
  const activeIcdCode = icdCodes[0]?.split(' — ')[0]?.trim() ?? workingDiagnosis?.icdCode ?? null;
  const protocol = useMemo(
    () => activeDiseaseId
      ? getProtocol(activeDiseaseId)
      : activeIcdCode
        ? getProtocolByIcd(activeIcdCode)
        : null,
    [activeDiseaseId, activeIcdCode],
  );
  const protocolInvestigations = protocol?.investigations ?? [];
  const { showToast } = useToast();

  // One-time migration: move any imaging items that ended up in orderedInvestigations
  // (from old sessions saved before the imaging-routing split) to radiologyRequests.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    const imagingInLabs = orderedInvestigations.filter(t => isImagingInvestigation(t));
    if (!imagingInLabs.length) return;

    const newRequests = imagingInLabs
      .map(label => parseImagingToRequest(label, 'routine'))
      .filter(req => !imagingAlreadyRequested(
        (radiologyRequests as { modality: string; anatomicalRegion: string; clinicalQuestion?: string }[]),
        req,
      ));

    if (newRequests.length) setRadiologyRequests([...newRequests, ...radiologyRequests]);
    setOrderedInvestigations(orderedInvestigations.filter(t => !isImagingInvestigation(t)));
    // Also clean up any result entries for the migrated imaging items
    const imagingSet = new Set(imagingInLabs.map(t => t.toLowerCase().trim()));
    const nextResults = Object.fromEntries(
      Object.entries(investigationResults).filter(([k]) => !imagingSet.has(k.toLowerCase().trim())),
    );
    setInvestigationResults(nextResults as Record<string, string>);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [manualInput, setManualInput] = useState('');

  // Request form state
  const [reqIndication, setReqIndication] = useState('');
  const [reqUrgency, setReqUrgency] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');
  const [reqDoctor, setReqDoctor] = useState('Dr Dawit Daniel Kabiye MD, DM');
  const [reqLabEmail, setReqLabEmail] = useState('');
  const [emailing, setEmailing] = useState(false);

  // AI result scan — staff uploads / photos a lab report; Claude drafts the
  // extracted results, staff review/edit, then confirm to apply.
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<{ labName: string | null; reportDate: string | null } | null>(null);
  const [draftResults, setDraftResults] = useState<(ExtractedResult & { include: boolean })[]>([]);

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleScanFileRaw(file);
  }

  async function handleScanFileRaw(file: File) {
    setScanning(true);
    setScanError(null);
    setScanMeta(null);
    setDraftResults([]);

    try {
      const dataBase64 = await fileToBase64(file);
      const apiOrigin = getApiOrigin();
      const url = apiOrigin ? `${apiOrigin}/api/investigations/extract-results` : '/api/investigations/extract-results';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ dataBase64, mimeType: file.type, fileName: file.name }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      const data = await r.json() as ExtractResponse;
      setScanMeta({ labName: data.labName ?? null, reportDate: data.reportDate ?? null });
      setDraftResults(data.results.map(res => ({ ...res, include: true })));
    } catch (err) {
      setScanError(String(err));
    } finally {
      setScanning(false);
    }
  }

  function updateDraftResult(index: number, patch: Partial<ExtractedResult & { include: boolean }>) {
    setDraftResults(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function discardScan() {
    setDraftResults([]);
    setScanMeta(null);
    setScanError(null);
  }

  function applyConfirmedResults() {
    const toApply = draftResults.filter(r => r.include && r.test.trim());
    if (toApply.length === 0) return;

    const nextOrdered = [...orderedInvestigations];
    const nextResults = { ...investigationResults };

    for (const r of toApply) {
      const value = formatExtractedValue(r);
      const existing = nextOrdered.find(item => item.toLowerCase() === r.test.trim().toLowerCase());
      if (existing) {
        nextResults[existing] = value;
      } else {
        nextOrdered.push(r.test.trim());
        nextResults[r.test.trim()] = value;
      }
    }

    setOrderedInvestigations(nextOrdered);
    setInvestigationResults(nextResults);
    discardScan();
  }

  function addManual() {
    const trimmed = manualInput.trim();
    if (!trimmed || orderedInvestigations.includes(trimmed)) return;
    setOrderedInvestigations([...orderedInvestigations, trimmed]);
    setManualInput('');
  }

  function removeInvestigation(item: string) {
    setOrderedInvestigations(orderedInvestigations.filter(i => i !== item));
    // Also remove result if present
    if (investigationResults[item] !== undefined) {
      const next = { ...investigationResults };
      delete next[item];
      setInvestigationResults(next);
    }
  }

  function toggleResultReceived(item: string) {
    if (investigationResults[item] !== undefined) {
      // Remove result entry (uncheck)
      const next = { ...investigationResults };
      delete next[item];
      setInvestigationResults(next);
    } else {
      setInvestigationResults({ ...investigationResults, [item]: '' });
    }
  }

  function setResult(item: string, value: string) {
    setInvestigationResults({ ...investigationResults, [item]: value });
  }

  const resultReceivedCount = Object.keys(investigationResults).length;

  async function emailLabRequest() {
    if (!reqLabEmail.trim()) return;
    setEmailing(true);
    try {
      const apiOrigin = getApiOrigin();
      const url = apiOrigin ? `${apiOrigin}/api/investigations/send-lab-request` : '/api/investigations/send-lab-request';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          to: reqLabEmail,
          patientName, age, dob, sex, mrNumber,
          tests: orderedInvestigations,
          indication: reqIndication || hpiNotes.slice(0, 200),
          urgency: reqUrgency,
          doctorName: reqDoctor,
        }),
      });
      const d = await r.json() as { action?: string; error?: string };
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      showToast(d.action === 'drafted' ? 'Draft email created in Gmail' : d.action === 'sent' ? 'Lab request sent' : 'Saved (dry-run mode)', 'success');
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setEmailing(false);
    }
  }

  return (
    <div className="gap-y">
      {/* Protocol-specific suggested investigations — shown when working diagnosis is set */}
      {protocol && protocolInvestigations.length > 0 && (
        <div style={{
          padding: '10px 14px',
          background: '#0c2233',
          border: '1px solid #0d9488',
          borderRadius: 8,
          marginBottom: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#5eead4', fontWeight: 600 }}>
              Protocol: {protocol.label}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Suggested investigations
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {protocolInvestigations.map(inv => {
              const alreadyOrdered = orderedInvestigations.includes(inv.label);
              return (
                <button
                  key={inv.label}
                  type="button"
                  onClick={() => {
                    if (!alreadyOrdered) setOrderedInvestigations([...orderedInvestigations, inv.label]);
                  }}
                  disabled={alreadyOrdered}
                  title={alreadyOrdered ? 'Already ordered' : `Order: ${inv.label} (${inv.urgency})`}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: '1px solid',
                    fontSize: 11.5,
                    cursor: alreadyOrdered ? 'default' : 'pointer',
                    background: alreadyOrdered ? '#1e3a2a' : inv.urgency === 'stat' ? '#4a1c1c' : '#1a2f3e',
                    color: alreadyOrdered ? '#4ade80' : inv.urgency === 'stat' ? '#fca5a5' : '#7dd3d0',
                    borderColor: alreadyOrdered ? '#4ade8044' : inv.urgency === 'stat' ? '#ef444444' : '#2d6a7044',
                  }}
                >
                  {alreadyOrdered ? '✓ ' : '+ '}{inv.label}
                  {!alreadyOrdered && (
                    <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>({inv.urgency})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <CollapsibleCard
        title="Ordered investigations"
        badge={orderedInvestigations.length > 0
          ? `${orderedInvestigations.length} ordered · ${resultReceivedCount} results`
          : undefined}
      >
        {orderedInvestigations.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
            No investigations ordered yet. Add from clinical pathway suggestions or enter below.
          </div>
        )}

        {orderedInvestigations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {orderedInvestigations.map(item => {
              const hasResult = investigationResults[item] !== undefined;
              return (
                <div
                  key={item}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '8px 12px',
                    background: hasResult ? '#f0fdf4' : '#fafafa',
                    borderColor: hasResult ? '#86efac' : '#e5e7eb',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      id={`inv-${item}`}
                      checked={hasResult}
                      onChange={() => toggleResultReceived(item)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <label
                      htmlFor={`inv-${item}`}
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                        textDecoration: hasResult ? 'line-through' : 'none',
                        color: hasResult ? '#16a34a' : '#111827',
                      }}
                    >
                      {item}
                    </label>
                    {hasResult && (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Result received</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeInvestigation(item)}
                      title="Remove"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: 16,
                        lineHeight: 1,
                        padding: '0 2px',
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {hasResult && (
                    <div style={{ marginTop: 6 }}>
                      <input
                        type="text"
                        value={investigationResults[item] ?? ''}
                        onChange={e => setResult(item, e.target.value)}
                        placeholder={`Enter result for ${item}…`}
                        style={{
                          width: '100%',
                          fontSize: 13,
                          padding: '4px 8px',
                          border: '1px solid #86efac',
                          borderRadius: 6,
                          background: '#fff',
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Manual add */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addManual()}
            placeholder="Add investigation manually (e.g. Serum amylase)…"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button
            type="button"
            onClick={addManual}
            disabled={!manualInput.trim()}
            style={{
              padding: '6px 14px',
              background: manualInput.trim() ? '#0d9488' : '#e5e7eb',
              color: manualInput.trim() ? '#fff' : '#9ca3af',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              cursor: manualInput.trim() ? 'pointer' : 'default',
              fontWeight: 500,
            }}
          >
            + Add
          </button>
        </div>
      </CollapsibleCard>

      {/* ── Lab request form — print / email ─────────────────────────────── */}
      {orderedInvestigations.filter(t => !isImagingInvestigation(t)).length > 0 && (
        <CollapsibleCard title="Lab request form" badge={`${orderedInvestigations.filter(t => !isImagingInvestigation(t)).length} test${orderedInvestigations.filter(t => !isImagingInvestigation(t)).length !== 1 ? 's' : ''}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid cols-2">
              <div className="fld">
                <label>Clinical indication</label>
                <input
                  value={reqIndication}
                  onChange={e => setReqIndication(e.target.value)}
                  placeholder={hpiNotes ? hpiNotes.slice(0, 60) + '…' : 'e.g. Acute abdominal pain, pre-op workup…'}
                />
              </div>
              <div className="fld">
                <label>Urgency</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {(['Routine', 'Urgent', 'STAT'] as const).map(u => (
                    <button key={u} type="button" onClick={() => setReqUrgency(u)} style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                      fontWeight: reqUrgency === u ? 700 : 500,
                      border: reqUrgency === u ? '1.5px solid currentColor' : '1px solid #d1d5db',
                      background: reqUrgency === u
                        ? (u === 'STAT' ? '#fee2e2' : u === 'Urgent' ? '#fef3c7' : '#e0e7ff')
                        : '#fff',
                      color: reqUrgency === u
                        ? (u === 'STAT' ? '#991b1b' : u === 'Urgent' ? '#92400e' : '#3730a3')
                        : '#6b7280',
                    }}>{u}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-grid cols-2">
              <div className="fld">
                <label>Requesting clinician</label>
                <input value={reqDoctor} onChange={e => setReqDoctor(e.target.value)} />
              </div>
              <div className="fld">
                <label>Lab email (optional — enables email button)</label>
                <input type="email" value={reqLabEmail} onChange={e => setReqLabEmail(e.target.value)} placeholder="lab@example.com" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 2 }}>
              <button
                type="button"
                onClick={() => printLabRequest({
                  patientName, age, dob, sex, mrNumber, orderedInvestigations,
                  indication: reqIndication || hpiNotes.slice(0, 160),
                  urgency: reqUrgency, doctorName: reqDoctor,
                })}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1a3a5c', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                🖨 Print / PDF
              </button>
              {reqLabEmail.trim() && (
                <button
                  type="button"
                  disabled={emailing}
                  onClick={() => void emailLabRequest()}
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: emailing ? 'default' : 'pointer',
                    background: emailing ? '#e5e7eb' : '#0d9488', color: emailing ? '#9ca3af' : '#fff' }}
                >
                  {emailing ? 'Sending…' : '✉ Email to Lab'}
                </button>
              )}
            </div>
          </div>
        </CollapsibleCard>
      )}

      {/* AI result scan — staff upload, AI extraction, human confirm */}
      <CollapsibleCard
        title="Scan lab report (AI-assisted)"
        badge={draftResults.length > 0 ? `${draftResults.length} to review` : undefined}
        defaultOpen={draftResults.length > 0}
      >
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
          Upload a photo or PDF of a lab report. Claude will read the values and draft a result list —
          nothing is saved until you review and confirm each entry below.
        </p>

        {scanning ? (
          <span style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>Reading report…</span>
        ) : (
          <DocumentCapture
            onFile={f => void handleScanFileRaw(f)}
            accept="image/*,application/pdf"
            cameraLabel="📷 Photo"
            fileLabel="📁 PDF / file"
            disabled={scanning}
          />
        )}

        {scanError && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
            {scanError}
          </div>
        )}

        {draftResults.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {(scanMeta?.labName || scanMeta?.reportDate) && (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                {scanMeta.labName && <span>{scanMeta.labName}</span>}
                {scanMeta.labName && scanMeta.reportDate && <span> · </span>}
                {scanMeta.reportDate && <span>Report date: {scanMeta.reportDate}</span>}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draftResults.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
                    background: r.include ? '#f0fdf4' : '#fafafa',
                    borderColor: r.include ? '#86efac' : '#e5e7eb',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={e => updateDraftResult(i, { include: e.target.checked })}
                    style={{ width: 15, height: 15, marginTop: 6, cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.7fr 1fr 0.6fr', gap: 6 }}>
                    <input
                      type="text"
                      value={r.test}
                      onChange={e => updateDraftResult(i, { test: e.target.value })}
                      placeholder="Test name"
                      style={{ fontSize: 12, fontWeight: 600 }}
                    />
                    <input
                      type="text"
                      value={r.result}
                      onChange={e => updateDraftResult(i, { result: e.target.value })}
                      placeholder="Result"
                      style={{ fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={r.unit ?? ''}
                      onChange={e => updateDraftResult(i, { unit: e.target.value })}
                      placeholder="Unit"
                      style={{ fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={r.refRange ?? ''}
                      onChange={e => updateDraftResult(i, { refRange: e.target.value })}
                      placeholder="Ref range"
                      style={{ fontSize: 12 }}
                    />
                    <select
                      value={r.flag ?? ''}
                      onChange={e => updateDraftResult(i, { flag: e.target.value as ExtractedResult['flag'] })}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">—</option>
                      <option value="H">H</option>
                      <option value="L">L</option>
                      <option value="C">C</option>
                      <option value="N">N</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={applyConfirmedResults}
                disabled={!draftResults.some(r => r.include && r.test.trim())}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✓ Confirm & apply to results
              </button>
              <button
                type="button"
                onClick={discardScan}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db',
                  background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* Clinical pathway suggestions — sex-filtered */}
      {(() => {
        const lcSymptoms = symptoms.map(s => s.toLowerCase());
        const lcDetails = Object.fromEntries(Object.entries(symptomDetails).map(([k, v]) => [k.toLowerCase(), v]));
        const pathways = getActivePathways(lcSymptoms, lcDetails);
        if (pathways.length === 0) return null;

        const allLabs = [...new Set(pathways.flatMap(p => p.labsImaging))];
        const filtered = allLabs.filter(lab => filterBySex(lab, sex));
        const available = filtered.filter(lab => !orderedInvestigations.includes(cleanLabel(lab)));

        if (available.length === 0) return null;

        return (
          <CollapsibleCard title={`Pathway suggestions — ${available.length} available`}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
              Based on active clinical pathways. Tap to add to the ordered list.
              {sex === 'female' && <span style={{ color: '#be185d', marginLeft: 6 }}>♀ PSA excluded</span>}
              {sex === 'male'   && <span style={{ color: '#1d4ed8', marginLeft: 6 }}>♂ CA-125 excluded</span>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {available.map(lab => {
                const label = cleanLabel(lab);
                return (
                  <button
                    key={lab}
                    type="button"
                    onClick={() => {
                      if (!orderedInvestigations.includes(label)) {
                        setOrderedInvestigations([...orderedInvestigations, label]);
                      }
                    }}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 999,
                      border: '1px solid #d1d5db',
                      background: '#f9fafb',
                      color: '#374151',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    + {label}
                  </button>
                );
              })}
            </div>
          </CollapsibleCard>
        );
      })()}

      {/* Laboratory Services Ltd catalogue */}
      <CollapsibleCard title="Laboratory Services Ltd — Order Tests" defaultOpen={true}>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          Tap any test to add it to the ordered list. Filtered by patient sex.
        </p>
        <LslPanel
          sex={sex}
          orderedInvestigations={orderedInvestigations}
          setOrderedInvestigations={setOrderedInvestigations}
        />
      </CollapsibleCard>
      <ResultsTrackerCard />
      <LabInterpretationPanel />
    </div>
  );
}
