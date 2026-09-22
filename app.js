'use strict';

const APP_VERSION='2.0.0';
const STORE_KEY='sc-state';
const TODAY=()=>new Date();
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDate=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const fmtDate=(s,opts={day:'numeric',month:'short'})=>parseDate(s).toLocaleDateString('it-IT',opts);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const round=(n,d=1)=>Number(Number(n).toFixed(d));
const uid=()=>`${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const PROFILE={
  name:'Endi',heightCm:180,weightKg:73,
  baseline:{pullups:10,chinups:10,dips:18,pushups:25,shoulderDbKg:6.5,chestKg:30},
  goals:['Ricostruire base aerobica Z2','Ipertrofia generale','Priorità gambe e lower back','Stabilità di anca e core'],
  detraining:'~2 mesi'
};

const COROS_DEFAULT={
  synced:'2026-09-23',vo2max:50,runningLevel:71,thresholdPace:'5:27/km',
  shortLoad:0,longLoad:36,loadRatio:0,recovery:100,recoveryText:'Heavy training allowed',
  restingHr:57,hrvBaseline:42,recentActivities:0
};

const SHIFT_DEFAULT=[
  {date:'2026-09-25',title:'Notte ambu',load:3},
  {date:'2026-09-26',title:'Reperibile notte',load:3},
  {date:'2026-09-27',title:'24 ore ambu',load:4},
  {date:'2026-09-28',title:'Pomeriggio + notte',load:4},
  {date:'2026-09-29',title:'Pomeriggio',load:2},
  {date:'2026-09-30',title:'Mattina',load:1}
];

const ex=(id,label,sets,min,max,opts={})=>({id,label,sets,min,max,...opts});
const STRENGTH={
  lowerA:{
    id:'lowerA',title:'Lower A · forza di base',short:'Lower A',mins:'50–60',focus:'Gambe + hinge + gluteo medio',
    exercises:[
      ex('squat','Squat pattern',3,8,12,{home:['KB/DB goblet squat','Tempo goblet squat','Split squat'],gym:['Leg press','Back squat','Hack squat'],increment:2.5,rest:120}),
      ex('rdl','Hip hinge',3,8,10,{home:['KB/DB Romanian deadlift','Single-leg RDL'],gym:['Romanian deadlift','DB Romanian deadlift'],increment:2.5,rest:120}),
      ex('bulgarian','Unilaterale',3,8,10,{home:['Bulgarian split squat','Reverse lunge'],gym:['Bulgarian split squat','Reverse lunge'],increment:2,rest:90,side:true}),
      ex('calf','Polpacci',3,12,15,{home:['Single-leg calf raise','Calf raise'],gym:['Standing calf raise','Seated calf raise'],increment:2.5,rest:60}),
      ex('glutemed','Gluteo medio',2,12,20,{home:['Side-lying hip abduction','Band lateral walk'],gym:['Cable hip abduction','Abductor machine'],increment:1,rest:45,side:true}),
      ex('core','Core',2,8,12,{home:['Dead bug','Bird dog'],gym:['Dead bug','Pallof press'],increment:0,rest:45,side:true})
    ]
  },
  upper:{
    id:'upper',title:'Upper · tirata/spinta',short:'Upper',mins:'45–55',focus:'Trazioni, dips, petto, dorso, spalle',
    exercises:[
      ex('pull','Vertical pull',4,5,8,{home:['Pull-up','Chin-up'],gym:['Pull-up','Lat machine','Chin-up'],increment:1,rest:120,bodyweight:true}),
      ex('dip','Vertical push',3,8,12,{home:['Dip','Push-up feet elevated'],gym:['Dip','Chest press'],increment:1,rest:120,bodyweight:true}),
      ex('press','Chest press',3,8,12,{home:['DB floor press','Push-up'],gym:['DB bench press','Chest press'],increment:2,rest:90}),
      ex('row','Horizontal pull',3,8,12,{home:['One-arm DB row','Cable row'],gym:['Cable row','Chest-supported row'],increment:2,rest:90}),
      ex('shoulder','Spalle',3,8,12,{home:['DB shoulder press','Pike push-up'],gym:['DB shoulder press','Machine shoulder press'],increment:1,rest:90}),
      ex('lateral','Deltoide laterale',2,12,15,{home:['DB lateral raise','Cable lateral raise'],gym:['Cable lateral raise','DB lateral raise'],increment:1,rest:60})
    ]
  },
  lowerB:{
    id:'lowerB',title:'Lower B · posterior chain',short:'Lower B',mins:'50–60',focus:'Glutei + femorali + lower back',
    exercises:[
      ex('squat2','Squat pattern',3,8,12,{home:['Goblet squat','Front-foot elevated split squat'],gym:['Back squat','Hack squat','Leg press'],increment:2.5,rest:120}),
      ex('hipthrust','Hip thrust',3,10,15,{home:['KB/DB hip thrust','Single-leg hip thrust'],gym:['Barbell hip thrust','Hip thrust machine'],increment:2.5,rest:120}),
      ex('lunge','Affondo',3,8,10,{home:['Reverse lunge','Walking lunge'],gym:['Reverse lunge','Walking lunge'],increment:2,rest:90,side:true}),
      ex('ham','Femorali',3,8,15,{home:['Single-leg RDL','Slider leg curl'],gym:['Leg curl','Romanian deadlift'],increment:2,rest:90}),
      ex('backext','Lower back',3,10,15,{home:['Bird dog row','Hip hinge isometrico'],gym:['Back extension','Reverse hyper'],increment:2,rest:75}),
      ex('glutemed2','Gluteo medio',2,12,20,{home:['Band lateral walk','Side plank + abduction'],gym:['Cable hip abduction','Abductor machine'],increment:1,rest:45,side:true})
    ]
  }
};

const CARDIO={
  z2short:{id:'z2short',type:'cardio',title:'Z2 · base aerobica',short:'Z2',mins:35,minMinutes:30,maxMinutes:40,focus:'Facile, conversazionale, senza inseguire il passo'},
  z2long:{id:'z2long',type:'cardio',title:'Z2 · endurance facile',short:'Z2 easy',mins:45,minMinutes:35,maxMinutes:50,focus:'Costruzione aerobica a bassa fatica'},
  runQuality:{id:'runQuality',type:'cardio',quality:true,title:'Corsa · qualità controllata',short:'Corsa qualità',mins:38,minMinutes:35,maxMinutes:45,focus:'10′ facile + 6×1′ brillante / 2′ facile + 10′ facile'},
  recovery:{id:'recovery',type:'recovery',title:'Recupero / mobilità',short:'Recupero',mins:20,focus:'Camminata facile + mobilità anche/schiena + respirazione'}
};

const WEEK_PLAN={0:'z2long',1:'lowerA',2:'z2short',3:'recovery',4:'upper',5:'recovery',6:'lowerB'};
const ALL_SESSIONS={...STRENGTH,...CARDIO};

function defaultState(){
  return {
    version:2,place:'CASA',history:[],selectedDate:dateKey(TODAY()),selectedSession:null,exerciseChoice:{},
    readiness:{},bodyLogs:[{date:'2026-09-23',weight:73,waist:null}],nutritionLogs:{},sleepLogs:{},
    coros:{...COROS_DEFAULT},shifts:SHIFT_DEFAULT.map(x=>({...x})),
    settings:{cardioDefault:'bike',reentry:true,weekStart:'monday'},
    profile:{...PROFILE,baseline:{...PROFILE.baseline}},moreView:null
  };
}

function migrate(raw){
  const d=defaultState();
  if(!raw||typeof raw!=='object')return d;
  if(raw.version===2){
    const rawCoros=raw.coros||{}, useBundled=!rawCoros.synced||String(d.coros.synced)>=String(rawCoros.synced);
    const coros=useBundled?{...rawCoros,...d.coros}:{...d.coros,...rawCoros};
    return {...d,...raw,settings:{...d.settings,...raw.settings},profile:{...d.profile,...raw.profile,baseline:{...d.profile.baseline,...(raw.profile?.baseline||{})}},coros,shifts:Array.isArray(raw.shifts)?raw.shifts:d.shifts};
  }
  if(Array.isArray(raw.history))d.history=raw.history.map(h=>({...h,legacy:true,id:h.id||uid()}));
  if(raw.place)d.place=raw.place;
  return d;
}

let state;
try{state=migrate(JSON.parse(localStorage.getItem(STORE_KEY)||'null'))}catch{state=defaultState()}
const save=()=>localStorage.setItem(STORE_KEY,JSON.stringify(state));
save();

const app=document.querySelector('#app');
const titleEl=document.querySelector('#title');
const subEl=document.querySelector('#sub');
document.querySelector('#version').textContent=`v${APP_VERSION}`;

function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),1800)}
function setHeader(title,sub){titleEl.textContent=title;subEl.textContent=sub||''}
function setTab(tab){document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab))}
function sessionById(id){return ALL_SESSIONS[id]||CARDIO.recovery}
function shiftOn(date){return state.shifts.find(s=>s.date===date)||null}
function baseSessionFor(date){return sessionById(WEEK_PLAN[parseDate(date).getDay()])}
function historyOn(date){return state.history.filter(h=>(h.date||'').slice(0,10)===date)}
function isDone(date,sid){return historyOn(date).some(h=>h.sessionId===sid||(!h.sessionId&&h.name===sessionById(sid).title))}

function latestReadiness(date){
  return state.readiness[date]||{sleepHours:null,sleepQuality:null,energy:null,soreness:null,stress:null,availableMinutes:50,rhr:null,hrv:null,temperatureDelta:null,corosRecovery:state.coros.recovery??null};
}
function scoreReadiness(date){
  const r=latestReadiness(date), vals=[];
  if(r.sleepHours!=null){const h=+r.sleepHours;vals.push(h>=7&&h<=9?100:h>=6?75:h>=5?50:25)}
  if(r.sleepQuality!=null)vals.push(clamp(+r.sleepQuality*20,0,100));
  if(r.energy!=null)vals.push(clamp(+r.energy*20,0,100));
  if(r.soreness!=null)vals.push(clamp((6-(+r.soreness))*20,0,100));
  if(r.stress!=null)vals.push(clamp((6-(+r.stress))*20,0,100));
  if(r.rhr!=null&&state.coros.restingHr){const d=+r.rhr-state.coros.restingHr;vals.push(d<=0?100:d<=3?85:d<=6?65:d<=10?40:20)}
  if(r.hrv!=null&&state.coros.hrvBaseline){const q=+r.hrv/state.coros.hrvBaseline;vals.push(q>=1?100:q>=.9?82:q>=.8?64:q>=.7?45:25)}
  if(r.corosRecovery!=null)vals.push(clamp(+r.corosRecovery,0,100));
  if(r.temperatureDelta!=null){const t=Math.abs(+r.temperatureDelta);vals.push(t<.25?100:t<.5?80:t<.8?55:30)}
  let score=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):70;
  const sh=shiftOn(date);if(sh)score-=sh.load>=4?24:sh.load>=3?16:sh.load===2?7:3;
  return clamp(score,0,100);
}
function readinessBand(score){return score>=75?'good':score>=55?'warn':'bad'}
function readinessLabel(score){return score>=75?'Pronto':score>=55?'Riduci':'Recupera'}

function recommendation(date){
  const base=baseSessionFor(date),score=scoreReadiness(date),shift=shiftOn(date);
  let session=base,adjust='Normale',reason='Programma della settimana',setDelta=0,cardioFactor=1;
  if(shift?.load>=3){session=CARDIO.recovery;adjust='Recupero';reason=`Carico lavorativo alto: ${shift.title}`;setDelta=-1;cardioFactor=.6}
  else if(score<55){session=CARDIO.recovery;adjust='Recupero';reason='Readiness bassa: oggi conviene proteggere il recupero';setDelta=-1;cardioFactor=.6}
  else if(score<75){adjust='-20% volume';reason='Readiness intermedia: mantieni lo stimolo senza accumulare fatica';setDelta=-1;cardioFactor=.8}
  else if(shift?.load===2){adjust='Compatto';reason=`Turno ${shift.title}: seduta più breve`;setDelta=-1;cardioFactor=.8}
  const avail=+(latestReadiness(date).availableMinutes||0);
  if(session.type!=='recovery'&&avail&&avail<=35&&score>=55){adjust=`Compatto ${avail} min`;reason=`Tempo disponibile: ${avail} min`;setDelta=Math.min(setDelta,-1);cardioFactor=Math.min(cardioFactor,avail<=25?.65:.8)}
  if(!currentReentry(date)&&base.id==='z2short'&&session===base&&score>=75&&(!shift||shift.load<=1)){session=CARDIO.runQuality;adjust='Qualità controllata';reason='Dopo la fase di rientro: primo stimolo di velocità, senza massimale'}
  if(base.type==='recovery'&&session===base){adjust='Recupero';reason='Giorno di recupero programmato'}
  return {base,session,score,shift,adjust,reason,setDelta,cardioFactor};
}

function todayView(date=state.selectedDate||dateKey(TODAY())){
  state.selectedDate=date;save();setTab('today');
  const rec=recommendation(date),r=latestReadiness(date),band=readinessBand(rec.score),done=historyOn(date);
  setHeader(date===dateKey(TODAY())?'Oggi':fmtDate(date,{weekday:'long',day:'numeric',month:'long'}),'Ipertrofia + base aerobica, adattate al recupero');
  const shiftHtml=rec.shift?`<span class="pill warn">Turno: ${esc(rec.shift.title)}</span>`:'<span class="pill">Nessun turno pesante</span>';
  app.innerHTML=`<div class="stack">
    <section class="card hero">
      <div class="row start">
        <div class="grow"><div class="pills"><span class="pill ${band}">${readinessLabel(rec.score)}</span>${shiftHtml}</div><h2 style="margin-top:12px">${esc(rec.session.title)}</h2><p class="muted small" style="margin:4px 0 0">${esc(rec.session.focus)}</p></div>
        <div class="score-ring" style="--score:${rec.score}"><b>${rec.score}</b><small>READY</small></div>
      </div>
      <div class="notice ${band==='good'?'goodbox':band==='warn'?'warnbox':''}" style="margin-top:14px"><strong>${esc(rec.adjust)}</strong> · ${esc(rec.reason)}</div>
      <div class="actions"><button class="btn" onclick="startRecommended('${date}')">${rec.session.type==='recovery'?'Apri recupero':'Inizia allenamento'}</button><button class="btn secondary" onclick="openCheckin('${date}')">Check-in</button></div>
    </section>

    <section class="grid3">
      <div class="metric"><small>COROS recovery</small><b>${state.coros.recovery??'–'}%</b></div>
      <div class="metric"><small>VO₂max</small><b>${state.coros.vo2max??'–'}</b></div>
      <div class="metric"><small>Carico 7g</small><b>${state.coros.shortLoad??'–'}</b></div>
    </section>

    <section class="card">
      <div class="row"><div><h3>Check-in rapido</h3><span class="muted small">Aggiorna il consiglio di oggi</span></div><span class="pill">${r.sleepHours?`${r.sleepHours} h sonno`:'sonno –'}</span></div>
      <div class="grid3" style="margin-top:12px"><div class="metric"><small>Energia</small><b>${r.energy??'–'}/5</b></div><div class="metric"><small>Dolori</small><b>${r.soreness??'–'}/5</b></div><div class="metric"><small>Stress</small><b>${r.stress??'–'}/5</b></div></div>
    </section>

    ${done.length?`<section class="card"><h3>Registrato oggi</h3>${done.map(historyLine).join('')}</section>`:''}

    <section class="card soft"><div class="row"><div><h3>Fase iniziale</h3><p class="muted small" style="margin:0">Rientro dopo ${esc(state.profile.detraining)}: niente cedimento nelle prime 2 settimane. Priorità a tecnica, continuità e tolleranza di gambe/lower back.</p></div></div></section>
  </div>`;
}

function openCheckin(date=state.selectedDate){
  const r=latestReadiness(date);
  setHeader('Readiness',fmtDate(date,{weekday:'long',day:'numeric',month:'long'}));
  app.innerHTML=`<div class="stack"><section class="card"><h2>Check-in di oggi</h2><p class="muted small">Scala 1–5. Il punteggio è una stima pratica, non un dato medico.</p>
    <div class="form-grid">
      <label>Sonno (ore)<input id="ciSleep" type="number" step="0.25" min="0" max="14" value="${r.sleepHours??''}"></label>
      <label>Qualità sonno<select id="ciSQ">${opts5(r.sleepQuality||3)}</select></label>
      <label>Energia<select id="ciEnergy">${opts5(r.energy||3)}</select></label>
      <label>Dolori muscolari<select id="ciSore">${opts5(r.soreness||2)}</select></label>
      <label>Stress<select id="ciStress">${opts5(r.stress||3)}</select></label>
      <label>Tempo disponibile<select id="ciTime"><option value="20" ${+r.availableMinutes===20?'selected':''}>20 min</option><option value="35" ${+r.availableMinutes===35?'selected':''}>35 min</option><option value="50" ${!r.availableMinutes||+r.availableMinutes===50?'selected':''}>50 min</option><option value="60" ${+r.availableMinutes===60?'selected':''}>60+ min</option></select></label>
      <label>COROS recovery %<input id="ciCoros" type="number" min="0" max="100" value="${r.corosRecovery??state.coros.recovery??''}"></label>
      <label>FC riposo<input id="ciRhr" type="number" min="30" max="150" value="${r.rhr??''}" placeholder="baseline ${state.coros.restingHr||'–'}"></label>
      <label>HRV ms<input id="ciHrv" type="number" min="5" max="300" value="${r.hrv??''}" placeholder="baseline ${state.coros.hrvBaseline||'–'}"></label>
      <label>Δ temperatura °C<input id="ciTemp" type="number" step="0.1" min="-3" max="3" value="${r.temperatureDelta??''}" placeholder="opzionale"></label>
    </div>
    <div class="actions"><button class="btn" onclick="saveCheckin('${date}')">Salva e adatta</button><button class="btn secondary" onclick="todayView('${date}')">Annulla</button></div>
  </section></div>`;
}
function opts5(v){return [1,2,3,4,5].map(n=>`<option value="${n}" ${+v===n?'selected':''}>${n}</option>`).join('')}
function val(id){return document.getElementById(id)?.value}
function numOrNull(id){const v=val(id);return v===''||v==null?null:+v}
function saveCheckin(date){
  state.readiness[date]={sleepHours:numOrNull('ciSleep'),sleepQuality:+val('ciSQ'),energy:+val('ciEnergy'),soreness:+val('ciSore'),stress:+val('ciStress'),availableMinutes:+val('ciTime')||50,corosRecovery:numOrNull('ciCoros'),rhr:numOrNull('ciRhr'),hrv:numOrNull('ciHrv'),temperatureDelta:numOrNull('ciTemp')};
  if(state.readiness[date].corosRecovery!=null)state.coros.recovery=state.readiness[date].corosRecovery;
  if(state.readiness[date].sleepHours!=null)state.sleepLogs[date]={hours:state.readiness[date].sleepHours,quality:state.readiness[date].sleepQuality};
  save();toast('Readiness aggiornata');todayView(date);
}

function weekStart(d=TODAY()){
  const x=new Date(d),day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x;
}
function weekView(){
  setTab('week');setHeader('Settimana','Piano adattivo: i turni pesano come carico non sportivo');
  const ws=weekStart(parseDate(state.selectedDate||dateKey(TODAY()))),today=dateKey(TODAY());
  const days=Array.from({length:7},(_,i)=>{const d=dateKey(addDays(ws,i)),rec=recommendation(d),base=baseSessionFor(d),done=isDone(d,base.id)||historyOn(d).length>0;return `<button class="day ${d===today?'today':''} ${done?'done':''}" onclick="todayView('${d}')"><div><div class="dow">${parseDate(d).toLocaleDateString('it-IT',{weekday:'short'})}</div><div class="date">${parseDate(d).getDate()}</div></div><div><b>${esc(rec.session.short)}</b><div class="muted tiny">${esc(rec.adjust)}${rec.shift?` · <span class="shift">${esc(rec.shift.title)}</span>`:''}</div></div><i class="status-dot"></i></button>`});
  app.innerHTML=`<div class="stack"><section class="card"><div class="row"><div><h2>Settimana corrente</h2><p class="muted small" style="margin:0">Base: 3 forza + 2 Z2. Il corso endurance può sostituire una Z2.</p></div></div><div class="week" style="margin-top:14px">${days.join('')}</div></section>
  <section class="card"><h3>Regola del blocco 25–30 settembre</h3><p class="muted small">Con notti, reperibilità e 24 ore, SmartCoach riduce automaticamente il volume o propone recupero. Le sedute produttive vengono privilegiate prima del blocco e riprese quando la readiness torna buona.</p></section></div>`;
}

function startRecommended(date){const rec=recommendation(date);openSession(rec.session.id,date,rec)}
function trainingHub(){
  setTab('train');setHeader('Training','Scegli una seduta o sostituisci casa/palestra');
  app.innerHTML=`<div class="stack"><section class="card"><div class="segment"><button class="${state.place==='CASA'?'active':''}" onclick="setPlace('CASA')">Casa</button><button class="${state.place==='PALESTRA'?'active':''}" onclick="setPlace('PALESTRA')">Palestra</button></div></section>
    ${Object.values(STRENGTH).map(s=>`<button class="day" onclick="openSession('${s.id}','${dateKey(TODAY())}')"><div><div class="dow">FORZA</div><div class="date">${s.exercises.length}</div></div><div><b>${esc(s.title)}</b><div class="muted tiny">${esc(s.focus)} · ${s.mins} min</div></div><span>›</span></button>`).join('')}
    ${[CARDIO.z2short,CARDIO.z2long,CARDIO.runQuality].map(s=>`<button class="day" onclick="openSession('${s.id}','${dateKey(TODAY())}')"><div><div class="dow">CARDIO</div><div class="date">Z2</div></div><div><b>${esc(s.title)}</b><div class="muted tiny">${s.minMinutes}–${s.maxMinutes} min · corsa o cyclette</div></div><span>›</span></button>`).join('')}
    <button class="day" onclick="openSession('recovery','${dateKey(TODAY())}')"><div><div class="dow">EASY</div><div class="date">20</div></div><div><b>Recupero / mobilità</b><div class="muted tiny">Anche, lower back, camminata</div></div><span>›</span></button>
  </div>`;
}
function setPlace(p){state.place=p;save();trainingHub()}

function choiceFor(exercise,place){
  const arr=place==='CASA'?exercise.home:exercise.gym;
  const idx=state.exerciseChoice[`${exercise.id}-${place}`]||0;return {arr,idx:idx%arr.length,name:arr[idx%arr.length]};
}
function swapExercise(exId,sessionId,place,date){
  const exo=STRENGTH[sessionId].exercises.find(x=>x.id===exId),key=`${exId}-${place}`,arr=place==='CASA'?exo.home:exo.gym;
  state.exerciseChoice[key]=((state.exerciseChoice[key]||0)+1)%arr.length;save();openSession(sessionId,date);
}
function previousExercise(exId){
  for(const h of state.history){const e=h.exercises?.find(x=>x.id===exId);if(e)return {entry:h,exercise:e}}
  return null;
}
function progression(exercise){
  const prev=previousExercise(exercise.id);if(!prev)return {text:'Prima registrazione: parti conservativo, RPE 6–7.',load:null};
  const sets=(prev.exercise.sets||[]).filter(s=>+s.reps>0);if(!sets.length)return {text:'Nessun set valido precedente.',load:null};
  const top=exercise.max,min=exercise.min,rirVals=sets.map(s=>s.rir!=null&&s.rir!==''?+s.rir:(s.rpe?10-(+s.rpe):null)).filter(x=>x!=null&&Number.isFinite(x)),minRir=rirVals.length?Math.min(...rirVals):null;
  const allTop=sets.every(s=>+s.reps>=top),miss=sets.some(s=>+s.reps<min),weights=sets.map(s=>+s.kg).filter(n=>Number.isFinite(n)&&n>0),last=weights.length?Math.max(...weights):0;
  if(allTop&&(minRir==null||minRir>=2)){const next=last?round(last+(exercise.increment||1),1):null;return {text:`Range alto completato con ≥2 RIR: ${next?`prova ~${next} kg`:'aumenta leggermente difficoltà/reps'}.`,load:next}}
  if((minRir!=null&&minRir<=.5)||miss){const next=last?round(last*.95,1):null;return {text:`Fatica alta o reps sotto range: ${next?`valuta ~${next} kg`:'riduci difficoltà'} e lascia 2–3 RIR.`,load:next}}
  return {text:`Ripeti il carico e prova ad aggiungere 1 rep totale mantenendo almeno 2 RIR.`,load:last||null};
}
function lastSummary(exId){
  const p=previousExercise(exId);if(!p)return 'nessun dato precedente';const sets=(p.exercise.sets||[]).filter(s=>s.reps);if(!sets.length)return 'nessun dato precedente';
  return sets.map(s=>`${s.kg?`${s.kg}kg×`:''}${s.reps}${s.rir!=null?` · ${s.rir} RIR`:s.rpe?` · RPE ${s.rpe}`:''}`).join(' · ');
}

function openSession(id,date=state.selectedDate,rec=null){
  const s=sessionById(id);state.selectedSession=id;state.selectedDate=date;save();setTab('train');
  setHeader(s.short||s.title,fmtDate(date,{weekday:'long',day:'numeric',month:'long'}));
  if(s.type==='cardio')return renderCardio(s,date,rec||recommendation(date));
  if(s.type==='recovery')return renderRecovery(date);
  const adaptive=rec||recommendation(date),reduced=adaptive.setDelta<0;
  app.innerHTML=`<div class="stack"><section class="card"><div class="row"><div><h2>${esc(s.title)}</h2><p class="muted small" style="margin:0">${esc(s.focus)} · RIR target ${currentReentry(date)?'2–4':'1–3'}</p></div><span class="pill ${reduced?'warn':''}">${reduced?'volume ridotto':'volume normale'}</span></div>
    <div class="segment" style="margin-top:14px"><button class="${state.place==='CASA'?'active':''}" onclick="changeWorkoutPlace('CASA','${id}','${date}')">Casa</button><button class="${state.place==='PALESTRA'?'active':''}" onclick="changeWorkoutPlace('PALESTRA','${id}','${date}')">Palestra</button></div></section>
    <section class="card" id="exerciseList">${s.exercises.map((e,i)=>renderExercise(e,i,s,date,reduced)).join('')}</section>
    <section class="card"><label>Note sessione<textarea id="sessionNote" placeholder="Dolori, sensazioni, tecnica, modifiche…"></textarea></label><div class="actions"><button class="btn secondary" onclick="startTimer(120)">Timer 2:00</button><button class="btn" onclick="saveStrength('${id}','${date}')">Salva sessione</button></div></section></div>`;
}
function changeWorkoutPlace(p,id,date){state.place=p;save();openSession(id,date)}
function renderExercise(e,i,s,date,reduced){
  const c=choiceFor(e,state.place),p=progression(e),nsets=Math.max(1,e.sets+(reduced?-1:0));
  return `<div class="exercise" data-ex="${e.id}"><div class="exercise-head"><div><div class="exercise-name">${i+1}. ${esc(c.name)}</div><div class="target">${nsets} × ${e.min}–${e.max}${e.side?' / lato':''} · recupero ${e.rest}s</div><div class="last">Ultima: ${esc(lastSummary(e.id))}</div></div><button class="swap" onclick="swapExercise('${e.id}','${s.id}','${state.place}','${date}')">↔ variante</button></div>
  <div class="progress-note"><strong>Coach:</strong> ${esc(p.text)}</div>
  <div class="set-head"><span>Set</span><span>kg</span><span>reps</span><span>RIR</span><span>✓</span></div>
  ${Array.from({length:nsets},(_,j)=>`<div class="set-row"><span class="set-no">${j+1}</span><input inputmode="decimal" type="number" step="0.5" class="kg" placeholder="${p.load??'–'}"><input inputmode="numeric" type="number" class="reps" placeholder="${e.min}-${e.max}"><input inputmode="decimal" type="number" step="0.5" min="0" max="6" class="rir" placeholder="3"><button class="set-done" onclick="this.classList.toggle('on');this.textContent=this.classList.contains('on')?'✓':''"></button></div>`).join('')}</div>`;
}
function saveStrength(id,date){
  const s=STRENGTH[id],cards=[...document.querySelectorAll('.exercise')];
  const exercises=cards.map((card,i)=>{const e=s.exercises[i],c=choiceFor(e,state.place);return {id:e.id,name:c.name,sets:[...card.querySelectorAll('.set-row')].map(r=>({kg:num(r.querySelector('.kg').value),reps:num(r.querySelector('.reps').value),rir:num(r.querySelector('.rir').value)})).filter(x=>x.reps||x.kg||x.rpe)}});
  if(!exercises.some(e=>e.sets.length)){toast('Inserisci almeno un set');return}
  const entry={id:uid(),date:new Date(`${date}T12:00:00`).toISOString(),sessionId:id,name:s.title,type:'strength',place:state.place,readiness:scoreReadiness(date),exercises,note:val('sessionNote')||''};
  state.history.unshift(entry);save();toast('Allenamento salvato ✓');trendView();
}
function num(v){return v===''||v==null?null:+v}

function renderCardio(s,date,rec){
  const mins=Math.round((s.mins||35)*(rec.cardioFactor||1));
  app.innerHTML=`<div class="stack"><section class="card hero"><div class="row"><div><h2>${esc(s.title)}</h2><p class="muted small" style="margin:0">${esc(s.focus)}</p></div><span class="pill">${s.minMinutes}–${s.maxMinutes} min</span></div><div class="notice goodbox" style="margin-top:14px">${s.quality?'<strong>Qualità controllata:</strong> 10′ facile, 6×1′ brillante a RPE 6–7 con 2′ facili, poi 10′ facile. Se le gambe sono pesanti, torna a Z2.':'Usa la <strong>Z2 del tuo COROS</strong> oppure il talk test: respirazione controllata, conversazione possibile, RPE circa 2–3/10. Non inseguire il passo.'}</div></section>
  <section class="card"><label>Modalità<select id="cardioMode"><option value="run" ${s.quality||state.settings.cardioDefault==='run'?'selected':''}>Corsa</option><option value="bike" ${!s.quality&&state.settings.cardioDefault==='bike'?'selected':''}>Cyclette</option><option value="course" ${s.quality?'disabled':''}>Corso endurance</option><option value="walk" ${s.quality?'disabled':''}>Camminata veloce</option></select></label>
  <div class="form-grid three" style="margin-top:10px"><label>Minuti<input id="cardioMinutes" type="number" value="${mins}"></label><label>Km<input id="cardioKm" type="number" step="0.1"></label><label>FC media<input id="cardioHr" type="number"></label><label>RPE<input id="cardioRpe" type="number" step="0.5" value="3" min="1" max="10"></label><label>W medi<input id="cardioWatts" type="number" placeholder="se disponibili"></label><label>Z2 rispettata<select id="cardioZ2"><option value="yes">Sì</option><option value="mostly">Quasi tutta</option><option value="no">No</option></select></label></div>
  <label style="margin-top:10px">Note<textarea id="cardioNote" placeholder="Sensazioni, percorso, resistenza cyclette…"></textarea></label>
  <div class="actions"><button class="btn" onclick="saveCardio('${s.id}','${date}')">Salva cardio</button></div></section></div>`;
}
function saveCardio(id,date){
  const s=sessionById(id),mode=val('cardioMode'),minutes=+val('cardioMinutes');if(!minutes){toast('Inserisci la durata');return}
  const entry={id:uid(),date:new Date(`${date}T12:00:00`).toISOString(),sessionId:id,name:s.title,type:'cardio',mode,minutes,km:numOrNull('cardioKm'),avgHr:numOrNull('cardioHr'),watts:numOrNull('cardioWatts'),rpe:numOrNull('cardioRpe'),z2:val('cardioZ2'),readiness:scoreReadiness(date),note:val('cardioNote')||''};
  state.settings.cardioDefault=mode==='course'?state.settings.cardioDefault:mode;state.history.unshift(entry);save();toast('Cardio salvato ✓');trendView();
}

function renderRecovery(date){
  app.innerHTML=`<div class="stack"><section class="card hero"><h2>Recupero / mobilità</h2><p class="muted">20 minuti facili. Nessun bisogno di “recuperare” gli allenamenti persi nei giorni di turno.</p></section><section class="card"><div class="exercise"><b>1. Camminata facile</b><div class="target">10–20 min · RPE 1–2</div></div><div class="exercise"><b>2. Anche + gluteo medio</b><div class="target">90/90 + abduzione leggera · 2 giri</div></div><div class="exercise"><b>3. Lower back</b><div class="target">Bird dog + cat-camel · controllo, zero dolore</div></div><div class="exercise"><b>4. Respirazione</b><div class="target">2–3 min lenta</div></div><div class="actions"><button class="btn" onclick="saveRecovery('${date}')">Segna completato</button></div></section></div>`;
}
function saveRecovery(date){state.history.unshift({id:uid(),date:new Date(`${date}T12:00:00`).toISOString(),sessionId:'recovery',name:'Recupero / mobilità',type:'recovery',minutes:20,readiness:scoreReadiness(date)});save();toast('Recupero registrato ✓');todayView(date)}

let timerInterval=null,timerEnd=0;
function startTimer(sec){clearInterval(timerInterval);timerEnd=Date.now()+sec*1000;const tick=()=>{const left=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));toast(left?`Recupero ${Math.floor(left/60)}:${pad(left%60)}`:'Recupero finito ✓');if(!left)clearInterval(timerInterval)};tick();timerInterval=setInterval(tick,1000)}

function historyLine(h){
  const date=(h.date||'').slice(0,10);let detail='';
  if(h.type==='cardio'||h.minutes)detail=`${h.minutes||'–'} min${h.km?` · ${h.km} km`:''}${h.rpe?` · RPE ${h.rpe}`:''}`;
  else if(h.exercises)detail=`${h.exercises.reduce((a,e)=>a+(e.sets?.length||0),0)} set · ${h.place||''}`;
  else detail=h.place||'Sessione registrata';
  return `<div class="history-item"><div class="row"><div><b>${esc(h.name||'Allenamento')}</b><div class="muted tiny">${date?fmtDate(date,{day:'numeric',month:'short'}):''} · ${esc(detail)}</div></div><button class="swap" onclick="deleteHistory('${h.id}')">×</button></div></div>`;
}
function deleteHistory(id){if(!confirm('Eliminare questa sessione?'))return;state.history=state.history.filter(h=>h.id!==id);save();trendView()}

function trendView(){
  setTab('trend');setHeader('Trend','Adesione, carico e progressione');
  const last28=Array.from({length:28},(_,i)=>dateKey(addDays(TODAY(),-27+i))), hist=state.history.filter(h=>last28.includes((h.date||'').slice(0,10)));
  const strength=hist.filter(h=>h.type==='strength').length,cardio=hist.filter(h=>h.type==='cardio'),z2min=cardio.reduce((a,h)=>a+(+h.minutes||0),0),volume=hist.reduce((a,h)=>a+sessionVolume(h),0);
  const weekly=Array.from({length:4},(_,w)=>{const ds=last28.slice(w*7,w*7+7);return hist.filter(h=>ds.includes((h.date||'').slice(0,10))).length});
  const weights=(state.bodyLogs||[]).filter(x=>x.weight).slice(-12).map(x=>+x.weight);
  app.innerHTML=`<div class="stack"><section class="grid2"><div class="metric"><small>Forza · 28g</small><b>${strength}</b></div><div class="metric"><small>Cardio · 28g</small><b>${z2min} min</b></div><div class="metric"><small>Volume est.</small><b>${Math.round(volume).toLocaleString('it-IT')}</b></div><div class="metric"><small>Sessioni totali</small><b>${hist.length}</b></div></section>
  <section class="card"><h3>Costanza · 4 settimane</h3>${sparkline(weekly)}<div class="row tiny muted"><span>4 sett fa</span><span>questa settimana</span></div></section>
  ${weights.length>1?`<section class="card"><h3>Peso</h3>${sparkline(weights)}<div class="muted tiny">${weights[0]} → ${weights.at(-1)} kg</div></section>`:''}
  <section class="card"><h3>Baseline performance</h3><div class="grid2"><div class="metric"><small>Pull-up</small><b>${state.profile.baseline.pullups}</b></div><div class="metric"><small>Dips</small><b>${state.profile.baseline.dips}</b></div><div class="metric"><small>Push-up</small><b>${state.profile.baseline.pushups}</b></div><div class="metric"><small>DB shoulder</small><b>${state.profile.baseline.shoulderDbKg} kg/lato</b></div></div></section>
  <section class="card"><div class="row"><h3>Storico</h3><span class="pill">${state.history.length}</span></div>${state.history.length?state.history.slice(0,20).map(historyLine).join(''):'<p class="muted">Nessuna sessione registrata.</p>'}</section></div>`;
}
function sessionVolume(h){if(!h.exercises)return 0;return h.exercises.reduce((a,e)=>a+(e.sets||[]).reduce((s,x)=>s+(+x.kg||0)*(+x.reps||0),0),0)}
function sparkline(vals){if(!vals.length)return '<p class="muted small">Dati insufficienti</p>';const w=300,h=80,min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;const pts=vals.map((v,i)=>`${(i/(Math.max(1,vals.length-1))*w).toFixed(1)},${(h-8-((v-min)/span)*(h-16)).toFixed(1)}`).join(' ');return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="0" y1="${h-8}" x2="${w}" y2="${h-8}"></line><polyline points="${pts}"></polyline></svg>`}

