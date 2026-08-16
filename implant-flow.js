import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://uxmlmyhiagjefuufanyg.supabase.co';
const SUPABASE_KEY='sb_publishable_wAajSubj-zZE7kFh7EAxog_2FxCrs6Z';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

function toast(text){
  let el=document.getElementById('vencivoImplantToast');
  if(!el){el=document.createElement('div');el.id='vencivoImplantToast';Object.assign(el.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',zIndex:'9999',padding:'12px 16px',borderRadius:'12px',background:'#111a2a',color:'#fff',border:'1px solid #ffffff22',boxShadow:'0 15px 50px #0008',font:'600 14px system-ui',maxWidth:'90vw',textAlign:'center'});document.body.appendChild(el)}
  el.textContent=text;el.style.display='block';
}

function hookAgentCreation(){
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    const response=await originalFetch(input,init);
    if(url.includes('/api/agents') && init?.method==='POST'){
      try{
        const copy=response.clone();
        const payload=await copy.json();
        const id=payload?.agent?.id;
        if(id){
          window._vencivoAgentId=id;
          const button=document.getElementById('implant');
          if(button)button.dataset.agentId=id;
        }
      }catch{}
    }
    return response;
  };
}

function getCurrentAgentId(){
  const direct=window._vencivoAgentId||document.getElementById('implant')?.dataset?.agentId;
  if(direct)return direct;
  const query=new URLSearchParams(location.search).get('agent');if(query)return query;
  const href=document.getElementById('openAgent')?.getAttribute('href')||'';
  try{const id=new URL(href,location.href).searchParams.get('id');if(id)return id}catch{}
  return window.agentId||'';
}

function improveBuilderVisual(){
  if(document.getElementById('vencivo-builder-polish'))return;
  const style=document.createElement('style');style.id='vencivo-builder-polish';style.textContent=`
    .builder{font-size:16px}.builder .field label{font-size:14px}.builder .input,.builder .select,.builder .textarea{font-size:15px;padding:11px 12px}.builder .hint{font-size:12px}.builder .check{font-size:13px}.builder .summary div{font-size:14px}.builder .actions{gap:9px}.builder .actions .btn{font-size:14px;padding:10px 14px}
    #implant{order:10;width:100%;min-height:52px;margin-top:8px;padding:14px 18px!important;border:0!important;border-radius:13px!important;background:linear-gradient(135deg,#25d366,#16a34a)!important;color:#fff!important;font-size:16px!important;font-weight:950!important;letter-spacing:.01em;box-shadow:0 10px 28px #16a34a35,0 0 0 1px #25d36655;text-shadow:0 1px 1px #0005}
    #implant:hover{transform:translateY(-1px);filter:brightness(1.06)}#implant::before{content:'✓ ';font-weight:950}#openAgent{order:1;font-size:13px!important;opacity:.78}.builder .actions #implant{flex-basis:100%}
    .preview .head{padding:15px 17px}.preview .avatar{width:44px;height:44px}.preview .name{font-size:17px}.preview .online{font-size:12px}.preview .messages{padding:18px;gap:11px}.preview .msg{font-size:15px;line-height:1.55;padding:12px 14px;max-width:86%}.preview .suggest{padding:0 17px 10px;gap:7px}.preview .suggest button{font-size:12px;padding:8px 11px}.preview .inputrow{padding:11px;gap:8px}.preview #chatInput{font-size:15px;padding:12px 13px}.preview #send{width:auto;min-width:92px;padding:0 16px;font-size:14px;font-weight:900}.preview .note{font-size:11px;padding:8px}@media(max-width:850px){.preview .msg{max-width:92%}}
  `;document.head.appendChild(style);
  const send=document.getElementById('send');if(send)send.textContent='ENVIAR';
}

function normalizeImplantButton(){
  const button=document.getElementById('implant');if(!button)return;
  button.textContent='IMPLANTAR NO WHATSAPP';button.removeAttribute('target');button.removeAttribute('href');button.setAttribute('aria-label','Implantar este agente no WhatsApp');
}

async function startCheckout(){
  const button=document.getElementById('implant'),agentId=getCurrentAgentId();
  if(!agentId){toast('O agente acabou de ser criado, mas o ID ainda não foi capturado. Clique novamente em IMPLANTAR NO WHATSAPP.');return}
  const {data,error}=await supabase.auth.getSession(),session=data?.session;
  if(error||!session?.access_token){toast('Sua sessão não está ativa. Faça login novamente para continuar.');setTimeout(()=>{location.href='conta.html'},1200);return}
  const old='IMPLANTAR NO WHATSAPP';
  if(button){button.textContent='PREPARANDO PAGAMENTO...';button.style.pointerEvents='none';button.style.opacity='.7}
  try{
    const phone=document.getElementById('whatsapp')?.value?.trim()||'',name=session.user?.user_metadata?.full_name||session.user?.email||'Cliente VENCIVO';
    const r=await fetch('/api/asaas-checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({agent_id:agentId,name,phone})});
    const p=await r.json().catch(()=>({}));if(!r.ok||!p.checkout_url)throw new Error(p.error||'Não foi possível iniciar o pagamento agora.');
    toast('Checkout preparado. Redirecionando...');location.href=p.checkout_url;
  }catch(e){toast(e.message||'Não foi possível iniciar o pagamento agora.');if(button){button.textContent=old;button.style.pointerEvents='';button.style.opacity=''}}
}

function patchBuilder(){
  hookAgentCreation();improveBuilderVisual();normalizeImplantButton();
  const button=document.getElementById('implant');if(!button)return;
  button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();startCheckout()},true);
  const observer=new MutationObserver(()=>normalizeImplantButton());observer.observe(button,{attributes:true,childList:true,subtree:true});
}

function patchWhatsappActivation(){
  const originalFetch=window.fetch.bind(window);window.fetch=async function(input,init={}){const url=typeof input==='string'?input:(input?.url||'');if(url.includes('/api/whatsapp-activate')&&init.method==='POST'){const {data}=await supabase.auth.getSession();if(data?.session?.access_token)init={...init,headers:{...(init.headers||{}),Authorization:'Bearer '+data.session.access_token}}}return originalFetch(input,init)};
}

document.addEventListener('DOMContentLoaded',()=>{if(location.pathname.endsWith('/ia-v2.html'))patchBuilder();if(location.pathname.endsWith('/whatsapp-config.html'))patchWhatsappActivation()});