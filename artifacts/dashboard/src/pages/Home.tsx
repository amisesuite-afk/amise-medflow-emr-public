import { useState } from 'react';
import { useAppContext, Section, TopSection, type VitalsState } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import { hasRole, roleIn } from '@/lib/roles';
import NavSidebar from '@/components/NavSidebar';
import ReceptionistView from './ReceptionistView';
import NursePreVisitView from './NursePreVisitView';
import IntakeTab from './tabs/IntakeTab';
import TriageTab from './tabs/TriageTab';
import PmhTab from './tabs/PmhTab';
import SurgicalHistoryTab from './tabs/SurgicalHistoryTab';
import MedicationsTab from './tabs/MedicationsTab';
import AllergiesTab from './tabs/AllergiesTab';
import ToxicHabitsTab from './tabs/ToxicHabitsTab';
import ExaminationTab from './tabs/ExaminationTab';
import InvestigationsTab from './tabs/InvestigationsTab';
import RadiologyTab from './tabs/RadiologyTab';
import AttachmentsTab from './tabs/AttachmentsTab';
import AssessmentTab from './tabs/AssessmentTab';
import PlanTab from './tabs/PlanTab';
import ProceduresTab from './tabs/ProceduresTab';
import BillingTab from './tabs/BillingTab';
import DocumentsTab from './tabs/DocumentsTab';
import PatientSearchTab from './tabs/PatientSearchTab';
import ScalesTab from './tabs/ScalesTab';
import RosTab from './tabs/RosTab';
import SummaryTab from './tabs/SummaryTab';
import FinalDocTab from './tabs/FinalDocTab';
import InpatientTab from './tabs/InpatientTab';
import DashboardTab from './tabs/DashboardTab';
import SchedulingTab from './tabs/SchedulingTab';
import ProgressNotesTab from './tabs/ProgressNotesTab';
import VitalsMonitoringTab from './tabs/VitalsMonitoringTab';
import FloatingActions from '@/components/FloatingActions';

