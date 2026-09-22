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
  goals:['Ricostruire base aerobica Z2','Ipertrofia generale','Priorità gambe e lower back','Rinforzo gluteo medio destro'],
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
      ex('squat','Squat pattern',3,8,12,{home:['Goblet squat','Tempo goblet squat','Split squat'],gym:['Leg press','Back squat','Hack squat'],increment:2.5,rest:120}),
      ex('rdl','Hip hinge',3,8,10,{home:['DB Romanian deadlift','Single-leg RDL'],gym:['Romanian deadlift','DB Romanian deadlift'],increment:2.5,rest:120}),
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
      ex('hipthrust','Hip thrust',3,10,15,{home:['DB hip thrust','Single-leg hip thrust'],gym:['Barbell hip thrust','Hip thrust machine'],increment:2.5,rest:120}),
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
  recovery:{id:'recovery',type:'recovery',title:'Recupero / mobilità',short:'Recupero',mins:20,focus:'Camminata facile + mobilità anche/schiena + respirazione'}
};

const WEEK_PLAN={0:'z2long',1:'lowerA',2:'z2short',3:'recovery',4:'upper',5:'recovery',6:'lowerB'};
const ALL_SESSIONS={...STRENGTH,...CARDIO};

function defaultState(){
  return {
    version:2,place:'CASA',history:[],selectedDate:dateKey(TODAY()),selectedSession:null,exerciseChoice:{},
    readiness:{},bodyLogs:[{date:'2026-09-23',weight:73,waist:null}],nutritionLogs:{},sleepLogs:{},
    coros:{...COROS_DEFAULT},shifts:SHIFT_DEFAULT.map(x=>({...x})),
    settings:{cardioDefault:'run',reentry:true,weekStart:'monday'},
    profile:{...PROFILE,baseline:{...PROFILE.baseline}},moreView:null
  };
}

function migrate(raw){
  const d=defaultState();
  if(!raw||typeof raw!=='object')return d;
  if(raw.version===2){
    return {...d,...raw,settings:{...d.settings,...raw.settings},profile:{...d.profile,...raw.profile,baseline:{...d.profile.baseline,...(raw.profile?.baseline||{})}},coros:{...d.coros,...raw.coros},shifts:Array.isArray(raw.shifts)?raw.shifts:d.shifts};
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
  return state.readiness[date]||{sleepHours:null,sleepQuality:3,energy:3,soreness:2,stress:3,rhr:null,hrv:null,corosRecovery:state.coros.recovery??null};
}
function scoreReadiness(date){
  const r=latestReadiness(date), vals=[];
  if(r.sleepHours!=null){const h=+r.sleepHours;vals.push(h>=7&&h<=9?100:h>=6?75:h>=5?50:25)}
  vals.push(clamp((+r.sleepQuality||3)*20,0,100));
  vals.push(clamp((+r.energy||3)*20,0,100));
  vals.push(clamp((6-(+r.soreness||2))*20,0,100));
  vals.push(clamp((6-(+r.stress||3))*20,0,100));
  if(r.rhr!=null&&state.coros.restingHr){const d=+r.rhr-state.coros.restingHr;vals.push(d<=0?100:d<=3?85:d<=6?65:d<=10?40:20)}
  if(r.hrv!=null&&state.coros.hrvBaseline){const q=+r.hrv/state.coros.hrvBaseline;vals.push(q>=1?100:q>=.9?82:q>=.8?64:q>=.7?45:25)}
  if(r.corosRecovery!=null)vals.push(clamp(+r.corosRecovery,0,100));
  let score=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
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
      <div class="grid3" style="margin-top:12px"><div class="metric"><small>Energia</small><b>${r.energy||3}/5</b></div><div class="metric"><small>Dolori</small><b>${r.soreness||2}/5</b></div><div class="metric"><small>Stress</small><b>${r.stress||3}/5</b></div></div>
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
      <label>COROS recovery %<input id="ciCoros" type="number" min="0" max="100" value="${r.corosRecovery??state.coros.recovery??''}"></label>
      <label>FC riposo<input id="ciRhr" type="number" min="30" max="150" value="${r.rhr??''}" placeholder="baseline ${state.coros.restingHr||'–'}"></label>
      <label>HRV ms<input id="ciHrv" type="number" min="5" max="300" value="${r.hrv??''}" placeholder="baseline ${state.coros.hrvBaseline||'–'}"></label>
    </div>
    <div class="actions"><button class="btn" onclick="saveCheckin('${date}')">Salva e adatta</button><button class="btn secondary" onclick="todayView('${date}')">Annulla</button></div>
  </section></div>`;
}
function opts5(v){return [1,2,3,4,5].map(n=>`<option value="${n}" ${+v===n?'selected':''}>${n}</option>`).join('')}
function val(id){return document.getElementById(id)?.value}
function numOrNull(id){const v=val(id);return v===''||v==null?null:+v}
function saveCheckin(date){
  state.readiness[date]={sleepHours:numOrNull('ciSleep'),sleepQuality:+val('ciSQ'),energy:+val('ciEnergy'),soreness:+val('ciSore'),stress:+val('ciStress'),corosRecovery:numOrNull('ciCoros'),rhr:numOrNull('ciRhr'),hrv:numOrNull('ciHrv')};
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
    ${[CARDIO.z2short,CARDIO.z2long].map(s=>`<button class="day" onclick="openSession('${s.id}','${dateKey(TODAY())}')"><div><div class="dow">CARDIO</div><div class="date">Z2</div></div><div><b>${esc(s.title)}</b><div class="muted tiny">${s.minMinutes}–${s.maxMinutes} min · corsa o cyclette</div></div><span>›</span></button>`).join('')}
    <button class="day" onclick="openSession('recovery','${dateKey(TODAY())}')"><div><div class="dow">EASY</div><div class="date">20</div></div><div><b>Recupero / mobilità</b><div class="muted tiny">Anche, lower back, camminata</div></div><span>›</span></button>
  </div>`;
}
function setPlace(p){state.place=p;save();trainingHub()}

function choiceFor(exercise,place){
  const arr=place==='CASA'?exercise.home:exercise.gym;
  const idx=state.exerciseChoice[`${exercise.id}-${place}`]||0;return {arr,idx:idx%arr.length,name:arr[idx%arr.length]};
}
function swapExercise(exId,sessionId,place,date){
