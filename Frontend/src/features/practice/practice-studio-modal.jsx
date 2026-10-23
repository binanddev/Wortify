import { useCallback, useMemo, useState, useEffect } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { WindowContext, useWindowActive } from "../../lib/core.js";
import { Confirm, Icon } from "../../components/ui/ui.jsx";
import { PracticeModal } from "./practice-workspace.jsx";
import { ExerciseStudio } from "./exercise-studio.jsx";
import PracticeStudioLocation from "./practice-studio-location.jsx";
import { PracticeGuide } from "./practice-guide.jsx";

// Reuse the complete studio with its own route and tools portal, including nested dialogs.
export default function PracticeStudioModal({ lang, initialRoute, onClose, onLearn }) {
  useLocale();
  const active = useWindowActive();
  const [route, setRoute] = useState(initialRoute);
  const [toolsTarget, setToolsTarget] = useState(null);
  const [studioState, setStudioState] = useState({ pending: false, drafting: false });
  const [discard, setDiscard] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(() => matchMedia("(min-width:900px)").matches);
  const navigate = useCallback(path => {
    if (path.startsWith(`/${lang}/create`)) setRoute(path);
    else onLearn(path);
  }, [lang, onLearn]);
  const scope = useMemo(() => ({ route, navigate, active, toolsTarget }), [route, navigate, active, toolsTarget]);
  const parts = route.split("?")[0].split("/");
  const create = parts[3] === "new";
  const guide = parts[3] === "guide";
  const edit = parts[4] === "edit";
  const parentId = new URLSearchParams(route.split("?")[1]).get("parent");
  const choosing = create && !parentId;
  const pending = studioState.pending || locationBusy;
  useEffect(() => { if (create || edit) setToolsOpen(true); }, [create, edit]);
  const close = () => {
    if (pending) return;
    if (studioState.drafting) setDiscard(true);
    else onClose();
  };
  return <>
    <PracticeModal title={<span className="practice-studio-title"><Icon name={create ? "edit" : guide ? "help" : "manage"} size={22}/><span>{tr(create ? "Create exercise" : edit ? "Edit content" : guide ? "Authoring guide" : "Manage content")}</span></span>}
      className="practice-studio-dialog" size="5xl" pending={pending} onClose={close}>
      <WindowContext.Provider value={scope}>
        {choosing ? <div data-practice-studio><PracticeStudioLocation lang={lang} onPending={setLocationBusy} onChoose={id=>setRoute(`/${lang}/create/new?parent=${id}`)}/></div> :
        <div data-practice-studio className={`practice-studio-layout ${guide ? "is-guide" : create || edit ? "is-editing" : ""}`}>
          {!guide && <details open={toolsOpen} onToggle={event=>setToolsOpen(event.currentTarget.open)} className="practice-studio-tools">
            <summary><Icon name="menu" size={16}/>{tr("Tools and contents")}<Icon name="chevron_down" size={16}/></summary>
            <div ref={setToolsTarget}/>
          </details>}
          <div className="practice-studio-main">
            {guide ? <PracticeGuide lang={lang} embedded/> : <ExerciseStudio lang={lang}
              id={create ? undefined : parts[3]} create={create} edit={edit}
              parentId={parentId} onDialogState={setStudioState}/>}
          </div>
        </div>}
      </WindowContext.Provider>
    </PracticeModal>
    {discard && <Confirm title={tr("Discard unsaved changes?")} description={tr("Your draft has not been saved. Keep editing or discard it.")}
      cancelLabel="Keep editing" confirmLabel="Discard changes" onConfirm={onClose} onClose={() => setDiscard(false)}/>}
  </>;
}
