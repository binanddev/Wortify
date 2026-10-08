export const INTERFACES = ["studio", "glass", "xp", "retro", "notebook", "rpg"];
export const interfaceName = (value) =>
  INTERFACES.includes(value) ? value : "studio";
export const INTERFACE_CHOICES = [
  ["studio", "Studio", "Clear and refined. Your default learning space."],
  ["glass", "Glass", "Dark glass, soft light and your background."],
  ["xp", "Windows", "Familiar blues and classic windows."],
  ["retro", "Retro Arcade", "Pixels, warm paper and an arcade spirit."],
  ["notebook", "Notebook", "Graph paper, ink sketches and a personal study journal."],
  ["rpg", "MS-DOS", "Green phosphor, command prompts and classic terminal panels."],
];
