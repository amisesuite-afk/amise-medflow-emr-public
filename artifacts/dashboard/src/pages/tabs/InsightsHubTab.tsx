import { lazy, Suspense, useState } from 'react';
import { BarChart2, Activity, Target, ClipboardCheck } from 'lucide-react';
import AnalyticsTab from './AnalyticsTab';
import QualityImprovementTab from './QualityImprovementTab';
import CalibrationTab from './CalibrationTab';
import { useAuth } from '@/context/AuthContext';
import { roleIn } from '@/lib/roles';

// Loaded on demand: it carries the ~350 KB sign-off catalogue.
const ClinicalSignoffTab = lazy(() => import('./ClinicalSignoffTab'));

type InsightsTab = 'analytics' | 'qi' | 'calibration' | 'signoff';

interface Props {
  defaultTab?: InsightsTab;
}

export default function InsightsHubTab({ defaultTab = 'analytics' }: Props) {
  const [active, setActive] = useState<InsightsTab>(defaultTab);
  // Engine accuracy (outcomes loop) is an admin page: aggregate report, proposals, research export.
  const { profile, loading } = useAuth();
  const isAdmin = !loading && roleIn(profile?.role, 'admin');
  // Clinical sign-off: doctor and admin record decisions (Migration 95 insert policy).
  const canSignOff = !loading && roleIn(profile?.role, 'doctor', 'admin');

  return (
    <div className="patients-hub">
      <div className="patients-hub-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={active === 'analytics'}
          className={`patients-hub-tab${active === 'analytics' ? ' patients-hub-tab--active' : ''}`}
          onClick={() => setActive('analytics')}
        >
          <BarChart2 size={14} />
          Analytics
        </button>

        <button
          role="tab"
          aria-selected={active === 'qi'}
          className={`patients-hub-tab${active === 'qi' ? ' patients-hub-tab--active' : ''}`}
          onClick={() => setActive('qi')}
        >
          <Activity size={14} />
          QI / M&amp;M
        </button>

        {isAdmin && (
          <button
            role="tab"
            aria-selected={active === 'calibration'}
            className={`patients-hub-tab${active === 'calibration' ? ' patients-hub-tab--active' : ''}`}
            onClick={() => setActive('calibration')}
          >
            <Target size={14} />
            Engine accuracy
          </button>
        )}

        {canSignOff && (
          <button
            role="tab"
            aria-selected={active === 'signoff'}
            className={`patients-hub-tab${active === 'signoff' ? ' patients-hub-tab--active' : ''}`}
            onClick={() => setActive('signoff')}
            data-testid="insights-tab-signoff"
          >
            <ClipboardCheck size={14} />
            Clinical sign-off
          </button>
        )}
      </div>

      <div className="patients-hub-content">
        {active === 'analytics' && <AnalyticsTab />}
        {active === 'qi'        && <QualityImprovementTab />}
        {active === 'calibration' && isAdmin && <CalibrationTab />}
        {active === 'signoff' && canSignOff && (
          <Suspense fallback={<div style={{ padding: 16, fontSize: 12.5 }}>Loading…</div>}>
            <ClinicalSignoffTab />
          </Suspense>
        )}
      </div>
    </div>
  );
}
