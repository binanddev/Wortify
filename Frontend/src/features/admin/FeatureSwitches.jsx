import { t as tr, useLocale } from "../../i18n/index.js";
import { request, useResource, useAction } from "../../lib/core.js";
import { Glass, Loading, Status } from "../../components/ui/ui.jsx";
import { INTERFACE_CHOICES } from "../../themes/registry.js";
import { updateAvailability } from "../feature-availability.jsx";
export default function FeatureSwitches() {
  useLocale();
  const resource = useResource("/api/manage/features/");
  const action = useAction();
  const save = patch => action.run(async () => {
    const data = await request("/api/manage/features/", "PATCH", patch);
    updateAvailability(data); resource.reload();
  });
  return <Glass><h2>{tr("Feature availability")}</h2>
    <p>{tr("Disabled features show a maintenance message. Data is preserved. Studio is always enabled.")}</p>
    <Status error={action.error} />
    <Loading resource={resource}>{data => <div>
      {INTERFACE_CHOICES.map(([id, name]) => <label key={id} style={{display:"block",padding:"8px"}}>
        <input type="checkbox" checked={data.themes[id]} disabled={id === "studio" || action.pending} onChange={e => save({themes:{[id]:e.target.checked}})} /> {name}
      </label>)}
      <label style={{display:"block",padding:"8px"}}><input type="checkbox" checked={data.classes} disabled={action.pending} onChange={e => save({classes:e.target.checked})} /> {tr("Classes")}</label>
    </div>}</Loading>
  </Glass>;
}
