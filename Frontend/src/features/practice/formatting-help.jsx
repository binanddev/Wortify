import {PracticeRichText} from "./practice-rich-text.jsx";
export const FORMAT_EXAMPLES = [
 ["Dialogue / new line", "Q: {{1}} wartest du? \\newline A: Auf den Bus nach Berlin."],
 ["Emphasis", "\\textbf{Important} · \\textit{example} · \\underline{key word} · \\textcolor{blue}{hint}"],
 ["Alignment", "\\begin{flushleft}Left aligned text and {{1}}\\end{flushleft}"],
 ["Table", "\\begin{tabular}{lc} \\textbf{Pronoun} & \\textbf{Verb} \\\\ ich & bin \\\\ du & bist \\end{tabular}"],
 ["Image", "\\includegraphics[width=320px,align=right,alt=Learning illustration]{https://example.com/image.jpg}"],
 ["List", "\\begin{enumerate}\\item Read the sentence.\\item Choose the correct word.\\end{enumerate}"],
 ["Heading / note", "\\section{Word order}\\begin{quote}The verb comes second.\\end{quote}"],
];
export function FormattingHelp() {
 return <details className="lesson-format-help"><summary>Formatting guide · line breaks, tables and images</summary>
 <p><a href="/samples/formatted-practice.txt" download>Download sample exercises</a> · <a href="/samples/formatted-theory.txt" download>Download sample theory</a></p>
 <p>Add COMMENT: before the first QUESTION for an exercise-wide note. Add EXPLANATION: after each QUESTION for its explanation (including matching pairs). Both support formatting and appear only after a correct answer or answer reveal. Use &gt; for continuation lines.</p>
 <p>A supported LaTeX-style subset, not a full TeX compiler. Existing Markdown bold and italic still work. No HTML, scripts, custom CSS or TeX packages are executed.</p>
 <p>Use these commands in instructions, context, question text and explanations. Keep answers, choices, word banks and editable error-correction text plain. In .txt drafts, start additional lines with &gt;. Actual new lines and \\ also create line breaks.</p>
 <p>Alignment: flushleft, center, flushright. Tables: l / c / r columns, &amp; between cells, \\ between rows. Blanks such as {"{{1}}"} can appear inside formatted text and tables.</p>
 <p>Images: use an uploaded file URL or an HTTPS URL. Width and height accept px or % (width: 1–1200px or 1–100%). Alignment: left, center, right. Optional height and fit=contain/cover. Omit height to preserve the image ratio. Remote images need a working URL; they are not embedded in text exports.</p>
 {FORMAT_EXAMPLES.map(([label,text])=><section key={label}><strong>{label}</strong><pre>{text}</pre>{label!=="Image"&&<div className="lesson-document"><PracticeRichText>{text}</PracticeRichText></div>}</section>)}
 </details>;
}
