'use strict';
const V3_VERSION='3.0.0';
const V3_LEGACY_SHIFTS=new Set([
'2026-09-25|Notte ambu','2026-09-26|Reperibile notte','2026-09-27|24 ore ambu',
'2026-09-28|Pomeriggio + notte','2026-09-29|Pomeriggio','2026-09-30|Mattina'
]);
function v3InitState(){
  state.schemaVersion=3;
  state.calendar=state.calendar||{status:'unknown',events:[],shifts:[],lastSync:null};
  state.ui={trendRange:28,...(state.ui||{})};
  state.shifts=(state.shifts||[]).filter(s=>s.source==='manual'||!V3_LEGACY_SHIFTS.has((s.date||'')+'|'+(s.title||'')));
  state.coros=state.coros||{};state.health=state.health||{};save();
  const v=document.querySelector('#version');if(v)v.textContent='v'+V3_VERSION;
}
v3InitState();
const v3Num=x=>x!=null&&x!==''&&Number.isFinite(+x)?+x:null;
const v3Median=a=>{const x=a.filter(Number.isFinite).slice().sort((a,b)=>a-b),n=x.length;return n?(n%2?x[(n-1)/2]:(x[n/2-1]+x[n/2])/2):null};
const v3Sum=a=>a.reduce((s,x)=>s+(Number.isFinite(+x)?+x:0),0);
const v3Hours=m=>m==null?null:Math.round((m/60)*100)/100;
const v3Today=()=>dateKey(TODAY());

function v3Kind(a){
  const x=String(a.kind||a.type||a.sport||a.name||'').toLowerCase();
  if(x.includes('strength')||x.includes('forza')||x.includes('lower')||x.includes('upper'))return 'strength';
  if(x.includes('run')||x.includes('corsa'))return 'run';
  if(x.includes('bike')||x.includes('cycling')||x.includes('cyclette'))return 'bike';
  if(x.includes('walk')||x.includes('hike')||x.includes('cammin')||x.includes('escursion'))return 'walk';
  if(x.includes('padel')||x.includes('tennis')||x.includes('soccer')||x.includes('basket'))return 'sport';
  if(x.includes('cardio')||x.includes('z2'))return 'cardio';
  if(x.includes('recover')||x.includes('recuper'))return 'recovery';
  return 'other';
}
function v3NormalizeActivity(a,source){
  const mins=v3Num(a.durationMinutes??a.minutes??a.workoutMinutes);
  return {...a,id:a.id||a.corosId||a.labelId||uid(),corosId:a.corosId||a.labelId||null,source:a.source||source||'SmartCoach',
    date:String(a.date||a.startDate||'').slice(0,10),name:a.sport||a.name||a.title||'Attività',kind:v3Kind(a),minutes:mins,
    distanceKm:v3Num(a.distanceKm??a.distance),avgHr:v3Num(a.avgHr??a.averageHr),calories:v3Num(a.calories),
    trainingLoad:v3Num(a.trainingLoad),aerobicTE:v3Num(a.aerobicTE),anaerobicTE:v3Num(a.anaerobicTE)};
}
function unifiedActivities(){
  const coros=(state.coros.activities||[]).map(a=>v3NormalizeActivity(a,'COROS'));
  const local=(state.history||[]).map(a=>v3NormalizeActivity(a,'SmartCoach'));
  const out=[],byCoros=new Map();
  for(const a of coros){if(a.corosId)byCoros.set(String(a.corosId),a);out.push(a)}
  for(const a of local){
    if(a.corosId&&byCoros.has(String(a.corosId))){const c=byCoros.get(String(a.corosId));Object.assign(c,{...a,...c,exercises:a.exercises||c.exercises});continue}
    const dup=out.find(x=>x.source==='COROS'&&x.date===a.date&&x.kind===a.kind&&a.minutes&&x.minutes&&Math.abs(a.minutes-x.minutes)<8);
    if(dup){if(a.exercises&&!dup.exercises)dup.exercises=a.exercises;continue}out.push(a);
  }
  return out.filter(a=>a.date).sort((a,b)=>b.date.localeCompare(a.date));
}
historyOn=function(date){return unifiedActivities().filter(a=>a.date===date)};
isDone=function(date,sid){const kind=v3Kind(sessionById(sid));return historyOn(date).some(a=>a.kind===kind||(a.sessionId&&a.sessionId===sid))};

