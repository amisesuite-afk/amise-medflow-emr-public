import {
  LayoutDashboard, Users, ClipboardList, Stethoscope,
  Scissors, CalendarDays, Receipt, BarChart2, Settings,
  PanelLeftClose, PanelLeftOpen, AlertTriangle, FileText,
  Pill, ShieldAlert, Cigarette, ClipboardCheck, FileEdit,
  FolderOpen, ChevronDown, ChevronRight as ChevronRightIcon, FlaskConical, ListChecks,
  ScanLine, Paperclip, FileCheck2, Activity,
} from 'lucide-react';
import type { UserRole } from '@/lib/supabase';
import type { Section, TopSection } from '@/context/AppContext';
import { hasRole } from '@/lib/roles';

export type { TopSection };

interface NavSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  topSection: TopSection;
  onTopSection: (s: TopSection) => void;
  activeSection: Section;
  onSection: (s: Section) => void;
  userRole: UserRole;
  hasUrgentRedFlag: boolean;
  urgentCount: number;
  acuity: string;
  pmhCount?: number;
  encounterMode?: 'outpatient' | 'inpatient';
}

const CLINICAL_SUB: {
  id: Section;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  label: string;
  minRole?: UserRole;
}[] = [
  { id: 'triage',      icon: AlertTriangle,  label: 'Triage' },
  { id: 'pmh',         icon: FileText,       label: 'PMH' },
  { id: 'surgical',    icon: Scissors,       label: 'Surgical Hx' },
  { id: 'medications', icon: Pill,           label: 'Medications' },
  { id: 'allergies',   icon: ShieldAlert,    label: 'Allergies' },
  { id: 'toxic',       icon: Cigarette,      label: 'Toxic Habits' },
  { id: 'scales',      icon: ClipboardCheck, label: 'Scales' },
  { id: 'ros',         icon: ListChecks,     label: 'Review of Systems' },
  { id: 'examination',     icon: Stethoscope,    label: 'Examination',    minRole: 'nurse' },
  { id: 'investigations', icon: FlaskConical,   label: 'Investigations', minRole: 'nurse' },
  { id: 'radiology',      icon: ScanLine,       label: 'Radiology',      minRole: 'nurse' },
  { id: 'attachments',    icon: Paperclip,      label: 'Attachments',    minRole: 'nurse' },
  { id: 'assessment',     icon: ClipboardCheck, label: 'Assessment',     minRole: 'doctor' },
  { id: 'plan',           icon: FileEdit,       label: 'Plan',           minRole: 'doctor' },
  { id: 'progress',       icon: FileText,       label: 'Progress Notes' },
  { id: 'monitoring',    icon: Activity,       label: 'Monitoring' },
];

const BILLING_SUB: { id: Section; icon: React.FC<{ size?: number; strokeWidth?: number }>; label: string }[] = [
  { id: 'billing',   icon: Receipt,   label: 'Billing' },
  { id: 'documents', icon: FolderOpen, label: 'Documents' },
];

interface TopItem {
  id: TopSection;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  label: string;
  /** Roles that can see this nav item. */
  roles: readonly UserRole[];
}

const TOP_ITEMS: TopItem[] = [
  { id: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard',    roles: ['front_desk', 'nurse', 'doctor', 'admin'] },
  { id: 'patients',     icon: Users,           label: 'Patients',     roles: ['front_desk', 'nurse', 'doctor', 'admin'] },
  { id: 'intake',       icon: ClipboardList,   label: 'Intake',       roles: ['front_desk', 'nurse', 'doctor', 'admin'] },
  { id: 'consultation', icon: Stethoscope,     label: 'Consultation', roles: ['front_desk', 'nurse', 'doctor', 'admin'] },
  { id: 'procedures',   icon: Scissors,        label: 'Procedures',   roles: ['doctor', 'admin'] },
  { id: 'scheduling',   icon: CalendarDays,    label: 'Scheduling',   roles: ['front_desk', 'nurse', 'doctor', 'admin'] },
  { id: 'finaldoc',     icon: FileCheck2,      label: 'Summary',      roles: ['nurse', 'doctor', 'admin'] },
  { id: 'billing',      icon: Receipt,         label: 'Billing',      roles: ['front_desk', 'admin'] },
  { id: 'analytics',    icon: BarChart2,       label: 'Analytics',    roles: ['doctor', 'admin'] },
  { id: 'settings',     icon: Settings,        label: 'Settings',     roles: ['admin'] },
];

export default function NavSidebar({
  collapsed, onToggle,
  topSection, onTopSection,
  activeSection, onSection,
  userRole, hasUrgentRedFlag, urgentCount, acuity,
  pmhCount = 0,
  encounterMode = 'outpatient',
}: NavSidebarProps) {
  const consultOpen = topSection === 'consultation';
  const billingOpen = topSection === 'billing';

  function handleTop(item: TopItem) {
    onTopSection(item.id);
    if (item.id === 'intake')        { onSection('intake'); }
    if (item.id === 'procedures')    { onSection('procedures'); }
    if (item.id === 'consultation')  { onSection('triage'); }
    if (item.id === 'billing')       { onSection('billing'); }
  }

  function subActive(id: Section) {
    return topSection === 'consultation' && activeSection === id;
  }
  function billingSubActive(id: Section) {
    return topSection === 'billing' && activeSection === id;
  }

  const visibleItems = TOP_ITEMS.filter(item => item.roles.includes(userRole));

  return (
    <nav className={`nav-sidebar${collapsed ? ' nav-sidebar--collapsed' : ''}`} aria-label="Navigation">
      <div className="nav-sidebar__body">
        {visibleItems.map(item => {
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
                {!collapsed && (
                  <span className="nsb-label">
                    {item.id === 'finaldoc' && encounterMode === 'inpatient'
                      ? 'Summary (Inpatient)'
                      : item.label}
                  </span>
                )}
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
                  {CLINICAL_SUB
                    .filter(s => !s.minRole || hasRole(userRole, s.minRole))
                    .map(sub => {
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
