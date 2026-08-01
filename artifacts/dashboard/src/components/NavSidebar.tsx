import {
  LayoutDashboard, Users, ClipboardList, Stethoscope,
  Scissors, CalendarDays, Receipt, BarChart2, Settings,
  PanelLeftClose, PanelLeftOpen, FileText,
  Pill, ShieldAlert, Cigarette, ClipboardCheck, FileEdit,
  FolderOpen, ChevronDown, ChevronRight as ChevronRightIcon, FlaskConical, ListChecks,
  ScanLine, Paperclip, FileCheck2, Activity, BookOpen, Zap, Inbox,
  Contact, HeartPulse, FileSignature, BrainCircuit, CircleCheckBig, Check,
  MessageSquare, Tags, ClipboardMinus, ScrollText, MailOpen, GraduationCap, ShieldCheck,
  Calculator, Droplets, Bandage, UserCheck, ArrowLeftRight, PhoneIncoming,
  CalendarClock, Link2,
} from 'lucide-react';
import type { UserRole } from '@/lib/supabase';
import type { Section, TopSection, EncounterType } from '@/context/AppContext';
import { hasRole } from '@/lib/roles';
import { useState } from 'react';

export type { TopSection };

export type SectionCompletion = Partial<Record<Section, boolean>>;

interface NavSidebarProps {
  collapsed: boolean;
  consultAmbient?: boolean;
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

export interface ClinicalSubItem {
  id: Section;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  label: string;
  minRole?: UserRole;
}

export interface ClinicalPhase {
  key: string;
  label: string;
  minRole?: UserRole;
  items: ClinicalSubItem[];
}

// Consultation sub-nav — Dr Kabiye's standard surgical consultation sequence
export const CLINICAL_PHASES: ClinicalPhase[] = [
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
      { id: 'investigations', icon: FlaskConical, label: 'Bloods / Labs',    minRole: 'nurse' },
      { id: 'blood_gas',      icon: Activity,     label: 'Blood Gas / ABG',  minRole: 'nurse' },
      { id: 'radiology',      icon: ScanLine,     label: 'Imaging',          minRole: 'nurse' },
      { id: 'attachments',    icon: Paperclip,    label: 'Attachments',      minRole: 'nurse' },
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
      { id: 'dosing',              icon: Calculator,    label: 'Dose Calculator',  minRole: 'nurse' },
      { id: 'fluid_nutrition',     icon: Droplets,      label: 'Fluid & Nutrition',minRole: 'nurse' },
      { id: 'referring_providers', icon: Contact,       label: 'Referrals',        minRole: 'doctor' },
    ],
  },
  {
    key: 'documents',
    label: 'Documents',
    minRole: 'nurse',
    items: [
      { id: 'consent',            icon: ScrollText,    label: 'Surgical Consent',     minRole: 'doctor' },
      { id: 'letters',            icon: MailOpen,      label: 'Letters',              minRole: 'doctor' },
      { id: 'patient_education',  icon: GraduationCap, label: 'Patient Education',    minRole: 'doctor' },
    ],
  },
  {
    key: 'operative',
    label: 'Theatre / Endoscopy',
    minRole: 'nurse',
    items: [
      { id: 'who_checklist',      icon: ShieldCheck,   label: 'WHO Safety Checklist', minRole: 'nurse' },
      { id: 'periop',             icon: ShieldAlert,   label: 'Perioperative Safety', minRole: 'nurse' },
    ],
  },
];

const ENCOUNTER_PHASE_VISIBILITY: Record<EncounterType, ReadonlySet<string>> = {
  quick_consult:    new Set(['history', 'examination', 'assessment', 'plan']),
  endoscopy:        new Set(['history', 'examination', 'workup', 'assessment', 'plan', 'documents', 'operative']),
  surgical_consult: new Set(['history', 'social_ros', 'examination', 'workup', 'assessment', 'plan', 'documents']),
  office_procedure: new Set(['history', 'examination', 'workup', 'assessment', 'plan', 'documents', 'operative']),
  major_emergency:  new Set(['history', 'social_ros', 'examination', 'workup', 'assessment', 'plan', 'documents', 'operative']),
};

const BILLING_SUB: { id: Section; icon: React.FC<{ size?: number; strokeWidth?: number }>; label: string }[] = [
  { id: 'billing',   icon: Receipt,    label: 'Billing' },
  { id: 'documents', icon: FolderOpen, label: 'Documents' },
];

interface TopItem {
  id: TopSection;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  label: string;
  roles: readonly UserRole[];
  group: string;
}

