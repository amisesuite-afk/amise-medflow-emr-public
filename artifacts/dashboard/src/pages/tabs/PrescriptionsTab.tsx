import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import CollapsibleCard from '@/components/CollapsibleCard';
import AllergyMedAlert from '@/components/AllergyMedAlert';
import DrugInteractionAlert from '@/components/DrugInteractionAlert';
import { searchMedications } from '@workspace/triage-engine';
import { getProtocol, getProtocolByIcd } from '@workspace/pane-engine';
import {
  wrapDoc, masthead, metaGrid, sec as docSec, kvTable, bulList, footer, signoff, escH, AMISE_LOGO_SVG,
} from './lib/docTemplate';
import { saveBlobAsPDF, printDoc } from './lib/pdfExport';
import { staffAuthHeaders } from '@/lib/staff-auth';

// ── Types ────────────────────────────────────────────────────────────────────

interface FormularyDrug {
  name: string;
  genericName?: string;
  defaultDose?: string;
  defaultFrequency?: string;
  defaultRoute?: string;
  defaultDuration?: string;
  defaultQuantity?: string;
  category?: string;
}

interface PrescriptionItem {
  id: string;
  drugName: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: string;
  refills: string;
  instructions: string;
  indication: string;
  noSubstitution: boolean;
}

