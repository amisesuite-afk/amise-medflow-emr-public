import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import { listPatients, getLatestOpenEncounter, type PatientListRow } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export default function PatientSearchTab() {
  const [query, setQuery] = useState('');
  const [allPatients, setAllPatients] = useState<PatientListRow[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PatientListRow[] | null>(null); // null = not searching
  const [selected, setSelected] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setPatientName, setAge, setSex, setDob, setPhone, setPatientId, setEncounterId } = useAppContext();
  const { showToast } = useToast();

  // Load full patient list on mount
  useEffect(() => {
    void (async () => {
      setLoadingAll(true);
      const { patients, error } = await listPatients();
      if (error) {
        showToast(`Could not load patient list: ${error}`, 'error');
        console.error('[PatientSearchTab] listPatients:', error);
      } else {
        setAllPatients(patients ?? []);
      }
      setLoadingAll(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(q: string) {
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      if (!supabase) throw new Error('Supabase not configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      const { data, error: err } = await supabase
        .from('patients')
        .select('id, full_name, sex, phone, date_of_birth, created_at')
        .ilike('full_name', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (err) throw err;
      setSearchResults((data ?? []) as PatientListRow[]);
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
    debounceRef.current = setTimeout(() => void search(v), 350);
  }

  async function loadPatient(p: PatientListRow) {
    setSelected(p.id);

    // Populate context fields
    if (p.full_name) setPatientName(p.full_name);
    if (p.date_of_birth) {
      setDob(p.date_of_birth);
      // Derive age from DOB
      const dob = new Date(p.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      setAge(String(age));
    }
    if (p.sex) setSex(p.sex as Parameters<typeof setSex>[0]);
    if (p.phone) setPhone(p.phone);

    // Set patient ID
    setPatientId(p.id);

    // Look up the most recent open encounter for this patient
    const { encounterId, error } = await getLatestOpenEncounter(p.id);
    if (error) {
      showToast(`Loaded patient, but could not fetch encounter: ${error}`, 'error');
      setEncounterId(null);
    } else {
      setEncounterId(encounterId);
      if (encounterId) {
        showToast(`Loaded: ${p.full_name ?? 'patient'} — encounter open.`, 'success');
      } else {
        showToast(`Loaded: ${p.full_name ?? 'patient'} — no open encounter found.`, 'info');
      }
    }
  }

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

  return (
    <div className="gap-y">
      <div className="psearch-header">
        <div className="psearch-title">Patients</div>
        <div className="psearch-sub">
          {loadingAll ? 'Loading patient registry…' : `${allPatients.length} patient${allPatients.length !== 1 ? 's' : ''} — click to load into intake form`}
        </div>
      </div>

      <div className="psearch-bar">
        <span className="psearch-icon">🔍</span>
        <input
          className="psearch-input"
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Filter by name…"
          autoFocus
        />
        {(searching || loadingAll) && <span className="psearch-spinner">⟳</span>}
        {query && !searching && (
          <button className="psearch-clear" onClick={() => { setQuery(''); setSearchResults(null); }}>✕</button>
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
                <span className="psearch-row-meta">
                  {[ageFromDob(p.date_of_birth), p.sex, p.phone].filter(Boolean).join(' · ')}
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
          <div className="psearch-hint-title">No patients yet</div>
          <div className="psearch-hint-body">
            Click <strong>+ New patient</strong> to start an intake, then <strong>Save patient</strong> to add them to the registry.
          </div>
        </div>
      )}
    </div>
  );
}
