import LearningProfile from "./profile.jsx";
import { useState } from "react";
import { endpoint, request, useResource, useAction } from "../../lib/core.js";
import {
  Page,
  Heading,
  Glass,
  Btn,
  Field,
  Select,
  Status,
  Loading,
  Link,
  Editor,
  SidebarTools,
  Confirm,
} from "../../components/ui/ui.jsx";
export function Community(props) {
  return props.section === "profile" ? (
    <LearningProfile lang={props.lang} />
  ) : (
    <CommunityPage {...props} />
  );
}
function CommunityPage({ lang, section, id }) {
  const resource = useResource(
    endpoint(lang, `${section}/${id ? `${id}/` : ""}`),
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
function Content({ lang, section, id, data, reload }) {
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null);
  const action = useAction();
  return (
    <Page>
      <Heading
        title={id ? data.title : "Classes"}
        description={
          id
            ? `Created by: ${data.owner}`
            : "Learn together with Practice Hub exercises and folders."
        }
        actions={
          !id ? (
            <>
              <Btn
                onClick={() =>
                  setEdit({
                    title: "Create class",
                    fields: [
                      { name: "title", label: "Class name", isRequired: true },
                    ],
                  })
                }
              >
                Create class
              </Btn>
              <Btn
                onClick={() =>
                  setEdit({
                    title: "Join a class",
                    fields: [
                      { name: "invite", label: "Invite code", isRequired: true },
                    ],
                  })
                }
              >
                Tham gia
              </Btn>
            </>
          ) : data.manage ? (
            <>
              <Btn
                icon="edit"
                onClick={() =>
                  setEdit({
                    title: "Rename class",
                    fields: [
                      { name: "title", label: "Class name", isRequired: true },
                    ],
                    initial: data,
                  })
                }
              >
                Rename
              </Btn>
              <Btn icon="trash" onClick={() => setRemove({ classroom: true })}>
                Delete class
              </Btn>
            </>
          ) : null
        }
      />
      {!id ? (
        <div className="hub-grid">
          {data.classes.map((c) => (
            <Link
              className="hub-tile"
              key={c.id}
              to={`/${lang}/classes/${c.id}`}
            >
              {c.title}
              <small>{c.owner}</small>
            </Link>
          ))}
        </div>
      ) : (
        <>
          {data.manage && (
            <>
              <SidebarTools>
                <p>Invite code: {data.invite}</p>
                <Btn
                  onClick={() =>
                    action.run(() => navigator.clipboard.writeText(data.invite))
                  }
                >
                  Copy invite code
                </Btn>
              </SidebarTools>
              <AssignmentPicker {...{ lang, id, reload }} />
              <details>
                <summary>Members ({data.members.length})</summary>
                {data.members.map((m) => (
                  <div className="history-row" key={m.id}>
                    {m.username}
                    <Btn icon="trash" onClick={() => setRemove(m)}>
                      Remove from class
                    </Btn>
                  </div>
                ))}
              </details>
            </>
          )}
          <h2>Assigned content</h2>
          {data.assignments.map((a) => (
            <div className="history-row" key={a.id}>
              <Link to={`/${lang}/practice/${a.node}`}>{a.title}</Link>
              {a.due_at && (
                <small>{new Date(a.due_at).toLocaleString("en-GB")}</small>
              )}
              {data.manage && (
                <Btn
                  onClick={() =>
                    action.run(async (signal) => {
                      await request(
                        endpoint(lang, `classes/${id}/assignments/`),
                        "DELETE",
                        { id: a.id },
                        signal,
                      );
                      reload();
                    })
                  }
                >
                  Unassign
                </Btn>
              )}
            </div>
          ))}
          {!data.assignments.length && <p>No assigned content yet.</p>}
        </>
      )}
      <Status error={action.error} />
      {edit && (
        <Editor
          {...edit}
          onClose={() => setEdit(null)}
          onSave={async (v, s) => {
            await request(
              endpoint(lang, `classes/${id ? `${id}/` : ""}`),
              id ? "PATCH" : "POST",
              v,
              s,
            );
            reload();
          }}
        />
      )}
      {remove && (
        <Confirm
          title={
            remove.classroom
              ? "Delete this class?"
              : `Delete ${remove.username} from this class?`
          }
          onClose={() => setRemove(null)}
          onConfirm={async (s) => {
            await request(
              endpoint(lang, `classes/${id}/`),
              remove.classroom ? "DELETE" : "PATCH",
              remove.classroom ? undefined : { remove_member: remove.id },
              s,
            );
            setRemove(null);
            if (remove.classroom) window.location.assign(`/${lang}/classes`);
            else reload();
          }}
        />
      )}
    </Page>
  );
}
function AssignmentPicker({ lang, id, reload }) {
  const resource = useResource(endpoint(lang, "practice-hub/nodes/")),
    action = useAction();
  const [node, setNode] = useState(""),
    [due, setDue] = useState("");
  return (
    <SidebarTools>
      <h3>Assign content</h3>
      <Select label="Exercise / theory / folder" value={node} onChange={setNode}>
        <option value="">Choose content</option>
        {resource.data?.nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title}
          </option>
        ))}
      </Select>
      <Field
        label="Due date (optional)"
        type="datetime-local"
        value={due}
        onChange={setDue}
      />
      <Btn
        isDisabled={!node}
        onClick={() =>
          action.run(async (signal) => {
            await request(
              endpoint(lang, `classes/${id}/assignments/`),
              "POST",
              {
                node: Number(node),
                due_at: due ? new Date(due).toISOString() : null,
              },
              signal,
            );
            reload();
          })
        }
      >
        Assign to class
      </Btn>
      <Status error={resource.error || action.error} />
    </SidebarTools>
  );
}
