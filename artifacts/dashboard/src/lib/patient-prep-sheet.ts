/**
 * Printed patient preparation sheet (PatientPrepCard) — content and HTML.
 *
 * Kept out of the component so it can be tested and linted from its rendered output
 * (`lint:patient-instructions` and `__tests__/patient-prep-sheet.test.ts`). Relative imports only:
 * the lint loads this file under tsx without the `@/` alias.
 *
 * Hazard H-10 and the no-"fast from midnight" rule (Dr Kabiye's decisions, CLAUDE.md): the sheet
 * never tells a patient to take, hold, stop, reduce or continue a prescribed medicine, and never
 * says "nothing by mouth from midnight". Its medicine and fasting sentences are the approved ones
 * from `artifacts/front-desk/lib/instructions.ts` (emailed on booking) and
 * `artifacts/api-server/src/lib/sms.ts` (prep reminders); the lint fails if they drift. The one
 * "stop" text allowed is the surgeon-approved herbal-products paragraph
 * (`HERBAL_PREOP_PATIENT_TEXT`, surgeon decision 2026-09-25, SURGEON-DECISIONS.md I1), verbatim.
 * Any wording change here needs the clinical owner's approval.
 */
import { HERBAL_PREOP_PATIENT_TEXT } from './supplement-catalogue';

// ── Approved sentences (same words as front-desk instructions.ts / api-server sms.ts) ─────────

/** instructions.ts MEDICATIONS_CALL / sms.ts PREP_MEDICATIONS. */
export const PREP_MEDICATIONS_CALL =
  'MEDICATIONS: If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions. If you have any questions about your other medicines, please call us.';

/** instructions.ts BLOOD_THINNERS_CALL (ERCP sets). */
export const PREP_BLOOD_THINNERS_CALL =
  'BLOOD THINNERS: If you take blood thinners, please call the clinic before your appointment for instructions.';

/** instructions.ts FASTING_STANDARD — general anaesthesia, sedation, OGD and ERCP (6 h food / 2 h clear fluids). */
export const PREP_FASTING_STANDARD =
  'Nothing to eat for 6 hours and nothing to drink for 2 hours before your appointment time (clear fluids such as water are fine until then).';

/** instructions.ts colonoscopy — the day of the procedure. */
export const PREP_COLONOSCOPY_DAY_OF =
  'On the day of your procedure: finish your bowel prep as directed. Clear fluids only, then nothing to drink for 2 hours before your appointment time.';

/** The second sentence of PREP_COLONOSCOPY_DAY_OF, for a schedule step where the prep is already done. */
export const PREP_COLONOSCOPY_CLEAR_FLUIDS =
  'Clear fluids only, then nothing to drink for 2 hours before your appointment time.';

/** instructions.ts minor_procedure — local anaesthetic only. */
export const PREP_MINOR_NO_FASTING = 'No fasting is needed. Please eat a light meal before your appointment.';
export const PREP_MINOR_GA_SEPARATE =
  'If you have been told you will have a general anaesthetic, the clinic will give you separate instructions.';

export { HERBAL_PREOP_PATIENT_TEXT };

// ── Practice details ──────────────────────────────────────────────────────────

export const PRACTICE = {
  name: 'AMISE MEDICAL SERVICES',
  doctor: 'Dr Dawit Daniel Kabiye, MD, DM — General & Endoscopic Surgery',
  poBox: 'P.O. BOX RB 2449',
  email: 'amisesuite@gmail.com',
  locations: [
    { label: 'Tapion Hospital, Tapion', tel: '(758) 459-2227 / 284-0557' },
    { label: 'Providence Commercial Centre, Rodney Bay', tel: '(758) 452-9557 / 720-7111' },
  ],
};

// ── Bowel prep regimens ───────────────────────────────────────────────────────

export interface BowelPrepStep { time: string; items: string[] }
export interface BowelPrep { id: string; label: string; note: string; instructions: BowelPrepStep[] }

