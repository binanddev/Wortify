import { useState } from "react";
import { Btn, Field, Status } from "../../components/ui/ui.jsx";
import { useAction } from "../../lib/core.js";
import { PracticeModal } from "../practice/practice-workspace.jsx";
export const roleName = (u) =>
  u.is_superuser ? "Admin" : u.is_staff ? "Staff" : "Users";
export const dateText = (value) =>
  value ? new Date(value).toLocaleString("en-GB") : "Not signed in";
export function Pagination({ page, total, size = 25, onChange }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-(--muted)">
        {total} results · Page {page}/{Math.max(1, Math.ceil(total / size))}
      </span>
      <div className="flex gap-2">
        <Btn isDisabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Btn>
        <Btn
          isDisabled={page * size >= total}
          onClick={() => onChange(page + 1)}
        >
          Sau
        </Btn>
      </div>
    </div>
  );
}
export function ActionDialog({
  title,
  description,
  confirmText,
  label = "Confirm",
  onConfirm,
  onClose,
  reasonRequired = true,
  children,
}) {
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const action = useAction();
  return (
    <PracticeModal
      title={title}
      onClose={onClose}
      pending={action.pending}
      size="md"
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(async (signal) => {
            await onConfirm({ confirm, reason }, signal);
            onClose();
          });
        }}
      >
        <p>{description}</p>
        {children}
        {confirmText && (
          <Field
            label={`Enter “${confirmText}” to confirm`}
            value={confirm}
            onChange={setConfirm}
            autoComplete="off"
            isRequired
          />
        )}
        {reasonRequired && (
          <Field
            label="Reason for action"
            value={reason}
            onChange={setReason}
            multiline
            maxLength={500}
            minLength={3}
            isRequired
          />
        )}
        <Status error={action.error} />
        <div className="flex justify-end gap-2">
          <Btn isDisabled={action.pending} onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            primary
            type="submit"
            isLoading={action.pending}
            isDisabled={
              Boolean(confirmText && confirm !== confirmText) ||
              (reasonRequired && reason.trim().length < 3)
            }
          >
            {label}
          </Btn>
        </div>
      </form>
    </PracticeModal>
  );
}
