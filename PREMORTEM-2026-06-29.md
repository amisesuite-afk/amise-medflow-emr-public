# Amise MedFlow EMR — Premortem & Deployment Readiness

**Date**: 2026-06-29 · **Scope**: EMR Dashboard + Front Desk Portal + Website + API Server

---

## System Architecture Overview

| Component | Platform | Live URL | Status |
|-----------|----------|----------|--------|
| **Front Desk / Website** | Vercel | https://front-desk-topaz.vercel.app | Deployed |
| **EMR Dashboard** | Vercel | https://dashboard-lemon-gamma-44.vercel.app | Deployed |
| **API Server** | Render | https://amise-medflow-api.onrender.com | Needs env vars |
| **Database** | Supabase | https://nornhfzfrlmfzaqmrzzp.supabase.co | Live |
| **Custom Domain** | DNS | https://amisemedical.com | DNS not configured |

---

## P0 — BLOCKERS (Must fix before any real patient data)

### 1. Nine database migrations NOT in CI workflow

The `run-migrations.yml` workflow runs 24 migrations. **9 migration files exist on disk but are not executed**:

| Migration | Impact |
|-----------|--------|
| `supabase-clinical-persistence-migration.sql` | Surgical history, toxic habits, ROS, trauma records, prescriptions — **all clinical persistence tables missing** |
| `supabase-emr-enhancement-migration.sql` | EMR formulary, procedure catalog, ICD-10 codes — **Phase C data missing** |
| `supabase-performance-indexes-migration.sql` | Query performance indexes |
| `supabase-web-intake-delivery-method-migration.sql` | Web intake `delivery_method='web_intake'` — **web intake will fail** |
| `supabase-staff-review-migration.sql` | Staff review timestamps |
| `supabase-preferred-slot-text-migration.sql` | Preferred slot type fix |
| `supabase-anon-intake-migration.sql` | Anonymous intake support |
| `supabase-appointment-questionnaire-link-migration.sql` | Links bookings to questionnaire sessions |
| `supabase-appointment-requests-align-migration.sql` | Aligns appointment_requests schema |

**Fix**: Add all 9 to `run-migrations.yml` and re-run the workflow.

### 2. No offline/degraded-mode fallback for clinical data

When Supabase or the API server is unreachable:
- All clinical saves silently fail (`db.ts` logs to console, no UI feedback)
- No local queue, no retry, no offline cache for encounter data
- A doctor could complete an entire consultation and lose everything on network blip
- `FloatingActions.tsx` only caches patient metadata to localStorage, not clinical entries

**Fix**: Add write-ahead queue (IndexedDB) that retries on reconnection. Show degraded-mode banner.

### 3. No concurrent-edit protection

Zero optimistic locking on encounter records:
- Two staff open same patient → last writer silently wins
- No `updated_at` version check on Supabase upserts
- No "patient locked by Nurse X" indicator
- All `upsert()` calls in `db.ts` use `onConflict: 'encounter_id'` without timestamp guards

**Fix**: Add `updated_at` column checks on all clinical upserts. Return 409 on stale writes.

### 4. No audit trail for clinical entries

Backend has audit functions in questionnaire routes but:
- Dashboard clinical saves (assessment, plan, medications, vitals, exam) have **zero audit logging**
- Cannot trace who entered what, or when it was modified
- This is a regulatory and malpractice liability risk

**Fix**: Add `created_by`, `updated_by`, `updated_at` to all clinical write functions. Log to `audit_logs` table.

---

## P1 — HIGH (Data integrity / Clinician pain)

### 5. Encounter closure has no validation

`closeEncounter()` in `db.ts:963-976` only sets `status='closed'`:
- No check that assessment is complete
- No check that vitals exist
- No check that billing is done
- No discharge summary validation
- No reason-for-closure captured
- A doctor can close an empty encounter

### 6. Inpatient admission is UI-only

