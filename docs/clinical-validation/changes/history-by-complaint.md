# Change log — `history-frames` (the history questions follow the chief complaint, web and iOS)

**Owner report (2026-09-26):** with a cough complaint the iPad showed the right "Quick Clinical Flags —
Respiratory" but the SOCRATES Builder asked abdominal questions: sites RUQ … Chest, "What is it like?",
"Does it spread?". *"SOCRATES mismatch with cough symptoms — make it work for each SOCRATES [option
set] and match it to the symptoms described in each system, and [find the] errors."*

**Cause.** Neither platform had a notion of *what kind of symptom* the complaint is.

- iOS `socrateDimensions(for:)` (`ConsultationViewSOCRATES.swift`, now deleted) matched the complaint
  against 9 word lists (neck, breast, chest pain, groin, dysphagia, anorectal, skin, urology) and fell
  through to **abdominal SOCRATES** for everything else, cough included. Every complaint, lump or
  bleeding included, was asked the ten SOCRATES questions.
- Web `getMatrixByName()` took the first CC template whose **first word** appeared in the complaint
  ("Abdominal pain" → *Abdominal mass*; "Neck pain" → *Neck lump*; "Breast pain" → *Breast lump*), and
  everything else fell to `other_surgical`, whose prompts are pain SOCRATES with abdominal sites.

**Change.** One shared, deterministic rule set, `lib/triage-engine/src/history-frames/` (TypeScript),
with a generated Swift twin (`ios/AmiseMedFlow/Services/HistoryFrameData.swift`), maps

