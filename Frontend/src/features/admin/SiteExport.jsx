import AdminExportGuide from './AdminExportGuide.jsx';
import {useEffect, useState} from 'react';
import {t as tr, useLocale} from '../../i18n/index.js';
import {request, useResource} from '../../lib/core.js';
import {Btn, Field, Select, Loading, Status} from '../../components/ui/ui.jsx';
import {Pagination, roleName} from './shared.jsx';

const MODULES = [
  ['cards', 'Flashcards'], ['practice', 'Practice'], ['reading', 'Reading'],
];
const MODEL_LABELS = {
  "cards.folder": "Flashcard folders",
  "cards.deck": "Flashcard decks",
  "cards.card": "Flashcards",
  "cards.cardaudio": "Flashcard speech recordings",
  "cards.studyprogress": "Flashcard learning progress",
  "cards.studyattempt": "Flashcard answers",
  "cards.decklearningstate": "Deck learning state",
  "cards.studysession": "Study sessions",
  "cards.learningevent": "Learning activity history",
  "cards.importbatch": "Flashcard import history",
  "cards.matchround": "Matching game rounds",
  "cards.deckoperation": "Deck edit history",
  "cards.studysettings": "Study preferences",
  "practice.practicenode": "Practice exercises and theory",
  "practice.practicemedia": "Uploaded learning media",
  "practice.practiceprogress": "Practice progress",
  "practice.practiceattempt": "Practice answers",
  "practice.readingfolder": "Reading folders",
  "practice.readinglesson": "Reading lessons",
  "practice.readingprogress": "Reading progress",
  "practice.systemcontentpackage": "System content packages",
  "practice.packagereceipt": "Content package import history",
  "users.classroom": "Classrooms",
  "users.teachingboard": "Teaching boards",
  "users.boardpdf": "Class PDFs",
  "users.boardevent": "Board sync history",
  "users.classroomassignment": "Classroom assignments",
  "users.profile": "Account profiles",
  "users.theme": "Saved appearance themes",
  "auth.user": "Accounts",
  "auth.group": "Permission groups",
  "auth.permission": "Account permissions",
  "contenttypes.contenttype": "Permission resource types",
  "admin.logentry": "Administrator audit history",
  "content.backendcheck": "System check history",
  "content.siteappearance": "Website appearance",
  "content.contentpolicy": "Content policies"
};
const INITIAL = {
  dataset: 'learning', identity: 'anonymous', visibility: 'all', scope: 'all',
  include_media: true, include_progress: false, include_audit: false,
  include_credentials: false, modules: MODULES.map(([key]) => key),
  language: '', date_from: '', date_to: '',
};

