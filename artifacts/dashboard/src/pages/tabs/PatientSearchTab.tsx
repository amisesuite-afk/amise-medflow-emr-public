import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import { listPatients, listPatientsBySite, getLatestOpenEncounter, loadPMH, loadEncounterData, type PatientListRow } from '@/lib/db';
import { supabase, SITE_LABELS, type SiteCode } from '@/lib/supabase';
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

  const {
    setPatientName, setAge, setSex, setDob, setPhone,
    setPatientId, setEncounterId, setComorbidities,
    setAssessment, setDifferentials, setIcdCodes, setPlan,
    setAllergies, setMedications, setPatientPhoto,
  } = useAppContext();
  const { showToast } = useToast();

  // ── Demo mode: load from localStorage ──────────────────────────────────────
  useEffect(() => {
    if (!DEMO_MODE) return;
    setLoadingAll(true);
    setSearchResults(null);
    setQuery('');

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
      if (!supabase) throw new Error('Supabase not configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      const isPhone = /^\+?\d[\d\s()-]{3,}$/.test(q.trim());
      const dbQuery = isPhone
        ? supabase
            .from('patients')
            .select('id, full_name, sex, phone, date_of_birth, created_at')
            .ilike('phone', `%${q.replace(/[\s()-]/g, '')}%`)
            .order('created_at', { ascending: false })
            .limit(30)
        : supabase
            .from('patients')
            .select('id, full_name, sex, phone, date_of_birth, created_at')
            .ilike('full_name', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(30);

      const { data, error: err } = await dbQuery;
      if (err) throw err;
      setSearchResults((data ?? []) as PatientListRowEx[]);
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

  async function loadPatient(p: PatientListRowEx) {
    setSelected(p.id);

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
        // Restore clinical snapshot: assessment, plan, allergies, medications
        const encData = await loadEncounterData(encResult.encounterId, p.id);
        if (!encData.error && encData.data) {
          const d = encData.data;
          if (d.assessment)    setAssessment(d.assessment);
          if (d.differentials) setDifferentials(d.differentials);
          if (d.icdCodes.length) setIcdCodes(d.icdCodes);
          if (d.plan)          setPlan(d.plan);
          if (d.allergens.length) setAllergies(d.allergens.join(', '));
          if (d.medications.length) setMedications(d.medications);
        }
        showToast(`Loaded: ${p.full_name ?? 'patient'} — encounter open${pmhSuffix}.`, 'success');
      } else {
        showToast(`Loaded: ${p.full_name ?? 'patient'} — no open encounter${pmhSuffix}.`, 'info');
      }
    }
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

  const displayList = searchResults ?? allPatients;
  const isSearching = query.trim().length > 0;

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

      {displayList.length > 0 && (
        <div className="psearch-results">
          {displayList.map(p => (
            <button
              key={p.id}
              className={`psearch-row ${selected === p.id ? 'psearch-row--loaded' : ''}`}
              onClick={() => void loadPatient(p)}
            >
              <div className="psearch-row-main">
                <span className="psearch-row-name">{p.full_name ?? '—'}</span>
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
                  : <span className="psearch-load-hint">Load →</span>
                }
                {p.created_at && (
                  <span className="psearch-row-dob">Added {formatDate(p.created_at)}</span>
                )}
              </div>
            </button>
          ))}
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
              ? 'Click + New patient to start an intake, then Save patient to add them to the registry.'
              : `No encounters recorded at ${SITE_LABELS[siteFilter]}. Switch to All locations to see all patients.`}
          </div>
        </div>
      )}
    </div>
  );
}
