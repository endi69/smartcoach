import { put, get } from '@vercel/blob';

const PATH='smartcoach/health/latest.json';

function headers(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,X-API-Key');
  res.setHeader('Cache-Control','no-store');
}
function blobOpts(){ return {token:process.env.BLOB_READ_WRITE_TOKEN}; }

export default async function handler(req,res){
  headers(res);
  if(req.method==='OPTIONS') return res.status(204).end();
  try{
    if(req.method==='POST'){
      let payload=req.body;
      if(typeof payload==='string'){
        try{ payload=payload.trim()?JSON.parse(payload):{}; }
        catch{ payload={raw:payload}; }
      }
      if(payload==null) payload={};
      const envelope={receivedAt:new Date().toISOString(),payload};
      const saved=await put(PATH,JSON.stringify(envelope),{
        ...blobOpts(), access:'private', addRandomSuffix:false, allowOverwrite:true,
        contentType:'application/json'
      });
      return res.status(200).json({ok:true,accepted:true,stored:true,receivedAt:envelope.receivedAt,pathname:saved.pathname});
    }
    if(req.method==='GET'){
      const result=await get(PATH,{...blobOpts(),access:'private',useCache:false});
      if(!result) return res.status(200).json({ok:true,service:'smartcoach-health',ready:true,data:null});
      const payload=await new Response(result.stream).json();
      return res.status(200).json(payload);
    }
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }catch(e){
    return res.status(200).json({ok:true,accepted:req.method==='POST',stored:false,storageError:String(e?.message||e)});
  }
}