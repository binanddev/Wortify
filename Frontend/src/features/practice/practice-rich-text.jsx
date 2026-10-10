import {useMemo} from "react";
import {parseMarkup} from "./content-markup.js";
import { Fragment } from "react";

export const TEXT_COLORS = {
  red: "#ef4444",
  rose: "#f43f5e",
  pink: "#ec4899",
  magenta: "#d946ef",
  purple: "#a855f7",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  blue: "#3b82f6",
  sky: "#0ea5e9",
  cyan: "#06b6d4",
  teal: "#14b8a6",
  emerald: "#10b981",
  green: "#22c55e",
  lime: "#84cc16",
  yellow: "#eab308",
  amber: "#f59e0b",
  orange: "#f97316",
  coral: "#fb7185",
  slate: "#64748b",
  gray: "#9ca3af",
};


function RenderNodes({nodes,renderBlank}) {
 return nodes.map((node,i)=>{
  const children=node.children?<RenderNodes nodes={node.children} renderBlank={renderBlank}/>:null;
  if(node.type==="text")return <Fragment key={i}>{node.text}</Fragment>;
  if(node.type==="break")return <br key={i}/>;
  if(node.type==="blank")return <Fragment key={i}>{renderBlank?renderBlank(node.index):"{{"+(node.index+1)+"}}"}</Fragment>;
  if(node.type==="image")return <span key={i} className={"lesson-image lesson-align-"+node.align}><img src={node.src} alt={node.alt} loading="lazy" referrerPolicy="no-referrer" style={{width:node.width,height:node.height,objectFit:node.fit}}/></span>;
  if(node.type==="block")return <span key={i} className={"lesson-block lesson-"+node.kind}>{children}</span>;
  if(node.type==="table")return <span key={i} className="lesson-table-scroll"><span role="table" className="lesson-table">{node.rows.map((row,r)=><span role="row" key={r}>{row.map((cell,c)=><span role="cell" key={c} className={"lesson-cell-"+(node.align[c]||"l")}><RenderNodes nodes={cell} renderBlank={renderBlank}/></span>)}</span>)}</span></span>;
  if(node.type==="list")return <span role="list" key={i} className="lesson-list">{node.items.map((item,j)=><span role="listitem" key={j}><span aria-hidden="true">{node.ordered?(j+1)+".":"•"} </span><RenderNodes nodes={item} renderBlank={renderBlank}/></span>)}</span>;
  if(node.kind==="textbf")return <strong key={i}>{children}</strong>;
  if(node.kind==="textit")return <em key={i}>{children}</em>;
  if(node.kind==="underline")return <u key={i}>{children}</u>;
  if(node.kind==="texttt")return <code key={i}>{children}</code>;
  if(node.kind==="section"||node.kind==="subsection")return <span key={i} role="heading" aria-level={node.kind==="section"?2:3} className={"lesson-"+node.kind}>{children}</span>;
  return <span key={i} style={TEXT_COLORS[node.color]?{color:TEXT_COLORS[node.color]}:undefined}>{children}</span>;
 });
}
export function PracticeRichText({children,renderBlank}) {
 const nodes=useMemo(()=>parseMarkup(children),[children]);
 return <RenderNodes nodes={nodes} renderBlank={renderBlank}/>;
}