// ── Doctor / Nurse navigation — clinical workflow order ───────────────────────
const DR_NAV_ITEMS: TopItem[] = [
  // Clinical
  { id: 'intake',          icon: ClipboardList,   label: 'Intake',          roles: ['nurse', 'admin'], group: 'Clinical' },
  { id: 'consultation',    icon: Stethoscope,     label: 'Consultation',    roles: ['nurse', 'doctor', 'admin'], group: 'Clinical' },
  { id: 'procedures',      icon: Scissors,        label: 'Procedures',      roles: ['doctor', 'admin'],          group: 'Clinical' },
  { id: 'trauma',          icon: Zap,             label: 'Trauma',          roles: ['nurse', 'doctor', 'admin'], group: 'Clinical' },
  // Results & Summary
  { id: 'results_inbox',    icon: ClipboardMinus,  label: 'Results Inbox',    roles: ['nurse', 'doctor', 'admin'], group: 'Results' },
  { id: 'finaldoc',         icon: FileCheck2,      label: 'Summary',          roles: ['nurse', 'doctor', 'admin'], group: 'Results' },
  // Patients — List · Visits · Follow-up combined hub
  { id: 'patients',        icon: Users,           label: 'Patients',        roles: ['nurse', 'doctor', 'admin'], group: 'Patients' },
  // Reference
  { id: 'analytics',       icon: BarChart2,       label: 'Analytics & QI',  roles: ['doctor', 'admin'],          group: 'Reference' },
  { id: 'vademecum',       icon: BookOpen,        label: 'Disease Dict.',   roles: ['nurse', 'doctor', 'admin'], group: 'Reference' },
  { id: 'settings',        icon: Settings,        label: 'Settings',        roles: ['admin'],                    group: 'Reference' },
];

// ── Front Desk / Admin navigation — administrative workflow order ─────────────
const FD_NAV_ITEMS: TopItem[] = [
  // Check-In
  { id: 'checkin',         icon: UserCheck,       label: 'Check-In',         roles: ['front_desk', 'admin'], group: 'Check-In' },
  { id: 'doc_scan',        icon: ScanLine,        label: 'Scan Document',    roles: ['front_desk', 'admin'], group: 'Check-In' },
  { id: 'booking_inbox',    icon: Inbox,           label: 'Booking Inbox',    roles: ['front_desk', 'admin'], group: 'Check-In' },
  { id: 'calls_queue',      icon: PhoneIncoming,   label: 'Call Queue',       roles: ['front_desk', 'admin'], group: 'Check-In' },
  { id: 'followup_tracker', icon: CalendarClock,   label: 'Follow-up Tracker',roles: ['front_desk', 'admin'], group: 'Check-In' },
  { id: 'intake',           icon: ClipboardList,   label: 'Intake',           roles: ['front_desk', 'admin'], group: 'Check-In' },
  // Administrative
  { id: 'scheduling',      icon: CalendarDays,    label: 'Scheduling',       roles: ['front_desk', 'admin'], group: 'Admin' },
  { id: 'patients',        icon: Users,           label: 'Patient Registry', roles: ['front_desk', 'admin'], group: 'Admin' },
  { id: 'billing',         icon: Receipt,         label: 'Billing',          roles: ['front_desk', 'admin'], group: 'Admin' },
  { id: 'dashboard',       icon: LayoutDashboard, label: 'Dashboard',        roles: ['front_desk', 'admin'], group: 'Admin' },
  { id: 'patient_accounts', icon: Link2,           label: 'Portal Accounts',  roles: ['front_desk', 'admin'], group: 'Admin' },
  { id: 'analytics',        icon: BarChart2,       label: 'Analytics',        roles: ['admin'],               group: 'Admin' },
  { id: 'settings',         icon: Settings,        label: 'Settings',         roles: ['admin'],               group: 'Admin' },
];

