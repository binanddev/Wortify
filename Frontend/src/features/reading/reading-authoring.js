import {textTemplate, READING_TEXT_RULES} from "../practice/practice-text.js";
export const guide = `READING IMPORT — UTF-8 .txt
Create original reading lessons in the requested language and level. Return only importable text.
Start each lesson with EXERCISE: title, then TYPE: reading and STYLE: split_reading.
Use INSTRUCTIONS: before the passage and all QUESTION fields. Put metadata before questions.
Continue multiline text with > at the beginning of each continuation line. Separate lessons with another EXERCISE.
${READING_TEXT_RULES}
Use 1–100 questions per passage, 1–100 lessons per import, maximum 2 MB per import.
Use exact option text in ANSWER, not letters or indexes. Options are shuffled for learners.
Do not use | inside an option. Each question needs 2–12 unique options.
Images must be real URLs supplied by the author; do not invent image URLs. Images are not required.

COMPLETE EXAMPLE
${textTemplate("reading")}`;

// Conservative identities: ambiguous duplicate drafts require explicit media reassignment.
export function matchReadingDrafts(next, previous) {
  const signature=node=>JSON.stringify({...node.payload,title:undefined,attachments:undefined});
  const matched=Array(next.length).fill(-1),used=new Set();
  for(const identify of [signature,node=>JSON.stringify([node.title,signature(node)]),node=>node.title]) {
    const before=new Map(),after=new Map();
    previous.forEach((node,index)=>{const value=identify(node);before.set(value,[...(before.get(value)||[]),index]);});
    next.forEach((node,index)=>{const value=identify(node);after.set(value,[...(after.get(value)||[]),index]);});
    for(const [value,indices] of after)if(indices.length===1&&before.get(value)?.length===1){const index=indices[0],prior=before.get(value)[0];if(matched[index]<0&&!used.has(prior)){matched[index]=prior;used.add(prior);}}
  }
  if(next.length===1&&previous.length===1)matched[0]=0;
  return matched;
}
