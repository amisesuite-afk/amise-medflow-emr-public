import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import { listPatients, listPatientsBySite, getLatestOpenEncounter, getLatestAppointmentType, getLatestClosedEncounter, loadPMH, loadEncounterData, getQuestionnaireIntake, type PatientListRow, type QuestionnaireIntakeData } from '@/lib/db';
import { SITE_LABELS, type SiteCode } from '@/lib/supabase';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { DEMO_MODE } from '@/context/AuthContext';
import { fmtPhone } from '@/lib/fmt';

const DEMO_PATIENTS_KEY = 'amise-patients-v1';

interface DemoPatient {
  id: string;
  full_name: string;
  dob: string;
  sex: string;
  site: string;
  phone?: string;
  nhi?: string;
  acuity?: string;
  score?: number;
  age?: string;
  savedAt?: string;
}

const ACUITY_ORDER: Record<string, number> = { urgent: 0, priority: 1, review: 2, routine: 3 };

function acuityBadgeStyle(acuity?: string): React.CSSProperties {
  switch (acuity) {
    case 'urgent':   return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    case 'priority': return { background: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74' };
    case 'review':   return { background: '#fefce8', color: '#854d0e', border: '1px solid #fde047' };
    case 'routine':  return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
    default:         return { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
  }
}

function sortByAcuity(patients: DemoPatient[]): DemoPatient[] {
  return [...patients].sort((a, b) => {
    const aOrder = ACUITY_ORDER[a.acuity ?? 'routine'] ?? 3;
    const bOrder = ACUITY_ORDER[b.acuity ?? 'routine'] ?? 3;
    return aOrder - bOrder;
  });
}

function loadDemoPatients(): DemoPatient[] {
  try {
    const raw = localStorage.getItem(DEMO_PATIENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DemoPatient[];
  } catch {
    return [];
  }
}

function saveDemoPatients(patients: DemoPatient[]): void {
  try {
    localStorage.setItem(DEMO_PATIENTS_KEY, JSON.stringify(patients));
  } catch { /* ignore */ }
}

/** Extended row that carries acuity/score for demo patients */
interface PatientListRowEx extends PatientListRow {
  acuity?: string;
  score?: number;
  age?: string;
}

/** Convert a DemoPatient to the extended PatientListRow shape */
function demoToRow(p: DemoPatient): PatientListRowEx {
  return {
    id: p.id,
    full_name: p.full_name,
    date_of_birth: p.dob || null,
    sex: p.sex || null,
    phone: p.phone ?? null,
    created_at: p.savedAt ?? null,
    acuity: p.acuity,
    score: p.score,
    age: p.age,
  };
}

type SiteFilter = 'all' | SiteCode;

const SITE_FILTER_OPTIONS: { value: SiteFilter; label: string }[] = [
  { value: 'all',        label: 'All locations' },
  { value: 'rodney_bay', label: 'Rodney Bay' },
  { value: 'tapion',     label: 'Tapion' },
];

export default function PatientSearchTab() {
  const [query,         setQuery]         = useState('');
  const [siteFilter,    setSiteFilter]    = useState<SiteFilter>('all');
  const [allPatients,   setAllPatients]   = useState<PatientListRowEx[]>([]);
  const [loadingAll,    setLoadingAll]    = useState(true);
  const [searching,     setSearching]     = useState(false);
  const [searchResults, setSearchResults] = useState<PatientListRowEx[] | null>(null);
  const [selected,      setSelected]      = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persisted hidden IDs — survives page reloads via localStorage
  const HIDDEN_KEY = 'amise-hidden-patients-v1';
  const [hiddenIds, _setHiddenIds] = useState<Set<string>>(
    () => new Set<string>(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')),
  );
  function setHiddenIds(updater: (prev: Set<string>) => Set<string>) {
    _setHiddenIds(prev => {
      const next = updater(prev);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
      return next;
    });
  }
  // ID awaiting duplicate confirmation before loading
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);

  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireIntakeData | null>(null);
  const [qPopulated, setQPopulated] = useState(false);

  const {
    setPatientName, setAge, setSex, setDob, setPhone,
    setPatientId, setEncounterId, setComorbidities, clearPatient,
    setAssessment, setDifferentials, setIcdCodes, setPlan,
    setAllergies, setMedications, setPatientPhoto,
    setSurgicalHistory, setSurgicalNotes, setToxicHabits,
    setRosFindings, setProcedureData, setTraumaData,
    setHpiNotes, setPmhNotes, setFamilyHistoryNotes, setOrderedInvestigations,
    setExamFindings, setExamNotes,
    setTopSection, setActiveSection,
    toggleSymptom, setFreeText, symptoms, freeText,
    setMedicationsText,
    comorbidities, surgicalHistory, toxicHabits,
    setPriorEncounterSummary,
    setWard, setDateAdmission, setDateDischarge, setAdmittingSurgeon,
    setReferringPhysician, setNokName, setNokRelation, setNokTel,
    setBloodGroup, setMrNumber,
    setClinicalScores, setExtractedLabs,
  } = useAppContext();
  const { showToast } = useToast();

  // ── Demo mode: load from localStorage ──────────────────────────────────────
  useEffect(() => {
    if (!DEMO_MODE) return;
    setLoadingAll(true);
    setSearchResults(null);
    setQuery('');
    setPendingConfirmId(null);

    const all = loadDemoPatients();
    const filtered = siteFilter === 'all'
      ? all
      : all.filter(p => p.site === siteFilter);

    setAllPatients(sortByAcuity(filtered).map(demoToRow));
    setLoadingAll(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteFilter]);

  // ── Live mode: load from Supabase ───────────────────────────────────────────
  useEffect(() => {
    if (DEMO_MODE) return;
    void (async () => {
      setLoadingAll(true);
      setSearchResults(null);
      setQuery('');
      setPendingConfirmId(null);

      const result = siteFilter === 'all'
        ? await listPatients()
        : await listPatientsBySite(siteFilter);

      if (result.error) {
        showToast(`Could not load patient list: ${result.error}`, 'error');
        console.error('[PatientSearchTab] list:', result.error);
      } else {
        setAllPatients((result.patients ?? []) as PatientListRowEx[]);
      }
      setLoadingAll(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteFilter]);

  function searchDemo(q: string) {
    if (!q.trim()) { setSearchResults(null); return; }
    const all = loadDemoPatients();
    const lower = q.toLowerCase();
    const filtered = all
      .filter(p => (siteFilter === 'all' || p.site === siteFilter) &&
                   p.full_name.toLowerCase().includes(lower));
    setSearchResults(sortByAcuity(filtered).map(demoToRow));
  }

  async function search(q: string) {
    if (!q.trim()) { setSearchResults(null); return; }
    if (DEMO_MODE) {
      searchDemo(q);
      return;
    }
    setSearching(true);
    try {
      const base = getApiOrigin();
      const headers = await staffAuthHeaders();
      const res = await fetch(`${base}/api/patients?q=${encodeURIComponent(q.trim())}&limit=30`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { patients: PatientListRowEx[] };
      setSearchResults(json.patients ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Search failed';
      showToast(`Search error: ${msg}`, 'error');
      console.error('[PatientSearchTab] search:', e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) { setSearchResults(null); return; }
    if (DEMO_MODE) {
      searchDemo(v);
      return;
    }
    debounceRef.current = setTimeout(() => void search(v), 350);
  }

  function routeByAppointmentType(apptType: string | null) {
    const t = (apptType ?? '').toLowerCase();
    if (t.includes('follow') || t.includes('review') || t === 'follow_up') {
      setTopSection('consultation');
      setActiveSection('assessment');
    } else if (t.includes('pre-op') || t.includes('preop') || t.includes('pre_op')) {
      setTopSection('procedures');
      setActiveSection('procedures');
    } else if (t.includes('post-op') || t.includes('postop') || t.includes('post_op')) {
      setTopSection('consultation');
      setActiveSection('progress');
    } else if (t.includes('endoscop') || t.includes('ercp') || t.includes('ogd') || t.includes('colonoscop')) {
      setTopSection('procedures');
      setActiveSection('procedures');
    } else {
      setTopSection('consultation');
      setActiveSection('triage');
    }
  }

  async function loadPatient(p: PatientListRowEx) {
    setSelected(p.id);
    clearPatient();

    if (p.full_name) setPatientName(p.full_name);
    if (p.date_of_birth) {
      setDob(p.date_of_birth);
      const dob = new Date(p.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      setAge(String(age));
    }
    if (p.sex) setSex(p.sex as Parameters<typeof setSex>[0]);
    if (p.phone) setPhone(p.phone);
    setPatientId(p.id);

    if (DEMO_MODE) {
      showToast(`Loaded: ${p.full_name ?? 'patient'} (demo mode).`, 'success');
      return;
    }

    const [pmhResult, encResult] = await Promise.all([
      loadPMH(p.id),
      getLatestOpenEncounter(p.id),
    ]);

    if (pmhResult.error) {
      showToast(`Loaded patient, but could not fetch PMH: ${pmhResult.error}`, 'error');
    } else {
      setComorbidities(pmhResult.conditions);
    }

    if (encResult.error) {
      showToast(`Loaded patient, but could not fetch encounter: ${encResult.error}`, 'error');
      setEncounterId(null);
    } else {
      setEncounterId(encResult.encounterId);
      const pmhSuffix = pmhResult.conditions.length > 0
        ? ` · ${pmhResult.conditions.length} PMH condition${pmhResult.conditions.length !== 1 ? 's' : ''} loaded`
        : '';
      if (encResult.encounterId) {
        const encData = await loadEncounterData(encResult.encounterId, p.id);
        if (!encData.error && encData.data) {
          const d = encData.data;
          if (d.assessment)    setAssessment(d.assessment);
          if (d.differentials) setDifferentials(d.differentials);
          if (d.icdCodes.length) setIcdCodes(d.icdCodes);
          if (d.plan)          setPlan(d.plan);
          if (d.allergens.length) setAllergies(d.allergens.join(', '));
          if (d.medications.length) setMedications(d.medications);
          if (d.surgicalHistory.length) setSurgicalHistory(d.surgicalHistory);
          if (d.surgicalNotes) setSurgicalNotes(d.surgicalNotes);
          if (d.toxicHabits.length) setToxicHabits(d.toxicHabits);
          if (Object.keys(d.rosFindings).length) setRosFindings(d.rosFindings as Record<string, import('@/context/AppContext').RosFinding>);
          if (Object.keys(d.procedureData).length) setProcedureData(d.procedureData);
          if (d.traumaData) setTraumaData(d.traumaData);
          if (d.hpiNotes) setHpiNotes(d.hpiNotes);
          if (Object.keys(d.examFindings).length) setExamFindings(d.examFindings);
          if (Object.keys(d.examNotes).length) setExamNotes(d.examNotes);
          if (d.pmhNotes) setPmhNotes(d.pmhNotes);
          if (d.familyHistoryNotes) setFamilyHistoryNotes(d.familyHistoryNotes);
          if (d.orderedInvestigations.length) setOrderedInvestigations(d.orderedInvestigations);
          if (Object.keys(d.clinicalScores).length) setClinicalScores(d.clinicalScores);
          if (Object.keys(d.extractedLabs).length) setExtractedLabs(d.extractedLabs);
          if (d.inpatientDetails) {
            const ip = d.inpatientDetails;
            if (typeof ip.ward === 'string') setWard(ip.ward);
            if (typeof ip.dateAdmission === 'string') setDateAdmission(ip.dateAdmission);
            if (typeof ip.dateDischarge === 'string') setDateDischarge(ip.dateDischarge);
            if (typeof ip.admittingSurgeon === 'string') setAdmittingSurgeon(ip.admittingSurgeon);
            if (typeof ip.referringPhysician === 'string') setReferringPhysician(ip.referringPhysician);
            if (typeof ip.nokName === 'string') setNokName(ip.nokName);
            if (typeof ip.nokRelation === 'string') setNokRelation(ip.nokRelation);
            if (typeof ip.nokTel === 'string') setNokTel(ip.nokTel);
            if (typeof ip.bloodGroup === 'string') setBloodGroup(ip.bloodGroup);
            if (typeof ip.mrNumber === 'string') setMrNumber(ip.mrNumber);
          }
        }
        showToast(`Loaded: ${p.full_name ?? 'patient'} — encounter open${pmhSuffix}.`, 'success');
        const apptType = await getLatestAppointmentType(p.id);
        routeByAppointmentType(apptType);
      } else {
        showToast(`Loaded: ${p.full_name ?? 'patient'} — no open encounter${pmhSuffix}.`, 'info');
        const apptType = await getLatestAppointmentType(p.id);
        routeByAppointmentType(apptType);
      }
    }

    // Non-blocking: load most recent closed encounter for follow-up baseline strip
    void getLatestClosedEncounter(p.id).then(({ data }) => {
      setPriorEncounterSummary(data);
    });

    // Check for questionnaire intake data
    setQuestionnaireData(null);
    setQPopulated(false);
    const qData = await getQuestionnaireIntake(p.id);
    if (qData && qData.responses.length > 0) {
      setQuestionnaireData(qData);
    }
  }

  function populateFromQuestionnaire() {
    if (!questionnaireData) return;
    const q = questionnaireData;

    if (q.chiefComplaint) {
      const existing = freeText ?? '';
      setFreeText(existing ? `${existing}\n\n[From questionnaire] ${q.chiefComplaint}` : q.chiefComplaint);
    }

    for (const s of q.symptoms) {
      if (!symptoms.includes(s)) toggleSymptom(s);
    }

    if (q.medications.length) {
      setMedicationsText(q.medications.join(', '));
    }

    if (q.allergies.length) {
      setAllergies(q.allergies.join(', '));
    }

    if (q.pmh.length) {
      setComorbidities([...comorbidities, ...q.pmh.filter(c => !comorbidities.includes(c))]);
    }

    if (q.surgicalHistory.length) {
      setSurgicalHistory([...surgicalHistory, ...q.surgicalHistory.filter(s => !surgicalHistory.includes(s))]);
    }

    if (q.socialHabits.length) {
      setToxicHabits([...toxicHabits, ...q.socialHabits.filter(h => !toxicHabits.includes(h))]);
    }

    if (q.aiSummary) setHpiNotes(q.aiSummary);

    setQPopulated(true);
    showToast('Questionnaire data populated — please confirm with patient.', 'success');
  }

  /** Save current patient to the demo localStorage registry */
  function saveDemoPatient() {
    const patients = loadDemoPatients();
    const id = `demo-${Date.now()}`;
    const ctx = { setPatientName, setAge, setSex, setDob, setPhone, setPatientId, setEncounterId, setComorbidities };
    void ctx; // accessed via closure below — just satisfying lint
    // Read current name/dob/sex/phone from the selected patient if available,
    // otherwise from the AppContext values that were set when the patient was loaded.
    // We actually need the raw values — pull them from the component's own state via
    // the PatientListRow that was selected. But since we don't store it separately,
    // we'll just save what's loaded in the context (accessible via the hook return).
    // We re-call useAppContext here via the destructured values captured in closure.
    const newPatient: DemoPatient = {
      id,
      full_name: (document.querySelector<HTMLInputElement>('[data-save-name]')?.value) || id,
      dob: '',
      sex: '',
      site: 'rodney_bay',
    };
    patients.push(newPatient);
    saveDemoPatients(patients);
    // Refresh list
    const filtered = siteFilter === 'all' ? patients : patients.filter(p => p.site === siteFilter);
    setAllPatients(filtered.map(demoToRow));
    showToast('Patient saved to local registry (demo mode).', 'success');
  }
  void saveDemoPatient; // referenced in JSX below

  const rawList    = searchResults ?? allPatients;
  const displayList = rawList.filter(p => !hiddenIds.has(p.id));
  const isSearching = query.trim().length > 0;

  // Names that appear more than once in the visible list
  const duplicateNames = new Set(
    displayList
      .map(p => (p.full_name ?? '').toLowerCase().trim())
      .filter((name, _i, arr) => name && arr.indexOf(name) !== arr.lastIndexOf(name)),
  );
  const isDuplicateName = (p: PatientListRowEx) =>
    duplicateNames.has((p.full_name ?? '').toLowerCase().trim());

  function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (pendingConfirmId === id) setPendingConfirmId(null);
    setHiddenIds(prev => new Set([...prev, id]));
  }

  function handleClearList() {
    const ids = displayList.map(p => p.id);
    setHiddenIds(prev => new Set([...prev, ...ids]));
    setPendingConfirmId(null);
  }

  function handleRowClick(p: PatientListRowEx) {
    if (isDuplicateName(p)) {
      // First click sets pending; second click (confirm) proceeds
      if (pendingConfirmId === p.id) {
        setPendingConfirmId(null);
        void loadPatient(p);
      } else {
        setPendingConfirmId(p.id);
      }
    } else {
      setPendingConfirmId(null);
      void loadPatient(p);
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  function ageFromDob(dob: string | null): string {
    if (!dob) return '';
    const d = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return `Age ${age}`;
  }

  const siteLabel = siteFilter === 'all' ? '' : ` at ${SITE_LABELS[siteFilter]}`;
  const countLabel = loadingAll
    ? 'Loading patient registry…'
    : `${allPatients.length} patient${allPatients.length !== 1 ? 's' : ''}${siteLabel} — click to load`;

  return (
    <div className="gap-y">
      <div className="psearch-header">
        <div className="psearch-title">Patients</div>
        <div className="psearch-sub">{countLabel}</div>
      </div>

      {/* Demo mode notice */}
      {DEMO_MODE && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: '#92400e',
        }}>
          Demo mode — patients saved locally on this device
        </div>
      )}

      {/* Site filter chips */}
      <div className="psearch-site-filter">
        {SITE_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`psearch-site-chip${siteFilter === opt.value ? ' psearch-site-chip--active' : ''}`}
            onClick={() => setSiteFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Questionnaire intake data banner */}
      {questionnaireData && !qPopulated && (
        <div style={{
          background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 10,
          padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>📋</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
              Pre-visit questionnaire available
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: questionnaireData.doctorApprovedAt ? '#dcfce7' : questionnaireData.staffReviewedAt || questionnaireData.nurseReviewedAt ? '#fef3c7' : '#fee2e2',
              color: questionnaireData.doctorApprovedAt ? '#166534' : questionnaireData.staffReviewedAt || questionnaireData.nurseReviewedAt ? '#92400e' : '#991b1b',
            }}>
              {questionnaireData.doctorApprovedAt ? 'Doctor approved' : questionnaireData.staffReviewedAt || questionnaireData.nurseReviewedAt ? 'Staff reviewed' : 'Awaiting review'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
            {questionnaireData.chiefComplaint && <div><strong>CC:</strong> {questionnaireData.chiefComplaint}</div>}
            {questionnaireData.symptoms.length > 0 && <div><strong>Symptoms:</strong> {questionnaireData.symptoms.slice(0, 5).join(', ')}{questionnaireData.symptoms.length > 5 ? ` +${questionnaireData.symptoms.length - 5} more` : ''}</div>}
            {questionnaireData.medications.length > 0 && <div><strong>Medications:</strong> {questionnaireData.medications.join(', ')}</div>}
            {questionnaireData.allergies.length > 0 && <div><strong>Allergies:</strong> {questionnaireData.allergies.join(', ')}</div>}
            {questionnaireData.aiSummary && <div style={{ marginTop: 4, fontStyle: 'italic', color: '#6b7280', fontSize: 11 }}>{questionnaireData.aiSummary.slice(0, 200)}{questionnaireData.aiSummary.length > 200 ? '…' : ''}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={populateFromQuestionnaire}
              style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                background: '#1e40af', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              Confirm & Populate EMR
            </button>
            <button
              type="button"
              onClick={() => setQuestionnaireData(null)}
              style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {qPopulated && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, color: '#166534', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ✓ Questionnaire data populated — confirm details with patient during consultation
        </div>
      )}

      <div className="psearch-bar">
        <span className="psearch-icon">🔍</span>
        <input
          className="psearch-input"
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Search by name or phone…"
          autoFocus
        />
        {(searching || loadingAll) && <span className="psearch-spinner">⟳</span>}
        {query && !searching && (
          <button className="psearch-clear" aria-label="Clear search" onClick={() => { setQuery(''); setSearchResults(null); }}>✕</button>
        )}
      </div>

      {duplicateNames.size > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span>
            <strong>Duplicate names detected</strong> — verify date of birth and record ID before starting an encounter.
            Tap the correct record once to confirm, then again to load.
          </span>
        </div>
      )}

      {displayList.length > 0 && (
        <div className="psearch-results">
          {/* Clear-list control */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', padding: '2px 4px 4px',
          }}>
            <button
              type="button"
              onClick={handleClearList}
              style={{
                fontSize: 11, color: '#6b7280', background: 'none', border: 'none',
                cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                textDecoration: 'underline', textUnderlineOffset: 2,
              }}
            >
              Clear list
            </button>
          </div>

          {displayList.map(p => {
            const isDup     = isDuplicateName(p);
            const isPending = pendingConfirmId === p.id;
            return (
              <div key={p.id} style={{ position: 'relative' }}>
                <button
                  className={`psearch-row ${selected === p.id ? 'psearch-row--loaded' : ''}`}
                  style={isDup ? { borderLeft: '3px solid #f59e0b', paddingLeft: 9 } : undefined}
                  onClick={() => handleRowClick(p)}
                >
                  <div className="psearch-row-main">
                    <span className="psearch-row-name">{p.full_name ?? '—'}</span>
                    {isDup && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 5px',
                        background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d',
                        marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.3,
                      }}>
                        Duplicate name
                      </span>
                    )}
                    {p.acuity && (
                      <span style={{
                        ...acuityBadgeStyle(p.acuity),
                        fontSize: 10, fontWeight: 700, borderRadius: 4,
                        padding: '1px 6px', marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.4,
                      }}>
                        {p.acuity}{p.score !== undefined ? ` · ${p.score}` : ''}
                      </span>
                    )}
                    <span className="psearch-row-meta">
                      {[p.age ? `Age ${p.age}` : ageFromDob(p.date_of_birth), p.sex, fmtPhone(p.phone)].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="psearch-row-right">
                    {selected === p.id
                      ? <span className="psearch-loaded-badge">✓ Loaded</span>
                      : isPending
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>Tap again to confirm →</span>
                        : <span className="psearch-load-hint">Load →</span>
                    }
                    {p.created_at && (
                      <span className="psearch-row-dob">Added {formatDate(p.created_at)}</span>
                    )}
                  </div>
                </button>

                {/* Duplicate confirmation panel */}
                {isPending && (
                  <div style={{
                    margin: '-2px 0 4px 0', padding: '7px 12px',
                    background: '#fffbeb', border: '1px solid #fcd34d',
                    borderTop: 'none', borderRadius: '0 0 6px 6px',
                    fontSize: 12, color: '#78350f',
                  }}>
                    ⚠ Another patient shares this name. Confirm this is the correct record before loading.
                    <div style={{ marginTop: 5, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => { setPendingConfirmId(null); void loadPatient(p); }}
                        style={{
                          padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                          background: '#b45309', color: '#fff', border: 'none', cursor: 'pointer',
                        }}
                      >
                        Yes — load this patient
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingConfirmId(null)}
                        style={{
                          padding: '4px 10px', borderRadius: 5, fontSize: 11,
                          background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Per-row remove button */}
                <button
                  type="button"
                  aria-label={`Remove ${p.full_name ?? 'patient'} from list`}
                  onClick={e => handleRemove(p.id, e)}
                  style={{
                    position: 'absolute', top: 6, right: 4, zIndex: 2,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#9ca3af', padding: '2px 4px', lineHeight: 1,
                    borderRadius: 4,
                  }}
                  title="Remove from list"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isSearching && !searching && searchResults?.length === 0 && (
        <div className="psearch-empty">
          No patients found matching <strong>"{query}"</strong>.
        </div>
      )}

      {!loadingAll && allPatients.length === 0 && !isSearching && (
        <div className="psearch-hint-box">
          <div className="psearch-hint-icon">👤</div>
          <div className="psearch-hint-title">
            {siteFilter === 'all' ? 'No patients yet' : `No patients at ${SITE_LABELS[siteFilter]} yet`}
          </div>
          <div className="psearch-hint-body">
            {siteFilter === 'all'
              ? 'Use the + New patient button below to register your first patient.'
              : `No encounters recorded at ${SITE_LABELS[siteFilter]}. Switch to "All locations" to see all patients.`}
          </div>
        </div>
      )}
    </div>
  );
}
