/**
 * Encounter-switch isolation (Playwright, real browser against the dashboard dev server).
 *
 * Regression for the Encounter history tab bug: "+ New encounter" swapped only the encounter id,
 * so a few seconds later the autosave effects wrote the previous encounter's assessment, plan,
 * HPI, medicine list and investigation orders into the NEW encounter; "Load this encounter" copied
 * a stored encounter's content into the CURRENT encounter id. See
 * artifacts/dashboard/src/lib/encounter-switch.ts.
 *
 * The page starts on a restored in-progress encounter (localStorage, as after a reload) with
 * distinctive "OLD VISIT" content. Every Supabase write is recorded, and the test fails if one
 * that targets another encounter carries that content.
 *
 * Run (dashboard dev server on http://localhost:3000, or E2E_BASE_URL):
 *   node e2e/encounter-switch.mjs
 * Browser resolution is the same as e2e/emr-walkthrough.mjs (sandbox Chromium when present,
 * otherwise the `playwright` root devDependency).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SANDBOX_PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';
const SANDBOX_CHROMIUM   = '/opt/pw-browsers/chromium';
const useSandboxBrowser  = existsSync(SANDBOX_PLAYWRIGHT);
const { chromium } = useSandboxBrowser ? await import(SANDBOX_PLAYWRIGHT) : await import('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OUT  = join(__dirname, 'shots');
mkdirSync(OUT, { recursive: true });

const results = [];
function pass(label)         { results.push({ ok: true, label });          console.log(`  ✅ ${label}`); }
function fail(label, detail) { results.push({ ok: false, label, detail }); console.error(`  ❌ ${label}: ${detail}`); }

const MOCK_USER = { id: 'test-uid-123', email: 'dawit@amise.lc', role: 'authenticated', aud: 'authenticated' };
const MOCK_TOKEN = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiJ0ZXN0LXVpZC0xMjMiLCJlbWFpbCI6ImRhd2l0QGFtaXNlLmxjIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo5OTk5OTk5OTk5fQ',
  'mock',
].join('.');
const MOCK_SESSION = { access_token: MOCK_TOKEN, refresh_token: 'mock-refresh', expires_in: 3600, expires_at: 9999999999, token_type: 'bearer', user: MOCK_USER };
const MOCK_PROFILE = { id: 'test-uid-123', email: 'dawit@amise.lc', full_name: 'Dr Dawit Kabiye', role: 'doctor', site: 'tapion' };

const PATIENT  = '11111111-1111-4111-8111-111111111111';
const CURRENT  = '22222222-2222-4222-8222-222222222222'; // open encounter being documented
const NEW      = '33333333-3333-4333-8333-333333333333'; // created by "+ New encounter"
const PREVIOUS = '44444444-4444-4444-8444-444444444444'; // older closed encounter ("Load this encounter")
const OLD_MARK = 'OLD VISIT';
const PREV_MARK = 'PREVIOUS VISIT';

const now = new Date().toISOString();
const summary = (id, status, createdAt, dx) => ({
  id, createdAt, status, encounterType: 'outpatient', chiefComplaint: null, site: 'tapion',
  diagnosis: dx, icd10Code: null, planDescription: null, followUpDate: null, followUpNotes: null,
});

/** Supabase writes (and the api encounter create) in the order the page sent them. */
const writes = [];