export const BOWEL_PREPS: BowelPrep[] = [
  {
    id: 'mag_citrate_eve',
    label: 'Magnesium Citrate — evening before (morning appointments)',
    note: 'Purchase 2 bottles of magnesium citrate from any local pharmacy before your prep day. Chill in the fridge — it is more palatable cold.',
    instructions: [
      {
        time: '2 days before procedure',
        items: ['Follow the low-residue diet all day (see diet table below)'],
      },
      {
        time: 'Day before — morning & lunch',
        items: [
          'Light low-residue meals only (e.g. white toast, white rice, boiled egg, white pasta)',
          'Avoid all fruit, all vegetables, and any high-fibre foods',
        ],
      },
      {
        time: 'Day before — midday onwards',
        items: [
          'Clear fluids ONLY from midday: water, clear broth, apple juice (no pulp), black tea or coffee (no milk), clear soft drinks, jelly / Jell-O',
          'NO milk, cream, juice with pulp, or solid food from midday onwards',
        ],
      },
      {
        time: 'Day before — 4:00 pm',
        items: [
          'Drink the first bottle of magnesium citrate (remove from fridge and drink chilled)',
          'Follow immediately with at least 2 large glasses (500 mL) of clear water',
          'Continue drinking clear fluids throughout the afternoon',
        ],
      },
      {
        time: 'Day before — 8:00 pm',
        items: [
          'Drink the second bottle of magnesium citrate',
          'Follow with at least 2 large glasses (500 mL) of clear water',
          'Continue drinking clear fluids through the evening',
        ],
      },
      {
        time: 'Morning of procedure',
        items: [PREP_COLONOSCOPY_CLEAR_FLUIDS],
      },
    ],
  },
  {
    id: 'mag_citrate_split',
    label: 'Magnesium Citrate — split dose (afternoon appointments)',
    note: 'Purchase 2 bottles of magnesium citrate from any local pharmacy. Chill in the fridge before use.',
    instructions: [
      {
        time: '2 days before procedure',
        items: ['Follow the low-residue diet all day (see diet table below)'],
      },
      {
        time: 'Day before — daytime',
        items: [
          'Low-residue diet all day (see diet table)',
          'Clear fluids ONLY from 6:00 pm: water, clear broth, apple juice (no pulp), black tea or coffee, jelly',
        ],
      },
      {
        time: 'Day before — 8:00 pm',
        items: [
          'Drink the first bottle of magnesium citrate (chilled)',
          'Follow with 2 large glasses (500 mL) of clear water',
          'Continue drinking clear fluids through the evening',
        ],
      },
      {
        time: 'Morning of procedure — 5 hours before your appointment',
        items: [
          'Drink the second bottle of magnesium citrate',
          'Follow with 2 large glasses (500 mL) of clear water',
          PREP_COLONOSCOPY_CLEAR_FLUIDS,
        ],
      },
    ],
  },
];

// ── Low-residue diet table — matches Amise Medical Services official document ─

export const DIET_TABLE = [
  {
    category: 'Grains',
    allowed: [
      'White bread, rolls, biscuits, croissants, melba toast',
      'Waffles, french toast, pancakes',
      'White rice, noodles, pasta, macaroni, peeled and cooked potatoes',
      'Cooked cereals, farina',
      'Cold cereals, puffed rice, cornflakes',
    ],
    avoid: [
      'Bread with nuts, seeds, or fruits',
      'Whole wheat, pumpernickel, rye, and corn bread',
      'Potatoes with skin, brown or wild rice, and buckwheat',
    ],
  },
  {
    category: 'Vegetables',
    allowed: ['None'],
    avoid: ['All vegetables'],
  },
  {
    category: 'Fruits',
    allowed: ['Strained fruit juice', 'Melons'],
    avoid: [
      'Prunes and prune juice',
      'Raw or dried fruit',
      'All berries, figs, dates & raisins',
      'Bananas',
      'Mangoes',
    ],
  },
  {
    category: 'Dairy',
    allowed: ['Milk (plain or flavoured)', 'Yogurt, custard, ice cream', 'Cheese and cottage cheese'],
    avoid: ['Yogurts with nuts or seeds'],
  },
  {
    category: 'Meats & other proteins',
    allowed: [
      'Ground, well cooked tender beef, lamb, ham, veal, pork, fish, poultry',
      'Peanut butter without nuts',
    ],
    avoid: [
      'Tough, fibrous meats with gristle',
      'Dry beans, peas and lentils',
      'Peanut butter with nuts',
      'Tofu',
    ],
  },
  {
    category: 'Snacks, Condiments & Drinks',
    allowed: [
      'Margarine, butter, oils, mayonnaise, sour cream and salad dressing',
      'Plain gravies',
      'Sugar, clear jellies, honey and syrup',
      'Spices, cooked herbs, broth and soups made without vegetables',
      'Coffee, tea & carbonated drinks',
      'Gelatin, plain puddings, sherbet, popsicles',
      'Hard candy or pretzels',
      'Ketchup, mustard',
    ],
    avoid: [
      'Nuts, seeds, coconuts',
      'Jam, marmalade and preserves',
      'Pickles, olives, relish and horseradish',
      'Sauerkraut',
      'All desserts containing nuts and seeds, dried fruits, coconuts, or anything made from whole grains or bran',
      'Candy made of nuts and seeds',
      'Popcorn',
    ],
  },
];

