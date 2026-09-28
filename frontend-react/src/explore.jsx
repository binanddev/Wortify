import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  Input,
  Select,
  SelectItem,
  Pagination,
  Skeleton,
} from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  endpoint,
  navigate,
  readPreference,
  savePreference,
  useResource,
  useRoute,
} from "./core";
import { Page, SidebarTools, Link, Icon, Status } from "./ui";
import { EXERCISE_TYPES } from "./exercise-types";
import { practiceRoutes } from "./practice-navigation";

export function Explore({ lang, userId }) {
  const routes = practiceRoutes(lang);
  const route = useRoute();
  const params = new URLSearchParams(route.split("?")[1]);
  const query = params.get("q") || "";
  const kind = params.get("kind") || "";
  const mode = params.get("mode") || "";
  const sort = params.get("sort") || "relevance";
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const search = (changes) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    for (const [key, value] of Object.entries(changes))
      value ? next.set(key, String(value)) : next.delete(key);
    navigate(`${routes.explore}${next.size ? `?${next}` : ""}`);
  };
  const resource = useResource(
    endpoint(lang, `practice-hub/explore/?${params}`),
    true,
  );
  const key = `wortify:practice-workspace:${userId}:${lang}`;
  const [pinned, setPinned] = useState(() => {
    const saved = readPreference(key, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [notice, setNotice] = useState("");
  const reduced = useReducedMotion();
  const toggle = (node) =>
    setPinned((previous) => {
      const exists = previous.includes(node.id);
      const next = exists
        ? previous.filter((id) => id !== node.id)
        : [...previous, node.id];
      savePreference(key, next);
      setNotice(
        `${node.title}: ${exists ? "đã bỏ khỏi" : "đã thêm vào"} workspace.`,
      );
      return next;
    });
  return (
    <Page>
      <SidebarTools navOnly>
        <nav className="flex flex-col gap-3" aria-label="Khám phá và học tập">
          <Link to={routes.learn}>Practice Hub · workspace</Link>
          <Link to={`${routes.learn}/all`}>Nội dung tôi có thể xem</Link>
          <Link to={routes.studio}>Create · nội dung của tôi</Link>
          <Link to={routes.guide}>Hướng dẫn tạo bài</Link>
        </nav>
      </SidebarTools>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 py-4">
          <span className="text-sm font-semibold text-[var(--muted)]">
            EXPLORE · HỌC CÙNG CỘNG ĐỒNG
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Hôm nay bạn muốn hiểu thêm điều gì?
          </h1>
          <p className="max-w-2xl text-[var(--muted)]">
            Tìm bài tập và nội dung công khai từ cộng đồng. Chọn một bài để học
            ngay hoặc thêm vào workspace của bạn.
          </p>
        </header>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            search({ q: draft.trim() });
          }}
        >
          <Input
            aria-label="Tìm bài học công khai"
            placeholder="Thử tìm: thì hiện tại đơn…"
            value={draft}
            onValueChange={setDraft}
            startContent={<Icon name="search" />}
            size="lg"
            variant="bordered"
            className="flex-1"
          />
          <Button type="submit" color="primary" size="lg">
            Tìm bài học
          </Button>
        </form>
        {!query && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Thử một chủ đề:</span>
            {["Thì hiện tại đơn", "Thì quá khứ đơn", "Từ vựng"].map((topic) => (
              <Button
                key={topic}
                size="sm"
                variant="flat"
                radius="full"
                onPress={() => search({ q: topic })}
              >
                {topic}
              </Button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            aria-label="Loại nội dung"
            label="Nội dung"
            selectedKeys={[kind || "all"]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (value)
                search({ kind: value === "all" ? "" : value, mode: "" });
            }}
          >
            {[
              ["all", "Tất cả"],
              ["exercise", "Bài tập"],
              ["folder", "Thư mục"],
              ["theory", "Lý thuyết"],
            ].map(([key, label]) => (
              <SelectItem key={key}>{label}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Dạng bài tập"
            label="Dạng bài"
            selectedKeys={[mode || "all"]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (value)
                search({
                  mode: value === "all" ? "" : value,
                  kind: value === "all" ? kind : "exercise",
                });
            }}
          >
            {[["all", "Mọi dạng bài"], ...EXERCISE_TYPES].map(
              ([key, label]) => (
                <SelectItem key={key}>{label}</SelectItem>
              ),
            )}
          </Select>
          <Select
            aria-label="Sắp xếp kết quả"
            label="Sắp xếp"
            selectedKeys={[sort]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (value) search({ sort: value });
            }}
          >
            <SelectItem key="relevance">Phù hợp nhất</SelectItem>
            <SelectItem key="newest">Mới cập nhật</SelectItem>
          </Select>
        </div>
        <Status error={resource.error} />
        <p role="status" className="text-sm text-[var(--muted)]">
          {notice ||
            (resource.loading
              ? "Đang tìm bài học…"
              : `${resource.data?.total || 0} nội dung${query ? ` cho “${query}”` : " công khai"}`)}
        </p>
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-busy={resource.loading}
        >
          {resource.loading
            ? Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))
            : resource.data?.results.map((node, index) => (
                <motion.div
                  key={node.id}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(index, 5) * 0.025,
                  }}
                  className="h-full"
                >
                  <Card
                    className="h-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                    shadow="none"
                  >
                    <CardBody className="gap-3 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <Icon
                          name={node.kind === "folder" ? "folder" : "book"}
                        />
                        <Chip size="sm" variant="flat">
                          {node.kind === "folder"
                            ? "Thư mục"
                            : node.kind === "theory"
                              ? "Lý thuyết"
                              : `${node.question_count} câu`}
                        </Chip>
                      </div>
                      <Link
                        to={`${routes.learn}/${node.id}`}
                        className="text-lg font-semibold leading-snug hover:underline"
                      >
                        {node.title}
                      </Link>
                      <p className="line-clamp-2 text-sm text-[var(--muted)]">
                        {node.description ||
                          EXERCISE_TYPES.find(
                            ([key]) => key === node.interaction,
                          )?.[1] ||
                          "Khám phá nội dung học tập"}
                      </p>
                      <span className="mt-auto text-sm text-[var(--muted)]">
                        Bởi {node.author}
                        {node.can_edit ? " · Bạn" : ""}
                      </span>
                    </CardBody>
                    <CardFooter className="flex-wrap gap-2 px-5 pb-5">
                      <Button
                        color="primary"
                        variant="flat"
                        size="sm"
                        onPress={() => navigate(`${routes.learn}/${node.id}`)}
                      >
                        Mở nội dung
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        aria-pressed={pinned.includes(node.id)}
                        startContent={
                          <Icon
                            size={15}
                            name={pinned.includes(node.id) ? "check" : "plus"}
                          />
                        }
                        onPress={() => toggle(node)}
                      >
                        {pinned.includes(node.id) ? "Đã thêm" : "Workspace"}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
        </div>
        {!resource.loading && !resource.error && !resource.data?.total && (
          <div className="rounded-2xl border border-dashed border-[var(--line)] p-10 text-center">
            <h2 className="text-xl font-semibold">Chưa tìm thấy bài phù hợp</h2>
            <p className="mt-2 text-[var(--muted)]">
              Thử từ khóa ngắn hơn hoặc bỏ bộ lọc. Bạn cũng có thể tạo bài học
              của riêng mình trong Create.
            </p>
            <Button
              className="mt-4"
              variant="flat"
              onPress={() => search({ q: "", kind: "", mode: "" })}
            >
              Xem mọi chủ đề
            </Button>
          </div>
        )}
        {!resource.loading && resource.data?.pages > 1 && (
          <Pagination
            aria-label="Trang kết quả"
            total={resource.data.pages}
            page={resource.data.page}
            onChange={(page) => search({ page })}
            showControls
          />
        )}
      </section>
    </Page>
  );
}
