import {useState} from 'react';
import {Btn} from '../../components/ui/ui.jsx';
import {t as tr,useLocale} from '../../i18n/index.js';
import {contentTextGuide,contentBotGuide} from './content-text-guide.js';
export default function ContentImportGuide({bot=false, origin=window.location.origin}) {
 useLocale();const [notice,setNotice]=useState('');
 const guide=bot?contentBotGuide(origin)+'\n'+contentTextGuide():contentTextGuide();
 return <div className="space-y-2"><div className="flex gap-2 items-center">
 <Btn icon="copy" onClick={async()=>{try{await navigator.clipboard.writeText(guide);setNotice('Copied.');}catch{setNotice('Clipboard access is unavailable. Select the instructions below to copy them.');}}}>{tr(bot?'Copy bot instructions':'Copy guide')}</Btn>
 <a className="btn" href="/templates/content-package.txt" download>{tr('Download complete example')}</a>
 </div><details><summary>{tr('View instructions')}</summary><textarea readOnly rows={12} value={guide} aria-label={tr('Complete instructions')} className="w-full mt-3" onFocus={e=>e.target.select()}/></details>{notice&&<p role="status">{tr(notice)}</p>}</div>;
}