function v3SeriesRow(kind,date){return (state.health?.series?.[kind]||[]).find(x=>x.date===date)||null}
function v3CorosDaily(date){return (state.coros.dailyHealth||[]).find(x=>x.date===date)||null}
function v3CorosSleep(date){return (state.coros.sleep||[]).find(x=>x.date===date)||null}
function v3HealthDay(date){
  const appleSleep=state.health?.sleepDetails?.[date]||null,corosSleep=v3CorosSleep(date),corosDaily=v3CorosDaily(date);
  const sleepSeries=v3SeriesRow('sleep',date),hrv=v3SeriesRow('hrv',date),rhr=v3SeriesRow('rhr',date),steps=v3SeriesRow('steps',date),distance=v3SeriesRow('distance',date);
  const appleMain=appleSleep?.mainSleepMinutes!=null?v3Hours(appleSleep.mainSleepMinutes):(sleepSeries?.value!=null?+sleepSeries.value:null);
  const corosMain=corosSleep?.mainSleepMinutes!=null?v3Hours(corosSleep.mainSleepMinutes):(corosDaily?.sleepPeriodMinutes!=null?v3Hours(Math.max(0,corosDaily.sleepPeriodMinutes-(corosDaily.sleepAwakeMinutes||0))):null);
  const mainSleep=appleMain!=null&&appleMain>=1.5?appleMain:corosMain;
  const nap=appleSleep?.napMinutes!=null?v3Hours(appleSleep.napMinutes):(corosSleep?.napMinutes!=null?v3Hours(corosSleep.napMinutes):null);
  const stepValue=steps?.value!=null&&+steps.value>0?+steps.value:(corosDaily?.steps||null);
  return {date,mainSleep,nap,sleepSource:appleMain!=null&&appleMain>=1.5?'Apple Health':(corosMain!=null?'COROS':null),sleepDetail:appleSleep||corosSleep||null,
    hrv:hrv?.value!=null?+hrv.value:null,hrvSource:hrv?.source||null,rhr:rhr?.value!=null?+rhr.value:null,rhrSource:rhr?.source||null,
    steps:stepValue,stepsSource:steps?.value!=null&&+steps.value>0?'Apple Health':(corosDaily?.steps?'COROS':null),
    walkingDistanceKm:distance?.value!=null?+distance.value:null,corosStress:corosDaily?.stressAvg??null};
}
function v3Series(kind,days=90){
  const start=dateKey(addDays(TODAY(),-(days-1))),end=v3Today(),rows=[];
  for(let d=parseDate(start);d<=parseDate(end);d=addDays(d,1)){const k=dateKey(d),h=v3HealthDay(k);let v=null;
    if(kind==='sleep')v=h.mainSleep;else if(kind==='steps')v=h.steps;else if(kind==='hrv')v=h.hrv;else if(kind==='rhr')v=h.rhr;
    if(v!=null)rows.push({date:k,value:+v})}
  return rows;
}
function v3Baseline(kind,days=28,date=v3Today()){
  const start=dateKey(addDays(parseDate(date),-days));return v3Median(v3Series(kind,days+2).filter(x=>x.date>=start&&x.date<date).map(x=>+x.value));
}
function v3ManualShifts(){return (state.shifts||[]).filter(s=>s.source==='manual'||!V3_LEGACY_SHIFTS.has((s.date||'')+'|'+(s.title||'')))}
function v3Shift(date){
  const xs=[...(state.calendar?.shifts||[]),...v3ManualShifts()].filter(s=>s.date===date);if(!xs.length)return null;
  const titles=[...new Set(xs.map(x=>x.title).filter(Boolean))];
  return {date,title:titles.join(' + '),load:Math.min(4,v3Sum(xs.map(x=>x.load||1))),source:xs.some(x=>x.source==='Google Calendar')?'Google Calendar':'manual'};
}
shiftOn=function(date){return v3Shift(date)};

