import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import { listPatients, listPatientsBySite, getLatestEncounter, getLatestAppointmentType, getLatestClosedEncounter, loadPMH, loadEncounterData, createEncounter, getQuestionnaireIntake, type PatientListRow, type QuestionnaireIntakeData } from '@/lib/db';
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

/** Visit type icon + color lookup */
const ENC_TYPE_CHIP: Record<string, { icon: string; label: string; color: string }> = {
  outpatient:       { icon: '🩺', label: 'Outpatient',    color: '#0ea5e9' },
  inpatient:        { icon: '🛏',  label: 'Inpatient',     color: '#6366f1' },
  endoscopy:        { icon: '🔬', label: 'Endoscopy',     color: '#8b5cf6' },
  quick_consult:    { icon: '⚡',  label: 'Quick Consult', color: '#f97316' },
  surgical_consult: { icon: '✂️', label: 'Surgical',      color: '#ef4444' },
  major_emergency:  { icon: '🚨', label: 'Emergency',     color: '#dc2626' },
};

function encStatusStyle(status: string | null | undefined): React.CSSProperties {
  if (!status) return {};
  if (status === 'open' || status === 'in_progress')
    return { background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' };
  if (status === 'complete' || status === 'closed')
    return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
  return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
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
    setPatientId, setEncounterId, setEncounterStatus, setEncounterClosedAt, setComorbidities, clearPatient,
    setAssessment, setDifferentials, setIcdCodes, setPlan,
    setAssessmentUpdatedAt, setPlanUpdatedAt,
    setAllergies, setMedications, setPatientPhoto,
    setSurgicalHistory, setSurgicalNotes, setRecentSurgeryDate, setToxicHabits,
    setRosFindings, setProcedureData, procedureData, setTraumaData,
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
    patientId, currentSite,
  } = useAppContext();
  const { showToast } = useToast();

  // ── Demo mode: load from localStorage ──────────────────────────────────────
  useEffect(() => {
    if (!DEMO_MODE) return;
    setLoadingAll(true);
    setSearchResults(null);
    setQuery('');
    setPendingConfirmId(null);

    const raw = loadDemoPatients();

    // Auto-deduplicate silently on every load: keep newest per name
    const byName = new Map<string, DemoPatient>();
    const unnamed: DemoPatient[] = [];
    for (const p of raw) {
      const key = (p.full_name ?? '').toLowerCase().trim();
      if (!key) { unnamed.push(p); continue; }
      const existing = byName.get(key);
      if (!existing) { byName.set(key, p); continue; }
      const existingDate = existing.savedAt ? new Date(existing.savedAt).getTime() : 0;
      const pDate = p.savedAt ? new Date(p.savedAt).getTime() : 0;
      if (pDate >= existingDate) byName.set(key, p);
    }
    const all = [...Array.from(byName.values()), ...unnamed];
    if (all.length < raw.length) saveDemoPatients(all);

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
        const patients = (result.patients ?? []) as PatientListRowEx[];
        // Display-level dedup: keep newest per normalised name (records remain in DB)
        const byName = new Map<string, PatientListRowEx>();
        const unnamed: PatientListRowEx[] = [];
        for (const p of patients) {
          const key = (p.full_name ?? '').toLowerCase().trim();
          if (!key) { unnamed.push(p); continue; }
          const existing = byName.get(key);
          if (!existing) { byName.set(key, p); continue; }
          const existingDate = existing.created_at ? new Date(existing.created_at).getTime() : 0;
          const pDate = p.created_at ? new Date(p.created_at).getTime() : 0;
          if (pDate >= existingDate) byName.set(key, p);
        }
        setAllPatients([...Array.from(byName.values()), ...unnamed]);
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
    // Reset questionnaire state immediately so the stale banner disappears
    // as soon as a new patient is selected (before async awaits resolve).
    setQuestionnaireData(null);
    setQPopulated(false);

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
      getLatestEncounter(p.id),
    ]);

    if (pmhResult.error) {
      showToast(`Loaded patient, but could not fetch PMH: ${pmhResult.error}`, 'error');
    } else {
      setComorbidities(pmhResult.conditions);
    }

    if (encResult.error) {
      showToast(`Loaded patient, but could not fetch encounter: ${encResult.error}`, 'error');
      setEncounterId(null);
      setEncounterStatus(null);
      setEncounterClosedAt(null);
    } else {
      setEncounterId(encResult.encounterId);
      setEncounterStatus(encResult.status);
      setEncounterClosedAt(encResult.closedAt);
      const pmhSuffix = pmhResult.conditions.length > 0
        ? ` · ${pmhResult.conditions.length} PMH condition${pmhResult.conditions.length !== 1 ? 's' : ''} loaded`
        : '';

      // Restores both encounter-scoped fields (assessment/plan/HPI/exam) and
      // patient-scoped fields (surgical history, toxic habits, allergies,
      // medications) — the latter load regardless of whether the encounter
      // itself has any content yet, so they show up even on a brand-new
      // encounter for a returning patient.
      async function restoreFromEncounter(encId: string) {
        const encData = await loadEncounterData(encId, p.id);
        if (encData.error || !encData.data) return;
        const d = encData.data;
        if (d.assessment)    setAssessment(d.assessment);
        if (d.differentials) setDifferentials(d.differentials);
        if (d.icdCodes.length) setIcdCodes(d.icdCodes);
        if (d.plan)          setPlan(d.plan);
        // Unconditional (unlike the fields above) — null is a meaningful
        // value here: it means no assessments/plans row exists yet for this
        // encounter, which saveAssessment/savePlan's conflict check needs to
        // know explicitly, not just inherit a stale value from a prior patient.
        setAssessmentUpdatedAt(d.assessmentUpdatedAt);
        setPlanUpdatedAt(d.planUpdatedAt);
        if (d.allergens.length) setAllergies(d.allergens.join(', '));
        if (d.medications.length) setMedications(d.medications);
        if (d.surgicalHistory.length) setSurgicalHistory(d.surgicalHistory);
        if (d.surgicalNotes) setSurgicalNotes(d.surgicalNotes);
        if (d.recentSurgeryDate) setRecentSurgeryDate(d.recentSurgeryDate);
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

      if (encResult.encounterId) {
        await restoreFromEncounter(encResult.encounterId);
        if (encResult.status === 'closed') {
          // Land on the summary screen so the reopen banner is immediately visible,
          // rather than dropping into a blank triage view with the data invisible.
          showToast(`Loaded: ${p.full_name ?? 'patient'} — last encounter is closed${pmhSuffix}. Reopen to edit.`, 'info');
          setTopSection('finaldoc');
        } else {
          showToast(`Loaded: ${p.full_name ?? 'patient'} — encounter open${pmhSuffix}.`, 'success');
          const apptType = await getLatestAppointmentType(p.id);
          routeByAppointmentType(apptType);
        }
      } else {
        // No encounter has ever existed for this patient — create one now.
        // Without this, the doctor lands in a fully-interactive consultation
        // UI with no encounterId, and every encounter-scoped autosave effect
        // silently no-ops (guarded on encounterId being set) for the entire
        // session, with no error or indication anything is wrong.
        const { encounter, error: createErr } = await createEncounter({ patient_id: p.id, site: currentSite });
        if (createErr || !encounter) {
          showToast(`Loaded: ${p.full_name ?? 'patient'}, but could not open a new encounter: ${createErr ?? 'unknown error'}. Documentation will not save until this is resolved.`, 'error');
        } else {
          setEncounterId(encounter.id);
          setEncounterStatus('open');
          setEncounterClosedAt(null);
          await restoreFromEncounter(encounter.id);
          showToast(`Loaded: ${p.full_name ?? 'patient'} — new encounter opened${pmhSuffix}.`, 'success');
        }
        const apptType = await getLatestAppointmentType(p.id);
        routeByAppointmentType(apptType);
      }
    }

    // Non-blocking: load most recent closed encounter for follow-up baseline strip.
    // Capture the patient ID at call time so we can guard against a race where
    // the user switches patients before this promise resolves.
    const encPatientId = p.id;
    void getLatestClosedEncounter(p.id).then(({ data }) => {
      // Only apply if the user hasn't switched to a different patient in the meantime
      if (patientId === encPatientId) setPriorEncounterSummary(data);
    });

    // Check for questionnaire intake data (state already reset above, before async)
    const qData = await getQuestionnaireIntake(p.id);
    if (qData && qData.responses.length > 0) {
      setQuestionnaireData(qData);
    }
  }

  function populateFromQuestionnaire() {
    if (!questionnaireData) return;
    const q = questionnaireData;

    if (q.chiefComplaint) {
      const ccText = q.chiefComplaint.trim();
      const existing = freeText ?? '';
      setFreeText(existing ? `${existing}\n\n[From questionnaire] ${ccText}` : ccText);

      // Migrate CC into procedureData['cc'] so the HPI builder activates with SOCRATES questions
      const existingCCs = (procedureData['cc'] as Array<{ complaint: string; answers: Record<string, string> }> | undefined) ?? [];
      const alreadyAdded = existingCCs.some(e => e.complaint.toLowerCase().trim() === ccText.toLowerCase());
      if (!alreadyAdded) {
        setProcedureData({ ...procedureData, cc: [...existingCCs, { complaint: ccText, answers: {} }] });
      }
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

    // Only use aiSummary if it's substantially more than the bare CC — otherwise
    // let the HPI builder auto-generate prose from the CC entry created above.
    const bareCC = (q.chiefComplaint ?? '').trim();
    const summaryIsTrivial = !q.aiSummary || q.aiSummary.trim().length <= bareCC.length + 4;
    if (q.aiSummary && !summaryIsTrivial) setHpiNotes(q.aiSummary);

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

  function handleMergeDuplicates() {
    // Group by name, keep only the newest record per name, rewrite localStorage
    const stored = loadDemoPatients();
    const byName = new Map<string, DemoPatient>();
    for (const p of stored) {
      const key = (p.full_name ?? '').toLowerCase().trim();
      if (!key) continue;
      const existing = byName.get(key);
      if (!existing) { byName.set(key, p); continue; }
      // keep whichever was saved most recently
      const existingDate = existing.savedAt ? new Date(existing.savedAt).getTime() : 0;
      const pDate        = p.savedAt        ? new Date(p.savedAt).getTime()        : 0;
      if (pDate > existingDate) byName.set(key, p);
    }
    const merged = Array.from(byName.values());
    saveDemoPatients(merged);
    setAllPatients(sortByAcuity(merged).map(demoToRow));
    setHiddenIds(() => new Set()); // clear hidden IDs too — clean slate
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
          padding: '7px 12px', fontSize: 12, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span style={{ flex: 1 }}>
            <strong>{duplicateNames.size} duplicate name{duplicateNames.size !== 1 ? 's' : ''}</strong> — older records shown with amber border.
          </span>
          <button
            type="button"
            onClick={handleMergeDuplicates}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
              border: '1.5px solid #d97706', background: '#d97706', color: '#fff',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Keep newest ✓
          </button>
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
                    {/* Visit type + encounter status chips */}
                    {p.latest_encounter_type && (() => {
                      const chip = ENC_TYPE_CHIP[p.latest_encounter_type];
                      if (!chip) return null;
                      return (
                        <span style={{
                          fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 5px',
                          background: `${chip.color}15`, color: chip.color, border: `1px solid ${chip.color}33`,
                          marginLeft: 5, letterSpacing: 0.3,
                        }}>
                          {chip.icon} {chip.label}
                        </span>
                      );
                    })()}
                    {p.latest_encounter_status && (
                      <span style={{
                        ...encStatusStyle(p.latest_encounter_status),
                        fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 5px',
                        marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.3,
                        display: 'inline-block',
                      }}>
                        {p.latest_encounter_status === 'open' || p.latest_encounter_status === 'in_progress' ? '⏳' : '✓'}{' '}
                        {p.latest_encounter_status}
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
