# Sheet migration record

Applied to Solar EPC Operations Command Center on 6 September 2026. Existing lead records, raw form responses and V1 tracker data were preserved.

| Tab | Added columns |
|---|---|
| Enquiry_Master | X:AA — manual_stop, acknowledgement_sent_at, updated_at, version |
| AI_Lead_Intelligence | J — ai_used |
| Team_Assignment | J — email; left blank for you to populate |
| Followup_Tracker | N:S — channel, automation_enabled, completed_at, outcome, updated_at, version |
| Site_Visit_Tracker | K:P — starts_at, ends_at, calendar_event_id, calendar_sync_status, updated_at, version |
| Proposal_Tracker | K:T — amount, currency, proposal_version, document_url, pdf_url, document_status, sent_at, next_followup_date, updated_at, version |

Added V2_Config, Delivery_Queue, Activity_Log, and Dashboard_V2. Header styles and selected dropdown validations were applied. Existing Dashboard, Approval_Tracker, Procurement_Tracker and EPC_Milestones were retained.

Team_Assignment!G2 now matches the intelligence table by lead_id before counting Hot leads per owner. This removes dependence on both tabs having the same row order. The verified counts were Rahul 0, Priya 1, Amit 3 and Neha 0.

Dashboard_V2 formula results at verification: 10 enquiries, 10 pending follow-ups, 0 due today, 10 overdue, and 0 visits, proposals, or deliveries. These are the existing July dummy records; their dates were not shifted to make the dashboard appear current.

Followup_Tracker!L2:M2 escalation ARRAYFORMULAs remain intact. The bridge skips those calculated columns and writes due dates as native dates. Original master columns A:W and follow-up columns A:M remain in their existing order for V1 compatibility.
