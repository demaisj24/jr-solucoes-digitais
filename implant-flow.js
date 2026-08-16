import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://uxmlmyhiagjefuufanyg.supabase.co';
const SUPABASE_KEY='sb_publishable_wAajSubj-zZE7kFh7EAxog_2FxCrs6Z';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

function toast(text){
  let el=document.getElementById('vencivoImplantToast');
  if(!el){el=document.createElement('div');el.id='vencivoImplantToast';Object.assign(el.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',zIndex:'9999',padding:'12px 16px',borderRadius:'12px',background:'#111a2a',color:'#fff',border:'1px solid #ffffff22',boxShadow:'0 15px 50px #0008',font:'600 14px system-ui',maxWidth:'90vw',textAlign:'center'});document.body.appendChild(el)}
  el.textContent=text;el.style.display='block';
}
function getCurrentAgentId(){
  const query=new URLSearchParams(location.search).get('agent');if(query)return query;
  const href=document.getElementById('openAgent')?.getAttribute('href')||'';
  try{const id=new URL(href,location.href).searchParams.get('id');if(id)return id}catch{}
  return window.agentId||'';
}
function improveBuilderVisual(){
  if(!document.getElementById('implant')||document.getElementById('vencivo-builder-polish'))return;
  const style=document.createElement('style');style.id='vencivo-builder-polish';style.textContent=`
    .builder{font-size:16px}.builder .field label{font-size:14px}.builder .input,.builder .select,.builder .textarea{font-size:15px;padding:11px 12px}.builder .hint{font-size:12px}.builder .check{font-size:13px}.builder .summary div{font-size:14px}.builder .actions .btn{font-size:14px;padding:10px 14px}
    .preview .head{padding:15px 17px}.preview .avatar{width:44px;height:44px}.preview .name{font-size:17px}.preview .online{font-size:12px}.preview .messages{padding:18px;gap:11px}.preview .msg{font-size:15px;line-height:1.55;padding:12px 14px;max-width:86%}.preview .suggest{padding:0 17px 10px;gap:7px}.preview .suggest button{font-size:12px;padding:8px 11px}.preview .inputrow{padding:11px;gap:8px}.preview #chatInput{font-size:15px;padding:12px 13px}.preview #send{width:auto;min-width:92px;padding:0 16px;font-size:14px;font-weight:900}.preview .note{font-size:11px;padding:8px}#implant{min-width:230px}@media(max-width:850px){.preview .msg{max-width:92%}}
  `;document.head.appendChild(style);
  const send=document.getElementById('send');if(send)send.textContent='ENVIAR';
}
async function startCheckout(){
  const button=document.getElementById('implant'),agentId=getCurrentAgentId();
  if(!agentId){toast('Não foi possível identificar este agente. Recarregue a página e tente novamente.');return}
  const {data,error}=await supabase.auth.getSession(),session=data?.session;
  if(error||!session?.access_token){toast('Sua sessão não está ativa. Faça login novamente para continuar.');setTimeout(()=>{location.href='conta.html'},1200);return}
  const old=button?.textContent||'Quero implantar no meu WhatsApp';
  if(button){button.textContent='Preparando pagamento...';button.style.pointerEvents='none';button.style.opacity='.65'}
  try{
    const phone=document.getElementById('whatsapp')?.value?.trim()||'',name=session.user?.user_metadata?.full_name||session.user?.email||'Cliente VENCIVO';
    const r=await fetch('/api/asaas-checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({agent_id:agentId,name,phone})});
    const p=await r.json().catch(()=>({}));if(!r.ok||!p.checkout_url)throw new Error(p.error||'Não foi possível iniciar o pagamento agora.');
    toast('Checkout do Asaas preparado. Redirecionando...');location.href=p.checkout_url;
  }catch(e){toast(e.message||'Não foi possível iniciar o pagamento agora.');if(button){button.textContent=old;button.style.pointerEvents='';button.style.opacity=''}}
}
function patchBuilder(){
  const button=document.getElementById('implant');if(!button)return;improveBuilderVisual();
  button.textContent='Quero implantar no meu WhatsApp';button.removeAttribute('target');button.removeAttribute('href');
  button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();startCheckout()},true);
}
function patchWhatsappActivation(){
  const originalFetch=window.fetch.bind(window);window.fetch=async function(input,init={}){const url=typeof input==='string'?input:(input?.url||'');if(url.includes('/api/whatsapp-activate')&&init.method==='POST'){const {data}=await supabase.auth.getSession();if(data?.session?.access_token)init={...init,headers:{...(init.headers||{}),Authorization:'Bearer '+data.session.access_token}}}return originalFetch(input,init)};
}
document.addEventListener('DOMContentLoaded',()=>{if(location.pathname.endsWith('/ia-v2.html'))patchBuilder();if(location.pathname.endsWith('/whatsapp-config.html'))patchWhatsappActivation()});