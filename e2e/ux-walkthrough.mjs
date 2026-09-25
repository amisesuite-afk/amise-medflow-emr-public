/**
 * UX walkthrough (web dashboard) — screenshots of the consultation flow for the usability review
 * (docs/clinical-validation/UX-REPORT.md), on a desktop (1440×900) and an iPad (1024×1366)
 * viewport, with clicks / text entries / screens counted per viewport.
 *
 * Flow: empty home → New patient → visit type → chief complaint (+ triage question) → HPI →
 * PMH → Surgical Hx → Meds → Allergies (records penicillin) → Exam (two findings) → Labs →
 * Imaging → Assessment (ICD-10 search + impression) → Plan → Scores (if reachable) → Summary →
 * close the encounter.
 *
 * Run (same setup as e2e/emr-walkthrough.mjs):
 *   VITE_SUPABASE_URL=https://placeholder.supabase.co \
 *   VITE_SUPABASE_ANON_KEY=<3-segment placeholder JWT, see ci.yml> \
 *   pnpm --filter @workspace/dashboard run dev          # port 3000 (PORT=… to change)
 *   node e2e/ux-walkthrough.mjs                          # UX_BASE_URL=http://localhost:3000
 *
 * Supabase and the API server are mocked with synthetic data (no network, no real patients).
 * Output: docs/clinical-validation/ux/web/<viewport>/NN-step.png and
 *         docs/clinical-validation/ux/web/ux-metrics-web.json (UX_WEB_OUT to change).
 * Exits 0 even when a step is not found: the missing step is recorded in the metrics (this is a
 * review aid, not a regression test — e2e/emr-walkthrough.mjs is the CI gate).
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SANDBOX_PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';
const SANDBOX_CHROMIUM   = '/opt/pw-browsers/chromium';
const useSandboxBrowser  = existsSync(SANDBOX_PLAYWRIGHT);

const { chromium } = useSandboxBrowser
  ? await import(SANDBOX_PLAYWRIGHT)
  : await import('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.UX_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OUT  = process.env.UX_WEB_OUT ?? join(__dirname, '..', 'docs', 'clinical-validation', 'ux', 'web');

const VIEWPORTS = [
  { id: 'desktop-1440x900', label: 'Desktop 1440×900',
    context: { viewport: { width: 1440, height: 900 } } },
  { id: 'ipad-1024x1366', label: 'iPad 1024×1366 (portrait)',
    context: {
      viewport: { width: 1024, height: 1366 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    } },
];

// ── Synthetic session and data (never real) ─────────────────────────────────
const MOCK_USER = { id: 'demo-uid-0001', email: 'demo.clinician@example.invalid', role: 'authenticated', aud: 'authenticated' };
const MOCK_TOKEN = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiJkZW1vLXVpZC0wMDAxIiwiZW1haWwiOiJkZW1vLmNsaW5pY2lhbkBleGFtcGxlLmludmFsaWQiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjk5OTk5OTk5OTl9',
  'mock',
].join('.');
const MOCK_SESSION = { access_token: MOCK_TOKEN, refresh_token: 'mock-refresh', expires_in: 3600,
                       expires_at: 9999999999, token_type: 'bearer', user: MOCK_USER };
const MOCK_PROFILE = { id: MOCK_USER.id, email: MOCK_USER.email, full_name: 'Demo Surgeon', role: 'doctor', site: 'tapion' };
const PATIENT = { id: 'demo-patient-0001', full_name: 'Avery Sample', date_of_birth: '1980-03-14', sex: 'female',
                  mrn: 'DEMO-0001', site: 'tapion', created_at: new Date().toISOString() };
const ENCOUNTER = { id: 'demo-enc-0001', patient_id: PATIENT.id, encounter_date: new Date().toISOString(), status: 'open' };

async function mockBackends(ctx) {
  await ctx.route('https://placeholder.supabase.co/**', async route => {
    const url = route.request().url();
    const method = route.request().method();
    const j = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.includes('/auth/v1/')) {
      if (url.includes('/token') || url.includes('/session')) return j(MOCK_SESSION);
      if (url.includes('/user')) return j(MOCK_USER);
      return j({});
    }
    if (url.includes('/rest/v1/')) {
      if (url.includes('user_profiles'))        return j([MOCK_PROFILE]);
      if (url.includes('/patients'))            return method === 'GET' ? j([PATIENT]) : j([PATIENT], 201);
      if (url.includes('/clinical_encounters')) return method === 'GET' ? j([ENCOUNTER]) : j([ENCOUNTER], 201);
      return method === 'GET' ? j([]) : j([{}], 201);
    }
    return j({});
  });
  await ctx.route(`${BASE}/api/**`, async route => {
    const url = route.request().url();
    const method = route.request().method();
    const j = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.includes('/check-duplicates'))  return j({});
    if (url.match(/\/api\/patients($|\?)/)) return method === 'POST' ? j({ patient: PATIENT }) : j({ patients: [PATIENT] });
    if (url.includes('/api/encounters'))    return method === 'POST' ? j({ encounter: ENCOUNTER }) : j({ encounters: [ENCOUNTER] });
    return j({});
  });
}

// ── Recorder: screenshots + counts ──────────────────────────────────────────
function recorder(page, viewport) {
  const dir = join(OUT, viewport.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let shotN = 0;
  const m = { viewport: viewport.label, clicks: 0, textEntries: 0, keystrokes: 0, selects: 0,
              scrolls: 0, screens: [], screenshots: [], missing: [], notes: [] };

  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const visible = loc => loc.filter({ visible: true }).first();
  // Counts a scroll when the control is outside the viewport (the user would have to scroll).
  async function reveal(target) {
    const box = await target.boundingBox().catch(() => null);
    const vp = page.viewportSize();
    if (box && vp && (box.y + box.height > vp.height || box.y < 0)) m.scrolls++;
    await target.scrollIntoViewIfNeeded();
  }

  return {
    m,
    async shot(name, { newScreen = true, fullPage = false } = {}) {
      await page.waitForTimeout(350);
      const file = `${String(++shotN).padStart(2, '0')}-${slug(name)}.png`;
      await page.screenshot({ path: join(dir, file), fullPage });
      m.screenshots.push(file);
      if (newScreen && !m.screens.includes(name)) m.screens.push(name);
    },
    async click(loc, what, { optional = false } = {}) {
      const target = visible(loc);
      try {
        await target.waitFor({ state: 'visible', timeout: 4000 });
        await reveal(target);
        await target.click({ timeout: 4000 });
        m.clicks++;
        await page.waitForTimeout(500);
        return true;
      } catch {
        if (!optional) m.missing.push(what);
        return false;
      }
    },
    async type(loc, text, what) {
      const target = visible(loc);
      try {
        await target.waitFor({ state: 'visible', timeout: 4000 });
        await reveal(target);
        await target.click({ timeout: 4000 });
        await target.fill(text);
        m.clicks++; m.textEntries++; m.keystrokes += text.length;
        await page.waitForTimeout(500);
        return true;
      } catch {
        m.missing.push(what);
        return false;
      }
    },
    async select(loc, value, what) {
      try {
        await loc.first().selectOption(value, { timeout: 4000 });
        m.selects++;
        await page.waitForTimeout(700);
        return true;
      } catch {
        m.missing.push(what);
        return false;
      }
    },
    note(text) { m.notes.push(text); console.log(`   · ${text}`); },
  };
}

const btn = (page, re) => page.locator('button').filter({ hasText: re });
// Pathway pill ("2PMH", "✓Labs", "⚠️Allergies"): any non-letter prefix, then the label.
const pill = (page, label) => page.locator('button:not([disabled])').filter({
  hasText: new RegExp(`^[^A-Za-z]*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
});

async function walkthrough(browser, viewport) {
  console.log(`\n▶ ${viewport.label}`);
  const ctx = await browser.newContext(viewport.context);
  await mockBackends(ctx);
  const page = await ctx.newPage();
  await page.addInitScript(({ session, profile }) => {
    localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(session));
    localStorage.setItem('amise-profile', JSON.stringify(profile));
  }, { session: MOCK_SESSION, profile: MOCK_PROFILE });

  const ux = recorder(page, viewport);
  // Native confirm() dialogs (e.g. closing the encounter): record the question, accept, count a click.
  page.on('dialog', async dialog => {
    ux.note(`Browser dialog: "${dialog.message()}"`);
    ux.m.clicks++;
    await dialog.accept();
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  await ux.shot('Home - no patient loaded');

  // New patient
  await ux.click(btn(page, /New patient/i), 'New patient button');
  await ux.shot('New patient form');
  await ux.type(page.locator('input[placeholder="e.g. Jane Celestin"]'), 'Avery Sample', 'Full name');
  await ux.type(page.locator('input[placeholder="e.g. 45"]'), '46', 'Age');
  {
    // Sex <select> in the form: the one offering a "female" option (not the header's visit type).
    const sexSelect = page.locator('select:not([aria-label="Visit type"])');
    const options = await sexSelect.first().locator('option').evaluateAll(os => os.map(o => ({ v: o.value, t: o.textContent })))
      .catch(() => []);
    const female = options.find(o => /^female$/i.test(o.v) || /^female$/i.test((o.t ?? '').trim()));
    if (female) await ux.select(sexSelect, female.v, 'Sex');
    else ux.m.missing.push('Sex select');
  }
  await ux.click(btn(page, /Create Patient/i), 'Create Patient & Open Encounter');
  await page.waitForTimeout(1500);
  await ux.shot('Encounter opened - visit type required');
  const headerAfterCreate = await page.locator('body').innerText();
  if (/\bNKDA\b/.test(headerAfterCreate.slice(0, 400))) {
    ux.note('Header shows "NKDA" for a new patient whose allergies were never asked or recorded.');
  }

  // Visit type
  await ux.select(page.locator('select[aria-label="Visit type"]'), 'new_consult', 'Visit type = First consult');
  await ux.shot('CC-HPI (after visit type)');
  await ux.click(page.locator('button').filter({ hasText: /^Female$/ }), 'Sex chip (HPI banner)', { optional: true });

  // Chief complaint + one triage question
  await ux.click(btn(page, /\+ Add CC/), 'Add chief complaint');
  await ux.shot('Chief complaint picker');
  await ux.type(page.locator('input[placeholder="Search complaints…"]'), 'biliary', 'Complaint search');
  await ux.click(btn(page, /Biliary colic/), 'Pick "Biliary colic"');
  await ux.shot('CC chosen - triage questions and pathway bar');
  await ux.click(btn(page, /^After fatty meal$/), 'Triage answer: After fatty meal');
  await ux.click(btn(page, /^Next →$/), 'Triage: Next');
  await ux.shot('Triage question 2', { newScreen: false });
  await ux.click(btn(page, /Skip to HPI/), 'Skip to HPI', { optional: true });

  // HPI narrative
  const hpiText = '3 days of constant RUQ pain radiating to the right shoulder, worse after fatty food, with nausea. No jaundice. No fever at home.';
  const hpiBox = page.locator('textarea[placeholder^="Tap triage chips"], textarea[placeholder^="Document the presenting illness"]');
  await ux.type(hpiBox, hpiText, 'HPI narrative');
  await ux.shot('HPI typed');

  // History steps
  for (const label of ['PMH', 'Surgical Hx', 'Meds']) {
    await ux.click(pill(page, label), `Pathway: ${label}`);
    await ux.shot(label);
  }
  await ux.click(pill(page, 'Allergies'), 'Pathway: Allergies');
  await ux.shot('Allergies');
  await ux.click(btn(page, /Penicillin \/ amoxicillin/), 'Allergy chip: Penicillin');
  await ux.shot('Allergy recorded', { newScreen: false });
  {
    const top = (await page.locator('body').innerText()).slice(0, 300);
    ux.note(`Header after recording penicillin: ${/penicillin/i.test(top) ? 'shows the allergy' : 'does NOT show the allergy'}`);
  }

  // Exam
  await ux.click(pill(page, 'Exam'), 'Pathway: Exam');
  {
    const badge = await page.locator('text=/systems? documented/').first().textContent().catch(() => null);
    if (badge) ux.note(`Exam badge before any finding was entered: "${badge.trim()}"`);
  }
  await ux.shot('Exam');
  await ux.click(btn(page, /^Tender RUQ$/), 'Exam finding: Tender RUQ');
  await ux.click(btn(page, /^Murphy's sign \+$/), "Exam finding: Murphy's sign +");
  await ux.shot('Exam findings selected', { newScreen: false });

  // Investigations
  await ux.click(pill(page, 'Labs'), 'Pathway: Labs');
  await ux.shot('Labs');
  await ux.click(pill(page, 'Imaging'), 'Pathway: Imaging');
  await ux.shot('Imaging');

  // Assessment
  await ux.click(pill(page, 'Assessment'), 'Pathway: Assessment');
  await ux.shot('Assessment');
  const primaryDx = page.locator('text=PRIMARY DX').first();
  if (await primaryDx.isVisible().catch(() => false)) {
    const dxRow = await primaryDx.locator('xpath=..').innerText().catch(() => '');
    ux.note(`Working diagnosis already set before the clinician chose one: "${dxRow.replace(/\s+/g, ' ').trim()}" `
            + '(header shows it as the locked diagnosis).');
    await primaryDx.scrollIntoViewIfNeeded().catch(() => {});
    await ux.shot('Working diagnosis pre-set', { newScreen: false });
  } else {
    await ux.type(page.locator('input[placeholder^="Search diagnosis by name or ICD-10"]'), 'cholecystitis', 'Diagnosis search');
    await ux.shot('Diagnosis search results', { newScreen: false });
    await ux.click(page.locator('button, [role="option"], li').filter({ hasText: /K81/ }), 'Pick ICD-10 K81.x');
  }
  await ux.type(page.locator('textarea[placeholder^="Clinical impression"]'),
    'Biliary colic with features of acute cholecystitis (RUQ tenderness, Murphy positive). Afebrile.',
    'Clinical impression');
  await ux.shot('Assessment completed', { newScreen: false });

  // Plan
  await ux.click(pill(page, 'Plan'), 'Pathway: Plan');
  await ux.shot('Plan');
  await ux.type(page.locator('textarea[placeholder^="Management steps"]'),
    'Ultrasound abdomen, FBC, LFTs, CRP. Analgesia and antiemetic. Review with results; discuss laparoscopic cholecystectomy.',
    'Management plan');
  await ux.shot('Plan typed', { newScreen: false });

  // Scores
  {
    const scores = page.locator('button').filter({ hasText: /^(📊)?\s*(Scales|Scores|Risk Scores)$/ });
    if (await scores.filter({ visible: true }).count()) {
      await ux.click(scores, 'Scores tab');
      await ux.shot('Scores');
    } else {
      ux.note('Scores/Scales tab is not offered once a chief complaint is chosen (pathway bar replaces the tab bar).');
    }
  }

  // Summary (the note preview scrolls inside its own panel), then back and close
  await ux.click(btn(page, /📋 Summary/), 'Summary');
  await ux.shot('Summary');
  // The note preview is an <iframe>: scroll inside it to each section.
  {
    const frame = page.frames().find(f => f !== page.mainFrame());
    if (frame) {
      for (const section of ['Allergies', 'Examination', 'Assessment', 'Plan']) {
        const found = await frame.evaluate((name) => {
          const el = [...document.querySelectorAll('div, h2, h3')]
            .find(e => e.children.length === 0 && e.textContent.trim().length < 40 &&
                       e.textContent.trim().toLowerCase().includes(name.toLowerCase()));
          if (!el) return false;
          el.scrollIntoView({ block: 'start' });
          return true;
        }, section).catch(() => false);
        if (found) await ux.shot(`Summary - ${section.toLowerCase()} section`, { newScreen: false });
      }
      const text = await frame.evaluate(() => document.body.innerText).catch(() => '');
      const exam = (text.split(/PHYSICAL EXAMINATION/i)[1] ?? '').split(/INVESTIGATIONS/i)[0];
      const examLines = exam.split('\n').map(l => l.trim()).filter(l => /^[A-Z][A-Za-z /]+:/.test(l));
      if (examLines.length) {
        ux.note(`Summary examination lists ${examLines.length} systems (only the abdomen was examined in this walkthrough): `
                + examLines.map(l => l.split(':')[0]).join(', '));
      }
      if (examLines.some(l => /^Wound:/i.test(l))) {
        ux.note('Summary examination includes a "Wound" line (sutures/staples intact) for a patient with no wound.');
      }
      const ordered = (text.split(/INVESTIGATIONS ORDERED/i)[1] ?? '').split('\n').map(l => l.trim()).filter(Boolean);
      const firstHeadingAfter = ordered.findIndex(l => /^[A-Z][A-Z &/]{6,}$/.test(l) && !/LABORATORY|IMAGING|RADIOLOGY/.test(l));
      const orderedItems = (firstHeadingAfter > 0 ? ordered.slice(0, firstHeadingAfter) : ordered.slice(0, 30))
        .filter(l => !/^(LABORATORY|IMAGING|RADIOLOGY)$/i.test(l));
      if (orderedItems.length) {
        ux.note(`Summary "Investigations ordered" lists ${orderedItems.length} items although none were ordered by hand: `
                + orderedItems.slice(0, 12).join('; '));
      }
      const allergies = (text.split(/ALLERGIES/i)[1] ?? '').trim().split('\n')[0];
      if (allergies) ux.note(`Summary allergies line: "${allergies.slice(0, 120)}"`);
    } else {
      ux.note('Summary preview frame not found');
    }
  }
  await ux.click(btn(page, /Edit encounter/), 'Back to the encounter');
  await ux.click(btn(page, /In progress — Close/), 'Close encounter');
  await ux.shot('Close encounter');
  const confirm = page.locator('button').filter({ hasText: /^(✓\s*)?(Close encounter|Confirm|Yes, close|Complete|Sign & close)/i });
  if (await confirm.filter({ visible: true }).count()) {
    await ux.click(confirm, 'Confirm close');
    await ux.shot('After closing');
  }

  await ctx.close();
  const m = ux.m;
  m.interactions = m.clicks + m.selects;   // clicks already include the click into each text field
  console.log(`   clicks ${m.clicks}, selects ${m.selects}, text entries ${m.textEntries}, scrolls ${m.scrolls}, screens ${m.screens.length}, missing ${m.missing.length}`);
  if (m.missing.length) console.log(`   missing: ${m.missing.join('; ')}`);
  return m;
}

const browser = await chromium.launch({
  ...(useSandboxBrowser && existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true,
});
const results = {};
for (const vp of VIEWPORTS) results[vp.id] = await walkthrough(browser, vp);
await browser.close();

writeFileSync(join(OUT, 'ux-metrics-web.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  base: BASE,
  definitions: {
    clicks: 'clicks on controls, including the click into each text field',
    selects: 'drop-down choices',
    interactions: 'clicks + selects',
    textEntries: 'blocks of typed text (one per field)',
    scrolls: 'controls that were below or above the visible area when needed (one scroll each)',
    keystrokes: 'characters typed',
    screens: 'distinct screens or tabs seen',
    missing: 'steps the script could not find (control absent or renamed)',
  },
  viewports: Object.fromEntries(Object.entries(results).map(([k, m]) => [k, { ...m, screens: m.screens.length, screenNames: m.screens }])),
}, null, 2));
console.log(`\nScreenshots and metrics: ${OUT}`);
