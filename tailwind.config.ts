import type { Config } from "tailwindcss"
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand:   { 50:"#eff6ff", 100:"#dbeafe", 400:"#60a5fa", 500:"#3b82f6", 600:"#2563eb" },
        surface: { DEFAULT:"#ffffff", hover:"#f8fafc", dark:"#0f172a" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      }
    }
  },
  plugins: [],
}
export default config
