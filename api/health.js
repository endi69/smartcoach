import { put, get, list } from '@vercel/blob';

const LEGACY_PATH='smartcoach/health/latest.json';
const SUMMARY_PATH='smartcoach/health/summary.json';
const BATCH_PREFIX='smartcoach/health/inbox/';

function headers(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,X-API-Key');
  res.setHeader('Cache-Control','no-store');
}
function blobOpts(){return {token:process.env.BLOB_READ_WRITE_TOKEN};}
function clean(s){return String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'');}
function num(v){if(typeof v==='number'&&Number.isFinite(v))return v;if(typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v)))return Number(v);return null;}
function timeValue(v){const t=Date.parse(v);return Number.isFinite(t)?t:0;}
function isoFromObject(o,fallback){
  for(const k of ['date','timestamp','startDate','start_date','endDate','end_date','recordedAt','recorded_at']){
    if(typeof o?.[k]==='string'&&timeValue(o[k]))return o[k];
  }
  return fallback;
}
const TERMS={
  hrv:['heartratevariability','hrv','hkquantitytypeidentifierheartratevariabilitysdnn'],
  rhr:['restingheartrate','restinghr','hkquantitytypeidentifierrestingheartrate'],
  respiratory:['respiratoryrate','hkquantitytypeidentifierrespiratoryrate'],
  temp:['wristtemperature','wristtemp','applewalkingsteadinesstemperature'],
  sleep:['sleephours','sleepduration','totalsleep','timeasleep','asleepduration'],
  steps:['stepcount','steps','hkquantitytypeidentifierstepcount']
};
function kindFor(s){
  const x=clean(s);
  for(const [kind,terms] of Object.entries(TERMS))if(terms.some(t=>x.includes(t)))return kind;
  return null;
}
function convert(kind,value,unit=''){
  let v=Number(value); const u=clean(unit);
  if(!Number.isFinite(v))return null;
  if(kind==='sleep'){
    if(u.includes('hour'))return v;
    if(u.includes('minute')||u==='min')return v/60;
    if(u.includes('second')||u==='s'||u==='sec')return v/3600;
    if(v>1000)return v/3600;
    if(v>24)return v/60;
  }
  if(kind==='hrv'&&(u==='s'||u.includes('second'))&&v<10)return v*1000;
  return v;
}
function extractMetrics(root,receivedAt){
  const found={hrv:[],rhr:[],respiratory:[],temp:[],sleep:[],steps:[]},sleepIntervals=[];
  const valueKeys=new Set(['value','quantity','average','avg','mean','latest','mostrecent','most_recent','total','duration','hours','minutes']);
  const descriptorKeys=/^(name|type|identifier|datatype|data_type|metric|metricname|metric_name|displayname|display_name|quantitytype|quantity_type|category)$/i;
  const unitKeys=/^(unit|units)$/i;
  const dateOf=(o,keys)=>{for(const k of keys){if(typeof o?.[k]==='string'&&timeValue(o[k]))return o[k];}return null};
  function add(kind,value,date,unit){const v=convert(kind,value,unit);if(v==null)return;found[kind].push({value:v,date:date||receivedAt||new Date().toISOString()});}
  function walk(v,path='',ctx='',inheritedDate=receivedAt){
    if(v==null)return;if(Array.isArray(v)){v.forEach((x,i)=>walk(x,path+'['+i+']',ctx,inheritedDate));return;}if(typeof v!=='object')return;
    const entries=Object.entries(v),desc=entries.filter(([k,x])=>descriptorKeys.test(k)&&typeof x==='string').map(([,x])=>x).join(' '),localCtx=(ctx+' '+path+' '+desc).trim(),kind=kindFor(localCtx),localDate=isoFromObject(v,inheritedDate),unit=entries.find(([k,x])=>unitKeys.test(k)&&typeof x==='string')?.[1]||'';
    if(kind==='sleep'){
      const st=dateOf(v,['startDate','start_date','start','from']),en=dateOf(v,['endDate','end_date','end','to']);
      const status=clean(desc+' '+(v.value??'')+' '+(v.categoryValue??''));
      if(st&&en&&timeValue(en)>timeValue(st)&&!status.includes('inbed')&&!status.includes('awake'))sleepIntervals.push({start:st,end:en});
    }
    for(const [k,x] of entries){const n=num(x);if(n==null)continue;const direct=kindFor(k),inherited=kindFor(localCtx),nk=clean(k);if(direct)add(direct,n,localDate,unit);else if(inherited&&(valueKeys.has(nk)||nk.endsWith('value')||nk.endsWith('average')||nk.endsWith('duration')))add(inherited,n,localDate,unit);}
    for(const [k,x] of entries)if(x&&typeof x==='object')walk(x,path?path+'.'+k:k,localCtx,localDate);
  }
  walk(root);
  const out={},dates={},series={};
  const dayKey=d=>{const t=new Date(d);return Number.isFinite(t.getTime())?t.toISOString().slice(0,10):null};
  const median=a=>{const x=a.slice().sort((a,b)=>a-b),n=x.length;return n?n%2?x[(n-1)/2]:(x[n/2-1]+x[n/2])/2:null};
  const inSleep=date=>{const t=timeValue(date);return sleepIntervals.some(x=>t>=timeValue(x.start)&&t<=timeValue(x.end));};
  for(const [kind,arr0] of Object.entries(found)){
    if(!arr0.length)continue;
    let arr=arr0.filter(x=>Number.isFinite(x.value)).sort((a,b)=>timeValue(a.date)-timeValue(b.date));
    if(kind==='hrv'&&sleepIntervals.length){const asleep=arr.filter(x=>inSleep(x.date));if(asleep.length)arr=asleep;}
    const byDay={};for(const x of arr){let d=dayKey(x.date);if(!d)continue;if(kind==='hrv'&&inSleep(x.date)){const dt=new Date(x.date);if(dt.getUTCHours()<12)d=new Date(dt.getTime()-86400000).toISOString().slice(0,10);} (byDay[d]||(byDay[d]=[])).push(x);}
    series[kind]=Object.entries(byDay).map(([date,xs])=>{const values=xs.map(x=>x.value),last=xs.at(-1);let value;if(kind==='steps')value=values.reduce((a,b)=>a+b,0);else if(kind==='sleep')value=values.length>1?values.reduce((a,b)=>a+b,0):values[0];else value=median(values);return {date,value:Math.round(value*100)/100,samples:values.length,lastAt:last.date,source:kind==='hrv'&&sleepIntervals.length?'sleep-window':'daily'};}).sort((a,b)=>a.date.localeCompare(b.date));
    const latest=series[kind].at(-1);if(latest){out[kind]=latest.value;dates[kind]=latest.lastAt||latest.date;}
  }
  return {metrics:out,metricDates:dates,series,sleepIntervals:sleepIntervals.slice(-20)};
}
async function readJson(path){
  const result=await get(path,{...blobOpts(),access:'private',useCache:false});
  if(!result)return null;
  return new Response(result.stream).json();
}
async function writeJson(path,value){
  return put(path,JSON.stringify(value),{...blobOpts(),access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
}
function mergeSummary(previous,incoming,receivedAt){
  const out=previous&&typeof previous==='object'?previous:{metrics:{},metricDates:{},series:{}};
  out.metrics={...(out.metrics||{})}; out.metricDates={...(out.metricDates||{})}; out.series={...(out.series||{})};
  for(const [k,v] of Object.entries(incoming.metrics||{})){
    const newDate=incoming.metricDates?.[k]||receivedAt;
    const oldDate=out.metricDates?.[k];
    if(!oldDate||timeValue(newDate)>=timeValue(oldDate)){out.metrics[k]=v;out.metricDates[k]=newDate;}
  }
  for(const [k,rows] of Object.entries(incoming.series||{})){const map=new Map((out.series[k]||[]).map(x=>[x.date,x]));for(const row of rows)map.set(row.date,row);out.series[k]=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90);}
  out.lastReceivedAt=receivedAt;
  out.updatedAt=new Date().toISOString();
  return out;
}
async function rebuildSummaryFromInbox(){
  const listed=await list({...blobOpts(),prefix:BATCH_PREFIX,limit:1000});
  const blobs=(listed.blobs||[]).slice().sort((a,b)=>String(a.pathname).localeCompare(String(b.pathname)));
  let summary=null;
  const schemas=new Set();
  const collectSchema=(v,path='',depth=0)=>{
    if(v==null||depth>6||schemas.size>=120)return;
    if(Array.isArray(v)){if(v.length)collectSchema(v[0],path+'[]',depth+1);return;}
    if(typeof v!=='object')return;
    for(const [k,x] of Object.entries(v)){
      const p=path?path+'.'+k:k; schemas.add(p);
      if(x&&typeof x==='object')collectSchema(x,p,depth+1);
    }
  };
  for(const blob of blobs){
    try{
      const env=await readJson(blob.pathname);
      if(!env)continue;
      const receivedAt=env.receivedAt||blob.uploadedAt||new Date().toISOString();
      const raw=env.payload??env;
      collectSchema(raw);
      const extracted=extractMetrics(raw,receivedAt);
      summary=mergeSummary(summary,extracted,receivedAt);
    }catch{}
  }
  return {summary,batchCount:blobs.length,schemaPaths:[...schemas]};
}


export default async function handler(req,res){
  headers(res);
  if(req.method==='OPTIONS')return res.status(204).end();
  try{
    if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('BLOB_READ_WRITE_TOKEN missing');
    if(req.method==='POST'){
      let payload=req.body;
      if(typeof payload==='string'){try{payload=payload.trim()?JSON.parse(payload):{};}catch{payload={raw:payload};}}
      if(payload==null)payload={};
      const receivedAt=new Date().toISOString();
      const envelope={receivedAt,payload};
      const batchPath=BATCH_PREFIX+Date.now()+'-'+Math.random().toString(36).slice(2,10)+'.json';
      await writeJson(batchPath,envelope);
      const incoming=extractMetrics(payload,receivedAt);
      let previous=null; try{previous=await readJson(SUMMARY_PATH);}catch{}
      const summary=mergeSummary(previous,incoming,receivedAt);
      await writeJson(SUMMARY_PATH,summary);
      return res.status(200).json({ok:true,accepted:true,stored:true,receivedAt,recognized:Object.keys(incoming.metrics),batch:batchPath});
    }
    if(req.method==='GET'){
      let rebuilt={summary:null,batchCount:0,schemaPaths:[]};
      try{rebuilt=await rebuildSummaryFromInbox();}catch{}
      let summary=rebuilt.summary;
      if(!summary){
        let legacy=null; try{legacy=await readJson(LEGACY_PATH);}catch{}
        if(legacy){
          const receivedAt=legacy.receivedAt||new Date().toISOString();
          const extracted=extractMetrics(legacy.payload??legacy,receivedAt);
          summary=mergeSummary(null,extracted,receivedAt);
        }
      }
      if(summary&&Object.keys(summary.metrics||{}).length)await writeJson(SUMMARY_PATH,summary);
      if(req.query?.diag==='1'){
        return res.status(200).json({
          ok:true,service:'smartcoach-health',storage:'private-blob',tokenConfigured:true,
          batchCount:rebuilt.batchCount,summaryExists:!!summary,
          recognized:Object.keys(summary?.metrics||{}),lastReceivedAt:summary?.lastReceivedAt||null,
          schemaPaths:rebuilt.schemaPaths.slice(0,120)
        });
      }
      if(!summary||!Object.keys(summary.metrics||{}).length)return res.status(404).json({ok:false,error:'health_metrics_not_recognized',batchCount:rebuilt.batchCount});
      return res.status(200).json({ok:true,service:'smartcoach-health',metrics:summary.metrics||{},metricDates:summary.metricDates||{},series:summary.series||{},receivedAt:summary.lastReceivedAt||summary.updatedAt||null});
    }
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }catch(e){
    console.error('health api error',e);
    return res.status(500).json({ok:false,accepted:false,stored:false,error:String(e?.message||e)});
  }
}