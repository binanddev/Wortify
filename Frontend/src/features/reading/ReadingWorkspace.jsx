import {useState} from "react";
import {t as tr,useLocale} from "../../i18n/index.js";
import {request,useAction,useNavigate,useResource} from "../../lib/core.js";
import {Page,SidebarTools,Btn,Icon,Link,Loading,Status} from "../../components/ui/ui.jsx";
import ActionMenu from "../../components/ui/action-menu.jsx";
import ContentSwitcher from "../../components/navigation/content-switcher.jsx";
import {PracticeActivity} from "../practice/practice-activity.jsx";
import {ReadingPassage} from "../practice/reading-layout.jsx";
import {previewData} from "../practice/exercise-types.js";
import ReadingDiscover from "./ReadingDiscover.jsx";
import ReadingLibrary from "./ReadingLibrary.jsx";
import ReadingLibraryDialogs from "./ReadingLibraryDialogs.jsx";

export default function ReadingWorkspace({lang,route,userId,sound,onRequireAccount,initialReadingId}) {
  useLocale();const nav=useNavigate(),action=useAction(),parts=route.split("?")[0].split("/").filter(Boolean);
  const discovering=!!onRequireAccount||parts[2]==="discover",creating=parts[2]==="create",editing=parts[3]==="edit";
  const id=creating||discovering?null:parts[2],passageOnly=parts[3]==="passage";
  const resource=useResource(id&&!editing?`/api/${lang}/reading/${id}/`:null,true);
  const [operation,setOperation]=useState(null),[progressError,setProgressError]=useState("");
  const lesson=resource.data;
  if(!discovering&&(!id||editing))return <ReadingLibrary key={`${lang}:${userId}:${creating?"create":editing?`edit-${id}`:"library"}`} lang={lang} userId={userId} route={route} initialCreate={creating} initialEditId={editing?Number(id):null}/>;
  if(passageOnly)return <Page><h1>{lesson?.title||tr("Reading")}</h1><Loading resource={resource}>{data=><ReadingPassage exercise={data.payload}/>}</Loading></Page>;
  const apply=values=>action.run(async signal=>{
    if(operation.action==="delete"){await request(`/api/${lang}/reading/${id}/`,"DELETE",undefined,signal);nav(`/${lang}/reading`);}
    else {await request(`/api/${lang}/reading/${id}/sharing/`,"PATCH",values,signal);resource.reload();}
    return true;
  });
  return <Page className={discovering?"reading-discover-page":"reading-personal-page"}>
    <SidebarTools navOnly><nav className="reading-navigation" aria-label={tr("Reading tools")}>
      <div className={discovering?"reading-discover-links":"reading-personal-links"}>
        <Link to={`/${lang}/reading`}><Icon name="book" size={18}/><span>{tr("My readings")}</span></Link>
        <Link to={`/${lang}/reading/discover`} aria-current={discovering?"page":undefined}><Icon name="explore" size={18}/><span>{tr("Explore")}</span></Link>
      </div>
      {id&&lesson&&<div className="reading-study-tools">
        <ContentSwitcher lang={lang} kind="reading" currentId={id}/>
        <Btn icon="edit" onClick={()=>nav(`/${lang}/reading/${id}/edit`)}>{tr("Edit reading")}</Btn>
        <ActionMenu label={tr("Reading actions: {name}",{name:lesson.title})} disabled={action.pending} items={[
          {key:"sharing",icon:"share",label:"Sharing & categories",run:()=>{action.setError("");setOperation({action:"share",node:{...lesson,kind:"reading"}});}},
          {key:"passage",icon:"external",label:"Open passage in new tab",run:()=>window.open(`/${lang}/reading/${id}/passage`,"_blank","noopener,noreferrer")},
          {key:"delete",icon:"trash",label:"Delete permanently",danger:true,run:()=>{action.setError("");setOperation({action:"delete",node:{...lesson,kind:"reading"}});}},
        ]}/>
      </div>}
    </nav></SidebarTools>
    <h1>{discovering?tr("Explore"):lesson?.title||tr("Reading")}</h1>
    <Status error={progressError}/>
    {discovering?<ReadingDiscover lang={lang} userId={userId} onRequireAccount={onRequireAccount} initialReadingId={initialReadingId}/>:<Loading resource={resource}>{data=><PracticeActivity key={data.revision} data={{...previewData(data.payload),progress:data.progress}} id={`reading-${id}-${data.revision}`} userId={userId} lang={lang} sound={sound} onProgress={completed=>request(`/api/${lang}/reading/${id}/`,"POST",{completed,revision:data.revision}).catch(e=>setProgressError(e.message))}/>}</Loading>}
    {operation&&<ReadingLibraryDialogs key={operation.action} operation={operation} folders={[]} lang={lang} pending={action.pending} error={action.error} onClose={()=>setOperation(null)} onApply={apply}/>}
  </Page>;
}
