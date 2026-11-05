import { useEffect, useRef } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { Btn, Icon, Field, Status, Matching } from "../../components/ui/ui.jsx";
import WrittenFeedback from "./written-feedback.jsx";
import { useQuestionSpeech } from "./use-question-speech.js";
import { useAnswerClock } from "../learning/use-answer-clock.js";
import { isExample } from "./flashcard-engine.js";
import CardImage from "./card-image.jsx";

export function QuestionUI({
  q,
  value,
  onChange,
  disabled,
  feedback,
  assessment,
  options,
  active,
  onCommit,
  onTimer,
}) {
  useLocale();
  const definitionInput = useRef(null);
  const listening = q.type === "dictation" || q.type === "written" && options.listenBeforeAnswer;
  const speech = useQuestionSpeech({text:q.card.german_text, voice:options.frontVoice,
    enabled:!!(listening && active && !disabled), autoplay:options.mode === "learn"});
  const commit = () => { speech.stop(); onCommit?.(); };
  const clock = useAnswerClock(q.id, !disabled);
  useEffect(() => {
    onTimer?.(clock.read);
  });
  const checked = typeof feedback === "boolean";
  const answerClass = (answer, correct) =>
    `answer-option ${checked && correct ? "answer-correct" : checked && value === answer ? "answer-wrong" : value === answer ? "selected" : ""}`;
  return (
    <div
      ref={clock.root}
      onFocusCapture={listening ? e=>{if(e.target.matches("input,textarea"))speech.onFocus();} : undefined}
      className={`flash-question ${checked ? (feedback ? "answer-right" : "answer-error") : ""}`}
    >
      <h2>{q.type === "dictation" ? tr("Listen and write") : q.prompt}</h2>{q.card.part_of_speech && <small className="block">{q.card.part_of_speech}</small>}
      {listening && <div className="question-audio">
        <Btn icon="sound" isDisabled={!active || disabled} onClick={speech.play}>{tr("Play term")}</Btn>
        <span>{tr("Listen to the term")}</span>
      </div>}
      {listening && speech.error && <Status error={speech.error}/>}
      {!isExample(q.card)&&q.type!=="matching"&&(q.prompt===q.card.vietnamese_meaning||checked)&&<CardImage card={q.card}/>}
      {q.type === "choice" ? (
        <div className="answer-options">
          {q.options.map((answer, i) => (
            <button
              key={i}
              className={answerClass(answer, answer === q.expected)}
              disabled={disabled}
              onClick={() => onChange(answer)}
            >
              <span>{String.fromCharCode(65 + i)}</span>
              {answer}
            </button>
          ))}
        </div>
      ) : q.type === "truefalse" ? (
        <>
          <p>{tr("Suggested answer: ")}<strong>{q.proposed}</strong>
          </p>
          <div className="toolbar">
            <Btn
              className={answerClass(true, q.truth === true)}
              aria-pressed={value === true}
              isDisabled={disabled}
              onClick={() => onChange(true)}
            >{tr("Correct")}</Btn>
            <Btn
              className={answerClass(false, q.truth === false)}
              aria-pressed={value === false}
              isDisabled={disabled}
              onClick={() => onChange(false)}
            >{tr("Sai")}</Btn>
          </div>
        </>
      ) : q.type === "dictation" ? (
        <div className="dictation-fields">
          <Field label={tr("Term")} value={value?.term || ""} isDisabled={disabled} autoComplete="off" spellCheck={false} maxLength={500}
            onChange={term=>onChange({...value,term})}
            onKeyDown={e=>{if(e.key === "Enter" && !e.nativeEvent.isComposing){e.preventDefault();definitionInput.current?.focus();}}}/>
          <Field ref={definitionInput} label={tr("Definition")} value={value?.definition || ""} isDisabled={disabled} autoComplete="off" spellCheck={false} maxLength={500}
            onChange={definition=>onChange({...value,definition})}
            onKeyDown={e=>{if(e.key === "Enter" && !e.nativeEvent.isComposing){e.preventDefault();if(value?.term?.trim() && value?.definition?.trim())commit();}}}/>
          <Btn icon="enter" isDisabled={disabled || !value?.term?.trim() || !value?.definition?.trim()} onClick={commit}>{tr("Check answer")}</Btn>
        </div>
      ) : q.type === "matching" ? (
        <Matching
          left={q.left}
          right={q.right}
          value={value || {}}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <Field
          label={tr("Answer")}
          value={value || ""}
          onChange={onChange}
          isDisabled={disabled}
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commit();
            }
          }}
          endContent={
            <button
              className="answer-enter"
              disabled={disabled || !String(value || "").trim()}
              aria-label={tr("Check answer")}
              onClick={commit}
            >
              <Icon name="enter" />
            </button>
          }
        />
      )}
      <WrittenFeedback assessment={assessment}/>
      {q.type === "matching" && (
        <div className="print-only print-matching">
          <div>
            {q.left.map((item, i) => (
              <p key={item.id}>
                {i + 1}. {item.text}
              </p>
            ))}
          </div>
          <div>
            {q.right.map((item, i) => (
              <p key={item.id}>
                {String.fromCharCode(65 + i)}. {item.text}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="print-answer">
        ________________________________________________________________
      </div>
    </div>
  );
}

export function ExampleFeedback({card,options,revealed}) {
  if (!revealed || !options.showExampleAfterAnswer || options.includeExamples || isExample(card) || !card?.example_german) return null;
  return <aside className="flash-example-feedback" aria-live="polite">
    <div className="flash-example-heading"><Icon name="book" size={18}/><span>{tr("Example sentence")}</span></div>
    <blockquote>{card.example_german}</blockquote>
    {card.example_vietnamese && <p>{card.example_vietnamese}</p>}
  </aside>;
}
