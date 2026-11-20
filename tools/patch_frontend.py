from pathlib import Path
p=Path(__file__).resolve().parents[1]/'public/index.html'
s=p.read_text()
s=s.replace('Prototype: Entries are saved in this browser only. For real multi-phone syncing, we will connect a secure cloud database.','Cloudflare D1 cloud sync enabled. Entries save securely online; refresh before editing after another staff member makes changes.')
s=s.replace('Local only; never uploads files to a server.','Imported data is saved to your Cloudflare D1 database after confirmation.')
s=s.replace("const KEY='himalayan-regency-daybook-v1', $=id=>document.getElementById(id), money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2}), today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);let data;try{data=JSON.parse(localStorage.getItem(KEY))||{opening:0,entries:[],pending:[],cars:[]}}catch{data={opening:0,entries:[],pending:[],cars:[]}};", "const $=id=>document.getElementById(id), money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2}), today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);let data={opening:0,entries:[],pending:[],cars:[]};")
s=s.replace('const save=()=>{localStorage.setItem(KEY,JSON.stringify(data));render()};','const save=()=>{render(); queueSave()};')
# Avoid normalizing imported x.id same date for multiple identical entries (existing behavior intentionally dedups)
# Login and cloud sync before existing closing script.
s=s.replace('</style></head><body>', '''
#authLayer{position:fixed;z-index:9999;inset:0;background:#f4f7fb;display:flex;align-items:center;justify-content:center;padding:20px}
#authLayer[hidden]{display:none}#authPanel{width:min(420px,100%);background:white;border-radius:20px;box-shadow:0 12px 50px #12294a20;padding:32px}
#authPanel input{width:100%;padding:13px;border:1px solid #cbd5e1;border-radius:10px;margin:10px 0 16px}
#authPanel .btn{width:100%}#authError{color:#b91c1c;min-height:20px;font-size:13px}
#syncStatus{font-size:12px;color:#68778f}#accountTools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
</style></head><body>
<div id="authLayer"><div id="authPanel"><h2>The Himalayan Regency</h2><p>Private Hotel Day Book • Secure cloud access</p><form id="authForm"><label for="hotelPassword">Hotel account password</label><input type="password" id="hotelPassword" required autocomplete="current-password" placeholder="Enter password"><button type="submit" class="btn">Sign in</button></form><p id="authError"></p><p class="help">Your data is stored in Cloudflare D1. Ask the hotel owner for the password.</p></div></div>''')
s=s.replace('<button class="btn secondary" id="export">↓ Backup Data</button>', '<div id="accountTools"><span id="syncStatus">Connecting…</span><button class="btn secondary" id="refreshCloud" type="button">↻ Refresh</button><button class="btn secondary" id="signout" type="button">Sign out</button><button class="btn secondary" id="export">↓ Backup Data</button></div>')
assert '</script></body></html>' in s
client='''
// Persistent Cloudflare D1 sync. Every save is version checked to prevent silent overwrite.
let revision=0, queuedState=null, syncing=false, ready=false;
async function requestApi(path, options={}) {
 const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});
 const body=await response.json().catch(()=>({error:'Invalid response from server'}));
 if(!response.ok){let error=new Error(body.error||'Request failed');error.status=response.status;throw error}
 return body;
}
function syncText(s){$('syncStatus').textContent=s}
async function loadCloud(){
 syncText('Refreshing…');
 const value=await requestApi('state');
 data=value.state;revision=value.revision;
 data.entries??=[];data.pending??=[];data.cars??=[];data.opening??=0;
 ready=true;render();syncText('✓ Synced to Cloudflare');
}
function queueSave(){
 if(!ready) return;
 queuedState=JSON.parse(JSON.stringify(data));
 syncText('Saving…');
 if(!syncing) flushSaves();
}
async function flushSaves(){
 syncing=true;
 while(queuedState){
  const state=queuedState;queuedState=null;
  try{
   const out=await requestApi('state',{method:'PUT',body:JSON.stringify({state,revision})});
   revision=out.revision;syncText(queuedState?'Saving…':'✓ Synced to Cloudflare');
  }catch(error){
   if(error.status===409){
    ready=false;queuedState=null;
    // Preserve uncommitted edits as a downloadable recovery file.
    download('daybook-unsynced-recovery.json',JSON.stringify(data,null,2),'application/json');
    alert('Another device updated this hotel account. Your unsaved version was downloaded as a recovery backup. The latest cloud version will now load. Review changes before re-importing.');
    try{await loadCloud()}catch(e){syncText('Refresh failed: '+e.message)}
   }else{
    queuedState=queuedState||state;
    syncText('⚠ Not saved — check internet, then Refresh');
    alert('Could not save to Cloudflare: '+error.message+'\\nKeep this tab open and use Backup Data to protect changes.');
   }
   break;
  }
 }
 syncing=false;
}
async function enterApp(){
 try{await loadCloud();$('authLayer').hidden=true;$('authError').textContent=''}
 catch(error){$('authError').textContent=error.message;syncText('Not connected');$('authLayer').hidden=false}
}
$('authForm').onsubmit=async e=>{
 e.preventDefault();$('authError').textContent='Signing in…';
 try{await requestApi('login',{method:'POST',body:JSON.stringify({password:$('hotelPassword').value})});$('hotelPassword').value='';await enterApp()}
 catch(error){$('authError').textContent=error.message}
};
$('signout').onclick=async()=>{
 if(syncing||queuedState){alert('Please wait for your changes to sync before signing out.');return}
 await requestApi('logout',{method:'POST'}).catch(()=>{});
 ready=false;data={opening:0,entries:[],pending:[],cars:[]};$('authLayer').hidden=false;syncText('Signed out');
};
$('refreshCloud').onclick=async()=>{
 if(syncing||queuedState){alert('There are local changes waiting to save. Do not refresh until they sync.');return}
 try{await loadCloud()}catch(error){alert('Refresh failed: '+error.message)}
};
(async()=>{try{await requestApi('me');await enterApp()}catch(e){$('authLayer').hidden=false;$('authError').textContent='Sign in to connect to your hotel database.'}})();
'''
s=s.replace('</script></body></html>',client+'</script></body></html>')
p.write_text(s)
