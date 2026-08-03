import type {
  ClinicalFact, ClinicalRule, RuleOutput, ActiveAlert,
  AllergyValue, MedicationValue, PrescriptionValue,
  VitalValue, LabResultValue, InvestigationOrderValue,
  DiagnosisValue, FollowUpValue, TaskValue,
} from './types.js';
import type { PatientFactStore } from './fact-store.js';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Fuzzy substance match: penicillin ↔ amoxicillin, sulpha ↔ sulfamethoxazole
function substanceOverlaps(a: string, b: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const ca = clean(a), cb = clean(b);
  if (ca.includes(cb) || cb.includes(ca)) return true;
  const CROSS: [string, string[]][] = [
    ['penicillin',       ['amoxicillin', 'ampicillin', 'flucloxacillin', 'benzylpenicillin', 'piperacillin']],
    ['cephalosporin',    ['cefalexin', 'ceftriaxone', 'cefuroxime', 'cefazolin']],
    ['sulpha',           ['sulfamethoxazole', 'sulfadiazine', 'trimethoprim']],
    ['nsaid',            ['ibuprofen', 'diclofenac', 'naproxen', 'indomethacin', 'ketorolac']],
    ['opioid',           ['morphine', 'codeine', 'tramadol', 'oxycodone', 'fentanyl', 'pethidine']],
    ['contrast',         ['iodine', 'gadolinium']],
  ];
  for (const [root, variants] of CROSS) {
    const group = [root, ...variants].map(clean);
    if (group.includes(ca) && group.includes(cb)) return true;
  }
  return false;
}

function msUntil(isoDate: string): number {
  return new Date(isoDate).getTime() - Date.now();
}

// ─── Clinical rules ───────────────────────────────────────────────────────────

