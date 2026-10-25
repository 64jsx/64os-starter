/* ---------------- Today: the ring, today's habit cards and the mindset check-in ----------------
   The ring shows today's progress until a habit is picked or a timer runs; then it is the timer (time left, habit, phase,
   round). A click on a habit card only selects it; Start, Space or a click on the ring starts the clock.
   The class names fv-* are the hooks the test suite uses. */
import React,{useState,useEffect} from "react";
import {Motivation} from "./Motivation.jsx";
import {NoiseButton} from "./Noise.jsx";
import {MIND,mindOf} from "../engine/mind.js";
import {MODES,isOff,tgtOf} from "../engine/store.js";
import {DAYS,keyOfDate,dateKey,todayIdx,isoToday,startOf,weekDates,mondayFromKey} from "../engine/dates.js";
import {isScheduled} from "../engine/stats.js";
import {mm,hm,fmtTgt,hmm,shortName} from "../engine/format.js";
import {dotOf} from "./dots.js";

export const Flame=()=><svg className="flame" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 2c.6 3.2-1.2 5.1-2.8 6.9C7.6 10.7 6 12.4 6 15a6 6 0 0 0 12 0c0-2.3-1-4.1-2.2-5.4.1 1.5-.4 2.7-1.5 3.3.4-3.6-.9-7.6-2.3-10.9z"/></svg>;
export const Check=()=><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;

// the mindset check-in: one tap a day; the same tap clears it; a line can follow once a value is set
function MindCard({mind,todayIso,setMind,setNote}){
  const cur=mindOf({mind},todayIso);
  const curNote=cur?cur.note:"";
  const [note,setNoteText]=useState(curNote);
  useEffect(()=>{setNoteText(curNote)},[curNote,todayIso]);
  const commit=()=>{if(cur&&note!==cur.note)setNote(note)};
  return <div className="t-mind">
    <div className="k"><span>Mindset</span></div>
    <div className="mbs">{MIND.map((l,i)=><button key={i} type="button" className={"mb"+(cur&&cur.v===i+1?" on":"")} title={l} aria-pressed={cur&&cur.v===i+1?"true":"false"}
      onClick={e=>{setMind(i+1);e.currentTarget.blur()}}><b className="num">{i+1}</b><span>{l}</span></button>)}</div>
    {cur
      ?<><div className="m-now">Today: <b>{cur.v}</b> · {MIND[cur.v-1]}</div>
        <input className="m-note" value={note} onChange={e=>setNoteText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();e.currentTarget.blur()}}} placeholder="One line, optional" aria-label="A line about today"/></>
      :<div className="dim m-hint">How was your head today? One tap. The same tap again clears it.</div>}
  </div>;
}

// this week at a glance: every habit with its done days over its planned days so far
// a day before the habit was added, or a day off, is neutral: it is not a miss
function WeekCard({store,rowFn,wkKey}){
  const wd=weekDates(mondayFromKey(wkKey));const today=dateKey();
  return <div className="t-week">
    <div className="k">This week</div>
    {store.habits.map(h=>{const r=rowFn(store.weeks,wkKey,h.id);const planned=[0,1,2,3,4,5,6].filter(di=>wd[di]<=today&&isScheduled(h,wd[di]));
      const done=planned.filter(di=>r[di]).length;
      return <div key={h.id} className="tw-row"><span className="tw-n"><i className="dot" style={{background:dotOf(h,store.habits.indexOf(h))}}/>{shortName(h.name)}</span>
        <span className="tw-d">{DAYS.map((d,di)=><i key={di} className={"tw-c"+(!isScheduled(h,wd[di])?" off":r[di]?" on":wd[di]<today?" miss":"")} title={d}/>)}</span>
        <span className="tw-v num">{done}/{planned.length}</span></div>})}
  </div>;
}

