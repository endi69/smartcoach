import { put, get } from '@vercel/blob';

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
      const payload=typeof req.body==='string'?JSON.parse(req.body):req.body;
      const envelope={receivedAt:new Date().toISOString(),payload};
      await put(PATH,JSON.stringify(envelope),{access:'private',addRandomSuffix:false,allowOverwrite:true,token:process.env.BLOB_READ_WRITE_TOKEN});
      return res.status(200).json({ok:true,receivedAt:envelope.receivedAt});
    }
    if(req.method==='GET'){
      const result=await get(PATH,{access:'private',useCache:false,token:process.env.BLOB_READ_WRITE_TOKEN});
      if(!result) return res.status(404).json({ok:false,error:'no_health_data'});
      const body=await new Response(result.stream).json();
      return res.status(200).json(body);
    }
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }catch(e){
    return res.status(500).json({ok:false,error:String(e?.message||e)});
  }
}