const RULES: ClinicalRule[] = [

  // ── SAFETY ─────────────────────────────────────────────────────────────────

  {
    id: 'allergy_medication_check',
    name: 'Allergy–Medication Conflict',
    description: 'Blocks prescription when the agent matches or cross-reacts with a documented allergy.',
    category: 'safety',
    priority: 'critical',
    triggerTypes: ['prescription', 'medication'],
    evaluate(all, trigger) {
      const allergies = all.filter(f => f.factType === 'allergy' && ['active', 'confirmed'].includes(f.status));
      const medName = ((trigger.value as PrescriptionValue | MedicationValue).name ?? '').toLowerCase();
      const hit = allergies.find(a => {
        const sub = (a.value as AllergyValue).substance ?? '';
        return substanceOverlaps(sub, medName);
      });
      if (!hit) return null;
      const allergy = hit.value as AllergyValue;
      return {
        alert: {
          severity: 'critical',
          message: `ALLERGY CONFLICT — ${(trigger.value as MedicationValue).name}`,
          detail: `Patient has a documented ${allergy.severity} allergy to ${allergy.substance} (${allergy.reaction}). Cross-reactivity applies.`,
          requiresAcknowledgement: true,
          requiresOverrideReason: true,
          actionLabel: 'Override with reason',
        },
        block: { reason: `Allergy to ${allergy.substance}` },
      };
    },
  },

  {
    id: 'critical_vital',
    name: 'Critical Vital Sign',
    description: 'Raises an immediate alert for life-threatening vital derangements.',
    category: 'safety',
    priority: 'critical',
    triggerTypes: ['vital'],
    evaluate(_, trigger) {
      const v = trigger.value as VitalValue;
      if (!v.isCritical) return null;
      const LABELS: Record<string, string> = {
        systolicBp: 'Systolic BP',
        diastolicBp: 'Diastolic BP',
        heartRate: 'Heart rate',
        temperatureC: 'Temperature',
        respiratoryRate: 'Respiratory rate',
        spo2: 'SpO₂',
        glucoseMmol: 'Blood glucose',
      };
      const label = LABELS[v.parameter] ?? v.parameter;
      return {
        alert: {
          severity: 'critical',
          message: `Critical ${label}: ${v.numericValue} ${v.unit}`,
          detail: `Reference range ${v.referenceRange[0]}–${v.referenceRange[1]} ${v.unit}. Immediate clinical assessment required.`,
          requiresAcknowledgement: true,
          requiresOverrideReason: false,
          actionLabel: 'Acknowledge',
        },
        tasks: [{
          title: `Respond to critical ${label}`,
          description: `${label} is ${v.numericValue} ${v.unit} — outside safe range. Review and act now.`,
          category: 'safety',
          priority: 'critical',
          triggeringFactId: trigger.id,
          ruleId: 'critical_vital',
          dueAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          assignedTo: null,
          completedAt: null,
          completedBy: null,
          completionEvidence: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
        }],
      };
    },
  },

  {
    id: 'critical_lab',
    name: 'Critical Laboratory Result',
    description: 'Raises an immediate alert for critical or panic-value laboratory results.',
    category: 'safety',
    priority: 'critical',
    triggerTypes: ['lab_result'],
    evaluate(_, trigger) {
      const r = trigger.value as LabResultValue;
      if (!r.isCritical) return null;
      return {
        alert: {
          severity: 'critical',
          message: `Critical lab: ${r.testName} ${r.result} ${r.unit}`,
          detail: `Reference: ${r.referenceRange}. This is a panic value requiring immediate clinical action.`,
          requiresAcknowledgement: true,
          requiresOverrideReason: false,
          actionLabel: 'Acknowledge & act',
        },
        tasks: [{
          title: `Act on critical ${r.testName}`,
          description: `${r.testName}: ${r.result} ${r.unit} (ref ${r.referenceRange}). Document clinical response.`,
          category: 'safety',
          priority: 'critical',
          triggeringFactId: trigger.id,
          ruleId: 'critical_lab',
          dueAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          assignedTo: null,
          completedAt: null,
          completedBy: null,
          completionEvidence: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
        }],
      };
    },
  },

  // ── QUALITY ─────────────────────────────────────────────────────────────────

  {
    id: 'abnormal_lab_followup',
    name: 'Abnormal Lab Follow-up Task',
    description: 'Creates a review task whenever a non-critical abnormal result arrives.',
    category: 'quality',
    priority: 'high',
    triggerTypes: ['lab_result'],
    evaluate(_, trigger) {
      const r = trigger.value as LabResultValue;
      if (!r.isAbnormal || r.isCritical) return null;
      return {
        tasks: [{
          title: `Review abnormal ${r.testName}`,
          description: `${r.testName}: ${r.result} ${r.unit} (ref ${r.referenceRange})${r.trend ? ` — trend: ${r.trend}` : ''}. Requires clinical review and documentation of action.`,
          category: 'clinical',
          priority: 'high',
          triggeringFactId: trigger.id,
          ruleId: 'abnormal_lab_followup',
          dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          assignedTo: null,
          completedAt: null,
          completedBy: null,
          completionEvidence: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
        }],
        alert: {
          severity: 'warning',
          message: `Abnormal result: ${r.testName} ${r.result} ${r.unit}`,
          detail: `Outside reference range (${r.referenceRange}).${r.trend ? ` Trend: ${r.trend}.` : ''} Review required.`,
          requiresAcknowledgement: false,
          requiresOverrideReason: false,
          actionLabel: null,
        },
      };
    },
  },

  {
    id: 'imaging_urgent_finding',
    name: 'Urgent Imaging Finding',
    description: 'Alerts on any radiology report with urgent findings.',
    category: 'safety',
    priority: 'critical',
    triggerTypes: ['imaging_result'],
    evaluate(_, trigger) {
      const r = trigger.value as { urgentFindings: string[]; modality: string; region: string; impression: string };
      if (!r.urgentFindings?.length) return null;
      return {
        alert: {
          severity: 'critical',
          message: `Urgent finding on ${r.modality} ${r.region}`,
          detail: r.urgentFindings.join('; '),
          requiresAcknowledgement: true,
          requiresOverrideReason: false,
          actionLabel: 'Acknowledge',
        },
        tasks: [{
          title: `Act on urgent ${r.modality} finding`,
          description: r.urgentFindings.join('; '),
          category: 'clinical',
          priority: 'critical',
          triggeringFactId: trigger.id,
          ruleId: 'imaging_urgent_finding',
          dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          assignedTo: null,
          completedAt: null,
          completedBy: null,
          completionEvidence: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
        }],
      };
    },
  },

  // ── WORKFLOW ─────────────────────────────────────────────────────────────────

  {
    id: 'pending_investigation_overdue',
    name: 'Overdue Investigation Result',
    description: 'Escalates when an ordered investigation has passed its due date without a result.',
    category: 'workflow',
    priority: 'high',
    triggerTypes: ['investigation_order'],
    evaluate(_, trigger) {
      const o = trigger.value as InvestigationOrderValue;
      if (o.resultFactId) return null;
      if (!o.dueBy) return null;
      if (msUntil(o.dueBy) > 0) return null;
      return {
        alert: {
          severity: 'warning',
          message: `Overdue result: ${o.testName}`,
          detail: `Ordered ${new Date(o.orderedAt).toLocaleDateString()} — result expected by ${new Date(o.dueBy).toLocaleDateString()} but not yet received.`,
          requiresAcknowledgement: false,
          requiresOverrideReason: false,
          actionLabel: 'Chase result',
        },
        tasks: [{
          title: `Chase overdue ${o.testName} result`,
          description: `${o.testName} was ordered ${new Date(o.orderedAt).toLocaleDateString()} and was due by ${new Date(o.dueBy).toLocaleDateString()}. Contact lab/radiology.`,
          category: 'investigation',
          priority: 'high',
          triggeringFactId: trigger.id,
          ruleId: 'pending_investigation_overdue',
          dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          assignedTo: null,
          completedAt: null,
          completedBy: null,
          completionEvidence: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
        }],
      };
    },
  },

  {
    id: 'followup_overdue',
    name: 'Overdue Follow-up',
    description: 'Creates an escalation task when a follow-up appointment is past due.',
    category: 'workflow',
    priority: 'high',
    triggerTypes: ['follow_up'],
    evaluate(_, trigger) {
      const f = trigger.value as FollowUpValue;
      if (f.completedAt) return null;
      if (!f.dueDateIso) return null;
      if (msUntil(f.dueDateIso) > 0) return null;
      return {
        alert: {
          severity: 'warning',
          message: `Overdue follow-up: ${f.reason}`,
          detail: `Follow-up was due ${new Date(f.dueDateIso).toLocaleDateString()} and has not been completed.`,
          requiresAcknowledgement: false,
          requiresOverrideReason: false,
          actionLabel: 'Contact patient',
        },
        tasks: [{
          title: `Contact patient — overdue follow-up: ${f.reason}`,
          description: `${f.reason}. Due ${new Date(f.dueDateIso).toLocaleDateString()}. Instructions: ${f.instructions}`,
          category: 'follow_up',
          priority: 'high',
          triggeringFactId: trigger.id,
          ruleId: 'followup_overdue',
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: null,
          completedAt: null,
          completedBy: null,
          completionEvidence: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
        }],
      };
    },
  },

  // ── GUIDELINES ───────────────────────────────────────────────────────────────

  {
    id: 'anticoagulant_inr_monitoring',
    name: 'Anticoagulant INR Monitoring',
    description: 'Schedules INR monitoring follow-up when warfarin is prescribed.',
    category: 'guideline',
    priority: 'high',
    triggerTypes: ['prescription'],
    evaluate(all, trigger) {
      const name = ((trigger.value as PrescriptionValue).name ?? '').toLowerCase();
      if (!['warfarin', 'acenocoumarol', 'phenprocoumon'].some(d => name.includes(d))) return null;
      // Only fire once per encounter — check if INR follow-up already exists
      const alreadyExists = all.some(
        f => f.factType === 'follow_up' && f.ruleId === 'anticoagulant_inr_monitoring',
      );
      if (alreadyExists) return null;
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return {
        followUps: [{
          reason: 'INR monitoring — warfarin therapy',
          timeframe: '1 week',
          dueDateIso: dueDate,
          instructions: 'Check INR. Target therapeutic range per indication. Adjust dose accordingly.',
          appointmentType: 'follow_up',
          triggeringFactId: trigger.id,
          scheduledAt: null,
          completedAt: null,
          completionNote: null,
        }],
        alert: {
          severity: 'info',
          message: 'INR follow-up scheduled — warfarin initiated',
          detail: 'INR check required in 1 week. Ensure patient education on diet, bleeding signs, and interactions.',
          requiresAcknowledgement: false,
          requiresOverrideReason: false,
          actionLabel: null,
        },
      };
    },
  },

  {
    id: 'confirmed_diagnosis_consent',
    name: 'Confirmed Diagnosis → Consent Required',
    description: 'Generates a consent task when a procedure-indicated diagnosis is confirmed.',
    category: 'guideline',
    priority: 'medium',
    triggerTypes: ['diagnosis'],
    evaluate(all, trigger) {
      const d = trigger.value as DiagnosisValue;
      if (d.certainty !== 'confirmed') return null;
      const PROCEDURE_DX = ['appendicitis', 'cholecystitis', 'hernia', 'carcinoma', 'cancer', 'polyp', 'obstruction'];
      const needsConsent = PROCEDURE_DX.some(dx => d.name.toLowerCase().includes(dx));
      if (!needsConsent) return null;
      const alreadyHasConsent = all.some(
        f => f.factType === 'consent' && f.status !== 'cancelled',
      );
      if (alreadyHasConsent) return null;
      return {
        tasks: [{
          title: `Obtain informed consent — ${d.name}`,
          description: `Confirmed diagnosis of ${d.name} requires procedure planning. Document informed consent before any operative intervention.`,
          category: 'clinical',
          priority: 'high',
          triggeringFactId: trigger.id,
          ruleId: 'confirmed_diagnosis_consent',
          dueAt: null,
          assignedTo: null,
          completedAt: null,
          completedBy: null,
          completionEvidence: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
        }],
      };
    },
  },

  {
    id: 'discharge_without_followup',
    name: 'Discharge Requires Follow-up',
    description: 'Warns when a discharge note is created without a corresponding follow-up fact.',
    category: 'guideline',
    priority: 'medium',
    triggerTypes: ['clinical_note'],
    evaluate(all, trigger) {
      const note = trigger.value as { noteType: string };
      if (note.noteType !== 'discharge') return null;
      const hasFollowUp = all.some(f => f.factType === 'follow_up' && f.status !== 'cancelled');
      if (hasFollowUp) return null;
      return {
        alert: {
          severity: 'warning',
          message: 'Discharge note has no follow-up scheduled',
          detail: 'Document a follow-up plan before finalising discharge to ensure continuity of care.',
          requiresAcknowledgement: true,
          requiresOverrideReason: false,
          actionLabel: 'Add follow-up',
        },
      };
    },
  },

  {
    id: 'ai_fact_requires_verification',
    name: 'AI-Extracted Fact Requires Clinician Verification',
    description: 'Flags every AI-generated or AI-extracted fact that has not been confirmed.',
    category: 'quality',
    priority: 'medium',
    triggerTypes: ['allergy', 'medication', 'diagnosis', 'prescription'],
    evaluate(_, trigger) {
      if (trigger.source !== 'ai_extracted' && trigger.source !== 'ai_suggested') return null;
      if (trigger.verifiedBy) return null;
      return {
        alert: {
          severity: 'info',
          message: `AI-suggested ${trigger.factType} requires verification`,
          detail: `This ${trigger.factType} was extracted by AI and has not been confirmed by a clinician. Safety-critical facts must be verified before acting on them.`,
          requiresAcknowledgement: false,
          requiresOverrideReason: false,
          actionLabel: 'Verify',
        },
      };
    },
  },
];

