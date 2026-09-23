import LearningProfile from "./profile";
import { useState } from "react";
import { endpoint, request, useResource, useAction } from "./core";
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
} from "./ui";
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
        title={id ? data.title : "Lớp học"}
        description={
          id
            ? `Người tạo: ${data.owner}`
            : "Học cùng nhau với bài và thư mục Practice Hub."
        }
        actions={
          !id ? (
            <>
              <Btn
                onClick={() =>
                  setEdit({
                    title: "Tạo lớp",
                    fields: [
                      { name: "title", label: "Tên lớp", isRequired: true },
                    ],
                  })
                }
              >
                Tạo lớp
              </Btn>
              <Btn
                onClick={() =>
                  setEdit({
                    title: "Tham gia lớp",
                    fields: [
                      { name: "invite", label: "Mã mời", isRequired: true },
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
                onClick={() =>
                  setEdit({
                    title: "Đổi tên lớp",
                    fields: [
                      { name: "title", label: "Tên lớp", isRequired: true },
                    ],
                    initial: data,
                  })
                }
              >
                Đổi tên
              </Btn>
              <Btn onClick={() => setRemove({ classroom: true })}>Xóa lớp</Btn>
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
                <p>Mã mời: {data.invite}</p>
                <Btn
                  onClick={() =>
                    action.run(() => navigator.clipboard.writeText(data.invite))
                  }
                >
                  Sao chép mã mời
                </Btn>
              </SidebarTools>
              <AssignmentPicker {...{ lang, id, reload }} />
              <details>
                <summary>Thành viên ({data.members.length})</summary>
                {data.members.map((m) => (
                  <div className="history-row" key={m.id}>
                    {m.username}
                    <Btn onClick={() => setRemove(m)}>Xóa khỏi lớp</Btn>
                  </div>
                ))}
              </details>
            </>
          )}
          <h2>Nội dung được giao</h2>
          {data.assignments.map((a) => (
            <div className="history-row" key={a.id}>
              <Link to={`/${lang}/practice/${a.node}`}>{a.title}</Link>
              {a.due_at && (
                <small>{new Date(a.due_at).toLocaleString("vi-VN")}</small>
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
                  Bỏ giao
                </Btn>
              )}
            </div>
          ))}
          {!data.assignments.length && <p>Chưa có nội dung được giao.</p>}
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
              ? "Xóa lớp học?"
              : `Xóa ${remove.username} khỏi lớp?`
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
      <h3>Giao nội dung</h3>
      <Select label="Bài / lý thuyết / thư mục" value={node} onChange={setNode}>
        <option value="">Chọn nội dung</option>
        {resource.data?.nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title}
          </option>
        ))}
      </Select>
      <Field
        label="Hạn làm (không bắt buộc)"
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
        Giao cho lớp
      </Btn>
      <Status error={resource.error || action.error} />
    </SidebarTools>
  );
}
