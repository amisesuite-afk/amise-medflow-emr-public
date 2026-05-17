import { useState, useEffect } from 'react';
import { useAppContext, AppMode, Section } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/lib/supabase';
import NavSidebar, { TopSection } from '@/components/NavSidebar';
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
import PatientSearchTab from './tabs/PatientSearchTab';
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
    mode, setMode,
    activeSection, setActiveSection,
    patientName, age, sex,
    triageResult,
  } = useAppContext();

  const [collapsed, setCollapsed]   = useState(false);
  const [topSection, setTopSection] = useState<TopSection>('intake');

  const canUseDocMode = profile?.role === 'doctor' || profile?.role === 'admin';

  // Sync mode to role on login — doctors start in doctor mode
  useEffect(() => {
    if (canUseDocMode) setMode('doctor');
    else setMode('front_desk');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

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
        <span className="proto-pill">⚗ PROTOTYPE</span>
        <div className="header-patient">
          <span className="header-name">{patientLabel}</span>
          {metaParts.length > 0 && <span className="header-meta">{metaParts.join(' · ')}</span>}
        </div>
        <div className="header-right">
          {/* Mode toggle — only for doctor / admin */}
          {canUseDocMode && (
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
          )}
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
        mode={mode}
        hasUrgentRedFlag={hasUrgentRedFlag}
        urgentCount={urgentCount}
        acuity={triageResult.acuity}
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
        {topSection === 'consultation'  && activeSection === 'examination' && mode === 'doctor' && <ExaminationTab />}
        {topSection === 'consultation'  && activeSection === 'assessment'  && mode === 'doctor' && <AssessmentTab />}
        {topSection === 'consultation'  && activeSection === 'plan'        && mode === 'doctor' && <PlanTab />}
        {topSection === 'procedures'    && <ProceduresTab />}
        {topSection === 'billing'       && activeSection === 'billing'     && <BillingTab />}
        {topSection === 'billing'       && activeSection === 'documents'   && <DocumentsTab />}

        {/* Stub sections */}
        {topSection === 'dashboard'  && <StubPanel title="Dashboard" description="Overview of today's schedule, triage queue, and pending actions — coming soon." />}
        {topSection === 'patients'   && <PatientSearchTab />}
        {topSection === 'scheduling' && <StubPanel title="Scheduling" description="Calendar view, appointment booking, and slot management across all sites — coming soon." />}
        {topSection === 'analytics'  && <StubPanel title="Analytics" description="Volume trends, acuity distributions, wait-time reports, and outcome tracking — coming soon." />}
        {topSection === 'settings'   && <StubPanel title="Settings" description="Practice configuration, user roles, notification preferences, and system settings — coming soon." />}
      </main>

      <FloatingActions />
    </div>
  );
}
