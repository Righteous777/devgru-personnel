const cloud = (()=>{
 const cfg=window.DEVGRU_CONFIG||{},url=(cfg.url||'').replace(/\/$/,''),key=cfg.key||'',store='devgru-cloud-session:'+url;
 function check(){if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!key||key.includes('YOUR_')||url.includes('YOUR-'))throw Error('Configure your Supabase URL and publishable key in config.js first.');if(!key.startsWith('sb_publishable_'))throw Error('Use the Supabase publishable key only.');}
 function read(){try{return JSON.parse(sessionStorage.getItem(store)||'null')}catch{return null}}
 function write(s){const old=read(), now=Date.now();const full={...s,started:old?.started||now,activity:now,expires_at:s.expires_at||Math.floor(now/1000)+(s.expires_in||3600)};sessionStorage.setItem(store,JSON.stringify(full));return full}
 function clear(){sessionStorage.removeItem(store)}
 function valid(s){return s?.started&&Date.now()-s.started<8*3600000&&Date.now()-s.activity<15*60000}
 function touch(){let s=read();if(valid(s)){s.activity=Date.now();sessionStorage.setItem(store,JSON.stringify(s))}}
 function aal(t){try{let v=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(v)).aal}catch{return ''}}
 async function request(path,{method='GET',body,token,prefer}={}){check();return fetch(url+path,{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});}
 async function login(email,password,captcha){clear();let r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password,...(captcha?{gotrue_meta_security:{captcha_token:captcha}}:{})}});let j=await r.json();if(!r.ok)throw Error('Sign-in failed. Check credentials or CAPTCHA and retry.');return write(j)}
 async function authCall(path,method='GET',body){let t=await token();if(!t)throw Error('Sign in again');let r=await request('/auth/v1'+path,{method,body,token:t});let j=await r.json();if(!r.ok)throw Error(j.msg||j.message||'Authentication request failed');return j}
 async function factors(){let u=await authCall('/user');return (u.factors||[]).filter(f=>f.factor_type==='totp'&&f.status==='verified')}
 async function enroll(){return authCall('/factors','POST',{factor_type:'totp',friendly_name:'DEVGRU '+Date.now()})}
 async function verify(id,code){let c=await authCall('/factors/'+encodeURIComponent(id)+'/challenge','POST',{});let j=await authCall('/factors/'+encodeURIComponent(id)+'/verify','POST',{challenge_id:c.id,code});if(!j.access_token||aal(j.access_token)!=='aal2')throw Error('MFA session was not verified');write(j);return true}
 let refreshing;
 async function token(){let s=read();if(!valid(s)){clear();return null;}if(s.expires_at>Date.now()/1000+60)return s.access_token;if(!refreshing)refreshing=(async()=>{try{let r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}});if(!r.ok){sessionStorage.removeItem(store);return null;}return write(await r.json()).access_token;}finally{refreshing=null}})();return refreshing;}
 async function logout(){try{let t=await token();if(t)await request('/auth/v1/logout',{method:'POST',token:t});}finally{sessionStorage.removeItem(store);location.href='./index.html'}}
 async function adminFetch(path,opt={}){let t=await token();if(!t||aal(t)!=='aal2')return new Response('{}',{status:401});const dest='/rest/v1/devgru_state?id=eq.1';
  if(opt.method==='PUT'){let v=JSON.parse(opt.body);let r=await request(dest+'&revision=eq.'+encodeURIComponent(v.revision),{method:'PATCH',body:{db:v.db,revision:v.revision+1},token:t,prefer:'return=representation'});if(!r.ok)return r;let a=await r.json();return a.length?new Response(JSON.stringify({revision:a[0].revision}),{status:200}):new Response('{}',{status:409});}
  let r=await request(dest+'&select=revision,db',{token:t});if(!r.ok)return r;let a=await r.json();return a.length?new Response(JSON.stringify(a[0]),{status:200}):new Response('{}',{status:401});}
 async function publicRoster(){let r=await request('/rest/v1/devgru_public?id=eq.1&select=snapshot');if(!r.ok)throw Error('Public roster unavailable: '+r.status);let a=await r.json();if(!a.length)throw Error('Run the database setup SQL first.');return a[0].snapshot;}
 async function publicRevision(){let r=await request('/rest/v1/devgru_public?id=eq.1&select=revision');if(!r.ok)throw Error('Roster unavailable');return (await r.json())[0]?.revision;}
 return {login,logout,adminFetch,publicRoster,publicRevision,factors,enroll,verify,touch,clear,validSession:()=>valid(read())};
})();
