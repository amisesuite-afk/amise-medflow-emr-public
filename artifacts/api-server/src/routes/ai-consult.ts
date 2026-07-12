import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { sb } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';
import { AI_DISABLED } from '../lib/ai-guard.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const CLINICAL_SYSTEM_PROMPT = `You are an AI clinical decision support assistant working alongside Dr Dawit Daniel Kabiye, MD, DM (specialist general and endoscopic surgeon, Saint Lucia).

Your role is to provide evidence-based clinical decision support across ALL medical specialties — cardiology, respiratory, neurology, endocrinology, haematology, infectious disease, obstetrics/gynaecology, urology, musculoskeletal, psychiatry, and surgery. Surgical patients present with the full breadth of human pathology and every system must be considered.

You are NOT the treating physician — you are a knowledgeable senior clinical colleague offering a structured second opinion.

For every consultation you MUST:
1. Summarise the clinical picture in 2-3 sentences — include the most likely diagnosis and the most dangerous diagnosis that must be excluded.
2. Provide a RANKED differential diagnosis covering ALL plausible systems, not just surgical — list the top 5-8 differentials with brief reasoning for each.
3. List specific, actionable recommendations (numbered), including which differentials to exclude first and how.
4. Present counterpoints or alternative approaches where relevant.
5. Reference clinical guidelines when available (cite source and grade).
6. Flag any safety concerns or red flags you identify — especially time-critical diagnoses (PE, dissection, ACS, stroke, meningitis, sepsis).

You MUST NEVER:
- Provide a definitive diagnosis — frame as "differential includes..." or "most likely..."
- Recommend specific drug doses without referencing standard dosing guidelines
- Override the treating clinician's judgement
- Discuss prognosis in percentage terms with patients
- Limit your differential to surgical pathology alone when the presentation could be medical, cardiac, neurological, or gynaecological

