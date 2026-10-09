import { useRef } from 'react';
export const SIDEBAR_MIN = 248;
export const SIDEBAR_MAX = 620; // Original width + 150%.
export const sidebarWidth = value => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, value));
export default function SidebarResize({ width, onChange, title }) {
 const drag=useRef(null);
 const finish=e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
 return <div className="xp-sidebar-resize" role="separator" aria-orientation="vertical" aria-label={`Resize ${title} navigation`} aria-valuemin={SIDEBAR_MIN} aria-valuemax={SIDEBAR_MAX} aria-valuenow={Math.round(width)} tabIndex={0}
 title="Drag to widen navigation. Double-click to reset."
 onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();drag.current={x:e.clientX,width};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{if(drag.current)onChange(sidebarWidth(drag.current.width+e.clientX-drag.current.x));}}
 onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{drag.current=null;}}
 onDoubleClick={()=>onChange(SIDEBAR_MIN)}
 onKeyDown={e=>{const next=e.key==='Home'?SIDEBAR_MIN:e.key==='End'?SIDEBAR_MAX:e.key==='ArrowLeft'?width-10:e.key==='ArrowRight'?width+10:null;if(next!==null){e.preventDefault();onChange(sidebarWidth(next));}}}
 />;
}
