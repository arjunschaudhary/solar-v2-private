// Generated from lib/solar-core.ts. Rebuild with node scripts/build-integrations.mjs.
"use strict";
var SolarCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // lib/solar-core.ts
  var solar_core_exports = {};
  __export(solar_core_exports, {
    KEYS: () => KEYS,
    TABLES: () => TABLES,
    TERMINAL: () => TERMINAL,
    addDays: () => addDays,
    applyAction: () => applyAction,
    day: () => day,
    demoWorkspace: () => demoWorkspace,
    emptyWorkspace: () => emptyWorkspace,
    isStopped: () => isStopped,
    qualify: () => qualify
  });
  var TABLES = { leads: "Enquiry_Master", intelligence: "AI_Lead_Intelligence", team: "Team_Assignment", followups: "Followup_Tracker", visits: "Site_Visit_Tracker", proposals: "Proposal_Tracker", deliveries: "Delivery_Queue", activity: "Activity_Log" };
  var KEYS = { leads: "lead_id", intelligence: "lead_id", team: "team_member", followups: "followup_id", visits: "site_visit_id", proposals: "proposal_id", deliveries: "delivery_id", activity: "event_id" };
  var TERMINAL = ["Converted", "Lost", "Stopped"];
  var day = (date = /* @__PURE__ */ new Date()) => new Date(new Date(date).getTime() + 198e5).toISOString().slice(0, 10);
  var addDays = (date, n) => new Date((/* @__PURE__ */ new Date(date + "T12:00:00+05:30")).getTime() + n * 864e5).toISOString().slice(0, 10);
  var text = (v) => String(v ?? "").trim();
  var yes = (v) => v === true || text(v).toLowerCase() === "yes" || text(v).toLowerCase() === "true";
  var isStopped = (lead) => !lead || yes(lead.manual_stop) || TERMINAL.includes(lead.current_status);
  var required = (v, label) => {
    if (!text(v)) throw new Error(label + " is required.");
    return text(v);
  };
  var email = (v) => {
    const s = required(v, "Email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error("Enter a valid email address.");
    return s;
  };
  var validDay = (v) => {
    const s = required(v, "Date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) throw new Error("Enter a valid date.");
    return s;
  };
  var choose = (v, values, label) => {
    if (!values.includes(v)) throw new Error("Invalid " + label + ".");
    return v;
  };
  var uuid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
  var emptyWorkspace = () => ({ leads: [], intelligence: [], team: [], followups: [], visits: [], proposals: [], deliveries: [], activity: [], config: { SEND_MODE: "TEST", AUTOMATION_ENABLED: "No", TEST_RECEIVER_EMAIL: "", MANAGER_EMAIL: "", CALENDAR_ID: "primary", PROPOSAL_FOLDER_ID: "" }, version: 0 });
  function qualify(p) {
    const timeline = text(p.timeline).toLowerCase(), capacity = text(p.estimated_capacity), budget = text(p.budget_range);
    let score = 3 + (timeline.includes("immediately") ? 4 : timeline.includes("within 1 month") ? 3 : timeline.includes("1-3 months") ? 2 : timeline.includes("3-6 months") ? 1 : 0);
    const knownCapacity = !!capacity && !/not sure|unknown/i.test(capacity);
    score += Number(yes(p.site_visit_required)) + Number(yes(p.electricity_bill_available)) + Number(knownCapacity) + Number(!!budget && !/not sure|unknown/i.test(budget)) + Number(text(p.message).length > 30);
    score = Math.min(score, 10);
    const missing = [!p.location && "Location", !knownCapacity && "Estimated capacity", (!budget || /not sure/i.test(budget)) && "Budget range", !yes(p.electricity_bill_available) && "Electricity bill"].filter(Boolean).join(", ");
    return { urgency_score: score, lead_temperature: score >= 7 ? "Hot" : score >= 5 ? "Warm" : "Cold", project_category: p.project_type || "Solar", client_summary: `${p.company_name || p.client_name}: ${p.project_type || "solar"} enquiry in ${p.location || "location to confirm"}.`, missing_information: missing || "No major missing information", suggested_next_action: missing ? "Collect missing project details." : "Confirm the next sales or site action.", ai_used: "No" };
  }
  function applyAction(input, action, actor = "Operator", now = (/* @__PURE__ */ new Date()).toISOString()) {
    const s = JSON.parse(JSON.stringify(input));
    const p = action.payload || {};
    required(action.request_id, "Request identifier");
    if (s.activity.some((x) => x.request_id === action.request_id)) return { state: s, result: { duplicate: true } };
    const today = day(now);
    let result = {};
    let entity = "";
    const find = (list, key, id) => {
      const r = list.find((x) => x[key] === id);
      if (!r) throw new Error("Record not found. Refresh the workspace.");
      return r;
    };
    const leadFor = (id) => find(s.leads, "lead_id", id);
    const touch = (r) => {
      r.updated_at = now;
      r.version = Number(r.version || 0) + 1;
    };
    const ensureActive = (r) => {
      if (isStopped(r)) throw new Error("This enquiry is closed or stopped. Reopen it before adding work.");
    };
    const queue = (kind, key, lead_id, payload) => {
      const existing = s.deliveries.find((d2) => d2.dedupe_key === key);
      if (existing) return existing;
      const d = { delivery_id: "D-" + uuid(), dedupe_key: key, kind, lead_id, status: "Pending", created_at: now, updated_at: now, payload_json: JSON.stringify(payload), attempt_count: 0, claim_token: "", claimed_at: "", sent_at: "", provider_id: "", error_message: "", source_id: payload.source_id || "" };
      s.deliveries.push(d);
      return d;
    };
    const syncFollowup = (lead) => {
      const pending = s.followups.filter((f) => f.lead_id === lead.lead_id && f.followup_status === "Pending").sort((a, b) => text(a.followup_due_date).localeCompare(text(b.followup_due_date)));
      lead.next_followup_date = pending[0]?.followup_due_date || "";
      lead.escalation_flag = pending.some((f) => f.followup_due_date && f.followup_due_date < today) ? "Yes" : "No";
    };
    const stopWork = (id) => {
      s.followups.filter((f) => f.lead_id === id && f.followup_status === "Pending").forEach((f) => {
        f.followup_status = "Stopped";
        touch(f);
      });
      s.deliveries.filter((d) => d.lead_id === id && ["Pending", "Claimed"].includes(d.status)).forEach((d) => {
        d.status = "Cancelled";
        touch(d);
      });
    };
    const addFollowup = (lead, due, channel = "Manual", enabled = "No") => {
      const f = { followup_id: "FU-" + uuid(), lead_id: lead.lead_id, client_name: lead.client_name, email: lead.email, assigned_to: lead.assigned_to, followup_stage: "Follow-up " + (s.followups.filter((f2) => f2.lead_id === lead.lead_id).length + 1), followup_due_date: validDay(due), followup_status: "Pending", last_email_sent_at: "", next_action: p.next_action || "Contact client and record the outcome", notes: "", channel, automation_enabled: enabled, completed_at: "", outcome: "", updated_at: now, version: 1 };
      s.followups.push(f);
      syncFollowup(lead);
      return f;
    };
    switch (action.type) {
      case "create_lead": {
        const key = text(p.lead_key) || "WEB|" + action.request_id;
        const existing = s.leads.find((l) => l.lead_key === key);
        if (existing) {
          result = { lead_id: existing.lead_id, duplicate: true };
          break;
        }
        const q = qualify(p);
        const project = choose(p.project_type, ["Residential", "Commercial", "Industrial", "Institutional"], "project type");
        const owners = s.team.filter((t) => !/engineer/i.test(t.role));
        let assignee = owners.find((t) => t.active_status === "Active" && text(t.project_type_supported).toLowerCase() === project.toLowerCase())?.team_member || owners.find((t) => t.active_status === "Active")?.team_member || "Unassigned";
        const lead = { lead_id: "SEPC-" + uuid(), lead_key: key, created_at: p.created_at || now, client_name: required(p.client_name, "Client name"), company_name: text(p.company_name), email: email(p.email), phone: text(p.phone).replace(/\D/g, ""), location: required(p.location, "Location"), project_type: project, estimated_capacity: text(p.estimated_capacity), budget_range: text(p.budget_range), timeline: text(p.timeline), electricity_bill_available: text(p.electricity_bill_available), site_visit_required: yes(p.site_visit_required) ? "Yes" : "No", message: text(p.message), lead_source: p.lead_source || "Web app", current_status: "Qualified", assigned_to: assignee, next_followup_date: "", escalation_flag: "No", last_action: "Enquiry received", last_action_at: now, notes: "", manual_stop: "No", acknowledgement_sent_at: "", updated_at: now, version: 1 };
        let intelligence = { ...q };
        if (p.ai) {
          const a = p.ai;
          if (!["Hot", "Warm", "Cold"].includes(a.lead_temperature) || !Number.isFinite(Number(a.urgency_score)) || Number(a.urgency_score) < 1 || Number(a.urgency_score) > 10) throw new Error("AI output needs review: invalid temperature or score.");
          intelligence = { ...q, ...a, ai_used: "Yes" };
        }
        s.leads.push(lead);
        s.intelligence.push({ ...intelligence, lead_id: lead.lead_id, ai_processed_at: now });
        addFollowup(lead, addDays(today, intelligence.lead_temperature === "Hot" ? 1 : intelligence.lead_temperature === "Warm" ? 3 : 7));
        queue("email", "ack:" + lead.lead_id, lead.lead_id, { purpose: "acknowledgement", to: lead.email, subject: "Solar enquiry received", body: `Dear ${lead.client_name},

Thank you for your ${project.toLowerCase()} solar enquiry in ${lead.location}. Our team will review your requirements and contact you.

Solar EPC Operations Team` });
        entity = lead.lead_id;
        result = { lead_id: entity };
        break;
      }
      case "update_lead": {
        const l = leadFor(p.lead_id);
        entity = l.lead_id;
        if (p.assigned_to !== void 0) {
          if (!s.team.some((t) => t.team_member === p.assigned_to && t.active_status === "Active")) throw new Error("Choose an active team member.");
          l.assigned_to = p.assigned_to;
          s.followups.filter((f) => f.lead_id === entity && f.followup_status === "Pending").forEach((f) => f.assigned_to = p.assigned_to);
        }
        if (p.current_status !== void 0) l.current_status = choose(p.current_status, ["Qualified", "Contacted", "Site Visit", "Proposal", "Converted", "Lost", "Stopped"], "enquiry status");
        if (p.manual_stop !== void 0) l.manual_stop = yes(p.manual_stop) ? "Yes" : "No";
        if (p.notes !== void 0) l.notes = text(p.notes);
        if (isStopped(l)) stopWork(entity);
        syncFollowup(l);
        l.last_action = "Enquiry updated";
        l.last_action_at = now;
        touch(l);
        break;
      }
      case "add_followup": {
        const l = leadFor(p.lead_id);
        ensureActive(l);
        entity = l.lead_id;
        result = addFollowup(l, p.due_date, choose(p.channel || "Manual", ["Manual", "Email"], "channel"), yes(p.automation_enabled) ? "Yes" : "No");
        break;
      }
      case "complete_followup": {
        const f = find(s.followups, "followup_id", p.followup_id), l = leadFor(f.lead_id);
        entity = l.lead_id;
        ensureActive(l);
        if (f.followup_status !== "Pending") throw new Error("This follow-up has already been handled.");
        f.followup_status = "Completed";
        f.outcome = required(p.outcome, "Outcome");
        f.notes = text(p.notes);
        f.completed_at = now;
        touch(f);
        s.deliveries.filter((d) => d.source_id === f.followup_id && ["Pending", "Claimed"].includes(d.status)).forEach((d) => d.status = "Cancelled");
        if (p.next_due_date) addFollowup(l, p.next_due_date, p.channel || "Manual", yes(p.automation_enabled) ? "Yes" : "No");
        syncFollowup(l);
        l.last_action = "Follow-up completed: " + f.outcome;
        l.last_action_at = now;
        touch(l);
        break;
      }
      case "schedule_visit": {
        const l = leadFor(p.lead_id);
        ensureActive(l);
        entity = l.lead_id;
        const start = required(p.starts_at, "Visit time");
        if (isNaN(Date.parse(start)) || Date.parse(start) <= Date.parse(now)) throw new Error("Choose a future visit time.");
        if (!s.team.some((t) => t.team_member === p.assigned_engineer && t.active_status === "Active")) throw new Error("Choose an active engineer.");
        const v = { site_visit_id: "SV-" + uuid(), lead_id: l.lead_id, client_name: l.client_name, assigned_engineer: p.assigned_engineer, visit_date: day(start), checklist_status: "Pending", required_documents: text(p.required_documents), visit_notes: "", photos_link: "", visit_status: "Scheduled", starts_at: new Date(start).toISOString(), ends_at: new Date(Date.parse(start) + 36e5).toISOString(), calendar_event_id: "", calendar_sync_status: "Pending", updated_at: now, version: 1 };
        s.visits.push(v);
        l.current_status = "Site Visit";
        touch(l);
        queue("calendar", "calendar:" + v.site_visit_id + ":1", l.lead_id, { source_id: v.site_visit_id, operation: "upsert" });
        result = { site_visit_id: v.site_visit_id };
        break;
      }
      case "update_visit": {
        const v = find(s.visits, "site_visit_id", p.site_visit_id), l = leadFor(v.lead_id);
        entity = l.lead_id;
        ensureActive(l);
        if (p.visit_status) v.visit_status = choose(p.visit_status, ["Scheduled", "Completed", "Cancelled"], "visit status");
        if (p.starts_at) {
          if (isNaN(Date.parse(p.starts_at)) || Date.parse(p.starts_at) <= Date.parse(now)) throw new Error("Choose a future visit time.");
          v.starts_at = new Date(p.starts_at).toISOString();
          v.ends_at = new Date(Date.parse(p.starts_at) + 36e5).toISOString();
          v.visit_date = day(p.starts_at);
        }
        for (const k of ["visit_notes", "required_documents", "photos_link", "checklist_status"]) if (p[k] !== void 0) v[k] = text(p[k]);
        if (v.photos_link && !/^https:\/\//.test(v.photos_link)) throw new Error("Photo links must use HTTPS.");
        if (v.visit_status === "Completed" && !v.visit_notes) throw new Error("Record the visit findings before completing it.");
        touch(v);
        if (p.starts_at || v.visit_status === "Cancelled") {
          v.calendar_sync_status = "Pending";
          queue("calendar", "calendar:" + v.site_visit_id + ":" + v.version, l.lead_id, { source_id: v.site_visit_id, operation: v.visit_status === "Cancelled" ? "cancel" : "upsert" });
        }
        break;
      }
      case "create_proposal": {
        const l = leadFor(p.lead_id);
        ensureActive(l);
        entity = l.lead_id;
        const amount = Number(p.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a positive proposal amount.");
        const r = { proposal_id: "PR-" + uuid(), lead_id: l.lead_id, client_name: l.client_name, proposal_required: "Yes", boq_status: "Draft", proposal_status: "Draft", revision_requested: "No", final_proposal_shared: "No", approval_status: "Pending", notes: required(p.notes, "Scope and BOQ notes"), amount, currency: "INR", proposal_version: 1, document_url: "", pdf_url: "", document_status: "Pending", sent_at: "", next_followup_date: "", updated_at: now, version: 1 };
        s.proposals.push(r);
        l.current_status = "Proposal";
        touch(l);
        queue("document", "document:" + r.proposal_id + ":1", entity, { source_id: r.proposal_id, proposal_version: r.proposal_version });
        result = { proposal_id: r.proposal_id };
        break;
      }
      case "update_proposal": {
        const r = find(s.proposals, "proposal_id", p.proposal_id), l = leadFor(r.lead_id);
        entity = l.lead_id;
        ensureActive(l);
        if (p.operation === "revise") {
          if (s.deliveries.some((d) => d.source_id === r.proposal_id && ["Sending", "Needs review"].includes(d.status))) throw new Error("Resolve the current proposal delivery before revising.");
          s.deliveries.filter((d) => d.source_id === r.proposal_id && ["Pending", "Claimed"].includes(d.status)).forEach((d) => d.status = "Cancelled");
          r.final_proposal_shared = "No";
          r.sent_at = "";
          r.notes = required(p.notes, "Revised scope");
          if (p.amount !== void 0) {
            if (!Number.isFinite(Number(p.amount)) || Number(p.amount) <= 0) throw new Error("Enter a positive amount.");
            r.amount = Number(p.amount);
          }
          r.proposal_version = Number(r.proposal_version) + 1;
          r.proposal_status = "Draft";
          r.revision_requested = "Yes";
          r.document_status = "Pending";
          r.pdf_url = "";
          r.document_url = "";
          queue("document", "document:" + r.proposal_id + ":" + r.proposal_version, entity, { source_id: r.proposal_id, proposal_version: r.proposal_version });
        } else if (p.operation === "share") {
          if (!r.pdf_url || r.document_status !== "Ready") throw new Error("Generate the proposal document before sharing it.");
          const pdfId = r.pdf_url.match(/\/d\/([^/]+)/)?.[1] || r.pdf_url.match(/[?&]id=([^&]+)/)?.[1];
          if (!pdfId) throw new Error("Invalid PDF file reference.");
          r.proposal_status = "Queued";
          r.approval_status = "Approved";
          queue("email", "proposal:" + r.proposal_id + ":" + r.proposal_version, entity, { purpose: "proposal", source_id: r.proposal_id, proposal_version: r.proposal_version, pdf_file_id: pdfId, to: l.email, subject: "Your solar proposal", body: `Dear ${l.client_name},

Please review your attached solar proposal.

Please reply with questions or requested changes.

Solar EPC Operations Team` });
        } else if (p.operation === "accept") {
          if (r.proposal_status !== "Shared") throw new Error("Share the proposal before recording acceptance.");
          r.proposal_status = "Accepted";
          r.approval_status = "Accepted";
          l.current_status = "Converted";
          stopWork(entity);
        } else if (p.operation === "decline") {
          r.proposal_status = "Declined";
          l.current_status = "Lost";
          stopWork(entity);
        } else throw new Error("Unknown proposal action.");
        touch(r);
        touch(l);
        syncFollowup(l);
        break;
      }
      case "queue_followups": {
        if (!yes(s.config.AUTOMATION_ENABLED)) {
          result = { queued: 0, reason: "Automation is paused" };
          break;
        }
        let count = 0;
        for (const f of s.followups) {
          const l = s.leads.find((x) => x.lead_id === f.lead_id);
          if (isStopped(l) || f.followup_status !== "Pending" || !f.followup_due_date || f.followup_due_date > today || f.channel !== "Email" || !yes(f.automation_enabled)) continue;
          const key = "followup:" + f.followup_id;
          if (s.deliveries.some((d) => d.dedupe_key === key)) continue;
          queue("email", key, f.lead_id, { purpose: "followup", source_id: f.followup_id, to: email(l.email), subject: "Following up on your solar enquiry", body: `Dear ${l.client_name},

We are following up on your solar enquiry. Please let us know a convenient time to discuss your requirements and the next steps.

Solar EPC Operations Team` });
          count++;
        }
        result = { queued: count };
        break;
      }
      case "queue_summary": {
        if (!s.config.MANAGER_EMAIL) {
          result = { queued: 0 };
          break;
        }
        queue("email", "summary:" + today, "", { purpose: "summary", to: email(s.config.MANAGER_EMAIL), subject: "Solar operations summary \xB7 " + today, body: `Enquiries: ${s.leads.length}
Pending follow-ups: ${s.followups.filter((f) => f.followup_status === "Pending").length}
Overdue: ${s.followups.filter((f) => f.followup_status === "Pending" && f.followup_due_date < today).length}
Scheduled visits: ${s.visits.filter((v) => v.visit_status === "Scheduled").length}
Shared proposals: ${s.proposals.filter((r) => r.proposal_status === "Shared").length}` });
        result = { queued: 1 };
        break;
      }
      case "claim_delivery": {
        if (!yes(s.config.AUTOMATION_ENABLED)) {
          result = { task: null, reason: "Automation is paused" };
          break;
        }
        s.deliveries.filter((d2) => ["Claimed", "Sending"].includes(d2.status) && Date.parse(now) - Date.parse(d2.claimed_at) > 15 * 6e4).forEach((d2) => {
          d2.status = d2.status === "Sending" ? "Needs review" : "Pending";
          d2.error_message = d2.status === "Needs review" ? "Delivery confirmation missing; check the provider before retrying." : "";
        });
        const d = s.deliveries.find((d2) => d2.kind === p.kind && d2.status === "Pending" && (!d2.lead_id || !isStopped(s.leads.find((l) => l.lead_id === d2.lead_id))));
        if (!d) {
          result = { task: null };
          break;
        }
        d.status = "Claimed";
        d.claim_token = uuid();
        d.claimed_at = now;
        d.attempt_count = Number(d.attempt_count || 0) + 1;
        touch(d);
        result = { task: d };
        break;
      }
      case "begin_delivery": {
        const d = find(s.deliveries, "delivery_id", p.delivery_id);
        if (d.status !== "Claimed" || d.claim_token !== p.claim_token) throw new Error("Delivery claim is no longer valid.");
        if (!yes(s.config.AUTOMATION_ENABLED)) {
          d.status = "Pending";
          d.claim_token = "";
          d.claimed_at = "";
          result = { task: null };
          break;
        }
        if (d.lead_id && isStopped(s.leads.find((l) => l.lead_id === d.lead_id))) {
          d.status = "Cancelled";
          result = { task: null };
          break;
        }
        const body = JSON.parse(d.payload_json);
        if (body.purpose === "followup") {
          const f = s.followups.find((f2) => f2.followup_id === body.source_id);
          if (!f || f.followup_status !== "Pending" || f.channel !== "Email" || !yes(f.automation_enabled) || f.followup_due_date > today) {
            d.status = "Cancelled";
            result = { task: null };
            break;
          }
        }
        if (d.kind === "document" || body.purpose === "proposal") {
          const r = find(s.proposals, "proposal_id", body.source_id);
          if (Number(r.proposal_version) !== Number(body.proposal_version)) {
            d.status = "Cancelled";
            result = { task: null };
            break;
          }
        }
        if (d.kind === "email") body.to = email(s.config.SEND_MODE === "LIVE" ? body.to : s.config.TEST_RECEIVER_EMAIL);
        if (d.kind === "calendar") {
          const v = find(s.visits, "site_visit_id", body.source_id);
          body.visit = v;
          body.operation = v.visit_status === "Cancelled" ? "cancel" : "upsert";
          body.calendar_id = s.config.SEND_MODE === "LIVE" ? s.config.CALENDAR_ID : s.config.TEST_CALENDAR_ID;
          if (!body.calendar_id) throw new Error("Set a test calendar before calendar delivery.");
        }
        if (d.kind === "document") body.proposal = find(s.proposals, "proposal_id", body.source_id);
        d.status = "Sending";
        touch(d);
        result = { task: { ...d, payload: body, send_mode: s.config.SEND_MODE } };
        break;
      }
      case "reconcile_delivery":
      case "finish_delivery": {
        const d = find(s.deliveries, "delivery_id", p.delivery_id);
        if (action.type === "reconcile_delivery") {
          if (d.status !== "Needs review") throw new Error("Only uncertain deliveries can be reconciled.");
          required(p.note, "Verification note");
          if (p.resolution === "retry") {
            d.status = "Pending";
            d.error_message = "Operator verified retry: " + p.note;
            touch(d);
            break;
          }
          if (p.resolution !== "sent") throw new Error("Choose a valid resolution.");
          required(p.provider_id, "Provider message, event or document ID");
          if (d.kind === "document") {
            required(p.document_url, "Document URL");
            required(p.pdf_url, "PDF URL");
          }
          d.status = "Sending";
          p.claim_token = d.claim_token;
          p.ok = true;
        }
        if (d.status === "Sent") {
          result = { duplicate: true };
          break;
        }
        if (d.status !== "Sending" || d.claim_token !== p.claim_token) throw new Error("Delivery claim is no longer valid.");
        d.status = p.ok ? "Sent" : "Needs review";
        d.sent_at = p.ok ? now : "";
        d.provider_id = text(p.provider_id);
        d.error_message = p.ok ? "" : text(p.error_message) || "Provider outcome uncertain. Check before retrying.";
        touch(d);
        entity = d.lead_id;
        if (p.ok) {
          const payload = JSON.parse(d.payload_json), l = s.leads.find((l2) => l2.lead_id === d.lead_id);
          if (payload.purpose === "acknowledgement" && l) {
            l.acknowledgement_sent_at = now;
            l.last_action = "Acknowledgement sent";
            touch(l);
          }
          if (payload.purpose === "followup") {
            const f = find(s.followups, "followup_id", payload.source_id);
            f.followup_status = "Completed";
            f.last_email_sent_at = now;
            f.completed_at = now;
            f.outcome = "Email sent; await response";
            touch(f);
            if (l) syncFollowup(l);
          }
          if (payload.purpose === "proposal") {
            const r = find(s.proposals, "proposal_id", payload.source_id);
            r.proposal_status = "Shared";
            r.final_proposal_shared = "Yes";
            r.sent_at = now;
            r.next_followup_date = addDays(today, 3);
            touch(r);
            if (l && !isStopped(l)) addFollowup(l, r.next_followup_date);
          }
          if (d.kind === "calendar") {
            const v = find(s.visits, "site_visit_id", payload.source_id);
            v.calendar_event_id = text(p.provider_id);
            v.calendar_sync_status = "Synced";
            touch(v);
          }
          if (d.kind === "document") {
            const r = find(s.proposals, "proposal_id", payload.source_id);
            r.document_url = text(p.document_url);
            r.pdf_url = text(p.pdf_url);
            r.document_status = "Ready";
            touch(r);
          }
        }
        break;
      }
      default:
        throw new Error("Unsupported action: " + action.type);
    }
    if (JSON.stringify(s) === JSON.stringify(input)) return { state: s, result };
    s.activity.push({ event_id: "EV-" + uuid(), request_id: action.request_id, lead_id: entity, action: action.type, actor, created_at: now, details: JSON.stringify({ id: entity, summary: p.outcome || p.operation || p.note || "" }) });
    s.version = Number(s.version || 0) + 1;
    return { state: s, result };
  }
  function demoWorkspace(now = (/* @__PURE__ */ new Date()).toISOString()) {
    let s = emptyWorkspace();
    s.team = [{ team_member: "Rahul Sharma", role: "Sales Executive", project_type_supported: "Residential", active_status: "Active", location: "Delhi NCR" }, { team_member: "Priya Mehta", role: "Sales Manager", project_type_supported: "Commercial", active_status: "Active", location: "Pan India" }, { team_member: "Amit Verma", role: "Site Engineer", project_type_supported: "Institutional", active_status: "Active", location: "Delhi NCR" }, { team_member: "Neha Singh", role: "EPC Coordinator", project_type_supported: "Industrial", active_status: "Active", location: "Pan India" }];
    const rows = [["Mira Shah", "Aster Logistics", "Commercial", "Gurugram", "100 kW"], ["Dev Sethi", "Lakeview Residence", "Residential", "Delhi", "5 kW"], ["Sana Ali", "Northstar Foods", "Industrial", "Noida", "250 kW"], ["Kabir Rao", "Cedar School", "Institutional", "Faridabad", "50 kW"], ["Rhea Jain", "Harbour Offices", "Commercial", "Pune", "75 kW"], ["Ishaan Patel", "Patel Residence", "Residential", "Ahmedabad", "3 kW"], ["Neel Kapoor", "Summit Works", "Industrial", "Jaipur", "150 kW"], ["Aditi Das", "Orion Retail", "Commercial", "Mumbai", "35 kW"]];
    rows.forEach((r, i) => {
      s = applyAction(s, { type: "create_lead", request_id: "demo-" + i, payload: { client_name: r[0], company_name: r[1], email: "demo" + i + "@example.com", location: r[3], project_type: r[2], estimated_capacity: r[4], budget_range: i < 4 ? "\u20B910\u201325 lakhs" : "Not sure", timeline: i < 3 ? "Within 1 month" : "1-3 months", site_visit_required: i % 2 ? "No" : "Yes", electricity_bill_available: "Yes", message: "Please help us plan the next steps for this solar project." } }, "Sample workspace", now).state;
      s.followups[i].followup_due_date = addDays(day(now), i < 2 ? -1 : i < 5 ? 0 : 2);
      s.leads[i].next_followup_date = s.followups[i].followup_due_date;
    });
    s = applyAction(s, { type: "schedule_visit", request_id: "demo-visit", payload: { lead_id: s.leads[0].lead_id, assigned_engineer: "Amit Verma", starts_at: new Date(Date.parse(now) + 864e5).toISOString(), required_documents: "Electricity bill and roof layout" } }, "Sample workspace", now).state;
    s = applyAction(s, { type: "create_proposal", request_id: "demo-proposal", payload: { lead_id: s.leads[2].lead_id, amount: 42e5, notes: "250 kW rooftop installation. Scope includes panels, inverters, mounting structures and installation. Sample estimate only." } }, "Sample workspace", now).state;
    return s;
  }
  return __toCommonJS(solar_core_exports);
})();
