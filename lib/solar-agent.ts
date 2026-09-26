import { google } from '@ai-sdk/google';
import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import type { Workspace } from '@/lib/solar-core';
import { customerDetails,delayedProjects,explainStall,findCustomers,knowledgeSearch,listTasks,operationsOverview,projectDetails,projectStatus,relatedRecords,type ToolResult } from '@/lib/solar-agent-data';

export type AgentTrace={tool:string;summary:string;sources:string[];duration_ms:number;status:'complete'|'error'};
export type AgentAnswer={answer:string;traces:AgentTrace[];sources:string[];provider:{configured:boolean;name:string;model:string};readonly:true};

export const solarModelName=()=>process.env.SOLAR_AI_MODEL?.trim()||'gemini-3.5-flash';
export const solarAIConfigured=()=>Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
const unique=(items:string[])=>[...new Set(items)];
function transientProviderFailure(error:unknown):boolean{
 const candidate=error as {statusCode?:number;status?:number;message?:string;cause?:unknown}|null;
 const status=candidate?.statusCode??candidate?.status;
 if(status===429||status===500||status===502||status===503||status===504||status===529)return true;
 if(typeof candidate?.message==='string'&&/high demand|overloaded|temporarily unavailable|resource exhausted|rate limit|quota exceeded|timeout|timed out/i.test(candidate.message))return true;
 return candidate?.cause?transientProviderFailure(candidate.cause):false;
}

function tracked(name:string,traces:AgentTrace[],run:()=>ToolResult){
 const started=Date.now();
 try{const result=run();traces.push({tool:name,summary:result.summary,sources:result.sources,duration_ms:Date.now()-started,status:'complete'});return result.data;}
 catch(error){traces.push({tool:name,summary:error instanceof Error?error.message:'Tool failed.',sources:[],duration_ms:Date.now()-started,status:'error'});throw error;}
}

export async function answerWithSolarOps(state:Workspace,question:string):Promise<AgentAnswer>{
 if(!solarAIConfigured())return answerWithGroundedFallback(state,question);
 const traces:AgentTrace[]=[];
 const tools={
  search_customers:tool({description:'Search customers/projects by name, company, location, ID, type, capacity, email, or phone.',inputSchema:z.object({query:z.string()}),execute:async({query})=>tracked('search_customers',traces,()=>findCustomers(state,query))}),
  get_customer:tool({description:'Retrieve a customer profile after resolving its customer_id.',inputSchema:z.object({customer_id:z.string()}),execute:async({customer_id})=>tracked('get_customer',traces,()=>customerDetails(state,customer_id))}),
  get_project_details:tool({description:'Retrieve all project, task, survey, proposal, and intelligence details for a customer_id.',inputSchema:z.object({customer_id:z.string()}),execute:async({customer_id})=>tracked('get_project_details',traces,()=>projectDetails(state,customer_id))}),
  get_project_status:tool({description:'Retrieve the current stage, latest records, task counts, and next task.',inputSchema:z.object({customer_id:z.string()}),execute:async({customer_id})=>tracked('get_project_status',traces,()=>projectStatus(state,customer_id))}),
  list_delayed_projects:tool({description:'Identify active projects with overdue tasks, missing proposal work after a completed survey, draft proposal blockage, or missing required information.',inputSchema:z.object({}),execute:async()=>tracked('list_delayed_projects',traces,()=>delayedProjects(state))}),
  explain_project_stall:tool({description:'Explain why a project may be stalled using only recorded project evidence and recommend one unexecuted next action.',inputSchema:z.object({customer_id:z.string()}),execute:async({customer_id})=>tracked('explain_project_stall',traces,()=>explainStall(state,customer_id))}),
  get_project_records:tool({description:'Retrieve task, site-survey, or proposal records for a project.',inputSchema:z.object({customer_id:z.string(),kind:z.enum(['tasks','site-surveys','proposals'])}),execute:async({customer_id,kind})=>tracked('get_project_records',traces,()=>relatedRecords(state,customer_id,kind))}),
  list_tasks:tool({description:'List all pending tasks, overdue tasks, or tasks due today across the operation.',inputSchema:z.object({timing:z.enum(['all','overdue','today'])}),execute:async({timing})=>tracked('list_tasks',traces,()=>listTasks(state,timing))}),
  get_operations_overview:tool({description:'Retrieve read-only counts and status distribution for the whole Solar operation.',inputSchema:z.object({}),execute:async()=>tracked('get_operations_overview',traces,()=>operationsOverview(state))}),
  search_solar_sop:tool({description:'Retrieve relevant synthetic Solar SOP and policy passages for process questions.',inputSchema:z.object({query:z.string()}),execute:async({query})=>tracked('search_solar_sop',traces,()=>knowledgeSearch(query))}),
 };
 const agent=new ToolLoopAgent({model:google(solarModelName()),instructions:`You are SolarOps AI, a read-only operations assistant. Answer only from tool results. Resolve a customer with search_customers before using an ID unless the ID is explicitly present. Use operational tools for claims about customers or projects and search_solar_sop for process guidance. Distinguish recorded facts from inferences. Never expose internal reasoning. Never claim that you called, emailed, scheduled, changed, approved, or executed anything. Any next action must be labeled a recommendation and say it was not executed. Be concise, specific, and use markdown. End with a short Sources line naming the tool-provided source labels.`,tools,stopWhen:stepCountIs(8)});
 try{
  const result=await agent.generate({prompt:question});
  return {answer:result.text||'I could not produce a grounded answer from the available read-only data.',traces,sources:unique(traces.flatMap(x=>x.sources)),provider:{configured:true,name:'Google Gemini',model:solarModelName()},readonly:true};
 }catch(error){
  if(!transientProviderFailure(error))throw error;
  const fallback=answerWithGroundedFallback(state,question);
  return {...fallback,answer:`Gemini is temporarily unavailable. This answer uses the read-only demo records and SOPs.\n\n${fallback.answer}`,provider:{configured:true,name:'Grounded demo fallback (Gemini unavailable)',model:fallback.provider.model}};
 }
}

