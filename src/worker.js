// Himalayan Regency Cloudflare Worker + D1 SQLite.
const json = (v, status=200, headers={}) => new Response(JSON.stringify(v), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const bytes = s => new TextEncoder().encode(s);
const hex = b => Array.from(new Uint8Array(b), x=>x.toString(16).padStart(2,'0')).join('');
async function hmac(secret, payload) {
  const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,bytes(payload)));
}
async function validSession(request, env) {
  const cookie=request.headers.get('cookie')||'';
  const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('hr_session='))?.slice(11);
  if(!token) return false;
  const match=/^(\d+)\.([a-f0-9]{64})$/.exec(token);
  if(!match || Number(match[1])<Date.now() || Number(match[1])>Date.now()+8*86400000) return false;
  return (await hmac(env.SESSION_SECRET,match[1]))===match[2];
}
const baseCookie='Path=/; HttpOnly; Secure; SameSite=Lax';
const defaultState={opening:0,entries:[],pending:[],cars:[],sheetTotals:{}};
function validateState(v) {
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('State must be an object');
  if(!Number.isFinite(v.opening)||Math.abs(v.opening)>1e12)throw Error('Invalid opening balance');
  if(v.sheetTotals!==undefined) {
    if(!v.sheetTotals||typeof v.sheetTotals!=='object'||Array.isArray(v.sheetTotals)||Object.keys(v.sheetTotals).length>100000)throw Error('Invalid sheet totals');
    for(const [date,totals] of Object.entries(v.sheetTotals)) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!totals||typeof totals!=='object')throw Error('Invalid sheet totals');
      for(const key of ['cashReceived','onlineReceived','cashExpenses','grandTotal'])if(!Number.isFinite(totals[key])||Math.abs(totals[key])>1e12)throw Error('Invalid sheet totals');
    }
  }
  for(const kind of ['entries','pending','cars']) {
    if(!Array.isArray(v[kind]) || v[kind].length>100000)throw Error('Invalid '+kind);
    const seen=new Set();
    for(const x of v[kind]) {
      if(!x||typeof x!=='object'||typeof x.id!=='string'||x.id.length>160||seen.has(x.id))throw Error('Duplicate or invalid '+kind+' ID');
      seen.add(x.id);
      if(kind==='entries' && (!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||!['incoming','outgoing'].includes(x.type)||!Number.isFinite(x.amount)||x.amount<=0||x.amount>1e10||typeof x.desc!=='string'||x.desc.length>1000||!['Cash','Online','Other'].includes(x.mode)))throw Error('Invalid transaction');
      if(kind==='pending' && (typeof x.room!=='string'||!Number.isFinite(x.due)||x.due<0||x.due>1e10))throw Error('Invalid pending room');
      if(kind==='cars' && (!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||typeof x.car!=='string'||!Number.isInteger(x.rounds)||x.rounds<1||x.rounds>100000||!Number.isFinite(x.amount)||x.amount<0))throw Error('Invalid car round');
    }
  }
}
export default {
  async fetch(request, env) {
    const url=new URL(request.url),path=url.pathname;
    if(!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if(!env.DB || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({error:'Deployment incomplete: D1 and secrets are required.'},503);
    try {
      if(path==='/api/health' && request.method==='GET')return json({ok:true});
      if(path==='/api/login' && request.method==='POST') {
        if(Number(request.headers.get('content-length')||0)>2048)return json({error:'Too large'},413);
        const body=await request.json();
        if(typeof body.password!=='string'||body.password.length>256||body.password!==env.ADMIN_PASSWORD)return json({error:'Incorrect password'},401);
        const expiry=String(Date.now()+7*86400000),sig=await hmac(env.SESSION_SECRET,expiry);
        return json({ok:true},200,{'set-cookie':`hr_session=${expiry}.${sig}; ${baseCookie}; Max-Age=604800`});
      }
      if(path==='/api/logout' && request.method==='POST')return json({ok:true},200,{'set-cookie':`hr_session=; ${baseCookie}; Max-Age=0`});
      if(!await validSession(request,env))return json({error:'Please sign in'},401);
      if(path==='/api/me' && request.method==='GET')return json({authenticated:true});
      if(path==='/api/state' && request.method==='GET') {
        const row=await env.DB.prepare('SELECT payload,revision FROM app_state WHERE id=1').first();
        if(!row)return json({error:'Database not initialized; apply the migration.'},503);
        return json({state:JSON.parse(row.payload),revision:row.revision});
      }
      if(path==='/api/state' && request.method==='PUT') {
        const raw=await request.text();
        if(raw.length>1000000)return json({error:'Account size too large; export and archive old data.'},413);
        const body=JSON.parse(raw);
        if(!Number.isSafeInteger(body.revision)||body.revision<0)return json({error:'Invalid revision'},400);
        validateState(body.state);
        const result=await env.DB.prepare('UPDATE app_state SET payload=?, revision=revision+1, updated_at=datetime(\'now\') WHERE id=1 AND revision=?')
          .bind(JSON.stringify(body.state),body.revision).run();
        if(result.meta.changes!==1)return json({error:'Another device changed the Day Book. Reload before editing to prevent overwriting their work.',code:'CONFLICT'},409);
        return json({ok:true,revision:body.revision+1});
      }
      return json({error:'Not found'},404);
    } catch(e) {
      if(e instanceof SyntaxError)return json({error:'Invalid JSON'},400);
      if(String(e.message||'').startsWith('Invalid')||String(e.message||'').startsWith('Duplicate'))return json({error:e.message},400);
      console.error('Request failed',e);
      return json({error:'Server error. Check Worker logs and database migration.'},500);
    }
  }
};
