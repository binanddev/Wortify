import { lazy, Suspense, useState } from "react";
import { Btn, Link, Icon, SidebarTools, Status, Confirm } from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { clearContentCache } from "../../lib/request.js";
import { configureStaffWorkspace, staffWorkspace, selectStaffWorkspace } from "../../lib/staff-workspace.js";
import { flushLearning } from "../learning/learning-sync.js";
import { t as tr, useLocale } from "../../i18n/index.js";
const BulkImport = lazy(() => import("./ContentPackageImport.jsx"));
const ImportApi = lazy(() => import("./ContentImportApi.jsx"));
const Publishing = lazy(() => import("./ContentPolicy.jsx"));

export default function StaffTools({ user, lang, section, libraryLevel = true }) {
  useLocale();
  configureStaffWorkspace(user);
  const scope = staffWorkspace();
  const [tool, setTool] = useState(null), [switching, setSwitching] = useState(false);
  const type = section === "flashcard" ? "flashcards" : section === "reading" ? "reading" : "practice";
  const contentRoute = ["flashcard", "reading", "practice", "create", "explore"].includes(section);
  const refresh = () => window.dispatchEvent(new Event("staff-content-changed"));
  return <>
    <SidebarTools navOnly><div className="flex flex-wrap items-center gap-2" aria-label={tr("Staff tools")}>
      <Btn onClick={()=>setSwitching(true)}>{tr(scope === "shared" ? "Wortify library" : "Personal sandbox")}</Btn>
      {contentRoute && libraryLevel && <>
        <Btn icon="upload" onClick={()=>setTool("import")}>{tr(scope === "shared" ? "Bulk import" : "Publish to Wortify")}</Btn>
        {scope === "shared" && <Btn icon="settings" onClick={()=>setTool("options")}>{tr("Publishing tools")}</Btn>}
      </>}
      <Link className="btn" to="/manage" title={tr("Accounts & history")} aria-label={tr("Accounts & history")}><Icon name="admin"/></Link>
    </div></SidebarTools>
    {switching && <Confirm title={tr("Switch to {name}?", {name:tr(scope === "shared" ? "Personal sandbox" : "Wortify library")})} confirmLabel="Switch workspace" description={tr("Unsaved edits on this page will be discarded. Your saved content and learning progress are kept.")} onClose={()=>setSwitching(false)} onConfirm={async()=>{
      await Promise.all([flushLearning(user.id,"en"),flushLearning(user.id,"de")]);
      selectStaffWorkspace(scope === "shared" ? "personal" : "shared");
      clearContentCache();
      location.assign(`/${lang}/${section === "reading" ? "reading" : type === "practice" ? "create" : "flashcard"}`);
    }}/>}
    {tool && <PracticeModal title={tr(tool === "import" ? "Bulk import" : tool === "api" ? "Content import API" : "Publishing tools")} size="5xl" onClose={()=>setTool(null)}>
      <Suspense fallback={<Status>{tr("Loading…")}</Status>}>
        {tool === "import" ? <BulkImport section={type} initialLanguage={lang} initialTab={scope === "personal" ? "import" : "library"} onPublished={scope === "shared" ? refresh : undefined}/> : tool === "api" ? <ImportApi section={type}/> : <div className="space-y-4"><Btn icon="upload" onClick={()=>setTool("api")}>{tr("Content import API")}</Btn><Publishing/></div>}
      </Suspense>
    </PracticeModal>}
  </>;
}
