import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { listPatientEncounters, loadEncounterData, createEncounter, type EncounterSummary, type PatientListRow } from '@/lib/db';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { DEMO_MODE } from '@/context/AuthContext';

const DEMO_PATIENTS_KEY = 'amise-patients-v1';
interface DemoPatient { id: string; full_name: string; age?: string; sex?: string; dob?: string; phone?: string; savedAt?: string }

function loadDemoPatients(): DemoPatient[] {
  try {
    const raw = localStorage.getItem(DEMO_PATIENTS_KEY);
    return raw ? (JSON.parse(raw) as DemoPatient[]) : [];
  } catch { return []; }
}

const SITE_LABEL: Record<string, string> = {
  rodney_bay: 'Rodney Bay',
  tapion:     'Tapion',
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function EncounterTimelineTab() {
  const {
    patientId, encounterId,
    setAssessment, setDifferentials, setIcdCodes, setPlan,
    setAssessmentUpdatedAt, setPlanUpdatedAt,
    setMedications, setMedicationsText, setAllergies,
    setSurgicalHistory, setSurgicalNotes,
    setToxicHabits, setHpiNotes, setPmhNotes, setFamilyHistoryNotes, setOrderedInvestigations,
    setExamFindings, setExamNotes,
    setActiveSection,
    referredBy, procedureData,
    setPatientName, setAge, setSex, setDob, setPhone, setPatientId, clearPatient,
    setEncounterId, currentSite: siteCode,
  } = useAppContext();

  // ── Patient search (shown when no patient loaded) ────────────────────────
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<PatientListRow[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function runSearch(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    if (DEMO_MODE) {
      const all = loadDemoPatients();
      const lower = q.toLowerCase();
      setSearchResults(
        all.filter(p => p.full_name.toLowerCase().includes(lower))
           .slice(0, 10)
           .map(p => ({ id: p.id, full_name: p.full_name, sex: p.sex ?? null, phone: p.phone ?? null, date_of_birth: p.dob ?? null, created_at: p.savedAt ?? null }))
      );
      return;
    }
    setSearching(true);
    try {
      const base = getApiOrigin();
      const headers = await staffAuthHeaders();
      const res = await fetch(`${base}/api/patients?q=${encodeURIComponent(q.trim())}&limit=20`, { headers });
      const json = res.ok ? (await res.json() as { patients: PatientListRow[] }) : { patients: [] };
      setSearchResults(json.patients ?? []);
    } finally { setSearching(false); }
  }

  function handleSearchChange(v: string) {
    setSearchQ(v);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!v.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(() => void runSearch(v), 300);
  }

  function selectFromSearch(p: PatientListRow) {
    clearPatient();
    setPatientName(p.full_name ?? '');
    if (p.date_of_birth) {
      setDob(p.date_of_birth);
      const dob = new Date(p.date_of_birth);
      const today = new Date();
      let a = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
      setAge(String(a));
    }
    if (p.sex) setSex(p.sex as Parameters<typeof setSex>[0]);
    if (p.phone) setPhone(p.phone);
    setPatientId(p.id);
    setSearchQ('');
    setSearchResults([]);
  }

  interface ReferralData { date: string; dx: string; summary: string }
  const referralData = (procedureData['referral'] as ReferralData | undefined) ?? null;

  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function startEncounter() {
    if (!patientId) return;
    setStarting(true);
    const result = await createEncounter({ patient_id: patientId, site: siteCode ?? undefined });
    setStarting(false);
    if (result.error || !result.encounter) {
      setError(result.error ?? 'Failed to create encounter');
      return;
    }
    setEncounterId(result.encounter.id);
    void load();
  }

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listPatientEncounters(patientId);
      setEncounters(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load encounters');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  async function loadEncounter(enc: EncounterSummary) {
    if (!patientId) return;
    setLoadingId(enc.id);
    let result: Awaited<ReturnType<typeof loadEncounterData>>;
    try {
      result = await loadEncounterData(enc.id, patientId);
    } catch (err) {
      setLoadingId(null);
      setError(err instanceof Error ? err.message : 'Failed to load encounter');
      return;
    }
    setLoadingId(null);
    if (result.error || !result.data) {
      setError(result.error ?? 'Failed to load encounter');
      return;
    }
    const d = result.data;
    setAssessment(d.assessment ?? '');
    setDifferentials(d.differentials ?? '');
    setIcdCodes(d.icdCodes ?? []);
    setPlan(d.plan ?? '');
    setAssessmentUpdatedAt(d.assessmentUpdatedAt ?? null);
    setPlanUpdatedAt(d.planUpdatedAt ?? null);
    setMedications(d.medications ?? []);
    setMedicationsText('');
    setAllergies(d.allergens?.join(', ') ?? '');
    setSurgicalHistory(d.surgicalHistory ?? []);
    setSurgicalNotes(d.surgicalNotes ?? '');
    setToxicHabits(d.toxicHabits ?? []);
    if (d.hpiNotes) setHpiNotes(d.hpiNotes);
    if (Object.keys(d.examFindings).length) setExamFindings(d.examFindings);
    if (Object.keys(d.examNotes).length) setExamNotes(d.examNotes);
    if (d.pmhNotes) setPmhNotes(d.pmhNotes);
    if (d.familyHistoryNotes) setFamilyHistoryNotes(d.familyHistoryNotes);
    if (d.orderedInvestigations?.length) setOrderedInvestigations(d.orderedInvestigations);
    setActiveSection('assessment');
  }

  if (!patientId) {
    return (
      <div style={{ padding: '0 2px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--fg)', marginBottom: 4 }}>Patient lookup</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          Search to load a patient and view their encounter history and referral details.
        </div>
        <input
          type="text"
          value={searchQ}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search by name or phone…"
          autoFocus
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 7,
            border: '1.5px solid var(--border)', fontSize: 13,
            background: 'var(--surface)', color: 'var(--fg)',
            marginBottom: 8, boxSizing: 'border-box',
          }}
        />
        {searching && (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>Searching…</div>
        )}
        {searchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {searchResults.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectFromSearch(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 7,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{p.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1) : ''}
                    {p.date_of_birth ? ` · DOB ${new Date(p.date_of_birth).toLocaleDateString('en-GB')}` : ''}
                    {p.phone ? ` · ${p.phone}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 700, flexShrink: 0 }}>Load history →</span>
              </button>
            ))}
          </div>
        )}
        {searchQ.trim() && !searching && searchResults.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '16px 0', textAlign: 'center' }}>
            No patients found matching "{searchQ}"
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 2px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--fg)' }}>Encounter history</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
            {encounters.length > 0 ? `${encounters.length} encounter${encounters.length !== 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => void startEncounter()}
          disabled={starting || !patientId}
          style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 6,
            border: 'none', background: 'var(--panel-hd,#0b9b8e)', color: '#fff',
            fontWeight: 700, cursor: starting ? 'default' : 'pointer',
          }}
        >
          {starting ? '…' : '+ New encounter'}
        </button>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--muted)', cursor: 'pointer',
          }}
        >
          {loading ? '…' : '↻ Refresh'}
        </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Referral card — pinned at top if referral details captured in intake */}
      {(referredBy.trim() || (referralData && (referralData.dx || referralData.summary))) && (
        <div style={{
          background: 'rgba(239,246,255,0.6)',
          border: '1px solid #bfdbfe',
          borderLeft: '3px solid #2563eb',
          borderRadius: 8,
          padding: '10px 13px',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>📨</span>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#1e40af' }}>Referred by</span>
            {referredBy.trim() && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#1d4ed8',
                background: '#dbeafe', borderRadius: 4, padding: '1px 8px',
              }}>
                {referredBy}
              </span>
            )}
            {referralData?.date && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                {new Date(referralData.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          {referralData?.dx && (
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e3a8a', marginBottom: 4 }}>
              Referring diagnosis: {referralData.dx}
            </div>
          )}
          {referralData?.summary && (
            <div style={{
              fontSize: 11, color: '#374151', lineHeight: 1.55,
              background: 'rgba(219,234,254,0.4)', borderRadius: 5,
              padding: '6px 10px', marginTop: 4,
              maxHeight: 120, overflowY: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {referralData.summary}
            </div>
          )}
        </div>
      )}

      {loading && encounters.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>
          Loading…
        </div>
      ) : encounters.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>
          No previous encounters on record.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {encounters.map((enc, i) => {
            const isCurrent = enc.id === encounterId;
            const isOpen = enc.status === 'open';
            const isLoading = loadingId === enc.id;
            const dateStr = new Date(enc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const rel = relativeTime(enc.createdAt);

            return (
              <div
                key={enc.id}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isCurrent ? '#0d9488' : 'var(--border)'}`,
                  borderLeft: `3px solid ${isCurrent ? '#0d9488' : isOpen ? '#d97706' : 'var(--border)'}`,
                  borderRadius: 8,
                  padding: '10px 13px',
                  opacity: isLoading ? 0.6 : 1,
                  position: 'relative',
                }}
              >
                {/* Row 1 — date + type + site + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--fg)' }}>{dateStr}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{rel}</span>
                  {enc.site && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: 'var(--neu-bg, #f1f5f9)', color: 'var(--muted)',
                      border: '1px solid var(--border)',
                    }}>
                      {SITE_LABEL[enc.site] ?? enc.site}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 3,
                    background: enc.encounterType === 'inpatient' ? '#eff6ff' : '#f0fdf4',
                    color: enc.encounterType === 'inpatient' ? '#1d4ed8' : '#166534',
                    border: `1px solid ${enc.encounterType === 'inpatient' ? '#bfdbfe' : '#86efac'}`,
                    fontWeight: 600,
                  }}>
                    {enc.encounterType === 'inpatient' ? '🏥 Inpatient' : 'Outpatient'}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#0d9488', color: '#fff', fontWeight: 700 }}>
                      Current
                    </span>
                  )}
                  {isOpen && !isCurrent && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontWeight: 600 }}>
                      Open
                    </span>
                  )}
                  {/* Index badge (most recent = 1) */}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint, #94a3b8)', fontVariantNumeric: 'tabular-nums' }}>
                    #{i + 1}
                  </span>
                </div>

                {/* Row 2 — chief complaint */}
                {enc.chiefComplaint && (
                  <div style={{ fontSize: 12, color: 'var(--fg)', fontWeight: 500, marginBottom: 3 }}>
                    {enc.chiefComplaint}
                  </div>
                )}

                {/* Row 3 — assessment + ICD */}
                {enc.diagnosis && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Dx:</span>
                    <span style={{ fontSize: 12, color: 'var(--fg)', fontWeight: 600 }}>{enc.diagnosis}</span>
                    {enc.icd10Code && (
                      <span style={{
                        fontSize: 10, padding: '1px 5px', borderRadius: 3,
                        background: '#eef2ff', color: '#4338ca',
                        border: '1px solid #c7d2fe', fontFamily: 'monospace',
                      }}>
                        {enc.icd10Code}
                      </span>
                    )}
                  </div>
                )}

                {/* Load button */}
                {!isCurrent && (
                  <button
                    onClick={() => void loadEncounter(enc)}
                    disabled={isLoading}
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 5,
                      border: '1px solid var(--border)',
                      background: 'var(--neu-bg, #f1f5f9)',
                      color: 'var(--muted)',
                      cursor: isLoading ? 'default' : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {isLoading ? 'Loading…' : '↗ Load this encounter'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
