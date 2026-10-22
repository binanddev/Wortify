import { useState } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { Btn, Field, Status } from "../../components/ui/ui.jsx";
import VisibilitySelect from "../../components/ui/VisibilitySelect.jsx";
import { PracticeModal } from "./practice-workspace.jsx";
import { DestinationPicker } from "./practice-library.jsx";

export default function PracticeNodeDialog({ operation, nodes, pending, error, onClose, onPatch, onOrganize, onCreate }) {
  useLocale();
  const node = nodes.find(item=>item.id===operation.node?.id) || operation.node;
  const [name,setName] = useState(operation.action === "create" ? "" : node?.title || "");
  const title = operation.action === "create" ? "New folder" : operation.action === "rename" ? "Rename" : operation.action === "move" ? "Move" : operation.action === "delete" ? "Delete permanently" : "Content options";
  const saveName = async event => {
    event.preventDefault(); if(pending || !name.trim()) return;
    const ok = operation.action === "create" ? await onCreate({kind:"folder",title:name.trim(),parent:operation.parent ?? null}) : await onPatch(node,{title:name.trim()});
    if(ok) onClose();
  };
  return <PracticeModal title={tr(title)} size="lg" pending={pending} onClose={onClose}>
    <Status error={error}/>
    {["create","rename"].includes(operation.action) && <form onSubmit={saveName} className="practice-node-form">
      <Field label={tr(operation.action === "create" || node.kind === "folder" ? "Folder name" : "New name")} value={name} onChange={setName} autoFocus maxLength={200} isDisabled={pending}/>
      <div className="practice-node-actions"><Btn isDisabled={pending} onClick={onClose}>{tr("Cancel")}</Btn><Btn primary type="submit" isDisabled={pending || !name.trim()}>{tr(operation.action === "create" ? "Create folder" : "Save changes")}</Btn></div>
    </form>}
    {operation.action === "move" && <DestinationPicker nodes={nodes} ids={[node.id]} pending={pending} onClose={onClose} onChoose={async parent=>{if(await onOrganize({action:"move",ids:[node.id],parent}))onClose();}}/>}
    {operation.action === "delete" && <>
      <p>{node.title}</p><p>{tr(node.kind === "folder" ? "Selected folders and everything inside them will be deleted, including their learning progress. This cannot be undone." : "This content and its learning progress will be permanently deleted.")}</p>
      <div className="practice-node-actions"><Btn isDisabled={pending} onClick={onClose}>{tr("Cancel")}</Btn><Btn primary color="danger" isDisabled={pending} onClick={async()=>{if(await onOrganize({action:"delete",ids:[node.id]}))onClose();}}>{tr("Delete permanently")}</Btn></div>
    </>}
    {operation.action === "settings" && <VisibilitySelect value={node.visibility || "private"} disabled={pending} onChange={visibility=>onPatch(node,{visibility})}/>}
  </PracticeModal>;
}
