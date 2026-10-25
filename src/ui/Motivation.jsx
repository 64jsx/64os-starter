// The motivation clips next to the timer. The speaker plays the audio (a second click stops it), the video button opens the
// video in a pop-up (Esc, the cross or a click outside closes it). The files are media/motivation.mp3 and
// media/motivation.mp4, served by the server; to use your own, replace the files (same names). A missing file hides its
// button, and a page opened as a file cannot reach them, so it shows neither.
import React,{useState,useEffect,useRef} from "react";

const SpeakerIcon=()=><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>;
const StopIcon=()=><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>;
const VideoIcon=()=><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <rect x="2.5" y="5.5" width="13" height="13" rx="2.5"/><path d="m15.5 10 6-3.5v11l-6-3.5z"/></svg>;

export function Motivation(){
  const[has,setHas]=useState({video:false,audio:false});
  const[playing,setPlaying]=useState(false);
  const[open,setOpen]=useState(false);
  const audio=useRef(null);
  useEffect(()=>{
    if(location.protocol==="file:")return;
    fetch("/api/media").then(r=>r.ok?r.json():null).then(d=>{if(d)setHas({video:!!d.video,audio:!!d.audio})}).catch(()=>{});
    return()=>{if(audio.current)audio.current.pause()};
  },[]);
  useEffect(()=>{
    if(!open)return;
    const esc=e=>{if(e.key==="Escape")setOpen(false)};
    window.addEventListener("keydown",esc);return()=>window.removeEventListener("keydown",esc);
  },[open]);
  const stopAudio=()=>{const a=audio.current;if(a){a.pause();a.currentTime=0}setPlaying(false)};
  const toggleAudio=()=>{
    if(playing){stopAudio();return}
    if(!audio.current){audio.current=new Audio("/media/motivation.mp3");audio.current.onended=()=>setPlaying(false)}
    audio.current.currentTime=0;
    audio.current.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false));
  };
  if(!has.video&&!has.audio)return null;
  return <>
    {has.audio&&<button className={"mo-b"+(playing?" on":"")} onClick={toggleAudio} title={playing?"Stop the quote":"Play the quote"} aria-label={playing?"Stop the quote":"Play the quote"}>{playing?<StopIcon/>:<SpeakerIcon/>}</button>}
    {has.video&&<button className="mo-b" onClick={()=>{stopAudio();setOpen(true)}} title="Watch the video" aria-label="Watch the video"><VideoIcon/></button>}
    {open&&<div className="mo-back" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <div className="mo-box" role="dialog" aria-label="Motivation video">
        <video src="/media/motivation.mp4" autoPlay controls playsInline onEnded={()=>setOpen(false)}/>
        <button className="mo-x" onClick={()=>setOpen(false)} aria-label="Close the video">×</button>
      </div>
    </div>}
  </>;
}
