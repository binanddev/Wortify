import { useEffect, useRef, useState } from "react";
import { Btn, Icon, useSound } from "../../components/ui/ui.jsx";
import { useWindowActive } from "../../lib/core.js";
import { mix } from "./flashcard-engine.js";
import { nextBridgeWord, reward } from "./arcade-engine.js";

export default function ArcadeGames({ cards, mode, sound, lang, onDone }) {
  const [started, setStarted] = useState(false), [timed, setTimed] = useState(true);
  const [index, setIndex] = useState(0), [score, setScore] = useState(0), [streak, setStreak] = useState(0);
  const [wins, setWins] = useState(0), [retry, setRetry] = useState([]), [roundCards, setRoundCards] = useState(cards);
  const name = "Sentence Quest";
  if (!started) return <section className="word-arcade arcade-lobby">
    <div className="arcade-emblem"><Icon name={"flag"} size={48} /></div>
    <h2>{"Build a bridge. Reach the treasure."}</h2>
    <p>{"Collect the words in the order of the saved sentence. Every correct tile builds one bridge step; a wrong tile costs energy. Reach the far side before time runs out."}</p>
    <div className="arcade-hud"><span>{cards.length} stages</span><span>6 energy / stage</span><span>Combo bonuses</span></div>
    <label><input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} /> Challenge clock <small>(turn off for relaxed play)</small></label>
    <Btn primary onClick={() => setStarted(true)}>Start {name}</Btn>
  </section>;
  if (index >= roundCards.length) return <section className="word-arcade arcade-lobby">
    <div className="arcade-emblem">✦</div><h2>{wins === roundCards.length ? "Treasure run complete!" : "Expedition complete"}</h2>
    <div className="arcade-hud"><span>{score} points</span><span>{wins} / {roundCards.length} treasures</span></div>
    <p>{retry.length ? "Some treasures are still waiting. Replay the missed stages." : "Every stage cleared. Try a new run and beat your score."}</p>
    <div className="arcade-actions">{retry.length > 0 && <Btn primary onClick={() => { setRoundCards(retry); setRetry([]); setIndex(0); setWins(0); setStreak(0); setScore(0); }}>Retry missed stages</Btn>}<Btn onClick={onDone}>Game lobby</Btn></div>
  </section>;
  return <ArcadeStage key={`${index}:${roundCards[index].id}`} card={roundCards[index]} mode={mode} lang={lang} sound={sound} timed={timed} score={score} streak={streak} stage={index+1} total={roundCards.length} onNext={(won, mistakes, hints) => {
    if (won) { setScore(s => s + reward(mistakes, hints, streak)); setWins(n => n+1); } else setRetry(r => [...r, roundCards[index]]);
    setStreak(n => won && mistakes === 0 && hints === 0 ? n+1 : 0); setIndex(n => n+1);
  }} />;
}

