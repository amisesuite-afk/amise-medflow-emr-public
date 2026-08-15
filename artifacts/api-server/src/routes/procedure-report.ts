import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireStaffAuth, audit } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a specialist medical documentation writer for Amise Medical Services, a general and endoscopic surgery practice in Saint Lucia, led by Dr Dawit Daniel Kabiye, MD, DM.

Your task is to generate professional clinical procedure reports and operative notes from structured data.

Requirements:
- Write professional medical prose — not bullet points or tables in the body
- British English spelling throughout
- Write in past tense, third person clinical style
- Do NOT invent, assume, or embellish any clinical details not explicitly provided in the structured data
- Omit sections entirely if their data is empty, not provided, or marked "—"
- Use formal medical terminology appropriate for consultant-level surgical documentation
- The report must be suitable for inclusion in the official medical record
- Start with the line: [AI-ASSISTED DRAFT — REQUIRES SURGEON REVIEW AND APPROVAL BEFORE FILING]
- End with a signature block for the operating surgeon`;

interface ImageCapture {
  label: string;
  finding: string;
}

interface ReportRequest {
  type: string;
  data: Record<string, unknown>;
  images?: ImageCapture[];
  patientName?: string;
  patientAge?: string;
  patientSex?: string;
  reportDate?: string;
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  if (typeof v === 'string') return v;
  return '';
}

router.post('/api/ai/procedure-report', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  try {
    const { type, data, images, patientName, patientAge, patientSex, reportDate } = req.body as ReportRequest;

    if (!type || !data) {
      res.status(400).json({ error: 'type and data are required' });
      return;
    }

    const patientInfo = [patientName || 'Unknown', patientAge ? `${patientAge} years` : '', patientSex].filter(Boolean).join(', ');
    const dateStr = reportDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const imagesSection = images && images.length > 0
      ? `\nCAPTURED IMAGES (${images.length}):\n${images.map((img, i) => `  Image ${i + 1}: Site — ${img.label || 'unlabelled'}${img.finding ? `; Finding — ${img.finding}` : ''}`).join('\n')}\n`
      : '';

    let userPrompt = '';

    if (type === 'postop') {
      userPrompt = `Generate a formal operative note. Include only sections for which data is provided.

PATIENT: ${patientInfo}
DATE: ${dateStr}

INPUT DATA:
Procedure performed: ${fmt(data.procedurePerformed)}
Approach: ${fmt(data.approach)}
Anaesthesia: ${fmt(data.anaesthesiaType)}
Duration: ${data.duration ? `${data.duration} minutes` : ''}
Surgeon: ${fmt(data.surgeon)}
Assistant: ${fmt(data.assistant)}
Anaesthetist: ${fmt(data.anaesthetist)}
Scrub nurse: ${fmt(data.scrubNurse)}
Patient position: ${fmt(data.position)}
Incision / port placement: ${fmt(data.incision)}
Critical safety checks: ${fmt(data.safetyChecks)}
Intraoperative imaging: ${fmt(data.intraopImaging)}
Key operative steps: ${fmt(data.operativeSteps)}
Intraoperative findings: ${fmt(data.findings)}
Estimated blood loss: ${data.ebl ? `${data.ebl} mL` : ''}
IV fluid administered: ${data.fluidIn ? `${data.fluidIn}` : ''}
Urine output: ${data.urineOut ? `${data.urineOut} mL` : ''}
Specimen: ${fmt(data.specimenSent)} — ${fmt(data.specimenSite)}
Drain: ${fmt(data.drain)} — type: ${fmt(data.drainType)}, site: ${fmt(data.drainSite)}
Wound closure: ${fmt(data.closure)}
Dressing: ${fmt(data.dressing)}
Post-operative orders: ${fmt(data.postopOrders)}
Intraoperative complications: ${fmt(data.complications)}
Additional notes: ${fmt(data.additionalNotes)}
${imagesSection}
Write the note with these sections as applicable:
OPERATIVE NOTE
Patient / Date / Theatre Team
PROCEDURE PERFORMED
ANAESTHESIA
PATIENT POSITION
INCISION AND ACCESS
INTRAOPERATIVE FINDINGS
OPERATIVE STEPS
INTRAOPERATIVE DETAILS
SPECIMENS
DRAINS
WOUND CLOSURE AND DRESSING
POST-OPERATIVE ORDERS
COMPLICATIONS
[Signature block for operating surgeon]`;

    } else if (type === 'ogd') {
      userPrompt = `Generate a formal Upper GI Endoscopy (OGD) report. Include only sections for which data is provided.

