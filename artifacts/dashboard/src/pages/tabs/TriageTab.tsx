import { useState, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/lib/roles';
import CollapsibleCard from '@/components/CollapsibleCard';

function actionLabel(action: string): string {
  switch (action) {
    case 'emergency_now':    return 'Escalate now — emergency pathway';
    case 'same_day_call':    return 'Same-day clinical call';
    case 'priority_24_48h': return 'Priority review in 24–48 hours';
    case 'routine_booking':  return 'Routine booking pathway';
    default:                 return 'Administrative review';
  }
}

function acuityColor(a: string): string {
  return a === 'urgent' ? 'var(--urgent)' : a === 'priority' ? 'var(--priority)' : a === 'review' ? 'var(--review)' : 'var(--accent)';
}

export default function TriageTab() {
  const { triageResult, setTopSection } = useAppContext();
  const { profile } = useAuth();
  const isDoctor = hasRole(profile?.role, 'doctor');
  const [expandedPathway, setExpandedPathway] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);
  const r = triageResult;

  const copyScript = useCallback(() => {
    void navigator.clipboard.writeText(r.frontDeskScript).then(() => {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    });
  }, [r.frontDeskScript]);

  const bannerVariant = r.acuity === 'urgent' ? '' : r.acuity === 'priority' ? 'priority' : r.acuity === 'review' ? 'review' : null;

  return (
    <div className="gap-y">
      {/* Banner */}
      {bannerVariant !== null && (
        <div className={`flag-banner ${bannerVariant}`}>
          <span className="flag-banner-icon">
            {r.acuity === 'urgent' ? '🚨' : r.acuity === 'priority' ? '⚠️' : '📋'}
          </span>
          <div className="flag-banner-body">
            <div className="flag-banner-title">{actionLabel(r.recommendedAction)}</div>
            {r.reasons.length > 0 && (
              <ul className="flag-banner-list">
                {r.reasons.map(reason => <li key={reason}>{reason}</li>)}
              </ul>
            )}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: acuityColor(r.acuity), flexShrink: 0 }}>
            {r.score}
          </div>
        </div>
      )}

      {/* Vital red flags */}
      {r.vitalRedFlags.length > 0 && (
        <CollapsibleCard title="Vital sign alerts" badgeVariant="danger" badge={r.vitalRedFlags.length}>
          <div className="vital-flags">
            {r.vitalRedFlags.map(f => (
              <span key={f.label} className={`vflag ${f.severity}`}>{f.label}: {f.value}</span>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* Summary */}
      <CollapsibleCard title="Triage summary">
        <div className="gap-y-sm">
          <div className="triage-row">
            <span className="triage-label">Acuity</span>
            <span className="triage-value" style={{ color: acuityColor(r.acuity) }}>{r.acuity.toUpperCase()}</span>
          </div>
          <div className="triage-row">
            <span className="triage-label">Score</span>
            <span className="triage-value">{r.score}</span>
          </div>
          <div className="triage-row">
            <span className="triage-label">Action</span>
            <span className="triage-value">{actionLabel(r.recommendedAction)}</span>
          </div>
          <div className="triage-row">
            <span className="triage-label">Appt type</span>
            <span className="triage-value">{r.appointmentType.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <p className="safety-note" style={{ marginTop: 10 }}>{r.safetyMessage}</p>
      </CollapsibleCard>

      {/* Pathway panels */}
      {r.activePathways.length > 0 && (
        <CollapsibleCard title="Clinical pathways" badge={r.activePathways.length} badgeVariant="danger">
          <div className="gap-y-sm">
            {r.activePathways.map(pw => (
              <div key={pw.id} className={`pathway ${pw.severity}`}>
                <div
                  className="pathway-header"
                  onClick={() => setExpandedPathway(expandedPathway === pw.id ? null : pw.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span>{pw.severity === 'urgent' ? '🚨' : '⚠️'}</span>
                  <span style={{ flex: 1 }}>{pw.title}</span>
                  <span style={{ fontSize: 11, opacity: .7 }}>{expandedPathway === pw.id ? '▲' : '▼'}</span>
                </div>
                {expandedPathway === pw.id && (
                  <div className="pathway-body">
                    <ul className="pathway-check">
                      {pw.checklist.map(item => <li key={item}>{item}</li>)}
                    </ul>
                    {pw.contacts.length > 0 && (
                      <div className="pathway-contacts">
                        <span>Contact: </span>{pw.contacts.join(' · ')}
                      </div>
                    )}
                    {pw.doctorNotes && isDoctor && (
                      <div className="pathway-note">{pw.doctorNotes}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* Reasons detected */}
      <CollapsibleCard title="Red flags detected" badge={r.reasons.length || 'none'} badgeVariant={r.reasons.length ? 'danger' : 'default'}>
        {r.reasons.length ? (
          <ul className="list">
            {r.reasons.map(reason => <li key={reason}>{reason}</li>)}
          </ul>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>No red flags detected yet. Complete the intake fields to update.</p>
        )}
      </CollapsibleCard>

      {/* Two col: questions + blocks */}
      <div className="two-col">
        <CollapsibleCard title="Questions to ask next" badge={r.questionsToAsk.length || undefined}>
          {r.questionsToAsk.length ? (
            <ul className="qlist">
              {r.questionsToAsk.map(q => <li key={q}>{q}</li>)}
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>No specific questions needed.</p>
          )}
        </CollapsibleCard>

        <CollapsibleCard title="Adaptive EMR blocks" badge={r.suggestedBlocks.length || undefined}>
          <div className="chips">
            {r.suggestedBlocks.map(b => <span key={b} className="chip static">{b}</span>)}
          </div>
        </CollapsibleCard>
      </div>

      {/* Missing fields */}
      {r.missingCriticalFields.length > 0 && (
        <CollapsibleCard title="Missing critical fields" badge={r.missingCriticalFields.length} badgeVariant="warn">
          <div className="chips">
            {r.missingCriticalFields.map(f => <span key={f} className="chip" style={{ borderColor: '#f59e0b', color: '#92400e' }}>{f}</span>)}
          </div>
        </CollapsibleCard>
      )}

      {/* Front-desk script */}
      <CollapsibleCard title={isDoctor ? 'Front-desk script (reference)' : 'Safe front-desk script'}>
        {isDoctor && (
          <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--muted)' }}>
            Script generated for front-desk staff to read to patient over the phone.
          </p>
        )}
        <div className="script-box">{r.frontDeskScript}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={copyScript}
            style={{
              padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
              background: scriptCopied ? 'var(--accent)' : 'var(--surface)',
              color: scriptCopied ? '#fff' : 'var(--text)',
              fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {scriptCopied ? 'Copied' : 'Copy script'}
          </button>
        </div>
        <p className="safety-note">Do not add clinical advice, diagnoses, medication instructions, fees, or results interpretation to this script.</p>
      </CollapsibleCard>

      {/* Book appointment — shown for non-routine acuity or non-admin actions */}
      {(r.acuity !== 'routine' || r.recommendedAction !== 'admin_review') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
          <button
            className="summary-btn summary-btn--primary"
            style={{ height: 38, minWidth: 180, background: 'var(--accent)', borderColor: 'var(--accent)', fontSize: 13 }}
            onClick={() => setTopSection('scheduling')}
          >
            📅 Book appointment
          </button>
        </div>
      )}
    </div>
  );
}
