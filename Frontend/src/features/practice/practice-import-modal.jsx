import { useState } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { endpoint, request, useAction, useResource } from "../../lib/core.js";
import { Confirm, Icon, Status } from "../../components/ui/ui.jsx";
import { PracticeModal } from "./practice-workspace.jsx";
import { PracticeTextEditor } from "./practice-text-editor.jsx";

export default function PracticeImportModal({ lang, folder, node, onClose, onSaved }) {
  useLocale();
  const action = useAction();
  const detail = useResource(node ? endpoint(lang, `practice-hub/nodes/${node.id}/`) : null);
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false);
  const pending = action.pending || busy;
  const close = () => { if (!pending) dirty ? setDiscard(true) : onClose(); };
  const save = items => action.run(async signal => {
    if (node) {
      if (items.length !== 1) throw Error("When editing, the file must contain exactly one exercise. Use import to create multiple exercises.");
      await request(endpoint(lang, `practice-hub/nodes/${node.id}/`), "PATCH", {title:items[0].title, payload:{...detail.data.node.payload,...items[0].payload}}, signal);
    } else {
      if (!folder?.can_edit || folder.kind !== "folder") throw Error("Choose a folder before saving.");
      await request(endpoint(lang,"practice-hub/import/"),"POST",{parent:folder.id,nodes:items},signal);
    }
    onSaved(items.length); onClose();
  });
  const loaded = detail.data?.node;
  return <>
    <PracticeModal title={tr(node ? "Edit exercise" : "Import exercises")} className="practice-import-dialog" size="4xl" pending={pending} onClose={close}>
      <div data-practice-import>
        <div className="practice-import-destination"><Icon name="folder" size={18}/><span>{folder?.title || tr("My practice")}</span></div>
        <Status error={action.error || detail.error}/>
        {node && !loaded ? (!detail.error && <Status>{tr("Loading…")}</Status>) : <PracticeTextEditor key={node ? `${node.id}:${loaded.updated_at}` : folder.id} compact lang={lang} exercise={node ? {...loaded.payload,title:loaded.title} : undefined} pending={action.pending} onBusyChange={setBusy} onDirtyChange={setDirty} onApply={save}/>}
      </div>
    </PracticeModal>
    {discard && <Confirm title={tr("Discard unsaved changes?")} description={tr("Your draft has not been saved. Keep editing or discard it.")} cancelLabel="Keep editing" confirmLabel="Discard changes" onClose={()=>setDiscard(false)} onConfirm={onClose}/>}
  </>;
}