function v3Readiness(date=v3Today()){
  const h=v3HealthDay(date),check=state.readiness?.[date]||{},parts=[];
  const add=(label,value,weight,note,source)=>{if(value!=null&&Number.isFinite(value))parts.push({label,value:clamp(value,0,100),weight,note,source})};
  if(h.mainSleep!=null){const x=h.mainSleep,score=x>=7.5&&x<=9.5?100:x>=7?90:x>=6.5?80:x>=6?68:x>=5?50:30;add('Sonno',score,2.5,x.toFixed(1)+' h',h.sleepSource)}
  const hb=v3Baseline('hrv',21,date);if(h.hrv!=null&&hb){const q=h.hrv/hb,score=q>=1.05?100:q>=.95?90:q>=.85?72:q>=.75?55:38;add('HRV',score,2,(Math.round(h.hrv*10)/10)+' ms · base '+Math.round(hb),h.hrvSource||'Apple Health')}
  const rb=v3Baseline('rhr',21,date);if(h.rhr!=null&&rb){const delta=h.rhr-rb,score=delta<=0?100:delta<=3?85:delta<=6?65:delta<=9?45:30;add('FC riposo',score,1.5,Math.round(h.rhr)+' bpm · Δ '+(delta>=0?'+':'')+Math.round(delta),h.rhrSource||'Apple Health')}
  const recovery=v3Num(state.coros.recovery?.value??state.coros.recoveryValue??state.coros.recovery);if(recovery!=null)add('COROS Recovery',recovery,2,recovery+'%','COROS');
  if(check.energy!=null)add('Energia',+check.energy*20,.8,check.energy+'/5','check-in');
  if(check.soreness!=null)add('DOMS',(6-(+check.soreness))*20,.6,check.soreness+'/5','check-in');
  if(check.stress!=null)add('Stress',(6-(+check.stress))*20,.6,check.stress+'/5','check-in');
  let score=parts.length?Math.round(parts.reduce((s,x)=>s+x.value*x.weight,0)/parts.reduce((s,x)=>s+x.weight,0)):70;
  const sh=v3Shift(date);if(sh)score-=sh.load>=4?18:sh.load===3?10:sh.load===2?5:2;
  const ratio=v3Num(state.coros.loadRatio);if(ratio!=null&&ratio>1.6)score-=10;else if(ratio!=null&&ratio>1.35)score-=5;
  return {score:clamp(Math.round(score),0,100),parts:parts.sort((a,b)=>b.weight-a.weight),shift:sh,health:h};
}
latestReadiness=function(date){const r=state.readiness?.[date]||{},h=v3HealthDay(date);return {...r,sleepHours:h.mainSleep,hrv:h.hrv,rhr:h.rhr,steps:h.steps,corosRecovery:v3Num(state.coros.recovery?.value??state.coros.recoveryValue??state.coros.recovery),availableMinutes:r.availableMinutes||50}};
scoreReadiness=function(date){return v3Readiness(date).score};