function moreHome(){
  setTab('more');state.moreView=null;save();setHeader('Altro','Recovery, corpo, nutrizione, sonno e connessioni');
  app.innerHTML=`<div class="menu-grid"><button class="menu" onclick="moreView('recovery')"><b>Recovery</b><span>Readiness e turni</span></button><button class="menu" onclick="moreView('body')"><b>Corpo</b><span>Peso e baseline</span></button><button class="menu" onclick="moreView('nutrition')"><b>Nutrizione</b><span>Diario semplice</span></button><button class="menu" onclick="moreView('sleep')"><b>Sonno</b><span>Ore e qualità</span></button><button class="menu" onclick="moreView('connections')"><b>Connessioni</b><span>COROS, Health, Calendar</span></button><button class="menu" onclick="moreView('data')"><b>Dati</b><span>Backup e ripristino</span></button></div>`;
}
function moreView(v){state.moreView=v;save();if(v==='recovery')return recoveryPage();if(v==='body')return bodyPage();if(v==='nutrition')return nutritionPage();if(v==='sleep')return sleepPage();if(v==='connections')return connectionsPage();if(v==='data')return dataPage();moreHome()}
function backMore(){moreHome()}

function recoveryPage(){
  setHeader('Recovery','Readiness + carico lavorativo');const d=state.selectedDate||dateKey(TODAY()),score=scoreReadiness(d),rec=recommendation(d);
  app.innerHTML=`<div class="stack"><button class="btn ghost smallbtn" onclick="backMore()">‹ Altro</button><section class="card hero"><div class="row"><div><span class="pill ${readinessBand(score)}">${readinessLabel(score)}</span><h2 style="margin-top:10px">${score}/100</h2><p class="muted small">${esc(rec.reason)}</p></div><div class="score-ring" style="--score:${score}"><b>${score}</b><small>READY</small></div></div><button class="btn" style="margin-top:12px" onclick="openCheckin('${d}')">Aggiorna check-in</button></section>
  <section class="card"><h3>Turni importati</h3>${state.shifts.map(s=>`<div class="history-item"><div class="row"><div><b>${fmtDate(s.date,{weekday:'short',day:'numeric',month:'short'})}</b><div class="muted tiny">${esc(s.title)}</div></div><span class="pill ${s.load>=3?'warn':''}">carico ${s.load}/4</span></div></div>`).join('')}</section></div>`;
}
function bodyPage(){
  const last=state.bodyLogs.at(-1)||{};setHeader('Corpo','Peso e indicatori semplici');
  app.innerHTML=`<div class="stack"><button class="btn ghost smallbtn" onclick="backMore()">‹ Altro</button><section class="grid2"><div class="metric"><small>Altezza</small><b>${state.profile.heightCm} cm</b></div><div class="metric"><small>Peso ultimo</small><b>${last.weight||state.profile.weightKg} kg</b></div></section><section class="card"><h3>Aggiungi misura</h3><div class="form-grid"><label>Peso kg<input id="bodyWeight" type="number" step="0.1" value="${last.weight||''}"></label><label>Vita cm<input id="bodyWaist" type="number" step="0.5" value="${last.waist||''}"></label></div><button class="btn" style="margin-top:12px" onclick="saveBody()">Salva</button></section>
  <section class="card"><h3>Baseline forza</h3><div class="form-grid"><label>Pull-up<input id="bPull" type="number" value="${state.profile.baseline.pullups}"></label><label>Chin-up<input id="bChin" type="number" value="${state.profile.baseline.chinups}"></label><label>Dips<input id="bDip" type="number" value="${state.profile.baseline.dips}"></label><label>Push-up<input id="bPush" type="number" value="${state.profile.baseline.pushups}"></label><label>DB shoulder kg/lato<input id="bShoulder" type="number" step="0.5" value="${state.profile.baseline.shoulderDbKg}"></label><label>Chest kg<input id="bChest" type="number" step="0.5" value="${state.profile.baseline.chestKg}"></label></div><button class="btn secondary" style="margin-top:12px" onclick="saveBaseline()">Aggiorna baseline</button></section></div>`;
}
function saveBody(){const w=numOrNull('bodyWeight'),waist=numOrNull('bodyWaist');if(!w){toast('Inserisci il peso');return}state.bodyLogs.push({date:dateKey(TODAY()),weight:w,waist});state.profile.weightKg=w;save();toast('Misura salvata');bodyPage()}
function saveBaseline(){state.profile.baseline={pullups:+val('bPull')||0,chinups:+val('bChin')||0,dips:+val('bDip')||0,pushups:+val('bPush')||0,shoulderDbKg:+val('bShoulder')||0,chestKg:+val('bChest')||0};save();toast('Baseline aggiornata')}

