# Private deployment and connection guide

This guide describes the private Vercel release. Google Sheets remains the operational database, Apps Script enforces the shared business rules, and n8n performs queued external work.

## 1. Safety prerequisites

Before connecting or testing:

- Set `SEND_MODE=TEST`.
- Set `AUTOMATION_ENABLED=No`.
- Keep all n8n schedules inactive.
- Use only the dedicated test inbox, test calendar, proposal folder, and fictional enquiry.
- Confirm Vercel Authentication requires login for all deployments.

## 2. Apps Script bridge

Use the existing versioned Apps Script Web App deployment:

- Execute as the script owner.
- Keep the automation token in Apps Script Properties.
- Keep the Web App URL and token private.
- Update the existing deployment to a new version after changing Apps Script code.
- Do not publish the URL or token in GitHub, documentation, screenshots, or browser code.

The Vercel API accepts only an HTTPS `script.google.com` endpoint ending in `/exec`.

## 3. Vercel environment variables

Configure the following separately for Preview and Production:

| Variable | Recommended type | Purpose |
|---|---|---|
| `SOLAR_APPS_SCRIPT_URL` | Secret | Existing Apps Script Web App URL ending in `/exec` |
| `SOLAR_AUTOMATION_TOKEN` | Secret | Shared token validated by Apps Script |
| `SOLAR_OPERATOR_EMAIL` | Config | Actor label recorded in activity history |

Environment changes apply only to new deployments. Validate a protected Preview before promoting the same tested source to Production.

## 4. n8n workflows

| Workflow | Purpose |
|---|---|
| 01 · Enquiry intake | Normalize a form row and create the enquiry, intelligence, first follow-up, and acknowledgement queue item |
| 02 · Follow-up queue | Queue due, opted-in email follow-ups once |
| 03 · Email delivery | Claim one email, recheck stop rules, send plain/PDF email, and record the provider result |
| 04 · Site-visit calendar | Create, reschedule, or cancel the matching Google Calendar event |
| 05 · Proposal documents | Generate a reviewed private Google Doc and PDF and save their references |
| 06 · Manager summary | Queue the daily operational summary for email delivery |

All exported workflows must remain inactive and credential-free in Git. Add credentials only inside the private n8n instance.

## 5. Controlled release sequence

1. Build the Vercel target locally.
2. Run all automated checks.
3. Deploy without `--prod` to create a Preview.
4. Sign in and confirm the dashboard reads Google Sheets.
5. Make one harmless note update on the fictional test enquiry.
6. Refresh and confirm the write persisted.
7. Test desktop, tablet, and mobile layouts.
8. Add Production environment values.
9. Deploy the same source with `--prod`.
10. Confirm Production remains login-protected and reads the same paused Sheet.

## 6. Operational rules

- A saved or queued action is not yet a completed external action.
- A proposal PDF can be ready without having been emailed.
- A proposal must be confirmed Shared before it can be accepted.
- Proposal revisions retire obsolete queued documents and prior proposal follow-ups.
- Accepted or declined proposals clear proposal follow-up dates.
- Terminal enquiry states stop pending work.
- A delivery stuck at Sending is not automatically retried; check the provider before reconciliation.
- Manual Sheet edits do not increment the API version. Use the application for ordinary operations.

## 7. Credential handling

Never commit or share:

- `.env*` or `.dev.vars*`
- `.vercel/` project or downloaded environment files
- Apps Script URLs or automation-token values
- Gmail, Calendar, Drive, or n8n credentials
- Configured workflow exports
- Real customer exports

The committed `.env.example` contains names only. Secret values belong in Vercel and the relevant private service settings.
