import {PracticeRichText} from "./practice-rich-text.jsx";
export function TheoryActivity({ payload }) {
  if(payload.format !== "html") return <article className="lesson-document"><PracticeRichText>{payload.content || ""}</PracticeRichText></article>;
  const content = String(payload.content || "");
  return (
    <iframe
      className="hub-theory"
      sandbox=""
      title="Theory content"
      srcDoc={`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:19px/1.8 system-ui;margin:24px;color:#17253d;background:#f6f9fd}img,video{max-width:100%}pre{white-space:pre-wrap}a{color:#1854cf}</style>${content}`}
    />
  );
}
