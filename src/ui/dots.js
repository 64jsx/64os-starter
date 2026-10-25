// One colour dot per habit, the same on every page: the habit's place in the list picks the next colour.
const CYCLE=["var(--dot-blue)","var(--dot-orange)","var(--dot-purple)","var(--accent)","var(--success)"];
export const dotOf=(h,i)=>CYCLE[(i||0)%CYCLE.length];
