import { t as tr, useLocale, dateLocale } from "../../i18n/index.js";
import { lazy, Suspense, useId, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  GraduationCap,
  Plus,
  Search,
  Settings2,
  Users,
  UserPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Modal } from "../../components/modal/modal.jsx";
import {
  endpoint,
  request,
  useResource,
  useAction,
  useNavigate,
  useRoute,
} from "../../lib/core.js";
import {
  Page,
  Heading,
  Btn,
  Field,
  Select,
  Status,
  Loading,
  Link,
  Editor,
  Confirm,
} from "../../components/ui/ui.jsx";
import {
  filterClassroomItems,
  visibleAssignments,
  deadlineState,
  localDeadlineInput,
  assignmentDueValue,
} from "./classroom-model.js";
import "./classroom.css";
const TeachingRoom = lazy(() => import("../teaching/TeachingRoom.jsx"));

export function Community(props) {
  useLocale();
  return <CommunityPage {...props} />;
}
function CommunityPage({ lang, section, id }) {
  useLocale();
  const resource = useResource(
    endpoint(lang, `${section}/${id ? `${id}/` : ""}`),
    true,
  );
  return (
    <Loading resource={resource}>
      {(data) => (
        <Content
          key={`${section}:${id}`}
          {...{ lang, section, id, data, reload: resource.reload }}
        />
      )}
    </Loading>
  );
}
function Content({ lang, id, data, reload }) {
  useLocale();
  const route = useRoute(),
    navigate = useNavigate(),
    tabId = useId();
  const [tab, setTab] = useState(() =>
    !new URLSearchParams(route.split("?")[1]).has("lesson") &&
    new URLSearchParams(route.split("?")[1]).get("tab") === "assignments"
      ? "assignments"
      : "lessons",
  );
  const [modal, setModal] = useState(null),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [assignment, setAssignment] = useState(null),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState("");
  const action = useAction();
  const editClass = (mode) => {
    setModal(null);
    setEdit({
      title: tr(
        mode === "rename"
          ? "Rename class"
          : mode === "join"
            ? "Join a class"
            : "Create class",
      ),
      fields:
        mode === "join"
          ? [
              {
                name: "invite",
                label: "Invite code",
                isRequired: true,
                maxLength: 80,
              },
            ]
          : [
              {
                name: "title",
                label: "Class name",
                isRequired: true,
                maxLength: 120,
              },
            ],
      initial: mode === "rename" ? data : {},
    });
  };
  const members = data.members || [];
  const assignmentCount = data.assignments?.length || 0;
  function activateTab(value) {
    setTab(value);
  }
  function tabKeys(event) {
    const tabs = ["lessons", "assignments"];
    let next;
    if (event.key === "ArrowRight")
      next = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
    else if (event.key === "ArrowLeft")
      next = tabs[(tabs.indexOf(tab) + tabs.length - 1) % tabs.length];
    else if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs.at(-1);
    if (next) {
      event.preventDefault();
      setTab(next);
      document.getElementById(`${tabId}-${next}-tab`)?.focus();
    }
  }
  return (
    <Page className="classroom-page">
      {id && (
        <Link className="classroom-back" to={`/${lang}/classes`}>
          <ArrowLeft size={15} />
          {tr("All classes")}
        </Link>
      )}
      <Heading
        title={id ? data.title : tr("Classes")}
        description={
          id
            ? tr("A dedicated space for lessons, practice and your class.")
            : tr("Learn together with Practice Hub exercises and folders.")
        }
        actions={
          !id ? (
            <>
              <Btn primary onClick={() => editClass("create")}>
                <Plus size={17} />
                {tr("Create class")}
              </Btn>
              <Btn onClick={() => editClass("join")}>
                <UserPlus size={17} />
                {tr("Join a class")}
              </Btn>
            </>
          ) : data.manage ? (
            <div className="classroom-heading-actions">
              <Btn onClick={() => setModal("invite")}>
                <UserPlus size={17} />
                {tr("Invite students")}
              </Btn>
              <Btn onClick={() => setModal("members")}>
                <Users size={17} />
                {tr("Members")}
                <span className="classroom-button-count">{members.length}</span>
              </Btn>
              <Btn
                onClick={() => setModal("settings")}
                aria-label={tr("Class settings")}
              >
                <Settings2 size={17} />
                {tr("Class settings")}
              </Btn>
            </div>
          ) : null
        }
      />
      {!id ? (
        <>
          {!!data.classes.length && (
            <div className="classroom-list-tools">
              <label className="classroom-search">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={tr("Search classes")}
                  placeholder={tr("Search classes")}
                />
              </label>
              <span>
                {tr("{count} classes", { count: data.classes.length })}
              </span>
            </div>
          )}
          <div className="classroom-grid">
            {filterClassroomItems(data.classes, query).map((c) => (
              <Link
                className="classroom-card"
                key={c.id}
                to={`/${lang}/classes/${c.id}`}
              >
                <span className="classroom-card-icon">
                  <GraduationCap size={27} />
                </span>
                <span
                  className={`classroom-role ${c.manage ? "is-teacher" : ""}`}
                >
                  {tr(c.manage ? "Teacher" : "Student")}
                </span>
                <h2>{c.title}</h2>
                <p>{tr("Created by {name}", { name: c.owner })}</p>
                <span className="classroom-card-footer">
                  {tr("Open class")}
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            ))}
          </div>
          {!data.classes.length ? (
            <div className="classroom-empty classroom-library-empty">
              <GraduationCap size={38} />
              <h2>{tr("A place to learn together")}</h2>
              <p>
                {tr(
                  "Create your first class or join a teacher with an invite code.",
                )}
              </p>
              <div>
                <Btn primary onClick={() => editClass("create")}>
                  {tr("Create class")}
                </Btn>
                <Btn onClick={() => editClass("join")}>
                  {tr("Join a class")}
                </Btn>
              </div>
            </div>
          ) : (
            !filterClassroomItems(data.classes, query).length && (
              <div className="classroom-empty">
                <Search size={30} />
                <h3>{tr("No classes match your search.")}</h3>
                <Btn onClick={() => setQuery("")}>{tr("Clear search")}</Btn>
              </div>
            )
          )}
        </>
      ) : (
        <>
          <div className="classroom-meta">
            <span>
              <GraduationCap size={15} />
              {tr("Created by {name}", { name: data.owner })}
            </span>
            <span
              className={`classroom-role ${data.manage ? "is-teacher" : ""}`}
            >
              {tr(data.manage ? "Teacher" : "Student")}
            </span>
            {data.manage && (
              <span>
                <Users size={15} />
                {tr("{count} members", { count: members.length })}
              </span>
            )}
          </div>
          <div
            className="classroom-navigation"
            role="tablist"
            aria-label={tr("Class sections")}
            onKeyDown={tabKeys}
          >
            <button
              type="button"
              id={`${tabId}-lessons-tab`}
              role="tab"
              aria-selected={tab === "lessons"}
              aria-controls={`${tabId}-lessons-panel`}
              tabIndex={tab === "lessons" ? 0 : -1}
              onClick={() => activateTab("lessons")}
            >
              <BookOpen size={19} />
              <span>
                <strong>{tr("Lessons")}</strong>
                <small>{tr("Whiteboard & PDF")}</small>
              </span>
            </button>
            <button
              type="button"
              id={`${tabId}-assignments-tab`}
              role="tab"
              aria-selected={tab === "assignments"}
              aria-controls={`${tabId}-assignments-panel`}
              tabIndex={tab === "assignments" ? 0 : -1}
              onClick={() => activateTab("assignments")}
            >
              <ClipboardList size={19} />
              <span>
                <strong>{tr("Assignments")}</strong>
                <small>{tr("Practice & deadlines")}</small>
              </span>
              <b>{assignmentCount}</b>
            </button>
          </div>
          <section
            className="classroom-tab-panel"
            id={`${tabId}-lessons-panel`}
            role="tabpanel"
            aria-labelledby={`${tabId}-lessons-tab`}
            hidden={tab !== "lessons"}
            tabIndex={0}
          >
            {tab === "lessons" && (
              <Suspense fallback={<Status>{tr("Opening board…")}</Status>}>
                <TeachingRoom lang={lang} classId={id} manage={data.manage} />
              </Suspense>
            )}
          </section>
          <section
            className="classroom-tab-panel"
            id={`${tabId}-assignments-panel`}
            role="tabpanel"
            aria-labelledby={`${tabId}-assignments-tab`}
            hidden={tab !== "assignments"}
            tabIndex={0}
          >
            {tab === "assignments" && (
              <Assignments
                {...{ lang, data }}
                onAssign={() => setAssignment({})}
                onEdit={setAssignment}
                onRemove={(item) => setRemove({ ...item, assignment: true })}
              />
            )}
          </section>
        </>
      )}
      <Status error={action.error} />
      {notice && <Status>{tr(notice)}</Status>}
      {edit && (
        <Editor
          {...edit}
          onClose={() => setEdit(null)}
          onSave={async (values, signal) => {
            const result = await request(
              endpoint(lang, `classes/${id ? `${id}/` : ""}`),
              id ? "PATCH" : "POST",
              values,
              signal,
            );
            if (id) reload();
            else navigate(`/${lang}/classes/${result.id}`);
          }}
        />
      )}
      {assignment && (
        <AssignmentDialog
          {...{ lang, id, reload }}
          item={assignment}
          onClose={() => setAssignment(null)}
        />
      )}
      {modal === "invite" && (
        <ClassDialog
          title={tr("Invite students")}
          onClose={() => setModal(null)}
        >
          <div className="classroom-dialog-intro">
            <span>
              <UserPlus size={25} />
            </span>
            <p>
              {tr("Share this code with students who want to join the class.")}
            </p>
          </div>
          <div className="classroom-invite-code">
            <small>{tr("Invite code")}</small>
            <code>{data.invite}</code>
          </div>
          <Btn
            primary
            isLoading={action.pending}
            onClick={() =>
              action.run(async () => {
                await navigator.clipboard.writeText(data.invite);
                setNotice("Invite code copied.");
              })
            }
          >
            <Copy size={17} />
            {tr("Copy invite code")}
          </Btn>
          {notice && <Status>{tr(notice)}</Status>}
          <Status error={action.error} />
        </ClassDialog>
      )}
      {modal === "members" && (
        <MembersDialog
          members={members}
          onClose={() => setModal(null)}
          onInvite={() => setModal("invite")}
          onRemove={(member) => {
            setModal(null);
            setRemove({ ...member, returnTo: "members" });
          }}
        />
      )}
      {modal === "settings" && (
        <ClassDialog
          title={tr("Class settings")}
          onClose={() => setModal(null)}
        >
          <div className="classroom-dialog-intro">
            <span>
              <Settings2 size={25} />
            </span>
            <p>{tr("Manage the class name and classroom settings.")}</p>
          </div>
          <div className="classroom-setting-row">
            <div>
              <strong>{data.title}</strong>
              <small>{tr("Class name")}</small>
            </div>
            <Btn onClick={() => editClass("rename")}>
              <Pencil size={16} />
              {tr("Rename")}
            </Btn>
          </div>
          <div className="classroom-setting-row classroom-danger-zone">
            <div>
              <strong>{tr("Delete class")}</strong>
              <small>
                {tr("This removes the class, its lessons and assignments.")}
              </small>
            </div>
            <Btn
              onClick={() => {
                setModal(null);
                setRemove({ classroom: true });
              }}
            >
              <Trash2 size={16} />
              {tr("Delete")}
            </Btn>
          </div>
        </ClassDialog>
      )}
      {remove && (
        <Confirm
          title={tr(
            remove.classroom
              ? "Delete this class?"
              : remove.assignment
                ? "Remove this assignment?"
                : "Remove this student from the class?",
          )}
          description={
            remove.classroom
              ? tr("This removes the class, its lessons and assignments.")
              : remove.assignment
                ? tr("The original content stays in Practice Hub.")
                : tr("{name} will lose member access to this class.", {
                    name: remove.username,
                  })
          }
          confirmLabel={
            remove.classroom
              ? "Delete class"
              : remove.assignment
                ? "Unassign"
                : "Remove from class"
          }
          cancelLabel="Cancel"
          onClose={() => {
            if (remove.returnTo) setModal(remove.returnTo);
            setRemove(null);
          }}
          onConfirm={async (signal) => {
            if (remove.assignment) {
              await request(
                endpoint(lang, `classes/${id}/assignments/`),
                "DELETE",
                { id: remove.id },
                signal,
              );
              setNotice("Assignment removed.");
            } else {
              await request(
                endpoint(lang, `classes/${id}/`),
                remove.classroom ? "DELETE" : "PATCH",
                remove.classroom ? undefined : { remove_member: remove.id },
                signal,
              );
            }
            if (remove.classroom) navigate(`/${lang}/classes`);
            else reload();
          }}
        />
      )}
    </Page>
  );
}
function ClassDialog({ title, onClose, children, footer }) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      classNames={{ base: "glass dialog classroom-dialog" }}
    >
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>{children}</ModalBody>
        <ModalFooter>
          {footer || <Btn onClick={onClose}>{tr("Close")}</Btn>}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
