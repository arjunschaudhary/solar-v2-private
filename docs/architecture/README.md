# Solar EPC architecture guide

These source-backed diagrams document the existing operational system and its read-only SolarOps AI extension. They are standalone Archify HTML viewers with typed JSON sources. Archify is a development tool only; it is not installed in the Solar application or its production dependencies.

| View | Open the diagram | Editable source |
|---|---|---|
| Existing Solar EPC (AI excluded for clarity) | [As-is HTML](solar-epc-as-is.architecture.html) | [As-is JSON](solar-epc-as-is.architecture.json) |
| Read-only SolarOps AI extension | [To-be HTML](solarops-ai-to-be.architecture.html) | [To-be JSON](solarops-ai-to-be.architecture.json) |
| Example question sequence | [Sequence HTML](solarops-ai-priya-question.sequence.html) | [Sequence JSON](solarops-ai-priya-question.sequence.json) |
| Conditional vector RAG path | [RAG HTML](solarops-rag.dataflow.html) | [RAG JSON](solarops-rag.dataflow.json) |

The two architecture diagrams pin source evidence to Solar commit `74318359a31c99d3cb1b25ba93aa3ff90e10de67`. Archify verifies the Git origin, revision, blobs and cited line ranges with `--repo-root`. The as-is view deliberately omits the AI pages and route so the pre-agent operational architecture can be learned first. The to-be view shows the read-only agent already implemented at this revision and the disabled action boundary. It does not imply that n8n actions are available to the agent.

## Walkthrough

1. **Origin:** an operator creates an enquiry in the private web app, or a Google Form row is watched by the separate n8n intake workflow. The public web app uses fictional demonstration records.
2. **Storage:** Google Sheets tabs hold the operational master, intelligence, team assignments, follow-ups, site visits, proposals, delivery queue, activity and configuration. `lib/solar-core.ts` maps these tables and applies shared rules.
3. **Vercel application:** React shows and edits the workspace. The browser calls `/api/workspace`; the server route validates approved actions and adds server-held integration credentials. Public showcase mode returns synthetic records and rejects writes before accessing the private Sheet.
4. **Apps Script:** `Bridge.gs` validates the shared token, locks a request, loads the Sheet tabs, applies `SolarCore` actions and atomically batch-writes changed cells. It also generates private proposal Docs and PDFs when a claimed document task asks it to.
5. **n8n:** independent form and scheduled workflows call the Apps Script API for intake, follow-up queueing, claims and outcome recording. The repository exports are inactive credential-free templates; the repository alone cannot prove a private n8n instance is enabled.
6. **Google delivery:** Gmail sends claimed email tasks. The Calendar workflow creates, updates or cancels visit events. Apps Script creates proposal Docs/PDFs in Drive; the email workflow can later attach a PDF.
7. **Synchronous work:** a dashboard GET and an operator POST wait for Vercel and Apps Script to return. A save confirms the Sheet state, not an external send.
8. **Queued work:** `Delivery_Queue` stores pending email, calendar and document tasks. Scheduled workers claim, recheck and finish a task, then record its provider outcome. The manager summary is another queued email.
9. **Failure points:** network/timeout, missing integration configuration, Apps Script token or lock, stale Sheet version, paused automation, stale claim, or uncertain provider result. A `Sending` task with unknown outcome becomes `Needs review` rather than an automatic retry.
10. **AI extension:** `/api/agent` obtains an allowed snapshot, offers read-only customer/project/SOP tools, and sends grounded context to Gemini. A temporary provider failure uses a labeled grounded fallback. Safe activity metadata is stored in the current browser. The agent has no n8n write tool.

## Evidence and boundaries

