# Solar EPC Operations · V2 connection guide

This release adds enquiry management, completed follow-ups, site visits, proposal versions, private document generation, and a daily manager summary. Google Sheets remains the live business database. AI is deliberately off by default to keep routine tests free of model calls.

## What is ready

The web interface opens a private sample workspace with fictional enquiries. Practice changes persist in that workspace, separately from your Solar Sheet. It can create enquiries, complete follow-ups, record outcomes, schedule visits, draft proposals, stop enquiries, and review uncertain deliveries.

The six n8n imports are inactive and have no connected credentials. Import them as new workflows. Keep your V1 export as a backup; disable V1 intake when you switch to V2 intake, so two intake systems do not process new submissions.

| File | Purpose | Connections you add |
|---|---|---|
| `01_enquiry_intake.json` | Form row → rules → enquiry + intelligence + first follow-up + acknowledgement queue | Google Sheets trigger and Solar bridge; OpenAI only if later enabled |
| `02_followup_queue.json` | Queue due, explicitly enabled email follow-ups | Solar bridge |
| `03_email_delivery.json` | Claim one email, recheck stop controls, send, record result; attach proposal PDF when needed | Solar bridge, Gmail on both send nodes, Google Drive on PDF download |
| `04_site_visit_calendar.json` | Create, update or cancel one calendar event using a stable event ID | Solar bridge and the same Google Calendar account on four HTTP nodes |
| `05_proposal_documents.json` | Generate a private Google Doc and PDF; save links to the tracker | Solar bridge; the Apps Script owner authorizes Docs/Drive |
| `06_manager_summary.json` | Queue daily counts at 18:00 IST | Solar bridge; email worker performs sending |

Queue builders and workers are separate. A record can be saved successfully while its external email, calendar event, or document is still pending.

## 1. Connect the Apps Script bridge

