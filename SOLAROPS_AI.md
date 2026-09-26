# SolarOps AI · Read-only stage

## Safety boundary

- `SOLAR_PUBLIC_SHOWCASE=Yes` returns `demoWorkspace()` before the server evaluates or calls the Apps Script integration.
- Public `/api/workspace` and `/api/agent` therefore operate only on synthetic records.
- The agent exposes no mutation tool. n8n, email, Calendar, document generation, approvals, and workspace writes remain unavailable.
- A recommendation is returned with `Not executed — recommendation only` and must never be represented as an execution.
- Agent Activity stores prompt, tool name, duration, source label, provider, and outcome in the current browser. It does not store or display chain-of-thought.

## Existing Apps Script API audit

Apps Script accepts authenticated JSON `POST` requests only. The server validates the deployment URL, attaches the secret token, and limits browser actions through an allowlist.

| Request type | Response available to app | SolarOps AI stage |
|---|---|---|
| `snapshot` | Full `Workspace` state and version | Read source in private mode |
| Approved browser action | Updated state plus action result | Not exposed to agent |
| Worker action | Result only unless optimistic version is supplied | Not exposed to agent |
| `generate_document` | Provider/document identifiers | Not exposed to agent |

The snapshot currently provides these tabs:

| Workspace collection | Google Sheets tab | Agent usage |
|---|---|---|
| `leads` | `Enquiry_Master` | Customer search, project identity, status, owner, last action |
| `intelligence` | `AI_Lead_Intelligence` | Priority, missing information, suggested next action |
| `team` | `Team_Assignment` | Operational context |
| `followups` | `Followup_Tracker` | Tasks, due dates, overdue evidence |
| `visits` | `Site_Visit_Tracker` | Site survey status and findings |
| `proposals` | `Proposal_Tracker` | Proposal version, document, share, and approval status |
| `deliveries` | `Delivery_Queue` | Existing app visibility only; unavailable to the agent |
| `activity` | `Activity_Log` | Existing business activity only; agent runs are separate |

## Read-only tools

- `search_customers`
- `get_customer`
- `get_project_details`
- `get_project_status`
- `list_delayed_projects`
- `explain_project_stall`
- `get_project_records` for tasks, site surveys, and proposals
- `list_tasks` for pending, overdue, or due-today work
- `get_operations_overview`
- `search_solar_sop`

Tool output includes source labels and safe summaries for the activity panel. Stall explanations are deterministic before the model sees them: they inspect manual stops, overdue tasks, completed surveys without proposals, draft/shared proposal state, and recorded missing information.

## Model and retrieval design

The provider path uses Vercel AI SDK `ToolLoopAgent` with Google Gemini. `gemini-3.5-flash` is the default and can be changed with `SOLAR_AI_MODEL`. Without `GOOGLE_GENERATIVE_AI_API_KEY`, the API uses a deterministic grounded engine that calls the same read-only data and SOP functions. If Gemini returns a temporary capacity, timeout, or rate-limit failure, the agent uses that grounded engine for the request and explicitly labels the fallback. Configuration/authentication failures remain visible as errors.

No Supabase project was created. The initial SOP corpus has eight small synthetic documents, so local version-controlled lexical retrieval is simpler, free, reproducible, and adequate. A separate vector store becomes justified when the corpus is materially larger, needs frequent non-code publishing, requires permissions by document, or retrieval quality cannot meet evaluation targets.
