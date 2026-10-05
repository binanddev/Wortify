export const SKIPPED_ANSWER = "__wortify_skipped__";
export function normalize(value, options = {}, card = false) {
  let text = String(value ?? "").normalize("NFC").trim();
  if (options.ignore_case !== false) text = text.toLowerCase();
  if (options.ignore_punctuation !== false) text = text.replace(/\p{P}/gu, card ? " " : "");
  if (options.transliteration) text = text.replace(/[äöüßÄÖÜ]/g, c => ({ä:"ae",ö:"oe",ü:"ue",ß:"ss",Ä:"Ae",Ö:"Oe",Ü:"Ue"}[c]));
  return text.replace(/\s+/gu, " ").trim();
}
export function gradeCard(q, answer) {
  if (answer === SKIPPED_ANSWER) return {is_correct:false, skipped:true, target:q.target, card:q.card, card_id:q.card?.id, answer};
  const correct = q.mode === "flash" ? answer === "remember" : q.mode === "quiz" ? answer === q.meaning : [q.target, ...(q.alternatives || [])].some(v => normalize(v, q.grading, true) === normalize(answer, q.grading, true));
  return {is_correct:correct, target:q.target, card:q.card, answer, card_id:q.card?.id};
}
export function gradeExercise(exercise, questions, submitted) {
  const answers = questions.filter(q => !q.example).flatMap(q => {
    const kind = q.kind || exercise.kind;
    const auto = true;
    const descriptors = q.blanks?.length ? q.blanks.map((b,i) => [`${q.id}_${i}`,b.answers,`Ô ${i+1}`]) : [[String(q.id), q.accepted_answers || [], ""]];
    return descriptors.map(([key, expected, label]) => {
      let value = submitted[key] ?? "", shown = Array.isArray(value) ? value.join(", ") : value;
      let correct;
      if (kind === "order" && !q.blanks?.length) {
        correct = JSON.stringify(value) === JSON.stringify(expected);
        const tokens = Object.fromEntries((q.presentation?.tokens || []).map(t => [t.id,t.text]));
        shown = (Array.isArray(value) ? value : []).map(v => tokens[v]).join(" ");
        expected = [expected.map(v => tokens[v]).join(" ")];
      } else if (["multi","wordset"].includes(kind) && !q.blanks?.length) {
        const values = Array.isArray(value) ? value : value.split(/[,;\n]/).map(v => v.trim()).filter(Boolean);
        const a = new Set(values.map(v => normalize(v,exercise))), b = new Set(expected.map(v => normalize(v,exercise)));
        correct = values.length === expected.length && a.size === b.size && [...a].every(v => b.has(v));
      } else correct = expected.some(v => normalize(v,exercise) === normalize(value,exercise));
      if (exercise.presentation?.interaction === "inline_error_identification") {
        const names = Object.fromEntries((q.presentation?.tokens || []).map(t => [t.id,t.text]));
        expected = expected.map(v => names[v] ?? v);
        shown = (Array.isArray(value) ? value : [value]).map(v => names[v] ?? v).join(", ");
      }
      return {key, prompt:q.prompt, question_position:q.position, label, answer:shown, expected:expected, correct:auto ? correct : null, explanation:q.presentation?.explanation || ""};
    });
  });
  return {answers, score:answers.filter(r => r.correct).length, total:answers.length, local:true};
}
