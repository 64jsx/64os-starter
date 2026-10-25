// The app in a real browser against a real server with a fresh data folder: the empty start, adding habits by hand,
// the timer, ticking, the pages, the media buttons and the saved file. Run from src/tests:  node smoke.test.mjs
import {launch} from "./browser.mjs";
import {startServer} from "../../server.mjs";
import {mkdtempSync,readFileSync,rmSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";

let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?"  ok  ":"  FAIL ")+m)};
const dir=mkdtempSync(join(tmpdir(),"os64-smoke-"));
const srv=await startServer({port:0,dataDir:dir});const url="http://127.0.0.1:"+srv.port+"/";
const b=await launch();const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));
const saved=()=>{try{return JSON.parse(readFileSync(join(dir,"os.json"),"utf8")).state}catch(e){return null}};
const until=async(f,ms=3000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await f();if(v)return v;await p.waitForTimeout(50)}return null};

console.log("1. the first start is empty and points to Manage");
await p.goto(url);await p.waitForSelector(".fv-dial");
ok((await p.locator(".t-empty").count())===1&&(await p.locator(".fv-row").count())===0,"no habits, no cards, an empty state");
ok((await p.locator(".pills .pill").allInnerTexts()).map(t=>t.trim()).join("|")==="Today|Habits|Insights|Books","the pills: Today, Habits, Insights, Books");

console.log("2. habits are added by hand");
await p.click(".t-empty button");await p.waitForSelector(".manage-page");
const add=async(ico,name,min,off)=>{await p.fill(".mg-new .mg-ico",ico);await p.fill(".mg-new .mg-name",name);await p.fill(".mg-new .mg-min input",String(min));
  for(const d of off)await p.locator(".mg-new .mg-day",{hasText:d}).click();await p.click(".mg-add")};
await add("📚","Study",45,[]);await add("💧","Water",0,["Sat","Sun"]);
const s1=await until(()=>{const s=saved();return s&&s.habits.length===2?s:null});
ok(!!s1&&s1.habits[0].name==="Study"&&s1.habits[0].tgt===45&&s1.habits[1].tgt===0&&JSON.stringify(s1.habits[1].off)==="[5,6]","both habits are in data/os.json with their minutes and days off");
await p.locator(".mg-habit").first().locator(".mg-name").fill("Deep study");await p.locator(".mg-habit").first().locator(".mg-min input").click();
ok(!!(await until(()=>{const s=saved();return s&&s.habits[0].name==="Deep study"})),"a name changed in place is saved");
await p.locator(".mg-habit").nth(1).locator("button[aria-label^='Move']").first().click();
ok(!!(await until(()=>{const s=saved();return s&&s.habits[0].name==="Water"})),"the arrows change the order");

console.log("3. Today: select, start, tick");
await p.click(".pills .pill:has-text('Today')");await p.waitForSelector(".fv-list");
const studyRow=p.locator(".fv-row",{hasText:"Deep study"});
await studyRow.click();
ok(/paused/i.test(await p.locator(".fv-dial .lbl").innerText()),"a click on a card selects it and waits");
await p.locator(".fv-ctl .big").click();await p.waitForTimeout(1200);
ok(/focus/i.test(await p.locator(".fv-dial .lbl").innerText())&&(await p.locator(".fv-row.live").count())===1,"Start starts the timer");
await p.locator(".fv-ctl .big").click();
const water=p.locator(".fv-row",{hasText:"Water"});
const weekend=[5,6].includes((new Date().getDay()+6)%7);
if(!weekend){await water.locator(".tk").click();ok(!!(await until(()=>{const s=saved();return s&&Object.values(s.weeks).some(w=>w[s.habits[0].id]&&w[s.habits[0].id].includes(true))})),"a tick is saved")}
else ok((await water.count())===0,"a habit off today has no card today");
ok((await p.locator(".t-week .tw-row").count())===2,"This week lists both habits");

console.log("4. the other pages open");
for(const [pill,sel] of [["Habits","table.mgrid"],["Insights",".ins-page"],["Books",".books-page"]]){await p.click(".pills .pill:has-text('"+pill+"')");ok(!!(await p.waitForSelector(sel,{timeout:3000}).catch(()=>null)),pill+" opens")}
await p.click(".gear");await p.click(".gear-menu [role=menuitem]:has-text('Settings')");
ok((await p.locator("main button:has-text('Backup')").count())===1,"Settings has Backup");

console.log("5. the clips and the brown noise sit next to Start");
await p.click(".pills .pill:has-text('Today')");await p.waitForSelector(".fv-ctl .mo-b");
ok((await p.locator(".fv-ctl .mo-b").count())===2&&(await p.locator(".fv-ctl .nz-b").count())===1,"audio, video and brown noise buttons");
await p.locator(".mo-b[aria-label='Watch the video']").click();
ok(!!(await p.waitForSelector(".mo-back video",{timeout:3000}).catch(()=>null)),"the video opens in a pop-up");
await p.keyboard.press("Escape");
ok(!!(await until(async()=>(await p.locator(".mo-back").count())===0)),"Esc closes it");

console.log("6. a deleted habit leaves the pages, its data stays");
await p.click(".gear");await p.click(".gear-menu [role=menuitem]:has-text('Manage habits')");await p.waitForSelector(".mg-habit");
await p.locator(".mg-habit").first().locator("button:has-text('Delete')").click();await p.click(".dlg-a button:has-text('Delete')");
ok(!!(await until(()=>{const s=saved();return s&&s.habits.length===1})),"one habit left after Delete");

ok(errs.length===0,"no page errors"+(errs.length?": "+errs.join(" | "):""));
console.log(pass+" passed, "+fail+" failed");
await b.close();await srv.close();rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});
process.exit(fail?1:0);
