import { normalize } from "../learning/local-learning.js";
export function checkRecall(card, answer) {
  const actual = normalize(answer, {}, true);
  const candidates = [card.german_text, ...(card.accepted_answers || [])];
  if (card.article && !card.german_text.toLowerCase().startsWith(card.article.toLowerCase() + " "))
    candidates.push(`${card.article} ${card.german_text}`);
  return !!actual && candidates.some(value => normalize(value, {}, true) === actual);
}
