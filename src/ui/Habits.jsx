/* ---------------- Habits: the month at a glance ----------------
   Daily: the completion line of the month and the grid (one row per habit, one column per day). Weekly: each Monday-start
   week that touches the month, with the "Copy .md" export. Monthly: done over planned days and hours.
   The numbers come from engine/stats.js; ticking goes through App's toggle. */
import React,{useState,useMemo} from "react";
import {DAYS,isoToday,keyOfDate,secsOf} from "../engine/dates.js";
import {fmtTgt,shortName} from "../engine/format.js";
import {monthDays,cellState,habitMonthPct,currentStreak,bestStreakInMonth,dailyTrend,weekColumns,tally,focusSecs,isScheduled,isDone} from "../engine/stats.js";
import {dotOf} from "./dots.js";
import {Flame} from "./Today.jsx";

const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const dateOf=iso=>new Date(iso+"T12:00:00");
const hours=s=>s>=3600?(s/3600).toFixed(1).replace(/\.0$/,"")+"h":s>0?Math.round(s/60)+"m":"·";

function Trend({points,days}){
  const W=1000,H=150,P=24;
  if(!points.length)return <div className="trend empty dim">No days in this month yet.</div>;
  const x=i=>P+i*((W-P*2)/Math.max(1,days.length-1));
  const y=p=>H-P-(p/100)*(H-P*2);
  const idx=iso=>days.indexOf(iso);
  const path=points.map((p,i)=>(i?"L":"M")+x(idx(p.iso)).toFixed(1)+","+y(p.pct).toFixed(1)).join(" ");
  const area=path+" L"+x(idx(points[points.length-1].iso)).toFixed(1)+","+(H-P)+" L"+x(idx(points[0].iso)).toFixed(1)+","+(H-P)+" Z";
  const avg=Math.round(points.reduce((a,p)=>a+p.pct,0)/points.length);
  return <div className="trend">
    <div className="trend-h"><span className="k">Daily completion</span><span className="avg">month average <b className="num">{avg}%</b></span></div>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={"Daily completion, month average "+avg+"%"}>
      <defs><linearGradient id="tg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".28"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
      {[0,50,100].map(p=><line key={p} x1={P} x2={W-P} y1={y(p)} y2={y(p)} className="gl"/>)}
      <line x1={P} x2={W-P} y1={y(avg)} y2={y(avg)} className="avgl"/>
      <path d={area} fill="url(#tg)"/>
      <path d={path} className="ln"/>
      {points.map(p=><circle key={p.iso} cx={x(idx(p.iso))} cy={y(p.pct)} r="3.5" className="pt"><title>{p.iso}: {p.pct}%</title></circle>)}
    </svg>
  </div>;
}

