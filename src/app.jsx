// 64 OS (starter). React, fully offline. Every change autosaves through the local server into data/os.json, with
// localStorage as the mirror and the fallback when the server is off (src/data/sync.js). Nothing here talks to the
// internet except the optional brown noise player, which embeds a YouTube video only when you press its button.
import React,{useState,useEffect,useMemo,useCallback,useRef} from "react";
import {createRoot} from "react-dom/client";
import {createSync} from "./data/sync.js";
import {MODES,FREE_CAP,isOff,tgtOf,ensureAll,HB_KEY} from "./engine/store.js";
import {dayStreak,currentStreak,isScheduled} from "./engine/stats.js";
import {DAYS,weekInfo,fmt,mondayFromKey,todayIdx,dateKey,weekDates,secsOf,startOf} from "./engine/dates.js";
import {mm,hmm,shortName} from "./engine/format.js";
import {Shell} from "./ui/Shell.jsx";
import {NoisePlayer} from "./ui/Noise.jsx";
import {Today} from "./ui/Today.jsx";
import {Habits} from "./ui/Habits.jsx";
import {Settings} from "./ui/Settings.jsx";
import {Insights} from "./ui/Insights.jsx";
import {Books} from "./ui/Books.jsx";
import {Manage} from "./ui/Manage.jsx";
import {setMind,setMindNote,mindLine,mindNotes} from "./engine/mind.js";

/* ---------------- sound + notifications ---------------- */
let audioCtx=null;
function beep(n=3,freq=880){
  try{
    audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    const t0=audioCtx.currentTime;
    for(let i=0;i<n;i++){
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type="sine";o.frequency.value=freq;o.connect(g);g.connect(audioCtx.destination);
      const t=t0+i*0.22;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.35,t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
      o.start(t);o.stop(t+0.2);
    }
  }catch(e){}
}
function notify(title,body){
  try{if("Notification" in window&&Notification.permission==="granted")new Notification(title,{body,silent:true})}catch(e){}
}

/* ---------------- in-app dialogs (replace prompt / confirm / alert) ---------------- */
let dialogPush=null;
const openDialog=d=>new Promise(res=>{if(dialogPush)dialogPush({...d,res});else res(d.type==="confirm"?false:null)});
const ask=(msg,def,opts)=>openDialog({type:"prompt",msg,def:def===undefined||def===null?"":String(def),...(opts||{})});
const okCancel=(msg,opts)=>openDialog({type:"confirm",msg,...(opts||{})});
const notice=(msg,opts)=>openDialog({type:"notice",msg,...(opts||{})});
function Dialogs(){
  const[q,setQ]=useState([]);
  const[val,setVal]=useState("");
  const inp=useRef(null);
  useEffect(()=>{dialogPush=d=>setQ(x=>[...x,d]);return()=>{dialogPush=null}},[]);
  const d=q[0];
  useEffect(()=>{if(d){setVal(d.def||"");setTimeout(()=>{if(inp.current){inp.current.focus();if(inp.current.select)inp.current.select()}},20)}},[d]);
  if(!d)return null;
  const close=v=>{d.res(v);setQ(x=>x.slice(1))};
  const ok=()=>close(d.type==="prompt"?val:d.type==="confirm"?true:undefined);
  const cancel=()=>close(d.type==="prompt"?null:d.type==="confirm"?false:undefined);
  const onKey=e=>{if(e.key==="Enter"){e.preventDefault();ok()}else if(e.key==="Escape"){e.preventDefault();cancel()}};
  return <div className="dlg-back" onMouseDown={e=>{if(e.target===e.currentTarget)cancel()}} onKeyDown={onKey}>
    <div className={"dlg "+d.type} role="dialog">
      {d.title&&<div className="dlg-t">{d.title}</div>}
      <div className="dlg-m">{d.msg}</div>
      {d.type==="prompt"&&<input ref={inp} className="dlg-in" value={val} onChange={e=>setVal(e.target.value)} placeholder={d.placeholder||""} inputMode={d.numeric?"decimal":undefined}/>}
      <div className="dlg-a">
        {d.type!=="notice"&&<button onClick={cancel}>{d.cancelLabel||"Cancel"}</button>}
        <button ref={d.type==="prompt"?null:inp} className={"pri "+(d.danger?"warn":"")} onClick={ok}>{d.okLabel||(d.type==="confirm"?"Yes":"OK")}</button>
      </div>
    </div>
  </div>;
}

