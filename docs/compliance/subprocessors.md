> **DRAFT — requires review by a qualified lawyer / clinical safety officer before use.**

# Subprocessor register

| | |
|---|---|
| Status | Draft v0.1, 2026-09-24. Code baseline `c9a7293` |
| Evidence | See `data-inventory.md` §5 for file and line citations of each data flow |
| Contract status | **No contract, DPA or BAA is recorded anywhere in this repository.** Every "Status" below is therefore *not yet signed / unknown* until the practice owner confirms otherwise with documentary evidence |
| Vendor offerings | Remarks such as "BAA reportedly available on some plans" are general market knowledge, not verified for this account. **Confirm directly with each vendor** before relying on them |

Legend for "DPA/BAA needed":

- **Required**: the vendor stores or processes identifiable patient data.
- **Recommended**: incidental or metadata-only exposure.
- **n/a**: no personal data reaches the vendor.

"BAA" applies only if the practice, or a customer practice, is a HIPAA covered entity (US). "DPA" means a data-processing agreement suitable for the Saint Lucia Data Protection Act 2011 and, for future markets, UK/EU GDPR Art. 28.

## Register

| # | Vendor | Purpose | Data categories | Region | DPA/BAA needed | Status |
|---|---|---|---|---|---|---|
| 1 | **Supabase** | Primary database, file storage, authentication (staff and patient portal) | All categories: identity, contact, full clinical record, documents, photos, **call recordings**, audit log, staff accounts, patient-portal credentials | Unknown / to confirm (project `nornhfzfrlmfzaqmrzzp`) | **Required.** DPA, plus a BAA / HIPAA add-on if in HIPAA scope | Not yet signed / unknown |
| 2 | **Render** | Hosts the API server (`amise-medflow-api`). Holds all server secrets and stdout logs | All PHI processed by the API, in transit and in memory. Logs contain phone numbers and some message previews (`lib/sms.ts:58`) | Unknown / to confirm (`render.yaml` does not pin a region) | **Required** | Not yet signed / unknown |
| 3 | **Vercel** | Hosts the dashboard, front-desk and patient portal, and the finance auditor. **Proxies `/api/*` to Render.** Runs front-desk Next.js API routes that use the Supabase service-role key | PHI in transit (all API traffic from these apps). Front-desk serverless functions process intake PHI | Unknown / to confirm | **Required** | Not yet signed / unknown |
| 4 | **Google (Workspace: Gmail and Calendar)** | Reads the practice inbox (patient emails, lab-result attachments). Sends and drafts replies and reminders. Calendar events for appointments | Identity, contact, free-text clinical content in emails, results documents, appointment details | Unknown / to confirm | **Required.** Workspace DPA / BAA; not available on consumer Gmail | Not yet signed / unknown. **Also confirm the account is Workspace, not consumer Gmail** |
| 5 | **Twilio** | SMS and WhatsApp messaging, voice, call forwarding, voicemail recording, optional transcription | Patient phone numbers, message bodies (appointment, prep instructions), inbound patient messages, voicemail audio and transcripts | Unknown / to confirm | **Required** | Not yet signed / unknown |
| 6 | **Meta Platforms (WhatsApp Cloud API)** | Alternative WhatsApp provider: inbound webhook and outbound replies (`routes/whatsapp.ts`) | Phone numbers, message content | Unknown | **Required** if enabled. A BAA is generally not offered; **consider not using it for PHI** | Not yet signed / unknown. Active only if `WHATSAPP_ACCESS_TOKEN` is set, **to confirm** |
| 7 | **Telnyx** | Alternative WhatsApp/SMS provider (`routes/whatsapp.ts:268-286`) | Phone numbers, message content | Unknown | **Required** if enabled | Not yet signed / unknown. Active only if `TELNYX_API_KEY` is set, **to confirm** |
| 8 | **Digicel** | Planned SMS provider | **None today.** The provider throws "not implemented" (`lib/sms.ts:103-105`) | n/a | Required *before* implementation | Not yet signed. Not in use |
| 9 | **Anthropic** | Claude LLM. **Web and API: in use** for email classification and reply drafting, conversational WhatsApp/SMS intake, AI consult, letters, op notes, discharge summaries, endoscopy and procedure reports, code suggestion, narrative and voice parsing, document and referral scanning, M&M analysis, questionnaire summaries. **iOS: disabled** (`ios/AmiseMedFlow/Services/AIService.swift` stubs all calls) | **Identifiable PHI**: names, DOB, MRN, full clinical narratives, patient emails and messages, scanned documents. No de-identification layer exists | Unknown / to confirm | **Required.** BAA and a zero-data-retention arrangement, if available to the account | Not yet signed / unknown. **Until signed, set `DISABLE_AI=true` (or remove `ANTHROPIC_API_KEY`) on Render and on the front-desk Vercel project.** `DISABLE_AI=true` is now a complete off switch for every web and API call site (`lib/ai-gate.ts` in each deployment; see `data-inventory.md` §6) |
| 10 | **OpenAI** | Whisper transcription of uploaded staff mobile-phone call recordings (`routes/call-recording.ts`). Switched off by `DISABLE_AI=true` or `DISABLE_TRANSCRIPTION=true` | Audio of patient phone calls, which may include any clinical content | Unknown | **Required** if `OPENAI_API_KEY` is set | Not yet signed / unknown. Whether the key is set in production is **to confirm** |
| 11 | **Sentry (Functional Software Inc.)** | Error and crash monitoring for web, API and iOS | iOS: PHI-minimised by configuration (`ios/AmiseMedFlow/Services/CrashReporting.swift`). **Web and API: default SDK config with no `beforeSend` scrubbing** (`artifacts/dashboard/src/main.tsx:14-17`, `artifacts/api-server/src/index.ts:11-15`), so error messages, URLs and breadcrumbs could contain PHI | Unknown (Sentry offers US and EU regions; to confirm) | **Required** (web and API); Recommended (iOS) | Not yet signed / unknown. Whether the DSNs are set is **to confirm** (`docs/INCIDENT-RUNBOOK.md`) |
| 12 | **GitHub (Microsoft)** | Source code, CI, deploy workflows. **The nightly backup runner handles full database dumps** (`.github/workflows/backup.yml`). Also runs the cron and migration workflows | Full DB dump in runner memory and disk before GPG encryption. Supabase service-role key and NAS SSH key in Actions secrets | Unknown | **Required** while backups run on GitHub-hosted runners (or move them to a self-hosted runner) | Not yet signed / unknown |
| 13 | **Apple** | iOS platform. **Server-based speech recognition** for dictation (`SpeechService.swift:158`). iCloud device backup (may include the local store). Calendar sync of EventKit events carrying patient names. App distribution | Dictated clinical speech. Potentially the whole local store via device backup. Patient names and procedures in calendar | Unknown | Recommended. Apple does not generally sign BAAs for these consumer services, so **prefer on-device recognition and exclude the store from backup** | Not yet signed / unknown |
| 14 | **goQR.me (api.qrserver.com)** | **Removed.** Formerly generated the questionnaire QR-code image in the dashboard | **None today.** Formerly the patient questionnaire URL, including its session token | Unknown (EU company) | None needed. QR codes are now generated locally (`LocalQrCode.tsx`) | No agreement. **Removed**; a CI lint blocks reintroduction |
| 15 | **jsDelivr (CDN)** | Serves the in-browser speech-model runtime (`workers/asr-worker.ts:23`) | Browser IP and user-agent only (audio stays local, to confirm) | Global CDN | n/a (Recommended: self-host) | n/a |
| 16 | **Google Fonts** | Web fonts | Browser IP and user-agent only | Global | n/a (Recommended: self-host) | n/a |
| 17 | **Synology NAS (practice-owned hardware)** | Backup target (server backups over SFTP, iOS backups over WebDAV) | Full DB dumps (GPG-encrypted), unencrypted document mirror, plaintext iOS JSON exports | On premises, location to confirm | n/a (practice-controlled). Physical and volume-encryption controls must be documented | To document |
| 18 | **Tailscale** (optional) | Suggested for remote NAS access (`NASBackupService.swift` doc comment) | Encrypted tunnel metadata; content is end-to-end encrypted by WireGuard | Unknown | Recommended if used | Unknown whether used |
| 19 | **Ollama (self-hosted, optional)** | Local LLM alternative (`artifacts/dashboard/src/lib/ai-provider.ts`) | Clinical narrative, if selected by the user | Local network | n/a if truly self-hosted. The practice must ensure the endpoint is not exposed publicly | Default is `cloud`; unknown whether used |
| 20 | **Railway** | `railway.json` exists | Unknown | Unknown | Required if used | **Unknown whether used.** Confirm, and delete the config if not |

## Actions arising

1. **Collect or sign the agreements for vendors 1-5 first.** They hold PHI today in every configuration.
2. **Decide on Anthropic (9) and OpenAI (10).** Either sign a BAA/DPA with zero retention, or switch them off in production with `DISABLE_AI=true` (Render and front-desk Vercel), or by unsetting `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`. `DISABLE_AI` now covers every AI route (done).
3. ~~**Remove the api.qrserver.com call (14).**~~ **Done.** QR codes are generated locally, and `lint:no-external-qr` blocks reintroduction.
4. **Add `beforeSend` scrubbing to web and API Sentry (11)**, mirroring `CrashReporting.swift`.
5. **Confirm and document the hosting region** for vendors 1-4 and 11. Record whether any cross-border transfer rules apply under the Saint Lucia Act.
6. **Keep this register current.** Add a CI or PR checklist item: "new outbound host or SDK? Update `docs/compliance/subprocessors.md`."
