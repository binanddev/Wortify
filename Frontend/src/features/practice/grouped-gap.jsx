import { t as tr, useLocale } from "../../i18n/index.js";
import { useMemo, useRef, useState, useEffect } from "react";
import { PracticeRichText } from "./practice-rich-text.jsx";
import { shuffled } from "../../lib/core.js";
import { groupedWordBank, allocateGroupedGapTokens, groupedGapMove } from "./gap-bank.js";

// Answers remain keyed by the original question IDs, so grouping never changes
// grading, saved progress, or the import format.
export function GroupedGaps({ exercise, questions, answers, onAnswer, disabled, rows = [] }) {
 useLocale();
 const signature = JSON.stringify(questions.map(q => [q.id, q.prompt, q.presentation?.word_bank, q.blanks]));
 const chips = useMemo(() => shuffled(groupedWordBank(questions).map((text, i) => ({id: String(i), text}))), [signature]);
 const {slots, bank} = allocateGroupedGapTokens(chips, answers, questions);
 const locked = new Set(rows.filter(row => row.correct === true).map(row => String(row.key)));
 const [active, setActive] = useState(null);
 const [drag, setDrag] = useState(null);
 const root = useRef(null), gesture = useRef(null), ignoreClickBefore = useRef(0);
 useEffect(() => { setActive(null); setDrag(null); gesture.current = null; }, [signature, disabled]);
 const move = (token, target) => {
  if (disabled) return;
  for (const [key, value] of groupedGapMove(slots, token, target, locked)) onAnswer(key, value);
  setActive(null);
 };
 const tap = token => {
  const source = Object.keys(slots).find(key => slots[key]?.id === token.id);
  const target = active && !locked.has(active) ? active : Object.keys(slots).find(key => !slots[key] && !locked.has(key));
  if (source) move(token, null);
  else if (target) move(token, target);
 };
 const targetAt = event => {
  const node = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-group-gap]');
  return node && root.current?.contains(node) ? node.dataset.groupGap : null;
 };
 const cancel = () => { gesture.current = null; setDrag(null); };
 const start = (event, token) => {
  if (disabled || event.button !== 0) return;
  const source = Object.keys(slots).find(key => slots[key]?.id === token.id);
  if (source && locked.has(source)) return;
  // Touch users can tap to place/remove without preventing page scrolling.
  // Drag uses mouse/pen; all operations remain available through buttons.
  if (event.pointerType === 'touch') return;
  event.preventDefault();
  gesture.current = {token, pointerId:event.pointerId, x:event.clientX, y:event.clientY, moved:false};
  root.current.setPointerCapture(event.pointerId);
  setDrag(gesture.current);
 };
 const style = exercise.presentation?.style;
 return <div ref={root} className="gap-work grouped-gap" data-ui-style={style}
  onPointerMove={event => {
   const current = gesture.current;
   if (!current || current.pointerId !== event.pointerId) return;
   const next = {...current, moved:current.moved || Math.hypot(event.clientX-current.x,event.clientY-current.y)>5};
   gesture.current=next; setDrag(next); if(next.moved)setActive(targetAt(event));
  }}
  onPointerUp={event => {
   const current=gesture.current;
   if(!current || current.pointerId!==event.pointerId)return;
   ignoreClickBefore.current=event.timeStamp+50;
   const target=targetAt(event);
   const element=document.elementFromPoint(event.clientX,event.clientY);
   cancel();
   if(root.current.hasPointerCapture(event.pointerId))root.current.releasePointerCapture(event.pointerId);
   if(!current.moved)tap(current.token);
   else if(target!==null)move(current.token,target);
   else if(element?.closest('[data-group-bank]')===root.current.querySelector('[data-group-bank]'))move(current.token,null);
  }} onPointerCancel={cancel} onLostPointerCapture={cancel}>
  <div className="grouped-gap-questions">
   {questions.map((q, index) => <div key={q.id} className="grouped-gap-question">
    <span className="grouped-gap-number">{q.position || index+1}.</span>
    <div className="fluid-passage"><PracticeRichText renderBlank={blank => {
     const key=`${q.id}_${blank}`, token=slots[key], row=rows.find(item=>item.key===key);
     const fixed=disabled || locked.has(key);
     return <span key={key} className={`gap-token ${row?.correct===true?'is-right':row?.correct===false?'is-wrong':''}`}>
      <button type="button" data-group-gap={key} disabled={fixed}
       className={`gap-drop ${token?'filled':''} ${active===key?'is-active':''}`}
       aria-label={`${q.position || index+1}: ${tr('Gap {v0}{v1}',{v0:blank+1,v1:token?': '+token.text:''})}`}
       aria-pressed={active===key} aria-invalid={row?.correct===false || undefined}
       onPointerDown={event=>token && start(event,token)}
       onClick={event=>{if(event.detail===0 || event.timeStamp>ignoreClickBefore.current || !token)token?tap(token):setActive(key);}}>
       {token?<span className="movable-token">{token.text}</span>:<span aria-hidden="true">{String(blank+1)}</span>}
      </button>
     </span>;
    }}>{q.prompt}</PracticeRichText></div>
   </div>)}
  </div>
  <div className="word-bank grouped-gap-bank" data-group-bank aria-label={tr('Word bank; drag a word here to remove it from the gap')}>
   {bank.map(token=><button key={token.id} type="button" disabled={disabled}
    className={`gap-bank-token ${drag?.token.id===token.id && drag.moved?'selected':''}`}
    onPointerDown={event=>start(event,token)}
    onClick={event=>{if(event.detail===0 || event.timeStamp>ignoreClickBefore.current)tap(token);}}>
    <span className="movable-token">{token.text}</span>
   </button>)}
  </div>
 </div>;
}
