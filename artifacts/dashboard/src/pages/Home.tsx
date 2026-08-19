import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAppContext, Section, TopSection, type EncounterType, type VitalsState } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { reopenEncounter } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { hasRole, roleIn } from '@/lib/roles';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import NavSidebar, { type SectionCompletion } from '@/components/NavSidebar';

// ── Lazy-loaded pages and tabs ──────────────────────────────────────────────
// Code-split so only the active panel is downloaded on first render.
const ReceptionistView           = lazy(() => import('./ReceptionistView'));
const NursePreVisitView          = lazy(() => import('./NursePreVisitView'));
const IntakeTab                  = lazy(() => import('./tabs/IntakeTab'));
const TriageTab                  = lazy(() => import('./tabs/TriageTab'));
const HpiTab                     = lazy(() => import('./tabs/HpiTab'));
const PmhTab                     = lazy(() => import('./tabs/PmhTab'));
const FamilyHistoryTab           = lazy(() => import('./tabs/FamilyHistoryTab'));
const SurgicalHistoryTab         = lazy(() => import('./tabs/SurgicalHistoryTab'));
const MedicationsTab             = lazy(() => import('./tabs/MedicationsTab'));
const AllergiesTab               = lazy(() => import('./tabs/AllergiesTab'));
const ToxicHabitsTab             = lazy(() => import('./tabs/ToxicHabitsTab'));
const ExaminationTab             = lazy(() => import('./tabs/ExaminationTab'));
const InvestigationsTab          = lazy(() => import('./tabs/InvestigationsTab'));
const RadiologyTab               = lazy(() => import('./tabs/RadiologyTab'));
const AttachmentsTab             = lazy(() => import('./tabs/AttachmentsTab'));
const AssessmentTab              = lazy(() => import('./tabs/AssessmentTab'));
const PlanTab                    = lazy(() => import('./tabs/PlanTab'));
const ProceduresTab              = lazy(() => import('./tabs/ProceduresTab'));
const BillingTab                 = lazy(() => import('./tabs/BillingTab'));
const DocumentsTab               = lazy(() => import('./tabs/DocumentsTab'));
const PatientSearchTab           = lazy(() => import('./tabs/PatientSearchTab'));
const ScalesTab                  = lazy(() => import('./tabs/ScalesTab'));
const RosTab                     = lazy(() => import('./tabs/RosTab'));
const SummaryTab                 = lazy(() => import('./tabs/SummaryTab'));
const InpatientTab               = lazy(() => import('./tabs/InpatientTab'));
const DashboardTab               = lazy(() => import('./tabs/DashboardTab'));
const SchedulingTab              = lazy(() => import('./tabs/SchedulingTab'));
const ProgressNotesTab           = lazy(() => import('./tabs/ProgressNotesTab'));
const VitalsMonitoringTab        = lazy(() => import('./tabs/VitalsMonitoringTab'));
const TraumaTab                  = lazy(() => import('./tabs/TraumaTab'));
const DictionaryTab              = lazy(() => import('./tabs/DictionaryTab'));
const APCQTab                    = lazy(() => import('./tabs/APCQTab'));
const NurseAPCQTab               = lazy(() => import('./tabs/NurseAPCQTab'));
const QuestionnaireManagerTab    = lazy(() => import('./tabs/QuestionnaireManagerTab'));
const BookingInboxTab            = lazy(() => import('./tabs/BookingInboxTab'));
const CallsQueueTab              = lazy(() => import('./tabs/CallsQueueTab'));
const AnalyticsTab               = lazy(() => import('./tabs/AnalyticsTab'));
const SettingsTab                = lazy(() => import('./tabs/SettingsTab'));
const PortalIntakeTab            = lazy(() => import('./tabs/PortalIntakeTab'));
const ReferringProvidersTab      = lazy(() => import('./tabs/ReferringProvidersTab'));
const SurgicalClassificationsTab = lazy(() => import('./tabs/SurgicalClassificationsTab'));
const VisitManagerTab            = lazy(() => import('./VisitManager'));
const PrescriptionsTab           = lazy(() => import('./tabs/PrescriptionsTab'));
const AiConsultantTab            = lazy(() => import('./tabs/AiConsultantTab'));
const WhoChecklistTab            = lazy(() => import('./tabs/WhoChecklistTab'));
const PerioperativeTab           = lazy(() => import('./tabs/PerioperativeTab'));
const DosingTab                  = lazy(() => import('./tabs/DosingTab'));
const FluidNutritionTab          = lazy(() => import('./tabs/FluidNutritionTab'));
const BloodGasTab                = lazy(() => import('./tabs/BloodGasTab'));
const WoundTab                   = lazy(() => import('./tabs/WoundTab'));
const SurgicalConsentTab         = lazy(() => import('./tabs/SurgicalConsentTab'));
const EncounterTimelineTab       = lazy(() => import('./tabs/EncounterTimelineTab'));
const QualityImprovementTab      = lazy(() => import('./tabs/QualityImprovementTab'));
const ResultsInboxTab            = lazy(() => import('./tabs/ResultsInboxTab'));
const LetterGeneratorTab         = lazy(() => import('./tabs/LetterGeneratorTab'));
const PatientEducationTab        = lazy(() => import('./tabs/PatientEducationTab'));
const PatientTasksTab            = lazy(() => import('./tabs/PatientTasksTab'));
const FollowUpTrackerTab         = lazy(() => import('./tabs/FollowUpTrackerTab'));
const PatientsHubTab             = lazy(() => import('./tabs/PatientsHubTab'));
const InsightsHubTab             = lazy(() => import('./tabs/InsightsHubTab'));
const PathologySphereTab         = lazy(() => import('./tabs/PathologySphereTab'));
const CheckInTab                 = lazy(() => import('./tabs/CheckInTab'));
const PatientAccountsTab         = lazy(() => import('./tabs/PatientAccountsTab'));
const BriefTab                   = lazy(() => import('./tabs/BriefTab'));
import EncounterStartWizard from '@/components/EncounterStartWizard';
import VisitTypeOpeningPanel from '@/components/VisitTypeOpeningPanel';
import FloatingActions from '@/components/FloatingActions';
import ErrorBoundary from '@/components/ErrorBoundary';
import CommandPalette from '@/components/CommandPalette';
import ProblemListStrip from '@/components/ProblemListStrip';
import CriticalResultAlert from '@/components/CriticalResultAlert';
import PreviousVisitStrip from '@/components/PreviousVisitStrip';
import ClinicalWorkflowBar from '@/components/ClinicalWorkflowBar';
import ClinicalPromptsStrip from '@/components/ClinicalPromptsStrip';
import FollowUpQueueStrip from '@/components/FollowUpQueueStrip';
import OpenTasksBanner from '@/components/OpenTasksBanner';
import AppHeader from '@/components/AppHeader';
import PreVisitStatusBanner from '@/components/PreVisitStatusBanner';
import PathwayConfidenceBanner from '@/components/PathwayConfidenceBanner';
import AdmissionEscalationBanner from '@/components/AdmissionEscalationBanner';
import PatientContextBanner from '@/components/PatientContextBanner';
import EncounterPresenceBanner from '@/components/EncounterPresenceBanner';
import SaveConflictBanner from '@/components/SaveConflictBanner';
import NoPatientQuickstart from '@/components/NoPatientQuickstart';
import PatientNotifyModal from '@/components/PatientNotifyModal';
import ConsultationNav from '@/components/ConsultationNav';
import AmbientConsultation from '@/components/AmbientConsultation';
import { getMatrix } from '@/lib/cc-matrices';

