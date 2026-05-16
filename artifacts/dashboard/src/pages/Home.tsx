import { useAppContext, AppMode, Section } from '@/context/AppContext';
import IntakeTab from './tabs/IntakeTab';
import TriageTab from './tabs/TriageTab';
import PmhTab from './tabs/PmhTab';
import SurgicalHistoryTab from './tabs/SurgicalHistoryTab';
import MedicationsTab from './tabs/MedicationsTab';
import AllergiesTab from './tabs/AllergiesTab';
import ToxicHabitsTab from './tabs/ToxicHabitsTab';
import ExaminationTab from './tabs/ExaminationTab';
import AssessmentTab from './tabs/AssessmentTab';
import PlanTab from './tabs/PlanTab';
import ProceduresTab from './tabs/ProceduresTab';
import BillingTab from './tabs/BillingTab';
import DocumentsTab from './tabs/DocumentsTab';

interface NavItem {
  id: Section;
  icon: string;
  label: string;
  group: string;
  doctorOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'intake',      icon: '📋', label: 'Intake',          group: 'clinical' },
  { id: 'triage',      icon: '🔺', label: 'Triage',          group: 'clinical' },
  { id: 'pmh',         icon: '🏥', label: 'PMH',             group: 'clinical' },
  { id: 'surgical',    icon: '✂️',  label: 'Surgical Hx',    group: 'clinical' },
  { id: 'medications', icon: '💊', label: 'Medications',     group: 'clinical' },
  { id: 'allergies',   icon: '⚠️',  label: 'Allergies',      group: 'clinical' },
  { id: 'toxic',       icon: '🚬', label: 'Toxic Habits',    group: 'clinical' },
  { id: 'examination', icon: '🩺', label: 'Examination',     group: 'doctor', doctorOnly: true },
  { id: 'assessment',  icon: '📊', label: 'Assessment',      group: 'doctor', doctorOnly: true },
  { id: 'plan',        icon: '📝', label: 'Plan',            group: 'doctor', doctorOnly: true },
  { id: 'procedures',  icon: '🔬', label: 'Procedures',      group: 'admin' },
  { id: 'billing',     icon: '💰', label: 'Billing',         group: 'admin' },
  { id: 'documents',   icon: '📁', label: 'Documents',       group: 'admin' },
];

const GROUPS = [
  { id: 'clinical', label: 'Clinical' },
  { id: 'doctor',   label: 'Doctor' },
  { id: 'admin',    label: 'Admin' },
];

function acuityClass(a: string) {
  return a === 'urgent' ? 'urgent' : a === 'priority' ? 'priority' : a === 'review' ? 'review' : '';
}

export default function HomePage() {
  const {
    mode, setMode,
    activeSection, setActiveSection,
    patientName, age, sex,
    triageResult,
  } = useAppContext();

  const urgentCount = triageResult.vitalRedFlags.filter(f => f.severity === 'urgent').length
    + triageResult.reasons.length;
  const hasUrgentRedFlag = triageResult.acuity === 'urgent';

  const patientLabel = patientName.trim() || 'No patient loaded';
  const metaParts: string[] = [];
  if (age) metaParts.push(`Age ${age}`);
  if (sex && sex !== 'unknown') metaParts.push(sex);

  return (
    <div className="app">
      {/* ── Sticky header ── */}
      <header className="app-header">
        <div className="header-brand">Amise Medical</div>
        <div className="header-patient">
          <span className="header-name">{patientLabel}</span>
          {metaParts.length > 0 && <span className="header-meta">{metaParts.join(' · ')}</span>}
        </div>
        <div className="header-right">
          <div className="mode-toggle">
            <button
              className={mode === 'front_desk' ? 'active' : ''}
              onClick={() => setMode('front_desk')}
            >Front Desk</button>
            <button
              className={mode === 'doctor' ? 'active' : ''}
              onClick={() => setMode('doctor')}
            >Doctor</button>
          </div>
          <div className={`acuity-badge ${acuityClass(triageResult.acuity)}`}>
            <span className="ab-label">Acuity</span>
            <span className="ab-level">{triageResult.acuity.toUpperCase()}</span>
            <span className="ab-score">Score {triageResult.score}</span>
          </div>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <nav className="sidebar" aria-label="Sections">
        {GROUPS.map(group => {
          const items = NAV_ITEMS.filter(n => n.group === group.id);
          if (group.id === 'doctor' && mode === 'front_desk') return null;
          return (
            <div key={group.id}>
              <div className="sidebar-section">{group.label}</div>
              {items.map(item => {
                const isBadge = item.id === 'triage' && hasUrgentRedFlag;
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(item.id)}
                    aria-current={activeSection === item.id ? 'page' : undefined}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {isBadge && (
                      <span className={`nav-badge ${triageResult.acuity}`}>{urgentCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Main content ── */}
      <main className="main-content">
        {activeSection === 'intake'      && <IntakeTab />}
        {activeSection === 'triage'      && <TriageTab />}
        {activeSection === 'pmh'         && <PmhTab />}
        {activeSection === 'surgical'    && <SurgicalHistoryTab />}
        {activeSection === 'medications' && <MedicationsTab />}
        {activeSection === 'allergies'   && <AllergiesTab />}
        {activeSection === 'toxic'       && <ToxicHabitsTab />}
        {activeSection === 'examination' && mode === 'doctor' && <ExaminationTab />}
        {activeSection === 'assessment'  && mode === 'doctor' && <AssessmentTab />}
        {activeSection === 'plan'        && mode === 'doctor' && <PlanTab />}
        {activeSection === 'procedures'  && <ProceduresTab />}
        {activeSection === 'billing'     && <BillingTab />}
        {activeSection === 'documents'   && <DocumentsTab />}
      </main>
    </div>
  );
}
