// Brown noise next to the timer: "Academic Brown | 8 hr | Brown Noise: A Sonic Wellness Journey",
// YouTube video 0GDfOAuUvQ0 (https://www.youtube.com/watch?v=0GDfOAuUvQ0), embedded, never downloaded. While it plays the player sits as a small card in the corner,
// since YouTube's embed rules want the player visible; it lives at the app level, so the noise goes on across pages.
// It needs the internet, and YouTube refuses to embed into a page opened as a file, so the button is hidden there.
import React from "react";

const ID="0GDfOAuUvQ0";
const SRC="https://www.youtube-nocookie.com/embed/"+ID+"?autoplay=1&loop=1&playlist="+ID+"&rel=0&modestbranding=1";
export const noiseAvailable=()=>typeof location!=="undefined"&&location.protocol!=="file:";

const WavesIcon=()=><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
  <path d="M3 10v4"/><path d="M7 7v10"/><path d="M11 4v16"/><path d="M15 8v8"/><path d="M19 10v4"/></svg>;

export function NoiseButton({on,toggle}){
  if(!noiseAvailable())return null;
  const label=on?"Stop the brown noise":"Play brown noise";
  return <button className={"nz-b"+(on?" on":"")} onClick={toggle} title={label} aria-label={label}><WavesIcon/></button>;
}

export function NoisePlayer({on,close}){
  if(!on)return null;
  return <div className="nz-dock" role="region" aria-label="Brown noise player">
    <div className="nz-h"><span>Brown noise</span><button onClick={close} aria-label="Stop the brown noise">×</button></div>
    <iframe src={SRC} title="Academic Brown, 8 hr brown noise" allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>
  </div>;
}