function getAdaptivePath(
  symptoms: string[],
  vitals: VitalsState,
): { topSection: TopSection; section: Section; label: string; hint: string } | null {
  const sbp  = parseFloat(vitals.systolicBp);
  const spo2 = parseFloat(vitals.spo2);
  const hr   = parseFloat(vitals.heartRate);
  const temp = parseFloat(vitals.temperatureC);

  // Red-flag vitals override complaint-based routing
  if (
    (Number.isFinite(sbp)  && sbp  < 90)  ||
    (Number.isFinite(spo2) && spo2 < 92)  ||
    (Number.isFinite(hr)   && hr   > 140) ||
    (Number.isFinite(temp) && temp > 38.5 && Number.isFinite(hr) && hr > 100)
  ) {
    return { topSection: 'consultation', section: 'triage', label: 'Triage', hint: 'Abnormal vital signs — begin with acuity scoring and red-flag assessment.' };
  }

  if (symptoms.some(s => s === 'Pre-operative visit')) {
    return { topSection: 'procedures', section: 'procedures', label: 'Pre-Op', hint: 'Pre-operative workup — verify investigations, consent, and anaesthetic review.' };
  }
  if (symptoms.some(s => s === 'Post-operative review')) {
    return { topSection: 'procedures', section: 'procedures', label: 'Post-Op', hint: 'Post-operative review — assess wound, drain output, and analgesic ladder.' };
  }
  if (symptoms.includes('Breast lump')) {
    return { topSection: 'consultation', section: 'examination', label: 'Breast Exam', hint: 'Breast lump — targeted breast examination: quadrant, size, mobility, lymph nodes.' };
  }
  if (symptoms.includes('Wound concern')) {
    return { topSection: 'consultation', section: 'examination', label: 'Wound Exam', hint: 'Wound concern — assess for dehiscence, infection, or seroma.' };
  }
  if (symptoms.includes('Follow-up')) {
    return { topSection: 'consultation', section: 'assessment', label: 'Assessment', hint: 'Follow-up — review previous plan, update problem list, and adjust management.' };
  }
  if (symptoms.some(s => ['Chest pain', 'Shortness of breath'].includes(s))) {
    return { topSection: 'consultation', section: 'triage', label: 'Triage', hint: 'Cardiorespiratory complaint — acuity first, then ROS and examination.' };
  }
  if (symptoms.some(s => ['Jaundice', 'Abdominal pain', 'Rectal bleeding', 'Nausea / vomiting'].includes(s))) {
    return { topSection: 'consultation', section: 'triage', label: 'Triage', hint: 'GI complaint — start with pain characterisation and triage scoring.' };
  }
  if (symptoms.length > 0) {
    return { topSection: 'consultation', section: 'triage', label: 'Triage', hint: `${symptoms.join(', ')} — begin with history and acuity scoring.` };
  }
  return null;
}

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
    preVisitStatus,
    symptoms,
    vitals,
    encounterMode, setEncounterMode,
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

  if (userRole === 'front_desk') return <ReceptionistView />;
  if (userRole === 'nurse') return <NursePreVisitView />;

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
          {/* Encounter mode pill — outpatient / inpatient */}
          <div className="site-pill" aria-label="Encounter mode">
            {(['outpatient', 'inpatient'] as const).map(mode => (
              <button
                key={mode}
                className={`site-pill__btn${encounterMode === mode ? ' site-pill__btn--active' : ''}`}
                onClick={() => {
                  setEncounterMode(mode);
                  if (mode === 'inpatient') {
                    setCurrentSite('tapion');
                    setTopSection('finaldoc');
                  }
                }}
                title={mode === 'inpatient' ? 'Inpatient ward encounter — Tapion Hospital' : 'Outpatient clinic encounter'}
              >
                {mode === 'outpatient' ? 'Outpatient' : '🏥 Inpatient'}
              </button>
            ))}
          </div>

          {/* Site selector pill — outpatient only (inpatient = Tapion always) */}
          {encounterMode === 'outpatient' && (
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
        userRole={userRole}
        hasUrgentRedFlag={hasUrgentRedFlag}
        urgentCount={urgentCount}
        acuity={triageResult.acuity}
        pmhCount={comorbidities.length}
        encounterMode={encounterMode}
      />

      {/* ── Main content ── */}
      <main className="main-content">
        {/* Pre-visit status banner for doctor/admin */}
        {preVisitStatus === 'registered' && (
          <div style={{ margin: '0 0 12px', padding: '10px 16px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            Patient registered — awaiting nurse vitals
          </div>
        )}
        {preVisitStatus === 'vitals_done' && (() => {
          const path = getAdaptivePath(symptoms, vitals);
          return (
            <div style={{ margin: '0 0 12px', padding: '12px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ color: '#166534', fontWeight: 700, fontSize: 13 }}>
                  Vitals recorded — patient ready for consultation
                </div>
                {path && (
                  <div style={{ color: '#166534', fontSize: 12, marginTop: 2, opacity: 0.85 }}>
                    {path.hint}
                  </div>
                )}
              </div>
              {path && (
                <button
                  type="button"
                  onClick={() => { setTopSection(path.topSection); setActiveSection(path.section); }}
                  style={{
                    padding: '7px 16px', borderRadius: 6, border: 'none',
                    background: '#166534', color: '#fff',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Go to {path.label} →
                </button>
              )}
            </div>
          );
        })()}
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
        {topSection === 'consultation'  && activeSection === 'radiology'     && hasRole(userRole, 'nurse')  && <RadiologyTab />}
        {topSection === 'consultation'  && activeSection === 'attachments'   && hasRole(userRole, 'nurse')  && <AttachmentsTab />}
        {topSection === 'consultation'  && activeSection === 'assessment'     && hasRole(userRole, 'doctor') && <AssessmentTab />}
        {topSection === 'consultation'  && activeSection === 'plan'        && hasRole(userRole, 'doctor') && <PlanTab />}
        {topSection === 'consultation'  && activeSection === 'progress'    && <ProgressNotesTab />}
        {topSection === 'consultation'  && activeSection === 'monitoring'  && <VitalsMonitoringTab />}
        {topSection === 'procedures'    && hasRole(userRole, 'doctor')     && <ProceduresTab />}
        {topSection === 'summary'       && <SummaryTab />}
        {topSection === 'finaldoc'      && encounterMode === 'outpatient' && <FinalDocTab />}
        {topSection === 'finaldoc'      && encounterMode === 'inpatient'  && <InpatientTab />}
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
