const SUPABASE_URL='https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const WINDOW_SECONDS=60*60;
const LIMIT=30;
const TIMEOUT_MS=3000;

function origin(req){
  const value=String(req.headers.origin||'').trim();
  const allowed=new Set(['https://vencivo.com.br','https://www.vencivo.com.br','https://vencivo-ai.vercel.app','http://localhost:3000','http://localhost:5173']);
  return allowed.has(value)?value:'https://vencivo.com.br';
}

function headers(res,req){
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Origin',origin(req));
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Vary','Origin');
}

function json(res,req,status,body){
  headers(res,req);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.status(status).json(body);
}

function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()}

async function limited(req){
  if(!SERVICE_ROLE_KEY) return true;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),1000);
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`,{
      method:'POST',
      headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_key:`password:hibp:${clientIp(req)}`,p_limit:LIMIT,p_window_seconds:WINDOW_SECONDS}),
      signal:controller.signal
    });
    if(!r.ok) return true;
    return await r.json();
  }catch(e){return true}finally{clearTimeout(timer)}
}

export default async function handler(req,res){
  headers(res,req);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return json(res,req,405,{error:'Método não permitido.'});
  const prefix=String(req.query?.prefix||'').trim().toUpperCase();
  if(!/^[0-9A-F]{5}$/.test(prefix))return json(res,req,400,{error:'Prefixo inválido.'});
  if(await limited(req))return json(res,req,429,{error:'Muitas verificações de senha em pouco tempo.'});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(`https://api.pwnedpasswords.com/range/${prefix}`,{
      headers:{'User-Agent':'VENCIVO Password Security','Add-Padding':'true','Accept':'text/plain'},
      signal:controller.signal,
      cache:'no-store'
    });
    if(!r.ok) return json(res,req,503,{error:'Serviço de verificação de senha indisponível.'});
    const body=await r.text();
    res.status(200).send(body);
  }catch(e){
    return json(res,req,503,{error:'Serviço de verificação de senha indisponível.'});
  }finally{clearTimeout(timer)}
}
