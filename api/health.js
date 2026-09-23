const PATH='smartcoach/health/latest.json';

function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,X-API-Key');
  res.setHeader('Cache-Control','no-store');
}
function authToken(req){
  const a=req.headers.authorization||'';
  return a.startsWith('Bearer ')?a.slice(7):(req.headers['x-api-key']||'');
}
function authorized(req){
  const expected=process.env.HEALTH_SYNC_TOKEN;
  return !expected || authToken(req)===expected;
}
function blobToken(){
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN || '';
}
async function blobRequest(path, init={}){
  const t=blobToken();
  if(!t) throw new Error('BLOB_TOKEN_MISSING');
  return fetch('https://blob.vercel-storage.com'+path,{
    ...init,
    headers:{authorization:'Bearer '+t,...(init.headers||{})}
  });
}
export default async function handler(req,res){
  cors(res);
  if(req.method==='OPTIONS') return res.status(204).end();
  if(!authorized(req)) return res.status(401).json({ok:false,error:'unauthorized'});
  try{
    if(req.method==='POST'){
      let payload=req.body;
      if(typeof payload==='string'){try{payload=payload.trim()?JSON.parse(payload):{};}catch{payload={raw:payload};}}
      if(payload==null) payload={};
      const envelope={receivedAt:new Date().toISOString(),payload};
      const r=await blobRequest('/'+encodeURIComponent(PATH),{
        method:'PUT',
        headers:{'content-type':'application/json','x-api-version':'7','x-content-type':'application/json','x-add-random-suffix':'0','x-allow-overwrite':'1'},
        body:JSON.stringify(envelope)
      });
      const txt=await r.text();
      if(!r.ok) return res.status(500).json({ok:false,error:'blob_write_'+r.status,detail:txt.slice(0,500)});
      return res.status(200).json({ok:true,receivedAt:envelope.receivedAt});
    }
    if(req.method==='GET'){
      return res.status(200).json({ok:true,service:'smartcoach-health',ready:true});
    }
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }catch(e){
    return res.status(500).json({ok:false,error:String(e?.message||e)});
  }
}