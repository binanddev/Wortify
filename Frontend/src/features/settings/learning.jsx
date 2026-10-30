import { useAvailability, themeEnabled, MAINTENANCE_MESSAGE } from "../feature-availability.jsx";
import RefreshApp from "./refresh-app.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
import LanguageSettings from "../../i18n/LanguageSettings.jsx";
import BackupSettings from "./BackupSettings.jsx";
import { INTERFACE_CHOICES } from "../../themes/registry.js";
import { AMBIENT_TRACKS } from "../audio/ambient-recordings.js";
import BackgroundLibrary from "../appearance/background-library.jsx";
import { useLearningSync, pendingLearning } from "../learning/learning-sync.js";
import Appearance from "../admin/Appearance.jsx";
import { useState } from "react";
import { endpoint, request, useResource, useAction } from "../../lib/core.js";
import {
  SidebarTools,
  Btn,
  Glass,
  Page,
  Heading,
  Status,
  Loading,
  Field,
  Select,
} from "../../components/ui/ui.jsx";
export function Settings({
  lang,
  prefs,
  setPrefs,
  superuser,
  userId,
  staff,
  appearance,
}) {
  useLocale();
  const resource = useResource(endpoint(lang, "settings/"));
  return (
    <Loading resource={resource}>
      {(data) => (
        <SettingsContent
          {...{
            lang,
            prefs,
            setPrefs,
            data,
            superuser,
            userId,
            staff,
            appearance,
          }}
        />
      )}
    </Loading>
  );
}

