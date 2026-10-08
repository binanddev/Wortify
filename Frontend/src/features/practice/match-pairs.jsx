import { useEffect, useRef, useState } from "react";
import { shuffled } from "../../lib/core.js";
import { gradeExercise } from "../learning/local-learning.js";
import { PracticeRichText } from "./practice-rich-text.jsx";

export function MatchPairs({
  exercise,
  questions,
  answers,
  onPairCorrect,
  onPairResult,
  disabled,
  uiStyle,
}) {
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  const [right] = useState(() =>
    shuffled([...new Set(questions.flatMap((q) => q.options || []))]),
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const attempt = (key, text) => {
    const q = questions.find((q) => String(q.id) === key);
    if (!q || disabled || error || answers[key]) return;
    const correct = gradeExercise(exercise, [q], { [key]: text }).answers.every(
      (row) => row.correct,
    );
    onPairResult?.(correct);
    if (correct) {
      onPairCorrect(key, text);
      setPicked(null);
    } else {
      setError({ key, text });
      timer.current = setTimeout(() => {
        setError(null);
        setPicked(null);
      }, 700);
    }
  };
  return (
    <div className="pairing-work">
      <div className="pair-column">
        <h3>A</h3>
        {questions.map((q, i) => {
          const key = String(q.id),
            done = Boolean(answers[key]);
          return (
            <button
              type="button"
              key={key}
              className={`pair-card ${done ? "paired" : ""} ${picked === key ? "selected" : ""} ${error?.key === key ? "pair-error" : ""}`}
              disabled={disabled || done || Boolean(error)}
              aria-pressed={picked === key}
              draggable={
                !disabled && !done && !error && uiStyle === "drag_match"
              }
              onDragStart={(event) => {
                setPicked(key);
                event.dataTransfer.setData("text/plain", key);
              }}
              onClick={() => setPicked(key)}
            >
              <b>{i + 1}</b>
              <span>
                <PracticeRichText>{q.prompt}</PracticeRichText>
              </span>
            </button>
          );
        })}
      </div>
      <div className="pair-column">
        <h3>B</h3>
        {right.map((text, i) => {
          const done = questions.some((q) => answers[q.id] === text);
          return (
            <button
              type="button"
              key={text}
              className={`pair-card ${done ? "paired" : ""} ${error?.text === text ? "pair-error" : ""}`}
              disabled={disabled || Boolean(error)}
              onDragOver={(event) => {
                if (uiStyle === "drag_match") event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (uiStyle === "drag_match")
                  attempt(event.dataTransfer.getData("text/plain"), text);
              }}
              onClick={() => attempt(picked, text)}
            >
              <b>{done ? "✓" : String.fromCharCode(65 + i)}</b>
              <span>{text}</span>
            </button>
          );
        })}
      </div>
      <span className="match-status" role="status">
        {error ? "Not a match. Try again." : ""}
      </span>
    </div>
  );
}
