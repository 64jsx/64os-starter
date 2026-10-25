// The numbers on the Insights page: the weeks of the record, the weekday pattern, the last 28 days and the heat cells.
// Pure functions over the store: no clock, no React, no storage. Every caller passes todayIso.
import {isScheduled,isDone,isPerfect,hasScheduled,tally,judgedDays} from "./stats.js";
import {DAYS,keyOfDate,dateKey,startOf} from "./dates.js";

const dateOf=iso=>new Date(iso+"T12:00:00");
const diOf=iso=>(dateOf(iso).getDay()+6)%7;
const addDays=(iso,n)=>{const d=dateOf(iso);d.setDate(d.getDate()+n);return dateKey(d)};
const mondayIso=iso=>addDays(iso,-diOf(iso));
const pctOf=(done,sched)=>sched?Math.round(done/sched*100):0;

// One row per Monday-start week from the week the data started to the current week, oldest first, blank weeks included.
// done and sched follow tally (days up to today, today only once done); perfectDays counts the days of the week that are
// perfect (today once it is); focus is seconds from the time log.
export function weekSeries(store,todayIso){
  const out=[];const curKey=keyOfDate(dateOf(todayIso));
  for(let mon=mondayIso(startOf(store));mon<=todayIso;mon=addDays(mon,7)){
    const to=addDays(mon,6);
    let done=0,sched=0,perfectDays=0,focus=0;
    for(const h of store.habits){const t=tally(store,h,mon,to,todayIso);done+=t.done;sched+=t.sched}
    for(let iso=mon;iso<=to&&iso<=todayIso;iso=addDays(iso,1)){
      if(hasScheduled(store,iso)&&isPerfect(store,iso))perfectDays++;
      const t=store.time[iso]||{};for(const id in t)focus+=t[id]||0;
    }
    const key=keyOfDate(dateOf(mon));
    out.push({key,from:mon,to,done,sched,pct:pctOf(done,sched),perfectDays,focus,current:key===curKey});
  }
  return out;
}

// Mon to Sun: scheduled habits and the share done on that weekday over every judged day of the record.
export function weekdayPattern(store,todayIso){
  const out=DAYS.map((label,di)=>({di,label,done:0,sched:0,pct:0}));
  for(const iso of judgedDays(store,todayIso)){
    const o=out[diOf(iso)];
    for(const h of store.habits){if(!isScheduled(h,iso))continue;o.sched++;if(isDone(store,h,iso))o.done++}
  }
  for(const o of out)o.pct=pctOf(o.done,o.sched);
  return out;
}

// The window of `days` dates ending yesterday, clipped at the start of the data. A double miss is a miss whose previous judged day
// was a miss too ; the judged day just before the window decides that for its first day. weakest and strongest
// are judged among habits scheduled at least three times in the window.
export function windowStats(store,todayIso,days=28){
  const to=addDays(todayIso,-1);
  let from=addDays(to,-(days-1));if(from<startOf(store))from=startOf(store);
  const judged=judgedDays(store,todayIso).filter(iso=>iso>=from&&iso<=to);
  const before=judgedDays(store,from);
  let prevMiss=before.length?!isPerfect(store,before[before.length-1]):false;
  let misses=0,doubleMisses=0,perfectDays=0;
  for(const iso of judged){
    const miss=!isPerfect(store,iso);
    if(miss){misses++;if(prevMiss)doubleMisses++}else perfectDays++;
    prevMiss=miss;
  }
  const perHabit=store.habits.map(h=>{const t=tally(store,h,from,to,todayIso);return {h,done:t.done,sched:t.sched,pct:pctOf(t.done,t.sched)}});
  let done=0,sched=0;for(const p of perHabit){done+=p.done;sched+=p.sched}
  const eligible=perHabit.filter(p=>p.sched>=3);
  const weakest=eligible.length?eligible.reduce((a,b)=>b.pct<a.pct?b:a):null;
  const strongest=eligible.length?eligible.reduce((a,b)=>b.pct>a.pct?b:a):null;
  return {from,to,judged:judged.length,done,sched,pct:pctOf(done,sched),misses,doubleMisses,perfectDays,weakest,strongest,perHabit};
}

// weeks * 7 cells, Monday first, ending with the Sunday of the current week. A cell is unknown before the data and future
// after today; otherwise it carries the share of the day's scheduled habits done.
export function heatCells(store,todayIso,weeks=18){
  const start=addDays(mondayIso(todayIso),-(weeks-1)*7);const out=[];
  for(let i=0;i<weeks*7;i++){
    const iso=addDays(start,i);
    if(iso>todayIso||iso<startOf(store)){out.push({iso,known:false,future:iso>todayIso,frac:0,done:0,n:0});continue}
    const sched=store.habits.filter(h=>isScheduled(h,iso));const n=sched.length;const done=sched.filter(h=>isDone(store,h,iso)).length;
    out.push({iso,known:true,future:false,frac:n?done/n:0,done,n});
  }
  return out;
}
