import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/context/AuthContext';
import { hasRole } from '@/lib/roles';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import { getMatrix } from '@/lib/cc-matrices';
import { VISIT_TYPES, resolveEncounterContext } from '@/lib/visit-types';
import ResultsAlertBadge from '@/components/ResultsAlertBadge';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';

function acuityClass(a: string) {
  return a === 'urgent' ? 'urgent' : a === 'priority' ? 'priority' : a === 'review' ? 'review' : '';
}

interface AppHeaderProps {
  completing: boolean;
  completeEncounter: () => void;
  showAiPanel: boolean;
  setShowAiPanel: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Sticky app header — extracted from Home.tsx (Phase A of the NavSidebar/Home.tsx
 * clutter reduction). Renders two distinct layouts: a slim identity strip while
 * consultAmbient (patient loaded + in consultation), and the full standard header
 * otherwise. Reads almost everything from context directly rather than via props,
 * matching how every tab component in this codebase already works -- only the
 * four values genuinely local to Home.tsx (encounter-close state/callback, AI
 * panel open state) are passed in.
 */
export default function AppHeader({ completing, completeEncounter, showAiPanel, setShowAiPanel }: AppHeaderProps) {
  const {
    patientName, mrNumber, age, sex, allergies,
    visitType: ctxVisitType, setVisitType: ctxSetVisitType,
    setIsPostOp, setPostOpDays, setEncounterType,
    workingDiagnosis, setActiveSection,
    saveStatus, lastSaveError, encounterId,
    topSection, setTopSection,
    patientPhoto, encounterMode, setEncounterMode,
    currentSite, setCurrentSite, patientId,
    activeCcKey, triageResult, symptoms,
  } = useAppContext();
  const { profile, signOut } = useAuth();
  const userRole = profile?.role ?? 'front_desk';

  const consultAmbient = topSection === 'consultation' && (!!patientId || !!patientName);
  const allergyList = allergies.split(',').map((a: string) => a.trim()).filter(Boolean);
  const ccLabel = activeCcKey ? (getMatrix(activeCcKey)?.name ?? null)
    : (symptoms.length > 0 ? symptoms.slice(0, 2).join(', ') : null);
  const patientLabel = patientName.trim() || 'No patient loaded';
  const metaParts: string[] = [];
  if (age) metaParts.push(`Age ${age}`);
  if (sex && sex !== 'unknown') metaParts.push(sex);

  const [showAcuityBreakdown, setShowAcuityBreakdown] = useState(false);
  const acuityRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showAcuityBreakdown) return;
    const handle = (e: MouseEvent) => {
      if (acuityRef.current && !acuityRef.current.contains(e.target as Node)) {
        setShowAcuityBreakdown(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showAcuityBreakdown]);

  return (
    <header className="app-header" style={consultAmbient ? { padding: '0 12px', gap: 10 } : {}}>

      {/* ── Ambient consultation: slim identity strip ── */}
      {consultAmbient && (
        <>
          {/* Patient name */}
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
            {patientName.trim() || 'Patient'}
          </span>
          {/* MRN */}
          {mrNumber && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', background: 'rgba(13,148,136,0.15)', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {mrNumber}
            </span>
          )}
          {/* Age / sex */}
          {(age || (sex && sex !== 'unknown')) && (
            <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {[age && `${age}y`, sex && sex !== 'unknown' && sex].filter(Boolean).join(' ')}
            </span>
          )}
          {/* Allergy alert */}
          {allergyList.length > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', background: '#422006', border: '1px solid #78350f', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ⚠ {allergyList[0]}{allergyList.length > 1 ? ` +${allergyList.length - 1}` : ''}
            </span>
          ) : patientName ? (
            <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>NKDA</span>
          ) : null}
          {/* Visit type — inline select in consultation header */}
          {(() => {
            const vt = VISIT_TYPES.find(v => v.id === ctxVisitType);
            return (
              <select
                value={ctxVisitType ?? ''}
                onChange={e => {
                  const id = e.target.value;
                  if (!id) return;
                  ctxSetVisitType(id);
                  setIsPostOp(id === 'post_op');
                  setPostOpDays('');
                  const { encounterType: nextEncounterType, topSection: nextTopSection } = resolveEncounterContext(id);
                  if (nextEncounterType) setEncounterType(nextEncounterType);
                  setTopSection(nextTopSection);
                }}
                aria-label="Visit type"
                style={{
                  fontSize: 10, fontWeight: 700,
                  color: vt?.color ?? '#fff',
                  backgroundColor: vt ? `${vt.color}22` : 'rgba(255,255,255,0.12)',
                  border: `1.5px solid ${vt ? `${vt.color}44` : 'rgba(255,255,255,0.25)'}`,
                  borderRadius: 6, padding: '2px 22px 2px 7px', cursor: 'pointer',
                  appearance: 'none', flexShrink: 0,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23fff'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
                }}
              >
                <option value="" style={{ color: '#374151', background: '#fff' }}>— Visit type —</option>
                {VISIT_TYPES.map(v => (
                  <option key={v.id} value={v.id} style={{ color: '#374151', background: '#fff' }}>
                    {v.icon} {v.label}
                  </option>
                ))}
              </select>
            );
          })()}
          {/* CC label */}
          {ccLabel && (
            <span style={{ fontSize: 10, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ccLabel}
            </span>
          )}
          {/* Working diagnosis — persistent across every consultation tab, not just
              Assessment/Plan, so it isn't lost while navigating Prescriptions, CPT,
              Consent, etc. Click jumps back to Assessment to review/change it. */}
          {workingDiagnosis && (
            <button
              type="button"
              onClick={() => setActiveSection('assessment')}
              title={`${workingDiagnosis.locked ? 'Confirmed' : 'Provisional'} working diagnosis — click to review in Assessment`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
                color: workingDiagnosis.locked ? '#5eead4' : '#94a3b8',
                background: workingDiagnosis.locked ? 'rgba(13,148,136,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${workingDiagnosis.locked ? 'rgba(13,148,136,0.45)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 210,
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {workingDiagnosis.locked ? '🎯' : '~'} {workingDiagnosis.diseaseLabel || workingDiagnosis.icdCode || 'Working diagnosis'}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {/* Sync status indicator */}
          <SyncStatusIndicator saveStatus={saveStatus} />
          {/* Encounter status + close */}
          {encounterId ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Mark this encounter as complete and close it?')) {
                  completeEncounter();
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(220,38,38,0.4)', background: completing ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.1)', color: '#fca5a5', fontSize: 10, fontWeight: 700, cursor: completing ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              title="Close this encounter"
              disabled={completing}
            >{completing ? '⏳ Closing…' : '● In progress — Close'}</button>
          ) : null}
          {/* AI Consultant */}
          {hasRole(userRole, 'doctor') && (
            <button
              type="button"
              onClick={() => setShowAiPanel(p => !p)}
              style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: showAiPanel ? '#312e81' : 'rgba(13,148,136,0.2)', color: '#0d9488', fontSize: 12, fontWeight: 700, flexShrink: 0 }}
              title="AI Consultant"
            >🧠</button>
          )}
        </>
      )}

      {!consultAmbient && <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="/amise-logo.jpg" alt="" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
        Amise Medical
      </div>}
      {!consultAmbient && DEMO_MODE
        ? <span className="proto-pill" style={{ background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)', color: '#fbbf24' }}>⚗ DEMO MODE — local trial only</span>
        : null
      }
      {!consultAmbient && topSection !== 'finaldoc' && (
      <div className="header-patient" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {patientPhoto && topSection !== 'consultation' && (
          <img
            src={patientPhoto}
            alt=""
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }}
          />
        )}
        <div>
          <span className="header-name">{patientLabel}</span>
          {(mrNumber || metaParts.length > 0) && (
            <span className="header-meta">
              {[mrNumber || null, ...metaParts].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>
      )}
      {!consultAmbient && (
      <div className="header-right">
        {/* Encounter mode pill — hidden in consultation and finaldoc */}
        {topSection !== 'consultation' && topSection !== 'finaldoc' && (
        <div className="site-pill" aria-label="Encounter mode">
          {(['outpatient', 'inpatient'] as const).map(mode => (
            <button
              key={mode}
              className={`site-pill__btn${encounterMode === mode ? ' site-pill__btn--active' : ''}`}
              onClick={() => {
                setEncounterMode(mode);
                if (mode === 'inpatient') {
                  setCurrentSite('tapion');
                  setTopSection('finaldoc');
                }
              }}
              title={mode === 'inpatient' ? 'Inpatient ward encounter — Tapion Hospital' : 'Outpatient clinic encounter'}
            >
              {mode === 'outpatient' ? 'Outpatient' : '🏥 Inpatient'}
            </button>
          ))}
        </div>
        )}

        {/* Site picker — outpatient only; inpatient is always Tapion; hidden in finaldoc */}
        {topSection !== 'consultation' && topSection !== 'finaldoc' && encounterMode === 'outpatient' && (
        <div className="site-pill" aria-label="Clinic site">
          {SITE_CODES.map(code => (
            <button
              key={code}
              className={`site-pill__btn${currentSite === code ? ' site-pill__btn--active' : ''}`}
              onClick={() => setCurrentSite(code)}
              title={SITE_LABELS[code]}
            >
              {SITE_LABELS[code]}
            </button>
          ))}
        </div>
        )}


        {topSection !== 'finaldoc' && topSection !== 'consultation' && <ResultsAlertBadge patientId={patientId ?? undefined} />}

        {/* Encounter status badge — hidden on summary and consultation pages */}
        {patientId && topSection !== 'finaldoc' && topSection !== 'consultation' && (
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: encounterId ? '#fef2f2' : '#f0fdf4',
              color: encounterId ? '#dc2626' : '#16a34a',
              border: `1px solid ${encounterId ? '#fca5a5' : '#86efac'}`,
            }}
            title={encounterId ? `Encounter open (${encounterId.slice(0, 8)}…)` : 'No open encounter'}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: encounterId ? '#dc2626' : '#16a34a',
              display: 'inline-block',
            }} />
            {encounterId ? 'Open' : 'Closed'}
          </div>
        )}

        {/* Save status indicator */}
        {saveStatus !== 'idle' && (
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
              background: saveStatus === 'error' ? '#fef2f2' : saveStatus === 'saving' ? '#fffbeb' : '#f0fdf4',
              color: saveStatus === 'error' ? '#dc2626' : saveStatus === 'saving' ? '#b45309' : '#16a34a',
              border: `1px solid ${saveStatus === 'error' ? '#fca5a5' : saveStatus === 'saving' ? '#fde68a' : '#86efac'}`,
              transition: 'opacity .3s',
            }}
            title={lastSaveError ?? undefined}
          >
            {saveStatus === 'saving' && '⏳ Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '⚠ Save failed'}
          </div>
        )}

