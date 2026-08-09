/**
 * Utilities for classifying and converting investigation label strings into
 * structured RadiologyRequest objects for the Imaging tab.
 */

export interface ParsedRadiologyRequest {
  id: string;
  modality: string;
  anatomicalRegion: string;
  laterality: string;
  urgency: string;
  indication: string;
  clinicalQuestion: string;
  ctContrast: string;
  ctContrastType: string;
  ctEgfr: string;
  mriProtocol: string;
  mriSequences: string;
  scopeType: string;
  functionalType: string;
  otherDescription: string;
  resultReceived: boolean;
  resultNotes: string;
}

const IMAGING_PATTERNS: RegExp[] = [
  /\buss\b/i,
  /\bultrasound\b/i,
  /\bduplex\b/i,
  /\bct\b/i,          // CT scan
  /\bcect\b/i,
  /\b4d-ct\b/i,
  /\bcxr\b/i,
  /\baxr\b/i,
  /\bx-ray\b/i,
  /\bxray\b/i,
  /\bradiograph\b/i,
  /\berect\b/i,       // "Erect CXR"
  /\bmri\b/i,
  /\bmrcp\b/i,
  /\bmammograph/i,
  /\bechocardiogram\b/i,
  /\becho\b.*cardiac|cardiac.*\becho\b/i,
  /\bbone scan\b/i,
  /\bpet scan\b/i,
  /\bspect\b/i,
  /\bangiogram\b/i,
  /\bvenogram\b/i,
  /\barteriogram\b/i,
  /\bfistulograph\b/i,
  /\bbarium\b/i,
  /\bnuclear\b.*scan|scan.*\bnuclear\b/i,
  /\bscintigraph\b/i,
  /\bfluoroscop\b/i,
];

export function isImagingInvestigation(label: string): boolean {
  return IMAGING_PATTERNS.some(re => re.test(label));
}

function detectModality(label: string): string {
  const l = label.toLowerCase();
  if (/\buss\b|\bultrasound\b|\bduplex\b/.test(l)) return 'Ultrasound';
  if (/\bmrcp\b|\bmri\b/.test(l)) return 'MRI';
  if (/\bct\b|\bcect\b|\b4d-ct\b|\bct,|\bct\//.test(l)) return 'CT';
  if (/\bcxr\b|\baxr\b|\bx-ray\b|\bxray\b|\bradiograph\b|\berect\b/.test(l)) return 'XRay';
  if (/\bechocardiogram\b/.test(l)) return 'Functional';
  if (/\bmammograph/.test(l)) return 'XRay';
  return 'Other';
}

function detectRegion(label: string): string {
  const l = label.toLowerCase();
  if ((/abdomen/.test(l) && /pelvis/.test(l)) || /abdominal.*pelvi|tap\b/.test(l)) return 'Abdomen & Pelvis (TAP)';
  if (/abdomen|abdominal/.test(l)) return 'Abdomen';
  if (/chest|thorac|cxr|pulmon/.test(l)) return 'Chest';
  if (/pelvis|pelvic/.test(l)) return 'Pelvis';
  if (/liver|hepat|biliary|cholecyst|gallbladder/.test(l)) return 'Liver';
  if (/pancrea/.test(l)) return 'Pancreas';
  if (/thyroid/.test(l)) return 'Thyroid';
  if (/breast|mammograph/.test(l)) return 'Breast';
  if (/testis|testic|scrot/.test(l)) return 'Testis';
  if (/groin|inguinal/.test(l)) return 'Groin';
  if (/renal|kidney|kub/.test(l)) return 'Abdomen';
  if (/brain|head|neuro|intracrani/.test(l)) return 'Brain';
  if (/lumbar|l\d.*disc/.test(l)) return 'Lumbar Spine';
  if (/cervical.*spine|spine.*cervical/.test(l)) return 'Cervical Spine';
  if (/spine|spinal/.test(l)) return 'Lumbar Spine';
  if (/axr/.test(l)) return 'Abdomen';
  if (/erect/.test(l)) return 'Chest'; // "Erect CXR"
  return '';
}

function detectContrast(label: string): string {
  const l = label.toLowerCase();
  if (/iv.*oral|oral.*iv|± oral|with oral \+ iv/.test(l)) return 'both';
  if (/iv contrast|with iv|iv\)|\(contrast\)|contrast\)/.test(l)) return 'IV';
  if (/oral contrast|with oral/.test(l)) return 'oral';
  if (/non-contrast|without contrast|no contrast/.test(l)) return 'none';
  return 'none';
}

function detectUrgency(urgency?: string): string {
  if (urgency === 'stat') return 'emergency';
  if (urgency === 'urgent') return 'urgent';
  return 'routine';
}

/**
 * Convert an investigation label string (from a CC matrix or PANE protocol)
 * into a RadiologyRequest-shaped object ready to store in AppContext.
 */
export function parseImagingToRequest(
  label: string,
  urgency?: string,
  indication?: string,
): ParsedRadiologyRequest {
  const modality = detectModality(label);
  const ctContrast = modality === 'CT' ? detectContrast(label) : 'none';
  const mriProtocol = /mrcp/.test(label.toLowerCase())
    ? 'MRCP (magnetic cholangiopancreatography)'
    : '';

  return {
    id: crypto.randomUUID(),
    modality,
    anatomicalRegion: detectRegion(label),
    laterality: '',
    urgency: detectUrgency(urgency),
    indication: indication ?? label,
    clinicalQuestion: label,
    ctContrast,
    ctContrastType: '',
    ctEgfr: '',
    mriProtocol,
    mriSequences: '',
    scopeType: '',
    functionalType: '',
    otherDescription: modality === 'Other' ? label : '',
    resultReceived: false,
    resultNotes: '',
  };
}

/**
 * Dedup guard: returns true if an equivalent request already exists.
 * Matches on modality + anatomicalRegion (case-insensitive).
 */
export function imagingAlreadyRequested(
  existing: { modality: string; anatomicalRegion: string; clinicalQuestion?: string }[],
  candidate: { modality: string; anatomicalRegion: string; clinicalQuestion?: string },
): boolean {
  const m = candidate.modality.toLowerCase();
  const r = candidate.anatomicalRegion.toLowerCase().trim();
  const q = (candidate.clinicalQuestion ?? '').toLowerCase().trim();
  return existing.some(x => {
    const xm = x.modality.toLowerCase();
    const xr = x.anatomicalRegion.toLowerCase().trim();
    const xq = (x.clinicalQuestion ?? '').toLowerCase().trim();
    // Same modality + region is a dupe; or same full clinical question
    return xm === m && (xr === r || (q && xq === q));
  });
}
