/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eefbfa", 100: "#d5f5f2", 200: "#aee8e3", 300: "#73d2d0", 500: "#13969c", 600: "#087f8c", 700: "#076873", 800: "#07515b", 900: "#083f48" },
        surface: { page: "#f8fafc", card: "#ffffff", muted: "#f1f5f9" },
        success: { 50: "#ecfdf5", 200: "#a7f3d0", 700: "#047857" },
        warning: { 50: "#fffbeb", 200: "#fde68a", 700: "#b45309" },
        danger: { 50: "#fff1f2", 200: "#fecdd3", 700: "#be123c" },
        info: { 50: "#eff6ff", 200: "#bfdbfe", 700: "#1d4ed8" },
        chart: { teal: "#087f8c", success: "#059669", warning: "#d97706", info: "#3b82f6", danger: "#e11d48", neutral: "#94a3b8", grid: "#e2e8f0", fill: "#ccfbf1" }
      },
      borderRadius: { card: "0.75rem" },
      boxShadow: { card: "0 1px 2px rgb(15 23 42 / .04)", popover: "0 18px 48px rgb(15 23 42 / .14)" }
    }
  },
  plugins: []
};