1. Open your [Solar Sheet](https://docs.google.com/spreadsheets/d/17mExQ2XRc9me6NvG3ZpNjbnDOUt-ePt0FcicME_RFWY/edit), then Extensions → Apps Script.
2. Use a dedicated Apps Script project for V2 if you already have another web app or `doPost` function. Copy `integrations/apps-script/Bridge.gs` and `Core.gs` into two script files. Core is generated from the same business rules used by the interface.
3. In Project Settings, show the manifest file. Copy the included `appsscript.json`. It declares the Google Sheets advanced service. If prompted, enable the Sheets API for the linked Google Cloud project.
4. Run `setupSolar` once and authorize access to your Sheet. In Script properties, copy the generated `SOLAR_AUTOMATION_TOKEN`. Keep it private; do not paste it in the Sheet or public portfolio.
5. Deploy as a Web app, executing as you, with access that permits unauthenticated HTTP calls (the app verifies the secret in every POST). Use a personal Google account if Workspace policy blocks this deployment mode; do not change organizational policies. Copy the deployment URL ending in `/exec`.
6. When changing script code later, update the deployment to a new version. Saving the editor alone does not update an existing versioned deployment.

The bridge uses a script lock and one atomic Sheets batch per state change. It writes only changed fields, preserves existing formulas, uses native date cells for due dates, and grows a tab when it needs additional rows. Its lock coordinates V2 bridge callers; direct Sheet edits and V1 workflows are outside that lock.

## 2. Import and configure n8n

Import all six JSON files from `integrations/n8n/`. In each **Connection settings** node, replace `api_url` and `api_token` with your Apps Script deployment URL and Script property value. The package contains placeholders only. Configured workflow exports and execution data may contain this token; keep them private. On self-hosted n8n you can instead use your instance's environment/secret mechanism if it permits Code-node access.

Select your Google credentials in the nodes listed above. In HTTP Request nodes for Drive/Calendar, use the displayed predefined Google OAuth credential type. All workers process one task per run. Do not add automatic retries to the Gmail send nodes: a timeout can happen after Gmail has accepted a message.

Leave `use_ai = false`. The optional AI node is also disabled. Later, to test AI, both enable that node and change `use_ai` to `true`, then connect an OpenAI credential. AI supplies qualification fields only; deterministic rules continue to control task state and delivery. Check current model availability and cost in your account before enabling it.

## 3. Fill V2_Config

| Key | Initial value | What you enter |
|---|---|---|
| SEND_MODE | TEST | Keep TEST for the first exercises |
| AUTOMATION_ENABLED | No | Switch to Yes only when ready to run test workers |
| TEST_RECEIVER_EMAIL | Blank | Your own test inbox |
| MANAGER_EMAIL | Blank | Intended summary recipient; TEST still redirects to your test inbox |
| CALENDAR_ID | primary | Calendar used in LIVE mode |
| TEST_CALENDAR_ID | Blank | ID of a separate calendar created for testing |
| PROPOSAL_FOLDER_ID | Blank | ID of a private Drive folder for draft Docs and PDFs |
| DATA_VERSION | 0 | Managed by the bridge; do not edit |

TEST changes delivery destinations; it still records outcomes in the connected Sheet. Use dummy enquiries during testing. A TEST email marked sent means it reached the test recipient, not the original client. Do not switch real pending test records to LIVE indiscriminately.

Existing V1 follow-ups have blank new control fields, which behave as Manual / automation off. To automate a specific task, set its `channel` to `Email` and `automation_enabled` to `Yes`. The global control must also be enabled. Complete and schedule work through the app once connected.

## 4. Connect the web interface to Sheets

Add these two values as private **server runtime settings**, then redeploy the interface:

```text
SOLAR_APPS_SCRIPT_URL=<your /exec URL>
SOLAR_AUTOMATION_TOKEN=<your Script property value>
```

Do not use `NEXT_PUBLIC_` variables. The browser talks to `/api/workspace`; the server supplies the secret to Apps Script. With both settings present, the interface switches to Google Sheets. With neither present, it uses the durable sample workspace. A failed live connection displays an error and does not silently save to sample data.

This preview uses private Sites authentication and a small D1 table for sample data only. The included source is currently configured for that runtime. A Vercel deployment needs its own authenticated server route and a replacement for the D1 sample adapter; it is not a one-click Vercel import. The Sheets bridge and all n8n workflows remain reusable.

### Safe local connection on Windows

Use this first so the token never needs to be shared in chat or placed in browser code.

1. Install Node.js 22 or newer. Open PowerShell in the extracted package folder and run `node --version` to confirm.
2. Run `npm ci` and wait for it to finish.
3. In File Explorer, enable **View → Show → File name extensions**. Copy `.env.example` and rename the copy to `.env` (not `.env.txt`).
4. Open `.env` in Notepad and enter the two private server values without quotes:

   ```text
   SOLAR_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT/exec
   SOLAR_AUTOMATION_TOKEN=YOUR_SCRIPT_PROPERTY_TOKEN
   ```

5. Save `.env`. It is excluded by `.gitignore`; do not upload, email, or commit it.
6. In PowerShell, run `npm run dev`. Open the localhost URL printed in the terminal, normally `http://localhost:5173`.
7. The interface should show **Google Sheets** rather than **Sample workspace** and load the connected Sheet records. Stop the local server later with `Ctrl+C`.

Local development accepts a fixed local operator only on `localhost`, `127.0.0.1`, or `::1` while Vite is in development mode. Deployed builds still require Sites authentication.

## 5. First connection test — one enquiry

1. Leave all schedules inactive. Use your own inbox, a test calendar, and a private proposal folder.
2. Connect the bridge and interface. Confirm that the label changes from **Sample workspace** to **Google Sheets** and shows your existing dummy records.
3. Add one dummy enquiry through the app, or submit the existing Google Form while testing intake. Expect one master record, one intelligence record, one pending manual follow-up, and one queued acknowledgement.
4. Set global automation to Yes, still in TEST. Run the email worker once. Confirm one test email and a Sent delivery row with a Gmail message ID. Running it again must not resend that acknowledgement.
5. Create an Email follow-up due today, explicitly enable its automation, run the queue builder, then the email worker. Confirm Completed, `last_email_sent_at`, and the revised next follow-up date. For a manual call, use Complete in the interface and record an outcome.
6. Create a second due task, then stop the enquiry before running delivery. Confirm its pending tasks stop and queued sends are cancelled. Reopening a lead does not resurrect cancelled tasks; add the next task deliberately.
7. Schedule a future visit and run the calendar worker. Reschedule the visit and run it again: the same calendar event should update. Cancel a visit to remove that event. The workflow does not automatically invite clients or engineers.
8. Create a proposal with amount and scope. Run the document worker, inspect the private draft, then click Share. Run the email worker and check the PDF attachment. Sharing a proposal requires your review; draft creation does not send it.
9. Record proposal acceptance only after it is Shared. Confirm the enquiry becomes Converted and remaining pending follow-ups stop.
10. Run the summary workflow, then the email worker, and compare counts with Dashboard_V2.

If an action fails, read its n8n execution and Delivery_Queue. A task left at Sending for over 15 minutes moves to Needs review when a worker next polls. Check Gmail/Calendar/Drive first, then use Connections → Review to mark the confirmed result or retry only if it did not complete. No software can infer a lost provider response with certainty.

## Current boundaries

- Gmail, Calendar, Apps Script deployment and live n8n executions still require your account connections and the test above.
- The proposal is a draft scope/amount document, not an engineered design, tax calculation, or signed contract. Review technical and commercial content before sharing.
- Manual stop, terminal statuses, task completion, and proposal acceptance stop pending work. Incoming reply detection, bounce processing, customer unsubscribe, procurement, installation and commissioning workflows are future additions.
- A provider call that has already started may finish after an operator stops the enquiry. Review its recorded result rather than assuming it was recalled.
- Manual Sheet edits do not increment the API's version counter. Use the app for normal operational updates; use Sheets for setup, inspection, and controlled corrections.

## Source and verification

`lib/solar-core.ts` is shared by the sample API and Apps Script. Run `node scripts/build-integrations.mjs` after changing it. Rebuilds produce Core.gs and the six workflow files. Run `node --test tests/solar-core.test.mjs tests/workspace-api.test.mjs` for the isolated behavior tests. These do not send messages or contact Google services.

Build checks and isolated behavior tests are recorded in `VALIDATION.md`. They do not replace a live import and one-record connection test on your n8n instance.
