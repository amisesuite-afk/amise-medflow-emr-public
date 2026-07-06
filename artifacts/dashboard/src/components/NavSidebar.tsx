import {
  LayoutDashboard, Users, ClipboardList, Stethoscope,
  Scissors, CalendarDays, Receipt, BarChart2, Settings,
  PanelLeftClose, PanelLeftOpen, AlertTriangle, FileText,
  Pill, ShieldAlert, Cigarette, ClipboardCheck, FileEdit,
  FolderOpen, ChevronDown, ChevronRight as ChevronRightIcon, FlaskConical, ListChecks,
  ScanLine, Paperclip, FileCheck2, Activity, BookOpen, Zap, Inbox,
  Contact, HeartPulse, FileSignature, BrainCircuit, CircleCheckBig, Check,
  MessageSquare, Tags, ClipboardMinus, ScrollText, MailOpen, GraduationCap, ShieldCheck,
  Calculator, Droplets, Bandage, UserCheck,
} from 'lucide-react';
import type { UserRole } from '@/lib/supabase';
import type { Section, TopSection, EncounterType } from '@/context/AppContext';
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
  encounterType?: EncounterType;
  pendingBookingCount?: number;
  criticalResultCount?: number;
  sectionCompletion?: SectionCompletion;
  suggestedBlocks?: string[];
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
  minRole?: UserRole;
  items: ClinicalSubItem[];
}

// Consultation sequence mirrors Dr Kabiye's standard surgical consultation template.
// Sequence: CC → HPI → PMH → Surgical → Meds → Allergies → Family Hx → Social Hx → ROS → Exam → Investigations → Assessment → Plan
const CLINICAL_PHASES: ClinicalPhase[] = [
  {
    key: 'history',
    label: 'History',
    items: [
      { id: 'nurse_apcq',  icon: MessageSquare, label: 'Chief Complaint', minRole: 'nurse' },
      { id: 'hpi',         icon: FileEdit,      label: 'HPI' },
      { id: 'pmh',         icon: FileText,      label: 'Past Medical Hx' },
      { id: 'surgical',    icon: Scissors,      label: 'Surgical Hx' },
      { id: 'medications', icon: Pill,          label: 'Medications' },
      { id: 'allergies',   icon: ShieldAlert,   label: 'Allergies' },
    ],
  },
  {
    key: 'social_ros',
    label: 'Social & ROS',
    items: [
      { id: 'family_hx', icon: HeartPulse,  label: 'Family History' },
      { id: 'toxic',     icon: Cigarette,   label: 'Social History' },
      { id: 'ros',       icon: ListChecks,  label: 'Systems Review' },
    ],
  },
  {
    key: 'examination',
    label: 'Examination',
    minRole: 'nurse',
    items: [
      { id: 'examination', icon: Stethoscope, label: 'Examination',      minRole: 'nurse' },
      { id: 'wounds',      icon: Bandage,     label: 'Wound Assessment', minRole: 'nurse' },
    ],
  },
  {
    key: 'workup',
    label: 'Investigations',
    minRole: 'nurse',
    items: [
      { id: 'investigations', icon: FlaskConical, label: 'Bloods / Labs',       minRole: 'nurse' },
      { id: 'blood_gas',     icon: Activity,     label: 'Blood Gas / ABG',    minRole: 'nurse' },
      { id: 'radiology',     icon: ScanLine,     label: 'Imaging',            minRole: 'nurse' },
      { id: 'attachments',   icon: Paperclip,    label: 'Attachments',        minRole: 'nurse' },
    ],
  },
  {
    key: 'assessment',
    label: 'Assessment',
    minRole: 'doctor',
    items: [
      { id: 'assessment',    icon: ClipboardCheck, label: 'Assessment', minRole: 'doctor' },
      { id: 'ai_consultant', icon: BrainCircuit,   label: 'AI Aid',     minRole: 'doctor' },
    ],
  },
  {
    key: 'plan',
    label: 'Plan',
    minRole: 'doctor',
    items: [
      { id: 'plan',                icon: FileEdit,      label: 'Plan',             minRole: 'doctor' },
      { id: 'prescriptions',       icon: FileSignature, label: 'Prescriptions',    minRole: 'doctor' },
      { id: 'dosing',              icon: Calculator,    label: 'Dose Calculator',      minRole: 'nurse' },
      { id: 'fluid_nutrition',     icon: Droplets,      label: 'Fluid & Nutrition',    minRole: 'nurse' },
      { id: 'referring_providers', icon: Contact,       label: 'Referrals',            minRole: 'doctor' },
    ],
  },
  {
    key: 'documents',
    label: 'Documents',
    minRole: 'nurse',
    items: [
      { id: 'periop',            icon: ShieldAlert,    label: 'Perioperative Safety', minRole: 'nurse' },
      { id: 'who_checklist',    icon: ShieldCheck,    label: 'WHO Safety Checklist', minRole: 'nurse' },
      { id: 'consent',          icon: ScrollText,     label: 'Surgical Consent',     minRole: 'doctor' },
      { id: 'letters',          icon: MailOpen,       label: 'Letters',              minRole: 'doctor' },
      { id: 'patient_education', icon: GraduationCap, label: 'Patient Education',    minRole: 'doctor' },
    ],
  },
];