(async () => {
  const browser = await chromium.launch({
    ...(useSandboxBrowser && existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await ctx.route('https://placeholder.supabase.co/**', async route => {
    const req = route.request(); const url = req.url(); const meth = req.method();
    const j = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.includes('/auth/v1/')) {
      if (url.includes('/token') || url.includes('/session')) return j(MOCK_SESSION);
      if (url.includes('/user')) return j(MOCK_USER);
      return j({});
    }
    if (meth !== 'GET' && meth !== 'HEAD') {
      writes.push({ meth, url: decodeURIComponent(url.split('/rest/v1/')[1] ?? url), body: req.postData() ?? '' });
    }
    if (url.includes('user_profiles')) return j([MOCK_PROFILE]);
    // Restored-encounter validation (AppContext) reads encounters.status.
    if (url.includes('/rest/v1/encounters') && meth === 'GET') return j([{ id: CURRENT, status: 'open' }]);
    // The older stored encounter has its own content ("Load this encounter").
    if (meth === 'GET' && url.includes(PREVIOUS)) {
      if (url.includes('/rest/v1/assessments')) return j([{ diagnosis: `${PREV_MARK} DX`, differentials: null, icd10_code: null, updated_at: '2026-01-10T15:00:00.000Z' }]);
      if (url.includes('/rest/v1/plans')) return j([{ description: `${PREV_MARK} PLAN`, updated_at: '2026-01-10T15:00:00.000Z' }]);
      if (url.includes('/rest/v1/medications')) return j([{ drug_name: `${PREV_MARK} Amlodipine`, dose: null }]);
    }
    if (meth === 'GET') return j([]);
    return j([{ updated_at: new Date().toISOString() }], 201);
  });

  let created = false;
  await ctx.route(`${BASE}/api/**`, async route => {
    const url = route.request().url(); const meth = route.request().method();
    const j = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.includes('/api/encounters/patient/')) {
      const list = [
        summary(CURRENT, 'open', now, `${OLD_MARK} DX`),
        summary(PREVIOUS, 'closed', '2026-01-10T14:00:00.000Z', 'Previous visit diagnosis'),
      ];
      if (created) list.unshift(summary(NEW, 'open', new Date().toISOString(), null));
      return j({ encounters: list });
    }
    if (url.includes('/api/encounters') && meth === 'POST') {
      created = true;
      writes.push({ meth, url: 'api/encounters', body: route.request().postData() ?? '' });
      return j({ encounter: { id: NEW, status: 'open', encounter_type: 'outpatient', site: 'tapion', chief_complaint: null, created_at: new Date().toISOString() } });
    }
    return j({});
  });

  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('   page error:', e.message.slice(0, 160)));
  await page.addInitScript(([session, profile, restored]) => {
    if (sessionStorage.getItem('encounter-switch-seeded')) return;
    sessionStorage.setItem('encounter-switch-seeded', '1');
    localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(session));
    localStorage.setItem('amise-profile', JSON.stringify(profile));
    localStorage.setItem('amise-top-section', 'consultation');
    localStorage.setItem('amise-enc-v1', JSON.stringify(restored));
  }, [MOCK_SESSION, MOCK_PROFILE, {
    patientId: PATIENT, encounterId: CURRENT, patientName: 'Encounter Switch Patient',
    assessment: `${OLD_MARK} DX: acute appendicitis`, plan: `${OLD_MARK} PLAN: appendicectomy`,
    hpiNotes: `${OLD_MARK} HPI: right iliac fossa pain`, medications: [`${OLD_MARK} Metformin`],
    orderedInvestigations: [`${OLD_MARK} FBC`], comorbidities: ['Type 2 diabetes'],
  }]);

  const setVisitType = async () => {
    const vt = page.locator('select[aria-label="Visit type"]').first();
    if (await vt.count()) { await vt.selectOption('follow_up'); await page.waitForTimeout(600); }
  };
  const leaksTo = id => writes.filter(w => (w.url.includes(id) || w.body.includes(id)) && w.body.includes(OLD_MARK));
  const writesTo = id => writes.filter(w => w.url.includes(id) || w.body.includes(id));

  console.log('\n🌐 Encounter switch — loading restored encounter...');
  await page.goto(`${BASE}/?tab=encounter_history`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  await setVisitType();
  await page.waitForTimeout(4000); // the current encounter's own autosaves settle

  // ── 1. "+ New encounter" ────────────────────────────────────────────────────
  const newBtn = page.locator('button', { hasText: '+ New encounter' }).first();
  if (!(await newBtn.count())) {
    fail('Encounter history tab', '"+ New encounter" button not found');
  } else {
    await newBtn.click();
    await page.waitForTimeout(5000); // longer than every autosave debounce (2–3 s)
    const toNew = writesTo(NEW);
    const leaked = leaksTo(NEW);
    if (!writes.some(w => w.url === 'api/encounters')) fail('New encounter', 'no POST /api/encounters');
    else if (leaked.length) fail('New encounter starts clean', `${leaked.length} write(s) carried the previous encounter's content: ${leaked.map(w => w.url.split('?')[0]).join(', ')}`);
    else pass(`New encounter starts clean (${toNew.length} writes to it, none with the previous encounter's content)`);

    const assessToNew = toNew.find(w => w.url.startsWith('assessments'));
    if (assessToNew && /"diagnosis":null/.test(assessToNew.body)) pass('New encounter assessment is empty');
    else if (assessToNew) fail('New encounter assessment', assessToNew.body.slice(0, 160));

    const medsToNew = toNew.find(w => w.url.startsWith('rpc/sync_medications_list'));
    if (medsToNew && !/"p_rows":\[\]/.test(medsToNew.body)) fail('Medicines not copied', medsToNew.body.slice(0, 160));
    else pass('Last visit medicines not copied into the new encounter');
  }

  // ── 2. "Load this encounter" (stored, older) ─────────────────────────────────
  await setVisitType();
  const before = writes.length;
  const loadBtns = page.locator('button', { hasText: 'Load this encounter' });
  // The list is newest first: NEW (current, no button), CURRENT, PREVIOUS — the last button is PREVIOUS.
  if (!(await loadBtns.count())) {
    fail('Load this encounter', 'button not found');
  } else {
    await loadBtns.last().click();
    await page.waitForTimeout(5000);
    const after = writes.slice(before);
    const touches = (w, id) => w.url.includes(id) || w.body.includes(id);
    // The stored encounter's content goes nowhere but the stored encounter …
    const prevElsewhere = after.filter(w => w.body.includes(PREV_MARK) && !touches(w, PREVIOUS));
    // … and nothing of the other encounters goes into it.
    const intoPrev = after.filter(w => touches(w, PREVIOUS) && w.body.includes(OLD_MARK));
    if (prevElsewhere.length) fail('Loaded encounter content stays in the loaded encounter', `${prevElsewhere.length} write(s) put it into another encounter: ${prevElsewhere.map(w => w.url.split('?')[0]).join(', ')}`);
    else pass('Loaded encounter content is not written into the encounter that was open before');
    if (intoPrev.length) fail('Loaded encounter starts clean', `${intoPrev.length} write(s) carried another encounter's content into it`);
    else pass('Nothing of the other encounters is written into the loaded encounter');
    if (after.some(w => touches(w, PREVIOUS))) pass('After loading, autosave targets the loaded encounter');
    else fail('Load this encounter', 'no write targeted the loaded encounter — did the load switch the encounter?');
  }

  await page.screenshot({ path: join(OUT, 'encounter-switch.png') });
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\nEncounter switch: ${results.length - failed} pass, ${failed} fail`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