const API_ORIGIN = getApiOrigin();

// Tabs shown and their display labels, ordered by clinical priority, per visit type.
// Narrower lists = less noise; renamed labels = more signal.
const VISIT_TYPE_TABS: Record<string, Array<{ id: Section; label: string }>> = {
  new_consult: [
    { id: 'hpi',               label: 'CC / HPI'      },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Surgery'       },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'family_hx',         label: 'Family Hx'    },
    { id: 'toxic',             label: 'Social'        },
    { id: 'ros',               label: 'ROS'           },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'brief',             label: 'Overview'      },
  ],
  // ── Follow-up — SOAP: Subjective → Objective → Assessment → Plan ────────────
  follow_up: [
    { id: 'hpi',               label: 'S — Interval'  },
    { id: 'examination',       label: 'O — Exam'      },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'assessment',        label: 'A — Assess'    },
    { id: 'plan',              label: 'P — Plan'      },
    { id: 'brief',             label: 'Overview'      },
  ],
  // ── Pre-op assessment — fitness for surgery + consent ────────────────────────
  pre_op: [
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Prev Surgery'  },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'ros',               label: 'Systems'       },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'assessment',        label: 'Risk / ASA'    },
    { id: 'plan',              label: 'Consent / Plan'},
  ],
  // ── Post-op review — Follow-up base + wound ───────────────────────────────────
  post_op: [
    { id: 'hpi',               label: 'S — Interval'  },
    { id: 'wounds',            label: 'Wound'         },
    { id: 'examination',       label: 'O — Exam'      },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'assessment',        label: 'A — Assess'    },
    { id: 'plan',              label: 'P — Plan'      },
    { id: 'monitoring',        label: 'Vitals'        },
  ],
  // ── Day of surgery — procedural ────────────────────────────────────────────────
  day_of_surgery: [
    { id: 'who_checklist',     label: 'WHO'           },
    { id: 'periop',            label: 'Periop'        },
    { id: 'procedures',        label: 'Op Note'       },
    { id: 'prescriptions',     label: 'Rx'            },
    { id: 'monitoring',        label: 'Vitals'        },
  ],
  // ── Endoscopy visits — WHO + procedure focus ──────────────────────────────────
  ercp: [
    { id: 'who_checklist',     label: 'WHO'           },
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'procedures',        label: 'ERCP'          },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  endoscopy_ogd: [
    { id: 'who_checklist',     label: 'WHO'           },
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'procedures',        label: 'OGD'           },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  endoscopy_col: [
    { id: 'who_checklist',     label: 'WHO'           },
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'procedures',        label: 'Colonoscopy'   },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  // ── Breast clinic — Initial visit base + breast-specific ────────────────────
  breast: [
    { id: 'hpi',               label: 'CC / Breast Hx'},
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Surgery'       },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'family_hx',         label: 'Family Hx'    },
    { id: 'toxic',             label: 'Social'        },
    { id: 'ros',               label: 'ROS'           },
    { id: 'examination',       label: 'CBE'           },
    { id: 'investigations',    label: 'Imaging'       },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  // ── Telephone — SOAP lite ────────────────────────────────────────────────────
  telephone: [
    { id: 'hpi',               label: 'Presenting'    },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  // ── Diabetic foot — Initial visit base + wound ───────────────────────────────
  diabetic_foot: [
    { id: 'hpi',               label: 'Foot Hx'       },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'medications',       label: 'Meds'          },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'wounds',            label: 'Wound'         },
    { id: 'ros',               label: 'Systems'       },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  // ── Urgent referral — Initial visit base + triage first ─────────────────────
  urgent: [
    { id: 'triage',            label: 'Triage'        },
    { id: 'hpi',               label: 'CC / HPI'      },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Surgery'       },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'ros',               label: 'ROS'           },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
};

// Where to land the cursor the instant the visit type panel completes
const VISIT_TYPE_START: Partial<Record<string, Section>> = {
  new_consult:     'hpi',
  follow_up:       'hpi',
  pre_op:          'hpi',
  post_op:         'hpi',
  day_of_surgery:  'who_checklist',
  ercp:            'who_checklist',
  endoscopy_ogd:   'who_checklist',
  endoscopy_col:   'who_checklist',
  breast:          'hpi',
  telephone:       'hpi',
  diabetic_foot:   'hpi',
  urgent:          'triage',
};
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

/** Shared "visit type required" gate panel — see resolveEncounterContext / the
 * consultation and intake gates in HomePage for why this exists: visit type is
 * a required precondition, not an optional field clinical/intake tabs can skip. */
function VisitTypeRequiredGate({ context }: { context: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: '48px 24px', textAlign: 'center',
      background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12,
    }}>
      <span style={{ fontSize: 28 }}>⚠️</span>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e' }}>Visit type required</div>
      <div style={{ fontSize: 13, color: '#78350f', maxWidth: 420 }}>
        Select a visit type from the header above before {context} — it determines which
        clinical sections and documentation this encounter needs.
      </div>
    </div>
  );
}

