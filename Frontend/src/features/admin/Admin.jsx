import History from "./History.jsx";
import DataGrid from "./DataGrid.jsx";
import {sortQuery} from "./grid-state.js";
import {readPreference,savePreference} from "../../lib/core.js";
import { applyAppearance } from "../../themes/apply.js";
import { Link } from "../../components/ui/ui.jsx";
import EmergencyBackups from "./EmergencyBackups.jsx";
import { useState, useLayoutEffect } from "react";
import { useResource } from "../../lib/core.js";
import { Page, Btn, Glass, Loading, Field } from "../../components/ui/ui.jsx";
import Users from "./Users.jsx";
import Content from "./Content.jsx";
import SystemOverview from "./SystemOverview.jsx";
import Appearance from "./Appearance.jsx";
import ApiDocs from "./ApiDocs.jsx";
import { Pagination, dateText } from "./shared.jsx";

function Dashboard({user,open}) {
 const resource=useResource('/api/manage/summary/');
 return <Loading resource={resource}>{d=><>
  <div className="admin-kpis">{[['Accounts',d.users,'users'],['Locked accounts',d.inactive,'users'],['Public content',d.public,'content'],['Private content',d.private,'content']].map(([name,value,target])=><button key={name} onClick={()=>open(target)}><span>{name}</span><strong>{value}</strong></button>)}</div>
  <div className="admin-overview-columns"><DataGrid id="recent-content" label="Recently updated content" rows={d.recent_content} columns={[{key:'title',label:'Title',required:true},{key:'owner',label:'Owner',render:n=>n.owner.username},{key:'language',label:'Language'},{key:'visibility',label:'Visibility'},{key:'updated_at',label:'Updated',numeric:true,render:n=>dateText(n.updated_at)}]}/>

  </div>
 </>}</Loading>;
}
function Activity({ user }) {
  const [sort,setSort]=useState([{key:"at",desc:true}]);
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const resource = useResource(
    `/api/manage/activity/?page=${page}&q=${encodeURIComponent(search)}&ordering=${sortQuery(sort)}`,
  );
  return (
    <>
      <p className="mb-4 text-(--muted)">
        {user.superuser
          ? "Admin and staff activity history."
          : "Your activity history."}
      </p>
      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
        }}
      >
        <Field
          label="Search content or actor"
          value={query}
          onChange={setQuery}
        />
        <Btn type="submit">Search</Btn>
        <Btn onClick={resource.reload}>Refresh</Btn>
      </form>
      <Loading label="Loading admin data…" resource={resource}>
        {(d) => (
          <>
            <DataGrid id="activity" label="Activity log" rows={d.rows} sort={sort} onSort={next=>{setSort(next);setPage(1);}} columns={[{key:'actor',label:'Actor',required:true},{key:'target',label:'Target'},{key:'message',label:'Action'},{key:'at',label:'Time',numeric:true,render:row=>dateText(row.at)},{key:'id',label:'ID',numeric:true}]}/>
            <Pagination page={page} total={d.total} onChange={setPage} />
          </>
        )}
      </Loading>
    </>
  );
}
export default function Admin({ user }) {
  const [tab, setTab] = useState("dashboard");
  const [mode,setMode]=useState(()=>readPreference('wortify:admin:mode','light'));
  const [density,setDensity]=useState(()=>readPreference('wortify:admin:density','compact'));
  useLayoutEffect(()=>{document.documentElement.dataset.adminMode=mode;document.documentElement.dataset.adminDensity=density;savePreference('wortify:admin:mode',mode);savePreference('wortify:admin:density',density);},[mode,density]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousStyle = root.getAttribute("style");
    const previousData = {...root.dataset};
    applyAppearance();
    document.documentElement.dataset.interface = "admin";
    document.documentElement.style.removeProperty("--ink");
    document.documentElement.style.removeProperty("--muted");
    document.documentElement.style.setProperty("--site-bg-image", "none");
    return () => {
      if (previousStyle === null) root.removeAttribute("style");
      else root.setAttribute("style", previousStyle);
      for (const key of Object.keys(root.dataset)) {
        if (!(key in previousData)) delete root.dataset[key];
      }
      Object.assign(root.dataset, previousData);
      delete root.dataset.adminMode;
      delete root.dataset.adminDensity;
    };
  }, []);
  const tabs = [
    ["dashboard", "Overview"],
    ["users", "Users"],
    ["content", "Content"],
    ["activity", "Activity log"],
    ["history", "Change log"],
    ...(user.superuser
      ? [
          ["backups", "Emergency backups"],
          ["system", "System"],
          ["api", "API documentation"],
          ["appearance", "Site appearance"],
        ]
      : []),
  ];
  return (
    <div className="admin-console">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">wortify<span> / CONTROL CENTER</span></Link>
        <nav aria-label="Admin features">{tabs.map(([key,label])=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)}>{label}</button>)}</nav>
        <div className="admin-identity"><strong>{user.username}</strong><span>{user.superuser ? 'Administrator' : 'Staff'}</span><Link to="/">Back to home</Link></div>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar"><div><small>WORKSPACE / ADMINISTRATION</small><h1>{tabs.find(([key])=>key===tab)?.[1]}</h1></div><div className="admin-display-controls"><label>Density <select value={density} onChange={e=>setDensity(e.target.value)}><option value="comfortable">Comfortable</option><option value="cozy">Cozy</option><option value="compact">Compact</option></select></label><button onClick={()=>setMode(mode==='dark'?'light':'dark')} aria-pressed={mode==='dark'}>{mode==='dark'?'Light mode':'Dark mode'}</button><Link to="/">Home ↗</Link></div></header>
        <main className="admin-main" id="main-content">
      {tab === "history" && <History/>}
      {tab === "dashboard" && <Dashboard user={user} open={setTab} />}
      {tab === "users" && <Users user={user} />}
      {tab === "content" && <Content user={user} />}
      {tab === "activity" && <Activity user={user} />}
      {tab === "backups" && user.superuser && <EmergencyBackups />}
      {tab === "system" && user.superuser && <SystemOverview />}
      {tab === "api" && user.superuser && <ApiDocs />}
      {tab === "appearance" && user.superuser && <Appearance />}
        </main>
      </div>
    </div>
  );
}
