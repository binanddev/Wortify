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

// Keep authored exercise banks intact while providing enough copies for a group
// that contains the same accepted word in several different gaps.
export function groupedWordBank(questions) {
 const active = questions.filter(q => !q.example);
 return mergeWordBanks([
  ...active.map(questionWordBank),
  active.flatMap(q => (q.blanks || []).flatMap(blank => [...new Set(blank.answers || [])])),
 ]);
}

export function groupGapQuestions(questions, groupSize = 6) {
 const size = Number.isInteger(groupSize) ? Math.max(5, Math.min(8, groupSize)) : 6;
 const active = questions.filter(q => !q.example);
 const groups = [];
 for (let offset = 0; offset < active.length; offset += size) groups.push(active.slice(offset, offset + size));
 return groups;
}

export function allocateGroupedGapTokens(chips, answers, questions) {
 const available = [...chips];
 const slots = {};
 for (const q of questions) {
  const count = q.blank_count || q.blanks?.length || 0;
  for (let i = 0; i < count; i++) {
   const key = `${q.id}_${i}`;
   const index = answers[key] ? available.findIndex(token => token.text === answers[key]) : -1;
   slots[key] = index >= 0 ? available.splice(index, 1)[0] : null;
  }
 }
 return {slots, bank: available};
}

export function groupedGapMove(slots, token, target, locked = new Set()) {
 const source = Object.keys(slots).find(key => slots[key]?.id === token.id);
 if ((source && locked.has(source)) || (target !== null && (!Object.hasOwn(slots, target) || locked.has(target))) || source === target) return [];
 if (target === null) return source ? [[source, '']] : [];
 const changes = [];
 if (source) changes.push([source, slots[target]?.text || '']);
 changes.push([target, token.text]);
 return changes;
}
