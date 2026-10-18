import { useState } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import {
  endpoint,
  request,
  useResource,
  useAction,
  useNavigate,
} from "../../lib/core.js";
import {
  Page,
  Heading,
  SidebarTools,
  Link,
  Icon,
  Field,
  Select,
  Btn,
  Glass,
  Loading,
  Status,
} from "../../components/ui/ui.jsx";
export default function FlashcardDiscover({ lang }) {
  useLocale();
  const navigate = useNavigate(),
    action = useAction();
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [level, setLevel] = useState(""),
    [page, setPage] = useState(1),
    [topic, setTopic] = useState("");
  const resource = useResource(
    endpoint(
      lang,
      `flashcard/discover/?${new URLSearchParams({ q, level, topic, page })}`,
    ),
    true,
  );
  return (
    <Page>
      <Heading title={tr("Explore")} />
      <SidebarTools>
        <Link
          className="btn flash-icon-link"
          to={`/${lang}/flashcard`}
          title={tr("My Flashcards")}
          aria-label={tr("My Flashcards")}
        >
          <Icon name="home" />
        </Link>
      </SidebarTools>
      <form
        className="flex flex-wrap gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
          setPage(1);
        }}
      >
        <Field label={tr("Search decks")} value={search} onChange={setSearch} />
        <Select
          label={tr("Level")}
          value={level}
          onChange={(v) => {
            setLevel(v);
            setPage(1);
          }}
        >
          <option value="">{tr("All")}</option>
          {["A1", "A2", "B1", "B2", "C1", "C2"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
        <Field
          label={tr("Topic")}
          value={topic}
          onChange={(v) => {
            setTopic(v);
            setPage(1);
          }}
        />
        <Btn type="submit" icon="search">
          {tr("Search")}
        </Btn>
      </form>
      <Status error={action.error} />
      <Loading resource={resource}>
        {(data) => (
          <>
            <div className="deck-grid my-5">
              {data.results.map((d) => (
                <Glass key={d.id}>
                  <h3>{d.title}</h3>
                  <p>
                    {d.author} · {d.level} · {d.count} {tr("terms")}
                  </p>
                  {d.topic && <p>{d.topic}</p>}
                  <Btn
                    primary
                    isDisabled={action.pending}
                    onClick={() =>
                      action.run(async (signal) => {
                        const result = d.saved_id
                          ? { id: d.saved_id }
                          : await request(
                              endpoint(
                                lang,
                                `flashcard/discover/${d.id}/copy/`,
                              ),
                              "POST",
                              {},
                              signal,
                            );
                        navigate(`/${lang}/flashcard/deck/${result.id}`);
                      })
                    }
                  >
                    {tr(
                      d.saved_id ? "Continue learning" : "Add to My Flashcards",
                    )}
                  </Btn>
                </Glass>
              ))}
            </div>
            {!data.results.length && <p>{tr("Content not found.")}</p>}
            <div className="toolbar">
              <Btn isDisabled={page <= 1} onClick={() => setPage(page - 1)}>
                {tr("Previous")}
              </Btn>
              <span>
                {data.page} / {data.pages}
              </span>
              <Btn
                isDisabled={page >= data.pages}
                onClick={() => setPage(page + 1)}
              >
                {tr("Next")}
              </Btn>
            </div>
          </>
        )}
      </Loading>
    </Page>
  );
}
