// The mindset check-in: one tap a day, 1 to 5, with an optional line.
// Only the day the caller names is written (the app passes today), a day left blank stays blank, and the same value tapped
// again clears the day. Pure over the store; the stats take a date window from the caller.
import {DAYS,dateKey} from "./dates.js";

export const MIND=["drained","low","ok","good","fired up"]; // the labels of 1 to 5
const diOf=iso=>(new Date(iso+"T12:00:00").getDay()+6)%7;
const addDays=(iso,n)=>{const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return dateKey(d)};
const round1=x=>Math.round(x*10)/10;

export const mindOf=(store,iso)=>{const m=store&&store.mind&&store.mind[iso];return m&&Number.isInteger(m.v)&&m.v>=1&&m.v<=5?m:null};
export function setMind(store,iso,v){
  store.mind=store.mind||{};
  const cur=mindOf(store,iso);
  if(v==null||(cur&&cur.v===v)){delete store.mind[iso];return}
  const n=Math.max(1,Math.min(5,Math.round(Number(v))));
  if(!Number.isInteger(n))return;
  store.mind[iso]={v:n,note:cur?cur.note:""};
}
export function setMindNote(store,iso,note){const cur=mindOf(store,iso);if(cur)cur.note=String(note||"")}

// the window from..to (inclusive): count, average, the weekday pattern, the best and worst weekday, the days rated 1 or 2 (newest first)
export function mindStats(store,from,to){
  const byDay=DAYS.map((label,di)=>({di,label,n:0,sum:0,avg:null}));
  let n=0,sum=0;const lowDays=[];
  for(let iso=from;iso<=to;iso=addDays(iso,1)){
    const m=mindOf(store,iso);if(!m)continue;
    n++;sum+=m.v;const d=byDay[diOf(iso)];d.n++;d.sum+=m.v;
    if(m.v<=2)lowDays.push(iso);
  }
  for(const d of byDay){d.avg=d.n?round1(d.sum/d.n):null;delete d.sum}
  const rated=byDay.filter(d=>d.n);
  return {n,avg:n?round1(sum/n):null,byDay,
    best:rated.length?rated.reduce((a,b)=>b.avg>a.avg?b:a):null,
    worst:rated.length?rated.reduce((a,b)=>b.avg<a.avg?b:a):null,
    lowDays:lowDays.reverse()};
}
// the export: "Mon 4 · Tue 3 · Wed - · ..." and the notes of the week with their weekday
export const mindLine=(store,weekDates)=>weekDates.map((dk,di)=>{const m=mindOf(store,dk);return DAYS[di]+" "+(m?m.v:"-")}).join(" · ");
export const mindNotes=(store,weekDates)=>weekDates.map((dk,di)=>{const m=mindOf(store,dk);return m&&m.note&&m.note.trim()?{label:DAYS[di],note:m.note.trim()}:null}).filter(Boolean);
