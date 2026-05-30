# GitHub Copilot Instructions — Amise MedFlow EMR

## Project

Adaptive triage, clinical documentation, and scheduling assistant for **Amise Medical Services** (Saint Lucia) — a general and endoscopic surgery practice led by Dr Dawit Daniel Kabiye MD, DM.

## Timezone

All dates, times, and scheduling logic use **Eastern Caribbean Time — `America/St_Lucia` (UTC-4, no DST)**.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript 5.9, pnpm workspaces |
| Frontend | React 19, Vite, plain CSS (no Tailwind) |
| API server | Express 5 |
| Shared lib | `lib/triage-engine` — used by both frontend and API |
| Auth | Supabase Auth v2, email/password, `user_profiles` table, RLS |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Charts | recharts `^2.15.2` |
| PDF export | jsPDF v4 + html2canvas v1 |
| Calendar | Google Calendar API (service account) |
| Email | Gmail API |
| SMS | Twilio |

## Repo layout

```
artifacts/dashboard/          React/Vite EMR dashboard
  src/
    context/AppContext.tsx     Global state — patient data, vitals, notes, labs
    context/AuthContext.tsx    Supabase auth, DEMO_MODE flag
    pages/
      Home.tsx                 Main layout: header, sidebar routing, section renders
      tabs/                    One file per clinical tab
        lib/
          docTemplate.ts       Shared HTML/CSS design system for all PDF reports
          pdfExport.ts         saveBlobAsPDF() + printDoc() — iframe-based PDF render
      ReceptionistView.tsx     Front-desk patient registration
      NursePreVisitView.tsx    Nurse vitals pre-visit flow
    components/
      NavSidebar.tsx           Collapsible role-aware navigation
      WheelPicker.tsx          Scroll-wheel numeric picker for vitals
      IcdPicker.tsx            Searchable ICD-10 picker
      FloatingActions.tsx      Floating save/clear buttons
    lib/
      supabase.ts              Supabase client singleton, type defs
      roles.ts                 hasRole(), roleIn() helpers

artifacts/api-server/          Express 5 API (port 8080, proxied at /api)
  src/routes/                  REST endpoints
  src/lib/                     Claude, Gmail, Calendar, SMS, Supabase integrations

lib/triage-engine/             Shared adaptive triage rules + scoring
supabase-schema.sql            12-table schema, RLS policies, triggers
```

## Key patterns

### State management
All clinical state lives in `AppContext`. Fields are persisted to localStorage and restored on load. `clearPatient()` resets all patient-specific fields. Add new state as a `useState` + localStorage load/save + `clearPatient` reset + value-object entry.

### Navigation
`TopSection` and `Section` union types drive routing. `Home.tsx` renders the correct tab component based on `{topSection, activeSection}`. `NavSidebar.tsx` lists items in `TOP_ITEMS` and `CLINICAL_SUB` arrays.

### PDF export
`saveBlobAsPDF(html, filename)` renders a full HTML document inside a hidden **same-origin iframe** using `document.write()` so `<head><style>` tags apply before html2canvas captures. **Never** assign a full HTML document to `div.innerHTML` — it strips `<html>/<head>` tags and CSS will not apply.

### Document design system (`docTemplate.ts`)
All PDF/print outputs use shared helpers:
- `AMISE_LOGO_SVG` — brand logo constant (two facing profile silhouettes)
- `masthead(docType, siteName, siteAddress, now, logoSvg)` — flex header with logo top-right
- `metaGrid(fields)`, `kvTable(rows)`, `bulList(items)`, `sec(title, body)`, `callout(heading, body)`, `footer(disclaimer)`, `signoff(name, role, licence)`, `wrapDoc(title, body)`
- Colour tokens in `T`: navy `#0B2545`, gold `#C8A24B`, teal `#1F7A8C`, ink `#1A1A1A`, mute `#6B7280`

### Role system
`UserRole`: `'front_desk' | 'nurse' | 'doctor' | 'admin'`
- `hasRole(userRole, minRole)` — true if userRole meets or exceeds minRole in the hierarchy
- `roleIn(userRole, ...roles)` — true if userRole is in the list
- `front_desk < nurse < doctor < admin`

### Supabase / Auth
- Use `VITE_SUPABASE_ANON_KEY` — must be JWT (`eyJ…`), not opaque `sb_publishable_…` format
- `DEMO_MODE` flag bypasses Supabase when no env vars are set (localStorage-only mode)
- RLS policies enforce role-based data access; never bypass with service role key on the frontend

## Coding conventions

- **No Tailwind** — plain CSS class names matching the existing stylesheet
- **No comments** unless explaining a non-obvious invariant or workaround
- **TypeScript strict** — no `any` without `eslint-disable` justification
- **British-Caribbean professional tone** in all patient-facing copy
- **Never include** clinical advice, drug doses, diagnoses, fees, or lab results in any automated outbound message
- Imports use `@/` alias for `src/` (configured in `vite.config.ts` and `tsconfig.json`)
- jsPDF v4 uses named export `{ jsPDF }`, not default export

## Running locally

```bash
pnpm install
pnpm --filter @workspace/dashboard run dev    # dashboard at http://localhost:5173
pnpm --filter @workspace/api-server run dev   # API at http://localhost:8080
pnpm run typecheck                             # full typecheck all packages
```

## Environment variables (frontend)

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | JWT anon key (eyJ…) |
| `VITE_DEMO_MODE` | `"true"` to skip Supabase entirely |
| `VITE_ANTHROPIC_API_KEY` | For AI-assisted draft features |

## Deployed site

Production: **https://amisesuite-afk.github.io/amise-medflow-emr-public/**  
Auto-deploys from `main` branch via `.github/workflows/deploy-pages.yml`.
