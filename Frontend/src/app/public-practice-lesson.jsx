import { useResource, endpoint } from "../lib/core.js";
import { Btn, Loading } from "../components/ui/ui.jsx";
import { PracticeModal } from "../features/practice/practice-workspace.jsx";
import { PracticeActivity } from "../features/practice/practice-activity.jsx";
import { TheoryActivity } from "../features/practice/practice-theory.jsx";
import { previewData } from "../features/practice/exercise-types.js";
import { t as tr } from "../i18n/index.js";
export function PublicPracticeLesson({ lang, id, onClose, onOpen, onRequireAccount }) {
  const resource = useResource(endpoint(lang, `practice-hub/public/${id}/`));
  return (
    <PracticeModal
      title={resource.data?.title || tr("Practice Hub")}
      onClose={onClose}
      size="5xl"
    >
      <Loading resource={resource}>
        {(data) => (
          <>
            <Btn onClick={() => onRequireAccount({ kind: "practice", id })}>
              {tr("Save to my library")}
            </Btn>
            {data.kind === "folder" ? (
              data.children.map((child) => (
                <Btn key={child.id} onClick={() => onOpen(child.id)}>
                  {child.title}
                </Btn>
              ))
            ) : data.kind === "theory" ? (
              <TheoryActivity payload={data.payload} />
            ) : (
              <PracticeActivity
                preview
                lang={lang}
                data={previewData(data.payload)}
              />
            )}
          </>
        )}
      </Loading>
    </PracticeModal>
  );
}
