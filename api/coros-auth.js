import { beginCorosAuth } from './coros-mcp.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const x=await beginCorosAuth(req);
    return res.redirect(302,x.url);
  }catch(e){
    console.error('coros auth error',e);
    return res.status(500).json({ok:false,error:String(e?.message||e)});
  }
}