The "Switch to Inpatient" button (Fix 4) changes `encounterMode` state but:
- No formal admission record created in Supabase
- No ward/bed assignment
- No admitting diagnosis or team captured
- Switching back to outpatient loses the inpatient context

### 7. Calendar IDs are placeholder

`render.yaml:24-28` has all three calendar IDs set to `amisesuite@gmail.com` — these need to be real Google Calendar IDs for Rodney Bay, Castries, and Tapion.

### 8. Cron jobs may not be running

`cron.yml` POSTs to `https://amise-medflow-api.onrender.com` which cold-starts on free/starter plan. If the API is asleep when cron fires, the `curl` may timeout. The `keep-api-warm.yml` workflow exists but needs verification.

### 9. Documents tab is a placeholder

`DocumentsTab.tsx` (38 lines) shows "File upload and document management will be available in a future release." No file upload, no PACS/RIS/LIS link, no document viewer.

### 10. Referral letter generation missing

`ReferringProvidersTab.tsx` manages provider records but cannot generate formal referral letters. Doctors must write these manually.

---

## P2 — MEDIUM (UX / Workflow gaps)

### 11. Recent Fix edge cases

| Fix | Edge Case | Risk |
|-----|-----------|------|
| **Fix 2: Trauma routing** | Trauma keywords bypass triage scoring entirely | Acuity badge may show "routine" for a major trauma patient |
| **Fix 3: Pathway labs** | Score threshold (>=15) may miss obvious pathways with fewer symptom matches | Single-symptom presentations like "Breast lump" score 10 (below threshold) |
| **Fix 4: Admission prompt** | Requires both `urgent` acuity AND `highConfidence` pathway | Some admissions are clinical judgment, not pathway-driven |
| **Fix 5: Procedures in Disposition** | Procedures appears both as top-level nav AND inside consultation Disposition | Could confuse doctor about which one to use |
| **Fix 6: AI co-pilot** | Panel overlaps main content on narrow screens (< 840px) | Fixed 420px width may obscure clinical data on iPad |

### 12. Role-segregated UI means doctors can't see nurse vitals inline

`Home.tsx:273-274` returns completely different views per role. A doctor writing an assessment cannot see nurse-entered vitals in a side panel — must switch to InpatientTab or look at the header acuity badge.

### 13. StubPanel component defined but unused

`Home.tsx:119-127` defines `StubPanel` which is imported nowhere. Dead code.

### 14. Billing is tracking-only

`BillingTab.tsx` and the API billing routes record charges and payments but:
- No Stripe/Square/payment processor integration
- No online payment gateway
- No insurance claim submission
- Manual invoicing only

---

## Migrations Checklist

### Currently in `run-migrations.yml` (24 steps)

All idempotent. Can be re-run safely.

### Must add to workflow

| # | File | Table(s) Created |
|---|------|------------------|
| 26 | `supabase-preferred-slot-text-migration.sql` | Fixes `preferred_slot` column type |
| 27 | `supabase-staff-review-migration.sql` | Adds staff review timestamps |
| 28 | `supabase-anon-intake-migration.sql` | Anonymous intake support |
| 29 | `supabase-appointment-questionnaire-link-migration.sql` | FK linking bookings to questionnaires |
| 30 | `supabase-appointment-requests-align-migration.sql` | Schema alignment for appointment_requests |
| 31 | `supabase-web-intake-delivery-method-migration.sql` | Adds `web_intake` to delivery_method CHECK |
| 32 | `supabase-clinical-persistence-migration.sql` | surgical_history, toxic_habits, ros_findings, scales_scores, dashboard_prescriptions, operative_notes, trauma_records, clinical_attachments |
| 33 | `supabase-emr-enhancement-migration.sql` | Formulary, procedure catalog, ICD-10, encounter fields |
| 34 | `supabase-performance-indexes-migration.sql` | Query performance indexes |

---

## Backup Strategy (3x Redundancy)

### Layer 1: Supabase (Primary — Cloud)

