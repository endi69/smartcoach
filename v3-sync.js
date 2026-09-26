'use strict';
async function syncHealthV3({silent=true,rebuild=false}={}){
  try{
    const r=await fetch('/api/health?'+(rebuild?'rebuild=1&':'')+'t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const raw=await r.json();
    state.health={...(state.health||{}),status:'ok',lastSync:new Date().toISOString(),receivedAt:raw.receivedAt||null,
      latest:raw.metrics||{},metricDates:raw.metricDates||{},series:raw.series||{},sleepDetails:raw.sleepDetails||{},parserVersion:raw.parserVersion||3};
    save();if(!silent)toast('Apple Health aggiornato ✓');return true;
  }catch(e){
    state.health={...(state.health||{}),status:'error',error:String(e.message||e),lastAttempt:new Date().toISOString()};save();
    if(!silent)toast('Health non aggiornato');return false;
  }
}
syncHealthOnOpen=syncHealthV3;window.syncHealthOnOpen=syncHealthV3;

async function syncCorosV3({silent=true,force=false}={}){
  try{
    const r=await fetch('/api/coros?'+(force?'force=1&':'')+'t='+Date.now(),{cache:'no-store'});
    if(r.status===401){
      const x=await r.json();state.coros={...(state.coros||{}),connectionStatus:'disconnected',connectUrl:x.connectUrl||'/api/coros-connect'};save();return false;
    }
    if(!r.ok)throw new Error('HTTP '+r.status);
    const raw=await r.json(),fit=raw.fitness||{};
    state.coros={...(state.coros||{}),...raw,connectionStatus:'connected',
      synced:(raw.syncedAt||'').slice(0,10)||state.coros.synced,
      vo2max:fit.vo2max??raw.vo2max??state.coros.vo2max,
      runningLevel:fit.runningLevel??raw.runningLevel??state.coros.runningLevel,
      thresholdPace:fit.thresholdPace??raw.thresholdPace??state.coros.thresholdPace,
      racePredictions:raw.racePredictions||fit.racePredictions||state.coros.racePredictions,
      recovery:raw.recovery||state.coros.recovery,
      recoveryValue:raw.recovery?.value??raw.recoveryValue??state.coros.recoveryValue,
      recoveryText:raw.recovery?.text??raw.recoveryText??state.coros.recoveryText};
    save();if(!silent)toast('COROS aggiornato ✓');return true;
  }catch(e){
    state.coros={...(state.coros||{}),connectionStatus:'error',remoteError:String(e.message||e)};save();
    if(!silent)toast('COROS non aggiornato');return false;
  }
}
syncCorosOnOpen=syncCorosV3;window.syncCorosOnOpen=syncCorosV3;

async function syncCalendarV3({silent=true}={}){
  try{
    const r=await fetch('/api/calendar?t='+Date.now(),{cache:'no-store'}),raw=await r.json();
    if(!r.ok){
      state.calendar={...(state.calendar||{}),status:r.status===503?'setup_needed':'error',error:raw.error||('HTTP '+r.status)};save();return false;
    }
    state.calendar={status:'ok',events:raw.events||[],shifts:raw.shifts||[],lastSync:raw.syncedAt||new Date().toISOString(),source:'Google Calendar'};save();
    if(!silent)toast('Calendar aggiornato ✓');return true;
  }catch(e){
    state.calendar={...(state.calendar||{}),status:'error',error:String(e.message||e)};save();
    if(!silent)toast('Calendar non aggiornato');return false;
  }
}
window.syncCalendarV3=syncCalendarV3;

function v3RenderCurrent(){
  const tab=document.querySelector('.bottom-nav button.active')?.dataset.tab;
  if(tab==='week')weekView();
  else if(tab==='trend')trendView();
  else if(tab==='train'&&!state.selectedSession)trainingHub();
  else if(tab==='more'&&state.moreView==='connections')connectionsPage();
  else if(tab==='today')todayView(state.selectedDate||v3Today());
}
async function syncAllV3({silent=true}={}){
  const r=await Promise.allSettled([syncHealthV3({silent}),syncCorosV3({silent}),syncCalendarV3({silent})]);
  v3RenderCurrent();return r;
}
window.syncAllV3=syncAllV3;

connectionsPage=function(){
  setHeader('Connessioni','sincronizzazione automatica');
  const h=state.health||{},c=state.coros||{},g=state.calendar||{},corosConnected=c.connectionStatus==='connected',calendarOk=g.status==='ok';
  app.innerHTML=`<div class="stack"><button class="btn ghost smallbtn" onclick="backMore()">‹ Altro</button>
  <section class="card"><div class="row"><div><h3>Apple Health</h3><p class="muted tiny" style="margin:0">Health Exporter → Vercel → SmartCoach</p></div><span class="pill ${h.status==='ok'?'good':'warn'}">${h.status==='ok'?'attivo':'da verificare'}</span></div><div class="grid2" style="margin-top:10px"><div class="metric"><small>Ultimo arrivo</small><b>${h.receivedAt?new Date(h.receivedAt).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'–'}</b></div><div class="metric"><small>Parser</small><b>v${h.parserVersion||'–'}</b></div></div><div class="actions"><button class="btn secondary" onclick="syncHealthV3({silent:false})">Aggiorna</button><button class="btn secondary" onclick="syncHealthV3({silent:false,rebuild:true})">Ricalcola storico</button></div></section>
  <section class="card"><div class="row"><div><h3>COROS</h3><p class="muted tiny" style="margin:0">OAuth + MCP ufficiale</p></div><span class="pill ${corosConnected?'good':'warn'}">${corosConnected?'connesso':'non connesso'}</span></div><p class="muted small">Attività, Running Fitness, recovery, carico, sonno e dati giornalieri vengono interrogati automaticamente all'apertura.</p><div class="actions">${corosConnected?'<button class="btn secondary" onclick="syncCorosV3({silent:false,force:true}).then(()=>connectionsPage())">Sincronizza ora</button>':'<button class="btn" onclick="location.href=\'/api/coros-connect\'">Connetti COROS</button>'}</div></section>
  <section class="card"><div class="row"><div><h3>Google Calendar</h3><p class="muted tiny" style="margin:0">Feed iCal privato, sola lettura</p></div><span class="pill ${calendarOk?'good':'warn'}">${calendarOk?'attivo':'da configurare'}</span></div>${calendarOk?`<p class="muted small">${g.shifts?.length||0} turni rilevati · ultimo sync ${g.lastSync?new Date(g.lastSync).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'–'}.</p><button class="btn secondary" onclick="syncCalendarV3({silent:false}).then(()=>connectionsPage())">Aggiorna</button>`:'<p class="muted small">Per il sync autonomo serve una sola volta l’indirizzo iCal privato del calendario come variabile <b>GOOGLE_CALENDAR_ICS_URL</b> su Vercel. Dopo, non serve più inserire i turni a mano.</p>'}</section>
  <section class="card soft"><button class="btn" onclick="syncAllV3({silent:false})">Sincronizza tutto</button></section></div>`;
};

moreHome=function(){
  setTab('more');state.moreView=null;save();setHeader('Altro','');
  app.innerHTML=`<div class="menu-grid"><button class="menu" onclick="moreView('goals')"><b>Obiettivi</b><span>Modificano il piano</span></button><button class="menu" onclick="moreView('recovery')"><b>Recovery</b><span>Dati e spiegazione</span></button><button class="menu" onclick="moreView('body')"><b>Corpo</b><span>Peso e misure</span></button><button class="menu" onclick="moreView('nutrition')"><b>Nutrizione</b><span>Solo se vuoi tracciarla</span></button><button class="menu" onclick="moreView('sleep')"><b>Sonno</b><span>Principale + nap</span></button><button class="menu" onclick="moreView('connections')"><b>Connessioni</b><span>Health, COROS, Calendar</span></button><button class="menu" onclick="moreView('data')"><b>Dati</b><span>Backup e ripristino</span></button></div>`;
};
addShift=function(){
  const d=val('shiftDate'),title=(val('shiftTitle')||'Turno').trim(),load=clamp(+val('shiftLoad')||1,1,4);
  if(!d){toast('Scegli una data');return}
  state.shifts=(state.shifts||[]).filter(s=>!(s.source==='manual'&&s.date===d));state.shifts.push({date:d,title,load,source:'manual'});save();toast('Turno manuale salvato');recoveryPage();
};

function v3Boot(){
  state.selectedSession=null;save();todayView(v3Today());
  syncAllV3({silent:true});
  setInterval(()=>{if(document.visibilityState==='visible')syncAllV3({silent:true})},15*60*1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncAllV3({silent:true})});
}
v3Boot();
