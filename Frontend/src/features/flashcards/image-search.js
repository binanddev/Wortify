export const IMAGE_FIELDS=["image_url","image_source_url","image_credit","image_license","image_license_url"];
export const emptyImage=()=>Object.fromEntries(IMAGE_FIELDS.map(key=>[key,""]));
export function safeImageLink(value){
  if(!value)return "";
  try{const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password||/^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname)||/\.(local|internal|localhost)$/i.test(url.hostname))return "";return url.href;}catch{return "";}
}
export function imageQuery(term){return String(term||"").replace(/^(der|die|das|ein|eine|the|a|an)\s+/i,"").replace(/["|:{}<>]/g," ").trim().slice(0,100);}
const cache=new Map();
function plain(value){const doc=new DOMParser().parseFromString(value||"","text/html");return doc.body.textContent.trim();}
export function commonsResults(pages){
  return Object.values(pages||{}).sort((a,b)=>(a.index||0)-(b.index||0)).flatMap(page=>{
    const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
    if(!info||!/^image\/(jpeg|png|webp|gif)$/.test(info.mime||""))return [];
    const license=plain(meta.LicenseShortName?.value),licenseUrl=safeImageLink(meta.LicenseUrl?.value?.replace(/^http:/,"https:"));
    if(!/^(CC BY(?:-SA)? [\d.]+|CC0(?: [\d.]+)?|Public domain)$/i.test(license))return [];
    if(/^CC BY/i.test(license)&&(!licenseUrl||!meta.Artist?.value))return [];
    const url=safeImageLink(info.thumburl||info.url),source=safeImageLink(info.descriptionurl);
    if(!url||new URL(url).hostname!=="upload.wikimedia.org"||!source)return [];
    return [{image_url:url,image_source_url:source,image_credit:plain(meta.Artist?.value).slice(0,500),image_license:license,image_license_url:licenseUrl,title:plain(page.title?.replace(/^File:/,""))}];
  });
}
const UNAVAILABLE="Image search is unavailable. Try again or paste an image link.";
async function wiki(host,params,signal){
  const controller=new AbortController(),abort=()=>controller.abort();
  const timer=setTimeout(abort,12000);signal?.addEventListener("abort",abort,{once:true});
  if(signal?.aborted)controller.abort();
  try {
    const response=await fetch(`https://${host}/w/api.php?`+new URLSearchParams({action:"query",format:"json",origin:"*",...params}),{signal:controller.signal,credentials:"omit",referrerPolicy:"no-referrer"});
    if(!response.ok){const error=Error(UNAVAILABLE);error.rateLimited=response.status===429;throw error;}
    const data=await response.json();if(data.error)throw Error(UNAVAILABLE);return data.query?.pages||{};
  }catch(error){if(signal?.aborted||error.rateLimited)throw error;throw Error(UNAVAILABLE);}
  finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}
async function conceptImages(query,language,signal){
  // Exact articles/redirects avoid unrelated broad search hits and ambiguous pages.
  const pages=await wiki(`${language}.wikipedia.org`,{titles:query,redirects:"1",prop:"pageimages|pageprops",piprop:"name",pilicense:"free",ppprop:"disambiguation"},signal);
  const titles=Object.values(pages).filter(page=>page.pageimage&&!("disambiguation" in (page.pageprops||{}))).map(page=>"File:"+page.pageimage);
  if(!titles.length)return [];
  return commonsResults(await wiki("commons.wikimedia.org",{titles:titles.join("|"),prop:"imageinfo",iiprop:"url|mime|extmetadata",iiurlwidth:"320"},signal));
}
export async function searchImages(term,{signal,language="de",meaning=""}={}){
  const query=imageQuery(term);if(!query)return [];
  const locale=["de","en","vi"].includes(language)?language:"de";
  const key=JSON.stringify([query,locale,meaning]);if(cache.has(key))return cache.get(key);
  let images=[],failures=0;
  const attempt=async(fn)=>{try{return await fn();}catch(error){if(signal?.aborted||error.rateLimited)throw error;failures++;return [];}};
  images=await attempt(()=>conceptImages(query,locale,signal));
  // A saved Vietnamese meaning provides a second concept lookup, without machine translation.
  const translation=imageQuery(meaning.split(/[;,\n]/)[0]);
  if(!images.length&&translation&&translation!==query)images=await attempt(()=>conceptImages(translation,"vi",signal));
  if(!images.length){
    const pages=await attempt(()=>wiki("commons.wikimedia.org",{generator:"search",gsrsearch:`intitle:"${query}" filetype:bitmap`,gsrnamespace:"6",gsrlimit:"8",prop:"imageinfo",iiprop:"url|mime|extmetadata",iiurlwidth:"320"},signal));
    images=commonsResults(pages);
  }
  if(!images.length&&failures)throw Error(UNAVAILABLE);
  if(cache.size>=500)cache.delete(cache.keys().next().value);cache.set(key,images);return images;
}
