/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EEF0F4",
        ink: "#14161F",
        ink2: "#565C6B",
        brand: {
          DEFAULT: "#4338CA",
          light: "#5B4FE0",
          dark: "#332C99",
        },
        amber: {
          DEFAULT: "#C08A22",
          light: "#D9A63F",
        },
        teal: {
          DEFAULT: "#0F7A72",
          light: "#189087",
        },
        line: "#D8DCE3",
      },
      fontFamily: {
        serif: ["'Pretendard Variable'", "Pretendard", "-apple-system", "sans-serif"],
        sans: ["'Pretendard Variable'", "Pretendard", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,22,31,0.05), 0 10px 28px rgba(20,22,31,0.07)",
      },
    },
  },
  plugins: [],
};
