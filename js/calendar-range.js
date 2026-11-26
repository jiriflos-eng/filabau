function bookingToday(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Athens",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part=k=>parts.find(p=>p.type===k).value;
  return part("year")+"-"+part("month")+"-"+part("day");
}
function bookingCalendarSettings(raw={},legacySeason){
  const md=(m,d)=>String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  const start=raw.seasonStart??md(legacySeason?.startMonth??4,legacySeason?.startDay??30);
  const end=raw.seasonEnd??md(legacySeason?.endMonth??10,legacySeason?.endDay??31);
  const valid=v=>typeof v==="string"&&/^\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse("2001-"+v))&&new Date("2001-"+v).toISOString().slice(5,10)===v;
  if(!valid(start)||!valid(end)||start>=end)throw Error("Invalid calendar season: use MM-DD, start before end");
  const count=raw.seasonsToShow??2,hidePast=raw.hidePastDays??true;
  if(!Number.isInteger(count)||count<1||count>3||typeof hidePast!=="boolean")throw Error("Invalid calendar visibility settings");
  return {seasonStart:start,seasonEnd:end,hidePastDays:hidePast,seasonsToShow:count};
}
function bookingCalendarWindows(settings,today=bookingToday()){
  const year=Number(today.slice(0,4)),windows=[];
  for(let y=year;y<=year+2&&windows.length<settings.seasonsToShow;y++){
    const start=y+"-"+settings.seasonStart,end=y+"-"+settings.seasonEnd;
    if(settings.hidePastDays&&end<=today)continue;
    const from=settings.hidePastDays&&start<today?today:start;
    if(from<end)windows.push({year:y,from,to:end});
  }
  return windows;
}
function bookingEffectiveSeason(settings){
  const [startMonth,startDay]=settings.seasonStart.split("-").map(Number);
  const [endMonth,endDay]=settings.seasonEnd.split("-").map(Number);
  return {startMonth,startDay,endMonth,endDay};
}
function bookingWindowAllows(windows,start,end,today=bookingToday()){
  return typeof start==="string"&&typeof end==="string"&&start>=today&&start<end&&windows.some(w=>start>=w.from&&end<=w.to);
}
