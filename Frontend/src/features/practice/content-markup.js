
// A bounded display language; unknown commands remain literal, never executable.
export function safeImageSource(value) {
 const source=String(value||"").trim();
 if(/^https?:\/\//i.test(source)){try{const u=new URL(source);return u.username||u.password?null:u.href;}catch{return null;}}
 return /^\/(?!\/)[^\\\s]+$/.test(source)?source:null;
}
export function imageOptions(raw="") {
 const options=Object.fromEntries(raw.split(",").map(part=>{const i=part.indexOf("=");return i<0?[part.trim(),""]:[part.slice(0,i).trim(),part.slice(i+1).trim()];}));
 const size=value=>{const m=/^(\d+(?:\.\d+)?)(px|%)$/.exec(value||"");return m?String(Math.max(1,Math.min(Number(m[1]),m[2]==="%"?100:1200)))+m[2]:undefined;};
 return {width:size(options.width)||"100%",height:size(options.height),align:["left","center","right"].includes(options.align)?options.align:"center",fit:options.fit==="cover"?"cover":"contain",alt:(options.alt||"Learning illustration").slice(0,300)};
}
function group(text,start) {
 if(text[start]!=="{")return null;
 let level=1;
 for(let i=start+1;i<text.length;i++){
  if(text[i]==="{")level++;
  if(text[i]==="}")level--;
  if(!level)return {body:text.slice(start+1,i),end:i+1};
 }
 return null;
}
export function parseMarkup(value,depth=0) {
 const text=String(value??"").replace(/\r\n?/g,"\n");
 if(depth>=12)return [{type:"text",text}];
 const nodes=[];let plain="";
 const flush=()=>{if(plain){nodes.push({type:"text",text:plain});plain="";}};
 const add=node=>{flush();nodes.push(node);};
 for(let i=0;i<text.length;){
  const rest=text.slice(i);let match;
  if((match=/^\{\{(\d+)\}\}/.exec(rest))){add({type:"blank",index:Number(match[1])-1});i+=match[0].length;continue;}
  if((match=/^(\\\\|\\newline\b|\\par\b)/.exec(rest))){add({type:"break"});i+=match[0].length;continue;}
  if(text[i]==="\n"){add({type:"break"});i++;continue;}
  if((match=/^\\begin\{(center|flushleft|flushright|quote|itemize|enumerate|tabular)\}/.exec(rest))){
   const name=match[1],endToken="\\end{"+name+"}";
   let start=i+match[0].length,spec="";
   if(name==="tabular"){const g=group(text,start);if(g){spec=g.body;start=g.end;}}
   const end=text.indexOf(endToken,start);
   if(end>=0){
    const body=text.slice(start,end);
    if(name==="tabular"){
     add({type:"table",align:spec.replace(/[^lcr]/g,"").split(""),rows:body.replace(/\\hline\b/g,"").split(/\\\\/).filter(row=>row.trim()).slice(0,100).map(row=>row.split("&").slice(0,20).map(cell=>parseMarkup(cell.trim(),depth+1)))});
    }else if(name==="itemize"||name==="enumerate"){
     add({type:"list",ordered:name==="enumerate",items:body.split(/\\item\b/).filter(x=>x.trim()).slice(0,100).map(x=>parseMarkup(x.trim(),depth+1))});
    }else add({type:"block",kind:name,children:parseMarkup(body.trim(),depth+1)});
    i=end+endToken.length;continue;
   }
  }
  if((match=/^\\includegraphics(?:\[([^\]]*)\])?/.exec(rest))){
   const g=group(text,i+match[0].length);
   if(g){const src=safeImageSource(g.body);add(src?{type:"image",src,...imageOptions(match[1])}:{type:"text",text:text.slice(i,g.end)});i=g.end;continue;}
  }
  if((match=/^\\(textbf|textit|underline|texttt|section|subsection|textcolor)/.exec(rest))){
   const g=group(text,i+match[0].length);
   if(g){const content=match[1]==="textcolor"?group(text,g.end):g;
    if(content){add({type:"format",kind:match[1],color:match[1]==="textcolor"?g.body:undefined,children:parseMarkup(content.body,depth+1)});i=content.end;continue;}
   }
  }
  if((match=/^!\[([^\]]*)\]\(([^\s)]+)\)/.exec(rest))){
   const src=safeImageSource(match[2]);if(src){add({type:"image",src,...imageOptions(),alt:match[1]});i+=match[0].length;continue;}
  }
  if((i===0||text[i-1]==="\n")&&(match=/^(#{1,6}) (.+)/.exec(rest))){
   add({type:"format",kind:match[1].length===1?"section":"subsection",children:parseMarkup(match[2],depth+1)});i+=match[0].length;continue;
  }
  if((match=/^\*\*([^*]+)\*\*|^\*([^*]+)\*|^\[color=([a-z]+)\]([\s\S]*?)\[\/color\]/.exec(rest))){
   add({type:"format",kind:match[1]?"textbf":match[2]?"textit":"textcolor",color:match[3],children:parseMarkup(match[1]??match[2]??match[4],depth+1)});i+=match[0].length;continue;
  }
  plain+=text[i++];
 }
 flush();return nodes;
}