function ArcadeStage({ card, mode, lang, sound, timed, score, streak, stage, total, onNext }) {
  const active = useWindowActive(), audio = useSound(sound, lang);
  const [visible, setVisible] = useState(!document.hidden), [paused, setPaused] = useState(false);
  const [used, setUsed] = useState([]), [mistakes, setMistakes] = useState(0), [hints, setHints] = useState(0);
  const [notice, setNotice] = useState(""), [wrong, setWrong] = useState(null);
  const [tokens] = useState(() => card.example_german.trim().split(/\s+/).map((text, i) => ({ id: String(i), text })));
  const [tiles, setTiles] = useState(() => mix(tokens));
  const duration = Math.max(60, tokens.length * 5);
  const [seconds, setSeconds] = useState(duration);
  const won = used.length === tokens.length;
  const lost = mistakes >= 6 || (timed && seconds <= 0);
  const finished = won || lost, frozen = paused || !active || !visible;
  const awarded = useRef(false);
  useEffect(() => { const update = () => setVisible(!document.hidden); document.addEventListener("visibilitychange", update); return () => document.removeEventListener("visibilitychange", update); }, []);
  useEffect(() => {
    if (!timed || frozen || finished) return;
    let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); setSeconds(s => Math.max(0, s - (now-previous)/1000)); previous = now; }, 150);
    return () => clearInterval(timer);
  }, [timed, frozen, finished]);
  useEffect(() => { if (won && !awarded.current) { awarded.current = true; audio.applause(); } }, [won]);
  useEffect(() => { if (wrong === null) return; const timer = setTimeout(() => setWrong(null), 500); return () => clearTimeout(timer); }, [wrong]);
  function step(tile, hint = false) {
    if (finished || frozen || used.includes(tile.id)) return;
    const correct = nextBridgeWord(tokens, used, tile.id);
    if (correct) { setUsed(a => [...a, tile.id]); setNotice("Bridge extended!"); if (hint) setHints(n => n+1); }
    else { setMistakes(n => n+1); setWrong(tile.id); setNotice("Wrong path — try another tile."); }
    audio.feedback(correct);
  }
  return <section className={`word-arcade ${won ? "arcade-won" : ""}`} aria-label="Sentence Quest game board">
    <div className="arcade-hud"><span>Stage {stage}/{total}</span><strong>{score + (won ? reward(mistakes,hints,streak) : 0)} pts</strong><span>Combo {streak}</span><span aria-label={`${Math.max(0,6-mistakes)} energy remaining`}>{"♥".repeat(Math.max(0,6-mistakes))}{"♡".repeat(Math.min(6,mistakes))}</span>{timed && <span>{Math.ceil(seconds)}s</span>}<Btn onClick={() => setPaused(p => !p)} isDisabled={finished}>{paused ? "Resume" : "Pause"}</Btn></div>
    {timed && <progress className="arcade-clock" value={seconds} max={duration} aria-label="Time remaining" />}
    <div className="arcade-landscape" aria-hidden="true"><span className="arcade-cloud">☁</span><span className="arcade-cloud second">☁</span><div className="arcade-journey"><span className="arcade-traveler" style={{ left: `${5 + 80 * (used.length/tokens.length)}%` }}>☺</span><span className="arcade-treasure">{won ? "✦" : "▣"}</span></div><div className="arcade-bridge">{Array.from({length:12},(_,i) => <i key={i} className={i < (used.length/tokens.length)*12 ? "built" : ""} />)}</div>
    </div>
    {frozen && !finished ? <div className="arcade-pause"><h2>Expedition paused</h2><p>Your time and energy are safe.</p>{paused && <Btn primary onClick={() => setPaused(false)}>Resume game</Btn>}</div> : <>
      <h2 className="arcade-clue">{card.example_vietnamese || `Build the saved example for: ${card.german_text}`}</h2>
      {<>
        <div className="arcade-sentence" aria-label="Bridge sentence">{tokens.slice(0, used.length).map((t,i) => <span key={i}>{t.text} </span>)}{!finished && <span className="arcade-next">?</span>}</div>
        {!finished && <div className="arcade-word-islands" aria-label="Collect the next word">{tiles.map(tile => <button key={tile.id} type="button" disabled={used.includes(tile.id)} className={used.includes(tile.id) ? "collected" : wrong === tile.id ? "wrong" : ""} onClick={() => step(tile)}>{tile.text}</button>)}</div>}
      </>}
      <p className="arcade-notice" role="status">{notice || "Collect the first word to start crossing."}</p>
      {!finished && <div className="arcade-actions"><Btn onClick={() => { { const next = tokens[used.length]; step(tokens.find(t=>!used.includes(t.id) && t.text===next.text),true); } }}>Hint · −25 pts</Btn>{mode === "sentence" && <Btn onClick={() => setTiles(mix(tokens))}>Shuffle islands</Btn>}</div>}
      {finished && <div className="arcade-result" role="status"><h2>{won ? "Treasure unlocked!" : "Treasure missed — try again next run"}</h2><p>{card.example_german}</p><p>{card.example_vietnamese}</p>{card.usage && <p>{card.usage}</p>}<div className="arcade-actions"><Btn primary onClick={() => onNext(won,mistakes,hints)}>{stage === total ? "See results" : "Next stage →"}</Btn></div></div>}
    </>}
  </section>;
}