export default function SiteExport() {
  useLocale();
  const [options, setOptions] = useState(INITIAL);
  const [q, setQ] = useState(''), [role, setRole] = useState(''), [status, setStatus] = useState('');
  const [page, setPage] = useState(1), [ids, setIds] = useState([]);
  const [preview, setPreview] = useState(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [downloaded, setDownloaded] = useState(false);
  const resource = useResource(`/api/manage/users/?q=${encodeURIComponent(q)}&role=${role}&status=${status}&page=${page}`);
  const learning = options.dataset !== 'accounts';
  const payload = {...options, q, role, status, ids};
  const signature = JSON.stringify(payload);
  useEffect(() => {setPreview(null); setDownloaded(false); setError('');}, [signature]);
  const update = (key, value) => setOptions(old => ({...old, [key]: value}));
  const changeDataset = value => setOptions(old => ({...old, dataset:value,
    identity:value === 'learning' ? old.identity : 'linked',
    include_credentials:value === 'learning' ? false : old.include_credentials,
    include_progress:value === 'accounts' ? false : old.include_progress,
    include_audit:value === 'full' ? old.include_audit : false,
  }));
  const choosePreset = preset => {
    setOptions({...INITIAL, ...(preset === 'full' ? {dataset:'full', identity:'linked', include_progress:true, include_audit:true}
      : preset === 'accounts' ? {dataset:'accounts', identity:'linked', include_media:false}
      : preset === 'public' ? {visibility:'public'} : {})});
    setQ(''); setRole(''); setStatus(''); setPage(1); setIds([]);
  };
  const invalid = options.scope === 'selected' && !ids.length || learning && !options.modules.length ||
    Boolean(options.date_from && options.date_to && options.date_from > options.date_to);
  async function run(action) {
    setBusy(true); setError('');
    try {await action();} catch(e) {setError(e.message); setPreview(null);} finally {setBusy(false);}
  }
  async function download() {
    const csrf = decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)||'');
    const response = await fetch('/api/manage/backups/site/', {method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json', 'X-CSRFToken':csrf}, body:JSON.stringify({...payload, confirm:'EXPORT'})});
    if (!response.ok) {let data; try {data = await response.json();} catch { /* A proxy can return HTML. */ }
      throw new Error(data?.error || tr('Export failed. Please try again.'));}
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = url;
    link.download = `wortify-site-${new Date().toISOString().slice(0,10)}.zip`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000); setDownloaded(true);
  }
  return <section aria-labelledby="site-export-title">
    <h2 id="site-export-title">{tr('Export website data')}</h2>
    <p className="mb-4">{tr('Download learning content from every section, with optional accounts and learning history. Each ZIP includes a data dictionary, integrity checks and recovery guidance.')}</p>
    <AdminExportGuide />
    <fieldset disabled={busy} className="admin-export-presets">
      <legend>{tr('Quick configurations')}</legend>
      <Btn onClick={()=>choosePreset('learning')}>{tr('All learning content')}</Btn>
      <Btn onClick={()=>choosePreset('public')}>{tr('Public learning content')}</Btn>
      <Btn onClick={()=>choosePreset('full')}>{tr('Content and accounts')}</Btn>
      <Btn onClick={()=>choosePreset('accounts')}>{tr('Accounts only')}</Btn>
    </fieldset>
    <fieldset disabled={busy} className="admin-backup-detail">
      <legend>{tr('1. Choose the data')}</legend>
      <div className="admin-backup-options">
        <Select label={tr('Data to export')} value={options.dataset} onChange={changeDataset}>
          <option value="learning">{tr('Learning content only')}</option><option value="full">{tr('Content and accounts')}</option><option value="accounts">{tr('Accounts only')}</option>
        </Select>
        {learning && <Select label={tr('Content visibility')} value={options.visibility} onChange={v=>update('visibility',v)}>
          <option value="all">{tr('Public and private')}</option><option value="public">{tr('Public only')}</option><option value="private">{tr('Private only')}</option>
        </Select>}
        {options.dataset === 'learning' && <Select label={tr('Account association')} value={options.identity} onChange={v=>setOptions(old=>({...old,identity:v,include_credentials:false,include_progress:v==='anonymous'?false:old.include_progress}))}>
          <option value="anonymous">{tr('Without account identities')}</option><option value="linked">{tr('Keep account references')}</option>
        </Select>}
        {learning && <Select label={tr('Learning language')} value={options.language} onChange={v=>update('language',v)}>
          <option value="">{tr('All languages')}</option><option value="de">{tr('German')}</option><option value="en">{tr('English')}</option>
        </Select>}
      </div>
      {learning && <>
        <div className="admin-export-modules" role="group" aria-label={tr('Learning sections')}>
          {MODULES.map(([key,label])=><label key={key}><input type="checkbox" checked={options.modules.includes(key)} onChange={e=>update('modules',e.target.checked?[...options.modules,key]:options.modules.filter(x=>x!==key))}/>{tr(label)}</label>)}
        </div>
        <p>{tr('Practice includes every exercise and theory type, including grammar, listening, writing, speaking and dictation.')}</p>
        {!options.modules.length && <p role="alert">{tr('Select at least one learning section.')}</p>}
        <div className="admin-backup-options">
          <Field type="date" label={tr('Updated from (optional)')} value={options.date_from} onChange={v=>update('date_from',v)}/>
          <Field type="date" label={tr('Updated through (optional)')} value={options.date_to} onChange={v=>update('date_to',v)}/>
        </div>
        <p>{tr('Dates filter the latest update, or creation date where no update timestamp exists. Related records and parent folders are retained to preserve content structure.')}</p>
        {options.date_from && options.date_to && options.date_from > options.date_to && <p role="alert">{tr('The end date must be on or after the start date.')}</p>}
        <label><input type="checkbox" checked={options.include_progress} disabled={options.identity==='anonymous'} onChange={e=>update('include_progress',e.target.checked)}/>{tr('Include learning progress and activity')}</label>
        {options.identity === 'anonymous' && <p>{tr('Account identities and personal learning history are excluded. Content keeps internal references for analysis; review free text and attachments before sharing.')}</p>}
      </>}
        <label><input type="checkbox" checked={options.include_media} onChange={e=>update('include_media',e.target.checked)}/>{tr('Include uploaded images, audio and attachments')}</label>
        {!options.include_media && <p>{tr('Media files will be omitted. References remain in the data; this export cannot fully restore attachments.')}</p>}
      {options.dataset === 'full' && <label><input type="checkbox" checked={options.include_audit} onChange={e=>update('include_audit',e.target.checked)}/>{tr('Include administrator audit history')}</label>}
      {options.dataset !== 'learning' && <>
        <label><input type="checkbox" checked={options.include_credentials} onChange={e=>update('include_credentials',e.target.checked)}/>{tr('Include password hashes for emergency account recovery')}</label>
        {options.include_credentials && <p>{tr('Anyone with this file can obtain password hashes. Store it encrypted and restrict access.')}</p>}
      </>}
    </fieldset>
    <fieldset disabled={busy} className="admin-backup-detail">
      <legend>{tr('2. Choose the account scope')}</legend>
      <Select label={tr('Export scope')} value={options.scope} onChange={v=>update('scope',v)}>
        <option value="all">{tr('All accounts')}</option><option value="filtered">{tr('All matching filters')}</option><option value="selected">{tr('Selected accounts ({v0})',{v0:ids.length})}</option>
      </Select>
      <p>{options.scope === 'all' ? tr('All accounts, regardless of filters.') : tr('Learning content is filtered by its owner. Related child records are included with the selected content.')}</p>
      {options.include_progress && <p>{tr('Learning history belongs to the selected learners and may reference content by other authors. References outside the export are documented in reference/unresolved.json.')}</p>}
      {options.scope !== 'all' && <>
        <div className="admin-backup-options">
          <Field label={tr('Username or email')} value={q} onChange={v=>{setQ(v);setPage(1);}}/>
          <Select label={tr('Role')} value={role} onChange={v=>{setRole(v);setPage(1);}}><option value="">{tr('All roles')}</option><option value="user">{tr('User')}</option><option value="staff">{tr('Staff')}</option><option value="superuser">{tr('Admin')}</option></Select>
          <Select label={tr('Status')} value={status} onChange={v=>{setStatus(v);setPage(1);}}><option value="">{tr('Any status')}</option><option value="active">{tr('Active')}</option><option value="inactive">{tr('Inactive')}</option></Select>
        </div>
        <Loading resource={resource}>{data=><>
          {options.scope === 'selected' && <div className="admin-selection-bar"><span>{tr('{v0} selected across all pages',{v0:ids.length})}</span><Btn onClick={()=>setIds(old=>[...new Set([...old,...data.users.map(u=>u.id)])])}>{tr('Select this page')}</Btn><Btn onClick={()=>setIds([])}>{tr('Clear selection')}</Btn></div>}
          <div className="overflow-x-auto"><table><thead><tr>{options.scope === 'selected' && <th>{tr('Select')}</th>}<th>{tr('Account')}</th><th>{tr('Email')}</th><th>{tr('Role')}</th><th>{tr('Status')}</th></tr></thead><tbody>{data.users.map(u=><tr key={u.id}>
            {options.scope === 'selected' && <td><input type="checkbox" aria-label={tr('Select {v0}',{v0:u.username})} checked={ids.includes(u.id)} onChange={()=>setIds(old=>old.includes(u.id)?old.filter(id=>id!==u.id):[...old,u.id])}/></td>}
            <td>{u.username}</td><td>{u.email || '—'}</td><td>{tr(roleName(u))}</td><td>{tr(u.is_active?'Active':'Inactive')}</td>
          </tr>)}</tbody></table></div>
          {!data.users.length && <p>{tr('No matching accounts.')}</p>}
          <Pagination page={page} total={data.total} size={50} onChange={setPage}/>
        </>}</Loading>
      </>}
    </fieldset>
    <section className="admin-backup-detail" aria-label={tr('Export documentation')}>
      <h3>{tr('Documentation travels with your data')}</h3>
      <p>{tr('Restore this format through an operator into an isolated database; the existing ZIP import screens accept different portable/emergency formats.')}</p>
      <p>{tr('The archive records your filters, exported counts, model fields and relationships, plus checksums and instructions for recovery and analysis. Keep the entire ZIP together.')}</p>
      <p>{tr('Sessions and server secrets are excluded. Maximum 2 GB per export; split large exports using filters. This does not replace a full database and server backup.')}</p>
    </section>
    <Status error={error}/>
    <Btn primary isDisabled={busy || invalid} onClick={()=>run(async()=>{setDownloaded(false); setPreview(await request('/api/manage/backups/site/','POST',{...payload,preview:true}));})}>{tr('Review export')}</Btn>
    {preview && <section className="admin-export-review" aria-live="polite">
      <h3>{tr('3. Review and download')}</h3>
      <p>{tr('{v0} accounts in scope',{v0:preview.count})}</p>
      <dl className="admin-export-counts">{preview.counts.map(({model,count})=><div key={model}><dt>{tr(MODEL_LABELS[model] || model)}</dt><dd>{count}</dd></div>)}</dl>
      {preview.warnings?.length>0 && <ul>{preview.warnings.map((warning,index)=><li key={index}>{tr(warning)}</li>)}</ul>}
      <p>{tr('Existing data will not be changed.')}</p>
      <Btn primary isDisabled={busy || invalid} onClick={()=>run(download)}>{tr('Download documented ZIP')}</Btn>
    </section>}
    {busy && <p role="status">{tr('Preparing export. Keep this page open…')}</p>}
    {downloaded && <p role="status">{tr('The ZIP is ready. Check your browser downloads and keep its recovery documentation with the archive.')}</p>}
  </section>;
}
