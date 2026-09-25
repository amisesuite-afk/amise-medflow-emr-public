---
name: ios-arch
description: >
  Load this skill at the start of every iOS session and whenever building,
  modifying, or debugging any Swift/SwiftUI code in this project. Trigger on
  any mention of: SwiftUI, SwiftData, iOS, iPhone, iPad, ward round, patient
  view, sync, NAS, Bayesian, SOAP, ward, vitals, prescription, billing, triage,
  settings, navigation, or any .swift file. Also trigger on "continue" if the
  previous context was iOS work. This skill is the single orientation document
  that replaces having to re-read half the codebase after a context compaction.
---

# AmiseMedFlow iOS — Architecture Reference

Surgeon-directed EMR. SwiftUI + SwiftData. Offline-first. No internet required
for core clinical work. AI features are **disabled** pending HIPAA BAA.

## Repo location

```
/home/user/amise-medflow-emr-public/ios/   ← iOS git root  (ALWAYS cd here first)
└── AmiseMedFlow/
    ├── AmiseMedFlowApp.swift              ← entry point, service injection
    ├── Design/DesignTokens.swift          ← AMColor, .amCard(), .amSectionLabel()
    ├── Models/                            ← SwiftData @Model classes
    ├── Services/                          ← business logic, sync, AI
    ├── Views/                             ← SwiftUI screens
    └── Resources/DiagnosticDatabase.json ← Bayesian pool/candidate/feature DB
```

Git remote: `origin` = `https://github.com/amisesuite-afk/amise-medflow-emr-public`
Active branch: `claude/pr-37-gbg22z`
XcodeGen (`project.yml`): `sources: [path: AmiseMedFlow]` — all `.swift` files
auto-included; **no manual Xcode registration needed** for new files.

## Service injection (AmiseMedFlowApp.swift)

All services are `ObservableObject`, created as `@StateObject`, injected via
`.environmentObject()` at root so every descendant view can `@EnvironmentObject`
them:

```swift
@StateObject private var sync          = SyncService()
@StateObject private var peerSync      = PeerSyncService()
@StateObject private var nasBackup     = NASBackupService()
@StateObject private var bioAuth       = BiometricAuthService()
@StateObject private var calendarService = CalendarService()
@StateObject private var notifications = NotificationService()

ContentView()
    .environmentObject(sync)
    .environmentObject(peerSync)
    .environmentObject(nasBackup)
    .environmentObject(calendarService)
    .environmentObject(notifications)
    .tint(AMColor.accent)
```

When adding a new service: `@StateObject` in `AmiseMedFlowApp`, `.environmentObject`
on `ContentView`, `@EnvironmentObject` in every view that needs it.

## Three sync tiers

| Tier | Service | Transport | When |
|---|---|---|---|
| 1 — Cloud | `SyncService.swift` | Supabase REST + Realtime | WiFi / cellular |
| 2 — LAN | `PeerSyncService.swift` | MultipeerConnectivity (BT+WiFi) | Same room |
| 3 — NAS | `NASBackupService.swift` | WebDAV PUT/MKCOL | On demand / scheduled |

