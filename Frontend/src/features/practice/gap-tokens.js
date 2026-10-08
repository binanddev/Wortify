// Each occurrence in the bank is a separate physical token, including duplicates.
export function allocateGapTokens(chips, answers, questionId, count) {
  const used = new Set();
  const slots = Array.from({ length: count }, (_, index) => {
    const value = answers[`${questionId}_${index}`];
    const token = value
      ? chips.find((c) => c.text === value && !used.has(c.id))
      : null;
    if (token) used.add(token.id);
    return token || null;
  });
  return { slots, bank: chips.filter((c) => !used.has(c.id)) };
}
export function gapMove(questionId, slots, token, target) {
  const source = slots.findIndex((c) => c?.id === token.id);
  if (source === target) return [];
  const changes = [];
  if (source >= 0) changes.push([`${questionId}_${source}`, ""]);
  if (target !== null) changes.push([`${questionId}_${target}`, token.text]);
  return changes;
}

// Bipartite matching handles alternative answers without consuming a token twice.
export function canFillGapBank(blanks, words) {
  const owners = Array(words.length).fill(-1);
  const place = (blank, seen) => {
    for (let i = 0; i < words.length; i++) {
      if (seen.has(i) || !blanks[blank].answers.includes(words[i])) continue;
      seen.add(i);
      if (owners[i] === -1 || place(owners[i], seen)) {
        owners[i] = blank;
        return true;
      }
    }
    return false;
  };
  return blanks.every((_, index) => place(index, new Set()));
}