Supabase provides:
- **Automatic daily backups** (Pro plan: 7-day retention, point-in-time recovery)
- **WAL archiving** for continuous backup
- **Dashboard**: Settings → Database → Backups

**Action items:**
- Verify Supabase plan includes PITR (Point-in-Time Recovery) — requires Pro ($25/mo)
- Enable PITR in Supabase dashboard
- Test restore procedure at least once before go-live

### Layer 2: Local NAS (On-Premise)

**Weekly automated export to NAS:**

```bash
#!/bin/bash
# /opt/amise-backup/backup-to-nas.sh
# Run via cron: 0 2 * * 0 (every Sunday 2am ECT)

BACKUP_DIR="/mnt/nas/amise-medflow-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEST="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$DEST"

# 1. Database dump via Supabase CLI or pg_dump
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
  -h db.nornhfzfrlmfzaqmrzzp.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  --format=custom \
  --file="$DEST/amise-medflow-db-$TIMESTAMP.dump"

# 2. Supabase Storage (clinical photos, attachments)
# Use supabase CLI or S3-compatible tool
aws s3 sync \
  s3://nornhfzfrlmfzaqmrzzp/storage/v1/ \
  "$DEST/storage/" \
  --endpoint-url https://nornhfzfrlmfzaqmrzzp.supabase.co/storage/v1/s3

# 3. Git repo snapshot
cd /path/to/amise-medflow-emr-public
git bundle create "$DEST/repo-$TIMESTAMP.bundle" --all

# 4. Env vars (encrypted)
gpg --symmetric --cipher-algo AES256 \
  --output "$DEST/env-vars-$TIMESTAMP.gpg" \
  /opt/amise-backup/env-snapshot.txt

# 5. Retention: keep last 12 weekly backups
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +84 -exec rm -rf {} \;

echo "[$(date)] Backup complete: $DEST"
```

**NAS requirements:**
- Synology / QNAP NAS on clinic LAN
- RAID 1 minimum (mirror) for hardware redundancy
- Encrypted volume (AES-256) for HIPAA-equivalent compliance
- UPS-backed to survive power outages
- Mount point: `/mnt/nas/amise-medflow-backups`
- Minimum 500GB (clinical photos grow fast)

### Layer 3: iCloud (Off-Site Cloud)

**Daily sync from NAS to iCloud Drive:**

```bash
#!/bin/bash
# /opt/amise-backup/sync-to-icloud.sh
# Run via cron: 0 4 * * * (daily 4am ECT, after NAS backup completes)

ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/AmiseMedFlow-Backups"
NAS_DIR="/mnt/nas/amise-medflow-backups"

# On macOS server with iCloud account signed in:
rsync -avz --delete \
  "$NAS_DIR/" \
  "$ICLOUD_DIR/"

# Alternative: use rclone for headless Linux
# rclone sync "$NAS_DIR" icloud:AmiseMedFlow-Backups
```

**iCloud setup:**
- Sign into iCloud on a dedicated Mac Mini at the clinic
- Enable iCloud Drive with 2TB plan ($9.99/mo)
- The `~/Library/Mobile Documents/` folder auto-syncs to iCloud
- Accessible from any Apple device signed into the same Apple ID
- For Linux NAS: use `rclone` with iCloud backend (requires app-specific password)

### Backup Verification Schedule

| Check | Frequency | Who |
|-------|-----------|-----|
| Supabase PITR working | Monthly | Admin |
| NAS backup file exists and non-zero | Weekly (automated alert) | Script |
| iCloud sync completed | Daily (automated alert) | Script |
| **Full restore test** | Quarterly | Admin + Dev |
| Backup encryption keys accessible | Monthly | Practice owner |

### Disaster Recovery Scenarios

| Scenario | Recovery Source | RTO | RPO |
|----------|---------------|-----|-----|
| Supabase outage (temporary) | Wait for Supabase restoration | ~1h | 0 (real-time) |
| Supabase data loss | Restore from PITR or NAS dump | ~2h | < 24h |
| NAS hardware failure | iCloud + Supabase PITR | ~4h | < 24h |
| Clinic fire/flood | iCloud + Supabase (both off-site) | ~8h | < 24h |
| Ransomware | iCloud versioning + Supabase PITR | ~4h | < 24h |
| Accidental deletion | Supabase PITR (granular) | ~30min | < 5min |