/* ---------------- data: the local server, localStorage when it is off (src/data/sync.js) ---------------- */
// App plugs its handlers in when it mounts. The sync layer starts its network work only on App's first save, so a newer
// state from the server cannot arrive before App listens.
const syncOn={remote:null,status:null};
let syncStatus="ok"; // the newest status; start() reports one before App exists, App's first render reads it here
const sync=createSync({
  onRemoteState:s=>{if(syncOn.remote)syncOn.remote(s)},
  onStatus:s=>{syncStatus=s;if(syncOn.status)syncOn.status(s)}
});
const SERVER_OFF="Server off: changes are kept and saved when it is back";
const SRV_TEXT={offline:SERVER_OFF,retrying:SERVER_OFF,error:"Server error: changes are kept in this browser and saved when it is fixed",
  file:"Opened as a file: changes stay in this browser only. Open 64 OS with start.bat."}; // file:// never reaches os.json

/* ---------------- app ---------------- */
function App({init}){
  const[store,setStore]=useState(init.state);
  const[view,setView]=useState("today"); // the page: today, habits, insights, books, manage or settings (Shell)
  const[noise,setNoise]=useState(false); // the brown noise player (ui/Noise.jsx), kept here so it plays on every page
  const[saved,setSaved]=useState(false);
  const[now,setNow]=useState(Date.now());
  const[srv,setSrv]=useState(()=>syncStatus);
  // "Updated from another window" shows for 6 s after each conflict
  const[moved,setMoved]=useState(()=>syncStatus==="conflict"?1:0);
  useEffect(()=>{
    syncOn.remote=s=>setStore(s); // the server's newer state, already through ensureAll in sync.js
    syncOn.status=s=>{setSrv(s);if(s==="conflict")setMoved(n=>n+1)};
    return()=>{syncOn.remote=null;syncOn.status=null};
  },[]);
  useEffect(()=>{if(!moved)return;const t=setTimeout(()=>setMoved(0),6000);return()=>clearTimeout(t)},[moved]);
  const first=useRef(true);
  // the store only changes on real actions (never from the clock), so a running timer causes no saves
  useEffect(()=>{
    sync.save(store);
    if(first.current){first.current=false;return}
    setSaved(true);const t=setTimeout(()=>setSaved(false),900);return()=>clearTimeout(t);
  },[store]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
  useEffect(()=>{const hb=()=>{try{localStorage.setItem(HB_KEY,String(Date.now()))}catch(e){}};hb();const id=setInterval(hb,5000);
    window.addEventListener("beforeunload",hb);return()=>{clearInterval(id);window.removeEventListener("beforeunload",hb)}},[]);

  const up=useCallback(fn=>setStore(s=>{const c=JSON.parse(JSON.stringify(s));fn(c);return c}),[]);
  const row=(weeks,key,id)=>weeks[key]&&weeks[key][id]?weeks[key][id]:Array(7).fill(false);

  /* ---- timer engine ---- */
  const T=store.timer;
  const modeLen=(t)=>{const m=MODES[t.mode]||MODES.deep;const w=t.mode==="custom"?t.custom:m.w;return{w:w*60,r:m.r*60}};
  const phaseLen=(t)=>{const{w,r}=modeLen(t);return (t.phase==="rest"?r:w)+(t.ext||0)};
  const elapsedOf=(t,at)=>t.acc+(t.startedAt?(at-t.startedAt)/1000:0);
  const running=!!T.startedAt;
  const len=phaseLen(T);
  const elapsed=Math.min(elapsedOf(T,now),len>0?len:FREE_CAP);
  const remain=len>0?Math.max(0,len-elapsed):elapsed;

  // a habit's day is ticked once its minutes reach the target, unless it was unticked by hand today
  const autoTick=(s,id,dk)=>{
    const h=s.habits.find(x=>x.id===id);const di=todayIdx();
    if(h&&tgtOf(h,di)>0&&s.time[dk][id]>=tgtOf(h,di)*60&&!(s.noauto&&s.noauto[dk]&&s.noauto[dk][id])){
      const k=weekInfo(0).key;s.weeks[k]=s.weeks[k]||{};s.weeks[k][id]=s.weeks[k][id]||Array(7).fill(false);s.weeks[k][id][di]=true;
    }
  };
  // Log work seconds into today's time (a block that crossed midnight is split between the two days). Runs inside up().
  const logWork=(s,secs,endAt)=>{
    const t=s.timer;if(!t.hid||secs<=0)return;
    endAt=endAt||Date.now();
    const end=new Date(endAt);const mid=new Date(end);mid.setHours(0,0,0,0);
    const beforeMid=Math.min(secs,Math.max(0,(mid.getTime()-(endAt-secs*1000))/1000));
    if(beforeMid>0){const pk=dateKey(new Date(mid.getTime()-1));s.time[pk]=s.time[pk]||{};s.time[pk][t.hid]=(s.time[pk][t.hid]||0)+beforeMid;secs-=beforeMid}
    const dk=dateKey(end);s.time[dk]=s.time[dk]||{};s.time[dk][t.hid]=(s.time[dk][t.hid]||0)+secs;
    autoTick(s,t.hid,dk);
  };
  const flush=(s,at)=>{ // bring the log up to date for the current phase
    const t=s.timer;const L=phaseLen(t);
    const e=Math.min(elapsedOf(t,at),L>0?L:FREE_CAP);
    if(t.phase==="work"){logWork(s,e-t.logged,at);t.logged=e}
    return e;
  };
  // phase completion, checked every tick
  useEffect(()=>{
    if(!running)return;
    const t=T;const L=phaseLen(t);
    const e=elapsedOf(t,now);
    if(L>0&&e>=L){
      up(s=>{
        const tt=s.timer;const at=Date.now();flush(s,at);
        const{r}=modeLen(tt);
        if(tt.phase==="work"){
          tt.rounds=(tt.rounds||0)+1;
          if(r>0){tt.phase="rest";tt.acc=0;tt.logged=0;tt.ext=0;tt.startedAt=at}
          else{tt.phase="work";tt.acc=0;tt.logged=0;tt.ext=0;tt.startedAt=null}
        }else{tt.phase="work";tt.acc=0;tt.logged=0;tt.ext=0;tt.startedAt=null}
      });
      const h=store.habits.find(x=>x.id===t.hid);
      if(t.phase==="work"){beep(3,880);notify("Block done"+(h?": "+h.name:""),modeLen(t).r>0?"The break starts now.":"Logged.")}
      else{beep(2,660);notify("Break over","Press Start for the next round.")}
    }else if(L===0&&e>=FREE_CAP){
      up(s=>{const tt=s.timer;flush(s,Date.now());tt.startedAt=null;tt.acc=FREE_CAP;tt.logged=FREE_CAP});
    }
  },[now,running]);
  // tab title = the running clock
  useEffect(()=>{
    if(!running){document.title="64 OS";return}
    const h=store.habits.find(x=>x.id===T.hid);
    document.title=(len>0?mm(remain):hmm(elapsed))+(T.phase==="rest"?" break":"")+(h?" · "+shortName(h.name):"");
  },[now,running]);

  const startPause=()=>up(s=>{const t=s.timer;const at=Date.now();
    if(t.startedAt){const e=flush(s,at);t.acc=e;t.startedAt=null}
    else{if(t.phase==="work"&&phaseLen(t)>0&&t.acc>=phaseLen(t)){t.acc=0;t.logged=0}t.startedAt=at}
  });
  const skipPhase=()=>up(s=>{const t=s.timer;flush(s,Date.now());
    if(t.phase==="work"){t.rounds=(t.rounds||0)+1;const{r}=modeLen(t);if(r>0){t.phase="rest";t.acc=0;t.logged=0;t.ext=0;t.startedAt=Date.now()}else{t.acc=0;t.logged=0;t.ext=0;t.startedAt=null}}
    else{t.phase="work";t.acc=0;t.logged=0;t.ext=0;t.startedAt=null}});
  const setMode=async m=>{
    let custom=null;
    if(m==="custom"){const v=parseFloat(await ask("Custom block length in minutes",T.custom,{title:"Custom timer",numeric:true}));if(!v||v<=0)return;custom=v}
    up(s=>{const t=s.timer;flush(s,Date.now());if(custom)t.custom=custom;t.mode=m;t.phase="work";t.acc=0;t.logged=0;t.ext=0;t.startedAt=null});
  };
  // clicking a habit card (or pressing its number) only selects it; Start, Space or a click on the ring starts it.
  // Picking another habit while one runs logs the time done so far and leaves the new one paused.
  const pickHabit=hid=>up(s=>{const t=s.timer;if(t.hid===hid)return;
    flush(s,Date.now());t.startedAt=null;
    const h=s.habits.find(x=>x.id===hid);t.hid=hid;t.mode=(h&&h.md&&MODES[h.md])?h.md:"deep";t.phase="work";t.acc=0;t.logged=0;t.ext=0;t.rounds=0;
  });
  // keys on every page but Settings and Manage (they have text fields): Space start / pause; on Today 1 to 9 pick a habit, F fullscreen
  useEffect(()=>{
    const f=e=>{
      if(/input|textarea|select/i.test(e.target.tagName)||document.querySelector(".dlg-back,.mo-back"))return;
      if(e.code==="Space"&&!/button/i.test(e.target.tagName)&&view!=="settings"&&view!=="manage"){e.preventDefault();startPause();return}
      if(view!=="today")return;
      if(/^Digit[1-9]$/.test(e.code)){const ti=todayIdx();const list=store.habits.filter(h=>!isOff(h,ti)&&tgtOf(h,ti)>0);const h=list[parseInt(e.code.slice(5))-1];if(h){e.preventDefault();pickHabit(h.id)}}
      if(e.code==="KeyF"){e.preventDefault();fullscreen()}
    };
    window.addEventListener("keydown",f);return()=>window.removeEventListener("keydown",f);
  },[view,T.startedAt,T.acc,T.phase,T.mode,store.habits]);

  /* ---- derived ---- */
  const wk=weekInfo(0);const wdates=weekDates(wk.monday);const tdk=dateKey();
  const liveSecs=(hid)=>{ // today's logged seconds plus the unflushed part of a running work phase
    let s=secsOf(store.time,tdk,hid);
    if(T.hid===hid&&T.phase==="work"){const L=phaseLen(T);const e=Math.min(elapsedOf(T,now),L>0?L:FREE_CAP);s+=Math.max(0,e-T.logged)}
    return s;
  };
  const stats=useMemo(()=>{
    const{key}=weekInfo(0);const ti=todayIdx();
    let weekDone=0,weekTotal=0;store.habits.forEach(h=>{const r=row(store.weeks,key,h.id);for(let di=0;di<=ti;di++){if(!isScheduled(h,wdates[di]))continue;weekTotal++;if(r[di])weekDone++}});
    const habitStreaks={};store.habits.forEach(h=>{habitStreaks[h.id]=currentStreak(store,h,tdk)});
    return{weekDone,weekTotal,streak:dayStreak(store,tdk),habitStreaks};
  },[store,tdk]);
  const focusToday=store.habits.reduce((a,h)=>a+liveSecs(h.id),0);
  const weekTime=useMemo(()=>{const o={};store.habits.forEach(h=>{o[h.id]=wdates.reduce((a,dk)=>a+secsOf(store.time,dk,h.id),0)});return o},[store.time,store.habits,wk.key]);

  /* ---- actions ---- */
  const toggle=(key,id,di)=>{
    if(weekDates(mondayFromKey(key))[di]>dateKey())return; // a day that has not happened cannot be ticked, from any grid
    up(s=>{
      if(!s.weeks[key])s.weeks[key]={};
      if(!s.weeks[key][id])s.weeks[key][id]=Array(7).fill(false);
      const v=!s.weeks[key][id][di];s.weeks[key][id][di]=v;
      // a manual untick today means "not done", whatever the minutes say: block the auto-tick for the rest of the day
      if(key===weekInfo(0).key&&di===todayIdx()){s.noauto=s.noauto||{};const dk=dateKey();s.noauto[dk]=s.noauto[dk]||{};if(v)delete s.noauto[dk][id];else s.noauto[dk][id]=true}
    });
  };
  const addMinutes=async id=>{const v=parseFloat(await ask("Minutes to add to today (work done away from the timer)","30",{title:"Add minutes",numeric:true}));if(!v)return;
    up(s=>{const dk=dateKey();s.time[dk]=s.time[dk]||{};s.time[dk][id]=Math.max(0,(s.time[dk][id]||0)+v*60);autoTick(s,id,dk)})};
  const setMindAct=v=>up(s=>setMind(s,dateKey(),v));
  const setMindNoteAct=note=>up(s=>setMindNote(s,dateKey(),note));
  const backup=()=>{
    const blob=new Blob([JSON.stringify(store,null,1)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download="64os-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();
  };
  const restore=()=>{
    const inp=document.createElement("input");inp.type="file";inp.accept=".json";
    inp.onchange=()=>{const f=inp.files[0];if(!f)return;const r=new FileReader();
      r.onload=async ()=>{let d;try{d=JSON.parse(r.result);if(!d||!Array.isArray(d.habits)||!d.weeks||typeof d.weeks!=="object")throw 0}catch(e){notice("Not a valid 64 OS backup.");return}
        if(!await okCancel("Replace all data with this backup? It has "+d.habits.length+" habits and "+Object.keys(d.weeks).length+" weeks of ticks.",{title:"Restore",okLabel:"Replace",cancelLabel:"Cancel",danger:true}))return;
        let next;try{next=ensureAll(d)}catch(e){notice("This file cannot be read by this version of the app. Nothing was changed.");return}
        sync.keepAside(store); // the state being replaced is kept in the browser (os64dropped), just in case
        setStore(next)};
      r.readAsText(f)};
    inp.click();
  };
  // a week as markdown on the clipboard: ticks, focus minutes and the mindset check-ins
  const exportWeekMd=key=>{
    const monday=mondayFromKey(key);const sunday=new Date(monday);sunday.setDate(sunday.getDate()+6);
    const wd=weekDates(monday);
    let md=`# Week ${key} (Mon ${fmt(monday)} to Sun ${fmt(sunday)})\n\n| Habit | Mon | Tue | Wed | Thu | Fri | Sat | Sun |\n|---|---|---|---|---|---|---|---|\n`;
    store.habits.forEach(h=>{md+=`| ${h.ico} ${h.name} | `+row(store.weeks,key,h.id).map((v,di)=>v?"✅":!isScheduled(h,wd[di])?"-":"☐").join(" | ")+" |\n"});
    const fullDays=[0,1,2,3,4,5,6].filter(di=>wd[di]>=startOf(store)&&store.habits.some(h=>isScheduled(h,wd[di]))&&store.habits.every(h=>!isScheduled(h,wd[di])||row(store.weeks,key,h.id)[di])).length;
    md+=`\n✅ done · ☐ missed · - not planned that day\n\n## Focus minutes\n\n| Habit | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Week |\n|---|---|---|---|---|---|---|---|---|\n`;
    let totalH=0;
    store.habits.forEach(h=>{const secs=wd.map(dk=>secsOf(store.time,dk,h.id));const sum=secs.reduce((a,b)=>a+b,0);if(!sum)return;totalH+=sum/3600;
      md+=`| ${h.name} | `+secs.map(s=>s?Math.round(s/60):"·").join(" | ")+` | ${(sum/3600).toFixed(1)}h |\n`});
    md+=`\nAll focus time: ${totalH.toFixed(1)}h.\n\n## Mindset (1 to 5)\n\n${mindLine(store,wd)}\n${mindNotes(store,wd).map(n=>"- "+n.label+": "+n.note+"\n").join("")}\n## Week summary\n\n- Days fully complete: ${fullDays}/7\n- What worked:\n- What broke:\n`;
    navigator.clipboard?.writeText(md);
  };
  const fullscreen=()=>{try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}catch(x){}};
  const selHabit=store.habits.find(h=>h.id===T.hid);
  const srvText=SRV_TEXT[srv]||(moved?"Updated from another window":"");

  const clock=(()=>{const d=new Date(now);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")})();
  // the running timer sits in the top bar on every page but Today, where the ring is the timer
  const mini=view!=="today"&&(running||T.acc>0||selHabit)?<button type="button" className={"mini "+(running?(T.phase==="rest"?"rest":"run"):"")} onClick={()=>setView("today")} title="Open Today">
    <span className="mt num">{len>0?mm(remain):hmm(elapsed)}</span>
    <span className="mh">{running?(T.phase==="rest"?"break":"focus"):"paused"}{selHabit?" · "+shortName(selHabit.name):""}</span>
  </button>:null;
  const banner=srvText?<div className={"srv-banner "+(srv==="error"?"err":SRV_TEXT[srv]?"off":"moved")} role="status">{srvText}</div>:null;

  return <Shell page={view} setPage={setView} clock={clock} mini={mini} saved={saved} banner={banner}>
      {view==="today"&&<Today store={store} T={T} running={running} len={len} elapsed={elapsed} remain={remain} startPause={startPause} skipPhase={skipPhase}
          setMode={setMode} pickHabit={pickHabit} liveSecs={liveSecs} toggle={toggle} addMinutes={addMinutes} wkKey={wk.key}
          stats={stats} focusToday={focusToday} now={now} rowFn={row} setMindAct={setMindAct} setMindNoteAct={setMindNoteAct}
          noise={noise} toggleNoise={()=>setNoise(x=>!x)} goManage={()=>setView("manage")}/>}
      {view==="habits"&&<Habits store={store} toggle={toggle} exportWeekMd={exportWeekMd} now={now} goManage={()=>setView("manage")}/>}
      {view==="insights"&&<Insights store={store} weekTime={weekTime} exportWeekMd={exportWeekMd} todayIso={tdk}/>}
      {view==="books"&&<Books store={store} up={up} ask={ask}/>}
      {view==="manage"&&<Manage store={store} up={up} okCancel={okCancel}/>}
      {view==="settings"&&<Settings srv={srv} backup={backup} restore={restore} fullscreen={fullscreen} habitsN={store.habits.length}/>}
      <NoisePlayer on={noise} close={()=>setNoise(false)}/>
    </Shell>;
}
// the page stays dark and empty until the data is there: from the server, or after at most 1.5 s the local copy
const root=createRoot(document.getElementById("root"));
sync.start().then(init=>root.render(<><App init={init}/><Dialogs/></>));
