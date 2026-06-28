import {
  LayoutDashboard, Users, ClipboardList, Stethoscope,
  Scissors, CalendarDays, Receipt, BarChart2, Settings,
  PanelLeftClose, PanelLeftOpen, AlertTriangle, FileText,
  Pill, ShieldAlert, Cigarette, ClipboardCheck, FileEdit,
  FolderOpen, ChevronDown, ChevronRight as ChevronRightIcon, FlaskConical, ListChecks,
  ScanLine, Paperclip, FileCheck2, Activity, BookOpen, Zap, FileQuestion, Inbox,
  Contact, HeartPulse, FileSignature, BrainCircuit, CircleCheckBig, Check,
} from 'lucide-react';
import type { UserRole } from '@/lib/supabase';
import type { Section, TopSection } from '@/context/AppContext';
import { hasRole } from '@/lib/roles';

export type { TopSection };

export type SectionCompletion = Partial<Record<Section, boolean>>;

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
  pendingBookingCount?: number;
  sectionCompletion?: SectionCompletion;
}

interface ClinicalSubItem {
  id: Section;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  label: string;
  minRole?: UserRole;
}

interface ClinicalPhase {
  key: string;
  label: string;
  items: ClinicalSubItem[];
}

const CLINICAL_PHASES: ClinicalPhase[] = [
  {
    key: 'intake',
    label: 'Intake',
    items: [
      { id: 'triage',      icon: AlertTriangle,  label: 'Triage' },
    ],
  },
  {
    key: 'history',
    label: 'History',
    items: [
      { id: 'pmh',         icon: FileText,       label: 'PMH' },
      { id: 'surgical',    icon: Scissors,       label: 'Surgical Hx' },
      { id: 'medications', icon: Pill,           label: 'Medications' },
      { id: 'allergies',   icon: ShieldAlert,    label: 'Allergies' },
      { id: 'toxic',       icon: Cigarette,      label: 'Toxic Habits' },
    ],
  },
  {
    key: 'review',
    label: 'Review',
    items: [
      { id: 'scales',       icon: ClipboardCheck, label: 'Scales' },
      { id: 'ros',           icon: ListChecks,     label: 'Review of Systems' },
      { id: 'examination',   icon: Stethoscope,    label: 'Examination',   minRole: 'nurse' },
    ],
  },
  {
    key: 'assessment',
    label: 'Assessment',
    items: [
      { id: 'assessment',     icon: ClipboardCheck, label: 'Assessment',     minRole: 'doctor' },
      { id: 'investigations', icon: FlaskConical,   label: 'Investigations', minRole: 'nurse' },
      { id: 'radiology',      icon: ScanLine,       label: 'Radiology',      minRole: 'nurse' },
      { id: 'attachments',    icon: Paperclip,      label: 'Attachments',    minRole: 'nurse' },
      { id: 'ai_consultant',  icon: BrainCircuit,   label: 'AI Aid',         minRole: 'doctor' },
    ],
  },
  {
    key: 'disposition',
    label: 'Disposition',
    items: [
      { id: 'plan',               icon: FileEdit,       label: 'Plan',           minRole: 'doctor' },
      { id: 'prescriptions',      icon: FileSignature,  label: 'Prescriptions',  minRole: 'doctor' },
      { id: 'referring_providers', icon: Contact,       label: 'Referrals',      minRole: 'doctor' },
    ],
  },
  {
    key: 'ongoing',
    label: 'Ongoing',
    items: [
      { id: 'progress',   icon: FileText,       label: 'Progress Notes' },
      { id: 'monitoring',  icon: Activity,       label: 'Monitoring' },
      { id: 'tasks',       icon: CircleCheckBig, label: 'Tasks' },
    ],
  },
];

const BILLING_SUB: { id: Section; icon: React.FC<{ size?: number; strokeWidth?: number }>; label: string }[] = [
  { id: 'billing',   icon: Receipt,   label: 'Billing' },
  { id: 'documents', icon: FolderOpen, label: 'Documents' },
];