// Phases shown for each encounter type. surgical_consult = full set (default).
const ENCOUNTER_PHASE_VISIBILITY: Record<EncounterType, ReadonlySet<string>> = {
  quick_consult:    new Set(['history', 'examination', 'assessment', 'plan']),
  endoscopy:        new Set(['history', 'examination', 'workup', 'assessment', 'plan', 'documents']),
  surgical_consult: new Set(['history', 'social_ros', 'examination', 'workup', 'assessment', 'plan', 'documents']),
  office_procedure: new Set(['history', 'examination', 'workup', 'assessment', 'plan', 'documents']),
  major_emergency:  new Set(['history', 'social_ros', 'examination', 'workup', 'assessment', 'plan', 'documents']),
};

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
  // ── Front Desk ──
  { id: 'checkin',        icon: UserCheck,       label: 'Check-In',       roles: ['front_desk', 'admin'],                    group: 'Front Desk' },
  { id: 'dashboard',      icon: LayoutDashboard, label: 'Dashboard',      roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Front Desk' },
  { id: 'booking_inbox',  icon: Inbox,           label: 'Booking Inbox',  roles: ['front_desk', 'nurse', 'admin'],           group: 'Front Desk' },
  { id: 'scheduling',     icon: CalendarDays,    label: 'Scheduling',     roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Front Desk' },

  // ── Pre-Visit ──
  { id: 'intake',         icon: ClipboardList,   label: 'Intake',         roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Pre-Visit' },

  // ── Clinical ──
  { id: 'consultation',   icon: Stethoscope,     label: 'Consultation',   roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Clinical' },
  { id: 'procedures',     icon: Scissors,        label: 'Procedures',     roles: ['doctor', 'admin'],                        group: 'Clinical' },
  { id: 'trauma',         icon: Zap,             label: 'Trauma',         roles: ['nurse', 'doctor', 'admin'],               group: 'Clinical' },

  // ── Post-Visit ──
  { id: 'results_inbox',   icon: ClipboardMinus, label: 'Results Inbox',  roles: ['nurse', 'doctor', 'admin'],               group: 'Post-Visit' },
  { id: 'visit_lifecycle', icon: HeartPulse,     label: 'Visits',         roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Post-Visit' },
  { id: 'finaldoc',       icon: FileCheck2,      label: 'Summary',        roles: ['nurse', 'doctor', 'admin'],               group: 'Post-Visit' },
  { id: 'billing',        icon: Receipt,         label: 'Billing',        roles: ['front_desk', 'doctor', 'admin'],          group: 'Post-Visit' },

  // ── Admin ──
  { id: 'patients',       icon: Users,           label: 'Patient Registry', roles: ['front_desk', 'nurse', 'doctor', 'admin'], group: 'Admin' },
  { id: 'analytics',      icon: BarChart2,       label: 'Analytics',      roles: ['doctor', 'admin'],                        group: 'Admin' },
  { id: 'quality',        icon: Activity,        label: 'QI / M&M',       roles: ['doctor', 'admin'],                        group: 'Admin' },
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
  encounterType = 'surgical_consult',
  pendingBookingCount = 0,
  criticalResultCount = 0,
  sectionCompletion = {},
  suggestedBlocks = [],
}: NavSidebarProps) {
  const consultOpen = topSection === 'consultation';
  const billingOpen = topSection === 'billing';

  function handleTop(item: TopItem) {
    onTopSection(item.id);
    if (item.id === 'intake')          { onSection('intake'); }
    if (item.id === 'procedures')      { onSection('procedures'); }
    if (item.id === 'consultation')    { onSection('pmh'); }
    if (item.id === 'billing')         { onSection('billing'); }
  }

  function subActive(id: Section) {
    return topSection === 'consultation' && activeSection === id;
  }
  function billingSubActive(id: Section) {
    return topSection === 'billing' && activeSection === id;
  }

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(userRole));

  const allowedPhases = ENCOUNTER_PHASE_VISIBILITY[encounterType];
  const visiblePhases = CLINICAL_PHASES
    .filter(phase => allowedPhases.has(phase.key))
    .filter(phase => !phase.minRole || hasRole(userRole, phase.minRole))
    .map(phase => {
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

  const activePhaseKey = visiblePhases.find(p => p.hasActive)?.key;

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
                  {item.id === 'results_inbox' && criticalResultCount > 0 && <span className="nsb-dot" />}
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
                {!collapsed && item.id === 'results_inbox' && criticalResultCount > 0 && (
                  <span className="nsb-badge">{criticalResultCount}</span>
                )}
              </button>

              {/* ── Phased consultation sub-nav ── */}
              {showConsultSub && (
                <div className="nsb-sub nsb-phased">
                  {visiblePhases.map((phase, pi) => {
                    const isActivePhase = phase.key === activePhaseKey;
                    const showItems = isActivePhase || !phase.allDone || phase.hasActive;

                    return (
                      <div key={phase.key} className="nsb-phase">
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

                        {showItems && phase.items.map(sub => {
                          const SubIcon = sub.icon;
                          const done = !!sectionCompletion[sub.id];
                          const isCurrent = subActive(sub.id);
                          const isNext = !done && !isCurrent && !!suggestedBlocks?.includes(sub.id);
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
                              {isNext && (
                                <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#0d9488', background: '#f0fdfa', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>Next</span>
                              )}
                            </button>
                          );
                        })}

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

      <button className="nsb-toggle" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed
          ? <PanelLeftOpen size={15} strokeWidth={2} />
          : <><PanelLeftClose size={15} strokeWidth={2} />{!collapsed && <span>Collapse</span>}</>
        }
      </button>
    </nav>
  );
}
