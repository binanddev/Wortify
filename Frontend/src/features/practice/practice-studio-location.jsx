import { useState } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { endpoint, useAction, useResource, request } from "../../lib/core.js";
import { Btn, Field, Icon, Status } from "../../components/ui/ui.jsx";
import { ownedPracticeNodes } from "./practice-navigation.js";

export default function PracticeStudioLocation({ lang, onChoose, onPending }) {
  useLocale();
  const resource = useResource(endpoint(lang, "practice-hub/nodes/"));
  const action = useAction();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const folders = ownedPracticeNodes(resource.data?.nodes || []).filter(node => node.kind === "folder");
  const paths = folders.map(node => {
    const names = [node.title], seen = new Set([node.id]);
    let parent = folders.find(folder => folder.id === node.parent);
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id); names.unshift(parent.title);
      parent = folders.find(folder => folder.id === parent.parent);
    }
    return { ...node, path: names.join(" / ") };
  });
  const matches = paths.filter(folder => folder.path.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section data-practice-location className="practice-studio-location">
    <div><h2>{tr("Choose a destination folder.")}</h2></div>
    <div className="practice-location-search">
      <Field label={tr("Search folders…")} value={query} onChange={setQuery} startContent={<Icon name="search" size={18}/>}/>
      <Btn aria-label={tr("New folder")} isDisabled={action.pending} onClick={()=>setAdding(value=>!value)}><Icon name="folder_add" size={18}/><span>{tr("New folder")}</span></Btn>
    </div>
    <Status error={resource.error || action.error}/>
    {adding && <form className="practice-location-create" onSubmit={event=>{
      event.preventDefault(); if (!name.trim() || action.pending) return;
      action.run(async signal=>{
        onPending(true);
        try { const result = await request(endpoint(lang,"practice-hub/nodes/"),"POST",{kind:"folder",title:name.trim(),parent:null},signal);onChoose(result.node.id); }
        finally { onPending(false); }
      });
    }}>
      <Field autoFocus label={tr("Folder name")} value={name} onChange={setName} maxLength={200} isDisabled={action.pending}/>
      <div className="practice-location-create-actions"><Btn isDisabled={action.pending} onClick={()=>setAdding(false)}>{tr("Cancel")}</Btn><Btn primary type="submit" isDisabled={action.pending || !name.trim()}>{tr("Create folder")}</Btn></div>
    </form>}
    {resource.loading ? <Status>{tr("Loading…")}</Status> : <div className="practice-location-folders">
      {matches.map(folder=><button key={folder.id} type="button" disabled={action.pending} className="practice-location-folder" onClick={()=>onChoose(folder.id)}>
        <Icon name="folder" size={20}/><span><strong>{folder.title}</strong>{folder.parent && <small>{folder.path}</small>}</span><Icon name="chevron_right" size={18}/>
      </button>)}
      {!matches.length && <p>{tr(query ? "No matching content." : "No content yet.")}</p>}
    </div>}
  </section>;
}
