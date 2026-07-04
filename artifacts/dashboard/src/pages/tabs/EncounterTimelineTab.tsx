import { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { listPatientEncounters, loadEncounterData, type EncounterSummary } from '@/lib/db';

const SITE_LABEL: Record<string, string> = {
  rodney_bay: 'Rodney Bay',
  castries:   'Castries',
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
    setMedications, setMedicationsText, setAllergies,
    setSurgicalHistory, setSurgicalNotes,
    setToxicHabits,
    setActiveSection,
  } = useAppContext();

  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    const rows = await listPatientEncounters(patientId);
    setEncounters(rows);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  async function loadEncounter(enc: EncounterSummary) {
    if (!patientId) return;
    setLoadingId(enc.id);
    const result = await loadEncounterData(enc.id, patientId);
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
    setMedications(d.medications ?? []);
    setMedicationsText('');
    setAllergies(d.allergens?.join(', ') ?? '');
    setSurgicalHistory(d.surgicalHistory ?? []);
    setSurgicalNotes(d.surgicalNotes ?? '');
    setToxicHabits(d.toxicHabits ?? []);
    setActiveSection('assessment');
  }

  if (!patientId) {
    return (
      <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
        Load a patient to view their encounter history.
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

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>
          {error}
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
