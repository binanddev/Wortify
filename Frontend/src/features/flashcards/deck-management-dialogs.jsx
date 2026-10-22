import { useState, lazy, Suspense } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { endpoint, useResource, useAction } from "../../lib/core.js";
import { Btn, Field, Select, Status } from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { folderPath } from "./flashcard-navigation.jsx";
const CardManager = lazy(() => import("./card-manager.jsx"));

export function DeckTransferDialog({
  operation,
  folders,
  initialFolder,
  onClose,
  onSubmit,
}) {
  useLocale();
  const [folder, setFolder] = useState(String(initialFolder ?? "")),
    [query, setQuery] = useState("");
  const [title, setTitle] = useState(
    operation.decks.length === 1
      ? tr("{title} (copy)", { title: operation.decks[0].title }).slice(0, 150)
      : "",
  );
  const action = useAction(),
    copy = operation.action === "copy";
  const unchanged = operation.decks.every(
    (deck) => (deck.folder_id ?? null) === (folder ? Number(folder) : null),
  );
  const selected = folders.find((item) => String(item.id) === folder);
  const matches = folders.filter((item) =>
    folderPath(folders, item)
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const options =
    selected && !matches.some((item) => item.id === selected.id)
      ? [selected, ...matches]
      : matches;
  return (
    <PracticeModal
      title={tr(copy ? "Copy to folder" : "Move to folder")}
      size="lg"
      onClose={onClose}
      pending={action.pending}
    >
      <p className="deck-operation-summary">
        {operation.decks.length === 1
          ? operation.decks[0].title
          : tr("{count} selected", { count: operation.decks.length })}
      </p>
      {copy && operation.decks.length === 1 && (
        <Field
          label={tr("Deck name")}
          value={title}
          onChange={setTitle}
          maxLength={150}
          isRequired
        />
      )}
      <Field
        label={tr("Find a destination")}
        value={query}
        onChange={setQuery}
      />
      <Select
        label={tr("Destination folder")}
        value={folder}
        onChange={setFolder}
      >
        <option value="">{tr("My Flashcards")}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {folderPath(folders, item)}
          </option>
        ))}
      </Select>
      {copy && (
        <p className="study-options-note">
          {tr("Copies start with their own learning progress.")}
        </p>
      )}
      <Status error={action.error} />
      <div className="deck-dialog-actions">
        <Btn onClick={onClose} isDisabled={action.pending}>
          {tr("Cancel")}
        </Btn>
        <Btn
          primary
          isLoading={action.pending}
          isDisabled={
            copy ? operation.decks.length === 1 && !title.trim() : unchanged
          }
          onClick={() =>
            action.run(async (signal) => {
              await onSubmit(
                {
                  action: operation.action,
                  ids: operation.decks.map((deck) => deck.id),
                  folder: folder ? Number(folder) : null,
                  ...(copy && operation.decks.length === 1
                    ? { names: { [operation.decks[0].id]: title.trim() } }
                    : {}),
                },
                signal,
              );
              onClose();
            })
          }
        >
          {tr(copy ? "Copy" : "Move")}
        </Btn>
      </div>
    </PracticeModal>
  );
}
export function DeckExportDialog({ lang, decks, onClose }) {
  useLocale();
  const ids = decks.map((deck) => deck.id);
  return (
    <PracticeModal title={tr("Export decks")} size="md" onClose={onClose}>
      <p className="deck-operation-summary">
        {decks.length === 1
          ? decks[0].title
          : tr("{count} selected", { count: decks.length })}
      </p>
      <div className="flash-action-menu">
        {["json", "csv"].map((format) => (
          <a
            key={format}
            className="btn"
            download
            href={endpoint(
              lang,
              ids.length === 1
                ? `decks/${ids[0]}/export/${format}/`
                : `decks/export/?ids=${ids.join(",")}&format=${format}`,
            )}
          >
            {format.toUpperCase()}
            {ids.length > 1 ? " · ZIP" : ""}
          </a>
        ))}
      </div>
    </PracticeModal>
  );
}
export function LibraryCardsDialog({ lang, deck, onClose, onChanged }) {
  const resource = useResource(endpoint(lang, `decks/${deck.id}/`)),
    [cards, setCards] = useState(null);
  const update = (items) => {
    setCards(items);
    onChanged();
  };
  return resource.data ? (
    <Suspense
      fallback={
        <PracticeModal title={tr("Manage cards")} onClose={onClose}>
          <Status>{tr("Loading deck…")}</Status>
        </PracticeModal>
      }
    >
      <CardManager
        lang={lang}
        deckId={deck.id}
        cards={cards ?? resource.data.cards}
        onClose={onClose}
        onCardsChanged={update}
        onUpdated={(card) =>
          update(
            (cards ?? resource.data.cards).map((item) =>
              item.id === card.id ? card : item,
            ),
          )
        }
      />
    </Suspense>
  ) : (
    <PracticeModal title={tr("Manage cards")} onClose={onClose}>
      <Status error={resource.error}>{tr("Loading deck…")}</Status>
    </PracticeModal>
  );
}
