const SUPABASE_URL=process.env.SUPABASE_URL||'https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});

  const expected=process.env.CRON_SECRET||'';
  const authorization=String(req.headers.authorization||'');
  if(!expected||authorization!==`Bearer ${expected}`){
    return res.status(401).json({ok:false,error:'Unauthorized'});
  }

  if(!SERVICE_ROLE_KEY){
    console.error('SEC20 keepalive: SUPABASE_SERVICE_ROLE_KEY not configured');
    return res.status(500).json({ok:false,error:'Supabase not configured'});
  }

  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/agents?select=id&limit=1`,{
      headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`}
    });
    if(!r.ok){
      console.error('SEC20 keepalive: Supabase request failed',{status:r.status});
      return res.status(502).json({ok:false,error:'Supabase unavailable'});
    }
    return res.status(200).json({ok:true});
  }catch(e){
    console.error('SEC20 keepalive: request failed',{error:e?.message});
    return res.status(502).json({ok:false,error:'Supabase unavailable'});
  }
}
