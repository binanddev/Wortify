import { t as tr, useLocale } from "../../i18n/index.js";
import { Link, Icon, SidebarTools } from '../../components/ui/ui.jsx';
import { practiceTabs } from './practice-area.js';
export default function PracticeArea({lang,section,children}) {
  useLocale();
 return <div className="practice-area">
  <SidebarTools navOnly><nav className="practice-section-nav" aria-label={tr("Practice Hub sections")}>
   {section !== 'practice' && <Link to={`/${lang}/practice/all`} title={tr("My practice")} aria-label={tr("My practice")}><Icon name="home" size={18}/><span>{tr("My practice")}</span></Link>}
   {practiceTabs(lang).map(tab=><Link key={tab.section} to={tab.path} title={tr(tab.label)} aria-label={tr(tab.label)} aria-current={section===tab.section?'page':undefined}><Icon name={tab.icon} size={18}/><span>{tr(tab.label)}</span></Link>)}
  </nav></SidebarTools>
  {children}
 </div>;
}
