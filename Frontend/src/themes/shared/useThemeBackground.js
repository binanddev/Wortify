import { useEffect, useState } from 'react';
import { request } from '../../lib/core.js';
export function useThemeBackground(theme, userId) {
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const refresh=()=>setRevision(v=>v+1);window.addEventListener('background-changed',refresh);return()=>window.removeEventListener('background-changed',refresh);},[]);
 useEffect(()=>{
  const controller=new AbortController(),root=document.documentElement;
  root.dataset.hasBackground='false';root.style.setProperty('--site-bg-image','none');
  request(`/api/me/backgrounds/?interface=${theme}`,'GET',undefined,controller.signal).then(data=>{
   if(controller.signal.aborted)return;
   const url=data.images.find(image=>image.id===data.selected)?.url;
   root.dataset.hasBackground=String(Boolean(url));root.style.setProperty('--site-bg-image',url?`url(${JSON.stringify(url)})`:'none');
  }).catch(()=>{});
  return()=>controller.abort();
 },[theme,userId,revision]);
}
