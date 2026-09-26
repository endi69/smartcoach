import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { makeProvider, MCP_URL, saveOAuth } from '../lib/coros-mcp.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  try{
    const provider=await makeProvider(req);
    const origin=(req.headers['x-forwarded-proto']||'https').split(',')[0].trim()+'://'+(req.headers['x-forwarded-host']||req.headers.host);
    const params=new URL(req.url,origin).searchParams;
    if(!params.get('code'))throw new Error('Authorization code missing');
    if(provider.store.state&&params.get('state')!==provider.store.state)throw new Error('OAuth state mismatch');
    const transport=new StreamableHTTPClientTransport(MCP_URL,{authProvider:provider});
    await transport.finishAuth(params);
    provider.store.state=null;await saveOAuth(provider.store);
    const client=new Client({name:'SmartCoach',version:'3.0.0'},{capabilities:{}});
    await client.connect(new StreamableHTTPClientTransport(MCP_URL,{authProvider:provider}));
    try{await client.close()}catch{}
    return res.redirect(302,'/?coros=connected');
  }catch(e){
    console.error('COROS callback error',e);
    return res.status(500).send('COROS authorization failed: '+String(e?.message||e));
  }
}