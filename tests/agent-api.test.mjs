import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const keys=['SOLAR_PUBLIC_SHOWCASE','SOLAR_APPS_SCRIPT_URL','SOLAR_AUTOMATION_TOKEN','GOOGLE_GENERATIVE_AI_API_KEY','SOLAR_AI_MODEL'];
const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
const originalFetch=globalThis.fetch;
const buildDir=await mkdtemp(join(tmpdir(),'solar-agent-test-'));
const outputFile=join(buildDir,'route.cjs');
after(async()=>{globalThis.fetch=originalFetch;for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key]}await rm(buildDir,{recursive:true,force:true})});

await build({entryPoints:[fileURLToPath(new URL('../app/api/agent/route.ts',import.meta.url))],bundle:true,outfile:outputFile,format:'cjs',platform:'node'});
const route=await import(pathToFileURL(outputFile).href);
const endpoint='https://solar.example/api/agent';

function request(question,origin='https://solar.example'){return new Request(endpoint,{method:'POST',headers:{origin,'Content-Type':'application/json','x-forwarded-for':'203.0.113.20'},body:JSON.stringify({question})})}

test('public agent is grounded in synthetic data without calling Sheets',async()=>{
 process.env.SOLAR_PUBLIC_SHOWCASE='Yes';delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
 globalThis.fetch=async()=>{throw new Error('The public agent must not call Sheets or a model without a configured key.')};
 const response=await route.POST(request('Why is Rajesh Sharma project stalled?'));
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.mode,'showcase');assert.equal(body.readonly,true);assert.equal(body.provider.configured,false);
 assert.deepEqual(body.traces.map(trace=>trace.tool),['search_customers','explain_project_stall']);
 assert.match(body.answer,/Not executed/i);assert.match(body.answer,/overdue/i);
});

test('Gemini overload returns a labeled grounded answer with real read-only tool traces',async()=>{
 process.env.SOLAR_PUBLIC_SHOWCASE='Yes';process.env.GOOGLE_GENERATIVE_AI_API_KEY='test-only-key';
 globalThis.fetch=async()=>new Response(JSON.stringify({error:{code:503,message:'The model is currently experiencing high demand.',status:'UNAVAILABLE'}}),{status:503,headers:{'Content-Type':'application/json'}});
 const response=await route.POST(request('Which projects are delayed?'));
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.readonly,true);
 assert.equal(body.provider.configured,true);assert.match(body.provider.name,/fallback/i);
 assert.match(body.answer,/Gemini is temporarily unavailable/i);
 assert.match(body.answer,/delayed or blocked projects/i);
 assert.deepEqual(body.traces.map(trace=>trace.tool),['list_delayed_projects']);
});

test('agent API rejects cross-origin requests before reading data',async()=>{
 const response=await route.POST(request('Show delayed projects','https://unrelated.example'));
 assert.equal(response.status,403);assert.match((await response.json()).error,/origin/i);
});

test('agent API validates blank and oversized prompts',async()=>{
 assert.equal((await route.POST(request(''))).status,400);
 assert.equal((await route.POST(request('x'.repeat(601)))).status,400);
});
