import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabase=createClient('https://uxmlmyhiagjefuufanyg.supabase.co','sb_publishable_wAajSubj-zZE7kFh7EAxog_2FxCrs6Z',{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
let running=false;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function apiAgents(session){
  const r=await fetch('/api/agents?mine=1',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
  const p=await r.json().catch(()=>({}));
  if(!r.ok)return{ok:false,status:r.status,list:[]};
  return{ok:true,status:r.status,list:Array.isArray(p.agents)?p.agents:[]};
}
async function directAgents(){
  const{data,error}=await supabase.from('agents').select('public_id,company_name,agent_name,segment,status,created_at,updated_at').order('created_at',{ascending:false}).limit(50);
  if(error)return null;
  return Array.isArray(data)?data:[];
}
async function getAgents(){
  for(let attempt=0;attempt<3;attempt++){
    let session=(await supabase.auth.getSession()).data?.session;
    if(!session)return null;
    let result=await apiAgents(session);
    if(result.ok&&result.list.length)return result.list;
    if(result.status===401){
      const refreshed=await supabase.auth.refreshSession();
      session=refreshed.data?.session;
      if(session){
        result=await apiAgents(session);
        if(result.ok&&result.list.length)return result.list;
      }
    }
    if(attempt<2)await wait(250*(attempt+1));
  }
  return directAgents();
}
async function sync(){
  if(running)return;
  running=true;
  try{
    const list=await getAgents();
    if(!list)return;
    const box=$('agents'),dashboard=$('dashboard'),auth=$('authCard'),billing=$('billing');
    if(!box||!dashboard)return;
    dashboard.classList.remove('hidden');
    auth?.classList.add('hidden');
    const email=(await supabase.auth.getSession()).data?.session?.user?.email||'';
    if($('userEmail'))$('userEmail').textContent=email;
    box.innerHTML=list.length?list.map(a=>`<div class="agent"><div><b>${esc(a.agent_name)}</b><span class="muted">${esc(a.company_name)} · ${esc(a.segment)}</span><span class="status">● ${esc(a.status)}</span></div><a class="btn" href="agente.html?id=${encodeURIComponent(a.public_id)}">Abrir</a></div>`).join(''):'<p class="muted">Você ainda não possui agentes salvos nesta conta. Crie seu primeiro agente para começar.</p>';
    if(billing)billing.classList.toggle('hidden',!list.length);
  }finally{running=false}
}
setTimeout(sync,300);
window.addEventListener('focus',sync);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
supabase.auth.onAuthStateChange(()=>setTimeout(sync,150));
