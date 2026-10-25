// Shared by the browser tests: where the built app is, and a browser to run it in (an installed Chrome, else the
// Chromium Playwright downloads with: npx playwright install chromium).
import {chromium} from "@playwright/test";
import {existsSync} from "fs";
import {join,dirname} from "path";
import {fileURLToPath,pathToFileURL} from "url";

export const htmlPath=join(dirname(fileURLToPath(import.meta.url)),"..","..","64os.html");
export const fileUrl=pathToFileURL(htmlPath).href;

export async function launch(){
  try{return await chromium.launch({channel:"chrome"})}catch(e){}
  try{return await chromium.launch()}catch(e){}
  // a Linux box may carry a Chromium for another Playwright version (PLAYWRIGHT_BROWSERS_PATH, /opt/pw-browsers): launch it by path
  const pw=process.env.PLAYWRIGHT_BROWSERS_PATH;
  for(const p of [...(pw?[join(pw,"chromium")]:[]),"/opt/pw-browsers/chromium","/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/opt/google/chrome/chrome","/usr/bin/chromium","/usr/bin/chromium-browser"])
    if(existsSync(p))return chromium.launch({executablePath:p});
  throw new Error("No Chrome or Chromium found. Run: cd src && npx playwright install chromium");
}
