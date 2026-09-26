import { useState } from 'react';
import { BarChart2, Activity, Target } from 'lucide-react';
import AnalyticsTab from './AnalyticsTab';
import QualityImprovementTab from './QualityImprovementTab';
import CalibrationTab from './CalibrationTab';
import { useAuth } from '@/context/AuthContext';
import { roleIn } from '@/lib/roles';

type InsightsTab = 'analytics' | 'qi' | 'calibration';

interface Props {
  defaultTab?: InsightsTab;
}

export default function InsightsHubTab({ defaultTab = 'analytics' }: Props) {
  const [active, setActive] = useState<InsightsTab>(defaultTab);
  // Engine accuracy (outcomes loop) is an admin page: aggregate report, proposals, research export.
  const { profile, loading } = useAuth();
  const isAdmin = !loading && roleIn(profile?.role, 'admin');

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
      </div>

      <div className="patients-hub-content">
        {active === 'analytics' && <AnalyticsTab />}
        {active === 'qi'        && <QualityImprovementTab />}
        {active === 'calibration' && isAdmin && <CalibrationTab />}
      </div>
    </div>
  );
}