> chief complaint (+ the iPad's specialty group) → **symptom type** → **history frame**
> (the questions, their chips and what each chip means to the diagnosis engines).

SOCRATES is the frame for **pain only**; the other 20 symptom types have their own history. Version
`HISTORY_FRAMES_VERSION = '1.0.0'`, registered as `history-frames` (P1, unreviewed).

Nothing in the diagnosis engines' content changed: no `DiagnosticDatabase.json` weight, no pane-engine
disease, prior or likelihood. What changed is which questions are asked and which existing engine
feature each answer reaches.

## What the clinician sees

**iOS (History step).** The builder header reads "SOCRATES Builder" for a pain complaint and the
frame's own title otherwise ("Cough history", "Lump / swelling history", "Bleeding history" …). A row
of frame chips under the header (`consult.hpi.frame.<id>`, plus a menu of every frame,
`consult.hpi.frameMenu`) switches the frame in one tap when the classifier is wrong or the clinician
wants another view; the choice is reset when the complaint changes. With two symptoms ("cough and
weight loss") the primary frame is asked in full and the second symptom's key questions follow as
"<symptom> — <question>" rows ("Weight loss — Amount", "Weight loss — Intentional?"). Answers stay in `socratesSelections[key]` under the engine's keys
(onset/site/character/radiation/associations/timing/exacerbating/relieving/severity), so storage,
sync and the engine's reading are unchanged. Chips answered under another frame are kept and shown as
"Also recorded". Pain complaints (RIF, RUQ pain …) show the same SOCRATES rows and the same prose as
before; the walkthrough identifiers (`consult.cc.field`, `consult.hpi.editor`, …) are unchanged.

`EncounterDetailSheet` now shows the stored history (it looked the answers up under capitalised keys
and never found them), and the pre-consult sheet's associated-symptom chips follow the complaint
(they were the abdominal list for every complaint).

**Web (Adaptive HPI card and CC strip).** A complaint that has its own CC template keeps the
template's prompts (Acute abdominal pain, Inguinal hernia, Rectal bleeding …). A template is taken on
a partial name match only when it is the same kind of complaint; otherwise, and for every complaint
without a template, the card asks the history frame. A frame selector (`hpi-frame-select`) switches
the frame, and answers from another frame are shown under "Also recorded" (`hpi-other-answers`). The
CC strip asks the same questions as the card. The HPI narrative adds one sentence per answered frame
question.

## Classifier (`classify.ts`, twin `HistoryFrameClassifier`)

1. Normalise (lower case, punctuation → space). A keyword matches at a word start (`cough*` covers
   coughing), otherwise as a whole word; a rule can list `unless` words.
2. Tier 1 = lump / breast, tier 2 = symptoms (pain, cough, dyspnoea, bleeding, bowel, dysphagia,
   jaundice, vomiting, fever, urinary, neuro, skin, weight loss, fatigue, palpitations, syncope),
   tier 3 = administrative words (review, follow-up …).
3. Primary = the lowest tier, then the earliest keyword in the complaint, then rule order. So
   "painful lump in the groin" is a hernia-lump history, "cough and chest pain" a cough history.
4. Variant (region / site): the earliest variant keyword; for pain with no region word, the iPad's
   specialty group (Musculoskeletal → joint, Cardiovascular / Respiratory → chest, Neurology → head,
   Dermatology → limb), else abdomen.
5. Secondary = the other matched symptom types, earliest first, one frame per type. Pain counts as a
   secondary symptom only with a region of its own ("vomiting and abdominal pain"); in "wound pain"
   or "painful lump" the pain belongs to the primary symptom.
6. No match → the general frame ("History of presenting complaint": onset, duration, course,
   severity, triggers, relievers, associated symptoms).

452 complaint → frame vectors (every iOS CC chip with its specialty group, every EncounterQuestionnaire
complaint, every web CC template and SmartSymptomPicker symptom, plus hand-written permutations) live in
`ios/AmiseMedFlowTests/Resources/HistoryFrameVectors.json` and run on both platforms.

## Frames (41 frames, 21 types)

Chip text and engine values are in `lib/triage-engine/src/history-frames/frames.ts`. "Record only" =
recorded in the history and the HPI text but feeding no diagnosis-engine feature on that platform
(`record-only.ts`, generated from the mapping audit).

| Frame | Heading | Questions (chips) | Record only iOS / web |
|---|---|---|---|
| `pain.abdomen` | SOCRATES | Onset (9) · Site (12) · Character (11) · Radiation (7) · Associations (18) · Pattern (3) · Timing (3) · Exacerbating (9) · Relieving (10) · Severity (4) | 22 / 22 of 86 |
| `pain.chest` | SOCRATES | Onset (9) · Site (8) · Character (8) · Radiation (8) · Associations (10) · Pattern (3) · Timing (3) · Exacerbating (9) · Relieving (7) · Severity (4) | 19 / 20 of 69 |
| `pain.head` | SOCRATES | Onset (10) · Site (8) · Character (6) · Radiation (4) · Associations (13) · Pattern (3) · Timing (4) · Exacerbating (7) · Relieving (5) · Severity (4) | 20 / 31 of 64 |
| `pain.neck` | SOCRATES | Onset (9) · Site (8) · Character (5) · Radiation (6) · Associations (9) · Pattern (3) · Timing (2) · Exacerbating (3) · Relieving (3) · Severity (4) | 28 / 19 of 52 |
| `pain.back` | SOCRATES | Onset (9) · Site (6) · Character (7) · Radiation (7) · Associations (7) · Pattern (3) · Timing (3) · Exacerbating (6) · Relieving (6) · Severity (4) | 19 / 21 of 58 |
| `pain.limb` | SOCRATES | Onset (9) · Site (9) · Character (6) · Radiation (3) · Associations (11) · Pattern (3) · Timing (2) · Exacerbating (6) · Relieving (5) · Severity (4) | 27 / 23 of 58 |
| `pain.breast` | SOCRATES | Onset (9) · Site (12) · Character (5) · Radiation (3) · Associations (6) · Pattern (3) · Timing (3) · Exacerbating (3) · Relieving (3) · Severity (4) | 31 / 23 of 51 |
| `pain.perineal` | SOCRATES | Onset (9) · Site (9) · Character (5) · Radiation (3) · Associations (10) · Pattern (3) · Timing (2) · Exacerbating (4) · Relieving (4) · Severity (4) | 19 / 22 of 53 |
| `pain.joint` | SOCRATES | Onset (9) · Site (9) · Character (5) · Radiation (3) · Associations (10) · Pattern (3) · Timing (5) · Exacerbating (4) · Relieving (5) · Severity (4) | 28 / 29 of 57 |
| `pain.genital` | SOCRATES | Onset (9) · Site (6) · Character (5) · Radiation (4) · Associations (7) · Pattern (3) · Timing (2) · Exacerbating (3) · Relieving (4) · Severity (4) | 21 / 20 of 47 |
| `cough` | Cough history | Duration (3) · Character (2) · Sputum (6) · Haemoptysis (3) · Timing (4) · Triggers (5) · Relieving (5) · Medicines and exposures (5) · Associated symptoms (10) | 5 / 15 of 43 |
| `dyspnoea` | Breathlessness history | Onset (4) · Exercise tolerance (6) · Orthopnoea / PND (3) · Pattern (3) · Associated symptoms (13) · Triggers (4) · Relieving (4) · Risk factors (4) | 5 / 11 of 41 |
| `lump.neck` | Lump / swelling history | Site (14) · Duration (5) · Size change (5) · Consistency (11) · Tenderness (3) · Movement (2) · Other nodes (3) · Overlying skin (6) · Associated symptoms (10) · Systemic symptoms (5) | 18 / 12 of 64 |
| `lump.hernia` | Lump / swelling history | Site (12) · Duration (5) · Size change (5) · Consistency (11) · Tenderness (3) · Reducibility (5) · Overlying skin (6) · Associated symptoms (7) · Systemic symptoms (5) | 18 / 13 of 59 |
| `lump.scrotal` | Lump / swelling history | Site (8) · Duration (5) · Size change (5) · Consistency (11) · Tenderness (3) · Transillumination (6) · Overlying skin (6) · Associated symptoms (6) · Systemic symptoms (5) | 20 / 16 of 55 |
| `lump.abdominal` | Lump / swelling history | Site (9) · Duration (5) · Size change (5) · Consistency (11) · Tenderness (3) · Overlying skin (6) · Associated symptoms (7) · Systemic symptoms (5) | 12 / 12 of 51 |
| `lump.soft_tissue` | Lump / swelling history | Site (16) · Duration (5) · Size change (5) · Consistency (11) · Tenderness (3) · Depth (3) · Overlying skin (6) · Associated symptoms (4) · Systemic symptoms (5) | 23 / 14 of 58 |
| `lump.limb_swelling` | Limb swelling history | Site (7) · Onset (3) · Character (5) · Associated symptoms (8) · Risk factors (5) | 8 / 5 of 28 |
| `breast` | Breast history | Site (12) · Duration (5) · Lump (12) · Size change (4) · Nipple discharge (7) · Skin and nipple (7) · Associated symptoms (8) · Risk factors (5) | 22 / 8 of 60 |
| `bleeding.rectal` | Bleeding history | Colour (4) · Relation to stool (4) · Volume (4) · Duration (5) · Associated symptoms (9) · Anticoagulants (3) · Risk factors (3) | 14 / 4 of 32 |
| `bleeding.upper_gi` | Bleeding history | Presentation (3) · Onset (3) · Volume (4) · Associated symptoms (7) · Anticoagulants (3) · Risk factors (4) | 1 / 4 of 24 |
| `bleeding.urinary` | Bleeding history | Haematuria (2) · Timing in the stream (3) · Pain (3) · Associated symptoms (6) · Anticoagulants (3) · Risk factors (3) | 4 / 3 of 20 |
| `bleeding.vaginal` | Bleeding history | Pattern (5) · Volume (4) · Associated symptoms (5) · Anticoagulants (3) | 3 / 1 of 17 |
| `bleeding.general` | Bleeding history | Site (8) · Volume (4) · Associated symptoms (5) · Anticoagulants (3) · Risk factors (2) | 8 / 5 of 22 |
| `bowel` | Bowel habit history | Change (4) · Duration (3) · Stool (6) · Frequency (3) · Associated symptoms (9) · Context (6) | 7 / 3 of 31 |
| `dysphagia` | Dysphagia history | Solids or liquids (4) · Course (3) · Level (6) · Duration (3) · Associated symptoms (10) · Relieving (4) | 12 / 3 of 30 |
| `jaundice` | Jaundice history | Pain (4) · Duration (5) · Urine and stools (3) · Associated symptoms (8) · History (7) | 3 / 3 of 27 |
| `vomiting` | Vomiting history | Content (6) · Pattern (6) · Onset (9) · Frequency (4) · Associated symptoms (10) · Context (6) | 16 / 2 of 41 |
| `fever` | Fever history | Duration (3) · Pattern (4) · Highest temperature (4) · Source (11) · Exposure (7) | 8 / 7 of 29 |
| `urinary` | Urinary history | Storage symptoms (4) · Voiding symptoms (6) · Dysuria and pain (3) · Retention (2) · Duration (5) · Associated symptoms (6) | 3 / 1 of 26 |
| `neuro.weakness` | Weakness history | Distribution (5) · Onset (3) · Course (4) · Associated symptoms (10) | 6 / 3 of 22 |
| `neuro.numbness` | Numbness history | Distribution (6) · Onset (3) · Associated symptoms (6) · Risk factors (4) | 3 / 2 of 19 |
| `neuro.dizziness` | Dizziness history | Type (3) · Episode length (3) · Triggers (4) · Associated symptoms (10) | 2 / 0 of 20 |
| `skin.lesion` | Skin lesion history | Site (13) · Duration (5) · Change (ABCDE) (5) · Appearance (9) · Risk factors (5) · Associated (3) | 25 / 6 of 40 |
| `skin.wound` | Wound history | Site (17) · Onset (5) · Appearance (10) · Pain (3) · Systemic (3) · Risk factors (5) | 20 / 4 of 43 |
| `skin.rash` | Rash history | Distribution (8) · Onset (9) · Appearance (6) · Associated symptoms (7) | 17 / 2 of 30 |
| `weight_loss` | Weight loss history | Amount (4) · Duration (4) · Intentional? (2) · Appetite (3) · Associated symptoms (10) | 12 / 3 of 23 |
| `fatigue` | Fatigue history | Duration (3) · Pattern (4) · Associated symptoms (10) | 3 / 2 of 17 |
| `palpitations` | Palpitations history | Onset and offset (2) · Rhythm (3) · Episode length (4) · Triggers (5) · Termination (3) · Associated symptoms (7) | 9 / 0 of 24 |
| `syncope` | Syncope history | Setting (8) · Warning (2) · During the event (5) · Recovery (2) · Associated symptoms (4) · Risk factors (3) | 9 / 1 of 24 |
| `general` | History of presenting complaint | Onset (9) · Duration (5) · Course (4) · Severity (3) · Triggers (5) · Relievers (3) · Associated symptoms (6) | 11 / 13 of 35 |

Region-specific content, in brief:

- **Pain sites** by region: abdomen (9 regions + loin, flank, groin, diffuse); chest (central,
  retrosternal, left / right, pleuritic side, interscapular); head; neck (anterior / posterior
  triangle, midline, sided); back; limb; breast (four quadrants per side, central / areola, axilla);
  perineal / anal (perianal, anal canal, rectum, midline and lateral positions); joint; genital.
  Characters follow the region (e.g. crushing, tightness and pleuritic for the chest; throbbing and
  band-like, with a thunderclap onset, for the head).
- **Cough** (BTS 2006 / ERS 2020): duration bands acute under 3 weeks, subacute 3–8 weeks, chronic over
  8 weeks; dry / productive; sputum colour and volume; haemoptysis (streaks, frank blood, large volume);
  nocturnal, morning, after meals, lying flat; triggers; ACE inhibitor started / stopped, smoking,
  occupational and TB / travel exposure; associated fever, breathlessness, wheeze, weight loss, night
  sweats, reflux, post-nasal drip, hoarseness, chest pain.
- **Dyspnoea**: onset; exercise tolerance as MRC grades 1–5 and at rest; orthopnoea, PND, pillows;
  associated wheeze, chest pain, palpitations, ankle / calf swelling, cough, haemoptysis; risk factors.
- **Lump / swelling**: site by region, duration, size change, consistency, tenderness, and the
  region's own signs: movement on swallowing / tongue protrusion (neck), cough impulse and
  reducibility (hernia), transillumination and "can get above" (scrotum), depth (soft tissue). No
  radiation question.
- **Bleeding** by site: rectal (colour, on the paper / mixed / separate, volume), upper GI
  (haematemesis, coffee grounds, melaena), urinary (visible / non-visible, timing in the stream,
  painless / painful, clots), vaginal, general; anticoagulants recorded (no instruction).

## Engine mapping

Every chip either reaches an existing engine feature on that platform or is listed as record only.
The audit (`scripts/src/history-frames-audit.ts`) replays each chip through each engine:

- **iOS**: a simulator of `BayesianDiagnosisEngine.score()` (standard keys by substring, `finding`
  features over the finding text with alternatives / terms / word-start / negation, `associated`
  word match, synonym keys, default key groups) against every feature in `DiagnosticDatabase.json`.
  Chip values that did not reach the intended feature were given an explicit engine value (the chip
  label stays): e.g. cough "Chronic — over 8 weeks" stores `>3 weeks — chronic over 8 weeks` under
  `timing`; "Started after an ACE inhibitor" stores `After starting ACEi` under `timing`; MRC grades
  store `Exertion — MRC n …` under `exacerbating`; "Lying flat" (cough) stores `Worse lying flat`.
- **Web**: `extractFeaturesFromSocrates()` in three contexts (the frame's sample complaint, a neutral
  complaint, and with other answers) against the PANE feature list. New `FRAME_KEY_RULES` in
  `socrates-to-features.ts` map every frame answer key to existing features (`productive_cough`,
  `purulent_sputum`, `haemoptysis`, `acei_arb_use`, `smoker`, `orthopnoea`, `exertional_symptoms`,
  `cough_impulse`, `groin_lump_reducible`, `testicular_mass`, `deep_lump` …). Pane-engine model
  version 1.0.1 → **1.0.2** (mapper only).

| | Chips | Engine-mapped | Record only |
|---|---|---|---|
| iOS (`DiagnosticDatabase.json` 2.x features) | 1,650 | 1,089 | 561 |
| Web (PANE features) | 1,650 | 1,242 | 408 |

Record-only chips are mostly durations with no engine feature ("Today", "Over a year"), severity
bands, "Nothing", sided sites the engines do not distinguish (iOS breast quadrants), and history items
an engine does not model: e.g. on iOS the rectal-bleeding relation to stool ("On the paper", "Mixed
with stool") and "Occupational dust or asbestos"; on the web "TB contact", "Recent travel", "Family
history of breast cancer", "BRCA carrier". They are still recorded and written into the HPI text.
`lint:history-frames` fails when a chip changes status without the table being regenerated.

**Stored answers.** Renamed chips keep an alias (`aliases` in `frames.ts`, `HistoryAliasSpec` in
Swift): a stored old label still shows as selected under its new name (e.g. "Worse over time" →
"Progressive"; chest "Pressure" → "Crushing / pressure"; "GTN spray" → "GTN / nitrates"; web "Upper
outer (right)" → "Upper outer — right"). A retired label (e.g. abdominal site "Chest") is kept and
shown under "Also recorded". No migration.

## Audit findings: before → after

Counted over the 398 distinct complaints in the corpus (iOS CC chips, EncounterQuestionnaire, web CC
templates, SmartSymptomPicker symptoms); "before" replays the old iOS switch and the old web
first-word match (scratch replay of the code at `42408c7`).

| Finding | Before | After |
|---|---|---|
| iOS: complaints that are not pain but were asked SOCRATES ("What is it like?", "Does it spread?") | 327 | 0 (radiation only in pain frames; lint) |
| iOS: complaints that are not abdominal but got the abdominal default (sites RUQ … Chest, abdominal radiation and associations) — incl. cough 5, dyspnoea 9, skin 36, bleeding 13, jaundice 10, lump 10, other pain 37, general 121 | 312 | 0 |
| iOS: stored history not shown in the encounter detail sheet (capitalised key lookup) | every encounter | shown |
| iOS: pre-consult associated-symptom chips abdominal for every complaint | every complaint | per frame |
| iOS: "Constant" and "Intermittent" both selectable under one multi-select timing question | yes | one single-choice Pattern question |
| Web: partial first-word template match of a different kind of complaint (Abdominal pain → Abdominal mass; Neck pain → Neck lump; Breast pain → Breast lump; Rectal pain → Rectal bleeding; Right upper quadrant pain → Upper GI bleed; Vision changes → Change in bowel habit …) | 24 | 0 (same frame required) |
| Web: complaints without a template that got pain SOCRATES with abdominal sites (`other_surgical`) | 303 (256 not pain) | 0 (frame questions) |
| Web: "Coughing" as an aggravating factor set the `cough` feature | yes | no |
| Web: pain-only features (episodic, nocturnal, post-prandial, colicky pain …) set from non-pain answers | yes | no |
| Web: sided chips merged on save ("Right (x)" and "Left (x)" both stored as "x") | yes | sided labels, no parentheticals |

Checks that `lint:history-frames` now runs on every frame (all pass): radiation only in pain frames;
sites belong to the frame's region (no abdominal site outside `pain.abdomen` / `lump.abdominal`); no
duplicate chip within a question, and no two chips that save the same web text; excluded pairs
(e.g. "Nothing" with anything, Mobile / Fixed, Tender / Non-tender, Reducible / Irreducible) cannot
both be selected; a secondary question's key does not collide with the primary frame's; every chip
mapped or record only; vectors, Swift twin and vignette chip values current. While building, the audit
caught and fixed: breast "Right upper outer" firing the iOS right-upper-quadrant findings (renamed
"Upper outer — right"); "Rectal pain" landing on the rectal-prolapse template; "wound pain" taking an
abdominal pain secondary; short iOS finding terms matching inside words (reported below).

## Checks

- `pnpm run typecheck`, `pnpm -r run test`, dashboard build: pass.
- `lint:history-frames`, `lint:guideline-registry`, `lint:signoff-catalogue` and the other scripts
  lints: pass.
- `e2e/emr-walkthrough.mjs` and the second web e2e script: pass.
- `clinval:web`: 0 blocking; no expectation went pass → fail against the pre-change baseline.

### New vignettes (`hpi-frame-*`, web run, iOS `unverified`)

Chips are the frame's chips (iOS values from `HistoryFrameData.swift`, web answers under the frame's
web keys): chronic cough on an ACE inhibitor; cough with haemoptysis and weight loss in a smoker;
exertional dyspnoea with orthopnoea; inguinal lump with a cough impulse; painless jaundice; progressive
solid-food dysphagia; bright red rectal bleeding on the paper; mobile breast lump. Web passes except two
`knownGap: ["web"]` quality expectations: pane-engine models no ACE-inhibitor cough (or other
chronic-cough cause) and no lung cancer.

## Findings (not changed here)

1. **iOS finding matching of short terms**: `DiagnosticDatabase.json` features with 3-letter finding
   terms (e.g. `sti`) match inside words ("still", "stiffness") in the engine's word-start rule. Content
   of the database; not changed. The audit lists them (`spuriousFindingHits`).
2. **iOS chip text feeds the finding text regardless of the question**: a "Coughing" chip under
   Exacerbating reaches cough findings. Engine behaviour; not changed.
3. **iOS early-form chips** whose `dimId` is exam / pmh / pshx / social / inv are stored in
   `socratesSelections` and never reach the exam, PMH or social features. Reported.
4. **ClinicalTextParser** maps a typed "cough" to exacerbating "Coughing". Reported.
5. **EncounterQuestionnaire** (patient-facing) treats hernia as a pain type and asks pain questions.
   Patient-facing text; not changed here.
6. **iOS exam chips** (`primaryExamChips`, `primaryExamLabel`) still default to the abdominal
   examination for any complaint they do not recognise, cough included. Examination, not history;
   follow-up.
7. **Web lump templates** list sites that PANE reads as pain features (e.g. a lump "RIF" site). Noted.

## Needs sign-off

Nothing here has had a clinical review; `lastReviewed` stays `unknown`.

1. **The frame list and the question set per frame** (table above; chip text in `frames.ts`),
   including that SOCRATES is used for pain only and that a lump is never asked about radiation.
2. **Classifier precedence**: lump / breast before symptoms before administrative words; then the
   earliest keyword. E.g. "painful lump" → lump history, "cough and chest pain" → cough history with
   chest pain as a secondary symptom, "Reflux / Heartburn" → chest pain SOCRATES, "Rectal prolapse" →
   bowel habit history, "Leg swelling" → limb swelling history.
3. **Pain region defaults by specialty group** when the complaint names no region (Musculoskeletal →
   joint, Cardiovascular / Respiratory → chest, Neurology → head, Dermatology → limb, otherwise
   abdomen).
4. **Cough duration bands** (under 3 weeks, 3–8 weeks, over 8 weeks; BTS 2006 / ERS 2020) and the
   choice to store subacute and chronic under the engine's existing `>3 weeks` value.
5. **MRC dyspnoea grades 1–5** wording and their mapping to exertional breathlessness.
6. **Engine values given to renamed chips** (e.g. "Started after an ACE inhibitor" → `After starting
   ACEi`; "Lying flat" (cough) → `Worse lying flat`; "Post-nasal drip" → `Post-nasal drip sensation`)
   and the web `FRAME_KEY_RULES` feature mapping (pane model 1.0.2).
7. **Record-only chips** (561 iOS, 408 web): accept that these are recorded without an engine feature,
   or name the ones that need a feature (which would be new engine content, not this change).
8. **Anticoagulant questions** in the bleeding frames record use only; no instruction is given.
9. **Pane-engine gaps** shown by the new vignettes: no ACE-inhibitor cough / chronic-cough module and
   no lung cancer node on the web.

## Files

- Shared: `lib/triage-engine/src/history-frames/{types,frames,classify,index,record-only}.ts`
  (`@workspace/triage-engine/history-frames`).
- iOS: `Services/HistoryFrames.swift`, `Services/HistoryFrameData.swift` (generated),
  `Views/Consultation/ConsultationView+HistoryFrame.swift`; `ConsultationView+HPITab.swift`,
  `ConsultationView.swift`, `ConsultationView+CCTab.swift`, `EncounterDetailSheet.swift`,
  `PreConsultEntrySheet.swift`; `ConsultationViewSOCRATES.swift` removed. Tests
  `AmiseMedFlowTests/HistoryFrameTests.swift` + `Resources/HistoryFrameVectors.json`.
- Web: `lib/hpi-fields.ts` (new), `lib/socrates-to-features.ts`, `lib/cc-matrices.ts`,
  `pages/tabs/HpiTab.tsx`, `components/ChiefComplaintStrip.tsx`; test `hpi-fields.test.ts`.
- Scripts: `history-frames-{corpus,audit,generate}.ts`, `gen-history-frames.ts`,
  `lint-history-frames.ts`, `history-frames.test.ts`; `pnpm --filter @workspace/scripts run
  gen:history-frames` (Swift twin; `-- --record-only` for the table) and `lint:history-frames`.
- Clinical validation: 8 `hpi-frame-*` vignettes; `vignette.schema.json` and README note the frame keys.

## Not done / follow-ups

- The iOS exam chips (finding 6) and the patient-facing questionnaire (finding 5).
- Swift is not compiled in this environment: the iOS build and `HistoryFrameTests` run in
  `ios-build-check.yml`; the vignettes are `unverified: ["ios"]` until run there.
