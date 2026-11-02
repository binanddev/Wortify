import { t as tr, useLocale } from "../../i18n/index.js";
import { useState } from "react";
import { shuffled } from "../../lib/core.js";
import { gradeExercise } from "../learning/local-learning.js";
import { PracticeRichText } from "./practice-rich-text.jsx";

export function MatchPairs({exercise, questions, answers, onPairCorrect, onPairResult,
 disabled, uiStyle, deferred = false, onAnswer, rows = []}) {
 useLocale();
 const [picked, setPicked] = useState(null);
 const [error, setError] = useState(null);
 const [right] = useState(() => shuffled([...new Set(questions.flatMap(q => q.options || []))]));
 const locked = key => rows.some(row => row.key === key && row.correct === true);
 const fixed = key => disabled || locked(key) || (!deferred && Boolean(answers[key]));
 const attempt = (key, text) => {
  const q = questions.find(q => String(q.id) === key);
  if (!q || fixed(key)) return;
  setError(null);
  if (deferred) {
   const previous = questions.find(item => String(item.id)!==key && answers[item.id]===text);
   if(previous && locked(String(previous.id))) return;
   if(previous) onAnswer?.(String(previous.id), answers[key] || '');
   onAnswer?.(key,text);
   setPicked(null);
   return;
  }
  const correct = gradeExercise(exercise,[q],{[key]:text}).answers.every(row=>row.correct);
  onPairResult?.(correct);
  if(correct) {onPairCorrect?.(key,text);setPicked(null);}
  else setError({key,text});
 };
 return <div className="pairing-work">
  <div className="pair-column"><h3>A</h3>
   {questions.map((q,i)=>{
    const key=String(q.id), assigned=Boolean(answers[key]), row=rows.find(item=>item.key===key);
    const correct=deferred?row?.correct===true:assigned;
    return <button type="button" key={key}
     className={`pair-card ${correct?'paired':''} ${picked===key?'selected':''} ${error?.key===key || row?.correct===false?'pair-error':''}`}
     disabled={fixed(key)} aria-pressed={picked===key} aria-invalid={row?.correct===false || undefined}
     draggable={!fixed(key) && uiStyle==='drag_match'}
     onDragStart={event=>{setError(null);setPicked(key);event.dataTransfer.setData('text/plain',key);}}
     onClick={()=>{setError(null);setPicked(key);}}>
     <b>{i+1}</b><span><PracticeRichText>{q.prompt}</PracticeRichText>
      {deferred && assigned && <span className="pair-assigned">{answers[key]}</span>}
     </span>
    </button>;
   })}
  </div>
  <div className="pair-column"><h3>B</h3>
   {right.map((text,i)=>{
    const assigned=questions.find(q=>answers[q.id]===text);
    const row=assigned && rows.find(item=>item.key===String(assigned.id));
    const correct=deferred?row?.correct===true:Boolean(assigned);
    return <button type="button" key={text}
     className={`pair-card ${correct?'paired':''} ${error?.text===text || row?.correct===false?'pair-error':''}`}
     disabled={disabled || correct}
     onDragOver={event=>{if(uiStyle==='drag_match')event.preventDefault();}}
     onDrop={event=>{event.preventDefault();if(uiStyle==='drag_match')attempt(event.dataTransfer.getData('text/plain'),text);}}
     onClick={()=>attempt(picked,text)}>
     <b>{correct?'✓':String.fromCharCode(65+i)}</b><span>{text}</span>
    </button>;
   })}
  </div>
  <span className="match-status" role="status">{error?tr('Not a match. Try again.'):''}</span>
 </div>;
}
