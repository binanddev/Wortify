import { useState } from 'react';
import { useNavigate, request, endpoint } from '../../lib/core.js';
import { destinations, parseCommand } from './commands.js';
export default function QuestConsole({lang,onExit}) {
 const go=useNavigate();
 const [input,setInput]=useState(''),[log,setLog]=useState(['Wortify DOS. Type help.']),[history,setHistory]=useState([]),[cursor,setCursor]=useState(-1),[cwd,setCwd]=useState('/'),[entries,setEntries]=useState([]),[busy,setBusy]=useState(false);
 const write=line=>setLog(l=>[...l,line].slice(-30));
 async function run(value) {
  if(!value.trim()||busy)return;
  setHistory(h=>[value,...h].slice(0,30));setCursor(-1);setInput('');write('> '+value);
  const [verb,...args]=value.trim().split(/\s+/);const arg=args.join(' '),cmd=verb.toLowerCase();
  if(['exit','exit()'].includes(cmd)){onExit();return;}
  if(['clear','cls'].includes(cmd)){setLog([]);return;}
  if(cmd==='help'){write('help | cls / clear | exit() | pwd | cd <area> | cd .. | ls / dir | find <text> | open <number or area> | whoami | date');write('Areas: flashcard, practice, explore, create, journey, classes, settings. ls lists saved decks/practice; find searches those accessible collections. Up/Down recalls commands.');return;}
  if(cmd==='pwd'){write('/'+lang+cwd);return;}
  if(cmd==='date'){write(new Date().toLocaleString('en-GB'));return;}
  if(cmd==='whoami'){write('Current signed-in learner. This simulator uses your existing access permissions.');return;}
  if(cmd==='cd' && ['..','/'].includes(arg)){setCwd('/');setEntries([]);write('Root directory. Type ls.');return;}
  if(cmd==='ls'||cmd==='dir'||cmd==='find') {
   if(cmd!=='find'&&cwd==='/'){write(Object.keys(destinations).join('  '));return;}
   if(cmd==='find'&&!arg){write('Usage: find <text>');return;}
   setBusy(true);
   try {
    let rows=[];
    if(cmd==='find'||cwd==='/flashcard'){const data=await request(endpoint(lang,'decks/'));rows.push(...data.decks.map(d=>({name:d.title,path:`/${lang}/flashcard/deck/${d.id}`})));}
    if(cmd==='find'||cwd==='/practice'){const data=await request(endpoint(lang,'practice-hub/nodes/?full=1'));const nodes=Array.isArray(data)?data:data.nodes||[];rows.push(...nodes.map(n=>({name:n.title||n.name||String(n.id),path:`/${lang}/practice/${n.id}`})));}
    if(cmd==='find')rows=rows.filter(r=>r.name.toLowerCase().includes(arg.toLowerCase()));
    setEntries(rows);write(rows.length?rows.map((r,i)=>`${i+1}. ${r.name}`).join('\n'):'No entries here. Use an area command to open its page.');
   }catch{write('Could not load this directory. Please try again.');}finally{setBusy(false);}return;
  }
  if(cmd==='open'&&/^\d+$/.test(arg)){const item=entries[Number(arg)-1];if(item)go(item.path);else write('Run ls or find first, then open a listed number.');return;}
  const target=cmd==='cd'?arg:value;
  const normalized=target==='flashcard'?'cards':target;
  const result=parseCommand(normalized,lang);
  if(result.type==='navigate'){setCwd('/'+result.path.split('/').at(-1));setEntries([]);write('Directory changed. Type ls to browse.');go(result.path);}else write('Unknown command. Type help.');
 }
 return <section className="quest-console terminal" aria-label="DOS terminal">
  <div className="dos-log" role="log" aria-live="polite">{log.map((line,i)=><p key={i}>{line}</p>)}</div>
  <form onSubmit={e=>{e.preventDefault();run(input);}}>
   <label htmlFor="quest-command">C:{cwd}&gt;</label><div className="quest-prompt"><input id="quest-command" value={input} autoComplete="off" spellCheck={false} placeholder="help" onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const next=e.key==='ArrowUp'?Math.min(cursor+1,history.length-1):Math.max(-1,cursor-1);setCursor(next);setInput(history[next]||'');}}}/><button disabled={busy} type="submit" className="btn btn-primary">{busy?'...':'Run'}</button></div>
  </form>
  <div className="quest-command-list">{['help','ls','cd flashcard','cd practice','exit()'].map(key=><button disabled={busy} key={key} type="button" onClick={()=>run(key)}>{key}</button>)}</div>
 </section>;
}
