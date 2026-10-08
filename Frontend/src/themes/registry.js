export const INTERFACES = ["studio", "glass", "xp", "retro", "space"];
export const interfaceName = (value) =>
  INTERFACES.includes(value) ? value : "studio";
export const INTERFACE_CHOICES = [
  ["studio", "Studio", "Clear and refined. Your default learning space."],
  ["glass", "Glass", "Dark glass, soft light and your background."],
  ["xp", "Windows", "Familiar blues and classic windows."],
  ["retro", "Retro Arcade", "Pixels, warm paper and an arcade spirit."],
  ["space", "Space", "Outer space, midnight blue and starlight."],
];
