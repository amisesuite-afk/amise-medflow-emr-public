import { useState } from 'react';
import { useAppContext, Section, TopSection } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import { hasRole, roleIn } from '@/lib/roles';
import NavSidebar from '@/components/NavSidebar';
import IntakeTab from './tabs/IntakeTab';
import TriageTab from './tabs/TriageTab';
import PmhTab from './tabs/PmhTab';
import SurgicalHistoryTab from './tabs/SurgicalHistoryTab';
import MedicationsTab from './tabs/MedicationsTab';
import AllergiesTab from './tabs/AllergiesTab';
import ToxicHabitsTab from './tabs/ToxicHabitsTab';
import ExaminationTab from './tabs/ExaminationTab';
import InvestigationsTab from './tabs/InvestigationsTab';
import AssessmentTab from './tabs/AssessmentTab';
import PlanTab from './tabs/PlanTab';
import ProceduresTab from './tabs/ProceduresTab';
import BillingTab from './tabs/BillingTab';
import DocumentsTab from './tabs/DocumentsTab';
import PatientSearchTab from './tabs/PatientSearchTab';
import ScalesTab from './tabs/ScalesTab';
import RosTab from './tabs/RosTab';
import SummaryTab from './tabs/SummaryTab';
import DashboardTab from './tabs/DashboardTab';
import SchedulingTab from './tabs/SchedulingTab';
import FloatingActions from '@/components/FloatingActions';

function acuityClass(a: string) {
  return a === 'urgent' ? 'urgent' : a === 'priority' ? 'priority' : a === 'review' ? 'review' : '';
}

function StubPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="stub-panel">
      <div className="stub-panel__icon">🚧</div>
      <div className="stub-panel__title">{title}</div>
      <div className="stub-panel__desc">{description}</div>
    </div>
  );
}

export default function HomePage() {
  const { profile, signOut } = useAuth();
  const {
    activeSection, setActiveSection,
    topSection, setTopSection,
    patientName, age, sex,
    comorbidities,
    triageResult,
    currentSite, setCurrentSite,
  } = useAppContext();

  const [collapsed, setCollapsed] = useState(false);

  const userRole = profile?.role ?? 'front_desk';

  const urgentCount = triageResult.vitalRedFlags.filter(f => f.severity === 'urgent').length
    + triageResult.reasons.length;
  const hasUrgentRedFlag = triageResult.acuity === 'urgent';

  const patientLabel = patientName.trim() || 'No patient loaded';
  const metaParts: string[] = [];
  if (age) metaParts.push(`Age ${age}`);
  if (sex && sex !== 'unknown') metaParts.push(sex);

  const sidebarWidth = collapsed ? 52 : 182;

  return (
    <div
      className="app"
      style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}
    >
      {/* ── Sticky header ── */}
      <header className="app-header">
        <div className="header-brand">Amise Medical</div>
        {DEMO_MODE
          ? <span className="proto-pill" style={{ background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)', color: '#fbbf24' }}>⚗ DEMO MODE — local trial only</span>
          : <span className="proto-pill">⚗ PROTOTYPE</span>
        }
        <div className="header-patient">
          <span className="header-name">{patientLabel}</span>
          {metaParts.length > 0 && <span className="header-meta">{metaParts.join(' · ')}</span>}
        </div>
        <div className="header-right">
          {/* Site selector pill — all roles */}
          <div className="site-pill" aria-label="Active clinic site">
            {SITE_CODES.map(site => (
              <button
                key={site}
                className={`site-pill__btn${currentSite === site ? ' site-pill__btn--active' : ''}`}
                onClick={() => setCurrentSite(site)}
                title={`Switch to ${SITE_LABELS[site]}`}
              >
                {SITE_LABELS[site]}
              </button>
            ))}
          </div>

          <div className={`acuity-badge ${acuityClass(triageResult.acuity)}`}>
            <span className="ab-label">Acuity</span>
            <span className="ab-level">{triageResult.acuity.toUpperCase()}</span>
            <span className="ab-score">Score {triageResult.score}</span>
          </div>

          {/* User chip */}
          {profile && (
            <div className="user-chip">
              <span className="user-chip__name">{profile.full_name ?? profile.email ?? 'User'}</span>
              <span className="user-chip__role">{ROLE_LABELS[profile.role]}</span>
              <button className="user-chip__logout" onClick={() => void signOut()} title="Sign out">↩</button>
            </div>
          )}
        </div>
      </header>

      {/* ── Collapsible sidebar ── */}
      <NavSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        topSection={topSection}
        onTopSection={setTopSection}
        activeSection={activeSection}
        onSection={setActiveSection}
        userRole={userRole}
        hasUrgentRedFlag={hasUrgentRedFlag}
        urgentCount={urgentCount}
        acuity={triageResult.acuity}
        pmhCount={comorbidities.length}
      />

      {/* ── Main content ── */}
      <main className="main-content">
        {/* Clinical sections */}
        {topSection === 'intake'        && <IntakeTab />}
        {topSection === 'consultation'  && activeSection === 'triage'      && <TriageTab />}
        {topSection === 'consultation'  && activeSection === 'pmh'         && <PmhTab />}
        {topSection === 'consultation'  && activeSection === 'surgical'    && <SurgicalHistoryTab />}
        {topSection === 'consultation'  && activeSection === 'medications' && <MedicationsTab />}
        {topSection === 'consultation'  && activeSection === 'allergies'   && <AllergiesTab />}
        {topSection === 'consultation'  && activeSection === 'toxic'       && <ToxicHabitsTab />}
        {topSection === 'consultation'  && activeSection === 'scales'      && <ScalesTab />}
        {topSection === 'consultation'  && activeSection === 'ros'         && <RosTab />}
        {topSection === 'consultation'  && activeSection === 'examination'     && hasRole(userRole, 'nurse')  && <ExaminationTab />}
        {topSection === 'consultation'  && activeSection === 'investigations' && hasRole(userRole, 'nurse')  && <InvestigationsTab />}
        {topSection === 'consultation'  && activeSection === 'assessment'     && hasRole(userRole, 'doctor') && <AssessmentTab />}
        {topSection === 'consultation'  && activeSection === 'plan'        && hasRole(userRole, 'doctor') && <PlanTab />}
        {topSection === 'procedures'    && hasRole(userRole, 'doctor')     && <ProceduresTab />}
        {topSection === 'summary'       && <SummaryTab />}
        {topSection === 'billing'       && activeSection === 'billing'   && roleIn(userRole, 'front_desk', 'admin') && <BillingTab />}
        {topSection === 'billing'       && activeSection === 'documents' && roleIn(userRole, 'front_desk', 'admin') && <DocumentsTab />}

        {/* Previously-stub sections */}
        {topSection === 'dashboard'  && <DashboardTab />}
        {topSection === 'patients'   && <PatientSearchTab />}
        {topSection === 'scheduling' && <SchedulingTab />}
        {topSection === 'analytics'  && hasRole(userRole, 'doctor') && <StubPanel title="Analytics" description="Volume trends, acuity distributions, wait-time reports, and outcome tracking — coming soon." />}
        {topSection === 'settings'   && hasRole(userRole, 'admin')  && <StubPanel title="Settings" description="Practice configuration, user roles, notification preferences, and system settings — coming soon." />}
      </main>

      <FloatingActions />
    </div>
  );
}
