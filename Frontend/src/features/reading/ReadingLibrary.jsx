import {useEffect,useMemo,useState} from "react";
import {t as tr,useLocale} from "../../i18n/index.js";
import {request,useAction,useNavigate,useResource} from "../../lib/core.js";
import {usePagination} from "../../lib/pagination.js";
import Pagination from "../../components/ui/pagination.jsx";
import {Btn,Field,Glass,Icon,Link,Loading,Page,SidebarTools,Status} from "../../components/ui/ui.jsx";
import ActionMenu from "../../components/ui/action-menu.jsx";
import {FolderTree,folderAncestors} from "../flashcards/flashcard-navigation.jsx";
import {PracticeModal} from "../practice/practice-workspace.jsx";
import {PracticeActivity} from "../practice/practice-activity.jsx";
import {previewData} from "../practice/exercise-types.js";
import {exerciseToText} from "../practice/practice-text.js";
import ReadingEditorModal from "./ReadingEditorModal.jsx";
import ReadingLibraryDialogs from "./ReadingLibraryDialogs.jsx";

export default function ReadingLibrary({lang,route,userId,initialCreate=false,initialEditId=null}) {
  useLocale();const nav=useNavigate(),base=`/api/${lang}/reading/`,resource=useResource(base,true),action=useAction();
  const params=new URLSearchParams(route.split("?")[1]),requested=Number(params.get("folder")),folderId=Number.isSafeInteger(requested)&&requested>0?requested:null;
  const folders=resource.data?.folders||[],lessons=resource.data?.lessons||[],current=folders.find(folder=>folder.id===folderId);
  const mapped=useMemo(()=>folders.map(folder=>({...folder,name:folder.title})),[resource.data]);
  const [query,setQuery]=useState(""),[sort,setSort]=useState("recent"),[selecting,setSelecting]=useState(false),[ids,setIds]=useState([]),[notice,setNotice]=useState("");
  const [editor,setEditor]=useState(()=>initialCreate||initialEditId?{id:initialEditId,destinationId:initialCreate?folderId:null}:null),[operation,setOperation]=useState(null),[preview,setPreview]=useState(null),[hover,setHover]=useState(undefined);
  useEffect(()=>{setIds([]);},[folderId,query]);
  useEffect(()=>{if(resource.data&&folderId&&!current&&!editor)nav(`/${lang}/reading`);},[resource.data,folderId,editor]);
  const go=id=>{setQuery("");nav(`/${lang}/reading${id?`?folder=${id}`:""}`);};
  const path=folder=>folderAncestors(mapped,folder).map(item=>item.name).join(" / ");
  const openEditor=(folder=current,id=null)=>setTimeout(()=>setEditor({destinationId:folder?.id??null,destinationTitle:folder?.title,id}),0);
  const closeEditor=(leaving=false)=>{setEditor(null);if(!leaving&&(initialCreate||initialEditId)){const parent=lessons.find(item=>item.id===initialEditId)?.folder_id||folderId;nav(`/${lang}/reading${parent?`?folder=${parent}`:""}`);}};
  const openOp=value=>{action.setError("");setOperation(value);};
  const organize=values=>action.run(async signal=>{await request(base+"organize/","POST",values,signal);resource.reload();setIds([]);setNotice("Readings updated.");return true;});
  async function apply(values) {
    const op=operation,node=op.node;
    if(op.action==="create")return action.run(async signal=>{await request(base+"folders/","POST",{...values,parent_id:op.parent??null},signal);resource.reload();return true;});
    if(node?.kind==="folder")return action.run(async signal=>{await request(base+`folders/${node.id}/`,op.action==="delete"?"DELETE":"PATCH",op.action==="delete"?undefined:op.action==="move"?{parent_id:values.folder_id}:values,signal);resource.reload();if(op.action==="delete"&&folderAncestors(mapped,current).some(folder=>folder.id===node.id))go(node.parent_id);return true;});
    if(op.action==="rename"||op.action==="share")return action.run(async signal=>{await request(base+`${node.id}/${op.action==="share"?"sharing":"metadata"}/`,"PATCH",values,signal);resource.reload();return true;});
    return organize({action:op.action,ids:op.ids||[node.id],...values});
  }
  const exportText=node=>action.run(async signal=>{const detail=await request(base+node.id+"/","GET",undefined,signal);const url=URL.createObjectURL(new Blob([exerciseToText({...detail.payload,title:detail.title})],{type:"text/plain;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download=`reading-${node.id}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const menu=node=><ActionMenu quiet disabled={action.pending} label={tr(node.kind==="folder"?"Folder actions: {name}":"Reading actions: {name}",{name:node.title})} items={[
    ...(node.kind==="folder"?[
      {key:"new",icon:"plus",label:"Create reading",run:()=>openEditor(node)},
      {key:"child",icon:"folder_add",label:"New subfolder",run:()=>openOp({action:"create",parent:node.id})},
    ]:[{key:"edit",icon:"edit",label:"Edit reading",run:()=>openEditor(folders.find(folder=>folder.id===node.folder_id),node.id)}]),
    {key:"rename",icon:"edit",label:"Rename",run:()=>openOp({action:"rename",node})},
    {key:"move",icon:"move",label:"Move",run:()=>openOp({action:"move",node})},
    ...(node.kind!=="folder"?[
      {key:"copy",icon:"copy",label:"Duplicate reading",run:()=>organize({action:"copy",ids:[node.id],folder_id:node.folder_id??null})},
      {key:"share",icon:"share",label:"Sharing & categories",run:()=>openOp({action:"share",node})},
      {key:"export",icon:"download",label:"Download reading (.txt)",run:()=>exportText(node)},
    ]:[]),
    {key:"delete",icon:"trash",label:"Delete permanently",danger:true,run:()=>openOp({action:"delete",node})},
  ]}/>;
  const dropProps=parent=>({
    "data-drop-active":hover===parent?true:undefined,
    onDragOver:event=>{if(!action.pending&&event.dataTransfer.types.includes("application/x-reading-lessons")){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect=event.altKey?"copy":"move";setHover(parent);}},
    onDragLeave:event=>{if(!event.currentTarget.contains(event.relatedTarget))setHover(undefined);},
    onDrop:event=>{setHover(undefined);if(action.pending)return;try{const dropped=JSON.parse(event.dataTransfer.getData("application/x-reading-lessons"));if(!Array.isArray(dropped)||!dropped.length||dropped.length>100||!dropped.every(id=>lessons.some(item=>item.id===id)))return;event.preventDefault();event.stopPropagation();organize({action:event.altKey?"copy":"move",ids:dropped,folder_id:parent});}catch{}},
  });
  const needle=query.trim().toLocaleLowerCase();
  const visibleFolders=folders.filter(folder=>needle?folder.title.toLocaleLowerCase().includes(needle):(folder.parent_id??null)===folderId);
  const filtered=lessons.filter(item=>needle?item.title.toLocaleLowerCase().includes(needle):(item.folder_id??null)===folderId).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title):String(b.updated_at).localeCompare(String(a.updated_at)));
  const pagination=usePagination(filtered.length,`${folderId}:${needle}:${sort}`,24),shown=filtered.slice(pagination.start,pagination.end);
  const treeIds=new Set();
  if(needle)for(const folder of folders)if(folder.title.toLocaleLowerCase().includes(needle)||lessons.some(item=>item.folder_id===folder.id&&item.title.toLocaleLowerCase().includes(needle)))for(const parent of folderAncestors(mapped,folder))treeIds.add(parent.id);
  const tree=needle?mapped.filter(folder=>treeIds.has(folder.id)):mapped;
  const choose=next=>{if(next.length>100){setNotice("Select up to 100 readings at a time.");return;}setIds(next);};
  const editorFolderId=editor?.id?lessons.find(item=>item.id===editor.id)?.folder_id:editor?.destinationId;
  const folderForEditor=folders.find(folder=>folder.id===editorFolderId)||(editorFolderId?{id:editorFolderId,title:editor?.destinationTitle||tr("Folder")}:null);
  return <Page className="reading-personal-page reading-library-page">
    <SidebarTools navOnly><div className="reading-library-navigation flash-nav">
      <nav className="reading-personal-links"><Link to={`/${lang}/reading/discover`}><Icon name="explore" size={18}/><span>{tr("Explore")}</span></Link></nav>
      <Field label={tr("Search readings or folders")} value={query} onChange={setQuery} startContent={<Icon name="search" size={18}/>}/>
      <nav className="flash-folder-list" aria-label={tr("Reading folders")}>
        <div className="flash-tree-row flash-root-row" {...dropProps(null)}><button type="button" className="flash-root-folder" onClick={()=>go(null)} aria-current={!folderId?"page":undefined}><Icon name="home" size={18}/><span>{tr("My readings")}</span><small>{lessons.length}</small></button><ActionMenu quiet label={tr("Library actions")} items={[{key:"create",icon:"plus",label:"Create reading",run:()=>openEditor(null)},{key:"folder",icon:"folder_add",label:"New folder",run:()=>openOp({action:"create",parent:null})}]}/></div>
        <FolderTree folders={tree} selected={String(folderId??"")} expandAll={!!needle} onSelect={id=>go(Number(id))} renderActions={folder=>menu({...folders.find(item=>item.id===folder.id),kind:"folder"})} dropProps={dropProps}/>
      </nav>
    </div></SidebarTools>
    {notice&&<div className="reading-library-notice" role="status"><span>{tr(notice)}</span><Btn icon="close" onClick={()=>setNotice("")}>{tr("Dismiss")}</Btn></div>}
    {current&&<nav className="reading-library-breadcrumb" aria-label={tr("Folder path")}><button type="button" onClick={()=>go(null)}>{tr("My readings")}</button>{folderAncestors(mapped,current).map(folder=><span key={folder.id}><Icon name="chevron_right" size={13}/><button type="button" onClick={()=>go(folder.id)}>{folder.name||folder.title}</button></span>)}</nav>}
    <header className="reading-library-heading"><h1>{current?.title||tr("My readings")}</h1><div>
      <Btn primary isDisabled={action.pending||!!(folderId&&!current)} onClick={()=>openEditor()}><Icon name="plus" size={18}/><span>{tr("Create reading")}</span></Btn>
      <Btn icon="folder_add" onClick={()=>openOp({action:"create",parent:folderId})}>{tr("New folder")}</Btn>
      <Btn icon="manage" aria-pressed={selecting} onClick={()=>{setSelecting(value=>!value);setIds([]);}}>{tr("Select readings")}</Btn>
      <ActionMenu label={tr("Sort")} selectedKey={sort} items={[{key:"recent",icon:"history",label:"Recently updated",run:()=>setSort("recent")},{key:"title",icon:"sort",label:"Reading title A–Z",run:()=>setSort("title")}]}/>
    </div></header>
    <Status error={operation?"":action.error}/>
    {selecting&&<div className="reading-selection-bar" role="toolbar" aria-label={tr("Selected readings")}><span>{tr("{count} selected",{count:ids.length})}</span><Btn onClick={()=>choose([...new Set([...ids,...shown.map(item=>item.id)])])}>{tr("Select visible")}</Btn><Btn isDisabled={!ids.length||action.pending} onClick={()=>openOp({action:"move",ids})}>{tr("Move")}</Btn><Btn isDisabled={!ids.length||action.pending} onClick={()=>openOp({action:"copy",ids})}>{tr("Copy")}</Btn><Btn icon="trash" isDisabled={!ids.length||action.pending} onClick={()=>openOp({action:"delete",ids})}>{tr("Delete permanently")}</Btn></div>}
    <Loading resource={resource}>{()=> <>
      {visibleFolders.length>0&&<div className="reading-library-folders">{visibleFolders.map(folder=><div className="reading-folder-tile" key={folder.id} {...dropProps(folder.id)}><button type="button" onClick={()=>go(folder.id)}><Icon name="folder" size={20}/><span>{folder.title}</span></button>{menu({...folder,kind:"folder"})}</div>)}</div>}
      <div className="reading-personal-grid">{shown.map(item=><Glass as="article" key={item.id} className={`reading-personal-card ${ids.includes(item.id)?"is-selected":""}`} draggable={!action.pending} onDragStart={event=>{event.dataTransfer.setData("application/x-reading-lessons",JSON.stringify(ids.includes(item.id)?ids:[item.id]));event.dataTransfer.effectAllowed="copyMove";}}>
        <div className="reading-personal-card-top"><span className="reading-personal-card-icon"><Icon name="book" size={21}/></span>{item.level&&<small>{item.level}</small>}{selecting&&<label className="reading-select-box"><input type="checkbox" checked={ids.includes(item.id)} aria-label={tr("Select {name}",{name:item.title})} onChange={e=>choose(e.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/></label>}{menu({...item,kind:"reading"})}</div>
        <Link className="reading-personal-title" to={`/${lang}/reading/${item.id}`}>{item.title}</Link>
        <p className="reading-personal-meta">{needle&&item.folder_id?path(mapped.find(folder=>folder.id===item.folder_id)):item.topic||tr("Reading content")}</p>
        <div className="reading-personal-card-actions"><Link className="btn" to={`/${lang}/reading/${item.id}`}>{tr("Read lesson")}<Icon name="arrow" size={17}/></Link><Btn icon="eye" onClick={()=>setPreview(item)}>{tr("Preview reading")}</Btn></div>
      </Glass>)}</div>
      {!visibleFolders.length&&!filtered.length&&<div className="reading-library-empty"><Icon name={needle?"search":"book"} size={28}/><p>{tr(needle?"No matching results.":"No readings yet.")}</p>{!needle&&<Btn primary onClick={()=>openEditor()}>{tr("Create reading")}</Btn>}</div>}
      <div className="reading-library-pagination"><Pagination pagination={pagination} count={filtered.length}/></div>
    </>}</Loading>
    {editor&&(!editor.id&&editor.destinationId&&!resource.data?<PracticeModal title={tr("Loading…")} onClose={closeEditor}><Loading resource={resource}>{()=>null}</Loading></PracticeModal>:<ReadingEditorModal lang={lang} userId={userId} id={editor.id} folder={folderForEditor} onClose={closeEditor} onSaved={()=>{resource.reload();setNotice("Readings saved.");}}/>)}
    {operation&&<ReadingLibraryDialogs key={`${operation.action}:${operation.node?.id||operation.parent||"root"}`} operation={operation} folders={folders} lang={lang} pending={action.pending} error={action.error} onClose={()=>setOperation(null)} onApply={apply}/>}
    {preview&&<ReadingPreview lang={lang} userId={userId} item={preview} onClose={()=>setPreview(null)}/>}
  </Page>;
}

function ReadingPreview({lang,userId,item,onClose}) {
  const resource=useResource(`/api/${lang}/reading/${item.id}/`);
  return <PracticeModal title={item.title} size="5xl" onClose={onClose}><Loading resource={resource}>{data=><PracticeActivity preview data={previewData(data.payload)} id={`reading-preview-${item.id}`} userId={userId} lang={lang}/>}</Loading></PracticeModal>;
}