function nutritionPage(){
  setHeader('Nutrizione','Semplice, senza trasformare tutto in calorie');const d=dateKey(TODAY()),log=state.nutritionLogs[d]||{},w=state.profile.weightKg||73,lo=Math.round(w*1.6/5)*5,hi=Math.round(w*2/5)*5;
  app.innerHTML=`<div class="stack"><button class="btn ghost smallbtn" onclick="backMore()">‹ Altro</button><section class="card hero"><h2>Target semplice</h2><p class="muted small">Per questa fase: proteine distribuite nei pasti, carboidrati attorno agli allenamenti e idratazione regolare. Nessun obbligo di contare tutte le calorie.</p><div class="grid2"><div class="metric"><small>Proteine</small><b>${lo}–${hi} g</b></div><div class="metric"><small>Peso rif.</small><b>${w} kg</b></div></div></section><section class="card"><h3>Diario di oggi</h3><div class="form-grid"><label>Proteine g<input id="nutProtein" type="number" value="${log.protein||''}"></label><label>Acqua L<input id="nutWater" type="number" step="0.25" value="${log.water||''}"></label><label>Pasti completi<input id="nutMeals" type="number" min="0" max="8" value="${log.meals||''}"></label><label>Frutta/verdura porzioni<input id="nutPlants" type="number" min="0" max="10" value="${log.plants||''}"></label></div><label style="margin-top:10px">Note<textarea id="nutNote">${esc(log.note||'')}</textarea></label><button class="btn" style="margin-top:12px" onclick="saveNutrition('${d}')">Salva diario</button></section></div>`;
}
function saveNutrition(d){state.nutritionLogs[d]={protein:numOrNull('nutProtein'),water:numOrNull('nutWater'),meals:numOrNull('nutMeals'),plants:numOrNull('nutPlants'),note:val('nutNote')||''};save();toast('Nutrizione salvata')}

