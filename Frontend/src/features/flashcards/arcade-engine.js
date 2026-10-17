export function nextBridgeWord(tokens, used, candidate) {
  const expected = tokens[used.length];
  const picked = tokens.find(t => t.id === candidate);
  return Boolean(picked && expected && !used.includes(candidate) && picked.text === expected.text);
}
export function reward(mistakes, hints, streak) {
  return Math.max(10, 100 - mistakes * 15 - hints * 25) + Math.min(streak, 5) * 10;
}
