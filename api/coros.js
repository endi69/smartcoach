import { put, get } from '@vercel/blob';

const PATH='smartcoach/coros/latest.json';
function headers(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,X-API-Key');
  res.setHeader('Cache-Control','no-store');
}
const opts=()=>({token:process.env.BLOB_READ_WRITE_TOKEN});
async function readJson(){
  const r=await get(PATH,{...opts(),access:'private',useCache:false});
  if(!r)return null; return new Response(r.stream).json();
}
async function writeJson(v){
  return put(PATH,JSON.stringify(v),{...opts(),access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
}
function validSnapshot(x){
  return x&&typeof x==='object'&&(x.fitness||x.activities||x.loadHistory||x.recovery||x.hrZones);
}
function merge(prev,next){
  const p=prev||{}, n=next||{};
  const byId=new Map((p.activities||[]).map(a=>[String(a.corosId||a.labelId||''),a]));
  for(const a of (n.activities||[])){
    const id=String(a.corosId||a.labelId||'');
    if(id)byId.set(id,{...(byId.get(id)||{}),...a,corosId:id,source:'COROS'});
  }
  const loads=new Map((p.loadHistory||[]).map(x=>[x.date,x]));
  for(const x of (n.loadHistory||[]))if(x?.date)loads.set(x.date,{...(loads.get(x.date)||{}),...x});
  return {
    ...p,...n,
    fitness:{...(p.fitness||{}),...(n.fitness||{})},
    racePredictions:{...(p.racePredictions||{}),...(n.racePredictions||{})},
    hrZones:n.hrZones||p.hrZones,
    activities:[...byId.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,500),
    loadHistory:[...loads.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-365),
    syncedAt:new Date().toISOString(),source:'COROS'
  };
}
export default async function handler(req,res){
  headers(res); if(req.method==='OPTIONS')return res.status(204).end();
  try{
    if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('BLOB_READ_WRITE_TOKEN missing');
    if(req.method==='GET'){
      const data=await readJson();
      if(!data)return res.status(404).json({ok:false,error:'coros_snapshot_missing'});
      return res.status(200).json({ok:true,...data});
    }
    if(req.method==='POST'){
      const expected=process.env.SMARTCOACH_COROS_SYNC_KEY;
      const supplied=(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||req.headers['x-api-key'];
      if(expected&&supplied!==expected)return res.status(401).json({ok:false,error:'unauthorized'});
      let body=req.body; if(typeof body==='string')body=JSON.parse(body||'{}');
      if(!validSnapshot(body))return res.status(400).json({ok:false,error:'invalid_coros_snapshot'});
      let prev=null; try{prev=await readJson()}catch{}
      const merged=merge(prev,body); await writeJson(merged);
      return res.status(200).json({ok:true,syncedAt:merged.syncedAt,activities:merged.activities.length});
    }
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }catch(e){return res.status(500).json({ok:false,error:String(e?.message||e)})}
}