function sleepPage(){
  const d=dateKey(TODAY()),log=state.sleepLogs[d]||state.readiness[d]||{};
  setHeader('Sonno','Ore, qualità e impatto sul training');
  const recent=Object.entries(state.sleepLogs).sort((a,b)=>a[0].localeCompare(b[0])).slice(-7);
  const avg=recent.length?round(recent.reduce((a,[,x])=>a+(+x.hours||0),0)/recent.length,1):null;
  app.innerHTML=`<div class="stack"><button class="btn ghost smallbtn" onclick="backMore()">‹ Altro</button>
  <section class="grid2"><div class="metric"><small>Media 7 log</small><b>${avg??'–'} h</b></div><div class="metric"><small>HRV baseline COROS</small><b>${state.coros.hrvBaseline??'–'} ms</b></div></section>
  <section class="card"><h3>Oggi</h3><div class="form-grid"><label>Ore di sonno<input id="sleepHours" type="number" step="0.25" min="0" max="14" value="${log.hours??log.sleepHours??''}"></label><label>Qualità 1–5<select id="sleepQuality">${opts5(log.quality??log.sleepQuality??3)}</select></label></div><button class="btn" style="margin-top:12px" onclick="saveSleep('${d}')">Salva sonno</button></section>
  <section class="card"><h3>Ultimi dati</h3>${recent.length?recent.slice().reverse().map(([day,x])=>`<div class="history-item"><div class="row"><b>${fmtDate(day,{weekday:'short',day:'numeric',month:'short'})}</b><span>${x.hours??'–'} h · qualità ${x.quality??'–'}/5</span></div></div>`).join(''):'<p class="muted small">Nessun dato locale ancora.</p>'}</section></div>`;
}
function saveSleep(d){
  const hours=numOrNull('sleepHours'),quality=+val('sleepQuality');
  state.sleepLogs[d]={hours,quality};
  const old=latestReadiness(d);
  state.readiness[d]={...old,sleepHours:hours,sleepQuality:quality};
  save();toast('Sonno salvato');sleepPage();
}

