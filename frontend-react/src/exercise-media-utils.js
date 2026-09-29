export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
export function validateMediaSelection(existing, files) {
  if (existing.length + files.length > 200)
    throw new Error("Tối đa 200 tệp mỗi bài.");
  if (
    existing.reduce((sum, item) => sum + item.size, 0) +
      files.reduce((sum, file) => sum + file.size, 0) >
    MAX_MEDIA_BYTES
  )
    throw new Error("Tổng tệp đính kèm tối đa 200 MB mỗi bài.");
  if (
    files.some(
      (file) => !file.size || !/\.(mp3|png|jpe?g|webp|gif)$/i.test(file.name),
    )
  )
    throw new Error("Chỉ nhận MP3, PNG, JPG, WebP hoặc GIF.");
}

// Preserve attachment targets when questions move; changed/deleted prompts require reassignment.
export function remapQuestionMedia(items, before, after) {
  const available = new Map();
  after.forEach((q, i) => {
    const ids = available.get(q.prompt) || [];
    ids.push(String(q.id || i + 1));
    available.set(q.prompt, ids);
  });
  const targets = new Map();
  before.forEach((q, i) =>
    targets.set(String(q.id || i + 1), available.get(q.prompt)?.shift() || ""),
  );
  return items.map((item) =>
    item.question
      ? { ...item, question: targets.get(String(item.question)) || "" }
      : item,
  );
}
