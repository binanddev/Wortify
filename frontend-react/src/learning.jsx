import PersonalBackground from "./personal-background";
import { useLearningSync, pendingLearning } from "./learning-sync";
import Appearance from "./admin/Appearance";
import { useState } from "react";
import { endpoint, request, useResource, useAction } from "./core";
import {
  Btn,
  Glass,
  Page,
  Heading,
  Status,
  Loading,
  Field,
  Select,
} from "./ui";
export { Community } from "./community";
export function Settings({ lang, prefs, setPrefs, superuser, userId }) {
  const resource = useResource(endpoint(lang, "settings/"));
  return (
    <Loading resource={resource}>
      {(data) => (
        <SettingsContent
          {...{ lang, prefs, setPrefs, data, superuser, userId }}
        />
      )}
    </Loading>
  );
}

function SettingsContent({ lang, prefs, setPrefs, data, superuser, userId }) {
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
        eyebrow="THEO CÁCH CỦA BẠN"
        title="Cài đặt"
        description="Một không gian vừa mắt, vừa tai và vừa sức."
      />
      <div className="grid two">
        <Glass>
          <h2>Hiển thị & âm thanh</h2>
          <PersonalBackground />
          <div className="flex items-center gap-3">
            <Field
              label="Màu chữ"
              type="color"
              value={
                prefs.textColor === "auto"
                  ? prefs.background === "night"
                    ? "#f0f5ff"
                    : "#152740"
                  : prefs.textColor
              }
              onChange={(textColor) => setPrefs({ ...prefs, textColor })}
            />
            <Btn
              icon="undo"
              onClick={() =>
                setPrefs({
                  ...prefs,
                  textColor: "auto",
                  textWeight: 500,
                  textContrast: 80,
                })
              }
            >
              Khôi phục chữ mặc định
            </Btn>
          </div>
          <label className="range-label">
            Độ đậm chữ <strong>{prefs.textWeight}</strong>
            <input
              type="range"
              min="400"
              max="700"
              step="50"
              value={prefs.textWeight}
              onChange={(e) =>
                setPrefs({ ...prefs, textWeight: Number(e.target.value) })
              }
            />
          </label>
          <label className="range-label">
            Độ tương phản chữ <strong>{prefs.textContrast}%</strong>
            <input
              type="range"
              min="0"
              max="100"
              value={prefs.textContrast}
              onChange={(e) =>
                setPrefs({ ...prefs, textContrast: Number(e.target.value) })
              }
            />
          </label>
          <label className="range-label">
            Độ trong suốt của kính <strong>{prefs.transparency}%</strong>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={prefs.transparency}
              onChange={(e) =>
                setPrefs({ ...prefs, transparency: Number(e.target.value) })
              }
            />
          </label>
          <label className="range-label">
            Cỡ chữ giao diện <strong>{prefs.textSize}px</strong>
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
            Cỡ chữ thẻ <strong>{prefs.font}px</strong>
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
          <label className="check-line">
            <input
              type="checkbox"
              checked={prefs.sound}
              onChange={(e) => setPrefs({ ...prefs, sound: e.target.checked })}
            />
            Âm thanh tương tác nhẹ
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={prefs.ambient}
              onChange={(e) =>
                setPrefs({ ...prefs, ambient: e.target.checked })
              }
            />
            Âm thanh nền nhẹ
          </label>
          <label className="range-label">
            Âm lượng <strong>{Math.round(prefs.volume * 100)}%</strong>
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
          <Select
            label="Phông nền"
            value={prefs.background}
            onChange={(background) => setPrefs({ ...prefs, background })}
          >
            <option value="mist">Sương sớm</option>
            <option value="paper">Giấy sáng</option>
            <option value="night">Đêm yên tĩnh</option>
          </Select>
        </Glass>
        <Glass>
          <h2>Tùy chọn học tập</h2>
          <div>
            {Object.entries({
              autoplay: "Tự động đọc từ khi học",
              ignore_case: "Bỏ qua chữ hoa / thường",
              ignore_punctuation: "Bỏ qua dấu câu",
              ...(lang === "de"
                ? { transliteration: "Chấp nhận ae / oe / ue / ss" }
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
                {label}
              </label>
            ))}
            <Field
              label="Thẻ mới mỗi ngày"
              type="number"
              min="0"
              max="200"
              value={values.new_cards_per_day}
              onChange={(v) => {
                change({
                  new_cards_per_day: Math.max(0, Math.min(200, Number(v) || 0)),
                });
              }}
            />
            <Field
              label="Thời lượng buổi học (phút)"
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
      </div>
      {superuser && <Appearance />}
    </Page>
  );
}
