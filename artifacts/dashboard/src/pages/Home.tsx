import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext, Section, TopSection, type EncounterType, type VitalsState } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/context/AuthContext';
import { supabase, ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import { hasRole, roleIn } from '@/lib/roles';
import { usePathway } from '@/lib/usePathway';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import NavSidebar, { type SectionCompletion } from '@/components/NavSidebar';
import ReceptionistView from './ReceptionistView';
import NursePreVisitView from './NursePreVisitView';
import IntakeTab from './tabs/IntakeTab';
import TriageTab from './tabs/TriageTab';
import HpiTab from './tabs/HpiTab';
import PmhTab from './tabs/PmhTab';
import FamilyHistoryTab from './tabs/FamilyHistoryTab';
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
import SurgicalClassificationsTab from './tabs/SurgicalClassificationsTab';
import VisitManagerTab from './VisitManager';
import PrescriptionsTab from './tabs/PrescriptionsTab';
import AiConsultantTab from './tabs/AiConsultantTab';
import WhoChecklistTab from './tabs/WhoChecklistTab';
import PerioperativeTab from './tabs/PerioperativeTab';
import DosingTab from './tabs/DosingTab';
import FluidNutritionTab from './tabs/FluidNutritionTab';
import BloodGasTab from './tabs/BloodGasTab';
import WoundTab from './tabs/WoundTab';
import SurgicalConsentTab from './tabs/SurgicalConsentTab';
import EncounterTimelineTab from './tabs/EncounterTimelineTab';
import QualityImprovementTab from './tabs/QualityImprovementTab';
import ResultsInboxTab from './tabs/ResultsInboxTab';
import LetterGeneratorTab from './tabs/LetterGeneratorTab';
import PatientEducationTab from './tabs/PatientEducationTab';
import PatientTasksTab from './tabs/PatientTasksTab';
import CheckInTab, { VISIT_TYPES } from './tabs/CheckInTab';
import EncounterStartWizard from '@/components/EncounterStartWizard';
import VisitTypeOpeningPanel from '@/components/VisitTypeOpeningPanel';
import ResultsAlertBadge from '@/components/ResultsAlertBadge';
import FloatingActions from '@/components/FloatingActions';
import ErrorBoundary from '@/components/ErrorBoundary';
import CommandPalette from '@/components/CommandPalette';
import ProblemListStrip from '@/components/ProblemListStrip';
import CriticalResultAlert from '@/components/CriticalResultAlert';
import EncounterContextPicker from '@/components/EncounterContextPicker';
import PreviousVisitStrip from '@/components/PreviousVisitStrip';
import ChiefComplaintStrip from '@/components/ChiefComplaintStrip';
import ClinicalPromptsStrip from '@/components/ClinicalPromptsStrip';
import FollowUpQueueStrip from '@/components/FollowUpQueueStrip';
import VoiceDictation from '@/components/VoiceDictation';
import AmbientConsultation from '@/components/AmbientConsultation';
import { getMatrix } from '@/lib/cc-matrices';

const API_ORIGIN = getApiOrigin();

// Tabs shown and their display labels, ordered by clinical priority, per visit type.
// Narrower lists = less noise; renamed labels = more signal.
const VISIT_TYPE_TABS: Record<string, Array<{ id: Section; label: string }>> = {
  follow_up: [
    { id: 'hpi',               label: 'Interval Hx'  },
    { id: 'examination',       label: 'Exam'          },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'prescriptions',     label: 'RX'            },
    { id: 'progress',          label: 'Notes'         },
    { id: 'monitoring',        label: 'Monitor'       },
    { id: 'tasks',             label: 'Tasks'         },
    { id: 'referring_providers', label: 'Referrals'  },
  ],
  post_op: [
    { id: 'wounds',            label: 'Wound'         },
    { id: 'hpi',               label: 'POD Hx'        },
    { id: 'examination',       label: 'Exam'          },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'prescriptions',     label: 'RX'            },
    { id: 'progress',          label: 'Notes'         },
    { id: 'monitoring',        label: 'Vitals'        },
    { id: 'tasks',             label: 'Tasks'         },
  ],
  ercp: [
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'medications',       label: 'Meds'          },
    { id: 'allergies',         label: 'Allergies'     },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'attachments',       label: 'Reports'       },
    { id: 'procedures',        label: 'ERCP'          },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'progress',          label: 'Notes'         },
  ],
  endoscopy_ogd: [
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'medications',       label: 'Meds'          },
    { id: 'allergies',         label: 'Allergies'     },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'attachments',       label: 'Reports'       },
    { id: 'procedures',        label: 'OGD'           },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'progress',          label: 'Notes'         },
  ],
  endoscopy_col: [
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'medications',       label: 'Meds'          },
    { id: 'allergies',         label: 'Allergies'     },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'attachments',       label: 'Reports'       },
    { id: 'procedures',        label: 'Colonoscopy'   },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'progress',          label: 'Notes'         },
  ],
  breast: [
    { id: 'hpi',               label: 'Breast Hx'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'examination',       label: 'CBE'           },
    { id: 'investigations',    label: 'Imaging'       },
    { id: 'attachments',       label: 'Reports'       },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'referring_providers', label: 'Referrals'  },
    { id: 'tasks',             label: 'Tasks'         },
  ],
  telephone: [
    { id: 'progress',          label: 'Call Record'   },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'prescriptions',     label: 'RX'            },
    { id: 'tasks',             label: 'Follow-up'     },
  ],
  diabetic_foot: [
    { id: 'wounds',            label: 'Wound'         },
    { id: 'hpi',               label: 'Foot Hx'       },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'prescriptions',     label: 'RX'            },
    { id: 'referring_providers', label: 'Referrals'  },
    { id: 'progress',          label: 'Notes'         },
    { id: 'tasks',             label: 'Tasks'         },
  ],
  urgent: [
    { id: 'triage',            label: 'Triage'        },
    { id: 'hpi',               label: 'Presenting Hx' },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'medications',       label: 'Meds'          },
    { id: 'allergies',         label: 'Allergies'     },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'progress',          label: 'Notes'         },
  ],
};

