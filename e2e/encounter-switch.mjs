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
 * Also (autosave guard, artifacts/dashboard/src/lib/autosave-guard.ts): loading an open encounter
 * whose `medications` and `investigation_results` reads fail must not write either table (the
 * failed read must not become an empty list saved over the record), shows "Couldn't load" and
 * recovers with Retry; loading a CLOSED encounter must write nothing into it.
 *
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
const PREVIOUS = '44444444-4444-4444-8444-444444444444'; // older CLOSED encounter ("Load this encounter")
const STORED   = '55555555-5555-4555-8555-555555555555'; // older OPEN encounter whose medicines / orders fail to load
const OLD_MARK = 'OLD VISIT';
const PREV_MARK = 'PREVIOUS VISIT';

const now = new Date().toISOString();
const summary = (id, status, createdAt, dx) => ({
  id, createdAt, status, encounterType: 'outpatient', chiefComplaint: null, site: 'tapion',
  diagnosis: dx, icd10Code: null, planDescription: null, followUpDate: null, followUpNotes: null,
});

/** Supabase writes (and the api encounter create) in the order the page sent them. */
const writes = [];
let failStoredReads = true;

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
    // The stored open encounter: its medicine list and investigation orders fail to load.
    if (meth === 'GET' && url.includes(STORED)) {
      if (failStoredReads && (url.includes('/rest/v1/medications') || url.includes('/rest/v1/investigation_results'))) {
        return j({ code: 'XX000', message: 'internal error', details: null, hint: null }, 500);
      }
      if (url.includes('/rest/v1/medications')) return j([{ drug_name: 'Stored Losartan', dose: null }]);
      if (url.includes('/rest/v1/investigation_results')) return j([{ test_name: 'Stored LFT' }]);
      if (url.includes('/rest/v1/plans')) return j([{ description: 'Stored plan', updated_at: '2026-05-01T15:00:00.000Z' }]);
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
        summary(STORED, 'open', '2026-05-01T14:00:00.000Z', 'Stored open visit'),
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

  const touches = (w, id) => w.url.includes(id) || w.body.includes(id);
  /** The "Load this encounter" button of the history card whose text contains `text`. */
  const loadButtonFor = text => {
    const card = `div[contains(., "${text}") and .//button[contains(., "Load this encounter")]]`;
    // The innermost such div is the card itself (the list container matches too).
    return page.locator(`xpath=//${card}[not(.//${card})]//button[contains(., "Load this encounter")]`).first();
  };

  // ── 2. Load an open stored encounter whose medicines and orders fail to load ─────
  await setVisitType();
  {
    const before = writes.length;
    const btn = loadButtonFor('Stored open visit');
    if (!(await btn.count())) {
      fail('Load stored open encounter', 'button not found');
    } else {
      await btn.click();
      await page.waitForTimeout(5000); // longer than every autosave debounce
      await page.screenshot({ path: join(OUT, 'encounter-switch-failed-load.png') });
      const after = writes.slice(before);
      const failedTables = after.filter(w => touches(w, STORED)
        && (w.url.startsWith('rpc/sync_medications_list') || w.url.startsWith('investigation_results')));
      if (failedTables.length) fail('A failed read is not written back', `${failedTables.length} write(s): ${failedTables.map(w => w.url.split('?')[0]).join(', ')}`);
      else pass('Failed reads (medicines, investigation orders): no write to either table');
      const unchanged = after.filter(w => touches(w, STORED));
      if (unchanged.length) fail('Nothing unchanged is re-written after a load', unchanged.map(w => w.url.split('?')[0]).join(', '));
      else pass('Nothing loaded and unchanged is re-written');
      const notice = page.locator('[data-testid="record-not-loaded"]');
      const text = (await notice.count()) ? await notice.innerText() : '';
      if (/Medicines/.test(text) && /Investigation orders/.test(text)) pass('"Couldn\'t load" notice names the failed sections');
      else fail('"Couldn\'t load" notice', text ? text.slice(0, 160) : 'not shown');

      // Retry once the reads work again.
      failStoredReads = false;
      const retry = notice.locator('button', { hasText: 'Retry' });
      const beforeRetry = writes.length;
      if (await retry.count()) {
        await retry.click();
        await page.waitForTimeout(4500);
        if (await page.locator('[data-testid="record-not-loaded"]').count()) fail('Retry', 'notice still shown after a successful retry');
        else pass('Retry loads the missing sections and clears the notice');
        const afterRetry = writes.slice(beforeRetry).filter(w => touches(w, STORED));
        if (afterRetry.length) fail('Retry writes nothing', afterRetry.map(w => w.url.split('?')[0]).join(', '));
        else pass('Retry writes nothing back');
      } else {
        fail('Retry', 'no Retry button');
      }
    }
  }

  // ── 3. Load a CLOSED stored encounter: read-only ─────────────────────────────
  // Loading opened the Assess step; go back to the Encounter history tab.
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'encounter_history');
    window.history.pushState(null, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForTimeout(600);
  await setVisitType();
  {
    const before = writes.length;
    const btn = loadButtonFor('Previous visit diagnosis');
    if (!(await btn.count())) {
      fail('Load closed encounter', 'button not found');
    } else {
      await btn.click();
      await page.waitForTimeout(5000);
      const after = writes.slice(before);
      const intoPrev = after.filter(w => touches(w, PREVIOUS));
      if (intoPrev.length) fail('A closed encounter is read-only', `${intoPrev.length} write(s) into it: ${intoPrev.map(w => w.url.split('?')[0]).join(', ')}`);
      else pass('Loading a closed encounter writes nothing into it');
      const prevElsewhere = after.filter(w => w.body.includes(PREV_MARK) && !touches(w, PREVIOUS));
      if (prevElsewhere.length) fail('Loaded encounter content stays in the loaded encounter', `${prevElsewhere.length} write(s) put it into another encounter: ${prevElsewhere.map(w => w.url.split('?')[0]).join(', ')}`);
      else pass('Loaded encounter content is not written into the encounter that was open before');
      if (await page.locator('[data-testid="encounter-read-only"]').count()) pass('Closed encounter shows the read-only notice with Reopen');
      else fail('Closed encounter notice', 'read-only notice not shown — did the load switch the encounter?');
    }
  }

  await page.screenshot({ path: join(OUT, 'encounter-switch.png') });
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\nEncounter switch: ${results.length - failed} pass, ${failed} fail`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
