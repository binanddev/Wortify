export const practiceArea = section => ['practice','explore','create'].includes(section);
export const practiceTabs = lang => [
 {section:'practice',label:'My practice',path:`/${lang}/practice/all`},
 {section:'explore',label:'Discover',path:`/${lang}/explore`},
 {section:'create',label:'Create',path:`/${lang}/create`},
];

export function folderPage(items, requestedPage = 1) {
 const folders = items.filter(item => item.kind === 'folder');
 const pageCount = Math.max(1, Math.ceil(folders.length / 15));
 const page = Math.max(1, Math.min(requestedPage, pageCount));
 return {page, pageCount, items: folders.slice((page - 1) * 15, page * 15)};
}