function connectionsPage(){
  setHeader('Connessioni','Stato dati e fonti');
  app.innerHTML=`<div class="stack"><button class="btn ghost smallbtn" onclick="backMore()">‹ Altro</button>
  <section class="card hero"><div class="row"><div><h2>COROS</h2><p class="muted small" style="margin:0">Snapshot importato ${esc(state.coros.synced||'–')}</p></div><span class="pill good">connesso in ChatGPT</span></div>
    <div class="grid2" style="margin-top:14px"><div class="metric"><small>VO₂max</small><b>${state.coros.vo2max??'–'}</b></div><div class="metric"><small>Soglia</small><b>${state.coros.thresholdPace??'–'}</b></div><div class="metric"><small>Recovery</small><b>${state.coros.recovery??'–'}%</b></div><div class="metric"><small>Load ratio</small><b>${state.coros.loadRatio??'–'}</b></div></div>
    <div class="notice" style="margin-top:12px">La PWA statica non contiene le credenziali COROS: i dati vengono letti in modo sicuro tramite la connessione COROS di ChatGPT e poi riportati nell'app come snapshot. Non inserire token o password nell'app.</div>
  </section>
  <section class="card"><h3>Google Calendar</h3><p class="muted small">Sono stati importati i turni attualmente visibili dal 25 al 30 settembre e usati come carico extra per adattare il training. Puoi aggiungerli o correggerli qui sotto.</p><button class="btn secondary" onclick="recoveryPage()">Gestisci turni</button></section>
  <section class="card"><h3>Apple Health</h3><p class="muted small">Non collegato direttamente. La web app non legge Apple Health dal browser; eventuali dati possono essere inseriti nel check-in o sincronizzati tramite una fonte autorizzata esterna.</p></section></div>`;
}

