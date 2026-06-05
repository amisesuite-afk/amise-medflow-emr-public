import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Metrics {
  totalPatients: number;
  encThisMonth: number;
  encLastMonth: number;
  apptUpcoming: number;
  apptToday: number;
  acuity: Record<string, number>;
  encByType: Record<string, number>;
  encBySite: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayECT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/St_Lucia' }).format(new Date());
}

function monthStart(offsetMonths = 0): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return d.toISOString();
}

function pct(n: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

const ACUITY_COLORS: Record<string, string> = {
  urgent:   'var(--urgent, #ef4444)',
  priority: 'var(--priority, #f59e0b)',
  review:   'var(--review, #3b82f6)',
  routine:  'var(--accent, #10b981)',
};

const SITE_LABELS: Record<string, string> = {
  rodney_bay: 'Rodney Bay',
  castries:   'Castries',
  tapion:     'Tapion / ERCP',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, accent,
}: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${accent ? accent + '44' : '#e2e8f0'}`,
      borderLeft: accent ? `4px solid ${accent}` : undefined,
      borderRadius: 8,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted, #64748b)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--muted, #64748b)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const w = total ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--muted, #64748b)' }}>{count} ({pct(count, total)})</span>
      </div>
      <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted, #64748b)', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsTab() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setError('Supabase not configured.'); setLoading(false); return; }

    try {
      const today = todayECT();
      const m0 = monthStart(0);
      const m1 = monthStart(-1);

      const [
        { count: totalPatients },
        { count: encThisMonth },
        { count: encLastMonth },
        { count: apptUpcoming },
        { count: apptToday },
        { data: acuityRows },
        { data: encRows },
      ] = await Promise.all([
        sb.from('patients').select('*', { count: 'exact', head: true }),
        sb.from('encounters').select('*', { count: 'exact', head: true }).gte('encounter_date', m0),
        sb.from('encounters').select('*', { count: 'exact', head: true }).gte('encounter_date', m1).lt('encounter_date', m0),
        sb.from('appointments').select('*', { count: 'exact', head: true }).gte('appointment_datetime', new Date().toISOString()).eq('status', 'scheduled'),
        sb.from('appointments').select('*', { count: 'exact', head: true }).gte('appointment_datetime', `${today}T00:00:00`).lte('appointment_datetime', `${today}T23:59:59`),
        sb.from('assessments').select('acuity').not('acuity', 'is', null),
        sb.from('encounters').select('encounter_type, site').gte('encounter_date', m0),
      ]);

      const acuity: Record<string, number> = {};
      for (const r of acuityRows ?? []) {
        const k = (r as { acuity: string }).acuity;
        acuity[k] = (acuity[k] ?? 0) + 1;
      }

      const encByType: Record<string, number> = {};
      const encBySite: Record<string, number> = {};
      for (const r of encRows ?? []) {
        const row = r as { encounter_type: string; site: string | null };
        encByType[row.encounter_type] = (encByType[row.encounter_type] ?? 0) + 1;
        if (row.site) encBySite[row.site] = (encBySite[row.site] ?? 0) + 1;
      }

      setMetrics({
        totalPatients: totalPatients ?? 0,
        encThisMonth: encThisMonth ?? 0,
        encLastMonth: encLastMonth ?? 0,
        apptUpcoming: apptUpcoming ?? 0,
        apptToday: apptToday ?? 0,
        acuity,
        encByType,
        encBySite,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!profile || !['doctor', 'admin'].includes(profile.role)) {
    return (
      <div style={{ padding: 24, color: 'var(--muted, #64748b)', fontSize: 13 }}>
        Analytics is available to doctors and admins only.
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--muted, #64748b)', fontSize: 13 }}>Loading analytics…</div>;
  }

  if (error || !metrics) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: 'var(--urgent, #ef4444)', fontSize: 13 }}>
          {error || 'Unable to load analytics.'}
        </div>
        <button onClick={() => { setLoading(true); setError(''); void load(); }} style={{ marginTop: 12, fontSize: 12, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  const encDelta = metrics.encLastMonth
    ? Math.round(((metrics.encThisMonth - metrics.encLastMonth) / metrics.encLastMonth) * 100)
    : null;
  const encDeltaStr = encDelta === null ? 'no prior data'
    : encDelta >= 0 ? `+${encDelta}% vs last month`
    : `${encDelta}% vs last month`;

  const totalAcuity = Object.values(metrics.acuity).reduce((s, n) => s + n, 0);
  const totalEnc = metrics.encThisMonth;
  const totalSite = Object.values(metrics.encBySite).reduce((s, n) => s + n, 0);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Practice Analytics</div>
        <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginTop: 2 }}>
          Amise Medical Services · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/St_Lucia' })}
        </div>
      </div>

      {/* Metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
        <MetricCard label="Total Patients" value={metrics.totalPatients} />
        <MetricCard label="Encounters (month)" value={metrics.encThisMonth} sub={encDeltaStr} />
        <MetricCard label="Today's Appointments" value={metrics.apptToday} accent="var(--accent, #10b981)" />
        <MetricCard label="Upcoming Scheduled" value={metrics.apptUpcoming} />
      </div>

      {/* Acuity breakdown */}
      {totalAcuity > 0 && (
        <Section title="Acuity Distribution (all-time assessments)">
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
            {(['urgent', 'priority', 'review', 'routine'] as const).map(a => (
              (metrics.acuity[a] ?? 0) > 0 && (
                <BarRow
                  key={a}
                  label={a.charAt(0).toUpperCase() + a.slice(1)}
                  count={metrics.acuity[a] ?? 0}
                  total={totalAcuity}
                  color={ACUITY_COLORS[a]}
                />
              )
            ))}
          </div>
        </Section>
      )}

      {/* Encounter type breakdown */}
      {totalEnc > 0 && (
        <Section title={`Encounter Types — This Month (${totalEnc} total)`}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
            {Object.entries(metrics.encByType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <BarRow
                  key={type}
                  label={type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  count={count}
                  total={totalEnc}
                  color="var(--accent, #10b981)"
                />
              ))}
          </div>
        </Section>
      )}

      {/* Site breakdown */}
      {totalSite > 0 && (
        <Section title="By Site — This Month">
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
            {Object.entries(metrics.encBySite)
              .sort(([, a], [, b]) => b - a)
              .map(([site, count]) => (
                <BarRow
                  key={site}
                  label={SITE_LABELS[site] ?? site}
                  count={count}
                  total={totalSite}
                  color="var(--review, #3b82f6)"
                />
              ))}
          </div>
        </Section>
      )}

      {totalAcuity === 0 && totalEnc === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted, #64748b)', fontSize: 13, border: '1px dashed #e2e8f0', borderRadius: 8 }}>
          No encounter data yet. Analytics will populate as patient encounters are recorded.
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted, #64748b)' }}>
        Data sourced live from Supabase · ECT (UTC−4) · Refresh to update
      </div>
    </div>
  );
}