// Where to land the cursor the instant the visit type panel completes
const VISIT_TYPE_START: Partial<Record<string, Section>> = {
  follow_up:      'hpi',
  post_op:        'wounds',
  ercp:           'hpi',
  endoscopy_ogd:  'hpi',
  endoscopy_col:  'hpi',
  breast:         'examination',
  telephone:      'progress',
  diabetic_foot:  'wounds',
  urgent:         'triage',
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
    encounterType, setEncounterType,
    activeCcKey,
    visitType: ctxVisitType, setVisitType: ctxSetVisitType,
    setIsPostOp, setPostOpDays,
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
  } = useAppContext();

  const [collapsed, setCollapsed] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);
  const [criticalResultCount, setCriticalResultCount] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showAcuityBreakdown, setShowAcuityBreakdown] = useState(false);
  const [admissionDismissed, setAdmissionDismissed] = useState(false);
  const [headerVisitMode, setHeaderVisitMode] = useState<'new' | 'followup'>('new');
  const [wizardSkipped, setWizardSkipped] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [ambientMode, setAmbientMode] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const prevPatientIdRef = useRef<string | null>(null);
  const acuityRef = useRef<HTMLDivElement>(null);

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

  // Reset wizard + guided mode whenever a different patient is loaded
  useEffect(() => {
    if (patientId !== prevPatientIdRef.current) {
      prevPatientIdRef.current = patientId;
      if (patientId) { setWizardSkipped(false); setGuidedMode(false); setAmbientMode(true); }
    }
  }, [patientId]);

  const userRole = profile?.role ?? 'front_desk';
  const { activePathway, matchedPathways } = usePathway();
  const topMatchScore = matchedPathways[0]?.score ?? 0;
  const highConfidence = topMatchScore >= 15 && activePathway !== null;

  /* ── Sections shown per encounter type — accordion effect ── */
  const ENCOUNTER_TAB_SETS: Record<EncounterType, ReadonlySet<Section>> = useMemo(() => ({
    quick_consult: new Set<Section>([
      'triage', 'hpi', 'pmh', 'medications', 'allergies',
      'examination', 'assessment', 'plan', 'prescriptions', 'referring_providers',
      'encounter_history', 'progress', 'monitoring', 'tasks',
    ]),
    endoscopy: new Set<Section>([
      'triage', 'hpi', 'pmh', 'surgical', 'medications', 'allergies',
      'examination', 'investigations', 'radiology', 'attachments',
      'assessment', 'plan', 'procedures',
      'prescriptions', 'referring_providers',
      'encounter_history', 'progress', 'monitoring', 'tasks',
    ]),
    surgical_consult: new Set<Section>([
      'triage', 'hpi', 'pmh', 'surgical', 'medications', 'allergies',
      'family_hx', 'toxic', 'ros',
      'examination', 'investigations', 'radiology', 'attachments',
      'assessment', 'plan', 'procedures',
      'prescriptions', 'referring_providers',
      'encounter_history', 'progress', 'monitoring', 'tasks',
    ]),
    office_procedure: new Set<Section>([
      'triage', 'hpi', 'pmh', 'medications', 'allergies',
      'examination', 'investigations', 'attachments',
      'assessment', 'plan', 'prescriptions',
      'encounter_history', 'progress', 'monitoring', 'tasks',
    ]),
    major_emergency: new Set<Section>([
      'triage', 'hpi', 'pmh', 'surgical', 'medications', 'allergies',
      'family_hx', 'toxic', 'ros',
      'examination', 'wounds', 'investigations', 'blood_gas', 'radiology', 'attachments',
      'assessment', 'plan', 'prescriptions', 'dosing', 'fluid_nutrition', 'referring_providers',
      'encounter_history', 'progress', 'monitoring', 'tasks',
    ]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  /* ── Section icon map for encounter progress rail ── */
  const SECTION_ICONS: Partial<Record<Section, string>> = {
    triage: '⚡', hpi: '📝', pmh: '🏥', surgical: '⚕️',
    medications: '💊', allergies: '⚠', family_hx: '👨‍👩‍👧', toxic: '🚬',
    ros: '📋', examination: '🩺', wounds: '🩹',
    investigations: '🧪', blood_gas: '💨', radiology: '📡', attachments: '📎',
    assessment: '🎯', plan: '📄', procedures: '⚕️',
    prescriptions: '💊', dosing: '💉', fluid_nutrition: '💧',
    referring_providers: '↗', encounter_history: '📅',
    progress: '📝', monitoring: '📊', tasks: '✓',
  };

  /* ── Consultation tab list (role-aware + CC matrix or visit-type / encounter-type filtered) ── */
  const consultTabs = useMemo<{ id: Section; label: string }[]>(() => {
    // Visit-type-specific tabs: narrowed list, visit-aware labels, clinically ordered.
    // Only bypassed when a CC matrix is active (matrix takes precedence).
    if (ctxVisitType && ctxVisitType !== 'new_consult' && !activeCcKey) {
      const vtTabs = VISIT_TYPE_TABS[ctxVisitType];
      if (vtTabs) {
        const doctorOnly = new Set<Section>(['assessment','plan','procedures','prescriptions','dosing','fluid_nutrition','referring_providers','encounter_history']);
        // examination + wounds are allowed for doctors on visit types that require clinical assessment
        const doctorExamTypes = new Set(['breast','diabetic_foot','follow_up','post_op','urgent']);
        const nurseOnly = new Set<Section>(['investigations','blood_gas','radiology','attachments']);
        return vtTabs.filter(t => {
          if (doctorOnly.has(t.id)) return hasRole(userRole, 'doctor');
          if (t.id === 'examination' || t.id === 'wounds') {
            return hasRole(userRole, 'nurse') || (hasRole(userRole, 'doctor') && doctorExamTypes.has(ctxVisitType));
          }
          if (nurseOnly.has(t.id)) return hasRole(userRole, 'nurse') || hasRole(userRole, 'doctor');
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
      { id: 'triage', label: 'Triage' },
      { id: 'hpi', label: 'HPI' },
      { id: 'pmh', label: 'PMH' },
      { id: 'surgical', label: 'Surgical' },
      { id: 'medications', label: 'Meds' },
      { id: 'allergies', label: 'Allergies' },
      { id: 'family_hx', label: 'Family Hx' },
      { id: 'toxic', label: 'Social' },
      { id: 'ros', label: 'ROS' },
      ...(hasRole(userRole, 'nurse') ? [
        { id: 'examination' as Section, label: 'Exam' },
        { id: 'wounds' as Section, label: 'Wounds' },
        { id: 'investigations' as Section, label: 'Labs' },
        { id: 'blood_gas' as Section, label: 'ABG' },
        { id: 'radiology' as Section, label: 'Radiology' },
        { id: 'attachments' as Section, label: 'Attach' },
      ] : []),
      ...(hasRole(userRole, 'doctor') ? [
        { id: 'assessment' as Section, label: 'Assess' },
        { id: 'plan' as Section, label: 'Plan' },
        { id: 'procedures' as Section, label: 'Procedure' },
        { id: 'prescriptions' as Section, label: 'RX' },
        { id: 'dosing' as Section, label: 'Dosing' },
        { id: 'fluid_nutrition' as Section, label: 'Fluids' },
        { id: 'referring_providers' as Section, label: 'Referrals' },
        { id: 'encounter_history' as Section, label: 'History' },
      ] : []),
      { id: 'progress', label: 'Notes' },
      { id: 'monitoring', label: 'Monitor' },
      { id: 'tasks', label: 'Tasks' },
    ];
    return all.filter(t => allowed.has(t.id));
  }, [userRole, encounterType, ctxVisitType, activeCcKey, ENCOUNTER_TAB_SETS]);

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

  const patientLabel = patientName.trim() || 'No patient loaded';
  const metaParts: string[] = [];
  if (age) metaParts.push(`Age ${age}`);
  if (sex && sex !== 'unknown') metaParts.push(sex);

  const sidebarWidth = zenMode ? 0 : (collapsed || topSection === 'consultation') ? 52 : 182;

  if (userRole === 'nurse') return <ErrorBoundary><NursePreVisitView /></ErrorBoundary>;

  return (
    <div
      className="app"
      style={{ gridTemplateColumns: `${sidebarWidth}px 1fr`, transition: 'grid-template-columns 200ms ease' }}
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
          {/* Encounter mode pill — hidden in consultation (EncounterContextPicker handles it) */}
          {topSection !== 'consultation' && (
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

          {/* Visit type dropdown — header */}
          <div style={{ position: 'relative' }}>
            <select
              value={ctxVisitType ?? ''}
              onChange={e => {
                const id = e.target.value;
                if (!id) return;
                ctxSetVisitType(id);
                setIsPostOp(id === 'post_op');
                setPostOpDays('');
                if (id === 'ercp' || id === 'endoscopy_ogd' || id === 'endoscopy_col') {
                  setEncounterType('endoscopy');
                } else if (id === 'urgent') {
                  setEncounterType('major_emergency');
                } else if (id === 'post_op' || id === 'follow_up') {
                  setEncounterType('quick_consult');
                } else {
                  setEncounterType('surgical_consult');
                }
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
          </div>

          {/* Acuity badge — clickable, shows score breakdown */}
          <div ref={acuityRef} style={{ position: 'relative' }}>
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

          {/* AI Registrar button — header, doctor-only */}
          {hasRole(userRole, 'doctor') && (
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
      </header>

      {/* ── Collapsible sidebar — auto-collapsed (icon-only) during active consultation ── */}
      <NavSidebar
        collapsed={collapsed || zenMode || topSection === 'consultation'}
        onToggle={() => zenMode ? setZenMode(false) : setCollapsed(c => !c)}
        topSection={topSection}
        onTopSection={s => { setTopSection(s); setZenMode(false); }}
        activeSection={activeSection}
        onSection={handleSectionSelect}
        userRole={userRole}
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
      <main ref={swipeRef} className="main-content">
        {/* Zen mode exit chip */}
        {zenMode && (
          <button
            onClick={() => setZenMode(false)}
            title="Show navigation"
            style={{
              position: 'fixed', bottom: 20, left: 16, zIndex: 200,
              display: 'flex', alignItems: 'center', gap: 6,
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

        {/* Patient context banner — sticky at top of consultation */}
        {topSection === 'consultation' && (() => {
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
              {ctxVisitType && ctxVisitType !== 'new_consult' && (() => {
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

              {/* Guided mode toggle */}
              <button
                type="button"
                onClick={() => setGuidedMode(g => !g)}
                title={guidedMode ? 'Exit guided mode — show all sections' : 'Enter guided mode — one step at a time'}
                style={{
                  marginLeft: 'auto', padding: '2px 10px', borderRadius: 5, border: 'none',
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

        {/* No-patient guard */}
        {topSection === 'consultation' && !patientId && (
          <div style={{ background: '#fef9c3', border: '1.5px solid #fbbf24', borderRadius: 10, padding: '14px 18px', color: '#92400e', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>👤</span>
            No patient loaded — check in a patient first.
          </div>
        )}

        {/* Encounter start wizard — new consult only; suppressed for typed visit flows */}
        {topSection === 'consultation' && !!patientId && !activeCcKey && !wizardSkipped &&
         (!ctxVisitType || ctxVisitType === 'new_consult') && (
          <EncounterStartWizard
            onComplete={() => setWizardSkipped(true)}
            onSkip={() => setWizardSkipped(true)}
          />
        )}

        {/* Visit type opening panel — focused intake for follow-up, post-op, endoscopy, etc. */}
        {topSection === 'consultation' && !!patientId && !wizardSkipped &&
         ctxVisitType && ctxVisitType !== 'new_consult' && (
          <VisitTypeOpeningPanel
            onComplete={() => {
              const startTab = VISIT_TYPE_START[ctxVisitType];
              if (startTab) setActiveSection(startTab);
              setWizardSkipped(true);
            }}
            onGoToTriage={() => { setActiveSection('triage'); setWizardSkipped(true); }}
          />
        )}

        {/* Ambient consultation — voice-first default after wizard */}
        {topSection === 'consultation' && !!patientId && wizardSkipped && ambientMode && (
          <AmbientConsultation
            visitType={ctxVisitType ?? headerVisitMode}
            onDetailedMode={() => { setAmbientMode(false); setGuidedMode(true); }}
            onFinalise={() => setTopSection('finaldoc')}
          />
        )}

        {/* Context strips — hidden in guided/ambient mode to eliminate noise */}
        {topSection === 'consultation' && !ambientMode && !guidedMode && <EncounterContextPicker />}
        {topSection === 'consultation' && !!patientId && !ambientMode && !guidedMode && <PreviousVisitStrip />}
        {topSection === 'consultation' && !ambientMode && !guidedMode && <ChiefComplaintStrip />}
        {topSection === 'consultation' && !ambientMode && !guidedMode && <ProblemListStrip />}
        {topSection === 'consultation' && !ambientMode && !guidedMode && <ClinicalPromptsStrip />}
        {topSection === 'consultation' && !ambientMode && !guidedMode && <FollowUpQueueStrip />}


        {/* Consultation navigation — guided (one step at a time) or full tab strip */}
        {topSection === 'consultation' && !ambientMode && (() => {
          const curIdx = Math.max(0, consultTabs.findIndex(t => t.id === activeSection));
          const total = consultTabs.length;
          const prevTab = curIdx > 0 ? consultTabs[curIdx - 1] : null;
          const nextTab = curIdx < total - 1 ? consultTabs[curIdx + 1] : null;

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
                {/* Progress dots — tap any to jump */}
                <div style={{ display: 'flex', gap: 5, padding: '8px 0 10px', alignItems: 'center' }}>
                  {consultTabs.map((t, i) => (
                    <div
                      key={t.id}
                      title={t.label}
                      onClick={() => setActiveSection(t.id)}
                      style={{
                        width: i === curIdx ? 28 : 8, height: 8, borderRadius: 4, cursor: 'pointer',
                        transition: 'all 0.2s ease',
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
                      ← {prevTab.label}
                    </button>
                  ) : <span />}
                  {nextTab ? (
                    <button type="button" onClick={() => setActiveSection(nextTab.id)}
                      style={{ padding: '11px 28px', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: 'none', background: '#0d9488', color: '#fff', boxShadow: '0 2px 10px rgba(13,148,136,0.25)' }}>
                      {nextTab.label} →
                    </button>
                  ) : (
                    <button type="button" onClick={() => setTopSection('finaldoc')}
                      style={{ padding: '11px 22px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: '2px solid #0d9488', background: '#f0fdfa', color: '#0d9488' }}>
                      ✓ Finish &amp; Summary
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // Full tab strip
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
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 8px', gap: 8, alignItems: 'center' }}>
                {prevTab ? (
                  <button type="button" onClick={() => setActiveSection(prevTab.id)}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151' }}>
                    ← {prevTab.label}
                  </button>
                ) : <span />}
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {curIdx >= 0 ? `${curIdx + 1} / ${consultTabs.length}` : ''}
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" onClick={() => setAmbientMode(true)}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #6ee7b7', background: '#f0fdf4', color: '#0d9488' }}>
                    🎙 Ambient
                  </button>
                  {nextTab && (
                    <button type="button" onClick={() => setActiveSection(nextTab.id)}
                      style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1F7A8C', color: '#fff' }}>
                      {nextTab.label} →
                    </button>
                  )}
                  <button type="button" onClick={() => setTopSection('finaldoc')}
                    title="Open encounter summary, export, and sign-off"
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #0d9488', background: 'transparent', color: '#0d9488' }}>
                    📋 Summary
                  </button>
                </div>
              </div>
            </>
          );
        })()}

        {/* Clinical sections */}
        {topSection === 'intake'        && <IntakeTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'hpi'         && <HpiTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'triage'      && <TriageTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'pmh'         && <PmhTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'surgical'    && <SurgicalHistoryTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'medications' && <MedicationsTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'allergies'   && <AllergiesTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'family_hx'   && <FamilyHistoryTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'toxic'       && <ToxicHabitsTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'scales'      && <ScalesTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'ros'         && <RosTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'examination'        &&
          (hasRole(userRole, 'nurse') || (hasRole(userRole, 'doctor') && ['breast','diabetic_foot','follow_up','post_op','urgent'].includes(ctxVisitType))) &&
          <ExaminationTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'classifications'    && hasRole(userRole, 'nurse')  && <SurgicalClassificationsTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'investigations' && hasRole(userRole, 'nurse')  && <InvestigationsTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'radiology'     && hasRole(userRole, 'nurse')  && <RadiologyTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'attachments'   && hasRole(userRole, 'nurse')  && <AttachmentsTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'assessment'     && hasRole(userRole, 'doctor') && <AssessmentTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'plan'        && hasRole(userRole, 'doctor') && <PlanTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'procedures' && hasRole(userRole, 'doctor') && <ProceduresTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'progress'    && <ProgressNotesTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'monitoring'  && <VitalsMonitoringTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'prescriptions' && hasRole(userRole, 'doctor') && <PrescriptionsTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'referring_providers' && hasRole(userRole, 'doctor') && <ReferringProvidersTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'encounter_history'   && hasRole(userRole, 'doctor') && <EncounterTimelineTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'ai_consultant' && hasRole(userRole, 'doctor') && <AiConsultantTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'nurse_apcq'      && <NurseAPCQTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'apcq'            && <APCQTab compact />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'tasks'          && <PatientTasksTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'periop'         && <PerioperativeTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'dosing'         && <DosingTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'fluid_nutrition' && <FluidNutritionTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'blood_gas'       && <BloodGasTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'wounds'          && <WoundTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'who_checklist'  && <WhoChecklistTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'consent'        && <SurgicalConsentTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'letters'        && <LetterGeneratorTab />}
        {topSection === 'consultation' && !ambientMode && activeSection === 'patient_education' && <PatientEducationTab />}
        {topSection === 'procedures'    && hasRole(userRole, 'doctor')        && <ProceduresTab />}
        {topSection === 'summary'        && <SummaryTab />}
        {topSection === 'finaldoc'       && encounterMode === 'outpatient' && <SummaryTab />}
        {topSection === 'finaldoc'       && encounterMode === 'inpatient'  && <InpatientTab />}
        {topSection === 'billing'       && activeSection === 'billing'   && roleIn(userRole, 'front_desk', 'admin') && <BillingTab />}
        {topSection === 'billing'       && activeSection === 'documents' && roleIn(userRole, 'front_desk', 'admin') && <DocumentsTab />}

        {/* Previously-stub sections */}
        {topSection === 'dashboard'  && <DashboardTab />}
        {topSection === 'patients'   && <PatientSearchTab />}
        {topSection === 'scheduling' && <SchedulingTab />}
        {topSection === 'analytics'   && hasRole(userRole, 'doctor') && <AnalyticsTab />}
        {topSection === 'quality'       && hasRole(userRole, 'doctor') && <QualityImprovementTab />}
        {topSection === 'results_inbox' && hasRole(userRole, 'nurse')  && <ResultsInboxTab />}
        {topSection === 'settings'   && hasRole(userRole, 'admin')  && <SettingsTab />}
        {topSection === 'trauma'         && hasRole(userRole, 'nurse')  && <TraumaTab />}
        {topSection === 'vademecum'      && hasRole(userRole, 'nurse')  && <DictionaryTab />}
        {topSection === 'questionnaire'  && roleIn(userRole, 'front_desk')   && <QuestionnaireManagerTab />}
        {topSection === 'questionnaire'  && (hasRole(userRole, 'nurse') || hasRole(userRole, 'doctor'))  && <NurseAPCQTab />}
        {topSection === 'checkin'                                              && <CheckInTab />}
        {topSection === 'doc_scan'   && roleIn(userRole, 'front_desk', 'admin') && <DocumentsTab />}
        {topSection === 'booking_inbox'  && roleIn(userRole, 'front_desk', 'admin') && <BookingInboxTab />}
        {topSection === 'portal_intake'                                         && <PortalIntakeTab />}
        {topSection === 'referring_providers'                                   && <ReferringProvidersTab />}
        {topSection === 'visit_lifecycle'                                        && <VisitManagerTab />}
        {topSection === 'prescriptions'     && hasRole(userRole, 'doctor')     && <PrescriptionsTab />}
        {topSection === 'ai_consultant'     && hasRole(userRole, 'doctor')     && <AiConsultantTab />}
        {topSection === 'tasks'                                                && <PatientTasksTab />}
        </ErrorBoundary>
      </main>

      <FloatingActions />

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
          <ErrorBoundary>
            <AiConsultantTab />
          </ErrorBoundary>
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