// ─── RulesEngine ──────────────────────────────────────────────────────────────

export class RulesEngine {
  private alerts = new Map<string, ActiveAlert>();

  constructor(private store: PatientFactStore) {
    store.on('fact:created', ({ factId }) => {
      if (!factId) return;
      const fact = store.get(factId);
      if (fact) this.runRules(fact);
    });
    store.on('fact:updated', ({ factId }) => {
      if (!factId) return;
      const fact = store.get(factId);
      if (fact) this.runRules(fact);
    });
  }

  private runRules(trigger: ClinicalFact) {
    const allFacts = this.store.getAll();
    for (const rule of RULES) {
      if (!rule.triggerTypes.includes(trigger.factType)) continue;
      let output: RuleOutput | null = null;
      try {
        output = rule.evaluate(allFacts, trigger);
      } catch {
        continue;
      }
      if (!output) continue;

      if (output.alert) {
        const alertId = uuid();
        this.alerts.set(alertId, {
          id: alertId,
          ruleId: rule.id,
          severity: output.alert.severity,
          message: output.alert.message,
          detail: output.alert.detail,
          triggeringFactId: trigger.id,
          relatedFactIds: [],
          requiresAcknowledgement: output.alert.requiresAcknowledgement,
          acknowledgedBy: null,
          acknowledgedAt: null,
          overrideReason: null,
          createdAt: new Date().toISOString(),
        });
      }

      if (output.tasks) {
        for (const task of output.tasks) {
          this.store.addFact({
            patientId: trigger.patientId,
            encounterId: trigger.encounterId,
            factType: 'task',
            value: task as TaskValue,
            status: 'pending',
            source: 'derived_rule',
            sourceFactIds: [trigger.id],
            ruleId: rule.id,
            createdBy: 'system',
            verifiedBy: null,
            verifiedAt: null,
            expiresAt: null,
            displayReason: `Generated by rule: ${rule.name}`,
            metadata: {},
          });
        }
      }

      if (output.followUps) {
        for (const fu of output.followUps) {
          this.store.addFact({
            patientId: trigger.patientId,
            encounterId: trigger.encounterId,
            factType: 'follow_up',
            value: fu as FollowUpValue,
            status: 'pending',
            source: 'derived_rule',
            sourceFactIds: [trigger.id],
            ruleId: rule.id,
            createdBy: 'system',
            verifiedBy: null,
            verifiedAt: null,
            expiresAt: null,
            displayReason: `Required by rule: ${rule.name}`,
            metadata: {},
          });
        }
      }

      if (output.suggestedFacts) {
        for (const sf of output.suggestedFacts) {
          this.store.addFact({
            patientId: trigger.patientId,
            encounterId: trigger.encounterId,
            factType: sf.factType,
            value: sf.value as never,
            status: 'suspected',
            source: 'derived_rule',
            sourceFactIds: [trigger.id],
            ruleId: rule.id,
            createdBy: 'system',
            verifiedBy: null,
            verifiedAt: null,
            expiresAt: null,
            displayReason: sf.displayReason,
            metadata: {},
          });
        }
      }
    }
  }

  getAlerts(): ActiveAlert[] {
    return Array.from(this.alerts.values());
  }

  getActiveAlerts(): ActiveAlert[] {
    return this.getAlerts().filter(a => !a.acknowledgedBy || a.requiresAcknowledgement);
  }

  getCriticalAlerts(): ActiveAlert[] {
    return this.getAlerts().filter(a => a.severity === 'critical' && !a.acknowledgedBy);
  }

  acknowledgeAlert(id: string, userId: string, overrideReason?: string): boolean {
    const alert = this.alerts.get(id);
    if (!alert) return false;
    this.alerts.set(id, {
      ...alert,
      acknowledgedBy: userId,
      acknowledgedAt: new Date().toISOString(),
      overrideReason: overrideReason ?? null,
    });
    return true;
  }

  clearAlertsForFact(factId: string) {
    for (const [id, alert] of this.alerts) {
      if (alert.triggeringFactId === factId) this.alerts.delete(id);
    }
  }

  getRules(): ClinicalRule[] {
    return RULES;
  }

  clearAll() {
    this.alerts.clear();
  }
}
