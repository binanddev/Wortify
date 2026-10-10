export function visibleExerciseComments({exercise,questions,mode,answers={},correct=false,revealed=false}) {
 const items=[];
 if((correct||revealed)&&exercise.presentation?.comment?.trim())items.push({id:"exercise",label:"Exercise note",text:exercise.presentation.comment});
 questions.forEach((q,index)=>{
  const visible=correct||revealed||(mode==="matching"&&Boolean(answers[q.id]));
  if(visible&&q.presentation?.explanation?.trim())items.push({id:String(q.id),label:mode==="matching"?"Pair "+(index+1):questions.length>1?"Question "+(index+1):"Explanation",text:q.presentation.explanation});
 });
 return items;
}
