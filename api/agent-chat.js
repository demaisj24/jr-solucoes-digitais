const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const buckets = new Map();
const SESSION_LIMIT = 30;
const IP_LIMIT = 120;
const WINDOW_MS = 60 * 60 * 1000;

function cors(req){const o=String(req.headers.origin||'').trim();const a=new Set(['https://vencivo.com.br','https://www.vencivo.com.br','https://vencivo-ai.vercel.app','http://localhost:3000','http://localhost:5173']);return a.has(o)?o:'https://vencivo.com.br'}
function setHeaders(res,req){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin',cors(req));res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Vary','Origin')}
function out(res,req,status,body){setHeaders(res,req);return res.status(status).json(body)}
function ip(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()}
function hit(key,limit){const n=Date.now(),x=buckets.get(key);if(!x||n-x.startedAt>WINDOW_MS){buckets.set(key,{startedAt:n,count:1});return false}if(x.count>=limit)return true;x.count++;return false}
function clean(v,max){return String(v??'').trim().slice(0,max)}
async function db(path){if(!SUPABASE_URL||!SERVICE_ROLE_KEY)throw new Error('Supabase não configurado.');const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`}});const p=await r.json().catch(()=>null);if(!r.ok)throw new Error('Falha no banco.');return p}
function history(h){if(!Array.isArray(h))return [];return h.slice(-12).map(m=>({role:m?.role==='assistant'?'model':'user',parts:[{text:clean(m?.content,2000)}]})).filter(m=>m.parts[0].text)}

export default async function handler(req,res){
  if(req.method==='OPTIONS'){setHeaders(res,req);return res.status(204).end()}
  if(req.method!=='POST')return out(res,req,405,{error:'Método não permitido.'});
  if(!GEMINI_KEY)return out(res,req,500,{error:'IA não configurada.'});
  try{
    const b=req.body||{};const id=clean(b.agent_id,80);const msg=clean(b.nova_mensagem,2000);const sid=clean(b.session_id,100);
    if(!id||!msg)return out(res,req,400,{error:'agent_id e nova_mensagem são obrigatórios.'});
    const client=ip(req);if(sid&&hit(`s:${client}:${sid}`,SESSION_LIMIT))return out(res,req,429,{error:'Este atendimento atingiu o limite temporário de mensagens.'});if(hit(`i:${client}`,IP_LIMIT))return out(res,req,429,{error:'Muitas mensagens neste acesso. Tente novamente mais tarde.'});
    const rows=await db(`agents?public_id=eq.${encodeURIComponent(id)}&status=in.(demo,active)&select=id,company_name,agent_name,segment,system_prompt&limit=1`);const agent=rows?.[0];
    if(!agent)return out(res,req,404,{error:'Agente não encontrado ou indisponível.'});
    let knowledge='';try{const k=await db(`agent_knowledge?agent_id=eq.${encodeURIComponent(agent.id)}&select=content&order=created_at.desc&limit=3`);knowledge=k.map(x=>x.content).join('\n\n').slice(0,18000)}catch{}
    const fallback=`Você é ${agent.agent_name}, assistente virtual da empresa ${agent.company_name}, segmento ${agent.segment}. Atenda com cordialidade, objetividade e alto nível profissional. Use somente informações disponíveis sobre a empresa. Quando não souber algo, diga que irá encaminhar a informação para um atendente humano. Nunca invente preços, horários, disponibilidade ou agendamentos. Ao concluir o atendimento, agradeça de forma natural e deixe o cliente à vontade para retornar.`;
    const system=[agent.system_prompt||fallback,knowledge?`BASE DE CONHECIMENTO:\n${knowledge}`:''].filter(Boolean).join('\n\n');
    const contents=[...history(b.historico_mensagens),{role:'user',parts:[{text:msg}]}];
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);let r;
    try{r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_KEY},body:JSON.stringify({system_instruction:{parts:[{text:system}]},contents,generationConfig:{maxOutputTokens:220,thinkingConfig:{thinkingLevel:'minimal'}}}),signal:controller.signal})}catch(e){if(e?.name==='AbortError')return out(res,req,504,{error:'A IA demorou para responder. Tente novamente.'});throw e}finally{clearTimeout(timer)}
    const p=await r.json().catch(()=>null);if(!r.ok){console.error('Gemini agent error',r.status,p);return out(res,req,502,{error:'Não foi possível responder agora.'})}
    const text=p?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();if(!text)return out(res,req,502,{error:'A IA não retornou uma resposta válida.'});return out(res,req,200,{reply:text,agent:{id:agent.public_id,name:agent.agent_name,company:agent.company_name}});
  }catch(e){console.error('Agent chat:',e);return out(res,req,500,{error:'Erro interno ao processar o atendimento.'})}
}
