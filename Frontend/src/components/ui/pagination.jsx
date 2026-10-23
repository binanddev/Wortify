import {Btn} from './ui.jsx';
import {t as tr, useLocale} from '../../i18n/index.js';
export default function Pagination({pagination, count}) {
  useLocale();
  const {page,pages,start,end,setPage} = pagination;
  if (pages <= 1) return null;
  return <nav className="toolbar" aria-label={`${page} / ${pages}`}>
    <Btn isDisabled={page===1} onClick={()=>setPage(page-1)}>{tr('Previous')}</Btn>
    <span aria-live="polite">{start+1}–{end} / {count}</span>
    <Btn isDisabled={page===pages} onClick={()=>setPage(page+1)}>{tr('Next')}</Btn>
  </nav>;
}
