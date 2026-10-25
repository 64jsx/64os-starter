/* ---------------- Manage: the habits, entered and changed by hand ----------------
   Add a habit with an icon, a name, minutes a day (0 = tick only), the days it is planned and the timer it starts in.
   Every field of an existing habit can be changed in place and is saved at once. A habit can move up or down (the order
   on Today) and be deleted; its ticks and minutes stay in the saved data. */
import React,{useState} from "react";
import {DAYS,dateKey} from "../engine/dates.js";
import {MODES} from "../engine/store.js";

const MODE_IDS=Object.keys(MODES).filter(m=>m!=="custom");
const EMPTY={ico:"✅",name:"",tgt:"30",off:[],md:"deep"};

// the seven day chips: a lit chip is a planned day; at least one day stays planned
function Days({off,set}){
  const flip=di=>{const next=off.includes(di)?off.filter(x=>x!==di):[...off,di].sort();if(next.length<7)set(next)};
  return <span className="mg-days" role="group" aria-label="Planned days">
    {DAYS.map((d,di)=><button key={d} type="button" className={"mg-day"+(off.includes(di)?"":" on")} aria-pressed={off.includes(di)?"false":"true"} onClick={()=>flip(di)}>{d}</button>)}
  </span>;
}
const minutesOf=v=>Math.max(0,Math.round(parseFloat(String(v).replace(",","."))||0));

export function Manage({store,up,okCancel}){
  const[draft,setDraft]=useState(EMPTY);
  const habits=store.habits;
  const edit=(id,f)=>up(s=>{const h=s.habits.find(x=>x.id===id);if(h)f(h)});
  const add=e=>{
    e.preventDefault();
    const name=draft.name.trim();if(!name)return;
    up(s=>{s.habits.push({id:"h"+s.nextId++,ico:(draft.ico||"✅").trim()||"✅",name,tgt:minutesOf(draft.tgt),off:[...draft.off],md:draft.md,since:dateKey()})});
    setDraft(EMPTY);
  };
  const move=(i,n)=>up(s=>{const j=i+n;if(j<0||j>=s.habits.length)return;const t=s.habits[i];s.habits[i]=s.habits[j];s.habits[j]=t});
  const del=async h=>{
    if(await okCancel(`Delete "${h.name}"? Its ticks and minutes stay in the saved data, but it leaves every page.`,{title:"Delete habit",okLabel:"Delete",danger:true}))
      up(s=>{s.habits=s.habits.filter(x=>x.id!==h.id);if(s.timer.hid===h.id){s.timer.hid=null;s.timer.startedAt=null;s.timer.acc=0;s.timer.logged=0}});
  };
  return <div className="manage-page">
    <h2 className="ptitle">Manage habits</h2>
    <p className="dim mg-sub">Everything here is yours to set. Minutes a day is the daily target: when the timer (or minutes you add by hand) reaches it, the habit ticks itself. 0 means tick only, with no timer. Lit days are the days the habit is planned; a day that is not lit never counts as a miss.</p>

    <form className="mg-card mg-new" onSubmit={add}>
      <div className="k">New habit</div>
      <div className="mg-row">
        <input className="mg-ico" value={draft.ico} onChange={e=>setDraft({...draft,ico:e.target.value})} aria-label="Icon" maxLength={4}/>
        <input className="mg-name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Name, e.g. Reading" aria-label="Name"/>
        <label className="mg-min"><input value={draft.tgt} onChange={e=>setDraft({...draft,tgt:e.target.value})} inputMode="numeric" aria-label="Minutes a day"/><span>min a day</span></label>
        <select value={draft.md} onChange={e=>setDraft({...draft,md:e.target.value})} aria-label="Timer">{MODE_IDS.map(m=><option key={m} value={m}>{MODES[m].l}</option>)}</select>
      </div>
      <div className="mg-row"><Days off={draft.off} set={off=>setDraft({...draft,off})}/><button className="pri mg-add" type="submit" disabled={!draft.name.trim()}>+ Add habit</button></div>
    </form>

    <div className="mg-card">
      <div className="k">Your habits ({habits.length})</div>
      {habits.length===0&&<div className="dim mg-empty">No habits yet. Add one above.</div>}
      {habits.map((h,i)=><div key={h.id} className="mg-habit">
        <div className="mg-row">
          <input className="mg-ico" defaultValue={h.ico} onBlur={e=>{const v=e.target.value.trim()||"✅";if(v!==h.ico)edit(h.id,x=>{x.ico=v})}} aria-label={"Icon of "+h.name} maxLength={4}/>
          <input className="mg-name" defaultValue={h.name} onBlur={e=>{const v=e.target.value.trim();if(v&&v!==h.name)edit(h.id,x=>{x.name=v});else e.target.value=h.name}} aria-label="Name"/>
          <label className="mg-min"><input defaultValue={Array.isArray(h.tgt)?h.tgt.join(","):h.tgt} inputMode="numeric" aria-label={"Minutes a day for "+h.name}
            onBlur={e=>{const v=minutesOf(e.target.value);if(v!==h.tgt)edit(h.id,x=>{x.tgt=v});e.target.value=String(v)}}/><span>min a day</span></label>
          <select value={h.md} onChange={e=>edit(h.id,x=>{x.md=e.target.value})} aria-label={"Timer for "+h.name}>{MODE_IDS.map(m=><option key={m} value={m}>{MODES[m].l}</option>)}</select>
        </div>
        <div className="mg-row">
          <Days off={h.off||[]} set={off=>edit(h.id,x=>{x.off=off})}/>
          <span className="mg-tools">
            <button type="button" onClick={()=>move(i,-1)} disabled={i===0} aria-label={"Move "+h.name+" up"}>↑</button>
            <button type="button" onClick={()=>move(i,1)} disabled={i===habits.length-1} aria-label={"Move "+h.name+" down"}>↓</button>
            <button type="button" className="warn" onClick={()=>del(h)}>Delete</button>
          </span>
        </div>
      </div>)}
    </div>
  </div>;
}