// ── Recorded herbal products ──────────────────────────────────────────────────

// The herbal products the approved paragraph names (plus "bush tea" / "herbal"). Valerian is
// deliberately not matched: it must not be stopped suddenly (the paragraph says to call the
// clinic). Vitamins and other supplements are not matched: their pre-op advice is not decided
// (SURGEON-DECISIONS.md I1 "still open").
const HERBAL_NAME = /turmeric|curcumin|ginger|garlic|ginkgo|ginseng|st\.? john|kava|echinacea|ashwagandha|ephedra|ma huang|cinnamon|bush tea|herbal/i;

/**
 * The recorded names (medicines list and the herbs / supplements history) that are herbal
 * products covered by the approved paragraph — shown on the sheet as a pointer to it. Prescribed
 * medicines never get an instruction line (hazard H-10); the approved call-the-clinic line covers them.
 */
export function recordedHerbalProducts(names: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name && HERBAL_NAME.test(name) && !out.some(n => n.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

// ── HTML generation ───────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PRACTICE_HEADER_HTML = `
  <div style="display:flex;align-items:flex-start;gap:12px;border-bottom:2px solid #b91c1c;padding-bottom:10px;margin-bottom:14px">
    <div style="flex:1">
      <div style="font-size:17px;font-weight:800;color:#b91c1c;letter-spacing:0.01em">${PRACTICE.name}</div>
      <div style="font-size:10px;color:#374151;margin-top:2px">${PRACTICE.poBox} &nbsp;|&nbsp; Email: ${PRACTICE.email}</div>
      <div style="font-size:10px;color:#374151;margin-top:1px">
        ${PRACTICE.locations.map(l => `${l.label} &mdash; Tel: ${l.tel}`).join('&nbsp;&nbsp;&nbsp;')}
      </div>
    </div>
  </div>`;

function buildDietTableHtml(): string {
  return `
  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px">
    <thead>
      <tr>
        <th style="padding:6px 8px;background:#1e3a5f;color:#fff;font-weight:700;text-align:left;width:22%">Category</th>
        <th style="padding:6px 8px;background:#15803d;color:#fff;font-weight:700;text-align:left;width:39%">Recommended Foods</th>
        <th style="padding:6px 8px;background:#b91c1c;color:#fff;font-weight:700;text-align:left;width:39%">Foods to Avoid</th>
      </tr>
    </thead>
    <tbody>
      ${DIET_TABLE.map((row, i) => `
        <tr style="vertical-align:top;background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
          <td style="padding:6px 8px;font-weight:700;border:1px solid #e2e8f0;color:#1e3a5f">${row.category}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;color:#166534">
            <ul style="margin:0;padding-left:14px;line-height:1.6">${row.allowed.map(a => `<li>${a}</li>`).join('')}</ul>
          </td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;color:#991b1b">
            <ul style="margin:0;padding-left:14px;line-height:1.6">${row.avoid.map(a => `<li>${a}</li>`).join('')}</ul>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

const H2 = 'font-size:13px;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:4px';

export type PrepSheetType = 'colonoscopy' | 'preop';

export interface PrepSheetOptions {
  type: PrepSheetType;
  patientName: string; dob: string; nhiNumber: string;
  procedure: string; appointmentDate: string; appointmentTime: string;
  prep?: BowelPrep;
  /** Recorded herbal products (recordedHerbalProducts) — listed as a pointer to the herbal paragraph. */
  herbalProducts: string[];
  allergies: string;
  /** Issue date shown in the footer (defaults to today). */
  issued?: string;
}

/** The recorded-herbal pointer line, or '' when none are recorded. */
export function herbalPointerLine(herbalProducts: readonly string[]): string {
  if (herbalProducts.length === 0) return '';
  return `Herbal products recorded at your visit: ${herbalProducts.join(', ')}. Please read "Herbal remedies, bush teas and supplements" below.`;
}

export function buildPrepHtml(opts: PrepSheetOptions): string {
  const { type, patientName, dob, nhiNumber, procedure, appointmentDate, appointmentTime, prep, herbalProducts, allergies } = opts;
  const issued = opts.issued ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const e = escapeHtml;

  const patientTable = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
      <tr><td style="font-weight:700;width:130px;padding:3px 0;color:#374151">Patient</td><td style="font-weight:600">${e(patientName) || '—'}</td></tr>
      ${dob ? `<tr><td style="font-weight:700;padding:3px 0;color:#374151">Date of Birth</td><td>${e(dob)}</td></tr>` : ''}
      ${nhiNumber ? `<tr><td style="font-weight:700;padding:3px 0;color:#374151">NHI Number</td><td>${e(nhiNumber)}</td></tr>` : ''}
      <tr><td style="font-weight:700;padding:3px 0;color:#374151">Procedure</td><td>${e(procedure) || '—'}</td></tr>
      <tr><td style="font-weight:700;padding:3px 0;color:#374151">Appointment</td><td>${e(appointmentDate) || '—'}${appointmentTime ? ` at ${e(appointmentTime)}` : ''}</td></tr>
      ${allergies ? `<tr><td style="font-weight:700;padding:3px 0;color:#dc2626">&#9888; Allergies</td><td style="color:#dc2626;font-weight:700">${e(allergies)}</td></tr>` : ''}
    </table>`;

  let body = PRACTICE_HEADER_HTML;
  body += `<h1 style="font-size:15px;margin:0 0 10px;color:#1e293b">${type === 'colonoscopy' ? 'Colonoscopy Preparation Instructions' : 'Pre-operative Patient Instructions'}</h1>`;
  body += patientTable;

  if (type === 'colonoscopy' && prep) {
    body += `
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:11.5px;color:#78350f">
      <strong>Before you start —</strong> ${prep.note}
    </div>`;

    body += `<h2 style="${H2};margin:14px 0 8px">${prep.label}</h2>`;
    for (const step of prep.instructions) {
      body += `<div style="margin-bottom:11px">
        <div style="font-size:11.5px;font-weight:700;color:#1e3a5f;margin-bottom:3px">${step.time}</div>
        <ul style="margin:0 0 0 18px;padding:0;font-size:11.5px;line-height:1.7;color:#1e293b">
          ${step.items.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>`;
    }

    body += `
    <h2 style="${H2};margin:18px 0 8px">Low-Residue Diet Guide</h2>
    <p style="font-size:11px;color:#374151;margin-bottom:8px">Follow this diet for the <strong>2 days before your preparation day</strong>. On the day of preparation, follow clear fluids only from midday (as above).</p>
    ${buildDietTableHtml()}`;

    body += `
    <h2 style="${H2};margin:16px 0 8px">During the Preparation</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:11.5px;line-height:1.8;color:#1e293b">
      <li><strong>During bowel movements — do NOT wipe.</strong> Gently dab or rinse with water to prevent irritation or burning.</li>
      <li>Stay close to a bathroom once you have taken the preparation.</li>
      <li>Keep well hydrated with clear fluids throughout the preparation day.</li>
    </ul>`;
  }

  if (type === 'preop') {
    body += `
    <h2 style="${H2};margin:14px 0 8px">Fasting Instructions</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
      <tr style="background:#f0fdfa"><td style="padding:6px 10px;font-weight:700;width:200px;border:1px solid #e2e8f0">Food and drink</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${PREP_FASTING_STANDARD}</td></tr>
      <tr><td style="padding:6px 10px;font-weight:700;border:1px solid #e2e8f0">Clear fluids</td><td style="padding:6px 10px;border:1px solid #e2e8f0">Water, black tea/coffee, apple juice without pulp, clear broth only</td></tr>
      <tr style="background:#f0fdfa"><td style="padding:6px 10px;font-weight:700;color:#dc2626;border:1px solid #e2e8f0">Do NOT have milk or juice</td><td style="padding:6px 10px;color:#dc2626;border:1px solid #e2e8f0">These are not clear fluids — avoid within 6 hours of your procedure</td></tr>
    </table>

    <h2 style="${H2};margin:14px 0 8px">What to Bring on the Day</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:11.5px;line-height:1.8;color:#1e293b">
      <li>This instruction sheet</li>
      <li>Photo ID and health / insurance card (NHI card if you have one)</li>
      <li>All current medications in their original packaging</li>
      <li>Loose, comfortable clothing that is easy to put on after your procedure</li>
      <li><strong>A responsible adult to take you home</strong> — you cannot drive after sedation or general anaesthesia</li>
      <li>Contact phone number for your escort (we will call when you are in recovery)</li>
    </ul>`;
  }

  // Medicines: the approved call-the-clinic line only (hazard H-10) — no per-medicine instruction.
  const pointer = herbalPointerLine(herbalProducts);
  body += `
    <h2 style="${H2};margin:18px 0 8px">Your Medicines</h2>
    <p style="font-size:11.5px;line-height:1.7;color:#1e293b;margin:0 0 6px"><strong>${PREP_MEDICATIONS_CALL}</strong></p>
    ${pointer ? `<p style="font-size:11.5px;line-height:1.7;color:#92400e;margin:0">${e(pointer)}</p>` : ''}`;

  if (type === 'colonoscopy') {
    body += `
    <h2 style="${H2};margin:18px 0 8px">Additional Important Instructions</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:11.5px;line-height:1.9;color:#1e293b">
      <li><strong>Remove all metal items</strong> before your appointment — jewellery, piercings, watches, and accessories. Metal can interfere with electrocautery during the procedure.</li>
      <li><strong>Arrange a responsible adult to drive you home</strong> — you cannot drive after sedation. Please make these arrangements before your procedure day.</li>
    </ul>`;
  }

  // Surgeon decision 2026-09-25 (docs/clinical-validation/SURGEON-DECISIONS.md I1): the same herbal
  // text as the front-desk instructions and the api-server prep templates.
  body += `
    <h2 style="${H2};margin:18px 0 8px">Herbal remedies, bush teas and supplements</h2>
    <p style="font-size:11.5px;line-height:1.7;color:#1e293b;margin:0">${e(HERBAL_PREOP_PATIENT_TEXT)}</p>`;

  body += `
  <div style="margin-top:20px;padding:10px 12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;font-size:11px;color:#991b1b">
    <strong>&#9888; Emergency:</strong> If you develop a fever, severe abdominal pain, heavy rectal bleeding, or feel very unwell, call our office or attend the nearest emergency department immediately. Do not take the preparation if you are unwell — call us first.
  </div>
  <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;line-height:1.6">
    Issued by Amise Medical Services &middot; Dr Dawit Daniel Kabiye, MD, DM &middot; ${issued}<br>
    This document is for <strong>${e(patientName) || 'the named patient'}</strong> only. If you have any questions, call (758) 459-2227 / 284-0557 (Tapion) or (758) 452-9557 / 720-7111 (Rodney Bay).
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${type === 'colonoscopy' ? 'Colonoscopy Preparation' : 'Pre-operative Instructions'} — ${e(patientName) || 'Patient'}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;max-width:780px;margin:32px auto;color:#1e293b;font-size:12px;line-height:1.5}@media print{body{margin:16px;max-width:100%}}</style>
  </head><body>${body}</body></html>`;
}

/** Plain text of a rendered sheet (tags dropped, entities decoded) — for the lint and tests. */
export function prepSheetText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(li|p|h1|h2|div|tr|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&middot;/g, '·').replace(/&#9888;/g, '⚠')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n');
}
