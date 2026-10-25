// Text formatters for clocks, durations and habit names. No imports.
export const mm=s=>{s=Math.max(0,Math.round(s));const m=Math.floor(s/60),ss=s%60;return String(m).padStart(2,"0")+":"+String(ss).padStart(2,"0")};
export const hm=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?h+"h "+String(m).padStart(2,"0")+"m":m+"m"};
// a planned target in minutes as "6h 30m", "2h" or "45m"
export const fmtTgt=m=>{m=Math.round(m);const h=Math.floor(m/60),r=m%60;return h?(r?h+"h "+r+"m":h+"h"):r+"m"};
// a habit name without a bracket note ("Reading [30 min]" becomes "Reading")
export const shortName=n=>n.replace(/\s*\[.*?\]\s*/g,"");
// a running stopwatch as "1:05:30" or "5:30"
export const hmm=s=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=Math.floor(s%60);return (h?String(h)+":":"")+String(m).padStart(h?2:1,"0")+":"+String(ss).padStart(2,"0")};