function resolveCustomer(state:Workspace,question:string){
 const q=question.toLowerCase();
 return state.leads.find(l=>[l.lead_id,l.client_name,l.company_name].some(v=>String(v||'').toLowerCase().includes(q)||q.includes(String(v||'').toLowerCase())));
}

function renderProject(result:any){
 if(!result)return 'I could not find a matching synthetic customer or project.';
 const e=result.evidence;
 return `### ${result.project}\n\n**Status:** ${result.status}  \n**Owner:** ${result.owner}\n\n**Why it may be stalled:** ${result.reason}\n\n**Evidence:** ${e.overdue_tasks?.length?`${e.overdue_tasks.length} overdue task(s); earliest: ${e.overdue_tasks[0].action} (${e.overdue_tasks[0].due}).`:e.latest_site_survey?`Latest site survey: ${e.latest_site_survey.status} on ${e.latest_site_survey.date}.`:e.latest_proposal?`Latest proposal: ${e.latest_proposal.status}.`:'No dated blocker is recorded.'}\n\n**Recommended next action:** ${result.recommended_next_action}\n\n*Not executed — this agent is read-only.*`;
}

export function answerWithGroundedFallback(state:Workspace,question:string):AgentAnswer{
 const traces:AgentTrace[]=[];const q=question.toLowerCase();let answer='';
 const run=(name:string,fn:()=>ToolResult)=>tracked(name,traces,fn) as any;
 const customer=resolveCustomer(state,question);
 if(/sop|what should|process|after a site|survey process|warranty|payment milestone|escalat/.test(q)){
  const docs=run('search_solar_sop',()=>knowledgeSearch(question));answer=docs.length?`### SOP guidance\n\n${docs.map((d:any)=>`**${d.title}** — ${d.content}`).join('\n\n')}\n\n**Recommended next action:** Apply the relevant control to the project record and assign a dated owner. *Not executed — this agent is read-only.*`:'No matching SOP passage was found.';
 }else if(/follow.up today|tasks? due today|due today/.test(q)&&!customer){
  const rows=run('list_tasks',()=>listTasks(state,'today'));answer=`### Follow-ups due today\n\n${rows.length?rows.map((r:any)=>`- **${r.project}** — ${r.next_action} (owner: ${r.assigned_to})`).join('\n'):'No pending follow-ups are due today.'}\n\n*Read-only result; no action was executed.*`;
 }else if(/waiting for proposals?|without proposals?|survey.*proposal/.test(q)&&!customer){
  const rows=run('list_delayed_projects',()=>delayedProjects(state)).filter((r:any)=>/proposal/i.test(r.reason+r.recommended_next_action));answer=`### Projects waiting on proposal work\n\n${rows.length?rows.map((r:any)=>`- **${r.project}**: ${r.reason} **Recommendation:** ${r.recommended_next_action}`).join('\n'):'No project is currently identified as waiting on proposal work.'}\n\n*Recommendations only; no action was executed.*`;
 }else if(/overdue|delayed|blocked|stalled|need attention/.test(q)&&!customer){
  const rows=run('list_delayed_projects',()=>delayedProjects(state));answer=`### Delayed or blocked projects\n\n${rows.length?rows.map((r:any)=>`- **${r.project}** (${r.status}): ${r.reason} **Recommendation:** ${r.recommended_next_action}`).join('\n'):'No delayed active projects were identified.'}\n\n*Recommendations only; no action was executed.*`;
 }else if(customer&&/why|stalled|delay|blocked|happening|forward|status|project/.test(q)){
  run('search_customers',()=>findCustomers(state,customer.client_name));answer=renderProject(run('explain_project_stall',()=>explainStall(state,customer.lead_id)));
 }else if(customer&&/survey|visit|proposal|task|follow/.test(q)){
  run('search_customers',()=>findCustomers(state,customer.client_name));const kind=/survey|visit/.test(q)?'site-surveys':/proposal/.test(q)?'proposals':'tasks';const rows=run('get_project_records',()=>relatedRecords(state,customer.lead_id,kind));answer=`### ${customer.company_name||customer.client_name}\n\nFound ${rows.length} ${kind} record(s).\n\n\`\`\`json\n${JSON.stringify(rows,null,2)}\n\`\`\`\n\n*Read-only result; no action was executed.*`;
 }else if(customer){
  run('search_customers',()=>findCustomers(state,customer.client_name));const details=run('get_customer',()=>customerDetails(state,customer.lead_id));answer=`### ${details.project}\n\n- Customer: ${details.customer}\n- Location: ${details.location}\n- System: ${details.project_type}, ${details.capacity}\n- Status: ${details.status}\n- Owner: ${details.owner}\n- Next recorded direction: ${details.suggested_next_action}\n\n*Read-only result; no action was executed.*`;
 }else if(/overview|operation|pipeline|how many|summary/.test(q)){
  const d=run('get_operations_overview',()=>operationsOverview(state));answer=`### Solar operations snapshot\n\n- ${d.open_projects} open projects out of ${d.total_projects}\n- ${d.overdue_tasks} overdue tasks; ${d.tasks_due_today} due today\n- ${d.scheduled_site_surveys} scheduled site surveys\n- ${d.draft_proposals} draft and ${d.shared_proposals} shared proposals\n\nSolarOps AI is read-only; n8n actions are disabled.`;
 }else{
  const matches=run('search_customers',()=>findCustomers(state,question));answer=matches.length?`I found ${matches.length} possible synthetic customer/project matches:\n\n${matches.map((x:any)=>`- **${x.project}** — ${x.customer}, ${x.location}, ${x.status}`).join('\n')}\n\nAsk for a project status or why it may be stalled.`:'I could not match that question to a synthetic customer or project. Try a customer name, company, location, “delayed projects,” or an SOP question.';
 }
 const sources=unique(traces.flatMap(x=>x.sources));answer+=`\n\n**Sources:** ${sources.join(', ')||'No source matched'}`;
 return {answer,traces,sources,provider:{configured:false,name:'Grounded demo engine',model:'deterministic-readonly-v1'},readonly:true};
}
