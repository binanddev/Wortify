import { useState } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { request, useAction, useResource } from "../../lib/core.js";
import { Btn, Field, Status, Loading } from "../../components/ui/ui.jsx";
import { PracticeModal } from "./practice-workspace.jsx";

export function AnswerProposal({ nodeId, lang, question, answer = "", revision }) {
  useLocale();
  const [open, setOpen] = useState(false), [value, setValue] = useState(""), [reason, setReason] = useState(""), [sent, setSent] = useState(false);
  const action = useAction();
  if (!nodeId || !revision || !question || question.blanks?.length) return null;
  return <>
    <Btn onClick={() => { setValue(typeof answer === "string" ? answer : ""); setReason(""); setSent(false); action.setError(""); setOpen(true); }}>{tr("Suggest another answer")}</Btn>
    {open && <PracticeModal title={tr("Suggest another answer")} pending={action.pending} onClose={() => setOpen(false)}>
      {sent ? <><p role="status">{tr("Suggestion sent for review. Your score and accepted answers have not changed.")}</p><Btn onClick={() => setOpen(false)}>{tr("Close")}</Btn></> : <form onSubmit={event => { event.preventDefault(); action.run(async signal => {
        await request(`/api/${lang}/practice-hub/feedback/${nodeId}/`, "POST", { question_id: String(question.id), revision, answer: value, reason }, signal);
        setSent(true);
      }); }}>
        <p>{question.prompt}</p>
        <Field label={tr("Proposed answer")} value={value} onChange={setValue} maxLength={2000} isRequired />
        <Field label={tr("Why should this answer be accepted? (optional)")} value={reason} onChange={setReason} maxLength={2000} multiline />
        <p>{tr("The content owner will review your suggestion before changing the answer key.")}</p>
        <Status error={action.error} />
        <Btn type="submit" primary isLoading={action.pending}>{tr("Send suggestion")}</Btn>
      </form>}
    </PracticeModal>}
  </>;
}

export function AnswerProposalReview({ nodeId, lang, onChanged }) {
  useLocale();
  const [open, setOpen] = useState(false);
  return <><Btn onClick={() => setOpen(true)}>{tr("Review answer suggestions")}</Btn>{open && <ReviewDialog nodeId={nodeId} lang={lang} onChanged={onChanged} onClose={() => setOpen(false)} />}</>;
}

function ReviewDialog({ nodeId, lang, onChanged, onClose }) {
  useLocale();
  const url = `/api/${lang}/practice-hub/feedback/${nodeId}/`;
  const resource = useResource(url, true), action = useAction();
  return <PracticeModal title={tr("Review answer suggestions")} pending={action.pending} onClose={onClose}>
    <Status error={action.error} />
    <Loading resource={resource}>{data => !data.can_review ? <p>{tr("Only the content owner can review these suggestions.")}</p> : <>
      {!data.proposals.length && <p>{tr("No answer suggestions yet.")}</p>}
      {data.proposals.map(proposal => <article key={proposal.id} className="profile-panel">
        <p><strong>{proposal.question_prompt}</strong></p>
        <p>{proposal.answer}</p>{proposal.reason && <p>{proposal.reason}</p>}
        <p>{tr(proposal.status === "pending" ? "Pending review" : proposal.status === "approved" ? "Approved" : "Rejected")}</p>
        {proposal.status === "pending" && <>
          {proposal.revision !== data.revision && <p>{tr("The exercise changed. Review this suggestion manually; approval is unavailable.")}</p>}
          <div className="flex gap-3"><Btn isDisabled={action.pending || proposal.revision !== data.revision} onClick={() => action.run(async signal => {
            await request(`${url}${proposal.id}/`, "POST", { decision: "approve", revision: data.revision }, signal);
            resource.reload(); onChanged?.();
          })}>{tr("Approve and add answer")}</Btn><Btn isDisabled={action.pending} onClick={() => action.run(async signal => {
            await request(`${url}${proposal.id}/`, "POST", { decision: "reject", revision: data.revision }, signal);
            resource.reload();
          })}>{tr("Reject suggestion")}</Btn></div>
        </>}
      </article>)}
    </>}</Loading>
  </PracticeModal>;
}
