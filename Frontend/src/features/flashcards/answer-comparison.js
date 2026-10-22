import { normalize } from "../learning/local-learning.js";
import negationWords from "./answer-negations.json" with { type: "json" };

const NEGATIONS = new Set(Object.values(negationWords).flat());
const tokens = (text, options) => String(text ?? "").normalize("NFC").trim().split(/\s+/u)
  .map(text => ({ text, key: normalize(text, options, true) })).filter(word => word.key);
function negatives(text) {
  const expanded = String(text ?? "").toLowerCase().replace(/\b(?:can['’]t|won['’]t|shan['’]t|[a-z]+n['’]t)\b/gu, " not ");
  return normalize(expanded.replace(/\bcannot\b/gu, "not"), {}, true).split(" ").filter(word => NEGATIONS.has(word)).join(" ");
}
function similarity(a, b) {
  if (a === b) return 1;
  // Short words and very long tokens require exact spelling.
  if (Math.min(a.length, b.length) <= 3 || Math.max(a.length, b.length) > 80) return 0;
  let row = Array.from({length:b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j-1]+1, row[j]+1, row[j-1]+Number(a[i-1] !== b[j-1]));
    row = next;
  }
  const score = 1 - row[b.length] / Math.max(a.length, b.length);
  return score >= 0.7 ? score : 0;
}
function align(expected, actual) {
  const rows = Array.from({length:expected.length + 1}, () => []);
  for (let i = 0; i <= expected.length; i++) rows[i][0] = {cost:i, op:"missing"};
  for (let j = 1; j <= actual.length; j++) rows[0][j] = {cost:j, op:"extra"};
  for (let i = 1; i <= expected.length; i++) for (let j = 1; j <= actual.length; j++) {
    const candidates = [
      {cost:rows[i-1][j-1].cost + 1 - similarity(expected[i-1].key, actual[j-1].key), op:"pair"},
      {cost:rows[i-1][j].cost + 1, op:"missing"},
      {cost:rows[i][j-1].cost + 1, op:"extra"},
    ];
    rows[i][j] = candidates.reduce((best, item) => item.cost < best.cost ? item : best);
  }
  let i = expected.length, j = actual.length;
  const words = [];
  while (i || j) {
    const op = rows[i][j].op;
    if (op === "pair") {
      const target = expected[--i], answer = actual[--j];
      words.unshift({kind:target.key === answer.key ? "correct" : "replace", expected:target.text, actual:answer.text});
    } else if (op === "missing") words.unshift({kind:"missing", expected:expected[--i].text, actual:""});
    else words.unshift({kind:"extra", expected:"", actual:actual[--j].text});
  }
  return {words, ratio:Math.max(0, 1 - rows[expected.length][actual.length].cost / Math.max(expected.length, actual.length, 1))};
}
export function compareAnswer(expected, value, options = {}, alternatives = []) {
  const answer = String(value ?? "");
  const actual = tokens(answer, options);
  const matches = [expected, ...alternatives].map(target => {
    const targetWords = tokens(target, options);
    const exact = !!normalize(answer, options, true) && normalize(target, options, true) === normalize(answer, options, true);
    let result;
    if (exact) result = {ratio:1, words:targetWords.map(word => ({kind:"correct", expected:word.text, actual:word.text}))};
    else if (targetWords.length > 256 || actual.length > 256 || answer.length > 4096)
      result = {ratio:0, words:[{kind:"replace", expected:String(target), actual:answer.slice(0,4096)}]};
    else result = align(targetWords, actual);
    if (!targetWords.length || !actual.length) result.ratio = 0;
    const negationMismatch = negatives(target) !== negatives(answer);
    const correct = exact || (options.gradingMode === "flexible" && actual.length > 0 && result.ratio + 1e-9 >= 0.7 && !negationMismatch);
    return {...result, correct, negationMismatch:!exact && negationMismatch, score:Math.floor(result.ratio * 100 + 1e-8), expected:target};
  });
  return matches.reduce((best, item) => Number(item.correct) > Number(best.correct) || item.correct === best.correct && item.score > best.score ? item : best);
}
