import { useState } from 'react';
import { Users, HeartPulse, CalendarClock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import PatientSearchTab from './PatientSearchTab';
import VisitManagerTab from '../VisitManager';
import FollowUpTrackerTab from './FollowUpTrackerTab';

type HubTab = 'list' | 'visits' | 'followup';

interface Props {
  defaultTab?: HubTab;
}

export default function PatientsHubTab({ defaultTab = 'list' }: Props) {
  const [active, setActive] = useState<HubTab>(defaultTab);
  const { profile } = useAuth();
  const role = profile?.role ?? 'doctor';
  const canSeeVisits = role === 'doctor' || role === 'admin';

  return (
    <div className="patients-hub">
      <div className="patients-hub-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={active === 'list'}
          className={`patients-hub-tab${active === 'list' ? ' patients-hub-tab--active' : ''}`}
          onClick={() => setActive('list')}
        >
          <Users size={14} />
          List
        </button>

        {canSeeVisits && (
          <button
            role="tab"
            aria-selected={active === 'visits'}
            className={`patients-hub-tab${active === 'visits' ? ' patients-hub-tab--active' : ''}`}
            onClick={() => setActive('visits')}
          >
            <HeartPulse size={14} />
            Visits
          </button>
        )}

        <button
          role="tab"
          aria-selected={active === 'followup'}
          className={`patients-hub-tab${active === 'followup' ? ' patients-hub-tab--active' : ''}`}
          onClick={() => setActive('followup')}
        >
          <CalendarClock size={14} />
          Follow-up
        </button>
      </div>

      <div className="patients-hub-content">
        {active === 'list'     && <PatientSearchTab />}
        {active === 'visits'   && <VisitManagerTab />}
        {active === 'followup' && <FollowUpTrackerTab />}
      </div>
    </div>
  );
}
