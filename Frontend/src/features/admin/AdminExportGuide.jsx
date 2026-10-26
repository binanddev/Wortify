import {t as tr, useLocale} from '../../i18n/index.js';
import {PracticeRichText} from '../practice/practice-rich-text.jsx';
import vi from './export-guide.vi.md?raw';
import en from './export-guide.en.md?raw';
import de from './export-guide.de.md?raw';

export default function AdminExportGuide() {
  const locale = useLocale();
  const guide = {vi, en, de}[locale] || en;
  return <details className="admin-backup-detail">
    <summary>{tr('Administrator export guide')}</summary>
    <div className="admin-display-controls"><a href={'data:text/markdown;charset=utf-8,' + encodeURIComponent(guide)} download={`wortify-admin-export-guide-${locale}.md`}>{tr('Download administrator guide')}</a></div>
    <article className="lesson-document"><PracticeRichText>{guide}</PracticeRichText></article>
  </details>;
}
