export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
export function validateMediaSelection(existing, files) {
  if (existing.length + files.length > 20)
    throw new Error("Tối đa 20 tệp mỗi bài.");
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
