import { put, get } from '@vercel/blob';
import crypto from 'node:crypto';
import { Client, StreamableHTTPClientTransport, UnauthorizedError } from '@modelcontextprotocol/client';

const OAUTH_PATH='smartcoach/coros/oauth.json';
const SNAPSHOT_PATH='smartcoach/coros/latest.json';
const MCP_URL=process.env.COROS_MCP_URL||'https://mcpeu.coros.com/mcp';

const blobOpts=()=>({token:process.env.BLOB_READ_WRITE_TOKEN});
async function readJson(path){
  try{
    const r=await get(path,{...blobOpts(),access:'private',useCache:false});
    if(!r)return null;
    return new Response(r.stream).json();
  }catch{return null}
}
async function writeJson(path,value){
  return put(path,JSON.stringify(value),{...blobOpts(),access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
}
export async function readCorosSnapshot(){return readJson(SNAPSHOT_PATH)}
export async function writeCorosSnapshot(v){return writeJson(SNAPSHOT_PATH,v)}

function baseUrl(req){
  if(process.env.PUBLIC_APP_URL)return process.env.PUBLIC_APP_URL.replace(/\/$/,'');
  const proto=(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=(req.headers['x-forwarded-host']||req.headers.host||'smartcoach-two.vercel.app').split(',')[0].trim();
  return `${proto}://${host}`;
}
function issuerKey(ctx,store){
  return ctx?.issuer||store?.lastIssuer||'default';
}
class BlobOAuthProvider{
  constructor(req,store={}){
    this.req=req;
    this.store={clients:{},tokens:{},...store};
    this.authorizationUrl=null;
    this._redirectUrl=process.env.COROS_REDIRECT_URI||baseUrl(req)+'/api/coros-callback';
  }
  get redirectUrl(){return this._redirectUrl}
  get clientMetadata(){
    return {
      client_name:'SmartCoach',
      client_uri:baseUrl(this.req),
      redirect_uris:[this._redirectUrl],
      grant_types:['authorization_code','refresh_token'],
      response_types:['code'],
      token_endpoint_auth_method:'none',
      application_type:'web'
    };
  }
  async persist(){await writeJson(OAUTH_PATH,this.store)}
  async clientInformation(ctx){return this.store.clients?.[issuerKey(ctx,this.store)]}
  async saveClientInformation(info,ctx){
    const k=issuerKey(ctx,this.store);this.store.clients={...(this.store.clients||{}),[k]:info};this.store.lastIssuer=k;await this.persist();
  }
  async tokens(ctx){
    const k=issuerKey(ctx,this.store);
    return this.store.tokens?.[k]||this.store.tokens?.[this.store.lastIssuer]||this.store.tokens?.default;
  }
  async saveTokens(tokens,ctx){
    const k=issuerKey(ctx,this.store);this.store.tokens={...(this.store.tokens||{}),[k]:tokens};this.store.lastIssuer=k;this.store.connectedAt=this.store.connectedAt||new Date().toISOString();await this.persist();
  }
  async state(){
    const s=crypto.randomUUID();this.store.oauthState=s;await this.persist();return s;
  }
  async redirectToAuthorization(url){this.authorizationUrl=String(url);this.store.lastAuthorizationUrl=this.authorizationUrl;await this.persist()}
  async saveCodeVerifier(v){this.store.codeVerifier=v;await this.persist()}
  async codeVerifier(){if(!this.store.codeVerifier)throw new Error('COROS OAuth code verifier missing');return this.store.codeVerifier}
  async saveDiscoveryState(v){this.store.discoveryState=v;await this.persist()}
  async discoveryState(){return this.store.discoveryState}
}
async function providerFor(req){return new BlobOAuthProvider(req,(await readJson(OAUTH_PATH))||{})}

export async function beginCorosAuth(req){
  const provider=await providerFor(req);
  const client=new Client({name:'SmartCoach',version:'3.0.0'},{versionNegotiation:{mode:'auto'}});
  const transport=new StreamableHTTPClientTransport(new URL(MCP_URL),{authProvider:provider});
  try{
    await client.connect(transport);
    await client.close();
    return {alreadyConnected:true,url:baseUrl(req)+'/?coros=connected'};
  }catch(e){
    try{await client.close()}catch{}
    if(e instanceof UnauthorizedError||provider.authorizationUrl){
      const url=provider.authorizationUrl||provider.store.lastAuthorizationUrl;
      if(!url)throw new Error('COROS authorization URL not returned');
      return {alreadyConnected:false,url};
    }
    throw e;
  }
}

export async function finishCorosAuth(req){
  const provider=await providerFor(req);
  const current=new URL(req.url,baseUrl(req));
  const state=current.searchParams.get('state');
  if(!state||state!==provider.store.oauthState)throw new Error('COROS OAuth state mismatch');
  const transport=new StreamableHTTPClientTransport(new URL(MCP_URL),{authProvider:provider});
  await transport.finishAuth(current.searchParams);
  const client=new Client({name:'SmartCoach',version:'3.0.0'},{versionNegotiation:{mode:'auto'}});
  const fresh=new StreamableHTTPClientTransport(new URL(MCP_URL),{authProvider:provider});
  await client.connect(fresh);
  await client.close();
  provider.store.oauthState=null;provider.store.codeVerifier=null;provider.store.lastAuthorizationUrl=null;provider.store.connectedAt=new Date().toISOString();
  await provider.persist();
  return {ok:true};
}

export async function corosConnectionStatus(req){
  const provider=await providerFor(req);
  const token=await provider.tokens();
  return {connected:!!token,connectedAt:provider.store.connectedAt||null,mcpUrl:MCP_URL};
}

function textResult(result){
  if(result?.structuredContent&&typeof result.structuredContent==='object')return {structured:result.structuredContent,text:JSON.stringify(result.structuredContent)};
  const parts=Array.isArray(result?.content)?result.content.filter(x=>x?.type==='text').map(x=>x.text):[];
  return {structured:null,text:parts.join('\n')};
}
function filterArgs(tool,args){
  const props=tool?.inputSchema?.properties;
  if(!props||typeof props!=='object')return args;
  return Object.fromEntries(Object.entries(args||{}).filter(([k])=>Object.prototype.hasOwnProperty.call(props,k)));
}
function mins(s){
  if(!s)return null;
  const p=String(s).split(':').map(Number);
  if(p.some(Number.isNaN))return null;
  return p.length===3?Math.round((p[0]*60+p[1]+p[2]/60)*100)/100:p.length===2?Math.round((p[0]+p[1]/60)*100)/100:null;
}
function km(v,u){const n=Number(v);if(!Number.isFinite(n))return null;return String(u).toLowerCase().startsWith('m')?n/1000:n}
function sportTypeClass(code,name=''){
  const c=Number(code),n=String(name).toLowerCase();
  if(c===402||n.includes('strength'))return 'strength';
  if([100,101,102,103].includes(c)||n.includes('run'))return 'run';
  if(c===200||c===201||c===203||c===204||n.includes('bike'))return 'bike';
  if(c===104||n.includes('hike'))return 'hike';
  return 'cardio';
}
function parseActivities(text){
  const lines=String(text||'').split(/\r?\n/),out=[];let a=null;
  const push=()=>{if(a?.corosId){a.type=sportTypeClass(a.sportType,a.sport);a.source='COROS';out.push(a)}};
  for(const raw of lines){
    const line=raw.trim();
    let m=line.match(/^\d+\.\s+(.+?)\s+—\s+(\d{4}-\d{2}-\d{2})$/);
    if(m){push();a={sport:m[1],date:m[2]};continue}
    if(!a)continue;
    if((m=line.match(/^Location:\s*(.+)$/)))a.location=m[1];
    else if((m=line.match(/^Duration:\s*([0-9:]+)/)))a.minutes=mins(m[1]);
    else if((m=line.match(/Distance:\s*([0-9.]+)\s*(km|m)\b/i)))a.distanceKm=Math.round(km(m[1],m[2])*100)/100;
    else if((m=line.match(/Sets:\s*(\d+)/i)))a.sets=+m[1];
    else if((m=line.match(/Average Pace:\s*([^|]+)/i)))a.avgPace=m[1].trim();
    else if((m=line.match(/Average Speed:\s*([0-9.]+)\s*km\/h/i)))a.avgSpeedKmh=+m[1];
    else if((m=line.match(/Avg HR:\s*(\d+)\s*bpm/i)))a.avgHr=+m[1];
    else if((m=line.match(/Calories:\s*(\d+)\s*kcal/i)))a.calories=+m[1];
    else if((m=line.match(/LabelId:\s*(\d+)/i)))a.corosId=m[1];
    if((m=line.match(/SportType:\s*(\d+)/i)))a.sportType=+m[1];
  }
  push();return out;
}
function parseFitness(text){
  const s=String(text||''),g=(re)=>s.match(re)?.[1]??null;
  return {
    vo2max:Number(g(/VO2max:\s*([0-9.]+)/i))||null,
    runningLevel:Number(g(/Running Level:\s*([0-9.]+)/i))||null,
    thresholdPace:g(/Threshold Pace:\s*([^\n]+)/i)?.replace(/\s+/g,' ').trim()||null,
    racePredictions:{k5:g(/5 km Prediction:\s*([^\n]+)/i),k10:g(/10 km Prediction:\s*([^\n]+)/i),half:g(/Half Marathon Prediction:\s*([^\n]+)/i),marathon:g(/Marathon Prediction:\s*([^\n]+)/i)}
  };
}
function parseRecovery(text){
  const s=String(text||''),pct=Number(s.match(/Recovery:\s*(\d+)%/i)?.[1]);
  return {value:Number.isFinite(pct)?pct:null,text:s.match(/Level:\s*([^\n]+)/i)?.[1]?.trim()||null,fullRecoveryHours:Number(s.match(/Estimated Full Recovery:\s*([0-9.]+)h/i)?.[1])||0};
}
function parseLoad(text){
  const chunks=String(text||'').split(/\n(?=\d{4}-\d{2}-\d{2}\n)/),out=[];
  for(const c of chunks){
    const d=c.match(/^(\d{4}-\d{2}-\d{2})/m)?.[1];if(!d)continue;
    out.push({date:d,comment:c.match(/Comment:\s*([^\n]+)/i)?.[1]?.trim()||null,short:Number(c.match(/Short-Term Load:\s*([0-9.]+)/i)?.[1])||0,long:Number(c.match(/Long-Term Load:\s*([0-9.]+)/i)?.[1])||0,ratio:Number(c.match(/Load Ratio:\s*([0-9.]+)/i)?.[1])||0});
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
function parseDailyHealth(text){
  const s=String(text||''),baseRhr=Number(s.match(/Resting HR:\s*(\d+)\s*bpm/i)?.[1])||null,hrvBaseline=Number(s.match(/HRV Baseline:\s*([0-9.]+)\s*ms/i)?.[1])||null;
  const chunks=s.split(/\n(?=---\s*\d{8}\s*---)/),days=[];
  for(const c of chunks){
    const y=c.match(/---\s*(\d{4})(\d{2})(\d{2})\s*---/) ;if(!y)continue;
    const row={date:`${y[1]}-${y[2]}-${y[3]}`};
    const steps=c.match(/Steps:\s*([0-9,]+)/i);if(steps)row.steps=Number(steps[1].replace(/,/g,''));
    const cal=c.match(/Calories:\s*([0-9,]+)\s*kcal/i);if(cal)row.calories=Number(cal[1].replace(/,/g,''));
    const ex=c.match(/Exercise:\s*(?:(\d+)h\s*)?(\d+)\s*min/i);if(ex)row.exerciseMinutes=(Number(ex[1])||0)*60+Number(ex[2]||0);
    const stress=c.match(/Stress:\s*Avg\s*([0-9.]+)/i);if(stress)row.stress=+stress[1];
    const total=c.match(/Total:\s*(?:(\d+)h\s*)?(\d+)min/i);if(total)row.sleepPeriodMinutes=(Number(total[1])||0)*60+Number(total[2]||0);
    const shr=c.match(/Sleep HR:\s*Avg\s*(\d+)\s*bpm\s*\|\s*Min\s*(\d+)\s*bpm\s*\|\s*Max\s*(\d+)/i);if(shr){row.sleepHrAvg=+shr[1];row.sleepHrMin=+shr[2];row.sleepHrMax=+shr[3]}
    days.push(row);
  }
  return {baseline:{restingHr:baseRhr,hrv:hrvBaseline},days};
}
function parseDurationPhrase(v){
  let n=0,m; if((m=String(v||'').match(/(\d+)h/)))n+=+m[1]*60;if((m=String(v||'').match(/(\d+)min/)))n+=+m[1];return n||null;
}
function parseSleep(text){
  const chunks=String(text||'').split(/\n(?=\d{4}-\d{2}-\d{2}\n)/),rows=[];
  for(const c of chunks){
    const date=c.match(/^(\d{4}-\d{2}-\d{2})/m)?.[1];if(!date)continue;
    const row={date,source:'COROS'};
    const sc=c.match(/Sleep Score:\s*(-?\d+)/i);if(sc)row.score=+sc[1];
    const daily=c.match(/Daily Sleep:\s*([^\n(]+)/i);if(daily)row.dailySleepMinutes=parseDurationPhrase(daily[1]);
    const main=c.match(/Main Sleep \(asleep\):\s*([^\n]+)/i);if(main)row.mainSleepMinutes=parseDurationPhrase(main[1]);
    const period=c.match(/Main Sleep Period \(incl\. awake\):\s*([^\n]+)/i);if(period)row.mainPeriodMinutes=parseDurationPhrase(period[1]);
    const nap=c.match(/Naps Total(?: \(asleep\))?:\s*([^\n]+)/i);if(nap)row.napMinutes=parseDurationPhrase(nap[1])||0;
    const win=c.match(/Main Sleep Window:\s*([^\n]+)/i);if(win)row.window=win[1].trim();
    for(const [k,label] of [['deepPct','Deep Sleep Ratio'],['lightPct','Light Sleep Ratio'],['remPct','REM Ratio'],['awakePct','Awake Ratio']]){const mm=c.match(new RegExp(label+':\\s*(\\d+)%','i'));if(mm)row[k]=+mm[1]}
    const awake=c.match(/Awake Time:\s*([^\n]+)/i);if(awake)row.awakeMinutes=parseDurationPhrase(awake[1])||0;
    rows.push(row);
  }
  return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
function mergeById(prev,next){
  const m=new Map((prev||[]).map(x=>[String(x.corosId||''),x]));
  for(const x of next||[]){const k=String(x.corosId||'');if(k)m.set(k,{...(m.get(k)||{}),...x})}
  return [...m.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,500);
}
function mergeByDate(prev,next,limit=365){
  const m=new Map((prev||[]).map(x=>[x.date,x]));for(const x of next||[])if(x?.date)m.set(x.date,{...(m.get(x.date)||{}),...x});
  return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-limit);
}
function ymd(date){return date.toISOString().slice(0,10).replace(/-/g,'')}
function addDays(d,n){const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x}

export async function refreshCorosSnapshot(req,{force=false}={}){
  const existing=await readCorosSnapshot();
  if(!force&&existing?.syncedAt&&Date.now()-Date.parse(existing.syncedAt)<15*60*1000)return {...existing,cached:true};
  const provider=await providerFor(req);
  if(!(await provider.tokens())){const e=new Error('COROS_NOT_CONNECTED');e.code='COROS_NOT_CONNECTED';throw e}
  const client=new Client({name:'SmartCoach',version:'3.0.0'},{versionNegotiation:{mode:'auto'}});
  const transport=new StreamableHTTPClientTransport(new URL(MCP_URL),{authProvider:provider});
  await client.connect(transport);
  const listed=await client.listTools();
  const toolsByName=new Map((listed.tools||[]).map(t=>[t.name,t]));
  const choose=(...names)=>names.find(n=>toolsByName.has(n));
  const diagnostics=[];
  async function call(names,args={}){
    const name=choose(...names);if(!name){diagnostics.push({tool:names[0],error:'not_available'});return {text:'',structured:null}}
    try{
      const r=await client.callTool({name,arguments:filterArgs(toolsByName.get(name),args)});
      if(r?.isError)throw new Error(textResult(r).text||'tool_error');
      return textResult(r);
    }catch(e){diagnostics.push({tool:name,error:String(e?.message||e)});return {text:'',structured:null}}
  }
  const now=new Date(),first=!existing?.activities?.length,start=addDays(now,first?-270:-45);
  const activity=await call(['querySportRecords'],{startDate:ymd(start),endDate:ymd(now),sportTypeCodes:[65535],minDistanceKm:0,maxDistanceKm:1000,minDurationMinutes:0,maxDurationMinutes:1440,maxAveragePace:'99:59',locationKeyword:'',limit:100});
  const fitness=await call(['queryFitnessAssessmentOverview'],{});
  const load=await call(['queryTrainingLoadAssessment'],{days:90});
  const recovery=await call(['queryRecoveryStatus'],{});
  const daily=await call(['queryDailyHealthData'],{days:90});
  const sleep=await call(['querySleepData','querySleepOverview'],{days:45});
  const sleepHrv=await call(['querySleepHrv'],{days:45});
  await client.close();

  const parsedDaily=parseDailyHealth(daily.text),parsedFitness=parseFitness(fitness.text),parsedLoad=parseLoad(load.text),parsedRecovery=parseRecovery(recovery.text);
  const snapshot={
    ...(existing||{}),
    source:'COROS',syncedAt:new Date().toISOString(),
    fitness:{...(existing?.fitness||{}),...parsedFitness},
    vo2max:parsedFitness.vo2max??existing?.vo2max??null,
    runningLevel:parsedFitness.runningLevel??existing?.runningLevel??null,
    thresholdPace:parsedFitness.thresholdPace??existing?.thresholdPace??null,
    racePredictions:{...(existing?.racePredictions||{}),...(parsedFitness.racePredictions||{})},
    recovery:parsedRecovery.value??existing?.recovery??null,
    recoveryText:parsedRecovery.text??existing?.recoveryText??null,
    fullRecoveryHours:parsedRecovery.fullRecoveryHours,
    loadHistory:mergeByDate(existing?.loadHistory,parsedLoad,365),
    activities:mergeById(existing?.activities,parseActivities(activity.text)),
    dailyHealth:mergeByDate(existing?.dailyHealth,parsedDaily.days,180),
    sleep:mergeByDate(existing?.sleep,parseSleep(sleep.text),180),
    restingHr:parsedDaily.baseline.restingHr??existing?.restingHr??null,
    hrvBaseline:parsedDaily.baseline.hrv??existing?.hrvBaseline??null,
    sleepHrvRaw:sleepHrv.text||existing?.sleepHrvRaw||null,
    diagnostics
  };
  const latestLoad=snapshot.loadHistory?.at(-1);if(latestLoad){snapshot.shortLoad=latestLoad.short;snapshot.longLoad=latestLoad.long;snapshot.loadRatio=latestLoad.ratio}
  await writeCorosSnapshot(snapshot);
  return snapshot;
}
