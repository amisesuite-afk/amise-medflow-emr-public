# Change log — `lifestyle-practices` (ritual fasting, complementary therapies, sleep; non-drug options)

2026-09-25. Source: the practice owner's evidence briefing, *Ancient Remedy, Modern Market*
(Dr Dawit Daniel Kabiye, Sept 2026). Only §4 (habits and rituals), §6 (hands-on and device
therapies), §8 (verdict table) and the matching §10 references were used, on the owner's
instruction to take "just the medically and ritually relevant information … not the philosophy or
poetry". No Scripture, talk notes, market figures or thesis lines appear anywhere in the app.

Supplements and herbal products (catalogue, herb–drug interactions, pre-op stop times, LFT / lead /
aristolochic / detox-tea / IV-drip product prompts) belong to a separate change and were not
touched here.

Everything is deterministic (no AI, no network). Every prompt is dismissible, and nothing is added
to the record unless the clinician taps it. No text tells anyone to take, hold, stop or adjust a
medicine; for clinicians, "medication review recommended" is the limit. `lastReviewed` stays
`unknown` in the registry.

## What changed

### 1. Structured social / lifestyle history (web and iOS)

| Field | Values |
|---|---|
| Religious or ritual fasting | None / Ramadan / Orthodox or Lent fasting / Daniel Fast / Time-restricted eating or intermittent fasting / Other (free text); "None" is exclusive |
| Fast status | Currently fasting / Fast planned / Not currently fasting, plus "when next planned" (free text) |
| Complementary therapies | Acupuncture, cupping, yoga, tai chi, mindfulness/meditation, slow-breathing practice, detox or cleanse programmes, IV vitamin drips, other (free text) |
| Sleep and shift work | Night-shift work (yes / no / not recorded); usual sleep in hours (0–24) |

- **Storage: no new column, no migration.** The record is the `lifestyle` key of
  `patients.pathway_data_json` (Migration 86), which the iOS app already syncs as `PathwayData`
  (Supabase and peer sync). iOS: `PathwayData.lifestyle` (missing key → nothing recorded). Web:
  `lib/lifestyle-history-db.ts` reads the blob, replaces only `lifestyle` and writes it back; a blob
  that is not JSON is never overwritten. If the column is missing on a database, the web keeps the
  record in the browser's encounter cache and the card says "Saved in this browser only"; the save
  is not queued in the outbox. `pathway_data_json` is clinician-only under Migration 89, so a front
  desk account cannot write it (the same as the iOS pathway forms).
- Conflict rule inherited from `SyncService+PathwayData`: an iOS device with unpushed pathway edits
  pushes its whole blob, so a lifestyle edit made on the web at the same moment can be overwritten
  by the device's older copy. Otherwise each side takes the other's saved copy.
- UI: dashboard Social History → "Fasting, complementary therapies and sleep" card
  (`LifestyleHistoryCard.tsx`); iOS Consultation → Social tab (`LifestyleSections.swift`).
- SOAP background / social history: `lifestyleSummary` / `LifestyleHistory.summary`, e.g.
  "Fasting: Ramadan (currently fasting). Complementary therapies: Acupuncture, Yoga. Night-shift
  work; usual sleep 5 h a night." It appears only when something is recorded: iOS
  `SOAPDraftEngine` (subjective and narrative background), web consultation summary (Family &
  Social History → "Lifestyle:").
- Exported for other modules: `usesDetoxOrCleanse`, `usesIvVitaminDrips` (web functions; iOS
  `LifestyleHistory` properties). No separate prompt is raised for them here.

### 2. Patient questionnaire (front-desk token questionnaire and web intake)

Two information-only questions (plus a timing follow-up) in `lib/triage-engine/src/lifestyle-questions.ts`,
wired into APCQ:

- "Do you fast for religious or other reasons (for example Ramadan, Lent, a Daniel Fast or
  intermittent fasting)?" (select all; "No" option) → if any fast: "Are you fasting at the moment,
  or planning a fast soon?" (now / within the next month / later / not sure).
- "Do you use any traditional or complementary treatments (for example acupuncture, cupping, yoga,
  detox or cleanse programmes, vitamin drips)?"

They are asked in the `general_screening`, `new_consult`, `pre_op` and `second_opinion` templates,
always last and only while the session is under the 18-question cap, so they never displace a
clinical question. The api-server keeps them out of the drafted symptom list; the dashboard shows
the answers as "Fasting (patient-reported): …" social-history lines. The clinician records the
structured fields; answers are not copied into them automatically. The iOS front-desk iPad
questionnaire (`AdaptiveQuestionnaireSheet`) was not changed.