        {/* Visit type dropdown — header; hidden in finaldoc */}
        {topSection !== 'finaldoc' && <div style={{ position: 'relative' }}>
          <select
            value={ctxVisitType ?? ''}
            onChange={e => {
              const id = e.target.value;
              if (!id) return;
              ctxSetVisitType(id);
              setIsPostOp(id === 'post_op');
              setPostOpDays('');
              const { encounterType: nextEncounterType, topSection: nextTopSection } = resolveEncounterContext(id);
              if (nextEncounterType) setEncounterType(nextEncounterType);
              setTopSection(nextTopSection);
            }}
            aria-label="Visit type"
            style={{
              padding: '4px 26px 4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)',
              color: '#fff', cursor: 'pointer', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23fff'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            }}
          >
            <option value="" style={{ color: '#374151', background: '#fff' }}>— Visit type —</option>
            {VISIT_TYPES.map(vt => (
              <option key={vt.id} value={vt.id} style={{ color: '#374151', background: '#fff' }}>
                {vt.icon} {vt.label}
              </option>
            ))}
          </select>
        </div>}

        {/* Acuity badge — hidden on summary and consultation */}
        {topSection !== 'finaldoc' && topSection !== 'consultation' && <div ref={acuityRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className={`acuity-badge ${acuityClass(triageResult.acuity)}`}
            onClick={() => setShowAcuityBreakdown(p => !p)}
            title="Click to see score breakdown"
            style={{ cursor: 'pointer', border: 'none', padding: 0, background: 'transparent' }}
          >
            <span className="ab-label">Acuity</span>
            <span className="ab-level">{triageResult.acuity.toUpperCase()}</span>
            <span className="ab-score">Score {triageResult.score}</span>
          </button>
          {showAcuityBreakdown && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 999,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.14)', minWidth: 280, maxWidth: 360,
                padding: '12px 0',
              }}
            >
              <div style={{ padding: '0 14px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>Score breakdown</span>
                <button type="button" onClick={() => setShowAcuityBreakdown(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {triageResult.reasons.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>No active score factors.</div>
                ) : (
                  triageResult.reasons.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '7px 14px', borderBottom: '1px solid #f8fafc', fontSize: 12, color: '#374151',
                    }}>
                      <span style={{ color: '#0d9488', fontWeight: 700, flexShrink: 0 }}>▸</span>
                      <span>{r}</span>
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: '8px 14px 0', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                <span>Total score</span>
                <span style={{ fontWeight: 800, color: '#1e293b' }}>{triageResult.score}</span>
              </div>
            </div>
          )}
        </div>}

        {triageResult.isPrimarilySurgical && topSection !== 'finaldoc' && topSection !== 'consultation' && (
          <div
            className="surgical-badge"
            title={`Surgical pathway match: ${triageResult.surgicalMatches.map(m => m.label).join(', ')}`}
          >
            <span className="ab-label">Surgical</span>
            <span className="ab-level">{triageResult.surgicalMatches[0].label}</span>
            <span className="ab-score">{triageResult.surgicalMatches[0].category}</span>
          </div>
        )}

        {/* AI Registrar button — header, doctor-only; hidden on summary and consultation */}
        {hasRole(userRole, 'doctor') && topSection !== 'finaldoc' && topSection !== 'consultation' && (
          <button
            type="button"
            onClick={() => setShowAiPanel(p => !p)}
            aria-label="AI Consultant"
            title="AI Consultant co-pilot"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: showAiPanel ? '#312e81' : '#1F7A8C', color: '#fff',
              fontSize: 13, fontWeight: 700, transition: 'background .2s',
            }}
          >
            🧠 <span style={{ fontSize: 11 }}>AI</span>
          </button>
        )}

        {/* User chip */}
        {profile && (
          <div className="user-chip">
            <span className="user-chip__name">{profile.full_name ?? profile.email ?? 'User'}</span>
            <span className="user-chip__role">{ROLE_LABELS[profile.role]}</span>
            <button className="user-chip__logout" onClick={() => void signOut()} title="Sign out">↩</button>
          </div>
        )}
      </div>
      )}
    </header>
  );
}
