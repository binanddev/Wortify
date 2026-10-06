export const INTERFACES = ["studio", "glass", "xp", "retro", "space"];
export const interfaceName = (value) =>
  INTERFACES.includes(value) ? value : "studio";
export const INTERFACE_CHOICES = [
  ["studio", "Studio", "Sáng rõ, tinh tế. Không gian học mặc định."],
  ["glass", "Glass", "Kính tối, ánh sáng và ảnh nền riêng."],
  ["xp", "Windows XP", "Sắc xanh thân thuộc, cửa sổ cổ điển."],
  ["retro", "Retro Arcade", "Pixel, màu giấy ấm và tinh thần trò chơi."],
  ["space", "Space", "Không gian vũ trụ, xanh đêm và ánh sao."],
];
