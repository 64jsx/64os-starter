// Settings (gear): where the data lives, Backup and Restore, fullscreen. Restore asks before it replaces anything.
import React from "react";

const WHERE={ok:"Saved to data/os.json",conflict:"Saved to data/os.json",offline:"Offline, saved in this browser",retrying:"Offline, saved in this browser",
  error:"Server error, saved in this browser until it is fixed",file:"Opened as a file: changes stay in this browser only"};

export function Settings({srv,backup,restore,fullscreen,habitsN}){
  const live=srv==="ok"||srv==="conflict";
  return <div className="settings">
    <h2 className="ptitle">Settings</h2>
    <section className="scard">
      <div className="k">Data</div>
      <div className="srow"><span className={"sdot "+(live?"on":srv==="file"?"file":"off")}/><span className="sline">{WHERE[srv]||WHERE.offline}</span></div>
      <p className="sp dim">{live?"The local server writes every change to data/os.json on this PC, with a daily copy in data/backups (the last 30 days). Nothing is sent anywhere.":"Changes are kept in this browser. When the server runs again they are saved to data/os.json."}</p>
      <p className="sp dim">{habitsN} habits in the current data.</p>
    </section>
    <section className="scard">
      <div className="k">Backup and restore</div>
      <p className="sp dim">Backup downloads the whole state as one JSON file. Restore replaces everything with a backup file, after you confirm.</p>
      <div className="sbtns"><button className="pri" onClick={backup}>Backup</button><button onClick={restore}>Restore</button></div>
    </section>
    <section className="scard">
      <div className="k">Screen</div>
      <div className="sbtns"><button onClick={fullscreen}>Fullscreen</button><span className="dim">or press F on Today</span></div>
    </section>
  </div>;
}
