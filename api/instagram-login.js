import crypto from 'node:crypto';

const SUPABASE_URL = 'https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || '';
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'https://www.vencivo.com.br/api/instagram-callback';
const STATE_SECRET = process.env.INSTAGRAM_OAUTH_STATE_SECRET || '';
const SCOPES = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';

function out(res, status, body) { res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); return res.status(status).json(body); }
function clean(v, max) { return String(v ?? '').trim().slice(0, max); }
function sign(value) { return crypto.createHmac('sha256', STATE_SECRET).update(value).digest('base64url'); }
function makeState(userId) {
  const payload = Buffer.from(JSON.stringify({ sub:userId, iat:Date.now(), exp:Date.now()+10*60*1000 }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function getBearer(req) { const h=String(req.headers.authorization||''); return h.startsWith('Bearer ')?h.slice(7).trim():''; }
async function db(path, options={}) {
  if (!SERVICE_ROLE_KEY) throw new Error('Supabase não configurado.');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,...(options.headers||{})}});
  const p=await r.json().catch(()=>null); if(!r.ok) throw new Error('Falha no banco.'); return p;
}
async function getUser(token) {
  const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:process.env.SUPABASE_ANON_KEY||SERVICE_ROLE_KEY,Authorization:`Bearer ${token}`}});
  if(!r.ok) return null; return r.json().catch(()=>null);
}
export default async function handler(req,res){
  if(req.method!=='GET') return out(res,405,{error:'Método não permitido.'});
  try {
    if(!INSTAGRAM_APP_ID||!STATE_SECRET) return out(res,503,{error:'Integração Instagram ainda não configurada no ambiente.'});
    const token=getBearer(req); if(!token) return out(res,401,{error:'Faça login para conectar o Instagram.'});
    const user=await getUser(token); if(!user?.id) return out(res,401,{error:'Sessão inválida. Faça login novamente.'});
    const state=makeState(user.id);
    const url=new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id',INSTAGRAM_APP_ID);
    url.searchParams.set('redirect_uri',REDIRECT_URI);
    url.searchParams.set('response_type','code');
    url.searchParams.set('scope',SCOPES);
    url.searchParams.set('state',state);
    return out(res,200,{authorization_url:url.toString(),redirect_uri:REDIRECT_URI,scopes:SCOPES.split(',')});
  } catch(e) { console.error('Instagram login:',e); return out(res,500,{error:'Não foi possível iniciar a conexão com o Instagram.'}); }
}
