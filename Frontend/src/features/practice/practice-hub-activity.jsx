import {useEffect, useRef, useState} from 'react';
import {t as tr, useLocale} from '../../i18n/index.js';
import {readPreference, savePreference} from '../../lib/core.js';
import {Btn, Icon, Status, useSound} from '../../components/ui/ui.jsx';
import {PracticeModal} from './practice-workspace.jsx';
import {PracticeRichText} from './practice-rich-text.jsx';
import {ExerciseMedia} from './exercise-media.jsx';
import {TypeQuestion, MatchPairs, Categories} from './exercise-interactions.jsx';
import {GroupedGaps} from './grouped-gap.jsx';
import {modeOf, exerciseStylesOf} from './exercise-types.js';
import {readyToCheck, questionKeys, mergeProgress} from './practice-session.js';
import {gradeExercise} from '../learning/local-learning.js';
import {exerciseSolution} from '../learning/skip-learning.js';
import {practiceGroups, recordCheck, runSummary, weakQuestionIds, newPracticeRun, restorePracticeRun} from './practice-run.js';
import {sharedGapQuestions} from './gap-bank.js';

export default function PracticeHubActivity({data, id, userId, lang, preview = false, onProgress, onResult, onNext, uiStyle, proposalSlot, renderHeader, sound = false}) {
  useLocale();
  const exercise = data.exercise, mode = modeOf(exercise);
  const source = data.questions.filter(q => !q.example);
  const all = mode === 'cloze_drag_drop' && exercise.presentation?.bank_scope !== 'question' ? sharedGapQuestions(source) : source;
  const style = uiStyle || exercise.presentation?.style || exerciseStylesOf(mode)[0][0];
  const storageKey = `wortify:practice-run:${userId}:${lang}:${id}`;
  const [run, setRun] = useState(() => (!preview && restorePracticeRun(readPreference(storageKey, null), all, mode, exercise.presentation?.bank_scope)) || newPracticeRun());
  const [confirmMode, setConfirmMode] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(sound);
  const sounds = useSound(soundEnabled, lang);
  useEffect(() => setSoundEnabled(sound), [sound]);
  const callbacks = useRef({onProgress, onResult});
  callbacks.current = {onProgress, onResult};
  const sent = useRef('');
  const questions = run.ids ? all.filter(q => run.ids.includes(String(q.id))) : all;
  const groups = practiceGroups(questions, mode, exercise.presentation?.bank_scope);
  const batch = groups[run.index] || [];
  const selfCheck = run.mode === 'self_check';
  const revealed = batch.length > 0 && batch.every(q => run.revealed.includes(String(q.id)));
  const correct = batch.length > 0 && batch.every(q => run.records[String(q.id)]?.correct);
  const ready = batch.length > 0 && batch.every(q => readyToCheck(q, run.answers));
  const hasAttempt = batch.some(q => run.records[String(q.id)]?.attempts);
  const lastCheck = useRef('');
  useEffect(() => { if (!preview) savePreference(storageKey, run); }, [storageKey, run, preview]);
  useEffect(() => {
    if (preview) return;
    const completed = mergeProgress(all, data.progress?.completed,
      all.filter(q => run.records[String(q.id)]?.correct && !run.records[String(q.id)]?.revealed).map(q => String(q.id)));
    if (completed.length) callbacks.current.onProgress?.(completed);
  }, [run.records, preview]);
  useEffect(() => {
    if (!run.finished || preview || sent.current === run.token) return;
    sent.current = run.token;
    callbacks.current.onResult?.({mode: run.mode, answers: run.answers, question_ids: questions.map(q => String(q.id)),
      records: Object.fromEntries(questions.map(q => { const r = run.records[String(q.id)] || {}; return [String(q.id), {
        attempts: Math.min(1000, r.attempts || 0), firstCorrect: Boolean(r.firstCorrect), revealed: Boolean(r.revealed), hinted: Boolean(r.hinted),
      }]; })), token: run.token});
  }, [run.finished, run.token, preview]);

  const check = () => {
    if (!ready || composing || correct || revealed || selfCheck) return;
    const fingerprint = JSON.stringify([run.index, run.answers]);
    if (lastCheck.current === fingerprint) return;
    lastCheck.current = fingerprint;
    sounds.feedback(gradeExercise(exercise, batch, run.answers).answers.every(row => row.correct));
    setRun(current => {
      const checked = recordCheck(exercise, batch, current.answers, current.records);
      return {...current, records: checked.records, rows: checked.result.answers};
    });
  };
  const auto = !selfCheck && mode !== 'matching' && ['multiple_choice', 'inline_selection', 'true_false_not_given'].includes(mode)
    && !batch.some(q => (q.kind || exercise.kind) === 'multi');
  useEffect(() => {
    if (!auto || !ready || correct || revealed) return;
    const timer = setTimeout(check, 300);
    return () => clearTimeout(timer);
  }, [run.answers, run.index, auto, ready, correct, revealed, composing]);

  const update = (key, value) => {
    if (JSON.stringify(run.answers[key]) !== JSON.stringify(value)) lastCheck.current = '';
    setRun(current => {
      if (current.finished || (!selfCheck && (revealed || current.rows.some(row => row.key === String(key) && row.correct)))) return current;
      return {...current, answers: {...current.answers, [key]: value}, rows: current.rows.filter(row => row.key !== String(key))};
    });
  };
  const reveal = () => setRun(current => ({...current,
    revealed: [...new Set([...current.revealed, ...batch.map(q => String(q.id))])],
    records: {...current.records, ...Object.fromEntries(batch.filter(q => !current.records[String(q.id)]?.correct).map(q => [String(q.id),
      {...current.records[String(q.id)], firstCorrect: false, revealed: true, correct: false}]))},
  }));
  const next = () => {
    lastCheck.current = '';
    setRun(current => {
      if (current.index + 1 < groups.length) return {...current, index: current.index + 1, rows: []};
      const records = selfCheck ? recordCheck(exercise, questions, current.answers, {}).records : current.records;
      return {...current, records, finished: true, rows: []};
    });
  };
  const start = (nextMode, ids = null) => {setRun(newPracticeRun(nextMode, ids)); lastCheck.current = ''; setConfirmMode(null);};
  const chooseMode = nextMode => {
    if (nextMode === run.mode) return;
    if (!run.finished && Object.keys(run.answers).length) setConfirmMode(nextMode);
    else start(nextMode);
  };
  if (!all.length) return <>{renderHeader?.()}<Status>{tr('This exercise has no questions yet.')}</Status></>;
  const summary = runSummary(questions, run.records);
  const weak = weakQuestionIds(questions, run.records);
  const common = {exercise, questions: batch, answers: run.answers, onAnswer: update,
    disabled: run.finished || (!selfCheck && (revealed || correct)), rows: selfCheck ? [] : run.rows, uiStyle: style, revealed: !selfCheck && revealed};
  const settingsButton = <Btn isIconOnly aria-label={tr('Exercise settings')} aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}><Icon name="settings" size={18}/></Btn>;
  return <>
    {renderHeader ? renderHeader(settingsButton) : <div className="flex justify-end">{settingsButton}</div>}
    {settingsOpen && <PracticeModal title={tr('Exercise settings')} size="md" onClose={() => {setSettingsOpen(false); setConfirmMode(null);}}>
    <div role="group" aria-label={tr('Study mode')} className="flex flex-wrap gap-2">
      <Btn aria-pressed={!selfCheck} onClick={() => chooseMode('practice')}>{tr('Practice')}</Btn>
      <Btn aria-pressed={selfCheck} onClick={() => chooseMode('self_check')}>{tr('Self-check')}</Btn>
      <Btn aria-pressed={soundEnabled} onClick={() => setSoundEnabled(value => !value)}>{tr(soundEnabled ? 'Mute exercise audio' : 'Enable exercise audio')}</Btn>
    </div>
    {confirmMode && <div role="alert"><p>{tr('Changing mode starts a new attempt. Your saved progress is kept.')}</p><Btn onClick={() => start(confirmMode)}>{tr('Start new attempt')}</Btn><Btn onClick={() => setConfirmMode(null)}>{tr('Cancel')}</Btn></div>}
    </PracticeModal>}
    <div className="exercise-workspace practice-journey learning-stage" data-ui-style={style}>
    {run.finished ? <section className="journey-finish">
      <h2>{tr('Session complete')}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {[[tr('Correct on first try'), summary.first], [tr('Correct after support or retry'), summary.retried], [tr('Answers revealed'), summary.revealed], [tr('Needs more practice'), summary.incorrect]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}
      </dl>
      {questions.map(q => <details key={q.id}><summary>{tr('Question {number}', {number: q.position})} · {tr(run.records[String(q.id)]?.firstCorrect ? 'Correct on first try' : 'Review')}</summary>
        <PracticeRichText>{q.prompt}</PracticeRichText>
        {gradeExercise(exercise, [q], run.answers).answers.map(row => <p key={row.key}>{row.answer || '—'} → {row.expected.join(' / ')}</p>)}
        {q.presentation?.explanation && <PracticeRichText>{q.presentation.explanation}</PracticeRichText>}
        {q.presentation?.distractor_explanation && <PracticeRichText>{q.presentation.distractor_explanation}</PracticeRichText>}
        {proposalSlot?.(q, run.answers[String(q.id)])}
      </details>)}
      <div className="flex flex-wrap gap-2">
        {weak.length > 0 && <Btn primary onClick={() => start('practice', weak)}>{tr('Practice weak questions')}</Btn>}
        <Btn onClick={() => start(run.mode)}>{tr('Practice again to reinforce learning')}</Btn>
        {onNext && <Btn onClick={onNext}>{tr('Next exercise')}</Btn>}
      </div>
    </section> : <>
      <div className="journey-topline"><span>{tr('Group {current} of {total}', {current: run.index + 1, total: groups.length})}</span><progress aria-label={tr('Lesson progress')} value={run.index} max={groups.length}/></div>
      {exercise.instruction && <PracticeRichText>{exercise.instruction}</PracticeRichText>}
      {exercise.context && <aside className="reading-document"><PracticeRichText>{exercise.context}</PracticeRichText></aside>}
      <ExerciseMedia items={(exercise.attachments || []).filter(item => !item.question || batch.some(q => String(q.id) === String(item.question)))}/>
      <section className="work-paper journey-question" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
        {mode === 'cloze_drag_drop' ? <GroupedGaps {...common}/> : mode === 'matching' ? <MatchPairs key={run.token} {...common} deferred/> : mode === 'categorization' ? <Categories {...common}/> : batch.map(q => <div key={`${run.token}:${q.id}`}>
          {!q.blanks?.length && mode !== 'error_correction' && <p className="work-prompt"><PracticeRichText>{q.prompt}</PracticeRichText></p>}
          {(q.kind || exercise.kind) === 'multi' && <p>{tr('Select all correct answers, then check.')}</p>}
          <TypeQuestion {...common} q={q}/>
        </div>)}
        {!selfCheck && <div aria-live="polite">
          {hasAttempt && <p>{tr(correct ? 'Correct!' : 'Not quite. Try again.')}</p>}
          {batch.map(q => {
            const record = run.records[String(q.id)] || {};
            return <div key={q.id}>
              {!record.correct && !revealed && record.attempts >= 1 && q.presentation?.hint && <Btn onClick={() => setRun(current => ({...current, records: {...current.records, [String(q.id)]: {...current.records[String(q.id)], hinted: true}}}))}>{tr('Show hint')}</Btn>}
              {record.hinted && q.presentation?.hint && <PracticeRichText>{q.presentation.hint}</PracticeRichText>}
              {(record.correct || revealed) && <>
                {revealed && <p>{exerciseSolution(exercise, q).join(' / ')}</p>}
                {q.presentation?.explanation && <PracticeRichText>{q.presentation.explanation}</PracticeRichText>}
                {q.presentation?.distractor_explanation && <PracticeRichText>{q.presentation.distractor_explanation}</PracticeRichText>}
              </>}
              {hasAttempt && !record.correct && proposalSlot?.(q, run.answers[String(q.id)])}
            </div>;
          })}
          {(correct || revealed) && exercise.presentation?.comment && <PracticeRichText>{exercise.presentation.comment}</PracticeRichText>}
        </div>}
        <div className="exercise-check-actions">
          {selfCheck ? <>
            {run.index > 0 && <Btn onClick={() => setRun(current => ({...current, index: current.index - 1}))}>{tr('Previous')}</Btn>}
            <Btn primary isDisabled={!ready || composing} onClick={next}>{tr(run.index + 1 === groups.length ? 'Submit answers' : 'Next')}</Btn>
          </> : correct || revealed ? <Btn primary onClick={next}>{tr('Continue')}</Btn> : <>
            <Btn primary isDisabled={!ready || composing} onClick={check}>{tr('Check')}</Btn>
            <Btn isDisabled={composing} onClick={reveal}>{tr('Show answer')}</Btn>
          </>}
        </div>
      </section>
    </>}
  </div></>;
}