Response format (JSON):
{
  "assessmentSummary": "...",
  "recommendations": [{"text": "...", "priority": "high|medium|low", "evidence": "..."}],
  "counterpoints": [{"text": "...", "rationale": "..."}],
  "guidelinesReferenced": [{"source": "...", "recommendation": "...", "grade": "A|B|C|D"}],
  "redFlags": ["..."],
  "suggestedInvestigations": ["..."],
  "suggestedFollowUp": "...",
  "confidenceLevel": "high|moderate|low",
  "reasoning": "..."
}`;

interface ConsultRequest {
  patientContext: {
    demographics: { name: string; age: string; sex: string; dob: string };
    vitals: Record<string, string>;
    symptoms: string[];
    examFindings: Record<string, string[]>;
    investigations: Record<string, string>;
    assessment: string;
    medications: Array<{ drugName: string; dose: string; frequency: string }>;
    allergies: Array<{ allergen: string; reaction: string; severity: string }>;
    comorbidities: string[];
    rosFindings: Record<string, { status: string; details: string[] }>;
  };
  consultationType: string;
  specificQuestion: string;
  icd10Codes: Array<{ code: string; description: string }>;
  guidelinesContext: Array<{
    title: string;
    guideline_source: string;
    summary: string;
    key_recommendations: Array<{ text: string; grade: string }>;
  }>;
  patientId?: string;
  encounterId?: string;
}

router.post('/api/ai-consult', async (req, res) => {
  if (AI_DISABLED) {
    res.status(503).json({
      error: 'AI features are temporarily disabled (DISABLE_AI=true). Re-enable the service to use this feature.',
      disabled: true,
    });
    return;
  }

  try {
    const body = req.body as ConsultRequest;
    const { patientContext, consultationType, specificQuestion, icd10Codes, guidelinesContext } = body;

    if (!patientContext || !consultationType) {
      res.status(400).json({ error: 'patientContext and consultationType are required' });
      return;
    }

    const contextParts: string[] = [];

    // Demographics
    const d = patientContext.demographics;
    if (d) {
      contextParts.push(`PATIENT: ${d.name || 'Unknown'}, ${d.age || '?'} years, ${d.sex || 'unknown'}, DOB: ${d.dob || '?'}`);
    }

    // Vitals
    const v = patientContext.vitals;
    if (v && Object.keys(v).length > 0) {
      const vitalLines = Object.entries(v)
        .filter(([, val]) => val && val.trim())
        .map(([k, val]) => `${k}: ${val}`)
        .join(', ');
      if (vitalLines) contextParts.push(`VITALS: ${vitalLines}`);
    }

    // Symptoms
    if (patientContext.symptoms?.length) {
      contextParts.push(`PRESENTING COMPLAINTS: ${patientContext.symptoms.join(', ')}`);
    }

    // Comorbidities
    if (patientContext.comorbidities?.length) {
      contextParts.push(`COMORBIDITIES: ${patientContext.comorbidities.join(', ')}`);
    }

    // Medications
    if (patientContext.medications?.length) {
      const meds = patientContext.medications
        .map(m => `${m.drugName} ${m.dose || ''} ${m.frequency || ''}`.trim())
        .join('; ');
      contextParts.push(`CURRENT MEDICATIONS: ${meds}`);
    }

    // Allergies
    if (patientContext.allergies?.length) {
      const allgStr = patientContext.allergies
        .map(a => `${a.allergen} (${a.reaction || 'unknown reaction'}, ${a.severity || 'unknown severity'})`)
        .join('; ');
      contextParts.push(`ALLERGIES: ${allgStr}`);
    }

    // Exam findings
    if (patientContext.examFindings && Object.keys(patientContext.examFindings).length > 0) {
      const examLines = Object.entries(patientContext.examFindings)
        .filter(([, findings]) => findings.length > 0)
        .map(([system, findings]) => `${system}: ${findings.join(', ')}`)
        .join('\n  ');
      if (examLines) contextParts.push(`EXAMINATION:\n  ${examLines}`);
    }

    // ROS
    if (patientContext.rosFindings && Object.keys(patientContext.rosFindings).length > 0) {
      const rosPositive = Object.entries(patientContext.rosFindings)
        .filter(([, f]) => f.status === 'positive')
        .map(([system, f]) => `${system}: ${f.details.join(', ')}`)
        .join('; ');
      if (rosPositive) contextParts.push(`ROS (POSITIVE): ${rosPositive}`);
    }

    // Investigations
    if (patientContext.investigations && Object.keys(patientContext.investigations).length > 0) {
      const investLines = Object.entries(patientContext.investigations)
        .filter(([, val]) => val && val.trim())
        .map(([test, result]) => `${test}: ${result}`)
        .join('\n  ');
      if (investLines) contextParts.push(`INVESTIGATIONS:\n  ${investLines}`);
    }

    // Assessment
    if (patientContext.assessment) {
      contextParts.push(`CURRENT ASSESSMENT: ${patientContext.assessment}`);
    }

    // ICD-10 codes
    if (icd10Codes?.length) {
      contextParts.push(`ICD-10 CODES: ${icd10Codes.map(c => `${c.code} — ${c.description}`).join('; ')}`);
    }

    // Inject local guidelines
    let guidelinesBlock = '';
    if (guidelinesContext?.length) {
      guidelinesBlock = '\n\nRELEVANT CLINICAL GUIDELINES (from practice database — cite these preferentially):\n' +
        guidelinesContext.map(g => {
          const recs = g.key_recommendations
            .map((r: { text: string; grade: string }) => `  - [Grade ${r.grade}] ${r.text}`)
            .join('\n');
          return `\n${g.title} (${g.guideline_source}):\n${g.summary}\nKey recommendations:\n${recs}`;
        }).join('\n');
    }

    const consultTypeLabels: Record<string, string> = {
      differential_diagnosis: 'Provide a structured differential diagnosis with reasoning for each possibility.',
      management_plan: 'Suggest a comprehensive management plan with step-by-step approach.',
      surgical_approach: 'Discuss surgical approach options, their indications, risks, and the recommended technique for this case.',
      investigation_workup: 'Recommend a systematic investigation workup with rationale for each test.',
      second_opinion: 'Provide an independent clinical opinion on the current assessment and plan.',
    };

    const typeInstruction = consultTypeLabels[consultationType] || `Consultation type: ${consultationType}`;

    const userPrompt = `CLINICAL CONTEXT:
