import {useState} from 'react';
export function ChoiceLab({q,value,onChange,disabled,style}) {
 const [removed,setRemoved]=useState([]);
 const options=style==='evidence_judge'?['TRUE','FALSE','NOT_GIVEN']:q.options;
 const names={TRUE:'True',FALSE:'False',NOT_GIVEN:'Not given'};
 return <div className={`choice-lab ${style}`}>
  <p className="choice-lab-hint">{style==='dialogue_reply'?'Your reply':style==='elimination'?'Cross out options to compare the remaining choices, then select your answer. Crossing out is optional and is not graded.':'Does the passage support this statement?'}</p>
  <div role="group" aria-label="Answer choices">
   {options.map((option,i)=><div className="choice-lab-row" key={option}>
    <button type="button" className="choice-lab-answer" disabled={disabled||removed.includes(option)} aria-pressed={value===option} onClick={()=>onChange(option)}><span aria-hidden="true">{style==='dialogue_reply'?'›':String.fromCharCode(65+i)+'.'}</span> {names[option]||option}</button>
    {style==='elimination'&&<button type="button" className="choice-lab-eliminate" disabled={disabled} aria-pressed={removed.includes(option)} aria-label={`${removed.includes(option)?'Restore':'Rule out'} ${option}`} onClick={()=>{setRemoved(r=>r.includes(option)?r.filter(x=>x!==option):[...r,option]);if(value===option)onChange('');}}>{removed.includes(option)?'Restore':'Rule out'}</button>}
   </div>)}
  </div>
 </div>;
}
