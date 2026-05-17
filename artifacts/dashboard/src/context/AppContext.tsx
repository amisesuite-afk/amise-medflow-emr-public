import React, { createContext, useContext, useMemo, useState } from 'react';
import { adaptiveTriage, AdaptiveTriageInput, AdaptiveTriageResult, Sex, VitalSigns } from '@/lib/adaptive-triage';

export type AppMode = 'front_desk' | 'doctor';
export type Section =
  | 'intake' | 'triage' | 'pmh' | 'surgical' | 'medications'
  | 'allergies' | 'toxic' | 'scales' | 'examination' | 'assessment' | 'plan'
  | 'procedures' | 'billing' | 'documents';

export type VitalsState = Record<keyof VitalSigns, string>;

function toNum(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function csv(v: string): string[] {
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

export function toggleList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

interface CtxValue {
  mode: AppMode;
  setMode(m: AppMode): void;
  activeSection: Section;
  setActiveSection(s: Section): void;

  patientName: string; setPatientName(v: string): void;
  age: string; setAge(v: string): void;
  sex: Sex; setSex(v: Sex): void;
  dob: string; setDob(v: string): void;
  phone: string; setPhone(v: string): void;

  durationDays: string; setDurationDays(v: string): void;
  painScore: string; setPainScore(v: string): void;
  symptoms: string[]; toggleSymptom(v: string): void;
  symptomDetails: Record<string, string[]>; toggleSymptomDetail(sym: string, opt: string): void;
  freeText: string; setFreeText(v: string): void;
  isPostOp: boolean; setIsPostOp(v: boolean): void;
  postOpDays: string; setPostOpDays(v: string): void;
  pregnancyPossible: boolean; setPregnancyPossible(v: boolean): void;
  vitals: VitalsState; updateVital(k: keyof VitalSigns, v: string): void;

  comorbidities: string[]; toggleComorbidity(v: string): void;
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

  assessment: string; setAssessment(v: string): void;
  differentials: string; setDifferentials(v: string): void;
  plan: string; setPlan(v: string): void;
  procedures: string; setProcedures(v: string): void;
  billing: string; setBilling(v: string): void;
  documents: string; setDocuments(v: string): void;

  triageResult: AdaptiveTriageResult;
}

const AppContext = createContext<CtxValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppMode>('front_desk');
  const [activeSection, setActiveSection] = useState<Section>('intake');

  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('unknown');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');

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

  const [assessment, setAssessment] = useState('');
  const [differentials, setDifferentials] = useState('');
  const [plan, setPlan] = useState('');
  const [procedures, setProcedures] = useState('');
  const [billing, setBilling] = useState('');
  const [documents, setDocuments] = useState('');

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
    setPatientName(''); setAge(''); setSex('unknown'); setDob(''); setPhone('');
    setDurationDays(''); setPainScore(''); setSymptoms([]); setSymptomDetails({});
    setFreeText(''); setIsPostOp(false); setPostOpDays(''); setPregnancyPossible(false);
    setVitals({ systolicBp: '', diastolicBp: '', heartRate: '', temperatureC: '', respiratoryRate: '', spo2: '', glucoseMmol: '' });
    setComorbidities([]); setPmhNotes(''); setFamilyHistory([]); setFamilyHistoryNotes('');
    setSurgicalHistory([]); setSurgicalNotes(''); setMedications([]); setMedicationsText('');
    setAllergies(''); setToxicHabits([]);
    setExamGeneral(''); setExamCardio(''); setExamResp(''); setExamAbdomen('');
    setExamNeuro(''); setExamExtremities(''); setExamBreast(''); setExamWound('');
    setAssessment(''); setDifferentials(''); setPlan(''); setProcedures(''); setBilling(''); setDocuments('');
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
    mode, setMode,
    activeSection, setActiveSection,
    patientName, setPatientName,
    age, setAge,
    sex, setSex,
    dob, setDob,
    phone, setPhone,
    durationDays, setDurationDays,
    painScore, setPainScore,
    symptoms, toggleSymptom,
    symptomDetails, toggleSymptomDetail,
    freeText, setFreeText,
    isPostOp, setIsPostOp,
    postOpDays, setPostOpDays,
    pregnancyPossible, setPregnancyPossible,
    vitals, updateVital,
    comorbidities, toggleComorbidity,
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
    assessment, setAssessment,
    differentials, setDifferentials,
    plan, setPlan,
    procedures, setProcedures,
    billing, setBilling,
    documents, setDocuments,
    triageResult,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): CtxValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be inside AppProvider');
  return ctx;
}
