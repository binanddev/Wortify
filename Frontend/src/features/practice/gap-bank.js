// Merge banks by maximum multiplicity: repeated words can fill multiple gaps,
// but an exercise-wide bank repeated on every question is not multiplied.
export function mergeWordBanks(banks) {
 const counts = new Map();
 for (const bank of banks) {
  const local = new Map();
  for (const value of bank || []) {
   const word = String(value).trim();
   if (word) local.set(word, (local.get(word) || 0) + 1);
  }
  for (const [word, count] of local) counts.set(word, Math.max(count, counts.get(word) || 0));
 }
 return [...counts].flatMap(([word,count])=>Array(count).fill(word));
}
export function questionWordBank(q) {
 return mergeWordBanks([
  q.presentation?.word_bank, q.presentation?.distractors,
  (q.blanks || []).flatMap(b=>b.answers || []),
  (q.blanks || []).flatMap(b=>b.options || []),
 ]);
}
export function sharedGapQuestions(questions) {
 const bank = mergeWordBanks(questions.filter(q=>!q.example).map(questionWordBank));
 return questions.map(q=>({...q,presentation:{...q.presentation,word_bank:bank}}));
}