PATIENT: ${patientInfo}
DATE: ${dateStr}
ENDOSCOPIST: Dr Dawit Daniel Kabiye, MD, DM

INPUT DATA:
Indication: ${fmt(data.indication)}
Instrument: ${fmt(data.instrument)}
Patient position: ${fmt(data.patientPosition)}
Sedation: ${fmt(data.sedationType)}
Supplemental oxygen: ${fmt(data.oxygenSupp)}
Oesophagus: ${fmt(data.oesophagus)}
Z-line / GEJ: ${fmt(data.zLine)}
Stomach: ${fmt(data.stomach)}
Duodenum: ${fmt(data.duodenum)}
Biopsy: ${fmt(data.biopsy)} — site: ${fmt(data.biopsySite)}
CLO test: ${fmt(data.cloTest)}
H. pylori status: ${fmt(data.hpylori)}
H. pylori treatment recommendation: ${fmt(data.hp_treatment)}
Complications: ${fmt(data.complications)}
Additional notes: ${fmt(data.additionalNotes)}
${imagesSection}
Write the report with sections:
UPPER GI ENDOSCOPY REPORT
Patient / Date / Endoscopist
INDICATION
PROCEDURE
FINDINGS (subsections: Oesophagus, Gastro-oesophageal Junction, Stomach, Duodenum)
BIOPSY AND SAMPLING
IMPRESSION
PLAN AND RECOMMENDATIONS
[Signature block]`;

    } else if (type === 'colonoscopy') {
      const polyps = Array.isArray(data.polyps) && data.polyps.length > 0
        ? (data.polyps as Array<{ site: string; size: string; morphology: string; intervention: string }>)
            .map(p => `${p.site}: ${p.size}mm, morphology ${p.morphology}, intervention: ${p.intervention}`)
            .join('; ')
        : 'None';

      userPrompt = `Generate a formal Colonoscopy Report. Include only sections for which data is provided.

PATIENT: ${patientInfo}
DATE: ${dateStr}
ENDOSCOPIST: Dr Dawit Daniel Kabiye, MD, DM

INPUT DATA:
Indication: ${fmt(data.indication)}
Instrument: ${fmt(data.instrument)}
Bowel prep quality (Boston BSS): ${fmt(data.prepQuality)}
Sedation: ${fmt(data.sedationType)}
Caecal intubation: ${fmt(data.cecalIntubation)}
Time to caecum: ${data.intubationTimeMin ? `${data.intubationTimeMin} minutes` : ''}
Withdrawal time: ${data.withdrawalTimeMin ? `${data.withdrawalTimeMin} minutes` : ''}
Ileoscopy: ${fmt(data.ileoscopy)}
Appendix orifice: ${fmt(data.appendixOrifice)}
Colonic findings: ${fmt(data.findings)}
Polyps: ${polyps}
Tattoo: ${fmt(data.tattoo)} — site: ${fmt(data.tattooSite)}
Complications: ${fmt(data.complications)}
Surveillance interval: ${fmt(data.surveillanceInterval)}
Additional notes: ${fmt(data.additionalNotes)}
${imagesSection}
Write the report with sections:
COLONOSCOPY REPORT
Patient / Date / Endoscopist
INDICATION
PROCEDURE
FINDINGS (Preparation Quality, Extent of Examination, Colonic Mucosa, Polyps if any)
INTERVENTIONS PERFORMED
IMPRESSION
SURVEILLANCE RECOMMENDATION
[Signature block]`;

    } else if (type === 'ercp') {
      userPrompt = `Generate a formal ERCP Report. Include only sections for which data is provided.

PATIENT: ${patientInfo}
DATE: ${dateStr}
ENDOSCOPIST: Dr Dawit Daniel Kabiye, MD, DM