interface TopItem {
  id: TopSection;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  label: string;
  roles: readonly UserRole[];
  group: string;
}

const NAV_ITEMS: TopItem[] = [
  { id: 'dashboard',      icon: LayoutDashboard, label: 'Dashboard',      roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Front Desk' },
  { id: 'booking_inbox',  icon: Inbox,           label: 'Booking Inbox',  roles: ['front_desk', 'nurse', 'admin'],           group: 'Front Desk' },
  { id: 'scheduling',     icon: CalendarDays,    label: 'Scheduling',     roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Front Desk' },

  { id: 'intake',         icon: ClipboardList,   label: 'Intake',         roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Pre-Visit' },
  { id: 'questionnaire',  icon: FileQuestion,    label: 'Questionnaire',  roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Pre-Visit' },
  { id: 'portal_intake',  icon: ClipboardCheck,  label: 'Portal Intake',  roles: ['doctor', 'admin'],                        group: 'Pre-Visit' },

  { id: 'consultation',   icon: Stethoscope,     label: 'Consultation',   roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Clinical' },
  { id: 'procedures',     icon: Scissors,        label: 'Procedures',     roles: ['doctor', 'admin'],                        group: 'Clinical' },
  { id: 'trauma',         icon: Zap,             label: 'Trauma',         roles: ['nurse', 'doctor', 'admin'],               group: 'Clinical' },

  { id: 'visit_lifecycle', icon: HeartPulse,     label: 'Visits',         roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Post-Visit' },
  { id: 'finaldoc',       icon: FileCheck2,      label: 'Summary',        roles: ['nurse', 'doctor', 'admin'],               group: 'Post-Visit' },
  { id: 'billing',        icon: Receipt,         label: 'Billing',        roles: ['front_desk', 'admin'],                    group: 'Post-Visit' },

  { id: 'patients',       icon: Users,           label: 'Patient Registry', roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Admin' },
  { id: 'analytics',      icon: BarChart2,       label: 'Analytics',      roles: ['doctor', 'admin'],                        group: 'Admin' },
  { id: 'vademecum',      icon: BookOpen,        label: 'Disease Dict.',  roles: ['nurse', 'doctor', 'admin'],               group: 'Admin' },
  { id: 'settings',       icon: Settings,        label: 'Settings',       roles: ['admin'],                                  group: 'Admin' },
];

export default function NavSidebar({
  collapsed, onToggle,
  topSection, onTopSection,
  activeSection, onSection,
  userRole, hasUrgentRedFlag, urgentCount, acuity,
  pmhCount = 0,
  encounterMode = 'outpatient',
  pendingBookingCount = 0,
  sectionCompletion = {},
}: NavSidebarProps) {
  const consultOpen = topSection === 'consultation';
  const billingOpen = topSection === 'billing';

  function handleTop(item: TopItem) {
    onTopSection(item.id);
    if (item.id === 'intake')          { onSection('intake'); }
    if (item.id === 'procedures')      { onSection('procedures'); }
    if (item.id === 'consultation')    { onSection('triage'); }
    if (item.id === 'billing')         { onSection('billing'); }
    if (item.id === 'questionnaire')   { onSection('apcq'); }
  }

  function subActive(id: Section) {
    return topSection === 'consultation' && activeSection === id;
  }
  function billingSubActive(id: Section) {
    return topSection === 'billing' && activeSection === id;
  }

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(userRole));

  // For phased clinical sub-nav: filter items by role, determine phase state
  const visiblePhases = CLINICAL_PHASES.map(phase => {
    const items = phase.items.filter(s => !s.minRole || hasRole(userRole, s.minRole));
    if (items.length === 0) return null;
    const doneCount = items.filter(s => sectionCompletion[s.id]).length;
    const hasActive = items.some(s => subActive(s.id));
    return { ...phase, items, doneCount, allDone: doneCount === items.length, hasActive };
  }).filter(Boolean) as Array<{
    key: string; label: string;
    items: ClinicalSubItem[];
    doneCount: number; allDone: boolean; hasActive: boolean;
  }>;

  // Find which phase contains the current active section
  const activePhaseKey = visiblePhases.find(p => p.hasActive)?.key;

  // First incomplete phase (for "next" guidance)
  const nextPhaseKey = visiblePhases.find(p => !p.allDone && !p.hasActive)?.key;

  let lastGroup = '';

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

          const showGroupHeader = !collapsed && item.group !== lastGroup;
          if (item.group !== lastGroup) lastGroup = item.group;

          return (
            <div key={item.id}>
              {showGroupHeader && (
                <div className="nsb-group-header">{item.group}</div>
              )}
              <button
                className={`nsb-item${isActive ? ' nsb-item--active' : ''}`}
                onClick={() => handleTop(item)}
                title={collapsed ? item.label : undefined}
              >
                <span className="nsb-icon">
                  <Icon size={16} strokeWidth={2} />
                  {isTriage && <span className="nsb-dot" />}
                  {item.id === 'booking_inbox' && pendingBookingCount > 0 && <span className="nsb-dot" />}
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
                {!collapsed && item.id === 'booking_inbox' && pendingBookingCount > 0 && (
                  <span className="nsb-badge nsb-badge--warn">{pendingBookingCount}</span>
                )}
              </button>

              {/* ── Phased consultation sub-nav ── */}
              {showConsultSub && (
                <div className="nsb-sub nsb-phased">
                  {visiblePhases.map((phase, pi) => {
                    const isActivePhase = phase.key === activePhaseKey;
                    const isNextPhase = phase.key === nextPhaseKey && !activePhaseKey;
                    const showItems = isActivePhase || !phase.allDone || phase.hasActive;

                    return (
                      <div key={phase.key} className="nsb-phase">
                        {/* Phase header */}
                        <div className={`nsb-phase-header${phase.allDone ? ' nsb-phase-header--done' : ''}${isActivePhase ? ' nsb-phase-header--active' : ''}`}>
                          <span className={`nsb-phase-step${phase.allDone ? ' nsb-phase-step--done' : isActivePhase ? ' nsb-phase-step--active' : ''}`}>
                            {phase.allDone
                              ? <Check size={10} strokeWidth={3} />
                              : <span>{pi + 1}</span>
                            }
                          </span>
                          <span className="nsb-phase-label">{phase.label}</span>
                          <span className="nsb-phase-count">{phase.doneCount}/{phase.items.length}</span>
                        </div>

                        {/* Phase items — show if phase is active, has the current section, or is incomplete */}
                        {showItems && phase.items.map(sub => {
                          const SubIcon = sub.icon;
                          const done = !!sectionCompletion[sub.id];
                          const isCurrent = subActive(sub.id);
                          return (
                            <button
                              key={sub.id}
                              className={`nsb-subitem nsb-subitem--phased${isCurrent ? ' nsb-subitem--active' : ''}${done && !isCurrent ? ' nsb-subitem--done' : ''}`}
                              onClick={() => onSection(sub.id)}
                            >
                              <span className={`nsb-check${done ? ' nsb-check--done' : isCurrent ? ' nsb-check--current' : ''}`}>
                                {done ? <Check size={10} strokeWidth={3} /> : null}
                              </span>
                              <SubIcon size={13} strokeWidth={2} />
                              <span>
                                {sub.id === 'pmh' && pmhCount > 0
                                  ? `${sub.label} (${pmhCount})`
                                  : sub.label}
                              </span>
                            </button>
                          );
                        })}

                        {/* Collapsed done phase — just the header acts as summary */}
                        {!showItems && phase.allDone && (
                          <button
                            className="nsb-phase-expand"
                            onClick={() => onSection(phase.items[0].id)}
                          >
                            All complete — tap to review
                          </button>
                        )}
                      </div>
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