function addShift(){
  const d=val('shiftDate'),title=(val('shiftTitle')||'Turno').trim(),load=clamp(+val('shiftLoad')||1,1,4);
  if(!d){toast('Scegli una data');return}
  state.shifts=state.shifts.filter(s=>s.date!==d);
  state.shifts.push({date:d,title,load});state.shifts.sort((a,b)=>a.date.localeCompare(b.date));save();toast('Turno salvato');recoveryPage();
}
function removeShift(date){state.shifts=state.shifts.filter(s=>s.date!==date);save();toast('Turno rimosso');recoveryPage()}

function dataPage(){
  setHeader('Dati','Backup locale e ripristino');
  const size=Math.round(new Blob([JSON.stringify(state)]).size/1024);
  app.innerHTML=`<div class="stack"><button class="btn ghost smallbtn" onclick="backMore()">‹ Altro</button>
  <section class="card hero"><h2>I dati restano sul dispositivo</h2><p class="muted small">Le sessioni, i check-in e i diari sono salvati nel browser tramite localStorage. Un backup JSON evita di perderli se cancelli i dati del sito o cambi telefono.</p><span class="pill">~${size} KB</span></section>
  <section class="card"><h3>Passaggio al coach</h3><p class="muted small">Genera un riepilogo delle ultime 2 settimane da incollare in ChatGPT quando vuoi una modifica strategica del programma.</p><button class="btn secondary" onclick="shareCoachBrief()">Copia / condividi report</button></section>
  <section class="card"><div class="actions"><button class="btn" onclick="exportData()">Esporta backup</button><button class="btn secondary" onclick="document.getElementById('importFile').click()">Importa backup</button></div><input id="importFile" class="hidden" type="file" accept="application/json,.json" onchange="importData(this.files[0])"></section>
  <section class="card"><h3>Ripristino</h3><p class="muted small">Il ripristino sostituisce i dati locali correnti. Il programma base resta incluso nell'app.</p><button class="btn danger" onclick="resetData()">Azzera dati locali</button></section></div>`;
}
function coachBrief(){
  const end=dateKey(TODAY()),start=dateKey(addDays(TODAY(),-13)),hist=state.history.filter(h=>{const d=(h.date||'').slice(0,10);return d>=start&&d<=end});
  const strength=hist.filter(h=>h.type==='strength').length,cardio=hist.filter(h=>h.type==='cardio'),z2=cardio.reduce((a,h)=>a+(+h.minutes||0),0),lastBody=state.bodyLogs.at(-1)||{};
  const r=latestReadiness(end),rec=recommendation(end);
  return [
    'SMARTCOACH REPORT',`Periodo: ${start} → ${end}`,
    `Peso: ${lastBody.weight??state.profile.weightKg} kg`,
    `Sessioni forza: ${strength}; cardio: ${cardio.length}; minuti cardio: ${z2}`,
    `Readiness oggi: ${scoreReadiness(end)}/100; consiglio: ${rec.session.title} (${rec.adjust})`,
    `Check-in: sonno ${r.sleepHours??'–'} h, energia ${r.energy??'–'}/5, DOMS ${r.soreness??'–'}/5, stress ${r.stress??'–'}/5`,
    `COROS snapshot ${state.coros.synced}: recovery ${state.coros.recovery??'–'}%, VO2max ${state.coros.vo2max??'–'}, soglia ${state.coros.thresholdPace??'–'}, load breve/lungo ${state.coros.shortLoad??'–'}/${state.coros.longLoad??'–'}`,
    `Ultime sessioni: ${hist.slice(0,8).map(h=>`${(h.date||'').slice(0,10)} ${h.name}`).join(' | ')||'nessuna'}`,
    'Obiettivi: '+state.profile.goals.join('; ')
  ].join('\n');
}
async function shareCoachBrief(){
  const txt=coachBrief();
  try{
    if(navigator.share)await navigator.share({title:'SmartCoach report',text:txt});
    else{await navigator.clipboard.writeText(txt);toast('Report copiato')}
  }catch(e){if(e?.name!=='AbortError'){try{await navigator.clipboard.writeText(txt);toast('Report copiato')}catch{toast('Impossibile copiare')}}}
}

