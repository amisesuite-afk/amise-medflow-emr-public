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
every foreground resume.

**PeerSyncService**: MCSession, service type `"amise-medflow"`, matches peers by
SHA-256 of email. Manifest-based (syncCode → syncedAt), longer text wins for
clinical narrative, newer timestamp wins for admin fields.

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
