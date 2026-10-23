import {useState} from 'react';
export function usePagination(count, key = '', size = 50) {
  const [selection, setSelection] = useState({key, page:1});
  const pages = Math.max(1, Math.ceil(count / size));
  const page = Math.min(pages, selection.key === key ? selection.page : 1);
  if (selection.key !== key || selection.page !== page) setSelection({key,page});
  return {page, pages, size, start:(page-1)*size, end:Math.min(page*size,count),
    setPage:value => setSelection({key, page:Math.max(1,Math.min(pages,value))})};
}
