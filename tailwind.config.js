/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F3ED",
        ink: "#20242B",
        ink2: "#4A5160",
        brand: {
          DEFAULT: "#2C4A7C",
          light: "#3C61A0",
          dark: "#1D3358",
        },
        amber: {
          DEFAULT: "#C77D2E",
          light: "#E0994C",
        },
        line: "#DCD5C7",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "ui-serif", "Georgia", "serif"],
        sans: ["'Pretendard Variable'", "Pretendard", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(32,36,43,0.06), 0 8px 24px rgba(32,36,43,0.06)",
      },
    },
  },
  plugins: [],
};
