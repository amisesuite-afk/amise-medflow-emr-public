import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { adaptiveTriage, AdaptiveTriageInput, AdaptiveTriageResult, Sex, VitalSigns } from '@/lib/adaptive-triage';
import { type SiteCode } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { updateDefaultSite } from '@/lib/db';

export { type SiteCode } from '@/lib/supabase';
export type Section =
  | 'intake' | 'triage' | 'pmh' | 'surgical' | 'medications'
  | 'allergies' | 'toxic' | 'scales' | 'ros' | 'examination' | 'investigations' | 'assessment' | 'plan'
  | 'procedures' | 'billing' | 'documents';

export type TopSection =
  | 'dashboard' | 'patients' | 'intake' | 'consultation'
  | 'procedures' | 'scheduling' | 'billing' | 'analytics' | 'settings' | 'summary';

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
  address: string; setAddress(v: string): void;
  quarter: string; setQuarter(v: string): void;
  referredBy: string; setReferredBy(v: string): void;

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
  surgicalHistory: string[]; toggleSurgical(v: string): void;
  surgicalNotes: string; setSurgicalNotes(v: string): void;
  medications: string[]; toggleMedication(v: string): void;
  medicationsText: string; setMedicationsText(v: string): void;
  allergies: string; setAllergies(v: string): void;
  toxicHabits: string[]; toggleToxicHabit(v: string): void;

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

  anatomicalFindings: AnatomicalFinding[]; setAnatomicalFindings(v: AnatomicalFinding[]): void;
  rosFindings: Record<string, RosFinding>; setRosFindings(v: Record<string, RosFinding>): void;

  procedureData: Record<string, unknown>; setProcedureData(v: Record<string, unknown>): void;

  assessment: string; setAssessment(v: string): void;
  differentials: string; setDifferentials(v: string): void;
  plan: string; setPlan(v: string): void;
  procedures: string; setProcedures(v: string): void;
  billing: string; setBilling(v: string): void;
  documents: string; setDocuments(v: string): void;

  insuranceProvider: string; setInsuranceProvider(v: string): void;
  policyNumber: string; setPolicyNumber(v: string): void;
  nhiNumber: string; setNhiNumber(v: string): void;
  preAuthStatus: string; setPreAuthStatus(v: string): void;

  triageResult: AdaptiveTriageResult;
}

