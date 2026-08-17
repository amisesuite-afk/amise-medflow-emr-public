import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAppContext, Section, TopSection, type EncounterType, type VitalsState } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { reopenEncounter } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/context/AuthContext';
import { supabase, ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import { hasRole, roleIn } from '@/lib/roles';
import { usePathway } from '@/lib/usePathway';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import NavSidebar, { type SectionCompletion } from '@/components/NavSidebar';
import { VISIT_TYPES, resolveEncounterContext } from '@/lib/visit-types';

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
import ResultsAlertBadge from '@/components/ResultsAlertBadge';
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
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import VoiceDictation from '@/components/VoiceDictation';
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

  const TRAUMA_KEYWORDS = ['Major trauma', 'RTA / MVA', 'Stab / penetrating wound', 'Fall from height', 'Assault', 'Burns'];
  if (symptoms.some(s => TRAUMA_KEYWORDS.includes(s))) {
    return { topSection: 'trauma', section: 'examination', label: 'ATLS Survey', hint: 'Trauma patient — proceed directly to ATLS primary survey (ABCDE).' };
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
    patientName, setPatientName, phone, age, setAge: ctxSetAge, sex, setSex: ctxSetSex,
    setDob: ctxSetDob,
    comorbidities,
    triageResult,
    currentSite, setCurrentSite,
    preVisitStatus,
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
  const [qsName, setQsName] = useState('');
  const [qsAge, setQsAge]   = useState('');
  const [qsSex, setQsSex]   = useState('');
  const [qsDob, setQsDob]   = useState('');
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tsCanLeft, setTsCanLeft]   = useState(false);
  const [tsCanRight, setTsCanRight] = useState(true);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);
  const [criticalResultCount, setCriticalResultCount] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showAcuityBreakdown, setShowAcuityBreakdown] = useState(false);
  const [admissionDismissed, setAdmissionDismissed] = useState(false);
  const [headerVisitMode, setHeaderVisitMode] = useState<'new' | 'followup'>('new');
  const [wizardSkipped, setWizardSkipped] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [ambientMode, setAmbientMode] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTemplate, setNotifyTemplate] = useState<'appointment_reminder' | 'result_ready' | 'postop_checkin' | 'general'>('result_ready');
  const [notifyData, setNotifyData] = useState({ day: '', date: '', time: '', location: 'Rodney Bay', message: '' });
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const prevPatientIdRef = useRef<string | null>(null);
  const acuityRef = useRef<HTMLDivElement>(null);

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

  // Close acuity breakdown on outside click
  useEffect(() => {
    if (!showAcuityBreakdown) return;
    function handle(e: MouseEvent) {
      if (acuityRef.current && !acuityRef.current.contains(e.target as Node)) {
        setShowAcuityBreakdown(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showAcuityBreakdown]);


  // Go directly to AmbientConsultation on patient load — no blocking gate or wizard
  useEffect(() => {
    if (patientId !== prevPatientIdRef.current) {
      prevPatientIdRef.current = patientId;
      if (patientId) { setWizardSkipped(true); setGuidedMode(false); }
    }
  }, [patientId]);


  const userRole = profile?.role ?? 'front_desk';
  const { activePathway, matchedPathways } = usePathway();
  const topMatchScore = matchedPathways[0]?.score ?? 0;
  const highConfidence = topMatchScore >= 15 && activePathway !== null;

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

  /* ── Section icon map for tab chips + encounter progress rail ── */
  const SECTION_ICONS: Partial<Record<Section, string>> = {
    brief: '📄', triage: '⚡', hpi: '💬', pmh: '📋', surgical: '🔪',
    medications: '💊', allergies: '⚠️', family_hx: '🧬', toxic: '🚬',
    ros: '🔍', examination: '🩺', wounds: '🩹',
    investigations: '🧪', blood_gas: '💨', radiology: '🩻', attachments: '📎',
    assessment: '🎯', plan: '📌', procedures: '🔬',
    who_checklist: '✅', periop: '🏥', consent: '✍️',
    prescriptions: '💊', dosing: '💉', fluid_nutrition: '💧',
    referring_providers: '↗️', encounter_history: '📅',
    progress: '📝', monitoring: '📊', tasks: '✓',
  };

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

  // Scroll the active tab chip into view when the section changes.
  // scrollIntoView() is unreliable for overflow-x containers on iOS Safari,
  // so we manipulate scrollLeft on the strip element directly.
  useEffect(() => {
    if (topSection !== 'consultation') return;
    const strip = tabStripRef.current;
    if (!strip) return;
    const el = strip.querySelector<HTMLElement>(`#tab-${activeSection}`);
    if (!el) return;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    // Centre the active tab in the visible strip window.
    const targetLeft = elLeft - (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollLeft = Math.max(0, Math.min(targetLeft, strip.scrollWidth - strip.clientWidth));
    // Update arrow visibility immediately after the scroll.
    setTsCanLeft(strip.scrollLeft > 1);
    setTsCanRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1);
    void elLeft; void elRight; // used above for centre calc
  }, [activeSection, topSection]);

  // Reset main-content scroll to top when switching consultation sections so the
  // incoming section always starts at the top of the viewport, not mid-page.
  useEffect(() => {
    if (topSection !== 'consultation') return;
    if (swipeRef.current) swipeRef.current.scrollTop = 0;
  }, [activeSection, topSection]);

  // Keep arrow visibility in sync with manual strip scrolling.
  useEffect(() => {
    const strip = tabStripRef.current;
    if (!strip) return;
    function sync() {
      if (!strip) return;
      setTsCanLeft(strip.scrollLeft > 1);
      setTsCanRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1);
    }
    sync();
    strip.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(strip);
    return () => { strip.removeEventListener('scroll', sync); ro.disconnect(); };
  }, [consultTabs]);

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

  async function sendPatientNotification() {
    if (!patientId || notifyBusy) return;
    setNotifyBusy(true);
    setNotifyStatus(null);
    try {
      const headers = await staffAuthHeaders();
      const body: Record<string, unknown> = { template: notifyTemplate };
      if (notifyTemplate === 'appointment_reminder') {
        body.data = { day: notifyData.day, date: notifyData.date, time: notifyData.time, location: notifyData.location };
      } else if (notifyTemplate === 'general') {
        body.data = { message: notifyData.message };
      }
      const res = await fetch(`${API_ORIGIN}/api/notify/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { action?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const label = json.action === 'skipped' ? 'Message queued (dry-run mode)' : 'Message sent';
      setNotifyStatus({ ok: true, msg: label });
      setTimeout(() => { setNotifyOpen(false); setNotifyStatus(null); }, 1800);
    } catch (e) {
      setNotifyStatus({ ok: false, msg: e instanceof Error ? e.message : 'Send failed' });
    } finally {
      setNotifyBusy(false);
    }
  }

  const patientLabel = patientName.trim() || 'No patient loaded';
  const metaParts: string[] = [];
  if (age) metaParts.push(`Age ${age}`);
  if (sex && sex !== 'unknown') metaParts.push(sex);

  // Ambient consultation = any active consultation with a patient loaded.
  // wizardSkipped / ambientMode no longer gate this — the wizard and visit-type
  // gate are gone; patient loaded + consultation section = ambient mode, always.
  const consultAmbient = topSection === 'consultation' && (!!patientId || !!patientName);
  const allergyList = allergies.split(',').map((a: string) => a.trim()).filter(Boolean);
  const ccLabel = activeCcKey ? (getMatrix(activeCcKey)?.name ?? null)
    : (symptoms.length > 0 ? symptoms.slice(0, 2).join(', ') : null);

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
      {/* ── Sticky header ── */}
      <header className="app-header" style={consultAmbient ? { padding: '0 12px', gap: 10 } : {}}>

        {/* ── Ambient consultation: slim identity strip ── */}
        {consultAmbient && (
          <>
            {/* Patient name */}
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
              {patientName.trim() || 'Patient'}
            </span>
            {/* MRN */}
            {mrNumber && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', background: 'rgba(13,148,136,0.15)', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {mrNumber}
              </span>
            )}
            {/* Age / sex */}
            {(age || (sex && sex !== 'unknown')) && (
              <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {[age && `${age}y`, sex && sex !== 'unknown' && sex].filter(Boolean).join(' ')}
              </span>
            )}
            {/* Allergy alert */}
            {allergyList.length > 0 ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', background: '#422006', border: '1px solid #78350f', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                ⚠ {allergyList[0]}{allergyList.length > 1 ? ` +${allergyList.length - 1}` : ''}
              </span>
            ) : patientName ? (
              <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>NKDA</span>
            ) : null}
            {/* Visit type — inline select in consultation header */}
            {(() => {
              const vt = VISIT_TYPES.find(v => v.id === ctxVisitType);
              return (
                <select
                  value={ctxVisitType ?? ''}
                  onChange={e => {
                    const id = e.target.value;
                    if (!id) return;
                    ctxSetVisitType(id);
                    setIsPostOp(id === 'post_op');
                    setPostOpDays('');
                    const { encounterType: nextEncounterType, topSection: nextTopSection } = resolveEncounterContext(id);
                    if (nextEncounterType) setEncounterType(nextEncounterType);
                    setTopSection(nextTopSection);
                  }}
                  aria-label="Visit type"
                  style={{
                    fontSize: 10, fontWeight: 700,
                    color: vt?.color ?? '#fff',
                    backgroundColor: vt ? `${vt.color}22` : 'rgba(255,255,255,0.12)',
                    border: `1.5px solid ${vt ? `${vt.color}44` : 'rgba(255,255,255,0.25)'}`,
                    borderRadius: 6, padding: '2px 22px 2px 7px', cursor: 'pointer',
                    appearance: 'none', flexShrink: 0,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23fff'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
                  }}
                >
                  <option value="" style={{ color: '#374151', background: '#fff' }}>— Visit type —</option>
                  {VISIT_TYPES.map(v => (
                    <option key={v.id} value={v.id} style={{ color: '#374151', background: '#fff' }}>
                      {v.icon} {v.label}
                    </option>
                  ))}
                </select>
              );
            })()}
            {/* CC label */}
            {ccLabel && (
              <span style={{ fontSize: 10, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ccLabel}
              </span>
            )}
            {/* Working diagnosis — persistent across every consultation tab, not just
                Assessment/Plan, so it isn't lost while navigating Prescriptions, CPT,
                Consent, etc. Click jumps back to Assessment to review/change it. */}
            {workingDiagnosis && (
              <button
                type="button"
                onClick={() => setActiveSection('assessment')}
                title={`${workingDiagnosis.locked ? 'Confirmed' : 'Provisional'} working diagnosis — click to review in Assessment`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  color: workingDiagnosis.locked ? '#5eead4' : '#94a3b8',
                  background: workingDiagnosis.locked ? 'rgba(13,148,136,0.18)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${workingDiagnosis.locked ? 'rgba(13,148,136,0.45)' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 210,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {workingDiagnosis.locked ? '🎯' : '~'} {workingDiagnosis.diseaseLabel || workingDiagnosis.icdCode || 'Working diagnosis'}
              </button>
            )}
            <span style={{ flex: 1 }} />
            {/* Sync status indicator */}
            <SyncStatusIndicator saveStatus={saveStatus} />
            {/* Encounter status + close */}
            {encounterId ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Mark this encounter as complete and close it?')) {
                    completeEncounter();
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(220,38,38,0.4)', background: completing ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.1)', color: '#fca5a5', fontSize: 10, fontWeight: 700, cursor: completing ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                title="Close this encounter"
                disabled={completing}
              >{completing ? '⏳ Closing…' : '● In progress — Close'}</button>
            ) : null}
            {/* AI Consultant */}
            {hasRole(userRole, 'doctor') && (
              <button
                type="button"
                onClick={() => setShowAiPanel(p => !p)}
                style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: showAiPanel ? '#312e81' : 'rgba(13,148,136,0.2)', color: '#0d9488', fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                title="AI Consultant"
              >🧠</button>
            )}
          </>
        )}

        {!consultAmbient && <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/amise-logo.jpg" alt="" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
          Amise Medical
        </div>}
        {!consultAmbient && DEMO_MODE
          ? <span className="proto-pill" style={{ background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)', color: '#fbbf24' }}>⚗ DEMO MODE — local trial only</span>
          : null
        }
        {!consultAmbient && topSection !== 'finaldoc' && (
        <div className="header-patient" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {patientPhoto && topSection !== 'consultation' && (
            <img
              src={patientPhoto}
              alt=""
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }}
            />
          )}
          <div>
            <span className="header-name">{patientLabel}</span>
            {(mrNumber || metaParts.length > 0) && (
              <span className="header-meta">
                {[mrNumber || null, ...metaParts].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        </div>
        )}
        {!consultAmbient && (
        <div className="header-right">
          {/* Encounter mode pill — hidden in consultation and finaldoc */}
          {topSection !== 'consultation' && topSection !== 'finaldoc' && (
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
          )}

          {/* Site picker — outpatient only; inpatient is always Tapion; hidden in finaldoc */}
          {topSection !== 'consultation' && topSection !== 'finaldoc' && encounterMode === 'outpatient' && (
          <div className="site-pill" aria-label="Clinic site">
            {SITE_CODES.map(code => (
              <button
                key={code}
                className={`site-pill__btn${currentSite === code ? ' site-pill__btn--active' : ''}`}
                onClick={() => setCurrentSite(code)}
                title={SITE_LABELS[code]}
              >
                {SITE_LABELS[code]}
              </button>
            ))}
          </div>
          )}


          {topSection !== 'finaldoc' && topSection !== 'consultation' && <ResultsAlertBadge patientId={patientId ?? undefined} />}

          {/* Encounter status badge — hidden on summary and consultation pages */}
          {patientId && topSection !== 'finaldoc' && topSection !== 'consultation' && (
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

          {/* Visit type dropdown — header; hidden in finaldoc */}
          {topSection !== 'finaldoc' && <div style={{ position: 'relative' }}>
            <select
              value={ctxVisitType ?? ''}
              onChange={e => {
                const id = e.target.value;
                if (!id) return;
                ctxSetVisitType(id);
                setIsPostOp(id === 'post_op');
                setPostOpDays('');
                const { encounterType: nextEncounterType, topSection: nextTopSection } = resolveEncounterContext(id);
                if (nextEncounterType) setEncounterType(nextEncounterType);
                setTopSection(nextTopSection);
              }}
              aria-label="Visit type"
              style={{
                padding: '4px 26px 4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)',
                color: '#fff', cursor: 'pointer', appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23fff'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
              }}
            >
              <option value="" style={{ color: '#374151', background: '#fff' }}>— Visit type —</option>
              {VISIT_TYPES.map(vt => (
                <option key={vt.id} value={vt.id} style={{ color: '#374151', background: '#fff' }}>
                  {vt.icon} {vt.label}
                </option>
              ))}
            </select>
          </div>}

          {/* Acuity badge — hidden on summary and consultation */}
          {topSection !== 'finaldoc' && topSection !== 'consultation' && <div ref={acuityRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className={`acuity-badge ${acuityClass(triageResult.acuity)}`}
              onClick={() => setShowAcuityBreakdown(p => !p)}
              title="Click to see score breakdown"
              style={{ cursor: 'pointer', border: 'none', padding: 0, background: 'transparent' }}
            >
              <span className="ab-label">Acuity</span>
              <span className="ab-level">{triageResult.acuity.toUpperCase()}</span>
              <span className="ab-score">Score {triageResult.score}</span>
            </button>
            {showAcuityBreakdown && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 999,
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.14)', minWidth: 280, maxWidth: 360,
                  padding: '12px 0',
                }}
              >
                <div style={{ padding: '0 14px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>Score breakdown</span>
                  <button type="button" onClick={() => setShowAcuityBreakdown(false)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {triageResult.reasons.length === 0 ? (
                    <div style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>No active score factors.</div>
                  ) : (
                    triageResult.reasons.map((r, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '7px 14px', borderBottom: '1px solid #f8fafc', fontSize: 12, color: '#374151',
                      }}>
                        <span style={{ color: '#0d9488', fontWeight: 700, flexShrink: 0 }}>▸</span>
                        <span>{r}</span>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ padding: '8px 14px 0', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                  <span>Total score</span>
                  <span style={{ fontWeight: 800, color: '#1e293b' }}>{triageResult.score}</span>
                </div>
              </div>
            )}
          </div>}

          {triageResult.isPrimarilySurgical && topSection !== 'finaldoc' && topSection !== 'consultation' && (
            <div
              className="surgical-badge"
              title={`Surgical pathway match: ${triageResult.surgicalMatches.map(m => m.label).join(', ')}`}
            >
              <span className="ab-label">Surgical</span>
              <span className="ab-level">{triageResult.surgicalMatches[0].label}</span>
              <span className="ab-score">{triageResult.surgicalMatches[0].category}</span>
            </div>
          )}

          {/* AI Registrar button — header, doctor-only; hidden on summary and consultation */}
          {hasRole(userRole, 'doctor') && topSection !== 'finaldoc' && topSection !== 'consultation' && (
            <button
              type="button"
              onClick={() => setShowAiPanel(p => !p)}
              aria-label="AI Consultant"
              title="AI Consultant co-pilot"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: showAiPanel ? '#312e81' : '#1F7A8C', color: '#fff',
                fontSize: 13, fontWeight: 700, transition: 'background .2s',
              }}
            >
              🧠 <span style={{ fontSize: 11 }}>AI</span>
            </button>
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
        )}
      </header>

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

        {/* Fix 3: Pathway confidence → auto-surface suggested investigations */}
        {highConfidence && activePathway!.suggestedInvestigations.length > 0 && topSection === 'consultation' && (
          <div style={{ margin: '0 0 12px', padding: '12px 16px', borderRadius: 8, background: '#eef2ff', border: '1px solid #c7d2fe', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>⚑</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ color: '#312e81', fontWeight: 700, fontSize: 13 }}>
                Pathway match: {activePathway!.name}
              </div>
              <div style={{ color: '#3730a3', fontSize: 12, marginTop: 2 }}>
                Suggested: {activePathway!.suggestedInvestigations.slice(0, 6).join(', ')}
                {activePathway!.suggestedInvestigations.length > 6 ? ` (+${activePathway!.suggestedInvestigations.length - 6} more)` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('investigations')}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#312e81', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Go to Labs →
            </button>
          </div>
        )}

        {/* Fix 4: Admission escalation prompt */}
        {!admissionDismissed && encounterMode === 'outpatient' && triageResult.acuity === 'urgent' && highConfidence && (
          <div style={{ margin: '0 0 12px', padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>🏥</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ color: '#991b1b', fontWeight: 700, fontSize: 13 }}>
                Admission criteria may be met
              </div>
              <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 2 }}>
                Urgent acuity + {activePathway!.name} — consider switching to inpatient encounter.
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setEncounterMode('inpatient'); setAdmissionDismissed(true); }}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#991b1b', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Switch to Inpatient
            </button>
            <button
              type="button"
              onClick={() => setAdmissionDismissed(true)}
              style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#991b1b', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Patient context banner — sticky at top of consultation (hidden in ambient mode — slim header covers it) */}
        {topSection === 'consultation' && !consultAmbient && (() => {
          const allergyList = allergies.split(',').map(a => a.trim()).filter(Boolean);
          const acuityColors: Record<string, { bg: string; text: string }> = {
            urgent:   { bg: '#7f1d1d', text: '#fca5a5' },
            priority: { bg: '#431407', text: '#fb923c' },
            review:   { bg: '#422006', text: '#fbbf24' },
            routine:  { bg: '#052e16', text: '#86efac' },
          };
          const ac = acuityColors[triageResult.acuity] ?? { bg: '#1e293b', text: '#94a3b8' };
          return (
            <div style={{
              position: 'sticky', top: 0, zIndex: 50, marginBottom: 8,
              background: '#0f172a', borderBottom: '1px solid #1e293b',
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 14px', height: 36, flexWrap: 'nowrap', overflow: 'hidden',
            }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {patientName.trim() || '—'}
              </span>
              {mrNumber && (
                <span style={{ fontSize: 10, color: '#0d9488', background: '#0d948818', borderRadius: 4, padding: '1px 6px', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {mrNumber}
                </span>
              )}
              {(age || (sex && sex !== 'unknown')) && (
                <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {[age && `${age}y`, sex !== 'unknown' && sex].filter(Boolean).join(' · ')}
                </span>
              )}
              {allergyList.length > 0 && (
                <span style={{ fontSize: 11, color: '#fbbf24', background: '#422006', border: '1px solid #78350f', borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ⚠ {allergyList.slice(0, 2).join(', ')}{allergyList.length > 2 ? ` +${allergyList.length - 2}` : ''}
                </span>
              )}
              {allergyList.length === 0 && (
                <span style={{ fontSize: 11, color: '#334155', whiteSpace: 'nowrap', flexShrink: 0 }}>NKDA</span>
              )}
              {/* Visit type badge — persistent context during encounter */}
              {ctxVisitType && (() => {
                const vt = VISIT_TYPES.find(v => v.id === ctxVisitType);
                return vt ? (
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    color: vt.color, background: `${vt.color}22`,
                    border: `1px solid ${vt.color}55`,
                    borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {vt.icon} {vt.label}
                  </span>
                ) : null;
              })()}

              {/* Notify patient button */}
              {patientId && phone && (
                <button
                  type="button"
                  onClick={() => { setNotifyOpen(true); setNotifyStatus(null); }}
                  title="Send patient notification (SMS/WhatsApp)"
                  style={{
                    marginLeft: 'auto', padding: '2px 10px', borderRadius: 5, border: 'none',
                    cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    flexShrink: 0, whiteSpace: 'nowrap',
                    background: '#0f3460', color: '#93c5fd',
                    transition: 'all 0.15s',
                  }}
                >
                  ✉ Notify
                </button>
              )}

              {/* Guided mode toggle */}
              <button
                type="button"
                onClick={() => setGuidedMode(g => !g)}
                title={guidedMode ? 'Exit guided mode — show all sections' : 'Enter guided mode — one step at a time'}
                style={{
                  marginLeft: patientId && phone ? undefined : 'auto',
                  padding: '2px 10px', borderRadius: 5, border: 'none',
                  cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                  flexShrink: 0, whiteSpace: 'nowrap',
                  background: guidedMode ? '#0d9488' : '#1e293b',
                  color: guidedMode ? '#fff' : '#475569',
                  transition: 'all 0.15s',
                }}
              >
                {guidedMode ? '✦ GUIDED' : '✦ GUIDE'}
              </button>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: ac.text, background: ac.bg, borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {triageResult.acuity}
              </span>
            </div>
          );
        })()}

        {/* Critical result alerts — vitals / investigation thresholds */}
        {topSection === 'consultation' && <CriticalResultAlert />}

        {/* Previous visit disclosure — brief of prior encounters (date, type, CC, diagnosis)
            for continuity of care. Self-hides for a genuinely new patient (no history) and
            never modifies the current encounter — reference only. */}
        {topSection === 'consultation' && <PreviousVisitStrip />}

        {/* No-patient quickstart — inline name/age/sex entry */}
        {topSection === 'consultation' && !patientId && !patientName && (
          <div style={{ background: '#fef9c3', border: '1.5px solid #fbbf24', borderRadius: 10, padding: '14px 18px', color: '#92400e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>👤</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>No patient loaded — enter details to begin</span>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!qsName.trim()) return;
                setPatientName(qsName.trim());
                const resolvedAge = qsAge || (qsDob
                  ? String(Math.floor((Date.now() - new Date(qsDob).getTime()) / (365.25 * 24 * 3600 * 1000)))
                  : '');
                if (resolvedAge) ctxSetAge(resolvedAge);
                if (qsDob) ctxSetDob(qsDob);
                if (qsSex && qsSex !== 'unknown') ctxSetSex(qsSex as 'male' | 'female' | 'other' | 'unknown');
                setQsName(''); setQsAge(''); setQsSex(''); setQsDob('');
              }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '2 1 160px' }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient name *</label>
                <input
                  autoFocus
                  value={qsName}
                  onChange={e => setQsName(e.target.value)}
                  placeholder="e.g. Marie Joseph"
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #f59e0b', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date of birth</label>
                <input
                  type="date"
                  value={qsDob}
                  onChange={e => {
                    setQsDob(e.target.value);
                    if (e.target.value) {
                      const yrs = Math.floor((Date.now() - new Date(e.target.value).getTime()) / (365.25 * 24 * 3600 * 1000));
                      if (yrs >= 0) setQsAge(String(yrs));
                    }
                  }}
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #f59e0b', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Age (yrs)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0} max={130}
                  value={qsAge}
                  onChange={e => { setQsAge(e.target.value.replace(/[^0-9]/g, '')); setQsDob(''); }}
                  placeholder="e.g. 45"
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #f59e0b', fontSize: 13, background: '#fff', color: '#0f172a', width: 72, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sex</label>
                <select
                  value={qsSex}
                  onChange={e => setQsSex(e.target.value)}
                  style={{ padding: '7px 8px', borderRadius: 7, border: '1.5px solid #f59e0b', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' }}
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!qsName.trim()}
                style={{
                  padding: '7px 18px', borderRadius: 7, border: 'none',
                  background: qsName.trim() ? '#d97706' : '#94a3b8',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: qsName.trim() ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                }}
              >
                → Start
              </button>
            </form>
          </div>
        )}


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
        {topSection === 'consultation' && !ambientMode && (() => {
          const curIdx = Math.max(0, consultTabs.findIndex(t => t.id === activeSection));
          const total = consultTabs.length;
          const prevTab = curIdx > 0 ? consultTabs[curIdx - 1] : null;
          const nextTab = curIdx < total - 1 ? consultTabs[curIdx + 1] : null;

          // ── Algorithm-guided mode: CC drives the workflow; no tab menu ──────────
          if (activeCcKey) {
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0 6px', alignItems: 'center', gap: 8 }}>
                {prevTab ? (
                  <button type="button" onClick={() => setActiveSection(prevTab.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)' }}>
                    ← {SECTION_ICONS[prevTab.id] ?? ''} {prevTab.label}
                  </button>
                ) : <span />}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setVoiceOpen(v => !v)}
                    title="Voice dictation — dictate into SOAP sections"
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                      background: voiceOpen ? '#0d9488' : '#f0fdf4',
                      color: voiceOpen ? '#fff' : '#0d9488',
                    }}
                  >
                    🎙 Dictate
                  </button>
                  <button type="button" onClick={() => setAmbientMode(true)}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #6ee7b7', background: '#f0fdf4', color: '#0d9488' }}>
                    🎙 Ambient
                  </button>
                  {nextTab && (
                    <button type="button" onClick={() => setActiveSection(nextTab.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#0d9488', color: '#fff' }}>
                      {SECTION_ICONS[nextTab.id] ?? ''} {nextTab.label} →
                    </button>
                  )}
                  <button type="button" onClick={() => setTopSection('finaldoc')}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #0d9488', background: 'transparent', color: '#0d9488' }}>
                    📋 Summary
                  </button>
                </div>
              </div>
            );
          }

          if (guidedMode) {
            return (
              <div style={{ marginBottom: 8 }}>
                {/* Step header — section name + exit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 8px', borderBottom: '2px solid #f0fdf4' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', background: '#f0fdf4', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>
                    {curIdx + 1} / {total}
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', flex: 1 }}>
                    {SECTION_ICONS[consultTabs[curIdx]?.id as Section] ?? ''} {consultTabs[curIdx]?.label ?? ''}
                  </span>
                  {/* Voice dictation toggle */}
                  <button
                    type="button"
                    onClick={() => setVoiceOpen(v => !v)}
                    title="Voice dictation — dictate into SOAP sections"
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                      background: voiceOpen ? '#0d9488' : '#f0fdf4',
                      color: voiceOpen ? '#fff' : '#0d9488',
                    }}
                  >
                    🎙 Dictate
                  </button>
                  <button type="button" onClick={() => setAmbientMode(true)}
                    style={{ fontSize: 11, color: '#0d9488', background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    🎙 Ambient
                  </button>
                  <button type="button" onClick={() => setGuidedMode(false)}
                    style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    ☰ All sections
                  </button>
                </div>
                {/* Voice dictation panel */}
                {voiceOpen && (
                  <div style={{ marginBottom: 10 }}>
                    <VoiceDictation
                      visitType={ctxVisitType ?? headerVisitMode}
                      onClose={() => setVoiceOpen(false)}
                    />
                  </div>
                )}
                {/* Progress dots — tap or keyboard-navigate to any section */}
                <div role="tablist" aria-label="Consultation sections" style={{ display: 'flex', gap: 5, padding: '8px 0 10px', alignItems: 'center' }}>
                  {consultTabs.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={i === curIdx}
                      aria-label={t.label}
                      onClick={() => setActiveSection(t.id)}
                      style={{
                        width: i === curIdx ? 28 : 8, height: 8, borderRadius: 4, cursor: 'pointer',
                        transition: 'all 0.2s ease', border: 'none', padding: 0,
                        background: i === curIdx ? '#0d9488'
                          : sectionCompletion[t.id as Section] ? '#6ee7b7'
                          : '#e2e8f0',
                      }}
                    />
                  ))}
                </div>
                {/* Prev / Next */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
                  {prevTab ? (
                    <button type="button" onClick={() => setActiveSection(prevTab.id)}
                      style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151' }}>
                      ← {SECTION_ICONS[prevTab.id] ?? ''} {prevTab.label}
                    </button>
                  ) : <span />}
                  {nextTab ? (
                    <button type="button" onClick={() => setActiveSection(nextTab.id)}
                      style={{ padding: '11px 28px', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: 'none', background: '#0d9488', color: '#fff', boxShadow: '0 2px 10px rgba(13,148,136,0.25)' }}>
                      {SECTION_ICONS[nextTab.id] ?? ''} {nextTab.label} →
                    </button>
                  ) : (
                    <button type="button" onClick={completeEncounter} disabled={completing}
                      style={{ padding: '11px 22px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: completing ? 'wait' : 'pointer', border: '2px solid #0d9488', background: '#f0fdfa', color: '#0d9488', opacity: completing ? 0.7 : 1 }}>
                      {completing ? '⏳ Closing…' : '✓ Finish & Summary'}
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // Full tab strip
          return (
            <>
              <div className="consult-tabstrip-wrap">
                {tsCanLeft && <div className="ts-fade ts-fade--left" />}
                {tsCanLeft && (
                  <button className="ts-scroll-btn ts-scroll-btn--left" aria-label="Scroll tabs left"
                    onClick={() => { const s = tabStripRef.current; if (s) s.scrollLeft -= 160; }}>‹</button>
                )}
                <div ref={tabStripRef} className="consult-tabstrip" role="tablist" aria-label="Consultation sections">
                  {consultTabs.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeSection === tab.id}
                      aria-controls={`tabpanel-${tab.id}`}
                      id={`tab-${tab.id}`}
                      className={`ct-tab${activeSection === tab.id ? ' ct-tab--active' : ''}`}
                      onClick={() => setActiveSection(tab.id)}
                    >
                      {SECTION_ICONS[tab.id] && <span style={{ marginRight: 3, fontSize: 11, lineHeight: 1 }}>{SECTION_ICONS[tab.id]}</span>}{tab.label}
                    </button>
                  ))}
                </div>
                {tsCanRight && <div className="ts-fade ts-fade--right" />}
                {tsCanRight && (
                  <button className="ts-scroll-btn ts-scroll-btn--right" aria-label="Scroll tabs right"
                    onClick={() => { const s = tabStripRef.current; if (s) s.scrollLeft += 160; }}>›</button>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0 8px', gap: 8, alignItems: 'center' }}>
                {prevTab ? (
                  <button type="button" onClick={() => setActiveSection(prevTab.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)' }}>
                    ← {SECTION_ICONS[prevTab.id] ?? ''} {prevTab.label}
                  </button>
                ) : <span />}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setVoiceOpen(v => !v)}
                    title="Voice dictation — dictate into SOAP sections"
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                      background: voiceOpen ? '#0d9488' : '#f0fdf4',
                      color: voiceOpen ? '#fff' : '#0d9488',
                    }}
                  >
                    🎙 Dictate
                  </button>
                  <button type="button" onClick={() => setAmbientMode(true)}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #6ee7b7', background: '#f0fdf4', color: '#0d9488' }}>
                    🎙 Ambient
                  </button>
                  {nextTab && (
                    <button type="button" onClick={() => setActiveSection(nextTab.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1F7A8C', color: '#fff' }}>
                      {SECTION_ICONS[nextTab.id] ?? ''} {nextTab.label} →
                    </button>
                  )}
                  <button type="button" onClick={() => setTopSection('finaldoc')}
                    title="Open encounter summary, export, and sign-off"
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #0d9488', background: 'transparent', color: '#0d9488' }}>
                    📋 Summary
                  </button>
                </div>
              </div>
            </>
          );
        })()}

        {/* Voice dictation panel — shared across all non-guided consultation modes */}
        {topSection === 'consultation' && !ambientMode && !guidedMode && voiceOpen && (
          <div style={{ marginBottom: 10 }}>
            <VoiceDictation
              visitType={ctxVisitType ?? headerVisitMode}
              onClose={() => setVoiceOpen(false)}
            />
          </div>
        )}

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
      {notifyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send patient notification"
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setNotifyOpen(false); }}
        >
          <div style={{
            background: 'var(--bg, #0f172a)', border: '1px solid var(--line, #1e293b)',
            borderRadius: 12, padding: '20px 22px', width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink, #f1f5f9)' }}>
                ✉ Notify {patientName ? patientName.split(' ')[0] : 'Patient'}
              </span>
              <button
                type="button"
                onClick={() => setNotifyOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b', lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Template picker */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {([
                { id: 'result_ready',        label: 'Result ready' },
                { id: 'postop_checkin',      label: 'Post-op check-in' },
                { id: 'appointment_reminder',label: 'Appointment reminder' },
                { id: 'general',             label: 'Custom message' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setNotifyTemplate(t.id)}
                  style={{
                    padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    border: `1px solid ${notifyTemplate === t.id ? '#3b82f6' : '#334155'}`,
                    background: notifyTemplate === t.id ? '#1d4ed8' : 'transparent',
                    color: notifyTemplate === t.id ? '#fff' : '#94a3b8',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >{t.label}</button>
              ))}
            </div>

            {/* Conditional fields */}
            {notifyTemplate === 'appointment_reminder' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {(['day', 'date', 'time', 'location'] as const).map(field => (
                  <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field}</span>
                    <input
                      type="text"
                      value={notifyData[field]}
                      placeholder={field === 'day' ? 'e.g. Tuesday' : field === 'date' ? 'e.g. 5 Aug 2026' : field === 'time' ? 'e.g. 10:00 AM' : 'e.g. Rodney Bay'}
                      onChange={e => setNotifyData(d => ({ ...d, [field]: e.target.value }))}
                      style={{
                        padding: '6px 8px', borderRadius: 6, fontSize: 12,
                        border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9',
                        outline: 'none',
                      }}
                    />
                  </label>
                ))}
              </div>
            )}

            {notifyTemplate === 'general' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</span>
                  <textarea
                    value={notifyData.message}
                    onChange={e => setNotifyData(d => ({ ...d, message: e.target.value }))}
                    rows={3}
                    placeholder="Type the message to send to the patient…"
                    style={{
                      padding: '6px 8px', borderRadius: 6, fontSize: 12, resize: 'vertical',
                      border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </label>
              </div>
            )}

            {(notifyTemplate === 'result_ready' || notifyTemplate === 'postop_checkin') && (
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
                A pre-written message will be sent to the patient's phone on file.
              </p>
            )}

            {/* Status feedback */}
            {notifyStatus && (
              <div style={{
                padding: '7px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                marginBottom: 12,
                background: notifyStatus.ok ? '#052e16' : '#450a0a',
                color: notifyStatus.ok ? '#4ade80' : '#f87171',
                border: `1px solid ${notifyStatus.ok ? '#166534' : '#991b1b'}`,
              }}>
                {notifyStatus.ok ? '✓ ' : '✕ '}{notifyStatus.msg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setNotifyOpen(false)}
                style={{
                  padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={sendPatientNotification}
                disabled={notifyBusy}
                style={{
                  padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  border: 'none', background: notifyBusy ? '#1e3a8a' : '#1d4ed8',
                  color: notifyBusy ? '#93c5fd' : '#fff', cursor: notifyBusy ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >{notifyBusy ? 'Sending…' : 'Send SMS'}</button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette
        onSection={handleSectionSelect}
        onTopSection={s => { setTopSection(s); setZenMode(false); }}
        topSection={topSection}
        userRole={userRole}
      />
    </div>
  );
}
