import { useState } from "react";
import { useResource, endpoint } from "../../lib/core.js";
import { Btn, Loading } from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
export default function PublicDeckStudy({
  lang,
  deck,
  onClose,
  onRequireAccount,
}) {
  useLocale();
  const [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false);
  const resource = useResource(
    endpoint(
      lang,
      `flashcard/discover/${deck.id}/?study=true&page=${Math.floor(index / 30) + 1}`,
    ),
  );
  const step = (n) => {
    setIndex(n);
    setFlipped(false);
  };
  return (
    <PracticeModal title={deck.title} onClose={onClose}>
      <Loading resource={resource}>
        {(data) => {
          const card = data.cards[index % 30];
          return (
            <>
              {card ? (
                <>
                  <button
                    className="w-full min-h-64 rounded-2xl border border-(--line) p-6 text-center bg-(--surface)"
                    onClick={() => setFlipped(!flipped)}
                    aria-label={tr("Flip card")}
                  >
                    <strong className="block text-2xl">
                      {flipped ? card.vietnamese_meaning : card.german_text}
                    </strong>
                    <span className="block mt-4">
                      {flipped ? card.example_vietnamese : card.example_german}
                    </span>
                  </button>
                  <div className="flex justify-center items-center gap-3">
                    <Btn
                      isDisabled={index === 0}
                      onClick={() => step(index - 1)}
                    >
                      {tr("Previous")}
                    </Btn>
                    <span>
                      {index + 1} / {data.count}
                    </span>
                    <Btn
                      isDisabled={index + 1 >= data.count}
                      onClick={() => step(index + 1)}
                    >
                      {tr("Next")}
                    </Btn>
                  </div>
                </>
              ) : (
                <p>{tr("Content not found.")}</p>
              )}
              <Btn primary onClick={onRequireAccount}>
                {tr("Add to My Flashcards")}
              </Btn>
            </>
          );
        }}
      </Loading>
    </PracticeModal>
  );
}
