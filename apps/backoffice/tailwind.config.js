/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0FA3A3", dark: "#0B7F7F", light: "#E6F6F6" },
      },
    },
  },
  plugins: [],
};
