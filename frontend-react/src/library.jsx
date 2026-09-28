import { PracticeModal } from "./practice-workspace";
import { SidebarTools } from "./ui";
import { useEffect, useState } from "react";
import {
  endpoint,
  request,
  useResource,
  useAction,
  navigate,
  shuffled,
} from "./core";
import {
  Btn,
  Icon,
  Glass,
  Page,
  Heading,
  Status,
  Loading,
  Field,
  Select,
  Editor,
  Confirm,
  Link,
  FlipCard,
  useSound,
} from "./ui";
const deckFields = [
  { name: "title", label: "Tên bộ thẻ", isRequired: true },
  { name: "description", label: "Mô tả", multiline: true },
  { name: "topic", label: "Chủ đề", advanced: true },
];
const cardFields = [
  { name: "german_text", label: "Từ vựng", isRequired: true },
  { name: "vietnamese_meaning", label: "Nghĩa tiếng Việt", isRequired: true },
  ...Object.entries({
    example_german: "Câu ví dụ",
    example_vietnamese: "Nghĩa câu ví dụ",
    part_of_speech: "Loại từ",
    article: "Mạo từ",
    plural_form: "Số nhiều",
    notes: "Ghi chú",
    usage: "Cách dùng",
    accepted_answers: "Đáp án khác (mỗi dòng một đáp án)",
    accepted_examples: "Câu ví dụ khác (mỗi dòng một câu)",
  }).map(([name, label]) => ({ name, label, advanced: true, multiline: true })),
];
function DeckOptions({ values, set, folders }) {
  return (
    <div className="grid two">
      <Select
        label="Folde"
        value={values.folder}
        onChange={(folder) => set({ ...values, folder })}
      >
        <option value="">Chưa xếp folde</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <Select
        label="Trình độ"
        value={values.level || "A1"}
        onChange={(level) => set({ ...values, level })}
      >
        {["A1", "A2", "B1", "B2", "C1", "C2"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </Select>
    </div>
  );
}
export function Library({ lang }) {
  const resource = useResource(endpoint(lang, "decks/"));
  return (
    <Loading resource={resource}>
      {(data) => (
        <LibraryContent
          key={lang}
          {...{ data, lang, reload: resource.reload }}
        />
      )}
    </Loading>
  );
}
function LibraryContent({ data, lang, reload }) {
  const [query, setQuery] = useState(""),
    [folder, setFolder] = useState(
      () => new URLSearchParams(window.location.search).get("folder") || "all",
    ),
    [sort, setSort] = useState("recent"),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [panel, setPanel] = useState(null),
    [layout, setLayout] = useState("grid");
  const action = useAction();
  const api = (p, m, d, s) => request(endpoint(lang, p), m, d, s);
  let decks = data.decks.filter(
    (d) =>
      (folder === "all" || String(d.folder_id ?? "") === folder) &&
      `${d.title} ${d.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (sort === "name") decks.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "count") decks.sort((a, b) => b.count - a.count);
  const selected = data.folders.find((f) => String(f.id) === folder);
  return (
    <Page>
      <div className="flash-library-heading">
        <div>
          <h1>
            {selected?.name ||
              (folder === "" ? "Chưa xếp folde" : "My Flashcards")}
          </h1>
        </div>
        <div className="flash-icon-row">
          <Btn
            icon="grid"
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            Dạng lưới
          </Btn>
          <Btn
            icon="list"
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
          >
            Dạng danh sách
          </Btn>
        </div>
      </div>
      <Status error={action.error} />
      <SidebarTools>
        <div className="flash-nav">
          <Field
            label="Tìm bộ thẻ"
            value={query}
            onChange={setQuery}
            startContent={<Icon name="search" />}
          />
          <div className="flash-icon-row">
            <Btn primary icon="plus" onClick={() => setPanel("add")}>
              Thêm mới
            </Btn>
            <Btn icon="settings" onClick={() => setPanel("settings")}>
              Sắp xếp và quản lý
            </Btn>
            <Btn
              icon="spark"
              isDisabled={!data.due}
              isLoading={action.pending}
              onClick={() =>
                action.run(async (signal) => {
                  const session = await api(
                    "sessions/",
                    "POST",
                    { kind: "learn", today: true },
                    signal,
                  );
                  navigate(`/${lang}/flashcard/session/${session.token}`);
                })
              }
            >{`Ôn hôm nay · ${data.due} thẻ`}</Btn>
            {data.resume && (
              <Link
                className="btn flash-icon-link"
                title="Tiếp tục buổi học"
                aria-label="Tiếp tục buổi học"
                to={`/${lang}/flashcard/session/${data.resume}`}
              >
                <Icon name="play" />
              </Link>
            )}
          </div>
          <div className="flash-folder-list" aria-label="Folde flashcard">
            {[
              { id: "all", name: "My Flashcards", icon: "home" },
              { id: "", name: "Chưa xếp folde", icon: "cards" },
              ...data.folders,
            ].map((f) => (
              <button
                key={f.id}
                title={f.name}
                aria-current={folder === String(f.id) ? "page" : undefined}
                onClick={() => setFolder(String(f.id))}
              >
                <Icon name={f.icon || "folder"} />
                <span>{f.name}</span>
                <small>
                  {f.id === "all"
                    ? data.decks.length
                    : data.decks.filter(
                        (d) => String(d.folder_id ?? "") === String(f.id),
                      ).length}
                </small>
              </button>
            ))}
          </div>
        </div>
      </SidebarTools>
      {panel && (
        <PracticeModal
          title={panel === "add" ? "Thêm mới" : "Tùy chọn thư viện"}
          size="md"
          onClose={() => setPanel(null)}
        >
          {panel === "add" ? (
            <div className="flash-action-menu">
              <Btn
                onClick={() => {
                  setPanel(null);
                  setEdit({ type: "deck" });
                }}
              >
                <Icon name="cards" /> Bộ thẻ
              </Btn>
              <Btn
                onClick={() => {
                  setPanel(null);
                  setEdit({ type: "folder" });
                }}
              >
                <Icon name="folder" /> Folde
              </Btn>
            </div>
          ) : (
            <div className="flash-settings">
              <Select label="Sắp xếp" value={sort} onChange={setSort}>
                <option value="recent">Mới cập nhật</option>
                <option value="name">Tên A–Z</option>
                <option value="count">Số lượng thẻ</option>
              </Select>
              {selected && (
                <div className="flash-action-menu">
                  <Btn
                    onClick={() => {
                      setPanel(null);
                      setEdit({ type: "folder", item: selected });
                    }}
                  >
                    <Icon name="edit" /> Đổi tên folde
                  </Btn>
                  <Btn
                    onClick={() => {
                      setPanel(null);
                      setRemove(selected);
                    }}
                  >
                    <Icon name="trash" /> Xóa folde
                  </Btn>
                </div>
              )}
            </div>
          )}
        </PracticeModal>
      )}
      <div
        className={`deck-grid flash-library-grid ${layout === "list" ? "flash-library-list" : ""}`}
      >
        {decks.map((d) => (
          <Link
            className="deck-link"
            key={d.id}
            to={`/${lang}/flashcard/deck/${d.id}`}
          >
            <Glass className="deck-tile">
              <div className="tile-top">
                <span className="tile-icon">
                  <Icon name="cards" size={26} />
                </span>
                <span className="pill">{d.level}</span>
              </div>
              <h3>{d.title}</h3>
              {d.description && <p>{d.description}</p>}
              <div className="tile-bottom">
                <span>{d.count} thuật ngữ</span>
                <Icon name="arrow" />
              </div>
              <div className="thin-progress">
                <span
                  style={{
                    width: `${d.count ? (d.mastered / d.count) * 100 : 0}%`,
                  }}
                />
              </div>
              <small>
                {d.mastered} đã nắm vững{d.due ? ` · ${d.due} cần ôn` : ""}
              </small>
            </Glass>
          </Link>
        ))}
      </div>
      {!decks.length && (
        <div className="flash-empty">
          <Icon name={query ? "search" : "cards"} size={36} />
          <p>{query ? "Không tìm thấy bộ thẻ." : "Chưa có bộ thẻ."}</p>
          <Btn icon="plus" primary onClick={() => setEdit({ type: "deck" })}>
            Tạo bộ thẻ
          </Btn>
        </div>
      )}
      {edit && (
        <Editor
          title={
            edit.type === "deck"
              ? "Tạo bộ thẻ"
              : edit.item
                ? "Đổi tên folde"
                : "Folde mới"
          }
          fields={
            edit.type === "deck"
              ? deckFields
              : [{ name: "name", label: "Tên folde", isRequired: true }]
          }
          initial={
            edit.item || { level: "A1", folder: folder === "all" ? "" : folder }
          }
          onClose={() => setEdit(null)}
          onSave={async (v, s) => {
            const result = await api(
              edit.type === "deck"
                ? "decks/"
                : `folders/${edit.item ? edit.item.id + "/" : ""}`,
              edit.item ? "PATCH" : "POST",
              v,
              s,
            );
            if (edit.type === "deck")
              navigate(`/${lang}/flashcard/deck/${result.id}`);
            else reload();
          }}
        >
          {edit.type === "deck"
            ? (values, set) => (
                <DeckOptions {...{ values, set, folders: data.folders }} />
              )
            : null}
        </Editor>
      )}
      {remove && (
        <Confirm
          title="Xóa folde?"
          description={`Các bộ thẻ trong “${remove.name}” vẫn được giữ lại.`}
          onClose={() => setRemove(null)}
          onConfirm={async (s) => {
            await api(`folders/${remove.id}/`, "DELETE", undefined, s);
            setFolder("all");
            reload();
          }}
        />
      )}
    </Page>
  );
}
export function Deck({ lang, id, sound }) {
  const resource = useResource(endpoint(lang, `decks/${id}/`));
  return (
    <Loading resource={resource}>
      {(data) => (
        <DeckContent {...{ lang, id, data, sound, reload: resource.reload }} />
      )}
    </Loading>
  );
}
function DeckContent({ lang, id, data, reload, sound }) {
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [importing, setImporting] = useState(false),
    [mode, setMode] = useState("flash"),
    [view, setView] = useState("cards"),
    [count, setCount] = useState("20"),
    [filter, setFilter] = useState("all"),
    [order, setOrder] = useState(data.cards),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [reverse, setReverse] = useState(false),
    [auto, setAuto] = useState(false),
    [query, setQuery] = useState(""),
    [toolPanel, setToolPanel] = useState(null);
  const action = useAction(),
    audio = useSound(sound, lang);
  const api = (p, m, d, s) => request(endpoint(lang, p), m, d, s);
  const card = order[index];
  const flip = (v) => {
    setFlipped(v);
    audio.tick();
  };
  const step = (n) => {
    setIndex((i) => Math.max(0, Math.min(order.length - 1, i + n)));
    setFlipped(false);
  };
  useEffect(() => {
    const key = (e) => {
      if (
        e.target.closest("input,textarea,select,[role=dialog]") ||
        edit ||
        importing ||
        remove ||
        toolPanel
      )
        return;
      if (e.code === "Space" && e.target.closest("button")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [order.length, edit, importing, remove, toolPanel]);
  useEffect(() => {
    if (!auto || !card || toolPanel || edit || importing || remove) return;
    const timer = setTimeout(() => {
      if (!flipped) setFlipped(true);
      else if (index < order.length - 1) step(1);
      else setAuto(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [auto, flipped, index, card, toolPanel, edit, importing, remove]);
  const start = () =>
    action.run(async (signal) => {
      if (
        ["spell", "write", "quiz", "speak", "order", "match"].includes(mode)
      ) {
        navigate(
          `/${lang}/flashcard/study?deck=${id}&mode=${mode}&filter=${filter}`,
        );
        return;
      }
      const s = await api(
        "sessions/",
        "POST",
        { kind: mode, deck: id, count: Number(count), filter },
        signal,
      );
      navigate(`/${lang}/flashcard/session/${s.token}`);
    });
  return (
    <Page>
      <Heading
        eyebrow={`${data.deck.level} · ${data.cards.length} THUẬT NGỮ`}
        title={data.deck.title}
        description={data.deck.description}
        contentDescription
      />
      <SidebarTools>
        <div className="flash-icon-row">
          <Btn icon="upload" onClick={() => setImporting(true)}>
            Nhập danh sách
          </Btn>
          <Btn
            icon="edit"
            onClick={() => setEdit({ type: "deck", item: data.deck })}
          >
            Đổi tên bộ thẻ
          </Btn>
          <Btn
            icon="cards"
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            Học thẻ
          </Btn>
          <Btn
            icon="list"
            aria-pressed={view === "terms"}
            onClick={() => setView("terms")}
          >
            Danh sách thuật ngữ
          </Btn>
          <Btn icon="plus" onClick={() => setEdit({ type: "card" })}>
            Thêm thuật ngữ
          </Btn>
          <Btn icon="play" onClick={() => setToolPanel("study")}>
            Thiết lập phiên học
          </Btn>
          <Btn icon="more" onClick={() => setToolPanel("manage")}>
            Xuất và quản lý
          </Btn>
        </div>
      </SidebarTools>
      <div className="study-layout">
        {view === "cards" && (
          <div>
            {card ? (
              <>
                <FlipCard
                  front={reverse ? card.vietnamese_meaning : card.german_text}
                  back={reverse ? card.german_text : card.vietnamese_meaning}
                  example={card.example_german}
                  {...{ flipped }}
                  setFlipped={flip}
                />
                <div className="card-navigation">
                  <Btn
                    aria-label="Thẻ trước"
                    isDisabled={!index}
                    onClick={() => step(-1)}
                  >
                    <Icon name="chevron_left" />
                  </Btn>
                  <span>
                    {index + 1} <span className="muted">/ {order.length}</span>
                  </span>
                  <Btn
                    aria-label="Thẻ tiếp theo"
                    isDisabled={index === order.length - 1}
                    onClick={() => step(1)}
                  >
                    <Icon name="chevron_right" />
                  </Btn>
                </div>
                <div className="toolbar centered">
                  <Btn
                    icon="shuffle"
                    onClick={() => {
                      setOrder(shuffled(order));
                      setIndex(0);
                      setFlipped(false);
                    }}
                  >
                    Trộn thẻ
                  </Btn>
                  <Btn
                    icon="flip"
                    aria-pressed={reverse}
                    onClick={() => {
                      setReverse(!reverse);
                      setFlipped(false);
                    }}
                  >
                    Đảo mặt
                  </Btn>
                  <Btn
                    icon="sound"
                    onClick={() =>
                      action.run(() => audio.speak(card.german_text))
                    }
                  >
                    Nghe
                  </Btn>
                  <Btn
                    icon={auto ? "pause" : "play"}
                    aria-pressed={auto}
                    onClick={() => setAuto(!auto)}
                  >
                    {auto ? "Ⅱ Dừng" : "▷ Tự chạy"}
                  </Btn>
                </div>
              </>
            ) : (
              <Glass>
                <h3>Bộ thẻ đang chờ từ đầu tiên</h3>

                <Btn
                  icon="plus"
                  primary
                  onClick={() => setEdit({ type: "card" })}
                >
                  Thêm thuật ngữ
                </Btn>
              </Glass>
            )}
          </div>
        )}
        {toolPanel === "study" && (
          <PracticeModal
            title="Phiên học"
            size="md"
            onClose={() => setToolPanel(null)}
          >
            <div className="flash-settings">
              <span className="tile-icon">
                <Icon name="spark" size={26} />
              </span>
              <Select label="Chế độ học" value={mode} onChange={setMode}>
                {[
                  ["flash", "Flashcards · Tự đánh giá"],
                  ["learn", "Learn · Luyện ghi nhớ"],
                  ["test", "Test · Kiểm tra"],
                  ["quiz", "Trắc nghiệm"],
                  ["write", "Nhớ và viết"],
                  ["spell", "Nghe và chép"],
                  ["order", "Sắp xếp câu"],
                  ["match", "Ghép cặp"],
                  ["speak", "Luyện nói"],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </Select>
              {["flash", "learn", "test"].includes(mode) && (
                <Field
                  label="Số câu hỏi"
                  type="number"
                  min="1"
                  max="100"
                  value={count}
                  onChange={setCount}
                />
              )}
              <Select label="Phạm vi thẻ" value={filter} onChange={setFilter}>
                {[
                  ["all", "Tất cả thẻ"],
                  ["due", "Đến hạn"],
                  ["weak", "Cần luyện thêm"],
                  ["new", "Thẻ mới"],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </Select>
              <Btn
                primary
                isDisabled={
                  !data.cards.length || !Number(count) || Number(count) > 100
                }
                isLoading={action.pending}
                onClick={start}
              >
                Bắt đầu học <Icon name="arrow" />
              </Btn>
              <Status error={action.error} />
            </div>
          </PracticeModal>
        )}
      </div>
      {view === "terms" && (
        <>
          <div className="section-heading">
            <h2>
              Thuật ngữ <span className="count">{data.cards.length}</span>
            </h2>
            <Btn icon="plus" primary onClick={() => setEdit({ type: "card" })}>
              Thêm thuật ngữ
            </Btn>
          </div>
          <SidebarTools>
            <Field label="Tìm trong bộ thẻ" value={query} onChange={setQuery} />
          </SidebarTools>
          <div className="term-list">
            {data.cards
              .filter((c) =>
                `${c.german_text} ${c.vietnamese_meaning}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((c) => (
                <Glass className="term-row" key={c.id}>
                  <div>
                    <strong>{c.german_text}</strong>
                    <p>{c.example_german}</p>
                  </div>
                  <div>
                    {c.vietnamese_meaning}
                    <small>{c.example_vietnamese}</small>
                  </div>
                  <div className="toolbar">
                    <Btn
                      aria-label={`Di chuyển ${c.german_text}`}
                      onClick={() => setEdit({ type: "position", item: c })}
                    >
                      ↕
                    </Btn>
                    <Btn
                      icon="edit"
                      onClick={() => setEdit({ type: "card", item: c })}
                    >
                      Sửa
                    </Btn>
                    <Btn
                      icon="trash"
                      onClick={() => setRemove({ type: "card", item: c })}
                    >
                      Xóa
                    </Btn>
                  </div>
                </Glass>
              ))}
          </div>
        </>
      )}
      {toolPanel === "manage" && (
        <PracticeModal
          title="Quản lý bộ thẻ"
          size="md"
          onClose={() => setToolPanel(null)}
        >
          <div className="flash-action-menu">
            <a className="btn" href={endpoint(lang, `decks/${id}/export/csv/`)}>
              <Icon name="download" /> CSV
            </a>
            <a
              className="btn"
              href={endpoint(lang, `decks/${id}/export/json/`)}
            >
              <Icon name="download" /> JSON
            </a>
            <Btn
              onClick={() => {
                setToolPanel(null);
                setRemove({ type: "deck", item: data.deck });
              }}
            >
              <Icon name="trash" /> Xóa bộ thẻ
            </Btn>
          </div>
        </PracticeModal>
      )}
      {edit && (
        <Editor
          title={
            edit.type === "deck"
              ? "Chỉnh sửa bộ thẻ"
              : edit.type === "position"
                ? "Vị trí thuật ngữ"
                : edit.item
                  ? "Sửa thuật ngữ"
                  : "Thêm thuật ngữ"
          }
          fields={
            edit.type === "deck"
              ? deckFields
              : edit.type === "position"
                ? [
                    {
                      name: "position",
                      label: "Vị trí (bắt đầu từ 0)",
                      type: "number",
                      min: 0,
                      isRequired: true,
                    },
                  ]
                : cardFields
          }
          initial={
            edit.item
              ? {
                  ...edit.item,
                  accepted_answers: (edit.item.accepted_answers || []).join(
                    "\n",
                  ),
                  accepted_examples: (edit.item.accepted_examples || []).join(
                    "\n",
                  ),
                }
              : {}
          }
          onClose={() => setEdit(null)}
          onSave={async (v, s) => {
            if (edit.type === "position") {
              const ids = data.cards
                .map((c) => c.id)
                .filter((x) => x !== edit.item.id);
              ids.splice(
                Math.max(0, Math.min(ids.length, Number(v.position))),
                0,
                edit.item.id,
              );
              await api(`decks/${id}/reorder/`, "POST", { ids }, s);
              reload();
              return;
            }
            await api(
              edit.type === "deck"
                ? `decks/${id}/`
                : `decks/${id}/cards/${edit.item ? edit.item.id + "/" : ""}`,
              edit.item ? "PATCH" : "POST",
              v,
              s,
            );
            reload();
          }}
        >
          {edit.type === "deck"
            ? (values, set) => (
                <DeckOptions {...{ values, set, folders: data.folders }} />
              )
            : null}
        </Editor>
      )}
      {remove && (
        <Confirm
          title={remove.type === "deck" ? "Xóa bộ thẻ?" : "Xóa thuật ngữ?"}
          description="Nội dung và tiến độ liên quan sẽ bị xóa. Thao tác này không thể hoàn tác."
          onClose={() => setRemove(null)}
          onConfirm={async (s) => {
            await api(
              remove.type === "deck"
                ? `decks/${id}/`
                : `decks/${id}/cards/${remove.item.id}/`,
              "DELETE",
              undefined,
              s,
            );
            if (remove.type === "deck") navigate(`/${lang}/flashcard`);
            else reload();
          }}
        />
      )}
      {importing && (
        <ImportCards
          {...{ api, id, reload }}
          onClose={() => setImporting(false)}
        />
      )}
    </Page>
  );
}
function ImportCards({ api, id, reload, onClose }) {
  const [preview, setPreview] = useState(null);
  return (
    <Editor
      title={
        preview
          ? `Xác nhận nhập ${preview.count} thẻ`
          : "Nhập danh sách thuật ngữ"
      }
      fields={
        preview
          ? []
          : [
              {
                name: "text",
                label: "Mỗi dòng: từ vựng, nghĩa, câu ví dụ (tùy chọn)",
                multiline: true,
                isRequired: true,
                minRows: 8,
              },
            ]
      }
      initial={{ separator: "," }}
      onClose={onClose}
      onSave={async (v, s) => {
        if (preview) {
          await api(`decks/${id}/import/`, "POST", { token: preview.token }, s);
          reload();
        } else {
          const p = await api(`decks/${id}/import/`, "POST", v, s);
          setPreview(p);
          return false;
        }
      }}
    >
      {(v, set) =>
        preview ? (
          <div>
            {preview.preview.map((r, i) => (
              <p key={i}>
                {r.german_text} — {r.vietnamese_meaning}
              </p>
            ))}
            <Btn icon="edit" onClick={() => setPreview(null)}>
              Sửa nội dung nhập
            </Btn>
          </div>
        ) : (
          <Select
            label="Ký tự ngăn cách"
            value={v.separator}
            onChange={(separator) => set({ ...v, separator })}
          >
            {[
              [",", "Dấu phẩy"],
              [";", "Dấu chấm phẩy"],
              ["\t", "Tab"],
              ["|", "Gạch đứng"],
            ].map(([a, b]) => (
              <option key={a} value={a}>
                {b}
              </option>
            ))}
          </Select>
        )
      }
    </Editor>
  );
}
