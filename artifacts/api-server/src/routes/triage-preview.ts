import { Router } from 'express';
import { adaptiveTriage } from '@workspace/triage-engine';
import { z } from 'zod';

const router = Router();

const TriagePreviewBody = z.object({
  age: z.number().nullable().optional(),
  sex: z.enum(['female', 'male', 'other', 'unknown']).optional(),
  symptoms: z.array(z.string()).default([]),
  freeText: z.string().optional(),
  comorbidities: z.array(z.string()).optional(),
  surgicalHistory: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  toxicHabits: z.array(z.string()).optional(),
  vitalSigns: z.object({
    systolicBp: z.number().nullable().optional(),
    diastolicBp: z.number().nullable().optional(),
    heartRate: z.number().nullable().optional(),
    temperatureC: z.number().nullable().optional(),
    respiratoryRate: z.number().nullable().optional(),
    spo2: z.number().nullable().optional(),
    glucoseMmol: z.number().nullable().optional(),
  }).optional(),
  durationDays: z.number().nullable().optional(),
  painScore: z.number().min(0).max(10).nullable().optional(),
  isPostOp: z.boolean().optional(),
  postOpDays: z.number().nullable().optional(),
  pregnancyPossible: z.boolean().optional(),
});

router.post('/api/triage/preview', (req, res) => {
  const parsed = TriagePreviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const result = adaptiveTriage(parsed.data);
  res.json(result);
});

export default router;