**SyncService**: NWPathMonitor, syncs every 30s on WiFi, pauses on cellular.
Pull/push for patients, notes, prescriptions, vitals. `syncIfAuthenticated()` on
every foreground resume. A patient column added by a not-yet-applied migration must not break
the pull or push: select it with a fallback to the old column list and push it in its own
request (see `SyncService+NEWS2Scale2.swift`, `patients.news2_spo2_scale2`, Migration 88).
Pull protection: `sync()` pulls patients BEFORE pushing them, so a pull must never write over a
record with `pendingSync == true` (it would revert an offline edit before it is pushed). Patients
go through `PatientPullMerge.applyServerPatientRow` (only `remoteId`, an MRN the local copy lacks,
and the Scale 2 flag apply to a pending patient); notes and operative plans skip pending rows;
prescriptions/vitals/billing pulls update an existing non-pending row (by remoteId) when the
server's values differ, and for prescriptions only when `updated_at` is newer than the local
`updatedAt` (`ChildPullMerge`, `SyncService+ChildPullMerge.swift`; `patient_vitals` and
`patient_billing_items` have no `updated_at`); the documents pull only inserts. A push clears
`pendingSync` only when the server returns the written row (`.select("id")`) and `updatedAt` did
not change during the request (`SyncPushConfirmation`). An UPDATE that RLS filters out returns no
rows and no error: every update push calls `markRefusedIfUpdateNotApplied`, which selects the row
by id and marks the record refused when it is still there (`SyncZeroRowUpdate`; a row that is gone
stays pending, not refused). Tests: `AmiseMedFlowTests/PullProtectionTests.swift`,
`SyncCompletenessTests.swift`.
Prescription `route`: the applied schema (Migration 32) has a lowercase CHECK ('oral', 'iv', …,
'other'); pushes send `PrescriptionRoute.serverValue` (unmappable or mixed routes → "other"),
pulls show `display(fromServer:)`, and local labels ("Oral", "PO/IV") are kept (`sameRoute`).
Remote ids (`Services/SyncRemoteIds.swift`): a patient created from a confirmed booking carries
the placeholder `"appt:<appointment id>"`, which is not a row id. Every push sends a remoteId only
through `SyncRemoteId.serverId(_:)` (UUID guard, row ids and `patient_id`); never compare with
`hasPrefix("appt:")` by hand. `pushPendingPatients` gives a placeholder patient a real row once it
has local work (its own edits or a pending child record): the booking's `patient_id`, else an
MRN + name match, else an insert; `adoptServerId` replaces the placeholder and
`AppointmentLinks` stops the appointment pull re-creating it.
Notes, operative plans, prescriptions, vitals and billing items push an UPDATE when they have a
server id and an INSERT otherwise; a tombstoned row is never updated. Prescription, VitalsEntry
and BillingLineItem have `updatedAt` (optional) and `markEdited()`: call it on every edit of an
existing record (BillingView's inline editor does). Payloads: `PrescriptionUpdateRow`,
`VitalsUpdateRow` (cleared readings sent as null), `BillingItemUpdateRow`.
Peer apply (`PeerApplyPending`): never clears `pendingSync`; a peer's unsent change (payload
`pendingSync`) that changed the record here becomes pending here too, only when the record has a
server row (idempotent update; inserts stay with the origin device). Child records already here
take the peer's server id by syncCode. Tests: `AmiseMedFlowTests/SyncGapsTests.swift`.
Resilience: `sync()` runs each step through `runSyncStep` (a failure sets `syncError`, later
steps still run) and every push loop handles errors per record via `continueAfterPushFailure`
(`SyncService+Refusals.swift`). A `42501` marks the record in `SyncRefusals` (kept locally, still
pending, skipped until the next sign-in/launch; `syncNotice` shows "N changes not permitted for
your role"); a transport error stops that loop. New push loops must follow the same pattern.
Front desk (role confirmed via `isRoleConfirmed`) sends only `FrontDeskPatientColumns` in the
patient UPDATE (`PatientUpdateRow`), mirroring Migration 89's column guard. Tests:
`AmiseMedFlowTests/FrontDeskSyncTests.swift`.

**PeerSyncService**: MCSession, service type `"amise-medflow"`, matches peers by
SHA-256 of email. Manifest-based: syncCode → stamp, `max(updatedAt, syncedAt)`
(`PeerVersion`, `PeerSyncService+Versions.swift`), so records created or edited offline are sent;
the old syncCode → syncedAt maps stay for older builds, and payloads carry an optional
`updatedAt`. Longer text wins for clinical narrative, the newer copy wins for admin fields and
child records (an unsent local edit loses only to a later edit), notes follow `mergeDoc` and a
signed note is never reopened. After an apply the receiver's `syncedAt` adopts the peer's stamp
(not sent again), or ends above it when its merged copy differs and must go back
(`PeerVersion.sendsBack`, `PeerFingerprint`). Patients deleted here are listed with a far-future
stamp. Tests: `SyncCompletenessTests.swift`, `SyncMergeTests.swift`.

**NASBackupService**: WebDAV to Synology DSM (`amise-storage`, Tailscale IP
`100.119.29.97`). DSM port 5005 HTTP / 5006 HTTPS. Credentials in Keychain via
`KCHelper`; URL in `UserDefaults`. Creates `medflow-backups/<timestamp>/` with
`patients.json`, `notes.json`, `prescriptions.json`, `vitals.json`,
`manifest.json`. Works over Tailscale transparently.

**Tailnet** (console.tailscale.com):
- `amise-storage` (NAS, Linux) → `100.119.29.97`
- `dawits-macbook-air` (macOS) → `100.68.58.15`
- `iphone-15-pro-max` (iOS 26) → `100.67.140.47`

## SwiftData schema

```swift
Schema([Patient, ClinicalNote, VitalsEntry, Prescription, PatientDocument,
        OperativePlan, BillingLineItem, Encounter, ScoreHistoryEntry])
```

Every `@Model` has: `id: UUID`, `syncCode: String` (stable offline peer-sync ID,
set in `init()`), `remoteId: String?` (Supabase row ID), `pendingSync: Bool`,
`syncedAt: Date?`, `updatedAt: Date`.

**Patient** key fields: `fullName`, `dateOfBirth`, `sex: Sex`, `mrn: String?`,
`setting: ClinicalSetting` (.inpatient/.outpatient/.emergency), `location:
ClinicalLocation`, `acuity: Acuity` (.routine/.priority/.urgent/.emergency),
`chiefComplaint`, `workingDiagnosis`, `workingDiagnosisICD`, `managementPlan`,
`hpi`, `assessmentText`, `pmhNotes`, `ward`, `bedNumber`, `admittedAt`.
Relationships (cascade delete): `clinicalNotes`, `vitalsEntries`,
`prescriptions`, `documents`, `operativePlans`, `billingItems`, `encounters`,
`scoreHistory`.

**ClinicalNote** key fields: `noteType: NoteType` (.soap/.progress/.operative/
.endoscopy/.discharge/.consultation/.referralLetter/.clinicalSummary/.other),
`status: NoteStatus` (.draft/.signed), `subjective`, `objective`, `assessment`,
`plan` (SOAP fields), `freeText` (for non-SOAP notes).

**VitalsEntry** key fields: `recordedAt`, `bpSystolic: Int?`, `bpDiastolic:
Int?`, `heartRate: Int?`, `respiratoryRate: Int?`, `temperatureCelsius:
Double?`, `spo2: Int?`, `weightKg: Double?`, `glucoseMmol: Double?`,
`avpu: AVPU`, `onSupplementalO2: Bool`. Computed: `news2Score`, `news2Risk`,
`news2HasRedFlag`, `bpString`, `hasAnyValue`.

**Prescription** key fields: `drug`, `dose`, `route`, `frequency`, `duration`,
`indication`, `prescribedAt`. Computed: `displayLine`.

## Design tokens (DesignTokens.swift)

```swift
AMColor.accent    = Color(hex: "00b4a0")   // Caribbean turquoise — primary CTA
AMColor.accentDk  = Color(hex: "008f7e")
AMColor.accentLt  = Color(hex: "d6f5f1")
AMColor.bg        = adaptive(light: "f0f7f6", dark: "0c1917")
AMColor.card      = adaptive(light: .white,   dark: "122120")
AMColor.line      = adaptive(light: "cde7e3", dark: "1a3430")
AMColor.ink       = adaptive(light: "122320", dark: "c8e8e4")
AMColor.muted     = Color(hex: "4e6660")
// Acuity
AMColor.emergency = Color(hex: "b91c1c")
AMColor.urgentCol = Color(hex: "b91c1c")   // same as emergency
AMColor.priorityCol = Color(hex: "a16207")
AMColor.routineCol  = Color(hex: "00b4a0") // same as accent
```

View extensions: `.amCard()` (card background + border + shadow),
`Text.amSectionLabel()` (11px heavy uppercase teal).

## Key services — what they do

| Service | Role |
|---|---|
| `SOAPDraftEngine` | Deterministic SOAP pre-fill. No network. Safe always. `SOAPDraftEngine.draft(patient:) -> SOAPDraft` with `.s/.o/.a/.p: String` |
| `AIService` | **ALL methods throw `AIError.disabled`** — HIPAA BAA not in place. `clinicalContext(_ patient:) -> String` is the only working method (pure, local). Do NOT re-enable without BAA. |
| `BayesianDecisionEngine` | Differential diagnosis from `DiagnosticDatabase.json`. 40 pools, 193 candidates, 1461 features. |
| `ClinicalScoringEngine` | NEWS2, Alvarado, Glasgow Pancreatitis, Ranson, Tokyo, Rockall, Blatchford, Wells DVT/PE, ABCD², LRINEC, qSOFA |
| `BiometricAuthService` | Face ID / Touch ID app lock. `@StateObject bioAuth`, screen blurred when `bioAuth.isLocked` |
| `MRNGenerator` | Auto-generates MRN on patient creation |
| `SyncStatusBar` | Toolbar widget: cloud + antenna + drive icons → popover with all three tier statuses |

## Ward round flow

`WardRoundView` → tap patient → `WardRoundProgressSheet` (lightweight, SOAP
pre-filled by `SOAPDraftEngine`, one-tap sign) → escape hatch: "Open Full
Record" → `PatientDetailView`.

Swipe actions: leading = Mark Reviewed (green), trailing = Discharge (teal) /
Escalate (orange). Discharge flow: confirmation dialog → `DischargeFlowSheet`
(pre-filled summary) or direct discharge.

## Consultation pathways ("first door")

`ConsultationView` opens on a visit pathway, which orders its steps (tab bar, Back/Next footer;
other tabs under "More"):

| Piece | File |
|---|---|
| `ConsultPathway` (7 pathways, `steps`, `recommend(for:)`, `from(VisitType)`) | `Services/ConsultPathway.swift` |
| `VisitRiskAssessment` (risk snapshot flags) | `Services/VisitRiskAssessment.swift` |
| First-door sheet, pathway cards, `RiskSnapshotCard` | `Views/Consultation/VisitPathwayPicker.swift` |
| Step bar, footer, `tabFilled`, `pathwayProgress`, tab dispatch | `Views/Consultation/ConsultationView+TabBarDispatch.swift` |
| Burns / Wellness / Ward review steps | `BurnsAssessmentView`, `WellnessScreeningView`, `WardReviewPanel` |
| Stored data (`Patient.pathwayDataJson` → `PathwayData`) + `ScreeningEngine` | `Views/Consultation/PathwayData.swift` |

- The first door auto-opens only when the encounter starts (status waiting/not checked in).
  Choosing a pathway sets `patient.visitType` (keeps a more specific type, e.g. ERCP).
- New `ConsultTab` cases need a `tabFilled` and a `tabContent` branch (both exhaustive switches).
- `VisitType` raw values are persisted (SwiftData + Supabase `visit_type`): append cases, never
  rename. `ClinicalPipelineOrchestrator.filteredAutoActions` switches exhaustively on it.
- Codable form data stored as JSON must decode missing keys to defaults (see `PathwayData`)
  and must decode dates with the same strategy it encodes (`.iso8601`). A mismatch makes the
  whole form read back blank. (Trauma and OGD had this bug.)
- `pathwayDataJson` syncs over peer sync (newer wins) and Supabase `patients.pathway_data_json`
  (`SyncService+PathwayData.swift`, own requests that never fail the main sync; unpushed local
  edits win; column added by `supabase-pathway-data-migration.sql`, Migration 86).
- Unit tests: `AmiseMedFlowTests/ConsultPathwayTests.swift` (pathway, risk, burns, screening);
  CI runs them in the "Unit tests (simulator)" job of `ios-build-check.yml`.

## Bowel preparation (colonoscopy / flexible sigmoidoscopy)

- Pure logic: `Services/BowelPrepProtocols.swift` — six regimens (magnesium-based default,
  magnesium citrate, 2 L / 1 L PEG + ascorbate, 4 L PEG split, enema only), split-dose timing
  engine (`BowelPrepScheduler`, explicit time zone), safety suggestions (`BowelPrepSafety`,
  never blocking), per-regimen surgeon sign-off (`BowelPrepSignOff`, UserDefaults, lapses when
  the wording fingerprint changes; refused while patient wording holds `[confirm]`).
- Surgeon's rule: clear fluids until 2 h before; never nil by mouth from midnight.
- UI: `Views/ProcedureForms/BowelPrepView.swift` (reached from ClinicalHubView procedure forms,
  the top of ColonoscopyFormView, and the consultation Plan tab); sign-off in Settings →
  Bowel Prep Protocols. Plan stored in `PathwayData.bowelPrep`. Tests: `BowelPrepTests.swift`.

## Front-desk questionnaire: patient hand-over mode (privacy)

The pre-consultation questionnaire (`AdaptiveQuestionnaireSheet`) is filled in by the patient on
the front-desk iPad, so it must never expose another patient's data:
- Present it only with `.patientHandoverPresentation(isPresented:patient:entryPoint:)`
  (`Views/FrontDesk/PatientHandoverPresentation.swift`): full-screen cover on iPad, sheet with
  interactive dismissal disabled on iPhone. Never `.sheet { AdaptiveQuestionnaireSheet(...) }`.
- Leaving it ("Staff: exit", also on the post-submit thank-you screen) needs
  `BiometricAuthService.verifyDeviceOwner(reason:)` (`.deviceOwnerAuthentication`; cancel = stay).
  Walk-in answers are attached to a record only after staff exit (`WalkInAnswersAttachView`).
- Patient lists for picking the questionnaire patient use `QuestionnairePatientSearch` (nothing
  until 3+ name characters or an MRN, max 5). Tests: `AmiseMedFlowTests/QuestionnairePrivacyTests.swift`.
- No photo library inside the questionnaire (camera only), no staff triage labels (acuity).
- `PreConsultEntrySheet` is staff transcription of a paper form, not patient-facing.

## SwiftData deleted-model crashes

Reading any attribute of a deleted model after save (before `@Query` refreshes) crashes
(Xcode stops in a `@_PersistedProperty` getter). Patient `@Query`s go through
`queriedAllPatients.filter(\.isLive)`, so keep that pattern for new patient lists, and check
`patient.isLive` after any `await` in sync loops.

## Swift/SwiftUI compile error patterns

### `Color.opacity()` ambiguity
`Color` conforms to both `ShapeStyle` and `View`; both define `.opacity()` with
different return types. Triggers "Ambiguous use of 'opacity'" inside `@ViewBuilder`.

```swift
// ❌ Ambiguous:
.background(Color.red.opacity(0.85))
.foregroundStyle(Color.white.opacity(0.9))

// ✅ Fix for background:
.background { Color.red.opacity(0.85) }

// ✅ Fix for foregroundStyle:
.foregroundStyle(.white.opacity(0.9))   // dot-syntax lets compiler infer ShapeStyle

// ✅ Fix with explicit type:
private var bg: Color { Color.red.opacity(0.85) }
// then: .background { bg }
```

A single unresolved ambiguity in a `@ViewBuilder` function cascades to spurious
"Ambiguous use of 'count'" and similar errors on unrelated lines in the same
scope. Look upward for the opacity call.

## Conventions

- New views go in `Views/<Category>/` matching existing structure
- New services go in `Services/` — `ObservableObject`, injected at root
- `@Bindable var patient: Patient` for two-way SwiftData binding in detail sheets
- `.sheet(item: $selectedItem) { item in ... }` pattern for modal detail
- All monetary / clinical content uses British-Caribbean professional tone
- `patient.updatedAt = .now; patient.pendingSync = true` on every local edit
- Never call `AIService` methods — they crash with `AIError.disabled`
- `context.insert(note)` to persist new `ClinicalNote`, no save() call needed
  (SwiftData auto-saves)
