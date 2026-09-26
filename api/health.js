import { put, get, list } from '@vercel/blob';

const PARSER_VERSION=4;
const LEGACY_PATH='smartcoach/health/latest.json';
const SUMMARY_PATH='smartcoach/health/summary.json';
const BATCH_PREFIX='smartcoach/health/inbox/';

function headers(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,X-API-Key');
  res.setHeader('Cache-Control','no-store');
}
const blobOpts=()=>({token:process.env.BLOB_READ_WRITE_TOKEN});
const clean=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const n=v=>typeof v==='number'&&Number.isFinite(v)?v:(typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null);
const ts=v=>{const x=Date.parse(v);return Number.isFinite(x)?x:null};
const dateText=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):(ts(v)!=null?new Date(v).toISOString().slice(0,10):null);
const median=a=>{const x=a.filter(Number.isFinite).slice().sort((a,b)=>a-b),m=x.length;return m?(m%2?x[(m-1)/2]:(x[m/2-1]+x[m/2])/2):null};
const round2=v=>Math.round(v*100)/100;

const TERMS={
  hrv:['heartratevariability','hrv','sdnn'],
  rhr:['restingheartrate','restinghr'],
  respiratory:['respiratoryrate'],
  temp:['wristtemperature','wristtemp','bodytemperature'],
  steps:['stepcount','steps'],
  distance:['walkingrunningdistance','distancewalkingrunning','distancewalkrun'],
  sleep:['sleepanalysis','sleepduration','sleephours','timesleep','asleep']
};
function kindFor(v){
  const x=clean(v);
  for(const [k,arr] of Object.entries(TERMS))if(arr.some(t=>x.includes(t)))return k;
  return null;
}
function firstString(o,keys){for(const k of keys)if(typeof o?.[k]==='string'&&o[k])return o[k];return null}
function firstDate(o,keys){for(const k of keys){const v=o?.[k];if(typeof v==='string'&&ts(v)!=null)return v}return null}
function sourceOf(o){
  const direct=firstString(o,['sourceName','deviceName','source_name','sourceBundle','source_bundle','app']);
  if(direct)return direct;
  for(const k of ['source','device']){
    const x=o?.[k];
    if(typeof x==='string'&&x)return x;
    if(x&&typeof x==='object'){
      const nested=firstString(x,['name','sourceName','deviceName','bundleIdentifier','bundle','model']);
      if(nested)return nested;
    }
  }
  return 'unknown';
}
function stageOf(v){
  const x=clean(v);
  if(!x)return null;
  if(x.includes('awake'))return 'awake';
  if(x.includes('inbed'))return 'inbed';
  if(x.includes('deep'))return 'deep';
  if(x.includes('rem'))return 'rem';
  if(x.includes('core')||x.includes('light'))return 'light';
  if(x.includes('asleep')||x.includes('sleeping'))return 'asleep';
  return null;
}
function healthKitSleepStage(value){
  const x=n(value);
  if(x===0)return 'inbed';
  if(x===1)return 'asleep';
  if(x===2)return 'awake';
  if(x===3)return 'light';
  if(x===4)return 'deep';
  if(x===5)return 'rem';
  return null;
}
function unitConvert(kind,value,unit=''){
  let v=Number(value); if(!Number.isFinite(v))return null;
  const u=clean(unit);
  if(kind==='sleep'){
    if(u.includes('hour'))return v;
    if(u.includes('minute')||u==='min')return v/60;
    if(u.includes('second')||u==='sec'||u==='s')return v/3600;
    if(v>1000)return v/3600;
    if(v>24)return v/60;
  }
  if(kind==='hrv'&&(u==='s'||u.includes('second'))&&v<10)return v*1000;
  if(kind==='distance'){
    if(u==='m'||u.includes('meter'))return v/1000;
    if(u.includes('mile'))return v*1.609344;
  }
  return v;
}
function mergeIntervals(rows,gapMs=0){
  const s=rows.filter(x=>ts(x.start)!=null&&ts(x.end)!=null&&ts(x.end)>ts(x.start))
    .map(x=>({...x,a:ts(x.start),b:ts(x.end)})).sort((a,b)=>a.a-b.a);
  const out=[];
  for(const x of s){
    const p=out.at(-1);
    if(p&&x.a<=p.b+gapMs){if(x.b>p.b){p.b=x.b;p.end=x.end}p.parts.push(x)}
    else out.push({a:x.a,b:x.b,start:x.start,end:x.end,parts:[x]});
  }
  return out;
}
function durationMs(intervals){return mergeIntervals(intervals).reduce((s,x)=>s+x.b-x.a,0)}
function buildSleepDetails(intervals){
  const asleep=intervals.filter(x=>['deep','rem','light','asleep'].includes(x.stage));
  if(!asleep.length)return {};
  const merged=mergeIntervals(asleep,5*60*1000);
  const clusters=[];
  for(const x of merged){
    const p=clusters.at(-1);
    if(p&&x.a-p.b<=90*60*1000){p.b=Math.max(p.b,x.b);p.end=x.end;p.rows.push(...x.parts)}
    else clusters.push({a:x.a,b:x.b,start:x.start,end:x.end,rows:[...x.parts]});
  }
  const byWake={};
  for(const c of clusters){
    const wake=dateText(c.end); if(!wake)continue;
    const asleepMs=durationMs(c.rows);
    if(asleepMs<20*60*1000)continue;
    const item={start:c.start,end:c.end,asleepMs,periodMs:c.b-c.a,rows:c.rows};
    (byWake[wake]||(byWake[wake]=[])).push(item);
  }
  const out={};
  for(const [wake,clusters0] of Object.entries(byWake)){
    const clusters=clusters0.sort((a,b)=>b.asleepMs-a.asleepMs),main=clusters[0],naps=clusters.slice(1);
    const allRows=intervals.filter(x=>{const a=ts(x.start),b=ts(x.end);return a!=null&&b!=null&&a>=main.a-5*60*1000&&b<=main.b+5*60*1000});
    const stageMin={deep:0,light:0,rem:0,awake:0,asleep:0};
    for(const st of Object.keys(stageMin)){stageMin[st]=Math.round(durationMs(allRows.filter(x=>x.stage===st))/60000)}
    const napAsleep=Math.round(naps.reduce((s,x)=>s+x.asleepMs,0)/60000);
    out[wake]={
      date:wake,source:'Apple Health',mainSleepMinutes:Math.round(main.asleepMs/60000),
      mainSleepPeriodMinutes:Math.round(main.periodMs/60000),mainStart:main.start,mainEnd:main.end,
      napMinutes:napAsleep,totalSleepMinutes:Math.round(main.asleepMs/60000)+napAsleep,
      deepMinutes:stageMin.deep,lightMinutes:stageMin.light,remMinutes:stageMin.rem,
      awakeMinutes:stageMin.awake,samples:main.rows.length+naps.reduce((s,x)=>s+x.rows.length,0)
    };
  }
  return out;
}
function buildAggregateSleepDetails(rows){
  const byWake={};
  for(const row of rows){
    const wake=row.date||dateText(row.end);if(!wake||row.totalHours==null)continue;
    (byWake[wake]||(byWake[wake]=[])).push(row);
  }
  const out={};
  for(const [wake,items0] of Object.entries(byWake)){
    const items=items0.filter(x=>x.totalHours>=0.33).sort((a,b)=>b.totalHours-a.totalHours);
    if(!items.length)continue;
    const main=items[0],naps=items.slice(1);
    const periodHours=main.inBedHours!=null?main.inBedHours:(
      ts(main.start)!=null&&ts(main.end)!=null?Math.max(0,(ts(main.end)-ts(main.start))/3600000):main.totalHours
    );
    const napMinutes=Math.round(naps.reduce((s,x)=>s+(x.totalHours||0),0)*60);
    out[wake]={
      date:wake,source:'Apple Health',mainSleepMinutes:Math.round(main.totalHours*60),
      mainSleepPeriodMinutes:Math.round(periodHours*60),mainStart:main.start||null,mainEnd:main.end||null,
      napMinutes,totalSleepMinutes:Math.round(main.totalHours*60)+napMinutes,
      deepMinutes:main.deepHours!=null?Math.round(main.deepHours*60):null,
      lightMinutes:main.lightHours!=null?Math.round(main.lightHours*60):null,
      remMinutes:main.remHours!=null?Math.round(main.remHours*60):null,
      awakeMinutes:main.awakeHours!=null?Math.round(main.awakeHours*60):null,
      samples:items.length
    };
  }
  return out;
}
export function extractHealth(root,receivedAt){
  const obs={hrv:[],rhr:[],respiratory:[],temp:[],steps:[],distance:[],sleep:[]};
  const sleepIntervals=[];
  const sleepAggregates=[];
  const descriptor=/^(name|type|identifier|datatype|data_type|metric|metricname|metric_name|displayname|display_name|quantitytype|quantity_type|category|categorytype)$/i;
  const valueKeys=new Set(['value','qty','quantity','average','avg','mean','latest','mostrecent','most_recent','total','sum','count','duration','hours','minutes']);
  const unitRe=/^(unit|units)$/i;
  function add(kind,value,date,unit,source){
    const v=unitConvert(kind,value,unit); if(v==null)return;
    obs[kind].push({value:v,date:date||receivedAt,source:source||'unknown'});
  }
  function walk(v,path='',ctx='',inheritedDate=receivedAt){
    if(v==null)return;
    if(Array.isArray(v)){v.forEach((x,i)=>walk(x,path+'['+i+']',ctx,inheritedDate));return}
    if(typeof v!=='object')return;
    const entries=Object.entries(v);
    const desc=entries.filter(([k,x])=>descriptor.test(k)&&typeof x==='string').map(([,x])=>x).join(' ');
    const local=(ctx+' '+path+' '+desc).trim();
    const localKind=kindFor(local);
    const localDate=firstDate(v,['date','timestamp','startDate','start_date','endDate','end_date','recordedAt','recorded_at'])||inheritedDate;
    const unit=entries.find(([k,x])=>unitRe.test(k)&&typeof x==='string')?.[1]||'';
    const source=sourceOf(v);
    const start=firstDate(v,['startDate','start_date','start','from','sleepStart','sleep_start']);
    const end=firstDate(v,['endDate','end_date','end','to','sleepEnd','sleep_end']);
    if(localKind==='sleep'&&Array.isArray(v.data)){
      const metricUnit=firstString(v,['units','unit'])||unit;
      for(const row of v.data){
        if(!row||typeof row!=='object')continue;
        const rs=firstDate(row,['sleepStart','sleep_start','startDate','start_date','start']);
        const re=firstDate(row,['sleepEnd','sleep_end','endDate','end_date','end']);
        const wake=dateText(row.date)||dateText(re);
        const totalRaw=n(row.totalSleep)??n(row.asleep);
        const totalHours=totalRaw==null?null:unitConvert('sleep',totalRaw,metricUnit);
        if(totalHours==null)continue;
        const conv=x=>{const z=n(x);return z==null?null:unitConvert('sleep',z,metricUnit)};
        sleepAggregates.push({
          date:wake,start:rs,end:re,totalHours,
          inBedHours:conv(row.inBed),deepHours:conv(row.deep),lightHours:conv(row.core??row.light),
          remHours:conv(row.rem),awakeHours:conv(row.awake),source:sourceOf(row)||source
        });
      }
    }
    if((localKind==='sleep'||clean(local).includes('sleep'))&&start&&end&&ts(end)>ts(start)){
      const status=[desc,v.value,v.categoryValue,v.category_value,v.sleepStage,v.stage,v.status].filter(x=>typeof x==='string').join(' ');
      const stage=stageOf(status)||healthKitSleepStage(v.value);
      if(stage)sleepIntervals.push({start,end,stage,source});
    }
    for(const [k,x] of entries){
      const num=n(x); if(num==null)continue;
      const direct=kindFor(k),kind=direct||localKind,nk=clean(k);
      if(!kind)continue;
      if(!direct&&!valueKeys.has(nk)&&!nk.endsWith('value')&&!nk.endsWith('average')&&!nk.endsWith('quantity'))continue;
      if(kind==='sleep'&&start&&end)continue;
      add(kind,num,localDate,unit,source);
    }
    for(const [k,x] of entries)if(x&&typeof x==='object')walk(x,path?path+'.'+k:k,local,localDate);
  }
  walk(root);

  const aggregateSleepDetails=buildAggregateSleepDetails(sleepAggregates);
  const intervalSleepDetails=buildSleepDetails(sleepIntervals);
  const sleepDetails={...aggregateSleepDetails,...intervalSleepDetails};
  const series={};
  const byDay=(arr)=>{
    const m={};for(const x of arr){const d=dateText(x.date);if(d)(m[d]||(m[d]=[])).push(x)}return m;
  };

  // Steps: HealthKit may contain overlapping Watch/iPhone streams. Sum each source,
  // then use the largest source total instead of double-counting multiple devices.
  const stepsByDay=byDay(obs.steps);
  series.steps=Object.entries(stepsByDay).map(([date,rows])=>{
    const per={};for(const x of rows)(per[x.source]||(per[x.source]=[])).push(x.value);
    const totals=Object.values(per).map(a=>a.reduce((s,v)=>s+v,0));
    const value=totals.length?Math.max(...totals):0;
    return {date,value:Math.round(value),samples:rows.length,source:'Apple Health'};
  }).sort((a,b)=>a.date.localeCompare(b.date));

  const distByDay=byDay(obs.distance);
  series.distance=Object.entries(distByDay).map(([date,rows])=>{
    const per={};for(const x of rows)(per[x.source]||(per[x.source]=[])).push(x.value);
    const totals=Object.values(per).map(a=>a.reduce((s,v)=>s+v,0));
    return {date,value:round2(totals.length?Math.max(...totals):0),samples:rows.length,source:'Apple Health'};
  }).sort((a,b)=>a.date.localeCompare(b.date));

  for(const kind of ['rhr','respiratory','temp']){
    series[kind]=Object.entries(byDay(obs[kind])).map(([date,rows])=>({date,value:round2(median(rows.map(x=>x.value))),samples:rows.length,source:'Apple Health'})).sort((a,b)=>a.date.localeCompare(b.date));
  }

  // Prefer HRV samples recorded inside the main sleep interval and attribute them to
  // the wake-up date. Fall back to the daily median when no sleep window is present.
  const hrvUsed=new Set(),hrvRows=[];
  for(const [date,s] of Object.entries(sleepDetails)){
    const a=ts(s.mainStart),b=ts(s.mainEnd);
    const rows=obs.hrv.filter((x,i)=>{const t=ts(x.date);if(t!=null&&t>=a&&t<=b){hrvUsed.add(i);return true}return false});
    if(rows.length)hrvRows.push({date,value:round2(median(rows.map(x=>x.value))),samples:rows.length,source:'Apple Health · sonno'});
  }
  const hrvFallback=byDay(obs.hrv.filter((_,i)=>!hrvUsed.has(i)));
  for(const [date,rows] of Object.entries(hrvFallback))if(!hrvRows.some(x=>x.date===date))hrvRows.push({date,value:round2(median(rows.map(x=>x.value))),samples:rows.length,source:'Apple Health'});
  series.hrv=hrvRows.sort((a,b)=>a.date.localeCompare(b.date));

  series.sleep=Object.values(sleepDetails).map(s=>({date:s.date,value:round2(s.mainSleepMinutes/60),samples:s.samples,source:'Apple Health · sonno principale'})).sort((a,b)=>a.date.localeCompare(b.date));
  if(!series.sleep.length&&obs.sleep.length){
    series.sleep=Object.entries(byDay(obs.sleep)).map(([date,rows])=>({date,value:round2(median(rows.map(x=>x.value))),samples:rows.length,source:'Apple Health'})).sort((a,b)=>a.date.localeCompare(b.date));
  }

  const metrics={},metricDates={};
  for(const [kind,rows] of Object.entries(series)){
    const last=rows.at(-1);if(last){metrics[kind]=last.value;metricDates[kind]=last.date}
  }
  return {metrics,metricDates,series,sleepDetails,parserVersion:PARSER_VERSION};
}
async function readJson(path){
  const r=await get(path,{...blobOpts(),access:'private',useCache:false});if(!r)return null;
  return new Response(r.stream).json();
}
async function writeJson(path,value){
  return put(path,JSON.stringify(value),{...blobOpts(),access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
}
function mergeSummary(prev,inc,receivedAt){
  const out=prev&&typeof prev==='object'?prev:{metrics:{},metricDates:{},series:{},sleepDetails:{}};
  out.metrics={...(out.metrics||{})};out.metricDates={...(out.metricDates||{})};out.series={...(out.series||{})};out.sleepDetails={...(out.sleepDetails||{})};
  for(const [kind,rows] of Object.entries(inc.series||{})){
    const m=new Map((out.series[kind]||[]).map(x=>[x.date,x]));
    for(const row of rows)m.set(row.date,row);
    out.series[kind]=[...m.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-180);
    const last=out.series[kind].at(-1);if(last){out.metrics[kind]=last.value;out.metricDates[kind]=last.date}
  }
  for(const [d,s] of Object.entries(inc.sleepDetails||{}))out.sleepDetails[d]=s;
  const sleepKeys=Object.keys(out.sleepDetails).sort();if(sleepKeys.length>180)for(const d of sleepKeys.slice(0,-180))delete out.sleepDetails[d];
  out.lastReceivedAt=receivedAt;out.updatedAt=new Date().toISOString();out.parserVersion=PARSER_VERSION;
  return out;
}
async function rebuild(){
  const listed=await list({...blobOpts(),prefix:BATCH_PREFIX,limit:1000});
  const blobs=(listed.blobs||[]).slice().sort((a,b)=>String(a.pathname).localeCompare(String(b.pathname)));
  let summary=null;const schemas=new Set();
  const schema=(v,path='',depth=0)=>{if(v==null||depth>7||schemas.size>180)return;if(Array.isArray(v)){if(v.length)schema(v[0],path+'[]',depth+1);return}if(typeof v!=='object')return;for(const [k,x] of Object.entries(v)){const p=path?path+'.'+k:k;schemas.add(p);if(x&&typeof x==='object')schema(x,p,depth+1)}};
  for(const b of blobs){try{const env=await readJson(b.pathname);if(!env)continue;const at=env.receivedAt||b.uploadedAt||new Date().toISOString(),raw=env.payload??env;schema(raw);summary=mergeSummary(summary,extractHealth(raw,at),at)}catch{}}
  return {summary,batchCount:blobs.length,schemaPaths:[...schemas]};
}
export default async function handler(req,res){
  headers(res);if(req.method==='OPTIONS')return res.status(204).end();
  try{
    if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('BLOB_READ_WRITE_TOKEN missing');
    if(req.method==='POST'){
      let payload=req.body;if(typeof payload==='string'){try{payload=payload.trim()?JSON.parse(payload):{}}catch{payload={raw:payload}}}
      const receivedAt=new Date().toISOString(),batch=BATCH_PREFIX+Date.now()+'-'+Math.random().toString(36).slice(2,9)+'.json';
      await writeJson(batch,{receivedAt,payload:payload??{}});
      const inc=extractHealth(payload??{},receivedAt);
      let prev=null;try{prev=await readJson(SUMMARY_PATH)}catch{}
      const summary=mergeSummary(prev,inc,receivedAt);await writeJson(SUMMARY_PATH,summary);
      return res.status(200).json({ok:true,stored:true,receivedAt,recognized:Object.keys(inc.metrics||{}),sleepNights:Object.keys(inc.sleepDetails||{}).length});
    }
    if(req.method==='GET'){
      let summary=null;try{summary=await readJson(SUMMARY_PATH)}catch{}
      let rebuilt=null;
      if(!summary||summary.parserVersion!==PARSER_VERSION||req.query?.rebuild==='1'){
        rebuilt=await rebuild();summary=rebuilt.summary;
        if(!summary){let legacy=null;try{legacy=await readJson(LEGACY_PATH)}catch{}if(legacy){const at=legacy.receivedAt||new Date().toISOString();summary=mergeSummary(null,extractHealth(legacy.payload??legacy,at),at)}}
        if(summary)await writeJson(SUMMARY_PATH,summary);
      }
      if(req.query?.diag==='1'){
        if(!rebuilt)rebuilt=await rebuild();
        return res.status(200).json({ok:true,service:'smartcoach-health-v3',parserVersion:PARSER_VERSION,batchCount:rebuilt.batchCount,summaryExists:!!summary,recognized:Object.keys(summary?.metrics||{}),lastReceivedAt:summary?.lastReceivedAt||null,sleepNights:Object.keys(summary?.sleepDetails||{}).length,schemaPaths:rebuilt.schemaPaths.slice(0,180)});
      }
      if(!summary||!Object.keys(summary.metrics||{}).length)return res.status(404).json({ok:false,error:'health_metrics_not_recognized'});
      return res.status(200).json({ok:true,service:'smartcoach-health-v3',parserVersion:PARSER_VERSION,metrics:summary.metrics,metricDates:summary.metricDates,series:summary.series,sleepDetails:summary.sleepDetails||{},receivedAt:summary.lastReceivedAt||summary.updatedAt});
    }
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }catch(e){console.error('health api error',e);return res.status(500).json({ok:false,error:String(e?.message||e)})}
}