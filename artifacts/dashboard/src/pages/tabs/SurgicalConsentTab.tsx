import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import SmartTextarea from '@/components/SmartTextarea';
import { downloadAsWord } from './lib/pdfExport';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

/* ── Canvas signature pad ───────────────────────────────────────────────── */
interface SigPadProps { label: string; value: string; onChange: (v: string) => void; }

function SignaturePad({ label, value, onChange }: SigPadProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const ownChange = useRef(false);

  useEffect(() => {
    if (ownChange.current) { ownChange.current = false; return; }
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) { const img = new Image(); img.onload = () => { if (ref.current) ctx.drawImage(img, 0, 0); }; img.src = value; }
  }, [value]);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const rect = ref.current!.getBoundingClientRect();
    if ('touches' in e) { const t = e.touches[0]; return { x: t.clientX - rect.left, y: t.clientY - rect.top }; }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); if (!drawing.current || !lastPos.current) return;
    const ctx = ref.current!.getContext('2d')!; const pos = getPos(e);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    lastPos.current = pos;
  };
  const endDraw = useCallback(() => {
    if (!drawing.current) return; drawing.current = false; lastPos.current = null;
    if (!ref.current) return; ownChange.current = true; onChange(ref.current.toDataURL());
  }, [onChange]);
  function clear() {
    const canvas = ref.current; if (!canvas) return;
    canvas.getContext('2d')!.fillStyle = '#fff'; canvas.getContext('2d')!.fillRect(0, 0, canvas.width, canvas.height);
    ownChange.current = true; onChange('');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        {value && <button type="button" onClick={clear} style={{ fontSize: 11, color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer' }}>Clear</button>}
      </div>
      <canvas ref={ref} width={600} height={100} style={{ width: '100%', height: 100, border: `1px solid ${value ? '#86efac' : '#d1d5db'}`, borderRadius: 6, cursor: 'crosshair', touchAction: 'none', background: '#fff', display: 'block' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      {!value && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>Sign above using mouse or finger</div>}
    </div>
  );
}

/* ── Consent & prep data ─────────────────────────────────────────────────── */

const COMMON_RISKS = [
  'Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)',
  'Pulmonary embolism (PE)', 'Anaesthetic complications', 'Damage to surrounding structures',
  'Conversion to open surgery', 'Hernia at port / incision site', 'Recurrence of condition',
  'Chronic pain at incision site', 'Death (rare)',
];

interface ProcedureTemplate {
  id: string;
  procedure: string;
  anaesthesia: string;
  alternatives: string;
  generalRisks: string[];
  specificRisks: string[];
  visitTypeIds: string[];   // maps to AppContext visitType
  prep: {
    fastingFrom: string;
    bowelPrep: string;
    medications: string;
    morning: string[];
    whatToExpect: string;
    recovery: string;
    patientLeaflet: string; // plain-language paragraph for patient
  };
}

const PROCEDURE_TEMPLATES: ProcedureTemplate[] = [
  {
    id: 'lap_chole',
    procedure: 'Laparoscopic cholecystectomy',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Open cholecystectomy; conservative management with dietary modification',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Pulmonary embolism (PE)', 'Anaesthetic complications', 'Conversion to open surgery'],
    specificRisks: ['Bile duct injury', 'Bile leak', 'Retained stone in CBD', 'Port site hernia', 'Bowel injury'],
    visitTypeIds: ['day_of_surgery'],
    prep: {
      fastingFrom: 'No solid food or milk from midnight. Clear fluids (water, black tea, black coffee) permitted until 2 hours before surgery.',
      bowelPrep: 'Not required.',
      medications: 'Continue all regular medications with a sip of water on the morning of surgery unless specifically advised otherwise. Hold anticoagulants as directed.',
      morning: ['Shower the evening before and on the morning of surgery.', 'Remove nail polish, jewellery, and piercings.', 'Wear comfortable loose clothing.', 'Arrange a responsible adult to drive you home and stay overnight.'],
      whatToExpect: 'You will be admitted on the day of surgery. The operation takes 45–90 minutes under general anaesthesia. Most patients go home the same day or after one night. You will have 3–4 small cuts (5–10 mm) on your abdomen.',
      recovery: 'Most patients return to light activity within 1–2 weeks and full activity in 2–4 weeks. Avoid driving for 1 week. Return to work (desk job) in 1–2 weeks.',
      patientLeaflet: 'Your gallbladder will be removed through 3 or 4 small cuts in your abdomen using a camera and fine instruments. This avoids the need for a large open cut. The operation is performed under general anaesthetic and usually takes under 90 minutes. Most patients go home the same day. You may feel some shoulder tip pain from the gas used — this usually settles in 24–48 hours. Expect some abdominal soreness for 1–2 weeks.',
    },
  },
  {
    id: 'appendicectomy',
    procedure: 'Appendicectomy (laparoscopic)',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Open appendicectomy; non-operative antibiotic management (selected cases)',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Anaesthetic complications', 'Conversion to open surgery'],
    specificRisks: ['Intra-abdominal collection', 'Stump leak', 'Bowel obstruction'],
    visitTypeIds: ['day_of_surgery'],
    prep: {
      fastingFrom: 'Emergency surgery: fast from the time of decision. Elective: no food or milk from midnight; clear fluids until 2 hours before.',
      bowelPrep: 'Not required.',
      medications: 'Continue regular medications unless directed otherwise. IV antibiotics will be given at induction.',
      morning: ['You do not need to eat or drink before the operation.', 'Remove jewellery, piercings, and nail polish.', 'Arrange someone to take you home after discharge.'],
      whatToExpect: 'The operation removes your appendix through 3 small cuts under general anaesthetic. It usually takes 30–60 minutes. Most patients stay 1–2 nights. You will receive IV antibiotics during the operation.',
      recovery: 'Return to light activity in 1–2 weeks, full activity in 3–4 weeks. Avoid strenuous exercise and heavy lifting for 4 weeks.',
      patientLeaflet: 'Your appendix — a small pouch attached to the large bowel — has become inflamed and needs to be removed. The operation is done using keyhole (laparoscopic) surgery through 3 small cuts. It is performed under general anaesthetic and usually takes about 45 minutes. You will need antibiotics during and after the operation to treat the infection. Most people go home after 1–2 days and feel back to normal within 2–3 weeks.',
    },
  },
  {
    id: 'hernia_repair',
    procedure: 'Inguinal hernia repair (laparoscopic, mesh)',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Open tension-free mesh repair; watchful waiting for asymptomatic hernias',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Anaesthetic complications', 'Hernia at port / incision site'],
    specificRisks: ['Mesh infection', 'Chronic groin pain', 'Testicular atrophy (inguinal)', 'Recurrence'],
    visitTypeIds: ['day_of_surgery'],
    prep: {
      fastingFrom: 'No solid food or milk from midnight. Clear fluids until 2 hours before.',
      bowelPrep: 'Not required.',
      medications: 'Continue all regular medications. Hold anticoagulants as per anaesthetic team\'s instructions.',
      morning: ['Shower on the morning of surgery.', 'Remove jewellery, nail polish, and piercings.', 'Wear comfortable loose clothing — avoid tight underwear.', 'Arrange transport and overnight supervision.'],
      whatToExpect: 'The hernia (bulge in the groin) is repaired through 3 small cuts using a mesh to strengthen the abdominal wall. The operation takes 45–90 minutes under general anaesthetic. Most patients go home the same day.',
      recovery: 'Avoid lifting anything heavier than a kettle for 2 weeks. Return to light work in 1–2 weeks, heavy manual work in 4–6 weeks. Some scrotal swelling and bruising is normal for 1–2 weeks.',
      patientLeaflet: 'A hernia is a weakness in the muscle wall that allows internal tissue to push through, creating a lump in your groin. The operation repairs this weakness using a small piece of mesh placed through keyhole cuts. The mesh acts like a scaffold to permanently strengthen the area. The operation is performed under general anaesthetic. You will go home the same day. Most people feel well enough to return to normal activities in 1–2 weeks, although heavy lifting should be avoided for 4–6 weeks.',
    },
  },
  {
    id: 'colonoscopy',
    procedure: 'Colonoscopy ± polypectomy',
    anaesthesia: 'Sedation',
    alternatives: 'CT colonography; flexible sigmoidoscopy (limited); watchful waiting',
    generalRisks: ['Anaesthetic complications'],
    specificRisks: ['Perforation', 'Bleeding post-polypectomy', 'Incomplete examination'],
    visitTypeIds: ['endoscopy_col'],
    prep: {
      fastingFrom: 'Low-residue diet for 2 days before. Clear fluids only on the day before. No solid food from midnight before the procedure.',
      bowelPrep: 'Bowel preparation solution (e.g. Moviprep or Plenvu) as prescribed — split dose: evening before and morning of. Drink 2–3 litres of clear fluid in addition to the prep.',
      medications: 'Hold iron supplements for 7 days. Hold anticoagulants and antiplatelet agents as instructed. Continue blood pressure and heart medications with a sip of water. Diabetic patients: contact clinic for specific insulin/oral hypoglycaemic adjustment.',
      morning: ['Complete the morning bowel prep dose (if split prep).', 'Nothing to eat or drink after completing prep (except small sip of water for tablets).', 'Arrange a driver — you cannot drive after sedation.', 'Bring a list of your medications.'],
      whatToExpect: 'A flexible camera is passed through your back passage to examine the entire large bowel (colon). The procedure takes 20–45 minutes. Sedation (not full anaesthetic) is given to keep you comfortable. Any polyps found will be removed at the same time. You will be in the unit for 2–3 hours in total.',
      recovery: 'You may feel bloated for a few hours after the procedure. You can eat normally once you feel ready. Avoid driving, alcohol, and important decisions for 24 hours after sedation. If polyps were removed, avoid blood-thinning medications for 5–7 days unless directed otherwise.',
      patientLeaflet: 'A colonoscopy is a camera test to examine the inside of your large bowel. A thin flexible tube with a tiny camera on the end is gently passed through your back passage. This allows the doctor to check for polyps (small growths), inflammation, or other changes. If polyps are found, they are removed safely during the procedure. You will be given a sedative to make you comfortable — this is not a general anaesthetic. The test usually takes 20–45 minutes. Good bowel preparation is essential: please follow the prep instructions carefully as a poor preparation may mean the test has to be repeated.',
    },
  },
  {
    id: 'ercp',
    procedure: 'ERCP ± sphincterotomy / stone extraction',
    anaesthesia: 'Sedation',
    alternatives: 'Laparoscopic bile duct exploration; percutaneous transhepatic cholangiography (PTC)',
    generalRisks: ['Anaesthetic complications', 'Bleeding requiring transfusion'],
    specificRisks: ['Pancreatitis', 'Cholangitis', 'Perforation', 'Bleeding', 'Incomplete duct clearance'],
    visitTypeIds: ['ercp'],
    prep: {
      fastingFrom: 'No solid food or milk for 6 hours before. Clear fluids permitted until 2 hours before the procedure.',
      bowelPrep: 'Not required.',
      medications: 'Hold anticoagulants and antiplatelet agents as instructed. Continue blood pressure, heart, and thyroid medications with a sip of water. Do not take metformin on the day of the procedure.',
      morning: ['Nothing to eat or drink from midnight (or as instructed).', 'Arrange a driver — you cannot drive after sedation.', 'Bring a list of your medications and any relevant scan/blood results.', 'Bring your blood group card if known.'],
      whatToExpect: 'A flexible camera is passed through your mouth and into the small bowel to access the bile duct opening. The doctor will inject dye to outline the bile duct (cholangiogram) and remove any stones or place a stent to relieve blockage. The procedure takes 30–90 minutes. You will be in the unit for approximately 4 hours in total and observed for at least 2 hours afterwards for any complications.',
      recovery: 'You may feel some throat soreness and mild abdominal discomfort. Eat a light meal 2–4 hours after the procedure if you feel well. Avoid driving and alcohol for 24 hours after sedation. Pancreatitis (inflammation of the pancreas) is the most common complication — attend the emergency department immediately if you develop severe abdominal pain in the hours after the procedure.',
      patientLeaflet: 'ERCP (Endoscopic Retrograde Cholangiopancreatography) is a procedure that allows the doctor to examine and treat the bile duct — the tube that carries bile from your liver to your small intestine. A thin flexible telescope is passed through your mouth, stomach, and into the opening of the bile duct. Using X-ray guidance, the doctor can remove gallstones lodged in the bile duct, widen a narrowing, or place a small plastic tube (stent) to keep the duct open. The procedure is performed under sedation so you will be drowsy but not unconscious. Pancreatitis (inflammation of the pancreas) occurs in up to 5% of cases — seek immediate medical attention if you develop severe abdominal pain after the procedure.',
    },
  },
  {
    id: 'ogd',
    procedure: 'OGD (upper GI endoscopy)',
    anaesthesia: 'Sedation',
    alternatives: 'Barium swallow (limited); capsule endoscopy',
    generalRisks: ['Anaesthetic complications'],
    specificRisks: ['Perforation', 'Bleeding post-biopsy', 'Aspiration', 'Missed lesion'],
    visitTypeIds: ['endoscopy_ogd'],
    prep: {
      fastingFrom: 'No solid food or milk for 6 hours. Clear fluids permitted until 2 hours before the procedure.',
      bowelPrep: 'Not required.',
      medications: 'Hold iron supplements for 5 days (they darken the stomach lining). Continue all other regular medications with a sip of water. If you take anticoagulants, contact clinic for instructions.',
      morning: ['Nothing to eat or drink from midnight (or as instructed for afternoon procedures: fast from 7am).', 'Throat spray or sedation will be offered — discuss preference with the nurse.', 'Arrange a driver if having sedation.', 'Remove dentures, contact lenses, and jewellery.'],
      whatToExpect: 'A thin flexible camera is passed through your mouth and into your oesophagus, stomach, and first part of the small bowel. The procedure takes 5–15 minutes. Biopsy samples may be taken — this is painless. If having sedation, you will be drowsy and monitored for 30–60 minutes after.',
      recovery: 'You may feel a mild sore throat for 24 hours. Eat normally once you feel ready (usually 1–2 hours after if no sedation, or when fully awake if sedated). Avoid driving, alcohol, and important decisions for 24 hours if sedated.',
      patientLeaflet: 'An OGD (gastroscopy) is a camera test to look at the inside of your food pipe (oesophagus), stomach, and the first part of your small intestine. A thin flexible tube with a tiny light and camera on the end is gently passed through your mouth. The test takes about 10 minutes. You may have a local anaesthetic throat spray to numb the back of your throat, or you can choose to have sedation to make you more relaxed. Small tissue samples (biopsies) can be taken painlessly. Most patients find the test much more tolerable than they expected.',
    },
  },
  {
    id: 'thyroidectomy',
    procedure: 'Thyroidectomy (total / hemithyroidectomy)',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Radioactive iodine therapy; anti-thyroid medication; surveillance',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Anaesthetic complications'],
    specificRisks: ['Recurrent laryngeal nerve injury (hoarseness)', 'Hypocalcaemia (low calcium)', 'Hypothyroidism requiring lifelong thyroxine', 'Haematoma requiring return to theatre'],
    visitTypeIds: ['day_of_surgery'],
    prep: {
      fastingFrom: 'No solid food or milk from midnight. Clear fluids until 2 hours before.',
      bowelPrep: 'Not required.',
      medications: 'Continue anti-thyroid medications (carbimazole/propylthiouracil) until the day of surgery. Continue beta-blockers if prescribed. Contact the clinic about anticoagulants.',
      morning: ['Shower the morning of surgery.', 'Do not apply moisturiser or powder to the neck area.', 'Wear a loose-fitting top that opens at the front.', 'Arrange transport and overnight supervision — you will stay at least one night.'],
      whatToExpect: 'The thyroid gland (or part of it) is removed through a small horizontal cut in the lower neck, hidden in a natural skin crease. The operation takes 1.5–3 hours under general anaesthetic. You will stay in hospital for 1–2 nights. Blood calcium levels will be checked after surgery.',
      recovery: 'Avoid heavy lifting and strenuous activity for 2 weeks. The neck scar fades significantly over 3–6 months — silicone gel strips may be recommended. If total thyroidectomy is performed, you will require lifelong thyroxine (thyroid hormone) replacement tablets.',
      patientLeaflet: 'Your thyroid gland — a butterfly-shaped gland at the front of your neck — is to be removed (either wholly or in part). The operation is done through a small, neat cut in the natural crease of your neck. Most patients find the scar heals very well and becomes barely visible within a few months. The main risks specific to this operation are a change in the voice (if the nerve to the voice box is affected) and low calcium levels, both of which are usually temporary. If your whole thyroid is removed, you will need to take a daily thyroid hormone tablet (thyroxine) for the rest of your life.',
    },
  },
  {
    id: 'mastectomy',
    procedure: 'Mastectomy ± sentinel lymph node biopsy',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Wide local excision (breast conservation); neoadjuvant chemotherapy then reassess',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Anaesthetic complications'],
    specificRisks: ['Lymphoedema', 'Seroma (fluid collection)', 'Shoulder stiffness', 'Altered sensation or body image', 'Flap necrosis (if reconstruction)'],
    visitTypeIds: ['breast'],
    prep: {
      fastingFrom: 'No solid food or milk from midnight. Clear fluids until 2 hours before.',
      bowelPrep: 'Not required.',
      medications: 'Continue all regular medications. Discuss anticoagulants with the anaesthetic team. Do not apply deodorant or lotions to the chest or underarm on the morning of surgery.',
      morning: ['Shower the evening before and on the morning of surgery (use antibacterial soap if supplied).', 'Do not apply deodorant, talc, or creams to the chest, axilla, or shoulder area.', 'Wear a comfortable front-opening top.', 'Arrange transport and someone to stay with you overnight.'],
      whatToExpect: 'The breast tissue (and sometimes a small amount of lymph nodes from under the arm) is removed under general anaesthetic. The procedure takes 1.5–3 hours. A drain may be placed to prevent fluid build-up. You will typically stay 1–2 nights. A breast care nurse will visit you and support you with reconstruction options if appropriate.',
      recovery: 'Shoulder exercises will begin the day after surgery to prevent stiffness. Avoid heavy lifting for 4–6 weeks. Drain is usually removed after 2–5 days. You will be seen in clinic within 2 weeks for wound review and pathology results.',
      patientLeaflet: 'This operation removes the breast tissue to treat or prevent breast cancer. A sentinel lymph node biopsy may be performed at the same time — a small number of lymph nodes (glands under the arm) are removed to check whether the cancer has spread. The operation is performed under general anaesthetic. You will have a surgical drain (a thin tube) coming from the wound for a few days to prevent fluid build-up. Your breast care nurse will guide you through recovery, wound care, and discuss reconstruction options if desired. Physiotherapy exercises started early after surgery are important to maintain full shoulder movement.',
    },
  },
  {
    id: 'wle',
    procedure: 'Wide local excision (skin lesion / melanoma)',
    anaesthesia: 'Local anaesthesia',
    alternatives: 'Surveillance with repeat biopsy (benign lesions only)',
    generalRisks: ['Bleeding', 'Infection / wound infection'],
    specificRisks: ['Incomplete excision requiring re-excision', 'Scar / keloid formation', 'Altered sensation around scar'],
    visitTypeIds: [],
    prep: {
      fastingFrom: 'Not required for local anaesthesia only. If sedation planned: no food or milk for 6 hours.',
      bowelPrep: 'Not required.',
      medications: 'Continue all regular medications. Inform the surgeon if you are on aspirin, warfarin, or other blood thinners.',
      morning: ['Eat and drink normally unless sedation is planned.', 'Wear comfortable loose clothing that gives easy access to the area.', 'Remove jewellery near the site.'],
      whatToExpect: 'The skin lesion is removed with a margin of normal tissue under local anaesthetic injection. The procedure takes 15–45 minutes. The wound is closed with stitches. You will go home the same day. Pathology results are usually available within 2 weeks.',
      recovery: 'Keep the wound clean and dry for 48 hours. Avoid strenuous activity for 1–2 weeks. Sutures are removed at 7–14 days depending on the location.',
      patientLeaflet: 'This operation removes a skin lesion (such as a mole, cyst, or skin cancer) along with a small margin of normal skin around it. This margin is important to ensure complete removal. The procedure is performed under local anaesthetic — a small injection to numb the area — so you will be awake but will not feel pain. The removed tissue is sent to the laboratory to confirm the diagnosis. You will go home the same day.',
    },
  },
  {
    id: 'anterior_resection',
    procedure: 'Anterior resection (laparoscopic)',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Hartmann\'s procedure; palliative stoma alone; neoadjuvant radiotherapy',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Pulmonary embolism (PE)', 'Anaesthetic complications', 'Conversion to open surgery'],
    specificRisks: ['Anastomotic leak (bowel join failure)', 'Temporary protecting stoma', 'Bladder / sexual dysfunction', 'Ileus (bowel not working)', 'Permanent stoma (if leak occurs)'],
    visitTypeIds: ['day_of_surgery'],
    prep: {
      fastingFrom: 'Enhanced Recovery After Surgery (ERAS) protocol: carbohydrate drink until 2 hours before surgery. No solid food from midnight.',
      bowelPrep: 'Oral bowel preparation as prescribed (check with surgeon). Combined with mechanical prep and oral antibiotic prophylaxis in many centres.',
      medications: 'Continue all regular medications with a sip of water. Hold anticoagulants as instructed. DVT prophylaxis (injections and compression stockings) will start before or shortly after surgery.',
      morning: ['Shower with chlorhexidine wash if supplied.', 'Wear comfortable loose clothing.', 'You will be admitted the morning of surgery unless instructed otherwise.', 'Expect to stay in hospital 3–7 days.', 'Have a family member available for discharge planning discussions.'],
      whatToExpect: 'The diseased section of the large bowel (usually sigmoid colon and upper rectum) is removed and the healthy ends joined together (anastomosis). This is performed through keyhole (laparoscopic) incisions. The operation takes 2–4 hours under general anaesthetic. Enhanced recovery protocols (early mobilisation, oral feeding within 24 hours, multimodal analgesia) aim to speed recovery.',
      recovery: 'Expect 3–7 days in hospital. Walking begins the first day after surgery. Diet progresses from clear fluids to normal over 1–3 days. Full recovery takes 4–8 weeks. Bowel habit may be altered for several months (more frequent, looser stools) — this usually improves over 3–6 months. Return to clinic in 2 weeks for wound review and to discuss pathology results.',
      patientLeaflet: 'This operation removes a section of the large bowel (colon/rectum) that is affected by cancer or another disease. The bowel is then rejoined (anastomosis). It is performed using keyhole (laparoscopic) surgery through several small cuts in the abdomen. The operation takes 2–4 hours under general anaesthetic. A temporary loop stoma (bag on the abdomen) is sometimes created to protect the bowel join while it heals — if so, this is usually reversed after 3 months. Your bowel habits may be altered for several months after surgery — this is normal and usually settles. You will be cared for under an Enhanced Recovery programme aimed at getting you mobile, eating, and home as quickly as safely possible.',
    },
  },
];