function v3WeekStart(d){const x=new Date(d),day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x}
function v3RecentStrengthFocus(){
  const counts={lowerA:0,upper:0,lowerB:0};for(const a of unifiedActivities().filter(a=>a.kind==='strength').slice(0,8)){const x=String(a.sessionId||a.name||'').toLowerCase();
    if(x.includes('lowera')||x.includes('lower a'))counts.lowerA++;else if(x.includes('upper'))counts.upper++;else if(x.includes('lowerb')||x.includes('posterior'))counts.lowerB++}
  return Object.entries(counts).sort((a,b)=>a[1]-b[1])[0][0];
}
function v3PlanWeek(anchor=state.selectedDate||v3Today()){
  const ws=v3WeekStart(parseDate(anchor)),today=v3Today(),days=Array.from({length:7},(_,i)=>dateKey(addDays(ws,i))),actual=new Map(days.map(d=>[d,historyOn(d)]));
  let strengthDone=days.filter(d=>(actual.get(d)||[]).some(a=>a.kind==='strength')).length;
  let z2Done=days.filter(d=>(actual.get(d)||[]).some(a=>['run','bike','cardio'].includes(a.kind)&&/z2|easy|facile|base/i.test(String(a.name||a.focus||'')))).length;
  const plan={},focusOrder=['lowerA','upper','lowerB'];let focusIdx=Math.max(0,focusOrder.indexOf(v3RecentStrengthFocus())),lastStrengthDate=null;
  for(const d of days){
    const acts=actual.get(d)||[],sh=v3Shift(d);if(acts.some(a=>a.kind==='strength'))lastStrengthDate=d;
    if(d<today||acts.length){plan[d]={actual:acts,session:null,shift:sh};continue}
    const previous=days[days.indexOf(d)-1],prevHadStrength=(previous&&(actual.get(previous)||[]).some(a=>a.kind==='strength'))||lastStrengthDate===previous;
    let sid='recovery',needStrength=Math.max(0,3-strengthDone),needZ2=Math.max(0,2-z2Done);
    if(sh?.load>=4)sid='recovery';
    else if(sh?.load===3){if(needZ2>0){sid='z2short';z2Done++}}
    else if(needStrength>0&&!prevHadStrength){sid=focusOrder[focusIdx%focusOrder.length];focusIdx++;strengthDone++;lastStrengthDate=d}
    else if(needZ2>0){sid=needZ2>1?'z2short':'z2long';z2Done++}
    plan[d]={actual:acts,session:sessionById(sid),shift:sh};
  }
  return {days,plan};
}
baseSessionFor=function(date){return v3PlanWeek(date).plan[date]?.session||CARDIO.recovery};
recommendation=function(date){
  const p=v3PlanWeek(date).plan[date],ready=v3Readiness(date),r=latestReadiness(date),acts=historyOn(date);
  let session=p?.session||CARDIO.recovery,adjust='Completo',reason='Piano adattivo',setDelta=0,cardioFactor=1;
  if(acts.length){const hard=acts.some(a=>a.kind==='strength'||a.trainingLoad>=60||a.minutes>=60);if(hard){session=CARDIO.recovery;adjust='Già allenato';reason='Attività già registrata oggi';setDelta=-2;cardioFactor=.5}}
  else if(ready.shift?.load>=4||ready.score<50){session=CARDIO.recovery;adjust='Recupero';reason=ready.shift?.load>=4?'Turno molto impegnativo':'Recupero insufficiente';setDelta=-2;cardioFactor=.55}
  else if(ready.shift?.load>=3||ready.score<65){adjust=session.type==='cardio'?'Leggero':'Ridotto';reason=ready.shift?.load>=3?'Turno impegnativo':'Readiness ridotta';setDelta=-1;cardioFactor=.75}
  else if(ready.score<78){adjust='Compatto';reason='Volume ridotto sul recupero attuale';setDelta=-1;cardioFactor=.85}
  const av=+(r.availableMinutes||50);if(session.type!=='recovery'&&av<=35){adjust=av+' min';reason='Adattato al tempo disponibile';setDelta=Math.min(setDelta,av<=25?-2:-1);cardioFactor=Math.min(cardioFactor,av<=25?.6:.8)}
  return {base:p?.session||session,session,score:ready.score,shift:ready.shift,adjust,reason,setDelta,cardioFactor,availableMinutes:av};
};
