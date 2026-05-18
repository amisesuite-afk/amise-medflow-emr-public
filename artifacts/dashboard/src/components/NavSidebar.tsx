import {
  LayoutDashboard, Users, ClipboardList, Stethoscope,
  Scissors, CalendarDays, Receipt, BarChart2, Settings,
  PanelLeftClose, PanelLeftOpen, AlertTriangle, FileText,
  Pill, ShieldAlert, Cigarette, ClipboardCheck, FileEdit,
  FolderOpen, ChevronDown, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import type { Section, AppMode } from '@/context/AppContext';

export type TopSection =
  | 'dashboard' | 'patients' | 'intake' | 'consultation'
  | 'procedures' | 'scheduling' | 'billing' | 'analytics' | 'settings' | 'summary';

interface NavSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  topSection: TopSection;
  onTopSection: (s: TopSection) => void;
  activeSection: Section;
  onSection: (s: Section) => void;
  mode: AppMode;
  hasUrgentRedFlag: boolean;
  urgentCount: number;
  acuity: string;
  pmhCount?: number;
}

const CLINICAL_SUB: { id: Section; icon: React.FC<{ size?: number; strokeWidth?: number }>; label: string; doctorOnly?: boolean }[] = [
  { id: 'triage',      icon: AlertTriangle,    label: 'Triage' },
  { id: 'pmh',         icon: FileText,         label: 'PMH' },
  { id: 'surgical',    icon: Scissors,         label: 'Surgical Hx' },
  { id: 'medications', icon: Pill,             label: 'Medications' },
  { id: 'allergies',   icon: ShieldAlert,      label: 'Allergies' },
  { id: 'toxic',       icon: Cigarette,        label: 'Toxic Habits' },
  { id: 'scales',      icon: ClipboardCheck,   label: 'Scales' },
  { id: 'examination', icon: Stethoscope,      label: 'Examination' },
  { id: 'assessment',  icon: ClipboardCheck,   label: 'Assessment',  doctorOnly: true },
  { id: 'plan',        icon: FileEdit,         label: 'Plan',        doctorOnly: true },
];

const BILLING_SUB: { id: Section; icon: React.FC<{ size?: number; strokeWidth?: number }>; label: string }[] = [
  { id: 'billing',   icon: Receipt,  label: 'Billing' },
  { id: 'documents', icon: FolderOpen, label: 'Documents' },
];

interface TopItem {
  id: TopSection;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  label: string;
}

const TOP_ITEMS: TopItem[] = [
  { id: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'patients',     icon: Users,           label: 'Patients' },
  { id: 'intake',       icon: ClipboardList,   label: 'Intake' },
  { id: 'consultation', icon: Stethoscope,     label: 'Consultation' },
  { id: 'procedures',   icon: Scissors,        label: 'Procedures' },
  { id: 'scheduling',   icon: CalendarDays,    label: 'Scheduling' },
  { id: 'summary',      icon: FileEdit,        label: 'Summary' },
  { id: 'billing',      icon: Receipt,         label: 'Billing' },
  { id: 'analytics',    icon: BarChart2,       label: 'Analytics' },
  { id: 'settings',     icon: Settings,        label: 'Settings' },
];

export default function NavSidebar({
  collapsed, onToggle,
  topSection, onTopSection,
  activeSection, onSection,
  mode, hasUrgentRedFlag, urgentCount, acuity,
  pmhCount = 0,
}: NavSidebarProps) {
  const consultOpen = topSection === 'consultation';
  const billingOpen = topSection === 'billing';

  function handleTop(item: TopItem) {
    onTopSection(item.id);
    if (item.id === 'intake')    { onSection('intake'); }
    if (item.id === 'procedures') { onSection('procedures'); }
    if (item.id === 'consultation') { onSection('triage'); }
    if (item.id === 'billing')   { onSection('billing'); }
  }

  function subActive(id: Section) {
    return topSection === 'consultation' && activeSection === id;
  }
  function billingSubActive(id: Section) {
    return topSection === 'billing' && activeSection === id;
  }

  return (
    <nav className={`nav-sidebar${collapsed ? ' nav-sidebar--collapsed' : ''}`} aria-label="Navigation">
      <div className="nav-sidebar__body">
        {TOP_ITEMS.map(item => {
          const isActive = topSection === item.id;
          const Icon = item.icon;
          const isTriage = item.id === 'consultation' && hasUrgentRedFlag;
          const showConsultSub = item.id === 'consultation' && consultOpen && !collapsed;
          const showBillingSub = item.id === 'billing' && billingOpen && !collapsed;
          const hasChevron = (item.id === 'consultation' || item.id === 'billing') && !collapsed;

          return (
            <div key={item.id}>
              <button
                className={`nsb-item${isActive ? ' nsb-item--active' : ''}`}
                onClick={() => handleTop(item)}
                title={collapsed ? item.label : undefined}
              >
                <span className="nsb-icon">
                  <Icon size={16} strokeWidth={2} />
                  {isTriage && <span className="nsb-dot" />}
                </span>
                {!collapsed && <span className="nsb-label">{item.label}</span>}
                {!collapsed && hasChevron && (
                  isActive
                    ? <ChevronDown size={12} strokeWidth={2.5} className="nsb-chevron" />
                    : <ChevronRightIcon size={12} strokeWidth={2.5} className="nsb-chevron" />
                )}
                {!collapsed && isTriage && (
                  <span className={`nsb-badge${acuity === 'urgent' ? '' : ' nsb-badge--warn'}`}>
                    {urgentCount}
                  </span>
                )}
              </button>

              {/* Consultation sub-items */}
              {showConsultSub && (
                <div className="nsb-sub">
                  {CLINICAL_SUB.filter(s => !s.doctorOnly || mode === 'doctor').map(sub => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={sub.id}
                        className={`nsb-subitem${subActive(sub.id) ? ' nsb-subitem--active' : ''}`}
                        onClick={() => onSection(sub.id)}
                      >
                        <SubIcon size={13} strokeWidth={2} />
                        <span>
                          {sub.id === 'pmh' && pmhCount > 0
                            ? `${sub.label} (${pmhCount})`
                            : sub.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Billing sub-items */}
              {showBillingSub && (
                <div className="nsb-sub">
                  {BILLING_SUB.map(sub => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={sub.id}
                        className={`nsb-subitem${billingSubActive(sub.id) ? ' nsb-subitem--active' : ''}`}
                        onClick={() => onSection(sub.id)}
                      >
                        <SubIcon size={13} strokeWidth={2} />
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button className="nsb-toggle" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed
          ? <PanelLeftOpen size={15} strokeWidth={2} />
          : <><PanelLeftClose size={15} strokeWidth={2} />{!collapsed && <span>Collapse</span>}</>
        }
      </button>
    </nav>
  );
}