interface PrescriptionRecord {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  prescribed_by: string;
  prescriber_name: string;
  status: 'draft' | 'signed' | 'dispensed';
  items: PrescriptionItem[];
  notes: string;
  created_at: string;
  updated_at: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  mechanism: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ROUTES = [
  'PO (oral)', 'IV (intravenous)', 'IM (intramuscular)', 'SC (subcutaneous)',
  'PR (rectal)', 'PV (vaginal)', 'SL (sublingual)', 'INH (inhaled)',
  'TOP (topical)', 'OPH (ophthalmic)', 'OT (otic)', 'NAS (nasal)',
  'TD (transdermal)',
];

const FREQUENCIES = [
  'OD (once daily)', 'BD (twice daily)', 'TDS (three times daily)',
  'QDS (four times daily)', 'PRN (as needed)', 'STAT (immediately)',
  'Q4H (every 4 hours)', 'Q6H (every 6 hours)', 'Q8H (every 8 hours)',
  'Q12H (every 12 hours)', 'Nocte (at night)', 'Mane (in the morning)',
  'Weekly', 'Alternate days',
];

/** Embedded formulary — will migrate to @/lib/prescription-formulary in a future release. */
const FORMULARY: FormularyDrug[] = [
  { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', defaultDose: '1g', defaultFrequency: 'QDS (four times daily)', defaultRoute: 'PO (oral)', defaultDuration: '5 days', defaultQuantity: '20', category: 'Analgesic' },
  { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', defaultDose: '400mg', defaultFrequency: 'TDS (three times daily)', defaultRoute: 'PO (oral)', defaultDuration: '5 days', defaultQuantity: '15', category: 'NSAID' },
  { name: 'Diclofenac 50mg', genericName: 'Diclofenac sodium', defaultDose: '50mg', defaultFrequency: 'TDS (three times daily)', defaultRoute: 'PO (oral)', defaultDuration: '5 days', defaultQuantity: '15', category: 'NSAID' },
  { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', defaultDose: '500mg', defaultFrequency: 'TDS (three times daily)', defaultRoute: 'PO (oral)', defaultDuration: '7 days', defaultQuantity: '21', category: 'Antibiotic' },
  { name: 'Amoxicillin/Clavulanate 625mg', genericName: 'Co-amoxiclav', defaultDose: '625mg', defaultFrequency: 'BD (twice daily)', defaultRoute: 'PO (oral)', defaultDuration: '7 days', defaultQuantity: '14', category: 'Antibiotic' },
  { name: 'Metronidazole 400mg', genericName: 'Metronidazole', defaultDose: '400mg', defaultFrequency: 'TDS (three times daily)', defaultRoute: 'PO (oral)', defaultDuration: '7 days', defaultQuantity: '21', category: 'Antibiotic' },
  { name: 'Ciprofloxacin 500mg', genericName: 'Ciprofloxacin', defaultDose: '500mg', defaultFrequency: 'BD (twice daily)', defaultRoute: 'PO (oral)', defaultDuration: '7 days', defaultQuantity: '14', category: 'Antibiotic' },
  { name: 'Omeprazole 20mg', genericName: 'Omeprazole', defaultDose: '20mg', defaultFrequency: 'OD (once daily)', defaultRoute: 'PO (oral)', defaultDuration: '28 days', defaultQuantity: '28', category: 'PPI' },
  { name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', defaultDose: '40mg', defaultFrequency: 'OD (once daily)', defaultRoute: 'PO (oral)', defaultDuration: '28 days', defaultQuantity: '28', category: 'PPI' },
  { name: 'Metformin 500mg', genericName: 'Metformin', defaultDose: '500mg', defaultFrequency: 'BD (twice daily)', defaultRoute: 'PO (oral)', defaultDuration: '30 days', defaultQuantity: '60', category: 'Antidiabetic' },
  { name: 'Amlodipine 5mg', genericName: 'Amlodipine', defaultDose: '5mg', defaultFrequency: 'OD (once daily)', defaultRoute: 'PO (oral)', defaultDuration: '30 days', defaultQuantity: '30', category: 'Antihypertensive' },
  { name: 'Atorvastatin 40mg', genericName: 'Atorvastatin', defaultDose: '40mg', defaultFrequency: 'Nocte (at night)', defaultRoute: 'PO (oral)', defaultDuration: '30 days', defaultQuantity: '30', category: 'Statin' },
  { name: 'Tramadol 50mg', genericName: 'Tramadol', defaultDose: '50mg', defaultFrequency: 'Q6H (every 6 hours)', defaultRoute: 'PO (oral)', defaultDuration: '5 days', defaultQuantity: '20', category: 'Analgesic' },
  { name: 'Enoxaparin 40mg', genericName: 'Clexane', defaultDose: '40mg', defaultFrequency: 'OD (once daily)', defaultRoute: 'SC (subcutaneous)', defaultDuration: '7 days', defaultQuantity: '7', category: 'Anticoagulant' },
  { name: 'Ceftriaxone 1g', genericName: 'Ceftriaxone', defaultDose: '1g', defaultFrequency: 'OD (once daily)', defaultRoute: 'IV (intravenous)', defaultDuration: '5 days', defaultQuantity: '5', category: 'Antibiotic' },
  { name: 'Ondansetron 4mg', genericName: 'Ondansetron', defaultDose: '4mg', defaultFrequency: 'TDS (three times daily)', defaultRoute: 'PO (oral)', defaultDuration: '3 days', defaultQuantity: '9', category: 'Antiemetic' },
  { name: 'Lactulose 15ml', genericName: 'Lactulose', defaultDose: '15ml', defaultFrequency: 'BD (twice daily)', defaultRoute: 'PO (oral)', defaultDuration: '14 days', defaultQuantity: '1 bottle', category: 'Laxative' },
  { name: 'Prednisolone 5mg', genericName: 'Prednisolone', defaultDose: '30mg (6 tabs)', defaultFrequency: 'Mane (in the morning)', defaultRoute: 'PO (oral)', defaultDuration: '5 days', defaultQuantity: '30', category: 'Corticosteroid' },
  { name: 'Ranitidine 150mg', genericName: 'Ranitidine', defaultDose: '150mg', defaultFrequency: 'BD (twice daily)', defaultRoute: 'PO (oral)', defaultDuration: '14 days', defaultQuantity: '28', category: 'H2 blocker' },
  { name: 'Bisacodyl 5mg', genericName: 'Bisacodyl', defaultDose: '10mg', defaultFrequency: 'Nocte (at night)', defaultRoute: 'PO (oral)', defaultDuration: 'PRN', defaultQuantity: '10', category: 'Laxative' },
];

function searchFormulary(query: string): FormularyDrug[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const local = FORMULARY.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.genericName && d.genericName.toLowerCase().includes(q)) ||
    (d.category && d.category.toLowerCase().includes(q))
  );
  const localNames = new Set(local.map(d => d.name.toLowerCase()));
  const engine = searchMedications(query)
    .filter(m => !localNames.has(m.genericName.toLowerCase()))
    .map((m): FormularyDrug => ({
      name: m.genericName,
      genericName: m.genericName,
      defaultDose: m.commonDoses[0] ?? '',
      category: m.class,
    }));
  return [...local, ...engine];
}

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const SITE_INFO: Record<string, { name: string; address: string; phone: string }> = {
  rodney_bay: { name: 'Rodney Bay Office', address: 'Providence Building, First Floor, Apt#3, Rodney Bay', phone: '1 (758) 720 7111' },
  tapion:     { name: 'Tapion Hospital',   address: 'Tapion, Saint Lucia', phone: '1 (758) 459 2227 / 1 (758) 284 0557' },
};

function ectNow(): string {
  return new Date().toLocaleString('en-GB', { timeZone: 'America/St_Lucia' });
}

function ectDate(): string {
  return new Date().toLocaleDateString('en-GB', { timeZone: 'America/St_Lucia', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Button styles ──────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
  whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'var(--panel-hd)', color: '#fff', border: 'none' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: '#f4f6f9', color: '#1a1a1a', border: '1px solid #d1d5db' };
const BTN_ACCENT: React.CSSProperties = { ...BTN, background: 'var(--accent, #0b8278)', color: '#fff', border: 'none' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: '#dc2626', color: '#fff', border: 'none' };

function btnDisabled(base: React.CSSProperties): React.CSSProperties {
  return { ...base, opacity: 0.4, cursor: 'default' };
}

// ── Empty prescription item ──────────────────────────────────────────────────

function emptyItem(): PrescriptionItem {
  return {
    id: uid(), drugName: '', dose: '', frequency: '', route: 'PO (oral)',
    duration: '', quantity: '', refills: '0', instructions: '', indication: '',
    noSubstitution: false,
  };
}

// ── RX PDF builder ───────────────────────────────────────────────────────────

type Ctx = ReturnType<typeof useAppContext>;

function buildRxHtml(ctx: Ctx, items: PrescriptionItem[], prescriberName: string): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const dateStr = ectDate();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');

  const meta = metaGrid([
    { label: 'Patient', value: ctx.patientName || '---', sub: ageLine || undefined },
    { label: 'Date of birth', value: ctx.dob || '---' },
    { label: 'Contact', value: ctx.phone || '---' },
    { label: 'Address', value: ctx.address || '---' },
    { label: 'Prescription date', value: dateStr },
    { label: 'Prescriber', value: prescriberName },
  ]);

  // Numbered medication list
  let rxHtml = '<table style="width:100%;border-collapse:collapse;margin:6px 0">';
  rxHtml += '<tr style="border-bottom:1px solid #d1d5db">'
    + '<th style="text-align:left;padding:4px 6px;font-size:10px;color:#0B2545;width:24px">#</th>'
    + '<th style="text-align:left;padding:4px 6px;font-size:10px;color:#0B2545">Medication</th>'
    + '<th style="text-align:left;padding:4px 6px;font-size:10px;color:#0B2545">Dose</th>'
    + '<th style="text-align:left;padding:4px 6px;font-size:10px;color:#0B2545">Frequency</th>'
    + '<th style="text-align:left;padding:4px 6px;font-size:10px;color:#0B2545">Route</th>'
    + '<th style="text-align:left;padding:4px 6px;font-size:10px;color:#0B2545">Duration</th>'
    + '<th style="text-align:left;padding:4px 6px;font-size:10px;color:#0B2545">Qty</th>'
    + '</tr>';

  items.forEach((item, idx) => {
    const noSub = item.noSubstitution ? ' <span style="color:#dc2626;font-weight:700;font-size:9px">[NO SUBSTITUTION]</span>' : '';
    rxHtml += `<tr style="border-bottom:.5px solid #e5e7eb">
      <td style="padding:5px 6px;font-size:10.5px;vertical-align:top;font-weight:700">${idx + 1}</td>
      <td style="padding:5px 6px;font-size:10.5px;vertical-align:top"><strong>${escH(item.drugName)}</strong>${noSub}${item.indication ? `<br><span style="font-size:9px;color:#6B7280">Indication: ${escH(item.indication)}</span>` : ''}</td>
      <td style="padding:5px 6px;font-size:10.5px;vertical-align:top">${escH(item.dose)}</td>
      <td style="padding:5px 6px;font-size:10.5px;vertical-align:top">${escH(item.frequency)}</td>
      <td style="padding:5px 6px;font-size:10.5px;vertical-align:top">${escH(item.route)}</td>
      <td style="padding:5px 6px;font-size:10.5px;vertical-align:top">${escH(item.duration)}</td>
      <td style="padding:5px 6px;font-size:10.5px;vertical-align:top">${escH(item.quantity)}</td>
    </tr>`;
    if (item.instructions) {
      rxHtml += `<tr><td></td><td colspan="6" style="padding:2px 6px 6px;font-size:9.5px;color:#374151;font-style:italic">Instructions: ${escH(item.instructions)}</td></tr>`;
    }
  });
  rxHtml += '</table>';

  // Refills summary
  const refillLines = items
    .filter(it => parseInt(it.refills, 10) > 0)
    .map(it => `${escH(it.drugName)}: ${escH(it.refills)} refill(s)`);
  const refillHtml = refillLines.length
    ? docSec('Refills', bulList(refillLines))
    : '';

  const body =
    masthead('Prescription', site.name, site.address, site.phone, now, AMISE_LOGO_SVG) +
    meta +
    docSec('Medications prescribed', rxHtml) +
    refillHtml +
    signoff(prescriberName, 'General & Endoscopic Surgery -- Amise Medical Services', 'Licence #: ............   Date: ..................') +
    footer('This prescription is valid for 6 months from the date of issue unless otherwise stated. Verify all details before dispensing.');

  return wrapDoc(`Prescription --- ${ctx.patientName || 'Patient'}`, body);
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  draft:     { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  signed:    { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  dispensed: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {status}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PrescriptionsTab() {
  const ctx = useAppContext();
  const { profile } = useAuth();
  const { showToast } = useToast();

  // Matched protocol for the working diagnosis (mirrors InvestigationsTab/PlanTab)
  // — gives the doctor a route to protocol medications without needing Ambient
  // Consultation, which was previously the only path in.
  const activeDiseaseId = (ctx.paneConverged && ctx.paneTop[0]?.probability >= 0.85)
    ? ctx.paneTop[0].disease.id
    : ctx.workingDiagnosis?.diseaseId ?? null;
  const activeIcdCode = ctx.icdCodes[0]?.split(' — ')[0]?.trim() ?? ctx.workingDiagnosis?.icdCode ?? null;
  const protocol = useMemo(
    () => activeDiseaseId
      ? getProtocol(activeDiseaseId)
      : activeIcdCode
        ? getProtocolByIcd(activeIcdCode)
        : null,
    [activeDiseaseId, activeIcdCode],
  );
  // Discharge-phase drugs belong on the discharge summary, not the active Rx queue.
  const protocolMeds = (protocol?.medications ?? []).filter(m => m.phase !== 'discharge');

  // Current prescription form
  const [currentItem, setCurrentItem] = useState<PrescriptionItem>(emptyItem());
  const [rxItems, setRxItems] = useState<PrescriptionItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  // Drug search
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // History
  const [history, setHistory] = useState<PrescriptionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Drug interactions
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsChecked, setInteractionsChecked] = useState(false);
  const [interactionsPanelOpen, setInteractionsPanelOpen] = useState(true);
  const interactionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prescriberName = profile?.full_name || 'Dr Dawit Daniel Kabiye, MD, DM';
  const patSlug = (ctx.patientName || 'patient').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);

  const searchResults = useMemo(() => searchFormulary(searchQuery), [searchQuery]);

  // ── Load prescription history ──────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    if (!ctx.patientId) return;
    setHistoryLoading(true);
    try {
      const resp = await fetch(`/api/prescriptions/patient/${ctx.patientId}`, {
        headers: await staffAuthHeaders(),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = await resp.json() as { prescriptions: PrescriptionRecord[] };
      setHistory(body.prescriptions ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [ctx.patientId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // ── Drug interaction checking ──────────────────────────────────────────────

  useEffect(() => {
    if (interactionDebounceRef.current) {
      clearTimeout(interactionDebounceRef.current);
    }

    if (rxItems.length < 2) {
      setInteractions([]);
      setInteractionsChecked(false);
      setInteractionsLoading(false);
      return;
    }

    setInteractionsLoading(true);
    interactionDebounceRef.current = setTimeout(async () => {
      try {
        const payload = {
          drugs: rxItems.map(it => ({
            drugName: it.drugName,
            dose: it.dose,
            frequency: it.frequency,
          })),
        };
        const resp = await fetch('/api/ai/drug-interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json() as { interactions: DrugInteraction[] };
        setInteractions(data.interactions ?? []);
        setInteractionsChecked(true);
        if ((data.interactions ?? []).length > 0) {
          setInteractionsPanelOpen(true);
        }
      } catch (err) {
        console.error('[PrescriptionsTab] drug interaction check failed:', err);
        setInteractions([]);
        setInteractionsChecked(false);
      } finally {
        setInteractionsLoading(false);
      }
    }, 800);

    return () => {
      if (interactionDebounceRef.current) {
        clearTimeout(interactionDebounceRef.current);
      }
    };
  }, [rxItems]);

  // ── Drug selection from formulary ──────────────────────────────────────────

  function selectDrug(drug: FormularyDrug) {
    setCurrentItem(prev => ({
      ...prev,
      drugName: drug.name,
      dose: drug.defaultDose ?? prev.dose,
      frequency: drug.defaultFrequency ?? prev.frequency,
      route: drug.defaultRoute ?? prev.route,
      duration: drug.defaultDuration ?? prev.duration,
      quantity: drug.defaultQuantity ?? prev.quantity,
    }));
    setSearchQuery(drug.name);
    setShowDropdown(false);
  }

  // ── Prescribe from current medications shortcut ────────────────────────────

  function prescribeFromCurrent(medName: string) {
    const match = FORMULARY.find(d =>
      d.name.toLowerCase().includes(medName.toLowerCase()) ||
      (d.genericName && d.genericName.toLowerCase().includes(medName.toLowerCase()))
    );
    if (match) {
      selectDrug(match);
    } else {
      setCurrentItem(prev => ({ ...prev, drugName: medName }));
      setSearchQuery(medName);
    }
    showToast(`Pre-filled ${medName} -- adjust dose and frequency as needed`, 'info');
  }

  // ── Add / update item in RX list ───────────────────────────────────────────

  function addToRx() {
    if (!currentItem.drugName.trim()) {
      showToast('Please enter a drug name', 'error');
      return;
    }
    if (!currentItem.dose.trim()) {
      showToast('Please enter the dose', 'error');
      return;
    }

    if (editingId) {
      setRxItems(prev => prev.map(it => it.id === editingId ? { ...currentItem, id: editingId } : it));
      setEditingId(null);
      showToast('Medication updated', 'success');
    } else {
      setRxItems(prev => [...prev, { ...currentItem, id: uid() }]);
      showToast(`${currentItem.drugName} added to prescription`, 'success');
    }

    setCurrentItem(emptyItem());
    setSearchQuery('');
  }

  function editItem(item: PrescriptionItem) {
    setCurrentItem(item);
    setEditingId(item.id);
    setSearchQuery(item.drugName);
  }

  function removeItem(id: string) {
    setRxItems(prev => prev.filter(it => it.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setCurrentItem(emptyItem());
      setSearchQuery('');
    }
    showToast('Medication removed', 'info');
  }

  // ── Sign and generate PDF ─────────────────────────────────────────────────

  async function signAndGenerate() {
    if (rxItems.length === 0) {
      showToast('Add at least one medication to the prescription', 'error');
      return;
    }
    setSigning(true);
    try {
      // Save via API if patient is persisted
      if (ctx.patientId) {
        const resp = await fetch('/api/prescriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
          body: JSON.stringify({
            patientId:      ctx.patientId,
            encounterId:    ctx.encounterId ?? undefined,
            prescriberName,
            status:         'signed',
            items:          rxItems,
            notes:          '',
          }),
        });
        if (!resp.ok) {
          console.error('[PrescriptionsTab] save error:', await resp.text());
          showToast('Prescription saved locally but server save failed', 'error');
        } else {
          showToast('Prescription signed and saved', 'success');
          void loadHistory();
        }
      }

      // Generate PDF
      const html = buildRxHtml(ctx, rxItems, prescriberName);
      await saveBlobAsPDF(html, `rx-${patSlug}-${dateStr}.pdf`);
    } catch (err) {
      console.error('[PrescriptionsTab] sign error:', err);
      showToast('Error generating prescription PDF', 'error');
    } finally {
      setSigning(false);
    }
  }

  // ── Reprint from history ───────────────────────────────────────────────────

  function reprintRx(record: PrescriptionRecord) {
    const html = buildRxHtml(ctx, record.items, record.prescriber_name);
    printDoc(html);
  }

  // ── Field helper ───────────────────────────────────────────────────────────

  function updateField<K extends keyof PrescriptionItem>(key: K, value: PrescriptionItem[K]) {
    setCurrentItem(prev => ({ ...prev, [key]: value }));
  }

  // Deterministic baseline safety net — new items being prescribed here plus
  // the patient's existing home medication list, so a single new drug against
  // a documented allergy or an existing home medication is never silently
  // missed. Runs alongside (not instead of) the AI check below, which only
  // compares new items against each other and needs two or more to fire.
  const rxDrugNames = useMemo(() => rxItems.map(it => it.drugName), [rxItems]);
  const allMedsForSafetyCheck = useMemo(
    () => [...ctx.medications, ...rxDrugNames],
    [ctx.medications, rxDrugNames],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="gap-y">

      <AllergyMedAlert allergies={ctx.allergies} medications={allMedsForSafetyCheck} medicationsText={ctx.medicationsText} />
      <DrugInteractionAlert medications={allMedsForSafetyCheck} medicationsText={ctx.medicationsText} />

      {/* ── Prescribe New ── */}
      <CollapsibleCard title="Prescribe new medication" badge={rxItems.length || undefined}>
        {/* Drug search with autocomplete */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div className="fld">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Drug name (search formulary)</label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); updateField('drugName', e.target.value); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Start typing drug name, e.g. Amoxicillin, Omeprazole..."
              style={{ fontSize: 13 }}
              autoComplete="off"
            />
          </div>
          {showDropdown && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
            }}>
              {searchResults.map(drug => (
                <button
                  key={drug.name}
                  type="button"
                  onClick={() => selectDrug(drug)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                    border: 'none', background: 'none', cursor: 'pointer', fontSize: 12,
                    borderBottom: '1px solid #f3f4f6',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = '#f0f9ff'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
                >
                  <strong>{drug.name}</strong>
                  {drug.genericName && <span style={{ color: '#6B7280', marginLeft: 6 }}>({drug.genericName})</span>}
                  {drug.category && <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 10 }}>{drug.category}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prescription fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Dose</label>
            <input type="text" value={currentItem.dose} onChange={e => updateField('dose', e.target.value)}
              placeholder="e.g. 500mg" style={{ fontSize: 12 }} />
          </div>
          <div className="fld">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Frequency</label>
            <select value={currentItem.frequency} onChange={e => updateField('frequency', e.target.value)} style={{ fontSize: 12 }}>
              <option value="">-- select --</option>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="fld">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Route</label>
            <select value={currentItem.route} onChange={e => updateField('route', e.target.value)} style={{ fontSize: 12 }}>
              {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
          <div className="fld">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Duration</label>
            <input type="text" value={currentItem.duration} onChange={e => updateField('duration', e.target.value)}
              placeholder="e.g. 7 days" style={{ fontSize: 12 }} />
          </div>
          <div className="fld">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Quantity</label>
            <input type="text" value={currentItem.quantity} onChange={e => updateField('quantity', e.target.value)}
              placeholder="e.g. 21" style={{ fontSize: 12 }} />
          </div>
          <div className="fld">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Refills</label>
            <input type="number" min="0" max="12" value={currentItem.refills} onChange={e => updateField('refills', e.target.value)}
              style={{ fontSize: 12 }} />
          </div>
          <div className="fld">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Indication</label>
            <input type="text" value={currentItem.indication} onChange={e => updateField('indication', e.target.value)}
              placeholder="e.g. H. pylori" style={{ fontSize: 12 }} />
          </div>
        </div>

        <div className="fld" style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Special instructions</label>
          <textarea
            value={currentItem.instructions}
            onChange={e => updateField('instructions', e.target.value)}
            placeholder="e.g. Take with food, avoid alcohol..."
            style={{ minHeight: 48, fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={currentItem.noSubstitution}
              onChange={e => updateField('noSubstitution', e.target.checked)}
            />
            No substitution (DAW)
          </label>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {editingId && (
              <button type="button" style={BTN_GHOST} onClick={() => { setEditingId(null); setCurrentItem(emptyItem()); setSearchQuery(''); }}>
                Cancel edit
              </button>
            )}
            <button type="button" style={BTN_PRIMARY} onClick={addToRx}>
              {editingId ? 'Update item' : 'Add to Rx'}
            </button>
          </div>
        </div>
      </CollapsibleCard>

      {/* ── Prescribe from current medications ── */}
      {ctx.medications.length > 0 && (
        <CollapsibleCard title="Prescribe from current medications" defaultOpen={false} badge={ctx.medications.length}>
          <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
            Click a current medication to pre-fill the prescription form. Adjust dose and frequency as needed.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ctx.medications.map(med => (
              <button
                key={med}
                type="button"
                onClick={() => prescribeFromCurrent(med)}
                style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                  border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151',
                  cursor: 'pointer',
                }}
              >
                {med}
              </button>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* ── Suggested from protocol ── */}
      {/* Same tap-to-queue pattern the Ambient Consultation panel already has,
          surfaced here directly so a doctor working the standard tabs — not
          the ambient/voice flow — still has a route to protocol medications. */}
      {protocol && protocolMeds.length > 0 && (() => {
        const queuedNames = new Set(ctx.pendingPrescriptions.map(m => m.drugName.toLowerCase()));
        const inRxNames = new Set(rxItems.map(r => r.drugName.toLowerCase()));
        const available = protocolMeds.filter(m => !queuedNames.has(m.drugName.toLowerCase()) && !inRxNames.has(m.drugName.toLowerCase()));
        if (!available.length) return null;
        return (
          <CollapsibleCard title={`Suggested — ${protocol.label}`} badge={available.length} defaultOpen={true}>
            <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
              From the matched protocol. Tap to queue for review below — nothing is prescribed until you import it.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {available.map((med, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
                  background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{med.drugName}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                      {[med.dose, med.frequency, med.route, med.duration].filter(Boolean).join(' · ')}
                    </div>
                    {med.indication && (
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>Indication: {med.indication}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => ctx.setPendingPrescriptions([...ctx.pendingPrescriptions, med])}
                    style={{ ...BTN_GHOST, padding: '3px 10px', fontSize: 11 }}
                  >
                    + Queue
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleCard>
        );
      })()}

      {/* ── Protocol medications queue ── */}
      {ctx.pendingPrescriptions.length > 0 && (
        <CollapsibleCard
          title="Protocol medications"
          badge={ctx.pendingPrescriptions.length}
          defaultOpen={true}
        >
          <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
            {ctx.pendingPrescriptions.length} medication{ctx.pendingPrescriptions.length !== 1 ? 's' : ''} queued from the protocol — review and import.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {ctx.pendingPrescriptions.map((med, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
                  background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{med.drugName}</div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 1 }}>
                    {[med.dose, med.frequency, med.route, med.duration].filter(Boolean).join(' · ')}
                  </div>
                  {med.indication && (
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>Indication: {med.indication}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (rxItems.some(r => r.drugName.toLowerCase() === med.drugName.toLowerCase())) {
                      showToast(`${med.drugName} is already in the Rx list`, 'info');
                      return;
                    }
                    setRxItems(prev => [...prev, {
                      id: uid(), drugName: med.drugName, dose: med.dose,
                      frequency: med.frequency, route: med.route,
                      duration: med.duration ?? '', quantity: '', refills: '0',
                      instructions: '', indication: med.indication, noSubstitution: false,
                    }]);
                    ctx.setPendingPrescriptions(ctx.pendingPrescriptions.filter((_, i) => i !== idx));
                    showToast(`${med.drugName} added to Rx`, 'success');
                  }}
                  style={{ ...BTN_ACCENT, padding: '3px 10px', fontSize: 11 }}
                >
                  Import
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={BTN_GHOST}
              onClick={() => ctx.setPendingPrescriptions([])}
            >
              Clear queue
            </button>
            <button
              type="button"
              style={BTN_ACCENT}
              onClick={() => {
                const newItems = ctx.pendingPrescriptions
                  .filter(med => !rxItems.some(r => r.drugName.toLowerCase() === med.drugName.toLowerCase()))
                  .map(med => ({
                    id: uid(), drugName: med.drugName, dose: med.dose,
                    frequency: med.frequency, route: med.route,
                    duration: med.duration ?? '', quantity: '', refills: '0',
                    instructions: '', indication: med.indication, noSubstitution: false,
                  }));
                if (newItems.length === 0) {
                  showToast('All queued medications are already in the Rx list', 'info');
                  return;
                }
                setRxItems(prev => [...prev, ...newItems]);
                ctx.setPendingPrescriptions([]);
                showToast(`${newItems.length} medication${newItems.length !== 1 ? 's' : ''} imported`, 'success');
              }}
            >
              Import all
            </button>
          </div>
        </CollapsibleCard>
      )}

      {/* ── Interaction warnings ── */}
      {rxItems.length >= 2 && (
        <div style={{
          borderRadius: 10,
          border: interactionsLoading
            ? '1px solid #d1d5db'
            : interactions.length > 0
              ? `1px solid ${interactions.some(i => i.severity === 'major') ? '#fca5a5' : interactions.some(i => i.severity === 'moderate') ? '#fdba74' : '#fde68a'}`
              : '1px solid #bbf7d0',
          background: interactionsLoading
            ? '#f9fafb'
            : interactions.length > 0
              ? interactions.some(i => i.severity === 'major') ? '#fff5f5' : interactions.some(i => i.severity === 'moderate') ? '#fff7ed' : '#fefce8'
              : '#f0fdf4',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <button
            type="button"
            onClick={() => setInteractionsPanelOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 14px', border: 'none', background: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            {interactionsLoading ? (
              <span style={{ fontSize: 14 }}>&#8987;</span>
            ) : interactions.length > 0 ? (
              <span style={{ fontSize: 14 }}>&#9888;</span>
            ) : interactionsChecked ? (
              <span style={{ fontSize: 14 }}>&#10003;</span>
            ) : null}
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', flex: 1 }}>
              {interactionsLoading
                ? 'Checking interactions…'
                : interactions.length > 0
                  ? `Interaction warnings (${interactions.length})`
                  : interactionsChecked
                    ? 'No known interactions'
                    : 'Interaction warnings'}
            </span>
            {interactions.length > 0 && (
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {interactionsPanelOpen ? 'Hide' : 'Show'}
              </span>
            )}
          </button>

          {/* Panel body */}
          {interactionsPanelOpen && !interactionsLoading && (
            <div style={{ padding: '0 14px 12px' }}>
              {interactions.length === 0 && interactionsChecked && (
                <p style={{ fontSize: 12, color: '#15803d', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>&#10003;</span> No clinically significant interactions detected between the prescribed medications.
                </p>
              )}
              {interactions.map((ix, idx) => {
                const severityColor =
                  ix.severity === 'major' ? { bg: '#fee2e2', badge: '#dc2626', border: '#fca5a5', label: 'MAJOR' }
                  : ix.severity === 'moderate' ? { bg: '#ffedd5', badge: '#ea580c', border: '#fdba74', label: 'MODERATE' }
                  : { bg: '#fef9c3', badge: '#ca8a04', border: '#fde68a', label: 'MINOR' };
                return (
                  <div
                    key={idx}
                    style={{
                      marginBottom: idx < interactions.length - 1 ? 8 : 0,
                      padding: '8px 10px',
                      borderRadius: 7,
                      border: `1px solid ${severityColor.border}`,
                      background: severityColor.bg,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        padding: '1px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800,
                        background: severityColor.badge, color: '#fff', letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>
                        {severityColor.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>
                        {ix.drug1} + {ix.drug2}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: '#374151', margin: '0 0 3px' }}>{ix.description}</p>
                    {ix.mechanism && (
                      <p style={{ fontSize: 10, color: '#6B7280', margin: 0, fontStyle: 'italic' }}>
                        Mechanism: {ix.mechanism}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Current prescription list ── */}
      <CollapsibleCard title="Current prescription" badge={rxItems.length || undefined}>
        {rxItems.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '24px 16px', color: '#9ca3af', gap: 6,
          }}>
            <span style={{ fontSize: 28 }}>Rx</span>
            <span style={{ fontSize: 13 }}>No medications added yet</span>
            <span style={{ fontSize: 11 }}>Use the form above to add medications to this prescription</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rxItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', background: '#f9fafb', borderRadius: 8,
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1a3a5c', minWidth: 20, flexShrink: 0 }}>
                    {idx + 1}.
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {item.drugName}
                      {item.noSubstitution && (
                        <span style={{ color: '#dc2626', fontSize: 10, fontWeight: 700, marginLeft: 6 }}>
                          [NO SUB]
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                      {[item.dose, item.frequency, item.route, item.duration].filter(Boolean).join(' | ')}
                      {item.quantity && ` | Qty: ${item.quantity}`}
                      {parseInt(item.refills, 10) > 0 && ` | Refills: ${item.refills}`}
                    </div>
                    {item.indication && (
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Indication: {item.indication}</div>
                    )}
                    {item.instructions && (
                      <div style={{ fontSize: 10, color: '#374151', fontStyle: 'italic', marginTop: 1 }}>
                        {item.instructions}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button type="button" style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 11 }}
                      onClick={() => editItem(item)}>
                      Edit
                    </button>
                    <button type="button" style={{ ...BTN_DANGER, padding: '3px 8px', fontSize: 11 }}
                      onClick={() => removeItem(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sign and generate toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
              paddingTop: 12, borderTop: '1px solid #e5e7eb',
            }}>
              <button
                type="button"
                style={signing ? btnDisabled(BTN_ACCENT) : BTN_ACCENT}
                disabled={signing}
                onClick={() => void signAndGenerate()}
              >
                {signing ? 'Signing...' : 'Sign and Generate Rx'}
              </button>
              <button
                type="button"
                style={BTN_GHOST}
                onClick={() => printDoc(buildRxHtml(ctx, rxItems, prescriberName))}
              >
                Print preview
              </button>
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                Prescriber: {prescriberName}
              </span>
            </div>
          </>
        )}
      </CollapsibleCard>

      {/* ── Prescription history ── */}
      <CollapsibleCard title="Prescription history" defaultOpen={false} badge={history.length || undefined}>
        {historyLoading ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
            Loading prescription history...
          </div>
        ) : !ctx.patientId ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
            Save the patient record to view prescription history.
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
            No previous prescriptions found for this patient.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(record => (
              <div
                key={record.id}
                style={{
                  padding: '10px 12px', background: '#fafafa', borderRadius: 8,
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1a3a5c' }}>
                    {new Date(record.created_at).toLocaleDateString('en-GB', {
                      timeZone: 'America/St_Lucia',
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                  <StatusBadge status={record.status} />
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>
                    by {record.prescriber_name}
                  </span>
                  <button
                    type="button"
                    style={{ ...BTN_GHOST, padding: '2px 8px', fontSize: 10, marginLeft: 'auto' }}
                    onClick={() => reprintRx(record)}
                  >
                    Reprint
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {record.items.map((item, idx) => (
                    <div key={item.id} style={{ fontSize: 11, color: '#374151' }}>
                      <span style={{ fontWeight: 600 }}>{idx + 1}. {item.drugName}</span>
                      {' '}{item.dose} {item.frequency} {item.route}
                      {item.duration && ` for ${item.duration}`}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>

    </div>
  );
}
