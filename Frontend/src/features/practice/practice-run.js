import { gradeExercise } from '../learning/local-learning.js';
import { questionKeys } from './practice-session.js';

export function practiceGroups(questions, mode, bankScope) {
  if (['matching', 'categorization'].includes(mode)) return [questions];
  const size = mode === 'cloze_drag_drop' && bankScope !== 'question' ? 6 : 1;
  return Array.from({length: Math.ceil(questions.length / size)}, (_, i) => questions.slice(i * size, (i + 1) * size));
}

export function recordCheck(exercise, questions, answers, records) {
  const result = gradeExercise(exercise, questions, answers);
  const next = {...records};
  for (const q of questions) {
    const id = String(q.id), previous = next[id] || {};
    if (previous.correct || previous.revealed) continue;
    const keys = questionKeys(q);
    const correct = keys.every(key => result.answers.find(row => row.key === key)?.correct);
    const attempts = (previous.attempts || 0) + 1;
    next[id] = {...previous, attempts, firstCorrect: attempts === 1 && correct && !previous.hinted,
      correct, revealed: Boolean(previous.revealed), hinted: Boolean(previous.hinted)};
  }
  return {records: next, result};
}

export function runSummary(questions, records) {
  const counts = {first: 0, retried: 0, revealed: 0, incorrect: 0, hinted: 0};
  for (const q of questions) {
    const row = records[String(q.id)] || {};
    if (row.hinted) counts.hinted++;
    if (row.revealed) counts.revealed++;
    else if (row.firstCorrect) counts.first++;
    else if (row.correct) counts.retried++;
    else counts.incorrect++;
  }
  return counts;
}

export function weakQuestionIds(questions, records) {
  return questions.filter(q => !records[String(q.id)]?.firstCorrect).map(q => String(q.id));
}

export function newPracticeRun(mode = 'practice', ids = null) {
  return {version: 1, mode, ids, index: 0, answers: {}, records: {}, rows: [], revealed: [], finished: false,
    token: globalThis.crypto.randomUUID()};
}

export function restorePracticeRun(snapshot, questions, mode, bankScope) {
  if (!snapshot || snapshot.version !== 1 || !['practice', 'self_check'].includes(snapshot.mode) ||
      !Number.isInteger(snapshot.index) || snapshot.index < 0 || !snapshot.answers || typeof snapshot.answers !== 'object' || Array.isArray(snapshot.answers) ||
      !snapshot.records || typeof snapshot.records !== 'object' || Array.isArray(snapshot.records) ||
      !Array.isArray(snapshot.rows) || !Array.isArray(snapshot.revealed) || typeof snapshot.finished !== 'boolean' ||
      typeof snapshot.token !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(snapshot.token)) return null;
  const ids = new Set(questions.map(q => String(q.id)));
  if (snapshot.ids && (!Array.isArray(snapshot.ids) || !snapshot.ids.length || snapshot.ids.some(id => !ids.has(id)))) return null;
  const selected = snapshot.ids ? questions.filter(q => snapshot.ids.includes(String(q.id))) : questions;
  if (snapshot.index >= Math.max(1, practiceGroups(selected, mode, bankScope).length)) return null;
  const keys = new Set(selected.flatMap(questionKeys));
  if (Object.keys(snapshot.answers).some(key => !keys.has(key)) || Object.keys(snapshot.records).some(key => !ids.has(key))) return null;
  if (Object.values(snapshot.answers).some(value => typeof value !== 'string' && (!Array.isArray(value) || value.some(item => typeof item !== 'string')))) return null;
  if (snapshot.rows.some(row => !row || typeof row.key !== 'string' || typeof row.correct !== 'boolean')) return null;
  if (Object.values(snapshot.records).some(record => !record || typeof record !== 'object' || Array.isArray(record))) return null;
  return snapshot;
}
