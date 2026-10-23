import { staffWorkspace } from "../../lib/staff-workspace.js";
import { useResource } from "../../lib/core.js";
import { Select } from "./ui.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
export default function VisibilitySelect({
  value,
  onChange,
  disabled,
  isNew = false,
  ...props
}) {
  useLocale();
  const policy = useResource("/api/site/content-policy/");
  const scope = staffWorkspace();
  const publicOnly = scope === "shared" || (!scope && (
    policy.data?.mode === "public" ||
    (isNew && policy.data?.mode === "new_public")));
  return (
    <Select
      {...props}
      label={tr("Visibility")}
      value={scope === "personal" ? "private" : publicOnly ? "public" : value}
      onChange={onChange}
      disabled={disabled || policy.loading || !!policy.error || publicOnly || scope === "personal"}
    >
      {!publicOnly && <option value="private">{tr("Private")}</option>}
      {scope !== "personal" && <option value="public">{tr("Public")}</option>}
    </Select>
  );
}
