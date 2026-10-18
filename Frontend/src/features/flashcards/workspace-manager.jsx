import {useState} from "react";
import {Checkbox, Divider} from "@heroui/react";
import {t as tr,useLocale} from "../../i18n/index.js";
import {endpoint,request,useResource,useAction} from "../../lib/core.js";
import {Btn,Icon,Field,Select,Loading,Status,Confirm,Editor} from "../../components/ui/ui.jsx";
import {PracticeModal} from "../practice/practice-workspace.jsx";

export default function WorkspaceManager({lang,onClose,onChanged}) {
  useLocale();
  const resource=useResource(endpoint(lang,"decks/?include_archived=true"), true);
  const [query,setQuery]=useState(""),[view,setView]=useState("active"),[selected,setSelected]=useState([]),[confirm,setConfirm]=useState(null),[editing,setEditing]=useState(null);
  const action=useAction();
  const rows=(resource.data?.folders||[]).filter(d=>d.parent_id==null&&(view==="all"||!d.archived)&&d.name.toLowerCase().includes(query.toLowerCase()));
  const chosen=(resource.data?.folders||[]).filter(d=>selected.includes(d.id));
  const toggle=id=>setSelected(ids=>ids.includes(id)?ids.filter(v=>v!==id):[...ids,id]);
  const mutate=async(kind,signal)=>{
    const failed=[];
    const ids=selected.filter(id=>kind==="delete"||Boolean(resource.data?.folders.find(d=>d.id===id)?.archived)===(kind==="restore"));
    for(const id of ids){
      try {await request(endpoint(lang,`folders/${id}/${kind==="delete"?"?delete_contents=true":""}`),kind==="delete"?"DELETE":"PATCH",kind==="delete"?undefined:{archived:kind==="remove"},signal);}
      catch(error){if(error.name==="AbortError")throw error;failed.push(id);}
    }
    setSelected(failed);resource.reload();onChanged();
    if(failed.length)throw Error(tr("Some folders could not be updated. Please retry."));
    setConfirm(null);
  };
  return <>
    <PracticeModal title={tr("Workspace options")} size="3xl" onClose={onClose} pending={action.pending||Boolean(confirm)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr("Search folders")} value={query} onChange={v=>{setQuery(v);setSelected([]);}} startContent={<Icon name="search"/>}/>
        <Select label={tr("Show")} value={view} onChange={v=>{setView(v);setSelected([]);}}><option value="active">{tr("In workspace")}</option><option value="all">{tr("All")}</option></Select>
      </div>
      <Status error={action.error}/>
      <Loading resource={resource}>{()=> <>
        <div className="flex items-center justify-between gap-3">
          <Checkbox isSelected={rows.length>0&&rows.every(d=>selected.includes(d.id))} isIndeterminate={selected.length>0&&!rows.every(d=>selected.includes(d.id))} onValueChange={v=>setSelected(v?rows.map(d=>d.id):[])}>{tr("Select all")}</Checkbox>
          <span className="text-sm text-(--muted)" role="status">{tr("{count} selected",{count:selected.length})}</span>
        </div>
        <Divider/>
        <div className="max-h-[45dvh] overflow-y-auto overscroll-contain">
          {rows.map(d=><div key={d.id} className="flex items-center gap-3 border-b border-(--line) py-3">
            <Checkbox className="min-w-0 flex-1" isSelected={selected.includes(d.id)} onValueChange={()=>toggle(d.id)}>
              <span className="block break-words font-medium">{d.name}</span>{d.archived&&<span className="block text-xs text-(--muted)">{tr("Removed from workspace")}</span>}
            </Checkbox>
            <Btn icon="edit" onClick={()=>setEditing(d)}>{tr("Edit {title}",{title:d.name})}</Btn>
          </div>)}
          {!rows.length&&<p className="py-8 text-center text-(--muted)">{tr("Content not found.")}</p>}
        </div>
      </>}</Loading>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--line) pt-3">
        <Btn isDisabled={!selected.length||action.pending} onClick={()=>setConfirm("delete")}>{tr("Delete permanently")}</Btn>
        <div className="flex flex-wrap gap-2">{view==="all"&&<Btn isDisabled={!chosen.some(d=>d.archived)||action.pending} onClick={()=>action.run(signal=>mutate("restore",signal))}>{tr("Restore to workspace")}</Btn>}<Btn primary isDisabled={!chosen.some(d=>!d.archived)||action.pending} isLoading={action.pending} onClick={()=>action.run(signal=>mutate("remove",signal))}>{tr("Remove from workspace")}</Btn></div>
      </div>
    </PracticeModal>
    {editing&&<Editor title={tr("Edit folder")} fields={[{name:"name",label:"Folder name",isRequired:true}]} initial={{name:editing.name}} onClose={()=>setEditing(null)} onSave={async(values,signal)=>{await request(endpoint(lang,`folders/${editing.id}/`),"PATCH",values,signal);resource.reload();onChanged();}}/>}
    {confirm&&<Confirm title={tr("Delete selected folders?")} description={tr("Selected folders and all their decks, cards and progress will be permanently deleted.")} onClose={()=>setConfirm(null)} onConfirm={signal=>mutate("delete",signal)}/>}
  </>;
}
