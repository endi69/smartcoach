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