const VISIT_TYPE_TO_TEMPLATE: Record<string, string> = {
  ercp:           'ercp',
  endoscopy_ogd:  'ogd',
  endoscopy_col:  'colonoscopy',
  breast:         'mastectomy',
};

function procedureRisks(procedure: string): string[] {
  const p = procedure.toLowerCase();
  for (const t of PROCEDURE_TEMPLATES) {
    if (p.includes(t.procedure.split('(')[0].toLowerCase().trim())) return t.specificRisks;
  }
  return [];
}

function ectDateStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' });
}

/* ── PDF/Print helpers ───────────────────────────────────────────────────── */

function printConsentPdf(opts: {
  patientName: string; age: string; sex: string; dob?: string; nhiNumber?: string;
  procedure: string; anaesthesia: string; alternatives: string;
  generalRisks: string[]; specificRisks: string[];
  capacity: boolean; interpreterUsed: boolean;
  patientQuestions: string; notes: string;
  clinicianName: string; consentDate: string;
  patientSig: string; clinicianSig: string;
}) {
  const allRisks = [...opts.generalRisks, ...opts.specificRisks];
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Surgical Consent — ${opts.patientName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 28px; max-width: 780px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 18px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #1e3a5f; border-bottom: 1px solid #c7d2fe; padding-bottom: 3px; margin-bottom: 8px; }
  .field { margin-bottom: 6px; }
  .field label { font-weight: bold; }
  .risks { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
  .risk-chip { background: #eff6ff; border: 1px solid #93c5fd; border-radius: 12px; padding: 2px 9px; font-size: 11px; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
  .sig-box { border-top: 1px solid #aaa; padding-top: 6px; }
  .sig-box label { font-size: 10px; text-transform: uppercase; color: #666; }
  img.sig { width: 100%; height: 70px; object-fit: contain; border: 1px solid #e2e8f0; background: #fff; margin: 4px 0; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 18px; }
  .lh-name { font-size: 16px; font-weight: 800; color: #1e3a5f; }
  .lh-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="letterhead">
  <div><div class="lh-name">AMISE MEDICAL SERVICES</div>
  <div class="lh-sub">Dr Dawit Daniel Kabiye, MD, DM · General &amp; Endoscopic Surgery · Saint Lucia</div></div>
  <div style="font-size:11px;color:#64748b;text-align:right">Surgical Consent Form<br>${opts.consentDate}</div>
</div>
<h1>Consent for Surgical / Endoscopic Procedure</h1>
<div class="section">
  <div class="section-title">Patient details</div>
  <div class="field"><label>Name:</label> ${opts.patientName || '—'}</div>
  <div class="field"><label>Age / Sex:</label> ${[opts.age && `${opts.age}y`, opts.sex].filter(Boolean).join(' · ') || '—'}</div>
  ${opts.dob ? `<div class="field"><label>Date of birth:</label> ${opts.dob}</div>` : ''}
  ${opts.nhiNumber ? `<div class="field"><label>NHI number:</label> ${opts.nhiNumber}</div>` : ''}
</div>
<div class="section">
  <div class="section-title">Procedure</div>
  <div class="field"><label>Operation / procedure:</label> ${opts.procedure}</div>
  <div class="field"><label>Anaesthesia:</label> ${opts.anaesthesia}</div>
  ${opts.alternatives ? `<div class="field"><label>Alternatives discussed:</label> ${opts.alternatives}</div>` : ''}
</div>
${allRisks.length > 0 ? `<div class="section">
  <div class="section-title">Risks discussed with patient</div>
  <div class="risks">${allRisks.map(r => `<span class="risk-chip">${r}</span>`).join('')}</div>
</div>` : ''}
<div class="section">
  <div class="section-title">Capacity and consent</div>
  <div class="field">${opts.capacity ? '✓ Patient has mental capacity to consent' : '⚠ Capacity assessment required — best-interests decision-making process initiated'}</div>
  ${opts.interpreterUsed ? '<div class="field">✓ Interpreter used</div>' : ''}
  ${opts.patientQuestions ? `<div class="field"><label>Patient questions / notes:</label> ${opts.patientQuestions}</div>` : ''}
  ${opts.notes ? `<div class="field"><label>Additional notes:</label> ${opts.notes}</div>` : ''}
</div>
<div class="section">
  <div class="section-title">Declaration</div>
  <p style="font-size:12px;line-height:1.7;color:#334155">
    I confirm that I have been given information about the nature, purpose, intended benefits, and material risks of the above procedure, including the risks of not having treatment. I have had the opportunity to ask questions and have had them answered to my satisfaction. I understand that I may withdraw my consent at any time before the procedure begins.
  </p>
</div>
<div class="sig-row">
  <div class="sig-box">
    <label>Patient signature</label>
    ${opts.patientSig ? `<img class="sig" src="${opts.patientSig}" alt="patient signature" />` : '<div style="height:70px;border:1px dashed #aaa;margin:4px 0;"></div>'}
    <div style="font-size:11px;color:#555;margin-top:2px;">${opts.patientName || ''}${opts.dob ? ` · DOB: ${opts.dob}` : ''}${opts.nhiNumber ? ` · NHI: ${opts.nhiNumber}` : ''} — ${opts.consentDate}</div>
  </div>
  <div class="sig-box">
    <label>Clinician signature</label>
    ${opts.clinicianSig ? `<img class="sig" src="${opts.clinicianSig}" alt="clinician signature" />` : '<div style="height:70px;border:1px dashed #aaa;margin:4px 0;"></div>'}
    <div style="font-size:11px;color:#555;margin-top:2px;">${opts.clinicianName || 'Dr Dawit Daniel Kabiye'} — ${opts.consentDate}</div>
  </div>
</div>
<div class="footer">
  This consent form was completed on ${opts.consentDate} at Amise Medical Services, Saint Lucia.
  The patient confirms they have been given the opportunity to ask questions and understand the procedure, anaesthesia, risks, and alternatives described above.
</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=800,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

function printPatientLeaflet(opts: {
  patientName: string; procedure: string; consentDate: string;
  prep: ProcedureTemplate['prep'] | null;
}) {
  if (!opts.prep) return;
  const p = opts.prep;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Patient Information — ${opts.procedure}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 28px; max-width: 680px; margin: 0 auto; }
  .letterhead { border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 18px; }
  .lh-name { font-size: 16px; font-weight: 800; color: #1e3a5f; }
  .lh-sub { font-size: 10px; color: #64748b; }
  h1 { font-size: 17px; font-weight: 800; color: #0B2545; margin-bottom: 6px; }
  h2 { font-size: 13px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 18px 0 8px; }
  p { line-height: 1.75; margin-bottom: 8px; color: #334155; }
  ul { margin: 6px 0 8px 20px; }
  ul li { margin-bottom: 4px; color: #334155; line-height: 1.6; }
  .highlight { background: #fef9c3; border-left: 3px solid #f59e0b; padding: 8px 12px; border-radius: 4px; font-size: 12px; color: #78350f; margin: 10px 0; }
  .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="letterhead">
  <div class="lh-name">AMISE MEDICAL SERVICES</div>
  <div class="lh-sub">Dr Dawit Daniel Kabiye, MD, DM · General &amp; Endoscopic Surgery · Saint Lucia</div>
</div>
<h1>Patient Information — ${opts.procedure}</h1>
<p style="font-size:12px;color:#64748b">Prepared for: <strong>${opts.patientName || 'Patient'}</strong> · ${opts.consentDate}</p>

<h2>About this procedure</h2>
<p>${opts.prep.patientLeaflet}</p>

<h2>Preparation before your procedure</h2>
${p.fastingFrom ? `<p><strong>Fasting:</strong> ${p.fastingFrom}</p>` : ''}
${p.bowelPrep && p.bowelPrep !== 'Not required.' ? `<p><strong>Bowel preparation:</strong> ${p.bowelPrep}</p>` : ''}
${p.medications ? `<p><strong>Medications:</strong> ${p.medications}</p>` : ''}
${p.morning.length > 0 ? `<h2>On the day of your procedure</h2><ul>${p.morning.map(m => `<li>${m}</li>`).join('')}</ul>` : ''}

<h2>What to expect</h2>
<p>${p.whatToExpect}</p>

<h2>Recovery and after-care</h2>
<p>${p.recovery}</p>

<div class="highlight">
  <strong>Contact us immediately</strong> if you experience: severe or worsening pain, high fever (above 38.5°C), excessive bleeding, inability to pass urine, or any other symptom that concerns you.<br>
  <strong>Practice number:</strong> +1 (758) 284-0557 (Tapion) · +1 (758) 720-7111 (Rodney Bay)
</div>

<div class="footer">
  This leaflet has been prepared by Amise Medical Services as a guide only. It does not replace the discussion you had with your surgeon. Please ask your doctor or nurse if you have any questions.
  <br>Amise Medical Services · Saint Lucia · ${opts.consentDate}
</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=720,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function SurgicalConsentTab() {
  const ctx = useAppContext();
  const { patientName, age, sex, dob, nhiNumber, plan, assessment, visitType, email } = ctx;
  const [procedure, setProcedure] = useState('');
  const [anaesthesia, setAnaesthesia] = useState('General anaesthesia');
  const [alternatives, setAlternatives] = useState('');
  const [specificRisks, setSpecificRisks] = useState<string[]>([]);
  const [generalRisks, setGeneralRisks] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(true);
  const [patientQuestions, setPatientQuestions] = useState('');
  const [interpreterUsed, setInterpreterUsed] = useState(false);
  const [consentDate, setConsentDate] = useState(ectDateStr());
  const [notes, setNotes] = useState('');
  const [patientSig, setPatientSig] = useState('');
  const [clinicianSig, setClinicianSig] = useState('');
  const [clinicianName, setClinicianName] = useState('Dr Dawit Daniel Kabiye, MD, DM');
  const [signed, setSigned] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const seededRef = useRef(false);

  // Auto-seed from visitType first, then fall back to plan/assessment text
  useEffect(() => {
    if (seededRef.current || procedure) return;
    const vtTemplateId = VISIT_TYPE_TO_TEMPLATE[visitType ?? ''];
    const tmpl = PROCEDURE_TEMPLATES.find(t => t.id === vtTemplateId);
    if (tmpl) {
      seededRef.current = true;
      setProcedure(tmpl.procedure);
      setAnaesthesia(tmpl.anaesthesia);
      setAlternatives(tmpl.alternatives);
      setGeneralRisks(tmpl.generalRisks);
      setSpecificRisks(tmpl.specificRisks);
      return;
    }
    const src = plan || assessment || '';
    const m = src.match(/(?:plan(?:ned)?(?:\s+(?:procedure|operation|surgery))?|for|procedure)[:\s–-]+([^\n.;,]{6,80})/i);
    if (m) { seededRef.current = true; setProcedure(m[1].trim()); }
  }, [visitType, plan, assessment, procedure]);

  function applyTemplate(t: ProcedureTemplate) {
    setProcedure(t.procedure); setAnaesthesia(t.anaesthesia); setAlternatives(t.alternatives);
    setGeneralRisks(t.generalRisks); setSpecificRisks(t.specificRisks);
    setSigned(false);
  }

  const matchedTemplate = PROCEDURE_TEMPLATES.find(t =>
    procedure && t.procedure.toLowerCase() === procedure.toLowerCase()
  ) ?? null;

  const procedureSpecific = procedureRisks(procedure);
  const toggleRisk = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    arr.includes(v) ? setArr(arr.filter(r => r !== v)) : setArr([...arr, v]);

  const inp: React.CSSProperties = { fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: '100%', background: 'var(--bg)', color: 'var(--ink)' };

  async function handleEmailPatient() {
    if (!email) { alert('No patient email address on file. Add it in the Intake tab.'); return; }
    if (!procedure) { alert('Please enter a procedure name first.'); return; }
    setEmailStatus('sending');
    try {
      const API_ORIGIN = getApiOrigin();
      const authHeaders = await staffAuthHeaders();
      const res = await fetch(`${API_ORIGIN}/api/send-patient-prep-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          toEmail: email,
          patientName,
          procedure,
          consentDate,
          prep: matchedTemplate?.prep ?? null,
        }),
      });
      setEmailStatus(res.ok ? 'sent' : 'error');
    } catch { setEmailStatus('error'); }
    setTimeout(() => setEmailStatus('idle'), 4000);
  }

  return (
    <div className="gap-y">
      {/* Header */}
      <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Surgical Consent Documentation</div>
        <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>
          {patientName || 'Patient'}{age ? `, ${age}y` : ''}{sex && sex !== 'unknown' ? ` · ${sex}` : ''}
          {visitType ? ` · ${visitType.replace(/_/g, ' ')}` : ''}
        </div>
      </div>

      {/* Quick-fill templates */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Select procedure template
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {PROCEDURE_TEMPLATES.map(t => {
            const active = procedure === t.procedure;
            return (
              <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${active ? '#1e3a5f' : '#d1d5db'}`,
                  background: active ? '#1e3a5f' : '#f8fafc',
                  color: active ? '#fff' : '#374151', fontWeight: active ? 700 : 400 }}>
                {t.procedure.split('(')[0].trim()}
              </button>
            );
          })}
        </div>
      </div>

      <CollapsibleCard title="Procedure details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>PROCEDURE / OPERATION</label>
            <input value={procedure} onChange={e => setProcedure(e.target.value)} style={inp} placeholder="e.g. Laparoscopic cholecystectomy" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>ANAESTHESIA</label>
            <select value={anaesthesia} onChange={e => setAnaesthesia(e.target.value)} style={inp}>
              <option>General anaesthesia</option>
              <option>Spinal anaesthesia</option>
              <option>Regional / epidural</option>
              <option>Local anaesthesia</option>
              <option>Sedation</option>
              <option>Local + sedation</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>CONSENT DATE</label>
            <input type="date" value={consentDate} onChange={e => setConsentDate(e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>ALTERNATIVES DISCUSSED</label>
            <input value={alternatives} onChange={e => setAlternatives(e.target.value)} style={inp} placeholder="e.g. Conservative management, endoscopic approach, watchful waiting" />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="General risks discussed">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COMMON_RISKS.map(r => (
            <button key={r} type="button" onClick={() => toggleRisk(generalRisks, setGeneralRisks, r)}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: `1px solid ${generalRisks.includes(r) ? '#3b82f6' : '#d1d5db'}`, background: generalRisks.includes(r) ? '#eff6ff' : 'var(--bg)', color: generalRisks.includes(r) ? '#1d4ed8' : '#475569', cursor: 'pointer', fontWeight: generalRisks.includes(r) ? 600 : 400 }}>
              {r}
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {procedureSpecific.length > 0 && (
        <CollapsibleCard title={`Procedure-specific risks — ${procedure.split('(')[0].trim()}`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {procedureSpecific.map(r => (
              <button key={r} type="button" onClick={() => toggleRisk(specificRisks, setSpecificRisks, r)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: `1px solid ${specificRisks.includes(r) ? '#7c3aed' : '#d1d5db'}`, background: specificRisks.includes(r) ? '#f5f3ff' : 'var(--bg)', color: specificRisks.includes(r) ? '#5b21b6' : '#475569', cursor: 'pointer', fontWeight: specificRisks.includes(r) ? 600 : 400 }}>
                {r}
              </button>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* Pre-operative preparation */}
      {matchedTemplate && (
        <CollapsibleCard title="Pre-operative preparation instructions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Fasting', value: matchedTemplate.prep.fastingFrom },
              { label: 'Bowel preparation', value: matchedTemplate.prep.bowelPrep },
              { label: 'Medications', value: matchedTemplate.prep.medications },
            ].filter(f => f.value && f.value !== 'Not required.').map(f => (
              <div key={f.label} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{f.value}</div>
              </div>
            ))}
            {matchedTemplate.prep.morning.length > 0 && (
              <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 7, border: '1px solid #86efac' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>On the day</div>
                {matchedTemplate.prep.morning.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start', fontSize: 13, color: '#166534' }}>
                    <span style={{ flexShrink: 0, fontWeight: 700 }}>✓</span><span>{m}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 7, border: '1px solid #93c5fd' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Recovery timeline</div>
              <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{matchedTemplate.prep.recovery}</div>
            </div>
          </div>
        </CollapsibleCard>
      )}

      <CollapsibleCard title="Capacity and questions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={capacity} onChange={e => setCapacity(e.target.checked)} />
            Patient has capacity to consent (understands, retains, weighs, communicates)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={interpreterUsed} onChange={e => setInterpreterUsed(e.target.checked)} />
            Interpreter used
          </label>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>PATIENT QUESTIONS / ADDITIONAL NOTES</label>
            <SmartTextarea value={patientQuestions} onChange={setPatientQuestions} placeholder="Document any specific questions asked and answers given…" style={{ minHeight: 80, width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>NOTES</label>
            <SmartTextarea value={notes} onChange={setNotes} placeholder="Any additional consent documentation…" style={{ minHeight: 60, width: '100%' }} />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Signatures">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SignaturePad label="Patient signature" value={patientSig} onChange={setPatientSig} />
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Clinician name</label>
            <input value={clinicianName} onChange={e => setClinicianName(e.target.value)} placeholder="Dr …" style={inp} />
          </div>
          <SignaturePad label="Clinician signature" value={clinicianSig} onChange={setClinicianSig} />
        </div>
      </CollapsibleCard>

      {!signed ? (
        <button type="button" onClick={() => setSigned(true)}
          disabled={!procedure || !capacity || !patientSig || !clinicianSig}
          style={{ padding: '12px', borderRadius: 8, border: 'none',
            background: (procedure && capacity && patientSig && clinicianSig) ? '#15803d' : '#d1d5db',
            color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: (procedure && capacity && patientSig && clinicianSig) ? 'pointer' : 'default', width: '100%' }}>
          {!patientSig || !clinicianSig ? 'Both signatures required to finalise' : 'Finalise consent'}
        </button>
      ) : (
        <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#15803d', marginBottom: 6 }}>✓ Consent finalised — {consentDate}</div>
          <div style={{ fontSize: 13, color: '#166534', marginBottom: 10 }}>
            <b>Procedure:</b> {procedure}<br />
            <b>Anaesthesia:</b> {anaesthesia}<br />
            {[...generalRisks, ...specificRisks].length > 0 && <><b>Risks discussed:</b> {[...generalRisks, ...specificRisks].join(', ')}<br /></>}
            {alternatives && <><b>Alternatives:</b> {alternatives}<br /></>}
            {interpreterUsed && <><b>Interpreter used</b><br /></>}
            {clinicianName && <><b>Clinician:</b> {clinicianName}</>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', marginBottom: 2 }}>PATIENT</div>
              <img src={patientSig} alt="patient signature" style={{ width: '100%', height: 60, objectFit: 'contain', border: '1px solid #86efac', borderRadius: 4, background: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', marginBottom: 2 }}>CLINICIAN</div>
              <img src={clinicianSig} alt="clinician signature" style={{ width: '100%', height: 60, objectFit: 'contain', border: '1px solid #86efac', borderRadius: 4, background: '#fff' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button"
              onClick={() => printConsentPdf({ patientName, age, sex, dob, nhiNumber, procedure, anaesthesia, alternatives, generalRisks, specificRisks, capacity, interpreterUsed, patientQuestions, notes, clinicianName, consentDate, patientSig, clinicianSig })}
              style={{ flex: 1, minWidth: 120, padding: '8px', borderRadius: 7, border: '1.5px solid #1e3a5f', background: '#fff', color: '#1e3a5f', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              🖨 Consent PDF
            </button>
            {matchedTemplate && (
              <button type="button"
                onClick={() => printPatientLeaflet({ patientName, procedure, consentDate, prep: matchedTemplate.prep })}
                style={{ flex: 1, minWidth: 120, padding: '8px', borderRadius: 7, border: '1.5px solid #0891b2', background: '#f0f9ff', color: '#0369a1', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                📄 Patient Info Leaflet
              </button>
            )}
            <button type="button"
              onClick={() => {
                const allRisks = [...generalRisks, ...specificRisks];
                const body = `<div style="border-bottom:2pt solid #C8A24B;margin-bottom:12px;padding-bottom:8px"><div style="font-size:15pt;font-weight:700;color:#0B2545">AMISE MEDICAL SERVICES</div><div style="font-size:9pt;color:#6B7280">Dr Dawit Daniel Kabiye, MD, DM — General &amp; Endoscopic Surgery — Saint Lucia</div></div>
                  <h1>Surgical Consent Form</h1>
                  <h2>${patientName || 'Patient'}${dob ? ` · DOB: ${dob}` : ''}${nhiNumber ? ` · NHI: ${nhiNumber}` : ''} | ${consentDate}</h2>
                  <h3>Procedure</h3>
                  <table><tr><td class="lbl">Operation:</td><td>${procedure}</td></tr><tr><td class="lbl">Anaesthesia:</td><td>${anaesthesia}</td></tr>${alternatives ? `<tr><td class="lbl">Alternatives discussed:</td><td>${alternatives}</td></tr>` : ''}</table>
                  ${allRisks.length > 0 ? `<h3>Risks discussed</h3><p>${allRisks.join(' · ')}</p>` : ''}
                  <h3>Capacity &amp; Consent</h3>
                  <p>${capacity ? '✓ Patient has capacity to consent' : '⚠ Capacity assessment required'}</p>
                  ${interpreterUsed ? '<p>✓ Interpreter used</p>' : ''}
                  ${patientQuestions ? `<p><strong>Questions:</strong> ${patientQuestions}</p>` : ''}
                  ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                  <div class="sig" style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:40pt">
                    <div><div class="sig-line"></div><p style="font-size:10pt;font-weight:700;margin-top:4px">${patientName || 'Patient'}</p><p style="font-size:9pt;color:#6B7280">Date: ${consentDate}</p></div>
                    <div><div class="sig-line"></div><p style="font-size:10pt;font-weight:700;margin-top:4px">${clinicianName}</p><p style="font-size:9pt;color:#6B7280">Consultant General &amp; Endoscopic Surgeon</p><p style="font-size:9pt;color:#6B7280">Date: ${consentDate}</p></div>
                  </div>
                  <div class="footer">This consent form was completed at Amise Medical Services, Saint Lucia.</div>`;
                downloadAsWord(body, `${(patientName || 'Patient').replace(/\s+/g, '_')}_Consent_${consentDate}`, `Surgical Consent — ${patientName || 'Patient'}`);
              }}
              style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              📝 Word
            </button>
            <button type="button"
              onClick={handleEmailPatient}
              disabled={emailStatus === 'sending'}
              style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${emailStatus === 'sent' ? '#86efac' : emailStatus === 'error' ? '#fca5a5' : '#d1d5db'}`, background: emailStatus === 'sent' ? '#f0fdf4' : emailStatus === 'error' ? '#fef2f2' : '#fff', color: emailStatus === 'sent' ? '#15803d' : emailStatus === 'error' ? '#b91c1c' : '#374151', fontWeight: 700, fontSize: 12, cursor: emailStatus === 'sending' ? 'wait' : 'pointer' }}>
              {emailStatus === 'sending' ? '⏳ Sending…' : emailStatus === 'sent' ? '✓ Sent' : emailStatus === 'error' ? '⚠ Failed' : `✉ Email${email ? ` (${email.split('@')[0]}…)` : ' patient'}`}
            </button>
            <button type="button" onClick={() => setSigned(false)}
              style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
