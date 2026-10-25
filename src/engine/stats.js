// Month numbers for the Habits page. Pure functions over the store (no React, no clock): every caller passes todayIso.
// Months are 1 to 12. A habit is planned on every weekday that is not in its off list, from the day it was added (since);
// nothing before the day the data was started counts. A miss is a miss: nothing covers one.
import {keyOfDate,dateKey,secsOf,startOf} from "./dates.js";

const dateOf=iso=>new Date(iso+"T12:00:00");
const diOf=iso=>(dateOf(iso).getDay()+6)%7;
const addDays=(iso,n)=>{const d=dateOf(iso);d.setDate(d.getDate()+n);return dateKey(d)};

export function isScheduled(h,iso){
  if(typeof h.since==="string"&&iso<h.since)return false;
  return !(Array.isArray(h.off)&&h.off.includes(diOf(iso)));
}
export const isDone=(store,h,iso)=>{const w=store.weeks[keyOfDate(dateOf(iso))];return !!(w&&w[h.id]&&w[h.id][diOf(iso)])};
// a day with at least one scheduled habit; a perfect day has every scheduled habit done (a day with nothing scheduled is not perfect)
export const hasScheduled=(store,iso)=>store.habits.some(h=>isScheduled(h,iso));
export function isPerfect(store,iso){
  let n=0;
  for(const h of store.habits){if(!isScheduled(h,iso))continue;n++;if(!isDone(store,h,iso))return false}
  return n>0;
}
// the judged days: every date from the start of the data up to yesterday that has a planned habit. Today is open.
export function judgedDays(store,todayIso){
  const out=[];
  for(let iso=startOf(store);iso<todayIso;iso=addDays(iso,1))if(hasScheduled(store,iso))out.push(iso);
  return out;
}

export function monthDays(year,month){
  const out=[];const n=new Date(year,month,0).getDate();
  for(let d=1;d<=n;d++)out.push(year+"-"+String(month).padStart(2,"0")+"-"+String(d).padStart(2,"0"));
  return out;
}
export function cellState(store,h,iso,todayIso){
  if(iso>todayIso)return "future";
  if(!isScheduled(h,iso))return "off";
  if(isDone(store,h,iso))return "done";
  return "missed";
}
// done and scheduled days between from and to (inclusive), never past today; today counts only once it is done
export function tally(store,h,from,to,todayIso){
  let done=0,sched=0;
  for(let iso=from;iso<=to&&iso<=todayIso;iso=addDays(iso,1)){
    if(!isScheduled(h,iso))continue;
    const d=isDone(store,h,iso);
    if(iso===todayIso&&!d)continue;
    sched++;if(d)done++;
  }
  return {done,sched};
}
export function habitMonthPct(store,h,year,month,todayIso){
  const days=monthDays(year,month);const t=tally(store,h,days[0],days[days.length-1],todayIso);
  return t.sched?Math.round(t.done/t.sched*100):0;
}
// scheduled days done in a row up to today; off days are skipped, today counts only once it is done
export function currentStreak(store,h,todayIso){
  let n=0;
  for(let i=0,iso=todayIso;i<730&&iso>=startOf(store);i++,iso=addDays(iso,-1)){
    if(!isScheduled(h,iso))continue;
    if(isDone(store,h,iso))n++;
    else if(iso!==todayIso)break;
  }
  return n;
}
export function bestStreakInMonth(store,h,year,month,todayIso){
  let best=0,run=0;
  for(const iso of monthDays(year,month)){
    if(iso>todayIso)break;
    if(!isScheduled(h,iso))continue;
    if(isDone(store,h,iso)){run++;best=Math.max(best,run)}
    else if(iso!==todayIso)run=0;
  }
  return best;
}
// perfect days in a row ending today: today counts once it is perfect and does not break the run while open; days with
// nothing planned are skipped; the walk stops at the start of the data
export function dayStreak(store,todayIso){
  let n=0;
  for(let i=0,iso=todayIso;i<730&&iso>=startOf(store);i++,iso=addDays(iso,-1)){
    if(!hasScheduled(store,iso))continue;
    if(isPerfect(store,iso))n++;
    else if(iso!==todayIso)break;
  }
  return n;
}
export function bestDayStreak(store,todayIso){
  let best=0,run=0;
  for(let iso=startOf(store);iso<=todayIso;iso=addDays(iso,1)){
    if(!hasScheduled(store,iso))continue;
    if(isPerfect(store,iso)){run++;best=Math.max(best,run)}
    else if(iso!==todayIso)run=0;
  }
  return best;
}
// share of the day's scheduled habits that are done, for every day of the month up to today (days with nothing scheduled are left out)
export function dailyTrend(store,year,month,todayIso){
  const out=[];
  for(const iso of monthDays(year,month)){
    if(iso>todayIso)break;
    const sched=store.habits.filter(h=>isScheduled(h,iso));
    if(!sched.length)continue;
    out.push({iso,pct:Math.round(sched.filter(h=>isDone(store,h,iso)).length/sched.length*100)});
  }
  return out;
}
// Monday-start weeks that overlap the month, labelled W1 to W5 (W6 when a month touches six weeks)
export function weekColumns(year,month){
  const days=monthDays(year,month);const first=dateOf(days[0]);
  let mon=addDays(days[0],-((first.getDay()+6)%7));const out=[];
  while(mon<=days[days.length-1]){out.push({label:"W"+(out.length+1),from:mon,to:addDays(mon,6)});mon=addDays(mon,7)}
  return out;
}
export function focusSecs(store,hid,from,to){
  let s=0;for(let iso=from;iso<=to;iso=addDays(iso,1))s+=secsOf(store.time,iso,hid);
  return s;
}
