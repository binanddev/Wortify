import { useResource } from "../../lib/core.js";
import { Select } from "./ui.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
export default function VisibilitySelect({
  value,
  onChange,
  disabled,
  ...props
}) {
  useLocale();
  const policy = useResource("/api/site/content-policy/");
  const publicOnly = policy.data?.mode === "public";
  return (
    <Select
      {...props}
      label={tr("Visibility")}
      value={publicOnly ? "public" : value}
      onChange={onChange}
      disabled={disabled || policy.loading || !!policy.error || publicOnly}
    >
      {!publicOnly && <option value="private">{tr("Private")}</option>}
      <option value="public">{tr("Public")}</option>
    </Select>
  );
}
