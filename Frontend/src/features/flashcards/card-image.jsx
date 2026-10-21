import {useState} from "react";
import {safeImageLink} from "./image-search.js";
import {t as tr} from "../../i18n/index.js";
export default function CardImage({card,credit=true,compact=false,onError}){
  const [failed,setFailed]=useState("");
  const url=safeImageLink(card?.image_url);
  if(!url||failed===url)return null;
  return <figure className={`card-image ${compact?"card-image-compact":""}`}>
    <img src={url} alt={tr("Vocabulary illustration")} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>{setFailed(url);onError?.();}}/>
    {credit&&<ImageCredit card={card}/>}
  </figure>;
}
export function ImageCredit({card}){
  const source=safeImageLink(card?.image_source_url),license=safeImageLink(card?.image_license_url);
  if(!card?.image_url||(!source&&!card.image_credit&&!card.image_license))return null;
  return <div className="card-image-credit">{card.image_credit&&<span>{card.image_credit}</span>}{source&&<a href={source} target="_blank" rel="noopener noreferrer">{tr("Image source")}</a>}{card.image_license&&(license?<a href={license} target="_blank" rel="noopener noreferrer">{card.image_license}</a>:<span>{card.image_license}</span>)}</div>;
}
