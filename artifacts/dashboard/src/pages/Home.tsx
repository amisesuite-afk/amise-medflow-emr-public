import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext, Section, TopSection, type VitalsState } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import { hasRole, roleIn } from '@/lib/roles';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import NavSidebar, { type SectionCompletion } from '@/components/NavSidebar';
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
import TraumaTab from './tabs/TraumaTab';
import DictionaryTab from './tabs/DictionaryTab';
import APCQTab from './tabs/APCQTab';
import NurseAPCQTab from './tabs/NurseAPCQTab';
import QuestionnaireManagerTab from './tabs/QuestionnaireManagerTab';
import BookingInboxTab from './tabs/BookingInboxTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import SettingsTab from './tabs/SettingsTab';
import PortalIntakeTab from './tabs/PortalIntakeTab';
import ReferringProvidersTab from './tabs/ReferringProvidersTab';
import VisitManagerTab from './VisitManager';
import PrescriptionsTab from './tabs/PrescriptionsTab';
import AiConsultantTab from './tabs/AiConsultantTab';
import PatientTasksTab from './tabs/PatientTasksTab';
import ResultsAlertBadge from '@/components/ResultsAlertBadge';
import FloatingActions from '@/components/FloatingActions';
import ErrorBoundary from '@/components/ErrorBoundary';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

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
    patientPhoto,
    patientId,
    encounterId,
    saveStatus,
    lastSaveError,
    freeText,
    surgicalHistory, surgicalNotes,
    medications, medicationsText,
    allergies,
    toxicHabits,
    rosFindings,
    examGeneral, examCardio, examResp, examAbdomen, examNeuro, examExtremities, examBreast, examWound,
    orderedInvestigations,
    radiologyRequests,
    attachments,
    assessment,
    plan,
    progressNotes,
  } = useAppContext();

  const [collapsed, setCollapsed] = useState(false);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);

  const userRole = profile?.role ?? 'front_desk';

  /* ── Consultation tab list (role-aware) ── */
  const consultTabs = useMemo<{ id: Section; label: string }[]>(() => [
    { id: 'triage', label: 'Triage' },
    { id: 'pmh', label: 'PMH' },
    { id: 'surgical', label: 'Surgical' },
    { id: 'medications', label: 'Meds' },
    { id: 'allergies', label: 'Allergies' },
    { id: 'toxic', label: 'Habits' },
    { id: 'scales', label: 'Scales' },
    { id: 'ros', label: 'ROS' },
    ...(hasRole(userRole, 'nurse') ? [
      { id: 'examination' as Section, label: 'Exam' },
      { id: 'investigations' as Section, label: 'Labs' },
      { id: 'radiology' as Section, label: 'Radiology' },
      { id: 'attachments' as Section, label: 'Attach' },
    ] : []),
    ...(hasRole(userRole, 'doctor') ? [
      { id: 'assessment' as Section, label: 'Assess' },
      { id: 'plan' as Section, label: 'Plan' },
      { id: 'prescriptions' as Section, label: 'RX' },
      { id: 'referring_providers' as Section, label: 'Referrals' },
      { id: 'ai_consultant' as Section, label: 'AI Aid' },
    ] : []),
    { id: 'progress', label: 'Notes' },
    { id: 'monitoring', label: 'Monitor' },
    { id: 'tasks', label: 'Tasks' },
  ], [userRole]);

  /* ── Swipe navigation for consultation tabs (iPad / mobile) ── */
  const swipeRef = useSwipeNavigation<HTMLElement>({
    onSwipeLeft: useCallback(() => {
      const idx = consultTabs.findIndex(t => t.id === activeSection);
      if (idx >= 0 && idx < consultTabs.length - 1) {
        setActiveSection(consultTabs[idx + 1].id);
      }
    }, [consultTabs, activeSection, setActiveSection]),
    onSwipeRight: useCallback(() => {
      const idx = consultTabs.findIndex(t => t.id === activeSection);
      if (idx > 0) {
        setActiveSection(consultTabs[idx - 1].id);
      }
    }, [consultTabs, activeSection, setActiveSection]),
    enabled: topSection === 'consultation',
  });

  const fetchPendingBookings = useCallback(async () => {
    if (!hasRole(userRole, 'admin')) return;
    try {
      const r = await fetch(apiUrl('/api/booking/requests?status=pending'), { headers: await staffAuthHeaders() });
      if (r.ok) {
        const d = await r.json() as { requests: unknown[] };
        setPendingBookingCount((d.requests ?? []).length);
      }
    } catch { /* ignore */ }
  }, [userRole]);

  useEffect(() => {
    void fetchPendingBookings();
    const t = setInterval(() => void fetchPendingBookings(), 60_000);
    return () => clearInterval(t);
  }, [fetchPendingBookings]);

  const urgentCount = triageResult.vitalRedFlags.filter(f => f.severity === 'urgent').length
    + triageResult.reasons.length;
  const hasUrgentRedFlag = triageResult.acuity === 'urgent';

  const sectionCompletion = useMemo<SectionCompletion>(() => {
    const hasVitals = Object.values(vitals).some(v => v.trim());
    const hasExam = !!(examGeneral || examCardio || examResp || examAbdomen || examNeuro || examExtremities || examBreast || examWound);
    const hasRos = Object.values(rosFindings).some(f => f.status !== 'not-asked' || f.details.length > 0 || f.notes);
    return {
      triage:              symptoms.length > 0 || !!freeText.trim() || hasVitals,
      pmh:                 comorbidities.length > 0,
      surgical:            surgicalHistory.length > 0 || !!surgicalNotes.trim(),
      medications:         medications.length > 0 || !!medicationsText.trim(),
      allergies:           !!allergies.trim(),
      toxic:               toxicHabits.length > 0,
      ros:                 hasRos,
      examination:         hasExam,
      assessment:          !!assessment.trim(),
      investigations:      orderedInvestigations.length > 0,
      radiology:           radiologyRequests.length > 0,
      attachments:         attachments.length > 0,
      plan:                !!plan.trim(),
      progress:            progressNotes.length > 0,
    };
  }, [symptoms, freeText, vitals, comorbidities, surgicalHistory, surgicalNotes,
      medications, medicationsText, allergies, toxicHabits, rosFindings,
      examGeneral, examCardio, examResp, examAbdomen, examNeuro, examExtremities, examBreast, examWound,
      assessment, orderedInvestigations, radiologyRequests, attachments, plan, progressNotes]);

  const patientLabel = patientName.trim() || 'No patient loaded';
  const metaParts: string[] = [];
  if (age) metaParts.push(`Age ${age}`);
  if (sex && sex !== 'unknown') metaParts.push(sex);

  const sidebarWidth = collapsed ? 52 : 182;

  if (userRole === 'front_desk') return <ErrorBoundary><ReceptionistView /></ErrorBoundary>;
  if (userRole === 'nurse') return <ErrorBoundary><NursePreVisitView /></ErrorBoundary>;

  return (
    <div
      className="app"
      style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}
    >
      {/* ── Sticky header ── */}
      <header className="app-header">
        <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/amise-logo.jpg" alt="" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
          Amise Medical
        </div>
        {DEMO_MODE
          ? <span className="proto-pill" style={{ background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)', color: '#fbbf24' }}>⚗ DEMO MODE — local trial only</span>
          : null
        }
        <div className="header-patient" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {patientPhoto && (
            <img
              src={patientPhoto}
              alt=""
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }}
            />
          )}
          <div>
            <span className="header-name">{patientLabel}</span>
            {metaParts.length > 0 && <span className="header-meta">{metaParts.join(' · ')}</span>}
          </div>
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

          <ResultsAlertBadge patientId={patientId ?? undefined} />

          {/* Encounter status badge — red = open, green = closed/none */}
          {patientId && (
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: encounterId ? '#fef2f2' : '#f0fdf4',
                color: encounterId ? '#dc2626' : '#16a34a',
                border: `1px solid ${encounterId ? '#fca5a5' : '#86efac'}`,
              }}
              title={encounterId ? `Encounter open (${encounterId.slice(0, 8)}…)` : 'No open encounter'}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: encounterId ? '#dc2626' : '#16a34a',
                display: 'inline-block',
              }} />
              {encounterId ? 'Open' : 'Closed'}
            </div>
          )}

          {/* Save status indicator */}
          {saveStatus !== 'idle' && (
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                background: saveStatus === 'error' ? '#fef2f2' : saveStatus === 'saving' ? '#fffbeb' : '#f0fdf4',
                color: saveStatus === 'error' ? '#dc2626' : saveStatus === 'saving' ? '#b45309' : '#16a34a',
                border: `1px solid ${saveStatus === 'error' ? '#fca5a5' : saveStatus === 'saving' ? '#fde68a' : '#86efac'}`,
                transition: 'opacity .3s',
              }}
              title={lastSaveError ?? undefined}
            >
              {saveStatus === 'saving' && '⏳ Saving…'}
              {saveStatus === 'saved' && '✓ Saved'}
              {saveStatus === 'error' && '⚠ Save failed'}
            </div>
          )}

          <div className={`acuity-badge ${acuityClass(triageResult.acuity)}`}>
            <span className="ab-label">Acuity</span>
            <span className="ab-level">{triageResult.acuity.toUpperCase()}</span>
            <span className="ab-score">Score {triageResult.score}</span>
          </div>

          {triageResult.isPrimarilySurgical && (
            <div
              className="surgical-badge"
              title={`Surgical pathway match: ${triageResult.surgicalMatches.map(m => m.label).join(', ')}`}
            >
              <span className="ab-label">Surgical</span>
              <span className="ab-level">{triageResult.surgicalMatches[0].label}</span>
              <span className="ab-score">{triageResult.surgicalMatches[0].category}</span>
            </div>
          )}

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
        pendingBookingCount={pendingBookingCount}
        sectionCompletion={sectionCompletion}
      />

      {/* ── Main content ── */}
      <main ref={swipeRef} className="main-content">
        <ErrorBoundary resetKeys={[topSection, activeSection]}>
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
        {/* Consultation horizontal tab strip — reduces sidebar dependency */}
        {topSection === 'consultation' && (() => {
          const curIdx = consultTabs.findIndex(t => t.id === activeSection);
          const prevTab = curIdx > 0 ? consultTabs[curIdx - 1] : null;
          const nextTab = curIdx >= 0 && curIdx < consultTabs.length - 1 ? consultTabs[curIdx + 1] : null;

          return (
            <>
              <div className="consult-tabstrip">
                {consultTabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`ct-tab${activeSection === tab.id ? ' ct-tab--active' : ''}`}
                    onClick={() => setActiveSection(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 8px', gap: 8 }}>
                {prevTab ? (
                  <button type="button" onClick={() => setActiveSection(prevTab.id)}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151' }}>
                    ← {prevTab.label}
                  </button>
                ) : <span />}
                <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>
                  {curIdx >= 0 ? `${curIdx + 1} / ${consultTabs.length}` : ''}
                </span>
                {nextTab ? (
                  <button type="button" onClick={() => setActiveSection(nextTab.id)}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1F7A8C', color: '#fff' }}>
                    {nextTab.label} →
                  </button>
                ) : <span />}
              </div>
            </>
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
        {topSection === 'consultation'  && activeSection === 'prescriptions' && hasRole(userRole, 'doctor') && <PrescriptionsTab />}
        {topSection === 'consultation'  && activeSection === 'referring_providers' && hasRole(userRole, 'doctor') && <ReferringProvidersTab />}
        {topSection === 'consultation'  && activeSection === 'ai_consultant' && hasRole(userRole, 'doctor') && <AiConsultantTab />}
        {topSection === 'consultation'  && activeSection === 'tasks'       && <PatientTasksTab />}
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
        {topSection === 'analytics'  && hasRole(userRole, 'doctor') && <AnalyticsTab />}
        {topSection === 'settings'   && hasRole(userRole, 'admin')  && <SettingsTab />}
        {topSection === 'trauma'         && hasRole(userRole, 'nurse')  && <TraumaTab />}
        {topSection === 'vademecum'      && hasRole(userRole, 'nurse')  && <DictionaryTab />}
        {topSection === 'questionnaire'  && roleIn(userRole, 'front_desk')   && <QuestionnaireManagerTab />}
        {topSection === 'questionnaire'  && hasRole(userRole, 'nurse')        && <NurseAPCQTab />}
        {topSection === 'booking_inbox'  && hasRole(userRole, 'admin')        && <BookingInboxTab />}
        {topSection === 'portal_intake'                                         && <PortalIntakeTab />}
        {topSection === 'referring_providers'                                   && <ReferringProvidersTab />}
        {topSection === 'visit_lifecycle'                                        && <VisitManagerTab />}
        {topSection === 'prescriptions'     && hasRole(userRole, 'doctor')     && <PrescriptionsTab />}
        {topSection === 'ai_consultant'     && hasRole(userRole, 'doctor')     && <AiConsultantTab />}
        {topSection === 'tasks'                                                && <PatientTasksTab />}
        </ErrorBoundary>
      </main>

      <FloatingActions />
    </div>
  );
}
