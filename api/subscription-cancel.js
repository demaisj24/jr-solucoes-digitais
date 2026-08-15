const SUPABASE_URL='https://uxmlmyhiagjefuufanyg.supabase.co';
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const ASAAS_KEY=process.env.ASAAS_API_KEY||'';
const ASAAS_URL=(process.env.ASAAS_API_URL||'https://api-sandbox.asaas.com/v3').replace(/\/$/,'');
function json(res,status,body){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.status(status).json(body)}
async function user(req){const a=String(req.headers.authorization||'');if(!a.startsWith('Bearer ')||!KEY)return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:KEY,Authorization:a}});if(!r.ok)return null;return r.json()}
async function sb(path,options={}){const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',...options.headers}});const p=await r.json().catch(()=>null);if(!r.ok)throw new Error('Falha no banco.');return p}
async function asaas(path,options={}){const r=await fetch(`${ASAAS_URL}${path}`,{...options,headers:{accept:'application/json','Content-Type':'application/json',access_token:ASAAS_KEY,...(options.headers||{})}});const p=await r.json().catch(()=>null);return {ok:r.ok,status:r.status,data:p}}
function withinSevenDays(date){if(!date)return false;const t=new Date(String(date).replace(' ','T')).getTime();return Number.isFinite(t)&&t<=Date.now()&&Date.now()-t<=7*86400000}
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
 try{
  if(!KEY||!ASAAS_KEY)return json(res,503,{error:'Gestão de assinatura ainda não está configurada no servidor.'});
  const u=await user(req);if(!u?.id)return json(res,401,{error:'Faça login novamente.'});
  const rows=await sb(`subscriptions?user_id=eq.${encodeURIComponent(u.id)}&select=id,status,provider_subscription_id,trial_started_at,trial_ends_at&limit=1`);
  const sub=rows?.[0];if(!sub)return json(res,404,{error:'Nenhuma assinatura encontrada.'});
  if(sub.status==='canceled'||sub.status==='refunded')return json(res,200,{ok:true,status:sub.status,message:'A assinatura já está encerrada.'});
  let refund=false,refundPending=false;
  if(sub.provider_subscription_id){
   const listed=await asaas(`/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}/payments`);
   const payments=listed.ok&&Array.isArray(listed.data?.data)?listed.data.data:[];
   const payment=payments.find(p=>['RECEIVED','CONFIRMED'].includes(String(p.status||'').toUpperCase())&&withinSevenDays(p.paymentDate||p.confirmedDate||p.dateCreated)&&withinSevenDays(sub.trial_started_at));
   if(payment?.id){
    const rr=await asaas(`/payments/${encodeURIComponent(payment.id)}/refund`,{method:'POST',body:JSON.stringify({description:'Reembolso solicitado pelo cliente dentro do prazo legal aplicável.'})});
    if(rr.ok)refund=true;else{refundPending=true;console.error('Asaas refund',rr.status,rr.data)}
   }
   const canceled=await asaas(`/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`,{method:'DELETE'});
   if(!canceled.ok&&canceled.status!==404)throw new Error('Não foi possível cancelar a recorrência no Asaas.');
  }
  const status=refund?'refunded':'canceled';
  await sb(`subscriptions?id=eq.${encodeURIComponent(sub.id)}`,{method:'PATCH',body:JSON.stringify({status,canceled_at:new Date().toISOString(),cancel_at_period_end:false,updated_at:new Date().toISOString()})});
  if(refund)return json(res,200,{ok:true,status:'refunded',message:'Assinatura cancelada e solicitação de reembolso enviada ao Asaas.'});
  if(refundPending)return json(res,200,{ok:true,status:'canceled',refund_pending:true,message:'Assinatura cancelada. O pedido de reembolso não foi concluído automaticamente e ficará para tratamento.'});
  return json(res,200,{ok:true,status:'canceled',message:'Assinatura cancelada. Nenhuma nova cobrança recorrente será gerada.'});
 }catch(e){console.error('Subscription cancel:',e);return json(res,500,{error:e.message||'Não foi possível cancelar a assinatura agora.'})}
}
