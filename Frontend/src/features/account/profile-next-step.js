// Only offer a concrete next lesson when the profile has one available.
export function profileNextStep(data, lang) {
  if (data.resume) return { to: data.resume, label: "Continue session" };
  const decks = data.decks.filter(deck => deck.total > 0);
  const due = decks.find(deck => deck.due > 0);
  const deck = due || decks[0];
  const hasActivity = Boolean(
    data.reviews || data.sessions || data.today_questions || data.timeline?.length ||
    data.cards?.familiar || data.cards?.mastered || decks.some(item => item.mastered > 0)
  );
  if (deck) return {
    to: `/${lang}/flashcard/deck/${deck.id}`,
    label: due ? "Review due cards" : hasActivity ? "Continue learning" : "Start learning",
  };
  return { to: `/${lang}/flashcard/discover`, label: "Discover" };
}