### 3. Clinician-facing safety prompts (dismissible, cited)

| Id | Grade | Trigger | Wording |
|---|---|---|---|
| `fasting-diabetes-insulin-su` | warning | Any fast recorded (not "None"), status current / planned / not recorded, AND diabetes, AND insulin or a sulfonylurea on the medication list or problem list | "Fasting with insulin/sulfonylurea: risk of hypoglycaemia and dehydration — pre-fast risk stratification and medication review recommended (IDF-DAR 2021)." |
| `fasting-diabetes` | caution | Same, diabetes without insulin / sulfonylurea | "Fasting with diabetes: risk of hypoglycaemia and dehydration — pre-fast risk stratification recommended (IDF-DAR 2021)." |
| `fasting-perioperative` | caution | Religious or ritual fast (Ramadan, Orthodox/Lent, Daniel Fast, other; **not** time-restricted eating), status current / planned / not recorded, AND a procedure booked | "Religious fast overlaps the pre-operative fast — check hydration and glucose plan." |
| `night-shift-short-sleep` | info | Night-shift work OR usual sleep < 6 h, AND a cardiometabolic context (diabetes, BMI ≥ 30 or obesity, hypertension, dyslipidaemia, IHD/angina/MI, heart failure, stroke, metabolic syndrome, PAD) | "Night-shift work / short sleep is associated with metabolic, cardiovascular and mood disorders." |

"Procedure booked": web — visit type pre-op / day of surgery / ERCP / OGD / colonoscopy, an
endoscopy or office-procedure encounter, or the "Pre-operative visit" symptom chip; iOS — an
operation date today or later (ECT) or a Day of Surgery / ERCP / OGD / Colonoscopy / Elective or
Emergency Surgery / Bronchoscopy visit. Diabetes matching is negation-aware and excludes
pre-diabetes and diabetes insipidus; "insulin resistance" and "non-insulin-dependent" are not
insulin. Insulin / sulfonylurea names are a local list in the new module (the drug-class files were
not edited).

### 4. Evidence-graded non-drug plan suggestions ("Suggested" badge, tap to add)

Shown on the dashboard Plan step (`LifestylePracticesPanel.tsx`) and the iOS Plan tab. The grade
label comes from the briefing (§8 verdict table; §6 for IV drips).

| Id | Practice | Grade | Shown when | Plan line cites |
|---|---|---|---|---|
| `tai-chi` | Tai chi | Works | Age ≥ 65, or falls / frailty recorded (reason adds "post-operative rehabilitation" when ≥ 65 and a procedure is booked) | Huang ZG et al. 2023 (24 RCTs, falls RR 0.76) |
| `yoga` | Yoga | Works | Low back pain in the confirmed diagnosis, problem list or complaint | Saper RB et al., Ann Intern Med 2017 |
| `mbct` | MBCT (referral option) | Works | Depression recorded (not "ST depression", "respiratory depression") | Kuyken W et al., JAMA Psychiatry 2016 (HR 0.69) |
| `slow-breathing` | Slow breathing (~6/min) | Modest | Anxiety / anxious / panic attack or disorder recorded; text says it is not a treatment for high blood pressure | Briefing §4/§8 (no primary reference) |
| `acupuncture` | Acupuncture (referral option) | Modest | Back or neck pain, osteoarthritis, chronic headache / migraine | Vickers AJ et al., Arch Intern Med 2012 |
| `time-restricted-eating` | Time-restricted eating | Modest | BMI ≥ 30 or obesity recorded. With diabetes on insulin / a sulfonylurea the line always carries the fasting safety note | Liu D et al., NEJM 2022 (+ IDF-DAR 2021 note) |
| `counsel-cupping` | Cupping | No benefit shown | Only when the record lists it | Briefing §6/§8 |
| `counsel-detox` | Detox teas / colon cleanses | No benefit shown | Only when the record lists it | Briefing §6/§8 |
| `counsel-iv-drips` | IV vitamin drips | Mixed | Only when the record lists it | Briefing §6 |

Web suggestions read only a **confirmed** working diagnosis (locked, or a recorded ICD-10 code),
plus the problem list, age and complaint. Spermidine was left to the supplements change.

### 5. Health-information library (drafts only)

`HEALTH_INFO_LIBRARY_VERSION` 0.1.0 → 0.2.0 (registry `front-desk-health-information` updated). All
three are `status: 'draft'` with no `lastReviewed` / `reviewedBy`; they are not public.

