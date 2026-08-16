import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabase=createClient('https://uxmlmyhiagjefuufanyg.supabase.co','sb_publishable_wAajSubj-zZE7kFh7EAxog_2FxCrs6Z',{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
let running=false;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function directAgents(){
  const{data,error}=await supabase.from('agents').select('public_id,company_name,agent_name,segment,status,created_at,updated_at').order('created_at',{ascending:false}).limit(50);
  if(error){console.error('conta-fix direct agents:',error);return null}
  return Array.isArray(data)?data:[];
}
async function apiAgents(session){
  const r=await fetch('/api/agents?mine=1',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
  const p=await r.json().catch(()=>({}));
  return{ok:r.ok,status:r.status,list:Array.isArray(p.agents)?p.agents:[]};
}
async function getAgents(){
  for(let attempt=0;attempt<6;attempt++){
    let{data}=await supabase.auth.getSession();
    let session=data?.session;
    if(session){
      if(attempt===0){
        try{
          const refreshed=await supabase.auth.refreshSession();
          if(refreshed.data?.session){session=refreshed.data.session}else if(refreshed.error)console.warn('conta-fix refresh:',refreshed.error.message)
        }catch(error){console.warn('conta-fix refresh:',error)}
      }
      try{
        const direct=await directAgents();
        if(direct?.length)return direct;
        if(direct&&attempt>=2)return[];
      }catch(error){console.error('conta-fix direct agents:',error)}
      try{
        const result=await apiAgents(session);
        if(result.ok&&result.list.length)return result.list;
        if(result.status===401){
          const refreshed=await supabase.auth.refreshSession();
          if(refreshed.data?.session){
            const retry=await apiAgents(refreshed.data.session);
            if(retry.ok&&retry.list.length)return retry.list;
          }
        }
      }catch(error){console.error('conta-fix api agents:',error)}
    }
    await wait(300+attempt*300);
  }
  return null;
}
function render(list){
  const box=$('agents'),dashboard=$('dashboard'),auth=$('authCard'),billing=$('billing');
  if(!box||!dashboard)return;
  dashboard.classList.remove('hidden');
  auth?.classList.add('hidden');
  box.innerHTML=list.length?list.map(a=>`<div class="agent"><div><b>${esc(a.agent_name)}</b><span class="muted">${esc(a.company_name)} · ${esc(a.segment)}</span><span class="status">● ${esc(a.status)}</span></div><a class="btn" href="agente.html?id=${encodeURIComponent(a.public_id)}">Abrir</a></div>`).join(''):'<p class="muted">Você ainda não possui agentes salvos nesta conta. Crie seu primeiro agente para começar.</p>';
  if(billing)billing.classList.toggle('hidden',!list.length);
}
async function sync(){
  if(running)return;
  running=true;
  try{
    const list=await getAgents();
    if(list===null)return;
    const{data}=await supabase.auth.getSession();
    if(!data?.session)return;
    if($('userEmail'))$('userEmail').textContent=data.session.user.email||'';
    render(list);
  }finally{running=false}
}
setTimeout(sync,200);
setTimeout(sync,1200);
setTimeout(sync,2500);
setTimeout(sync,5000);
setTimeout(sync,9000);
window.addEventListener('focus',sync);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
supabase.auth.onAuthStateChange(()=>setTimeout(sync,150));