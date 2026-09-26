import {
  SNAPSHOT_PATH, readBlobJson, writeBlobJson, loadOAuth, makeProvider, connectClient, call,
  parseFitness, parseRecovery, parseLoad, parseDailyHealth, parseSleep, parseActivities, parseActivityDetail
} from '../lib/coros-mcp.js';

function headers(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');
}
const ymd=d=>d.toISOString().slice(0,10).replace(/-/g,'');
const HR_ZONES={
  source:'COROS Running Fitness Test',type:'Zona Soglia Anaerobica',thresholdHr:172,
  zones:[
    {name:'Recupero',range:'<138',min:null,max:137,pct:'<80%'},
    {name:'Resistenza aerobica',range:'138–155',min:138,max:155,pct:'80–90%'},
    {name:'Potenza aerobica',range:'156–163',min:156,max:163,pct:'91–95%'},
    {name:'Soglia',range:'164–175',min:164,max:175,pct:'96–102%'},
    {name:'Resistenza anaerobica',range:'176–182',min:176,max:182,pct:'103–106%'},
    {name:'Potenza anaerobica',range:'>182',min:183,max:null,pct:'>106%'}
  ]
};
const txt=x=>String(x||'');
function chooseTool(names,candidates){
  for(const n of candidates)if(names.has(n))return n;
  return null;
}
async function syncFromMcp(req){
  const provider=await makeProvider(req);
  if(!provider.store?.tokens)throw Object.assign(new Error('coros_not_connected'),{code:'NOT_CONNECTED'});
  const {client}=await connectClient(provider);
  try{
    const listed=await client.listTools(),names=new Set((listed.tools||[]).map(x=>x.name));
    const fitnessTool=chooseTool(names,['queryFitnessAssessmentOverview']);
    const recoveryTool=chooseTool(names,['queryRecoveryStatus']);
    const loadTool=chooseTool(names,['queryTrainingLoadAssessment']);
    const dailyTool=chooseTool(names,['queryDailyHealthData']);
    const sleepTool=chooseTool(names,['querySleepOverview','querySleepData']);
    const sportTool=chooseTool(names,['querySportRecords']);
    if(!fitnessTool||!recoveryTool||!loadTool||!dailyTool||!sleepTool||!sportTool)throw new Error('COROS MCP tool set incomplete');

    const now=new Date(),from=new Date(now.getTime()-120*864e5);
    const [fitnessText,recoveryText,loadText,dailyText,sleepText,sportText]=await Promise.all([
      call(client,fitnessTool,{}),
      call(client,recoveryTool,{}),
      call(client,loadTool,{days:90}),
      call(client,dailyTool,{days:90}),
      call(client,sleepTool,{days:90}),
      call(client,sportTool,{
        startDate:ymd(from),endDate:ymd(now),sportTypeCodes:[65535],
        minDistanceKm:0,maxDistanceKm:1000,minDurationMinutes:0,maxDurationMinutes:1440,
        maxAveragePace:'99:59',locationKeyword:'',limit:100
      })
    ]);

    const fitness=parseFitness(fitnessText),recovery=parseRecovery(recoveryText),loadHistory=parseLoad(loadText);
    const daily=parseDailyHealth(dailyText),sleep=parseSleep(sleepText),activities=parseActivities(sportText);

    const detailTool=chooseTool(names,['getActivityDetail']);
    if(detailTool){
      const recent=activities.slice(0,24);
      for(let i=0;i<recent.length;i+=4){
        const batch=recent.slice(i,i+4);
        const details=await Promise.all(batch.map(async a=>{
          try{return parseActivityDetail(await call(client,detailTool,{labelId:a.corosId,sportType:a.sportType}))}catch{return {}}
        }));
        batch.forEach((a,j)=>Object.assign(a,details[j]));
      }
    }

    const latestLoad=loadHistory.at(-1)||{};
    let previous=null;try{previous=await readBlobJson(SNAPSHOT_PATH)}catch{}
    const syncedAt=new Date().toISOString(),fitnessDay=syncedAt.slice(0,10);
    const historyMap=new Map((previous?.fitnessHistory||[]).map(x=>[x.date,x]));
    historyMap.set(fitnessDay,{date:fitnessDay,vo2max:fitness.vo2max,runningLevel:fitness.runningLevel,thresholdPace:fitness.thresholdPace,racePredictions:fitness.racePredictions});
    const fitnessHistory=[...historyMap.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-365);
    const snapshot={
      source:'COROS',syncedAt,fitness,fitnessHistory,
      vo2max:fitness.vo2max,runningLevel:fitness.runningLevel,thresholdPace:fitness.thresholdPace,
      racePredictions:fitness.racePredictions,recovery,
      shortLoad:latestLoad.short??null,longLoad:latestLoad.long??null,loadRatio:latestLoad.ratio??null,
      recoveryValue:recovery.value,recoveryText:recovery.text,
      restingHr:daily.baseline.restingHr,hrvBaseline:daily.baseline.hrvBaseline,
      loadHistory,dailyHealth:daily.rows,sleep,activities,hrZones:HR_ZONES,
      tools:[...names]
    };
    await writeBlobJson(SNAPSHOT_PATH,snapshot);
    return snapshot;
  }finally{try{await client.close()}catch{}}
}
export default async function handler(req,res){
  headers(res);if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  try{
    if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('BLOB_READ_WRITE_TOKEN missing');
    const oauth=await loadOAuth();
    if(req.query?.status==='1'){
      return res.status(200).json({ok:true,connected:!!oauth?.tokens,connectUrl:'/api/coros-connect'});
    }
    if(!oauth?.tokens)return res.status(401).json({ok:false,error:'coros_not_connected',connectUrl:'/api/coros-connect'});
    let cached=null;try{cached=await readBlobJson(SNAPSHOT_PATH)}catch{}
    const age=cached?.syncedAt?Date.now()-Date.parse(cached.syncedAt):Infinity;
    const force=req.query?.force==='1';
    if(cached&&!force&&age<10*60*1000)return res.status(200).json({ok:true,cached:true,...cached});
    const data=await syncFromMcp(req);
    return res.status(200).json({ok:true,cached:false,...data});
  }catch(e){
    console.error('COROS sync error',e);
    if(e?.code==='NOT_CONNECTED'||txt(e?.message).includes('coros_not_connected'))return res.status(401).json({ok:false,error:'coros_not_connected',connectUrl:'/api/coros-connect'});
    let cached=null;try{cached=await readBlobJson(SNAPSHOT_PATH)}catch{}
    if(cached)return res.status(200).json({ok:true,cached:true,stale:true,syncError:String(e?.message||e),...cached});
    return res.status(500).json({ok:false,error:String(e?.message||e)});
  }
}