export function Habits({store,toggle,exportWeekMd,now,goManage}){
  const today=isoToday();
  const[ym,setYm]=useState(()=>({y:+today.slice(0,4),m:+today.slice(5,7)}));
  const[tab,setTab]=useState("daily");
  const[copied,setCopied]=useState("");
  const shift=n=>setYm(({y,m})=>{const t=new Date(y,m-1+n,1);return{y:t.getFullYear(),m:t.getMonth()+1}});
  const days=useMemo(()=>monthDays(ym.y,ym.m),[ym.y,ym.m]);
  const weeks=useMemo(()=>weekColumns(ym.y,ym.m),[ym.y,ym.m]);
  const hs=store.habits;
  const todaySched=hs.filter(h=>isScheduled(h,today));
  const todayDone=todaySched.filter(h=>isDone(store,h,today)).length;
  const trend=useMemo(()=>dailyTrend(store,ym.y,ym.m,today),[store,ym.y,ym.m,today]);
  const thisMonth=ym.y===+today.slice(0,4)&&ym.m===+today.slice(5,7);
  const click=(h,iso,st)=>{if(st==="off"||st==="future")return;const d=dateOf(iso);toggle(keyOfDate(d),h.id,(d.getDay()+6)%7)};
  const copy=w=>{exportWeekMd(keyOfDate(dateOf(w.from)));setCopied(w.label);setTimeout(()=>setCopied(""),1500)};
  return <div className="habits-page">
    <div className="mhead">
      <div className="mh-l">
        <button className="arrow" onClick={()=>shift(-1)} aria-label="Previous month">‹</button>
        <h2 className="mtitle">{MONTHS[ym.m-1]} <span className="dim">{ym.y}</span></h2>
        <button className="arrow" onClick={()=>shift(1)} aria-label="Next month">›</button>
        {!thisMonth&&<button className="ghost" onClick={()=>setYm({y:+today.slice(0,4),m:+today.slice(5,7)})}>This month</button>}
      </div>
      <div className="mh-r"><b className="num">{todayDone}</b> / {todaySched.length} habits done today <button className="ghost" onClick={goManage}>Manage habits</button></div>
    </div>
    <div className="mline"><i style={{width:(todaySched.length?todayDone/todaySched.length*100:0)+"%"}}/></div>
    <div className="tabs" role="tablist" aria-label="Habit views">
      {[["daily","Daily"],["weekly","Weekly"],["monthly","Monthly"]].map(([id,l])=>
        <button key={id} role="tab" aria-selected={tab===id?"true":"false"} className={tab===id?"on":""} onClick={()=>setTab(id)}>{l}</button>)}
    </div>

    {tab==="daily"&&<div className="card-p">
      <Trend points={trend} days={days}/>
      <div className="mgrid-wrap"><table className="mgrid">
        <thead><tr><th className="hcol">Habit</th>
          {days.map(iso=>{const d=dateOf(iso);return <th key={iso} className={"dcol"+(iso===today?" today":"")+(d.getDay()===0||d.getDay()===6?" we":"")}>
            <span className="dw">{DAYS[(d.getDay()+6)%7].slice(0,2)}</span><span className="dn num">{d.getDate()}</span></th>})}
          <th className="scol">Month</th><th className="scol">Streak</th><th className="scol">Best</th></tr></thead>
        <tbody>{hs.map((h,hi)=>{const pct=habitMonthPct(store,h,ym.y,ym.m,today);
          return <tr key={h.id}>
            <td className="hcol"><span className="hname"><i className="dot" style={{background:dotOf(h,hi)}}/><span className="hn-t" title={h.name}>{shortName(h.name)}</span></span></td>
            {days.map(iso=>{const st=cellState(store,h,iso,today);const mins=Math.round(secsOf(store.time,iso,h.id)/60);
              return <td key={iso} className={"mc "+st+(iso===today?" today":"")} onClick={()=>click(h,iso,st)}
                title={iso+" · "+(st==="done"?"done":st==="missed"?(iso===today?"open":"missed"):st==="off"?"not scheduled":"later")+(mins?" · "+mins+" min logged":"")}>
                <span className="cb" aria-label={st}>{st==="done"?"✓":""}</span></td>})}
            <td className="scol num"><b>{pct}%</b></td>
            <td className="scol num">{(n=>(<span className={"sk"+(n?" on":"")}><Flame/>{n}</span>))(currentStreak(store,h,today))}</td>
            <td className="scol num dim">{bestStreakInMonth(store,h,ym.y,ym.m,today)}</td>
          </tr>})}</tbody>
      </table></div>
      <div className="hint">Click a day to tick or untick it. An empty cell is a day the habit was not planned (or before it was added); it never counts against you. Streaks count planned days done in a row; today counts once it is done.</div>
    </div>}

    {tab==="weekly"&&<div className="card-p">
      <div className="mgrid-wrap"><table className="wtable">
        <thead><tr><th className="hcol">Habit</th>{weeks.map(w=><th key={w.label} className={"wcol"+(today>=w.from&&today<=w.to?" today":"")}>
          <span className="wl">{w.label}</span><span className="wd dim">{w.from.slice(8)}.{w.from.slice(5,7)} to {w.to.slice(8)}.{w.to.slice(5,7)}</span>
          <button className="copy" onClick={()=>copy(w)} disabled={w.from>today} title="Copy this week as markdown">{copied===w.label?"Copied":"Copy .md"}</button></th>)}</tr></thead>
        <tbody>{hs.map((h,hi)=><tr key={h.id}>
          <td className="hcol"><span className="hname"><i className="dot" style={{background:dotOf(h,hi)}}/><span className="hn-t" title={h.name}>{shortName(h.name)}</span></span></td>
          {weeks.map(w=>{const t=tally(store,h,w.from,w.to,today);const s=focusSecs(store,h.id,w.from,w.to);
            return <td key={w.label} className="wc"><span className="wr num">{w.from>today?"·":<><b>{t.done}</b>/{t.sched}</>}</span><span className="wh num dim">{hours(s)}</span>
              <span className="wbar"><i style={{width:(t.sched?t.done/t.sched*100:0)+"%"}}/></span></td>})}
        </tr>)}</tbody>
      </table></div>
      <div className="hint">Done over planned days for each Monday-start week that touches the month, then focus time from the timers. "Copy .md" puts that week on the clipboard as a markdown table.</div>
    </div>}

    {tab==="monthly"&&<div className="card-p">
      <div className="mgrid-wrap"><table className="mtable">
        <thead><tr><th className="hcol">Habit</th><th>Done / scheduled</th><th>Share</th><th>Focus time</th><th>Best streak</th></tr></thead>
        <tbody>{hs.map((h,hi)=>{const t=tally(store,h,days[0],days[days.length-1],today);const s=focusSecs(store,h.id,days[0],days[days.length-1]);const pct=t.sched?Math.round(t.done/t.sched*100):0;
          return <tr key={h.id}>
            <td className="hcol"><span className="hname"><i className="dot" style={{background:dotOf(h,hi)}}/><span className="hn-t" title={h.name}>{shortName(h.name)}</span></span></td>
            <td className="num mdone"><b>{t.done}</b> / {t.sched}</td>
            <td><span className="mbar"><i style={{width:pct+"%"}}/></span><span className="num mp">{pct}%</span></td>
            <td className="num">{s?fmtTgt(s/60):"·"}</td>
            <td className="num dim">{bestStreakInMonth(store,h,ym.y,ym.m,today)}</td>
          </tr>})}</tbody>
      </table></div>
      <div className="hint">Planned days only, up to today; today counts once it is done.</div>
    </div>}
  </div>;
}
