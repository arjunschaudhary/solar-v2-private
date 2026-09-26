import { day, isStopped, type Row, type Workspace } from '@/lib/solar-core';
import { searchKnowledge } from '@/lib/solar-knowledge';

export type ToolResult={data:unknown;summary:string;sources:string[]};
const text=(v:unknown)=>String(v??'').trim();
const projectName=(lead:Row)=>lead.company_name||lead.client_name;
const sourceNames={lead:'Enquiry_Master',intel:'AI_Lead_Intelligence',task:'Followup_Tracker',visit:'Site_Visit_Tracker',proposal:'Proposal_Tracker'};

export function findCustomers(state:Workspace,query:string):ToolResult{
 const q=query.trim().toLowerCase();
 const rows=state.leads.filter(l=>!q||[l.lead_id,l.client_name,l.company_name,l.email,l.phone,l.location,l.project_type,l.estimated_capacity,l.current_status,l.assigned_to].some(v=>text(v).toLowerCase().includes(q))).slice(0,12).map(l=>({customer_id:l.lead_id,customer:l.client_name,project:projectName(l),location:l.location,project_type:l.project_type,capacity:l.estimated_capacity,status:l.current_status,owner:l.assigned_to}));
 return {data:rows,summary:`Found ${rows.length} matching synthetic customer${rows.length===1?'':'s'}.`,sources:[sourceNames.lead]};
}

export function customerDetails(state:Workspace,customerId:string):ToolResult{
 const l=state.leads.find(x=>x.lead_id===customerId);if(!l)return {data:null,summary:'No matching customer was found.',sources:[sourceNames.lead]};
 const intel=state.intelligence.find(x=>x.lead_id===customerId);
 return {data:{customer_id:l.lead_id,customer:l.client_name,project:projectName(l),email:l.email,phone:l.phone,location:l.location,project_type:l.project_type,capacity:l.estimated_capacity,budget:l.budget_range,timeline:l.timeline,status:l.current_status,owner:l.assigned_to,last_action:l.last_action,last_action_at:l.last_action_at,notes:l.notes,lead_temperature:intel?.lead_temperature,missing_information:intel?.missing_information,suggested_next_action:intel?.suggested_next_action},summary:`Loaded ${projectName(l)} customer and project profile.`,sources:[sourceNames.lead,sourceNames.intel]};
}

export function projectDetails(state:Workspace,customerId:string):ToolResult{
 const l=state.leads.find(x=>x.lead_id===customerId);if(!l)return {data:null,summary:'No matching project was found.',sources:[sourceNames.lead]};
 const intel=state.intelligence.find(x=>x.lead_id===customerId),tasks=state.followups.filter(x=>x.lead_id===customerId),visits=state.visits.filter(x=>x.lead_id===customerId),proposals=state.proposals.filter(x=>x.lead_id===customerId);
 return {data:{project:{id:l.lead_id,name:projectName(l),customer:l.client_name,status:l.current_status,location:l.location,type:l.project_type,capacity:l.estimated_capacity,budget:l.budget_range,timeline:l.timeline,owner:l.assigned_to,last_action:l.last_action,last_action_at:l.last_action_at,stopped:isStopped(l)},intelligence:intel?{temperature:intel.lead_temperature,urgency:intel.urgency_score,missing_information:intel.missing_information,suggested_next_action:intel.suggested_next_action}:null,tasks,site_surveys:visits,proposals},summary:`Loaded the full read-only project record for ${projectName(l)}.`,sources:[sourceNames.lead,sourceNames.intel,sourceNames.task,sourceNames.visit,sourceNames.proposal]};
}

