// The frame around every page: brand on the left, the page pills in the middle, then the clock, the running timer when
// you are not on Today, and the gear menu with Manage habits and Settings. The data status strip sits right under the bar.
// Page ids: today, habits, insights, books, manage, settings.
import React,{useState,useEffect,useRef} from "react";

const PAGES=[["today","Today"],["habits","Habits"],["insights","Insights"],["books","Books"]];

const GearIcon=()=><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;

export function Shell({page,setPage,clock,mini,saved,banner,children}){
  const[open,setOpen]=useState(false);
  const wrap=useRef(null);
  // the menu closes on Escape and on any click outside it
  useEffect(()=>{
    if(!open)return;
    const away=e=>{if(wrap.current&&!wrap.current.contains(e.target))setOpen(false)};
    const esc=e=>{if(e.key==="Escape"){e.stopPropagation();setOpen(false)}};
    document.addEventListener("mousedown",away,true);document.addEventListener("keydown",esc,true);
    return()=>{document.removeEventListener("mousedown",away,true);document.removeEventListener("keydown",esc,true)};
  },[open]);
  // after a click the focus leaves the button, so Space goes back to the timer (start / pause) instead of pressing the button again;
  // a new page starts at its top (the pages differ in length, and the old scroll offset hid a title under the bar)
  const go=id=>{setOpen(false);setPage(id);try{window.scrollTo(0,0)}catch(e){}if(document.activeElement&&document.activeElement.blur)document.activeElement.blur()};
  return <div className="app" data-page={page}>
    <div className="topwrap"><header className="topbar">
      <div className="brand" onClick={()=>go("today")} title="Today"><span className="logo" aria-hidden="true"/>64 OS</div>
      <nav className="pills" aria-label="Pages">
        {PAGES.map(([id,label,soon])=>soon
          ?<span key={id} className="pill soon" aria-disabled="true" title={label+" comes in a later part"}><span className="pill-name">{label}</span><span className="soon-tag">soon</span></span>
          :<button key={id} type="button" className={"pill"+(page===id?" on":"")} aria-current={page===id?"page":undefined} onClick={()=>go(id)}><span className="pill-name">{label}</span></button>)}
      </nav>
      <div className="tright">
        {mini}
        <span className={"autosave"+(saved?" show":"")} aria-hidden={!saved}>saved</span>
        <span className="tclock num">{clock}</span>
        <div className="gear-wrap" ref={wrap}>
          <button type="button" className={"gear"+(page==="settings"||page==="manage"?" on":"")} aria-haspopup="menu" aria-expanded={open?"true":"false"}
            aria-label="Manage habits and Settings" title="Manage habits and Settings" onClick={()=>setOpen(o=>!o)}><GearIcon/></button>
          {open&&<div className="gear-menu" role="menu">
            <button type="button" role="menuitem" className={page==="manage"?"on":""} onClick={()=>go("manage")}>Manage habits</button>
            <button type="button" role="menuitem" className={page==="settings"?"on":""} onClick={()=>go("settings")}>Settings</button>
          </div>}
        </div>
      </div>
    </header>{banner}</div>
    <main className="main" data-page={page}>{children}</main>
  </div>;
}
