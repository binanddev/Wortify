import { Link, Icon, SidebarTools } from '../../components/ui/ui.jsx';
import { practiceTabs } from './practice-area.js';
export default function PracticeArea({lang,section,children}) {
 return <div className="practice-area">
  <SidebarTools navOnly><nav className="practice-section-nav" aria-label="Practice Hub sections">
   {practiceTabs(lang).map(tab=><Link key={tab.section} to={tab.path} aria-current={section===tab.section?'page':undefined}><Icon name={tab.section==='practice'?'home':tab.section==='explore'?'search':'plus'} size={20}/><span>{tab.label}</span></Link>)}
  </nav></SidebarTools>
  {children}
 </div>;
}