---

## Deployment Checklist

### Pre-Launch (Do Now)

- [ ] Run missing 9 migrations via Supabase SQL Editor or update `run-migrations.yml`
- [ ] Set real Google Calendar IDs in Render env vars (not placeholder emails)
- [ ] Verify `CRON_SECRET` matches between Render env and GitHub secrets
- [ ] Set `MODE=supervised` (not `auto`) for initial launch
- [ ] Set `SMS_PROVIDER=twilio` with real Twilio credentials
- [ ] Configure custom domain DNS → Vercel nameservers
- [ ] Set `PORTAL_URL` and `DASHBOARD_URL` in Render to production URLs
- [ ] Create at least 3 user accounts: front_desk, nurse, doctor (via Supabase Auth)
- [ ] Test login flow end-to-end on dashboard
- [ ] Test booking flow end-to-end: patient books → staff confirms → SMS sent

### Pre-Launch (Clinical Safety)

- [ ] Test trauma auto-routing with each of the 6 trauma keywords
- [ ] Verify pathway confidence banner shows correctly for known pathways
- [ ] Test encounter create → close lifecycle with at least one test patient
- [ ] Verify prescriptions tab uses formulary data (requires migration #33)
- [ ] Verify procedures tab shows catalog data (requires migration #33)
- [ ] Confirm AI co-pilot panel doesn't obscure data on iPad (1024px width)

### Backup Setup

- [ ] Verify Supabase plan includes daily backups + PITR
- [ ] Purchase NAS hardware (Synology DS220+ or equivalent, 2x 1TB SSD RAID 1)
- [ ] Set up backup script on NAS or clinic Mac
- [ ] Set up iCloud sync on dedicated Mac Mini
- [ ] Run first full backup and verify restore
- [ ] Store encryption key in physical safe at clinic + 1 off-site location

### Post-Launch Monitoring

- [ ] Set `VITE_SENTRY_DSN` + `SENTRY_DSN` for error monitoring
- [ ] Verify `keep-api-warm.yml` prevents Render cold starts
- [ ] Monitor cron job execution (GitHub Actions → Cron tab)
- [ ] Check Supabase dashboard for query performance after first week

---

## Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| Helmet headers | Present | `app.ts:42` |
| Rate limiting | Present | Public (60/15min), SMS (20/15min), Webhook (100/15min), Booking (5/15min) |
| CORS | Configured | Requires `PORTAL_URL` and `DASHBOARD_URL` env vars |
| Auth | Supabase RLS | Email/password, magic links for patients |
| Input validation | Partial | Zod schemas on API routes; dashboard forms lack server-side validation |
| Secrets in code | None found | All via env vars |
| CSRF | Not implemented | Express 5 + cookie-parser but no CSRF token |
| Error boundaries | Present | `ErrorBoundary` component wraps main content + AI panel |
| Sentry | Wired | Optional via `VITE_SENTRY_DSN` / `SENTRY_DSN` |

---

## Summary

**What's solid:**
- 41 fully implemented tab components (zero stubs)
- Complete booking lifecycle (request → confirm → remind → complete)
- SMS / Email / WhatsApp all wired
- Role-based access with proper hierarchy
- 34 clinical pathways with suggested investigations
- Full patient portal with self-service
- Proper security headers, rate limiting, and error boundaries

**What will bite you:**
1. 9 unapplied migrations (clinical persistence tables don't exist in prod)
2. No offline resilience (network blip = lost consultation)
3. No concurrent-edit protection (two staff = data loss)
4. No clinical audit trail (regulatory risk)
5. Encounter closure has no completeness validation
6. Calendar IDs are placeholders
7. Documents tab is still a placeholder
