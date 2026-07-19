import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { adaptiveTriage, AdaptiveTriageInput, AdaptiveTriageResult, Sex, VitalSigns } from '@workspace/triage-engine';
import { type SiteCode } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { updateDefaultSite, saveAssessment, savePlan, syncAllergyList, syncMedicationList, saveExamFindings, syncSurgicalHistory, syncToxicHabits, syncRosFindings, syncProcedureData, syncTraumaRecord, loadPatientProblems, savePatientProblem, updatePatientProblemStatus, removePatientProblem, type PatientProblem, loadWoundAssessments, saveWoundAssessment, deleteWoundAssessment, emptyWound, type WoundAssessment, savePmhNotes, saveHpiNote, clearHpiNote, syncInvestigationOrders, updateEncounterType, toDbEncounterType } from '@/lib/db';
import type { PaneState, RankedDiagnosis } from '@workspace/pane-engine';

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
  | 'who_checklist' | 'consent' | 'letters' | 'patient_education' | 'periop' | 'dosing' | 'fluid_nutrition' | 'blood_gas' | 'wounds';

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

export type TopSection =
  | 'dashboard' | 'patients' | 'checkin' | 'doc_scan' | 'intake' | 'consultation'
  | 'procedures' | 'scheduling' | 'billing' | 'analytics' | 'settings' | 'summary' | 'finaldoc' | 'inpatient'
  | 'trauma' | 'vademecum' | 'questionnaire' | 'booking_inbox' | 'calls_queue' | 'portal_intake' | 'referring_providers'
  | 'visit_lifecycle' | 'prescriptions' | 'ai_consultant' | 'tasks'
  | 'quality' | 'results_inbox' | 'followup_tracker';

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
  'followup_tracker',
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

  /** Wound assessments for current encounter. */
  wounds: WoundAssessment[];
  setWounds: React.Dispatch<React.SetStateAction<WoundAssessment[]>>;
  saveWound(wound: WoundAssessment): Promise<void>;
  removeWound(id: string): Promise<void>;

  /** Global save status for autosave operations. */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaveError: string | null;

  /** Active CC matrix ID — drives tab visibility and clinical pre-loading. */
  activeCcKey: string | null;
  setActiveCcKey(v: string | null): void;
}

