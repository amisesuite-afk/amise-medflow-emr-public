import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { useAuth } from '@/context/AuthContext';
import { SITE_LABELS } from '@/lib/supabase';
import { PUBLIC_HOLIDAYS_SLU } from '@workspace/triage-engine';
import { useState, useEffect } from 'react';
import bundledCache from '@/data/calendar-cache.json';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/St_Lucia' });
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso);
  const dow = DAY_NAMES[d.getDay()];
  const date = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  return `${dow} ${date} ${month}`;
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, color: '#fff', background: acuityColor(acuity), fontSize: 12, fontWeight: 800 }}>
      <span>{acuity.toUpperCase()}</span>
      <span style={{ opacity: 0.85 }}>· {score}</span>
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

interface CalEvent { id: string; summary: string; start: string; end: string; type: string }

function typeChip(type: string): React.CSSProperties {
  if (type === 'theatre')   return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
  if (type === 'endoscopy') return { background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' };
  if (type === 'break')     return { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' };
  return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
}

// Use VITE_API_URL when deployed (e.g. Render); fall back to same-origin proxy in dev
const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${base}${path}`;
}

export default function DashboardTab() {
  const ctx = useAppContext();
  const { profile } = useAuth();
  const r = ctx.triageResult;
  const holiday = isHolidayToday();
  const today = todayInECT();

  const [upcoming, setUpcoming] = useState<CalEvent[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [syncStatus, setSyncStatus] = useState<'live' | 'cached' | 'loading'>('loading');

  useEffect(() => {
    setCalLoading(true);
    setSyncStatus('loading');

    // Load bundled calendar data immediately (works on GitHub Pages with no API server)
    const now = new Date();
    const cutoff = new Date(now.getTime() + 45 * 86400_000);
    const bundledEvents = (bundledCache.events as CalEvent[]).filter(e => {
      const start = new Date(e.start);
      return start >= now && start < cutoff;
    });

    // Try live API sync — if available, override bundled data
    fetch(apiUrl('/api/scheduling/sync'), { method: 'POST' })
      .then(r => r.json())
      .then((d: { synced?: boolean }) => { setSyncStatus(d.synced ? 'live' : 'cached'); })
      .catch(() => { setSyncStatus('cached'); })
      .finally(() => {
        fetch(apiUrl('/api/scheduling/upcoming?days=45'))
          .then(r => r.json())
          .then((d: { events?: CalEvent[] }) => {
            if (d.events && d.events.length > 0) {
              setUpcoming(d.events);
            } else {
              setUpcoming(bundledEvents);
              setSyncStatus('cached');
            }
          })
          .catch(() => {
            setUpcoming(bundledEvents);
            setSyncStatus('cached');
          })
          .finally(() => setCalLoading(false));
      });
  }, []);

  // Group by date
  const byDate: Record<string, CalEvent[]> = {};
  for (const ev of upcoming) {
    const dateKey = ev.start.slice(0, 10);
    (byDate[dateKey] ??= []).push(ev);
  }
  const dates = Object.keys(byDate).sort();

  const selectedEvents = byDate[selectedDate] ?? [];
  const todayEvents = byDate[today] ?? [];

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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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

      {/* Card 5 — Today at a glance */}
      {!calLoading && todayEvents.length > 0 && (
        <div style={{ ...cardStyle(), borderColor: '#0b8278', borderWidth: 2 }}>
          <div style={{ ...titleStyle, color: '#0b8278' }}>
            Today — {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/St_Lucia' }).format(new Date())}
          </div>
          {holiday && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#92400e', fontWeight: 700 }}>
              Public holiday — clinic may be modified
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {todayEvents.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 8px', borderRadius: 5, background: '#f8fffe' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 80 }}>
                  {formatTime(ev.start)}
                </span>
                <span style={{ fontSize: 12, fontWeight: ev.type === 'break' ? 400 : 600, color: ev.type === 'break' ? 'var(--muted)' : '#1a2e2b', flex: 1 }}>
                  {ev.summary}
                </span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700, ...typeChip(ev.type) }}>
                  {ev.type}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            {SITE_LABELS[ctx.currentSite as keyof typeof SITE_LABELS] ?? ctx.currentSite} · amisesuite@gmail.com
          </div>
        </div>
      )}

      {/* Card 6 — Upcoming schedule browser */}
      <div style={cardStyle(true)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={titleStyle}>Upcoming appointments</div>
            {syncStatus === 'live' && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 10, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Live
              </span>
            )}
            {syncStatus === 'cached' && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 10, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cached
              </span>
            )}
          </div>
          {calLoading && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</span>}
        </div>

        {!calLoading && dates.length === 0 && (
          <div style={emptyStyle}>
            No upcoming appointments in cache — start the API server to load schedule
          </div>
        )}

        {dates.length > 0 && (
          <>
            {/* Date tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {dates.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selectedDate === d ? 'var(--accent)' : '#e2e8f0',
                    background: selectedDate === d ? 'var(--accent)' : '#fff',
                    color: selectedDate === d ? '#fff' : (d === today ? 'var(--accent)' : '#374151'),
                  }}
                >
                  {d === today ? 'Today' : formatDateHeading(byDate[d][0].start)}
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>·{byDate[d].filter(e => e.type !== 'break').length}</span>
                </button>
              ))}
            </div>

            {/* Event list for selected date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {selectedEvents.length === 0 ? (
                <div style={emptyStyle}>No appointments</div>
              ) : (
                selectedEvents.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 8px', borderRadius: 5, background: '#f8fffe' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 80 }}>
                      {formatTime(ev.start)}–{formatTime(ev.end)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: ev.type === 'break' ? 400 : 600, color: ev.type === 'break' ? 'var(--muted)' : '#1a2e2b', flex: 1 }}>
                      {ev.summary}
                    </span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700, flexShrink: 0, ...typeChip(ev.type) }}>
                      {ev.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {profile && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            Logged in as {profile.full_name ?? profile.email} · {profile.role}
          </div>
        )}
      </div>
    </div>
  );
}
