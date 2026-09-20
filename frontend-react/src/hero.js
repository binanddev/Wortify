import { heroui } from "@heroui/theme";

export default heroui({
  defaultTheme: "light",
  themes: {
    light: {
      colors: {
        background: "#f1f5f9",
        foreground: "#1e293b",
        primary: { DEFAULT: "#007aff", foreground: "#ffffff" },
      },
    },
  },
});
