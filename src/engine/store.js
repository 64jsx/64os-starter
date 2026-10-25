// The store: its defaults, the check that brings any saved state to the current shape, and loading it. Pure apart from
// localStorage. Every habit is entered by hand on the Manage page; nothing is planned or written for you.
// HB_KEY is exported because the App heartbeat writes the key that settleAway reads.
import {dateKey} from "./dates.js";

export const STORE_KEY="os64starter";

// A habit:
//   id    "h1", "h2" ... (never reused)
//   ico   one emoji
//   name  what it is
//   tgt   daily target in minutes; 0 means tick only (no timer). When today's logged minutes reach it, the habit ticks itself.
//   off   the weekdays it is NOT planned (0 = Mon ... 6 = Sun). An off day shows a dash and never counts as a miss.
//   md    the timer mode it starts in (see MODES)
//   since the first day it is judged (the day it was added), so an older day never counts against a new habit
// Timer modes: w = work minutes, r = rest minutes. 0 work = open stopwatch.
export const MODES={
  pomo:{l:"25 / 5",w:25,r:5},
  deep:{l:"60 / 10",w:60,r:10},
  long:{l:"90 / 10",w:90,r:10},
  block:{l:"120 / 10",w:120,r:10},
  m10:{l:"10 min",w:10,r:0},
  free:{l:"∞",w:0,r:0},
  custom:{l:"Custom",w:0,r:0}
};
export const FREE_CAP=6*3600; // an open stopwatch left running stops counting after 6h (tab left open overnight)
export const DEFAULT_TIMER={hid:null,mode:"deep",custom:20,phase:"work",startedAt:null,acc:0,logged:0,ext:0,rounds:0};

export const isOff=(h,di)=>Array.isArray(h.off)&&h.off.includes(di);
export const tgtOf=(h,di)=>{const t=h.tgt;if(Array.isArray(t))return t[di]||0;return typeof t==="number"?t:0};

export function newStore(){
  return {v:1,since:dateKey(),habits:[],weeks:{},time:{},books:[],mind:{},nextId:1,timer:{...DEFAULT_TIMER}};
}
// Brings any saved state (an old copy, a backup, a hand-edited file) to the shape the app reads. A field it does not know is kept.
export function ensureAll(s){
  if(!s||typeof s!=="object")s=newStore();
  if(typeof s.since!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s.since))s.since=dateKey();
  if(!Array.isArray(s.habits))s.habits=[];
  s.habits=s.habits.filter(h=>h&&typeof h==="object"&&typeof h.id==="string");
  s.habits.forEach(h=>{
    if(typeof h.name!=="string"||!h.name.trim())h.name="Habit";
    if(typeof h.ico!=="string")h.ico="✅";
    if(Array.isArray(h.tgt))h.tgt=[0,1,2,3,4,5,6].map(i=>Math.max(0,Number(h.tgt[i])||0));
    else h.tgt=Math.max(0,Number(h.tgt)||0);
    if(!Array.isArray(h.off))h.off=[];
    h.off=[...new Set(h.off.filter(i=>Number.isInteger(i)&&i>=0&&i<=6))].sort();
    if(!MODES[h.md]||h.md==="custom")h.md="deep";
    if(typeof h.since!=="string")h.since=s.since;
  });
  const maxId=s.habits.reduce((a,h)=>Math.max(a,parseInt(h.id.replace(/\D/g,""))||0),0);
  if(!Number.isInteger(s.nextId)||s.nextId<=maxId)s.nextId=maxId+1;
  if(!s.weeks||typeof s.weeks!=="object")s.weeks={};
  if(!s.time||typeof s.time!=="object")s.time={};
  if(!Array.isArray(s.books))s.books=[];
  if(!s.mind||typeof s.mind!=="object"||Array.isArray(s.mind))s.mind={};
  if(!s.timer||typeof s.timer!=="object")s.timer={...DEFAULT_TIMER};
  Object.keys(DEFAULT_TIMER).forEach(k=>{if(s.timer[k]===undefined)s.timer[k]=DEFAULT_TIMER[k]});
  if(!MODES[s.timer.mode])s.timer.mode="deep";
  if(s.timer.hid&&!s.habits.some(h=>h.id===s.timer.hid))s.timer={...DEFAULT_TIMER};
  s.v=1;
  return s;
}
export const HB_KEY="os64starterhb";
// If the tab was closed while a timer ran, stop it at the last heartbeat (time away is not work) and log the work done.
export function settleAway(s){
  const t=s.timer;if(!t||!t.startedAt)return s;
  let hb=0;try{hb=parseInt(localStorage.getItem(HB_KEY)||"0")}catch(e){}
  const now=Date.now();
  if(hb&&now-hb>20000){
    const stop=Math.max(t.startedAt,hb);
    const m=MODES[t.mode]||MODES.deep;const w=(t.mode==="custom"?t.custom:m.w)*60;const L=(t.phase==="rest"?m.r*60:w)+(t.ext||0);
    let e=t.acc+(stop-t.startedAt)/1000;e=Math.min(e,L>0?L:FREE_CAP);
    if(t.phase==="work"&&t.hid){
      const dk=dateKey(new Date(stop));
      s.time=s.time||{};s.time[dk]=s.time[dk]||{};s.time[dk][t.hid]=(s.time[dk][t.hid]||0)+Math.max(0,e-(t.logged||0));t.logged=e;
    }
    t.acc=e;t.startedAt=null;
    if(t.phase==="rest"){t.phase="work";t.acc=0;t.logged=0;t.ext=0}
  }
  return s;
}
export function loadStore(){
  let s=null;
  try{s=JSON.parse(localStorage.getItem(STORE_KEY)||"null")}catch(e){}
  return s?settleAway(ensureAll(s)):newStore();
}
