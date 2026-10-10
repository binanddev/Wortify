import history from "./history.md?raw";
import {PracticeRichText} from "../practice/practice-rich-text.jsx";
export default function History() {
 return <section><div className="admin-display-controls"><a href={"data:text/markdown;charset=utf-8,"+encodeURIComponent(history)} download="wortify-history.md">Download change log</a></div><article className="lesson-document"><PracticeRichText>{history}</PracticeRichText></article></section>;
}
