function headers(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');
}
function unfoldIcs(s){return s.replace(/\r?\n[ \t]/g,'')}
function unescapeIcs(s=''){return s.replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\')}
function parseDateValue(v){
  if(!v)return null;
  if(/^\d{8}$/.test(v))return v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8)+'T00:00:00';
  if(/^\d{8}T\d{6}Z$/.test(v))return new Date(v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8)+'T'+v.slice(9,11)+':'+v.slice(11,13)+':'+v.slice(13,15)+'Z').toISOString();
  if(/^\d{8}T\d{6}$/.test(v))return v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8)+'T'+v.slice(9,11)+':'+v.slice(11,13)+':'+v.slice(13,15);
  return v;
}
function classifyShift(summary,start,end){
  const x=String(summary||'').toLowerCase();
  const work=/(simio|spital|ambu|repart|guardia|reperib|turno|notte|mattina|pomeriggio|medicina|osped)/i.test(x);
  if(!work)return null;
  let load=1,label=summary||'Turno';
  if(/24\s*ore|24h/.test(x))load=4;
  else if(/notte/.test(x)&&/reperib|ambu|guardia/.test(x))load=4;
  else if(/notte/.test(x))load=3;
  else if(/reperib/.test(x))load=3;
  else if(/pomeriggio/.test(x))load=2;
  else if(/mattina/.test(x))load=1;
  const date=String(start||'').slice(0,10);
  return {date,title:label,load,source:'Google Calendar',start,end};
}
function parseIcs(ics){
  const text=unfoldIcs(ics),chunks=text.split('BEGIN:VEVENT').slice(1),events=[];
  for(const ch of chunks){
    const body=ch.split('END:VEVENT')[0],lines=body.split(/\r?\n/),o={};
    for(const line of lines){
      const i=line.indexOf(':');if(i<0)continue;
      const lhs=line.slice(0,i),value=line.slice(i+1),key=lhs.split(';')[0].toUpperCase();
      if(key==='UID')o.id=unescapeIcs(value);
      else if(key==='SUMMARY')o.summary=unescapeIcs(value);
      else if(key==='DESCRIPTION')o.description=unescapeIcs(value);
      else if(key==='LOCATION')o.location=unescapeIcs(value);
      else if(key==='DTSTART')o.start=parseDateValue(value);
      else if(key==='DTEND')o.end=parseDateValue(value);
      else if(key==='STATUS')o.status=value;
    }
    if(o.start&&o.status!=='CANCELLED')events.push(o);
  }
  return events.sort((a,b)=>String(a.start).localeCompare(String(b.start)));
}
export default async function handler(req,res){
  headers(res);if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  try{
    const url=process.env.GOOGLE_CALENDAR_ICS_URL;
    if(!url)return res.status(503).json({ok:false,error:'calendar_not_configured',setup:'Set GOOGLE_CALENDAR_ICS_URL in Vercel to the private Google Calendar iCal URL.'});
    const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Calendar feed HTTP '+r.status);
    const all=parseIcs(await r.text()),now=Date.now(),from=now-21*864e5,to=now+90*864e5;
    const events=all.filter(e=>{const t=Date.parse(e.start);return Number.isFinite(t)&&t>=from&&t<=to});
    const shifts=events.map(e=>classifyShift(e.summary,e.start,e.end)).filter(Boolean);
    return res.status(200).json({ok:true,source:'Google Calendar',syncedAt:new Date().toISOString(),events,shifts});
  }catch(e){return res.status(500).json({ok:false,error:String(e?.message||e)})}
}