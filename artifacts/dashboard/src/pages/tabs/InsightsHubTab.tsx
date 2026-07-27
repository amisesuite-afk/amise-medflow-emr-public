import { useState } from 'react';
import { BarChart2, Activity } from 'lucide-react';
import AnalyticsTab from './AnalyticsTab';
import QualityImprovementTab from './QualityImprovementTab';

type InsightsTab = 'analytics' | 'qi';

interface Props {
  defaultTab?: InsightsTab;
}

export default function InsightsHubTab({ defaultTab = 'analytics' }: Props) {
  const [active, setActive] = useState<InsightsTab>(defaultTab);

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
      </div>

      <div className="patients-hub-content">
        {active === 'analytics' && <AnalyticsTab />}
        {active === 'qi'        && <QualityImprovementTab />}
      </div>
    </div>
  );
}
