import {useEffect,useRef,useState} from "react";
import {Btn,Field,Status} from "../../components/ui/ui.jsx";
import {t as tr,useLocale} from "../../i18n/index.js";
import CardImage from "./card-image.jsx";
import {emptyImage,IMAGE_FIELDS,safeImageLink,searchImages} from "./image-search.js";
export default function CardImagePicker({values,set,lang}){
  useLocale();const [query,setQuery]=useState(values.german_text||"");const [images,setImages]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState("");const controller=useRef(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function search(){controller.current?.abort();const current=new AbortController();controller.current=current;setBusy(true);setError("");try{const result=await searchImages(query,{signal:current.signal,language:lang});if(!current.signal.aborted){setImages(result);if(!result.length)setError("No matching images. Try another keyword or paste a link.");}}catch(e){if(!current.signal.aborted)setError(e.message);}finally{if(controller.current===current)setBusy(false);}}
  return <section className="grid gap-3">
    <Field label={tr("Image link")} type="url" value={values.image_url||""} onChange={url=>set({...values,...emptyImage(),image_url:url})}/>
    {values.image_url&&!safeImageLink(values.image_url)&&<p role="alert">{tr("Use a public HTTPS image link.")}</p>}
    {values.image_url&&<><CardImage card={values}/><Btn onClick={()=>set({...values,...emptyImage()})}>{tr("Remove image")}</Btn></>}
    <details><summary>{tr("Find a free image")}</summary><div className="grid gap-3 mt-3"><Field label={tr("Image keyword")} value={query} onChange={setQuery}/><Btn isDisabled={busy||!query.trim()} onClick={search}>{tr(busy?"Searching…":"Search images")}</Btn><Status error={error&&tr(error)}/><div className="card-image-results">{images.map(image=><div key={image.image_url}><CardImage card={image}/><Btn onClick={()=>set({...values,...Object.fromEntries(IMAGE_FIELDS.map(key=>[key,image[key]||""]))})}>{tr("Use image")}</Btn></div>)}</div></div></details>
  </section>;
}
