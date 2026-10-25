// Books: one row per book with its title, status, a progress bar and the page counter with minus and plus (store.books).
import React from "react";

const CYCLE={not:"prog",prog:"done",done:"not"};
const LABEL={done:["done","Done"],not:["not","Not started"],prog:["prog","In progress"]};

export function Books({store,up,ask}){
  const books=store.books||[];
  const cyc=i=>up(s=>{s.books[i].s=CYCLE[s.books[i].s]||"prog"});
  const pg=(i,n)=>up(s=>{const b=s.books[i];b.p=Math.max(0,b.p+n);
    if(b.tot&&b.p>=b.tot){b.p=b.tot;b.s="done"}else if(b.p>0&&b.s==="not")b.s="prog"});
  const exact=async i=>{const b=books[i];const v=await ask("Current page",b.p,{title:"Set page",numeric:true});if(v===null)return;
    up(s=>{const bb=s.books[i];bb.p=Math.max(0,parseInt(v)||0);if(bb.tot&&bb.p>=bb.tot){bb.p=bb.tot;bb.s="done"}else if(bb.p>0&&bb.s==="not")bb.s="prog"})};
  const edit=async i=>{const b=books[i];const t=await ask("Title",b.t,{title:"Edit book"});if(t===null)return;
    const tot=await ask("Total pages (0 if unknown)",b.tot,{title:"Edit book",numeric:true});
    up(s=>{s.books[i].t=t||b.t;s.books[i].tot=Math.max(0,parseInt(tot)||0)})};
  const add=async ()=>{const t=await ask("Book title","",{title:"Add book"});if(!t)return;
    const tot=parseInt(await ask("Total pages (0 if unknown)","0",{title:"Add book",numeric:true}))||0;
    up(s=>{s.books.push({t,s:"not",p:0,tot})})};
  return <div className="books-page">
    <div className="bk-head"><h2 className="ptitle">Books</h2><button className="bk-add" onClick={add}>+ Add</button></div>
    <div className="bk-list">
      {books.length===0&&<div className="dim bk-empty">No books yet. Press Add.</div>}
      {books.map((b,i)=>{
        const pct=b.tot>0?Math.min(100,Math.round(b.p/b.tot*100)):(b.s==="done"?100:0);
        const st=LABEL[b.s]||LABEL.prog;
        return <div key={i} className={"bk "+st[0]}>
          <div className="bk-row">
            <span className="bk-t" title="Click to rename" onClick={()=>edit(i)}>{b.t}</span>
            <span className={"bk-st "+st[0]} title="Click to change the status" onClick={()=>cyc(i)}>{st[1]}</span>
          </div>
          <div className="bk-bar"><i style={{width:pct+"%"}}/></div>
          <div className="bk-row bk-foot">
            <span className="bk-pg">
              <button className="bk-b" onClick={()=>pg(i,-5)} aria-label="5 pages back">&#8722;</button>
              <span className="bk-num num" title="Click to type the page" onClick={()=>exact(i)}>{b.p}{b.tot?" / "+b.tot:""} p.</span>
              <button className="bk-b" onClick={()=>pg(i,5)} aria-label="5 pages on">+</button>
            </span>
            <span className="bk-pct num">{pct}%</span>
          </div>
        </div>;})}
    </div>
    <div className="hint">Minus and plus move 5 pages. Click the number to type the exact page, the title to rename, the badge to change the status. A book ticks itself to Done when the pages reach the total.</div>
  </div>;
}
