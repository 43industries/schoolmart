import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Primary orange (kept as teal token for existing class names)
          teal: "#F27A20",
          "teal-light": "#E06A12",
          // Pink accent (kept as gold token for existing class names)
          gold: "#FF4DA6",
          "gold-light": "#FF7CBD",
          cream: "#FFFFFF",
          ink: "#111111",
          muted: "#4A4A4A",
          // Explicit aliases for new code
          orange: "#F27A20",
          "orange-hover": "#E06A12",
          pink: "#FF4DA6",
          "pink-light": "#FF7CBD",
          surface: "#FAFAFA",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
