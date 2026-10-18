import { t as tr, useLocale } from "../../i18n/index.js";
import { Btn } from "../../components/ui/ui.jsx";
import { createElement, useMemo, useState, useId } from "react";
import { PracticeRichText } from "./practice-rich-text.jsx";
import { readingImageSource, readingStyle } from "./reading-html.js";
const allowed = new Set("h1 h2 h3 h4 p div span strong em b i u br blockquote ul ol li table thead tbody tr th td figure figcaption img".split(" "));
const blocked = new Set("script style iframe object embed form input button textarea select link meta base svg math template".split(" "));
function safeNodes(nodes, depth = 0) {
  if (depth > 30) return null;
  return Array.from(nodes).slice(0,5000).map((node,index) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    if (blocked.has(tag)) return null;
    if (!allowed.has(tag)) return safeNodes(node.childNodes,depth+1);
    const props = { key:index, style:readingStyle(node.getAttribute("style")) };
    if (tag === "img") {
      const src = readingImageSource(node.getAttribute("src"));
      if (!src) return null;
      return <img {...props} src={src} alt={node.getAttribute("alt") || tr("Reading illustration")} loading="lazy" referrerPolicy="no-referrer" />;
    }
    if (tag === "br") return <br key={index}/>;
    return createElement(tag,props,safeNodes(node.childNodes,depth+1));
  });
}
export function ReadingPassage({ exercise }) {
  useLocale();
  const content = useMemo(() => exercise.presentation?.context_format === "html" ? safeNodes(new DOMParser().parseFromString(exercise.context || "", "text/html").body.childNodes) : null,[exercise.context,exercise.presentation?.context_format]);
  return <article className="reading-passage">{exercise.presentation?.context_format === "html" ? content : <PracticeRichText>{exercise.context}</PracticeRichText>}</article>;
}
export function ReadingLayout({ exercise, children, onProgress, progress, preview }) {
  useLocale();
  const [mode,setMode] = useState("single");
  return <div className="reading-workspace">
    <section className="reading-pane" aria-label={tr("Reading passage")}><header><h2>{tr("Reading")}</h2></header><ReadingPassage exercise={exercise}/></section>
    <section className="reading-questions" aria-label={tr("Reading questions")}>
      <header className="reading-question-toolbar"><h2>{tr("Questions")}</h2><div className="reading-nav-tools" role="group" aria-label={tr("Question mode")}>
        <Btn aria-pressed={mode === "single"} onClick={()=>setMode("single")}>{tr("One at a time")}</Btn>
        <Btn aria-pressed={mode === "all"} onClick={()=>setMode("all")}>{tr("All questions")}</Btn>
      </div></header>
      <div hidden={mode !== "single"}>{children}</div>
      <div hidden={mode !== "all"}><ReadingAllQuestions exercise={exercise} onProgress={onProgress} progress={progress} preview={preview}/></div>
    </section>
  </div>;
}
function ReadingAllQuestions({exercise,onProgress,progress,preview}) {
  useLocale();
  const groupId = useId();
  const [answers,setAnswers] = useState({});
  const [result,setResult] = useState(null);
  const questions = useMemo(()=>exercise.questions.filter(q=>!q.example).map(q=>({...q,options:q.options.map(value=>({value,sort:Math.random()})).sort((a,b)=>a.sort-b.sort).map(o=>o.value)})),[exercise]);
  function check() {
    const scored = questions.map(q=>{
      const selected = answers[q.id] || [];
      return {id:String(q.id),correct:selected.length === q.accepted_answers.length && selected.every(a=>q.accepted_answers.includes(a))};
    });
    setResult(scored);
    if (!preview) onProgress?.([...new Set([...(progress?.completed || []),...scored.filter(r=>r.correct).map(r=>r.id)])]);
  }
  return <div className="reading-question-list">
    {questions.map((q,index)=><fieldset className="reading-question-card" key={q.id}>
      <legend>{index+1}. {q.prompt}</legend>
      <p className="reading-answer-hint">{q.kind === "multi" ? tr("Select all correct answers.") : tr("Select one answer.")}</p>
      <div className="reading-options">{q.options.map((option,i)=>{
        const selected=(answers[q.id] || []).includes(option);
        return <label className="reading-option" key={option} data-selected={selected} data-result={result ? q.accepted_answers.includes(option) ? "correct" : selected ? "incorrect" : undefined : undefined}>
          <input type={q.kind === "multi" ? "checkbox" : "radio"} name={groupId + "-" + q.id} checked={selected} onChange={()=>{
            setResult(null);
            setAnswers(prev=>({...prev,[q.id]:q.kind === "multi" ? selected ? (prev[q.id] || []).filter(a=>a!==option) : [...(prev[q.id] || []),option] : [option]}));
          }}/><span className="reading-option-letter">{String.fromCharCode(65+i)}</span><span>{option}</span>
        </label>;
      })}</div>
      {result && <div className="reading-question-feedback" role="status"><strong>{result[index].correct ? tr("Correct") : tr("Review this answer")}</strong>{q.presentation?.explanation && <p>{q.presentation.explanation}</p>}</div>}
    </fieldset>)}
    <div className="reading-check-all">{result && <span role="status">{result.filter(r=>r.correct).length} / {questions.length}{tr(" correct")}</span>}<Btn primary onClick={check} isDisabled={questions.some(q=>!answers[q.id]?.length)}>{tr("Check all")}</Btn></div>
  </div>;
}
