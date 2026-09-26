import { makeProvider, connectClient } from '../lib/coros-mcp.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  try{
    // Every explicit "Connetti COROS" starts a completely fresh OAuth/PKCE flow.
    // Keep only the regional MCP endpoint COROS previously selected for this account.
    const provider=await makeProvider(req,{fresh:true});
    try{
      const {client}=await connectClient(provider);
      try{await client.close()}catch{}
      return res.redirect(302,'/?coros=connected');
    }catch(e){
      if(provider.authUrl)return res.redirect(302,provider.authUrl);
      throw e;
    }
  }catch(e){
    console.error('COROS connect error',e);
    return res.status(500).send('COROS connection failed: '+String(e?.message||e));
  }
}