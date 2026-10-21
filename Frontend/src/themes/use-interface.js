import {useSyncExternalStore} from "react";
import {interfaceName} from "./registry.js";
const listeners=new Set();
let observer;
function subscribe(listener){
  listeners.add(listener);
  if(!observer&&typeof document!=="undefined"){
    observer=new MutationObserver(()=>listeners.forEach(notify=>notify()));
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-interface"]});
  }
  return ()=>{listeners.delete(listener);if(!listeners.size){observer?.disconnect();observer=undefined;}};
}
const snapshot=()=>typeof document==="undefined"?"studio":interfaceName(document.documentElement.dataset.interface);
export function useInterface(){return useSyncExternalStore(subscribe,snapshot,()=>"studio");}