| Claim | Source |
|---|---|
| Browser reads and saves through `/api/workspace` | `app/workspace.tsx:28-40` |
| Public showcase cannot request the private workbook | `lib/solar-data.ts:59-72`; `app/api/workspace/route.ts:43-51` |
| Server-only Apps Script endpoint/token and URL restriction | `lib/solar-data.ts:9-47` |
| Apps Script authentication, locking and Sheet access | `integrations/apps-script/Bridge.gs:15-85` |
| Enquiry, follow-up, visit, proposal, queue and summary rules | `lib/solar-core.ts:36-136` |
| Form intake and independent schedules | `integrations/n8n/01_enquiry_intake.json` through `06_manager_summary.json` |
| Read-only agent and synthetic SOP retrieval | `app/api/agent/route.ts`, `lib/solar-agent.ts`, `lib/solar-agent-data.ts`, `lib/solar-knowledge.ts` |
| Browser-local agent activity | `app/solarops-ai.tsx:11-39` |

**Trust boundary:** the public browser does not receive the Apps Script token. Vercel server code calls Apps Script; Apps Script validates its token before reading or writing private Sheets. The public showcase takes a synthetic-data branch first. `app/chatgpt-auth.ts` contains a ChatGPT header helper, but the inspected workspace and agent API routes do not invoke it. The private release guide calls for Vercel deployment protection; repository source alone does not establish the current dashboard setting. An authenticated private app should not rely on the shared Apps Script token as user-level authorization.

**Connection confidence:** the n8n JSON exports and `Bridge.gs` prove designed calls and service nodes, while external activation, credentials and runtime schedules are not verifiable from code. There is no n8n webhook call from the inspected Next.js app. The proposal and Calendar flows are queued and may be paused by workbook settings. The as-is graph deliberately leaves `Delivery_Queue` as a Sheet-tab node rather than drawing a false direct n8n-to-Sheet connection.

**Synthetic example:** Priya Sharma in the sequence is an illustrative fictional fixture, not a record in the current public demo. A live question with no matching customer must ask for clarification. The current public demo contains Priya Kapoor instead. The sequence shows the matched-record branch for learning; it does not claim an actual Priya Sharma lookup succeeded.

**RAG status:** the current eight synthetic SOP documents are versioned in `lib/solar-knowledge.ts` and retrieved by local lexical search. The RAG data-flow viewer draws a conditional future chunk → embedding → vector index path, marked **PLANNED**. No vector database, embedding job or Supabase project exists for SolarOps AI. Introduce one only if corpus growth, publishing needs or retrieval evaluation justifies it.

## Archify workflow and verification

Archify `tt-a1i/archify` version 2.17 was used from an isolated checkout of its documented skill package; `node bin/archify.mjs doctor` passed. The documented alternative for a Codex skill-capable environment is `npx skills use tt-a1i/archify@archify --agent codex`. No manual user action was needed here.

All four JSON diagrams passed `validate --quality showcase` with **9/9 artifact checks, zero composition errors and zero warnings**. All four HTML viewers passed Archify `deliver --quality showcase`. The two architecture diagrams additionally passed revision-pinned source verification (17 and 16 source references respectively). Archify's optional `visual-check` could not run because this execution environment has no Chrome/Chromium executable. The deterministic diagram rendering and source-evidence checks did pass; browser containment and perceptual polish are not claimed.

To regenerate after changing a diagram, run from an Archify skill checkout:

```bash
node bin/archify.mjs doctor
node bin/archify.mjs validate architecture /path/to/Solar/docs/architecture/solar-epc-as-is.architecture.json --repo-root /path/to/Solar --quality showcase --json
node bin/archify.mjs deliver architecture /path/to/Solar/docs/architecture/solar-epc-as-is.architecture.json /path/to/Solar/docs/architecture/solar-epc-as-is.architecture.html --repo-root /path/to/Solar --quality showcase --json
```

Use `sequence` or `dataflow` in place of `architecture` for those JSON files. Update the pinned revision and source ranges when the implementation changes materially; validate and deliver each changed diagram again. Do not add credentials, private customer records or configured n8n exports to these artifacts.
