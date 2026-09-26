import { get, put } from '@vercel/blob';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const OAUTH_PATH='smartcoach/coros/oauth.json';
export const SNAPSHOT_PATH='smartcoach/coros/latest.json';
export const MCP_URL=new URL('https://mcp.coros.com/mcp');

export function trustedCorosMcpUrl(raw){
  try{
    const u=raw instanceof URL?new URL(raw):new URL(String(raw||''));
    const host=u.hostname.toLowerCase();
    const allowedHost=host==='mcp.coros.com'||/^mcp[a-z0-9-]*\.coros\.com$/.test(host);
    if(u.protocol!=='https:'||!allowedHost||u.pathname!=='/mcp')return null;
    u.search='';u.hash='';
    return u;
  }catch{return null}
}
export function protectedResourceFromError(error){
  const msg=String(error?.message||error||'');
  const m=msg.match(/Protected resource\s+(https:\/\/[^\s)]+)\s+does not match expected/i);
  return m?trustedCorosMcpUrl(m[1]):null;
}
export function mcpUrlFor(provider){
  return trustedCorosMcpUrl(provider?.store?.mcpUrl)||MCP_URL;
}
async function rememberMcpUrl(provider,url){
  const safe=trustedCorosMcpUrl(url);if(!safe)return false;
  provider.store.mcpUrl=String(safe);
  provider.store.discoveryState=null;
  provider.store.state=null;
  provider.store.codeVerifier=null;
  provider.authUrl=null;
  await saveOAuth(provider.store);
  return true;
}

