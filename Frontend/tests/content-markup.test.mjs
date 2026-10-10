import test from "node:test";
import assert from "node:assert/strict";
import {parseMarkup,safeImageSource,imageOptions} from "../src/features/practice/content-markup.js";
import {parsePracticeText,exerciseToText} from "../src/features/practice/practice-text.js";
test("newlines and nested emphasis preserve interactive blank indexes",()=>{
 const n=parseMarkup("Q: \\textbf{Choose {{1}}}\\newline A: Berlin.\nNext");
 assert.equal(n[1].kind,"textbf");
 assert.equal(n[1].children[1].index,0);
 assert.equal(n.filter(x=>x.type==="break").length,2);
});
test("tables and alignment retain blanks and column alignment",()=>{
 const n=parseMarkup("\\begin{flushleft}\\begin{tabular}{lc}Pronoun & Verb \\\\ ich & {{1}}\\end{tabular}\\end{flushleft}")[0];
 const t=n.children[0];assert.equal(n.kind,"flushleft");assert.deepEqual(t.align,["l","c"]);
 assert.equal(t.rows.length,2);assert.equal(t.rows[1][1][0].index,0);
});
test("image options are bounded and executable sources rejected",()=>{
 for(const src of ["javascript:alert(1)","data:image/svg+xml,<svg/>","//evil.test/a","/\\evil.test/a","file:///secret"])assert.equal(safeImageSource(src),null);
 assert.equal(safeImageSource("/api/media/1/"),"/api/media/1/");
 assert.equal(imageOptions("width=9999px,height=500%,align=evil,fit=cover").width,"1200px");
 assert.equal(imageOptions("width=expression(alert(1))").width,"100%");
 assert.equal(parseMarkup("\\includegraphics[width=45%,align=right]{https://example.com/a.png}")[0].align,"right");
});
test("unknown commands and HTML remain literal, formatting remains backwards compatible",()=>{
 assert.equal(parseMarkup("\\input{secret}")[0].text,"\\input{secret}");
 assert.equal(parseMarkup("<script>alert(1)</script>")[0].text,"<script>alert(1)</script>");
 assert.equal(parseMarkup("**bold**")[0].kind,"textbf");
 assert.equal(parseMarkup("[color=blue]*hello*[/color]")[0].children[0].kind,"textit");
 assert.doesNotThrow(()=>parseMarkup("\\textbf{".repeat(100)+"hello"+"}".repeat(100)));
});
test("lesson formatting round trips through exercise text import/export",()=>{
 const text="EXERCISE: Dialogue\nTYPE: inline_selection\nSTYLE: inline_select\nQUESTION: Q: {{1}} wartest du? \\newline A: Auf den Bus.\nBLANK: Worauf => Worauf | Womit";
 const result=parsePracticeText(text);
 const node=result.nodes?.[0]||result[0];
 assert.ok(node);
 const again=parsePracticeText(exerciseToText({...node.payload,title:node.title}));
 assert.equal(again.nodes[0].payload.questions[0].prompt,node.payload.questions[0].prompt);
});

test("downloadable formatted exercises validate and preserve both blanks",async()=>{
 const {readFile}=await import("node:fs/promises");
 const text=await readFile(new URL("../public/samples/formatted-practice.txt",import.meta.url),"utf8");
 const result=parsePracticeText(text);
 assert.equal(result.nodes.length,2);
 assert.equal(result.nodes[1].payload.questions[0].blanks.length,2);
});
