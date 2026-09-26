# Solar EPC Operations Command Center · V2

Solar EPC CRM and operations application that manages the journey from enquiry capture through follow-ups, site visits, proposals, delivery tracking, acceptance, and conversion.

## Current status

- Public production showcase uses only in-app synthetic data and never requests the private Sheet
- GitHub `main` connected to automatic Vercel production deployments
- Public showcase blocks browser write actions; integration testing uses protected deployments
- Live business data stored in Google Sheets through an Apps Script bridge
- Read-only SolarOps AI can inspect projects, diagnose stalls, recommend next actions, and retrieve synthetic SOP guidance
- n8n action execution remains disabled for SolarOps AI
- Gmail, Google Calendar, Drive/Docs, and PDF proposal delivery tested end to end
- 37 automated checks passing
- Desktop, tablet, and 390 × 844 mobile layouts verified
- AI qualification optional and disabled by default

## Business capabilities

| Area | Capability |
|---|---|
| Enquiries | Capture, validate, deduplicate, assign, qualify, update, stop, and convert leads |
| Follow-ups | Create manual or email tasks, track outcomes, prevent duplicates, and stop pending work |
| Site visits | Schedule, reschedule, complete, and cancel visits with stable Calendar events |
| Proposals | Create versioned proposals, generate private Docs/PDFs, share reviewed versions, and record decisions |
| Delivery | Queue work, claim once, record provider outcomes, and isolate uncertain sends for review |
| Management | Display operational counts and queue a daily summary email |
| SolarOps AI | Search synthetic customers, inspect projects, find delays, explain stalls, retrieve SOP guidance, and show safe tool activity |

## Architecture

```mermaid
flowchart TD
  Agent["SolarOps AI · read only"] --> API
  Agent --> SOP["Versioned synthetic SOP library"]
  Form["Google Form"] --> Intake["n8n intake"]
  App["Vercel app"] --> API["Protected server API"]
  Intake --> Bridge["Apps Script bridge"]
  API --> Bridge
  Bridge --> Sheets["Google Sheets"]
  Sheets --> Workers["n8n workers"]
  Workers --> Google["Gmail · Calendar · Drive"]
  Workers --> Bridge
```

The browser never receives the Apps Script token. It calls `/api/workspace`; the Vercel function adds server-only credentials and forwards approved actions to Apps Script. In public-showcase mode, that route returns the synthetic in-app workspace before any Apps Script request can occur. `/api/agent` uses the same safe snapshot boundary.

SolarOps AI uses the existing Sheets/Apps Script records in private mode and read-only tools shaped around the current tabs. No Supabase project is required for this stage: the small synthetic SOP corpus is versioned in the application and retrieved locally, while safe agent activity is retained in the user's browser. A vector database can be evaluated later if the knowledge corpus becomes large or needs non-developer publishing workflows.

## Safety baseline

Keep these workbook settings during controlled testing:

```text
SEND_MODE=TEST
AUTOMATION_ENABLED=No
```

Keep n8n schedules inactive until each workflow is deliberately enabled. Never commit configured n8n exports, Apps Script deployment URLs, tokens, Vercel environment files, Google credentials, or real client exports.

## Server environment variables

Configure these in Vercel for Preview and Production. Values are stored in Vercel, not in Git:

```text
SOLAR_APPS_SCRIPT_URL=
SOLAR_AUTOMATION_TOKEN=
SOLAR_OPERATOR_EMAIL=
GOOGLE_GENERATIVE_AI_API_KEY=
SOLAR_AI_MODEL=gemini-3.5-flash
```

The Apps Script token and Google AI key should be Secret values. The operator email, model name, and showcase flag may be Config. Set `SOLAR_PUBLIC_SHOWCASE=Yes` only while production is intentionally public; this serves synthetic data and blocks all browser write actions. If the Gemini key is absent, SolarOps AI uses its deterministic grounded demo engine so read-only questions remain testable. Do not prefix any of these values with `NEXT_PUBLIC_`.

## Verification

The current baseline passed:

- Vercel-targeted Nitro/Vinext production build
- 37 automated business-rule, public-data-safety, agent-grounding, API, workflow-topology, UI-component, and bundle checks
- Google Sheets read and write through the protected Vercel Preview
- Enquiry intake and duplicate protection
- Follow-up queueing and test email delivery
- Calendar create, reschedule, and cancel
- Proposal document/PDF generation and attached email delivery
- Proposal acceptance, enquiry conversion, and pending-task cleanup
- Manager-summary queueing and email delivery
- Responsive checks at laptop, tablet, and mobile widths

See [VALIDATION.md](VALIDATION.md) for the verification record and [CONNECTING.md](CONNECTING.md) for private deployment and integration guidance.

## Local verification on Windows

Use Node.js 24 and install the locked dependencies:

```powershell
npm.cmd install --legacy-peer-deps

$env:NITRO_PRESET = "vercel"
npx.cmd vite build
$solarBuildCode = $LASTEXITCODE
Remove-Item Env:\NITRO_PRESET -ErrorAction SilentlyContinue

$solarTestFiles = Get-ChildItem .\tests -File -Filter "*.test.mjs" |
  Select-Object -ExpandProperty FullName
node --test $solarTestFiles
```

A local `.env*` file may be used for development, but it is ignored and must never be committed.
