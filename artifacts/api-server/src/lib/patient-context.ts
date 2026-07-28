/**
 * Assemble a structured patient context snapshot for AI calls.
 *
 * Runs 8 parallel Supabase queries and returns a single object that can be
 * serialised into a system/user prompt.  No writes occur here — read-only.
 *
 * Usage:
 *   import { assemblePatientContext } from '../lib/patient-context.js';
 *   const ctx = await assemblePatientContext(patientId, encounterId);
 *   const block = formatContextBlock(ctx);   // plain-text for prompt injection
 */

import { sb } from './supabase.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatientContext {
  patient: {
    id: string;
    name: string;
    mrn: string | null;
    dob: string | null;
    sex: string | null;
    ageYears: number | null;
  };
  vitals: {
    bpSystolic: number | null;
    bpDiastolic: number | null;
    heartRate: number | null;
    tempC: number | null;
    spo2: number | null;
    weightKg: number | null;
    glucoseMmol: number | null;
    recordedAt: string | null;
  } | null;
  medications: Array<{ name: string; dose: string | null; frequency: string | null }>;
  allergies: Array<{ allergen: string; reaction: string | null; severity: string | null }>;
  problems: Array<{ title: string; status: string; icd10: string | null }>;
  recentResults: Array<{ testName: string; value: string | null; abnormal: boolean; reportedAt: string | null }>;
  recentDocs: Array<{ title: string; docType: string; summary: string | null; date: string }>;
  passport: {
    conditions: string[];
    medications: string[];
    surgicalHistory: string[];
    allergies: string;
    bloodGroup: string | null;
  } | null;
  currentEncounter: {
    chiefComplaint: string | null;
    encounterType: string | null;
    date: string | null;
  } | null;
}

// ─── Main assembler ───────────────────────────────────────────────────────────

