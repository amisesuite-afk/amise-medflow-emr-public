import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { enqueue, flush, type SyncStatus } from '@/lib/sync-outbox';
import '@/lib/sync-executors'; // registers outbox executors — side-effect import, must run before any save can fail
import { adaptiveTriage, AdaptiveTriageInput, AdaptiveTriageResult, Sex, VitalSigns } from '@workspace/triage-engine';
import { type SiteCode, supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { updateDefaultSite, saveAssessment, savePlan, syncAllergyList, syncMedicationList, saveExamFindings, syncSurgicalHistory, syncToxicHabits, syncRosFindings, syncProcedureData, syncTraumaRecord, loadPatientProblems, savePatientProblem, updatePatientProblemStatus, removePatientProblem, type PatientProblem, loadWoundAssessments, saveWoundAssessment, deleteWoundAssessment, emptyWound, type WoundAssessment, savePmhNotes, saveHpiNote, clearHpiNote, syncInvestigationOrders, updateEncounterType, toDbEncounterType, saveInpatientDetails, saveClinicalScores, listPatientEncounters, type EncounterSummary } from '@/lib/db';
import type { PaneState, RankedDiagnosis, ProtocolMedication } from '@workspace/pane-engine';
import { isImagingInvestigation, parseImagingToRequest, imagingAlreadyRequested } from '@/lib/imaging-utils';
import { scoreDiagnosis } from '@/lib/diagnosis-proc-mapper';

export { type SiteCode } from '@/lib/supabase';
export type Section =
  | 'intake' | 'triage' | 'hpi' | 'pmh' | 'surgical' | 'medications'
  | 'allergies' | 'family_hx' | 'toxic' | 'scales' | 'ros' | 'examination' | 'investigations'
  | 'radiology' | 'attachments' | 'classifications'
  | 'assessment' | 'plan' | 'progress'
  | 'procedures' | 'billing' | 'documents'
  | 'monitoring' | 'apcq' | 'nurse_apcq'
  | 'prescriptions' | 'ai_consultant' | 'tasks'
  | 'referring_providers' | 'encounter_history'
  | 'who_checklist' | 'consent' | 'letters' | 'patient_education' | 'periop' | 'dosing' | 'fluid_nutrition' | 'blood_gas' | 'wounds'
  | 'brief' | 'sphere';

/**
 * Encounter complexity tier. Controls which consultation sections are
 * surfaced by default — the "accordion" effect. Persisted per-session.
 *
 * quick_consult    — Simple outpatient visit (hernia, haemorrhoids, thyroid nodule, breast lump)
 * endoscopy        — OGD, colonoscopy, ERCP — scope-first workflow
 * surgical_consult — Full preoperative surgical assessment (default)
 * office_procedure — Minor in-clinic procedure (FNAC, excision, dressing)
 * major_emergency  — Major elective admission or ER/trauma on-call
 */
export type EncounterType =
  | 'quick_consult'
  | 'endoscopy'
  | 'surgical_consult'
  | 'office_procedure'
  | 'major_emergency';

export interface ProgressNote {
  id: string;
  dbNoteId?: string;
  date: string;
  author: string;
  type: 'SOAP' | 'Ward Round' | 'Follow-up';
  interval: string;
  chiefComplaint: string;
  symptoms: string[];
  intervalHistory: string;
  vitals: Partial<Record<string, string>>;
  examGeneral: string; examCvs: string; examRs: string;
  examAbdomen: string; examWound: string; examLimbs: string; examOther: string;
  assessment: string;
  plan: string;
}

export interface VitalRecord {
  id: string;
  timestamp: string;
  recordedBy: string;
  ward?: string;
  sbp?: string;
  dbp?: string;
  hr?: string;
  temp?: string;
  spo2?: string;
  rr?: string;
  weight?: string;
  gcs?: string;
  pain?: string;
  urine?: string;
  notes?: string;
}

export interface LabRecord {
  id: string;
  timestamp: string;
  recordedBy: string;
  panel: string;
  tests: Array<{ name: string; value: string; unit: string; refRange: string; flag: '' | 'H' | 'L' | 'C' }>;
}

/** A diagnosis the clinician has confirmed, carrying the signs that support it. */
export interface ActiveDiagnosis {
  id: string;
  name: string;
  signs: string[]; // diagnostic criteria from the differential card
}

/**
 * Central working diagnosis — written by pathognomonic sign detection, PANE
 * convergence, or manual ICD selection. Read by CDS, Plan tab, and PANE display
 * to form a coherent downstream signal chain.
 */
export interface WorkingDiagnosis {
  diseaseId: string | null; // matches dx-variants group ID (e.g. 'appendicitis'), or null for manual ICD picks
  icdCode: string | null;  // ICD-10 code for getProtocolByIcd() lookup
  confidence: number;      // 0–1 posterior probability
  source: 'pathognomonic' | 'pane_converged' | 'manual_icd' | 'pane_high';
  locked: boolean;         // true = pathognomonic or manual override
  signText?: string;       // e.g. "Rovsing's sign"
  diseaseLabel?: string;   // human-readable label
}

export type TopSection =
  | 'dashboard' | 'patients' | 'checkin' | 'doc_scan' | 'intake' | 'consultation'
  | 'procedures' | 'scheduling' | 'billing' | 'analytics' | 'settings' | 'summary' | 'finaldoc' | 'inpatient'
  | 'trauma' | 'vademecum' | 'questionnaire' | 'booking_inbox' | 'calls_queue' | 'portal_intake' | 'referring_providers'
  | 'visit_lifecycle' | 'prescriptions' | 'ai_consultant' | 'tasks'
  | 'quality' | 'results_inbox' | 'followup_tracker' | 'patient_accounts';

/** Grouped trauma / burns state — stored as a single serialisable object. */
export interface TraumaData {
  mechanism: string[];
  timeOfInjury: string;
  preHospital: string[];
  gcScene: string;
  mistInjuries: string;           // MIST — Injuries suspected
  mistSigns: string;              // MIST — Pre-hospital vital signs (free text)
  admissionVitals: Record<string, string>; // hr|sbp|dbp|rr|spo2|temp|gcsTotal|bm|pupils|painScore|timeAdmission
  abcde: Record<string, Record<string, string>>; // A|B|C|D|E → field → value
  ais: Record<string, number>;
  secondary: Record<string, string>;
  secondaryDropdowns: Record<string, string[]>; // body region → selected finding chips
  burnRegions: Record<string, { affected: boolean; degree: string }>;
  burnTimeOfInjury: string;
  burnInhalation: boolean;
}

export const EMPTY_TRAUMA_DATA: TraumaData = {
  mechanism: [], timeOfInjury: '', preHospital: [], gcScene: '',
  mistInjuries: '', mistSigns: '',
  admissionVitals: {},
  abcde: {},
  ais: { headNeck: 0, face: 0, thorax: 0, abdomen: 0, extremities: 0, external: 0 },
  secondary: {}, secondaryDropdowns: {},
  burnRegions: {}, burnTimeOfInjury: '', burnInhalation: false,
};

export type VitalsState = Record<keyof VitalSigns, string>;

function toNum(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function csv(v: string): string[] {
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

function toggleList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

const SITE_STORAGE_KEY = 'amise_current_site';
function readSiteFromStorage(): SiteCode {
  try {
    const v = localStorage.getItem(SITE_STORAGE_KEY);
    if (v === 'rodney_bay' || v === 'tapion') return v;
  } catch { /* ignore */ }
  return 'rodney_bay';
}

const NAV_STORAGE_KEY = 'amise-top-section';
const VALID_TOP_SECTIONS: readonly string[] = [
  'dashboard', 'patients', 'checkin', 'doc_scan', 'intake', 'consultation',
  'procedures', 'scheduling', 'billing', 'analytics', 'settings', 'summary',
  'finaldoc', 'inpatient', 'trauma', 'vademecum', 'questionnaire', 'booking_inbox',
  'calls_queue', 'portal_intake', 'referring_providers', 'visit_lifecycle',
  'prescriptions', 'ai_consultant', 'tasks', 'quality', 'results_inbox',
  'followup_tracker', 'patient_accounts',
];
function readNavFromStorage(): TopSection {
  try {
    const v = localStorage.getItem(NAV_STORAGE_KEY);
    if (v && VALID_TOP_SECTIONS.includes(v)) return v as TopSection;
  } catch { /* ignore */ }
  return 'intake';
}

export type PreVisitStatus = 'new' | 'registered' | 'vitals_done';

export interface AnatomicalFinding {
  zone: string;
  subLocation?: string;
  findings: string[];
  notes: string;
}

export interface RosFinding {
  status: 'normal' | 'positive' | 'negative' | 'not-asked';
  details: string[];
  notes: string;
}

export interface ClinicalAttachment {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  anatomicalArea: string;
  dimensions: string;
  description: string;
  dateAdded: string;
}

export interface ExamPhoto {
  id: string;
  dataUrl: string;
  mimeType: string;
  bodyRegion: string;
  view?: string;
  description: string;
  distanceCm: string;
  dateAdded: string;
}

export interface RadiologyRequest {
  id: string;
  modality: string;
  anatomicalRegion: string;
  laterality: string;
  urgency: string;
  indication: string;
  clinicalQuestion: string;
  ctContrast: string;
  ctEgfr: string;
  mriProtocol: string;
  scopeType: string;
  functionalType: string;
  resultReceived: boolean;
  resultNotes: string;
}

interface CtxValue {
  activeSection: Section;
  setActiveSection(s: Section): void;

  /** Top-level navigation section (mirrors Home.tsx topSection state). */
  topSection: TopSection;
  setTopSection(s: TopSection): void;

  /** Active clinic site for the current session. */
  currentSite: SiteCode;
  setCurrentSite(site: SiteCode): void;

  /** UUID of the persisted patient row, null if unsaved. */
  patientId: string | null; setPatientId(v: string | null): void;
  /** UUID of the current open encounter, null if none. */
  encounterId: string | null; setEncounterId(v: string | null): void;
  /** Server-side lifecycle status of the current encounter ('open' | 'in_progress' | 'closed' | 'cancelled' | null if unknown). */
  encounterStatus: string | null; setEncounterStatus(v: string | null): void;
  /** When the encounter was closed — drives the reopen-for-edit grace period. Null when open. */
  encounterClosedAt: string | null; setEncounterClosedAt(v: string | null): void;

  patientName: string; setPatientName(v: string): void;
  age: string; setAge(v: string): void;
  sex: Sex; setSex(v: Sex): void;
  dob: string; setDob(v: string): void;
  phone: string; setPhone(v: string): void;
  email: string; setEmail(v: string): void;
  address: string; setAddress(v: string): void;
  quarter: string; setQuarter(v: string): void;
  referredBy: string; setReferredBy(v: string): void;
  patientPhoto: string; setPatientPhoto(v: string): void;
  examPhotos: ExamPhoto[]; setExamPhotos(v: ExamPhoto[] | ((prev: ExamPhoto[]) => ExamPhoto[])): void;

  durationDays: string; setDurationDays(v: string): void;
  painScore: string; setPainScore(v: string): void;
  symptoms: string[]; toggleSymptom(v: string): void;
  symptomDetails: Record<string, string[]>; toggleSymptomDetail(sym: string, opt: string): void;
  freeText: string; setFreeText(v: string): void;
  isPostOp: boolean; setIsPostOp(v: boolean): void;
  postOpDays: string; setPostOpDays(v: string): void;
  pregnancyPossible: boolean; setPregnancyPossible(v: boolean): void;
  vitals: VitalsState; updateVital(k: keyof VitalSigns, v: string): void;

  comorbidities: string[]; toggleComorbidity(v: string): void; setComorbidities(list: string[]): void;
  pmhNotes: string; setPmhNotes(v: string): void;
  familyHistory: string[]; toggleFamilyHistory(v: string): void;
  familyHistoryNotes: string; setFamilyHistoryNotes(v: string): void;
  surgicalHistory: string[]; setSurgicalHistory(v: string[]): void; toggleSurgical(v: string): void;
  surgicalNotes: string; setSurgicalNotes(v: string): void;
  recentSurgeryDate: string; setRecentSurgeryDate(v: string): void;
  medications: string[]; toggleMedication(v: string): void; setMedications(v: string[]): void;
  medicationsText: string; setMedicationsText(v: string): void;
  allergies: string; setAllergies(v: string): void;
  toxicHabits: string[]; setToxicHabits(v: string[]): void; toggleToxicHabit(v: string): void;
  occupation: string; setOccupation(v: string): void;
  hpiNotes: string; setHpiNotes(v: string): void;

  clearPatient(): void;

  examGeneral: string; setExamGeneral(v: string): void;
  examCardio: string; setExamCardio(v: string): void;
  examResp: string; setExamResp(v: string): void;
  examAbdomen: string; setExamAbdomen(v: string): void;
  examNeuro: string; setExamNeuro(v: string): void;
  examExtremities: string; setExamExtremities(v: string): void;
  examBreast: string; setExamBreast(v: string): void;
  examWound: string; setExamWound(v: string): void;
  examFindings: Record<string, string[]>; setExamFindings(v: Record<string, string[]>): void;
  examNotes: Record<string, string>; setExamNotes(v: Record<string, string>): void;

  orderedInvestigations: string[]; setOrderedInvestigations(v: string[]): void;
  investigationResults: Record<string, string>; setInvestigationResults(v: Record<string, string>): void;
  icdCodes: string[]; setIcdCodes(v: string[]): void;
  cptCodes: string[]; setCptCodes(v: string[]): void;
  confirmedDiagnoses: ActiveDiagnosis[]; setConfirmedDiagnoses(v: ActiveDiagnosis[]): void;
  workingDiagnosis: WorkingDiagnosis | null; setWorkingDiagnosis(v: WorkingDiagnosis | null): void;

  weightKg: string; setWeightKg(v: string): void;
  heightCm: string; setHeightCm(v: string): void;
  waistCm: string; setWaistCm(v: string): void;
  hipCm: string; setHipCm(v: string): void;
  muacCm: string; setMuacCm(v: string): void;

  anatomicalFindings: AnatomicalFinding[]; setAnatomicalFindings(v: AnatomicalFinding[]): void;
  rosFindings: Record<string, RosFinding>; setRosFindings(v: Record<string, RosFinding>): void;

  procedureData: Record<string, unknown>; setProcedureData(v: Record<string, unknown>): void;

  preVisitStatus: PreVisitStatus; setPreVisitStatus(v: PreVisitStatus): void;

  visitType: string; setVisitType(v: string): void;
  postOpDate: string; setPostOpDate(v: string): void;
  postOpReviewNum: number; setPostOpReviewNum(v: number): void;
  periopProcId: string; setPeriopProcId(v: string): void;
  whoProc: { procedureName: string; procedureDate: string; procedureTime: string; theatre: string; site: string; surgeon: string; anaesthetist: string; scrubNurse: string; circulatingNurse: string }; setWhoProc(v: (prev: { procedureName: string; procedureDate: string; procedureTime: string; theatre: string; site: string; surgeon: string; anaesthetist: string; scrubNurse: string; circulatingNurse: string }) => { procedureName: string; procedureDate: string; procedureTime: string; theatre: string; site: string; surgeon: string; anaesthetist: string; scrubNurse: string; circulatingNurse: string }): void;

  assessment: string; setAssessment(v: string): void;
  differentials: string; setDifferentials(v: string): void;
  plan: string; setPlan(v: string): void;
  followUpNotes: string; setFollowUpNotes(v: string): void;
  referralNotes: string; setReferralNotes(v: string): void;
  procedures: string; setProcedures(v: string): void;
  billing: string; setBilling(v: string): void;
  documents: string; setDocuments(v: string): void;
  surgicalClassifications: Record<string, string>; setSurgicalClassifications(v: Record<string, string>): void;

  insuranceProvider: string; setInsuranceProvider(v: string): void;
  policyNumber: string; setPolicyNumber(v: string): void;
  nhiNumber: string; setNhiNumber(v: string): void;
  preAuthStatus: string; setPreAuthStatus(v: string): void;

  triageResult: AdaptiveTriageResult;

  attachments: ClinicalAttachment[]; setAttachments(v: ClinicalAttachment[]): void;
  radiologyRequests: RadiologyRequest[]; setRadiologyRequests(v: RadiologyRequest[]): void;
  pendingPrescriptions: ProtocolMedication[]; setPendingPrescriptions(v: ProtocolMedication[]): void;
  finalDocument: string; setFinalDocument(v: string): void;
  progressNotes: ProgressNote[]; setProgressNotes(v: ProgressNote[]): void;
  vitalRecords: VitalRecord[]; setVitalRecords(v: VitalRecord[]): void;
  labRecords: LabRecord[]; setLabRecords(v: LabRecord[]): void;

  encounterMode: 'outpatient' | 'inpatient'; setEncounterMode(v: 'outpatient' | 'inpatient'): void;
  encounterType: EncounterType; setEncounterType(v: EncounterType): void;
  mrNumber: string; setMrNumber(v: string): void;
  ward: string; setWard(v: string): void;
  dateAdmission: string; setDateAdmission(v: string): void;
  dateDischarge: string; setDateDischarge(v: string): void;
  bloodGroup: string; setBloodGroup(v: string): void;
  nokName: string; setNokName(v: string): void;
  nokRelation: string; setNokRelation(v: string): void;
  nokTel: string; setNokTel(v: string): void;
  admittingSurgeon: string; setAdmittingSurgeon(v: string): void;
  referringPhysician: string; setReferringPhysician(v: string): void;

  /** PANE session persistence — survives tab navigation. */
  paneState: PaneState | null;
  setPaneState: React.Dispatch<React.SetStateAction<PaneState | null>>;
  paneTop: RankedDiagnosis[];
  setPaneTop: React.Dispatch<React.SetStateAction<RankedDiagnosis[]>>;
  paneConverged: boolean;
  setPaneConverged: React.Dispatch<React.SetStateAction<boolean>>;

  /** Trauma / Burns assessment data. */
  traumaData: TraumaData;
  setTraumaData: React.Dispatch<React.SetStateAction<TraumaData>>;

  /** Persistent problem list — survives encounters. */
  problems: PatientProblem[];
  addProblem(problem: Omit<PatientProblem, 'id'>): Promise<void>;
  updateProblemStatus(id: string, status: PatientProblem['status']): Promise<void>;
  deleteProblem(id: string): Promise<void>;

  /** Previous encounters for the loaded patient (excludes current encounter). */
  recentEncounters: EncounterSummary[];

  /** Wound assessments for current encounter. */
  wounds: WoundAssessment[];
  setWounds: React.Dispatch<React.SetStateAction<WoundAssessment[]>>;
  saveWound(wound: WoundAssessment): Promise<void>;
  removeWound(id: string): Promise<void>;

  /** Global save status for autosave operations. */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaveError: string | null;
  /** Durable sync outbox status (IndexedDB-backed). */
  syncStatus: SyncStatus;

  /** Active CC matrix ID — drives tab visibility and clinical pre-loading. */
  activeCcKey: string | null;
  setActiveCcKey(v: string | null): void;

  /** Structured numeric lab values extracted from referral letter or in-house results.
   *  Used to auto-populate clinical scoring tools (Tokyo, Ranson, BISAP, PEP risk). */
  extractedLabs: Record<string, number | null>;
  setExtractedLabs(v: Record<string, number | null>): void;
  updateExtractedLab(key: string, value: number | null): void;

  /** Per-encounter clinical scores — mirrors encounters.clinical_scores in DB. */
  clinicalScores: Record<string, unknown>;
  setClinicalScores(v: Record<string, unknown>): void;

  /** Summary snapshot of the patient's most recent closed encounter.
   *  Null when not a follow-up visit or not yet loaded.
   *  Read-only in the consultation — never overwritten by AI output. */
  priorEncounterSummary: PriorEncounterSummary | null;
  setPriorEncounterSummary(v: PriorEncounterSummary | null): void;
}

export interface PriorVitalSnapshot {
  sbp: number | null;
  dbp: number | null;
  hr: number | null;
  tempC: number | null;
  spo2: number | null;
  rr: number | null;
  weightKg: number | null;
  bmi: number | null;
}

export interface PriorEncounterSummary {
  encounterId: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string | null;
  assessment: string | null;
  plan: string | null;
  medications: string[];
  allergies: string;
  surgicalHistory: string[];
  vitals: PriorVitalSnapshot | null;
}

const AppContext = createContext<CtxValue | null>(null);

// Valid Section values derived from the type — used for URL param validation.
const VALID_SECTIONS: string[] = [
  'intake', 'brief', 'triage', 'hpi', 'pmh', 'surgical', 'medications',
  'allergies', 'family_hx', 'toxic', 'scales', 'ros', 'examination', 'investigations',
  'radiology', 'attachments', 'classifications',
  'assessment', 'plan', 'progress',
  'procedures', 'billing', 'documents',
  'monitoring', 'apcq', 'nurse_apcq',
  'prescriptions', 'ai_consultant', 'tasks',
  'referring_providers', 'encounter_history',
  'who_checklist', 'consent', 'letters', 'patient_education', 'periop', 'dosing',
  'fluid_nutrition', 'blood_gas', 'wounds',
];

function readTabFromUrl(): Section {
  try {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && VALID_SECTIONS.includes(tab)) return tab as Section;
  } catch { /* ignore */ }
  return 'intake';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  const [activeSection, _setActiveSection] = useState<Section>(readTabFromUrl);
  const [topSection, setTopSection] = useState<TopSection>(readNavFromStorage);

  const setActiveSection = useCallback((s: Section) => {
    _setActiveSection(s);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', s);
      window.history.replaceState(null, '', url.toString());
    } catch { /* ignore — may fail in iframe or restricted origin */ }
  }, []);

  // Restore activeSection from URL on browser back/forward navigation.
  useEffect(() => {
    const onPopState = () => {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab && VALID_SECTIONS.includes(tab)) _setActiveSection(tab as Section);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(NAV_STORAGE_KEY, topSection); } catch { /* ignore */ }
  }, [topSection]);

  // localStorage provides the fast initial value while the profile loads from DB.
  const [currentSite, _setCurrentSite] = useState<SiteCode>(readSiteFromStorage);
  const seededForUserRef  = useRef<string | null>(null); // tracks which userId we seeded
  const siteDebounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed currentSite from user_profiles.default_site once per sign-in.
  useEffect(() => {
    if (!profile?.id || !profile.default_site) return;
    if (seededForUserRef.current === profile.id) return; // already seeded for this user
    seededForUserRef.current = profile.id;
    _setCurrentSite(profile.default_site);
    try { localStorage.setItem(SITE_STORAGE_KEY, profile.default_site); } catch { _setSaveStatus('error'); _setLastSaveError('Storage quota exceeded — clear browser data'); }
  }, [profile]);

  function setCurrentSite(site: SiteCode) {
    _setCurrentSite(site);
    try { localStorage.setItem(SITE_STORAGE_KEY, site); } catch { _setSaveStatus('error'); _setLastSaveError('Storage quota exceeded — clear browser data'); }
    // Debounce write-back to user_profiles.default_site (explicit switch only).
    if (siteDebounceRef.current) clearTimeout(siteDebounceRef.current);
    siteDebounceRef.current = setTimeout(() => {
      if (!profile?.id) return;
      void updateDefaultSite(profile.id, site);
    }, 600);
  }

  const [patientId, setPatientId] = useState<string | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [encounterStatus, setEncounterStatus] = useState<string | null>(null);
  const [encounterClosedAt, setEncounterClosedAt] = useState<string | null>(null);

  // Patient-demographics facet — see anthropometrics facet above for the
  // pattern rationale. age/sex also feed the triageInput useMemo below via
  // the same destructured const names, and clearPatient() calls each
  // wrapper setter individually (across two non-adjacent lines) -- both
  // verified unaffected since every wrapper does a functional prev=>
  // update, so multiple calls in the same tick still compose correctly.
  const [demographics, setDemographics] = useState({
    patientName: '', age: '', sex: 'unknown' as Sex, dob: '', phone: '', email: '',
    address: '', quarter: '', referredBy: '',
  });
  const { patientName, age, sex, dob, phone, email, address, quarter, referredBy } = demographics;
  const setPatientName = useCallback((v: string) => setDemographics(prev => ({ ...prev, patientName: v })), []);
  const setAge         = useCallback((v: string) => setDemographics(prev => ({ ...prev, age: v })), []);
  const setSex         = useCallback((v: Sex) => setDemographics(prev => ({ ...prev, sex: v })), []);
  const setDob         = useCallback((v: string) => setDemographics(prev => ({ ...prev, dob: v })), []);
  const setPhone       = useCallback((v: string) => setDemographics(prev => ({ ...prev, phone: v })), []);
  const setEmail       = useCallback((v: string) => setDemographics(prev => ({ ...prev, email: v })), []);
  const setAddress     = useCallback((v: string) => setDemographics(prev => ({ ...prev, address: v })), []);
  const setQuarter     = useCallback((v: string) => setDemographics(prev => ({ ...prev, quarter: v })), []);
  const setReferredBy  = useCallback((v: string) => setDemographics(prev => ({ ...prev, referredBy: v })), []);
  const [patientPhoto, setPatientPhoto] = useState('');
  const [examPhotos, setExamPhotos] = useState<ExamPhoto[]>([]);

  const [durationDays, setDurationDays] = useState('');
  const [painScore, setPainScore] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomDetails, setSymptomDetails] = useState<Record<string, string[]>>({});
  const [freeText, setFreeText] = useState('');
  const [isPostOp, setIsPostOp] = useState(false);
  const [postOpDays, setPostOpDays] = useState('');
  const [pregnancyPossible, setPregnancyPossible] = useState(false);
  const [vitals, setVitals] = useState<VitalsState>({
    systolicBp: '', diastolicBp: '', heartRate: '', temperatureC: '', respiratoryRate: '', spo2: '', glucoseMmol: '',
  });

  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [pmhNotes, setPmhNotes] = useState('');
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [familyHistoryNotes, setFamilyHistoryNotes] = useState('');
  const [surgicalHistory, setSurgicalHistory] = useState<string[]>([]);
  const [surgicalNotes, setSurgicalNotes] = useState('');
  const [recentSurgeryDate, setRecentSurgeryDate] = useState('');
  const [medications, setMedications] = useState<string[]>([]);
  const [medicationsText, setMedicationsText] = useState('');
  const [allergies, setAllergies] = useState('');
  const [toxicHabits, setToxicHabits] = useState<string[]>([]);
  const [occupation, setOccupation] = useState('');
  const [hpiNotes, setHpiNotes] = useState('');

  // Examination-findings facet — see anthropometrics facet above for the
  // pattern rationale. Free-text findings per system; examFindings/examNotes
  // (structured records just below) are a separate, already-cohesive pair
  // left untouched.
  const [examFacet, setExamFacet] = useState({
    examGeneral: '', examCardio: '', examResp: '', examAbdomen: '',
    examNeuro: '', examExtremities: '', examBreast: '', examWound: '',
  });
  const {
    examGeneral, examCardio, examResp, examAbdomen,
    examNeuro, examExtremities, examBreast, examWound,
  } = examFacet;
  const setExamGeneral     = useCallback((v: string) => setExamFacet(prev => ({ ...prev, examGeneral: v })), []);
  const setExamCardio      = useCallback((v: string) => setExamFacet(prev => ({ ...prev, examCardio: v })), []);
  const setExamResp        = useCallback((v: string) => setExamFacet(prev => ({ ...prev, examResp: v })), []);
  const setExamAbdomen     = useCallback((v: string) => setExamFacet(prev => ({ ...prev, examAbdomen: v })), []);
  const setExamNeuro       = useCallback((v: string) => setExamFacet(prev => ({ ...prev, examNeuro: v })), []);
  const setExamExtremities = useCallback((v: string) => setExamFacet(prev => ({ ...prev, examExtremities: v })), []);
  const setExamBreast      = useCallback((v: string) => setExamFacet(prev => ({ ...prev, examBreast: v })), []);
  const setExamWound       = useCallback((v: string) => setExamFacet(prev => ({ ...prev, examWound: v })), []);
  const [examFindings, setExamFindings] = useState<Record<string, string[]>>({});
  const [examNotes, setExamNotes] = useState<Record<string, string>>({});

  // Investigations/results facet -- see anthropometrics facet above for the
  // pattern rationale. orderedInvestigations and radiologyRequests (the
  // latter previously declared far below, near unrelated fields -- moved
  // here since they must live in the same state object) are migration-
  // coupled at restore time: old sessions stored imaging test names inside
  // orderedInvestigations before the routing split, so the restore block
  // filters them out and converts them into radiologyRequests entries.
  // That migration logic (a few hundred lines below) calls setOrderedInvestigations
  // and setRadiologyRequests conditionally, sometimes both in the same tick --
  // verified safe since both wrappers use a functional prev=> update.
  // investigationResults (lab result values) is NOT part of this migration
  // and is left as its own independent field.
  const [investigationsFacet, setInvestigationsFacet] = useState<{
    orderedInvestigations: string[]; radiologyRequests: RadiologyRequest[];
  }>({ orderedInvestigations: [], radiologyRequests: [] });
  const { orderedInvestigations, radiologyRequests } = investigationsFacet;
  const setOrderedInvestigations = useCallback((v: string[]) => setInvestigationsFacet(prev => ({ ...prev, orderedInvestigations: v })), []);
  const setRadiologyRequests     = useCallback((v: RadiologyRequest[]) => setInvestigationsFacet(prev => ({ ...prev, radiologyRequests: v })), []);
  const [investigationResults, setInvestigationResults] = useState<Record<string, string>>({});
  const [icdCodes, setIcdCodes] = useState<string[]>([]);
  const [cptCodes, setCptCodes] = useState<string[]>([]);
  const [confirmedDiagnoses, setConfirmedDiagnoses] = useState<ActiveDiagnosis[]>([]);
  const [workingDiagnosis, setWorkingDiagnosis] = useState<WorkingDiagnosis | null>(null);

  // Anthropometrics facet — grouped in memory as one cohesive object rather than
  // five independent primitives; localStorage wire format is untouched (still
  // flat top-level keys via `data` below), so old saved sessions restore unchanged.
  const [anthropometrics, setAnthropometrics] = useState({
    weightKg: '', heightCm: '', waistCm: '', hipCm: '', muacCm: '',
  });
  const { weightKg, heightCm, waistCm, hipCm, muacCm } = anthropometrics;
  const setWeightKg = useCallback((v: string) => setAnthropometrics(prev => ({ ...prev, weightKg: v })), []);
  const setHeightCm = useCallback((v: string) => setAnthropometrics(prev => ({ ...prev, heightCm: v })), []);
  const setWaistCm  = useCallback((v: string) => setAnthropometrics(prev => ({ ...prev, waistCm: v })), []);
  const setHipCm    = useCallback((v: string) => setAnthropometrics(prev => ({ ...prev, hipCm: v })), []);
  const setMuacCm   = useCallback((v: string) => setAnthropometrics(prev => ({ ...prev, muacCm: v })), []);
  const [anatomicalFindings, setAnatomicalFindings] = useState<AnatomicalFinding[]>([]);
  const [rosFindings, setRosFindings] = useState<Record<string, RosFinding>>({});
  const [procedureData, setProcedureData] = useState<Record<string, unknown>>({});
  const [preVisitStatus, setPreVisitStatus] = useState<PreVisitStatus>('new');
  const [visitType, setVisitType] = useState('');
  const [postOpDate, setPostOpDate] = useState('');
  const [postOpReviewNum, setPostOpReviewNum] = useState(1);
  const [periopProcId, setPeriopProcId] = useState('');
  const [whoProc, setWhoProc] = useState({ procedureName: '', procedureDate: '', procedureTime: '', theatre: '', site: '', surgeon: 'Dr Dawit Daniel Kabiye', anaesthetist: '', scrubNurse: '', circulatingNurse: '' });

  // Assessment/plan facet — see anthropometrics facet above for the pattern
  // rationale. More entangled than the earlier facets: assessment/differentials/
  // plan feed two real Supabase autosave effects (saveAssessment/savePlan,
  // both the debounced effect and the page-hide flush effect) and a separate
  // 700ms-debounced scoreDiagnosis(assessment) effect -- all three read these
  // via the same destructured const names below, verified before editing.
  // The restore block's history-preamble-stripping logic for `assessment`
  // (a few lines above/below this) is also untouched -- it still calls
  // setAssessment(cleaned) through the wrapper unchanged.
  const [assessmentPlan, setAssessmentPlan] = useState({
    assessment: '', differentials: '', plan: '', followUpNotes: '', referralNotes: '',
  });
  const { assessment, differentials, plan, followUpNotes, referralNotes } = assessmentPlan;
  const setAssessment    = useCallback((v: string) => setAssessmentPlan(prev => ({ ...prev, assessment: v })), []);
  const setDifferentials = useCallback((v: string) => setAssessmentPlan(prev => ({ ...prev, differentials: v })), []);
  const setPlan          = useCallback((v: string) => setAssessmentPlan(prev => ({ ...prev, plan: v })), []);
  const setFollowUpNotes = useCallback((v: string) => setAssessmentPlan(prev => ({ ...prev, followUpNotes: v })), []);
  const setReferralNotes = useCallback((v: string) => setAssessmentPlan(prev => ({ ...prev, referralNotes: v })), []);
  const [procedures, setProcedures] = useState('');
  const [billing, setBilling] = useState('');
  const [documents, setDocuments] = useState('');
  const [surgicalClassifications, setSurgicalClassifications] = useState<Record<string, string>>({});
  // Insurance/billing-admin facet — see anthropometrics facet above for the
  // pattern rationale (grouped in memory only; localStorage wire format and
  // external CtxValue shape both untouched).
  const [insuranceAdmin, setInsuranceAdmin] = useState({
    insuranceProvider: '', policyNumber: '', nhiNumber: '', preAuthStatus: '',
  });
  const { insuranceProvider, policyNumber, nhiNumber, preAuthStatus } = insuranceAdmin;
  const setInsuranceProvider = useCallback((v: string) => setInsuranceAdmin(prev => ({ ...prev, insuranceProvider: v })), []);
  const setPolicyNumber      = useCallback((v: string) => setInsuranceAdmin(prev => ({ ...prev, policyNumber: v })), []);
  const setNhiNumber         = useCallback((v: string) => setInsuranceAdmin(prev => ({ ...prev, nhiNumber: v })), []);
  const setPreAuthStatus     = useCallback((v: string) => setInsuranceAdmin(prev => ({ ...prev, preAuthStatus: v })), []);

  const [attachments, setAttachments] = useState<ClinicalAttachment[]>([]);
  const [pendingPrescriptions, setPendingPrescriptions] = useState<ProtocolMedication[]>([]);
  const [finalDocument, setFinalDocument] = useState('');
  const [progressNotes, setProgressNotes] = useState<ProgressNote[]>([]);
  const [vitalRecords, setVitalRecords] = useState<VitalRecord[]>([]);
  const [labRecords, setLabRecords] = useState<LabRecord[]>([]);

  const [encounterMode, setEncounterMode] = useState<'outpatient' | 'inpatient'>('outpatient');
  const [encounterType, setEncounterType] = useState<EncounterType>('surgical_consult');
  // Inpatient/ward-admin facet — see anthropometrics facet above for the
  // pattern rationale (grouped in memory only; localStorage wire format,
  // the debounced saveInpatientDetails() autosave effect, and the
  // page-hide flush effect all read these via the same destructured
  // names below, so none of them need to change).
  const [inpatientAdmin, setInpatientAdmin] = useState({
    mrNumber: '', ward: '', dateAdmission: '', dateDischarge: '', bloodGroup: '',
    nokName: '', nokRelation: '', nokTel: '',
    admittingSurgeon: 'Dr Dawit Daniel Kabiye, MD, DM', referringPhysician: '',
  });
  const {
    mrNumber, ward, dateAdmission, dateDischarge, bloodGroup,
    nokName, nokRelation, nokTel, admittingSurgeon, referringPhysician,
  } = inpatientAdmin;
  const setMrNumber            = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, mrNumber: v })), []);
  const setWard                = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, ward: v })), []);
  const setDateAdmission       = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, dateAdmission: v })), []);
  const setDateDischarge       = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, dateDischarge: v })), []);
  const setBloodGroup          = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, bloodGroup: v })), []);
  const setNokName             = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, nokName: v })), []);
  const setNokRelation         = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, nokRelation: v })), []);
  const setNokTel              = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, nokTel: v })), []);
  const setAdmittingSurgeon    = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, admittingSurgeon: v })), []);
  const setReferringPhysician  = useCallback((v: string) => setInpatientAdmin(prev => ({ ...prev, referringPhysician: v })), []);

  const [paneState, setPaneState] = useState<PaneState | null>(null);
  const [paneTop, setPaneTop] = useState<RankedDiagnosis[]>([]);
  const [paneConverged, setPaneConverged] = useState(false);
  const [traumaData, setTraumaData] = useState<TraumaData>(EMPTY_TRAUMA_DATA);
  const [activeCcKey, setActiveCcKey] = useState<string | null>(null);

  const [problems, setProblems] = useState<PatientProblem[]>([]);
  const [recentEncounters, setRecentEncounters] = useState<EncounterSummary[]>([]);
  const [wounds, setWounds] = useState<WoundAssessment[]>([]);
  const [extractedLabs, setExtractedLabs] = useState<Record<string, number | null>>({});
  const [clinicalScores, setClinicalScores] = useState<Record<string, unknown>>({});
  const [priorEncounterSummary, setPriorEncounterSummary] = useState<PriorEncounterSummary | null>(null);

  // ── Global save status tracking ───────────────────────────────────────────
  const [saveStatus, _setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaveError, _setLastSaveError] = useState<string | null>(null);
  const pendingSaves = useRef(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveEpoch = useRef(0);
  // Sync status from the IndexedDB outbox (surfaced to the sync indicator)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  const trackedSave = useCallback(async <T,>(
    fn: () => Promise<T>,
    /**
     * Serializable descriptor for this save. When provided, a failure
     * enqueues the payload to the IndexedDB outbox (sync-outbox.ts) so it
     * survives a page reload or browser close, not just a same-session
     * retry — the matching executor in sync-executors.ts replays it when
     * the outbox flushes on reconnect. Closures (fn) can't be serialized,
     * which is why this is a separate plain-object parameter rather than
     * derived from fn itself.
     */
    descriptor?: { entityType: string; entityId: string; payload: Record<string, unknown> },
  ): Promise<T | undefined> => {
    const epoch = saveEpoch.current;
    pendingSaves.current++;
    _setSaveStatus('saving');
    try {
      const result = await fn();
      // Many save helpers resolve normally with an { error } field instead of
      // throwing — without this check a failed write (bad grant, missing
      // table, RLS denial) would still report "saved" here.
      if (result && typeof result === 'object' && 'error' in result && (result as { error: unknown }).error) {
        throw new Error(String((result as { error: unknown }).error));
      }
      if (saveEpoch.current !== epoch) return undefined;
      pendingSaves.current--;
      if (pendingSaves.current === 0) {
        _setSaveStatus('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => _setSaveStatus('idle'), 2000);
      }
      return result;
    } catch (err) {
      pendingSaves.current--;
      _setSaveStatus('error');
      const msg = err instanceof Error ? err.message : 'Save failed';
      _setLastSaveError(msg);
      console.error('[autosave] error:', err);
      // Queue on any failure, not just navigator.onLine === false —
      // navigator.onLine only reflects whether a network interface is up,
      // not whether the backend is actually reachable (e.g. a captive
      // portal or DNS failure still reports online), so gating on it missed
      // the most common real-world offline failure mode.
      if (descriptor) {
        setSyncStatus('pending');
        void enqueue(descriptor.entityType, descriptor.entityId, descriptor.payload)
          .catch(e => console.error('[autosave] enqueue failed:', e));
      }
      return undefined;
    }
  }, []);

  // Flush the IndexedDB outbox when the browser regains connectivity.
  // We keep direct closure retry for in-session closures (faster), and the
  // outbox handles cross-session durability for registered entity types.
  useEffect(() => {
    const handleOnline = () => {
      void flush((status, count) => {
        setSyncStatus(status);
        if (count === 0) _setSaveStatus('saved');
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const ENC_KEY = 'amise-enc-v1';
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENC_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (!d.patientName && !(Array.isArray(d.symptoms) && (d.symptoms as string[]).length > 0)) return;
      if (d.vitals && typeof d.vitals === 'object') setVitals(d.vitals as VitalsState);
      if (Array.isArray(d.symptoms)) setSymptoms(d.symptoms as string[]);
      if (d.symptomDetails && typeof d.symptomDetails === 'object') setSymptomDetails(d.symptomDetails as Record<string, string[]>);
      if (typeof d.freeText === 'string') setFreeText(d.freeText);
      if (typeof d.durationDays === 'string') setDurationDays(d.durationDays);
      if (typeof d.painScore === 'string') setPainScore(d.painScore);
      if (typeof d.isPostOp === 'boolean') setIsPostOp(d.isPostOp);
      if (typeof d.postOpDays === 'string') setPostOpDays(d.postOpDays);
      if (typeof d.pregnancyPossible === 'boolean') setPregnancyPossible(d.pregnancyPossible);
      if (typeof d.examGeneral === 'string') setExamGeneral(d.examGeneral);
      if (typeof d.examCardio === 'string') setExamCardio(d.examCardio);
      if (typeof d.examResp === 'string') setExamResp(d.examResp);
      if (typeof d.examAbdomen === 'string') setExamAbdomen(d.examAbdomen);
      if (typeof d.examNeuro === 'string') setExamNeuro(d.examNeuro);
      if (typeof d.examExtremities === 'string') setExamExtremities(d.examExtremities);
      if (typeof d.examBreast === 'string') setExamBreast(d.examBreast);
      if (typeof d.examWound === 'string') setExamWound(d.examWound);
      if (typeof d.assessment === 'string') {
        // Strip history preamble that may have been stored by older code versions
        const raw = d.assessment;
        let cleaned = raw;
        if (/^(Presenting History|Past Medical History|Surgical History|Medications?|Allergies?|History)\s*:/i.test(raw.trim())) {
          const wdIdx = raw.search(/Working Diagnosis:|Clinical Impression:|Impression:|Assessment\s*:/i);
          cleaned = wdIdx > 0 ? raw.slice(wdIdx).trim() : '';
        } else {
          const wdIdx = raw.search(/Working Diagnosis:|Clinical Impression:|Impression:|Assessment\s*:/i);
          if (wdIdx > 10) cleaned = raw.slice(wdIdx).trim();
        }
        setAssessment(cleaned);
      }
      if (typeof d.differentials === 'string') setDifferentials(d.differentials);
      if (typeof d.plan === 'string') setPlan(d.plan);
      if (typeof d.followUpNotes === 'string') setFollowUpNotes(d.followUpNotes);
      if (typeof d.referralNotes === 'string') setReferralNotes(d.referralNotes);
      if (typeof d.procedures === 'string') setProcedures(d.procedures);
      if (typeof d.billing === 'string') setBilling(d.billing);
      if (typeof d.documents === 'string') setDocuments(d.documents);
      if (typeof d.insuranceProvider === 'string') setInsuranceProvider(d.insuranceProvider);
      if (typeof d.policyNumber === 'string') setPolicyNumber(d.policyNumber);
      if (typeof d.nhiNumber === 'string') setNhiNumber(d.nhiNumber);
      if (typeof d.preAuthStatus === 'string') setPreAuthStatus(d.preAuthStatus);
      if (Array.isArray(d.comorbidities)) setComorbidities(d.comorbidities as string[]);
      if (typeof d.pmhNotes === 'string') setPmhNotes(d.pmhNotes);
      if (Array.isArray(d.surgicalHistory)) setSurgicalHistory(d.surgicalHistory as string[]);
      if (typeof d.surgicalNotes === 'string') setSurgicalNotes(d.surgicalNotes);
      if (typeof d.recentSurgeryDate === 'string') setRecentSurgeryDate(d.recentSurgeryDate);
      if (Array.isArray(d.medications)) setMedications(d.medications as string[]);
      if (typeof d.medicationsText === 'string') setMedicationsText(d.medicationsText);
      if (typeof d.allergies === 'string') setAllergies(d.allergies);
      if (Array.isArray(d.pendingPrescriptions)) setPendingPrescriptions(d.pendingPrescriptions as ProtocolMedication[]);
      if (Array.isArray(d.familyHistory)) setFamilyHistory(d.familyHistory as string[]);
      if (typeof d.familyHistoryNotes === 'string') setFamilyHistoryNotes(d.familyHistoryNotes as string);
      if (Array.isArray(d.toxicHabits)) setToxicHabits(d.toxicHabits as string[]);
      if (typeof d.occupation === 'string') setOccupation(d.occupation);
      if (typeof d.hpiNotes === 'string') setHpiNotes(d.hpiNotes);
      if (typeof d.patientName === 'string') setPatientName(d.patientName);
      if (typeof d.age === 'string') setAge(d.age);
      if (typeof d.sex === 'string') setSex(d.sex as Sex);
      if (typeof d.dob === 'string') setDob(d.dob);
      if (typeof d.phone === 'string') setPhone(d.phone);
      if (typeof d.email === 'string') setEmail(d.email);
      if (typeof d.address === 'string') setAddress(d.address);
      if (typeof d.quarter === 'string') setQuarter(d.quarter);
      if (typeof d.referredBy === 'string') setReferredBy(d.referredBy);
      if (d.examFindings && typeof d.examFindings === 'object') setExamFindings(d.examFindings as Record<string, string[]>);
      if (d.examNotes && typeof d.examNotes === 'object') setExamNotes(d.examNotes as Record<string, string>);
      // Load orderedInvestigations + radiologyRequests together so any imaging items
      // that were stored in orderedInvestigations (from sessions before the routing split)
      // are immediately migrated to radiologyRequests at load time.
      {
        const savedOrdered = Array.isArray(d.orderedInvestigations) && (d.orderedInvestigations as unknown[]).length > 0
          ? (d.orderedInvestigations as string[])
          : null;
        const savedRadiology: RadiologyRequest[] = Array.isArray(d.radiologyRequests)
          ? (d.radiologyRequests as RadiologyRequest[])
          : [];
        if (savedOrdered) {
          const imagingInLabs = savedOrdered.filter(t => isImagingInvestigation(t));
          const labsOnly      = savedOrdered.filter(t => !isImagingInvestigation(t));
          if (labsOnly.length > 0) setOrderedInvestigations(labsOnly);
          if (imagingInLabs.length > 0) {
            const migrated = imagingInLabs
              .map(label => parseImagingToRequest(label, 'routine') as unknown as RadiologyRequest)
              .filter(req => !imagingAlreadyRequested(savedRadiology, req));
            setRadiologyRequests([...migrated, ...savedRadiology]);
          } else if (savedRadiology.length > 0) {
            setRadiologyRequests(savedRadiology);
          }
        } else if (savedRadiology.length > 0) {
          setRadiologyRequests(savedRadiology);
        }
      }
      if (d.investigationResults && typeof d.investigationResults === 'object') setInvestigationResults(d.investigationResults as Record<string, string>);
      if (Array.isArray(d.icdCodes)) setIcdCodes(d.icdCodes as string[]);
      if (Array.isArray(d.cptCodes)) setCptCodes(d.cptCodes as string[]);
      if (d.surgicalClassifications && typeof d.surgicalClassifications === 'object') setSurgicalClassifications(d.surgicalClassifications as Record<string, string>);
      if (typeof d.weightKg === 'string') setWeightKg(d.weightKg);
      if (typeof d.heightCm === 'string') setHeightCm(d.heightCm);
      if (typeof d.waistCm === 'string') setWaistCm(d.waistCm);
      if (typeof d.hipCm === 'string') setHipCm(d.hipCm);
      if (typeof d.muacCm === 'string') setMuacCm(d.muacCm);
      if (Array.isArray(d.anatomicalFindings)) setAnatomicalFindings(d.anatomicalFindings as AnatomicalFinding[]);
      if (d.rosFindings && typeof d.rosFindings === 'object') setRosFindings(d.rosFindings as Record<string, RosFinding>);
      if (d.procedureData && typeof d.procedureData === 'object') setProcedureData(d.procedureData as Record<string, unknown>);
      if (d.preVisitStatus === 'registered' || d.preVisitStatus === 'vitals_done') setPreVisitStatus(d.preVisitStatus);
      // radiologyRequests is loaded inside the orderedInvestigations migration block above
      if (typeof d.finalDocument === 'string') setFinalDocument(d.finalDocument);
      if (Array.isArray(d.progressNotes)) setProgressNotes(d.progressNotes as ProgressNote[]);
      if (Array.isArray(d.vitalRecords)) setVitalRecords(d.vitalRecords as VitalRecord[]);
      if (Array.isArray(d.labRecords)) setLabRecords(d.labRecords as LabRecord[]);
      if (d.extractedLabs && typeof d.extractedLabs === 'object') setExtractedLabs(d.extractedLabs as Record<string, number | null>);
      if (d.clinicalScores && typeof d.clinicalScores === 'object') setClinicalScores(d.clinicalScores as Record<string, unknown>);
      if (d.encounterMode === 'inpatient') setEncounterMode('inpatient');
      if (d.encounterType === 'quick_consult' || d.encounterType === 'endoscopy' || d.encounterType === 'office_procedure' || d.encounterType === 'major_emergency') setEncounterType(d.encounterType as EncounterType);
      if (typeof d.mrNumber === 'string') setMrNumber(d.mrNumber);
      if (typeof d.ward === 'string') setWard(d.ward);
      if (typeof d.dateAdmission === 'string') setDateAdmission(d.dateAdmission);
      if (typeof d.dateDischarge === 'string') setDateDischarge(d.dateDischarge);
      if (typeof d.bloodGroup === 'string') setBloodGroup(d.bloodGroup);
      if (typeof d.nokName === 'string') setNokName(d.nokName);
      if (typeof d.nokRelation === 'string') setNokRelation(d.nokRelation);
      if (typeof d.nokTel === 'string') setNokTel(d.nokTel);
      if (typeof d.admittingSurgeon === 'string') setAdmittingSurgeon(d.admittingSurgeon);
      if (typeof d.referringPhysician === 'string') setReferringPhysician(d.referringPhysician);
      if (d.paneState && typeof d.paneState === 'object') setPaneState(d.paneState as PaneState);
      if (d.traumaData && typeof d.traumaData === 'object') setTraumaData(d.traumaData as TraumaData);
      if (d.workingDiagnosis && typeof d.workingDiagnosis === 'object') setWorkingDiagnosis(d.workingDiagnosis as WorkingDiagnosis);
      if (Array.isArray(d.confirmedDiagnoses)) setConfirmedDiagnoses(d.confirmedDiagnoses as ActiveDiagnosis[]);
      // Restore patient/encounter IDs so autosave hooks can re-connect to Supabase
      if (typeof d.patientId === 'string') {
        setPatientId(d.patientId);
        if (typeof d.encounterId === 'string') {
          setEncounterId(d.encounterId);
          // Background-validate encounter is still open; clear if not
          if (supabase) {
            void supabase
              .from('encounters')
              .select('status')
              .eq('id', d.encounterId)
              .maybeSingle()
              .then(({ data }) => {
                if (!data || (data.status !== 'open' && data.status !== 'in_progress')) {
                  setEncounterId(null);
                }
              });
          }
        }
      }
      // Large blobs stored separately (can be large base64)
      try {
        const ar = localStorage.getItem('amise-attachments-v1');
        if (ar) setAttachments(JSON.parse(ar) as ClinicalAttachment[]);
      } catch { /* ignore */ }
      try {
        const pp = localStorage.getItem('amise-patient-photo-v1');
        if (pp) setPatientPhoto(pp);
      } catch { /* ignore */ }
      try {
        const ep = localStorage.getItem('amise-exam-photos-v1');
        if (ep) setExamPhotos(JSON.parse(ep) as ExamPhoto[]);
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback((data: Record<string, unknown>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try { localStorage.setItem(ENC_KEY, JSON.stringify(data)); } catch { _setSaveStatus('error'); _setLastSaveError('Storage quota exceeded — clear browser data'); }
    }, 500);
  }, []);

  useEffect(() => {
    scheduleSave({
      vitals, symptoms, symptomDetails, freeText, durationDays, painScore,
      isPostOp, postOpDays, pregnancyPossible,
      examGeneral, examCardio, examResp, examAbdomen, examNeuro, examExtremities, examBreast, examWound,
      examFindings, examNotes,
      assessment, differentials, plan, followUpNotes, referralNotes, procedures, billing, documents, surgicalClassifications,
      insuranceProvider, policyNumber, nhiNumber, preAuthStatus,
      comorbidities, pmhNotes, surgicalHistory, surgicalNotes, recentSurgeryDate,
      medications, medicationsText, allergies, familyHistory, familyHistoryNotes, toxicHabits, occupation, hpiNotes,
      pendingPrescriptions,
      patientId, encounterId,
      patientName, age, sex, dob, phone, email, address, quarter, referredBy,
      orderedInvestigations, investigationResults, icdCodes, cptCodes,
      weightKg, heightCm, waistCm, hipCm, muacCm, anatomicalFindings, rosFindings, procedureData, preVisitStatus,
      radiologyRequests, finalDocument, progressNotes, vitalRecords, labRecords,
      encounterMode, encounterType, mrNumber, ward, dateAdmission, dateDischarge, bloodGroup,
      nokName, nokRelation, nokTel, admittingSurgeon, referringPhysician,
      workingDiagnosis, confirmedDiagnoses,
      paneState, traumaData,
      extractedLabs, clinicalScores,
    });
    // Large blobs saved separately — avoids 5 MB localStorage limit on the main key
    try { localStorage.setItem('amise-attachments-v1', JSON.stringify(attachments)); } catch { _setSaveStatus('error'); _setLastSaveError('Storage quota exceeded — clear browser data'); }
    try { localStorage.setItem('amise-patient-photo-v1', patientPhoto); } catch { _setSaveStatus('error'); _setLastSaveError('Storage quota exceeded — clear browser data'); }
    try { localStorage.setItem('amise-exam-photos-v1', JSON.stringify(examPhotos)); } catch { _setSaveStatus('error'); _setLastSaveError('Storage quota exceeded — clear browser data'); }
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [scheduleSave, vitals, symptoms, symptomDetails, freeText, durationDays, painScore,
    isPostOp, postOpDays, pregnancyPossible,
    examGeneral, examCardio, examResp, examAbdomen, examNeuro, examExtremities, examBreast, examWound,
    examFindings, examNotes,
    assessment, differentials, plan, followUpNotes, referralNotes, procedures, billing, documents, surgicalClassifications,
    insuranceProvider, policyNumber, nhiNumber, preAuthStatus,
    comorbidities, pmhNotes, surgicalHistory, surgicalNotes, recentSurgeryDate,
    medications, medicationsText, allergies, familyHistory, familyHistoryNotes, toxicHabits, occupation, hpiNotes,
    pendingPrescriptions,
    patientId, encounterId,
    patientName, age, sex, dob, phone, email, address, quarter, referredBy,
    orderedInvestigations, investigationResults, icdCodes, cptCodes,
    weightKg, heightCm, waistCm, hipCm, muacCm, anatomicalFindings, rosFindings, procedureData, preVisitStatus,
    radiologyRequests, finalDocument, progressNotes, vitalRecords, labRecords, attachments,
    encounterMode, encounterType, mrNumber, ward, dateAdmission, dateDischarge, bloodGroup,
    nokName, nokRelation, nokTel, admittingSurgeon, referringPhysician, paneState, traumaData,
    workingDiagnosis, confirmedDiagnoses,
    extractedLabs, clinicalScores,
    patientPhoto, examPhotos]);

  function toggleSymptom(v: string) { setSymptoms(c => toggleList(c, v)); }
  function toggleSymptomDetail(sym: string, opt: string) {
    setSymptomDetails(c => {
      const cur = c[sym] || [];
      return { ...c, [sym]: toggleList(cur, opt) };
    });
  }
  function updateVital(k: keyof VitalSigns, v: string) { setVitals(c => ({ ...c, [k]: v })); }
  function toggleComorbidity(v: string) { setComorbidities(c => toggleList(c, v)); }
  function toggleFamilyHistory(v: string) { setFamilyHistory(c => toggleList(c, v)); }
  function toggleSurgical(v: string) { setSurgicalHistory(c => toggleList(c, v)); }
  function toggleMedication(v: string) { setMedications(c => toggleList(c, v)); }
  function toggleToxicHabit(v: string) { setToxicHabits(c => toggleList(c, v)); }
  function updateExtractedLab(key: string, value: number | null) {
    setExtractedLabs(c => ({ ...c, [key]: value }));
  }

  // ── Timer refs for autosave debouncing (hoisted so clearPatient can cancel them) ─
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allergyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const examTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surgicalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toxicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rosTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const procedureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const traumaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hpiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pmhTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const investigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const encounterTypeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inpatientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clinicalScoresTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPatient() {
    // Invalidate in-flight saves and cancel all debounce timers
    saveEpoch.current++;
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    if (allergyTimerRef.current) { clearTimeout(allergyTimerRef.current); allergyTimerRef.current = null; }
    if (examTimerRef.current) { clearTimeout(examTimerRef.current); examTimerRef.current = null; }
    if (surgicalTimerRef.current) { clearTimeout(surgicalTimerRef.current); surgicalTimerRef.current = null; }
    if (toxicTimerRef.current) { clearTimeout(toxicTimerRef.current); toxicTimerRef.current = null; }
    if (rosTimerRef.current) { clearTimeout(rosTimerRef.current); rosTimerRef.current = null; }
    if (procedureTimerRef.current) { clearTimeout(procedureTimerRef.current); procedureTimerRef.current = null; }
    if (traumaTimerRef.current) { clearTimeout(traumaTimerRef.current); traumaTimerRef.current = null; }
    if (hpiTimerRef.current) { clearTimeout(hpiTimerRef.current); hpiTimerRef.current = null; }
    if (pmhTimerRef.current) { clearTimeout(pmhTimerRef.current); pmhTimerRef.current = null; }
    if (investigationTimerRef.current) { clearTimeout(investigationTimerRef.current); investigationTimerRef.current = null; }
    if (encounterTypeTimerRef.current) { clearTimeout(encounterTypeTimerRef.current); encounterTypeTimerRef.current = null; }
    if (inpatientTimerRef.current) { clearTimeout(inpatientTimerRef.current); inpatientTimerRef.current = null; }
    if (clinicalScoresTimerRef.current) { clearTimeout(clinicalScoresTimerRef.current); clinicalScoresTimerRef.current = null; }
    setPatientId(null); setEncounterId(null); setEncounterStatus(null); setEncounterClosedAt(null);
    setPatientName(''); setAge(''); setSex('unknown'); setDob(''); setPhone(''); setEmail(''); setPatientPhoto(''); setExamPhotos([]);
    setDurationDays(''); setPainScore(''); setSymptoms([]); setSymptomDetails({});
    setFreeText(''); setIsPostOp(false); setPostOpDays(''); setPregnancyPossible(false);
    setVitals({ systolicBp: '', diastolicBp: '', heartRate: '', temperatureC: '', respiratoryRate: '', spo2: '', glucoseMmol: '' });
    setComorbidities([]); setPmhNotes(''); setFamilyHistory([]); setFamilyHistoryNotes('');
    setSurgicalHistory([]); setSurgicalNotes(''); setRecentSurgeryDate(''); setMedications([]); setMedicationsText('');
    setAllergies(''); setToxicHabits([]); setOccupation(''); setHpiNotes('');
    setExamGeneral(''); setExamCardio(''); setExamResp(''); setExamAbdomen('');
    setExamNeuro(''); setExamExtremities(''); setExamBreast(''); setExamWound('');
    setExamFindings({}); setExamNotes({});
    setOrderedInvestigations([]); setInvestigationResults({}); setIcdCodes([]); setCptCodes([]);
    setAddress(''); setQuarter(''); setReferredBy('');
    setWeightKg(''); setHeightCm(''); setWaistCm(''); setHipCm(''); setMuacCm(''); setAnatomicalFindings([]);
    setRosFindings({}); setProcedureData({}); setPreVisitStatus('new');
    setVisitType(''); setPostOpDate(''); setPostOpReviewNum(1);
    setPeriopProcId(''); setWhoProc({ procedureName: '', procedureDate: '', procedureTime: '', theatre: '', site: '', surgeon: 'Dr Dawit Daniel Kabiye', anaesthetist: '', scrubNurse: '', circulatingNurse: '' });
    setAssessment(''); setDifferentials(''); setPlan(''); setFollowUpNotes(''); setReferralNotes('');
    setConfirmedDiagnoses([]);
    setWorkingDiagnosis(null);
    setProcedures(''); setBilling(''); setDocuments(''); setSurgicalClassifications({});
    setInsuranceProvider(''); setPolicyNumber(''); setNhiNumber(''); setPreAuthStatus('');
    setAttachments([]); setRadiologyRequests([]); setFinalDocument('');
    setProgressNotes([]);
    setVitalRecords([]); setLabRecords([]);
    setEncounterMode('outpatient');
    setEncounterType('surgical_consult');
    setMrNumber(''); setWard(''); setDateAdmission(''); setDateDischarge('');
    setBloodGroup(''); setNokName(''); setNokRelation(''); setNokTel('');
    setAdmittingSurgeon('Dr Dawit Daniel Kabiye, MD, DM'); setReferringPhysician('');
    setPaneState(null); setPaneTop([]); setPaneConverged(false);
    setTraumaData(EMPTY_TRAUMA_DATA);
    setActiveCcKey(null);
    setProblems([]);
    setWounds([]);
    setExtractedLabs({});
    setClinicalScores({});
    setPriorEncounterSummary(null);
    try {
      localStorage.removeItem(ENC_KEY);
      localStorage.removeItem('amise-attachments-v1');
      localStorage.removeItem('amise-patient-photo-v1');
      localStorage.removeItem('amise-exam-photos-v1');
    } catch { /* ignore */ }
  }

  const triageInput: AdaptiveTriageInput = useMemo(() => ({
    age: toNum(age),
    sex,
    symptoms,
    symptomDetails,
    freeText,
    comorbidities,
    surgicalHistory,
    medications: [...medications, ...csv(medicationsText)],
    allergies: csv(allergies),
    toxicHabits,
    vitalSigns: {
      systolicBp: toNum(vitals.systolicBp),
      diastolicBp: toNum(vitals.diastolicBp),
      heartRate: toNum(vitals.heartRate),
      temperatureC: toNum(vitals.temperatureC),
      respiratoryRate: toNum(vitals.respiratoryRate),
      spo2: toNum(vitals.spo2),
      glucoseMmol: toNum(vitals.glucoseMmol),
    },
    durationDays: toNum(durationDays),
    painScore: toNum(painScore),
    isPostOp,
    postOpDays: toNum(postOpDays),
    pregnancyPossible,
  }), [age, sex, symptoms, symptomDetails, freeText, comorbidities, surgicalHistory, medications, medicationsText, allergies, toxicHabits, vitals, durationDays, painScore, isPostOp, postOpDays, pregnancyPossible]);

  const triageResult = useMemo(() => adaptiveTriage(triageInput), [triageInput]);

  // ── Load problem list whenever patient changes ────────────────────────────
  useEffect(() => {
    if (!patientId) { setProblems([]); return; }
    void loadPatientProblems(patientId).then(setProblems);
  }, [patientId]);

  // ── Load recent encounters whenever patient changes ───────────────────────
  useEffect(() => {
    if (!patientId) { setRecentEncounters([]); return; }
    void listPatientEncounters(patientId).then(setRecentEncounters);
  }, [patientId]);

  // ── Load wound assessments whenever encounter changes ─────────────────────
  useEffect(() => {
    if (!patientId || !encounterId) { setWounds([]); return; }
    void loadWoundAssessments(patientId, encounterId).then(setWounds);
  }, [patientId, encounterId]);

  // ── Autosave doctor clinical data to Supabase (debounced 2 s) ────────────
  useEffect(() => {
    if (!patientId || !encounterId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void trackedSave(() => saveAssessment({
        encounter_id:  encounterId,
        patient_id:    patientId,
        diagnosis:     assessment,
        differentials,
        icdCodes,
        cptCodes,
        acuity:        triageResult.acuity,
        triageScore:   triageResult.score,
      }), { entityType: 'assessment', entityId: encounterId, payload: {
        encounter_id: encounterId, patient_id: patientId, diagnosis: assessment,
        differentials, icdCodes, cptCodes,
        acuity: triageResult.acuity, triageScore: triageResult.score,
      } });
      void trackedSave(() => savePlan({ encounter_id: encounterId, patient_id: patientId, description: plan }),
        { entityType: 'plan', entityId: encounterId, payload: { encounter_id: encounterId, patient_id: patientId, description: plan } });
      void trackedSave(() => syncMedicationList(patientId, encounterId, medications, medicationsText),
        { entityType: 'medications', entityId: encounterId, payload: { patientId, encounterId, chipMeds: medications, freeText: medicationsText } });
    }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, assessment, differentials, icdCodes, cptCodes, plan, triageResult.acuity, triageResult.score, medications, medicationsText]);

  // ── Autosave allergies (debounced 3 s — patient-level, no encounter needed) ─
  useEffect(() => {
    if (!patientId || !allergies) return;
    if (allergyTimerRef.current) clearTimeout(allergyTimerRef.current);
    allergyTimerRef.current = setTimeout(() => {
      const allergenList = allergies.split(',').map(s => s.trim()).filter(Boolean);
      if (allergenList.length) void trackedSave(() => syncAllergyList(patientId, allergenList),
        { entityType: 'allergies', entityId: patientId, payload: { patientId, allergens: allergenList } });
    }, 3000);
    return () => { if (allergyTimerRef.current) clearTimeout(allergyTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, allergies]);

  // ── Autosave examination findings (debounced 3 s) ─────────────────────────
  useEffect(() => {
    if (!patientId || !encounterId) return;
    if (examTimerRef.current) clearTimeout(examTimerRef.current);
    examTimerRef.current = setTimeout(() => {
      void trackedSave(() => saveExamFindings(examFindings, examNotes, patientId, encounterId),
        { entityType: 'exam_findings', entityId: encounterId, payload: { examFindings, examNotes, patientId, encounterId } });
    }, 3000);
    return () => { if (examTimerRef.current) clearTimeout(examTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, examFindings, examNotes]);

  // ── Autosave surgical history (patient-level, debounced 3 s) ───────────────
  useEffect(() => {
    if (!patientId) return;
    if (surgicalTimerRef.current) clearTimeout(surgicalTimerRef.current);
    surgicalTimerRef.current = setTimeout(() => {
      void trackedSave(() => syncSurgicalHistory(patientId, surgicalHistory, surgicalNotes, recentSurgeryDate),
        { entityType: 'surgical_history', entityId: patientId, payload: { patientId, procedures: surgicalHistory, notes: surgicalNotes, recentSurgeryDate } });
    }, 3000);
    return () => { if (surgicalTimerRef.current) clearTimeout(surgicalTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, surgicalHistory, surgicalNotes, recentSurgeryDate]);

  // ── Autosave toxic habits (patient-level, debounced 3 s) ───────────────────
  useEffect(() => {
    if (!patientId || !toxicHabits.length) return;
    if (toxicTimerRef.current) clearTimeout(toxicTimerRef.current);
    toxicTimerRef.current = setTimeout(() => {
      void trackedSave(() => syncToxicHabits(patientId, toxicHabits),
        { entityType: 'toxic_habits', entityId: patientId, payload: { patientId, habits: toxicHabits } });
    }, 3000);
    return () => { if (toxicTimerRef.current) clearTimeout(toxicTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, toxicHabits]);

  // ── Autosave ROS findings (encounter-level, debounced 3 s) ────────────────
  useEffect(() => {
    if (!patientId || !encounterId) return;
    const hasFinding = Object.values(rosFindings).some(f => f.status !== 'not-asked' || f.details.length > 0 || f.notes);
    if (!hasFinding) return;
    if (rosTimerRef.current) clearTimeout(rosTimerRef.current);
    rosTimerRef.current = setTimeout(() => {
      void trackedSave(() => syncRosFindings(patientId, encounterId, rosFindings),
        { entityType: 'ros_findings', entityId: encounterId, payload: { patientId, encounterId, rosFindings } });
    }, 3000);
    return () => { if (rosTimerRef.current) clearTimeout(rosTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, rosFindings]);

  // ── Autosave procedure data (encounter-level, debounced 3 s) ──────────────
  useEffect(() => {
    if (!patientId || !encounterId) return;
    const hasData = Object.values(procedureData).some(v => v && typeof v === 'object' && Object.keys(v as object).length > 0);
    if (!hasData) return;
    if (procedureTimerRef.current) clearTimeout(procedureTimerRef.current);
    procedureTimerRef.current = setTimeout(() => {
      void trackedSave(() => syncProcedureData(patientId, encounterId, procedureData),
        { entityType: 'procedure_data', entityId: encounterId, payload: { patientId, encounterId, procedureData } });
    }, 3000);
    return () => { if (procedureTimerRef.current) clearTimeout(procedureTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, procedureData]);

  // ── Autosave trauma data (encounter-level, debounced 3 s) ─────────────────
  useEffect(() => {
    if (!patientId || !encounterId) return;
    if (traumaTimerRef.current) clearTimeout(traumaTimerRef.current);
    traumaTimerRef.current = setTimeout(() => {
      void trackedSave(() => syncTraumaRecord(patientId, encounterId, traumaData),
        { entityType: 'trauma_record', entityId: encounterId, payload: { patientId, encounterId, traumaData } });
    }, 3000);
    return () => { if (traumaTimerRef.current) clearTimeout(traumaTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, traumaData]);

  // ── Autosave HPI notes (encounter-level, debounced 3 s) ──────────────────
  // hpiSavedRef tracks whether a non-empty HPI was saved this session, so clearing
  // the field triggers a DB delete rather than a no-op.
  const hpiSavedRef = useRef(false);
  useEffect(() => { hpiSavedRef.current = false; }, [encounterId]);
  useEffect(() => {
    if (!patientId || !encounterId) return;
    if (hpiTimerRef.current) clearTimeout(hpiTimerRef.current);
    if (!hpiNotes.trim()) {
      if (!hpiSavedRef.current) return;
      hpiTimerRef.current = setTimeout(() => {
        hpiTimerRef.current = null;
        hpiSavedRef.current = false;
        void trackedSave(() => clearHpiNote(encounterId),
          { entityType: 'hpi_note_clear', entityId: encounterId, payload: { encounterId } });
      }, 3000);
    } else {
      hpiTimerRef.current = setTimeout(() => {
        hpiTimerRef.current = null;
        hpiSavedRef.current = true;
        void trackedSave(() => saveHpiNote(encounterId, patientId, hpiNotes),
          { entityType: 'hpi_note', entityId: encounterId, payload: { encounterId, patientId, hpiNotes } });
      }, 3000);
    }
    return () => { if (hpiTimerRef.current) clearTimeout(hpiTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, hpiNotes]);

  // ── Autosave PMH + family history notes (patient-level, debounced 3 s) ──
  useEffect(() => {
    if (!patientId || (!pmhNotes && !familyHistoryNotes)) return;
    if (pmhTimerRef.current) clearTimeout(pmhTimerRef.current);
    pmhTimerRef.current = setTimeout(() => {
      pmhTimerRef.current = null;
      void trackedSave(() => savePmhNotes(patientId, pmhNotes, familyHistoryNotes),
        { entityType: 'pmh_notes', entityId: patientId, payload: { patientId, pmhNotes, familyHistoryNotes } });
    }, 3000);
    return () => { if (pmhTimerRef.current) clearTimeout(pmhTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, pmhNotes, familyHistoryNotes]);

  // ── Autosave investigation orders (encounter-level, debounced 3 s) ───────
  useEffect(() => {
    if (!patientId || !encounterId) return;
    if (investigationTimerRef.current) clearTimeout(investigationTimerRef.current);
    investigationTimerRef.current = setTimeout(() => {
      investigationTimerRef.current = null;
      void trackedSave(() => syncInvestigationOrders(encounterId, patientId, orderedInvestigations),
        { entityType: 'investigation_orders', entityId: encounterId, payload: { encounterId, patientId, orderedInvestigations } });
    }, 3000);
    return () => { if (investigationTimerRef.current) clearTimeout(investigationTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, orderedInvestigations]);

  // ── Sync encounter_type to DB when consultation type changes ──────────────
  useEffect(() => {
    if (!encounterId) return;
    if (encounterTypeTimerRef.current) clearTimeout(encounterTypeTimerRef.current);
    encounterTypeTimerRef.current = setTimeout(() => {
      encounterTypeTimerRef.current = null;
      void trackedSave(() => updateEncounterType(encounterId, toDbEncounterType(encounterType, encounterMode)),
        { entityType: 'encounter_type', entityId: encounterId, payload: { encounterId, dbType: toDbEncounterType(encounterType, encounterMode) } });
    }, 2000);
    return () => { if (encounterTypeTimerRef.current) clearTimeout(encounterTypeTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, encounterType, encounterMode]);

  // ── Autosave inpatient admission details (encounter-level, debounced 3 s) ──
  useEffect(() => {
    if (!patientId || !encounterId) return;
    if (!ward && !dateAdmission && !dateDischarge && !nokName) return;
    if (inpatientTimerRef.current) clearTimeout(inpatientTimerRef.current);
    inpatientTimerRef.current = setTimeout(() => {
      inpatientTimerRef.current = null;
      void trackedSave(() => saveInpatientDetails(encounterId, patientId, {
        ward, dateAdmission, dateDischarge, admittingSurgeon,
        referringPhysician, nokName, nokRelation, nokTel, bloodGroup, mrNumber,
      }), { entityType: 'inpatient_details', entityId: encounterId, payload: { encounterId, patientId, data: {
        ward, dateAdmission, dateDischarge, admittingSurgeon,
        referringPhysician, nokName, nokRelation, nokTel, bloodGroup, mrNumber,
      } } });
    }, 3000);
    return () => { if (inpatientTimerRef.current) clearTimeout(inpatientTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, ward, dateAdmission, dateDischarge, admittingSurgeon,
    referringPhysician, nokName, nokRelation, nokTel, bloodGroup, mrNumber]);

  // ── Autosave clinical scores + extracted labs (encounter-level, debounced 3 s) ─
  useEffect(() => {
    if (!encounterId) return;
    const hasScores = Object.keys(clinicalScores).length > 0;
    const hasLabs   = Object.keys(extractedLabs).some(k => extractedLabs[k] !== null);
    if (!hasScores && !hasLabs) return;
    if (clinicalScoresTimerRef.current) clearTimeout(clinicalScoresTimerRef.current);
    clinicalScoresTimerRef.current = setTimeout(() => {
      clinicalScoresTimerRef.current = null;
      void trackedSave(() => saveClinicalScores(encounterId, clinicalScores, extractedLabs),
        { entityType: 'clinical_scores', entityId: encounterId, payload: { encounterId, clinicalScores, extractedLabs } });
    }, 3000);
    return () => { if (clinicalScoresTimerRef.current) clearTimeout(clinicalScoresTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, clinicalScores, extractedLabs]);

  // ── Flush pending debounced saves on page close / hide ──────────────────
  const flushPendingSaves = useCallback(() => {
    if (autoSaveTimerRef.current && patientId && encounterId) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
      void trackedSave(() => saveAssessment({
        encounter_id: encounterId, patient_id: patientId,
        diagnosis: assessment, differentials, icdCodes, cptCodes,
        acuity: triageResult.acuity, triageScore: triageResult.score,
      }), { entityType: 'assessment', entityId: encounterId, payload: {
        encounter_id: encounterId, patient_id: patientId, diagnosis: assessment,
        differentials, icdCodes, cptCodes,
        acuity: triageResult.acuity, triageScore: triageResult.score,
      } });
      void trackedSave(() => savePlan({ encounter_id: encounterId, patient_id: patientId, description: plan }),
        { entityType: 'plan', entityId: encounterId, payload: { encounter_id: encounterId, patient_id: patientId, description: plan } });
      void trackedSave(() => syncMedicationList(patientId, encounterId, medications, medicationsText),
        { entityType: 'medications', entityId: encounterId, payload: { patientId, encounterId, chipMeds: medications, freeText: medicationsText } });
    }
    if (allergyTimerRef.current && patientId) {
      clearTimeout(allergyTimerRef.current);
      allergyTimerRef.current = null;
      const allergenList = allergies.split(',').map(s => s.trim()).filter(Boolean);
      if (allergenList.length) void trackedSave(() => syncAllergyList(patientId, allergenList),
        { entityType: 'allergies', entityId: patientId, payload: { patientId, allergens: allergenList } });
    }
    if (examTimerRef.current && patientId && encounterId) {
      clearTimeout(examTimerRef.current);
      examTimerRef.current = null;
      void trackedSave(() => saveExamFindings(examFindings, examNotes, patientId, encounterId),
        { entityType: 'exam_findings', entityId: encounterId, payload: { examFindings, examNotes, patientId, encounterId } });
    }
    if (surgicalTimerRef.current && patientId) {
      clearTimeout(surgicalTimerRef.current);
      surgicalTimerRef.current = null;
      void trackedSave(() => syncSurgicalHistory(patientId, surgicalHistory, surgicalNotes, recentSurgeryDate),
        { entityType: 'surgical_history', entityId: patientId, payload: { patientId, procedures: surgicalHistory, notes: surgicalNotes, recentSurgeryDate } });
    }
    if (toxicTimerRef.current && patientId) {
      clearTimeout(toxicTimerRef.current);
      toxicTimerRef.current = null;
      void trackedSave(() => syncToxicHabits(patientId, toxicHabits),
        { entityType: 'toxic_habits', entityId: patientId, payload: { patientId, habits: toxicHabits } });
    }
    if (rosTimerRef.current && patientId && encounterId) {
      clearTimeout(rosTimerRef.current);
      rosTimerRef.current = null;
      void trackedSave(() => syncRosFindings(patientId, encounterId, rosFindings),
        { entityType: 'ros_findings', entityId: encounterId, payload: { patientId, encounterId, rosFindings } });
    }
    if (procedureTimerRef.current && patientId && encounterId) {
      clearTimeout(procedureTimerRef.current);
      procedureTimerRef.current = null;
      void trackedSave(() => syncProcedureData(patientId, encounterId, procedureData),
        { entityType: 'procedure_data', entityId: encounterId, payload: { patientId, encounterId, procedureData } });
    }
    if (traumaTimerRef.current && patientId && encounterId) {
      clearTimeout(traumaTimerRef.current);
      traumaTimerRef.current = null;
      void trackedSave(() => syncTraumaRecord(patientId, encounterId, traumaData),
        { entityType: 'trauma_record', entityId: encounterId, payload: { patientId, encounterId, traumaData } });
    }
    if (hpiTimerRef.current && patientId && encounterId) {
      clearTimeout(hpiTimerRef.current);
      hpiTimerRef.current = null;
      void trackedSave(() => saveHpiNote(encounterId, patientId, hpiNotes),
        { entityType: 'hpi_note', entityId: encounterId, payload: { encounterId, patientId, hpiNotes } });
    }
    if (pmhTimerRef.current && patientId) {
      clearTimeout(pmhTimerRef.current);
      pmhTimerRef.current = null;
      void trackedSave(() => savePmhNotes(patientId, pmhNotes, familyHistoryNotes),
        { entityType: 'pmh_notes', entityId: patientId, payload: { patientId, pmhNotes, familyHistoryNotes } });
    }
    if (investigationTimerRef.current && patientId && encounterId) {
      clearTimeout(investigationTimerRef.current);
      investigationTimerRef.current = null;
      void trackedSave(() => syncInvestigationOrders(encounterId, patientId, orderedInvestigations),
        { entityType: 'investigation_orders', entityId: encounterId, payload: { encounterId, patientId, orderedInvestigations } });
    }
    if (encounterTypeTimerRef.current && encounterId) {
      clearTimeout(encounterTypeTimerRef.current);
      encounterTypeTimerRef.current = null;
      void trackedSave(() => updateEncounterType(encounterId, toDbEncounterType(encounterType, encounterMode)),
        { entityType: 'encounter_type', entityId: encounterId, payload: { encounterId, dbType: toDbEncounterType(encounterType, encounterMode) } });
    }
    if (inpatientTimerRef.current && patientId && encounterId) {
      clearTimeout(inpatientTimerRef.current);
      inpatientTimerRef.current = null;
      void trackedSave(() => saveInpatientDetails(encounterId, patientId, {
        ward, dateAdmission, dateDischarge, admittingSurgeon,
        referringPhysician, nokName, nokRelation, nokTel, bloodGroup, mrNumber,
      }), { entityType: 'inpatient_details', entityId: encounterId, payload: { encounterId, patientId, data: {
        ward, dateAdmission, dateDischarge, admittingSurgeon,
        referringPhysician, nokName, nokRelation, nokTel, bloodGroup, mrNumber,
      } } });
    }
    if (clinicalScoresTimerRef.current && encounterId) {
      clearTimeout(clinicalScoresTimerRef.current);
      clinicalScoresTimerRef.current = null;
      void trackedSave(() => saveClinicalScores(encounterId, clinicalScores, extractedLabs),
        { entityType: 'clinical_scores', entityId: encounterId, payload: { encounterId, clinicalScores, extractedLabs } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, assessment, differentials, icdCodes, cptCodes, plan,
    triageResult.acuity, triageResult.score, medications, medicationsText,
    allergies, examFindings, examNotes, surgicalHistory, surgicalNotes,
    toxicHabits, rosFindings, procedureData, traumaData,
    hpiNotes, pmhNotes, familyHistoryNotes, orderedInvestigations, encounterType, encounterMode,
    ward, dateAdmission, dateDischarge, admittingSurgeon, referringPhysician,
    nokName, nokRelation, nokTel, bloodGroup, mrNumber,
    clinicalScores, extractedLabs,
    trackedSave]);

  // Stable ref so event handlers always see the latest flush function
  const flushRef = useRef(flushPendingSaves);
  useEffect(() => { flushRef.current = flushPendingSaves; }, [flushPendingSaves]);

  // Track whether any debounce timer is pending (for beforeunload confirmation)
  const hasPendingTimers = useCallback(() =>
    !!(autoSaveTimerRef.current || allergyTimerRef.current || examTimerRef.current ||
       surgicalTimerRef.current || toxicTimerRef.current || rosTimerRef.current ||
       procedureTimerRef.current || traumaTimerRef.current ||
       hpiTimerRef.current || pmhTimerRef.current || investigationTimerRef.current ||
       encounterTypeTimerRef.current || inpatientTimerRef.current ||
       clinicalScoresTimerRef.current), []);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      flushRef.current();
      if (pendingSaves.current > 0 || hasPendingTimers()) {
        e.preventDefault();
      }
    }
    function handlePageHide() {
      flushRef.current();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flushRef.current();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasPendingTimers]);

  // ── Bayesian diagnosis-to-procedure autofill ──────────────────────────────
  // Refs let the effect read latest values without adding them as dependencies
  // (prevents infinite loops when the effect itself writes those values).
  const _visitTypeRef = useRef(visitType);
  _visitTypeRef.current = visitType;
  const _periopProcIdRef = useRef(periopProcId);
  _periopProcIdRef.current = periopProcId;
  const _whoProcRef = useRef(whoProc);
  _whoProcRef.current = whoProc;

  useEffect(() => {
    const t = setTimeout(() => {
      const sug = scoreDiagnosis(assessment);
      if (!sug) return;
      if (!_periopProcIdRef.current) setPeriopProcId(sug.procId);
      if (!_whoProcRef.current.procedureName) setWhoProc(prev => ({ ...prev, procedureName: sug.procedureName }));
      if (!_visitTypeRef.current) {
        setVisitType(sug.visitTypeId);
        setEncounterType(sug.encounterType);
      }
    }, 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment]);

  const value: CtxValue = {
    activeSection, setActiveSection,
    topSection, setTopSection,
    currentSite, setCurrentSite,
    patientId, setPatientId,
    encounterId, setEncounterId,
    encounterStatus, setEncounterStatus,
    encounterClosedAt, setEncounterClosedAt,
    patientName, setPatientName,
    age, setAge,
    sex, setSex,
    dob, setDob,
    phone, setPhone,
    email, setEmail,
    address, setAddress,
    quarter, setQuarter,
    referredBy, setReferredBy,
    patientPhoto, setPatientPhoto,
    examPhotos, setExamPhotos,
    durationDays, setDurationDays,
    painScore, setPainScore,
    symptoms, toggleSymptom,
    symptomDetails, toggleSymptomDetail,
    freeText, setFreeText,
    isPostOp, setIsPostOp,
    postOpDays, setPostOpDays,
    pregnancyPossible, setPregnancyPossible,
    vitals, updateVital,
    comorbidities, toggleComorbidity, setComorbidities,
    pmhNotes, setPmhNotes,
    familyHistory, toggleFamilyHistory,
    familyHistoryNotes, setFamilyHistoryNotes,
    surgicalHistory, setSurgicalHistory, toggleSurgical,
    surgicalNotes, setSurgicalNotes,
    recentSurgeryDate, setRecentSurgeryDate,
    medications, toggleMedication, setMedications,
    medicationsText, setMedicationsText,
    allergies, setAllergies,
    toxicHabits, setToxicHabits, toggleToxicHabit,
    occupation, setOccupation,
    hpiNotes, setHpiNotes,
    clearPatient,
    examGeneral, setExamGeneral,
    examCardio, setExamCardio,
    examResp, setExamResp,
    examAbdomen, setExamAbdomen,
    examNeuro, setExamNeuro,
    examExtremities, setExamExtremities,
    examBreast, setExamBreast,
    examWound, setExamWound,
    examFindings, setExamFindings,
    examNotes, setExamNotes,
    orderedInvestigations, setOrderedInvestigations,
    investigationResults, setInvestigationResults,
    icdCodes, setIcdCodes,
    cptCodes, setCptCodes,
    confirmedDiagnoses, setConfirmedDiagnoses,
    workingDiagnosis, setWorkingDiagnosis,
    assessment, setAssessment,
    differentials, setDifferentials,
    plan, setPlan,
    followUpNotes, setFollowUpNotes,
    referralNotes, setReferralNotes,
    procedures, setProcedures,
    billing, setBilling,
    documents, setDocuments,
    surgicalClassifications, setSurgicalClassifications,
    insuranceProvider, setInsuranceProvider,
    policyNumber, setPolicyNumber,
    nhiNumber, setNhiNumber,
    preAuthStatus, setPreAuthStatus,
    weightKg, setWeightKg,
    heightCm, setHeightCm,
    waistCm, setWaistCm,
    hipCm, setHipCm,
    muacCm, setMuacCm,
    anatomicalFindings, setAnatomicalFindings,
    rosFindings, setRosFindings,
    procedureData, setProcedureData,
    preVisitStatus, setPreVisitStatus,
    visitType, setVisitType,
    postOpDate, setPostOpDate,
    postOpReviewNum, setPostOpReviewNum,
    periopProcId, setPeriopProcId,
    whoProc, setWhoProc,
    triageResult,
    attachments, setAttachments,
    radiologyRequests, setRadiologyRequests,
    pendingPrescriptions, setPendingPrescriptions,
    finalDocument, setFinalDocument,
    progressNotes, setProgressNotes,
    vitalRecords, setVitalRecords,
    labRecords, setLabRecords,
    encounterMode, setEncounterMode,
    encounterType, setEncounterType,
    mrNumber, setMrNumber,
    ward, setWard,
    dateAdmission, setDateAdmission,
    dateDischarge, setDateDischarge,
    bloodGroup, setBloodGroup,
    nokName, setNokName,
    nokRelation, setNokRelation,
    nokTel, setNokTel,
    admittingSurgeon, setAdmittingSurgeon,
    referringPhysician, setReferringPhysician,
    paneState, setPaneState,
    paneTop, setPaneTop,
    paneConverged, setPaneConverged,
    traumaData, setTraumaData,
    problems,
    recentEncounters,
    addProblem: async (problem) => {
      const tmp: PatientProblem = { ...problem, id: `tmp-${Date.now()}` };
      setProblems(prev => [...prev, tmp]);
      if (!patientId) return;
      const { id, error } = await savePatientProblem(patientId, problem);
      if (id) {
        setProblems(prev => prev.map(p => p.id === tmp.id ? { ...p, id } : p));
      } else if (error) {
        setProblems(prev => prev.filter(p => p.id !== tmp.id));
        console.error('[problems] save error:', error);
      }
    },
    updateProblemStatus: async (id, status) => {
      setProblems(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      const { error } = await updatePatientProblemStatus(id, status);
      if (error) console.error('[problems] update error:', error);
    },
    deleteProblem: async (id) => {
      setProblems(prev => prev.filter(p => p.id !== id));
      const { error } = await removePatientProblem(id);
      if (error) console.error('[problems] delete error:', error);
    },
    wounds,
    setWounds,
    saveWound: async (wound) => {
      if (!patientId) return;
      const { id, error } = await saveWoundAssessment(patientId, encounterId, wound);
      if (error) { console.error('[wounds] save error:', error); return; }
      if (id && wound.id.startsWith('tmp-')) {
        setWounds(prev => prev.map(w => w.id === wound.id ? { ...w, id } : w));
      }
    },
    removeWound: async (id) => {
      setWounds(prev => prev.filter(w => w.id !== id));
      if (!id.startsWith('tmp-')) {
        const { error } = await deleteWoundAssessment(id);
        if (error) console.error('[wounds] delete error:', error);
      }
    },
    saveStatus,
    lastSaveError,
    syncStatus,
    activeCcKey,
    setActiveCcKey,
    extractedLabs, setExtractedLabs, updateExtractedLab,
    clinicalScores, setClinicalScores,
    priorEncounterSummary, setPriorEncounterSummary,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): CtxValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be inside AppProvider');
  return ctx;
}