const AppContext = createContext<CtxValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  const [activeSection, setActiveSection] = useState<Section>('intake');
  const [topSection, setTopSection] = useState<TopSection>('intake');

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
    try { localStorage.setItem(SITE_STORAGE_KEY, profile.default_site); } catch { /* ignore */ }
  }, [profile]);

  function setCurrentSite(site: SiteCode) {
    _setCurrentSite(site);
    try { localStorage.setItem(SITE_STORAGE_KEY, site); } catch { /* ignore */ }
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
  const [address, setAddress] = useState('');
  const [quarter, setQuarter] = useState('');
  const [referredBy, setReferredBy] = useState('');

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
  const [anatomicalFindings, setAnatomicalFindings] = useState<AnatomicalFinding[]>([]);
  const [rosFindings, setRosFindings] = useState<Record<string, RosFinding>>({});
  const [procedureData, setProcedureData] = useState<Record<string, unknown>>({});

  const [assessment, setAssessment] = useState('');
  const [differentials, setDifferentials] = useState('');
  const [plan, setPlan] = useState('');
  const [procedures, setProcedures] = useState('');
  const [billing, setBilling] = useState('');
  const [documents, setDocuments] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [nhiNumber, setNhiNumber] = useState('');
  const [preAuthStatus, setPreAuthStatus] = useState('');

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
      if (typeof d.patientName === 'string') setPatientName(d.patientName);
      if (typeof d.age === 'string') setAge(d.age);
      if (typeof d.sex === 'string') setSex(d.sex as Sex);
      if (typeof d.dob === 'string') setDob(d.dob);
      if (typeof d.phone === 'string') setPhone(d.phone);
      if (typeof d.address === 'string') setAddress(d.address);
      if (typeof d.quarter === 'string') setQuarter(d.quarter);
      if (typeof d.referredBy === 'string') setReferredBy(d.referredBy);
      if (d.examFindings && typeof d.examFindings === 'object') setExamFindings(d.examFindings as Record<string, string[]>);
      if (d.examNotes && typeof d.examNotes === 'object') setExamNotes(d.examNotes as Record<string, string>);
      if (Array.isArray(d.orderedInvestigations)) setOrderedInvestigations(d.orderedInvestigations as string[]);
      if (d.investigationResults && typeof d.investigationResults === 'object') setInvestigationResults(d.investigationResults as Record<string, string>);
      if (Array.isArray(d.icdCodes)) setIcdCodes(d.icdCodes as string[]);
      if (Array.isArray(d.cptCodes)) setCptCodes(d.cptCodes as string[]);
      if (typeof d.weightKg === 'string') setWeightKg(d.weightKg);
      if (typeof d.heightCm === 'string') setHeightCm(d.heightCm);
      if (Array.isArray(d.anatomicalFindings)) setAnatomicalFindings(d.anatomicalFindings as AnatomicalFinding[]);
      if (d.rosFindings && typeof d.rosFindings === 'object') setRosFindings(d.rosFindings as Record<string, RosFinding>);
      if (d.procedureData && typeof d.procedureData === 'object') setProcedureData(d.procedureData as Record<string, unknown>);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback((data: Record<string, unknown>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try { localStorage.setItem(ENC_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    }, 500);
  }, []);

  useEffect(() => {
    scheduleSave({
      vitals, symptoms, symptomDetails, freeText, durationDays, painScore,
      isPostOp, postOpDays, pregnancyPossible,
      examGeneral, examCardio, examResp, examAbdomen, examNeuro, examExtremities, examBreast, examWound,
      examFindings, examNotes,
      assessment, differentials, plan, procedures, billing, documents,
      insuranceProvider, policyNumber, nhiNumber, preAuthStatus,
      comorbidities, pmhNotes, surgicalHistory, surgicalNotes,
      medications, medicationsText, allergies, familyHistory, toxicHabits,
      patientName, age, sex, dob, phone, address, quarter, referredBy,
      orderedInvestigations, investigationResults, icdCodes, cptCodes,
      weightKg, heightCm, anatomicalFindings, rosFindings, procedureData,
    });
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [scheduleSave, vitals, symptoms, symptomDetails, freeText, durationDays, painScore,
    isPostOp, postOpDays, pregnancyPossible,
    examGeneral, examCardio, examResp, examAbdomen, examNeuro, examExtremities, examBreast, examWound,
    examFindings, examNotes,
    assessment, differentials, plan, procedures, billing, documents,
    insuranceProvider, policyNumber, nhiNumber, preAuthStatus,
    comorbidities, pmhNotes, surgicalHistory, surgicalNotes,
    medications, medicationsText, allergies, familyHistory, toxicHabits,
    patientName, age, sex, dob, phone, address, quarter, referredBy,
    orderedInvestigations, investigationResults, icdCodes, cptCodes,
    weightKg, heightCm, anatomicalFindings, rosFindings, procedureData]);

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

  function clearPatient() {
    setPatientId(null); setEncounterId(null);
    setPatientName(''); setAge(''); setSex('unknown'); setDob(''); setPhone('');
    setDurationDays(''); setPainScore(''); setSymptoms([]); setSymptomDetails({});
    setFreeText(''); setIsPostOp(false); setPostOpDays(''); setPregnancyPossible(false);
    setVitals({ systolicBp: '', diastolicBp: '', heartRate: '', temperatureC: '', respiratoryRate: '', spo2: '', glucoseMmol: '' });
    setComorbidities([]); setPmhNotes(''); setFamilyHistory([]); setFamilyHistoryNotes('');
    setSurgicalHistory([]); setSurgicalNotes(''); setMedications([]); setMedicationsText('');
    setAllergies(''); setToxicHabits([]);
    setExamGeneral(''); setExamCardio(''); setExamResp(''); setExamAbdomen('');
    setExamNeuro(''); setExamExtremities(''); setExamBreast(''); setExamWound('');
    setExamFindings({}); setExamNotes({});
    setOrderedInvestigations([]); setInvestigationResults({}); setIcdCodes([]); setCptCodes([]);
    setAddress(''); setQuarter(''); setReferredBy('');
    setWeightKg(''); setHeightCm(''); setAnatomicalFindings([]);
    setRosFindings({}); setProcedureData({});
    setAssessment(''); setDifferentials(''); setPlan(''); setProcedures(''); setBilling(''); setDocuments('');
    setInsuranceProvider(''); setPolicyNumber(''); setNhiNumber(''); setPreAuthStatus('');
    try { localStorage.removeItem(ENC_KEY); } catch { /* ignore */ }
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
    address, setAddress,
    quarter, setQuarter,
    referredBy, setReferredBy,
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
    surgicalHistory, toggleSurgical,
    surgicalNotes, setSurgicalNotes,
    medications, toggleMedication,
    medicationsText, setMedicationsText,
    allergies, setAllergies,
    toxicHabits, toggleToxicHabit,
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
    procedures, setProcedures,
    billing, setBilling,
    documents, setDocuments,
    insuranceProvider, setInsuranceProvider,
    policyNumber, setPolicyNumber,
    nhiNumber, setNhiNumber,
    preAuthStatus, setPreAuthStatus,
    weightKg, setWeightKg,
    heightCm, setHeightCm,
    anatomicalFindings, setAnatomicalFindings,
    rosFindings, setRosFindings,
    procedureData, setProcedureData,
    triageResult,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): CtxValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be inside AppProvider');
  return ctx;
}
