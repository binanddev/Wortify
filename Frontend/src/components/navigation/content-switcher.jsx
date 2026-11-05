import { useState } from 'react';

import { useResource } from '../../lib/core.js';
import { Btn, Field, Icon, Link, Loading } from '../ui/ui.jsx';
import { PracticeModal } from '../../features/practice/practice-workspace.jsx';
import { t as tr, useLocale } from '../../i18n/index.js';

export default function ContentSwitcher({ lang, kind, currentId }) {
  useLocale();
  const [open, setOpen] = useState(false);
  const label = tr(kind === 'decks' ? 'Switch deck' : 'Switch reading');
  const close = () => setOpen(false);
  return <>
    <Btn icon="library" onClick={() => setOpen(true)}>{label}</Btn>
    {open && <PracticeModal title={label} size="lg" className="content-picker" onClose={close}>
      <Choices {...{ lang, kind, currentId }} onClose={close} />
    </PracticeModal>}
  </>;
}

function searchable(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().replaceAll(String.fromCharCode(0x111), 'd').trim();
}

function Choices({ lang, kind, currentId, onClose }) {
  useLocale();
  const [query, setQuery] = useState('');
  const decks = kind === 'decks';
  const resource = useResource(`/api/${lang}/${decks ? 'decks' : 'reading'}/`);
  const placeholder = tr(decks ? 'Search decks' : 'Search readings');
  const itemIcon = decks ? 'cards' : 'book';
  const term = searchable(query);
  return <>
    <Field autoFocus type="search" aria-label={placeholder} placeholder={placeholder}
      value={query} onChange={setQuery} />
    <div className="picker-results" key={term}>
      <Loading resource={resource}>{data => {
        const items = (data[decks ? 'decks' : 'lessons'] || []).filter(item => searchable(item.title).includes(term));
        const isCurrent = item => String(item.id) === String(currentId);
        const current = items.find(isCurrent);
        return <>
          {current && <div className="picker-row picker-current" aria-current="page">
            <Icon name={itemIcon} size={18} /><span>{current.title}</span>
            <small><Icon name="check" size={14} />{tr('Selected')}</small>
          </div>}
          {items.filter(item => !isCurrent(item)).map(item => (
            <Link key={item.id} className="btn picker-row" to={`/${lang}/${decks ? 'flashcard/deck' : 'reading'}/${item.id}`} onClick={onClose}>
              <Icon name={itemIcon} size={18} /><span>{item.title}</span>
            </Link>
          ))}
          {!items.length && <p role="status" className="picker-empty">{tr('No matching records.')}</p>}
        </>;
      }}</Loading>
    </div>
  </>;
}