export function projectStatus(state:Workspace,customerId:string):ToolResult{
 const l=state.leads.find(x=>x.lead_id===customerId);if(!l)return {data:null,summary:'No matching project was found.',sources:[sourceNames.lead]};
 const today=day(),tasks=state.followups.filter(x=>x.lead_id===customerId&&x.followup_status==='Pending'),overdue=tasks.filter(x=>x.followup_due_date&&x.followup_due_date<today),latestVisit=state.visits.filter(x=>x.lead_id===customerId).sort((a,b)=>text(b.updated_at).localeCompare(text(a.updated_at)))[0],latestProposal=state.proposals.filter(x=>x.lead_id===customerId).sort((a,b)=>Number(b.proposal_version)-Number(a.proposal_version))[0];
 return {data:{id:l.lead_id,project:projectName(l),status:l.current_status,owner:l.assigned_to,last_action:l.last_action,last_action_at:l.last_action_at,pending_tasks:tasks.length,overdue_tasks:overdue.length,next_task:tasks.sort((a,b)=>text(a.followup_due_date).localeCompare(text(b.followup_due_date)))[0]||null,latest_site_survey:latestVisit||null,latest_proposal:latestProposal||null},summary:`${projectName(l)} is at ${l.current_status} with ${overdue.length} overdue task${overdue.length===1?'':'s'}.`,sources:[sourceNames.lead,sourceNames.task,sourceNames.visit,sourceNames.proposal]};
}

function diagnose(state:Workspace,l:Row){
 const today=day(),tasks=state.followups.filter(x=>x.lead_id===l.lead_id&&x.followup_status==='Pending'),overdue=tasks.filter(x=>x.followup_due_date&&x.followup_due_date<today),visits=state.visits.filter(x=>x.lead_id===l.lead_id),proposals=state.proposals.filter(x=>x.lead_id===l.lead_id),latestVisit=visits.sort((a,b)=>text(b.updated_at).localeCompare(text(a.updated_at)))[0],latestProposal=proposals.sort((a,b)=>Number(b.proposal_version)-Number(a.proposal_version))[0],intel=state.intelligence.find(x=>x.lead_id===l.lead_id);
 let reason='No explicit blocker is recorded.',next=intel?.suggested_next_action||'Review the project and set a dated next action.';
 if(isStopped(l)){reason=l.manual_stop==='Yes'?'The project has a manual stop.':`The project is closed as ${l.current_status}.`;next='Confirm whether the project should remain closed before any further work.';}
 else if(overdue[0]){reason=`The next recorded task is overdue since ${overdue[0].followup_due_date}: ${overdue[0].next_action}.`;next=`Owner ${overdue[0].assigned_to||l.assigned_to} should complete or reschedule that task and record the outcome.`;}
 else if(latestVisit?.visit_status==='Completed'&&!latestProposal){reason='The site survey is complete, but no proposal record exists.';next='Prepare a proposal from the recorded survey findings.';}
 else if(latestProposal?.proposal_status==='Draft'){reason=`Proposal ${latestProposal.proposal_id} remains in Draft (${latestProposal.document_status||'document status unknown'}).`;next='Resolve the proposal inputs, review the draft, and set a dated share action.';}
 else if(latestProposal?.proposal_status==='Shared'){reason='The proposal is shared and awaiting a recorded customer decision.';next='Complete the scheduled proposal follow-up and record the decision or blocker.';}
 else if(text(intel?.missing_information)&&!/^no major/i.test(text(intel?.missing_information))){reason=`Required information is missing: ${intel?.missing_information}.`;next='Collect the missing information and record a due date.';}
 return {project_id:l.lead_id,project:projectName(l),customer:l.client_name,status:l.current_status,owner:l.assigned_to,reason,evidence:{last_action:l.last_action,last_action_at:l.last_action_at,overdue_tasks:overdue.map(x=>({due:x.followup_due_date,action:x.next_action,owner:x.assigned_to})),latest_site_survey:latestVisit?{status:latestVisit.visit_status,date:latestVisit.visit_date,findings:latestVisit.visit_notes}:null,latest_proposal:latestProposal?{status:latestProposal.proposal_status,document_status:latestProposal.document_status,version:latestProposal.proposal_version,sent_at:latestProposal.sent_at}:null},recommended_next_action:next,execution_status:'Not executed — recommendation only'};
}

