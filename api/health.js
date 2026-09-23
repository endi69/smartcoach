import { put, list } from '@vercel/blob';

const PATH='smartcoach/health/latest.json';

function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,X-API-Key');
  res.setHeader('Cache-Control','no-store');
}
function token(req){
  const auth=req.headers.authorization||'';
  return auth.startsWith('Bearer ')?auth.slice(7):(req.headers['x-api-key']||'');
}
function authorized(req){
  const expected=process.env.HEALTH_SYNC_TOKEN;
  return !expected || token(req)===expected;
}
export default async function handler(req,res){
  cors(res);
  if(req.method==='OPTIONS') return res.status(204).end();
  if(!authorized(req)) return res.status(401).json({ok:false,error:'unauthorized'});
  try{
    if(req.method==='POST'){
      const isTest = req.headers['x-health-exporter-test']==='true' || req.query?.test==='1' || req.body==null || req.body==='';
      if(isTest) return res.status(200).json({ok:true,test:true});
      let payload=req.body;
      if(typeof payload==='string'){try{payload=payload.trim()?JSON.parse(payload):{};}catch{payload={raw:payload};}}
      if(payload==null) payload={};
      const envelope={receivedAt:new Date().toISOString(),payload};
      await put(PATH,JSON.stringify(envelope),{access:'private',addRandomSuffix:false,allowOverwrite:true,token:process.env.BLOB_READ_WRITE_TOKEN});
      return res.status(200).json({ok:true,receivedAt:envelope.receivedAt});
    }
    if(req.method==='GET'){
      const found=await list({prefix:PATH,limit:1,token:process.env.BLOB_READ_WRITE_TOKEN});
      const blob=found.blobs?.find(b=>b.pathname===PATH)||found.blobs?.[0];
      if(!blob) return res.status(404).json({ok:false,error:'no_health_data'});
      const rr=await fetch(blob.downloadUrl||blob.url,{headers:{Authorization:`Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`},cache:'no-store'});
      if(!rr.ok) throw new Error('blob_read_'+rr.status);
      return res.status(200).json(await rr.json());
    }
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }catch(e){
    return res.status(500).json({ok:false,error:String(e?.message||e)});
  }
}