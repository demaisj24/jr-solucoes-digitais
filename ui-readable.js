/* VENCIVO — camada visual de legibilidade. Não altera fluxos de negócio. */
(function(){
  if(window.__vencivoReadableUI)return;
  window.__vencivoReadableUI=true;
  const css=`
    body{font-size:16px!important}
    p,.muted,.hint,.tip,.sub,.description,.helper,.supporting-text,.status,.note,.eyebrow,.step,.online,small,label{font-size:15px!important;line-height:1.5!important}
    .hint,.tip,.helper,.supporting-text,.description{color:#aeb9c8!important}
    .field label{font-size:15px!important}
    .field small,.drop small,.file,.waHint,.modalFoot{font-size:13px!important}
    input,select,textarea{font-size:16px!important}
    button,.btn,a.btn{font-size:15px!important}
    #send{min-width:96px!important;width:auto!important;padding:10px 16px!important;font-size:15px!important;font-weight:900!important}
    .preview #send{min-width:96px!important;width:auto!important}
    #implant{width:100%!important;min-height:52px!important;margin-top:8px!important;padding:14px 18px!important;border:0!important;border-radius:13px!important;background:linear-gradient(135deg,#25d366,#16a34a)!important;color:#fff!important;font-size:16px!important;font-weight:950!important;box-shadow:0 10px 28px #16a34a35!important}
    .chat .msg,.messages .msg{font-size:16px!important;line-height:1.55!important}
    .summary div,.summary span{font-size:14px!important;line-height:1.5!important}
    @media(max-width:560px){p,.muted,.hint,.tip,.sub,.description,.helper,.supporting-text,.status,.note,.eyebrow,.step,.online,small,label{font-size:14px!important}.field label{font-size:14px!important}input,select,textarea{font-size:16px!important}.chat .msg,.messages .msg{font-size:15px!important}}
  `;
  const s=document.createElement('style');s.id='vencivo-readable-ui';s.textContent=css;document.head.appendChild(s);

  function normalizeSend(){
    const send=document.getElementById('send');
    if(!send)return;
    if(send.textContent!=='ENVIAR')send.textContent='ENVIAR';
    if(send.getAttribute('aria-label')!=='Enviar mensagem')send.setAttribute('aria-label','Enviar mensagem');
  }

  function getAgentId(){
    const saved=localStorage.getItem('vencivo_ai_current_agent');
    if(saved)return saved;
    const href=document.getElementById('openAgent')?.getAttribute('href')||'';
    const m=href.match(/[?&]id=([^&]+)/);
    return m?decodeURIComponent(m[1]):'';
  }

  async function startImplant(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    const b=document.getElementById('implant');
    const agentId=getAgentId();
    if(!agentId){toast('O agente ainda não possui ID de implantação. Crie o agente novamente.');return;}
    try{
      if(b)b.textContent='PREPARANDO PAGAMENTO...';
      if(b)b.style.pointerEvents='none';
      const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const supabase=mod.createClient('https://uxmlmyhiagjefuufanyg.supabase.co','sb_publishable_wAajSubj-zZE7kFh7EAxog_2FxCrs6Z');
      const {data,error}=await supabase.auth.getSession();
      if(error||!data?.session?.access_token){localStorage.setItem('vencivo_pending_implant_agent',agentId);location.href='conta.html';return;}
      const session=data.session;
      const phone=document.getElementById('whatsapp')?.value?.trim()||'';
      const name=session.user?.user_metadata?.full_name||session.user?.email||'Cliente VENCIVO';
      const r=await fetch('/api/asaas-checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({agent_id:agentId,name,phone}),cache:'no-store'});
      const p=await r.json().catch(()=>({}));
      if(!r.ok||!p.checkout_url)throw new Error(p.error||'Não foi possível iniciar o pagamento agora.');
      location.href=p.checkout_url;
    }catch(err){
      if(b){b.textContent='QUERO IMPLANTAR';b.style.pointerEvents='';}
      toast(err.message||'Não foi possível iniciar a implantação agora.');
    }
  }

  function toast(text){let el=document.getElementById('vencivoReadableToast');if(!el){el=document.createElement('div');el.id='vencivoReadableToast';Object.assign(el.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',zIndex:'99999',padding:'12px 16px',borderRadius:'12px',background:'#111a2a',color:'#fff',border:'1px solid #ffffff22',boxShadow:'0 15px 50px #0008',font:'600 14px system-ui',maxWidth:'90vw',textAlign:'center'});document.body.appendChild(el)}if(el.textContent!==text)el.textContent=text;el.style.display='block';clearTimeout(window._vru);window._vru=setTimeout(()=>el.style.display='none',2800)}

  function normalizeImplant(){
    const b=document.getElementById('implant');
    if(!b)return;
    if(b.textContent!=='QUERO IMPLANTAR')b.textContent='QUERO IMPLANTAR';
    if(b.getAttribute('href')!==null)b.removeAttribute('href');
    if(b.getAttribute('target')!==null)b.removeAttribute('target');
    if(b.dataset.readableImplant!=='1'){
      b.dataset.readableImplant='1';
      b.addEventListener('click',startImplant,true);
    }
  }

  function run(){normalizeSend();normalizeImplant();}
  run();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;run();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