export async function assemblePatientContext(
  patientId: string,
  encounterId?: string | null,
): Promise<PatientContext | null> {
  // Run all queries in parallel — none depend on each other
  const [
    patientRes,
    vitalsRes,
    medsRes,
    allergiesRes,
    problemsRes,
    resultsRes,
    docsRes,
    passportRes,
    encounterRes,
  ] = await Promise.all([
    sb().from('patients')
      .select('id, full_name, mrn, date_of_birth, sex')
      .eq('id', patientId)
      .maybeSingle(),

    sb().from('vitals')
      .select('bp_systolic, bp_diastolic, heart_rate, temperature_c, oxygen_saturation, weight_kg, glucose_mmol, recorded_at')
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    sb().from('medications')
      .select('name, dose, frequency')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30),

    sb().from('allergies')
      .select('allergen, reaction, severity')
      .eq('patient_id', patientId)
      .eq('status', 'active'),

    sb().from('patient_problems')
      .select('title, status, icd10_code')
      .eq('patient_id', patientId)
      .in('status', ['active', 'chronic'])
      .order('created_at', { ascending: false })
      .limit(20),

    sb().from('investigation_results')
      .select('test_name, result_value, is_abnormal, reported_at')
      .eq('patient_id', patientId)
      .order('reported_at', { ascending: false })
      .limit(15),

    sb().from('documents')
      .select('title, document_type, ai_extracted_data, created_at')
      .eq('patient_id', patientId)
      .not('ai_extracted_data', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5),

    // Most recent previsit submission containing a patient passport
    sb().from('previsit_submissions')
      .select('passport')
      .eq('patient_id', patientId)
      .not('passport', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    encounterId
      ? sb().from('encounters')
          .select('chief_complaint, encounter_type, encounter_date')
          .eq('id', encounterId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!patientRes.data) return null;

  const p = patientRes.data as {
    id: string; full_name: string; mrn: string | null;
    date_of_birth: string | null; sex: string | null;
  };

  const ageYears = p.date_of_birth
    ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const v = vitalsRes.data as Record<string, number | string | null> | null;

  const passport = passportRes.data?.passport as {
    bloodGroup?: string | null;
    conditions?: unknown[];
    medications?: unknown[];
    surgicalHistory?: unknown[];
    allergies?: string;
  } | null ?? null;

  const enc = encounterRes.data as {
    chief_complaint: string | null;
    encounter_type: string | null;
    encounter_date: string | null;
  } | null ?? null;

  return {
    patient: {
      id: p.id,
      name: p.full_name,
      mrn: p.mrn,
      dob: p.date_of_birth,
      sex: p.sex,
      ageYears,
    },
    vitals: v ? {
      bpSystolic:   v.bp_systolic   as number | null,
      bpDiastolic:  v.bp_diastolic  as number | null,
      heartRate:    v.heart_rate    as number | null,
      tempC:        v.temperature_c as number | null,
      spo2:         v.oxygen_saturation as number | null,
      weightKg:     v.weight_kg     as number | null,
      glucoseMmol:  v.glucose_mmol  as number | null,
      recordedAt:   v.recorded_at   as string | null,
    } : null,
    medications: (medsRes.data ?? []).map((m: Record<string, unknown>) => ({
      name:      (m.name      as string) ?? '',
      dose:      (m.dose      as string | null) ?? null,
      frequency: (m.frequency as string | null) ?? null,
    })),
    allergies: (allergiesRes.data ?? []).map((a: Record<string, unknown>) => ({
      allergen: (a.allergen as string) ?? '',
      reaction: (a.reaction as string | null) ?? null,
      severity: (a.severity as string | null) ?? null,
    })),
    problems: (problemsRes.data ?? []).map((r: Record<string, unknown>) => ({
      title:  (r.title      as string) ?? '',
      status: (r.status     as string) ?? 'active',
      icd10:  (r.icd10_code as string | null) ?? null,
    })),
    recentResults: (resultsRes.data ?? []).map((r: Record<string, unknown>) => ({
      testName:   (r.test_name    as string) ?? '',
      value:      (r.result_value as string | null) ?? null,
      abnormal:   Boolean(r.is_abnormal),
      reportedAt: (r.reported_at  as string | null) ?? null,
    })),
    recentDocs: (docsRes.data ?? []).map((d: Record<string, unknown>) => {
      let summary: string | null = null;
      try {
        const raw = d.ai_extracted_data as string | Record<string, unknown> | null;
        const parsed: Record<string, unknown> = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {});
        summary = (parsed.summary as string) ?? (parsed.reportSummary as string) ?? null;
      } catch { /* leave null */ }
      return {
        title:   (d.title         as string) ?? '',
        docType: (d.document_type as string) ?? '',
        summary,
        date:    (d.created_at    as string) ?? '',
      };
    }),
    passport: passport ? {
      bloodGroup:      passport.bloodGroup ?? null,
      conditions:      (passport.conditions     ?? []).map(String),
      medications:     (passport.medications    ?? []).map(String),
      surgicalHistory: (passport.surgicalHistory ?? []).map(String),
      allergies:       passport.allergies ?? '',
    } : null,
    currentEncounter: enc ? {
      chiefComplaint: enc.chief_complaint,
      encounterType:  enc.encounter_type,
      date:           enc.encounter_date,
    } : null,
  };
}

// ─── Prompt serialiser ────────────────────────────────────────────────────────

/** Render the assembled context as a compact plain-text block for prompt injection. */
export function formatContextBlock(ctx: PatientContext): string {
  const lines: string[] = [];

  lines.push(`=== PATIENT CONTEXT ===`);
  lines.push(`Name: ${ctx.patient.name}${ctx.patient.mrn ? ` (MRN: ${ctx.patient.mrn})` : ''}`);
  if (ctx.patient.ageYears !== null) lines.push(`Age: ${ctx.patient.ageYears} years · Sex: ${ctx.patient.sex ?? 'unknown'}`);
  if (ctx.patient.dob) lines.push(`DOB: ${ctx.patient.dob}`);

  if (ctx.currentEncounter?.chiefComplaint) {
    lines.push(`\nChief complaint: ${ctx.currentEncounter.chiefComplaint}`);
    if (ctx.currentEncounter.encounterType) lines.push(`Encounter type: ${ctx.currentEncounter.encounterType}`);
  }

  if (ctx.vitals) {
    const v = ctx.vitals;
    const parts: string[] = [];
    if (v.bpSystolic && v.bpDiastolic) parts.push(`BP ${v.bpSystolic}/${v.bpDiastolic}`);
    if (v.heartRate)   parts.push(`HR ${v.heartRate}`);
    if (v.tempC)       parts.push(`T ${v.tempC}°C`);
    if (v.spo2)        parts.push(`SpO₂ ${v.spo2}%`);
    if (v.weightKg)    parts.push(`Wt ${v.weightKg} kg`);
    if (v.glucoseMmol) parts.push(`Glu ${v.glucoseMmol} mmol/L`);
    if (parts.length) lines.push(`\nVitals: ${parts.join(' · ')}`);
  }

  if (ctx.allergies.length) {
    lines.push(`\nAllergies:`);
    for (const a of ctx.allergies) {
      const detail = [a.reaction, a.severity ? `(${a.severity})` : ''].filter(Boolean).join(' ');
      lines.push(`  • ${a.allergen}${detail ? ' — ' + detail : ''}`);
    }
  }

  if (ctx.medications.length) {
    lines.push(`\nMedications:`);
    for (const m of ctx.medications) {
      const detail = [m.dose, m.frequency].filter(Boolean).join(' ');
      lines.push(`  • ${m.name}${detail ? ' ' + detail : ''}`);
    }
  }

  if (ctx.problems.length) {
    lines.push(`\nProblem list:`);
    for (const p of ctx.problems) {
      lines.push(`  • ${p.title}${p.icd10 ? ` [${p.icd10}]` : ''}${p.status === 'chronic' ? ' (chronic)' : ''}`);
    }
  }

  // Patient app passport — de-duplicate against EMR data if both present
  if (ctx.passport) {
    const pp = ctx.passport;
    if (pp.bloodGroup) lines.push(`\nBlood group: ${pp.bloodGroup}`);
    const extraConditions = pp.conditions.filter(
      c => !ctx.problems.some(p => p.title.toLowerCase().includes(c.toLowerCase())),
    );
    if (extraConditions.length) {
      lines.push(`\nPatient-reported conditions:`);
      for (const c of extraConditions) lines.push(`  • ${c}`);
    }
    const extraMeds = pp.medications.filter(
      m => !ctx.medications.some(em => em.name.toLowerCase().includes(m.toLowerCase().split(' ')[0])),
    );
    if (extraMeds.length) {
      lines.push(`\nPatient-reported medications (app):`);
      for (const m of extraMeds) lines.push(`  • ${m}`);
    }
    if (pp.surgicalHistory.length) {
      lines.push(`\nSurgical history (patient-reported):`);
      for (const s of pp.surgicalHistory) lines.push(`  • ${s}`);
    }
    if (pp.allergies && !ctx.allergies.length) {
      lines.push(`\nAllergies (patient-reported): ${pp.allergies}`);
    }
  }

  if (ctx.recentResults.length) {
    const abnormal = ctx.recentResults.filter(r => r.abnormal);
    if (abnormal.length) {
      lines.push(`\nRecent abnormal results:`);
      for (const r of abnormal) {
        lines.push(`  • ${r.testName}: ${r.value ?? '—'}${r.reportedAt ? ' (' + r.reportedAt.slice(0, 10) + ')' : ''}`);
      }
    }
  }

  if (ctx.recentDocs.length) {
    lines.push(`\nRecent documents:`);
    for (const d of ctx.recentDocs) {
      lines.push(`  • ${d.title} (${d.docType}, ${d.date.slice(0, 10)})${d.summary ? ': ' + d.summary.slice(0, 120) : ''}`);
    }
  }

  lines.push(`=== END PATIENT CONTEXT ===`);
  return lines.join('\n');
}
