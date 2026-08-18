import crypto from 'node:crypto';

const SUPABASE_URL = 'https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || '';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'https://www.vencivo.com.br/api/instagram-callback';
const STATE_SECRET = process.env.INSTAGRAM_OAUTH_STATE_SECRET || '';

function page(res, title, message, ok=false) {
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  const safe=String(message).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  return res.status(ok?200:400).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · VENCIVO</title><style>body{margin:0;background:#070910;color:#f7f9fc;font:16px system-ui;display:grid;place-items:center;min-height:100vh}.card{width:min(520px,calc(100% - 32px));padding:28px;border:1px solid #ffffff16;border-radius:20px;background:#0d121e;text-align:center}a{display:inline-block;margin-top:18px;padding:11px 15px;border-radius:11px;background:linear-gradient(135deg,#63e6ff,#b0f7ff);color:#071018;text-decoration:none;font-weight:800}.ok{color:#57e6a8}.err{color:#ff9daa}</style></head><body><main class="card"><h1 class="${ok?'ok':'err'}">${safe}</h1><p>VENCIVO · Instagram</p><a href="/conta.html">Voltar para minha conta</a></main></body></html>`);
}
function verifyState(state){
  if(!STATE_SECRET||!state) return null;
  const [payload,sig]=String(state).split('.'); if(!payload||!sig) return null;
  const expected=crypto.createHmac('sha256',STATE_SECRET).update(payload).digest('base64url');
  if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
  const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  if(!data?.sub||!data?.exp||Date.now()>data.exp) return null;
  return data;
}
async function exchange(code){
  const body=new URLSearchParams({client_id:INSTAGRAM_APP_ID,client_secret:INSTAGRAM_APP_SECRET,grant_type:'authorization_code',redirect_uri:REDIRECT_URI,code});
  const r=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const p=await r.json().catch(()=>null); if(!r.ok||!p?.access_token) throw new Error('A troca do código do Instagram falhou.'); return p;
}
async function longLived(shortToken){
  const u=new URL('https://graph.instagram.com/access_token');
  u.searchParams.set('grant_type','ig_exchange_token'); u.searchParams.set('client_secret',INSTAGRAM_APP_SECRET); u.searchParams.set('access_token',shortToken);
  const r=await fetch(u); const p=await r.json().catch(()=>null); if(!r.ok||!p?.access_token) throw new Error('Não foi possível obter o token de longa duração.'); return p;
}
async function profile(token){
  const u=new URL('https://graph.instagram.com/me'); u.searchParams.set('fields','id,username'); u.searchParams.set('access_token',token);
  const r=await fetch(u); const p=await r.json().catch(()=>null); if(!r.ok||!p?.id) throw new Error('Não foi possível confirmar a conta do Instagram.'); return p;
}
async function db(path,options={}){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,Prefer:'resolution=merge-duplicates',...(options.headers||{})}});
  const p=await r.json().catch(()=>null); if(!r.ok) throw new Error('Falha ao salvar a conexão.'); return p;
}
export default async function handler(req,res){
  if(req.method!=='GET') return page(res,'Método não permitido','Método não permitido.');
  try{
    if(!INSTAGRAM_APP_ID||!INSTAGRAM_APP_SECRET||!STATE_SECRET) return page(res,'Instagram não configurado','A conexão do Instagram ainda não está configurada no ambiente.');
    const q=req.query||{}; if(q.error) return page(res,'Conexão cancelada','A conexão com o Instagram foi cancelada.');
    const state=verifyState(q.state); if(!state) return page(res,'Link inválido','A autorização expirou ou é inválida. Volte ao VENCIVO e tente novamente.');
    const code=String(q.code||'').trim(); if(!code) return page(res,'Código ausente','O Instagram não retornou o código de autorização.');
    const short=await exchange(code); const long=await longLived(short.access_token); const p=await profile(long.access_token);
    const expiresAt=long.expires_in?new Date(Date.now()+Number(long.expires_in)*1000).toISOString():null;
    await db('instagram_connections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner_id:state.sub,instagram_user_id:String(p.id),username:p.username||null,access_token:long.access_token,token_expires_at:expiresAt,scopes:['instagram_business_basic','instagram_business_manage_messages','instagram_business_manage_comments'],status:'active',updated_at:new Date().toISOString()})});
    return page(res,'Instagram conectado','Instagram conectado com sucesso.',true);
  }catch(e){console.error('Instagram callback:',e);return page(res,'Não foi possível conectar',e?.message||'Não foi possível concluir a conexão com o Instagram.');}
}
