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
    distanceKm:v3Num(a.distanceKm??a.distance??a.km),avgHr:v3Num(a.avgHr??a.averageHr),calories:v3Num(a.calories),
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
  const corosHrv=(state.coros.sleepHrv||[]).find(x=>x.date===date)||null,corosRhr=(state.coros.restingHrHistory||[]).find(x=>x.date===date)||null;
  const appleDetailed=appleSleep?.mainSleepMinutes!=null||/sonno principale/i.test(String(sleepSeries?.source||''));
  const appleMain=appleSleep?.mainSleepMinutes!=null?v3Hours(appleSleep.mainSleepMinutes):(appleDetailed&&sleepSeries?.value!=null?+sleepSeries.value:null);
  const corosMain=corosSleep?.mainSleepMinutes!=null?v3Hours(corosSleep.mainSleepMinutes):(corosDaily?.sleepPeriodMinutes!=null?v3Hours(Math.max(0,corosDaily.sleepPeriodMinutes-(corosDaily.sleepAwakeMinutes||0))):null);
  const mainSleep=appleMain!=null&&appleMain>=1.5?appleMain:corosMain;
  const nap=appleSleep?.napMinutes!=null?v3Hours(appleSleep.napMinutes):(corosSleep?.napMinutes!=null?v3Hours(corosSleep.napMinutes):null);
  const appleSleepHrv=/sonno/i.test(String(hrv?.source||''))&&hrv?.value!=null?+hrv.value:null;
  const hrvValue=appleSleepHrv!=null?appleSleepHrv:(corosHrv?.avg??(hrv?.value!=null?+hrv.value:null));
  const hrvSource=appleSleepHrv!=null?(hrv?.source||'Apple Health · sonno'):(corosHrv?.avg!=null?'COROS Sleep HRV':(hrv?.source||null));
  const rhrValue=rhr?.value!=null?+rhr.value:(corosRhr?.value??null),rhrSource=rhr?.value!=null?(rhr?.source||'Apple Health'):(corosRhr?.value!=null?'COROS':null);
  const stepValue=steps?.value!=null&&+steps.value>0?+steps.value:(corosDaily?.steps||null);
  return {date,mainSleep,nap,sleepSource:appleMain!=null&&appleMain>=1.5?'Apple Health':(corosMain!=null?'COROS':null),sleepDetail:(appleMain!=null&&appleMain>=1.5?appleSleep:null)||corosSleep||appleSleep,
    hrv:hrvValue,hrvSource,rhr:rhrValue,rhrSource,
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
function v3ShiftType(s){
  if(s?.workType)return s.workType;
  const x=String(s?.title||'').toLowerCase();
  if(/reperib/.test(x))return 'availability';
  if(/24\s*ore|24\s*h|24h/.test(x))return '24h';
  if(/weekend/.test(x)&&/(osped|spital|repart|medicina|simio)/.test(x))return 'morning';
  if(/notte/.test(x))return 'night';
  if(/pomeriggio|\bpome\b/.test(x))return 'afternoon';
  if(/mattina/.test(x))return 'morning';
  const load=+s?.load||0;
  return load>=4?'24h':load===3?'night':load===2?'afternoon':load===1?'morning':null;
}
function v3Shift(date){
  const xs=[...(state.calendar?.shifts||[]),...v3ManualShifts()].filter(s=>s.date===date);if(!xs.length)return null;
  const titles=[...new Set(xs.map(x=>x.title).filter(Boolean))],types=xs.map(v3ShiftType).filter(Boolean);
  const availability=types.includes('availability'),workTypes=[...new Set(types.filter(x=>x!=='availability'))];
  const workType=['24h','night','afternoon','morning'].find(x=>workTypes.includes(x))||(availability?'availability':null);
  const load=workType==='24h'?4:workType==='night'?3:workType==='afternoon'?2:workType==='morning'?1:0;
  return {date,title:titles.join(' + '),load,workType,workTypes,availability,countsAsWork:workTypes.length>0,source:xs.some(x=>x.source==='Google Calendar')?'Google Calendar':'manual'};
}
function v3ScheduleStrategy(shift){
  const t=shift?.workType||null;
  if(t==='24h')return {workType:t,preferredWorkout:'recovery',preferredPlace:null,preferredTime:'nessun allenamento strutturato',reason:'Turno di 24 ore: priorità a recupero e sonno'};
  if(t==='night')return {workType:t,preferredWorkout:'strength',preferredPlace:'PALESTRA',preferredTime:'prima della notte',exerciseLimit:5,setDelta:-1,rirTarget:'3–4',maxMinutes:40,reason:'Turno di notte: palestra breve e meno intensa'};
  if(t==='afternoon')return {workType:t,preferredWorkout:'cardio',preferredPlace:null,preferredTime:'mattina',reason:'Turno di pomeriggio: corsa/cardio al mattino'};
  if(t==='morning')return {workType:t,preferredWorkout:'strength',preferredPlace:'PALESTRA',preferredTime:'dopo il turno',exerciseLimit:'full',setDelta:0,rirTarget:'2–3',reason:'Turno di mattina: palestra completa dopo il lavoro'};
  if(t==='availability')return {workType:t,preferredWorkout:'normal',preferredPlace:null,preferredTime:null,reason:'Reperibilità: non conta come carico finché non si attiva'};
  return {workType:null,preferredWorkout:'normal',preferredPlace:null,preferredTime:null,reason:'Piano adattivo'};
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
  const sh=v3Shift(date),shiftType=sh?.workType;
  // Calendar is primarily a scheduling constraint, not a physiological penalty.
  // Morning/afternoon and pure availability do not lower readiness before training.
  if(shiftType==='24h')score-=18;
  else if(shiftType==='night')score-=5;
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
function v3TimeMinutes(s){
  if(!s)return null;const p=String(s).trim().split(':').map(Number);
  if(p.some(x=>!Number.isFinite(x)))return null;
  return p.length===3?p[0]*60+p[1]+p[2]/60:p.length===2?p[0]+p[1]/60:null;
}
function v3PlanWeek(anchor=state.selectedDate||v3Today()){
  const ws=v3WeekStart(parseDate(anchor)),today=v3Today(),days=Array.from({length:7},(_,i)=>dateKey(addDays(ws,i))),actual=new Map(days.map(d=>[d,historyOn(d)]));
  const goals=state.settings?.goals||{},muscle=goals.muscle||'hypertrophy',priority=goals.priority||'legs-posterior-chain';
  const strengthTarget=muscle==='maintenance'?2:3,cardioTarget=2;
  const predicted5=v3TimeMinutes(state.coros.racePredictions?.k5||state.coros.fitness?.racePredictions?.k5),target5=v3Num(goals.run5kMin);
  const qualityWanted=!currentReentry(today)&&target5!=null&&predicted5!=null&&target5<predicted5-.25;
  const strengthOrder=priority==='upper'?['upper','lowerA','upper']:priority==='balanced'?['lowerA','upper','lowerB']:['lowerA','upper','lowerB'];
  let strengthDone=days.filter(d=>(actual.get(d)||[]).some(a=>a.kind==='strength')).length;
  let aerobicDone=days.filter(d=>(actual.get(d)||[]).some(a=>['run','bike','cardio'].includes(a.kind)&&/z2|easy|facile|base/i.test(String((a.name||'')+' '+(a.focus||''))))).length;
  let qualityDone=days.filter(d=>(actual.get(d)||[]).some(a=>a.kind==='run'&&/threshold|tempo|interval|quality|qualit|soglia/i.test(String((a.name||'')+' '+(a.focus||''))))).length;
  const plan={};let focusIdx=Math.max(0,strengthOrder.indexOf(v3RecentStrengthFocus())),lastStrengthDate=null;
  const nextStrength=()=>{const sid=strengthOrder[focusIdx%strengthOrder.length];focusIdx++;strengthDone++;lastStrengthDate=currentDay;return sid};
  let currentDay=null;
  for(const d of days){
    currentDay=d;
    const acts=actual.get(d)||[],sh=v3Shift(d),strategy=v3ScheduleStrategy(sh);if(acts.some(a=>a.kind==='strength'))lastStrengthDate=d;
    if(d<today||acts.length){plan[d]={actual:acts,session:null,shift:sh,strategy};continue}
    const previous=days[days.indexOf(d)-1],prevHadStrength=(previous&&(actual.get(previous)||[]).some(a=>a.kind==='strength'))||lastStrengthDate===previous;
    let sid='recovery',needStrength=Math.max(0,strengthTarget-strengthDone),needAerobic=Math.max(0,cardioTarget-aerobicDone-qualityDone);
    if(strategy.workType==='24h'){
      sid='recovery';
    }else if(strategy.workType==='night'){
      // Night shifts reserve the training slot for a short gym session.
      if(needStrength>0)sid=nextStrength();
    }else if(strategy.workType==='afternoon'){
      // Afternoon work is used for morning aerobic training, never for a planned strength session.
      if(qualityWanted&&!qualityDone&&needAerobic>0){sid='runQuality';qualityDone++}
      else if(needAerobic>0){sid=needAerobic>1?'z2short':'z2long';aerobicDone++}
    }else if(strategy.workType==='morning'){
      // Morning-only work leaves the later part of the day available for a complete gym session.
      if(needStrength>0&&!prevHadStrength)sid=nextStrength();
      else if(needAerobic>0){sid=needAerobic>1?'z2short':'z2long';aerobicDone++}
    }else{
      // Availability alone behaves exactly like a free day.
      if(needStrength>0&&!prevHadStrength)sid=nextStrength();
      else if(qualityWanted&&!qualityDone&&needAerobic>0){sid='runQuality';qualityDone++}
      else if(needAerobic>0){sid=needAerobic>1?'z2short':'z2long';aerobicDone++}
    }
    plan[d]={actual:acts,session:sessionById(sid),shift:sh,strategy};
  }
  return {days,plan,targets:{strength:strengthTarget,cardio:cardioTarget,quality:qualityWanted?1:0}};
}
baseSessionFor=function(date){return v3PlanWeek(date).plan[date]?.session||CARDIO.recovery};
function safelyExerciseLimit(session){return Array.isArray(session?.exercises)?session.exercises.length:6}
recommendation=function(date){
  const p=v3PlanWeek(date).plan[date],ready=v3Readiness(date),r=latestReadiness(date),acts=historyOn(date),strategy=p?.strategy||v3ScheduleStrategy(ready.shift);
  let session=p?.session||CARDIO.recovery,adjust='Completo',reason=strategy.reason||'Piano adattivo',setDelta=0,cardioFactor=1;
  let availableMinutes=+(r.availableMinutes||50),exerciseLimit=null,rirTarget=null,preferredPlace=strategy.preferredPlace||null,preferredTime=strategy.preferredTime||null;
  const isStrength=session&&session.type!=='cardio'&&session.type!=='recovery';

  if(acts.length){
    const hard=acts.some(a=>a.kind==='strength'||a.trainingLoad>=60||a.minutes>=60);
    if(hard){session=CARDIO.recovery;adjust='Già allenato';reason='Attività già registrata oggi';setDelta=-2;cardioFactor=.5;exerciseLimit=null}
  }else if(strategy.workType==='24h'||ready.score<50){
    session=CARDIO.recovery;adjust='Recupero';reason=strategy.workType==='24h'?strategy.reason:'Recupero insufficiente';setDelta=-2;cardioFactor=.55;exerciseLimit=null;
  }else{
    if(strategy.workType==='night'&&isStrength){
      setDelta=Math.min(setDelta,-1);exerciseLimit=5;rirTarget='3–4';availableMinutes=Math.min(availableMinutes,40);adjust='Palestra ridotta';reason=strategy.reason;
    }else if(strategy.workType==='morning'&&isStrength){
      exerciseLimit=session.exercises?.length||6;rirTarget='2–3';adjust='Palestra completa';reason=strategy.reason;
    }else if(strategy.workType==='afternoon'&&session.type==='cardio'){
      adjust='Mattina';reason=strategy.reason;
    }else if(strategy.workType==='availability'){
      reason=strategy.reason;
    }

    if(ready.score<65){
      if(isStrength){setDelta=Math.min(setDelta,-1);exerciseLimit=Math.min(exerciseLimit||5,4);rirTarget='3–4'}
      else if(session.type==='cardio')cardioFactor=Math.min(cardioFactor,.75);
      adjust='Ridotto';reason='Readiness ridotta: '+reason;
    }else if(ready.score<78&&strategy.workType!=='morning'){
      if(isStrength)setDelta=Math.min(setDelta,-1);
      if(session.type==='cardio')cardioFactor=Math.min(cardioFactor,.85);
      adjust=adjust==='Completo'?'Compatto':adjust;
    }

    const av=+(r.availableMinutes||50);
    if(session.type!=='recovery'&&av<=35){
      availableMinutes=av;adjust=av+' min';reason='Tempo disponibile: '+reason;
      if(isStrength){setDelta=Math.min(setDelta,av<=25?-2:-1);exerciseLimit=Math.min(exerciseLimit||safelyExerciseLimit(session),av<=25?4:5)}
      else cardioFactor=Math.min(cardioFactor,av<=25?.6:.8);
    }
  }
  return {base:p?.session||session,session,score:ready.score,shift:ready.shift,strategy,adjust,reason,setDelta,cardioFactor,availableMinutes,exerciseLimit,rirTarget,preferredPlace,preferredTime};
};

currentReentry=function(date=v3Today()){
  const start=dateKey(addDays(parseDate(date),-21));
  return unifiedActivities().filter(a=>a.kind==='strength'&&a.date>=start&&a.date<=date).length<4;
};
state.settings.reentry=currentReentry(state.selectedDate||v3Today());save();