const AppContext = createContext<CtxValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  const [activeSection, setActiveSection] = useState<Section>('intake');
  const [topSection, setTopSection] = useState<TopSection>(readNavFromStorage);

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

  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('unknown');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [quarter, setQuarter] = useState('');
  const [referredBy, setReferredBy] = useState('');
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
  const [medications, setMedications] = useState<string[]>([]);
  const [medicationsText, setMedicationsText] = useState('');
  const [allergies, setAllergies] = useState('');
  const [toxicHabits, setToxicHabits] = useState<string[]>([]);
  const [occupation, setOccupation] = useState('');
  const [hpiNotes, setHpiNotes] = useState('');

  const [examGeneral, setExamGeneral] = useState('');
  const [examCardio, setExamCardio] = useState('');
  const [examResp, setExamResp] = useState('');
  const [examAbdomen, setExamAbdomen] = useState('');
  const [examNeuro, setExamNeuro] = useState('');
  const [examExtremities, setExamExtremities] = useState('');
  const [examBreast, setExamBreast] = useState('');
  const [examWound, setExamWound] = useState('');
  const [examFindings, setExamFindings] = useState<Record<string, string[]>>({});
  const [examNotes, setExamNotes] = useState<Record<string, string>>({});

  const [orderedInvestigations, setOrderedInvestigations] = useState<string[]>([]);
  const [investigationResults, setInvestigationResults] = useState<Record<string, string>>({});
  const [icdCodes, setIcdCodes] = useState<string[]>([]);
  const [cptCodes, setCptCodes] = useState<string[]>([]);

  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [muacCm, setMuacCm] = useState('');
  const [anatomicalFindings, setAnatomicalFindings] = useState<AnatomicalFinding[]>([]);
  const [rosFindings, setRosFindings] = useState<Record<string, RosFinding>>({});
  const [procedureData, setProcedureData] = useState<Record<string, unknown>>({});
  const [preVisitStatus, setPreVisitStatus] = useState<PreVisitStatus>('new');
  const [visitType, setVisitType] = useState('');
  const [postOpDate, setPostOpDate] = useState('');
  const [postOpReviewNum, setPostOpReviewNum] = useState(1);

  const [assessment, setAssessment] = useState('');
  const [differentials, setDifferentials] = useState('');
  const [plan, setPlan] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [referralNotes, setReferralNotes] = useState('');
  const [procedures, setProcedures] = useState('');
  const [billing, setBilling] = useState('');
  const [documents, setDocuments] = useState('');
  const [surgicalClassifications, setSurgicalClassifications] = useState<Record<string, string>>({});
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [nhiNumber, setNhiNumber] = useState('');
  const [preAuthStatus, setPreAuthStatus] = useState('');

  const [attachments, setAttachments] = useState<ClinicalAttachment[]>([]);
  const [radiologyRequests, setRadiologyRequests] = useState<RadiologyRequest[]>([]);
  const [finalDocument, setFinalDocument] = useState('');
  const [progressNotes, setProgressNotes] = useState<ProgressNote[]>([]);
  const [vitalRecords, setVitalRecords] = useState<VitalRecord[]>([]);
  const [labRecords, setLabRecords] = useState<LabRecord[]>([]);

  const [encounterMode, setEncounterMode] = useState<'outpatient' | 'inpatient'>('outpatient');
  const [encounterType, setEncounterType] = useState<EncounterType>('surgical_consult');
  const [mrNumber, setMrNumber] = useState('');
  const [ward, setWard] = useState('');
  const [dateAdmission, setDateAdmission] = useState('');
  const [dateDischarge, setDateDischarge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [nokName, setNokName] = useState('');
  const [nokRelation, setNokRelation] = useState('');
  const [nokTel, setNokTel] = useState('');
  const [admittingSurgeon, setAdmittingSurgeon] = useState('Dr Dawit Daniel Kabiye, MD, DM');
  const [referringPhysician, setReferringPhysician] = useState('');

  const [paneState, setPaneState] = useState<PaneState | null>(null);
  const [paneTop, setPaneTop] = useState<RankedDiagnosis[]>([]);
  const [paneConverged, setPaneConverged] = useState(false);
  const [traumaData, setTraumaData] = useState<TraumaData>(EMPTY_TRAUMA_DATA);
  const [activeCcKey, setActiveCcKey] = useState<string | null>(null);

  const [problems, setProblems] = useState<PatientProblem[]>([]);
  const [wounds, setWounds] = useState<WoundAssessment[]>([]);

  // ── Global save status tracking ───────────────────────────────────────────
  const [saveStatus, _setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaveError, _setLastSaveError] = useState<string | null>(null);
  const pendingSaves = useRef(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveEpoch = useRef(0);

  const trackedSave = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    const epoch = saveEpoch.current;
    pendingSaves.current++;
    _setSaveStatus('saving');
    try {
      const result = await fn();
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
      _setLastSaveError(err instanceof Error ? err.message : 'Save failed');
      console.error('[autosave] error:', err);
      return undefined;
    }
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
      if (typeof d.assessment === 'string') setAssessment(d.assessment);
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
      if (Array.isArray(d.medications)) setMedications(d.medications as string[]);
      if (typeof d.medicationsText === 'string') setMedicationsText(d.medicationsText);
      if (typeof d.allergies === 'string') setAllergies(d.allergies);
      if (Array.isArray(d.familyHistory)) setFamilyHistory(d.familyHistory as string[]);
      if (Array.isArray(d.toxicHabits)) setToxicHabits(d.toxicHabits as string[]);
      if (typeof d.occupation === 'string') setOccupation(d.occupation);
      if (typeof d.hpiNotes === 'string') setHpiNotes(d.hpiNotes);
      if (typeof d.patientName === 'string') setPatientName(d.patientName);
      if (typeof d.age === 'string') setAge(d.age);
      if (typeof d.sex === 'string') setSex(d.sex as Sex);
      if (typeof d.dob === 'string') setDob(d.dob);
      if (typeof d.phone === 'string') setPhone(d.phone);
      if (typeof d.address === 'string') setAddress(d.address);
      if (typeof d.quarter === 'string') setQuarter(d.quarter);
      if (typeof d.referredBy === 'string') setReferredBy(d.referredBy);
      if (typeof d.patientPhoto === 'string') setPatientPhoto(d.patientPhoto);
      if (Array.isArray(d.examPhotos)) setExamPhotos(d.examPhotos as ExamPhoto[]);
      if (d.examFindings && typeof d.examFindings === 'object') setExamFindings(d.examFindings as Record<string, string[]>);
      if (d.examNotes && typeof d.examNotes === 'object') setExamNotes(d.examNotes as Record<string, string>);
      if (Array.isArray(d.orderedInvestigations)) setOrderedInvestigations(d.orderedInvestigations as string[]);
      if (d.investigationResults && typeof d.investigationResults === 'object') setInvestigationResults(d.investigationResults as Record<string, string>);
      if (Array.isArray(d.icdCodes)) setIcdCodes(d.icdCodes as string[]);
      if (Array.isArray(d.cptCodes)) setCptCodes(d.cptCodes as string[]);
      if (typeof d.weightKg === 'string') setWeightKg(d.weightKg);
      if (typeof d.heightCm === 'string') setHeightCm(d.heightCm);
      if (typeof d.waistCm === 'string') setWaistCm(d.waistCm);
      if (typeof d.hipCm === 'string') setHipCm(d.hipCm);
      if (typeof d.muacCm === 'string') setMuacCm(d.muacCm);
      if (Array.isArray(d.anatomicalFindings)) setAnatomicalFindings(d.anatomicalFindings as AnatomicalFinding[]);
      if (d.rosFindings && typeof d.rosFindings === 'object') setRosFindings(d.rosFindings as Record<string, RosFinding>);
      if (d.procedureData && typeof d.procedureData === 'object') setProcedureData(d.procedureData as Record<string, unknown>);
      if (d.preVisitStatus === 'registered' || d.preVisitStatus === 'vitals_done') setPreVisitStatus(d.preVisitStatus);
      if (Array.isArray(d.radiologyRequests)) setRadiologyRequests(d.radiologyRequests as RadiologyRequest[]);
      if (typeof d.finalDocument === 'string') setFinalDocument(d.finalDocument);
      if (Array.isArray(d.progressNotes)) setProgressNotes(d.progressNotes as ProgressNote[]);
      if (Array.isArray(d.vitalRecords)) setVitalRecords(d.vitalRecords as VitalRecord[]);
      if (Array.isArray(d.labRecords)) setLabRecords(d.labRecords as LabRecord[]);
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
      assessment, differentials, plan, followUpNotes, referralNotes, procedures, billing, documents,
      insuranceProvider, policyNumber, nhiNumber, preAuthStatus,
      comorbidities, pmhNotes, surgicalHistory, surgicalNotes,
      medications, medicationsText, allergies, familyHistory, familyHistoryNotes, toxicHabits, occupation, hpiNotes,
      patientName, age, sex, dob, phone, address, quarter, referredBy,
      orderedInvestigations, investigationResults, icdCodes, cptCodes,
      weightKg, heightCm, waistCm, hipCm, muacCm, anatomicalFindings, rosFindings, procedureData, preVisitStatus,
      radiologyRequests, finalDocument, progressNotes, vitalRecords, labRecords,
      encounterMode, encounterType, mrNumber, ward, dateAdmission, dateDischarge, bloodGroup,
      nokName, nokRelation, nokTel, admittingSurgeon, referringPhysician,
      paneState, traumaData,
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
    assessment, differentials, plan, followUpNotes, referralNotes, procedures, billing, documents,
    insuranceProvider, policyNumber, nhiNumber, preAuthStatus,
    comorbidities, pmhNotes, surgicalHistory, surgicalNotes,
    medications, medicationsText, allergies, familyHistory, familyHistoryNotes, toxicHabits, occupation, hpiNotes,
    patientName, age, sex, dob, phone, address, quarter, referredBy,
    orderedInvestigations, investigationResults, icdCodes, cptCodes,
    weightKg, heightCm, waistCm, hipCm, muacCm, anatomicalFindings, rosFindings, procedureData, preVisitStatus,
    radiologyRequests, finalDocument, progressNotes, vitalRecords, labRecords, attachments,
    encounterMode, mrNumber, ward, dateAdmission, dateDischarge, bloodGroup,
    nokName, nokRelation, nokTel, admittingSurgeon, referringPhysician, paneState, traumaData,
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
    setPatientId(null); setEncounterId(null);
    setPatientName(''); setAge(''); setSex('unknown'); setDob(''); setPhone(''); setEmail(''); setPatientPhoto(''); setExamPhotos([]);
    setDurationDays(''); setPainScore(''); setSymptoms([]); setSymptomDetails({});
    setFreeText(''); setIsPostOp(false); setPostOpDays(''); setPregnancyPossible(false);
    setVitals({ systolicBp: '', diastolicBp: '', heartRate: '', temperatureC: '', respiratoryRate: '', spo2: '', glucoseMmol: '' });
    setComorbidities([]); setPmhNotes(''); setFamilyHistory([]); setFamilyHistoryNotes('');
    setSurgicalHistory([]); setSurgicalNotes(''); setMedications([]); setMedicationsText('');
    setAllergies(''); setToxicHabits([]); setOccupation(''); setHpiNotes('');
    setExamGeneral(''); setExamCardio(''); setExamResp(''); setExamAbdomen('');
    setExamNeuro(''); setExamExtremities(''); setExamBreast(''); setExamWound('');
    setExamFindings({}); setExamNotes({});
    setOrderedInvestigations([]); setInvestigationResults({}); setIcdCodes([]); setCptCodes([]);
    setAddress(''); setQuarter(''); setReferredBy('');
    setWeightKg(''); setHeightCm(''); setWaistCm(''); setHipCm(''); setMuacCm(''); setAnatomicalFindings([]);
    setRosFindings({}); setProcedureData({}); setPreVisitStatus('new');
    setVisitType(''); setPostOpDate(''); setPostOpReviewNum(1);
    setAssessment(''); setDifferentials(''); setPlan(''); setFollowUpNotes(''); setReferralNotes('');
    setProcedures(''); setBilling(''); setDocuments('');
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
      }));
      void trackedSave(() => savePlan({ encounter_id: encounterId, patient_id: patientId, description: plan }));
      void trackedSave(() => syncMedicationList(patientId, encounterId, medications, medicationsText));
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
      if (allergenList.length) void trackedSave(() => syncAllergyList(patientId, allergenList));
    }, 3000);
    return () => { if (allergyTimerRef.current) clearTimeout(allergyTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, allergies]);

  // ── Autosave examination findings (debounced 3 s) ─────────────────────────
  useEffect(() => {
    if (!patientId || !encounterId) return;
    if (examTimerRef.current) clearTimeout(examTimerRef.current);
    examTimerRef.current = setTimeout(() => {
      void trackedSave(() => saveExamFindings(examFindings, examNotes, patientId, encounterId));
    }, 3000);
    return () => { if (examTimerRef.current) clearTimeout(examTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, examFindings, examNotes]);

  // ── Autosave surgical history (patient-level, debounced 3 s) ───────────────
  useEffect(() => {
    if (!patientId) return;
    if (surgicalTimerRef.current) clearTimeout(surgicalTimerRef.current);
    surgicalTimerRef.current = setTimeout(() => {
      void trackedSave(() => syncSurgicalHistory(patientId, surgicalHistory, surgicalNotes));
    }, 3000);
    return () => { if (surgicalTimerRef.current) clearTimeout(surgicalTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, surgicalHistory, surgicalNotes]);

  // ── Autosave toxic habits (patient-level, debounced 3 s) ───────────────────
  useEffect(() => {
    if (!patientId || !toxicHabits.length) return;
    if (toxicTimerRef.current) clearTimeout(toxicTimerRef.current);
    toxicTimerRef.current = setTimeout(() => {
      void trackedSave(() => syncToxicHabits(patientId, toxicHabits));
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
      void trackedSave(() => syncRosFindings(patientId, encounterId, rosFindings));
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
      void trackedSave(() => syncProcedureData(patientId, encounterId, procedureData));
    }, 3000);
    return () => { if (procedureTimerRef.current) clearTimeout(procedureTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, procedureData]);

  // ── Autosave trauma data (encounter-level, debounced 3 s) ─────────────────
  useEffect(() => {
    if (!patientId || !encounterId) return;
    if (traumaTimerRef.current) clearTimeout(traumaTimerRef.current);
    traumaTimerRef.current = setTimeout(() => {
      void trackedSave(() => syncTraumaRecord(patientId, encounterId, traumaData));
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
        void trackedSave(() => clearHpiNote(encounterId));
      }, 3000);
    } else {
      hpiTimerRef.current = setTimeout(() => {
        hpiTimerRef.current = null;
        hpiSavedRef.current = true;
        void trackedSave(() => saveHpiNote(encounterId, patientId, hpiNotes));
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
      void trackedSave(() => savePmhNotes(patientId, pmhNotes, familyHistoryNotes));
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
      void trackedSave(() => syncInvestigationOrders(encounterId, patientId, orderedInvestigations));
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
      void trackedSave(() => updateEncounterType(encounterId, toDbEncounterType(encounterType, encounterMode)));
    }, 2000);
    return () => { if (encounterTypeTimerRef.current) clearTimeout(encounterTypeTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, encounterType, encounterMode]);

  // ── Flush pending debounced saves on page close / hide ──────────────────
  const flushPendingSaves = useCallback(() => {
    if (autoSaveTimerRef.current && patientId && encounterId) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
      void trackedSave(() => saveAssessment({
        encounter_id: encounterId, patient_id: patientId,
        diagnosis: assessment, differentials, icdCodes, cptCodes,
        acuity: triageResult.acuity, triageScore: triageResult.score,
      }));
      void trackedSave(() => savePlan({ encounter_id: encounterId, patient_id: patientId, description: plan }));
      void trackedSave(() => syncMedicationList(patientId, encounterId, medications, medicationsText));
    }
    if (allergyTimerRef.current && patientId) {
      clearTimeout(allergyTimerRef.current);
      allergyTimerRef.current = null;
      const allergenList = allergies.split(',').map(s => s.trim()).filter(Boolean);
      if (allergenList.length) void trackedSave(() => syncAllergyList(patientId, allergenList));
    }
    if (examTimerRef.current && patientId && encounterId) {
      clearTimeout(examTimerRef.current);
      examTimerRef.current = null;
      void trackedSave(() => saveExamFindings(examFindings, examNotes, patientId, encounterId));
    }
    if (surgicalTimerRef.current && patientId) {
      clearTimeout(surgicalTimerRef.current);
      surgicalTimerRef.current = null;
      void trackedSave(() => syncSurgicalHistory(patientId, surgicalHistory, surgicalNotes));
    }
    if (toxicTimerRef.current && patientId) {
      clearTimeout(toxicTimerRef.current);
      toxicTimerRef.current = null;
      void trackedSave(() => syncToxicHabits(patientId, toxicHabits));
    }
    if (rosTimerRef.current && patientId && encounterId) {
      clearTimeout(rosTimerRef.current);
      rosTimerRef.current = null;
      void trackedSave(() => syncRosFindings(patientId, encounterId, rosFindings));
    }
    if (procedureTimerRef.current && patientId && encounterId) {
      clearTimeout(procedureTimerRef.current);
      procedureTimerRef.current = null;
      void trackedSave(() => syncProcedureData(patientId, encounterId, procedureData));
    }
    if (traumaTimerRef.current && patientId && encounterId) {
      clearTimeout(traumaTimerRef.current);
      traumaTimerRef.current = null;
      void trackedSave(() => syncTraumaRecord(patientId, encounterId, traumaData));
    }
    if (hpiTimerRef.current && patientId && encounterId) {
      clearTimeout(hpiTimerRef.current);
      hpiTimerRef.current = null;
      void trackedSave(() => saveHpiNote(encounterId, patientId, hpiNotes));
    }
    if (pmhTimerRef.current && patientId) {
      clearTimeout(pmhTimerRef.current);
      pmhTimerRef.current = null;
      void trackedSave(() => savePmhNotes(patientId, pmhNotes, familyHistoryNotes));
    }
    if (investigationTimerRef.current && patientId && encounterId) {
      clearTimeout(investigationTimerRef.current);
      investigationTimerRef.current = null;
      void trackedSave(() => syncInvestigationOrders(encounterId, patientId, orderedInvestigations));
    }
    if (encounterTypeTimerRef.current && encounterId) {
      clearTimeout(encounterTypeTimerRef.current);
      encounterTypeTimerRef.current = null;
      void trackedSave(() => updateEncounterType(encounterId, toDbEncounterType(encounterType, encounterMode)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, assessment, differentials, icdCodes, cptCodes, plan,
    triageResult.acuity, triageResult.score, medications, medicationsText,
    allergies, examFindings, examNotes, surgicalHistory, surgicalNotes,
    toxicHabits, rosFindings, procedureData, traumaData,
    hpiNotes, pmhNotes, familyHistoryNotes, orderedInvestigations, encounterType, encounterMode,
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
       encounterTypeTimerRef.current), []);

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

  const value: CtxValue = {
    activeSection, setActiveSection,
    topSection, setTopSection,
    currentSite, setCurrentSite,
    patientId, setPatientId,
    encounterId, setEncounterId,
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
    triageResult,
    attachments, setAttachments,
    radiologyRequests, setRadiologyRequests,
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
    activeCcKey,
    setActiveCcKey,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): CtxValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be inside AppProvider');
  return ctx;
}
