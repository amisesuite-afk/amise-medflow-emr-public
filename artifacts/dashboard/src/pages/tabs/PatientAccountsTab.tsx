import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

interface PatientAccount {
  id: string;
  email: string;
  patient_id: string | null;
  patient_name: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface PatientResult {
  id: string;
  full_name: string;
  mrn?: string;
  email?: string;
  phone?: string;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function PatientAccountsTab() {
  const [filter, setFilter] = useState<'all' | 'unlinked'>('all');
  const [emailSearch, setEmailSearch] = useState('');
  const [accounts, setAccounts] = useState<PatientAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Link panel state — which account row is expanded
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkErr, setLinkErr] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter === 'unlinked') params.set('unlinked', 'true');
      if (emailSearch.trim().length >= 3) params.set('email', emailSearch.trim());
      const r = await fetch(apiUrl(`/api/admin/patient-accounts?${params}`), {
        headers: await staffAuthHeaders(),
      });
      const d = await r.json() as { accounts?: PatientAccount[]; error?: string };
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setAccounts(d.accounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [filter, emailSearch]);

  useEffect(() => { void fetchAccounts(); }, [fetchAccounts]);

  // Patient search with 300ms debounce
  useEffect(() => {
    if (!expandedId) return;
    if (patientSearch.trim().length < 2) { setPatientResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(apiUrl(`/api/patients/search?q=${encodeURIComponent(patientSearch.trim())}&limit=8`), {
          headers: await staffAuthHeaders(),
        });
        const d = await r.json() as { patients?: PatientResult[] };
        setPatientResults(d.patients ?? []);
      } catch { setPatientResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [patientSearch, expandedId]);

  function openLinkPanel(accountId: string) {
    if (expandedId === accountId) { setExpandedId(null); return; }
    setExpandedId(accountId);
    setPatientSearch('');
    setPatientResults([]);
    setLinkErr(null);
  }

  async function handleLink(accountId: string, patientId: string) {
    setLinking(true);
    setLinkErr(null);
    try {
      const r = await fetch(apiUrl(`/api/admin/patient-accounts/${accountId}/link`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ patient_id: patientId }),
      });
      const d = await r.json() as { success?: boolean; patient_name?: string; error?: string };
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      // Update the row locally
      setAccounts(prev => prev.map(a =>
        a.id === accountId ? { ...a, patient_id: patientId, patient_name: d.patient_name ?? null } : a,
      ));
      setExpandedId(null);
    } catch (e) {
      setLinkErr(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setLinking(false);
    }
  }

  const visible = accounts.filter(a =>
    !emailSearch.trim() || a.email.includes(emailSearch.trim().toLowerCase()),
  );
  const unlinkedCount = accounts.filter(a => !a.patient_id).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Portal Accounts</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Patient app accounts · {accounts.length} total{unlinkedCount > 0 ? ` · ${unlinkedCount} unlinked` : ''}
            </div>
          </div>
          <button
            onClick={() => void fetchAccounts()}
            disabled={loading}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 7, overflow: 'hidden' }}>
            {(['all', 'unlinked'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: filter === f ? '#0d9488' : '#fff',
                  color: filter === f ? '#fff' : '#374151',
                }}
              >
                {f === 'all' ? 'All accounts' : `Unlinked (${unlinkedCount})`}
              </button>
            ))}
          </div>
          <input
            type="email"
            placeholder="Search by email…"
            value={emailSearch}
            onChange={e => setEmailSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: '6px 12px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 13 }}>
            {filter === 'unlinked' ? 'All accounts are linked to a patient record.' : 'No accounts found.'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Column headers */}
          {visible.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 100px',
              padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#9ca3af',
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              <div>Email</div>
              <div>Linked Patient</div>
              <div>Last Login</div>
              <div>Created</div>
              <div />
            </div>
          )}

          {visible.map(account => (
            <div key={account.id}>
              {/* Account row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 100px',
                alignItems: 'center', padding: '10px 14px', borderRadius: 8,
                background: expandedId === account.id ? '#f0fdf4' : '#fff',
                border: `1px solid ${expandedId === account.id ? '#86efac' : '#e5e7eb'}`,
                marginBottom: 4,
              }}>
                <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {account.email}
                </div>
                <div style={{ fontSize: 13 }}>
                  {account.patient_name ? (
                    <span style={{ color: '#0d9488', fontWeight: 600 }}>{account.patient_name}</span>
                  ) : (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa',
                    }}>
                      Not linked
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{fmtTime(account.last_login_at)}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{fmt(account.created_at)}</div>
                <div style={{ textAlign: 'right' }}>
                  {!account.patient_id ? (
                    <button
                      onClick={() => openLinkPanel(account.id)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: '1px solid #0d9488',
                        background: expandedId === account.id ? '#0d9488' : 'transparent',
                        color: expandedId === account.id ? '#fff' : '#0d9488',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {expandedId === account.id ? '✕ Cancel' : 'Link →'}
                    </button>
                  ) : (
                    <button
                      onClick={() => openLinkPanel(account.id)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb',
                        background: 'transparent', color: '#6b7280',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {expandedId === account.id ? '✕ Close' : 'Relink'}
                    </button>
                  )}
                </div>
              </div>

              {/* Inline link panel */}
              {expandedId === account.id && (
                <div style={{
                  margin: '-2px 0 8px 14px', padding: '14px 16px', borderRadius: '0 0 8px 8px',
                  background: '#f9fafb', border: '1px solid #e5e7eb', borderTop: 'none',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                    {account.patient_id ? `Currently linked to: ${account.patient_name}` : 'Search for the patient to link'}
                  </div>
                  <input
                    type="text"
                    placeholder="Type patient name, phone, or MRN…"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db',
                      fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8,
                    }}
                  />
                  {linkErr && (
                    <div style={{ padding: '6px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12, marginBottom: 8 }}>
                      {linkErr}
                    </div>
                  )}
                  {searching && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Searching…</div>}
                  {patientResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {patientResults.map(p => (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', borderRadius: 7, background: '#fff', border: '1px solid #e5e7eb',
                          }}
                        >
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.full_name}</span>
                            {p.mrn && <span style={{ fontSize: 11, color: '#0d9488', marginLeft: 8 }}>{p.mrn}</span>}
                            {p.phone && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{p.phone}</span>}
                          </div>
                          <button
                            onClick={() => void handleLink(account.id, p.id)}
                            disabled={linking}
                            style={{
                              padding: '5px 14px', borderRadius: 6, border: 'none',
                              background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              opacity: linking ? 0.6 : 1,
                            }}
                          >
                            {linking ? 'Linking…' : 'Link'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {!searching && patientSearch.trim().length >= 2 && patientResults.length === 0 && (
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>No patients found for "{patientSearch}"</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