function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`smartcoach-backup-${dateKey(TODAY())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup esportato');
}
function importData(file){
  if(!file)return;const r=new FileReader();r.onload=()=>{try{state=migrate(JSON.parse(r.result));save();toast('Backup importato');dataPage()}catch{toast('Backup non valido')}};r.readAsText(file);
}
function resetData(){if(!confirm('Azzero storico, check-in e diari locali?'))return;state=defaultState();save();toast('Dati locali azzerati');todayView(dateKey(TODAY()))}

function enhanceRecoveryPage(){
  const root=app.querySelector('.stack');if(!root)return;
  const card=document.createElement('section');card.className='card';
  card.innerHTML=`<h3>Aggiungi / modifica turno</h3><div class="form-grid"><label>Data<input id="shiftDate" type="date" value="${dateKey(TODAY())}"></label><label>Carico 1–4<select id="shiftLoad"><option value="1">1 · lieve</option><option value="2">2 · medio</option><option value="3">3 · notte/reperibilità</option><option value="4">4 · 24h o combinato</option></select></label></div><label style="margin-top:10px">Descrizione<input id="shiftTitle" value="" placeholder="es. notte reparto"></label><button class="btn secondary" style="margin-top:12px" onclick="addShift()">Salva turno</button>`;
  root.appendChild(card);
  const list=app.querySelectorAll('.history-item');
  list.forEach((el,i)=>{const s=state.shifts[i];if(!s)return;const b=document.createElement('button');b.className='swap';b.textContent='rimuovi';b.onclick=()=>removeShift(s.date);el.querySelector('.row')?.appendChild(b)});
}

const _recoveryPage=recoveryPage;
recoveryPage=function(){_recoveryPage();enhanceRecoveryPage()};

function currentReentry(date=dateKey(TODAY())){
  const start=parseDate('2026-09-23'),d=parseDate(date);return (d-start)/(86400000)<14;
}
state.settings.reentry=currentReentry(state.selectedDate||dateKey(TODAY()));save();

document.querySelectorAll('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>{
  const t=b.dataset.tab;
  if(t==='today')todayView(state.selectedDate||dateKey(TODAY()));
  else if(t==='week')weekView();
  else if(t==='train')trainingHub();
  else if(t==='trend')trendView();
  else moreHome();
}));
document.querySelector('#quickCheck').addEventListener('click',()=>openCheckin(state.selectedDate||dateKey(TODAY())));

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
window.addEventListener('storage',e=>{if(e.key===STORE_KEY){try{state=migrate(JSON.parse(e.newValue));todayView(state.selectedDate||dateKey(TODAY()))}catch{}}});

todayView(dateKey(TODAY()));
