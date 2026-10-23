import {cleanSearch, normalizeHistory, rememberSearch} from '../explore/explore-history.js';
export const discoveryHistoryKey = (userId,lang) => `wortify:flashcard-discovery:${userId ?? 'guest'}:${lang}`;
export function discoveryHistory(value) {
  const seen = new Set();
  const folders = (Array.isArray(value?.folders) ? value.folders : [])
    .filter(row=>row && Number.isSafeInteger(row.id) && row.id>0 && Number.isFinite(row.at))
    .sort((a,b)=>b.at-a.at).filter(row=>!seen.has(row.id) && seen.add(row.id)).slice(0,30)
    .map(({id,at})=>({id,at}));
  return {queries:normalizeHistory(value?.queries),folders};
}
export function rememberDiscovery(value,{query,folder},at=Date.now()) {
  const history=discoveryHistory(value);
  return discoveryHistory({queries:cleanSearch(query) ? rememberSearch(history.queries,query,at) : history.queries,
    folders:Number.isSafeInteger(folder) && folder>0 ? [{id:folder,at},...history.folders.filter(row=>row.id!==folder)] : history.folders});
}
export function discoveryHistoryParams(value) {
  const history=discoveryHistory(value);
  return {recent:JSON.stringify(history.queries.slice(0,5).map(row=>row.query)),recent_folders:history.folders.map(row=>row.id).join(',')};
}
