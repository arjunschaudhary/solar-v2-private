import { answerWithSolarOps } from '@/lib/solar-agent';
import { getWorkspaceSnapshot } from '@/lib/solar-data';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const windows=new Map<string,{started:number,count:number}>();
function rateLimited(request:Request){const key=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local';const now=Date.now(),current=windows.get(key);if(windows.size>500)for(const [id,value] of windows)if(now-value.started>60000)windows.delete(id);if(!current||now-current.started>60000){windows.set(key,{started:now,count:1});return false}current.count+=1;return current.count>12;}

export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
 if(rateLimited(request))return reply({error:'Too many agent questions. Try again in a minute.'},429);
 try{
  const raw=await request.text();if(raw.length>4000)return reply({error:'This request is too large.'},413);
  const body=JSON.parse(raw) as {question?:unknown};const question=String(body.question??'').trim();
  if(!question)return reply({error:'Ask a question about the Solar operation.'},400);
  if(question.length>600)return reply({error:'Keep the question under 600 characters.'},400);
  const {state,mode}=await getWorkspaceSnapshot();const result=await answerWithSolarOps(state,question);
  return reply({...result,mode,activity:{id:crypto.randomUUID(),created_at:new Date().toISOString(),question,tool_count:result.traces.length}});
 }catch(error){return reply({error:error instanceof Error?error.message:'SolarOps AI could not answer that question.'},500);}
}