const blobOpts=()=>({token:process.env.BLOB_READ_WRITE_TOKEN});
export async function readBlobJson(path){
  const r=await get(path,{...blobOpts(),access:'private',useCache:false});if(!r)return null;
  return new Response(r.stream).json();
}
export async function writeBlobJson(path,value){
  return put(path,JSON.stringify(value),{...blobOpts(),access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
}
export function requestOrigin(req){
  const proto=(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();
  return proto+'://'+host;
}
export async function loadOAuth(){try{return await readBlobJson(OAUTH_PATH)||{}}catch{return {}}}
export async function saveOAuth(v){await writeBlobJson(OAUTH_PATH,v)}

export class BlobOAuthProvider{
  constructor(store,redirectUrl){
    this.store=store||{};this.redirectUrl=redirectUrl;this.authUrl=null;
    this.clientMetadata={
      client_name:'SmartCoach',
      redirect_uris:[String(redirectUrl)],
      token_endpoint_auth_method:'none',
      grant_types:['authorization_code','refresh_token'],
      response_types:['code']
    };
  }
  clientInformation(ctx){
    if(ctx?.issuer)return this.store.clients?.[ctx.issuer];
    return this.store.clientInformation;
  }
  async saveClientInformation(info,ctx){
    if(ctx?.issuer){
      this.store.clients={...(this.store.clients||{}),[ctx.issuer]:info};
    }else this.store.clientInformation=info;
    await saveOAuth(this.store);
  }
  tokens(){return this.store.tokens}
  async saveTokens(tokens){this.store.tokens=tokens;this.store.tokenSavedAt=new Date().toISOString();await saveOAuth(this.store)}
  async state(){
    const s=crypto.randomUUID();this.store.state=s;await saveOAuth(this.store);return s;
  }
  async saveDiscoveryState(v){this.store.discoveryState=v;await saveOAuth(this.store)}
  discoveryState(){return this.store.discoveryState}
  async redirectToAuthorization(url){this.authUrl=String(url);this.store.lastAuthorizationUrl=this.authUrl;await saveOAuth(this.store)}
  async saveCodeVerifier(v){this.store.codeVerifier=v;await saveOAuth(this.store)}
  codeVerifier(){if(!this.store.codeVerifier)throw new Error('COROS OAuth verifier missing');return this.store.codeVerifier}
}
export async function makeProvider(req){
  const store=await loadOAuth();
  return new BlobOAuthProvider(store,requestOrigin(req)+'/api/coros-callback');
}
async function connectAt(provider,url){
  const endpoint=trustedCorosMcpUrl(url)||MCP_URL;
  const client=new Client({name:'SmartCoach',version:'3.0.0'},{capabilities:{}});
  const transport=new StreamableHTTPClientTransport(endpoint,{authProvider:provider});
  await client.connect(transport);
  return {client,transport,endpoint};
}
export async function connectClient(provider){
  const endpoint=mcpUrlFor(provider);
  try{
    return await connectAt(provider,endpoint);
  }catch(error){
    const regional=protectedResourceFromError(error);
    if(regional&&String(regional)!==String(endpoint)){
      await rememberMcpUrl(provider,regional);
      return connectAt(provider,regional);
    }
    throw error;
  }
}
export function resultText(r){
  if(!r)return '';
  if(typeof r==='string')return r;
  if(Array.isArray(r.content))return r.content.filter(x=>x?.type==='text').map(x=>x.text||'').join('\n');
  if(r.text)return String(r.text);
  return JSON.stringify(r);
}
export async function call(client,name,args={}){
  const r=await client.callTool({name,arguments:args});return resultText(r);
}
export function parseDurationMinutes(s){
  if(!s)return null;const x=String(s).trim();
  let m=x.match(/^(\d+):(\d{2}):(\d{2})$/);if(m)return +m[1]*60+(+m[2])+(+m[3]/60);
  m=x.match(/^(\d+):(\d{2})$/);if(m)return +m[1]+(+m[2]/60);
  return null;
}
function val(text,re){const m=String(text||'').match(re);return m?m[1].trim():null}
export function parseFitness(text){
  return {
    vo2max:Number(val(text,/VO2max:\s*([\d.]+)/i))||null,
    runningLevel:Number(val(text,/Running Level:\s*([\d.]+)/i))||null,
    thresholdPace:val(text,/Threshold Pace:\s*([^\n]+)/i),
    racePredictions:{
      k5:val(text,/5 km Prediction:\s*([^\n]+)/i),
      k10:val(text,/10 km Prediction:\s*([^\n]+)/i),
      half:val(text,/Half Marathon Prediction:\s*([^\n]+)/i),
      marathon:val(text,/Marathon Prediction:\s*([^\n]+)/i)
    }
  };
}
export function parseRecovery(text){
  return {
    value:Number(val(text,/Recovery:\s*(\d+)%/i))||null,
    text:val(text,/Level:\s*([^\n]+)/i),
    fullRecovery:val(text,/Estimated Full Recovery:\s*([^\n]+)/i)
  };
}
export function parseLoad(text){
  const blocks=String(text||'').split(/\n(?=20\d{2}-\d{2}-\d{2}\n)/).filter(x=>/^20\d{2}-/.test(x.trim()));
  return blocks.map(b=>({
    date:val(b,/^(20\d{2}-\d{2}-\d{2})/m),
    comment:val(b,/Comment:\s*([^\n]+)/i),
    short:Number(val(b,/Short-Term Load:\s*([\d.]+)/i))||0,
    long:Number(val(b,/Long-Term Load:\s*([\d.]+)/i))||0,
    ratio:Number(val(b,/Load Ratio:\s*([\d.]+)/i))||0
  })).filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date));
}
function hmMinutes(s){if(!s)return null;const h=Number((s.match(/(\d+)h/)||[])[1]||0),m=Number((s.match(/(\d+)min/)||[])[1]||0);return h*60+m}
export function parseDailyHealth(text){
  const baseline={
    restingHr:Number(val(text,/Resting HR:\s*(\d+) bpm/i))||null,
    hrvBaseline:Number(val(text,/HRV Baseline:\s*(\d+) ms/i))||null
  };
  const blocks=String(text||'').split(/\n(?=--- \d{8} ---)/).filter(x=>/^--- \d{8} ---/m.test(x));
  const rows=blocks.map(b=>{
    const d=val(b,/--- (\d{4})(\d{2})(\d{2}) ---/);
    const dm=b.match(/--- (\d{4})(\d{2})(\d{2}) ---/);if(!dm)return null;
    return {
      date:`${dm[1]}-${dm[2]}-${dm[3]}`,
      steps:Number(val(b,/Steps:\s*([\d,]+)/i)?.replace(/,/g,''))||0,
      calories:Number(val(b,/Calories:\s*([\d,]+) kcal/i)?.replace(/,/g,''))||0,
      exerciseMinutes:hmMinutes(val(b,/Exercise:\s*([^\n]+)/i))||0,
      stressAvg:Number(val(b,/Stress:\s*Avg\s*([\d.]+)/i))||null,
      sleepPeriodMinutes:hmMinutes(val(b,/Sleep Summary:[\s\S]*?Total:\s*([^|\n]+)/i)),
      sleepDeepMinutes:hmMinutes(val(b,/Deep:\s*([^|\n]+)/i)),
      sleepLightMinutes:hmMinutes(val(b,/Light:\s*([^|\n]+)/i)),
      sleepRemMinutes:hmMinutes(val(b,/REM:\s*([^|\n]+)/i)),
      sleepAwakeMinutes:hmMinutes(val(b,/Awake:\s*([^\n]+)/i)),
      sleepHrAvg:Number(val(b,/Sleep HR:\s*Avg\s*(\d+) bpm/i))||null,
      sleepHrMin:Number(val(b,/Min\s*(\d+) bpm/i))||null,
      sleepHrMax:Number(val(b,/Max\s*(\d+) bpm/i))||null,
      source:'COROS'
    };
  }).filter(Boolean);
  return {baseline,rows};
}
export function parseSleep(text){
  const blocks=String(text||'').split(/\n(?=20\d{2}-\d{2}-\d{2}\n)/).filter(x=>/^20\d{2}-/.test(x.trim()));
  return blocks.map(b=>{
    const date=val(b,/^(20\d{2}-\d{2}-\d{2})/m);if(!date)return null;
    return {
      date,score:Number(val(b,/Sleep Score:\s*(-?\d+)/i)),
      dailySleepMinutes:hmMinutes(val(b,/Daily Sleep:\s*([^\n(]+)/i)),
      mainSleepMinutes:hmMinutes(val(b,/Main Sleep \(asleep\):\s*([^\n]+)/i)),
      mainSleepPeriodMinutes:hmMinutes(val(b,/Main Sleep Period \(incl\. awake\):\s*([^\n]+)/i)),
      deepRatio:Number(val(b,/Deep Sleep Ratio:\s*(\d+)%/i))||null,
      lightRatio:Number(val(b,/Light Sleep Ratio:\s*(\d+)%/i))||null,
      remRatio:Number(val(b,/REM Ratio:\s*(\d+)%/i))||null,
      awakeRatio:Number(val(b,/Awake Ratio:\s*(\d+)%/i))||null,
      awakeMinutes:hmMinutes(val(b,/Awake Time:\s*([^\n]+)/i)),
      mainWindow:val(b,/Main Sleep Window:\s*([^\n]+)/i),
      napMinutes:hmMinutes(val(b,/Naps Total(?: \(asleep\))?:\s*([^\n]+)/i))||0,
      napWindow:val(b,/Nap Window:\s*([^\n]+)/i),
      source:'COROS'
    };
  }).filter(Boolean);
}
function sportTypeNameToKind(name){
  const x=String(name||'').toLowerCase();
  if(x.includes('run'))return 'run';if(x.includes('strength'))return 'strength';
  if(x.includes('bike')||x.includes('cycling'))return 'bike';
  if(x.includes('walk')||x.includes('hike'))return 'walk';
  if(x.includes('padel')||x.includes('tennis')||x.includes('soccer')||x.includes('basket'))return 'sport';
  if(x.includes('cardio'))return 'cardio';return 'other';
}
export function parseActivities(text){
  const blocks=String(text||'').split(/\n(?=\d+\. )/).filter(x=>/^\d+\. /m.test(x.trim()));
  return blocks.map(b=>{
    const head=b.match(/^\d+\. (.+?) — (\d{4}-\d{2}-\d{2})/m);if(!head)return null;
    const distance=Number(val(b,/Distance:\s*([\d.]+) km/i))||null;
    const sets=Number(val(b,/Sets:\s*(\d+)/i))||null;
    const dur=val(b,/Duration:\s*([^|\n]+)/i);
    return {
      corosId:val(b,/LabelId:\s*(\d+)/i),date:head[2],sport:head[1].trim(),kind:sportTypeNameToKind(head[1]),
      sportType:Number(val(b,/SportType:\s*(\d+)/i))||null,location:val(b,/Location:\s*([^\n]+)/i),
      durationMinutes:parseDurationMinutes(dur),minutes:parseDurationMinutes(dur),distanceKm:distance,sets,
      pace:val(b,/Average Pace:\s*([^|\n]+)/i),speed:val(b,/Average Speed:\s*([^|\n]+)/i),
      avgHr:Number(val(b,/Avg HR:\s*(\d+) bpm/i))||null,calories:Number(val(b,/Calories:\s*([\d,]+) kcal/i)?.replace(/,/g,''))||null,
      source:'COROS'
    };
  }).filter(x=>x?.corosId);
}
export function parseActivityDetail(text){
  return {
    trainingLoad:Number(val(text,/Training Load:\s*([\d.]+)/i))||null,
    aerobicTE:Number(val(text,/Aerobic TE:\s*([\d.]+)/i))||null,
    anaerobicTE:Number(val(text,/Anaerobic TE:\s*([\d.]+)/i))||null,
    focus:val(text,/Training Focus:\s*([^\n]+)/i),
    performance:val(text,/Performance:\s*([^\n]+)/i),
    avgPower:Number(val(text,/Average Power:\s*([\d.]+) W/i))||null,
    avgCadence:Number(val(text,/Average Cadence:\s*([\d.]+)/i))||null
  };
}

export function parseSleepHrv(text){
  const section=String(text||'').split(/Sleep HRV Time Series/i)[0],rows=[];
  const re=/(20\d{2}-\d{2}-\d{2}):\s*\n\s*HRV Avg:\s*(\d+(?:\.\d+)?) ms\s*(?:—|-)?\s*([^\n]*)\n\s*Normal Range:\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?) ms\s*\n\s*Baseline:\s*(\d+(?:\.\d+)?) ms/gi;
  let m;while((m=re.exec(section)))rows.push({date:m[1],avg:+m[2],evaluation:(m[3]||'').trim(),normalLow:+m[4],normalHigh:+m[5],baseline:+m[6],source:'COROS Sleep HRV'});
  return rows;
}
export function parseRestingHeartRate(text){
  const rows=[],re=/(20\d{2}-\d{2}-\d{2}):\s*(\d+) bpm/gi;let m;
  while((m=re.exec(String(text||''))))rows.push({date:m[1],value:+m[2],source:'COROS'});
  return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
