#!/usr/bin/env node
/**
 * setup-twilio.mjs — auto-configure all Twilio phone numbers.
 *
 * Run once after setting env vars in Render (or locally with a .env file):
 *
 *   node scripts/setup-twilio.mjs
 *
 * What it does:
 *   1. Lists every incoming phone number in your Twilio account
 *   2. Sets Voice URL  → ${API_BASE_URL}/api/calls/twiml   (POST)
 *   3. Sets Status URL → ${API_BASE_URL}/api/calls/status  (POST)
 *   4. For WhatsApp-capable numbers: sets SMS URL → ${API_BASE_URL}/api/whatsapp/incoming
 *   5. Prints a summary table with the before/after state
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — starts with AC…
 *   TWILIO_AUTH_TOKEN    — 32-char hex
 *   API_BASE_URL         — public URL of the deployed API server
 *                          e.g. https://amise-api.onrender.com
 *
 * Optional:
 *   WHATSAPP_NUMBERS     — comma-separated E.164 numbers that should also
 *                          receive the WhatsApp SMS webhook (defaults to
 *                          +17582840557,+17587207111 — Tapion + Rodney Bay)
 *   DRY_RUN=true         — print changes without applying them
 */

import twilio from 'twilio';

// ── Config ────────────────────────────────────────────────────────────────────

const ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const API_BASE     = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
const DRY_RUN      = process.env.DRY_RUN === 'true';

const WA_NUMBERS = (
  process.env.WHATSAPP_NUMBERS ?? '+17582840557,+17587207111'
).split(',').map(n => n.trim()).filter(Boolean);

// ── Validate ──────────────────────────────────────────────────────────────────

const errors = [];
if (!ACCOUNT_SID) errors.push('TWILIO_ACCOUNT_SID is not set');
if (!AUTH_TOKEN)  errors.push('TWILIO_AUTH_TOKEN is not set');
if (!API_BASE)    errors.push('API_BASE_URL is not set (e.g. https://amise-api.onrender.com)');

if (errors.length) {
  console.error('\n❌  Cannot run — missing required env vars:\n');
  errors.forEach(e => console.error('   •', e));
  console.error('\nSet them in Render → Environment, or export them locally before running.\n');
  process.exit(1);
}

// ── URLs we want to set ───────────────────────────────────────────────────────

const VOICE_URL    = `${API_BASE}/api/calls/twiml`;
const STATUS_URL   = `${API_BASE}/api/calls/status`;
const WA_SMS_URL   = `${API_BASE}/api/whatsapp/incoming`;

console.log('\n🏥  Amise MedFlow — Twilio auto-configure');
console.log('─'.repeat(56));
console.log('API base :', API_BASE);
console.log('Voice URL:', VOICE_URL);
console.log('Status   :', STATUS_URL);
console.log('WhatsApp :', WA_SMS_URL);
if (DRY_RUN) console.log('\n⚠️  DRY RUN — no changes will be applied\n');
console.log('─'.repeat(56));

// ── Run ───────────────────────────────────────────────────────────────────────

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

async function run() {
  const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });

  if (numbers.length === 0) {
    console.log('\nNo Twilio phone numbers found in this account.\n');
    return;
  }

  console.log(`\nFound ${numbers.length} number(s):\n`);

  let updated = 0;
  let skipped = 0;
  let failed  = 0;

  for (const num of numbers) {
    const e164 = num.phoneNumber;
    const isWA = WA_NUMBERS.includes(e164);

    const desiredVoiceUrl  = VOICE_URL;
    const desiredStatusUrl = STATUS_URL;
    const desiredSmsUrl    = isWA ? WA_SMS_URL : num.smsUrl;

    const alreadyCorrect =
      num.voiceUrl         === desiredVoiceUrl  &&
      num.statusCallback   === desiredStatusUrl &&
      num.smsUrl           === desiredSmsUrl;

    const label = isWA ? '[voice + WhatsApp]' : '[voice only]';

    if (alreadyCorrect) {
      console.log(`  ✅  ${e164}  ${label}  — already configured`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  📋  ${e164}  ${label}  — would update:`);
      if (num.voiceUrl !== desiredVoiceUrl)
        console.log(`       voiceUrl: ${num.voiceUrl || '(none)'} → ${desiredVoiceUrl}`);
      if (num.statusCallback !== desiredStatusUrl)
        console.log(`       statusCallback: ${num.statusCallback || '(none)'} → ${desiredStatusUrl}`);
      if (isWA && num.smsUrl !== desiredSmsUrl)
        console.log(`       smsUrl: ${num.smsUrl || '(none)'} → ${desiredSmsUrl}`);
      skipped++;
      continue;
    }

    try {
      const updatePayload = {
        voiceUrl:          desiredVoiceUrl,
        voiceMethod:       'POST',
        statusCallback:    desiredStatusUrl,
        statusCallbackMethod: 'POST',
      };
      if (isWA) {
        updatePayload.smsUrl    = desiredSmsUrl;
        updatePayload.smsMethod = 'POST';
      }

      await client.incomingPhoneNumbers(num.sid).update(updatePayload);
      console.log(`  ✅  ${e164}  ${label}  — updated`);
      updated++;
    } catch (err) {
      console.error(`  ❌  ${e164}  — FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log('\n─'.repeat(56));
  if (DRY_RUN) {
    console.log(`\n📋  DRY RUN complete. ${numbers.length} number(s) inspected.`);
    console.log('    Re-run without DRY_RUN=true to apply changes.\n');
  } else {
    console.log(`\n✅  Done. Updated: ${updated}  Already correct: ${skipped}  Failed: ${failed}\n`);
    if (failed > 0) {
      console.error('Some numbers failed to update — check your Twilio credentials and retry.\n');
      process.exit(1);
    }
  }
}

run().catch(err => {
  console.error('\n❌  Unexpected error:', err.message);
  process.exit(1);
});