export function Today({store,T,running,len,elapsed,remain,startPause,skipPhase,setMode,pickHabit,liveSecs,toggle,addMinutes,wkKey,stats,focusToday,now,rowFn,setMindAct,setMindNoteAct,noise,toggleNoise,goManage}){
  const ti=todayIdx();
  const d=new Date(now);
  const sched=store.habits.filter(h=>!isOff(h,ti));
  const rowOf=id=>rowFn(store.weeks,wkKey,id);
  const doneList=sched.filter(h=>rowOf(h.id)[ti]);
  const todo=sched.filter(h=>!rowOf(h.id)[ti]);
  const sel=store.habits.find(h=>h.id===T.hid);
  const y=new Date(d);y.setDate(y.getDate()-1);const yk=keyOfDate(y),yi=(y.getDay()+6)%7;
  const ySched=store.habits.filter(h=>isScheduled(h,dateKey(y)));
  const yDone=ySched.filter(h=>rowFn(store.weeks,yk,h.id)[yi]).length;
  const yKnown=dateKey(y)>=startOf(store); // days before the data started are not misses, they are unknown
  const dayFull=todo.length===0&&sched.length>0;
  // today's progress, the same numbers as the day bar: a done habit counts 1, an open one its share of today's minutes
  const part=h=>{if(rowOf(h.id)[ti])return 1;const tgt=tgtOf(h,ti);return tgt>0?Math.min(1,liveSecs(h.id)/(tgt*60)):0};
  const dayPct=sched.length?sched.reduce((a,h)=>a+part(h),0)/sched.length:0;
  const timerOn=running||!!sel||elapsed>0;
  const R=150,C=2*Math.PI*R;
  const frac=len>0?Math.min(1,elapsed/len):0;
  const dash=!timerOn?C*(1-dayPct):len>0?C*(1-frac):C*(1-((elapsed%60)/60));
  const label=T.phase==="rest"?"rest":running?"focus":sel?"paused":"today";
  const clockTxt=len>0?mm(remain):hmm(elapsed);
  const votes=doneList.length;
  const modeTxt=MODES[T.mode]?(T.mode==="custom"?T.custom+" min":MODES[T.mode].l):"";
  return <div className="fv t-page">
    <section className="t-hero">
      <div className={"fv-dial"+(timerOn?" timer":" day")+(T.phase==="rest"?" rest":"")+(!running&&sel?" paused":"")} onClick={startPause} title="Space: start / pause">
        <svg viewBox="0 0 320 320"><circle className="track" cx="160" cy="160" r={R}/><circle className="prog" cx="160" cy="160" r={R} strokeDasharray={C} strokeDashoffset={dash}/></svg>
        <div className="face">
          <div className={"lbl "+(T.phase==="rest"?"r":running?"w":"")}>{label}{T.rounds?" · round "+(T.rounds+(T.phase==="work"?1:0)):""}</div>
          {timerOn
            ?<div className="time">{clockTxt}</div>
            :<div className="pct num">{Math.round(dayPct*100)}<small>%</small></div>}
          {timerOn
            ?<div className="who">{sel?<><i className="dot" style={{background:dotOf(sel,store.habits.indexOf(sel))}}/>{shortName(sel.name)}<span className="dim"> · {modeTxt}</span></>:<span className="dim">open timer · {modeTxt}</span>}</div>
            :<div className="who idle"><span className="time">{clockTxt}</span><span className="dim">{modeTxt} · press Space or pick a habit</span></div>}
        </div>
      </div>
      <div className="t-info">
        <div className="fv-barrow">
          <span className={"fv-k big "+(dayFull?"g":"")}>{dayFull?"Day complete":<><b>{doneList.length}</b> / {sched.length} habits done</>}</span>
          <span className="fv-k"><Flame/><b>{stats.streak}</b> perfect {stats.streak===1?"day":"days"}</span>
          <span className="fv-k"><b>{hm(focusToday)}</b> focus today</span>
          <span className="fv-k dim">{Math.round(stats.weekDone/Math.max(1,stats.weekTotal)*100)}% this week</span>
        </div>
        <div className="fv-seg">{sched.map(h=>{const done=rowOf(h.id)[ti];const live=T.hid===h.id&&running;
          return <div key={h.id} className={"sg "+(done?"done":"")+(live?" live":"")} title={shortName(h.name)+(done?" · done":"")}><i style={{width:part(h)*100+"%"}}/></div>})}</div>
        <div className="fv-modes">{Object.keys(MODES).map(m=><button key={m} className={T.mode===m?"on":""} onClick={()=>setMode(m)}>{m==="custom"&&T.mode==="custom"?T.custom+" min":MODES[m].l}</button>)}</div>
        <div className="fv-ctl">
          <button className={"big "+(running?"stop":"go")} onClick={startPause}>{running?"Pause":elapsed>0?"Resume":"Start"}</button>
          {T.phase==="work"&&(running||elapsed>0)&&<button onClick={skipPhase} title="End the block now. Time worked is logged.">Finish</button>}
          {T.phase==="rest"&&<button onClick={skipPhase} title="End the break now. The next block waits for Start.">Skip break</button>}
          <Motivation/>
          <NoiseButton on={noise} toggle={toggleNoise}/>
        </div>
      </div>
    </section>

    <div className="t-body">
      <div className="fv-lh"><span>Today</span><span className="dim">{DAYS[ti]} · {sched.length} planned</span></div>
      <section className="t-cards">
        {store.habits.length===0
          ?<div className="t-empty"><b>No habits yet.</b><span className="dim">Add the habits you want to track: a name, how many minutes a day, and the days they are planned.</span>
            <button className="pri" onClick={goManage}>+ Add your first habit</button></div>
          :sched.length===0
          ?<div className="t-empty"><b>Nothing planned today.</b><span className="dim">Every habit has today as a day off. Change the days on the Manage page.</span></div>
          :<div className="fv-list">
          {[...todo,...doneList].map(h=>{
            const done=rowOf(h.id)[ti];const tgt=tgtOf(h,ti);const secs=liveSecs(h.id);const live=T.hid===h.id&&running;const isSel=T.hid===h.id;
            const idx=sched.filter(x=>tgtOf(x,ti)>0).indexOf(h);
            const streak=stats.habitStreaks[h.id]||0;
            return <div key={h.id} className={"fv-row "+(done?"done ":"")+(live?"live ":"")+(isSel?"sel ":"")} onClick={()=>{if(tgt===0){toggle(wkKey,h.id,ti);return}pickHabit(h.id)}}>
              <span className="tk" role="checkbox" aria-checked={done?"true":"false"} aria-label={"Tick "+shortName(h.name)} onClick={e=>{e.stopPropagation();toggle(wkKey,h.id,ti)}} title="Tick / untick"><Check/></span>
              <span className="nm">
                <span className="n"><i className="dot" style={{background:dotOf(h,store.habits.indexOf(h))}}/><span className="ico">{h.ico}</span><span className="nt">{shortName(h.name)}</span></span>
              </span>
              <span className="meta">
                <span className="mn num">{tgt>0?<><b>{fmtTgt(secs/60)}</b> / {fmtTgt(tgt)}<span className="pm" onClick={e=>{e.stopPropagation();addMinutes(h.id)}} title="Add minutes done away from the timer">+</span></>:done?"done":"tick"}</span>
                <span className={"sk"+(streak?" on":"")} title="Current streak, days"><Flame/>{streak}</span>
              </span>
              <span className="key">{idx>=0&&idx<9?idx+1:""}</span>
              <span className="pb"><i style={{width:(tgt>0?Math.min(100,secs/(tgt*60)*100):(done?100:0))+"%"}}/></span>
            </div>;})}
        </div>}
      </section>

      <aside className="t-side">
        <MindCard mind={store.mind||{}} todayIso={isoToday()} setMind={setMindAct} setNote={setMindNoteAct}/>
        {store.habits.length>0&&<WeekCard store={store} rowFn={rowFn} wkKey={wkKey}/>}
      </aside>
    </div>

    <div className="fv-foot">
      {dayFull?<div className="fv-msg g">Day complete. {votes} votes for who you are becoming.</div>
      :yKnown&&ySched.length>0&&yDone===0?<div className="fv-msg r">Yesterday was a miss. Never miss twice: one finished habit today keeps the chain.</div>
      :<div className="fv-msg">Every finished habit is a vote. {votes} today.</div>}
    </div>
  </div>;
}
