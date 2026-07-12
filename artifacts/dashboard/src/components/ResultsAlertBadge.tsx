import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ResultsAlertState {
  criticalCount: number;
  pendingCount: number;
  unreviewedCount: number;
}

export default function ResultsAlertBadge({ patientId }: { patientId?: string }) {
  const [state, setState] = useState<ResultsAlertState>({ criticalCount: 0, pendingCount: 0, unreviewedCount: 0 });

  const fetch = useCallback(async () => {
    if (!supabase) return;
    try {
      let critQ = supabase
        .from('investigation_results')
        .select('id', { count: 'exact', head: true })
        .eq('is_critical', true)
        .is('acknowledged_by', null);
      if (patientId) critQ = critQ.eq('patient_id', patientId);
      const { count: criticalCount } = await critQ;

      let pendQ = supabase
        .from('investigation_results')
        .select('id', { count: 'exact', head: true })
        .in('status', ['ordered', 'collected', 'pending']);
      if (patientId) pendQ = pendQ.eq('patient_id', patientId);
      const { count: pendingCount } = await pendQ;

      let unrevQ = supabase
        .from('investigation_results')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resulted')
        .is('reviewed_by', null);
      if (patientId) unrevQ = unrevQ.eq('patient_id', patientId);
      const { count: unreviewedCount } = await unrevQ;

      setState({
        criticalCount: criticalCount ?? 0,
        pendingCount: pendingCount ?? 0,
        unreviewedCount: unreviewedCount ?? 0,
      });
    } catch {
      // Silently fail — tables may not exist yet
    }
  }, [patientId]);

  useEffect(() => {
    void fetch();
    const t = setInterval(() => void fetch(), 60_000);
    return () => clearInterval(t);
  }, [fetch]);

  const total = state.criticalCount + state.unreviewedCount;
  if (total === 0 && state.pendingCount === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {state.criticalCount > 0 && (
        <span
          title={`${state.criticalCount} critical result(s) requiring immediate review`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 20,
            background: '#fef2f2', border: '1px solid #fca5a5',
            color: '#dc2626', fontSize: 11, fontWeight: 700,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1.5s infinite' }} />
          {state.criticalCount} Critical
        </span>
      )}
      {state.unreviewedCount > 0 && (
        <span
          title={`${state.unreviewedCount} result(s) awaiting review`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 20,
            background: '#fff7ed', border: '1px solid #fdba74',
            color: '#c2410c', fontSize: 11, fontWeight: 700,
          }}
        >
          {state.unreviewedCount} Unreviewed
        </span>
      )}
      {state.pendingCount > 0 && (
        <span
          title={`${state.pendingCount} investigation(s) pending results`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 20,
            background: '#eff6ff', border: '1px solid #93c5fd',
            color: '#1d4ed8', fontSize: 11, fontWeight: 700,
          }}
        >
          {state.pendingCount} Pending
        </span>
      )}
    </div>
  );
}
