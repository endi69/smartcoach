import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { makeProvider, mcpUrlFor, connectClient, saveOAuth } from '../lib/coros-mcp.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  try{
    const provider=await makeProvider(req);
    const origin=(req.headers['x-forwarded-proto']||'https').split(',')[0].trim()+'://'+(req.headers['x-forwarded-host']||req.headers.host);
    const params=new URL(req.url,origin).searchParams;
    if(!params.get('code'))throw new Error('Authorization code missing');
    if(provider.store.state&&params.get('state')!==provider.store.state)throw new Error('OAuth state mismatch');

    const endpoint=mcpUrlFor(provider);
    const transport=new StreamableHTTPClientTransport(endpoint,{authProvider:provider});
    await transport.finishAuth(params);

    provider.store.state=null;
    await saveOAuth(provider.store);

    const {client}=await connectClient(provider);
    try{await client.close()}catch{}
    return res.redirect(302,'/?coros=connected');
  }catch(e){
    console.error('COROS callback error',e);
    return res.status(500).send('COROS authorization failed: '+String(e?.message||e));
  }
}