export function delayedProjects(state:Workspace):ToolResult{
 const rows=state.leads.filter(l=>!isStopped(l)).map(l=>diagnose(state,l)).filter((r:any)=>r.evidence.overdue_tasks.length||/complete, but no proposal|remains in Draft|missing:/i.test(r.reason));
 return {data:rows,summary:`Identified ${rows.length} delayed or blocked active project${rows.length===1?'':'s'} from recorded tasks and stage data.`,sources:[sourceNames.lead,sourceNames.intel,sourceNames.task,sourceNames.visit,sourceNames.proposal]};
}

export function explainStall(state:Workspace,customerId:string):ToolResult{
 const l=state.leads.find(x=>x.lead_id===customerId);const result=l?diagnose(state,l):null;
 return {data:result,summary:result?`Built an evidence-based stall explanation for ${result.project}.`:'No matching project was found.',sources:[sourceNames.lead,sourceNames.intel,sourceNames.task,sourceNames.visit,sourceNames.proposal]};
}

export function relatedRecords(state:Workspace,customerId:string,kind:'tasks'|'site-surveys'|'proposals'):ToolResult{
 const map={tasks:{rows:state.followups.filter(x=>x.lead_id===customerId),source:sourceNames.task},'site-surveys':{rows:state.visits.filter(x=>x.lead_id===customerId),source:sourceNames.visit},proposals:{rows:state.proposals.filter(x=>x.lead_id===customerId),source:sourceNames.proposal}}[kind];
 return {data:map.rows,summary:`Loaded ${map.rows.length} ${kind} record${map.rows.length===1?'':'s'}.`,sources:[map.source]};
}

export function listTasks(state:Workspace,timing:'all'|'overdue'|'today'='all'):ToolResult{
 const today=day();
 const rows=state.followups.filter(x=>x.followup_status==='Pending'&&(timing==='all'||timing==='overdue'&&x.followup_due_date<today||timing==='today'&&x.followup_due_date===today)).sort((a,b)=>text(a.followup_due_date).localeCompare(text(b.followup_due_date))).map(task=>{const lead=state.leads.find(x=>x.lead_id===task.lead_id);return {...task,project:lead?projectName(lead):task.client_name,project_status:lead?.current_status};});
 return {data:rows,summary:`Loaded ${rows.length} ${timing==='all'?'pending':timing} task${rows.length===1?'':'s'}.`,sources:[sourceNames.task,sourceNames.lead]};
}

export function operationsOverview(state:Workspace):ToolResult{
 const today=day(),pending=state.followups.filter(x=>x.followup_status==='Pending');const data={total_projects:state.leads.length,open_projects:state.leads.filter(x=>!isStopped(x)).length,by_status:Object.fromEntries(['Qualified','Contacted','Site Visit','Proposal','Converted','Lost','Stopped'].map(status=>[status,state.leads.filter(x=>x.current_status===status).length])),overdue_tasks:pending.filter(x=>x.followup_due_date<today).length,tasks_due_today:pending.filter(x=>x.followup_due_date===today).length,scheduled_site_surveys:state.visits.filter(x=>x.visit_status==='Scheduled').length,draft_proposals:state.proposals.filter(x=>x.proposal_status==='Draft').length,shared_proposals:state.proposals.filter(x=>x.proposal_status==='Shared').length,automation:'Disabled for SolarOps AI'};
 return {data,summary:`Summarized ${data.total_projects} projects and ${pending.length} pending tasks.`,sources:[sourceNames.lead,sourceNames.task,sourceNames.visit,sourceNames.proposal]};
}

export function knowledgeSearch(query:string):ToolResult{
 const docs=searchKnowledge(query).map(({score,...doc})=>doc);
 return {data:docs,summary:`Retrieved ${docs.length} synthetic Solar SOP source${docs.length===1?'':'s'}.`,sources:docs.map(x=>x.title)};
}
