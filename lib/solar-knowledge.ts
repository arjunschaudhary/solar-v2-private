export type KnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  reviewed: string;
};

export const SOLAR_KNOWLEDGE: KnowledgeDocument[] = [
  {id:'sop-lead-qualification',title:'Lead Qualification SOP',category:'Sales',reviewed:'2026-08-15',summary:'Minimum checks before an enquiry advances.',content:'Confirm project type, site location, estimated capacity or electricity consumption, decision-maker, budget range, target timeline, electricity bill availability, and whether a site survey is required. Missing information must become a dated follow-up. Hot leads have a defined near-term timeline and enough technical or commercial detail to act.'},
  {id:'sop-site-survey',title:'Site Survey SOP',category:'Engineering',reviewed:'2026-08-15',summary:'Survey preparation, evidence, and completion rules.',content:'Before the visit, confirm access, attendee, electricity bill, roof or land drawings, sanctioned load, and safety requirements. During the survey record usable area, orientation, shading, structure, electrical interconnection, cable route, photographs, and constraints. A survey is complete only when findings and missing evidence are recorded. Send complete findings to proposal preparation within two working days.'},
  {id:'sop-proposal',title:'Proposal Preparation SOP',category:'Commercial',reviewed:'2026-08-15',summary:'Requirements for a reviewable solar proposal.',content:'Build the proposal from confirmed load data and survey findings. Include scope, exclusions, capacity, equipment assumptions, generation estimate, commercial amount, taxes, payment milestones, estimated schedule, warranties, and validity. Structural or interconnection uncertainty must be shown explicitly. Review the document before sharing and create a dated follow-up after it is shared.'},
  {id:'sop-follow-up',title:'Customer Follow-up SOP',category:'Sales',reviewed:'2026-08-15',summary:'Cadence and escalation for open work.',content:'Every open enquiry must have one clear owner and a dated next action. Record the outcome after each contact. Follow-ups past their due date are overdue. Escalate hot leads after two missed contacts or three working days overdue, whichever comes first. Never claim an email, call, or approval occurred unless it is recorded in the operational system.'},
  {id:'sop-installation',title:'Installation Handoff SOP',category:'Delivery',reviewed:'2026-08-15',summary:'Gate from accepted proposal to delivery planning.',content:'Do not schedule installation until the proposal is accepted, payment milestone is confirmed, final design inputs are approved, required permits or utility steps are understood, and site readiness is confirmed. The handoff package should contain the accepted scope, survey evidence, design assumptions, commercial milestones, customer contacts, risks, and target schedule.'},
  {id:'policy-escalation',title:'Project Escalation Policy',category:'Operations',reviewed:'2026-08-15',summary:'When and how stalled projects are escalated.',content:'A project is delayed when a dated task is overdue, a promised input is missing beyond its due date, a completed survey has no proposal work after two working days, or a shared proposal has no recorded follow-up. State the evidence, identify whether the blocker is customer, internal, technical, or commercial, name the owner, and recommend one next action. Recommendations are not executions.'},
  {id:'policy-payment',title:'Payment Milestone Policy',category:'Commercial',reviewed:'2026-08-15',summary:'Synthetic demo rules for commercial readiness.',content:'For demonstration purposes, use milestone language rather than promising fixed terms: advance on acceptance, procurement milestone, installation milestone, and commissioning balance. Actual percentages require approved commercial terms. Finance approval should be recorded before procurement or installation is represented as ready.'},
  {id:'policy-warranty',title:'Warranty and Support Guide',category:'Support',reviewed:'2026-08-15',summary:'How to discuss post-installation support safely.',content:'Separate manufacturer product warranties from installer workmanship commitments and performance assumptions. Confirm the signed proposal before quoting exact coverage. Support records should include system identifier, commissioning date, symptom, evidence, severity, owner, and next update time. Do not promise a resolution date without delivery-team confirmation.'},
];

const words=(value:string)=>value.toLowerCase().replace(/[^a-z0-9₹]+/g,' ').split(/\s+/).filter(x=>x.length>2);
const aliases:Record<string,string[]>= {survey:['site','visit','roof','shading'],proposal:['quote','boq','commercial','price'],follow:['task','overdue','contact','call'],installation:['install','delivery','handoff','commissioning'],stalled:['delay','blocked','overdue','pending'],warranty:['support','coverage']};

export function searchKnowledge(query:string,limit=3){
 const queryWords=new Set(words(query));
 for(const [key,values] of Object.entries(aliases))if(queryWords.has(key)||values.some(v=>queryWords.has(v))) [key,...values].forEach(v=>queryWords.add(v));
 return SOLAR_KNOWLEDGE.map(doc=>{const hay=words(`${doc.title} ${doc.category} ${doc.summary} ${doc.content}`);const score=hay.reduce((sum,w)=>sum+(queryWords.has(w)?1:0),0)+(doc.title.toLowerCase().includes(query.toLowerCase())?5:0);return {...doc,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}