INPUT DATA:
Indication: ${fmt(data.indication)}
Instrument: ${fmt(data.instrument)}
Sedation: ${fmt(data.sedationType)}
Papilla description: ${fmt(data.papillaDescription)}
Cannulation: ${fmt(data.cannulation)}
Contrast injection: ${fmt(data.contrastInjection)}
CBD diameter: ${data.cbdDiameter ? `${data.cbdDiameter} mm` : ''}
Cholangiogram findings: ${fmt(data.cholangiogramFindings)}
Pancreatogram: ${fmt(data.pancreatogramDone)}
Cholangioscopy: ${fmt(data.cholangioscopy)}
Sphincterotomy: ${fmt(data.sphincterotomy)}
Pre-cut sphincterotomy: ${fmt(data.precut)}
Stone extraction: ${fmt(data.stoneExtraction)} — count: ${fmt(data.stoneCount)}, size: ${fmt(data.stoneSizeMm)} mm
Stent: ${data.stent === 'Yes' ? `${fmt(data.stentType)} ${fmt(data.stentSizeFr)}Fr ${fmt(data.stentLengthCm)}cm` : fmt(data.stent)}
Biliary sweep: ${fmt(data.biliarySweep)}
Fluoroscopy time: ${data.fluoroscopyTimeMin ? `${data.fluoroscopyTimeMin} minutes` : ''}
Complications: ${fmt(data.complications)}
Additional notes: ${fmt(data.additionalNotes)}
${imagesSection}
Write the report with sections:
ERCP REPORT
Patient / Date / Endoscopist
INDICATION
PROCEDURE
CHOLANGIOGRAM FINDINGS
INTERVENTIONS PERFORMED
IMPRESSION
PLAN AND FOLLOW-UP
[Signature block]`;

    } else if (type === 'bronch') {
      userPrompt = `Generate a formal Bronchoscopy Report. Include only sections for which data is provided.

PATIENT: ${patientInfo}
DATE: ${dateStr}
BRONCHOSCOPIST: Dr Dawit Daniel Kabiye, MD, DM

INPUT DATA:
Indication: ${fmt(data.indication)}
Bronchoscope: ${fmt(data.bronchoscope)}
Sedation / anaesthesia: ${fmt(data.sedationType)}
Vocal cords: ${fmt(data.vocalCords)}
Carina: ${fmt(data.carina)}
Right airways: ${fmt(data.rightAirways)}
Left airways: ${fmt(data.leftAirways)}
Overall findings: ${fmt(data.overallFindings)}
Lesion description: ${fmt(data.lesionDescription)}
Bronchoalveolar lavage (BAL): ${fmt(data.bal)}${data.balSite ? ` — site: ${fmt(data.balSite)}` : ''}
Endobronchial biopsy: ${fmt(data.biopsy)}${data.biopsySite ? ` — ${fmt(data.biopsySite)}` : ''}
Brushings: ${fmt(data.brushings)}
EBUS: ${fmt(data.ebus)}
Microbiology / specimens: ${fmt(data.microbiology)}
Complications: ${fmt(data.complications)}
Additional notes: ${fmt(data.additionalNotes)}
${imagesSection}
Write the report with sections:
BRONCHOSCOPY REPORT
Patient / Date / Bronchoscopist
INDICATION
PROCEDURE AND TECHNIQUE
FINDINGS (subsections: Upper Airway and Vocal Cords, Trachea and Carina, Right Bronchial Tree, Left Bronchial Tree, Mucosal Appearances — include only subsections with findings)
LESION DESCRIPTION (if applicable)
SPECIMENS AND SAMPLING
IMPRESSION
PLAN AND RECOMMENDATIONS
[Signature block]`;

    } else {
      res.status(400).json({ error: `Unsupported report type: ${type}` });
      return;
    }

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const report = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    res.json({ success: true, report });

    void audit({
      action: 'draft',
      entityType: 'clinical_note',
      payload: { route: 'procedure-report', type, patientName },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Report generation failed';
    log.error({ err }, 'Procedure report generation error');
    res.status(500).json({ error: message });
  }
});

export default router;