${contextParts.join('\n\n')}
${guidelinesBlock}

CONSULTATION REQUEST:
${typeInstruction}

${specificQuestion ? `SPECIFIC QUESTION: ${specificQuestion}` : ''}

Respond with ONLY a JSON object (no markdown fences, no preamble). Follow the response schema exactly.`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: CLINICAL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '');

    let aiResponse;
    try {
      aiResponse = JSON.parse(raw);
    } catch {
      log.warn({ raw: raw.slice(0, 200) }, 'AI consult response was not valid JSON — wrapping as text');
      aiResponse = {
        assessmentSummary: raw,
        recommendations: [],
        counterpoints: [],
        guidelinesReferenced: [],
        redFlags: [],
        suggestedInvestigations: [],
        suggestedFollowUp: '',
        confidenceLevel: 'low',
        reasoning: 'Response could not be parsed as structured JSON.',
      };
    }

    // Save to consultation_requests if patient context provided
    if (body.patientId) {
      const insertData: Record<string, unknown> = {
        patient_id: body.patientId,
        request_type: consultationType,
        clinical_context: {
          demographics: patientContext.demographics,
          symptoms: patientContext.symptoms,
          assessment: patientContext.assessment,
          icd10Codes,
          specificQuestion,
        },
        ai_response: aiResponse,
        status: 'completed',
        guidelines_referenced: guidelinesContext?.map(g => ({
          title: g.title,
          source: g.guideline_source,
        })) || [],
      };
      if (body.encounterId) {
        insertData.questionnaire_session_id = body.encounterId;
      }

      const { error: saveErr } = await sb()
        .from('consultation_requests')
        .insert(insertData);

      if (saveErr) {
        log.warn({ err: saveErr }, 'Failed to save AI consultation to DB (non-fatal)');
      }
    }

    res.json({
      success: true,
      consultation: aiResponse,
      model: MODEL,
      timestamp: new Date().toISOString(),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI consultation failed';
    log.error({ err }, 'AI consultation error');
    res.status(500).json({ error: message });
  }
});


// ── AI Note Editing ───────────────────────────────────────────────────────────

router.post('/api/ai/edit-note', async (req, res) => {
  const { section, currentText, instruction } = req.body as {
    section?: string; currentText?: string; instruction?: string;
  };
  if (!section || !currentText === undefined || !instruction) {
    res.status(400).json({ error: 'section, currentText, and instruction are required' });
    return;
  }
  try {
    const response = await client.messages.create({
      model: MODEL, max_tokens: 2048,
      messages: [{ role: 'user', content:
        `You are editing a clinical note section.\nSection: ${section}\nCurrent text: ${currentText}\nInstruction: ${instruction}\nReturn ONLY the rewritten text, no preamble.`
      }],
    });
    const rewritten = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim();
    res.json({ rewritten });
  } catch { res.status(502).json({ error: 'AI edit-note request failed' }); }
});

// ── AI Document Pre-fill (discharge / referral) ──────────────────────────────

router.post('/api/ai/fill-document', async (req, res) => {
  if (AI_DISABLED) { res.status(503).json({ error: 'AI features are disabled' }); return; }
  const {
    docType, patientName, age, sex, symptoms, assessment, plan,
    procedures, medications, comorbidities, disposition,
    investigationResults, referredBy,
  } = req.body as {
    docType: 'discharge' | 'referral';
    patientName?: string; age?: string; sex?: string;
    symptoms?: string[]; assessment?: string; plan?: string;
    procedures?: string; medications?: string[];
    comorbidities?: string[]; disposition?: string;
    investigationResults?: Record<string, string>;
    referredBy?: string;
  };

  const ctx: string[] = [];
  if (patientName) ctx.push(`Patient: ${patientName}${age ? `, ${age}y` : ''}${sex && sex !== 'unknown' ? `, ${sex}` : ''}`);
  if (symptoms?.length) ctx.push(`Presenting: ${symptoms.join(', ')}`);
  if (comorbidities?.length) ctx.push(`PMH: ${comorbidities.join(', ')}`);
  if (medications?.length) ctx.push(`Medications: ${medications.join(', ')}`);
  if (assessment) ctx.push(`Assessment: ${assessment}`);
  if (procedures) ctx.push(`Procedures: ${procedures}`);
  if (plan) ctx.push(`Plan: ${plan}`);
  if (investigationResults && Object.keys(investigationResults).length) {
    const results = Object.entries(investigationResults).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('; ');
    if (results) ctx.push(`Results: ${results}`);
  }

  try {
    if (docType === 'discharge') {
      const dispLine = disposition ? `Disposition: ${disposition}. ` : '';
      const prompt = `You are a surgical registrar writing a discharge summary for Dr Dawit Kabiye's patient.\n${dispLine}Clinical context:\n${ctx.join('\n')}\n\nGenerate three sections as JSON only:\n{\n  "instructions": "...",\n  "warningSigns": "...",\n  "followUp": "..."\n}\nInstructions: specific post-op or post-procedure care, activity, diet, wound care, medications.\nWarning signs: specific red flags for this diagnosis — when to return to ED.\nFollow-up: concrete plan with timeframe and location.\nNo preamble, no markdown fences.`;
      const msg = await client.messages.create({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] });
      const raw = (msg.content[0] as { type: string; text: string }).text?.trim() ?? '';
      try {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        res.json(JSON.parse(cleaned));
      } catch { res.status(502).json({ error: 'AI response could not be parsed' }); }
    } else {
      const from = referredBy ? ` from ${referredBy}` : '';
      const prompt = `You are writing a referral letter reason for Dr Dawit Kabiye${from}.\nClinical context:\n${ctx.join('\n')}\n\nWrite a concise, professional referral reason (2-4 sentences) starting with the presenting complaint, key findings, and specific clinical question. Return plain text only, no preamble.`;
      const msg = await client.messages.create({ model: MODEL, max_tokens: 512, messages: [{ role: 'user', content: prompt }] });
      const referNotes = (msg.content[0] as { type: string; text: string }).text?.trim() ?? '';
      res.json({ referNotes });
    }
  } catch (err) {
    log.error({ err }, 'AI fill-document error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

// ── Drug Interaction Checker ──────────────────────────────────────────────────

interface DrugInputDI { drugName: string; dose?: string; frequency?: string; }
interface DrugInteraction { drug1: string; drug2: string; severity: 'major' | 'moderate' | 'minor'; description: string; mechanism: string; }

router.post('/api/ai/drug-interactions', async (req, res) => {
  if (AI_DISABLED) { res.status(503).json({ error: 'AI features are disabled' }); return; }
  const drugs: DrugInputDI[] = Array.isArray(req.body?.drugs) ? req.body.drugs : [];
  if (drugs.length < 2) { res.json({ interactions: [] }); return; }
  const drugList = drugs.map(d => [d.drugName, d.dose, d.frequency].filter(Boolean).join(' ')).join(', ');
  try {
    const msg = await client.messages.create({
      model: MODEL, max_tokens: 1024,
      messages: [{ role: 'user', content:
        `Check for clinically significant drug interactions between: ${drugList}.\nReturn JSON only: { "interactions": [{ "drug1": "...", "drug2": "...", "severity": "major"|"moderate"|"minor", "description": "...", "mechanism": "..." }] }\nOnly real, established interactions. Empty array if none.`
      }],
    });
    const raw = (msg.content[0] as { type: string; text: string }).text?.trim() ?? '';
    let interactions: DrugInteraction[] = [];
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed?.interactions)) interactions = parsed.interactions;
    } catch { log.warn({ raw: raw.slice(0, 200) }, 'Drug interaction response invalid JSON'); }
    res.json({ interactions });
  } catch (err: unknown) {
    log.error({ err }, 'Drug interaction error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

export default router;
