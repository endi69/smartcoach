import { put, get } from '@vercel/blob';

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
  sleep:['sleephours','sleepduration','totalsleep','timeasleep','asleepduration']
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
  const found={hrv:[],rhr:[],respiratory:[],temp:[],sleep:[]};
  const valueKeys=new Set(['value','quantity','average','avg','mean','latest','mostrecent','most_recent','total','duration','hours','minutes']);
  const descriptorKeys=/^(name|type|identifier|datatype|data_type|metric|metricname|metric_name|displayname|display_name|quantitytype|quantity_type|category)$/i;
  const unitKeys=/^(unit|units)$/i;
  function add(kind,value,date,unit){
    const v=convert(kind,value,unit); if(v==null)return;
    found[kind].push({value:v,date:date||receivedAt||new Date().toISOString()});
  }
  function walk(v,path='',ctx='',inheritedDate=receivedAt){
    if(v==null)return;
    if(Array.isArray(v)){v.forEach((x,i)=>walk(x,path+'['+i+']',ctx,inheritedDate));return;}
    if(typeof v!=='object')return;
    const entries=Object.entries(v);
    const desc=entries.filter(([k,x])=>descriptorKeys.test(k)&&typeof x==='string').map(([,x])=>x).join(' ');
    const localCtx=(ctx+' '+path+' '+desc).trim();
    const localDate=isoFromObject(v,inheritedDate);
    const unit=entries.find(([k,x])=>unitKeys.test(k)&&typeof x==='string')?.[1]||'';
    for(const [k,x] of entries){
      const n=num(x); if(n==null)continue;
      const direct=kindFor(path+' '+k);
      const inherited=kindFor(localCtx);
      const nk=clean(k);
      if(direct)add(direct,n,localDate,unit);
      else if(inherited&&(valueKeys.has(nk)||nk.endsWith('value')||nk.endsWith('average')||nk.endsWith('duration')))add(inherited,n,localDate,unit);
    }
    for(const [k,x] of entries)if(x&&typeof x==='object')walk(x,path?path+'.'+k:k,localCtx,localDate);
  }
  walk(root);
  const out={}; const dates={};
  for(const [kind,arr] of Object.entries(found)){
    if(!arr.length)continue;
    arr.sort((a,b)=>timeValue(b.date)-timeValue(a.date));
    out[kind]=Math.round(arr[0].value*100)/100; dates[kind]=arr[0].date;
  }
  return {metrics:out,metricDates:dates};
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
  const out=previous&&typeof previous==='object'?previous:{metrics:{},metricDates:{}};
  out.metrics={...(out.metrics||{})}; out.metricDates={...(out.metricDates||{})};
  for(const [k,v] of Object.entries(incoming.metrics||{})){
    const newDate=incoming.metricDates?.[k]||receivedAt;
    const oldDate=out.metricDates?.[k];
    if(!oldDate||timeValue(newDate)>=timeValue(oldDate)){out.metrics[k]=v;out.metricDates[k]=newDate;}
  }
  out.lastReceivedAt=receivedAt;
  out.updatedAt=new Date().toISOString();
  return out;
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
      let summary=null; try{summary=await readJson(SUMMARY_PATH);}catch{}
      if(!summary){
        let legacy=null; try{legacy=await readJson(LEGACY_PATH);}catch{}
        if(legacy){
          const receivedAt=legacy.receivedAt||new Date().toISOString();
          const extracted=extractMetrics(legacy.payload??legacy,receivedAt);
          summary=mergeSummary(null,extracted,receivedAt);
          if(Object.keys(summary.metrics).length)await writeJson(SUMMARY_PATH,summary);
        }
      }
      if(req.query?.diag==='1'){
        return res.status(200).json({ok:true,service:'smartcoach-health',storage:'private-blob',tokenConfigured:true,summaryExists:!!summary,recognized:Object.keys(summary?.metrics||{}),lastReceivedAt:summary?.lastReceivedAt||null});
      }
      if(!summary)return res.status(404).json({ok:false,error:'health_data_not_found'});
      return res.status(200).json({ok:true,service:'smartcoach-health',metrics:summary.metrics||{},metricDates:summary.metricDates||{},receivedAt:summary.lastReceivedAt||summary.updatedAt||null});
    }
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }catch(e){
    console.error('health api error',e);
    return res.status(500).json({ok:false,accepted:false,stored:false,error:String(e?.message||e)});
  }
}