function Assignments({ lang, data, onAssign, onEdit, onRemove }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const list = visibleAssignments(data.assignments, query, filter);
  return (
    <div className="classroom-assignments">
      <div className="classroom-section-heading">
        <div>
          <p className="classroom-eyebrow">{tr("PRACTICE SPACE")}</p>
          <h2>{tr("Assignments")}</h2>
          <p>
            {tr(
              data.manage
                ? "Assign learning content and keep deadlines in one place."
                : "Find your assigned practice and upcoming deadlines here.",
            )}
          </p>
        </div>
        {data.manage && (
          <Btn primary onClick={onAssign}>
            <Plus size={17} />
            {tr("Assign content")}
          </Btn>
        )}
      </div>
      {!!data.assignments.length && (
        <div className="classroom-assignment-tools">
          <label className="classroom-search">
            <Search size={17} />
            <input
              aria-label={tr("Search assignments")}
              placeholder={tr("Search assignments")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <Select label="Show" value={filter} onChange={setFilter}>
            <option value="all">{tr("All assignments")}</option>
            <option value="scheduled">{tr("Upcoming deadlines")}</option>
            <option value="overdue">{tr("Past due")}</option>
          </Select>
        </div>
      )}
      <div className="classroom-assignment-list">
        {list.map((item) => {
          const past = deadlineState(item.due_at) === "overdue";
          return (
            <article
              key={item.id}
              className={`classroom-assignment ${past ? "is-past-due" : ""}`}
            >
              <span className="classroom-assignment-icon">
                <ClipboardList size={22} />
              </span>
              <div className="classroom-assignment-content">
                <Link to={`/${lang}/practice/${item.node}`}>{item.title}</Link>
                <span
                  className={`classroom-deadline ${past ? "is-past-due" : ""}`}
                >
                  <CalendarDays size={14} />
                  {item.due_at ? (
                    <>
                      <time dateTime={item.due_at}>
                        {new Date(item.due_at).toLocaleString(dateLocale(), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                      {past && <b>{tr("Past due")}</b>}
                    </>
                  ) : (
                    tr("No deadline")
                  )}
                </span>
              </div>
              <div className="classroom-assignment-actions">
                <Link
                  className="classroom-open-content"
                  to={`/${lang}/practice/${item.node}`}
                >
                  {tr("Open")}
                  <ArrowUpRight size={15} />
                </Link>
                {data.manage && (
                  <>
                    <Btn
                      onClick={() => onEdit(item)}
                      aria-label={tr("Edit deadline for {title}", {
                        title: item.title,
                      })}
                    >
                      <Pencil size={16} />
                    </Btn>
                    <Btn
                      onClick={() => onRemove(item)}
                      aria-label={tr("Unassign {title}", { title: item.title })}
                    >
                      <Trash2 size={16} />
                    </Btn>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <div className="classroom-empty">
          <ClipboardList size={35} />
          <h3>
            {tr(
              data.assignments.length
                ? "No assignments match your filters."
                : "No assigned content yet.",
            )}
          </h3>
          <p>
            {tr(
              data.assignments.length
                ? "Try another search or deadline filter."
                : data.manage
                  ? "Add exercises, theory or a folder from Practice Hub."
                  : "Your teacher will add practice here.",
            )}
          </p>
          {data.assignments.length ? (
            <Btn
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              {tr("Clear filters")}
            </Btn>
          ) : (
            data.manage && (
              <Btn primary onClick={onAssign}>
                <Plus size={17} />
                {tr("Assign content")}
              </Btn>
            )
          )}
        </div>
      )}
    </div>
  );
}
function AssignmentDialog({ lang, id, reload, item, onClose }) {
  const resource = useResource(endpoint(lang, "practice-hub/nodes/")),
    action = useAction(),
    formId = useId();
  const [node, setNode] = useState(item.node ? String(item.node) : ""),
    [due, setDue] = useState(localDeadlineInput(item.due_at)),
    [search, setSearch] = useState("");
  const choices = filterClassroomItems(resource.data?.nodes || [], search);
  const selected = (resource.data?.nodes || []).find(
    (n) => String(n.id) === node,
  );
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      isDismissable={!action.pending}
      isKeyboardDismissDisabled={action.pending}
      hideCloseButton={action.pending}
      classNames={{ base: "glass dialog classroom-dialog" }}
    >
      <ModalContent>
        <ModalHeader>
          {tr(item.id ? "Edit assignment" : "Assign content")}
        </ModalHeader>
        <ModalBody>
          <p className="classroom-dialog-description">
            {tr(
              "Choose content from Practice Hub and set an optional deadline.",
            )}
          </p>
          <form
            id={formId}
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async (signal) => {
                await request(
                  endpoint(lang, `classes/${id}/assignments/`),
                  "POST",
                  {
                    node: Number(node),
                    due_at: assignmentDueValue(due, item.due_at),
                  },
                  signal,
                );
                reload();
                onClose();
              });
            }}
          >
            {item.id ? (
              <div className="classroom-assignment-selection">
                <ClipboardList size={20} />
                <strong>{item.title}</strong>
              </div>
            ) : (
              <>
                <Field
                  label="Search content"
                  value={search}
                  onChange={setSearch}
                  placeholder={tr("Type a content title…")}
                  isDisabled={action.pending || resource.loading}
                />
                <Select
                  label="Exercise / theory / folder"
                  value={node}
                  onChange={setNode}
                  disabled={action.pending || resource.loading}
                  required
                >
                  <option value="">
                    {tr(
                      resource.loading ? "Loading content…" : "Choose content",
                    )}
                  </option>
                  {selected && !choices.some((n) => String(n.id) === node) && (
                    <option value={selected.id}>{selected.title}</option>
                  )}
                  {choices.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </Select>
                {!resource.loading && !choices.length && (
                  <p className="classroom-hint">
                    {tr("No content matches your search.")}
                  </p>
                )}
              </>
            )}
            <Field
              label="Due date (optional)"
              type="datetime-local"
              value={due}
              onChange={setDue}
              isDisabled={action.pending}
              description={tr("The deadline uses your device’s local time.")}
            />
            <Status error={action.error || (!item.id && resource.error)} />
            {!item.id && resource.error && (
              <Btn onClick={resource.reload}>{tr("Retry")}</Btn>
            )}
          </form>
        </ModalBody>
        <ModalFooter>
          <Btn onClick={onClose} isDisabled={action.pending}>
            {tr("Cancel")}
          </Btn>
          <Btn
            primary
            type="submit"
            form={formId}
            isDisabled={
              !node || (!item.id && (resource.loading || !!resource.error))
            }
            isLoading={action.pending}
          >
            <Check size={16} />
            {tr(item.id ? "Save changes" : "Assign to class")}
          </Btn>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
function MembersDialog({ members, onClose, onInvite, onRemove }) {
  const [query, setQuery] = useState("");
  const shown = filterClassroomItems(members, query);
  return (
    <ClassDialog
      title={tr("Class members")}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>{tr("Close")}</Btn>
          <Btn primary onClick={onInvite}>
            <UserPlus size={16} />
            {tr("Invite students")}
          </Btn>
        </>
      }
    >
      <p className="classroom-dialog-description">
        {tr("Manage people enrolled in this class.")}
      </p>
      {!!members.length && (
        <Field label="Search members" value={query} onChange={setQuery} />
      )}
      <div className="classroom-member-list">
        {shown.map((member) => (
          <div key={member.id} className="classroom-member">
            <span className="classroom-avatar">
              {member.username.slice(0, 1).toLocaleUpperCase()}
            </span>
            <strong>{member.username}</strong>
            <Btn
              onClick={() => onRemove(member)}
              aria-label={tr("Remove {name} from class", {
                name: member.username,
              })}
            >
              <Trash2 size={16} />
            </Btn>
          </div>
        ))}
      </div>
      {!shown.length && (
        <div className="classroom-empty">
          <Users size={30} />
          <h3>
            {tr(
              members.length
                ? "No members match your search."
                : "Your class is ready for students.",
            )}
          </h3>
          <p>{tr("Invite students to learn together in this class.")}</p>
        </div>
      )}
    </ClassDialog>
  );
}
