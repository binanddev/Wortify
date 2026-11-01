import { useEffect, useState } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { request, useAction } from "../../lib/core.js";
import { Btn, Icon, Glass, Field, Status, Link } from "../../components/ui/ui.jsx";

export default function Login({
  onLogin,
  setupKey,
  initialRegister = false,
  compact = false,
}) {
  useLocale();
  const [register, setRegister] = useState(
      Boolean(setupKey || initialRegister),
    ),
    [values, setValues] = useState({
      username: "",
      password: "",
      password1: "",
      password2: "",
    }),
    action = useAction();
  const [authenticated, setAuthenticated] = useState(null);
  const [setupState, setSetupState] = useState(setupKey ? "loading" : "ready");
  const [setupError, setSetupError] = useState("");
  const authEndpoint = setupKey
    ? `/api/superuser-registration/${encodeURIComponent(setupKey)}/`
    : "/api/session/";
  useEffect(() => {
    if (!setupKey) return;
    const controller = new AbortController();
    request(authEndpoint, "GET", undefined, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setSetupState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSetupState("error");
        setSetupError(error.message);
      });
    return () => controller.abort();
  }, [setupKey, authEndpoint]);
  return (
    <div className={compact ? "auth-layout min-h-0! p-0!" : "auth-layout"}>
      <Glass className="auth-card">
        <span className="eyebrow">WORTIFY</span>
        <h2>
          {setupKey
            ? tr("Create admin account")
            : register
              ? tr("Create account")
              : tr("Sign in")}
        </h2>
        {setupState === "loading" && <p>{tr("Checking paths…")}</p>}
        <Status error={setupError} />
        {setupState === "ready" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async (s) => {
                if (authenticated) {
                  await onLogin(authenticated);
                  return;
                }
                const d = await request(
                  authEndpoint,
                  "POST",
                  register
                    ? {
                        register: true,
                        username: values.username,
                        password1: values.password1,
                        password2: values.password2,
                      }
                    : { username: values.username, password: values.password },
                  s,
                );
                setAuthenticated(d.user);
                await onLogin(d.user);
              });
            }}
          >
            <Field
              label={tr("Username")}
              value={values.username}
              onChange={(v) => setValues({ ...values, username: v })}
              autoComplete="username"
              isRequired
            />
            {(register ? ["password1", "password2"] : ["password"]).map(
              (key, i) => (
                <Field
                  key={key}
                  label={i ? tr("Confirm password") : tr("Password")}
                  type="password"
                  value={values[key]}
                  onChange={(v) => setValues({ ...values, [key]: v })}
                  autoComplete={register ? "new-password" : "current-password"}
                  isRequired
                />
              ),
            )}
            <Status error={action.error} />
            <Btn
              primary
              type="submit"
              className="btn primary full"
              isLoading={action.pending}
            >
              {authenticated
                ? tr("Retry")
                : register
                  ? tr("Create account")
                  : tr("Sign in")}
              <Icon name="arrow" />
            </Btn>
          </form>
        )}
        {!setupKey && !authenticated && (
          <div className="auth-switch">
            {register ? tr("Already have an account?") : tr("No account yet?")}
            <Btn
              onClick={() => {
                setRegister(!register);
                action.setError("");
              }}
            >
              {register ? tr("Sign in") : tr("Create account")}
            </Btn>
          </div>
        )}
        {setupKey && <Link to="/">{tr("Back to main page")}</Link>}
      </Glass>
    </div>
  );
}
