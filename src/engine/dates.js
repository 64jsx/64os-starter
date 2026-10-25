// Date helpers: ISO weeks, week keys, day keys. No imports.
export const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export function isoWeek(d){d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=d.getUTCFullYear();return{y,w:Math.ceil((((d-Date.UTC(y,0,1))/864e5)+1)/7)}}
export function mondayOf(d){const x=new Date(d);const dd=(x.getDay()+6)%7;x.setDate(x.getDate()-dd);x.setHours(0,0,0,0);return x}
export function keyOfDate(d){const m=mondayOf(d);const{y,w}=isoWeek(m);return`${y}-W${String(w).padStart(2,"0")}`}
export function weekInfo(offset){const m=mondayOf(new Date());m.setDate(m.getDate()+offset*7);return{key:keyOfDate(m),monday:m}}
export function fmt(d){return String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0")}
export function mondayFromKey(key){const[y,w]=key.split("-W").map(Number);const m=mondayOf(new Date(y,0,4));m.setDate(m.getDate()+(w-1)*7);return m}
export const todayIdx=()=>(new Date().getDay()+6)%7;
export const dateKey=d=>{d=d||new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
export const isoToday=()=>dateKey();
export const weekDates=monday=>[0,1,2,3,4,5,6].map(i=>{const d=new Date(monday);d.setDate(d.getDate()+i);return dateKey(d)});
export const secsOf=(time,dk,hid)=>(time[dk]&&time[dk][hid])||0;
// the first day the app judges: the day the data was started. Nothing before it counts as a miss.
export const startOf=store=>(store&&typeof store.since==="string"&&store.since)||"2000-01-01";
