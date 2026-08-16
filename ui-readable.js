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
    #send{min-width:92px!important;width:auto!important;padding:10px 16px!important;font-size:15px!important;font-weight:900!important}
    .preview #send{min-width:92px!important;width:auto!important}
    #implant{font-size:16px!important}
    .chat .msg,.messages .msg{font-size:16px!important;line-height:1.55!important}
    @media(max-width:560px){p,.muted,.hint,.tip,.sub,.description,.helper,.supporting-text,.status,.note,.eyebrow,.step,.online,small,label{font-size:14px!important}.field label{font-size:14px!important}input,select,textarea{font-size:16px!important}.chat .msg,.messages .msg{font-size:15px!important}}
  `;
  const s=document.createElement('style');s.id='vencivo-readable-ui';s.textContent=css;document.head.appendChild(s);
  function normalizeSend(){
    const send=document.getElementById('send');
    if(send && send.textContent.trim()!=='ENVIAR')send.textContent='ENVIAR';
  }
  normalizeSend();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalizeSend,{once:true});
})();
