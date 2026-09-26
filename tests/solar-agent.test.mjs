import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

async function load(entry){
 const bundle=await build({entryPoints:[fileURLToPath(new URL(entry,import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
 return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}

const core=await load('../lib/solar-core.ts');
const tools=await load('../lib/solar-agent-data.ts');
const knowledge=await load('../lib/solar-knowledge.ts');

test('public demo records and configuration are completely synthetic',()=>{
 const state=core.demoWorkspace('2026-09-26T09:00:00.000Z');
 assert.equal(state.leads.length,12);
 assert.ok(state.leads.every((lead)=>lead.lead_id.startsWith('DEMO-')));
 assert.ok(state.leads.every((lead)=>lead.email.endsWith('@example.com')));
 assert.ok(state.leads.every((lead)=>lead.lead_source==='Synthetic demo'));
 assert.ok(Object.values(state.config).filter((value)=>String(value).includes('@')).every((value)=>String(value).endsWith('@example.com')));
 assert.equal(state.config.AUTOMATION_ENABLED,'No');
});

test('read-only tools find customers and ground a stall explanation',()=>{
 const state=core.demoWorkspace('2026-09-26T09:00:00.000Z');
 const found=tools.findCustomers(state,'Rajesh Sharma');
 assert.equal(found.data[0].customer_id,'DEMO-001');
 const stalled=tools.explainStall(state,'DEMO-001');
 assert.match(stalled.data.reason,/overdue/i);
 assert.match(stalled.data.execution_status,/not executed/i);
 assert.ok(stalled.sources.includes('Followup_Tracker'));
});

test('delayed-project detection uses recorded tasks and stage evidence',()=>{
 const state=core.demoWorkspace('2026-09-26T09:00:00.000Z');
 const delayed=tools.delayedProjects(state);
 assert.ok(delayed.data.some((project)=>project.project==='Sharma Textiles'));
 assert.ok(delayed.data.some((project)=>project.project==='Harbour Offices'));
});

test('due-today task retrieval returns customer and project context',()=>{
 const state=core.demoWorkspace('2026-09-26T09:00:00.000Z');
 const due=tools.listTasks(state,'today');
 assert.equal(due.data.length,2);
 assert.ok(due.data.some((task)=>task.project==='Aster Logistics'));
 assert.ok(due.data.some((task)=>task.project==='Harbour Offices'));
});

test('synthetic SOP retrieval returns relevant grounded guidance',()=>{
 const docs=knowledge.searchKnowledge('What should happen after a site survey?');
 assert.equal(docs[0].title,'Site Survey SOP');
 assert.match(docs[0].content,/two working days/i);
});
