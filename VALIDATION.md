# Verification record · 14 September 2026

## Automated verification

- Vercel-targeted Nitro/Vinext build completed successfully with Node.js 24.
- Vercel Build Output API bundle contains the server function and required static assets.
- 32 tests passed with zero failures.
- Business-rule checks cover duplicate intake, replay safety, validation, IST date boundaries, global pause/stop behavior, TEST routing, follow-up state transitions, uncertain deliveries, reconciliation, proposal revisions, acceptance rules, visit requirements, and worker restrictions.
- API checks cover fail-closed configuration, Sheets-only snapshots, same-origin POST enforcement, operator forwarding, and rejection of worker-only browser actions.
- Six n8n exports have valid topology, inactive schedules, and no embedded credentials.
- Generated Apps Script code parses independently.

## Connected verification completed

- Private Vercel Preview authenticated successfully.
- Preview read 11 existing Sheet enquiries through Apps Script.
- A harmless note update persisted from Vercel through Apps Script to Google Sheets.
- Enquiry intake and duplicate protection passed.
- Follow-up queueing and TEST email delivery passed.
- Site-visit Calendar create, reschedule, and cancellation passed.
- Proposal Google Doc and PDF generation passed.
- Proposal PDF email delivery passed.
- Manual recovery of an uncertain delivery passed without duplicate sending.
- Proposal acceptance set the enquiry to Converted and stopped pending follow-ups.
- Manager summary queued once, emailed once, and stored its Gmail provider ID.
- Proposal-revision cleanup and safe PDF-download retry corrections passed.
- Desktop/laptop, narrow/tablet, and 390 × 844 mobile responsive checks passed.

## Production status

- Private Production deployment is active on Vercel.
- Vercel Authentication is required for all deployments.
- Preview and Production use server-only environment variables.
- The permanent Production URL reads the paused Google Sheet successfully.
- `SEND_MODE=TEST` and `AUTOMATION_ENABLED=No` remain the safe handoff state.
- n8n schedules remain inactive.

## Boundaries

- This is a lightweight Solar EPC CRM and operations workflow system, not a complete EPC ERP.
- Proposal documents remain drafts requiring commercial and technical review.
- Engineering design, procurement, inventory, installation, commissioning, accounting, reply detection, bounce processing, and customer unsubscribe automation are outside the current version.
- Provider timeouts may be uncertain; verify Gmail, Calendar, or Drive before reconciling or retrying.
