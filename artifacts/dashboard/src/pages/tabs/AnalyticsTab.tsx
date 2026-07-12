import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { errMsg } from '@/lib/err';

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

// ─── Surgical Quality Panel ───────────────────────────────────────────────────

interface QiKpi {
  label: string;
  value: string;
  denominator: string;
  benchmark: string;
  note: string;
}

const DEFAULT_KPIS: QiKpi[] = [
  { label: 'Surgical site infection (SSI) rate', value: '', denominator: 'per 100 procedures', benchmark: '< 3%', note: '' },
  { label: 'Unplanned return to theatre', value: '', denominator: 'per 100 procedures', benchmark: '< 2%', note: '' },
  { label: '30-day readmission rate', value: '', denominator: 'per 100 procedures', benchmark: '< 5%', note: '' },
  { label: 'Major complication rate (Clavien ≥ IIIa)', value: '', denominator: 'per 100 procedures', benchmark: '< 4%', note: '' },
  { label: '30-day mortality', value: '', denominator: 'per 100 procedures', benchmark: '< 1%', note: '' },
  { label: 'Conversion rate (lap → open)', value: '', denominator: 'per 100 lap cases', benchmark: '< 5%', note: '' },
  { label: 'WHO checklist compliance', value: '', denominator: '% cases', benchmark: '100%', note: '' },
  { label: 'Consent documentation rate', value: '', denominator: '% elective cases', benchmark: '100%', note: '' },
];

function SurgicalQualityPanel() {
  const [kpis, setKpis] = useState<QiKpi[]>(DEFAULT_KPIS);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
  });
  const [open, setOpen] = useState(false);

  function updateKpi(idx: number, field: keyof QiKpi, val: string) {
    setKpis(prev => prev.map((k, i) => i === idx ? { ...k, [field]: val } : k));
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--muted, #64748b)', background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 0 10px', borderBottom: open ? '1px solid #f1f5f9' : 'none',
        }}
      >
        <span>Surgical quality indicators (manual audit)</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Audit period:</label>
            <input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5, width: 120 }}
            />
            <span style={{ fontSize: 11, color: '#6b7280' }}>Enter values as percentages or counts. Benchmarks shown for reference.</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['Indicator', 'Value', 'Unit', 'Benchmark', 'Notes'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 700, color: '#374151', fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '6px 6px', color: '#1e293b', fontWeight: 500, width: '32%' }}>{kpi.label}</td>
                  <td style={{ padding: '4px 6px', width: '10%' }}>
                    <input
                      value={kpi.value}
                      onChange={e => updateKpi(i, 'value', e.target.value)}
                      placeholder="—"
                      style={{ width: '100%', fontSize: 12, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 4 }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px', color: '#6b7280', width: '18%' }}>{kpi.denominator}</td>
                  <td style={{ padding: '4px 6px', width: '10%' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f0fdf4', color: '#15803d',
                      fontWeight: 600, border: '1px solid #bbf7d0', whiteSpace: 'nowrap',
                    }}>
                      {kpi.benchmark}
                    </span>
                  </td>
                  <td style={{ padding: '4px 6px', width: '30%' }}>
                    <input
                      value={kpi.note}
                      onChange={e => updateKpi(i, 'note', e.target.value)}
                      placeholder="Add note…"
                      style={{ width: '100%', fontSize: 11, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 4 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 10, color: '#9ca3af' }}>
            Benchmarks are indicative. Local and regional guidelines take precedence. Data not saved to server — for local reference only.
          </div>
        </div>
      )}
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
      setError(errMsg(e));
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

      <SurgicalQualityPanel />

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted, #64748b)' }}>
        Data sourced live from Supabase · ECT (UTC−4) · Refresh to update
      </div>
    </div>
  );
}