export default function NavSidebar({
  collapsed, consultAmbient = false, onToggle,
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
  // Admin users can toggle between clinical and admin views
  const [adminView, setAdminView] = useState<'clinical' | 'admin'>('clinical');

  const isFrontDesk = userRole === 'front_desk';
  const isAdmin = userRole === 'admin';

  // Choose nav list based on role / admin view toggle
  const navList = isFrontDesk
    ? FD_NAV_ITEMS
    : isAdmin && adminView === 'admin'
      ? FD_NAV_ITEMS
      : DR_NAV_ITEMS;

  const visibleItems = navList.filter(item => item.roles.includes(userRole));

  const consultOpen = topSection === 'consultation';
  const billingOpen = topSection === 'billing';

  function handleTop(item: TopItem) {
    onTopSection(item.id);
    if (item.id === 'intake')       onSection('intake');
    if (item.id === 'procedures')   onSection('procedures');
    if (item.id === 'consultation') onSection('hpi');
    if (item.id === 'billing')      onSection('billing');
  }

  function subActive(id: Section) {
    return topSection === 'consultation' && activeSection === id;
  }
  function billingSubActive(id: Section) {
    return topSection === 'billing' && activeSection === id;
  }

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

  // ── Summary / document focus mode: 4-icon rail ───────────────────────────
  if (topSection === 'finaldoc' && !consultAmbient) {
    const SUMMARY_RAIL: Array<{ id: TopSection; Icon: React.FC<{ size?: number; strokeWidth?: number }>; label: string }> = [
      { id: 'patients',     Icon: Users,         label: 'Patients'     },
      { id: 'intake',       Icon: ClipboardList, label: 'Intake'       },
      { id: 'consultation', Icon: Stethoscope,   label: 'Consultation' },
      { id: 'finaldoc',     Icon: FileCheck2,    label: 'Summary'      },
    ];
    return (
      <nav className="nav-sidebar nav-sidebar--collapsed" aria-label="Summary navigation" style={{ overflowY: 'hidden' }}>
        <div className="nav-sidebar__body" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SUMMARY_RAIL.map(({ id, Icon, label }) => {
            const isActive = topSection === id;
            return (
              <button
                key={id}
                onClick={() => handleTop(navList.find(n => n.id === id) ?? { id, icon: Icon, label, roles: [], group: '' } as TopItem)}
                title={label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: 44, border: 'none', cursor: 'pointer',
                  position: 'relative', borderRadius: 0,
                  background: isActive ? 'rgba(13,148,136,0.2)' : 'transparent',
                  color: isActive ? '#0d9488' : 'rgba(255,255,255,0.55)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 1.8} />
                {isActive && (
                  <span style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: '0 2px 2px 0', background: '#0d9488' }} />
                )}
              </button>
            );
          })}
        </div>
        <button className="nsb-toggle" onClick={onToggle} title="Expand sidebar">
          <PanelLeftOpen size={14} strokeWidth={2} />
        </button>
      </nav>
    );
  }

  // ── Consultation ambient mode: 4-icon phase rail only ────────────────────
  if (consultAmbient) {
    const AMBIENT_RAIL: Array<{ label: string; Icon: React.FC<{ size?: number; strokeWidth?: number }>; sections: Section[] }> = [
      { label: 'History',    Icon: FileEdit,       sections: ['hpi', 'pmh', 'surgical', 'medications', 'allergies', 'nurse_apcq'] },
      { label: 'Exam',       Icon: Stethoscope,    sections: ['examination', 'wounds'] },
      { label: 'Assessment', Icon: ClipboardCheck, sections: ['assessment', 'ai_consultant'] },
      { label: 'Plan',       Icon: FileCheck2,     sections: ['plan', 'prescriptions'] },
    ];
    return (
      <nav className="nav-sidebar nav-sidebar--collapsed" aria-label="Consultation phases" style={{ overflowY: 'hidden' }}>
        <div className="nav-sidebar__body" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {AMBIENT_RAIL.map(({ label, Icon, sections }) => {
            const isCurrent = sections.includes(activeSection);
            const doneCount = sections.filter(s => !!sectionCompletion[s]).length;
            const allDone = doneCount > 0 && doneCount === sections.filter(s => visiblePhases.flatMap(p => p.items).some(i => i.id === s)).length;
            return (
              <button
                key={label}
                onClick={() => onSection(sections[0])}
                title={label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: 44, border: 'none', cursor: 'pointer',
                  position: 'relative', borderRadius: 0,
                  background: isCurrent ? 'rgba(13,148,136,0.2)' : 'transparent',
                  color: isCurrent ? '#0d9488' : allDone ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon size={17} strokeWidth={isCurrent ? 2.5 : 1.8} />
                {allDone && !isCurrent && (
                  <span style={{ position: 'absolute', top: 8, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#0d9488' }} />
                )}
                {isCurrent && (
                  <span style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: '0 2px 2px 0', background: '#0d9488' }} />
                )}
              </button>
            );
          })}
        </div>
        <button
          className="nsb-toggle"
          onClick={onToggle}
          title="Exit consultation focus"
          style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}
        >
          <PanelLeftOpen size={14} strokeWidth={2} />
        </button>
      </nav>
    );
  }

  return (
    <nav className={`nav-sidebar${collapsed ? ' nav-sidebar--collapsed' : ''}`} aria-label="Navigation">
      <div className="nav-sidebar__body">

        {/* Admin view-mode toggle */}
        {isAdmin && !collapsed && (
          <div style={{
            display: 'flex', gap: 4, padding: '10px 12px 4px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 4,
          }}>
            {(['clinical', 'admin'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setAdminView(mode)}
                style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', cursor: 'pointer',
                  background: adminView === mode ? '#0d9488' : 'rgba(255,255,255,0.07)',
                  color: adminView === mode ? '#fff' : 'rgba(255,255,255,0.45)',
                  transition: 'all 0.15s',
                }}
              >
                {mode === 'clinical' ? '🩺 Dr View' : '🖥️ Admin'}
              </button>
            ))}
          </div>
        )}

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
            <div key={`${item.id}-${item.group}`}>
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

              {/* Phased consultation sub-nav */}
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