function SettingsContent({
  lang,
  prefs,
  setPrefs,
  data,
  superuser,
  userId,
  staff,
  appearance,
}) {
  useLocale();
  const availability = useAvailability();
  const [tab, setTab] = useState("appearance");
  const tabs = [
    ["appearance", "Appearance"],
    ["background", "Backgrounds"],
    ["sound", "Audio"],
    ["study", "Learning"],
    ["backup", "Backup & restore"],
    ...(superuser ? [["system", "System"]] : []),
  ];
  const sync = useLearningSync(userId, lang);
  const [values, setValues] = useState(() => ({
    ...data,
    ...pendingLearning(userId, lang)
      .filter((e) => e.kind === "study_settings")
      .at(-1)?.payload,
  }));
  const change = (patch) => {
    const next = { ...values, ...patch };
    setValues(next);
    sync.enqueue("study_settings", next);
  };
  return (
    <Page>
      <Heading
        eyebrow={tr("YOUR WAY")}
        title={tr("Settings")}
        description={tr("A comfortable space to see, hear and learn.")}
      />
      <LanguageSettings />
      <RefreshApp />
      <SidebarTools navOnly>
        <div
          role="tablist"
          aria-label={tr("Settings group")}
          className="settings-tabs settings-nav"
          aria-orientation="vertical"
        >
          {tabs.map(([id, label], index) => (
            <button
              key={id}
              id={`settings-tab-${id}`}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`settings-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(event) => {
                const offset = ["ArrowRight", "ArrowDown"].includes(event.key)
                  ? 1
                  : ["ArrowLeft", "ArrowUp"].includes(event.key)
                    ? -1
                    : 0;
                if (offset || ["Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  const target =
                    tabs[
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : (index + offset + tabs.length) % tabs.length
                    ][0];
                  setTab(target);
                  document.getElementById(`settings-tab-${target}`)?.focus();
                }
              }}
            >
              {tr(label)}
            </button>
          ))}
        </div>
      </SidebarTools>
      <div
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
      >
        {tab === "backup" && <BackupSettings userId={userId} />}
        {tab === "background" && (
          <Glass>
            <h2>{tr("Backgrounds")}</h2>
            <BackgroundLibrary
              key={prefs.interface}
              interfaceName={prefs.interface}
            />
            <Status error={appearance?.warning} />
          </Glass>
        )}
        {tab === "appearance" && (
          <>
            {(!staff || superuser) && (
              <section
                className="interface-picker"
                aria-label={tr("Choose appearance")}
              >
                {INTERFACE_CHOICES.map(([id, name, description]) => (
                  <button
                    key={id}
                    type="button"
                    className={`interface-option interface-option-${id}`}
                    aria-pressed={prefs.interface === id}
                    aria-disabled={!themeEnabled(availability, id)}
                    onClick={() => setPrefs({ ...prefs, interface: id })}
                  >
                    <span className="interface-sample" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <strong>
                      {tr(name)}
                      {prefs.interface === id ? tr(" · In use") : ""}
                    </strong>
                    <span>{themeEnabled(availability, id) ? tr(description) : tr(MAINTENANCE_MESSAGE)}</span>
                  </button>
                ))}
              </section>
            )}
            <Glass>
              <h2>{tr("Appearance")}</h2>
              <Status error={appearance?.warning} />
              {prefs.interface !== "glass" && (
                <>
                  <div className="flex items-center gap-3">
                    <Field
                      label={tr("Text color")}
                      type="color"
                      value={
                        prefs.textColor === "auto"
                          ? prefs.interface === "studio"
                            ? "#24304e"
                            : prefs.background === "night"
                              ? "#f0f5ff"
                              : "#152740"
                          : prefs.textColor
                      }
                      onChange={(textColor) =>
                        setPrefs({ ...prefs, textColor })
                      }
                    />
                    <Btn
                      aria-pressed={prefs.textColor === "auto"}
                      onClick={() =>
                        setPrefs({
                          ...prefs,
                          textColor: "auto",
                          textWeight: 500,
                          textContrast: 80,
                        })
                      }
                    >
                      {tr("Auto · Automatic contrast")}
                    </Btn>
                  </div>
                  <label className="range-label">
                    {tr("Text weight ")}
                    <strong>{prefs.textWeight}</strong>
                    <input
                      type="range"
                      min="400"
                      max="700"
                      step="50"
                      value={prefs.textWeight}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          textWeight: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="range-label">
                    {tr("Text contrast ")}
                    <strong>{prefs.textContrast}%</strong>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={prefs.textContrast}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          textContrast: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="range-label">
                    {tr("Navigation width")} <strong>{prefs.navScale}%</strong>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      step="5"
                      value={prefs.navScale}
                      onChange={(e) =>
                        setPrefs({ ...prefs, navScale: Number(e.target.value) })
                      }
                    />
                  </label>
                  <Btn onClick={() => setPrefs({ ...prefs, navScale: 70 })}>
                    {tr("Reset navigation size")}
                  </Btn>
                  <label className="range-label">
                    {tr("Interface text size ")}
                    <strong>{prefs.textSize}px</strong>
                    <input
                      type="range"
                      min="16"
                      max="22"
                      value={prefs.textSize}
                      onChange={(e) =>
                        setPrefs({ ...prefs, textSize: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="range-label">
                    {tr("Card text size ")}
                    <strong>{prefs.font}px</strong>
                    <input
                      type="range"
                      min="24"
                      max="60"
                      step="2"
                      value={prefs.font}
                      onChange={(e) =>
                        setPrefs({ ...prefs, font: Number(e.target.value) })
                      }
                    />
                  </label>
                  <p className="font-preview" style={{ fontSize: prefs.font }}>
                    Aa
                  </p>
                </>
              )}
              {prefs.interface === "glass" && (
                <>
                  {" "}
                  <label className="range-label">
                    {tr("Glass transparency")}{" "}
                    <strong>{prefs.transparency}%</strong>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      disabled={prefs.interface !== "glass"}
                      value={prefs.transparency}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          transparency: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </>
              )}{" "}
            </Glass>
          </>
        )}
        {tab === "sound" && (
          <Glass>
            <h2>{tr("Audio")}</h2>
            <label className="check-line">
              <input
                type="checkbox"
                checked={prefs.sound}
                onChange={(e) =>
                  setPrefs({ ...prefs, sound: e.target.checked })
                }
              />
              {tr("Soft interaction sounds")}
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={prefs.ambient}
                onChange={(e) =>
                  setPrefs({ ...prefs, ambient: e.target.checked })
                }
              />
              {tr("Gentle background audio")}
            </label>
            <Select
              label={tr("Background melody")}
              value={prefs.ambientTrack}
              onChange={(ambientTrack) => setPrefs({ ...prefs, ambientTrack })}
            >
              {AMBIENT_TRACKS.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name} — {track.description}
                </option>
              ))}
            </Select>
            <p className="text-sm text-(--muted)">
              {tr(
                "Choose from 20 tracks in the Wortify library. Enable background audio and click the page if playback is blocked. Audio pauses during listening exercises and when switching browser tabs.",
              )}
            </p>
            <label className="range-label">
              {tr("Volume ")}
              <strong>{Math.round(prefs.volume * 100)}%</strong>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={prefs.volume}
                onChange={(e) =>
                  setPrefs({ ...prefs, volume: Number(e.target.value) })
                }
              />
            </label>
          </Glass>
        )}
        {tab === "study" && (
          <Glass>
            <h2>{tr("Study preferences")}</h2>
            <fieldset className="grid gap-3 my-4">
              <legend>{tr("Exercise typography")}</legend>
              <label>
                {tr("Text size · ")}
                {prefs.exerciseTextSize || 22}px
                <input
                  aria-label={tr("Exercise text size")}
                  type="range"
                  min="16"
                  max="36"
                  step="1"
                  value={prefs.exerciseTextSize || 22}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      exerciseTextSize: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                {tr("Text weight · ")}
                {prefs.exerciseTextWeight || 500}
                <input
                  aria-label={tr("Exercise text weight")}
                  type="range"
                  min="400"
                  max="700"
                  step="100"
                  value={prefs.exerciseTextWeight || 500}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      exerciseTextWeight: Number(e.target.value),
                    })
                  }
                />
              </label>
              <p className="exercise-type-preview">
                {tr("Choose the answer that completes the sentence.")}
              </p>
              <Btn
                onClick={() =>
                  setPrefs({
                    ...prefs,
                    exerciseTextSize: 22,
                    exerciseTextWeight: 500,
                  })
                }
              >
                {tr("Reset exercise typography")}
              </Btn>
              <p className="text-sm">
                {tr(
                  "Applies to exercise content across themes. Navigation and buttons keep their own size.",
                )}
              </p>
            </fieldset>
            <div>
              {Object.entries({
                autoplay: "Read words aloud automatically",
                ignore_case: "Ignore letter case",
                ignore_punctuation: "Ignore punctuation",
                ...(lang === "de"
                  ? { transliteration: "Accept ae / oe / ue / ss" }
                  : {}),
              }).map(([key, label]) => (
                <label className="check-line" key={key}>
                  <input
                    type="checkbox"
                    checked={values[key]}
                    onChange={(e) => {
                      change({ [key]: e.target.checked });
                    }}
                  />
                  {tr(label)}
                </label>
              ))}
              <Field
                label={tr("New cards per day")}
                type="number"
                min="0"
                max="200"
                value={values.new_cards_per_day}
                onChange={(v) => {
                  change({
                    new_cards_per_day: Math.max(
                      0,
                      Math.min(200, Number(v) || 0),
                    ),
                  });
                }}
              />
              <Field
                label={tr("Session duration (minutes)")}
                type="number"
                min="1"
                max="120"
                value={values.session_minutes}
                onChange={(v) => {
                  change({
                    session_minutes: Math.max(1, Math.min(120, Number(v) || 1)),
                  });
                }}
              />
              <Status error={sync.error} />
            </div>
          </Glass>
        )}
        {superuser && tab === "system" && (
          <Appearance
            backgroundUrl={appearance?.data?.[lang]?.background_url}
          />
        )}
      </div>
    </Page>
  );
}
