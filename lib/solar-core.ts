export type Row = Record<string, any>;
export type Workspace = { leads: Row[]; intelligence: Row[]; team: Row[]; followups: Row[]; visits: Row[]; proposals: Row[]; deliveries: Row[]; activity: Row[]; config: Row; version: number };
export type Action = { type: string; request_id: string; payload: Row };
export const TABLES: Record<string, string> = { leads:'Enquiry_Master', intelligence:'AI_Lead_Intelligence', team:'Team_Assignment', followups:'Followup_Tracker', visits:'Site_Visit_Tracker', proposals:'Proposal_Tracker', deliveries:'Delivery_Queue', activity:'Activity_Log' };
export const KEYS: Record<string,string> = {leads:'lead_id', intelligence:'lead_id', team:'team_member', followups:'followup_id', visits:'site_visit_id', proposals:'proposal_id', deliveries:'delivery_id', activity:'event_id'};
export const TERMINAL = ['Converted','Lost','Stopped'];
export const day = (date: string | Date = new Date()) => new Date(new Date(date).getTime()+19800000).toISOString().slice(0,10);
export const addDays = (date: string, n: number) => new Date(new Date(date+'T12:00:00+05:30').getTime()+n*86400000).toISOString().slice(0,10);
const text = (v:any) => String(v??'').trim();
const yes = (v:any) => v===true || text(v).toLowerCase()==='yes' || text(v).toLowerCase()==='true';
export const isStopped = (lead:Row|undefined) => !lead || yes(lead.manual_stop) || TERMINAL.includes(lead.current_status);
const required = (v:any, label:string) => {if(!text(v)) throw new Error(label+' is required.'); return text(v);};
const email = (v:any) => {const s=required(v,'Email').toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('Enter a valid email address.'); return s;};
const validDay = (v:any) => {const s=required(v,'Date'); if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||isNaN(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s) throw new Error('Enter a valid date.'); return s;};
const choose = (v:any, values:string[], label:string) => {if(!values.includes(v))throw new Error('Invalid '+label+'.');return v;};
const uuid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)});
export const emptyWorkspace = ():Workspace => ({leads:[],intelligence:[],team:[],followups:[],visits:[],proposals:[],deliveries:[],activity:[],config:{SEND_MODE:'TEST',AUTOMATION_ENABLED:'No',TEST_RECEIVER_EMAIL:'',MANAGER_EMAIL:'',CALENDAR_ID:'primary',PROPOSAL_FOLDER_ID:''},version:0});
export function qualify(p:Row){
 const timeline=text(p.timeline).toLowerCase(),capacity=text(p.estimated_capacity),budget=text(p.budget_range);
 let score=3+(timeline.includes('immediately')?4:timeline.includes('within 1 month')?3:timeline.includes('1-3 months')?2:timeline.includes('3-6 months')?1:0);
 const knownCapacity=!!capacity && !/not sure|unknown/i.test(capacity);
 score+=Number(yes(p.site_visit_required))+Number(yes(p.electricity_bill_available))+Number(knownCapacity)+Number(!!budget&&!/not sure|unknown/i.test(budget))+Number(text(p.message).length>30);
 score=Math.min(score,10);
 const missing=[!p.location&&'Location',!knownCapacity&&'Estimated capacity',(!budget||/not sure/i.test(budget))&&'Budget range',!yes(p.electricity_bill_available)&&'Electricity bill'].filter(Boolean).join(', ');
 return {urgency_score:score,lead_temperature:score>=7?'Hot':score>=5?'Warm':'Cold',project_category:p.project_type||'Solar',client_summary:`${p.company_name||p.client_name}: ${p.project_type||'solar'} enquiry in ${p.location||'location to confirm'}.`,missing_information:missing||'No major missing information',suggested_next_action:missing?'Collect missing project details.':'Confirm the next sales or site action.',ai_used:'No'};
}
export function applyAction(input:Workspace, action:Action, actor='Operator', now=new Date().toISOString()):{state:Workspace;result:Row}{
 const s:Workspace=JSON.parse(JSON.stringify(input)); const p=action.payload||{};
 required(action.request_id,'Request identifier');
 if(s.activity.some(x=>x.request_id===action.request_id)) return {state:s,result:{duplicate:true}};
 const today=day(now);let result:Row={}; let entity='';
 const find=(list:Row[],key:string,id:any)=>{const r=list.find(x=>x[key]===id);if(!r)throw new Error('Record not found. Refresh the workspace.');return r;};
 const leadFor=(id:any)=>find(s.leads,'lead_id',id);
 const touch=(r:Row)=>{r.updated_at=now;r.version=Number(r.version||0)+1;};
 const ensureActive=(r:Row)=>{if(isStopped(r))throw new Error('This enquiry is closed or stopped. Reopen it before adding work.');};
 const queue=(kind:string,key:string,lead_id:string,payload:Row)=>{
  const existing=s.deliveries.find(d=>d.dedupe_key===key);if(existing)return existing;
  const d={delivery_id:'D-'+uuid(),dedupe_key:key,kind,lead_id,status:'Pending',created_at:now,updated_at:now,payload_json:JSON.stringify(payload),attempt_count:0,claim_token:'',claimed_at:'',sent_at:'',provider_id:'',error_message:'',source_id:payload.source_id||''};s.deliveries.push(d);return d;
 };
 const syncFollowup=(lead:Row)=>{const pending=s.followups.filter(f=>f.lead_id===lead.lead_id&&f.followup_status==='Pending').sort((a,b)=>text(a.followup_due_date).localeCompare(text(b.followup_due_date)));lead.next_followup_date=pending[0]?.followup_due_date||'';lead.escalation_flag=pending.some(f=>f.followup_due_date&&f.followup_due_date<today)?'Yes':'No';};
 const stopWork=(id:string)=>{s.followups.filter(f=>f.lead_id===id&&f.followup_status==='Pending').forEach(f=>{f.followup_status='Stopped';touch(f);});s.deliveries.filter(d=>d.lead_id===id&&['Pending','Claimed'].includes(d.status)).forEach(d=>{d.status='Cancelled';touch(d);});};
 const addFollowup=(lead:Row,due:string,channel='Manual',enabled='No')=>{const f={followup_id:'FU-'+uuid(),lead_id:lead.lead_id,client_name:lead.client_name,email:lead.email,assigned_to:lead.assigned_to,followup_stage:'Follow-up '+(s.followups.filter(f=>f.lead_id===lead.lead_id).length+1),followup_due_date:validDay(due),followup_status:'Pending',last_email_sent_at:'',next_action:p.next_action||'Contact client and record the outcome',notes:'',channel,automation_enabled:enabled,completed_at:'',outcome:'',updated_at:now,version:1};s.followups.push(f);syncFollowup(lead);return f;};
 switch(action.type){
 case 'create_lead':{
  const key=text(p.lead_key)||'WEB|'+action.request_id;const existing=s.leads.find(l=>l.lead_key===key);if(existing){result={lead_id:existing.lead_id,duplicate:true};break;}
  const q=qualify(p); const project=choose(p.project_type,['Residential','Commercial','Industrial','Institutional'],'project type');
  const owners=s.team.filter(t=>!/engineer/i.test(t.role));
  let assignee=owners.find(t=>t.active_status==='Active'&&text(t.project_type_supported).toLowerCase()===project.toLowerCase())?.team_member||owners.find(t=>t.active_status==='Active')?.team_member||'Unassigned';
  const lead={lead_id:'SEPC-'+uuid(),lead_key:key,created_at:p.created_at||now,client_name:required(p.client_name,'Client name'),company_name:text(p.company_name),email:email(p.email),phone:text(p.phone).replace(/\D/g,''),location:required(p.location,'Location'),project_type:project,estimated_capacity:text(p.estimated_capacity),budget_range:text(p.budget_range),timeline:text(p.timeline),electricity_bill_available:text(p.electricity_bill_available),site_visit_required:yes(p.site_visit_required)?'Yes':'No',message:text(p.message),lead_source:p.lead_source||'Web app',current_status:'Qualified',assigned_to:assignee,next_followup_date:'',escalation_flag:'No',last_action:'Enquiry received',last_action_at:now,notes:'',manual_stop:'No',acknowledgement_sent_at:'',updated_at:now,version:1};
  let intelligence={...q};if(p.ai){const a=p.ai; if(!['Hot','Warm','Cold'].includes(a.lead_temperature)||!Number.isFinite(Number(a.urgency_score))||Number(a.urgency_score)<1||Number(a.urgency_score)>10)throw new Error('AI output needs review: invalid temperature or score.');intelligence={...q,...a,ai_used:'Yes'};}
  s.leads.push(lead);s.intelligence.push({...intelligence,lead_id:lead.lead_id,ai_processed_at:now});addFollowup(lead,addDays(today,intelligence.lead_temperature==='Hot'?1:intelligence.lead_temperature==='Warm'?3:7));
  queue('email','ack:'+lead.lead_id,lead.lead_id,{purpose:'acknowledgement',to:lead.email,subject:'Solar enquiry received',body:`Dear ${lead.client_name},\n\nThank you for your ${project.toLowerCase()} solar enquiry in ${lead.location}. Our team will review your requirements and contact you.\n\nSolar EPC Operations Team`});
  entity=lead.lead_id;result={lead_id:entity};break;
 }
 case 'update_lead':{
  const l=leadFor(p.lead_id);entity=l.lead_id;
  if(p.assigned_to!==undefined){if(!s.team.some(t=>t.team_member===p.assigned_to&&t.active_status==='Active'))throw new Error('Choose an active team member.');l.assigned_to=p.assigned_to;s.followups.filter(f=>f.lead_id===entity&&f.followup_status==='Pending').forEach(f=>f.assigned_to=p.assigned_to);}
  if(p.current_status!==undefined)l.current_status=choose(p.current_status,['Qualified','Contacted','Site Visit','Proposal','Converted','Lost','Stopped'],'enquiry status');
  if(p.manual_stop!==undefined)l.manual_stop=yes(p.manual_stop)?'Yes':'No';if(p.notes!==undefined)l.notes=text(p.notes);
  if(isStopped(l))stopWork(entity);syncFollowup(l);l.last_action='Enquiry updated';l.last_action_at=now;touch(l);break;
 }
 case 'add_followup':{const l=leadFor(p.lead_id);ensureActive(l);entity=l.lead_id;result=addFollowup(l,p.due_date,choose(p.channel||'Manual',['Manual','Email'],'channel'),yes(p.automation_enabled)?'Yes':'No');break;}
 case 'complete_followup':{
  const f=find(s.followups,'followup_id',p.followup_id),l=leadFor(f.lead_id);entity=l.lead_id;ensureActive(l);
  if(f.followup_status!=='Pending')throw new Error('This follow-up has already been handled.');
  f.followup_status='Completed';f.outcome=required(p.outcome,'Outcome');f.notes=text(p.notes);f.completed_at=now;touch(f);
  s.deliveries.filter(d=>d.source_id===f.followup_id&&['Pending','Claimed'].includes(d.status)).forEach(d=>d.status='Cancelled');
  if(p.next_due_date)addFollowup(l,p.next_due_date,p.channel||'Manual',yes(p.automation_enabled)?'Yes':'No');syncFollowup(l);l.last_action='Follow-up completed: '+f.outcome;l.last_action_at=now;touch(l);break;
 }
 case 'schedule_visit':{
  const l=leadFor(p.lead_id);ensureActive(l);entity=l.lead_id;const start=required(p.starts_at,'Visit time');if(isNaN(Date.parse(start))||Date.parse(start)<=Date.parse(now))throw new Error('Choose a future visit time.');
  if(!s.team.some(t=>t.team_member===p.assigned_engineer&&t.active_status==='Active'))throw new Error('Choose an active engineer.');
  const v={site_visit_id:'SV-'+uuid(),lead_id:l.lead_id,client_name:l.client_name,assigned_engineer:p.assigned_engineer,visit_date:day(start),checklist_status:'Pending',required_documents:text(p.required_documents),visit_notes:'',photos_link:'',visit_status:'Scheduled',starts_at:new Date(start).toISOString(),ends_at:new Date(Date.parse(start)+3600000).toISOString(),calendar_event_id:'',calendar_sync_status:'Pending',updated_at:now,version:1};s.visits.push(v);l.current_status='Site Visit';touch(l);
  queue('calendar','calendar:'+v.site_visit_id+':1',l.lead_id,{source_id:v.site_visit_id,operation:'upsert'});result={site_visit_id:v.site_visit_id};break;
 }
 case 'update_visit':{
  const v=find(s.visits,'site_visit_id',p.site_visit_id),l=leadFor(v.lead_id);entity=l.lead_id;ensureActive(l);
  if(p.visit_status) v.visit_status=choose(p.visit_status,['Scheduled','Completed','Cancelled'],'visit status');
  if(p.starts_at){if(isNaN(Date.parse(p.starts_at))||Date.parse(p.starts_at)<=Date.parse(now))throw new Error('Choose a future visit time.');v.starts_at=new Date(p.starts_at).toISOString();v.ends_at=new Date(Date.parse(p.starts_at)+3600000).toISOString();v.visit_date=day(p.starts_at);}
  for(const k of ['visit_notes','required_documents','photos_link','checklist_status'])if(p[k]!==undefined)v[k]=text(p[k]);
  if(v.photos_link&&!/^https:\/\//.test(v.photos_link))throw new Error('Photo links must use HTTPS.');
  if(v.visit_status==='Completed'&&!v.visit_notes)throw new Error('Record the visit findings before completing it.');touch(v);
  if(p.starts_at||v.visit_status==='Cancelled'){v.calendar_sync_status='Pending';queue('calendar','calendar:'+v.site_visit_id+':'+v.version,l.lead_id,{source_id:v.site_visit_id,operation:v.visit_status==='Cancelled'?'cancel':'upsert'});}break;
 }
 case 'create_proposal':{
  const l=leadFor(p.lead_id);ensureActive(l);entity=l.lead_id;const amount=Number(p.amount);if(!Number.isFinite(amount)||amount<=0)throw new Error('Enter a positive proposal amount.');
  const r={proposal_id:'PR-'+uuid(),lead_id:l.lead_id,client_name:l.client_name,proposal_required:'Yes',boq_status:'Draft',proposal_status:'Draft',revision_requested:'No',final_proposal_shared:'No',approval_status:'Pending',notes:required(p.notes,'Scope and BOQ notes'),amount,currency:'INR',proposal_version:1,document_url:'',pdf_url:'',document_status:'Pending',sent_at:'',next_followup_date:'',updated_at:now,version:1};s.proposals.push(r);l.current_status='Proposal';touch(l);queue('document','document:'+r.proposal_id+':1',entity,{source_id:r.proposal_id,proposal_version:r.proposal_version});result={proposal_id:r.proposal_id};break;
 }
 case 'update_proposal':{
  const r=find(s.proposals,'proposal_id',p.proposal_id),l=leadFor(r.lead_id);entity=l.lead_id;ensureActive(l);
  if(p.operation==='revise'){if(s.deliveries.some(d=>d.source_id===r.proposal_id&&['Sending','Needs review'].includes(d.status)))throw new Error('Resolve the current proposal delivery before revising.');s.deliveries.filter(d=>d.source_id===r.proposal_id&&['Pending','Claimed'].includes(d.status)).forEach(d=>d.status='Cancelled');r.final_proposal_shared='No';r.sent_at='';r.notes=required(p.notes,'Revised scope');if(p.amount!==undefined){if(!Number.isFinite(Number(p.amount))||Number(p.amount)<=0)throw new Error('Enter a positive amount.');r.amount=Number(p.amount);}r.proposal_version=Number(r.proposal_version)+1;r.proposal_status='Draft';r.revision_requested='Yes';r.document_status='Pending';r.pdf_url='';r.document_url='';queue('document','document:'+r.proposal_id+':'+r.proposal_version,entity,{source_id:r.proposal_id,proposal_version:r.proposal_version});}
  else if(p.operation==='share'){if(!r.pdf_url||r.document_status!=='Ready')throw new Error('Generate the proposal document before sharing it.');const pdfId=r.pdf_url.match(/\/d\/([^/]+)/)?.[1]||r.pdf_url.match(/[?&]id=([^&]+)/)?.[1];if(!pdfId)throw new Error('Invalid PDF file reference.');r.proposal_status='Queued';r.approval_status='Approved';queue('email','proposal:'+r.proposal_id+':'+r.proposal_version,entity,{purpose:'proposal',source_id:r.proposal_id,proposal_version:r.proposal_version,pdf_file_id:pdfId,to:l.email,subject:'Your solar proposal',body:`Dear ${l.client_name},\n\nPlease review your attached solar proposal.\n\nPlease reply with questions or requested changes.\n\nSolar EPC Operations Team`});}
  else if(p.operation==='accept'){if(r.proposal_status!=='Shared')throw new Error('Share the proposal before recording acceptance.');r.proposal_status='Accepted';r.approval_status='Accepted';l.current_status='Converted';stopWork(entity);}
  else if(p.operation==='decline'){r.proposal_status='Declined';l.current_status='Lost';stopWork(entity);}else throw new Error('Unknown proposal action.');touch(r);touch(l);syncFollowup(l);break;
 }
 case 'queue_followups':{
  if(!yes(s.config.AUTOMATION_ENABLED)){result={queued:0,reason:'Automation is paused'};break;}
  let count=0;for(const f of s.followups){const l=s.leads.find(x=>x.lead_id===f.lead_id);if(isStopped(l)||f.followup_status!=='Pending'||!f.followup_due_date||f.followup_due_date>today||f.channel!=='Email'||!yes(f.automation_enabled))continue;
   const key='followup:'+f.followup_id;if(s.deliveries.some(d=>d.dedupe_key===key))continue;
   queue('email',key,f.lead_id,{purpose:'followup',source_id:f.followup_id,to:email(l!.email),subject:'Following up on your solar enquiry',body:`Dear ${l!.client_name},\n\nWe are following up on your solar enquiry. Please let us know a convenient time to discuss your requirements and the next steps.\n\nSolar EPC Operations Team`});count++;}result={queued:count};break;
 }
 case 'queue_summary':{if(!s.config.MANAGER_EMAIL){result={queued:0};break;}queue('email','summary:'+today,'',{purpose:'summary',to:email(s.config.MANAGER_EMAIL),subject:'Solar operations summary · '+today,body:`Enquiries: ${s.leads.length}\nPending follow-ups: ${s.followups.filter(f=>f.followup_status==='Pending').length}\nOverdue: ${s.followups.filter(f=>f.followup_status==='Pending'&&f.followup_due_date<today).length}\nScheduled visits: ${s.visits.filter(v=>v.visit_status==='Scheduled').length}\nShared proposals: ${s.proposals.filter(r=>r.proposal_status==='Shared').length}`});result={queued:1};break;}
 case 'claim_delivery':{
  if(!yes(s.config.AUTOMATION_ENABLED)){result={task:null,reason:'Automation is paused'};break;}
  // Never automatically replay a Sending task: the provider may have accepted it.
  s.deliveries.filter(d=>['Claimed','Sending'].includes(d.status)&&Date.parse(now)-Date.parse(d.claimed_at)>15*60000).forEach(d=>{d.status=d.status==='Sending'?'Needs review':'Pending';d.error_message=d.status==='Needs review'?'Delivery confirmation missing; check the provider before retrying.':'';});
  const d=s.deliveries.find(d=>d.kind===p.kind&&d.status==='Pending'&&(!d.lead_id||!isStopped(s.leads.find(l=>l.lead_id===d.lead_id))));
  if(!d){result={task:null};break;}d.status='Claimed';d.claim_token=uuid();d.claimed_at=now;d.attempt_count=Number(d.attempt_count||0)+1;touch(d);result={task:d};break;
 }
 case 'begin_delivery':{
  const d=find(s.deliveries,'delivery_id',p.delivery_id);if(d.status!=='Claimed'||d.claim_token!==p.claim_token)throw new Error('Delivery claim is no longer valid.');
  if(!yes(s.config.AUTOMATION_ENABLED)){d.status='Pending';d.claim_token='';d.claimed_at='';result={task:null};break;}
  if(d.lead_id&&isStopped(s.leads.find(l=>l.lead_id===d.lead_id))){d.status='Cancelled';result={task:null};break;}
  const body=JSON.parse(d.payload_json);if(body.purpose==='followup'){const f=s.followups.find(f=>f.followup_id===body.source_id);if(!f||f.followup_status!=='Pending'||f.channel!=='Email'||!yes(f.automation_enabled)||f.followup_due_date>today){d.status='Cancelled';result={task:null};break;}}
  if(d.kind==='document'||body.purpose==='proposal'){const r=find(s.proposals,'proposal_id',body.source_id);if(Number(r.proposal_version)!==Number(body.proposal_version)){d.status='Cancelled';result={task:null};break;}}
  if(d.kind==='email')body.to=email(s.config.SEND_MODE==='LIVE'?body.to:s.config.TEST_RECEIVER_EMAIL);
  if(d.kind==='calendar'){const v=find(s.visits,'site_visit_id',body.source_id);body.visit=v;body.operation=v.visit_status==='Cancelled'?'cancel':'upsert';body.calendar_id=s.config.SEND_MODE==='LIVE'?s.config.CALENDAR_ID:s.config.TEST_CALENDAR_ID;if(!body.calendar_id)throw new Error('Set a test calendar before calendar delivery.');}
  if(d.kind==='document')body.proposal=find(s.proposals,'proposal_id',body.source_id);
  d.status='Sending';touch(d);result={task:{...d,payload:body,send_mode:s.config.SEND_MODE}};break;
 }
 case 'reconcile_delivery':
 case 'finish_delivery':{
  const d=find(s.deliveries,'delivery_id',p.delivery_id);if(action.type==='reconcile_delivery'){if(d.status!=='Needs review')throw new Error('Only uncertain deliveries can be reconciled.');required(p.note,'Verification note');if(p.resolution==='retry'){d.status='Pending';d.error_message='Operator verified retry: '+p.note;touch(d);break;}if(p.resolution!=='sent')throw new Error('Choose a valid resolution.');required(p.provider_id,'Provider message, event or document ID');if(d.kind==='document'){required(p.document_url,'Document URL');required(p.pdf_url,'PDF URL');}d.status='Sending';p.claim_token=d.claim_token;p.ok=true;}if(d.status==='Sent'){result={duplicate:true};break;}if(d.status!=='Sending'||d.claim_token!==p.claim_token)throw new Error('Delivery claim is no longer valid.');
  d.status=p.ok?'Sent':'Needs review';d.sent_at=p.ok?now:'';d.provider_id=text(p.provider_id);d.error_message=p.ok?'':text(p.error_message)||'Provider outcome uncertain. Check before retrying.';touch(d);entity=d.lead_id;
  if(p.ok){const payload=JSON.parse(d.payload_json),l=s.leads.find(l=>l.lead_id===d.lead_id);
   if(payload.purpose==='acknowledgement'&&l){l.acknowledgement_sent_at=now;l.last_action='Acknowledgement sent';touch(l);}
   if(payload.purpose==='followup'){const f=find(s.followups,'followup_id',payload.source_id);f.followup_status='Completed';f.last_email_sent_at=now;f.completed_at=now;f.outcome='Email sent; await response';touch(f);if(l)syncFollowup(l);}
   if(payload.purpose==='proposal'){const r=find(s.proposals,'proposal_id',payload.source_id);r.proposal_status='Shared';r.final_proposal_shared='Yes';r.sent_at=now;r.next_followup_date=addDays(today,3);touch(r);if(l&&!isStopped(l))addFollowup(l,r.next_followup_date);}
   if(d.kind==='calendar'){const v=find(s.visits,'site_visit_id',payload.source_id);v.calendar_event_id=text(p.provider_id);v.calendar_sync_status='Synced';touch(v);}
   if(d.kind==='document'){const r=find(s.proposals,'proposal_id',payload.source_id);r.document_url=text(p.document_url);r.pdf_url=text(p.pdf_url);r.document_status='Ready';touch(r);}
  }break;
 }
 default:throw new Error('Unsupported action: '+action.type);
 }
 if(JSON.stringify(s)===JSON.stringify(input))return {state:s,result};
 s.activity.push({event_id:'EV-'+uuid(),request_id:action.request_id,lead_id:entity,action:action.type,actor,created_at:now,details:JSON.stringify({id:entity,summary:p.outcome||p.operation||p.note||''})});s.version=Number(s.version||0)+1;
 return {state:s,result};
}
export function demoWorkspace(now=new Date().toISOString()):Workspace{
 const today=day(now), iso=(offset:number)=>new Date(Date.parse(now)+offset*86400000).toISOString();
 const s=emptyWorkspace();
 s.config={SEND_MODE:'TEST',AUTOMATION_ENABLED:'No',TEST_RECEIVER_EMAIL:'solarops-demo@example.com',MANAGER_EMAIL:'ops-manager@example.com',CALENDAR_ID:'demo-calendar@example.com',TEST_CALENDAR_ID:'demo-test-calendar@example.com',PROPOSAL_FOLDER_ID:''};
 s.team=[
  {team_member:'Rohan Demo',role:'Sales Executive',project_type_supported:'Residential',active_status:'Active',location:'Delhi NCR'},
  {team_member:'Meera Demo',role:'Sales Manager',project_type_supported:'Commercial',active_status:'Active',location:'Pan India'},
  {team_member:'Aarav Demo',role:'Site Engineer',project_type_supported:'Institutional',active_status:'Active',location:'Delhi NCR'},
  {team_member:'Naina Demo',role:'EPC Coordinator',project_type_supported:'Industrial',active_status:'Active',location:'Pan India'},
 ];
 const projects=[
  ['DEMO-001','Rajesh Sharma','Sharma Textiles','Industrial','Faridabad','250 kW','Proposal','Naina Demo','Hot',9,'₹1–2 crore','Immediately','Awaiting finance approval after proposal review.'],
  ['DEMO-002','Priya Kapoor','Kapoor Heights','Residential','Gurugram','8 kW','Site Visit','Rohan Demo','Warm',7,'₹5–10 lakhs','Within 1 month','Roof access approval from the housing society is still pending.'],
  ['DEMO-003','Mira Shah','Aster Logistics','Commercial','Gurugram','100 kW','Contacted','Meera Demo','Hot',8,'₹50–75 lakhs','Within 1 month','Electricity bill and sanctioned-load details have not been received.'],
  ['DEMO-004','Dev Sethi','Lakeview Residence','Residential','Delhi','5 kW','Qualified','Rohan Demo','Warm',6,'₹3–5 lakhs','1-3 months','Customer asked for a follow-up after comparing financing options.'],
  ['DEMO-005','Sana Ali','Northstar Foods','Industrial','Noida','250 kW','Proposal','Naina Demo','Hot',9,'₹1–2 crore','Immediately','Proposal needs a revised structural reinforcement allowance.'],
  ['DEMO-006','Kabir Rao','Cedar School','Institutional','Faridabad','50 kW','Converted','Meera Demo','Warm',7,'₹25–50 lakhs','1-3 months','Proposal accepted; installation handoff is ready.'],
  ['DEMO-007','Rhea Jain','Harbour Offices','Commercial','Pune','75 kW','Site Visit','Meera Demo','Warm',6,'₹50–75 lakhs','1-3 months','Survey completed; proposal scope has not yet been drafted.'],
  ['DEMO-008','Ishaan Patel','Patel Residence','Residential','Ahmedabad','3 kW','Lost','Rohan Demo','Cold',3,'₹2–3 lakhs','Just exploring','Closed after the customer deferred the project.'],
  ['DEMO-009','Neel Kapoor','Summit Works','Industrial','Jaipur','150 kW','Contacted','Naina Demo','Hot',8,'₹75 lakhs–1 crore','Within 1 month','Follow-up is overdue after the discovery call.'],
  ['DEMO-010','Aditi Das','Orion Retail','Commercial','Mumbai','35 kW','Qualified','Meera Demo','Warm',5,'Not sure','3-6 months','Budget owner and target commissioning date are unconfirmed.'],
  ['DEMO-011','Zoya Khan','Meridian Hospital','Institutional','Lucknow','120 kW','Proposal','Meera Demo','Hot',9,'₹75 lakhs–1 crore','Immediately','Technical committee review is pending.'],
  ['DEMO-012','Vikram Menon','GreenArc Apartments','Residential','Bengaluru','20 kW','Stopped','Rohan Demo','Cold',4,'₹10–25 lakhs','3-6 months','Manual hold recorded while the residents vote on the project.'],
 ] as const;
 s.leads=projects.map((p,i)=>({lead_id:p[0],lead_key:'SYNTHETIC|'+p[0],created_at:iso(-30+i),client_name:p[1],company_name:p[2],email:`solar.demo.${i+1}@example.com`,phone:`900000${String(i+1).padStart(4,'0')}`,location:p[4],project_type:p[3],estimated_capacity:p[5],budget_range:p[10],timeline:p[11],electricity_bill_available:i===2?'No':'Yes',site_visit_required:['Site Visit','Proposal'].includes(p[6])?'Yes':'No',message:'Synthetic demonstration record for a fictional solar project.',lead_source:'Synthetic demo',current_status:p[6],assigned_to:p[7],next_followup_date:'',escalation_flag:'No',last_action:p[12],last_action_at:iso(-Math.max(1,12-i)),notes:p[12],manual_stop:p[6]==='Stopped'?'Yes':'No',acknowledgement_sent_at:iso(-29+i),updated_at:iso(-Math.max(1,12-i)),version:1}));
 s.intelligence=projects.map((p,i)=>({lead_id:p[0],urgency_score:p[9],lead_temperature:p[8],project_category:p[3],client_summary:`${p[2]}: synthetic ${p[3].toLowerCase()} ${p[5]} solar opportunity in ${p[4]}.`,missing_information:i===2?'Electricity bill, sanctioned load':i===9?'Budget range, target commissioning date':'No major missing information',suggested_next_action:p[12],ai_used:'No',ai_processed_at:iso(-30+i)}));
 const followupRows=[
  ['FU-001','DEMO-001',-4,'Confirm finance committee decision'],['FU-002','DEMO-002',-2,'Confirm roof-access approval'],['FU-003','DEMO-003',0,'Collect electricity bill and sanctioned-load details'],['FU-004','DEMO-004',2,'Discuss financing options'],['FU-005','DEMO-005',-1,'Send revised structural scope'],['FU-007','DEMO-007',0,'Prepare proposal from survey findings'],['FU-009','DEMO-009',-5,'Reconnect after discovery call'],['FU-010','DEMO-010',3,'Confirm budget owner and commissioning date'],['FU-011','DEMO-011',1,'Schedule technical committee clarification call'],
 ] as const;
 s.followups=followupRows.map((f,i)=>{const l=s.leads.find(x=>x.lead_id===f[1])!;return {followup_id:f[0],lead_id:f[1],client_name:l.client_name,email:l.email,assigned_to:l.assigned_to,followup_stage:`Follow-up ${i+1}`,followup_due_date:addDays(today,f[2]),followup_status:'Pending',last_email_sent_at:'',next_action:f[3],notes:'Synthetic task',channel:'Manual',automation_enabled:'No',completed_at:'',outcome:'',updated_at:now,version:1};});
 for(const l of s.leads){const task=s.followups.find(f=>f.lead_id===l.lead_id);l.next_followup_date=task?.followup_due_date||'';l.escalation_flag=task?.followup_due_date<today?'Yes':'No';}
 s.visits=[
  {site_visit_id:'SV-001',lead_id:'DEMO-002',client_name:'Priya Kapoor',assigned_engineer:'Aarav Demo',visit_date:addDays(today,2),checklist_status:'Pending',required_documents:'Latest electricity bill and roof-access approval',visit_notes:'',photos_link:'',visit_status:'Scheduled',starts_at:iso(2),ends_at:new Date(Date.parse(iso(2))+3600000).toISOString(),calendar_event_id:'',calendar_sync_status:'Not connected',updated_at:now,version:1},
  {site_visit_id:'SV-002',lead_id:'DEMO-007',client_name:'Rhea Jain',assigned_engineer:'Aarav Demo',visit_date:addDays(today,-6),checklist_status:'Completed',required_documents:'Roof plan and sanctioned load',visit_notes:'Roof area is adequate. Minor shadowing on the south-west edge; use split MPPT design.',photos_link:'https://example.com/synthetic-survey',visit_status:'Completed',starts_at:iso(-6),ends_at:new Date(Date.parse(iso(-6))+3600000).toISOString(),calendar_event_id:'demo-event',calendar_sync_status:'Synced',updated_at:iso(-6),version:1},
  {site_visit_id:'SV-003',lead_id:'DEMO-005',client_name:'Sana Ali',assigned_engineer:'Aarav Demo',visit_date:addDays(today,-10),checklist_status:'Completed',required_documents:'Structural drawings and load profile',visit_notes:'Structure requires reinforcement allowance before final pricing.',photos_link:'https://example.com/synthetic-survey-2',visit_status:'Completed',starts_at:iso(-10),ends_at:new Date(Date.parse(iso(-10))+3600000).toISOString(),calendar_event_id:'demo-event-2',calendar_sync_status:'Synced',updated_at:iso(-10),version:1},
 ];
 s.proposals=[
  {proposal_id:'PR-001',lead_id:'DEMO-001',client_name:'Rajesh Sharma',proposal_required:'Yes',boq_status:'Final',proposal_status:'Shared',revision_requested:'No',final_proposal_shared:'Yes',approval_status:'Pending',notes:'250 kW rooftop system; synthetic estimate only.',amount:14500000,currency:'INR',proposal_version:2,document_url:'',pdf_url:'',document_status:'Ready',sent_at:iso(-7),next_followup_date:addDays(today,-4),updated_at:iso(-7),version:2},
  {proposal_id:'PR-005',lead_id:'DEMO-005',client_name:'Sana Ali',proposal_required:'Yes',boq_status:'Draft',proposal_status:'Draft',revision_requested:'Yes',final_proposal_shared:'No',approval_status:'Pending',notes:'Revise for structural reinforcement.',amount:16200000,currency:'INR',proposal_version:2,document_url:'',pdf_url:'',document_status:'Pending',sent_at:'',next_followup_date:'',updated_at:iso(-3),version:2},
  {proposal_id:'PR-006',lead_id:'DEMO-006',client_name:'Kabir Rao',proposal_required:'Yes',boq_status:'Final',proposal_status:'Accepted',revision_requested:'No',final_proposal_shared:'Yes',approval_status:'Accepted',notes:'50 kW school rooftop system.',amount:3100000,currency:'INR',proposal_version:1,document_url:'',pdf_url:'',document_status:'Ready',sent_at:iso(-12),next_followup_date:'',updated_at:iso(-8),version:1},
  {proposal_id:'PR-011',lead_id:'DEMO-011',client_name:'Zoya Khan',proposal_required:'Yes',boq_status:'Final',proposal_status:'Shared',revision_requested:'No',final_proposal_shared:'Yes',approval_status:'Pending',notes:'120 kW hospital rooftop system.',amount:7800000,currency:'INR',proposal_version:1,document_url:'',pdf_url:'',document_status:'Ready',sent_at:iso(-4),next_followup_date:addDays(today,1),updated_at:iso(-4),version:1},
 ];
 s.activity=[{event_id:'EV-DEMO-1',request_id:'synthetic-seed',lead_id:'',action:'synthetic_workspace_loaded',actor:'SolarOps demo',created_at:now,details:JSON.stringify({summary:'All records are fictional.'})}];
 s.version=1;
 return s;
}
