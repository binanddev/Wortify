const locales = { en: "en-US", de: "de-DE", vi: "vi-VN" };

export function cardUtterance(text, language) {
  const locale = locales[language] || language;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const normalize = tag => tag.replaceAll("_", "-").toLowerCase();
  const target = normalize(locale);
  const voice = voices.find(v => normalize(v.lang) === target)
    || voices.find(v => normalize(v.lang).split("-")[0] === target.split("-")[0]);
  if (voice) utterance.voice = voice;
  return utterance;
}
