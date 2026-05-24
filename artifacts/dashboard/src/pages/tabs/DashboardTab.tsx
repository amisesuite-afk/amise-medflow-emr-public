import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { SITE_LABELS } from '@/lib/supabase';
import { SLOT_RULES, PUBLIC_HOLIDAYS_SLU } from '@/lib/rules';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const APPT_LABELS: Record<string, string> = {
  new_consult:   'New Consultation',
  follow_up:     'Follow-up',
  post_op:       'Post-operative Review',
  ercp_workup:   'ERCP Work-up',
  ercp:          'ERCP Procedure',
  breast:        'Breast Clinic',
  telephone:     'Telephone Consultation',
  diabetic_foot: 'Diabetic Foot Clinic',
};

const ACTION_LABELS: Record<string, string> = {
  emergency_now:    'Escalate now — emergency pathway',
  same_day_call:    'Same-day clinical call',
  priority_24_48h:  'Priority review within 24–48 hours',
  routine_booking:  'Routine booking pathway',
  admin_review:     'Administrative review',
};

function acuityColor(a: string): string {
  if (a === 'urgent')   return 'var(--urgent)';
  if (a === 'priority') return 'var(--priority)';
  if (a === 'review')   return 'var(--review)';
  return 'var(--accent)';
}

function todayInECT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/St_Lucia' }).format(new Date());
}

function isHolidayToday(): boolean {
  return PUBLIC_HOLIDAYS_SLU.includes(todayInECT());
}

function cardStyle(accent?: boolean): React.CSSProperties {
  return {
    background: '#fff',
    border: `1px solid ${accent ? 'var(--accent)' : '#e2e8f0'}`,
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };
}

const titleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--muted)',
  marginBottom: 4,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  fontStyle: 'italic',
};

function AcuityBadge({ acuity, score }: { acuity: string; score: number }) {
  return (
    <span
      className={`acuity-badge ${acuity}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, color: '#fff', background: acuityColor(acuity), fontSize: 12, fontWeight: 800 }}
    >
      <span className="ab-level">{acuity.toUpperCase()}</span>
      <span className="ab-score" style={{ opacity: 0.85 }}>· {score}</span>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const bg = severity === 'urgent' ? 'var(--urgent)' : severity === 'priority' ? 'var(--priority)' : 'var(--review)';
  return (
    <span style={{ background: bg, color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
      {severity}
    </span>
  );
}

export default function DashboardTab() {
  const ctx = useAppContext();
  const { profile } = useAuth();
  const r = ctx.triageResult;
  const holiday = isHolidayToday();

  const allRules = Object.entries(SLOT_RULES);

  return (
    <div className="gap-y">
      {/* Card 1 — Current patient */}
      <div style={cardStyle()}>
        <div style={titleStyle}>Current patient</div>
        {!ctx.patientName.trim() ? (
          <div style={emptyStyle}>No patient loaded — start with New Patient in Intake</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2b' }}>{ctx.patientName}</div>
            {(ctx.age || ctx.sex !== 'unknown') && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {ctx.age ? `Age ${ctx.age}` : ''}
                {ctx.age && ctx.sex !== 'unknown' ? ' · ' : ''}
                {ctx.sex !== 'unknown' ? ctx.sex.charAt(0).toUpperCase() + ctx.sex.slice(1) : ''}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
              <AcuityBadge acuity={r.acuity} score={r.score} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ACTION_LABELS[r.recommendedAction] ?? r.recommendedAction}</span>
            </div>
          </div>
        )}
      </div>

      <div className="two-col">
        {/* Card 2 — Active pathways */}
        <div style={cardStyle()}>
          <div style={titleStyle}>Active pathways</div>
          {r.activePathways.length === 0 ? (
            <div style={emptyStyle}>No clinical pathways triggered</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {r.activePathways.map(pw => (
                <div key={pw.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SeverityBadge severity={pw.severity} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2b' }}>{pw.title}</span>
                  </div>
                  <ul style={{ margin: '0 0 0 12px', padding: 0, fontSize: 11, color: 'var(--muted)', listStyle: 'disc' }}>
                    {pw.checklist.slice(0, 3).map(item => (
                      <li key={item} style={{ marginBottom: 2 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3 — Vital flags */}
        <div style={cardStyle()}>
          <div style={titleStyle}>Vital flags</div>
          {r.vitalRedFlags.length === 0 ? (
            <div style={emptyStyle}>No vital sign alerts</div>
          ) : (
            <div className="vital-flags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {r.vitalRedFlags.map(f => (
                <span key={f.label} className={`vflag ${f.severity}`}>
                  <strong>{f.label}</strong>: {f.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card 4 — Missing intake fields */}
      <div style={cardStyle()}>
        <div style={titleStyle}>Missing intake fields</div>
        {r.missingCriticalFields.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--review)', fontWeight: 600 }}>All critical fields complete</div>
        ) : (
          <div className="chips">
            {r.missingCriticalFields.map(f => (
              <span key={f} className="chip" style={{ borderColor: '#f59e0b', color: '#92400e', background: '#fffbeb' }}>
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card 5 — Today's schedule */}
      <div style={cardStyle(true)}>
        <div style={titleStyle}>
          Today's schedule — {SITE_LABELS[ctx.currentSite as keyof typeof SITE_LABELS] ?? ctx.currentSite}
        </div>
        {holiday && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--priority)', fontWeight: 700 }}>
            Today is a public holiday — no routine clinics scheduled
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allRules.map(([type, rule]) => {
            const days = rule.days.map(d => DAY_NAMES[d]).join(', ') || 'By arrangement';
            return (
              <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', background: '#f8fffe', borderRadius: 6, border: '1px solid var(--accent-lt)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>
                  {APPT_LABELS[type] ?? type.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{days}</span>
                  <span>{rule.windowStart}–{rule.windowEnd}</span>
                  <span>{rule.durationMin} min</span>
                  <span>Max {rule.maxPerSession}/session</span>
                </div>
              </div>
            );
          })}
        </div>
        {profile && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Logged in as {profile.full_name ?? profile.email} · {profile.role}
          </div>
        )}
      </div>
    </div>
  );
}