export default function HomePage() {
  const { profile, loading: authLoading, signOut } = useAuth();
  const {
    activeSection, setActiveSection,
    topSection, setTopSection,
    patientName,
    comorbidities,
    triageResult,
    currentSite, setCurrentSite,
    symptoms,
    vitals,
    encounterMode, setEncounterMode,
    encounterType, setEncounterType,
    activeCcKey,
    workingDiagnosis,
    visitType: ctxVisitType, setVisitType: ctxSetVisitType,
    setIsPostOp, setPostOpDays,
    patientPhoto,
    patientId,
    encounterId,
    encounterStatus, setEncounterStatus,
    encounterClosedAt, setEncounterClosedAt,
    saveStatus,
    lastSaveError,
    syncStatus,
    freeText,
    surgicalHistory, surgicalNotes,
    medications, medicationsText,
    allergies,
    toxicHabits,
    occupation,
    hpiNotes,
    familyHistory,
    familyHistoryNotes,
    rosFindings,
    examGeneral, examCardio, examResp, examAbdomen, examNeuro, examExtremities, examBreast, examWound,
    orderedInvestigations,
    radiologyRequests,
    attachments,
    assessment,
    plan,
    progressNotes,
    mrNumber, setMrNumber,
    recentEncounters,
  } = useAppContext();

  const [collapsed, setCollapsed] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);
  const [criticalResultCount, setCriticalResultCount] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [headerVisitMode, setHeaderVisitMode] = useState<'new' | 'followup'>('new');
  const [wizardSkipped, setWizardSkipped] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [ambientMode, setAmbientMode] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const prevPatientIdRef = useRef<string | null>(null);

  const [completing, setCompleting] = useState(false);
  const [apiDown, setApiDown] = useState(false);
  // Timestamp until which the banner is suppressed after the user dismisses it.
  // Seeded from sessionStorage so a page refresh within the 5-min window keeps it hidden.
  const apiDownSuppressedUntil = useRef(Number(sessionStorage.getItem('apiDownSuppressed') ?? '0'));

  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    async function check() {
      try {
        // The Vercel rewrite proxies /api/* to the Render server, so this is a
        // same-origin fetch in production — no CORS, no opaque response.
        // We can now inspect resp.ok: a Vercel 502/504 (Render unreachable) or
        // a non-2xx from the server both count as failures.
        const resp = await fetch(`${API_ORIGIN}/api/healthz`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        failures = 0;
        if (!cancelled) {
          setApiDown(false);
          // Reset suppression so a future outage shows the banner fresh.
          apiDownSuppressedUntil.current = 0;
          sessionStorage.removeItem('apiDownSuppressed');
        }
      } catch {
        failures += 1;
        // Require 3 consecutive failures (≥90 s) before showing the banner.
        // Render Standard plan deploys take ~60–90 s, so this avoids false
        // positives during a normal redeploy. Also respect the dismiss suppress window.
        if (!cancelled && failures >= 3 && Date.now() > apiDownSuppressedUntil.current) {
          setApiDown(true);
        }
      }
    }
    check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const completeEncounter = useCallback(async () => {
    if (!encounterId) { setTopSection('finaldoc'); return; }
    setCompleting(true);
    try {
      const authHeaders = await staffAuthHeaders();
      const res = await fetch(`${API_ORIGIN}/api/visit/complete/${encounterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders as Record<string, string> },
        body: JSON.stringify({ description: plan ?? undefined }),
      });
      if (res.ok) {
        setEncounterStatus('closed');
        setEncounterClosedAt(new Date().toISOString());
      }
    } catch { /* non-blocking — navigate regardless */ }
    setCompleting(false);
    setTopSection('finaldoc');
  }, [encounterId, plan, setEncounterStatus, setEncounterClosedAt, setTopSection]);

  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');

  const editEncounter = useCallback(async () => {
    if (!encounterId || encounterStatus !== 'closed') { setTopSection('consultation'); return; }
    setReopening(true);
    setReopenError('');
    const { status, error } = await reopenEncounter(encounterId);
    setReopening(false);
    if (error) { setReopenError(error); return; }
    setEncounterStatus(status);
    setEncounterClosedAt(null);
    setTopSection('consultation');
  }, [encounterId, encounterStatus, setEncounterStatus, setEncounterClosedAt, setTopSection]);

  // Collapse sidebar on narrow viewports (tablets/phones)
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);


  // Go directly to AmbientConsultation on patient load — no blocking gate or wizard
  useEffect(() => {
    if (patientId !== prevPatientIdRef.current) {
      prevPatientIdRef.current = patientId;
      if (patientId) { setWizardSkipped(true); setGuidedMode(false); }
    }
  }, [patientId]);


  const userRole = profile?.role ?? 'front_desk';

  /* ── Sections shown per encounter type — accordion effect ── */
  const ENCOUNTER_TAB_SETS: Record<EncounterType, ReadonlySet<Section>> = useMemo(() => ({
    quick_consult: new Set<Section>([
      'brief', 'triage', 'hpi', 'pmh', 'medications', 'allergies',
      'examination', 'assessment', 'plan', 'prescriptions', 'referring_providers',
      'encounter_history', 'progress', 'monitoring', 'tasks', 'letters',
    ]),
    endoscopy: new Set<Section>([
      'brief', 'triage', 'hpi', 'pmh', 'surgical', 'medications', 'allergies',
      'examination', 'investigations', 'radiology', 'attachments',
      'assessment', 'plan', 'procedures',
      'prescriptions', 'referring_providers',
      'encounter_history', 'progress', 'monitoring', 'tasks', 'letters',
    ]),
    surgical_consult: new Set<Section>([
      'brief', 'triage', 'hpi', 'pmh', 'surgical', 'medications', 'allergies',
      'family_hx', 'toxic', 'ros',
      'examination', 'investigations', 'radiology', 'attachments',
      'assessment', 'plan', 'procedures',
      'prescriptions', 'referring_providers',
      'encounter_history', 'progress', 'monitoring', 'tasks', 'letters',
    ]),
    office_procedure: new Set<Section>([
      'brief', 'triage', 'hpi', 'pmh', 'medications', 'allergies',
      'examination', 'investigations', 'attachments',
      'assessment', 'plan', 'prescriptions',
      'encounter_history', 'progress', 'monitoring', 'tasks', 'letters',
    ]),
    major_emergency: new Set<Section>([
      'brief', 'triage', 'hpi', 'pmh', 'surgical', 'medications', 'allergies',
      'family_hx', 'toxic', 'ros',
      'examination', 'wounds', 'investigations', 'blood_gas', 'radiology', 'attachments',
      'assessment', 'plan', 'prescriptions', 'dosing', 'fluid_nutrition', 'referring_providers',
      'encounter_history', 'progress', 'monitoring', 'tasks', 'letters',
    ]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  /* ── Consultation tab list (role-aware + CC matrix or visit-type / encounter-type filtered) ── */
  const consultTabs = useMemo<{ id: Section; label: string }[]>(() => {
    // Visit-type-specific tabs: narrowed list, visit-aware labels, clinically ordered.
    // For fresh-presentation visit types (new_consult, pre_op, breast, diabetic_foot,
    // urgent), an active CC matrix still takes precedence -- it adds real complaint-
    // specific detail on top of a workup that's appropriate to run in full anyway.
    // For return/procedural visit types, the tight visit-type list always wins even
    // with a CC attached, since the CC there is the *original* diagnosis being
    // followed up or operated on, not something needing a fresh full workup --
    // letting the CC matrix override left every follow-up/post-op/ERCP/OGD/
    // colonoscopy/day-of-surgery/telephone encounter running the full new-complaint
    // flow instead of its own SOAP/procedure-specific tab set, since a CC is
    // realistically always still attached from the original visit.
    const ccMatrixYieldsToVisitType = new Set([
      'follow_up', 'post_op', 'day_of_surgery', 'ercp', 'endoscopy_ogd', 'endoscopy_col', 'telephone',
    ]);
    if (ctxVisitType && (!activeCcKey || ccMatrixYieldsToVisitType.has(ctxVisitType))) {
      const vtTabs = VISIT_TYPE_TABS[ctxVisitType];
      if (vtTabs) {
        const doctorOnly = new Set<Section>(['assessment','plan','procedures','prescriptions','dosing','fluid_nutrition','referring_providers','encounter_history']);
        // examination + wounds are allowed for doctors on visit types that require clinical assessment
        const doctorExamTypes = new Set(['breast','diabetic_foot','follow_up','post_op','urgent']);
        const nurseOnly = new Set<Section>(['investigations','blood_gas','radiology','attachments']);
        return vtTabs.filter(t => {
          if (doctorOnly.has(t.id)) return authLoading || hasRole(userRole, 'doctor');
          if (t.id === 'examination' || t.id === 'wounds') {
            return authLoading || hasRole(userRole, 'nurse') || (hasRole(userRole, 'doctor') && doctorExamTypes.has(ctxVisitType));
          }
          if (nurseOnly.has(t.id)) return authLoading || hasRole(userRole, 'nurse') || hasRole(userRole, 'doctor');
          return true;
        });
      }
    }

    // Default: CC matrix or encounter-type bucket
    const matrix  = activeCcKey ? getMatrix(activeCcKey) : null;
    const allowed = matrix
      ? new Set<Section>(matrix.sections)
      : ENCOUNTER_TAB_SETS[encounterType];
    const all: { id: Section; label: string }[] = [
      { id: 'brief', label: 'Brief' },
      { id: 'triage', label: 'Triage' },
      { id: 'hpi', label: 'HPI' },
      { id: 'pmh', label: 'PMH' },
      { id: 'surgical', label: 'Surgical' },
      { id: 'medications', label: 'Meds' },
      { id: 'allergies', label: 'Allergies' },
      { id: 'family_hx', label: 'Family Hx' },
      { id: 'toxic', label: 'Social' },
      { id: 'ros', label: 'ROS' },
      { id: 'examination' as Section, label: 'Exam' },
      { id: 'wounds' as Section, label: 'Wounds' },
      ...(authLoading || hasRole(userRole, 'doctor') ? [
        { id: 'investigations' as Section, label: 'Labs' },
        { id: 'blood_gas' as Section, label: 'ABG' },
        { id: 'radiology' as Section, label: 'Imaging' },
        { id: 'attachments' as Section, label: 'Reports' },
        { id: 'assessment' as Section, label: 'Assess' },
        { id: 'plan' as Section, label: 'Plan' },
        { id: 'procedures' as Section, label: 'Procedure' },
        { id: 'prescriptions' as Section, label: 'RX' },
        { id: 'dosing' as Section, label: 'Dosing' },
        { id: 'fluid_nutrition' as Section, label: 'Fluids' },
        { id: 'referring_providers' as Section, label: 'Referrals' },
        { id: 'encounter_history' as Section, label: 'History' },
        { id: 'letters' as Section, label: 'Letters' },
      ] : hasRole(userRole, 'nurse') ? [
        { id: 'investigations' as Section, label: 'Labs' },
        { id: 'blood_gas' as Section, label: 'ABG' },
        { id: 'radiology' as Section, label: 'Radiology' },
        { id: 'attachments' as Section, label: 'Attach' },
      ] : []),
      { id: 'progress', label: 'Notes' },
      { id: 'monitoring', label: 'Monitor' },
      { id: 'tasks', label: 'Tasks' },
    ];
    return all.filter(t => allowed.has(t.id));
  }, [authLoading, userRole, encounterType, ctxVisitType, activeCcKey, ENCOUNTER_TAB_SETS]);

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

  useEffect(() => {
    if (!hasRole(userRole, 'nurse')) return;
    async function pollCritical() {
      if (!supabase) return;
      const { count } = await supabase
        .from('investigation_results')
        .select('id', { count: 'exact', head: true })
        .eq('is_critical', true)
        .is('reviewed_by', null);
      setCriticalResultCount(count ?? 0);
    }
    void pollCritical();
    const t = setInterval(() => void pollCritical(), 120_000);
    return () => clearInterval(t);
  }, [userRole]);

  const urgentCount = triageResult.vitalRedFlags.filter(f => f.severity === 'urgent').length
    + triageResult.reasons.length;
  const hasUrgentRedFlag = triageResult.acuity === 'urgent';

  const sectionCompletion = useMemo<SectionCompletion>(() => {
    const hasVitals = Object.values(vitals).some(v => v.trim());
    const hasExam = !!(examGeneral || examCardio || examResp || examAbdomen || examNeuro || examExtremities || examBreast || examWound);
    const hasRos = Object.values(rosFindings).some(f => f.status !== 'not-asked' || f.details.length > 0 || f.notes);
    return {
      triage:              symptoms.length > 0 || !!freeText.trim() || hasVitals,
      hpi:                 !!hpiNotes.trim(),
      pmh:                 comorbidities.length > 0,
      surgical:            surgicalHistory.length > 0 || !!surgicalNotes.trim(),
      medications:         medications.length > 0 || !!medicationsText.trim(),
      allergies:           !!allergies.trim(),
      family_hx:           familyHistory.length > 0 || !!familyHistoryNotes.trim(),
      toxic:               toxicHabits.length > 0 || !!occupation.trim(),
      ros:                 hasRos,
      examination:         hasExam,
      assessment:          !!assessment.trim(),
      investigations:      orderedInvestigations.length > 0,
      radiology:           radiologyRequests.length > 0,
      attachments:         attachments.length > 0,
      plan:                !!plan.trim(),
      progress:            progressNotes.length > 0,
    };
  }, [symptoms, freeText, vitals, hpiNotes, comorbidities, surgicalHistory, surgicalNotes,
      medications, medicationsText, allergies, familyHistory, familyHistoryNotes, toxicHabits, occupation, rosFindings,
      examGeneral, examCardio, examResp, examAbdomen, examNeuro, examExtremities, examBreast, examWound,
      assessment, orderedInvestigations, radiologyRequests, attachments, plan, progressNotes]);

  // Consultation sequence — fixed order, logic surfaces the next incomplete step.
  const suggestedBlocks = useMemo<string[]>(() => {
    if (topSection !== 'consultation') return [];
    const sequence: Section[] = [
      'triage', 'hpi', 'pmh', 'surgical', 'medications', 'allergies',
      'family_hx', 'toxic', 'ros', 'examination', 'investigations', 'radiology',
      'assessment', 'plan',
    ];
    const currentIdx = sequence.indexOf(activeSection as Section);
    const fromCurrent = currentIdx >= 0 ? sequence.slice(currentIdx + 1) : sequence;
    const next = fromCurrent.find(s => !sectionCompletion[s as Section]);
    return next ? [next] : [];
  }, [topSection, activeSection, sectionCompletion]);

  // Exit zen mode when navigating away from consultation
  useEffect(() => {
    if (topSection !== 'consultation') setZenMode(false);
  }, [topSection]);

  // Land on Brief when entering consultation from a non-consultation section
  useEffect(() => {
    if (topSection !== 'consultation') return;
    if (activeSection === 'intake') setActiveSection('brief');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topSection]);

  // When the tab list changes (e.g. auth resolves and role-gated tabs appear/disappear),
  // reset to Brief if the current section is no longer in the list.
  useEffect(() => {
    if (topSection !== 'consultation') return;
    if (consultTabs.some(t => t.id === activeSection)) return;
    setActiveSection(consultTabs[0]?.id ?? 'brief');
  }, [consultTabs, topSection, activeSection, setActiveSection]);

  // Reset main-content scroll to top when switching consultation sections so the
  // incoming section always starts at the top of the viewport, not mid-page.
  useEffect(() => {
    if (topSection !== 'consultation') return;
    if (swipeRef.current) swipeRef.current.scrollTop = 0;
  }, [activeSection, topSection]);

  // Reset to new consultation when patient or CC changes
  useEffect(() => { setHeaderVisitMode('new'); }, [patientId, activeCcKey]);

  // Auto-generate MRN when consultation starts without one (only for a loaded patient)
  useEffect(() => {
    if (topSection !== 'consultation') return;
    if (!patientId) return;
    if (mrNumber) return;
    const year = new Date().getFullYear();
    const suffix = Math.random().toString(36).substring(2, 9).toUpperCase();
    setMrNumber(`AM-${year}-${suffix}`);
  }, [topSection, mrNumber, setMrNumber, patientId]);

  // Activates zen mode when a consultation section is selected
  const handleSectionSelect = useCallback((s: Section) => {
    setActiveSection(s);
    if (topSection === 'consultation') setZenMode(true);
  }, [topSection, setActiveSection]);

  // Ambient consultation = any active consultation with a patient loaded.
  // wizardSkipped / ambientMode no longer gate this — the wizard and visit-type
  // gate are gone; patient loaded + consultation section = ambient mode, always.
  const consultAmbient = topSection === 'consultation' && (!!patientId || !!patientName);

  const sidebarWidth = zenMode ? 0 : windowWidth < 900 ? 52 : consultAmbient ? 52 : (collapsed || topSection === 'consultation') ? 52 : 182;

  if (userRole === 'nurse') return <Suspense fallback={null}><ErrorBoundary><NursePreVisitView /></ErrorBoundary></Suspense>;

  return (
    <div
      className="app"
      style={{
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        gridTemplateRows: apiDown
          ? `${consultAmbient ? '48px' : 'var(--header-h)'} 34px 1fr`
          : `${consultAmbient ? '48px' : 'var(--header-h)'} 1fr`,
        transition: 'grid-template-columns 200ms ease, grid-template-rows 200ms ease',
      }}
    >
      <AppHeader
        completing={completing}
        completeEncounter={completeEncounter}
        showAiPanel={showAiPanel}
        setShowAiPanel={setShowAiPanel}
      />

      {/* ── API-down banner — row 2 when visible, below header so iOS Safari keeps the dark chrome ── */}
      {apiDown && (
        <div style={{
          gridColumn: '1 / -1',
          background: '#92400e', color: '#fef3c7',
          padding: '0 16px', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, zIndex: 30,
        }}>
          <span>⚠ API server unreachable — write actions unavailable. Read-only mode.</span>
          <button onClick={() => { const until = Date.now() + 24 * 60 * 60_000; apiDownSuppressedUntil.current = until; sessionStorage.setItem('apiDownSuppressed', String(until)); setApiDown(false); }} style={{ background: 'none', border: 'none', color: '#fef3c7', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* ── Collapsible sidebar — auto-collapsed (icon-only) during active consultation ── */}
      <NavSidebar
        collapsed={collapsed || zenMode || topSection === 'consultation'}
        consultAmbient={consultAmbient}
        onToggle={() => zenMode ? setZenMode(false) : setCollapsed(c => !c)}
        topSection={topSection}
        onTopSection={s => { setTopSection(s); setZenMode(false); }}
        activeSection={activeSection}
        onSection={handleSectionSelect}
        userRole={userRole}
        authLoading={authLoading}
        hasUrgentRedFlag={hasUrgentRedFlag}
        urgentCount={urgentCount}
        acuity={triageResult.acuity}
        pmhCount={comorbidities.length}
        encounterMode={encounterMode}
        encounterType={encounterType}
        pendingBookingCount={pendingBookingCount}
        criticalResultCount={criticalResultCount}
        sectionCompletion={sectionCompletion}
        suggestedBlocks={suggestedBlocks}
      />

      {/* ── Main content ── */}
      <main id="main-content" ref={swipeRef} className="main-content">
        {/* Zen mode exit chip */}
        {zenMode && (
          <button
            onClick={() => setZenMode(false)}
            title="Show navigation"
            style={{
              // width/alignSelf pinned explicitly: iOS Safari stretches fixed-position
              // flex children to full width without them (renders as a full-width bar).
              position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', left: 16, zIndex: 200,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              width: 'fit-content', maxWidth: 120, alignSelf: 'flex-start',
              padding: '7px 14px', borderRadius: 20,
              background: '#1e293b', color: '#94a3b8',
              border: '1px solid #334155', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#475569'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; }}
          >
            ☰ Nav
          </button>
        )}
        <Suspense fallback={<div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}>
        <ErrorBoundary resetKeys={[topSection, activeSection]}>
        {/* Pre-visit status banner for doctor/admin */}
        <PreVisitStatusBanner />

        {/* Fix 3: Pathway confidence → auto-surface suggested investigations */}
        <PathwayConfidenceBanner />

        {/* Fix 4: Admission escalation prompt */}
        <AdmissionEscalationBanner />

        {/* Patient context banner — sticky at top of consultation (hidden in ambient mode — slim header covers it) */}
        <PatientContextBanner
          guidedMode={guidedMode}
          setGuidedMode={setGuidedMode}
          setNotifyOpen={setNotifyOpen}
          setNotifyStatus={setNotifyStatus}
        />

        {/* Concurrent-editing awareness — who else has this encounter open right now */}
        <EncounterPresenceBanner />

        {/* Concurrent-edit conflict — assessment/plan actually collided with another save */}
        <SaveConflictBanner />

        {/* Critical result alerts — vitals / investigation thresholds */}
        {topSection === 'consultation' && <CriticalResultAlert />}

        {/* Previous visit disclosure — brief of prior encounters (date, type, CC, diagnosis)
            for continuity of care. Self-hides for a genuinely new patient (no history) and
            never modifies the current encounter — reference only. */}
        {topSection === 'consultation' && <PreviousVisitStrip />}

        {/* No-patient quickstart — inline name/age/sex entry */}
        <NoPatientQuickstart />


        {/* Ambient consultation — renders whenever a patient is loaded in consultation */}
        {topSection === 'consultation' && (!!patientId || !!patientName) && (
          <AmbientConsultation
            visitType={ctxVisitType ?? headerVisitMode}
            onDetailedMode={() => { setAmbientMode(false); setGuidedMode(true); }}
            onFinalise={completeEncounter}
            compact={!ambientMode}
          />
        )}



        {/* Consultation navigation — guided (one step at a time) or full tab strip */}
        <ConsultationNav
          consultTabs={consultTabs}
          sectionCompletion={sectionCompletion}
          completeEncounter={completeEncounter}
          completing={completing}
          ambientMode={ambientMode}
          setAmbientMode={setAmbientMode}
          guidedMode={guidedMode}
          setGuidedMode={setGuidedMode}
          headerVisitMode={headerVisitMode}
        />

        {/* Algorithm workflow guide — always visible when CC is active */}
        {topSection === 'consultation' && !ambientMode && !!activeCcKey && <ClinicalWorkflowBar />}

        {/* Visit-type gate — physician fail-safe. Front desk is meant to capture visit
            type during check-in/triage; if that was skipped for any reason, the clinical
            tabs stay locked here rather than silently opening with no visit type set. */}
        {topSection === 'consultation' && !ambientMode && (!!patientId || !!patientName) && !ctxVisitType && (
          <VisitTypeRequiredGate context="continuing" />
        )}

        {/* Intake gate — same requirement as consultation. Previously gated by a
            local vtGateCleared flag that was force-set true on every patient load
            regardless of visit type (see the patientId-change effect above, now
            removed) — meaning intake was never actually gated in practice. */}
        {topSection === 'intake' && (!!patientId || !!patientName) && !ctxVisitType && (
          <VisitTypeRequiredGate context="starting intake" />
        )}

        {/* Clinical sections */}
        {topSection === 'intake'        && !!ctxVisitType && <IntakeTab />}
        {topSection === 'consultation' && !ambientMode && !!ctxVisitType && (<>
        {activeSection === 'brief'        && <BriefTab />}
        {activeSection === 'hpi'         && <HpiTab />}
        {activeSection === 'triage'      && <TriageTab />}
        {activeSection === 'pmh'         && <PmhTab />}
        {activeSection === 'surgical'    && <SurgicalHistoryTab />}
        {activeSection === 'medications' && <MedicationsTab />}
        {activeSection === 'allergies'   && <AllergiesTab />}
        {activeSection === 'family_hx'   && <FamilyHistoryTab />}
        {activeSection === 'toxic'       && <ToxicHabitsTab />}
        {activeSection === 'scales'      && <ScalesTab />}
        {activeSection === 'ros'         && <RosTab />}
        {activeSection === 'examination' &&
          (authLoading || hasRole(userRole, 'nurse') || hasRole(userRole, 'doctor')) &&
          <ExaminationTab />}
        {activeSection === 'classifications' && (authLoading || hasRole(userRole, 'nurse')) && <SurgicalClassificationsTab />}
        {activeSection === 'investigations' &&
          (authLoading || hasRole(userRole, 'nurse') || hasRole(userRole, 'doctor')) && <InvestigationsTab />}
        {activeSection === 'radiology' &&
          (authLoading || hasRole(userRole, 'nurse') || hasRole(userRole, 'doctor')) && <RadiologyTab />}
        {activeSection === 'attachments' &&
          (authLoading || hasRole(userRole, 'nurse') || hasRole(userRole, 'doctor')) && <AttachmentsTab />}
        {activeSection === 'assessment'     && (authLoading || hasRole(userRole, 'doctor')) && <AssessmentTab />}
        {activeSection === 'plan'        && (authLoading || hasRole(userRole, 'doctor')) && <PlanTab />}
        {activeSection === 'procedures' && (authLoading || hasRole(userRole, 'doctor')) && <ProceduresTab />}
        {activeSection === 'progress'    && <ProgressNotesTab />}
        {activeSection === 'monitoring'  && <VitalsMonitoringTab />}
        {activeSection === 'prescriptions' && (authLoading || hasRole(userRole, 'doctor')) && <PrescriptionsTab />}
        {activeSection === 'referring_providers' && (authLoading || hasRole(userRole, 'doctor')) && <ReferringProvidersTab />}
        {activeSection === 'encounter_history'   && (authLoading || hasRole(userRole, 'doctor')) && <EncounterTimelineTab />}
        {activeSection === 'ai_consultant' && (authLoading || hasRole(userRole, 'doctor')) && <AiConsultantTab />}
        {activeSection === 'sphere'        && (authLoading || hasRole(userRole, 'doctor')) && <PathologySphereTab />}
        {activeSection === 'nurse_apcq'      && <NurseAPCQTab />}
        {activeSection === 'apcq'            && <APCQTab compact />}
        {activeSection === 'tasks'          && <PatientTasksTab />}
        {activeSection === 'periop'         && <PerioperativeTab />}
        {activeSection === 'dosing'         && <DosingTab />}
        {activeSection === 'fluid_nutrition' && <FluidNutritionTab />}
        {activeSection === 'blood_gas'       && <BloodGasTab />}
        {activeSection === 'wounds'          && <WoundTab />}
        {activeSection === 'who_checklist'  && <WhoChecklistTab />}
        {activeSection === 'consent'        && <SurgicalConsentTab />}
        {activeSection === 'letters'        && <LetterGeneratorTab />}
        {activeSection === 'patient_education' && <PatientEducationTab />}
        </>)}
        {topSection === 'procedures'    && (authLoading || hasRole(userRole, 'doctor'))        && <ProceduresTab />}
        {(topSection === 'summary' || topSection === 'finaldoc') && (
          encounterStatus === 'closed' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              margin: '8px 14px', padding: '12px 16px', borderRadius: 10,
              background: '#422006', border: '2px solid #b45309',
            }}>
              <span style={{ fontSize: 20 }}>🔒</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>This encounter is CLOSED — read-only</span>
                <span style={{ fontSize: 12, color: '#fcd34d' }}>
                  {encounterClosedAt
                    ? `Closed ${Math.max(0, Math.floor((Date.now() - new Date(encounterClosedAt).getTime()) / 86_400_000))} day(s) ago — reopen within ${Math.max(0, 7 - Math.floor((Date.now() - new Date(encounterClosedAt).getTime()) / 86_400_000))} more day(s) to correct it`
                    : 'Reopen to make corrections'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void editEncounter()}
                disabled={reopening}
                style={{
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 800,
                  cursor: reopening ? 'wait' : 'pointer', border: 'none',
                  background: reopening ? '#78350f' : '#f59e0b', color: '#1c1917',
                  opacity: reopening ? 0.7 : 1,
                }}
              >
                {reopening ? '⏳ Reopening…' : '🔓 Reopen for Editing'}
              </button>
              {reopenError && (
                <div style={{ flexBasis: '100%', fontSize: 12.5, color: '#fca5a5', fontWeight: 700, background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '6px 10px' }}>
                  ⚠ {reopenError}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 2px' }}>
              <button
                type="button"
                onClick={() => void editEncounter()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 16px', borderRadius: 6, fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid #475569',
                  background: '#1e293b', color: '#cbd5e1',
                }}
              >
                ← Edit encounter
              </button>
            </div>
          )
        )}
        {topSection === 'summary'        && <SummaryTab />}
        {topSection === 'finaldoc'       && encounterMode === 'outpatient' && <SummaryTab />}
        {topSection === 'finaldoc'       && encounterMode === 'inpatient'  && <InpatientTab />}
        {topSection === 'billing'       && activeSection === 'billing'   && roleIn(userRole, 'front_desk', 'admin') && <BillingTab />}
        {topSection === 'billing'       && activeSection === 'documents' && roleIn(userRole, 'front_desk', 'admin') && <DocumentsTab />}

        {/* Previously-stub sections */}
        {topSection === 'dashboard'  && <DashboardTab />}
        {topSection === 'patients'   && <PatientsHubTab />}
        {topSection === 'scheduling' && <SchedulingTab />}
        {topSection === 'analytics'   && (authLoading || hasRole(userRole, 'doctor')) && <InsightsHubTab />}
        {topSection === 'quality'       && (authLoading || hasRole(userRole, 'doctor')) && <InsightsHubTab defaultTab="qi" />}
        {topSection === 'results_inbox' && (authLoading || hasRole(userRole, 'nurse'))  && <ResultsInboxTab />}
        {topSection === 'settings'   && (authLoading || hasRole(userRole, 'admin'))  && <SettingsTab />}
        {topSection === 'trauma' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 2px' }}>
            <button
              type="button"
              onClick={() => setTopSection('consultation')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '1px solid #334155',
                background: 'transparent', color: '#94a3b8',
              }}
            >
              ← Back to consultation
            </button>
          </div>
        )}
        {topSection === 'trauma'         && (authLoading || hasRole(userRole, 'nurse'))  && <TraumaTab />}
        {topSection === 'vademecum'      && (authLoading || hasRole(userRole, 'nurse'))  && <DictionaryTab />}
        {topSection === 'questionnaire'  && !authLoading && roleIn(userRole, 'front_desk')   && <QuestionnaireManagerTab />}
        {topSection === 'questionnaire'  && (authLoading || hasRole(userRole, 'nurse') || hasRole(userRole, 'doctor'))  && <NurseAPCQTab />}
        {topSection === 'checkin'                                              && <CheckInTab />}
        {topSection === 'doc_scan'   && roleIn(userRole, 'front_desk', 'admin') && <DocumentsTab />}
        {topSection === 'booking_inbox'  && roleIn(userRole, 'front_desk', 'admin') && <BookingInboxTab />}
        {topSection === 'calls_queue'    && roleIn(userRole, 'front_desk', 'admin') && <CallsQueueTab />}
        {topSection === 'portal_intake'                                         && <PortalIntakeTab />}
        {topSection === 'referring_providers'                                   && <ReferringProvidersTab />}
        {topSection === 'visit_lifecycle'                                        && <PatientsHubTab defaultTab="visits" />}
        {topSection === 'prescriptions'     && (authLoading || hasRole(userRole, 'doctor'))     && <PrescriptionsTab />}
        {topSection === 'ai_consultant'     && (authLoading || hasRole(userRole, 'doctor'))     && <AiConsultantTab />}
        {topSection === 'tasks'                                                && <PatientTasksTab />}
        {topSection === 'followup_tracker' && !authLoading && roleIn(userRole, 'front_desk')     && <FollowUpTrackerTab />}
        {topSection === 'followup_tracker' && (authLoading || !roleIn(userRole, 'front_desk'))   && <PatientsHubTab defaultTab="followup" />}
        {topSection === 'patient_accounts' && roleIn(userRole, 'front_desk', 'admin') && <PatientAccountsTab />}
        </ErrorBoundary>
        </Suspense>
      </main>

      {!consultAmbient && <FloatingActions />}

      {/* AI slide-in panel — triggered from header button */}
      {hasRole(userRole, 'doctor') && showAiPanel && (
        <div style={{
          position: 'fixed', top: 52, right: 0, bottom: 0, width: 420, maxWidth: '100vw',
          zIndex: 850, background: 'var(--bg, #fff)', borderLeft: '1px solid #e2e8f0',
          boxShadow: '-4px 0 24px rgba(0,0,0,.08)', overflowY: 'auto', padding: '16px 12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink, #1e293b)' }}>AI Consultant</span>
            <button type="button" onClick={() => setShowAiPanel(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>✕</button>
          </div>
          <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}>
            <ErrorBoundary>
              <AiConsultantTab />
            </ErrorBoundary>
          </Suspense>
        </div>
      )}

      {/* ── Patient notify modal ─────────────────────────────────────────────── */}
      <PatientNotifyModal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        status={notifyStatus}
        setStatus={setNotifyStatus}
      />

      <CommandPalette
        onSection={handleSectionSelect}
        onTopSection={s => { setTopSection(s); setZenMode(false); }}
        topSection={topSection}
        userRole={userRole}
      />
    </div>
  );
}