- `religious-fasting-diabetes` — "Fasting for religious reasons when you have diabetes".
- `mind-body-practices` — "Exercise and mind-body practices with good evidence".
- `detox-cleanses-drips` — "Detox teas, cleanses and vitamin drips".

`lint:patient-instructions` passes (no medicine word with an instruction verb, no doses, no fees,
no "midnight"). "Low cost" was removed from article 12 because the fee rule flags "cost".

## Tests and checks

- Shared vectors: `artifacts/dashboard/src/lib/__tests__/lifestyle-practices.test.ts` (first
  describe block) and `ios/AmiseMedFlowTests/LifestylePracticesTests.swift`, one for one. The web
  file also checks the H-10 wording of every prompt, plan line and question, and the APCQ
  placement. `lifestyle-context-web.test.ts` and `lifestyle-history-blob.test.ts` cover the web
  adapter and the blob merge.
- The Swift code was not compiled here (no Xcode). Every new type name was checked for duplicates.
- `clinval:web`: 397 vignettes, 3087 expectations, 2625 pass, 0 blocking — the same as before this
  change (none of the vignettes records a lifestyle history).

## Needs sign-off

1. **Grade labels.** Works: tai chi, yoga, MBCT. Modest: slow breathing, acupuncture,
   time-restricted eating. No benefit shown: cupping, detox teas / colon cleanses. **IV vitamin
   drips are labelled "Mixed"** (briefing §6); the brief for this change asked for them under "No
   benefit shown", but the verdict table (§8) does not list them and §6 grades them Mixed. Choose one.
2. **Trigger conditions** (tables in §3 and §4 above), in particular:
   - tai chi for **every** patient aged ≥ 65, even without a falls history;
   - yoga and acupuncture on any mention of back pain (duration is not known, so "chronic
     non-specific" cannot be checked; the reason text says so);
   - MBCT on any recorded depression (the evidence is for recurrent depression);
   - slow breathing on any recorded anxiety, not only before a procedure;
   - the night-shift / short-sleep note only in a cardiometabolic context (mood disorders are not a
     trigger).
3. **The ≥ 65 threshold** for "older adult" (tai chi).
4. **The < 6 h sleep threshold** (strictly less than 6; 6 h does not trigger).
5. **BMI ≥ 30** for time-restricted eating, and the decision to **show it with the fasting safety
   note** (rather than hide it) when diabetes is treated with insulin or a sulfonylurea.
6. **Fasting-prompt wording and scope**:
   - the two diabetes prompts and the perioperative prompt, word for word (§3 table);
   - the diabetes prompts also fire for **time-restricted eating / intermittent fasting** and the
     **Daniel Fast** (brief said "religious or ritual fasting"; widened for safety);
   - a fast with **no status recorded** counts as current or planned; only "Not currently fasting"
     turns the prompts off;
   - the perioperative prompt does not check dates (the planned date is free text), so it fires for
     any current or planned religious fast when a procedure is booked;
   - the insulin and sulfonylurea name lists in `lifestyle-practices.ts` / `LifestylePractices.swift`.
7. **The three draft articles**, for approval or edits: fasting with diabetes; exercise and
   mind-body practices; detox teas, cleanses and vitamin drips. The fasting article lists signs of
   low blood sugar and urgent-care signs (low blood sugar that does not settle, fainting, severe
   dehydration) that are general knowledge, not taken from the briefing.
8. **Questionnaire**: the wording of the two questions, the timing follow-up, the option labels
   ("Vitamin drips", "Breathing exercises"), and the templates that ask them.
9. **Citation details written from memory** (not in the briefing's §10):
   - **"IDF-DAR 2021"** — the briefing names "international diabetes guidance (IDF-DAR)" in §4
     with no year and no numbered reference. The year 2021 and the title "Diabetes and Ramadan:
     Practical Guidelines" are from memory. Used in the two diabetes prompts, the time-restricted
     eating note, and as the source of the fasting article.
   - The volume/page details for Saper 2017 (167:85-94), Kuyken 2016 (73:565-74) and Liu 2022
     (386:1495-1504) are from §10 as written. Huang 2023 and Vickers 2012 have no volume/page in
     §10 and none was added. "24 RCTs, RR 0.76" and "HR 0.69" are from §4.
   - The slow-breathing, cupping / detox / IV-drip and night-shift / sleep items cite the briefing
     itself, because §10 lists no primary reference for them.
   - The detox article's only source is the practice briefing (2026).
