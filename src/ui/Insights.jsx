/* ---------------- Insights: what the record says ----------------
   Three stat tiles (perfect days, the last 28 days, the mindset), this week's focus against the targets, the weeks of the
   record with Copy .md and the trend, and the daily chain. */
import React,{useState,useMemo} from "react";
import {isOff,tgtOf} from "../engine/store.js";
import {hm,fmtTgt,shortName} from "../engine/format.js";
import {dayStreak,bestDayStreak} from "../engine/stats.js";
import {weekSeries,weekdayPattern,windowStats,heatCells} from "../engine/insights.js";
import {mindStats} from "../engine/mind.js";
import {dateKey,startOf} from "../engine/dates.js";
import {dotOf} from "./dots.js";
import {Flame} from "./Today.jsx";

const dmy=iso=>iso?iso.slice(8,10)+"."+iso.slice(5,7):""; // "2026-10-11" becomes "11.10"
const wk=key=>key?"W"+key.slice(6):"";                     // "2026-W41" becomes "W41"
const plural=(n,one,many)=>n+" "+(n===1?one:many);
const addDays=(iso,n)=>{const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return dateKey(d)};

// the weekly trend: the share done as a line, the focus hours as bars, the current week in yellow; the last 16 weeks
function Trend({weeks}){
  const data=weeks.slice(-16);const W=760,H=140,P=24;
  if(!data.length)return null;
  const x=i=>P+i*((W-P*2)/Math.max(1,data.length-1));
  const y=p=>H-P-(p/100)*(H-P*2);
  const mx=Math.max(1,...data.map(d=>d.focus));
  const bar=d=>(d.focus/mx)*(H-P*2)*0.9;
  const path=data.map((d,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(d.pct).toFixed(1)).join(" ");
  return <svg className="trsvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly completion and focus hours">
    {[0,50,100].map(p=><g key={p}><line x1={P} x2={W-P} y1={y(p)} y2={y(p)} className="gl"/><text x="2" y={y(p)+3} className="gt">{p}%</text></g>)}
    {data.map((d,i)=><rect key={"b"+d.key} x={x(i)-7} width="14" y={H-P-bar(d)} height={bar(d)} className="fb" rx="2"><title>{d.key}: {hm(d.focus)} focus</title></rect>)}
    <path d={path} className="ln"/>
    {data.map((d,i)=><g key={d.key}><circle cx={x(i)} cy={y(d.pct)} r="3.5" className={"pt"+(d.current?" cur":"")}><title>{d.key}: {d.pct}% ({d.done}/{d.sched}), {hm(d.focus)} focus</title></circle>
      <text x={x(i)} y={H-6} className="gt" textAnchor="middle">{d.key.slice(5)}</text></g>)}
  </svg>;
}

// the daily chain: one square per day, 18 weeks, a column per week; days before the record and future days blank
function Heat({cells}){
  const weeks=[];for(let i=0;i<cells.length;i+=7)weeks.push(cells.slice(i,i+7));
  const col=c=>c.frac===0?"#1b1b1b":c.frac<0.34?"#123d38":c.frac<0.67?"#1a6b61":c.frac<1?"#22a596":"var(--accent)";
  return <svg className="hmsvg" viewBox={`0 0 ${weeks.length*13+26} 100`} role="img" aria-label="Daily chain, the last 18 weeks">
    {["Mon","Wed","Sun"].map((d,i)=><text key={d} x="0" y={[4,30,82][i]+8} className="hl">{d}</text>)}
    {weeks.map((w,wi)=>w.map((c,di)=><rect key={c.iso} x={26+wi*13} y={2+di*13} width="11" height="11" rx="2.5"
      className={"hc"+(c.known?"":c.future?" future":" unknown")} fill={c.known?col(c):undefined}>
      <title>{c.iso+(c.known?": "+c.done+"/"+c.n+" habits":c.future?"":": before the record")}</title></rect>))}
  </svg>;
}

export function Insights({store,weekTime,exportWeekMd,todayIso}){
  const [copied,setCopied]=useState("");
  const weeks=useMemo(()=>weekSeries(store,todayIso),[store,todayIso]);
  const win=useMemo(()=>windowStats(store,todayIso),[store,todayIso]);
  const pattern=useMemo(()=>weekdayPattern(store,todayIso),[store,todayIso]);
  const cells=useMemo(()=>heatCells(store,todayIso),[store,todayIso]);
  const mindFrom=addDays(todayIso,-27)<startOf(store)?startOf(store):addDays(todayIso,-27); // the mindset window includes today: the check-in happens during the day
  const ms=useMemo(()=>mindStats(store,mindFrom,todayIso),[store,mindFrom,todayIso]);
  const perfect=dayStreak(store,todayIso),perfectBest=bestDayStreak(store,todayIso);
  const cur=weeks[weeks.length-1];
  const weakDay=pattern.filter(d=>d.sched>0).reduce((a,b)=>!a||b.pct<a.pct?b:a,null);
  const rows=[...weeks].reverse();
  const copy=w=>{exportWeekMd(w.key);setCopied(w.key);setTimeout(()=>setCopied(""),1500)};
  return <div className="ins-page">
    <h2 className="ptitle">Insights</h2>
    <p className="ins-sub dim">Your record since {dmy(startOf(store))}.{startOf(store).slice(0,4)}.</p>

    <section className="ins-tiles">
      <div className="tile perfect"><div className="k">Perfect days</div>
        <div className="v"><Flame/><b className="num">{perfect}</b><small>in a row</small></div>
        <div className="n">best {perfectBest} · every scheduled habit done</div></div>
      <div className="tile window"><div className="k">Last 28 days</div>
        <div className="v"><b className="num">{win.pct}</b><small>% done</small></div>
        <div className="n">{plural(win.doubleMisses,"double miss","double misses")} · {plural(win.misses,"miss","misses")} · {plural(win.judged,"day judged","days judged")}</div>
        <div className="n">{win.weakest?<>weakest <b>{shortName(win.weakest.h.name)}</b> {win.weakest.pct}%</>:"too few days to name a weakest habit"}{weakDay?<> · weakest day <b>{weakDay.label}</b> {weakDay.pct}%</>:null}</div></div>
      <div className="tile mind"><div className="k">Mindset</div>
        <div className="v"><b className="num">{ms.avg!=null?ms.avg:"-"}</b><small>of 5 · {plural(ms.n,"day","days")} checked</small></div>
        <div className="n">{ms.best?<>best <b>{ms.best.label}</b> {ms.best.avg}{ms.worst&&ms.worst.di!==ms.best.di?<> · worst <b>{ms.worst.label}</b> {ms.worst.avg}</>:null}</>:"no check-ins in the last 28 days"}</div>
        {ms.lowDays.length>0&&<div className="n">low days: {ms.lowDays.slice(0,3).map(dmy).join(", ")}</div>}
        <div className="n dim">One tap a day on Today, 1 to 5, the last 28 days.</div></div>
    </section>

    <section className="ins-plan card-p">
      <div className="k">This week: focus vs plan</div>
      {store.habits.map(h=>{
        const target=[0,1,2,3,4,5,6].reduce((a,di)=>a+(isOff(h,di)?0:tgtOf(h,di)),0)*60;const v=weekTime[h.id]||0;
        if(!target&&!v)return null;
        const pct=target?Math.min(100,v/target*100):0;
        return <div key={h.id} className="tbar"><span className="n"><i className="dot" style={{background:dotOf(h,store.habits.indexOf(h))}}/>{shortName(h.name)}</span>
          <span className="bb"><i className={v>target&&target?"over":""} style={{width:pct+"%"}}/></span>
          <span className="v num">{hm(v)}{target?" / "+fmtTgt(target/60):""}</span></div>;})}
      <div className="hint">Hours logged by the timers this week against the minutes a day you set, over the planned days.</div>
    </section>

    <section className="ins-weeks card-p">
      <div className="k">Weeks</div>
      <Trend weeks={weeks}/>
      <div className="ins-rows">{rows.map(w=><div key={w.key} className={"arch"+(w.current?" now":"")}>
        <span className="ak">{w.key}{w.current&&<span className="tag">now</span>}<span className="ad dim num">{dmy(w.from)} to {dmy(w.to)}</span></span>
        <span className="abar"><i style={{width:w.pct+"%"}}/></span>
        <span className="apct num">{w.pct}%</span>
        <span className="a-ds dim num">{w.done}/{w.sched}</span>
        <span className="a-ff dim num">{w.perfectDays}/7 full</span>
        <span className="a-fo dim num">{hm(w.focus)} focus</span>
        <button onClick={()=>copy(w)}>{copied===w.key?"Copied":"Copy .md"}</button>
      </div>)}</div>
      <div className="hint">Done over planned days up to today; today counts once it is done. Full days are perfect days. "Copy .md" puts the week on the clipboard as markdown; a blank week stays in the list at 0.</div>
    </section>

    <section className="ins-heat card-p">
      <div className="k">Daily chain</div>
      <Heat cells={cells}/>
      <div className="hint">Never miss twice. One gray square is a rest; two is the start of a new habit of missing.</div>
    </section>
  </div>;
}
