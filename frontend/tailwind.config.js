/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        bg: "#05050A",
        primary: "#00F0FF",
        success: "#00FF41",
        danger: "#FF003C",
        warning: "#FFB800",
      },
      fontFamily: {
        display: ['Unbounded', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
