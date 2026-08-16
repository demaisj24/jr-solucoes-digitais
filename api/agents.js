const SUPABASE_URL = 'https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WINDOW_MS = 60 * 60 * 1000;
const CREATE_LIMIT = 5;
const MAX_BODY_BYTES = 120000;
const buckets = new Map();
function origin(req){const value=String(req.headers.origin||'').trim();const allowed=new Set(['https://vencivo.com.br','https://www.vencivo.com.br','https://vencivo-ai.vercel.app','http://localhost:3000','http://localhost:5173']);return allowed.has(value)?value:'https://vencivo.com.br'}
function headers(res,req){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin',origin(req));res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Vary','Origin')}
function json(res,req,status,body){headers(res,req);return res.status(status).json(body)}
function ip(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()}
function limited(key){const now=Date.now();for(const [k,v] of buckets){if(now-v.startedAt>WINDOW_MS)buckets.delete(k)}const x=buckets.get(key);if(!x){buckets.set(key,{startedAt:now,count:1});return false}if(x.count>=CREATE_LIMIT)return true;x.count++;return false}
function clean(value,max=6000){return String(value??'').trim().slice(0,max)}
function bodyTooLarge(req){const n=Number(req.headers['content-length']||0);return Number.isFinite(n)&&n>MAX_BODY_BYTES}
async function db(path,options={}){if(!SERVICE_ROLE_KEY)throw new Error('Supabase não configurado no servidor.');const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:options.method==='POST'?'return=representation':undefined,...(options.headers||{})}});const payload=await response.json().catch(()=>null);if(!response.ok){console.error('Supabase error',response.status,payload);throw new Error('Falha ao persistir agente.')}return payload}
async function authUser(req){const authorization=String(req.headers.authorization||'');if(!authorization.startsWith('Bearer ')||!SERVICE_ROLE_KEY)return null;try{const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SERVICE_ROLE_KEY,Authorization:authorization}});if(!response.ok)return null;const user=await response.json();return user?.id?user:null}catch{return null}}
export default async function handler(req,res){
 if(req.method==='OPTIONS'){headers(res,req);return res.status(204).end()}
 if(req.method!=='POST'&&req.method!=='GET')return json(res,req,405,{error:'Método não permitido.'});
 if(bodyTooLarge(req))return json(res,req,413,{error:'Dados enviados acima do limite permitido.'});
 try{
  const user=await authUser(req);
  if(req.method==='POST'){
   if(limited(`create:${ip(req)}`))return json(res,req,429,{error:'Limite de criação de demonstrações atingido. Tente novamente mais tarde.'});
   const b=req.body||{},company=clean(b.company_name,100),agent=clean(b.agent_name,100),segment=clean(b.segment,100),services=clean(b.services,6000);
   if(!company||!segment||!services)return json(res,req,400,{error:'Empresa, segmento e serviços são obrigatórios.'});
   const row={owner_id:user?.id||null,company_name:company,agent_name:agent||`${company} AI`,segment,whatsapp:clean(b.whatsapp,40)||null,city_region:clean(b.city_region,100)||null,services,business_hours:clean(b.business_hours,200)||null,capabilities:Array.isArray(b.capabilities)?b.capabilities.slice(0,12).map(x=>clean(x,80)):[],personality:clean(b.personality,120)||null,objective:clean(b.objective,200)||null,system_prompt:clean(b.system_prompt,12000)||null,status:'demo'};
   const data=await db('agents',{method:'POST',body:JSON.stringify(row)});const saved=data?.[0];
   const knowledge=clean(b.knowledge_text,80000);if(saved&&knowledge){await db('agent_knowledge',{method:'POST',body:JSON.stringify({agent_id:saved.id,file_name:clean(b.knowledge_file_name,160)||'base-de-conhecimento.txt',content:knowledge,content_type:'text/plain',size_bytes:knowledge.length})})}
   return json(res,req,201,{agent:{id:saved.public_id,company_name:saved.company_name,agent_name:saved.agent_name,segment:saved.segment,status:saved.status,created_at:saved.created_at,owner_id:!!user}});
  }
  const mine=String(req.query?.mine||'')==='1';
  if(mine){if(!user)return json(res,req,401,{error:'Login necessário.'});const data=await db(`agents?owner_id=eq.${encodeURIComponent(user.id)}&select=public_id,company_name,agent_name,segment,status,created_at,updated_at&order=created_at.desc&limit=50`,{method:'GET'});return json(res,req,200,{agents:data||[]})}
  const id=clean(req.query?.id,80);if(!id)return json(res,req,400,{error:'ID do agente é obrigatório.'});
  const data=await db(`agents?public_id=eq.${encodeURIComponent(id)}&status=in.(demo,active)&select=public_id,company_name,agent_name,segment,services,business_hours,capabilities,personality,objective,status&limit=1`,{method:'GET'});if(!data?.length)return json(res,req,404,{error:'Agente não encontrado.'});
  return json(res,req,200,{agent:data[0]});
 }catch(error){console.error('Agents API:',error);return json(res,req,500,{error:'Não foi possível processar o agente agora.'})}
}
