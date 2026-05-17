import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/context/AppContext';

interface PatientRow {
  id: string;
  full_name: string | null;
  age: number | null;
  sex: string | null;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string | null;
}

export default function PatientSearchTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setPatientName, setAge, setSex, setDob, setPhone } = useAppContext();

  async function search(q: string) {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase not configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      const { data, error: err } = await supabase
        .from('patients')
        .select('id, full_name, age, sex, phone, date_of_birth, created_at')
        .ilike('full_name', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (err) throw err;
      setResults(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(v), 350);
  }

  function loadPatient(p: PatientRow) {
    setSelected(p.id);
    if (p.full_name) setPatientName(p.full_name);
    if (p.age != null) setAge(String(p.age));
    if (p.sex) setSex(p.sex as Parameters<typeof setSex>[0]);
    if (p.date_of_birth) setDob(p.date_of_birth);
    if (p.phone) setPhone(p.phone);
  }

  const formatDate = (d: string | null) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="gap-y">
      <div className="psearch-header">
        <div className="psearch-title">Patient search</div>
        <div className="psearch-sub">Search by name to load a previous patient record into the intake form.</div>
      </div>

      <div className="psearch-bar">
        <span className="psearch-icon">🔍</span>
        <input
          className="psearch-input"
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Type patient name…"
          autoFocus
        />
        {loading && <span className="psearch-spinner">⟳</span>}
        {query && !loading && (
          <button className="psearch-clear" onClick={() => { setQuery(''); setResults([]); }}>✕</button>
        )}
      </div>

      {error && (
        <div className="psearch-error">
          <strong>Search error:</strong> {error}
          <span className="psearch-error-hint"> — ensure the patients table exists in Supabase.</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="psearch-results">
          {results.map(p => (
            <button
              key={p.id}
              className={`psearch-row ${selected === p.id ? 'psearch-row--loaded' : ''}`}
              onClick={() => loadPatient(p)}
            >
              <div className="psearch-row-main">
                <span className="psearch-row-name">{p.full_name ?? '—'}</span>
                <span className="psearch-row-meta">
                  {[p.age ? `Age ${p.age}` : null, p.sex, p.phone].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="psearch-row-right">
                {selected === p.id
                  ? <span className="psearch-loaded-badge">✓ Loaded</span>
                  : <span className="psearch-load-hint">Load →</span>
                }
                {p.date_of_birth && (
                  <span className="psearch-row-dob">DOB {formatDate(p.date_of_birth)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {query && !loading && results.length === 0 && !error && (
        <div className="psearch-empty">No patients found matching <strong>"{query}"</strong>.<br />New patients are created automatically when appointments are confirmed.</div>
      )}

      {!query && (
        <div className="psearch-hint-box">
          <div className="psearch-hint-icon">👤</div>
          <div className="psearch-hint-title">Search existing patients</div>
          <div className="psearch-hint-body">
            Enter a patient name above to search the Amise Medical patient registry.
            Selecting a result will pre-fill the intake form with their demographic details.
          </div>
        </div>
      )}
    </div>
  );
}
